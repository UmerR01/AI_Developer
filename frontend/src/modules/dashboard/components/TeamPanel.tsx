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
        <button type="button" className="plus-btn" title="Add member">
          +
        </button>
      </div>

      <p className="team-title">{team.name}</p>
      <p className="team-subtitle">Admin: {owner.displayName}</p>

      <ul className="member-list">
        {members.map((member) => (
          <li key={member.id}>
            <img src={member.avatarUrl} alt={member.displayName} className="member-avatar" />
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
