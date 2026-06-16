"use client";

import { useState } from "react";

interface StorageWidgetProps {
  usedBytes?: number;
  totalBytes?: number;
}

export function StorageWidget({ usedBytes, totalBytes }: StorageWidgetProps) {
  const [month, setMonth] = useState("September");

  return (
    <article className="storage-hero-card">
      {/* Top Header Row with dropdown */}
      <div className="card-head" style={{ marginBottom: "12px" }}>
        <h2 className="storage-label" style={{ margin: 0, fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          Your storage
        </h2>
        <div className="storage-dropdown-wrap" style={{ position: "relative" }}>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              background: "rgba(10, 25, 70, 0.6)",
              border: "1px solid rgba(50, 120, 255, 0.2)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: "0.75rem",
              padding: "4px 28px 4px 10px",
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
          <span
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
              fontSize: "0.6rem",
              pointerEvents: "none"
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Large Storage Number */}
      <h2 className="storage-gb-number" style={{ fontSize: "3rem", margin: "0 0 16px" }}>
        650 <span style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-secondary)" }}>GB</span>
      </h2>

      {/* Rainbow Progress Bar */}
      <div
        className="storage-bar-container"
        style={{
          position: "relative",
          width: "100%",
          height: "8px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, 0.06)",
          marginBottom: "12px"
        }}
      >
        <div
          className="storage-bar-rainbow-fill"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: "65%",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #ff5e3a 0%, #ffb300 25%, #2ad080 50%, #00a0ff 75%, #0050e8 100%)",
            boxShadow: "0 0 15px rgba(0, 160, 255, 0.5)"
          }}
        />
      </div>

      {/* Labels under the progress bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          Your Storage
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          50GB left
        </span>
      </div>
    </article>
  );
}
