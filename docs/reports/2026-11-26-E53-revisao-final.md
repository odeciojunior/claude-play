# E53: revisão final T3 do candidato

- **Candidato:** `d4ac4ee1b1201a8232f7df135f47c5e532bc3892` em `release/pos-2.6.0`.
- **Alvo:** `git diff main...d4ac4ee` (`main` em `fb371ab`).
- **Revisor:** subagente opus, effort high, adversarial e só leitura. Rodada 1 de no máximo 3.
- **Veredito: nenhum bloqueante.**
- **Gates no mesmo candidato:** G1 exit 0, tests 2826, pass 2824, fail 0, skipped 2 (árvore `d9548e3`); G2 58 OK; G3 15 OK; G4 válido; G5 em dia.

## Achados e destino

Nenhum achado foi corrigido no candidato: mudar código aqui criaria candidato novo, com G1 a G5 e revisão de novo. Cada um fica aceito com o motivo abaixo.

| # | Severidade | Onde | Achado | Destino |
|---|---|---|---|---|
| 1 | Importante (operação do lote) | `tools/measure/run-batch.mjs:130`, `tools/measure/lote-gate.mjs:177` | O `run-batch` grava como `plugin.commit` o HEAD do `--plugin-dir`, e o `lote-gate` exige o SHA inteiro do candidato. Um lote lançado a partir do worktree de release, um commit de docs à frente, gastaria a primeira execução e receberia `parar`. | Aceito: o plano do E53 (passos 7 e 8) já roda o lote num worktree destacado exatamente no candidato e confere `rev-parse HEAD` antes de cada execução. |
| 2 | Menor, reproduzido | `tools/measure/lote-gate.mjs:284` | Subpasta de `--out` sem o prefixo `parada-retomada-` é ignorada sem aviso, e o custo dela fica fora do acumulado. | Aceito: só acontece com erro de operação; o lote usa uma pasta de saída nova e vazia. Pendência. |
| 3 | Menor, reproduzido | `tools/measure/lote-gate.mjs:114-122` | Pasta incompleta sem transcrições informa custo zero em vez de desconhecido. | Aceito: o veredito já é `parar`; o delegado confere o gasto no painel da conta. Pendência. |
| 4 | Menor, por leitura | `roadmap-release.js:1849-1866` (`rereadMeasure`) | Recusa determinística numa linha relida gasta as cinco tentativas por portão. | Aceito: custo em caso raro, sem resultado errado. Pendência. |
| 5 | Menor, por leitura | `roadmap-release.js:1879-1883` | Com o alvo igual ao `integrationBranch` sem `allowIntegrationBranch`, a medida antecipada cria o worktree `_integracao` e mede antes de a execução terminar em erro; o worktree que sobra prende a branch. | Aceito: a spec do E49 admite a medida nesse caso e a execução termina em erro; o worktree que sobra não foi previsto. Pendência. |

## Detalhe das confirmações

- Achado 1: leitura das duas linhas e `git log`; `git diff --quiet d4ac4ee HEAD -- plugins tools` não apontou diferença de conteúdo.
- Achado 2: reprodução em pasta temporária devolveu `{"executions":[],"accumulatedUsd":0,"verdict":"pode-seguir","nextMaxBudgetUsd":"3.00"}` com exit 0.
- Achado 3: reprodução devolveu `"costUsd":0` com a razão "custo das transcrições: US$ 0.000000" e veredito `parar`.
- Correções sugeridas pelo revisor: (2) `parar` quando houver em `--out` outra subpasta com `aggregate.json`; (3) custo `null` quando não houver subpasta de transcrições; (4) encerrar as tentativas quando a linha relida falhar só no `cmdDigest` ou no `exit`; (5) desligar a antecipação quando o alvo for o `integrationBranch` sem `allowIntegrationBranch`.

## Hipóteses testadas e descartadas

- `shq` sem aspas (E46): o conjunto aceito é seguro no Git Bash e todos os usos estão no nível de topo do comando. Valores com `$(…)` continuam entre aspas.
- Cache do runtime e retomada: a medida antecipada é a primeira chamada de agente e leva o `runToken`; `parallelOk` sai de `resumeArgs` e `resumeWith`.
- Releitura com linha antiga: os nonces não se repetem dentro da execução.
- Desconto de testes removidos (E47): vale só na retomada `finish-merge` e só para testes apagados; a spec e o plano são lidos do commit de merge. Não se achou caminho que aceite teste apagado sem par verificado.
- `failedNames: null` do extrator (E44) cai no mesmo caminho de antes no coordinator.
- Caminho agy: usa páginas, não fatias, e o campo novo `at` não o afeta.
- Tamanho do workflow: 275.736 bytes em LF, abaixo de 524.288.
- Node 18: o código novo conferido usa só recursos do Node 18.

## Cobertura

- **A fundo:** o diff de `roadmap-release.js` e as interações entre E42, E43, E46, E47, E48 e E49; `test-extract.mjs`; `capture.mjs line`; o diff de `preflight.mjs`; `lote-gate.mjs` contra a DEC-017; custo, transcrições e `SHA256SUMS` do `run-batch.mjs`; `SKILL.md`, `config.md` e `operator.md` contra o comportamento novo.
- **Amostrado:** mudanças do caminho agy, `check-roadmap.mjs`, `lint-plugin`, `wsl-health-check`, `plan-author` e `spec-author`, `coordinator.js` e `.claude/`.
- **Não revisado:** conteúdo dos arquivos de teste; specs e planos além de buscas pontuais; internos do `extract` de `session-metrics.mjs`; paridade dos `arms/*-atual.md`; execução real em Node 18 e em Linux; o comando `wsl` em pwsh 5.1 ou 7.

## Para a publicação (E54)

- O conteúdo de `check-roadmap.mjs` mudou (aviso `status-no-code`) e a linha 1 segue `1.7.0`. Pela DEC-042 do roadmap pós-2.3.0, a versão sobe junto com a do plugin; até lá as cópias vendorizadas não aparecem como desatualizadas.
