import React from "react";

interface Props {
  type?: string;
  sort?: string;
  profile?: string;
  tag?: string;
  searchQuery?: string;
  profiles: string[];
  tags: string[];
  onTypeChange: (type?: string) => void;
  onSortChange: (sort?: string) => void;
  onProfileChange: (profile?: string) => void;
  onTagChange: (tag?: string) => void;
  onReset: () => void;
}

const TYPES = ["user", "feedback", "project", "reference"] as const;
const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Created" },
  { value: "importance", label: "Importance" },
] as const;

const select = "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded px-2 py-1 text-xs text-stone-600 dark:text-stone-300 focus:outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors";

export function Filters({ type, sort, profile, tag, searchQuery, profiles, tags, onTypeChange, onSortChange, onProfileChange, onTagChange, onReset }: Props) {
  const hasFilters = !!(type || profile || tag || sort !== "updated" || searchQuery);

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <select value={type ?? ""} onChange={(e) => onTypeChange(e.target.value || undefined)} className={select}>
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select value={profile ?? ""} onChange={(e) => onProfileChange(e.target.value || undefined)} className={select}>
        <option value="">All profiles</option>
        {profiles.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select value={tag ?? ""} onChange={(e) => onTagChange(e.target.value || undefined)} className={select}>
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select value={sort ?? "updated"} onChange={(e) => onSortChange(e.target.value)} className={select}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <button
        onClick={onReset}
        disabled={!hasFilters}
        className={`text-xs px-2 py-1 rounded transition-colors ${hasFilters ? "text-[#7B7FBF] hover:bg-[#7B7FBF]/10 cursor-pointer" : "text-stone-300 dark:text-stone-600 pointer-events-none"}`}
      >
        Reset
      </button>
    </div>
  );
}
