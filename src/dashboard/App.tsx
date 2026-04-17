import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, type MemoryMeta, type Memory, type VaultStatus } from "./lib/api";
import { useTheme } from "./lib/theme";
import { MemoryList } from "./components/MemoryList";
import { MemoryDetail } from "./components/MemoryDetail";
import { SearchBar } from "./components/SearchBar";
import { Filters } from "./components/Filters";
import { VaultOverview } from "./components/VaultOverview";
import { ThemeToggle } from "./components/ThemeToggle";
import { ConfirmDialog } from "./components/ConfirmDialog";

type View = "memories" | "overview";

type FilterState = { type?: string; sort?: string; profile?: string; tag?: string };
const DEFAULT_FILTERS: FilterState = { sort: "updated" };
const LIST_LIMIT = 10000;
const SEARCH_LIMIT = 1000;

export default function App() {
  const { theme, cycle } = useTheme();
  const [view, setView] = useState<View>("overview");
  const [memories, setMemories] = useState<MemoryMeta[]>([]);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (searchQuery) {
        const results = await api.search(searchQuery, { type: filters.type, profile: filters.profile, limit: SEARCH_LIMIT });
        setMemories(results.map((r) => ({ ...r.memory, path: "" })));
      } else {
        const list = await api.listMemories({ ...filters, limit: LIST_LIMIT, offset: 0 });
        setMemories(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  const profiles = useMemo(
    () => [...new Set(memories.map((m) => m.profile ?? "global"))].sort(),
    [memories]
  );
  const allTags = useMemo(
    () => [...new Set(memories.flatMap((m) => m.tags))].sort(),
    [memories]
  );

  const filteredMemories = useMemo(
    () => (filters.tag ? memories.filter((m) => m.tags.includes(filters.tag!)) : memories),
    [memories, filters.tag]
  );

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadMemories();
    loadStatus();
  }, [loadMemories, loadStatus]);

  const openMemory = async (id: string) => {
    try {
      const memory = await api.getMemory(id);
      setSelected(memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory");
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteMemory(deleteTarget);
      setSelected(null);
      setDeleteTarget(null);
      loadMemories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleteTarget(null);
    }
  };

  const handleUpdate = async (id: string, data: { name?: string; body?: string; description?: string; tags?: string[] }) => {
    try {
      const updated = await api.updateMemory(id, data);
      setSelected(updated);
      loadMemories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleSync = async () => {
    try {
      await api.sync();
      loadMemories();
      loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      {/* Header */}
      <header className="shrink-0 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => { setView("overview"); }}
            className="flex items-center gap-2.5 hover:opacity-70 transition-opacity"
          >
            <svg viewBox="0 0 120 120" fill="none" className="w-7 h-7">
              <rect x="4" y="4" width="112" height="112" rx="24" fill="#7B7FBF"/>
              <circle cx="60" cy="62" r="24" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="120 31" strokeDashoffset="-10"/>
              <line x1="38" y1="58" x2="82" y2="58" stroke="white" strokeWidth="8" strokeLinecap="round"/>
            </svg>
            <h1 className="text-lg font-semibold tracking-tight text-[#2D2F45] dark:text-stone-100">elefante</h1>
          </button>
          <nav className="flex items-center gap-3">
            <button
              onClick={() => setView("overview")}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${view === "overview" ? "bg-[#7B7FBF]/10 text-[#7B7FBF]" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("memories")}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${view === "memories" ? "bg-[#7B7FBF]/10 text-[#7B7FBF]" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"}`}
            >
              Memories
            </button>
            <button
              onClick={handleSync}
              className="text-sm px-3 py-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Sync vault"
            >
              Sync
            </button>
            <ThemeToggle theme={theme} onCycle={cycle} />
          </nav>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-6 pt-3">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 dark:hover:text-red-300 font-medium ml-4">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {view === "overview" && status && (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <VaultOverview
            status={status}
            memories={filteredMemories}
            onProfileClick={(profile) => {
              setFilters({ ...DEFAULT_FILTERS, profile: profile === "global" ? undefined : profile });
              setView("memories");
            }}
            onTotalClick={() => {
              setFilters(DEFAULT_FILTERS);
              setSearchQuery("");
              setView("memories");
            }}
          />
          </div>
        </main>
      )}

      {view === "memories" && (
        <div className="flex-1 flex min-h-0">
          {/* Left panel: list — full width on mobile, fixed sidebar on desktop */}
          <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-[380px] shrink-0 md:border-r border-stone-200 dark:border-stone-800 flex-col bg-white dark:bg-stone-900`}>
            {/* Search + filters */}
            <div className="shrink-0 p-3 border-b border-stone-200 dark:border-stone-800 space-y-2">
              <SearchBar value={searchQuery} onChange={(q) => setSearchQuery(q)} />
              <Filters
                type={filters.type}
                sort={filters.sort}
                profile={filters.profile}
                tag={filters.tag}
                searchQuery={searchQuery}
                profiles={profiles}
                tags={allTags}
                onTypeChange={(type) => setFilters((f) => ({ ...f, type }))}
                onSortChange={(sort) => setFilters((f) => ({ ...f, sort }))}
                onProfileChange={(profile) => setFilters((f) => ({ ...f, profile }))}
                onTagChange={(tag) => setFilters((f) => ({ ...f, tag }))}
                onReset={() => { setFilters(DEFAULT_FILTERS); setSearchQuery(""); }}
              />
            </div>
            {/* Memory count */}
            <div className="shrink-0 px-4 py-2 border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
              {loading ? "Loading..." : `${filteredMemories.length} ${filteredMemories.length === 1 ? "memory" : "memories"}`}
            </div>
            {/* Memory list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center text-stone-400 py-12">Loading...</div>
              ) : (
                <MemoryList
                  memories={filteredMemories}
                  selectedId={selected?.id ?? null}
                  onSelect={openMemory}
                />
              )}
            </div>
          </div>

          {/* Right panel: detail — full width on mobile, flex on desktop */}
          <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 flex-col min-h-0`}>
            {selected ? (
              <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden shrink-0 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center gap-1 mb-4 transition-colors"
                >
                  <span>&larr;</span> Back to list
                </button>
                <MemoryDetail
                  memory={selected}
                  onDelete={handleDeleteRequest}
                  onUpdate={handleUpdate}
                  onTagClick={(tag) => setFilters((f) => ({ ...f, tag }))}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-stone-400 dark:text-stone-600">
                <div className="text-center">
                  <svg viewBox="0 0 120 120" fill="none" className="w-16 h-16 mx-auto mb-4 opacity-30">
                    <rect x="4" y="4" width="112" height="112" rx="24" fill="currentColor"/>
                    <circle cx="60" cy="62" r="24" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="120 31" strokeDashoffset="-10"/>
                    <line x1="38" y1="58" x2="82" y2="58" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                  </svg>
                  <p className="text-sm">Select a memory to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete memory"
        message="This memory will be removed from the vault. It will still be preserved in Git history."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
