# E1 -- Walking skeleton: design (sintético)

Fixture sintética para a execução extra de E22. Card de origem: E1 de `pasta/strategy.md`.

## Objetivo

Um pedido atravessa da entrada ao armazenamento e volta (peça 1 do card E1).

## Critérios de aceitação

1. Given an empty system, when a user submits one item of at most 100 characters, then the item is stored and shown back. {verify: test; evidence: node --test tests/e1.test.mjs}
2. Given a stored item, when the user reloads, then the same item is shown. {verify: smoke; evidence: node scripts/smoke.mjs reload}

## Arquitetura

Um formulário grava o item num arquivo e a página o mostra de volta.
