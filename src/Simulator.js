import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { logSystemEvent } from "./logger/systemLogger";

export const startSimulation = (uid) => {
  let weight = 14.2; // full cylinder
  let leakActive = false;

  let prevLeakState = false;
  let lastThreshold = null; // prevents spam
  const thresholds = [90, 70, 50, 30, 10];

  setInterval(async () => {
    // ===== USAGE SIMULATION =====
    const usage = Math.random() * 0.05; // 0–50g
    weight = Math.max(0, weight - usage);

    // ===== LEAK SIMULATION =====
    if (Math.random() > 0.995) leakActive = true;   // rare leak
    if (Math.random() > 0.99) leakActive = false;  // recovery

    const gasPercent = Math.floor((weight / 14.2) * 100);

    // ===== UPDATE LIVE DATA =====
    await setDoc(doc(db, "gasData", uid, "current", "status"), {
      weight,
      gasPercent,
      leak: leakActive,
      updatedAt: serverTimestamp()
    });

    // ==============================
    // 🎯 THRESHOLD TRIGGERS
    // ==============================
    for (let t of thresholds) {
      if (gasPercent <= t && lastThreshold !== t) {
        lastThreshold = t;

        await logSystemEvent({
          type: "USAGE",
          title: "Gas Threshold Alert",
          message: `Gas level dropped to ${t}%`,
          status: t <= 30 ? "CRITICAL" : "WARNING"
        });

        break;
      }
    }

    // ==============================
    // 🚨 LEAK TRIGGER (EDGE DETECT)
    // ==============================
  if (leakActive && !prevLeakState) {
  await logSystemEvent({
    type: "LEAK",
    title: "Gas Leak Detected",
    message: "Emergency leak detected by sensor",
    status: "CRITICAL"
  });
}

// Leak cleared (ON → OFF)
if (!leakActive && prevLeakState) {
  await logSystemEvent({
    type: "LEAK_CLEAR",
    title: "Leak Resolved",
    message: "Gas leak condition cleared",
    status: "INFO"
  });
}

    prevLeakState = leakActive;

  }, 5000); // every 5 sec
};
