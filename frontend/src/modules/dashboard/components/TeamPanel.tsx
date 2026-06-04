import Link from "next/link";
import Image from "next/image";

import type { Account, Team } from "../types";

interface TeamPanelProps {
  team: Team;
  owner: Account;
  members: Account[];
}

export function TeamPanel({ team, owner, members }: TeamPanelProps) {
  return (
    <section className="dashboard-card team-card">
      <div className="card-head">
        <h2>Member List</h2>
        <Link className="plus-btn" title="Add member" aria-label="Invite member" href="/member">
          +
        </Link>
      </div>

      <p className="team-title">{team.name}</p>
      <p className="team-subtitle">Admin: {owner.displayName}</p>

      <ul className="member-list">
        {members.map((member) => (
          <li key={member.id}>
            <Image src={member.avatarUrl} alt={member.displayName} className="member-avatar" width={36} height={36} />
            <div>
              <strong>{member.displayName}</strong>
              <span>{member.role.toUpperCase()}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
