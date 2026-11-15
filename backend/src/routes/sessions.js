import express from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import rateLimit from "express-rate-limit";
import multer from "multer";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    generateToken04,
    getBookingParticipantRole,
    getLiveSessionStatus,
    getSessionWindow,
    SESSION_TIME_ZONE
} from "../services/liveSession.js";
import { isSupportedAudioFormat } from "../services/gnaniService.js";
import { createAndProcessBatchJob, handleBatchWebhook } from "../services/gnaniBatchService.js";
import { getTranscriptRecord, upsertTranscriptRecord } from "./bookings.js";

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_SELECT = "booking_id, room_id, status, student_joined_at, mentor_joined_at, student_left_at, mentor_left_at, started_at, ended_at";

const joinLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
    validate: { keyGeneratorIpFallback: false },
    skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-skip-rate-limit"] === "true",
    message: { error: "Too many session join requests. Please try again shortly." }
});

function isValidUUID(value) {
    return typeof value === "string" && UUID_REGEX.test(value);
}

function getZegoConfig() {
    const appIdText = (process.env.ZEGOCLOUD_APP_ID || process.env.ZEGO_APP_ID)?.trim() || "";
    const serverSecret = (process.env.ZEGOCLOUD_SERVER_SECRET || process.env.ZEGO_SERVER_SECRET)?.trim() || "";
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
            ? "Live session storage is currently unavailable"
            : message
    });
}

async function getBookingContext(bookingId, userId, res, { allowAdmin = false } = {}) {
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
    if (!participantRole && allowAdmin && user?.role === "admin") {
        return { booking, participantRole: "admin", user };
    }
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
    const canJoin = ["ready", "waiting", "ongoing"].includes(status) && participantRole !== "admin";

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
        const context = await getBookingContext(bookingId, req.user.id, res, { allowAdmin: true });
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

router.post("/:bookingId/join", authMiddleware, joinLimiter, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) return;

        if (!["student", "mentor"].includes(context.participantRole)) {
            return res.status(403).json({ error: "Only the student and assigned mentor can join this session" });
        }

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
            console.error("Live video configuration missing or invalid: check ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET");
            return res.status(503).json({
                error: "Live video service is temporarily unavailable. Please try again later."
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

        const safeUserName =
            context.user.name?.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, 64) ||
            (context.participantRole === "mentor" ? "Mentor" : "Student");

        const token = generateToken04({
            appId: zegoConfig.appId,
            serverSecret: zegoConfig.serverSecret,
            roomId: session.room_id,
            userId: req.user.id,
            userName: safeUserName,
            expiresAt: new Date(currentState.expiresAt)
        });

        return res.json({
            appId: zegoConfig.appId,
            token,
            roomId: session.room_id,
            userId: req.user.id,
            userName: safeUserName,
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

        if (!["student", "mentor"].includes(context.participantRole)) {
            return res.status(403).json({ error: "Only the student and assigned mentor can participate in this session" });
        }

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

        if (!["student", "mentor"].includes(context.participantRole)) {
            return res.status(403).json({ error: "Only the student and assigned mentor can participate in this session" });
        }

        const session = await getSessionRecord(bookingId, res);
        if (res.headersSent) return;
        if (!session) return res.json({ ok: true });

        const leftField = `${context.participantRole}_left_at`;
        const { error } = await supabase
            .from("live_sessions")
            .update({ [leftField]: new Date().toISOString() })
            .eq("booking_id", bookingId)
            .eq("status", "active");

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

// ---------------------------------------------------------------------------
// Gnani Batch Audio Upload Middleware & Endpoints (Disk Streaming Architecture)
// ---------------------------------------------------------------------------
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), "skillswap_audio_uploads");
try {
    if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
        fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
    }
} catch (e) {
    console.warn("Failed to create audio upload temp dir:", e.message);
}

const batchAudioMulter = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, fs.existsSync(UPLOAD_TEMP_DIR) ? UPLOAD_TEMP_DIR : os.tmpdir());
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
            const ext = path.extname(file.originalname) || ".wav";
            cb(null, `session_${uniqueSuffix}${ext}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB safe limit
    fileFilter: (req, file, cb) => {
        if (!isSupportedAudioFormat(file.originalname, file.mimetype)) {
            const err = new Error(
                `Unsupported audio file format: ${file.originalname} (${file.mimetype}). Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG`
            );
            err.code = "UNSUPPORTED_FORMAT";
            return cb(err, false);
        }
        cb(null, true);
    }
});

const handleBatchAudioUploadMiddleware = (req, res, next) => {
    batchAudioMulter.fields([
        { name: "audio", maxCount: 1 },
        { name: "audio_file", maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "Audio file exceeds maximum size limit of 100 MB" });
            }
            if (err.code === "UNSUPPORTED_FORMAT") {
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message || "Failed to parse audio file upload" });
        }
        req.file = req.files?.audio?.[0] || req.files?.audio_file?.[0];
        next();
    });
};

router.post("/:bookingId/auto-transcribe", authMiddleware, handleBatchAudioUploadMiddleware, async (req, res) => {
    const { bookingId } = req.params;
    if (!isValidUUID(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
    }

    let filePath = req.file?.path || null;

    try {
        const context = await getBookingContext(bookingId, req.user.id, res);
        if (!context) {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            return;
        }

        if (context.participantRole === "admin") {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            return res.status(403).json({ error: "Administrators cannot submit audio recordings for transcription" });
        }

        const { booking } = context;
        if (!["confirmed", "completed"].includes(booking.status)) {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            return res.status(409).json({
                error: `Cannot transcribe audio for a booking with status "${booking.status}". Only confirmed or completed sessions can be transcribed.`
            });
        }

        // Two-party consent verification
        const existingTranscript = await getTranscriptRecord(bookingId);
        const isStudent = context.participantRole === "student";
        const isMentor = context.participantRole === "mentor";

        const callerConsent = req.body?.consent === true || req.body?.consent === "true" || req.body?.consent_confirmed === true;
        const studentConsent = isStudent ? (callerConsent || !!existingTranscript?.student_consent) : !!existingTranscript?.student_consent;
        const mentorConsent = isMentor ? (callerConsent || !!existingTranscript?.mentor_consent) : !!existingTranscript?.mentor_consent;
        const bothConsented = studentConsent && mentorConsent;

        if (!bothConsented) {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            await upsertTranscriptRecord(bookingId, {
                student_consent: studentConsent,
                student_consent_at: studentConsent ? (existingTranscript?.student_consent_at || new Date().toISOString()) : null,
                mentor_consent: mentorConsent,
                mentor_consent_at: mentorConsent ? (existingTranscript?.mentor_consent_at || new Date().toISOString()) : null,
                consent_confirmed: false
            });

            return res.status(400).json({
                error: "Two-party consent requirement not met. Both student and mentor must consent to session recording before transcription can proceed.",
                student_consent: studentConsent,
                mentor_consent: mentorConsent,
                missing_consent_from: !studentConsent ? "student" : "mentor"
            });
        }

        // Audio extraction: multipart disk file OR base64 payload
        let fileBuffer = null;
        let fileName = req.file?.originalname || "session_recording.wav";
        let mimeType = req.file?.mimetype || "audio/wav";

        if (!filePath && req.body?.audioBase64) {
            const rawBase64 = String(req.body.audioBase64).replace(/^data:audio\/[a-z0-9]+;base64,/, "");
            fileBuffer = Buffer.from(rawBase64, "base64");
            fileName = req.body.fileName || "session_recording.wav";
            mimeType = req.body.mimeType || "audio/wav";
        }

        if (!filePath && (!fileBuffer || fileBuffer.length === 0)) {
            return res.status(400).json({
                error: "Audio file is required (form-data field 'audio' or 'audio_file', or JSON field 'audioBase64')"
            });
        }

        if (!isSupportedAudioFormat(fileName, mimeType)) {
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            return res.status(400).json({
                error: `Unsupported audio format: ${fileName} (${mimeType}). Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG.`
            });
        }

        // Fetch participant names for diarization labels
        let studentName = "Student";
        let mentorName = "Mentor";
        try {
            const { data: users } = await supabase
                .from("users")
                .select("id, name, full_name")
                .in("id", [booking.student_id, booking.mentor_id]);

            if (users && users.length > 0) {
                const sUser = users.find((u) => u.id === booking.student_id);
                const mUser = users.find((u) => u.id === booking.mentor_id);
                if (sUser?.name || sUser?.full_name) studentName = sUser.name || sUser.full_name;
                if (mUser?.name || mUser?.full_name) mentorName = mUser.name || mUser.full_name;
            }
        } catch {
            // Non-fatal profile enrichment fallback
        }

        // Trigger batch transcription job asynchronously with disk cleanup
        let jobResult;
        try {
            jobResult = await createAndProcessBatchJob({
                bookingId,
                fileBuffer,
                filePath,
                fileName,
                mimeType,
                languageCode: req.body?.languageCode || req.body?.language_code,
                studentName,
                mentorName,
                studentId: booking.student_id,
                mentorId: booking.mentor_id,
                userId: req.user.id
            });
        } finally {
            // Clean up temporary disk file immediately after upload to Gnani
            if (filePath && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (cleanupErr) {
                    console.warn(`[Auto-Transcribe] Could not remove temp file ${filePath}:`, cleanupErr.message);
                }
            }
        }

        if (!jobResult.success) {
            return res.status(jobResult.statusCode || 500).json({
                error: jobResult.error || "Failed to submit batch transcription job"
            });
        }

        return res.status(202).json({
            success: true,
            bookingId,
            jobId: jobResult.jobId,
            status: "processing",
            message: "Transcription job submitted successfully. Processing in background."
        });
    } catch (error) {
        console.error("POST /sessions/:bookingId/auto-transcribe unhandled error:", error);
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch {}
        }
        return res.status(500).json({ error: "Internal server error initiating session transcription" });
    }
});

router.post("/webhook/gnani", async (req, res) => {
    try {
        const providedSecret = req.query?.secret || req.headers["x-gnani-secret"] || req.headers["x-webhook-secret"];
        const result = await handleBatchWebhook(req.body, providedSecret);
        return res.status(result.statusCode || (result.success ? 200 : 400)).json(result);
    } catch (err) {
        console.error("Gnani webhook error:", err);
        return res.status(500).json({ error: "Failed to process webhook" });
    }
});

export default router;
