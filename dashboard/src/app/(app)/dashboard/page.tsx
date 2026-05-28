"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Shield, Activity, Wallet, TrendingUp, History, ArrowUpRight, Play, Pause, MessageSquare, Copy, Check, Banknote, BarChart3, Layers, Zap, DollarSign } from "lucide-react";
import { useNotify } from "@/components/NotificationProvider";
import BgParticles from "@/components/BgParticles";
import { apiFetch, apiEventSource } from "@/lib/api";
import PnlChart from "@/components/PnlChart";
import PositionModal from "@/components/PositionModal";

const deployedContracts = [
  { action: "CONTRACT_DEPLOY", timestamp: Math.floor(Date.now() / 1000), metadata: JSON.stringify({ contract: "DecisionLog", address: process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS || "0x5E66937c3f7bc793B7a45B08b178eEA40fB7401d" }) },
  { action: "CONTRACT_DEPLOY", timestamp: Math.floor(Date.now() / 1000), metadata: JSON.stringify({ contract: "VigilRegistry", address: process.env.NEXT_PUBLIC_VIGIL_REGISTRY_ADDRESS || "0x0e024b4053cE9F38489B9b26e911336a657de18e" }) },
];

declare global {
  interface Window { ethereum?: any; }
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(2)}`;
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function DashboardPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem("vigil-onboarding-seen");
      if (!seen) {
        setShowOnboarding(true);
        localStorage.setItem("vigil-onboarding-seen", "true");
      }
    }
  }, []);
  const { notify } = useNotify();
  const [decisions, setDecisions] = useState<{ action: string; timestamp: number; metadata: string }[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => { if (typeof window === "undefined") return "web-dash-ssr"; const saved = localStorage.getItem("vigil-session-id"); if (saved) return saved; const id = `web-${Date.now()}`; localStorage.setItem("vigil-session-id", id); return id; });
  const [riskLabel, setRiskLabel] = useState<string | null>(null);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [activePositions, setActivePositions] = useState(0);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [solanaWallet, setSolanaWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pnl, setPnl] = useState<number | null>(null);
  const [selectedPos, setSelectedPos] = useState<any>(null);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((a: string[]) => {
        if (a.length > 0) setUserAddress(a[0]);
      });
    }
  }, []);

  useEffect(() => {
    if (!userAddress) { setSolanaWallet(null); return; }
    apiFetch(`/wallet?userAddress=${userAddress}`)
      .then((r) => r.json())
      .then((d) => { if (d.address && d.address !== "Unknown") setSolanaWallet(d.address); })
      .catch(() => {});
  }, [userAddress]);

  const copyWallet = () => {
    if (solanaWallet) { navigator.clipboard.writeText(solanaWallet); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  useEffect(() => {
    setLoading(true);
    apiFetch("/history")
      .then((r) => r.json())
      .then((d) => setDecisions([...deployedContracts, ...(d.decisions || [])]))
      .catch(() => setDecisions(deployedContracts))
      .finally(() => setLoading(false));
      apiFetch("/status/global")
      .then((r) => r.json())
      .then((d) => { if (d.registry) setPnl(d.registry.totalPnl); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const evtSource = apiEventSource("/events");
    evtSource.addEventListener("trade", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        notify(`Trade executed: ${data.action}`, "success");
        setPnl((prev) => prev !== null ? prev + (data.pnl || 0) : (data.pnl || 0));
      } catch {}
    });
    return () => evtSource.close();
  }, [notify]);

  useEffect(() => {
    const check = () => {
      apiFetch(`/status?sessionId=${sessionId}${userAddress ? `&userAddress=${encodeURIComponent(userAddress)}` : ""}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.active) {
            setPaused(d.paused || false);
            if (d.riskProfile) setRiskLabel(d.riskProfile.label);
            if (d.portfolioValue !== undefined) setPortfolioValue(d.portfolioValue);
            if (d.activePositions !== undefined) setActivePositions(d.activePositions);
          }
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [sessionId, userAddress]);

  useEffect(() => {
    if (!userAddress) { setPositions([]); return; }
    const fetchPositions = () => {
      apiFetch(`/portfolio?userAddress=${encodeURIComponent(userAddress)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.positions) setPositions(d.positions);
          if (d.portfolioValue) setPortfolioValue(d.portfolioValue);
          if (d.activePositions !== undefined) setActivePositions(d.activePositions);
        })
        .catch(() => {});
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 15000);
    return () => clearInterval(interval);
  }, [userAddress]);

  const togglePause = async () => {
    const endpoint = paused ? "resume" : "pause";
    try {
      const res = await apiFetch(`/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const d = await res.json();
      const newPaused = d.paused ?? !paused;
      setPaused(newPaused);
      notify(newPaused ? "Vigil paused" : "Vigil resumed", "info");
    } catch {
      setPaused(!paused);
      notify("Toggle failed — agent offline", "error");
    }
  };

  const closePosition = useCallback(async (positionAddr: string) => {
    setClosingId(positionAddr);
    try {
      const res = await apiFetch("/portfolio/close", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress, position: positionAddr }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Position closed successfully", "success");
        setPositions((p) => p.filter((pos: any) => pos.address !== positionAddr && pos.nftMint !== positionAddr));
      } else {
        notify("Failed to close position: " + (data.details || data.error), "error");
      }
    } catch {
      notify("Failed to close position — agent offline", "error");
    }
    setClosingId(null);
  }, [userAddress, notify]);

  const riskColor = "#3b82f6";
  const pnlColor = pnl !== null ? "#10b981" : "rgba(232,232,232,0.2)";

  const stats = [
    {
      label: "Risk Profile", value: riskLabel || "Not set",
      sub: riskLabel ? "Configured" : "Complete assessment",
      svg: <Shield style={{ width: 18, height: 18 }} />,
      accent: "#3b82f6",
      gradient: riskLabel ? "rgba(59,130,246,0.06)" : "transparent",
    },
    {
      label: "Portfolio Value", value: portfolioValue > 0 ? formatUsd(portfolioValue) : "$0.00",
      sub: portfolioValue > 0 ? "Across all positions" : (userAddress ? "No funds deployed" : "Connect wallet to see"),
      svg: <Wallet style={{ width: 18, height: 18 }} />,
      accent: "#10b981",
      gradient: "rgba(16,185,129,0.06)",
    },
    {
      label: "Active Strategies", value: String(activePositions),
      sub: activePositions > 0 ? "Running on Byreal" : "No strategies running",
      svg: <BarChart3 style={{ width: 18, height: 18 }} />,
      accent: "#f59e0b",
      gradient: "rgba(245,158,11,0.06)",
    },
    {
      label: "P&L", value: pnl !== null ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : "—",
      sub: pnl !== null ? "Total profit / loss" : "No trades yet",
      svg: <TrendingUp style={{ width: 18, height: 18 }} />,
      accent: pnlColor,
      gradient: pnl !== null ? "rgba(16,185,129,0.06)" : "transparent",
    },
    {
      label: "Decisions", value: String(decisions.length),
      sub: "On-chain records",
      svg: <History style={{ width: 18, height: 18 }} />,
      accent: "#3b82f6",
      gradient: "rgba(59,130,246,0.06)",
    },
  ];

  return (
    <>
      <BgParticles />
      {selectedPos && (
        <PositionModal
          position={selectedPos}
          onClose={() => setSelectedPos(null)}
          onClosePosition={closePosition}
          explorerBase="https://mantlescan.xyz"
        />
      )}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: 420, width: "90%", padding: "32px 28px", borderRadius: 16, border: "1px solid rgba(59,130,246,0.12)", background: "#0a0a0a", textAlign: "center" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <BarChart3 style={{ width: 20, height: 20, color: "#3b82f6" }} />
              </div>
              <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#e0e0e0", margin: "0 0 8px" }}>Welcome to Vigil</h2>
              <p style={{ fontSize: 12, color: "rgba(232,232,232,0.35)", lineHeight: 1.6, marginBottom: 24 }}>
                Your autonomous trading agent runs on Mantle + Solana. Connect your wallet, set your risk profile, and let AI manage your DeFi positions.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {[
                  { step: "1", text: "Connect your Mantle wallet (top-left)" },
                  { step: "2", text: "Set your risk tier in Settings" },
                  { step: "3", text: "Chat with Vigil to deploy strategies" },
                ].map((s) => (
                  <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(59,130,246,0.03)", border: "1px solid rgba(59,130,246,0.06)" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.step}
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(232,232,232,0.4)" }}>{s.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowOnboarding(false)}
                style={{ padding: "10px 28px", borderRadius: 100, border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                Get Started
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.21, 0.47, 0.32, 0.98] } }) }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 style={{ width: 18, height: 18, color: "#3b82f6" }} />
              </div>
              <div>
                <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 400, color: "#e0e0e0", margin: 0 }}>Dashboard</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: paused ? "rgba(59,130,246,0.3)" : "#3b82f6", animation: paused ? "none" : "breathe 2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, color: "rgba(232,232,232,0.35)" }}>{paused ? "Paused" : "Live"} · {activePositions} active position{activePositions !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={togglePause}
              style={{
                padding: "8px 16px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: paused ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(255,255,255,0.1)",
                background: paused ? "rgba(59,130,246,0.06)" : "transparent",
                color: paused ? "#3b82f6" : "rgba(232,232,232,0.4)",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {paused ? <Play style={{ width: 12, height: 12 }} /> : <Pause style={{ width: 12, height: 12 }} />}
              {paused ? "Resume" : "Pause"}
            </motion.button>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: [0.21, 0.47, 0.32, 0.98] } }) }} custom={i}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              style={{
                padding: "20px 18px", borderRadius: 12,
                border: `1px solid ${s.accent}22`,
                background: `linear-gradient(160deg, ${s.gradient}, transparent)`,
                position: "relative", overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, borderRadius: "50%", background: s.accent, opacity: 0.03, transform: "translate(20px, -30px)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${s.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", color: s.accent }}>{s.svg}</div>
                <span style={{ fontSize: 10, color: "rgba(232,232,232,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#f0f0f0", letterSpacing: "-0.01em", fontFamily: "'DM Sans', sans-serif" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "rgba(232,232,232,0.25)", marginTop: 2 }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 3) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] } }) }} custom={3}
          style={{
            padding: "20px 24px", borderRadius: 12, marginBottom: 16,
            border: "1px solid rgba(59,130,246,0.08)",
            background: "linear-gradient(160deg, rgba(59,130,246,0.02), transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", background: "rgba(59,130,246,0.06)" }}>
              <TrendingUp style={{ width: 13, height: 13 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#d0d0d0" }}>Portfolio Performance</span>
            {pnl !== null && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </span>
            )}
          </div>
          <PnlChart userAddress={userAddress} />
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 4) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] } }) }} custom={4}
            style={{
              padding: "24px", borderRadius: 12,
              border: "1px solid rgba(59,130,246,0.08)",
              background: "linear-gradient(160deg, rgba(59,130,246,0.03), transparent)",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Activity style={{ width: 14, height: 14, color: "#3b82f6" }} />
                </div>
                <h2 style={{ fontSize: 14, fontWeight: 500, color: "#e0e0e0", margin: 0 }}>On-Chain Activity</h2>
              </div>
              <span style={{ fontSize: 10, color: "rgba(232,232,232,0.2)", background: "rgba(255,255,255,0.03)", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.05)", fontVariantNumeric: "tabular-nums" }}>
                {decisions.length} record{decisions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 44, borderRadius: 8, background: "rgba(255,255,255,0.03)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                ))}
              </div>
            ) : decisions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "rgba(232,232,232,0.15)" }}>
                  <History style={{ width: 20, height: 20 }} />
                </div>
                <p style={{ fontSize: 13, color: "rgba(232,232,232,0.3)" }}>No decisions yet. Start chatting with Vigil.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <AnimatePresence>
                  {decisions.slice().reverse().slice(0, 12).map((d, i) => {
                    const iconColor = d.action.includes("SWAP") ? "#f59e0b" : d.action.includes("STAKE") ? "#10b981" : d.action.includes("DEPLOY") ? "#3b82f6" : d.action.includes("CLOSE") ? "#ef4444" : "#3b82f6";
                    return (
                      <motion.div key={d.timestamp + d.action + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: `${iconColor}11`, color: iconColor }}>
                            <Shield style={{ width: 11, height: 11 }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#d0d0d0" }}>{d.action.replace(/_/g, " ")}</div>
                            <div style={{ fontSize: 9, color: "rgba(232,232,232,0.15)" }}>
                              {(() => { try { return JSON.parse(d.metadata).address ? truncateAddr(JSON.parse(d.metadata).address) : new Date(d.timestamp * 1000).toLocaleTimeString(); } catch { return new Date(d.timestamp * 1000).toLocaleTimeString(); } })()}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 9, color: "rgba(232,232,232,0.15)", fontVariantNumeric: "tabular-nums" }}>{new Date(d.timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 5) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.35, ease: [0.21, 0.47, 0.32, 0.98] } }) }} custom={5}
            style={{
              padding: "24px", borderRadius: 12,
              border: "1px solid rgba(59,130,246,0.08)",
              background: "linear-gradient(160deg, rgba(59,130,246,0.03), transparent)",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers style={{ width: 14, height: 14, color: "#3b82f6" }} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "#e0e0e0", margin: 0 }}>Open Positions</h2>
              {activePositions > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#3b82f6", background: "rgba(59,130,246,0.08)", padding: "2px 10px", borderRadius: 100, border: "1px solid rgba(59,130,246,0.12)" }}>
                  {activePositions} active
                </span>
              )}
            </div>

            {!userAddress ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Wallet style={{ width: 20, height: 20, color: "rgba(232,232,232,0.12)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "rgba(232,232,232,0.2)" }}>Connect wallet to see positions</p>
              </div>
            ) : positions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "rgba(59,130,246,0.2)" }}>
                  <Layers style={{ width: 16, height: 16 }} />
                </div>
                <p style={{ fontSize: 12, color: "rgba(232,232,232,0.25)", marginBottom: 14 }}>No open positions</p>
                <Link href="/chat" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none", padding: "6px 14px", borderRadius: 100, border: "1px solid rgba(59,130,246,0.2)", transition: "all 0.3s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Deploy Strategy →
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {positions.map((pos: any, i: number) => {
                  const posId = pos.address || pos.nftMint || `pos-${i}`;
                  const poolName = pos.pool || pos.poolName || `Position ${i + 1}`;
                  const value = pos.depositedUsd || pos.valueUsd || 0;
                  const apr = pos.apr || pos.apr24h || 0;
                  const aprBar = Math.min(apr / 50, 1) * 100;
                  return (
                    <motion.div key={posId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => { if (!closingId) setSelectedPos(pos); }}
                      style={{
                        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                        background: "rgba(59,130,246,0.03)", border: "1px solid rgba(59,130,246,0.06)",
                        position: "relative", overflow: "hidden",
                        transition: "border-color 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.15)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.06)"; }}
                    >
                      <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, background: `linear-gradient(90deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))`, width: `${aprBar}%`, animation: "barFill 1s ease-out", borderRadius: "0 1px 1px 0" }} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Zap style={{ width: 11, height: 11, color: "#3b82f6" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#d0d0d0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{poolName}</div>
                          </div>
                        </div>
                        <motion.button whileTap={{ scale: 0.9 }} disabled={closingId === posId} onClick={(e) => { e.stopPropagation(); closePosition(posId); }}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.15)", cursor: closingId === posId ? "not-allowed" : "pointer",
                            background: "rgba(239,68,68,0.04)", color: closingId === posId ? "rgba(232,232,232,0.15)" : "#ef4444", fontSize: 9, flexShrink: 0,
                          }}
                        >{closingId === posId ? "Closing..." : "Close"}</motion.button>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "rgba(232,232,232,0.3)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign style={{ width: 9, height: 9 }} /> {formatUsd(value)}</span>
                        {apr > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981" }}><TrendingUp style={{ width: 9, height: 9 }} /> {apr.toFixed(1)}% APR</span>}
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(232,232,232,0.15)" }}><Layers style={{ width: 9, height: 9 }} /> {truncateAddr(posId)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: (i = 6) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } }) }} custom={6}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { href: "/chat", icon: <MessageSquare style={{ width: 15, height: 15 }} />, title: "Chat with Vigil", desc: "Deploy & manage strategies", color: "#3b82f6" },
              { href: "/settings", icon: <Shield style={{ width: 15, height: 15 }} />, title: "Configure Risk", desc: "Safe, Balanced, or Aggressive", color: "#f59e0b" },
              ...(solanaWallet ? [{
                href: "#", icon: <Banknote style={{ width: 15, height: 15 }} />, title: "Fund Wallet", desc: "Copy Solana address", color: "#10b981",
                action: copyWallet,
              }] : []),
            ].map((a: any, i) => (
              a.action ? (
                <button key={i} onClick={a.action}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)", cursor: "pointer", textAlign: "left",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${a.color}22`; e.currentTarget.style.background = `${a.color}06`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${a.color}22`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, background: `${a.color}08` }}>{a.icon}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#d0d0d0" }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: "rgba(232,232,232,0.2)" }}>{a.desc}</div>
                    </div>
                  </div>
                  {copied ? <Check style={{ width: 12, height: 12, color: "#3b82f6" }} /> : <Copy style={{ width: 12, height: 12, color: "rgba(232,232,232,0.12)" }} />}
                </button>
              ) : (
                <Link key={i} href={a.href}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)", textDecoration: "none",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${a.color}22`; e.currentTarget.style.background = `${a.color}06`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${a.color}22`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, background: `${a.color}08` }}>{a.icon}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#d0d0d0" }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: "rgba(232,232,232,0.2)" }}>{a.desc}</div>
                    </div>
                  </div>
                  <ArrowUpRight style={{ width: 12, height: 12, color: "rgba(232,232,232,0.12)" }} />
                </Link>
              )
            ))}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
