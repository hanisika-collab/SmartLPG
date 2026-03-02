import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { logSystemEvent } from "./logger/systemLogger";
export const generatePrediction = async (uid, currentWeight, cookingSessions) => {
  try {
    // 1. Prepare the data for the ML model
    const requestData = {
      day_index: Date.now(), // Simplified index
      prev_usage: 0.25,      // You can later pull this from Firestore history
      cooking_sessions: cookingSessions || 2, 
      weight_kg: currentWeight
    };

    // 2. Call your Python Flask API
    const response = await fetch("http://10.38.236.151:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    const predictedUsage = result.predicted_daily_usage;

    // 3. Calculate days left based on ML prediction
    const daysLeft = predictedUsage > 0 ? Math.floor(currentWeight / predictedUsage) : 0;
    
    const refillDate = new Date();
    refillDate.setDate(refillDate.getDate() + daysLeft);

    return {
      avgPerDay: predictedUsage.toFixed(3),
      daysLeft: daysLeft,
      refillDate: refillDate.toDateString(),
    };
  } catch (error) {
    console.error("ML Prediction Error:", error);
    return { avgPerDay: 0.25, daysLeft: 0, refillDate: "Error" };
  }
};
