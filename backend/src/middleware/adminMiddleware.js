/**
 * Admin Authorization Middleware
 * 
 * Verifies that incoming requests:
 * 1. Bear a valid Supabase Auth JWT token (authentication).
 * 2. Belong to an authenticated user whose role in the TRUSTED database table
 *    (public.users) strictly equals 'admin'.
 * 
 * Security Guardrail:
 * Never trusts user-editable auth metadata (e.g. raw_user_meta_data->>'role')
 * or client-supplied headers. Access is granted ONLY via the database record.
 */

import supabase from "../config/supabase.js";

export const requireAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1];

        // 1. Authenticate JWT with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authData?.user) {
            return res.status(401).json({
                error: "Invalid or expired authorization token"
            });
        }

        const userId = authData.user.id;

        // 2. Query trusted public.users table for verified role
        const { data: userRecord, error: dbError } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("id", userId)
            .maybeSingle();

        if (dbError) {
            console.error("Database error verifying admin privileges:", dbError);
            return res.status(500).json({
                error: "Failed to verify administrative privileges"
            });
        }

        // 3. Strict role check against database table
        if (!userRecord || typeof userRecord.role !== "string" || userRecord.role.toLowerCase() !== "admin") {
            return res.status(403).json({
                error: "Access denied. Administrator privileges required."
            });
        }

        // 4. Attach verified user & admin profile to request
        req.user = {
            ...authData.user,
            ...userRecord,
            isAdmin: true
        };

        next();

    } catch (err) {
        console.error("requireAdmin unhandled exception:", err);
        return res.status(500).json({
            error: "Authentication service failure"
        });
    }
};

export default requireAdmin;

