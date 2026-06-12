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

function IconLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1.5" y="1.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="11" y="1.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="1.5" y="11" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="11" y="11" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 Q12 3 19.5 8.5 Q21 9.5 20.5 11 L17.8 20 Q17.3 21.5 15.8 21.5 L8.2 21.5 Q6.7 21.5 6.2 20 L3.5 11 Q3 9.5 4.5 8.5 Z" />
      <line x1="9.5" y1="15" x2="14.5" y2="15" strokeWidth="1.8" />
    </svg>
  );
}

function IconNexterse() {
  // Regular hexagon: R=9, center(12,12), flat top/bottom, all sides = 9 units
  // Vertices: top-right(16.5,4.2) top-left(7.5,4.2) left(3,12)
  //           bottom-left(7.5,19.8) bottom-right(16.5,19.8) right(21,12)
  // Corner trim = 1.3 along each edge
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.2 4.2 Q16.5 4.2 17.15 5.33 L20.35 10.87 Q21 12 20.35 13.13 L17.15 18.67 Q16.5 19.8 15.2 19.8 L8.8 19.8 Q7.5 19.8 6.85 18.67 L3.65 13.13 Q3 12 3.65 10.87 L6.85 5.33 Q7.5 4.2 8.8 4.2 Z" />
      {/* N-wave pulled inward — stays ≥2 units from every hexagon edge */}
      <path d="M8 16 C8 11.5 10 9.5 11.5 10.5 C13 11.5 13 15.5 14.5 15.5 C16 15.5 17 11 16.5 9" />
    </svg>
  );
}

function IconMembers() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <clipPath id="members-back-clip">
          <rect x="13" y="0" width="11" height="24" />
        </clipPath>
      </defs>
      {/* Back person — left side clipped so it doesn't show behind the front person */}
      <g clipPath="url(#members-back-clip)">
        <circle cx="16" cy="8.5" r="3" />
        <path d="M22 20.5a6 6 0 0 0-12 0" />
      </g>
      {/* Front person */}
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M1.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth="2.2" />
    </svg>
  );
}

function IconConnections() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5.5" r="2.8" />
      <circle cx="6" cy="5.5" r="2.8" />
      <circle cx="6" cy="18.5" r="2.8" />
      <line x1="6" y1="8.3" x2="6" y2="15.7" />
      <path d="M18 8.3a9 9 0 0 1-9 9.7H6" />
    </svg>
  );
}

function IconSupport() {
  // Hexagon (r=9, center 12,12) — only corner brackets, no full edges
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.8 9.7 L19.8 7.5 L17.9 6.4" />
      <path d="M13.9 4.1 L12 3 L10.1 4.1" />
      <path d="M6.1 6.4 L4.2 7.5 L4.2 9.7" />
      <path d="M4.2 14.3 L4.2 16.5 L6.1 17.6" />
      <path d="M10.1 19.9 L12 21 L13.9 19.9" />
      <path d="M17.9 17.6 L19.8 16.5 L19.8 14.3" />
      {/* Y: two arms from upper-left/upper-right converging at center, stem goes down */}
      <path d="M8.5 8 L12 12 L15.5 8 M12 12 L12 16.5" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#icon-sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h11M17 9l3 3-3 3" />
      <path d="M14 5.5A8.5 8.5 0 1 0 14 18.5" />
    </svg>
  );
}

const NAV_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <IconHome />,        path: "/dashboard",  roles: ["admin", "developer", "qa", "support"] },
  { key: "projects",  label: "Projects",  icon: <IconNexterse />,    path: "/projects",   roles: ["admin", "developer", "qa"] },
  { key: "member",    label: "Members",   icon: <IconMembers />,     path: "/member",     roles: ["admin", "developer", "qa"] },
  { key: "tasks",     label: "Tasks",     icon: <IconCalendar />,    path: "/tasks",      roles: ["admin", "developer", "qa"] },
  { key: "agents",    label: "AI Agents", icon: <IconConnections />, path: "/agents",     roles: ["admin", "developer", "qa"] },
  { key: "support",   label: "Support",   icon: <IconSupport />,     path: "/support",    roles: ["admin", "developer", "qa", "support"] },
  { key: "settings",  label: "Settings",  icon: <IconSettings />,    path: "/settings",   roles: ["admin", "developer", "qa", "support"] },
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

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(activeRole));

  const handleLogout = () => {
    clearStoredSession();
    router.push("/login");
  };

  return (
    <aside className="dashboard-sidebar sidebar--collapsed">
      {/* Gradient definition shared by all icon strokes */}
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden="true">
        <defs>
          <linearGradient id="icon-sg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#2e3948" />
            <stop offset="33%"  stopColor="#9da7b6" />
            <stop offset="67%"  stopColor="#858f9e" />
            <stop offset="100%" stopColor="#636a79" />
          </linearGradient>
        </defs>
      </svg>

      <div className="sidebar-header">
        <div className="sidebar-logo-btn" aria-label="AI Developer">
          <span className="sidebar-logo-mark" aria-hidden="true">
            <IconLogo />
          </span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const active = isPathActive(pathname, item.path);
          const hasDividerAfter = item.key === "tasks" || item.key === "support";
          return (
            <div key={item.key} className="sidebar-nav-item-wrap">
              <Link
                href={item.path}
                className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
                title={item.label}
                aria-label={item.label}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
              </Link>
              {hasDividerAfter && <div className="sidebar-nav-divider" />}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-link sidebar-link--muted"
          title="Logout"
          aria-label="Logout"
          onClick={handleLogout}
        >
          <span className="sidebar-link-icon"><IconLogout /></span>
        </button>
      </div>
    </aside>
  );
}
