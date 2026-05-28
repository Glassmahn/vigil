"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Check, Copy, ExternalLink, Sparkles, Fingerprint, Zap, TrendingUp, Layers, ArrowUpRight } from "lucide-react";
import BgParticles from "@/components/BgParticles";
import { apiFetch } from "@/lib/api";

const tiers = [
  { value: 0, label: "Safe", desc: "Capital preservation with stable yield", maxDD: "5%", stopLoss: "5%", strategies: ["Stablecoin LP farming", "Idle yield", "USDC staking"], color: "#3b82f6", bg: "rgba(59,130,246,0.04)", border: "rgba(59,130,246,0.12)" },
  { value: 1, label: "Balanced", desc: "Mix of stability and growth", maxDD: "20%", stopLoss: "15%", strategies: ["CLMM positions", "30% perps", "20% stable farming"], color: "#f59e0b", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.12)" },
  { value: 2, label: "Aggressive", desc: "Higher returns with wider swings", maxDD: "40%", stopLoss: "30%", strategies: ["60% perps", "30% copy farming", "10% stable"], color: "#ef4444", bg: "rgba(239,68,68,0.04)", border: "rgba(239,68,68,0.12)" },
];

const decisionLogAddr = process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS || "0x5E66937c3f7bc793B7a45B08b178eEA40fB7401d";
const registryAddr = process.env.NEXT_PUBLIC_VIGIL_REGISTRY_ADDRESS || "0x0e024b4053cE9F38489B9b26e911336a657de18e";
const contracts = [
  { name: "DecisionLog", address: decisionLogAddr, role: "On-chain logger" },
  { name: "VigilRegistry", address: registryAddr, role: "Agent config & performance" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number] } }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };

export default function SettingsPage() {
  const [selectedTier, setSelectedTier] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem("vigil-risk-tier");
      if (saved) { const p = parseInt(saved); if (!isNaN(p) && p >= 0 && p <= 2) return p; }
    } catch {}
    return 1;
  });
  const [saved, setSaved] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sessionId] = useState(() => { if (typeof window === "undefined") return "web-settings-ssr"; const saved = localStorage.getItem("vigil-session-id"); if (saved) return saved; const id = `web-${Date.now()}`; localStorage.setItem("vigil-session-id", id); return id; });

  useEffect(() => {
    localStorage.setItem("vigil-risk-tier", String(selectedTier));
  }, [selectedTier]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    apiFetch("/configure", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, riskTier: selectedTier }),
    }).catch((e) => console.warn("Settings: failed to save", e));
  };

  const copyAddress = (address: string, idx: number) => {
    navigator.clipboard.writeText(address);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const activeTier = tiers[selectedTier];

  return (
    <>
      <BgParticles opacity={0.35} />
      <motion.div initial="hidden" animate="visible" variants={stagger} style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <motion.div variants={fadeUp}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap style={{ width: 18, height: 18, color: "#3b82f6" }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 400, color: "#e0e0e0", margin: 0 }}>Settings</h1>
              <p style={{ fontSize: 12, color: "rgba(232,232,232,0.3)", marginTop: 1 }}>Configure your agent's behavior</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginTop: 32, padding: "28px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.08)", background: "linear-gradient(160deg, rgba(59,130,246,0.02), transparent)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.04), transparent)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", background: "rgba(59,130,246,0.06)" }}>
              <Shield style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "#e0e0e0", margin: 0 }}>Risk Profile</h2>
              <p style={{ fontSize: 11, color: "rgba(232,232,232,0.2)", marginTop: 1 }}>Choose how Vigil manages your portfolio</p>
            </div>
            {activeTier && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 100, border: `1px solid ${activeTier.color}22`, background: activeTier.bg, color: activeTier.color, fontSize: 9, letterSpacing: "0.05em" }}>
                <Sparkles style={{ width: 9, height: 9 }} /> {activeTier.label}
              </span>
            )}
          </div>

          <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
            {tiers.map((t, i) => {
              const isSelected = selectedTier === t.value;
              return (
                <motion.button key={t.value} variants={fadeUp} custom={i} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTier(t.value)}
                  style={{
                    position: "relative", textAlign: "left", padding: "22px 20px", borderRadius: 10, cursor: "pointer",
                    border: isSelected ? `1px solid ${t.border}` : "1px solid rgba(255,255,255,0.04)",
                    background: isSelected ? `linear-gradient(160deg, ${t.bg}, transparent)` : "rgba(255,255,255,0.01)",
                    transition: "all 0.3s",
                    overflow: "hidden",
                  }}
                >
                  {isSelected && (
                    <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "0 10px 0 60px", background: t.color, opacity: 0.06 }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: isSelected ? t.color : "rgba(255,255,255,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected ? <Check style={{ width: 13, height: 13, color: "#fff" }} /> : <Zap style={{ width: 13, height: 13, color: "rgba(232,232,232,0.15)" }} />}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#e0e0e0" }}>{t.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,232,232,0.25)", marginBottom: 14, lineHeight: 1.4 }}>{t.desc}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {t.strategies.map((s) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(232,232,232,0.18)" }}>
                        <TrendingUp style={{ width: 8, height: 8, color: isSelected ? t.color : "rgba(232,232,232,0.1)" }} />
                        {s}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: "rgba(232,232,232,0.15)" }}>Max DD: <span style={{ color: isSelected ? t.color : "rgba(232,232,232,0.25)" }}>{t.maxDD}</span></span>
                    <span style={{ color: "rgba(232,232,232,0.15)" }}>Stop: <span style={{ color: isSelected ? t.color : "rgba(232,232,232,0.25)" }}>{t.stopLoss}</span></span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
              style={{
                padding: "10px 28px", borderRadius: 100,
                border: saved ? "1px solid rgba(59,130,246,0.15)" : "none",
                background: saved ? "rgba(59,130,246,0.06)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                color: saved ? "#3b82f6" : "#fff",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {saved ? <Check style={{ width: 13, height: 13 }} /> : <Zap style={{ width: 13, height: 13 }} />}
              {saved ? "Saved" : "Save Profile"}
            </motion.button>
            {saved && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 11, color: "rgba(59,130,246,0.6)" }}
              >
                Risk profile saved ✓
              </motion.span>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} custom={4} style={{ marginTop: 16, padding: "28px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.08)", background: "linear-gradient(160deg, rgba(16,185,129,0.02), transparent)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.04), transparent)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", background: "rgba(16,185,129,0.06)" }}>
              <ExternalLink style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "#e0e0e0", margin: 0 }}>Deployed Contracts</h2>
              <p style={{ fontSize: 11, color: "rgba(232,232,232,0.2)", marginTop: 1 }}>Verified on Mantle Mainnet</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contracts.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 10,
                    border: "1px solid rgba(16,185,129,0.04)",
                    background: "rgba(16,185,129,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,185,129,0.04)" }}>
                    <Layers style={{ width: 14, height: 14, color: "#10b981" }} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#e0e0e0" }}>{c.name}</span>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "breathe 2s ease-in-out infinite" }} />
                    </div>
                    <code style={{ fontSize: 10, color: "rgba(232,232,232,0.18)", fontFamily: "'DM Mono', monospace" }}>{c.address}</code>
                    <div style={{ fontSize: 9, color: "rgba(16,185,129,0.4)", marginTop: 2 }}>{c.role}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyAddress(c.address, i)}
                    style={{ padding: 8, borderRadius: 6, border: "none", cursor: "pointer", background: "transparent", color: "rgba(232,232,232,0.15)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#3b82f6"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,232,232,0.15)"; }}
                  >
                    {copiedIdx === i ? <Check style={{ width: 14, height: 14, color: "#3b82f6" }} /> : <Copy style={{ width: 14, height: 14 }} />}
                  </motion.button>
                  <motion.a whileHover={{ scale: 1.1 }} href={`https://mantlescan.xyz/address/${c.address}`} target="_blank"
                    style={{ padding: 8, borderRadius: 6, cursor: "pointer", color: "rgba(232,232,232,0.15)", display: "flex" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#3b82f6"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,232,232,0.15)"; }}
                  >
                    <ArrowUpRight style={{ width: 14, height: 14 }} />
                  </motion.a>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} custom={5} style={{ marginTop: 16, padding: "28px", borderRadius: 12, border: "1px solid rgba(168,85,247,0.08)", background: "linear-gradient(160deg, rgba(168,85,247,0.02), transparent)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.04), transparent)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(168,85,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", background: "rgba(168,85,247,0.06)" }}>
              <Fingerprint style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "#e0e0e0", margin: 0 }}>ERC-8004 Agent Identity</h2>
              <p style={{ fontSize: 11, color: "rgba(232,232,232,0.2)", marginTop: 1 }}>Vigil's on-chain NFT identity — discoverable by other agents</p>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 10,
            border: "1px solid rgba(168,85,247,0.04)",
            background: "rgba(168,85,247,0.02)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <code style={{ fontSize: 11, color: "#a855f7", fontFamily: "'DM Mono', 'SF Mono', monospace", wordBreak: "break-all" }}>
                {process.env.NEXT_PUBLIC_AGENT_ID || "0x217a1ebbb9834c507bc3cf6bca6e98005aa44ba81572f89a922b83ed3215f122"}
              </code>
            </div>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => {
                const id = process.env.NEXT_PUBLIC_AGENT_ID || "0x217a1ebbb9834c507bc3cf6bca6e98005aa44ba81572f89a922b83ed3215f122";
                navigator.clipboard.writeText(id);
              }}
              style={{ padding: 8, borderRadius: 6, border: "none", cursor: "pointer", background: "transparent", color: "rgba(232,232,232,0.15)", flexShrink: 0, marginLeft: 12 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#3b82f6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,232,232,0.15)"; }}
            >
              <Copy style={{ width: 14, height: 14 }} />
            </motion.button>
          </div>
          <div style={{ marginTop: 14, fontSize: 10, color: "rgba(232,232,232,0.12)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Sparkles style={{ width: 9, height: 9, color: "#a855f7" }} />
            All decisions logged immutably on Mantle via ERC-8004
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
