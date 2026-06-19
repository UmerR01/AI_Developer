"use client";

import { useState } from "react";

interface StorageWidgetProps {
  usedBytes?: number;
  totalBytes?: number;
}

export function StorageWidget({ usedBytes: _usedBytes, totalBytes: _totalBytes }: StorageWidgetProps) {
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
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: "10px",
              color: "var(--text)",
              fontSize: "0.72rem",
              padding: "6px 26px 6px 14px",
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
          <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", fontSize: "0.5rem", pointerEvents: "none" }}>▼</span>
        </div>
      </div>

      {/* Large Storage Number — gradient text matching reference exactly */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "2.6rem",
          fontWeight: 300,
          letterSpacing: "-0.02em",
          background: "linear-gradient(180deg, #ffffff 25%, #90a5c3 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent"
        }}>650</span>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "#90a5c3",
          WebkitTextFillColor: "#90a5c3"
        }}>GB</span>
      </div>

      {/* Rainbow Progress Bar with coloured glow reflection — exact reference */}
      <div style={{ position: "relative", height: "25px" }}>
        {/* Glow blur layer beneath the bar */}
        <div style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "64%",
          height: "16px",
          background: "linear-gradient(90deg, #ff4d2e 0%, #ffb02e 33%, #2ecc71 66%, #2e6cff 100%)",
          opacity: 0.6,
          filter: "blur(14px)",
          pointerEvents: "none"
        }} />
        {/* Actual progress bar track + fill */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "6px",
          borderRadius: "6px",
          background: "#1c2748",
          overflow: "hidden"
        }}>
          <div style={{
            width: "64%",
            height: "100%",
            borderRadius: "6px",
            background: "linear-gradient(90deg, #ff4d2e 0%, #ffb02e 33%, #2ecc71 66%, #2e6cff 100%)"
          }} />
        </div>
      </div>

      {/* Footer labels */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          Your Storage
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          103.38 GB left
        </span>
      </div>
    </article>
  );
}
