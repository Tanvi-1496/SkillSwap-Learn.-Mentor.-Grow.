import { useState, useRef, useEffect } from "react";
const suggestions = [
    "Help me prepare for a Java interview",
    "Create a Python learning roadmap",
    "Suggest ML project ideas",
    "Which skills for data science?",
    "Help me prepare for placements",
];
const initialMessages = [
    {
        role: "ai",
        content: "Hi! I'm SkillSwap AI — your personal learning and career assistant. I can help you find mentors, build roadmaps, prepare for interviews, and more. What would you like to work on today?",
    },
];
const aiResponses = {
    roadmap: {
        role: "ai",
        content: "🗺️ Python Learning Roadmap",
        type: "roadmap",
    },
    interview: {
        role: "ai",
        content: "Here's a Java interview prep plan:\n\n**Core Topics:**\n• OOP concepts (Inheritance, Polymorphism, Encapsulation, Abstraction)\n• Collections Framework (ArrayList, HashMap, LinkedList)\n• Exception Handling & Multithreading\n• Java 8+ Features (Streams, Lambda, Optional)\n\n**Practice:**\n• LeetCode — 2 problems/day\n• Mock interviews on Pramp\n• System design basics\n\n💡 Want me to find you a Java mentor?",
    },
    ml: {
        role: "ai",
        content: "Here are 5 beginner ML project ideas:\n\n1. 🏠 House Price Predictor — Linear regression with Kaggle dataset\n2. 📧 Email Spam Classifier — NLP + Naive Bayes\n3. 😊 Sentiment Analyzer — Twitter/product reviews\n4. 🖼️ Image Classifier — CNN with MNIST or CIFAR-10\n5. 🎬 Movie Recommender — Collaborative filtering\n\nStart with #1 or #3 — they're the most beginner-friendly.",
    },
    default: {
        role: "ai",
        content: "Great question! Based on your profile and goals, I'd recommend focusing on Python fundamentals first, then moving into data science libraries like NumPy, Pandas, and Scikit-learn. Would you like me to find you a mentor who specializes in this area?",
    },
};
function getRoadmapItems() {
    return [
        { week: "Week 1-2", topic: "Python Basics", done: true },
        { week: "Week 3-4", topic: "Data Structures & Algorithms", done: true },
        { week: "Week 5-6", topic: "OOP & File Handling", done: false },
        { week: "Week 7-8", topic: "NumPy & Pandas", done: false },
        { week: "Week 9-10", topic: "Visualization (Matplotlib)", done: false },
        { week: "Week 11-12", topic: "ML with Scikit-learn", done: false },
    ];
}
function getAIResponse(input) {
    const lower = input.toLowerCase();
    if (lower.includes("roadmap") || lower.includes("python"))
        return { ...aiResponses.roadmap };
    if (lower.includes("java") || lower.includes("interview"))
        return { ...aiResponses.interview };
    if (lower.includes("ml") || lower.includes("machine learning") || lower.includes("project"))
        return { ...aiResponses.ml };
    return { ...aiResponses.default };
}
export default function AIChat({ onClose, onNavigate, fullPage }) {
    const [messages, setMessages] = useState(initialMessages);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const sendMessage = (text) => {
        if (!text.trim())
            return;
        const userMsg = { role: "user", content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);
        setTimeout(() => {
            setMessages(prev => [...prev, getAIResponse(text)]);
            setLoading(false);
        }, 1000);
    };
    const container = fullPage
        ? "flex flex-col h-full"
        : "fixed bottom-6 right-6 w-96 h-[560px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden";
    return (<div className={container}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white text-lg">✨</div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm">SkillSwap AI</div>
          <div className="text-indigo-200 text-xs">Your learning & career assistant</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
          <span className="text-white/80 text-xs">Online</span>
        </div>
        {!fullPage && (<button className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors" onClick={onClose}>✕</button>)}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, i) => (<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (<div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 mt-1">✨</div>)}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-md" : "bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md"}`}>
              {msg.type === "roadmap" ? (<div>
                  <div className="font-bold text-indigo-700 mb-3">{msg.content}</div>
                  {getRoadmapItems().map((item, j) => (<div key={j} className="flex items-center gap-3 mb-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                        {item.done && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className={`text-xs ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                        <span className="font-semibold">{item.week}</span> — {item.topic}
                      </div>
                    </div>))}
                  <button className="mt-3 text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors w-full" onClick={() => onNavigate("aiRecs")}>
                    🤖 Find a Mentor for Python
                  </button>
                </div>) : (<div className="whitespace-pre-wrap">{msg.content}
                  {msg.content.includes("find you a") || msg.content.includes("find a mentor") ? (<button className="block mt-2 text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors" onClick={() => onNavigate("aiRecs")}>
                      Find a Mentor for this topic →
                    </button>) : null}
                </div>)}
            </div>
          </div>))}
        {loading && (<div className="flex justify-start">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-xs mr-2 flex-shrink-0">✨</div>
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-100">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>)}
              </div>
            </div>
          </div>)}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (<div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 bg-white border-t border-slate-100">
          {suggestions.slice(0, 3).map(s => (<button key={s} className="flex-shrink-0 text-xs bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors" onClick={() => sendMessage(s)}>
              {s}
            </button>))}
        </div>)}

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} placeholder="Ask anything about learning or mentors..." className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"/>
        <button className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0 disabled:opacity-50" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
          ➤
        </button>
      </div>
    </div>);
}
