import type { IntegrationSummary } from "../types";

export function IntegrationToggle({
  item,
  disabled,
  onToggle,
}: {
  item: Pick<IntegrationSummary, "slug" | "isConfigured" | "isEnabled">;
  disabled?: boolean;
  onToggle: (nextValue: boolean) => void;
}) {
  const isPending = Boolean(disabled);

  return (
    <button
      type="button"
      className={`integration-switch ${item.isEnabled ? "integration-switch--on" : "integration-switch--off"} ${!item.isConfigured ? "integration-switch--unconfigured" : ""} ${isPending ? "integration-switch--pending" : ""}`}
      disabled={isPending}
      onClick={() => {
        if (!isPending) {
          onToggle(!item.isEnabled);
        }
      }}
      aria-label={item.isEnabled ? "Disable integration" : "Enable integration"}
      title={item.isEnabled ? "Disable integration" : "Enable integration"}
    >
      <span className="integration-switch__thumb" />
    </button>
  );
}
