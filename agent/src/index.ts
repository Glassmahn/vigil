(BigInt.prototype as any).toJSON = function () { return Number(this); };

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as dotenv from "dotenv";
import { chat, chatStream } from "./llm";
import { assessRisk, QUESTIONS, RiskProfile } from "./risk-assessor";
import { executeStrategy, isCircuitKilled, setCircuitKilled } from "./executor";
import { initLogger, initVigilRegistry, getDecisionHistory, registerAgent, isInitialized, updateRiskTier, getRegistryStatus, getPnlHistory, toggleOnChainKill } from "./onchain-logger";
import { deriveKeypair, writeKeypairFile, cleanupKeypairFile } from "./skills/wallet-derivation";
import { byreal } from "./skills/byreal-wrapper";
import { tradeEvents } from "./trade-events";
import { apiKeyAuth } from "./auth";
import { logger } from "./logger";
import { createSessionStore } from "./sessions";
import { chatBodySchema, configureBodySchema, pauseBodySchema, closePositionBodySchema, closePerpBodySchema } from "./validation";
import { sanitizeLLMOutput } from "./sanitize";
import { startStopLossMonitor, stopStopLossMonitor, setSessionAccess } from "./stop-loss";

dotenv.config();

function asyncErrorHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next);
  };
}

process.on("unhandledRejection", (reason) => {
  logger.error("Index", "Unhandled promise rejection", { reason: String(reason) });
});

const app = express();
const PORT = process.env.PORT || process.env.AGENT_PORT || 3001;

const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: DASHBOARD_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down" },
});

app.use(apiLimiter);

app.use((req, res, next) => {
  if (req.path === "/events") return next();
  apiKeyAuth(req, res, next);
});

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error("Index", "Unhandled error", { error: err.message, stack: err.stack });
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

function validate(schema: any) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

const sessions = createSessionStore();

app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("event: connected\ndata: {}\n\n");

  const onTrade = (data: any) => {
    if (res.writable) {
      res.write(`event: trade\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  tradeEvents.on("trade", onTrade);

  req.on("close", () => {
    tradeEvents.off("trade", onTrade);
  });
});

app.post("/chat", validate(chatBodySchema), asyncErrorHandler(async (req, res) => {
  const { sessionId, message, userAddress } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message required" });
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      riskProfile: null,
      answers: {},
      currentQuestion: null,
      userAddress,
    });
  }

  const session = sessions.get(sessionId)!;
  if (session.paused) {
    return res.json({ reply: "⏸️ Vigil is paused. Say /resume to reactivate.", riskProfile: session.riskProfile, done: true });
  }
  if (userAddress) session.userAddress = userAddress;
  session.messages.push({ role: "user", content: message });

  if (session.currentQuestion !== null) {
    const qIndex = session.currentQuestion;
    session.answers[QUESTIONS[qIndex].id] = message.toLowerCase();
    session.currentQuestion = null;

    if (qIndex < QUESTIONS.length - 1) {
      const nextQ = qIndex + 1;
      session.currentQuestion = nextQ;
      const reply = QUESTIONS[nextQ].question + "\n\n" +
        QUESTIONS[nextQ].options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      session.messages.push({ role: "assistant", content: reply });
      return res.json({ reply, riskProfile: null, done: false });
    } else {
      session.riskProfile = assessRisk(session.answers);
      const p = session.riskProfile;
      updateRiskTier(p.tier).catch((e) => logger.warn("Index", "Failed to update risk tier on-chain", { error: (e as Error).message }));
      const reply = `Risk assessment complete!\n\n📊 Your Profile: **${p.label}**\n- Max Drawdown: ${p.maxDrawdown}%\n- Stop Loss: ${p.stopLoss}%\n- Recommended: ${p.preferredStrategies.join(", ")}\n\nSay "start" to begin deploying or "change" to retake the assessment.`;
      session.messages.push({ role: "assistant", content: reply });
      return res.json({ reply, riskProfile: p, done: true });
    }
  }

  if (message.toLowerCase().includes("risk") || message.toLowerCase().includes("assess") || message.toLowerCase().includes("profile")) {
    session.currentQuestion = 0;
    const q = QUESTIONS[0];
    const reply = q.question + "\n\n" +
      q.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
    session.messages.push({ role: "assistant", content: reply });
    return res.json({ reply, riskProfile: null, done: false });
  }

  const { reply, toolCalls } = await chat(session.messages);
  const sanitizedReply = sanitizeLLMOutput(reply);

  let finalReply = sanitizedReply;

  if (toolCalls.length > 0) {
    const profile = session.riskProfile || { tier: 1, label: "Balanced", score: 1, maxDrawdown: 20, preferredStrategies: [], stopLoss: 15 };
    for (const tool of toolCalls) {
      const result = await executeStrategy(profile, tool.name, tool.arguments, session.userAddress);
      const summary = result?.details ? result.details.slice(0, 10000) : "No details";
      session.messages.push({ role: "user", content: `[Tool "${tool.name}" returned: ${summary}]` });
    }
    const { reply: summarizedReply } = await chat(session.messages);
    finalReply = sanitizeLLMOutput(summarizedReply);
  }

  session.messages.push({ role: "assistant", content: finalReply });
  res.json({ reply: finalReply, riskProfile: session.riskProfile, done: true });
}));

app.post("/chat/stream", validate(chatBodySchema), asyncErrorHandler(async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: string, data: any) => {
    if (res.writable) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const { sessionId, message, userAddress } = req.body;
  if (!sessionId || !message) {
    sendEvent("error", { error: "sessionId and message required" });
    res.end();
    return;
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [], riskProfile: null, answers: {}, currentQuestion: null, userAddress,
    });
  }

  const session = sessions.get(sessionId)!;
  if (session.paused) {
    sendEvent("done", { reply: "⏸️ Vigil is paused. Say /resume to reactivate.", riskProfile: session.riskProfile });
    res.end();
    return;
  }
  if (userAddress) session.userAddress = userAddress;
  session.messages.push({ role: "user", content: message });

  if (session.currentQuestion !== null) {
    const qIndex = session.currentQuestion;
    session.answers[QUESTIONS[qIndex].id] = message.toLowerCase();
    session.currentQuestion = null;

    if (qIndex < QUESTIONS.length - 1) {
      const nextQ = qIndex + 1;
      session.currentQuestion = nextQ;
      const reply = QUESTIONS[nextQ].question + "\n\n" +
        QUESTIONS[nextQ].options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
      session.messages.push({ role: "assistant", content: reply });
      sendEvent("token", { token: reply });
      sendEvent("done", { reply, riskProfile: null, done: false });
    } else {
      session.riskProfile = assessRisk(session.answers);
      const p = session.riskProfile;
      updateRiskTier(p.tier).catch((e) => logger.warn("Index", "Failed to update risk tier on-chain", { error: (e as Error).message }));
      const reply = `Risk assessment complete!\n\n📊 Your Profile: **${p.label}**\n- Max Drawdown: ${p.maxDrawdown}%\n- Stop Loss: ${p.stopLoss}%\n- Recommended: ${p.preferredStrategies.join(", ")}\n\nSay "start" to begin deploying or "change" to retake the assessment.`;
      session.messages.push({ role: "assistant", content: reply });
      sendEvent("risk_profile", p);
      sendEvent("token", { token: reply });
      sendEvent("done", { reply, riskProfile: p, done: true });
    }
    res.end();
    return;
  }

  if (message.toLowerCase().includes("risk") || message.toLowerCase().includes("assess") || message.toLowerCase().includes("profile")) {
    session.currentQuestion = 0;
    const q = QUESTIONS[0];
    const reply = q.question + "\n\n" + q.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
    session.messages.push({ role: "assistant", content: reply });
    sendEvent("token", { token: reply });
    sendEvent("done", { reply, riskProfile: null, done: false });
    res.end();
    return;
  }

  let toolCalls: any[] = [];
  const fullReply = await chatStream(session.messages, (token) => {
    sendEvent("token", { token });
  }, (calls) => {
    toolCalls = calls;
  });

  let finalReply = fullReply;

  if (toolCalls.length > 0) {
    const profile = session.riskProfile || { tier: 1, label: "Balanced", score: 1, maxDrawdown: 20, preferredStrategies: [], stopLoss: 15 };
    for (const tool of toolCalls) {
      const result = await executeStrategy(profile, tool.name, tool.arguments, session.userAddress);
      const summary = result?.details ? result.details.slice(0, 5000) : "No details";
      session.messages.push({ role: "user", content: `[Tool "${tool.name}" returned: ${summary}]` });
    }
    const { reply: summarizedReply } = await chat(session.messages);
    finalReply = sanitizeLLMOutput(summarizedReply);
    for (const char of finalReply) {
      sendEvent("token", { token: char });
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  session.messages.push({ role: "assistant", content: finalReply });
  sendEvent("done", { reply: finalReply, riskProfile: session.riskProfile, done: true });
  res.end();
}));

app.get("/api/pools", async (_req, res) => {
  try {
    const result = await byreal.pools.list();
    res.json(result.data || { pools: [] });
  } catch (e) {
    logger.warn("Index", "Failed to fetch pools", { error: (e as Error).message });
    res.json({ pools: [] });
  }
});

app.get("/wallet", async (req, res) => {
  const userAddress = req.query.userAddress as string | undefined;
  if (userAddress) {
    try {
      const { publicKey } = deriveKeypair(userAddress);
      return res.json({ address: publicKey, chain: "Solana", note: "Your derived Solana wallet. Send SOL here for gas.", derived: true });
    } catch (e) {
      return res.status(400).json({ error: "Failed to derive wallet", chain: "Solana" });
    }
  }
  const addr = process.env.BYREAL_WALLET_ADDRESS;
  if (addr) {
    return res.json({ address: addr, chain: "Solana", note: "Default Byreal wallet", derived: false });
  }
  res.json({ address: "Unknown", chain: "Solana", note: "Set BYREAL_MASTER_SEED in .env for per-user wallets" });
});

app.get("/portfolio", async (req, res) => {
  const userAddress = req.query.userAddress as string | undefined;
  try {
    let overview: any = { success: false };
    let positions: any = { success: false };
    if (userAddress) {
      const kpPath = await writeKeypairFile(userAddress);
      try {
        [overview, positions] = await Promise.all([
          byreal.overview({ keypairPath: kpPath }),
          byreal.positions.list({ keypairPath: kpPath }),
        ]);
      } finally {
        cleanupKeypairFile(kpPath);
      }
    } else {
      [overview, positions] = await Promise.all([
        byreal.overview(),
        byreal.positions.list(),
      ]);
    }
    const portfolioValue = overview.success ? (overview.data?.totalUsd || 0) : 0;
    const activePositions = positions.success ? (positions.data?.length || 0) : 0;
    res.json({
      portfolioValue,
      activePositions,
      overview: overview.data || null,
      positions: positions.data || [],
    });
  } catch (e: any) {
    res.json({ portfolioValue: 0, activePositions: 0, overview: null, positions: [], error: e.message });
  }
});

app.post("/portfolio/close", validate(closePositionBodySchema), async (req, res) => {
  const { userAddress, position } = req.body;
  if (!position) return res.status(400).json({ error: "position required" });
  const defaultProfile = { tier: 1, label: "Balanced", score: 1, maxDrawdown: 20, preferredStrategies: [], stopLoss: 15 };
  try {
    const result = await executeStrategy(defaultProfile as any, "close_position", { position }, userAddress);
    res.json({ success: result.success, details: result.details, txHash: result.txHash });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/portfolio/close-perp", validate(closePerpBodySchema), async (req, res) => {
  const { userAddress, coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin required" });
  const defaultProfile = { tier: 1, label: "Balanced", score: 1, maxDrawdown: 20, preferredStrategies: [], stopLoss: 15 };
  try {
    const result = await executeStrategy(defaultProfile as any, "close_perp", { coin }, userAddress);
    res.json({ success: result.success, details: result.details, txHash: result.txHash });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/status", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const userAddress = req.query.userAddress as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.json({ active: false });
  }
  const session = sessions.get(sessionId)!;

  let portfolioValue = 0;
  let activePositions = 0;
  if (userAddress) {
    try {
      const kpPath = await writeKeypairFile(userAddress);
      try {
        const [overview, positions] = await Promise.all([
          byreal.overview({ keypairPath: kpPath }),
          byreal.positions.list({ keypairPath: kpPath }),
        ]);
        if (overview.success) portfolioValue = overview.data?.totalUsd || 0;
        if (positions.success) activePositions = positions.data?.length || 0;
      } finally {
        cleanupKeypairFile(kpPath);
      }
    } catch (e) {
      logger.warn("Index", "Failed to fetch portfolio status", { error: (e as Error).message });
    }
  }

  res.json({
    active: true,
    paused: session.paused || false,
    riskProfile: session.riskProfile,
    messageCount: session.messages.length,
    portfolioValue,
    activePositions,
  });
});

app.get("/status/global", async (_req, res) => {
  const registry = await getRegistryStatus();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    sessions: sessions.size,
    onchain: isInitialized(),
    registry,
  });
});

app.get("/pnl-history", async (_req, res) => {
  const history = getPnlHistory();
  res.json({ history });
});

app.get("/portfolio/history", async (req, res) => {
  const userAddress = req.query.userAddress as string | undefined;
  const history = getPnlHistory();
  let portfolioValues = history.map((h) => ({ value: h.valueManaged, pnl: h.pnlDelta, timestamp: h.timestamp }));
  if (portfolioValues.length === 0 && userAddress) {
    try {
      const overview = await byreal.overview();
      if (overview.success) {
        portfolioValues = [{ value: overview.data?.totalUsd || 0, pnl: 0, timestamp: Math.floor(Date.now() / 1000) }];
      }
    } catch {}
  }
  res.json({ history: portfolioValues });
});

app.post("/pause", validate(pauseBodySchema), async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  if (!sessions.has(sessionId)) return res.status(404).json({ error: "Session not found" });
  const session = sessions.get(sessionId)!;
  session.paused = true;
  res.json({ paused: true, message: "Vigil paused." });
});

app.post("/resume", validate(pauseBodySchema), async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  if (!sessions.has(sessionId)) return res.status(404).json({ error: "Session not found" });
  const session = sessions.get(sessionId)!;
  session.paused = false;
  res.json({ paused: false, message: "Vigil resumed." });
});

app.get("/history", async (req, res) => {
  try {
    const decisions = await getDecisionHistory();
    res.json({ decisions });
  } catch (err: any) {
    res.json({ decisions: [], note: "On-chain logger not initialized. Decisions are only in-memory." });
  }
});

app.post("/configure", validate(configureBodySchema), async (req, res) => {
  const { sessionId, riskTier } = req.body;
  if (!sessionId || riskTier === undefined) {
    return res.status(400).json({ error: "sessionId and riskTier required" });
  }
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], riskProfile: null, answers: {}, currentQuestion: null });
  }
  const session = sessions.get(sessionId)!;

  const tier = Math.min(2, Math.max(0, riskTier)) as 0 | 1 | 2;

  session.riskProfile = assessRisk({ goal: ["preserve", "growth", "maximize"][tier], experience: ["new", "intermediate", "expert"][tier], drawdown: ["panic", "wait", "buy"][tier], timeline: ["short", "medium", "long"][tier] });
  updateRiskTier(tier).catch((e) => logger.warn("Index", "Failed to update risk tier on-chain", { error: (e as Error).message }));

  res.json({ riskProfile: session.riskProfile });
});

app.post("/circuit/kill", apiKeyAuth, async (_req, res) => {
  setCircuitKilled(true);
  toggleOnChainKill(false).catch(() => {});
  stopStopLossMonitor();
  logger.warn("Index", "Circuit breaker engaged — all strategy executions halted");
  res.json({ killed: true, message: "Emergency kill engaged. All trading halted." });
});

app.post("/circuit/resume", apiKeyAuth, async (_req, res) => {
  setCircuitKilled(false);
  toggleOnChainKill(true).catch(() => {});
setSessionAccess(() => sessions.keys(), (id) => sessions.get(id));
startStopLossMonitor();
  logger.info("Index", "Circuit breaker released — strategy execution resumed");
  res.json({ killed: false, message: "Circuit breaker released. Trading resumed." });
});

app.get("/circuit/status", async (_req, res) => {
  res.json({ killed: isCircuitKilled() });
});

startStopLossMonitor();

app.listen(PORT, () => {
  logger.info("Index", `Running on http://localhost:${PORT}`);

  const rpc = process.env.MANTLE_MAINNET_RPC || process.env.MANTLE_TESTNET_RPC;
  const pk = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const addr = process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS;
  const registryAddr = process.env.VIGIL_REGISTRY;
  const network = process.env.MANTLE_MAINNET_RPC ? "mainnet" : "testnet";
  if (rpc && pk && addr) {
    try {
      initLogger(rpc, pk, addr);
      logger.info("Index", `On-chain logger initialized (${network})`);
      if (registryAddr) {
        initVigilRegistry(registryAddr);
        logger.info("Index", "VigilRegistry initialized");
      }
      registerAgent().then((txHash) => {
        logger.info("Index", "Agent registered on-chain", { txHash });
      }).catch(() => {
        logger.info("Index", "Agent already registered on-chain");
      });
    } catch (e) {
      logger.warn("Index", "On-chain logger init failed", { error: (e as Error).message });
    }
  } else {
    logger.warn("Index", "On-chain logger not configured (set RPC, PRIVATE_KEY, DECISION_LOG_ADDRESS)");
  }
});
