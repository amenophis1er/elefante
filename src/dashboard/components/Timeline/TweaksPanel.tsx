import React, { useEffect, useRef } from "react";
import { ACCENT } from "./tokens";
import type { Density } from "./TimelineList";

interface Props {
  open: boolean;
  onClose: () => void;
  density: Density;
  setDensity: (v: Density) => void;
  showAgents: boolean;
  setShowAgents: (v: boolean) => void;
  accent: string;
  setAccent: (v: string) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}

const DENSITIES: Density[] = ["compact", "comfortable", "spacious"];
const ACCENTS: { label: string; value: string }[] = [
  { label: "periwinkle", value: "#7B7FBF" },
  { label: "clay", value: "#D97757" },
  { label: "green", value: "#10B981" },
];

export function TweaksPanel({
  open,
  onClose,
  density,
  setDensity,
  showAgents,
  setShowAgents,
  accent,
  setAccent,
  dark,
  setDark,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 48,
        right: 20,
        width: 280,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 12px 28px rgba(28,25,23,0.12)",
        padding: 14,
        zIndex: 60,
        fontSize: 12,
        color: "var(--fg)",
      }}
    >
      <SectionLabel>Density</SectionLabel>
      <div style={{ display: "flex", gap: 0, marginBottom: 14 }}>
        {DENSITIES.map((d) => (
          <button
            key={d}
            onClick={() => setDensity(d)}
            style={{
              flex: 1,
              fontSize: 11,
              padding: "5px 8px",
              background: density === d ? ACCENT : "var(--card)",
              color: density === d ? "var(--card)" : "var(--fg)",
              border: "1px solid var(--border)",
              borderLeft: d === DENSITIES[0] ? "1px solid var(--border)" : 0,
              borderRadius:
                d === DENSITIES[0]
                  ? "6px 0 0 6px"
                  : d === DENSITIES[DENSITIES.length - 1]
                    ? "0 6px 6px 0"
                    : 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <SectionLabel>Theme</SectionLabel>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={dark}
          onChange={(e) => setDark(e.target.checked)}
        />
        <span>Dark mode</span>
      </label>

      <SectionLabel>Agent labels</SectionLabel>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={showAgents}
          onChange={(e) => setShowAgents(e.target.checked)}
        />
        <span>Show agent on cards</span>
      </label>

      <SectionLabel>Accent</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAccent(a.value)}
            title={a.label}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: a.value,
              border:
                accent === a.value ? "2px solid var(--fg-display)" : "2px solid transparent",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--fg-subtle)",
        marginBottom: 6,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}
