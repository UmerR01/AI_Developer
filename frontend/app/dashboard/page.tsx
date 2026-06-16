"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../../src/modules/dashboard/dashboard.css";

import { getStoredAccessToken, getStoredUsername } from "../../src/modules/auth/session";
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
          {/* Greeting + Filters Row aligned with the columns below */}
          <div className="dash-content-grid" style={{ alignItems: "flex-end", marginBottom: "20px" }}>
            {/* Column 1: Greeting */}
            <section className="hero-copy" style={{ margin: 0 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Good Morning,</p>
              <h2 style={{ margin: "4px 0 0", whiteSpace: "nowrap" }}>Georg Johnson</h2>
            </section>

            {/* Column 2: Filter Buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              {/* Last Week Dropdown */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "10px", color: "var(--text-secondary)", display: "flex" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <select
                  style={{
                    background: "rgba(6, 18, 55, 0.55)",
                    border: "1px solid rgba(50, 120, 255, 0.2)",
                    borderRadius: "8px",
                    color: "#ddeeff",
                    fontSize: "0.75rem",
                    padding: "6px 24px 6px 28px",
                    outline: "none",
                    cursor: "pointer",
                    appearance: "none",
                    fontFamily: "inherit",
                    fontWeight: 500
                  }}
                >
                  <option>Last Week</option>
                  <option>Last Month</option>
                  <option>Last Year</option>
                </select>
                <span style={{ position: "absolute", right: "8px", color: "var(--text-secondary)", fontSize: "0.55rem", pointerEvents: "none" }}>▼</span>
              </div>

              {/* Personal / Team Selector */}
              <div style={{ display: "flex", background: "rgba(6, 18, 55, 0.55)", border: "1px solid rgba(50, 120, 255, 0.2)", borderRadius: "8px", padding: "2px" }}>
                <button
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "0.75rem",
                    padding: "4px 12px",
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
                    color: "var(--text-secondary)",
                    fontSize: "0.75rem",
                    padding: "4px 12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Team
                </button>
              </div>
            </div>

            {/* Column 3: Empty to leave space above Team Structure card */}
            <div />
          </div>

          {/* ── 3-column grid (matches reference) ── */}
          <div className="dash-content-grid">

            {/* ── Row 1: Top Widgets (stretched to equal heights) ── */}
            <StorageWidget />
            <DashboardOverviewStrip />
            <TeamPanel />

            {/* ── Row 2: Bottom Widgets (aligned and width equalized) ── */}
            {/* Uploading Files card */}
            <article className="dashboard-card" style={{ padding: "20px" }}>
              <div className="upload-card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 className="upload-card-title" style={{ fontSize: "1rem", margin: 0 }}>Uploading Files</h2>
                {/* Close Cross icon */}
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "grid", placeItems: "center" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", color: "var(--text-secondary)" }}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="upload-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* File 1: Project estimate */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, rgba(20, 80, 220, 0.45), rgba(50, 130, 255, 0.22))",
                      border: "1px solid rgba(60, 140, 255, 0.22)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff"
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "#60a5fa" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Project estimate</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>12.3 Mb</span>
                    </div>
                    <div className="upload-progress-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="upload-bar-wrap" style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                        <div className="upload-bar-fill" style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #0050dd 0%, #00c8ff 100%)" }} />
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px", color: "#22c55e" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* File 2: Presentation for... */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, rgba(20, 80, 220, 0.45), rgba(50, 130, 255, 0.22))",
                      border: "1px solid rgba(60, 140, 255, 0.22)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff"
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "#60a5fa" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Presentation for...</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>36.7 Mb</span>
                    </div>
                    <div className="upload-progress-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="upload-bar-wrap" style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                        <div className="upload-bar-fill" style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #0050dd 0%, #00c8ff 100%)" }} />
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px", color: "#22c55e" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* File 3: Work invoicing */}
                <div className="upload-item" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, rgba(20, 80, 220, 0.45), rgba(50, 130, 255, 0.22))",
                      border: "1px solid rgba(60, 140, 255, 0.22)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff"
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px", color: "#60a5fa" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="upload-info" style={{ flex: 1 }}>
                    <div className="upload-name" style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>Work invoicing</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>9.8 Mb</span>
                    </div>
                    <div className="upload-progress-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="upload-bar-wrap" style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
                        <div className="upload-bar-fill" style={{ height: "100%", width: "23%", background: "linear-gradient(90deg, #0050dd 0%, #00c8ff 100%)" }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", minWidth: "24px", textAlign: "right" }}>23%</span>
                    </div>
                  </div>
                </div>

                {/* Bottom cloud/upload status bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(0, 160, 255, 0.08)",
                    border: "1px solid rgba(0, 160, 255, 0.15)",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    marginTop: "4px"
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", color: "#00c8ff", flexShrink: 0 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#00c8ff" }}>Uploading</span>
                  <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "rgba(0, 160, 255, 0.15)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "73%", background: "linear-gradient(90deg, #0050dd 0%, #00c8ff 100%)" }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#00c8ff" }}>73%</span>
                </div>
              </div>
            </article>

            <StorageAccessTable accountById={accountById} />

            {/* Row 2, Col 3 Spacer: Leave empty space under Team Structure card */}
            <div />

          </div>
        </div>
      </section>
    </main>
  );
}
