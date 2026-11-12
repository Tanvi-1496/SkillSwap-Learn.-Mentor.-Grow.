import express from "express";
import rateLimit from "express-rate-limit";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    generateToken04,
    getBookingParticipantRole,
    getLiveSessionStatus,
    getSessionWindow,
    SESSION_TIME_ZONE
} from "../services/liveSession.js";

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_SELECT = "booking_id, room_id, status, student_joined_at, mentor_joined_at, student_left_at, mentor_left_at, started_at, ended_at";

const joinLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many session join requests. Please try again shortly." }
});

function isValidUUID(value) {
    return typeof value === "string" && UUID_REGEX.test(value);
}

function getZegoConfig() {
    const appIdText = process.env.ZEGOCLOUD_APP_ID?.trim() || "";
    const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET?.trim() || "";
    const appId = Number(appIdText);

    if (
        !/^\d+$/.test(appIdText) ||
        !Number.isSafeInteger(appId) ||
        appId <= 0 ||
        appId > 0xffffffff
    ) {
        return null;
    }
    if (Buffer.byteLength(serverSecret, "utf8") !== 32) {
        return null;
    }

    return { appId, serverSecret };
}

function sendDatabaseError(res, error, message = "Live session storage is unavailable") {
    console.error("Live session database error:", error);
    const missingTable = error?.code === "42P01" || error?.code === "PGRST205";
    return res.status(missingTable ? 503 : 500).json({
        error: missingTable
            ? "Live sessions are not available until the live-session database migration is applied."
            : message
    });
}

async function getBookingContext(bookingId, userId, res) {
    const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, student_id, mentor_id, topic, date, time, status")
        .eq("id", bookingId)
        .maybeSingle();

    if (bookingError) {
        console.error("Live session booking lookup failed:", bookingError);
        res.status(500).json({ error: "Unable to verify this booking" });
        return null;
    }
    if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return null;
    }

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, role, name")
        .eq("id", userId)
        .maybeSingle();

    if (userError) {
        console.error("Live session participant lookup failed:", userError);
        res.status(500).json({ error: "Unable to verify booking access" });
        return null;
    }

    const participantRole = getBookingParticipantRole(booking, user);
    if (!participantRole) {
        res.status(403).json({ error: "You are not a participant in this booking" });
        return null;
    }

    return { booking, participantRole, user };
}

async function getSessionRecord(bookingId, res) {
    const { data: session, error } = await supabase
        .from("live_sessions")
        .select(SESSION_SELECT)
        .eq("booking_id", bookingId)
        .maybeSingle();

    if (error) {
        sendDatabaseError(res, error);
        return null;
    }
    return session;
}

function buildSessionResponse(booking, session, participantRole, now = new Date()) {
    const window = getSessionWindow(booking.date, booking.time);
    const status = getLiveSessionStatus(booking, session, now);
    const canJoin = ["ready", "waiting", "ongoing"].includes(status);

    return {
        bookingId: booking.id,
        topic: booking.topic,
        status,
        canJoin,
        participantRole,
        timeZone: SESSION_TIME_ZONE,
        joinOpensAt: window.joinOpensAt.toISOString(),
        scheduledStartAt: window.scheduledStart.toISOString(),
        expiresAt: window.expiresAt.toISOString(),
        participants: {
            studentJoined: Boolean(session?.student_joined_at),
            mentorJoined: Boolean(session?.mentor_joined_at)
        }
    };
}

async function ensureSessionRecord(bookingId, roomId, res) {
    const { error: insertError } = await supabase
        .from("live_sessions")
        .upsert(
            { booking_id: bookingId, room_id: roomId },
            { onConflict: "booking_id", ignoreDuplicates: true }
        );

    if (insertError) {
        sendDatabaseError(res, insertError);
        return null;
    }
    return getSessionRecord(bookingId, res);
}

async function persistTerminalStatus(booking, session, status, res) {
    if (!session || session.status !== "active" || !["completed", "expired", "cancelled"].includes(status)) {
        return session;
    }

    const updates = { status };
    if (status !== "cancelled") updates.ended_at = new Date().toISOString();

    const { error } = await supabase
        .from("live_sessions")
        .update(updates)
        .eq("booking_id", booking.id)
        .eq("status", "active");

    if (error) {
        sendDatabaseError(res, error, "Unable to update live session status");
        return null;
    }
    return { ...session, ...updates };
}

function sendSessionState(res, booking, session, participantRole) {
    try {
        const state = buildSessionResponse(booking, session, participantRole);
        return res.json(state);
    } catch (error) {
        console.error("Invalid booking schedule for live session:", error);
        return res.status(500).json({ error: "This booking has an invalid session schedule" });
    }
}

router.get("/:bookingId", authMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;

        let session = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        const status = getLiveSessionStatus(context.booking, session);
        session = await persistTerminalStatus(context.booking, session, status, res);
        if (res.headersSent) return;

        return sendSessionState(res, context.booking, session, context.participantRole);
    } catch (error) {
        console.error("Live session status lookup failed:", error);
        return res.status(500).json({ error: "Unable to load live session" });
    }
});

router.post("/:bookingId/join", joinLimiter, authMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;

        let state;
        try {
            state = buildSessionResponse(context.booking, null, context.participantRole);
        } catch (error) {
            console.error("Invalid booking schedule for live session:", error);
            return res.status(500).json({ error: "This booking has an invalid session schedule" });
        }

        if (context.booking.status !== "confirmed") {
            return res.status(409).json({ error: "Only confirmed bookings can join a live session" });
        }
        if (state.status === "scheduled") {
            return res.status(409).json({
                error: "The live session opens 15 minutes before its scheduled start",
                joinOpensAt: state.joinOpensAt
            });
        }
        if (state.status === "expired") {
            return res.status(410).json({ error: "This live session has expired" });
        }
        if (["completed", "cancelled"].includes(state.status)) {
            return res.status(409).json({ error: "This live session is no longer available" });
        }

        const zegoConfig = getZegoConfig();
        if (!zegoConfig) {
            return res.status(503).json({
                error: "Live video is not configured. Set a valid ZEGOCLOUD_APP_ID and 32-byte ZEGOCLOUD_SERVER_SECRET on the backend."
            });
        }

        const roomId = `skillswap-${bookingId.replace(/-/g, "")}`;
        const session = await ensureSessionRecord(bookingId, roomId, res);
        if (res.headersSent || !session) return;
        if (session.status !== "active") {
            return res.status(409).json({ error: "This live session is no longer available" });
        }

        const currentState = buildSessionResponse(context.booking, session, context.participantRole);
        if (!currentState.canJoin) {
            return res.status(410).json({ error: "This live session is no longer available" });
        }

        const token = generateToken04({
            appId: zegoConfig.appId,
            serverSecret: zegoConfig.serverSecret,
            roomId: session.room_id,
            userId: req.user.id,
            userName:
                context.user.name?.trim().slice(0, 64) ||
                (context.participantRole === "mentor" ? "Mentor" : "Student"),
            expiresAt: new Date(currentState.expiresAt)
        });

        return res.json({
            appId: zegoConfig.appId,
            token,
            roomId: session.room_id,
            userId: req.user.id,
            userName:
                context.user.name?.trim().slice(0, 64) ||
                (context.participantRole === "mentor" ? "Mentor" : "Student"),
            expiresAt: currentState.expiresAt
        });
    } catch (error) {
        console.error("Live session join request failed:", error);
        return res.status(500).json({ error: "Unable to join live session" });
    }
});

router.post("/:bookingId/joined", authMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;

        const session = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        if (!session || session.status !== "active") {
            return res.status(409).json({ error: "The live session is no longer available" });
        }

        const state = buildSessionResponse(context.booking, session, context.participantRole);
        if (!state.canJoin) {
            return res.status(410).json({ error: "This live session has expired" });
        }

        const now = new Date().toISOString();
        const joinedField = `${context.participantRole}_joined_at`;
        const { error: joinedError } = await supabase
            .from("live_sessions")
            .update({ [joinedField]: now })
            .eq("booking_id", bookingId)
            .eq("status", "active")
            .is(joinedField, null);

        if (joinedError) {
            return sendDatabaseError(res, joinedError, "Unable to record session attendance");
        }

        const { error: startError } = await supabase
            .from("live_sessions")
            .update({ started_at: now })
            .eq("booking_id", bookingId)
            .is("started_at", null);
        if (startError) {
            return sendDatabaseError(res, startError, "Unable to record the session start");
        }

        const updatedSession = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        return sendSessionState(res, context.booking, updatedSession, context.participantRole);
    } catch (error) {
        console.error("Live session attendance update failed:", error);
        return res.status(500).json({ error: "Unable to update session attendance" });
    }
});

router.post("/:bookingId/leave", authMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;

        const session = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        if (!session) return res.json({ ok: true });

        const leftField = `${context.participantRole}_left_at`;
        const { error } = await supabase
            .from("live_sessions")
            .update({ [leftField]: new Date().toISOString() })
            .eq("booking_id", bookingId);

        if (error) {
            return sendDatabaseError(res, error, "Unable to record session departure");
        }
        return res.json({ ok: true });
    } catch (error) {
        console.error("Live session departure update failed:", error);
        return res.status(500).json({ error: "Unable to record session departure" });
    }
});

router.post("/:bookingId/end", authMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;
        if (context.participantRole !== "mentor") {
            return res.status(403).json({ error: "Only the assigned mentor can end the live session" });
        }

        const session = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        if (session?.status === "completed" || context.booking.status === "completed") {
            return sendSessionState(res, context.booking, session, context.participantRole);
        }
        if (!session || session.status !== "active" || !session.mentor_joined_at) {
            return res.status(409).json({ error: "Join the live session before ending it" });
        }

        if (context.booking.status !== "confirmed") {
            return res.status(409).json({ error: "This booking can no longer be completed" });
        }

        const { data: completedBooking, error: bookingError } = await supabase
            .from("bookings")
            .update({ status: "completed" })
            .eq("id", bookingId)
            .eq("status", "confirmed")
            .select("id, student_id, mentor_id, topic, date, time, status")
            .maybeSingle();

        if (bookingError) {
            console.error("Live session booking completion failed:", bookingError);
            return res.status(500).json({ error: "Unable to complete this booking" });
        }
        if (!completedBooking) {
            return res.status(409).json({ error: "This booking can no longer be completed" });
        }

        const endedAt = new Date().toISOString();
        const { error: sessionError } = await supabase
            .from("live_sessions")
            .update({ status: "completed", ended_at: endedAt })
            .eq("booking_id", bookingId)
            .eq("status", "active");

        if (sessionError) {
            return sendDatabaseError(res, sessionError, "The booking was completed, but the live session status could not be updated");
        }

        const updatedSession = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        return sendSessionState(res, completedBooking, updatedSession, context.participantRole);
    } catch (error) {
        console.error("Live session end request failed:", error);
        return res.status(500).json({ error: "Unable to end live session" });
    }
});

export default router;
