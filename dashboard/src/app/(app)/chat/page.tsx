"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Send, User, Sparkles, Bot, Zap, TrendingUp, BarChart3 } from "lucide-react";
import BgParticles from "@/components/BgParticles";
import { apiFetch } from "@/lib/api";

declare global {
  interface Window { ethereum?: any; }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatMarkdown(text: string): string {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(59,130,246,0.1);padding:1px 6px;border-radius:4px;font-size:0.9em;color:#60a5fa'>$1</code>")
    .replace(/^- (.+)$/gm, "<span style='display:block;padding-left:14px;position:relative;line-height:1.6'><span style='position:absolute;left:0;color:#3b82f6'>●</span>$1</span>")
    .replace(/\n{2,}/g, "<br /><br />")
    .replace(/\n/g, "<br />");
}

const suggestions = [
  "Assess my risk profile",
  "Show my portfolio",
  "Deploy $100 to safe farming",
  "What strategies are active?",
];

export default function ChatPage() {
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; id: number }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [sessionId] = useState(() => { if (typeof window === "undefined") return "web-chat-ssr"; const saved = localStorage.getItem("vigil-session-id"); if (saved) return saved; const id = `web-${Date.now()}`; localStorage.setItem("vigil-session-id", id); return id; });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const STORAGE_KEY = `vigil-chat-${typeof window !== "undefined" ? sessionId : "ssr"}`;

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((a: string[]) => {
        if (a.length > 0) setUserAddress(a[0]);
      });
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
        const maxId = parsed.reduce((m: number, msg: any) => Math.max(m, msg.id || 0), 0);
        nextId.current = maxId + 1;
      } else {
        setMessages([{ role: "assistant", content: "I'm Vigil, your autonomous trading agent. Tell me about your investment goals and I'll help build a strategy.\n\nTry saying: \"I want to start investing\" or \"Assess my risk profile\"", id: 0 }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: "I'm Vigil, your autonomous trading agent. Tell me about your investment goals and I'll help build a strategy.\n\nTry saying: \"I want to start investing\" or \"Assess my risk profile\"", id: 0 }]);
    }
    setHydrated(true);
  }, [STORAGE_KEY]);

  useEffect(() => {
    if (hydrated && messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, hydrated, STORAGE_KEY]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (textOverride?: string) => {
    const text = (textOverride || input).trim();
    if (!text || loading) return;
    setInput("");
    const userId = nextId.current++;
    setMessages((p) => [...p, { role: "user", content: text, id: userId }]);
    setLoading(true);

    const assistantId = nextId.current++;
    setMessages((p) => [...p, { role: "assistant", content: "", id: assistantId }]);

    try {
      const res = await apiFetch("/chat/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, userAddress }),
      });
      if (!res.ok) throw new Error("Agent offline");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) continue;
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.token !== undefined) {
              fullContent += parsed.token;
              setMessages((p) =>
                p.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
              );
            }
          } catch {}
        }
      }
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Agent backend is offline. Start it with:\n\nnpm run agent:start\n\nIn the meantime, here's what Vigil can do:\n\n- Chat about your investment goals\n- Assess risk through conversation\n- Deploy strategies via Byreal CLMM + Perps\n- Log decisions on Mantle" }
            : m
        )
      );
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  if (!hydrated) return null;

  const hasMessages = messages.length > 1;

  return (
    <>
      <BgParticles opacity={0.4} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        style={{ maxWidth: 760, margin: "0 auto", height: "calc(100vh - 100px)", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}
      >
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot style={{ width: 17, height: 17, color: "#3b82f6" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#e0e0e0", margin: 0 }}>Chat</h1>
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(59,130,246,0.12)", background: "rgba(59,130,246,0.05)", color: "#3b82f6", fontSize: 9, letterSpacing: "0.05em" }}>
                <Sparkles style={{ width: 9, height: 9 }} /> AI
              </span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(232,232,232,0.25)", marginTop: 1 }}>Natural language. Real results.</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", animation: "breathe 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "rgba(232,232,232,0.2)" }}>Live</span>
          </div>
        </motion.div>

        <div style={{
          flex: 1, borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(59,130,246,0.06)",
          background: "linear-gradient(160deg, rgba(59,130,246,0.02), transparent)",
          display: "flex", flexDirection: "column",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {!hasMessages && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ textAlign: "center", padding: "24px 0 16px" }}
              >
                <div style={{ fontSize: 11, color: "rgba(232,232,232,0.15)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Quick Actions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {suggestions.map((s) => (
                    <motion.button key={s} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={() => send(s)}
                      style={{
                        padding: "6px 14px", borderRadius: 100, border: "1px solid rgba(59,130,246,0.08)", cursor: "pointer",
                        background: "rgba(59,130,246,0.04)", color: "rgba(232,232,232,0.4)", fontSize: 11,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)"; e.currentTarget.style.color = "#3b82f6"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.08)"; e.currentTarget.style.color = "rgba(232,232,232,0.4)"; }}
                    >{s}</motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: msg.role === "assistant" ? "1px solid rgba(59,130,246,0.15)" : "1px solid rgba(255,255,255,0.06)",
                    background: msg.role === "assistant" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)",
                    color: msg.role === "assistant" ? "#3b82f6" : "rgba(232,232,232,0.3)",
                  }}>
                    {msg.role === "assistant" ? <Bot style={{ width: 13, height: 13 }} /> : <User style={{ width: 13, height: 13 }} />}
                  </div>
                  <div style={{
                    maxWidth: "75%",
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "#d0d0d0",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))"
                      : "rgba(255,255,255,0.02)",
                    border: msg.role === "user"
                      ? "1px solid rgba(59,130,246,0.1)"
                      : "1px solid rgba(255,255,255,0.03)",
                    position: "relative",
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: msg.role === "user" ? msg.content : formatMarkdown(msg.content) }} />
                    {msg.role === "assistant" && msg.content && !loading && (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: 10, fontSize: 9, color: "rgba(232,232,232,0.12)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Zap style={{ width: 8, height: 8 }} /> On-chain</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {loading && (
                <motion.div key="typing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                    <div style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", background: "rgba(245,158,11,0.08)" }}>
                      <Bot style={{ width: 13, height: 13 }} />
                    </div>
                    <div style={{
                      padding: "10px 16px", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.02)",
                      display: "flex", gap: 5, alignItems: "center",
                    }}>
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                          style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                      ))}
                      <span style={{ fontSize: 10, color: "rgba(232,232,232,0.15)", marginLeft: 4 }}>Thinking</span>
                    </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          <div style={{ padding: "12px 16px 14px", borderTop: "1px solid rgba(59,130,246,0.04)", background: "rgba(59,130,246,0.01)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Message Vigil..." disabled={loading}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 100, fontSize: 13,
                    border: "1px solid rgba(59,130,246,0.08)",
                    background: "rgba(0,0,0,0.2)", color: "#e0e0e0", outline: "none",
                    transition: "border-color 0.3s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.08)"; }}
                />
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => send()} disabled={loading || !input.trim()}
                style={{
                  padding: "10px 20px", borderRadius: 100, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, flexShrink: 0,
                  background: input.trim() && !loading ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "rgba(255,255,255,0.04)",
                  color: input.trim() && !loading ? "#fff" : "rgba(232,232,232,0.15)",
                  transition: "all 0.3s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Send style={{ width: 13, height: 13 }} />
                <span className="hidden sm:inline">Send</span>
              </motion.button>
            </div>
            <p style={{ fontSize: 9, color: "rgba(232,232,232,0.1)", marginTop: 8, textAlign: "center", letterSpacing: "0.03em" }}>
              Vigil uses AI — verify important decisions on-chain via Mantle
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
