import os
import pandas as pd
from sklearn.preprocessing import StandardScaler

def clean_student_data():
    input_path = 'aiml/data/student.csv'

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Could not find student dataset at: {input_path}")

    print(f"📥 Loading student dataset from: {input_path}")
    df = pd.read_csv(input_path)
    print(f"Loaded {len(df)} rows and {len(df.columns)} columns.")

    # 1. Clean and normalize categorical text
    if 'branch' in df.columns:
        df['branch'] = df['branch'].str.lower().str.strip()
    if 'college_tier' in df.columns:
        df['college_tier'] = df['college_tier'].str.lower().str.strip()
    if 'gender' in df.columns:
        df['gender'] = df['gender'].str.lower().str.strip()

    # 2. Scale continuous numerical features for the Random Forest pipeline
    num_cols = [
        'cgpa', 
        'coding_skill_score', 
        'aptitude_score', 
        'communication_skill_score', 
        'mock_interview_score', 
        'projects_count', 
        'internships_count'
    ]
    
    existing_num_cols = [col for col in num_cols if col in df.columns]
    if existing_num_cols:
        scaler = StandardScaler()
        df[[f"{col}_scaled" for col in existing_num_cols]] = scaler.fit_transform(df[existing_num_cols])

    # 3. Save cleaned and scaled dataset to aiml/data/
    output_path = 'aiml/data/students_cleaned.csv'
    os.makedirs(os.path.dirname(output_path), exist_ok=True) # Corrected line
    df.to_csv(output_path, index=False)
    
    print(f"✨ Success! Cleaned student data saved to: {output_path}")
    print("\n--- Cleaned Student Preview ---")
    print(df.head(3))

if __name__ == '__main__':
    clean_student_data()