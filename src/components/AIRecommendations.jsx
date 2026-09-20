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
    if (!name) {
        return "M";
    }

    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
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

            return (<div key={m.mentor_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className={`w-14 h-14 ${avatarColors[i % avatarColors.length]} rounded-2xl flex items-center justify-center text-white font-bold text-lg`}>
                      {getInitials(m.name)}
                    </div>
                    {i === 0 && (<div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">★1</div>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-wrap gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-lg">{m.name || "Mentor"}</h3>
                      <div className="flex items-center gap-1">
                        {m.verified && (<span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>)}
                        {m.organization && (<span className="text-slate-400 text-xs">· {m.organization}</span>)}
                      </div>
                    </div>
                    {m.mentor_type && (<p className="text-indigo-600 text-sm font-semibold mb-2">{m.mentor_type}</p>)}
                    {m.skills.length > 0 && (<div className="flex flex-wrap gap-1.5 mb-3">
                      {m.skills.map(s => <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full">{s}</span>)}
                    </div>)}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span>⭐ <strong>{ratingOutOfFive || "Not rated yet"}</strong></span>
                      {m.experience !== null && (<span>💼 {m.experience} yrs</span>)}
                      <span>📍 {hasSlots ? "Slots published" : "No slots published"}</span>
                    </div>
                  </div>
                  {overall !== null && (<div className="flex-shrink-0 text-center">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-100 flex items-center justify-center bg-indigo-50 mb-2">
                      <div>
                        <div className="text-2xl font-bold text-indigo-700">{overall}%</div>
                        <div className="text-xs text-indigo-500 font-medium">Match</div>
                      </div>
                    </div>
                  </div>)}
                </div>

                {/* Score Breakdown */}
                <div className="mt-4 bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                { label: "Semantic Match", val: semantic !== null ? `${semantic}%` : "—", icon: "🔗" },
                { label: "Goal Match", val: goal !== null ? `${goal}%` : "—", icon: "🏆" },
                { label: "Experience", val: m.experience !== null ? `${m.experience} yrs` : "—", icon: "💼" },
                { label: "Availability", val: hasSlots ? "Published" : "None", icon: "🗓" },
                { label: "Rating", val: ratingOutOfFive ? `${ratingOutOfFive} ⭐` : "—", icon: "⭐" },
            ].map(sc => (<div key={sc.label} className="text-center">
                      <div className="text-base mb-0.5">{sc.icon}</div>
                      <div className="font-bold text-slate-800 text-sm">{sc.val}</div>
                      <div className="text-slate-500 text-xs">{sc.label}</div>
                    </div>))}
                </div>

                {/* Why this mentor */}
                <button className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1" onClick={() => setExpandedWhy(expandedWhy === i ? null : i)}>
                  {expandedWhy === i ? "▼" : "▶"} Why this mentor?
                </button>
                {expandedWhy === i && (<div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800 space-y-2">
                    <p>
                      This mentor scored <strong>{overall}%</strong> overall. The score combines
                      semantic similarity between your profile and the mentor&apos;s profile with
                      goal overlap, experience, rating and availability.
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>Semantic similarity: {semantic !== null ? `${semantic}%` : "unavailable"}</li>
                      <li>Goal / skill overlap: {goal !== null ? `${goal}%` : "unavailable"}</li>
                      <li>Experience: {m.experience !== null ? `${m.experience} years` : "not listed"}</li>
                      <li>Rating: {ratingOutOfFive ? `${ratingOutOfFive} / 5` : "no reviews yet"}</li>
                      <li>Availability: {hasSlots ? "slots published" : "no slots published"}</li>
                    </ul>
                    {m.bio && (<p className="pt-1 border-t border-indigo-100">{m.bio}</p>)}
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
            </div>);
          })}
        </div>)}
      </div>
    </div>);
}