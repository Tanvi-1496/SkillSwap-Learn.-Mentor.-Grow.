import { useState } from "react";
import { supabase } from "../lib/supabase";
export default function Auth({ mode, onNavigate }) {
    const [step, setStep] = useState(mode === "register" ? "role" : "form");
    const [role, setRole] = useState(null);
    const [mentorType, setMentorType] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [college, setCollege] = useState("");
    const [department, setDepartment] = useState("");
    const [semester, setSemester] = useState("");
    const [phone, setPhone] = useState("");
    const [experience, setExperience] = useState("");
    const [organization, setOrganization] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        const role =
            result?.role ||
            result?.user?.user_metadata?.role ||
            result?.user?.app_metadata?.role;

        return typeof role === "string" ? role.toLowerCase() : null;
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
            if (userRole === "admin") {
                onNavigate("adminDashboard");
            } else if (userRole === "mentor") {
                onNavigate("mentorDashboard");
            } else {
                onNavigate("menteeDashboard");
            }
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
                    role: role === "mentee" ? "student" : "mentor",
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
                if (registeredRole === "admin") {
                    onNavigate("adminDashboard");
                } else if (registeredRole === "mentor") {
                    onNavigate("mentorDashboard");
                } else {
                    onNavigate("menteeDashboard");
                }
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
    return (<div className="min-h-screen bg-[#F5F7FC] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#4F46E5] via-indigo-600 to-[#172033] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 70%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}/>
        <div className="relative">
          <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors" onClick={() => onNavigate("landing")}>
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-xl font-bold text-white">SkillSwap</span>
          </button>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold text-white mb-4">
            {mode === "login" ? "Welcome back!" : "Join 12,000+ learners"}
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
        ].map(f => (<div key={f.text} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-lg">{f.icon}</div>
                <span className="text-white/90 font-medium">{f.text}</span>
              </div>))}
          </div>
        </div>
        <div className="relative flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <div className="w-10 h-10 bg-[#4F46E5] rounded-full flex items-center justify-center text-white font-bold">A</div>
          <div>
            <div className="text-white font-semibold text-sm">"Found my dream internship after 3 sessions!"</div>
            <div className="text-indigo-200 text-xs mt-0.5">Aryan S., 3rd Year CSE</div>
          </div>
          <div className="ml-auto text-amber-400">★★★★★</div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-[#E5E7EB] shadow-xs">
          <button className="flex items-center gap-2 text-[#718096] hover:text-[#4F46E5] text-sm mb-8 transition-colors lg:hidden" onClick={() => onNavigate("landing")}>
            ← Back to home
          </button>

          {mode === "login" ? (<>
              <h1 className="text-2xl font-bold text-[#172033] mb-1">Sign in to SkillSwap</h1>
              <p className="text-[#718096] mb-6 text-sm">Welcome back! Enter your credentials.</p>

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

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#172033] block mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@university.edu" className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033] transition-all" required/>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#172033] block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033] transition-all" required/>
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#172033] text-xs cursor-pointer" onClick={() => setShowPass(!showPass)}>
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-[#718096]">
                    <input type="checkbox" className="rounded border-[#E5E7EB] text-[#4F46E5]"/>
                    Remember me
                  </label>
                  <button type="button" className="text-[#4F46E5] hover:text-[#4338CA] font-medium text-xs">Forgot password?</button>
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
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
                <button type="button" className="w-full border border-[#E5E7EB] hover:bg-[#F5F7FC] text-[#172033] font-semibold py-3 rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>
              <p className="text-center text-[#718096] text-sm mt-6">
                Don&apos;t have an account?{" "}
                <button className="text-[#4F46E5] font-semibold hover:text-[#4338CA] cursor-pointer" onClick={() => onNavigate("register")}>
                  Register now
                </button>
              </p>
            </>) : step === "role" ? (<>
              <h1 className="text-2xl font-bold text-[#172033] mb-1">Join SkillSwap</h1>
              <p className="text-[#718096] mb-8 text-sm">What do you want to do?</p>
              <div className="space-y-4">
                {[
                { r: "mentee", icon: "🎓", title: "I want to learn", desc: "Find mentors, book sessions, and grow your skills with AI-powered recommendations." },
                { r: "mentor", icon: "👨‍🏫", title: "I want to mentor", desc: "Share your expertise, help students, and build your mentoring profile." },
            ].map(opt => (<button key={opt.r} className={`w-full p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${role === opt.r ? "border-[#4F46E5] bg-[#EEF0FF]" : "border-[#E5E7EB] bg-white hover:border-[#4F46E5]/40"}`} onClick={() => setRole(opt.r)}>
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{opt.icon}</span>
                      <div>
                        <div className="font-bold text-[#172033]">{opt.title}</div>
                        <div className="text-[#718096] text-sm mt-0.5">{opt.desc}</div>
                      </div>
                      {role === opt.r && <div className="ml-auto text-[#4F46E5] font-bold">✓</div>}
                    </div>
                  </button>))}
              </div>
              <button className="w-full mt-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer" disabled={!role} onClick={() => role && setStep("form")}>
                Continue →
              </button>
              <p className="text-center text-[#718096] text-sm mt-4">
                Already have an account?{" "}
                <button className="text-[#4F46E5] font-semibold hover:text-[#4338CA] cursor-pointer" onClick={() => onNavigate("login")}>
                  Sign in
                </button>
              </p>
            </>) : (<>
              <button className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm mb-6 transition-colors" onClick={() => setStep("role")}>
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-slate-500 mb-6">
                Registering as a <span className="text-indigo-600 font-semibold">{role === "mentor" ? "Mentor" : "Mentee"}</span>
              </p>

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

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]" required/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@university.edu" className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]" required/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a strong password" className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]" required/>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">College</label>
                    <input
                    type="text"
                    value={college}
                    onChange={e => setCollege(e.target.value)}
                    placeholder="IIT Bombay"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                  />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Department</label>
                    <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                  />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Semester</label>
                    <select
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033] cursor-pointer"
                   >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}th Semester</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#172033] block mb-1.5">Phone</label>
                   <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] outline-none text-sm text-[#172033]"
                  />
                  </div>
                  {role === "mentor" && (<>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Mentor Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Senior Student", "Faculty", "Alumni", "Industry Professional"].map(t => (<button key={t} type="button" className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${mentorType === t ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5]" : "border-[#E5E7EB] bg-[#F5F7FC] text-[#718096] hover:border-[#4F46E5]/40"}`} onClick={() => setMentorType(t)}>
                              {t}
                            </button>))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Experience (Years)</label>
                        <input
                        type="number"
                        value={experience}
                        onChange={e => setExperience(e.target.value)}
                        placeholder="4"
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033]"
                    />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-[#172033] block mb-1.5">Organization</label>
                        <input
                        type="text"
                        value={organization}
                        onChange={e => setOrganization(e.target.value)}
                        placeholder="Google / IIT Delhi"
                        className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F5F7FC] focus:bg-white focus:border-[#4F46E5] outline-none text-sm text-[#172033]"
                    />
                      </div>
                    </>)}
                </div>
                <div className="flex items-start gap-2 text-xs text-[#718096]">
                  <input type="checkbox" className="mt-0.5 rounded border-[#E5E7EB] text-[#4F46E5]" required/>
                  <span>I agree to the <a href="#" className="text-[#4F46E5]">Terms of Service</a> and <a href="#" className="text-[#4F46E5]">Privacy Policy</a></span>
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
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </form>
            </>)}
        </div>
      </div>
    </div>);
}
