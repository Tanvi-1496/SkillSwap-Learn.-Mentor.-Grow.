// import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import AIChat from "./AIChat";
const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "search", label: "Find Mentors", icon: "🔍" },
    { id: "aiRecs", label: "AI Recommendations", icon: "🤖" },
    { id: "bookings", label: "My Bookings", icon: "📅" },
    { id: "sessions", label: "Sessions", icon: "🎥" },
    { id: "messages", label: "Messages", icon: "💬" },
    { id: "feedback", label: "Feedback", icon: "⭐" },
    { id: "aiChat", label: "AI Assistant", icon: "✨" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "requirements", label: "Complete Profile", icon: "📝" },
    { id: "settings", label: "Settings", icon: "⚙️" },
];
const stats = [
    { label: "Upcoming Sessions", value: "3", icon: "📅", color: "bg-indigo-50 text-indigo-600", border: "border-indigo-100" },
    { label: "Completed Sessions", value: "12", icon: "✅", color: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" },
    { label: "Saved Mentors", value: "8", icon: "🔖", color: "bg-violet-50 text-violet-600", border: "border-violet-100" },
    { label: "Learning Hours", value: "24h", icon: "⏱️", color: "bg-amber-50 text-amber-600", border: "border-amber-100" },
];
function getInitials(name) {
    if (!name || typeof name !== "string") return "M";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "M";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMentorType(type) {
    if (!type) return "Mentor";
    const clean = String(type).replace(/_/g, " ").toLowerCase();
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

const recommendedMentors = [
    {
        name: "Neha Kulkarni",
        type: "Industry Mentor",
        avatar: "NK",
        bg: "bg-[#4f46e5]",
        skills: ["Python", "Deep Learning", "TensorFlow"],
        rating: 4.7,
        exp: "5 yrs exp",
        availability: "Check availability",
        match: 94,
        sessions: 0,
    },
    {
        name: "Rohan Mehta",
        type: "Alumni Mentor",
        avatar: "RM",
        bg: "bg-[#4f46e5]",
        skills: ["Machine Learning", "NLP", "PyTorch"],
        rating: 4.5,
        exp: "4 yrs exp",
        availability: "Check availability",
        match: 91,
        sessions: 0,
    },
    {
        name: "Sneha Patil",
        type: "Industry Mentor",
        avatar: "SP",
        bg: "bg-[#4f46e5]",
        skills: ["Python", "SQL", "Data Science"],
        rating: 4.7,
        exp: "5 yrs exp",
        availability: "Check availability",
        match: 89,
        sessions: 0,
    },
];
const upcomingSessions = [
    { mentor: "Dr. Priya Sharma", avatar: "PS", bg: "bg-indigo-600", date: "Tomorrow", time: "5:00 PM – 6:00 PM", topic: "ML Model Evaluation", status: "confirmed" },
    { mentor: "Rahul Verma", avatar: "RV", bg: "bg-violet-600", date: "Sat, Aug 30", time: "10:00 AM – 11:00 AM", topic: "Graph Algorithms", status: "confirmed" },
];
const progress = [
    { skill: "Python", pct: 75, color: "bg-indigo-500" },
    { skill: "DSA", pct: 50, color: "bg-violet-500" },
    { skill: "Machine Learning", pct: 35, color: "bg-emerald-500" },
    { skill: "Web Development", pct: 60, color: "bg-pink-500" },
];
const notifications = [
    { text: "Dr. Priya accepted your booking request", time: "2m ago", dot: "bg-emerald-400" },
    { text: "New AI recommendations available for you", time: "1h ago", dot: "bg-indigo-400" },
    { text: "Session reminder: Tomorrow at 5:00 PM", time: "3h ago", dot: "bg-amber-400" },
    { text: "Rahul replied to your message", time: "5h ago", dot: "bg-violet-400" },
];
export default function MenteeDashboard({ onNavigate }) {
    const [activeNav, setActiveNav] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);
    const [profile, setProfile] = useState(null);
    const [mentorsList, setMentorsList] = useState([]);
    const [realUpcoming, setRealUpcoming] = useState([]);
    const [headerSearch, setHeaderSearch] = useState("");

    useEffect(() => {
        const loadProfile = async () => {
            console.log("MenteeDashboard loaded");

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) {
                console.error("Supabase session error:", sessionError.message);
                return;
            }

            const token = session?.access_token;
            if (!token) {
                console.error("No active Supabase session found.");
                return;
            }

            try {
                const response = await fetch("http://localhost:5000/profile", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error("Profile request failed:", data.error);
                } else {
                    setProfile(data.profile);
                }
            } catch (error) {
                console.error("Profile request error:", error.message);
            }

            // Fetch live mentors for recommended section
            try {
                fetch("http://localhost:5000/mentors")
                    .then((r) => r.json())
                    .then((d) => {
                        if (d.mentors && d.mentors.length > 0) {
                            setMentorsList(
                                d.mentors.slice(0, 3).map((m) => ({
                                    name: m.name || "Mentor",
                                    id: m.user_id,
                                    type: formatMentorType(m.mentor_type),
                                    avatar: getInitials(m.name),
                                    bg: "bg-[#4f46e5]",
                                    skills: Array.isArray(m.skills) ? m.skills : [],
                                    rating: m.rating > 0 ? Number(m.rating).toFixed(1) : "New",
                                    exp: m.experience !== undefined && m.experience !== null ? `${m.experience} yrs exp` : "Experienced",
                                    availability: "Check availability",
                                    match: m.match || 94,
                                    sessions: m.sessions || 0,
                                    org: m.org || "Verified Mentor"
                                }))
                            );
                        }
                    })
                    .catch((err) => console.error("Mentors load error:", err));
            } catch (_) {}

            // Fetch live upcoming confirmed bookings
            try {
                const bRes = await fetch("http://localhost:5000/bookings", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const bData = await bRes.json();
                if (bData.bookings) {
                    const confirmed = bData.bookings.filter((b) => b.status === "confirmed");
                    if (confirmed.length > 0) {
                        setRealUpcoming(confirmed);
                    }
                }
            } catch (err) {
                console.error("Bookings load error:", err);
            }
        };

        loadProfile();
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Logout error:", error.message);
            alert("Unable to log out right now.");
            return;
        }

        const {
            data: { session }
        } = await supabase.auth.getSession();

        if (session) {
            alert("Logout did not clear the active session.");
            return;
        }

        onNavigate("landing");
    };

    const handleNav = (id) => {
        setActiveNav(id);
        setSidebarOpen(false);
        if (id === "aiRecs")
            onNavigate("aiRecs");
        else if (id === "search")
            onNavigate("search");
        else if (id === "bookings")
            onNavigate("bookings");
        else if (id === "profile")
            onNavigate("profile");
        else if (id === "aiChat")
            setShowAIChat(true);
    };

    const studentInitials = getInitials(profile?.name || "Student");

    const handleHeaderSearch = (e) => {
        if (e.key === "Enter" && headerSearch.trim()) {
            onNavigate("search");
        }
    };

    return (<div className="flex h-screen bg-[#f5f7fc] text-[#172033] overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-[#e5e7eb] flex flex-col shadow-xl lg:shadow-none transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-5 border-b border-[#e5e7eb]">
          <button className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("landing")}>
            <div className="w-8 h-8 bg-[#4f46e5] rounded-xl flex items-center justify-center shadow-xs">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-xl font-bold text-[#172033] tracking-tight">SkillSwap</span>
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {navItems.map(item => (<button key={item.id} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeNav === item.id ? "bg-[#4f46e5] text-white shadow-xs" : "text-[#718096] hover:bg-[#f5f7fc] hover:text-[#172033]"}`} onClick={() => handleNav(item.id)}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>))}
        </nav>
        <div className="p-4 border-t border-[#e5e7eb]">
        <div
            className="flex items-center gap-3 cursor-pointer hover:bg-[#f5f7fc] rounded-xl p-2 transition-colors"
            onClick={() => onNavigate("profile")}
        >
            <div className="w-9 h-9 bg-[#eef0ff] rounded-full flex items-center justify-center text-[#4f46e5] font-bold text-sm border border-[#c7d2fe]/40">
                {studentInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#172033] truncate">{profile?.name || "Student"}</div>
              <div className="text-xs text-[#718096] truncate">
                  {profile?.dept || "Department"} · {profile?.student_profiles?.[0]?.semester ? `${profile.student_profiles[0].semester}th Sem` : "Student"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="w-full mt-2 px-3 py-2 text-left text-xs font-semibold text-[#718096] hover:bg-[#f5f7fc] hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
            onClick={handleLogout}
          >
            ← Log out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}/>}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#e5e7eb] px-4 sm:px-6 py-3.5 flex items-center justify-between flex-shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 hover:bg-[#f5f7fc] rounded-xl text-[#718096]" onClick={() => setSidebarOpen(true)}>
              <div className="space-y-1"><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/></div>
            </button>
            <div className="relative hidden sm:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096] text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search mentors, skills... (Press Enter)"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={handleHeaderSearch}
                className="pl-9 pr-4 py-2 bg-[#f5f7fc] border border-[#e5e7eb] rounded-xl text-sm w-72 text-[#172033] placeholder-[#718096] focus:outline-none focus:bg-white focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0ff] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button className="relative p-2 hover:bg-[#f5f7fc] rounded-xl transition-colors cursor-pointer" onClick={() => setShowNotifs(!showNotifs)}>
                <span className="text-lg">🔔</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/>
              </button>
              {showNotifs && (<div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-[#e5e7eb] z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e5e7eb] flex items-center justify-between">
                    <span className="font-semibold text-[#172033]">Notifications</span>
                    <button className="text-xs text-[#4f46e5] hover:text-[#4338ca] font-medium cursor-pointer">Mark all read</button>
                  </div>
                  {notifications.map((n, i) => (<div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-[#f5f7fc] transition-colors">
                      <span className={`w-2 h-2 ${n.dot} rounded-full mt-1.5 flex-shrink-0`}/>
                      <div className="flex-1">
                        <p className="text-sm text-[#172033]">{n.text}</p>
                        <p className="text-xs text-[#718096] mt-0.5">{n.time}</p>
                      </div>
                    </div>))}
                </div>)}
            </div>
            <div
                onClick={() => onNavigate("profile")}
                className="w-9 h-9 bg-[#4f46e5] rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer shadow-xs hover:opacity-90"
            >
                {studentInitials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Good morning, {profile?.name || "Student"} 👋</h1>
            <p className="text-[#718096] text-sm mt-1">Ready to learn something new today?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map(s => (<div key={s.label} className="bg-white rounded-2xl p-5 border border-[#e5e7eb] shadow-xs">
                <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
                <div className="text-2xl font-bold text-[#172033]">{s.value}</div>
                <div className="text-[#718096] text-xs font-medium mt-0.5">{s.label}</div>
              </div>))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recommended Mentors */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#172033] text-lg">🤖 Recommended Mentors</h2>
                <button className="text-[#4f46e5] hover:text-[#4338ca] text-xs font-semibold cursor-pointer" onClick={() => onNavigate("aiRecs")}>View All →</button>
              </div>
              <div className="space-y-4">
                {(mentorsList.length > 0 ? mentorsList : recommendedMentors).map(m => (<div key={m.name} className="bg-white rounded-2xl p-5 border border-[#e5e7eb] shadow-xs hover:shadow-md hover:border-[#c7d2fe] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-13 h-13 bg-[#4f46e5] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-xs">{m.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-[#172033] text-base">{m.name}</h3>
                            {m.match > 0 && (
                              <span className="bg-[#eef0ff] text-[#4f46e5] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#c7d2fe]/30">{m.match}% Match</span>
                            )}
                          </div>
                          <p className="text-[#4f46e5] text-xs font-semibold mt-0.5 mb-2">{m.type}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {m.skills.map(s => (<span key={s} className="bg-[#eef0ff] text-[#4f46e5] text-xs font-medium px-2.5 py-0.5 rounded-full border border-[#c7d2fe]/30">{s}</span>))}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#718096]">
                            <span className="font-semibold text-[#172033]">⭐ {m.rating}</span>
                            <span>🗓 {m.availability}</span>
                            <span>💼 {m.exp}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f1f5f9]">
                        <button className="flex-1 sm:flex-none text-xs font-semibold text-[#172033] hover:text-[#4f46e5] bg-[#f5f7fc] hover:bg-[#eef0ff] border border-[#e5e7eb] px-3.5 py-2 rounded-xl transition-colors cursor-pointer" onClick={() => onNavigate("mentorProfile", { mentorId: m.id || m.mentor_id || m.user_id })}>
                          View Profile
                        </button>
                        <button className="flex-1 sm:flex-none text-xs font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer" onClick={() => onNavigate("booking", { mentorId: m.id || m.mentor_id || m.user_id })}>
                          Book Session
                        </button>
                      </div>
                    </div>
                  </div>))}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Upcoming Sessions */}
              <div>
                <h2 className="font-bold text-[#172033] text-lg mb-4">📅 Upcoming Sessions</h2>
                <div className="space-y-3">
                  {(realUpcoming.length > 0 ? realUpcoming : upcomingSessions).map((s, i) => (<div key={s.id || i} className="bg-white rounded-2xl p-5 border border-[#e5e7eb] shadow-xs">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-[#4f46e5] text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xs">
                          {s.avatar || (s.mentor_name || "M").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[#172033] text-sm">{s.mentor_name || s.mentor}</div>
                          <div className="text-xs text-[#718096]">{s.date} · {s.time}</div>
                        </div>
                      </div>
                      <div className="bg-[#eef0ff] rounded-xl px-3 py-2 text-xs text-[#4f46e5] font-semibold mb-3 border border-[#c7d2fe]/30">
                        📌 {s.topic}
                      </div>
                      <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer" onClick={() => onNavigate("bookings")}>
                        View Details
                      </button>
                    </div>))}
                </div>
              </div>

              {/* Learning Progress */}
              <div>
                <h2 className="font-bold text-[#172033] text-lg mb-4">📈 Learning Progress</h2>
                <div className="bg-white rounded-2xl p-5 border border-[#e5e7eb] shadow-xs space-y-4">
                  {progress.map(p => (<div key={p.skill}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-[#172033]">{p.skill}</span>
                        <span className="font-bold text-[#172033]">{p.pct}%</span>
                      </div>
                      <div className="h-2 bg-[#f5f7fc] rounded-full overflow-hidden border border-[#e5e7eb]/60">
                        <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${p.pct}%` }}/>
                      </div>
                    </div>))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating AI Chat */}
      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} onNavigate={onNavigate}/>}
      {!showAIChat && (<button className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center text-white text-2xl hover:-translate-y-1 transition-all z-50" onClick={() => setShowAIChat(true)}>
          ✨
        </button>)}
    </div>);
}