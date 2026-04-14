import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MEMORY_TYPES } from "./types.js";
import { createMemory, readMemory, updateMemory, deleteMemory } from "./memory.js";
import { search, listMemories, invalidateCache } from "./indexer.js";
import { isInitialized, pull } from "./vault.js";
import { buildContext } from "./context.js";

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export async function startMcpServer(): Promise<void> {
  if (!isInitialized()) {
    console.error("Vault not initialized. Run `elefante init <repo-url>` first.");
    process.exit(1);
  }

  // Sync on startup
  await pull();
  invalidateCache();

  const contextBlock = buildContext();

  const server = new McpServer(
    {
      name: "elefante",
      version: "0.1.0",
    },
    {
      instructions: [
        "You have access to Elefante, a persistent memory vault backed by Git.",
        "When the user asks you to remember something, store it using memory_write.",
        "When the user asks about their preferences, past decisions, or project context, search with memory_search first.",
        "When the user says 'what do you know about me' or similar, use memory_list or memory_search.",
        "",
        "Here is the current memory context loaded from the vault:",
        "",
        contextBlock,
      ].join("\n"),
    }
  );

  server.tool(
    "memory_write",
    "Store a memory in the vault. Use type 'user' for user preferences/facts, 'feedback' for behavioral guidance, 'project' for active work context, 'reference' for external resource pointers.",
    {
      name: z.string().min(1).max(100).describe("Short title for the memory (1-100 chars)"),
      type: z.enum(MEMORY_TYPES).describe("Memory type"),
      body: z.string().min(1).describe("Memory content"),
      description: z.string().max(200).optional().describe("One-line description (max 200 chars)"),
      profile: z.string().optional().describe("Profile scope (omit for global)"),
      tags: z.array(z.string()).optional().describe("Free-form tags"),
    },
    async (args) => {
      try {
        const memory = await createMemory(args);
        return {
          content: [
            {
              type: "text" as const,
              text: `Stored memory ${memory.id}: "${memory.name}" (${memory.type})`,
            },
          ],
        };
      } catch (err) {
        return errorResult(`Failed to write memory: ${err instanceof Error ? err.message : err}`);
      }
    }
  );

  server.tool(
    "memory_read",
    "Retrieve a specific memory by its ID.",
    {
      id: z.string().describe("Memory ID (e.g. mem_abc123def456)"),
    },
    async ({ id }) => {
      try {
        const memory = readMemory(id);
        if (!memory) {
          return errorResult(`Memory ${id} not found`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: formatMemory(memory),
            },
          ],
        };
      } catch (err) {
        return errorResult(`Failed to read memory: ${err instanceof Error ? err.message : err}`);
      }
    }
  );

  server.tool(
    "memory_search",
    "Search the memory vault. Returns memories ranked by relevance.",
    {
      query: z.string().min(1).describe("Search query"),
      type: z.enum(MEMORY_TYPES).optional().describe("Filter by memory type"),
      profile: z.string().optional().describe("Filter by profile"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    },
    async ({ query, type, profile, limit }) => {
      try {
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
      } catch (err) {
        return errorResult(`Search failed: ${err instanceof Error ? err.message : err}`);
      }
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
      try {
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
      } catch (err) {
        return errorResult(`List failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  );

  server.tool(
    "memory_update",
    "Update an existing memory. Only provided fields are changed.",
    {
      id: z.string().describe("Memory ID to update"),
      name: z.string().min(1).max(100).optional().describe("New title"),
      type: z.enum(MEMORY_TYPES).optional().describe("New type"),
      body: z.string().min(1).optional().describe("New content"),
      description: z.string().max(200).optional().describe("New description"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    async (args) => {
      try {
        const memory = await updateMemory(args);
        if (!memory) {
          return errorResult(`Memory ${args.id} not found`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Updated memory ${memory.id}: "${memory.name}"`,
            },
          ],
        };
      } catch (err) {
        return errorResult(`Update failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  );

  server.tool(
    "memory_delete",
    "Permanently delete a memory. The content is preserved in Git history.",
    {
      id: z.string().describe("Memory ID to delete"),
    },
    async ({ id }) => {
      try {
        const deleted = await deleteMemory(id);
        if (!deleted) {
          return errorResult(`Memory ${id} not found`);
        }
        return {
          content: [{ type: "text" as const, text: `Deleted memory ${id}` }],
        };
      } catch (err) {
        return errorResult(`Delete failed: ${err instanceof Error ? err.message : err}`);
      }
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
