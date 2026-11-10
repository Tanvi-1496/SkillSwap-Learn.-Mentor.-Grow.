
import supabase from "../config/supabase.js";

/**
 * Admin Authorization Middleware
 * Verifies Supabase JWT and trusted database role.
 */
export const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify Supabase Auth JWT.
        const { data: authData, error: authError } =
            await supabase.auth.getUser(token);

        if (authError || !authData?.user) {
            return res.status(401).json({
                error: "Invalid or expired authorization token"
            });
        }

        const userId = authData.user.id;

        // Check trusted database role.
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

// Support both named and default imports.
export const requireAdmin = adminMiddleware;
export default adminMiddleware;
