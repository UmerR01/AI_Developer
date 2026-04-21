"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredSession } from "../../auth/session";
import type { Role } from "../types";

interface SidebarItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  roles: Role[];
}

const NAV_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "D", path: "/dashboard", roles: ["admin", "developer", "qa", "support"] },
  { key: "projects", label: "Projects", icon: "P", path: "/projects", roles: ["admin", "developer", "qa"] },
  { key: "team", label: "Team", icon: "T", path: "/team", roles: ["admin", "developer", "qa"] },
  { key: "support", label: "Support", icon: "S", path: "/support", roles: ["admin", "developer", "qa", "support"] },
  { key: "notifications", label: "Notifications", icon: "N", path: "/notifications", roles: ["admin", "developer", "qa", "support"] },
  {
    key: "subscription",
    label: "Subscription",
    icon: "$",
    path: "/settings/subscription",
    roles: ["admin", "developer"],
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: "I",
    path: "/settings/integrations",
    roles: ["admin", "developer"],
  },
  { key: "settings", label: "Profile", icon: "U", path: "/settings/profile", roles: ["admin", "developer", "qa", "support"] },
];

interface DashboardSidebarProps {
  activeRole: Role;
}

function isPathActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) {
    return true;
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
            OUT
          </span>
        </button>
      </div>
    </aside>
  );
}
