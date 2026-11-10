import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getInitials(name) {
    if (!name || typeof name !== "string") return "M";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "M";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

const RATING_LABELS = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Exceptional"
};

export default function Feedback({ onNavigate, initialBookingId }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);

    // Form states keyed by mentor_id
    const [ratings, setRatings] = useState({});
    const [hoverRatings, setHoverRatings] = useState({});
    const [comments, setComments] = useState({});
    const [submittingMentorId, setSubmittingMentorId] = useState(null);

    const loadEligibleSessions = async () => {
        try {
            setLoading(true);
            setError(null);

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) {
                setError("Please log in to view and submit session feedback.");
                setLoading(false);
                return;
            }

            const response = await fetch("http://localhost:5000/reviews/eligible", {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to load eligible sessions.");
            }

            const data = await response.json();
            const list = Array.isArray(data.sessions) ? data.sessions : [];
            setSessions(list);
        } catch (err) {
            console.error("Feedback load error:", err);
            setError(err.message || "Failed to load eligible feedback sessions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEligibleSessions();
    }, []);

    const handleRatingSelect = (mentorId, ratingVal) => {
        setRatings((prev) => ({ ...prev, [mentorId]: ratingVal }));
    };

    const handleCommentChange = (mentorId, text) => {
        setComments((prev) => ({ ...prev, [mentorId]: text }));
    };

    const handleSubmitFeedback = async (mentorId, bookingId) => {
        const rating = ratings[mentorId];
        const text = (comments[mentorId] || "").trim();

        if (!rating || rating < 1 || rating > 5) {
            setActionFeedback({
                type: "error",
                message: "Please select a star rating (1 to 5) before submitting."
            });
            return;
        }

        if (!text || text.length < 3) {
            setActionFeedback({
                type: "error",
                message: "Please write at least a few words (minimum 3 characters) about your experience."
            });
            return;
        }

        try {
            setSubmittingMentorId(mentorId);
            setActionFeedback(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();

            const token = session?.access_token;
            if (!token) {
                setActionFeedback({
                    type: "error",
                    message: "Session expired. Please sign in again."
                });
                return;
            }

            const response = await fetch("http://localhost:5000/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    mentor_id: mentorId,
                    booking_id: bookingId,
                    rating,
                    text
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit review.");
            }

            // Update local state without requiring a refresh
            setSessions((prev) =>
                prev.map((s) => {
                    if (s.mentor_id === mentorId) {
                        return {
                            ...s,
                            has_reviewed: true,
                            review: data.review || {
                                rating,
                                text
                            }
                        };
                    }
                    return s;
                })
            );

            setActionFeedback({
                type: "success",
                message: "Thank you! Your feedback has been recorded and shared with your mentor."
            });
        } catch (err) {
            console.error("Submit feedback error:", err);
            setActionFeedback({
                type: "error",
                message: err.message || "Could not submit feedback."
            });
        } finally {
            setSubmittingMentorId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F7FC]">
            {/* Header */}
            <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onNavigate("menteeDashboard")}
                        className="flex items-center gap-2 text-sm font-semibold text-[#172033] hover:text-[#4F46E5] transition-colors bg-[#F5F7FC] px-3.5 py-2 rounded-xl border border-[#E5E7EB] cursor-pointer"
                    >
                        <span>←</span>
                        <span>Back to Dashboard</span>
                    </button>
                    <div className="h-5 w-px bg-[#E5E7EB] hidden sm:block" />
                    <div>
                        <h1 className="font-bold text-[#172033] text-base">Session Feedback & Reviews</h1>
                        <p className="text-xs text-[#718096] hidden sm:block">Rate and review your completed mentorship sessions</p>
                    </div>
                </div>

                <button
                    onClick={() => onNavigate("bookings")}
                    className="text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] px-3 py-1.5 rounded-xl bg-[#EEF0FF] transition-colors cursor-pointer"
                >
                    View All Bookings →
                </button>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Feedback Banner */}
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

                {/* Subtitle / Intro */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Your Completed Sessions</h2>
                    <p className="text-[#718096] text-sm mt-1">
                        Help the SkillSwap community by rating mentors you&apos;ve completed sessions with.
                    </p>
                </div>

                {loading ? (
                    /* Loading Skeleton */
                    <div className="space-y-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs animate-pulse space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 bg-slate-200 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-slate-200 rounded w-1/3" />
                                        <div className="h-4 bg-slate-100 rounded w-1/4" />
                                    </div>
                                </div>
                                <div className="h-20 bg-slate-100 rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="bg-white rounded-2xl p-8 border border-rose-100 shadow-xs text-center">
                        <div className="text-4xl mb-3">⚠️</div>
                        <h3 className="font-bold text-[#172033] text-base mb-1">Could Not Load Sessions</h3>
                        <p className="text-rose-600 text-sm mb-4">{error}</p>
                        <button
                            onClick={loadEligibleSessions}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                ) : sessions.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-2xl p-12 border border-[#E5E7EB] shadow-xs text-center max-w-md mx-auto">
                        <div className="w-16 h-16 bg-[#EEF0FF] text-[#4F46E5] rounded-full flex items-center justify-center text-3xl mx-auto mb-4 font-bold">
                            ⭐
                        </div>
                        <h3 className="font-bold text-[#172033] text-lg mb-2">No completed sessions to review yet</h3>
                        <p className="text-[#718096] text-sm mb-6 leading-relaxed">
                            Once you finish a mentoring session and it is marked as completed, you can share your feedback and rating here.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                            <button
                                onClick={() => onNavigate("search")}
                                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
                            >
                                Find a Mentor →
                            </button>
                            <button
                                onClick={() => onNavigate("bookings")}
                                className="bg-[#F5F7FC] hover:bg-[#EEF0FF] text-[#172033] hover:text-[#4F46E5] text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors border border-[#E5E7EB] cursor-pointer"
                            >
                                View My Bookings
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Sessions List */
                    <div className="space-y-6">
                        {sessions.map((s) => {
                            const isReviewed = s.has_reviewed;
                            const currentRating = ratings[s.mentor_id] || 0;
                            const hoverRating = hoverRatings[s.mentor_id] || 0;
                            const activeStars = hoverRating || currentRating;
                            const commentText = comments[s.mentor_id] || "";
                            const isSubmitting = submittingMentorId === s.mentor_id;

                            return (
                                <div
                                    key={s.booking_id}
                                    className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs hover:border-[#c7d2fe] transition-all"
                                >
                                    {/* Mentor & Session Info */}
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#F1F5F9]">
                                        <div className="flex items-start gap-4">
                                            <div className="w-13 h-13 bg-[#4F46E5] text-white rounded-full flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                                                {getInitials(s.mentor_name)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-[#172033] text-lg">{s.mentor_name}</h3>
                                                    {s.mentor_verified && (
                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                                            ✓ Verified
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-semibold text-[#4F46E5] mt-0.5">
                                                    {s.mentor_type} · {s.mentor_org || "SkillSwap Community"}
                                                </p>
                                                <div className="mt-2.5 inline-flex items-center gap-2 bg-[#EEF0FF] rounded-xl px-3 py-1.5 text-xs text-[#4F46E5] font-medium border border-[#c7d2fe]/30">
                                                    <span>📌</span>
                                                    <span>{s.topic}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-left sm:text-right text-xs text-[#718096] flex-shrink-0">
                                            <div>Completed Session</div>
                                            <div className="font-semibold text-[#172033] mt-0.5">
                                                📅 {s.date}
                                            </div>
                                            <div className="mt-0.5">
                                                🕐 {formatTimeDisplay(s.time)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Review State: Already Submitted vs New Form */}
                                    {isReviewed ? (
                                        <div className="mt-5 bg-[#F5F7FC] rounded-2xl p-5 border border-[#E5E7EB]">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                                        ✓ Feedback Submitted
                                                    </span>
                                                    <span className="text-xs text-[#718096]">Your Review:</span>
                                                </div>
                                                <div className="text-amber-400 text-base">
                                                    {"★".repeat(s.review?.rating || 5)}
                                                    {"☆".repeat(5 - (s.review?.rating || 5))}
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#172033]/85 leading-relaxed italic">
                                                &ldquo;{s.review?.text || "Great session!"}&rdquo;
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-5 space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-[#172033] mb-1.5 uppercase tracking-wider">
                                                    Your Rating <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => handleRatingSelect(s.mentor_id, star)}
                                                                onMouseEnter={() =>
                                                                    setHoverRatings((prev) => ({
                                                                        ...prev,
                                                                        [s.mentor_id]: star
                                                                    }))
                                                                }
                                                                onMouseLeave={() =>
                                                                    setHoverRatings((prev) => ({
                                                                        ...prev,
                                                                        [s.mentor_id]: 0
                                                                    }))
                                                                }
                                                                className="text-2xl transition-transform hover:scale-125 cursor-pointer focus:outline-none"
                                                                title={`${star} Star${star > 1 ? "s" : ""}`}
                                                            >
                                                                {star <= activeStars ? (
                                                                    <span className="text-amber-400">★</span>
                                                                ) : (
                                                                    <span className="text-slate-300">☆</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {activeStars > 0 && (
                                                        <span className="text-xs font-semibold text-[#4F46E5] ml-2">
                                                            {activeStars} / 5 — {RATING_LABELS[activeStars]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-[#172033] mb-1.5 uppercase tracking-wider">
                                                    Your Feedback & Comments <span className="text-rose-500">*</span>
                                                </label>
                                                <textarea
                                                    value={commentText}
                                                    onChange={(e) => handleCommentChange(s.mentor_id, e.target.value)}
                                                    rows={3}
                                                    maxLength={1000}
                                                    placeholder="How was the session? Did the mentor answer your doubts effectively? What did you learn?"
                                                    className="w-full px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] focus:bg-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all resize-none"
                                                />
                                                <div className="flex justify-between items-center text-[11px] text-[#718096] mt-1">
                                                    <span>Minimum 3 characters</span>
                                                    <span>{commentText.length} / 1000</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    disabled={isSubmitting || !currentRating || commentText.trim().length < 3}
                                                    onClick={() => handleSubmitFeedback(s.mentor_id, s.booking_id)}
                                                    className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                            <span>Submitting Feedback...</span>
                                                        </>
                                                    ) : (
                                                        <span>Submit Feedback ⭐</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
