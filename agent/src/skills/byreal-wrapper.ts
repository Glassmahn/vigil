import { spawn } from "child_process";
import { logger } from "../logger";

const BYREAL_CLI = process.env.BYREAL_CLI_PATH || "byreal-cli";
const BYREAL_PERPS_CLI = process.env.BYREAL_PERPS_CLI_PATH || "byreal-perps-cli";

interface CliResult {
  success: boolean;
  data: any;
  raw: string;
  error?: string;
}

interface CliOptions {
  keypairPath?: string;
  timeout?: number;
}

function buildArgs(base: string[], opts?: CliOptions): string[] {
  const args = [...base, "-o", "json"];
  if (opts?.keypairPath) args.push("--keypair", opts.keypairPath);
  return args;
}

async function runCli(command: string, args: string[], opts?: CliOptions, retries = 2): Promise<CliResult> {
  const timeout = opts?.timeout || 30000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await runCliOnce(command, args, opts, timeout);
    if (result.success || attempt === retries) return result;
    logger.warn("ByrealWrapper", `Command failed, retrying (${attempt}/${retries})`, { command, args, error: result.error });
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return { success: false, data: null, raw: "", error: "All retries exhausted" };
}

function runCliOnce(command: string, args: string[], opts?: CliOptions, timeout = 30000): Promise<CliResult> {
  return new Promise((resolve) => {
    const fullArgs = buildArgs(args, opts);
    const useShell = process.platform === "win32";
    const proc = useShell
      ? spawn(`${command} ${fullArgs.map(a => /\s/.test(a) ? `"${a}"` : a).join(" ")}`, {
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        })
      : spawn(command, fullArgs, {
          stdio: ["pipe", "pipe", "pipe"],
        });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ success: false, data: null, raw: stdout, error: `Command timed out (${timeout / 1000}s)` });
    }, timeout);

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const errorText = (stderr || "").toLowerCase();
      if (errorText.includes("wallet_not_configured") || errorText.includes("not configured") || errorText.includes("no wallet")) {
        resolve({ success: false, data: null, raw: "", error: "Wallet not configured." });
        return;
      }
      const combined = stdout + stderr;
      if (code !== 0) {
        resolve({ success: false, data: null, raw: stdout, error: stderr || `Exit code ${code}` });
        return;
      }
      try {
        resolve({ success: true, data: JSON.parse(combined), raw: combined });
      } catch {
        resolve({ success: true, data: combined, raw: combined });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, data: null, raw: "", error: err.message });
    });
  });
}

export const byreal = {
  pools: {
    list(sortField = "apr24h", opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["pools", "list", "--sort-field", sortField], opts);
    },
    info(poolAddress: string, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["pools", "info", poolAddress], opts);
    },
    analyze(poolAddress: string, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["pools", "analyze", poolAddress], opts);
    },
    topPositions(poolAddress: string, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["positions", "top-positions", poolAddress], opts);
    },
  },

  tokens: {
    list(opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["tokens", "list"], opts);
    },
  },

  swap: {
    execute(inputMint: string, outputMint: string, amount: number, dryRun = false, opts?: CliOptions) {
      const args = ["swap", "execute", "--input-mint", inputMint, "--output-mint", outputMint, "--amount", String(amount)];
      if (dryRun) args.push("--dry-run");
      return runCli(BYREAL_CLI, args, opts);
    },
  },

  positions: {
    list(opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["positions", "list"], opts);
    },
    open(pool: string, priceLower: number, priceUpper: number, amount: number, autoSwap = false, opts?: CliOptions) {
      const args = ["positions", "open", "--pool", pool, "--price-lower", String(priceLower), "--price-upper", String(priceUpper), "--amount", String(amount)];
      if (autoSwap) args.push("--auto-swap");
      args.push("--confirm");
      return runCli(BYREAL_CLI, args, opts);
    },
    close(positionAddress: string, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["positions", "close", "--nft-mint", positionAddress, "--confirm"], opts);
    },
    claim(positionAddress: string, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["positions", "claim", "--nft-mint", positionAddress], opts);
    },
    copy(positionAddress: string, amountUsd: number, opts?: CliOptions) {
      return runCli(BYREAL_CLI, ["positions", "copy", "--position", positionAddress, "--amount-usd", String(amountUsd), "--confirm"], opts);
    },
  },

  overview(opts?: CliOptions) {
    return runCli(BYREAL_CLI, ["overview"], opts);
  },
};

export const byrealPerps = {
  account: {
    info(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["account", "info"], opts);
    },
    init(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["account", "init"], opts);
    },
    history(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["account", "history"], opts);
    },
  },

  order: {
    market(side: "buy" | "sell", size: number, coin: string, tp?: number, sl?: number, opts?: CliOptions) {
      const args = ["order", "market", side, String(size), coin];
      if (tp) args.push("--tp", String(tp));
      if (sl) args.push("--sl", String(sl));
      return runCli(BYREAL_PERPS_CLI, args, opts);
    },
    limit(side: "buy" | "sell", size: number, coin: string, price: number, tp?: number, sl?: number, opts?: CliOptions) {
      const args = ["order", "limit", side, String(size), coin, String(price)];
      if (tp) args.push("--tp", String(tp));
      if (sl) args.push("--sl", String(sl));
      return runCli(BYREAL_PERPS_CLI, args, opts);
    },
    list(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["order", "list"], opts);
    },
    cancel(oid: string, opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["order", "cancel", oid], opts);
    },
    cancelAll(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["order", "cancel-all", "-y"], opts);
    },
  },

  position: {
    list(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["position", "list"], opts);
    },
    closeMarket(coin: string, opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["position", "close-market", coin], opts);
    },
    closeAll(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["position", "close-all", "-y"], opts);
    },
    leverage(coin: string, leverage: number, opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["position", "leverage", coin, String(leverage)], opts);
    },
    tpsl(coin: string, tp?: number, sl?: number, opts?: CliOptions) {
      const args = ["position", "tpsl", coin];
      if (tp) args.push("--tp", String(tp));
      if (sl) args.push("--sl", String(sl));
      return runCli(BYREAL_PERPS_CLI, args, opts);
    },
    margin(coin: string, action: "add" | "remove", amount: number, opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["position", "margin", coin, action, String(amount)], opts);
    },
  },

  signal: {
    scan(opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["signal", "scan"], opts);
    },
    detail(coin: string, opts?: CliOptions) {
      return runCli(BYREAL_PERPS_CLI, ["signal", "detail", coin], opts);
    },
  },
};
