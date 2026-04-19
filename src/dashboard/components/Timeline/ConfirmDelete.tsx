import React from "react";

interface Props {
  memoryName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDelete({ memoryName, onConfirm, onCancel }: Props) {
  if (!memoryName) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          background: "var(--card)",
          borderRadius: 12,
          padding: "22px 24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg-display)" }}>
          Forget this memory?
        </h3>
        <p style={{ margin: "8px 0 18px", fontSize: 13, color: "var(--fg)", lineHeight: 1.5 }}>
          <b>{memoryName}</b> will be removed from the vault. It will still be preserved in Git
          history.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12,
              padding: "5px 11px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
              background: "transparent",
              color: "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: 12,
              padding: "5px 11px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
              background: "var(--danger)",
              color: "var(--card)",
              border: 0,
            }}
          >
            Forget
          </button>
        </div>
      </div>
    </div>
  );
}
