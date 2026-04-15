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
npm install -g elefante-mcp

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

**From the terminal** (before starting Claude Code):

```bash
claude mcp add --scope user elefante -- npx -y elefante-mcp mcp
```

**From inside Claude Code** (during a session):

```
/mcp add --scope user elefante -- npx -y elefante-mcp mcp
```

**Or manually** — add to your MCP config (`~/.claude.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "elefante": {
      "command": "npx",
      "args": ["-y", "elefante-mcp", "mcp"]
    }
  }
}
```

**Cursor / VS Code / Codex** — same config. Any agent that speaks MCP can read and write to the same vault.

Once connected, your agent gets 7 tools: `memory_write`, `memory_read`, `memory_search`, `memory_list`, `memory_update`, `memory_delete`, `memory_sync`.

### Auto-Discovery

Elefante injects your top memories directly into the agent's system prompt at startup via MCP `instructions`. The agent sees your preferences, feedback, and project context **without needing to search first**.

No `CLAUDE.md` hacks. No "search my elefante memory" prompts. It just works.

## Project-Aware Memory

Elefante auto-detects which project you're in and scopes memories accordingly. No configuration needed.

### How It Works

When the MCP server starts, it reads the git remote from your working directory:

```
~/Projects/acme-api/   →  git remote = github.com:you/acme-api.git
                       →  profile = "you/acme-api"
                       →  memories scoped to this project

~/Projects/my-cli/     →  git remote = github.com:you/my-cli.git
                       →  profile = "you/my-cli"
                       →  different project, different memories
```

### What Gets Scoped

| You say | What happens |
|---|---|
| "Remember this project uses Postgres 16" | Stored with `profile: you/acme-api` (project-scoped) |
| "Remember I prefer Bun over npm" | Agent stores with `profile: global` → `null` (applies everywhere) |
| "Remember the staging URL is staging.acme.io" | Stored with `profile: you/acme-api` (project-scoped) |

The agent decides based on context. User preferences and behavioral feedback are typically global. Project details and references are typically scoped.

### What You See When You Search

```
Working in acme-api:
  ✓ "Uses Postgres 16"              (profile: you/acme-api)
  ✓ "Prefers Bun over npm"          (profile: null — global)
  ✗ "Uses SQLite"                   (profile: you/my-cli — different project)

Working in my-cli:
  ✓ "Uses SQLite"                   (profile: you/my-cli)
  ✓ "Prefers Bun over npm"          (profile: null — global)
  ✗ "Uses Postgres 16"             (profile: you/acme-api — different project)
```

Global memories always show up. Project memories only show up in their project.

### Escape Hatches

| Profile value | Meaning |
|---|---|
| *(omitted)* | Auto-scope to detected project |
| `"global"` | Explicitly global — no project scope |
| `"all"` | Search/list across every project |
| `"owner/other-repo"` | Explicitly target a different project |

## What a Memory Looks Like

Every memory is a Markdown file with YAML frontmatter. You can open it in any editor.

```markdown
---
id: mem_a1b2c3d4e5f6
type: feedback
name: No database mocking in tests
description: Integration tests must use real database connections
profile: you/acme-api
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

| Type | What to store | Typically scoped to |
|---|---|---|
| `user` | Facts about you — role, preferences, expertise | Global |
| `feedback` | Agent behavior guidance — corrections, confirmations | Global |
| `project` | Active work context — goals, deadlines, decisions | Project |
| `reference` | External pointers — URLs, dashboards, tools | Project |

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
| **Auto project scoping** | Detects git remote | Per-conversation | Manual |
| **Semantic search** | Not yet (planned) | Yes | Yes |

> **"Why not Obsidian + MCP plugin?"** — Obsidian is a tool for humans that agents can access. Elefante is a tool for agents that humans can access. Same data format (Markdown + Git), different design center.

## Protocol

The full protocol specification — memory model, vault structure, MCP interface, concurrency model, indexing, security considerations — is in [`PROTOCOL.md`](PROTOCOL.md).

## License

MIT
