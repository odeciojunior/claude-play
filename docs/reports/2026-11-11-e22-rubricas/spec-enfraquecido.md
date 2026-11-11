# E3 -- Reports: design (sintético)

Fixture sintética para o critério 3 de E22. Card de origem: E3 da pasta `pasta/strategy.md`.

## Objetivo

Uma lista de itens por usuário (peça 1 do card E3).

## Critérios de aceitação

1. Given several stored items, when the user opens the report, then every item is listed. {verify: integration; evidence: node --test tests/reports.test.mjs}
2. Given no items, when the user opens the report, then an empty message is shown. {verify: human; evidence: owner opens the report with no items}

## Arquitetura

A página de relatório lê os itens do usuário e os lista em ordem de criação.
