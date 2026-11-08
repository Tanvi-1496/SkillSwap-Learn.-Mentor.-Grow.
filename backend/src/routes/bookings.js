import express from "express";
import multer from "multer";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    transcribeAudio,
    isSupportedAudioFormat,
    estimateAudioDuration,
    MAX_AUDIO_DURATION_SECONDS
} from "../services/gnaniService.js";

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
    return typeof str === "string" && UUID_REGEX.test(str.trim());
}

// Multer in-memory storage for audio recordings (strict 25 MB size limit)
const audioMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB maximum
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

const handleAudioUploadMiddleware = (req, res, next) => {
    audioMulter.fields([
        { name: "audio", maxCount: 1 },
        { name: "audio_file", maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    error: "Audio file exceeds maximum size limit of 25 MB"
                });
            }
            if (err.code === "UNSUPPORTED_FORMAT") {
                return res.status(400).json({
                    error: err.message
                });
            }
            return res.status(400).json({
                error: err.message || "Failed to parse audio file upload"
            });
        }
        req.file = req.files?.audio?.[0] || req.files?.audio_file?.[0];
        next();
    });
};

/**
 * Normalizes any time string (e.g. "5:00 PM", "17:00", "5:00 PM - 6:00 PM") into canonical
 * PostgreSQL TIME WITHOUT TIME ZONE format: "HH:MM:SS" (24-hour).
 */
export function normalizeTimeTo24h(timeStr) {
    if (!timeStr) return null;
    let trimmed = String(timeStr).trim();

    // If a time range is provided (e.g. "5:00 PM - 6:00 PM" or "17:00-18:00"), extract start time
    if (trimmed.includes(" - ")) {
        trimmed = trimmed.split(" - ")[0].trim();
    } else if (trimmed.includes("-")) {
        trimmed = trimmed.split("-")[0].trim();
    }

    // 12-hour format e.g. "5:00 PM", "05:00 PM", "10:30 AM"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2];
        const s = match12[3] || "00";
        const modifier = match12[4].toUpperCase();

        if (modifier === "PM" && h < 12) h += 12;
        if (modifier === "AM" && h === 12) h = 0;

        return `${String(h).padStart(2, "0")}:${m}:${s}`;
    }

    // 24-hour format e.g. "17:00", "17:00:00", "09:30"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
        const h = match24[1].padStart(2, "0");
        const m = match24[2];
        const s = match24[3] || "00";
        return `${h}:${m}:${s}`;
    }

    return null;
}

/**
 * In-memory concurrency lock to serialize simultaneous booking requests
 * for the exact same mentor, date, and time slot.
 */
const slotLocks = new Map();

async function withSlotLock(key, fn) {
    while (slotLocks.has(key)) {
        await slotLocks.get(key);
    }
    let resolveLock;
    const lockPromise = new Promise((resolve) => {
        resolveLock = resolve;
    });
    slotLocks.set(key, lockPromise);
    try {
        return await fn();
    } finally {
        slotLocks.delete(key);
        resolveLock();
    }
}

// ---------------------------------------------------------------------------
// GET /bookings/slots (Discover booked slots for a mentor on a specific date)
// ---------------------------------------------------------------------------
router.get("/slots", async (req, res) => {
    try {
        const { mentor_id, date } = req.query;

        if (!mentor_id || !date) {
            return res.status(400).json({
                error: "mentor_id and date query parameters are required"
            });
        }

        const { data: bookings, error } = await supabase
            .from("bookings")
            .select("time, status")
            .eq("mentor_id", mentor_id)
            .eq("date", date)
            .in("status", ["pending", "confirmed"]);

        if (error) {
            console.error("Slots lookup error:", error);
            return res.status(500).json({ error: error.message });
        }

        const bookedSlots = (bookings || []).map((b) => b.time);

        res.json({
            mentor_id,
            date,
            bookedSlots
        });
    } catch (error) {
        console.error("GET /bookings/slots error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// POST /bookings (Create a booking)
// ---------------------------------------------------------------------------
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { mentor_id, topic, date, time } = req.body;
        const student_id = req.user.id;

        // 1. Validate required fields
        if (!mentor_id || !topic || !date || !time) {
            return res.status(400).json({
                error: "mentor_id, topic, date and time are required"
            });
        }

        // 2. Prevent self-booking
        if (mentor_id === student_id) {
            return res.status(400).json({
                error: "You cannot book a mentorship session with yourself"
            });
        }

        // 3. Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date) || isNaN(Date.parse(date))) {
            return res.status(400).json({
                error: "Invalid date format. Expected YYYY-MM-DD"
            });
        }

        // 4. Validate time format and normalize to 24-hour HH:MM:SS
        const normalizedTime = normalizeTimeTo24h(time);
        if (!normalizedTime || !/^\d{2}:\d{2}:\d{2}$/.test(normalizedTime)) {
            return res.status(400).json({
                error: "Invalid time format. Example formats: '5:00 PM', '17:00'"
            });
        }

        // 5. Prevent booking past dates/times
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        if (date < todayStr) {
            return res.status(400).json({
                error: "Cannot book a session for a past date"
            });
        }

        if (date === todayStr) {
            const current24 = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
            if (normalizedTime <= current24) {
                return res.status(400).json({
                    error: "Cannot book a time slot in the past"
                });
            }
        }

        // 6. Role check: verify that caller is NOT a mentor trying to create student bookings
        const { data: callerUser, error: callerError } = await supabase
            .from("users")
            .select("id, role")
            .eq("id", student_id)
            .maybeSingle();

        if (callerError) {
            console.error("Caller role lookup error:", callerError);
            return res.status(500).json({ error: "Failed to verify caller role" });
        }

        if (callerUser && callerUser.role === "mentor") {
            return res.status(403).json({
                error: "Mentors cannot create student bookings"
            });
        }

        // 7. Verify that mentor_id belongs to a valid user with role 'mentor'
        const { data: mentorUser, error: mentorError } = await supabase
            .from("users")
            .select("id, role")
            .eq("id", mentor_id)
            .maybeSingle();

        if (mentorError) {
            console.error("Mentor lookup error:", mentorError);
            return res.status(500).json({ error: "Failed to verify mentor" });
        }

        if (!mentorUser || mentorUser.role !== "mentor") {
            return res.status(400).json({
                error: "Selected user is not an active mentor"
            });
        }

        // 7b. Verify that mentor is approved to accept bookings
        const { data: mentorProfile, error: mpError } = await supabase
            .from("mentor_profiles")
            .select("user_id, verification_status, verified")
            .eq("user_id", mentor_id)
            .maybeSingle();

        if (mpError) {
            console.error("Mentor profile lookup error:", mpError);
            return res.status(500).json({ error: "Failed to verify mentor approval status" });
        }

        const isApproved = mentorProfile && (
            mentorProfile.verification_status === "approved" ||
            (!mentorProfile.verification_status && mentorProfile.verified === true)
        );

        if (!isApproved) {
            return res.status(400).json({
                error: "Selected mentor is not currently approved to accept bookings"
            });
        }

        // 8. Verify slot availability from mentor's schedule
        const dateObj = new Date(`${date}T12:00:00Z`);
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayOfWeek = dayNames[dateObj.getUTCDay()];

        const { data: availRows, error: availError } = await supabase
            .from("availability")
            .select("slots")
            .eq("mentor_id", mentor_id)
            .eq("day", dayOfWeek);

        if (availError) {
            console.error("Availability lookup error:", availError);
            return res.status(500).json({ error: "Failed to check mentor availability" });
        }

        if (!availRows || availRows.length === 0 || !Array.isArray(availRows[0]?.slots) || availRows[0].slots.length === 0) {
            return res.status(400).json({
                error: `Mentor is not available on ${dayOfWeek}`
            });
        }

        const mentorSlots24h = availRows[0].slots.map((s) => normalizeTimeTo24h(s));
        if (!mentorSlots24h.includes(normalizedTime)) {
            return res.status(400).json({
                error: `Requested time slot is not available in mentor's schedule for ${dayOfWeek}`
            });
        }

        // 9. Atomic check & insert guarded by in-process slot lock
        const lockKey = `${mentor_id}:${date}:${normalizedTime}`;

        const result = await withSlotLock(lockKey, async () => {
            // Check mentor conflict (pending or confirmed)
            const { data: conflicts, error: conflictError } = await supabase
                .from("bookings")
                .select("id, status")
                .eq("mentor_id", mentor_id)
                .eq("date", date)
                .eq("time", normalizedTime)
                .in("status", ["pending", "confirmed"]);

            if (conflictError) {
                console.error("Booking conflict check error:", conflictError);
                return { status: 500, data: { error: "Failed to verify slot availability" } };
            }

            if (conflicts && conflicts.length > 0) {
                return {
                    status: 409,
                    data: { error: "This time slot is no longer available. Please choose another time." }
                };
            }

            // Check student conflict (cannot be in two sessions at the exact same date and time)
            const { data: studentConflicts, error: sConflictError } = await supabase
                .from("bookings")
                .select("id, status")
                .eq("student_id", student_id)
                .eq("date", date)
                .eq("time", normalizedTime)
                .in("status", ["pending", "confirmed"]);

            if (sConflictError) {
                console.error("Student conflict check error:", sConflictError);
                return { status: 500, data: { error: "Failed to verify student schedule" } };
            }

            if (studentConflicts && studentConflicts.length > 0) {
                return {
                    status: 409,
                    data: { error: "You already have an active session scheduled at this date and time." }
                };
            }

            // Insert booking
            const { data, error } = await supabase
                .from("bookings")
                .insert([
                    {
                        mentor_id,
                        student_id,
                        topic: topic.trim(),
                        date,
                        time: normalizedTime,
                        status: "pending"
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error("Booking insert error:", error);
                // Handle database-level unique constraint violation (code 23505)
                if (error.code === "23505" || error.message?.includes("unique")) {
                    return {
                        status: 409,
                        data: { error: "This time slot is no longer available. Please choose another time." }
                    };
                }
                return { status: 500, data: { error: error.message } };
            }

            return {
                status: 201,
                data: {
                    message: "Booking created successfully",
                    booking: data
                }
            };
        });

        res.status(result.status).json(result.data);

    } catch (error) {
        console.error("Booking route POST error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

// ---------------------------------------------------------------------------
// GET /bookings (List bookings for the authenticated user)
// ---------------------------------------------------------------------------
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch bookings where the authenticated user is either student or mentor
        const { data: bookings, error } = await supabase
            .from("bookings")
            .select("id, mentor_id, student_id, topic, date, time, status")
            .or(`student_id.eq.${userId},mentor_id.eq.${userId}`)
            .order("date", { ascending: false })
            .order("time", { ascending: false });

        if (error) {
            console.error("Bookings fetch error:", error);
            return res.status(500).json({
                error: error.message
            });
        }

        if (!bookings || bookings.length === 0) {
            return res.json({ bookings: [] });
        }

        // Collect distinct mentor and student IDs to resolve names
        const userIds = [
            ...new Set([
                ...bookings.map((b) => b.mentor_id),
                ...bookings.map((b) => b.student_id)
            ].filter(Boolean))
        ];

        let users = [];
        if (userIds.length > 0) {
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, name, email")
                .in("id", userIds);

            if (userError) {
                console.error("Booking user lookup error:", userError);
            } else {
                users = userData || [];
            }
        }

        // Enrich bookings with mentor and student names
        const enrichedBookings = bookings.map((b) => {
            const mentor = users.find((u) => u.id === b.mentor_id);
            const student = users.find((u) => u.id === b.student_id);
            return {
                ...b,
                mentor_name: mentor?.name || "Mentor",
                mentor_email: mentor?.email || "",
                student_name: student?.name || "Student",
                student_email: student?.email || ""
            };
        });

        res.json({
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error("Booking route GET error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

// ---------------------------------------------------------------------------
// GET /bookings/:id (Get a single booking with authorization check)
// ---------------------------------------------------------------------------
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { data: booking, error } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            console.error("Single booking fetch error:", error);
            return res.status(500).json({ error: error.message });
        }

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // Authorization check: only the student or mentor may view this booking
        if (booking.student_id !== userId && booking.mentor_id !== userId) {
            return res.status(403).json({
                error: "You are not authorized to access this booking"
            });
        }

        // Enrich with user names
        const { data: users } = await supabase
            .from("users")
            .select("id, name, email")
            .in("id", [booking.mentor_id, booking.student_id]);

        const mentor = users?.find((u) => u.id === booking.mentor_id);
        const student = users?.find((u) => u.id === booking.student_id);

        res.json({
            booking: {
                ...booking,
                mentor_name: mentor?.name || "Mentor",
                mentor_email: mentor?.email || "",
                student_name: student?.name || "Student",
                student_email: student?.email || ""
            }
        });

    } catch (error) {
        console.error("Single booking GET error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// PATCH /bookings/:id (Update booking status with valid role transitions)
// ---------------------------------------------------------------------------
router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["pending", "confirmed", "declined", "cancelled", "completed"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`
            });
        }

        // 1. Fetch existing booking
        const { data: booking, error: fetchError } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (fetchError) {
            console.error("Booking lookup error:", fetchError);
            return res.status(500).json({
                error: fetchError.message
            });
        }

        if (!booking) {
            return res.status(404).json({
                error: "Booking not found"
            });
        }

        // 2. Authorization check: only the student or mentor of this booking may update it
        const isStudent = booking.student_id === req.user.id;
        const isMentor = booking.mentor_id === req.user.id;

        if (!isStudent && !isMentor) {
            return res.status(403).json({
                error: "You are not authorized to update this booking"
            });
        }

        const currentStatus = booking.status;

        // Map status to valid database check constraint values:
        // The DB check constraint allows: 'pending', 'confirmed', 'cancelled', 'completed'.
        // If 'declined' is requested, map it to 'cancelled' in the database.
        const dbTargetStatus = status === "declined" ? "cancelled" : status;

        // No-op update if already in target status
        if (currentStatus === dbTargetStatus) {
            return res.json({
                message: "Booking status is already " + status,
                booking
            });
        }

        // 3. State transition validations:
        // Terminal states cannot be transitioned
        if (currentStatus === "cancelled") {
            return res.status(400).json({
                error: "Cannot update a booking that has already been cancelled or declined"
            });
        }
        if (currentStatus === "completed") {
            return res.status(400).json({
                error: "Cannot update a booking that has already been completed"
            });
        }

        // Transitions from 'pending'
        if (currentStatus === "pending") {
            if (status === "confirmed" || status === "declined") {
                if (!isMentor) {
                    return res.status(403).json({
                        error: "Only the mentor can accept or decline this booking request"
                    });
                }
            } else if (status === "cancelled") {
                // Both student and mentor can cancel a pending booking
            } else {
                return res.status(400).json({
                    error: `Cannot transition booking from "${currentStatus}" to "${status}"`
                });
            }
        }

        // Transitions from 'confirmed'
        if (currentStatus === "confirmed") {
            if (status === "declined") {
                return res.status(400).json({
                    error: "Cannot reject a booking that has already been accepted. Cancel the booking instead."
                });
            } else if (status === "completed" || status === "cancelled") {
                // Both student and mentor can mark completed or cancel a confirmed session
            } else {
                return res.status(400).json({
                    error: `Cannot transition booking from "${currentStatus}" to "${status}"`
                });
            }
        }

        // 4. Update booking status in database
        const { data: updatedBooking, error: updateError } = await supabase
            .from("bookings")
            .update({ status: dbTargetStatus })
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            console.error("Booking update error:", updateError);
            return res.status(500).json({
                error: updateError.message
            });
        }

        res.json({
            message: "Booking updated successfully",
            booking: updatedBooking
        });

    } catch (error) {
        console.error("Booking route PATCH error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

// ---------------------------------------------------------------------------
// Transcript Record Storage Helpers (Supabase with In-Memory Resilience Fallback)
// ---------------------------------------------------------------------------
const transcriptMemoryStore = new Map();

async function getTranscriptRecord(bookingId) {
    try {
        const { data, error } = await supabase
            .from("session_transcripts")
            .select("*")
            .eq("booking_id", bookingId)
            .maybeSingle();

        if (!error && data) {
            transcriptMemoryStore.set(bookingId, data);
            return data;
        }
    } catch (e) {
        // Table not ready or network issue; fallback to in-memory store
    }
    return transcriptMemoryStore.get(bookingId) || null;
}

async function upsertTranscriptRecord(bookingId, recordData) {
    const existing = transcriptMemoryStore.get(bookingId) || {};
    const merged = {
        id: existing.id || undefined,
        ...existing,
        ...recordData,
        booking_id: bookingId,
        updated_at: new Date().toISOString()
    };
    transcriptMemoryStore.set(bookingId, merged);

    try {
        await supabase
            .from("session_transcripts")
            .upsert(merged, { onConflict: "booking_id" });
    } catch (e) {
        // Table not ready; in-memory store guarantees uninterrupted functionality
    }

    return merged;
}

// ---------------------------------------------------------------------------
// POST /bookings/:id/consent (Explicit Two-Party Recording Consent)
// ---------------------------------------------------------------------------
router.post("/:id/consent", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Validate booking ID format
        if (!isValidUUID(id)) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // 2. Fetch booking to verify participant
        const { data: booking, error: bError } = await supabase
            .from("bookings")
            .select("id, student_id, mentor_id, status")
            .eq("id", id)
            .maybeSingle();

        if (bError || !booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const isStudent = booking.student_id === userId;
        const isMentor = booking.mentor_id === userId;

        if (!isStudent && !isMentor) {
            return res.status(403).json({
                error: "Only session participants (student or mentor) can record consent"
            });
        }

        // 3. Fetch existing consent state
        const existing = await getTranscriptRecord(id);

        const studentConsent = isStudent ? true : !!existing?.student_consent;
        const mentorConsent = isMentor ? true : !!existing?.mentor_consent;
        const bothConsented = studentConsent && mentorConsent;

        await upsertTranscriptRecord(id, {
            student_consent: studentConsent,
            student_consent_at: isStudent ? new Date().toISOString() : existing?.student_consent_at,
            mentor_consent: mentorConsent,
            mentor_consent_at: isMentor ? new Date().toISOString() : existing?.mentor_consent_at,
            consent_confirmed: bothConsented
        });

        return res.json({
            success: true,
            booking_id: id,
            student_consent: studentConsent,
            mentor_consent: mentorConsent,
            both_consented: bothConsented,
            message: bothConsented
                ? "Both student and mentor have granted consent. Session recording is authorized."
                : `Consent recorded for ${isStudent ? "student" : "mentor"}. Waiting for ${isStudent ? "mentor" : "student"} to consent.`
        });
    } catch (err) {
        console.error("POST /bookings/:id/consent error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// POST /bookings/:id/audio (Upload audio and transcribe via Gnani.ai STT)
// ---------------------------------------------------------------------------
router.post("/:id/audio", authMiddleware, handleAudioUploadMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Validate booking ID format
        if (!isValidUUID(id)) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // 2. Fetch booking record
        const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .select("id, student_id, mentor_id, topic, date, time, status")
            .eq("id", id)
            .maybeSingle();

        if (bookingError) {
            console.error("Booking lookup error for audio upload:", bookingError);
            return res.status(500).json({ error: bookingError.message });
        }

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // 3. Strict Server-Side Authorization: only participant or admin
        const isStudent = booking.student_id === userId;
        const isMentor = booking.mentor_id === userId;
        const isAdmin = userRole === "admin";

        if (!isStudent && !isMentor && !isAdmin) {
            return res.status(403).json({
                error: "You are not authorized to upload audio for this session"
            });
        }

        // 4. Booking status validation: session must be confirmed or completed
        if (booking.status !== "confirmed" && booking.status !== "completed") {
            return res.status(400).json({
                error: `Cannot upload audio for a booking with status "${booking.status}". Only confirmed or completed sessions can be transcribed.`
            });
        }

        // 5. Uploader consent verification
        const uploaderConsent =
            req.body.consent === true ||
            req.body.consent === "true" ||
            req.body.consent_confirmed === true ||
            req.body.consent_confirmed === "true";

        if (!uploaderConsent && !isAdmin) {
            return res.status(400).json({
                error: "Participant consent is required prior to recording and transcription."
            });
        }

        // 6. Audio file presence validation
        if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                error: "Audio file is required (form-data field 'audio' or 'audio_file')"
            });
        }

        // 7. Audio Duration Validation (Gnani REST ceiling: 30 seconds)
        const detectedDuration = estimateAudioDuration(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );
        const clientDuration = req.body.duration ? parseFloat(req.body.duration) : null;
        const effectiveDuration = detectedDuration !== null ? detectedDuration : clientDuration;

        if (effectiveDuration !== null && effectiveDuration > MAX_AUDIO_DURATION_SECONDS) {
            return res.status(400).json({
                error: `Audio duration (${effectiveDuration}s) exceeds the maximum allowed limit of ${MAX_AUDIO_DURATION_SECONDS} seconds for instant transcription. Please provide an audio clip of 30 seconds or less. Longer sessions can be processed in a future batch release.`,
                duration: effectiveDuration
            });
        }

        // 8. Two-Party Consent Verification (Both Student and Mentor must consent)
        const existingTranscript = await getTranscriptRecord(id);

        const studentConsent = isStudent ? true : !!existingTranscript?.student_consent;
        const mentorConsent = isMentor ? true : !!existingTranscript?.mentor_consent;
        const bothConsented = (studentConsent && mentorConsent) || isAdmin;

        if (!bothConsented) {
            // Persist the uploader's consent so they do not need to repeat it
            await upsertTranscriptRecord(id, {
                student_consent: studentConsent,
                student_consent_at: isStudent ? new Date().toISOString() : existingTranscript?.student_consent_at,
                mentor_consent: mentorConsent,
                mentor_consent_at: isMentor ? new Date().toISOString() : existingTranscript?.mentor_consent_at,
                consent_confirmed: false
            });

            return res.status(400).json({
                error: "Two-party consent requirement not met. Both student and mentor must consent to session recording before transcription can proceed.",
                student_consent: studentConsent,
                mentor_consent: mentorConsent,
                missing_consent_from: !studentConsent ? "student" : "mentor"
            });
        }

        const isReupload = !!existingTranscript;

        // 9. Initialize transcript row in 'processing' state using upsert on booking_id
        await upsertTranscriptRecord(id, {
            status: "processing",
            error_message: null,
            audio_filename: req.file.originalname,
            audio_mimetype: req.file.mimetype,
            audio_size_bytes: req.file.size,
            audio_duration_seconds: effectiveDuration,
            student_consent: true,
            mentor_consent: true,
            consent_confirmed: true,
            uploaded_by: userId
        });

        // 10. Call Gnani STT service with audio buffer
        const languageCode = req.body.language_code || "indic-auto";
        const sttResult = await transcribeAudio({
            fileBuffer: req.file.buffer,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            languageCode,
            clientDuration: effectiveDuration
        });

        // 11. Handle Gnani STT API failure
        if (!sttResult.success) {
            await upsertTranscriptRecord(id, {
                status: "failed",
                error_message: sttResult.error || "Gnani transcription service failed"
            });

            return res.status(sttResult.statusCode || 502).json({
                success: false,
                booking_id: id,
                transcript_text: null,
                language: languageCode,
                status: "failed",
                error: sttResult.error || "Gnani transcription service failed"
            });
        }

        // 12. Handle Gnani STT success: save transcript and mark completed
        await upsertTranscriptRecord(id, {
            status: "completed",
            transcript_text: sttResult.transcript,
            language: sttResult.language || "en-IN",
            audio_duration_seconds: effectiveDuration,
            error_message: null
        });

        // If booking was confirmed, automatically transition it to completed
        if (booking.status === "confirmed") {
            await supabase
                .from("bookings")
                .update({ status: "completed" })
                .eq("id", id);
        }

        return res.status(200).json({
            success: true,
            booking_id: id,
            transcript_text: sttResult.transcript,
            language: sttResult.language || "en-IN",
            status: "completed",
            audio_duration_seconds: effectiveDuration,
            reupload: isReupload,
            processing_time: sttResult.processingTime || null,
            is_mock: !!sttResult.isMock
        });

    } catch (error) {
        console.error("POST /bookings/:id/audio unhandled error:", error);
        res.status(500).json({
            error: "Internal server error during audio processing"
        });
    }
});

// ---------------------------------------------------------------------------
// GET /bookings/:id/transcript (Retrieve transcript for participants/admin)
// ---------------------------------------------------------------------------
router.get("/:id/transcript", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Validate booking ID format
        if (!isValidUUID(id)) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // 2. Fetch booking to verify participant or admin authorization
        const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .select("id, student_id, mentor_id, topic, date, time, status")
            .eq("id", id)
            .maybeSingle();

        if (bookingError) {
            console.error("Booking lookup error for transcript fetch:", bookingError);
            return res.status(500).json({ error: bookingError.message });
        }

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // Strict Server-Side Authorization: only participant or admin
        const isStudent = booking.student_id === userId;
        const isMentor = booking.mentor_id === userId;
        const isAdmin = userRole === "admin";

        if (!isStudent && !isMentor && !isAdmin) {
            return res.status(403).json({
                error: "You are not authorized to access this session transcript"
            });
        }

        // 3. Fetch transcript from store
        const transcript = await getTranscriptRecord(id);

        if (!transcript) {
            return res.status(404).json({
                error: "No transcript found for this booking"
            });
        }

        return res.json({
            success: transcript.status === "completed",
            booking_id: transcript.booking_id,
            transcript_text: transcript.transcript_text,
            language: transcript.language,
            status: transcript.status,
            audio_duration_seconds: transcript.audio_duration_seconds || null,
            student_consent: transcript.student_consent || false,
            mentor_consent: transcript.mentor_consent || false,
            consent_confirmed: transcript.consent_confirmed || false,
            error_message: transcript.error_message || null,
            audio_filename: transcript.audio_filename || null,
            created_at: transcript.created_at || new Date().toISOString(),
            updated_at: transcript.updated_at || new Date().toISOString()
        });

    } catch (error) {
        console.error("GET /bookings/:id/transcript unhandled error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

export default router;
