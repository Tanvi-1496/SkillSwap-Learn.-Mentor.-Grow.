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
 * 
 * Compatibility:
 * - Named export: requireAdmin (used by moderation.js)
 * - Named export: adminMiddleware (used by admin.js)
 * - Default export: adminMiddleware (compatible with default imports in both)
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

        // 1. Authenticate request using Supabase Auth (verifies JWT signature and expiry)
        const { data: authData, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authData?.user) {
            return res.status(401).json({
                error: "Invalid or expired authorization token"
            });
        }

        const userId = authData.user.id;

        // 2. Query trusted public.users table using canonical core columns (id, name, email, role)
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("id", userId)
            .maybeSingle();

        if (profileError) {
            console.error("Error looking up user role for admin check:", profileError);
            return res.status(500).json({
                error: "Failed to verify administrative privileges"
            });
        }

        // 3. Strict verification: role must strictly equal 'admin'
        if (!userProfile || typeof userProfile.role !== "string" || userProfile.role.toLowerCase() !== "admin") {
            return res.status(403).json({
                error: "Access denied. Administrator privileges required."
            });
        }

        // 4. Attach verified admin user record to request
        req.user = {
            ...authData.user,
            ...userProfile,
            role: "admin",
            isAdmin: true
        };

        next();
    } catch (error) {
        console.error("adminMiddleware unexpected error:", error);
        res.status(500).json({
            error: "Authentication process failed"
        });
    }
};

// Aliased named export for moderation.js
export const requireAdmin = adminMiddleware;

// Default export compatible with both `import adminMiddleware` and `import requireAdmin`
export default adminMiddleware;
