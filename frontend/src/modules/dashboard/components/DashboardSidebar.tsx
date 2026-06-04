"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { clearStoredSession } from "../../auth/session";
import type { Role } from "../types";

interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  roles: Role[];
}

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconProjects() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconMembers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="17" cy="7" r="3" strokeDasharray="1 2.5" />
      <path d="M21 21v-2a3 3 0 0 0-2-2.83" opacity="0.5" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconBot() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="2.5" />
      <path d="M12 2v6" />
      <circle cx="8.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconIntegrations() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.15 2.15" />
      <path d="M16.25 16.25l2.15 2.15" />
      <path d="M5.6 18.4l2.15-2.15" />
      <path d="M16.25 7.75l2.15-2.15" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <IconDashboard />, path: "/dashboard", roles: ["admin", "developer", "qa", "support"] },
  { key: "projects", label: "Projects", icon: <IconProjects />, path: "/projects", roles: ["admin", "developer", "qa"] },
  { key: "member", label: "Members", icon: <IconMembers />, path: "/member", roles: ["admin", "developer", "qa"] },
  { key: "tasks", label: "Tasks", icon: <IconTasks />, path: "/tasks", roles: ["admin", "developer", "qa"] },
  { key: "support", label: "Support", icon: <IconSupport />, path: "/support", roles: ["admin", "developer", "qa", "support"] },
  { key: "agents", label: "AI Agents", icon: <IconBot />, path: "/agents", roles: ["admin", "developer", "qa"] },
  { key: "integrations", label: "Integrations", icon: <IconIntegrations />, path: "/settings/integrations", roles: ["admin", "developer"] },
  { key: "settings", label: "Settings", icon: <IconSettings />, path: "/settings", roles: ["admin", "developer", "qa", "support"] },
];

interface DashboardSidebarProps {
  activeRole: Role;
}

function isPathActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true;
  if (itemPath === "/settings") return false;
  return itemPath !== "/" && pathname.startsWith(`${itemPath}/`);
}

export function DashboardSidebar({ activeRole }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(activeRole));

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  return (
    <aside className={`dashboard-sidebar ${expanded ? "sidebar--expanded" : "sidebar--collapsed"}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-logo"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <span className="sidebar-logo-mark">A</span>
          {expanded && <span className="sidebar-logo-text">AI-Dev</span>}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const active = isPathActive(pathname, item.path);
          return (
            <Link
              key={item.key}
              href={item.path}
              className={`sidebar-link ${active ? "sidebar-link--active" : ""}`}
              title={expanded ? undefined : item.label}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {expanded && <span className="sidebar-link-label">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-link sidebar-link--muted"
          title="Logout"
          onClick={handleLogout}
        >
          <span className="sidebar-link-icon"><IconLogout /></span>
          {expanded && <span className="sidebar-link-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
