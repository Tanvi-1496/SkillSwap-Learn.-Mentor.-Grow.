import { useState } from "react";
const bookings = {
    Upcoming: [
        { mentor: "Dr. Priya Sharma", avatar: "PS", bg: "bg-indigo-600", topic: "ML Model Evaluation", date: "Tomorrow, Aug 26", time: "5:00 PM – 6:00 PM", status: "Confirmed", statusColor: "bg-emerald-100 text-emerald-700" },
        { mentor: "Rahul Verma", avatar: "RV", bg: "bg-violet-600", topic: "Graph Algorithms", date: "Sat, Aug 30", time: "10:00 AM – 11:00 AM", status: "Confirmed", statusColor: "bg-emerald-100 text-emerald-700" },
    ],
    Pending: [
        { mentor: "Anjali Mehta", avatar: "AM", bg: "bg-pink-600", topic: "React Best Practices", date: "Sun, Aug 31", time: "3:00 PM – 4:00 PM", status: "Pending Acceptance", statusColor: "bg-amber-100 text-amber-700" },
    ],
    Completed: [
        { mentor: "Dr. Priya Sharma", avatar: "PS", bg: "bg-indigo-600", topic: "Python for Data Science", date: "Mon, Aug 18", time: "5:00 PM – 6:00 PM", status: "Completed", statusColor: "bg-slate-100 text-slate-600" },
        { mentor: "Karan Patel", avatar: "KP", bg: "bg-emerald-600", topic: "AWS S3 & Lambda", date: "Wed, Aug 13", time: "7:00 PM – 8:00 PM", status: "Completed", statusColor: "bg-slate-100 text-slate-600" },
        { mentor: "Rahul Verma", avatar: "RV", bg: "bg-violet-600", topic: "Binary Search Trees", date: "Sat, Aug 9", time: "10:00 AM – 11:00 AM", status: "Completed", statusColor: "bg-slate-100 text-slate-600" },
    ],
    Cancelled: [
        { mentor: "Anjali Mehta", avatar: "AM", bg: "bg-pink-600", topic: "UI/UX Principles", date: "Wed, Aug 6", time: "4:00 PM – 5:00 PM", status: "Cancelled", statusColor: "bg-red-100 text-red-600" },
    ],
};
export default function MyBookings({ onNavigate }) {
    const [tab, setTab] = useState("Upcoming");
    return (<div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => onNavigate("menteeDashboard")}>
          ← Dashboard
        </button>
        <div className="h-5 w-px bg-slate-200"/>
        <span className="font-bold text-slate-800">My Bookings</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm mb-6">
          {["Upcoming", "Pending", "Completed", "Cancelled"].map(t => (<button key={t} className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setTab(t)}>
              {t}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? "bg-white/20" : "bg-slate-100"}`}>
                {bookings[t].length}
              </span>
            </button>))}
        </div>

        {bookings[tab].length === 0 ? (<div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">No {tab} Bookings</h3>
            <p className="text-slate-400 text-sm mb-5">You don&apos;t have any {tab.toLowerCase()} bookings yet.</p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors" onClick={() => onNavigate("search")}>
              Find a Mentor
            </button>
          </div>) : (<div className="space-y-4">
            {bookings[tab].map((b, i) => (<div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${b.bg} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{b.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-bold text-slate-800">{b.mentor}</h3>
                        <p className="text-indigo-600 text-sm font-medium">📌 {b.topic}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${b.statusColor}`}>{b.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                      <span>📅 {b.date}</span>
                      <span>🕐 {b.time}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button className="text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
                    View Details
                  </button>
                  {tab === "Upcoming" && (<>
                      <button className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg transition-colors">
                        Join Session
                      </button>
                      <button className="text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg transition-colors">
                        Reschedule
                      </button>
                      <button className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </>)}
                  {tab === "Completed" && (<button className="text-xs font-semibold bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg transition-colors">
                      ★ Give Feedback
                    </button>)}
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
