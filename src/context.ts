import type { Memory, MemoryType } from "./types.js";
import { listAllMemories } from "./memory.js";

const TYPE_PRIORITY: Record<MemoryType, number> = {
  feedback: 0,
  user: 1,
  project: 2,
  reference: 3,
};

const TYPE_HEADINGS: Record<MemoryType, string> = {
  feedback: "Behavioral Guidance",
  user: "User Context",
  project: "Active Projects",
  reference: "References",
};

const CHARS_PER_TOKEN = 4;

interface ContextOptions {
  profile?: string;
  tokenBudget?: number;
}

export function buildContext(options: ContextOptions = {}): string {
  const { profile, tokenBudget = 500 } = options;
  const charBudget = tokenBudget * CHARS_PER_TOKEN;

  let memories = listAllMemories();

  // Filter by profile: include global memories + profile-scoped ones
  if (profile) {
    memories = memories.filter(
      (m) => m.profile === null || m.profile === profile
    );
  } else {
    // No profile detected — only show global memories, not every project's
    memories = memories.filter((m) => m.profile === null);
  }

  // Sort: type priority first, then importance DESC, then recency
  memories.sort((a, b) => {
    const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    if (typeDiff !== 0) return typeDiff;
    const impDiff = b.importance - a.importance;
    if (impDiff !== 0) return impDiff;
    return b.updated_at.localeCompare(a.updated_at);
  });

  // Take top candidates (no more than 30)
  const candidates = memories.slice(0, 30);

  // Pack into budget, grouped by type
  const grouped: Partial<Record<MemoryType, Memory[]>> = {};
  let totalChars = 0;

  for (const memory of candidates) {
    const entrySize = memory.name.length + Math.min(memory.body.length, 200) + 20;
    if (totalChars + entrySize > charBudget) continue;

    if (!grouped[memory.type]) grouped[memory.type] = [];
    grouped[memory.type]!.push(memory);
    totalChars += entrySize;
  }

  // Format
  if (Object.keys(grouped).length === 0) {
    return "No memories stored yet.";
  }

  const sections: string[] = [];

  for (const type of ["feedback", "user", "project", "reference"] as MemoryType[]) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    sections.push(`### ${TYPE_HEADINGS[type]}`);
    for (const m of items) {
      const body = m.body.length > 200
        ? m.body.substring(0, 197) + "..."
        : m.body;
      sections.push(`- **${m.name}**: ${body}`);
    }
    sections.push("");
  }

  return `## Memory Context (Elefante)\n\nRecalled from your memory vault. Use memory tools to search, update, or add more.\n\n${sections.join("\n")}`.trim();
}
