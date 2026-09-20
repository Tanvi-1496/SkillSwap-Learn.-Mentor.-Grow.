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
            alert("Please login first.");
            return;
        }

        const response = await fetch(
            "http://localhost:5000/profile",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer `
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

        alert("Profile saved successfully! 🎉");

        onNavigate("aiRecs");

    } catch (error) {
        console.error("Profile save error:", error);

        alert(
            error.message || "Something went wrong while saving your profile."
        );
    }
};
    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-3xl mx-auto">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">
                        Complete Your Profile
                    </h1>

                    <p className="text-slate-500 mt-2">
                        Tell us what you want to learn and we'll find
                        suitable mentors for you.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-8"
                >

                    {/* Basic Information */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            🎓 Basic Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <input
                                type="text"
                                placeholder="Department"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                className="px-4 py-3 border border-slate-200 rounded-xl outline-none"
                            />

                            <input
                                type="number"
                                placeholder="Semester"
                                value={semester}
                                onChange={e => setSemester(e.target.value)}
                                className="px-4 py-3 border border-slate-200 rounded-xl outline-none"
                            />

                            <input
                                type="number"
                                step="0.01"
                                placeholder="CGPA"
                                value={cgpa}
                                onChange={e => setCgpa(e.target.value)}
                                className="px-4 py-3 border border-slate-200 rounded-xl outline-none"
                            />

                        </div>
                    </section>

                    {/* Skills */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            🛠️ Skills
                        </h2>

                        <div className="flex flex-wrap gap-2">

                            {availableSkills.map(skill => (
                                <button
                                    type="button"
                                    key={skill}
                                    onClick={() => toggleSkill(skill)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                        skills.includes(skill)
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
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
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            🎯 Career Goal
                        </h2>

                        <select
                            value={careerGoal}
                            onChange={e => setCareerGoal(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none"
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
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            📚 Learning Requirements
                        </h2>

                        <textarea
                            value={learningRequirement}
                            onChange={e => setLearningRequirement(e.target.value)}
                            placeholder="What do you want help with?"
                            rows={5}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none resize-none"
                        />
                    </section>

                    {/* Experience Level */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            📈 Experience Level
                        </h2>

                        <div className="flex gap-3 flex-wrap">
                            {["Beginner", "Intermediate", "Advanced"].map(item => (
                                <button
                                    type="button"
                                    key={item}
                                    onClick={() => setLevel(item)}
                                    className={`px-5 py-2.5 rounded-xl border ${
                                        level === item
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "border-slate-200 text-slate-600"
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Preferred Mentor */}
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            👨‍🏫 Preferred Mentor
                        </h2>

                        <select
                            value={preferredMentor}
                            onChange={e => setPreferredMentor(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none"
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
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-all"
                    >
                        Save Profile & Find Mentors →
                    </button>

                </form>
            </div>
        </div>
    );
}
