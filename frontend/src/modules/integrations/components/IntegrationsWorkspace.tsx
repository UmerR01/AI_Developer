"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { WorkspacePlaceholderShell } from "../../dashboard/components/WorkspacePlaceholderShell";
import { configureIntegration, fetchIntegrationDetail, fetchIntegrations, removeIntegration, toggleIntegration } from "../api";
import { CATEGORY_LABELS, FEATURE_TEXT, type CategoryFilter } from "../constants";
import type { IntegrationDetail, IntegrationSummary } from "../types";
import { buildInitialValues, categoryName, formatDateLabel, integrationCardClass, prettyLabel, statusState } from "../utils";
import { CategoryChip, StatusChip } from "./IntegrationBadges";
import { IntegrationField } from "./IntegrationField";
import { IntegrationLogo } from "./IntegrationLogo";
import { IntegrationToggle } from "./IntegrationToggle";
import { RemoveModal } from "./RemoveModal";

interface IntegrationsWorkspaceProps {
  initialSlug?: string;
}

export function IntegrationsWorkspace({ initialSlug }: IntegrationsWorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [detail, setDetail] = useState<IntegrationDetail | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [removeSlug, setRemoveSlug] = useState<string | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialSlug) {
      setSelectedSlug(initialSlug);
    }
  }, [initialSlug]);

  useEffect(() => {
    let mounted = true;
    async function loadList() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchIntegrations();
        if (mounted) {
          setIntegrations(items);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load integrations.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadList();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const slug = selectedSlug;
    if (slug === null) {
      setDetail(null);
      setFormValues({});
      setPasswordVisibility({});
      return;
    }

    let mounted = true;
    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchIntegrationDetail(slug as string);
        if (!mounted) {
          return;
        }

        setDetail(item);
        if (item) {
          setFormValues(buildInitialValues(item));
          const visibility: Record<string, boolean> = {};
          item.configFields.forEach((field) => {
            if (field.type === "password") {
              visibility[field.key] = false;
            }
          });
          setPasswordVisibility(visibility);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load integration details.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      mounted = false;
    };
  }, [selectedSlug]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredIntegrations = useMemo(() => {
    const text = search.trim().toLowerCase();
    return integrations.filter((integration) => {
      const matchesFilter = filter === "all" || integration.category === filter;
      const matchesSearch =
        !text ||
        integration.name.toLowerCase().includes(text) ||
        integration.description.toLowerCase().includes(text) ||
        integration.slug.toLowerCase().includes(text);
      return matchesFilter && matchesSearch;
    });
  }, [filter, integrations, search]);

  const stats = useMemo(() => {
    const configured = integrations.filter((item) => item.isConfigured).length;
    const active = integrations.filter((item) => item.isEnabled).length;
    return {
      available: integrations.length,
      configured,
      active,
      inactive: Math.max(configured - active, 0),
    };
  }, [integrations]);

  const activeIntegration = useMemo(() => {
    if (!selectedSlug) {
      return null;
    }
    return detail ?? integrations.find((item) => item.slug === selectedSlug) ?? null;
  }, [detail, integrations, selectedSlug]);

  function refreshIntegrationState(next: IntegrationDetail) {
    setDetail(next);
    setIntegrations((current) => current.map((item) => (item.slug === next.slug ? next : item)));
    setFormValues(buildInitialValues(next));
    const visibility: Record<string, boolean> = {};
    next.configFields.forEach((field) => {
      if (field.type === "password") {
        visibility[field.key] = false;
      }
    });
    setPasswordVisibility(visibility);
  }

  function updateField(key: string, value: string) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function handleToggle(slug: string, nextValue: boolean) {
    try {
      setSaving(true);
      setError(null);
      const result = await toggleIntegration({ slug, isEnabled: nextValue });
      if (!result.success || !result.integration) {
        setError(result.message);
        return;
      }
      refreshIntegrationState(result.integration);
      setToast(`${result.integration.name} ${nextValue ? "enabled" : "disabled"} successfully`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to toggle integration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfigure() {
    if (!detail) {
      return;
    }

    const payload: Record<string, string> = {};
    detail.configFields.forEach((field) => {
      payload[field.key] = formValues[field.key] ?? "";
    });

    const missingField = detail.configFields.find(
      (field) =>
        field.required &&
        !String(payload[field.key] ?? "").trim() &&
        !(field.type === "password" && detail.configData?.[field.key] === "*****"),
    );

    if (missingField) {
      setError(`${missingField.label} is required.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const result = await configureIntegration({ slug: detail.slug, configData: payload });
      if (!result.success || !result.integration) {
        setError(result.message);
        return;
      }
      refreshIntegrationState(result.integration);
      router.push("/settings/integrations");
    } catch (configureError) {
      setError(configureError instanceof Error ? configureError.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(slug: string) {
    try {
      setSaving(true);
      setError(null);
      const result = await removeIntegration(slug);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setIntegrations((current) =>
        current.map((item) =>
          item.slug === slug
            ? { ...item, isEnabled: false, isConfigured: false, configuredAt: null, lastToggledAt: null }
            : item,
        ),
      );

      if (selectedSlug === slug) {
        setSelectedSlug(null);
        setDetail(null);
        router.push("/settings/integrations");
      }
      setRemoveSlug(null);
      setToast("Integration removed successfully");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove integration.");
    } finally {
      setSaving(false);
    }
  }

  const detailStatus = activeIntegration ? statusState(activeIntegration) : null;

  if (activeIntegration) {
    return (
      <WorkspacePlaceholderShell title="Integrations" description="Connect external tools to your workspace." compact>
      <div className="integrations-shell integrations-shell--page">
        <div className="integrations-shell">
          {toast ? <div className="integration-toast">{toast}</div> : null}
          {error ? <p className="integration-error">{error}</p> : null}

          <div className="integration-breadcrumb">
            <button type="button" onClick={() => router.push("/settings/integrations")}>Back</button>
            <span>/</span>
            <strong>{activeIntegration.name}</strong>
          </div>

          {detail === null ? <p className="integration-loading">Loading integration details...</p> : null}

          <div className="integration-detail-grid">
            <section className="integration-detail-main">
              <div className="integration-detail-head">
                <div className="integration-detail-brand">
                  <div className="integration-logo integration-logo--large">
                    <IntegrationLogo logoKey={activeIntegration.logoKey} />
                  </div>
                  <div>
                    <h1>{activeIntegration.name}</h1>
                    <div className="integration-detail-chips">
                      <CategoryChip category={activeIntegration.category} />
                      <StatusChip item={activeIntegration} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="integration-divider" />

              <div className="integration-section-head">
                <div>
                  <h2>Configuration</h2>
                  <p>Enter your credentials to connect {activeIntegration.name}.</p>
                </div>
              </div>

              <div className="integration-form">
                {activeIntegration.configFields.map((field) => (
                  <IntegrationField
                    key={field.key}
                    field={field}
                    value={formValues[field.key] ?? ""}
                    savedPassword={field.type === "password" && detail?.configData?.[field.key] === "*****" && !(formValues[field.key] ?? "")}
                    isVisible={Boolean(passwordVisibility[field.key])}
                    onToggleVisible={() => setPasswordVisibility((current) => ({ ...current, [field.key]: !current[field.key] }))}
                    onChange={(nextValue) => updateField(field.key, nextValue)}
                    onUpdateKey={() => updateField(field.key, "")}
                  />
                ))}
              </div>

              <div className="integration-footer">
                <button type="button" className="integration-button integration-button--ghost" onClick={() => router.push("/settings/integrations")} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="integration-button integration-button--primary" onClick={handleConfigure} disabled={saving}>
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </section>

            <aside className="integration-detail-side">
              <section className="integration-panel">
                <div className="integration-panel-head">
                  <div className="integration-logo integration-logo--medium">
                    <IntegrationLogo logoKey={activeIntegration.logoKey} />
                  </div>
                  <div>
                    <h3>About</h3>
                    <p>{categoryName(activeIntegration.category)}</p>
                  </div>
                </div>
                <p className="integration-panel-copy">{activeIntegration.description}</p>
                {activeIntegration.docsUrl ? (
                  <a href={activeIntegration.docsUrl} target="_blank" rel="noreferrer" className="integration-link-btn integration-link-btn--docs">
                    View Documentation
                  </a>
                ) : null}
              </section>

              <section className="integration-panel">
                <h3>What you can do</h3>
                <ul className="integration-feature-list">
                  {(FEATURE_TEXT[activeIntegration.slug] ?? ["Configure this integration for your workspace."]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="integration-panel">
                <h3>Connection Status</h3>
                <div className="integration-status-line">
                  <span className={`integration-dot ${detailStatus?.dot ?? "dot-muted"}`} />
                  <span>{activeIntegration.isEnabled ? "Active" : activeIntegration.isConfigured ? "Configured - Not Active" : "Not Configured"}</span>
                </div>
                {activeIntegration.configuredAt ? (
                  <div className="integration-meta-row">
                    <span>Configured on:</span>
                    <strong>{formatDateLabel(activeIntegration.configuredAt)}</strong>
                  </div>
                ) : null}
                {activeIntegration.lastToggledAt ? (
                  <div className="integration-meta-row">
                    <span>Enabled since:</span>
                    <strong>{formatDateLabel(activeIntegration.lastToggledAt)}</strong>
                  </div>
                ) : null}
              </section>
            </aside>
          </div>

          {removeSlug === activeIntegration.slug ? (
            <RemoveModal name={activeIntegration.name} onCancel={() => setRemoveSlug(null)} onConfirm={() => void handleRemove(activeIntegration.slug)} />
          ) : null}
        </div>
      </div>
      </WorkspacePlaceholderShell>
    );
  }

  return (
    <WorkspacePlaceholderShell title="Integrations" description="Connect external tools to your workspace." compact>
    <div className="integrations-shell integrations-shell--page">
      <div className="integrations-shell">
        {toast ? <div className="integration-toast">{toast}</div> : null}
        {error ? <p className="integration-error">{error}</p> : null}
        {loading ? <p className="integration-loading">Loading integrations...</p> : null}

        {!loading ? (
          <>
            <div className="integration-header-row">
              <div>
                <p>Connect external tools to your workspace.</p>
              </div>
              <div className="integration-header-controls">
                <label className="integration-search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search integrations..." />
                </label>

                <select className="integration-filter-select" value={filter} onChange={(event) => setFilter(event.target.value as CategoryFilter)} aria-label="Filter integrations by category">
                  {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((item) => (
                    <option key={item} value={item}>
                      {CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="integration-stats-row">
              <div className="integration-stat-chip integration-stat-chip--gray">{stats.available} Available</div>
              <div className="integration-stat-chip integration-stat-chip--blue">{stats.configured} Configured</div>
              <div className="integration-stat-chip integration-stat-chip--green">{stats.active} Active</div>
              <div className="integration-stat-chip integration-stat-chip--amber">{stats.inactive} Inactive</div>
            </div>

            <div className="integration-grid">
              {filteredIntegrations.map((item) => {
                const meta = statusState(item);
                return (
                  <article key={item.id} className={integrationCardClass(item)}>
                    <div className="integration-card-top">
                      <div className="integration-logo">
                        <IntegrationLogo logoKey={item.logoKey} />
                      </div>
                      {item.docsUrl ? (
                        <a href={item.docsUrl} target="_blank" rel="noreferrer" className="integration-doc-link" aria-label={`Open ${item.name} documentation`}>
                          +
                        </a>
                      ) : null}
                    </div>

                    <div className="integration-card-body">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>

                    <div className="integration-card-footer">
                      <div className="integration-card-actions">
                        <button type="button" className="integration-button integration-button--ghost" onClick={() => router.push(`/settings/integrations/${item.slug}`)}>
                          Configure
                        </button>
                        {item.isConfigured ? (
                          <button type="button" className="integration-button integration-button--danger-ghost" onClick={() => setRemoveSlug(item.slug)}>
                            Remove
                          </button>
                        ) : null}
                      </div>

                      <div className="integration-card-switcher">
                        <IntegrationToggle item={item} disabled={saving} onToggle={(nextValue) => void handleToggle(item.slug, nextValue)} />
                        <div className={`integration-mini-status ${meta.className}`}>{meta.label}</div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!filteredIntegrations.length ? <p className="integration-empty">No integrations found.</p> : null}
          </>
        ) : null}
      </div>

      {removeSlug ? (
        <RemoveModal
          name={integrations.find((item) => item.slug === removeSlug)?.name ?? prettyLabel(removeSlug)}
          onCancel={() => setRemoveSlug(null)}
          onConfirm={() => void handleRemove(removeSlug)}
        />
      ) : null}
    </div>
    </WorkspacePlaceholderShell>
  );
}
