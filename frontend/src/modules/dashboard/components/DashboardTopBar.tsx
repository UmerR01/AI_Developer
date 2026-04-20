"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Account, NotificationPreviewItem } from "../types";

interface DashboardTopBarProps {
  activeAccount: Account;
  title?: string;
  notifications: NotificationPreviewItem[];
}

function getRoleLabel(role: Account["role"]): string {
  if (role === "admin") {
    return "Admin";
  }
  if (role === "developer") {
    return "Developer";
  }
  if (role === "qa") {
    return "QA";
  }
  return "Support";
}

export function DashboardTopBar({ activeAccount, title = "Dashboard", notifications }: DashboardTopBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const notificationBadge = useMemo(() => {
    if (notifications.length > 9) {
      return "9+";
    }
    return notifications.length.toString();
  }, [notifications.length]);

  const roleLabel = getRoleLabel(activeAccount.role);

  return (
    <header className="dashboard-topbar">
      <div className="topbar-title-wrap">
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        <div className="notification-wrap" ref={wrapperRef}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => setIsOpen((value) => !value)}
          >
            <svg className="icon-bell" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a5 5 0 0 0-5 5v2.9c0 .9-.3 1.8-.8 2.5L4.7 15c-.4.5-.5 1.2-.3 1.8.3.6.9 1 1.6 1h12c.7 0 1.3-.4 1.6-1 .3-.6.1-1.3-.3-1.8l-1.5-1.6c-.5-.7-.8-1.6-.8-2.5V8a5 5 0 0 0-5-5Z" />
              <path d="M9.3 19.5a2.7 2.7 0 0 0 5.4 0" />
            </svg>
            {notifications.length > 0 ? <span className="notification-dot">{notificationBadge}</span> : null}
          </button>

          {isOpen ? (
            <div className="notification-dropdown" role="dialog" aria-label="Notifications list">
              <div className="notification-head">
                <strong>Notifications</strong>
                <span>{notifications.length} items</span>
              </div>
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <p>{notification.text}</p>
                    <time>{notification.time}</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="profile-chip">
          <img src={activeAccount.avatarUrl} alt={activeAccount.displayName} />
          <div>
            <strong>{activeAccount.displayName}</strong>
            <span>
              {roleLabel} | {activeAccount.email}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
