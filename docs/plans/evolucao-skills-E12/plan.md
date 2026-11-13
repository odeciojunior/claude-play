# Plano E12 -- Coordinator como workflow do plugin

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E12/spec.md`. Worktree `D:/projects/claude-play-wt/E12`, branch `feat/E12`, portas 5200-5209 (nenhum servidor é necessário). Toda tarefa roda nesse worktree, antes do merge; nenhuma usa o worktree de integração, o alvo nem o merge. Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main` nem em `D:/projects/claude-play`, sem bump de versão, sem editar `docs/plans/roadmap-evolucao-skills/` nem a estratégia. Nenhuma trava configurada; nenhuma tarefa usa trava. Temporários só em `D:/projects/claude-play-wt/_tmp/E12-*/` (os testes usam `os.tmpdir()`), apagados no fim. Cada verificação é uma chamada simples, sozinha, sem pipe nem encadeamento; vermelho e verde são duas chamadas do mesmo comando.

## Contexto lido

- `lib/progress-state.mjs` (pura, prefixo `ps`): `initState(emitted, opts)` monta `steps[]` sem `files` nem `noCommit` (~63-135); `nextAction` (~137); `applyEvent(state, event, now)` (~675); `EVENT_TYPES` (~11). `lib/plan-digest.mjs`: `canon`, `fnv1a`, `planDigest`.
- `skills/plan-coordinator/scripts/progress.mjs`: comandos `init`, `next`, `apply`, `show`, `select` (~217); `parseArgs` (~78); `planChanged(state, stateFile)` (~99). `progress.test.mjs`: "AC6: executor prompt forbids asking the person" (~1031) lê o bloco `## Prompt template` de `delegation-protocol.md`; "skill files link only to existing references" (~1046).
- `skills/roadmap-release/workflow/roadmap-release.js` (238.519 caracteres LF): `// <pure>` (56) a `// </pure>` (1266); `parseAuthorizeExternal` (~700), `isOwnWorktree` (~708, fica), `isAuthorized` (~714), `planFingerprint` (~718, fica), `externalHold` (~729), `bindAuthorizations` (~735); embeds de `routing.mjs` (~1164) e `plan-digest.mjs` (~1220); `S_IMPL` (~1409); `runToken` (~1272-1300).
- `workflow/load-pure.mjs` (`loadPure(scriptPath)`), `workflow/size.test.mjs` (`MAX_WORKFLOW_CHARS = 250000`, `workflowChars`), `workflow/flow.test.mjs` (carga por `AsyncFunction`, `makeJournal`, teste de embed não defasado ~3717).
- `scripts/embed.mjs`: `embedText`, `embedFile(path, { check })`, `checkPureSource`; `exports="strip"` tira o `export`.
- `marketplace-tools/.../lint-plugin.mjs`: `registeredWorkflows(dir, pj)` (~113) lê `meta.name` por expressão regular; exige `compatibility` com versão quando a skill cita o nome completo do workflow (~351-356).
- `.claude-plugin/plugin.json`: `workflows` só com o release. `SKILL.md` atual 5.376 bytes; `references/` com `delegation-protocol.md`, `routing.md`, `state.md`. `README.md` do plugin: tabela de skills e `## Agents`.

## Tarefas

### Tarefa 1: Funções de autorização em lib/external-auth.mjs embutidas no release

Mover sem mudança de texto `parseAuthorizeExternal`, `isAuthorized`, `externalHold` e `bindAuthorizations` (com os comentários que as precedem) de `roadmap-release.js` para `plugins/productivity-tools/lib/external-auth.mjs` (novo, puro: sem import, com `export function`), e trocar no release, dentro do `// <pure>`, no mesmo lugar, por um bloco `// <embed src="../../../lib/external-auth.mjs" exports="strip">` ... `// </embed>` gerado por `node plugins/productivity-tools/scripts/embed.mjs <release.js>`. `isOwnWorktree` e `planFingerprint` ficam no release, fora do bloco (podem mudar de posição relativa só o necessário para o bloco ser contíguo). Teste primeiro dispensado: é movimento de texto, e os testes existentes do release (embed não defasado em `flow.test.mjs`, os testes de autorização e o `loadPure`) conferem sem mudança. Medir `workflowChars` com o teste de tamanho antes e depois de cada edição de `roadmap-release.js` e anotar os dois totais (previsto cerca de +150 sobre 238.519; acima de 250.000 é `BLOCKED` com o total, sem editar `size.test.mjs` nem `MAX_WORKFLOW_CHARS`, DEC-647). Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`, `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`. Commit `E12 T1: funções de autorização em lib/external-auth.mjs`.

### Tarefa 2: Estado com files, noCommit, baseline, handoff e applyEvents

Teste primeiro em `skills/plan-coordinator/scripts/progress.test.mjs`:

- `initState records files and noCommit of each task`: `files` é a união sem repetição de `files.create`, `files.modify` e `files.test`, nessa ordem; `noCommit` é o booleano da tarefa (falso quando ausente).
- `rerun keeps files and noCommit on the new step`.
- `baseline event records run.baseline`: `{ type: 'baseline', test, exit, tail, failedNames }` grava `run.baseline` e, quando `run.test` é nulo, `run.test`; recusa `exit` não inteiro ou `failedNames` que não seja lista de strings (`wrong-status` ou código próprio listado em `EVENT_TYPES`).
- `report pass keeps the handoff field`: `report` com `handoff` grava `steps[].handoff`; sem `handoff` fica como hoje.
- `applyEvents applies a batch atomically`: lote válido devolve o estado final e `ok: true`; um evento recusado no meio devolve `ok: false`, `code` e `index` do evento, e o estado de entrada sem mudança (nem cópia parcial).

Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` e relatar a falha. Implementar em `lib/progress-state.mjs` (aditivo a `progress/1`, DEC-423; a fonte segue pura e com prefixo `ps`): os dois campos em `initState`, o evento `baseline` em `EVENT_TYPES` e em `applyEvent`, o campo `handoff` em `report`, e `export function applyEvents(state, events, now)` que aplica cada evento com o `at` dele (ou `now`) sobre uma cópia e devolve `{ ok, state, code, index }`. Rodar o mesmo comando até passar. Commit `E12 T2: estado com files, noCommit, baseline, handoff e applyEvents`.

### Tarefa 3: progress.mjs token, read e apply --events assinados

Teste primeiro em `progress.test.mjs` (sandbox git como os casos de `init`):

- `token prints a fresh random token`: duas chamadas dão tokens diferentes, só `[0-9a-f]` com 32 caracteres.
- `read prints the signed state`: `read <progress.json> --nonce N --json` imprime `{ tool: 'progress', command: 'read', nonce: 'N', now, root, planChanged, state, digest }`, com `state.history` vazio, `root` igual ao topo do git da pasta do plano e `digest === fnv1a(JSON.stringify(canon(resto sem digest)))`; `planChanged` verdadeiro depois de editar o plano.
- `apply --events writes a batch and signs the result`: carga `encodeURIComponent(JSON.stringify({ expect, events, digest }))` com `digest` da carga certo grava todos os eventos e imprime `{ tool, command: 'apply', nonce, now, ok: true, code: null, action, stateDigest, digest }`, onde `stateDigest` é o resumo do estado gravado sem `history`.
- `apply --events refuses without writing`: `digest` da carga errado sai 2; `expect` diferente do estado no disco devolve `code: 'concurrent-change'`; um evento recusado devolve o `code` e o arquivo fica byte a byte igual.

Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` e relatar a falha. Implementar em `progress.mjs`: `token` (`crypto.randomBytes(16)`), `read` e `apply --events <carga> --nonce <n>` com `applyEvents`, mais `--nonce` no `parseArgs`; a função do resumo do estado (`fnv1a(JSON.stringify(canon({ ...state, history: [] })))`) é exportada por `progress.mjs` para os testes. `apply` de um evento (forma de hoje) não muda. Rodar até passar. Commit `E12 T3: progress.mjs token, read e apply --events`.

### Tarefa 4: Esqueleto do coordinator-workflow, registro, portão de onda e teto

Teste primeiro: `workflow/gate.test.mjs` (novo) carrega o `// <pure>` de `coordinator.js` com `loadPure(<caminho do coordinator>)` de `skills/roadmap-release/workflow/load-pure.mjs` e cobre `failedTestNames` (saída TAP `not ok 3 - nome`, saída spec `✖ nome`, saída sem nomes dá `[]`) e `waveGatePasses(gate, baseline)`: exit 0 passa; exit 1 com nomes iguais aos `failedNames` de um baseline com falha passa; falha nova falha; baseline verde com falha falha; exit 1 sem nomes reconhecíveis falha (C4). `workflow/size.test.mjs` (novo) mede `coordinator.js` com `workflowChars` importado de `../../roadmap-release/workflow/size.test.mjs` contra `MAX_COORDINATOR_CHARS = 120000`, confere `embedFile(coordinator.js, { check: true }).stale === false` e que `applyEvents`, `nextAction`, `canon`, `fnv1a`, `parseAuthorizeExternal` e `externalHold` do `loadPure` dão o mesmo resultado que as de `lib/` sobre entradas fixas. Rodar os dois e relatar a falha.

Criar `skills/plan-coordinator/workflow/coordinator.js`: `export const meta = { name: 'coordinator-workflow', description, whenToUse, phases }`; um `// <pure>` com os embeds (`exports="strip"`) de `lib/progress-state.mjs`, `lib/plan-digest.mjs` e `lib/external-auth.mjs` e as funções próprias `failedTestNames`, `waveGatePasses`, `checkSigned(out, nonce, command)` (confere `tool`, `command`, `nonce` e `digest`) e `validateArgs(args)` (R5, R7: `plan`, `state` e `runToken` strings não vazias; `authorizeExternal` por `parseAuthorizeExternal` e só itens `plan:T<n>@<8 hex>`, item sem resumo recusado com a forma exata; `answers` só `answer`, `unblock`, `release`, `hold`, `refuse`; `test` string); depois do bloco, a entrada que devolve `{ status: 'error', error }` sem chamar `agent()` quando `validateArgs` falha. Sem `crypto`, `process`, `Buffer`, `import`, leitura de arquivo nem `subagent_type` (DEC-057, DEC-058). Em `plugin.json`, `workflows` ganha `./skills/plan-coordinator/workflow/coordinator.js` depois do release; sem bump. Rodar `gate.test.mjs`, `size.test.mjs`, `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` e G5. Commit `E12 T4: esqueleto do coordinator-workflow e registro`.

### Tarefa 5: Laço de ondas, despacho em paralelo e commits em série

Teste primeiro: `workflow/flow.test.mjs` (novo) carrega `coordinator.js` como o `flow.test.mjs` do release (`export const meta` trocado por `const meta`, `AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC)`) e cria a fixture `workflow/fixtures/two-waves/plan.md` (`plan/1` sintético, com a linha `SYNTHETIC FIXTURE` no topo da prosa; T1 e T2 na onda 1; T3 dependente de T1, `external: true`, na onda 2; T4 na onda 2 com `noCommit: true` e `files` vazio; passa no `plan-tool check`). Cada caso copia a fixture para um repositório git em `os.tmpdir()`, roda o `progress.mjs init --commits per-step` real e usa um agente simulado que executa de verdade os comandos de `progress.mjs` e de `git` pedidos ao `script-runner`, faz o implementador escrever os arquivos do passo sem commitar e aprova as revisões. Casos (testRef do AC1 e do AC5):

- `AC1: a wave is dispatched in one parallel call and a step waits for its dependency`: T1 e T2 na mesma chamada de `parallel()`; T3 só depois do `report` `pass` de T1 gravado.
- `AC1: a failed T1 keeps T3 undispatched`.
- `AC1: per-step commits run in series after the wave with each step's files`: nenhum `git commit` dentro do `parallel()`; `steps[].sha` de T1 e T2 diferentes, cada um com o assunto `<id> T<n>:` do próprio passo e exatamente os `files` do passo; T4 em `pass` sem `git add` nem `git commit` e com `sha` nulo; passo em `pass` sem `files` dá `error` que nomeia o passo e pede `init --restart` (C5).
- `AC5: a launch without plan, state or runToken stops before any agent`: três lançamentos, `status: 'error'`, agente simulado nunca chamado; `plan:T3` sem resumo também (C2).
- `AC5: plugin.json registers coordinator-workflow`: o caminho está em `plugin.json`, o arquivo existe e `registeredWorkflows` do lint devolve `coordinator-workflow`.
- `state divergence and plan changes stop the run`: `stateDigest` diferente do local dá `state-divergence`; `planChanged` dá `plan-changed` antes de qualquer implementador; saída copiada com um caractere trocado repete a leitura e não regrava (C3).

Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` e relatar a falha. Implementar em `coordinator.js` o laço do Desenho da spec: leitura assinada pelo `script-runner` (haiku/low; até 3 tentativas haiku, haiku, sonnet), conferência de `plan.path` com `args.plan`, `approve-map`, evento `baseline`, `launch` gravado por `apply --events` antes do `parallel()` de implementadores (`agentType: 'productivity-tools:implementer'`, `model`/`effort` da rota, esquema `S_IMPL` igual ao do release, prompt curto com o caminho absoluto do brief, as linhas `HANDOFF` das dependências, a regra de efeito externo e as linhas `Never commit. The orchestrator commits.` e `- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.`), `report`, revisão por passo com portão (`productivity-tools:task-reviewer`, opus/medium, `S_TASKREVIEW`, até 2 rodadas de correção), commits em série na ordem de `n` (`git add -- <files>`, `git commit -m "<id> T<n>: <título>" -- <files>`, `git log -1 --format=%H --grep "^<id> T<n>:"`, `commit --sha`), `wave-gate` por `waveGatePasses`, `advance`, `final-gate` (`productivity-tools:final-reviewer`, opus/high) e gravação antes de cada retorno. Medir com `size.test.mjs`. Rodar `flow.test.mjs`, `gate.test.mjs` e `size.test.mjs`. Commit `E12 T5: laço de ondas e commits em série`.

### Tarefa 6: Autorização presa ao resumo e retomada sem repetir efeito

Teste primeiro em `workflow/flow.test.mjs`, com um diário de chamadas como o `makeJournal` do release:

- `AC2: an external step stops before its implementer and returns the item to authorize`: sem `authorizeExternal`, a saída é `{ status: 'stopped', stop: { kind: 'authorize', items: [{ item: 'plan:T3@<plan.digest>', step: 3, title }] }, resumeArgs }`, o `prelaunch-review` de T3 rodou e o implementador de T3 nunca foi chamado; com o item certo, T3 é lançado uma vez; `resumeArgs` não traz `authorizeExternal`, `answers` nem `runToken`.
- `AC2: an authorization bound to another plan digest does not count`: com `plan:T3@<resumo de outro plano>`, para igual e T3 não é despachado (C2).
- `AC3: a relaunch after a kill skips passed steps and asks about a launched external step`: mata no implementador de T3 autorizado e lançado; relança com o mesmo `state` e outro `runToken`; T1 e T2 não são despachados de novo, o implementador de T3 não é chamado e a saída é a parada `ask` sobre T3 (C1); `answers` com `answer --value done` fecha T3.
- `AC3: a relaunch after a kill in a common step relaunches only that step`: mata no implementador de T2; no relançamento só T2 volta.

Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` e relatar a falha. Implementar em `coordinator.js`: `prelaunch-review` pelo `task-reviewer` (opus/medium, só leitura sobre o brief), `authorize` por `externalHold({ n, external }, 'plan', itens, state.plan.digest)`, a parada `authorize` gravada antes do retorno, `answers` aplicadas no início antes do laço, `no-report` para todo passo `launched` lido no início e a parada `ask` sobre o passo externo que vira `stopped`. Medir com `size.test.mjs`. Rodar `flow.test.mjs`, `gate.test.mjs` e `size.test.mjs`. Commit `E12 T6: autorização presa ao resumo e retomada`.

### Tarefa 7: SKILL.md como entrada curta e orçamento de prosa

Teste primeiro: `skills/plan-coordinator/scripts/prose-budget.test.mjs` (novo), caso `AC4: prose loaded before the launch stays within the derived target`: soma os bytes LF de `SKILL.md` e de cada `references/*.md` citado antes de `## After the workflow returns` (falha se o título faltar), confere `≤ TARGET` com `BASELINE = 56508`, `REMOVED = 50508`, `TARGET = 6000` e `TARGET === BASELINE - REMOVED` (R9). Em `workflow/flow.test.mjs`, caso `AC5: the skill launches coordinator-workflow by name`: `SKILL.md` contém `productivity-tools:coordinator-workflow`; as linhas que citam `scriptPath` citam "unknown" ou "not found" e `--add-dir`; o frontmatter não tem `allowed-tools` nem `disable-model-invocation` e a `description` é igual à de hoje (copiada no teste). Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs` e `flow.test.mjs` e relatar a falha.

Reescrever `SKILL.md` com o conteúdo do critério 4 da spec: descrição sem mudança; `compatibility` do R8; intenção; escolha (`progress.mjs select`, empate como única pergunta antes do lançamento); estado (ramo `plan/<tópico>` em `per-step` no ramo padrão, árvore sem mudanças alheias, `init`, ou nada se o `progress.json` existe); lançamento (`progress.mjs token`, `Workflow` pelo nome com `{ plan, state, runToken, test }`; parágrafo da reserva por `scriptPath` `<dir>/workflow/coordinator.js` de cerca de 700 bytes, R14; regra `Workflow(productivity-tools:coordinator-workflow)` informada, nunca gravada); depois de `## After the workflow returns`, o retorno, apontando `references/delegation-protocol.md` e `references/state.md`. Rodar os dois testes e G5. Commit `E12 T7: SKILL.md como entrada curta`.

### Tarefa 8: delegation-protocol e state.md reduzidos ao que o workflow não cobre

Ajustar em `progress.test.mjs` o teste "AC6: executor prompt forbids asking the person" (mesmo nome) para ler `workflow/coordinator.js` e conferir a linha literal `- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.` no prompt do implementador; "skill files link only to existing references" segue igual. Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`: deve passar já com o texto da T5 (a asserção muda de lugar, não sai). Reduzir `references/delegation-protocol.md` ao que o workflow não cobre: repassar cada parada (`authorize` com os itens exatos, `ask`, `plan-changed`, `state-divergence`, `error`), relançar com `authorizeExternal` e `answers`, `init --restart` só a pedido, `roadmap-tracker` uma vez com "plan completed" quando `plan.roadmap` nomeia uma pasta (R10), relatório final. Em `references/state.md`: `gated`, `steps[].files`, `steps[].noCommit`, evento `baseline`, `handoff` do `report`, comandos `read`, `token` e `apply --events`, e a saída assinada. Rodar `progress.test.mjs`, `prose-budget.test.mjs` e `flow.test.mjs`. Commit `E12 T8: protocolo e estado do coordinator-workflow`.

### Tarefa 9: README do plugin e gates

Em `plugins/productivity-tools/README.md`, a linha do `plan-coordinator` na tabela e as linhas de `implementer`, `task-reviewer`, `final-reviewer` e `script-runner` em `## Agents` passam a citar também o workflow do coordinator (`productivity-tools:coordinator-workflow`). Sem bump. Rodar G1, G2, G3, G4 e G5 e os dois testes de tamanho. Evidência aceitável se um gate não puder rodar neste ambiente (por exemplo, `claude` ausente): a saída literal do comando e o motivo, sem resultado inventado. Commit `E12 T9: README cita o coordinator-workflow`.

### Tarefa 10: Teste comportamental da entrada curta pelo orquestrador

Tarefa do orquestrador da sessão principal no worktree de E12, antes do merge (DEC-204, R11). Sessões `claude -p` com `--plugin-dir plugins/productivity-tools` sobre um sandbox em `D:/projects/claude-play-wt/_tmp/E12-comportamental/` com a fixture de duas ondas (marcada `SYNTHETIC FIXTURE`) levam a skill até `select`, `init`, `token` e a montagem dos argumentos do `Workflow`, sem chamá-lo (DEC-230, DEC-271); uma revisão adversarial opus, só de leitura, confere o resultado. Relatório em `docs/reports/2026-11-13-E12-coordinator-comportamental.md` com a saída literal e o veredito; a pasta temporária é apagada no fim. A descrição não muda (R8), então os 3 casos `plan-execution` não rodam de novo. Sem ferramenta de subagent (executor do workflow), a tarefa devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)" e não escreve relatório fictício; essa é a evidência aceitável quando a execução não pode ocorrer neste ambiente. Commit `E12 T10: relatório comportamental da entrada curta`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` | `AC1: a wave is dispatched in one parallel call and a step waits for its dependency`; `AC1: a failed T1 keeps T3 undispatched`; `AC1: per-step commits run in series after the wave with each step's files` |
| AC2 | test | idem | `AC2: an external step stops before its implementer and returns the item to authorize`; `AC2: an authorization bound to another plan digest does not count` |
| AC3 | test | idem | `AC3: a relaunch after a kill skips passed steps and asks about a launched external step`; `AC3: a relaunch after a kill in a common step relaunches only that step` |
| AC4 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs` | `AC4: prose loaded before the launch stays within the derived target` |
| AC5 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` | `AC5: plugin.json registers coordinator-workflow`; `AC5: the skill launches coordinator-workflow by name`; `AC5: a launch without plan, state or runToken stops before any agent` |

## Decisões do plano

- R17: dez tarefas na ordem lib do release -> estado -> CLI -> esqueleto do workflow -> laço -> autorização e retomada -> SKILL.md -> referências -> README e gates -> comportamental.
- R18: a T1 dispensa teste primeiro (movimento de texto conferido pelos testes existentes do release).
- R19: o teste "AC6" muda de arquivo na T8, depois que a T5 pôs a linha no prompt do workflow.
- R20: T10 sem subagent devolve `NEEDS_HUMAN`; nenhum relatório inventado.
- H1 da spec (meta de prosa na estratégia) fica para o dono; o teste carrega a constante.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E12",
  "title": "Coordinator como workflow do plugin",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ nem a estratégia (só nos estágios de registro e docs, na release).",
    "Não editar skills/roadmap-release/workflow/size.test.mjs nem MAX_WORKFLOW_CHARS (DEC-647); medir workflowChars de roadmap-release.js depois de cada edição; acima de 250000 caracteres LF, BLOCKED com o total.",
    "coordinator.js abaixo de MAX_COORDINATOR_CHARS = 120000 caracteres LF, bem abaixo dos 524288 bytes do lançamento pelo nome.",
    "Lógica comum chega a coordinator.js só por scripts/embed.mjs (progress-state, plan-digest, external-auth), nunca copiada à mão; sem crypto, process, Buffer, import, leitura de arquivo nem subagent_type em coordinator.js (DEC-057, DEC-058).",
    "SKILL.md sem allowed-tools nem disable-model-invocation e com a descrição de hoje (DEC-049, DEC-275, R8).",
    "Implementadores nunca commitam; commits só em série pelo workflow, por script-runner.",
    "Execução comportamental que precisa de ferramenta de subagent é do orquestrador da sessão principal (DEC-204); sem relatório fictício.",
    "Sem bump de versão; sem push; nunca tocar em main nem no worktree D:/projects/claude-play.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem pipe, sem && e sem ;. Temporários só em D:/projects/claude-play-wt/_tmp/E12-*/, apagados no fim.",
    "Commits de tarefa começam com \"E12 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Funções de autorização em lib/external-auth.mjs embutidas no release",
      "deps": [],
      "files": {
        "create": ["plugins/productivity-tools/lib/external-auth.mjs"],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["lib/external-auth.mjs: parseAuthorizeExternal(v), isAuthorized(items, item), externalHold(task, E, items, fp), bindAuthorizations(items, E, fp)"],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": { "exempt": "movimento de texto sem mudança (R3); os testes existentes do release conferem" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 250000 caracteres LF)" },
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Estado com files, noCommit, baseline, handoff e applyEvents",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/lib/progress-state.mjs"],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["steps[].files, steps[].noCommit", "evento baseline { test, exit, tail, failedNames }", "report { handoff }", "applyEvents(state, events, now) -> { ok, state, code, index }"],
      "consumes": [],
      "covers": ["AC1", "AC3", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "progress.mjs token, read e apply --events assinados",
      "deps": [2],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs"],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["progress.mjs token", "progress.mjs read <state> --nonce n --json -> { tool, command, nonce, now, root, planChanged, state, digest }", "progress.mjs apply <state> --events <carga> --nonce n --json -> { tool, command, nonce, now, ok, code, action, stateDigest, digest }"],
      "consumes": [{ "task": 2, "sig": "applyEvents(state, events, now) -> { ok, state, code, index }" }],
      "covers": ["AC1", "AC3", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Esqueleto do coordinator-workflow, registro, portão de onda e teto",
      "deps": [1, 2],
      "files": {
        "create": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"],
        "modify": ["plugins/productivity-tools/.claude-plugin/plugin.json"],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["meta.name 'coordinator-workflow'", "failedTestNames(out) -> string[]", "waveGatePasses(gate, baseline) -> boolean", "checkSigned(out, nonce, command) -> boolean", "validateArgs(args) -> { ok, error }"],
      "consumes": [
        { "task": 1, "sig": "lib/external-auth.mjs: parseAuthorizeExternal(v), isAuthorized(items, item), externalHold(task, E, items, fp), bindAuthorizations(items, E, fp)" },
        { "task": 2, "sig": "applyEvents(state, events, now) -> { ok, state, code, index }" }
      ],
      "covers": ["AC5", "C2", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Laço de ondas, despacho em paralelo e commits em série",
      "deps": [3, 4],
      "files": {
        "create": ["plugins/productivity-tools/skills/plan-coordinator/workflow/fixtures/two-waves/plan.md"],
        "modify": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 2 },
      "produces": ["laço de nextAction com leitura e gravação assinadas, parallel() por onda e commits em série"],
      "consumes": [
        { "task": 3, "sig": "progress.mjs apply <state> --events <carga> --nonce n --json -> { tool, command, nonce, now, ok, code, action, stateDigest, digest }" },
        { "task": 4, "sig": "waveGatePasses(gate, baseline) -> boolean" }
      ],
      "covers": ["AC1", "AC5", "C2", "C3", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Autorização presa ao resumo e retomada sem repetir efeito",
      "deps": [5],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["parada { status: 'stopped', stop: { kind: 'authorize', items: [{ item, step, title }] }, resumeArgs }", "parada ask sobre passo externo launched"],
      "consumes": [{ "task": 5, "sig": "laço de nextAction com leitura e gravação assinadas, parallel() por onda e commits em série" }],
      "covers": ["AC2", "AC3", "C1", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "SKILL.md como entrada curta e orçamento de prosa",
      "deps": [6],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/SKILL.md",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": ["SKILL.md com o título '## After the workflow returns' e o lançamento por productivity-tools:coordinator-workflow"],
      "consumes": [],
      "covers": ["AC4", "AC5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "delegation-protocol e state.md reduzidos ao que o workflow não cobre",
      "deps": [3, 7],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md",
          "plugins/productivity-tools/skills/plan-coordinator/references/state.md"
        ],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": ["AC4"],
      "testFirst": { "exempt": "o teste AC6 só muda de arquivo e passa com o texto da T5; o resto é documentação" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "README do plugin e gates",
      "deps": [8],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/README.md"],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só documentação; os gates conferem o conjunto" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid", "expect": "exit 0 (G4)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 10,
      "title": "Teste comportamental da entrada curta pelo orquestrador",
      "deps": [9],
      "files": {
        "create": ["docs/reports/2026-11-13-E12-coordinator-comportamental.md"],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "execução comportamental do orquestrador (DEC-204), sem código" },
      "checks": [
        { "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-13-E12-coordinator-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
      "testRef": "AC1: a wave is dispatched in one parallel call and a step waits for its dependency; AC1: a failed T1 keeps T3 undispatched; AC1: per-step commits run in series after the wave with each step's files",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
      "testRef": "AC2: an external step stops before its implementer and returns the item to authorize; AC2: an authorization bound to another plan digest does not count",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
      "testRef": "AC3: a relaunch after a kill skips passed steps and asks about a launched external step; AC3: a relaunch after a kill in a common step relaunches only that step",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC4",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs",
      "testRef": "AC4: prose loaded before the launch stays within the derived target",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC5",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
      "testRef": "AC5: plugin.json registers coordinator-workflow; AC5: the skill launches coordinator-workflow by name; AC5: a launch without plan, state or runToken stops before any agent",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R17",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Dez tarefas: autorização em lib e embed no release (T1); estado (T2); CLI assinada (T3); esqueleto, registro, portão e teto (T4); laço e commits (T5); autorização e retomada (T6); SKILL.md e orçamento (T7); referências e teste AC6 (T8); README e gates (T9); comportamental do orquestrador (T10). Cada tarefa com até quatro arquivos; as que tocam o mesmo arquivo ficam encadeadas.",
      "basis": "Ordem deixada para o plano pela spec (lib e CLI antes do workflow, workflow antes da prosa, troca do bloco do release numa tarefa própria com workflowChars medido antes e depois); política de até quatro arquivos por tarefa T1.",
      "alternative": "Uma tarefa única para coordinator.js com todos os critérios.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R18",
      "question": "A T1 tem teste primeiro?",
      "decision": "Não: é movimento de texto sem mudança (R3 da spec); os testes do release, sem mudança, e embed --check conferem; a igualdade das funções embutidas no coordinator com as de lib é conferida pelo size.test.mjs da T4.",
      "basis": "R3 da spec (os testes do release continuam passando sem mudança); escopo da spec não lista teste novo para a lib.",
      "alternative": "Criar lib/external-auth.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R19",
      "question": "Quando o teste AC6 do progress.test.mjs muda de lugar?",
      "decision": "Na T8, quando delegation-protocol.md perde o modelo de prompt; a linha literal entra no prompt do implementador de coordinator.js na T5, então o teste passa ao mudar.",
      "basis": "Spec (a asserção muda de lugar, não sai); ordem das tarefas.",
      "alternative": "Mover o teste já na T5.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R20",
      "question": "O que a tarefa comportamental faz num executor sem ferramenta de subagent?",
      "decision": "Devolve NEEDS_HUMAN com humanInputs citando a execução do orquestrador da sessão principal (DEC-204) e não escreve relatório.",
      "basis": "DEC-204, R11 da spec; um relatório sem execução seria aceite fictício.",
      "alternative": "Marcar a tarefa noCommit e deixar o relatório fora do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "decision",
      "what": "Registrar na estratégia, por nova revisão, a meta de prosa de E12 (R9 da spec: ≤ 6.000 bytes LF, linha de base 56.508, removido 50.508).",
      "why": "Revisão de estratégia é ato do dono; a entrega não edita a estratégia nem a pasta do roadmap.",
      "blocking": false,
      "workaround": "prose-budget.test.mjs carrega a constante com a derivação e roda no G1."
    }
  ]
}
```
