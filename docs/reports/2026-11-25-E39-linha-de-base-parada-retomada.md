# E39: nova linha de base de parada-retomada

Lote pago da variante parada-retomada do arnês `tools/measure` sobre o productivity-tools 2.5.0 da branch `release/pos-2.3.0`, em config descartável e worktree isolada. Decisões que regem o lote: DEC-053 (uma execução por vez, teto de US$ 15), DEC-054 e DEC-056 (inválidas e correções no produto), DEC-055 (repetição tolerada), DEC-058 (validade da execução 1), DEC-059 (dívida da aspa) e DEC-060 (limites).

## Resumo

- **2 válidas e integradas**, ambas no plugin `c588935`. O AC1 fecha com 2 válidas em vez de 3 (DEC-053, DEC-056).
- **Limites para a 2.6.0 (DEC-060), provisórios com n=2:** opus 5, sonnet 11, ponderado sem haiku 420, iguais aos da DEC-026 do pós-2.2.0. Haiku e o contador por tarefa ficam só como referência.
- **Custo total do E39:** US$ 11,32 de 15, contando duas inválidas (US$ 4,16) e duas válidas (US$ 7,16).
- **Correções extras no produto antes das válidas:** duas, ambas da classe do E41 (um modelo barato recopiando texto longo). Detalhe abaixo.

## Execuções

| # | Saída (`D:/claude-e39-out/`) | Plugin | Situação | haiku | sonnet | opus | ponderado | sem haiku | Custo (US$) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `parada-retomada-20261125-074857` | a113615 | inválida (DEC-054): bloqueio na T2 pelo test-first | 48 | 6 | 4 | 328 | 280 | 2,0856 |
| 2 | `parada-retomada-20261125-083658` | 72eb968 | inválida (DEC-056): bloqueio na T2 pelo test-first | 42 | 6 | 4 | 322 | 280 | 2,0765 |
| 3 | `parada-retomada-20261125-091505` | c588935 | **válida**, merge 755bca1 | 49 | 11 | 5 | 469 | 420 | 3,6906 |
| 4 | `parada-retomada-20261125-093629` | c588935 | **válida**, merge 6152ec2 | 50 | 12 | 5 | 490 | 440 | 3,4732 |

Pesos do ponderado: haiku 1, sonnet 20, opus 40. Custo pelo maior entre `cliCostUsd` e transcrições mais papéis. Nas válidas: `extraRounds` 0, `fixCalls` 0, zero Grep na pasta do plugin, checker do cenário com 0 erros. Contador por tarefa da execução 4: 81.

## Gatilhos e ressalvas das válidas

- **Execução 3, custo com ressalva (DEC-058):** a sessão de parada rodou em opus e a de retomada em sonnet, sem `--model` no arnês e sem registro local de fallback; causa provável, não confirmada, é o padrão da conta. Os contadores estruturais contam só subagentes com modelo explícito no workflow e não mudam; o custo da sessão principal sai subestimado.
- **Execução 3, repetições na retomada:** `spec-load2` porque o script-runner perdeu a aspa final de um caminho ao copiar o comando (dívida da DEC-059) e `plan-load2` por cópia de saída recusada e recuperada. Dois rótulos, no limite da DEC-055.
- **Execução 4, sonnet 12 e 440 sem haiku por gatilho explicado:** duas cópias da fatia 0 da descoberta recusadas em haiku; a terceira tentativa (`discovery-retry3`) sobe para sonnet. Mesmo critério da DEC-026: gatilho explicado não sobe o limite.
- **Execução 4:** rodou com `--model opus` (DEC-058); as duas sessões em opus.

## Correções no produto durante o lote

1. **DEC-054, commit 72eb968:** o `capture.mjs slice` recebe só 12 hex do sha (antes 64, que o haiku emendou ao copiar) e o implementer copia linhas `--brief`, sem o stack trace. Resolveu as repetições por hex; não resolveu o test-first.
2. **DEC-056, commit e536d5d:** o `capture.mjs run` grava a linha assinada de cada execução e o comando `pairs` decide o par vermelho-verde por script quando a cópia do implementer não confere. Nas duas válidas a cópia conferiu e o `pairs` não precisou rodar. O digest das linhas é checksum de cópia, sem segredo, o mesmo nível de confiança do caminho anterior.

Também o prompt da sessão principal do arnês no modo `--stage` (commit 9bfe722), fora do caminho desta variante; o efeito só se mede no próximo lote com `--stage`.

## Comparação com o E31 (pós-2.2.0)

O haiku subiu de 22 a 23 por execução no E31 para 49 a 50, efeito das cargas por script-runner do E41; por isso o haiku fica fora dos limites. Sonnet e opus estruturais ficaram nos limites da DEC-026, com o revisor por tarefa opus do E35 aparecendo no contador por tarefa e nos papéis, não no estrutural.

## Reconferência do E37 (DEC-052, DEC-055)

Zero Grep na pasta do plugin nas quatro execuções depois de 9a16231. As repetições de carga continuam acontecendo por cópia (agora detectadas e recuperadas, contadas pela DEC-055); o erro de comando da execução 3 é a dívida da DEC-059.

## Evidências

Cada pasta de saída das duas válidas tem `aggregate.json`, `private/` com as transcrições copiadas da config descartável e `SHA256SUMS` (167 e 174 arquivos). As linhas do E39 em `docs/plans/roadmap-pos-2-3-0/measurements.md` trazem os mesmos números.
