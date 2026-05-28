# Vigil UI/UX Audit

## Landing Page
- [x] 3D galaxy scene (icosahedron, particles, orbital rings)
- [x] Pool ticker with live/fallback data
- [x] Scroll-reveal sections
- [-] "Agent Online" badge always shown — not linked to real health
- [-] "Byreal CLMM — Connected" badge always shown
- [-] Pool ticker URL hardcoded to localhost:3001
- [ ] No error boundary for Three.js (WebGL crash → white screen)
- [ ] Terminal demo is simulated, not interactive
- [ ] Docs nav link is placeholder (#workflow)
- [ ] No loading.tsx skeleton

## Dashboard
- [x] 4 stat cards, activity feed, quick actions
- [-] Stats are hardcoded defaults — no real agent state
- [-] Pause/Resume local only — no API call
- [ ] No real-time updates (polling / WebSocket)
- [ ] No charts (recharts installed, unused)
- [ ] No loading skeleton on fetch

## Chat
- [x] Animated messages, typing indicator, session, offline fallback
- [ ] **userAddress not sent to /chat** — blocks per-user wallet
- [ ] No markdown rendering (LLM sends markdown, shown as plain text)
- [ ] No persistence, no streaming, no suggested prompts

## Settings
- [x] Risk tier selector, contract viewer, ERC-8004 agent ID
- [-] /configure called with hardcoded session "web-settings"
- [ ] Selection resets on refresh
- [ ] No loading/error state on save

## App Layout
- [x] Sidebar nav, wallet connect, agent status, solana wallet
- [-] Mobile hides everything (no wallet, no contracts)
- [-] Only MetaMask supported
- [-] Contract links hardcoded to testnet
- [ ] No balance display

## Telegram Bot
- [x] 10 commands, natural language, 45s timeout, sessions
- [-] /wallet doesn't accept userAddress
- [-] /pause and /resume are text-only — no API
- [ ] No inline keyboards
- [ ] Telegram users can't connect MetaMask → no derived wallet

## Architecture
- [x] Consistent design, Tailwind 4, brand identity
- [ ] **@solana/web3.js not installed**
- [ ] **BYREAL_MASTER_SEED not set**
- [ ] Temp keypair files could race
- [ ] No 404 page, no error boundaries, no PWA
- [ ] Hardcoded localhost URLs everywhere

## Priority Order
1. Install @solana/web3.js + set BYREAL_MASTER_SEED
2. Pass userAddress from Chat to /chat
3. Update Telegram /wallet for userAddress
4. Replace fake hero badges with real health checks
5. Replace hardcoded localhost URLs with env vars
6. Add error boundaries
7. Add loading states / skeletons
8. Add markdown rendering to chat
