import Image from "next/image";

import type { Account, Team } from "../types";

interface TeamPanelProps {
  team: Team;
  owner: Account;
  members: Account[];
}

function formatRole(role: Account["role"]): string {
  if (role === "admin") return "UX/UI Designer";
  if (role === "developer") return "Web Developer";
  if (role === "qa") return "Motion Designer";
  return "Support Designer";
}

export function TeamPanel({ team, owner, members }: TeamPanelProps) {
  const visibleMembers = [owner, ...members.filter((member) => member.id !== owner.id)].slice(0, 5);

  return (
    <section className="dashboard-card team-card" aria-label={team.name}>
      <div className="card-head team-card-head">
        <h2>Team Structure</h2>
      </div>

      <ul className="member-list">
        {visibleMembers.map((member) => (
          <li key={member.id}>
            <Image src={member.avatarUrl} alt={member.displayName} className="member-avatar" width={36} height={36} unoptimized />
            <div>
              <strong>{member.displayName}</strong>
              <span>{formatRole(member.role)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
