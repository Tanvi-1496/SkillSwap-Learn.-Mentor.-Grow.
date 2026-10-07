import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Normalizes any time string (e.g. "5:00 PM", "17:00") into canonical
 * PostgreSQL TIME WITHOUT TIME ZONE format: "HH:MM:SS" (24-hour).
 */
function normalizeTimeTo24h(timeStr) {
    if (!timeStr) return timeStr;
    const trimmed = String(timeStr).trim();

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

    return trimmed;
}

// ---------------------------------------------------------------------------
// PHASE 1: POST /bookings (Create a booking)
// ---------------------------------------------------------------------------
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { mentor_id, topic, date, time } = req.body;

        // 1. Derive student_id securely from authenticated user
        const student_id = req.user.id;

        // 2. Validate all required fields
        if (!mentor_id || !topic || !date || !time) {
            return res.status(400).json({
                error: "mentor_id, topic, date and time are required"
            });
        }

        // Prevent booking oneself
        if (mentor_id === student_id) {
            return res.status(400).json({
                error: "You cannot book a mentorship session with yourself"
            });
        }

        // Normalize time to standard PostgreSQL TIME format (HH:MM:SS)
        const normalizedTime = normalizeTimeTo24h(time);

        // 3. Conflict detection: check whether the mentor already has an active booking
        // Treat "pending" and "confirmed" bookings as conflicting
        const { data: conflicts, error: conflictError } = await supabase
            .from("bookings")
            .select("id, status")
            .eq("mentor_id", mentor_id)
            .eq("date", date)
            .eq("time", normalizedTime)
            .in("status", ["pending", "confirmed"]);

        if (conflictError) {
            console.error("Booking conflict check error:", conflictError);
            return res.status(500).json({
                error: "Failed to verify slot availability"
            });
        }

        if (conflicts && conflicts.length > 0) {
            return res.status(409).json({
                error: "This time slot is no longer available. Please choose another time."
            });
        }

        // 4. Insert booking (only using verified database columns)
        const { data, error } = await supabase
            .from("bookings")
            .insert([
                {
                    mentor_id,
                    student_id,
                    topic,
                    date,
                    time: normalizedTime,
                    status: "pending"
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Booking insert error:", error);
            return res.status(500).json({
                error: error.message
            });
        }

        res.status(201).json({
            message: "Booking created successfully",
            booking: data
        });

    } catch (error) {
        console.error("Booking route POST error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

// ---------------------------------------------------------------------------
// PHASE 2: GET /bookings (List bookings for the authenticated user)
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
// PHASE 3: PATCH /bookings/:id (Update booking status)
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

        // 1. Fetch the existing booking
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

        // 3. Update the booking status
        const { data: updatedBooking, error: updateError } = await supabase
            .from("bookings")
            .update({ status })
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