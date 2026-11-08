/**
 * Moderation Admin Routes
 * 
 * Endpoints:
 * - GET  /moderation/flags        - List safety flags (defaults to pending, supports filtering)
 * - GET  /moderation/flags/:id    - Flag details with context & moderation action audit log
 * - POST /moderation/flags/:id/action - Perform admin action (dismiss, warn, escalate) with reason
 * 
 * Access Control:
 * Strict server-side verification using requireAdmin middleware against public.users table.
 */

import express from "express";
import supabase from "../config/supabase.js";
import requireAdmin from "../middleware/adminMiddleware.js";

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
    return typeof str === "string" && UUID_REGEX.test(str.trim());
}

const ALLOWED_ACTIONS = ["dismiss", "warn", "escalate"];
const ACTION_TO_STATUS = {
    dismiss: "dismissed",
    warn: "warned",
    escalate: "escalated"
};

// -----------------------------------------------------------------------------
// GET /moderation/flags
// Lists flags with optional status, category, severity filtering
// -----------------------------------------------------------------------------
router.get("/flags", requireAdmin, async (req, res) => {
    try {
        const {
            status = "pending",
            category,
            severity,
            limit = 50,
            offset = 0
        } = req.query;

        let query = supabase
            .from("safety_flags")
            .select(`
                id,
                booking_id,
                student_id,
                mentor_id,
                category,
                severity,
                excerpt,
                confidence,
                status,
                created_at,
                reviewed_at
            `)
            .order("created_at", { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (status && status !== "all") {
            query = query.eq("status", status);
        }
        if (category) {
            query = query.eq("category", category);
        }
        if (severity) {
            query = query.eq("severity", severity);
        }

        const { data: flags, error } = await query;

        if (error) {
            console.error("Error retrieving safety flags:", error);
            return res.status(500).json({ error: error.message });
        }

        // Enrich flags with participant user names/emails where possible
        const userIds = [
            ...new Set(
                (flags || [])
                    .flatMap((f) => [f.student_id, f.mentor_id])
                    .filter((id) => id && isValidUUID(id))
            )
        ];

        let userMap = new Map();
        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from("users")
                .select("id, name, email")
                .in("id", userIds);

            if (users) {
                userMap = new Map(users.map((u) => [u.id, u]));
            }
        }

        const enrichedFlags = (flags || []).map((f) => ({
            ...f,
            student: userMap.get(f.student_id) || null,
            mentor: userMap.get(f.mentor_id) || null
        }));

        res.json({
            count: enrichedFlags.length,
            flags: enrichedFlags
        });

    } catch (err) {
        console.error("GET /moderation/flags unhandled error:", err);
        res.status(500).json({ error: "Internal server error retrieving moderation flags" });
    }
});

// -----------------------------------------------------------------------------
// GET /moderation/flags/:id
// Retrieves full flag details, session context, and moderation action audit log
// -----------------------------------------------------------------------------
router.get("/flags/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: "Invalid flag ID format" });
        }

        // 1. Fetch flag
        const { data: flag, error: flagErr } = await supabase
            .from("safety_flags")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (flagErr) {
            console.error("Error retrieving flag details:", flagErr);
            return res.status(500).json({ error: flagErr.message });
        }

        if (!flag) {
            return res.status(404).json({ error: "Safety flag not found" });
        }

        // 2. Fetch associated booking
        let booking = null;
        if (flag.booking_id) {
            const { data: bData } = await supabase
                .from("bookings")
                .select("id, student_id, mentor_id, topic, date, time, status")
                .eq("id", flag.booking_id)
                .maybeSingle();
            booking = bData;
        }

        // 3. Fetch participants
        let student = null;
        let mentor = null;
        const participantIds = [flag.student_id, flag.mentor_id].filter(Boolean);

        if (participantIds.length > 0) {
            const { data: users } = await supabase
                .from("users")
                .select("id, name, email, phone, role, org, dept")
                .in("id", participantIds);

            if (users) {
                student = users.find((u) => u.id === flag.student_id) || null;
                mentor = users.find((u) => u.id === flag.mentor_id) || null;
            }
        }

        // 4. Fetch moderation action audit log
        const { data: actions, error: actErr } = await supabase
            .from("moderation_actions")
            .select(`
                id,
                flag_id,
                admin_id,
                action,
                reason,
                created_at
            `)
            .eq("flag_id", id)
            .order("created_at", { ascending: false });

        if (actErr) {
            console.warn("Could not retrieve action history for flag:", actErr.message);
        }

        res.json({
            flag,
            booking,
            student,
            mentor,
            actions: actions || []
        });

    } catch (err) {
        console.error("GET /moderation/flags/:id unhandled error:", err);
        res.status(500).json({ error: "Internal server error retrieving flag details" });
    }
});

// -----------------------------------------------------------------------------
// POST /moderation/flags/:id/action
// Submits a human admin decision (dismiss, warn, escalate) with mandatory reason
// -----------------------------------------------------------------------------
router.post("/flags/:id/action", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body || {};

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: "Invalid flag ID format" });
        }

        // Validate action
        if (!action || typeof action !== "string" || !ALLOWED_ACTIONS.includes(action.toLowerCase())) {
            return res.status(400).json({
                error: `Invalid action. Must be one of: ${ALLOWED_ACTIONS.join(", ")}`
            });
        }

        const normalizedAction = action.toLowerCase();

        // Validate reason
        if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
            return res.status(400).json({
                error: "A valid explanation/reason of at least 3 characters is required"
            });
        }

        // Check flag existence
        const { data: flag, error: fetchErr } = await supabase
            .from("safety_flags")
            .select("id, status, booking_id")
            .eq("id", id)
            .maybeSingle();

        if (fetchErr) {
            return res.status(500).json({ error: fetchErr.message });
        }

        if (!flag) {
            return res.status(404).json({ error: "Safety flag not found" });
        }

        const newStatus = ACTION_TO_STATUS[normalizedAction];
        const reviewedAt = new Date().toISOString();

        // 1. Update safety flag record
        const { data: updatedFlag, error: updateErr } = await supabase
            .from("safety_flags")
            .update({
                status: newStatus,
                reviewed_at: reviewedAt
            })
            .eq("id", id)
            .select()
            .single();

        if (updateErr) {
            console.error("Error updating flag status:", updateErr);
            return res.status(500).json({ error: updateErr.message });
        }

        // 2. Insert into moderation_actions audit table
        const { data: newAction, error: insertErr } = await supabase
            .from("moderation_actions")
            .insert({
                flag_id: id,
                admin_id: req.user.id,
                action: normalizedAction,
                reason: reason.trim(),
                created_at: reviewedAt
            })
            .select()
            .single();

        if (insertErr) {
            console.error("Error logging moderation action audit record:", insertErr);
            return res.status(500).json({
                error: `Flag status updated, but failed to log audit record: ${insertErr.message}`
            });
        }

        res.json({
            message: `Moderation action '${normalizedAction}' successfully executed`,
            flag: updatedFlag,
            action: newAction
        });

    } catch (err) {
        console.error("POST /moderation/flags/:id/action unhandled error:", err);
        res.status(500).json({ error: "Internal server error executing moderation action" });
    }
});

export default router;

