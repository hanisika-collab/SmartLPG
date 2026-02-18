import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export const processAlerts = async (uid, data) => {
  if (!uid || !data) return;

  const { gasPercent, leak, temperature } = data;

  // 🔴 Gas leak
  if (leak) {
    await addDoc(collection(db, "alerts", uid, "logs"), {
      type: "LEAK",
      message: "Gas leak detected!",
      severity: "CRITICAL",
      timestamp: new Date()
    });
  }

  // 🟠 Low gas
  if (gasPercent <= 20 && gasPercent > 10) {
    await addDoc(collection(db, "alerts", uid, "logs"), {
      type: "LOW_GAS",
      message: "Gas level below 20%. Plan refill.",
      severity: "WARNING",
      timestamp: new Date()
    });
  }

  // 🔴 Critical gas
  if (gasPercent <= 10) {
    await addDoc(collection(db, "alerts", uid, "logs"), {
      type: "CRITICAL_GAS",
      message: "Gas critically low! Refill immediately.",
      severity: "CRITICAL",
      timestamp: new Date()
    });
  }

  // 🌡️ Abnormal temperature
  if (temperature > 40) {
    await addDoc(collection(db, "alerts", uid, "logs"), {
      type: "TEMP_HIGH",
      message: "Cylinder temperature abnormal.",
      severity: "WARNING",
      timestamp: new Date()
    });
  }
};
