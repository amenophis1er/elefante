# Elefante

The open, Git-native memory protocol for MCP agents: portable, inspectable, versioned, and human-editable.

```
Your agent's memory is a Git repo you own.
Every memory is a Markdown file you can read.
Every change is a commit you can audit.
Any MCP agent can connect to it.
```

---

## Why

Every AI agent has its own memory system. Claude's works only with Claude. ChatGPT's works only with ChatGPT. They're all opaque, vendor-locked, and non-portable.

Elefante takes a different approach. Instead of optimizing for retrieval quality, it optimizes for **ownership**, **auditability**, and **portability** — the things that matter when memory is a first-class asset, not a hidden implementation detail.

| Question | Answer |
|---|---|
| Who owns my agent's memory? | You do. It's a Git repo. |
| What does my agent know about me? | `cat memories/user/*.md` |
| What changed since last week? | `git log --since="1 week ago"` |
| How do I use it across Claude, Codex, and Cursor? | Point them at the same MCP server. |
| How do I back it up? | Every clone is a full backup. |
| How do I undo a bad memory? | `git revert` |

## Quick Start

```bash
# Install
npm install -g elefante

# Initialize vault (uses a private GitHub repo as storage)
elefante init git@github.com:yourname/my-memory.git

# Add your first memory
elefante add \
  --name "TypeScript strict mode" \
  --type user \
  --body "Always enable strict: true in tsconfig.json"

# Search
elefante search "typescript"

# Check status
elefante status
```

## Connect to Your Agent

Add Elefante to any MCP-compatible agent with one config block.

**Claude Code:**

```json
{
  "mcpServers": {
    "elefante": {
      "command": "npx",
      "args": ["-y", "elefante", "mcp"]
    }
  }
}
```

**Cursor / VS Code / Codex** — same config. Any agent that speaks MCP can read and write to the same vault.

> **Tip:** Agents won't automatically search Elefante unless told to. Add a line to your project's `CLAUDE.md` (or equivalent agent instructions):
> ```
> When recalling or storing user preferences, context, or feedback,
> use the elefante MCP tools (memory_search, memory_write, etc.).
> ```
> Or just ask explicitly: *"Search my elefante memory for..."*

Once connected, your agent gets 6 tools:

| Tool | Description |
|---|---|
| `memory_write` | Store a memory |
| `memory_read` | Retrieve a memory by ID |
| `memory_search` | Search by keyword |
| `memory_list` | List memories with filters |
| `memory_update` | Update an existing memory |
| `memory_delete` | Delete a memory |

## What a Memory Looks Like

Every memory is a Markdown file with YAML frontmatter. You can open it in any editor.

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
---

Do not mock the database in integration tests — use a real connection
to a test database.

**Why:** Mocked tests passed but the production migration failed because
the mock didn't reflect actual schema constraints.

**How to apply:** Use the test database helper (`createTestDb()`)
instead of jest mocks.
```

## What a Git Log Looks Like

```
$ git log --oneline
f4a2c1e remember: No database mocking in tests
b3d8e7a remember: TypeScript strict mode preference
a1c9f2b update: REST to GraphQL migration deadline
9e7d4c3 forget: Outdated staging URL
2f8a6b1 Initialize elefante vault
```

Every write is `remember:`. Every update is `update:`. Every delete is `forget:`. Your memory has a clean, auditable history.

## Vault Structure

```
~/.elefante/vault/
├── .elefante/
│   └── config.yaml              # Vault settings
├── memories/
│   ├── user/                    # Who the user is
│   │   └── mem_*.md
│   ├── feedback/                # How the agent should behave
│   │   └── mem_*.md
│   ├── project/                 # Active work context
│   │   └── mem_*.md
│   └── reference/               # External resource pointers
│       └── mem_*.md
├── profiles/
│   └── *.yaml                   # Named scopes for partitioning
└── index/
    ├── manifest.json            # All memory metadata (generated)
    └── search.json              # Search index (generated)
```

## Memory Types

Four types. Intentionally constrained — a small taxonomy forces good classification.

| Type | What to store | Example |
|---|---|---|
| `user` | Facts about you — role, preferences, expertise | "Prefers TypeScript strict mode" |
| `feedback` | Agent behavior guidance — corrections, confirmations | "Don't mock the database in tests" |
| `project` | Active work context — goals, deadlines, decisions | "Migrating to GraphQL by Q3 2026" |
| `reference` | External pointers — URLs, dashboards, tools | "Oncall dashboard at grafana.internal/..." |

## Authentication

Elefante doesn't reinvent auth. It uses whatever Git credentials you already have.

**Resolution order:**
1. Local git credentials (SSH keys, macOS Keychain, credential helpers)
2. `gh auth token` (if GitHub CLI is installed)
3. `ELEFANTE_GITHUB_TOKEN` environment variable
4. `~/.elefante/config.json` token field

If `git` or `gh` is authenticated, Elefante works with zero config.

## CLI Reference

```
elefante init <repo-url>       Clone vault repo to ~/.elefante/vault/
elefante status                Vault status, sync state, memory count
elefante list [--type TYPE]    List memories with filters
elefante search <query>        Search by keyword
elefante read <id>             Read a specific memory
elefante add                   Create a memory
elefante delete <id>           Delete a memory
elefante sync                  Pull and push changes
elefante reindex               Rebuild search index
elefante mcp                   Start MCP stdio server
```

## How It Compares

Elefante doesn't compete on retrieval quality. It competes on ownership.

| | Elefante | Claude/ChatGPT Memory | Mem0 / Zep |
|---|---|---|---|
| **You own the data** | Git repo you control | Vendor-controlled | Self-hosted or SaaS |
| **Human-readable** | Markdown files | No | No |
| **Version history** | Git log for free | No | No |
| **Agent-agnostic** | Any MCP agent | Single vendor | Yes |
| **Zero infrastructure** | Git + local process | N/A (managed) | Server + database |
| **Offline access** | Local clone | No | No |
| **Semantic search** | Not yet (planned) | Yes | Yes |

> **"Why not Obsidian + MCP plugin?"** — Obsidian is a tool for humans that agents can access. Elefante is a tool for agents that humans can access. Same data format (Markdown + Git), different design center.

## Protocol

The full protocol specification — memory model, vault structure, MCP interface, concurrency model, indexing, security considerations — is in [`PROTOCOL.md`](PROTOCOL.md).

## License

MIT
