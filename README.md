# Vigil

> *While you sleep, your wealth is watched.*

Vigil is an **autonomous AI yield agent** — a DeFi wealth manager that you control through natural conversation. It assesses your risk tolerance, deploys capital across concentrated liquidity market maker (CLMM) strategies on Solana via **Byreal DEX**, and immutably logs every decision on **Mantle** using ERC-8004 agent identity standards.

Built for **The Turing Test Hackathon 2026** — Agentic Wallets & Economy track, sponsored by Byreal.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Agent Capabilities](#agent-capabilities)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
  - [Telegram Commands](#telegram-commands)
  - [Web Dashboard](#web-dashboard)
  - [Natural Language Examples](#natural-language-examples)
- [API Reference](#api-reference)
- [Awards Strategy](#awards-strategy)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [FAQ](#faq)

---

## Overview

Vigil solves a fundamental problem in DeFi: **managing yield strategies is complex and time-consuming.** Most users either:

1. **Lose money** by making emotional decisions during volatility
2. **Miss opportunities** because they can't monitor markets 24/7
3. **Get overwhelmed** by the number of protocols, pools, and risk factors

Vigil acts as your personal DeFi chief investment officer. You describe your goals in plain English — *"I'm conservative, I want 5-8% APY"* — and Vigil handles the rest: risk profiling, strategy selection, execution, monitoring, and logging.

### Key Differentiators

| Feature | Vigil | Traditional Bots |
|---|---|---|
| On-Chain Identity | ERC-8004 agent NFT | None |
| Decision Logging | Immutable Mantle records | Off-chain only |
| Risk Assessment | Conversational AI | Preset parameters |
| Multi-Chain | Mantle + Solana | Usually single-chain |
| Interface | Telegram + Web | Usually just web |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                              │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │  Telegram    │    │  Web         │    │  REST API         │  │
│  │  Bot        │    │  Dashboard   │    │  (curl / scripts) │  │
│  └──────┬──────┘    └──────┬───────┘    └────────┬──────────┘  │
│         │                  │                      │              │
├─────────┼──────────────────┼──────────────────────┼──────────────┤
│         ▼                  ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    VIGIL AI CORE                         │    │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────────────┐   │    │
│  │  │  LLM       │  │  Risk     │  │  Strategy        │   │    │
│  │  │  Engine    │◄─┤  Assessor │◄─┤  Selector        │   │    │
│  │  │  (OpenAI)  │  │           │  │                  │   │    │
│  │  └─────┬──────┘  └───────────┘  └──────────────────┘   │    │
│  │        │                                                 │    │
│  │        ▼                                                 │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │              EXECUTOR                            │   │    │
│  │  │  ┌──────────────┐  ┌──────────────┐             │   │    │
│  │  │  │  Byreal CLI   │  │  On-Chain    │             │   │    │
│  │  │  │  (Solana)     │  │  Logger      │             │   │    │
│  │  │  │  - Swap       │  │  (Mantle)    │             │   │    │
│  │  │  │  - LP Pools   │  │  - logDecision             │   │    │
│  │  │  │  - Positions  │  │  - ERC-8004  │             │   │    │
│  │  │  └──────┬───────┘  └──────┬───────┘             │   │    │
│  │  └─────────┼─────────────────┼──────────────────────┘   │    │
│  └────────────┼─────────────────┼──────────────────────────┘    │
│               │                 │                                │
├───────────────┼─────────────────┼────────────────────────────────┤
│               ▼                 ▼                                │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │    SOLANA        │  │    MANTLE        │                     │
│  │  - Byreal DEX    │  │  - DecisionLog   │                     │
│  │  - CLMM Pools    │  │  - VigilRegistry │                     │
│  │  - Swaps         │  │  - ERC-8004      │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User sends message** via Telegram or web chat
2. **LLM Engine** processes intent — is this a risk assessment, strategy request, portfolio query, or general conversation?
3. **Risk Assessor** (if needed) walks user through 4 questions to determine Safe/Balanced/Aggressive profile
4. **Strategy Selector** maps risk profile to concrete actions (which pools, allocation percentages, stop-loss levels)
5. **Executor** runs the selected strategy via Byreal CLI (Solana) and logs the decision on Mantle
6. **Response** is summarized by the LLM and returned to the user in natural language

---

## Smart Contracts

### DecisionLog (`contracts/DecisionLog.sol`)

Records every agent decision on-chain for transparency and auditability.

- **Mantle Sepolia:** [`0xd38489433B393F80281f5F59Abd9B82CCacE6194`](https://sepolia.mantlescan.xyz/address/0xd38489433B393F80281f5F59Abd9B82CCacE6194)
- **Functions:**
  - `registerAgent(bytes32 agentId, string name)` — Register an agent identity
  - `logDecision(bytes32 agentId, string action, string metadata)` — Log a decision with action + JSON metadata
  - `getAgentDecisions(bytes32 agentId)` — Query all decisions for an agent
  - `getDecisionCount()` — Total decisions across all agents

### VigilRegistry (`contracts/VigilRegistry.sol`)

Agent configuration and performance tracking.

- **Mantle Sepolia:** [`0x855dA715F3182f9A105343c91F80ba1B435BfD31`](https://sepolia.mantlescan.xyz/address/0x855dA715F3182f9A105343c91F80ba1B435BfD31)
- **Functions:**
  - `configureAgent(bytes32 agentId, string config)` — Set agent parameters
  - `recordPerformance(bytes32 agentId, uint256 pnl, uint256 timestamp)` — Record P&L snapshots
  - `getAgentConfig(bytes32 agentId)` — Read current configuration
  - `getPerformanceHistory(bytes32 agentId)` — Performance history

### ERC-8004 Agent Identity

Vigil is registered in the ERC-8004 Identity Registry on Mantle, giving it a verifiable on-chain identity with:
- **Agent ID:** `0x217a1ebbb9834c507bc3cf6bca6e98005aa44ba81572f89a922b83ed3215f122`
- **Deployer:** `0xE409b5c4177B0f3B688B20f4CcC836F08aCA6B0e`

---

## Agent Capabilities

### Tools (Function Calling)

The LLM has access to these tools, defined in `agent/src/llm.ts`:

| Tool | Description | Parameters |
|---|---|---|
| `pools_list` | List Byreal CLMM pools sorted by APR | None |
| `pool_info` | Detailed pool information | `poolAddress` |
| `check_balance` | Byreal DEX overview & top pools | None |
| `execute_swap` | Token swap via Byreal DEX | `inputMint`, `outputMint`, `amount`, `dryRun` |
| `open_position` | Open a CLMM liquidity position | `pool`, `priceLower`, `priceUpper`, `amount` |
| `list_positions` | List active CLMM positions | None |
| `close_position` | Close a CLMM position | `position` |
| `get_portfolio` | Full portfolio summary | None |

### Risk Profiles

| Tier | Label | Max Drawdown | Stop Loss | Strategy Mix |
|---|---|---|---|---|
| 0 | Safe | 5% | 5% | 80% stable LP farming, 20% idle yield |
| 1 | Balanced | 20% | 15% | 50% CLMM positions, 30% perps, 20% stable |
| 2 | Aggressive | 40% | 30% | 60% perps, 30% copy farming, 10% stable |

### Risk Assessment Questions

1. **Goal** — Preserve capital (Safe) / Balanced growth (Balanced) / Maximize returns (Aggressive)
2. **Experience** — Beginner (Safe) / Some DeFi (Balanced) / Expert (Aggressive)
3. **Drawdown reaction** — Withdraw (Safe) / Wait (Balanced) / Buy more (Aggressive)
4. **Timeline** — <1 month (Safe) / 1-6 months (Balanced) / 6+ months (Aggressive)

---

## Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Comes with Node.js |
| Byreal CLI | >=0.3.5 | `npm install -g @byreal-io/byreal-cli` |

### 1. Clone & Install

```bash
git clone <your-repo-url> vigil
cd vigil

# Install all dependencies
npm install
cd agent && npm install && cd ..
cd telegram-bot && npm install && cd ..
cd dashboard && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your keys.

### 3. Set Up Byreal Wallet

```bash
npm install -g bs58
byreal-cli wallet set --private-key "<your-solana-private-key>"
byreal-cli wallet address  # Verify
```

### 4. Start Services

**Terminal 1 — Agent API:**
```bash
npm run agent:start
```

**Terminal 2 — Telegram Bot:**
```bash
npm run bot:start
```

**Terminal 3 — Web Dashboard:**
```bash
npm run dashboard:dev
```

### 5. Open

- **Dashboard:** http://localhost:3000
- **Agent API:** http://localhost:3001
- **Telegram:** Chat with your bot

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `LLM_API_KEY` | OpenAI or Anthropic API key | Yes |
| `LLM_MODEL` | Model name (default: `gpt-4o-mini`) | No |
| `LLM_PROVIDER` | `openai` or `anthropic` | No |
| `PRIVATE_KEY` | Mantle deployer wallet private key | Yes |
| `MANTLE_TESTNET_RPC` | Mantle Sepolia RPC | Yes |
| `MANTLE_MAINNET_RPC` | Mantle mainnet RPC | For mainnet |
| `TELEGRAM_BOT_TOKEN` | From @BotFather | Yes |
| `VIGIL_AGENT_ID` | Agent keccak256 hex | Yes |
| `VIGIL_REGISTRY` | VigilRegistry contract address | Yes |
| `NEXT_PUBLIC_DECISION_LOG_ADDRESS` | DecisionLog contract address | Yes |
| `NEXT_PUBLIC_AGENT_API_URL` | Agent API URL for dashboard | Yes |
| `NEXT_PUBLIC_MANTLE_RPC` | Mantle RPC for frontend | Yes |

---

## Deployment

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
```

### Deploy to Testnet

```bash
npm run deploy:testnet
```

### Deploy to Mainnet

```bash
npm run deploy:mainnet
```

### Register ERC-8004 Identity

```bash
npx tsx scripts/register-erc8004.ts
```

---

## Usage Guide

### Telegram Commands

| Command | Description |
|---|---|
| `/start` | Welcome message + overview |
| `/balance` | Check portfolio status and balances |
| `/risk` | Start risk assessment conversation |
| `/strategies` | View active trading strategies |
| `/wallet` | Get Byreal wallet address for funding |
| `/fund` | How to fund Vigil for trading |
| `/history` | Recent on-chain decisions |
| `/pause` | Pause agent operations |
| `/resume` | Resume agent operations |
| `/help` | Show all commands |

### Web Dashboard

The dashboard at http://localhost:3000 has:

- **Landing Page** — 3D hero scene with galaxy particles, live pool ticker, terminal demo, how-it-works section
- **Dashboard** — Portfolio stats, on-chain activity feed, quick actions, contract links
- **Chat** — Full chat interface with Vigil agent, typing indicators, message history
- **Settings** — Risk profile selector (Safe/Balanced/Aggressive), deployed contracts viewer, wallet connect

### Natural Language Examples

Send these to Vigil:

- *"I want to start investing, what should I do?"*
- *"Assess my risk profile"*
- *"I'm conservative, looking for 5-8% APY"*
- *"Show me the best pools"*
- *"Deploy $100 to safe yield farming"*
- *"What's the APR on the MNT/USDC pool?"*
- *"How's my portfolio doing?"*
- *"I'm feeling aggressive, change my strategy"*
- *"Show me my recent activity"*
- *"Where do I send funds?"*

---

## API Reference

### `POST /chat`

Send a message to the agent.

```json
{
  "sessionId": "user-session-1",
  "message": "Show me the best pools"
}
```

**Response:**
```json
{
  "reply": "Here are the top Byreal pools by APR...",
  "riskProfile": { "tier": 1, "label": "Balanced", ... },
  "done": true
}
```

### `GET /status?sessionId=...`

Get session status.

**Response:**
```json
{
  "active": true,
  "riskProfile": { "tier": 1, "label": "Balanced", ... },
  "messageCount": 12
}
```

### `GET /wallet`

Get the Byreal Solana wallet address for funding.

**Response:**
```json
{
  "address": "...",
  "chain": "Solana",
  "note": "Send SOL here for Byreal DEX gas fees"
}
```

### `GET /history`

Get on-chain decision history.

**Response:**
```json
{
  "decisions": [
    { "action": "check_balance", "timestamp": 1715500000, "metadata": "..." }
  ]
}
```

### `GET /api/pools`

Live Byreal pool data (used by the dashboard ticker).

**Response:**
```json
{
  "pools": [
    { "pair": "MNT/USDC", "apr": 13.26, "tvl_usd": 1148259.02, ... }
  ]
}
```

### `POST /configure`

Set risk profile programmatically.

```json
{
  "sessionId": "user-session-1",
  "riskTier": 0
}
```

---

## Awards Strategy

### 20 Project Deployment Award ($600)

**First 20 projects to ship win.** Focus:

1. ✅ **Verified contract on Mantle mainnet** — DecisionLog + VigilRegistry
2. ✅ **Accessible frontend** — Dashboard + Telegram bot running
3. **2+ min demo video** — Walkthrough of the complete flow
4. **Open-source repo** — This README + all code

### Agentic Economy Track Prize

- Deep Byreal CLI integration (swaps, positions, pools)
- ERC-8004 agent identity with on-chain reputation
- Risk-based strategy allocation
- Telegram-first UX

### Grand Champion

- Technical excellence (Solidity, agent architecture)
- Innovation (AI-driven risk assessment + autonomous execution)
- Ecosystem contribution (Mantle + Byreal + ERC-8004)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.28 + Hardhat |
| Blockchain | Mantle Network (EVM, chain 5000/5003) |
| AI Agent | Node.js + OpenAI GPT-4o-mini |
| DeFi Execution | Byreal CLI (Solana CLMM DEX) |
| Frontend | Next.js 15 + Three.js + Framer Motion |
| Styling | Monochrome + blue design system |
| Telegram Bot | node-telegram-bot-api |
| Agent Identity | ERC-8004 Standard |
| Language | TypeScript throughout |

---

## Project Structure

```
vigil/
├── contracts/
│   ├── DecisionLog.sol           # On-chain decision logger
│   └── VigilRegistry.sol         # Agent config & performance registry
├── scripts/
│   ├── deploy.ts                 # Hardhat deployment script
│   └── register-erc8004.ts       # ERC-8004 registration
├── test/
│   └── DecisionLog.test.ts       # Contract unit tests
├── agent/
│   └── src/
│       ├── index.ts              # Express API server (port 3001)
│       ├── llm.ts                # LLM integration + tool definitions
│       ├── risk-assessor.ts      # 4-question conversational profiler
│       ├── executor.ts           # Strategy execution engine
│       ├── onchain-logger.ts     # DecisionLog contract interface
│       └── skills/
│           └── byreal-wrapper.ts # Byreal CLI wrappers (spawn-based)
├── telegram-bot/
│   └── src/
│       └── index.ts              # Telegram bot (polling)
├── dashboard/
│   └── src/
│       ├── components/
│       │   ├── HeroScene.tsx     # 3D Three.js galaxy scene
│       │   ├── Logo.tsx          # Shield/eye SVG logo
│       │   └── GrainOverlay.tsx  # Film grain texture
│       └── app/
│           ├── page.tsx          # Landing page
│           ├── layout.tsx        # Root layout (fonts)
│           ├── globals.css       # Tailwind + design system
│           ├── (app)/
│           │   ├── layout.tsx    # App sidebar layout
│           │   ├── dashboard/
│           │   │   └── page.tsx  # Portfolio dashboard
│           │   ├── chat/
│           │   │   └── page.tsx  # Chat interface
│           │   └── settings/
│           │       └── page.tsx  # Settings page
├── hardhat.config.ts             # Hardhat config
├── package.json                  # Root scripts
├── .env                          # Environment variables
├── start.ps1                     # Convenience launcher
└── README.md                     # This file
```

---

## FAQ

**Q: Do I need funds on both Mantle and Solana?**

A: Trading happens on **Solana** (via Byreal DEX). Send SOL + tokens to the wallet address from `/wallet`. Mantle MNT is only needed for the deployer wallet to pay for on-chain logging gas — end users don't need MNT.

**Q: How much SOL do I need?**

A: $1-2 worth of SOL covers gas fees for hundreds of transactions. Trading capital depends on your strategy (start with $10-100).

**Q: Can Vigil lose my money?**

A: Yes — all DeFi strategies carry risk including impermanent loss, smart contract risk, and market volatility. Vigil uses stop-losses based on your risk profile but cannot guarantee profits. Start small.

**Q: What chains does Vigil support?**

A: Smart contracts on **Mantle** (EVM), DeFi execution on **Solana** (via Byreal DEX).

**Q: Can I pause Vigil?**

A: Yes — use `/pause` in Telegram. Vigil will stop executing new strategies but maintain existing positions.

**Q: Is this audited?**

A: No. Vigil was built for a hackathon. Use at your own risk with funds you can afford to lose.

---

## License

MIT — Built for **The Turing Test Hackathon 2026**.

*Not financial advice. Use at your own risk.*

