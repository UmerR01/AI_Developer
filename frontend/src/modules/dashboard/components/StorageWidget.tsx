interface StorageWidgetProps {
  monthlyUsageGb: number;
  monthlyLimitGb: number;
}

export function StorageWidget({ monthlyUsageGb, monthlyLimitGb }: StorageWidgetProps) {
  const usagePercent = Math.min(100, Math.round((monthlyUsageGb / monthlyLimitGb) * 100));

  return (
    <section className="dashboard-card storage-card">
      <div className="card-head">
        <h2>Storage</h2>
        <span className="chip">This month</span>
      </div>

      <div className="storage-value-row">
        <strong>{monthlyUsageGb} GB</strong>
        <span>of {monthlyLimitGb} GB</span>
      </div>

      <div className="storage-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercent}>
        <div style={{ width: `${usagePercent}%` }} />
      </div>

      <p className="storage-footnote">{100 - usagePercent}% storage available</p>
    </section>
  );
}
