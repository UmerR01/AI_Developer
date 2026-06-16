"use client";

/* ── Folder/Document icon — matches reference blue filled square with file icon */
function IconDocFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: "16px", height: "16px" }}>
      <path d="M4 4C4 2.9 4.9 2 6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" fill="rgba(100, 160, 255, 0.85)" />
      <path d="M14 2L20 8H14V2Z" fill="rgba(60, 120, 230, 0.7)" />
      <line x1="8" y1="13" x2="16" y2="13" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="8" y1="16" x2="13" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Person icon — matches reference purple filled square with person icon */
function IconPersonFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: "16px", height: "16px" }}>
      <circle cx="12" cy="8" r="3.5" fill="rgba(210, 160, 255, 0.9)" />
      <path d="M5 20C5 16.7 8.1 14 12 14C15.9 14 19 16.7 19 20" stroke="rgba(210, 160, 255, 0.9)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "14px", height: "14px", color: "rgba(140,170,220,0.5)" }}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function DashboardOverviewStrip() {
  return (
    <article className="dashboard-card" style={{ padding: "20px" }}>
      {/* Header row */}
      <div className="card-head" style={{ marginBottom: "4px" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
          Spaces
        </h2>
        <button
          type="button"
          style={{
            fontSize: "0.76rem",
            padding: "5px 12px",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            color: "#ccd8ef",
            WebkitTextFillColor: "#ccd8ef",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          Add Space
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "10px", height: "10px" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.76rem", color: "rgba(140,170,220,0.6)", margin: "0 0 16px 0", lineHeight: 1.5, WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>
        Use spaces to sort files by their meaning.
      </p>

      {/* Two Spaces columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

        {/* Documents Card */}
        <div style={{
          background: "rgba(5, 14, 48, 0.6)",
          border: "1px solid rgba(40, 100, 230, 0.14)",
          borderRadius: "13px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          {/* Icon + Title + Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <div style={{
                width: "34px",
                height: "34px",
                borderRadius: "9px",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, rgba(20, 80, 220, 0.6), rgba(40, 110, 255, 0.3))",
                border: "1px solid rgba(60, 140, 255, 0.22)",
                flexShrink: 0
              }}>
                <IconDocFilled />
              </div>
              <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "#e2ecff", WebkitTextFillColor: "#e2ecff" }}>Documents</span>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: "3px" }}>
              <IconDots />
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>100 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>21 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Used</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>79 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Available</span>
            </div>
          </div>
        </div>

        {/* Personal Card */}
        <div style={{
          background: "rgba(5, 14, 48, 0.6)",
          border: "1px solid rgba(40, 100, 230, 0.14)",
          borderRadius: "13px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          {/* Icon + Title + Menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <div style={{
                width: "34px",
                height: "34px",
                borderRadius: "9px",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, rgba(120, 40, 220, 0.6), rgba(170, 80, 255, 0.3))",
                border: "1px solid rgba(170, 80, 255, 0.22)",
                flexShrink: 0
              }}>
                <IconPersonFilled />
              </div>
              <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "#e2ecff", WebkitTextFillColor: "#e2ecff" }}>Personal</span>
            </div>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: "3px" }}>
              <IconDots />
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>256 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>56 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Used</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff" }}>200 <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(140,170,220,0.6)", WebkitTextFillColor: "rgba(140,170,220,0.6)" }}>GB</span></span>
              <span style={{ fontSize: "0.63rem", color: "rgba(140,170,220,0.55)", WebkitTextFillColor: "rgba(140,170,220,0.55)" }}>Available</span>
            </div>
          </div>
        </div>

      </div>
    </article>
  );
}
