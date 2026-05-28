"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface NotificationContextValue {
  notify: (message: string, type?: Toast["type"]) => void;
}

const NotificationContext = createContext<NotificationContextValue>({ notify: () => {} });

export function useNotify() {
  return useContext(NotificationContext);
}

let nextToastId = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextToastId++;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
              style={{
                pointerEvents: "auto",
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.2)",
                backdropFilter: "blur(12px)",
                maxWidth: 360,
              }}
            >
              <Shield style={{ width: 14, height: 14, color: "#3b82f6", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#d0d0d0", lineHeight: 1.4, flex: 1 }}>{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} style={{ padding: 2, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", color: "rgba(232,232,232,0.3)", flexShrink: 0 }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
