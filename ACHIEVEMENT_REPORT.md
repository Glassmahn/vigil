# Vigil — Project Achievement Report

**Autonomous AI Yield Agent**
The Turing Test Hackathon 2026 — Agentic Wallets & Economy Track (Sponsored by Byreal)

---

## 1. Executive Summary

Vigil is an autonomous personal yield agent that manages DeFi wealth through natural conversation. Users interact via Telegram or a web dashboard, describe their investment goals in plain English, and Vigil handles risk profiling, strategy selection, on-chain execution via Byreal DEX on Solana, and immutable decision logging on Mantle using ERC-8004 agent identity standards.

Three integrated services work together:

| Service | Tech | Port |
|---------|------|------|
| AI Agent Core | Express + OpenAI GPT-4o-mini | 3001 |
| Telegram Bot | node-telegram-bot-api | — |
| Web Dashboard | Next.js 15 + Three.js | 3000 |

---

## 2. Smart Contracts

### 2.1 DecisionLog (`contracts/DecisionLog.sol`)

An on-chain decision logger that records every agent action immutably.

**Functions:**
- `registerAgent(bytes32 agentId, string name)` — Register an agent identity
- `logDecision(bytes32 agentId, string action, string metadata)` — Log a decision
- `getAgentDecisions(bytes32 agentId)` — Query all decisions for an agent
- `getDecision(uint256 index)` — Get a specific decision
- `getDecisionCount()` — Total decisions across all agents

**Access control:** `onlyRegisteredAgent` modifier ensures only the registered owner can log decisions for that agent.

**Events:**
- `DecisionLogged(bytes32 indexed agentId, string action, uint256 indexed timestamp, address indexed executor)`
- `AgentRegistered(bytes32 indexed agentId, string name, address indexed owner)`

### 2.2 VigilRegistry (`contracts/VigilRegistry.sol`)

Agent configuration and performance tracking registry.

**Functions:**
- `createAgent(bytes32 agentId, string name, uint256 riskTier)` — Register a new agent
- `updateRiskTier(bytes32 agentId, uint256 newTier)` — Update agent risk configuration
- `toggleAgentActive(bytes32 agentId)` — Pause/resume agent
- `logPerformance(bytes32 agentId, int256 pnl, uint256 valueManaged)` — Record P&L
- `getAgentById(bytes32 agentId)` — Query agent details

### 2.3 Deployment & Verification

| Contract | Mantle Sepolia Address | Status |
|----------|----------------------|--------|
| DecisionLog | `0xd38489433B393F80281f5F59Abd9B82CCacE6194` | ✅ Verified |
| VigilRegistry | `0x855dA715F3182f9A105343c91F80ba1B435BfD31` | ✅ Verified |
| Agent ID | `0x217a1ebbb9834c507bc3cf6bca6e98005aa44ba81572f89a922b83ed3215f122` | Registered |

### 2.4 Test Results

All 8 unit tests pass across both contracts:

- DecisionLog (5 tests): Agent registration, duplicate prevention, decision logging, access control, multi-decision queries
- VigilRegistry (3 tests): Agent creation, risk tier updates, P&L logging

---

## 3. AI Agent Core

### 3.1 Architecture

```
Request ──► Express (port 3001)
                │
                ├──► LLM Engine (OpenAI GPT-4o-mini)
                │       └── System prompt + tool definitions
                │
                ├──► Risk Assessor
                │       └── 4-question conversational profile
                │           → Safe / Balanced / Aggressive
                │
                ├──► Executor
                │       ├── Byreal CLI (Solana DEX)
                │       │   ├── pools list / info
                │       │   ├── swap execute
                │       │   ├── positions open / close / list
                │       │   └── wallet address / balance
                │       └── On-chain Logger
                │           └── DecisionLog contract (Mantle)
                │
                └──► Response (LLM-summarized natural language)
```

### 3.2 LLM Integration (`agent/src/llm.ts`)

- **Provider:** OpenAI (configurable to Anthropic)
- **Model:** GPT-4o-mini (configurable)
- **System prompt:** Agent identity, capabilities, risk tiers, formatting rules, funding instructions
- **Tool definitions:** 8 function-calling tools available to the LLM
- **Auto tool selection:** LLM chooses tools based on conversation context
- **Summarization:** Tool results fed back to LLM for natural language response (no raw JSON to user)

### 3.3 Tool Inventory

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `pools_list` | List Byreal CLMM pools sorted by APR | None |
| `pool_info` | Detailed pool analysis | `poolAddress` |
| `check_balance` | DEX overview + top pools | None |
| `execute_swap` | Token swap on Byreal DEX | `inputMint`, `outputMint`, `amount`, `dryRun` |
| `open_position` | Open CLMM liquidity position | `pool`, `priceLower`, `priceUpper`, `amount` |
| `close_position` | Close existing position | `position` |
| `list_positions` | View active positions | None |
| `get_portfolio` | Full portfolio summary | None |

### 3.4 Risk Assessment System (`agent/src/risk-assessor.ts`)

**4 Conversational Questions:**

| # | Question | Safe Answer | Balanced Answer | Aggressive Answer |
|---|----------|-------------|-----------------|-------------------|
| 1 | Primary goal? | Preserve capital | Balanced growth | Maximize returns |
| 2 | DeFi experience? | Beginner | Some experience | Expert |
| 3 | 20% drop reaction? | Withdraw immediately | Wait and see | Buy more |
| 4 | Investment timeline? | Less than 1 month | 1-6 months | 6+ months |

**Resulting Profiles:**

| Profile | Max Drawdown | Stop Loss | Strategy Mix |
|---------|-------------|-----------|--------------|
| Safe (tier 0) | 5% | 5% | 80% stable LP farming, 20% idle yield |
| Balanced (tier 1) | 20% | 15% | 50% CLMM positions, 30% perps, 20% stable |
| Aggressive (tier 2) | 40% | 30% | 60% perps, 30% copy farming, 10% stable |

### 3.5 Byreal CLI Wrapper (`agent/src/skills/byreal-wrapper.ts`)

- **Execution:** Uses Node.js `spawn` with `shell:true` (Windows compatibility)
- **Timeout:** 30 seconds per command (configurable)
- **Output:** Parses JSON output from `-o json` flag
- **Error handling:** Detects wallet-not-configured, command-not-found, and timeout errors
- **Functions:** Pools (list, info, analyze, top-positions), tokens (list), swap (execute), positions (open, close, claim, copy, list), wallet (address, balance), overview

### 3.6 On-Chain Logger (`agent/src/onchain-logger.ts`)

- **Network:** Mantle Sepolia (testnet)
- **Contract:** DecisionLog
- **Agent ID:** From environment variable `VIGIL_AGENT_ID`
- **Error handling:** Catches insufficient funds, contract not initialized
- **Functions:** `initLogger()`, `registerAgent()`, `logDecision()`, `getDecisionHistory()`

### 3.7 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Send message to agent |
| `/status` | GET | Session status |
| `/history` | GET | On-chain decision history |
| `/wallet` | GET | Solana wallet address |
| `/api/pools` | GET | Live Byreal pool data |
| `/configure` | POST | Set risk profile |

---

## 4. Telegram Bot

### 4.1 Command Set

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + overview of capabilities |
| `/balance` | Check portfolio status |
| `/risk` | Start risk assessment conversation |
| `/strategies` | View active strategies |
| `/wallet` | Get Solana wallet address for funding |
| `/fund` | How to fund Vigil |
| `/history` | Recent on-chain decisions |
| `/pause` | Pause agent operations |
| `/resume` | Resume agent operations |
| `/help` | Show all commands |

### 4.2 Features

- Per-user session management
- Natural language messages proxied to agent API
- 45-second fetch timeout with abort handling
- Markdown-formatted responses
- Typing indicator while waiting for agent
- Graceful error messages when agent is offline

---

## 5. Web Dashboard

### 5.1 Technology Stack

| Library | Purpose |
|---------|---------|
| Next.js 15 | React framework with App Router |
| Three.js / @react-three/fiber | 3D galaxy scene in hero |
| Framer Motion | Scroll animations, page transitions |
| Tailwind CSS | Utility-first styling (dark theme) |
| Lucide React | Icon set |
| Recharts | Charts (portfolio performance) |
| DM Sans + Instrument Serif | Font pairing |

### 5.2 Landing Page

**Sections:**
1. **3D Hero Scene** — Galaxy of multi-colored stars with blue orbiting rings (Three.js)
2. **Live Pool Ticker** — Scrolling Byreal pool data (APR, TVL) fetched from `/api/pools`
3. **Metrics Bar** — Contracts verified (2/2), risk profiles (3), 24/7 ops, ERC-8004 active
4. **Capabilities** — 3 feature cards: conversational risk assessment, autonomous execution, on-chain logging
5. **Terminal Demo** — Animated terminal showing simulated Vigil session
6. **How It Works** — 4-step workflow with numbered steps
7. **Final CTA** — Launch Terminal / Open Chat buttons

**Design System:**
- Background: `#080808` (near-black)
- Text: `#e8e8e8` (off-white)
- Accent: `#3b82f6` (electric blue, ~10% of visual area)
- Shields: monochrome + blue gradients
- Fonts: Instrument Serif (headings), DM Sans (body)
- Grain overlay texture at 2% opacity
- Scroll-triggered fade-in animations

### 5.3 App Layout (Sidebar)

- Fixed left sidebar (240px) with backdrop blur
- Shield/eye SVG logo (monochrome + blue accent)
- Navigation: Dashboard, Chat, Settings
- MetaMask wallet connect button (EIP-1193)
- Contract links: DecisionLog, VigilRegistry (Mantle Sepolia explorer)
- Mobile responsive: collapsed bottom nav bar

### 5.4 Dashboard Page

- Stat cards: Risk Profile, Portfolio Value, Active Strategies, Decisions Logged
- On-Chain Activity feed (fetched from `/history` endpoint)
- Quick Actions: Chat with Vigil, Configure Risk Profile, View Contracts
- Agent status indicator (Active/Paused)
- Animated card hover effects with blue border glow

### 5.5 Chat Page

- Message list with animated bubbles (user right, agent left)
- Typing indicator with bouncing dots
- Offline fallback message when agent is unreachable
- Input bar with send button and Enter-to-send
- "Vigil uses AI" footer disclaimer

### 5.6 Settings Page

- Risk profile selector: Safe / Balanced / Aggressive cards with animated selection
- Strategy breakdown per tier
- Max drawdown and stop-loss display
- Save button with confirmation state
- Deployed contracts viewer with copy-to-clipboard + explorer links
- "All decisions logged on Mantle" footer note

---

## 6. Infrastructure

### 6.1 Project Structure

```
vigil/
├── contracts/                # Solidity smart contracts
│   ├── DecisionLog.sol       # On-chain decision logger
│   └── VigilRegistry.sol     # Agent config & performance registry
├── scripts/
│   ├── deploy.ts             # Hardhat deployment (testnet + mainnet)
│   └── register-erc8004.ts   # ERC-8004 agent identity registration
├── test/
│   └── DecisionLog.test.ts   # Contract unit tests (8 tests)
├── agent/src/                # AI Agent API (Express)
│   ├── index.ts              # Server + routes
│   ├── llm.ts                # LLM integration + tool definitions
│   ├── risk-assessor.ts      # 4-question risk profiler
│   ├── executor.ts           # Strategy execution engine
│   ├── onchain-logger.ts     # DecisionLog contract interface
│   └── skills/
│       └── byreal-wrapper.ts # Byreal CLI wrappers
├── telegram-bot/src/
│   └── index.ts              # Telegram bot (polling)
├── dashboard/src/            # Next.js 15 frontend
│   ├── components/
│   │   ├── HeroScene.tsx     # 3D Three.js galaxy scene
│   │   ├── Logo.tsx          # Shield/eye SVG logo
│   │   └── GrainOverlay.tsx  # Film grain texture
│   └── app/
│       ├── page.tsx          # Landing page
│       ├── layout.tsx        # Root layout
│       ├── globals.css       # Design system
│       └── (app)/
│           ├── layout.tsx    # App sidebar layout
│           ├── dashboard/    # Portfolio dashboard
│           ├── chat/         # Chat interface
│           └── settings/     # Settings page
├── hardhat.config.ts         # Hardhat config (Mantle)
├── package.json              # Root scripts
├── .env                      # Environment variables
├── start.ps1                 # Convenience launcher
└── README.md                 # Full documentation
```

### 6.2 Configuration

**Environment Variables (`.env`):**
| Variable | Value |
|----------|-------|
| `MANTLE_TESTNET_RPC` | `https://rpc.sepolia.mantle.xyz` |
| `MANTLE_MAINNET_RPC` | `https://rpc.mantle.xyz` |
| `LLM_API_KEY` | Configured (OpenAI) |
| `LLM_MODEL` | `gpt-4o-mini` |
| `TELEGRAM_BOT_TOKEN` | Configured |
| `VIGIL_AGENT_ID` | `0x217a1ebbb...3215f122` |
| `NEXT_PUBLIC_DECISION_LOG_ADDRESS` | `0xd38489...ce6194` |

**Hardhat Networks:**
| Network | Chain ID | RPC |
|---------|----------|-----|
| mantleTestnet | 5003 | `https://rpc.sepolia.mantle.xyz` |
| mantleMainnet | 5000 | `https://rpc.mantle.xyz` |

### 6.3 Byreal CLI Integration

- **CLI Version:** 0.3.5
- **Installation:** `npm install -g @byreal-io/byreal-cli`
- **Wallet:** Configured via `byreal-cli wallet set`
- **Key storage:** `~/.config/byreal/keys/keypair.json`
- **Verification:** `byreal-cli wallet address` returns configured Solana address
- **Read commands working:** `pools list`, `tokens list`, `wallet address`, `overview`

### 6.4 Hardhat Configuration (Etherscan Verification)

```typescript
mantleTestnet: {
  chainId: 5003,
  apiURL: "https://sepolia.mantlescan.xyz/api",
  browserURL: "https://sepolia.mantlescan.xyz",
}
mantleMainnet: {
  chainId: 5000,
  apiURL: "https://explorer.mantle.xyz/api",
  browserURL: "https://explorer.mantle.xyz",
}
```

---

## 7. Hackathon Awards Strategy

### 7.1 20 Project Deployment Award

**Status: In Progress**

| Requirement | Status |
|-------------|--------|
| Verified contract on Mantle mainnet | ❌ Not yet (needs mainnet MNT) |
| Accessible frontend | ✅ Dashboard + Telegram running |
| 2+ min demo video | ❌ Not yet |
| Open-source repo with this README | ✅ Written (repo not yet pushed) |

### 7.2 Award Tactics

1. Deploy contracts to mainnet early (first-come, first-served)
2. Ensure contracts are verified on Mantle Explorer
3. Record comprehensive demo video showing full flow
4. Push public GitHub repo with clean README and .gitignore

---

## 8. Technical Summary

| Metric | Value |
|--------|-------|
| Total Solidity contracts | 2 |
| Contract lines of code | ~160 |
| Agent TypeScript files | 6 |
| Dashboard TypeScript files | 7 |
| Total tests | 8 (all passing) |
| API endpoints | 6 |
| Telegram commands | 10 |
| LLM tool definitions | 8 |
| Risk profiles | 3 |
| Services running | 3 (agent, bot, dashboard) |
| Blockchain | Mantle (contracts) + Solana (execution) |

---

## 9. How to Run

```bash
# Terminal 1 — Agent API
npm run agent:start      # → http://localhost:3001

# Terminal 2 — Telegram Bot
npm run bot:start        # → Chat with bot on Telegram

# Terminal 3 — Dashboard
npm run dashboard:dev    # → http://localhost:3000
```

---

## 10. Current Blockers

1. **Deployer wallet needs MNT** — On-chain logging has INSUFFICIENT_FUNDS. Need testnet MNT from https://faucet.sepolia.mantle.xyz for wallet `0xE409b5c4177B0f3B688B20f4CcC836F08aCA6B0e`
2. **Byreal wallet needs SOL** — Write commands (swap, open_position) need gas fees. User sends SOL to the address from `/wallet`
3. **Mainnet deployment** — Requires mainnet MNT for gas
4. **Byreal Perps CLI** — Requires OpenClaw/RealClaw (invite-only beta) — tools disabled for now

---

*Document generated for The Turing Test Hackathon 2026*
*Built by Vigil Development Team*
