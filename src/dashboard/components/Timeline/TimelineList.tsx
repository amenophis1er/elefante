import React, { useCallback, useMemo, useRef } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { MemoryMeta } from "../../lib/api";
import { TimelineCard } from "./TimelineCard";
import { SearchIcon } from "./Header";
import { ACCENT, ACCENT_TINT_10, type MemoryType } from "./tokens";

export type SortBy = "recent" | "accessed" | "importance";
export type Density = "compact" | "comfortable" | "spacious";

interface Props {
  memories: MemoryMeta[];
  loading: boolean;
  profile: string | null;
  typeFilter: MemoryType | null;
  agentFilter: string | null;
  q: string;
  setQ: (v: string) => void;
  onClearFilters: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  density: Density;
  showAgents: boolean;
}

type Item =
  | { kind: "header"; key: string; day: string; count: number }
  | { kind: "card"; key: string; memory: MemoryMeta };

const HEADER_SIZE = 32;
const CARD_SIZES: Record<Density, number> = {
  compact: 94,
  comfortable: 116,
  spacious: 148,
};

export function TimelineList({
  memories,
  loading,
  profile,
  typeFilter,
  agentFilter,
  q,
  setQ,
  onClearFilters,
  selectedId,
  onSelect,
  sortBy,
  setSortBy,
  density,
  showAgents,
}: Props) {
  const cardPad =
    density === "compact" ? "8px 14px" : density === "spacious" ? "16px 20px" : "12px 16px";
  const cardGap = density === "compact" ? 4 : density === "spacious" ? 10 : 6;

  const sorted = useMemo(() => {
    const arr = [...memories];
    if (sortBy === "recent") {
      arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    } else if (sortBy === "accessed") {
      arr.sort(
        (a, b) => b.access_count - a.access_count || b.updated_at.localeCompare(a.updated_at)
      );
    } else {
      arr.sort(
        (a, b) => b.importance - a.importance || b.updated_at.localeCompare(a.updated_at)
      );
    }
    return arr;
  }, [memories, sortBy]);

  const items = useMemo<Item[]>(() => {
    if (sortBy !== "recent") {
      return sorted.map((m) => ({ kind: "card", key: m.id, memory: m }));
    }
    const out: Item[] = [];
    const grouped: Record<string, MemoryMeta[]> = {};
    for (const m of sorted) {
      const key = localDayKey(new Date(m.updated_at));
      (grouped[key] ||= []).push(m);
    }
    for (const [day, ms] of Object.entries(grouped)) {
      out.push({ kind: "header", key: `h_${day}`, day, count: ms.length });
      for (const m of ms) {
        out.push({ kind: "card", key: m.id, memory: m });
      }
    }
    return out;
  }, [sorted, sortBy]);

  const stickyIndexes = useMemo(
    () => items.reduce<number[]>((acc, it, i) => (it.kind === "header" ? (acc.push(i), acc) : acc), []),
    [items]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const estimateSize = useCallback(
    (i: number) => (items[i]?.kind === "header" ? HEADER_SIZE : CARD_SIZES[density] + cardGap),
    [items, density, cardGap]
  );

  const rangeExtractor = useCallback(
    (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => {
      const next = new Set(defaultRangeExtractor(range));
      const active = [...stickyIndexes].reverse().find((i) => i <= range.startIndex);
      if (active !== undefined) next.add(active);
      return [...next].sort((a, b) => a - b);
    },
    [stickyIndexes]
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 8,
    rangeExtractor,
  });

  const hasFilters = profile || typeFilter || agentFilter || q;
  const subText =
    sortBy === "recent"
      ? "grouped by day · most recent first"
      : sortBy === "accessed"
        ? "most accessed first"
        : "highest importance first";

  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  // The rangeExtractor injects the active sticky header as the first range index,
  // so it's always virtualItems[0] when a header is currently "stuck".
  const firstVirtual = virtualItems[0];
  const activeStickyIndex =
    sortBy === "recent" && firstVirtual && items[firstVirtual.index]?.kind === "header"
      ? firstVirtual.index
      : -1;

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "22px 28px", minWidth: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--fg-display)",
          }}
        >
          {profile || "All memories"}
        </h2>
        <p style={{ margin: "3px 0 10px", fontSize: 12, color: "var(--fg-muted)" }}>
          {loading
            ? "Loading…"
            : `${sorted.length} ${sorted.length === 1 ? "memory" : "memories"} · ${subText}`}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 320 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="filter this timeline…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontSize: 12,
                padding: "6px 10px 6px 28px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--fg)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span style={{ position: "absolute", left: 9, top: 8, color: "var(--fg-subtle)" }}>
              <SearchIcon />
            </span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={{
              fontSize: 12,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
              outline: "none",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <option value="recent">Sort: recent</option>
            <option value="accessed">Sort: most accessed</option>
            <option value="importance">Sort: importance</option>
          </select>
        </div>
      </div>

      {hasFilters && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {profile && <Chip label={`profile: ${profile}`} onClear={onClearFilters} />}
          {typeFilter && <Chip label={`type: ${typeFilter}`} onClear={onClearFilters} />}
          {agentFilter && <Chip label={`agent: ${agentFilter}`} onClear={onClearFilters} />}
          {q && <Chip label={`"${q}"`} onClear={() => setQ("")} />}
          <button
            onClick={onClearFilters}
            style={{
              fontSize: 11,
              color: ACCENT,
              background: "transparent",
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              marginLeft: 4,
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--fg-subtle)", fontSize: 13 }}>
          {loading ? "Loading…" : "No memories match these filters"}
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            paddingLeft: sortBy === "recent" ? 22 : 0,
            height: totalSize,
            width: "100%",
          }}
        >
          {sortBy === "recent" && (
            <div
              style={{
                position: "absolute",
                left: 6,
                top: 18,
                bottom: 6,
                width: 1,
                background: "var(--border)",
              }}
            />
          )}
          {virtualItems.map((v) => {
            const it = items[v.index];
            if (!it) return null;
            const isActiveSticky = v.index === activeStickyIndex;
            const railOffset = sortBy === "recent" ? 22 : 0;
            const baseStyle: React.CSSProperties = isActiveSticky
              ? {
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  width: "100%",
                }
              : {
                  position: "absolute",
                  top: 0,
                  left: railOffset,
                  width: railOffset ? `calc(100% - ${railOffset}px)` : "100%",
                  transform: `translateY(${v.start}px)`,
                };
            if (it.kind === "header") {
              return (
                <div
                  key={it.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  style={baseStyle}
                >
                  <div
                    style={{
                      background: "var(--surface)",
                      padding: "6px 0",
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 500,
                      marginLeft: -22,
                      paddingLeft: 22,
                    }}
                  >
                    {formatDay(it.day)}{" "}
                    <span
                      style={{
                        color: "var(--border-hover)",
                        fontWeight: 400,
                        textTransform: "none",
                        letterSpacing: 0,
                        marginLeft: 6,
                      }}
                    >
                      {it.count}
                    </span>
                  </div>
                </div>
              );
            }
            const m = it.memory;
            return (
              <div
                key={it.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                style={baseStyle}
              >
                <TimelineCard
                  m={m}
                  selected={m.id === selectedId}
                  onClick={() => onSelect(m.id)}
                  pad={cardPad}
                  gap={cardGap}
                  showAgent={showAgents}
                  withRail={sortBy === "recent"}
                  rank={sortBy === "accessed" ? m.access_count : sortBy === "importance" ? m.importance : null}
                  rankLabel={sortBy === "accessed" ? "reads" : null}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        padding: "3px 4px 3px 9px",
        borderRadius: 999,
        background: ACCENT_TINT_10,
        color: ACCENT,
      }}
    >
      {label}
      <button
        onClick={onClear}
        style={{
          background: "transparent",
          border: 0,
          color: ACCENT,
          cursor: "pointer",
          padding: "0 4px",
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDay(localKey: string): string {
  const [y, m, day] = localKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((+t0 - +d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
