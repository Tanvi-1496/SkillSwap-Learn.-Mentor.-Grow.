
import { useState } from "react";
import Landing from "./components/Landing";
import Auth from "./components/Auth";
import MenteeDashboard from "./components/MenteeDashboard";
import AIRecommendations from "./components/AIRecommendations";
import MentorProfile from "./components/MentorProfile";
import BookingFlow from "./components/BookingFlow";
import MyBookings from "./components/MyBookings";
import SearchMentors from "./components/SearchMentors";
import MentorDashboard from "./components/MentorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import Profile from "./components/Profile";
import MenteeRequirements from "./components/MenteeRequirements";
import Feedback from "./components/Feedback";
import Settings from "./components/Settings";
export default function App() {
    const [page, setPage] = useState("landing");
    const [pageData, setPageData] = useState({});
    const [demoNavOpen, setDemoNavOpen] = useState(true);

    const nav = (p, data = {}) => {
        setPageData(data);
        setPage(p);
    };

    const showDevNav = typeof window !== "undefined" && window.location.search.includes("demo=true");

    return (
        <div className="h-full font-[Plus_Jakarta_Sans,system-ui,sans-serif]">
            {/* Optional Dev-only Nav (only enabled via ?demo=true in URL) */}
            {showDevNav && (
                <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] max-w-[95vw]">
                    {demoNavOpen ? (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-900/95 backdrop-blur-md rounded-2xl px-4 py-2 shadow-2xl border border-slate-700">
                            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase mr-1">
                                Dev Nav:
                            </span>
                            {[
                                { label: "Landing", page: "landing" },
                                { label: "Login", page: "login" },
                                { label: "Register", page: "register" },
                                { label: "Dashboard", page: "menteeDashboard" },
                                { label: "AI Recs", page: "aiRecs" },
                                { label: "Mentor Profile", page: "mentorProfile" },
                                { label: "Book", page: "booking" },
                                { label: "Bookings", page: "bookings" },
                                { label: "Search", page: "search" },
                                { label: "Mentor Dash", page: "mentorDashboard" },
                                { label: "Admin", page: "adminDashboard" },
                                { label: "Feedback", page: "feedback" },
                                { label: "Settings", page: "settings" },
                            ].map((item) => (
                                <button
                                    key={item.page}
                                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
                                        page === item.page
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    }`}
                                    onClick={() => nav(item.page)}
                                >
                                    {item.label}
                                </button>
                            ))}
                            <button
                                title="Minimize Dev Bar"
                                onClick={() => setDemoNavOpen(false)}
                                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors ml-1 font-bold"
                            >
                                ▼
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setDemoNavOpen(true)}
                            className="bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md text-amber-400 hover:text-amber-300 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5 transition-all"
                        >
                            ⚡ Dev Navigation ▲
                        </button>
                    )}
                </div>
            )}

            {page === "landing" && <Landing onNavigate={nav} />}
            {page === "login" && <Auth mode="login" onNavigate={nav} />}
            {page === "register" && <Auth mode="register" onNavigate={nav} />}
            {page === "menteeDashboard" && <MenteeDashboard onNavigate={nav} />}
            {page === "aiRecs" && <AIRecommendations onNavigate={nav} />}
            {page === "mentorProfile" && (
                <MentorProfile
                    onNavigate={nav}
                    mentorId={pageData.mentorId}
                    fromPage={pageData.fromPage}
                />
            )}
            {page === "booking" && (
                <BookingFlow
                    onNavigate={nav}
                    mentorId={pageData.mentorId}
                />
            )}
            {page === "bookings" && <MyBookings onNavigate={nav} />}
            {page === "search" && <SearchMentors onNavigate={nav} />}
            {page === "profile" && <Profile onNavigate={nav} />}
            {page === "mentorDashboard" && <MentorDashboard onNavigate={nav} />}
            {page === "adminDashboard" && <AdminDashboard onNavigate={nav} />}
            {page === "menteeRequirements" && <MenteeRequirements onNavigate={nav} />}
            {page === "feedback" && <Feedback onNavigate={nav} />}
            {page === "settings" && <Settings onNavigate={nav} />}
            {![
                "landing",
                "login",
                "register",
                "menteeDashboard",
                "aiRecs",
                "mentorProfile",
                "booking",
                "bookings",
                "search",
                "profile",
                "mentorDashboard",
                "adminDashboard",
                "menteeRequirements",
                "feedback",
                "settings"
            ].includes(page) && (
                <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-6 text-center">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-[#E5E7EB] shadow-xs">
                        <div className="text-5xl mb-4">🔍</div>
                        <h2 className="text-xl font-bold text-[#172033] mb-2">Page Not Found</h2>
                        <p className="text-sm text-[#718096] mb-6">The page you requested does not exist or has been moved.</p>
                        <button
                            onClick={() => nav("landing")}
                            className="bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338CA] transition-colors cursor-pointer"
                        >
                            Return to Homepage
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
