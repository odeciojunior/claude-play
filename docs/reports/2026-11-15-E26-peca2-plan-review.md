# E26, peça 2: revisão de plano em laço contra leitura única (DEC-725/726)

Data: 2026-11-15. SHA medido: `e2b7e11` (worktree destacada `D:/claude-tr-release`, arnês e plugin do mesmo commit). Lotes pagos em `claude -p`, sessão em sonnet, `bypassPermissions` só na orquestração da medição (DEC-311/312), `--stop-on-denial`, até US$ 3 por sessão. Relatório do orquestrador.

## O que foi medido

- Estágio `plan-review`, braço `atual`, `--rounds loop`: o laço do produto (`runReviewLoop` embutido do bloco `<pure>` do workflow, maxFix 2).
- O braço de leitura única sai do mesmo lote, pelo estado após a 1ª correção (DEC-725): o SHA dessa correção é conferido no git e as capturas são lidas ali.
- Sementes nativas da 2ª sonda de E8 (`tools/measure/scenario/e5-native/`, plano `6d486e52...`): plano-nativo-A com P1, P2, P4, P9; plano-nativo-B com P5, P6, P8, P10. 4 defeitos por artefato, 5 execuções por artefato, 40 oportunidades por braço (DEC-725).

## Resultado

| Lote | Válidas | Rodadas | Laço (fim) | Leitura única (após 1ª correção) | Custo da sessão |
|---|---|---|---|---|---|
| plano-nativo-A | 5/5, 0 negadas | 2 revisões, 1 correção, em todas | 20/20 | 20/20 | US$ 3,66 (0,64 a 0,84) |
| plano-nativo-B | 5/5, 0 negadas | 2 revisões, 1 correção, em todas | 20/20 | 20/20 | US$ 3,38 (0,67 a 0,69) |
| **Total** | **10/10** | | **40/40** | **40/40** | **US$ 7,04** |

- `afterFirstFixUnverified` 0 nos dois lotes: o SHA após a 1ª correção foi conferido em todas as execuções.
- `toolCheckFailed` 0, `humanInputsRaised` 0, nenhuma detecção por código. Todos os defeitos foram pegos pelo revisor na 1ª rodada; a 2ª revisão saiu limpa em todas.
- Peça 2 inteira, com as duas sondas (US$ 0,91 e US$ 0,76): US$ 8,71, dentro do teto de US$ 15 (DEC-728).

## Aplicação da regra de DEC-726

1. Determinadas: 40 por braço (≥ 32). Atende.
2. Capturas a menos que o laço: 0 (≤ 5). Atende.
3. Condição 3 (passo 0): plano elegível pela contagem inclusiva, 12 estágios e 0 casos (`docs/reports/2026-11-14-E26-passo0-registros-revisao.md`).
4. Mas 40/40 nos dois braços é **efeito teto**, e DEC-726 descarta explicitamente tratar 38/40 nos dois braços como equivalência (DEC-705). **Fica o laço atual de plano.**

## Leitura do orquestrador

- As sementes nativas são fáceis demais para o revisor de plano: ele pegou todas na 1ª rodada, e por isso o estado após a 1ª correção é igual ao do fim do laço. A medição não separa os braços; ela não mostra que a leitura única é tão boa quanto o laço, só que nestas sementes as duas dão o máximo.
- O que o lote mostra sobre o custo: o laço gastou exatamente uma revisão extra (limpa) por execução. Essa revisão é o custo que a leitura única economizaria; não foi isolado por papel neste relatório.
- O passo 0 achou 0 casos reais de captura pós-correção em plano, e nenhum estágio de plano chegou a 3 rodadas. Junto com este lote, a leitura única de plano continua candidata, mas só uma medição com defeitos que sobrevivam à 1ª rodada (ou introduzidos pela correção) pode decidir. Isso fica para a ratificação de E26, sem lote novo nesta peça (DEC-725 fixa n antes e veda extensão).

## Saídas

- `D:/claude-e26-out/p2/plano-nativo-A-plan-review-atual-loop-20261115-002700/aggregate.json`
- `D:/claude-e26-out/p2/plano-nativo-B-plan-review-atual-loop-20261115-003400/aggregate.json`

As pastas ficam fora do repositório (saídas de medição não são commitadas).
