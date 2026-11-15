import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure simulation of the PostgreSQL Row Level Security (RLS) policy
 * defined in backend/scripts/create_live_sessions.sql:
 *
 * CREATE POLICY "Booking participants and admins can read live sessions"
 * ON public.live_sessions FOR SELECT USING (
 *     EXISTS (
 *         SELECT 1 FROM public.bookings b
 *         WHERE b.id = live_sessions.booking_id
 *           AND (
 *               b.student_id = auth.uid()
 *               OR b.mentor_id = auth.uid()
 *               OR EXISTS (
 *                   SELECT 1 FROM public.users u
 *                   WHERE u.id = auth.uid() AND u.role = 'admin'
 *               )
 *           )
 *     )
 * );
 */
function simulateLiveSessionsSelectRLS({ liveSession, booking, authUser, trustedUserRecord }) {
    if (!authUser || !authUser.id) return false;
    if (!liveSession || !booking) return false;
    if (booking.id !== liveSession.booking_id) return false;

    // Clause 1: b.student_id = auth.uid()
    if (booking.student_id === authUser.id) return true;

    // Clause 2: b.mentor_id = auth.uid()
    if (booking.mentor_id === authUser.id) return true;

    // Clause 3: EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    if (trustedUserRecord && trustedUserRecord.id === authUser.id && trustedUserRecord.role === "admin") {
        return true;
    }

    return false;
}

/**
 * Pure simulation of table-level privilege grants on public.live_sessions:
 * REVOKE ALL ON public.live_sessions FROM anon, authenticated;
 * GRANT SELECT ON public.live_sessions TO authenticated;
 * GRANT ALL ON public.live_sessions TO service_role;
 */
function simulateLiveSessionsTablePrivilege(role, operation) {
    if (role === "service_role") return true;
    if (role === "authenticated" && operation === "SELECT") return true;
    return false;
}

const booking = {
    id: "44444444-4444-4444-8444-444444444444",
    student_id: "student-1111",
    mentor_id: "mentor-2222",
    status: "confirmed"
};

const liveSession = {
    booking_id: "44444444-4444-4444-8444-444444444444",
    room_id: "skillswap-44444444444444448444444444444444",
    status: "active"
};

test("RLS Policy: Assigned student can SELECT their live session record", () => {
    const studentUser = { id: "student-1111" };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: studentUser,
        trustedUserRecord: { id: "student-1111", role: "student" }
    });
    assert.equal(canRead, true);
});

test("RLS Policy: Assigned mentor can SELECT their live session record", () => {
    const mentorUser = { id: "mentor-2222" };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: mentorUser,
        trustedUserRecord: { id: "mentor-2222", role: "mentor" }
    });
    assert.equal(canRead, true);
});

test("RLS Policy: Unrelated authenticated student cannot read session record", () => {
    const unrelatedStudent = { id: "student-9999" };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: unrelatedStudent,
        trustedUserRecord: { id: "student-9999", role: "student" }
    });
    assert.equal(canRead, false);
});

test("RLS Policy: Unrelated authenticated mentor cannot read session record", () => {
    const unrelatedMentor = { id: "mentor-8888" };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: unrelatedMentor,
        trustedUserRecord: { id: "mentor-8888", role: "mentor" }
    });
    assert.equal(canRead, false);
});

test("RLS Policy: Platform admin can read live session record via trusted users table lookup", () => {
    const adminUser = { id: "admin-7777" };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: adminUser,
        trustedUserRecord: { id: "admin-7777", role: "admin" }
    });
    assert.equal(canRead, true);
});

test("RLS Policy: Attacker attempting admin spoofing via client metadata without trusted DB role is rejected", () => {
    const fakeAdmin = { id: "attacker-6666", user_metadata: { role: "admin" } };
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: fakeAdmin,
        trustedUserRecord: { id: "attacker-6666", role: "student" }
    });
    assert.equal(canRead, false);
});

test("RLS Policy: Unauthenticated user (anon) is rejected by RLS predicate", () => {
    const canRead = simulateLiveSessionsSelectRLS({
        liveSession,
        booking,
        authUser: null,
        trustedUserRecord: null
    });
    assert.equal(canRead, false);
});

test("Table Permissions: Direct client-side mutations (INSERT, UPDATE, DELETE) are denied to authenticated clients", () => {
    assert.equal(simulateLiveSessionsTablePrivilege("authenticated", "INSERT"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("authenticated", "UPDATE"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("authenticated", "DELETE"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("authenticated", "SELECT"), true);
});

test("Table Permissions: Anonymous clients have zero permissions on live_sessions", () => {
    assert.equal(simulateLiveSessionsTablePrivilege("anon", "SELECT"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("anon", "INSERT"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("anon", "UPDATE"), false);
    assert.equal(simulateLiveSessionsTablePrivilege("anon", "DELETE"), false);
});

test("Table Permissions: Only service_role can modify live_sessions records", () => {
    assert.equal(simulateLiveSessionsTablePrivilege("service_role", "INSERT"), true);
    assert.equal(simulateLiveSessionsTablePrivilege("service_role", "UPDATE"), true);
    assert.equal(simulateLiveSessionsTablePrivilege("service_role", "DELETE"), true);
    assert.equal(simulateLiveSessionsTablePrivilege("service_role", "SELECT"), true);
});

