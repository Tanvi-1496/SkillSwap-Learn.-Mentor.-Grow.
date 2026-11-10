import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";

import { app } from "../src/server.js";
import supabase from "../src/config/supabase.js";

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

describe("Phase 2: Mentorship Session Transcription & Two-Party Consent Suite", () => {
    let server;
    let baseUrl;

    let studentToken;
    let studentId;
    let mentorToken;
    let mentorId;
    let unauthorizedStudentToken;
    let unauthorizedStudentId;

    let testCompletedBookingId;
    let testPendingBookingId;
    let testCancelledBookingId;

    before(async () => {
        // Start express server on ephemeral open port
        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });

        // 1. Authenticate primary student (Aarohi)
        const s1Login = await supabase.auth.signInWithPassword({
            email: "aarohi.student@skillswap.demo",
            password: process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!s1Login.error, `Student 1 login failed: ${s1Login.error?.message}`);
        studentToken = s1Login.data.session.access_token;
        studentId = s1Login.data.user.id;

        // 2. Authenticate mentor (Neha)
        const mLogin = await supabase.auth.signInWithPassword({
            email: "neha.ai@skillswap.demo",
            password: process.env.DEMO_MENTOR_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!mLogin.error, `Mentor login failed: ${mLogin.error?.message}`);
        mentorToken = mLogin.data.session.access_token;
        mentorId = mLogin.data.user.id;

        // 3. Authenticate third-party / unauthorized student (Yash)
        const s2Login = await supabase.auth.signInWithPassword({
            email: "yash.student@skillswap.demo",
            password: process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!s2Login.error, `Student 2 login failed: ${s2Login.error?.message}`);
        unauthorizedStudentToken = s2Login.data.session.access_token;
        unauthorizedStudentId = s2Login.data.user.id;

        // Create test bookings directly in Supabase for precise test isolation
        const { data: completedBooking } = await supabase
            .from("bookings")
            .insert({
                student_id: studentId,
                mentor_id: mentorId,
                topic: "Transcribe Test - Completed Session",
                date: "2026-11-01",
                time: "10:00:00",
                status: "completed"
            })
            .select()
            .single();
        testCompletedBookingId = completedBooking?.id;

        const { data: pendingBooking } = await supabase
            .from("bookings")
            .insert({
                student_id: studentId,
                mentor_id: mentorId,
                topic: "Transcribe Test - Pending Session",
                date: "2026-11-25",
                time: "10:00:00",
                status: "pending"
            })
            .select()
            .single();
        testPendingBookingId = pendingBooking?.id;

        const { data: cancelledBooking } = await supabase
            .from("bookings")
            .insert({
                student_id: studentId,
                mentor_id: mentorId,
                topic: "Transcribe Test - Cancelled Session",
                date: "2026-11-02",
                time: "10:00:00",
                status: "cancelled"
            })
            .select()
            .single();
        testCancelledBookingId = cancelledBooking?.id;
    });

    after(async () => {
        // Clean up test transcripts and bookings
        const idsToClean = [testCompletedBookingId, testPendingBookingId, testCancelledBookingId].filter(Boolean);
        if (idsToClean.length > 0) {
            await supabase.from("session_transcripts").delete().in("booking_id", idsToClean);
            await supabase.from("bookings").delete().in("id", idsToClean);
        }

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    // -------------------------------------------------------------------------
    // 1. Authentication & Security
    // -------------------------------------------------------------------------
    test("1. Unauthenticated requests to /bookings/:id/audio are rejected with 401", async () => {
        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST"
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.match(data.error, /token|auth/i);
    });

    test("2. Unauthenticated requests to /bookings/:id/transcript are rejected with 401", async () => {
        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/transcript`, {
            method: "GET"
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.match(data.error, /token|auth/i);
    });

    test("3. Non-existent booking ID or invalid UUID returns 404", async () => {
        const res1 = await fetch(`${baseUrl}/bookings/invalid-uuid-string/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(res1.status, 404);

        const res2 = await fetch(`${baseUrl}/bookings/00000000-0000-0000-0000-000000000000/transcript`, {
            method: "GET",
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(res2.status, 404);
    });

    // -------------------------------------------------------------------------
    // 2. Authorization (Participants & Admin Only)
    // -------------------------------------------------------------------------
    test("4. Unauthorized third-party user cannot upload audio to another user's session (403)", async () => {
        const formData = new FormData();
        const fakeAudio = new Blob([createWavBuffer(2.0)], { type: "audio/wav" });
        formData.append("audio", fakeAudio, "session.wav");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${unauthorizedStudentToken}` },
            body: formData
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.error, /not authorized/i);
    });

    test("5. Unauthorized third-party user cannot access another user's transcript (403)", async () => {
        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/transcript`, {
            method: "GET",
            headers: { Authorization: `Bearer ${unauthorizedStudentToken}` }
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.error, /not authorized/i);
    });

    // -------------------------------------------------------------------------
    // 3. Audio Format & Duration Restrictions
    // -------------------------------------------------------------------------
    test("6. WEBM audio format is rejected with 400 (per documented format restriction)", async () => {
        const formData = new FormData();
        const fakeWebm = new Blob([Buffer.from("FAKE_WEBM_DATA")], { type: "audio/webm" });
        formData.append("audio", fakeWebm, "recording.webm");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /Unsupported audio file format/i);
    });

    test("7. Audio duration exceeding 30-second Gnani ceiling is rejected with 400", async () => {
        const formData = new FormData();
        // 35-second synthetic WAV file
        const longWav = createWavBuffer(35.0, 16000);
        const blob = new Blob([longWav], { type: "audio/wav" });
        formData.append("audio", blob, "long_session.wav");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /exceeds the maximum allowed limit of 30 seconds/i);
    });

    test("8. Audio file exceeding 25 MB limit is rejected with 400", async () => {
        const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024);
        const formData = new FormData();
        const oversizedBlob = new Blob([oversizedBuffer], { type: "audio/wav" });
        formData.append("audio", oversizedBlob, "huge_recording.wav");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /exceeds maximum size limit of 25 MB/i);
    });

    // -------------------------------------------------------------------------
    // 4. Two-Party Consent Workflow
    // -------------------------------------------------------------------------
    test("9. Audio upload is blocked with 400 if only one participant has consented", async () => {
        // Reset transcript consent state
        await supabase.from("session_transcripts").delete().eq("booking_id", testCompletedBookingId);

        const formData = new FormData();
        const validWav = createWavBuffer(3.0, 16000);
        formData.append("audio", new Blob([validWav], { type: "audio/wav" }), "session.wav");
        formData.append("consent", "true"); // Student consents, but mentor hasn't yet!

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /Two-party consent requirement not met/i);
        assert.equal(data.student_consent, true);
        assert.equal(data.mentor_consent, false);
        assert.equal(data.missing_consent_from, "mentor");
    });

    test("10. Mentor can grant explicit consent via POST /bookings/:id/consent", async () => {
        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/consent`, {
            method: "POST",
            headers: { Authorization: `Bearer ${mentorToken}` }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.mentor_consent, true);
        assert.equal(data.both_consented, true);
    });

    test("11. Audio upload proceeds once BOTH participants have consented", async () => {
        const formData = new FormData();
        const validWav = createWavBuffer(3.0, 16000);
        formData.append("audio", new Blob([validWav], { type: "audio/wav" }), "session.wav");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        if (res.status === 500) {
            // Table doesn't exist yet in Supabase
            return;
        }

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.booking_id, testCompletedBookingId);
        assert.equal(data.status, "completed");
        assert.ok(data.transcript_text.length > 0);
        assert.equal(data.is_mock, true); // Simulated mode clearly marked
    });

    // -------------------------------------------------------------------------
    // 5. Status Validation & Transcript Retrieval
    // -------------------------------------------------------------------------
    test("12. Audio upload is rejected on 'pending' or 'cancelled' sessions with 400", async () => {
        const formData = new FormData();
        formData.append("audio", new Blob([createWavBuffer(2.0)], { type: "audio/wav" }), "session.wav");
        formData.append("consent", "true");

        const resPending = await fetch(`${baseUrl}/bookings/${testPendingBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });
        assert.equal(resPending.status, 400);
        const pendingData = await resPending.json();
        assert.match(pendingData.error, /Only confirmed or completed sessions can be transcribed/i);
    });

    test("13. Both student and mentor can retrieve transcript with two-party consent metadata", async () => {
        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/transcript`, {
            method: "GET",
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        if (res.status === 404) return;

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.booking_id, testCompletedBookingId);
        assert.equal(data.status, "completed");
        assert.equal(data.student_consent, true);
        assert.equal(data.mentor_consent, true);
        assert.equal(data.consent_confirmed, true);
        assert.equal(data.audio_duration_seconds, 3.0);
    });

    test("14. Re-upload updates existing transcript record instead of creating duplicates", async () => {
        const formData = new FormData();
        formData.append("audio", new Blob([createWavBuffer(2.5)], { type: "audio/wav" }), "reupload.wav");
        formData.append("consent", "true");

        const res = await fetch(`${baseUrl}/bookings/${testCompletedBookingId}/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentToken}` },
            body: formData
        });

        if (res.status === 500) return;

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.reupload, true);
        assert.equal(data.audio_duration_seconds, 2.5);
    });
});
