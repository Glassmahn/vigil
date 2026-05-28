const crypto = require("crypto");
const seed = crypto.randomBytes(32).toString("hex");
console.log("\nBYREAL_MASTER_SEED=" + seed + "\n");
console.log("Add this to your .env file.\n");
