import Link from "next/link";

interface StorageWidgetProps {
  usedBytes: number;
  totalBytes: number;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value.toFixed(0)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageWidget({ usedBytes, totalBytes }: StorageWidgetProps) {
  const usagePercent = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;

  return (
    <section className="dashboard-card storage-card">
      <div className="card-head">
        <h2>Storage</h2>
        <Link className="chip chip-action" href="/settings?tab=storage">
          Manage Storage
        </Link>
      </div>

      <div className="storage-value-row">
        <strong>{formatBytes(usedBytes)}</strong>
        <span>used of {formatBytes(totalBytes)} total</span>
      </div>

      <div className="storage-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
        <div style={{ width: `${usagePercent}%` }} />
      </div>

      <p className="storage-footnote">{100 - usagePercent}% storage available</p>
    </section>
  );
}
