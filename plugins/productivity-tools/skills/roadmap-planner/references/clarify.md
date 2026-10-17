# Clarify: bounded question loop

How `roadmap-planner` Step 2 finds what is ambiguous, decides what to ask, asks it, and records the answer. Adapted from spec-kit's `clarify` command (ambiguity scan, impact × uncertainty, at most 5 questions, one at a time, each with a recommendation) for roadmaps, which are broader than one feature.

## Contents

1. Inputs
2. Ambiguity categories
3. Scoring: impact × uncertainty
4. Question format
5. Recommended answers
6. Rounds and the stop rule
7. Recording answers

## 1. Inputs

- The objective as the user stated it.
- The per-source summaries from Step 1 (`SRC-NN`, claims, open items) and the `conflicts` list.
- Project constraints already written down (the project's CLAUDE.md, contributing rules, an existing principles or constitution file). Read them as constraints; do not ask about what they already settle.

## 2. Ambiguity categories

Scan every category and mark it **Clear**, **Partial** or **Missing**. Only Partial and Missing items become question candidates.

| # | Category | Clear when |
|---|----------|------------|
| 1 | Objective and success signal | The objective has a testable acceptance criterion and a definition of done |
| 2 | Scope and non-goals | It is stated what is in and what is explicitly not a goal (things that could reasonably be goals but are chosen not to be) |
| 3 | Stakeholders and jobs | Each stakeholder has a job ("when X, I want Y, so I can Z") and a way to verify it is served |
| 4 | Functional requirements and data | Each capability and the data it needs are stated without "might need" speculation |
| 5 | Flows and edge cases | The main flow is known end to end; failure and edge behaviour is stated or deliberately deferred |
| 6 | Non-functional | Performance, security, privacy, compliance and accessibility needs are stated or ruled out |
| 7 | Integrations and external dependencies | Other teams, clients, vendors and systems, and what is needed from each, are named |
| 8 | Constraints and trade-offs | Fixed dates, budget, technology and staffing limits are supplied by the user or a source, or stated as absent |
| 9 | Terminology | One term per concept; terms that mean different things in different sources are reconciled |
| 10 | Placeholders | No TODO, TBD or "to be defined" left in a source the roadmap relies on |
| 11 | Source conflicts | Every item in the `conflicts` block has a decision or an open question |
| 12 | Unsourced numbers | Every number, date or target in the objective or a source has a basis (baseline, source, owner) |

Categories 11 and 12 are never Clear by default: each conflict and each unsourced number is its own candidate.

## 3. Scoring: impact × uncertainty

Score each candidate on two scales and multiply (1 to 9).

| Score | Impact: if guessed wrong… | Uncertainty |
|-------|---------------------------|-------------|
| 1 | …only wording or a note changes | Sources agree, or one strong primary source |
| 2 | …a deliverable, a piece or an acceptance criterion changes | One weak or secondary source; implied, not stated |
| 3 | …scope, a phase, the order of deliverables or the critical path changes | Missing, or sources conflict |

A source conflict has uncertainty 3. An unsourced number in the objective has impact 3 when it would become a target, 2 otherwise.

| Priority | Action |
|----------|--------|
| 6 to 9 | Ask in this round, highest first |
| 3 to 4 | Ask if the round has budget left; otherwise record as an assumption or an open question |
| 1 to 2 | Do not ask; record as an assumption |

Ties: prefer the candidate that blocks the most requirements, then the one on the critical path.

## 4. Question format

One question per message. Use `AskUserQuestion` when available, otherwise plain text. Each question has:

- **Context**: one or two sentences on why it matters, citing the `SRC` or category.
- **Options**: two to four concrete answers, plus "your own answer".
- **Recommended**: one option marked as recommended, with a one-line reason.

Example:

```
Q2/5 — Sign-in method (SRC-01 vs SRC-03)
SRC-01 (security policy, 2026) requires company SSO; SRC-03 (older brief) plans email + password.
This decides the walking skeleton's sign-in piece and its acceptance criteria.
  A. Company SSO only   <- recommended: SRC-01 is the newer primary source
  B. Email + password only
  C. Both, SSO first
  D. Your own answer
```

Never bundle several questions into one, and never ask a question the sources already answer.

## 5. Recommended answers

The recommendation is advice; the user decides. Base it on:

1. What the sources support, citing them.
2. For a conflict, the default precedence: the user's explicit statement today, then a newer dated primary source, then an older one. Say which rule you applied.
3. For an unsourced number, recommend: "record it as `ASSUMPTION`, add work to measure the baseline first, and set the target once the baseline exists". Never recommend inventing a baseline.
4. For a missing date or duration, recommend: "no date; order by dependencies".
5. When nothing supports any option, say so and recommend deferring it as an open question.

## 6. Rounds and the stop rule

- A round has **at most 5 questions**, asked one at a time; the next question waits for the previous answer, and an answer may change the scores of the remaining candidates.
- After each round, report the categories as **Resolved** (answered now), **Deferred** (left as assumption or open question), **Clear** (needed no question) and **Outstanding** (still high priority).
- Another round, one theme at a time (for example "integrations", then "non-functional"), only when the user consents. Never exceed the budget without asking.

Stop when any of these holds:

1. No candidate with impact 3 remains Partial or Missing with uncertainty ≥ 2, and the objective has a testable acceptance criterion and a non-goals list.
2. The user says to stop.
3. The user declines another round.

Whatever remains goes into "Open questions" in the strategy and, when it blocks a requirement, makes that requirement `needs-clarification`.

## 7. Recording answers

| Answer kind | Where it goes |
|-------------|---------------|
| A **choice** between options | A `DEC-NNN` row in `decisions.md`: Decision = the chosen option; Discarded alternative = the options not chosen; Contradicts `-`; Revisit when = the condition that would reopen it; Origin `user`; Status `in-force` |
| An **unverified fact** ("the vendor API allows about 100 calls a minute") | The Assumptions table, tagged `ASSUMPTION`, with an owner and "re-validate when" |
| A conflict settled by the user | A `DEC` row whose Decision cites both `SRC` IDs (Origin `user`); the `conflicts` item stays and names the `DEC` (`SRC-01 vs SRC-03: … -> DEC-002`) |
| No answer, or "later" | "Open questions" in the strategy; affected requirements `needs-clarification` |
| A new source the user points to | A new `SRC` row, read like the others in Step 1 |

Record only what the user actually answered. When the user accepts a recommendation, the decision is still the user's (Origin `user`). Requirements derived from an answer cite its `DEC`.
