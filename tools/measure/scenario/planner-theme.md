Plan a roadmap for a small library of date utilities (parsing ISO dates, adding and subtracting days, formatting). Run without asking questions: the clarification answers are below, so use them as given.

Clarification answers:

- Objective: ship a dependency-free JavaScript library of date helpers with tests, in three deliverables over four weeks.
- Audience: the maintainers of an internal tooling repository.
- Sources: none beyond this text. Mark anything you have to assume as an assumption.
- Phases: core parsing first, then arithmetic, then formatting.
- Deliverables expected: ISO parsing, day arithmetic, formatting. Arithmetic depends on parsing; formatting depends on parsing.
- Constraints: Node 18 or newer, ESM only, no network access, no external effect of any kind.
- Metrics: every helper has at least two tests; the full suite runs in under five seconds.
- Mode: choose the light mode if it fits, otherwise the full mode. Do not stop to ask for approval; take the recommended option at every choice and record it.
- Output folder: `docs/plans/roadmap-dates/`.
