"use client";

import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category =
  | "all"
  | "development"
  | "qa"
  | "design"
  | "data"
  | "security"
  | "devops"
  | "docs";

type Tone = "starter" | "pro" | "team";
type PageView = "browse" | "my-agents" | "detail";

interface MarketAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  skills: string[];
  category: Exclude<Category, "all">;
  contextSize: string;
  dailyTokenLimit: number;
  price: number; // 0 = free
  rating: number;
  reviewCount: number;
  usedCount: number;
  tone: Tone;
  isFeatured?: boolean;
  isNew?: boolean;
  version: string;
  capabilities: string[];
  taskTypes: string[];
}

// ─── Static data ──────────────────────────────────────────────────────────────
const AGENTS: MarketAgent[] = [
  {
    id: "agent-starter-dev",
    name: "Starter Dev Agent",
    tagline: "Quick scaffolding and bug fixes for solo developers.",
    description:
      "Best for quick feature scaffolding, bug fixes, and lightweight review loops. Ideal for solo developers who need a reliable pair programmer without the overhead of a full-stack agent.",
    skills: ["Code Generation", "Bug Fixing", "Unit Test Drafting", "Git"],
    category: "development",
    contextSize: "64K",
    dailyTokenLimit: 2500,
    price: 0,
    rating: 4.3,
    reviewCount: 128,
    usedCount: 540,
    tone: "starter",
    isNew: false,
    version: "v2.1",
    capabilities: [
      "Generates production-ready code from task descriptions",
      "Follows your project's existing architecture patterns",
      "Writes unit tests for all generated functions",
      "Pushes code changes with descriptive commit messages",
    ],
    taskTypes: ["Frontend", "Backend", "Testing"],
  },
  {
    id: "agent-frontend-pro",
    name: "Frontend Pro Agent",
    tagline: "React & Next.js specialist with strong UX sensibility.",
    description:
      "Focused on React and Next.js workflows with strong UX polish and component quality checks. Handles accessibility audits, performance profiling, and design token management.",
    skills: ["UI Components", "Accessibility", "Performance Tuning", "React", "Next.js"],
    category: "development",
    contextSize: "128K",
    dailyTokenLimit: 12000,
    price: 12,
    rating: 4.7,
    reviewCount: 214,
    usedCount: 890,
    tone: "pro",
    isFeatured: true,
    isNew: false,
    version: "v3.0",
    capabilities: [
      "Builds accessible, WCAG-compliant components automatically",
      "Audits and fixes Lighthouse performance scores",
      "Generates Storybook stories alongside components",
      "Manages design tokens and Tailwind config consistency",
    ],
    taskTypes: ["Frontend", "Testing", "Documentation"],
  },
  {
    id: "agent-backend-architect",
    name: "Backend Architect Agent",
    tagline: "API design and service refactoring at scale.",
    description:
      "Designs APIs, refactors services, and proposes robust data-layer improvements. Specializes in GraphQL schema design, REST best practices, and database query optimization.",
    skills: ["API Design", "Data Modeling", "Refactoring", "GraphQL", "PostgreSQL"],
    category: "development",
    contextSize: "200K",
    dailyTokenLimit: 18000,
    price: 18,
    rating: 4.6,
    reviewCount: 97,
    usedCount: 412,
    tone: "pro",
    isFeatured: true,
    isNew: true,
    version: "v2.4",
    capabilities: [
      "Designs RESTful and GraphQL APIs from scratch",
      "Refactors monoliths into maintainable service boundaries",
      "Optimizes slow database queries with explain-plan analysis",
      "Generates OpenAPI / Swagger documentation automatically",
    ],
    taskTypes: ["Backend", "DB", "Documentation"],
  },
  {
    id: "agent-team-orchestrator",
    name: "Team Orchestrator Agent",
    tagline: "Multi-agent coordination for parallel delivery pipelines.",
    description:
      "Coordinates multi-agent tasks, parallel planning, and milestone-based delivery pipelines. The command-and-control brain for teams running multiple AI workers simultaneously.",
    skills: ["Sprint Planning", "Task Orchestration", "Cross-Repo Context", "ML/AI"],
    category: "development",
    contextSize: "256K",
    dailyTokenLimit: 30000,
    price: 29,
    rating: 4.9,
    reviewCount: 63,
    usedCount: 210,
    tone: "team",
    isFeatured: true,
    isNew: true,
    version: "v1.8",
    capabilities: [
      "Coordinates up to 6 specialized agents in parallel",
      "Breaks epics into sprint-ready task batches automatically",
      "Maintains cross-repository context across all agents",
      "Generates daily standup summaries and milestone reports",
    ],
    taskTypes: ["Frontend", "Backend", "Testing", "Documentation", "Research"],
  },
  {
    id: "agent-qa-sentinel",
    name: "QA Sentinel Agent",
    tagline: "Automated test generation and bug triage specialist.",
    description:
      "Analyzes task outputs against project requirements, generates structured bug reports, and assigns severity levels. Keeps your test suite green and your release cycles short.",
    skills: ["Testing", "Bug Reports", "Regression Analysis", "Selenium", "Jest"],
    category: "qa",
    contextSize: "96K",
    dailyTokenLimit: 8000,
    price: 9,
    rating: 4.5,
    reviewCount: 176,
    usedCount: 630,
    tone: "pro",
    isNew: false,
    version: "v2.7",
    capabilities: [
      "Analyzes task outputs against project requirements",
      "Generates structured bug reports with reproduction steps",
      "Assigns severity levels to each issue found",
      "Suggests fix approaches for common issues",
    ],
    taskTypes: ["Testing", "Audit"],
  },
  {
    id: "agent-security-auditor",
    name: "Security Auditor Agent",
    tagline: "Continuous vulnerability scanning and hardening.",
    description:
      "Performs static analysis, dependency auditing, and penetration-test simulations. Outputs actionable CVE reports and automated patch suggestions for your codebase.",
    skills: ["Security", "CVE Analysis", "Dependency Audit", "OWASP", "AWS"],
    category: "security",
    contextSize: "128K",
    dailyTokenLimit: 10000,
    price: 22,
    rating: 4.8,
    reviewCount: 44,
    usedCount: 180,
    tone: "pro",
    isNew: true,
    version: "v1.5",
    capabilities: [
      "Scans code for OWASP Top 10 vulnerabilities",
      "Audits npm/pip/cargo dependencies for known CVEs",
      "Generates detailed security reports with CVSS scores",
      "Proposes and applies automated patches where safe",
    ],
    taskTypes: ["Audit", "Backend", "Research"],
  },
  {
    id: "agent-data-analyst",
    name: "Data Analyst Agent",
    tagline: "SQL-first insights and data pipeline automation.",
    description:
      "Writes complex SQL queries, builds ETL pipelines, and generates executive-ready dashboards from raw data. Integrates with your data warehouse and BI tooling.",
    skills: ["Python", "PostgreSQL", "ETL", "Data Modeling", "APIs"],
    category: "data",
    contextSize: "160K",
    dailyTokenLimit: 14000,
    price: 16,
    rating: 4.4,
    reviewCount: 88,
    usedCount: 290,
    tone: "pro",
    isNew: false,
    version: "v2.2",
    capabilities: [
      "Writes optimized SQL queries from natural language",
      "Builds and schedules ETL pipelines",
      "Generates chart configs for Recharts / D3",
      "Summarizes datasets into executive briefings",
    ],
    taskTypes: ["Research", "DB", "Documentation"],
  },
  {
    id: "agent-docs-writer",
    name: "Docs Writer Agent",
    tagline: "Auto-generated, always-up-to-date developer docs.",
    description:
      "Generates Markdown docs, README files, API references, and changelog entries from your codebase. Ensures your documentation stays in sync with every commit.",
    skills: ["Documentation", "Markdown", "APIs", "Git"],
    category: "docs",
    contextSize: "64K",
    dailyTokenLimit: 6000,
    price: 0,
    rating: 4.2,
    reviewCount: 201,
    usedCount: 780,
    tone: "starter",
    isNew: false,
    version: "v3.1",
    capabilities: [
      "Generates README files from repo structure",
      "Writes API reference docs from OpenAPI spec",
      "Produces changelogs from git commit history",
      "Maintains a living style guide for your codebase",
    ],
    taskTypes: ["Documentation", "Research"],
  },
];

const CATEGORY_META: Record<
  Exclude<Category, "all">,
  { label: string; color: string; bg: string; border: string; gradient: string; icon: string }
> = {
  development: {
    label: "Development",
    color: "#5f85ff",
    bg: "rgba(95,133,255,0.10)",
    border: "rgba(95,133,255,0.25)",
    gradient: "linear-gradient(135deg,#143177,#5f85ff)",
    icon: "💻",
  },
  qa: {
    label: "QA & Testing",
    color: "#f0a05a",
    bg: "rgba(240,160,90,0.10)",
    border: "rgba(240,160,90,0.25)",
    gradient: "linear-gradient(135deg,#2d1a00,#f0a05a)",
    icon: "🔍",
  },
  design: {
    label: "Design",
    color: "#b45fff",
    bg: "rgba(180,95,255,0.10)",
    border: "rgba(180,95,255,0.25)",
    gradient: "linear-gradient(135deg,#1a0d2e,#b45fff)",
    icon: "🎨",
  },
  data: {
    label: "Data & Analytics",
    color: "#4fd4b5",
    bg: "rgba(79,212,181,0.10)",
    border: "rgba(79,212,181,0.25)",
    gradient: "linear-gradient(135deg,#001a1a,#4fd4b5)",
    icon: "📊",
  },
  security: {
    label: "Security & Audit",
    color: "#ff7272",
    bg: "rgba(255,114,114,0.10)",
    border: "rgba(255,114,114,0.25)",
    gradient: "linear-gradient(135deg,#1a0000,#ff7272)",
    icon: "🔐",
  },
  devops: {
    label: "DevOps",
    color: "#7395ff",
    bg: "rgba(115,149,255,0.10)",
    border: "rgba(115,149,255,0.25)",
    gradient: "linear-gradient(135deg,#001427,#7395ff)",
    icon: "🚀",
  },
  docs: {
    label: "Documentation",
    color: "#6bdb6b",
    bg: "rgba(107,219,107,0.10)",
    border: "rgba(107,219,107,0.25)",
    gradient: "linear-gradient(135deg,#0d1a00,#6bdb6b)",
    icon: "📝",
  },
};

const CATEGORY_FILTER_ITEMS: { key: Category; label: string; icon: string }[] = [
  { key: "all", label: "All Agents", icon: "◈" },
  { key: "development", label: "Development", icon: "💻" },
  { key: "qa", label: "QA & Testing", icon: "🔍" },
  { key: "design", label: "Design", icon: "🎨" },
  { key: "data", label: "Data & Analytics", icon: "📊" },
  { key: "security", label: "Security & Audit", icon: "🔐" },
  { key: "devops", label: "DevOps & Deployment", icon: "🚀" },
  { key: "docs", label: "Documentation", icon: "📝" },
];

const ALL_SKILLS = [
  "React","Node.js","Python","GraphQL","PostgreSQL","Docker","AWS","Testing","Security","ML/AI","APIs","Git",
];

const SORT_OPTIONS = ["Featured", "Newest", "Price: Low to High", "Price: High to Low", "Most Popular"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = 44 }: { agent: MarketAgent; size?: number }) {
  const meta = CATEGORY_META[agent.category];
  const iconSize = size >= 56 ? 28 : size >= 44 ? 20 : 16;
  return (
    <div
      className="am-avatar"
      style={{ width: size, height: size, background: meta.gradient, flexShrink: 0 }}
      aria-hidden="true"
    >
      <span style={{ fontSize: iconSize }}>{meta.icon}</span>
    </div>
  );
}

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="am-stars" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={n <= Math.round(rating) ? "#f0a05a" : "rgba(240,160,90,0.22)"}
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function CategoryChip({ category }: { category: Exclude<Category, "all"> }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className="am-cat-chip"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function PriceLabel({ price, bold }: { price: number; bold?: boolean }) {
  if (price === 0)
    return <span className={bold ? "am-price-free-lg" : "am-price-free"}>Free</span>;
  return (
    <span className={bold ? "am-price-lg" : "am-price"}>
      ${price}
      <span className="am-price-per">/mo</span>
    </span>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({
  agent,
  owned,
  onView,
  onBuy,
}: {
  agent: MarketAgent;
  owned: boolean;
  onView: () => void;
  onBuy: () => void;
}) {
  const visibleSkills = agent.skills.slice(0, 4);
  const extraSkills = agent.skills.length - visibleSkills.length;

  return (
    <article
      className={`am-card${owned ? " am-card--owned" : ""}`}
      onClick={onView}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView()}
      role="button"
      aria-label={`View ${agent.name}`}
    >
      {/* Badges */}
      {agent.isNew && !owned && <span className="am-badge am-badge--new">New</span>}
      {owned && (
        <span className="am-badge am-badge--owned">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Owned
        </span>
      )}

      {/* Top row */}
      <div className="am-card-top">
        <AgentAvatar agent={agent} size={44} />
        <div className="am-card-head">
          <p className="am-card-name">{agent.name}</p>
          <CategoryChip category={agent.category} />
        </div>
      </div>

      {/* Rating */}
      <div className="am-card-rating">
        <StarRow rating={agent.rating} />
        <span className="am-card-rating-val">{agent.rating.toFixed(1)}</span>
        <span className="am-card-rating-count">({agent.reviewCount})</span>
        <span className="am-dot" aria-hidden="true">·</span>
        <span className="am-card-rating-count">Used in {agent.usedCount.toLocaleString()} projects</span>
      </div>

      {/* Description */}
      <p className="am-card-desc">{agent.description}</p>

      {/* Skills */}
      <div className="am-skills-row">
        {visibleSkills.map((s) => (
          <span key={s} className="am-skill-pill">{s}</span>
        ))}
        {extraSkills > 0 && <span className="am-skill-pill am-skill-pill--more">+{extraSkills}</span>}
      </div>

      <div className="am-card-divider" />

      {/* Footer */}
      <div className="am-card-footer" onClick={(e) => e.stopPropagation()}>
        <PriceLabel price={agent.price} />
        {owned ? (
          <button type="button" className="am-btn am-btn--owned-action">
            Assign to Project ↓
          </button>
        ) : (
          <button type="button" className="am-btn am-btn--primary" onClick={onBuy}>
            Add to Workspace
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────
function FeaturedCard({
  agent,
  owned,
  onView,
  onBuy,
}: {
  agent: MarketAgent;
  owned: boolean;
  onView: () => void;
  onBuy: () => void;
}) {
  return (
    <article className="am-featured-card" onClick={onView} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onView()}>
      <span className="am-featured-badge">Featured</span>

      <div className="am-featured-top">
        <AgentAvatar agent={agent} size={56} />
        <div className="am-featured-head">
          <p className="am-featured-name">{agent.name}</p>
          <CategoryChip category={agent.category} />
          <div className="am-card-rating" style={{ marginTop: 4 }}>
            <StarRow rating={agent.rating} size={13} />
            <span className="am-card-rating-val">{agent.rating.toFixed(1)}</span>
            <span className="am-card-rating-count">({agent.reviewCount} reviews)</span>
          </div>
        </div>
      </div>

      <p className="am-featured-desc">{agent.description}</p>

      <div className="am-skills-row">
        {agent.skills.slice(0, 4).map((s) => (
          <span key={s} className="am-skill-pill am-skill-pill--accent">{s}</span>
        ))}
      </div>

      <div className="am-featured-footer" onClick={(e) => e.stopPropagation()}>
        <PriceLabel price={agent.price} bold />
        {owned ? (
          <button type="button" className="am-btn am-btn--owned-action" style={{ fontSize: "0.8rem" }}>Assigned ✓</button>
        ) : (
          <button type="button" className="am-btn am-btn--view" onClick={onBuy}>View Agent</button>
        )}
      </div>
    </article>
  );
}

// ─── My Agents row ────────────────────────────────────────────────────────────
function MyAgentRow({ agent }: { agent: MarketAgent }) {
  return (
    <div className="am-my-row">
      <AgentAvatar agent={agent} size={40} />
      <div className="am-my-info">
        <p className="am-my-name">{agent.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <CategoryChip category={agent.category} />
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="am-skill-pill" style={{ fontSize: "0.7rem" }}>{s}</span>
          ))}
        </div>
      </div>
      <div className="am-my-center">
        <span className="am-my-active">Active in 2 projects</span>
        <p className="am-my-assigned">Assigned Jan 12, 2025</p>
      </div>
      <div className="am-my-right">
        <span className="am-status-chip am-status--active">
          <span className="am-pulse" aria-hidden="true" />
          Active
        </span>
        <button type="button" className="am-btn am-btn--ghost" style={{ fontSize: "0.78rem", padding: "5px 12px" }}>
          Assign to Project
        </button>
      </div>
    </div>
  );
}

// ─── Purchase Modal ───────────────────────────────────────────────────────────
function PurchaseModal({
  agent,
  onClose,
  onConfirm,
}: {
  agent: MarketAgent;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState<"order" | "success">("order");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    setStep("success");
    onConfirm();
  }

  return (
    <div className="am-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="am-modal">
        {step === "order" ? (
          <>
            <div className="am-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <AgentAvatar agent={agent} size={44} />
                <div>
                  <p className="am-modal-title">Agent Purchase</p>
                  <CategoryChip category={agent.category} />
                </div>
              </div>
              <button type="button" className="am-modal-close" onClick={onClose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="am-modal-body">
              <div className="am-order-card">
                <div className="am-order-row">
                  <span>Agent Plan</span>
                  <span>{agent.price === 0 ? "Free" : `$${agent.price}/month`}</span>
                </div>
                <div className="am-order-row">
                  <span>Billing Cycle</span>
                  <span>Monthly</span>
                </div>
                <div className="am-order-row">
                  <span>Trial Period</span>
                  <span>7 days free</span>
                </div>
                <div className="am-order-divider" />
                <div className="am-order-row am-order-row--total">
                  <span>Total Today</span>
                  <span className="am-order-total-val">$0.00</span>
                </div>
                <p className="am-order-note">Then ${agent.price}/month after trial</p>
              </div>

              <div className="am-modal-field">
                <label className="am-modal-label">Assign to project (optional)</label>
                <select className="am-select">
                  <option value="">Select a project (optional)</option>
                  <option>Neural Core Alpha</option>
                  <option>Legacy Archive V2</option>
                  <option>Telemetry Sink</option>
                </select>
              </div>
            </div>

            <div className="am-modal-footer">
              <button type="button" className="am-btn am-btn--confirm" onClick={handleConfirm} disabled={busy}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
                {busy ? "Processing…" : `Confirm Purchase`}
              </button>
              <p className="am-modal-disclaimer">Payment processing coming soon — purchase logged for billing.</p>
              <button type="button" className="am-modal-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="am-success">
            <div className="am-success-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4fd4b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <p className="am-success-title">Agent Added!</p>
            <p className="am-success-sub">
              You now own <strong>{agent.name}</strong>. Assign it to a project to get started.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 8 }}>
              <button type="button" className="am-btn am-btn--confirm" onClick={onClose}>Go to My Agents</button>
              <button type="button" className="am-btn am-btn--assign-success" onClick={onClose}>Assign Now</button>
            </div>
            <div className="am-confetti" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="am-confetti-particle" style={{ "--i": i } as React.CSSProperties} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────
function AgentDetail({
  agent,
  owned,
  onBack,
  onBuy,
}: {
  agent: MarketAgent;
  owned: boolean;
  onBack: () => void;
  onBuy: () => void;
}) {
  const meta = CATEGORY_META[agent.category];
  const ALL_TASK_TYPES = ["Research", "Frontend", "Backend", "Audit", "DB", "Testing", "Documentation"];

  return (
    <div className="am-detail">
      {/* Breadcrumb */}
      <nav className="am-breadcrumb">
        <button type="button" className="am-breadcrumb-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Marketplace
        </button>
        <span className="am-breadcrumb-sep" aria-hidden="true">›</span>
        <span className="am-breadcrumb-cur">{agent.name}</span>
      </nav>

      <div className="am-detail-body">
        {/* LEFT */}
        <div className="am-detail-left">
          {/* Hero */}
          <div className="am-detail-hero">
            <AgentAvatar agent={agent} size={72} />
            <div>
              <h1 className="am-detail-name">{agent.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <CategoryChip category={agent.category} />
                <div className="am-card-rating">
                  <StarRow rating={agent.rating} size={14} />
                  <span className="am-card-rating-val">{agent.rating.toFixed(1)}</span>
                  <span className="am-card-rating-count">({agent.reviewCount} reviews)</span>
                  <span className="am-dot" aria-hidden="true">·</span>
                  <span className="am-card-rating-count">Used in {agent.usedCount.toLocaleString()} projects</span>
                </div>
              </div>
              <p className="am-detail-tagline">{agent.tagline}</p>
            </div>
          </div>

          {/* What it does */}
          <section className="am-detail-section">
            <div className="am-desc-card" style={{ borderLeft: `3px solid ${meta.color}` }}>
              <p className="am-desc-text">{agent.description}</p>
            </div>
          </section>

          {/* Skills */}
          <section className="am-detail-section">
            <p className="am-section-label">Skills & Capabilities</p>
            <div className="am-skills-row" style={{ gap: 8 }}>
              {agent.skills.map((s) => (
                <span key={s} className="am-skill-pill am-skill-pill--lg am-skill-pill--accent">{s}</span>
              ))}
            </div>
          </section>

          {/* Capabilities */}
          <section className="am-detail-section">
            <p className="am-section-label">What it can handle</p>
            <div className="am-capabilities">
              {agent.capabilities.map((cap) => (
                <div key={cap} className="am-cap-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fd4b5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Task types */}
          <section className="am-detail-section">
            <p className="am-section-label">Task Types Handled</p>
            <div className="am-skills-row" style={{ gap: 8 }}>
              {ALL_TASK_TYPES.map((t) => {
                const active = agent.taskTypes.includes(t);
                return (
                  <span
                    key={t}
                    className={`am-task-chip${active ? " am-task-chip--active" : ""}`}
                    style={active ? { background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color } : {}}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          </section>

          {/* How it works */}
          <section className="am-detail-section">
            <p className="am-section-label">How it works in your project</p>
            <div className="am-flow">
              {["Task Assigned", "Agent Works", "Review & Push"].map((title, i) => (
                <div key={title} className="am-flow-wrap">
                  <div className="am-flow-step">
                    <div className="am-flow-num">{i + 1}</div>
                    <p className="am-flow-title">{title}</p>
                    <p className="am-flow-desc">
                      {i === 0 && "Admin assigns a task to this agent via the project board."}
                      {i === 1 && "Agent analyzes requirements and produces deliverable output."}
                      {i === 2 && "Team reviews output, provides feedback, and pushes to repo."}
                    </p>
                  </div>
                  {i < 2 && (
                    <svg className="am-flow-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(95,133,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section className="am-detail-section">
            <p className="am-section-label">User Reviews</p>
            {[
              { name: "Alex Chen", role: "Admin", rating: 5, text: "Transformed our sprint velocity. We ship 40% faster now.", date: "Apr 2025" },
              { name: "Priya Nair", role: "Dev", rating: 4, text: "Solid agent, occasional hallucinations on complex schemas but overall great.", date: "Mar 2025" },
            ].map((rev) => (
              <div key={rev.name} className="am-review">
                <div className="am-review-top">
                  <div className="am-review-avatar">{rev.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <span className="am-review-name">{rev.name}</span>
                    <span className="am-review-role">{rev.role}</span>
                  </div>
                  <StarRow rating={rev.rating} size={12} />
                  <span className="am-review-date" style={{ marginLeft: "auto" }}>{rev.date}</span>
                </div>
                <p className="am-review-text">{rev.text}</p>
              </div>
            ))}
            <button type="button" className="am-load-more">Load more reviews →</button>
          </section>
        </div>

        {/* RIGHT: Purchase panel */}
        <aside className="am-detail-right">
          <div className="am-purchase-panel">
            <div className="am-purchase-price-row">
              <PriceLabel price={agent.price} bold />
              {agent.price > 0 && <span className="am-purchase-billing">Billed monthly. Cancel anytime.</span>}
              {agent.price === 0 && <span className="am-purchase-billing">No credit card required.</span>}
            </div>

            <div className="am-purchase-divider" />

            <p className="am-section-label" style={{ marginBottom: 10 }}>Plan includes</p>
            <ul className="am-includes">
              {["Unlimited task assignments", "Priority queue processing", "Full task history & logs", "All future skill updates", "Dedicated to your workspace"].map((item) => (
                <li key={item}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4fd4b5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  {item}
                </li>
              ))}
            </ul>

            <div className="am-purchase-divider" />

            <label className="am-modal-label" style={{ marginBottom: 6, display: "block" }}>Assign to project on purchase</label>
            <select className="am-select" style={{ width: "100%", marginBottom: 16 }}>
              <option value="">Select a project (optional)</option>
              <option>Neural Core Alpha</option>
              <option>Legacy Archive V2</option>
              <option>Telemetry Sink</option>
            </select>

            <div className="am-purchase-divider" />

            {owned ? (
              <>
                <button type="button" className="am-btn am-btn--owned-full" disabled>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Owned
                </button>
                <button type="button" className="am-btn am-btn--confirm" style={{ marginTop: 8 }}>
                  Assign to a Project →
                </button>
              </>
            ) : (
              <>
                <button type="button" className="am-btn am-btn--confirm" onClick={onBuy}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
                  {agent.price === 0 ? "Add Free Agent" : `Buy Agent — $${agent.price}/mo`}
                </button>
                {agent.price > 0 && (
                  <button type="button" className="am-btn am-btn--trial">Try Free for 7 days</button>
                )}
              </>
            )}

            <div className="am-trust-row">
              {["🔒 Secure", "↩ Cancel anytime", "💬 Support"].map((t) => (
                <span key={t} className="am-trust-chip">{t}</span>
              ))}
            </div>

            <div className="am-purchase-divider" />

            <div className="am-agent-stats">
              {[
                { val: agent.usedCount.toLocaleString(), label: "Projects Used" },
                { val: `${agent.rating}★`, label: "Avg Rating" },
                { val: agent.version, label: "Current Version" },
              ].map((s) => (
                <div key={s.label} className="am-agent-stat">
                  <p className="am-agent-stat-val">{s.val}</p>
                  <p className="am-agent-stat-label">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────────────────
export function AiAgentsWorkspace() {
  const [view, setView] = useState<PageView>("browse");
  const [activeTab, setActiveTab] = useState<"browse" | "my-agents">("browse");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [sortBy, setSortBy] = useState("Featured");
  const [search, setSearch] = useState("");
  const [ownedIds, setOwnedIds] = useState<string[]>(["agent-starter-dev", "agent-docs-writer"]);
  const [purchasingAgent, setPurchasingAgent] = useState<MarketAgent | null>(null);

  const selectedAgent = useMemo(
    () => AGENTS.find((a) => a.id === selectedAgentId) ?? null,
    [selectedAgentId]
  );

  const filteredAgents = useMemo(() => {
    let list = AGENTS.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (selectedSkills.length > 0 && !selectedSkills.some((s) => a.skills.includes(s))) return false;
      if (priceFilter === "free" && a.price !== 0) return false;
      if (priceFilter === "paid" && a.price === 0) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });

    if (sortBy === "Price: Low to High") list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === "Price: High to Low") list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === "Most Popular") list = [...list].sort((a, b) => b.usedCount - a.usedCount);
    else if (sortBy === "Newest") list = [...list].filter((a) => a.isNew).concat(list.filter((a) => !a.isNew));

    return list;
  }, [category, selectedSkills, priceFilter, sortBy, search]);

  const featuredAgents = AGENTS.filter((a) => a.isFeatured);
  const myAgents = AGENTS.filter((a) => ownedIds.includes(a.id));

  const kpi = {
    total: AGENTS.length,
    owned: ownedIds.length,
    active: Math.min(ownedIds.length, 2),
    newThisWeek: AGENTS.filter((a) => a.isNew).length,
  };

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  }

  function openDetail(id: string) {
    setSelectedAgentId(id);
    setView("detail");
  }

  function handleConfirmPurchase(agent: MarketAgent) {
    setOwnedIds((prev) => [...new Set([...prev, agent.id])]);
    setPurchasingAgent(null);
  }

  // ── DETAIL VIEW ──
  if (view === "detail" && selectedAgent) {
    return (
      <div className="am-root">
        <AgentDetail
          agent={selectedAgent}
          owned={ownedIds.includes(selectedAgent.id)}
          onBack={() => { setView("browse"); setSelectedAgentId(null); }}
          onBuy={() => setPurchasingAgent(selectedAgent)}
        />
        {purchasingAgent && (
          <PurchaseModal
            agent={purchasingAgent}
            onClose={() => setPurchasingAgent(null)}
            onConfirm={() => handleConfirmPurchase(purchasingAgent)}
          />
        )}
      </div>
    );
  }

  // ── BROWSE / MY-AGENTS VIEW ──
  return (
    <div className="am-root">
      <div className="am-layout">

        {/* ── Left filter panel ── */}
        <aside className="am-sidebar">
          <p className="am-filter-section-label" style={{ marginTop: 0 }}>Category</p>
          <nav className="am-filter-nav">
            {CATEGORY_FILTER_ITEMS.map((item) => {
              const count = item.key === "all" ? AGENTS.length : AGENTS.filter((a) => a.category === item.key).length;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`am-filter-item${category === item.key ? " am-filter-item--active" : ""}`}
                  onClick={() => setCategory(item.key)}
                >
                  <span>{item.icon} {item.label}</span>
                  <span className="am-filter-count">{count}</span>
                </button>
              );
            })}
          </nav>

          <p className="am-filter-section-label">Skills</p>
          <div className="am-filter-pills">
            {ALL_SKILLS.map((skill) => (
              <button
                key={skill}
                type="button"
                className={`am-filter-pill${selectedSkills.includes(skill) ? " am-filter-pill--active" : ""}`}
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>

          <p className="am-filter-section-label">Price Range</p>
          <div className="am-filter-pills">
            {(["all", "free", "paid"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`am-filter-pill${priceFilter === p ? " am-filter-pill--active" : ""}`}
                onClick={() => setPriceFilter(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {(category !== "all" || selectedSkills.length > 0 || priceFilter !== "all") && (
            <button
              type="button"
              className="am-clear-filters"
              onClick={() => { setCategory("all"); setSelectedSkills([]); setPriceFilter("all"); }}
            >
              Clear All Filters
            </button>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="am-main">

          {/* Page header */}
          <div className="am-page-header">
            <div>
              <h1 className="am-page-title">Agent Marketplace</h1>
              <p className="am-page-subtitle">Hire specialized AI agents for your projects.</p>
            </div>
            <div className="am-header-actions">
              <div className="am-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9db3e3" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  className="am-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents by name or skill..."
                />
              </div>
              <select className="am-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          {/* KPI strip */}
          <div className="am-kpi-strip">
            <div className="am-kpi-chip am-kpi-chip--default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9db3e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <strong>{kpi.total}</strong> Agents Available
            </div>
            <div className="am-kpi-chip am-kpi-chip--blue">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f85ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <strong>{kpi.owned}</strong> Owned
            </div>
            <div className="am-kpi-chip am-kpi-chip--teal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fd4b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <strong>{kpi.active}</strong> Active in Projects
            </div>
            <div className="am-kpi-chip am-kpi-chip--amber">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0a05a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>
              <strong>{kpi.newThisWeek}</strong> New This Week
            </div>
          </div>

          {/* Tabs */}
          <div className="am-tabs">
            <button
              type="button"
              className={`am-tab${activeTab === "browse" ? " am-tab--active" : ""}`}
              onClick={() => setActiveTab("browse")}
            >
              🛒 Browse
            </button>
            <button
              type="button"
              className={`am-tab${activeTab === "my-agents" ? " am-tab--active" : ""}`}
              onClick={() => setActiveTab("my-agents")}
            >
              🤖 My Agents
              {myAgents.length > 0 && <span className="am-tab-badge">{myAgents.length}</span>}
            </button>
          </div>

          {/* ── Browse tab ── */}
          {activeTab === "browse" && (
            <>
              {/* Featured row */}
              {category === "all" && !search && (
                <section className="am-featured-section">
                  <h2 className="am-section-head">⭐ Featured Agents</h2>
                  <div className="am-featured-row">
                    {featuredAgents.map((agent) => (
                      <FeaturedCard
                        key={agent.id}
                        agent={agent}
                        owned={ownedIds.includes(agent.id)}
                        onView={() => openDetail(agent.id)}
                        onBuy={() => setPurchasingAgent(agent)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Grid */}
              <section>
                <div className="am-grid-header">
                  <h2 className="am-section-head">
                    {category === "all" ? "All Agents" : CATEGORY_META[category as Exclude<Category, "all">].label}
                    <span className="am-grid-count">({filteredAgents.length})</span>
                  </h2>
                </div>

                {filteredAgents.length === 0 ? (
                  <div className="am-empty">
                    <span className="am-empty-icon" aria-hidden="true">🤖</span>
                    <p className="am-empty-title">No agents found</p>
                    <p className="am-empty-sub">Try adjusting your filters or search query.</p>
                  </div>
                ) : (
                  <div className="am-grid">
                    {filteredAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        owned={ownedIds.includes(agent.id)}
                        onView={() => openDetail(agent.id)}
                        onBuy={() => setPurchasingAgent(agent)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── My Agents tab ── */}
          {activeTab === "my-agents" && (
            <section>
              <div className="am-grid-header">
                <h2 className="am-section-head">
                  My Agents
                  <span className="am-grid-count">({myAgents.length})</span>
                </h2>
              </div>

              {myAgents.length === 0 ? (
                <div className="am-empty">
                  <span className="am-empty-icon am-empty-icon--teal" aria-hidden="true">🤖</span>
                  <p className="am-empty-title">No agents yet</p>
                  <p className="am-empty-sub">Browse the marketplace to hire your first AI agent.</p>
                  <button type="button" className="am-btn am-btn--primary" style={{ marginTop: 14 }} onClick={() => setActiveTab("browse")}>
                    Browse Agents
                  </button>
                </div>
              ) : (
                <div className="am-my-list">
                  {myAgents.map((agent) => <MyAgentRow key={agent.id} agent={agent} />)}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Purchase modal */}
      {purchasingAgent && (
        <PurchaseModal
          agent={purchasingAgent}
          onClose={() => setPurchasingAgent(null)}
          onConfirm={() => handleConfirmPurchase(purchasingAgent)}
        />
      )}
    </div>
  );
}
