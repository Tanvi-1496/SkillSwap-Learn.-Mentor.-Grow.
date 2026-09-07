import { useState } from "react";
const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "profile", label: "My Profile", icon: "👤" },
    { id: "skills", label: "My Skills", icon: "🎯" },
    { id: "availability", label: "Availability", icon: "🗓" },
    { id: "requests", label: "Booking Requests", icon: "📥" },
    { id: "upcoming", label: "Upcoming Sessions", icon: "📅" },
    { id: "completed", label: "Completed Sessions", icon: "✅" },
    { id: "reviews", label: "Reviews", icon: "⭐" },
    { id: "messages", label: "Messages", icon: "💬" },
    { id: "settings", label: "Settings", icon: "⚙️" },
];
const bookingRequests = [
    { student: "Aryan Shah", avatar: "AS", bg: "bg-indigo-500", topic: "Machine Learning Fundamentals", skills: ["Python", "ML"], date: "Sat, Aug 30", time: "10:00 AM" },
    { student: "Sneha Rao", avatar: "SR", bg: "bg-pink-500", topic: "Data Science Career Advice", skills: ["Data Science", "SQL"], date: "Sun, Aug 31", time: "3:00 PM" },
    { student: "Vikram Bhat", avatar: "VB", bg: "bg-emerald-500", topic: "ML Model Evaluation", skills: ["Python", "TensorFlow"], date: "Mon, Sep 1", time: "6:00 PM" },
];
const upcomingSessions = [
    { student: "Aryan Shah", avatar: "AS", bg: "bg-indigo-500", topic: "Python for Data Science", date: "Tomorrow", time: "5:00 PM" },
    { student: "Preethi Rao", avatar: "PR", bg: "bg-violet-500", topic: "ML Model Evaluation", date: "Sat, Aug 30", time: "6:00 PM" },
];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultAvail = {
    Mon: { active: true, slots: ["5:00 PM", "6:00 PM", "7:00 PM"] },
    Tue: { active: false, slots: [] },
    Wed: { active: true, slots: ["4:00 PM", "5:00 PM"] },
    Thu: { active: false, slots: [] },
    Fri: { active: true, slots: ["5:00 PM", "6:00 PM"] },
    Sat: { active: true, slots: ["10:00 AM", "11:00 AM", "5:00 PM", "6:00 PM"] },
    Sun: { active: false, slots: [] },
};
const skillsList = ["Python", "Machine Learning", "Data Science", "SQL", "TensorFlow", "Deep Learning", "Statistics"];
export default function MentorDashboard({ onNavigate }) {
    const [activeNav, setActiveNav] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [avail, setAvail] = useState(defaultAvail);
    const [requestStatuses, setRequestStatuses] = useState({});
    const toggleDay = (day) => {
        setAvail(prev => ({ ...prev, [day]: { ...prev[day], active: !prev[day].active } }));
    };
    const handleRequest = (i, action) => {
        setRequestStatuses(prev => ({ ...prev, [i]: action }));
    };
    const stats = [
        { label: "Total Students", value: "48", icon: "🎓", color: "bg-indigo-50 text-indigo-600", border: "border-indigo-100" },
        { label: "Upcoming Sessions", value: "5", icon: "📅", color: "bg-violet-50 text-violet-600", border: "border-violet-100" },
        { label: "Completed Sessions", value: "120", icon: "✅", color: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" },
        { label: "Avg. Rating", value: "4.9★", icon: "⭐", color: "bg-amber-50 text-amber-600", border: "border-amber-100" },
    ];
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
          <div className="mt-3 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1 inline-block">Mentor View</div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map(item => (<button key={item.id} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${activeNav === item.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setActiveNav(item.id)}>
              <span>{item.icon}</span>
              {item.label}
              {item.id === "requests" && <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>}
            </button>))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">PS</div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Dr. Priya Sharma</div>
              <div className="text-xs text-emerald-600 font-medium">✓ Verified Mentor</div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}/>}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 hover:bg-slate-50 rounded-lg" onClick={() => setSidebarOpen(true)}>
              <div className="space-y-1"><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/></div>
            </button>
            <h1 className="font-bold text-slate-800">
              {activeNav === "dashboard" && "Dashboard"}
              {activeNav === "requests" && "Booking Requests"}
              {activeNav === "availability" && "Manage Availability"}
              {activeNav === "profile" && "My Profile"}
              {activeNav === "skills" && "My Skills"}
              {activeNav !== "dashboard" && activeNav !== "requests" && activeNav !== "availability" && activeNav !== "profile" && activeNav !== "skills" && navItems.find(n => n.id === activeNav)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 hover:bg-slate-50 rounded-xl">
              <span className="text-lg">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/>
            </button>
            <button className="text-sm font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors" onClick={() => onNavigate("landing")}>
              ← Switch to Mentee
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeNav === "dashboard" && (<>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Welcome back, Priya 👋</h2>
                <p className="text-slate-500 mt-1">You have 3 new booking requests and 2 upcoming sessions this week.</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map(s => (<div key={s.label} className={`bg-white rounded-2xl p-4 border ${s.border} shadow-sm`}>
                    <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
                    <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
                  </div>))}
              </div>

              {/* Workload */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800">Current Workload</h3>
                  <span className="text-sm text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">Healthy</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: "40%" }}/>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">8 of 20 recommended active sessions</span>
                  <span className="font-bold text-emerald-600">40%</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">This workload is used by the AI recommendation system to ensure fair mentor distribution.</p>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Booking Requests */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800">📥 Booking Requests</h3>
                    <button className="text-indigo-600 text-sm font-semibold" onClick={() => setActiveNav("requests")}>View All</button>
                  </div>
                  <div className="space-y-3">
                    {bookingRequests.slice(0, 2).map((req, i) => (<div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-9 h-9 ${req.bg} rounded-full flex items-center justify-center text-white font-bold text-xs`}>{req.avatar}</div>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{req.student}</div>
                            <div className="text-xs text-slate-500">{req.date} · {req.time}</div>
                          </div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg px-3 py-1.5 text-xs text-indigo-700 font-medium mb-3">📌 {req.topic}</div>
                        <div className="flex gap-1.5 mb-3">
                          {req.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                        </div>
                        {requestStatuses[i] ? (<div className={`text-center text-sm font-semibold py-2 rounded-xl ${requestStatuses[i] === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                            {requestStatuses[i] === "accepted" ? "✓ Accepted" : "✕ Declined"}
                          </div>) : (<div className="flex gap-2">
                            <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs transition-colors" onClick={() => handleRequest(i, "accepted")}>
                              ✓ Accept
                            </button>
                            <button className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-xl text-xs transition-colors" onClick={() => handleRequest(i, "declined")}>
                              ✕ Decline
                            </button>
                          </div>)}
                      </div>))}
                  </div>
                </div>

                {/* Upcoming Sessions */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-4">📅 Upcoming Sessions</h3>
                  <div className="space-y-3">
                    {upcomingSessions.map((s, i) => (<div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-9 h-9 ${s.bg} rounded-full flex items-center justify-center text-white font-bold text-xs`}>{s.avatar}</div>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{s.student}</div>
                            <div className="text-xs text-slate-500">{s.date} · {s.time}</div>
                          </div>
                        </div>
                        <div className="bg-violet-50 rounded-lg px-3 py-1.5 text-xs text-violet-700 font-medium mb-3">📌 {s.topic}</div>
                        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors">
                          Start Session
                        </button>
                      </div>))}
                  </div>

                  {/* Performance */}
                  <div className="mt-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-3 text-sm">📊 Performance Overview</h4>
                    {[
                { label: "Sessions (this month)", val: 14, max: 20, color: "bg-indigo-500" },
                { label: "Student satisfaction", val: 98, max: 100, color: "bg-emerald-500" },
                { label: "Response rate", val: 95, max: 100, color: "bg-violet-500" },
            ].map(p => (<div key={p.label} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">{p.label}</span>
                          <span className="font-bold text-slate-800">{p.val}{p.label.includes("rate") || p.label.includes("satisfaction") ? "%" : ""}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${p.color} rounded-full`} style={{ width: `${(p.val / p.max) * 100}%` }}/>
                        </div>
                      </div>))}
                  </div>
                </div>
              </div>
            </>)}

          {activeNav === "requests" && (<div className="space-y-4">
              {bookingRequests.map((req, i) => (<div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${req.bg} rounded-full flex items-center justify-center text-white font-bold`}>{req.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-bold text-slate-800">{req.student}</h3>
                          <p className="text-slate-500 text-sm">{req.date} · {req.time}</p>
                        </div>
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Pending</span>
                      </div>
                      <div className="bg-indigo-50 rounded-xl px-3 py-2 text-sm text-indigo-700 font-medium mt-3 mb-3">📌 {req.topic}</div>
                      <div className="flex gap-1.5">
                        {req.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                      </div>
                    </div>
                  </div>
                  {requestStatuses[i] ? (<div className={`mt-4 text-center text-sm font-semibold py-2.5 rounded-xl ${requestStatuses[i] === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {requestStatuses[i] === "accepted" ? "✓ Accepted — Student will be notified" : "✕ Declined"}
                    </div>) : (<div className="flex gap-3 mt-4">
                      <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors" onClick={() => handleRequest(i, "accepted")}>
                        ✓ Accept Request
                      </button>
                      <button className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition-colors" onClick={() => handleRequest(i, "declined")}>
                        ✕ Decline
                      </button>
                    </div>)}
                </div>))}
            </div>)}

          {activeNav === "availability" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl">
              <p className="text-slate-500 text-sm mb-6">Select days and time slots when you are available for mentoring sessions.</p>
              <div className="space-y-4">
                {days.map(day => (<div key={day} className={`rounded-xl border transition-all ${avail[day].active ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-center gap-3 p-4">
                      <button className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${avail[day].active ? "bg-indigo-600" : "bg-slate-200"}`} onClick={() => toggleDay(day)}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${avail[day].active ? "left-4" : "left-0.5"}`}/>
                      </button>
                      <span className={`font-semibold ${avail[day].active ? "text-indigo-700" : "text-slate-500"}`}>{day}</span>
                      {avail[day].active && (<div className="flex flex-wrap gap-1.5 ml-2">
                          {avail[day].slots.map(slot => (<span key={slot} className="bg-white text-indigo-600 border border-indigo-200 text-xs font-medium px-2.5 py-1 rounded-full">{slot}</span>))}
                        </div>)}
                      {!avail[day].active && <span className="text-slate-400 text-sm ml-1">Unavailable</span>}
                    </div>
                  </div>))}
              </div>
              <button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm">
                Save Availability
              </button>
            </div>)}

          {activeNav === "skills" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl">
              <p className="text-slate-500 text-sm mb-5">These are the skills visible on your mentor profile.</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {skillsList.map(s => (<div key={s} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                    {s}
                    <button className="text-indigo-400 hover:text-red-500 transition-colors ml-0.5">×</button>
                  </div>))}
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-3 py-1.5 rounded-full transition-colors">
                  + Add Skill
                </button>
              </div>
              <input type="text" placeholder="Type a skill and press Enter..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all"/>
            </div>)}

          {activeNav !== "dashboard" && activeNav !== "requests" && activeNav !== "availability" && activeNav !== "skills" && (<div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm text-center max-w-md mx-auto">
              <div className="text-5xl mb-4">{navItems.find(n => n.id === activeNav)?.icon}</div>
              <h3 className="font-bold text-slate-700 text-lg mb-2">{navItems.find(n => n.id === activeNav)?.label}</h3>
              <p className="text-slate-400 text-sm">This section is fully functional in the complete implementation.</p>
            </div>)}
        </div>
      </main>
    </div>);
}
