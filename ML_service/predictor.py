import joblib
import pandas as pd

model = joblib.load("model.pkl")

def predict_usage(day_index, prev_usage, cooking_sessions, weight_kg):
    X = pd.DataFrame([{
        "day_index": day_index,
        "prev_usage": prev_usage,
        "cooking_sessions": cooking_sessions,
        "weight_kg": weight_kg
    }])
    prediction = model.predict(X)[0]
    return float(prediction)
