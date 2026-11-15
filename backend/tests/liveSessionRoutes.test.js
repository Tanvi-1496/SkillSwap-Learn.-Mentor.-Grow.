import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "live-session-tests-only";
const { default: supabase } = await import("../src/config/supabase.js");
const { default: sessionsRouter } = await import("../src/routes/sessions.js");

const studentId = "11111111-1111-4111-8111-111111111111";
const mentorId = "22222222-2222-4222-8222-222222222222";
const outsiderId = "33333333-3333-4333-8333-333333333333";
const adminId = "99999999-9999-4999-8999-999999999999";
const bookingId = "44444444-4444-4444-8444-444444444444";
const expiredBookingId = "55555555-5555-4555-8555-555555555555";
const cancelledBookingId = "66666666-6666-4666-8666-666666666666";
const declinedBookingId = "77777777-7777-4777-8777-777777777777";
const studentToken = "student-test-token";
const mentorToken = "mentor-test-token";
const outsiderToken = "outsider-test-token";
const adminToken = "admin-test-token";
const testServerSecret = "0123456789abcdef0123456789abcdef";

const originalFrom = supabase.from;
const originalGetUser = supabase.auth.getUser;
const originalAppId = process.env.ZEGOCLOUD_APP_ID;
const originalServerSecret = process.env.ZEGOCLOUD_SERVER_SECRET;
const records = {
    bookings: [],
    users: [],
    live_sessions: []
};
const usersByToken = new Map([
    [studentToken, { id: studentId }],
    [mentorToken, { id: mentorId }],
    [outsiderToken, { id: outsiderId }],
    [adminToken, { id: adminId }]
]);

function getSoonBookingTime() {
    const target = new Date(Date.now() + 10 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(target);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}:00`
    };
}

class MockQuery {
    constructor(table) {
        this.table = table;
        this.action = "select";
        this.filters = [];
        this.returning = false;
        this.values = null;
        this.conflictField = "id";
        this.ignoreDuplicates = false;
    }

    select() {
        this.returning = true;
        return this;
    }

    eq(field, value) {
        this.filters.push((row) => row[field] === value);
        return this;
    }

    is(field, value) {
        this.filters.push((row) => row[field] === value);
        return this;
    }

    upsert(values, options = {}) {
        this.action = "upsert";
        this.values = values;
        this.conflictField = options.onConflict || "id";
        this.ignoreDuplicates = Boolean(options.ignoreDuplicates);
        return this;
    }

    update(values) {
        this.action = "update";
        this.values = values;
        return this;
    }

    maybeSingle() {
        return this.execute(true);
    }

    async execute(single = false) {
        const tableRows = records[this.table];
        if (!tableRows) return { data: null, error: new Error(`Unknown table ${this.table}`) };

        if (this.action === "upsert") {
            const existing = tableRows.find((row) => row[this.conflictField] === this.values[this.conflictField]);
            if (!existing) {
                tableRows.push({
                    status: "active",
                    student_joined_at: null,
                    mentor_joined_at: null,
                    student_left_at: null,
                    mentor_left_at: null,
                    started_at: null,
                    ended_at: null,
                    ...this.values
                });
            }
            else if (!this.ignoreDuplicates) Object.assign(existing, this.values);
            return { data: null, error: null };
        }

        const matchingRows = tableRows.filter((row) => this.filters.every((filter) => filter(row)));
        if (this.action === "update") {
            for (const row of matchingRows) Object.assign(row, this.values);
        }

        const resultRows = this.action === "update" && !this.returning
            ? null
            : matchingRows;
        const data = single
            ? resultRows?.[0] || null
            : resultRows;

        return { data, error: null };
    }

    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

let server;
let baseUrl;

before(async () => {
    const scheduled = getSoonBookingTime();
    records.bookings = [
        {
            id: bookingId,
            student_id: studentId,
            mentor_id: mentorId,
            topic: "Live session test",
            ...scheduled,
            status: "confirmed"
        },
        {
            id: expiredBookingId,
            student_id: studentId,
            mentor_id: mentorId,
            topic: "Expired live session test",
            date: "2020-01-01",
            time: "10:00:00",
            status: "confirmed"
        },
        {
            id: cancelledBookingId,
            student_id: studentId,
            mentor_id: mentorId,
            topic: "Cancelled live session test",
            ...scheduled,
            status: "cancelled"
        },
        {
            id: declinedBookingId,
            student_id: studentId,
            mentor_id: mentorId,
            topic: "Declined live session test",
            ...scheduled,
            status: "declined"
        }
    ];
    records.users = [
        { id: studentId, role: "student", name: "Test Student" },
        { id: mentorId, role: "mentor", name: "Test Mentor" },
        { id: outsiderId, role: "student", name: "Other Student" },
        { id: adminId, role: "admin", name: "Platform Admin" }
    ];
    records.live_sessions = [];

    supabase.from = (table) => new MockQuery(table);
    supabase.auth.getUser = async (token) => {
        const user = usersByToken.get(token);
        return user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: new Error("Invalid token") };
    };
    process.env.ZEGOCLOUD_APP_ID = "123456";
    process.env.ZEGOCLOUD_SERVER_SECRET = testServerSecret;

    const app = express();
    app.use(express.json());
    app.use("/sessions", sessionsRouter);
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }

    supabase.from = originalFrom;
    supabase.auth.getUser = originalGetUser;
    if (originalAppId === undefined) delete process.env.ZEGOCLOUD_APP_ID;
    else process.env.ZEGOCLOUD_APP_ID = originalAppId;
    if (originalServerSecret === undefined) delete process.env.ZEGOCLOUD_SERVER_SECRET;
    else process.env.ZEGOCLOUD_SERVER_SECRET = originalServerSecret;
});

async function callSession(path, token, method = "GET", body = null, skipRateLimit = true) {
    const response = await fetch(`${baseUrl}/sessions/${path}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(skipRateLimit ? { "x-skip-rate-limit": "true" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    let resBody = null;
    try {
        resBody = await response.json();
    } catch {
        resBody = null;
    }
    return { status: response.status, body: resBody };
}

test("session routes reject unauthenticated and non-participant requests", async () => {
    const unauthenticated = await callSession(bookingId, null);
    assert.equal(unauthenticated.status, 401);

    const unauthorized = await callSession(`${bookingId}/join`, outsiderToken, "POST");
    assert.equal(unauthorized.status, 403);
});

test("all session endpoints strictly reject unauthenticated requests", async () => {
    const joinRes = await callSession(`${bookingId}/join`, null, "POST");
    assert.equal(joinRes.status, 401);

    const joinedRes = await callSession(`${bookingId}/joined`, null, "POST");
    assert.equal(joinedRes.status, 401);

    const leaveRes = await callSession(`${bookingId}/leave`, null, "POST");
    assert.equal(leaveRes.status, 401);

    const endRes = await callSession(`${bookingId}/end`, null, "POST");
    assert.equal(endRes.status, 401);
});

test("outsiders cannot join, participate, leave, or end another user's session", async () => {
    const getRes = await callSession(bookingId, outsiderToken);
    assert.equal(getRes.status, 403);

    const joinedRes = await callSession(`${bookingId}/joined`, outsiderToken, "POST");
    assert.equal(joinedRes.status, 403);

    const leaveRes = await callSession(`${bookingId}/leave`, outsiderToken, "POST");
    assert.equal(leaveRes.status, 403);

    const endRes = await callSession(`${bookingId}/end`, outsiderToken, "POST");
    assert.equal(endRes.status, 403);
});

test("client cannot forge identity, role, or room parameters via request body", async () => {
    const spoofAttempt = {
        userId: outsiderId,
        role: "mentor",
        roomId: "forged-room-id"
    };

    const response = await callSession(`${bookingId}/join`, studentToken, "POST", spoofAttempt);
    assert.equal(response.status, 200);
    assert.equal(response.body.userId, studentId);
    assert.equal(response.body.roomId, `skillswap-${bookingId.replace(/-/g, "")}`);
});

test("ineligible bookings (cancelled and declined) are strictly rejected from joining", async () => {
    const cancelled = await callSession(`${cancelledBookingId}/join`, studentToken, "POST");
    assert.equal(cancelled.status, 409);

    const declined = await callSession(`${declinedBookingId}/join`, studentToken, "POST");
    assert.equal(declined.status, 409);
});

test("all endpoints reject malformed booking IDs with 400", async () => {
    const malformedIds = ["not-a-uuid", "12345", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"];
    for (const badId of malformedIds) {
        const getRes = await callSession(badId, studentToken);
        assert.equal(getRes.status, 400);

        const joinRes = await callSession(`${badId}/join`, studentToken, "POST");
        assert.equal(joinRes.status, 400);

        const joinedRes = await callSession(`${badId}/joined`, studentToken, "POST");
        assert.equal(joinedRes.status, 400);

        const leaveRes = await callSession(`${badId}/leave`, studentToken, "POST");
        assert.equal(leaveRes.status, 400);

        const endRes = await callSession(`${badId}/end`, mentorToken, "POST");
        assert.equal(endRes.status, 400);
    }
});

test("authorized admins can audit session status via GET but cannot join, participate, or end", async () => {
    const auditRes = await callSession(bookingId, adminToken);
    assert.equal(auditRes.status, 200);
    assert.equal(auditRes.body.participantRole, "admin");
    assert.equal(auditRes.body.canJoin, false);

    const joinRes = await callSession(`${bookingId}/join`, adminToken, "POST");
    assert.equal(joinRes.status, 403);

    const joinedRes = await callSession(`${bookingId}/joined`, adminToken, "POST");
    assert.equal(joinedRes.status, 403);

    const leaveRes = await callSession(`${bookingId}/leave`, adminToken, "POST");
    assert.equal(leaveRes.status, 403);

    const endRes = await callSession(`${bookingId}/end`, adminToken, "POST");
    assert.equal(endRes.status, 403);
});

test("temporary disconnection preserves active session and permits rejoining", async () => {
    const leaveRes = await callSession(`${bookingId}/leave`, studentToken, "POST");
    assert.equal(leaveRes.status, 200);
    assert.deepEqual(leaveRes.body, { ok: true });

    const statusRes = await callSession(bookingId, studentToken);
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.canJoin, true);
    assert.notEqual(statusRes.body.status, "completed");
});

test("only confirmed bookings can issue join tokens; session window expiry is enforced", async () => {
    const pending = records.bookings[0];
    pending.status = "pending";
    const pendingResult = await callSession(`${bookingId}/join`, studentToken, "POST");
    assert.equal(pendingResult.status, 409);
    pending.status = "confirmed";

    const expired = await callSession(`${expiredBookingId}/join`, studentToken, "POST");
    assert.equal(expired.status, 410);
});

test("missing ZEGOCLOUD credentials fail closed without creating a call room and sanitize errors", async () => {
    const previousLength = records.live_sessions.length;
    const secret = process.env.ZEGOCLOUD_SERVER_SECRET;
    delete process.env.ZEGOCLOUD_SERVER_SECRET;

    try {
        const response = await callSession(`${bookingId}/join`, studentToken, "POST");
        assert.equal(response.status, 503);
        assert.equal(records.live_sessions.length, previousLength);
        assert.equal(response.body.error.includes("ZEGOCLOUD_SERVER_SECRET"), false);
        assert.equal(response.body.error.includes("ZEGOCLOUD_APP_ID"), false);
    } finally {
        process.env.ZEGOCLOUD_SERVER_SECRET = secret;
    }
});

test("participants join, observe presence, and only the mentor can end the booking", async () => {
    const studentJoin = await callSession(`${bookingId}/join`, studentToken, "POST");
    assert.equal(studentJoin.status, 200);
    assert.equal(studentJoin.body.token.slice(0, 2), "04");
    assert.equal(studentJoin.body.roomId, `skillswap-${bookingId.replace(/-/g, "")}`);
    assert.equal("serverSecret" in studentJoin.body, false);

    const studentJoined = await callSession(`${bookingId}/joined`, studentToken, "POST");
    assert.equal(studentJoined.body.status, "waiting");

    const mentorJoin = await callSession(`${bookingId}/join`, mentorToken, "POST");
    assert.equal(mentorJoin.status, 200);
    const mentorJoined = await callSession(`${bookingId}/joined`, mentorToken, "POST");
    assert.equal(mentorJoined.body.status, "ongoing");

    const studentEnd = await callSession(`${bookingId}/end`, studentToken, "POST");
    assert.equal(studentEnd.status, 403);

    const mentorEnd = await callSession(`${bookingId}/end`, mentorToken, "POST");
    assert.equal(mentorEnd.status, 200);
    assert.equal(mentorEnd.body.status, "completed");
    assert.equal(records.bookings[0].status, "completed");

    const completed = await callSession(bookingId, studentToken);
    assert.equal(completed.body.status, "completed");
});

test("join endpoint enforces rate limiting after threshold is exceeded", async () => {
    let lastResponse;
    for (let i = 0; i < 11; i++) {
        lastResponse = await callSession(`${bookingId}/join`, studentToken, "POST", null, false);
    }
    assert.equal(lastResponse.status, 429);
    assert.match(lastResponse.body.error, /too many/i);
});

test("auto-transcribe endpoint enforces authentication, authorization, and two-party consent", async () => {
    // 1. Unauthenticated rejected with 401
    const unauth = await callSession(`${bookingId}/auto-transcribe`, null, "POST", { audioBase64: "dGVzdA==" });
    assert.equal(unauth.status, 401);

    // 2. Outsider rejected with 403
    const outsider = await callSession(`${bookingId}/auto-transcribe`, outsiderToken, "POST", { audioBase64: "dGVzdA==" });
    assert.equal(outsider.status, 403);

    // 3. Admin rejected with 403
    const admin = await callSession(`${bookingId}/auto-transcribe`, adminToken, "POST", { audioBase64: "dGVzdA==" });
    assert.equal(admin.status, 403);

    // 4. Missing audio rejected with 400
    const noAudio = await callSession(`${bookingId}/auto-transcribe`, studentToken, "POST", { consent: true });
    assert.equal(noAudio.status, 400);

    // 5. Without both participants' consent rejected with 400
    const singleConsent = await callSession(`${bookingId}/auto-transcribe`, studentToken, "POST", {
        audioBase64: Buffer.from("RIFF....WAVEfmt ").toString("base64"),
        consent: true
    });
    assert.equal(singleConsent.status, 400);
    assert.match(singleConsent.body.error, /Two-party consent requirement not met/);

    // 6. Mentor also consents -> Both consented -> 202 Accepted
    const wavHeader = Buffer.alloc(44);
    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + 16000, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(16000, 24);
    wavHeader.writeUInt32LE(32000, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(16000, 40);
    const pcmData = Buffer.alloc(16000);
    const validWav = Buffer.concat([wavHeader, pcmData]);

    const dualConsent = await callSession(`${bookingId}/auto-transcribe`, mentorToken, "POST", {
        audioBase64: validWav.toString("base64"),
        fileName: "session_call.wav",
        mimeType: "audio/wav",
        consent: true
    });
    assert.equal(dualConsent.status, 202);
    assert.equal(dualConsent.body.success, true);
    assert.equal(dualConsent.body.status, "processing");
    assert.ok(dualConsent.body.jobId);
});

test("webhook endpoint /sessions/webhook/gnani validates payload and returns status", async () => {
    const invalidRes = await callSession("webhook/gnani", null, "POST", {});
    assert.equal(invalidRes.status, 400);

    const notFoundRes = await callSession("webhook/gnani", null, "POST", {
        job_id: "non_existent_job",
        status: "COMPLETED"
    });
    assert.equal(notFoundRes.status, 404);
});
