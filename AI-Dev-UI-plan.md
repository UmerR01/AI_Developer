# AI-Developer
## UI Product and Navigation Specification (Demo Scope)
Version: 1.0
Date: 2026-04-20
Status: Ready for Design and Implementation

---

## 1) Purpose
This document defines the UI system for AI-Developer based on current scope and working needs.

It answers:
- How many pages are needed now.
- What the sidebar and global layout should look like.
- How pages connect with each other.
- Which flows are primary for the demo.
- What to build first in UI priority order.

Current technical assumption:
- Frontend is Next.js.
- Backend is Django with GraphQL.
- PostgreSQL runs in Docker Compose (database only).
- Demo mode is enabled (no real integrations or real subscription billing).

---

## 2) UX Goals for Current Phase
1. Make the pipeline journey obvious from Draft to Live.
2. Keep QA to Developer to Agent loop fast and clear.
3. Ensure role-based visibility so users only see allowed actions.
4. Make demo flows stable and deterministic.
5. Keep navigation simple: few top-level choices, deep context inside project.

---

## 3) Information Architecture Summary

Primary UI layers:
1. Global app shell (sidebar + top bar + content region)
2. Primary navigation tabs (Dashboard, Projects, Team, Support Ticket, Notification)
3. Admin and preference pages (Workspace Setting, Integration, Settings/Profile)
4. Contextual in-page workspaces (project lifecycle views and ticket detail views)

Design rule:
- Project actions should happen inside project context, not spread across many top-level pages.
- Team and member administration should live in one Team workspace.

---

## 4) Total Pages Needed (Now)

Required primary page count for current demo: 9 pages

1. Login
2. Dashboard
3. Projects (all project-related work in one tab)
4. Team (teams plus members in one tab)
5. Support Ticket (single ticket workspace)
6. Notification
7. Workspace Setting
8. Integration (Mock)
9. Settings (Profile)

Contextual views (inside tabs, not separate primary pages):
- Project detail, review queue, deployments inside Projects.
- Ticket detail thread inside Support Ticket.
- Member management inside Team.

---

## 5) Route Map

Base routes:
- /login
- /dashboard
- /projects
- /projects/[projectId]
- /projects/[projectId]?view=overview|review|deployments
- /team
- /notifications
- /support
- /support?ticketId=[ticketId]
- /settings/workspace
- /settings/subscription
- /settings/integrations
- /settings/profile

Route conventions:
- Workspace scope is implied by active workspace in session.
- Projects tab contains all project sub-flows through in-page views.
- Team tab contains both team and member workflows.

---

## 6) Global Shell Design

## 6.1 Desktop Layout
- Left sidebar: primary navigation.
- Top bar: workspace switch context, global search, notifications bell, profile menu.
- Content area: page content.
- Right utility panel (optional): contextual activity feed and quick actions.

## 6.2 Mobile and Tablet Layout
- Sidebar becomes slide-over drawer.
- Top bar remains fixed with hamburger trigger.
- Projects tab uses internal segmented switcher for Overview, Review, Deployments.
- Modals become full-height bottom sheets for form-heavy actions.

## 6.3 Global States
- Loading skeleton state per page region.
- Empty state with role-based call-to-action.
- Error state with retry and support shortcut.
- Demo badge visible globally: Demo Mode (Integrations and Billing are mocked).

---

## 7) Sidebar Structure and Role Visibility

## 7.1 Sidebar Groups
Group A: Work
- Dashboard
- Projects
- Team
- Support Ticket
- Notification

Group B: Workspace
- Workspace Setting
- Subscription
- Integrations (Mock)
- Settings (Profile)

## 7.2 Role-Based Sidebar Access

Admin:
- Full access to all sidebar items.

Developer:
- Dashboard, Projects, Team, Support Ticket, Notification, Settings (Profile).
- Can open Workspace Setting in read-only mode unless explicitly delegated.
- Integrations page visible as read-only in demo.

QA:
- Dashboard, Projects, Team (read-only member controls), Support Ticket, Notification, Settings (Profile).
- No workspace-level destructive actions.

Support:
- Support Ticket, Notification, Settings (Profile).
- Dashboard appears in minimal mode (ticket and system alerts only).
- No Projects/Team workspace access.

## 7.3 Sidebar Connection Rules
- Clicking Projects opens unified project workspace (list + selected project views).
- Project context stays in Projects while switching Overview, Review, and Deployments views.
- Clicking Team opens unified team workspace (teams + members + assignments).
- Clicking Support Ticket opens ticket workspace (ticket list + selected thread).
- Settings pages are non-project scoped and do not reset active project selection.

---

## 8) Top Bar and Global Controls

Top bar components:
1. Breadcrumb path
2. Global search
3. Quick create action
4. Notifications bell
5. Presence summary
6. Profile menu

Behavior notes:
- Quick create opens context-aware modal:
  - On project pages: Create Comment or Assign Task
  - On Team page: Create Team or Invite Member
  - On support page: Create Support Ticket
- Notifications bell opens slide-over panel; full page remains at /notifications.

---

## 9) Page-by-Page Detailed Specification

## 9.1 Login
Purpose:
- Authenticate user and set workspace context.

Primary actions:
- Sign in.
- Forgot password (if implemented).

Connections:
- Success -> /dashboard.

## 9.2 Dashboard
Purpose:
- Show active work overview by role.

Sections:
- Pipeline status summary cards.
- My tasks.
- Recent project activity.
- Notifications preview.
- Storage usage widget.
- Storage access table with per-row share access action.
- Members list.

Connections:
- Project card click -> Projects tab with selected project.
- Task click -> relevant Projects or Team workspace.

## 9.3 Projects (Unified Workspace)
Purpose:
- Handle all project-related work in one tab.

Sections:
- Left panel: project list with filter/search/sort.
- Main panel: selected project workspace.
- Main panel views: Overview, Review Queue, Deployments.
- Context widgets: activity, artifacts, tasks, comment summary.
- Project header state badge and action bar.
- Team assignment shortcut link in review context.

Primary actions:
- Create Project modal.
- Open/select project.
- Start agent run.
- Add comment.
- Review and push comments.
- Deploy and rollback.

Connections:
- Create Project success -> /projects with new project selected in Draft.
- Selecting project -> /projects/[projectId].
- Switching project views -> /projects/[projectId]?view=overview|review|deployments.
- Team assignment link -> /team.

## 9.4 Team (Unified Teams and Members Workspace)
Purpose:
- Handle all team and member management in one tab.

Sections:
- Teams board/list.
- Member directory with role and presence.
- Team-to-project assignment panel.
- Team task board.

Primary actions:
- Create Team modal (Admin).
- Invite Member modal (Admin).
- Change Role modal (Admin).
- Assign Team to Project modal (Admin, Developer where permitted).

Connections:
- Assigned project link -> /projects/[projectId].
- Team-level actions remain in /team without route jump.

## 9.5 Notification
Purpose:
- Unified notification history and triage.

Sections:
- Filter by type (pipeline, comments, deploy, mentions).
- Read and unread tabs.

Primary actions:
- Mark read.
- Navigate to source event.

Connections:
- Notification click deep-links to project/team/support page.

## 9.6 Support Ticket (Single Workspace)
Purpose:
- Handle ticket list and ticket thread in one tab.

Sections:
- Left panel: ticket list with status filters.
- Right panel: selected ticket thread and metadata.
- Priority and assignee indicators.

Primary actions:
- Create Support Ticket modal.
- Change ticket status.
- Assign/escalate ticket.

Connections:
- Ticket select -> /support?ticketId=[ticketId].

## 9.7 Workspace Setting
Purpose:
- Configure workspace-level properties.

Sections:
- Workspace name/branding.
- Demo subscription and storage thresholds.

Primary actions:
- Save workspace settings.

Connections:
- Settings change emits audit and notification events.

## 9.8 Integration (Mock)
Purpose:
- Demo-facing integration catalog without real external connection.

Sections:
- Provider cards.
- Mock status and enable/disable toggles.

Primary actions:
- Mock connect/disconnect.

Connections:
- Connection state reflected on dashboard and project badges.

## 9.9 Settings (Profile)
Purpose:
- User-level account and preferences.

Sections:
- Profile fields.
- Notification preferences.
- API token placeholder (mock).

Connections:
- Preference changes affect notification behavior and UI defaults.

---

## 10) Primary UI Flows and Page Connections

## 10.1 Core Product Flow (Project Lifecycle)
1. Dashboard -> Projects
2. Projects -> Create Project modal -> selected project in Draft
3. Projects (Overview view) -> Start Agent Run -> state becomes In Progress
4. Projects (Review view) -> Review and Push comments -> state becomes Revising
5. Projects (Overview view) -> revision returns -> state becomes In Review
6. Projects (Deployments view) -> Deploy Project -> state becomes Live

## 10.2 Collaboration Flow (Members and Teams, Admin Path)
1. Team -> Create Team
2. Team -> Invite Member
3. Team -> Change Role
4. Team -> Assign Team to Project
5. Projects reflects team assignment and task ownership

## 10.3 Support Flow
1. Any page -> Support Ticket
2. Create Support Ticket
3. Ticket thread updates in same tab

---

## 11) Local Navigation Within Project Context

Projects workspace internal tabs:
- Overview
- Review Queue
- Deployments

Secondary navigation blocks in Overview:
- Artifacts
- Comments
- Activity
- Tasks

Rule:
- Keep user inside project context for all project operations to reduce context switching.

---

## 12) Modal Usage by Page

Projects:
- Create Project
- Draft Preview Confirmation
- Add Comment
- Assign Task
- Deploy Project
- Review Comment
- Push Approved Comments
- Rollback Deployment

Team:
- Create Team
- Invite Member
- Change Role
- Assign Team to Project

Support Ticket:
- Create Support Ticket
- Update Ticket Status
- Escalate Ticket

Settings:
- Demo billing info modal (non-functional warning)

---

## 13) UI Component System (Starter)

Core components:
- AppShell
- SidebarNav
- TopBar
- PipelineStatusHeader
- DataTable
- ActivityTimeline
- CommentThread
- ReviewQueueList
- DeploymentTimeline
- NotificationPanel
- SupportThread
- ModalManager

Shared interaction primitives:
- Status chips
- Role badges
- Presence indicators
- Empty-state cards
- Confirm action dialogs

---

## 14) Role-Based Action Matrix in UI

Admin:
- Full create, edit, assign, review, push, deploy, rollback, settings control.

Developer:
- Project create and execution, comment review and push, deploy and rollback.
- No member invite/remove and no billing control.

QA:
- Review output and create comments.
- Cannot push comments or deploy.

Support:
- Ticket workflows only.
- No project workflow actions.

Enforcement note:
- Hide action buttons in UI and also enforce server-side authorization on every GraphQL mutation.

---

## 15) States, Empty Cases, and Error UX

Loading states:
- Skeleton components for page sections.

Empty states:
- Projects empty: show Create Project CTA.
- Review queue empty: show No comments pending review.
- Deployments empty: show No deployments yet.

Error states:
- Inline mutation errors near submit controls.
- Retry button for query failures.
- Permission denied state shows reason and next action.

---

## 16) Implementation Priority for UI

Phase UI-1:
- App shell, sidebar, top bar, login, dashboard, unified Projects workspace.

Phase UI-2:
- Projects internal views (Overview, Review, Deployments), modal manager, comment thread, push flow.

Phase UI-3:
- Support Ticket unified workspace, Notification page.

Phase UI-4:
- Team unified workspace, Workspace Setting, Integration mock, Settings (Profile).

Phase UI-5:
- Responsive polish, accessibility pass, micro-interactions, demo readiness.

---

## 17) Accessibility and Usability Rules

Minimum standards:
- Keyboard navigation for sidebar, top bar, tables, and modals.
- Visible focus indicators.
- Sufficient color contrast for status and role badges.
- ARIA labels for icon-only actions.
- Form validation messages linked to fields.

---

## 18) Definition of Done for UI

UI is demo-ready when:
1. All 9 required primary pages are implemented and connected.
2. Sidebar navigation is role-aware and accurate.
3. Core project flow from Draft to Live is fully operable inside Projects tab.
4. Required modals are integrated into their parent pages.
5. Empty, loading, and error states are present on core pages.
6. Responsive behavior works on desktop and mobile.

---

Confidential - AI-Developer - UI Product and Navigation Spec v1.0
