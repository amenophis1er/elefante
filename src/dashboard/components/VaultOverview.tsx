import React from "react";
import type { MemoryMeta, VaultStatus } from "../lib/api";

const card = "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg";

interface Props {
  status: VaultStatus;
  memories: MemoryMeta[];
  onProfileClick?: (profile: string) => void;
}

export function VaultOverview({ status, memories, onProfileClick }: Props) {
  const byType = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});

  const byProfile = memories.reduce<Record<string, number>>((acc, m) => {
    const key = m.profile ?? "global";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topAccessed = [...memories]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);

  const recentlyUpdated = [...memories]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const TYPE_COLORS: Record<string, string> = {
    user: "bg-blue-500",
    feedback: "bg-amber-500",
    project: "bg-emerald-500",
    reference: "bg-purple-500",
  };

  const total = memories.length || 1;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Vault Overview</h2>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${card} px-4 py-3`}>
          <p className="text-2xl font-semibold">{status.memoriesCount}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Total memories</p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-2xl font-semibold">{status.clean ? "Clean" : "Dirty"}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Vault status</p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-2xl font-semibold font-mono">{status.commit?.substring(0, 7) ?? "none"}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Last commit</p>
        </div>
        <div className={`${card} px-4 py-3`}>
          <p className="text-2xl font-semibold">{Object.keys(byProfile).length}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">Profiles</p>
        </div>
      </div>

      {/* Type distribution */}
      <div className={`${card} px-6 py-4`}>
        <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">By Type</h3>
        <div className="flex rounded-full overflow-hidden h-3 bg-stone-100 dark:bg-stone-800">
          {Object.entries(byType).map(([type, count]) => (
            <div
              key={type}
              className={`${TYPE_COLORS[type] ?? "bg-stone-400"} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${type}: ${count}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          {Object.entries(byType).map(([type, count]) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <span className={`w-2 h-2 rounded-full ${TYPE_COLORS[type] ?? "bg-stone-400"}`} />
              {type}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className={`${card} px-6 py-4`}>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">Most Accessed</h3>
          {topAccessed.length === 0 ? (
            <p className="text-sm text-stone-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topAccessed.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-sm">
                  <span className="truncate text-stone-700 dark:text-stone-300">{m.name}</span>
                  <span className="text-stone-400 dark:text-stone-500 ml-2 shrink-0">{m.importance}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${card} px-6 py-4`}>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">Recently Updated</h3>
          {recentlyUpdated.length === 0 ? (
            <p className="text-sm text-stone-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {recentlyUpdated.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-sm">
                  <span className="truncate text-stone-700 dark:text-stone-300">{m.name}</span>
                  <span className="text-stone-400 dark:text-stone-500 ml-2 shrink-0 text-xs">
                    {new Date(m.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By profile */}
      <div className={`${card} px-6 py-4`}>
        <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">By Profile</h3>
        <div className="space-y-1">
          {Object.entries(byProfile).map(([profile, count]) => (
            <button
              key={profile}
              onClick={() => onProfileClick?.(profile)}
              className="w-full flex justify-between items-center text-sm px-2 py-1 -mx-2 rounded hover:bg-[#7B7FBF]/10 transition-colors cursor-pointer group"
            >
              <span className="font-mono text-stone-700 dark:text-stone-300 group-hover:text-[#7B7FBF]">{profile}</span>
              <span className="text-stone-400 dark:text-stone-500">{count} memories</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
