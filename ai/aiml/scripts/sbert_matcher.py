import sys
import json
from sentence_transformers import SentenceTransformer, util

def compute_sbert_scores(student_goal, mentors):
    # Load lightweight, high-performance SBERT model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Encode student learning goal
    student_embedding = model.encode(student_goal, convert_to_tensor=True)
    
    scored_mentors = []
    for mentor in mentors:
        mentor_bio = mentor.get('bio', '')
        mentor_embedding = model.encode(mentor_bio, convert_to_tensor=True)
        
        # Calculate cosine similarity score (0 to 1)
        similarity = util.cos_sim(student_embedding, mentor_embedding).item()
        
        scored_mentors.append({
            **mentor,
            'sbert_score': round(similarity * 100, 2) # Scale to percentage
        })
        
    return scored_mentors if 'scored_entors' in locals() else scored_mentors