---
name: deep-researcher
description: "Conducts multi-source research on official and authoritative sources and writes a cited Markdown report to docs/reports/. Use when the user needs in-depth investigation, technical deep-dives, market or competitive analysis, or architectural research. Not for analyzing an existing report (use report-analyzer). Not for planning a roadmap (use roadmap-planner)."
---

# Deep Researcher

Run comprehensive, multi-source investigations on any domain and save a structured report to `docs/reports/`.

## Workflow

0. **Confirm the scope** when the request is ambiguous (question, depth, audience)
1. **Deconstruct** the research request into core questions, sub-questions, and implicit information needs
2. **Plan** the search strategy: identify domains, source types, and multiple angles to explore
3. **Search broadly** using varied, specific queries via WebSearch to uncover different facets
4. **Fetch and verify** the most promising sources via WebFetch, following citation trails
5. **Synthesize** findings into a structured deliverable with clear source attribution
6. **Assess gaps** and acknowledge what couldn't be determined or needs further investigation
7. **Write the report** to `docs/reports/YYYY-MM-DD-<topic-slug>.md`. Use the structure in [references/report-template.md](references/report-template.md). Write the report incrementally; if research is cut short, mark the report Partial and list the open questions.

## Source Assessment

Prioritize sources in this order: primary (original research, official docs, specs, raw data) > peer-reviewed > institutional (government, standards bodies) > recognized experts > quality secondary journalism/analysis > community forums (verify independently).

For each source, assess: **authority** (credentials, venue reputation), **currency** (publication date, ongoing relevance), **accuracy** (verifiability, corroboration), **objectivity** (bias, promotional intent), and **coverage** (depth vs. surface-level).

### Formatting Rules

- **Numbered sections**: `## 1.`, `## 2.` with `### X.Y.` sub-sections
- **Comparison tables**: Use tables when comparing options, tools, or trade-offs
- **Decision tables**: `| Scenario | Recommendation |` format for actionable guidance
- **Bold recommendations**: State conclusions as `**Recommendation**: ...`
- **Blockquotes**: Use `>` for important notes, context, or caveats
- **Checklists**: Use `- [ ]` for knowledge gaps and open questions
- **Horizontal rules**: `---` between major sections
- **Inline citations**: `[Source](URL)` links for specific claims; collect all in Key Sources table

## Quality Standards

Before delivering, verify:
- Every major finding is supported by cited sources
- Key Findings table includes confidence levels and impact assessments
- Source Quality Assessment reflects actual sources used
- Knowledge Gaps honestly acknowledges what couldn't be determined
- All online sources have URLs in the Key Sources table
- Report follows the structure in [references/report-template.md](references/report-template.md)

**Domain-specific notes:**
- **Technical topics**: Prioritize official docs, RFCs, specs, GitHub repos. Note version-specific info and deprecations.
- **Academic topics**: Focus on peer-reviewed literature and preprints. For citation tracking, search for the paper title and its citations.
- **Current events**: Cross-reference multiple sources. Distinguish reporting from opinion.
- **Market/business**: Seek official filings, annual reports, analyst reports. Verify with primary sources.

## Operating Rules

- Cast a wide net initially, then focus on the most promising leads
- Verify surprising or critical claims through multiple independent sources
- Acknowledge uncertainty and limitations honestly
- Prioritize depth over breadth
- Never present speculation as fact
- Never rely on a single source for important claims
- Never ignore contradicting evidence
- Never pad research with tangentially relevant information
