const crypto = require("crypto");
const secret = crypto.randomBytes(24).toString("hex");
console.log(secret);
console.error("\nVercel + Fly secrets: PALLY_RELAY_SECRET=" + secret);
