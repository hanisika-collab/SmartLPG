const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();


const { notificationEngine } = require("./cloud/notificationEngine");


exports.onSystemLogCreated = functions.firestore
.document("systemHistory/{uid}/logs/{logId}")
.onCreate(async (snap, context) => {
try {
const data = snap.data();
const { uid } = context.params;


console.log("🔥 System Event:", data);


await notificationEngine(uid, data);


} catch (err) {
console.error("❌ Notification Trigger Error:", err);
}
});


exports.health = functions.https.onRequest((req, res) => {
res.send("Smart LPG Backend Running");
});