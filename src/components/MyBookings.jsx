import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

export default function MyBookings({ onNavigate }) {
    const [tab, setTab] = useState("Upcoming");
    const [bookingsList, setBookingsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [completingId, setCompletingId] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [userRole, setUserRole] = useState("student");

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) {
                setError("Please log in to view your bookings.");
                setLoading(false);
                return;
            }

            // Detect user role for smart back navigation
            try {
                const { data: userData } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", session.user.id)
                    .maybeSingle();
                if (userData?.role) {
                    setUserRole(userData.role);
                }
            } catch (roleErr) {
                console.warn("Could not determine user role:", roleErr);
            }

            const response = await fetch("http://localhost:5000/bookings", {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load bookings");
            }

            setBookingsList(data.bookings || []);
        } catch (err) {
            console.error("Failed to load bookings:", err);
            setError(err.message || "Failed to load bookings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, []);

    const promptCancel = (booking) => {
        setActionFeedback(null);
        setConfirmModal({
            id: booking.id,
            topic: booking.topic || "Session",
            mentorName: booking.mentor_name || "Mentor"
        });
    };

    const confirmCancelBooking = async () => {
        if (!confirmModal) return;
        const bookingId = confirmModal.id;

        try {
            setCancellingId(bookingId);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                setActionFeedback({
                    type: "error",
                    message: "Session expired. Please log in again."
                });
                return;
            }

            const response = await fetch(`http://localhost:5000/bookings/${bookingId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: "cancelled"
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to cancel booking");
            }

            setConfirmModal(null);
            setActionFeedback({
                type: "success",
                message: "Booking cancelled successfully."
            });
            await loadBookings();
        } catch (err) {
            console.error("Cancel booking error:", err);
            setActionFeedback({
                type: "error",
                message: err.message || "Could not cancel booking."
            });
        } finally {
            setCancellingId(null);
        }
    };

    const handleCompleteBooking = async (bookingId) => {
        try {
            setCompletingId(bookingId);
            setActionFeedback(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                setActionFeedback({
                    type: "error",
                    message: "Session expired. Please log in again."
                });
                return;
            }

            const response = await fetch(`http://localhost:5000/bookings/${bookingId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: "completed"
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to mark session as completed");
            }

            setActionFeedback({
                type: "success",
                message: "Session marked as completed! You can now provide feedback."
            });
            await loadBookings();
        } catch (err) {
            console.error("Complete booking error:", err);
            setActionFeedback({
                type: "error",
                message: err.message || "Could not mark booking completed."
            });
        } finally {
            setCompletingId(null);
        }
    };

    const categories = {
        Upcoming: bookingsList.filter((b) => b.status === "confirmed"),
        Pending: bookingsList.filter((b) => b.status === "pending"),
        Completed: bookingsList.filter((b) => b.status === "completed"),
        Cancelled: bookingsList.filter(
            (b) => b.status === "cancelled" || b.status === "declined"
        )
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "confirmed":
                return { label: "Confirmed", color: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" };
            case "pending":
                return { label: "Pending Acceptance", color: "bg-amber-50 text-amber-700 border border-amber-200/60" };
            case "completed":
                return { label: "Completed", color: "bg-[#EEF0FF] text-[#4F46E5] border border-[#EEF0FF]" };
            case "declined":
                return { label: "Declined", color: "bg-rose-50 text-rose-700 border border-rose-200/60" };
            case "cancelled":
                return { label: "Cancelled", color: "bg-slate-100 text-[#718096] border border-[#E5E7EB]" };
            default:
                return { label: status, color: "bg-[#F5F7FC] text-[#718096] border border-[#E5E7EB]" };
        }
    };

    const currentBookings = categories[tab] || [];

    const handleBackNav = () => {
        if (userRole === "mentor") {
            onNavigate("mentorDashboard");
        } else if (userRole === "admin") {
            onNavigate("adminDashboard");
        } else {
            onNavigate("menteeDashboard");
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F7FC]">
            <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div className="flex items-center gap-4">
                    <button
                        className="flex items-center gap-2 text-sm font-semibold text-[#172033] hover:text-[#4F46E5] transition-colors bg-[#F5F7FC] px-3 py-1.5 rounded-xl border border-[#E5E7EB]"
                        onClick={handleBackNav}
                    >
                        <span>←</span>
                        <span>{userRole === "mentor" ? "Mentor Dashboard" : "Dashboard"}</span>
                    </button>
                    <div className="h-5 w-px bg-[#E5E7EB]" />
                    <span className="font-bold text-[#172033]">My Bookings</span>
                </div>
            </header>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                {/* Action Feedback Banner */}
                {actionFeedback && (
                    <div
                        className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between transition-all ${
                            actionFeedback.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{actionFeedback.type === "success" ? "✓" : "⚠️"}</span>
                            <span>{actionFeedback.message}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActionFeedback(null)}
                            className="text-xs font-bold hover:opacity-75 cursor-pointer ml-4"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#E5E7EB] shadow-xs mb-6">
                    {["Upcoming", "Pending", "Completed", "Cancelled"].map((t) => (
                        <button
                            key={t}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                tab === t
                                    ? "bg-[#4F46E5] text-white shadow-xs"
                                    : "text-[#718096] hover:bg-[#F5F7FC] hover:text-[#172033]"
                            }`}
                            onClick={() => setTab(t)}
                        >
                            {t}
                            <span
                                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                                    tab === t ? "bg-white/20" : "bg-[#F5F7FC] text-[#718096]"
                                }`}
                            >
                                {categories[t].length}
                            </span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    /* Loading Skeleton */
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs animate-pulse"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="h-5 bg-slate-200 rounded w-1/3" />
                                            <div className="h-5 bg-slate-100 rounded-full w-20" />
                                        </div>
                                        <div className="h-4 bg-slate-100 rounded w-1/2" />
                                        <div className="h-4 bg-slate-100 rounded w-1/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="bg-white rounded-2xl p-8 border border-rose-100 shadow-xs text-center">
                        <p className="text-rose-600 text-sm mb-4">{error}</p>
                        <button
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-xs"
                            onClick={loadBookings}
                        >
                            Retry
                        </button>
                    </div>
                ) : currentBookings.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 border border-[#E5E7EB] shadow-xs text-center">
                        <div className="text-5xl mb-4">📭</div>
                        <h3 className="font-bold text-[#172033] text-lg mb-2">No {tab} Bookings</h3>
                        <p className="text-[#718096] text-sm mb-5">
                            You don&apos;t have any {tab.toLowerCase()} bookings yet.
                        </p>
                        <button
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-xs"
                            onClick={() => onNavigate("search")}
                        >
                            Find a Mentor
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {currentBookings.map((b) => {
                            const badge = getStatusBadge(b.status);
                            const mentorName = b.mentor_name || "Mentor";
                            const avatar = getInitials(mentorName);

                            return (
                                <div
                                    key={b.id}
                                    className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs hover:border-[#4F46E5]/40 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                            {avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                                <div>
                                                    <h3 className="font-bold text-[#172033]">{mentorName}</h3>
                                                    <p className="text-[#4F46E5] text-sm font-medium mt-0.5">
                                                        📌 {b.topic}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}
                                                >
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-[#718096]">
                                                <span>📅 {b.date}</span>
                                                <span>🕐 {formatTimeDisplay(b.time)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4 flex-wrap">
                                        {tab === "Upcoming" && (
                                            <button
                                                disabled={completingId === b.id}
                                                onClick={() => handleCompleteBooking(b.id)}
                                                className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {completingId === b.id ? "Updating..." : "✓ Mark Completed"}
                                            </button>
                                        )}
                                        {(tab === "Upcoming" || tab === "Pending") && (
                                            <button
                                                className="text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                                                onClick={() => promptCancel(b)}
                                            >
                                                Cancel Session
                                            </button>
                                        )}
                                        {tab === "Completed" && (
                                            <button
                                                onClick={() => onNavigate("feedback")}
                                                className="text-xs font-semibold bg-[#EEF0FF] hover:bg-[#4F46E5] hover:text-white text-[#4F46E5] border border-[#EEF0FF] px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                                            >
                                                <span>★</span>
                                                <span>Give Feedback</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* In-app Cancellation Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-[#172033]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB]">
                        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl mb-4 font-bold border border-rose-100">
                            ⚠️
                        </div>
                        <h3 className="text-lg font-bold text-[#172033] mb-1">Cancel Session?</h3>
                        <p className="text-sm text-[#718096] mb-6">
                            Are you sure you want to cancel your session with <strong className="text-[#172033]">{confirmModal.mentorName}</strong> on <strong className="text-[#172033]">{confirmModal.topic}</strong>?
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={cancellingId !== null}
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 text-sm font-semibold text-[#172033] bg-[#F5F7FC] hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-[#E5E7EB]"
                            >
                                Keep Session
                            </button>
                            <button
                                type="button"
                                disabled={cancellingId !== null}
                                onClick={confirmCancelBooking}
                                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-75"
                            >
                                {cancellingId ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Cancelling...</span>
                                    </>
                                ) : (
                                    <span>Yes, Cancel</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
