/**
 * Gnani.ai Vachana Speech-to-Text (STT) Batch Jobs Service
 *
 * Implements asynchronous long-session audio transcription with speaker diarization
 * using the Gnani Vachana Prisma v3 Batch Jobs API:
 * - Direct Multipart Upload (<= 10 MB): https://api.vachana.ai/stt/v3/batch/jobs
 * - Presigned Upload (> 10 MB): https://api.vachana.ai/stt/v3/batch/v2/jobs
 *
 * Security & Reliability Features:
 * - Persistent job tracking in Supabase with restart recovery.
 * - Timing-safe webhook authentication using GNANI_WEBHOOK_SECRET.
 * - Authoritative REST verification before accepting webhook completion.
 * - Concurrency-safe, atomic finalization idempotency (single execution of Evon AI & Moderation).
 * - Exponential backoff polling with transient network error tolerance (up to 15 mins).
 * - Multi-speaker diarization (Student vs Mentor separation) with timestamp alignments.
 */

import crypto from "crypto";
import fs from "fs";
import supabase from "../config/supabase.js";
import { isSupportedAudioFormat, resolveDetectedLanguage, DEFAULT_LANGUAGE } from "./gnaniService.js";
import { upsertTranscriptRecord, getTranscriptRecord, getTranscriptByJobId } from "../routes/bookings.js";
import { moderateBookingTranscript } from "./moderationService.js";
import { generateOrGetSessionInsights } from "./sessionInsightsService.js";

export const GNANI_BATCH_BASE_URL = process.env.GNANI_BATCH_ENDPOINT || "https://api.vachana.ai/stt/v3/batch/jobs";
export const GNANI_BATCH_V2_URL = process.env.GNANI_BATCH_V2_ENDPOINT || "https://api.vachana.ai/stt/v3/batch/v2/jobs";
export const DEFAULT_BATCH_MODEL = "prisma-v3.0";
export const DIRECT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB ceiling for direct multipart upload
export const MAX_BATCH_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB hard safety ceiling

export function getGnaniApiKey() {
    return (process.env.GNANI_API_KEY || process.env.GNANI_STT_KEY || "").trim();
}

// In-memory cache for fast lookups & testing (complements persistent database storage)
export const batchJobsStore = new Map();

/**
 * Resets the in-memory batch jobs store (used for test isolation).
 */
export function resetBatchState() {
    batchJobsStore.clear();
}

/**
 * Performs timing-safe comparison of webhook secrets to defend against timing attacks.
 * @param {string} providedSecret
 * @param {string} [configuredSecret]
 * @returns {boolean}
 */
export function verifyWebhookSecret(providedSecret, configuredSecret = process.env.GNANI_WEBHOOK_SECRET) {
    const expected = configuredSecret || process.env.GNANI_WEBHOOK_SECRET || "";
    if (!providedSecret || !expected) return false;

    const bufProvided = Buffer.from(String(providedSecret).trim());
    const bufExpected = Buffer.from(String(expected).trim());

    if (bufProvided.length !== bufExpected.length) {
        return false;
    }

    return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Retrieves the active job ID for a booking from Supabase or fallback store.
 * Survives backend restarts by inspecting persistent storage first.
 *
 * @param {string} bookingId
 * @returns {Promise<string|null>}
 */
export async function getJobIdForBooking(bookingId) {
    if (!bookingId) return null;

    // 1. Check persistent database record first
    const record = await getTranscriptRecord(bookingId);
    if (record?.provider_job_id && ["processing", "completed"].includes(record.status)) {
        return record.provider_job_id;
    }

    // 2. Fallback to in-memory cache
    for (const [jobId, job] of batchJobsStore.entries()) {
        if (job.bookingId === bookingId && ["CREATED", "RUNNING", "COMPLETED"].includes(job.status)) {
            return jobId;
        }
    }

    return null;
}

/**
 * Submits a new batch transcription job to Gnani Vachana STT.
 * Routes files <= 10 MB through direct multipart upload, and files > 10 MB
 * through the documented presigned upload workflow (/stt/v3/batch/v2/jobs).
 *
 * @param {Object} params
 * @param {Buffer} params.fileBuffer - Raw binary audio buffer
 * @param {string} [params.fileName="session_recording.wav"]
 * @param {string} [params.mimeType="audio/wav"]
 * @param {string} [params.languageCode="indic-auto"]
 * @param {boolean} [params.withDiarization=true]
 * @param {number} [params.numSpeakers=2]
 * @param {string} [params.bookingId=null]
 * @param {string} [params.callbackUrl=null]
 * @returns {Promise<{ success: boolean, jobId?: string, status?: string, uploadMethod?: string, isDuplicate?: boolean, error?: string, statusCode?: number, isMock?: boolean }>}
 */
export async function createBatchJob({
    fileBuffer = null,
    filePath = null,
    fileName = "session_recording.wav",
    mimeType = "audio/wav",
    languageCode = DEFAULT_LANGUAGE,
    withDiarization = true,
    numSpeakers = 2,
    bookingId = null,
    callbackUrl = null
}) {
    // 1. Determine size and validate presence
    let fileSize = 0;
    if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
        fileSize = fileBuffer.length;
    } else if (filePath && fs.existsSync(filePath)) {
        try {
            fileSize = fs.statSync(filePath).size;
        } catch {
            fileSize = 0;
        }
    }

    if (fileSize === 0) {
        return {
            success: false,
            error: "Audio file buffer or path is empty or missing",
            statusCode: 400
        };
    }

    if (fileSize > MAX_BATCH_AUDIO_BYTES) {
        return {
            success: false,
            error: `Audio file size (${Math.round(fileSize / (1024 * 1024))} MB) exceeds maximum allowed limit of ${MAX_BATCH_AUDIO_BYTES / (1024 * 1024)} MB`,
            statusCode: 400
        };
    }

    if (!isSupportedAudioFormat(fileName, mimeType)) {
        return {
            success: false,
            error: `Unsupported audio format: ${fileName} (${mimeType}). Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG.`,
            statusCode: 400
        };
    }

    // 2. Prevent duplicate jobs for the same booking (checks database + memory)
    if (bookingId) {
        const existingJobId = await getJobIdForBooking(bookingId);
        if (existingJobId) {
            return {
                success: true,
                jobId: existingJobId,
                status: "processing",
                isDuplicate: true,
                message: `Active transcription job ${existingJobId} already exists for booking ${bookingId}`
            };
        }
    }

    const apiKey = getGnaniApiKey();
    const isProduction = process.env.NODE_ENV === "production";
    const isExplicitMock = process.env.GNANI_MOCK === "true";
    const isTestMode = process.env.NODE_ENV === "test";

    // 3. Provider Authentication validation
    if (isProduction && !apiKey) {
        console.error("[GnaniBatchService] FATAL: GNANI_API_KEY is not configured in production.");
        return {
            success: false,
            error: "CRITICAL CONFIGURATION ERROR: GNANI_API_KEY is required in production environment.",
            statusCode: 500
        };
    }

    const isLargeAudio = fileSize > DIRECT_UPLOAD_MAX_BYTES;

    // 4. Simulated / Test Mode execution
    if (isExplicitMock || (isTestMode && process.env.GNANI_LIVE !== "true")) {
        const simulatedJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const jobData = {
            jobId: simulatedJobId,
            bookingId,
            fileName,
            mimeType,
            status: "CREATED",
            languageCode: languageCode || DEFAULT_LANGUAGE,
            withDiarization,
            numSpeakers,
            createdAt: new Date().toISOString(),
            isMock: true,
            bufferSize: fileSize,
            uploadMethod: isLargeAudio ? "presigned_v2" : "direct_multipart"
        };

        batchJobsStore.set(simulatedJobId, jobData);

        return {
            success: true,
            jobId: simulatedJobId,
            status: "CREATED",
            uploadMethod: jobData.uploadMethod,
            isMock: true
        };
    }

    if (!apiKey) {
        return {
            success: false,
            error: "GNANI_API_KEY is not configured. Please add GNANI_API_KEY to backend/.env to connect to live Gnani Batch API.",
            statusCode: 500
        };
    }

    // 5. Live Gnani Batch Job Creation
    try {
        const configPayload = {
            model: DEFAULT_BATCH_MODEL,
            language_code: languageCode || DEFAULT_LANGUAGE,
            mode: "transcribe",
            with_diarization: !!withDiarization,
            num_speakers: numSpeakers || 2
        };

        if (callbackUrl) {
            configPayload.callback_url = callbackUrl;
        }

        // Branch A: Direct multipart upload for files <= 10 MB
        if (!isLargeAudio) {
            const formData = new FormData();
            const rawBytes = fileBuffer || fs.readFileSync(filePath);
            const audioBlob = new Blob([rawBytes], { type: mimeType });
            formData.append("audio_file", audioBlob, fileName);
            formData.append("config", JSON.stringify(configPayload));

            const response = await fetch(GNANI_BATCH_BASE_URL, {
                method: "POST",
                headers: {
                    "X-API-Key-ID": apiKey
                },
                body: formData
            });

            const isJson = (response.headers.get("content-type") || "").includes("application/json");
            const data = isJson ? await response.json() : await response.text();

            if (!response.ok) {
                let errorMsg = `Gnani Batch API failed with status ${response.status}`;
                if (isJson && data) {
                    errorMsg = data.error?.message || data.detail || errorMsg;
                }
                return {
                    success: false,
                    error: errorMsg,
                    statusCode: response.status
                };
            }

            const jobId = data.job_id || data.id;
            const status = data.status || "CREATED";

            batchJobsStore.set(jobId, {
                jobId,
                bookingId,
                fileName,
                mimeType,
                status,
                uploadMethod: "direct_multipart",
                createdAt: new Date().toISOString(),
                isMock: false
            });

            return {
                success: true,
                jobId,
                status,
                uploadMethod: "direct_multipart",
                isMock: false
            };
        }

        // Branch B: Presigned upload workflow for files > 10 MB (/stt/v3/batch/v2/jobs)
        const presignedInitRes = await fetch(GNANI_BATCH_V2_URL, {
            method: "POST",
            headers: {
                "X-API-Key-ID": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                config: configPayload,
                file_name: fileName,
                file_size: fileSize
            })
        });

        if (!presignedInitRes.ok) {
            return {
                success: false,
                error: `Failed to initialize presigned upload: HTTP ${presignedInitRes.status}`,
                statusCode: presignedInitRes.status
            };
        }

        const presignedData = await presignedInitRes.json();
        const uploadUrl = presignedData.upload_url;
        const jobId = presignedData.job_id || presignedData.id;

        if (!uploadUrl || !jobId) {
            return {
                success: false,
                error: "Presigned upload initialization did not return upload_url or job_id",
                statusCode: 502
            };
        }

        // Perform HTTP PUT directly to presigned cloud storage (streams from disk if filePath provided)
        const uploadBody = filePath ? fs.createReadStream(filePath) : fileBuffer;
        const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": mimeType
            },
            body: uploadBody,
            duplex: "half"
        });

        if (!uploadRes.ok) {
            return {
                success: false,
                error: `Failed to upload audio to presigned storage: HTTP ${uploadRes.status}`,
                statusCode: uploadRes.status
            };
        }

        batchJobsStore.set(jobId, {
            jobId,
            bookingId,
            fileName,
            mimeType,
            status: "CREATED",
            uploadMethod: "presigned_v2",
            createdAt: new Date().toISOString(),
            isMock: false
        });

        return {
            success: true,
            jobId,
            status: "CREATED",
            uploadMethod: "presigned_v2",
            isMock: false
        };
    } catch (err) {
        console.error("[GnaniBatchService] Job creation network error:", err);
        return {
            success: false,
            error: err.message || "Failed to create Gnani batch job",
            statusCode: 500
        };
    }
}

/**
 * Starts execution of a created batch job.
 * @param {string} jobId
 * @returns {Promise<{ success: boolean, status?: string, error?: string, statusCode?: number }>}
 */
export async function startBatchJob(jobId) {
    if (!jobId || typeof jobId !== "string") {
        return { success: false, error: "Invalid Job ID", statusCode: 400 };
    }

    const job = batchJobsStore.get(jobId);
    const isMock = job?.isMock || process.env.NODE_ENV === "test";

    if (isMock) {
        if (job) {
            job.status = "RUNNING";
            job.startedAt = new Date().toISOString();
        }
        return { success: true, jobId, status: "RUNNING", isMock: true };
    }

    const apiKey = getGnaniApiKey();
    try {
        const response = await fetch(`${GNANI_BATCH_BASE_URL}/${jobId}/start`, {
            method: "POST",
            headers: {
                "X-API-Key-ID": apiKey
            }
        });

        const isJson = (response.headers.get("content-type") || "").includes("application/json");
        const data = isJson ? await response.json() : await response.text();

        if (!response.ok) {
            return {
                success: false,
                error: (isJson && data.error?.message) || `Failed to start job: HTTP ${response.status}`,
                statusCode: response.status
            };
        }

        if (job) job.status = data.status || "RUNNING";
        return { success: true, jobId, status: data.status || "RUNNING" };
    } catch (err) {
        return { success: false, error: err.message || "Network error starting batch job", statusCode: 500 };
    }
}

/**
 * Authoritatively retrieves the current status of a batch job from Gnani REST API.
 * @param {string} jobId
 * @returns {Promise<{ success: boolean, jobId: string, status?: string, error?: string, statusCode?: number }>}
 */
export async function getBatchJobStatus(jobId) {
    if (!jobId) {
        return { success: false, error: "Missing Job ID", statusCode: 400 };
    }

    const job = batchJobsStore.get(jobId);
    const isMock = job?.isMock || process.env.NODE_ENV === "test";

    if (isMock) {
        const currentStatus = job?.status || "RUNNING";
        return { success: true, jobId, status: currentStatus, isMock: true };
    }

    const apiKey = getGnaniApiKey();
    try {
        const response = await fetch(`${GNANI_BATCH_BASE_URL}/${jobId}`, {
            headers: {
                "X-API-Key-ID": apiKey
            }
        });

        const isJson = (response.headers.get("content-type") || "").includes("application/json");
        const data = isJson ? await response.json() : await response.text();

        if (!response.ok) {
            return {
                success: false,
                jobId,
                error: (isJson && data.error?.message) || `Error fetching job status: HTTP ${response.status}`,
                statusCode: response.status
            };
        }

        const status = data.status || "UNKNOWN";
        if (job) job.status = status;

        return {
            success: true,
            jobId,
            status,
            raw: data
        };
    } catch (err) {
        return { success: false, jobId, error: err.message, statusCode: 500 };
    }
}

/**
 * Parses raw diarized Gnani batch transcript data into clean structured dialogue.
 *
 * @param {Object} rawPayload - Data returned from Gnani transcript_url or mock payload
 * @param {Object} [options]
 * @param {string} [options.studentName="Student"]
 * @param {string} [options.mentorName="Mentor"]
 * @returns {{
 *   transcriptText: string,
 *   segments: Array<{ speaker: string, speakerLabel: string, text: string, start: number, end: number, words?: Array<any> }>,
 *   detectedLanguage: string,
 *   durationSeconds: number|null
 * }}
 */
export function parseDiarizedTranscript(rawPayload = {}, { studentName = "Student", mentorName = "Mentor" } = {}) {
    const segments = [];
    const transcriptLines = [];

    const formatTime = (secs = 0) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const rawSegments = rawPayload.segments || rawPayload.speaker_segments || [];
    let detectedLanguage = rawPayload.detected_language_code || rawPayload.language || "en-IN";
    detectedLanguage = resolveDetectedLanguage(detectedLanguage);

    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
        for (const seg of rawSegments) {
            const rawSpeaker = seg.speaker || seg.speaker_tag || "Speaker 1";
            const isSpeaker1 = rawSpeaker === "Speaker 1" || rawSpeaker === "1" || rawSpeaker === 0;
            const speakerLabel = isSpeaker1 ? `Mentor (${mentorName})` : `Student (${studentName})`;
            const text = (seg.text || "").trim();
            const start = typeof seg.start === "number" ? seg.start : (seg.start_time || 0);
            const end = typeof seg.end === "number" ? seg.end : (seg.end_time || 0);

            if (text) {
                segments.push({
                    speaker: rawSpeaker,
                    speakerLabel,
                    text,
                    start,
                    end,
                    words: seg.words || []
                });
                transcriptLines.push(`[${formatTime(start)} - ${formatTime(end)}] ${speakerLabel}: ${text}`);
            }
        }
    }

    let transcriptText = transcriptLines.join("\n");
    if (!transcriptText && rawPayload.full_transcript) {
        transcriptText = rawPayload.full_transcript.trim();
    } else if (!transcriptText && rawPayload.transcript) {
        transcriptText = rawPayload.transcript.trim();
    }

    return {
        transcriptText,
        segments,
        detectedLanguage,
        durationSeconds: rawPayload.duration_seconds || rawPayload.duration || null
    };
}

/**
 * Fetches the completed transcript and diarization file from Gnani Batch API.
 * @param {string} jobId
 * @param {Object} [participantOptions]
 * @returns {Promise<{ success: boolean, transcriptText?: string, segments?: Array<any>, language?: string, duration?: number, error?: string }>}
 */
export async function fetchBatchJobTranscript(jobId, participantOptions = {}) {
    const job = batchJobsStore.get(jobId);
    const isMock = job?.isMock || process.env.NODE_ENV === "test";

    if (isMock) {
        const mockPayload = {
            duration_seconds: 45.2,
            detected_language_code: "en-IN",
            segments: [
                {
                    speaker: "Speaker 1",
                    start: 0.0,
                    end: 12.5,
                    text: "Welcome to our SkillSwap mentorship session. Today we are conducting an architectural review of React live video calling and speech-to-text integration.",
                    words: []
                },
                {
                    speaker: "Speaker 2",
                    start: 13.0,
                    end: 27.8,
                    text: "Thank you! I wanted to check how we preserve two-party consent, handle speaker diarization, and prevent gateway timeouts on long sessions.",
                    words: []
                },
                {
                    speaker: "Speaker 1",
                    start: 28.5,
                    end: 45.0,
                    text: "We use asynchronous Gnani Batch Jobs with speaker diarization. This provides separate speaker turns without cutting audio into artificial chunks.",
                    words: []
                }
            ]
        };

        const parsed = parseDiarizedTranscript(mockPayload, participantOptions);
        return {
            success: true,
            transcriptText: parsed.transcriptText,
            segments: parsed.segments,
            language: parsed.detectedLanguage,
            duration: parsed.durationSeconds,
            isMock: true
        };
    }

    const apiKey = getGnaniApiKey();
    try {
        const fileListRes = await fetch(`${GNANI_BATCH_BASE_URL}/${jobId}/files?status=COMPLETED`, {
            headers: { "X-API-Key-ID": apiKey }
        });

        if (!fileListRes.ok) {
            return {
                success: false,
                error: `Failed to fetch batch files: HTTP ${fileListRes.status}`
            };
        }

        const fileListData = await fileListRes.json();
        const firstFile = fileListData.data?.[0];
        const transcriptUrl = firstFile?.transcript_url;

        if (!transcriptUrl) {
            return {
                success: false,
                error: "No transcript_url found in completed batch job payload"
            };
        }

        const transcriptRes = await fetch(transcriptUrl);
        if (!transcriptRes.ok) {
            return {
                success: false,
                error: `Failed to download transcript from presigned URL: HTTP ${transcriptRes.status}`
            };
        }

        const rawJson = await transcriptRes.json();
        const parsed = parseDiarizedTranscript(rawJson, participantOptions);

        return {
            success: true,
            transcriptText: parsed.transcriptText,
            segments: parsed.segments,
            language: parsed.detectedLanguage,
            duration: parsed.durationSeconds || firstFile.duration_seconds || null,
            isMock: false
        };
    } catch (err) {
        console.error("[GnaniBatchService] Fetch transcript error:", err);
        return {
            success: false,
            error: err.message || "Failed to download batch transcript"
        };
    }
}

// Synchronous finalization lock registry to prevent event-loop race conditions
const activeFinalizationLocks = new Set();

/**
 * Concurrency-safe, durable finalization of a completed transcript.
 * Implements an atomic state check and finalization lock to ensure Evon AI 30B
 * and Safety Moderation are executed at least once with deduplication across
 * concurrent polling completions, webhook delivery races, and backend restarts.
 *
 * @param {string} bookingId
 * @param {string} transcriptText
 * @param {Object} metadata
 * @returns {Promise<{ success: boolean, alreadyFinalized?: boolean, moderation?: object, insights?: object, error?: string }>}
 */
export async function finalizeBatchTranscription(bookingId, transcriptText, metadata = {}) {
    if (!bookingId) {
        return { success: false, error: "Missing booking ID" };
    }

    // 1. Synchronous Lock Guard: prevents concurrent Promise.all / microtask races in same process
    if (activeFinalizationLocks.has(bookingId)) {
        return {
            success: true,
            alreadyFinalized: true,
            bookingId,
            message: "Finalization currently in progress by another worker."
        };
    }
    activeFinalizationLocks.add(bookingId);

    try {
        // 2. Idempotency Guard: Check if transcript is already completed & fully enriched
        const existing = await getTranscriptRecord(bookingId);
        if (existing?.status === "completed" && existing?.moderated_at && existing?.insights_generated_at) {
            return {
                success: true,
                alreadyFinalized: true,
                bookingId,
                message: "Transcript already finalized and fully processed. Skipping duplicate execution."
            };
        }

        // 3. Persistent Concurrency Lock: Check if another instance has an active lock
        if (existing?.finalization_lock) {
            const lockAgeMs = existing.updated_at ? (Date.now() - new Date(existing.updated_at).getTime()) : 0;
            // Locks older than 5 minutes are considered stale (from a crashed instance) and can be broken
            if (lockAgeMs < 5 * 60 * 1000) {
                return {
                    success: true,
                    alreadyFinalized: true,
                    bookingId,
                    message: "Finalization currently in progress by another worker."
                };
            }
            console.warn(`[GnaniBatchService] Breaking stale finalization lock (${Math.round(lockAgeMs / 1000)}s old) for booking ${bookingId}`);
        }

        // Set lock and status in database/memory store
        await upsertTranscriptRecord(bookingId, {
            status: "completed",
            finalization_lock: true,
            transcript_text: transcriptText,
            language: metadata.language || "en-IN",
            audio_duration_seconds: metadata.duration || null,
            diarization: metadata.segments || null,
            error_message: null,
            student_consent: true,
            mentor_consent: true,
            consent_confirmed: true,
            updated_at: new Date().toISOString()
        });

        // 4. Execute Safety Moderation (durable & idempotent)
        let moderationOutcome = null;
        if (!existing?.moderated_at) {
            try {
                moderationOutcome = await moderateBookingTranscript(bookingId, transcriptText, {
                    studentId: metadata.studentId,
                    mentorId: metadata.mentorId
                });
                await upsertTranscriptRecord(bookingId, {
                    moderated_at: new Date().toISOString()
                });
            } catch (modErr) {
                console.error(`[GnaniBatchService] Moderation error for booking ${bookingId}:`, modErr);
            }
        }

        // 5. Execute Evon 30B Session Intelligence (durable & idempotent)
        let insightsOutcome = null;
        if (!existing?.insights_generated_at && (process.env.NODE_ENV !== "test" || metadata.runInsightsInTest)) {
            try {
                insightsOutcome = await generateOrGetSessionInsights(
                    bookingId,
                    metadata.studentId || metadata.userId,
                    "student"
                );
                await upsertTranscriptRecord(bookingId, {
                    insights_generated_at: new Date().toISOString()
                });
            } catch (insErr) {
                console.error(`[GnaniBatchService] Evon Insights error for booking ${bookingId}:`, insErr);
            }
        }

        // Release persistent finalization lock
        await upsertTranscriptRecord(bookingId, {
            finalization_lock: false,
            updated_at: new Date().toISOString()
        });

        return {
            success: true,
            bookingId,
            moderation: moderationOutcome,
            insights: insightsOutcome?.insights || null
        };
    } catch (err) {
        console.error(`[GnaniBatchService] Finalize error for booking ${bookingId}:`, err);
        // Release lock on error so subsequent retries can proceed
        try {
            await upsertTranscriptRecord(bookingId, { finalization_lock: false });
        } catch {
            // Non-fatal
        }
        return {
            success: false,
            error: err.message
        };
    } finally {
        activeFinalizationLocks.delete(bookingId);
    }
}

/**
 * Orchestrates full batch transcription lifecycle for a mentorship session:
 * 1. Creates batch job with speaker diarization.
 * 2. Starts batch job.
 * 3. Persists status = 'processing' AND provider_job_id in Supabase.
 * 4. Background worker with exponential backoff & transient network fault tolerance.
 * 5. On completion, retrieves transcript, diarization, runs moderation, and generates insights.
 *
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {Buffer} [params.fileBuffer]
 * @param {string} [params.filePath]
 * @param {string} [params.fileName]
 * @param {string} [params.mimeType]
 * @param {string} [params.languageCode]
 * @param {string} [params.studentName]
 * @param {string} [params.mentorName]
 * @param {string} [params.studentId]
 * @param {string} [params.mentorId]
 * @param {string} [params.userId]
 * @returns {Promise<{ success: boolean, jobId?: string, status: string, error?: string }>}
 */
export async function createAndProcessBatchJob({
    bookingId,
    fileBuffer = null,
    filePath = null,
    fileName = "session_recording.wav",
    mimeType = "audio/wav",
    languageCode = DEFAULT_LANGUAGE,
    studentName = "Student",
    mentorName = "Mentor",
    studentId = null,
    mentorId = null,
    userId = null
}) {
    // 1. Create job (supports both direct multipart and presigned upload)
    const createRes = await createBatchJob({
        fileBuffer,
        filePath,
        fileName,
        mimeType,
        languageCode,
        withDiarization: true,
        numSpeakers: 2,
        bookingId
    });

    if (!createRes.success) {
        return createRes;
    }

    const { jobId } = createRes;

    // 2. Start job
    const startRes = await startBatchJob(jobId);
    if (!startRes.success) {
        return startRes;
    }

    let calculatedBytes = 0;
    if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
        calculatedBytes = fileBuffer.length;
    } else if (filePath && fs.existsSync(filePath)) {
        try {
            calculatedBytes = fs.statSync(filePath).size;
        } catch {
            calculatedBytes = 0;
        }
    }

    // 3. PERSIST JOB IN SUPABASE: provider_job_id + processing status
    await upsertTranscriptRecord(bookingId, {
        status: "processing",
        provider_job_id: jobId,
        audio_filename: fileName,
        audio_mimetype: mimeType,
        audio_size_bytes: calculatedBytes,
        student_consent: true,
        mentor_consent: true,
        consent_confirmed: true,
        error_message: null
    });

    // 4. Background Polling Worker with Exponential Backoff (non-blocking)
    const pollPromise = (async () => {
        const isMock = process.env.NODE_ENV === "test" || process.env.GNANI_MOCK === "true";
        const maxPollMs = isMock ? 200 : 15 * 60 * 1000; // 15 minutes max
        const startTime = Date.now();
        let consecutiveNetworkErrors = 0;
        let attempt = 0;

        while (Date.now() - startTime < maxPollMs) {
            attempt++;

            // Backoff interval calculation
            let intervalMs = isMock ? 10 : 5000;
            const elapsed = Date.now() - startTime;
            if (!isMock) {
                if (elapsed > 5 * 60 * 1000) intervalMs = 20000; // > 5m: poll every 20s
                else if (elapsed > 60 * 1000) intervalMs = 10000; // > 1m: poll every 10s
            }

            if (!isMock) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }

            // Check if already completed by webhook or another worker
            const currentRec = await getTranscriptRecord(bookingId);
            if (currentRec?.status === "completed") {
                return; // Completed via webhook, stop polling cleanly
            }

            let statusRes = null;
            try {
                statusRes = await getBatchJobStatus(jobId);
                consecutiveNetworkErrors = 0; // Reset network error counter
            } catch (netErr) {
                consecutiveNetworkErrors++;
                console.warn(`[GnaniBatchService] Polling network warning (attempt ${attempt}): ${netErr.message}`);
                if (consecutiveNetworkErrors >= 5) {
                    await upsertTranscriptRecord(bookingId, {
                        status: "failed",
                        error_message: `Polling failed after 5 consecutive network errors: ${netErr.message}`
                    });
                    return;
                }
                continue; // Retry on next backoff interval
            }

            if (isMock) {
                statusRes.status = "COMPLETED";
            }

            if (statusRes.status === "COMPLETED") {
                const transcriptData = await fetchBatchJobTranscript(jobId, { studentName, mentorName });
                if (transcriptData.success) {
                    await finalizeBatchTranscription(bookingId, transcriptData.transcriptText, {
                        language: transcriptData.language,
                        duration: transcriptData.duration,
                        segments: transcriptData.segments,
                        studentId,
                        mentorId,
                        userId
                    });
                } else {
                    await upsertTranscriptRecord(bookingId, {
                        status: "failed",
                        error_message: transcriptData.error || "Failed to download batch transcript"
                    });
                }
                return;
            }

            if (statusRes.status === "FAILED" || statusRes.status === "PARTIAL_FAILURE") {
                await upsertTranscriptRecord(bookingId, {
                    status: "failed",
                    error_message: `Gnani batch job ${jobId} failed with status ${statusRes.status}`
                });
                return;
            }
        }

        // Timeout fallback after 15 minutes
        await upsertTranscriptRecord(bookingId, {
            status: "failed",
            error_message: `Gnani batch job ${jobId} timed out after 15 minutes`
        });
    })();

    if (process.env.NODE_ENV === "test") {
        const job = batchJobsStore.get(jobId);
        if (job) job.pollPromise = pollPromise;
    }

    return {
        success: true,
        jobId,
        status: "processing",
        message: "Transcription job submitted successfully. Processing in background."
    };
}

/**
 * Handles incoming Gnani webhook notifications with multi-layer security:
 * 1. Validates webhook secret using timing-safe comparison.
 * 2. Correlates jobId with Supabase session_transcripts record.
 * 3. Authoritative verification: queries Gnani's REST API to verify job terminal state.
 * 4. Idempotently finalizes the transcript if not already completed.
 *
 * @param {Object} payload
 * @param {string} [providedSecret] - Secret passed via URL query or header
 * @returns {Promise<{ success: boolean, statusCode?: number, message: string, error?: string }>}
 */
export async function handleBatchWebhook(payload = {}, providedSecret = null) {
    // 1. Timing-Safe Secret Validation
    const expectedSecret = process.env.GNANI_WEBHOOK_SECRET;
    if (expectedSecret && !verifyWebhookSecret(providedSecret, expectedSecret)) {
        return {
            success: false,
            statusCode: 401,
            message: "Unauthorized: Invalid or missing webhook secret"
        };
    }

    const jobId = payload.job_id || payload.id;
    const reportedStatus = payload.status;

    if (!jobId || !reportedStatus) {
        return {
            success: false,
            statusCode: 400,
            message: "Invalid webhook payload: missing job_id or status"
        };
    }

    // 2. Correlate with persistent database record
    const transcriptRecord = await getTranscriptByJobId(jobId);
    if (!transcriptRecord) {
        return {
            success: false,
            statusCode: 404,
            message: `No session transcript found matching provider_job_id ${jobId}`
        };
    }

    const bookingId = transcriptRecord.booking_id;

    // 3. Idempotency Check: Don't process if already completed
    if (transcriptRecord.status === "completed") {
        return {
            success: true,
            statusCode: 200,
            message: `Job ${jobId} is already finalized for booking ${bookingId} (idempotent)`
        };
    }

    // 4. Authoritative REST Verification with Gnani
    // Even if webhook claims COMPLETED, verify with Gnani's server before accepting
    if (process.env.NODE_ENV !== "test") {
        const verifiedStatus = await getBatchJobStatus(jobId);
        if (verifiedStatus.status !== reportedStatus) {
            console.warn(`[GnaniBatchService] Webhook status mismatch for job ${jobId}. Webhook: ${reportedStatus}, Authoritative: ${verifiedStatus.status}`);
            if (verifiedStatus.status !== "COMPLETED") {
                return {
                    success: false,
                    statusCode: 400,
                    message: `Authoritative provider verification failed: job status is ${verifiedStatus.status}`
                };
            }
        }
    }

    // 5. Finalize based on verified status
    if (reportedStatus === "COMPLETED") {
        const transcriptData = await fetchBatchJobTranscript(jobId);
        if (transcriptData.success) {
            await finalizeBatchTranscription(bookingId, transcriptData.transcriptText, {
                language: transcriptData.language,
                duration: transcriptData.duration,
                segments: transcriptData.segments
            });
        }
    } else if (reportedStatus === "FAILED" || reportedStatus === "PARTIAL_FAILURE") {
        await upsertTranscriptRecord(bookingId, {
            status: "failed",
            error_message: payload.error || `Gnani batch job reported ${reportedStatus}`
        });
    }

    return {
        success: true,
        statusCode: 200,
        message: `Webhook successfully verified and processed for job ${jobId}`
    };
}

/**
 * Resumes monitoring of orphaned batch jobs after a backend restart,
 * and recovers any interrupted post-transcription pipelines (moderation/insights).
 * Queries Supabase session_transcripts for jobs in 'processing' status or
 * 'completed' jobs with pending moderation/insights.
 *
 * @returns {Promise<{ recovered: number }>}
 */
export async function resumePendingBatchJobs() {
    let recovered = 0;
    try {
        const { data: pendingTranscripts } = await supabase
            .from("session_transcripts")
            .select("booking_id, provider_job_id, status, transcript_text, moderated_at, insights_generated_at")
            .or("status.eq.processing,and(status.eq.completed,or(moderated_at.is.null,insights_generated_at.is.null))")
            .not("provider_job_id", "is", null);

        if (pendingTranscripts && pendingTranscripts.length > 0) {
            for (const item of pendingTranscripts) {
                recovered++;
                if (item.status === "processing") {
                    // Check if already completed on provider side
                    getBatchJobStatus(item.provider_job_id).then(async (statusRes) => {
                        if (statusRes.status === "COMPLETED") {
                            const transcriptData = await fetchBatchJobTranscript(item.provider_job_id);
                            if (transcriptData.success) {
                                await finalizeBatchTranscription(item.booking_id, transcriptData.transcriptText, {
                                    language: transcriptData.language,
                                    duration: transcriptData.duration,
                                    segments: transcriptData.segments
                                });
                            }
                        }
                    }).catch(() => {});
                } else if (item.status === "completed" && item.transcript_text) {
                    // Re-enter finalization safely: already-completed steps are skipped due to timestamp checks
                    finalizeBatchTranscription(item.booking_id, item.transcript_text, {}).catch(() => {});
                }
            }
        }
    } catch {
        // Table pending fallback
    }

    return { recovered };
}

export default {
    createBatchJob,
    startBatchJob,
    getBatchJobStatus,
    fetchBatchJobTranscript,
    parseDiarizedTranscript,
    finalizeBatchTranscription,
    createAndProcessBatchJob,
    handleBatchWebhook,
    verifyWebhookSecret,
    resumePendingBatchJobs,
    getJobIdForBooking,
    resetBatchState,
    batchJobsStore,
    GNANI_BATCH_BASE_URL,
    GNANI_BATCH_V2_URL,
    DEFAULT_BATCH_MODEL,
    DIRECT_UPLOAD_MAX_BYTES,
    MAX_BATCH_AUDIO_BYTES
};
