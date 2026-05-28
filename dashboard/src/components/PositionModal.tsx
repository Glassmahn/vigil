"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, TrendingUp, Layers, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

interface PositionModalProps {
  position: any;
  onClose: () => void;
  onClosePosition: (id: string) => void;
  explorerBase?: string;
}

export default function PositionModal({ position, onClose, onClosePosition, explorerBase = "https://mantlescan.xyz" }: PositionModalProps) {
  const [copied, setCopied] = useState(false);
  if (!position) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const posId = position.address || position.nftMint || "";
  const poolName = position.pool || position.poolName || "Unknown";
  const value = position.depositedUsd || position.valueUsd || 0;
  const apr = position.apr || position.apr24h || 0;
  const token0 = position.token0 || position.mintA || "—";
  const token1 = position.token1 || position.mintB || "—";
  const feeTier = position.feeTier || position.fee || "—";
  const priceLower = position.priceLower || position.lowerPrice || "—";
  const priceUpper = position.priceUpper || position.upperPrice || "—";
  const pnl = position.unclaimedPnl || position.uncollectedFees || 0;

  const handleCopy = () => {
    if (posId) { navigator.clipboard.writeText(posId); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label="Position details"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose} onKeyDown={handleKeyDown}
    >
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: "90%", padding: "28px 24px", borderRadius: 14, border: "1px solid rgba(59,130,246,0.1)", background: "#0c0c0c" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers style={{ width: 14, height: 14, color: "#3b82f6" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#e0e0e0" }}>{poolName}</div>
              <div style={{ fontSize: 9, color: "rgba(232,232,232,0.2)" }}>CLMM Position</div>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: "none", cursor: "pointer", background: "transparent", color: "rgba(232,232,232,0.2)" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Value", value: `$${value.toFixed(2)}`, icon: <DollarSign style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
            { label: "APR", value: `${apr.toFixed(1)}%`, icon: <TrendingUp style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
            { label: "Token 0", value: token0, icon: <Layers style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
            { label: "Token 1", value: token1, icon: <Layers style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
            { label: "Fee Tier", value: String(feeTier), icon: <TrendingUp style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
            { label: "Unclaimed", value: `$${pnl.toFixed(2)}`, icon: <DollarSign style={{ width: 11, height: 11 }} />, color: "#3b82f6" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.01)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span style={{ color: item.color, display: "flex" }}>{item.icon}</span>
                <span style={{ fontSize: 9, color: "rgba(232,232,232,0.2)" }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#d0d0d0" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {posId && (
            <>
              <button onClick={handleCopy}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(59,130,246,0.1)", cursor: "pointer", background: "transparent", color: copied ? "#3b82f6" : "rgba(59,130,246,0.4)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {copied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
                {copied ? "Copied" : "Copy Address"}
              </button>
              <a href={`${explorerBase}/address/${posId}`} target="_blank"
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(59,130,246,0.1)", cursor: "pointer", background: "transparent", color: "rgba(59,130,246,0.4)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}
              >
                <ExternalLink style={{ width: 11, height: 11 }} /> Explorer
              </a>
            </>
          )}
          <button onClick={() => { onClosePosition(posId); onClose(); }}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(59,130,246,0.12)", cursor: "pointer", background: "rgba(59,130,246,0.04)", color: "#3b82f6", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            Close Position
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
