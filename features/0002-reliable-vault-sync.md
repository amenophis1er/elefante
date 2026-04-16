---
id: 2
title: Reliable vault sync
status: done
labels: [protocol-compliance, reliability, v0.2]
created: 2026-04-14
updated: 2026-04-15
priority: high
supersedes: [0002-pull-before-writes, 0003-periodic-sync]
---

The vault currently syncs once (on MCP server startup) and then goes deaf. Pushes after writes are fire-and-forget — if they fail, changes pile up locally with no retry. This was observed in production: two deletes committed locally but never reached the remote until a manual `git push`.

This feature makes sync reliable across three scenarios.

## 1. Pull before writes

PROTOCOL.md Section 5.7: "Before write operations: git pull --rebase."

Before every `createMemory`, `updateMemory`, and `deleteMemory`:
- Run `git pull --rebase`
- If pull fails with a conflict, abort the write and return an error to the agent
- If pull fails with a network error, proceed with the local write (offline-friendly) but mark the vault as "push pending"

This prevents write conflicts when the remote has been updated by another agent or device.

## 2. Background sync loop

PROTOCOL.md Section 5.7: "Periodic (configurable, default 60s): git fetch + check for remote changes."

Add a `setInterval` loop in `startMcpServer` that runs every `sync.poll_interval_s` seconds (default: 60, configurable in `.elefante/config.yaml`):

```yaml
sync:
  poll_interval_s: 60
```

Each tick:
1. `git fetch origin`
2. Check if local is behind remote → `git pull --rebase` + `invalidateCache()`
3. Check if local is ahead of remote → `git push`
4. If push fails, log and retry next tick

Clean up the interval on server close / transport disconnect.

## 3. Replace fire-and-forget push

Remove `pushAsync()` (the fire-and-forget pattern). Instead:
- Write operations commit locally and push synchronously with a short timeout
- If the push fails, it gets picked up by the background loop on the next tick
- The background loop acts as a reliable retry mechanism

## Config changes

Add `poll_interval_s` to the `sync` section of `VaultConfig`:

```typescript
sync: {
  commit_strategy: "immediate" | "batched";
  batch_window_ms: number;
  push_strategy: "async" | "on-idle";
  poll_interval_s: number;  // NEW — default 60
}
```

## Files to modify

- `src/types.ts` — Add `poll_interval_s` to VaultConfig and DEFAULT_VAULT_CONFIG
- `src/vault.ts` — Add `fetch()`, `isAhead()`, `isBehind()` helpers. Remove `pushAsync()`. Add `syncOnce()` that does the full fetch/pull/push cycle.
- `src/memory.ts` — Add `pull()` call before writes in create/update/delete. Replace `pushAsync()` with synchronous push (catch and continue on failure).
- `src/mcp-server.ts` — Start the sync loop after server init. Clear on transport close.
- `src/indexer.ts` — No changes (invalidateCache already exists).

## Edge cases

- **Offline**: fetch/push fail → proceed with local ops, retry next tick
- **Conflict on pull**: abort the write, return error to agent with details
- **Concurrent writes**: the pull-before-write + rebase strategy handles this (same as git's model)
- **Server shutdown**: clearInterval to prevent orphaned timers

## Testing

- Unit test: `syncOnce()` with mocked git (ahead/behind/clean scenarios)
- Unit test: pull-before-write in createMemory (mock pull success/failure/conflict)
- Integration test: two sequential writes push correctly without manual intervention
- Verify the background loop starts and stops cleanly
