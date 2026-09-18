// import { useState } from "react";
import { useEffect, useState } from "react";
const reviews = [
    { name: "Aryan Shah", avatar: "AS", bg: "bg-indigo-500", rating: 5, text: "Dr. Sharma completely transformed my understanding of ML. Her structured approach and real-world project examples were invaluable.", date: "Aug 15, 2025" },
    { name: "Preethi Rao", avatar: "PR", bg: "bg-pink-500", rating: 5, text: "Found my first data science internship after three sessions. Her interview prep guidance was spot on!", date: "Jul 28, 2025" },
    { name: "Kiran Dev", avatar: "KD", bg: "bg-emerald-500", rating: 4, text: "Very knowledgeable mentor. Sometimes sessions run over time because there's so much to cover — which is actually a good thing.", date: "Jul 12, 2025" },
];
const availability = {
    Mon: ["5:00 PM", "6:00 PM", "7:00 PM"],
    Tue: [],
    Wed: ["4:00 PM", "5:00 PM"],
    Thu: [],
    Fri: ["5:00 PM", "6:00 PM"],
    Sat: ["10:00 AM", "11:00 AM", "12:00 PM"],
    Sun: [],
};
export default function MentorProfile({ onNavigate }) {
    const [activeTab, setActiveTab] = useState("about");
    const [selectedDay, setSelectedDay] = useState("Mon");
    const [mentor, setMentor] = useState(null);

    useEffect(() => {
          const mentorId = "aa2e17ae-e96e-41b4-96de-3e101511312e";

          fetch(`http://localhost:5000/mentors/${mentorId}`)
              .then(res => res.json())
              .then(data => {
                  console.log("MENTOR PROFILE:", data);
                  setMentor(data.mentor);
              });
      }, []);
    return (<div className="min-h-screen bg-[#f8f9ff]">
      {/* Header Nav */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => onNavigate("aiRecs")}>
          ← AI Recommendations
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">PS</div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {mentor?.verified ? "✓ Verified" : "Not Verified"}
                </div>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                      {mentor?.name || "Mentor"}
                  </h1>
                  <p className="text-indigo-600 font-semibold">
                      {mentor?.mentor_type || "Mentor"}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                      {mentor?.org || "Organization"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2 text-center">
                    <div className="text-2xl font-bold text-indigo-700">94%</div>
                    <div className="text-indigo-500 text-xs font-semibold">Compatible with You</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 mt-4 text-sm">
                {[
                      { val: "4.9", label: "Rating", icon: "⭐" },
                      { val: "120", label: "Sessions", icon: "🗓" },
                      { val: `${mentor?.experience || 0} yrs`, label: "Experience", icon: "💼" },
                      { val: "98%", label: "Response Rate", icon: "⚡" },
                  ].map(m => (<div key={m.label} className="flex items-center gap-1.5">
                    <span>{m.icon}</span>
                    <strong className="text-slate-800">{m.val}</strong>
                    <span className="text-slate-500">{m.label}</span>
                  </div>))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {(mentor?.skills || []).map(s =>
                   (<span key={s} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100">{s}</span>))}
              </div>
            </div>
          </div>

          {/* AI Compatibility breakdown */}
          <div className="mt-5 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-100">
            <div className="text-sm font-bold text-slate-700 mb-3">AI Compatibility Breakdown</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
            { label: "Skill Match", val: 92 },
            { label: "Career Goal", val: 96 },
            { label: "Experience", val: 95 },
            { label: "Availability", val: 88 },
            { label: "Rating", val: 98 },
        ].map(b => (<div key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-bold text-indigo-700">{b.val}%</span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${b.val}%` }}/>
                  </div>
                </div>))}
            </div>
          </div>

          <button className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md text-base" onClick={() => onNavigate("booking")}>
            Book a Session
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm mb-6 overflow-x-auto">
          {["about", "experience", "mentoring", "availability", "reviews"].map(tab => (<button key={tab} className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>))}
        </div>

        {activeTab === "about" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-800 text-lg mb-3">About</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              {mentor?.bio || "No bio available."}
          </p>
            <p className="text-slate-600 leading-relaxed">
              She has mentored over 120 students through academic projects, research internships, and industry placements. Her students have been placed at Google, Microsoft, Amazon, and various top-tier startups. She believes in a hands-on, project-based approach to learning.
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
                { type: "work", title: "Associate Professor", org: "IIT Bombay, CSE Dept.", period: "2019 – Present", desc: "Teaching ML, Deep Learning courses. Mentoring M.Tech and B.Tech students." },
                { type: "work", title: "Assistant Professor", org: "NIT Warangal", period: "2016 – 2019", desc: "Founded the AI Research Lab. Published 12 papers in top conferences." },
                { type: "edu", title: "PhD, Computer Science", org: "IIT Delhi", period: "2012 – 2016", desc: "Thesis: Adaptive Deep Learning for Healthcare Diagnostics" },
                { type: "edu", title: "B.Tech, Computer Science", org: "BITS Pilani", period: "2008 – 2012", desc: "Gold Medalist · CGPA 9.8/10" },
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

        {activeTab === "availability" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-800 text-lg mb-5">Availability</h2>
            <div className="flex gap-2 flex-wrap mb-5">
              {Object.entries(availability).map(([day, slots]) => (<button key={day} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${slots.length === 0 ? "bg-slate-100 text-slate-400 cursor-not-allowed" : selectedDay === day ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"}`} disabled={slots.length === 0} onClick={() => setSelectedDay(day)}>
                  {day}
                  {slots.length === 0 && <span className="ml-1 text-xs">(unavailable)</span>}
                </button>))}
            </div>
            <div>
              <p className="text-slate-600 text-sm font-semibold mb-3">{selectedDay} — Available slots:</p>
              <div className="flex flex-wrap gap-2">
                {(availability[selectedDay] || []).map(slot => (<button key={slot} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-semibold rounded-xl text-sm transition-all border border-indigo-100 hover:border-indigo-600">
                    {slot}
                  </button>))}
              </div>
              <button className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors" onClick={() => onNavigate("booking")}>
                Book a Session →
              </button>
            </div>
          </div>)}

        {activeTab === "reviews" && (<div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <div className="text-4xl font-bold text-slate-900">4.9</div>
                  <div className="text-yellow-400 text-lg">★★★★★</div>
                  <div className="text-slate-500 text-xs">Based on 120 reviews</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => (<div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-3">{star}</span>
                      <span className="text-yellow-400 text-xs">★</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: star === 5 ? "85%" : star === 4 ? "12%" : "3%" }}/>
                      </div>
                    </div>))}
                </div>
              </div>
            </div>
            {reviews.map(r => (<div key={r.name} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 ${r.bg} rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{r.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{r.name}</span>
                      <span className="text-xs text-slate-400">{r.date}</span>
                    </div>
                    <div className="text-yellow-400 text-sm">{"★".repeat(r.rating)}</div>
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{r.text}</p>
              </div>))}
          </div>)}

        {activeTab === "mentoring" && (<div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="font-bold text-slate-800 text-lg mb-3">Mentoring Style & Approach</h2>
            <p className="text-slate-600 leading-relaxed mb-5">
              Dr. Sharma uses a project-based learning approach. Sessions are structured, outcome-focused, and tailored to the student's current level and career goals. She assigns exercises between sessions and follows up on progress.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: "🎯", title: "Goal-oriented", desc: "Every session starts with a clear objective." },
                { icon: "💬", title: "Responsive", desc: "Replies within 4 hours on weekdays." },
                { icon: "📋", title: "Structured", desc: "Provides session notes and resources afterward." },
                { icon: "🚀", title: "Hands-on", desc: "Real project work, not just theory." },
            ].map(s => (<div key={s.title} className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{s.title}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.desc}</div>
                  </div>
                </div>))}
            </div>
          </div>)}
      </div>
    </div>);
}
