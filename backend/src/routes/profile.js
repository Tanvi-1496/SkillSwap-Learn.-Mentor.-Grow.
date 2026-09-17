import express from "express";
import supabase from "../config/supabase.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("users")
            .select(`
                *,
                student_profiles (
                    semester
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
        res.status(500).json({
            error: "Server error"
        });
    }
});

router.put("/", authMiddleware, async (req, res) => {
    try {
        const {
            name,
            org,
            dept,
            phone
        } = req.body;

        const { data, error } = await supabase
            .from("users")
            .update({
                name,
                org,
                dept,
                phone
            })
            .eq("id", req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json({
            message: "Profile updated successfully",
            profile: data
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});

export default router;