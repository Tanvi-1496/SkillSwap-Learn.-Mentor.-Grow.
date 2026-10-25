import sys
import json
import os
import joblib
import numpy as np
from sentence_transformers import SentenceTransformer, util

def run_inference():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({'error': 'No payload provided from backend.'}))
            return

        # Parse JSON payload sent from Node.js Express route
        payload = json.loads(sys.argv[1])
        student = payload.get('student', {})
        mentors = payload.get('mentors', [])

        student_goal = student.get('learning_goal', 'Software Development and Engineering')
        
        # Extract student numerical features for Random Forest evaluation
        student_cgpa = float(student.get('cgpa', 7.5))
        student_coding = float(student.get('coding_skill_score', 70.0))
        student_projects = int(student.get('projects_count', 3))

        # Load trained Tier 2 Random Forest model
        model_path = os.path.join(os.path.dirname(__file__), '../models/rf_matcher.pkl')
        rf_model = None
        if os.path.exists(model_path):
            rf_model = joblib.load(model_path)

        # Load SBERT model for Tier 1 Semantic Matching
        sbert_model = SentenceTransformer('all-MiniLM-L6-v2')
        student_embedding = sbert_model.encode(student_goal, convert_to_tensor=True)

        scored_mentors = []
        for mentor in mentors:
            mentor_bio = mentor.get('bio', 'Experienced Software Professional')
            mentor_exp = int(mentor.get('years_experience', 3))
            
            # 1. Tier 1: SBERT Semantic Score
            mentor_embedding = sbert_model.encode(mentor_bio, convert_to_tensor=True)
            similarity = util.cos_sim(student_embedding, mentor_embedding).item()
            sbert_percentage = round(similarity * 100, 2)

            # 2. Tier 2: Random Forest Structural Suitability Score
            domain_match = 1
            features = np.array([[student_cgpa, student_coding, mentor_exp, student_projects, domain_match]])
            
            rf_probability = 0.75
            if rf_model is not None:
                probs = rf_model.predict_proba(features)
                rf_probability = float(probs[0][1])

            rf_percentage = round(rf_probability * 100, 2)

            # 3. Hybrid Score Calculation (50% Semantic SBERT + 50% Random Forest Fit)
            hybrid_score = round((sbert_percentage * 0.5) + (rf_percentage * 0.5), 2)

            scored_mentors.append({
                **mentor,
                'sbert_score': sbert_percentage,
                'rf_score': rf_percentage,
                'match_score': hybrid_score
            })

        # Sort recommendations by highest hybrid match score descending
        ranked_mentors = sorted(scored_mentors, key=lambda x: x['match_score'], reverse=True)

        print(json.dumps(ranked_mentors))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    run_inference()