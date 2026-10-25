import os
import pandas as pd

# Automatically locate CSV files in the project
print("🔍 Searching for CSV files in your project workspace...")
found_csvs = []
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.csv'):
            full_path = os.path.join(root, file)
            found_csvs.append(full_path)
            print(f"📁 Found: {full_path}")

if not found_csvs:
    print("⚠️ No CSV files found anywhere in the project folder!")
else:
    print("\n--- Inspecting the first available CSV file ---")
    target_file = found_csvs[0]
    df = pd.read_csv(target_file)
    print(f"File path: {target_file}")
    print("Columns:")
    print(df.columns.tolist())
    print("\nFirst row preview:")
    print(df.head(1))