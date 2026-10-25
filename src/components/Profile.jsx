import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getInitials(name) {
    if (!name || typeof name !== "string") return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Profile({ onNavigate }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            try {
                const {
                    data: { session },
                    error: sessionError
                } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error("Supabase session error:", sessionError.message);
                    setLoading(false);
                    return;
                }

                if (!session?.access_token) {
                    console.error("No active Supabase session found.");
                    setLoading(false);
                    return;
                }

                const response = await fetch("http://localhost:5000/profile", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });
                const data = await response.json();

                if (!response.ok) {
                    console.error("Profile request failed:", data.error);
                } else {
                    setProfile(data.profile);
                }
            } catch (err) {
                console.error("Profile load error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const targetDashboard = profile?.role === "mentor" ? "mentorDashboard" : "menteeDashboard";

    return (
        <div className="min-h-screen bg-[#F5F7FC]">
            <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div>
                    <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
                        <span>My Profile</span>
                        <span className="text-sm">👤</span>
                    </h1>
                    <p className="text-xs text-[#718096] mt-0.5">
                        Manage your account information
                    </p>
                </div>

                <button
                    onClick={() => onNavigate ? onNavigate(targetDashboard) : window.history.back()}
                    className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#EEF0FF] hover:text-[#4F46E5] text-[#172033] rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#E5E7EB]"
                >
                    ← Back to Dashboard
                </button>
            </header>

            <main className="p-6 max-w-4xl mx-auto">
                {loading ? (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6 animate-pulse flex items-center gap-4">
                            <div className="w-16 h-16 bg-slate-200 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <div className="h-5 bg-slate-200 rounded w-1/3" />
                                <div className="h-4 bg-slate-100 rounded w-1/4" />
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6 animate-pulse space-y-4">
                            <div className="h-5 bg-slate-200 rounded w-1/4 mb-4" />
                            <div className="grid sm:grid-cols-2 gap-5">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                                        <div className="h-4 bg-slate-200 rounded w-2/3" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : profile ? (
                <>
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-[#4F46E5] text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                                {getInitials(profile.name)}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-[#172033]">
                                    {profile.name}
                                </h2>
                                <p className="text-sm text-[#718096] mt-0.5">
                                    {profile.dept || "Department"} ·{" "}
                                    {profile.student_profiles?.[0]?.semester
                                        ? `${profile.student_profiles[0].semester}th Semester`
                                        : "Semester"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6">
                        <h2 className="font-bold text-[#172033] mb-5 text-lg">
                            Personal Information
                        </h2>

                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">Full Name</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.name || "N/A"}
                                </p>
                            </div>

                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">Email</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.email || "N/A"}
                                </p>
                            </div>

                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">College</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.org || "N/A"}
                                </p>
                            </div>

                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">Department</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.dept || "N/A"}
                                </p>
                            </div>

                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">Phone</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.phone || "N/A"}
                                </p>
                            </div>

                            <div className="bg-[#F5F7FC] p-4 rounded-xl border border-[#E5E7EB]">
                                <p className="text-xs text-[#718096] mb-1 font-medium">Semester</p>
                                <p className="text-sm font-semibold text-[#172033]">
                                    {profile.student_profiles?.[0]?.semester
                                        ? `${profile.student_profiles[0].semester}th Semester`
                                        : "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-10 text-center max-w-md mx-auto">
                    <div className="text-4xl mb-3">👤</div>
                    <h3 className="font-bold text-[#172033] text-lg mb-1">Profile Not Found</h3>
                    <p className="text-sm text-[#718096] mb-6">Unable to load profile data. Please make sure you are signed in.</p>
                    <button
                        onClick={() => onNavigate ? onNavigate("login") : null}
                        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
                    >
                        Sign In Again
                    </button>
                </div>
            )}
        </main>
    </div>
);
};
