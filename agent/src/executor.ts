import { RiskProfile } from "./risk-assessor";
import { byreal, byrealPerps } from "./skills/byreal-wrapper";
import { logDecision, logPerformance } from "./onchain-logger";
import { writeKeypairFile, cleanupKeypairFile, deriveKeypair } from "./skills/wallet-derivation";
import { tradeEvents } from "./trade-events";
import { logger } from "./logger";
import { toolSchemas } from "./validation";

interface ExecutionResult {
  success: boolean;
  action: string;
  details: string;
  txHash?: string;
}

let circuitKilled = false;

export function isCircuitKilled(): boolean {
  return circuitKilled;
}

export function setCircuitKilled(killed: boolean): void {
  circuitKilled = killed;
  logger.info("Executor", `Circuit breaker ${killed ? "engaged" : "released"}`);
}

function validateToolArgs(action: string, params: Record<string, any>): { valid: true } | { valid: false; details: string } {
  const schema = toolSchemas[action];
  if (!schema) return { valid: true };
  const result = schema.safeParse(params);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { valid: false, details: `Validation failed for ${action}: ${issues}` };
  }
  return { valid: true };
}

export async function executeStrategy(
  profile: RiskProfile,
  action: string,
  params: Record<string, any>,
  userAddress?: string
): Promise<ExecutionResult> {
  if (circuitKilled) {
    return { success: false, action, details: "Circuit breaker engaged — all strategy execution is halted" };
  }

  const validation = validateToolArgs(action, params);
  if (!validation.valid) {
    logger.warn("Executor", `Validation rejected ${action}`, { issues: validation.details });
    return { success: false, action, details: validation.details };
  }

  logger.info("Executor", `Executing: ${action}`, { user: userAddress || "anonymous", tier: profile.label });

  let kpPath: string | undefined;
  const isWriteOp = ["execute_swap", "open_position", "open_perp", "close_position", "close_perp"].includes(action);

  try {
    if (isWriteOp && userAddress) {
      kpPath = await writeKeypairFile(userAddress);
    }

    let result: any;

    switch (action) {
      case "pools_list": {
        result = await byreal.pools.list();
        break;
      }
      case "pool_info": {
        result = await byreal.pools.info(params.poolAddress);
        break;
      }
      case "check_balance": {
        const clmmPositions = await byreal.positions.list(kpPath ? { keypairPath: kpPath } : undefined);
        const perpAccount = await byrealPerps.account.info(kpPath ? { keypairPath: kpPath } : undefined);
        const perpPositions = await byrealPerps.position.list(kpPath ? { keypairPath: kpPath } : undefined);
        result = {
          success: clmmPositions.success || perpAccount.success,
          data: {
            clmmPositions: clmmPositions.data,
            perpAccount: perpAccount.data,
            perpPositions: perpPositions.data,
          },
          raw: "",
        };
        break;
      }
      case "protocol_stats": {
        result = await byreal.overview(kpPath ? { keypairPath: kpPath } : undefined);
        break;
      }
      case "execute_swap": {
        result = await byreal.swap.execute(
          params.inputMint,
          params.outputMint,
          params.amount,
          params.dryRun || false,
          kpPath ? { keypairPath: kpPath } : undefined
        );
        break;
      }
      case "open_position": {
        result = await byreal.positions.open(
          params.pool,
          params.priceLower,
          params.priceUpper,
          params.amount,
          true,
          kpPath ? { keypairPath: kpPath } : undefined
        );
        break;
      }
      case "open_perp": {
        result = await byrealPerps.order.market(
          params.side,
          params.size,
          params.coin,
          params.tp,
          params.sl,
          kpPath ? { keypairPath: kpPath } : undefined
        );
        break;
      }
      case "close_position": {
        result = await byreal.positions.close(params.position, kpPath ? { keypairPath: kpPath } : undefined);
        break;
      }
      case "close_perp": {
        result = await byrealPerps.position.closeMarket(params.coin, kpPath ? { keypairPath: kpPath } : undefined);
        break;
      }
      case "list_positions": {
        result = await byreal.positions.list(kpPath ? { keypairPath: kpPath } : undefined);
        break;
      }
      case "get_portfolio": {
        const overview = await byreal.overview(kpPath ? { keypairPath: kpPath } : undefined);
        const positions = await byreal.positions.list(kpPath ? { keypairPath: kpPath } : undefined);
        const allOk = overview.success && positions.success;
        result = { success: allOk, data: { overview: overview.data, clmmPositions: positions.data }, raw: "" };
        break;
      }
      case "get_wallet_address": {
        const walletAddr = params.userAddress || userAddress;
        if (walletAddr) {
          const { publicKey } = deriveKeypair(walletAddr);
          result = { success: true, data: { address: publicKey, chain: "Solana", derived: true }, raw: publicKey };
        } else {
          const addr = process.env.BYREAL_WALLET_ADDRESS || "Not configured";
          result = { success: true, data: { address: addr, chain: "Solana", derived: false }, raw: addr };
        }
        break;
      }
      default:
        return { success: false, action, details: `Unknown action: ${action}` };
    }

    let txHash: string | undefined;
    try {
      txHash = await logDecision(action, { params, result: result.data, riskTier: profile.label, userAddress });
    } catch (e) {
      logger.warn("Executor", "On-chain logging failed", { error: (e as Error).message });
    }

    if (isWriteOp && result.success) {
      const pnl = action.startsWith("close") ? (result.data?.pnl || 0) : 0;
      const value = result.data?.depositedUsd || result.data?.valueUsd || 0;
      logPerformance(pnl, value).catch((e) => logger.warn("Executor", "logPerformance failed", { error: (e as Error).message }));
      tradeEvents.emit("trade", {
        action,
        success: true,
        pnl,
        value,
        userAddress,
        timestamp: Date.now(),
        pool: result.data?.pool || params.pool || "",
      });
    }

    return {
      success: result.success,
      action,
      details: JSON.stringify(result.data || result.raw),
      txHash,
    };
  } catch (err: any) {
    logger.error("Executor", `Error executing ${action}`, { error: err.message });
    return {
      success: false,
      action,
      details: err.message || String(err),
    };
  } finally {
    if (kpPath) cleanupKeypairFile(kpPath);
  }
}
