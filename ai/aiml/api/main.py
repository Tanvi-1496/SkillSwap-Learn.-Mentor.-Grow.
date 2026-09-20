from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os


# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# --------------------------------------------------
# FastAPI app
# --------------------------------------------------

app = FastAPI(title="SkillSwap AI Matching Service")


# --------------------------------------------------
# Load SBERT model once
# --------------------------------------------------

model = SentenceTransformer("all-MiniLM-L6-v2")


# --------------------------------------------------
# Request model
# --------------------------------------------------

class EmbedRequest(BaseModel):
    profile_id: str
    profile_type: str
    text: str


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "SkillSwap AI service is running"
    }


# --------------------------------------------------
# Test Supabase connection
# --------------------------------------------------

@app.get("/test-supabase")
def test_supabase():

    try:

        result = (
            supabase
            .table("users")
            .select("id")
            .limit(1)
            .execute()
        )

        return {
            "status": "success",
            "message": "Supabase connection is working",
            "rows_found": len(result.data)
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }


# --------------------------------------------------
# Generate and store embedding
# --------------------------------------------------

@app.post("/embed")
def generate_embedding(request: EmbedRequest):
    embedding = model.encode(request.text).tolist()

    existing = (
        supabase
        .table("profile_embeddings")
        .select("profile_id")
        .eq("profile_id", request.profile_id)
        .eq("profile_type", request.profile_type)
        .execute()
    )

    if existing.data:
        (
            supabase
            .table("profile_embeddings")
            .update({
                "embedding": embedding
            })
            .eq("profile_id", request.profile_id)
            .eq("profile_type", request.profile_type)
            .execute()
        )
    else:
        (
            supabase
            .table("profile_embeddings")
            .insert({
                "profile_id": request.profile_id,
                "profile_type": request.profile_type,
                "embedding": embedding
            })
            .execute()
        )

    return {
        "message": "Embedding generated and stored successfully",
        "profile_id": request.profile_id,
        "profile_type": request.profile_type,
        "dimensions": len(embedding)
    }


# --------------------------------------------------
# Calculate goal/domain match
# --------------------------------------------------

def calculate_goal_match(student_profile, mentor_profile):

    student_goal = (
        student_profile.get("career_goal") or ""
    ).lower()

    learning_requirement = (
        student_profile.get("learning_requirement") or ""
    ).lower()

    student_skills = [
        str(skill).lower()
        for skill in (student_profile.get("skills") or [])
    ]

    mentor_skills = [
        str(skill).lower()
        for skill in (mentor_profile.get("skills") or [])
    ]

    # Combine student requirements
    student_text = (
        student_goal
        + " "
        + learning_requirement
        + " "
        + " ".join(student_skills)
    )

    # Count matching skills/keywords
    matches = 0

    for skill in mentor_skills:

        if skill in student_text:
            matches += 1

    if len(mentor_skills) == 0:
        return 0.0

    return min(matches / len(mentor_skills), 1.0)


# --------------------------------------------------
# Normalize experience
# --------------------------------------------------

def calculate_experience_score(experience):

    if experience is None:
        return 0.0

    # Cap normalization at 10 years
    return min(float(experience) / 10.0, 1.0)


# --------------------------------------------------
# Get mentor rating
# --------------------------------------------------

def get_mentor_rating(mentor_id):

    result = (
        supabase
        .table("reviews")
        .select("rating")
        .eq("mentor_id", mentor_id)
        .execute()
    )

    ratings = [
        float(row["rating"])
        for row in result.data
        if row.get("rating") is not None
    ]

    if not ratings:
        return 0.0

    average_rating = sum(ratings) / len(ratings)

    return min(average_rating / 5.0, 1.0)


# --------------------------------------------------
# Get mentor availability
# --------------------------------------------------

def get_availability_score(mentor_id):

    result = (
        supabase
        .table("availability")
        .select("mentor_id")
        .eq("mentor_id", mentor_id)
        .limit(1)
        .execute()
    )

    if result.data:
        return 1.0

    return 0.0


# --------------------------------------------------
# Get top mentor recommendations
# --------------------------------------------------

@app.get("/recommendations/{student_id}")
def get_recommendations(student_id: str):

    # --------------------------------------------------
    # Get student profile
    # --------------------------------------------------

    student_result = (
        supabase
        .table("student_profiles")
        .select(
            "user_id,skills,career_goal,"
            "learning_requirement,level,semester"
        )
        .eq("user_id", student_id)
        .single()
        .execute()
    )

    student_profile = student_result.data

    # --------------------------------------------------
    # Get student's embedding
    # --------------------------------------------------

    embedding_result = (
        supabase
        .table("profile_embeddings")
        .select("embedding")
        .eq("profile_id", student_id)
        .eq("profile_type", "student")
        .single()
        .execute()
    )

    student_embedding = embedding_result.data["embedding"]

    # --------------------------------------------------
    # Get top semantic matches
    # --------------------------------------------------

    matches = (
        supabase
        .rpc(
            "match_mentors",
            {
                "query_embedding": student_embedding,
                "match_count": 3
            }
        )
        .execute()
    )

    recommendations = []

    # --------------------------------------------------
    # Calculate weighted score
    # --------------------------------------------------

    for match in matches.data:

        mentor_id = match["profile_id"]

        similarity = float(match["similarity"])

        # Get mentor profile
        mentor_result = (
            supabase
            .table("mentor_profiles")
            .select(
                "user_id,mentor_type,skills,"
                "experience,bio,org,verified"
            )
            .eq("user_id", mentor_id)
            .single()
            .execute()
        )

        mentor_profile = mentor_result.data

        # Calculate components

        goal_match = calculate_goal_match(
            student_profile,
            mentor_profile
        )

        experience_score = calculate_experience_score(
            mentor_profile.get("experience")
        )

        rating_score = get_mentor_rating(
            mentor_id
        )

        availability_score = get_availability_score(
            mentor_id
        )

        # --------------------------------------------------
        # Final weighted score
        # --------------------------------------------------

        final_score = (
            0.60 * similarity
            + 0.15 * goal_match
            + 0.10 * experience_score
            + 0.10 * rating_score
            + 0.05 * availability_score
        )

        recommendations.append({

            "profile_id": mentor_id,

            "mentor_type": mentor_profile.get(
                "mentor_type"
            ),

            "skills": mentor_profile.get(
                "skills"
            ),

            "experience": mentor_profile.get(
                "experience"
            ),

            "bio": mentor_profile.get(
                "bio"
            ),

            "organization": mentor_profile.get(
                "org"
            ),

            "verified": mentor_profile.get(
                "verified"
            ),

            "semantic_similarity": round(
                similarity,
                4
            ),

            "goal_match": round(
                goal_match,
                4
            ),

            "experience_score": round(
                experience_score,
                4
            ),

            "rating_score": round(
                rating_score,
                4
            ),

            "availability_score": round(
                availability_score,
                4
            ),

            "final_score": round(
                final_score,
                4
            )
        })

    # --------------------------------------------------
    # Sort by final score
    # --------------------------------------------------

    recommendations.sort(
        key=lambda x: x["final_score"],
        reverse=True
    )

    # --------------------------------------------------
    # Return top 3
    # --------------------------------------------------

    return {
        "student_id": student_id,
        "recommendations": recommendations[:3]
    }