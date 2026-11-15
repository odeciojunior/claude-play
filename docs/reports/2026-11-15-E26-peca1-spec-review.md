# E26, peça 1: revisão de spec em laço contra rodada única (DEC-725/726, DEC-731)

Data: 2026-11-15. SHA medido: `e2b7e11` (worktree destacada `D:/claude-tr-release`). Lotes pagos em `claude -p`, sessão em sonnet, `bypassPermissions` só na orquestração da medição (DEC-311/312), `--stop-on-denial`, até US$ 3 por sessão. Relatório do orquestrador.

## O que foi medido

- Estágio `spec-review`, braço `atual`, `--rounds loop`: o laço do produto embutido do workflow (revisor opus/medium, maxFix 2).
- A rodada única sai do mesmo lote, pelo estado após a 1ª correção (DEC-725), com o SHA conferido no git.
- Sementes nativas (DEC-724): spec-nativo-A com SN1 a SN4, spec-nativo-B com SN5 a SN8, 1 defeito acoplado por artefato. 5 execuções por artefato, 40 oportunidades por braço.
- O braço perguntas foi cortado antes do lote (DEC-731): reprovado pela condição 3 de DEC-726, 0 execuções.

## Resultado

| Lote | Válidas | Rodadas | Laço (fim) | Rodada única (após 1ª correção) | Custo da sessão |
|---|---|---|---|---|---|
| Sonda spec-nativo-A | 1/1 | 2 revisões | 4/4 | 4/4 | US$ 0,84 |
| spec-nativo-A | 5/5, 0 negadas | 2 revisões, 1 correção, em todas | 19/20 (SN2 perdido na execução 4) | 19/20 (o mesmo) | US$ 3,74 |
| spec-nativo-B | 5/5, 0 negadas | 2 revisões, 1 correção, em todas | 20/20 | 20/20 | US$ 3,61 |
| **Total dos lotes** | **10/10** | | **39/40** | **39/40** | **US$ 7,35** |

- `afterFirstFixUnverified` 0, `toolCheckFailed` 0, `humanInputsRaised` 0, nenhuma detecção por código.
- O SN2 perdido na execução 4 não foi recuperado pela 2ª revisão do laço: a 2ª rodada saiu limpa em todas as execuções.
- Peça 1 com a sonda: US$ 8,19, dentro do teto de US$ 30 (DEC-728). O braço perguntas cortado não gastou nada.

## Aplicação da regra de DEC-726

1. Determinadas: 40 por braço (≥ 32). Atende.
2. Capturas a menos que o laço: 0 (≤ 5). Atende.
3. Condição 3: **falha** para spec pelo passo 0 (5 casos verdadeiros pós-correção em 16 estágios; 2 em 5 na estrita; `docs/reports/2026-11-14-E26-passo0-registros-revisao.md`).
4. 39/40 nos dois braços também é efeito teto (DEC-705). **Fica o laço atual de spec.** A decisão não dependia do número deste lote.

## Leitura do orquestrador

- Como na peça 2, o revisor pega quase tudo na 1ª rodada e a 2ª revisão não acrescenta captura nestas sementes. A única perda (SN2, 1 em 5) não foi recuperada pelo laço: a 2ª rodada lê o spec já corrigido e não volta a um defeito que a 1ª deixou passar.
- Os casos reais do passo 0 são de outro tipo: 4 de 5 foram criados pela própria correção. Sementes plantadas antes da 1ª revisão não exercitam esse caminho, o que explica o teto nas duas peças. Medir esse caminho pede correção semeada, que é o desenho da peça 3 de E27 B (DEC-729).
- Para a ratificação de E26: rodada única de spec reprovada pela condição 3 (passo 0), com o lote confirmando teto; braço perguntas reprovado por DEC-731; leitura única de plano em teto (peça 2), laço mantido.

## Saídas

- `D:/claude-e26-out/p1-sonda/spec-nativo-A-spec-review-atual-loop-20261115-004218/aggregate.json`
- `D:/claude-e26-out/p1/spec-nativo-A-spec-review-atual-loop-20261115-004404/aggregate.json`
- `D:/claude-e26-out/p1/spec-nativo-B-spec-review-atual-loop-20261115-005126/aggregate.json`
