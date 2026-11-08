/**
 * Moderation API Route Endpoints Tests
 * 
 * Verifies Express route handlers:
 * - GET  /moderation/flags
 * - GET  /moderation/flags/:id
 * - POST /moderation/flags/:id/action
 * 
 * Tests input validation, server-side admin privilege checks,
 * flag retrieval with enriched participants, state transitions, and audit records.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import moderationRouter from "../src/routes/moderation.js";
import supabase from "../src/config/supabase.js";
import { moderateBookingTranscript } from "../src/services/moderationService.js";

// Helper to create mock response object
function createMockRes() {
    let statusCode = 200;
    let responseData = null;

    return {
        status(code) {
            statusCode = code;
            return this;
        },
        json(data) {
            responseData = data;
            return this;
        },
        getStatus() {
            return statusCode;
        },
        getData() {
            return responseData;
        }
    };
}

describe("6. Moderation API Route Endpoints", () => {
    it("should reject requests when req.user is not a verified admin", async () => {
        const req = {
            headers: {},
            query: {}
        };
        const res = createMockRes();

        // Middleware requireAdmin is the first handler in the chain
        const { default: requireAdmin } = await import("../src/middleware/adminMiddleware.js");
        await requireAdmin(req, res, () => {});

        assert.strictEqual(res.getStatus(), 401);
        assert.ok(res.getData().error.includes("token required"));
    });

    it("GET /flags should list safety flags with enriched participant details", async () => {
        const mockFlag = {
            id: "11111111-1111-1111-1111-111111111111",
            booking_id: "22222222-2222-2222-2222-222222222222",
            student_id: "33333333-3333-3333-3333-333333333333",
            mentor_id: "44444444-4444-4444-4444-444444444444",
            category: "external_payment",
            severity: "high",
            excerpt: "Pay me 500 rupees directly to my GPay",
            confidence: 0.95,
            status: "pending",
            created_at: new Date().toISOString()
        };

        const originalFrom = supabase.from;
        supabase.from = (table) => {
            if (table === "safety_flags") {
                return {
                    select: () => ({
                        order: () => ({
                            range: () => ({
                                eq: () => ({
                                    data: [mockFlag],
                                    error: null
                                }),
                                data: [mockFlag],
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === "users") {
                return {
                    select: () => ({
                        in: () => ({
                            data: [
                                { id: "33333333-3333-3333-3333-333333333333", name: "Rohan Mentee", email: "rohan@test.com" },
                                { id: "44444444-4444-4444-4444-444444444444", name: "Dr. Priya Mentor", email: "priya@test.com" }
                            ]
                        })
                    })
                };
            }
            return { select: () => ({ in: () => ({ data: [] }) }) };
        };

        try {
            const req = {
                user: { id: "admin-1", role: "admin" },
                query: { status: "pending" }
            };
            const res = createMockRes();

            // Locate GET /flags handler
            const route = moderationRouter.stack.find((layer) => layer.route && layer.route.path === "/flags" && layer.route.methods.get);
            assert.ok(route, "GET /flags route must exist");

            // Execute the route handler (second layer after requireAdmin)
            const handler = route.route.stack[route.route.stack.length - 1].handle;
            await handler(req, res);

            assert.strictEqual(res.getStatus(), 200);
            const data = res.getData();
            assert.strictEqual(data.count, 1);
            assert.strictEqual(data.flags[0].student.name, "Rohan Mentee");
            assert.strictEqual(data.flags[0].mentor.name, "Dr. Priya Mentor");
        } finally {
            supabase.from = originalFrom;
        }
    });

    it("GET /flags/:id should return flag details, booking, participants, and action audit log", async () => {
        const flagId = "11111111-1111-1111-1111-111111111111";
        const bookingId = "22222222-2222-2222-2222-222222222222";

        const originalFrom = supabase.from;
        supabase.from = (table) => {
            if (table === "safety_flags") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({
                                data: {
                                    id: flagId,
                                    booking_id: bookingId,
                                    student_id: "user-s1",
                                    mentor_id: "user-m1",
                                    category: "off_platform_communication",
                                    severity: "medium",
                                    status: "pending"
                                },
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === "bookings") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({
                                data: { id: bookingId, topic: "System Design", date: "2026-11-10", status: "completed" }
                            })
                        })
                    })
                };
            }
            if (table === "users") {
                return {
                    select: () => ({
                        in: () => ({
                            data: [
                                { id: "user-s1", name: "Aryan Shah", email: "aryan@gmail.com" },
                                { id: "user-m1", name: "Priya Mentor", email: "priya@gmail.com" }
                            ]
                        })
                    })
                };
            }
            if (table === "moderation_actions") {
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                data: [
                                    { id: "act-1", action: "warn", reason: "Previous warning", created_at: new Date().toISOString() }
                                ]
                            })
                        })
                    })
                };
            }
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
        };

        try {
            const req = {
                params: { id: flagId },
                user: { id: "admin-1", role: "admin" }
            };
            const res = createMockRes();

            const route = moderationRouter.stack.find((layer) => layer.route && layer.route.path === "/flags/:id" && layer.route.methods.get);
            assert.ok(route, "GET /flags/:id route must exist");

            const handler = route.route.stack[route.route.stack.length - 1].handle;
            await handler(req, res);

            assert.strictEqual(res.getStatus(), 200);
            const data = res.getData();
            assert.strictEqual(data.flag.id, flagId);
            assert.strictEqual(data.booking.topic, "System Design");
            assert.strictEqual(data.student.name, "Aryan Shah");
            assert.strictEqual(data.actions.length, 1);
        } finally {
            supabase.from = originalFrom;
        }
    });

    it("POST /flags/:id/action should validate input and reject invalid action", async () => {
        const req = {
            params: { id: "11111111-1111-1111-1111-111111111111" },
            body: { action: "unsupported_action", reason: "Testing invalid" },
            user: { id: "admin-1", role: "admin" }
        };
        const res = createMockRes();

        const route = moderationRouter.stack.find((layer) => layer.route && layer.route.path === "/flags/:id/action" && layer.route.methods.post);
        assert.ok(route, "POST /flags/:id/action route must exist");

        const handler = route.route.stack[route.route.stack.length - 1].handle;
        await handler(req, res);

        assert.strictEqual(res.getStatus(), 400);
        assert.ok(res.getData().error.includes("Invalid action"));
    });

    it("POST /flags/:id/action should validate input and reject empty reason", async () => {
        const req = {
            params: { id: "11111111-1111-1111-1111-111111111111" },
            body: { action: "dismiss", reason: " " },
            user: { id: "admin-1", role: "admin" }
        };
        const res = createMockRes();

        const route = moderationRouter.stack.find((layer) => layer.route && layer.route.path === "/flags/:id/action" && layer.route.methods.post);
        const handler = route.route.stack[route.route.stack.length - 1].handle;
        await handler(req, res);

        assert.strictEqual(res.getStatus(), 400);
        assert.ok(res.getData().error.includes("reason of at least 3 characters"));
    });

    it("POST /flags/:id/action should execute dismiss, warn, and escalate with audit records", async () => {
        const actions = [
            { action: "dismiss", expectedStatus: "dismissed", reason: "Harmless context confirmed" },
            { action: "warn", expectedStatus: "warned", reason: "First warning issued" },
            { action: "escalate", expectedStatus: "escalated", reason: "Severe platform bypass escalated to director" }
        ];

        for (const testAction of actions) {
            let updatedStatus = null;
            let recordedAudit = null;

            const originalFrom = supabase.from;
            supabase.from = (table) => {
                if (table === "safety_flags") {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: { id: "11111111-1111-1111-1111-111111111111", status: "pending" },
                                    error: null
                                })
                            })
                        }),
                        update: (updates) => {
                            updatedStatus = updates.status;
                            return {
                                eq: () => ({
                                    select: () => ({
                                        single: async () => ({
                                            data: { id: "11111111-1111-1111-1111-111111111111", status: updates.status, reviewed_at: updates.reviewed_at },
                                            error: null
                                        })
                                    })
                                })
                            };
                        }
                    };
                }
                if (table === "moderation_actions") {
                    return {
                        insert: (record) => {
                            recordedAudit = record;
                            return {
                                select: () => ({
                                    single: async () => ({ data: { id: "action-id-99", ...record }, error: null })
                                })
                            };
                        }
                    };
                }
                return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
            };

            try {
                const req = {
                    params: { id: "11111111-1111-1111-1111-111111111111" },
                    body: { action: testAction.action, reason: testAction.reason },
                    user: { id: "admin-verified-id", role: "admin" }
                };
                const res = createMockRes();

                const route = moderationRouter.stack.find((layer) => layer.route && layer.route.path === "/flags/:id/action" && layer.route.methods.post);
                const handler = route.route.stack[route.route.stack.length - 1].handle;
                await handler(req, res);

                assert.strictEqual(res.getStatus(), 200);
                assert.strictEqual(updatedStatus, testAction.expectedStatus);
                assert.strictEqual(recordedAudit.action, testAction.action);
                assert.strictEqual(recordedAudit.reason, testAction.reason);
                assert.strictEqual(recordedAudit.admin_id, "admin-verified-id");
            } finally {
                supabase.from = originalFrom;
            }
        }
    });

    it("moderateBookingTranscript integration helper should be available and callable", async () => {
        assert.strictEqual(typeof moderateBookingTranscript, "function");

        const mockClient = {
            from: (table) => {
                if (table === "bookings") {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: { id: "b-1", student_id: "s-1", mentor_id: "m-1" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                return {
                    select: () => ({ eq: () => ({ data: [], error: null }) }),
                    insert: () => ({ select: async () => ({ data: [], error: null }) })
                };
            }
        };

        const result = await moderateBookingTranscript(
            "b-1",
            "This was a productive and safe session on JavaScript async programming.",
            { supabaseClient: mockClient }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.isSafe, true);
    });
});
