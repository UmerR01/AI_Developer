"use client";

import Image from "next/image";

export function TeamPanel() {
  const members = [
    {
      name: "Alisa Snow",
      role: "UX/UI Designer",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Alisa"
    },
    {
      name: "Karl Coleman",
      role: "Motion Designer",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Karl"
    },
    {
      name: "William Cooper",
      role: "Web Developer",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=William"
    },
    {
      name: "Erick Snow",
      role: "UX/UI Designer",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Erick"
    },
    {
      name: "Liza Parker",
      role: "Web Developer",
      avatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=Liza"
    }
  ];

  return (
    <article className="dashboard-card team-card" style={{ padding: "20px" }}>
      {/* Header */}
      <div className="card-head" style={{ marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1rem", margin: 0 }}>
          Team Structure
        </h2>
      </div>

      {/* Member List */}
      <ul className="member-list" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: 0, margin: 0, listStyle: "none" }}>
        {members.map((member, index) => (
          <li
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              background: "rgba(6, 18, 55, 0.35)",
              border: "1px solid rgba(40, 100, 230, 0.1)",
              borderRadius: "12px",
              transition: "background 0.2s ease"
            }}
          >
            <Image
              src={member.avatar}
              alt={member.name}
              className="member-avatar"
              width={34}
              height={34}
              unoptimized
              style={{ borderRadius: "50%", background: "rgba(10, 25, 75, 0.9)", border: "1.5px solid rgba(255, 255, 255, 0.1)" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>
                {member.name}
              </strong>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                {member.role}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
