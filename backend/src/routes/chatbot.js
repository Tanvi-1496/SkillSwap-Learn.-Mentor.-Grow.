/**
 * Chatbot & Session Intelligence API Routes
 *
 * Endpoints:
 * - POST   /chatbot/message                  - Send prompt to Evon 30B Learning Companion
 * - GET    /chatbot/history                  - Retrieve authenticated user's conversation history
 * - DELETE /chatbot/history                  - Clear conversation history
 * - POST   /chatbot/session-insights/:id     - Generate/cache post-session intelligence from transcript
 * - GET    /chatbot/session-insights/:id     - Retrieve cached post-session intelligence
 *
 * All routes require verified Supabase JWT authentication.
 */

import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    processChatbotTurn,
    getConversationHistory,
    clearConversationHistory
} from "../services/chatbotService.js";
import { generateOrGetSessionInsights } from "../services/sessionInsightsService.js";

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
    return typeof str === "string" && UUID_REGEX.test(str.trim());
}

// -----------------------------------------------------------------------------
// POST /chatbot/message
// Authenticated student/mentor conversation with Gnani Evon 30B Companion
// -----------------------------------------------------------------------------
router.post("/message", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, history } = req.body || {};

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Message is required and must be a non-empty string"
            });
        }

        if (message.length > 4000) {
            return res.status(400).json({
                error: "Message exceeds maximum length limit of 4000 characters"
            });
        }

        const result = await processChatbotTurn({
            userId,
            message: message.trim(),
            clientHistory: Array.isArray(history) ? history : []
        });

        if (!result.success) {
            return res.status(502).json({
                error: result.error || "Failed to generate AI companion response",
                isMock: result.isMock,
                model: result.model
            });
        }

        return res.status(200).json({
            success: true,
            reply: result.reply,
            message_type: result.messageType,
            metadata: result.metadata,
            persisted: result.persisted,
            is_mock: result.isMock,
            model: result.model
        });
    } catch (err) {
        console.error("POST /chatbot/message unhandled error:", err);
        return res.status(500).json({ error: "Internal server error processing chat message" });
    }
});

// -----------------------------------------------------------------------------
// GET /chatbot/history
// Retrieves authenticated user's conversation history
// -----------------------------------------------------------------------------
router.get("/history", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const historyResult = await getConversationHistory(userId, 20);

        return res.status(200).json({
            success: true,
            messages: historyResult.messages,
            persisted: historyResult.persisted
        });
    } catch (err) {
        console.error("GET /chatbot/history unhandled error:", err);
        return res.status(500).json({ error: "Internal server error fetching chat history" });
    }
});

// -----------------------------------------------------------------------------
// DELETE /chatbot/history
// Clears authenticated user's conversation history
// -----------------------------------------------------------------------------
router.delete("/history", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await clearConversationHistory(userId);

        if (!result.success) {
            return res.status(500).json({ error: result.error || "Failed to clear chat history" });
        }

        return res.status(200).json({
            success: true,
            message: "Conversation history cleared successfully"
        });
    } catch (err) {
        console.error("DELETE /chatbot/history unhandled error:", err);
        return res.status(500).json({ error: "Internal server error clearing chat history" });
    }
});

// -----------------------------------------------------------------------------
// POST /chatbot/session-insights/:bookingId
// Generates & caches 6 structured learning takeaways from completed session transcript
// -----------------------------------------------------------------------------
router.post("/session-insights/:bookingId", authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role || "student";

        if (!isValidUUID(bookingId)) {
            return res.status(400).json({ error: "Invalid booking ID format" });
        }

        const result = await generateOrGetSessionInsights(bookingId, userId, userRole);

        if (!result.success) {
            return res.status(result.statusCode || 500).json({
                error: result.error || "Failed to generate session insights",
                booking_id: bookingId
            });
        }

        return res.status(200).json({
            success: true,
            booking_id: bookingId,
            insights: result.insights,
            cached: result.cached,
            is_mock: result.isMock,
            model: result.model
        });
    } catch (err) {
        console.error("POST /chatbot/session-insights unhandled error:", err);
        return res.status(500).json({ error: "Internal server error generating session insights" });
    }
});

// -----------------------------------------------------------------------------
// GET /chatbot/session-insights/:bookingId
// Retrieves cached structured insights for an authorized completed session
// -----------------------------------------------------------------------------
router.get("/session-insights/:bookingId", authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role || "student";

        if (!isValidUUID(bookingId)) {
            return res.status(400).json({ error: "Invalid booking ID format" });
        }

        const result = await generateOrGetSessionInsights(bookingId, userId, userRole);

        if (!result.success) {
            return res.status(result.statusCode || 500).json({
                error: result.error || "Failed to retrieve session insights",
                booking_id: bookingId
            });
        }

        return res.status(200).json({
            success: true,
            booking_id: bookingId,
            insights: result.insights,
            cached: result.cached,
            is_mock: result.isMock,
            model: result.model
        });
    } catch (err) {
        console.error("GET /chatbot/session-insights unhandled error:", err);
        return res.status(500).json({ error: "Internal server error fetching session insights" });
    }
});

export default router;

