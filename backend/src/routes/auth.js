import express from "express";
import { createClient } from "@supabase/supabase-js";
import supabase from "../config/supabase.js";

const router = express.Router();

const authClient = createClient(
    (process.env.SUPABASE_URL || "").trim(),
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

const getUserRole = user =>
    user?.user_metadata?.role || user?.app_metadata?.role || null;

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

        const { data, error } = await authClient.auth.signUp({
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
            role: getUserRole(data.user),
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

        const { data, error } = await authClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }

        // Retrieve authoritative user role from public.users database table
        const { data: userProfile } = await supabase
            .from("users")
            .select("role")
            .eq("id", data.user.id)
            .maybeSingle();

        const role = userProfile?.role || getUserRole(data.user) || "student";

        res.json({
            message: "Login successful",
            user: data.user,
            role,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});

export default router;