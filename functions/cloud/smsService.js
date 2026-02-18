const twilio = require("twilio");
const { TWILIO_SID, TWILIO_AUTH, TWILIO_PHONE } = require("../env");

const client = twilio(
  TWILIO_SID.value(),
  TWILIO_AUTH.value()
);

async function sendSMS(to, message) {
  return client.messages.create({
    body: message,
    from: TWILIO_PHONE.value(),
    to
  });
}

module.exports = { sendSMS };
