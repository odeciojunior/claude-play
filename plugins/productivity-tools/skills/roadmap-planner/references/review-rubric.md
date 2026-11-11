# Reviewer rubric

Read by the fresh-context reviewer of Step 7. The reviewer is read-only: do not edit files. It checks only what `check-roadmap.mjs` cannot see. No style comments, no praise.

Inputs: the roadmap folder, the strategy, the sources. Read the strategy and the files it cites; read each source before judging a claim against it.

## Rules

Each rule has an id, what to look for, a default severity, and one short example of a finding and of a non-finding.

### `unsourced-number` (error)

A number, date, target or estimate with no `SRC`, `DEC`, `ASSUMPTION` or `UNSOURCED` next to it.

- Finding: objective says "cuts onboarding time by 40%" and no source or marker backs the 40.
- Not a finding: "cuts onboarding time by 40% (SRC-02)", or the same text tagged `ASSUMPTION` with an owner.

### `compound-requirement` (error)

A `REQ` that holds two or more separately verifiable behaviors.

- Finding: "The portal lets a user sign up and also exports the user list as CSV."
- Not a finding: "The portal lets a user sign up with an e-mail and a password." (one behavior, two inputs).

### `unverifiable-criterion` (error)

An acceptance criterion that its `verify` command or evidence cannot confirm: vague, no observable result, or a command that does not exercise the criterion.

- Finding: "A new user can sign up" with `{verify: test; evidence: node --version}`.
- Not a finding: the same criterion with `{verify: test; evidence: node --test signup.test.mjs}`.

### `untraced-claim` (error)

A statement in the strategy with no source, decision or marker.

- Finding: "Teams already use the old tool daily" with no `SRC` and no `ASSUMPTION`.
- Not a finding: the same sentence ending in `(SRC-03)`.

### `requirement-gap` (error)

A requirement in a source that never became a `REQ`, or a `REQ` the source does not support.

- Finding: SRC-01 says "audit log required" and no `REQ` mentions it.
- Not a finding: the audit log is a `REQ` marked `out-of-scope` with a reason.

### `task-sized-deliverable` (warning)

A deliverable that does not need its own spec and plan.

- Finding: "E5: rename the config key".
- Not a finding: "E5: verified roadmap format", which has several pieces and criteria.

### `layer-slice` (warning)

A deliverable or phase named by technical layer rather than by outcome.

- Finding: phase "Database layer".
- Not a finding: phase "Records survive restarts".

### `hope-mitigation` (warning)

A mitigation that is not an action.

- Finding: risk "scope creep -> hope the team stays focused".
- Not a finding: "scope creep -> freeze the card after the spec is approved".

### `conflict-resolved-silently` (error)

Two sources disagree, the roadmap picks one, and there is neither a `DEC` nor an entry in the `conflicts` block.

- Finding: SRC-01 says Node 18, SRC-02 says Node 20, the strategy says Node 20 with no trace.
- Not a finding: the same choice recorded as `DEC-004` or listed in `conflicts`.

A problem that fits no rule uses the rule `other`, with the explanation in `evidence`.

## Output

Reply with exactly one fenced JSON block and nothing else:

```json
{
  "findings": [
    {
      "file": "docs/plans/roadmap-x/strategy.md",
      "line": 8,
      "rule": "unsourced-number",
      "severity": "error",
      "evidence": "literal quote from the file",
      "fix": "one sentence"
    }
  ],
  "summary": { "error": 1, "warning": 0 }
}
```

- `file` is relative to the repository root.
- `line` is optional.
- `evidence` is the literal quote.
- `fix` is one sentence.
- No findings: `{"findings":[],"summary":{"error":0,"warning":0}}`.
