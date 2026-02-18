import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

export const logSystemEvent = async ({
  type,
  title,
  message,
  status
}) => {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;

  try {
    await addDoc(
      collection(db, "systemHistory", uid, "logs"),
      {
        type,           // ALERT | USAGE | SYSTEM | PREDICTION | LEAK
        title,          // "Leak Detected"
        message,        // "Kitchen sensor triggered"
        status,         // CRITICAL | WARNING | NORMAL | INFO
        timestamp: serverTimestamp()
      }
    );
  } catch (err) {
    console.error("System log failed:", err);
  }
};
