# train_model.py - UPDATED
import pandas as pd
from sklearn.linear_model import LinearRegression
import joblib

df = pd.read_csv("data/lpg_usage_data.csv")

# 1. Feature Engineering
df["day_index"] = range(len(df))
df["prev_usage"] = df["daily_usage_kg"].shift(1)

# 2. Critical Fix: Fill the first NaN created by shift(1) 
# instead of dropping everything or leaving a null
df["prev_usage"] = df["prev_usage"].fillna(0) 

# 3. Filter out rows where the cylinder is empty (weight = 0)
# Training on 0-weight data makes the model think gas never runs out
df = df[df["weight_kg"] > 0]

X = df[["day_index", "prev_usage", "cooking_sessions", "weight_kg"]]
y = df["daily_usage_kg"]

model = LinearRegression()
model.fit(X, y) # Train on all valid data

joblib.dump(model, "model.pkl")
print(f"Model trained on {len(df)} days of valid usage data.")