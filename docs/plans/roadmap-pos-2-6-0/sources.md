# Fontes

<!-- roadmap:sources -->
| ID | Fonte | O que é | Lida em | Confiabilidade |
|---|---|---|---|---|
| SRC-01 | `conversa de 2026-11-25 com o dono` | pedido: roadmap novo a partir do plano de correções, decisões pendentes resolvidas por Fable | 2026-11-25 | primária, dono |
| SRC-02 | `docs/plans/2026-11-25-correcoes-issues-plan.md` | plano de correções validado e revisado por issue (dois subagentes sonnet por issue) | 2026-11-25 | primária, revisada; linhas conferidas no branch release/pos-2.3.0 |
| SRC-03 | `https://github.com/odeciojunior/claude-play/issues (#1 a #29)` | issues abertas com comentários do dono | 2026-11-25 | primária, dono |
| SRC-04 | `CLAUDE.md (raiz do repositório)` | comandos de verificação do repositório e regras de publicação | 2026-11-25 | primária, vigente |
| SRC-05 | `docs/plans/roadmap-pos-2-3-0/decisions.md` | decisões anteriores: trava de tamanho 266.673 (decisão 057 do pós-2.3.0), limites provisórios (decisão 060 do pós-2.3.0), dívidas aceitas | 2026-11-25 | primária, append-only |
| SRC-06 | `docs/reports/2026-11-25-medição 39-linha-de-base-parada-retomada.md` | linha de base de parada-retomada com 2 válidas e US$ 14,65 gastos | 2026-11-25 | primária, medição paga |
<!-- /roadmap:sources -->

## Conflitos

<!-- roadmap:conflicts -->
- SRC-02 vs SRC-05: o plano tratava 266.673 como cifra defasada, mas discovery-slices.test.mjs:122 trava o workflow nesse valor (decisão 057 do pós-2.3.0) -> DEC-007
<!-- /roadmap:conflicts -->
