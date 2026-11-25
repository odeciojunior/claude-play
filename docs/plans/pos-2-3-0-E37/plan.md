# Plano E37 -- Cargas e commits conferidos contra a fonte

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E37/spec.md`.

**Branch:** `release/pos-2.3.0` (HEAD `1a1df35` na escrita), um commit por tarefa (`type(scope): descrição`), sem bump de versão (DEC-042).

O plano segue a ordem pedida: primeiro os scripts (`plan-tool.mjs`, `verify-run.mjs`) e os dois agentes autores, que não mexem no workflow; depois seis tarefas sequenciais sobre `roadmap-release.js` (todas no mesmo arquivo, por isso encadeadas por `deps`, nunca em onda paralela); por fim a conferência final e a sonda paga como tarefa externa manual da sessão principal, sem implementer. Toda tarefa tem no máximo 4 arquivos. Nada em `plugins/productivity-tools/lib/` muda; se alguma tarefa precisar, ela roda `embed.mjs --check` nos 4 alvos.

Orçamento (R12, DEC-050): `roadmap-release.js` mede 263.648 caracteres LF em `1a1df35` e pode chegar a 265.673. A primeira tarefa que mexe nele (T4) atualiza a trava de `discovery-slices.test.mjs` de 263.673 para 265.673, com nome e mensagem citando E37 e DEC-050. Cada tarefa do workflow declara, no passo de medida, o tamanho medido depois dela (`node -e` contando `\r\n` para `\n`, ou `size.test.mjs`), comentários de até 60 caracteres e no máximo uma linha por peça; se apertar, corta-se texto, nunca conferência.

## Cobertura dos critérios

| Critério | Tarefas | Evidência |
|---|---|---|
| AC1 (testes sem pulo indevido: plano congelado sem `--spec`, spec commitada pelo autor, S3-28, S3-29, S3-30, S2-13, S2-08) | T1 (`--no-spec`), T2 (`buildRead` e contrato de `roadmap.mjs`), T3 (agentes), T4 (B06 no fluxo e trava), T5 (B08), T6 (S3-28 e S2-13 parte 1), T7 (S3-29), T8 (S3-30), T9 (S2-08 no fluxo), T10 (conferência) | `flow.test.mjs`, `plan-tool.test.mjs`, `roadmap.test.mjs` |
| AC2 (sonda paga plan-only, `verify: human`) | T11 (externa manual), conferência do dono (H1) | linha `run` do E37 em `measurements.md` |

Casos de borda: C1 em T1 e T4; C2 e C3 em T5; C4 em T8; C5 em T9. Efeitos externos X1 e X2 na T11.

## Contexto lido

- `roadmap-release.js` (263.648 caracteres LF em `1a1df35`): bloco `// <pure>` das l. 51-1569 com `skipReview` (l. 1114) e `recordCmd` (l. 1119); `BASH_ONLY` (l. 1728); `runPrompt` e `readSlices` (l. ~1731-1776, com o corte `CMD_CAP` na releitura, l. 1775); `const CMD_CAP = 6000` (l. 2051, fora da área pura); `specLoadOnce` (l. 2503); `planLoadOnce` (l. 2627) e `loadPlan` (l. 2630).
- `plan-tool.mjs`: `USAGE` (l. 701) e `main` (l. 703), que trata `--spec` igual nos cinco subcomandos; `checkPlan` cai em `data.spec` quando falta `--spec`.
- `discovery-slices.test.mjs`: trava de tamanho nas l. ~117-121 ("roadmap-release.js stays within the E36 size budget...", 263.673) e o teste "a refusal of the script and an envelope of another command are named", que já exige a mensagem "discovery failed: slice 0: release-discovery refused: ...".
- `verify-run.mjs` (`cliJson`, `buildRead`) e seu teste; `roadmap.mjs` (recusa `deliverable-unknown`, só ganha teste).

## Tarefas

### Tarefa 1: Flag --no-spec em plan-tool.mjs

Arquivos: modificar `plugins/productivity-tools/scripts/plan-tool.mjs`; teste em `plugins/productivity-tools/scripts/plan-tool.test.mjs`.

Passos:

1. Teste primeiro em `plan-tool.test.mjs`: plano cujo `data.spec` aponta para spec ausente e, noutro caso, para spec inválida passa em `check --no-spec` e em `emit --no-spec` (exit 0, sem `spec-invalid`, `spec: null`) e reprova sem a flag como hoje; `map`, `brief` e `summary` aceitam a flag; `--no-spec --spec x` sai 2 com `USAGE`; sem nenhuma das duas flags o comportamento atual fica (o plan-coordinator depende dele).
2. Implementar: `main` aceita `--no-spec` nos cinco subcomandos e passa `noSpec: true` a `checkPlan` (e por ela a `emitPlan`); com `noSpec`, `checkPlan` não resolve `specPath` nem `data.spec`, não lê arquivo e devolve `spec: null`, de modo que o bloco que cruza evidência com a spec não roda; `--no-spec` junto com `--spec` é erro de uso (exit 2); `USAGE` cita a flag.
3. Rodar `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs plugins/productivity-tools/scripts/independence.test.mjs` e `embed.mjs --check` nos 4 alvos (o `workflow-copy.js` das fixtures não pode divergir); commit `feat(productivity-tools): E37 T1 flag --no-spec em plan-tool`.

### Tarefa 2: Status recusado em buildRead e contrato de roadmap.mjs

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`; testes em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`.

Passos:

1. Teste primeiro. Em `roadmap.test.mjs` (só contrato, `roadmap.mjs` não muda): `status --deliverable E99` sai com JSON de `tool` "roadmap", `summary.exitCode` 1, `errors[0].code` "deliverable-unknown" e sem `result.panel`. Em `verify-run.test.mjs`: `buildRead` com status recusado (exit 1, JSON da CLI) devolve `status` igual a `{ tool, summary, errors: [{ code }], result: {} }` com até 3 códigos de até 40 caracteres cada; `brief` e `pending-decisions` recusados seguem `null`; o corte final de orçamento tolera `result` vazio.
2. Implementar em `verify-run.mjs`: só para o status, `buildRead` aceita o JSON da CLI (`tool` "roadmap") com exit diferente de 0 e emite o objeto acima; `cliJson` fica como está para os outros dois comandos; o corte que lê `st.result.panel` tolera `result` vazio.
3. Rodar `node --test` nos dois arquivos de teste e em `plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs`; commit `fix(productivity-tools): E37 T2 buildRead leva o código da recusa do status`.

### Tarefa 3: Regras de uma linha em spec-author e plan-author

Arquivos: modificar `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`; teste em `plugins/productivity-tools/scripts/agent-contracts.test.mjs`.

Passos:

1. Teste primeiro em `agent-contracts.test.mjs`: os dois agentes têm a regra de não ler nem dar Grep no código das ferramentas do plugin (`spec-tool.mjs`, `plan-tool.mjs` e o resto de `scripts/`), usando só seus comandos e saídas, e a regra de editar só com Edit ou Write, nunca com `sed -i`.
2. Acrescentar duas regras de uma linha em cada agente (R9). Nenhum caractere a mais no workflow.
3. Rodar `node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs`, o lint do plugin (`node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`) e `claude plugin validate plugins/productivity-tools`; commit `docs(productivity-tools): E37 T3 spec-author e plan-author sem Grep nas ferramentas e sem sed -i`.

### Tarefa 4: Carga do plano congelado com --no-spec (B06) e trava de tamanho

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; testes em `plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro. Em `flow.test.mjs`, no caminho congelado (`frozen`) o comando da 1ª carga do plano (`plan-load0`) leva `--no-spec` e as demais cargas levam `--spec`. Em `discovery-slices.test.mjs`, a trava de tamanho passa a 265.673, com nome "roadmap-release.js stays within the E37 size budget (E37 spec R12, DEC-050: 263673 + 2000), measured in LF characters" e a mensagem citando E37.
2. Implementar em `planLoadOnce`: passar `['--no-spec']` no lugar de `--spec` quando `useSpec` é falso (uma só mudança de expressão, sem comentário novo além de uma linha de até 60 caracteres).
3. Medir `roadmap-release.js` em LF e declarar o tamanho depois da T4 na mensagem do commit; rodar `size.test.mjs` e `discovery-slices.test.mjs`.
4. Commit `fix(productivity-tools): E37 T4 plano congelado carregado com --no-spec e trava de 265.673`.

### Tarefa 5: Pulo da revisão da spec por blob (B08)

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs`: (a) spec nativa, `notes[E1]` presente, registro com `recorded.spec.spec` igual ao blob do setup e autor que commita uma spec alterada (blob da carga diferente, commit do workflow vazio, mesmo `HEAD`): `E1:spec-review1` roda e não há concern "spec review skipped"; (b) com o blob da carga igual ao registro, a revisão é pulada como hoje; (c) spec nativa herdada do alvo, `notes[E1]` presente, `run.json` sem `recorded.spec`, autor sem mudança: a revisão roda e não há falha "fewer commits than expected" (C3); (d) spec ainda não commitada na carga (`rev-parse` sai 128): blob vazio, sem falha de carga, revisão roda (C2). Ajustar os fixtures que respondem às cargas da spec, que agora têm o rótulo `spec-load<k>-blob`.
2. Implementar: `specLoadOnce` ganha `['blob', ...gitIn('rev-parse', 'HEAD:' + AP.spec)]` antes dos `gitCmds`, como `planLoadOnce`; `loadSpec` passa adiante `blob` só quando casa com `^[0-9a-f]{40,64}$`; `specReused` fica exatamente como está; o portão do pulo vira `skipRev('spec', specReused && <blob não vazio> && <blob> === K0.recorded.spec.spec && !specLoad.checkFailed)`.
3. Registrar no commit que a carga extra soma uma chamada haiku por carga de spec e muda a contagem que o E39 mede. Medir o tamanho depois da T5 e declarar.
4. Rodar `node --test` em `flow.test.mjs`, `review.test.mjs`, `integrity.test.mjs` e `size.test.mjs` (todos no diretório do workflow); commit `fix(productivity-tools): E37 T5 pulo da revisao da spec so com o blob conferido`.

### Tarefa 6: Variante de BASH_ONLY em runPrompt e frase de um comando por chamada

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs`: o teste "BASH_ONLY literal em todo prompt de registro e de releitura" passa a exigir a variante, terminada em "Without the Bash tool, run nothing and return exit -1 with an empty stdout.", nos prompts de `runPrompt` (registro, releitura, descoberta, cargas) e a ausência de `no-bash` neles; "BASH_ONLY literal em docs e docs-measure" segue igual; a frase "One command per call; never append `; echo exit=$?`." aparece em `E1:spec-commit`, `E1:plan-commit`, `E1:progress` e `E1:status-*`. Ajustar as asserções literais afetadas na mesma tarefa.
2. Implementar: uma constante derivada de `BASH_ONLY` trocando a frase final; `runPrompt` passa a usá-la (com a frase curta do R8 na variante de shell); a mesma frase curta entra no prompt de `commitAgent` e no prompt `progress`. `BASH_ONLY` inteiro continua nos prompts com lista de `runs` (docs, docs-measure, relatório). Não tocar em `specRules`, `planRules`, `R_NOCOMMIT` nem nos prompts de revisão (R16).
3. Medir e declarar o tamanho; rodar `node --test` em `flow.test.mjs`, `prompts.test.mjs`, `size.test.mjs` e `tools/measure/checkpoint.test.mjs` (paridade dos braços; se algum "arms match the workflow at HEAD" falhar, atualizar o braço byte a byte nesta tarefa).
4. Commit `fix(productivity-tools): E37 T6 runPrompt sem no-bash e um comando por chamada`.

### Tarefa 7: Parada na 1ª recusa em readSlices (S3-29)

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; testes em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs`: a descoberta recusada gera uma só chamada `discovery` e o erro "discovery failed: slice 0: release-discovery refused: ..."; uma recusa numa fatia de carga não gera `-retry2`; uma recusa de `verify-run` na releitura `E1:status-<status>-read` não gera `-retry2` e o registro falha com "null re-read agent"; recusa de outro `tool` segue como cópia errada e repete. Em `discovery-slices.test.mjs`, o teste de recusa existente continua passando e ganha a asserção de uma só chamada.
2. Implementar em `readSlices`, dentro de `one`: saída JSON com `tool` igual ao esperado e `error` definido devolve na hora `{ why: 'slice <k>: <tool> refused: <error>' }`, sem `-retryN` e sem a rodada `-redo`, como o precedente de `removedFloor`.
3. Medir e declarar o tamanho; rodar `node --test` em `flow.test.mjs`, `discovery-slices.test.mjs`, `load-slices.test.mjs` e `size.test.mjs`.
4. Commit `fix(productivity-tools): E37 T7 readSlices para na primeira recusa do script`.

### Tarefa 8: Guarda de tamanho do approve em recordCmd (S3-30)

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs`: baseline vermelha grande (gate `tests` com centenas de falhas nomeadas) dá comando de approve sem `prep` com até 6.000 caracteres e a concern presente uma vez; com `recAt` chamado em spec, plano e final na mesma execução, todos os approve saem sem `prep` e a concern aparece uma só vez (C4); baseline pequena mantém `prep` sem concern; "E23: recordCmd builds the approve command" segue verde.
2. Implementar: mover `const CMD_CAP = 6000` para a área pura, antes de `recordCmd`, e apagar a declaração da l. 2051, sem duplicar o número; `recordCmd` monta o comando e, se passar de `CMD_CAP` e o payload tiver `prep`, monta de novo sem `prep` e chama o callback opcional (8º parâmetro); `recAt` passa o callback, que acrescenta uma vez a `out.concerns` a linha "run record: prep left out of run.json, the approve command had N characters, above CMD_CAP; the next run measures the baseline again" (texto curto). Confirmar que `loadPure` enxerga a constante.
3. Medir e declarar o tamanho; rodar `node --test` em `flow.test.mjs`, `merge.test.mjs`, `gates.test.mjs` e `size.test.mjs`.
4. Commit `fix(productivity-tools): E37 T8 approve do run-record sem prep acima de CMD_CAP`.

### Tarefa 9: Código da recusa do status em recordVerdict (S2-08)

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs`: `recordVerdict` com a releitura de status recusada (`summary.exitCode` 1, `errors: [{ code: 'deliverable-unknown' }]`, `result: {}`) falha com "reread status --json refused: deliverable-unknown"; sem `errors`, com só `summary.exitCode` 1, a falha é "reread status --json refused" sem código (C5); status que não é JSON com `read.exits.status` diferente de 0 dá a mesma falha nomeada; "is missing or has no panel" só quando o status falta de fato; a etapa docs passa `exits: meas.exits` a `recordVerdict` e tolera status sem `panel`.
2. Implementar em `recordVerdict` e na chamada da etapa docs (l. ~2309-2313): a ramificação da recusa descrita no R10 e `exits: meas.exits`.
3. Medir e declarar o tamanho final do workflow (até 265.673); rodar `node --test` em `flow.test.mjs`, `discovery-slices.test.mjs` e `size.test.mjs`.
4. Commit `fix(productivity-tools): E37 T9 recordVerdict cita a recusa do status relido`.

### Tarefa 10: Conferência final

Arquivos: nenhum.

Passos:

1. Rodar a suíte completa `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (linha de base de cerca de 2.580 testes, 0 falhas, 2 pulados; leva cerca de 15 minutos) e comparar os totais.
2. Rodar `embed.mjs --check` nos 4 alvos, o lint do plugin e `claude plugin validate plugins/productivity-tools`.
3. Medir `roadmap-release.js` em LF (até 265.673) e conferir `git diff --stat 1a1df35 -- plugins/productivity-tools/lib` vazio. Sem commit.

### Tarefa 11: Sonda paga plan-only (externa, manual, sessão principal)

Arquivos: nenhum. Não é tarefa para implementer: a sessão principal executa depois da T10 verde, com a autorização do dono dada pela DEC-051 (`.claude/rules/measure.md`).

Passos:

1. X1: atualizar a worktree `D:/claude-pos23-release` (hoje em `6abab96`) para a ponta de `release/pos-2.3.0` com o E37.
2. X2: com `CLAUDE_CONFIG_DIR=D:/claude-pos23-cfg` e `DISABLE_AUTOUPDATER=1`, rodar uma vez `node tools/measure/run-batch.mjs --variant plan-only --runs 1 --max-budget-usd 3.6 --config-dir D:/claude-pos23-cfg --plugin-dir D:/claude-pos23-release/plugins/productivity-tools --permission-mode bypassPermissions --model sonnet --work <work> --out <out>`, com `<work>` e `<out>` fora do repositório. Nunca com `--work` ou `--out` dentro dele, nunca duas vezes (R13: falha de infra só tem nova tentativa com gasto acumulado até US$ 0,14).
3. Conferir o critério de R13 (1 válida, stop nulo, E1 com plano commitado; nenhum rótulo `spec-load2+`, `plan-load2+`, `-retryN`, `-redo`, `spec-commit2` ou `plan-commit2`; pending vazio; nenhum "integrity digest not confirmed"; zero `; echo exit=`, `sed -i` e Grep na pasta do plugin nas transcrições) e registrar uma linha `run` do E37 em `docs/plans/roadmap-pos-2-3-0/measurements.md` (SHA do plugin, pasta de saída, contagem de rótulos de repetição, veredito, `counters.session.cliCostUsd`, e a nota de que a carga de blob da spec muda a contagem do E39). O registro é feito pela sessão principal, fora desta tarefa de código. A conferência da linha é do dono (H1). Repetição por erro de transcrição reprova o AC2 e volta via Fable.

```json data
{
  "schema": "plan/1",
  "id": "E37",
  "title": "Cargas e commits conferidos contra a fonte",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Orçamento de roadmap-release.js: até 265.673 caracteres LF (R12, DEC-050; 263.648 medidos em 1a1df35); a T4, primeira tarefa que mexe no arquivo, atualiza a trava de discovery-slices.test.mjs de 263.673 para 265.673 com nome e mensagem citando E37 e DEC-050; cada tarefa do workflow declara o tamanho medido; comentários de até 60 caracteres e no máximo uma linha por peça; se apertar, corta-se texto, nunca conferência.",
    "As tarefas T4 a T9 mexem todas em roadmap-release.js e por isso são encadeadas por deps (T4, T5, T6, T7, T8, T9), nunca em onda paralela.",
    "Nenhuma edição em plugins/productivity-tools/lib/; se uma tarefa precisar, roda node plugins/productivity-tools/scripts/embed.mjs --check nos 4 alvos (check-roadmap.mjs, roadmap-release.js, coordinator.js, fixtures/plan-tool/workflow-copy.js).",
    "Não mudar o fallback de plan-tool.mjs sem flag (o plan-coordinator depende dele).",
    "Não editar specRules, planRules, R_NOCOMMIT nem os prompts de revisão e correção que os braços tools/measure/arms/*-atual.md copiam (R16); tools/measure/checkpoint.test.mjs confirma a paridade e, se falhar, o braço é atualizado byte a byte na mesma tarefa.",
    "Nenhuma mudança de código em roadmap-tracker/scripts/roadmap.mjs: só ganha teste de contrato (R10, R15).",
    "Fora do escopo (R15): B07, S3-27, parte 4 da S2-13 e o --deliverable da S2-08, S2-01, B17 e B19 a B24, bump de versão (E40, DEC-042), arquivos do E36, segunda sonda ou sonda em acceptEdits.",
    "A sonda paga não roda dentro de tarefa automática: é a T11 externa manual da sessão principal, depois da T10 verde, com --work e --out fora do repositório (R13, R14).",
    "Tarefas com no máximo 4 arquivos em files (pedido do dono); tarefa maior é dividida.",
    "Commits na branch release/pos-2.3.0, um por tarefa, no formato type(scope): descrição; sem bump de versão (DEC-042).",
    "Comando da suíte completa: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\" (linha de base de cerca de 2.580 testes, 0 falhas, 2 pulados).",
    "Nenhum segredo: a sonda usa a config descartável D:/claude-pos23-cfg já existente; nenhum valor de credencial entra em arquivo."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Flag --no-spec em plan-tool.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/plan-tool.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/plan-tool.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "plan-tool.mjs: --no-spec em check, emit, map, brief e summary (noSpec: true em checkPlan; spec null, sem ler spec; --no-spec com --spec sai 2)"
      ],
      "consumes": [],
      "covers": ["AC1", "C1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/plan-tool.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0 com check e emit --no-spec passando sobre spec ausente ou inválida, reprovando sem a flag, e --no-spec com --spec saindo 2"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0, embutidos em dia"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Status recusado em buildRead e contrato de roadmap.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs",
          "plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "verify-run.mjs: buildRead aceita, só para o status, o JSON da CLI (tool roadmap) com exit diferente de 0 e emite { tool, summary, errors: [{ code }], result: {} } com até 3 códigos de até 40 caracteres; brief e pending-decisions seguem null na recusa"
      ],
      "consumes": [],
      "covers": ["AC1", "C5"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
          "expect": "exit 0 com o status recusado levando o código e result vazio, brief recusado null e o contrato de deliverable-unknown"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Regras de uma linha em spec-author e plan-author",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/spec-author.md",
          "plugins/productivity-tools/agents/plan-author.md"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agent-contracts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 1, "verifiability": 0 },
      "produces": [
        "Duas regras de uma linha em cada agente autor: sem ler nem dar Grep no código das ferramentas do plugin (usar só comandos e saídas), e editar só com Edit ou Write, nunca com sed -i"
      ],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs",
          "expect": "exit 0, inclusive os testes que também leem os dois agentes"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0 sem erro"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0, plugin válido"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Carga do plano congelado com --no-spec (B06) e trava de tamanho",
      "deps": [1],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: planLoadOnce passa --no-spec quando useSpec é falso; trava de tamanho de discovery-slices.test.mjs em 265.673 (E37, DEC-050)"
      ],
      "consumes": [
        { "task": 1, "sig": "plan-tool.mjs: --no-spec em check, emit, map, brief e summary (noSpec: true em checkPlan; spec null, sem ler spec; --no-spec com --spec sai 2)" }
      ],
      "covers": ["AC1", "C1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0, 1ª carga do plano congelado com --no-spec, demais com --spec, trava em 265.673 e tamanho medido declarado"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Pulo da revisão da spec por blob (B08)",
      "deps": [4],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: specLoadOnce mede o blob HEAD:<spec> (comando blob); loadSpec repassa blob só quando casa com ^[0-9a-f]{40,64}$; skipRev('spec', ...) exige blob não vazio igual a K0.recorded.spec.spec; specReused inalterado"
      ],
      "consumes": [],
      "covers": ["AC1", "C2", "C3"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/integrity.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com a revisão rodando sobre spec commitada pelo autor, pulando com blob igual ao registro e sem falha de commits no caso C3"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Variante de BASH_ONLY em runPrompt e frase de um comando por chamada",
      "deps": [5],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: constante derivada de BASH_ONLY terminada em 'Without the Bash tool, run nothing and return exit -1 with an empty stdout.' usada por runPrompt; frase 'One command per call; never append `; echo exit=$?`.' em runPrompt, commitAgent e progress"
      ],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com a variante nos prompts de runPrompt, BASH_ONLY inteiro em docs e docs-measure e a frase curta nos prompts de commit, progress e status"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs",
          "expect": "exit 0, braços em paridade com o workflow (R16)"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "Parada na 1ª recusa em readSlices (S3-29)",
      "deps": [6],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: readSlices devolve { why: 'slice <k>: <tool> refused: <error>' } na 1ª saída JSON com o tool esperado e error definido, sem -retryN nem -redo, na descoberta, nas fatias de carga e na releitura"
      ],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com uma só chamada por recusa nos três usos e a cópia errada de outro tool ainda repetida"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Guarda de tamanho do approve em recordCmd (S3-30)",
      "deps": [7],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: CMD_CAP na área pura (declaração única); recordCmd remonta o approve sem prep acima de CMD_CAP e chama um callback opcional (8º parâmetro); recAt acrescenta uma vez a out.concerns a linha nomeada"
      ],
      "consumes": [],
      "covers": ["AC1", "C4"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com approve sem prep em até 6.000 caracteres, concern uma só vez e baseline pequena mantendo prep"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "Código da recusa do status em recordVerdict (S2-08)",
      "deps": [2, 8],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 0 },
      "produces": [
        "roadmap-release.js: recordVerdict falha com 'reread status --json refused: <código>' (sem código sem errors) quando o status relido tem summary.exitCode diferente de 0, errors não vazio, ou não é JSON com read.exits.status diferente de 0; a etapa docs repassa exits: meas.exits"
      ],
      "consumes": [
        { "task": 2, "sig": "verify-run.mjs: buildRead aceita, só para o status, o JSON da CLI (tool roadmap) com exit diferente de 0 e emite { tool, summary, errors: [{ code }], result: {} } com até 3 códigos de até 40 caracteres; brief e pending-decisions seguem null na recusa" }
      ],
      "covers": ["AC1", "C5"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com a recusa citando deliverable-unknown, o caso sem código e roadmap-release.js em até 265.673 caracteres LF"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 10,
      "title": "Conferência final",
      "deps": [3, 9],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": { "exempt": "Tarefa de conferência: só roda a suíte, o lint e as medidas de tamanho; não muda arquivo." },
      "checks": [
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0, 0 falhas, total não menor que a linha de base de cerca de 2.580 testes mais os novos"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0 sem erro"
        },
        {
          "cmd": "git diff --stat 1a1df35 -- plugins/productivity-tools/lib",
          "expect": "saída vazia: nada em lib/ mudou"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    },
    {
      "n": 11,
      "title": "Sonda paga plan-only (externa, manual, sessão principal)",
      "deps": [10],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 2 },
      "produces": [],
      "consumes": [],
      "covers": ["AC2", "X1", "X2"],
      "testFirst": { "exempt": "Tarefa externa manual da sessão principal: executa uma sonda paga e não escreve código nem teste." },
      "checks": [
        {
          "cmd": "node tools/measure/run-batch.mjs --variant plan-only --runs 1 --max-budget-usd 3.6 --config-dir D:/claude-pos23-cfg --plugin-dir D:/claude-pos23-release/plugins/productivity-tools --permission-mode bypassPermissions --model sonnet --work <work> --out <out>",
          "expect": "1 execução válida, stop nulo, E1 com plano commitado e nenhum rótulo de repetição (critério de R13); gasto até US$ 3,60 registrado em measurements.md pela sessão principal"
        }
      ],
      "locks": [],
      "external": true,
      "externalDedupe": "Uma só execução paga (R13): antes de rodar, conferir em measurements.md e na pasta --out fora do repositório que não existe linha run do E37; nova tentativa só por falha de infra, com gasto acumulado até US$ 0,14.",
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "human",
      "command": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como ordenar as tarefas que mexem em roadmap-release.js?",
      "decision": "T4 a T9 são seis tarefas em cadeia por deps (uma peça por tarefa, um commit cada); a T4 vem primeiro porque atualiza a trava de tamanho; T1 (plan-tool) e T2 (verify-run) vêm antes das peças do workflow que dependem delas (T4 e T9); T3 (agentes) não toca o workflow.",
      "basis": "Pedido do dono: tarefas de até 4 arquivos e serialização das que mexem no mesmo arquivo para não conflitar em ondas paralelas; o orçamento de 2.000 caracteres ganha um ponto de medida por peça.",
      "alternative": "Uma só tarefa para as sete peças do workflow, com mais de 4 arquivos e sem medida intermediária do orçamento.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "S3-28 e a parte 1 da S2-13 ficam na mesma tarefa?",
      "decision": "Sim, na T6: as duas mudam o texto de runPrompt e as mesmas asserções literais de flow.test.mjs; separar faria a mesma asserção ser reescrita duas vezes.",
      "basis": "Spec, S3-28 e S2-13 parte 1: a frase curta entra na variante de shell de runPrompt, que a S3-28 cria.",
      "alternative": "Duas tarefas, uma por peça.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o limite da guarda de tamanho do approve chega a recordCmd, que é função pura?",
      "decision": "CMD_CAP sobe para a área pura, antes de recordCmd, com a declaração da l. 2051 removida (uma só declaração do número 6.000); a T8 confirma que loadPure enxerga a constante e, se não enxergar, passa o limite como parâmetro.",
      "basis": "Spec (Deixado para o plano, R7): por parâmetro ou constante na área pura, sem duplicar o 6.000; mover custa menos caracteres que um parâmetro a mais nos pontos de chamada de recAt.",
      "alternative": "Passar o limite a recordCmd por parâmetro.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "A sonda paga entra como tarefa automática?",
      "decision": "Não: T11 é external true, sem implementer, rodada pela sessão principal depois da T10; o registro em measurements.md fica fora das tarefas (a pasta do roadmap só se escreve nas etapas de registro) e a conferência é do dono (H1).",
      "basis": "R13 e R14 da spec e .claude/rules/measure.md; o validador reprova tarefa que escreve na pasta do roadmap.",
      "alternative": "Tarefa automática do implementer, rejeitada pelo dono.",
      "costIfWrong": "medium",
      "reversible": false,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Onde se conferem os braços de medida (R16 da spec)?",
      "decision": "Na T6, que é a única peça que mexe em prompts compartilhados com os braços; tools/measure/checkpoint.test.mjs entra como check da T6 e na suíte completa da T10.",
      "basis": "R16 da spec e .claude/rules/measure.md; as demais peças não tocam prompts copiados pelos braços.",
      "alternative": "Atualizar todos os braços preventivamente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "acceptance",
      "what": "Conferir a linha run da sonda plan-only do E37 em docs/plans/roadmap-pos-2-3-0/measurements.md e aceitar ou reprovar o AC2.",
      "why": "O AC2 é verify: human; o workflow nunca registra uma aceitação humana como feita.",
      "blocking": false,
      "workaround": "O código do E37 segue na branch com o AC1 verde; o AC2 fica pendente até a conferência do dono (ou do subagent a quem ele delegar)."
    }
  ]
}
```
