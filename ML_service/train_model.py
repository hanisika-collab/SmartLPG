import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
import joblib

df = pd.read_csv("data/lpg_usage_data.csv")

df["day_index"] = range(len(df))
df["prev_usage"] = df["daily_usage_kg"].shift(1)
df = df.dropna()

X = df[["day_index", "prev_usage", "cooking_sessions", "weight_kg"]]
y = df["daily_usage_kg"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LinearRegression()
model.fit(X_train, y_train)

joblib.dump(model, "model.pkl")

print("Model trained & saved as model.pkl")
