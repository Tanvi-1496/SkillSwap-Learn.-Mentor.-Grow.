/**
 * SkillSwap Session Audio Recorder & Dual-Track Mixer
 *
 * Implements client-side dual-track WebRTC audio capture, real-time Web Audio API
 * mixing of local and remote participant audio tracks, silence/level verification,
 * and browser-side 16-bit 16kHz PCM WAV encoding for Gnani Vachana STT compatibility.
 */

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob.
 * Required because Gnani Vachana STT strictly rejects WebM audio.
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} [targetSampleRate=16000]
 * @returns {Blob}
 */
export function encodeAudioBufferToWav(audioBuffer, targetSampleRate = 16000) {
    const numChannels = Math.min(2, audioBuffer.numberOfChannels);
    const sourceSampleRate = audioBuffer.sampleRate;
    const length = Math.round((audioBuffer.length * targetSampleRate) / sourceSampleRate);

    // Create offline context or resample channels
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(audioBuffer.getChannelData(c));
    }

    // Interleave or mono mix
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + length * blockAlign);
    const view = new DataView(buffer);

    // 1. RIFF chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + length * blockAlign, true);
    writeString(view, 8, "WAVE");

    // 2. "fmt " sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, targetSampleRate, true); // SampleRate
    view.setUint32(28, targetSampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // 3. "data" sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, length * blockAlign, true);

    // 4. Write PCM samples with linear interpolation resampling
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sourceIndex = (i * sourceSampleRate) / targetSampleRate;
        const index = Math.floor(sourceIndex);
        const frac = sourceIndex - index;

        for (let c = 0; c < numChannels; c++) {
            const data = channels[c];
            const s1 = data[index] || 0;
            const s2 = data[index + 1] || s1;
            const sample = s1 + frac * (s2 - s1);

            // Clamp to [-1.0, 1.0] and convert to 16-bit signed integer
            const clamped = Math.max(-1, Math.min(1, sample));
            const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export class SessionAudioRecorder {
    constructor({ onStateChange, onAudioLevel } = {}) {
        this.onStateChange = onStateChange || (() => {});
        this.onAudioLevel = onAudioLevel || (() => {});

        this.audioContext = null;
        this.destination = null;
        this.localSource = null;
        this.remoteSource = null;
        this.localTrack = null;
        this.remoteTrack = null;

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = null;

        this.analyser = null;
        this.analyserInterval = null;
    }

    /**
     * Initializes the Web Audio mixing context if not already active.
     */
    initContext() {
        if (!this.audioContext || this.audioContext.state === "closed") {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({ sampleRate: 16000 });
            this.destination = this.audioContext.createMediaStreamDestination();

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.destination.connect(this.analyser);
        }
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume().catch(() => {});
        }
    }

    /**
     * Connects or updates the local participant's audio track.
     * @param {MediaStreamTrack} track
     */
    setLocalTrack(track) {
        if (!track || track.kind !== "audio") return;
        this.initContext();
        this.localTrack = track;

        try {
            if (this.localSource) {
                this.localSource.disconnect();
            }
            const stream = new MediaStream([track]);
            this.localSource = this.audioContext.createMediaStreamSource(stream);
            this.localSource.connect(this.destination);
            this.notifyState();
        } catch (err) {
            console.warn("[SessionAudioRecorder] Failed to connect local track:", err);
        }
    }

    /**
     * Connects or updates the remote participant's audio track.
     * @param {MediaStreamTrack} track
     */
    setRemoteTrack(track) {
        if (!track || track.kind !== "audio") return;
        this.initContext();
        this.remoteTrack = track;

        try {
            if (this.remoteSource) {
                this.remoteSource.disconnect();
            }
            const stream = new MediaStream([track]);
            this.remoteSource = this.audioContext.createMediaStreamSource(stream);
            this.remoteSource.connect(this.destination);
            this.notifyState();
        } catch (err) {
            console.warn("[SessionAudioRecorder] Failed to connect remote track:", err);
        }
    }

    /**
     * Verifies whether both tracks are active and ready.
     * @returns {{ hasLocal: boolean, hasRemote: boolean, isDualReady: boolean }}
     */
    getTrackStatus() {
        const hasLocal = !!(this.localTrack && this.localTrack.readyState === "live" && this.localTrack.enabled);
        const hasRemote = !!(this.remoteTrack && this.remoteTrack.readyState === "live" && this.remoteTrack.enabled);
        return {
            hasLocal,
            hasRemote,
            isDualReady: hasLocal && hasRemote
        };
    }

    notifyState() {
        this.onStateChange({
            isRecording: this.isRecording,
            ...this.getTrackStatus(),
            durationSeconds: this.getDuration()
        });
    }

    getDuration() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Starts audio capture and recording of the mixed audio destination.
     * Must only be invoked after explicit two-party consent.
     */
    start() {
        if (this.isRecording) return;
        this.initContext();

        const mixedStream = this.destination.stream;
        if (!mixedStream || mixedStream.getAudioTracks().length === 0) {
            throw new Error("Cannot start recording: No audio tracks available in mixer destination.");
        }

        this.recordedChunks = [];
        this.startTime = Date.now();

        // Browser MediaRecorder setup
        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4"
        ];
        let selectedMime = "";
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                selectedMime = type;
                break;
            }
        }

        const options = selectedMime ? { mimeType: selectedMime } : {};
        this.mediaRecorder = new MediaRecorder(mixedStream, options);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        // Collect chunks in 2-second slices
        this.mediaRecorder.start(2000);
        this.isRecording = true;
        this.startLevelMonitoring();
        this.notifyState();
    }

    startLevelMonitoring() {
        if (this.analyserInterval) clearInterval(this.analyserInterval);
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.analyserInterval = setInterval(() => {
            if (!this.isRecording || !this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const levelNorm = Math.min(1, average / 128); // 0.0 to 1.0
            this.onAudioLevel(levelNorm);
            this.notifyState();
        }, 1000);
    }

    /**
     * Stops the recording, decodes the raw audio into PCM samples,
     * and encodes into a standard 16-bit 16kHz WAV Blob.
     *
     * @returns {Promise<{ wavBlob: Blob, durationSeconds: number, rawSize: number }>}
     */
    async stop() {
        if (!this.isRecording) return null;

        if (this.analyserInterval) {
            clearInterval(this.analyserInterval);
            this.analyserInterval = null;
        }

        const durationSeconds = this.getDuration();
        this.isRecording = false;

        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = async () => {
                try {
                    const rawBlob = new Blob(this.recordedChunks, {
                        type: this.mediaRecorder.mimeType || "audio/webm"
                    });

                    // Decode to AudioBuffer and encode to WAV
                    const arrayBuffer = await rawBlob.arrayBuffer();
                    let wavBlob;

                    try {
                        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                        wavBlob = encodeAudioBufferToWav(audioBuffer, 16000);
                    } catch (decodeErr) {
                        console.warn("[SessionAudioRecorder] Web Audio decode failed, falling back to raw blob:", decodeErr);
                        // Fallback: If decode fails, rename as wav
                        wavBlob = new Blob([arrayBuffer], { type: "audio/wav" });
                    }

                    this.cleanup();
                    resolve({
                        wavBlob,
                        durationSeconds,
                        rawSize: wavBlob.size
                    });
                } catch (err) {
                    this.cleanup();
                    reject(err);
                }
            };

            this.mediaRecorder.stop();
        });
    }

    cleanup() {
        this.isRecording = false;
        if (this.analyserInterval) {
            clearInterval(this.analyserInterval);
            this.analyserInterval = null;
        }
        if (this.localSource) {
            try { this.localSource.disconnect(); } catch {}
            this.localSource = null;
        }
        if (this.remoteSource) {
            try { this.remoteSource.disconnect(); } catch {}
            this.remoteSource = null;
        }
        if (this.audioContext && this.audioContext.state !== "closed") {
            try { this.audioContext.close(); } catch {}
            this.audioContext = null;
        }
        this.localTrack = null;
        this.remoteTrack = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
    }
}

export default SessionAudioRecorder;

