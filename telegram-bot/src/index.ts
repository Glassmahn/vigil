import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const AGENT_API = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";
const VIGIL_API_KEY = process.env.VIGIL_API_KEY || "";
const DATA_FILE = path.join(__dirname, "..", "data", "sessions.json");

function agentFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (VIGIL_API_KEY) headers["x-api-key"] = VIGIL_API_KEY;
  return fetch(`${AGENT_API}${path}`, { ...options, headers });
}

if (!TOKEN) {
  console.error("[VigilBot] TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Rate limiter
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// Persisted state
let userSessions = new Map<number, string>();
let linkedAddresses = new Map<number, string>();

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      if (raw.userSessions) userSessions = new Map(Object.entries(raw.userSessions).map(([k, v]) => [Number(k), v as string]));
      if (raw.linkedAddresses) linkedAddresses = new Map(Object.entries(raw.linkedAddresses).map(([k, v]) => [Number(k), v as string]));
      console.log(`[VigilBot] Loaded ${userSessions.size} sessions, ${linkedAddresses.size} linked addresses`);
    }
  } catch (e) {
    console.warn("[VigilBot] Could not load persisted state:", e);
  }
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      userSessions: Object.fromEntries(userSessions),
      linkedAddresses: Object.fromEntries(linkedAddresses),
      savedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn("[VigilBot] Could not persist state:", e);
  }
}

// Periodic cleanup of stale entries (every hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const userLastActive = new Map<number, number>();

function cleanupStaleEntries() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [userId, lastActive] of userLastActive) {
    if (lastActive < cutoff) {
      userSessions.delete(userId);
      linkedAddresses.delete(userId);
      userLastActive.delete(userId);
    }
  }
}

setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS);

// Save every 30s and on important changes
setInterval(saveState, 30000);
loadState();

function getSessionId(userId: number): string {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, `telegram-${userId}-${Date.now()}`);
    saveState();
  }
  return userSessions.get(userId)!;
}

async function callAgent(sessionId: string, message: string, userAddress?: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const body: any = { sessionId, message };
    if (userAddress) body.userAddress = userAddress;
    const response = await agentFetch("/chat", {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      const text = await response.text();
      return `Error: ${response.status} ${text}`;
    }
    const data = await response.json();
    return data.reply || "No response from agent.";
  } catch (err: any) {
    if (err?.name === "AbortError") return "Agent took too long to respond. Please try again.";
    return `Cannot reach Vigil agent backend. Make sure it's running on ${AGENT_API}`;
  }
}

async function callAgentStream(chatId: number, sessionId: string, message: string, userAddress?: string): Promise<string> {
  try {
    const sentMsg = await bot.sendMessage(chatId, "⏳ Thinking...");
    const msgId = sentMsg.message_id;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const body: any = { sessionId, message };
    if (userAddress) body.userAddress = userAddress;

    const response = await agentFetch("/chat/stream", {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      await bot.editMessageText(`Error: ${response.status} ${text}`, { chat_id: chatId, message_id: msgId });
      return `Error: ${response.status} ${text}`;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let lastEdit = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) continue;
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        try {
          const parsed = JSON.parse(raw);
          if (parsed.token !== undefined) {
            fullContent += parsed.token;
            // Update message every ~500ms during streaming
            const now = Date.now();
            if (now - lastEdit > 500) {
              lastEdit = now;
                try {
                  await bot.editMessageText(fullContent.substring(0, 4000), {
                    chat_id: chatId, message_id: msgId,
                    parse_mode: "Markdown",
                  });
                } catch (e: any) {
                  console.warn("[VigilBot] Stream edit failed:", e?.message?.substring(0, 100));
                }
            }
          }
        } catch {}
      }
    }

    // Final update with full content
    const cleanContent = fullContent
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}(.*?)`{1,3}/g, "$1");
    try {
      await bot.editMessageText(cleanContent.substring(0, 4000), {
        chat_id: chatId, message_id: msgId,
      });
    } catch (e: any) {
      console.warn("[VigilBot] Final edit failed:", e?.message?.substring(0, 100));
    }

    return fullContent;
  } catch (err: any) {
    if (err?.name === "AbortError") return "Agent took too long to respond. Please try again.";
    return `Cannot reach Vigil agent backend. Make sure it's running on ${AGENT_API}`;
  }
}

function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 Balance", callback_data: "balance" }, { text: "📊 Risk", callback_data: "risk" }],
        [{ text: "👛 Wallet", callback_data: "wallet" }, { text: "📈 Positions", callback_data: "positions" }],
        [{ text: "📤 Withdraw", callback_data: "withdraw" }, { text: "ℹ️ Help", callback_data: "help" }],
      ],
    },
  };
}

bot.on("callback_query", async (q) => {
  const chatId = q.message?.chat.id;
  const userId = q.from.id;
  if (!chatId || !q.data) return;
  if (!checkRateLimit(userId)) {
    try { await bot.sendMessage(chatId, "⏳ You're moving too fast — please slow down."); } catch {}
    return;
  }
  userLastActive.set(userId, Date.now());
  try { await bot.answerCallbackQuery(q.id); } catch {}

  const sessionId = getSessionId(userId);
  const linkedAddress = linkedAddresses.get(userId) || `telegram-${userId}`;

  const sendMsg = async (text: string, opts?: any) => {
    try { await bot.sendMessage(chatId, text, opts); } catch (e: any) {
      console.warn("[VigilBot] sendMessage failed:", e?.message?.substring(0, 100));
    }
  };

  switch (q.data) {
    case "balance": {
      const reply = await callAgent(sessionId, "Show my balances and portfolio summary", linkedAddress);
      sendMsg(reply, { parse_mode: "Markdown", ...mainKeyboard() });
      break;
    }
    case "risk": {
      const reply = await callAgent(sessionId, "I want to assess my risk profile");
      sendMsg(reply, { parse_mode: "Markdown" });
      break;
    }
    case "wallet": {
      try {
        const res = await agentFetch(`/wallet?userAddress=${encodeURIComponent(linkedAddress)}`);
        const data = await res.json();
        sendMsg(
          `👛 *Funding Wallet*\n\n\`${data.address}\`\n\nSend SOL here to fund trades.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📋 Copy", callback_data: "copy_wallet" }]] } }
        );
      } catch {
        sendMsg("Could not fetch wallet.");
      }
      break;
    }
    case "positions": {
      try {
        const res = await agentFetch(`/portfolio?userAddress=${encodeURIComponent(linkedAddress)}`);
        const data = await res.json();
        if (!data.positions || data.positions.length === 0) {
          return sendMsg("No open positions.", { ...mainKeyboard() });
        }
        const lines = data.positions.map((p: any, i: number) => {
          const pool = p.pool || p.poolName || `Position ${i + 1}`;
          const val = p.depositedUsd || p.valueUsd || 0;
          const apr = p.apr || p.apr24h || 0;
          return `${i + 1}. *${pool}* — $${val.toFixed(2)}${apr > 0 ? ` (${apr.toFixed(1)}% APR)` : ""}`;
        });
        const keyboard = data.positions.map((p: any, i: number) => {
          const posId = p.address || p.nftMint || `pos-${i}`;
          return [{ text: `Close #${i + 1}`, callback_data: `close_pos_${posId}` }];
        });
        sendMsg(`📊 *Open Positions (${data.positions.length})*\n\n$${(data.portfolioValue || 0).toFixed(2)} total\n\n${lines.join("\n")}`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }
        );
      } catch {
        sendMsg("Could not fetch positions.");
      }
      break;
    }
    case "strategies": {
      const reply = await callAgent(sessionId, "What strategies are active right now?");
      sendMsg(reply, { parse_mode: "Markdown" });
      break;
    }
    case "help": {
      sendMsg(helpText(), { parse_mode: "Markdown", ...mainKeyboard() });
      break;
    }
    case "withdraw": {
      try {
        const res = await agentFetch(`/portfolio?userAddress=${encodeURIComponent(linkedAddress)}`);
        const data = await res.json();
        const posCount = data.positions?.length || 0;
        if (posCount === 0) {
          return sendMsg("No open positions to withdraw from. Your funds are already available in your wallet.", { ...mainKeyboard() });
        }
        const walletRes = await agentFetch(`/wallet?userAddress=${encodeURIComponent(linkedAddress)}`);
        const walletData = await walletRes.json();
        sendMsg(
          `📤 *Withdraw Funds*\n\nYou have *${posCount}* open position${posCount > 1 ? "s" : ""}.\n\nClose positions to release funds back to your wallet:\n\`${walletData.address || "fetching..."}\`\n\nYou can close individual positions via /positions or close all at once below.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: `Close All (${posCount})`, callback_data: "close_all" }], [{ text: "View Positions", callback_data: "positions" }]] } }
        );
      } catch {
        sendMsg("Could not fetch portfolio. Agent may be offline.", { ...mainKeyboard() });
      }
      break;
    }
    case "close_all": {
      try {
        const res = await agentFetch(`/portfolio?userAddress=${encodeURIComponent(linkedAddress)}`);
        const data = await res.json();
        const positions = data.positions || [];
        if (positions.length === 0) return sendMsg("No positions to close.", { ...mainKeyboard() });

        let success = 0;
        let fail = 0;
        for (const p of positions) {
          const posId = p.address || p.nftMint;
          if (!posId) continue;
          try {
            const closeRes = await agentFetch(`/portfolio/close`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userAddress: linkedAddress, position: posId }),
            });
            const closeData = await closeRes.json();
            if (closeData.success) success++; else fail++;
          } catch { fail++; }
        }
        sendMsg(
          `📤 *Withdraw Complete*\n\n✅ ${success} position${success !== 1 ? "s" : ""} closed\n${fail > 0 ? `❌ ${fail} failed` : ""}\n\nFunds have been returned to your Byreal wallet.`,
          { parse_mode: "Markdown", ...mainKeyboard() }
        );
      } catch {
        sendMsg("Failed to close positions. Agent may be offline.", { ...mainKeyboard() });
      }
      break;
    }
    case "copy_wallet": {
      sendMsg("You can copy the wallet address from the message above. Send it to your wallet app to fund Vigil.");
      break;
    }
    default: {
      if (q.data.startsWith("close_pos_")) {
        const position = q.data.replace("close_pos_", "");
        try {
          const res = await agentFetch(`/portfolio/close`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: linkedAddress, position }),
          });
          const data = await res.json();
          if (data.success) {
            sendMsg(`✅ Position closed successfully.`, { ...mainKeyboard() });
          } else {
            sendMsg(`❌ Failed to close: ${data.details || data.error}`, { ...mainKeyboard() });
          }
        } catch {
          sendMsg("❌ Could not close position. Agent may be offline.", { ...mainKeyboard() });
        }
      }
      break;
    }
  }
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);

  bot.sendMessage(chatId,
    `🛡️ *Welcome to Vigil.*

*While you sleep, your wealth is watched.*

I'm your autonomous personal yield agent. I can:
• Assess your risk profile through conversation
• Deploy capital across DeFi strategies on Mantle + Solana
• Monitor and rebalance positions automatically
• Log every decision on-chain for transparency

*Or just talk to me naturally.* Say something like "I want to start investing" or "What's my portfolio like?"
`,
    { parse_mode: "Markdown", ...mainKeyboard() }
  );
});

bot.onText(/\/positions/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const linkedAddress = linkedAddresses.get(userId) || `telegram-${userId}`;

  try {
    const res = await agentFetch(`/portfolio?userAddress=${encodeURIComponent(linkedAddress)}`);
    const data = await res.json();
    if (!data.positions || data.positions.length === 0) {
      return bot.sendMessage(chatId, "No open positions. Chat with Vigil to deploy a strategy.", { ...mainKeyboard() });
    }
    const lines = data.positions.map((p: any, i: number) => {
      const pool = p.pool || p.poolName || `Position ${i + 1}`;
      const val = p.depositedUsd || p.valueUsd || 0;
      const apr = p.apr || p.apr24h || 0;
      return `${i + 1}. *${pool}* — $${val.toFixed(2)}${apr > 0 ? ` (${apr.toFixed(1)}% APR)` : ""}`;
    });
    const keyboard = data.positions.map((p: any, i: number) => {
      const posId = p.address || p.nftMint || `pos-${i}`;
      return [{ text: `Close #${i + 1}`, callback_data: `close_pos_${posId}` }];
    });
    bot.sendMessage(chatId,
      `📊 *Open Positions (${data.positions.length})*\n\nPortfolio Value: $${(data.portfolioValue || 0).toFixed(2)}\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }
    );
  } catch {
    bot.sendMessage(chatId, "Could not fetch positions. Agent backend may not be running.");
  }
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);
  const reply = await callAgent(sessionId, "Show my balances and portfolio summary");
  bot.sendMessage(chatId, reply, { parse_mode: "Markdown", ...mainKeyboard() });
});

bot.onText(/\/risk/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);
  const reply = await callAgent(sessionId, "I want to assess my risk profile");
  bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
});

bot.onText(/\/strategies/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);
  const reply = await callAgent(sessionId, "What strategies are active right now?");
  bot.sendMessage(chatId, reply, { parse_mode: "Markdown", ...mainKeyboard() });
});

bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);

  try {
    const response = await agentFetch(`/history`);
    const data = await response.json();
    if (data.decisions && data.decisions.length > 0) {
      const lines = data.decisions.slice(-10).map((d: any) =>
        `• ${d.action} — ${new Date(d.timestamp * 1000).toLocaleString()}`
      );
      bot.sendMessage(chatId, `📋 *Recent Decisions:*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, "No on-chain decisions recorded yet. Start trading to see them here.");
    }
  } catch {
    bot.sendMessage(chatId, "Could not fetch history. Agent backend may not be running.");
  }
});

bot.onText(/\/pause/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);
  try {
    const res = await agentFetch(`/pause`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    bot.sendMessage(chatId, data.message || "⏸️ Vigil paused.");
  } catch {
    bot.sendMessage(chatId, "⏸️ Vigil paused (offline — will resume when agent reconnects).");
  }
});

bot.onText(/\/resume/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const sessionId = getSessionId(userId);
  try {
    const res = await agentFetch(`/resume`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    bot.sendMessage(chatId, data.message || "▶️ Vigil resumed.");
  } catch {
    bot.sendMessage(chatId, "▶️ Vigil resumed (local mode).");
  }
});

bot.onText(/\/link(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const address = match?.[1]?.trim();
  if (!address || !address.startsWith("0x")) {
    return bot.sendMessage(chatId, "Please provide your Mantle wallet address.\n\nExample: `/link 0x1234...`", { parse_mode: "Markdown" });
  }
  linkedAddresses.set(userId, address);
  saveState();
  try {
    const res = await agentFetch(`/wallet?userAddress=${encodeURIComponent(address)}`);
    const data = await res.json();
    bot.sendMessage(chatId,
      `✅ *Wallet Linked!*\n\nMantle: \`${address}\`\nSolana (derived): \`${data.address}\`\n\nNow /wallet and /balance will use this address.\n\nThe wallets you see on the web dashboard will match exactly.`,
      { parse_mode: "Markdown" }
    );
  } catch {
    bot.sendMessage(chatId, "✅ Address saved. Run /wallet to see your derived Solana wallet.");
  }
});

bot.onText(/\/unlink/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  linkedAddresses.delete(userId);
  saveState();
  bot.sendMessage(chatId, "Wallet unlinked. /wallet now uses your Telegram-derived address.");
});

bot.onText(/\/wallet(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const explicit = match?.[1]?.trim();
  let userAddress: string;
  let note: string;

  if (explicit && explicit.startsWith("0x")) {
    userAddress = explicit;
    linkedAddresses.set(userId, explicit);
    saveState();
    note = "This wallet is derived from your Mantle address. It's been linked — use /wallet next time without the address.";
  } else if (linkedAddresses.has(userId)) {
    userAddress = linkedAddresses.get(userId)!;
    note = "This wallet is derived from your linked Mantle address. It matches your web dashboard.";
  } else if (explicit) {
    userAddress = explicit;
    note = "Custom identifier wallet.";
  } else {
    userAddress = `telegram-${userId}`;
    note = "This wallet is derived from your Telegram ID. Use /link 0x... to match your web dashboard wallet.";
  }

  try {
    const response = await agentFetch(`/wallet?userAddress=${encodeURIComponent(userAddress)}`);
    const data = await response.json();
    bot.sendMessage(chatId,
      `*Funding Wallet*\n\n${note}\n\n\`${data.address}\`\n\nJust a few $ worth of SOL covers hundreds of transactions.\n\nChain: ${data.chain}`,
      { parse_mode: "Markdown" }
    );
  } catch {
    bot.sendMessage(chatId, "Could not fetch wallet address. Agent backend may not be running.");
  }
});

bot.onText(/\/withdraw/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const linkedAddress = linkedAddresses.get(userId) || `telegram-${userId}`;
  try {
    const res = await agentFetch(`/portfolio?userAddress=${encodeURIComponent(linkedAddress)}`);
    const data = await res.json();
    const posCount = data.positions?.length || 0;
    if (posCount === 0) {
      return bot.sendMessage(chatId, "No open positions to withdraw from. Your funds are already available.", { ...mainKeyboard() });
    }
    bot.sendMessage(chatId,
      `📤 *Withdraw Funds*\n\nYou have *${posCount}* open position${posCount > 1 ? "s" : ""}.\n\nClose positions to release funds back to your wallet.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: `Close All (${posCount})`, callback_data: "close_all" }], [{ text: "View Positions", callback_data: "positions" }]] } }
    );
  } catch {
    bot.sendMessage(chatId, "Could not fetch portfolio. Agent may be offline.", { ...mainKeyboard() });
  }
});

bot.onText(/\/fund/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const linkedAddress = linkedAddresses.get(userId) || `telegram-${userId}`;

  try {
    const res = await agentFetch(`/wallet?userAddress=${encodeURIComponent(linkedAddress)}`);
    const data = await res.json();
    bot.sendMessage(chatId,
      `*Funding Vigil*\n\nTo deploy strategies, Vigil needs:\n1. *SOL* on Solana — for Byreal DEX gas fees\n2. *Tokens* on Solana — for providing liquidity\n\n*Your wallet:*\n\`${data.address}\`\n\nSend SOL and tokens here to deploy.\nOn-chain logging on Mantle is handled by the deployer — you don't need MNT.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📋 Copy", callback_data: "copy_wallet" }]] } }
    );
  } catch {
    bot.sendMessage(chatId,
      `*Funding Vigil*\n\nTo deploy strategies, Vigil needs:\n1. *SOL* on Solana — for Byreal DEX gas fees\n2. *Tokens* on Solana — for providing liquidity\n\nUse /wallet to get your address, then send funds there.`,
      { parse_mode: "Markdown" }
    );
  }
});

function helpText() {
  return `*Vigil Commands*
    
/start — Introduction
/balance — Portfolio overview
/risk — Assess your risk profile
/positions — View open positions with close buttons
/strategies — View active strategies
/withdraw — Close positions and withdraw funds
/wallet — Get your Solana wallet address
/link 0x... — Link Mantle wallet to match web dashboard
/unlink — Remove linked wallet
/fund — How to fund Vigil
/history — Recent on-chain decisions
/pause — Pause the agent
/resume — Resume the agent
/help — This message

*Tips:*
• You can also send natural language messages
• Try: "Deploy $100 to safe farming"
• Try: "How's my portfolio doing?"
• Try: "I want more aggressive strategies"
• Try: "How do I fund the wallet?"`;
}

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, helpText(), { parse_mode: "Markdown", ...mainKeyboard() });
});

bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  if (!checkRateLimit(userId)) {
    bot.sendMessage(chatId, "⏳ You're sending messages too fast — please slow down.");
    return;
  }
  userLastActive.set(userId, Date.now());
  const sessionId = getSessionId(userId);
  const text = msg.text || "";
  const linkedAddress = linkedAddresses.get(userId);

  bot.sendChatAction(chatId, "typing");
  await callAgentStream(chatId, sessionId, text, linkedAddress);
});

console.log("[VigilBot] Running...");
