const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { sendEmail } = require("./cloud/emailService"); //
admin.initializeApp();

// 1. Listen for Gas Leaks and Low Gas in Realtime Database
exports.onHardwareStatusUpdate = functions.database
  .ref("/gasData/{uid}/current/status")
  .onUpdate(async (change, context) => {
    const data = change.after.val();
    const { uid } = context.params;

    // Fetch user email from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    const userEmail = userRecord.email;

    // Logic: Trigger Email for Critical Gas Leak
    if (data.gas_leakage > 1500) {
      await sendEmail(
        userEmail, 
        "CRITICAL ALERT: Gas Leak Detected!", 
        `Warning: Your Smart LPG system has detected a gas leak at your location. Please turn off the regulator immediately.`
      ); //
    }

    // Logic: Trigger Email for Low Gas (Below 20%)
    if (data.gasPercent < 20 && data.gasPercent > 0) {
      await sendEmail(
        userEmail, 
        "LPG Refill Reminder", 
        `Your cylinder is at ${data.gasPercent}%. Please book a refill soon to avoid running out.`
      ); //
    }

    return null;
  });

// Existing Firestore listener
exports.onSystemLogCreated = functions.firestore
  .document("systemHistory/{uid}/logs/{logId}")
  .onCreate(async (snap, context) => {
    // ... existing logic ...
  });