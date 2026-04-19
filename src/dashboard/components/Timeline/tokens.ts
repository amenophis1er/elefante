import type { MemoryMeta } from "../../lib/api";

export type MemoryType = MemoryMeta["type"];

export const MEMORY_TYPES: readonly MemoryType[] = [
  "user",
  "feedback",
  "project",
  "reference",
] as const;

/** Per-type dot colors — these stay constant across light/dark per spec. */
export const TYPE_COLOR: Record<MemoryType, string> = {
  user: "#3B82F6",
  feedback: "#F59E0B",
  project: "#10B981",
  reference: "#A855F7",
};

/** Per-agent dot colors — also constant across themes. */
export const AGENT_COLOR: Record<string, string> = {
  "claude-sonnet-4.5": "#D97757",
  "claude-haiku-4.5": "#C38B5F",
  codex: "#7B7FBF",
};

export const UNKNOWN_AGENT_COLOR = "var(--fg-subtle)";

export function agentColor(author: string): string {
  if (AGENT_COLOR[author]) return AGENT_COLOR[author];
  for (const [prefix, color] of Object.entries(AGENT_COLOR)) {
    if (author.startsWith(prefix)) return color;
  }
  return UNKNOWN_AGENT_COLOR;
}

/** Type chip reads from CSS vars so it flips in dark mode. */
export function typeChipStyle(type: MemoryType): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 500,
    padding: "1px 7px",
    borderRadius: 999,
    background: `var(--type-${type}-bg)`,
    color: `var(--type-${type}-fg)`,
    border: `1px solid var(--type-${type}-bd)`,
    lineHeight: 1.5,
  };
}

// Semantic color tokens (all CSS vars — flip in dark mode)
export const ACCENT = "var(--primary)";
export const ACCENT_HOVER = "var(--primary-hover)";
export const ACCENT_TINT_10 = "var(--primary-tint)";
export const ACCENT_TINT_06 = "var(--primary-tint-06)";

export const SURFACE = "var(--surface)";
export const CARD = "var(--card)";
export const CARD_HOVER = "var(--card-hover)";
export const BORDER = "var(--border)";
export const BORDER_HOVER = "var(--border-hover)";
export const BORDER_SOFT = "var(--border-soft)";

export const FG = "var(--fg)";
export const FG_DISPLAY = "var(--fg-display)";
export const FG_MUTED = "var(--fg-muted)";
export const FG_SUBTLE = "var(--fg-subtle)";

export const DANGER = "var(--danger)";
export const DANGER_BG = "var(--danger-bg)";
export const DANGER_BD = "var(--danger-bd)";
export const DANGER_FG = "var(--danger-fg)";
