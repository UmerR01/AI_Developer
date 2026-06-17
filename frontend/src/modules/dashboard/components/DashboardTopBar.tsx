"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Account, NotificationPreviewItem } from "../types";

interface DashboardTopBarProps {
  activeAccount: Account;
  title?: string;
  notifications: NotificationPreviewItem[];
}

export function DashboardTopBar({
  activeAccount: _activeAccount,
  title = "Dashboard",
  notifications,
}: DashboardTopBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notificationBadge = useMemo(
    () => (notifications.length > 9 ? "9+" : notifications.length.toString()),
    [notifications.length]
  );

  return (
    <header className="dashboard-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", padding: "0 24px" }}>

      {/* Hidden SVG gradient definition for topbar icons */}
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
        <defs>
          <linearGradient id="topbarIconGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="25%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#90a5c3" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Left: Page title ── */}
      <div className="topbar-left" style={{ display: "flex", alignItems: "center" }}>
        <h1 className="topbar-title">
          {title}
        </h1>
      </div>

      {/* ── Center: Search ── */}
      <div className="topbar-search" style={{ flex: "1", maxWidth: "340px", position: "relative", marginLeft: "24px" }}>
        <span className="topbar-search-icon" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#topbarIconGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          id="topbar-search"
          className="topbar-search-input"
          type="search"
          placeholder="Search space, folder, file etc"
          aria-label="Search"
          autoComplete="off"
          style={{
            width: "100%",
            height: "36px",
            borderRadius: "10px",
            border: "1px solid rgba(40, 90, 200, 0.18)",
            background: "rgba(6, 18, 55, 0.5)",
            color: "#fff",
            fontSize: "0.78rem",
            padding: "0 60px 0 38px",
            outline: "none"
          }}
        />
        {/* alt+f badge */}
        <span
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.68rem",
            color: "var(--text-secondary)",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "2px 6px",
            borderRadius: "6px",
            pointerEvents: "none"
          }}
        >
          alt+f
        </span>
      </div>

      {/* ── Right: Actions + Profile ── */}
      <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        
        {/* Help icon button (custom circle) */}
        <button
          type="button"
          className="topbar-icon-btn"
          aria-label="Help"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "1px solid rgba(40, 90, 200, 0.15)",
            background: "rgba(6, 18, 55, 0.45)",
            color: "var(--text-secondary)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#topbarIconGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        {/* Notification bell */}
        <div className="notification-wrap" ref={wrapperRef} style={{ position: "relative" }}>
          <button
            type="button"
            id="topbar-notif-btn"
            className="topbar-icon-btn"
            aria-label="Notifications"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => setIsOpen((v) => !v)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid rgba(40, 90, 200, 0.15)",
              background: "rgba(6, 18, 55, 0.45)",
              color: "var(--text-secondary)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              position: "relative"
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#topbarIconGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span
                className="notification-badge"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  background: "var(--danger)",
                  border: "2px solid #020912",
                  borderRadius: "50%",
                  width: "16px",
                  height: "16px",
                  fontSize: "0.62rem",
                  fontWeight: "bold",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                {notificationBadge}
              </span>
            )}
          </button>

          {isOpen && (
            <div
              className="notification-dropdown"
              role="dialog"
              aria-label="Notifications list"
              style={{
                position: "absolute",
                right: 0,
                top: "44px",
                width: "280px",
                background: "rgba(5, 12, 38, 0.98)",
                border: "1px solid rgba(40, 100, 230, 0.18)",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                zIndex: "50",
                padding: "8px 0"
              }}
            >
              <div className="notification-dropdown-head" style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="notification-dropdown-title" style={{ fontSize: "0.78rem", fontWeight: 600 }}>Notifications</span>
                <span className="notification-dropdown-count" style={{ fontSize: "0.68rem", color: "var(--text-secondary)", background: "rgba(255, 255, 255, 0.06)", padding: "1px 6px", borderRadius: "4px" }}>
                  {notifications.length}
                </span>
              </div>
              <ul className="notification-list" style={{ listStyle: "none", padding: "4px 0", margin: 0, maxHeight: "240px", overflowY: "auto" }}>
                {notifications.map((n) => (
                  <li key={n.id} className="notification-item" style={{ padding: "8px 16px", transition: "background 0.2s" }}>
                    <p style={{ fontSize: "0.75rem", margin: 0, color: "#fff" }}>{n.text}</p>
                    <time style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{n.time}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Profile Details (Alfred Williamson) */}
        <div
          className="topbar-profile"
          role="button"
          tabIndex={0}
          aria-label="User menu"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0
          }}
        >
          {/* Default user avatar matching the reference */}
          <div style={{ position: "relative", width: "32px", height: "32px" }}>
            <Image
              src="https://api.dicebear.com/8.x/adventurer/svg?seed=Alfred"
              alt="Alfred Williamson"
              width={32}
              height={32}
              unoptimized
              style={{
                borderRadius: "50%",
                background: "rgba(10, 25, 75, 0.9)",
                border: "1.5px solid rgba(255, 255, 255, 0.15)",
                objectFit: "cover"
              }}
            />
          </div>
          <div className="topbar-profile-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1px" }}>
            <span className="topbar-profile-name" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>
              Alfred Williamson
            </span>
            <span className="topbar-profile-role" style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
              alfredwilliamson@example.com
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}

