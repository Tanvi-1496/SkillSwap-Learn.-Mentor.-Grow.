import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function MenteeRequirements({ onNavigate }) {
    const [skills, setSkills] = useState([]);
    const [careerGoal, setCareerGoal] = useState("");
    const [learningRequirement, setLearningRequirement] = useState("");
    const [level, setLevel] = useState("");
    const [preferredMentor, setPreferredMentor] = useState("");
    const [department, setDepartment] = useState("");
    const [semester, setSemester] = useState("");
    const [cgpa, setCgpa] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const availableSkills = [
        "Python",
        "Java",
        "C++",
        "SQL",
        "Machine Learning",
        "React",
        "DSA"
    ];

    const toggleSkill = (skill) => {
        setSkills(prev =>
            prev.includes(skill)
                ? prev.filter(s => s !== skill)
                : [...prev, skill]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFeedback(null);
        setIsSaving(true);

        try {
            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) {
                throw new Error(sessionError.message);
            }

            const token = session?.access_token;

            if (!token) {
                setFeedback({ type: "error", message: "Please log in first to save your profile." });
                setIsSaving(false);
                return;
            }

            const response = await fetch(
                "http://localhost:5000/profile",
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        department,
                        semester,
                        skills,
                        careerGoal,
                        learningRequirement,
                        level
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to save profile");
            }

            console.log("Profile saved:", data);
            setFeedback({ type: "success", message: "Profile saved successfully! Finding your matching mentors... 🎉" });
            setTimeout(() => {
                onNavigate("aiRecs");
            }, 1000);

        } catch (error) {
            console.error("Profile save error:", error);
            setFeedback({
                type: "error",
                message: error.message || "Something went wrong while saving your profile."
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F7FC] p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
                {/* Back to Dashboard Navigation */}
                <div className="mb-6 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => onNavigate("menteeDashboard")}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#172033] hover:text-[#4F46E5] transition-colors bg-white px-3.5 py-2 rounded-xl border border-[#E5E7EB] shadow-xs hover:border-[#4F46E5]/40"
                    >
                        <span>←</span>
                        <span>Back to Dashboard</span>
                    </button>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-[#EEF0FF] text-[#4F46E5] rounded-full border border-[#EEF0FF]">
                        Profile Setup
                    </span>
                </div>

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

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#172033]">
                        Complete Your Profile
                    </h1>

                    <p className="text-[#718096] mt-2 text-sm">
                        Tell us what you want to learn and we'll find
                        suitable mentors for you.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-xs border border-[#E5E7EB] space-y-8"
                >

                    {/* Basic Information */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            🎓 Basic Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <input
                                type="text"
                                placeholder="Department"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                className="px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all"
                            />

                            <input
                                type="number"
                                placeholder="Semester"
                                value={semester}
                                onChange={e => setSemester(e.target.value)}
                                className="px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all"
                            />

                            <input
                                type="number"
                                step="0.01"
                                placeholder="CGPA"
                                value={cgpa}
                                onChange={e => setCgpa(e.target.value)}
                                className="px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all"
                            />

                        </div>
                    </section>

                    {/* Skills */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            🛠️ Skills
                        </h2>

                        <div className="flex flex-wrap gap-2">

                            {availableSkills.map(skill => (
                                <button
                                    type="button"
                                    key={skill}
                                    onClick={() => toggleSkill(skill)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                                        skills.includes(skill)
                                            ? "bg-[#4F46E5] text-white shadow-xs"
                                            : "bg-[#EEF0FF] text-[#4F46E5] hover:bg-[#EEF0FF]/80"
                                    }`}
                                >
                                    {skills.includes(skill) ? "✓ " : ""}
                                    {skill}
                                </button>
                            ))}

                        </div>
                    </section>

                    {/* Career Goal */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            🎯 Career Goal
                        </h2>

                        <select
                            value={careerGoal}
                            onChange={e => setCareerGoal(e.target.value)}
                            className="w-full px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all cursor-pointer"
                        >
                            <option value="">Select career goal</option>
                            <option>Placement</option>
                            <option>Internship</option>
                            <option>Higher Studies</option>
                            <option>Project Development</option>
                            <option>Skill Development</option>
                            <option>Interview Preparation</option>
                        </select>
                    </section>

                    {/* Learning Requirements */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            📚 Learning Requirements
                        </h2>

                        <textarea
                            value={learningRequirement}
                            onChange={e => setLearningRequirement(e.target.value)}
                            placeholder="What do you want help with?"
                            rows={5}
                            className="w-full px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder:text-[#718096] outline-none resize-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all"
                        />
                    </section>

                    {/* Experience Level */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            📈 Experience Level
                        </h2>

                        <div className="flex gap-3 flex-wrap">
                            {["Beginner", "Intermediate", "Advanced"].map(item => (
                                <button
                                    type="button"
                                    key={item}
                                    onClick={() => setLevel(item)}
                                    className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                                        level === item
                                            ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs"
                                            : "border-[#E5E7EB] bg-[#F5F7FC] text-[#172033] hover:bg-[#EEF0FF] hover:text-[#4F46E5]"
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Preferred Mentor */}
                    <section>
                        <h2 className="text-base font-bold text-[#172033] mb-4">
                            👨‍🏫 Preferred Mentor
                        </h2>

                        <select
                            value={preferredMentor}
                            onChange={e => setPreferredMentor(e.target.value)}
                            className="w-full px-4 py-3 bg-[#F5F7FC] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF0FF] transition-all cursor-pointer"
                        >
                            <option value="">Select preference</option>
                            <option>Senior Student</option>
                            <option>Faculty</option>
                            <option>Alumni</option>
                            <option>Industry Professional</option>
                            <option>No Preference</option>
                        </select>
                    </section>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                            isSaving ? "opacity-75 cursor-not-allowed" : ""
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                <span>Saving Profile...</span>
                            </>
                        ) : (
                            <span>Save Profile & Find Mentors →</span>
                        )}
                    </button>

                </form>
            </div>
        </div>
    );
}
