const fs = require("fs");
const path = require("path");

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toBase58(buf: Buffer) {
  let carry, digits = [0];
  for (let i = 0; i < buf.length; i++) {
    carry = buf[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  for (let i = 0; i < buf.length && buf[i] === 0; i++) digits.push(0);
  return digits.reverse().map((d) => ALPHABET[d]).join("");
}

const home = process.env.USERPROFILE || process.env.HOME;
const possible = [
  path.join(home, ".config", "byreal", "keys", "id.json"),
  path.join(home, ".config", "byreal", "keys", "keypair.json"),
];

for (const p of possible) {
  if (fs.existsSync(p)) {
    const arr = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (arr.length === 64) {
      const pubkey = Buffer.from(arr.slice(32, 64));
      const addr = toBase58(pubkey);
      console.log("\nByreal Wallet Address:", addr);
      console.log("Chain: Solana (mainnet-beta)\n");
      console.log("Send SOL here to pay for Byreal DEX gas fees.\n");
      process.exit(0);
    }
  }
}
console.log("Keypair file not found.");
