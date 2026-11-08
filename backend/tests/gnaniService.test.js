import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

import {
    transcribeAudio,
    isSupportedAudioFormat,
    estimateAudioDuration,
    MAX_AUDIO_DURATION_SECONDS
} from "../src/services/gnaniService.js";

// Helper to create synthetic WAV buffer
function createWavBuffer(durationSeconds = 3, sampleRate = 16000) {
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

test("GnaniService: Audio format validation rejects WEBM and accepts documented formats", () => {
    // Valid audio formats
    assert.equal(isSupportedAudioFormat("session.wav", "audio/wav"), true);
    assert.equal(isSupportedAudioFormat("session.mp3", "audio/mpeg"), true);
    assert.equal(isSupportedAudioFormat("session.m4a", "audio/mp4"), true);
    assert.equal(isSupportedAudioFormat("session.flac", "audio/flac"), true);
    assert.equal(isSupportedAudioFormat("recording.ogg", "audio/ogg"), true);
    assert.equal(isSupportedAudioFormat("session.aac", "audio/aac"), true);

    // WEBM is strictly excluded per documentation correction
    assert.equal(isSupportedAudioFormat("session.webm", "audio/webm"), false);

    // Invalid non-audio formats
    assert.equal(isSupportedAudioFormat("report.pdf", "application/pdf"), false);
    assert.equal(isSupportedAudioFormat("photo.jpg", "image/jpeg"), false);
});

test("GnaniService: Audio duration detection calculates correct length from WAV header", () => {
    const testWav = createWavBuffer(5.0, 16000);
    const estimated = estimateAudioDuration(testWav, "audio/wav", "test.wav");
    assert.equal(estimated, 5.0);
});

test("GnaniService: Rejects audio exceeding 30-second duration limit", async () => {
    const longWav = createWavBuffer(35.0, 16000); // 35 seconds
    const result = await transcribeAudio({
        fileBuffer: longWav,
        fileName: "long_session.wav",
        mimeType: "audio/wav"
    });

    assert.equal(result.success, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.error, /exceeds the maximum allowed limit of 30 seconds/i);
});

test("GnaniService: Mock mode safety ensures production fails if GNANI_API_KEY is missing", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.GNANI_API_KEY;

    try {
        process.env.NODE_ENV = "production";
        delete process.env.GNANI_API_KEY;

        const testAudio = createWavBuffer(2.0, 16000);
        const result = await transcribeAudio({
            fileBuffer: testAudio,
            fileName: "prod_test.wav",
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

test("GnaniService: Validation on empty buffer", async () => {
    const result = await transcribeAudio({
        fileBuffer: null,
        fileName: "empty.wav",
        mimeType: "audio/wav"
    });

    assert.equal(result.success, false);
    assert.match(result.error, /buffer is empty or missing/i);
});

test("GnaniService: Test mode returns simulated transcript with mock indicator", async () => {
    const fakeAudio = createWavBuffer(3.0, 16000);
    const result = await transcribeAudio({
        fileBuffer: fakeAudio,
        fileName: "session_mock.wav",
        mimeType: "audio/wav",
        languageCode: "en-IN"
    });

    assert.equal(result.success, true);
    assert.ok(result.transcript.length > 0);
    assert.equal(result.language, "en-IN");
    assert.equal(result.isMock, true);
});
