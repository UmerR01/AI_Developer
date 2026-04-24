"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { clearStoredSession } from "../../auth/session";
import type { Role } from "../types";

interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  roles: Role[];
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.4" fill="currentColor" opacity="0.95" />
      <rect x="13" y="4" width="7" height="10" rx="1.4" fill="currentColor" opacity="0.65" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" fill="currentColor" opacity="0.65" />
      <rect x="13" y="16" width="7" height="4" rx="1.4" fill="currentColor" opacity="0.95" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 7.8c0-1.1.9-2 2-2h4l1.6 1.7h7.4c1.1 0 2 .9 2 2v6.8c0 1.1-.9 2-2 2H5.5c-1.1 0-2-.9-2-2V7.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17.2" cy="9.4" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <path d="M14.7 18a3.3 3.3 0 0 1 5.8-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 7 2.2 2.3L9.5 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 7h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m4 13 2.2 2.3 3.3-3.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 13h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m4 19 2.2 2.3 3.3-3.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 19h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 18c1.4-2.5 3.2-3.7 6-3.7s4.6 1.2 6 3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v4M16 5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 9h10v2.2a5 5 0 0 1-10 0V9Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 16v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 5.2v2.1M12 16.7v2.1M5.2 12h2.1M16.7 12h2.1M7.3 7.3l1.5 1.5M15.2 15.2l1.5 1.5M16.7 7.3l-1.5 1.5M8.8 15.2l-1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardIcon />, path: "/dashboard", roles: ["admin", "developer", "qa", "support"] },
  { key: "projects", label: "Projects", icon: <FolderIcon />, path: "/projects", roles: ["admin", "developer", "qa"] },
  { key: "member", label: "Member", icon: <MembersIcon />, path: "/member", roles: ["admin", "developer", "qa"] },
  { key: "tasks", label: "Tasks", icon: <TasksIcon />, path: "/tasks", roles: ["admin", "developer", "qa"] },
  { key: "support", label: "Support", icon: <SupportIcon />, path: "/support", roles: ["admin", "developer", "qa", "support"] },
  { key: "integrations", label: "Integrations", icon: <PlugIcon />, path: "/settings/integrations", roles: ["admin", "developer"] },
  { key: "settings", label: "Settings", icon: <ProfileIcon />, path: "/settings", roles: ["admin", "developer", "qa", "support"] },
];

interface DashboardSidebarProps {
  activeRole: Role;
}

function isPathActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) {
    return true;
  }
  if (itemPath === "/settings") {
    return false;
  }
  return itemPath !== "/" && pathname.startsWith(`${itemPath}/`);
}

export function DashboardSidebar({ activeRole }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(activeRole));

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-logo" title="AI-Developer">
        AI
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {visibleItems.map((item) => (
          <Link
            key={item.key}
            href={item.path}
            className={`sidebar-item ${isPathActive(pathname, item.path) ? "active" : ""}`}
            title={item.label}
          >
            <span className="sidebar-icon" aria-hidden="true">
              {item.icon}
            </span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-future">
        <button type="button" className="sidebar-item future" title="Logout" onClick={handleLogout}>
          <span className="sidebar-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20H10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M14 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>
    </aside>
  );
}
