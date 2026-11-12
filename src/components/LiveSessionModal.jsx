import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { API_URL } from "../lib/api";

const TERMINAL_STATUSES = new Set(["completed", "expired", "cancelled"]);

async function requestSession(bookingId, path = "", method = "GET") {
    const {
        data: { session },
        error: authError
    } = await supabase.auth.getSession();

    if (authError || !session?.access_token) {
        throw new Error("Please sign in again to join this session.");
    }

    const response = await fetch(`${API_URL}/sessions/${bookingId}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(method === "POST" ? { "Content-Type": "application/json" } : {})
        }
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.error || "The live session request failed.");
    }
    return data;
}

function formatSessionDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function statusMessage(session) {
    if (!session) return "Checking the session schedule…";
    if (session.status === "scheduled") {
        return `Join opens at ${formatSessionDate(session.joinOpensAt)} (Asia/Kolkata).`;
    }
    if (session.status === "ready") return "The session is ready. You can join now.";
    if (session.status === "waiting") return "You are in the session. Waiting for the other participant.";
    if (session.status === "ongoing") return "The session is in progress. Rejoin if you were disconnected.";
    if (session.status === "completed") return "This session has ended.";
    if (session.status === "expired") return "The session join window has expired.";
    if (session.status === "cancelled") return "This booking was cancelled.";
    return "The live session is available after the booking is confirmed.";
}

export default function LiveSessionModal({ booking, onClose, onBookingUpdated }) {
    const [sessionState, setSessionState] = useState(null);
    const [credentials, setCredentials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [joined, setJoined] = useState(false);
    const roomContainerRef = useRef(null);
    const roomInstanceRef = useRef(null);
    const sessionStateRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const onBookingUpdatedRef = useRef(onBookingUpdated);
    const terminalUpdateNotifiedRef = useRef(false);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onBookingUpdatedRef.current = onBookingUpdated;
    }, [onBookingUpdated]);

    const notifyBookingUpdated = useCallback((data) => {
        if (
            ["completed", "cancelled"].includes(data?.status) &&
            !terminalUpdateNotifiedRef.current
        ) {
            terminalUpdateNotifiedRef.current = true;
            onBookingUpdatedRef.current?.(data);
        }
    }, []);

    const refreshSession = useCallback(async () => {
        try {
            const data = await requestSession(booking.id);
            sessionStateRef.current = data;
            setSessionState(data);
            setError("");
            notifyBookingUpdated(data);

            if (TERMINAL_STATUSES.has(data.status) && roomInstanceRef.current) {
                roomInstanceRef.current.hangUp();
            }
        } catch (requestError) {
            setError(requestError.message || "Unable to load the live session.");
        } finally {
            setLoading(false);
        }
    }, [booking.id, notifyBookingUpdated]);

    useEffect(() => {
        let disposed = false;
        const load = async () => {
            try {
                const data = await requestSession(booking.id);
                if (disposed) return;
                sessionStateRef.current = data;
                setSessionState(data);
                setError("");
                notifyBookingUpdated(data);
                if (TERMINAL_STATUSES.has(data.status) && roomInstanceRef.current) {
                    roomInstanceRef.current.hangUp();
                }
            } catch (requestError) {
                if (!disposed) {
                    setError(requestError.message || "Unable to load the live session.");
                }
            } finally {
                if (!disposed) setLoading(false);
            }
        };

        load();
        const interval = window.setInterval(load, 15000);
        return () => {
            disposed = true;
            window.clearInterval(interval);
        };
    }, [booking.id, notifyBookingUpdated]);

    useEffect(() => {
        if (!credentials || !roomContainerRef.current) return undefined;
        let disposed = false;
        let instance = null;

        const startCall = async () => {
            try {
                const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
                if (disposed) return;

                const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
                    credentials.appId,
                    credentials.token,
                    credentials.roomId,
                    credentials.userId,
                    credentials.userName
                );
                instance = ZegoUIKitPrebuilt.create(kitToken);
                roomInstanceRef.current = instance;

                instance.joinRoom({
                    container: roomContainerRef.current,
                    scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
                    maxUsers: 2,
                    showPreJoinView: true,
                    showTextChat: true,
                    showUserList: true,
                    showScreenSharingButton: true,
                    showMoreButton: false,
                    showRoomTimer: true,
                    console: ZegoUIKitPrebuilt.ConsoleNone,
                    onJoinRoom: () => {
                        setJoined(true);
                        setConnecting(false);
                        requestSession(booking.id, "/joined", "POST")
                            .then((data) => {
                                sessionStateRef.current = data;
                                setSessionState(data);
                                setError("");
                            })
                            .catch((requestError) => {
                                setError(requestError.message || "Unable to record session attendance.");
                            });
                    },
                    onLeaveRoom: () => {
                        setJoined(false);
                        setConnecting(false);
                        if (!TERMINAL_STATUSES.has(sessionStateRef.current?.status)) {
                            setNotice("You left the live session.");
                        }
                        requestSession(booking.id, "/leave", "POST").catch((requestError) => {
                            setError(requestError.message || "Unable to record that you left the session.");
                        });
                        setCredentials(null);
                    },
                    onReturnToHomeScreenClicked: () => {
                        onCloseRef.current();
                    }
                });
            } catch (startError) {
                if (!disposed) {
                    setError(startError.message || "Unable to start the video call.");
                    setConnecting(false);
                    setCredentials(null);
                }
            }
        };

        startCall();
        return () => {
            disposed = true;
            if (instance) {
                instance.destroy();
                if (roomInstanceRef.current === instance) roomInstanceRef.current = null;
            }
        };
    }, [booking.id, credentials]);

    const handleJoin = async () => {
        setError("");
        setNotice("");
        setConnecting(true);
        try {
            const data = await requestSession(booking.id, "/join", "POST");
            setCredentials(data);
        } catch (requestError) {
            const message = requestError.message || "Unable to join the live session.";
            setConnecting(false);
            await refreshSession();
            setError(message);
        }
    };

    const handleEnd = async () => {
        setError("");
        setEnding(true);
        try {
            const data = await requestSession(booking.id, "/end", "POST");
            sessionStateRef.current = data;
            setSessionState(data);
            notifyBookingUpdated(data);
            setNotice("The session is complete.");
            roomInstanceRef.current?.hangUp();
        } catch (requestError) {
            setError(requestError.message || "Unable to end the live session.");
        } finally {
            setEnding(false);
        }
    };

    const handleClose = () => {
        roomInstanceRef.current?.hangUp();
        onClose();
    };

    const isMentor = sessionState?.participantRole === "mentor";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="live-session-title"
                className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                            Live mentorship · Asia/Kolkata
                        </p>
                        <h2 id="live-session-title" className="mt-1 truncate text-lg font-bold text-slate-900">
                            {booking.topic || "Mentorship session"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {booking.date} · {booking.time}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {isMentor && joined && (
                            <button
                                type="button"
                                onClick={handleEnd}
                                disabled={ending}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                {ending ? "Ending…" : "End session"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            {joined ? "Leave call" : "Close"}
                        </button>
                    </div>
                </header>

                <div className="overflow-y-auto p-4 sm:p-6">
                    {error && (
                        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            {error}
                        </div>
                    )}
                    {notice && (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {notice}
                        </div>
                    )}

                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <strong>Recording is off.</strong> SkillSwap does not record this call. Post-session
                        audio uploads are separate, require both participants&apos; consent, and are limited to
                        30 seconds for transcription.
                    </div>

                    {credentials ? (
                        <div
                            ref={roomContainerRef}
                            className="h-[65vh] min-h-[420px] overflow-hidden rounded-xl bg-slate-950"
                            aria-label="Live mentorship video call"
                        />
                    ) : (
                        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="mb-3 text-4xl" aria-hidden="true">🎥</div>
                            <h3 className="text-lg font-bold text-slate-900">Private one-to-one session</h3>
                            <p className="mt-2 text-sm text-slate-600" aria-live="polite">
                                {loading ? "Checking booking access and session timing…" : statusMessage(sessionState)}
                            </p>
                            {sessionState && (
                                <p className="mt-2 text-xs text-slate-500">
                                    Join window closes {formatSessionDate(sessionState.expiresAt)}.
                                </p>
                            )}
                            {sessionState?.participants && (
                                <p className="mt-3 text-xs text-slate-500">
                                    {sessionState.participants.studentJoined ? "Student has joined" : "Student not yet joined"} ·{" "}
                                    {sessionState.participants.mentorJoined ? "Mentor has joined" : "Mentor not yet joined"}
                                </p>
                            )}
                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                                {sessionState?.canJoin && (
                                    <button
                                        type="button"
                                        onClick={handleJoin}
                                        disabled={loading || connecting}
                                        className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {connecting ? "Connecting…" : "Join live session"}
                                    </button>
                                )}
                                {isMentor && ["waiting", "ongoing"].includes(sessionState?.status) && (
                                    <button
                                        type="button"
                                        onClick={handleEnd}
                                        disabled={ending}
                                        className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                    >
                                        {ending ? "Ending…" : "End session"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
