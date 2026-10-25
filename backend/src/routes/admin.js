import express from "express";
import supabase from "../config/supabase.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

// Enforce admin authentication & authorization on all /admin endpoints
router.use(adminMiddleware);

// ---------------------------------------------------------------------------
// PART 4: GET /admin/stats
// Return real platform statistics aggregated from the database
// ---------------------------------------------------------------------------
router.get("/stats", async (req, res) => {
    try {
        const [
            { count: totalStudents, error: errStudents },
            { count: totalMentors, error: errMentors },
            { count: verifiedMentors, error: errVerMentors },
            { count: pendingMentors, error: errPendMentors },
            { count: totalBookings, error: errBookings },
            { count: pendingBookings, error: errPendBookings },
            { count: confirmedBookings, error: errConfBookings },
            { count: completedBookings, error: errCompBookings },
            { count: cancelledBookings, error: errCancBookings }
        ] = await Promise.all([
            supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
            supabase.from("mentor_profiles").select("*", { count: "exact", head: true }),
            supabase.from("mentor_profiles").select("*", { count: "exact", head: true }).eq("verified", true),
            supabase.from("mentor_profiles").select("*", { count: "exact", head: true }).or("verified.is.null,verified.eq.false"),
            supabase.from("bookings").select("*", { count: "exact", head: true }),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "completed"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).in("status", ["cancelled", "declined"])
        ]);

        if (errStudents || errMentors || errVerMentors || errPendMentors || errBookings) {
            console.error("Error aggregating admin stats:", {
                errStudents,
                errMentors,
                errVerMentors,
                errPendMentors,
                errBookings
            });
            return res.status(500).json({ error: "Failed to calculate platform statistics" });
        }

        // Aggregate actual skills distribution from mentor_profiles
        const { data: mentorSkillsData, error: skillsError } = await supabase
            .from("mentor_profiles")
            .select("skills");

        const skillCounts = {};
        if (mentorSkillsData && !skillsError) {
            mentorSkillsData.forEach((m) => {
                if (Array.isArray(m.skills)) {
                    m.skills.forEach((skill) => {
                        const trimmed = typeof skill === "string" ? skill.trim() : "";
                        if (trimmed) {
                            skillCounts[trimmed] = (skillCounts[trimmed] || 0) + 1;
                        }
                    });
                }
            });
        }

        const topSkills = Object.entries(skillCounts)
            .map(([skill, count]) => ({ skill, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        res.json({
            stats: {
                totalStudents: totalStudents || 0,
                totalMentors: totalMentors || 0,
                verifiedMentors: verifiedMentors || 0,
                pendingMentors: pendingMentors || 0,
                totalBookings: totalBookings || 0,
                pendingBookings: pendingBookings || 0,
                confirmedBookings: confirmedBookings || 0,
                completedBookings: completedBookings || 0,
                cancelledBookings: cancelledBookings || 0,
                topSkills
            }
        });
    } catch (error) {
        console.error("GET /admin/stats error:", error);
        res.status(500).json({ error: "Internal server error fetching stats" });
    }
});

// ---------------------------------------------------------------------------
// PART 5: GET /admin/users
// Display real users from public.users with search/role filters
// ---------------------------------------------------------------------------
router.get("/users", async (req, res) => {
    try {
        const { role, search } = req.query;

        let query = supabase
            .from("users")
            .select("id, name, email, role, org, dept, phone");

        if (role && role !== "all") {
            query = query.eq("role", role);
        }

        if (search && search.trim()) {
            const term = search.trim();
            query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,org.ilike.%${term}%,dept.ilike.%${term}%`);
        }

        query = query.order("name", { ascending: true });

        const { data: users, error } = await query;

        if (error) {
            console.error("GET /admin/users query error:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ users: users || [] });
    } catch (error) {
        console.error("GET /admin/users error:", error);
        res.status(500).json({ error: "Internal server error fetching users" });
    }
});

// ---------------------------------------------------------------------------
// PART 6: GET /admin/mentors
// Display real mentor profiles enriched with public.users info
// ---------------------------------------------------------------------------
router.get("/mentors", async (req, res) => {
    try {
        const { verified } = req.query;

        let query = supabase
            .from("mentor_profiles")
            .select("user_id, mentor_type, skills, experience, bio, org, verified");

        if (verified === "true") {
            query = query.eq("verified", true);
        } else if (verified === "false") {
            query = query.or("verified.is.null,verified.eq.false");
        }

        const { data: mentors, error } = await query;

        if (error) {
            console.error("GET /admin/mentors error:", error);
            return res.status(500).json({ error: error.message });
        }

        if (!mentors || mentors.length === 0) {
            return res.json({ mentors: [] });
        }

        // Fetch corresponding user details from public.users table
        const userIds = mentors.map((m) => m.user_id).filter(Boolean);
        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, name, email, org, dept, phone")
            .in("id", userIds);

        if (usersError) {
            console.error("Error fetching users for mentors:", usersError);
        }

        const usersMap = new Map((usersData || []).map((u) => [u.id, u]));

        const enrichedMentors = mentors.map((m) => {
            const user = usersMap.get(m.user_id);
            return {
                ...m,
                name: user?.name || "Unknown Mentor",
                email: user?.email || "",
                phone: user?.phone || "",
                dept: user?.dept || "",
                org: m.org || user?.org || ""
            };
        });

        res.json({ mentors: enrichedMentors });
    } catch (error) {
        console.error("GET /admin/mentors error:", error);
        res.status(500).json({ error: "Internal server error fetching mentors" });
    }
});

// ---------------------------------------------------------------------------
// PART 7: PATCH /admin/mentors/:id/verify
// Approve or reject mentor verification status
// ---------------------------------------------------------------------------
router.patch("/mentors/:id/verify", async (req, res) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;

        if (typeof verified !== "boolean") {
            return res.status(400).json({
                error: "Invalid verified value. Must be a boolean (true or false)."
            });
        }

        // Verify that the mentor exists
        const { data: existing, error: checkError } = await supabase
            .from("mentor_profiles")
            .select("user_id")
            .eq("user_id", id)
            .maybeSingle();

        if (checkError) {
            console.error("Error finding mentor profile:", checkError);
            return res.status(500).json({ error: checkError.message });
        }

        if (!existing) {
            return res.status(404).json({ error: "Mentor profile not found" });
        }

        // Update verification status
        const { data: updated, error: updateError } = await supabase
            .from("mentor_profiles")
            .update({ verified })
            .eq("user_id", id)
            .select("user_id, mentor_type, skills, experience, bio, org, verified")
            .single();

        if (updateError) {
            console.error("Error updating mentor verification:", updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json({
            message: `Mentor verification updated to ${verified ? "verified" : "unverified"}`,
            mentor: updated
        });
    } catch (error) {
        console.error("PATCH /admin/mentors/:id/verify error:", error);
        res.status(500).json({ error: "Internal server error updating mentor verification" });
    }
});

// ---------------------------------------------------------------------------
// PART 8: GET /admin/bookings
// Display real platform-wide bookings enriched with users table
// ---------------------------------------------------------------------------
router.get("/bookings", async (req, res) => {
    try {
        const { status } = req.query;

        let query = supabase
            .from("bookings")
            .select("id, mentor_id, student_id, topic, date, time, status")
            .order("date", { ascending: false })
            .order("time", { ascending: false });

        if (status && status !== "all") {
            query = query.eq("status", status);
        }

        const { data: bookings, error } = await query;

        if (error) {
            console.error("GET /admin/bookings error:", error);
            return res.status(500).json({ error: error.message });
        }

        if (!bookings || bookings.length === 0) {
            return res.json({ bookings: [] });
        }

        // Collect distinct mentor and student IDs to resolve names and emails
        const userIds = [
            ...new Set([
                ...bookings.map((b) => b.mentor_id),
                ...bookings.map((b) => b.student_id)
            ].filter(Boolean))
        ];

        let usersMap = new Map();
        if (userIds.length > 0) {
            const { data: usersData, error: usersError } = await supabase
                .from("users")
                .select("id, name, email")
                .in("id", userIds);

            if (usersError) {
                console.error("Error fetching users for bookings:", usersError);
            } else if (usersData) {
                usersMap = new Map(usersData.map((u) => [u.id, u]));
            }
        }

        const enrichedBookings = bookings.map((b) => {
            const mentor = usersMap.get(b.mentor_id);
            const student = usersMap.get(b.student_id);
            return {
                ...b,
                mentor_name: mentor?.name || "Unknown Mentor",
                mentor_email: mentor?.email || "",
                student_name: student?.name || "Unknown Student",
                student_email: student?.email || ""
            };
        });

        res.json({ bookings: enrichedBookings });
    } catch (error) {
        console.error("GET /admin/bookings error:", error);
        res.status(500).json({ error: "Internal server error fetching bookings" });
    }
});

// ---------------------------------------------------------------------------
// PART 9: PATCH /admin/bookings/:id/status
// Admin override to update booking status
// Validated against the bookings_status_check constraint values
// ---------------------------------------------------------------------------
router.patch("/bookings/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["pending", "confirmed", "declined", "cancelled", "completed"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`
            });
        }

        // Check if booking exists
        const { data: existing, error: findError } = await supabase
            .from("bookings")
            .select("id, status")
            .eq("id", id)
            .maybeSingle();

        if (findError) {
            console.error("Error checking booking existence:", findError);
            return res.status(500).json({ error: findError.message });
        }

        if (!existing) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const { data: updated, error: updateError } = await supabase
            .from("bookings")
            .update({ status })
            .eq("id", id)
            .select("id, mentor_id, student_id, topic, date, time, status")
            .single();

        if (updateError) {
            console.error("Error updating booking status:", updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json({
            message: `Booking status updated to ${status}`,
            booking: updated
        });
    } catch (error) {
        console.error("PATCH /admin/bookings/:id/status error:", error);
        res.status(500).json({ error: "Internal server error updating booking status" });
    }
});

export default router;
