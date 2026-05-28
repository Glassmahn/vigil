import { Keypair } from "@solana/web3.js";
import { createHash } from "crypto";
import { logger } from "../logger";

const MASTER_SEED = (() => {
  const raw = process.env.BYREAL_MASTER_SEED;
  if (raw) return Buffer.from(raw, "hex");
  const fallback = "vigil-default-master-seed-do-not-use-in-production-00";
  logger.warn("WalletDerivation", "BYREAL_MASTER_SEED not set. Using fallback (INSECURE).");
  return Buffer.from(fallback, "utf-8").subarray(0, 32);
})();

function deriveSeed(userAddress: string): Uint8Array {
  const hash = createHash("sha256")
    .update(Buffer.from(MASTER_SEED))
    .update(Buffer.from(userAddress.toLowerCase(), "utf-8"))
    .digest();
  return new Uint8Array(hash);
}

export function deriveKeypair(userAddress: string): { publicKey: string; secretKey: Uint8Array } {
  const seed = deriveSeed(userAddress);
  const kp = Keypair.fromSeed(seed);
  return { publicKey: kp.publicKey.toBase58(), secretKey: kp.secretKey };
}

export async function writeKeypairFile(userAddress: string): Promise<string> {
  const { secretKey } = deriveKeypair(userAddress);
  const { writeFile, mkdtemp, rm } = await import("fs/promises");
  const { join } = await import("path");
  const { tmpdir } = await import("os");
  const dir = await mkdtemp(join(tmpdir(), "vigil-kp-"));
  const path = join(dir, "keypair.json");
  const arr = Array.from(secretKey);
  await writeFile(path, JSON.stringify(arr));
  return path;
}

export async function cleanupKeypairFile(path: string): Promise<void> {
  try {
    const { rm } = await import("fs/promises");
    await rm(path);
    await rm(path.replace("keypair.json", ""), { recursive: true, force: true });
  } catch (e) {
    logger.warn("WalletDerivation", "Failed to cleanup keypair file", { path, error: (e as Error).message });
  }
}
