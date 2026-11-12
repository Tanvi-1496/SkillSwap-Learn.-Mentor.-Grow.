/**
 * Gnani Evon 30B AI Service
 *
 * Communicates with Gnani Evon v3.3-30B-A3B via OpenAI-compatible chat completion endpoints
 * (e.g., Hugging Face Dedicated Inference Endpoints, vLLM, SGLang, or private enterprise gateway).
 *
 * Model: gnani/gnani-evon-v3.3-30B-A3B
 * Hybrid Mamba-Transformer Mixture-of-Experts (MoE, 30B total / 3.5B active parameters per token).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const DEFAULT_EVON_MODEL = process.env.EVON_MODEL || "gnani/gnani-evon-v3.3-30B-A3B";

/**
 * Normalizes an OpenAI-compatible inference URL so either a base `/v1` URL
 * or full `/v1/chat/completions` URL works seamlessly.
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeEvonChatUrl(rawUrl = "") {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (/\/v1\/?$/i.test(trimmed)) {
        return `${trimmed.replace(/\/+$/, "")}/chat/completions`;
    }
    return trimmed;
}

/**
 * Reads Evon configuration dynamically from process.env so changes from dotenv
 * or runtime environment overrides are always respected.
 */
export function getEvonConfig() {
    const apiUrl = normalizeEvonChatUrl(process.env.EVON_API_URL || "");
    const apiKey = (process.env.EVON_API_KEY || "").trim();
    const model = (process.env.EVON_MODEL || DEFAULT_EVON_MODEL).trim();
    const parsedTimeout = parseInt(process.env.EVON_TIMEOUT_MS || "30000", 10);
    const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

    return {
        apiUrl,
        apiKey,
        model,
        timeoutMs
    };
}

/**
 * Checks if live Evon 30B inference credentials and endpoint are configured.
 * Rejects empty values or untouched .env.example placeholders.
 * @returns {boolean}
 */
export function isEvonConfigured() {
    const { apiUrl, apiKey } = getEvonConfig();
    if (!apiUrl || !apiKey) return false;
    if (apiKey === "your-evon-api-key") return false;
    if (apiUrl.includes("your-evon-inference-endpoint.com")) return false;
    return true;
}

/**
 * Generates an offline simulated response based on the conversation messages and context.
 * Used for automated tests, offline local development, and when no active 30B GPU endpoint is attached.
 * Clearly flags isMock: true to ensure simulated results are never misrepresented as live.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string}
 */
export function generateSimulatedEvonResponse(messages = []) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const lower = lastUserMsg.toLowerCase();

    // 1. Learning Roadmap requests
    if (lower.includes("roadmap") || lower.includes("learning plan")) {
        let topic = "Full-Stack Web Development";
        if (lower.includes("react")) topic = "React & Modern Frontend";
        else if (lower.includes("python")) topic = "Python Programming";
        else if (lower.includes("ml") || lower.includes("machine learning") || lower.includes("ai")) topic = "Machine Learning & AI";
        else if (lower.includes("dsa") || lower.includes("data structure") || lower.includes("algorithm")) topic = "Data Structures & Algorithms";
        else if (lower.includes("backend") || lower.includes("node") || lower.includes("java")) topic = "Backend Engineering";

        return `### 🗺️ ${topic} Learning Roadmap (Powered by Gnani Evon 30B)

Here is a structured, milestone-driven roadmap designed to take you from foundational concepts to production-grade deployment:

#### Milestone 1: Core Foundations (Weeks 1–2)
- **Objective:** Master syntax, fundamental mental models, and environment setup.
- **Topics:** Architecture basics, data types, control flow, functions, and memory/scope.
- **Practical Exercise:** Build 3 small command-line utilities or isolated modules.

#### Milestone 2: Intermediate Patterns & Tooling (Weeks 3–4)
- **Objective:** Understand component/modular architecture and data flow.
- **Topics:** State management, API integration, error boundaries, and modern toolchains.
- **Practical Exercise:** Implement an interactive data dashboard consuming a public REST API.

#### Milestone 3: Databases & Persistence (Weeks 5–6)
- **Objective:** Design robust data layers with relational and non-relational storage.
- **Topics:** SQL normalization, indexing, transactions, and ORM/query builders.
- **Practical Exercise:** Model an entity-relationship schema for an e-commerce or booking system.

#### Milestone 4: Production Deployment & Capstone (Weeks 7–8)
- **Objective:** Deploy, monitor, and optimize a full-stack portfolio capstone.
- **Topics:** Containerization (Docker), CI/CD pipelines, security audits, and cloud deployment.
- **Milestone Project:** Build and host a live full-stack application with authentication and unit tests.

💡 *Next Step:* Would you like to schedule a 1-on-1 session with a verified SkillSwap mentor to review your code and milestones?`;
    }

    // 2. Project Suggestions requests
    if (lower.includes("project") || lower.includes("portfolio")) {
        return `### 💡 Curated Portfolio Projects (Powered by Gnani Evon 30B)

Here are 3 production-grade project ideas tailored for your skill growth and tech interview portfolio:

1. **Distributed Task Scheduler & Job Queue**
   - **Problem Solved:** Manages asynchronous background processing with retry logic and rate limits.
   - **Recommended Stack:** Node.js/Python, Redis, PostgreSQL, and Docker.
   - **Key Features:** Worker concurrency pools, exponential backoff, dead-letter queues, and real-time dashboard.
   - **Extension:** Add webhook alerting for failed tasks.

2. **Real-Time Collaborative Code Review Sandbox**
   - **Problem Solved:** Allows peer developers and mentors to review code snippets with syntax highlighting.
   - **Recommended Stack:** React, Tailwind CSS, Node.js, WebSockets, and Monaco Editor.
   - **Key Features:** Live cursor synchronization, inline commenting, markdown preview, and version diffing.
   - **Extension:** Integrate automated linting checks on save.

3. **Intelligent Query Assistant for Documentation**
   - **Problem Solved:** Semantic document search over developer documentation or textbooks.
   - **Recommended Stack:** Python (FastAPI), pgvector, LangChain/LlamaIndex, and React.
   - **Key Features:** Document chunking, vector embeddings, similarity search, and source citations.
   - **Extension:** Add multi-language query support (Indic scripts).

💡 *Pro Tip:* Choose one project and build it with clean git commits, unit tests, and a live demo link!`;
    }

    // 3. Technical Interview Preparation
    if (lower.includes("interview") || lower.includes("placement") || lower.includes("dsa")) {
        return `### 🎯 Technical Interview Preparation Guide (Powered by Gnani Evon 30B)

To excel in technical interviews for software engineering roles, focus on these three core evaluation pillars:

#### 1. Data Structures & Algorithms (Problem Solving)
- **Must-Know Topics:** Two Pointers, Sliding Window, Fast & Slow Pointers, BFS/DFS Tree Traversal, Graph Topo-Sort, and Dynamic Programming fundamentals.
- **Strategy:** Solve 2 problems daily on LeetCode/NeetCode. Focus on pattern recognition rather than memorizing solutions.
- **Communication:** Always verbalize your brute-force approach first ($O(N^2)$), analyze its bottlenecks, then optimize before writing code.

#### 2. System Design & Database Architecture
- **Topics:** Horizontal vs. Vertical Scaling, Load Balancing, Caching strategies (Redis Cache-Aside), Database Indexing (B-Trees), and ACID transactions.
- **Practice Question:** "How would you design a rate limiter or URL shortening service?"

#### 3. Behavioral & Project Deep Dives
- Use the **STAR method** (Situation, Task, Action, Result) to explain your past projects.
- Be prepared to discuss: *"What was the most difficult bug you encountered and how did you resolve it?"*

💡 *Recommendation:* Book a mock interview with a SkillSwap mentor to practice live coding under real interview conditions.`;
    }

    // 4. Code Debugging / Technical Explanation
    if (lower.includes("bug") || lower.includes("error") || lower.includes("debug") || lower.includes("code") || lower.includes("function") || lower.includes("how to")) {
        return `### 🛠️ Technical Solution & Code Explanation (Powered by Gnani Evon 30B)

Let's break down this concept step by step:

#### Key Concept & Root Cause
When working with asynchronous operations and state in modern web applications, the most common issues stem from:
1. **Uncaught Promise Rejections:** Forgetting to wrap \`await\` calls in \`try/catch\` blocks.
2. **Stale Closures:** Reading state variables inside asynchronous callbacks that captured older values.
3. **Missing Resource Cleanup:** Failing to abort in-flight HTTP requests or disconnect listeners when components unmount.

#### Recommended Implementation Pattern:
\`\`\`javascript
async function handleSafeExecution(taskPromise) {
    try {
        const result = await taskPromise;
        return { success: true, data: result };
    } catch (error) {
        console.error("Execution failure:", error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred"
        };
    }
}
\`\`\`

#### Verification Steps:
- Check that all asynchronous dependencies are properly resolved.
- Verify environment variables and network endpoints are reachable.
- Add descriptive error logging to capture boundary exceptions.

Would you like me to analyze a specific code snippet or error message you're seeing?`;
    }

    // 5. General Contextual Mentorship Assistance
    return `### ✨ SkillSwap Learning Companion (Powered by Gnani Evon 30B)

Hello! I am your AI learning companion on SkillSwap, powered by the **Gnani Evon 30B** architecture. I'm here to support your technical growth through:

- **Technical Q&A & Code Debugging:** Clear explanations for Python, JavaScript, React, Node.js, C++, SQL, and DSA.
- **Personalized Roadmaps:** Customized study schedules aligned with your career goals and semester.
- **Project Ideation:** Production-ready portfolio project suggestions.
- **Interview Preparation:** Coding patterns, mock interview questions, and system design tradeoffs.
- **Mentorship Session Prep:** Preparing high-impact questions for your upcoming mentor bookings.

How can I assist your learning journey today?`;
}

/**
 * Sends a chat completion request to the Gnani Evon 30B model or returns
 * an offline simulated response when live inference credentials are not configured.
 *
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages - Ordered list of message objects
 * @param {string} [options.systemPrompt] - Optional system prompt instruction
 * @param {number} [options.temperature] - Sampling temperature (0.0 - 1.0, default 0.7)
 * @param {number} [options.maxTokens] - Maximum generation tokens (default 1024)
 * @returns {Promise<{
 *   success: boolean,
 *   content: string,
 *   model: string,
 *   isMock: boolean,
 *   usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number },
 *   error?: string
 * }>}
 */
export async function generateEvonChatCompletion({
    messages = [],
    systemPrompt = "",
    temperature = 0.7,
    maxTokens = 1024
}) {
    const config = getEvonConfig();

    if (!Array.isArray(messages) || messages.length === 0) {
        return {
            success: false,
            content: "",
            model: config.model,
            isMock: false,
            error: "Messages array cannot be empty"
        };
    }

    const isProduction = process.env.NODE_ENV === "production";
    const isExplicitMock = process.env.EVON_MOCK === "true";
    const isTestMode = process.env.NODE_ENV === "test";

    // 1. Mock Mode Safety: In production, missing credentials must fail visibly
    if (isProduction && !isEvonConfigured()) {
        console.error("[EvonService] FATAL: EVON_API_URL and EVON_API_KEY must be configured in production.");
        return {
            success: false,
            content: "",
            model: config.model,
            isMock: false,
            error: "CRITICAL CONFIGURATION ERROR: Live Evon 30B credentials are required in production."
        };
    }

    // 2. Simulated Mode: For unit tests, offline local development, or when EVON_MOCK is active
    if (isExplicitMock || (isTestMode && process.env.EVON_LIVE !== "true") || !isEvonConfigured()) {
        const simulatedText = generateSimulatedEvonResponse(messages);
        return {
            success: true,
            content: simulatedText,
            model: `${config.model} (simulated)`,
            isMock: true,
            usage: {
                prompt_tokens: 150,
                completion_tokens: 280,
                total_tokens: 430
            }
        };
    }

    // 3. Live Inference Request (OpenAI-compatible /v1/chat/completions schema)
    const formattedMessages = [];
    if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
        formattedMessages.push({ role: "system", content: systemPrompt.trim() });
    }
    for (const msg of messages) {
        if (msg && typeof msg.content === "string") {
            formattedMessages.push({
                role: msg.role === "assistant" ? "assistant" : "user",
                content: msg.content
            });
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        const response = await fetch(config.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
                "X-API-Key-ID": config.apiKey // Supports both standard Bearer and Gnani API key headers
            },
            body: JSON.stringify({
                model: config.model,
                messages: formattedMessages,
                temperature,
                max_tokens: maxTokens
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorDetail = `Evon API error status ${response.status}`;
            try {
                const errJson = await response.json();
                errorDetail = errJson.error?.message || errJson.message || errorDetail;
            } catch {
                const errText = await response.text();
                if (errText) errorDetail = errText.slice(0, 200);
            }
            console.error(`[EvonService] API Error (${response.status}):`, errorDetail);
            return {
                success: false,
                content: "",
                model: config.model,
                isMock: false,
                error: errorDetail
            };
        }

        const data = await response.json();
        const content =
            data.choices?.[0]?.message?.content ||
            data.content ||
            data.text ||
            "";

        if (!content.trim()) {
            return {
                success: false,
                content: "",
                model: config.model,
                isMock: false,
                error: "Evon API returned an empty completion"
            };
        }

        return {
            success: true,
            content: content.trim(),
            model: data.model || config.model,
            isMock: false,
            usage: data.usage || null
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
            return {
                success: false,
                content: "",
                model: config.model,
                isMock: false,
                error: `Evon 30B API request timed out after ${config.timeoutMs / 1000} seconds`
            };
        }
        console.error("[EvonService] Request exception:", err);
        return {
            success: false,
            content: "",
            model: config.model,
            isMock: false,
            error: err.message || "Failed to communicate with Evon 30B service"
        };
    }
}

export default {
    generateEvonChatCompletion,
    generateSimulatedEvonResponse,
    isEvonConfigured,
    getEvonConfig,
    DEFAULT_EVON_MODEL
};
