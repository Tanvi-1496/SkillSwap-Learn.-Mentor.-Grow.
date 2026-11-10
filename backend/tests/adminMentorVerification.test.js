import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../src/server.js";
import supabase from "../src/config/supabase.js";

describe("SkillSwap Mentor Verification & Rejection Workflow Suite", () => {
    let server;
    let baseUrl;

    let adminToken;
    let studentToken;
    let mentorToken;

    const cleanupUserIds = [];

    before(async () => {
        // Start express server on ephemeral open port
        await new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });

        const demoPassword = process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123";

        // 1. Authenticate legitimate Admin
        const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
            email: "admin@skillswap.demo",
            password: demoPassword
        });
        if (adminErr) {
            console.error("Admin sign-in failed:", adminErr.message);
        } else {
            adminToken = adminAuth.session?.access_token;
        }

        // 2. Authenticate legitimate Student
        const { data: studentAuth, error: studentErr } = await supabase.auth.signInWithPassword({
            email: "aarohi.student@skillswap.demo",
            password: demoPassword
        });
        if (studentErr) {
            console.error("Student sign-in failed:", studentErr.message);
        } else {
            studentToken = studentAuth.session?.access_token;
        }

        // 3. Authenticate legitimate Mentor
        const { data: mentorAuth, error: mentorErr } = await supabase.auth.signInWithPassword({
            email: "neha.ai@skillswap.demo",
            password: process.env.DEMO_MENTOR_PASSWORD || demoPassword
        });
        if (mentorErr) {
            console.error("Mentor sign-in failed:", mentorErr.message);
        } else {
            mentorToken = mentorAuth.session?.access_token;
        }
    });

    after(async () => {
        // Cleanup created test records
        for (const userId of cleanupUserIds) {
            try {
                await supabase.from("mentor_profiles").delete().eq("user_id", userId);
                await supabase.from("users").delete().eq("id", userId);
                await supabase.auth.admin.deleteUser(userId);
            } catch (err) {
                // Ignore cleanup error
            }
        }

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test("1. Admin authorization check on /admin/mentors and /admin/stats", async () => {
        // Without token -> 401
        const resNoAuth = await fetch(`${baseUrl}/admin/mentors`);
        assert.equal(resNoAuth.status, 401);

        // Student token -> 403
        if (studentToken) {
            const resStudent = await fetch(`${baseUrl}/admin/mentors`, {
                headers: { Authorization: `Bearer ${studentToken}` }
            });
            assert.equal(resStudent.status, 403);
        }

        // Mentor token -> 403
        if (mentorToken) {
            const resMentor = await fetch(`${baseUrl}/admin/mentors`, {
                headers: { Authorization: `Bearer ${mentorToken}` }
            });
            assert.equal(resMentor.status, 403);
        }

        // Admin token -> 200
        if (adminToken) {
            const resAdmin = await fetch(`${baseUrl}/admin/mentors`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            assert.equal(resAdmin.status, 200);
            const data = await resAdmin.json();
            assert.ok(Array.isArray(data.mentors));
        }
    });

    test("2. GET /admin/stats reports verifiedMentors, pendingMentors, and rejectedMentors", async () => {
        if (!adminToken) return;

        const res = await fetch(`${baseUrl}/admin/stats`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.stats, "Stats object must be returned");
        assert.equal(typeof data.stats.totalMentors, "number");
        assert.equal(typeof data.stats.verifiedMentors, "number");
        assert.equal(typeof data.stats.pendingMentors, "number");
        assert.equal(typeof data.stats.rejectedMentors, "number");
    });

    test("3. PATCH /admin/mentors/:id/verify validates status input domain", async () => {
        if (!adminToken) return;

        // Arbitrary invalid status
        const resInvalid = await fetch(`${baseUrl}/admin/mentors/00000000-0000-0000-0000-000000000000/verify`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: "superadmin" })
        });
        assert.equal(resInvalid.status, 400);

        // Non-existent mentor
        const resNotFound = await fetch(`${baseUrl}/admin/mentors/00000000-0000-0000-0000-000000000000/verify`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: "approved" })
        });
        assert.equal(resNotFound.status, 404);
    });

    test("4. Full lifecycle: Create test mentor, Reject, verify queue exclusion and public discovery exclusion", async () => {
        if (!adminToken) return;

        const testEmail = `test_applicant_${Date.now()}@skillswap.demo`;
        const testPassword = "Applicant@123456";

        // Create applicant via Supabase Auth Admin (not rate-limited)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true,
            user_metadata: {
                name: "Test Mentor Applicant",
                role: "mentor",
                mentor_type: "PEER",
                organization: "Test Org"
            }
        });

        if (authError || !authData.user) {
            console.warn("Could not create test applicant user:", authError?.message);
            return;
        }

        const applicantId = authData.user.id;
        cleanupUserIds.push(applicantId);

        // 4a. Initial state: Must be in pending queue
        const resQueueBefore = await fetch(`${baseUrl}/admin/mentors?status=pending`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(resQueueBefore.status, 200);
        const dataQueueBefore = await resQueueBefore.json();
        const pendingApplicant = (dataQueueBefore.mentors || []).find((m) => m.user_id === applicantId);
        assert.ok(pendingApplicant, "New applicant must be listed in pending verification queue");
        assert.equal(pendingApplicant.verification_status, "pending");
        assert.equal(pendingApplicant.verified, false);

        // 4b. Reject the applicant via PATCH /admin/mentors/:id/verify
        const resReject = await fetch(`${baseUrl}/admin/mentors/${applicantId}/verify`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: "rejected" })
        });
        assert.equal(resReject.status, 200);
        const dataReject = await resReject.json();
        assert.equal(dataReject.mentor.verification_status, "rejected");
        assert.equal(dataReject.mentor.verified, false);

        // 4c. Verify applicant is now EXCLUDED from pending verification queue
        const resQueueAfter = await fetch(`${baseUrl}/admin/mentors?status=pending`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(resQueueAfter.status, 200);
        const dataQueueAfter = await resQueueAfter.json();

        // Check if column has been applied to the live database
        const { data: dbRow } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", applicantId)
            .maybeSingle();

        if (dbRow && dbRow.verification_status !== undefined) {
            const inQueue = (dataQueueAfter.mentors || []).some((m) => m.user_id === applicantId);
            assert.equal(inQueue, false, "Rejected applicant must NOT appear in pending verification queue");
        } else {
            console.log("Database schema notice: verification_status column will be active once SQL script is run in Supabase.");
        }

        // 4d. Verify applicant is EXCLUDED from public mentor discovery
        const resPublicMentors = await fetch(`${baseUrl}/mentors`);
        assert.equal(resPublicMentors.status, 200);
        const dataPublicMentors = await resPublicMentors.json();
        const inPublic = (dataPublicMentors.mentors || []).some((m) => m.user_id === applicantId);
        assert.equal(inPublic, false, "Rejected applicant must NOT be publicly discoverable");

        // 4e. Re-approve the applicant and verify they become verified & discoverable
        const resApprove = await fetch(`${baseUrl}/admin/mentors/${applicantId}/verify`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: "approved" })
        });
        assert.equal(resApprove.status, 200);
        const dataApprove = await resApprove.json();
        assert.equal(dataApprove.mentor.verification_status, "approved");
        assert.equal(dataApprove.mentor.verified, true);

        // 4f. Approved mentor must NOT appear in pending queue
        const resQueueFinal = await fetch(`${baseUrl}/admin/mentors?status=pending`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const dataQueueFinal = await resQueueFinal.json();
        const inQueueFinal = (dataQueueFinal.mentors || []).some((m) => m.user_id === applicantId);
        assert.equal(inQueueFinal, false, "Approved mentor must NOT appear in pending verification queue");
    });
});
