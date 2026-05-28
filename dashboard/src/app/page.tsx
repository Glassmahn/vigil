"use client";

import { useRef, useEffect, useState, lazy, Suspense, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ErrorBoundary from "@/components/ErrorBoundary";
import { apiFetch } from "@/lib/api";

const Scene3D = lazy(() => import("@/components/HeroScene"));

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay * 1000); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return [ref, visible] as const;
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, visible] = useReveal(delay);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1)",
      }}
    >{children}</div>
  );
}

function Grain() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 opacity-[0.02]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
      }}
    />
  );
}

function TerminalDemo() {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const demoLines = [
    { delay: 500, text: "> connecting to vigil agent..." },
    { delay: 1500, text: "> risk profile: balanced" },
    { delay: 2500, text: "> scanning byreal pools..." },
    { delay: 3500, text: "> MNT/USDC · apr 13.26% · tvl $1.14m" },
    { delay: 4500, text: "> deploying $500 to MNT/USDC CLMM position" },
    { delay: 5500, text: "> position opened · tx confirmed on solana" },
    { delay: 6500, text: "> decision logged on mantle · erc-8004" },
    { delay: 7500, text: "> ready for next command" },
  ];

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    demoLines.forEach((l) => {
      const t = setTimeout(() => setLines((p) => [...p, l.text]), l.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setHistory((p) => [...p, input]);
    setLines((p) => [...p, `$ ${input}`, "> processing... (simulated)"]);
    setInput("");
  }, [input]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="terminal-box">
      <div className="terminal-head">
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", opacity: 0.6 }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", opacity: 0.7 }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.9 }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginLeft: 12, letterSpacing: "0.05em" }}>vigil@agent ~ $</span>
      </div>
      <div className="terminal-body">
        {lines.map((l, i) => (
          <div key={i} className="terminal-line" style={{ animationDelay: `${i * 0.02}s` }}>{l}</div>
        ))}
        <div ref={endRef} />
        {history.length > 0 && (
          <form onSubmit={handleSubmit} className="terminal-input-row">
            <span className="terminal-prompt" style={{ color: "rgba(255,255,255,0.25)" }}>$</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="terminal-input"
              placeholder="try: deploy $100 to USDC pool"
              autoFocus
            />
          </form>
        )}
      </div>
    </div>
  );
}

function PoolTicker() {
  const fallbackPools = [
    { pair: "MNT/USDC", apr: "13.26%", tvl: "$1.14m" },
    { pair: "ETH/USDC", apr: "8.42%", tvl: "$2.31m" },
    { pair: "SOL/USDC", apr: "11.73%", tvl: "$890k" },
    { pair: "MNT/ETH", apr: "6.18%", tvl: "$520k" },
    { pair: "USDC/USDT", apr: "4.05%", tvl: "$4.12m" },
    { pair: "WBTC/USDC", apr: "7.89%", tvl: "$1.87m" },
  ];
  const [pools, setPools] = useState<{ pair: string; apr: string; tvl: string }[]>(fallbackPools);
  useEffect(() => {
    apiFetch("/api/pools")
      .then((r) => r.json())
      .then((d) => {
        const top = (d.pools || []).slice(0, 6).map((p: any) => ({
          pair: p.pair || "?",
          apr: p.apr ? `${Number(p.apr).toFixed(2)}%` : "-",
          tvl: p.tvl ? (typeof p.tvl === "number" ? `$${(p.tvl / 1000).toFixed(0)}k` : `$${p.tvl}`) : "-",
        }));
        setPools(top);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {[...pools, ...pools].map((p, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-pair">{p.pair}</span>
            <span className="ticker-stat">{p.apr}</span>
            <span className="ticker-stat-dim">{p.tvl}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentOk, setAgentOk] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch("/api/pools")
      .then((r) => r.json()).then((d) => setAgentOk(!!d.pools)).catch(() => setAgentOk(false));
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, { once: true });
    return () => window.removeEventListener("scroll", close);
  }, [menuOpen]);

  return (
    <>
      <Grain />
      <PoolTicker />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #080808;
          --surface: #111;
          --border: rgba(255,255,255,0.06);
          --border-l: rgba(255,255,255,0.10);
          --text: #e8e8e8;
          --text-dim: rgba(232,232,232,0.45);
          --text-dimmer: rgba(232,232,232,0.22);
          --accent: #3b82f6;
          --accent-soft: rgba(59,130,246,0.1);
        }

        html { scroll-behavior: smooth; }
        body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        ::selection { background: rgba(255,255,255,0.12); }

        /* ── POOL TICKER ── */
        .ticker-wrap {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          height: 26px; overflow: hidden;
          background: rgba(8,8,8,0.7); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .ticker-inner {
          display: flex; gap: 40px; white-space: nowrap;
          animation: tickerScroll 40s linear infinite;
          padding: 4px 0;
        }
        .ticker-item { display: inline-flex; gap: 8px; font-size: 11px; align-items: center; }
        .ticker-pair { color: var(--text-dim); font-weight: 400; }
        .ticker-stat { color: var(--accent); font-weight: 500; font-variant-numeric: tabular-nums; }
        .ticker-stat-dim { color: var(--text-dimmer); }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* ── NAV ── */
        nav {
          position: fixed; top: 26px; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 48px;
          transition: all 0.5s;
          background: transparent;
          border-bottom: 1px solid transparent;
        }
        nav.scrolled {
          background: rgba(8,8,8,0.82);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 1px 20px rgba(0,0,0,0.4);
        }

        .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: var(--text); text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase; }
        .nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
        .nav-links a { font-size: 12.5px; color: var(--text-dim); text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; transition: color 0.3s; position: relative; }
        .nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px; background: var(--accent); transition: width 0.3s; }
        .nav-links a:hover { color: var(--text); }
        .nav-links a:hover::after { width: 100%; }

        .nav-cta { font-size: 12px; font-weight: 500; color: var(--bg); background: var(--text); padding: 8px 22px; border-radius: 100px; text-decoration: none; letter-spacing: 0.02em; transition: all 0.3s; }
        .nav-cta:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 0 20px rgba(59,130,246,0.08); }

        /* ── MOBILE MENU ── */
        .nav-hamburger { display: none; flex-direction: column; gap: 4px; cursor: pointer; padding: 6px; background: none; border: none; }
        .nav-hamburger span { display: block; width: 18px; height: 1.5px; background: var(--text-dim); transition: all 0.3s; border-radius: 1px; }
        .nav-hamburger.open span:nth-child(1) { transform: translateY(5.5px) rotate(45deg); }
        .nav-hamburger.open span:nth-child(2) { opacity: 0; }
        .nav-hamburger.open span:nth-child(3) { transform: translateY(-5.5px) rotate(-45deg); }
        .nav-mobile {
          display: none; position: fixed; top: 52px; left: 0; right: 0; z-index: 99;
          background: rgba(8,8,8,0.95); backdrop-filter: blur(24px);
          border-bottom: 1px solid var(--border);
          padding: 16px 24px;
          flex-direction: column; gap: 12px;
        }
        .nav-mobile.open { display: flex; }
        .nav-mobile a { font-size: 13px; color: var(--text-dim); text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; padding: 8px 0; transition: color 0.3s; }
        .nav-mobile a:hover { color: var(--text); }
        .nav-mobile .nav-cta-m { display: inline-block; font-size: 12px; font-weight: 500; color: var(--bg); background: var(--text); padding: 10px 22px; border-radius: 100px; text-decoration: none; letter-spacing: 0.02em; text-align: center; margin-top: 4px; }
        .nav-mobile .nav-cta-m:hover { opacity: 0.88; }

        /* ── HERO ── */
        .hero { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 140px 24px 60px; overflow: hidden; }

        .hero-status { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); border: 1px solid rgba(59,130,246,0.15); padding: 6px 16px 6px 12px; border-radius: 100px; margin-bottom: 32px; background: rgba(59,130,246,0.04); animation: fadeSlide 0.8s ease both; }
        .status-online { color: var(--accent); }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #666; position: relative; }
        .status-dot.live { background: #22c55e; }
        .status-dot.live::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 1px solid rgba(34,197,94,0.3); animation: ping 2s ease-in-out infinite; }
        .status-dot.dead { background: #ef4444; opacity: 0.4; }

        .hero h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(44px, 7vw, 92px); font-weight: 400; line-height: 1.0; letter-spacing: -0.02em; color: #e0e0e0; max-width: 780px; animation: fadeSlide 0.8s ease 0.1s both; }
        .hero h1 em { font-style: italic; background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(59,130,246,0.6)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .h1-sub { background: linear-gradient(135deg, #e0e0e0, rgba(59,130,246,0.5)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .hero p { margin-top: 22px; font-size: 14px; color: var(--text-dim); max-width: 420px; letter-spacing: 0.02em; line-height: 1.7; animation: fadeSlide 0.8s ease 0.2s both; }

        .hero-actions { margin-top: 36px; display: flex; align-items: center; gap: 12px; animation: fadeSlide 0.8s ease 0.3s both; }

        .btn { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 11px 26px; border-radius: 100px; text-decoration: none; letter-spacing: 0.01em; transition: all 0.3s; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
        .btn-primary { color: var(--bg); background: var(--text); }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(59,130,246,0.15); }
        .btn-ghost { color: var(--text-dim); border: 1px solid var(--border-l); background: transparent; }
        .btn-ghost:hover { color: var(--text); border-color: rgba(59,130,246,0.2); transform: translateY(-2px); }

        .hero-meta { margin-top: 48px; display: flex; align-items: center; gap: 32px; flex-wrap: wrap; justify-content: center; animation: fadeSlide 0.8s ease 0.5s both; }
        .hero-meta-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dimmer); letter-spacing: 0.02em; }
        .hero-meta-item .meta-icon { color: var(--accent); opacity: 0.6; }
        .hero-meta-item .meta-accent { color: var(--accent); opacity: 1; }

        .scroll-hint { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-dimmer); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; animation: fadeSlide 1s ease 0.8s both; }
        .scroll-line { width: 1px; height: 32px; background: linear-gradient(to bottom, rgba(59,130,246,0.3), transparent); animation: scrollPulse 2.5s ease-in-out infinite; }

        /* ── SECTION COMMON ── */
        section { position: relative; z-index: 1; padding: 100px 24px; }
        .sec-divider { width: 40%; height: 1px; margin: 0 auto; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.08), transparent); }

        .sec-label { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 16px; }
        .sec-title { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(30px, 3.6vw, 46px); font-weight: 400; color: #e0e0e0; letter-spacing: -0.01em; line-height: 1.15; }
        .sec-sub { font-size: 14px; color: var(--text-dim); max-width: 440px; line-height: 1.7; margin-top: 10px; }

        /* ── METRICS ── */
        .metrics { display: flex; align-items: center; justify-content: center; gap: 48px; padding: 0 24px 80px; flex-wrap: wrap; position: relative; z-index: 1; }
        .metric { text-align: center; }
        .metric-val { font-family: 'Instrument Serif', Georgia, serif; font-size: 30px; font-weight: 400; color: var(--text); letter-spacing: -0.01em; }
        .metric-val.accent { color: var(--accent); }
        .metric-lbl { font-size: 11px; color: var(--text-dimmer); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 4px; }
        .metric-div { width: 1px; height: 36px; background: var(--border-l); }

        /* ── FEATURES ── */
        .f-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; max-width: 920px; margin: 0 auto; }
        .f-card { padding: 36px 28px; border-radius: 14px; border: 1px solid var(--border); background: linear-gradient(160deg, rgba(255,255,255,0.02), transparent); transition: all 0.4s; position: relative; overflow: hidden; }
        .f-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.08), transparent); opacity: 0; transition: opacity 0.5s; }
        .f-card:hover::before { opacity: 1; }
        .f-card:hover { border-color: rgba(59,130,246,0.12); background: linear-gradient(160deg, rgba(59,130,246,0.03), transparent); transform: translateY(-3px); box-shadow: 0 16px 50px rgba(0,0,0,0.3); }
        .f-card-num { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; color: rgba(59,130,246,0.2); margin-bottom: 12px; line-height: 1; }
        .f-card h3 { font-size: 16px; font-weight: 500; color: var(--text); margin-bottom: 8px; letter-spacing: -0.01em; }
        .f-card p { font-size: 13px; color: var(--text-dim); line-height: 1.7; }

        /* ── STEPS ── */
        .steps { max-width: 680px; margin: 0 auto; }
        .step { display: flex; gap: 24px; padding: 28px 0; border-bottom: 1px solid var(--border); }
        .step:last-child { border-bottom: none; }
        .step-n { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; font-weight: 400; color: rgba(59,130,246,0.15); line-height: 1; min-width: 44px; }
        .step-b { margin-top: 4px; }
        .step-b h3 { font-size: 16px; font-weight: 500; color: var(--text); margin-bottom: 4px; }
        .step-b p { font-size: 13px; color: var(--text-dim); line-height: 1.6; }

        /* ── TERMINAL DEMO ── */
        .terminal-wrap { max-width: 720px; margin: 0 auto; }
        .terminal-box {
          border-radius: 12px; overflow: hidden;
          border: 1px solid var(--border);
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
        }
        .terminal-head {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid var(--border);
        }
        .terminal-body { padding: 16px 20px; min-height: 200px; max-height: 320px; overflow-y: auto; }
        .terminal-line {
          font-family: 'DM Mono', 'SF Mono', 'Fira Code', monospace;
          font-size: 12.5px; line-height: 1.8;
          color: rgba(232,232,232,0.6);
          animation: terminalFade 0.3s ease both;
        }
        .terminal-line:nth-child(1) { color: rgba(232,232,232,0.35); }
        .terminal-line:nth-child(2) { color: #22c55e; }
        .terminal-line:nth-child(3) { color: #3b82f6; }
        .terminal-line:nth-child(4) { color: rgba(232,232,232,0.5); }
        .terminal-line:nth-child(5) { color: #f59e0b; }
        .terminal-line:nth-child(6) { color: #22c55e; }
        .terminal-line:nth-child(7) { color: #3b82f6; }
        .terminal-line:nth-child(8) { color: #22c55e; }
        .terminal-input-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .terminal-prompt { font-family: monospace; font-size: 13px; }
        .terminal-input {
          flex: 1; background: none; border: none; outline: none;
          font-family: 'DM Mono', 'SF Mono', 'Fira Code', monospace;
          font-size: 12.5px; color: var(--text); caret-color: var(--accent);
        }
        .terminal-input::placeholder { color: rgba(232,232,232,0.15); }
        @keyframes terminalFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* ── CTA ── */
        .cta-wrap { text-align: center; padding: 100px 24px; position: relative; }
        .cta-wrap::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 50%; height: 1px; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.12), transparent); }
        .cta-actions { margin-top: 32px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }

        /* ── CUSTOM SCROLLBAR ── */
        .terminal-body::-webkit-scrollbar { width: 4px; }
        .terminal-body::-webkit-scrollbar-track { background: transparent; }
        .terminal-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

        /* ── FOOTER ── */
        footer { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 28px 48px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-dimmer); }
        footer a { color: var(--text-dim); text-decoration: none; transition: color 0.3s; }
        footer a:hover { color: var(--accent); }
        .f-links { display: flex; gap: 20px; }

        @keyframes fadeSlide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scrollPulse { 0%, 100% { opacity: 0.3; transform: scaleY(1); } 50% { opacity: 0.8; transform: scaleY(1.3); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0; transform: scale(1.8); } }

        @media (max-width: 600px) {
          nav { padding: 12px 20px; top: 26px; }
          .nav-links { display: none; }
          .nav-cta { display: none; }
          .nav-hamburger { display: flex !important; }
          .hero { padding: 120px 20px 40px; }
          .hero-meta { flex-direction: column; gap: 12px; }
          .hero-meta-item { font-size: 11px; }
          section { padding: 60px 20px; }
          .metrics { gap: 24px; padding-bottom: 40px; }
          .metric-div { display: none; }
          footer { flex-direction: column; gap: 10px; text-align: center; padding: 20px; }
          .f-links { gap: 14px; }
          .terminal-body { max-height: 220px; }
          .nav-mobile:not(.open) { display: none; }
        }
        @media (min-width: 601px) {
          .nav-hamburger { display: none !important; }
          .nav-mobile { display: none !important; }
        }
      `}</style>

      <nav className={scrolled ? "scrolled" : ""}>
        <a href="/" className="nav-logo">
          <Logo size={14} />
          Vigil
        </a>
        <ul className="nav-links">
          <li><a href="#capabilities">Capabilities</a></li>
          <li><a href="#terminal-demo">Terminal</a></li>
          <li><a href="#workflow">How It Works</a></li>
          <li><a href="https://medium.com/@glassman4664/vigil-0389e3c3cc14" target="_blank">Docs</a></li>
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard" className="nav-cta">Command Center</a>
          <button className={`nav-hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </nav>
      <div className={`nav-mobile ${menuOpen ? "open" : ""}`}>
        <a href="#capabilities" onClick={() => setMenuOpen(false)}>Capabilities</a>
        <a href="#terminal-demo" onClick={() => setMenuOpen(false)}>Terminal</a>
        <a href="#workflow" onClick={() => setMenuOpen(false)}>How It Works</a>
        <a href="https://medium.com/@glassman4664/vigil-0389e3c3cc14" target="_blank" onClick={() => setMenuOpen(false)}>Docs</a>
        <a href="/dashboard" className="nav-cta-m" onClick={() => setMenuOpen(false)}>Command Center</a>
      </div>

      {/* ── HERO ── */}
      <section className="hero">
        <ErrorBoundary><Suspense fallback={null}><Scene3D /></Suspense></ErrorBoundary>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.04) 0%, transparent 60%)' }} />

        <div className="hero-status">
          <span className={`status-dot ${agentOk === null ? "" : agentOk ? "live" : "dead"}`} />
          Agent Status: <span className="status-online">{agentOk === null ? "Checking..." : agentOk ? "Online" : "Offline"}</span>
        </div>

        <h1>Your <em>autonomous</em><br /><span className="h1-sub">trading agent</span> is live</h1>
        <p>Vigil monitors markets, assesses your risk profile, and executes DeFi strategies across Mantle and Solana — all through natural conversation.</p>

        <div className="hero-actions">
          <Link href="/dashboard" className="btn btn-primary">
            Open Command Center
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link href="/chat" className="btn btn-ghost">Talk to Your Agent</Link>
        </div>

        <div className="hero-meta">
          <span className="hero-meta-item">
            <svg className="meta-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 3V6L8 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
            Mantle Mainnet <span className="meta-accent">— Live</span>
          </span>
          <span className="hero-meta-item">
            <svg className="meta-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6H11M6 1L11 6L6 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ERC-8004 Identity <span className="meta-accent">— Active</span>
          </span>
          <span className="hero-meta-item">
            <svg className="meta-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Byreal CLMM <span className="meta-accent">— {agentOk === null ? "Connecting..." : agentOk ? "Connected" : "Offline"}</span>
          </span>
        </div>

        <div className="scroll-hint">
          <span>Explore</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* ── SECTION DIVIDER ── */}
      <div className="sec-divider" />

      {/* ── METRICS ── */}
      <FadeIn>
        <div className="metrics">
          <div className="metric"><div className="metric-val">2/2</div><div className="metric-lbl">Contracts Verified</div></div>
          <div className="metric-div" />
          <div className="metric"><div className="metric-val">3</div><div className="metric-lbl">Risk Profiles</div></div>
          <div className="metric-div" />
          <div className="metric"><div className="metric-val">24/7</div><div className="metric-lbl">Autonomous Ops</div></div>
          <div className="metric-div" />
          <div className="metric"><div className="metric-val accent">ERC-8004</div><div className="metric-lbl">On-Chain Logged</div></div>
        </div>
      </FadeIn>

      {/* ── CAPABILITIES ── */}
      <section id="capabilities">
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 50 }}>
              <div className="sec-label"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2" fill="#3b82f6" opacity="0.7"/></svg>Capabilities</div>
              <h2 className="sec-title">What your agent can do</h2>
              <p className="sec-sub" style={{ margin: '10px auto 0' }}>Vigil combines AI reasoning with on-chain execution.</p>
            </div>
          </FadeIn>

          <div className="f-grid">
            {[
              { num: "01", title: "Conversational Risk Assessment", desc: "Talk to Vigil like a human. Describe your goals, timeline, and comfort with volatility. The AI builds your risk profile — Safe, Balanced, or Aggressive — in real time." },
              { num: "02", title: "Autonomous Strategy Execution", desc: "Once your profile is set, Vigil deploys capital across Byreal CLMM DEX. Swaps, LP positions — fully autonomous." },
              { num: "03", title: "On-Chain Decision Logging", desc: "Every trade, every strategy change, every rebalance is recorded immutably on Mantle via the ERC-8004 agent identity standard. Fully auditable." },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="f-card">
                  <div className="f-card-num">{f.num}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION DIVIDER ── */}
      <div className="sec-divider" />

      {/* ── TERMINAL DEMO ── */}
      <section id="terminal-demo">
        <div className="terminal-wrap">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div className="sec-label" style={{ justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2" fill="#3b82f6" opacity="0.7"/></svg>
                Live Terminal
              </div>
              <h2 className="sec-title">Watch it work</h2>
              <p className="sec-sub" style={{ margin: '10px auto 0' }}>
                This is what a real Vigil session looks like — from connection to deployment.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <TerminalDemo />
          </FadeIn>
        </div>
      </section>

      {/* ── WORKFLOW ── */}
      <section id="workflow" style={{ paddingTop: 40 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ marginBottom: 32 }}>
              <div className="sec-label"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2" fill="#3b82f6" opacity="0.7"/></svg>How It Works</div>
              <h2 className="sec-title">From conversation to execution</h2>
            </div>
          </FadeIn>

          <div className="steps">
            {[
              { n: "01", t: "Connect your wallet", d: "Link your wallet via Telegram or the web dashboard. No forms, no configuration — just connect and start talking." },
              { n: "02", t: "Describe your goals", d: "Tell Vigil what you want. 'I'm conservative, looking for 5-8% APY' or 'I'm aggressive, give me 30% targets.' The AI builds your profile." },
              { n: "03", t: "Agent executes", d: "Vigil deploys the optimal strategy — CLMM liquidity or swap — and logs every action on Mantle." },
              { n: "04", t: "Monitor and adjust", d: "Track performance on the dashboard or via Telegram. Tell Vigil to rebalance, pause, or change strategy anytime." },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="step">
                  <div className="step-n">{s.n}</div>
                  <div className="step-b"><h3>{s.t}</h3><p>{s.d}</p></div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-wrap">
        <FadeIn>
          <div className="sec-label" style={{ justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2" fill="#3b82f6" opacity="0.7"/></svg>
            Terminal
          </div>
          <h2 className="sec-title" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
            Your agent is ready.<br />Give it a command.
          </h2>
          <p className="sec-sub" style={{ margin: '12px auto 0', textAlign: 'center' }}>
            Two verified contracts on Mantle Mainnet. Start a conversation with Vigil now.
          </p>
          <div className="cta-actions">
            <Link href="/dashboard" className="btn btn-primary">
              Launch Terminal
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M13 7L7 1M13 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link href="/chat" className="btn btn-ghost">
              Open Chat
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/><path d="M5.5 4.5L9.5 7L5.5 9.5V4.5Z" fill="currentColor"/></svg>
            </Link>
          </div>
        </FadeIn>
      </section>

      <footer>
        <span>Vigil — Autonomous Trading Agent. Built for The Turing Test Hackathon 2026.</span>
        <div className="f-links">
          <a href="https://mantlescan.xyz/address/0x5E66937c3f7bc793B7a45B08b178eEA40fB7401d" target="_blank">DecisionLog</a>
          <a href="https://mantlescan.xyz/address/0x0e024b4053cE9F38489B9b26e911336a657de18e" target="_blank">VigilRegistry</a>
        </div>
      </footer>
    </>
  );
}
