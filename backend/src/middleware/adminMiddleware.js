import supabase from "../config/supabase.js";

/**
 * Admin authorization middleware.
 * 1. Authenticates the request via Supabase Auth token.
 * 2. Retrieves the authenticated user's ID.
 * 3. Looks up the user's role in the trusted public.users database table.
 * 4. Requires role === "admin".
 * 5. Returns 403 Forbidden for students, mentors, or any non-admin users.
 * 6. Never trusts any role supplied by the frontend client.
 */
const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authorization token required"
            });
        }

        const token = authHeader.split(" ")[1];

        // 1. Authenticate request using Supabase Auth (verifies JWT signature and expiry)
        const { data, error: authError } = await supabase.auth.getUser(token);

        if (authError || !data?.user) {
            return res.status(401).json({
                error: "Invalid or expired authorization token"
            });
        }

        const userId = data.user.id;

        // 2. Query public.users using backend service role client (trusted source of truth)
        const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("id, name, email, role, org, dept, phone")
            .eq("id", userId)
            .maybeSingle();

        if (profileError) {
            console.error("Error looking up user role for admin check:", profileError);
            return res.status(500).json({
                error: "Failed to verify admin status"
            });
        }

        // 3. Strict verification: role must strictly equal 'admin'
        if (!userProfile || userProfile.role !== "admin") {
            return res.status(403).json({
                error: "Access denied. Admin role required."
            });
        }

        // 4. Attach verified admin user record to request
        req.user = {
            ...data.user,
            ...userProfile
        };

        next();
    } catch (error) {
        console.error("adminMiddleware unexpected error:", error);
        res.status(500).json({
            error: "Authentication process failed"
        });
    }
};

export default adminMiddleware;
