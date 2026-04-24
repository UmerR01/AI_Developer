import type { IntegrationSummary } from "../types";

export function IntegrationToggle({
  item,
  disabled,
  onToggle,
}: {
  item: Pick<IntegrationSummary, "isConfigured" | "isEnabled">;
  disabled?: boolean;
  onToggle: (nextValue: boolean) => void;
}) {
  const isDisabled = Boolean(disabled) || !item.isConfigured;

  return (
    <button
      type="button"
      className={`integration-switch ${item.isEnabled ? "integration-switch--on" : "integration-switch--off"} ${isDisabled ? "integration-switch--disabled" : ""}`}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          onToggle(!item.isEnabled);
        }
      }}
      aria-label={item.isEnabled ? "Disable integration" : "Enable integration"}
      title={!item.isConfigured ? "Configure this integration first" : item.isEnabled ? "Disable integration" : "Enable integration"}
    >
      <span className="integration-switch__thumb" />
    </button>
  );
}
