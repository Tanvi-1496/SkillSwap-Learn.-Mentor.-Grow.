import { useEffect, useState } from "react";

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

export default function SearchMentors({ onNavigate }) {
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [filterRating, setFilterRating] = useState("All");
    const [view, setView] = useState("grid");
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch("http://localhost:5000/mentors")
            .then(res => res.json())
            .then(data => {
                const rawList = Array.isArray(data?.mentors) ? data.mentors : [];
                const formattedMentors = rawList.map(m => ({
                    name: m.name || "Mentor",
                    id: m.user_id,
                    type: formatMentorType(m.mentor_type),
                    rawType: m.mentor_type || "",
                    avatar: getInitials(m.name),
                    bg: "bg-[#4f46e5]",
                    skills: Array.isArray(m.skills) ? m.skills : [],
                    rating: Number(m.rating) || 0,
                    exp: m.experience !== undefined && m.experience !== null ? `${m.experience} yrs exp` : "Experienced",
                    availability: m.availability || "Check availability",
                    match: Number(m.match || m.match_score) || 0,
                    sessions: Number(m.sessions) || 0,
                    org: m.org || "Verified Mentor"
                }));

                setMentors(formattedMentors);
            })
            .catch(error => {
                console.error("Failed to fetch mentors:", error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const filtered = mentors.filter(m => {
        const q = search.toLowerCase().trim();

        const matchSearch =
            !q ||
            m.name.toLowerCase().includes(q) ||
            m.skills.some(s => s.toLowerCase().includes(q)) ||
            m.type.toLowerCase().includes(q) ||
            m.org.toLowerCase().includes(q);

        const matchType =
            filterType === "All" ||
            m.type.toLowerCase() === filterType.toLowerCase() ||
            m.rawType.toLowerCase() === filterType.toLowerCase();

        const matchRating =
            filterRating === "All" ||
            (filterRating === "4.5+" && m.rating >= 4.5) ||
            (filterRating === "4.0+" && m.rating >= 4.0);

        return matchSearch && matchType && matchRating;
    });

    return (
        <div className="min-h-screen bg-[#f5f7fc] text-[#172033]">
            {/* Navbar */}
            <header className="bg-white border-b border-[#e5e7eb] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("landing")}>
                    <div className="w-8 h-8 bg-[#4f46e5] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs">
                        S
                    </div>
                    <span className="text-xl font-bold text-[#172033] tracking-tight">
                        SkillSwap
                    </span>
                    <span className="hidden sm:inline-block h-4 w-px bg-[#e5e7eb] mx-1" />
                    <span className="hidden sm:inline-block text-xs font-semibold text-[#718096]">
                        Mentor Directory
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        className="text-sm font-semibold text-[#172033] hover:text-[#4f46e5] px-3.5 py-2 rounded-xl hover:bg-[#f5f7fc] transition-colors cursor-pointer"
                        onClick={() => onNavigate("login")}
                    >
                        Login
                    </button>
                    <button
                        className="text-sm font-semibold bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                        onClick={() => onNavigate("register")}
                    >
                        Get Started
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Search + Filters Container */}
                <div className="bg-white rounded-2xl p-6 border border-[#e5e7eb] shadow-xs mb-8">
                    <div className="relative mb-5">
                        <svg
                            className="w-5 h-5 text-[#718096] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by mentor name, skill (Python, ML, DSA), or department..."
                            className="w-full pl-11 pr-4 py-3.5 bg-[#f5f7fc] border border-[#e5e7eb] rounded-xl text-sm text-[#172033] placeholder-[#718096] focus:bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0ff] transition-all"
                        />
                    </div>

                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex flex-wrap gap-2.5 items-center">
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="text-sm border border-[#e5e7eb] bg-[#f5f7fc] rounded-xl px-3.5 py-2 text-[#172033] font-medium focus:outline-none focus:border-[#4f46e5] cursor-pointer"
                            >
                                <option value="All">All Mentor Types</option>
                                <option value="Faculty">Faculty</option>
                                <option value="Senior Student">Senior Student</option>
                                <option value="Alumni">Alumni</option>
                                <option value="Industry">Industry</option>
                            </select>

                            <select
                                value={filterRating}
                                onChange={e => setFilterRating(e.target.value)}
                                className="text-sm border border-[#e5e7eb] bg-[#f5f7fc] rounded-xl px-3.5 py-2 text-[#172033] font-medium focus:outline-none focus:border-[#4f46e5] cursor-pointer"
                            >
                                <option value="All">All Ratings</option>
                                <option value="4.5+">Rating: 4.5+ ★</option>
                                <option value="4.0+">Rating: 4.0+ ★</option>
                            </select>

                            {(search || filterType !== "All" || filterRating !== "All") && (
                                <button
                                    onClick={() => {
                                        setSearch("");
                                        setFilterType("All");
                                        setFilterRating("All");
                                    }}
                                    className="text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca] px-3 py-2 rounded-xl bg-[#eef0ff] hover:bg-[#e0e7ff] transition-colors cursor-pointer"
                                >
                                    ✕ Clear Filters
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-[#718096]">
                                {filtered.length} {filtered.length === 1 ? "mentor" : "mentors"} available
                            </span>

                            <div className="flex gap-1 bg-[#f5f7fc] border border-[#e5e7eb] rounded-xl p-1">
                                <button
                                    type="button"
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        view === "grid"
                                            ? "bg-white shadow-xs text-[#4f46e5]"
                                            : "text-[#718096] hover:text-[#172033]"
                                    }`}
                                    onClick={() => setView("grid")}
                                    title="Grid View"
                                >
                                    ⊞ Grid
                                </button>
                                <button
                                    type="button"
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        view === "list"
                                            ? "bg-white shadow-xs text-[#4f46e5]"
                                            : "text-[#718096] hover:text-[#172033]"
                                    }`}
                                    onClick={() => setView("list")}
                                    title="List View"
                                >
                                    ☰ List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading Skeleton */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white rounded-2xl p-6 border border-[#e5e7eb] shadow-xs animate-pulse">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-14 h-14 bg-slate-200 rounded-full" />
                                    <div className="h-6 w-16 bg-slate-100 rounded-full" />
                                </div>
                                <div className="h-5 bg-slate-200 rounded w-2/3 mb-2" />
                                <div className="h-4 bg-slate-100 rounded w-1/3 mb-4" />
                                <div className="flex gap-1.5 mb-6">
                                    <div className="h-5 w-14 bg-slate-100 rounded-full" />
                                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex justify-between gap-2">
                                    <div className="h-8 bg-slate-100 rounded-xl flex-1" />
                                    <div className="h-8 bg-slate-200 rounded-xl flex-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-2xl p-12 border border-[#e5e7eb] shadow-xs text-center max-w-md mx-auto">
                        <div className="w-14 h-14 bg-[#eef0ff] text-[#4f46e5] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
                            🔍
                        </div>
                        <h3 className="font-bold text-[#172033] text-lg mb-2">No mentors found</h3>
                        <p className="text-[#718096] text-sm mb-6 leading-relaxed">
                            We couldn&apos;t find mentors matching your current criteria. Try expanding your search terms or clearing your active filters.
                        </p>
                        <button
                            onClick={() => {
                                setSearch("");
                                setFilterType("All");
                                setFilterRating("All");
                            }}
                            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                        >
                            Reset All Filters
                        </button>
                    </div>
                ) : view === "grid" ? (
                    /* 3-Column Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(m => (
                            <div
                                key={m.id}
                                className="bg-white rounded-2xl p-6 border border-[#e5e7eb] shadow-xs hover:shadow-md hover:border-[#c7d2fe] transition-all group flex flex-col justify-between"
                            >
                                <div>
                                    {/* TOP */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="w-13 h-13 bg-[#4f46e5] text-white rounded-full flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                                            {m.avatar}
                                        </div>
                                        <div className="text-right">
                                            {m.match > 0 ? (
                                                <span className="inline-block bg-[#eef0ff] text-[#4f46e5] text-xs font-bold px-2.5 py-1 rounded-full border border-[#c7d2fe]/40">
                                                    {m.match}% Match
                                                </span>
                                            ) : (
                                                <span className="inline-block bg-[#f5f7fc] text-[#718096] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#e5e7eb]">
                                                    Verified
                                                </span>
                                            )}
                                            <div className="text-xs text-[#718096] font-medium mt-1 truncate max-w-[130px]">
                                                {m.org}
                                            </div>
                                        </div>
                                    </div>

                                    {/* MIDDLE */}
                                    <h3 className="font-bold text-[#172033] text-lg group-hover:text-[#4f46e5] transition-colors leading-snug">
                                        {m.name}
                                    </h3>
                                    <p className="text-xs font-semibold text-[#4f46e5] mt-0.5 mb-3">
                                        {m.type}
                                    </p>

                                    {/* Skill Badges */}
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {m.skills.length > 0 ? (
                                            m.skills.map(s => (
                                                <span
                                                    key={s}
                                                    className="bg-[#eef0ff] text-[#4f46e5] text-xs font-medium px-2.5 py-0.5 rounded-full border border-[#c7d2fe]/30"
                                                >
                                                    {s}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-[#718096] italic">General Mentorship</span>
                                        )}
                                    </div>
                                </div>

                                {/* BOTTOM & ACTIONS */}
                                <div>
                                    <div className="flex items-center justify-between text-xs text-[#718096] pt-3 pb-4 border-t border-[#f1f5f9]">
                                        <span className="font-semibold text-[#172033]">
                                            ⭐ {m.rating > 0 ? m.rating.toFixed(1) : "New"}
                                        </span>
                                        <span>{m.sessions} sessions</span>
                                        <span>{m.exp}</span>
                                    </div>

                                    <div className="flex gap-2.5">
                                        <button
                                            className="flex-1 bg-[#f5f7fc] hover:bg-[#eef0ff] text-[#172033] hover:text-[#4f46e5] font-semibold py-2.5 rounded-xl text-xs transition-colors border border-[#e5e7eb] cursor-pointer"
                                            onClick={() => onNavigate("mentorProfile", { mentorId: m.id, fromPage: "search" })}
                                        >
                                            View Profile
                                        </button>
                                        <button
                                            className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                                            onClick={() => onNavigate("booking", { mentorId: m.id })}
                                        >
                                            Book Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-4">
                        {filtered.map(m => (
                            <div
                                key={m.id}
                                className="bg-white rounded-2xl p-5 border border-[#e5e7eb] shadow-xs hover:shadow-md hover:border-[#c7d2fe] transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-13 h-13 bg-[#4f46e5] text-white rounded-full flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                                        {m.avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-[#172033] text-base">{m.name}</h3>
                                            <span className="text-xs text-[#718096]">· {m.org}</span>
                                            {m.match > 0 && (
                                                <span className="bg-[#eef0ff] text-[#4f46e5] text-xs font-bold px-2 py-0.5 rounded-full border border-[#c7d2fe]/30">
                                                    {m.match}% Match
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-[#4f46e5] mt-0.5">{m.type}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {m.skills.map(s => (
                                                <span
                                                    key={s}
                                                    className="bg-[#eef0ff] text-[#4f46e5] text-xs font-medium px-2.5 py-0.5 rounded-full border border-[#c7d2fe]/30"
                                                >
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-[#f1f5f9]">
                                    <div className="flex items-center gap-4 text-xs text-[#718096]">
                                        <span className="font-semibold text-[#172033]">
                                            ⭐ {m.rating > 0 ? m.rating.toFixed(1) : "New"}
                                        </span>
                                        <span>{m.sessions} sessions</span>
                                        <span>{m.exp}</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            className="bg-[#f5f7fc] hover:bg-[#eef0ff] text-[#172033] hover:text-[#4f46e5] font-semibold py-2 px-3.5 rounded-xl text-xs transition-colors border border-[#e5e7eb] cursor-pointer"
                                            onClick={() => onNavigate("mentorProfile", { mentorId: m.id, fromPage: "search" })}
                                        >
                                            View
                                        </button>
                                        <button
                                            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-2 px-3.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                                            onClick={() => onNavigate("booking", { mentorId: m.id })}
                                        >
                                            Book
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}