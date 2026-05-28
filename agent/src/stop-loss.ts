import { logger } from "./logger";
import { byreal } from "./skills/byreal-wrapper";
import { byrealPerps } from "./skills/byreal-wrapper";
import { writeKeypairFile, cleanupKeypairFile } from "./skills/wallet-derivation";

const CHECK_INTERVAL_MS = 60_000;
const MAX_DRAWDOWN_MONITOR = 0.95;
const MIN_SOL_BALANCE = 0.002;

let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let running = false;
let getSessionsKeys: (() => string[]) | null = null;
let getSession: ((id: string) => any) | null = null;

export function setSessionAccess(keysFn: () => string[], getFn: (id: string) => any): void {
  getSessionsKeys = keysFn;
  getSession = getFn;
}

async function checkPositionsForWallet(kpPath?: string): Promise<void> {
  const overview = await byreal.overview(kpPath ? { keypairPath: kpPath } : undefined);
  if (!overview.success) return;

  const positions = await byreal.positions.list(kpPath ? { keypairPath: kpPath } : undefined);
  if (!positions.success) return;

  const posList = Array.isArray(positions.data) ? positions.data : (positions.data?.positions ?? []);
  if (posList.length === 0) return;

  for (const pos of posList) {
    const depositted = pos.depositedUsd || 0;
    const currentValue = pos.valueUsd || 0;
    if (depositted > 0 && currentValue < depositted * MAX_DRAWDOWN_MONITOR) {
      const drawdown = ((depositted - currentValue) / depositted * 100).toFixed(1);
      logger.warn("StopLoss", "Position exceeded drawdown threshold, closing", {
        position: pos.address || pos.nftMint,
        drawdown: `${drawdown}%`,
        deposited: depositted,
        current: currentValue,
      });
      try {
        await byreal.positions.close(pos.address || pos.nftMint, kpPath ? { keypairPath: kpPath } : undefined);
        logger.info("StopLoss", "Position closed due to stop-loss", { position: pos.address || pos.nftMint });
      } catch (e) {
        logger.error("StopLoss", "Failed to close position", { error: (e as Error).message });
      }
    }
  }
}

async function checkStopLosses(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await checkPositionsForWallet();

    if (getSessionsKeys && getSession) {
      for (const sid of getSessionsKeys()) {
        const session = getSession(sid);
        if (session?.userAddress && session.userAddress.startsWith("0x")) {
          let kpPath: string | undefined;
          try {
            kpPath = await writeKeypairFile(session.userAddress);
            await checkPositionsForWallet(kpPath);
          } catch (e) {
            logger.warn("StopLoss", "Failed to check derived wallet", { user: session.userAddress, error: (e as Error).message });
          } finally {
            if (kpPath) cleanupKeypairFile(kpPath);
          }
        }
      }
    }
  } catch (e) {
    logger.error("StopLoss", "Check failed", { error: (e as Error).message });
  } finally {
    running = false;
    scheduleNext();
  }
}

function scheduleNext(): void {
  timeoutHandle = setTimeout(checkStopLosses, CHECK_INTERVAL_MS);
}

export function startStopLossMonitor(): void {
  if (timeoutHandle) return;
  logger.info("StopLoss", "Starting stop-loss monitor", { intervalMs: CHECK_INTERVAL_MS });
  scheduleNext();
}

export function stopStopLossMonitor(): void {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
    running = false;
    logger.info("StopLoss", "Stop-loss monitor stopped");
  }
}
