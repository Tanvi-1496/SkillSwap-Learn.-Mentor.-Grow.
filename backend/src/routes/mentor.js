import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { generateProfileEmbedding } from "../services/aiService.js";

function buildMentorEmbeddingText(mentor) {
    return `
Name: ${mentor.name || ""}.
Skills: ${(mentor.skills || []).join(", ")}.
Mentor type: ${mentor.mentor_type || ""}.
Experience: ${mentor.experience ?? 0} years.
Organization: ${mentor.org || ""}.
Department: ${mentor.dept || ""}.
Bio: ${mentor.bio || ""}.
`.trim();
}

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { skill, type, rating } = req.query;

        // Get mentor profiles
        const { data: mentorProfiles, error } = await supabase
            .from("mentor_profiles")
            .select("*");

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        const mentorIds = mentorProfiles.map(mentor => mentor.user_id);

        // Get mentor names
        const { data: users, error: userError } = await supabase
            .from("users")
            .select("id, name")
            .in("id", mentorIds);

        if (userError) {
            return res.status(500).json({
                error: userError.message
            });
        }

        // Get reviews for all mentors
        const { data: reviews, error: reviewError } = await supabase
            .from("reviews")
            .select("mentor_id, rating")
            .in("mentor_id", mentorIds);

        if (reviewError) {
            return res.status(500).json({
                error: reviewError.message
            });
        }

        // Get availability for all mentors
        const { data: availability, error: availabilityError } =
            await supabase
                .from("availability")
                .select("mentor_id, day, slots")
                .in("mentor_id", mentorIds);

        if (availabilityError) {
            return res.status(500).json({
                error: availabilityError.message
            });
        }

        // Get booking/session counts
        const { data: bookings, error: bookingError } =
            await supabase
                .from("bookings")
                .select("mentor_id")
                .in("mentor_id", mentorIds);

        if (bookingError) {
            return res.status(500).json({
                error: bookingError.message
            });
        }

        let mentors = mentorProfiles.map(mentor => {

            const user = users.find(
                u => u.id === mentor.user_id
            );

            const mentorReviews = reviews.filter(
                review => review.mentor_id === mentor.user_id
            );

            const mentorAvailability = availability.filter(
                item => item.mentor_id === mentor.user_id
            );

            const mentorBookings = bookings.filter(
                booking => booking.mentor_id === mentor.user_id
            );

            const averageRating =
                mentorReviews.length > 0
                    ? mentorReviews.reduce(
                        (sum, review) => sum + review.rating,
                        0
                    ) / mentorReviews.length
                    : 0;

            return {
                ...mentor,
                name: user?.name || "Mentor",
                rating: Number(averageRating.toFixed(1)),
                reviewCount: mentorReviews.length,
                sessions: mentorBookings.length,
                availability: mentorAvailability
            };
        });

        // Skill filter
        if (skill) {
            mentors = mentors.filter(mentor =>
                mentor.skills?.some(
                    s => s.toLowerCase() === skill.toLowerCase()
                )
            );
        }

        // Type filter
        if (type) {
            mentors = mentors.filter(
                mentor =>
                    mentor.mentor_type?.toLowerCase() ===
                    type.toLowerCase()
            );
        }

        // Rating filter
        if (rating) {
            const minimumRating = Number(rating);

            mentors = mentors.filter(
                mentor => mentor.rating >= minimumRating
            );
        }

        res.json({
            mentors
        });

    } catch (error) {
        console.error("Mentor listing error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

const ALLOWED_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

// ---------------------------------------------------------------------------
// GET /mentors/me (Get profile and availability for authenticated mentor)
// ---------------------------------------------------------------------------
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const { data: mentorProfile, error: profileError } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", mentorId)
            .maybeSingle();

        if (profileError) {
            console.error("Mentor profile fetch error:", profileError);
            return res.status(500).json({ error: profileError.message });
        }

        if (!mentorProfile) {
            return res.status(404).json({
                error: "Mentor profile not found"
            });
        }

        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, name, email, org, dept")
            .eq("id", mentorId)
            .maybeSingle();

        if (userError) {
            console.error("User lookup error:", userError);
            return res.status(500).json({ error: userError.message });
        }

        const { data: availability, error: availError } = await supabase
            .from("availability")
            .select("day, slots")
            .eq("mentor_id", mentorId);

        if (availError) {
            console.error("Availability lookup error:", availError);
            return res.status(500).json({ error: availError.message });
        }

        res.json({
            profile: {
                ...mentorProfile,
                name: user?.name || "Mentor",
                email: user?.email || "",
                org: user?.org || mentorProfile.org || "",
                dept: user?.dept || ""
            },
            availability: availability || []
        });

    } catch (error) {
        console.error("GET /mentors/me error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// GET /mentors/me/skills (Get skills for authenticated mentor)
// ---------------------------------------------------------------------------
router.get("/me/skills", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const { data: mentorProfile, error: profileError } = await supabase
            .from("mentor_profiles")
            .select("skills")
            .eq("user_id", mentorId)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({ error: profileError.message });
        }

        if (!mentorProfile) {
            return res.status(404).json({ error: "Mentor profile not found" });
        }

        res.json({
            skills: mentorProfile.skills || []
        });

    } catch (error) {
        console.error("GET /mentors/me/skills error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// PUT /mentors/me/skills (Update skills for authenticated mentor)
// ---------------------------------------------------------------------------
router.put("/me/skills", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { skills } = req.body;

        if (!Array.isArray(skills)) {
            return res.status(400).json({
                error: "skills must be an array of strings"
            });
        }

        // Verify mentor profile exists
        const { data: mentorProfile, error: profileError } = await supabase
            .from("mentor_profiles")
            .select("user_id")
            .eq("user_id", mentorId)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({ error: profileError.message });
        }

        if (!mentorProfile) {
            return res.status(403).json({
                error: "You are not authorized to update mentor skills"
            });
        }

        // Clean, trim, and deduplicate skills (case-insensitive deduplication)
        const seen = new Set();
        const cleanedSkills = [];
        for (const s of skills) {
            if (typeof s === "string") {
                const trimmed = s.trim();
                const lower = trimmed.toLowerCase();
                if (trimmed && !seen.has(lower)) {
                    seen.add(lower);
                    cleanedSkills.push(trimmed);
                }
            }
        }

        const { data: updated, error: updateError } = await supabase
            .from("mentor_profiles")
            .update({ skills: cleanedSkills })
            .eq("user_id", mentorId)
            .select("user_id, skills")
            .single();

        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }

        // Regenerate mentor SBERT embedding for matching
        let embeddingSynced = false;
        try {
            const { data: fullProfile } = await supabase
                .from("mentor_profiles")
                .select("mentor_type, experience, bio, org")
                .eq("user_id", mentorId)
                .maybeSingle();

            const { data: user } = await supabase
                .from("users")
                .select("name, dept")
                .eq("id", mentorId)
                .maybeSingle();

            const embeddingText = buildMentorEmbeddingText({
                name: user?.name,
                skills: updated.skills,
                mentor_type: fullProfile?.mentor_type,
                experience: fullProfile?.experience,
                org: fullProfile?.org,
                dept: user?.dept,
                bio: fullProfile?.bio
            });

            await generateProfileEmbedding(mentorId, "mentor", embeddingText);
            embeddingSynced = true;
            console.log(`Mentor embedding refreshed successfully for ${mentorId}`);
        } catch (aiError) {
            console.error("Mentor embedding refresh error:", aiError.message);
        }

        res.json({
            message: "Skills updated successfully",
            skills: updated.skills,
            embeddingSynced
        });

    } catch (error) {
        console.error("PUT /mentors/me/skills error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// PUT /mentors/me (Update profile details and regenerate embedding)
// ---------------------------------------------------------------------------
router.put("/me", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { mentor_type, skills, experience, bio, org } = req.body;

        // Verify mentor exists in mentor_profiles
        const { data: mentorProfile, error: profileError } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", mentorId)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({ error: profileError.message });
        }

        if (!mentorProfile) {
            return res.status(404).json({ error: "Mentor profile not found" });
        }

        const updates = {};
        if (mentor_type !== undefined) updates.mentor_type = mentor_type;
        if (experience !== undefined) updates.experience = Number(experience);
        if (bio !== undefined) updates.bio = bio;
        if (org !== undefined) updates.org = org;
        if (Array.isArray(skills)) {
            const seen = new Set();
            const cleaned = [];
            for (const s of skills) {
                if (typeof s === "string") {
                    const trimmed = s.trim();
                    const lower = trimmed.toLowerCase();
                    if (trimmed && !seen.has(lower)) {
                        seen.add(lower);
                        cleaned.push(trimmed);
                    }
                }
            }
            updates.skills = cleaned;
        }

        const { data: updated, error: updateError } = await supabase
            .from("mentor_profiles")
            .update(updates)
            .eq("user_id", mentorId)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }

        // Fetch user info for name & dept
        const { data: user } = await supabase
            .from("users")
            .select("name, dept")
            .eq("id", mentorId)
            .maybeSingle();

        let embeddingSynced = false;
        try {
            const embeddingText = buildMentorEmbeddingText({
                name: user?.name,
                skills: updated.skills,
                mentor_type: updated.mentor_type,
                experience: updated.experience,
                org: updated.org,
                dept: user?.dept,
                bio: updated.bio
            });

            await generateProfileEmbedding(mentorId, "mentor", embeddingText);
            embeddingSynced = true;
            console.log(`Mentor embedding updated successfully for ${mentorId}`);
        } catch (aiError) {
            console.error("Mentor embedding refresh error:", aiError.message);
        }

        res.json({
            message: "Mentor profile updated successfully",
            profile: updated,
            embeddingSynced
        });

    } catch (error) {
        console.error("PUT /mentors/me error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// GET /mentors/me/availability (Get availability for authenticated mentor)
// ---------------------------------------------------------------------------
router.get("/me/availability", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const { data: availability, error: availError } = await supabase
            .from("availability")
            .select("day, slots")
            .eq("mentor_id", mentorId);

        if (availError) {
            return res.status(500).json({ error: availError.message });
        }

        res.json({
            availability: availability || []
        });

    } catch (error) {
        console.error("GET /mentors/me/availability error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------------------------
// PUT /mentors/me/availability (Save availability for authenticated mentor)
// Handles single day { day, slots } OR multi-day schedule { schedule: [{ day, slots }] }
// Strictly performs existence check followed by UPDATE or INSERT (no upsert)
// ---------------------------------------------------------------------------
router.put("/me/availability", authMiddleware, async (req, res) => {
    try {
        const mentorId = req.user.id;

        // Verify mentor exists in mentor_profiles
        const { data: mentorProfile, error: profileError } = await supabase
            .from("mentor_profiles")
            .select("user_id")
            .eq("user_id", mentorId)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({ error: profileError.message });
        }

        if (!mentorProfile) {
            return res.status(403).json({
                error: "You are not authorized to update mentor availability"
            });
        }

        // Normalize incoming data to an array of day items
        let dayItems = [];
        if (Array.isArray(req.body.schedule)) {
            dayItems = req.body.schedule;
        } else if (Array.isArray(req.body.availability)) {
            dayItems = req.body.availability;
        } else if (req.body.day) {
            dayItems = [{ day: req.body.day, slots: req.body.slots }];
        } else {
            return res.status(400).json({
                error: "Please provide either a day with slots or a schedule array"
            });
        }

        // Validate all days upfront
        for (const item of dayItems) {
            if (!item || !ALLOWED_DAYS.includes(item.day)) {
                return res.status(400).json({
                    error: `Invalid day "${item?.day}". Must be one of: ${ALLOWED_DAYS.join(", ")}`
                });
            }
        }

        // Process each day: check if exists, then UPDATE or INSERT
        for (const item of dayItems) {
            const day = item.day;
            const slots = Array.isArray(item.slots) ? item.slots : [];

            // 1. Check whether a row already exists for (mentor_id, day)
            const { data: existingRows, error: checkError } = await supabase
                .from("availability")
                .select("mentor_id, day")
                .eq("mentor_id", mentorId)
                .eq("day", day);

            if (checkError) {
                console.error("Availability existence check error:", checkError);
                return res.status(500).json({ error: checkError.message });
            }

            // 2. UPDATE existing row or INSERT new row
            if (existingRows && existingRows.length > 0) {
                const { error: updateError } = await supabase
                    .from("availability")
                    .update({ slots })
                    .eq("mentor_id", mentorId)
                    .eq("day", day);

                if (updateError) {
                    console.error("Availability update error:", updateError);
                    return res.status(500).json({ error: updateError.message });
                }
            } else {
                const { error: insertError } = await supabase
                    .from("availability")
                    .insert({
                        mentor_id: mentorId,
                        day,
                        slots
                    });

                if (insertError) {
                    console.error("Availability insert error:", insertError);
                    return res.status(500).json({ error: insertError.message });
                }
            }
        }

        // Fetch refreshed availability to return in standard format
        const { data: refreshed, error: refreshError } = await supabase
            .from("availability")
            .select("day, slots")
            .eq("mentor_id", mentorId);

        if (refreshError) {
            return res.status(500).json({ error: refreshError.message });
        }

        res.json({
            message: "Availability saved successfully",
            availability: refreshed || []
        });

    } catch (error) {
        console.error("PUT /mentors/me/availability error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Get mentor profile
        const { data: mentorProfile, error: mentorError } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", id)
            .maybeSingle();

        if (mentorError) {
            console.log("MENTOR ERROR:", mentorError);

            return res.status(500).json({
                error: mentorError.message
            });
        }

        if (!mentorProfile) {
            return res.status(404).json({
                error: "Mentor not found"
            });
        }

        // Get mentor user information
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("name, email, org")
            .eq("id", id)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({
                error: userError.message
            });
        }

        // Get mentor availability
        const { data: availability, error: availabilityError } =
            await supabase
                .from("availability")
                .select("day, slots")
                .eq("mentor_id", id);

        if (availabilityError) {
            return res.status(500).json({
                error: availabilityError.message
            });
        }

        // Get mentor reviews
        const { data: reviews, error: reviewsError } =
            await supabase
                .from("reviews")
                .select("id, student_id, rating, text")
                .eq("mentor_id", id)
                .order("id", { ascending: false });

        if (reviewsError) {
            return res.status(500).json({
                error: reviewsError.message
            });
        }

        // Enrich reviews with reviewer student name
        let enrichedReviews = reviews || [];
        if (reviews && reviews.length > 0) {
            const studentIds = [...new Set(reviews.map((r) => r.student_id).filter(Boolean))];
            if (studentIds.length > 0) {
                const { data: studentUsers } = await supabase
                    .from("users")
                    .select("id, name")
                    .in("id", studentIds);

                if (studentUsers) {
                    const studentMap = new Map(studentUsers.map((u) => [u.id, u.name]));
                    enrichedReviews = reviews.map((r) => ({
                        ...r,
                        student_name: studentMap.get(r.student_id) || "Student"
                    }));
                }
            }
        }

        // Calculate average rating
        const averageRating =
            enrichedReviews.length > 0
                ? enrichedReviews.reduce((sum, review) => sum + review.rating, 0) /
                  enrichedReviews.length
                : 0;

        const mentor = {
            ...mentorProfile,
            name: user?.name || "Mentor",
            email: user?.email || "",
            org: mentorProfile.org || user?.org || "",
            availability: availability || [],
            reviews: enrichedReviews,
            averageRating: Number(averageRating.toFixed(1)),
            reviewCount: enrichedReviews.length
        };

        res.json({
            mentor
        });

    } catch (error) {
        console.error("Mentor profile error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

router.get("/test", (req, res) => {
    res.json({
        message: "Mentor route is working"
    });
});
export default router;