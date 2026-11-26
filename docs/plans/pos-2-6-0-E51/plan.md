# Plano E51 -- Arnês de medição pronto para a base nova

Spec: `docs/plans/pos-2-6-0-E51/spec.md` (`spec/1`, AC1 a AC3, casos C1 a C5). Todo o trabalho é em `tools/measure/` e `.claude/rules/measure.md`, na branch `plan/pos-2-6-0-E51`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E51`, com merge em `release/pos-2.6.0` depois da conferência. Os caminhos abaixo são relativos à raiz do repositório. Os números de linha são os do estado anterior à Tarefa 1; localize pelo nome do símbolo.

## Regras de execução

- Nenhuma execução paga: não rodar `run-batch.mjs`, `run-baseline.mjs` nem `run-trigger.mjs` de verdade. Todo teste usa `exec` simulado (`makeFake`). Os testes que chamam a CLI por `spawnSync` só exercitam recusas que saem antes de qualquer `claude -p`.
- Não rodar a suíte completa; a linha de base está na spec do E42 (`docs/plans/pos-2-6-0-E42/spec.md`). Rodar só os arquivos de teste das checagens. O portão de onda roda a suíte de `tools/` (`node --test "tools/**/*.test.mjs"`), com linha de base medida em `8ccca3e`: exit 0, tests 541, pass 539, fail 0, skipped 2. A suíte completa roda no merge.
- `tools/measure/run-batch.test.mjs` compara o HEAD lido ao carregar com o HEAD lido depois: não commitar enquanto ele roda.
- Medir o tempo de `node --test tools/measure/run-batch.test.mjs` (linha `duration_ms` do resumo) antes da Tarefa 1 e depois da Tarefa 3, e informar os dois números no relato da Tarefa 3. Antes da Tarefa 1, já medido em `8ccca3e`: 200 testes, 200 aprovados, `duration_ms` 243293.
- As tarefas 1 a 6 mexem em `run-batch.mjs` e no teste dele, por isso rodam em cadeia.

## Tarefas

### Tarefa 1: --model obrigatório no run-batch

Arquivos: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

Testes primeiro (ver falhar):

- `parseCli` com `CLI_BASE` sem o par `--model` lança `UsageError`; com `--model ''` também (C1).
- `runBatch(baseOpts(s, { model: undefined }))` e com `model: ''` rejeitam com `UsageError`, sem nenhuma chamada a `claude` em `fake.calls` (nem `--version`) e sem criar `s.out` nem `s.work`.

Ajustes dos testes atuais, no mesmo passo:

- `baseOpts` (`:101` na spec; `const baseOpts`) ganha `model: 'opus'` (com isso `seededOpts`, `taskOpts` e os demais derivados).
- `CLI_BASE` (`:3401`) ganha `'--model', 'opus'`.
- Toda chamada `spawnSync` de `run-batch.mjs` que passa todos os obrigatórios ganha `'--model', 'opus'`, senão ela passaria a sair com 2 pela razão errada. São os testes "requires the mandatory options" (só a chamada `inRepo`, que passa a afirmar também que o stderr casa `/inside the repository/`; a primeira chamada continua sem os obrigatórios e espera o `usage:`), "stage and variant must match", o de braço sem linha de origem (`--arms-dir`), o de `--from-run` em variante não semeada, "task-review requires a valid --review-model", o "A2: a stale arm against the --plugin-dir workflow", o laço `cases` do `--rounds loop`, o das recusas de `correcao-semeada` em `task-review`, "B2: the A1 refusal of task-review loop is narrowed" e o das recusas de `final-review`. Conferir com Grep por `script,` e `[script` que nenhuma ficou de fora.

Implementação:

- Em `parseCli`, depois da checagem dos obrigatórios atuais (que continua devolvendo `null`) e antes das checagens de `--ratify`: `o.model` ausente ou vazio lança `UsageError('--model is required: every attempt runs claude -p, and the batch must pin the model (#21)')`. Qualquer string não vazia passa como está, sem lista fixa.
- A mesma guarda é a primeira coisa de `runBatch`, antes de `prepareHarness`, de `mkdirSync` e do `claude --version`.
- `USAGE` passa a mostrar `--model <m>` entre os obrigatórios, fora dos colchetes.
- `promptArgs` não muda. `run-baseline.mjs` não muda (R2).

Commit: `feat(measure): exigir --model no run-batch (#21)`.

### Tarefa 2: sessionModels e modelDivergence

Arquivos: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

Testes primeiro. `makeFake` ganha a opção `modelOf: (n) => string | undefined`: quando devolve um modelo, `writeSession` reescreve `message.model` das linhas da transcrição principal copiada na chamada `n` (a transcrição fabricada tem hoje uma mensagem `claude-opus-4-1`).

- `parada-retomada` com `stopResume`, `pollMs: 1`, `ratify` ok, `model: 'opus'`, opus na chamada 1 e sonnet na 2: `sessionModels` igual a `{ parada: 'opus', retomada: 'sonnet' }`, `modelDivergence: true`, `aggregate.modelDivergence` igual a `[1]`, `aggregate.requestedModel` igual a `'opus'`, stderr (via `captureStderr`) com o aviso.
- As duas fases em opus: `false` e `[]`, sem aviso.
- Pedido de família `other`: fases iguais dão `false`; fases diferentes dão `true`.
- Variante de uma fase (`completo`): `sessionModels` é `{ sessao: 'opus' }`.
- C2: ratificação que falha depois de uma parada com `extraOn1` (duas sessões na primeira fase): `retomada: null`, não conta para a divergência. Também o caso `failOn: 2` (retomada sem `session_id`): `retomada: null`.
- Tentativa negada não tem os dois campos.

Implementação:

- Importar `readJsonl`, `family` e `dedupeMessages` de `./session-metrics.mjs`.
- Função `sessionFamily(configDir, sessions)`, junto de `sessionIds`: lê `<configDir>/projects/<slug>/<sid>.jsonl` de cada sessão, descarta linhas com `isSidechain`, aplica `dedupeMessages`, conta por `family(message.model)` e devolve a família com mais mensagens (empate: ordem de `FAMILIES`, R5); sem mensagem ou sem arquivo, `null`.
- No laço de tentativas, uma marca `resumeStarted`, ligada na mesma linha em que `resumeFrom = sessions.length` é fixado (R4). Logo depois do laço de prompts, quando `sessions.length > 0` e a tentativa não foi negada: com `stop !== null`, `{ parada, retomada }` com o corte em `resumeFrom` se a retomada começou, senão todas as sessões são `parada` e `retomada` é `null`; sem parada, `{ sessao }`.
- `modelDivergence`: com `family(opts.model)` conhecida, `true` quando alguma fase não nula tem outra família; se for `other`, `true` quando as fases não nulas diferem entre si.
- `extra()` passa a espalhar `sessionModels` e `modelDivergence` quando calculados (entram em `attempts` e em `private/attempts.json`). Não entram em `denied` nem em `preflight-processo-matador`.
- Aviso no stderr quando divergir: `run-batch: warning: attempt <k> model divergence: requested <m>, <fase> <família>, ...`, listando as fases não nulas. A tentativa não é invalidada.
- No `aggregate`: `requestedModel: opts.model` e `modelDivergence` com a lista dos `n` divergentes.

Commit: `feat(measure): registrar o modelo de cada fase e modelDivergence (#21)`.

### Tarefa 3: Transcrições em private/ e SHA256SUMS

Arquivos: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

Testes primeiro. `makeFake` ganha a opção booleana `failJson`: com ela, a chamada de `failOn` devolve código 1 com o JSON de erro da CLI (`session_id`, `is_error: true`, `total_cost_usd`), como a CLI real; sem ela o comportamento atual fica igual (R3).

- Lote de 2 com `failOn: 2` e `failJson`: uma válida e uma inválida; `private/transcripts/1/` e `private/transcripts/2/` têm o `<sid>.jsonl` e a pasta `<sid>/` (com os arquivos de `subagents/workflows/`).
- No mesmo lote, ler `SHA256SUMS`: cada linha casa `/^[0-9a-f]{64}  [^\\]+$/`; caminhos em ordem; sem `\r`; LF no fim; `SHA256SUMS` não listado; a lista é exatamente `aggregate.json` mais todos os arquivos sob `private/` (varredura recursiva no teste); cada hash recalculado com `createHash('sha256')`.
- Tentativa negada (`denyOn`): transcrição copiada.
- C2: a tentativa que falha antes da retomada tem a transcrição da parada copiada.
- C3: `afterRun` apaga o `<sid>.jsonl` da sessão: aviso no stderr, `sessionModels.sessao` `null`, `modelDivergence: false`, o status e o motivo da tentativa são os que o código já daria sem a cópia, e `SHA256SUMS` é gerado com o que existe.
- C5 (parte dos hashes): lote sem válida gera `SHA256SUMS` cobrindo `aggregate.json` e `private/`.

Implementação:

- `copyTranscripts(configDir, sessions, destDir, k)`: para cada sessão, procura em `<configDir>/projects/*/` e copia `<sid>.jsonl` e a pasta `<sid>/` com `cpSync(..., { recursive: true })` para `<destDir>`, que é `<dir>/private/transcripts/<k>/`. Sessão sem `.jsonl` ou erro de cópia: `run-batch: warning: transcript <sid> of attempt <k> not copied: <motivo>`, sem mudar o status.
- A chamada fica logo depois do laço de prompts, antes do ramo `denied` e de qualquer `continue`, para toda tentativa com sessões registradas (R6).
- `writeSums(dir)`: `aggregate.json` e todo arquivo sob `private/`; linha `<hex minúsculo><dois espaços><caminho relativo a dir com />`; ordenadas pelo caminho; LF, com LF no fim. Chamada depois de gravar `aggregate.json`, dentro de `try`: a falha vira `run-batch: warning: SHA256SUMS not written: <motivo>` e não muda `exitCode`.
- Importar `cpSync` de `node:fs`.
- Informar o tempo da suíte do arquivo antes e depois (Regras de execução).

Commit: `feat(measure): guardar transcrições e gerar SHA256SUMS (#22)`.

### Tarefa 4: parentMention no CR3

Arquivos: `tools/measure/defects/manifest.json`, `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`, `tools/measure/make-scenario.test.mjs`.

Testes primeiro:

- `run-batch.test.mjs`, junto dos testes B4 de `mentionStats`: `fixIds` `['CR3', 'CG2']`, revisão 1 com um achado no texto de C5 (arquivo `src/truncate.mjs`, que não casa o `mention` do CR3) dá `residuoSemAchadoPai: 0`; sem esse achado, `1`.
- `make-scenario.test.mjs`, junto dos testes B1: o `parentMention` do CR3 compila com as flags `is`, casa `file + ' ' + description` da entrada C5 do manifest e pelo menos 3 paráfrases do achado pai (por exemplo: truncate devolve string vazia em vez de lançar quando max é 0; o RangeError é engolido dentro de truncate; truncate com "maximum of 0" devolve `''`; escritas em inglês). O teste "B1: each artifact has exactly 1 residue and 1 regression in the manifest" continua verde.

Implementação:

- Na entrada CR3 do manifest (linhas 532 a 545): campo `parentMention` com o valor `truncate.*(swallow|RangeError|empty string|max(imum)? (is |of |= ?)?0|zero)|(swallow|RangeError|empty string).*truncate`.
- Em `mentionStats`, o filtro dos achados pai da revisão 1 usa `new RegExp(m.parentMention ?? m.mention, 'is')`. O `rx` de `m.mention` continua sendo o de `mentionedAfterFix`, a guarda `typeof m.mention !== 'string'` fica, e `verifyStats` e `recountWithoutMention` não mudam. Atualizar o comentário da função para citar `parentMention`.

Commit: `fix(measure): achar o achado pai do CR3 por parentMention (#26)`.

### Tarefa 5: Custo por tentativa (costUsd e cost.total)

Arquivos: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`. REQ-018, sem critério próprio no card.

Testes primeiro, junto do teste "A5: the attempt records the CLI cost":

- Envolver o `exec` do `makeFake` (como no teste A5 sem `total_cost_usd`) para devolver um `total_cost_usd` diferente por chamada e bem maior que transcrição mais papéis: cada `attempt.costUsd` é o custo da CLI e `aggregate.cost.total` é a soma.
- Lote sem nenhuma válida (C5): `aggregate.cost.total` é `null`.
- Uma inválida no meio do lote não entra na soma.

Implementação:

- Logo depois de montar o `attempt` (linha 2653): `attempt.costUsd = attemptCostUsd(attempt)`, em toda tentativa válida.
- Remover a atribuição do ramo lentes (linha 2662), redundante: `lensAttemptStats` não toca `counters` nem `rolesByLabel`.
- `aggregate.cost.total`: soma de `costUsd` das válidas; `null` sem válida.
- Comentário no código junto de `counters.cost` (ou de `costs` no aggregate): é o custo só dos papéis, lido por `baseline.mjs` e `checkpoint.mjs`; o custo dos tetos é `costUsd`. O significado de `counters.cost` não muda.

Commit: `feat(measure): custo por tentativa e cost.total no aggregate (#23)`.

### Tarefa 6: Formatos novos do gate vazio

Arquivos: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`. REQ-019.

Testes primeiro, junto dos testes `coordinatorGateVazio` (linhas 3553 a 3573), um caso por forma, todos com `exit: 0` no `progress.json` temporário:

- reporter spec com códigos ANSI e `ℹ tests 0` (C4): vazio;
- reporter spec sem ANSI com `ℹ pass 0`: vazio;
- uma linha com 0 tests: vazio;
- uma linha com 0 pass: vazio;
- uma linha com testes passando: não vazio;
- reporter spec com testes passando: não vazio.

Implementação em `coordinatorGateVazio`:

- tirar o ANSI do `tail` com `/\x1b\[[0-9;]*[A-Za-z]/g`;
- reconhecer `tests 0` e `pass 0` em começo de linha com prefixo `# ` ou `ℹ ` (U+2139 e espaço);
- reconhecer a forma de uma linha `(\d+) tests, (\d+) pass, (\d+) fail`, vazia quando tests ou pass for 0;
- registrar no comentário da função que a forma de uma linha tem origem não identificada (citada só pela nota S2-15 do arnês antigo).

Commit: `fix(measure): reconhecer mais formatos de gate vazio (#26)`.

### Tarefa 7: Remover a regra inerte do sandbox

Arquivos: `tools/measure/make-scenario.mjs`, `tools/measure/make-scenario.test.mjs`, `tools/measure/roteiro-e17.test.mjs`. REQ-019.

Testes primeiro (ver falhar):

- Em `make-scenario.test.mjs`, as duas afirmações dos 4 primeiros (perto das linhas 349 e 499) passam a afirmar a lista inteira, nesta ordem: `Bash(node:*)`, `Bash(git:*)`, `Workflow`, `Workflow(productivity-tools:release-workflow)`, `Bash(node *roadmap.mjs" *)`; e a ausência de `Workflow(productivity-tools:roadmap-release)`. Os nomes dos testes ficam (R7).
- Em `roteiro-e17.test.mjs` (linha 37), `>= 6` passa a `>= 5`; o laço que exige `--allow` de cada regra no roteiro fica. O documento `roteiro.md` arquivado não muda.

Implementação: tirar `Workflow(productivity-tools:roadmap-release)` de `SANDBOX_RELEASE_RULES` (linha 56). `E5_PATHS` e as variantes legadas não mudam (DEC-016). Nenhum teste é apagado.

Commit: `fix(measure): remover a regra inerte do sandbox (#26)`.

### Tarefa 8: Documentar as regras novas do arnês

Arquivo: `.claude/rules/measure.md`.

Acrescentar um item curto, em inglês como o resto do arquivo, com: `run-batch.mjs` exige `--model` e marca `modelDivergence` sem invalidar a tentativa; as transcrições ficam em `private/transcripts/<k>/` e o `SHA256SUMS` na raiz da pasta de saída (`sha256sum -c SHA256SUMS` rodado nela); `attempt.costUsd` e `cost.total` são o custo dos tetos, `counters.cost` é só dos papéis. Não tocar em `AGENTS.md`.

Commit: `docs(measure): regras de modelo, transcrições e custo`.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E51",
  "title": "Arnês de medição pronto para a base nova",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E51, branch plan/pos-2-6-0-E51; autonomia só local: sem push, tag ou comentário em issue (DEC-004).",
    "Antes da Tarefa 1, node --test tools/measure/run-batch.test.mjs levou duration_ms 243293 (200 testes, 200 aprovados, medido em 8ccca3e); o relato da Tarefa 3 informa esse número e o medido depois dela.",
    "Nenhuma execução paga: não rodar run-batch.mjs, run-baseline.mjs nem run-trigger.mjs de verdade; todo teste é offline, com exec simulado (DEC-004, DEC-021).",
    "Não rodar a suíte completa; rodar só os arquivos de teste das checagens (a linha de base está na spec do E42).",
    "E5_PATHS e as variantes legadas plano-semeado e codigo-semeado ficam congelados (DEC-016).",
    "Nenhuma mudança em plugins/ nem bump de versão: tools/measure não é publicado (DEC-003).",
    "Não alterar tools/measure/fixtures/workflow-com-single/roadmap-release.js.",
    "Não mudar o significado de counters.cost.",
    "Não mudar os outros usos de mention (mentionedAfterFix e recountWithoutMention).",
    "Transcrições e caminhos pessoais só em private/; não commitar nada de tools/measure/out/.",
    "Nenhum teste é apagado.",
    "Seguir .claude/rules/measure.md; editar CLAUDE.md e regras, nunca AGENTS.md.",
    "Não commitar enquanto tools/measure/run-batch.test.mjs roda (o teste compara o HEAD)."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "--model obrigatório no run-batch",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs"]
      },
      "writes": [],
      "produces": [
        "runBatch(opts) rejects with UsageError when opts.model is absent or empty",
        "baseOpts(s, extra) includes model: 'opus'"
      ],
      "consumes": [],
      "covers": ["AC1", "C1"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test tools/measure/run-baseline.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 2,
      "title": "sessionModels e modelDivergence",
      "deps": [1],
      "files": {
        "create": [],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs"]
      },
      "writes": [],
      "produces": [
        "sessionFamily(configDir, sessions) -> 'haiku'|'sonnet'|'opus'|'fable'|'other'|null",
        "attempt.sessionModels, attempt.modelDivergence",
        "aggregate.requestedModel, aggregate.modelDivergence: number[]",
        "makeFake(configDir, { modelOf })"
      ],
      "consumes": [
        { "task": 1, "sig": "baseOpts(s, extra) includes model: 'opus'" }
      ],
      "covers": ["AC1", "C2"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 3,
      "title": "Transcrições em private/ e SHA256SUMS",
      "deps": [2],
      "files": {
        "create": [],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs"]
      },
      "writes": [],
      "produces": [
        "copyTranscripts(configDir, sessions, destDir, k)",
        "writeSums(dir) -> <dir>/SHA256SUMS",
        "makeFake(configDir, { failJson })"
      ],
      "consumes": [
        { "task": 2, "sig": "attempt.sessionModels, attempt.modelDivergence" }
      ],
      "covers": ["AC2", "C2", "C3", "C5"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 4,
      "title": "parentMention no CR3",
      "deps": [3],
      "files": {
        "create": [],
        "modify": ["tools/measure/defects/manifest.json", "tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs", "tools/measure/make-scenario.test.mjs"]
      },
      "writes": [],
      "produces": ["manifest CR3.parentMention (regex source, flags is)"],
      "consumes": [],
      "covers": ["AC3"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs tools/measure/make-scenario.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 5,
      "title": "Custo por tentativa (costUsd e cost.total)",
      "deps": [4],
      "files": {
        "create": [],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs"]
      },
      "writes": [],
      "produces": ["attempt.costUsd", "aggregate.cost.total: number|null"],
      "consumes": [],
      "covers": ["C5"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 1, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs tools/measure/checkpoint.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 6,
      "title": "Formatos novos do gate vazio",
      "deps": [5],
      "files": {
        "create": [],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs"]
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": ["C4"],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/run-batch.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 7,
      "title": "Remover a regra inerte do sandbox",
      "deps": [4],
      "files": {
        "create": [],
        "modify": ["tools/measure/make-scenario.mjs"],
        "test": ["tools/measure/make-scenario.test.mjs", "tools/measure/roteiro-e17.test.mjs"]
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "checks": [
        { "cmd": "node --test tools/measure/make-scenario.test.mjs tools/measure/roteiro-e17.test.mjs", "expect": "exit 0" }
      ]
    },
    {
      "n": 8,
      "title": "Documentar as regras novas do arnês",
      "deps": [6, 7],
      "files": {
        "create": [],
        "modify": [".claude/rules/measure.md"],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só documentação" },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 1 },
      "checks": [
        {
          "cmd": "node -e \"const t=require('fs').readFileSync('.claude/rules/measure.md','utf8');process.exit(['--model','SHA256SUMS','private/transcripts','costUsd','counters.cost'].every((x)=>t.includes(x))?0:1)\"",
          "expect": "exit 0"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test tools/measure/run-batch.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test tools/measure/run-batch.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test tools/measure/run-batch.test.mjs tools/measure/make-scenario.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir e ordenar o trabalho?",
      "decision": "Oito tarefas: AC1 em duas (guarda do --model e depois sessionModels), transcrições, parentMention, custo, gate vazio, regra inerte e documentação; as que mexem em run-batch.mjs e no teste dele em cadeia.",
      "basis": "A spec deixa a ordem ao plano e pede AC1 primeiro por causa de baseOpts; as peças dividem os mesmos dois arquivos.",
      "alternative": "Uma tarefa por critério de aceite, com as peças sem critério agrupadas numa só.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Acrescentar a checagem de --model no parseCli do run-baseline.mjs?",
      "decision": "Não acrescentar; sem --model, cada variante falha na guarda do runBatch antes de qualquer claude -p.",
      "basis": "A spec põe a CLI do run-baseline fora do escopo; a sugestão da aprovação é opcional, e a guarda em runBatch já impede qualquer gasto.",
      "alternative": "Recusar no parseCli do run-baseline para o erro aparecer na leitura da linha de comando.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o makeFake simula o modelo por chamada, a falha com sessão e o custo maior?",
      "decision": "Opção modelOf (n -> modelo) que reescreve message.model da transcrição principal; opção failJson para a chamada de failOn devolver o JSON de erro com session_id; o custo maior vem de um exec que envolve o do makeFake.",
      "basis": "A falha atual do fake não devolve session_id, então a inválida ficaria sem sessões para copiar; como opção, os testes que usam failOn não mudam.",
      "alternative": "Mudar o failOn para sempre devolver o JSON de erro.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como saber se a retomada começou, já que resumeFrom nasce com o valor 1?",
      "decision": "Uma marca ligada junto da atribuição de resumeFrom; sem ela, todas as sessões são da parada e retomada é null.",
      "basis": "Uma parada abortada pode deixar duas sessões e a ratificação falhar antes de resumeFrom ser fixado; o corte em 1 contaria a segunda como retomada, contra o caso C2.",
      "alternative": "Usar sempre sessions.slice(resumeFrom).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual família vence um empate de mensagens numa fase?",
      "decision": "A primeira na ordem de FAMILIES.",
      "basis": "É determinístico e usa a constante que run-batch.mjs já tem; empate numa thread principal é improvável.",
      "alternative": "A família da última mensagem da fase.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Procurar no configDir sessões de uma chamada que morreu sem devolver session_id?",
      "decision": "Não; copiam-se as sessões que o runBatch já registra (as do JSON da CLI e as descobertas na parada abortada).",
      "basis": "A spec define a cópia para toda tentativa com sessões; mudar a descoberta de sessões mudaria o que as métricas e a validade leem.",
      "alternative": "Comparar sessionIds antes e depois de toda chamada e copiar as novas.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Renomear o teste que fala das regras 1.6.0 depois de tirar a regra inerte?",
      "decision": "Manter os nomes e mudar só as afirmações.",
      "basis": "A spec diz que nenhum teste é apagado; trocar o nome contaria como remoção.",
      "alternative": "Renomear e declarar em removedTests.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
