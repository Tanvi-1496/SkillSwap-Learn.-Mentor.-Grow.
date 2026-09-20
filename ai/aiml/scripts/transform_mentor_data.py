import os
import pandas as pd

def transform_survey_data():
    input_path = 'aiml/data/mentor.csv'
    output_path = 'aiml/data/mentors_cleaned.csv'

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Could not find raw survey file at: {input_path}")

    print("📥 Loading raw survey mentor dataset...")
    df = pd.read_csv(input_path, low_memory=False)
    print(f"Loaded {len(df)} rows and {len(df.columns)} columns.")

    # Initialize cleaned dataframe mapped to SkillSwap mentor schema
    clean_df = pd.DataFrame()

    # 1. Map Identifiers and Roles
    clean_df['id'] = df['ResponseId']
    clean_df['developer_role'] = df['DevType'].fillna('Software Developer')
    clean_df['expertise_domain'] = df['DevType'].fillna('General Software Engineering')

    # 2. Combine Tech Stacks (Languages, Databases, Frameworks) into a unified skills string
    tech_cols = [
        'LanguageHaveWorkedWith', 
        'DatabaseHaveWorkedWith', 
        'WebframeHaveWorkedWith'
    ]
    
    # Filter only columns that actually exist in the dataframe
    valid_tech_cols = [c for c in tech_cols if c in df.columns]
    
    if valid_tech_cols:
        clean_df['skills'] = df[valid_tech_cols].fillna('').agg(
            lambda x: ', '.join([str(v) for v in x if pd.notna(v) and str(v).strip() != '']), 
            axis=1
        )
    else:
        clean_df['skills'] = 'Python, JavaScript, React'

    # 3. Experience & Industry
    clean_df['years_experience'] = pd.to_numeric(df['WorkExp'], errors='coerce').fillna(3).astype(int)
    clean_df['industry'] = df['Industry'].fillna('Information Technology & Services')

    # 4. Synthesize Professional Bio
    clean_df['bio'] = clean_df['developer_role'] + ' with expertise in ' + clean_df['skills'] + ', working in the ' + clean_df['industry'] + ' industry.'

    # 5. Default Metadata for App Integration
    clean_df['rating'] = 4.8
    clean_df['is_verified'] = True

    # Save processed output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    clean_df.to_csv(output_path, index=False)
    
    print(f"✨ Success! Cleaned mentor data saved to: {output_path}")
    print("\n--- Cleaned Mentor Preview ---")
    print(clean_df[['id', 'developer_role', 'years_experience', 'skills']].head(3))

if __name__ == '__main__':
    transform_survey_data()