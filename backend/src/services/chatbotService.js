/**
 * Chatbot Learning Companion Service
 *
 * Assembles student profile context, enforces token-conscious history limits,
 * crafts pedagogically sound system instructions, and interfaces with the Gnani Evon 30B service.
 */

import supabase from "../config/supabase.js";
import { generateEvonChatCompletion } from "./evonService.js";

const MAX_HISTORY_MESSAGES = 8; // Preserves context without exceeding token window

/**
 * Retrieves verified student profile context and recent mentorship activity.
 *
 * @param {string} userId - UUID of the authenticated student
 * @returns {Promise<object>}
 */
export async function getStudentProfileContext(userId) {
    if (!userId) return null;

    try {
        const [userRes, profileRes, bookingsRes] = await Promise.all([
            supabase
                .from("users")
                .select("id, name, email, role, dept")
                .eq("id", userId)
                .maybeSingle(),
            supabase
                .from("student_profiles")
                .select("skills, career_goal, learning_requirement, level, semester")
                .eq("user_id", userId)
                .maybeSingle(),
            supabase
                .from("bookings")
                .select("id, topic, date, status")
                .eq("student_id", userId)
                .in("status", ["confirmed", "completed"])
                .order("date", { ascending: false })
                .limit(3)
        ]);

        const user = userRes.data;
        const profile = profileRes.data;
        const recentBookings = bookingsRes.data || [];

        return {
            name: user?.name || "Student",
            dept: user?.dept || "Engineering",
            skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : (profile?.skills || "Not specified"),
            careerGoal: profile?.career_goal || "Software Engineering",
            learningRequirement: profile?.learning_requirement || "Full Stack & Core CS",
            level: profile?.level || "Intermediate",
            semester: profile?.semester ? `${profile.semester}th Semester` : "Undergraduate",
            recentTopics: recentBookings.map((b) => b.topic).filter(Boolean)
        };
    } catch (err) {
        console.warn("[ChatbotService] Profile context retrieval warning:", err.message);
        return null;
    }
}

/**
 * Fetches recent conversation history from the database.
 * Returns empty array if table has not been migrated or on lookup failure.
 *
 * @param {string} userId
 * @param {number} [limit=MAX_HISTORY_MESSAGES]
 * @returns {Promise<{ messages: Array<object>, persisted: boolean }>}
 */
export async function getConversationHistory(userId, limit = MAX_HISTORY_MESSAGES) {
    if (!userId) return { messages: [], persisted: false };

    try {
        const { data, error } = await supabase
            .from("chat_messages")
            .select("id, role, content, message_type, metadata, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            // If table doesn't exist yet in Supabase (PGRST205 or similar)
            return { messages: [], persisted: false };
        }

        const chronological = (data || []).reverse().map((msg) => ({
            id: msg.id,
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
            messageType: msg.message_type || "text",
            metadata: msg.metadata || {},
            createdAt: msg.created_at
        }));

        return { messages: chronological, persisted: true };
    } catch (err) {
        console.warn("[ChatbotService] History fetch warning:", err.message);
        return { messages: [], persisted: false };
    }
}

/**
 * Persists a message to the database.
 * Returns { saved: boolean, error?: string }.
 *
 * @param {string} userId
 * @param {string} role - 'user' | 'assistant'
 * @param {string} content
 * @param {string} [messageType='text']
 * @param {object} [metadata={}]
 * @returns {Promise<{ saved: boolean, messageId?: string, error?: string }>}
 */
export async function persistChatMessage(userId, role, content, messageType = "text", metadata = {}) {
    if (!userId || !content) return { saved: false, error: "Missing required fields" };

    try {
        const { data, error } = await supabase
            .from("chat_messages")
            .insert({
                user_id: userId,
                role: role === "assistant" ? "assistant" : "user",
                content,
                message_type: messageType,
                metadata: metadata || {}
            })
            .select("id")
            .single();

        if (error) {
            return { saved: false, error: error.message };
        }

        return { saved: true, messageId: data?.id };
    } catch (err) {
        return { saved: false, error: err.message };
    }
}

/**
 * Clears all conversation history for an authenticated student.
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function clearConversationHistory(userId) {
    if (!userId) return { success: false, error: "User ID required" };

    try {
        const { error } = await supabase
            .from("chat_messages")
            .delete()
            .eq("user_id", userId);

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Constructs the specialized system prompt for the Gnani Evon 30B Learning Companion.
 *
 * @param {object|null} profileContext
 * @returns {string}
 */
export function buildCompanionSystemPrompt(profileContext) {
    let contextBlock = "Student Profile: Context not yet configured.";

    if (profileContext) {
        contextBlock = `Verified Student Profile:
- Name: ${profileContext.name} (${profileContext.dept}, ${profileContext.semester})
- Current Skills: ${profileContext.skills}
- Career Goal: ${profileContext.careerGoal}
- Primary Learning Focus: ${profileContext.learningRequirement}
- Experience Level: ${profileContext.level}
${profileContext.recentTopics.length > 0 ? `- Recent Mentorship Topics: ${profileContext.recentTopics.join(", ")}` : ""}`;
    }

    return `You are SkillSwap AI, an intelligent, empathetic academic and technical learning companion powered by the Gnani Evon 30B architecture.
Your mission is to help students learn technical subjects, master programming, build impressive software projects, prepare for technical interviews, and maximize the value of their peer mentorship sessions.

${contextBlock}

Core Capabilities & Guidelines:
1. Programming Assistance: Help with Python, Java, C, C++, JavaScript, React, Node.js, SQL, DBMS, DSA, and Machine Learning.
2. Pedagogical Style: Explain the "why" behind concepts. Provide clean, well-commented code snippets. Help students understand bugs rather than just giving a silent fix.
3. Personalization: Adapt explanations to the student's declared experience level (${profileContext?.level || "Intermediate"}). When they ask for advice, ground your answers in their verified skills and career goals. Do not invent profile information that is not in the context.
4. Roadmaps: When asked for a roadmap or learning plan, provide milestone-based, realistic timelines with practical exercises and suggested mini-projects.
5. Project Ideas: Suggest real-world, resume-worthy projects with problem statements, tech stacks, and implementation milestones.
6. Mentorship Bridge: Where helpful, encourage the student to discuss their doubts or code reviews in a 1-on-1 session with a verified SkillSwap mentor.
7. Tone: Encouraging, concise, technically rigorous, and formatted with clean markdown headings and code blocks.`;
}

/**
 * Detects special message types (roadmap, project, interview) based on prompt & content.
 *
 * @param {string} userMessage
 * @param {string} assistantContent
 * @returns {string} 'text' | 'roadmap' | 'project' | 'interview'
 */
export function detectMessageType(userMessage = "", assistantContent = "") {
    const combined = `${userMessage} ${assistantContent}`.toLowerCase();
    if (combined.includes("roadmap") || combined.includes("milestone 1") || combined.includes("learning plan")) {
        return "roadmap";
    }
    if (combined.includes("project idea") || combined.includes("portfolio project") || combined.includes("problem solved:")) {
        return "project";
    }
    if (combined.includes("mock interview") || combined.includes("interview preparation") || combined.includes("neetcode") || combined.includes("star method")) {
        return "interview";
    }
    return "text";
}

/**
 * Main chat completion pipeline for the SkillSwap AI Companion.
 *
 * @param {Object} params
 * @param {string} params.userId - Authenticated user UUID
 * @param {string} params.message - Latest user prompt
 * @param {Array<object>} [params.clientHistory] - Optional client-supplied history fallback
 * @returns {Promise<{
 *   success: boolean,
 *   reply: string,
 *   messageType: string,
 *   metadata: object,
 *   persisted: boolean,
 *   isMock: boolean,
 *   model: string,
 *   error?: string
 * }>}
 */
export async function processChatbotTurn({ userId, message, clientHistory = [] }) {
    if (!message || typeof message !== "string" || !message.trim()) {
        return {
            success: false,
            reply: "",
            messageType: "text",
            metadata: {},
            persisted: false,
            isMock: false,
            model: "gnani/gnani-evon-v3.3-30B-A3B",
            error: "User message cannot be empty"
        };
    }

    // 1. Fetch authorized student profile context
    const profileContext = await getStudentProfileContext(userId);

    // 2. Fetch recent conversation history
    const historyResult = await getConversationHistory(userId, MAX_HISTORY_MESSAGES);
    let messagesToPass = historyResult.messages;

    // Fallback to client history if database history is empty
    if (messagesToPass.length === 0 && Array.isArray(clientHistory) && clientHistory.length > 0) {
        messagesToPass = clientHistory.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
            role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
            content: m.content
        }));
    }

    // Append current user message
    messagesToPass.push({
        role: "user",
        content: message.trim()
    });

    // 3. Build system instruction
    const systemPrompt = buildCompanionSystemPrompt(profileContext);

    // 4. Generate completion via Evon 30B service
    const evonResult = await generateEvonChatCompletion({
        messages: messagesToPass,
        systemPrompt,
        temperature: 0.7,
        maxTokens: 1024
    });

    if (!evonResult.success) {
        return {
            success: false,
            reply: "",
            messageType: "text",
            metadata: {},
            persisted: false,
            isMock: evonResult.isMock,
            model: evonResult.model,
            error: evonResult.error || "Failed to generate AI companion response"
        };
    }

    const replyText = evonResult.content;
    const messageType = detectMessageType(message, replyText);

    // 5. Persist both user and assistant turns to database
    let persisted = false;
    if (userId) {
        const [uSave, aSave] = await Promise.all([
            persistChatMessage(userId, "user", message.trim(), "text"),
            persistChatMessage(userId, "assistant", replyText, messageType, {
                model: evonResult.model,
                isMock: evonResult.isMock
            })
        ]);
        persisted = uSave.saved && aSave.saved;
    }

    return {
        success: true,
        reply: replyText,
        messageType,
        metadata: {
            isRoadmap: messageType === "roadmap",
            isProject: messageType === "project",
            isInterview: messageType === "interview"
        },
        persisted,
        isMock: evonResult.isMock,
        model: evonResult.model
    };
}

export default {
    getStudentProfileContext,
    getConversationHistory,
    persistChatMessage,
    clearConversationHistory,
    buildCompanionSystemPrompt,
    detectMessageType,
    processChatbotTurn
};

