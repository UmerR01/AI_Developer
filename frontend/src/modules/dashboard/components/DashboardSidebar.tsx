"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearStoredSession } from "../../auth/session";

/* ── Custom SVG Icons replicating reference crop exactly ── */

function IconLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      {/* Checkerboard square wave pattern */}
      <rect x="4" y="13" width="3.5" height="3.5" rx="0.7" />
      <rect x="8.5" y="7.5" width="3.5" height="3.5" rx="0.7" />
      <rect x="13" y="13" width="3.5" height="3.5" rx="0.7" />
      <rect x="17.5" y="7.5" width="3.5" height="3.5" rx="0.7" />
    </svg>
  );
}

function IconHomePentagon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L22 9 L18 21 L6 21 L2 9 Z" />
      <circle cx="12" cy="13" r="1.8" fill="currentColor" />
    </svg>
  );
}

function IconAnalyticsCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 14 l3.5-3.5 2.5 2.5 4.5-4.5" />
    </svg>
  );
}

function IconPeopleGroup() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Group outline */}
      <path d="M17 21v-2a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 21v-1.8a3 3 0 0 0-2.2-2.9" />
      <circle cx="17.5" cy="7" r="2.5" />
    </svg>
  );
}

function IconCalendarGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="5" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="7" y="13" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="11" y="13" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="15" y="13" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="7" y="17" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="11" y="17" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="15" y="17" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBranchMerge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M6 9v7a3 3 0 0 0 3 3h6" />
      <path d="M18 9v6" />
    </svg>
  );
}

function IconHexMesh() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <line x1="12" y1="2" x2="12" y2="8.5" />
      <line x1="2" y1="8.5" x2="12" y2="12" />
      <line x1="22" y1="8.5" x2="12" y2="12" />
      <line x1="12" y1="22" x2="12" y2="15.5" />
      <line x1="2" y1="15.5" x2="12" y2="12" />
      <line x1="22" y1="15.5" x2="12" y2="12" />
    </svg>
  );
}

function IconHollowGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
    <aside className="dashboard-sidebar sidebar--collapsed" aria-label="Sidebar navigation">
      {/* Logo Wrapper */}
      <div className="sidebar-header" style={{ padding: "18px 0 12px" }}>
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
            color: "#fff"
          }}
        >
          <IconLogo />
        </Link>
      </div>

      {/* Nav Link List */}
      <nav className="sidebar-nav" aria-label="Primary navigation" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
        
        {/* Section 1 */}
        <Link
          href="/dashboard"
          className={`sidebar-link ${isActive("/dashboard") ? "sidebar-link--active" : ""}`}
          title="Dashboard"
          aria-label="Dashboard"
        >
          <span className="sidebar-link-icon"><IconHomePentagon /></span>
        </Link>

        <Link
          href="/projects"
          className={`sidebar-link ${isActive("/projects") ? "sidebar-link--active" : ""}`}
          title="Projects"
          aria-label="Projects"
        >
          <span className="sidebar-link-icon"><IconAnalyticsCircle /></span>
        </Link>

        <Link
          href="/member"
          className={`sidebar-link ${isActive("/member") ? "sidebar-link--active" : ""}`}
          title="Members"
          aria-label="Members"
        >
          <span className="sidebar-link-icon"><IconPeopleGroup /></span>
        </Link>

        <Link
          href="/tasks"
          className={`sidebar-link ${isActive("/tasks") ? "sidebar-link--active" : ""}`}
          title="Tasks"
          aria-label="Tasks"
        >
          <span className="sidebar-link-icon"><IconCalendarGrid /></span>
        </Link>

        {/* Separator line */}
        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 8px" }} />

        {/* Section 2 */}
        <Link
          href="/support"
          className={`sidebar-link ${isActive("/support") ? "sidebar-link--active" : ""}`}
          title="Support"
          aria-label="Support"
        >
          <span className="sidebar-link-icon"><IconBranchMerge /></span>
        </Link>

        <Link
          href="/agents"
          className={`sidebar-link ${isActive("/agents") ? "sidebar-link--active" : ""}`}
          title="AI Agents"
          aria-label="AI Agents"
        >
          <span className="sidebar-link-icon"><IconHexMesh /></span>
        </Link>

        {/* Separator line */}
        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 8px" }} />

        {/* Section 3 */}
        <Link
          href="/settings"
          className={`sidebar-link ${isActive("/settings") ? "sidebar-link--active" : ""}`}
          title="Settings"
          aria-label="Settings"
        >
          <span className="sidebar-link-icon"><IconHollowGear /></span>
        </Link>

      </nav>

      {/* Logout */}
      <div className="sidebar-footer" style={{ borderTop: "none", padding: "10px 10px 20px" }}>
        <button
          type="button"
          className="sidebar-link sidebar-link--muted"
          title="Logout"
          aria-label="Logout"
          onClick={handleLogout}
          style={{ width: "44px", height: "44px" }}
        >
          <span className="sidebar-link-icon"><IconLogout /></span>
        </button>
      </div>
    </aside>
  );
}
