# Plano E10 -- Release mecânico por código

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E10/spec.md`. Worktree `D:/projects/claude-play-wt/E10`, branch `feat/E10`, portas 5200-5209 (nenhum servidor). Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main` nem em `D:/projects/claude-play`, sem bump de versão, sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava. Todas as tarefas rodam no worktree de E10 antes do merge. Um comando simples por chamada; temporários só em `D:/projects/claude-play-wt/_tmp/E10-*/`, apagados no fim. Commits `E10 T<n>: ...`, só com os arquivos da tarefa, terminando com `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Contexto lido

Os arquivos do plugin não mudaram desde 3a1d3de (`git diff --stat 3a1d3de HEAD -- plugins` vazio).

- `workflow/roadmap-release.js`: bloco `// <pure>` (56-1267) com `truthDivergences` (675), `recordVerdict` (985), `canon` (1243) e `fnv1a` (1254); `S_DISC` (1387), `S_RECORD` e `S_RECORD_READ` (1427-1428), `S_TRUTH` (1439); descoberta (1443-1472: prompt, `PRE_TARGET`, conferências dos campos e de `pendingDecisionsStdout`); `BASH_ONLY` (1696); `recordStatus` (1711-1749: `recordCommands`, chamada `${E}:status-<status>`, releitura `-read`, `recordVerdict`); `load3` (2111); relatório (2836-2901: `claims`, `git-truth`, `truthDivergences`, `op('divergence', ...)`, chamada `report` sem schema). `pluginRootOf(A.trackerCli)` já dá a raiz do plugin (1615).
- `workflow/flow.test.mjs`: `promptCommands` (99), `exec` (142, `discovery` em 159, `git-truth` em 193), caminho sem falhas (209), I6 (a) (274-276), schema de `git-truth` (368), PF/M6 (2268), `statusPrompts` (3004), seleção com `pendingDecisionsStdout` (4116-4139).
- `workflow/merge.test.mjs`: `truthDivergences` por `loadPure()` (81) e o teste da linha 99. `workflow/size.test.mjs`: `MAX_WORKFLOW_CHARS = 250000`, `workflowChars` exportada.
- `scripts/preflight.mjs`: importa `pendingDecisions` de `roadmap.mjs` e `parseRoadmapTexts`; `WORKFLOW_SCRIPTS` (203) e o mapa de caminhos (422-424); `readRoadmapTexts` (327) e `readPendingDecisions` (345), privadas; CLI (443).
- `lib/plan-digest.mjs`: `canon`, `fnv1a` exportadas. `agents/test-integrity.md`: forma do agente novo.
- `references/config.md` (56, `WORKFLOW_SCRIPTS`), `references/operator.md` (33, `divergence`; 93, descoberta), `SKILL.md` (passo 2).
- `tools/measure/session-metrics.mjs` classifica os rótulos `discovery` e `git-truth`; fica fora do escopo da spec e não muda (R19).

## Tamanho do script

T5 e T6 editam `roadmap-release.js` e medem `workflowChars` depois de cada edição com o check do limite. Limite de cada uma: 239.898 (o estado final da spec), e nenhuma edição intermediária passa de 250.000. Tarefa acima do limite não faz commit e devolve `BLOCKED` com o déficit medido (total menos limite). `size.test.mjs` e `MAX_WORKFLOW_CHARS` nunca mudam (DEC-647).

## Como rodar os checks

Cada check roda sozinho na sua chamada, sem pipe nem encadeamento. Numa tarefa com teste primeiro, a execução vermelha e a verde são duas chamadas do mesmo comando. Saída longa é cortada no relatório com `[...]`, nunca filtrada.

## Tarefas

### Tarefa 1: Mapa das asserções (R15) e medida de ANTES

Rodar `git grep -n <padrão> 3a1d3de -- plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, uma chamada por padrão: `git-truth`, `S_DISC`, `S_TRUTH`, `S_RECORD`, `calls\[0\]`, `'discovery'`, `'report'`, `pendingDecisionsStdout`, `BASH_ONLY`, `promptCommands`, `statusPrompts`, `roadmap.mjs`. Criar `docs/plans/evolucao-skills-E10/assertion-map.md` com uma tabela `linha | teste | destino` por asserção encontrada, partindo da semente da spec (I6 (a)-(f), 653, 2342, 2497, 3015-3075, 366, 526-528, 2268, 3127-3135, 4132-4139) e aplicando a regra: comportamento de script vai para `preflight.test.mjs` ou `verify-run.test.mjs`; comportamento do workflow fica em `flow.test.mjs`, sobre dados assinados ou sobre a carga do grupo decodificada; nenhuma é apagada. O mapa diz que é regra, não lista fechada. Medir `ANTES`: acrescentar em `flow.test.mjs` um caso temporário com o roteiro do caminho sem falhas de um entregável de uma tarefa (o `exec` do teste da linha 209) que imprime `calls.length`, rodar `flow.test.mjs`, anotar o número e o roteiro exato no mapa e desfazer o caso com `git checkout -- <flow.test.mjs>`; o caso temporário nunca é commitado (R17). Commit `E10 T1: mapa das asserções e ANTES`.

### Tarefa 2: Subcomando discover

Teste primeiro em `preflight.test.mjs`: caso `E10 AC1: discoverRoadmap over the valid fixture matches the checker` (repositório git temporário com `roadmap-tracker/scripts/fixtures/valid`; ids, `deps`, `status` = célula do painel e `blockers` iguais aos de `parseRoadmap(loadRoadmap(VALID))`); casos de `today` com e sem `--today` (C5), alvo `integracao/<slug>` sem `--ref`, `mergeFound` falso com merge revertido, `mergeSha` de 40 caracteres, `onTarget` por segmento `code` integrado, recusa do ramo `<prefixo><id>` como ancestral, `data` sem `wtRoot`, `pendingDecisions` em lista, `acceptanceOmitted` para integrado e descartado (R12), saída `{ tool: 'release-discovery', nonce, digest, data }` com `digest` conferido por `canon`/`fnv1a` de `lib/plan-digest.mjs`, saída 1 com `{ tool, error }` sem pasta ou estratégia, e os campos sempre presentes da seção I6 (c) do mapa. Rodar e relatar a falha. Implementar `discoverRoadmap` e o subcomando `discover` (critério 1 da spec), reaproveitando `readRoadmapTexts` com o ramo base como segunda fonte e `readPendingDecisions`; git só por `execFileSync('git', ...)`. `WORKFLOW_SCRIPTS` ganha `preflight.mjs` e `verify-run.mjs`, com caminho `<raiz do plugin>/skills/roadmap-release/scripts/<nome>` (R18), e o caso existente de `WORKFLOW_SCRIPTS` se ajusta. O teste "preflight carries no copy of the parser" segue verde. Commit `E10 T2: discover no preflight`.

### Tarefa 3: verify-run.mjs (group e check)

Teste primeiro em `verify-run.test.mjs` (novo, repositórios git temporários): `E10 AC2: check returns ok on a clean run and lists each divergence` (sem divergência `ok: true`; merge relatado sem `merge: <id> in <alvo>`, commit reivindicado fora do alvo, alvo sujo e `lastGood` não ancestral, cada um em `divergences`); `E10 AC3: a group of three whose second fails skips the third, runs finally and returns each result` (C1: `stopped: { n: 2, exit: 1 }`, commit da fase `finally`, `out` reduzido para JSON da CLI e 2.000 caracteres para outra saída); recusa de `|`, `;`, `&&`, `$(` e de comando que não é `node` nem `git`, sem rodar; carga com `digest` errado sai 2 sem rodar nada, nos dois subcomandos (C2). Rodar e relatar a falha. Implementar `verify-run.mjs` com a carga em `encodeURIComponent` do JSON (mais `!'()*` em `%XX`) num único argumento (R16), o tokenizador POSIX mínimo, `group`, `check` e `truthDivergences` exportada com o texto de hoje. Em `merge.test.mjs`, o teste da linha 99 importa `truthDivergences` de `../scripts/verify-run.mjs`, com as mesmas asserções. Commit `E10 T3: verify-run group e check`.

### Tarefa 4: Agente script-runner

Criar `agents/script-runner.md` na forma de `test-integrity.md` (`name: script-runner`, `tools: Bash`, sem `model` nem `effort`, `NO_ASK` literal, precedência do prompt): rodar exatamente o único comando dado, uma vez, sem editar arquivo, e devolver `exit` e o `stdout` inteiro, literal. Na seção de agentes do `README.md` do plugin, a linha do `script-runner`. Sem bump. Rodar G5. Commit `E10 T4: agente script-runner`.

### Tarefa 5: Descoberta pelo script no workflow

Teste primeiro em `flow.test.mjs`: o `exec` (159) devolve em `discovery` `{ exit: 0, stdout }` com a saída `release-discovery` assinada (`canon`/`fnv1a` de `lib/plan-digest.mjs`) sobre os dados de hoje mais `discOver`, com `pendingDecisions: []`; casos novos `E10 AC1: discovery dispatches the script-runner with preflight.mjs" discover` (`calls[0]`, `--prefix pf-test`, sem pasta de worktree no comando), `discovery stops naming each missing field`, `a wrong digest retries up to 5 times and stops with discovery failed`, `discovery-donot only with donot items` e seleção que nunca lê `acceptance` de card integrado (R12); as asserções do mapa da T1 sobre a descoberta mudam de forma pela regra, sem apagar nenhuma. Rodar e relatar a falha. Implementar no bloco `// <pure>` `checkRun(stdout, tool, nonce)` e `encArg(obj)`; `S_RUN = { exit, stdout }`; a chamada `discovery` com `agentType: 'productivity-tools:script-runner'`, o comando montado (com `--ref` só com `PRE_TARGET`, `--today` só com `A.today`, `RUN_TOKEN` como `nonce`) e `BASH_ONLY`, até 5 tentativas (1-2 haiku, 3-5 sonnet); as conferências de hoje sobre `data`; `discovery-donot` em sonnet só com `donot` não vazio; saem `S_DISC` e o prompt. Medir depois de cada edição. Rodar de novo o mesmo comando, `prompts.test.mjs`, o teste de tamanho e o check do limite. Commit `E10 T5: descoberta por script`.

### Tarefa 6: Registro agrupado e verificação no relatório

Teste primeiro em `flow.test.mjs`: o mock do registro (114) e `promptCommands` sobre prompts `:status-<palavra>` leem os `steps` da carga decodificada e respondem com a saída `group` assinada; casos `E10 AC3: the happy path of a one-task deliverable makes ANTES - 1 calls, no git-truth, status write before read` (`ANTES` da T1, com comentário que cita 3a1d3de), `E10 AC3: a group whose step 2 exits 1 is not repeated and command 2 fails the record` (C1), `a group output with one changed character is a null record agent` (C2), `a group payload over 28000 characters runs in chunks and renumbers runs` (C3), `E10 AC2: a confirmed check with a validated-tip divergence becomes a divergence operator action` (I6 (a)) e saída nula de `check` com o texto de hoje; I6 (f) conta `roadmap.mjs` também nos `steps` decodificados; PF/M6 (2268) sem `git-truth`, conferindo as três chamadas restantes. Rodar e relatar a falha. Implementar: `recordStatus` monta o grupo (`cwd` = `INTWT`, `steps` = `rc.commands`, `finally` com `RM`, mensagem e `TRAILER`) e chama `${E}:status-<status>` no `script-runner` em haiku/low com `S_RUN`; `results.runs` vem dos `steps` confirmados; `-read` e `recordVerdict` não mudam; `S_RECORD` sai. A chamada `git-truth`, `S_TRUTH` e `truthDivergences` saem do workflow; `report` recebe o comando `check` como primeiro passo e o schema `{ report, truthStdout }`; divergências confirmadas viram `op('divergence', ...)`; `plan-only` sem verificação. Medir depois de cada edição. Rodar de novo o mesmo comando, `merge.test.mjs`, `verify-run.test.mjs`, `prompts.test.mjs`, o teste de tamanho e o check do limite. Commit `E10 T6: registro agrupado e verificação no relatório`.

### Tarefa 7: Documentação e gates

Em `references/config.md`, as regras de `preflight.mjs` e `verify-run.mjs` em `WORKFLOW_SCRIPTS`; em `references/operator.md`, `divergence` vinda do `check` no relatório e a descoberta por script; em `SKILL.md`, onde descreve a descoberta, o registro e a verdade do git. Sem bump. Rodar G1, G2, G3 e G5. Evidência aceitável se um gate não rodar aqui: saída literal e motivo. Commit `E10 T7: documentação`.

### Tarefa 8: Teste comportamental pelo orquestrador

Tarefa do orquestrador da sessão principal (DEC-204, R11 da spec), no worktree de E10 antes do merge: sessões `claude -p` com `--plugin-dir` no worktree levam a skill até o passo 2 e a montagem dos argumentos do passo 4 em `dry-run`, sem chamar o Workflow (DEC-230), e despacham `productivity-tools:script-runner` com `discover` sobre a pasta do roadmap e com `group` sobre fixture sintética marcada (`SYNTHETIC FIXTURE`) em `D:/projects/claude-play-wt/_tmp/E10-comportamental/`, conferindo a saída literal contra o `digest`; relatório em `docs/reports/2026-11-13-E10-release-mecanico-comportamental.md`; pasta apagada no fim. Sem ferramenta de subagent, devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)", sem relatório fictício; essa é a evidência aceitável. Commit `E10 T8: relatório comportamental`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | `E10 AC1: discoverRoadmap over the valid fixture matches the checker` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` | `E10 AC2: check returns ok on a clean run and lists each divergence` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `E10 AC3: the happy path of a one-task deliverable makes ANTES - 1 calls, no git-truth, status write before read` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` | `E10 AC3: a group of three whose second fails skips the third, runs finally and returns each result` |

## Decisões do plano

- R16: carga em `encodeURIComponent` com `!'()*` codificados, um só argumento sem aspas.
- R17: `ANTES` medido por caso temporário não commitado; número e roteiro no mapa.
- R18: os dois scripts novos em `WORKFLOW_SCRIPTS` com caminho na pasta de scripts da skill.
- R19: `tools/measure/session-metrics.mjs` não muda.
- R20: oito tarefas; scripts antes da ligação; T8 sem subagent devolve `NEEDS_HUMAN`.

```json data
{
  "schema": "plan/1",
  "id": "E10",
  "title": "Release mecânico por código",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ nem a estratégia; sem bump de versão; sem push; nunca tocar em main nem em D:/projects/claude-play.",
    "Nunca editar size.test.mjs nem MAX_WORKFLOW_CHARS (DEC-647); medir workflowChars depois de cada edição de roadmap-release.js; limite 239898 em T5 e T6, nenhuma edição acima de 250000; tarefa acima do limite não commita e devolve BLOCKED com o déficit.",
    "Cada check roda sozinho na sua chamada, sem pipe nem encadeamento; vermelho e verde são duas chamadas do mesmo comando.",
    "Nenhuma asserção de flow.test.mjs é apagada; nenhum teste sai de flow.test.mjs; recordVerdict, a chamada -read, docs e docs-measure ficam como hoje.",
    "verify-run.mjs roda só node e git por execFileSync sem shell; donotHolds continua num agente.",
    "Execução comportamental com subagent é do orquestrador da sessão principal (DEC-204); sem relatório fictício."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Mapa das asserções (R15) e medida de ANTES",
      "deps": [],
      "files": { "create": ["docs/plans/evolucao-skills-E10/assertion-map.md"], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": ["assertion-map.md: linha | teste | destino, mais ANTES e o roteiro medido em 3a1d3de"],
      "consumes": [],
      "covers": ["AC3"],
      "testFirst": { "exempt": "documento de mapeamento e medida; o caso temporário não é commitado" },
      "checks": [{ "cmd": "node -e \"process.exit(require('fs').readFileSync('docs/plans/evolucao-skills-E10/assertion-map.md','utf8').includes('ANTES') ? 0 : 1)\"", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Subcomando discover",
      "deps": [1],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"], "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 0 },
      "produces": ["discoverRoadmap({ repo, roadmap, ref, base, today, prefix }) -> data", "node preflight.mjs discover --repo <r> [--roadmap <p>] [--ref <t>] [--base <b>] [--today <d>] --prefix <x> --nonce <n> -> { tool: 'release-discovery', nonce, digest, data }"],
      "consumes": [{ "task": 1, "sig": "assertion-map.md: linha | teste | destino, mais ANTES e o roteiro medido em 3a1d3de" }],
      "covers": ["AC1", "C5"],
      "testFirst": true,
      "checks": [{ "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "verify-run.mjs (group e check)",
      "deps": [1],
      "files": { "create": ["plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs"], "modify": [], "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 0 },
      "produces": ["node verify-run.mjs group <carga> -> { tool: 'verify-run', mode: 'group', nonce, steps: [{ n, exit, out }], stopped, commit, head, digest }", "node verify-run.mjs check <carga> -> { tool: 'verify-run', mode: 'check', nonce, ok, divergences, truth, digest }", "export truthDivergences(truth, slim, claims, target, lastGood, integBroken)"],
      "consumes": [],
      "covers": ["AC2", "AC3", "C1", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Agente script-runner",
      "deps": [],
      "files": { "create": ["plugins/productivity-tools/agents/script-runner.md"], "modify": ["plugins/productivity-tools/README.md"], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": ["agent productivity-tools:script-runner -> { exit, stdout }"],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "arquivo de agente em prosa; conferido pelo lint G5 e pelos casos de T5 e T6" },
      "checks": [{ "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Descoberta pelo script no workflow",
      "deps": [2, 4],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["checkRun(stdout, tool, nonce) -> { ok, data } | { ok: false, why }", "encArg(obj) -> string", "S_RUN = { exit, stdout }"],
      "consumes": [{ "task": 2, "sig": "node preflight.mjs discover --repo <r> [--roadmap <p>] [--ref <t>] [--base <b>] [--today <d>] --prefix <x> --nonce <n> -> { tool: 'release-discovery', nonce, digest, data }" }, { "task": 4, "sig": "agent productivity-tools:script-runner -> { exit, stdout }" }],
      "covers": ["AC1", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239898 ? 0 : 1\"", "expect": "exit 0 (até 239898; acima: BLOCKED com o déficit, sem commit)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Registro agrupado e verificação no relatório",
      "deps": [3, 5],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["recordStatus: grupo no script-runner, results.runs dos steps confirmados", "report: schema { report, truthStdout }"],
      "consumes": [{ "task": 3, "sig": "node verify-run.mjs group <carga> -> { tool: 'verify-run', mode: 'group', nonce, steps: [{ n, exit, out }], stopped, commit, head, digest }" }, { "task": 3, "sig": "node verify-run.mjs check <carga> -> { tool: 'verify-run', mode: 'check', nonce, ok, divergences, truth, digest }" }, { "task": 5, "sig": "checkRun(stdout, tool, nonce) -> { ok, data } | { ok: false, why }" }],
      "covers": ["AC2", "AC3", "C1", "C2", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239898 ? 0 : 1\"", "expect": "exit 0 (até 239898; acima: BLOCKED com o déficit, sem commit)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "Documentação e gates",
      "deps": [6],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/references/config.md", "plugins/productivity-tools/skills/roadmap-release/references/operator.md", "plugins/productivity-tools/skills/roadmap-release/SKILL.md"], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [{ "task": 6, "sig": "report: schema { report, truthStdout }" }],
      "covers": [],
      "testFirst": { "exempt": "texto de referência; os gates conferem o conjunto" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Teste comportamental pelo orquestrador",
      "deps": [7],
      "files": { "create": ["docs/reports/2026-11-13-E10-release-mecanico-comportamental.md"], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [{ "task": 4, "sig": "agent productivity-tools:script-runner -> { exit, stdout }" }],
      "covers": [],
      "testFirst": { "exempt": "execução comportamental do orquestrador (DEC-204), sem código" },
      "checks": [{ "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-13-E10-release-mecanico-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "external": false, "externalDedupe": null, "blq": null }
  ],
  "rulings": [
    {
      "id": "R16",
      "question": "Como a carga chega a verify-run.mjs pela linha de comando?",
      "decision": "encodeURIComponent do JSON, com !'()* também em %XX, num único argumento sem aspas; o script decodifica com decodeURIComponent; o limite de 28000 caracteres vale sobre a carga codificada.",
      "basis": "A spec deixa a codificação ao plano; o workflow já usa encodeURIComponent e não tem Buffer nem btoa; o resultado só tem [A-Za-z0-9-_.~%], sem metacaractere de shell.",
      "alternative": "JSON entre aspas simples com shq.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R17",
      "question": "Como medir ANTES em 3a1d3de?",
      "decision": "A T1 acrescenta em flow.test.mjs um caso temporário com o roteiro do caminho sem falhas de um entregável de uma tarefa (exec do teste da linha 209), imprime calls.length, anota número e roteiro no mapa e desfaz o caso sem commit; a T6 fixa ANTES no teste com comentário que cita 3a1d3de.",
      "basis": "Spec, critério 3 e Deixado para o plano; os arquivos do plugin não mudaram desde 3a1d3de; exec não é exportado.",
      "alternative": "Contar as chamadas lendo o código.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R18",
      "question": "Que caminho WORKFLOW_SCRIPTS dá a preflight.mjs e verify-run.mjs?",
      "decision": "<raiz do plugin>/skills/roadmap-release/scripts/<nome>, ao lado de roadmap.mjs (pasta do tracker) e dos scripts de <raiz do plugin>/scripts.",
      "basis": "Spec, seção O portador; o mapa de caminhos de preflight.mjs (422-424) só conhece roadmap.mjs e <raiz>/scripts.",
      "alternative": "Mover os scripts para <raiz do plugin>/scripts.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R19",
      "question": "tools/measure/session-metrics.mjs muda com os rótulos novos?",
      "decision": "Não: a classificação de discovery e git-truth fica como está; discovery-donot não existe no cenário fixo de medição.",
      "basis": "A spec não põe tools/measure no escopo; excesso de escopo é defeito; R7 da spec.",
      "alternative": "Acrescentar discovery-donot à classificação.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R20",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Oito tarefas: mapa e ANTES; discover; verify-run; agente; descoberta no workflow; registro e relatório no workflow; documentação e gates; comportamental do orquestrador, que sem subagent devolve NEEDS_HUMAN.",
      "basis": "Spec, Deixado para o plano (mapa primeiro, scripts antes da ligação); até quatro arquivos por tarefa; DEC-204.",
      "alternative": "Uma tarefa única para todo o roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
