Update the sandbox roadmap folder `docs/plans/roadmap-sandbox/` for two events that just happened:

1. Decision: E2 will clamp its result to the closed range 0..1 by calling `clamp` from E1 instead of repeating the comparison. Discarded alternative: keep a private comparison inside `normalize`. Record it as DEC-003 for deliverable E2, origin SRC-01, status in-force.
2. Event: deliverable E1 was integrated into `main` (merged and verified, G1 green). Move E1 to integrated in the panel, update what is in flight and add a log entry.

Run the folder checker afterwards and report its result. Do not commit.
