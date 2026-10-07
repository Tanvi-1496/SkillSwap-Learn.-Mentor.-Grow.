import express from "express";
import supabase from "../config/supabase.js";

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
            .select("name, email")
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

        // Calculate average rating
        const averageRating =
            reviews.length > 0
                ? reviews.reduce((sum, review) => sum + review.rating, 0) /
                  reviews.length
                : 0;

        const mentor = {
            ...mentorProfile,
            name: user?.name || "Mentor",
            email: user?.email || "",
            availability: availability || [],
            reviews: reviews || [],
            averageRating: Number(averageRating.toFixed(1)),
            reviewCount: reviews?.length || 0
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