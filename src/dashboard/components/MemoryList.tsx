import React from "react";
import type { MemoryMeta } from "../lib/api";

const TYPE_COLORS: Record<string, string> = {
  user: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  feedback: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  project: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  reference: "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface Props {
  memories: MemoryMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MemoryList({ memories, selectedId, onSelect }: Props) {
  if (memories.length === 0) {
    return (
      <div className="text-center text-stone-400 py-12 px-4">
        <p>No memories found</p>
      </div>
    );
  }

  return (
    <div>
      {memories.map((m) => {
        const isSelected = m.id === selectedId;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-stone-800 transition-colors cursor-pointer ${
              isSelected
                ? "bg-[#7B7FBF]/10 border-l-2 border-l-[#7B7FBF]"
                : "hover:bg-stone-50 dark:hover:bg-stone-800/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_COLORS[m.type] ?? "bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"}`}>
                    {m.type}
                  </span>
                  {m.profile && (
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate">{m.profile}</span>
                  )}
                </div>
                <p className={`text-sm font-medium truncate ${isSelected ? "text-[#7B7FBF]" : "text-stone-900 dark:text-stone-100"}`}>
                  {m.name}
                </p>
                {m.description && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">{m.description}</p>
                )}
                {m.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {m.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded">
                        {tag}
                      </span>
                    ))}
                    {m.tags.length > 3 && (
                      <span className="text-[10px] text-stone-400">+{m.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 whitespace-nowrap pt-0.5">
                {timeAgo(m.updated_at)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
