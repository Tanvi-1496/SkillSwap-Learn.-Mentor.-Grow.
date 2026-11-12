import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "live-session-tests-only";
const { default: supabase } = await import("../src/config/supabase.js");
const { default: sessionsRouter } = await import("../src/routes/sessions.js");

const studentId = "11111111-1111-4111-8111-111111111111";
const mentorId = "22222222-2222-4222-8222-222222222222";
const outsiderId = "33333333-3333-4333-8333-333333333333";
const bookingId = "44444444-4444-4444-8444-444444444444";
const expiredBookingId = "55555555-5555-4555-8555-555555555555";
const studentToken = "student-test-token";
const mentorToken = "mentor-test-token";
const outsiderToken = "outsider-test-token";
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
    [outsiderToken, { id: outsiderId }]
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
        }
    ];
    records.users = [
        { id: studentId, role: "student", name: "Test Student" },
        { id: mentorId, role: "mentor", name: "Test Mentor" },
        { id: outsiderId, role: "student", name: "Other Student" }
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

async function callSession(path, token, method = "GET") {
    const response = await fetch(`${baseUrl}/sessions/${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return { status: response.status, body: await response.json() };
}

test("session routes reject unauthenticated and non-participant requests", async () => {
    const unauthenticated = await callSession(bookingId, null);
    assert.equal(unauthenticated.status, 401);

    const unauthorized = await callSession(`${bookingId}/join`, outsiderToken, "POST");
    assert.equal(unauthorized.status, 403);
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

test("missing ZEGOCLOUD credentials fail closed without creating a call room", async () => {
    const secret = process.env.ZEGOCLOUD_SERVER_SECRET;
    delete process.env.ZEGOCLOUD_SERVER_SECRET;

    const response = await callSession(`${bookingId}/join`, studentToken, "POST");
    assert.equal(response.status, 503);
    assert.equal(records.live_sessions.length, 0);

    process.env.ZEGOCLOUD_SERVER_SECRET = secret;
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
