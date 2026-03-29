import smtplib, joblib, os, time
import pandas as pd
from datetime import datetime
from email.mime.text import MIMEText
from flask import Flask, request, jsonify
from flask_cors import CORS
from twilio.rest import Client

# --- Firebase & Scheduler Imports ---
import firebase_admin
from firebase_admin import credentials, firestore
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

# ==========================================
# 1. CREDENTIALS SETUP
# ==========================================
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.getenv("TWILIO_PHONE")
USER_PHONE = os.getenv("USER_PHONE")# Kandippa +91 irukkanum

# ==========================================
# 2. FIREBASE ADMIN SETUP (For Daily History)
# ==========================================
try:
    # Unga Firebase service account JSON file name inga irukkanum
    cred = credentials.Certificate("smartlpg-app-cdb4d-firebase-adminsdk-fbsvc-e4fdf3b7af.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase Admin Initialized Successfully")
except Exception as e:
    print(f"⚠️ Firebase Setup Error: {e}")

# ==========================================
# 3. DAILY USAGE TRACKER LOGIC
# ==========================================
start_of_day_weight = None
current_weight = None

def update_current_weight(weight):
    global start_of_day_weight, current_weight
    current_weight = weight
    # Kaalayila first time weight varumbodhu adhai start weight-a set pandrom
    if start_of_day_weight is None:
        start_of_day_weight = weight

def calculate_and_log_daily_usage():
    global start_of_day_weight, current_weight
    
    if start_of_day_weight is not None and current_weight is not None:
        usage_today = start_of_day_weight - current_weight
        if usage_today < 0: usage_today = 0 # Negative value varama thadukka
            
        print(f"[{datetime.now()}] 📊 Logging Daily Usage: {round(usage_today, 3)} kg")
        
        # Save to Firebase Firestore
        try:
            uid = "ApzkkecnwRXjHkUBLeH6C0ZPr9F3" # Unga user UID
            log_data = {
                "type": "USAGE",
                "title": "Daily Gas Consumption",
                "message": f"{round(usage_today, 3)} kg",
                "status": "INFO",
                "timestamp": firestore.SERVER_TIMESTAMP
            }
            db.collection("systemHistory").document(uid).collection("logs").add(log_data)
            print("✅ Daily log saved to Firebase")
        except Exception as e:
            print("❌ Failed to save daily log to Firebase:", e)
        
        # Adutha naalukku ready aagudhu
        start_of_day_weight = current_weight

# Start the background scheduler (Runs every day at 11:59 PM)
scheduler = BackgroundScheduler()
scheduler.add_job(calculate_and_log_daily_usage, 'cron', hour=23, minute=59)
scheduler.start()


# ==========================================
# 4. ML MODEL & SMS ALERT SETUP
# ==========================================
MODEL_PATH = "model.pkl"
model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

last_sms_time = { "leak_alert": 0, "usage_alert": 0 }
SMS_COOLDOWN = 21600 # 6 hours (Ore msg thirumba thirumba varama thadukka)

def trigger_automatic_sms(message, alert_type):
    global last_sms_time
    current_time = time.time()
    
    if (current_time - last_sms_time[alert_type]) > SMS_COOLDOWN:
        try:
            client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
            client.messages.create(body=message, from_=TWILIO_PHONE, to=USER_PHONE)
            print(f"✅ AUTOMATIC SMS SENT ({alert_type}): {message}")
            last_sms_time[alert_type] = current_time 
        except Exception as e:
            print(f"❌ SMS FAILED ({alert_type}):", str(e))
    else:
        print(f"⏳ SMS Skipped ({alert_type}): Cooldown period active.")


# ==========================================
# 5. REACT NATIVE ML PREDICTION ROUTE
# ==========================================
@app.route("/predict", methods=["POST"])
def predict_usage():
    try:
        data = request.get_json(force=True)
        # React Native anuppura data
        current_weight_kg = float(data.get("current_weight", 0.0))
        initial_weight_kg = float(data.get("initial_weight", 0.0))

        # 1. Update weight for midnight calculation
        update_current_weight(current_weight_kg)

        # 2. ML PREDICTION & LOW GAS USAGE ALERT
        days_left = 0
        prediction_rate = 0.35 # Default 350g per day assume pandrom

        if current_weight_kg > 0.5: 
            features = {
                "day_index": float(datetime.now().weekday()),
                "prev_usage": 0.35,
                "cooking_sessions": 2.0,
                "weight_kg": current_weight_kg
            }

            if model:
                # Predict using your ML Model
                X = pd.DataFrame([features])[["day_index", "prev_usage", "cooking_sessions", "weight_kg"]]
                prediction_rate = float(model.predict(X)[0])

            days_left = int(current_weight_kg / prediction_rate) if prediction_rate > 0 else 0
            
            # SMS Alert Logic (3 days or less)
            if days_left <= 3:
                usage_msg = f"Smart Lead Alert: Your cylinder will run out in approx {days_left} days ({round(current_weight_kg,2)}kg left). Book a refill soon!"
                trigger_automatic_sms(usage_msg, "usage_alert")

        # React Native app ethirpaarkura JSON format
        return jsonify({
            "status": "success",
            "days_left": days_left,
            "daily_rate_kg": prediction_rate,
            "confidence": 0.88,
            "message": "Data processed successfully"
        }), 200

    except Exception as e:
        print(f"Error in ML route: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    # Server start aagumbodhu ip address print aagum
    print("\n🚀 Smart Lead Backend Server Started!")
    print("👉 React Native App-la 'ML_API' la indha IP address-a podavum.\n")
    app.run(host="0.0.0.0", port=5000, debug=True)