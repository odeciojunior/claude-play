# Plugin-Reviewer Subagent — Design

**Date**: 2026-03-04
**Status**: Approved

## Overview

A Claude Code subagent that reviews plugin submissions against marketplace quality and security standards. Manually triggered, runs as a parallel subagent, reuses `/validate-plugin` for structural checks.

## Architecture

- **File**: `.claude/agents/plugin-reviewer.md`
- **Trigger**: Manual — "review plugin X" or "check this plugin submission"
- **Invocation**: Dispatched as a subagent via the Agent tool
- **Dependencies**: Reuses `/validate-plugin` skill for structural validation (Phase 1)

## Review Process

### Phase 1: Structural Validation
- Run the same 7 checks as `/validate-plugin`:
  1. Directory name matches plugin.json name
  2. plugin.json has all required fields
  3. SKILL.md frontmatter validation
  4. README.md exists and is non-empty
  5. No hardcoded absolute paths
  6. No sensitive data patterns
  7. Plugin registered in marketplace.json

### Phase 2: Content Quality Review
- **SKILL.md quality**: Clear trigger description? Well-defined workflow? Enough detail for Claude to follow?
- **README quality**: Explains what plugin does, installation, usage for each skill?
- **Naming**: Plugin name descriptive? Skill names make sense?

### Phase 3: Security & Policy Review
- Scan for destructive shell commands (`rm -rf`, `curl | bash`, `eval`, etc.)
- Check for data exfiltration patterns (external URLs in commands)
- Verify no `dangerouslyDisableSandbox` usage
- Check allowed-tools in skills — flag overly permissive tool lists
- Verify compliance with CONTRIBUTING.md "What We Don't Accept" rules

## Output Format

```
## Plugin Review: <name>

### Structural Checks
[7-check validation output with OK/WARN/FAIL]

### Content Quality
- SKILL.md descriptions: [GOOD/NEEDS WORK] — [details]
- README completeness: [GOOD/NEEDS WORK] — [details]
- Naming clarity: [GOOD/NEEDS WORK] — [details]

### Security & Policy
- No destructive commands: [PASS/FLAG]
- No data exfiltration: [PASS/FLAG]
- No sandbox bypass: [PASS/FLAG]
- Tool permissions appropriate: [PASS/FLAG]
- Policy compliant: [PASS/FLAG]

### Verdict: [APPROVE / REQUEST CHANGES]
[Summary of required changes, if any]
```
