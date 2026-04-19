import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api, type MemoryMeta, type Memory, type VaultStatus } from "./lib/api";
import { Header } from "./components/Timeline/Header";
import { Sidebar } from "./components/Timeline/Sidebar";
import { TimelineList, type SortBy, type Density } from "./components/Timeline/TimelineList";
import { Inspector } from "./components/Timeline/Inspector";
import { Toast } from "./components/Timeline/Toast";
import { ConfirmDelete } from "./components/Timeline/ConfirmDelete";
import { CommandPalette } from "./components/Timeline/CommandPalette";
import { TweaksPanel } from "./components/Timeline/TweaksPanel";
import type { MemoryType } from "./components/Timeline/tokens";

const LIST_LIMIT = 10000;
const TWEAKS_KEY = "elefante.timeline.tweaks";

interface Tweaks {
  density: Density;
  showAgents: boolean;
  accent: string;
  sortBy: SortBy;
  dark: boolean;
}

const systemPrefersDark = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const DEFAULT_TWEAKS: Tweaks = {
  density: "comfortable",
  showAgents: true,
  accent: "#7B7FBF",
  sortBy: "recent",
  dark: false,
};

function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    if (!raw) return { ...DEFAULT_TWEAKS, dark: systemPrefersDark() };
    return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

function saveTweaks(t: Tweaks) {
  try {
    localStorage.setItem(TWEAKS_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [memories, setMemories] = useState<MemoryMeta[]>([]);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<MemoryType | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryMeta[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQ, setPaletteQ] = useState("");
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks());

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2400);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const updateTweaks = useCallback((patch: Partial<Tweaks>) => {
    setTweaks((prev) => {
      const next = { ...prev, ...patch };
      saveTweaks(next);
      return next;
    });
  }, []);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listMemories({ sort: "updated", limit: LIST_LIMIT });
      setMemories(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", tweaks.accent);
  }, [tweaks.accent]);

  useEffect(() => {
    if (tweaks.dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [tweaks.dark]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const results = await api.search(query, {
          profile: profile ?? undefined,
          type: typeFilter ?? undefined,
          limit: 500,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSearchResults(results.map((r) => ({ ...r.memory, path: "" })));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [q, profile, typeFilter]);

  const createRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (isMod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createRef.current();
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setConfirmDel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const source = searchResults ?? memories;
    return source.filter(
      (m) =>
        (!profile || (m.profile ?? "global") === profile) &&
        (!typeFilter || m.type === typeFilter) &&
        (!agentFilter || m.author === agentFilter)
    );
  }, [searchResults, memories, profile, typeFilter, agentFilter]);

  const openMemory = async (id: string) => {
    try {
      const memory = await api.getMemory(id);
      setSelected(memory);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory");
    }
  };

  const clearFilters = () => {
    setProfile(null);
    setTypeFilter(null);
    setAgentFilter(null);
    setQ("");
  };

  const handleSave = async (
    id: string,
    data: { name?: string; body?: string; description?: string; tags?: string[]; type?: string }
  ) => {
    try {
      if (id.startsWith("draft_")) {
        const created = await api.createMemory({
          name: data.name?.trim() || "Untitled memory",
          type: (data.type as MemoryType) ?? "feedback",
          body: data.body?.trim() || "Write your memory here.",
          description: data.description,
          profile: profile ?? undefined,
        });
        await loadMemories();
        loadStatus();
        setSelected(created);
        setEditing(false);
        showToast("Remembered");
        return;
      }
      const updated = await api.updateMemory(id, data);
      setSelected(updated);
      loadMemories();
      loadStatus();
      setEditing(false);
      showToast("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleCancel = () => {
    if (selected?.id.startsWith("draft_")) {
      setSelected(null);
    }
    setEditing(false);
  };

  const handleDeleteRequest = (id: string) => {
    setConfirmDel(id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDel) return;
    try {
      await api.deleteMemory(confirmDel);
      setSelected(null);
      setConfirmDel(null);
      loadMemories();
      loadStatus();
      showToast("Forgotten — preserved in git history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setConfirmDel(null);
    }
  };

  const handleCreate = () => {
    const draft: Memory = {
      id: `draft_${Math.random().toString(16).slice(2, 10)}`,
      type: "feedback",
      name: "",
      body: "",
      description: null,
      profile: profile ?? null,
      importance: 1,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_accessed_at: null,
      author: "dashboard",
      access_count: 0,
    };
    setSelected(draft);
    setEditing(true);
  };

  useEffect(() => {
    createRef.current = handleCreate;
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--surface)",
        color: "var(--fg-display)",
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Header
        status={status}
        count={memories.length}
        onSearchClick={() => setPaletteOpen(true)}
        onNew={handleCreate}
        onSettingsClick={() => setTweaksOpen((v) => !v)}
      />

      <TweaksPanel
        open={tweaksOpen}
        onClose={() => setTweaksOpen(false)}
        density={tweaks.density}
        setDensity={(v) => updateTweaks({ density: v })}
        showAgents={tweaks.showAgents}
        setShowAgents={(v) => updateTweaks({ showAgents: v })}
        accent={tweaks.accent}
        setAccent={(v) => updateTweaks({ accent: v })}
        dark={tweaks.dark}
        setDark={(v) => updateTweaks({ dark: v })}
      />

      {error && (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 20px",
            background: "var(--danger-bg)",
            borderBottom: "1px solid var(--danger-bd)",
            color: "var(--danger-fg)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "transparent", border: 0, color: "var(--danger-fg)", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar
          memories={memories}
          profile={profile}
          setProfile={setProfile}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          agentFilter={agentFilter}
          setAgentFilter={setAgentFilter}
        />

        <main style={{ flex: 1, display: "flex", minWidth: 0 }}>
          <TimelineList
            memories={filtered}
            loading={loading || searching}
            profile={profile}
            typeFilter={typeFilter}
            agentFilter={agentFilter}
            q={q}
            setQ={setQ}
            onClearFilters={clearFilters}
            selectedId={selected?.id ?? null}
            onSelect={openMemory}
            sortBy={tweaks.sortBy}
            setSortBy={(v) => updateTweaks({ sortBy: v })}
            density={tweaks.density}
            showAgents={tweaks.showAgents}
          />
          <Inspector
            memory={selected}
            onDelete={handleDeleteRequest}
            onSave={handleSave}
            onCancel={handleCancel}
            onSelect={openMemory}
            memories={memories.map((m) => ({ id: m.id, name: m.name, type: m.type }))}
            editing={editing}
            setEditing={setEditing}
          />
        </main>
      </div>

      <ConfirmDelete
        memoryName={
          confirmDel ? memories.find((m) => m.id === confirmDel)?.name ?? null : null
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDel(null)}
      />

      <CommandPalette
        open={paletteOpen}
        memories={memories}
        query={paletteQ}
        setQuery={setPaletteQ}
        onSelect={(id) => {
          openMemory(id);
          setPaletteQ("");
        }}
        onClose={() => {
          setPaletteOpen(false);
          setPaletteQ("");
        }}
        onNewMemory={handleCreate}
        onClearFilters={clearFilters}
      />

      <Toast message={toast} />
    </div>
  );
}
