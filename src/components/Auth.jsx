import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Auth({ mode = "login", onNavigate, redirect, user: propUser }) {
    const isOnboarding = mode === "onboarding";
    const [step, setStep] = useState(mode === "register" || isOnboarding ? "role" : "form");
    const [role, setRole] = useState(null);
    const [mentorType, setMentorType] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [college, setCollege] = useState("");
    const [department, setDepartment] = useState("");
    const [semester, setSemester] = useState("1");
    const [phone, setPhone] = useState("");
    const [experience, setExperience] = useState("");
    const [organization, setOrganization] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    // Load initial user details if in onboarding mode or check for OAuth error in URL
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const errorDesc = params.get("error_description");
            const errorMsg = params.get("error");
            if (errorDesc || errorMsg) {
                setFeedback({
                    type: "error",
                    message: errorDesc || "Google sign-in was cancelled or encountered an error."
                });
                try {
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } catch (e) {
                    console.warn("Could not clean URL params:", e);
                }
            }
        }

        async function initOnboardingUser() {
            if (isOnboarding) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const activeUser = propUser || session?.user;
                    if (activeUser) {
                        setName(activeUser.user_metadata?.full_name || activeUser.user_metadata?.name || "");
                        setEmail(activeUser.email || "");
                    }
                } catch (e) {
                    console.warn("Could not initialize onboarding user:", e);
                }
            }
        }

        initOnboardingUser();
    }, [isOnboarding, propUser]);

    const establishBrowserSession = async (session, action) => {
        if (!session?.access_token || !session?.refresh_token) {
            setFeedback({
                type: action === "registration" ? "success" : "error",
                message: action === "registration"
                    ? "Registration successful! Please confirm your email before signing in."
                    : "Login succeeded, but no session was returned."
            });
            return false;
        }

        const { error: sessionError } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
        });

        if (sessionError) {
            console.error("Supabase session error:", sessionError.message);
            setFeedback({
                type: "error",
                message: "Authentication succeeded, but the browser session could not be created."
            });
            return false;
        }

        const {
            data: { session: currentSession },
            error: currentSessionError
        } = await supabase.auth.getSession();

        if (currentSessionError) {
            console.error("Supabase session verification error:", currentSessionError.message);
            setFeedback({
                type: "error",
                message: "Authentication succeeded, but the browser session could not be verified."
            });
            return false;
        }

        if (!currentSession?.access_token) {
            setFeedback({
                type: "error",
                message: "Authentication succeeded, but no active browser session was found."
            });
            return false;
        }

        return true;
    };

    const getRole = (result) => {
        if (typeof result?.role === "string") {
            const r = result.role.toLowerCase().trim();
            if (r === "admin" || r === "mentor" || r === "student") return r;
        }
        const appRole = result?.user?.app_metadata?.role;
        if (typeof appRole === "string") {
            const r = appRole.toLowerCase().trim();
            if (r === "admin" || r === "mentor" || r === "student") return r;
        }
        const metaRole = result?.user?.user_metadata?.role;
        if (typeof metaRole === "string") {
            const r = metaRole.toLowerCase().trim();
            if (r === "mentor") return "mentor";
            if (r === "student") return "student";
        }
        return "student";
    };

    const navigatePostAuth = (userRole) => {
        const roleDefault = userRole === "admin"
            ? "adminDashboard"
            : userRole === "mentor"
            ? "mentorDashboard"
            : "menteeDashboard";

        if (redirect && redirect !== "login" && redirect !== "register" && redirect !== "landing" && redirect !== "onboarding") {
            if (userRole === "mentor" && (redirect === "mentorDashboard" || redirect === "mentorProfile" || redirect === "settings")) {
                onNavigate(redirect);
                return;
            }
            if (userRole === "admin" && (redirect === "adminDashboard" || redirect === "settings")) {
                onNavigate(redirect);
                return;
            }
            if (userRole !== "mentor" && userRole !== "admin" && redirect !== "adminDashboard" && redirect !== "mentorDashboard") {
                onNavigate(redirect);
                return;
            }
        }
        onNavigate(roleDefault);
    };

    const handleGoogleSignIn = async () => {
        try {
            setFeedback(null);
            setIsGoogleLoading(true);

            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin
                }
            });

            if (error) {
                setFeedback({
                    type: "error",
                    message: error.message || "Failed to initialize Google Sign-in."
                });
                setIsGoogleLoading(false);
            }
        } catch (err) {
            console.error("Google sign-in error:", err);
            setFeedback({
                type: "error",
                message: "Unable to connect to Google right now. Please try again."
            });
            setIsGoogleLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setFeedback(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("http://localhost:5000/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                setFeedback({
                    type: "error",
                    message: result.error || "Login failed. Please check your credentials."
                });
                return;
            }

            const sessionCreated = await establishBrowserSession(
                result.session,
                "login"
            );

            if (!sessionCreated) {
                return;
            }

            const userRole = getRole(result);
            navigatePostAuth(userRole);
        } catch (error) {
            console.error("Login error:", error.message);
            setFeedback({
                type: "error",
                message: "Unable to log in right now. Please try again."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setFeedback(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("http://localhost:5000/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    role: role === "mentor" ? "mentor" : "student",
                    org: college,
                    dept: department,
                    phone,
                    semester,
                    mentorType,
                    experience,
                    organization
                })
            });

            const result = await response.json();

            if (!response.ok) {
                setFeedback({
                    type: "error",
                    message: result.error || "Registration failed."
                });
                return;
            }

            const sessionCreated = await establishBrowserSession(
                result.session,
                "registration"
            );

            if (!sessionCreated) {
                return;
            }

            setFeedback({
                type: "success",
                message: "Account created successfully! Redirecting..."
            });

            const registeredRole = getRole(result);
            setTimeout(() => {
                navigatePostAuth(registeredRole);
            }, 500);
        } catch (error) {
            console.error("Registration error:", error.message);
            setFeedback({
                type: "error",
                message: "Unable to register right now. Please try again."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOnboardingSubmit = async (e) => {
        e.preventDefault();
        setFeedback(null);
        setIsSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setFeedback({
                    type: "error",
                    message: "Session expired. Please sign in with Google again."
                });
                setIsSubmitting(false);
                return;
            }

            const response = await fetch("http://localhost:5000/auth/google/onboard", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name,
                    role: role === "mentor" ? "mentor" : "student",
                    org: college,
                    dept: department,
                    phone,
                    semester: role === "mentor" ? undefined : semester,
                    mentorType: role === "mentor" ? mentorType : undefined,
                    experience: role === "mentor" ? experience : undefined,
                    organization: role === "mentor" ? organization : undefined
                })
            });

            const result = await response.json();

            if (!response.ok) {
                setFeedback({
                    type: "error",
                    message: result.error || "Onboarding failed. Please check your entries."
                });
                setIsSubmitting(false);
                return;
            }

            setFeedback({
                type: "success",
                message: "Profile completed successfully! Welcome to SkillSwap."
            });

            const finalRole = result.role || (role === "mentor" ? "mentor" : "student");
            setTimeout(() => {
                navigatePostAuth(finalRole);
            }, 500);
        } catch (error) {
            console.error("Onboarding submission error:", error.message);
            setFeedback({
                type: "error",
                message: "Unable to complete profile right now. Please try again."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelOnboarding = async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("Sign out on cancel error:", e);
        }
        onNavigate("login");
    };

    return (
        <div className="min-h-screen bg-[#F5F7FC] flex font-[Plus_Jakarta_Sans,system-ui,sans-serif]">
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#4F46E5] via-indigo-600 to-[#172033] relative overflow-hidden flex-col justify-between p-12">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: "radial-gradient(circle at 30% 70%, white 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="relative">
                    <button
                        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors cursor-pointer"
                        onClick={() => onNavigate("landing")}
                    >
                        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <span className="text-xl font-bold text-white">SkillSwap</span>
                    </button>
                </div>
                <div className="relative">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        {isOnboarding
                            ? "Complete your profile"
                            : mode === "login"
                            ? "Welcome back!"
                            : "Join 12,000+ learners"}
                    </h2>
                    <p className="text-indigo-200 text-lg leading-relaxed mb-8">
                        Learn from the right person. Grow with the right guidance.
                    </p>
                    <div className="space-y-4">
                        {[
                            { icon: "🤖", text: "AI-powered mentor matching" },
                            { icon: "✅", text: "2,400+ verified mentors" },
                            { icon: "📅", text: "Flexible session scheduling" },
                            { icon: "🔒", text: "Secure & private platform" },
                        ].map((f) => (
                            <div key={f.text} className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-lg">
                                    {f.icon}
                                </div>
                                <span className="text-white/90 font-medium">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="relative flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                    <div className="w-10 h-10 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold">
                        A
                    </div>
                    <div>
                        <div className="text-white font-semibold text-sm">
                            "Found my dream internship after 3 sessions!"
                        </div>
                        <div className="text-indigo-200 text-xs mt-0.5">Aryan S., 3rd Year CSE</div>
                    </div>
                    <div className="ml-auto text-amber-400">★★★★★</div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-[#E5E7EB] shadow-xs">
                    <button
                        className="flex items-center gap-2 text-[#718096] hover:text-[#4F46E5] text-sm mb-8 transition-colors lg:hidden cursor-pointer"
                        onClick={() => onNavigate("landing")}
                    >
                        ← Back to home
                    </button>

                    {/* Feedback alert banner */}
                    {feedback && (
                        <div
                            className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center gap-3 transition-all ${
                                feedback.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                        >
                            <span className="text-lg">{feedback.type === "success" ? "✓" : "⚠️"}</span>
                            <span>{feedback.message}</span>
                        </div>
                    )}

                    {/* Mode: Login */}
                    {mode === "login" && (
                        <>
                            <h1 className="text-2xl font-bold text-[#172033] mb-1">Sign in to SkillSwap</h1>
                            <p className="text-[#718096] mb-6 text-sm">Welcome back! Enter your credentials.</p>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Email address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="alex@university.edu"
                                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033] transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPass ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033] transition-all"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#172033] text-xs cursor-pointer"
                                            onClick={() => setShowPass(!showPass)}
                                        >
                                            {showPass ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 text-[#718096]">
                                        <input type="checkbox" className="rounded border-[#E5E7EB] text-[#4F46E5]" />
                                        Remember me
                                    </label>
                                    <button type="button" className="text-[#4F46E5] hover:text-[#4338CA] font-medium text-xs">
                                        Forgot password?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                                        isSubmitting ? "opacity-75 cursor-not-allowed" : ""
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Signing In...</span>
                                        </>
                                    ) : (
                                        <span>Sign In</span>
                                    )}
                                </button>

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-[#E5E7EB]"></div>
                                    <span className="flex-shrink mx-3 text-xs text-[#718096] font-medium uppercase tracking-wider">
                                        Or
                                    </span>
                                    <div className="flex-grow border-t border-[#E5E7EB]"></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    disabled={isGoogleLoading || isSubmitting}
                                    className="w-full border border-[#E5E7EB] hover:bg-[#F5F7FC] text-[#172033] font-semibold py-3 rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isGoogleLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-[#4F46E5]/30 border-t-[#4F46E5] rounded-full animate-spin" />
                                            <span>Connecting to Google...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                <path
                                                    fill="#4285F4"
                                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                />
                                                <path
                                                    fill="#34A853"
                                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                />
                                                <path
                                                    fill="#FBBC05"
                                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                                />
                                                <path
                                                    fill="#EA4335"
                                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                                />
                                            </svg>
                                            <span>Continue with Google</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="text-center text-[#718096] text-sm mt-6">
                                Don&apos;t have an account?{" "}
                                <button
                                    className="text-[#4F46E5] font-semibold hover:text-[#4338CA] cursor-pointer"
                                    onClick={() => onNavigate("register")}
                                >
                                    Register now
                                </button>
                            </p>
                        </>
                    )}

                    {/* Step: Role Selection (for Register or Onboarding) */}
                    {(mode === "register" || isOnboarding) && step === "role" && (
                        <>
                            <h1 className="text-2xl font-bold text-[#172033] mb-1">
                                {isOnboarding ? "Complete Your Profile" : "Join SkillSwap"}
                            </h1>
                            <p className="text-[#718096] mb-6 text-sm">
                                {isOnboarding
                                    ? "Select your role to finish setting up your account."
                                    : "What do you want to do?"}
                            </p>

                            <div className="space-y-4">
                                {[
                                    {
                                        r: "mentee",
                                        icon: "🎓",
                                        title: "I want to learn",
                                        desc: "Find mentors, book sessions, and grow your skills with AI-powered recommendations."
                                    },
                                    {
                                        r: "mentor",
                                        icon: "👨‍🏫",
                                        title: "I want to mentor",
                                        desc: "Share your expertise, help students, and build your mentoring profile."
                                    },
                                ].map((opt) => (
                                    <button
                                        key={opt.r}
                                        type="button"
                                        className={`w-full p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                                            role === opt.r
                                                ? "border-[#4F46E5] bg-[#EEF0FF]"
                                                : "border-[#E5E7EB] bg-white hover:border-[#4F46E5]/40"
                                        }`}
                                        onClick={() => setRole(opt.r)}
                                    >
                                        <div className="flex items-start gap-4">
                                            <span className="text-3xl">{opt.icon}</span>
                                            <div>
                                                <div className="font-bold text-[#172033]">{opt.title}</div>
                                                <div className="text-[#718096] text-sm mt-0.5">{opt.desc}</div>
                                            </div>
                                            {role === opt.r && (
                                                <div className="ml-auto text-[#4F46E5] font-bold">✓</div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="w-full mt-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                                disabled={!role}
                                onClick={() => role && setStep("form")}
                            >
                                Continue →
                            </button>

                            {/* Show Google Sign-in on registration step 1 */}
                            {!isOnboarding && (
                                <>
                                    <div className="relative flex py-4 items-center">
                                        <div className="flex-grow border-t border-[#E5E7EB]"></div>
                                        <span className="flex-shrink mx-3 text-xs text-[#718096] font-medium uppercase tracking-wider">
                                            Or sign up with
                                        </span>
                                        <div className="flex-grow border-t border-[#E5E7EB]"></div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleGoogleSignIn}
                                        disabled={isGoogleLoading}
                                        className="w-full border border-[#E5E7EB] hover:bg-[#F5F7FC] text-[#172033] font-semibold py-3 rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer text-sm"
                                    >
                                        {isGoogleLoading ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-[#4F46E5]/30 border-t-[#4F46E5] rounded-full animate-spin" />
                                                <span>Connecting to Google...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                    <path
                                                        fill="#4285F4"
                                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                    />
                                                    <path
                                                        fill="#34A853"
                                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                    />
                                                    <path
                                                        fill="#FBBC05"
                                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                                    />
                                                    <path
                                                        fill="#EA4335"
                                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                                    />
                                                </svg>
                                                <span>Continue with Google</span>
                                            </>
                                        )}
                                    </button>

                                    <p className="text-center text-[#718096] text-sm mt-4">
                                        Already have an account?{" "}
                                        <button
                                            className="text-[#4F46E5] font-semibold hover:text-[#4338CA] cursor-pointer"
                                            onClick={() => onNavigate("login")}
                                        >
                                            Sign in
                                        </button>
                                    </p>
                                </>
                            )}

                            {isOnboarding && (
                                <p className="text-center text-[#718096] text-sm mt-4">
                                    Want to use a different account?{" "}
                                    <button
                                        type="button"
                                        className="text-[#4F46E5] font-semibold hover:text-[#4338CA] cursor-pointer"
                                        onClick={handleCancelOnboarding}
                                    >
                                        Sign out
                                    </button>
                                </p>
                            )}
                        </>
                    )}

                    {/* Step: Form Details (Registration or Google Onboarding) */}
                    {(mode === "register" || isOnboarding) && step === "form" && (
                        <>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-[#718096] hover:text-[#4F46E5] text-sm mb-6 transition-colors cursor-pointer"
                                onClick={() => setStep("role")}
                            >
                                ← Back
                            </button>

                            <h1 className="text-2xl font-bold text-[#172033] mb-1">
                                {isOnboarding ? "Complete Your Account" : "Create your account"}
                            </h1>
                            <p className="text-[#718096] mb-6 text-sm">
                                Registering as a{" "}
                                <span className="text-[#4F46E5] font-semibold">
                                    {role === "mentor" ? "Mentor" : "Student"}
                                </span>
                            </p>

                            <form onSubmit={isOnboarding ? handleOnboardingSubmit : handleRegister} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Full Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Alex Johnson"
                                            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                                            required
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-[#172033] block mb-1.5">
                                            Email Address {isOnboarding && <span className="text-xs text-[#4F46E5] font-normal">(Verified with Google)</span>}
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="alex@university.edu"
                                            disabled={isOnboarding}
                                            className={`w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#172033] ${
                                                isOnboarding
                                                    ? "bg-[#E5E7EB]/50 text-[#718096] cursor-not-allowed"
                                                    : "bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF]"
                                            } outline-none`}
                                            required
                                        />
                                    </div>

                                    {/* Only require password for standard email/password registration */}
                                    {!isOnboarding && (
                                        <div className="col-span-2">
                                            <label className="text-sm font-medium text-[#172033] block mb-1.5">Password</label>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Create a strong password"
                                                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-sm font-medium text-[#172033] block mb-1.5">College</label>
                                        <input
                                            type="text"
                                            value={college}
                                            onChange={(e) => setCollege(e.target.value)}
                                            placeholder="IIT Bombay"
                                            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Department</label>
                                        <input
                                            type="text"
                                            value={department}
                                            onChange={(e) => setDepartment(e.target.value)}
                                            placeholder="Computer Science"
                                            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                                        />
                                    </div>

                                    {role !== "mentor" && (
                                        <div>
                                            <label className="text-sm font-medium text-[#172033] block mb-1.5">Semester</label>
                                            <select
                                                value={semester}
                                                onChange={(e) => setSemester(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033] cursor-pointer"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                                    <option key={s} value={s}>
                                                        {s}th Semester
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className={role === "mentor" ? "col-span-2" : ""}>
                                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Phone</label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                                        />
                                    </div>

                                    {role === "mentor" && (
                                        <>
                                            <div className="col-span-2">
                                                <label className="text-sm font-medium text-[#172033] block mb-1.5">
                                                    Mentor Type
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {["Senior Student", "Faculty", "Alumni", "Industry Professional"].map((t) => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                                                                mentorType === t
                                                                    ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5]"
                                                                    : "border-[#E5E7EB] bg-[#F5F7FC] text-[#718096] hover:border-[#4F46E5]/40"
                                                            }`}
                                                            onClick={() => setMentorType(t)}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-[#172033] block mb-1.5">
                                                    Experience (Years)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={experience}
                                                    onChange={(e) => setExperience(e.target.value)}
                                                    placeholder="4"
                                                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033]"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-[#172033] block mb-1.5">
                                                    Organization
                                                </label>
                                                <input
                                                    type="text"
                                                    value={organization}
                                                    onChange={(e) => setOrganization(e.target.value)}
                                                    placeholder="Google / IIT Delhi"
                                                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033]"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-start gap-2 text-xs text-[#718096]">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 rounded border-[#E5E7EB] text-[#4F46E5]"
                                        required
                                    />
                                    <span>
                                        I agree to the <a href="#" className="text-[#4F46E5]">Terms of Service</a> and{" "}
                                        <a href="#" className="text-[#4F46E5]">Privacy Policy</a>
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                                        isSubmitting ? "opacity-75 cursor-not-allowed" : ""
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>{isOnboarding ? "Completing Profile..." : "Creating Account..."}</span>
                                        </>
                                    ) : (
                                        <span>{isOnboarding ? "Complete Profile" : "Create Account"}</span>
                                    )}
                                </button>
                            </form>

                            {isOnboarding && (
                                <div className="mt-4 text-center">
                                    <button
                                        type="button"
                                        onClick={handleCancelOnboarding}
                                        className="text-xs text-[#718096] hover:text-rose-600 transition-colors font-medium cursor-pointer"
                                    >
                                        Cancel and sign out
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
