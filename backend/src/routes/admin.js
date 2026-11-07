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
            { data: allMentors, error: errMentors },
            { count: totalBookings, error: errBookings },
            { count: pendingBookings, error: errPendBookings },
            { count: confirmedBookings, error: errConfBookings },
            { count: completedBookings, error: errCompBookings },
            { count: cancelledBookings, error: errCancBookings }
        ] = await Promise.all([
            supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
            supabase.from("mentor_profiles").select("*"),
            supabase.from("bookings").select("*", { count: "exact", head: true }),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "completed"),
            supabase.from("bookings").select("*", { count: "exact", head: true }).in("status", ["cancelled", "declined"])
        ]);

        if (errStudents || errMentors || errBookings) {
            console.error("Error aggregating admin stats:", {
                errStudents,
                errMentors,
                errBookings
            });
            return res.status(500).json({ error: "Failed to calculate platform statistics" });
        }

        // Aggregate mentor verification statuses and skills distribution
        let verifiedMentors = 0;
        let pendingMentors = 0;
        let rejectedMentors = 0;
        const skillCounts = {};

        (allMentors || []).forEach((m) => {
            const status = m.verification_status || (m.verified ? "approved" : "pending");
            if (status === "approved") {
                verifiedMentors++;
            } else if (status === "rejected") {
                rejectedMentors++;
            } else {
                pendingMentors++;
            }

            if (Array.isArray(m.skills)) {
                m.skills.forEach((skill) => {
                    const trimmed = String(skill).trim();
                    if (trimmed) {
                        skillCounts[trimmed] = (skillCounts[trimmed] || 0) + 1;
                    }
                });
            }
        });

        const topSkills = Object.entries(skillCounts)
            .map(([skill, count]) => ({ skill, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        res.json({
            stats: {
                totalStudents: totalStudents || 0,
                totalMentors: (allMentors || []).length,
                verifiedMentors,
                pendingMentors,
                rejectedMentors,
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
        res.status(500).json({ error: "Internal server error fetching admin stats" });
    }
});

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
        const { verified, status } = req.query;

        // Use select("*") so it succeeds whether verification_status is already deployed or pending
        let { data: mentors, error } = await supabase
            .from("mentor_profiles")
            .select("*");

        if (error) {
            console.error("GET /admin/mentors error:", error);
            return res.status(500).json({ error: error.message });
        }

        if (!mentors || mentors.length === 0) {
            return res.json({ mentors: [] });
        }

        // Enrich with user names from public.users table
        const userIds = mentors.map((m) => m.user_id).filter(Boolean);
        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, name, email, org, dept, phone")
            .in("id", userIds);

        if (usersError) {
            console.error("Error fetching users for mentors:", usersError);
        }

        const usersMap = new Map((usersData || []).map((u) => [u.id, u]));

        let enrichedMentors = mentors.map((m) => {
            const user = usersMap.get(m.user_id);
            const resolvedStatus = m.verification_status || (m.verified ? "approved" : "pending");
            return {
                ...m,
                verification_status: resolvedStatus,
                verified: resolvedStatus === "approved",
                name: user?.name || "Unknown Mentor",
                email: user?.email || "",
                phone: user?.phone || "",
                dept: user?.dept || "",
                org: m.org || user?.org || ""
            };
        });

        // Filter by status or verified
        if (status) {
            const s = String(status).toLowerCase().trim();
            if (["pending", "approved", "rejected"].includes(s)) {
                enrichedMentors = enrichedMentors.filter((m) => m.verification_status === s);
            }
        } else if (verified === "true") {
            enrichedMentors = enrichedMentors.filter((m) => m.verification_status === "approved");
        } else if (verified === "false") {
            enrichedMentors = enrichedMentors.filter((m) => m.verification_status === "pending");
        }

        res.json({ mentors: enrichedMentors });
    } catch (error) {
        console.error("GET /admin/mentors error:", error);
        res.status(500).json({ error: "Internal server error fetching mentors" });
    }
});

// PART 7: PATCH /admin/mentors/:id/verify
// Approve or reject mentor verification status
// ---------------------------------------------------------------------------
router.patch("/mentors/:id/verify", async (req, res) => {
    try {
        const { id } = req.params;
        const { verified, status } = req.body;

        let targetStatus;
        if (typeof status === "string") {
            const s = status.toLowerCase().trim();
            if (!["approved", "rejected", "pending"].includes(s)) {
                return res.status(400).json({
                    error: "Invalid status value. Must be 'approved', 'rejected', or 'pending'."
                });
            }
            targetStatus = s;
        } else if (typeof verified === "boolean") {
            targetStatus = verified ? "approved" : "rejected";
        } else {
            return res.status(400).json({
                error: "Missing or invalid verification status. Provide status ('approved' | 'rejected') or verified (boolean)."
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
        const isVerified = targetStatus === "approved";
        let updated;
        let updateError;

        // Try updating both verification_status and verified
        const resPrimary = await supabase
            .from("mentor_profiles")
            .update({
                verification_status: targetStatus,
                verified: isVerified
            })
            .eq("user_id", id)
            .select("*")
            .single();

        if (resPrimary.error && (resPrimary.error.code === "42703" || resPrimary.error.code === "PGRST204")) {
            // Column does not exist yet (pre-migration) -> fallback to verified boolean
            const resFallback = await supabase
                .from("mentor_profiles")
                .update({ verified: isVerified })
                .eq("user_id", id)
                .select("*")
                .single();
            updated = resFallback.data;
            updateError = resFallback.error;
        } else {
            updated = resPrimary.data;
            updateError = resPrimary.error;
        }

        if (updateError) {
            console.error("Error updating mentor verification:", updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json({
            message: `Mentor verification updated to ${targetStatus}`,
            mentor: {
                ...updated,
                verification_status: targetStatus,
                verified: isVerified
            }
        });
    } catch (error) {
        console.error("PATCH /admin/mentors/:id/verify error:", error);
        res.status(500).json({ error: "Internal server error updating mentor verification" });
    }
});

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
