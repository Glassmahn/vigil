import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { logger } from "./logger";

dotenv.config();

const DECISION_LOG_ABI = [
  "function registerAgent(bytes32 agentId, string memory name) external",
  "function logDecision(bytes32 agentId, string memory action, string memory metadata) external",
  "function getDecisionCount() view returns (uint256)",
  "function getAgentDecisions(bytes32 agentId) view returns (tuple(bytes32 agentId, string action, string metadata, uint256 timestamp, address executor)[])",
];

const VIGIL_REGISTRY_ABI = [
  "function updateRiskTier(bytes32 agentId, uint8 riskTier) external",
  "function logPerformance(bytes32 agentId, int256 pnlDelta, uint256 valueManaged) external",
  "function createAgent(bytes32 agentId, string memory name, uint8 riskTier) external",
  "function getAgentById(bytes32 agentId) view returns (tuple(bytes32 agentId, string name, uint8 riskTier, bool active, uint256 totalValueManaged, uint256 totalTrades, int256 totalPnl, uint256 createdAt, uint256 lastActiveAt))",
  "function killAgent(bytes32 agentId) external",
  "function reviveAgent(bytes32 agentId) external",
];

const VIGIL_AGENT_ID = process.env.VIGIL_AGENT_ID || ethers.keccak256(ethers.toUtf8Bytes("vigil"));

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let decisionLog: ethers.Contract | null = null;
let vigilRegistry: ethers.Contract | null = null;

const MAX_DECISIONS = 1000;
const MAX_PNL_LOGS = 1000;

const inMemoryDecisions: { action: string; metadata: Record<string, any>; timestamp: number; txHash: string }[] = [];
let inMemoryPnlLogs: { pnlDelta: number; valueManaged: number; timestamp: number }[] = [];
let inMemoryRiskTier: number | null = null;

function cappedPush<T>(arr: T[], item: T, max: number): void {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function initLogger(rpcUrl: string, privateKey: string, decisionLogAddress: string) {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  signer = new ethers.Wallet(privateKey, provider);
  decisionLog = new ethers.Contract(decisionLogAddress, DECISION_LOG_ABI, signer);
}

export function initVigilRegistry(contractAddress: string) {
  if (!signer) throw new Error("Logger must be initialized first");
  vigilRegistry = new ethers.Contract(contractAddress, VIGIL_REGISTRY_ABI, signer);
}

export async function toggleOnChainKill(kill: boolean): Promise<string> {
  if (!vigilRegistry) return "";
  try {
    const current = await vigilRegistry.getAgentById(VIGIL_AGENT_ID);
    const isAlive = current.active;
    if ((kill && isAlive) || (!kill && !isAlive)) {
      const method = kill ? "killAgent" : "reviveAgent";
      const tx = await sequentialTx(() => vigilRegistry![method](VIGIL_AGENT_ID));
      const receipt = await tx.wait();
      return receipt.hash;
    }
    return "";
  } catch (err: any) {
    logger.warn("OnchainLogger", "Failed to toggle on-chain kill switch", { error: err.message });
    return "";
  }
}

export async function registerAgent(): Promise<string> {
  if (!decisionLog) throw new Error("Logger not initialized");
  const tx = await sequentialTx(() => decisionLog!.registerAgent(VIGIL_AGENT_ID, "Vigil"));
  const receipt = await tx.wait();
  return receipt.hash;
}

let txQueue: Promise<any> = Promise.resolve();

async function sequentialTx<T>(fn: () => Promise<T>): Promise<T> {
  return txQueue = (txQueue.catch(() => {})).then(fn);
}

export async function logDecision(action: string, metadata: Record<string, any>): Promise<string> {
  const entry = { action, metadata, timestamp: Math.floor(Date.now() / 1000), txHash: "" };

  if (!decisionLog) {
    cappedPush(inMemoryDecisions, entry, MAX_DECISIONS);
    return "";
  }

  try {
    const metadataStr = JSON.stringify(metadata);
    const tx = await sequentialTx(() => decisionLog!.logDecision(VIGIL_AGENT_ID, action, metadataStr));
    const receipt = await tx.wait();
    entry.txHash = receipt.hash;
    cappedPush(inMemoryDecisions, entry, MAX_DECISIONS);
    return receipt.hash;
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("already known")) {
      logger.warn("OnchainLogger", "Duplicate tx skipped (already in mempool)");
    } else if (err?.code === "INSUFFICIENT_FUNDS") {
      logger.warn("OnchainLogger", "Skipping on-chain log — wallet needs MNT for gas. Stored in-memory.");
    } else {
      logger.warn("OnchainLogger", "On-chain log failed", { error: err.message });
    }
    cappedPush(inMemoryDecisions, entry, MAX_DECISIONS);
    return "";
  }
}

export async function getDecisionHistory(): Promise<any[]> {
  const combined = [...inMemoryDecisions];

  if (decisionLog) {
    try {
      const onchain = await decisionLog.getAgentDecisions(VIGIL_AGENT_ID);
      for (const d of onchain) {
        const ts = Number(d.timestamp);
        const exists = combined.some((c) => c.timestamp === ts && c.action === d.action);
        if (!exists) {
          combined.push({
            action: d.action,
            metadata: (() => { try { return JSON.parse(d.metadata || "{}"); } catch { return {}; } })(),
            timestamp: ts,
            txHash: d.transactionHash || "",
          });
        }
      }
    } catch (e) {
      logger.warn("OnchainLogger", "Failed to fetch on-chain history", { error: (e as Error).message });
    }
  }

  return combined;
}

export async function updateRiskTier(tier: number): Promise<string> {
  if (!vigilRegistry) {
    inMemoryRiskTier = tier;
    return "";
  }
  try {
    const tx = await sequentialTx(() => vigilRegistry!.updateRiskTier(VIGIL_AGENT_ID, tier));
    const receipt = await tx.wait();
    inMemoryRiskTier = tier;
    return receipt.hash;
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("already known")) {
      logger.warn("OnchainLogger", "Duplicate risk tier update skipped (already in mempool)");
    } else if (err?.code === "INSUFFICIENT_FUNDS") {
      logger.warn("OnchainLogger", "Skipping risk tier update — wallet needs MNT for gas. Stored in-memory.");
    } else {
      logger.warn("OnchainLogger", "Risk tier update failed", { error: err.message });
    }
  }
  // Fail-open: record tier in-memory even if on-chain update fails
  inMemoryRiskTier = tier;
  return "";
}

export async function logPerformance(pnlDelta: number, valueManaged: number): Promise<string> {
  cappedPush(inMemoryPnlLogs, { pnlDelta, valueManaged, timestamp: Math.floor(Date.now() / 1000) }, MAX_PNL_LOGS);

  if (!vigilRegistry) return "";
  try {
    const tx = await sequentialTx(() => vigilRegistry!.logPerformance(VIGIL_AGENT_ID, pnlDelta, valueManaged));
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("already known")) {
      logger.warn("OnchainLogger", "Duplicate performance log skipped (already in mempool)");
    } else if (err?.code === "INSUFFICIENT_FUNDS") {
      logger.warn("OnchainLogger", "Skipping performance log — wallet needs MNT for gas. Stored in-memory.");
    } else {
      logger.warn("OnchainLogger", "Performance log failed", { error: err.message });
    }
    return "";
  }
}

export async function getRegistryStatus(): Promise<{
  active: boolean;
  riskTier: number | null;
  totalTrades: number;
  totalPnl: number;
  valueManaged: number;
}> {
  const result = {
    active: false,
    riskTier: inMemoryRiskTier,
    totalTrades: inMemoryPnlLogs.length,
    totalPnl: inMemoryPnlLogs.reduce((sum, l) => sum + l.pnlDelta, 0),
    valueManaged: inMemoryPnlLogs.length > 0 ? inMemoryPnlLogs[inMemoryPnlLogs.length - 1].valueManaged : 0,
  };

  if (vigilRegistry) {
    try {
      const onchain = await vigilRegistry.getAgentById(VIGIL_AGENT_ID);
      if (Number(onchain.createdAt) > 0) {
        result.active = onchain.active;
        result.riskTier = Number(onchain.riskTier);
        result.totalTrades = Math.max(Number(onchain.totalTrades), result.totalTrades);
        result.totalPnl = Math.max(Number(onchain.totalPnl), result.totalPnl);
        result.valueManaged = Math.max(Number(onchain.totalValueManaged), result.valueManaged);
      }
    } catch (e) {
      logger.warn("OnchainLogger", "Failed to fetch on-chain registry status", { error: (e as Error).message });
    }
  }

  return result;
}

export function isInitialized(): boolean {
  return decisionLog !== null;
}

export function getPnlHistory(): { pnlDelta: number; valueManaged: number; timestamp: number }[] {
  return [...inMemoryPnlLogs];
}
