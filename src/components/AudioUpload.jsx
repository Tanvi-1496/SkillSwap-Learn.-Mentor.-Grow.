import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

const SUPPORTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_DURATION_SECONDS = 30.0;

const LANGUAGE_OPTIONS = [
    { code: "indic-auto", label: "Auto-detect (Indic & English)", hint: "Recommended" },
    { code: "en-IN", label: "English (India)", hint: "Direct Model" },
    { code: "hi-IN", label: "Hindi", hint: "Direct Model" },
    { code: "mr-IN", label: "Marathi", hint: "Direct Model" },
    { code: "en-IN,hi-IN", label: "English + Hindi", hint: "Code-mixed" },
    { code: "en-IN,mr-IN", label: "English + Marathi", hint: "Code-mixed" }
];

export default function AudioUpload({ booking, currentUser, onUploadSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [detectedDuration, setDetectedDuration] = useState(null);
    const [durationError, setDurationError] = useState(null);

    // Consent states
    const [studentConsent, setStudentConsent] = useState(false);
    const [mentorConsent, setMentorConsent] = useState(false);
    const [bothConsented, setBothConsented] = useState(false);
    const [userConsentChecked, setUserConsentChecked] = useState(false);
    const [savingConsent, setSavingConsent] = useState(false);

    // Upload & processing states
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState("indic-auto");
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const fileInputRef = useRef(null);

    const isStudent = currentUser?.id === booking?.student_id;
    const isMentor = currentUser?.id === booking?.mentor_id;
    const isAdmin = currentUser?.role === "admin";

    // Load initial consent and transcript status
    const fetchConsentStatus = async () => {
        if (!booking?.id) return;
        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const res = await fetch(`https://skillswap-backend-8g8p.onrender.com/bookings/${booking.id}/transcript`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setStudentConsent(!!data.student_consent);
                setMentorConsent(!!data.mentor_consent);
                setBothConsented(!!data.consent_confirmed || (!!data.student_consent && !!data.mentor_consent));
                if (isStudent && data.student_consent) setUserConsentChecked(true);
                if (isMentor && data.mentor_consent) setUserConsentChecked(true);
            }
        } catch (err) {
            console.warn("Could not fetch consent status:", err);
        }
    };

    useEffect(() => {
        fetchConsentStatus();
    }, [booking?.id]);

    // Handle File Selection
    const handleFileSelect = (file) => {
        setErrorMessage(null);
        setSuccessMessage(null);
        setDurationError(null);

        if (!file) return;

        const fileName = file.name.toLowerCase();
        const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

        if (!hasValidExt) {
            setErrorMessage(
                `Unsupported audio format. Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG.`
            );
            setSelectedFile(null);
            setPreviewUrl(null);
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setErrorMessage("Audio file exceeds the maximum size limit of 25 MB.");
            setSelectedFile(null);
            setPreviewUrl(null);
            return;
        }

        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    // Extract audio duration using HTML5 Audio metadata
    const handleAudioLoadedMetadata = (e) => {
        const duration = e.target.duration;
        if (!isNaN(duration) && isFinite(duration)) {
            const rounded = Math.round(duration * 10) / 10;
            setDetectedDuration(rounded);
            if (rounded > MAX_DURATION_SECONDS) {
                setDurationError(
                    `Audio duration (${rounded}s) exceeds the maximum allowed 30 seconds for instant transcription. Please choose a clip under 30 seconds.`
                );
            } else {
                setDurationError(null);
            }
        }
    };

    // Explicitly grant & record consent for the current participant
    const handleGrantConsent = async () => {
        try {
            setSavingConsent(true);
            setErrorMessage(null);

            const {
                data: { session }
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                setErrorMessage("Please log in to record consent.");
                return;
            }

            const res = await fetch(`https://skillswap-backend-8g8p.onrender.com/bookings/${booking.id}/consent`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to record consent");
            }

            setStudentConsent(!!data.student_consent);
            setMentorConsent(!!data.mentor_consent);
            setBothConsented(!!data.both_consented);
            setUserConsentChecked(true);
            setSuccessMessage(data.message || "Your consent has been recorded.");
        } catch (err) {
            setErrorMessage(err.message || "Failed to record consent");
        } finally {
            setSavingConsent(false);
        }
    };

    // Submit Audio & Trigger Gnani STT
    const handleUploadAndTranscribe = async () => {
        if (!selectedFile) {
            setErrorMessage("Please select an audio file first.");
            return;
        }

        if (durationError) {
            setErrorMessage(durationError);
            return;
        }

        if (!bothConsented && !isAdmin) {
            setErrorMessage(
                "Two-party consent requirement not met. Both student and mentor must consent before transcription can proceed."
            );
            return;
        }

        try {
            setUploading(true);
            setErrorMessage(null);
            setSuccessMessage(null);
            setUploadProgress("Uploading audio stream to server...");

            const {
                data: { session }
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                throw new Error("Authentication session expired. Please sign in again.");
            }

            const formData = new FormData();
            formData.append("audio", selectedFile);
            formData.append("consent", "true");
            formData.append("language_code", selectedLanguage || "indic-auto");
            if (detectedDuration) {
                formData.append("duration", detectedDuration.toString());
            }

            setUploadProgress("Transcribing audio with Gnani.ai Prisma v3.0...");

            const response = await fetch(`https://skillswap-backend-8g8p.onrender.com/bookings/${booking.id}/audio`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to transcribe audio session");
            }

            setSuccessMessage("Transcription completed successfully!");
            setUploadProgress(null);

            if (onUploadSuccess) {
                onUploadSuccess(data);
            }
        } catch (err) {
            console.error("Transcription upload error:", err);
            setErrorMessage(err.message || "Failed to upload and transcribe audio");
            setUploadProgress(null);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs space-y-6">
            <div>
                <h3 className="font-bold text-[#172033] text-base flex items-center gap-2">
                    <span>🎙️</span>
                    <span>Upload Session Recording (Gnani.ai STT)</span>
                </h3>
                <p className="text-xs text-[#718096] mt-1">
                    Upload a completed audio recording of your mentorship session (max 30 seconds, up to 25 MB). Supported formats: WAV, MP3, M4A, AAC, FLAC, OGG.
                </p>
            </div>

            {/* Two-Party Consent Section */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Two-Party Consent Status
                    </span>
                    <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            bothConsented || isAdmin
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                        }`}
                    >
                        {bothConsented || isAdmin ? "✓ Fully Authorized" : "⏳ Consent Pending"}
                    </span>
                </div>

                <p className="text-xs text-slate-600">
                    To comply with privacy regulations, <strong>both the student and the mentor</strong> must provide verified consent before session audio can be transcribed.
                </p>

                {/* Consent Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-slate-200">
                        <span className="text-slate-600 font-medium">Student Consent:</span>
                        <span
                            className={`font-semibold ${
                                studentConsent ? "text-emerald-700" : "text-amber-600"
                            }`}
                        >
                            {studentConsent ? "✓ Granted" : "⏳ Waiting"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-slate-200">
                        <span className="text-slate-600 font-medium">Mentor Consent:</span>
                        <span
                            className={`font-semibold ${
                                mentorConsent ? "text-emerald-700" : "text-amber-600"
                            }`}
                        >
                            {mentorConsent ? "✓ Granted" : "⏳ Waiting"}
                        </span>
                    </div>
                </div>

                {/* Grant Consent Action for Current User */}
                {!bothConsented && !isAdmin && (
                    <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium select-none">
                            <input
                                type="checkbox"
                                checked={userConsentChecked}
                                onChange={(e) => setUserConsentChecked(e.target.checked)}
                                className="w-4 h-4 text-[#4F46E5] rounded focus:ring-[#4F46E5]"
                            />
                            <span>
                                I ({isStudent ? "Student" : isMentor ? "Mentor" : "Participant"}) explicitly consent to recording and transcribing this session.
                            </span>
                        </label>
                        <button
                            type="button"
                            disabled={!userConsentChecked || savingConsent || (isStudent && studentConsent) || (isMentor && mentorConsent)}
                            onClick={handleGrantConsent}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {savingConsent ? "Saving..." : (isStudent && studentConsent) || (isMentor && mentorConsent) ? "✓ Consent Saved" : "Confirm My Consent"}
                        </button>
                    </div>
                )}
            </div>

            {/* Audio File Selection Zone */}
            <div className="space-y-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,audio/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />

                {!selectedFile ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20"
                    >
                        <div className="text-3xl mb-2">📁</div>
                        <p className="text-sm font-semibold text-slate-800">
                            Click to browse or drop session audio here
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            WAV, MP3, M4A, AAC, FLAC, OGG · Max 30 seconds · Up to 25 MB
                        </p>
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-xl">🎵</span>
                                <div className="truncate">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                        {detectedDuration ? ` · ${detectedDuration}s duration` : ""}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                    setDetectedDuration(null);
                                    setDurationError(null);
                                }}
                                className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded transition-colors"
                            >
                                Change
                            </button>
                        </div>

                        {/* Audio preview player & metadata detector */}
                        {previewUrl && (
                            <audio
                                src={previewUrl}
                                controls
                                onLoadedMetadata={handleAudioLoadedMetadata}
                                className="w-full h-8 mt-2"
                            />
                        )}

                        {durationError && (
                            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                                ⚠️ {durationError}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Language Selection Section (Prisma v3.0) */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                    <label htmlFor="language-select" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span>🌐</span>
                        <span>Spoken Language / Mode</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-2 py-0.5 rounded">
                        Prisma v3.0
                    </span>
                </div>
                <select
                    id="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
                >
                    {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                            {opt.label} ({opt.hint})
                        </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500">
                    Auto-detect works across all supported Indic languages and English. Choose Code-mixed for bilingual mentorship sessions.
                </p>
            </div>

            {/* Error & Feedback Messages */}
            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
                    <span>⚠️</span>
                    <span className="flex-1">{errorMessage}</span>
                </div>
            )}

            {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
                    <span>✓</span>
                    <span className="flex-1">{successMessage}</span>
                </div>
            )}

            {/* Upload Button */}
            <button
                type="button"
                disabled={uploading || !selectedFile || !!durationError || (!bothConsented && !isAdmin)}
                onClick={handleUploadAndTranscribe}
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
                {uploading ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{uploadProgress || "Processing with Gnani.ai..."}</span>
                    </>
                ) : (
                    <>
                        <span>🚀</span>
                        <span>Transcribe Session Audio</span>
                    </>
                )}
            </button>
        </div>
    );
}

