import express from "express";
import supabase from "../config/supabase.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { skill, type, rating } = req.query;

        const { data, error } = await supabase
            .from("mentor_profiles")
            .select("*");

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        let mentors = data;

        if (skill) {
            mentors = mentors.filter(mentor =>
                mentor.skills?.some(
                    s => s.toLowerCase() === skill.toLowerCase()
                )
            );
        }

        if (type) {
            mentors = mentors.filter(
                mentor =>
                    mentor.mentor_type?.toLowerCase() === type.toLowerCase()
            );
        }

        if (rating) {
            const minimumRating = Number(rating);

            const mentorIds = mentors.map(mentor => mentor.user_id);

            const { data: reviews, error: reviewError } = await supabase
                .from("reviews")
                .select("mentor_id, rating")
                .in("mentor_id", mentorIds);

            if (reviewError) {
                return res.status(500).json({
                    error: reviewError.message
                });
            }

            mentors = mentors.filter(mentor => {
                const mentorReviews = reviews.filter(
                    review => review.mentor_id === mentor.user_id
                );

                if (mentorReviews.length === 0) {
                    return false;
                }

                const average =
                    mentorReviews.reduce(
                        (sum, review) => sum + review.rating,
                        0
                    ) / mentorReviews.length;

                return average >= minimumRating;
            });
        }

        res.json({
            mentors
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});


router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", id)
            
           if (error) {
            console.log("MENTOR ERROR:", error);

            return res.status(500).json({
                error: error.message
            });
           }

    const mentor = data[0];
       const { data: user, error: userError } = await supabase
            .from("users")
            .select("name, email")
            .eq("id", id)
            .limit(1)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({
                error: userError.message
            });
        }

        // data.name = user.name;
        // data.email = user.email;
        mentor.name = user.name;
    `   mentor.email = user.email;


        res.json({
            mentor: data
        });

    } catch (error) {
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