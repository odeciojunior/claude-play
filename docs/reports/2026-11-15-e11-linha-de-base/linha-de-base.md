# Linha de base

Data: 2026-11-15. Commit da tag de partida: df3f1fa4cd6923e13d42595a5a5f91cf1b6e8655.

## Pendências

- erro: plugin commit diverges between variants: 2b8c56ebeab5db12d48747452ee915fbf8ae9019, df3f1fa4cd6923e13d42595a5a5f91cf1b6e8655
- erro: plugin commit 2b8c56ebeab5db12d48747452ee915fbf8ae9019 is not the start tag commit df3f1fa4cd6923e13d42595a5a5f91cf1b6e8655

## Release e coordinator

| Variante | Válidas/pedidas | Custo mediano (faixa) | Plugin | Superpowers | Modelos | Preços | CLI | Permissão |
|---|---|---|---|---|---|---|---|---|
| plan-only | 5/5 | US$ 1,41 (US$ 1,36 a US$ 2,14) | 2.0.0 (df3f1fa4cd69) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |
| coordinator | 5/5 | US$ 0,12 (US$ 0,12 a US$ 0,17) | 2.0.0 (df3f1fa4cd69) | 7.0.0 (bb92a7774141) | haiku, opus | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |
| completo | 3/3 | US$ 2,80 (US$ 2,68 a US$ 3,43) | 2.0.0 (2b8c56ebeab5) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |
| parada-retomada | 3/3 | US$ 3,43 (US$ 3,37 a US$ 3,91) | 2.0.0 (2b8c56ebeab5) | 7.0.0 (bb92a7774141) | haiku, sonnet, opus | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |

### Papéis (chamadas por família e bytes de prompt, somados nas execuções válidas)

| Variante | Papel | haiku | sonnet | opus | fable | other | Bytes de prompt |
|---|---|---|---|---|---|---|---|
| plan-only | setup | 5 | 0 | 0 | 0 | 0 | 35379 |
| plan-only | review-log | 0 | 5 | 0 | 0 | 0 | 23169 |
| plan-only | other | 27 | 0 | 0 | 0 | 0 | 133502 |
| plan-only | report | 0 | 5 | 0 | 0 | 0 | 29939 |
| plan-only | plan | 0 | 0 | 5 | 0 | 0 | 42284 |
| plan-only | status-record | 10 | 0 | 0 | 0 | 0 | 26539 |
| plan-only | spec-review | 0 | 0 | 8 | 0 | 0 | 56829 |
| plan-only | preflight | 0 | 5 | 0 | 0 | 0 | 31490 |
| plan-only | spec | 0 | 0 | 5 | 0 | 0 | 32679 |
| plan-only | plan-review | 0 | 0 | 5 | 0 | 0 | 41491 |
| plan-only | discovery | 5 | 0 | 0 | 0 | 0 | 6070 |
| plan-only | spec-fix | 0 | 0 | 3 | 0 | 0 | 18280 |
| coordinator | other | 150 | 0 | 0 | 0 | 0 | 193696 |
| coordinator | final-review | 0 | 0 | 5 | 0 | 0 | 8687 |
| completo | status-record | 6 | 0 | 0 | 0 | 0 | 21968 |
| completo | report | 0 | 3 | 0 | 0 | 0 | 29801 |
| completo | task-spec-review | 0 | 9 | 0 | 0 | 0 | 66323 |
| completo | other | 15 | 2 | 0 | 0 | 0 | 83230 |
| completo | spec | 0 | 0 | 3 | 0 | 0 | 19629 |
| completo | setup | 3 | 0 | 0 | 0 | 0 | 21177 |
| completo | spec-fix | 0 | 0 | 1 | 0 | 0 | 5982 |
| completo | task-quality-review | 0 | 9 | 0 | 0 | 0 | 66350 |
| completo | docs | 3 | 3 | 0 | 0 | 0 | 28452 |
| completo | discovery | 3 | 0 | 0 | 0 | 0 | 3633 |
| completo | plan | 0 | 0 | 3 | 0 | 0 | 25392 |
| completo | merge | 6 | 6 | 0 | 0 | 0 | 32832 |
| completo | spec-review | 0 | 0 | 4 | 0 | 0 | 28094 |
| completo | gates | 0 | 6 | 0 | 0 | 0 | 24261 |
| completo | review-log | 0 | 3 | 0 | 0 | 0 | 23558 |
| completo | preflight | 0 | 3 | 0 | 0 | 0 | 22617 |
| completo | implementer | 9 | 0 | 0 | 0 | 0 | 51411 |
| completo | final-review | 3 | 3 | 3 | 0 | 0 | 36312 |
| completo | plan-review | 0 | 0 | 3 | 0 | 0 | 27057 |
| completo | progress | 3 | 0 | 0 | 0 | 0 | 5658 |
| parada-retomada | other | 29 | 4 | 0 | 0 | 0 | 152607 |
| parada-retomada | plan-review | 0 | 0 | 3 | 0 | 0 | 27467 |
| parada-retomada | status-record | 14 | 1 | 0 | 0 | 0 | 52285 |
| parada-retomada | setup | 6 | 0 | 0 | 0 | 0 | 43468 |
| parada-retomada | implementer | 10 | 0 | 0 | 0 | 0 | 57299 |
| parada-retomada | spec-review | 0 | 0 | 7 | 0 | 0 | 50577 |
| parada-retomada | progress | 6 | 0 | 0 | 0 | 0 | 9231 |
| parada-retomada | plan | 0 | 0 | 3 | 0 | 0 | 25519 |
| parada-retomada | discovery | 6 | 0 | 0 | 0 | 0 | 7350 |
| parada-retomada | preflight | 0 | 6 | 0 | 0 | 0 | 46074 |
| parada-retomada | spec-fix | 0 | 0 | 4 | 0 | 0 | 24557 |
| parada-retomada | spec | 0 | 0 | 3 | 0 | 0 | 19756 |
| parada-retomada | merge | 6 | 6 | 0 | 0 | 0 | 33924 |
| parada-retomada | task-spec-review | 0 | 10 | 0 | 0 | 0 | 68036 |
| parada-retomada | final-review | 3 | 3 | 3 | 0 | 0 | 37110 |
| parada-retomada | task-quality-review | 0 | 10 | 0 | 0 | 0 | 68066 |
| parada-retomada | report | 0 | 3 | 0 | 0 | 0 | 28110 |
| parada-retomada | review-log | 0 | 3 | 0 | 0 | 0 | 21517 |
| parada-retomada | gates | 0 | 6 | 0 | 0 | 0 | 24765 |
| parada-retomada | docs | 3 | 3 | 0 | 0 | 0 | 28893 |

## Planner e tracker

Nota: custo não é comparado nesta skill (DEC-016).

| Variante | Válidas/pedidas | Custo mediano (faixa) | Plugin | Superpowers | Modelos | Preços | CLI | Permissão |
|---|---|---|---|---|---|---|---|---|
| planner | 1/1 | ver nota | 2.0.0 (df3f1fa4cd69) | 7.0.0 (bb92a7774141) | opus | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |
| tracker | 1/1 | ver nota | 2.0.0 (df3f1fa4cd69) | 7.0.0 (bb92a7774141) |  | 2026-11-10 | 2.1.325 (Claude Code) | bypassPermissions |

| Variante | Papel | haiku | sonnet | opus | fable | other | Bytes de prompt |
|---|---|---|---|---|---|---|---|
| planner | agent:general-purpose | 0 | 0 | 3 | 0 | 0 | 6184 |

## Detecção por classe

### Detecção por classe: plano (plano-semeado)

| Defeito | Capturado | Perdido | Indeterminado |
|---|---|---|---|
| P1 | 5 | 0 | 0 |
| P2 | 5 | 0 | 0 |
| P9 | 5 | 0 | 0 |
| P4 | 5 | 0 | 0 |
| P5 | 5 | 0 | 0 |
| P6 | 5 | 0 | 0 |
| P10 | 5 | 0 | 0 |
| P8 | 5 | 0 | 0 |
| total | 40 | 0 | 0 |

- Tentativas válidas da classe: 40 (alvo 40).
- Execuções inválidas: 0 (taxa 0%).
- Motivos de inválida: nenhum.
- Medido pelo harness de etapa: plan-review, braço atual, commit do workflow 3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a.
- Origem: release nativo (sem semeadura).

### Detecção por classe: código (codigo-semeado)

| Defeito | Capturado | Perdido | Indeterminado |
|---|---|---|---|
| C2 | 5 | 0 | 0 |
| C3 | 5 | 0 | 0 |
| C4 | 5 | 0 | 0 |
| C9 | 5 | 0 | 0 |
| C5 | 5 | 0 | 0 |
| C6 | 5 | 0 | 0 |
| C7 | 5 | 0 | 0 |
| C8 | 5 | 0 | 0 |
| total | 40 | 0 | 0 |

- Tentativas válidas da classe: 40 (alvo 40).
- Execuções inválidas: 0 (taxa 0%).
- Motivos de inválida: nenhum.
- Origem: release nativo (sem semeadura).

## Valores de referência para as metas

Mediana de cada contador por variante, nas execuções válidas.

| Contador | planner | tracker | plan-only | coordinator | completo | parada-retomada | plano-nativo-A | plano-nativo-B | codigo-nativo-A | codigo-nativo-B |
|---|---|---|---|---|---|---|---|---|---|---|
| haiku | 0 | 0 | 9 | 15 | 13 | 24 | 0 | 0 | 13 | 12 |
| sonnet | 0 | 0 | 3 | 0 | 9 | 11 | 0 | 0 | 10 | 10 |
| opus | 3 | 0 | 4 | 1 | 5 | 5 | 1 | 1 | 3 | 3 |
| fable | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| other | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ponderado | 120 | 0 | 229 | 55 | 393 | 444 | 40 | 40 | 333 | 332 |
| bytes | 6184 | 0 | 85236 | 23229 | 135078 | 185806 | 2710 | 2710 | 119842 | 114441 |
| por tarefa | - | - | - | 5 | 41 | 41 | - | - | 61 | 61 |
| rodadas extras | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 2 |
| correções | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 2 | 2 |
| chamadas (principal) | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| bytes (principal) | 1244 | 772 | 6719 | 2814 | 9192 | 9677 | 5571 | 5875 | 8769 | 9009 |
| turnos (principal) | 16 | 7 | 8 | 7 | 8 | 16 | 6 | 5 | 8 | 8 |
| estático (bytes) | - | - | - | - | - | - | - | - | - | - |
| custo | - | - | 1.4087 | 0.1192 | 2.799 | 3.4332 | 0.3335 | 0.3114 | 2.3639 | 2.3557 |

## Linhas para roadmap:measurements

| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |
|---|---|---|---|---|---|---|
| 2026-11-15 | E11 | linha-de-base | planner: 1/1 execuções válidas | US$ 0,81 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | tracker: 1/1 execuções válidas | US$ 0,00 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | plan-only: 5/5 execuções válidas | US$ 8,02 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | coordinator: 5/5 execuções válidas | US$ 0,67 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | completo: 3/3 execuções válidas | US$ 8,91 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | parada-retomada: 3/3 execuções válidas | US$ 10,71 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | plano-nativo-A: 5/5 execuções válidas | US$ 1,64 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | plano-nativo-B: 5/5 execuções válidas | US$ 1,55 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | codigo-nativo-A: 5/5 execuções válidas | US$ 11,91 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | codigo-nativo-B: 5/5 execuções válidas | US$ 12,82 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | detecção plano-semeado: 40 tentativas válidas | US$ 3,19 (custo devolvido pela CLI) | - | concluído |
| 2026-11-15 | E11 | linha-de-base | detecção codigo-semeado: 40 tentativas válidas | US$ 24,72 (custo devolvido pela CLI) | - | concluído |
