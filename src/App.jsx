import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";
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

const PUBLIC_PAGES = new Set(["landing", "login", "register", "search", "mentorProfile"]);

const ROLE_DEFAULT_PAGES = {
    admin: "adminDashboard",
    mentor: "mentorDashboard",
    student: "menteeDashboard"
};

const ROLE_ALLOWED_PAGES = {
    admin: new Set(["adminDashboard", "settings", "search", "mentorProfile"]),
    mentor: new Set(["mentorDashboard", "mentorProfile", "settings", "search"]),
    student: new Set([
        "menteeDashboard",
        "aiRecs",
        "mentorProfile",
        "booking",
        "bookings",
        "search",
        "profile",
        "menteeRequirements",
        "feedback",
        "settings"
    ])
};

const ALL_VALID_PAGES = new Set([
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
]);

function parseUrl() {
    if (typeof window === "undefined") {
        return { page: "landing", pageData: {} };
    }

    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, "");
    const hash = window.location.hash.replace(/^#\/?/, "");
    const search = new URLSearchParams(window.location.search);

    let rawPath = pathname || hash || "landing";
    if (rawPath === "index.html" || rawPath === "") {
        rawPath = "landing";
    }

    const parts = rawPath.split("/");
    const pageName = parts[0] || "landing";
    const subRoute = parts[1];

    const tab = search.get("tab") || subRoute || undefined;
    const mentorId = search.get("mentorId") || undefined;
    const fromPage = search.get("fromPage") || undefined;
    const redirect = search.get("redirect") || undefined;
    const searchParam = search.get("search") || undefined;
    const filterType = search.get("filterType") || undefined;
    const filterRating = search.get("filterRating") || undefined;
    const view = search.get("view") || undefined;
    const sortBy = search.get("sortBy") || undefined;
    const matchScore = search.get("matchScore") || search.get("match") || undefined;

    const pageData = {};
    if (tab) pageData.tab = tab;
    if (mentorId) pageData.mentorId = mentorId;
    if (fromPage) pageData.fromPage = fromPage;
    if (redirect) pageData.redirect = redirect;
    if (searchParam) pageData.search = searchParam;
    if (filterType) pageData.filterType = filterType;
    if (filterRating) pageData.filterRating = filterRating;
    if (view) pageData.view = view;
    if (sortBy) pageData.sortBy = sortBy;
    if (matchScore !== undefined) {
        const parsedScore = Number(matchScore);
        if (!isNaN(parsedScore)) pageData.matchScore = parsedScore;
    }

    return {
        page: ALL_VALID_PAGES.has(pageName) ? pageName : "landing",
        pageData
    };
}

function buildUrl(pageName, pageData = {}) {
    if (pageName === "landing") return "/";

    let path = `/${pageName}`;
    const params = new URLSearchParams();

    if (pageData.tab) params.set("tab", pageData.tab);
    if (pageData.mentorId) params.set("mentorId", pageData.mentorId);
    if (pageData.fromPage) params.set("fromPage", pageData.fromPage);
    if (pageData.redirect) params.set("redirect", pageData.redirect);
    if (pageData.search) params.set("search", pageData.search);
    if (pageData.filterType && pageData.filterType !== "All") params.set("filterType", pageData.filterType);
    if (pageData.filterRating && pageData.filterRating !== "All") params.set("filterRating", pageData.filterRating);
    if (pageData.view && pageData.view !== "grid") params.set("view", pageData.view);
    if (pageData.sortBy && pageData.sortBy !== "Best Match") params.set("sortBy", pageData.sortBy);
    if (pageData.matchScore !== undefined && pageData.matchScore !== null) params.set("matchScore", pageData.matchScore);

    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}

export default function App() {
    const initialRoute = parseUrl();
    const [page, setPage] = useState(initialRoute.page);
    const [pageData, setPageData] = useState(initialRoute.pageData);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [demoNavOpen, setDemoNavOpen] = useState(true);

    const userRef = useRef(null);
    userRef.current = user;

    const nav = useCallback((p, data = {}, replace = false) => {
        setPage(p);
        setPageData(data);

        if (typeof window !== "undefined") {
            const newUrl = buildUrl(p, data);
            const currentUrl = window.location.pathname + window.location.search;
            if (newUrl !== currentUrl) {
                if (replace) {
                    window.history.replaceState({ page: p, pageData: data }, "", newUrl);
                } else {
                    window.history.pushState({ page: p, pageData: data }, "", newUrl);
                }
            }
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error("Auth getSession error:", error);
                }

                if (!isMounted) return;

                const { page: requestedPage, pageData: requestedData } = parseUrl();

                if (session?.user) {
                    let role = session.user.user_metadata?.role || session.user.app_metadata?.role;
                    if (!role) {
                        const { data: profile } = await supabase
                            .from("users")
                            .select("role")
                            .eq("id", session.user.id)
                            .maybeSingle();
                        role = profile?.role;
                    }
                    const normalizedRole = typeof role === "string" ? role.toLowerCase() : "student";
                    const authenticatedUser = { ...session.user, role: normalizedRole };
                    setUser(authenticatedUser);

                    if (PUBLIC_PAGES.has(requestedPage)) {
                        if (requestedPage === "login" || requestedPage === "register") {
                            const dest = requestedData.redirect && ROLE_ALLOWED_PAGES[normalizedRole]?.has(requestedData.redirect)
                                ? requestedData.redirect
                                : ROLE_DEFAULT_PAGES[normalizedRole] || "menteeDashboard";
                            nav(dest, {}, true);
                        } else {
                            setPage(requestedPage);
                            setPageData(requestedData);
                        }
                    } else {
                        const allowed = ROLE_ALLOWED_PAGES[normalizedRole];
                        if (allowed && allowed.has(requestedPage)) {
                            setPage(requestedPage);
                            setPageData(requestedData);
                        } else {
                            const defaultPage = ROLE_DEFAULT_PAGES[normalizedRole] || "menteeDashboard";
                            nav(defaultPage, {}, true);
                        }
                    }
                } else {
                    setUser(null);
                    if (PUBLIC_PAGES.has(requestedPage)) {
                        setPage(requestedPage);
                        setPageData(requestedData);
                    } else {
                        nav("login", { redirect: requestedPage, ...requestedData }, true);
                    }
                }
            } catch (err) {
                console.error("Auth init exception:", err);
                const { page: requestedPage, pageData: requestedData } = parseUrl();
                if (PUBLIC_PAGES.has(requestedPage)) {
                    setPage(requestedPage);
                    setPageData(requestedData);
                } else {
                    nav("login", { redirect: requestedPage }, true);
                }
            } finally {
                if (isMounted) {
                    setAuthLoading(false);
                }
            }
        }

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (event === "SIGNED_OUT" || !session) {
                setUser(null);
                const current = parseUrl();
                if (!PUBLIC_PAGES.has(current.page)) {
                    nav("landing", {}, true);
                }
            } else if (event === "SIGNED_IN" && session?.user) {
                let role = session.user.user_metadata?.role || session.user.app_metadata?.role;
                if (!role) {
                    const { data: profile } = await supabase
                        .from("users")
                        .select("role")
                        .eq("id", session.user.id)
                        .maybeSingle();
                    role = profile?.role;
                }
                const normalizedRole = typeof role === "string" ? role.toLowerCase() : "student";
                setUser({ ...session.user, role: normalizedRole });
            }
        });

        const handlePopState = (e) => {
            if (e.state && e.state.page) {
                const targetPage = e.state.page;
                const targetData = e.state.pageData || {};

                const currentUser = userRef.current;
                if (!currentUser && !PUBLIC_PAGES.has(targetPage)) {
                    nav("login", { redirect: targetPage, ...targetData }, true);
                    return;
                }

                setPage(targetPage);
                setPageData(targetData);
            } else {
                const route = parseUrl();
                const currentUser = userRef.current;
                if (!currentUser && !PUBLIC_PAGES.has(route.page)) {
                    nav("login", { redirect: route.page, ...route.pageData }, true);
                    return;
                }
                setPage(route.page);
                setPageData(route.pageData);
            }
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
            window.removeEventListener("popstate", handlePopState);
        };
    }, [nav]);

    const showDevNav = typeof window !== "undefined" && window.location.search.includes("demo=true");

    if (authLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F7FC] font-[Plus_Jakarta_Sans,system-ui,sans-serif]">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-[#4F46E5] rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-white font-bold text-lg">S</span>
                    </div>
                    <span className="text-xl font-bold text-[#172033]">SkillSwap</span>
                </div>
                <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-[#718096] font-medium">Restoring your session...</p>
            </div>
        );
    }

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
            {page === "login" && <Auth mode="login" onNavigate={nav} redirect={pageData.redirect} />}
            {page === "register" && <Auth mode="register" onNavigate={nav} redirect={pageData.redirect} />}
            {page === "menteeDashboard" && <MenteeDashboard onNavigate={nav} />}
            {page === "aiRecs" && <AIRecommendations onNavigate={nav} />}
            {page === "mentorProfile" && (
                <MentorProfile
                    onNavigate={nav}
                    mentorId={pageData.mentorId}
                    fromPage={pageData.fromPage}
                    matchScore={pageData.matchScore}
                    pageData={pageData}
                    user={user}
                />
            )}
            {page === "booking" && (
                <BookingFlow
                    onNavigate={nav}
                    mentorId={pageData.mentorId}
                />
            )}
            {page === "bookings" && <MyBookings onNavigate={nav} />}
            {page === "search" && (
                <SearchMentors
                    onNavigate={nav}
                    user={user}
                    pageData={pageData}
                />
            )}
            {page === "profile" && <Profile onNavigate={nav} />}
            {page === "mentorDashboard" && <MentorDashboard onNavigate={nav} initialTab={pageData.tab} />}
            {page === "adminDashboard" && <AdminDashboard onNavigate={nav} />}
            {page === "menteeRequirements" && <MenteeRequirements onNavigate={nav} />}
            {page === "feedback" && <Feedback onNavigate={nav} />}
            {page === "settings" && <Settings onNavigate={nav} />}
            {!ALL_VALID_PAGES.has(page) && (
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
