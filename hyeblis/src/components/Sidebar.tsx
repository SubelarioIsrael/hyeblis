// src/components/Sidebar.tsx

import React from "react";

export type Page = "home" | "graph" | "log";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "graph",
    label: "Real-time Data Graph",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "log",
    label: "Data Log",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    ),
  },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
  onDownload: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  onRefresh,
  onDownload,
}) => (
  <aside className="sidebar">
    {/* Brand */}
    <div className="sidebar__brand">
      <span className="sidebar__brand-accent">HYEBLiS</span>
      <span className="sidebar__brand-sub">Power Monitor</span>
    </div>

    {/* Navigation */}
    <nav className="sidebar__nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`sidebar__nav-item${activePage === item.id ? " sidebar__nav-item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="sidebar__nav-icon">{item.icon}</span>
          <span className="sidebar__nav-label">{item.label}</span>
        </button>
      ))}
    </nav>

    {/* Spacer */}
    <div className="sidebar__spacer" />

    {/* Action buttons */}
    <div className="sidebar__actions">
      <button className="sidebar__btn sidebar__btn--refresh" onClick={onRefresh}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        REFRESH DATA
      </button>
      <button className="sidebar__btn sidebar__btn--download" onClick={onDownload}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        DOWNLOAD DATA
      </button>
    </div>
  </aside>
);

export default Sidebar;
