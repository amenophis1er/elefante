import React from "react";

interface Props {
  message: string | null;
}

export function Toast({ message }: Props) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--fg-display)",
        color: "var(--card)",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 13,
        boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: "#7BDFA6" }}
      />
      {message}
    </div>
  );
}
