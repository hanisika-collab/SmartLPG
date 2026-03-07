import pandas as pd
import json
import os

# Create the data folder if it doesn't exist
if not os.path.exists('data'):
    os.makedirs('data')

# Load your simulator data
with open('simulator.json', 'r') as f:
    data = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(data)

# --- CRITICAL: MATCHING FEATURE ORDER ---
# Ensure these columns exist in your JSON and match the fit() order
# Order: day_index, prev_usage, cooking_sessions, weight_kg
required_columns = ["day_index", "prev_usage", "cooking_sessions", "weight_kg", "daily_usage_kg"]

# If your JSON is missing 'prev_usage', we can create it (shift daily_usage)
if 'prev_usage' not in df.columns and 'daily_usage_kg' in df.columns:
    df['prev_usage'] = df['daily_usage_kg'].shift(1).fillna(0.3)

# Filter and reorder to match training requirements
df = df[required_columns]

# Save to the path expected by your train_model.py
df.to_csv("data/lpg_usage_data.csv", index=False)
print("✅ CSV data prepared with correct column ordering.")