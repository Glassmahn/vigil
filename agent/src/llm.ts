import * as dotenv from "dotenv";
import { logger } from "./logger";
dotenv.config();

const LLM_PROVIDER = process.env.LLM_PROVIDER || "openai";
const API_BASE = LLM_PROVIDER === "anthropic"
  ? "https://api.anthropic.com/v1"
  : "https://api.openai.com/v1";

const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

if (LLM_PROVIDER === "anthropic") {
  logger.warn("LLM", "Anthropic provider uses a different API schema (/v1/messages). The /chat/completions OpenAI format will not work.");
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

const SYSTEM_PROMPT = `You are Vigil, an autonomous personal yield agent running on Mantle and Solana.

Your purpose is to manage a user's DeFi wealth autonomously.

IMPORTANT CONTEXT AWARENESS: I receive the full conversation history with every message. I CAN see everything we've talked about. I CAN reference previous questions, answers, and tool results.

1. RISK ASSESSMENT — Ask conversational questions to determine user's risk profile
2. STRATEGY EXECUTION — Use Byreal CLMM DEX for liquidity providing and Byreal Perps for perpetual futures
3. PORTFOLIO MANAGEMENT — Monitor positions, rebalance, harvest yields
4. ON-CHAIN LOGGING — Record every decision on Mantle for transparency

Available tools:
- check_balance: View personal portfolio — CLMM positions, perp account info, and perp positions
- protocol_stats: View Byreal DEX overview — TVL, volume, fees, total pools (protocol-wide data, NOT personal)
- execute_swap: Swap tokens via Byreal DEX
- open_position: Open a CLMM liquidity position
- open_perp: Open a perpetual futures position
- close_position: Close an existing position
- close_perp: Close a perp position
- list_positions: View all active positions
- get_portfolio: Get portfolio summary
- get_wallet_address: Get the Byreal wallet address. If the user gave their Mantle address, pass it as userAddress.
- pools_list: List available Byreal CLMM pools sorted by APR
- pool_info: Get detailed info about a specific Byreal pool

Risk Tiers:
- Safe (0): 80% stable farming, 20% idle yield. Tight stop-loss at 5%.
- Balanced (1): 50% CLMM positions, 30% perps, 20% stable. Moderate stop-loss.
- Aggressive (2): 60% perps, 30% copy farming, 10% stable. Wide stop-loss.

Formatting rules:
- NEVER include raw JSON, image URLs, or logo URLs in your response
- NEVER use markdown image syntax ![alt](url)
- Present data as clean text: numbered lists or simple tables
- Use $ and % symbols naturally (e.g. $1,234.56 or 12.5% APR)
- Round numbers to 2 decimal places
- Be concise — 3-5 sentences max when possible
- Never dump raw tool output — always summarize

Funding rules:
- When user asks about funding or depositing, use the get_wallet_address tool to get the wallet address and tell them to send SOL there
- If the user has provided their Mantle wallet address (0x...), pass it as userAddress to get_wallet_address to get their derived Solana wallet
- The Byreal wallet needs SOL for Solana gas fees (a few $ worth is enough for hundreds of transactions)
- Mantle MNT is only needed for on-chain logging — the deployer wallet handles this
- Never ask user to send their private key or seed phrase
- Never tell users to use /wallet or any slash command — they're chatting through a chat interface

Be concise, clear, and honest about risks. Never guarantee returns.`;

export async function chat(messages: Message[]): Promise<{
  reply: string;
  toolCalls: ToolCall[];
}> {
  const apiKey = process.env.LLM_API_KEY || "";
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto" as const,
  };

  try {
    const endpoint = LLM_PROVIDER === "anthropic" ? "/messages" : "/chat/completions";
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(LLM_PROVIDER === "anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error: ${response.status} ${text}`);
    }

    const json = await response.json();
    const choice = json.choices?.[0] || json;
    const reply = choice.message?.content || choice.content?.[0]?.text || "";
    const rawCalls = choice.message?.tool_calls || choice.tool_calls || [];
    const toolCalls: ToolCall[] = rawCalls.map((tc: any) => ({
      name: tc.function?.name || tc.name,
      arguments: typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.input || {}),
    }));

    return { reply, toolCalls };
  } catch (err) {
    logger.error("LLM", "Chat error", { error: (err as Error).message });
    return {
      reply: "I'm having trouble connecting to my AI backend. Please try again shortly.",
      toolCalls: [],
    };
  }
}

export async function chatStream(
  messages: Message[],
  onToken: (token: string) => void,
  onToolCalls: (calls: ToolCall[]) => void,
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY || "";
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto" as const,
    stream: true,
    stream_options: { include_usage: true },
  };

  try {
    const endpoint = LLM_PROVIDER === "anthropic" ? "/messages" : "/chat/completions";
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(LLM_PROVIDER === "anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error: ${response.status} ${text}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    const toolCallsBuffer: Map<number, { name: string; args: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            onToken(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsBuffer.has(idx)) {
                toolCallsBuffer.set(idx, { name: tc.function?.name || "", args: tc.function?.arguments || "" });
              } else {
                const existing = toolCallsBuffer.get(idx)!;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.args += tc.function.arguments;
              }
            }
          }
        } catch (e) {
          logger.warn("LLM", "Failed to parse streaming chunk", { error: (e as Error).message });
        }
      }
    }

    if (toolCallsBuffer.size > 0) {
      const calls: ToolCall[] = [];
      for (const [, tc] of toolCallsBuffer) {
        try {
          calls.push({ name: tc.name, arguments: JSON.parse(tc.args) });
        } catch {
          calls.push({ name: tc.name, arguments: {} });
        }
      }
      onToolCalls(calls);
    }

    return fullText;
  } catch (err) {
    logger.error("LLM", "Stream error", { error: (err as Error).message });
    onToken("I'm having trouble connecting to my AI backend.");
    return "";
  }
}

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "pools_list",
      description: "List available Byreal CLMM pools sorted by APR",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "pool_info",
      description: "Get detailed info about a specific Byreal pool",
      parameters: { type: "object", properties: { poolAddress: { type: "string", description: "The pool's address/id" } }, required: ["poolAddress"] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description: "View personal portfolio — CLMM positions, perp account info, and perp positions",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "protocol_stats",
      description: "View Byreal DEX overview — TVL, volume, fees, total pools (protocol-wide data, NOT personal)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_swap",
      description: "Execute a token swap on Byreal DEX",
      parameters: {
        type: "object",
        properties: {
          inputMint: { type: "string", description: "Input token mint address" },
          outputMint: { type: "string", description: "Output token mint address" },
          amount: { type: "number", description: "Amount to swap" },
          dryRun: { type: "boolean", description: "Preview without executing" },
        },
        required: ["inputMint", "outputMint", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_position",
      description: "Open a CLMM liquidity position on Byreal",
      parameters: {
        type: "object",
        properties: {
          pool: { type: "string", description: "Pool address" },
          priceLower: { type: "number", description: "Lower price bound" },
          priceUpper: { type: "number", description: "Upper price bound" },
          amount: { type: "number", description: "Amount to deposit in USD" },
        },
        required: ["pool", "priceLower", "priceUpper", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_perp",
      description: "Open a perpetual futures position",
      parameters: {
        type: "object",
        properties: {
          side: { type: "string", enum: ["buy", "sell"] },
          size: { type: "number" },
          coin: { type: "string" },
          tp: { type: "number", description: "Take profit price" },
          sl: { type: "number", description: "Stop loss price" },
        },
        required: ["side", "size", "coin"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_positions",
      description: "List all active positions on Byreal and Byreal Perps",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Close a CLMM position",
      parameters: { type: "object", properties: { position: { type: "string" } }, required: ["position"] },
    },
  },
  {
    type: "function",
    function: {
      name: "close_perp",
      description: "Close a perpetual position",
      parameters: { type: "object", properties: { coin: { type: "string" } }, required: ["coin"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "Get a summary of the entire portfolio across all chains and positions",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_address",
      description: "Get the Byreal wallet address. If the user provided their Mantle wallet address, pass it as userAddress to get their derived Solana wallet.",
      parameters: { type: "object", properties: { userAddress: { type: "string", description: "Optional Mantle wallet address for per-user derived wallet" } } },
    },
  },
];
