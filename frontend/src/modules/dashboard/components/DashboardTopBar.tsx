"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Account, NotificationPreviewItem } from "../types";

interface DashboardTopBarProps {
  activeAccount: Account;
  title?: string;
  notifications: NotificationPreviewItem[];
}

function getRoleLabel(role: Account["role"]): string {
  if (role === "admin") return "Admin";
  if (role === "developer") return "Developer";
  if (role === "qa") return "QA";
  return "Support";
}

export function DashboardTopBar({ activeAccount, title = "Dashboard", notifications }: DashboardTopBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const notificationBadge = useMemo(() => {
    if (notifications.length > 9) return "9+";
    return notifications.length.toString();
  }, [notifications.length]);

  const roleLabel = getRoleLabel(activeAccount.role);

  return (
    <header className="dashboard-topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        <div className="notification-wrap" ref={wrapperRef}>
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Notifications"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => setIsOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && <span className="notification-badge">{notificationBadge}</span>}
          </button>

          {isOpen && (
            <div className="notification-dropdown" role="dialog" aria-label="Notifications list">
              <div className="notification-dropdown-head">
                <span className="notification-dropdown-title">Notifications</span>
                <span className="notification-dropdown-count">{notifications.length}</span>
              </div>
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id} className="notification-item">
                    <p>{notification.text}</p>
                    <time>{notification.time}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="topbar-profile">
          <Image src={activeAccount.avatarUrl} alt={activeAccount.displayName} width={42} height={42} unoptimized />
          <div className="topbar-profile-info">
            <span className="topbar-profile-name">{activeAccount.displayName}</span>
            <span className="topbar-profile-role">{roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
