import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_PASSWORD =
    process.env.DEMO_MENTOR_PASSWORD || "SkillSwap@123";

const mentors = [
    {
        name: "Neha Kulkarni",
        email: "neha.ai@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Python", "Deep Learning", "TensorFlow"],
        experience: 5,
        org: "AI Research Labs",
        dept: "Artificial Intelligence",
        bio: "AI engineer specializing in deep learning, Python and practical TensorFlow projects."
    },
    {
        name: "Rohan Mehta",
        email: "rohan.ml@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["Machine Learning", "NLP", "PyTorch"],
        experience: 4,
        org: "TechNova",
        dept: "Machine Learning",
        bio: "Machine learning professional focused on NLP, PyTorch and applied AI systems."
    },
    {
        name: "Sneha Patil",
        email: "sneha.data@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Python", "SQL", "Data Science"],
        experience: 5,
        org: "DataWorks",
        dept: "Data Analytics",
        bio: "Data scientist helping students learn Python, SQL and practical data analysis."
    },
    {
        name: "Karan Shah",
        email: "karan.data@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["Python", "Pandas", "Machine Learning"],
        experience: 3,
        org: "Analytics Hub",
        dept: "Data Science",
        bio: "Data science mentor specializing in Python, Pandas and machine learning workflows."
    },
    {
        name: "Isha Deshmukh",
        email: "isha.web@skillswap.demo",
        mentor_type: "SENIOR_STUDENT",
        skills: ["HTML", "CSS", "JavaScript"],
        experience: 2,
        org: "Vidyalankar Institute of Technology",
        dept: "Information Technology",
        bio: "Senior student passionate about frontend development and modern web technologies."
    },
    {
        name: "Aditya Joshi",
        email: "aditya.fullstack@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["React", "Node.js", "MongoDB"],
        experience: 4,
        org: "WebSphere Technologies",
        dept: "Full Stack Development",
        bio: "Full stack developer experienced in React, Node.js and MongoDB applications."
    },
    {
        name: "Pooja Nair",
        email: "pooja.react@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["React", "Express", "SQL"],
        experience: 5,
        org: "CodeCraft",
        dept: "Software Engineering",
        bio: "Software engineer specializing in React, Express APIs and SQL databases."
    },
    {
        name: "Vivek Rao",
        email: "vivek.backend@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Node.js", "Express", "PostgreSQL"],
        experience: 6,
        org: "CloudStack",
        dept: "Backend Engineering",
        bio: "Backend engineer focused on Node.js, Express and PostgreSQL systems."
    },
    {
        name: "Meera Iyer",
        email: "meera.java@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["Java", "Spring Boot", "SQL"],
        experience: 5,
        org: "Enterprise Systems",
        dept: "Java Development",
        bio: "Java developer and mentor specializing in Spring Boot and enterprise SQL systems."
    },
    {
        name: "Akash Verma",
        email: "akash.dsa@skillswap.demo",
        mentor_type: "SENIOR_STUDENT",
        skills: ["C++", "DSA", "Competitive Programming"],
        experience: 2,
        org: "Vidyalankar Institute of Technology",
        dept: "Computer Engineering",
        bio: "Competitive programming enthusiast helping students master DSA and problem solving."
    },
    {
        name: "Tanisha Gupta",
        email: "tanisha.algorithms@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["Python", "DSA", "Algorithms"],
        experience: 3,
        org: "AlgoTech",
        dept: "Software Engineering",
        bio: "Software engineer focused on algorithms, Python and interview preparation."
    },
    {
        name: "Sahil Kapoor",
        email: "sahil.dbms@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["SQL", "DBMS", "PostgreSQL"],
        experience: 6,
        org: "Database Solutions",
        dept: "Database Engineering",
        bio: "Database engineer experienced in SQL, DBMS concepts and PostgreSQL."
    },
    {
        name: "Aarav Singh",
        email: "aarav.security@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Cybersecurity", "Networking", "Linux"],
        experience: 5,
        org: "SecureNet",
        dept: "Cybersecurity",
        bio: "Cybersecurity professional helping students understand networking, Linux and security fundamentals."
    },
    {
        name: "Riya Malhotra",
        email: "riya.cloud@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["AWS", "Kubernetes", "Docker"],
        experience: 5,
        org: "CloudScale",
        dept: "Cloud Engineering",
        bio: "Cloud engineer specializing in AWS, Kubernetes and containerized deployments."
    },
    {
        name: "Harsh Vora",
        email: "harsh.devops@skillswap.demo",
        mentor_type: "ALUMNI",
        skills: ["Docker", "Jenkins", "AWS"],
        experience: 4,
        org: "DevOpsWorks",
        dept: "DevOps",
        bio: "DevOps engineer experienced in Docker, Jenkins, AWS and deployment automation."
    },
    {
        name: "Nidhi Bansal",
        email: "nidhi.genai@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Python", "NLP", "Generative AI"],
        experience: 4,
        org: "GenAI Labs",
        dept: "Generative AI",
        bio: "AI engineer working with Python, NLP and generative AI applications."
    },
    {
        name: "Manav Desai",
        email: "manav.cv@skillswap.demo",
        mentor_type: "INDUSTRY",
        skills: ["Python", "OpenCV", "Deep Learning"],
        experience: 5,
        org: "VisionTech",
        dept: "Computer Vision",
        bio: "Computer vision engineer specializing in Python, OpenCV and deep learning."
    }
];

function buildEmbeddingText(mentor) {
    return `
Name: ${mentor.name}.
Skills: ${mentor.skills.join(", ")}.
Mentor type: ${mentor.mentor_type}.
Experience: ${mentor.experience} years.
Organization: ${mentor.org}.
Department: ${mentor.dept}.
Bio: ${mentor.bio}.
`.trim();
}

async function main() {
    console.log(`Processing ${mentors.length} demo mentor accounts...`);

    // Get existing Supabase Auth users.
    const { data: authData, error: authListError } =
        await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });

    if (authListError) {
        console.error(
            "Could not fetch Auth users:",
            authListError.message
        );
        return;
    }

    const authUsers = authData.users;

    for (const mentor of mentors) {
        console.log(`\nProcessing: ${mentor.name}`);

        let userId;

        // --------------------------------------------------
        // 1. Check public.users
        // --------------------------------------------------
        const { data: existingUser, error: existingUserError } =
            await supabaseAdmin
                .from("users")
                .select("id")
                .eq("email", mentor.email)
                .maybeSingle();

        if (existingUserError) {
            console.error(
                `Could not check public.users for ${mentor.email}:`,
                existingUserError.message
            );
            continue;
        }

        if (existingUser) {
            userId = existingUser.id;

            console.log(
                "public.users already exists:",
                userId
            );
        } else {
            // --------------------------------------------------
            // 2. Find the Auth account created earlier
            // --------------------------------------------------
            const existingAuthUser = authUsers.find(
                (user) =>
                    user.email?.toLowerCase() ===
                    mentor.email.toLowerCase()
            );

            if (existingAuthUser) {
                userId = existingAuthUser.id;

                console.log(
                    "Using existing Auth user:",
                    userId
                );
            } else {
                // --------------------------------------------------
                // 3. Create Auth user only if absolutely necessary
                // --------------------------------------------------
                const { data: newAuthData, error: authError } =
                    await supabaseAdmin.auth.admin.createUser({
                        email: mentor.email,
                        password: DEMO_PASSWORD,
                        email_confirm: true,
                        user_metadata: {
                            name: mentor.name,
                            role: "mentor"
                        }
                    });

                if (authError) {
                    console.error(
                        `Auth creation failed for ${mentor.email}:`,
                        authError.message
                    );
                    continue;
                }

                userId = newAuthData.user.id;

                console.log(
                    "Created Auth user:",
                    userId
                );
            }

            // --------------------------------------------------
            // 4. Create public.users
            // --------------------------------------------------
            const { error: userError } =
                await supabaseAdmin
                    .from("users")
                    .insert({
                        id: userId,
                        name: mentor.name,
                        email: mentor.email,
                        role: "mentor",
                        org: mentor.org,
                        dept: mentor.dept
                    });

            if (userError) {
                console.error(
                    `public.users insert failed for ${mentor.email}:`,
                    userError.message
                );
                continue;
            }

            console.log("Created public.users record");
        }

        // --------------------------------------------------
        // 5. Create/update mentor profile
        // --------------------------------------------------
        const { error: mentorError } =
            await supabaseAdmin
                .from("mentor_profiles")
                .upsert(
                    {
                        user_id: userId,
                        mentor_type: mentor.mentor_type,
                        skills: mentor.skills,
                        experience: mentor.experience,
                        bio: mentor.bio,
                        org: mentor.org,
                        verified: true
                    },
                    {
                        onConflict: "user_id"
                    }
                );

        if (mentorError) {
            console.error(
                `mentor_profiles failed for ${mentor.name}:`,
                mentorError.message
            );
            continue;
        }

        console.log("Mentor profile created/updated");

        // --------------------------------------------------
        // 6. Generate SBERT embedding
        // --------------------------------------------------
        try {
            const response = await fetch(
                `${process.env.AI_SERVICE_URL}/embed`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        profile_id: userId,
                        profile_type: "mentor",
                        text: buildEmbeddingText(mentor)
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                console.error(
                    `Embedding failed for ${mentor.name}:`,
                    result
                );
            } else {
                console.log(
                    `Embedding created for ${mentor.name}`
                );
            }
        } catch (embeddingError) {
            console.error(
                `AI service unavailable for ${mentor.name}:`,
                embeddingError.message
            );
        }
    }

    console.log("\nMentor seeding completed.");
}

main().catch((error) => {
    console.error("Seed script failed:", error);
    process.exit(1);
});