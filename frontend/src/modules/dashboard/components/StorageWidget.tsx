import Link from "next/link";
import Image from "next/image";

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
  const tone = usagePercent > 85 ? "danger" : usagePercent > 60 ? "warn" : "good";
  const remaining = totalBytes - usedBytes;

  return (
    <article className="dash-storage-card">
      <div className="dash-storage-icon-wrap">
        <Image src="/storage.png" alt="" className="dash-storage-img" width={160} height={160} draggable={false} />
      </div>

      <div className="dash-storage-info">
        <div className="dash-storage-head">
          <strong>Storage</strong>
          <span className="dash-storage-total">{formatBytes(totalBytes)}</span>
        </div>

        <div className="dash-storage-used-row">
          <span>{formatBytes(usedBytes)} used</span>
          <span>{usagePercent}%</span>
        </div>

        <div className={`dash-storage-bar ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
          <span style={{ width: `${Math.max(usagePercent, 4)}%` }} />
        </div>

        {remaining > 0 && (
          <p className="dash-storage-remaining">{formatBytes(remaining)} available</p>
        )}
      </div>

      <div className="dash-storage-footer">
        <Link className="dash-storage-manage" href="/settings?tab=storage">
          Manage Storage
        </Link>
      </div>
    </article>
  );
}
