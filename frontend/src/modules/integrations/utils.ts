import type { IntegrationConfigField, IntegrationDetail, IntegrationSummary } from "./types";
import { CATEGORY_LABELS, type CategoryFilter } from "./constants";

export function prettyLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateLabel(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function categoryName(category: string): string {
  return CATEGORY_LABELS[category as CategoryFilter] ?? prettyLabel(category);
}

export function statusState(integration: Pick<IntegrationSummary, "isConfigured" | "isEnabled">): { label: string; className: string; dot: string } {
  if (!integration.isConfigured) {
    return { label: "Not Configured", className: "integration-state--muted", dot: "dot-muted" };
  }
  if (integration.isEnabled) {
    return { label: "Active", className: "integration-state--active", dot: "dot-active" };
  }
  return { label: "Configured", className: "integration-state--configured", dot: "dot-configured" };
}

export function integrationCardClass(integration: IntegrationSummary): string {
  if (!integration.isConfigured) {
    return "integration-card integration-card--new";
  }
  if (integration.isEnabled) {
    return "integration-card integration-card--active";
  }
  return "integration-card integration-card--configured";
}

export function buildInitialValues(detail: IntegrationDetail | null): Record<string, string> {
  if (!detail) {
    return {};
  }

  const values: Record<string, string> = {};
  detail.configFields.forEach((field: IntegrationConfigField) => {
    const configValue = detail.configData?.[field.key];
    if (field.type === "password") {
      values[field.key] = configValue === "*****" ? "" : configValue ?? "";
      return;
    }
    values[field.key] = configValue ?? field.default ?? "";
  });
  return values;
}
