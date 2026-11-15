import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { API_URL } from "../lib/api";
import { SessionAudioRecorder } from "../utils/sessionAudioRecorder";

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

function formatDuration(seconds = 0) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

    // Two-Party Consent & Dual-Track Audio Recording State
    const [studentConsent, setStudentConsent] = useState(false);
    const [mentorConsent, setMentorConsent] = useState(false);
    const [consentUpdating, setConsentUpdating] = useState(false);
    const [recorderState, setRecorderState] = useState({
        isRecording: false,
        hasLocal: false,
        hasRemote: false,
        isDualReady: false,
        durationSeconds: 0
    });
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcriptionStatus, setTranscriptionStatus] = useState(null); // 'uploading' | 'processing' | 'error' | 'success'
    const [transcriptionMessage, setTranscriptionMessage] = useState("");

    const roomContainerRef = useRef(null);
    const roomInstanceRef = useRef(null);
    const sessionStateRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const onBookingUpdatedRef = useRef(onBookingUpdated);
    const terminalUpdateNotifiedRef = useRef(false);
    const audioRecorderRef = useRef(null);
    const remoteScanIntervalRef = useRef(null);

    const isMentor = sessionState?.participantRole === "mentor";
    const userConsent = isMentor ? mentorConsent : studentConsent;
    const bothConsented = Boolean(studentConsent && mentorConsent);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onBookingUpdatedRef.current = onBookingUpdated;
    }, [onBookingUpdated]);

    // Initialize audio recorder instance
    useEffect(() => {
        audioRecorderRef.current = new SessionAudioRecorder({
            onStateChange: (state) => setRecorderState((prev) => ({ ...prev, ...state })),
            onAudioLevel: (lvl) => setAudioLevel(lvl)
        });

        return () => {
            if (remoteScanIntervalRef.current) {
                clearInterval(remoteScanIntervalRef.current);
                remoteScanIntervalRef.current = null;
            }
            if (audioRecorderRef.current) {
                audioRecorderRef.current.cleanup();
                audioRecorderRef.current = null;
            }
        };
    }, []);

    const notifyBookingUpdated = useCallback((data) => {
        if (
            ["completed", "cancelled"].includes(data?.status) &&
            !terminalUpdateNotifiedRef.current
        ) {
            terminalUpdateNotifiedRef.current = true;
            onBookingUpdatedRef.current?.(data);
        }
    }, []);

    // Check initial consent status from backend
    const checkConsentStatus = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`${API_URL}/bookings/${booking.id}/transcript`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStudentConsent(Boolean(data.student_consent));
                setMentorConsent(Boolean(data.mentor_consent));
            }
        } catch {
            // Non-fatal if transcript record is not yet initialized
        }
    }, [booking.id]);

    const refreshSession = useCallback(async () => {
        try {
            const data = await requestSession(booking.id);
            sessionStateRef.current = data;
            setSessionState(data);
            setError("");
            notifyBookingUpdated(data);
            await checkConsentStatus();

            if (TERMINAL_STATUSES.has(data.status) && roomInstanceRef.current) {
                roomInstanceRef.current.hangUp();
            }
        } catch (requestError) {
            setError(requestError.message || "Unable to load the live session.");
        } finally {
            setLoading(false);
        }
    }, [booking.id, notifyBookingUpdated, checkConsentStatus]);

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
                await checkConsentStatus();
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
    }, [booking.id, notifyBookingUpdated, checkConsentStatus]);

    // Handle user consent toggle
    const handleToggleConsent = async () => {
        setConsentUpdating(true);
        setError("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Please sign in again to record consent.");

            const res = await fetch(`${API_URL}/bookings/${booking.id}/consent`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to update recording consent");
            }

            setStudentConsent(Boolean(data.student_consent));
            setMentorConsent(Boolean(data.mentor_consent));

            // Broadcast consent state via Zego in-room command to peer
            if (roomInstanceRef.current?.sendInRoomCustomCommand) {
                roomInstanceRef.current.sendInRoomCustomCommand({
                    type: "SKILLSWAP_RECORDING_CONSENT",
                    studentConsent: Boolean(data.student_consent),
                    mentorConsent: Boolean(data.mentor_consent),
                    bothConsented: Boolean(data.both_consented)
                }).catch(() => {});
            }
        } catch (err) {
            setError(err.message || "Unable to update recording consent");
        } finally {
            setConsentUpdating(false);
        }
    };

    // Submits recorded WAV file to backend batch transcription pipeline
    const submitAutoTranscription = async (wavBlob, durationSecs) => {
        if (!wavBlob || wavBlob.size < 1000) return;

        setTranscriptionStatus("uploading");
        setTranscriptionMessage("Finalizing audio & submitting to Gnani Batch STT...");

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Session expired. Please sign in to view transcript.");

            const formData = new FormData();
            formData.append("audio_file", wavBlob, "session_recording.wav");
            formData.append("consent", "true");
            formData.append("durationSeconds", String(durationSecs || 0));

            const response = await fetch(`${API_URL}/sessions/${booking.id}/auto-transcribe`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to initiate session transcription");
            }

            setTranscriptionStatus("processing");
            setTranscriptionMessage("Transcription job submitted! Processing in background with speaker diarization.");
            notifyBookingUpdated({ ...sessionStateRef.current, status: "completed" });
        } catch (err) {
            console.error("Auto-transcribe submission failed:", err);
            setTranscriptionStatus("error");
            setTranscriptionMessage(err.message || "Failed to process audio recording");
        }
    };

    // Auto-start recording when both participants consent
    useEffect(() => {
        if (!joined || !bothConsented || !audioRecorderRef.current) return;

        if (!audioRecorderRef.current.isRecording) {
            try {
                audioRecorderRef.current.start();
                setNotice("Recording started: Both student and mentor have consented.");
            } catch (startErr) {
                console.warn("[LiveSessionModal] Recording start deferred (waiting for audio tracks):", startErr.message);
            }
        }
    }, [joined, bothConsented]);

    // ZEGOCLOUD Video Call Setup
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

                    // Track audio stream creation for local participant
                    onLocalStreamUpdated: (state, streamId, stream) => {
                        if (stream && (state === "created" || state === "published")) {
                            const track = stream.getAudioTracks()[0];
                            if (track && audioRecorderRef.current) {
                                audioRecorderRef.current.setLocalTrack(track);
                            }
                        }
                    },

                    // Catch peer consent broadcasts
                    onInRoomCustomCommandReceived: (commands) => {
                        if (Array.isArray(commands)) {
                            commands.forEach((c) => {
                                const cmd = c.command || {};
                                if (cmd.type === "SKILLSWAP_RECORDING_CONSENT") {
                                    setStudentConsent(Boolean(cmd.studentConsent));
                                    setMentorConsent(Boolean(cmd.mentorConsent));
                                }
                            });
                        }
                    },

                    onJoinRoom: () => {
                        setJoined(true);
                        setConnecting(false);

                        // Attach local track if already available on instance
                        if (instance.localStream && audioRecorderRef.current) {
                            const track = instance.localStream.getAudioTracks()[0];
                            if (track) audioRecorderRef.current.setLocalTrack(track);
                        }

                        // Periodic scan of DOM container to capture remote participant audio element
                        if (remoteScanIntervalRef.current) clearInterval(remoteScanIntervalRef.current);
                        remoteScanIntervalRef.current = setInterval(() => {
                            if (!roomContainerRef.current || !audioRecorderRef.current) return;

                            // 1. Check DOM audio/video elements
                            const mediaEls = roomContainerRef.current.querySelectorAll("video, audio");
                            mediaEls.forEach((el) => {
                                const stream = el.srcObject;
                                if (stream instanceof MediaStream) {
                                    const tracks = stream.getAudioTracks();
                                    if (tracks.length > 0 && tracks[0] !== audioRecorderRef.current.localTrack) {
                                        audioRecorderRef.current.setRemoteTrack(tracks[0]);
                                    }
                                }
                            });

                            // 2. Check ZegoUIKitPrebuilt core remoteStreamMap if accessible
                            if (ZegoUIKitPrebuilt.core?.remoteStreamMap) {
                                for (const key of Object.keys(ZegoUIKitPrebuilt.core.remoteStreamMap)) {
                                    const remoteObj = ZegoUIKitPrebuilt.core.remoteStreamMap[key];
                                    const remoteStream = remoteObj?.media;
                                    if (remoteStream && remoteStream instanceof MediaStream) {
                                        const tracks = remoteStream.getAudioTracks();
                                        if (tracks.length > 0 && tracks[0] !== audioRecorderRef.current.localTrack) {
                                            audioRecorderRef.current.setRemoteTrack(tracks[0]);
                                        }
                                    }
                                }
                            }
                        }, 2000);

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

                    onLeaveRoom: async () => {
                        setJoined(false);
                        setConnecting(false);

                        if (remoteScanIntervalRef.current) {
                            clearInterval(remoteScanIntervalRef.current);
                            remoteScanIntervalRef.current = null;
                        }

                        // Auto-finalize recording on leaving room
                        if (audioRecorderRef.current?.isRecording) {
                            try {
                                const res = await audioRecorderRef.current.stop();
                                if (res?.wavBlob) {
                                    await submitAutoTranscription(res.wavBlob, res.durationSeconds);
                                }
                            } catch (e) {
                                console.error("Error finalizing recording on leave:", e);
                            }
                        }

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
            if (remoteScanIntervalRef.current) {
                clearInterval(remoteScanIntervalRef.current);
                remoteScanIntervalRef.current = null;
            }
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

        // Stop and submit recording if active
        if (audioRecorderRef.current?.isRecording) {
            try {
                const res = await audioRecorderRef.current.stop();
                if (res?.wavBlob) {
                    await submitAutoTranscription(res.wavBlob, res.durationSeconds);
                }
            } catch (recErr) {
                console.error("Error stopping recorder on session end:", recErr);
            }
        }

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

    const handleClose = async () => {
        if (audioRecorderRef.current?.isRecording) {
            try {
                const res = await audioRecorderRef.current.stop();
                if (res?.wavBlob) {
                    await submitAutoTranscription(res.wavBlob, res.durationSeconds);
                }
            } catch {}
        }
        roomInstanceRef.current?.hangUp();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="live-session-title"
                className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                Live mentorship · Asia/Kolkata
                            </span>
                            {recorderState.isRecording && (
                                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                    <span>REC {formatDuration(recorderState.durationSeconds)}</span>
                                </span>
                            )}
                        </div>
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
                                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                            >
                                {ending ? "Ending…" : "End session"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                            {joined ? "Leave call" : "Close"}
                        </button>
                    </div>
                </header>

                <div className="overflow-y-auto p-4 sm:p-6 space-y-3">
                    {error && (
                        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            {error}
                        </div>
                    )}
                    {notice && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {notice}
                        </div>
                    )}

                    {/* Dual-Party Consent & AI Transcription Control Bar */}
                    <div className={`rounded-xl border px-4 py-3 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3 ${
                        bothConsented
                            ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                            : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}>
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl">
                                {bothConsented ? "🎙️" : "🛡️"}
                            </span>
                            <div>
                                <div className="font-bold flex items-center gap-2">
                                    <span>
                                        {bothConsented ? "Two-Party Consent Confirmed · Recording Authorized" : "Two-Party Consent Required"}
                                    </span>
                                    {recorderState.isRecording && (
                                        <span className="text-[11px] font-semibold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                                            {recorderState.isDualReady ? "Dual-Track Mixed (Mic + Peer)" : "Local Track Active"}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {bothConsented
                                        ? "Both participants have explicitly consented. The session audio is being recorded for automated Gnani.ai STT & Evon 30B intelligence."
                                        : "SkillSwap adheres to strict two-party recording consent. Recording will not start until both student and mentor consent."
                                    }
                                </p>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <span className={studentConsent ? "text-emerald-600 font-bold" : "text-slate-400"}>
                                            {studentConsent ? "✓ Student Consented" : "○ Student Pending"}
                                        </span>
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <span className={mentorConsent ? "text-emerald-600 font-bold" : "text-slate-400"}>
                                            {mentorConsent ? "✓ Mentor Consented" : "○ Mentor Pending"}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleToggleConsent}
                                disabled={consentUpdating || userConsent}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    userConsent
                                        ? "bg-emerald-600 text-white cursor-default"
                                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                                } disabled:opacity-60`}
                            >
                                {consentUpdating
                                    ? "Recording Consent..."
                                    : userConsent
                                    ? "✓ You Consented"
                                    : "Grant Recording Consent"}
                            </button>
                        </div>
                    </div>

                    {/* Transcription Status Banner (Post-Call) */}
                    {transcriptionStatus && (
                        <div className={`rounded-xl border p-3.5 text-xs flex items-center justify-between gap-2 ${
                            transcriptionStatus === "processing"
                                ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                                : transcriptionStatus === "uploading"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-rose-200 bg-rose-50 text-rose-900"
                        }`}>
                            <div className="flex items-center gap-2">
                                {transcriptionStatus === "uploading" || transcriptionStatus === "processing" ? (
                                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                ) : (
                                    <span className="text-base">❌</span>
                                )}
                                <span>{transcriptionMessage}</span>
                            </div>
                            <span className="font-bold text-[11px] uppercase tracking-wide">
                                {transcriptionStatus}
                            </span>
                        </div>
                    )}

                    {credentials ? (
                        <div
                            ref={roomContainerRef}
                            className="h-[65vh] min-h-[420px] overflow-hidden rounded-xl bg-slate-950 relative"
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
                                        className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                    >
                                        {connecting ? "Connecting…" : "Join live session"}
                                    </button>
                                )}
                                {isMentor && ["waiting", "ongoing"].includes(sessionState?.status) && (
                                    <button
                                        type="button"
                                        onClick={handleEnd}
                                        disabled={ending}
                                        className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
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
