from flask import Flask, request, jsonify
from flask_cors import CORS
from predictor import predict_usage
import traceback

app = Flask(__name__)
CORS(app)  # allow React Native requests


@app.route("/predict", methods=["POST"])
def predict():
    try:
        # Get JSON safely
        data = request.get_json(force=True)

        if not data:
            return jsonify({"error": "No JSON data received"}), 400

        # Validate required fields
        required_fields = [
            "day_index",
            "prev_usage",
            "cooking_sessions",
            "weight_kg"
        ]

        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        # Convert safely to float
        day_index = float(data["day_index"])
        prev_usage = float(data["prev_usage"])
        cooking_sessions = float(data["cooking_sessions"])
        weight_kg = float(data["weight_kg"])

        # Call ML predictor
        prediction = predict_usage(
            day_index,
            prev_usage,
            cooking_sessions,
            weight_kg
        )

        # Force Python float (avoid numpy serialization issues)
        prediction = float(prediction)

        return jsonify({
            "predicted_daily_usage": prediction
        }), 200

    except Exception as e:
        print("ERROR OCCURRED:")
        traceback.print_exc()
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
