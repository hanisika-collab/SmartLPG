import smtplib, joblib, os, traceback
import pandas as pd
from datetime import datetime
from email.mime.text import MIMEText
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SENDER_EMAIL = "hanisikasiva@gmail.com"
SENDER_PASSWORD = "ajmq vkrk apim znab" 
MODEL_PATH = "model.pkl"

model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        weight_kg = float(data.get("weight_kg", 0))
        
        # Exact order required by your train_model.py
        features = {
            "day_index": float(datetime.now().weekday()),
            "prev_usage": 0.35,
            "cooking_sessions": 2.0,
            "weight_kg": weight_kg
        }

        if model:
            X = pd.DataFrame([features])[["day_index", "prev_usage", "cooking_sessions", "weight_kg"]]
            prediction = float(model.predict(X)[0])
        else:
            prediction = 0.35

        days_left = int(weight_kg / prediction) if prediction > 0 else 0
        
        return jsonify({
            "status": "success",
            "predicted_daily_usage": round(prediction, 3),
            "days_left": days_left,
            "refill_date": "March 15, 2026"
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        data = request.get_json(force=True)
        msg = MIMEText(data.get("message"))
        msg["Subject"] = data.get("subject")
        msg["From"] = SENDER_EMAIL
        msg["To"] = data.get("to_email")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, msg["To"], msg.as_string())
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)