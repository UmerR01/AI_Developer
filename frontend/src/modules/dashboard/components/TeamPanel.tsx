"use client";

import Image from "next/image";

export function TeamPanel() {
  const members = [
    { name: "Wisp Brore",    role: "2504 National",   avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Wisp" },
    { name: "Kali Coleman",  role: "Active Teaminer",  avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Kali" },
    { name: "William Cooper", role: "Astn Teamaner",   avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=William" },
    { name: "Erick Snow",    role: "Ericle Designer",  avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Erick" },
    { name: "Liza Parker",   role: "POS Technique",    avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Liza" },
  ];

  return (
    <article className="dashboard-card team-card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <h2 style={{ fontSize: "0.9rem", margin: "0 0 14px", fontWeight: 600 }}>
        Team Structure
      </h2>

      {/* Member List */}
      <ul style={{ display: "flex", flexDirection: "column", gap: "4px", padding: 0, margin: 0, listStyle: "none" }}>
        {members.map((member, index) => (
          <li
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "10px",
              transition: "background 0.2s ease"
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(40, 100, 230, 0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Image
              src={member.avatar}
              alt={member.name}
              width={32}
              height={32}
              unoptimized
              style={{
                borderRadius: "50%",
                background: "rgba(10, 25, 75, 0.9)",
                border: "1.5px solid rgba(255, 255, 255, 0.12)",
                flexShrink: 0
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
              <strong style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e8f0ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {member.name}
              </strong>
              <span style={{ fontSize: "0.67rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                {member.role}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
