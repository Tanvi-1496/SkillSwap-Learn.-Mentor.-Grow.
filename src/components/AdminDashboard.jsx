import { useState } from "react";
const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "mentors", label: "Mentors", icon: "👨‍🏫" },
    { id: "verification", label: "Verification", icon: "✅" },
    { id: "bookings", label: "Bookings", icon: "📅" },
    { id: "sessions", label: "Sessions", icon: "🎥" },
    { id: "reports", label: "Reports", icon: "📊" },
    { id: "feedback", label: "Feedback", icon: "⭐" },
    { id: "skills", label: "Skills", icon: "🎯" },
    { id: "settings", label: "Settings", icon: "⚙️" },
];
const pendingVerifications = [
    { name: "Anjali Mehta", type: "Alumni", org: "Google India", dept: "Software Engineering", submitted: "Aug 24, 2025" },
    { name: "Karan Patel", type: "Industry Professional", org: "Amazon", dept: "Cloud Architecture", submitted: "Aug 23, 2025" },
    { name: "Dr. Vikram Singh", type: "Faculty", org: "NIT Delhi", dept: "AI Research Lab", submitted: "Aug 22, 2025" },
    { name: "Neha Joshi", type: "Senior Student", org: "IIT Bombay", dept: "Computer Science", submitted: "Aug 21, 2025" },
];
const skillsData = [
    { skill: "Python", count: 1240 },
    { skill: "Machine Learning", count: 980 },
    { skill: "Web Development", count: 870 },
    { skill: "Data Science", count: 760 },
    { skill: "DSA", count: 650 },
    { skill: "Java", count: 540 },
];
export default function AdminDashboard({ onNavigate }) {
    const [activeNav, setActiveNav] = useState("dashboard");
    const [verifStatuses, setVerifStatuses] = useState({});
    const metrics = [
        { label: "Total Students", value: "12,840", icon: "🎓", change: "+8.2%", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
        { label: "Total Mentors", value: "2,430", icon: "👨‍🏫", change: "+12.5%", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
        { label: "Active Sessions", value: "348", icon: "🎥", change: "+5.1%", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        { label: "Completed Sessions", value: "48,920", icon: "✅", change: "+18.3%", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
        { label: "Pending Verifications", value: "23", icon: "⏳", change: "-4 today", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
    ];
    return (<div className="flex h-screen bg-[#f8f9ff] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-900 flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-800">
          <button className="flex items-center gap-2" onClick={() => onNavigate("landing")}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-white">SkillSwap</span>
          </button>
          <div className="mt-3 text-xs font-bold text-amber-400 bg-amber-400/10 rounded-lg px-2 py-1 inline-block">⚡ Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map(item => (<button key={item.id} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${activeNav === item.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`} onClick={() => setActiveNav(item.id)}>
              <span>{item.icon}</span>
              {item.label}
              {item.id === "verification" && <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">23</span>}
            </button>))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">AD</div>
            <div>
              <div className="text-sm font-semibold text-white">Admin</div>
              <div className="text-xs text-slate-400">System Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <h1 className="font-bold text-slate-800">{navItems.find(n => n.id === activeNav)?.label}</h1>
          <div className="flex items-center gap-3">
            <button className="text-xs font-semibold text-slate-500 hover:text-indigo-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors" onClick={() => onNavigate("landing")}>
              ← Back to Site
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeNav === "dashboard" && (<>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Platform Overview</h2>
                <p className="text-slate-500 mt-1">Last updated: 5 minutes ago</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {metrics.map(m => (<div key={m.label} className={`bg-white rounded-2xl p-4 border ${m.border} shadow-sm`}>
                    <div className={`w-9 h-9 ${m.bg} ${m.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{m.icon}</div>
                    <div className="text-xl font-bold text-slate-900">{m.value}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{m.label}</div>
                    <div className="text-emerald-600 text-xs font-semibold mt-1">{m.change}</div>
                  </div>))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Popular Skills */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">🎯 Most Requested Skills</h3>
                  <div className="space-y-3">
                    {skillsData.map((s, i) => (<div key={s.skill}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-mono w-4">{i + 1}</span>
                            <span className="font-medium text-slate-700">{s.skill}</span>
                          </div>
                          <span className="font-bold text-slate-800">{s.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${(s.count / skillsData[0].count) * 100}%` }}/>
                        </div>
                      </div>))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">⚡ Recent Activity</h3>
                  <div className="space-y-3">
                    {[
                { icon: "👤", text: "New student registered: Rohan Mehta", time: "2m ago", dot: "bg-emerald-400" },
                { icon: "✅", text: "Mentor verified: Anjali Mehta (Alumni)", time: "8m ago", dot: "bg-indigo-400" },
                { icon: "📅", text: "Session completed: Aryan Shah + Dr. Priya", time: "24m ago", dot: "bg-violet-400" },
                { icon: "⭐", text: "New review (5★) for Rahul Verma", time: "45m ago", dot: "bg-amber-400" },
                { icon: "🚨", text: "Abuse report filed — under review", time: "1h ago", dot: "bg-red-400" },
                { icon: "👨‍🏫", text: "New mentor registration: Karan Patel", time: "2h ago", dot: "bg-teal-400" },
            ].map((a, i) => (<div key={i} className="flex items-center gap-3">
                        <span className={`w-2 h-2 ${a.dot} rounded-full flex-shrink-0`}/>
                        <div className="flex-1 text-sm text-slate-700">{a.text}</div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{a.time}</span>
                      </div>))}
                  </div>
                </div>
              </div>

              {/* Platform Stats Bar */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
                <h3 className="font-bold mb-4">Platform Health</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                { label: "Avg. Session Rating", val: "4.8/5.0" },
                { label: "Booking Acceptance Rate", val: "94.2%" },
                { label: "Avg. Response Time", val: "2.4 hours" },
                { label: "Monthly Active Users", val: "8,240" },
            ].map(s => (<div key={s.label} className="bg-white/10 rounded-xl p-3">
                      <div className="text-xl font-bold">{s.val}</div>
                      <div className="text-indigo-200 text-xs mt-0.5">{s.label}</div>
                    </div>))}
                </div>
              </div>
            </>)}

          {activeNav === "verification" && (<>
              <p className="text-slate-500 text-sm mb-6">Review and verify mentor applications before they go live on the platform.</p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {["Mentor", "Type", "Organization", "Submitted", "Status"].map(h => (<th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>))}
                        <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingVerifications.map((v, i) => (<tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
                                {v.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800 text-sm">{v.name}</div>
                                <div className="text-slate-400 text-xs">{v.dept}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{v.type}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{v.org}</td>
                          <td className="px-5 py-4 text-sm text-slate-500">{v.submitted}</td>
                          <td className="px-5 py-4">
                            {verifStatuses[i] ? (<span className={`text-xs font-bold px-2.5 py-1 rounded-full ${verifStatuses[i] === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                {verifStatuses[i] === "approved" ? "✓ Approved" : "✕ Rejected"}
                              </span>) : (<span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Pending</span>)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!verifStatuses[i] && (<div className="flex justify-end gap-2">
                                <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors" onClick={() => setVerifStatuses(p => ({ ...p, [i]: "approved" }))}>
                                  ✓ Approve
                                </button>
                                <button className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors" onClick={() => setVerifStatuses(p => ({ ...p, [i]: "rejected" }))}>
                                  ✕ Reject
                                </button>
                                <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors">
                                  View
                                </button>
                              </div>)}
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>)}

          {activeNav !== "dashboard" && activeNav !== "verification" && (<div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center max-w-sm mx-auto">
              <div className="text-5xl mb-4">{navItems.find(n => n.id === activeNav)?.icon}</div>
              <h3 className="font-bold text-slate-700 text-lg mb-2">{navItems.find(n => n.id === activeNav)?.label}</h3>
              <p className="text-slate-400 text-sm">Full admin interface available in the complete implementation.</p>
            </div>)}
        </div>
      </main>
    </div>);
}
