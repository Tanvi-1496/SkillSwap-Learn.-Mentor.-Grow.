import { generateProfileEmbedding } from "../services/aiService.js";
import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getUserSupabase(req) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
        throw new Error("Missing authorization token");
    }

    return createClient(
        (process.env.SUPABASE_URL || "").trim(),
        (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim(),
        {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        }
    );
};

router.get("/", authMiddleware, async (req, res) => {
    try {
        const userSupabase = getUserSupabase(req);

        const { data, error } = await userSupabase
            .from("users")
            .select(`
                *,
                student_profiles (
                    semester,
                    skills,
                    career_goal,
                    learning_requirement,
                    level
                )
            `)
            .eq("id", req.user.id)
            .single();

        if (error) {
            return res.status(404).json({
                error: "Profile not found"
            });
        }

        res.json({
            profile: data
        });

    } catch (error) {
        console.error("Profile fetch error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

router.put("/", authMiddleware, async (req, res) => {
    try {
        const userSupabase = getUserSupabase(req);

        const {
            department,
            semester,
            skills,
            careerGoal,
            learningRequirement,
            level,
            phone,
            name
        } = req.body;

        // 1. Update basic user information
        const userUpdates = {};
        if (department !== undefined) userUpdates.dept = department;
        if (phone !== undefined) userUpdates.phone = phone;
        if (name !== undefined) userUpdates.name = name;

        let user = null;
        if (Object.keys(userUpdates).length > 0) {
            const { data: updatedUser, error: userError } =
                await userSupabase
                    .from("users")
                    .update(userUpdates)
                    .eq("id", req.user.id)
                    .select()
                    .single();

            if (userError) {
                return res.status(400).json({
                    error: userError.message
                });
            }
            user = updatedUser;
        } else {
            const { data: currentUser } = await userSupabase
                .from("users")
                .select("*")
                .eq("id", req.user.id)
                .single();
            user = currentUser;
        }

        // 2. Check whether student profile already exists
        const { data: existingProfile, error: profileCheckError } =
            await userSupabase
                .from("student_profiles")
                .select("user_id")
                .eq("user_id", req.user.id)
                .maybeSingle();

        if (profileCheckError) {
            return res.status(500).json({
                error: profileCheckError.message
            });
        }

        let studentProfile;

        // 3. Update existing student profile
        if (existingProfile) {
            const { data, error } =
                await userSupabase
                    .from("student_profiles")
                    .update({
                        skills: skills || [],
                        career_goal: careerGoal || "",
                        learning_requirement: learningRequirement || "",
                        level: level || "",
                        semester: semester
                            ? Number(semester)
                            : null
                    })
                    .eq("user_id", req.user.id)
                    .select()
                    .single();

            if (error) {
                return res.status(400).json({
                    error: error.message
                });
            }

            studentProfile = data;
        }

        // 4. Create student profile if it doesn't exist
        else {
            const { data, error } =
                await userSupabase
                    .from("student_profiles")
                    .insert({
                        user_id: req.user.id,
                        skills: skills || [],
                        career_goal: careerGoal || "",
                        learning_requirement:
                            learningRequirement || "",
                        level: level || "",
                        semester: semester
                            ? Number(semester)
                            : null
                    })
                    .select()
                    .single();

            if (error) {
                return res.status(400).json({
                    error: error.message
                });
            }

            studentProfile = data;
        }

        // 5. Create text for SBERT embedding
        const embeddingText = `
Skills: ${(studentProfile.skills || []).join(", ")}.
Career goal: ${studentProfile.career_goal || ""}.
Learning requirement: ${studentProfile.learning_requirement || ""}.
Level: ${studentProfile.level || ""}.
Semester: ${studentProfile.semester || ""}.
        `.trim();

        // 6. Generate/update AI embedding
        try {
            await generateProfileEmbedding(
                req.user.id,
                "student",
                embeddingText
            );

            console.log(
                "Student embedding updated successfully"
            );
        } catch (aiError) {
            console.error(
                "AI embedding error:",
                aiError.message
            );
        }

        // 7. Send response
        res.json({
            message: "Profile updated successfully",
            profile: {
                ...user,
                student_profile: studentProfile
            }
        });

    } catch (error) {
        console.error("Profile update error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

export default router;