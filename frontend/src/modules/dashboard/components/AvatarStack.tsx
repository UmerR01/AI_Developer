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

  const visibleMembers = members.slice(0, maxVisible);
  const hiddenCount = Math.max(0, members.length - visibleMembers.length);

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
          unoptimized
        />
      ))}
      {hiddenCount > 0 ? <span className="avatar-count">+{hiddenCount}</span> : null}
    </div>
  );
}
