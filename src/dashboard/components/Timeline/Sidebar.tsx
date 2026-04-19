import React, { useMemo } from "react";
import type { MemoryMeta } from "../../lib/api";
import {
  TYPE_COLOR,
  MEMORY_TYPES,
  agentColor,
  ACCENT,
  ACCENT_TINT_10,
  type MemoryType,
} from "./tokens";

interface Props {
  memories: MemoryMeta[];
  profile: string | null;
  setProfile: (v: string | null) => void;
  typeFilter: MemoryType | null;
  setTypeFilter: (v: MemoryType | null) => void;
  agentFilter: string | null;
  setAgentFilter: (v: string | null) => void;
}

export function Sidebar({
  memories,
  profile,
  setProfile,
  typeFilter,
  setTypeFilter,
  agentFilter,
  setAgentFilter,
}: Props) {
  const profiles = useMemo(
    () => [...new Set(memories.map((m) => m.profile ?? "global"))].sort(),
    [memories]
  );
  const agents = useMemo(
    () => [...new Set(memories.map((m) => m.author))].sort(),
    [memories]
  );

  const countBy = <K extends string>(fn: (m: MemoryMeta) => K) =>
    memories.reduce<Record<string, number>>((acc, m) => {
      const k = fn(m);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const byProfile = countBy((m) => m.profile ?? "global");
  const byType = countBy((m) => m.type);
  const byAgent = countBy((m) => m.author);

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
        padding: "18px 0",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      <SidebarHeader>Workspaces</SidebarHeader>
      <FilterRow
        label="all memories"
        count={memories.length}
        active={!profile}
        onClick={() => setProfile(null)}
      />
      {profiles.map((p) => (
        <FilterRow
          key={p}
          label={p}
          mono
          count={byProfile[p] ?? 0}
          active={profile === p}
          onClick={() => setProfile(profile === p ? null : p)}
        />
      ))}

      <SidebarHeader>Types</SidebarHeader>
      <TypeProportionBar
        memories={memories}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
      />
      {MEMORY_TYPES.map((t) => (
        <FilterRow
          key={t}
          label={t}
          count={byType[t] ?? 0}
          dotColor={TYPE_COLOR[t]}
          active={typeFilter === t}
          onClick={() => setTypeFilter(typeFilter === t ? null : t)}
        />
      ))}

      <SidebarHeader>Agents</SidebarHeader>
      {agents.length === 0 ? (
        <div style={{ padding: "4px 20px", fontSize: 11, color: "var(--border-hover)", fontStyle: "italic" }}>
          no agents yet
        </div>
      ) : (
        agents.map((a) => (
          <FilterRow
            key={a}
            label={a}
            count={byAgent[a] ?? 0}
            dotColor={agentColor(a)}
            small
            mono
            active={agentFilter === a}
            onClick={() => setAgentFilter(agentFilter === a ? null : a)}
          />
        ))
      )}

      <div
        style={{
          marginTop: "auto",
          padding: "16px 20px",
          borderTop: "1px solid var(--border-soft)",
          fontSize: 10,
          color: "var(--fg-subtle)",
          fontFamily: "var(--font-mono)",
        }}
      >
        ~/vault
      </div>
    </aside>
  );
}

function SidebarHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--fg-subtle)",
        padding: "18px 20px 6px",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function TypeProportionBar({
  memories,
  typeFilter,
  setTypeFilter,
}: {
  memories: MemoryMeta[];
  typeFilter: MemoryType | null;
  setTypeFilter: (v: MemoryType | null) => void;
}) {
  const total = memories.length || 1;
  return (
    <div
      style={{
        padding: "0 20px 8px",
        display: "flex",
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        gap: 1,
      }}
    >
      {MEMORY_TYPES.map((t) => {
        const n = memories.filter((m) => m.type === t).length;
        const pct = (n / total) * 100;
        if (pct === 0) return null;
        const dim = typeFilter && typeFilter !== t;
        return (
          <button
            key={t}
            title={`${t} — ${n} (${Math.round(pct)}%)`}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            style={{
              flex: `${pct} 0 6px`,
              minWidth: 6,
              height: "100%",
              background: TYPE_COLOR[t],
              opacity: dim ? 0.3 : 1,
              border: 0,
              padding: 0,
              cursor: "pointer",
              transition: "opacity 120ms",
            }}
          />
        );
      })}
    </div>
  );
}

function FilterRow({
  label,
  count,
  mono,
  small,
  active,
  dotColor,
  onClick,
}: {
  label: string;
  count: number;
  mono?: boolean;
  small?: boolean;
  active?: boolean;
  dotColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 20px",
        background: active ? ACCENT_TINT_10 : "transparent",
        borderLeft: active ? `2px solid ${ACCENT}` : "2px solid transparent",
        border: 0,
        borderTop: 0,
        borderRight: 0,
        borderBottom: 0,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: small ? 11 : 13,
        color: active ? ACCENT : "var(--fg)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {dotColor && (
        <span
          style={{
            width: small ? 6 : 8,
            height: small ? 6 : 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--fg-subtle)", fontSize: 10 }}>{count}</span>
    </button>
  );
}
