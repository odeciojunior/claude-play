# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the TypeScript sources. Key domains sit in modular folders: `neural/` for SAFLA learning pipelines, `goap/` for planning logic, `hive-mind/` for coordination, `performance/`, `risk-management/`, and `security/` for specialized services. Database helpers and migrations live under `src/database/`.
- `tests/` mirrors the runtime modules with Jest suites (`unit/`, `integration/`, `e2e/`, etc.) plus shared setup in `tests/setup.ts`.
- `docs/`, `config/`, and `memory/` supply reference material, configuration presets, and persistent artifacts; generated bundles go to `dist/`.

## Build, Test, and Development Commands
- `npm install` aligns dependencies with `package-lock.json`; stick to Node ≥18 and npm ≥9 per `package.json`.
- `npm run build` emits compiled JavaScript to `dist/`; `npm run build:watch` recompiles during active development.
- `npm run lint`, `npm run lint:fix`, and `npm run typecheck` enforce ESLint and TypeScript rules before commits.
- `npm test` runs the full Jest suite; narrow scopes with scripts such as `npm run test:unit`, `npm run test:integration`, or `npm run test:coverage` for reporting.
- Database migrations are scripted through `npm run db:migrate[:verify|:reset|:stats|:force]`; run from a clean working tree to avoid schema drift.

## Coding Style & Naming Conventions
- TypeScript sources use 2-space indentation, ES2019+ modules, and prefer explicit interfaces (`LearningPipelineConfig`) and descriptive enums over primitive literals.
- Follow the existing naming pattern: PascalCase for classes (`LearningPipeline`), camelCase for functions and variables, SCREAMING_SNAKE_CASE for constants.
- Treat `eslint` as authoritative; configure additional rules in `.eslintrc.*` only after team discussion. Run `npm run lint:fix` before pushing.

## Testing Guidelines
- New behavior requires companion Jest specs alongside the relevant module (e.g., `tests/neural/learning-system.test.ts` for `src/neural/learning-pipeline.ts`).
- Name test files `*.test.ts` and structure suites with descriptive `describe()` blocks that echo the feature or scenario.
- Validate coverage with `npm run test:coverage`; avoid regressions below the current thresholds shown in `coverage/coverage-summary.json`.

## Commit & Pull Request Guidelines
- Commits are short, imperative statements and often begin with an emoji for quick scanning (see `git log`, e.g., `🚀 Deployment Recommendation`). Keep messages under 72 characters and focus on the user-facing change.
- Squash incidental work before opening a PR. Include: purpose summary, testing notes (commands run), linked issues, and screenshots or logs when behavior is user-visible.
- Ensure the branch is lint-clean, tests pass locally, and migrations (if any) have been verified before requesting review.
