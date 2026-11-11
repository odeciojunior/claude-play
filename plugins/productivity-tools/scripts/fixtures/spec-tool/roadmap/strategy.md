<!-- roadmap:version 1.0 2026-01-01 -->
# Sample Roadmap -- Strategy v1.0

## Deliverables

<!-- roadmap:card id=E1 phase=skeleton track=engineering priority=Must size="not estimated" depends=- reqs=REQ-001 critical=true -->
### E1 -- Walking skeleton

Why: REQ-001. A thin path through every layer.

Pieces:

- Piece 1: one request travels from input to storage and back.

<!-- roadmap:acceptance -->
1. Given an empty system, when a user submits one item, then the item is stored and shown back. {verify: test; evidence: node --test tests/e1.test.mjs}
2. Given a stored item, when the owner supplies the storage credential, then the item is read from the real backend. {verify: blocked BLQ-1; evidence: aguarda credencial do dono}
3. Given a stored item, when the user reloads, then the same item is shown.
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch.

<!-- roadmap:risks -->
- The storage layer is unproven -> build it first and test it alone.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->
