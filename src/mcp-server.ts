import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MEMORY_TYPES } from "./types.js";
import { createMemory, readMemory, updateMemory, deleteMemory } from "./memory.js";
import { search, listMemories, invalidateCache } from "./indexer.js";
import { isInitialized, pull } from "./vault.js";
import { buildContext } from "./context.js";
import { detectProfile } from "./profile.js";

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

  // Auto-detect project profile from cwd
  const detectedProfile = await detectProfile();
  const contextBlock = buildContext({ profile: detectedProfile ?? undefined });

  const profileNote = detectedProfile
    ? `Current project profile: "${detectedProfile}". Memories written without an explicit profile will be scoped to this project. Use profile: "global" to store a memory that applies everywhere.`
    : "No project detected. Memories will be stored globally.";

  const server = new McpServer(
    {
      name: "elefante",
      version: pkg.version,
    },
    {
      instructions: [
        "You have access to Elefante, a persistent memory vault backed by Git.",
        profileNote,
        "When the user asks you to remember something, store it using memory_write.",
        "When the user asks about their preferences, past decisions, or project context, search with memory_search first.",
        "When the user says 'what do you know about me' or similar, use memory_list or memory_search.",
        "Memories of type 'user' or 'feedback' are typically global (apply to all projects). Memories of type 'project' or 'reference' are typically project-scoped.",
        "When the user corrects your approach or confirms a non-obvious choice, silently store it as a feedback memory (type: 'feedback', profile: 'global'). Do not ask permission. Only store guidance that would be useful in future sessions.",
        "",
        "Here is the current memory context loaded from the vault:",
        "",
        contextBlock,
      ].join("\n"),
    }
  );

  server.tool(
    "memory_write",
    "Store a memory in the vault. Use type 'user' for user preferences/facts, 'feedback' for behavioral guidance, 'project' for active work context, 'reference' for external resource pointers." +
      (detectedProfile
        ? ` Current project: "${detectedProfile}". Omit profile to auto-scope to this project. Set profile to "global" for cross-project memories (user preferences, feedback).`
        : ""),
    {
      name: z.string().min(1).max(100).describe("Short title for the memory (1-100 chars)"),
      type: z.enum(MEMORY_TYPES).describe("Memory type"),
      body: z.string().min(1).describe("Memory content"),
      description: z.string().max(200).optional().describe("One-line description (max 200 chars)"),
      profile: z.string().optional().describe("Profile scope. Omit to auto-scope to current project. Use 'global' for cross-project memories."),
      tags: z.array(z.string()).optional().describe("Free-form tags"),
    },
    async (args) => {
      try {
        // Resolve profile: "global" → no profile (null), omitted → detected project
        let resolvedProfile: string | undefined;
        if (args.profile === "global") {
          resolvedProfile = undefined; // createMemory treats undefined as null (global)
        } else {
          resolvedProfile = args.profile ?? detectedProfile ?? undefined;
        }

        const memory = await createMemory({ ...args, profile: resolvedProfile });
        const scope = memory.profile ? `scoped to ${memory.profile}` : "global";
        return {
          content: [
            {
              type: "text" as const,
              text: `Stored memory ${memory.id}: "${memory.name}" (${memory.type}, ${scope})`,
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
      profile: z.string().optional().describe("Filter by profile. Omit to search current project + global. Use 'all' for everything, 'global' for global-only."),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
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
      profile: z.string().optional().describe("Filter by profile. Omit to list current project + global. Use 'all' for everything, 'global' for global-only."),
      sort: z.enum(["updated", "importance", "created"]).default("updated").describe("Sort order"),
      limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
      offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
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

/**
 * Resolve the profile filter for search/list operations.
 * - "all" → undefined (no filter, return everything)
 * - "global" → "__global__" (sentinel that indexer treats as null-only)
 * - omitted → detected profile (current project + global)
 * - explicit value → use as-is
 */
function resolveProfileFilter(
  profile: string | undefined,
  detectedProfile: string | null
): string | undefined {
  if (profile === "all") return undefined;
  if (profile === "global") return "__global__";
  return profile ?? detectedProfile ?? undefined;
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
