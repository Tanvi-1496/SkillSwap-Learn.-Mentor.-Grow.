/**
 * Admin Authorization Middleware
 *
 * Verifies:
 * 1. Valid Supabase Auth JWT.
 * 2. User's role from trusted public.users table.
 * 3. Strict admin authorization.
 *
 * Never trusts client-supplied roles or user-editable metadata.
 */

import supabase from "../config/supabase.js";

export const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify the Supabase Auth JWT.
        const { data: authData, error: authError } =
            await supabase.auth.getUser(token);

        if (authError || !authData?.user) {
            return res.status(401).json({
                error: "Invalid or expired authorization token"
            });
        }

        const userId = authData.user.id;

        // Check the trusted database role.
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("id", userId)
            .maybeSingle();

        if (profileError) {
            console.error("Admin role lookup error:", profileError);
            return res.status(500).json({
                error: "Failed to verify administrative privileges"
            });
        }

        if (
            !userProfile ||
            typeof userProfile.role !== "string" ||
            userProfile.role.toLowerCase() !== "admin"
        ) {
            return res.status(403).json({
                error: "Access denied. Administrator privileges required."
            });
        }

        req.user = {
            ...authData.user,
            ...userProfile,
            role: "admin",
            isAdmin: true
        };

        next();
    } catch (error) {
        console.error("adminMiddleware unexpected error:", error);

        return res.status(500).json({
            error: "Authentication process failed"
        });
    }
};

// Compatibility for moderation.js
export const requireAdmin = adminMiddleware;

// Default export for admin.js
export default adminMiddleware;