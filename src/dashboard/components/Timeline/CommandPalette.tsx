import React, { useMemo } from "react";
import type { MemoryMeta } from "../../lib/api";
import { SearchIcon } from "./Header";
import { TYPE_COLOR, ACCENT, ACCENT_TINT_10, type MemoryType } from "./tokens";

interface Props {
  open: boolean;
  memories: MemoryMeta[];
  query: string;
  setQuery: (v: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  onNewMemory: () => void;
  onClearFilters: () => void;
}

export function CommandPalette({
  open,
  memories,
  query,
  setQuery,
  onSelect,
  onClose,
  onNewMemory,
  onClearFilters,
}: Props) {
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return memories.slice(0, 8);
    return memories
      .filter((m) =>
        (m.name + " " + (m.description ?? "") + " " + m.tags.join(" "))
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 10);
  }, [query, memories]);

  const firstActionIsCommand = !query;

  const activateFirst = () => {
    if (firstActionIsCommand) {
      onNewMemory();
      onClose();
    } else if (results[0]) {
      onSelect(results[0].id);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28,25,23,0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 96,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            activateFirst();
          }
        }}
        style={{
          width: 560,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(28,25,23,0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <SearchIcon />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories or type a command…"
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              outline: "none",
              color: "var(--fg-display)",
              fontFamily: "inherit",
              fontSize: 15,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "var(--fg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "1px 5px",
              fontFamily: "var(--font-mono)",
            }}
          >
            ESC
          </span>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "6px 0 8px" }}>
          {!query && (
            <>
              <PaletteHeader>Commands</PaletteHeader>
              <PaletteCommand
                label="Remember new memory"
                hint="⌘N"
                highlighted
                onClick={() => {
                  onNewMemory();
                  onClose();
                }}
              />
              <PaletteCommand
                label="Clear all filters"
                onClick={() => {
                  onClearFilters();
                  onClose();
                }}
              />
            </>
          )}
          <PaletteHeader>{query ? `Memories matching "${query}"` : "Recent memories"}</PaletteHeader>
          {results.length === 0 ? (
            <div
              style={{ padding: "20px", fontSize: 13, color: "var(--fg-subtle)", textAlign: "center" }}
            >
              No memories match
            </div>
          ) : (
            results.map((m, i) => (
              <PaletteMemoryRow
                key={m.id}
                memory={m}
                highlighted={!firstActionIsCommand && i === 0}
                onClick={() => {
                  onSelect(m.id);
                  onClose();
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PaletteHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "var(--fg-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "10px 18px 4px",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function PaletteCommand({
  label,
  hint,
  highlighted,
  onClick,
}: {
  label: string;
  hint?: string;
  highlighted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "7px 18px",
        background: highlighted ? ACCENT_TINT_10 : "transparent",
        border: 0,
        color: "var(--fg)",
        fontFamily: "inherit",
        fontSize: 13,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_TINT_10)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = highlighted ? ACCENT_TINT_10 : "transparent")
      }
    >
      <span style={{ color: ACCENT, fontSize: 12 }}>›</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && (
        <span style={{ fontSize: 10, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
          {hint}
        </span>
      )}
    </button>
  );
}

function PaletteMemoryRow({
  memory,
  highlighted,
  onClick,
}: {
  memory: MemoryMeta;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "8px 18px",
        background: highlighted ? ACCENT_TINT_10 : "transparent",
        border: 0,
        color: "var(--fg)",
        fontFamily: "inherit",
        fontSize: 13,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_TINT_10)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = highlighted ? ACCENT_TINT_10 : "transparent")
      }
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: TYPE_COLOR[memory.type as MemoryType],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {memory.name}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--fg-subtle)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {memory.profile ?? "global"}
      </span>
    </button>
  );
}
