const skills = [
    { name: "Python", icon: "🐍", color: "bg-blue-100 text-blue-700" },
    { name: "Java", icon: "☕", color: "bg-orange-100 text-orange-700" },
    { name: "Data Structures", icon: "🌳", color: "bg-green-100 text-green-700" },
    { name: "Machine Learning", icon: "🤖", color: "bg-purple-100 text-purple-700" },
    { name: "Web Development", icon: "🌐", color: "bg-indigo-100 text-indigo-700" },
    { name: "UI/UX", icon: "🎨", color: "bg-pink-100 text-pink-700" },
    { name: "Cloud Computing", icon: "☁️", color: "bg-sky-100 text-sky-700" },
    { name: "Aptitude", icon: "🧮", color: "bg-yellow-100 text-yellow-700" },
    { name: "Interview Prep", icon: "💼", color: "bg-emerald-100 text-emerald-700" },
    { name: "Data Science", icon: "📊", color: "bg-violet-100 text-violet-700" },
];
const mentors = [
    {
        name: "Dr. Priya Sharma",
        type: "Faculty Mentor",
        avatar: "PS",
        avatarBg: "bg-indigo-600",
        skills: ["Machine Learning", "Python", "Data Science"],
        experience: "8 years",
        rating: 4.9,
        sessions: 120,
        match: 94,
        available: "Mon, Wed, Fri",
    },
    {
        name: "Rahul Verma",
        type: "Senior Student",
        avatar: "RV",
        avatarBg: "bg-violet-600",
        skills: ["DSA", "Java", "Competitive Prog."],
        experience: "2 years",
        rating: 4.7,
        sessions: 48,
        match: 89,
        available: "Weekends",
    },
    {
        name: "Anjali Mehta",
        type: "Alumni Mentor",
        avatar: "AM",
        avatarBg: "bg-pink-600",
        skills: ["Web Dev", "React", "Node.js"],
        experience: "4 years",
        rating: 4.8,
        sessions: 76,
        match: 91,
        available: "Sat, Sun",
    },
    {
        name: "Karan Patel",
        type: "Industry Professional",
        avatar: "KP",
        avatarBg: "bg-emerald-600",
        skills: ["Cloud", "AWS", "DevOps"],
        experience: "6 years",
        rating: 4.9,
        sessions: 95,
        match: 87,
        available: "Weekday evenings",
    },
];
const steps = [
    { num: "01", title: "Create Your Profile", desc: "Sign up and tell us about your academic background, skills, and goals.", icon: "👤" },
    { num: "02", title: "Tell Us What You Need", desc: "Specify your learning requirements, career goals, and preferred mentor type.", icon: "📝" },
    { num: "03", title: "AI Recommendations", desc: "Our SBERT-powered AI analyzes your profile and ranks the best-matched mentors.", icon: "🤖" },
    { num: "04", title: "Book & Learn", desc: "Schedule sessions with your mentor and start your personalized learning journey.", icon: "📅" },
];
export default function Landing({ onNavigate }) {
    return (<div className="min-h-screen bg-[#f8f9ff] font-[Plus_Jakarta_Sans,system-ui,sans-serif]">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold text-slate-900">SkillSwap</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {["Home", "Find Mentors", "How It Works", "Become a Mentor", "About"].map(item => (<button key={item} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors" onClick={() => item === "Find Mentors" && onNavigate("search")}>
                  {item}
                </button>))}
            </div>
            <div className="flex items-center gap-3">
              <button className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-4 py-2 rounded-lg transition-colors" onClick={() => onNavigate("login")}>
                Login
              </button>
              <button className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors" onClick={() => onNavigate("register")}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700"/>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }}/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
                <span className="text-white/90 text-xs font-medium">2,400+ verified mentors active now</span>
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-6">
                Find the Right Mentor.<br />
                <span className="text-indigo-200">Build the Right Skills.</span>
              </h1>
              <p className="text-lg text-indigo-100 leading-relaxed mb-8 max-w-lg">
                Connect with verified seniors, faculty, alumni and industry professionals who can guide you through academics, projects, placements and career development.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-white text-indigo-700 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5" onClick={() => onNavigate("search")}>
                  Find a Mentor →
                </button>
                <button className="bg-white/10 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm" onClick={() => onNavigate("register")}>
                  Become a Mentor
                </button>
              </div>
              <div className="flex items-center gap-6 mt-10">
                {[{ val: "12K+", label: "Students" }, { val: "2.4K+", label: "Mentors" }, { val: "98%", label: "Satisfaction" }].map(s => (<div key={s.label}>
                    <div className="text-2xl font-bold text-white">{s.val}</div>
                    <div className="text-indigo-200 text-sm">{s.label}</div>
                  </div>))}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">PS</div>
                    <div>
                      <div className="text-white font-semibold">Dr. Priya Sharma</div>
                      <div className="text-indigo-200 text-sm">Faculty · ML Expert</div>
                    </div>
                    <div className="ml-auto bg-emerald-400/20 border border-emerald-400/30 rounded-full px-3 py-1">
                      <span className="text-emerald-300 text-xs font-bold">94% Match</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {["Python", "ML", "Data Science"].map(s => (<span key={s} className="bg-white/10 text-indigo-100 text-xs px-2.5 py-1 rounded-full">{s}</span>))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[{ val: "4.9★", label: "Rating" }, { val: "120", label: "Sessions" }, { val: "8 yrs", label: "Exp." }].map(m => (<div key={m.label} className="bg-white/10 rounded-xl py-2">
                        <div className="text-white font-semibold text-sm">{m.val}</div>
                        <div className="text-indigo-200 text-xs">{m.label}</div>
                      </div>))}
                  </div>
                  <button className="w-full mt-4 bg-white text-indigo-700 font-semibold py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-sm">
                    Book a Session
                  </button>
                </div>
                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  ✓ Verified
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">AI Matched</div>
                    <div className="text-xs text-slate-500">Based on your profile</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
            { icon: "✅", title: "Verified Mentors", desc: "Every mentor is ID-verified and background-checked" },
            { icon: "🎯", title: "Skill-Based Matching", desc: "AI pairs you with mentors who match your exact goals" },
            { icon: "📅", title: "Easy Booking", desc: "One-click scheduling with calendar integration" },
            { icon: "🔒", title: "Secure Platform", desc: "End-to-end encrypted sessions and payments" },
        ].map(t => (<div key={t.title} className="flex items-start gap-3">
                <span className="text-2xl">{t.icon}</span>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{t.title}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{t.desc}</div>
                </div>
              </div>))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <div className="text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-2">Simple Process</div>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">How SkillSwap Works</h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">From signup to your first session in under 5 minutes.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (<div key={step.num} className="relative">
              {i < steps.length - 1 && (<div className="hidden lg:block absolute top-8 left-[60%] right-0 h-0.5 bg-indigo-100 z-0"/>)}
              <div className="relative z-10 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all group">
                <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-colors">
                  <span>{step.icon}</span>
                </div>
                <div className="text-xs font-bold text-indigo-400 mb-1">{step.num}</div>
                <h3 className="font-bold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>))}
        </div>
      </section>

      {/* Popular Skills */}
      <section className="bg-gradient-to-br from-indigo-50 to-violet-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-10">
            <div className="text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-2">Browse by Skill</div>
            <h2 className="text-3xl font-bold text-slate-900">Popular Skills on SkillSwap</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {skills.map(skill => (<button key={skill.name} className={`${skill.color} px-5 py-2.5 rounded-full text-sm font-semibold hover:scale-105 transition-transform cursor-pointer border border-transparent hover:shadow-md`} onClick={() => onNavigate("search")}>
                {skill.icon} {skill.name}
              </button>))}
          </div>
        </div>
      </section>

      {/* Mentor Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-2">Top Mentors</div>
            <h2 className="text-3xl font-bold text-slate-900">Meet Our Expert Mentors</h2>
          </div>
          <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-700" onClick={() => onNavigate("search")}>
            View All →
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {mentors.map(m => (<div key={m.name} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${m.avatarBg} rounded-full flex items-center justify-center text-white font-bold`}>
                  {m.avatar}
                </div>
                <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {m.match}% Match
                </div>
              </div>
              <h3 className="font-bold text-slate-800">{m.name}</h3>
              <p className="text-indigo-600 text-xs font-medium mb-3">{m.type}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.skills.map(s => (<span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>))}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                <span>⭐ {m.rating}</span>
                <span>{m.sessions} sessions</span>
                <span>{m.experience}</span>
              </div>
              <button className="w-full bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-semibold py-2 rounded-xl text-sm transition-all" onClick={() => onNavigate("mentorProfile")}>
                View Profile
              </button>
            </div>))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Built for Every Role in the Ecosystem</h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            {[
            {
                role: "For Students",
                color: "from-indigo-600 to-violet-600",
                emoji: "🎓",
                benefits: [
                    { icon: "🎯", title: "Find the right mentor", desc: "AI-matched recommendations tailored to your exact skills and goals." },
                    { icon: "⚡", title: "Faster doubt solving", desc: "Get answers from domain experts, not generic forums." },
                    { icon: "🚀", title: "Project guidance", desc: "Get hands-on help building real projects for your portfolio." },
                    { icon: "💼", title: "Placement preparation", desc: "Mock interviews, resume reviews, and referrals from industry mentors." },
                ],
            },
            {
                role: "For Mentors",
                color: "from-emerald-500 to-teal-600",
                emoji: "👨‍🏫",
                benefits: [
                    { icon: "🏆", title: "Showcase expertise", desc: "Build a verified profile that highlights your skills and experience." },
                    { icon: "❤️", title: "Help other students", desc: "Give back to the community that shaped your career." },
                    { icon: "📈", title: "Build leadership skills", desc: "Mentoring accelerates your own professional development." },
                    { icon: "⭐", title: "Gain recognition", desc: "Earn badges, ratings, and certificates for your mentoring impact." },
                ],
            },
        ].map(section => (<div key={section.role} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                <div className={`bg-gradient-to-r ${section.color} p-6`}>
                  <span className="text-3xl">{section.emoji}</span>
                  <h3 className="text-xl font-bold text-white mt-2">{section.role}</h3>
                </div>
                <div className="p-6 space-y-4">
                  {section.benefits.map(b => (<div key={b.title} className="flex items-start gap-3">
                      <span className="text-xl">{b.icon}</span>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{b.title}</div>
                        <div className="text-slate-500 text-xs">{b.desc}</div>
                      </div>
                    </div>))}
                </div>
              </div>))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to grow with the right mentor?
          </h2>
          <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">
            Join 12,000+ students who have transformed their academic and career journeys with SkillSwap.
          </p>
          <button className="bg-white text-indigo-700 font-bold px-8 py-4 rounded-xl hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-lg" onClick={() => onNavigate("register")}>
            Get Started — It's Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-bold text-white">SkillSwap</span>
              </div>
              <p className="text-sm max-w-xs">Learn from the right person. Grow with the right guidance.</p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              {["About", "Contact", "Privacy", "Terms", "Help"].map(link => (<a key={link} href="#" className="text-sm hover:text-white transition-colors">{link}</a>))}
            </div>
            <div className="flex items-center gap-3">
              {["𝕏", "in", "📘", "▶"].map(icon => (<button key={icon} className="w-9 h-9 bg-slate-800 hover:bg-indigo-600 rounded-full flex items-center justify-center text-sm transition-colors">
                  {icon}
                </button>))}
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-xs">
            © 2025 SkillSwap. All rights reserved.
          </div>
        </div>
      </footer>
    </div>);
}
