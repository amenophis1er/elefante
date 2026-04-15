import type { Memory, CreateMemoryInput } from "../../src/types.js";

export const SAMPLE_CREATE_INPUT: CreateMemoryInput = {
  name: "Test preference",
  type: "user",
  body: "User prefers dark mode",
  description: "UI preference",
  tags: ["ui", "theme"],
};

export const SAMPLE_MEMORY: Memory = {
  id: "mem_test123456",
  type: "user",
  name: "Test preference",
  body: "User prefers dark mode",
  description: "UI preference",
  profile: null,
  importance: 0,
  tags: ["ui", "theme"],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_accessed_at: null,
};

// Add more fixtures for different memory types
export const SAMPLE_FEEDBACK_MEMORY: Memory = {
  id: "mem_feedback0001",
  type: "feedback",
  name: "No database mocking",
  body: "Integration tests must hit a real database, not mocks.",
  description: "Testing guidance",
  profile: null,
  importance: 5,
  tags: ["testing"],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-05T00:00:00.000Z",
  last_accessed_at: null,
};

export const SAMPLE_PROJECT_MEMORY: Memory = {
  id: "mem_project0001",
  type: "project",
  name: "Auth rewrite",
  body: "Rewriting auth middleware for compliance.",
  description: "Active project",
  profile: "owner/repo",
  importance: 3,
  tags: ["auth"],
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-10T00:00:00.000Z",
  last_accessed_at: null,
};

export const SAMPLE_REFERENCE_MEMORY: Memory = {
  id: "mem_ref00000001",
  type: "reference",
  name: "Grafana dashboard",
  body: "grafana.internal/d/api-latency is the oncall dashboard.",
  description: "External reference",
  profile: "owner/repo",
  importance: 1,
  tags: ["monitoring"],
  created_at: "2026-01-03T00:00:00.000Z",
  updated_at: "2026-01-03T00:00:00.000Z",
  last_accessed_at: null,
};
