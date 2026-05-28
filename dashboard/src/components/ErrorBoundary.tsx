"use client";

import { Component, ReactNode } from "react";
import { Shield } from "lucide-react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, color: "rgba(232,232,232,0.4)", textAlign: "center" }}>
          <Shield style={{ width: 32, height: 32, marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 14, marginBottom: 8 }}>Something went wrong</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ fontSize: 12, color: "#3b82f6", border: "none", background: "none", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
