"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchProjects } from "../../projects/api";
import { WorkspacePlaceholderShell } from "../../dashboard/components/WorkspacePlaceholderShell";
import { DASHBOARD_DATA } from "../../dashboard/data/mockDashboardData";
import {
  fetchAdminProfile,
  fetchCurrentUser,
  fetchStorageStats,
  fetchSubscriptionInfo,
  fetchTeamOverview,
  selectPlan,
} from "../../platform/api";
import type { AdminProfile, StorageStats, SubscriptionInfo, TeamOverview } from "../../platform/types";
import type { ProjectRecord } from "../../projects/types";

type SettingsTab = "account" | "storage" | "subscription" | "team";

interface SettingsWorkspaceProps {
  initialTab?: SettingsTab;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Static feature lists per plan (keyed by plan.name)
const PLAN_FEATURES: Record<string, string[]> = {
  basic: ["1 User Seat", "10GB Storage", "Community Support"],
  free: ["1 User Seat", "5GB Storage", "Community Support"],
  pro: ["Up to 5 User Seats", "50GB Storage", "Priority Email Support", "Advanced Analytics"],
  business: ["Unlimited Seats", "500GB Storage", "24/7 Phone Support", "Custom Integrations"],
  enterprise: ["Single Tenant Architecture", "Unlimited Storage", "Dedicated Account Manager", "SSO & Advanced Security"],
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  basic: "A simple starting point for individuals and small teams.",
  free: "Essential features for individuals.",
  pro: "Advanced tools for professionals.",
  business: "Scale your team with robust controls.",
  enterprise: "Dedicated infrastructure and SLA.",
};

const PLAN_POPULAR: Record<string, boolean> = {
  pro: true,
};

function toPlanKey(name: string, displayName: string): string {
  const value = `${name} ${displayName}`.toLowerCase();
  if (value.includes("enterprise")) return "enterprise";
  if (value.includes("business")) return "business";
  if (value.includes("pro")) return "pro";
  if (value.includes("basic")) return "basic";
  return "free";
}

// SVG Donut Chart
function DonutChart({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg viewBox="0 0 140 140" className="storage-donut" aria-hidden="true">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(153,181,255,0.12)" strokeWidth="16" />
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="url(#donutGrad)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <defs>
        <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5f85ff" />
          <stop offset="100%" stopColor="#4fd4b5" />
        </linearGradient>
      </defs>
      <text x="70" y="65" textAnchor="middle" className="donut-pct-label" fill="#e8efff" fontSize="20" fontWeight="700">
        {percent.toFixed(0)}%
      </text>
      <text x="70" y="83" textAnchor="middle" fill="#9db3e3" fontSize="10">
        Utilized
      </text>
    </svg>
  );
}

export function SettingsWorkspace({ initialTab = "account" }: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [teamOverview, setTeamOverview] = useState<TeamOverview | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  // Account form state
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const currentUser = await fetchCurrentUser();
        if (!currentUser) throw new Error("Unable to resolve current user.");

        const [profile, storage, subscription, projectList] = await Promise.all([
          fetchAdminProfile(currentUser.id),
          fetchStorageStats(currentUser.id),
          fetchSubscriptionInfo(currentUser.id),
          fetchProjects(),
        ]);

        let team: TeamOverview | null = null;
        if (profile?.isAdmin) {
          team = await fetchTeamOverview(currentUser.id);
        }

        if (!mounted) return;

        setAdminProfile(profile);
        setDisplayName(profile?.displayName ?? "");
        setStorageStats(storage);
        setSubscriptionInfo(subscription);
        setTeamOverview(team);
        setProjects(projectList);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  async function handleSelectPlan(planId: string) {
    if (!adminProfile) return;
    setSavingPlan(planId);
    const result = await selectPlan(adminProfile.userId, planId);
    if (result.success) {
      const [storage, subscription] = await Promise.all([
        fetchStorageStats(adminProfile.userId),
        fetchSubscriptionInfo(adminProfile.userId),
      ]);
      setStorageStats(storage);
      setSubscriptionInfo(subscription);
    } else {
      setError(result.message);
    }
    setSavingPlan(null);
  }

  const activePlan = subscriptionInfo?.subscription?.plan ?? null;

  const plansToRender = useMemo(() => {
    if (subscriptionInfo?.plans?.length) {
      return subscriptionInfo.plans;
    }
    if (activePlan) {
      return [activePlan];
    }
    return [
      { id: "free", name: "free", displayName: "Free", storageLimit: 5, maxProjects: 3, maxTeamMembers: 1, priceDisplay: "$0", isActive: false },
      { id: "pro", name: "pro", displayName: "Pro", storageLimit: 50, maxProjects: 20, maxTeamMembers: 5, priceDisplay: "$19", isActive: false },
      { id: "business", name: "business", displayName: "Business", storageLimit: 500, maxProjects: 200, maxTeamMembers: 50, priceDisplay: "$79", isActive: false },
    ];
  }, [activePlan, subscriptionInfo?.plans]);

  const visibleTeamMembers = useMemo(() => {
    if ((teamOverview?.activeMembers?.length ?? 0) > 0) {
      return teamOverview?.activeMembers ?? [];
    }
    return DASHBOARD_DATA.accounts.map((account) => ({
      id: account.id,
      userId: account.id,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      status: "active",
      invitedByName: "Admin",
      dateInvited: "2026-01-01",
      dateJoined: "2026-01-05",
    }));
  }, [teamOverview?.activeMembers]);

  const totalProjectUsage = useMemo(() => {
    return projects.reduce((accumulator, project) => accumulator + Math.max(project.usedStorage ?? 0, 0), 0);
  }, [projects]);

  const effectiveUsedSpace = useMemo(() => {
    return Math.max(storageStats?.usedSpace ?? 0, totalProjectUsage);
  }, [storageStats?.usedSpace, totalProjectUsage]);

  const effectiveTotalQuota = storageStats?.totalQuota ?? 0;
  const effectiveAvailableSpace = Math.max(effectiveTotalQuota - effectiveUsedSpace, 0);

  const usedPercent = useMemo(() => {
    if (!effectiveTotalQuota) return 0;
    return Math.min((effectiveUsedSpace / effectiveTotalQuota) * 100, 100);
  }, [effectiveTotalQuota, effectiveUsedSpace]);

  // Per-project quota percentage
  function projectQuota(proj: ProjectRecord): number {
    if (!effectiveTotalQuota) return 0;
    return Math.round((proj.usedStorage / effectiveTotalQuota) * 100);
  }

  // Status badge for project aligned with Projects workspace state labels.
  function projectStatus(proj: ProjectRecord): { label: string; cls: string } {
    if (proj.state === "Live") return { label: "Completed", cls: "badge-active" };
    if (proj.state === "In Progress" || proj.state === "In Review" || proj.state === "Pending Push" || proj.state === "Revising") {
      return { label: "In Progress", cls: "badge-progress" };
    }
    return { label: "Draft", cls: "badge-idle" };
  }

  return (
    <WorkspacePlaceholderShell title="Settings" description="Account, subscription, storage, and team administration." compact>

      <div className="st-tabs">
        {(["account", "storage", "subscription", "team"] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`st-tab${activeTab === tab ? " st-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <span className="st-tabs-line" />
      </div>

      {error && <p className="st-error">{error}</p>}
      {loading && <p className="st-loading">Loading settings data…</p>}

      {/* ══════════════════════════════════════════════════════
          ACCOUNT TAB
      ══════════════════════════════════════════════════════ */}
      {!loading && activeTab === "account" && (
        <div className="st-account-layout">

          {/* Avatar */}
          <div className="st-avatar-col">
            <div className="st-avatar-wrap">
              <div className="st-avatar-circle">
                <span className="st-avatar-initials">
                  {adminProfile?.displayName
                    ? adminProfile.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                    : "U"}
                </span>
                <button type="button" className="st-avatar-edit" aria-label="Change avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
              <p className="st-avatar-hint">Allowed formats: JPG, PNG, WebP. Max size: 2MB.</p>
            </div>
          </div>

          {/* Forms */}
          <div className="st-account-forms">

            {/* Basic Information */}
            <section className="st-form-card">
              <h3 className="st-form-card-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                Basic Information
              </h3>
              <div className="st-field">
                <label className="st-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  className="st-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>
              <div className="st-field">
                <label className="st-label" htmlFor="email">
                  Email Address
                  <span className="st-verified-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Verified
                  </span>
                </label>
                <input
                  id="email"
                  className="st-input"
                  type="email"
                  defaultValue={adminProfile?.email ?? ""}
                  readOnly
                  disabled
                />
                <p className="st-field-hint">To change your primary email, please contact support.</p>
              </div>
              <div className="st-form-actions">
                <button type="button" className="st-btn-primary">Save Changes</button>
              </div>
            </section>

            {/* Security */}
            <section className="st-form-card">
              <h3 className="st-form-card-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Security &amp; Authentication
              </h3>
              <p className="st-form-card-sub">Update your password or configure two-factor authentication.</p>
              <div className="st-field">
                <label className="st-label" htmlFor="currentPw">Current Password</label>
                <div className="st-input-wrap">
                  <input
                    id="currentPw"
                    className="st-input"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button type="button" className="st-eye-btn" onClick={() => setShowCurrentPw((v) => !v)} aria-label="Toggle visibility">
                    {showCurrentPw ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="st-pw-row">
                <div className="st-field">
                  <label className="st-label" htmlFor="newPw">New Password</label>
                  <div className="st-input-wrap">
                    <input
                      id="newPw"
                      className="st-input"
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button type="button" className="st-eye-btn" onClick={() => setShowNewPw((v) => !v)} aria-label="Toggle visibility">
                      {showNewPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="st-field">
                  <label className="st-label" htmlFor="confirmPw">Confirm New Password</label>
                  <input
                    id="confirmPw"
                    className="st-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="st-form-actions">
                <button type="button" className="st-btn-primary">Update Password</button>
              </div>
            </section>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STORAGE TAB
      ══════════════════════════════════════════════════════ */}
      {!loading && activeTab === "storage" && (
        <div className="st-storage-layout">

          {/* Top row: donut + side stats */}
          <div className="st-storage-top">
            <div className="st-cluster-card">
              <div className="st-cluster-donut">
                <DonutChart percent={usedPercent} />
              </div>
              <div className="st-cluster-info">
                <h3 className="st-cluster-title">Cluster Allocation</h3>
                <p className="st-cluster-used">
                  <strong>{formatBytes(effectiveUsedSpace)}</strong> used of{" "}
                  {formatBytes(effectiveTotalQuota)} total capacity
                </p>
                <p className="st-cluster-desc">
                  Current consumption is well within operational limits.
                  Predictive modeling suggests capacity will be reached in approximately{" "}
                  {Math.round((100 - usedPercent) / Math.max(usedPercent / 90, 0.5))} days at the current burn rate.
                </p>
              </div>
            </div>
            <div className="st-storage-side">
              <div className="st-stat-card">
                <span className="st-stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                  </svg>
                </span>
                <p className="st-stat-label">Available Capacity</p>
                <p className="st-stat-value">{formatBytes(effectiveAvailableSpace)}</p>
              </div>
              <div className="st-stat-card">
                <span className="st-stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </span>
                <p className="st-stat-label">Total Provisioned</p>
                <p className="st-stat-value">{formatBytes(effectiveTotalQuota)}</p>
              </div>
            </div>
          </div>

          {/* Project distribution table */}
          <div className="st-project-dist">
            <div className="st-project-dist-header">
              <h3 className="st-section-title">Project Distribution</h3>
              <button type="button" className="st-filter-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                Filter
              </button>
            </div>
            <table className="st-proj-table">
              <thead>
                <tr>
                  <th>Project Vector</th>
                  <th>Status</th>
                  <th>Consumption Metrics</th>
                  <th>Quota</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 8).map((proj) => {
                  const q = projectQuota(proj);
                  const st = projectStatus(proj);
                  return (
                    <tr key={proj.id}>
                      <td>
                        <span className="st-proj-icon" aria-hidden="true">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                        </span>
                        <strong>{proj.name}</strong>
                      </td>
                      <td><span className={`st-badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <div className="st-proj-metric">
                          <div className="st-proj-bar-row">
                            <span className="st-proj-mb">{formatBytes(proj.usedStorage)}</span>
                            <span className="st-proj-pct">{q}%</span>
                          </div>
                          <div className="st-proj-bar-bg">
                            <span className={`st-proj-bar-fill ${st.cls}`} style={{ width: `${q}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="st-proj-quota">{q}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Physical mount point */}
          <div className="st-mount-card">
            <div className="st-mount-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div className="st-mount-body">
              <p className="st-mount-label">Physical Mount Point</p>
              <code className="st-mount-path">/mnt/vol-us-east-1a/tenant/production/storage_pool_01</code>
            </div>
            <button type="button" className="st-copy-btn" aria-label="Copy mount path">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUBSCRIPTION TAB
      ══════════════════════════════════════════════════════ */}
      {!loading && activeTab === "subscription" && (
        <div className="st-sub-layout">

          {/* Active plan banner */}
          {activePlan && (
            <div className="st-active-plan-banner">
              <div className="st-active-plan-left">
                <h3 className="st-active-plan-name">
                  {activePlan.displayName}
                  <span className="st-active-badge">ACTIVE</span>
                </h3>
                <p className="st-active-plan-cycle">
                  Your current subscription cycle ends on{" "}
                  {subscriptionInfo?.subscription?.currentPeriodEnd
                    ? new Date(subscriptionInfo.subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </p>
              </div>
              <div className="st-active-plan-right">
                <div className="st-active-plan-price">
                  <span className="st-active-price-main">{activePlan.priceDisplay}</span>
                  <span className="st-active-price-period">Billed monthly</span>
                </div>
                <button type="button" className="st-manage-billing-btn">Manage Billing</button>
              </div>
            </div>
          )}

          {/* Available plans */}
          <h4 className="st-plans-heading">Available Plans</h4>
          <div className="st-plans-grid">
            {plansToRender.map((plan) => {
              const isActive = activePlan?.id === plan.id;
              const planKey = toPlanKey(plan.name, plan.displayName);
              const isPopular = PLAN_POPULAR[planKey];
              const features = PLAN_FEATURES[planKey] ?? ["Core plan features included"];
              const description = PLAN_DESCRIPTIONS[planKey] ?? "Built for your current workspace needs.";
              const isEnterprise = planKey === "enterprise";

              return (
                <article
                  key={plan.id}
                  className={`st-plan-card${isActive ? " st-plan-card--active" : ""}${isPopular ? " st-plan-card--popular" : ""}`}
                >
                  {isPopular && <span className="st-popular-badge">MOST POPULAR</span>}
                  <div className="st-plan-top">
                    <h3 className="st-plan-name">{plan.displayName}</h3>
                    <p className="st-plan-price">
                      {isEnterprise ? (
                        <span className="st-plan-price-custom">Custom</span>
                      ) : (
                        <>{plan.priceDisplay}<span className="st-plan-price-per">/mo</span></>
                      )}
                    </p>
                    <p className="st-plan-desc">{description}</p>
                    <button
                      type="button"
                      className={`st-plan-btn${isActive ? " st-plan-btn--active" : ""}${isEnterprise ? " st-plan-btn--enterprise" : ""}`}
                      disabled={isActive || savingPlan === plan.id}
                      onClick={() => !isEnterprise && handleSelectPlan(plan.id)}
                    >
                      {isActive
                        ? (savingPlan === plan.id ? "Saving..." : "Active Plan")
                        : isEnterprise
                          ? "Contact Sales"
                          : savingPlan === plan.id
                            ? "Saving..."
                            : "Select Plan"}
                    </button>
                  </div>
                  <hr className="st-plan-divider" />
                  <ul className="st-plan-features">
                    {features.map((feat) => (
                      <li key={feat}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TEAM TAB
      ══════════════════════════════════════════════════════ */}
      {!loading && activeTab === "team" && (
        <div className="st-team-layout">
          <div className="st-team-card">
            <div className="st-team-card-header">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Active Members
              </h3>
            </div>
            <ul className="st-team-list">
              {visibleTeamMembers.map((member) => (
                <li key={member.id} className="st-team-row">
                  <div className="st-team-avatar">{member.displayName.slice(0, 2).toUpperCase()}</div>
                  <div className="st-team-info">
                    <strong>{member.displayName}</strong>
                    <span>{member.email}</span>
                  </div>
                  <span className={`st-badge ${member.role === "admin" ? "badge-active" : "badge-idle"}`}>{member.role}</span>
                </li>
              ))}
              {visibleTeamMembers.length === 0 && (
                <li className="st-team-empty">No active members found.</li>
              )}
            </ul>
          </div>

          <div className="st-team-card">
            <div className="st-team-card-header">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Pending Invites
              </h3>
            </div>
            <ul className="st-team-list">
              {(teamOverview?.pendingInvites ?? []).map((invite) => (
                <li key={invite.id} className="st-team-row">
                  <div className="st-team-avatar st-team-avatar--invite">?</div>
                  <div className="st-team-info">
                    <strong>{invite.email}</strong>
                    <span>{invite.projectName}</span>
                  </div>
                  <span className="st-badge badge-warn">{invite.role}</span>
                </li>
              ))}
              {(teamOverview?.pendingInvites ?? []).length === 0 && (
                <li className="st-team-empty">No pending invites.</li>
              )}
            </ul>
          </div>
        </div>
      )}

    </WorkspacePlaceholderShell>
  );
}