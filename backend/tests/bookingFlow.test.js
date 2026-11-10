import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../src/server.js";
import supabase from "../src/config/supabase.js";

describe("SkillSwap Complete Booking Flow - QA & Debugging Test Suite", () => {
    let server;
    let baseUrl;

    let studentToken;
    let studentId;
    let student2Token;
    let student2Id;
    let mentorToken;
    let mentorId;

    const createdBookingIds = [];

    // Helper: compute a future YYYY-MM-DD for a specific weekday (e.g. "Tuesday")
    function getFutureDateForWeekday(targetDayName, weeksAhead = 2) {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const targetDay = days.indexOf(targetDayName);
        const now = new Date();
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        diff += (weeksAhead - 1) * 7;

        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + diff);

        const y = futureDate.getFullYear();
        const m = String(futureDate.getMonth() + 1).padStart(2, "0");
        const d = String(futureDate.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

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

        // 1. Authenticate Student 1 (Aarohi)
        const s1Login = await supabase.auth.signInWithPassword({
            email: "aarohi.student@skillswap.demo",
            password: process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!s1Login.error, `Student 1 login failed: ${s1Login.error?.message}`);
        studentToken = s1Login.data.session.access_token;
        studentId = s1Login.data.user.id;

        // 2. Authenticate Student 2 (Yash)
        const s2Login = await supabase.auth.signInWithPassword({
            email: "yash.student@skillswap.demo",
            password: process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!s2Login.error, `Student 2 login failed: ${s2Login.error?.message}`);
        student2Token = s2Login.data.session.access_token;
        student2Id = s2Login.data.user.id;

        // 3. Authenticate Mentor (Neha)
        const mLogin = await supabase.auth.signInWithPassword({
            email: "neha.ai@skillswap.demo",
            password: process.env.DEMO_MENTOR_PASSWORD || "SkillSwap@123"
        });
        assert.ok(!mLogin.error, `Mentor login failed: ${mLogin.error?.message}`);
        mentorToken = mLogin.data.session.access_token;
        mentorId = mLogin.data.user.id;

        assert.notEqual(studentId, mentorId, "Student and Mentor must be different users");
    });

    after(async () => {
        // Clean up any bookings created during the test run
        if (createdBookingIds.length > 0) {
            await supabase.from("bookings").delete().in("id", createdBookingIds);
        }

        // Close HTTP server cleanly
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    // -------------------------------------------------------------------------
    // 1. Authentication Security Tests
    // -------------------------------------------------------------------------
    test("1. Unauthenticated requests to /bookings endpoints are rejected with 401", async () => {
        // POST /bookings without token
        const postRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mentor_id: mentorId, topic: "Test", date: "2026-11-20", time: "17:00:00" })
        });
        assert.equal(postRes.status, 401);
        const postData = await postRes.json();
        assert.match(postData.error, /token required/i);

        // GET /bookings without token
        const getRes = await fetch(`${baseUrl}/bookings`);
        assert.equal(getRes.status, 401);

        // PATCH /bookings/:id without token
        const patchRes = await fetch(`${baseUrl}/bookings/dummy-id`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "confirmed" })
        });
        assert.equal(patchRes.status, 401);

        // Invalid token
        const invalidRes = await fetch(`${baseUrl}/bookings`, {
            headers: { Authorization: "Bearer invalid.jwt.token" }
        });
        assert.equal(invalidRes.status, 401);
    });

    // -------------------------------------------------------------------------
    // 2. Input Validation Tests
    // -------------------------------------------------------------------------
    test("2. Booking request parameter validations (missing fields, format, past dates)", async () => {
        const futureTuesday = getFutureDateForWeekday("Tuesday", 3);

        // Missing fields
        const missingRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ mentor_id: mentorId })
        });
        assert.equal(missingRes.status, 400);
        const missingData = await missingRes.json();
        assert.match(missingData.error, /required/i);

        // Invalid date format
        const badDateRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "QA Test",
                date: "invalid-date-string",
                time: "5:00 PM"
            })
        });
        assert.equal(badDateRes.status, 400);
        const badDateData = await badDateRes.json();
        assert.match(badDateData.error, /Invalid date format/i);

        // Past date
        const pastDateRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "QA Test",
                date: "2020-01-01",
                time: "5:00 PM"
            })
        });
        assert.equal(pastDateRes.status, 400);
        const pastDateData = await pastDateRes.json();
        assert.match(pastDateData.error, /past/i);

        // Invalid time format
        const badTimeRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "QA Test",
                date: futureTuesday,
                time: "invalid-time"
            })
        });
        assert.equal(badTimeRes.status, 400);
        const badTimeData = await badTimeRes.json();
        assert.match(badTimeData.error, /Invalid time format/i);

        // Self-booking attempt (student booking themselves)
        const selfRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: studentId,
                topic: "Self Mentorship",
                date: futureTuesday,
                time: "5:00 PM"
            })
        });
        assert.equal(selfRes.status, 400);
        const selfData = await selfRes.json();
        assert.match(selfData.error, /yourself/i);

        // Booking non-existent or non-mentor user
        const fakeMentorRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: "00000000-0000-0000-0000-000000000000",
                topic: "QA Test",
                date: futureTuesday,
                time: "5:00 PM"
            })
        });
        assert.equal(fakeMentorRes.status, 400);
        const fakeData = await fakeMentorRes.json();
        assert.match(fakeData.error, /not an active mentor/i);
    });

    // -------------------------------------------------------------------------
    // 3. Role Security Tests
    // -------------------------------------------------------------------------
    test("3. Mentors cannot create student bookings (role enforcement)", async () => {
        const futureTuesday = getFutureDateForWeekday("Tuesday", 3);

        const res = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Mentor as Student",
                date: futureTuesday,
                time: "5:00 PM"
            })
        });
        // Returns 400 (self) or 403 (mentor role)
        assert.ok([400, 403].includes(res.status));
        const data = await res.json();
        assert.ok(data.error);
    });

    // -------------------------------------------------------------------------
    // 4. Availability & Unavailable Slots Validation
    // -------------------------------------------------------------------------
    test("4. Booking an unavailable slot or day is rejected with 400", async () => {
        const futureTuesday = getFutureDateForWeekday("Tuesday", 3);

        // Tuesday Neha is available at 5:00 PM and 7:00 PM. 3:00 AM is NOT available.
        const res = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Unavailable Slot Test",
                date: futureTuesday,
                time: "03:00:00"
            })
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /not available/i);
    });

    // -------------------------------------------------------------------------
    // 5. Successful Booking Flow
    // -------------------------------------------------------------------------
    let createdBookingId;
    const testDate = getFutureDateForWeekday("Tuesday", 4);
    const testTime = "5:00 PM"; // Normalizes to 17:00:00

    test("5. Successful student booking creation and persistence in Supabase", async () => {
        const res = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Machine Learning Guidance Session",
                date: testDate,
                time: testTime
            })
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.message, "Booking created successfully");
        assert.ok(data.booking);
        assert.equal(data.booking.mentor_id, mentorId);
        assert.equal(data.booking.student_id, studentId);
        assert.equal(data.booking.status, "pending");
        assert.equal(data.booking.time, "17:00:00");
        assert.equal(data.booking.date, testDate);

        createdBookingId = data.booking.id;
        createdBookingIds.push(createdBookingId);

        // Verify record in Supabase database directly
        const { data: dbBooking, error: dbError } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", createdBookingId)
            .single();

        assert.ok(!dbError, `Direct DB check failed: ${dbError?.message}`);
        assert.equal(dbBooking.id, createdBookingId);
        assert.equal(dbBooking.status, "pending");
        assert.equal(dbBooking.mentor_id, mentorId);
        assert.equal(dbBooking.student_id, studentId);

        // Verify booking appears in student's My Bookings endpoint
        const sBookingsRes = await fetch(`${baseUrl}/bookings`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(sBookingsRes.status, 200);
        const sBookings = await sBookingsRes.json();
        const foundS = sBookings.bookings.find((b) => b.id === createdBookingId);
        assert.ok(foundS, "Booking must appear in student's booking list");
        assert.equal(foundS.mentor_name, "Neha Kulkarni");
        assert.equal(foundS.status, "pending");

        // Verify booking appears in mentor's dashboard endpoint
        const mBookingsRes = await fetch(`${baseUrl}/bookings`, {
            headers: { Authorization: `Bearer ${mentorToken}` }
        });
        assert.equal(mBookingsRes.status, 200);
        const mBookings = await mBookingsRes.json();
        const foundM = mBookings.bookings.find((b) => b.id === createdBookingId);
        assert.ok(foundM, "Booking must appear in mentor's requests list");
        assert.equal(foundM.student_name, "Aarohi Sharma");
        assert.equal(foundM.status, "pending");
    });

    // -------------------------------------------------------------------------
    // 6. Slot Availability Discovery Endpoint
    // -------------------------------------------------------------------------
    test("6. Slot discovery endpoint /bookings/slots correctly reports booked slots", async () => {
        const res = await fetch(`${baseUrl}/bookings/slots?mentor_id=${mentorId}&date=${testDate}`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.bookedSlots));
        assert.ok(data.bookedSlots.includes("17:00:00"), "Newly booked slot 17:00:00 must be in bookedSlots");
    });

    // -------------------------------------------------------------------------
    // 7. Duplicate Booking Prevention
    // -------------------------------------------------------------------------
    test("7. Duplicate booking for the same mentor and time slot returns 409 Conflict", async () => {
        const res = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${student2Token}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Attempt Duplicate Booking",
                date: testDate,
                time: testTime
            })
        });

        assert.equal(res.status, 409);
        const data = await res.json();
        assert.match(data.error, /no longer available/i);
    });

    // -------------------------------------------------------------------------
    // 8. Student Conflicting Sessions Prevention
    // -------------------------------------------------------------------------
    test("8. Student cannot book multiple conflicting sessions at the exact same time", async () => {
        // Student 1 already has a session at testDate 17:00:00.
        // Attempting to book again (even if different topic) returns 409.
        const res = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Student Conflicting Slot",
                date: testDate,
                time: testTime
            })
        });

        assert.equal(res.status, 409);
    });

    // -------------------------------------------------------------------------
    // 9. Concurrency Protection (Race Condition Test)
    // -------------------------------------------------------------------------
    test("9. Concurrent booking attempts for the same slot: exactly one succeeds and one gets 409", async () => {
        // Use Neha's 7:00 PM slot on testDate (which is currently open)
        const concurrentSlot = "7:00 PM";

        const req1 = fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Student 1 Race Winner",
                date: testDate,
                time: concurrentSlot
            })
        });

        const req2 = fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${student2Token}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Student 2 Race Contender",
                date: testDate,
                time: concurrentSlot
            })
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        const statuses = [res1.status, res2.status].sort();

        assert.deepEqual(
            statuses,
            [201, 409],
            `Expected exactly one 201 Created and one 409 Conflict, received [${res1.status}, ${res2.status}]`
        );

        // Track the created booking for cleanup
        if (res1.status === 201) {
            const data1 = await res1.json();
            createdBookingIds.push(data1.booking.id);
        }
        if (res2.status === 201) {
            const data2 = await res2.json();
            createdBookingIds.push(data2.booking.id);
        }

        // Verify database has exactly 1 booking for this slot
        const { data: slotBookings } = await supabase
            .from("bookings")
            .select("id")
            .eq("mentor_id", mentorId)
            .eq("date", testDate)
            .eq("time", "19:00:00")
            .in("status", ["pending", "confirmed"]);

        assert.equal(slotBookings.length, 1, "Database must contain exactly 1 active booking for the disputed slot");
    });

    // -------------------------------------------------------------------------
    // 10. Simulated Rapid Double-Click Submission Test
    // -------------------------------------------------------------------------
    test("10. Rapid double-click submissions: only one booking is created, second returns 409", async () => {
        // Use Neha's Sunday 6:00 PM slot in week 5
        const dClickDate = getFutureDateForWeekday("Sunday", 5);
        const dClickTime = "6:00 PM";

        const req1 = fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Double-Click Click 1",
                date: dClickDate,
                time: dClickTime
            })
        });

        const req2 = fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Double-Click Click 2",
                date: dClickDate,
                time: dClickTime
            })
        });

        const [r1, r2] = await Promise.all([req1, req2]);
        const statuses = [r1.status, r2.status].sort();

        assert.deepEqual(statuses, [201, 409], "Rapid double clicks must result in exactly one 201 and one 409");

        if (r1.status === 201) {
            const d1 = await r1.json();
            createdBookingIds.push(d1.booking.id);
        }
        if (r2.status === 201) {
            const d2 = await r2.json();
            createdBookingIds.push(d2.booking.id);
        }
    });

    // -------------------------------------------------------------------------
    // 11. Mentor Acceptance Flow
    // -------------------------------------------------------------------------
    test("11. Mentor can accept a pending booking request", async () => {
        const patchRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });

        assert.equal(patchRes.status, 200);
        const data = await patchRes.json();
        assert.equal(data.booking.status, "confirmed");

        // Verify status in DB
        const { data: dbBooking } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", createdBookingId)
            .single();
        assert.equal(dbBooking.status, "confirmed");

        // Verify student can see updated status
        const studentViewRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.equal(studentViewRes.status, 200);
        const studentViewData = await studentViewRes.json();
        assert.equal(studentViewData.booking.status, "confirmed");
    });

    // -------------------------------------------------------------------------
    // 12. Authorization: Student Cannot Accept Own Booking
    // -------------------------------------------------------------------------
    test("12. Student cannot accept or approve their own booking request", async () => {
        const futureWed = getFutureDateForWeekday("Wednesday", 4);
        const createRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Self Accept Test",
                date: futureWed,
                time: "9:00 AM - 10:00 AM" // 09:00:00
            })
        });
        assert.equal(createRes.status, 201);
        const { booking } = await createRes.json();
        createdBookingIds.push(booking.id);

        // Student attempts to accept
        const acceptRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });
        assert.equal(acceptRes.status, 403);
        const acceptData = await acceptRes.json();
        assert.match(acceptData.error, /Only the mentor can accept/i);
    });

    // -------------------------------------------------------------------------
    // 13. Dedicated Mentor Rejection Test
    // -------------------------------------------------------------------------
    test("13. Dedicated Mentor Rejection: Mentor rejects a pending booking request and status persists as cancelled", async () => {
        const futureWed = getFutureDateForWeekday("Wednesday", 5);
        const createRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Dedicated Mentor Rejection Test",
                date: futureWed,
                time: "12:00 PM - 1:00 PM" // 12:00:00
            })
        });
        assert.equal(createRes.status, 201);
        const { booking } = await createRes.json();
        createdBookingIds.push(booking.id);

        // Mentor rejects the request
        const declineRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "declined" })
        });
        assert.equal(declineRes.status, 200);
        const declineData = await declineRes.json();
        assert.equal(declineData.booking.status, "cancelled");

        // Verify in DB directly
        const { data: dbBooking } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", booking.id)
            .single();
        assert.equal(dbBooking.status, "cancelled");
    });

    // -------------------------------------------------------------------------
    // 14. Dedicated Student Cancellation of Pending Booking
    // -------------------------------------------------------------------------
    test("14. Student can cancel their own pending booking request", async () => {
        const futureFri = getFutureDateForWeekday("Friday", 4);
        const createRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Student Pending Cancel Test",
                date: futureFri,
                time: "5:00 PM - 6:00 PM" // 17:00:00
            })
        });
        assert.equal(createRes.status, 201);
        const { booking } = await createRes.json();
        createdBookingIds.push(booking.id);

        // Student cancels pending booking
        const cancelRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ status: "cancelled" })
        });
        assert.equal(cancelRes.status, 200);
        const cancelData = await cancelRes.json();
        assert.equal(cancelData.booking.status, "cancelled");

        // Direct DB check
        const { data: dbBooking } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", booking.id)
            .single();
        assert.equal(dbBooking.status, "cancelled");
    });

    // -------------------------------------------------------------------------
    // 15. Dedicated Mentor Cancellation of Confirmed Booking
    // -------------------------------------------------------------------------
    test("15. Mentor can cancel a confirmed booking", async () => {
        const futureFri = getFutureDateForWeekday("Friday", 5);
        const createRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Mentor Confirmed Cancel Test",
                date: futureFri,
                time: "6:00 PM - 7:00 PM" // 18:00:00
            })
        });
        assert.equal(createRes.status, 201);
        const { booking } = await createRes.json();
        createdBookingIds.push(booking.id);

        // Mentor accepts it first
        const acceptRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });
        assert.equal(acceptRes.status, 200);

        // Mentor cancels the confirmed booking
        const cancelRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "cancelled" })
        });
        assert.equal(cancelRes.status, 200);
        const cancelData = await cancelRes.json();
        assert.equal(cancelData.booking.status, "cancelled");
    });

    // -------------------------------------------------------------------------
    // 16. Dedicated Completed Booking Protection Test
    // -------------------------------------------------------------------------
    test("16. Completed bookings cannot be improperly modified", async () => {
        const futureSat = getFutureDateForWeekday("Saturday", 4);
        const createRes = await fetch(`${baseUrl}/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                topic: "Completed Booking Immutable Test",
                date: futureSat,
                time: "5:00 PM" // 17:00:00
            })
        });
        assert.equal(createRes.status, 201);
        const { booking } = await createRes.json();
        createdBookingIds.push(booking.id);

        // Confirm booking
        await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });

        // Mark completed
        const completeRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "completed" })
        });
        assert.equal(completeRes.status, 200);
        const completeData = await completeRes.json();
        assert.equal(completeData.booking.status, "completed");

        // Attempting to cancel a completed booking must fail
        const cancelRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ status: "cancelled" })
        });
        assert.equal(cancelRes.status, 400);
        const cancelData = await cancelRes.json();
        assert.match(cancelData.error, /already been completed/i);

        // Attempting to re-open to confirmed must fail
        const reconfirmRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });
        assert.equal(reconfirmRes.status, 400);

        // Attempting to revert to pending must fail
        const rependingRes = await fetch(`${baseUrl}/bookings/${booking.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "pending" })
        });
        assert.equal(rependingRes.status, 400);
    });

    // -------------------------------------------------------------------------
    // 17. State Transition Integrity Tests
    // -------------------------------------------------------------------------
    test("17. Invalid status transitions (rejecting confirmed, accepting cancelled) are rejected", async () => {
        // createdBookingId is currently 'confirmed'
        // Attempting to transition from 'confirmed' to 'declined' is forbidden
        const rejectAcceptedRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mentorToken}`
            },
            body: JSON.stringify({ status: "declined" })
        });
        assert.equal(rejectAcceptedRes.status, 400);
        const rejectAcceptedData = await rejectAcceptedRes.json();
        assert.match(rejectAcceptedData.error, /Cannot reject a booking that has already been accepted/i);
    });

    // -------------------------------------------------------------------------
    // 18. Privacy & Cross-User Security Tests
    // -------------------------------------------------------------------------
    test("18. Unauthorized users cannot access or modify private bookings", async () => {
        // Student 2 attempts to view Student 1's booking
        const getRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            headers: { Authorization: `Bearer ${student2Token}` }
        });
        assert.equal(getRes.status, 403);
        const getData = await getRes.json();
        assert.match(getData.error, /not authorized/i);

        // Student 2 attempts to cancel Student 1's booking
        const patchRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${student2Token}`
            },
            body: JSON.stringify({ status: "cancelled" })
        });
        assert.equal(patchRes.status, 403);
    });

    // -------------------------------------------------------------------------
    // 19. Cancellation Flow for Student
    // -------------------------------------------------------------------------
    test("19. Student can cancel a confirmed booking, and cancelled bookings cannot be updated", async () => {
        // Student 1 cancels their confirmed booking
        const cancelRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ status: "cancelled" })
        });
        assert.equal(cancelRes.status, 200);
        const cancelData = await cancelRes.json();
        assert.equal(cancelData.booking.status, "cancelled");

        // Attempting to update a cancelled booking fails
        const reupdateRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify({ status: "confirmed" })
        });
        assert.equal(reupdateRes.status, 400);
        const reupdateData = await reupdateRes.json();
        assert.match(reupdateData.error, /already been cancelled or declined/i);
    });
});
