# Linha de base

Data: 2026-11-12. Commit da tag de partida: 3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a.

## Release e coordinator

| Variante | Válidas/pedidas | Custo mediano (faixa) | Plugin | Superpowers | Modelos | Preços | CLI | Permissão |
|---|---|---|---|---|---|---|---|---|
| plan-only | 5/5 | US$ 1,37 (US$ 1,29 a US$ 1,64) | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |
| coordinator | 3/3 | US$ 0,33 (US$ 0,22 a US$ 0,35) | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |
| completo | 3/3 | US$ 3,71 (US$ 3,56 a US$ 3,76) | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |
| parada-retomada | 3/3 | US$ 4,78 (US$ 4,69 a US$ 4,90) | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus, other | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |

### Papéis (chamadas por família e bytes de prompt, somados nas execuções válidas)

| Variante | Papel | haiku | sonnet | opus | fable | other | Bytes de prompt |
|---|---|---|---|---|---|---|---|
| plan-only | plan | 0 | 0 | 5 | 0 | 0 | 50206 |
| plan-only | spec-review | 0 | 0 | 5 | 0 | 0 | 34406 |
| plan-only | spec | 0 | 0 | 5 | 0 | 0 | 36121 |
| plan-only | plan-review | 0 | 0 | 5 | 0 | 0 | 43390 |
| plan-only | setup | 5 | 0 | 0 | 0 | 0 | 31011 |
| plan-only | discovery | 0 | 5 | 0 | 0 | 0 | 21410 |
| plan-only | report | 0 | 5 | 0 | 0 | 0 | 31775 |
| plan-only | status-record | 0 | 5 | 0 | 0 | 0 | 36093 |
| plan-only | preflight | 0 | 5 | 0 | 0 | 0 | 31445 |
| coordinator | agent:general-purpose | 3 | 4 | 0 | 0 | 0 | 19925 |
| coordinator | final-review | 0 | 0 | 3 | 0 | 0 | 6743 |
| completo | final-review | 3 | 3 | 3 | 0 | 0 | 38010 |
| completo | merge | 6 | 6 | 0 | 0 | 0 | 32430 |
| completo | preflight | 0 | 3 | 0 | 0 | 0 | 21189 |
| completo | report | 0 | 3 | 0 | 0 | 0 | 22527 |
| completo | task-spec-review | 0 | 10 | 0 | 0 | 0 | 75172 |
| completo | guards | 3 | 0 | 0 | 0 | 0 | 3993 |
| completo | status-record | 0 | 3 | 0 | 0 | 0 | 23445 |
| completo | implementer | 1 | 9 | 0 | 0 | 0 | 60797 |
| completo | plan-review | 0 | 0 | 3 | 0 | 0 | 26848 |
| completo | progress | 3 | 0 | 0 | 0 | 0 | 3444 |
| completo | spec | 0 | 0 | 3 | 0 | 0 | 21630 |
| completo | discovery | 0 | 3 | 0 | 0 | 0 | 12840 |
| completo | plan | 0 | 0 | 3 | 0 | 0 | 31632 |
| completo | gates | 0 | 6 | 0 | 0 | 0 | 23673 |
| completo | review-log | 0 | 3 | 0 | 0 | 0 | 16193 |
| completo | spec-review | 0 | 0 | 3 | 0 | 0 | 20577 |
| completo | task-quality-review | 0 | 10 | 0 | 0 | 0 | 73702 |
| completo | docs | 3 | 3 | 0 | 0 | 0 | 23655 |
| completo | setup | 3 | 0 | 0 | 0 | 0 | 18552 |
| parada-retomada | discovery | 0 | 6 | 0 | 0 | 0 | 25764 |
| parada-retomada | plan-review | 0 | 0 | 6 | 0 | 0 | 54480 |
| parada-retomada | status-record | 0 | 6 | 0 | 0 | 0 | 47391 |
| parada-retomada | progress | 6 | 0 | 0 | 0 | 0 | 6984 |
| parada-retomada | setup | 6 | 0 | 0 | 0 | 0 | 38018 |
| parada-retomada | preflight | 0 | 6 | 0 | 0 | 0 | 43134 |
| parada-retomada | implementer | 2 | 9 | 0 | 0 | 0 | 67647 |
| parada-retomada | spec | 0 | 0 | 6 | 0 | 0 | 43586 |
| parada-retomada | spec-review | 0 | 0 | 6 | 0 | 0 | 41564 |
| parada-retomada | plan | 0 | 0 | 6 | 0 | 0 | 63422 |
| parada-retomada | task-spec-review | 0 | 11 | 0 | 0 | 2 | 98388 |
| parada-retomada | docs | 3 | 3 | 0 | 0 | 0 | 23883 |
| parada-retomada | final-review | 3 | 3 | 3 | 0 | 0 | 38838 |
| parada-retomada | gates | 0 | 6 | 0 | 0 | 0 | 24417 |
| parada-retomada | report | 0 | 3 | 0 | 0 | 0 | 23654 |
| parada-retomada | review-log | 0 | 3 | 0 | 0 | 0 | 17527 |
| parada-retomada | task-quality-review | 0 | 11 | 0 | 0 | 0 | 81511 |
| parada-retomada | merge | 6 | 6 | 0 | 0 | 0 | 33762 |
| parada-retomada | other | 0 | 3 | 0 | 0 | 0 | 5241 |
| parada-retomada | guards | 3 | 0 | 0 | 0 | 0 | 4119 |

## Planner e tracker

Nota: custo não é comparado nesta skill (DEC-016).

| Variante | Válidas/pedidas | Custo mediano (faixa) | Plugin | Superpowers | Modelos | Preços | CLI | Permissão |
|---|---|---|---|---|---|---|---|---|
| planner | 1/1 | ver nota | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) |  | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |
| tracker | 1/1 | ver nota | 1.6.0 (3fbb59b2c85f) | 7.0.0 (bb92a7774141) |  | 2026-11-10 | 2.1.322 (Claude Code) | bypassPermissions |

| Variante | Papel | haiku | sonnet | opus | fable | other | Bytes de prompt |
|---|---|---|---|---|---|---|---|

## Detecção por classe

### Detecção por classe: plano (plano-semeado)

| Defeito | Capturado | Perdido | Indeterminado |
|---|---|---|---|
| P1 | 5 | 0 | 0 |
| P2 | 5 | 0 | 0 |
| P3 | 5 | 0 | 0 |
| P4 | 5 | 0 | 0 |
| P5 | 5 | 0 | 0 |
| P6 | 5 | 0 | 0 |
| P7 | 5 | 0 | 0 |
| P8 | 5 | 0 | 0 |
| total | 40 | 0 | 0 |

- Tentativas válidas da classe: 40 (alvo 40).
- Execuções inválidas: 0 (taxa 0%).
- Motivos de inválida: nenhum.
- Medido pelo harness de etapa: plan-review, braço atual, commit do workflow 3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a.
- Origem da semeadura: execucao-aprovada; spec 2026-11-12-E5-text-utilities-design.md (sha256 7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93); plano 2026-11-12-E5-text-utilities.md (sha256 ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912).

### Detecção por classe: código (codigo-semeado)

| Defeito | Capturado | Perdido | Indeterminado |
|---|---|---|---|
| C1 | 5 | 0 | 0 |
| C2 | 5 | 0 | 0 |
| C3 | 5 | 0 | 0 |
| C4 | 5 | 0 | 0 |
| C5 | 4 | 0 | 1 |
| C6 | 5 | 0 | 0 |
| C7 | 4 | 0 | 1 |
| C8 | 5 | 0 | 0 |
| total | 38 | 0 | 2 |

- Tentativas válidas da classe: 40 (alvo 40).
- Execuções inválidas: 5 (taxa 33.3%).
- Motivos de inválida: parou-antes-do-codigo (5).
- Origem da semeadura: execucao-aprovada; spec 2026-11-12-E5-text-utilities-design.md (sha256 7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93); plano 2026-11-12-E5-text-utilities.md (sha256 ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912).

## Valores de referência para as metas

Mediana de cada contador por variante, nas execuções válidas.

| Contador | planner | tracker | plan-only | coordinator | completo | parada-retomada | plano-semeado-A | plano-semeado-B | codigo-semeado-A | codigo-semeado-B |
|---|---|---|---|---|---|---|---|---|---|---|
| haiku | 0 | 0 | 1 | 0 | 7 | 9 | 0 | 0 | 7 | 7 |
| sonnet | 0 | 0 | 4 | 2 | 11 | 15 | 0 | 0 | 12 | 12 |
| opus | 0 | 0 | 4 | 1 | 5 | 9 | 1 | 1 | 5 | 5 |
| fable | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| other | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ponderado | 0 | 0 | 241 | 80 | 427 | 669 | 40 | 40 | 447 | 447 |
| bytes | 0 | 0 | 63062 | 9049 | 113364 | 178543 | 2800 | 2800 | 123322 | 121947 |
| por tarefa | - | - | - | - | 60 | 55.25 | - | - | 81.5 | 81.5 |
| rodadas extras | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 5 |
| correções | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 4 | 5 |
| chamadas (principal) | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| bytes (principal) | 1244 | 772 | 7393 | 1423 | 8361 | 9511 | 7967 | 6668 | 10545 | 10549 |
| turnos (principal) | 11 | 7 | 8 | 17 | 9 | 13 | 4 | 5 | 9 | 8 |
| estático (bytes) | - | - | - | - | - | - | - | - | - | - |
| custo | - | - | 1.373 | 0.3329 | 3.7053 | 4.7781 | 0.3769 | 0.3388 | 3.9958 | 4.1549 |

## Linhas para roadmap:measurements

| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |
|---|---|---|---|---|---|---|
| 2026-11-12 | E15 | linha-de-base | planner: 1/1 execuções válidas | US$ 0,00 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | tracker: 1/1 execuções válidas | US$ 0,00 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plan-only: 5/5 execuções válidas | US$ 7,03 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | coordinator: 3/3 execuções válidas | US$ 0,91 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | completo: 3/3 execuções válidas | US$ 11,03 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | parada-retomada: 3/3 execuções válidas | US$ 14,37 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plano-semeado-A: 5/5 execuções válidas | US$ 1,89 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plano-semeado-B: 5/5 execuções válidas | US$ 1,68 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | codigo-semeado-A: 5/5 execuções válidas | US$ 21,39 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | codigo-semeado-B: 5/5 execuções válidas | US$ 21,53 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | detecção plano-semeado: 40 tentativas válidas | US$ 3,56 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | detecção codigo-semeado: 40 tentativas válidas | US$ 42,93 (custo devolvido pela CLI) | - | concluído |
