import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { fetchRecommendations } from "../services/aiService.js";

const router = express.Router();

/**
 * GET /recommendations
 *
 * Returns the top AI mentor recommendations for the currently
 * authenticated student.
 *
 * The student ID is taken from the verified Supabase session, never
 * from the request body or query string, so a caller cannot request
 * recommendations belonging to another user.
 *
 * The scoring itself is performed entirely by the AI service. This
 * route only forwards the request, attaches mentor names from the
 * existing users table, and reshapes the payload for the frontend.
 */
router.get("/", authMiddleware, async (req, res) => {
    const studentId = req.user.id;

    let result;

    try {
        result = await fetchRecommendations(studentId);
    } catch (error) {
        // Log the underlying AI service failure server-side only.
        console.error(
            "Recommendation service error:",
            error.message
        );

        return res.status(503).json({
            error:
                "Recommendations are temporarily unavailable. " +
                "Please try again shortly."
        });
    }

    const recommendations = Array.isArray(result?.recommendations)
        ? result.recommendations
        : [];

    if (recommendations.length === 0) {
        return res.json({
            recommendations: []
        });
    }

    // Attach mentor names from the existing users table.
    const mentorIds = recommendations.map(item => item.profile_id);

    let users = [];

    const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name")
        .in("id", mentorIds);

    if (userError) {
        console.error(
            "Recommendation name lookup error:",
            userError.message
        );
    } else {
        users = userData || [];
    }

    const mentors = recommendations.map(item => {
        const user = users.find(u => u.id === item.profile_id);

        return {
            mentor_id: item.profile_id,
            name: user?.name || null,
            mentor_type: item.mentor_type || null,
            skills: Array.isArray(item.skills) ? item.skills : [],
            experience: item.experience ?? null,
            organization: item.organization || null,
            bio: item.bio || null,
            verified: Boolean(item.verified),
            scores: {
                overall: item.final_score,
                semantic_similarity: item.semantic_similarity,
                goal_match: item.goal_match,
                experience: item.experience_score,
                rating: item.rating_score,
                availability: item.availability_score
            }
        };
    });

    res.json({
        recommendations: mentors
    });
});

export default router;