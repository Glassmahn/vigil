# Vigil — Architecture

An autonomous AI-powered DeFi yield agent. Users converse in natural language, Vigil assesses risk, executes strategies on Byreal (Solana), and logs every decision immutably on Mantle.

---

## System Overview

```
Telegram Bot ──┐
Web Dashboard ─┼──> Agent API (:3001) ──> Byreal CLI ──> Solana (Byreal DEX)
REST Clients ──┘        │
                        └──> Mantle (DecisionLog, VigilRegistry)
```

Three user-facing interfaces feed into a single Express API server. The agent talks to Solana for trading (via Byreal CLIs) and Mantle for on-chain logging.

---

## Project Structure

```
├── agent/              Express API server — core logic
├── dashboard/          Next.js 15 web UI
├── telegram-bot/       Node.js Telegram bot
├── contracts/          Solidity contracts (DecisionLog, VigilRegistry)
├── scripts/            Hardhat deploy & utility scripts
├── test/               Hardhat contract tests
├── docker-compose.yml  3-service orchestration
└── Dockerfile.*        Container builds
```

---

## Agent (`agent/src/`)

The agent is an Express server (port 3001) that wires together all subsystems.

### Request Flow

```
Request
  │
  ▼
Rate Limiter (60 req/min)
  │
  ▼
API Key Auth (x-api-key header, except /events)
  │
  ▼
Route Handler
  │
  ├── /chat -> LLM + Executor + Sanitizer
  ├── /chat/stream -> LLM streaming + Executor + Sanitizer
  ├── /portfolio -> Byreal CLI (overview + positions)
  ├── /status/global -> Health check + registry status
  ├── /circuit/* -> Emergency kill switch
  └── /events -> SSE trade event stream
```

### Key Modules

| Module | Purpose |
|---|---|
| `auth.ts` | API key middleware — checks `x-api-key` header against `VIGIL_API_KEY` env |
| `sessions.ts` | Session store backed by SQLite (`better-sqlite3`) with in-memory cache |
| `llm.ts` | OpenAI/Anthropic chat completion with tool calling (11 tools) |
| `risk-assessor.ts` | 4-question conversational profiler → Safe/Balanced/Aggressive |
| `executor.ts` | Dispatches tool calls to Byreal CLI, logs on-chain, emits trade events |
| `onchain-logger.ts` | Dual-mode (in-memory + contract) logging to DecisionLog + VigilRegistry |
| `stop-loss.ts` | Background monitor — checks positions every 60s, closes >5% drawdown |
| `sanitize.ts` | Strips images, JSON code blocks, secret keys from LLM output |
| `validation.ts` | Zod schemas for all request bodies |
| `trade-events.ts` | EventEmitter → SSE stream |

### Chat Flow

1. Receive message + `sessionId`
2. If session is paused → return paused message
3. If risk assessment is active → process answer, ask next question or finalize profile
4. If message contains "risk"/"assess" → start 4-question assessment
5. Otherwise → call LLM with conversation history
6. If LLM returns tool calls → execute each via `executeStrategy()`
7. If tools were executed → call LLM again to summarize results
8. Return final reply

### Risk Tiers

| Tier | Label | Max Drawdown | Stop Loss | Strategy |
|---|---|---|---|---|
| 0 | Safe | 5% | 5% | Stablecoin LP, idle yield, USDC staking |
| 1 | Balanced | 20% | 15% | CLMM positions, 30% perps, 20% stable |
| 2 | Aggressive | 40% | 30% | 60% perps, 30% copy farming, 10% stable |

### Tool Library (11 Tools)

| Tool | Description |
|---|---|
| `pools_list` | List Byreal CLMM pools sorted by APR |
| `pool_info` | Get pool details by address |
| `check_balance` | Check wallet balances |
| `execute_swap` | Execute token swap |
| `open_position` | Open CLMM liquidity position |
| `open_perp` | Open perpetual futures position |
| `list_positions` | List all positions |
| `close_position` | Close a CLMM position |
| `close_perp` | Close a perp position |
| `get_portfolio` | Portfolio summary |
| `get_wallet_address` | Get Byreal wallet address |

### Circuit Breaker

`POST /circuit/kill` sets an in-memory flag, toggles `VigilRegistry.toggleActive(false)` on-chain, and stops the stop-loss monitor. `POST /circuit/resume` reverses it. All strategy execution checks this flag first.

---

## Dashboard (`dashboard/src/`)

Next.js 15 app with Tailwind 4, Three.js, Framer Motion, Recharts.

```
pages/
├── page.tsx              Landing — 3D hero, pool ticker, terminal demo
├── not-found.tsx         404 page
└── (app)/
    ├── layout.tsx        App shell — sidebar, wallet connect, status strip
    ├── dashboard/page.tsx Portfolio — stats, PnL chart, activity feed, positions
    ├── chat/page.tsx     Chat — streaming, history, markdown
    └── settings/page.tsx Risk tier selector, contract viewer, agent ID
```

### API Layer (`lib/api.ts`)

All API calls go through `apiFetch()` which auto-injects the `x-api-key` header from `NEXT_PUBLIC_VIGIL_API_KEY`. SSE uses `apiEventSource()` for real-time trade events.

---

## Telegram Bot (`telegram-bot/src/`)

Polling bot with 14 commands (`/start`, `/balance`, `/risk`, `/positions`, `/strategies`, `/wallet`, `/link`, `/unlink`, `/pause`, `/resume`, `/history`, `/fund`, `/help`). Natural language messages stream responses from the agent's `/chat/stream` endpoint with real-time message editing.

Sessions are per-user, persisted to `data/sessions.json`.

---

## Smart Contracts (`contracts/`)

### DecisionLog.sol

Immutable on-chain record of every agent decision.

```
Decision: { agentId, action, metadata, timestamp, executor }
```

Functions: `registerAgent`, `logDecision`, `getDecisionCount`, `getDecision`, `getAgentDecisions`, `getAgentDecisionCount`

Access control: owner-only per agent (set at registration).

### VigilRegistry.sol

Agent configuration, risk tier, and performance tracking.

```
AgentConfig: { agentId, name, riskTier, active, totalValueManaged, totalTrades, totalPnl, createdAt, lastActiveAt, owner }
```

Functions: `createAgent`, `updateRiskTier`, `toggleActive`, `logPerformance`, `getAgentCount`, `getAgentById`

Access control: `onlyOwner` modifier — only the agent's registered owner can mutate.

---

## Data Flow

```
User says "deploy $500 to MNT/USDC"
  │
  ▼
LLM identifies tool: open_position(pool=MNT/USDC, amount=500)
  │
  ▼
Executor calls byreal.positions.open()
  │
  ├── Byreal CLI submits tx on Solana
  │
  ▼
logDecision("open_position", {pool, amount}) → DecisionLog (Mantle)
logPerformance(pnl, value) → VigilRegistry (Mantle)
tradeEvents.emit("trade", {action, pnl, value}) → SSE → Dashboard
  │
  ▼
LLM summarizes: "Position opened. Tx: abc123"
```

---

## Deployment

### Environments

| Network | Chain ID | RPC |
|---|---|---|
| Mantle Sepolia (testnet) | 5003 | `https://rpc.sepolia.mantle.xyz` |
| Mantle Mainnet | 5000 | `https://rpc.mantle.xyz` |

### Deploy Flow

1. Set `PRIVATE_KEY` (testnet) or `MAINNET_PRIVATE_KEY` (mainnet) in `.env`
2. `npm run deploy:testnet` or `npm run deploy:mainnet`
3. Script deploys DecisionLog + VigilRegistry, registers the agent, and optionally registers ERC-8004 identity
4. Copy output addresses to `.env` and `dashboard/.env.local`

### Docker

```
docker-compose up --build
```

3 services: `agent` (:3001), `dashboard` (:3000), `telegram-bot`. Dashboard depends on agent health check. Sessions persist in a named volume.

---

## Configuration

Key env vars:

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` / `MAINNET_PRIVATE_KEY` | Mantle deployer wallets |
| `VIGIL_REGISTRY` | VigilRegistry contract address |
| `NEXT_PUBLIC_DECISION_LOG_ADDRESS` | DecisionLog contract address |
| `BYREAL_MASTER_SEED` | 32-byte hex seed for per-user Solana wallet derivation |
| `VIGIL_API_KEY` | Auth key for agent API |
| `LLM_API_KEY` | OpenAI/Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |

Full list in `.env.example`.

---

## Security

- API key auth on all routes except `/events` (SSE cannot set headers)
- Rate limiting (60 req/min per IP)
- Zod validation on all request bodies
- LLM output sanitizer strips images, code blocks, and secret key patterns
- Circuit breaker can halt all trading immediately
- Temporary keypair files are written per-user and cleaned up after use
- On-chain transactions are serialized to prevent nonce conflicts
