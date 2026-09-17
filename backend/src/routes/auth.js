import express from "express";
import supabase from "../config/supabase.js";

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const {
            email,
            password,
            name,
            role,
            org,
            dept,
            phone,
            semester,
            mentorType,
            experience,
            organization
        } = req.body;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role,
                    org,
                    dept,
                    phone,
                    semester,
                    mentor_type: mentorType,
                    experience,
                    organization
                }
            }
        });

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.status(201).json({
            message: "Registration successful",
            user: data.user,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});


router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }

        res.json({
            message: "Login successful",
            user: data.user,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});

export default router;