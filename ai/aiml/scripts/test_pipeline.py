import subprocess
import json

def test_ai_pipeline():
    # Mock payload simulating student goals and sample mentors
    payload = {
        "student": {
            "learning_goal": "I want to master React.js and Node.js full-stack web development",
            "cgpa": 8.5,
            "coding_skill_score": 90.0,
            "projects_count": 5
        },
        "mentors": [
            {
                "id": "M001",
                "developer_role": "Senior Full Stack Engineer",
                "years_experience": 6,
                "skills": "React, Node.js, Express, PostgreSQL",
                "bio": "Experienced full-stack engineer passionate about teaching modern React and Node.js web development.",
                "industry": "Fintech"
            },
            {
                "id": "M002",
                "developer_role": "Data Scientist",
                "years_experience": 2,
                "skills": "Python, Pandas, TensorFlow",
                "bio": "Data scientist working on machine learning and predictive analytics pipelines.",
                "industry": "Artificial Intelligence"
            }
        ]
    }

    print("🚀 Running AI Pipeline Test...")
    payload_str = json.dumps(payload)
    
    # Run the inference bridge script via subprocess (just like Node.js backend does)
    result = subprocess.run(
        ['python', 'aiml/scripts/inference_bridge.py', payload_str],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"❌ Error executing pipeline: {result.stderr}")
        return

    try:
        recommendations = json.loads(result.stdout)
        print("\n✅ Pipeline Executed Successfully! Top Ranked Mentors:")
        for idx, mentor in enumerate(recommendations, 1):
            print(f"\n{idx}. Mentor ID: {mentor['id']} ({mentor['developer_role']})")
            print(f"   - SBERT Semantic Match: {mentor['sbert_score']}%")
            print(f"   - Random Forest Fit Score: {mentor['rf_score']}%")
            print(f"   - Final Hybrid Match Score: {mentor['match_score']}%")
    except json.JSONDecodeError:
        print(f"⚠️ Raw Output: {result.stdout}")

if __name__ == '__main__':
    test_ai_pipeline()