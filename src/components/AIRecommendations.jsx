import { useState } from "react";
const mentors = [
    {
        name: "Dr. Priya Sharma",
        type: "Faculty Mentor",
        avatar: "PS",
        bg: "bg-indigo-600",
        skills: ["Python", "Machine Learning", "Data Science", "TensorFlow", "SQL"],
        rating: 4.9,
        exp: "8 years",
        sessions: 120,
        match: 94,
        availability: "Sat Evening ✓",
        workload: 40,
        skillMatch: 92,
        goalMatch: 96,
        org: "IIT Bombay",
        why: "Strong match for your Machine Learning and Data Science goals. Available during your preferred Saturday evening slot and has extensive project mentoring experience.",
    },
    {
        name: "Neha Gupta",
        type: "Alumni Mentor",
        avatar: "NG",
        bg: "bg-violet-600",
        skills: ["Data Science", "Python", "Statistics", "R", "Tableau"],
        rating: 4.8,
        exp: "5 years",
        sessions: 89,
        match: 88,
        availability: "Sat, Sun",
        workload: 55,
        skillMatch: 88,
        goalMatch: 90,
        org: "Google India",
        why: "Alumna who works in Data Science at Google. Excellent for placement-focused mentoring and industry insights into data roles.",
    },
    {
        name: "Arjun Nair",
        type: "Industry Professional",
        avatar: "AN",
        bg: "bg-emerald-600",
        skills: ["ML Ops", "Python", "AWS", "Data Engineering", "Spark"],
        rating: 4.7,
        exp: "6 years",
        sessions: 64,
        match: 82,
        availability: "Weekday evenings",
        workload: 30,
        skillMatch: 84,
        goalMatch: 80,
        org: "Amazon",
        why: "Strong ML Engineering background. Best for students targeting data engineering or ML ops roles in product companies.",
    },
    {
        name: "Dr. Vikram Singh",
        type: "Faculty Mentor",
        avatar: "VS",
        bg: "bg-pink-600",
        skills: ["Deep Learning", "NLP", "Computer Vision", "Research"],
        rating: 4.9,
        exp: "10 years",
        sessions: 145,
        match: 78,
        availability: "Wed, Fri",
        workload: 65,
        skillMatch: 80,
        goalMatch: 75,
        org: "NIT Delhi",
        why: "Research-oriented mentor. Ideal if you're targeting higher studies or AI research roles. Availability doesn't match your preferred time.",
    },
];
const filters = [
    { label: "Skill Match", options: ["All", "Python", "ML", "Data Science", "DSA"] },
    { label: "Mentor Type", options: ["All", "Faculty", "Senior Student", "Alumni", "Industry"] },
    { label: "Experience", options: ["All", "1-3 years", "4-6 years", "7+ years"] },
    { label: "Rating", options: ["All", "4.5+", "4.0+", "Any"] },
];
export default function AIRecommendations({ onNavigate }) {
    const [expandedWhy, setExpandedWhy] = useState(null);
    const [sortBy, setSortBy] = useState("Best Match");
    const [showArch, setShowArch] = useState(false);
    return (<div className="min-h-screen bg-[#f8f9ff]">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => onNavigate("menteeDashboard")}>
          ← Back to Dashboard
        </button>
        <div className="h-5 w-px bg-slate-200"/>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-bold text-slate-800">SkillSwap</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-4">
            <span className="text-indigo-600 text-sm">🤖</span>
            <span className="text-indigo-700 text-sm font-semibold">Powered by SBERT Semantic Matching</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AI-Powered Mentor Recommendations</h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            Based on your skills, goals, requirements and preferences, we've found mentors who are the best fit for you.
          </p>
        </div>

        {/* Your Profile Summary */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Your Requirement Profile</h2>
            <button className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">Edit Profile</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
            { label: "Skills", value: "Python • Machine Learning • SQL", color: "bg-indigo-50 text-indigo-700" },
            { label: "Goal", value: "Data Science Placement", color: "bg-violet-50 text-violet-700" },
            { label: "Experience", value: "Intermediate", color: "bg-amber-50 text-amber-700" },
            { label: "Preferred Time", value: "Saturday Evening", color: "bg-emerald-50 text-emerald-700" },
        ].map(item => (<div key={item.label} className={`${item.color} rounded-xl px-3 py-2.5`}>
                <div className="text-xs font-semibold opacity-70 mb-0.5">{item.label}</div>
                <div className="text-sm font-bold">{item.value}</div>
              </div>))}
          </div>
        </div>

        {/* AI Architecture */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-5 mb-6 border border-indigo-800/30">
          <button className="w-full flex items-center justify-between" onClick={() => setShowArch(!showArch)}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <div className="text-left">
                <div className="text-white font-bold">How Our AI Recommends Mentors</div>
                <div className="text-slate-400 text-sm">SBERT-powered semantic matching pipeline</div>
              </div>
            </div>
            <span className="text-slate-400 text-lg">{showArch ? "▲" : "▼"}</span>
          </button>
          {showArch && (<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: "👤", label: "Mentee Requirements" },
                { sep: "↓" },
                { icon: "🔤", label: "SBERT Embeddings" },
                { sep: "↓" },
                { icon: "🔗", label: "Semantic Similarity" },
                { sep: "↓" },
                { icon: "📊", label: "Exp + Availability + Rating + Workload" },
                { sep: "↓" },
                { icon: "⚡", label: "Hybrid Compatibility Score" },
                { sep: "↓" },
                { icon: "🏆", label: "Mentor Ranking" },
                { sep: "↓" },
                { icon: "✅", label: "Top Recommended Mentors" },
            ].map((step, i) => ("sep" in step ? (<div key={i} className="text-indigo-400 font-bold text-lg">{step.sep}</div>) : (<div key={i} className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-center">
                    <div className="text-xl mb-1">{step.icon}</div>
                    <div className="text-white text-xs font-medium whitespace-nowrap">{step.label}</div>
                  </div>)))}
            </div>)}
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 flex flex-wrap gap-2">
            {filters.map(f => (<select key={f.label} className="text-sm border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:border-indigo-300 cursor-pointer">
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-indigo-300 cursor-pointer">
              {["Best Match", "Highest Rated", "Most Experienced", "Available Soonest"].map(o => (<option key={o}>{o}</option>))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">Recommended For You</h2>
          <span className="text-slate-500 text-sm">{mentors.length} mentors found</span>
        </div>

        <div className="space-y-4">
          {mentors.map((m, i) => (<div key={m.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className={`w-14 h-14 ${m.bg} rounded-2xl flex items-center justify-center text-white font-bold text-lg`}>{m.avatar}</div>
                    {i === 0 && (<div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">★1</div>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-wrap gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-lg">{m.name}</h3>
                      <div className="flex items-center gap-1">
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
                        <span className="text-slate-400 text-xs">· {m.org}</span>
                      </div>
                    </div>
                    <p className="text-indigo-600 text-sm font-semibold mb-2">{m.type}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {m.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{s}</span>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span>⭐ <strong>{m.rating}</strong></span>
                      <span>🗓 {m.sessions} sessions</span>
                      <span>💼 {m.exp}</span>
                      <span>📍 {m.availability}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-100 flex items-center justify-center bg-indigo-50 mb-2">
                      <div>
                        <div className="text-2xl font-bold text-indigo-700">{m.match}%</div>
                        <div className="text-xs text-indigo-500 font-medium">Match</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="mt-4 bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                { label: "Skill Match", val: `${m.skillMatch}%`, icon: "🎯" },
                { label: "Goal Match", val: `${m.goalMatch}%`, icon: "🏆" },
                { label: "Experience", val: "Excellent", icon: "💼" },
                { label: "Availability", val: "Matches", icon: "🗓" },
                { label: "Rating", val: `${m.rating} ⭐`, icon: "⭐" },
            ].map(sc => (<div key={sc.label} className="text-center">
                      <div className="text-base mb-0.5">{sc.icon}</div>
                      <div className="font-bold text-slate-800 text-sm">{sc.val}</div>
                      <div className="text-slate-500 text-xs">{sc.label}</div>
                    </div>))}
                </div>

                {/* Workload */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-slate-500">Current workload:</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${m.workload < 50 ? "bg-emerald-400" : m.workload < 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${m.workload}%` }}/>
                  </div>
                  <span className={`text-xs font-bold ${m.workload < 50 ? "text-emerald-600" : m.workload < 70 ? "text-amber-600" : "text-red-600"}`}>{m.workload}%</span>
                </div>

                {/* Why this mentor */}
                <button className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1" onClick={() => setExpandedWhy(expandedWhy === i ? null : i)}>
                  {expandedWhy === i ? "▼" : "▶"} Why this mentor?
                </button>
                {expandedWhy === i && (<div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                    {m.why}
                  </div>)}
              </div>

              <div className="px-5 pb-5 flex gap-3">
                <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors" onClick={() => onNavigate("mentorProfile")}>
                  View Profile
                </button>
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm" onClick={() => onNavigate("booking")}>
                  Book Session
                </button>
              </div>
            </div>))}
        </div>
      </div>
    </div>);
}
