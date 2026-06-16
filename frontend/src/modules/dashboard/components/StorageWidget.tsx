"use client";

import { useState } from "react";

interface StorageWidgetProps {
  usedBytes?: number;
  totalBytes?: number;
}

export function StorageWidget({ usedBytes, totalBytes }: StorageWidgetProps) {
  const [month, setMonth] = useState("September");

  return (
    <article className="storage-hero-card" style={{ display: "flex", flexDirection: "column" }}>
      {/* Top: "Had last month" label + Month dropdown */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 400, letterSpacing: "0.01em" }}>
          Had last month
        </span>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              background: "rgba(10, 25, 70, 0.55)",
              border: "1px solid rgba(50, 120, 255, 0.22)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: "0.72rem",
              padding: "4px 26px 4px 10px",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              fontFamily: "inherit",
              fontWeight: 500
            }}
          >
            <option value="September">September</option>
            <option value="October">October</option>
            <option value="November">November</option>
          </select>
          <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", fontSize: "0.5rem", pointerEvents: "none" }}>▼</span>
        </div>
      </div>

      {/* Large Storage Number — plain white, NOT gradient (reference shows solid heavy text) */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: "3.6rem",
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "#ffffff",
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          marginBottom: "18px"
        }}>
          <span style={{ WebkitTextFillColor: "#ffffff", backgroundImage: "none", background: "none", WebkitBackgroundClip: "unset" }}>650</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "rgba(180,205,240,0.7)", WebkitTextFillColor: "rgba(180,205,240,0.7)" }}>GB</span>
        </div>
      </div>

      {/* Rainbow Progress Bar */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "7px",
        borderRadius: "999px",
        background: "rgba(255, 255, 255, 0.06)",
        marginBottom: "10px"
      }}>
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: "65%",
          borderRadius: "999px",
          background: "linear-gradient(90deg, #ff4d2e 0%, #ffb300 25%, #00dd88 50%, #00aaff 75%, #0044ee 100%)",
          boxShadow: "0 0 10px rgba(0, 160, 255, 0.35)"
        }} />
      </div>

      {/* Footer labels */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          Your Storage
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          103.38 pm
        </span>
      </div>
    </article>
  );
}
