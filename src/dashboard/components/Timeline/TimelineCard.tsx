import React from "react";
import type { MemoryMeta } from "../../lib/api";
import { TYPE_COLOR, agentColor, typeChipStyle, ACCENT, ACCENT_TINT_06 } from "./tokens";

interface Props {
  m: MemoryMeta;
  selected: boolean;
  onClick: () => void;
  pad: string;
  gap: number;
  showAgent: boolean;
  withRail: boolean;
  rank?: number | null;
  rankLabel?: string | null;
}

function isMemoryNew(m: MemoryMeta): boolean {
  return Math.abs(+new Date(m.created_at) - +new Date(m.updated_at)) < 1000 * 60 * 60 * 24;
}

export function TimelineCard({
  m,
  selected,
  onClick,
  pad,
  gap,
  showAgent,
  withRail,
  rank,
  rankLabel,
}: Props) {
  return (
    <div style={{ position: "relative", marginBottom: gap }}>
      {withRail && (
        <span
          style={{
            position: "absolute",
            left: -22,
            top: 14,
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: TYPE_COLOR[m.type],
            border: "3px solid var(--surface)",
            zIndex: 1,
            boxSizing: "content-box",
            transform: "translateX(-3px)",
          }}
        />
      )}
      <button
        onClick={onClick}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: pad,
          background: selected ? ACCENT_TINT_06 : "var(--card)",
          border: selected ? `1px solid rgba(123,127,191,0.4)` : "1px solid var(--border)",
          borderLeft: selected ? `3px solid ${ACCENT}` : "1px solid var(--border)",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "border-color 120ms, background 120ms",
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.borderColor = "var(--border-hover)";
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {!withRail && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: TYPE_COLOR[m.type],
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontSize: 10, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
            {new Date(m.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span style={{ fontSize: 10, color: "var(--border-hover)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--fg-subtle)" }}>
            {isMemoryNew(m) ? "remembered" : "updated"}
          </span>
          <span style={{ flex: 1 }} />
          {rank != null && rankLabel && (
            <span
              style={{
                fontSize: 10,
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                padding: "1px 6px",
                background: "var(--border-soft)",
                borderRadius: 4,
                marginRight: 6,
              }}
            >
              {rank} {rankLabel}
            </span>
          )}
          {showAgent && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: agentColor(m.author),
                }}
              />
              {m.author}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: selected ? ACCENT : "var(--fg-display)",
            marginBottom: 2,
          }}
        >
          {m.name}
        </div>
        {m.description && (
          <div
            style={{
              fontSize: 12,
              color: "var(--fg-muted)",
              marginBottom: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={typeChipStyle(m.type)}>{m.type}</span>
          <span
            style={{
              fontSize: 10,
              color: "var(--fg-subtle)",
              fontFamily: "var(--font-mono)",
              padding: "1px 7px",
              background: "var(--border-soft)",
              borderRadius: 999,
              lineHeight: 1.5,
            }}
          >
            {m.profile ?? "global"}
          </span>
          {m.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10,
                padding: "1px 7px",
                borderRadius: 999,
                background: "var(--border-soft)",
                color: "var(--fg-muted)",
                lineHeight: 1.5,
              }}
            >
              #{t}
            </span>
          ))}
          {m.tags.length > 3 && (
            <span style={{ fontSize: 10, color: "var(--fg-subtle)", padding: "1px 2px" }}>
              +{m.tags.length - 3}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
