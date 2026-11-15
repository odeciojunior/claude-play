# Plano E32 -- Triagem do backlog do executor

**Roadmap:** docs/plans/roadmap-pos-2-2-0/

**Spec:** `docs/plans/pos-2-2-0-E32/spec.md`. Worktree `D:/projects/claude-play-wt/E32`, branch `feat/E32`, criada da release `release/pos-2.2.0` (ponta `96d36e3` com a spec). Todas as tarefas rodam nesse worktree, antes do merge; nenhuma precisa do merge, da branch alvo nem do worktree de integração. Nenhuma tarefa precisa de navegador nem de servidor (faixa de portas 5210-5219 sem uso; o teste de ponta a ponta de `procs` sobe só um processo Node filho, sem porta, e o encerra). Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main`, na branch de release nem em `D:/projects/claude-play`, sem bump de versão nem README (E33), sem editar `docs/plans/roadmap-pos-2-2-0/` nem `docs/plans/roadmap-evolucao-skills/`. Nenhuma trava configurada; nenhuma tarefa usa trava. Commits de tarefa começam com `E32 T<n>:` e terminam com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`; o chamador comita. Um comando simples por chamada (sem heredoc, laço, `&&` nem `;`); temporários só em `D:/projects/claude-play-wt/_tmp/E32-<rótulo>/`, apagados no fim.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs` (309 linhas): cabeçalho com os modos `group`, `read` e `check`; `REQUIRED` (~269-273); `cli(argv)` (~275-305) com a recusa `usage: node verify-run.mjs group|read|check <payload: encodeURIComponent(JSON)>`, a conferência do `digest`, o marcador só no modo `group` e a saída assinada por `signDigest`. Testes em `scripts/verify-run.test.mjs` (477 linhas; auxiliar `enc` na linha 15).
- `skills/roadmap-release/workflow/roadmap-release.js` (243.540 caracteres em LF; teto `MAX_WORKFLOW_CHARS = 250000` em `size.test.mjs`): linha 2068, prompt `CLEANUP of deliverable ${E}: end processes whose command contains "${wt}" or that listen on the ports ${port}-${port + 9}; ...`; `encArg` (~1288), `RUN_TAG = fnv1a(RUN_TOKEN)` (~1460), `VERIFY_RUN` (~1461) e os nonces `${RUN_TAG}:${E}:read<n>`, `${RUN_TAG}:${E}:<status>:<k>` e `${RUN_TAG}:check`. Os testes de limpeza em `flow.test.mjs` (~247, ~440, ~558, ~924) conferem `_tmp`, `-dirty`, `diff --binary HEAD` e caminhos entre aspas, não o texto de processos.
- `skills/plan-coordinator/workflow/coordinator.js`: `const reports = new Map()` (~1123) só em memória; `reviewPrompt(s, rep)` (~1261-1275) manda `Summary: (no summary)` e `(no checks reported)` quando `rep` falta, o que acontece com um passo `review-owed` retomado (~1455 `reports.get(s.n)`); `agents/task-reviewer.md` linhas 30-31: só um resumo que diga que a tarefa foi retomada livra a falta de checks de virar defeito. Teto próprio `MAX_COORDINATOR_CHARS = 120000` (77.789 bytes hoje).
- `agents/plan-author.md` linha 40: diz que `emit` imprime `{tool, schema, path, data}`; `scripts/plan-tool.mjs` `leanEmit` imprime `{ tool, schema, path, source, plan, digest }` (DEC-640). Teste de texto vizinho: `skills/plan-writer/adoption-text.test.mjs`.
- `skills/roadmap-tracker/SKILL.md` linha 50 (consulta só de leitura) não cita `--deliverable`; o uso do CLI (`roadmap.mjs` linha 51) aceita `status [--deliverable E<n>]`. Orçamento de prosa: maior carga 26.108 de `TARGET_LF = 29096` (`scripts/prose-budget.test.mjs`).
- Fontes da triagem: `docs/plans/roadmap-evolucao-skills/state.md` linhas 57-75 (17 pendentes, SRC-02) e `docs/reports/2026-11-13-pendencias-por-entregavel.md` (30 notas: E11 12, Gate DEC-458 6, E12 3, E13 2, E28 ou próxima edição 7; SRC-03).
- Pré-leitura de notas: a nota 4 de SRC-02 (prefixo `cd <dir> &&` e `||` no `implementer.md`) já está resolvida no texto atual (linhas 17, 27 e 44); a nota do `BASH_ONLY` em `runPrompt` (~1458) e a da descoberta repetida 5 vezes (`readDisc` ~1483) seguem válidas, mas mexem em `roadmap-release.js` fora da linha de limpeza e em testes de `flow.test.mjs` que hoje afirmam o comportamento atual (~3550 e ~770-790).

## Tarefas

### Tarefa 1: Modo procs no verify-run.mjs

Arquivos: `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`; teste `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`.

Teste primeiro em `verify-run.test.mjs` (nomes com o prefixo `E32 procs:`):

- `E32 procs: parsers read fixed outputs`: `parseCimProcs` sobre um JSON fixo do `Get-CimInstance` (objeto único e lista; `CommandLine` nulo vira `''`), `parsePs` sobre linhas `pid ppid args` com espaços à esquerda, `parseNetstatListen` sobre linhas `TCP 0.0.0.0:5212 0.0.0.0:0 LISTENING 4242` e `TCP [::]:5213 [::]:0 LISTENING 4243` (só `LISTENING` conta), `parseLsofListen` sobre a saída de `lsof -nP -iTCP -sTCP:LISTEN` (porta do campo `NAME`, `*:5214 (LISTEN)`); cada um devolve `[{ pid, ppid, cmd }]` ou `[{ pid, port }]`.
- `E32 procs: selectProcs matches the worktree path followed by a boundary` (C1): com `platform: 'win32'` e `wt: 'D:/x/E3'`, casa `node d:\x\e3\server.js`, `node "D:/projects/claude-play-wt/E3"`, `node D:/projects/claude-play-wt/E3/server.js` (com wt `D:/projects/claude-play-wt/E3`) e o caminho no fim do texto; não casa `node D:/projects/claude-play-wt/E32/server.js` nem `node D:/x/E32/server.js`; com `platform: 'linux'` a caixa conta (`/x/e3` não casa wt `/x/E3`); wt com barra final é normalizado.
- `E32 procs: selectProcs matches listeners inside the port range only`: porta `lo`, `hi` e uma do meio casam com `why` de porta; `lo - 1` e `hi + 1` não.
- `E32 procs: selectProcs never picks itself or its ancestors` (C2): o próprio pid e a cadeia `ppid` até a raiz (com o caminho do worktree na linha de comando e escutando numa porta da faixa) ficam de fora; um irmão com o caminho casa.
- `E32 procs: refuses a payload without wt or with invalid ports`: pela CLI, payload assinado sem `wt`, com `wt: ''`, `ports: [5210]`, `ports: [5210, 'x']` e `ports: [5210.5, 5219]` sai 2 com `the procs payload is missing a required field` e não encerra nada.
- `E32 procs: a missing listing goes to unchecked and the command still succeeds` (C3): `runProcs(p, { platform: 'linux', run, kill })` com `run` falso que devolve `{ error: { code: 'ENOENT' } }` para `lsof` e uma saída fixa para `ps` devolve `unchecked` com um texto que cita `lsof`, `matched` só pelos processos do `ps`, e não lança; o mesmo para `powershell.exe` e `netstat` com `platform: 'win32'`.
- `E32 procs: end to end ends a child whose command line carries the worktree`: `mkdtempSync` em `os.tmpdir()`; sobe com `spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', dir])` um filho; pega uma porta livre (servidor `net` em porta 0, lê a porta e fecha) e roda `node verify-run.mjs procs <payload>` com `{ nonce, wt: dir, ports: [p, p] }` assinado; confere exit 0, `mode: 'procs'`, o pid do filho em `ended` e em `matched` com `why` de caminho, o evento `exit` do filho em até 10 s, e o `digest` da saída. O filho é encerrado no `finally` se ainda vivo, e a pasta apagada.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e relatar a falha.

Implementar em `verify-run.mjs`, sem mudar `group`, `read` e `check`:

- `REQUIRED.procs = (p) => typeof p.wt === 'string' && p.wt && Array.isArray(p.ports) && p.ports.length === 2 && p.ports.every(Number.isInteger)`; sem marcador (encerrar é idempotente).
- Exportar `parseCimProcs(text)`, `parsePs(text)`, `parseNetstatListen(text)`, `parseLsofListen(text)`, `selectProcs(procs, listens, { wt, ports, self, platform })` (devolve `[{ pid, why, cmd }]`, com `why` `path` ou `port <n>` e `cmd` cortado em 200 caracteres; fronteira depois do caminho: fim do texto, `/`, `\`, `"`, `'` ou espaço em branco; barras normalizadas e sem caixa no win32) e `runProcs(p, { platform = process.platform, run = spawnSync, kill } = {})`, que lista com `run` (win32: `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"` e `netstat -ano -p tcp`; demais: `ps -eo pid=,ppid=,args=` e `lsof -nP -iTCP -sTCP:LISTEN`), põe em `unchecked` cada listagem que não rodou, chama `selectProcs` com `self: process.pid` e encerra cada escolhido (`taskkill /PID <pid> /T /F` no win32, `process.kill(pid, 'SIGTERM')` nos demais; `kill` injetável no teste), e devolve `{ tool, mode: 'procs', nonce, matched, ended, failed: [{ pid, error }], unchecked }`.
- `cli` despacha `procs` para `runProcs`; a recusa de uso passa a `usage: node verify-run.mjs group|read|check|procs <payload: encodeURIComponent(JSON)>`; o cabeçalho ganha as linhas do modo (`procs payload: { nonce, digest, wt, ports: [lo, hi] }` e a saída).

Rodar o teste até passar. Commit `E32 T1: modo procs no verify-run lista e encerra processos do entregável`.

### Tarefa 2: Limpeza do release pelo procs

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; criar teste `plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs`. Depende da Tarefa 1.

Teste primeiro em `cleanup.test.mjs` (arquivo novo, fora dos testes que E29 altera), `E32: the cleanup prompt ends processes through verify-run procs`: lê `roadmap-release.js`, isola a linha que contém `CLEANUP of deliverable`, confere que ela contém `node "${VERIFY_RUN}" procs ${encArg({`, `wt`, `ports: [port, port + 9]`, `` nonce: `${RUN_TAG}:${E}:procs` ``, `leftovers`, `failed` e `unchecked`, e que não contém `end processes whose command contains`; confere também que o resto do prompt continua (`worktree remove --force`, `-dirty`, `diff --binary HEAD`). Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs` e relatar a falha.

Implementar só na linha do prompt `CLEANUP of deliverable ${E}`: o trecho `end processes whose command contains "${wt}" or that listen on the ports ${port}-${port + 9};` passa a `run once: node "${VERIFY_RUN}" procs ${encArg({ nonce: `${RUN_TAG}:${E}:procs`, wt, ports: [port, port + 9] })} and put in leftovers each pid of its failed and each item of its unchecked;`. O resto do prompt, `S_CLEAN`, o preflight e qualquer outra linha não mudam. Rodar `cleanup.test.mjs`, `flow.test.mjs` e `size.test.mjs`. Conferir com `git -C D:/projects/claude-play-wt/E32 diff --stat` que só os dois arquivos mudaram. Commit `E32 T2: limpeza do release encerra processos pelo verify-run procs`.

### Tarefa 3: Revisão de passo retomado no coordinator

Arquivos: `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`; teste `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`.

Nota corrigida: item 11 de SRC-02 (a retomada `review-owed` do coordinator manda `(no checks reported)` sem marca de retomada).

Teste primeiro em `flow.test.mjs`, `E32: a review-owed step resumed without its report tells the reviewer it was resumed`: com `withSandbox` e `makeSim`, uma 1ª execução termina com um passo em `review-owed` (o revisor não volta, ou a execução para depois do relatório); uma 2ª execução com `resumeArgs` despacha `T<n>:review1` cujo prompt contém `resumed from a previous run` e não contém `Summary: (no summary)`; numa execução sem retomada o prompt de revisão continua com o resumo do implementador. Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` e relatar a falha.

Implementar em `reviewPrompt(s, rep)`: quando `rep` falta, a linha passa a `Summary: resumed from a previous run: the implementer report of this step was lost with that run; run the step verification commands from the plan yourself`; com `rep` sem `summary` continua `(no summary)`. Nada mais muda. Rodar `flow.test.mjs`, `size.test.mjs` e `gate.test.mjs` da pasta. Commit `E32 T3: coordinator marca a revisão de passo retomado`.

### Tarefa 4: plan-author descreve o emit enxuto

Arquivos: `plugins/productivity-tools/agents/plan-author.md`; teste `plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs`.

Nota corrigida em parte: nota 3 da seção E28 de SRC-03 (`plan-author.md:40 descreve o emit com data em vez de plan`).

Teste primeiro em `adoption-text.test.mjs`, `E32: plan-author step 7 describes the lean emit`: a linha que começa com `7. Your last message` contém `{tool, schema, path, source, plan, digest}` e não contém `path, data}`. Rodar `node --test plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs` e relatar a falha.

Implementar na linha 40: `(the JSON {tool, schema, path, data})` passa a `(the compact JSON {tool, schema, path, source, plan, digest})`, com os mesmos acentos graves. Frontmatter e o resto sem mudança. Rodar o teste, `scripts/independence.test.mjs` e G5. Commit `E32 T4: plan-author descreve o emit enxuto`.

### Tarefa 5: Tracker cita status --deliverable

Arquivos: `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`; teste `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`.

Nota corrigida em parte: item 8 de SRC-02 (`SKILL.md e references do tracker não citam --deliverable`).

Teste primeiro, no fim de `roadmap.test.mjs`, `E32: SKILL.md names status --deliverable for one card`: lê `../SKILL.md` e confere que a linha `Read-only query` contém `roadmap.mjs status "<folder>" --deliverable E<n>`. Rodar `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` e relatar a falha.

Implementar na linha 50: depois de `` `roadmap.mjs status "<folder>"` `` acrescentar `` (one card's panel row: `roadmap.mjs status "<folder>" --deliverable E<n>`) ``. Nada mais muda. Rodar o teste e `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs`. Commit `E32 T5: tracker cita status --deliverable`.

### Tarefa 6: Relatório de triagem

Arquivos: criar `docs/reports/2026-11-15-E32-triagem-backlog.md`. Depende das Tarefas 1 a 5 (cita os hashes dos seus commits, lidos com `git -C D:/projects/claude-play-wt/E32 log --oneline -8`).

Relatório em português com duas tabelas (SRC-02 na ordem do `state.md` anterior, ids `S2-01` a `S2-17`; SRC-03 na ordem das seções `E11`, `Gate DEC-458`, `E12`, `E13`, `E28 ou próxima edição do release workflow`, ids `S3-01` a `S3-30`) com as colunas `Id | Nota (início literal, até 120 caracteres) | Situação | Prova`, e um quadro final que soma `obsoleta`, `corrigida` e `pendente` e confere 47. Cada nota é conferida contra o código atual do worktree e contra `log.md` e `decisions.md` de `docs/plans/roadmap-evolucao-skills/` (só leitura). Situação e prova seguem a spec: `obsoleta` com hash, DEC do log anterior, ou arquivo e linha; `corrigida` com o hash em `feat/E32` e o teste; `pendente` com dono (executor, dono ou E29, E30, E31, E33) e destino (card deste roadmap ou roadmap futuro). Fixos por este plano: S2-06 e S2-07 obsoletas citando as linhas S3 que consomem; S2-13 corrigida pelo commit de T1 e T2 (testes `E32 procs: ...` e `E32: the cleanup prompt ends processes through verify-run procs`); S2-11 corrigida pelo commit de T3; S2-08 e a nota 3 da seção E28 de SRC-03 seguem R9 com os commits de T5 e T4; S2-17 e as notas sobre revisão única, laço quality, revisor sonnet e parada-retomada com dono E29, E30 ou E31 (C5); notas do arnês `tools/measure` seguem R5; nota válida e pequena fora das Tarefas 1 a 5 e nota que exige arquivo que E29 altera ficam pendentes com dono executor e destino roadmap futuro (R7, R8); nota grande, pendente com dono (C4). Nenhuma nota corrigida sem commit nem obsoleta sem prova. Sem teste novo (documento); conferir as contagens pelos checks abaixo. Commit `E32 T6: relatório de triagem do backlog`.

### Tarefa 7: Gates

Sem arquivos e sem commit. Roda no worktree `D:/projects/claude-play-wt/E32` depois das Tarefas 1 a 6: G1 `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (cerca de 207 s; é também a evidência de AC2), os testes de tamanho dos dois workflows, G2, G3, G4 e G5. Linha de base da release: tudo exit 0, G1 com 2175 testes e 2 pulados; qualquer falha é desta branch e volta à tarefa dona do arquivo; nunca editar `size.test.mjs`, `MAX_WORKFLOW_CHARS` nem um gate. Evidência aceitável se um gate não puder rodar neste ambiente (por exemplo, `claude` ausente): a saída literal e o motivo, sem resultado inventado. No fim, `git -C D:/projects/claude-play-wt/E32 status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`) e a pasta `_tmp/E32-*` apagada.

## Evidência dos critérios

| Critério | Tipo | Comando ou ato | testRef |
|---|---|---|---|
| AC1 | human | O dono confere `docs/reports/2026-11-15-E32-triagem-backlog.md` (H1), depois do merge | relatório da Tarefa 6 |
| AC2 | test | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (comando do `{verify}` do critério, mantido) | `E32 procs: ...` (`verify-run.test.mjs`), `E32: the cleanup prompt ends processes through verify-run procs`, `E32: a review-owed step resumed without its report tells the reviewer it was resumed`, `E32: plan-author step 7 describes the lean emit`, `E32: SKILL.md names status --deliverable for one card` |

O comando de AC2 só lê e escreve arquivos do worktree e temporários do sistema (o teste de ponta a ponta encerra só o filho que ele mesmo sobe): não externo. G2 a G5 rodam na Tarefa 7.

## Decisões do plano

- R6: sete tarefas na ordem procs, limpeza, coordinator, plan-author, tracker, relatório e gates.
- R7: quatro correções nesta branch, contando a de `procs` (dentro do teto de oito de R4).
- R8: nenhum arquivo que E29 altera é tocado, exceto a linha do prompt de limpeza.
- R9: nota com várias partes só é corrigida quando toda parte está corrigida ou obsoleta com prova.
- R10: nonce `${RUN_TAG}:${E}:procs`; `runProcs` com listagem e encerramento injetáveis; porta livre no teste de ponta a ponta.
- R11: nenhuma tarefa precisa de navegador, servidor, trava ou efeito externo.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E32",
  "title": "Triagem do backlog do executor",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-2-0/",
  "constraints": [
    "Não editar docs/plans/roadmap-pos-2-2-0/ nem docs/plans/roadmap-evolucao-skills/; não mudar docs/releases/, relatórios antigos de docs/reports/ nem o state.md do roadmap anterior.",
    "Não tocar nos arquivos que E29 altera (roadmap-release.js fora da linha do prompt de limpeza, flow.test.mjs, review.test.mjs e prompts.test.mjs do release, preflight.mjs, preflight.test.mjs, task-reviewer.md, references/config.md, tools/measure/).",
    "Não mudar formatos de plano ou de estado, portões canônicos, size.test.mjs nem MAX_WORKFLOW_CHARS; sem execução paga nem lote de medição.",
    "Não marcar nota como corrigida sem commit nem como obsoleta sem prova; dono só executor, dono ou um card (E29, E30, E31, E33).",
    "Sem bump de versão nem README (E33); sem push; nunca tocar em main, na branch de release nem no worktree D:/projects/claude-play.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;; temporários só em D:/projects/claude-play-wt/_tmp/E32-<rótulo>/.",
    "Commits de tarefa começam com \"E32 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash; o chamador comita."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Modo procs no verify-run.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "node verify-run.mjs procs <payload { nonce, digest, wt, ports: [lo, hi] }> -> { tool, mode: 'procs', nonce, matched: [{ pid, why, cmd }], ended: [pid], failed: [{ pid, error }], unchecked: [texto], digest }",
        "export function selectProcs(procs, listens, { wt, ports, self, platform })",
        "export function runProcs(p, { platform, run, kill })",
        "export function parseCimProcs(text), parsePs(text), parseNetstatListen(text), parseLsofListen(text)"
      ],
      "consumes": [],
      "covers": ["AC2", "C1", "C2", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Limpeza do release pelo procs",
      "deps": [1],
      "files": {
        "create": ["plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs"],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["prompt CLEANUP of deliverable ${E} roda node \"${VERIFY_RUN}\" procs ${encArg({ nonce: `${RUN_TAG}:${E}:procs`, wt, ports: [port, port + 9] })} e põe failed e unchecked em leftovers"],
      "consumes": [
        { "task": 1, "sig": "node verify-run.mjs procs <payload { nonce, digest, wt, ports: [lo, hi] }> -> { tool, mode: 'procs', nonce, matched: [{ pid, why, cmd }], ended: [pid], failed: [{ pid, error }], unchecked: [texto], digest }" }
      ],
      "covers": ["AC2", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Revisão de passo retomado no coordinator",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["reviewPrompt(s, rep) sem rep manda Summary: resumed from a previous run: the implementer report of this step was lost with that run; run the step verification commands from the plan yourself"],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "plan-author descreve o emit enxuto",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/agents/plan-author.md"],
        "test": ["plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": ["agents/plan-author.md passo 7: emit imprime {tool, schema, path, source, plan, digest}"],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/scripts/independence.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Tracker cita status --deliverable",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-tracker/SKILL.md"],
        "test": ["plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": ["roadmap-tracker/SKILL.md cita roadmap.mjs status \"<folder>\" --deliverable E<n> na consulta só de leitura"],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/scripts/prose-budget.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Relatório de triagem",
      "deps": [1, 2, 3, 4, 5],
      "files": {
        "create": ["docs/reports/2026-11-15-E32-triagem-backlog.md"],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 2, "reasoning": 2, "blast": 0, "verifiability": 1 },
      "produces": ["docs/reports/2026-11-15-E32-triagem-backlog.md com 47 linhas S2-01..S2-17 e S3-01..S3-30, situação e prova, e quadro que soma 47"],
      "consumes": [
        { "task": 2, "sig": "prompt CLEANUP of deliverable ${E} roda node \"${VERIFY_RUN}\" procs ${encArg({ nonce: `${RUN_TAG}:${E}:procs`, wt, ports: [port, port + 9] })} e põe failed e unchecked em leftovers" },
        { "task": 3, "sig": "reviewPrompt(s, rep) sem rep manda Summary: resumed from a previous run: the implementer report of this step was lost with that run; run the step verification commands from the plan yourself" },
        { "task": 4, "sig": "agents/plan-author.md passo 7: emit imprime {tool, schema, path, source, plan, digest}" },
        { "task": 5, "sig": "roadmap-tracker/SKILL.md cita roadmap.mjs status \"<folder>\" --deliverable E<n> na consulta só de leitura" }
      ],
      "covers": ["AC1", "C4", "C5"],
      "testFirst": { "exempt": "documento de triagem; as contagens são conferidas pelos checks e o conteúdo pelo dono (H1)" },
      "checks": [
        { "cmd": "grep -cE \"^\\| S[23]-[0-9]{2} \\|\" docs/reports/2026-11-15-E32-triagem-backlog.md", "expect": "47" },
        { "cmd": "grep -cE \"^\\| S[23]-[0-9]{2} \\|.*\\| (obsoleta|corrigida|pendente) \\|\" docs/reports/2026-11-15-E32-triagem-backlog.md", "expect": "47" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "Gates",
      "deps": [1, 2, 3, 4, 5, 6],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": { "exempt": "só roda os gates; não muda arquivo" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1, evidência AC2)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid", "expect": "exit 0 (G4)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "human",
      "command": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R6",
      "question": "Em que ordem e com que dependências as tarefas rodam?",
      "decision": "procs (T1), limpeza (T2, depende de T1), coordinator (T3), plan-author (T4), tracker (T5), relatório (T6, depende de T1 a T5 porque cita os hashes) e gates (T7, depende de todas).",
      "basis": "Spec, seção Deixado para o plano (procs, prompt de limpeza, uma tarefa por correção, relatório por último, G1 a G5 na final).",
      "alternative": "Relatório primeiro, com as correções escolhidas depois dele.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Quais correções pequenas entram nesta branch?",
      "decision": "Quatro, contando a de procs: procs com a limpeza (S2-13), revisão de passo retomado no coordinator (S2-11), emit enxuto no plan-author (parte da nota 3 da seção E28 de SRC-03) e status --deliverable no SKILL.md do tracker (parte de S2-08). Outra nota válida e pequena achada na Tarefa 6 fica pendente com dono executor e destino roadmap futuro, sem correção nesta branch.",
      "basis": "R2 e R4 da spec; pré-leitura das 47 notas contra o código atual; arquivos fora dos que E29 altera.",
      "alternative": "Deixar a Tarefa 6 escolher até oito correções e acrescentar tarefas durante a execução.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "As notas válidas e pequenas do release workflow (BASH_ONLY em runPrompt, descoberta repetida 5 vezes, nome do teste E10 AC3 com 28000) entram?",
      "decision": "Não: ficam pendentes com dono executor e destino roadmap futuro (próxima edição de roadmap-release.js), porque exigem linhas de roadmap-release.js fora do prompt de limpeza ou testes de flow.test.mjs, que E29 altera.",
      "basis": "Spec, Riscos: a única linha tocada em roadmap-release.js é o prompt de limpeza e o teste novo fica em arquivo próprio; spec, O que não fazer (linhas de E29).",
      "alternative": "Corrigir as três nesta branch, aceitando conflito de merge com E29.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Que situação recebe uma nota com várias partes das quais só uma é corrigida?",
      "decision": "corrigida só quando toda parte está corrigida nesta branch ou obsoleta com prova; senão pendente com dono e destino da parte que resta, e a prova cita o commit e o teste da parte corrigida.",
      "basis": "Spec: uma situação por nota e nada marcado corrigido sem commit; S2-08 e a nota 3 da seção E28 de SRC-03 têm partes fora de R7.",
      "alternative": "Dividir a nota em sublinhas, o que muda a soma de 47.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Qual o nonce do payload procs, como testar a falta de uma listagem e que porta usa o teste de ponta a ponta?",
      "decision": "Nonce `${RUN_TAG}:${E}:procs`; runProcs(p, { platform, run, kill }) com listagem e encerramento injetáveis para o teste de unchecked; o teste de ponta a ponta usa uma porta livre obtida no próprio teste (servidor em porta 0, fechado antes do comando), nunca uma faixa fixa.",
      "basis": "Spec deixa o formato do nonce e os nomes dos testes ao plano; nonces atuais derivam de RUN_TAG e do entregável; uma faixa fixa poderia encerrar o servidor de outro entregável quando G1 roda em outro worktree.",
      "alternative": "Nonce com o RUN_TOKEN cru e o teste com a faixa 5210-5219 do entregável.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Alguma tarefa precisa de navegador, servidor, trava ou efeito externo?",
      "decision": "Não: todas rodam no worktree D:/projects/claude-play-wt/E32 e só leem e escrevem arquivos dele e temporários; o teste de ponta a ponta encerra só o filho que sobe; se um gate não puder rodar, a evidência aceitável é a saída literal e o motivo.",
      "basis": "Spec sem efeitos externos (externalEffects vazio); nenhuma trava configurada.",
      "alternative": "Nenhuma.",
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
      "what": "O dono confere o relatório de triagem docs/reports/2026-11-15-E32-triagem-backlog.md (critério AC1).",
      "why": "AC1 é verify human: só o dono aceita a situação de cada nota.",
      "blocking": false,
      "workaround": "O executor entrega o relatório e as correções; a aceitação fica para o dono depois do merge."
    }
  ]
}
```
