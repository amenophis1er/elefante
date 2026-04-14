# Elefante Protocol Specification

**Version:** 0.1.0-draft  
**Status:** Draft  
**Authors:** Amen  
**Date:** 2026-04-14

---

## Abstract

Elefante is the open, Git-native memory protocol for MCP agents: portable, inspectable, versioned, and human-editable.

It defines a standard format for storing, retrieving, and searching AI agent memories using a Git repository as the storage backend — no server, no database, no infrastructure beyond a Git remote.

Memory is not only retrieval. It is also **ownership**, **auditability**, and **portability**. Today's agent memory systems optimize for retrieval quality while locking users into opaque, vendor-controlled storage. Elefante makes a different trade-off: your memory lives in a Git repo you own, as Markdown files you can read, with a full version history you can audit, using credentials you already have. Any agent that speaks MCP can read and write to it. Any human can read and edit it with a text editor.

---

## 1. Motivation

### 1.1 The Problem

AI agents are stateless by default. Between sessions, they forget everything — user preferences, project context, past mistakes, validated approaches. Several solutions exist, but they all share a deeper problem: they treat memory as a retrieval engineering challenge while ignoring the governance questions that matter more.

- **Vendor-locked.** Claude's memory works only with Claude. ChatGPT's memory works only with ChatGPT. Codex has its own. None interoperate. Switching agents means starting from zero.
- **Opaque.** Users cannot inspect, edit, or audit what the agent "remembers." Memory is a black box controlled by the provider. You cannot `git diff` what changed, `git blame` who changed it, or `git revert` a bad memory.
- **Server-dependent.** Self-hosted alternatives (like Mem0, Zep, or custom memory APIs) require running a server, a database, and often a vector store — infrastructure that most individual developers and small teams don't want to maintain for what is fundamentally a small amount of structured text.
- **Non-portable.** There is no export format, no migration path, no standard. Your accumulated context is trapped.

### 1.2 The Insight

The competitive landscape is crowded with systems optimizing for **retrieval quality** — better embeddings, smarter chunking, graph-aware memory. Elefante does not compete on that axis. Instead, it recognizes that for the target audience (solo developers, CLI-first power users, privacy-conscious teams), the unsolved problems are:

- **Who owns my agent's memory?** You do. It's a Git repo.
- **What does my agent think it knows about me?** `cat memories/user/*.md` and find out.
- **What changed since last week?** `git log --since="1 week ago"`.
- **How do I use the same memory across Claude, Codex, and Cursor?** Point them at the same MCP server.
- **How do I back it up?** Every clone is a full backup.
- **How do I undo a bad memory?** `git revert`.

### 1.3 The Thesis

A Git repository — specifically, a private Git remote — already solves most of the hard problems in persistent storage:

| Requirement | Git provides |
|---|---|
| Durability | Replicated across remotes and local clones |
| Versioning | Full history of every change, with attribution |
| Audit trail | `git log` and `git blame` for free |
| Access control | SSH keys, deploy keys, PATs, fine-grained tokens |
| Portability | `git clone` gives you everything |
| Human readability | Files are files — browse in GitHub UI or any editor |
| Offline access | Local clone works without network |
| Collaboration | PRs, branch protection, CODEOWNERS |
| Cost | Free (GitHub/GitLab private repos) |
| Backup | Every clone is a full backup |

What Git does **not** provide — and what Elefante adds — is a structured memory model, a search mechanism, an MCP interface, and conventions that make a pile of files useful to an AI agent.

### 1.4 Target Audience

Elefante is built for:

- **Solo developers** who use AI agents daily and want persistent context across sessions.
- **Power users** running Claude Code, Codex, Cursor, or other MCP-compatible agent stacks.
- **Local-first / privacy-sensitive users** who want memory on infrastructure they control.
- **Teams that care about auditability** more than fancy semantic retrieval.
- **"Portable agent workspace" setups**, especially for coding agents that move between machines.

Elefante is **not** built for:

- Enterprises wanting multi-user, permissions-aware, high-scale shared memory. (Yet.)
- Users who prioritize "best retrieval quality" above all else — embeddings-based systems will outperform on pure recall.
- Teams happy with managed SaaS memory who don't care where it lives.

### 1.5 Design Goals

1. **Zero infrastructure.** No server, no database, no Docker, no cloud functions. A Git remote and a local process.
2. **Agent-agnostic.** Any agent that supports MCP can use Elefante. The protocol does not assume Claude, GPT, or any specific provider.
3. **Human-readable and human-editable.** Memories are Markdown files. A user should be able to open the vault in GitHub, read any memory, and edit it with confidence.
4. **Zero-config for most users.** If `git` or `gh` is installed and authenticated, Elefante should work without any additional setup.
5. **Offline-first.** The local clone is the source of truth for reads. Network is only needed for sync.
6. **Inspectable.** No hidden state. Everything is in the repo — memories, indexes, configuration.

### 1.6 Non-Goals

- **Real-time collaboration.** Elefante is designed for single-user or low-concurrency use. It is not a real-time database.
- **Embeddings-based semantic search.** The core protocol uses keyword/trigram indexing. Semantic search may be added as an optional extension but is not required for compliance.
- **Large binary storage.** Memories are text. Images, audio, and other binary data are out of scope for the core protocol.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **Vault** | A Git repository that conforms to the Elefante directory structure and contains memory files. |
| **Memory** | A single unit of persistent context, stored as one Markdown file with YAML frontmatter. |
| **Profile** | A named scope that partitions memories. Typically one profile per project, agent, or context. |
| **Index** | A generated JSON file that enables fast search and listing without reading every memory file. |
| **MCP Server** | A local stdio process that exposes Elefante operations as MCP tools to AI agents. |
| **Provider** | The storage backend implementation. The reference provider is GitHub, but the protocol is provider-agnostic (GitLab, Gitea, local bare repo, etc.). |

---

## 3. Memory Model

### 3.1 Memory Types

Elefante defines four canonical memory types. These are intentionally constrained — a small, fixed taxonomy forces agents to classify what they store, which improves retrieval quality.

| Type | Purpose | Example |
|---|---|---|
| `user` | Facts about the user — role, preferences, expertise, working style. | "User prefers TypeScript strict mode" |
| `feedback` | Guidance on agent behavior — corrections, confirmations, process preferences. | "Don't mock the database in integration tests" |
| `project` | Active context about ongoing work — goals, deadlines, decisions, blockers. | "Migrating to GraphQL by Q3 2026" |
| `reference` | Pointers to external resources — URLs, tools, dashboards, documentation. | "Oncall dashboard at grafana.internal/d/api-latency" |

Implementations MUST support all four types. The taxonomy is intentionally small — four types is a constraint that improves retrieval quality by forcing classification. "Miscellaneous" is not a type.

**Extensibility:** Implementations MAY support additional types beyond the four canonical ones, provided they: (a) support all four canonical types, (b) document additional types in `.elefante/config.yaml`, and (c) treat unknown types as opaque strings (no special behavior). This allows experimentation without breaking interoperability. However, the canonical four SHOULD be sufficient for most use cases — resist the urge to add types prematurely.

### 3.2 Memory Schema

Every memory is a Markdown file with YAML frontmatter. The following fields are defined:

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier. Format: `mem_{nanoid(12)}`. Immutable after creation. |
| `type` | `enum` | One of: `user`, `feedback`, `project`, `reference`. |
| `name` | `string` | Short title. 1–100 characters. Used in listings and search. |
| `created_at` | `string` | ISO 8601 timestamp. Set once at creation. |
| `updated_at` | `string` | ISO 8601 timestamp. Updated on every write. |

#### Optional Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `profile` | `string` | `null` | Profile scope. `null` means global (applies to all profiles). |
| `description` | `string` | `null` | One-line description. Max 200 characters. Used for index and search. |
| `importance` | `integer` | `0` | Access counter. Incremented each time the memory is retrieved. |
| `last_accessed_at` | `string` | `null` | ISO 8601 timestamp of last retrieval. |
| `tags` | `string[]` | `[]` | Free-form tags for additional categorization. |

#### Reserved Fields

The following field names are reserved for future protocol versions and MUST NOT be used by implementations:

`source`, `agent`, `embedding`, `parent`, `related`, `expires_at`, `confidence`, `version`

### 3.3 Memory File Format

```markdown
---
id: mem_a1b2c3d4e5f6
type: feedback
name: No database mocking in tests
description: Integration tests must use real database connections
profile: proj_acme-api
importance: 3
tags: [testing, database]
created_at: "2026-04-14T10:30:00Z"
updated_at: "2026-04-14T14:22:00Z"
last_accessed_at: "2026-04-14T14:22:00Z"
---

Do not mock the database in integration tests — use a real connection to a test database.

**Why:** Last quarter, mocked tests passed but the production migration failed because the mock didn't reflect actual schema constraints.

**How to apply:** When writing or reviewing test files that touch the database, always use the test database helper (`createTestDb()`) instead of jest mocks.
```

### 3.4 File Naming Convention

Memory files MUST be named as:

```
{id}.md
```

Example: `mem_a1b2c3d4e5f6.md`

The `id` in the filename MUST match the `id` in the frontmatter. The filename is the canonical identifier — if they conflict, the filename wins.

**Rationale:** Using IDs as filenames (rather than slugified names) avoids rename conflicts, ensures uniqueness, and decouples the filename from mutable metadata. The name/title is stored in frontmatter and is editable without renaming the file.

### 3.5 Memory Lifecycle

```
Created → Active → (Accessed)* → Updated → ... → Deleted
                                                      │
                                                      ▼
                                              Git history retains
                                              the full record
```

- **Creation:** A new `.md` file is committed to the vault.
- **Access:** `importance` is incremented, `last_accessed_at` is updated. This MAY be batched to avoid excessive commits.
- **Update:** Frontmatter and/or body are modified. `updated_at` is set. A new commit is created.
- **Deletion:** The file is removed. Git history preserves the content. Implementations MAY offer a "soft delete" by moving files to an `_archive/` directory instead.

---

## 4. Vault Structure

### 4.1 Directory Layout

```
elefante-vault/
├── .elefante/
│   └── config.yaml              # Vault configuration
├── memories/
│   ├── user/
│   │   └── mem_*.md
│   ├── feedback/
│   │   └── mem_*.md
│   ├── project/
│   │   └── mem_*.md
│   └── reference/
│       └── mem_*.md
├── profiles/
│   └── {profile_id}.yaml        # Profile definitions
├── index/
│   ├── manifest.json            # All memories metadata (generated)
│   └── search.json              # Search index (generated)
├── .github/
│   └── workflows/
│       └── reindex.yaml         # Rebuilds index on push
├── .gitignore
└── README.md
```

### 4.2 Vault Configuration

`.elefante/config.yaml`:

```yaml
# Elefante vault configuration
version: "0.1"

# Default profile for unscoped operations
default_profile: null

# Index settings
index:
  # Auto-rebuild on local writes (disable if using GitHub Actions)
  auto_rebuild: true

# Memory defaults
memory:
  # Maximum body length in characters (0 = unlimited)
  max_body_length: 10000
```

### 4.3 Profile Definitions

Profiles partition memories by context — one per project, one per agent, or any grouping the user chooses.

`profiles/{profile_id}.yaml`:

```yaml
id: proj_acme-api
name: Acme API Project
description: Backend API for the Acme platform
created_at: "2026-04-14T10:00:00Z"
```

When a memory has `profile: proj_acme-api`, it is scoped to that profile. When `profile` is `null`, the memory is global and visible to all profiles.

### 4.4 Index Files

Index files are **generated artifacts** — they MUST NOT be manually edited. They are committed to the repo so that consumers (including the MCP server) can read them without walking the full directory tree.

#### manifest.json

A flat array of all memory metadata (frontmatter only, no body):

```json
{
  "generated_at": "2026-04-14T15:00:00Z",
  "version": "0.1",
  "count": 42,
  "memories": [
    {
      "id": "mem_a1b2c3d4e5f6",
      "type": "feedback",
      "name": "No database mocking in tests",
      "description": "Integration tests must use real database connections",
      "profile": "proj_acme-api",
      "importance": 3,
      "tags": ["testing", "database"],
      "created_at": "2026-04-14T10:30:00Z",
      "updated_at": "2026-04-14T14:22:00Z",
      "last_accessed_at": "2026-04-14T14:22:00Z",
      "path": "memories/feedback/mem_a1b2c3d4e5f6.md"
    }
  ]
}
```

#### search.json

A keyword index optimized for client-side search:

```json
{
  "generated_at": "2026-04-14T15:00:00Z",
  "version": "0.1",
  "trigrams": {
    "dat": ["mem_a1b2c3d4e5f6", "mem_x9y8z7w6v5u4"],
    "bas": ["mem_a1b2c3d4e5f6"],
    "tes": ["mem_a1b2c3d4e5f6", "mem_j3k4l5m6n7o8"],
    "moc": ["mem_a1b2c3d4e5f6"]
  },
  "keywords": {
    "database": ["mem_a1b2c3d4e5f6", "mem_x9y8z7w6v5u4"],
    "testing": ["mem_a1b2c3d4e5f6", "mem_j3k4l5m6n7o8"],
    "mock": ["mem_a1b2c3d4e5f6"]
  }
}
```

**Search algorithm:** The MCP server loads `search.json` into memory. On a search query, it extracts trigrams and keywords from the query, intersects/unions the posting lists, and ranks by frequency + recency + importance. This is fast (sub-millisecond for <10k memories) and requires no external dependencies.

---

## 5. Operations

### 5.1 Write Path

```
Agent calls memory_write
  → MCP server validates input
  → Generate ID (mem_{nanoid(12)})
  → Create .md file with frontmatter + body
  → Place in memories/{type}/
  → Rebuild index (if auto_rebuild enabled)
  → git add + git commit
  → git push (async, non-blocking)
  → Return memory object to agent
```

### 5.2 Commit Batching

Every write creates a Git commit, and every commit triggers a push. For a single memory write this is fine (~200ms local commit, ~500ms async push). But chatty agents that write multiple memories in rapid succession can create excessive Git noise.

Implementations SHOULD support **commit batching**:

- **Immediate mode (default):** Each write is its own commit. Simple, auditable, every memory has its own commit message. Best for low-frequency writes (1-5 per session).
- **Batched mode:** Writes within a configurable window (default: 5 seconds) are grouped into a single commit. The commit message lists all memories written. Push happens once at the end of the window.

The mode is configurable in `.elefante/config.yaml`:

```yaml
sync:
  commit_strategy: "immediate"  # or "batched"
  batch_window_ms: 5000         # only used in batched mode
  push_strategy: "async"        # "async" (non-blocking) or "on-idle" (push when no writes for 10s)
```

**Rationale:** Git history is one of Elefante's core value propositions. One-commit-per-memory gives the cleanest history (`git log` shows exactly when each memory was created/changed). Batching trades auditability for performance. The default favors auditability because that's the value proposition; users with chatty agents can opt into batching.

**Crash safety in batched mode:** In batched mode, writes that have not yet been committed live only in the filesystem. If the MCP server process crashes during the batch window, those memory files exist on disk but are not yet in Git history. Implementations MUST use a write-ahead strategy: write the `.md` file to disk **before** returning success to the agent, and persist a `~/.elefante/pending.json` file listing uncommitted writes. On next startup, the MCP server MUST check for pending writes and commit them. This means batched mode has a durability guarantee of "on disk but not yet in Git" during the window — the memory file is never lost, but it may not appear in `git log` until the next startup or flush. This is a weaker guarantee than immediate mode, and the CLI SHOULD warn users when enabling batched mode.

### 5.3 Read Path

```
Agent calls memory_read (by ID)
  → MCP server reads file from local clone
  → Parse frontmatter + body
  → Increment importance, update last_accessed_at
  → Return memory object to agent
  → (Async) commit access metadata update, push
```

### 5.4 Search Path

```
Agent calls memory_search (query, filters)
  → MCP server loads index/search.json (cached in-memory)
  → Extract trigrams + keywords from query
  → Score candidates from posting lists
  → Apply filters (type, profile, tags)
  → Read top-N memory files for full content
  → Touch accessed memories (async)
  → Return ranked results
```

### 5.5 List Path

```
Agent calls memory_list (filters)
  → MCP server loads index/manifest.json (cached in-memory)
  → Apply filters (type, profile, tags)
  → Sort by updated_at DESC (default) or importance DESC
  → Paginate (limit, offset)
  → Return metadata array (no body)
```

### 5.6 Delete Path

```
Agent calls memory_delete (id)
  → MCP server removes the file
  → Rebuild index
  → git add + git commit + git push (async)
  → Return confirmation
```

### 5.7 Sync Path

Sync happens transparently and is not exposed as an MCP tool.

```
On MCP server startup:
  → git pull --rebase (if local clone exists)
  → Reload index files into memory

Before write operations:
  → git pull --rebase (fast-forward if possible)
  → If conflict: abort write, return error to agent

Periodic (configurable, default 60s):
  → git fetch + check for remote changes
  → If remote ahead: git pull --rebase, reload index
```

---

## 6. Authentication

Elefante does not implement its own authentication layer. It delegates entirely to Git's existing credential infrastructure.

### 6.1 Resolution Order

The MCP server resolves credentials in this order:

1. **Local Git credentials.** If a local clone exists at `~/.elefante/vault/`, all Git operations use whatever credential helper the system has configured (SSH agent, macOS Keychain, `git-credential-manager`, etc.). This is the default and preferred path.

2. **GitHub CLI token.** If `gh` is installed and authenticated, the MCP server can obtain a token via `gh auth token`. This enables GitHub API operations without a local clone.

3. **Environment variable.** `ELEFANTE_GITHUB_TOKEN` — a GitHub Personal Access Token. Useful for CI, containers, and environments where interactive auth is not possible.

4. **Configuration file.** `~/.elefante/config.json` may contain a `token` field. This is the last resort for manual configuration.

5. **Interactive prompt.** If none of the above are available, the MCP server returns an error instructing the user to run `elefante init` or `gh auth login`.

### 6.2 Required Permissions

The Git credential (however obtained) MUST have:

- **Read** access to the vault repository (for pull, file reads)
- **Write** access to the vault repository (for push, file writes)

For GitHub PATs, the minimum scope is `repo` (for private repositories) or `public_repo` (for public vaults).

### 6.3 Security Considerations

- **Tokens are never stored in the vault repository.** Credentials live in `~/.elefante/config.json` (local machine only) or in the system credential store.
- **The vault repository should be private.** Memories may contain sensitive context (user preferences, project details, internal URLs). The protocol does not encrypt memory content — privacy relies on the repository's access controls.
- **MCP transport security.** The MCP server communicates with agents via stdio (local process) — there is no network surface. When running as an SSE server (optional), TLS is REQUIRED.

---

## 7. MCP Interface

### 7.1 Tool Definitions

The Elefante MCP server exposes the following tools:

#### `memory_write`

Create or update a memory.

```json
{
  "name": "memory_write",
  "description": "Store a memory in the vault. Use type 'user' for user preferences/facts, 'feedback' for behavioral guidance, 'project' for active work context, 'reference' for external resource pointers.",
  "inputSchema": {
    "type": "object",
    "required": ["name", "type", "body"],
    "properties": {
      "name": { "type": "string", "maxLength": 100 },
      "type": { "enum": ["user", "feedback", "project", "reference"] },
      "body": { "type": "string" },
      "description": { "type": "string", "maxLength": 200 },
      "profile": { "type": "string" },
      "tags": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

#### `memory_read`

Retrieve a specific memory by ID.

```json
{
  "name": "memory_read",
  "description": "Retrieve a specific memory by its ID.",
  "inputSchema": {
    "type": "object",
    "required": ["id"],
    "properties": {
      "id": { "type": "string" }
    }
  }
}
```

#### `memory_search`

Search memories by query string.

```json
{
  "name": "memory_search",
  "description": "Search the memory vault. Returns memories ranked by relevance. Use filters to narrow results by type or profile.",
  "inputSchema": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": { "type": "string" },
      "type": { "enum": ["user", "feedback", "project", "reference"] },
      "profile": { "type": "string" },
      "limit": { "type": "integer", "default": 10, "maximum": 50 }
    }
  }
}
```

#### `memory_list`

List memories with optional filters.

```json
{
  "name": "memory_list",
  "description": "List memories in the vault. Returns metadata only (no body). Use memory_read to get full content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "type": { "enum": ["user", "feedback", "project", "reference"] },
      "profile": { "type": "string" },
      "sort": { "enum": ["updated", "importance", "created"], "default": "updated" },
      "limit": { "type": "integer", "default": 20, "maximum": 100 },
      "offset": { "type": "integer", "default": 0 }
    }
  }
}
```

#### `memory_update`

Update an existing memory.

```json
{
  "name": "memory_update",
  "description": "Update an existing memory. Only provided fields are changed.",
  "inputSchema": {
    "type": "object",
    "required": ["id"],
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string", "maxLength": 100 },
      "type": { "enum": ["user", "feedback", "project", "reference"] },
      "body": { "type": "string" },
      "description": { "type": "string", "maxLength": 200 },
      "tags": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

#### `memory_delete`

Delete a memory.

```json
{
  "name": "memory_delete",
  "description": "Permanently delete a memory. The content is preserved in Git history.",
  "inputSchema": {
    "type": "object",
    "required": ["id"],
    "properties": {
      "id": { "type": "string" }
    }
  }
}
```

### 7.2 L0 Context Injection

When an agent starts a session, it SHOULD call `memory_list` or `memory_search` to load relevant context into its working memory. However, the MCP server MAY also support a **resource** endpoint that returns a pre-formatted context block:

#### `elefante://context` (MCP Resource)

Returns a formatted Markdown block of the most relevant memories for the current profile, packed within a token budget. This is equivalent to the L0 retrieval in ReClaude.

```
## Memory Context (via Elefante)

### Feedback
- **No database mocking in tests**: Integration tests must use real database connections...
- **Delegate UI builds to subagents**: Use the Agent tool to delegate...

### User
- **TypeScript strict mode**: User prefers strict: true in tsconfig.json...

### Project
- **REST to GraphQL migration**: Deadline Q3 2026...
```

This resource is read-only and auto-generated from the index.

---

## 8. Concurrency Model

### 8.1 Design Constraint

Elefante is designed for **single-writer, single-user** scenarios. It is not a database. The expected usage pattern is one agent writing at a time, with occasional manual edits by the user.

### 8.2 Conflict Avoidance

The file-per-memory design means that two agents writing **different** memories will never conflict — they create or modify different files. Conflicts only arise when:

1. Two agents update the **same** memory simultaneously.
2. An agent writes while the user is manually editing the same file in GitHub.

### 8.3 Conflict Resolution

When `git push` fails due to a conflict:

1. `git pull --rebase` to incorporate remote changes.
2. If rebase succeeds (non-overlapping changes): push again.
3. If rebase fails (true conflict on the same file):
   - **Default strategy:** Keep the remote version (last-writer-loses for the local agent). The agent's write is returned as an error, and the agent can retry.
   - **Alternative strategy (configurable):** Keep both versions — rename the local file with a `-conflict-{timestamp}` suffix and let the user resolve.

### 8.4 Access Metadata Batching

Incrementing `importance` and updating `last_accessed_at` on every read would create excessive commits. Implementations SHOULD batch these updates:

- Accumulate access events in memory.
- Flush to disk and commit at most once per minute, or on MCP server shutdown.
- Access metadata is **advisory** — losing some access events is acceptable.

---

## 9. Indexing

### 9.1 Design Rationale and Limitations

Elefante uses client-side trigram + keyword search, not embeddings. This is a deliberate trade-off:

**Why not embeddings in v0.1:**
- Embeddings require an API call (cost, latency, API key) or a local model (size, complexity).
- They introduce a dependency that violates the "zero infrastructure" principle.
- For the expected scale (<10,000 memories), keyword search with trigram fuzzy matching is sufficient for most retrieval tasks.

**What this means in practice:**
- Exact and partial keyword matches work well. "database testing" will find memories about database testing.
- Semantic queries work poorly. "how we handle persistence" will NOT reliably find a memory titled "Database connection pooling" unless the words overlap.
- This is a known gap. The extension mechanism (Section 15) defines an embeddings index for users who need semantic search.

**When to graduate beyond Elefante's built-in search:**
- When you have >5,000 memories and keyword recall drops below useful levels.
- When your agents consistently fail to find relevant context with keyword queries.
- At that point, consider the embeddings extension or a hybrid approach.

### 9.2 Index Generation

The index is rebuilt by walking all files in `memories/`, parsing their frontmatter and body, and generating two files:

- `index/manifest.json` — metadata for fast listing and filtering.
- `index/search.json` — trigram and keyword posting lists for search.

### 9.3 Trigram Extraction

For each memory, trigrams are extracted from the lowercased concatenation of `name`, `description`, and `body`. Common stop words are excluded. The resulting trigrams are stored as posting lists mapping trigram → list of memory IDs.

### 9.4 Keyword Extraction

Keywords are extracted by tokenizing on whitespace and punctuation, lowercasing, removing stop words, and deduplicating. Keywords are stored as posting lists mapping keyword → list of memory IDs.

### 9.5 Search Ranking

Given a query, the search algorithm:

1. Extracts trigrams and keywords from the query.
2. For each candidate memory, computes a score: `trigram_hits * 1 + keyword_hits * 2`.
3. Applies a recency boost: `score * (1 + 0.1 * recency_factor)` where `recency_factor` decays from 1.0 (today) to 0.0 (30+ days old).
4. Applies an importance boost: `score * (1 + 0.05 * importance)`.
5. Sorts by final score descending.
6. Applies type and profile filters (post-scoring, to avoid biasing results).

### 9.6 Rebuild Triggers

The index MUST be rebuilt:

- After any write, update, or delete operation (if `auto_rebuild` is enabled).
- By a CI/CD pipeline on push (GitHub Action).
- On-demand via `elefante reindex` CLI command.

### 9.7 Index Staleness

If the index is stale (e.g., a manual file edit without reindex), the MCP server SHOULD detect this by comparing the latest commit hash against the hash stored in the index metadata. If stale, it SHOULD rebuild before serving search queries.

---

## 10. CLI Interface

The `elefante` CLI is the primary user-facing interface for vault management.

```
elefante init <repo-url>       Initialize vault (clone repo to ~/.elefante/vault/)
elefante status                Show vault status (sync state, memory count, index freshness)
elefante list [--type TYPE]    List memories
elefante search <query>        Search memories
elefante read <id>             Read a specific memory
elefante add                   Interactively create a memory
elefante edit <id>             Open memory in $EDITOR
elefante delete <id>           Delete a memory
elefante sync                  Pull remote changes, push local changes
elefante reindex               Rebuild index files
elefante mcp                   Start MCP stdio server (used by agents)
elefante mcp --sse             Start MCP SSE server (for remote agents)
elefante export [--format json|md]  Export all memories
elefante doctor                Diagnose vault health (auth, sync, index)
```

---

## 11. Provider Abstraction

### 11.1 Provider Interface

The storage layer is abstracted behind a provider interface:

```typescript
interface VaultProvider {
  // File operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory: string): Promise<string[]>;

  // Sync operations
  pull(): Promise<SyncResult>;
  push(): Promise<SyncResult>;
  getStatus(): Promise<VaultStatus>;

  // Auth
  authenticate(): Promise<AuthResult>;
}
```

### 11.2 Reference Providers

| Provider | Backend | Auth | Notes |
|---|---|---|---|
| `local-git` | Local clone + `git` binary | System git credentials | Default. Offline-capable. |
| `github-api` | GitHub REST API | PAT, `gh` CLI, or OAuth | No local clone needed. |
| `gitlab-api` | GitLab REST API | PAT or OAuth | Community contribution. |
| `local-fs` | Local directory (no git) | Filesystem permissions | For testing or air-gapped environments. |

---

## 12. Versioning and Compatibility

### 12.1 Protocol Versioning

The protocol version follows [Semantic Versioning](https://semver.org/):

- **Major:** Breaking changes to the memory format, directory structure, or MCP interface.
- **Minor:** New optional fields, new tools, new provider support.
- **Patch:** Clarifications, typo fixes, non-functional changes.

The version is declared in `.elefante/config.yaml` and in index file headers.

### 12.2 Forward Compatibility

Implementations MUST ignore unknown frontmatter fields. This allows newer writers to add fields without breaking older readers.

### 12.3 Migration

When the protocol version changes, the CLI MUST provide a `elefante migrate` command that transforms the vault to the new format. Migrations MUST be reversible (via git revert if nothing else).

---

## 13. Security Considerations

### 13.1 Threat Model

| Threat | Mitigation |
|---|---|
| Unauthorized access to memories | Private repository + Git access controls |
| Memory poisoning (malicious agent writes) | Git history audit trail + branch protection rules |
| Token leakage | Tokens stored in `~/.elefante/` (local only), never in vault |
| Sensitive data in memories | User responsibility — protocol does not encrypt at rest |
| Prompt injection via memory content | Agents SHOULD treat memory content as untrusted user input |

### 13.2 Prompt Injection Mitigation

Memory content is written by agents and users, then injected into agent prompts. A compromised or malicious memory could contain prompt injection attempts. Implementations SHOULD:

- Clearly delimit memory content in prompts (e.g., XML tags or Markdown fences).
- Instruct agents to treat memory content as context, not instructions.
- Provide a `elefante audit` command that flags suspicious memory content.

### 13.3 Data Classification

The protocol does not define data classification levels. Users who store sensitive information (credentials, PII, internal URLs) in memories should:

- Ensure the vault repository is private.
- Consider using a self-hosted Git provider for highly sensitive data.
- Never store raw credentials — store references to credential managers instead.

---

## 14. Comparison with Alternatives

| Feature | Elefante | Claude Memory | ChatGPT Memory | mem0 | Zep |
|---|---|---|---|---|---|
| Agent-agnostic | Yes | No (Claude only) | No (GPT only) | Yes | Yes |
| Open protocol | Yes | No | No | Partial | Partial |
| No server required | Yes | N/A (managed) | N/A (managed) | No | No |
| Human-readable storage | Yes (Markdown) | No | No | No | No |
| Version history | Yes (Git) | No | No | No | No |
| Offline access | Yes | No | No | No | No |
| Self-hosted | Yes | No | No | Yes | Yes |
| Free | Yes | Yes (vendor-locked) | Yes (vendor-locked) | Freemium | Freemium |
| Semantic search | Extension | Yes | Yes | Yes | Yes |
| MCP support | Native | N/A | N/A | Partial | Yes* |

*\* Zep's MCP support comes in two forms: (1) Graphiti MCP Server (open-source, read/write, but requires self-hosting Neo4j or FalkorDB), and (2) Zep Cloud MCP Server (hosted, read-only, requires paid API key). Both require infrastructure — the point is that MCP support alone is not a differentiator; the question is what's behind it.*

### 14.1 "Why not Obsidian + MCP plugin?"

This is the closest alternative and the most likely question. There is a visible wave of tools connecting AI agents to Markdown vaults (Obsidian, Logseq, etc.) via MCP plugins. The differences:

| | Elefante | Obsidian + MCP Plugin |
|---|---|---|
| **Purpose-built for agents** | Yes — memory schema, types, indexing, and MCP tools are designed for agent consumption | No — Obsidian is a human knowledge base; MCP plugins bolt on agent access as an afterthought |
| **Structure** | Enforced schema (frontmatter fields, 4 types, profiles) | Freeform — agents must navigate an unstructured vault |
| **Search** | Purpose-built index optimized for agent retrieval | Obsidian's search, not designed for programmatic use |
| **Portability** | Zero dependency on any specific app | Requires Obsidian running as the host |
| **Headless** | Works in CI, containers, SSH sessions | Requires Obsidian GUI (or community workarounds) |
| **Git-native** | Git is the primary interface — push, pull, clone | Obsidian Git plugin exists but is a secondary workflow |

**In short:** Obsidian is a tool for humans that agents can access. Elefante is a tool for agents that humans can access. The data format is similar (Markdown + Git), but the design center is different.

### 14.2 "Why not Mem0 / Zep / Letta?"

These are excellent systems that optimize for retrieval quality — embeddings, graph-aware memory, semantic search. If your primary concern is "find the most relevant memory for this prompt," they will outperform Elefante.

Elefante makes a different bet: that for developers and power users, the governance properties (ownership, auditability, portability, zero infrastructure) matter more than marginal retrieval improvements. Most agent memory workloads are small (hundreds to low thousands of memories) where keyword search is sufficient.

If you need enterprise-scale retrieval across millions of memories, Elefante is not for you. If you want to `git clone` your memory, read it in vim, and point three different agents at the same vault — Elefante is for you.

### 14.3 "Why not just a database?"

You can. The author's prior system (ReClaude) used Postgres with pg_trgm trigram indexes and it worked well. The costs:

- You need a server running 24/7 (or a managed database service).
- You need backups, migrations, monitoring.
- Your memory is not human-readable without a UI.
- You have no version history without building it yourself.
- Porting to another system means writing an export pipeline.

For teams that already run infrastructure, a database is fine. Elefante is for people who looked at that stack and said "this is too much for what is essentially a few hundred text files."

---

## 15. Future Extensions

The following are explicitly out of scope for v0.1 but are anticipated for future versions:

- **Embeddings index.** An optional `index/embeddings.json` file containing vector embeddings for semantic search. The MCP server would compute cosine similarity locally.
- **Memory relations.** A `related` field linking memories to each other, enabling graph-based retrieval.
- **Expiration.** An `expires_at` field for memories that are only relevant until a specific date.
- **Multi-user vaults.** Shared vaults where multiple users contribute memories, with per-user namespacing.
- **Encryption at rest.** Optional GPG/age encryption of memory body content, with keys managed outside the vault.
- **Agent attribution.** A `source` field tracking which agent created or last modified a memory.

---

## Appendix A: Reference Implementation

The reference implementation is the `elefante` npm package:

```bash
# Install
npm install -g elefante

# Initialize vault
elefante init git@github.com:username/elefante-vault.git

# Start MCP server (for agents)
elefante mcp

# Or use directly via npx
npx elefante mcp
```

MCP configuration for agents:

```json
{
  "mcpServers": {
    "elefante": {
      "command": "npx",
      "args": ["-y", "elefante", "mcp"],
      "env": {
        "ELEFANTE_REPO": "username/elefante-vault"
      }
    }
  }
}
```

## Appendix B: GitHub Action for Reindexing

```yaml
name: Elefante Reindex
on:
  push:
    paths:
      - 'memories/**'
      - 'profiles/**'

jobs:
  reindex:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npx elefante reindex
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: rebuild index'
          file_pattern: 'index/*'
```

---

*This document is a living specification. Contributions, critiques, and benchmarks are welcome.*
