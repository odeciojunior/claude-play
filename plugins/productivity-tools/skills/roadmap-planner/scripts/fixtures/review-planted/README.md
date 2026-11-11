# Planted Defects Sample roadmap -- tracking folder

Living tracking for the roadmap. Strategy: `strategy.md`.

## Files
| File | Nature |
|---|---|
| `state.md` | Overwritten snapshot: Now, panel, blockers, pending, in flight |
| `decisions.md` | Append-only decisions |
| `log.md` | Append-only events, newest first |
| `critical-path.md` | Dependency graph and next gates |
| `sources.md` | Source inventory and conflicts |
| `requirements.md` | Requirements and their coverage |
| `roadmap.config.json` | Paths, vocabulary, limits |

## Check
Run `node <roadmap-folder>/check-roadmap.mjs` (Node 18 or newer). Exit 1 on errors; warnings pass; exit 2 is an unexpected failure (`ERROR internal`). In CI add `--require-git` so that skipped git checks fail instead of passing silently.

## When to update
| Event | Update |
|---|---|
| A decision is made | `decisions.md` first, then whatever uses it |
| A piece or step closes | `log.md` and the panel in `state.md` |
| A branch is integrated or deleted | "in flight" in `state.md` and `log.md` |
| A blocker opens or closes | `state.md` and `critical-path.md` |
| A piece or phase ends | propose a strategy revision |
