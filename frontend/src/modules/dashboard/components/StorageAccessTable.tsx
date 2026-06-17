"use client";

import { AvatarStack } from "./AvatarStack";
import type { Account } from "../types";

interface StorageAccessTableProps {
  projects?: unknown;
  accountById: Record<string, Account>;
}

export function StorageAccessTable({ accountById }: StorageAccessTableProps) {
  // Hardcoded project items matching the new reference image exactly
  const items = [
    {
      name: "KG Performance Project",
      files: "125 Files",
      size: "32.1 GB",
      memberIds: ["acc-ibrahim", "acc-ismail", "acc-zahid"]
    },
    {
      name: "Content for showreel",
      files: "68 Files",
      size: "15.6 GB",
      memberIds: ["acc-ismail", "acc-faizan"]
    },
    {
      name: "Photos of team",
      files: "97 Files",
      size: "12.4 GB",
      memberIds: ["acc-ibrahim", "acc-zahid", "acc-faizan", "acc-ai-dev"]
    },
    {
      name: "Stock Images",
      files: "167 Files",
      size: "46.7 GB",
      memberIds: ["acc-zahid", "acc-ismail", "acc-ibrahim", "acc-faizan", "acc-ai-dev"]
    }
  ];

  const getMembers = (ids: string[]): Account[] => {
    return ids.map((id) => accountById[id]).filter(Boolean);
  };

  return (
    <article className="dashboard-card access-card" style={{ padding: "20px" }}>
      {/* Title */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", margin: "0 0 6px 0" }}>
        Storage Access
      </h2>
      
      {/* Subtitle */}
      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 20px 0", lineHeight: "1.4" }}>
        You can grant access to all files in your space to anyone, as well as allow them to download and edit the files.
      </p>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(6, 18, 55, 0.35)",
              border: "1px solid rgba(40, 100, 230, 0.1)",
              borderRadius: "12px",
              padding: "10px 16px",
              gap: "12px"
            }}
          >
            {/* Project Name */}
            <div style={{ flex: "1.5", minWidth: "150px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>
                {item.name}
              </span>
            </div>

            {/* Files Count */}
            <div style={{ flex: "0.8" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {item.files}
              </span>
            </div>

            {/* Size */}
            <div style={{ flex: "0.8" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {item.size}
              </span>
            </div>

            {/* Members Stack */}
            <div style={{ display: "flex", alignItems: "center", flex: "0.8", justifyContent: "center" }}>
              <AvatarStack members={getMembers(item.memberIds)} />
            </div>

            {/* Share Access Button */}
            <div style={{ flex: "1", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                style={{
                  fontSize: "0.73rem",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #1a4fff 0%, #3a6fff 100%)",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 12px rgba(30, 80, 255, 0.35)",
                  transition: "opacity 0.15s ease"
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Share access
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
