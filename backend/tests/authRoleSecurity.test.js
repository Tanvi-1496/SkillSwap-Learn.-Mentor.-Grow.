import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../src/server.js";
import supabase from "../src/config/supabase.js";

describe("SkillSwap Admin Self-Registration Privilege Escalation Security Suite", () => {
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

        // 3. Authenticate legitimate Mentor (Neha AI)
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
        // Clean up any ephemeral test accounts created during registration tests
        for (const uid of cleanupUserIds) {
            try {
                await supabase.from("student_profiles").delete().eq("user_id", uid);
                await supabase.from("mentor_profiles").delete().eq("user_id", uid);
                await supabase.from("users").delete().eq("id", uid);
                await supabase.auth.admin.deleteUser(uid);
            } catch (cleanupErr) {
                console.error("Cleanup error for user:", uid, cleanupErr.message);
            }
        }

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    // -------------------------------------------------------------------------
    // TEST 1: role="admin" is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("1. Reject registration with role='admin' with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.admin1@test.com",
                password: "Password123!",
                name: "Attacker Admin",
                role: "admin"
            })
        });

        assert.equal(res.status, 400, "Must reject role='admin' with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /invalid.*role/i, "Error message must indicate invalid registration role");
    });

    // -------------------------------------------------------------------------
    // TEST 2: role="Admin" (capitalized) is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("2. Reject registration with role='Admin' (title case) with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.admin2@test.com",
                password: "Password123!",
                name: "Attacker Admin",
                role: "Admin"
            })
        });

        assert.equal(res.status, 400, "Must reject role='Admin' with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /invalid.*role/i);
    });

    // -------------------------------------------------------------------------
    // TEST 3: role="ADMIN" (uppercase) is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("3. Reject registration with role='ADMIN' (uppercase) with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.admin3@test.com",
                password: "Password123!",
                name: "Attacker Admin",
                role: "ADMIN"
            })
        });

        assert.equal(res.status, 400, "Must reject role='ADMIN' with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /invalid.*role/i);
    });

    // -------------------------------------------------------------------------
    // TEST 4: role="superuser" is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("4. Reject registration with role='superuser' with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.superuser@test.com",
                password: "Password123!",
                name: "Attacker Superuser",
                role: "superuser"
            })
        });

        assert.equal(res.status, 400, "Must reject role='superuser' with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /invalid.*role/i);
    });

    // -------------------------------------------------------------------------
    // TEST 5: role="" (empty string) is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("5. Reject registration with empty string role='' with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.empty@test.com",
                password: "Password123!",
                name: "Attacker Empty",
                role: ""
            })
        });

        assert.equal(res.status, 400, "Must reject empty role with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /invalid.*role|empty/i);
    });

    // -------------------------------------------------------------------------
    // TEST 6: non-string role is rejected with HTTP 400
    // -------------------------------------------------------------------------
    test("6. Reject registration with non-string role with HTTP 400", async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "exploit.number@test.com",
                password: "Password123!",
                name: "Attacker Number",
                role: 12345
            })
        });

        assert.equal(res.status, 400, "Must reject non-string role with HTTP 400");
        const body = await res.json();
        assert.ok(body.error, "Must return an error message");
        assert.match(body.error, /string/i);
    });

    // -------------------------------------------------------------------------
    // TEST 7: role="student" is accepted by validation
    // -------------------------------------------------------------------------
    test("7. Legitimate registration with role='student' passes role validation", async () => {
        const testEmail = `test.student.${Date.now()}@ephemeral-test.internal`;
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: "ValidPassword123!",
                name: "Legit Student Test",
                role: "student",
                org: "Test College",
                dept: "CS",
                semester: "5"
            })
        });

        const body = await res.json();
        if (res.status === 201) {
            assert.equal(body.role, "student", "Response contract must return role='student'");
            if (body.user?.id) cleanupUserIds.push(body.user.id);
        } else {
            // If Supabase cloud email rate limit is triggered, confirm that role validation PASSED
            assert.doesNotMatch(body.error || "", /invalid.*role/i, "Role validation must not reject 'student'");
            assert.match(body.error || "", /rate limit|email/i, "Rejection must only be from provider email limits");
        }
    });

    // -------------------------------------------------------------------------
    // TEST 8: role="mentor" is accepted by validation
    // -------------------------------------------------------------------------
    test("8. Legitimate registration with role='mentor' passes role validation", async () => {
        const testEmail = `test.mentor.${Date.now()}@ephemeral-test.internal`;
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: "ValidPassword123!",
                name: "Legit Mentor Test",
                role: "mentor",
                org: "Industry Org",
                dept: "Engineering",
                mentorType: "Industry Professional",
                experience: "4"
            })
        });

        const body = await res.json();
        if (res.status === 201) {
            assert.equal(body.role, "mentor", "Response contract must return role='mentor'");
            if (body.user?.id) cleanupUserIds.push(body.user.id);
        } else {
            // If Supabase cloud email rate limit is triggered, confirm that role validation PASSED
            assert.doesNotMatch(body.error || "", /invalid.*role/i, "Role validation must not reject 'mentor'");
            assert.match(body.error || "", /rate limit|email/i, "Rejection must only be from provider email limits");
        }
    });

    // -------------------------------------------------------------------------
    // TEST 9: missing role safely defaults to "student"
    // -------------------------------------------------------------------------
    test("9. Missing role safely defaults to 'student' in validation", async () => {
        const testEmail = `test.default.${Date.now()}@ephemeral-test.internal`;
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: "ValidPassword123!",
                name: "Legit Default Test"
                // role is omitted
            })
        });

        const body = await res.json();
        if (res.status === 201) {
            assert.equal(body.role, "student", "Omitted role must safely default to 'student'");
            if (body.user?.id) cleanupUserIds.push(body.user.id);
        } else {
            assert.doesNotMatch(body.error || "", /invalid.*role/i, "Missing role must not fail role validation");
            assert.match(body.error || "", /rate limit|email/i, "Rejection must only be from provider email limits");
        }
    });

    // -------------------------------------------------------------------------
    // TEST 10: Student and Mentor cannot access admin endpoints (HTTP 403)
    // -------------------------------------------------------------------------
    test("10. Student and Mentor cannot access admin endpoints (HTTP 403 Forbidden)", async () => {
        assert.ok(studentToken, "Student token must be available");
        assert.ok(mentorToken, "Mentor token must be available");

        // Attempt as Student
        const studentRes = await fetch(`${baseUrl}/admin/stats`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(studentRes.status, 403, "Student must be rejected from /admin/stats with HTTP 403");

        // Attempt as Mentor
        const mentorRes = await fetch(`${baseUrl}/admin/stats`, {
            headers: { Authorization: `Bearer ${mentorToken}` }
        });
        assert.equal(mentorRes.status, 403, "Mentor must be rejected from /admin/stats with HTTP 403");
    });

    // -------------------------------------------------------------------------
    // TEST 11: A legitimately provisioned Admin retains admin access (HTTP 200)
    // -------------------------------------------------------------------------
    test("11. Legitimate Admin retains access to admin endpoints (HTTP 200)", async () => {
        assert.ok(adminToken, "Admin token must be available");

        const adminRes = await fetch(`${baseUrl}/admin/stats`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(adminRes.status, 200, "Legitimate Admin must access /admin/stats with HTTP 200");
        const body = await adminRes.json();
        assert.ok(body.stats, "Admin stats payload must be returned");
    });

    // -------------------------------------------------------------------------
    // TEST 12: OAuth / client metadata containing role="admin" cannot grant admin privileges
    // -------------------------------------------------------------------------
    test("12. Client-controlled metadata claiming role='admin' cannot bypass adminMiddleware", async () => {
        assert.ok(studentToken, "Student token must be available");

        // Student's public.users.role is 'student'. Even if client passes headers or metadata claims,
        // adminMiddleware queries public.users and enforces public.users.role === 'admin'
        const fakeAdminRes = await fetch(`${baseUrl}/admin/users`, {
            headers: {
                Authorization: `Bearer ${studentToken}`,
                "X-User-Role": "admin"
            }
        });

        assert.equal(fakeAdminRes.status, 403, "Tampered client role cannot bypass admin authorization");
    });
});
