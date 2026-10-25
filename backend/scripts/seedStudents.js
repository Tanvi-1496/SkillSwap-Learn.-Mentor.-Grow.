import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_STUDENT_PASSWORD =
    process.env.DEMO_STUDENT_PASSWORD || "SkillSwap@123";

const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// --------------------------------------------------
// 18 NEW STUDENTS
// --------------------------------------------------

const students = [
    {
        name: "Aarohi Sharma",
        email: "aarohi.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 5,
        skills: ["Python", "Machine Learning", "SQL"],
        career_goal: "Machine Learning Engineer",
        learning_requirement: "Machine learning projects and interview preparation",
        level: "Intermediate",
    },
    {
        name: "Yash Patil",
        email: "yash.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["Java", "DSA", "OOP"],
        career_goal: "Software Developer",
        learning_requirement: "DSA and Java interview preparation",
        level: "Intermediate",
    },
    {
        name: "Ananya Joshi",
        email: "ananya.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["React", "JavaScript", "HTML"],
        career_goal: "Frontend Developer",
        learning_requirement: "React projects and frontend development",
        level: "Beginner",
    },
    {
        name: "Rahul Desai",
        email: "rahul.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 6,
        skills: ["Node.js", "Express", "MongoDB"],
        career_goal: "Backend Developer",
        learning_requirement: "Backend development and REST APIs",
        level: "Intermediate",
    },
    {
        name: "Simran Shah",
        email: "simran.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["Python", "Data Science", "Pandas"],
        career_goal: "Data Scientist",
        learning_requirement: "Data analysis and machine learning",
        level: "Intermediate",
    },
    {
        name: "Om Kulkarni",
        email: "om.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 4,
        skills: ["C++", "DSA", "Algorithms"],
        career_goal: "Software Engineer",
        learning_requirement: "Competitive programming and DSA",
        level: "Beginner",
    },
    {
        name: "Diya Nair",
        email: "diya.student@skillswap.demo",
        dept: "Information Technology",
        semester: 6,
        skills: ["AWS", "Docker", "Linux"],
        career_goal: "Cloud Engineer",
        learning_requirement: "Cloud computing and DevOps",
        level: "Intermediate",
    },
    {
        name: "Arjun Mehta",
        email: "arjun.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 5,
        skills: ["Java", "Spring Boot", "SQL"],
        career_goal: "Backend Developer",
        learning_requirement: "Spring Boot and backend projects",
        level: "Intermediate",
    },
    {
        name: "Kavya Iyer",
        email: "kavya.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["Python", "NLP", "Machine Learning"],
        career_goal: "AI Engineer",
        learning_requirement: "NLP and AI project development",
        level: "Intermediate",
    },
    {
        name: "Dev Malhotra",
        email: "dev.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 6,
        skills: ["Cybersecurity", "Networking", "Linux"],
        career_goal: "Cybersecurity Analyst",
        learning_requirement: "Cybersecurity fundamentals and networking",
        level: "Beginner",
    },
    {
        name: "Ishita Rao",
        email: "ishita.student@skillswap.demo",
        dept: "Information Technology",
        semester: 4,
        skills: ["HTML", "CSS", "JavaScript"],
        career_goal: "Web Developer",
        learning_requirement: "Web development and frontend projects",
        level: "Beginner",
    },
    {
        name: "Rishabh Verma",
        email: "rishabh.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 5,
        skills: ["Python", "OpenCV", "Deep Learning"],
        career_goal: "Computer Vision Engineer",
        learning_requirement: "Computer vision projects",
        level: "Intermediate",
    },
    {
        name: "Mehak Gupta",
        email: "mehak.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["SQL", "DBMS", "PostgreSQL"],
        career_goal: "Database Developer",
        learning_requirement: "SQL, DBMS and database interviews",
        level: "Intermediate",
    },
    {
        name: "Siddhant Rao",
        email: "siddhant.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 6,
        skills: ["React", "Node.js", "MongoDB"],
        career_goal: "Full Stack Developer",
        learning_requirement: "Full stack web development",
        level: "Intermediate",
    },
    {
        name: "Tanya Kapoor",
        email: "tanya.student@skillswap.demo",
        dept: "Information Technology",
        semester: 5,
        skills: ["Python", "Generative AI", "NLP"],
        career_goal: "AI Engineer",
        learning_requirement: "Generative AI and LLM projects",
        level: "Intermediate",
    },
    {
        name: "Manish Singh",
        email: "manish.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 4,
        skills: ["C", "C++", "DSA"],
        career_goal: "Software Developer",
        learning_requirement: "Programming fundamentals and DSA",
        level: "Beginner",
    },
    {
        name: "Riya Deshmukh",
        email: "riya.student@skillswap.demo",
        dept: "Information Technology",
        semester: 6,
        skills: ["AWS", "Kubernetes", "Docker"],
        career_goal: "DevOps Engineer",
        learning_requirement: "DevOps and cloud deployment",
        level: "Intermediate",
    },
    {
        name: "Atharv Joshi",
        email: "atharv.student@skillswap.demo",
        dept: "Computer Engineering",
        semester: 5,
        skills: ["Python", "TensorFlow", "Deep Learning"],
        career_goal: "Deep Learning Engineer",
        learning_requirement: "Deep learning projects and model deployment",
        level: "Advanced",
    },
];

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

async function getExistingAuthUser(email) {
    const { data, error } =
        await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
        });

    if (error) {
        throw new Error(`Could not list Auth users: ${error.message}`);
    }

    return data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
    );
}

async function createOrGetAuthUser(student) {
    const existingUser = await getExistingAuthUser(student.email);

    if (existingUser) {
        console.log(`Auth user already exists: ${student.email}`);
        return existingUser;
    }

    const { data, error } =
        await supabaseAdmin.auth.admin.createUser({
            email: student.email,
            password: DEMO_STUDENT_PASSWORD,
            email_confirm: true,
            user_metadata: {
                name: student.name,
                role: "student",
            },
        });

    if (error) {
        throw new Error(
            `Auth user creation failed: ${error.message}`
        );
    }

    console.log(`Auth user created: ${student.email}`);

    return data.user;
}

async function createOrUpdatePublicUser(user, student) {
    const { data: existingUser, error: findError } =
        await supabaseAdmin
            .from("users")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

    if (findError) {
        throw new Error(
            `Could not check public.users: ${findError.message}`
        );
    }

    if (existingUser) {
        console.log(`public.users already exists: ${user.id}`);
        return;
    }

    const { error } = await supabaseAdmin
        .from("users")
        .insert({
            id: user.id,
            name: student.name,
            email: student.email,
            role: "student",
            org: "Vidyalankar Institute of Technology",
            dept: student.dept,
        });

    if (error) {
        throw new Error(
            `public.users insert failed: ${error.message}`
        );
    }

    console.log(`public.users created: ${user.id}`);
}

async function createOrUpdateStudentProfile(user, student) {
    const { data: existingProfile, error: findError } =
        await supabaseAdmin
            .from("student_profiles")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

    if (findError) {
        throw new Error(
            `Could not check student_profiles: ${findError.message}`
        );
    }

    const profileData = {
        user_id: user.id,
        skills: student.skills,
        career_goal: student.career_goal,
        learning_requirement: student.learning_requirement,
        level: student.level,
        semester: student.semester,
    };

    if (existingProfile) {
        const { error } = await supabaseAdmin
            .from("student_profiles")
            .update(profileData)
            .eq("user_id", user.id);

        if (error) {
            throw new Error(
                `Student profile update failed: ${error.message}`
            );
        }

        console.log("Student profile updated");
    } else {
        const { error } = await supabaseAdmin
            .from("student_profiles")
            .insert(profileData);

        if (error) {
            throw new Error(
                `Student profile insert failed: ${error.message}`
            );
        }

        console.log("Student profile created");
    }
}

async function generateEmbedding(user, student) {
    const embeddingText = `
Skills: ${student.skills.join(", ")}.
Career goal: ${student.career_goal}.
Learning requirement: ${student.learning_requirement}.
Level: ${student.level}.
Semester: ${student.semester}.
Department: ${student.dept}.
`.trim();

    const response = await fetch(`${AI_SERVICE_URL}/embed`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            profile_id: user.id,
            profile_type: "student",
            text: embeddingText,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Embedding failed: ${response.status} ${errorText}`
        );
    }

    const result = await response.json();

    console.log(
        `Embedding created for ${user.id} (${result.dimensions || 384} dimensions)`
    );
}

// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function seedStudents() {
    console.log("Starting student seeding...\n");

    for (const student of students) {
        console.log(`Processing: ${student.name}`);

        try {
            // 1. Create/reuse Supabase Auth user
            const user = await createOrGetAuthUser(student);

            // 2. Create public.users record
            await createOrUpdatePublicUser(user, student);

            // 3. Create/update student profile
            await createOrUpdateStudentProfile(user, student);

            // 4. Generate SBERT embedding
            await generateEmbedding(user, student);

            console.log(`Completed: ${student.name}\n`);
        } catch (error) {
            console.error(
                `FAILED: ${student.name}`,
                error.message
            );
            console.log("");
        }
    }

    console.log("Student seeding completed.");
}

seedStudents();