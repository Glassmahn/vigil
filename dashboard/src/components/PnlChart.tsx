"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { apiFetch } from "@/lib/api";

interface PnlPoint {
  value: number;
  pnl: number;
  timestamp: number;
}

export default function PnlChart({ userAddress }: { userAddress?: string | null }) {
  const [data, setData] = useState<PnlPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = userAddress ? `?userAddress=${encodeURIComponent(userAddress)}` : "";
    apiFetch(`/portfolio/history${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userAddress]);

  if (loading) {
    return (
      <div style={{ height: 160, borderRadius: 8, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(232,232,232,0.2)" }}>Loading chart...</span>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div style={{ height: 160, borderRadius: 8, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(232,232,232,0.2)" }}>Not enough data for chart yet</span>
      </div>
    );
  }

  const chartData = data.map((p) => ({
    time: new Date(p.timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: p.value,
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: 160, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(232,232,232,0.2)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "rgba(232,232,232,0.2)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={50} />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11, color: "#e0e0e0" }}
            labelStyle={{ color: "rgba(232,232,232,0.4)" }}
          />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} fill="url(#pnlGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
