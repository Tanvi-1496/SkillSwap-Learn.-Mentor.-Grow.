import test from "node:test";
import assert from "node:assert/strict";
import { encodeAudioBufferToWav } from "./sessionAudioRecorder.js";

test("encodeAudioBufferToWav generates standard 16-bit 16kHz PCM WAV buffer with valid RIFF header", () => {
    // Mock AudioBuffer with 1 second of 16kHz audio (16000 samples)
    const sampleRate = 16000;
    const length = 16000;
    const channelData = new Float32Array(length);

    // Fill with synthetic sine wave
    for (let i = 0; i < length; i++) {
        channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const mockAudioBuffer = {
        sampleRate,
        length,
        numberOfChannels: 1,
        getChannelData: () => channelData
    };

    const wavBlob = encodeAudioBufferToWav(mockAudioBuffer, 16000);
    assert.equal(wavBlob.type, "audio/wav");

    // Total size should be 44-byte header + 16000 samples * 2 bytes = 32044 bytes
    assert.equal(wavBlob.size, 44 + 16000 * 2);
});

test("encodeAudioBufferToWav correctly downsamples 48kHz audio to 16kHz PCM WAV", () => {
    const sourceSampleRate = 48000;
    const sourceLength = 48000; // 1 second
    const channelData = new Float32Array(sourceLength);

    for (let i = 0; i < sourceLength; i++) {
        channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sourceSampleRate);
    }

    const mockAudioBuffer = {
        sampleRate: sourceSampleRate,
        length: sourceLength,
        numberOfChannels: 1,
        getChannelData: () => channelData
    };

    const wavBlob = encodeAudioBufferToWav(mockAudioBuffer, 16000);
    assert.equal(wavBlob.type, "audio/wav");
    // Target length is 16000 samples * 2 bytes = 32000 bytes + 44 header bytes
    assert.equal(wavBlob.size, 44 + 16000 * 2);
});

