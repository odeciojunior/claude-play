# Plano E41 (B1) -- Saída de script sem recópia por LLM: coordinator.js lê o estado em fatias e mede portões pelo capture.mjs

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E41/spec.md` (R12: o plano A é `docs/plans/pos-2-3-0-E41/plan.md`; o plano B original, `docs/plans/pos-2-3-0-E41/plano-b/plan.md`, não é editado e é dividido em B1 e B2 pela DEC-035).

**Branch:** `release/pos-2.3.0` (DEC-008), um commit por tarefa. O coordinator faz os commits com o assunto `E41 T<n>: <título>`. Por isso todo título começa com `B1:`, o que separa os commits deste plano dos do plano A e do B2, que têm o mesmo id E41.

**Comando de teste (portão de onda):** `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.

## Por que este plano existe

Decisão do dono via Fable, DEC-035 (`docs/plans/roadmap-pos-2-3-0/decisions.md`). O plan-coordinator instalado (2.3.0) recopia a leitura inteira do `progress.json` pelo script-runner haiku, e com estado grande a cópia falha no digest (aconteceu no plano A). Este plano B1 roda nesse coordinator instalado e por isso fica com poucas tarefas e estado pequeno. Ele contém só as duas tarefas do plano B que fazem o `coordinator.js` ler o estado em fatias e medir portões pelo `capture.mjs`: a T5 do plano B vira a Tarefa 1 (`B T5`) e a T6 vira a Tarefa 2 (`B T6`). Os passos, arquivos, checks, tier, locks e commit são os do plano B. Tudo o mais (as demais 11 tarefas, os efeitos X1 e X2 e a sonda AC2b, os critérios AC3, AC5 e AC8) fica no B2, escrito em paralelo em `docs/plans/pos-2-3-0-E41/plano-b2/plan.md`. A Tarefa 3 é a conferência final sem commit, e a Tarefa 4 é a tarefa externa de marcação que o `plan-tool check` exige para X1 e X2, recusada aqui.

## Pré-condição: o plano A já está integrado

Este plano roda depois do plano A. Ao começar, o código já tem `lib/plan-digest.mjs` estendida e embutida nos 4 alvos (`MAX_COPY_BYTES`, `SLICE_BYTES`, `utf8Length`, `sha256Hex`, `sliceEnvelopes`, `checkSlice`, `joinSlices`, `checkSigned`, `checkRun`, `commandDigest`, `checkCapture`), `scripts/capture.mjs` com `run`, `slice` e `prune`, `scripts/test-extract.mjs` e `--slice` em `progress.mjs read`. O B1 não edita esses arquivos. Se a Tarefa 1 achar um export ou arquivo faltando, devolve BLOCKED com o nome do que falta. As assinaturas exatas (argumentos de `checkSlice`, `checkCapture` e `commandDigest`, e o formato dos envelopes) são as que o plano A deixou: cada tarefa lê o cabeçalho de `lib/plan-digest.mjs` e de `scripts/capture.mjs` antes de chamá-las.

## Contexto lido

- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` (76.187 caracteres LF antes do plano A):
  - `failedTestNames` (842-855), `waveGatePasses` (858-865) e `checkSigned` (868-877; vai para a lib no plano A);
  - `baselineEvent` (953-958) e `baselineProblem` (961-975);
  - `S_RUN` (1090), `runPrompt` (1095) e `runCmd` (1098-1103);
  - `readSigned` (1139-1172), que hoje pagina por `--page`;
  - `flushChunk` (1179-1210);
  - `runTest` (1317) e `ensureBaseline` (1320-1337);
  - o caso `wave-gate` (1483-1499), que usa `failedTestNames(out.stdout)`.
  - Os números de linha são os do plano B, anteriores ao plano A: releia o arquivo antes de editar.
- Testes do coordinator:
  - `flow.test.mjs` (682 linhas): o simulador `makeSim` roda de verdade os comandos do script-runner por `execLine`, que lê `cd X && ...` e chama node e git sem shell;
  - `gate.test.mjs` (145 linhas) e `size.test.mjs` (teto de 120.000; confere o embutido).
- `coordinator-agy.py` tem o próprio `checkSigned` no `JS_PRELUDE` e lê os esquemas de `coordinator.js` (`load_js_schemas`); o agy fica fora do escopo.
- Orçamento: `coordinator.js` até 88.187 caracteres LF (R14 da spec). Esse orçamento é compartilhado com a T7 do plano B (agora no B2, que roda depois do B1); o B1 mede e informa o que usou.

## Tarefas

### Tarefa 1: B1: leitura assinada do coordinator por fatias com retry por fatia

Origem: B T5.

Arquivos:

- modificar `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`;
- testar em `plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` (novo) e `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro, em `slices.test.mjs`. Use um simulador próprio, copiado de `makeSim`/`execLine`/`sandbox` de `flow.test.mjs`, porque aquele arquivo não exporta nada. Ele gera um plano sintético de 40 passos (cerca de 19 KB de estado, recriando `progress/plan.md` do intake) e roda `progress.mjs init` de verdade. Casos:
   - AC2: o runner falso corta toda resposta acima de 3.500 bytes e devolve `{ stdout }` sem `exit`. A leitura passa fatia a fatia, e o workflow chega à primeira ação depois da leitura.
   - AC2: um runner falso resume uma fatia `k` na primeira cópia. Só essa fatia ganha o rótulo `read-slice<k>-retry2`.
   - C1: o título de um passo tem caracteres de vários bytes e um emoji. O estado remontado é igual ao `progress.json`, comparado sem `history`: o payload de `progress.mjs read --slice` traz `history: []`.
   - C2: o runner muda `progress.json` entre a fatia 0 e a 3. `joinSlices` recusa, a leitura recomeça uma vez, e nunca há estado montado com fatias misturadas.
   - A fatia 0 usa `A.runToken` como nonce. As seguintes usam `${RUN_TAG}-<seq>`.
   - Rode `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` e confirme a falha.
2. Implemente em `coordinator.js`:
   - `CAPTURE`: `PROGRESS` com o sufixo `/skills/plan-coordinator/scripts/progress.mjs` trocado por `/scripts/capture.mjs`.
   - `copyFits(stdout)`: falso quando `utf8Length(stdout) > MAX_COPY_BYTES`, a constante embutida. Nunca escreva o literal do limite.
   - `runPrompt(cmd, writes, json)`: com `json` verdadeiro, pede a única linha JSON impressa, literal, e diz que uma linha acima do limite é erro do comando. As chamadas de git continuam pedindo o stdout completo (R8).
   - `readSigned(label, first)` lê `node PROGRESS read STATE --nonce N --slice k --json`:
     - fatia 0 com `A.runToken` quando `first`;
     - até 3 tentativas por fatia (haiku, haiku, sonnet; R11 da spec), com `copyFits` e `checkSlice` antes do parse;
     - junção com `joinSlices` e um recomeço se o total não bater;
     - o payload remontado `{ root, planChanged, stateDigest, state }` é conferido por `stateDigest(state) === stateDigest`, e o `now` vem do envelope.
   - `flushChunk` passa a recusar com `copyFits` antes do parse. O apply continua assinado por `checkSigned`.
   - `READ_PAGE_CHARS`/`--page` não são mais usados pelo JS. Ficam no `progress.mjs` para o agy (R4 da spec).
3. Atualize `flow.test.mjs` onde os rótulos de página e `garble` dependem da leitura antiga: `read-retry<k>` passa a `read-slice<k>-retry<j>` quando for o caso.
4. Verificação:
   - rode `node --test` em `slices.test.mjs`, `flow.test.mjs`, `size.test.mjs` e `coordinator-agy.test.mjs`;
   - meça o tamanho: até 88.187. Depois do embutido do plano A sobram cerca de 6 KB até esse limite para as Tarefas 5 a 7 do plano B juntas (R14), que agora são as Tarefas 1 e 2 daqui e a T7 do B2. Se a medida passar de 88.187, pare, não corte funcionalidade e reporte no relatório da tarefa a medida e o que a tarefa acrescentou.

### Tarefa 2: B1: linha de base e portão de onda do coordinator pelo capture.mjs com extrator

Origem: B T6.

Arquivos:

- modificar `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`;
- testar em `plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs`, `plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` e `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro:
   - Em `gate.test.mjs`:
     - `waveGateOf(cap)` com JSON real do capture sobre a suíte gerada de 63 testes (3 falham) dá `{ exit: 1, failedNames: ['FAIL_A', 'FAIL_B', 'FAIL_C'] }`;
     - com `format: 'unknown'` e exit 1, dá `failedNames: []`, e `waveGatePasses` reprova (C3);
     - com `extract.failedNamesCut > 0`, dá `failedNames: []` e reprova contra uma linha de base com os mesmos nomes (C4);
     - `baselineEvent(test, cap)` e `baselineProblem(cap)` leem `exit`, `tail`, `extract.total` e `extract.pass` do JSON.
   - Em `slices.test.mjs` (AC1): o comando de teste do sandbox imprime 400 linhas (cerca de 12,7 KB). O runner falso executa de verdade a linha `capture.mjs run --tests --cwd ROOT --bash ...` e corta acima de 3.500 bytes. O evento `baseline` gravado em `progress.json` tem o `exit` e a `tail` do JSON conferido, e não o `exit` do `S_RUN`.
   - Rode `node --test` em `gate.test.mjs` e `slices.test.mjs` e confirme a falha.
2. Implemente em `coordinator.js`:
   - `runCapture({ argv | bash, task, label, phase, tests, cwd })` monta `node CAPTURE run --nonce <nonce> --task <task> [--tests] --cwd <cwd> (-- <argv> | --bash <bash>)`. Ela:
     - despacha por `runCmd` com `json: true`;
     - confere com `copyFits` e `checkCapture(stdout, { nonce, cmdDigest: commandDigest(...) })`;
     - repete uma vez em sonnet;
     - devolve o JSON ou `null`.
   - `runTest(label)` passa a ser `runCapture({ bash: testCmd(), task: \`${S.plan.id}-gate\`, tests: true, cwd: ROOT })`.
   - Funções puras:
     - `waveGateOf(cap)`;
     - `baselineEvent(test, cap)`, com `tail` do JSON e `cap.extract.failedNamesCut` (número, dentro de `extract`) somado ao corte de `capNames`;
     - `baselineProblem(cap)`.
   - O caso `wave-gate` usa `waveGateOf` e `excerpt = cap.tail`. `ensureBaseline` falha com `the baseline test run returned nothing` quando `runCapture` devolve `null`.
   - `failedTestNames` sai do workflow quando não tiver outro uso. `coordinator-agy.py` tem a própria cópia, e o agy fica fora do escopo.
3. Ajuste `flow.test.mjs`: o `CHECK` do sandbox e o simulador já executam o comando real. Corrija só as asserções que leem o prompt antigo de `runTest` ou o `excerpt`.
4. Verificação:
   - rode `node --test` em `gate.test.mjs`, `slices.test.mjs`, `flow.test.mjs` e `coordinator-agy.test.mjs`;
   - meça o tamanho: até 88.187. Se passar, pare, não corte funcionalidade e reporte no relatório da tarefa a medida e o que a tarefa acrescentou.

### Tarefa 3: B1: conferência final do B1 (sem commit)

Arquivos: nenhum (`noCommit`). Depende da Tarefa 2 e, por ela, da Tarefa 1.

Passos:

1. Rode o `embed.mjs --check` nos 4 alvos, os dois `size.test.mjs`, a suíte inteira (G1) e `lint-plugin.mjs plugins/productivity-tools`. As linhas de evidência de AC1, AC2 e AC4 não rodam aqui como fecho do critério: `gates.test.mjs` do roadmap-release e os demais itens são do B2.
2. Meça e informe no relatório os caracteres LF de `coordinator.js` (até 88.187) para o B2 partir deles.
3. Se algo falhar, devolva o defeito com o arquivo e não corrija aqui.

### Tarefa 4: B1: sonda paga AC2b (efeito do B2; recusar no B1)

Arquivos: nenhum (`noCommit`).

Passos:

1. Esta tarefa existe porque o `plan-tool check` exige uma tarefa externa que cubra cada efeito externo da spec (X1 e X2; sem ela o check dá `external-effect-unperformed`). A sonda, o roteiro em `tools/measure/` e a linha em `measurements.md` são do B2 (AC3, H1 e H2 da spec).
2. No B1, o dono recusa a autorização deste passo (`refused`), e ele fica parado sem ser lançado. Se for lançado por engano, o executor não roda nada, não chama `claude -p`, não liga o context-mode e devolve que o passo pertence ao B2.
3. Efeitos marcados, nunca feitos aqui: X1 (6 execuções reais de `claude -p`, teto somado de US$ 1, DEC-029) e X2 (ligar o context-mode só na config descartável do `CLAUDE_CONFIG_DIR`).

## Evidência dos critérios

| Critério | Tipo | Comando | Externo | Fechado por |
|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` | false | B1 (Tarefa 2), com `capture.test.mjs` do plano A |
| AC2 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false | B1 (Tarefa 1), com `signed-output.test.mjs` do plano A |
| AC3 | human | - | false | B2 (roteiro e sonda) e o dono (H1) |
| AC4 | test | `node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs` | false | B1 (Tarefa 2) para o coordinator; `gates.test.mjs` do roadmap-release é do B2 |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs` | false | B2, com `capture.test.mjs` do plano A |
| AC6 | test | `node --test plugins/productivity-tools/scripts/copy-budget.test.mjs` | false | plano A; B1 mantém (Tarefa 1) e reconfere (Tarefa 3) |
| AC7 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false | plano A; B1 reconfere (Tarefas 1 e 3) |
| AC8 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs` | false | plano A; reconferido na Tarefa 3 (suíte inteira) |

O B1 fecha a parte do `coordinator.js` de AC1, AC2 e AC4. O que depende do `roadmap-release.js`, dos contratos dos agentes, da documentação e da sonda (AC3, AC5 e o resto de AC4) fica no B2.

## Decisões do plano

- R1: o B1 é a divisão do plano B decidida na DEC-035 (dono via Fable): só as Tarefas 5 e 6 do plano B, para rodar no coordinator instalado com estado pequeno. O plano B não é editado.
- R2: a Tarefa 4 é uma tarefa externa só de marcação para X1 e X2, recusada no B1, como a Tarefa 13 do plano A; a sonda real fica no B2.
- R3: os títulos começam com `B1:`, para separar os commits dos do plano A e do B2, que têm o mesmo id.
- R4: o orçamento de `coordinator.js` (até 88.187 caracteres LF) é compartilhado com a T7 do plano B, agora no B2; a Tarefa 3 informa a medida para o B2.

```json data
{
  "schema": "plan/1",
  "id": "E41",
  "title": "Saída de script sem recópia por LLM (parte B1: coordinator.js lê em fatias e mede portões pelo capture.mjs)",
  "spec": "../spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Pré-condição: o plano A (docs/plans/pos-2-3-0-E41/plan.md) está integrado na branch; este plano não edita lib/*.mjs, scripts/capture.mjs, scripts/test-extract.mjs, skills/plan-coordinator/scripts/progress.mjs nem os testes do plano A; se faltar algo deles, a tarefa devolve BLOCKED.",
    "Só as Tarefas 5 e 6 do plano B (DEC-035); o plano B (plano-b/plan.md) não é editado; o resto, os efeitos X1 e X2 e a sonda ficam no B2.",
    "Não editar coordinator-agy.py nem scripts/agy-bridge.py; não remover --page nem READ_PAGE_CHARS do progress.mjs; S_RUN mantém a mesma lista required.",
    "Não escrever o literal do limite de cópia em algarismos sem separador em arquivo não-teste do plugin fora de lib/plan-digest.mjs (usar MAX_COPY_BYTES; em prosa, 3,500 ou 3.500) e não citar a palavra proibida por independence.test.mjs em arquivo não-teste do plugin.",
    "coordinator.js fica com no máximo 88.187 caracteres LF (R14 da spec; orçamento compartilhado com a T7 do B2) e o teto de 120.000 de size.test.mjs não muda; se passar de 88.187, a tarefa para e reporta a medida no relatório, sem cortar funcionalidade.",
    "Provas só em <git-dir absoluto>/pt-evidence/; nada gravado na árvore de trabalho nem em docs/; relatório cita só path, sha256 e exit (DEC-026).",
    "Nenhuma tarefa escreve em docs/plans/roadmap-pos-2-3-0/.",
    "Nenhuma chamada paga (claude -p) e nenhum efeito externo no B1; a Tarefa 4 é recusada (DEC-029).",
    "Branch release/pos-2.3.0 (DEC-008), um commit por tarefa feito pelo coordinator."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "B1: leitura assinada do coordinator por fatias com retry por fatia",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "coordinator.js: readSigned(label, first) lê progress.mjs read --slice com até 3 tentativas por fatia e junta por joinSlices",
        "coordinator.js: CAPTURE (caminho de scripts/capture.mjs derivado de args.progress) e copyFits(stdout)"
      ],
      "consumes": [],
      "covers": ["AC2", "AC6", "AC7", "C1", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0 com 40 passos lidos fatia a fatia e só a fatia resumida com -retry2" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs", "expect": "exit 0 (agy intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=88187?0:1)\"", "expect": "exit 0 com no máximo 88187 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "B1: linha de base e portão de onda do coordinator pelo capture.mjs com extrator",
      "deps": [1],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "coordinator.js: runCapture({ argv | bash, task, label, phase, tests, cwd }) devolve o JSON conferido por checkCapture ou null",
        "coordinator.js: função pura waveGateOf(cap) devolve { exit, failedNames } e nunca passa formato unknown nem lista cortada"
      ],
      "consumes": [
        { "task": 1, "sig": "coordinator.js: CAPTURE (caminho de scripts/capture.mjs derivado de args.progress) e copyFits(stdout)" }
      ],
      "covers": ["AC1", "AC4", "C3", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0 com o evento baseline vindo do JSON conferido do capture" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs", "expect": "exit 0 (agy intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=88187?0:1)\"", "expect": "exit 0 com no máximo 88187 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "B1: conferência final do B1 (sem commit)",
      "deps": [2],
      "files": {
        "create": [],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [
        "caracteres LF de coordinator.js depois do B1, informados no relatório"
      ],
      "consumes": [],
      "covers": ["AC5", "AC8", "C5"],
      "testFirst": {
        "exempt": "Conferência sem código: roda o embed, os testes de tamanho, a suíte inteira e o lint do plugin."
      },
      "checks": [
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0 sem linha stale" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0 (roadmap-release.js abaixo de 290.000 caracteres LF pela DEC-034; coordinator.js até 120.000)" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=88187?0:1)\"", "expect": "exit 0 com no máximo 88187 caracteres LF; a medida impressa vai no relatório" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    },
    {
      "n": 4,
      "title": "B1: sonda paga AC2b (efeito do B2; recusar no B1)",
      "deps": [3],
      "files": {
        "create": [],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 2 },
      "produces": [],
      "consumes": [],
      "covers": ["AC3", "X1", "X2"],
      "testFirst": {
        "exempt": "Passo externo só de marcação: a sonda paga é feita no B2 e este passo é recusado no B1."
      },
      "checks": [
        { "cmd": "git grep -n \"E41\" -- docs/plans/roadmap-pos-2-3-0/measurements.md", "expect": "no B1, nenhuma linha da sonda AC2b do E41; a linha só nasce no B2" }
      ],
      "locks": [],
      "external": true,
      "externalDedupe": "A sonda roda uma vez só, no B2, com --max-budget-usd por execução e soma limitada a US$ 1 (DEC-029); no B1 o passo é recusado (refused) e nunca lançado, e um lançamento por engano não executa nada.",
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "human",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC4",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC5",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC6",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC7",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC8",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Por que o plano B foi dividido e o que fica no B1?",
      "decision": "O B1 contém só as Tarefas 5 e 6 do plano B (coordinator.js lê o estado em fatias e mede portões pelo capture.mjs), renumeradas 1 e 2, mais uma conferência final e uma tarefa externa de marcação. O resto do plano B, os efeitos X1 e X2 reais, AC3 e o resto de AC4 ficam no B2.",
      "basis": "DEC-035 (dono via Fable): o plan-coordinator instalado (2.3.0) recopia a leitura inteira do progress.json via script-runner haiku, e com estado grande a cópia falha no digest, como no plano A; o B1 roda nesse coordinator e precisa de estado pequeno.",
      "alternative": "Manter as 13 tarefas num só plano B no coordinator instalado.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como cobrir os efeitos externos X1 e X2 da spec num plano que não faz a sonda?",
      "decision": "A Tarefa 4 é uma tarefa externa só de marcação (noCommit, sem arquivos), dependente da conferência final, que o dono recusa no B1; a sonda real fica no B2.",
      "basis": "O plan-tool check exige uma tarefa externa cobrindo cada efeito externo da spec (external-effect-unperformed); o plan-coordinator nunca lança um passo externo sem revisão prévia e autorização do dono, e um passo recusado fica parado sem efeito. É o mesmo arranjo da Tarefa 13 do plano A.",
      "alternative": "Trazer o roteiro e a sonda para o B1 (dependem de tarefas do B2) ou deixar o check falhar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como os critérios que só fecham com tarefas do B2 aparecem na evidência do B1?",
      "decision": "As linhas de evidência repetem os comandos das marcas da spec, como o plan-tool check exige; AC3 e a parte do roadmap-release de AC4 só fecham no B2. AC5, AC8 e C5, que o plano A fecha, constam em covers da Tarefa 3 só porque o check exige cobertura: a suíte inteira da Tarefa 3 os reconfere. O plan-coordinator não roda as linhas de evidência.",
      "basis": "O check exige uma linha de evidência por critério com o comando da marca da spec (evidence-command-differs).",
      "alternative": "Trocar os comandos pelos arquivos de teste do B1.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como fica o orçamento de caracteres de coordinator.js entre B1 e B2?",
      "decision": "O limite de 88.187 caracteres LF (R14 da spec) é único e compartilhado com a T7 do plano B, agora no B2; o B1 mede e informa o que usou na Tarefa 3, e passar do limite para a tarefa sem cortar funcionalidade.",
      "basis": "R14 da spec e as Tarefas 5 a 7 do plano B, que dividiam cerca de 6 KB.",
      "alternative": "Reservar uma fatia fixa para cada plano.",
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
      "what": "Recusar (refused) a autorização da Tarefa 4 quando o plan-coordinator pedir: a sonda AC2b é do B2. Na execução: revisão opus prévia do passo externo, pedido authorize ao dono, o dono recusa; depois uma pergunta ask sobre o item manual em aberto, respondida \"no\".",
      "why": "Só o dono autoriza ou recusa passos externos; a Tarefa 4 existe só para o check cobrir X1 e X2 (external-effect-unperformed).",
      "blocking": false,
      "workaround": "Todos os commits do plano (Tarefas 1 e 2) já estão feitos antes da pergunta ask; com a Tarefa 4 parada, o B1 fica com um passo externo recusado e nenhum efeito feito."
    }
  ]
}
```
