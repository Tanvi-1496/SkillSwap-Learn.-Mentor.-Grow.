import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /reviews/eligible
 * Returns completed bookings for the authenticated student,
 * enriched with mentor information and existing review status.
 */
router.get("/eligible", authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.id;

        // 1. Fetch completed bookings for this student
        const { data: bookings, error: bookingsError } = await supabase
            .from("bookings")
            .select("id, mentor_id, topic, date, time, status")
            .eq("student_id", studentId)
            .eq("status", "completed")
            .order("date", { ascending: false });

        if (bookingsError) {
            console.error("Error fetching completed bookings:", bookingsError);
            return res.status(500).json({ error: bookingsError.message });
        }

        if (!bookings || bookings.length === 0) {
            return res.json({ sessions: [] });
        }

        // 2. Fetch mentor user info and profiles
        const mentorIds = [...new Set(bookings.map((b) => b.mentor_id).filter(Boolean))];

        let usersMap = new Map();
        let mentorProfilesMap = new Map();

        if (mentorIds.length > 0) {
            const [
                { data: usersData, error: usersErr },
                { data: mentorProfilesData, error: mpErr }
            ] = await Promise.all([
                supabase.from("users").select("id, name, email, org, dept").in("id", mentorIds),
                supabase.from("mentor_profiles").select("user_id, mentor_type, org, verified").in("user_id", mentorIds)
            ]);

            if (!usersErr && usersData) {
                usersMap = new Map(usersData.map((u) => [u.id, u]));
            }
            if (!mpErr && mentorProfilesData) {
                mentorProfilesMap = new Map(mentorProfilesData.map((m) => [m.user_id, m]));
            }
        }

        // 3. Fetch existing reviews submitted by this student
        const { data: existingReviews, error: reviewsError } = await supabase
            .from("reviews")
            .select("id, mentor_id, rating, text")
            .eq("student_id", studentId);

        if (reviewsError) {
            console.error("Error fetching existing reviews:", reviewsError);
        }

        const reviewsMap = new Map((existingReviews || []).map((r) => [r.mentor_id, r]));

        // 4. Combine into sessions list for Feedback UI
        const sessions = bookings.map((b) => {
            const user = usersMap.get(b.mentor_id);
            const mProfile = mentorProfilesMap.get(b.mentor_id);
            const review = reviewsMap.get(b.mentor_id);

            return {
                id: b.id,
                booking_id: b.id,
                mentor_id: b.mentor_id,
                mentor_name: user?.name || "Mentor",
                mentor_email: user?.email || "",
                mentor_type: mProfile?.mentor_type || "Mentor",
                mentor_org: mProfile?.org || user?.org || "",
                mentor_verified: Boolean(mProfile?.verified),
                topic: b.topic,
                date: b.date,
                time: b.time,
                status: b.status,
                has_reviewed: Boolean(review),
                review: review
                    ? {
                          id: review.id,
                          rating: review.rating,
                          text: review.text
                      }
                    : null,
                rating: review ? review.rating : null,
                comment: review ? review.text : "",
                text: review ? review.text : ""
            };
        });

        res.json({ sessions });
    } catch (error) {
        console.error("GET /reviews/eligible error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /reviews
 * Submits feedback and star rating for a mentor after a completed session.
 * Enforces student identity from token, completed booking relationship,
 * and prevents duplicate reviews.
 */
router.post("/", authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { mentor_id, rating, text, booking_id } = req.body;

        // 1. Validation
        if (!mentor_id) {
            return res.status(400).json({ error: "mentor_id is required" });
        }

        const numericRating = Number(rating);
        if (!numericRating || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                error: "Rating is required and must be an integer between 1 and 5"
            });
        }

        const trimmedText = typeof text === "string" ? text.trim() : "";
        if (!trimmedText || trimmedText.length < 3) {
            return res.status(400).json({
                error: "Review feedback must be at least 3 characters long"
            });
        }

        if (trimmedText.length > 1000) {
            return res.status(400).json({
                error: "Review feedback cannot exceed 1000 characters"
            });
        }

        // Prevent reviewing self
        if (mentor_id === studentId) {
            return res.status(400).json({
                error: "You cannot review yourself"
            });
        }

        // 2. Authorization check: Student must have an eligible completed booking with this mentor
        let bookingCheckQuery = supabase
            .from("bookings")
            .select("id, student_id, mentor_id, status")
            .eq("student_id", studentId)
            .eq("mentor_id", mentor_id)
            .eq("status", "completed");

        if (booking_id) {
            bookingCheckQuery = bookingCheckQuery.eq("id", booking_id);
        }

        const { data: completedBookings, error: bookingCheckErr } = await bookingCheckQuery.limit(1);

        if (bookingCheckErr) {
            console.error("Booking verification error:", bookingCheckErr);
            return res.status(500).json({ error: "Failed to verify session completion" });
        }

        if (!completedBookings || completedBookings.length === 0) {
            return res.status(403).json({
                error: "You can only review mentors for completed mentorship sessions."
            });
        }

        // 3. Duplicate check: Has this student already reviewed this mentor?
        const { data: existingReview, error: existingErr } = await supabase
            .from("reviews")
            .select("id, rating, text")
            .eq("student_id", studentId)
            .eq("mentor_id", mentor_id)
            .maybeSingle();

        if (existingErr) {
            console.error("Duplicate review check error:", existingErr);
            return res.status(500).json({ error: existingErr.message });
        }

        if (existingReview) {
            return res.status(409).json({
                error: "You have already submitted feedback for this mentor.",
                review: existingReview
            });
        }

        // 4. Insert into reviews table
        const { data: inserted, error: insertError } = await supabase
            .from("reviews")
            .insert([
                {
                    mentor_id,
                    student_id: studentId,
                    rating: Math.round(numericRating),
                    text: trimmedText
                }
            ])
            .select("id, mentor_id, student_id, rating, text")
            .single();

        if (insertError) {
            console.error("Review insert error:", insertError);
            return res.status(500).json({ error: insertError.message });
        }

        res.status(201).json({
            message: "Feedback submitted successfully! Thank you for rating your mentor.",
            review: inserted
        });
    } catch (error) {
        console.error("POST /reviews error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /reviews/my
 * Returns all reviews submitted by the authenticated student
 */
router.get("/my", authMiddleware, async (req, res) => {
    try {
        const studentId = req.user.id;

        const { data: reviews, error } = await supabase
            .from("reviews")
            .select("id, mentor_id, rating, text")
            .eq("student_id", studentId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ reviews: reviews || [] });
    } catch (error) {
        console.error("GET /reviews/my error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
