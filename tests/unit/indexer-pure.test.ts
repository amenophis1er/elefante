import { describe, it, expect } from "vitest";
import { extractKeywords, extractTrigrams } from "../../src/indexer.js";

describe("extractKeywords", () => {
  it("lowercases input", () => {
    expect(extractKeywords("TypeScript")).toContain("typescript");
  });

  it("strips punctuation", () => {
    expect(extractKeywords("hello, world!")).toEqual(["hello", "world"]);
  });

  it("filters stopwords", () => {
    const result = extractKeywords("the quick brown fox");
    expect(result).toEqual(["quick", "brown", "fox"]);
  });

  it("filters short words (<=2 chars)", () => {
    const result = extractKeywords("I do go");
    expect(result).toEqual([]);
  });

  it("deduplicates", () => {
    expect(extractKeywords("test test test")).toEqual(["test"]);
  });

  it("returns empty array for empty string", () => {
    expect(extractKeywords("")).toEqual([]);
  });

  it("preserves hyphens", () => {
    expect(extractKeywords("real-time updates")).toContain("real-time");
  });

  it("handles mixed input", () => {
    const result = extractKeywords("The user prefers dark mode in TypeScript");
    expect(result).toEqual(["user", "prefers", "dark", "mode", "typescript"]);
  });
});

describe("extractTrigrams", () => {
  it("generates trigrams from a single word", () => {
    expect(extractTrigrams("testing")).toEqual(["tes", "est", "sti", "tin", "ing"]);
  });

  it("filters words shorter than 3 chars", () => {
    expect(extractTrigrams("I am ok")).toEqual([]);
  });

  it("strips punctuation before generating trigrams", () => {
    const result = extractTrigrams("hello!");
    const expected = ["hel", "ell", "llo"];
    expect(result).toEqual(expected);
  });

  it("produces trigrams from multiple qualifying words", () => {
    const result = extractTrigrams("testing code");
    expect(result).toContain("tes");
    expect(result).toContain("cod");
    expect(result).toContain("ode");
  });

  it("returns empty array for empty string", () => {
    expect(extractTrigrams("")).toEqual([]);
  });

  it("excludes stopwords from trigram generation", () => {
    const result = extractTrigrams("the quick");
    // "the" is a stopword, so no trigrams from it
    expect(result).not.toContain("the");
    // "quick" should produce trigrams
    expect(result).toContain("qui");
    expect(result).toContain("uic");
    expect(result).toContain("ick");
  });
});
