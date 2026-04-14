import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MEMORY_TYPES } from "./types.js";
import { createMemory, readMemory, updateMemory, deleteMemory } from "./memory.js";
import { search, listMemories, rebuildIndex, invalidateCache } from "./indexer.js";
import { isInitialized, pull } from "./vault.js";

export async function startMcpServer(): Promise<void> {
  if (!isInitialized()) {
    console.error("Vault not initialized. Run `elefante init <repo-url>` first.");
    process.exit(1);
  }

  // Sync on startup
  await pull();
  invalidateCache();

  const server = new McpServer({
    name: "elefante",
    version: "0.1.0",
  });

  server.tool(
    "memory_write",
    "Store a memory in the vault. Use type 'user' for user preferences/facts, 'feedback' for behavioral guidance, 'project' for active work context, 'reference' for external resource pointers.",
    {
      name: z.string().max(100).describe("Short title for the memory (1-100 chars)"),
      type: z.enum(MEMORY_TYPES).describe("Memory type"),
      body: z.string().describe("Memory content"),
      description: z.string().max(200).optional().describe("One-line description (max 200 chars)"),
      profile: z.string().optional().describe("Profile scope (omit for global)"),
      tags: z.array(z.string()).optional().describe("Free-form tags"),
    },
    async (args) => {
      const memory = await createMemory(args);
      return {
        content: [
          {
            type: "text" as const,
            text: `Stored memory ${memory.id}: "${memory.name}" (${memory.type})`,
          },
        ],
      };
    }
  );

  server.tool(
    "memory_read",
    "Retrieve a specific memory by its ID.",
    {
      id: z.string().describe("Memory ID (e.g. mem_abc123def456)"),
    },
    async ({ id }) => {
      const memory = readMemory(id);
      if (!memory) {
        return {
          content: [{ type: "text" as const, text: `Memory ${id} not found` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: formatMemory(memory),
          },
        ],
      };
    }
  );

  server.tool(
    "memory_search",
    "Search the memory vault. Returns memories ranked by relevance.",
    {
      query: z.string().describe("Search query"),
      type: z.enum(MEMORY_TYPES).optional().describe("Filter by memory type"),
      profile: z.string().optional().describe("Filter by profile"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    },
    async ({ query, type, profile, limit }) => {
      const results = await search(query, { type, profile }, limit);
      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No memories found matching your query." }],
        };
      }
      const text = results
        .map((r, i) => `${i + 1}. [${r.memory.type}] **${r.memory.name}** (${r.memory.id})\n   ${truncate(r.memory.body, 200)}`)
        .join("\n\n");
      return {
        content: [{ type: "text" as const, text: `Found ${results.length} memories:\n\n${text}` }],
      };
    }
  );

  server.tool(
    "memory_list",
    "List memories in the vault. Returns metadata only (no body). Use memory_read to get full content.",
    {
      type: z.enum(MEMORY_TYPES).optional().describe("Filter by memory type"),
      profile: z.string().optional().describe("Filter by profile"),
      sort: z.enum(["updated", "importance", "created"]).default("updated").describe("Sort order"),
      limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
      offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
    },
    async ({ type, profile, sort, limit, offset }) => {
      const metas = listMemories({ type, profile, sort }, limit, offset);
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
    }
  );

  server.tool(
    "memory_update",
    "Update an existing memory. Only provided fields are changed.",
    {
      id: z.string().describe("Memory ID to update"),
      name: z.string().max(100).optional().describe("New title"),
      type: z.enum(MEMORY_TYPES).optional().describe("New type"),
      body: z.string().optional().describe("New content"),
      description: z.string().max(200).optional().describe("New description"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    async (args) => {
      const memory = await updateMemory(args);
      if (!memory) {
        return {
          content: [{ type: "text" as const, text: `Memory ${args.id} not found` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated memory ${memory.id}: "${memory.name}"`,
          },
        ],
      };
    }
  );

  server.tool(
    "memory_delete",
    "Permanently delete a memory. The content is preserved in Git history.",
    {
      id: z.string().describe("Memory ID to delete"),
    },
    async ({ id }) => {
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
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

function formatMemory(memory: {
  id: string;
  type: string;
  name: string;
  description: string | null;
  body: string;
  profile: string | null;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}): string {
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
  return lines.join("\n");
}
