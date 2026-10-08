from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillswap_ai")

# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
SUPABASE_KEY = (os.getenv("SUPABASE_KEY") or "").strip()

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# --------------------------------------------------
# FastAPI app
# --------------------------------------------------

app = FastAPI(title="SkillSwap AI Matching Service")

# --------------------------------------------------
# CORS Middleware (Local development origins)
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8443",
        "http://localhost:5000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    try:
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

    except Exception as e:
        logger.error(f"Failed to generate embedding for {request.profile_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate or store embedding"
        )


# --------------------------------------------------
# Calculate goal/domain match
# --------------------------------------------------

def calculate_goal_match(student_profile, mentor_profile):
    """
    Calculates goal/skill match between student requirements and mentor profile.
    Uses normalized token and multi-word phrase matching to avoid spurious substring collisions.
    """
    student_goal = (student_profile.get("career_goal") or "").strip().lower()
    learning_requirement = (student_profile.get("learning_requirement") or "").strip().lower()

    student_skills_raw = student_profile.get("skills") or []
    student_skills_set = {
        str(skill).strip().lower()
        for skill in student_skills_raw
        if str(skill).strip()
    }

    mentor_skills_raw = mentor_profile.get("skills") or []
    mentor_skills = [
        str(skill).strip().lower()
        for skill in mentor_skills_raw
        if str(skill).strip()
    ]

    if not mentor_skills:
        return 0.0

    # Combine student text with normalized whitespace
    student_text_parts = [
        student_goal,
        learning_requirement,
        " ".join(student_skills_set)
    ]
    student_text = " ".join(" ".join(student_text_parts).split())

    matches = 0

    for skill in mentor_skills:
        # 1. Exact match in declared student skills
        if skill in student_skills_set:
            matches += 1
            continue

        # 2. Token / phrase boundary match in combined student text
        # Word boundary pattern (?<![a-zA-Z0-9]) ... (?![a-zA-Z0-9]) safely handles
        # multi-word phrases ("machine learning") and symbols ("c++", "node.js")
        # without false positive matches (e.g. "c" in "react").
        pattern = rf'(?<![a-zA-Z0-9]){re.escape(skill)}(?![a-zA-Z0-9])'
        if re.search(pattern, student_text):
            matches += 1

    return min(matches / len(mentor_skills), 1.0)


# --------------------------------------------------
# Normalize experience
# --------------------------------------------------

def calculate_experience_score(experience):
    if experience is None:
        return 0.0
    try:
        exp_val = float(experience)
        if exp_val < 0:
            return 0.0
        # Cap normalization at 10 years
        return min(exp_val / 10.0, 1.0)
    except (ValueError, TypeError):
        return 0.0


# --------------------------------------------------
# Get mentor rating
# --------------------------------------------------

def get_mentor_rating(mentor_id):
    try:
        result = (
            supabase
            .table("reviews")
            .select("rating")
            .eq("mentor_id", mentor_id)
            .execute()
        )

        ratings = [
            float(row["rating"])
            for row in (result.data or [])
            if row.get("rating") is not None
        ]

        if not ratings:
            return 0.0

        average_rating = sum(ratings) / len(ratings)
        return min(average_rating / 5.0, 1.0)

    except Exception as e:
        logger.warning(f"Error fetching reviews for mentor {mentor_id}: {e}")
        return 0.0


# --------------------------------------------------
# Get mentor availability
# --------------------------------------------------

def get_availability_score(mentor_id):
    try:
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

    except Exception as e:
        logger.warning(f"Error fetching availability for mentor {mentor_id}: {e}")
        return 0.0


# --------------------------------------------------
# Get top mentor recommendations
# --------------------------------------------------

@app.get("/recommendations/{student_id}")
def get_recommendations(student_id: str):
    # --------------------------------------------------
    # 1. Get student profile safely
    # --------------------------------------------------
    try:
        student_result = (
            supabase
            .table("student_profiles")
            .select(
                "user_id,skills,career_goal,"
                "learning_requirement,level,semester"
            )
            .eq("user_id", student_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Database error fetching profile for student {student_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error retrieving student profile from database"
        )

    student_profile = student_result.data if (student_result and hasattr(student_result, "data")) else None
    if not student_profile:
        raise HTTPException(
            status_code=404,
            detail=f"Student profile not found for user {student_id}"
        )

    # --------------------------------------------------
    # 2. Get student's embedding safely
    # --------------------------------------------------
    try:
        embedding_result = (
            supabase
            .table("profile_embeddings")
            .select("embedding")
            .eq("profile_id", student_id)
            .eq("profile_type", "student")
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Database error fetching embedding for student {student_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error retrieving student embedding from database"
        )

    embedding_data = embedding_result.data if (embedding_result and hasattr(embedding_result, "data")) else None
    if not embedding_data or not embedding_data.get("embedding"):
        raise HTTPException(
            status_code=404,
            detail=f"Student profile embedding not found for user {student_id}"
        )

    student_embedding = embedding_data["embedding"]
    if isinstance(student_embedding, str):
        import json
        try:
            student_embedding = json.loads(student_embedding)
        except Exception:
            pass

    # --------------------------------------------------
    # 3. Candidate Generation: Get top 15 semantic matches
    # --------------------------------------------------
    try:
        matches = (
            supabase
            .rpc(
                "match_mentors",
                {
                    "query_embedding": student_embedding,
                    "match_count": 15
                }
            )
            .execute()
        )
    except Exception as e:
        logger.error(f"Error querying match_mentors RPC for {student_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error computing semantic mentor matches"
        )

    if not matches.data:
        return {
            "student_id": student_id,
            "recommendations": []
        }

    recommendations = []

    # --------------------------------------------------
    # 4. Multi-Factor Reranking across candidates
    # --------------------------------------------------
    candidate_ids = [
        match.get("profile_id")
        for match in matches.data
        if match.get("profile_id")
    ]

    if not candidate_ids:
        return {
            "student_id": student_id,
            "recommendations": []
        }

    # Batch fetch mentor profiles, reviews, and availability in 3 efficient calls
    try:
        mentor_profiles_res = (
            supabase
            .table("mentor_profiles")
            .select(
                "user_id,mentor_type,skills,"
                "experience,bio,org,verified"
            )
            .in_("user_id", candidate_ids)
            .execute()
        )
        mentor_profiles_map = {
            p["user_id"]: p
            for p in (mentor_profiles_res.data or [])
        }
    except Exception as e:
        logger.warning(f"Error batch fetching mentor profiles: {e}")
        mentor_profiles_map = {}

    try:
        reviews_res = (
            supabase
            .table("reviews")
            .select("mentor_id,rating")
            .in_("mentor_id", candidate_ids)
            .execute()
        )
        reviews_by_mentor = {}
        for r in (reviews_res.data or []):
            m_id = r.get("mentor_id")
            rating_val = r.get("rating")
            if m_id and rating_val is not None:
                reviews_by_mentor.setdefault(m_id, []).append(float(rating_val))
    except Exception as e:
        logger.warning(f"Error batch fetching reviews: {e}")
        reviews_by_mentor = {}

    try:
        avail_res = (
            supabase
            .table("availability")
            .select("mentor_id")
            .in_("mentor_id", candidate_ids)
            .execute()
        )
        available_mentor_set = {
            a["mentor_id"]
            for a in (avail_res.data or [])
            if a.get("mentor_id")
        }
    except Exception as e:
        logger.warning(f"Error batch fetching availability: {e}")
        available_mentor_set = set()

    for match in matches.data:
        mentor_id = match.get("profile_id")
        if not mentor_id:
            continue

        mentor_profile = mentor_profiles_map.get(mentor_id)
        if not mentor_profile:
            continue

        raw_sim = match.get("similarity")
        try:
            similarity = float(raw_sim)
            if similarity != similarity:  # Check for NaN
                similarity = 0.0
        except (ValueError, TypeError):
            similarity = 0.0

        # Calculate scoring components
        goal_match = calculate_goal_match(
            student_profile,
            mentor_profile
        )

        experience_score = calculate_experience_score(
            mentor_profile.get("experience")
        )

        mentor_ratings = reviews_by_mentor.get(mentor_id, [])
        if mentor_ratings:
            avg_rating = sum(mentor_ratings) / len(mentor_ratings)
            rating_score = min(avg_rating / 5.0, 1.0)
        else:
            rating_score = 0.0

        availability_score = 1.0 if mentor_id in available_mentor_set else 0.0

        # --------------------------------------------------
        # Final weighted score: 60% semantic + 15% goal + 10% exp + 10% rating + 5% avail
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
            "mentor_type": mentor_profile.get("mentor_type"),
            "skills": mentor_profile.get("skills") or [],
            "experience": mentor_profile.get("experience"),
            "bio": mentor_profile.get("bio"),
            "organization": mentor_profile.get("org"),
            "verified": bool(mentor_profile.get("verified")),
            "semantic_similarity": round(similarity, 4),
            "goal_match": round(goal_match, 4),
            "experience_score": round(experience_score, 4),
            "rating_score": round(rating_score, 4),
            "availability_score": round(availability_score, 4),
            "final_score": round(final_score, 4)
        })

    # --------------------------------------------------
    # 5. Sort descending by final score
    # --------------------------------------------------
    recommendations.sort(
        key=lambda x: x["final_score"],
        reverse=True
    )

    # --------------------------------------------------
    # 6. Return ONLY Top 3
    # --------------------------------------------------
    return {
        "student_id": student_id,
        "recommendations": recommendations[:3]
    }