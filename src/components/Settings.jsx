import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getInitials(name) {
    if (!name || typeof name !== "string") return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Settings({ onNavigate }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Password change state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState(null);

    // Editable contact preferences (supported by PUT /profile)
    const [editingContact, setEditingContact] = useState(false);
    const [formData, setFormData] = useState({ phone: "", dept: "", org: "" });
    const [savingContact, setSavingContact] = useState(false);
    const [contactFeedback, setContactFeedback] = useState(null);

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            try {
                const {
                    data: { session },
                    error: sessionError
                } = await supabase.auth.getSession();

                if (sessionError || !session?.access_token) {
                    setLoading(false);
                    return;
                }

                const response = await fetch("http://localhost:5000/profile", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.profile) {
                        setProfile(data.profile);
                        setFormData({
                            phone: data.profile.phone || "",
                            dept: data.profile.dept || "",
                            org: data.profile.org || ""
                        });
                    }
                }
            } catch (err) {
                console.error("Settings profile fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordFeedback(null);

        if (!newPassword || newPassword.length < 6) {
            setPasswordFeedback({
                type: "error",
                message: "New password must be at least 6 characters long."
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordFeedback({
                type: "error",
                message: "Passwords do not match. Please verify and try again."
            });
            return;
        }

        try {
            setUpdatingPassword(true);
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw error;
            }

            setPasswordFeedback({
                type: "success",
                message: "Password updated successfully! Your account is secure."
            });
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            console.error("Password update error:", err);
            setPasswordFeedback({
                type: "error",
                message: err.message || "Failed to update password. Please try again."
            });
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleSaveContact = async (e) => {
        e.preventDefault();
        setContactFeedback(null);

        try {
            setSavingContact(true);
            const {
                data: { session }
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setContactFeedback({ type: "error", message: "Session expired. Please sign in again." });
                return;
            }

            const response = await fetch("http://localhost:5000/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    phone: formData.phone.trim(),
                    dept: formData.dept.trim(),
                    org: formData.org.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to update account information.");
            }

            setProfile((prev) => ({
                ...prev,
                phone: formData.phone.trim(),
                dept: formData.dept.trim(),
                org: formData.org.trim()
            }));
            setContactFeedback({ type: "success", message: "Account details updated successfully!" });
            setEditingContact(false);
        } catch (err) {
            console.error("Contact update error:", err);
            setContactFeedback({ type: "error", message: err.message || "Could not save details." });
        } finally {
            setSavingContact(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            onNavigate("landing");
        } catch (err) {
            console.error("Logout error:", err);
            onNavigate("landing");
        }
    };

    const targetDashboard = profile?.role === "mentor" ? "mentorDashboard" : "menteeDashboard";

    return (
        <div className="min-h-screen bg-[#F5F7FC] text-[#172033]">
            {/* Header */}
            <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div>
                    <h1 className="text-xl font-bold text-[#172033] flex items-center gap-2">
                        <span>Account Settings</span>
                        <span className="text-sm">⚙️</span>
                    </h1>
                    <p className="text-xs text-[#718096] mt-0.5">
                        Manage your profile overview and security credentials
                    </p>
                </div>

                <button
                    onClick={() => onNavigate ? onNavigate(targetDashboard) : window.history.back()}
                    className="px-4 py-2 bg-[#F5F7FC] hover:bg-[#EEF0FF] hover:text-[#4F46E5] text-[#172033] rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#E5E7EB] cursor-pointer"
                >
                    ← Back to Dashboard
                </button>
            </header>

            {/* Main Content */}
            <main className="p-6 max-w-4xl mx-auto space-y-6">
                {loading ? (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse flex items-center gap-4">
                            <div className="w-16 h-16 bg-slate-200 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <div className="h-5 bg-slate-200 rounded w-1/3" />
                                <div className="h-4 bg-slate-100 rounded w-1/4" />
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse space-y-4">
                            <div className="h-5 bg-slate-200 rounded w-1/4" />
                            <div className="h-10 bg-slate-100 rounded" />
                        </div>
                    </div>
                ) : profile ? (
                    <>
                        {/* Account Overview Card */}
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-[#4F46E5] text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-xs">
                                        {getInitials(profile.name)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-bold text-[#172033]">
                                                {profile.name}
                                            </h2>
                                            <span className="text-xs font-bold uppercase tracking-wider bg-[#EEF0FF] text-[#4F46E5] px-2.5 py-0.5 rounded-full border border-[#EEF0FF]">
                                                {profile.role || "User"}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[#718096] mt-0.5">
                                            {profile.email}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {profile.role === "student" && (
                                        <button
                                            onClick={() => onNavigate("menteeRequirements")}
                                            className="px-3.5 py-2 bg-[#EEF0FF] hover:bg-[#E0E4FF] text-[#4F46E5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                                        >
                                            📝 Edit Requirements
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onNavigate("profile")}
                                        className="px-3.5 py-2 bg-[#F5F7FC] hover:bg-[#E5E7EB] text-[#172033] text-xs font-semibold rounded-xl transition-colors border border-[#E5E7EB] cursor-pointer"
                                    >
                                        👤 View Full Profile
                                    </button>
                                </div>
                            </div>

                            {/* Contact Details Grid / Inline Edit */}
                            <div className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-sm text-[#172033]">
                                        Account Information
                                    </h3>
                                    {!editingContact ? (
                                        <button
                                            onClick={() => setEditingContact(true)}
                                            className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                                        >
                                            ✏️ Edit Contact Info
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingContact(false);
                                                setContactFeedback(null);
                                            }}
                                            className="text-xs font-semibold text-[#718096] hover:underline cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>

                                {contactFeedback && (
                                    <div
                                        className={`mb-4 p-3 rounded-xl text-xs font-medium border ${
                                            contactFeedback.type === "success"
                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                : "bg-rose-50 text-rose-800 border-rose-200"
                                        }`}
                                    >
                                        {contactFeedback.message}
                                    </div>
                                )}

                                {!editingContact ? (
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                Full Name
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033]">
                                                {profile.name || "N/A"}
                                            </p>
                                        </div>

                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                Email Address
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033]">
                                                {profile.email || "N/A"}
                                            </p>
                                        </div>

                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                Role
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033] capitalize">
                                                {profile.role || "N/A"}
                                            </p>
                                        </div>

                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                College / Organization
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033]">
                                                {profile.org || "N/A"}
                                            </p>
                                        </div>

                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                Department
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033]">
                                                {profile.dept || "N/A"}
                                            </p>
                                        </div>

                                        <div className="bg-[#F5F7FC] p-3.5 rounded-xl border border-[#E5E7EB]">
                                            <p className="text-[11px] font-medium text-[#718096] uppercase tracking-wider mb-0.5">
                                                Phone
                                            </p>
                                            <p className="text-sm font-semibold text-[#172033]">
                                                {profile.phone || "Not provided"}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSaveContact} className="space-y-4">
                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-[#172033] mb-1">
                                                    College / Organization
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.org}
                                                    onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                                                    placeholder="e.g. Stanford University"
                                                    className="w-full px-3.5 py-2 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-[#172033] mb-1">
                                                    Department
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.dept}
                                                    onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                                                    placeholder="e.g. Computer Science"
                                                    className="w-full px-3.5 py-2 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-[#172033] mb-1">
                                                    Phone Number
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    placeholder="e.g. +1 555-0199"
                                                    className="w-full px-3.5 py-2 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 pt-2">
                                            <button
                                                type="submit"
                                                disabled={savingContact}
                                                className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {savingContact ? "Saving..." : "Save Changes"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingContact(false)}
                                                className="px-4 py-2 bg-[#F5F7FC] hover:bg-slate-200 text-[#172033] text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-[#E5E7EB]"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Security Card */}
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6 space-y-6">
                            <div>
                                <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
                                    <span>Security & Credentials</span>
                                    <span className="text-sm">🔒</span>
                                </h2>
                                <p className="text-xs text-[#718096] mt-0.5">
                                    Update your password directly through Supabase authentication
                                </p>
                            </div>

                            {/* Password Change Form */}
                            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                                {passwordFeedback && (
                                    <div
                                        className={`p-3 rounded-xl text-xs font-medium border ${
                                            passwordFeedback.type === "success"
                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                : "bg-rose-50 text-rose-800 border-rose-200"
                                        }`}
                                    >
                                        {passwordFeedback.message}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password (min. 6 characters)"
                                        className="w-full px-3.5 py-2.5 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#172033] mb-1">
                                        Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat new password"
                                        className="w-full px-3.5 py-2.5 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#4F46E5] focus:bg-white transition-all"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={updatingPassword || !newPassword}
                                    className="px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                >
                                    {updatingPassword ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            <span>Updating Password...</span>
                                        </>
                                    ) : (
                                        <span>Update Password</span>
                                    )}
                                </button>
                            </form>

                            {/* Session / Logout Section */}
                            <div className="pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-semibold text-sm text-[#172033]">
                                        Active Session
                                    </h3>
                                    <p className="text-xs text-[#718096] mt-0.5">
                                        Signed in as <strong className="text-[#172033]">{profile.email}</strong>
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition-colors border border-rose-200/60 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                    <span>🚪</span>
                                    <span>Log Out</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center max-w-md mx-auto">
                        <div className="text-4xl mb-3">⚙️</div>
                        <h3 className="font-bold text-[#172033] text-lg mb-1">Session Required</h3>
                        <p className="text-sm text-[#718096] mb-6">
                            Please sign in to view and manage your account settings.
                        </p>
                        <button
                            onClick={() => onNavigate("login")}
                            className="bg-[#4F46E5] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338CA] transition-colors cursor-pointer"
                        >
                            Sign In
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
