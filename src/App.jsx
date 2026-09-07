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
export default function App() {
    const [page, setPage] = useState("landing");
    const nav = (p) => setPage(p);
    return (<div className="h-full font-[Plus_Jakarta_Sans,system-ui,sans-serif]">
      {/* Demo Nav Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-wrap justify-center gap-1.5 bg-slate-900/95 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-2xl border border-slate-700 max-w-[95vw]">
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
        ].map(item => (<button key={item.page} className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${page === item.page ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"}`} onClick={() => nav(item.page)}>
            {item.label}
          </button>))}
      </div>

      {page === "landing" && <Landing onNavigate={nav}/>}
      {page === "login" && <Auth mode="login" onNavigate={nav}/>}
      {page === "register" && <Auth mode="register" onNavigate={nav}/>}
      {page === "menteeDashboard" && <MenteeDashboard onNavigate={nav}/>}
      {page === "aiRecs" && <AIRecommendations onNavigate={nav}/>}
      {page === "mentorProfile" && <MentorProfile onNavigate={nav}/>}
      {page === "booking" && <BookingFlow onNavigate={nav}/>}
      {page === "bookings" && <MyBookings onNavigate={nav}/>}
      {page === "search" && <SearchMentors onNavigate={nav}/>}
      {page === "mentorDashboard" && <MentorDashboard onNavigate={nav}/>}
      {page === "adminDashboard" && <AdminDashboard onNavigate={nav}/>}
    </div>);
}
