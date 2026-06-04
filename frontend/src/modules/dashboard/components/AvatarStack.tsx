import Image from "next/image";

import type { Account } from "../types";

interface AvatarStackProps {
  members: Account[];
  maxVisible?: number;
}

export function AvatarStack({ members, maxVisible = 3 }: AvatarStackProps) {
  if (!members.length) {
    return <span className="avatar-empty">No members</span>;
  }

  const showCountBubble = members.length > maxVisible;
  const visibleMembers = showCountBubble ? members.slice(0, 2) : members.slice(0, maxVisible);
  const hiddenCount = members.length - visibleMembers.length;

  return (
    <div className="avatar-stack" aria-label="project members">
      {visibleMembers.map((member) => (
        <Image
          key={member.id}
          className="avatar-circle"
          src={member.avatarUrl}
          alt={member.displayName}
          title={member.displayName}
          width={32}
          height={32}
        />
      ))}
      {showCountBubble ? <span className="avatar-count">+{hiddenCount}</span> : null}
    </div>
  );
}
