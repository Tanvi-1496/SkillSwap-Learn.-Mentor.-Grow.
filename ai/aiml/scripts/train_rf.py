import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

def train_recommendation_model():
    print("📥 Loading cleaned student and mentor datasets...")
    student_path = 'aiml/data/students_cleaned.csv'
    mentor_path = 'aiml/data/mentors_cleaned.csv'

    if not os.path.exists(student_path) or not os.path.exists(mentor_path):
        raise FileNotFoundError("Cleaned dataset(s) missing in aiml/data/! Run preprocessors first.")

    df_students = pd.read_csv(student_path)
    df_mentors = pd.read_csv(mentor_path)

    print(f"Loaded {len(df_students)} students and {len(df_mentors)} mentors.")

    # 1. Generate structured training pairs (pairing students with mentors to train compatibility)
    print("⚙️ Generating feature matrices for training...")
    
    # Take a representative sample to train efficiently (e.g., 5,000 pairs)
    sample_students = df_students.sample(n=3000, random_state=42).reset_index(drop=True)
    sample_mentors = df_mentors.sample(n=3000, random_state=42).reset_index(drop=True)

    # Build feature dataset
    data = []
    for i in range(len(sample_students)):
        s = sample_students.iloc[i]
        m = sample_mentors.iloc[i]
        
        # Engineering compatibility features
        cgpa = s.get('cgpa', 7.5)
        coding_score = s.get('coding_skill_score', 70.0)
        mentor_exp = m.get('years_experience', 3)
        projects = s.get('projects_count', 3)
        
        # Domain match heuristic rule to label high vs low compatibility (1 or 0)
        branch = str(s.get('branch', '')).lower()
        domain = str(m.get('expertise_domain', '')).lower()
        domain_match = 1 if branch in domain or domain in 'software developer' else 0
        
        # Target label: Good match if coding score & experience align well
        is_good_match = 1 if (coding_score > 65 and mentor_exp >= 3 and domain_match == 1) else 0

        data.append({
            'cgpa': cgpa,
            'coding_skill_score': coding_score,
            'mentor_experience': mentor_exp,
            'projects_count': projects,
            'domain_match': domain_match,
            'label': is_good_match
        })

    train_df = pd.DataFrame(data)

    # Features (X) and Target (y)
    X = train_df[['cgpa', 'coding_skill_score', 'mentor_experience', 'projects_count', 'domain_match']]
    y = train_df['label']

    # Train / Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"🌲 Training Random Forest Classifier on {len(X_train)} samples...")
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_train, y_train)

    # Evaluate
    y_pred = rf_model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"✅ Model Training Complete! Accuracy: {acc * 100:.2f}%")

    # 2. Save Model Artifact to aiml/models/
    model_dir = 'aiml/models'
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'rf_matcher.pkl')
    
    joblib.dump(rf_model, model_path)
    print(f"💾 Saved trained Random Forest model to: {model_path}")

if __name__ == '__main__':
    train_recommendation_model()