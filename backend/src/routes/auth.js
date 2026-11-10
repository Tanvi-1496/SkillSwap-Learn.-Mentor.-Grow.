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

const getUserRole = (user) =>
    user?.user_metadata?.role || user?.app_metadata?.role || null;

const ALLOWED_PUBLIC_ROLES = new Set(["student", "mentor"]);

const extractBearerToken = (req) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string") return null;
    const parts = authHeader.trim().split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        return parts[1].trim();
    }
    return null;
};

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

        // Strict role validation: public registration whitelist (student & mentor only)
        let validatedRole = "student";
        if (role !== undefined && role !== null) {
            if (typeof role !== "string") {
                return res.status(400).json({
                    error: "Invalid role. Role must be a string: 'student' or 'mentor'."
                });
            }
            const trimmedRole = role.trim();
            if (!trimmedRole) {
                return res.status(400).json({
                    error: "Invalid role. Role cannot be empty."
                });
            }
            const normalizedRole = trimmedRole.toLowerCase();
            if (!ALLOWED_PUBLIC_ROLES.has(normalizedRole)) {
                return res.status(400).json({
                    error: `Invalid registration role '${role}'. Public self-registration is only allowed for 'student' or 'mentor'.`
                });
            }
            validatedRole = normalizedRole;
        }

        const { data, error } = await authClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role: validatedRole,
                    org,
                    dept,
                    phone,
                    semester,
                    mentor_type: mentorType,
                    experience,
                    organization,
                    onboarding_completed: true
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
            role: validatedRole,
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

        let role = "student";
        if (userProfile?.role) {
            role = userProfile.role.toLowerCase();
        } else {
            // Strictly guard against untrusted user_metadata granting 'admin'
            const fallbackRole = getUserRole(data.user);
            if (typeof fallbackRole === "string") {
                const lower = fallbackRole.toLowerCase().trim();
                if (lower === "mentor" || lower === "student") {
                    role = lower;
                }
            }
        }

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

router.get("/me", async (req, res) => {
    try {
        const token = extractBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: "Missing or invalid authorization header" });
        }

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
            return res.status(401).json({ error: "Invalid or expired session token" });
        }

        // Fetch authoritative profile from public.users
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("id, name, email, role, org, dept, phone")
            .eq("id", authUser.id)
            .maybeSingle();

        if (dbError) {
            return res.status(500).json({ error: "Failed to load user profile" });
        }

        const authoritativeRole = (dbUser?.role || "student").toLowerCase().trim();

        const isOAuth = authUser.app_metadata?.provider === "google" ||
            (Array.isArray(authUser.app_metadata?.providers) && authUser.app_metadata.providers.includes("google"));
        const metadataOnboarded = authUser.user_metadata?.onboarding_completed === true;
        const profilePopulated = Boolean(dbUser?.org && (authoritativeRole === "mentor" || dbUser?.dept));
        const isAdmin = authoritativeRole === "admin";

        const needsOnboarding = isOAuth && !metadataOnboarded && !profilePopulated && !isAdmin;

        res.json({
            user: authUser,
            role: authoritativeRole,
            needsOnboarding,
            profile: dbUser
        });
    } catch (error) {
        console.error("GET /auth/me error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

const handleOnboarding = async (req, res) => {
    try {
        const token = extractBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: "Missing or invalid authorization header" });
        }

        // 1. Verify token with Supabase Auth
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
            return res.status(401).json({ error: "Invalid or expired session token" });
        }

        const {
            role,
            name,
            org,
            dept,
            phone,
            semester,
            mentorType,
            experience,
            organization
        } = req.body;

        // 2. Strict role validation: Whitelist student & mentor only
        if (!role || typeof role !== "string") {
            return res.status(400).json({
                error: "Invalid role. Role must be specified as 'student' or 'mentor'."
            });
        }

        const normalizedRole = role.toLowerCase().trim();
        let validatedRole = normalizedRole;
        if (normalizedRole === "mentee") {
            validatedRole = "student";
        }

        if (!ALLOWED_PUBLIC_ROLES.has(validatedRole)) {
            return res.status(400).json({
                error: `Invalid onboarding role '${role}'. Public self-onboarding is only allowed for 'student' or 'mentor'.`
            });
        }

        // 3. Inspect existing database record for this user
        const { data: existingUser } = await supabase
            .from("users")
            .select("id, name, email, role, org, dept, phone")
            .eq("id", authUser.id)
            .maybeSingle();

        // Never permit admin accounts to be onboarded or modified
        if (existingUser?.role === "admin") {
            return res.status(403).json({
                error: "Admin accounts cannot be onboarded or modified through this endpoint."
            });
        }

        // 4. Sanitize profile fields
        const sanitizedName = typeof name === "string" && name.trim()
            ? name.trim()
            : authUser.user_metadata?.full_name || authUser.user_metadata?.name || existingUser?.name || "";

        const sanitizedOrg = typeof org === "string" && org.trim()
            ? org.trim()
            : (typeof organization === "string" ? organization.trim() : "");
        const sanitizedDept = typeof dept === "string" ? dept.trim() : "";
        const sanitizedPhone = typeof phone === "string" ? phone.trim() : "";

        // 5. Update public.users
        const { error: userUpdateError } = await supabase
            .from("users")
            .upsert({
                id: authUser.id,
                name: sanitizedName,
                email: authUser.email,
                role: validatedRole,
                org: sanitizedOrg,
                dept: sanitizedDept,
                phone: sanitizedPhone
            }, { onConflict: "id" });

        if (userUpdateError) {
            console.error("Failed to update public.users during onboarding:", userUpdateError);
            return res.status(500).json({ error: "Failed to update user profile" });
        }

        // 6. Provision role-specific profile
        if (validatedRole === "student") {
            let parsedSemester = null;
            if (semester !== undefined && semester !== null) {
                const sStr = String(semester).trim();
                if (/^[0-9]{1,4}$/.test(sStr)) {
                    parsedSemester = parseInt(sStr, 10);
                }
            }

            const { error: spError } = await supabase
                .from("student_profiles")
                .upsert({
                    user_id: authUser.id,
                    semester: parsedSemester
                }, { onConflict: "user_id" });

            if (spError) {
                console.error("Failed to upsert student_profiles:", spError);
            }
        } else if (validatedRole === "mentor") {
            let parsedExperience = null;
            if (experience !== undefined && experience !== null) {
                const expStr = String(experience).trim();
                if (/^[0-9]{1,4}$/.test(expStr)) {
                    parsedExperience = parseInt(expStr, 10);
                }
            }

            const sanitizedMentorType = typeof mentorType === "string" && mentorType.trim()
                ? mentorType.trim()
                : "PEER";

            const mentorPayload = {
                user_id: authUser.id,
                mentor_type: sanitizedMentorType,
                experience: parsedExperience,
                org: sanitizedOrg,
                verified: false
            };

            let mpError = null;
            const resPrimary = await supabase
                .from("mentor_profiles")
                .upsert({
                    ...mentorPayload,
                    verification_status: "pending"
                }, { onConflict: "user_id" });

            if (resPrimary.error && (resPrimary.error.code === "PGRST204" || resPrimary.error.code === "42703")) {
                const resFallback = await supabase
                    .from("mentor_profiles")
                    .upsert(mentorPayload, { onConflict: "user_id" });
                mpError = resFallback.error;
            } else {
                mpError = resPrimary.error;
            }

            if (mpError) {
                console.error("Failed to upsert mentor_profiles:", mpError);
            }

            // Ensure student profile semester is cleared if present
            try {
                await supabase.from("student_profiles").update({ semester: null }).eq("user_id", authUser.id);
            } catch (e) {
                // Ignore harmless cleanup error
            }
        }

        // 7. Mark onboarding completed in Supabase Auth metadata
        try {
            await supabase.auth.admin.updateUserById(authUser.id, {
                user_metadata: {
                    ...authUser.user_metadata,
                    role: validatedRole,
                    onboarding_completed: true
                }
            });
        } catch (metaErr) {
            console.warn("Could not update auth metadata onboarding flag:", metaErr.message);
        }

        return res.status(200).json({
            message: "Onboarding completed successfully",
            user: {
                id: authUser.id,
                email: authUser.email,
                name: sanitizedName
            },
            role: validatedRole
        });
    } catch (error) {
        console.error("Onboarding error:", error);
        return res.status(500).json({ error: "Server error during onboarding" });
    }
};

router.post("/google/onboard", handleOnboarding);
router.post("/oauth/onboard", handleOnboarding);

export default router;
