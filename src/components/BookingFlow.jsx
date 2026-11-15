import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { API_URL } from "../lib/api";
import { getDateForWeekday, getWeekdayForDate, isSlotBookable } from "./bookingDateUtils";

function normalizeSlotTo24h(slotStr) {
    if (!slotStr) return "";
    let trimmed = String(slotStr).trim();
    if (trimmed.includes(" - ")) {
        trimmed = trimmed.split(" - ")[0].trim();
    } else if (trimmed.includes("-")) {
        trimmed = trimmed.split("-")[0].trim();
    }
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2];
        const s = match12[3] || "00";
        const modifier = match12[4].toUpperCase();
        if (modifier === "PM" && h < 12) h += 12;
        if (modifier === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${m}:${s}`;
    }
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
        const h = match24[1].padStart(2, "0");
        const m = match24[2];
        const s = match24[3] || "00";
        return `${h}:${m}:${s}`;
    }
    return trimmed;
}

export default function BookingFlow({ onNavigate, mentorId }) {
    const [mentor, setMentor] = useState(null);
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [requirements, setRequirements] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [bookingError, setBookingError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const intervalId = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (!mentorId) return;

        fetch(`${API_URL}/mentors/${mentorId}`)
            .then((res) => res.json())
            .then((data) => {
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
    const availableDates = availableDays
        .map((item) => ({ ...item, date: getDateForWeekday(item.day, now) }))
        .filter((item) => item.date);

    useEffect(() => {
        if (selectedDate && !availableDates.some((item) => item.date === selectedDate)) {
            setSelectedDate("");
            setSelectedTime("");
        }
    }, [selectedDate, now, mentor]);

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
        if (step === 2) {
            return !!selectedTime &&
                isSlotBookable(selectedDate, normalizeSlotTo24h(selectedTime), now);
        }
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

    // Whenever selectedDate changes, fetch already-booked slots for that mentor on that date
    useEffect(() => {
        if (!mentorId || !selectedDate) {
            setBookedSlots([]);
            return;
        }
        setBookedSlots([]);
        const controller = new AbortController();
        const params = new URLSearchParams({ mentor_id: mentorId, date: selectedDate });
        fetch(`${API_URL}/bookings/slots?${params}`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.bookedSlots) {
                    setBookedSlots(data.bookedSlots);
                } else {
                    setBookedSlots([]);
                }
            })
            .catch((error) => {
                if (error.name !== "AbortError") setBookedSlots([]);
            });
        return () => controller.abort();
    }, [mentorId, selectedDate]);

    const handleSelectDate = (date) => {
        setSelectedDate(date);
        setSelectedTime("");
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        try {
            setBookingError(null);
            setIsSubmitting(true);

            if (!mentorId) {
                setBookingError("No mentor selected. Please select a mentor before booking.");
                setIsSubmitting(false);
                return;
            }

            if (!isSlotBookable(selectedDate, normalizeSlotTo24h(selectedTime), new Date())) {
                setBookingError("This time slot has passed. Please choose another time.");
                setIsSubmitting(false);
                return;
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (sessionError || !token) {
                setBookingError("Please log in again before booking.");
                setIsSubmitting(false);
                return;
            }

            const response = await fetch(`${API_URL}/bookings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    mentor_id: mentorId,
                    topic: selectedTopic,
                    date: selectedDate,
                    time: selectedTime,
                }),
            });

            const data = await response.json();

            if (response.status === 409) {
                setBookingError(data.error || "This time slot is no longer available. Please choose another time.");
                setIsSubmitting(false);
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || "Booking failed");
            }

            setConfirmed(true);

        } catch (error) {
            console.error("Booking error:", error);
            setBookingError(error.message || "Failed to create booking.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (confirmed) {
        return (
            <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xs border border-[#E5E7EB] max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-[#EEF0FF] text-[#4F46E5] rounded-full flex items-center justify-center text-3xl mx-auto mb-5">
                        🎉
                    </div>
                    <h1 className="text-2xl font-bold text-[#172033] mb-2">Booking Confirmed!</h1>
                    <p className="text-[#718096] mb-6 text-sm">
                        Your session has been scheduled. {mentor?.name || "Your mentor"} will receive a notification shortly.
                    </p>
                    <div className="bg-[#F5F7FC] rounded-2xl p-5 text-left space-y-3 mb-6 border border-[#E5E7EB]">
                        {[
                            { label: "Mentor", val: mentor?.name || "Mentor" },
                            { label: "Date", val: `${getWeekdayForDate(selectedDate)} (${selectedDate})` },
                            { label: "Time", val: selectedTime },
                            { label: "Topic", val: selectedTopic },
                            { label: "Duration", val: "60 minutes" },
                            { label: "Mode", val: "Online (Link will be shared)" },
                        ].map((r) => (
                            <div key={r.label} className="flex items-center justify-between">
                                <span className="text-[#718096] text-sm">{r.label}</span>
                                <span className="font-semibold text-[#172033] text-sm">{r.val}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button
                            className="flex-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-colors shadow-xs text-sm cursor-pointer"
                            onClick={() => onNavigate("bookings")}
                        >
                            View My Bookings
                        </button>
                        <button
                            className="flex-1 border border-[#E5E7EB] bg-white hover:bg-[#F5F7FC] text-[#172033] font-semibold py-3 rounded-xl transition-colors text-sm cursor-pointer"
                            onClick={() => onNavigate("menteeDashboard")}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F7FC] px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xs border border-[#E5E7EB] p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#E5E7EB]">
                        <div>
                            <p className="text-xs font-semibold text-[#4F46E5] uppercase tracking-wider">Mentorship Booking</p>
                            <h2 className="text-2xl font-bold text-[#172033]">Book session with {mentor?.name || "Mentor"}</h2>
                        </div>
                        <button
                            onClick={() => onNavigate("search")}
                            className="text-[#718096] hover:text-[#172033] text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#F5F7FC] transition-colors border border-transparent hover:border-[#E5E7EB] cursor-pointer"
                        >
                            ✕ Cancel
                        </button>
                    </div>

                    {bookingError && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{bookingError}</span>
                            </div>
                            <button onClick={() => setBookingError(null)} className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer">
                                Dismiss
                            </button>
                        </div>
                    )}

                    <div className="mb-8">
                        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2 scrollbar-none">
                            {steps.map((item, idx) => (
                                <div key={item.num} className="flex items-center flex-1 last:flex-initial">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 transition-colors ${
                                                step === item.num
                                                    ? "bg-[#4F46E5] text-white shadow-xs ring-4 ring-[#EEF0FF]"
                                                    : step > item.num
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-[#F5F7FC] text-[#718096] border border-[#E5E7EB]"
                                            }`}
                                        >
                                            {step > item.num ? "✓" : item.num}
                                        </div>
                                        <span
                                            className={`text-xs whitespace-nowrap hidden sm:inline ${
                                                step >= item.num ? "text-[#172033] font-semibold" : "text-[#718096] font-medium"
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-2 min-w-4 ${step > item.num ? "bg-emerald-400" : "bg-[#E5E7EB]"}`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-[#172033] mb-4">Choose a date</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {availableDays.length ? (
                                        availableDates.map((day) => (
                                            <button
                                                key={day.date}
                                                type="button"
                                                onClick={() => handleSelectDate(day.date)}
                                                className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
                                                    selectedDate === day.date
                                                        ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5] shadow-xs"
                                                        : "border-[#E5E7EB] bg-white hover:border-slate-300 text-[#172033]"
                                                }`}
                                            >
                                                <div className="font-semibold">{day.day}</div>
                                                <div className="text-xs text-[#718096] mt-0.5">{day.date}</div>
                                                <div className="text-sm text-[#718096] mt-1">{day.slots?.length || 0} slots available</div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-[#718096]">No available dates yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-[#172033] mb-4">Choose a time</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {availableDates
                                        .filter((day) => day.date === selectedDate)
                                        .flatMap((day) => day.slots || [])
                                        .filter((slot) => isSlotBookable(
                                            selectedDate,
                                            normalizeSlotTo24h(slot),
                                            now
                                        ))
                                        .map((slot) => {
                                            const isBooked = bookedSlots.includes(normalizeSlotTo24h(slot));
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    disabled={isBooked}
                                                    onClick={() => setSelectedTime(slot)}
                                                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                                                        isBooked
                                                            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 line-through"
                                                            : selectedTime === slot
                                                            ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5] font-semibold cursor-pointer"
                                                            : "border-[#E5E7EB] bg-white hover:border-slate-300 text-[#172033] cursor-pointer"
                                                    }`}
                                                >
                                                    {slot} {isBooked && "(Booked)"}
                                                </button>
                                            );
                                        })}
                                </div>
                                {!availableDates.some((day) => day.date === selectedDate) && (
                                    <p className="text-sm text-[#718096] mt-3">Please select a date first.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-[#172033] mb-4">Select a topic</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {topics.map((topic) => (
                                        <button
                                            key={topic}
                                            type="button"
                                            onClick={() => setSelectedTopic(topic)}
                                            className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
                                                selectedTopic === topic
                                                    ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5] shadow-xs"
                                                    : "border-[#E5E7EB] bg-white hover:border-slate-300 text-[#172033]"
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
                                <h3 className="text-lg font-semibold text-[#172033] mb-4">Share requirements</h3>
                                <textarea
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                    rows={5}
                                    placeholder="Tell your mentor what you want help with, your goals, or anything they should know before the session..."
                                    className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F5F7FC] p-4 text-[#172033] placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#EEF0FF] focus:border-[#4F46E5] focus:bg-white transition"
                                />
                                <p className="text-sm text-[#718096] mt-2">Minimum 10 characters.</p>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-[#172033] mb-4">Review and confirm</h3>
                                <div className="bg-[#F5F7FC] rounded-2xl p-5 space-y-3 border border-[#E5E7EB]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#718096]">Mentor</span>
                                        <span className="font-semibold text-[#172033]">{mentor?.name || "Mentor"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#718096]">Date</span>
                                        <span className="font-semibold text-[#172033]">{getWeekdayForDate(selectedDate)} ({selectedDate})</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#718096]">Time</span>
                                        <span className="font-semibold text-[#172033]">{selectedTime}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#718096]">Topic</span>
                                        <span className="font-semibold text-[#172033]">{selectedTopic}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={step === 1 || isSubmitting}
                            className="px-5 py-3 rounded-xl border border-[#E5E7EB] bg-white text-[#172033] font-medium hover:bg-[#F5F7FC] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                            Back
                        </button>

                        {step < steps.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canNext()}
                                className="px-5 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                                className="px-5 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs cursor-pointer flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Confirming...</span>
                                    </>
                                ) : (
                                    "Confirm Booking"
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
