"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Settings, ExternalLink, Wallet, LogOut, Copy, Check, Zap, TrendingUp } from "lucide-react";
import GrainOverlay from "@/components/GrainOverlay";
import BgParticles from "@/components/BgParticles";
import Logo from "@/components/Logo";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NotificationProvider } from "@/components/NotificationProvider";
import { apiFetch } from "@/lib/api";

declare global {
  interface Window { ethereum?: any; }
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

const API = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function NavIcon({ icon: Icon, active }: { icon: any; active: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)",
      border: active ? "1px solid rgba(59,130,246,0.15)" : "1px solid transparent",
      transition: "all 0.3s",
    }}>
      <Icon style={{ width: 14, height: 14, color: active ? "#3b82f6" : "rgba(232,232,232,0.25)" }} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [address, setAddress] = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [onchainActive, setOnchainActive] = useState(false);
  const [registryInfo, setRegistryInfo] = useState<any>(null);
  const [solanaWallet, setSolanaWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [navCopied, setNavCopied] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      apiFetch("/status/global")
        .then((r) => r.json()).then((d) => {
          setAgentOnline(d.status === "ok");
          setOnchainActive(d.onchain || false);
          if (d.registry) setRegistryInfo(d.registry);
        }).catch(() => setAgentOnline(false));
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!address) { setSolanaWallet(null); return; }
    apiFetch(`/wallet?userAddress=${address}`)
      .then((r) => r.json())
      .then((d) => { if (d.address && d.address !== "Unknown") setSolanaWallet(d.address); })
      .catch(() => {});
  }, [address]);

  const connect = useCallback(async () => {
    if (!window.ethereum) { alert("Install MetaMask"); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) setAddress(accounts[0]);
    } catch {}
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((a: string[]) => {
      if (a.length > 0) setAddress(a[0]);
    });
    const handler = (a: string[]) => { if (a.length > 0) setAddress(a[0]); else setAddress(null); };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener?.("accountsChanged", handler);
  }, []);

  const copyWallet = () => {
    if (solanaWallet) { navigator.clipboard.writeText(solanaWallet); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const statusItems = [
    { label: "Agent", online: agentOnline, color: "#3b82f6", detail: agentOnline ? "Online" : "Offline" },
    { label: "Logger", online: onchainActive, color: "#3b82f6", detail: onchainActive ? "Active" : "Offline" },
    { label: "Trades", online: registryInfo?.active || false, color: "#3b82f6", detail: registryInfo?.totalTrades > 0 ? `${registryInfo.totalTrades} trades` : "Ready" },
  ];

  const explorerBase = "https://mantlescan.xyz";

  const contractList = [
    { name: "DecisionLog", address: process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS || "" },
    { name: "VigilRegistry", address: process.env.NEXT_PUBLIC_VIGIL_REGISTRY_ADDRESS || "" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex" }}>
      <GrainOverlay />
      <BgParticles opacity={0.15} />

      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="hidden md:flex flex-col"
        style={{
          width: 240, borderRight: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(8,8,8,0.95)", backdropFilter: "blur(20px)",
          position: "relative", zIndex: 2,
        }}
      >
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Logo size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", letterSpacing: "0.06em", lineHeight: 1.2 }}>VIGIL</div>
              <div style={{ fontSize: 8, color: "rgba(59,130,246,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Trading Agent</div>
            </div>
          </Link>
        </div>

        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {statusItems.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.online ? s.color : "rgba(232,232,232,0.12)", position: "relative", flexShrink: 0 }}>
                  {s.online && <span style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `1px solid ${s.color}33`, animation: "ping 2.5s ease-in-out infinite" }} />}
                </span>
                <span style={{ fontSize: 9, color: s.online ? `${s.color}aa` : "rgba(232,232,232,0.15)", letterSpacing: "0.04em", flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 9, color: s.online ? `${s.color}cc` : "rgba(232,232,232,0.1)", fontVariantNumeric: "tabular-nums" }}>{s.detail}</span>
              </div>
            ))}
            {registryInfo?.totalTrades > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.02)" }}>
                <TrendingUp style={{ width: 9, height: 9, color: "#3b82f6" }} />
                <span style={{ fontSize: 9, color: "rgba(59,130,246,0.6)" }}>
                  P&L: {registryInfo.totalPnl >= 0 ? "+" : ""}${registryInfo.totalPnl.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((item, i) => {
            const active = pathname === item.href;
            return (
              <motion.div key={item.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <Link href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 9,
                    fontSize: 12, fontWeight: active ? 500 : 400,
                    textDecoration: "none", transition: "all 0.2s",
                    color: active ? "#e8e8e8" : "rgba(232,232,232,0.3)",
                    background: active ? "linear-gradient(135deg, rgba(59,130,246,0.08), transparent)" : "transparent",
                    border: active ? "1px solid rgba(59,130,246,0.1)" : "1px solid transparent",
                  }}
                >
                  <NavIcon icon={item.icon} active={active} />
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div style={{ padding: "8px 14px 10px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          <button onClick={address ? disconnect : connect}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
              padding: "8px 0", borderRadius: 100, cursor: "pointer", fontSize: 11, fontWeight: 500,
              border: address ? "1px solid rgba(59,130,246,0.12)" : "1px solid rgba(255,255,255,0.04)",
              color: address ? "#3b82f6" : "rgba(232,232,232,0.25)",
              background: address ? "rgba(59,130,246,0.04)" : "rgba(255,255,255,0.01)",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = address ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.1)"; if (!address) e.currentTarget.style.color = "rgba(232,232,232,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = address ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)"; if (!address) e.currentTarget.style.color = "rgba(232,232,232,0.25)"; }}
          >
            {address ? (
              <><Wallet style={{ width: 12, height: 12 }} /> {truncate(address)} <LogOut style={{ width: 10, height: 10, opacity: 0.4 }} /></>
            ) : (
              <><Wallet style={{ width: 12, height: 12 }} /> Connect Wallet</>
            )}
          </button>
        </div>

        <div style={{ padding: "6px 14px 14px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 4 }}>
            <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(232,232,232,0.1)" }}>Contracts</span>
            <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 100, border: "1px solid rgba(59,130,246,0.1)", color: "rgba(59,130,246,0.4)" }}>
              mainnet
            </span>
          </div>
          {contractList.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", borderRadius: 6, transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#3b82f6", opacity: 0.3, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 9, color: "rgba(232,232,232,0.2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              <div style={{ display: "flex", gap: 2 }}>
                <button onClick={() => { navigator.clipboard.writeText(c.address); setNavCopied(i); setTimeout(() => setNavCopied(null), 1500); }}
                  style={{ padding: 2, borderRadius: 3, border: "none", cursor: "pointer", background: "transparent", color: navCopied === i ? "#3b82f6" : "rgba(232,232,232,0.1)" }}
                >
                  {navCopied === i ? <Check style={{ width: 8, height: 8 }} /> : <Copy style={{ width: 8, height: 8 }} />}
                </button>
                <a href={`${explorerBase}/address/${c.address}`} target="_blank"
                  style={{ padding: 2, borderRadius: 3, color: "rgba(232,232,232,0.1)", display: "flex" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#3b82f6"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(232,232,232,0.1)"; }}
                >
                  <ExternalLink style={{ width: 8, height: 8 }} />
                </a>
              </div>
            </div>
          ))}
          {address && solanaWallet && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.02)" }}>
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(232,232,232,0.1)", display: "block", padding: "0 4px", marginBottom: 4 }}>Solana Wallet</span>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 8px", borderRadius: 6,
                background: "linear-gradient(135deg, rgba(59,130,246,0.04), rgba(59,130,246,0.02))",
                border: "1px solid rgba(59,130,246,0.06)",
              }}>
                <code style={{ flex: 1, fontSize: 8, color: "#3b82f6", wordBreak: "break-all", fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
                  {solanaWallet}
                </code>
                <button onClick={copyWallet} style={{ padding: 3, borderRadius: 3, border: "none", cursor: "pointer", background: "transparent", color: copied ? "#3b82f6" : "rgba(232,232,232,0.12)", flexShrink: 0 }}>
                  {copied ? <Check style={{ width: 9, height: 9 }} /> : <Copy style={{ width: 9, height: 9 }} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <motion.nav initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
          className="md:hidden"
          style={{
            position: "sticky", top: 0, zIndex: 40,
            background: "rgba(8,8,8,0.85)", backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <Logo size={20} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "0.06em" }}>VIGIL</span>
            </Link>
            <div style={{ display: "flex", gap: 4 }}>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    style={{
                      padding: 8, borderRadius: 8, transition: "all 0.2s",
                      color: active ? "#3b82f6" : "rgba(232,232,232,0.3)",
                      background: active ? "rgba(59,130,246,0.08)" : "transparent",
                    }}
                  >
                    <item.icon style={{ width: 16, height: 16 }} />
                  </Link>
                );
              })}
              <button onClick={address ? disconnect : connect} style={{ padding: 8, borderRadius: 8, color: address ? "#3b82f6" : "rgba(232,232,232,0.3)", background: "transparent", border: "none", cursor: "pointer" }}>
                <Wallet style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
          {address && solanaWallet && (
            <div style={{ padding: "4px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}>
                <code style={{ flex: 1, fontSize: 9, color: "#3b82f6", wordBreak: "break-all", fontFamily: "'DM Mono', monospace" }}>{solanaWallet}</code>
                <button onClick={copyWallet} style={{ padding: 4, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", color: copied ? "#3b82f6" : "rgba(232,232,232,0.2)", flexShrink: 0 }}>
                  {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                </button>
              </div>
            </div>
          )}
        </motion.nav>

        <main style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
          <ErrorBoundary>
            <NotificationProvider>{children}</NotificationProvider>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
