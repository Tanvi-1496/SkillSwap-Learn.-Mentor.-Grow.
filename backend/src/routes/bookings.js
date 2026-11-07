import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

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

export default router;
