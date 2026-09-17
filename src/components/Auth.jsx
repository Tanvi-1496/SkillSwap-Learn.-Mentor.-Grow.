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
    const handleLogin = async (e) => {
        e.preventDefault();

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
    console.log("LOGIN RESULT:", result);

    if (!response.ok) {
        alert(result.error);
        return;
    }
    localStorage.setItem("access_token", result.session.access_token);

    const { data } = {
        data: result
    };

        // if (error) {
        //     alert(error.message);
        //     return;
        // }

        // //temp  /// DOOOO NOTTT UNCOMMENT THISSSS 
        // const { data: profile, error: profileError } = await supabase
        //     .from("student_profiles")
        //     .select("*")
        //     .eq("user_id", data.user.id)
        //     .single();

        // console.log("RLS TEST:", profile, profileError);

        if (result.user.role === "mentor") {
            onNavigate("mentorDashboard");
        } else {
            onNavigate("menteeDashboard");
        }
    };
    const handleRegister = async (e) => {
        e.preventDefault();
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
        alert(result.error);
        return;
    }
    localStorage.setItem("access_token", result.session.access_token);

        // if (error) {
        //     alert(error.message);
        //     return;
        // }
        
        // if (role === "mentee") {
        //     const { error: profileError } = await supabase
        //         .from("student_profiles")
        //         .insert({
        //             user_id: data.user.id,
        //             semester: Number(semester)
        //         });

        //     if (profileError) {
        //         alert(profileError.message);
        //         return;
        //     }
        // }

    //     if (role === "mentor") {
    //     const { error: profileError } = await supabase
    //         .from("mentor_profiles")
    //         .insert({
    //             user_id: data.user.id,
    //             mentor_type: mentorType,
    //             experience: Number(experience),
    //             org: organization
    //         });

    //     if (profileError) {
    //         alert(profileError.message);
    //         return;
    //     }
    // }


        alert("Registration successful!");

        if (role === "mentor") {
            onNavigate("mentorDashboard");
        } else {
            onNavigate("menteeDashboard");
        }
    };
    return (<div className="min-h-screen bg-[#f8f9ff] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 70%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}/>
        <div className="relative">
          <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors" onClick={() => onNavigate("landing")}>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
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
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">A</div>
          <div>
            <div className="text-white font-semibold text-sm">"Found my dream internship after 3 sessions!"</div>
            <div className="text-indigo-200 text-xs mt-0.5">Aryan S., 3rd Year CSE</div>
          </div>
          <div className="ml-auto text-yellow-400">★★★★★</div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm mb-8 transition-colors lg:hidden" onClick={() => onNavigate("landing")}>
            ← Back to home
          </button>

          {mode === "login" ? (<>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in to SkillSwap</h1>
              <p className="text-slate-500 mb-8">Welcome back! Enter your credentials.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@university.edu" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all" required/>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all" required/>
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs" onClick={() => setShowPass(!showPass)}>
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300"/>
                    Remember me
                  </label>
                  <button type="button" className="text-indigo-600 hover:text-indigo-700 font-medium">Forgot password?</button>
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm hover:shadow-md">
                  Sign In
                </button>
                <button type="button" className="w-full border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors hover:bg-slate-50">
                  <span className="text-lg">G</span>
                  Continue with Google
                </button>
              </form>
              <p className="text-center text-slate-500 text-sm mt-6">
                Don&apos;t have an account?{" "}
                <button className="text-indigo-600 font-semibold hover:text-indigo-700" onClick={() => onNavigate("register")}>
                  Register now
                </button>
              </p>
            </>) : step === "role" ? (<>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Join SkillSwap</h1>
              <p className="text-slate-500 mb-8">What do you want to do?</p>
              <div className="space-y-4">
                {[
                { r: "mentee", icon: "🎓", title: "I want to learn", desc: "Find mentors, book sessions, and grow your skills with AI-powered recommendations." },
                { r: "mentor", icon: "👨‍🏫", title: "I want to mentor", desc: "Share your expertise, help students, and build your mentoring profile." },
            ].map(opt => (<button key={opt.r} className={`w-full p-5 rounded-2xl border-2 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 ${role === opt.r ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`} onClick={() => setRole(opt.r)}>
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{opt.icon}</span>
                      <div>
                        <div className="font-bold text-slate-800">{opt.title}</div>
                        <div className="text-slate-500 text-sm mt-0.5">{opt.desc}</div>
                      </div>
                      {role === opt.r && <div className="ml-auto text-indigo-600">✓</div>}
                    </div>
                  </button>))}
              </div>
              <button className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!role} onClick={() => role && setStep("form")}>
                Continue →
              </button>
              <p className="text-center text-slate-500 text-sm mt-4">
                Already have an account?{" "}
                <button className="text-indigo-600 font-semibold hover:text-indigo-700" onClick={() => onNavigate("login")}>
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
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm" required/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@university.edu" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm" required/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a strong password" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm" required/>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">College</label>
                    <input
                    type="text"
                    value={college}
                    onChange={e => setCollege(e.target.value)}
                    placeholder="IIT Bombay"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department</label>
                    <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Semester</label>
                    <select
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white"
                   >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}th Semester</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone</label>
                   <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  />
                  </div>
                  {role === "mentor" && (<>
                      <div className="col-span-2">
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Mentor Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Senior Student", "Faculty", "Alumni", "Industry Professional"].map(t => (<button key={t} type="button" className={`py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${mentorType === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`} onClick={() => setMentorType(t)}>
                              {t}
                            </button>))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Experience</label>
                        <input
                        type="number"
                        value={experience}
                        onChange={e => setExperience(e.target.value)}
                        placeholder="4"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm"
                    />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Organization</label>
                        <input
                        type="text"
                        value={organization}
                        onChange={e => setOrganization(e.target.value)}
                        placeholder="Google / IIT Delhi"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm"
                    />
                      </div>
                    </>)}
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <input type="checkbox" className="mt-0.5 rounded" required/>
                  <span>I agree to the <a href="#" className="text-indigo-600">Terms of Service</a> and <a href="#" className="text-indigo-600">Privacy Policy</a></span>
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm">
                  Create Account
                </button>
              </form>
            </>)}
        </div>
      </div>
    </div>);
}
