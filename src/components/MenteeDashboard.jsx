// import { useState } from "react";
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
    { id: "settings", label: "Settings", icon: "⚙️" },
];
const stats = [
    { label: "Upcoming Sessions", value: "3", icon: "📅", color: "bg-indigo-50 text-indigo-600", border: "border-indigo-100" },
    { label: "Completed Sessions", value: "12", icon: "✅", color: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" },
    { label: "Saved Mentors", value: "8", icon: "🔖", color: "bg-violet-50 text-violet-600", border: "border-violet-100" },
    { label: "Learning Hours", value: "24h", icon: "⏱️", color: "bg-amber-50 text-amber-600", border: "border-amber-100" },
];
const recommendedMentors = [
    {
        name: "Dr. Priya Sharma",
        type: "Faculty Mentor",
        avatar: "PS",
        bg: "bg-indigo-600",
        skills: ["Python", "ML", "Data Science"],
        rating: 4.9,
        exp: "8 years",
        availability: "Mon, Wed, Fri",
        match: 94,
        sessions: 120,
    },
    {
        name: "Rahul Verma",
        type: "Senior Student",
        avatar: "RV",
        bg: "bg-violet-600",
        skills: ["DSA", "Java", "CP"],
        rating: 4.7,
        exp: "2 years",
        availability: "Weekends",
        match: 89,
        sessions: 48,
    },
    {
        name: "Anjali Mehta",
        type: "Alumni Mentor",
        avatar: "AM",
        bg: "bg-pink-600",
        skills: ["React", "Node.js", "UI/UX"],
        rating: 4.8,
        exp: "4 years",
        availability: "Sat, Sun",
        match: 91,
        sessions: 76,
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

    useEffect(() => {
    console.log("MenteeDashboard loaded");

    const token = localStorage.getItem("access_token");
    console.log("Token:", token);

          fetch("http://localhost:5000/profile", {
              headers: {
                  Authorization: `Bearer ${token}`
              }
          })
              .then(res => res.json())
              .then(data => {
                  console.log("Profile:", data);
                  setProfile(data.profile);
              });
    }, []);

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
    return (<div className="flex h-screen bg-[#f8f9ff] overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-100 flex flex-col shadow-xl lg:shadow-none transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-100">
          <button className="flex items-center gap-2" onClick={() => onNavigate("landing")}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-slate-900">SkillSwap</span>
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map(item => (<button key={item.id} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${activeNav === item.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`} onClick={() => handleNav(item.id)}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>))}
        </nav>
        <div className="p-4 border-t border-slate-100">
        <div
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-xl p-2"
            onClick={() => onNavigate("profile")}
        >
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">AJ</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{profile?.name || "Student"}</div>
              <div className="text-xs text-slate-500">
                  {profile?.dept || "Department"} · {profile?.student_profiles?.[0]?.semester ? `${profile.student_profiles[0].semester}th Sem` : "Semester"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}/>}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 hover:bg-slate-50 rounded-lg" onClick={() => setSidebarOpen(true)}>
              <div className="space-y-1"><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/></div>
            </button>
            <div className="relative hidden sm:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" placeholder="Search mentors, skills..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"/>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button className="relative p-2 hover:bg-slate-50 rounded-xl transition-colors" onClick={() => setShowNotifs(!showNotifs)}>
                <span className="text-lg">🔔</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/>
              </button>
              {showNotifs && (<div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Notifications</span>
                    <button className="text-xs text-indigo-600 hover:text-indigo-700">Mark all read</button>
                  </div>
                  {notifications.map((n, i) => (<div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <span className={`w-2 h-2 ${n.dot} rounded-full mt-1.5 flex-shrink-0`}/>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{n.text}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>))}
                </div>)}
            </div>
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer">AJ</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Good morning, {profile?.name || "Student"} 👋</h1>
            <p className="text-slate-500 mt-1">Ready to learn something new today?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map(s => (<div key={s.label} className={`bg-white rounded-2xl p-4 border ${s.border} shadow-sm`}>
                <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
              </div>))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recommended Mentors */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800">🤖 AI Recommended Mentors</h2>
                <button className="text-indigo-600 text-sm font-semibold hover:text-indigo-700" onClick={() => onNavigate("aiRecs")}>View All</button>
              </div>
              <div className="space-y-3">
                {recommendedMentors.map(m => (<div key={m.name} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 ${m.bg} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{m.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800">{m.name}</h3>
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{m.match}% Match</span>
                        </div>
                        <p className="text-indigo-600 text-xs font-medium mb-2">{m.type}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {m.skills.map(s => (<span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>⭐ {m.rating}</span>
                          <span>🗓 {m.availability}</span>
                          <span>💼 {m.exp}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors" onClick={() => onNavigate("mentorProfile")}>
                          View Profile
                        </button>
                        <button className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors" onClick={() => onNavigate("booking")}>
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
                <h2 className="font-bold text-slate-800 mb-4">📅 Upcoming Sessions</h2>
                <div className="space-y-3">
                  {upcomingSessions.map((s, i) => (<div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 ${s.bg} rounded-full flex items-center justify-center text-white font-bold text-xs`}>{s.avatar}</div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{s.mentor}</div>
                          <div className="text-xs text-slate-500">{s.date} · {s.time}</div>
                        </div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg px-3 py-1.5 text-xs text-indigo-700 font-medium mb-3">
                        📌 {s.topic}
                      </div>
                      <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors">
                        Join Session
                      </button>
                    </div>))}
                </div>
              </div>

              {/* Learning Progress */}
              <div>
                <h2 className="font-bold text-slate-800 mb-4">📈 Learning Progress</h2>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
                  {progress.map(p => (<div key={p.skill}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700">{p.skill}</span>
                        <span className="font-bold text-slate-800">{p.pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
