# E13: independência e medição final (productivity-tools 2.2.0)

Data: 2026-11-15. Decisões: DEC-776 (medição final mínima), DEC-777 (linhas esperadas do comparador, meta de E10, laço quality), DEC-778 (fechamento). Árvore final: release `3ea2649`, `plugins/` `775a600`, por `--plugin-dir` de worktree destacada `D:/claude-e13-release`. Config descartável `D:/claude-e17-cfg`, `bypassPermissions` só na medição, CLI 2.1.325.

## Peça 1: independência

- `plugins/productivity-tools/scripts/independence.test.mjs` ganhou um teste que percorre todo arquivo publicado do plugin (140 arquivos; pula só `*.test.mjs` e uma lista de créditos vazia, DEC-019) e procura `superpowers` sem distinguir maiúsculas. Falhou numa ocorrência (`skills/roadmap-release/references/operator.md:48`, caminho de exemplo), corrigida; 28 testes, 0 falhas. O portão final mutou cópias (agente, workflow, `plugin.json` com CRLF, arquivo binário): todas falham.
- Prova de execução: 1 execução completa com o superpowers desativado na config (`claude plugin disable`), válida.
- Diagramas `docs/diagrams/repo-architecture.{md,excalidraw}` atualizados: 11 skills, 7 agentes, 2 workflows. README e skills já estavam certos.

## Peça 2: medição final

Plano fixo no formato novo: feito em E11 (fixture `plan/1` do coordinator, DEC-747, DEC-759). Detecção: reatribuída de E11 (código 40/40 contra 38/40 de E15; plano 40/40), revisor padrão idêntico (DEC-774). Completo e coordinator: M16 (E16, `2026-11-15-E16-lote-M16.md`), árvore sem diferença no caminho padrão.

parada-retomada (medianas):

| contador | E15 (n=3) | E11 (n=3) | E13 (n=3) |
|---|---|---|---|
| haiku | 9 | 24 | 22 |
| sonnet | 15 | 11 | 11 |
| opus | 9 | 5 | 5 |
| ponderado sem haiku | 660 | 420 | 420 |
| bytes | 178.543 | 185.806 | 169.178 |
| extraRounds / fixCalls | 0 / 0 | 1 / 1 | 1 / 1 |
| turnos do principal | 13 | 16 | 16 |
| custo CLI (US$) | - | 2,26 | 2,26 |

completo sem superpowers (n=1) contra M16 (n=3, tentativas 393/415/393 de ponderado): haiku 16, sonnet 10, opus 5, ponderado 416 (400 sem haiku), bytes 138.820, extraRounds 0, custo US$ 3,35 (mediana M16 3,34). Igual à 2ª tentativa de M16 em sonnet e sem haiku; dentro da faixa de M16; contra E15 (sonnet 11, sem haiku 420) nada sobe.

## Critério 2 (DEC-777, DEC-778)

Contra E15, sonnet, opus e ponderado sem haiku não sobem em nenhuma variante. Linhas "piorou" esperadas: haiku, bytes e `mainBytes` do coordinator (DEC-750, DEC-761, DEC-763, DEC-774) e, como exceção nomeada (DEC-778), extraRounds, fixCalls e turnos do principal de parada-retomada: o salto se reproduziu em E11 e E13 (mediana 1), fora das tarefas e dos portões (`taskFixByTask` vazio, `gateFix` 0); a causa fica para o entregável pós-2.2.0.

## Metas derivadas (critério 7)

| Meta | Alvo | Medido | Situação |
|---|---|---|---|
| E4 prosa do planner | ≤ 43.335 | 43.111 | atingida |
| E22 prosa do tracker | ≤ 29.096 | 26.108 | atingida |
| E23 opus em parada-retomada | 7 | 5 | atingida |
| E23 ponderado em parada-retomada | 589 | 442 (420 sem haiku) | atingida |
| E12 chamadas da sessão principal no coordinator | 0 | 0 | atingida |
| E12 prosa antes do lançamento | ≤ 6.000 | teste `prose-budget` AC4 passa | atingida |
| E10 chamadas totais no completo | ≤ 22 | 27 (13 haiku, 9 sonnet, 5 opus) | não atingida, aceita (DEC-777) |

## Custo

US$ 10,03 (parada-retomada 6,68; completo sem superpowers 3,35), teto US$ 20. Saídas (não commitadas): `D:/claude-e13-out/parada-retomada-20261115-195735`, `D:/claude-e13-out-sem-sp/completo-20261115-204123`.
