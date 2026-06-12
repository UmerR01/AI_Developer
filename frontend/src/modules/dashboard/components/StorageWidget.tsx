interface StorageWidgetProps {
  usedBytes: number;
  totalBytes: number;
}

function formatGb(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return `${Math.round(value / (1024 * 1024 * 1024))}`;
}

export function StorageWidget({ usedBytes, totalBytes }: StorageWidgetProps) {
  const safeUsedBytes = totalBytes > 0 ? usedBytes : 650 * 1024 * 1024 * 1024;
  const safeTotalBytes = totalBytes > 0 ? totalBytes : 1150 * 1024 * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((safeUsedBytes / safeTotalBytes) * 100));
  const remainingGb = safeTotalBytes > safeUsedBytes ? formatGb(safeTotalBytes - safeUsedBytes) : "0";

  return (
    <article className="dash-storage-card">
      <div className="storage-topline">
        <span>Used per month</span>
        <button type="button" className="month-select">September ▾</button>
      </div>

      <div className="storage-number">
        <strong>{formatGb(safeUsedBytes)}</strong>
        <span>GB</span>
      </div>

      <div className="storage-label-row">
        <span>Your Storage</span>
        <span>{remainingGb}GB left</span>
      </div>

      <div className="reference-storage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
        <span style={{ width: `${Math.max(usagePercent, 6)}%` }} />
      </div>
    </article>
  );
}
