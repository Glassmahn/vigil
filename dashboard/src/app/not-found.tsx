import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <Logo size={48} />
      <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 64, fontWeight: 400, color: "rgba(232,232,232,0.1)", margin: "24px 0 8px", letterSpacing: "-0.02em" }}>404</h1>
      <p style={{ fontSize: 14, color: "rgba(232,232,232,0.4)", margin: 0, maxWidth: 360, lineHeight: 1.6 }}>This page isn't part of Vigil's trading strategy. Let's get you back to the command center.</p>
      <Link href="/dashboard" style={{ marginTop: 28, fontSize: 13, fontWeight: 500, color: "#080808", background: "#e8e8e8", padding: "10px 28px", borderRadius: 100, textDecoration: "none", letterSpacing: "0.01em" }}>
        Return to Command Center
      </Link>
    </div>
  );
}
