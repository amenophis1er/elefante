import React from "react";
import type { VaultStatus } from "../../lib/api";
import { ACCENT, ACCENT_HOVER } from "./tokens";

interface Props {
  status: VaultStatus | null;
  count: number;
  onSearchClick: () => void;
  onNew: () => void;
  onSettingsClick: () => void;
}

export function Header({ status, count, onSearchClick, onNew, onSettingsClick }: Props) {
  const commit = status?.commit?.slice(0, 7) ?? "—";
  const cleanText = status ? (status.clean ? "clean" : "dirty") : "…";
  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 20px",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <LogoMark size={26} />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-display)" }}>
          elefante
        </span>
      </div>
      <span style={{ fontSize: 11, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
        HEAD <span style={{ color: ACCENT }}>{commit}</span> · {cleanText} · {count} memories
      </span>
      <div style={{ flex: 1 }} />
      <button
        onClick={onSearchClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
          color: "var(--fg-muted)",
          background: "var(--card)",
          cursor: "pointer",
          fontFamily: "inherit",
          minWidth: 320,
        }}
      >
        <SearchIcon />
        <span style={{ flex: 1, textAlign: "left" }}>Search memories, tags, commits…</span>
        <span
          style={{
            color: "var(--fg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "0 5px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
          }}
        >
          ⌘K
        </span>
      </button>
      <button
        onClick={onNew}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: ACCENT,
          color: "var(--card)",
          border: 0,
          borderRadius: 6,
          padding: "7px 12px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_HOVER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = ACCENT)}
      >
        <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>+</span> Remember
      </button>
      <button
        onClick={onSettingsClick}
        title="Settings"
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 6,
          borderRadius: 6,
          color: "var(--fg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-soft)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <GearIcon />
      </button>
    </header>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function LogoMark({ size = 26, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      style={{ opacity: dim ? 0.4 : 1 }}
    >
      <rect x="4" y="4" width="112" height="112" rx="24" fill={ACCENT} />
      <circle
        cx="60"
        cy="62"
        r="24"
        stroke="white"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="120 31"
        strokeDashoffset="-10"
      />
      <line x1="38" y1="58" x2="82" y2="58" stroke="white" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
