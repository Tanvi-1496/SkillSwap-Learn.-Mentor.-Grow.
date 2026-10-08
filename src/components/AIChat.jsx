import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

const suggestions = [
    "What do you know about my profile, and what should I learn next?",
    "Create a personalized learning roadmap",
    "Help me prepare for an interview",
    "Suggest project ideas for my portfolio",
    "Which skills should I focus on for placements?",
];

const initialMessages = [
    {
        role: "ai",
        content: "Hi! I'm SkillSwap AI — your personal learning and career assistant. I can help you find mentors, build roadmaps, prepare for interviews, and more. What would you like to work on today?",
    },
];

function getRoadmapConfig(profile) {
    const focus = profile?.learning_requirement || profile?.career_goal || "Python Fundamentals";
    const topic = focus.toLowerCase();

    if (topic.includes("react") || topic.includes("frontend") || topic.includes("web")) {
        return {
            title: `🗺️ ${focus} Learning Roadmap`,
            mentorTopic: "React & Frontend Development",
            items: [
                { week: "Week 1-2", topic: "React Fundamentals, Components & JSX", done: true },
                { week: "Week 3-4", topic: "State, Props & Core Hooks (useState, useEffect)", done: true },
                { week: "Week 5-6", topic: "Routing (React Router) & API Integration", done: false },
                { week: "Week 7-8", topic: "State Management (Context API / Zustand)", done: false },
                { week: "Week 9-10", topic: "Styling with Tailwind CSS & Component UI", done: false },
                { week: "Week 11-12", topic: "Portfolio Production Project & Deployment", done: false },
            ]
        };
    }

    if (topic.includes("data") || topic.includes("python") || topic.includes("ml") || topic.includes("machine learning") || topic.includes("ai")) {
        return {
            title: `🗺️ ${focus} Learning Roadmap`,
            mentorTopic: "Data Science & Machine Learning",
            items: [
                { week: "Week 1-2", topic: "Python Basics & Core Data Structures", done: true },
                { week: "Week 3-4", topic: "NumPy & Data Manipulation with Pandas", done: true },
                { week: "Week 5-6", topic: "Data Visualization & Exploratory Analysis", done: false },
                { week: "Week 7-8", topic: "Supervised Learning with Scikit-learn", done: false },
                { week: "Week 9-10", topic: "Model Evaluation & Neural Networks", done: false },
                { week: "Week 11-12", topic: "End-to-End Capstone Project", done: false },
            ]
        };
    }

    if (topic.includes("backend") || topic.includes("node") || topic.includes("java") || topic.includes("cloud")) {
        return {
            title: `🗺️ ${focus} Learning Roadmap`,
            mentorTopic: "Backend Engineering",
            items: [
                { week: "Week 1-2", topic: "Language Fundamentals & OOP Concepts", done: true },
                { week: "Week 3-4", topic: "RESTful API Architecture & Routing", done: true },
                { week: "Week 5-6", topic: "Relational Database Design & SQL", done: false },
                { week: "Week 7-8", topic: "Authentication (JWT, OAuth) & Middleware", done: false },
                { week: "Week 9-10", topic: "Caching, Async Architecture & Testing", done: false },
                { week: "Week 11-12", topic: "Docker, CI/CD & Cloud Deployment", done: false },
            ]
        };
    }

    return {
        title: `🗺️ ${focus} Learning Roadmap`,
        mentorTopic: focus,
        items: [
            { week: "Week 1-2", topic: "Core Fundamentals & Tooling Setup", done: true },
            { week: "Week 3-4", topic: "Essential Libraries & Problem Solving", done: true },
            { week: "Week 5-6", topic: "Architectural Patterns & Best Practices", done: false },
            { week: "Week 7-8", topic: "Practical Real-World Mini Projects", done: false },
            { week: "Week 9-10", topic: "Advanced Concepts & Performance Optimization", done: false },
            { week: "Week 11-12", topic: "Portfolio Production Deployment", done: false },
        ]
    };
}

function generatePersonalizedAdvice(profile) {
    const skills = profile.skills || "Not specified yet";
    const goal = profile.career_goal || "Software Engineering";
    const requirement = profile.learning_requirement || "Skills Enhancement";
    const level = profile.level || "Intermediate";
    const semester = profile.semester ? `${profile.semester}th Semester` : "Enrolled Student";

    // Tailor next recommended skills specifically to learning_requirement and career_goal
    let nextSkills = [];
    const combined = `${goal} ${requirement} ${skills}`.toLowerCase();

    if (combined.includes("react") || combined.includes("frontend") || combined.includes("web")) {
        nextSkills = [
            "Component lifecycle, JSX composition, and core React Hooks (`useState`, `useEffect`, `useCallback`)",
            "State management & routing with React Router and Zustand or Redux Toolkit",
            "Modern UI component architecture using Tailwind CSS and TypeScript",
            "Asynchronous state management with REST APIs and React Query",
            "Production build optimization, responsive accessibility, and Next.js foundations"
        ];
    } else if (combined.includes("ml") || combined.includes("machine learning") || combined.includes("data science") || combined.includes("ai")) {
        nextSkills = [
            "Data manipulation pipelines with NumPy, Pandas, and feature engineering",
            "Supervised and unsupervised model training with Scikit-learn",
            "Deep learning foundations with PyTorch or TensorFlow",
            "Model deployment as microservices using FastAPI and Docker",
            "End-to-end portfolio projects on real-world Kaggle datasets"
        ];
    } else if (combined.includes("backend") || combined.includes("java") || combined.includes("cloud")) {
        nextSkills = [
            "Advanced OOP and backend architecture design patterns",
            "Database normalization, indexing, and transactional integrity in SQL",
            "Authentication, JWT tokens, RBAC authorization, and API security",
            "Microservices, asynchronous task queues, and containerization with Docker",
            "High-concurrency system design and cloud deployment (AWS/GCP)"
        ];
    } else {
        nextSkills = [
            `Deep dive into ${requirement} fundamentals and syntax`,
            `Bridge project milestones geared specifically toward your goal as a ${goal}`,
            "Data structures, algorithms, and practical problem solving",
            "Version control workflows, unit testing, and CI/CD pipelines",
            "Code reviews and 1-on-1 mentorship sessions with an experienced industry mentor"
        ];
    }

    return `Here is your personalized learning plan based on your verified profile:

1. **What you already know:**
• Current Skills: ${skills}

2. **Career Goal:**
• ${goal} (${semester})

3. **Learning Requirement:**
• ${requirement}

4. **Current Level:**
• ${level}

5. **Recommended Next Skills:**
${nextSkills.map(s => `• ${s}`).join("\n")}

💡 Would you like me to find you a mentor who specializes in ${requirement || goal}?`;
}

function getAIResponse(input, profile) {
    const lower = input.toLowerCase();

    // Check if the user is asking about their profile or what to learn next
    const isProfileQuery =
        lower.includes("profile") ||
        lower.includes("what should i learn next") ||
        lower.includes("career goal") ||
        lower.includes("learning requirement") ||
        lower.includes("my skills") ||
        lower.includes("what do you know") ||
        lower.includes("recommend");

    if (isProfileQuery && profile && (profile.skills || profile.career_goal || profile.learning_requirement)) {
        return {
            role: "ai",
            content: generatePersonalizedAdvice(profile)
        };
    }

    // Roadmap query
    if (lower.includes("roadmap")) {
        const config = getRoadmapConfig(profile);
        return {
            role: "ai",
            content: config.title,
            type: "roadmap",
            roadmapConfig: config
        };
    }

    // Interview prep query
    if (lower.includes("interview") || lower.includes("placement")) {
        return {
            role: "ai",
            content: "Here is a targeted technical interview preparation plan:\n\n**Core Topics:**\n• Data Structures & Algorithms (Arrays, Linked Lists, Trees, Graphs)\n• System Design & Object-Oriented Principles\n• Database queries, indexing, and schema design\n• Behavioral & project walkthrough questions\n\n**Practice Strategy:**\n• Solve 2-3 LeetCode problems daily\n• Conduct mock interviews with peers or mentors\n• Review core architectural tradeoffs\n\n💡 Want me to find you a mentor for mock interview practice?",
        };
    }

    // ML projects query
    if (lower.includes("ml") || lower.includes("machine learning") || (lower.includes("project") && lower.includes("idea"))) {
        return {
            role: "ai",
            content: "Here are 5 impactful project ideas for your portfolio:\n\n1. 🏠 House Price Predictor — Linear regression with real estate dataset\n2. 📧 Email Spam Classifier — NLP text classification with Naive Bayes\n3. 😊 Sentiment Analyzer — Social media review sentiment classification\n4. 🖼️ Image Classifier — CNN with transfer learning\n5. 🎬 Movie Recommender — Collaborative filtering and vector similarity\n\nStart with #1 or #3 for a clean end-to-end project. Would you like me to find you a mentor to guide your project?",
        };
    }

    // If profile is available, provide context-aware response
    if (profile && (profile.skills || profile.career_goal || profile.learning_requirement)) {
        return {
            role: "ai",
            content: `Great question! Looking at your focus on ${profile.learning_requirement || profile.career_goal || "tech skills"}, I recommend dedicating structured time to hands-on exercises and building working projects. Would you like me to find you a mentor who specializes in ${profile.learning_requirement || profile.career_goal}?`
        };
    }

    // Fallback when profile context cannot be retrieved
    return {
        role: "ai",
        content: "Great question! I recommend starting with solid fundamentals in your chosen domain, building hands-on projects, and practicing problem solving. Would you like me to find you a mentor who specializes in this area?",
    };
}

export default function AIChat({ onClose, onNavigate, fullPage }) {
    const [messages, setMessages] = useState(initialMessages);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [studentProfile, setStudentProfile] = useState(null);
    const bottomRef = useRef(null);

    // Fetch authenticated student profile context on mount
    useEffect(() => {
        const loadStudentProfile = async () => {
            try {
                const {
                    data: { session }
                } = await supabase.auth.getSession();

                if (!session?.access_token) return;

                const response = await fetch("http://localhost:5000/profile", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const sp = data.profile?.student_profiles?.[0];
                    if (sp) {
                        setStudentProfile({
                            name: data.profile.name,
                            skills: Array.isArray(sp.skills) ? sp.skills.join(", ") : (sp.skills || ""),
                            career_goal: sp.career_goal || "",
                            learning_requirement: sp.learning_requirement || "",
                            level: sp.level || "",
                            semester: sp.semester || ""
                        });
                    }
                }
            } catch (err) {
                console.error("AI Chat profile fetch error:", err);
            }
        };

        loadStudentProfile();
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = (text) => {
        if (!text.trim()) return;
        const userMsg = { role: "user", content: text };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);
        setTimeout(() => {
            setMessages((prev) => [...prev, getAIResponse(text, studentProfile)]);
            setLoading(false);
        }, 1000);
    };

    const container = fullPage
        ? "flex flex-col h-full"
        : "fixed bottom-16 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 h-[520px] max-h-[78vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-[1000] overflow-hidden";

    return (
        <div className={container}>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white text-lg">✨</div>
                <div className="flex-1">
                    <div className="text-white font-bold text-sm">SkillSwap AI</div>
                    <div className="text-indigo-200 text-xs">Your learning & career assistant</div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-white/80 text-xs">Online</span>
                </div>
                {!fullPage && (
                    <button
                        className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "ai" && (
                            <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 mt-1">
                                ✨
                            </div>
                        )}
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === "user"
                                    ? "bg-indigo-600 text-white rounded-br-md"
                                    : "bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md"
                            }`}
                        >
                            {msg.type === "roadmap" ? (
                                <div>
                                    <div className="font-bold text-indigo-700 mb-3">{msg.content}</div>
                                    {(msg.roadmapConfig?.items || getRoadmapConfig(studentProfile).items).map((item, j) => (
                                        <div key={j} className="flex items-center gap-3 mb-2">
                                            <div
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                    item.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                                                }`}
                                            >
                                                {item.done && <span className="text-white text-xs">✓</span>}
                                            </div>
                                            <div className={`text-xs ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                                                <span className="font-semibold">{item.week}</span> — {item.topic}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        className="mt-3 text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors w-full cursor-pointer"
                                        onClick={() => onNavigate("aiRecs")}
                                    >
                                        🤖 Find a Mentor for {msg.roadmapConfig?.mentorTopic || "this topic"}
                                    </button>
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap">
                                    {msg.content}
                                    {(msg.content.includes("find you a") || msg.content.includes("find a mentor") || msg.content.includes("mentor") || msg.content.includes("Mentor")) ? (
                                        <button
                                            className="block mt-2.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                            onClick={() => onNavigate("aiRecs")}
                                        >
                                            Find a Mentor for this topic →
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-xs mr-2 flex-shrink-0">
                            ✨
                        </div>
                        <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-100">
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 0.15}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
                <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 bg-white border-t border-slate-100">
                    {suggestions.slice(0, 3).map((s) => (
                        <button
                            key={s}
                            className="flex-shrink-0 text-xs bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors cursor-pointer"
                            onClick={() => sendMessage(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                    placeholder="Ask anything about learning or mentors..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                <button
                    className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0 disabled:opacity-50 cursor-pointer"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                >
                    ➤
                </button>
            </div>
        </div>
    );
}
