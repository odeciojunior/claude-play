# Sample Roadmap -- tracking folder

Living tracking for the sample roadmap. The strategy document is `strategy.md`.

## Files

| File | Nature |
|---|---|
| `strategy.md` | Versioned strategy; no state |
| `state.md` | Overwritten snapshot: Now, panel, blockers, pending, in flight |
| `decisions.md` | Append-only decisions |
| `log.md` | Append-only events, newest first |
| `critical-path.md` | Dependency graph and next gates |
| `sources.md` | Source inventory and conflicts |
| `requirements.md` | Requirements and their coverage |
| `roadmap.config.json` | Paths, vocabulary, limits |

## Check

Run `node <roadmap-folder>/check-roadmap.mjs` (Node 18 or newer). It exits 1 on errors; warnings pass.

## When to update

| Event | Update |
|---|---|
| A decision is made | `decisions.md` first, then whatever uses it |
| A piece or step closes | `log.md` and the panel in `state.md` |
| A branch is integrated or deleted | "in flight" in `state.md` and `log.md` |
| A blocker opens or closes | `state.md` and `critical-path.md` |
| A piece or phase ends | propose a strategy revision |
