import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../src/server.js";
import supabase from "../src/config/supabase.js";

describe("SkillSwap Google OAuth & Onboarding Security Suite", () => {
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
        // Clean up ephemeral test accounts
        for (const uid of cleanupUserIds) {
            try {
                await supabase.from("student_profiles").delete().eq("user_id", uid);
                await supabase.from("mentor_profiles").delete().eq("user_id", uid);
                await supabase.from("users").delete().eq("id", uid);
                await supabase.auth.admin.deleteUser(uid);
            } catch (err) {
                console.warn("Cleanup error for user", uid, err.message);
            }
        }

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    // Helper to create an ephemeral OAuth user
    async function createEphemeralOAuthUser(metadata = {}) {
        const uniqueEmail = `test.oauth.${Date.now()}.${Math.floor(Math.random() * 10000)}@ephemeral.internal`;
        const tempPassword = "TestPassword123!";

        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: uniqueEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name: "OAuth Test User",
                ...metadata
            },
            app_metadata: {
                provider: "google",
                providers: ["google"]
            }
        });

        if (createErr) {
            throw new Error(`Failed to create ephemeral OAuth user: ${createErr.message}`);
        }

        cleanupUserIds.push(created.user.id);

        const { data: signedIn, error: signErr } = await supabase.auth.signInWithPassword({
            email: uniqueEmail,
            password: tempPassword
        });

        if (signErr) {
            throw new Error(`Failed to sign in ephemeral OAuth user: ${signErr.message}`);
        }

        return {
            user: created.user,
            token: signedIn.session.access_token
        };
    }

    // -------------------------------------------------------------
    // 1. GET /auth/me authentication & status tests
    // -------------------------------------------------------------

    test("1. GET /auth/me rejects requests without token with HTTP 401", async () => {
        const res = await fetch(`${baseUrl}/auth/me`);
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.match(body.error, /authorization header/i);
    });

    test("2. GET /auth/me rejects invalid / spoofed token with HTTP 401", async () => {
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { Authorization: "Bearer invalid.jwt.token" }
        });
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.match(body.error, /invalid or expired/i);
    });

    test("3. GET /auth/me returns authoritative admin role and needsOnboarding=false", async () => {
        assert.ok(adminToken, "Admin token must be available");
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.role, "admin");
        assert.equal(body.needsOnboarding, false);
    });

    test("4. GET /auth/me returns authoritative student role and needsOnboarding=false for existing student", async () => {
        assert.ok(studentToken, "Student token must be available");
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.role, "student");
        assert.equal(body.needsOnboarding, false);
    });

    test("5. GET /auth/me returns authoritative mentor role and needsOnboarding=false for existing mentor", async () => {
        assert.ok(mentorToken, "Mentor token must be available");
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${mentorToken}` }
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.role, "mentor");
        assert.equal(body.needsOnboarding, false);
    });

    // -------------------------------------------------------------
    // 2. Security & Privilege Escalation Prevention in Onboarding
    // -------------------------------------------------------------

    test("6. POST /auth/google/onboard rejects unauthenticated requests with HTTP 401", async () => {
        const res = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "student" })
        });
        assert.equal(res.status, 401);
    });

    test("7. POST /auth/google/onboard rejects role='admin' with HTTP 400", async () => {
        const { token } = await createEphemeralOAuthUser();
        const res = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                role: "admin",
                org: "Test College"
            })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.match(body.error, /invalid.*role/i);
    });

    test("8. POST /auth/google/onboard rejects role='Admin' (titlecase) and role='superuser' with HTTP 400", async () => {
        const { token } = await createEphemeralOAuthUser();
        for (const badRole of ["Admin", "ADMIN", "superuser", ""]) {
            const res = await fetch(`${baseUrl}/auth/google/onboard`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ role: badRole })
            });
            assert.equal(res.status, 400, `Expected 400 for role '${badRole}'`);
        }
    });

    test("9. POST /auth/google/onboard rejects attempts to modify existing admin accounts (HTTP 403)", async () => {
        assert.ok(adminToken, "Admin token must be available");
        const res = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                role: "student",
                org: "Hacker Org"
            })
        });
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.match(body.error, /admin accounts cannot be onboarded/i);
    });

    // -------------------------------------------------------------
    // 3. Legitimate Student & Mentor Onboarding
    // -------------------------------------------------------------

    test("10. Successful Google OAuth Student onboarding provisions public.users and student_profiles", async () => {
        const { user, token } = await createEphemeralOAuthUser({ full_name: "Google Student Demo" });

        const res = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                role: "student",
                name: "Google Student Demo",
                org: "IIT Delhi",
                dept: "Computer Science",
                semester: 4,
                phone: "+91 9988776655"
            })
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.role, "student");

        // Verify in database: public.users
        const { data: dbUser, error: uErr } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();

        assert.equal(uErr, null);
        assert.equal(dbUser.role, "student");
        assert.equal(dbUser.org, "IIT Delhi");
        assert.equal(dbUser.dept, "Computer Science");
        assert.equal(dbUser.phone, "+91 9988776655");

        // Verify in database: public.student_profiles
        const { data: sp, error: spErr } = await supabase
            .from("student_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        assert.equal(spErr, null);
        assert.equal(sp.semester, 4);
    });

    test("11. Successful Google OAuth Mentor onboarding provisions mentor_profiles and removes default student profile", async () => {
        const { user, token } = await createEphemeralOAuthUser({ full_name: "Google Mentor Demo" });

        const res = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                role: "mentor",
                name: "Google Mentor Demo",
                mentorType: "Industry Professional",
                experience: 6,
                organization: "Google Inc",
                phone: "+91 9123456789"
            })
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.role, "mentor");

        // Verify in database: public.users
        const { data: dbUser, error: uErr } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();

        assert.equal(uErr, null);
        assert.equal(dbUser.role, "mentor");
        assert.equal(dbUser.org, "Google Inc");

        // Verify in database: public.mentor_profiles
        const { data: mp, error: mpErr } = await supabase
            .from("mentor_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        assert.equal(mpErr, null);
        assert.equal(mp.mentor_type, "Industry Professional");
        assert.equal(mp.experience, 6);
        assert.equal(mp.verified, false);

        // Verify student_profiles row semester is null or cleared
        const { data: sp } = await supabase
            .from("student_profiles")
            .select("semester")
            .eq("user_id", user.id)
            .maybeSingle();

        assert.ok(sp === null || sp.semester === null, "student_profiles semester should be null for mentors");
    });

    test("12. Duplicate onboarding requests succeed idempotently without error", async () => {
        const { user, token } = await createEphemeralOAuthUser({ full_name: "Duplicate Test User" });

        const payload = {
            role: "student",
            name: "Duplicate Test User",
            org: "BITS Pilani",
            dept: "ECE",
            semester: 3,
            phone: "+91 9876543210"
        };

        const res1 = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        assert.equal(res1.status, 200);

        // Second call with same or updated fields
        const res2 = await fetch(`${baseUrl}/auth/google/onboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        assert.equal(res2.status, 200);
        const body2 = await res2.json();
        assert.equal(body2.role, "student");
    });
});
