---
id: 6
title: "Search v2: improved lexical ranking"
status: planned
labels: [search, v0.3]
created: 2026-04-14
updated: 2026-04-16
priority: high
---

The current search is functional but primitive. It merges name, description, and body into one undifferentiated blob, scores trigram hits at +1 and keyword hits at +2, then applies modest recency/importance boosts. This leaves significant ranking quality on the table before any ML/embeddings are needed.

## Problems with current search

- `name` matches are not specially rewarded — a title hit scores the same as a hit buried in the body
- `description` matches are not specially rewarded
- `tags` are not part of ranking at all (only used for dashboard filtering)
- No phrase match bonus — "branch workflow" doesn't score higher than two unrelated hits on "branch" and "workflow"
- No stemming — "persist" won't find "persistence", "databases" won't match "database"
- No synonym layer — "db" won't find "database", "auth" won't find "authentication"
- Raw hit counts instead of BM25-style term frequency normalization
- Short memories and long memories are scored equally (no length normalization)

## Proposed improvements (ordered by impact)

### 1. Field-weighted scoring

Weight matches by where they occur:

| Field | Weight |
|-------|--------|
| name | 10x |
| tags | 8x |
| description | 5x |
| body | 1x |

Index each field separately in `search.json` instead of merging them.

### 2. BM25 scoring

Replace raw hit counts with BM25 (or a simplified variant):
- Term frequency saturation — a term appearing 10x in a long body shouldn't score 10x higher than appearing once
- Inverse document frequency — rare terms matter more than common ones
- Document length normalization — short focused memories shouldn't be penalized vs long ones

### 3. Exact and phrase match bonuses

- Exact title match: large bonus (user searched "branch workflow", memory is named "Branch-per-feature workflow")
- Phrase match in body: bonus when query terms appear adjacent/near each other
- Prefix match: "persist" matches "persistence", "persistent"

### 4. Simple stemming

Lightweight suffix stripping (not a full NLP stemmer):
- Plural → singular: "databases" → "database", "memories" → "memory"
- Common suffixes: "ing", "tion", "ment", "ness", "able"
- Apply at index time and query time

### 5. Developer synonym dictionary

Small built-in map for common developer abbreviations:

```
db → database
auth → authentication, authorization
env → environment
config → configuration
repo → repository
deps → dependencies
infra → infrastructure
k8s → kubernetes
```

Expandable via vault config if needed later.

### 6. Tag boosting in search

Tags should contribute to search scoring, not just filtering. If a query term matches a tag exactly, apply a high-weight bonus (same tier as name matches).

## What this does NOT include

- **No embeddings/ML** — premature. Squeeze lexical gains first, revisit when users hit the ceiling with real usage data.
- **No external API calls** — stays fully local and offline
- **No new index format** — `search.json` evolves but remains a JSON posting list
- **No changes to `buildContext()`** — context selection is a separate concern

## Files to modify

- `src/indexer.ts` — Field-separated indexing, BM25 scoring, stemming, synonyms, phrase matching
- `src/types.ts` — Update `SearchIndex` type for field-weighted posting lists
- `tests/unit/indexer.test.ts` — New tests for field weighting, stemming, synonyms, phrase matching

## Migration

The new `search.json` format is backward-compatible in the sense that `elefante reindex` regenerates it. Users just run `elefante reindex` after upgrading.

## Testing

- Unit tests for stemmer (suffix stripping edge cases)
- Unit tests for synonym expansion
- Unit tests for field-weighted scoring (name match >> body match)
- Unit tests for BM25 normalization (long vs short documents)
- Unit tests for phrase matching
- Integration test: search queries that fail today but should succeed after improvements
