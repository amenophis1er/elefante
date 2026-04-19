import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Memory } from "../../lib/api";
import { LogoMark } from "./Header";
import {
  TYPE_COLOR,
  MEMORY_TYPES,
  agentColor,
  typeChipStyle,
  ACCENT,
  ACCENT_TINT_10,
  type MemoryType,
} from "./tokens";

interface UpdatePayload {
  name?: string;
  body?: string;
  description?: string;
  tags?: string[];
  type?: string;
}

interface Props {
  memory: Memory | null;
  onDelete: (id: string) => void;
  onSave: (id: string, data: UpdatePayload) => void;
  onCancel: () => void;
  onSelect: (id: string) => void;
  memories: { id: string; name: string; type: MemoryType }[];
  editing: boolean;
  setEditing: (v: boolean) => void;
}

export function Inspector({
  memory,
  onDelete,
  onSave,
  onCancel,
  onSelect,
  memories,
  editing,
  setEditing,
}: Props) {
  const isDraft = Boolean(memory?.id.startsWith("draft_"));
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<MemoryType>("feedback");

  useEffect(() => {
    if (memory) {
      setName(memory.name);
      setDesc(memory.description ?? "");
      setBody(memory.body);
      setType(memory.type as MemoryType);
    }
  }, [memory?.id]);

  const renderedBody = useMemo(() => {
    if (!memory) return "";
    const raw = marked.parse(memory.body || "*No body yet.*", { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [memory?.body]);

  if (!memory) {
    return (
      <aside
        style={{
          width: 340,
          flexShrink: 0,
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-subtle)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <LogoMark size={48} dim />
          <div style={{ fontSize: 13, marginTop: 12 }}>Select a memory</div>
        </div>
      </aside>
    );
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 10px",
    color: "var(--fg-display)",
    outline: "none",
    fontFamily: "inherit",
  };

  const importance = Math.max(0, Math.min(3, memory.importance));

  const handleSave = () => {
    if (isDraft) {
      onSave(memory.id, { name, description: desc, body, type });
      return;
    }
    onSave(memory.id, {
      name: name !== memory.name ? name : undefined,
      description: desc !== (memory.description ?? "") ? desc : undefined,
      body: body !== memory.body ? body : undefined,
      type: type !== memory.type ? type : undefined,
    });
  };

  const handleCancel = () => {
    setName(memory.name);
    setDesc(memory.description ?? "");
    setBody(memory.body);
    setType(memory.type as MemoryType);
    onCancel();
  };

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {editing ? (
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              style={{ ...inputBase, width: "auto", fontSize: 11, padding: "2px 8px" }}
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <span style={typeChipStyle(memory.type as MemoryType)}>{memory.type}</span>
          )}
          <span style={{ fontSize: 11, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
            {memory.profile ?? "global"}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            imp {"●".repeat(importance)}
            <span style={{ color: "var(--border)" }}>{"●".repeat(3 - importance)}</span>
          </span>
        </div>
        {editing ? (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Memory name"
              style={{
                ...inputBase,
                fontSize: 16,
                fontWeight: 600,
                padding: "6px 10px",
                marginBottom: 6,
                color: "var(--fg-display)",
              }}
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="One-line description"
              style={{ ...inputBase, fontSize: 12, color: "var(--fg)" }}
            />
          </>
        ) : (
          <>
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: "var(--fg-display)",
                lineHeight: 1.3,
              }}
            >
              {memory.name}
            </h3>
            {memory.description && (
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-muted)" }}>
                {memory.description}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {editing ? (
          <>
            <button onClick={handleSave} style={btn("primary")}>
              Save
            </button>
            <button onClick={handleCancel} style={btn("neutral")}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={btn("neutral")}>
              Edit
            </button>
            <button onClick={() => onDelete(memory.id)} style={btn("danger")}>
              Forget
            </button>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 10,
                color: "var(--fg-subtle)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {memory.access_count}× read
            </span>
          </>
        )}
      </div>

      {/* Provenance */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-soft)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--fg-subtle)",
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          Provenance
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr",
            rowGap: 6,
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--fg-subtle)" }}>author</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: agentColor(memory.author),
              }}
            />
            <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
              {memory.author}
            </span>
          </span>
          <span style={{ color: "var(--fg-subtle)" }}>id</span>
          <span
            style={{
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {memory.id}
          </span>
          <span style={{ color: "var(--fg-subtle)" }}>created</span>
          <span style={{ color: "var(--fg)" }}>
            {new Date(memory.created_at).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <span style={{ color: "var(--fg-subtle)" }}>updated</span>
          <span style={{ color: "var(--fg)" }}>{timeAgo(memory.updated_at)}</span>
        </div>
      </div>

      {/* Body + Tags + Related */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Memory body (Markdown)"
            style={{
              ...inputBase,
              fontSize: 13,
              lineHeight: 1.6,
              padding: 12,
              minHeight: 240,
              resize: "vertical",
              fontFamily: "var(--font-mono)",
            }}
          />
        ) : (
          <div
            className="prose prose-sm max-w-none"
            style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--fg)" }}
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />
        )}

        <div style={{ marginTop: 20 }}>
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
            Tags
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {memory.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--border-soft)",
                  color: "var(--fg)",
                }}
              >
                #{t}
              </span>
            ))}
            {memory.tags.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--border-hover)", fontStyle: "italic" }}>
                no tags
              </span>
            )}
          </div>
        </div>

        {memories.length > 0 && (
          <RelatedSection memory={memory} memories={memories} onSelect={onSelect} />
        )}
      </div>
    </aside>
  );
}

function RelatedSection({
  memory,
  memories,
  onSelect,
}: {
  memory: Memory;
  memories: { id: string; name: string; type: MemoryType }[];
  onSelect: (id: string) => void;
}) {
  const related = memory.related ?? [];
  const resolved = related
    .map((id) => memories.find((m) => m.id === id))
    .filter((m): m is { id: string; name: string; type: MemoryType } => Boolean(m));
  if (resolved.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
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
        Related memories
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {resolved.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            style={{
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              margin: "0 -8px",
              background: "transparent",
              border: 0,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12.5,
              color: "var(--fg)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_TINT_10)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: TYPE_COLOR[r.type],
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function btn(variant: "primary" | "neutral" | "danger"): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 12,
    padding: "5px 11px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 500,
    transition: "background 150ms",
  };
  if (variant === "primary") {
    return { ...base, background: ACCENT, color: "var(--card)", border: 0 };
  }
  if (variant === "danger") {
    return {
      ...base,
      background: "transparent",
      color: "var(--danger)",
      border: "1px solid var(--danger-bd)",
    };
  }
  return {
    ...base,
    background: "transparent",
    color: "var(--fg)",
    border: "1px solid var(--border)",
  };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - +new Date(iso);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

