const token = new URLSearchParams(window.location.search).get("token") ?? "";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${separator}token=${token}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export interface MemoryMeta {
  id: string;
  type: "user" | "feedback" | "project" | "reference";
  name: string;
  description: string | null;
  profile: string | null;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  author: string;
  access_count: number;
  path: string;
}

export interface Memory extends Omit<MemoryMeta, "path"> {
  body: string;
  related?: string[];
}

export interface SearchResult {
  memory: Memory;
  score: number;
}

export interface VaultStatus {
  initialized: boolean;
  clean: boolean;
  commit: string | null;
  memoriesCount: number;
}

export const api = {
  listMemories(params?: {
    type?: string;
    profile?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<MemoryMeta[]> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.profile) qs.set("profile", params.profile);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request(`/memories${q ? `?${q}` : ""}`);
  },

  getMemory(id: string): Promise<Memory> {
    return request(`/memories/${id}`);
  },

  createMemory(data: {
    name: string;
    type: string;
    body: string;
    description?: string;
    profile?: string;
    tags?: string[];
  }): Promise<Memory> {
    return request("/memories", { method: "POST", body: JSON.stringify(data) });
  },

  updateMemory(id: string, data: {
    name?: string;
    type?: string;
    body?: string;
    description?: string;
    tags?: string[];
  }): Promise<Memory> {
    return request(`/memories/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteMemory(id: string): Promise<{ deleted: boolean }> {
    return request(`/memories/${id}`, { method: "DELETE" });
  },

  search(q: string, params?: { type?: string; profile?: string; limit?: number }): Promise<SearchResult[]> {
    const qs = new URLSearchParams({ q });
    if (params?.type) qs.set("type", params.type);
    if (params?.profile) qs.set("profile", params.profile);
    if (params?.limit) qs.set("limit", String(params.limit));
    return request(`/search?${qs}`);
  },

  getStatus(): Promise<VaultStatus> {
    return request("/status");
  },

  sync(): Promise<{ synced: boolean }> {
    return request("/sync", { method: "POST" });
  },
};
