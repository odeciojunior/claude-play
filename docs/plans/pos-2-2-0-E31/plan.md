# Plano E31 -- Origem da correção extra em parada-retomada

**Roadmap:** docs/plans/roadmap-pos-2-2-0/

**Spec:** `docs/plans/pos-2-2-0-E31/spec.md`. Worktree `D:/projects/claude-play-wt/E31`, branch `feat/E31` (ponta `759d017` com a spec). Todas as tarefas rodam nesse worktree, antes do merge; nenhuma precisa do merge, da branch alvo `release/pos-2.2.0` nem do worktree de integração. Este plano entrega só a peça "Correção no produto" (instrução do dono de 2026-11-17, DEC-025, pequena pela DEC-012): as execuções pagas e o relatório `docs/reports/2026-11-17-E31-parada-retomada.md` já existem e não são refeitos. Produto só em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; testes só em `workflow/flow.test.mjs` (nenhum teste de `prompts.test.mjs` cita o texto de `R_LOAD` nem o do commit, por isso ele não muda). Nenhuma tarefa precisa de navegador, servidor (faixa 5200-5209 sem uso), trava (nenhuma configurada) ou efeito externo: sem push, sem execução paga, sem bump de versão, sem tocar em `main`, na branch de release, em `D:/projects/claude-play` nem em `docs/plans/roadmap-pos-2-2-0/`. Commits de tarefa começam com `E31 T<n>:` e terminam com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`; o chamador comita. Um comando simples por chamada (sem heredoc, laço, `&&` nem `;`); temporários só em `D:/projects/claude-play-wt/_tmp/E31-<rótulo>/`, apagados no fim. Se um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando e o motivo, sem resultado inventado.

## Contexto lido

- `roadmap-release.js` (243.223 caracteres em LF; teto `MAX_WORKFLOW_CHARS = 250000` em `size.test.mjs`; a correção inteira soma no máximo 2.500, ou seja, o arquivo fica com no máximo 245.723):
  - `checkSpecLoad(t, E, card)` (linhas ~1151-1165): confere `checkExit`/`emitExit` inteiros (1153) e devolve `checkFailed` para qualquer `checkExit !== 0` (1154), sem olhar o stdout.
  - `S_COMMITTED` (1424): `{ ok, head, commit, blob, error }`, `required: ['ok']`.
  - `R_LOAD` (2170): `... checkStdout and checkExit = 1, emitStdout and emitExit = 2,`, usado pela carga da spec (2196) e do plano (2323).
  - `commitAgent(kind, file, phase, tail)` (2174-2186): passo 3 `git -C "${wt}" diff --cached --quiet -- ${file}` (exit 0 = nada mudou), rótulo `${E}:${kind}-commit`, haiku/low.
  - `load3` (2202-2210): tentativas 1-2 haiku, 3-5 sonnet; `ok` false faz nova tentativa.
  - Commit da spec (2229-2233, `specReused = !cm.commit`), `specSkip` (2237), commit do plano (2378-2381, `planCommitted = !!cm.commit`), `planSkip` (2405). O agente RESTORE (2366-2371) também usa o rótulo `${E}:plan-commit` e `S_COMMITTED`, mas não passa por `commitAgent` e não muda.
- `scripts/spec-tool.mjs` linhas 393-394: `check --json` imprime `{ tool: 'spec-tool', ..., summary: { errors, warnings, exitCode } }`.
- `flow.test.mjs`: mock padrão (199-205) devolve `spec-commit`/`plan-commit` com `commit: 'c1'` e lança `unmocked` para rótulos desconhecidos (`E1:spec-commit2` precisa de mock nos testes novos); `specLoadOk` (93) usa `checkStdout: '{}'`; `RUN_REC` e `recordedSetup` (4678-4679) e o teste `AC1: a resume with every recorded value skips...` (4687) com as notas `spec review skipped`/`plan review skipped`; teste `a failed spec check is a critical issue...` (4227) e `E23 final-fix F2` (4811) com `checkStdout: '{"errors":[...]}'` (sem `tool`, continua `checkFailed`); teste puro `checkSpecLoad separates a failed check from a failed load` (4277); teste do agente de commit (4267); mocks de commit vazio em `FF/I1` (2536-2537) e `F2/I-A` (2644-2645).

## Tarefas

### Tarefa 1: Carga da spec confere o exit code contra o summary.exitCode

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Teste primeiro em `flow.test.mjs`:

- No teste puro `checkSpecLoad separates a failed check from a failed load`, acrescentar, com `checkStdout` igual a `JSON.stringify({ tool: 'spec-tool', schema: 'spec/1', path: 'x', errors: [], warnings: [], summary: { errors: 0, warnings: 0, exitCode: n } })`: `checkExit: 1` com `exitCode: 0` dá `ok` false e `why` casando `/differs from summary\.exitCode 0/`; `checkExit: 0` com `exitCode: 1` dá `ok` false; `checkExit: 1` com `exitCode: 1` dá `ok` true e `checkFailed` true (C1 do lado do acordo); `checkExit: 1` com `checkStdout` `'{"tool":"spec-tool","summary":{}}'` (sem `exitCode` inteiro) segue `checkFailed` (C1).
- `E31 (a): a resume whose spec-load1 misreports checkExit loads again and keeps both reviews skipped`: `exec` com `over: both(recordedSetup(RUN_REC), l => l === 'E1:spec-load1' ? { checkExit: 1, emitExit: 2, checkStdout: <JSON do spec-tool com summary.exitCode 0>, emitStdout: '', head: 'a1', clean: true } : undefined)`; confere `E1:spec-load2` nos rótulos, nenhum rótulo `E1:spec-fix`, nenhum `E1:spec-review`/`E1:plan-review`, as concerns com `spec review skipped` e `plan review skipped`, e `merged` true.
- `E31 (b): a spec check that really failed stays a critical issue for the spec fixer`: igual à retomada de (a), mas `E1:spec-load1` devolve só na primeira chamada `checkExit: 1` com `summary.exitCode: 1` no JSON do spec-tool, e `E1:spec-fix1` devolve `{ specPath: 'x', slug: 'x', decisions: [], humanInputs: [] }`; confere `E1:spec-fix1` nos rótulos e seu prompt casando `/spec-tool check exited 1/`.
- `E31: the load prompts name the exit codes by command, not by value`: num `exec` padrão, os prompts de `E1:spec-load1` e `E1:plan-load1` não contêm `checkExit = 1` nem `emitExit = 2` e contêm `checkExit from command 1` e `emitExit from command 2`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`:

- `checkSpecLoad`: logo depois da linha 1153 e antes de `if (t.checkExit !== 0)`, ler `JSON.parse(String(t.checkStdout))` com erro de parse ignorado; quando o resultado é objeto com `tool === 'spec-tool'` e `summary.exitCode` inteiro diferente de `t.checkExit`, devolver `{ ok: false, why: 'spec-tool check exit <checkExit> differs from summary.exitCode <n> in its stdout' }`. O resto da função não muda. O comentário acima da função ganha, no máximo, meia linha sobre o desacordo.
- `R_LOAD`: `checkStdout and checkExit = 1, emitStdout and emitExit = 2,` passa a `checkStdout and checkExit from command 1, emitStdout and emitExit from command 2,`. As caudas `head = 3...` e `blob = 3..., head = 4...` não mudam (R2 da spec).

Rodar `flow.test.mjs` e `size.test.mjs` até passar. Commit `E31 T1: carga da spec confere checkExit contra summary.exitCode`.

### Tarefa 2: Commit da spec e do plano sem depender de exit code

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Depende da Tarefa 1 (mesmos arquivos).

Teste primeiro em `flow.test.mjs`:

- Teste existente `the commit agent writes the message with Write, commits with -F and only the spec`: passa a conferir também `git -C "/wt/E1" diff --cached --name-only -- docs/plans/x-E1/spec.md`, `git -C "/wt/E1" status --porcelain -- docs/plans/x-E1/spec.md`, a palavra `pending` e a ausência de `--quiet` no prompt de `E1:spec-commit`, e `pending` em `opts.schema.properties`.
- Mocks de commit vazio de `FF/I1` (`E1:spec-commit` e `E1:plan-commit`) e de `F2/I-A` (`reused(true)`) ganham `pending: ''` (R1 da spec).
- `E31 (c): an empty spec commit with the spec still pending is committed again in sonnet`: spec nova (setup padrão), `E1:spec-commit` devolve `{ ok: true, head: 'a1', commit: '', pending: 'A  docs/plans/x-E1/spec.md' }` e `E1:spec-commit2` devolve `{ ok: true, head: 'a2', commit: 'c2', pending: '' }`; confere `E1:spec-commit2` nos rótulos depois de `E1:spec-commit`, com `opts.model` `sonnet`, nenhum rótulo `E1:spec-fix`, `E1:spec-review1` presente e `merged` true.
- `E31 (c): a spec still pending after the second commit fails as infra before the review`: `E1:spec-commit2` também devolve `commit: ''` com o mesmo `pending`; confere `failKind` `infra`, `error` casando `/spec commit: docs\/plans\/x-E1\/spec\.md still pending after an empty commit/`, e nenhum `E1:spec-review1` nem `E1:spec-fix`. Um terceiro caso com `E1:spec-commit` devolvendo `commit: ''` sem `pending` também leva a `E1:spec-commit2` (R1 da spec: ausente não conta como conferido).
- `E31 (d): an empty commit with nothing pending is a legitimate reuse`: `E1:spec-commit` devolve `{ ok: true, head: 'a1', commit: '', pending: '' }`; confere que não há `E1:spec-commit2`, que a entrega não falha (`merged` true) e que não há `E1:spec-fix`.
- `E31 C4: an empty plan commit with the plan pending is committed again as plan-commit2, and fails as infra if it persists`: `E1:plan-commit` devolve `{ ok: true, head: 'a1', commit: '', pending: 'M  docs/plans/x-E1/plan.md' }`; com `E1:plan-commit2` devolvendo `{ ok: true, head: 'a2', commit: 'c2', pending: '' }`, há `E1:plan-commit2` em sonnet e `E1:plan-review1`; com `E1:plan-commit2` também vazio e pendente, `failKind` `infra`, `error` casando `/plan commit: docs\/plans\/x-E1\/plan\.md still pending after an empty commit/` e nenhum `E1:plan-review1`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`:

- `S_COMMITTED` ganha `pending: STR` em `properties` (`required` continua `['ok']`; é schema de agente, não formato de `run.json`).
- `commitAgent(kind, file, phase, tail, k = '', model = 'haiku')`: rótulo `${E}:${kind}-commit${k}`, `model` do parâmetro, `effort` `low` em haiku e `medium` em sonnet. Prompt: passo 3 passa a `git -C "${wt}" diff --cached --name-only -- ${file}   (empty output means nothing changed: do not commit, delete the message file and return ok true with an empty commit)`; passo 4 a `Only when step 3 printed the path: git -C "${wt}" commit -F "${msgFile}"`; o passo 5 pede, depois dos passos, `pending = the output of git -C "${wt}" status --porcelain -- ${file} (empty when clean)`, além de `head` e `commit` como hoje. Nenhum `--quiet`, nenhum `&&` ou `;`.
- Helper `commitChecked(kind, file, phase, tail)`: chama `commitAgent` em haiku; quando o resultado é `ok` com `commit` vazio e `pending` não é string vazia depois de `trim` (texto ou ausente, R1), chama `commitAgent(kind, file, phase, tail, '2', 'sonnet')` (R3); se este também é `ok` com `commit` vazio e `pending` não vazio ou ausente, devolve `{ ok: false, error: '<file> still pending after an empty commit: <pending ou (not measured)>' }`; senão devolve o último resultado.
- O commit da spec (2230) e o do plano (2378) chamam `commitChecked` no lugar de `commitAgent`; os `fail('infra', 'spec commit: ...')` e `fail('infra', 'plan commit: ...')` existentes recebem o `error`. `specReused = !cm.commit` e `planCommitted = !!cm.commit` passam a ler só um resultado conferido.

Rodar `flow.test.mjs` e `size.test.mjs` até passar. Commit `E31 T2: commit da spec e do plano confere o pendente e repete em sonnet`.

### Tarefa 3: Gates e medida de tamanho

Sem arquivos e sem commit. Roda no worktree `D:/projects/claude-play-wt/E31` depois das Tarefas 1 e 2: a medida de tamanho (o comando `node -e` do bloco sai 0 só se `roadmap-release.js` tiver no máximo 245.723 caracteres em LF, isto é, 243.223 + 2.500), `size.test.mjs`, G1 `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (evidência de AC2), G2, G3, G4 e G5. Linha de base da release: tudo exit 0, G1 com 2186 testes e 2 pulados; qualquer falha é desta branch e volta à tarefa dona do arquivo; nunca editar `size.test.mjs`, `MAX_WORKFLOW_CHARS` nem um gate. Conferir com `git -C D:/projects/claude-play-wt/E31 diff --stat 759d017 HEAD` que só `roadmap-release.js` e `flow.test.mjs` mudaram. Se a correção passar de 2.500 caracteres, encurtar texto dentro do desenho; se ainda não couber, a falha fica registrada para o dono (gatilho de DEC-025), sem mudar o teto. No fim, `git -C D:/projects/claude-play-wt/E31 status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`) e a pasta `_tmp/E31-*` apagada.

## Evidência dos critérios

| Critério | Tipo | Comando ou ato | testRef |
|---|---|---|---|
| AC1 | human | O dono confere `docs/reports/2026-11-17-E31-parada-retomada.md` (H1); o relatório já existe e não é tocado | relatório existente |
| AC2 | test | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (comando do `{verify}` do critério, mantido) | `E31 (a)`, `E31 (b)`, `E31: the load prompts name the exit codes by command, not by value`, `E31 (c)` (dois), `E31 (d)`, `E31 C4` e os casos novos de `checkSpecLoad separates a failed check from a failed load` em `flow.test.mjs` |

O comando de AC2 só lê e escreve arquivos do worktree e temporários do sistema: não externo.

## Decisões do plano

- R4: três tarefas, correção 1 (com testes a e b), correção 2 (com testes c e d e o caso do plano) e gates com medida de tamanho, em série porque mexem nos mesmos dois arquivos.
- R5: mensagens e textos exatos: `spec-tool check exit <checkExit> differs from summary.exitCode <n> in its stdout`, `<arquivo> still pending after an empty commit: <pending>`, `checkExit from command 1` / `emitExit from command 2`; a repetição de commit usa `commitAgent` com parâmetros de sufixo e modelo.
- R6: o teto de 2.500 caracteres é conferido por um comando `node -e` com o limite absoluto 245.723 em LF.
- R7: nenhuma tarefa precisa de navegador, servidor, trava ou efeito externo.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E31",
  "title": "Origem da correção extra em parada-retomada",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-2-0/",
  "constraints": [
    "Produto só em plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js (DEC-012); testes só em workflow/flow.test.mjs.",
    "A correção inteira soma no máximo 2.500 caracteres em roadmap-release.js (hoje 243.223 em LF; máximo 245.723); não mudar size.test.mjs nem MAX_WORKFLOW_CHARS.",
    "Sem execução paga, sem bump de versão, sem mudar formato de plano, de estado ou de run.json; não mexer em checkPlanLoad nem nas caudas head = 3 e blob = 3, head = 4.",
    "Não editar docs/plans/roadmap-pos-2-2-0/ nem o relatório docs/reports/2026-11-17-E31-parada-retomada.md.",
    "Sem push; nunca tocar em main, na branch de release nem no worktree D:/projects/claude-play.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;; temporários só em D:/projects/claude-play-wt/_tmp/E31-<rótulo>/.",
    "Commits de tarefa começam com \"E31 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash; o chamador comita."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Carga da spec confere o exit code contra o summary.exitCode",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": [
        "checkSpecLoad(t, E, card) -> { ok: false, why: 'spec-tool check exit <checkExit> differs from summary.exitCode <n> in its stdout' } quando checkStdout é o JSON do spec-tool com summary.exitCode inteiro diferente de checkExit",
        "R_LOAD = '... checkStdout and checkExit from command 1, emitStdout and emitExit from command 2,'"
      ],
      "consumes": [],
      "covers": ["AC2", "C1", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Commit da spec e do plano sem depender de exit code",
      "deps": [1],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "S_COMMITTED.properties.pending: STR",
        "commitAgent(kind, file, phase, tail, k = '', model = 'haiku') com rótulo ${E}:${kind}-commit${k}, passo 3 git -C \"${wt}\" diff --cached --name-only -- ${file} e retorno pending = git -C \"${wt}\" status --porcelain -- ${file}",
        "commitChecked(kind, file, phase, tail) -> resultado de commitAgent, ou { ok: false, error: '<file> still pending after an empty commit: <pending>' }"
      ],
      "consumes": [],
      "covers": ["AC2", "C3", "C4"],
      "testFirst": true,
      "checks": [
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
      "title": "Gates e medida de tamanho",
      "deps": [1, 2],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": ["AC2"],
      "testFirst": { "exempt": "só roda os gates e a medida de tamanho; não muda arquivo" },
      "checks": [
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=245723?0:1)\"", "expect": "exit 0 (correção de no máximo 2.500 caracteres)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1, evidência AC2)" },
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
      "id": "R4",
      "question": "Em que ordem e com que dependências as tarefas rodam?",
      "decision": "Correção 1 com os testes a e b (T1), correção 2 com os testes c, d e o caso do plano (T2, depende de T1 porque mexe nos mesmos dois arquivos) e gates com a medida de tamanho (T3, depende de T1 e T2).",
      "basis": "Spec, seção Deixado para o plano (ordem correção 1, correção 2, G1 e medida na final); dois arquivos compartilhados impedem paralelo.",
      "alternative": "Uma tarefa única com as duas correções.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual o texto exato das mensagens, do R_LOAD e do novo passo do commit, e como a repetição chama o agente?",
      "decision": "why 'spec-tool check exit <checkExit> differs from summary.exitCode <n> in its stdout'; error '<arquivo> still pending after an empty commit: <pending>' ('(not measured)' quando ausente); R_LOAD com 'checkExit from command 1' e 'emitExit from command 2'; passo 3 git diff --cached --name-only (saída vazia = nada a commitar) e retorno pending de git status --porcelain -- <arquivo>; commitAgent ganha parâmetros de sufixo do rótulo e modelo, usados por commitChecked para <E>:<kind>-commit2 em sonnet.",
      "basis": "Spec, Desenho e Deixado para o plano (texto exato da mensagem e do passo dentro do desenho); teto de 2.500 caracteres pede reaproveitar commitAgent em vez de um segundo prompt.",
      "alternative": "Um prompt de commit separado para a repetição em sonnet.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como conferir o teto de 2.500 caracteres da correção?",
      "decision": "Um comando node -e na Tarefa 3 que mede roadmap-release.js em LF e sai 0 só com no máximo 245.723 caracteres (243.223 medidos na base + 2.500); size.test.mjs roda sem mudança.",
      "basis": "Instrução do dono de 2026-11-17 (no máximo 2.500 somados; hoje 243.223); medida conferida na base desta branch.",
      "alternative": "Conferir só pelo teto de 250.000 de size.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Alguma tarefa precisa de navegador, servidor, trava ou efeito externo?",
      "decision": "Não: todas rodam no worktree D:/projects/claude-play-wt/E31 e só leem e escrevem arquivos dele e temporários; se um gate não puder rodar, a evidência aceitável é a saída literal e o motivo.",
      "basis": "Spec sem efeitos externos (externalEffects vazio); nenhuma trava configurada; correção limitada a um arquivo de produto e um de teste.",
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
      "what": "O dono confere o relatório docs/reports/2026-11-17-E31-parada-retomada.md (critério AC1).",
      "why": "AC1 é verify human; o relatório já existe e só o dono o aceita.",
      "blocking": false,
      "workaround": "O executor entrega a correção do critério AC2; a conferência fica com o dono."
    }
  ]
}
```
