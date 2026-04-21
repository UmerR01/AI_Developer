"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getStoredAccessToken, getStoredUsername } from "../../auth/session";
import { DashboardSidebar } from "../../dashboard/components/DashboardSidebar";
import { DashboardTopBar } from "../../dashboard/components/DashboardTopBar";
import { DASHBOARD_DATA } from "../../dashboard/data/mockDashboardData";
import type { Account } from "../../dashboard/types";
import "../../dashboard/dashboard.css";
import "../projects.css";
import { ProjectsWorkspace } from "./ProjectsWorkspace";

interface ProjectsPageShellProps {
  selectedProjectId?: string;
}

export function ProjectsPageShell({ selectedProjectId }: ProjectsPageShellProps) {
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

  if (activeAccount.role === "support") {
    return (
      <main className="dashboard-shell">
        <DashboardSidebar activeRole={activeAccount.role} />
        <section className="dashboard-main">
          <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Projects" />
          <div className="dashboard-scroll-area">
            <section className="dashboard-card">
              <div className="card-head">
                <h2>Projects Access</h2>
              </div>
              <p className="team-subtitle">Support role has no Projects workspace access in this phase.</p>
              <p className="team-subtitle">
                Continue in <Link href="/support">Support Ticket workspace</Link>.
              </p>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar activeRole={activeAccount.role} />

      <section className="dashboard-main">
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Projects" />

        <div className="dashboard-scroll-area">
          <ProjectsWorkspace selectedProjectId={selectedProjectId} />
        </div>
      </section>
    </main>
  );
}
