import { describe, it, expect } from "vitest";
import {
  createMemorySchema,
  updateMemorySchema,
  searchMemorySchema,
  listMemorySchema,
  MEMORY_TYPES,
} from "../../src/types.js";

describe("MEMORY_TYPES", () => {
  it("contains exactly the expected types", () => {
    expect(MEMORY_TYPES).toEqual(["user", "feedback", "project", "reference"]);
  });
});

describe("createMemorySchema", () => {
  const valid = {
    name: "test-memory",
    type: "user" as const,
    body: "some content",
  };

  it("accepts valid input", () => {
    const result = createMemorySchema.parse(valid);
    expect(result).toEqual(valid);
  });

  it("rejects missing name", () => {
    expect(() =>
      createMemorySchema.parse({ type: "user", body: "content" })
    ).toThrow();
  });

  it("rejects empty body", () => {
    expect(() =>
      createMemorySchema.parse({ name: "test", type: "user", body: "" })
    ).toThrow();
  });

  it("rejects invalid type", () => {
    expect(() =>
      createMemorySchema.parse({ name: "test", type: "invalid", body: "content" })
    ).toThrow();
  });

  it("enforces name max 100 chars", () => {
    expect(() =>
      createMemorySchema.parse({
        name: "a".repeat(101),
        type: "user",
        body: "content",
      })
    ).toThrow();

    const result = createMemorySchema.parse({
      name: "a".repeat(100),
      type: "user",
      body: "content",
    });
    expect(result.name).toHaveLength(100);
  });

  it("allows optional description with max 200 chars", () => {
    const result = createMemorySchema.parse({
      ...valid,
      description: "a short description",
    });
    expect(result.description).toBe("a short description");

    expect(() =>
      createMemorySchema.parse({
        ...valid,
        description: "d".repeat(201),
      })
    ).toThrow();
  });

  it("allows optional tags array", () => {
    const result = createMemorySchema.parse({
      ...valid,
      tags: ["tag1", "tag2"],
    });
    expect(result.tags).toEqual(["tag1", "tag2"]);

    const noTags = createMemorySchema.parse(valid);
    expect(noTags.tags).toBeUndefined();
  });

  it("allows optional profile string", () => {
    const result = createMemorySchema.parse({
      ...valid,
      profile: "owner/repo",
    });
    expect(result.profile).toBe("owner/repo");

    const noProfile = createMemorySchema.parse(valid);
    expect(noProfile.profile).toBeUndefined();
  });
});

describe("updateMemorySchema", () => {
  it("accepts partial update with just id and body", () => {
    const result = updateMemorySchema.parse({ id: "abc", body: "new body" });
    expect(result).toEqual({ id: "abc", body: "new body" });
  });

  it("requires id", () => {
    expect(() => updateMemorySchema.parse({ body: "new body" })).toThrow();
  });

  it("enforces name max 100 chars when provided", () => {
    expect(() =>
      updateMemorySchema.parse({ id: "abc", name: "a".repeat(101) })
    ).toThrow();

    const result = updateMemorySchema.parse({
      id: "abc",
      name: "a".repeat(100),
    });
    expect(result.name).toHaveLength(100);
  });
});

describe("searchMemorySchema", () => {
  it("requires query with min 1 char", () => {
    expect(() => searchMemorySchema.parse({ query: "" })).toThrow();
    expect(() => searchMemorySchema.parse({})).toThrow();

    const result = searchMemorySchema.parse({ query: "a" });
    expect(result.query).toBe("a");
  });

  it("defaults limit to 10", () => {
    const result = searchMemorySchema.parse({ query: "test" });
    expect(result.limit).toBe(10);
  });

  it("clamps limit to 1-50 range", () => {
    expect(() =>
      searchMemorySchema.parse({ query: "test", limit: 0 })
    ).toThrow();

    expect(() =>
      searchMemorySchema.parse({ query: "test", limit: 51 })
    ).toThrow();

    const low = searchMemorySchema.parse({ query: "test", limit: 1 });
    expect(low.limit).toBe(1);

    const high = searchMemorySchema.parse({ query: "test", limit: 50 });
    expect(high.limit).toBe(50);
  });
});

describe("listMemorySchema", () => {
  it("defaults sort to 'updated'", () => {
    const result = listMemorySchema.parse({});
    expect(result.sort).toBe("updated");
  });

  it("defaults limit to 20", () => {
    const result = listMemorySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("defaults offset to 0", () => {
    const result = listMemorySchema.parse({});
    expect(result.offset).toBe(0);
  });

  it("rejects invalid sort values", () => {
    expect(() => listMemorySchema.parse({ sort: "name" })).toThrow();
    expect(() => listMemorySchema.parse({ sort: "random" })).toThrow();
  });
});
