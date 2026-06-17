"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../../src/modules/dashboard/dashboard.css";

import { getStoredAccessToken, getStoredUser, getStoredUsername } from "../../src/modules/auth/session";
import { DashboardOverviewStrip } from "../../src/modules/dashboard/components/DashboardOverviewStrip";
import { DashboardSidebar } from "../../src/modules/dashboard/components/DashboardSidebar";
import { DashboardTopBar } from "../../src/modules/dashboard/components/DashboardTopBar";
import { StorageAccessTable } from "../../src/modules/dashboard/components/StorageAccessTable";
import { StorageWidget } from "../../src/modules/dashboard/components/StorageWidget";
import { TeamPanel } from "../../src/modules/dashboard/components/TeamPanel";
import { DASHBOARD_DATA } from "../../src/modules/dashboard/data/mockDashboardData";
import type { Account } from "../../src/modules/dashboard/types";
import { fetchCurrentUser, fetchStorageStats } from "../../src/modules/platform/api";

/* ── Uploading files mock data ─────────────────────────────── */
const UPLOAD_FILES = [
  { id: "f1", name: "Project deliverables", type: "doc", pct: 72 },
  { id: "f2", name: "Presentation.key", type: "key", pct: 48 },
  { id: "f3", name: "Modules.fig", type: "fig", pct: 91 },
  { id: "f4", name: "Assets_v2.zip", type: "zip", pct: 35 },
];

const ICON_CLASS: Record<string, string> = {
  fig: "upload-icon-fig",
  key: "upload-icon-key",
  doc: "upload-icon-doc",
  zip: "upload-icon-zip",
};

const ICON_EMOJI: Record<string, string> = {
  fig: "🎨",
  key: "📊",
  doc: "📄",
  zip: "📦",
};

/* ═══════════════════════════════════════════════════════════════ */

function FileIcon({ ext }: { ext: string }) {
  const id = ext.toLowerCase();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="54" height="44" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-docGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#263d75" />
          <stop offset="100%" stopColor="#152244" />
        </linearGradient>
        <linearGradient id={`${id}-badgeGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3c5691" />
          <stop offset="100%" stopColor="#243965" />
        </linearGradient>
        <linearGradient id={`${id}-foldGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c6fa1" />
          <stop offset="100%" stopColor="#2c4376" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="transparent" rx="8" />
      <g transform="translate(2, 0)">
        <path d="M 40,20 L 72,20 L 85,33 L 85,85 L 40,85 Z" fill={`url(#${id}-docGradient)`} />
        <polygon points="72,20 72,33 85,33" fill={`url(#${id}-foldGradient)`} />
        <rect x="15" y="42" width="45" height="24" rx="5" fill={`url(#${id}-badgeGradient)`} />
        <text
          x="37.5" y="57"
          fill="#e2e8f0"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="7.5"
          fontWeight="700"
          letterSpacing="0.5"
          textAnchor="middle"
        >.{ext}</text>
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string>("ibrahim");
  const [storageSnapshot, setStorageSnapshot] = useState({ usedSpace: 0, totalQuota: 0 });

  useEffect(() => {
    let mounted = true;

    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const stored = getStoredUsername();
    if (stored) setActiveUsername(stored);
    setTokenReady(true);

    async function loadStorage() {
      try {
        const user = await fetchCurrentUser();
        if (!user) return;
        const stats = await fetchStorageStats(user.id);
        if (!mounted || !stats) return;
        setStorageSnapshot({ usedSpace: stats.usedSpace, totalQuota: stats.totalQuota });
      } catch {
        // keep dashboard usable with fallback values
      }
    }
    void loadStorage();

    return () => { mounted = false; };
  }, [router]);

  const accountById = useMemo(
    () =>
      DASHBOARD_DATA.accounts.reduce<Record<string, Account>>((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {}),
    []
  );

  const activeAccount = useMemo(
    () =>
      DASHBOARD_DATA.accounts.find((a) => a.username === activeUsername) ??
      DASHBOARD_DATA.accounts[0],
    [activeUsername]
  );

  const roleNotifications = useMemo(
    () =>
      DASHBOARD_DATA.notificationsPreview.filter((n) =>
        n.visibleTo.includes(activeAccount.role)
      ),
    [activeAccount.role]
  );

  const teamOwner = accountById[DASHBOARD_DATA.team.ownerAccountId] ?? activeAccount;
  const teamMembers = DASHBOARD_DATA.team.memberAccountIds
    .map((id) => accountById[id])
    .filter(Boolean);

  /* Loading / redirect guard */
  if (!tokenReady) {
    return (
      <main className="dashboard-loading-wrap">
        <section className="dashboard-loading-panel">
          <h1>Redirecting…</h1>
          <p className="dashboard-loading-info">Checking authentication state.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      {/* ── Sidebar ── */}
      <DashboardSidebar activeRole={activeAccount.role} />

      {/* ── Content ── */}
      <section className="dashboard-main">
        <DashboardTopBar
          activeAccount={activeAccount}
          notifications={roleNotifications}
          title="Dashboard"
        />

        <div className="dashboard-scroll-area">
          {/* ── Unified layout grid — header + cards in ONE grid ── */}
          <div className="dash-unified-grid">

            {/* ── Area: greeting (row 1, col 1) ── */}
            <section className="dash-area-greeting hero-copy">
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Good Morning,</p>
              <h2 style={{ margin: "4px 0 0", whiteSpace: "nowrap" }}>Georg Johnson</h2>
            </section>

            {/* ── Area: filters (row 1, col 2) ── */}
            <div className="dash-area-filters">
              {/* Statistic / Last Week dropdown — exact reference match */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                {/* Analytics/chart icon — matches reference (monitor with trend line) */}
                <span style={{ position: "absolute", left: "10px", color: "rgba(140, 170, 220, 0.75)", display: "flex", zIndex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <polyline points="8 21 12 17 16 21" />
                    <line x1="7" y1="10" x2="9.5" y2="7.5" />
                    <line x1="9.5" y1="7.5" x2="12.5" y2="10.5" />
                    <line x1="12.5" y1="10.5" x2="16" y2="7" />
                  </svg>
                </span>
                {/* "Statistic" micro label + dropdown */}
                <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                  <span style={{
                    position: "absolute", top: "-13px", left: "30px",
                    fontSize: "0.58rem", color: "rgba(140,170,220,0.55)",
                    fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    background: "none", WebkitTextFillColor: "rgba(140,170,220,0.55)"
                  }}></span>
                  <select
                    style={{
                      background: "rgba(6, 16, 50, 0.65)",
                      border: "1px solid rgba(50, 120, 255, 0.2)",
                      borderRadius: "10px",
                      color: "#ddeeff",
                      WebkitTextFillColor: "#ddeeff",
                      fontSize: "0.82rem",
                      padding: "8px 32px 8px 32px",
                      outline: "none",
                      cursor: "pointer",
                      appearance: "none",
                      fontFamily: "inherit",
                      fontWeight: 500,
                      minWidth: "130px"
                    }}
                  >
                    <option>Last Week</option>
                    <option>Last Month</option>
                    <option>Last Year</option>
                  </select>
                </div>
                <span style={{ position: "absolute", right: "10px", color: "rgba(140,170,220,0.7)", fontSize: "0.52rem", pointerEvents: "none" }}>▼</span>
              </div>


              {/* Personal / Team Selector — matching reference */}
              <div style={{ display: "flex", background: "rgba(6, 16, 50, 0.65)", border: "1px solid rgba(50, 120, 255, 0.2)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                <button
                  style={{
                    background: "rgba(255, 255, 255, 0.13)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "7px",
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                    fontSize: "0.8rem",
                    padding: "5px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Personal
                </button>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(140,170,220,0.7)",
                    WebkitTextFillColor: "rgba(140,170,220,0.7)",
                    fontSize: "0.8rem",
                    padding: "5px 16px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    borderRadius: "7px"
                  }}
                >
                  Team
                </button>
              </div>
            </div>

            {/* ── Area: team (col 3, spans rows 1 + 2) ── */}
            <div className="dash-area-team">
              <TeamPanel />
            </div>

            {/* ── Area: storage (row 2, col 1) ── */}
            <div className="dash-area-storage">
              <StorageWidget />
            </div>

            {/* ── Area: spaces (row 2, col 2) ── */}
            <div className="dash-area-spaces">
              <DashboardOverviewStrip />
            </div>

            {/* ── Area: upload (row 3, col 1 — ~40%) ── */}
            <article className="dash-area-upload dashboard-card" style={{ padding: "20px" }}>
              <div className="upload-card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 className="upload-card-title" style={{ fontSize: "1rem", margin: 0 }}>Uploading Files</h2>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "grid", placeItems: "center" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", color: "var(--text-secondary)" }}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="upload-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* File 1 */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FileIcon ext="DOC" />
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Project estimate</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>12.3 Mb</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#0050dd,#00c8ff)" }} />
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px", color: "#22c55e" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* File 2 */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FileIcon ext="PDF" />
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Presentation for...</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>36.7 Mb</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#0050dd,#00c8ff)" }} />
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px", color: "#22c55e" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* File 3 */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FileIcon ext="XLS" />
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Work invoicing</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>9.8 Mb</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "23%", background: "linear-gradient(90deg,#0050dd,#00c8ff)" }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", minWidth: "24px", textAlign: "right" }}>23%</span>
                    </div>
                  </div>
                </div>

                {/* Upload status bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,160,255,0.08)", border: "1px solid rgba(0,160,255,0.15)", borderRadius: "10px", padding: "8px 12px", marginTop: "4px" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", color: "#00c8ff", flexShrink: 0 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#00c8ff" }}>Uploading</span>
                  <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(0,160,255,0.15)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "73%", background: "linear-gradient(90deg,#0050dd,#00c8ff)" }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#00c8ff" }}>73%</span>
                </div>
              </div>
            </article>

            {/* ── Area: access (row 3, cols 2+3 — ~60%) ── */}
            <div className="dash-area-access">
              <StorageAccessTable accountById={accountById} />
            </div>

          </div>{/* end dash-unified-grid */}
        </div>{/* end dashboard-scroll-area */}
      </section>
    </main>
  );
}
