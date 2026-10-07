import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const navItems = [
    { id: "dashboard", label: "Overview", icon: "🏠" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "mentors", label: "Mentors", icon: "👨‍🏫" },
    { id: "verification", label: "Verification Queue", icon: "✅" },
    { id: "bookings", label: "Bookings", icon: "📅" }
];

export default function AdminDashboard({ onNavigate }) {
    const [activeNav, setActiveNav] = useState("dashboard");
    const [authStatus, setAuthStatus] = useState("loading"); // "loading" | "authorized" | "unauthorized" | "unauthenticated"
    const [adminUser, setAdminUser] = useState(null);
    const [sessionToken, setSessionToken] = useState(null);

    // Global stats
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Users tab state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [userRoleFilter, setUserRoleFilter] = useState("all");

    // Mentors tab state
    const [mentors, setMentors] = useState([]);
    const [loadingMentors, setLoadingMentors] = useState(false);
    const [mentorSearch, setMentorSearch] = useState("");
    const [mentorVerifFilter, setMentorVerifFilter] = useState("all");

    // Bookings tab state
    const [bookings, setBookings] = useState([]);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

    // UI Feedback state
    const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'error', text: '' }
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const showFeedback = (text, type = "success") => {
        setFeedbackMessage({ text, type });
        setTimeout(() => {
            setFeedbackMessage(null);
        }, 5000);
    };

    const formatTimeDisplay = (timeValue) => {
        if (!timeValue) return "";
        const parts = timeValue.split(":");
        if (parts.length < 2) return timeValue;
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        if (isNaN(hours)) return timeValue;
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours}:${minutes} ${ampm}`;
    };

    // Authenticate and authorize admin on mount
    const verifyAdmin = useCallback(async () => {
        setAuthStatus("loading");
        try {
            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) {
                setAuthStatus("unauthenticated");
                return;
            }

            const token = session.access_token;
            setSessionToken(token);

            // Verify admin authorization against backend endpoint
            const res = await fetch("http://localhost:5000/admin/stats", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                setAuthStatus("unauthenticated");
                return;
            }

            if (res.status === 403) {
                setAuthStatus("unauthorized");
                return;
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("Admin stats verification failed:", errData.error);
                setAuthStatus("unauthorized");
                return;
            }

            const statsData = await res.json();
            setStats(statsData.stats);
            setAdminUser(session.user);
            setAuthStatus("authorized");
        } catch (err) {
            console.error("Admin verification error:", err);
            setAuthStatus("unauthorized");
        }
    }, []);

    useEffect(() => {
        verifyAdmin();
    }, [verifyAdmin]);

    // Data Fetching functions
    const fetchStats = useCallback(async () => {
        if (!sessionToken) return;
        setLoadingStats(true);
        try {
            const res = await fetch("http://localhost:5000/admin/stats", {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
            }
        } catch (err) {
            console.error("Failed to load admin stats:", err);
        } finally {
            setLoadingStats(false);
        }
    }, [sessionToken]);

    const fetchUsers = useCallback(async () => {
        if (!sessionToken) return;
        setLoadingUsers(true);
        try {
            let url = "http://localhost:5000/admin/users";
            const params = new URLSearchParams();
            if (userRoleFilter && userRoleFilter !== "all") params.append("role", userRoleFilter);
            if (userSearch.trim()) params.append("search", userSearch.trim());
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            } else {
                showFeedback("Failed to load users list", "error");
            }
        } catch (err) {
            console.error("Error fetching users:", err);
            showFeedback("Network error loading users", "error");
        } finally {
            setLoadingUsers(false);
        }
    }, [sessionToken, userRoleFilter, userSearch]);

    const fetchMentors = useCallback(async () => {
        if (!sessionToken) return;
        setLoadingMentors(true);
        try {
            let url = "http://localhost:5000/admin/mentors";
            const params = new URLSearchParams();
            if (mentorVerifFilter === "verified") params.append("verified", "true");
            if (mentorVerifFilter === "unverified") params.append("verified", "false");
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMentors(data.mentors || []);
            } else {
                showFeedback("Failed to load mentors list", "error");
            }
        } catch (err) {
            console.error("Error fetching mentors:", err);
            showFeedback("Network error loading mentors", "error");
        } finally {
            setLoadingMentors(false);
        }
    }, [sessionToken, mentorVerifFilter]);

    const fetchBookings = useCallback(async () => {
        if (!sessionToken) return;
        setLoadingBookings(true);
        try {
            let url = "http://localhost:5000/admin/bookings";
            if (bookingStatusFilter && bookingStatusFilter !== "all") {
                url += `?status=${bookingStatusFilter}`;
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBookings(data.bookings || []);
            } else {
                showFeedback("Failed to load bookings list", "error");
            }
        } catch (err) {
            console.error("Error fetching bookings:", err);
            showFeedback("Network error loading bookings", "error");
        } finally {
            setLoadingBookings(false);
        }
    }, [sessionToken, bookingStatusFilter]);

    // Load data based on active tab
    useEffect(() => {
        if (authStatus !== "authorized" || !sessionToken) return;

        if (activeNav === "dashboard") {
            fetchStats();
        } else if (activeNav === "users") {
            fetchUsers();
        } else if (activeNav === "mentors" || activeNav === "verification") {
            fetchMentors();
        } else if (activeNav === "bookings") {
            fetchBookings();
        }
    }, [activeNav, authStatus, sessionToken, fetchStats, fetchUsers, fetchMentors, fetchBookings]);

    // Mentor verification handler
    const handleVerifyMentor = async (mentorUserId, verifiedStatus, mentorName) => {
        if (!sessionToken) return;
        setActionLoadingId(mentorUserId);
        try {
            const res = await fetch(`http://localhost:5000/admin/mentors/${mentorUserId}/verify`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ verified: verifiedStatus })
            });

            const data = await res.json();
            if (res.ok) {
                showFeedback(
                    `Mentor ${mentorName || "profile"} successfully ${verifiedStatus ? "approved and verified" : "set to unverified"}.`,
                    "success"
                );
                // Refresh mentor list and stats
                fetchMentors();
                fetchStats();
            } else {
                showFeedback(data.error || "Failed to update mentor verification.", "error");
            }
        } catch (err) {
            console.error("Verify mentor error:", err);
            showFeedback("Network error updating verification status.", "error");
        } finally {
            setActionLoadingId(null);
        }
    };

    // Booking status change handler
    const handleUpdateBookingStatus = async (bookingId, newStatus) => {
        if (!sessionToken) return;
        setActionLoadingId(bookingId);
        try {
            const res = await fetch(`http://localhost:5000/admin/bookings/${bookingId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();
            if (res.ok) {
                showFeedback(`Booking status successfully changed to "${newStatus}".`, "success");
                fetchBookings();
                fetchStats();
            } else {
                showFeedback(data.error || "Failed to update booking status.", "error");
            }
        } catch (err) {
            console.error("Update booking error:", err);
            showFeedback("Network error updating booking status.", "error");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        onNavigate("landing");
    };

    // ---------------------------------------------------------------------------
    // RENDER: Loading, Unauthenticated, or Unauthorized Screens
    // ---------------------------------------------------------------------------
    if (authStatus === "loading") {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f8f9ff]">
                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-slate-800">Verifying Admin Access</h2>
                    <p className="text-slate-500 text-sm mt-1">Authenticating credentials with backend...</p>
                </div>
            </div>
        );
    }

    if (authStatus === "unauthenticated") {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f8f9ff] p-4">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-slate-100 max-w-md w-full">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                        🔒
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Authentication Required</h2>
                    <p className="text-slate-500 text-sm mt-2">
                        You must be signed in with an administrator account to view the Admin Dashboard.
                    </p>
                    <div className="mt-6 flex flex-col gap-2.5">
                        <button
                            onClick={() => onNavigate("login")}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm"
                        >
                            Sign In to Admin Account
                        </button>
                        <button
                            onClick={() => onNavigate("landing")}
                            className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2 rounded-xl transition-all text-sm"
                        >
                            Return to Homepage
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (authStatus === "unauthorized") {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f8f9ff] p-4">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-md w-full">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                        ⛔
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                    <p className="text-slate-500 text-sm mt-2">
                        Your account does not possess administrator privileges. Admin operations are restricted to verified administrators.
                    </p>
                    <div className="mt-6 flex flex-col gap-2.5">
                        <button
                            onClick={() => onNavigate("landing")}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl transition-all"
                        >
                            Return to Safe Area
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2 rounded-xl transition-all text-sm"
                        >
                            Sign Out and Switch Account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // RENDER: Full Authorized Admin Dashboard
    // ---------------------------------------------------------------------------
    const pendingMentorsList = mentors.filter((m) => !m.verified);
    const pendingCount = stats?.pendingMentors ?? pendingMentorsList.length;

    return (
        <div className="flex h-screen bg-[#F5F7FC] overflow-hidden">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-[#E5E7EB] flex-col flex-shrink-0">
                <div className="p-5 border-b border-[#E5E7EB]">
                    <button className="flex items-center gap-2" onClick={() => onNavigate("landing")}>
                        <div className="w-8 h-8 bg-[#4F46E5] rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <span className="text-lg font-bold text-[#172033]">SkillSwap</span>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#4F46E5] bg-[#EEF0FF] rounded-lg px-2.5 py-1 inline-flex items-center gap-1 border border-[#EEF0FF]">
                            ⚡ Admin Console
                        </span>
                    </div>
                </div>

                <nav className="flex-1 p-3 overflow-y-auto space-y-1">
                    {navItems.map((item) => {
                        const isActive = activeNav === item.id;
                        return (
                            <button
                                key={item.id}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                    isActive
                                        ? "bg-[#4F46E5] text-white shadow-xs"
                                        : "text-[#718096] hover:bg-[#F5F7FC] hover:text-[#172033]"
                                }`}
                                onClick={() => setActiveNav(item.id)}
                            >
                                <span className="text-base">{item.icon}</span>
                                <span>{item.label}</span>
                                {item.id === "verification" && pendingCount > 0 && (
                                    <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#E5E7EB] flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            AD
                        </div>
                        <div className="truncate">
                            <div className="text-sm font-semibold text-[#172033] truncate">
                                {adminUser?.email || "Admin"}
                            </div>
                            <div className="text-xs text-[#718096] font-medium">System Admin</div>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        title="Sign Out"
                        className="text-[#718096] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        🚪
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-[#E5E7EB] px-6 py-3.5 flex items-center justify-between flex-shrink-0 shadow-xs">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold text-[#172033]">
                            {navItems.find((n) => n.id === activeNav)?.label || "Admin Console"}
                        </h1>
                        {loadingStats && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md animate-pulse">
                                Syncing...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                            onClick={() => onNavigate("landing")}
                        >
                            ← Return to Platform
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </header>

                {/* Banner Notifications */}
                {feedbackMessage && (
                    <div
                        className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                            feedbackMessage.type === "success"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                    >
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{feedbackMessage.type === "success" ? "✓" : "⚠"}</span>
                            <span>{feedbackMessage.text}</span>
                        </div>
                        <button
                            onClick={() => setFeedbackMessage(null)}
                            className="text-xs opacity-60 hover:opacity-100 font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Content Pages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {/* ------------------------------------------------------------- */}
                    {/* SECTION 1: OVERVIEW / DASHBOARD */}
                    {/* ------------------------------------------------------------- */}
                    {activeNav === "dashboard" && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Platform Overview</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        Live database metrics and operational summary
                                    </p>
                                </div>
                                <button
                                    onClick={fetchStats}
                                    className="self-start text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 transition-colors shadow-sm"
                                >
                                    🔄 Refresh Statistics
                                </button>
                            </div>

                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                                <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs">
                                    <div className="w-9 h-9 bg-[#EEF0FF] text-[#4F46E5] rounded-xl flex items-center justify-center text-xl mb-3">
                                        🎓
                                    </div>
                                    <div className="text-2xl font-bold text-[#172033]">
                                        {stats?.totalStudents ?? 0}
                                    </div>
                                    <div className="text-[#718096] text-xs font-medium mt-0.5">Total Students</div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs">
                                    <div className="w-9 h-9 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center text-xl mb-3">
                                        👨‍🏫
                                    </div>
                                    <div className="text-2xl font-bold text-[#172033]">
                                        {stats?.totalMentors ?? 0}
                                    </div>
                                    <div className="text-[#718096] text-xs font-medium mt-0.5">Total Mentors</div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs">
                                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl mb-3">
                                        ✓
                                    </div>
                                    <div className="text-2xl font-bold text-[#172033]">
                                        {stats?.verifiedMentors ?? 0}
                                    </div>
                                    <div className="text-[#718096] text-xs font-medium mt-0.5">Verified Mentors</div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-amber-300 transition-colors"
                                    onClick={() => setActiveNav("verification")}>
                                    <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl mb-3">
                                        ⏳
                                    </div>
                                    <div className="text-2xl font-bold text-[#172033]">
                                        {stats?.pendingMentors ?? 0}
                                    </div>
                                    <div className="text-[#718096] text-xs font-medium mt-0.5">Pending Approval</div>
                                    <div className="text-amber-600 text-xs font-semibold mt-1">Review queue →</div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#4F46E5]/40 transition-colors"
                                    onClick={() => setActiveNav("bookings")}>
                                    <div className="w-9 h-9 bg-[#EEF0FF] text-[#4F46E5] rounded-xl flex items-center justify-center text-xl mb-3">
                                        📅
                                    </div>
                                    <div className="text-2xl font-bold text-[#172033]">
                                        {stats?.totalBookings ?? 0}
                                    </div>
                                    <div className="text-[#718096] text-xs font-medium mt-0.5">Total Bookings</div>
                                    <div className="text-[#4F46E5] text-xs font-semibold mt-1">Manage bookings →</div>
                                </div>
                            </div>

                            {/* Bookings Status Breakdown & Skills Distribution */}
                            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                                {/* Bookings Status Distribution */}
                                <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
                                    <h3 className="font-bold text-[#172033] mb-4 flex items-center justify-between">
                                        <span>📅 Bookings Status Breakdown</span>
                                        <button
                                            onClick={() => setActiveNav("bookings")}
                                            className="text-xs text-indigo-600 hover:underline font-semibold"
                                        >
                                            View all
                                        </button>
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                                            <div className="text-lg font-bold text-amber-800">
                                                {stats?.pendingBookings ?? 0}
                                            </div>
                                            <div className="text-xs text-amber-600 font-medium">Pending</div>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                                            <div className="text-lg font-bold text-emerald-800">
                                                {stats?.confirmedBookings ?? 0}
                                            </div>
                                            <div className="text-xs text-emerald-600 font-medium">Confirmed</div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                                            <div className="text-lg font-bold text-blue-800">
                                                {stats?.completedBookings ?? 0}
                                            </div>
                                            <div className="text-xs text-blue-600 font-medium">Completed</div>
                                        </div>
                                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                                            <div className="text-lg font-bold text-rose-800">
                                                {stats?.cancelledBookings ?? 0}
                                            </div>
                                            <div className="text-xs text-rose-600 font-medium">Cancelled/Declined</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Real Mentor Skills Distribution */}
                                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4">🎯 Top Mentor Skills</h3>
                                    {stats?.topSkills && stats.topSkills.length > 0 ? (
                                        <div className="space-y-3">
                                            {stats.topSkills.map((s, idx) => {
                                                const maxCount = stats.topSkills[0]?.count || 1;
                                                const percent = Math.round((s.count / maxCount) * 100);
                                                return (
                                                    <div key={s.skill}>
                                                        <div className="flex items-center justify-between text-sm mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 text-xs font-mono w-4">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="font-medium text-slate-700">
                                                                    {s.skill}
                                                                </span>
                                                            </div>
                                                            <span className="font-bold text-slate-800">
                                                                {s.count} mentor{s.count > 1 ? "s" : ""}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-sm py-4 text-center">
                                            No skills registered yet across mentor profiles.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SECTION 2: USERS TAB */}
                    {/* ------------------------------------------------------------- */}
                    {activeNav === "users" && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        View and manage registered platform accounts ({users.length} users)
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, org..."
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                                        className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 w-64 shadow-sm"
                                    />
                                    <select
                                        value={userRoleFilter}
                                        onChange={(e) => setUserRoleFilter(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="all">All Roles</option>
                                        <option value="student">Students</option>
                                        <option value="mentor">Mentors</option>
                                        <option value="admin">Administrators</option>
                                    </select>
                                    <button
                                        onClick={fetchUsers}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
                                    >
                                        Filter
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {loadingUsers ? (
                                    <div className="p-12 text-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">Loading users from database...</p>
                                    </div>
                                ) : users.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <div className="text-4xl mb-2">👥</div>
                                        <p className="font-semibold text-slate-600">No users found</p>
                                        <p className="text-sm">Try broadening your search or role filter.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    {["User", "Role", "Organization / College", "Department", "Phone"].map(
                                                        (h) => (
                                                            <th
                                                                key={h}
                                                                className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                                                            >
                                                                {h}
                                                            </th>
                                                        )
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {users.map((u) => {
                                                    const roleBadge =
                                                        u.role === "admin"
                                                            ? "bg-amber-100 text-amber-800 border-amber-200"
                                                            : u.role === "mentor"
                                                            ? "bg-violet-100 text-violet-800 border-violet-200"
                                                            : "bg-blue-100 text-blue-800 border-blue-200";

                                                    return (
                                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                                                                        {(u.name || "U").slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-slate-800 text-sm">
                                                                            {u.name || "Unnamed"}
                                                                        </div>
                                                                        <div className="text-slate-400 text-xs">
                                                                            {u.email}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${roleBadge}`}
                                                                >
                                                                    {u.role || "student"}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {u.org || "—"}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {u.dept || "—"}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-500">
                                                                {u.phone || "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SECTION 3: MENTORS TAB */}
                    {/* ------------------------------------------------------------- */}
                    {activeNav === "mentors" && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Mentors Directory</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        All mentor profiles and verification statuses ({mentors.length} mentors)
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <input
                                        type="text"
                                        placeholder="Filter by name, skills, org..."
                                        value={mentorSearch}
                                        onChange={(e) => setMentorSearch(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 w-56 shadow-sm"
                                    />
                                    <select
                                        value={mentorVerifFilter}
                                        onChange={(e) => setMentorVerifFilter(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="all">All Verification Statuses</option>
                                        <option value="verified">Verified Only</option>
                                        <option value="unverified">Unverified Only</option>
                                    </select>
                                    <button
                                        onClick={fetchMentors}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {loadingMentors ? (
                                    <div className="p-12 text-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">Loading mentors from database...</p>
                                    </div>
                                ) : mentors.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <div className="text-4xl mb-2">👨‍🏫</div>
                                        <p className="font-semibold text-slate-600">No mentors found</p>
                                        <p className="text-sm">Try adjusting your filters.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    {["Mentor", "Type", "Experience", "Organization", "Skills", "Status"].map(
                                                        (h) => (
                                                            <th
                                                                key={h}
                                                                className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                                                            >
                                                                {h}
                                                            </th>
                                                        )
                                                    )}
                                                    <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        Verification Action
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {mentors
                                                    .filter((m) => {
                                                        if (!mentorSearch.trim()) return true;
                                                        const s = mentorSearch.toLowerCase();
                                                        return (
                                                            m.name?.toLowerCase().includes(s) ||
                                                            m.org?.toLowerCase().includes(s) ||
                                                            (m.skills || []).some((sk) =>
                                                                sk.toLowerCase().includes(s)
                                                            )
                                                        );
                                                    })
                                                    .map((m) => (
                                                        <tr key={m.user_id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                                        {(m.name || "M").slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-slate-800 text-sm">
                                                                            {m.name || "Mentor"}
                                                                        </div>
                                                                        <div className="text-slate-400 text-xs">
                                                                            {m.email}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {m.mentor_type || "General"}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {m.experience ? `${m.experience} yrs` : "—"}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {m.org || "—"}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                                    {(m.skills || []).slice(0, 3).map((sk) => (
                                                                        <span
                                                                            key={sk}
                                                                            className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md"
                                                                        >
                                                                            {sk}
                                                                        </span>
                                                                    ))}
                                                                    {(m.skills || []).length > 3 && (
                                                                        <span className="text-xs text-slate-400">
                                                                            +{m.skills.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                {m.verified ? (
                                                                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                                                        ✓ Verified
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                                                        ⏳ Unverified
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                {m.verified ? (
                                                                    <button
                                                                        disabled={actionLoadingId === m.user_id}
                                                                        onClick={() =>
                                                                            handleVerifyMentor(m.user_id, false, m.name)
                                                                        }
                                                                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                                    >
                                                                        {actionLoadingId === m.user_id ? "Saving..." : "Revoke / Unverify"}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        disabled={actionLoadingId === m.user_id}
                                                                        onClick={() =>
                                                                            handleVerifyMentor(m.user_id, true, m.name)
                                                                        }
                                                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                                    >
                                                                        {actionLoadingId === m.user_id ? "Saving..." : "✓ Approve Verification"}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SECTION 4: MENTOR VERIFICATION QUEUE */}
                    {/* ------------------------------------------------------------- */}
                    {activeNav === "verification" && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Mentor Verification Queue</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        Pending applications requiring administrative review before public listing
                                    </p>
                                </div>
                                <button
                                    onClick={fetchMentors}
                                    className="self-start text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 transition-colors shadow-sm"
                                >
                                    🔄 Refresh Queue
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {loadingMentors ? (
                                    <div className="p-12 text-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">Checking pending verifications...</p>
                                    </div>
                                ) : pendingMentorsList.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                                            🎉
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-lg">Queue Clear!</h3>
                                        <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                                            There are currently no unverified mentor applications pending review.
                                        </p>
                                        <button
                                            onClick={() => setActiveNav("mentors")}
                                            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3.5 py-2 rounded-xl transition-colors"
                                        >
                                            View All Mentors →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    {["Applicant", "Mentor Type", "Organization", "Experience", "Skills", "Bio"].map(
                                                        (h) => (
                                                            <th
                                                                key={h}
                                                                className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                                                            >
                                                                {h}
                                                            </th>
                                                        )
                                                    )}
                                                    <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {pendingMentorsList.map((v) => (
                                                    <tr key={v.user_id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                                    {(v.name || "M").slice(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-800 text-sm">
                                                                        {v.name || "Mentor Applicant"}
                                                                    </div>
                                                                    <div className="text-slate-400 text-xs">
                                                                        {v.email}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-sm text-slate-600">
                                                            {v.mentor_type || "General"}
                                                        </td>
                                                        <td className="px-5 py-4 text-sm text-slate-600">
                                                            {v.org || "—"}
                                                        </td>
                                                        <td className="px-5 py-4 text-sm text-slate-600">
                                                            {v.experience ? `${v.experience} yrs` : "—"}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                                {(v.skills || []).map((sk) => (
                                                                    <span
                                                                        key={sk}
                                                                        className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md"
                                                                    >
                                                                        {sk}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate">
                                                            {v.bio || "—"}
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    disabled={actionLoadingId === v.user_id}
                                                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                                    onClick={() =>
                                                                        handleVerifyMentor(v.user_id, true, v.name)
                                                                    }
                                                                >
                                                                    {actionLoadingId === v.user_id ? "Saving..." : "✓ Approve"}
                                                                </button>
                                                                <button
                                                                    disabled={actionLoadingId === v.user_id}
                                                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                                    onClick={() =>
                                                                        handleVerifyMentor(v.user_id, false, v.name)
                                                                    }
                                                                >
                                                                    {actionLoadingId === v.user_id ? "Saving..." : "✕ Reject"}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* SECTION 5: BOOKINGS MANAGEMENT */}
                    {/* ------------------------------------------------------------- */}
                    {activeNav === "bookings" && (
                        <>
                            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Platform Bookings</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        Monitor and administer mentorship session requests ({bookings.length} bookings)
                                    </p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <select
                                        value={bookingStatusFilter}
                                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="declined">Declined</option>
                                    </select>
                                    <button
                                        onClick={fetchBookings}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
                                    >
                                        Filter
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {loadingBookings ? (
                                    <div className="p-12 text-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">Loading bookings from database...</p>
                                    </div>
                                ) : bookings.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <div className="text-4xl mb-2">📅</div>
                                        <p className="font-semibold text-slate-600">No bookings found</p>
                                        <p className="text-sm">There are no bookings matching the selected status.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    {["Student", "Mentor", "Topic", "Date & Time", "Status", "Change Status"].map(
                                                        (h) => (
                                                            <th
                                                                key={h}
                                                                className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                                                            >
                                                                {h}
                                                            </th>
                                                        )
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {bookings.map((b) => {
                                                    const statusBadge =
                                                        b.status === "confirmed"
                                                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                            : b.status === "completed"
                                                            ? "bg-blue-100 text-blue-800 border-blue-200"
                                                            : b.status === "pending"
                                                            ? "bg-amber-100 text-amber-800 border-amber-200"
                                                            : "bg-rose-100 text-rose-800 border-rose-200";

                                                    return (
                                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="font-semibold text-slate-800 text-sm">
                                                                    {b.student_name}
                                                                </div>
                                                                <div className="text-slate-400 text-xs">
                                                                    {b.student_email}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="font-semibold text-slate-800 text-sm">
                                                                    {b.mentor_name}
                                                                </div>
                                                                <div className="text-slate-400 text-xs">
                                                                    {b.mentor_email}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 text-sm font-medium text-slate-700 max-w-xs">
                                                                {b.topic}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                <div>{b.date}</div>
                                                                <div className="text-xs text-slate-400">
                                                                    {formatTimeDisplay(b.time)}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusBadge}`}
                                                                >
                                                                    {b.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <select
                                                                    disabled={actionLoadingId === b.id}
                                                                    value={b.status}
                                                                    onChange={(e) =>
                                                                        handleUpdateBookingStatus(b.id, e.target.value)
                                                                    }
                                                                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm disabled:opacity-50"
                                                                >
                                                                    <option value="pending">pending</option>
                                                                    <option value="confirmed">confirmed</option>
                                                                    <option value="completed">completed</option>
                                                                    <option value="declined">declined</option>
                                                                    <option value="cancelled">cancelled</option>
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
