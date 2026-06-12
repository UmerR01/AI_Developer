"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Account, NotificationPreviewItem } from "../types";

interface DashboardTopBarProps {
  activeAccount: Account;
  title?: string;
  notifications: NotificationPreviewItem[];
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

  return (
    <header className="dashboard-topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
        <form className="topbar-search" role="search" onSubmit={(event) => event.preventDefault()}>
          {/* Search icon */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Search space, folder, file etc" aria-label="Search dashboard" />
          <kbd>alt+f</kbd>
        </form>
      </div>

      <div className="topbar-right">
        {/* Monitor / inbox icon — matches reference */}
        <button type="button" className="topbar-icon-btn" aria-label="Storage inbox">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>

        {/* Bell / notifications */}
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

        {/* Profile: avatar + name + email (matching reference image) */}
        <div className="topbar-profile">
          <Image src={activeAccount.avatarUrl} alt={activeAccount.displayName} width={40} height={40} unoptimized />
          <div className="topbar-profile-info">
            <span className="topbar-profile-name">{activeAccount.displayName}</span>
            <span className="topbar-profile-email">{activeAccount.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

