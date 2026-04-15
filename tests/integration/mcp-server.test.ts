import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTempVault } from "../helpers/vault-harness.js";

// --- Hoisted mocks (must be before imports that use them) ---

const { mockVaultDir } = vi.hoisted(() => {
  return { mockVaultDir: { value: "" } };
});

vi.mock("../../src/auth.js", () => ({
  get VAULT_DIR() { return mockVaultDir.value; },
  resolveAuth: vi.fn(),
}));

vi.mock("../../src/vault.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/vault.js")>();
  return {
    ...original,
    pull: vi.fn().mockResolvedValue({ status: "ok", message: "mocked" }),
    push: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    isAhead: vi.fn().mockResolvedValue(false),
    isBehind: vi.fn().mockResolvedValue(false),
    pullBeforeWrite: vi.fn().mockResolvedValue(undefined),
    syncOnce: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockReturnValue({
      index: { auto_rebuild: true },
      memory: { max_body_length: 10000 },
      sync: { commit_strategy: "immediate", batch_window_ms: 5000, push_strategy: "async", poll_interval_s: 60 },
    }),
  };
});

vi.mock("../../src/profile.js", () => ({
  detectProfile: vi.fn().mockResolvedValue("test-owner/test-repo"),
  isValidProfile: vi.fn().mockReturnValue(true),
  normalizeRemote: vi.fn((url: string) => url),
}));

// --- Imports (after mocks) ---

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

import { MEMORY_TYPES } from "../../src/types.js";
import { createMemory, readMemory, updateMemory, deleteMemory } from "../../src/memory.js";
import { search, listMemories, invalidateCache } from "../../src/indexer.js";
import { buildContext } from "../../src/context.js";

// --- Helpers ---

function getTextContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  if ("content" in result && Array.isArray(result.content)) {
    return result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function isError(result: Awaited<ReturnType<Client["callTool"]>>): boolean {
  return "isError" in result && result.isError === true;
}

/**
 * Creates and connects an MCP server + client pair using InMemoryTransport.
 * Registers the same tools as src/mcp-server.ts.
 */
async function createMcpTestHarness(detectedProfile: string | null = "test-owner/test-repo") {
  const contextBlock = buildContext({ profile: detectedProfile ?? undefined });

  const profileNote = detectedProfile
    ? `Current project profile: "${detectedProfile}".`
    : "No project detected. Memories will be stored globally.";

  const server = new McpServer(
    { name: "elefante", version: "0.0.0-test" },
    {
      instructions: [
        "Test MCP server instance.",
        profileNote,
        contextBlock,
      ].join("\n"),
    }
  );

  // --- Register tools (mirrors src/mcp-server.ts) ---

  server.tool(
    "memory_write",
    "Store a memory in the vault.",
    {
      name: z.string().min(1).max(100),
      type: z.enum(MEMORY_TYPES),
      body: z.string().min(1),
      description: z.string().max(200).optional(),
      profile: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        let resolvedProfile: string | undefined;
        if (args.profile === "global") {
          resolvedProfile = undefined;
        } else {
          resolvedProfile = args.profile ?? detectedProfile ?? undefined;
        }
        const memory = await createMemory({ ...args, profile: resolvedProfile });
        const scope = memory.profile ? `scoped to ${memory.profile}` : "global";
        return {
          content: [{ type: "text" as const, text: `Stored memory ${memory.id}: "${memory.name}" (${memory.type}, ${scope})` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to write memory: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "memory_read",
    "Retrieve a specific memory by its ID.",
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const memory = readMemory(id);
        if (!memory) {
          return {
            content: [{ type: "text" as const, text: `Memory ${id} not found` }],
            isError: true,
          };
        }
        const lines = [
          `# ${memory.name}`,
          `**ID:** ${memory.id}`,
          `**Type:** ${memory.type}`,
        ];
        if (memory.description) lines.push(`**Description:** ${memory.description}`);
        if (memory.profile) lines.push(`**Profile:** ${memory.profile}`);
        if (memory.tags.length > 0) lines.push(`**Tags:** ${memory.tags.join(", ")}`);
        lines.push(`**Importance:** ${memory.importance}`);
        lines.push(`**Updated:** ${memory.updated_at}`);
        lines.push("");
        lines.push(memory.body);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to read memory: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "memory_search",
    "Search the memory vault.",
    {
      query: z.string().min(1),
      type: z.enum(MEMORY_TYPES).optional(),
      profile: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
    async ({ query, type, profile, limit }) => {
      try {
        const resolvedProfile = resolveProfileFilter(profile, detectedProfile);
        const results = await search(query, { type, profile: resolvedProfile }, limit);
        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No memories found matching your query." }],
          };
        }
        const text = results
          .map((r, i) => `${i + 1}. [${r.memory.type}] **${r.memory.name}** (${r.memory.id})\n   ${r.memory.body.substring(0, 200)}`)
          .join("\n\n");
        return {
          content: [{ type: "text" as const, text: `Found ${results.length} memories:\n\n${text}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "memory_list",
    "List memories in the vault.",
    {
      type: z.enum(MEMORY_TYPES).optional(),
      profile: z.string().optional(),
      sort: z.enum(["updated", "importance", "created"]).default("updated"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
    async ({ type, profile, sort, limit, offset }) => {
      try {
        const resolvedProfile = resolveProfileFilter(profile, detectedProfile);
        const metas = listMemories({ type, profile: resolvedProfile, sort }, limit, offset);
        if (metas.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No memories found." }],
          };
        }
        const text = metas
          .map((m) => `- [${m.type}] **${m.name}** (${m.id})${m.description ? ` — ${m.description}` : ""}`)
          .join("\n");
        return {
          content: [{ type: "text" as const, text: `${metas.length} memories:\n\n${text}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `List failed: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "memory_update",
    "Update an existing memory.",
    {
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      type: z.enum(MEMORY_TYPES).optional(),
      body: z.string().min(1).optional(),
      description: z.string().max(200).optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        const memory = await updateMemory(args);
        if (!memory) {
          return {
            content: [{ type: "text" as const, text: `Memory ${args.id} not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Updated memory ${memory.id}: "${memory.name}"` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Update failed: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "memory_delete",
    "Permanently delete a memory.",
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const deleted = await deleteMemory(id);
        if (!deleted) {
          return {
            content: [{ type: "text" as const, text: `Memory ${id} not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Deleted memory ${id}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Delete failed: ${err instanceof Error ? err.message : err}` }],
          isError: true,
        };
      }
    }
  );

  // --- Connect via InMemoryTransport ---

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);

  return {
    client,
    server,
    async cleanup() {
      await client.close();
      await server.close();
    },
  };
}

function resolveProfileFilter(
  profile: string | undefined,
  detectedProfile: string | null
): string | undefined {
  if (profile === "all") return undefined;
  if (profile === "global") return "__global__";
  return profile ?? detectedProfile ?? undefined;
}

// --- Tests ---

describe("MCP server integration", () => {
  let vaultCleanup: () => void;
  let mcpCleanup: () => Promise<void>;
  let client: Client;

  beforeEach(async () => {
    const vault = await createTempVault();
    mockVaultDir.value = vault.dir;
    vaultCleanup = vault.cleanup;
    invalidateCache();

    const harness = await createMcpTestHarness();
    client = harness.client;
    mcpCleanup = harness.cleanup;
  });

  afterEach(async () => {
    await mcpCleanup();
    vaultCleanup();
  });

  it("lists all registered tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "memory_delete",
      "memory_list",
      "memory_read",
      "memory_search",
      "memory_update",
      "memory_write",
    ]);
  });

  describe("full CRUD lifecycle", () => {
    let memoryId: string;

    it("writes a memory and returns its ID", async () => {
      const result = await client.callTool({
        name: "memory_write",
        arguments: {
          name: "Test memory",
          type: "user",
          body: "Test body content",
          profile: "global",
        },
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("Stored memory");
      expect(text).toContain("Test memory");

      // Extract ID
      const match = text.match(/mem_[a-zA-Z0-9_-]+/);
      expect(match).not.toBeNull();
      memoryId = match![0];
    });

    it("reads the written memory", async () => {
      // Write first
      const writeResult = await client.callTool({
        name: "memory_write",
        arguments: { name: "Readable memory", type: "user", body: "Read me", profile: "global" },
      });
      const id = getTextContent(writeResult).match(/mem_[a-zA-Z0-9_-]+/)![0];

      const result = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("Readable memory");
      expect(text).toContain("Read me");
      expect(text).toContain(id);
    });

    it("searches for memories", async () => {
      await client.callTool({
        name: "memory_write",
        arguments: { name: "Searchable item", type: "user", body: "Unique search content xyz", profile: "global" },
      });

      const result = await client.callTool({
        name: "memory_search",
        arguments: { query: "searchable unique xyz" },
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("Found");
      expect(text).toContain("Searchable item");
    });

    it("lists memories", async () => {
      await client.callTool({
        name: "memory_write",
        arguments: { name: "Listable memory", type: "feedback", body: "List me", profile: "global" },
      });

      const result = await client.callTool({
        name: "memory_list",
        arguments: {},
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("Listable memory");
      expect(text).toMatch(/\d+ memories/);
    });

    it("updates a memory", async () => {
      const writeResult = await client.callTool({
        name: "memory_write",
        arguments: { name: "Updatable memory", type: "user", body: "Original body", profile: "global" },
      });
      const id = getTextContent(writeResult).match(/mem_[a-zA-Z0-9_-]+/)![0];

      const updateResult = await client.callTool({
        name: "memory_update",
        arguments: { id, body: "Updated body" },
      });

      expect(isError(updateResult)).toBe(false);
      expect(getTextContent(updateResult)).toContain("Updated memory");

      // Verify the update took effect
      const readResult = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });

      expect(getTextContent(readResult)).toContain("Updated body");
      expect(getTextContent(readResult)).not.toContain("Original body");
    });

    it("deletes a memory", async () => {
      const writeResult = await client.callTool({
        name: "memory_write",
        arguments: { name: "Deletable memory", type: "user", body: "Delete me", profile: "global" },
      });
      const id = getTextContent(writeResult).match(/mem_[a-zA-Z0-9_-]+/)![0];

      const deleteResult = await client.callTool({
        name: "memory_delete",
        arguments: { id },
      });

      expect(isError(deleteResult)).toBe(false);
      expect(getTextContent(deleteResult)).toContain("Deleted memory");

      // Verify it's gone
      const readResult = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });

      expect(isError(readResult)).toBe(true);
      expect(getTextContent(readResult)).toContain("not found");
    });
  });

  describe("sequential write-read-search-list-update-delete flow", () => {
    it("performs the full lifecycle in order", async () => {
      // Step 1: Write
      const writeResult = await client.callTool({
        name: "memory_write",
        arguments: {
          name: "Flow test memory",
          type: "user",
          body: "Flow test body",
          profile: "global",
        },
      });
      const writeText = getTextContent(writeResult);
      expect(isError(writeResult)).toBe(false);
      const id = writeText.match(/mem_[a-zA-Z0-9_-]+/)![0];

      // Step 2: Read
      const readResult = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });
      expect(isError(readResult)).toBe(false);
      expect(getTextContent(readResult)).toContain("Flow test memory");
      expect(getTextContent(readResult)).toContain("Flow test body");

      // Step 3: Search
      const searchResult = await client.callTool({
        name: "memory_search",
        arguments: { query: "flow test" },
      });
      expect(isError(searchResult)).toBe(false);
      expect(getTextContent(searchResult)).toContain("Found");

      // Step 4: List
      const listResult = await client.callTool({
        name: "memory_list",
        arguments: {},
      });
      expect(isError(listResult)).toBe(false);
      expect(getTextContent(listResult)).toContain("Flow test memory");

      // Step 5: Update
      const updateResult = await client.callTool({
        name: "memory_update",
        arguments: { id, body: "Updated flow body" },
      });
      expect(isError(updateResult)).toBe(false);
      expect(getTextContent(updateResult)).toContain("Updated memory");

      // Step 6: Read after update
      const readAfterUpdate = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });
      expect(isError(readAfterUpdate)).toBe(false);
      expect(getTextContent(readAfterUpdate)).toContain("Updated flow body");

      // Step 7: Delete
      const deleteResult = await client.callTool({
        name: "memory_delete",
        arguments: { id },
      });
      expect(isError(deleteResult)).toBe(false);
      expect(getTextContent(deleteResult)).toContain("Deleted memory");

      // Step 8: Read after delete
      const readAfterDelete = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });
      expect(isError(readAfterDelete)).toBe(true);
      expect(getTextContent(readAfterDelete)).toContain("not found");
    });
  });

  describe("profile auto-scoping", () => {
    it("auto-scopes to detected profile when profile is omitted", async () => {
      const result = await client.callTool({
        name: "memory_write",
        arguments: {
          name: "Auto-scoped memory",
          type: "project",
          body: "Should be scoped to test-owner/test-repo",
        },
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("scoped to test-owner/test-repo");

      // Read it back and verify the profile
      const id = text.match(/mem_[a-zA-Z0-9_-]+/)![0];
      const readResult = await client.callTool({
        name: "memory_read",
        arguments: { id },
      });
      expect(getTextContent(readResult)).toContain("test-owner/test-repo");
    });

    it("stores globally when profile is set to 'global'", async () => {
      const result = await client.callTool({
        name: "memory_write",
        arguments: {
          name: "Global memory",
          type: "user",
          body: "This is global",
          profile: "global",
        },
      });

      const text = getTextContent(result);
      expect(isError(result)).toBe(false);
      expect(text).toContain("global");
    });
  });

  describe("error cases", () => {
    it("returns error for reading a non-existent memory", async () => {
      const result = await client.callTool({
        name: "memory_read",
        arguments: { id: "mem_doesnotexist" },
      });

      expect(isError(result)).toBe(true);
      expect(getTextContent(result)).toContain("not found");
    });

    it("returns error for updating a non-existent memory", async () => {
      const result = await client.callTool({
        name: "memory_update",
        arguments: { id: "mem_doesnotexist", body: "nope" },
      });

      expect(isError(result)).toBe(true);
      expect(getTextContent(result)).toContain("not found");
    });

    it("returns error for deleting a non-existent memory", async () => {
      const result = await client.callTool({
        name: "memory_delete",
        arguments: { id: "mem_doesnotexist" },
      });

      expect(isError(result)).toBe(true);
      expect(getTextContent(result)).toContain("not found");
    });

    it("search returns no-results message for unmatched query", async () => {
      const result = await client.callTool({
        name: "memory_search",
        arguments: { query: "zzzznonexistenttermzzzz" },
      });

      expect(isError(result)).toBe(false);
      expect(getTextContent(result)).toContain("No memories found");
    });

    it("list returns no-results message on empty vault", async () => {
      const result = await client.callTool({
        name: "memory_list",
        arguments: {},
      });

      expect(isError(result)).toBe(false);
      expect(getTextContent(result)).toContain("No memories found");
    });
  });
});
