import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
    generateToken04,
    getBookingParticipantRole,
    getLiveSessionStatus,
    getSessionWindow
} from "../src/services/liveSession.js";

test("booking wall-clock times use Asia/Kolkata and the configured join window", () => {
    const window = getSessionWindow("2026-03-15", "10:30:00");

    assert.equal(window.scheduledStart.toISOString(), "2026-03-15T05:00:00.000Z");
    assert.equal(window.joinOpensAt.toISOString(), "2026-03-15T04:45:00.000Z");
    assert.equal(window.expiresAt.toISOString(), "2026-03-15T07:00:00.000Z");
});

test("invalid booking dates and times are rejected", () => {
    assert.throws(() => getSessionWindow("2026-02-30", "10:30:00"), /invalid/i);
    assert.throws(() => getSessionWindow("2026-03-15", "25:00"), /invalid/i);
});

test("join status opens early, tracks participants, and expires at the exact deadline", () => {
    const booking = {
        status: "confirmed",
        date: "2026-03-15",
        time: "10:30:00"
    };

    assert.equal(
        getLiveSessionStatus(booking, null, new Date("2026-03-15T04:44:59.000Z")),
        "scheduled"
    );
    assert.equal(
        getLiveSessionStatus(booking, null, new Date("2026-03-15T04:45:00.000Z")),
        "ready"
    );
    assert.equal(
        getLiveSessionStatus(
            booking,
            { student_joined_at: "2026-03-15T04:46:00.000Z" },
            new Date("2026-03-15T04:47:00.000Z")
        ),
        "waiting"
    );
    assert.equal(
        getLiveSessionStatus(
            booking,
            {
                student_joined_at: "2026-03-15T04:46:00.000Z",
                mentor_joined_at: "2026-03-15T04:47:00.000Z"
            },
            new Date("2026-03-15T04:48:00.000Z")
        ),
        "ongoing"
    );
    assert.equal(
        getLiveSessionStatus(booking, null, new Date("2026-03-15T07:00:00.000Z")),
        "expired"
    );
});

test("only the assigned user with the matching database role is a participant", () => {
    const booking = {
        student_id: "student-id",
        mentor_id: "mentor-id"
    };

    assert.equal(
        getBookingParticipantRole(booking, { id: "student-id", role: "student" }),
        "student"
    );
    assert.equal(
        getBookingParticipantRole(booking, { id: "mentor-id", role: "mentor" }),
        "mentor"
    );
    assert.equal(
        getBookingParticipantRole(booking, { id: "student-id", role: "mentor" }),
        null
    );
    assert.equal(
        getBookingParticipantRole(booking, { id: "other-id", role: "student" }),
        null
    );
});

test("Token04 binds the encrypted token to the assigned user, room, and expiry", () => {
    const serverSecret = "0123456789abcdef0123456789abcdef";
    const expiresAt = new Date("2026-03-15T07:00:00.000Z");
    const token = generateToken04({
        appId: 123456,
        serverSecret,
        roomId: "skillswap-booking",
        userId: "student-id",
        userName: "Student",
        expiresAt,
        now: new Date("2026-03-15T05:00:00.000Z")
    });

    assert.equal(token.slice(0, 2), "04");
    const encoded = Buffer.from(token.slice(2), "base64");
    const expiration = Number(encoded.readBigUInt64BE(0));
    const ivLength = encoded.readUInt16BE(8);
    const ivStart = 10;
    const encryptedLengthOffset = ivStart + ivLength;
    const encryptedLength = encoded.readUInt16BE(encryptedLengthOffset);
    const encryptedStart = encryptedLengthOffset + 2;
    const iv = encoded.subarray(ivStart, encryptedLengthOffset);
    const encrypted = encoded.subarray(encryptedStart, encryptedStart + encryptedLength);
    const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(serverSecret, "utf8"),
        iv
    );
    const tokenBody = JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
    );
    const payload = JSON.parse(tokenBody.payload);

    assert.equal(expiration, expiresAt.getTime() / 1000);
    assert.equal(tokenBody.app_id, 123456);
    assert.equal(tokenBody.user_id, "student-id");
    assert.equal(tokenBody.expire, expiration);
    assert.equal(payload.room_id, "skillswap-booking");
    assert.deepEqual(payload.privilege, { "1": 1, "2": 1 });
    assert.equal(payload.stream_id_list, null);
});

test("Token04 rejects missing or malformed server credentials", () => {
    assert.throws(
        () =>
            generateToken04({
                appId: 123,
                serverSecret: "short",
                roomId: "room",
                userId: "user",
                userName: "User",
                expiresAt: new Date(Date.now() + 60_000)
            }),
        /32 bytes/
    );
});
