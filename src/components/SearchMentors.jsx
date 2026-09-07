import { useState } from "react";
const allMentors = [
    { name: "Dr. Priya Sharma", type: "Faculty", avatar: "PS", bg: "bg-indigo-600", skills: ["Python", "ML", "Data Science"], rating: 4.9, exp: "8 years", availability: "Mon, Wed, Fri", match: 94, sessions: 120, org: "IIT Bombay" },
    { name: "Rahul Verma", type: "Senior Student", avatar: "RV", bg: "bg-violet-600", skills: ["DSA", "Java", "C++"], rating: 4.7, exp: "2 years", availability: "Weekends", match: 89, sessions: 48, org: "IIT Delhi" },
    { name: "Anjali Mehta", type: "Alumni", avatar: "AM", bg: "bg-pink-600", skills: ["React", "Node.js", "UI/UX"], rating: 4.8, exp: "4 years", availability: "Sat, Sun", match: 91, sessions: 76, org: "Google India" },
    { name: "Karan Patel", type: "Industry", avatar: "KP", bg: "bg-emerald-600", skills: ["AWS", "DevOps", "Cloud"], rating: 4.9, exp: "6 years", availability: "Weekday evenings", match: 87, sessions: 95, org: "Amazon" },
    { name: "Neha Gupta", type: "Alumni", avatar: "NG", bg: "bg-amber-600", skills: ["Data Science", "R", "Tableau"], rating: 4.8, exp: "5 years", availability: "Sat, Sun", match: 88, sessions: 89, org: "Microsoft" },
    { name: "Arjun Nair", type: "Industry", avatar: "AN", bg: "bg-teal-600", skills: ["ML Ops", "Spark", "AWS"], rating: 4.7, exp: "6 years", availability: "Weekday evenings", match: 82, sessions: 64, org: "Amazon" },
];
export default function SearchMentors({ onNavigate }) {
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [filterRating, setFilterRating] = useState("All");
    const [view, setView] = useState("grid");
    const filtered = allMentors.filter(m => {
        const q = search.toLowerCase();
        const matchSearch = !q || m.name.toLowerCase().includes(q) || m.skills.some(s => s.toLowerCase().includes(q)) || m.type.toLowerCase().includes(q);
        const matchType = filterType === "All" || m.type === filterType;
        const matchRating = filterRating === "All" || (filterRating === "4.5+" && m.rating >= 4.5) || (filterRating === "4.0+" && m.rating >= 4.0);
        return matchSearch && matchType && matchRating;
    });
    return (<div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => onNavigate("landing")}>
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          SkillSwap
        </button>
        <div className="h-5 w-px bg-slate-200"/>
        <span className="font-bold text-slate-800">Find Mentors</span>
        <div className="ml-auto flex gap-2">
          <button className="text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors" onClick={() => onNavigate("login")}>Login</button>
          <button className="text-sm font-semibold bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors" onClick={() => onNavigate("register")}>Get Started</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search + Filters */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for Python, Machine Learning, DSA, Web Dev..." className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"/>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-wrap gap-2">
              {[
            { label: "Type", options: ["All", "Faculty", "Senior Student", "Alumni", "Industry"], val: filterType, set: setFilterType },
            { label: "Rating", options: ["All", "4.5+", "4.0+"], val: filterRating, set: setFilterRating },
        ].map(f => (<select key={f.label} value={f.val} onChange={e => f.set(e.target.value)} className="text-sm border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:border-indigo-300 cursor-pointer">
                  <option value="">{f.label}: All</option>
                  {f.options.slice(1).map(o => <option key={o} value={o}>{f.label}: {o}</option>)}
                </select>))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-slate-500 text-sm">{filtered.length} mentors</span>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {["grid", "list"].map(v => (<button key={v} className={`px-3 py-1.5 rounded-md text-sm transition-all ${view === v ? "bg-white shadow-sm text-indigo-600 font-semibold" : "text-slate-500"}`} onClick={() => setView(v)}>
                    {v === "grid" ? "⊞" : "☰"}
                  </button>))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {view === "grid" ? (<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(m => (<div key={m.name} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${m.bg} rounded-full flex items-center justify-center text-white font-bold`}>{m.avatar}</div>
                  <div className="text-right">
                    <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{m.match}% Match</div>
                    <div className="text-xs text-slate-400 mt-1">{m.org}</div>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800">{m.name}</h3>
                <p className="text-indigo-600 text-xs font-semibold mb-2">{m.type}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {m.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span>⭐ {m.rating}</span>
                  <span>{m.sessions} sessions</span>
                  <span>{m.exp}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors" onClick={() => onNavigate("mentorProfile")}>
                    View
                  </button>
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors" onClick={() => onNavigate("booking")}>
                    Book
                  </button>
                </div>
              </div>))}
          </div>) : (<div className="space-y-3">
            {filtered.map(m => (<div key={m.name} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex items-center gap-4">
                <div className={`w-12 h-12 ${m.bg} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{m.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800">{m.name}</h3>
                    <span className="text-xs text-slate-400">· {m.org}</span>
                  </div>
                  <p className="text-indigo-600 text-xs font-semibold">{m.type}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {m.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                  <span>⭐ {m.rating}</span>
                  <span>{m.sessions} sessions</span>
                  <div className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">{m.match}%</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs transition-colors" onClick={() => onNavigate("mentorProfile")}>View</button>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors" onClick={() => onNavigate("booking")}>Book</button>
                </div>
              </div>))}
          </div>)}

        {filtered.length === 0 && (<div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">No mentors found</h3>
            <p className="text-slate-400 text-sm">Try different search terms or clear your filters.</p>
          </div>)}
      </div>
    </div>);
}
