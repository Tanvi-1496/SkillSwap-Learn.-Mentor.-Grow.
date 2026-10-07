import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const avatarColors = [
    "bg-indigo-600",
    "bg-violet-600",
    "bg-emerald-600",
    "bg-pink-600",
];

const filters = [
    { label: "Skill Match", options: ["All", "Python", "ML", "Data Science", "DSA"] },
    { label: "Mentor Type", options: ["All", "Faculty", "Senior Student", "Alumni", "Industry"] },
    { label: "Experience", options: ["All", "1-3 years", "4-6 years", "7+ years"] },
    { label: "Rating", options: ["All", "4.5+", "4.0+", "Any"] },
];

const toPercent = (value) =>
    typeof value === "number" ? Math.round(value * 100) : null;

const getInitials = (name) => {
    if (!name || typeof name !== "string") return "M";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "M";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function AIRecommendations({ onNavigate }) {
    const [expandedWhy, setExpandedWhy] = useState(null);
    const [sortBy, setSortBy] = useState("Best Match");
    const [showArch, setShowArch] = useState(false);
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadRecommendations = async () => {
            setLoading(true);
            setError(null);

            try {
                const {
                    data: { session },
                    error: sessionError
                } = await supabase.auth.getSession();

                if (sessionError) {
                    throw new Error(sessionError.message);
                }

                const token = session?.access_token;

                if (!token) {
                    throw new Error(
                        "Please log in to see your recommendations."
                    );
                }

                const response = await fetch(
                    "http://localhost:5000/recommendations",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error || "Failed to load recommendations."
                    );
                }

                setMentors(
                    Array.isArray(data.recommendations)
                        ? data.recommendations
                        : []
                );
            } catch (err) {
                console.error("Recommendation load error:", err.message);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadRecommendations();
    }, []);

    return (<div className="min-h-screen bg-[#F5F7FC]">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-xs">
        <button className="flex items-center gap-2 text-sm font-semibold text-[#172033] hover:text-[#4F46E5] transition-colors bg-[#F5F7FC] px-3 py-1.5 rounded-xl border border-[#E5E7EB]" onClick={() => onNavigate("menteeDashboard")}>
          ← Back to Dashboard
        </button>
        <div className="h-5 w-px bg-[#E5E7EB]"/>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#4F46E5] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-[#172033]">SkillSwap</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#EEF0FF] border border-[#EEF0FF] rounded-full px-4 py-1.5 mb-4 shadow-xs">
            <span className="text-[#4F46E5] text-sm">🤖</span>
            <span className="text-[#4F46E5] text-sm font-semibold">Powered by SBERT Semantic Matching</span>
          </div>
          <h1 className="text-3xl font-bold text-[#172033] mb-2">AI-Powered Mentor Recommendations</h1>
          <p className="text-[#718096] max-w-xl mx-auto text-sm">
            Based on your skills, goals, requirements and preferences, we&apos;ve found mentors who are the best fit for you.
          </p>
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
                { icon: "📊", label: "Goal + Experience + Rating + Availability" },
                { sep: "↓" },
                { icon: "⚡", label: "Weighted Compatibility Score" },
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

        {/* Results header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">Recommended For You</h2>
          {!loading && !error && (<span className="text-slate-500 text-sm">
              {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"} found
            </span>)}
        </div>

        {/* Loading state */}
        {loading && (<div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
            <div className="text-4xl mb-4 animate-pulse">🤖</div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">Finding your best matches…</h3>
            <p className="text-slate-400 text-sm">Running semantic matching against mentor profiles.</p>
          </div>)}

        {/* Error state */}
        {!loading && error && (<div className="bg-white rounded-2xl p-12 border border-red-100 shadow-sm text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">Could not load recommendations</h3>
            <p className="text-slate-500 text-sm mb-5">{error}</p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors" onClick={() => onNavigate("menteeDashboard")}>
              Back to Dashboard
            </button>
          </div>)}

        {/* Empty state */}
        {!loading && !error && mentors.length === 0 && (<div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">No recommendations yet</h3>
            <p className="text-slate-400 text-sm mb-5">
              Complete your profile so the AI has enough information to match you with mentors.
            </p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors" onClick={() => onNavigate("menteeRequirements")}>
              Complete Profile
            </button>
          </div>)}

        {/* Results */}
        {!loading && !error && mentors.length > 0 && (<div className="space-y-4">
          {mentors.map((m, i) => {
            const overall = toPercent(m.scores?.overall);
            const semantic = toPercent(m.scores?.semantic_similarity);
            const goal = toPercent(m.scores?.goal_match);
            const ratingScore = m.scores?.rating;
            const hasRating = typeof ratingScore === "number" && ratingScore > 0;
            const ratingOutOfFive = hasRating ? (ratingScore * 5).toFixed(1) : null;
            const hasSlots = (m.scores?.availability || 0) > 0;

            return (<div key={m.mentor_id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs hover:border-[#4F46E5]/40 transition-all overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-xs">
                      {getInitials(m.name)}
                    </div>
                    {i === 0 && (<div className="absolute -top-1 -right-1 bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-xs">★1</div>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-wrap gap-2 mb-1">
                      <h3 className="font-bold text-[#172033] text-lg">{m.name || "Mentor"}</h3>
                      <div className="flex items-center gap-1.5">
                        {m.verified && (<span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-2.5 py-0.5 rounded-full">✓ Verified</span>)}
                        {m.organization && (<span className="text-[#718096] text-xs">· {m.organization}</span>)}
                      </div>
                    </div>
                    {m.mentor_type && (<p className="text-[#4F46E5] text-sm font-semibold mb-2">{m.mentor_type}</p>)}
                    {m.skills.length > 0 && (<div className="flex flex-wrap gap-1.5 mb-3">
                      {m.skills.map(s => <span key={s} className="bg-[#EEF0FF] text-[#4F46E5] border border-[#EEF0FF] text-xs font-semibold px-2.5 py-1 rounded-full">{s}</span>)}
                    </div>)}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-[#718096]">
                      <span>⭐ <strong className="text-[#172033]">{ratingOutOfFive || "Not rated yet"}</strong></span>
                      {m.experience !== null && (<span>💼 <strong className="text-[#172033]">{m.experience}</strong> yrs</span>)}
                      <span>📍 {hasSlots ? "Slots published" : "No slots published"}</span>
                    </div>
                  </div>
                  {overall !== null && (<div className="flex-shrink-0 text-center">
                    <div className="w-18 h-18 rounded-full border-4 border-[#EEF0FF] flex items-center justify-center bg-[#EEF0FF]/40 mb-2">
                      <div>
                        <div className="text-xl font-bold text-[#4F46E5]">{overall}%</div>
                        <div className="text-[10px] text-[#4F46E5] font-semibold uppercase tracking-wider">Match</div>
                      </div>
                    </div>
                  </div>)}
                </div>

                {/* Score Breakdown */}
                <div className="mt-4 bg-[#F5F7FC] rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3 border border-[#E5E7EB]">
                  {[
                { label: "Semantic Match", val: semantic !== null ? `${semantic}%` : "—", icon: "🔗" },
                { label: "Goal Match", val: goal !== null ? `${goal}%` : "—", icon: "🏆" },
                { label: "Experience", val: m.experience !== null ? `${m.experience} yrs` : "—", icon: "💼" },
                { label: "Availability", val: hasSlots ? "Published" : "None", icon: "🗓" },
                { label: "Rating", val: ratingOutOfFive ? `${ratingOutOfFive} ⭐` : "—", icon: "⭐" },
            ].map(sc => (<div key={sc.label} className="text-center">
                      <div className="text-base mb-0.5">{sc.icon}</div>
                      <div className="font-bold text-[#172033] text-sm">{sc.val}</div>
                      <div className="text-[#718096] text-xs">{sc.label}</div>
                    </div>))}
                </div>

                {/* Why this mentor */}
                <button className="mt-3 text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium flex items-center gap-1 cursor-pointer" onClick={() => setExpandedWhy(expandedWhy === i ? null : i)}>
                  {expandedWhy === i ? "▼" : "▶"} Why this mentor?
                </button>
                {expandedWhy === i && (<div className="mt-2 bg-[#EEF0FF] border border-[#EEF0FF] rounded-xl p-3 text-sm text-[#172033] space-y-2">
                    <p>
                      This mentor scored <strong className="text-[#4F46E5]">{overall}%</strong> overall. The score combines
                      semantic similarity between your profile and the mentor&apos;s profile with
                      goal overlap, experience, rating and availability.
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5 text-xs text-[#718096]">
                      <li>Semantic similarity: {semantic !== null ? `${semantic}%` : "unavailable"}</li>
                      <li>Goal / skill overlap: {goal !== null ? `${goal}%` : "unavailable"}</li>
                      <li>Experience: {m.experience !== null ? `${m.experience} years` : "not listed"}</li>
                      <li>Rating: {ratingOutOfFive ? `${ratingOutOfFive} / 5` : "no reviews yet"}</li>
                      <li>Availability: {hasSlots ? "slots published" : "no slots published"}</li>
                    </ul>
                    {m.bio && (<p className="pt-2 border-t border-[#4F46E5]/10 text-xs text-[#172033]/80">{m.bio}</p>)}
                  </div>)}
              </div>

              <div className="px-5 pb-5 flex gap-3">
                <button className="flex-1 bg-white hover:bg-[#F5F7FC] text-[#172033] font-semibold py-2.5 rounded-xl text-sm transition-colors border border-[#E5E7EB] cursor-pointer" onClick={() => onNavigate("mentorProfile", { mentorId: m.mentor_id })}>
                  View Profile
                </button>
                <button className="flex-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-xs cursor-pointer" onClick={() => onNavigate("booking", { mentorId: m.mentor_id })}>
                  Book Session
                </button>
              </div>
            </div>);
          })}
        </div>)}
      </div>
    </div>);
}