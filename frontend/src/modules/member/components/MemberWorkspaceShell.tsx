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
import "../member.css";

type MemberRoleFilter = "all" | "admin" | "developer" | "qa" | "pending";
type MemberStatusFilter = "all" | "active" | "pending";
type MemberView = "grid" | "list";
type MemberStatus = "active" | "pending";

interface MemberTask {
  id: string;
  name: string;
  projectName: string;
  status: "todo" | "in_progress" | "in_review" | "done";
}

interface MemberRecord extends Account {
  status: MemberStatus;
  joinedDate: string;
  tasksAssigned: number;
  assignedTasks: MemberTask[];
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M16.6 16.6 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h14M6 12h14M6 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
      <circle cx="3" cy="17" r="1.2" fill="currentColor" />
    </svg>
  );
}

function PlusUserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M4 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" fill="none" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const MEMBER_TASKS_BY_USERNAME: Record<string, MemberTask[]> = {
  ibrahim: [
    { id: "m-task-1", name: "Approve QA review queue", projectName: "AI Agent Workspace", status: "in_review" },
    { id: "m-task-2", name: "Finalize sprint roadmap", projectName: "Projects Module Foundation", status: "in_progress" },
    { id: "m-task-3", name: "Review deployment checklist", projectName: "Testing and QC Suite", status: "done" },
  ],
  ismail: [
    { id: "m-task-4", name: "Implement split-panel task UI", projectName: "Projects Module Foundation", status: "in_progress" },
    { id: "m-task-5", name: "Refactor graph caching", projectName: "AI Agent Workspace", status: "todo" },
    { id: "m-task-6", name: "Resolve review comments", projectName: "AI Agent Workspace", status: "in_review" },
  ],
  zahid: [
    { id: "m-task-7", name: "Regression review pass", projectName: "Testing and QC Suite", status: "in_review" },
    { id: "m-task-8", name: "Validate QA push drafts", projectName: "AI Agent Workspace", status: "todo" },
  ],
  faizan: [
    { id: "m-task-9", name: "Audit release check matrix", projectName: "Testing and QC Suite", status: "in_review" },
    { id: "m-task-10", name: "Review timeline integrity", projectName: "Support Workflow Revamp", status: "todo" },
  ],
  ai_dev: [{ id: "m-task-11", name: "Triage incoming support issues", projectName: "Support Workflow Revamp", status: "in_progress" }],
};

const JOINED_DATE_BY_USERNAME: Record<string, string> = {
  ibrahim: "Nov 2023",
  ismail: "Jan 2024",
  zahid: "Feb 2024",
  faizan: "Feb 2024",
  ai_dev: "Mar 2024",
};

const STATUS_BY_USERNAME: Record<string, MemberStatus> = {
  ibrahim: "active",
  ismail: "active",
  zahid: "active",
  faizan: "active",
  ai_dev: "pending",
};

function roleLabel(role: Account["role"]): string {
  if (role === "admin") {
    return "Admin";
  }
  if (role === "developer") {
    return "Developer";
  }
  if (role === "qa") {
    return "QA";
  }
  return "Support";
}

export function MemberWorkspaceShell() {
  const router = useRouter();

  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState("ibrahim");

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [viewMode, setViewMode] = useState<MemberView>("grid");

  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);

  const [memberRoles, setMemberRoles] = useState<Record<string, Account["role"]>>({});
  const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberStatus>>({});
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [inviteProject, setInviteProject] = useState("");

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

  const members = useMemo<MemberRecord[]>(() => {
    return DASHBOARD_DATA.accounts.map((account) => {
      const tasks = MEMBER_TASKS_BY_USERNAME[account.username] ?? [];
      return {
        ...account,
        status: STATUS_BY_USERNAME[account.username] ?? "active",
        joinedDate: JOINED_DATE_BY_USERNAME[account.username] ?? "Jan 2024",
        tasksAssigned: tasks.length,
        assignedTasks: tasks,
      };
    });
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const currentRole = memberRoles[member.id] ?? member.role;
      const currentStatus = memberStatuses[member.id] ?? member.status;

      if (roleFilter === "pending") {
        if (currentStatus !== "pending") return false;
      } else if (roleFilter !== "all" && currentRole !== roleFilter) {
        return false;
      }

      if (statusFilter !== "all" && currentStatus !== statusFilter) {
        return false;
      }

      if (!searchText.trim()) {
        return true;
      }

      const normalized = searchText.trim().toLowerCase();
      return (
        member.displayName.toLowerCase().includes(normalized) ||
        member.username.toLowerCase().includes(normalized) ||
        member.email.toLowerCase().includes(normalized)
      );
    });
  }, [members, roleFilter, searchText, statusFilter, memberRoles, memberStatuses]);

  const openProfile = (member: MemberRecord) => {
    setSelectedMember(member);
    setMenuOpenForId(null);
  };

  const getMemberRole = (member: MemberRecord): Account["role"] => {
    return memberRoles[member.id] ?? member.role;
  };

  const getMemberStatus = (member: MemberRecord): MemberStatus => {
    return memberStatuses[member.id] ?? member.status;
  };

  const handleRoleChange = (memberId: string, newRole: Account["role"]) => {
    setMemberRoles((prev) => ({ ...prev, [memberId]: newRole }));
    setRoleDropdownOpen(null);
  };

  const handleStatusChange = (memberId: string, newStatus: MemberStatus) => {
    setMemberStatuses((prev) => ({ ...prev, [memberId]: newStatus }));
    setStatusDropdownOpen(null);
  };

  const profileStats = useMemo(() => {
    if (!selectedMember) {
      return { done: 0, inReview: 0, pending: 0 };
    }

    return {
      done: selectedMember.assignedTasks.filter((task) => task.status === "done").length,
      inReview: selectedMember.assignedTasks.filter((task) => task.status === "in_review").length,
      pending: selectedMember.assignedTasks.filter((task) => task.status === "todo" || task.status === "in_progress").length,
    };
  }, [selectedMember]);

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
          <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Member" />
          <div className="dashboard-scroll-area">
            <section className="dashboard-card">
              <div className="card-head">
                <h2>Access</h2>
              </div>
              <p className="team-subtitle">Support role does not have Member management access in this phase.</p>
              <p className="team-subtitle">
                Continue in <Link href="/support">Support workspace</Link>.
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
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Member" />

        <div className="dashboard-scroll-area">
          <section className="member-page-head">
            <div className="member-title-group">
            </div>

            <button type="button" className="member-invite-btn" onClick={() => setInviteModalOpen(true)}>
              <PlusUserIcon />
              Invite Member
            </button>
          </section>

          <section className="member-filters-wrap">
            <label className="member-search-input" aria-label="Search members">
              <SearchIcon />
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search members..."
              />
            </label>

            <div className="member-filter-controls">
              <div className="member-filter-select-wrap">
                <select
                  className="member-filter-select"
                  value={roleFilter === "pending" ? "all" : roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as MemberRoleFilter)}
                  aria-label="Filter by role"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                  <option value="qa">QA</option>
                </select>
              </div>

              <div className="member-filter-select-wrap">
                <select
                  className="member-filter-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as MemberStatusFilter)}
                  aria-label="Filter by status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="member-view-toggle" aria-label="View mode">
                <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
                  <GridIcon />
                </button>
                <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
                  <ListIcon />
                </button>
              </div>

            </div>
          </section>

          {viewMode === "grid" ? (
            <section className="member-grid" aria-label="Members grid view">
              {filteredMembers.map((member) => (
                <article key={member.id} className="member-card" onClick={() => openProfile(member)}>
                  <img src={member.avatarUrl} alt={member.displayName} className="member-card-avatar" />
                  <strong>{member.displayName}</strong>
                  <span className={`member-role-chip role-${member.role}`}>{roleLabel(member.role)}</span>
                  <p className="member-status-text">
                    <span className={`status-dot ${member.status === "active" ? "active" : "pending"}`} />
                    {member.status === "active" ? "Active" : (
                      <>Pending <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: 4, verticalAlign: "-2px"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></>
                    )}
                  </p>
                  <p className="member-task-caption">{member.tasksAssigned} tasks assigned</p>

                  <div className="member-card-actions">
                    <button type="button" className="member-view-profile-btn" onClick={() => openProfile(member)}>
                      View Profile
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="member-list-wrap" aria-label="Members list view">
              {filteredMembers.map((member) => (
                <article key={member.id} className="member-list-row" onClick={() => openProfile(member)}>
                  <div className="member-list-main">
                    <img src={member.avatarUrl} alt={member.displayName} className="member-list-avatar" />
                    <strong>{member.displayName}</strong>
                  </div>

                  <div className="member-role-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`member-role-chip role-${getMemberRole(member)} member-dropdown-btn`}
                      onClick={() => setRoleDropdownOpen(roleDropdownOpen === member.id ? null : member.id)}
                    >
                      {roleLabel(getMemberRole(member))}
                    </button>
                    {roleDropdownOpen === member.id ? (
                      <div className="member-dropdown-menu role-menu">
                        {(["admin", "developer", "qa", "support"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            className={`member-dropdown-item ${getMemberRole(member) === role ? "active" : ""}`}
                            onClick={() => handleRoleChange(member.id, role)}
                          >
                            {roleLabel(role)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="member-status-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="member-status-dropdown-btn"
                      onClick={() => setStatusDropdownOpen(statusDropdownOpen === member.id ? null : member.id)}
                    >
                      <span className={`status-dot ${getMemberStatus(member) === "active" ? "active" : "pending"}`} />
                      {getMemberStatus(member) === "active" ? "Active" : "Pending"}
                    </button>
                    {statusDropdownOpen === member.id ? (
                      <div className="member-dropdown-menu status-menu">
                        <button
                          type="button"
                          className={`member-dropdown-item ${getMemberStatus(member) === "active" ? "active" : ""}`}
                          onClick={() => handleStatusChange(member.id, "active")}
                        >
                          <span className="status-dot active" />
                          Active
                        </button>
                        <button
                          type="button"
                          className={`member-dropdown-item ${getMemberStatus(member) === "pending" ? "active" : ""}`}
                          onClick={() => handleStatusChange(member.id, "pending")}
                        >
                          <span className="status-dot pending" />
                          Pending
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <span className="member-list-tasks">{member.tasksAssigned} tasks</span>
                  <span className="member-list-joined">Joined {member.joinedDate}</span>
                  <div className="member-menu-wrap">
                    <button
                      type="button"
                      className="member-menu-btn"
                      aria-label="Open member actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpenForId((current) => (current === member.id ? null : member.id));
                      }}
                    >
                      <DotsIcon />
                    </button>
                    {menuOpenForId === member.id ? (
                      <div className="member-menu-dropdown">
                        <button type="button">Remove from Team</button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </section>

      {selectedMember ? (
        <div className="member-drawer-backdrop" onClick={() => setSelectedMember(null)}>
          <aside className="member-drawer" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="member-drawer-close" aria-label="Close profile" onClick={() => setSelectedMember(null)}>
              <CloseIcon />
            </button>

            <div className="member-drawer-top">
              <img src={selectedMember.avatarUrl} alt={selectedMember.displayName} className="member-drawer-avatar" />
              <h3>{selectedMember.displayName}</h3>
              <span className={`member-role-chip role-${selectedMember.role}`}>{roleLabel(selectedMember.role)}</span>
              <p className="member-status-text">
                <span className={`status-dot ${selectedMember.status === "active" ? "active" : "pending"}`} />
                {selectedMember.status === "active" ? "Active" : "Pending"}
              </p>

              <p className="member-contact-row">
                <EmailIcon />
                {selectedMember.email}
              </p>
              <p className="member-contact-row">
                <CalendarIcon />
                {selectedMember.status === "active" ? `Joined ${selectedMember.joinedDate}` : `Invited ${selectedMember.joinedDate}`}
              </p>
              <p className="member-contact-row text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                Invited by: Admin Account
              </p>
            </div>

            <section className="member-summary-block">
              <h4>Activity Summary</h4>
              <div className="member-summary-grid">
                <article>
                  <strong>{profileStats.done}</strong>
                  <span>Completed</span>
                </article>
                <article>
                  <strong>{profileStats.inReview}</strong>
                  <span>In Review</span>
                </article>
                <article>
                  <strong>{profileStats.pending}</strong>
                  <span>Pending</span>
                </article>
              </div>
            </section>

            <section className="member-assigned-block">
              <div className="member-assigned-head">
                <h4>Assigned Tasks</h4>
                <span>{selectedMember.assignedTasks.length}</span>
              </div>
              <ul>
                {selectedMember.assignedTasks.map((task) => (
                  <li key={task.id}>
                    <span className={`member-task-status status-${task.status}`}>{task.status.replace("_", " ")}</span>
                    <strong>{task.name}</strong>
                    <em>{task.projectName}</em>
                  </li>
                ))}
              </ul>
              <Link href="/tasks" className="member-view-all-link">
                View all tasks
              </Link>
            </section>
          </aside>
        </div>
      ) : null}

      {inviteModalOpen ? (
        <div className="member-invite-overlay" role="dialog" aria-modal="true" aria-label="Invite member" onClick={(event) => event.target === event.currentTarget && setInviteModalOpen(false)}>
          <section className="member-invite-drawer">
            <div className="member-invite-header">
              <h3>Invite Member</h3>
              <button type="button" className="member-invite-close" onClick={() => setInviteModalOpen(false)} aria-label="Close invite drawer">
                <CloseIcon />
              </button>
            </div>

            <div className="member-invite-body">
              <div className="member-invite-field">
                <label className="member-invite-label" htmlFor="invite-name">Name</label>
                <input
                  id="invite-name"
                  className="member-invite-input"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className="member-invite-field">
                <label className="member-invite-label" htmlFor="invite-email">Email Address</label>
                <input
                  id="invite-email"
                  className="member-invite-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>

              <div className="member-invite-field-row">
                <div className="member-invite-field">
                  <label className="member-invite-label" htmlFor="invite-role">Role</label>
                  <select id="invite-role" className="member-invite-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="developer">Developer</option>
                    <option value="qa">QA</option>
                  </select>
                </div>
                <div className="member-invite-field">
                  <label className="member-invite-label" htmlFor="invite-project">Assign to Project</label>
                  <select id="invite-project" className="member-invite-select" value={inviteProject} onChange={(e) => setInviteProject(e.target.value)}>
                    <option value="">Select a project...</option>
                    <option value="p1">AI Agent Workspace</option>
                    <option value="p2">Projects Module Foundation</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="member-invite-footer">
              <button type="button" className="member-invite-btn-ghost" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="member-invite-btn-primary" onClick={() => {
                setInviteModalOpen(false);
                setInviteName("");
                setInviteEmail("");
              }}>
                Send Invite
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
