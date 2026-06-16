"use client";

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a7 7 0 0 1 13 0" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "16px", height: "16px", color: "var(--text-secondary)" }}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function DashboardOverviewStrip() {
  return (
    <article className="dashboard-card" style={{ padding: "20px" }}>
      {/* Header row */}
      <div className="card-head" style={{ marginBottom: "6px" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", margin: 0 }}>
          Spaces
        </h2>
        <button
          type="button"
          style={{
            fontSize: "0.75rem",
            padding: "6px 14px",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#ddeeff",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit"
          }}
        >
          Add Space +
        </button>
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 18px 0" }}>
        Use spaces to sort files by their meaning.
      </p>

      {/* Two Spaces columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        
        {/* Documents Card */}
        <div
          style={{
            background: "rgba(6, 18, 55, 0.45)",
            border: "1px solid rgba(40, 100, 230, 0.14)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {/* Top: Icon + Title + Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, rgba(20, 80, 220, 0.45), rgba(50, 130, 255, 0.22))",
                  border: "1px solid rgba(60, 140, 255, 0.22)",
                  color: "#fff"
                }}
              >
                <IconDoc />
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>Documents</span>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <IconDots />
            </button>
          </div>

          {/* Bottom: Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>100 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>21 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Used</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>79 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Available</span>
            </div>
          </div>
        </div>

        {/* Personal Card */}
        <div
          style={{
            background: "rgba(6, 18, 55, 0.45)",
            border: "1px solid rgba(40, 100, 230, 0.14)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {/* Top: Icon + Title + Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, rgba(138, 58, 220, 0.45), rgba(170, 80, 255, 0.22))",
                  border: "1px solid rgba(170, 80, 255, 0.22)",
                  color: "#fff"
                }}
              >
                <IconPerson />
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>Personal</span>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <IconDots />
            </button>
          </div>

          {/* Bottom: Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>256 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>56 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Used</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>200 <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "var(--text-secondary)" }}>GB</span></span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Available</span>
            </div>
          </div>
        </div>

      </div>
    </article>
  );
}
