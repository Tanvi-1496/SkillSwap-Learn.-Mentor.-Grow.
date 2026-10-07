
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function BookingFlow({ onNavigate, mentorId }) {
    const [mentor, setMentor] = useState(null);
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [requirements, setRequirements] = useState("");
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        if (!mentorId) return;

        fetch(`http://localhost:5000/mentors/${mentorId}`)
            .then((res) => res.json())
            .then((data) => {
                console.log("BOOKING MENTOR:", data);
                setMentor(data.mentor);
            })
            .catch((error) => {
                console.error("Booking mentor fetch error:", error);
            });
    }, [mentorId]);

    const availability = mentor?.availability || [];
    const availableDays = availability.filter(
        (item) => item.slots && item.slots.length > 0
    );

    const topics = mentor?.skills?.length
        ? [
              ...mentor.skills.map((skill) => `${skill} Guidance`),
              "Project Review & Feedback",
              "Interview Preparation",
              "Career Advice",
              "Other",
          ]
        : [
              "Introduction & Goal Setting",
              "Project Review & Feedback",
              "Interview Preparation",
              "Career Advice",
              "Other",
          ];

    const canNext = () => {
        if (step === 1) return !!selectedDate;
        if (step === 2) return !!selectedTime;
        if (step === 3) return !!selectedTopic;
        if (step === 4) return requirements.length > 10;
        return true;
    };

    const steps = [
        { num: 1, label: "Choose Date" },
        { num: 2, label: "Choose Time" },
        { num: 3, label: "Select Topic" },
        { num: 4, label: "Requirements" },
        { num: 5, label: "Confirm" },
    ];

    const handleNext = () => {
        if (step < steps.length) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

   const getNextDateForDay = (dayName) => {
    const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    const today = new Date();
    const targetDay = days.indexOf(dayName);
    const currentDay = today.getDay();

    let diff = targetDay - currentDay;

    if (diff <= 0) {
        diff += 7;
    }

    const result = new Date(today);
    result.setDate(today.getDate() + diff);

    return result.toISOString().split("T")[0];
};

const handleSubmit = async () => {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                alert("Please login again before booking.");
                return;
            }

            const studentId = user.id;

        
        const bookingDate = getNextDateForDay(selectedDate);

        const response = await fetch("http://localhost:5000/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                mentor_id: mentorId,
                student_id: studentId,
                topic: selectedTopic,
                date: bookingDate,
                time: selectedTime,
                status: "pending",
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Booking failed");
        }

        console.log("BOOKING CREATED:", data);

        setConfirmed(true);

    } catch (error) {
        console.error("Booking error:", error);
        alert(error.message || "Failed to create booking.");
    }
};

    if (confirmed) {
        return (
            <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">
                        🎉
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h1>
                    <p className="text-slate-500 mb-6">
                        Your session has been scheduled. {mentor?.name || "Your mentor"} will receive a notification shortly.
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 mb-6">
                        {[
                            { label: "Mentor", val: mentor?.name || "Mentor" },
                            { label: "Date", val: selectedDate },
                            { label: "Time", val: selectedTime },
                            { label: "Topic", val: selectedTopic },
                            { label: "Duration", val: "60 minutes" },
                            { label: "Mode", val: "Online (Zoom link will be shared)" },
                        ].map((r) => (
                            <div key={r.label} className="flex items-center justify-between">
                                <span className="text-slate-500 text-sm">{r.label}</span>
                                <span className="font-semibold text-slate-800 text-sm">{r.val}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                            onClick={() => onNavigate("bookings")}
                        >
                            View Booking
                        </button>
                        <button className="flex-1 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold py-3 rounded-xl transition-colors">
                            Add to Calendar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9ff] px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <p className="text-sm font-medium text-indigo-600 uppercase tracking-wide">Booking flow</p>
                            <h2 className="text-2xl font-bold text-slate-900">Book a session with {mentor?.name || "mentor"}</h2>
                        </div>
                        <button
                            onClick={() => onNavigate("mentors")}
                            className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center gap-3 overflow-x-auto pb-2">
                            {steps.map((item) => (
                                <div key={item.num} className="flex items-center min-w-0 flex-1">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                            step === item.num
                                                ? "bg-indigo-600 text-white"
                                                : step > item.num
                                                ? "bg-emerald-500 text-white"
                                                : "bg-slate-100 text-slate-500"
                                        }`}
                                    >
                                        {item.num}
                                    </div>
                                    <span
                                        className={`ml-2 text-sm whitespace-nowrap ${
                                            step >= item.num ? "text-slate-800 font-medium" : "text-slate-400"
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Choose a date</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {availableDays.length ? (
                                        availableDays.map((day) => (
                                            <button
                                                key={day.day}
                                                type="button"
                                                onClick={() => setSelectedDate(day.day)}
                                                className={`rounded-2xl border p-4 text-left transition ${
                                                    selectedDate === day.day
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                                                }`}
                                            >
                                                <div className="font-semibold">{day.day}</div>
                                                <div className="text-sm text-slate-500">{day.slots?.length || 0} slots available</div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-slate-500">No available dates yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Choose a time</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {availableDays
                                        .filter((day) => day.day === selectedDate)
                                        .flatMap((day) => day.slots || [])
                                        .map((slot) => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedTime(slot)}
                                                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                                                    selectedTime === slot
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                                                }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                </div>
                                {!availableDays.some((day) => day.day === selectedDate) && (
                                    <p className="text-sm text-slate-500 mt-3">Please select a date first.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select a topic</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {topics.map((topic) => (
                                        <button
                                            key={topic}
                                            type="button"
                                            onClick={() => setSelectedTopic(topic)}
                                            className={`rounded-2xl border p-4 text-left transition ${
                                                selectedTopic === topic
                                                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                            }`}
                                        >
                                            {topic}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Share requirements</h3>
                                <textarea
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                    rows={5}
                                    placeholder="Tell your mentor what you want help with, your goals, or anything they should know before the session..."
                                    className="w-full rounded-2xl border border-slate-200 p-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                                />
                                <p className="text-sm text-slate-500 mt-2">Minimum 10 characters.</p>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Review and confirm</h3>
                                <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Mentor</span>
                                        <span className="font-semibold text-slate-800">{mentor?.name || "Mentor"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Date</span>
                                        <span className="font-semibold text-slate-800">{selectedDate}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Time</span>
                                        <span className="font-semibold text-slate-800">{selectedTime}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Topic</span>
                                        <span className="font-semibold text-slate-800">{selectedTopic}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={step === 1}
                            className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Back
                        </button>

                        {step < steps.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canNext()}
                                className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium"
                            >
                                Confirm Booking
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
