import crypto from "node:crypto";

export const SESSION_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;
const JOIN_EARLY_MINUTES = 15;
const SESSION_LENGTH_HOURS = 2;

export function getSessionWindow(date, time) {
    const dateMatch = typeof date === "string" && date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = typeof time === "string" && time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!dateMatch || !timeMatch) {
        throw new Error("Booking date or time is invalid");
    }

    const [, yearText, monthText, dayText] = dateMatch;
    const [, hourText, minuteText, secondText = "0"] = timeMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    if (
        localDate.getUTCFullYear() !== year ||
        localDate.getUTCMonth() !== month - 1 ||
        localDate.getUTCDate() !== day ||
        hour > 23 ||
        minute > 59 ||
        second > 59
    ) {
        throw new Error("Booking date or time is invalid");
    }

    const scheduledStart = new Date(
        localDate.getTime() - INDIA_OFFSET_MINUTES * 60 * 1000
    );

    return {
        joinOpensAt: new Date(scheduledStart.getTime() - JOIN_EARLY_MINUTES * 60 * 1000),
        scheduledStart,
        expiresAt: new Date(
            scheduledStart.getTime() + SESSION_LENGTH_HOURS * 60 * 60 * 1000
        )
    };
}

export function getBookingParticipantRole(booking, user) {
    if (!booking || !user?.id) return null;
    if (booking.student_id === user.id && user.role === "student") return "student";
    if (booking.mentor_id === user.id && user.role === "mentor") return "mentor";
    return null;
}

export function getLiveSessionStatus(booking, session, now = new Date()) {
    if (session?.status === "completed" || booking.status === "completed") {
        return "completed";
    }
    if (
        session?.status === "cancelled" ||
        booking.status === "cancelled" ||
        booking.status === "declined"
    ) {
        return "cancelled";
    }

    const window = getSessionWindow(booking.date, booking.time);
    if (session?.status === "expired" || now.getTime() >= window.expiresAt.getTime()) {
        return "expired";
    }
    if (booking.status !== "confirmed") return "pending";
    if (now.getTime() < window.joinOpensAt.getTime()) return "scheduled";

    const studentJoined = Boolean(session?.student_joined_at);
    const mentorJoined = Boolean(session?.mentor_joined_at);
    if (studentJoined && mentorJoined) return "ongoing";
    if (studentJoined || mentorJoined) return "waiting";
    return "ready";
}

export function generateToken04({
    appId,
    serverSecret,
    roomId,
    userId,
    userName,
    expiresAt,
    now = new Date()
}) {
    const secret = Buffer.from(serverSecret || "", "utf8");
    const expirySeconds = Math.floor(new Date(expiresAt).getTime() / 1000);

    if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 0xffffffff) {
        throw new Error("ZEGOCLOUD_APP_ID must be a positive 32-bit integer");
    }
    if (secret.length !== 32) {
        throw new Error("ZEGOCLOUD_SERVER_SECRET must be exactly 32 bytes");
    }
    if (
        typeof roomId !== "string" ||
        !roomId ||
        typeof userId !== "string" ||
        !userId ||
        typeof userName !== "string" ||
        !userName ||
        !Number.isSafeInteger(expirySeconds) ||
        expirySeconds <= Math.floor(now.getTime() / 1000)
    ) {
        throw new Error("Invalid ZEGOCLOUD token input");
    }

    const payload = JSON.stringify({
        room_id: roomId,
        privilege: {
            "1": 1,
            "2": 1
        },
        stream_id_list: null
    });
    const tokenBody = JSON.stringify({
        app_id: appId,
        user_id: userId,
        nonce: crypto.randomInt(-0x80000000, 0x7fffffff),
        ctime: Math.floor(now.getTime() / 1000),
        expire: expirySeconds,
        payload
    });

    const iv = Buffer.from(crypto.randomBytes(12).toString("base64url"), "utf8");
    const cipher = crypto.createCipheriv("aes-256-cbc", secret, iv);
    const encrypted = Buffer.concat([
        cipher.update(tokenBody, "utf8"),
        cipher.final()
    ]);
    const expiresHeader = Buffer.alloc(8);
    expiresHeader.writeBigUInt64BE(BigInt(expirySeconds), 0);
    const ivLengthHeader = Buffer.alloc(2);
    ivLengthHeader.writeUInt16BE(iv.length, 0);
    const encryptedLengthHeader = Buffer.alloc(2);
    encryptedLengthHeader.writeUInt16BE(encrypted.length, 0);

    return `04${Buffer.concat([
        expiresHeader,
        ivLengthHeader,
        iv,
        encryptedLengthHeader,
        encrypted
    ]).toString("base64")}`;
}
