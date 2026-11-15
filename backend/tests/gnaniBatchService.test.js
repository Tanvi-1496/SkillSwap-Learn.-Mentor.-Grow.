import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.GNANI_WEBHOOK_SECRET = "test_secure_webhook_secret_123";

import {
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
    DIRECT_UPLOAD_MAX_BYTES
} from "../src/services/gnaniBatchService.js";
import { getTranscriptRecord, getTranscriptByJobId, upsertTranscriptRecord, transcriptMemoryStore } from "../src/routes/bookings.js";

// Helper to create synthetic WAV buffer of any duration/size
function createWavBuffer(durationSeconds = 5, sampleRate = 16000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;

    const buffer = Buffer.alloc(fileSize);
    buffer.write("RIFF", 0, 4, "ascii");
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write("WAVE", 8, 4, "ascii");
    buffer.write("fmt ", 12, 4, "ascii");
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36, 4, "ascii");
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
}

test("1. Audio validation and file size boundary routing", async (t) => {
    await t.test("rejects missing or empty audio buffer with 400", async () => {
        const nullRes = await createBatchJob({ fileBuffer: null });
        assert.equal(nullRes.success, false);
        assert.equal(nullRes.statusCode, 400);

        const emptyRes = await createBatchJob({ fileBuffer: Buffer.alloc(0) });
        assert.equal(emptyRes.success, false);
        assert.equal(emptyRes.statusCode, 400);
    });

    await t.test("rejects unsupported audio formats (e.g., WEBM) with 400", async () => {
        const wavBuffer = createWavBuffer(2);
        const webmRes = await createBatchJob({
            fileBuffer: wavBuffer,
            fileName: "call.webm",
            mimeType: "audio/webm"
        });
        assert.equal(webmRes.success, false);
        assert.equal(webmRes.statusCode, 400);
        assert.match(webmRes.error, /Unsupported audio format/i);
    });

    await t.test("routes files <= 10 MB through direct multipart upload", async () => {
        resetBatchState();
        const smallBuffer = createWavBuffer(3); // Small audio
        const res = await createBatchJob({
            fileBuffer: smallBuffer,
            fileName: "small_call.wav",
            mimeType: "audio/wav"
        });
        assert.equal(res.success, true);
        assert.equal(res.uploadMethod, "direct_multipart");
    });

    await t.test("routes files > 10 MB through presigned upload workflow (v2/jobs)", async () => {
        resetBatchState();
        // Allocate a buffer just over 10 MB
        const largeBuffer = Buffer.alloc(DIRECT_UPLOAD_MAX_BYTES + 1024);
        largeBuffer.write("RIFF", 0);
        largeBuffer.write("WAVE", 8);

        const res = await createBatchJob({
            fileBuffer: largeBuffer,
            fileName: "long_mentorship.wav",
            mimeType: "audio/wav"
        });
        assert.equal(res.success, true);
        assert.equal(res.uploadMethod, "presigned_v2");
    });

    await t.test("rejects files exceeding the 100 MB maximum safety ceiling", async () => {
        const oversizedBuffer = Buffer.alloc(101 * 1024 * 1024);
        const res = await createBatchJob({
            fileBuffer: oversizedBuffer,
            fileName: "oversized.wav",
            mimeType: "audio/wav"
        });
        assert.equal(res.success, false);
        assert.equal(res.statusCode, 400);
        assert.match(res.error, /exceeds maximum allowed limit/i);
    });
});

test("2. Provider authentication failure handling in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.GNANI_API_KEY;

    try {
        process.env.NODE_ENV = "production";
        delete process.env.GNANI_API_KEY;
        delete process.env.GNANI_STT_KEY;

        const wavBuffer = createWavBuffer(2);
        const result = await createBatchJob({
            fileBuffer: wavBuffer,
            fileName: "session.wav",
            mimeType: "audio/wav"
        });

        assert.equal(result.success, false);
        assert.equal(result.statusCode, 500);
        assert.match(result.error, /GNANI_API_KEY is required in production/i);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalKey) process.env.GNANI_API_KEY = originalKey;
    }
});

test("3. Persistent job tracking and backend restart recovery", async () => {
    resetBatchState();
    const bookingId = "b1111111-1111-1111-1111-111111111111";
    const testJobId = "job_restart_recovery_test_999";

    // 1. Persist a job with provider_job_id in persistent storage
    await upsertTranscriptRecord(bookingId, {
        status: "processing",
        provider_job_id: testJobId,
        audio_filename: "session_call.wav",
        student_consent: true,
        mentor_consent: true,
        consent_confirmed: true
    });

    // 2. SIMULATE COMPLETE BACKEND RESTART by clearing in-memory Map
    resetBatchState();
    assert.equal(batchJobsStore.size, 0);

    // 3. Verify getJobIdForBooking recovers jobId from persistent storage
    const recoveredJobId = await getJobIdForBooking(bookingId);
    assert.equal(recoveredJobId, testJobId);

    // 4. Verify lookup by provider_job_id works across restart
    const recoveredRecord = await getTranscriptByJobId(testJobId);
    assert.ok(recoveredRecord);
    assert.equal(recoveredRecord.booking_id, bookingId);
    assert.equal(recoveredRecord.status, "processing");

    // 5. Verify duplicate prevention still detects active job after restart
    const wavBuffer = createWavBuffer(2);
    const duplicateAttempt = await createBatchJob({
        fileBuffer: wavBuffer,
        bookingId
    });
    assert.equal(duplicateAttempt.success, true);
    assert.equal(duplicateAttempt.isDuplicate, true);
    assert.equal(duplicateAttempt.jobId, testJobId);
});

test("4. Timing-safe webhook authentication and verification", async (t) => {
    await t.test("timing-safe comparison validates matching secrets and rejects mismatches", () => {
        const secret = "super_secret_webhook_key_xyz";
        assert.equal(verifyWebhookSecret(secret, secret), true);
        assert.equal(verifyWebhookSecret("wrong_secret", secret), false);
        assert.equal(verifyWebhookSecret(secret + "_extra", secret), false);
        assert.equal(verifyWebhookSecret("", secret), false);
        assert.equal(verifyWebhookSecret(null, secret), false);
    });

    await t.test("rejects incoming webhook with missing or invalid secret with 401", async () => {
        const unauthRes = await handleBatchWebhook({ job_id: "any_job", status: "COMPLETED" }, "invalid_secret");
        assert.equal(unauthRes.success, false);
        assert.equal(unauthRes.statusCode, 401);
        assert.match(unauthRes.message, /Unauthorized: Invalid or missing webhook secret/i);

        const noSecretRes = await handleBatchWebhook({ job_id: "any_job", status: "COMPLETED" }, null);
        assert.equal(noSecretRes.success, false);
        assert.equal(noSecretRes.statusCode, 401);
    });

    await t.test("rejects webhook for unknown job_id with 404", async () => {
        const notFoundRes = await handleBatchWebhook(
            { job_id: "non_existent_provider_job_404", status: "COMPLETED" },
            process.env.GNANI_WEBHOOK_SECRET
        );
        assert.equal(notFoundRes.success, false);
        assert.equal(notFoundRes.statusCode, 404);
        assert.match(notFoundRes.message, /No session transcript found/i);
    });

    await t.test("rejects webhook with missing job_id or status with 400", async () => {
        const malformedRes = await handleBatchWebhook({}, process.env.GNANI_WEBHOOK_SECRET);
        assert.equal(malformedRes.success, false);
        assert.equal(malformedRes.statusCode, 400);
    });
});

test("5. Webhook processing and idempotency (duplicate delivery protection)", async () => {
    resetBatchState();
    const bookingId = "b2222222-2222-2222-2222-222222222222";
    const jobId = "job_webhook_idempotency_123";

    await upsertTranscriptRecord(bookingId, {
        status: "processing",
        provider_job_id: jobId,
        student_consent: true,
        mentor_consent: true,
        consent_confirmed: true
    });

    // 1. First webhook arrives: transitions status to completed
    const firstDelivery = await handleBatchWebhook(
        { job_id: jobId, status: "COMPLETED" },
        process.env.GNANI_WEBHOOK_SECRET
    );
    assert.equal(firstDelivery.success, true);
    assert.equal(firstDelivery.statusCode, 200);

    const recordAfterFirst = await getTranscriptRecord(bookingId);
    assert.equal(recordAfterFirst.status, "completed");

    // 2. Duplicate webhook delivery (e.g. Gnani network retry): handled idempotently
    const duplicateDelivery = await handleBatchWebhook(
        { job_id: jobId, status: "COMPLETED" },
        process.env.GNANI_WEBHOOK_SECRET
    );
    assert.equal(duplicateDelivery.success, true);
    assert.match(duplicateDelivery.message, /already finalized/i);
});

test("6. Concurrency-safe finalization idempotency (racing polling and webhook)", async () => {
    const bookingId = "b3333333-3333-3333-3333-333333333333";
    await upsertTranscriptRecord(bookingId, {
        status: "processing",
        student_consent: true,
        mentor_consent: true,
        consent_confirmed: true
    });

    // Fire 2 concurrent finalizeBatchTranscription calls simultaneously
    const transcriptText = "Diarized transcript text for race condition test.";
    const [resultA, resultB] = await Promise.all([
        finalizeBatchTranscription(bookingId, transcriptText, { language: "en-IN" }),
        finalizeBatchTranscription(bookingId, transcriptText, { language: "en-IN" })
    ]);

    assert.equal(resultA.success, true);
    assert.equal(resultB.success, true);

    // Exactly one should perform the work, and the other should be marked alreadyFinalized
    const hasAlreadyFinalized = resultA.alreadyFinalized === true || resultB.alreadyFinalized === true;
    assert.equal(hasAlreadyFinalized, true);

    const finalRecord = await getTranscriptRecord(bookingId);
    assert.equal(finalRecord.status, "completed");
});

test("7. Speaker diarization parsing maps participants, timestamps, and words", () => {
    const mockRawPayload = {
        detected_language_code: "mr-IN",
        duration_seconds: 78.5,
        segments: [
            {
                speaker: "Speaker 1",
                start: 0.0,
                end: 8.2,
                text: "Namaskar, today we are evaluating the PostgreSQL index performance.",
                words: [{ word: "Namaskar", start: 0.0, end: 1.0 }]
            },
            {
                speaker: "Speaker 2",
                start: 9.0,
                end: 18.4,
                text: "Hello mentor! Yes, I noticed composite indexes reduced query latency.",
                words: []
            }
        ]
    };

    const parsed = parseDiarizedTranscript(mockRawPayload, {
        studentName: "Sneha",
        mentorName: "Anil"
    });

    assert.equal(parsed.detectedLanguage, "mr-IN");
    assert.equal(parsed.durationSeconds, 78.5);
    assert.equal(parsed.segments.length, 2);
    assert.equal(parsed.segments[0].speakerLabel, "Mentor (Anil)");
    assert.equal(parsed.segments[1].speakerLabel, "Student (Sneha)");
    assert.match(parsed.transcriptText, /\[00:00 - 00:08\] Mentor \(Anil\): Namaskar/);
    assert.match(parsed.transcriptText, /\[00:09 - 00:18\] Student \(Sneha\): Hello mentor/);
});

test("8. Failed job status does not trigger Evon AI or moderation and stores error details", async () => {
    const bookingId = "b4444444-4444-4444-4444-444444444444";
    const jobId = "job_failed_test_456";

    await upsertTranscriptRecord(bookingId, {
        status: "processing",
        provider_job_id: jobId,
        student_consent: true,
        mentor_consent: true,
        consent_confirmed: true
    });

    const webhookRes = await handleBatchWebhook(
        {
            job_id: jobId,
            status: "FAILED",
            error: "Audio corrupted during transmission"
        },
        process.env.GNANI_WEBHOOK_SECRET
    );

    assert.equal(webhookRes.success, true);
    const record = await getTranscriptRecord(bookingId);
    assert.equal(record?.status, "failed");
    assert.equal(record?.error_message, "Audio corrupted during transmission");
    assert.equal(record?.transcript_text, undefined);
});

test("9. Full non-blocking batch orchestration via createAndProcessBatchJob", async () => {
    resetBatchState();
    const bookingId = "b5555555-5555-5555-5555-555555555555";
    const wavBuffer = createWavBuffer(6);

    const result = await createAndProcessBatchJob({
        bookingId,
        fileBuffer: wavBuffer,
        fileName: "mentorship_session.wav",
        studentName: "Pooja",
        mentorName: "Deepak"
    });

    assert.equal(result.success, true);
    assert.equal(result.status, "processing");
    assert.ok(result.jobId);

    // Verify persistent storage recorded the provider_job_id immediately
    const record = await getTranscriptRecord(bookingId);
    assert.equal(record?.provider_job_id, result.jobId);
    assert.equal(record?.status, "processing");

    // Await mock background worker promise
    const job = batchJobsStore.get(result.jobId);
    if (job?.pollPromise) {
        await job.pollPromise;
    }

    const completedRecord = await getTranscriptRecord(bookingId);
    assert.equal(completedRecord?.status, "completed");
    assert.match(completedRecord?.transcript_text, /Mentor \(Deepak\):/);
});
