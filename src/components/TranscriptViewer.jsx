import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const LANGUAGE_LABELS = {
    "en-IN": "English (India)",
    "hi-IN": "Hindi",
    "mr-IN": "Marathi",
    "indic-auto": "Indic Auto-detected"
};

function formatLanguageName(code) {
    if (!code) return "English (en-IN)";
    return LANGUAGE_LABELS[code] ? `${LANGUAGE_LABELS[code]} (${code})` : code;
}

export default function TranscriptViewer({ bookingId, initialTranscript, onRefresh }) {
    const [transcriptData, setTranscriptData] = useState(initialTranscript || null);
    const [loading, setLoading] = useState(!initialTranscript);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchTranscript = async () => {
        if (!bookingId) return;

        try {
            setLoading(true);
            setError(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setError("Please sign in to view this session transcript.");
                setLoading(false);
                return;
            }

            const response = await fetch(`http://localhost:5000/bookings/${bookingId}/transcript`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status === 404) {
                setTranscriptData(null);
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load session transcript");
            }

            setTranscriptData(data);
        } catch (err) {
            console.error("Failed to fetch transcript:", err);
            setError(err.message || "Failed to load session transcript");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialTranscript) {
            setTranscriptData(initialTranscript);
            setLoading(false);
        } else {
            fetchTranscript();
        }
    }, [bookingId, initialTranscript]);

    const handleCopy = () => {
        if (!transcriptData?.transcript_text) return;
        navigator.clipboard.writeText(transcriptData.transcript_text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!transcriptData?.transcript_text) return;
        const element = document.createElement("a");
        const file = new Blob([transcriptData.transcript_text], { type: "text/plain;charset=utf-8" });
        element.href = URL.createObjectURL(file);
        element.download = `SkillSwap_Transcript_${bookingId.slice(0, 8)}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-xs text-center space-y-3">
                <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-[#718096] font-medium">Loading session transcript...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-xs text-center space-y-3">
                <div className="text-3xl">⚠️</div>
                <h4 className="font-bold text-rose-800 text-sm">Unable to Load Transcript</h4>
                <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
                <button
                    type="button"
                    onClick={fetchTranscript}
                    className="text-xs font-semibold bg-[#4F46E5] text-white px-4 py-2 rounded-xl hover:bg-[#4338CA] transition-colors cursor-pointer"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!transcriptData) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-xs text-center space-y-2">
                <div className="text-4xl">📝</div>
                <h4 className="font-bold text-[#172033] text-sm">No Transcript Available</h4>
                <p className="text-xs text-[#718096] max-w-sm mx-auto">
                    No audio recording has been transcribed for this session yet. Upload an audio recording above to generate an instant transcript.
                </p>
            </div>
        );
    }

    if (transcriptData.status === "processing") {
        return (
            <div className="bg-indigo-50/50 rounded-2xl p-8 border border-indigo-100 shadow-xs text-center space-y-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <h4 className="font-bold text-indigo-900 text-sm">Transcription in Progress</h4>
                <p className="text-xs text-indigo-700">
                    Gnani.ai Vachana STT is processing the session audio. Click refresh in a moment to view the generated transcript.
                </p>
                <button
                    type="button"
                    onClick={fetchTranscript}
                    className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Refresh Status
                </button>
            </div>
        );
    }

    if (transcriptData.status === "failed") {
        return (
            <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                    <span>❌</span>
                    <span>Transcription Failed</span>
                </div>
                <p className="text-xs text-rose-700">
                    {transcriptData.error_message || "The speech-to-text service encountered an error while processing the audio."}
                </p>
                <p className="text-xs text-slate-500">
                    You can re-upload a clear audio recording under 30 seconds to try again.
                </p>
            </div>
        );
    }

    // Success State ('completed')
    return (
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs space-y-4">
            {/* Header with metadata badges */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        ✓ Transcribed (Gnani.ai)
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        🌐 {formatLanguageName(transcriptData.language || transcriptData.detected_language)}
                    </span>
                    {transcriptData.audio_duration_seconds && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            ⏱️ {transcriptData.audio_duration_seconds}s
                        </span>
                    )}
                    {transcriptData.safety_moderation && (
                        <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                transcriptData.safety_moderation.is_safe
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                        >
                            <span>{transcriptData.safety_moderation.is_safe ? "🛡️ Safety: Clean" : "⚠️ Safety: Flagged"}</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <span>{copied ? "✓ Copied!" : "📋 Copy"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <span>💾 Download .txt</span>
                    </button>
                </div>
            </div>

            {/* Transcript Text Body */}
            <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 max-h-80 overflow-y-auto">
                <p className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap select-text">
                    {transcriptData.transcript_text}
                </p>
            </div>

            {/* AI Safety & Moderation Status Banner */}
            {transcriptData.safety_moderation ? (
                <div
                    className={`rounded-xl p-3 border flex items-center justify-between text-xs flex-wrap gap-2 ${
                        transcriptData.safety_moderation.is_safe
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                            : "bg-amber-50/80 border-amber-200 text-amber-900"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base">
                            {transcriptData.safety_moderation.is_safe ? "🛡️" : "⚠️"}
                        </span>
                        <div>
                            <span className="font-bold">
                                {transcriptData.safety_moderation.is_safe
                                    ? "AI Safety Verified"
                                    : "Safety Review Flagged"}
                            </span>
                            <span className="text-slate-600 ml-1.5 font-normal">
                                {transcriptData.safety_moderation.is_safe
                                    ? "No policy violations or inappropriate content detected."
                                    : `${transcriptData.safety_moderation.flags_count} item(s) flagged for human admin review.`}
                            </span>
                        </div>
                    </div>
                    <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            transcriptData.safety_moderation.is_safe
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-800"
                        }`}
                    >
                        {transcriptData.safety_moderation.is_safe ? "Passed" : "Under Review"}
                    </span>
                </div>
            ) : (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span>AI Safety & Moderation Analysis Enabled</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Active
                    </span>
                </div>
            )}
        </div>
    );
}

