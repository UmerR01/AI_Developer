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

export default function DashboardPage() {
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string>("ibrahim");
  const [storageSnapshot, setStorageSnapshot] = useState(() => ({
    usedSpace: DASHBOARD_DATA.monthlyUsageGb * 1024 * 1024 * 1024,
    totalQuota: DASHBOARD_DATA.monthlyLimitGb * 1024 * 1024 * 1024,
  }));

  useEffect(() => {
    let mounted = true;

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

    async function loadStorage() {
      try {
        const currentUser = await fetchCurrentUser();
        if (!currentUser) {
          return;
        }
        const storageStats = await fetchStorageStats(currentUser.id);
        if (!mounted || !storageStats) {
          return;
        }
        setStorageSnapshot({ usedSpace: storageStats.usedSpace, totalQuota: storageStats.totalQuota });
      } catch {
        // Keep dashboard usable with current snapshot if storage fetch fails.
      }
    }

    void loadStorage();

    return () => {
      mounted = false;
    };
  }, [router]);

  const accountById = useMemo(
    () =>
      DASHBOARD_DATA.accounts.reduce<Record<string, Account>>((accumulator, account) => {
        accumulator[account.id] = account;
        return accumulator;
      }, {}),
    []
  );

  const activeAccount = useMemo(() => {
    return DASHBOARD_DATA.accounts.find((account) => account.username === activeUsername) ?? DASHBOARD_DATA.accounts[0];
  }, [activeUsername]);

  const roleNotifications = useMemo(() => {
    return DASHBOARD_DATA.notificationsPreview.filter((notification) => notification.visibleTo.includes(activeAccount.role));
  }, [activeAccount.role]);

  const teamOwner = accountById[DASHBOARD_DATA.team.ownerAccountId] ?? activeAccount;
  const teamMembers = DASHBOARD_DATA.team.memberAccountIds.map((id) => accountById[id]).filter(Boolean);

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
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Dashboard" />

        <div className="dashboard-scroll-area">
          <section className="hero-copy">
            <p>Good Morning,</p>
            <h2>{activeAccount.displayName}</h2>
          </section>

          <DashboardOverviewStrip
            pipelineSummary={DASHBOARD_DATA.pipelineSummary}
            myTasks={DASHBOARD_DATA.myTasks}
            recentActivity={DASHBOARD_DATA.recentActivity}
            notificationsPreview={roleNotifications}
          />

          <section className="dashboard-grid">
            <StorageWidget usedBytes={storageSnapshot.usedSpace} totalBytes={storageSnapshot.totalQuota} />
            <TeamPanel team={DASHBOARD_DATA.team} owner={teamOwner} members={teamMembers} />
            <StorageAccessTable projects={DASHBOARD_DATA.projects} accountById={accountById} />
          </section>
        </div>
      </section>
    </main>
  );
}
