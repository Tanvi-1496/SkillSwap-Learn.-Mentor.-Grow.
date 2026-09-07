import { useState } from "react";
const dates = [
    { day: "Mon", date: "Aug 25", slots: 3 },
    { day: "Tue", date: "Aug 26", slots: 0 },
    { day: "Wed", date: "Aug 27", slots: 2 },
    { day: "Thu", date: "Aug 28", slots: 0 },
    { day: "Fri", date: "Aug 29", slots: 2 },
    { day: "Sat", date: "Aug 30", slots: 5 },
    { day: "Sun", date: "Aug 31", slots: 0 },
];
const timeSlots = {
    "Aug 25": ["5:00 PM", "6:00 PM", "7:00 PM"],
    "Aug 27": ["4:00 PM", "5:00 PM"],
    "Aug 29": ["5:00 PM", "6:00 PM"],
    "Aug 30": ["10:00 AM", "11:00 AM", "12:00 PM", "5:00 PM", "6:00 PM"],
};
const topics = [
    "Introduction & Goal Setting",
    "Python for Data Science",
    "Machine Learning Fundamentals",
    "Project Review & Feedback",
    "Interview Preparation",
    "Research Guidance",
    "Career Advice",
    "Other",
];
export default function BookingFlow({ onNavigate }) {
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [requirements, setRequirements] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const canNext = () => {
        if (step === 1)
            return !!selectedDate;
        if (step === 2)
            return !!selectedTime;
        if (step === 3)
            return !!selectedTopic;
        if (step === 4)
            return requirements.length > 10;
        return true;
    };
    const steps = [
        { num: 1, label: "Choose Date" },
        { num: 2, label: "Choose Time" },
        { num: 3, label: "Select Topic" },
        { num: 4, label: "Requirements" },
        { num: 5, label: "Confirm" },
    ];
    if (confirmed) {
        return (<div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">🎉</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h1>
          <p className="text-slate-500 mb-6">Your session has been scheduled. Dr. Priya will receive a notification shortly.</p>
          <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 mb-6">
            {[
                { label: "Mentor", val: "Dr. Priya Sharma" },
                { label: "Date", val: selectedDate },
                { label: "Time", val: selectedTime },
                { label: "Topic", val: selectedTopic },
                { label: "Duration", val: "60 minutes" },
                { label: "Mode", val: "Online (Zoom link will be shared)" },
            ].map(r => (<div key={r.label} className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">{r.label}</span>
                <span className="font-semibold text-slate-800 text-sm">{r.val}</span>
              </div>))}
          </div>
          <div className="flex gap-3">
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors" onClick={() => onNavigate("bookings")}>
              View Booking
            </button>
            <button className="flex-1 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold py-3 rounded-xl transition-colors">
              Add to Calendar
            </button>
          </div>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-40 shadow-sm">
        <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => onNavigate("mentorProfile")}>
          ← Mentor Profile
        </button>
        <div className="h-5 w-px bg-slate-200"/>
        <span className="font-semibold text-slate-800">Book a Session with Dr. Priya Sharma</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (<div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-indigo-600 text-white shadow-md" : "bg-slate-200 text-slate-500"}`}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={`text-xs mt-1 font-medium hidden sm:block ${step === s.num ? "text-indigo-600" : "text-slate-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (<div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${step > s.num ? "bg-emerald-400" : "bg-slate-200"}`}/>)}
            </div>))}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          {step === 1 && (<>
              <h2 className="text-lg font-bold text-slate-800 mb-5">📅 Choose a Date</h2>
              <div className="grid grid-cols-7 gap-2">
                {dates.map(d => (<button key={d.date} disabled={d.slots === 0} className={`p-3 rounded-xl text-center transition-all ${d.slots === 0 ? "opacity-40 cursor-not-allowed bg-slate-50" : selectedDate === d.date ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200"}`} onClick={() => { setSelectedDate(d.date); setSelectedTime(""); }}>
                    <div className={`text-xs font-semibold mb-1 ${selectedDate === d.date ? "text-indigo-200" : "text-slate-500"}`}>{d.day}</div>
                    <div className={`text-sm font-bold ${selectedDate === d.date ? "text-white" : "text-slate-700"}`}>{d.date.split(" ")[1]}</div>
                    {d.slots > 0 && (<div className={`text-xs mt-1 ${selectedDate === d.date ? "text-indigo-200" : "text-indigo-600"}`}>{d.slots} slots</div>)}
                  </button>))}
              </div>
            </>)}

          {step === 2 && (<>
              <h2 className="text-lg font-bold text-slate-800 mb-2">🕐 Choose a Time Slot</h2>
              <p className="text-slate-500 text-sm mb-5">{selectedDate} — Available times</p>
              <div className="grid grid-cols-3 gap-3">
                {(timeSlots[selectedDate] || []).map(slot => (<button key={slot} className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${selectedTime === slot ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"}`} onClick={() => setSelectedTime(slot)}>
                    {slot}
                  </button>))}
              </div>
            </>)}

          {step === 3 && (<>
              <h2 className="text-lg font-bold text-slate-800 mb-5">📌 Select Session Topic</h2>
              <div className="space-y-2">
                {topics.map(t => (<button key={t} className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${selectedTopic === t ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"}`} onClick={() => setSelectedTopic(t)}>
                    {selectedTopic === t ? "✓ " : ""}{t}
                  </button>))}
              </div>
            </>)}

          {step === 4 && (<>
              <h2 className="text-lg font-bold text-slate-800 mb-2">✍️ Your Requirements</h2>
              <p className="text-slate-500 text-sm mb-4">Help your mentor prepare by describing what you need help with.</p>
              <textarea value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="e.g., I'm a 3rd year CSE student working on a machine learning project for detecting plant diseases. I need help with choosing the right model architecture and evaluating its performance..." rows={6} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"/>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{requirements.length > 10 ? "✓ Looks good" : "Minimum 10 characters"}</span>
                <span>{requirements.length} chars</span>
              </div>
            </>)}

          {step === 5 && (<>
              <h2 className="text-lg font-bold text-slate-800 mb-5">✅ Confirm Booking</h2>
              <div className="space-y-3 mb-6">
                {[
                { label: "Mentor", val: "Dr. Priya Sharma", sub: "Faculty Mentor · IIT Bombay" },
                { label: "Date", val: selectedDate },
                { label: "Time", val: `${selectedTime} (60 min)` },
                { label: "Topic", val: selectedTopic },
                { label: "Mode", val: "Online (Video Call)" },
            ].map(r => (<div key={r.label} className="flex items-start justify-between py-3 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-sm">{r.label}</span>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800 text-sm">{r.val}</div>
                      {r.sub && <div className="text-xs text-slate-400">{r.sub}</div>}
                    </div>
                  </div>))}
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-5 text-sm text-indigo-700">
                <strong>Note:</strong> You can cancel or reschedule up to 24 hours before the session.
              </div>
            </>)}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (<button className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors" onClick={() => setStep(s => s - 1)}>
                ← Back
              </button>)}
            {step < 5 ? (<button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>
                Continue →
              </button>) : (<button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm" onClick={() => setConfirmed(true)}>
                Confirm Booking 🎉
              </button>)}
          </div>
        </div>
      </div>
    </div>);
}
