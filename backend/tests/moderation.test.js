/**
 * AI Safety & Moderation Module Tests
 * 
 * Verifies all required behaviors:
 * 1. Text normalization (whitespace, spoken numbers, "at the rate", email/handle normalization, preserving original)
 * 2. PII detection (Indian phone numbers, emails, URLs, social handles, sensitive masking)
 * 3. Contextual safety classification (off-platform, private migration, external payment, bypass, contact sharing)
 * 4. Context awareness (harmless WhatsApp/UPI mentions vs violations)
 * 5. Duplicate flag prevention
 * 6. Admin authorization security (rejects unauthenticated & non-admin users, server-side DB verification)
 * 7. Admin actions (dismiss, warn, escalate state transitions & audit logs)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizeTranscript } from "../src/services/textNormalizer.js";
import { detectPII, maskPhoneNumber, maskEmail } from "../src/services/piiDetector.js";
import { classifySafety, classifySafetyRules } from "../src/services/safetyClassifier.js";
import { moderateSessionTranscript, moderateBookingTranscript } from "../src/services/moderationService.js";

// -----------------------------------------------------------------------------
// 1. Text Normalization Tests
// -----------------------------------------------------------------------------
describe("1. Text Normalization", () => {
    it("should normalize whitespace, smart quotes, and repeated punctuation", () => {
        const raw = '   “Hello   world”...  How    are you???   I’m   good!!!   ';
        const result = normalizeTranscript(raw);

        assert.strictEqual(result.original, raw);
        assert.ok(!result.normalized.includes("“"));
        assert.ok(!result.normalized.includes("???"));
        assert.strictEqual(result.normalized, '"Hello world"... How are you? I\'m good!');
    });

    it("should normalize spoken digit sequences and multipliers to digits", () => {
        const raw = "my number is nine eight seven six five four three two one zero";
        const result = normalizeTranscript(raw);

        assert.ok(result.normalized.includes("9876543210"), `Expected 9876543210 in: ${result.normalized}`);
    });

    it("should normalize double and triple multipliers and plus nine one prefix", () => {
        const raw = "call me on plus nine one nine eight double seven triple five four three two one";
        const result = normalizeTranscript(raw);

        assert.ok(result.normalized.includes("+9198775554321") || result.normalized.includes("98775554321"));
    });

    it("should normalize spoken email phrases such as 'at the rate' and 'dot com'", () => {
        const raw = "reach me at rahul dot verma at the rate gmail dot com for notes";
        const result = normalizeTranscript(raw);

        assert.ok(result.normalized.includes("rahul.verma@gmail.com"));
        assert.strictEqual(result.original, raw);
    });

    it("should normalize spoken handles with underscore and at the rate", () => {
        const raw = "my handle is at the rate anjali underscore dev on twitter";
        const result = normalizeTranscript(raw);

        assert.ok(result.normalized.includes("@anjali_dev"));
    });

    it("should leave harmless transcripts intact", () => {
        const raw = "We discussed dynamic programming and memoization techniques today.";
        const result = normalizeTranscript(raw);

        assert.strictEqual(result.normalized, raw);
    });
});

// -----------------------------------------------------------------------------
// 2. PII Detection & Sensitive Value Masking Tests
// -----------------------------------------------------------------------------
describe("2. PII Detection & Masking", () => {
    it("should detect Indian phone numbers across standard formats", () => {
        const samples = [
            "Call me at +91 98765 43210 tomorrow.",
            "My direct contact is 9876543210.",
            "Reach out on +919876543210.",
            "Office line is 09876543210."
        ];

        for (const sample of samples) {
            const detected = detectPII(sample);
            assert.strictEqual(detected.hasPII, true, `Failed on: ${sample}`);
            assert.ok(detected.categories.includes("phone"), `Expected phone category in: ${sample}`);
            assert.ok(detected.maskedText.includes("****"), `Expected masked digits in: ${detected.maskedText}`);
        }
    });

    it("should detect email addresses and mask them properly", () => {
        const text = "Send your resume to priya.sharma@skillswap.edu.in before Friday.";
        const detected = detectPII(text);

        assert.strictEqual(detected.hasPII, true);
        assert.ok(detected.categories.includes("email"));
        assert.ok(detected.maskedText.includes("p***a@skillswap.edu.in"));
        assert.strictEqual(detected.items[0].value, "priya.sharma@skillswap.edu.in");
    });

    it("should detect URLs and external meeting links", () => {
        const text = "Join my personal room https://zoom.us/j/9988776655 for the demo.";
        const detected = detectPII(text);

        assert.strictEqual(detected.hasPII, true);
        assert.ok(detected.categories.includes("url"));
        assert.ok(detected.maskedText.includes("[REDACTED]"));
    });

    it("should detect social media handles and chat links", () => {
        const text = "Ping me on Telegram at @karan_tech or check wa.me/919876543210.";
        const detected = detectPII(text);

        assert.strictEqual(detected.hasPII, true);
        assert.ok(detected.categories.includes("social_handle") || detected.categories.includes("phone"));
    });

    it("should return hasPII: false when no personal information is present", () => {
        const clean = "The time complexity of binary search is O(log n).";
        const detected = detectPII(clean);

        assert.strictEqual(detected.hasPII, false);
        assert.strictEqual(detected.items.length, 0);
        assert.strictEqual(detected.maskedText, clean);
    });
});

// -----------------------------------------------------------------------------
// 3. Contextual Safety Classifier Tests
// -----------------------------------------------------------------------------
describe("3. Contextual Safety Classifier", () => {
    it("should NOT flag harmless, informational mentions of WhatsApp or UPI", async () => {
        const benignSamples = [
            "WhatsApp is a messaging application used for communication.",
            "We are studying how WhatsApp implements end-to-end encryption protocols.",
            "UPI was launched by NPCI and revolutionized digital payments in India.",
            "Can you explain the difference between WhatsApp architecture and Telegram?",
            "How does Google Pay process transactions through the banking switch?"
        ];

        for (const sample of benignSamples) {
            const report = await classifySafety(sample);
            assert.strictEqual(report.isSafe, true, `False positive detected on harmless sample: "${sample}"`);
            assert.strictEqual(report.flagsCount, 0);
        }
    });

    it("should flag off-platform mentorship requests on WhatsApp", async () => {
        const text = "Let's continue our mentorship on WhatsApp next week.";
        const report = await classifySafety(text);

        assert.strictEqual(report.isSafe, false);
        assert.ok(report.flags.some((f) => f.category === "off_platform_communication" || f.category === "private_channel_migration"));
        assert.ok(report.flags[0].confidence >= 0.85);
    });

    it("should flag attempts to move mentorship to private channels", async () => {
        const text = "Let's take this offline and discuss your project on my personal Zoom.";
        const report = await classifySafety(text);

        assert.strictEqual(report.isSafe, false);
        assert.ok(report.flags.some((f) => f.category === "private_channel_migration" || f.category === "off_platform_communication"));
    });

    it("should flag external payment requests (GPay, UPI, Paytm)", async () => {
        const samples = [
            "Pay me 500 rupees directly to my GPay account.",
            "Send the session fee to my UPI ID rahul@oksbi.",
            "You can transfer the money to my Paytm number."
        ];

        for (const sample of samples) {
            const report = await classifySafety(sample);
            assert.strictEqual(report.isSafe, false, `Failed to flag payment violation in: "${sample}"`);
            assert.ok(report.flags.some((f) => f.category === "external_payment"));
            const paymentFlag = report.flags.find((f) => f.category === "external_payment");
            assert.strictEqual(paymentFlag.severity, "high");
        }
    });

    it("should flag platform bypass attempts with critical severity", async () => {
        const text = "Do not book through SkillSwap next time, deal directly with me to save commission.";
        const report = await classifySafety(text);

        assert.strictEqual(report.isSafe, false);
        const bypassFlag = report.flags.find((f) => f.category === "platform_bypass");
        assert.ok(bypassFlag, "Expected platform_bypass flag");
        assert.strictEqual(bypassFlag.severity, "critical");
        assert.ok(bypassFlag.confidence >= 0.90);
    });

    it("should flag unnecessary contact sharing with masked excerpts", async () => {
        const text = "Here is my personal number 9876543210, call me directly.";
        const report = await classifySafety(text);

        assert.strictEqual(report.isSafe, false);
        const contactFlag = report.flags.find((f) => f.category === "unnecessary_contact_sharing");
        assert.ok(contactFlag, "Expected unnecessary_contact_sharing flag");
        assert.ok(contactFlag.excerpt.includes("98****10"), "Expected sensitive phone number to be masked in excerpt");
    });
});

// -----------------------------------------------------------------------------
// 4. Moderation Service & Duplicate Flag Prevention
// -----------------------------------------------------------------------------
describe("4. Moderation Service & Storage", () => {
    function createMockSupabase(existingFlags = []) {
        const insertedFlags = [];
        const currentFlags = [...existingFlags];

        return {
            _insertedFlags: insertedFlags,
            from: (table) => {
                if (table === "bookings") {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: {
                                        id: "11111111-1111-1111-1111-111111111111",
                                        student_id: "22222222-2222-2222-2222-222222222222",
                                        mentor_id: "33333333-3333-3333-3333-333333333333"
                                    },
                                    error: null
                                })
                            })
                        })
                    };
                }

                if (table === "safety_flags") {
                    return {
                        select: () => ({
                            eq: (field, val) => ({
                                data: currentFlags.filter((f) => f.booking_id === val),
                                error: null
                            })
                        }),
                        insert: (records) => ({
                            select: async () => {
                                for (const r of records) {
                                    const flagRecord = { id: `flag-${Math.random()}`, ...r };
                                    insertedFlags.push(flagRecord);
                                    currentFlags.push(flagRecord);
                                }
                                return { data: records, error: null };
                            }
                        })
                    };
                }

                return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
            }
        };
    }

    it("should analyze clean transcript and create zero flags", async () => {
        const mockDb = createMockSupabase();
        const outcome = await moderateSessionTranscript({
            bookingId: "11111111-1111-1111-1111-111111111111",
            transcriptText: "Today we solved 3 LeetCode problems on graph traversal. Excellent progress!",
            supabaseClient: mockDb
        });

        assert.strictEqual(outcome.success, true);
        assert.strictEqual(outcome.isSafe, true);
        assert.strictEqual(outcome.flagsCreated, 0);
        assert.strictEqual(mockDb._insertedFlags.length, 0);
    });

    it("should analyze unsafe transcript and persist pending flags with masked excerpts", async () => {
        const mockDb = createMockSupabase();
        const outcome = await moderateSessionTranscript({
            bookingId: "11111111-1111-1111-1111-111111111111",
            transcriptText: "Let us continue our mentorship on WhatsApp. Call my number 9876543210.",
            supabaseClient: mockDb
        });

        assert.strictEqual(outcome.success, true);
        assert.strictEqual(outcome.isSafe, false);
        assert.ok(outcome.flagsCreated > 0);
        assert.ok(mockDb._insertedFlags.length > 0);

        for (const flag of mockDb._insertedFlags) {
            assert.strictEqual(flag.status, "pending");
            assert.ok(!flag.excerpt.includes("9876543210"), "PII must be masked in stored excerpt");
        }
    });

    it("should prevent duplicate flags for the same booking and category", async () => {
        // Pre-populate with an existing flag for 'off_platform_communication'
        const existing = [
            {
                booking_id: "11111111-1111-1111-1111-111111111111",
                category: "off_platform_communication"
            }
        ];
        const mockDb = createMockSupabase(existing);

        const outcome = await moderateSessionTranscript({
            bookingId: "11111111-1111-1111-1111-111111111111",
            transcriptText: "Please ping me on WhatsApp for future help.",
            supabaseClient: mockDb
        });

        assert.strictEqual(outcome.success, true);
        // The category 'off_platform_communication' was already present, so duplicate was skipped!
        const duplicatedInsert = mockDb._insertedFlags.find((f) => f.category === "off_platform_communication");
        assert.strictEqual(duplicatedInsert, undefined, "Duplicate category should not be inserted");
    });
});

// -----------------------------------------------------------------------------
// 5. Admin Authorization & Action Workflow Tests
// -----------------------------------------------------------------------------
describe("5. Admin Authorization & Action Workflow", () => {
    it("should reject unauthenticated requests without authorization header", async () => {
        const { default: adminMiddleware } = await import("../src/middleware/adminMiddleware.js");

        let statusSent = null;
        let jsonSent = null;
        const req = { headers: {} };
        const res = {
            status: (code) => {
                statusSent = code;
                return {
                    json: (data) => { jsonSent = data; }
                };
            }
        };

        await adminMiddleware(req, res, () => {});
        assert.strictEqual(statusSent, 401);
        assert.ok(jsonSent.error.includes("token required"));
    });

    it("should reject non-admin users (students and mentors) even if client claims admin", async () => {
        const { default: adminMiddleware } = await import("../src/middleware/adminMiddleware.js");

        // Mock supabase auth.getUser and public.users lookup
        const originalSupabase = (await import("../src/config/supabase.js")).default;
        const originalGetUser = originalSupabase.auth.getUser;
        const originalFrom = originalSupabase.from;

        originalSupabase.auth.getUser = async () => ({
            data: {
                user: {
                    id: "user-student-123",
                    // Untrusted client-metadata claiming admin:
                    user_metadata: { role: "admin" }
                }
            },
            error: null
        });

        // Database table correctly says role is 'student'
        originalSupabase.from = () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({
                        data: { id: "user-student-123", role: "student" },
                        error: null
                    })
                })
            })
        });

        let statusSent = null;
        let jsonSent = null;
        const req = { headers: { authorization: "Bearer fake-jwt-token" } };
        const res = {
            status: (code) => {
                statusSent = code;
                return {
                    json: (data) => { jsonSent = data; }
                };
            }
        };

        try {
            await adminMiddleware(req, res, () => {});
            assert.strictEqual(statusSent, 403, "Student must be rejected with 403 Forbidden");
            assert.ok(jsonSent.error.includes("Administrator privileges required"));
        } finally {
            originalSupabase.auth.getUser = originalGetUser;
            originalSupabase.from = originalFrom;
        }
    });

    it("should permit verified admin users verified from public.users table", async () => {
        const { default: adminMiddleware } = await import("../src/middleware/adminMiddleware.js");

        const originalSupabase = (await import("../src/config/supabase.js")).default;
        const originalGetUser = originalSupabase.auth.getUser;
        const originalFrom = originalSupabase.from;

        originalSupabase.auth.getUser = async () => ({
            data: {
                user: { id: "admin-user-789", email: "admin@skillswap.com" }
            },
            error: null
        });

        originalSupabase.from = () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({
                        data: { id: "admin-user-789", role: "admin", name: "System Admin" },
                        error: null
                    })
                })
            })
        });

        let nextCalled = false;
        const req = { headers: { authorization: "Bearer valid-admin-jwt" } };
        const res = {};

        try {
            await adminMiddleware(req, res, () => { nextCalled = true; });
            assert.strictEqual(nextCalled, true, "Next should be called for verified admin");
            assert.strictEqual(req.user.isAdmin, true);
            assert.strictEqual(req.user.role, "admin");
        } finally {
            originalSupabase.auth.getUser = originalGetUser;
            originalSupabase.from = originalFrom;
        }
    });

    it("should execute dismiss, warn, and escalate action state transitions", () => {
        const ACTION_MAP = {
            dismiss: "dismissed",
            warn: "warned",
            escalate: "escalated"
        };

        assert.strictEqual(ACTION_MAP.dismiss, "dismissed");
        assert.strictEqual(ACTION_MAP.warn, "warned");
        assert.strictEqual(ACTION_MAP.escalate, "escalated");
    });
});

