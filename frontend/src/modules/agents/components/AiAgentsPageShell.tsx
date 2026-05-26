"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getStoredAccessToken, getStoredUsername } from "../../auth/session";
import { DashboardSidebar } from "../../dashboard/components/DashboardSidebar";
import { DashboardTopBar } from "../../dashboard/components/DashboardTopBar";
import { DASHBOARD_DATA } from "../../dashboard/data/mockDashboardData";
import type { Account } from "../../dashboard/types";
import "../../dashboard/dashboard.css";
import "../agents.css";
import { AnimatedBackground } from "../../platform/components/AnimatedBackground";
import { AiAgentsWorkspace } from "./AiAgentsWorkspace";

export function AiAgentsPageShell() {
  const router = useRouter();

  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState("ibrahim");

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
    return null;
  }

  return (
    <main className="dashboard-shell">
      <AnimatedBackground />
      <DashboardSidebar activeRole={activeAccount.role} />
      <section className="dashboard-main">
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="AI Agents" />
        <div className="dashboard-scroll-area">
          <AiAgentsWorkspace />
        </div>
      </section>
    </main>
  );
}
