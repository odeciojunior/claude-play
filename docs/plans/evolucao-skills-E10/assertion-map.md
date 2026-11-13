# E10: mapa das asserções de flow.test.mjs (R15) e medida de ANTES

Base: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` em 3a1d3de (os arquivos do plugin não mudaram desde então). Linhas abaixo são desse commit.

## Regra (R15)

Isto é uma regra, não uma lista fechada, e o mapa não afirma estar completo. Quem tocar uma asserção que o mapa não cita aplica a mesma regra e a registra aqui.

1. Comportamento de script (o que a descoberta calcula, o que o grupo e o check fazem com git) vai para `preflight.test.mjs` ou `verify-run.test.mjs`.
2. Comportamento do workflow (o que ele faz com a saída do script) fica em `flow.test.mjs`, sobre dados assinados (`canon`/`fnv1a`) ou sobre a carga do grupo decodificada.
3. Nenhuma asserção é apagada nem enfraquecida: cada uma muda de lugar ou de forma. Nenhum teste sai de `flow.test.mjs` para fora do que esta tabela diz; o teste de `truthDivergences` de `merge.test.mjs` fica lá e passa a importar de `verify-run.mjs`.
4. Uma asserção sobre prompt ou schema da descoberta (que deixam de existir) vira asserção sobre o comando `script-runner` montado, sobre a conferência de campos da saída assinada ou, se descrever cálculo, sobre a saída do script.

Levantamento: `git grep -n <padrão> 3a1d3de -- .../flow.test.mjs` para `git-truth`, `S_DISC`, `S_TRUTH`, `S_RECORD`, `calls\[0\]`, `'discovery'`, `'report'`, `pendingDecisionsStdout`, `BASH_ONLY`, `promptCommands`, `statusPrompts`, `roadmap.mjs`. `S_DISC`, `S_TRUTH` e `S_RECORD` não aparecem no arquivo de teste (só no script); as asserções sobre os schemas aparecem por `opts.schema` nas linhas de `calls[0]` e de `git-truth`.

## Verdade do git (`git-truth`, `check`)

| linha | teste | destino |
|---|---|---|
| 193 | mock `exec`: resposta de `git-truth` | `flow.test.mjs`: o mock responde ao `report` com `truthStdout` do `check` assinado (data: alvo, limpo, `ok: true`); a chamada `git-truth` deixa de existir |
| 194 | mock `exec`: resposta de `report` | `flow.test.mjs`: o `report` passa a devolver `{ report, truthStdout }`; o mock se ajusta |
| 274-278 (I6 (a)) | git truth requires lastGoodReachable | duas partes. Script: `lastGood` não ancestral com alvo sujo lista cada divergência em `verify-run.test.mjs` (`E10 AC2: check returns ok on a clean run and lists each divergence`). Workflow: `flow.test.mjs`, `E10 AC2: a confirmed check with a validated-tip divergence becomes a divergence operator action`, mesma asserção `kind === 'divergence'` e `/validated tip/` |
| 368 | git truth schema requires lastGoodReachable | script: o campo de alcance do `lastGood` na saída do `check` em `verify-run.test.mjs`; workflow: o schema do `report` exige `report` e `truthStdout` em `flow.test.mjs` |
| 2268 (PF/M6) | the common briefing drops the delivery-stage and integration-worktree sentences | `flow.test.mjs`: o filtro sai de `git-truth` e confere as três chamadas restantes (`E1:cleanup`, `E1:gates1-1`, `E1:merge`) |
| `merge.test.mjs` 99 | teste de `truthDivergences` por `loadPure()` | continua em `merge.test.mjs`, importando `truthDivergences` de `../scripts/verify-run.mjs`, mesmas asserções |

## Descoberta (`discovery`, `calls[0]`, `pendingDecisionsStdout`)

| linha | teste | destino |
|---|---|---|
| 159 | mock `exec`: resposta de `discovery` | `flow.test.mjs`: `{ exit: 0, stdout }` com a saída `release-discovery` assinada sobre os mesmos dados, com `pendingDecisions: []` (mais `discOver`) |
| 526-528 | hard integrity alerts: `mergeSha` de 40 caracteres (prompt e schema) | script: `mergeSha` de 40 caracteres em `preflight.test.mjs` (AC1) |
| 567 | C1: a run stops at selection when an interrupted merge is outside it | `flow.test.mjs`, rótulos `['discovery']` mantidos sobre dados assinados |
| 602 | I2: discovery returns the raw cell | script: `status` = célula do painel em `preflight.test.mjs`; `flow.test.mjs`: `calls[0]` passa a ser o comando `discover` do `script-runner` e a seleção usa a célula |
| 607-609 | I3: discovery requires the fields whose absence fails open | `flow.test.mjs`: `discovery stops naming each missing field` (os mesmos campos, sobre a saída assinada); campos sempre presentes na saída do script em `preflight.test.mjs` |
| 630 | item 5: discovery without integrationBranch stops the run | `flow.test.mjs`, mesma asserção sobre dados assinados |
| 647 | item 5: each missing discovery field stops the run | `flow.test.mjs`, mesmo laço por campo |
| 653 | item 5: the schema requires the fields | lista de campos exigidos: `flow.test.mjs` (conferência de campos da saída) e `preflight.test.mjs` (campos sempre presentes) |
| 1059-1060 | item 2: the discovery prompt restricts the ancestor rule | script: `onTarget` por segmento `code` integrado e recusa do ramo `<prefixo><id>` como ancestral em `preflight.test.mjs` |
| 2111 | B4/I1: a kill after the merge of E3, then a resume | `flow.test.mjs`, rótulo `discovery` presente; dados assinados |
| 2342-2343 | FF/I4: wtRoot comes from the skill | `flow.test.mjs`: sem pasta de worktree no comando `discover`; script: `data` sem `wtRoot` em `preflight.test.mjs` |
| 2496-2497 | B4: the runToken never comes back in resume args | `flow.test.mjs`: `labels[0] === 'discovery'`; o token `pf-test` está só no comando de `discovery` (como `nonce`), nunca nas outras chamadas |
| 4116-4128 | a pending contract decision read in discovery holds unstarted dependents | `flow.test.mjs`, com `discOver: { pendingDecisions: [...] }` (lista) em vez de `pendingDecisionsStdout`; mesmas quatro asserções de seleção |
| 4132-4139 | discovery requires pendingDecisionsStdout | `flow.test.mjs`: o campo exigido passa a ser `pendingDecisions` em lista (conferência de campo sobre dados assinados); o cálculo da lista em `preflight.test.mjs` (`pendingDecisions` em lista) |

## Registro (`status-<palavra>`, `promptCommands`, `statusPrompts`, `BASH_ONLY`)

O `-read`, o `recordVerdict` e `docs`/`docs-measure` ficam como hoje (corte do dono). Só muda a chamada de escrita `${E}:status-<status>`: passa a carregar o grupo; `promptCommands` e os mocks leem `steps` da carga decodificada.

| linha | teste | destino |
|---|---|---|
| 99 | helper `promptCommands` | `flow.test.mjs`: continua para `docs` e para os prompts do `-read`; para `:status-<palavra>` lê os `steps` da carga decodificada |
| 114 | mock de registro (`makeRecordMock.run`) | `flow.test.mjs`: lê `steps` decodificados e responde com a saída `group` assinada (`results.runs` dos passos confirmados) |
| 3004 | helper `statusPrompts` | `flow.test.mjs`, mesmo filtro por rótulo |
| 3015-3030 (I6 (b)) | AC2 registro de plano e executando pela CLI, comandos `set-status`, `log`, `add-decision`, `add-pending` | `flow.test.mjs`: as mesmas regexes sobre cada passo decodificado de `status-c` e `status-d` |
| 3031 (I6 (f)) | `roadmap-tracker` só como `roadmap.mjs` nos prompts de registro | `flow.test.mjs`: conta `roadmap.mjs` também nos `steps` decodificados |
| 3049 | AC3 add-decision com erro da CLI reprova | `flow.test.mjs`, saída `group` assinada com o passo em `exit` 1 |
| 3060 | AC3 stdout que não é JSON da CLI, ou comando omitido, reprova | `flow.test.mjs`, mesma forma sobre `group`; `stopped` coberto também em `verify-run.test.mjs` (C1) |
| 3075-3078 | o veredito ignora statusWritten e details do agente | `flow.test.mjs`, `group` assinada com campos extras |
| 3091 | textos longos não viram concern | `flow.test.mjs`, passos decodificados |
| 3127-3135 | BASH_ONLY literal em todo prompt de registro e de releitura; a descoberta não exige o tracker | `flow.test.mjs`: `statusPrompts` do registro (agora `script-runner`) e do `-read` continuam com a cláusula; a descoberta (`script-runner`) também; `!('trackerAvailable' in schema)` vira ausência de `trackerAvailable` no comando |
| 3184, 3189, 3221, 3226, 3193 | AC2/AC3 documentação pela CLI | sem mudança (docs fora do escopo) |
| 3234-3235, 3243, 3252, 3257, 3263 | checker só de brief; forma das chamadas de script; BASH_ONLY em docs e docs-measure | sem mudança de lugar; a conferência dos rótulos `discovery` e `status-*` ajusta-se ao novo agente. `WORKFLOW_SCRIPTS` inclui `roadmap.mjs`, `preflight.mjs`, `verify-run.mjs` |
| 3824 | a reused native spec calls no author and records no duplicate decision | `flow.test.mjs`, `promptCommands` sobre os `steps` decodificados de `status-c` |
| 2772-2773, 2793, 2914, 2986 | `cliCmd`, `phrases`, `recordVerdict` | sem mudança (`recordVerdict` não muda) |
| 3289, 3440-3442, 3769 | CLI real do tracker, `pluginRootOf`, `trackerCli` fora do layout | sem mudança |

## Relatório

| linha | teste | destino |
|---|---|---|
| 707, 717, 966, 994-996, 1339-2681 (laço de `calls.find(label === 'report')`), 3144, 3243 | prompts e resultado do `report` | `flow.test.mjs`, sem apagar: o prompt do relatório ganha o comando `check` como primeiro passo; as asserções sobre o texto de `item`/`reviewed`/`status` seguem iguais; o schema passa a `{ report, truthStdout }` |
| 2311 | MECH: lista de rótulos mecânicos | `flow.test.mjs`: mantém `report`; `git-truth` não consta (nunca constou) |

## ANTES

Caso temporário (nunca commitado, R17), acrescentado a `flow.test.mjs` e desfeito por `git checkout -- <flow.test.mjs>`: o roteiro do caminho sem falhas da linha 209, `exec({ cards: [card('E1')], deliverables: ['E1'] })`, imprimindo `calls.length` e os rótulos. Comando: `node --test --test-name-pattern="TEMP ANTES" plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

**ANTES = 39 chamadas** (um entregável, uma tarefa, sem falhas), nesta ordem:

`discovery, preflight, E1:setup, E1:spec, E1:spec-load1, E1:spec-commit, E1:spec-review1, E1:plan, E1:plan-load1, E1:plan-commit, E1:plan-review1, E1:status-d, E1:status-d-read, E1:progress, E1:t1:impl, E1:t1:spec1, E1:t1:quality1, E1:sync, E1:test-integrity, E1:final-1-r1, E1:review-log, E1:gates1-1, E1:gates1-2, E1:evidence1, E1:pre-merge, E1:resync, E1:delta-review1, E1:review-log-resync, E1:regates1-1, E1:regates1-2, E1:evidence2, E1:merge, E1:merge-gates1-1, E1:merge-gates1-2, E1:docs1, E1:docs-measure1, E1:cleanup, git-truth, report`

O critério 3 pede `ANTES - 1` = 38 chamadas, sem `git-truth`.
