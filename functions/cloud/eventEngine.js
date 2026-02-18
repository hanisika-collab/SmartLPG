const { sendEmail } = require("./emailService");
const { sendSMS } = require("./smsService");


async function handleEvent(event, user) {
const { type, percent } = event;


// GAS LEVEL ALERTS
if (type === "GAS_LEVEL") {
if ([90, 70, 50, 30, 10].includes(percent)) {
const msg = `Gas Level Alert: ${percent}% remaining`;


await sendEmail(user.email, "Smart LPG Alert", msg);
await sendSMS(user.phone, msg);
}
}


// LEAK ALERT
if (type === "LEAK") {
const msg = "🚨 GAS LEAK DETECTED! Immediate action required.";


await sendEmail(user.email, "🚨 EMERGENCY: Gas Leak", msg);
await sendSMS(user.phone, msg);
}
}


module.exports = { handleEvent };