"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { getStoredAccessToken, getStoredUsername } from "../../auth/session";
import { DASHBOARD_DATA } from "../data/mockDashboardData";
import type { Account } from "../types";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopBar } from "./DashboardTopBar";

interface WorkspacePlaceholderShellProps {
  title: string;
  description: string;
  children?: ReactNode;
  compact?: boolean;
}

export function WorkspacePlaceholderShell({ title, description, children, compact = false }: WorkspacePlaceholderShellProps) {
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string>("ibrahim");

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setActiveUsername(storedUsername);
    }

    setTokenReady(true);
  }, [router]);

  const activeAccount = useMemo<Account>(() => {
    return DASHBOARD_DATA.accounts.find((account) => account.username === activeUsername) ?? DASHBOARD_DATA.accounts[0];
  }, [activeUsername]);

  const roleNotifications = useMemo(() => {
    return DASHBOARD_DATA.notificationsPreview.filter((notification) => notification.visibleTo.includes(activeAccount.role));
  }, [activeAccount.role]);

  if (!tokenReady) {
    return (
      <main className="dashboard-loading-wrap">
        <section className="dashboard-loading-panel">
          <h1>Redirecting...</h1>
          <p className="dashboard-loading-info">Checking authentication state.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar activeRole={activeAccount.role} />

      <section className="dashboard-main">
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title={title} />

        <div className="dashboard-scroll-area">
          {compact ? (
            children ? children : <p className="team-subtitle">{description}</p>
          ) : (
            <section className="dashboard-card">
              <div className="card-head">
                <h2>{title}</h2>
              </div>
              {children ? children : <p className="team-subtitle">{description}</p>}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
