import { useState } from "react";
import AudioUpload from "./AudioUpload";
import TranscriptViewer from "./TranscriptViewer";

export default function SessionDetailsModal({ booking, currentUser, onClose, onBookingUpdated }) {
    const [activeTab, setActiveTab] = useState("transcript");
    const [latestTranscript, setLatestTranscript] = useState(null);

    if (!booking) return null;

    const isCompleted = booking.status === "completed";
    const isConfirmed = booking.status === "confirmed";

    const handleUploadSuccess = (transcriptResult) => {
        setLatestTranscript(transcriptResult);
        setActiveTab("transcript");
        if (onBookingUpdated) {
            onBookingUpdated();
        }
    };

    return (
        <div className="fixed inset-0 bg-[#172033]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E5E7EB] my-8 space-y-6">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                                Mentorship Session
                            </span>
                            <span
                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                    isCompleted
                                        ? "bg-slate-100 text-slate-700"
                                        : isConfirmed
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                }`}
                            >
                                {booking.status}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-[#172033] leading-snug">
                            {booking.topic || "Mentorship Session"}
                        </h2>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#718096] mt-2">
                            <span>📅 {booking.date}</span>
                            <span>🕐 {booking.time}</span>
                            <span>👨‍🏫 Mentor: {booking.mentor_name || "Mentor"}</span>
                            <span>👤 Student: {booking.student_name || "Student"}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                        title="Close modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("transcript")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            activeTab === "transcript"
                                ? "bg-white text-indigo-600 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        📝 Session Transcript
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            activeTab === "upload"
                                ? "bg-white text-indigo-600 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        🎙️ Upload Audio & Consent
                    </button>
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === "transcript" && (
                        <TranscriptViewer
                            bookingId={booking.id}
                            initialTranscript={latestTranscript}
                        />
                    )}

                    {activeTab === "upload" && (
                        <AudioUpload
                            booking={booking}
                            currentUser={currentUser}
                            onUploadSuccess={handleUploadSuccess}
                        />
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

