import { useEffect, useState } from "react";

export default function Profile() {
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("access_token");

        fetch("http://localhost:5000/profile", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => {
                console.log("PROFILE PAGE:", data);
                setProfile(data.profile);
            });
    }, []);

   return (
    <div className="min-h-screen bg-[#f8f9ff]">
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    My Profile 👤
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Manage your personal information
                </p>
            </div>

            <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold"
            >
                ← Back
            </button>
        </header>

        <main className="p-6 max-w-4xl mx-auto">
            {profile && (
                <>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xl">
                                {profile.name?.charAt(0)?.toUpperCase() || "S"}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {profile.name}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {profile.dept || "Department"} ·{" "}
                                    {profile.student_profiles?.[0]?.semester
                                        ? `${profile.student_profiles[0].semester}th Semester`
                                        : "Semester"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h2 className="font-bold text-slate-800 mb-5">
                            Personal Information
                        </h2>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Full Name</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.name || "N/A"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 mb-1">Email</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.email || "N/A"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 mb-1">College</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.org || "N/A"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 mb-1">Department</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.dept || "N/A"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 mb-1">Phone</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.phone || "N/A"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 mb-1">Semester</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile.student_profiles?.[0]?.semester
                                        ? `${profile.student_profiles[0].semester}th Semester`
                                        : "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </main>
    </div>
);
};