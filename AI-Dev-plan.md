# AI-Developer
## Production Development Plan (Demo Scope)
Version: 1.0
Date: 2026-04-20
Status: Execution-Ready

---

## 1) Purpose
This document converts the draft requirements into a production-style, implementation-ready plan for building the AI-Developer demo.

Goals:
- Define where development starts and where it ends.
- Define all core modules and how they connect.
- Define required modals, their behaviors, and brief UI handling rules.
- Define priority order to build features one by one.
- Keep scope demo-safe: no real integration subscriptions or real billing.

---

## 2) Demo Scope and Boundaries

## 2.1 Locked Technology Stack
- Backend: Django (Python) with Django ORM and Django admin for internal operations.
- API Layer: GraphQL-first API (recommended: Strawberry GraphQL for Django).
- Frontend: Next.js (App Router) as the primary UI client.
- Database: PostgreSQL running in Docker for local and demo environments.
- Container Runtime: Docker Compose for database service only (PostgreSQL).

Implementation note:
- Do not build parallel REST endpoints for core flows in demo phase; keep one GraphQL contract to reduce drift.
- Run Django and Next.js directly on host during current development phase.

### In Scope (Demo)
- Workspace creation and role-based access (Admin, Developer, QA, Support).
- Project lifecycle pipeline: Draft -> In Progress -> In Review -> Pending Push -> Revising -> Live.
- AI agent collaboration loop with mock agent responses.
- QA comments, Developer review queue, push-to-agent flow.
- Deployment flow (simulated deployment with logs and rollback metadata).
- Dashboard, notifications (in-app), audit trail, teams, and task assignment.
- Storage usage visualization with mock quota and alerts.

### Out of Scope (Demo)
- Real billing provider.
- Real payment processing.
- Real third-party integrations (Git providers, CI/CD, cloud deployment providers).
- Real push/email notification provider.

### Demo Substitutions (Must Build)
- Mock subscription plans and fixed quota values from seeded config.
- Mock integration catalog and connect states.
- Mock deployment executor returning synthetic URL/artifact.
- Mock AI agent service with deterministic scenario-based responses.

---

## 3) Start Point and End Point

### Start Point (Day 0)
- Empty codebase for AI-Developer.
- Stack is locked: Django + Next.js + GraphQL + PostgreSQL (Docker).
- One seed Admin user can sign in.

### End Point (Demo Ready)
A full walkthrough can be performed end-to-end:
1. Admin creates workspace and project.
2. Project starts in Draft and preview is visible.
3. Developer starts agent run (In Progress).
4. Agent posts output.
5. QA files comments.
6. Developer reviews comments and pushes approved items.
7. Agent revises and replies per comment.
8. Project reaches final review and is deployed (simulated).
9. Project status becomes Live with deployment log, audit trail, and notifications shown.

---

## 4) System Map (Modules and Connections)

## 4.0 Runtime Architecture
- Next.js frontend consumes a single GraphQL endpoint from Django.
- Django handles RBAC, pipeline logic, modal action mutations, and audit logging.
- PostgreSQL stores all domain entities (workspaces, projects, comments, deployments, events).
- Docker Compose runs database only:
  - db (PostgreSQL)
- Django and Next.js run outside containers in local dev for faster iteration.

Request flow:
1. Next.js UI action triggers GraphQL mutation/query.
2. Django GraphQL resolver validates role and business rules.
3. ORM transaction writes to PostgreSQL.
4. Domain event is recorded and notifications/audit are generated.
5. GraphQL response updates UI state and modal outcomes.

## 4.1 Core Modules
1. Identity and Access (Auth + RBAC)
2. Workspace and Members
3. Teams and Task Assignment
4. Projects and Pipeline Engine
5. Agent Orchestration (Mocked Provider Layer)
6. Comment and Review System
7. Notifications (In-App)
8. Deployment Service (Mocked)
9. Audit and Activity Log
10. Storage Metering (Mocked Quota)
11. Integrations Marketplace (Read-Only/Mock State)
12. Support Panel (Ticketing Lite)

## 4.2 Connection Map
| Source Module | Target Module | Why It Connects | Trigger |
|---|---|---|---|
| Identity and Access | Every module | Enforce role permissions | Every API and UI action |
| Workspace and Members | Teams and Tasks | Assign members and teams | Member/team updates |
| Workspace and Members | Projects and Pipeline | Project access control | Project creation and assignment |
| Projects and Pipeline | Agent Orchestration | Send tasks/prompts | Start run, push comments |
| Agent Orchestration | Projects and Pipeline | Return output/revision | Agent job completion |
| Comment and Review | Agent Orchestration | Forward approved comments | Push action |
| Projects and Pipeline | Deployment Service | Release to Live | Deploy action |
| Any write action | Audit and Activity | Immutable event tracking | CRUD transitions |
| Any state transition | Notifications | User-visible updates | Pipeline/comment/deploy events |
| Projects and assets | Storage Metering | Track quota usage | Asset upload/change |
| Workspace settings | Integrations module | Display mock connection state | Admin settings changes |
| Any platform issue | Support Panel | Ticket workflow | User creates issue |

## 4.3 Event Backbone (Recommended)
Use a light event bus internally (or transaction + outbox pattern if needed later):
- project.created
- pipeline.state_changed
- agent.run.started
- agent.run.completed
- comment.created
- comment.approved
- comments.pushed
- agent.revision.completed
- deployment.started
- deployment.completed
- notification.created
- audit.logged

This keeps modules decoupled and makes the demo easy to evolve into production.

---

## 5) Workflow and State Machines

## 5.1 Project Pipeline State Machine
Allowed transitions:
- Draft -> In Progress
- In Progress -> In Review
- In Review -> Pending Push
- Pending Push -> Revising
- Revising -> In Review
- In Review -> Live

Guard rules:
- Only Admin/Developer can move Draft -> In Progress.
- Only Admin/Developer can trigger push and deployment.
- Live is terminal for demo (rollback creates a new revision marker but keeps current state as Live with previous artifact restored).

## 5.2 Comment Lifecycle
States:
- Open (created by QA/Developer/Admin)
- Needs Clarification
- Approved
- Rejected
- Pushed
- Resolved (after agent revision reply)

Rules:
- QA cannot push comments.
- Only Admin/Developer can set Approved/Rejected/Pushed.
- Agent can only mark Resolved via revision response event.

## 5.3 Task Lifecycle (Team Tasks)
- Todo -> In Progress -> Blocked or Done

---

## 6) Modal Catalog (Required for Demo)
This section defines modals needed, their connections, behaviors, and brief UI handling guidance.

## 6.1 Modal Inventory
| Modal | Opened From | Roles | Primary Action | Next Connection |
|---|---|---|---|---|
| Create Workspace | First login / workspace switcher | Admin | Create workspace | Workspace dashboard |
| Invite Member | Members page | Admin | Invite user + assign role | Member list refresh + notification |
| Change Role | Member row action | Admin | Save role | RBAC refresh + audit event |
| Create Team | Teams page | Admin | Create team | Team detail panel |
| Assign Team to Project | Project settings | Admin | Assign team | Project access map update |
| Create Project | Dashboard / projects list | Admin, Developer | Create Draft project | Draft preview modal |
| Draft Preview Confirmation | Project page in Draft | Admin, Developer | Start agent run | Pipeline -> In Progress |
| Add Comment | Artifact/code panel | QA, Developer, Admin | Submit structured comment | Comment thread update |
| Review Comment | Review queue | Developer, Admin | Approve/Reject/Clarify | Pending Push queue update |
| Push Approved Comments | Pending Push panel | Developer, Admin | Push selected comments | Pipeline -> Revising |
| Agent Revision Summary | After revision complete | Developer, QA, Admin | Acknowledge changes | Pipeline -> In Review |
| Deploy Project | Project header action | Developer, Admin | Deploy (simulated) | Pipeline -> Live |
| Rollback Deployment | Deployment history | Developer, Admin | Restore previous artifact | New deployment log entry |
| Assign Task | Project/team context | Admin, Developer | Assign task | Assignee notifications |
| Create Support Ticket | Support panel | Any logged user | Submit ticket | Ticket queue update |
| Delete Project (Hard Confirm) | Project settings | Admin | Delete project | Projects list refresh |

## 6.2 Modal-to-Modal Connection Flow
1. Create Project -> Draft Preview Confirmation -> Start Agent Run
2. Add Comment -> Review Comment -> Push Approved Comments -> Agent Revision Summary
3. Deploy Project -> (optional) Rollback Deployment
4. Invite Member -> Change Role (optional immediate follow-up)
5. Create Team -> Assign Team to Project

## 6.3 Shared Modal Behaviors (UI)
- Use one global Modal Manager with typed modal payloads.
- Every modal must enforce permission checks server-side and client-side.
- Support focus trap, Escape close, and explicit cancel button.
- For destructive modals (Delete Project, Rollback), require typed confirmation text.
- Submit buttons show loading state and disable duplicate submits.
- On success: close modal, show toast, refresh only affected queries.
- On error: keep modal open, show inline actionable error.
- Preserve unsaved fields when transient API/network errors occur.

## 6.4 Brief UI Handling Guidance
- Prefer right-side sheet for forms with many fields (Create Project, Assign Team).
- Prefer centered confirm modal for yes/no actions (Deploy, Delete, Rollback).
- Keep comment actions contextual in split-view (artifact left, thread right).
- Use optimistic UI only for non-critical changes; use confirmed UI for pipeline transitions.
- Keep modal depth at one level (avoid modal-on-modal). Chain by closing/opening sequentially.

---

## 7) UI Surface Map (Pages and Primary Components)

## 7.1 Routes
- /login
- /dashboard
- /projects
- /projects/:projectId
- /projects/:projectId/review
- /projects/:projectId/deployments
- /teams
- /members
- /notifications
- /support
- /settings/workspace
- /settings/integrations (mock)

## 7.2 Priority Components
- Pipeline status header (single source of truth)
- Project artifact viewer (files/output)
- Comment thread + review queue
- Agent run timeline
- Deployment log table
- Activity and audit feed
- Storage usage widget

## 7.3 Presence and Live Updates for Demo
- Use polling every 5-10 seconds for demo simplicity.
- Optional lightweight WebSocket channel for pipeline/comment updates.

---

## 8) Data Model Starter Map

## 8.1 Core Entities
- User(id, name, email, status)
- Workspace(id, name, ownerId, demoMode)
- Membership(id, workspaceId, userId, role)
- Team(id, workspaceId, name)
- TeamMember(id, teamId, userId)
- Project(id, workspaceId, name, description, state, createdBy)
- ProjectAssignment(id, projectId, userId/teamId)
- AgentRun(id, projectId, status, prompt, outputSummary, startedAt, completedAt)
- Artifact(id, projectId, type, path, contentRef, sizeBytes)
- Comment(id, projectId, artifactId, authorId, status, severity, body)
- CommentReview(id, commentId, reviewerId, action, note)
- PushBatch(id, projectId, pushedBy, pushedAt)
- PushBatchItem(id, pushBatchId, commentId)
- Deployment(id, projectId, version, status, artifactRef, liveUrl, createdBy)
- Notification(id, userId, type, payload, readAt)
- AuditEvent(id, workspaceId, actorId, eventType, entityType, entityId, meta, createdAt)
- SupportTicket(id, workspaceId, creatorId, title, body, status, priority)
- StorageUsage(id, workspaceId, usedBytes, quotaBytes, updatedAt)

## 8.2 Key Relationships
- Workspace 1..* Projects
- Workspace 1..* Members
- Project 1..* AgentRuns
- Project 1..* Comments
- Project 1..* Deployments
- Comment 0..* CommentReview
- PushBatch 1..* PushBatchItem

---

## 9) GraphQL Contract v1 (Demo-First)

## 9.1 GraphQL Endpoint and Auth
- Endpoint: /graphql
- Auth: session or JWT (choose one and keep consistent for demo)
- Authorization: resolver-level RBAC checks for every mutation and sensitive query

## 9.2 Query Root (Core)
- me
- workspace(id)
- workspaceMembers(workspaceId)
- teams(workspaceId)
- projects(workspaceId, state, search)
- project(id)
- projectActivity(projectId)
- comments(projectId, status)
- reviewQueue(projectId)
- deployments(projectId)
- notifications(unreadOnly)
- supportTickets(workspaceId, status)
- storageUsage(workspaceId)

## 9.3 Mutation Root (Core)
- login(input)
- createWorkspace(input)
- inviteMember(input)
- changeMemberRole(input)
- createTeam(input)
- assignTeamToProject(input)
- createProject(input)
- transitionProjectState(input)
- startAgentRun(input)
- createComment(input)
- reviewComment(input)
- pushApprovedComments(input)
- acknowledgeRevisionSummary(input)
- deployProject(input)
- rollbackDeployment(input)
- assignTask(input)
- createSupportTicket(input)
- markNotificationRead(input)

## 9.4 Suggested GraphQL Types (Starter)
- User, Workspace, Membership, Team, Project, AgentRun, Artifact
- Comment, CommentReview, PushBatch, Deployment, Notification, SupportTicket
- AuditEvent, StorageUsage

## 9.5 Mutation-to-Modal Mapping
- createWorkspace -> Create Workspace modal
- inviteMember/changeMemberRole -> Invite Member and Change Role modals
- createProject -> Create Project modal
- startAgentRun -> Draft Preview Confirmation modal
- createComment -> Add Comment modal
- reviewComment -> Review Comment modal
- pushApprovedComments -> Push Approved Comments modal
- deployProject -> Deploy Project modal
- rollbackDeployment -> Rollback Deployment modal
- createSupportTicket -> Create Support Ticket modal

---

## 10) Priority Build Plan (What to Build First)

## Phase 0: Foundation (Highest Priority)
Deliver:
- Docker Compose setup (PostgreSQL only)
- Django project scaffolding + GraphQL server wiring
- Next.js app scaffolding + GraphQL client wiring
- Auth skeleton + RBAC middleware
- Database schema and migrations (PostgreSQL)
- Seed data (users/roles/workspace)

Why first:
Everything else depends on identity, role checks, and data model.

Exit criteria:
- Admin can log in and access protected pages.
- Role-restricted route guard works.
- Frontend can query me and workspace data via GraphQL.

## Phase 1: Workspace, Members, Teams
Deliver:
- Workspace settings page
- Member list, invite, role change
- Team create and membership assign

Exit criteria:
- Admin can manage members/teams and audit events are logged.

## Phase 2: Projects + Pipeline Core
Deliver:
- Project create flow
- Draft preview
- State transition engine
- Project detail shell with status header

Exit criteria:
- Project moves Draft -> In Progress -> In Review manually with role checks.

## Phase 3: Agent Orchestration (Mock)
Deliver:
- Start agent run action
- Mock provider adapter and deterministic outputs
- Agent timeline panel

Exit criteria:
- Starting run changes state and writes output artifacts.

## Phase 4: Comment and Review Loop
Deliver:
- Add comment modal and thread
- Developer review queue modal/actions
- Push approved comments batch

Exit criteria:
- QA creates comments; Developer approves/pushes; state reaches Revising.

## Phase 5: Agent Revision + Re-Review
Deliver:
- Agent revision simulation
- Comment resolution linkage
- Revision summary modal

Exit criteria:
- Revised outputs return and project goes back to In Review.

## Phase 6: Deployment (Mock) + Rollback
Deliver:
- Deploy modal and simulated artifact publishing
- Deployment logs and rollback modal
- Live state update

Exit criteria:
- Admin/Developer deploys project and receives live URL/artifact in UI.

## Phase 7: Notifications, Dashboard, Storage, Support
Deliver:
- Notification feed
- Dashboard widgets
- Storage meter and alerts (mock values)
- Support ticketing basic workflow

Exit criteria:
- Activity appears in dashboard/notifications within SLA for demo polling.

## Phase 8: Hardening and Demo Readiness
Deliver:
- Permission edge case testing
- UX polish on modals and error states
- Audit trace validation
- Demo script and seeded showcase data

Exit criteria:
- Full walkthrough works without manual DB edits.

---

## 11) Suggested Execution Order by Week

Week 1:
- Phase 0 and Phase 1

Week 2:
- Phase 2 and Phase 3

Week 3:
- Phase 4 and Phase 5

Week 4:
- Phase 6 and Phase 7

Week 5 (buffer/hardening):
- Phase 8 and final demo prep

---

## 12) Demo Behavior Rules (Important)
- Integrations page shows provider cards and status as Mock Connected/Not Connected.
- Subscription page uses static tier config from environment or seed file.
- Any payment/upgrade action opens informational modal: Demo Mode - No real billing.
- Deployment returns deterministic fake URL pattern:
  https://demo.ai-developer.app/live/{projectSlug}/{version}
- Agent outputs come from scenario templates to ensure consistent demos.
- External integrations and subscription billing resolvers return mocked responses only.

---

## 13) Non-Functional Targets for Demo
- Main pages load under 2 seconds with seeded dataset.
- All mutating actions produce audit events.
- Role enforcement is server-authoritative.
- In-app notifications visible within 5 seconds using poll cycle.
- Error handling is user-readable and actionable.

---

## 14) Risks and Mitigation

1. Risk: Workflow complexity causes unstable state transitions.
Mitigation: Use centralized state transition service with explicit transition map.

2. Risk: Role leakage in UI actions.
Mitigation: Build permission utility once and reuse in frontend and backend checks.

3. Risk: Demo breaks due to random AI outputs.
Mitigation: Deterministic mock agent provider with fixed fixtures.

4. Risk: Modal sprawl and inconsistent UX.
Mitigation: Single modal manager, shared form patterns, and action conventions.

5. Risk: Overbuilding integrations/billing early.
Mitigation: Keep strict demo mode flag and mock adapters.

---

## 15) Definition of Done (Demo)
The AI-Developer demo is complete when:
1. All pipeline states can be demonstrated in one guided walkthrough.
2. QA -> Developer -> Agent revision loop works with threaded traceability.
3. Deployment and rollback are visible with logs and audit trail.
4. Required modals are implemented with permissions and stable behavior.
5. No real integration or billing dependency is required to run the demo.

---

## 16) Immediate Next Actions (Today)
1. Create Docker Compose with PostgreSQL service only.
2. Scaffold Django + GraphQL schema on host and connect to PostgreSQL container.
3. Scaffold Next.js app on host and connect GraphQL client to /graphql.
4. Implement RBAC middleware and seed users/roles/workspace.
5. Build Create Project + Draft Preview + transitionProjectState mutation.
6. Build comment loop modals (Add, Review, Push) against GraphQL mutations.

This sequence gives the fastest path to a working vertical slice.

---

Confidential - AI-Developer - Production Demo Plan v1.0
