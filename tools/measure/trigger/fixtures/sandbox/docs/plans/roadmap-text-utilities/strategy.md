<!-- roadmap:version 1.0 2026-01-01 -->
# Text Utilities Roadmap -- Strategy v1.0

## Deliverables

<!-- roadmap:card id=E3 phase=core track=engineering priority=Must size="not estimated" depends=- reqs=REQ-001 critical=true -->
### E3 -- Text utilities

Why: REQ-001. Basic text helpers used by the other deliverables.

Pieces:

- Piece 1: count the words of a text.
- Piece 2: reverse the words of a text.

<!-- roadmap:acceptance -->
1. Given a text with words separated by spaces, when countWords is called, then it returns the number of words. {verify: test; evidence: node --test tests/count.test.mjs}
2. Given a text, when reverseWords is called, then the words come back in reverse order. {verify: test; evidence: node --test tests/reverse.test.mjs}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch.

<!-- roadmap:risks -->
- Unicode word boundaries differ by locale -> split on whitespace only.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->
