const admin = require("firebase-admin");
const { handleEvent } = require("./eventEngine");


async function notificationEngine(uid, eventData) {
try {
const db = admin.firestore();


const userDoc = await db.collection("users").doc(uid).get();
if (!userDoc.exists) return;


const user = userDoc.data(); // { email, phone }


const { type } = eventData;


// GAS LEVEL
if (type === "GAS_LEVEL") {
await handleEvent(eventData, user);
}


// LEAK
if (type === "LEAK") {
await handleEvent(eventData, user);
}


} catch (err) {
console.error("❌ Notification Engine Error:", err);
}
}


module.exports = { notificationEngine };