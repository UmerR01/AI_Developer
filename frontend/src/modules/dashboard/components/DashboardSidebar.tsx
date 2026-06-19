"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearStoredSession } from "../../auth/session";

/* ── Custom SVG Icons matching reference design exactly ── */

function IconLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="url(#sidebarIconGrad)">
      {/* Checkerboard square wave pattern */}
      <rect x="4" y="13" width="3.5" height="3.5" rx="0.7" />
      <rect x="8.5" y="7.5" width="3.5" height="3.5" rx="0.7" />
      <rect x="13" y="13" width="3.5" height="3.5" rx="0.7" />
      <rect x="17.5" y="7.5" width="3.5" height="3.5" rx="0.7" />
    </svg>
  );
}

/* Dashboard – 2×2 block grid */
function IconDashboardGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
    </svg>
  );
}

/* Projects – folder with code brackets <> */
function IconCodeFolder() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <path d="M9 13l-2.5 2 2.5 2" />
      <path d="M15 13l2.5 2-2.5 2" />
    </svg>
  );
}

/* Members – people group (unchanged) */
function IconPeopleGroup() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 21v-1.8a3 3 0 0 0-2.2-2.9" />
      <circle cx="17.5" cy="7" r="2.5" />
    </svg>
  );
}

/* Tasks – clipboard with triple-check list */
function IconTasksClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Clipboard body */}
      <rect x="5" y="4" width="14" height="17" rx="2" ry="2" />
      {/* Clipboard top clip */}
      <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V4z" />
      {/* Check marks */}
      <path d="M8.5 10l1.2 1.2 2.3-2.3" />
      <path d="M8.5 14l1.2 1.2 2.3-2.3" />
      <path d="M8.5 18l1.2 1.2 2.3-2.3" />
      {/* Lines */}
      <line x1="13.5" y1="10.5" x2="16" y2="10.5" />
      <line x1="13.5" y1="14.5" x2="16" y2="14.5" />
      <line x1="13.5" y1="18.5" x2="16" y2="18.5" />
    </svg>
  );
}

/* Integrations – two doc pages with a merge-arrow (like the stock image) */
function IconIntegration() {
  return (
    <svg width="20" height="20" viewBox="0 0 26 26" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Back document */}
      <path d="M15 3h5a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 20 19h-1" />
      {/* Front document */}
      <rect x="5" y="6" width="11" height="15" rx="1.5" ry="1.5" />
      {/* Fold corner on front doc */}
      <path d="M12 6v3.5H16" />
      {/* Inward arrows (merge) */}
      <path d="M9.5 12.5l-2 2 2 2" />
      <path d="M13 12.5l2 2-2 2" />
    </svg>
  );
}

/* Support – headset icon */
function IconHeadset() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Arc headband */}
      <path d="M3 11a9 9 0 0 1 18 0" />
      {/* Left ear cup */}
      <rect x="2" y="11" width="4" height="6" rx="2" />
      {/* Right ear cup */}
      <rect x="18" y="11" width="4" height="6" rx="2" />
      {/* Mic arm */}
      <path d="M20 17v1a3 3 0 0 1-3 3h-3" />
      <circle cx="13.5" cy="21" r="0.75" fill="url(#sidebarIconGrad)" stroke="none" />
    </svg>
  );
}

/* AI Agents – robot head matching reference design */
function IconRobot() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Head */}
      <rect x="5" y="9" width="14" height="10" rx="3" />
      {/* Antenna */}
      <line x1="12" y1="9" x2="12" y2="5" />
      <circle cx="12" cy="3.5" r="1.5" fill="url(#sidebarIconGrad)" stroke="none" />
      {/* Ears */}
      <rect x="3" y="12" width="2" height="4" rx="1" fill="url(#sidebarIconGrad)" stroke="none" />
      <rect x="19" y="12" width="2" height="4" rx="1" fill="url(#sidebarIconGrad)" stroke="none" />
      {/* Eyes */}
      <circle cx="9" cy="13.5" r="1.5" fill="url(#sidebarIconGrad)" stroke="none" />
      <circle cx="15" cy="13.5" r="1.5" fill="url(#sidebarIconGrad)" stroke="none" />
      {/* Smile */}
      <path d="M9.5 16c1 1.2 4 1.2 5 0" />
    </svg>
  );
}

/* Settings – hollow gear (unchanged) */
function IconHollowGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* Logout arrow (unchanged) */
function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function DashboardSidebar({ activeRole: _activeRole }: { activeRole?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  const handleToggle = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    localStorage.setItem("sidebar-expanded", String(nextState));
  };

  // Helper to determine path active state
  const isActive = (itemPath: string) => {
    if (pathname === itemPath) return true;
    if (itemPath === "/settings") return false;
    return itemPath !== "/" && pathname.startsWith(`${itemPath}/`);
  };

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  return (
    <aside className={`dashboard-sidebar ${isExpanded ? "sidebar--expanded" : "sidebar--collapsed"}`} aria-label="Sidebar navigation">
      {/* Shared SVG Gradient Definition */}
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
        <defs>
          <linearGradient id="sidebarIconGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="25%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#90a5c3" />
          </linearGradient>
        </defs>
      </svg>

      {/* Logo Wrapper */}
      <div className="sidebar-header" style={{ padding: "18px 14px 12px", display: "flex", alignItems: "center", gap: "12px", justifyContent: isExpanded ? "flex-start" : "center" }}>
        <Link
          href="/dashboard"
          className="sidebar-logo"
          aria-label="Go to dashboard"
          style={{
            background: "linear-gradient(135deg, #4d7cff 0%, #0040e6 100%)",
            borderRadius: "10px",
            width: "38px",
            height: "38px",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 12px rgba(0, 60, 220, 0.35)",
            border: "none",
            color: "#fff",
            flexShrink: 0
          }}
        >
          <IconLogo />
        </Link>
        {isExpanded && (
          <span className="sidebar-logo-text" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            AIDEV
          </span>
        )}
      </div>

      {/* Nav Link List */}
      <nav className="sidebar-nav" aria-label="Primary navigation" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>

        {/* ── Section 1: Core navigation ── */}
        <Link
          href="/dashboard"
          className={`sidebar-link ${isActive("/dashboard") ? "sidebar-link--active" : ""}`}
          title="Dashboard"
          aria-label="Dashboard"
        >
          <span className="sidebar-link-icon"><IconDashboardGrid /></span>
          <span className="sidebar-link-label">Dashboard</span>
        </Link>

        <Link
          href="/projects"
          className={`sidebar-link ${isActive("/projects") ? "sidebar-link--active" : ""}`}
          title="Projects"
          aria-label="Projects"
        >
          <span className="sidebar-link-icon"><IconCodeFolder /></span>
          <span className="sidebar-link-label">Projects</span>
        </Link>

        <Link
          href="/member"
          className={`sidebar-link ${isActive("/member") ? "sidebar-link--active" : ""}`}
          title="Members"
          aria-label="Members"
        >
          <span className="sidebar-link-icon"><IconPeopleGroup /></span>
          <span className="sidebar-link-label">Members</span>
        </Link>

        <Link
          href="/tasks"
          className={`sidebar-link ${isActive("/tasks") ? "sidebar-link--active" : ""}`}
          title="Tasks"
          aria-label="Tasks"
        >
          <span className="sidebar-link-icon"><IconTasksClipboard /></span>
          <span className="sidebar-link-label">Tasks</span>
        </Link>

        {/* Separator line */}
        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 8px" }} />

        {/* ── Section 2: Integrations, Support, AI Agents ── */}
        <Link
          href="/settings/integrations"
          className={`sidebar-link ${isActive("/settings/integrations") ? "sidebar-link--active" : ""}`}
          title="Integrations"
          aria-label="Integrations"
        >
          <span className="sidebar-link-icon"><IconIntegration /></span>
          <span className="sidebar-link-label">Integrations</span>
        </Link>

        <Link
          href="/support"
          className={`sidebar-link ${isActive("/support") ? "sidebar-link--active" : ""}`}
          title="Support"
          aria-label="Support"
        >
          <span className="sidebar-link-icon"><IconHeadset /></span>
          <span className="sidebar-link-label">Support</span>
        </Link>

        <Link
          href="/agents"
          className={`sidebar-link ${isActive("/agents") ? "sidebar-link--active" : ""}`}
          title="AI Agents"
          aria-label="AI Agents"
        >
          <span className="sidebar-link-icon"><IconRobot /></span>
          <span className="sidebar-link-label">AI Agents</span>
        </Link>

        {/* Separator line */}
        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 8px" }} />

        {/* ── Section 3: Settings ── */}
        <Link
          href="/settings"
          className={`sidebar-link ${isActive("/settings") ? "sidebar-link--active" : ""}`}
          title="Settings"
          aria-label="Settings"
        >
          <span className="sidebar-link-icon"><IconHollowGear /></span>
          <span className="sidebar-link-label">Settings</span>
        </Link>

      </nav>

      {/* Footer Logout */}
      <div className="sidebar-footer" style={{ borderTop: "none", padding: "10px", display: "flex", flexDirection: "column", gap: "6px", alignItems: isExpanded ? "stretch" : "center" }}>
        {/* Logout Button */}
        <button
          type="button"
          className="sidebar-link sidebar-link--muted"
          title="Logout"
          aria-label="Logout"
          onClick={handleLogout}
          style={{ width: "100%" }}
        >
          <span className="sidebar-link-icon"><IconLogout /></span>
          <span className="sidebar-link-label">Logout</span>
        </button>
      </div>

      {/* Floating Toggle Button sitting on the sidebar edge line */}
      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={handleToggle}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        data-tooltip={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isExpanded ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sidebarIconGrad)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>
    </aside>
  );
}
