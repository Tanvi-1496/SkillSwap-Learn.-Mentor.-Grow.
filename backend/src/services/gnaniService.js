/**
 * Gnani.ai Vachana Speech-to-Text (STT) Service
 * Communicates with Gnani Vachana STT v3 REST API (Prisma v3.0 model)
 * Endpoint: https://api.vachana.ai/stt/v3
 */

const GNANI_STT_ENDPOINT = process.env.GNANI_STT_ENDPOINT || "https://api.vachana.ai/stt/v3";
const DEFAULT_MODEL = "prisma-v3.0";
const DEFAULT_LANGUAGE = "indic-auto";
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds
export const MAX_AUDIO_DURATION_SECONDS = 30.0; // Gnani REST STT 30-second ceiling

/**
 * Validates audio format against documented Gnani input formats:
 * WAV, MP3, M4A, AAC, FLAC, OGG. (WEBM is strictly excluded).
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isSupportedAudioFormat(fileName = "", mimeType = "") {
    const validExtensions = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"];
    const lowerName = fileName.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    const validMimes = [
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/aac",
        "audio/flac",
        "audio/x-flac",
        "audio/ogg",
        "application/ogg"
    ];
    const hasValidMime = validMimes.includes((mimeType || "").toLowerCase());

    return hasValidExt || hasValidMime;
}

/**
 * Estimates or parses audio duration in seconds from binary buffer.
 * Supports WAV (canonical RIFF/fmt/data chunk header) and MP3 (CBR frame sync).
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} fileName
 * @returns {number|null} Duration in seconds, or null if unknown
 */
export function estimateAudioDuration(fileBuffer, mimeType = "", fileName = "") {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length < 44) {
        return null;
    }

    const lowerName = fileName.toLowerCase();
    const isWav = lowerName.endsWith(".wav") || mimeType.includes("wav");

    // 1. WAV Duration Parsing
    if (
        isWav &&
        fileBuffer.toString("ascii", 0, 4) === "RIFF" &&
        fileBuffer.toString("ascii", 8, 12) === "WAVE"
    ) {
        let offset = 12;
        let byteRate = null;
        let dataSize = null;

        while (offset + 8 <= fileBuffer.length) {
            const chunkId = fileBuffer.toString("ascii", offset, offset + 4);
            const chunkSize = fileBuffer.readUInt32LE(offset + 4);

            if (chunkId === "fmt " && chunkSize >= 16 && offset + 8 + 16 <= fileBuffer.length) {
                // ByteRate is located at offset + 8 (chunk header) + 8 (formatTag 2 + channels 2 + sampleRate 4)
                byteRate = fileBuffer.readUInt32LE(offset + 16);
            } else if (chunkId === "data") {
                dataSize = chunkSize;
                break;
            }

            offset += 8 + chunkSize;
        }

        if (byteRate && byteRate > 0) {
            const actualDataSize = dataSize || fileBuffer.length - 44;
            return Math.round((actualDataSize / byteRate) * 100) / 100;
        }
    }

    // 2. MP3 Duration Parsing
    const isMp3 = lowerName.endsWith(".mp3") || mimeType.includes("mpeg") || mimeType.includes("mp3");
    if (isMp3) {
        let offset = 0;
        // Skip ID3v2 header if present
        if (fileBuffer.toString("ascii", 0, 3) === "ID3" && fileBuffer.length > 10) {
            const id3Size =
                ((fileBuffer[6] & 0x7f) << 21) |
                ((fileBuffer[7] & 0x7f) << 14) |
                ((fileBuffer[8] & 0x7f) << 7) |
                (fileBuffer[9] & 0x7f);
            offset = 10 + id3Size;
        }

        while (offset + 4 <= fileBuffer.length) {
            if (fileBuffer[offset] === 0xff && (fileBuffer[offset + 1] & 0xe0) === 0xe0) {
                const versionBits = (fileBuffer[offset + 1] >> 3) & 0x03; // 3 = MPEG-1
                const layerBits = (fileBuffer[offset + 1] >> 1) & 0x03; // 1 = Layer III
                const bitrateIndex = (fileBuffer[offset + 2] >> 4) & 0x0f;

                const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
                if (versionBits === 3 && layerBits === 1 && bitrateIndex > 0 && bitrateIndex < 15) {
                    const bitrateBps = mpeg1Layer3Bitrates[bitrateIndex] * 1000;
                    const audioBytes = fileBuffer.length - offset;
                    const duration = (audioBytes * 8) / bitrateBps;
                    return Math.round(duration * 100) / 100;
                }
                break;
            }
            offset++;
        }
    }

    return null;
}

/**
 * Transcribes an audio file buffer using the Gnani.ai Vachana STT v3 API.
 *
 * @param {Object} params
 * @param {Buffer} params.fileBuffer - Binary buffer of the uploaded audio file
 * @param {string} params.fileName - Original file name (e.g. "session_123.wav")
 * @param {string} params.mimeType - MIME type of the audio file (e.g. "audio/wav")
 * @param {string} [params.languageCode] - Language code (defaults to 'indic-auto')
 * @param {number} [params.clientDuration] - Client-reported duration in seconds
 * @returns {Promise<{ success: boolean, transcript?: string, language?: string, duration?: number, processingTime?: number, error?: string, statusCode?: number, isMock?: boolean }>}
 */
export async function transcribeAudio({
    fileBuffer,
    fileName = "session_recording.wav",
    mimeType = "audio/wav",
    languageCode = DEFAULT_LANGUAGE,
    clientDuration = null
}) {
    // 1. Validate inputs
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        return {
            success: false,
            error: "Audio file buffer is empty or missing"
        };
    }

    if (!isSupportedAudioFormat(fileName, mimeType)) {
        return {
            success: false,
            error: `Unsupported audio format: ${fileName} (${mimeType}). Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG.`
        };
    }

    // 2. Validate audio duration (30-second Gnani REST ceiling)
    const detectedDuration = estimateAudioDuration(fileBuffer, mimeType, fileName);
    const effectiveDuration = detectedDuration !== null ? detectedDuration : clientDuration;

    if (effectiveDuration !== null && effectiveDuration > MAX_AUDIO_DURATION_SECONDS) {
        return {
            success: false,
            error: `Audio duration (${effectiveDuration}s) exceeds the maximum allowed limit of ${MAX_AUDIO_DURATION_SECONDS} seconds for instant transcription. Please provide an audio clip of 30 seconds or less. Longer sessions can be processed in a future batch release.`,
            duration: effectiveDuration,
            statusCode: 400
        };
    }

    const apiKey = (process.env.GNANI_API_KEY || process.env.GNANI_STT_KEY || "").trim();
    const isProduction = process.env.NODE_ENV === "production";
    const isExplicitMock = process.env.GNANI_MOCK === "true";
    const isTestMode = process.env.NODE_ENV === "test";

    // 3. Mock mode safety: Production must NEVER silently fall back to mock
            if (isProduction) {
                if (!apiKey) {
                    console.error("[GnaniService] FATAL: GNANI_API_KEY is not configured in production environment.");
                    return {
                        success: false,
                        error: "CRITICAL CONFIGURATION ERROR: GNANI_API_KEY is required in production environment.",
                        statusCode: 500
                    };
                }
            } else if (isExplicitMock || (isTestMode && process.env.GNANI_LIVE !== "true")) {
                console.warn(
                    "[GnaniService] Notice: Running in simulated test mode (NODE_ENV=test or GNANI_MOCK=true)."
                );
                return {
                    success: true,
                    transcript:
                        "Hello, welcome to our SkillSwap mentorship session. Today we reviewed full-stack React components, database index optimizations, and API design principles. Next session will focus on live deployment and security audits.",
                    language: languageCode === "indic-auto" ? "en-IN" : languageCode,
                    duration: effectiveDuration || 15.0,
                    processingTime: 0.42,
                    isMock: true
                };
            } else if (!apiKey) {
                return {
                    success: false,
                    error: "GNANI_API_KEY is not configured. Please add GNANI_API_KEY to backend/.env to connect to the live Gnani Vachana STT API.",
                    statusCode: 500
                };
            }

            // 4. Prepare multipart/form-data for live Gnani Vachana STT API
            const formData = new FormData();
            const audioBlob = new Blob([fileBuffer], { type: mimeType });
            formData.append("audio_file", audioBlob, fileName);
            formData.append("model", DEFAULT_MODEL);
            formData.append("language_code", languageCode || DEFAULT_LANGUAGE);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            try {
                const response = await fetch(GNANI_STT_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "X-API-Key-ID": apiKey
                    },
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const contentType = response.headers.get("content-type") || "";
                const isJson = contentType.includes("application/json");
                const responseData = isJson ? await response.json() : await response.text();

                // 5. Handle HTTP error responses
                if (!response.ok) {
                    let errorMsg = `Gnani STT API failed with status ${response.status}`;
                    if (isJson && responseData) {
                        if (responseData.error?.message) {
                            errorMsg = responseData.error.message;
                        } else if (responseData.detail?.message) {
                            errorMsg = responseData.detail.message;
                        } else if (typeof responseData.detail === "string") {
                            errorMsg = responseData.detail;
                        }
                    } else if (typeof responseData === "string") {
                        errorMsg = responseData.slice(0, 200);
                    }

                    console.error(`[GnaniService] Live STT Error (${response.status}):`, errorMsg);
                    return {
                        success: false,
                        error: errorMsg,
                        statusCode: response.status
                    };
                }

                // 6. Handle successful transcription payload
                const transcriptText = (responseData.transcript || "").trim();

                if (!transcriptText) {
                    return {
                        success: false,
                        error: "Gnani API completed successfully but returned an empty or silent transcript"
                    };
                }

                return {
                    success: true,
                    transcript: transcriptText,
                    language: responseData.detected_language_code || languageCode || "en-IN",
                    duration: effectiveDuration,
                    processingTime: responseData.processing_time || null,
                    requestId: responseData.request_id || null,
                    isMock: false
                };
            } catch (err) {
                clearTimeout(timeoutId);

                if (err.name === "AbortError") {
                    return {
                        success: false,
                        error: `Gnani STT request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`
                    };
                }

                console.error("[GnaniService] Network/system exception:", err);
                return {
                    success: false,
                    error: err.message || "Failed to communicate with Gnani STT service"
                };
            }
        }

        export default {
            transcribeAudio,
            isSupportedAudioFormat,
            estimateAudioDuration,
            MAX_AUDIO_DURATION_SECONDS
        };
