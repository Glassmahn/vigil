const bs58 = require("bs58");
const fs = require("fs");
const path = require("path");
const os = require("os");

const KEY = "2nZ5p8ueJJbun2cHF3LWhkPNXGoU6KqU2CyvJP26yx34shusZq2PqRr631zhMNBzBxTrjFkYu89thuX4tMwSAvZz";

const decoded = bs58.decode(KEY);
const json = JSON.stringify([...decoded]);

const configDir = path.join(os.homedir(), ".config", "byreal", "keys");
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(path.join(configDir, "keypair.json"), json, "utf-8");

console.log("Byreal keypair saved to", path.join(configDir, "keypair.json"));
console.log("Wallet address:", decoded.slice(32).toString("hex"));
