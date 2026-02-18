import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { logSystemEvent } from "./logger/systemLogger";

export const generatePrediction = async (uid, currentWeight) => {
  const q = query(
    collection(db, "usageHistory", uid, "records"),
    orderBy("timestamp", "desc"),
    limit(7)
  );

  const snap = await getDocs(q);

  let totalUsed = 0;
  snap.docs.forEach(d => {
    totalUsed += d.data().usedKg || 0;
  });

  const avgPerDay = snap.size ? totalUsed / snap.size : 0.1;
  const daysLeft = avgPerDay > 0 ? Math.floor(currentWeight / avgPerDay) : 0;

  const refillDate = new Date();
  refillDate.setDate(refillDate.getDate() + daysLeft);

  const prediction = {
    avgPerDay: avgPerDay.toFixed(2),
    daysLeft,
    refillDate: refillDate.toDateString(),
    totalUsed: totalUsed.toFixed(2)
  };

  // 🔥 LOGGING
  await logSystemEvent({
    type: "PREDICTION",
    title: "Usage Prediction Updated",
    message: `Avg ${prediction.avgPerDay} kg/day, ${prediction.daysLeft} days left`,
    status: "INFO"
  });

  return prediction;
};
