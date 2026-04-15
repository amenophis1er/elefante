import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Memory } from "../../src/types.js";
import {
  SAMPLE_MEMORY,
  SAMPLE_FEEDBACK_MEMORY,
  SAMPLE_PROJECT_MEMORY,
  SAMPLE_REFERENCE_MEMORY,
} from "../helpers/fixtures.js";

// Mock memory.ts to control listAllMemories
const mockMemories: Memory[] = [];
vi.mock("../../src/memory.js", () => ({
  listAllMemories: () => mockMemories,
  memoryToMeta: vi.fn(),
}));

import { buildContext } from "../../src/context.js";

beforeEach(() => {
  mockMemories.length = 0;
});

describe("buildContext", () => {
  it("returns 'No memories stored yet.' when there are no memories", () => {
    expect(buildContext()).toBe("No memories stored yet.");
  });

  it("includes Behavioral Guidance heading for a feedback memory", () => {
    mockMemories.push({ ...SAMPLE_FEEDBACK_MEMORY });
    const result = buildContext();
    expect(result).toContain("### Behavioral Guidance");
    expect(result).toContain(SAMPLE_FEEDBACK_MEMORY.name);
  });

  it("orders sections by type priority: feedback < user < project < reference", () => {
    mockMemories.push(
      { ...SAMPLE_REFERENCE_MEMORY, profile: null },
      { ...SAMPLE_MEMORY },
      { ...SAMPLE_PROJECT_MEMORY, profile: null },
      { ...SAMPLE_FEEDBACK_MEMORY },
    );
    const result = buildContext();

    const feedbackIdx = result.indexOf("### Behavioral Guidance");
    const userIdx = result.indexOf("### User Context");
    const projectIdx = result.indexOf("### Active Projects");
    const refIdx = result.indexOf("### References");

    expect(feedbackIdx).toBeLessThan(userIdx);
    expect(userIdx).toBeLessThan(projectIdx);
    expect(projectIdx).toBeLessThan(refIdx);
  });

  it("with profile: includes global + matching profile, excludes other projects", () => {
    const globalMemory: Memory = { ...SAMPLE_MEMORY, id: "mem_global_001", profile: null };
    const matchingMemory: Memory = { ...SAMPLE_PROJECT_MEMORY, id: "mem_match_001", profile: "my/project" };
    const otherMemory: Memory = { ...SAMPLE_PROJECT_MEMORY, id: "mem_other_001", profile: "other/project", name: "Other project memory" };

    mockMemories.push(globalMemory, matchingMemory, otherMemory);

    const result = buildContext({ profile: "my/project" });
    expect(result).toContain(globalMemory.name);
    expect(result).toContain(matchingMemory.name);
    expect(result).not.toContain(otherMemory.name);
  });

  it("without profile: only shows global memories (profile: null)", () => {
    const globalMemory: Memory = { ...SAMPLE_MEMORY, id: "mem_global_002", profile: null };
    const scopedMemory: Memory = { ...SAMPLE_PROJECT_MEMORY, id: "mem_scoped_001", name: "Scoped only" };

    mockMemories.push(globalMemory, scopedMemory);

    const result = buildContext();
    expect(result).toContain(globalMemory.name);
    expect(result).not.toContain(scopedMemory.name);
  });

  it("respects token budget by excluding memories that exceed char budget", () => {
    // tokenBudget: 50 means charBudget = 200
    // Each entry costs: name.length + min(body.length, 200) + 20
    // SAMPLE_FEEDBACK_MEMORY name is 19 chars, body is 52 chars => 19 + 52 + 20 = 91
    // SAMPLE_MEMORY name is 15 chars, body is 22 chars => 15 + 22 + 20 = 57
    // Total for both: 148, which fits in 200
    // Add a third that would push past 200
    const bigMemory: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_big_0001",
      type: "user",
      name: "A really long memory name for testing",
      body: "x".repeat(150),
    };

    mockMemories.push(
      { ...SAMPLE_FEEDBACK_MEMORY },
      { ...SAMPLE_MEMORY },
      bigMemory,
    );

    const result = buildContext({ tokenBudget: 50 });
    expect(result).toContain(SAMPLE_FEEDBACK_MEMORY.name);
    expect(result).toContain(SAMPLE_MEMORY.name);
    expect(result).not.toContain(bigMemory.name);
  });

  it("truncates body longer than 200 characters with '...'", () => {
    const longBody = "a".repeat(300);
    const memory: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_long_body01",
      body: longBody,
    };
    mockMemories.push(memory);

    const result = buildContext({ tokenBudget: 2000 });
    expect(result).toContain("a".repeat(197) + "...");
    expect(result).not.toContain("a".repeat(201));
  });

  it("starts with '## Memory Context (Elefante)' and includes preamble", () => {
    mockMemories.push({ ...SAMPLE_MEMORY });
    const result = buildContext();
    expect(result).toMatch(/^## Memory Context \(Elefante\)/);
    expect(result).toContain("Recalled from your memory vault.");
  });

  it("within same type, higher importance appears first", () => {
    const lowImportance: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_low_import1",
      name: "Low importance",
      importance: 1,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const highImportance: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_high_imprt1",
      name: "High importance",
      importance: 10,
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    mockMemories.push(lowImportance, highImportance);
    const result = buildContext({ tokenBudget: 2000 });

    const lowIdx = result.indexOf("Low importance");
    const highIdx = result.indexOf("High importance");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("within same type and importance, more recently updated appears first", () => {
    const older: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_older_00001",
      name: "Older memory",
      importance: 5,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const newer: Memory = {
      ...SAMPLE_MEMORY,
      id: "mem_newer_00001",
      name: "Newer memory",
      importance: 5,
      updated_at: "2026-06-01T00:00:00.000Z",
    };

    mockMemories.push(older, newer);
    const result = buildContext({ tokenBudget: 2000 });

    const olderIdx = result.indexOf("Older memory");
    const newerIdx = result.indexOf("Newer memory");
    expect(newerIdx).toBeLessThan(olderIdx);
  });
});
