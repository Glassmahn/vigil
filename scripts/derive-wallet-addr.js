const fs = require("fs");
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const home = process.env.USERPROFILE || process.env.HOME;
const kp = JSON.parse(fs.readFileSync(home + "/.config/byreal/keys/id.json", "utf-8"));
const pubkey = Buffer.from(kp.slice(32, 64));

let carry, digits = [0];
for (let i = 0; i < pubkey.length; i++) {
  carry = pubkey[i];
  for (let j = 0; j < digits.length; j++) {
    carry += digits[j] << 8;
    digits[j] = carry % 58;
    carry = (carry / 58) | 0;
  }
  while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
}
for (let i = 0; i < pubkey.length && pubkey[i] === 0; i++) digits.push(0);
const addr = digits.reverse().map((d) => ALPHABET[d]).join("");

console.log("\nBYREAL_WALLET_ADDRESS=" + addr + "\n");
console.log("Add this to your .env file so the agent and frontend can serve it without the CLI.\n");
