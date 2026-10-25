import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "profile", label: "My Profile", icon: "👤" },
    { id: "skills", label: "My Skills", icon: "🎯" },
    { id: "availability", label: "Availability", icon: "🗓" },
    { id: "requests", label: "Booking Requests", icon: "📥" },
    { id: "upcoming", label: "Upcoming Sessions", icon: "📅" },
    { id: "completed", label: "Completed Sessions", icon: "✅" },
    { id: "reviews", label: "Reviews", icon: "⭐" },
    { id: "settings", label: "Settings", icon: "⚙️" },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MAP = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday"
};
const FULL_TO_SHORT = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun"
};

const defaultAvail = {
    Mon: { active: true, slots: ["5:00 PM", "6:00 PM", "7:00 PM"] },
    Tue: { active: false, slots: [] },
    Wed: { active: true, slots: ["4:00 PM", "5:00 PM"] },
    Thu: { active: false, slots: [] },
    Fri: { active: true, slots: ["5:00 PM", "6:00 PM"] },
    Sat: { active: true, slots: ["10:00 AM", "11:00 AM", "5:00 PM", "6:00 PM"] },
    Sun: { active: false, slots: [] },
};

function formatTimeDisplay(timeStr) {
    if (!timeStr) return "";
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${m} ${ampm}`;
    }
    return timeStr;
}

function getInitials(name) {
    if (!name || typeof name !== "string") return "M";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "M";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeTo12h(time24) {
    if (!time24) return "";
    const [hStr, mStr] = String(time24).split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
}

function parse12hTo24h(time12) {
    if (!time12) return "09:00";
    const match = String(time12).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) {
        const match24 = String(time12).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (match24) return `${match24[1].padStart(2, "0")}:${match24[2]}`;
        return "09:00";
    }
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = (match[3] || "").toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
}

function parseSlotTo24h(slotStr) {
    if (!slotStr) return { start: "09:00", end: "10:00" };
    const parts = String(slotStr).split("-").map((s) => s.trim());
    const start24 = parse12hTo24h(parts[0]);
    let end24 = parts[1] ? parse12hTo24h(parts[1]) : "";
    if (!end24) {
        const [h, m] = start24.split(":").map(Number);
        const endH = (h + 1) % 24;
        end24 = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return { start: start24, end: end24 };
}

function toMinutes(time24) {
    const [h, m] = String(time24).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

function validateSlot(newStart24, newEnd24, existingSlots, excludeIndex = -1) {
    if (!newStart24 || !newEnd24) return "Both start and end time are required.";
    const startM = toMinutes(newStart24);
    const endM = toMinutes(newEnd24);
    if (endM <= startM) return "End time must be later than start time.";

    const formatted = `${timeTo12h(newStart24)} - ${timeTo12h(newEnd24)}`;

    for (let i = 0; i < existingSlots.length; i++) {
        if (i === excludeIndex) continue;
        const exist = existingSlots[i];
        const { start: eStart24, end: eEnd24 } = parseSlotTo24h(exist);
        const eStartM = toMinutes(eStart24);
        const eEndM = toMinutes(eEnd24);

        if (startM === eStartM && endM === eEndM) {
            return `This time slot (${formatted}) already exists for this day.`;
        }
        if (startM < eEndM && endM > eStartM) {
            return `Slot (${formatted}) overlaps with existing slot (${exist}).`;
        }
    }
    return null;
}

export default function MentorDashboard({ onNavigate, initialTab }) {
    const [activeNav, setActiveNav] = useState(initialTab || "dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [avail, setAvail] = useState(defaultAvail);
    const [bookingsList, setBookingsList] = useState([]);
    const [actionId, setActionId] = useState(null);

    // Time slot editor state
    const [addingSlotDay, setAddingSlotDay] = useState(null);
    const [newSlotStart, setNewSlotStart] = useState("09:00");
    const [newSlotEnd, setNewSlotEnd] = useState("10:00");
    const [editingSlot, setEditingSlot] = useState(null); // { day, idx }
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [slotError, setSlotError] = useState(null);

    useEffect(() => {
        if (initialTab && initialTab !== activeNav) {
            setActiveNav(initialTab);
        }
    }, [initialTab]);

    // Mentor profile & skills state
    const [mentorProfile, setMentorProfile] = useState(null);
    const [skillsList, setSkillsList] = useState([]);
    const [newSkillInput, setNewSkillInput] = useState("");
    const [savingSkills, setSavingSkills] = useState(false);
    const [skillsFeedback, setSkillsFeedback] = useState(null);

    // Availability persistence state
    const [savingAvail, setSavingAvail] = useState(false);
    const [availFeedback, setAvailFeedback] = useState(null);
    const [bookingFeedback, setBookingFeedback] = useState(null);
    const [mentorReviews, setMentorReviews] = useState([]);

    const loadMentorData = async () => {
        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) return;

            const response = await fetch("http://localhost:5000/mentors/me", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const contentType = response.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            const data = isJson ? await response.json() : null;

            if (response.ok && data?.profile) {
                setMentorProfile(data.profile);
                if (Array.isArray(data.profile.skills)) {
                    setSkillsList(data.profile.skills);
                }

                // Sync availability from verified database records
                if (Array.isArray(data.availability)) {
                    setAvail((prev) => {
                        const updated = { ...prev };
                        days.forEach((d) => {
                            const fullDay = DAY_MAP[d];
                            const row = data.availability.find((a) => a.day === fullDay);
                            if (row && Array.isArray(row.slots) && row.slots.length > 0) {
                                updated[d] = { active: true, slots: row.slots };
                            } else {
                                updated[d] = { active: false, slots: [] };
                            }
                        });
                        return updated;
                    });
                }
            }

            // Also load reviews for this mentor
            if (session?.user?.id) {
                try {
                    const revRes = await fetch(`http://localhost:5000/mentors/${session.user.id}`);
                    if (revRes.ok) {
                        const revData = await revRes.json();
                        if (Array.isArray(revData.mentor?.reviews)) {
                            setMentorReviews(revData.mentor.reviews);
                        }
                    }
                } catch (revErr) {
                    console.warn("Could not load mentor reviews:", revErr);
                }
            }
        } catch (err) {
            console.error("Failed to load mentor data:", err);
        }
    };

    const loadBookings = async () => {
        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) return;

            const response = await fetch("http://localhost:5000/bookings", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const contentType = response.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            const data = isJson ? await response.json() : null;

            if (data?.bookings) {
                setBookingsList(data.bookings);
            }
        } catch (err) {
            console.error("Failed to load mentor bookings:", err);
        }
    };

    useEffect(() => {
        loadBookings();
        loadMentorData();
    }, []);

    // -----------------------------------------------------------------------
    // Skills Handlers
    // -----------------------------------------------------------------------
    const persistSkills = async (updatedSkills) => {
        try {
            setSavingSkills(true);
            setSkillsFeedback(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                alert("Please log in again.");
                return;
            }

            const response = await fetch("http://localhost:5000/mentors/me/skills", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ skills: updatedSkills })
            });

            const contentType = response.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            const data = isJson ? await response.json() : null;

            if (!response.ok) {
                const errorMsg = data?.error || (!isJson ? await response.text() : "Failed to update skills");
                throw new Error(errorMsg || "Failed to update skills");
            }

            if (Array.isArray(data?.skills)) {
                setSkillsList(data.skills);
            }
            setSkillsFeedback({ type: "success", msg: "Skills saved successfully! 🎉" });
            setTimeout(() => setSkillsFeedback(null), 3000);

        } catch (err) {
            console.error("Save skills error:", err);
            setSkillsFeedback({ type: "error", msg: err.message || "Failed to save skills." });
        } finally {
            setSavingSkills(false);
        }
    };

    const handleAddSkill = async (e) => {
        if (e) e.preventDefault();
        const trimmed = newSkillInput.trim();
        if (!trimmed) return;

        // Check for duplicates (case-insensitive)
        if (skillsList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
            setSkillsFeedback({ type: "error", msg: `"${trimmed}" is already in your skills.` });
            setTimeout(() => setSkillsFeedback(null), 3000);
            return;
        }

        const updated = [...skillsList, trimmed];
        setSkillsList(updated);
        setNewSkillInput("");
        await persistSkills(updated);
    };

    const handleRemoveSkill = async (skillToRemove) => {
        const updated = skillsList.filter((s) => s !== skillToRemove);
        setSkillsList(updated);
        await persistSkills(updated);
    };

    // -----------------------------------------------------------------------
    // Availability & Slot Handlers
    // -----------------------------------------------------------------------
    const handleTabClick = (tabId) => {
        if (tabId === "settings") {
            onNavigate("settings");
        } else {
            setActiveNav(tabId);
            setSidebarOpen(false);
            if (onNavigate) {
                onNavigate("mentorDashboard", { tab: tabId });
            }
        }
    };

    const toggleDay = (day) => {
        setAvail((prev) => {
            const current = prev[day];
            const nextActive = !current.active;
            return {
                ...prev,
                [day]: {
                    active: nextActive,
                    slots: nextActive && (!current.slots || current.slots.length === 0)
                        ? ["5:00 PM - 6:00 PM", "6:00 PM - 7:00 PM"]
                        : current.slots
                }
            };
        });
        if (addingSlotDay === day) setAddingSlotDay(null);
        if (editingSlot?.day === day) setEditingSlot(null);
        setSlotError(null);
    };

    const handleStartAddSlot = (day) => {
        setAddingSlotDay(day);
        setEditingSlot(null);
        setNewSlotStart("09:00");
        setNewSlotEnd("10:00");
        setSlotError(null);
    };

    const handleCancelAddSlot = () => {
        setAddingSlotDay(null);
        setSlotError(null);
    };

    const handleConfirmAddSlot = (day) => {
        const error = validateSlot(newSlotStart, newSlotEnd, avail[day].slots || []);
        if (error) {
            setSlotError({ day, msg: error });
            return;
        }

        const formatted = `${timeTo12h(newSlotStart)} - ${timeTo12h(newSlotEnd)}`;
        setAvail((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                slots: [...(prev[day].slots || []), formatted]
            }
        }));
        setAddingSlotDay(null);
        setSlotError(null);
    };

    const handleStartEditSlot = (day, idx, currentSlot) => {
        const { start, end } = parseSlotTo24h(currentSlot);
        setEditingSlot({ day, idx });
        setEditStart(start);
        setEditEnd(end);
        setAddingSlotDay(null);
        setSlotError(null);
    };

    const handleCancelEditSlot = () => {
        setEditingSlot(null);
        setSlotError(null);
    };

    const handleConfirmEditSlot = (day, idx) => {
        const error = validateSlot(editStart, editEnd, avail[day].slots || [], idx);
        if (error) {
            setSlotError({ editDay: day, editIdx: idx, msg: error });
            return;
        }

        const formatted = `${timeTo12h(editStart)} - ${timeTo12h(editEnd)}`;
        setAvail((prev) => {
            const nextSlots = [...(prev[day].slots || [])];
            nextSlots[idx] = formatted;
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    slots: nextSlots
                }
            };
        });
        setEditingSlot(null);
        setSlotError(null);
    };

    const handleDeleteSlot = (day, idx) => {
        if (editingSlot?.day === day && editingSlot?.idx === idx) {
            setEditingSlot(null);
        }
        setAvail((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                slots: (prev[day].slots || []).filter((_, i) => i !== idx)
            }
        }));
    };

    const handleSaveAvailability = async () => {
        try {
            setSavingAvail(true);
            setAvailFeedback(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                setAvailFeedback({ type: "error", msg: "Please log in again." });
                return;
            }

            // Map short day names to full weekday names for verified constraint
            const schedule = days.map((d) => ({
                day: DAY_MAP[d],
                slots: avail[d].active ? (avail[d].slots || []) : []
            }));

            const response = await fetch("http://localhost:5000/mentors/me/availability", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ schedule })
            });

            const contentType = response.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            const data = isJson ? await response.json() : null;

            if (!response.ok) {
                const errorMsg = data?.error || (!isJson ? await response.text() : "Failed to save availability");
                throw new Error(errorMsg || "Failed to save availability");
            }

            setAvailFeedback({ type: "success", msg: "Availability saved successfully! 🎉" });
            setTimeout(() => setAvailFeedback(null), 4000);

        } catch (err) {
            console.error("Save availability error:", err);
            setAvailFeedback({ type: "error", msg: err.message || "Failed to save availability." });
        } finally {
            setSavingAvail(false);
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error.message);
        }
        onNavigate("landing");
    };

    const handleBookingStatus = async (bookingId, newStatus) => {
        try {
            setActionId(bookingId);
            setBookingFeedback(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                setBookingFeedback({ type: "error", msg: "Please log in again." });
                return;
            }

            const response = await fetch(`http://localhost:5000/bookings/${bookingId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: newStatus
                })
            });

            const contentType = response.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            const data = isJson ? await response.json() : null;

            if (!response.ok) {
                const errorMsg = data?.error || (!isJson ? await response.text() : "Failed to update booking status");
                throw new Error(errorMsg || "Failed to update booking status");
            }

            setBookingFeedback({
                type: "success",
                msg: newStatus === "confirmed" ? "Booking accepted successfully! 🎉" : "Booking declined."
            });
            setTimeout(() => setBookingFeedback(null), 4000);

            await loadBookings();
        } catch (err) {
            console.error("Booking update error:", err);
            setBookingFeedback({ type: "error", msg: err.message || "Failed to update booking status." });
        } finally {
            setActionId(null);
        }
    };



    const pendingRequests = bookingsList.filter((b) => b.status === "pending");
    const upcomingList = bookingsList.filter((b) => b.status === "confirmed");
    const completedList = bookingsList.filter((b) => b.status === "completed");

    const stats = [
        { label: "Total Students", value: `${new Set(bookingsList.map((b) => b.student_id)).size || 0}`, icon: "🎓", color: "bg-[#EEF0FF] text-[#4F46E5]", border: "border-[#E5E7EB]" },
        { label: "Upcoming Sessions", value: `${upcomingList.length}`, icon: "📅", color: "bg-violet-50 text-violet-600", border: "border-[#E5E7EB]" },
        { label: "Completed Sessions", value: `${completedList.length}`, icon: "✅", color: "bg-emerald-50 text-emerald-600", border: "border-[#E5E7EB]" },
        { label: "Pending Requests", value: `${pendingRequests.length}`, icon: "⏳", color: "bg-amber-50 text-amber-600", border: "border-[#E5E7EB]" },
    ];

    return (
        <div className="flex h-screen bg-[#F5F7FC] overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-[#E5E7EB] flex flex-col shadow-xl lg:shadow-none transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
                <div className="p-5 border-b border-[#E5E7EB]">
                    <button className="flex items-center gap-2" onClick={() => onNavigate("landing")}>
                        <div className="w-8 h-8 bg-[#4F46E5] rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <span className="text-lg font-bold text-[#172033]">SkillSwap</span>
                    </button>
                    <div className="mt-3 text-xs font-semibold text-[#4F46E5] bg-[#EEF0FF] rounded-lg px-2.5 py-1 inline-block">Mentor View</div>
                </div>
                <nav className="flex-1 p-3 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${activeNav === item.id ? "bg-[#4F46E5] text-white shadow-xs" : "text-[#718096] hover:bg-[#F5F7FC] hover:text-[#172033]"}`}
                            onClick={() => handleTabClick(item.id)}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                            {item.id === "requests" && pendingRequests.length > 0 && (
                                <span className="ml-auto bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-[#E5E7EB]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {getInitials(mentorProfile?.name || "Mentor")}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[#172033] truncate">
                                {mentorProfile?.name || "Mentor"}
                            </div>
                            <div className="text-xs text-emerald-600 font-medium">✓ Active Mentor</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="w-full text-xs font-semibold text-[#718096] hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors text-left"
                        onClick={handleLogout}
                    >
                        ← Log out
                    </button>
                </div>
            </aside>

            {sidebarOpen && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden p-2 hover:bg-[#F5F7FC] rounded-lg" onClick={() => setSidebarOpen(true)}>
                            <div className="space-y-1"><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/><div className="w-5 h-0.5 bg-slate-600"/></div>
                        </button>
                        <h1 className="font-bold text-[#172033]">
                            {activeNav === "dashboard" && "Dashboard"}
                            {activeNav === "requests" && "Booking Requests"}
                            {activeNav === "upcoming" && "Upcoming Sessions"}
                            {activeNav === "completed" && "Completed Sessions"}
                            {activeNav === "availability" && "Manage Availability"}
                            {activeNav === "profile" && "My Profile"}
                            {activeNav === "skills" && "My Skills"}
                            {activeNav !== "dashboard" && activeNav !== "requests" && activeNav !== "upcoming" && activeNav !== "completed" && activeNav !== "availability" && activeNav !== "profile" && activeNav !== "skills" && navItems.find((n) => n.id === activeNav)?.label}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="relative p-2 hover:bg-[#F5F7FC] rounded-xl border border-transparent hover:border-[#E5E7EB] transition-colors">
                            <span className="text-lg">🔔</span>
                            {pendingRequests.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
                            )}
                        </button>
                        <button className="text-sm font-semibold text-[#172033] hover:text-[#4F46E5] border border-[#E5E7EB] bg-white hover:bg-[#F5F7FC] px-3.5 py-1.5 rounded-xl transition-colors shadow-xs" onClick={() => onNavigate("landing")}>
                            ← Switch to Mentee
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {bookingFeedback && (
                        <div
                            className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between transition-all ${
                                bookingFeedback.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span>{bookingFeedback.type === "success" ? "✓" : "⚠️"}</span>
                                <span>{bookingFeedback.msg}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBookingFeedback(null)}
                                className="text-xs font-bold hover:opacity-75 cursor-pointer ml-3"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {activeNav === "dashboard" && (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-[#172033]">
                                    Welcome back, {mentorProfile?.name || "Mentor"} 👋
                                </h2>
                                <p className="text-[#718096] mt-1">
                                    You have {pendingRequests.length} pending request{pendingRequests.length === 1 ? "" : "s"} and {upcomingList.length} upcoming session{upcomingList.length === 1 ? "" : "s"}.
                                </p>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                {stats.map((s) => (
                                    <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs">
                                        <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
                                        <div className="text-2xl font-bold text-[#172033]">{s.value}</div>
                                        <div className="text-[#718096] text-xs mt-0.5">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid lg:grid-cols-2 gap-6">
                                {/* Booking Requests */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-[#172033]">📥 Booking Requests</h3>
                                        <button className="text-[#4F46E5] text-sm font-semibold hover:text-[#4338CA]" onClick={() => handleTabClick("requests")}>
                                            View All ({pendingRequests.length})
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {pendingRequests.length === 0 ? (
                                            <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs text-center text-[#718096] text-sm">
                                                No pending booking requests right now.
                                            </div>
                                        ) : (
                                            pendingRequests.slice(0, 3).map((req) => (
                                                <div key={req.id} className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs hover:border-[#4F46E5]/40 transition-all">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-9 h-9 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                            {(req.student_name || "S").slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-[#172033] text-sm">{req.student_name || "Student"}</div>
                                                            <div className="text-xs text-[#718096]">{req.date} · {formatTimeDisplay(req.time)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#EEF0FF] rounded-xl px-3 py-1.5 text-xs text-[#4F46E5] font-medium mb-3">
                                                        📌 {req.topic}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            disabled={actionId === req.id}
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
                                                            onClick={() => handleBookingStatus(req.id, "confirmed")}
                                                        >
                                                            {actionId === req.id ? "Updating..." : "✓ Accept"}
                                                        </button>
                                                        <button
                                                            disabled={actionId === req.id}
                                                            className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 font-semibold py-2 rounded-xl text-xs transition-colors disabled:opacity-50"
                                                            onClick={() => handleBookingStatus(req.id, "declined")}
                                                        >
                                                            ✕ Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Upcoming Sessions */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-[#172033]">📅 Upcoming Sessions</h3>
                                        <button className="text-[#4F46E5] text-sm font-semibold hover:text-[#4338CA]" onClick={() => handleTabClick("upcoming")}>
                                            View All ({upcomingList.length})
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {upcomingList.length === 0 ? (
                                            <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs text-center text-[#718096] text-sm">
                                                No upcoming sessions scheduled yet.
                                            </div>
                                        ) : (
                                            upcomingList.slice(0, 3).map((s) => (
                                                <div key={s.id} className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs hover:border-[#4F46E5]/40 transition-all">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-9 h-9 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                            {(s.student_name || "S").slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-[#172033] text-sm">{s.student_name || "Student"}</div>
                                                            <div className="text-xs text-[#718096]">{s.date} · {formatTimeDisplay(s.time)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#EEF0FF] rounded-xl px-3 py-1.5 text-xs text-[#4F46E5] font-medium mb-3">
                                                        📌 {s.topic}
                                                    </div>
                                                    <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-2 rounded-xl text-center">
                                                        Confirmed Session
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeNav === "requests" && (
                        <div className="space-y-4">
                            {pendingRequests.length === 0 ? (
                                <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
                                    <div className="text-5xl mb-4">📥</div>
                                    <h3 className="font-bold text-slate-700 text-lg mb-2">No Booking Requests</h3>
                                    <p className="text-slate-400 text-sm">You do not have any pending booking requests.</p>
                                </div>
                            ) : (
                                pendingRequests.map((req) => (
                                    <div key={req.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                                                {(req.student_name || "S").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between flex-wrap gap-2">
                                                    <div>
                                                        <h3 className="font-bold text-slate-800">{req.student_name || "Student"}</h3>
                                                        <p className="text-slate-500 text-sm">{req.date} · {formatTimeDisplay(req.time)}</p>
                                                    </div>
                                                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Pending</span>
                                                </div>
                                                <div className="bg-indigo-50 rounded-xl px-3 py-2 text-sm text-indigo-700 font-medium mt-3 mb-3">
                                                    📌 {req.topic}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                disabled={actionId === req.id}
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                                                onClick={() => handleBookingStatus(req.id, "confirmed")}
                                            >
                                                {actionId === req.id ? "Updating..." : "✓ Accept Request"}
                                            </button>
                                            <button
                                                disabled={actionId === req.id}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                                                onClick={() => handleBookingStatus(req.id, "declined")}
                                            >
                                                ✕ Decline
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeNav === "upcoming" && (
                        <div className="space-y-4">
                            {upcomingList.length === 0 ? (
                                <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
                                    <div className="text-5xl mb-4">📅</div>
                                    <h3 className="font-bold text-slate-700 text-lg mb-2">No Upcoming Sessions</h3>
                                    <p className="text-slate-400 text-sm">You have no confirmed upcoming sessions.</p>
                                </div>
                            ) : (
                                upcomingList.map((s) => (
                                    <div key={s.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center text-white font-bold">
                                                {(s.student_name || "S").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between flex-wrap gap-2">
                                                    <div>
                                                        <h3 className="font-bold text-slate-800">{s.student_name || "Student"}</h3>
                                                        <p className="text-slate-500 text-sm">{s.date} · {formatTimeDisplay(s.time)}</p>
                                                    </div>
                                                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">Confirmed</span>
                                                </div>
                                                <div className="bg-indigo-50 rounded-xl px-3 py-2 text-sm text-indigo-700 font-medium mt-3">
                                                    📌 {s.topic}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeNav === "completed" && (
                        <div className="space-y-4">
                            {completedList.length === 0 ? (
                                <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
                                    <div className="text-5xl mb-4">✅</div>
                                    <h3 className="font-bold text-slate-700 text-lg mb-2">No Completed Sessions</h3>
                                    <p className="text-slate-400 text-sm">Completed sessions will appear here.</p>
                                </div>
                            ) : (
                                completedList.map((s) => (
                                    <div key={s.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold">
                                                {(s.student_name || "S").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between flex-wrap gap-2">
                                                    <div>
                                                        <h3 className="font-bold text-slate-800">{s.student_name || "Student"}</h3>
                                                        <p className="text-slate-500 text-sm">{s.date} · {formatTimeDisplay(s.time)}</p>
                                                    </div>
                                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">Completed</span>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium mt-3">
                                                    📌 {s.topic}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

          {activeNav === "availability" && (
              <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs max-w-2xl">
                  <div className="flex items-center justify-between mb-4">
                      <div>
                          <h2 className="font-bold text-[#172033] text-lg">Manage Availability</h2>
                          <p className="text-[#718096] text-sm mt-0.5">Configure available days and add, edit, or remove specific timing slots.</p>
                      </div>
                  </div>

                  {availFeedback && (
                      <div className={`p-3 rounded-xl text-sm mb-4 font-medium border ${availFeedback.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-rose-50 text-rose-700 border-rose-200/60"}`}>
                          {availFeedback.msg}
                      </div>
                  )}

                  <div className="space-y-4 mb-6">
                    {days.map(day => (
                        <div key={day} className={`rounded-xl border transition-all p-4 ${avail[day].active ? "border-[#4F46E5]/30 bg-[#EEF0FF]/20" : "border-[#E5E7EB] bg-[#F5F7FC]/50"}`}>
                            {/* Day Header */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 cursor-pointer ${avail[day].active ? "bg-[#4F46E5]" : "bg-slate-300"}`}
                                        onClick={() => toggleDay(day)}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${avail[day].active ? "left-4" : "left-0.5"}`}/>
                                    </button>
                                    <span className={`font-semibold ${avail[day].active ? "text-[#172033]" : "text-[#718096]"}`}>{DAY_MAP[day]}</span>
                                    {avail[day].active ? (
                                        <span className="text-xs bg-indigo-50 text-[#4F46E5] font-semibold px-2 py-0.5 rounded-full border border-indigo-100">
                                            {avail[day].slots.length} {avail[day].slots.length === 1 ? "slot" : "slots"}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[#718096]">Unavailable</span>
                                    )}
                                </div>

                                {avail[day].active && (
                                    <button
                                        type="button"
                                        onClick={() => handleStartAddSlot(day)}
                                        className="text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] hover:bg-[#EEF0FF] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>+ Add Time Slot</span>
                                    </button>
                                )}
                            </div>

                            {/* Active Day Slots */}
                            {avail[day].active && (
                                <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                                    {/* Add Slot Form */}
                                    {addingSlotDay === day && (
                                        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-xs mb-3">
                                            <div className="text-xs font-semibold text-[#172033] mb-2">New slot for {DAY_MAP[day]}:</div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center gap-1 text-xs text-[#718096]">
                                                    <span>Start:</span>
                                                    <input
                                                        type="time"
                                                        value={newSlotStart}
                                                        onChange={(e) => setNewSlotStart(e.target.value)}
                                                        className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-[#172033] bg-white focus:outline-indigo-500"
                                                    />
                                                </div>
                                                <span className="text-slate-400 text-xs">to</span>
                                                <div className="flex items-center gap-1 text-xs text-[#718096]">
                                                    <span>End:</span>
                                                    <input
                                                        type="time"
                                                        value={newSlotEnd}
                                                        onChange={(e) => setNewSlotEnd(e.target.value)}
                                                        className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-[#172033] bg-white focus:outline-indigo-500"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirmAddSlot(day)}
                                                        className="bg-[#4F46E5] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#4338CA] transition-colors cursor-pointer"
                                                    >
                                                        Add Slot
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelAddSlot}
                                                        className="text-slate-500 hover:text-slate-700 text-xs font-medium px-2 py-1.5 cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                            {slotError?.day === day && (
                                                <div className="text-rose-600 text-xs mt-2 font-medium bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                                                    ⚠️ {slotError.msg}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Slots List */}
                                    {avail[day].slots.length === 0 && addingSlotDay !== day && (
                                        <p className="text-xs text-[#718096] italic py-1">No time slots yet. Click &ldquo;+ Add Time Slot&rdquo; above to set available times.</p>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {avail[day].slots.map((slot, sIdx) => {
                                            const isEditing = editingSlot?.day === day && editingSlot?.idx === sIdx;
                                            if (isEditing) {
                                                return (
                                                    <div key={sIdx} className="w-full bg-white p-3 rounded-xl border border-indigo-300 shadow-xs space-y-2">
                                                        <div className="text-xs font-semibold text-[#172033]">Edit slot timing:</div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="flex items-center gap-1 text-xs text-[#718096]">
                                                                <span>Start:</span>
                                                                <input
                                                                    type="time"
                                                                    value={editStart}
                                                                    onChange={(e) => setEditStart(e.target.value)}
                                                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-[#172033] bg-white focus:outline-indigo-500"
                                                                />
                                                            </div>
                                                            <span className="text-slate-400 text-xs">to</span>
                                                            <div className="flex items-center gap-1 text-xs text-[#718096]">
                                                                <span>End:</span>
                                                                <input
                                                                    type="time"
                                                                    value={editEnd}
                                                                    onChange={(e) => setEditEnd(e.target.value)}
                                                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-[#172033] bg-white focus:outline-indigo-500"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleConfirmEditSlot(day, sIdx)}
                                                                    className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-emerald-700 cursor-pointer"
                                                                >
                                                                    Save Slot
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEditSlot}
                                                                    className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-1 cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {slotError?.editDay === day && slotError?.editIdx === sIdx && (
                                                            <div className="text-rose-600 text-xs mt-1 font-medium bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                                                                ⚠️ {slotError.msg}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={sIdx}
                                                    className="bg-white hover:bg-slate-50 border border-slate-200 text-[#172033] text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2.5 transition-all"
                                                >
                                                    <span>🕒 {slot}</span>
                                                    <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEditSlot(day, sIdx, slot)}
                                                            className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded cursor-pointer"
                                                            title="Edit slot timing"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSlot(day, sIdx)}
                                                            className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer font-bold"
                                                            title="Delete slot"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                  </div>

                  <button
                      type="button"
                      disabled={savingAvail}
                      onClick={handleSaveAvailability}
                      className="bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                      {savingAvail ? "Saving..." : "Save Availability"}
                  </button>
              </div>
          )}

          {activeNav === "skills" && (
              <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs max-w-2xl">
                  <h2 className="font-bold text-[#172033] text-lg mb-1">My Skills</h2>
                  <p className="text-[#718096] text-sm mb-5">These skills are visible to mentees and used for matching.</p>

                  {skillsFeedback && (
                      <div className={`p-3 rounded-xl text-sm mb-4 font-medium border ${skillsFeedback.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-rose-50 text-rose-700 border-rose-200/60"}`}>
                          {skillsFeedback.msg}
                      </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-6">
                    {skillsList.length === 0 ? (
                        <p className="text-[#718096] text-sm italic">No skills added yet. Add your first skill below.</p>
                    ) : (
                        skillsList.map(s => (
                            <div key={s} className="flex items-center gap-1.5 bg-[#EEF0FF] border border-[#EEF0FF] text-[#4F46E5] text-sm font-semibold px-3 py-1.5 rounded-full">
                                {s}
                                <button
                                    type="button"
                                    disabled={savingSkills}
                                    onClick={() => handleRemoveSkill(s)}
                                    className="text-[#4F46E5]/70 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                  </div>

                  <form onSubmit={handleAddSkill} className="flex gap-2">
                      <input
                          type="text"
                          value={newSkillInput}
                          onChange={(e) => setNewSkillInput(e.target.value)}
                          placeholder="Type a skill (e.g. Python, Machine Learning) and press Enter..."
                          className="flex-1 px-4 py-2.5 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                      />
                      <button
                          type="submit"
                          disabled={savingSkills || !newSkillInput.trim()}
                          className="bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
                      >
                          {savingSkills ? "Saving..." : "+ Add Skill"}
                      </button>
                  </form>
              </div>
          )}

          {activeNav === "profile" && (
              <div className="bg-white rounded-2xl p-6 md:p-8 border border-[#E5E7EB] shadow-xs max-w-3xl">
                  <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[#E5E7EB]">
                      <div className="w-16 h-16 bg-[#4F46E5] text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-sm flex-shrink-0">
                          {getInitials(mentorProfile?.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl font-bold text-[#172033]">{mentorProfile?.name || "Mentor"}</h2>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                  {mentorProfile?.verified ? "✓ Verified Mentor" : "Active Mentor"}
                              </span>
                          </div>
                          <p className="text-sm font-semibold text-[#4F46E5] mt-0.5">{mentorProfile?.mentor_type || "Mentor"}</p>
                          <p className="text-xs text-[#718096] mt-1">{mentorProfile?.org || "Organization"} · {mentorProfile?.dept || "Department"}</p>
                      </div>
                  </div>

                  <div className="space-y-6">
                      <div>
                          <h3 className="font-bold text-[#172033] text-sm mb-2">About / Bio</h3>
                          <div className="text-sm text-[#172033]/80 bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB] leading-relaxed">
                              {mentorProfile?.bio || "No bio added yet."}
                          </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                          <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                              <p className="text-xs text-[#718096] mb-1 font-medium">Email Address</p>
                              <p className="text-sm font-semibold text-[#172033]">{mentorProfile?.email || "N/A"}</p>
                          </div>
                          <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                              <p className="text-xs text-[#718096] mb-1 font-medium">Experience</p>
                              <p className="text-sm font-semibold text-[#172033]">{mentorProfile?.experience !== undefined ? `${mentorProfile.experience} years` : "N/A"}</p>
                          </div>
                      </div>

                      <div>
                          <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold text-[#172033] text-sm">Skills & Expertise</h3>
                              <button
                                  type="button"
                                  onClick={() => setActiveNav("skills")}
                                  className="text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] cursor-pointer"
                              >
                                  Manage Skills →
                              </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {(mentorProfile?.skills || []).map((s) => (
                                  <span key={s} className="bg-[#EEF0FF] text-[#4F46E5] text-xs font-semibold px-3 py-1 rounded-full border border-[#EEF0FF]">
                                      {s}
                                  </span>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeNav === "reviews" && (
              <div className="space-y-4 max-w-3xl">
                  <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs">
                      <h2 className="font-bold text-[#172033] text-lg mb-1">Student Reviews & Ratings</h2>
                      <p className="text-[#718096] text-xs mb-4">Feedback from mentees who attended sessions with you</p>
                      <div className="flex items-center gap-4">
                          <div className="text-3xl font-bold text-[#172033]">
                              {mentorReviews.length > 0
                                  ? (mentorReviews.reduce((sum, r) => sum + r.rating, 0) / mentorReviews.length).toFixed(1)
                                  : "5.0"}
                          </div>
                          <div className="text-amber-400 text-lg">
                              {"★".repeat(mentorReviews.length > 0 ? Math.round(mentorReviews.reduce((sum, r) => sum + r.rating, 0) / mentorReviews.length) : 5)}
                          </div>
                          <span className="text-[#718096] text-xs">({mentorReviews.length} {mentorReviews.length === 1 ? "review" : "reviews"})</span>
                      </div>
                  </div>

                  {mentorReviews.length > 0 ? (
                      mentorReviews.map((rev) => (
                          <div key={rev.id} className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
                              <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-[#4F46E5] text-white rounded-full flex items-center justify-center font-bold text-xs">
                                          {rev.student_name ? getInitials(rev.student_name) : (rev.student_id || "ST").slice(0, 2).toUpperCase()}
                                      </div>
                                      <span className="font-semibold text-sm text-[#172033]">{rev.student_name || "Student"}</span>
                                  </div>
                                  <div className="text-amber-400 text-xs">
                                      {"★".repeat(rev.rating)}
                                      {"☆".repeat(5 - rev.rating)}
                                  </div>
                              </div>
                              <p className="text-sm text-[#172033]/80">{rev.text || "No written feedback provided."}</p>
                          </div>
                      ))
                  ) : (
                      <div className="bg-white rounded-2xl p-10 border border-[#E5E7EB] shadow-xs text-center">
                          <div className="text-4xl mb-3">⭐</div>
                          <h3 className="font-bold text-[#172033] text-base mb-1">No Reviews Yet</h3>
                          <p className="text-[#718096] text-xs">Reviews will appear here once students complete sessions with you.</p>
                      </div>
                  )}
              </div>
          )}

          {activeNav !== "dashboard" &&
           activeNav !== "requests" &&
           activeNav !== "upcoming" &&
           activeNav !== "completed" &&
           activeNav !== "availability" &&
           activeNav !== "skills" &&
           activeNav !== "profile" &&
           activeNav !== "reviews" && (
              <div className="bg-white rounded-2xl p-10 border border-slate-100 shadow-sm text-center max-w-md mx-auto">
                  <div className="text-5xl mb-4">{navItems.find(n => n.id === activeNav)?.icon}</div>
                  <h3 className="font-bold text-slate-700 text-lg mb-2">{navItems.find(n => n.id === activeNav)?.label}</h3>
                  <p className="text-slate-400 text-sm">This section is fully functional in the complete implementation.</p>
              </div>
          )}
        </div>
      </main>
    </div>);
}
