import { useEffect, useState } from "react";

export default function MentorProfile({ onNavigate, mentorId, fromPage }) {
    const [activeTab, setActiveTab] = useState("about");
    const [selectedDay, setSelectedDay] = useState("Monday");
    const [mentor, setMentor] = useState(null);

    const targetBack = fromPage === "aiRecs" ? "aiRecs" : fromPage === "menteeDashboard" ? "menteeDashboard" : fromPage === "landing" ? "landing" : "search";
    const targetLabel = fromPage === "aiRecs" ? "AI Recommendations" : fromPage === "menteeDashboard" ? "Dashboard" : fromPage === "landing" ? "Home" : "Mentors Directory";

    const getInitials = (name) => {
        if (!name || typeof name !== "string") return "M";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "M";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const formatMentorType = (type) => {
        if (!type) return "Mentor";
        const clean = String(type).replace(/_/g, " ").toLowerCase();
        return clean.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const availability = {
        Monday: mentor?.availability?.find((a) => a.day === "Monday")?.slots || [],
        Tuesday: mentor?.availability?.find((a) => a.day === "Tuesday")?.slots || [],
        Wednesday: mentor?.availability?.find((a) => a.day === "Wednesday")?.slots || [],
        Thursday: mentor?.availability?.find((a) => a.day === "Thursday")?.slots || [],
        Friday: mentor?.availability?.find((a) => a.day === "Friday")?.slots || [],
        Saturday: mentor?.availability?.find((a) => a.day === "Saturday")?.slots || [],
        Sunday: mentor?.availability?.find((a) => a.day === "Sunday")?.slots || [],
    };

    useEffect(() => {
        if (!mentorId) return;

        fetch(`http://localhost:5000/mentors/${mentorId}`)
            .then((res) => res.json())
            .then((data) => {
                setMentor(data.mentor);
            })
            .catch((error) => {
                console.error("Mentor profile fetch error:", error);
            });
    }, [mentorId]);

    if (!mentorId && !mentor) {
        return (
            <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-6 text-center">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-[#E5E7EB] shadow-xs">
                    <div className="text-5xl mb-4">👨‍🏫</div>
                    <h2 className="text-xl font-bold text-[#172033] mb-2">No Mentor Selected</h2>
                    <p className="text-sm text-[#718096] mb-6">Please select a mentor from the directory to view their complete profile.</p>
                    <button
                        onClick={() => onNavigate("search")}
                        className="bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338CA] transition-colors cursor-pointer"
                    >
                        Browse Mentors
                    </button>
                </div>
            </div>
        );
    }

    const mentorInitials = getInitials(mentor?.name);

    return (
        <div className="min-h-screen bg-[#f5f7fc] text-[#172033]">
            {/* Header Nav */}
            <header className="bg-white border-b border-[#e5e7eb] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
                <button
                    className="flex items-center gap-2 text-[#172033] hover:text-[#4f46e5] transition-colors text-sm font-semibold bg-[#f5f7fc] border border-[#e5e7eb] px-3.5 py-2 rounded-xl cursor-pointer"
                    onClick={() => onNavigate(targetBack)}
                >
                    <span>←</span>
                    <span>Back to {targetLabel}</span>
                </button>
                <span className="text-xs font-semibold px-2.5 py-1 bg-[#eef0ff] text-[#4f46e5] rounded-full border border-[#c7d2fe]/40">
                    Verified Profile
                </span>
            </header>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Profile Header */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e5e7eb] shadow-xs mb-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="relative flex-shrink-0">
                            <div className="w-24 h-24 bg-[#4f46e5] rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-sm">
                                {mentorInitials}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-xs">
                                {mentor?.verified ? "✓ Active" : "Active"}
                            </div>
                        </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#172033] tracking-tight">
                      {mentor?.name || "Mentor"}
                  </h1>
                  <p className="text-[#4f46e5] font-semibold text-sm mt-0.5">
                      {formatMentorType(mentor?.mentor_type)}
                  </p>
                  <p className="text-[#718096] text-sm mt-1">
                      {mentor?.org || "SkillSwap Community"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-[#eef0ff] border border-[#c7d2fe]/40 rounded-2xl px-4 py-2 text-center">
                    <div className="text-2xl font-bold text-[#4f46e5]">94%</div>
                    <div className="text-[#4f46e5] text-xs font-semibold">Match Score</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 mt-4 text-sm text-[#718096]">
                {[
                      {
                          val: mentor?.averageRating > 0
                              ? Number(mentor.averageRating).toFixed(1)
                              : mentor?.rating > 0
                              ? Number(mentor.rating).toFixed(1)
                              : "New",
                          label: "Rating",
                          icon: "⭐"
                      },
                      { val: mentor?.sessions ?? mentor?.reviewCount ?? 0, label: "Sessions", icon: "🗓" },
                      { val: `${mentor?.experience || 0} yrs`, label: "Experience", icon: "💼" },
                      { val: "98%", label: "Response Rate", icon: "⚡" },
                  ].map(m => (<div key={m.label} className="flex items-center gap-1.5">
                    <span>{m.icon}</span>
                    <strong className="text-[#172033]">{m.val}</strong>
                    <span>{m.label}</span>
                  </div>))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {(mentor?.skills || []).map(s =>
                   (<span key={s} className="bg-[#eef0ff] text-[#4f46e5] text-xs font-medium px-3 py-1 rounded-full border border-[#c7d2fe]/30">{s}</span>))}
              </div>
            </div>
          </div>

          <button className="w-full mt-6 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-3.5 rounded-xl transition-all shadow-xs text-sm cursor-pointer" onClick={() => onNavigate("booking", { mentorId: mentorId || mentor?.user_id })}>
            Book a Mentoring Session →
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#e5e7eb] shadow-xs mb-6 overflow-x-auto">
          {["about", "experience", "availability", "reviews"].map(tab => (<button key={tab} className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize cursor-pointer ${activeTab === tab ? "bg-[#4f46e5] text-white shadow-xs" : "text-[#718096] hover:text-[#172033] hover:bg-[#f5f7fc]"}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>))}
        </div>

        {activeTab === "about" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-800 text-lg mb-3">About</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                {mentor?.bio || "This mentor has not added a detailed bio yet."}
            </p>
            <div className="mt-5">
              <h3 className="font-bold text-slate-800 mb-3">Mentoring Areas</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                { icon: "🔬", label: "Research & Projects" },
                { icon: "💼", label: "Placement Preparation" },
                { icon: "🎤", label: "Interview Preparation" },
                { icon: "📚", label: "Academic Guidance" },
            ].map(a => (<div key={a.label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-sm font-medium text-slate-700">{a.label}</span>
                  </div>))}
              </div>
            </div>
          </div>)}

        {activeTab === "experience" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-800 text-lg mb-5">Experience & Education</h2>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-100"/>
                              {[
                  {
                    type: "work",
                    title: `${mentor?.experience || 0} Years of Experience`,
                    org: mentor?.org || "Organization not specified",
                    period: "Professional Experience",
                    desc: mentor?.bio || "No additional experience details available."
                  }
                ].map((e, i) => (<div key={i} className="relative pl-10 pb-6">
                  <div className={`absolute left-2 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${e.type === "work" ? "bg-indigo-600 border-indigo-600" : "bg-violet-600 border-violet-600"}`}>
                    <span className="text-white text-xs">{e.type === "work" ? "W" : "E"}</span>
                  </div>
                  <div>
                    <div className="flex items-start justify-between flex-wrap gap-1">
                      <div>
                        <div className="font-bold text-slate-800">{e.title}</div>
                        <div className="text-indigo-600 text-sm font-medium">{e.org}</div>
                      </div>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{e.period}</span>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">{e.desc}</p>
                  </div>
                </div>))}
            </div>
          </div>)}

        {activeTab === "availability" && (
          <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs">
            <h2 className="font-bold text-[#172033] text-lg mb-5">Availability</h2>
            <div className="flex gap-2 flex-wrap mb-5">
              {Object.entries(availability).map(([day, slots]) => (
                <button
                  key={day}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    slots.length === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : selectedDay === day
                      ? "bg-[#4F46E5] text-white shadow-xs"
                      : "bg-[#F5F7FC] text-[#172033] hover:bg-[#EEF0FF] hover:text-[#4F46E5] border border-[#E5E7EB]"
                  }`}
                  disabled={slots.length === 0}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                  {slots.length === 0 && <span className="ml-1 text-xs">(unavailable)</span>}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[#718096] text-sm font-semibold mb-3">{selectedDay} — Available slots:</p>
              <div className="flex flex-wrap gap-2">
                {(availability[selectedDay] || []).map(slot => (
                  <button
                    key={slot}
                    className="px-4 py-2 bg-[#EEF0FF] hover:bg-[#4F46E5] hover:text-white text-[#4F46E5] font-semibold rounded-xl text-sm transition-all border border-[#EEF0FF] hover:border-[#4F46E5]"
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <button
                className="mt-5 w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-3 rounded-xl transition-colors shadow-xs"
                onClick={() => onNavigate("booking", { mentorId: mentorId || mentor?.user_id })}
              >
                Book a Session →
              </button>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs">
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <div className="text-4xl font-bold text-[#172033]">
                    {mentor?.averageRating || "0.0"}
                  </div>
                  <div className="text-amber-400 text-lg">
                    {"★".repeat(Math.round(mentor?.averageRating || 0))}
                    {"☆".repeat(5 - Math.round(mentor?.averageRating || 0))}
                  </div>
                  <div className="text-[#718096] text-xs mt-1">
                    Based on {mentor?.reviewCount || 0} reviews
                  </div>
                </div>
              </div>
            </div>

            {mentor?.reviews?.length > 0 ? (
              mentor.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {review.student_id?.slice(0, 2).toUpperCase() || "ST"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#172033]">
                          Student
                        </span>
                        <span className="text-xs text-[#718096]">
                          {review.created_at
                            ? new Date(review.created_at).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      <div className="text-amber-400 text-sm">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[#172033]/80 text-sm leading-relaxed">
                    {review.text || "No review text provided."}
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs text-center">
                <p className="text-[#718096]">
                  No reviews yet for this mentor.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "mentoring" && (
          <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs">
            <h2 className="font-bold text-[#172033] text-lg mb-3">Mentoring Style & Approach</h2>
            <p className="text-[#172033]/80 leading-relaxed mb-5">
              {mentor?.bio || "This mentor has not added mentoring details yet."}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: "🎯", title: "Goal-oriented", desc: "Every session starts with a clear objective." },
                { icon: "💬", title: "Responsive", desc: "Replies within 4 hours on weekdays." },
                { icon: "📋", title: "Structured", desc: "Provides session notes and resources afterward." },
                { icon: "🚀", title: "Hands-on", desc: "Real project work, not just theory." },
              ].map(s => (
                <div key={s.title} className="bg-[#F5F7FC] rounded-xl p-4 flex items-start gap-3 border border-[#E5E7EB]">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-semibold text-[#172033] text-sm">{s.title}</div>
                    <div className="text-[#718096] text-xs mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>);
}
