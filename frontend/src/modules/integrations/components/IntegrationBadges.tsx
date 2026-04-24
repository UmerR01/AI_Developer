import { categoryName, statusState } from "../utils";
import type { IntegrationSummary } from "../types";

export function CategoryChip({ category }: { category: string }) {
  return <span className={`integration-chip integration-chip--${category}`}>{categoryName(category)}</span>;
}

export function StatusChip({ item }: { item: Pick<IntegrationSummary, "isConfigured" | "isEnabled"> }) {
  const meta = statusState(item);
  return <span className={`integration-state ${meta.className}`}>{meta.label}</span>;
}
