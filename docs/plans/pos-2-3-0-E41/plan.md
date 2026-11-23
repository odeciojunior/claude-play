# Plano E41 (A) -- Saída de script sem recópia por LLM: biblioteca e scripts

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E41/spec.md`.

**Branch:** `release/pos-2.3.0` (DEC-008), um commit por tarefa (`type(scope): descrição`).

Este é o plano A da divisão decidida na R12 da spec e permitida pela DEC-025. Ele cobre a troca da folga de `size.test.mjs` decidida na DEC-034, a biblioteca (`lib/plan-digest.mjs` com embed), `scripts/capture.mjs`, `scripts/test-extract.mjs`, `--slice` em `progress.mjs read`, `verify-run.mjs read` e `preflight.mjs discover`, `review-package.mjs` com `sha256` e `lines`, e o teste `copy-budget.test.mjs`. O plano B, em `docs/plans/pos-2-3-0-E41/plano-b/plan.md`, cobre os dois workflows (`coordinator.js` e `roadmap-release.js`), as cargas B07, os contratos dos agentes, a documentação e o roteiro da sonda AC2b. O plano A tem 13 tarefas, abaixo do limite de cerca de 15 passos da DEC-025, porque roda no plan-coordinator da 2.4.0, que ainda recopia a leitura inteira do `progress.json`.

## Cobertura dos critérios pelo plano A

Os ids são os do bloco da spec (o rótulo do cartão vem entre parênteses).

| Critério | No plano A | O que fica para o plano B |
|---|---|---|
| AC1 (AC1) | em parte: `capture.mjs run` e `capture.test.mjs` (12,7 KB, 400 linhas, `bytes`/`sha256` iguais à execução direta, JSON até 3.500 bytes) | `slices.test.mjs` e o evento `baseline` do `coordinator.js` vindo do JSON conferido |
| AC2 (AC2a) | em parte: `sliceEnvelopes`/`checkSlice`/`joinSlices`/`sha256Hex` com `signed-output.test.mjs`, e `progress.mjs read --slice` | `readSigned` por fatias no `coordinator.js`, retry só da fatia, `slices.test.mjs` |
| AC3 (AC2b) | nada; a T13 só marca os efeitos X1 e X2 e fica recusada no plano A | roteiro em `tools/measure/`, sonda paga e linha em `measurements.md` |
| AC4 (AC3) | em parte: `test-extract.mjs` com `test-extract.test.mjs` (63 testes, TAP e spec) e `capture.mjs run --tests` | `gateFromCapture` (`gates.test.mjs`), portão de onda (`gate.test.mjs`), `runTest` e portões pelos workflows |
| AC5 (AC4) | em parte: `commandDigest`/`checkCapture` e o par exit 1/exit 0 de 7 KB na ponta do script (`capture.test.mjs`) | `testFirstGap` com `{noncePrefix}` e `review.test.mjs` |
| AC6 (AC5) | inteiro: `copy-budget.test.mjs` sobre `capture.mjs run`/`slice`, `progress.mjs read --slice`, `verify-run.mjs read` com `slice` e `preflight.mjs discover --slice`, e a varredura do literal `3500` | o uso da constante embutida pelos workflows antes do parse |
| AC7 (AC6) | inteiro: `progress.test.mjs` com passo de 5 KB e `signed-output.test.mjs` na fronteira de par substituto | - |
| AC8 (AC7) | inteiro: `capture.test.mjs` por Git Bash e PowerShell, `C:/...` com exit 3 e `/tmp/x` com saída 2 | - |

Casos de borda: C1 e C5 inteiros no plano A; C2 em parte (`joinSlices` recusa a mistura; o recomeço da leitura é do plano B); C3 em parte (`format:'unknown'` e o exit vindo do capture; o portão e o fallback do agente de medição são do plano B); C4 em parte (`failedNamesCut` no JSON do capture; a regra de nunca passar uma falha com lista cortada é do plano B).

As linhas de evidência abaixo repetem os comandos das marcas da spec, como o `plan-tool check` exige. As linhas de AC1 e AC2 citam `slices.test.mjs`, que só o plano B cria; as de AC4 e AC5 rodam `gates.test.mjs`, `gate.test.mjs` e `review.test.mjs`, que já existem, mas só ganham os casos do E41 no plano B. Por isso AC1, AC2, AC4 e AC5 só fecham no plano B. O plan-coordinator não roda as linhas de evidência; as tarefas do plano A rodam só os arquivos de teste que elas mesmas criam ou mudam, e a conferência final do plano A (T12) roda o G1, não essas evidências.

## Contexto lido

- `plugins/productivity-tools/lib/plan-digest.mjs` (27 linhas): `canon`, `fnv1a`, `planDigest`. Embutido com `exports="strip"` em `coordinator.js` (linhas 786-814), `roadmap-release.js` (linhas 1246-1274) e `scripts/fixtures/plan-tool/workflow-copy.js` (linha 59); `check-roadmap.mjs` não o embute, mas é um dos 4 alvos do `embed.mjs --check` da regra `.claude/rules/workflows-and-lib.md`.
- `plugins/productivity-tools/scripts/embed.mjs`: `IMPURE_RE` (linha 5) recusa `import`, `require(`, `process`, `Buffer` e `crypto` em qualquer ponto do código, fora de comentários.
- `plugins/productivity-tools/scripts/agy-bridge.py`: `LIB_MODULES` (linha 16) e `CALL_LIB_JS` (linhas 20-32) juntam por `Object.assign` os exports de `routing`, `agy-routing`, `plan-digest`, `external-auth`, `progress-state` e `roadmap-format`; um export novo com nome repetido sobrescreveria outro sem aviso. `coordinator-agy.py` (linhas 30-50) declara um `checkSigned` próprio dentro de uma função aninhada, o que não colide com o export.
- `coordinator.js`: `checkSigned` nas linhas 867-877, dentro de `// <pure>` (31-1064); testado em `workflow/gate.test.mjs` (linhas 51-59) por `loadPure`. `failedTestNames` e `waveGatePasses` (linhas 841-865) ficam para o plano B. `RUN_TAG = fnv1a(A.runToken)` (linha 1076) e `nonceOf` (linha 1097).
- `roadmap-release.js`: `checkRun` nas linhas 1276-1286, dentro de `// <pure>` (56-1292); `roadmap-release-agy.py:228` o chama por `call_pure`. `testFirstGap(task, impl, resumed)` na linha 808. Os campos `disc.<campo>` lidos ficam entre as linhas 1515 e 2933. Hoje tem 244.883 caracteres LF.
- `skills/roadmap-release/workflow/size.test.mjs`: teto de 300.000 (linha 11), comentário do topo nas linhas 5-10 e, na linha 21, `MAX_WORKFLOW_CHARS - size > 50000`. A DEC-034 troca essa folga por `> 10000` (gatilho de 290.000 da DEC-003), o que a T1 faz. O orçamento de `roadmap-release.js` é de até 259.883 caracteres LF (R14); o teste exige abaixo de 290.000 (DEC-034). `skills/plan-coordinator/workflow/size.test.mjs`: teto de 120.000 e a conferência de que o embutido não está defasado (linha 24).
- `skills/plan-coordinator/scripts/progress.mjs` (475 linhas): `READ_PAGE_CHARS` e `readPages` (linhas 87-99), `signed` (linha 33), `parseArgs` de `read` (linha 262), `read` (linhas 383-404). `progress.test.mjs` (1423 linhas): `initSandbox`, `bigState` e as leituras por `--page` (linhas 1249-1420).
- `skills/roadmap-release/scripts/preflight.mjs` (690 linhas): `discoverRoadmap` (linha 453), `DISCOVERY_PAGE_CHARS` e `discoveryPages` (linhas 633-648), `discoverCli` (linhas 650-668). `preflight.test.mjs`: `discRepo`, `disc` e `discCli` (linhas 848-860), teste de `--page` (linha 1021).
- `skills/roadmap-release/scripts/verify-run.mjs` (470 linhas): `buildRead` (linhas 150-191, orçamento de 7.900 caracteres; devolve `{exits, status, brief, pendingDecisions, head, porcelain, clean}`, sem `tool`, `mode` nem `nonce`), `runRead` (linhas 193-197, que acrescenta `{tool, mode: 'read', nonce}`), `REQUIRED.read` (linha 431), `cli` (linhas 436-462). `verify-run.test.mjs`: leituras nas linhas 164-213.
- `plugins/productivity-tools/scripts/review-package.mjs` (83 linhas): `buildPackage` devolve `{ok, path, base, tip, commits, bytes}` (linha 70). Testado em `review-package.test.mjs`.

## Tarefas

### Tarefa 1: Troca da folga de size.test.mjs para > 10000 (DEC-034)

Arquivos: modificar só `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`.

Passos:

1. Na linha 21, trocar a asserção `MAX_WORKFLOW_CHARS - size > 50000` por `MAX_WORKFLOW_CHARS - size > 10000`, com a mensagem de falha citando a DEC-034 e a DEC-003 (folga mínima de 10.000, gatilho de 290.000 caracteres LF).
2. No comentário do topo (linhas 5-10), acrescentar uma linha: o arquivo tem de ficar abaixo de 290.000 caracteres LF, o gatilho da DEC-003, pela folga de 10.000 da DEC-034. O teto `MAX_WORKFLOW_CHARS = 300000` e o segundo teste não mudam.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` e fazer o commit `test(productivity-tools): E41 A T1 folga do workflow alinhada ao gatilho da DEC-003 (DEC-034)`.

### Tarefa 2: Fatias, SHA-256 puro e conferência do capture em lib/plan-digest.mjs

Arquivos: modificar `plugins/productivity-tools/lib/plan-digest.mjs`; criar `plugins/productivity-tools/scripts/signed-output.test.mjs`; regenerar o embutido em `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`, `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` e `plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js` (só pelo `embed.mjs`, sem edição à mão).

O `plan-tool check` avisa `task-too-wide` (5 arquivos) nesta tarefa. O aviso fica: separar a regeneração dos 3 alvos numa tarefa própria deixaria a árvore vermelha entre tarefas, porque `size.test.mjs` do coordinator e `plan-tool.test.mjs` falham com cópia defasada (R3).

Passos:

1. Teste primeiro em `plugins/productivity-tools/scripts/signed-output.test.mjs` (importa de `../lib/plan-digest.mjs` e `node:crypto` só no teste):
   - `MAX_COPY_BYTES === 3500` e `SLICE_BYTES === 3072`.
   - `utf8Length` igual a `Buffer.byteLength(s, 'utf8')` para ASCII, acentos, CJK e emoji.
   - `sha256Hex` igual a `createHash('sha256').update(s, 'utf8').digest('hex')` para texto vazio, `abc`, 1 MB gerado e texto com pares substitutos.
   - `sliceEnvelopes(head, text)` sobre um texto de cerca de 19 KB: todo envelope serializado tem `utf8Length(JSON.stringify(env)) <= SLICE_BYTES`; `slice` vai de 0 a `slices - 1`; `total` é igual em todos; `digest` de cada envelope é `fnv1a(JSON.stringify(canon(env sem digest)))`.
   - C1: texto com caracteres de vários bytes e um emoji posicionado para cair exatamente na fronteira de uma fatia; nenhum `text` de envelope termina num substituto alto nem começa num substituto baixo, e `joinSlices` devolve o texto com o mesmo `sha256Hex`.
   - `checkSlice(env, {tool, command, nonce, slice})` aceita o envelope certo e recusa tool, comando (`env.command ?? env.mode`), nonce, índice ou digest diferentes.
   - `joinSlices` recusa contagem errada, ordem trocada, fatia faltando, `total` diferente entre envelopes (C2) e texto remontado cujo SHA não bate.
   - `commandDigest({argv})` e `commandDigest({bash})` iguais a `fnv1a(JSON.stringify(canon(x)))`.
   - `checkCapture(stdout, opts)`: recusa antes do parse um stdout com mais de `MAX_COPY_BYTES` bytes; recusa JSON inválido, `tool` diferente de `capture`, campo `error`, nonce diferente (ou fora de `noncePrefix`), `cmdDigest` diferente e digest adulterado; aceita a linha certa e devolve `data`.
   - Rodar `node --test plugins/productivity-tools/scripts/signed-output.test.mjs` e confirmar a falha.
2. Implementar em `plugins/productivity-tools/lib/plan-digest.mjs`, sem as palavras `process`, `Buffer`, `crypto`, `import` e `require` no código (nem em strings ou identificadores) e com um comentário curto por função:
   - `export const MAX_COPY_BYTES = 3500;` e `export const SLICE_BYTES = 3072;` (o literal `3500` só aqui).
   - `export function utf8Length(str)` e `export function sha256Hex(str)` (codificação UTF-8 feita à mão a partir de `codePointAt`, SHA-256 em JS puro com `Math.imul`/`>>> 0`).
   - `export function sliceEnvelopes(head, text)`: corte guloso por ponto de código, medindo o envelope serializado inteiro; recalcula se o número de dígitos de `slices` mudar.
   - `export function checkSlice(env, { tool, command, nonce, slice })` → `{ ok, why }`.
   - `export function joinSlices(envs)` → `{ ok: true, text }` ou `{ ok: false, why }`.
   - `export function commandDigest(cmd)` e `export function checkCapture(stdout, { nonce, noncePrefix, cmdDigest } = {})` → `{ ok: true, data }` ou `{ ok: false, why }`; o digest conferido é `fnv1a(JSON.stringify(canon(linha sem digest)))`.
3. Regenerar e conferir o embutido: `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js` e depois o mesmo com `--check`.
4. Conferir que `roadmap-release.js` fica em até 259.883 caracteres LF (R14); o teste exige abaixo de 290.000 (DEC-034, `size.test.mjs`). Se passar do orçamento, encurtar comentários e nomes locais em `lib/plan-digest.mjs`, nunca afrouxar o teste.
5. Rodar as conferências da tarefa e fazer o commit `feat(productivity-tools): E41 A T2 fatias, sha256 e checkCapture em plan-digest`.

### Tarefa 3: checkSigned e checkRun como fonte única em lib/plan-digest.mjs

Arquivos: modificar `plugins/productivity-tools/lib/plan-digest.mjs`, `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`, `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` e `plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js` (este só pelo `embed.mjs`).

Passos:

1. Mover `checkSigned(out, nonce, command)` de `coordinator.js` (linhas 867-877) e `checkRun(stdout, tool, nonce)` de `roadmap-release.js` (linhas 1276-1286) para `lib/plan-digest.mjs` como `export function`, com o mesmo corpo, as mesmas mensagens e o mesmo formato `{nonce, data}` da discovery (R4 e R9 da spec). Apagar as definições locais nos dois workflows; o embutido passa a trazê-las, ainda dentro de `// <pure>`, então `loadPure` e o `call_pure` do agy continuam vendo `checkRun`.
2. Regenerar o embutido nos 4 alvos (mesmo comando da Tarefa 2) e conferir com `--check`.
3. Conferir que nenhum outro módulo de `LIB_MODULES` exporta `checkSigned`, `checkRun` ou os nomes da Tarefa 2: `git grep -nE "export (function|const) (checkSigned|checkRun|utf8Length|sha256Hex|sliceEnvelopes|checkSlice|joinSlices|commandDigest|checkCapture|MAX_COPY_BYTES|SLICE_BYTES)\b" -- plugins/productivity-tools/lib` só acha `plan-digest.mjs`.
4. Rodar os testes que já exercitam as duas funções pelos workflows e pelo agy e fazer o commit `refactor(productivity-tools): E41 A T3 checkSigned e checkRun em plan-digest`.

### Tarefa 4: Extrator determinístico de saída do node:test

Arquivos: criar `plugins/productivity-tools/scripts/test-extract.mjs` e `plugins/productivity-tools/scripts/test-extract.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/scripts/test-extract.test.mjs`:
   - Gerar num diretório temporário (`fs.mkdtempSync(path.join(os.tmpdir(), ...))`) a suíte de 63 testes, recriando `suite/big.test.js`: 60 que passam e 3 que falham, chamados `FAIL_A`, `FAIL_B` e `FAIL_C`, com um `describe` e subtestes indentados.
   - Rodar a suíte com `node --test --test-reporter=tap` e com `--test-reporter=spec` (`spawnSync`), e conferir nos dois formatos `{format: 'node-tap' | 'node-spec', exit: 1, total: 63, pass: 60, fail: 3, skipped: 0, failedNames: ['FAIL_A', 'FAIL_B', 'FAIL_C']}`.
   - Conferir que as suítes não contam como teste nem como falha, que a seção "failing tests" do formato spec não duplica nomes, que `# SKIP`/`# TODO` e a duração `(Xms)` saem do nome, e que `failedNames` sai sem repetição e ordenado.
   - C3: texto que não é `node:test` dá `{format: 'unknown', total: null, pass: null, fail: null, skipped: null, failedNames: []}` com o `exit` recebido.
   - Rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs` e confirmar a falha.
2. Implementar `plugins/productivity-tools/scripts/test-extract.mjs`:
   - `export function extractTests(text, exit)` → `{ format, exit, total, pass, fail, skipped, failedNames }`; o `exit` vem de quem chama (o capture), nunca do texto.
   - `node-tap`: `# tests N`, `# pass N`, `# fail N`, `# skipped N` e `not ok N - nome` em qualquer indentação, ignorando o ponto cujo bloco YAML tem `type: 'suite'`.
   - `node-spec`: `ℹ tests N`, `ℹ pass N`, `ℹ fail N`, `ℹ skipped N` e `✖ nome (Xms)`, parando de colher nomes na seção "failing tests".
   - CLI mínima: `node test-extract.mjs <arquivo> [--exit <n>]` imprime o JSON.
3. Rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T4 extrator de saida do node:test`.

### Tarefa 5: capture.mjs run com prova gravada no git-dir e JSON assinado

Arquivos: criar `plugins/productivity-tools/scripts/capture.mjs` e `plugins/productivity-tools/scripts/capture.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/scripts/capture.test.mjs`, sempre num repositório git temporário (`git init` em `os.tmpdir()`), nunca no repositório do plugin:
   - AC1: gerar um script de 400 linhas (cerca de 12,7 KB); rodar `node capture.mjs run --nonce N1 --task E41-T1 --cwd <repo> -- node <script>` e o mesmo script direto por `spawnSync`; conferir `exit === 0`, `bytes` e `sha256` iguais aos da execução direta, `path` com barras normais dentro de `<git-dir>/pt-evidence/E41-T1/`, arquivo gravado com 400 linhas, `lines === 400` e linha JSON com até 3.500 bytes (`utf8Length` e `MAX_COPY_BYTES` de `lib/plan-digest.mjs`); a linha passa em `checkCapture(stdout, {nonce: 'N1', cmdDigest: commandDigest({argv})})`.
   - AC5 na ponta do script: o mesmo comando de 7 KB ou mais que sai 1 e, depois de trocar um arquivo de controle, sai 0; dois JSON com o mesmo `cmdDigest`, `exit` 1 e depois 0, ambos aceitos por `checkCapture` com `noncePrefix` `TAG:E41:T1:` e recusados com digest adulterado ou nonce fora do prefixo.
   - `--tests`: a suíte de 63 testes (gerador local, como na Tarefa 4) dá `extract.failedNames = ['FAIL_A', 'FAIL_B', 'FAIL_C']` e `extract.total = 63`; C4: com 200 falhas de nomes longos, `extract.failedNamesCut > 0` e o JSON continua até `SLICE_BYTES`.
   - C3: um comando que não é `node:test` e sai 1 dá `exit: 1` e `extract.format === 'unknown'`.
   - AC8: chamar o `capture.mjs` por `bash -c` e por `powershell -NoProfile -Command` (cada um pulado com motivo quando o shell não existe), com `--cwd C:/...` (o repositório temporário em barras normais) e `-- node -e "process.exit(3)"`, conferindo que o processo e o JSON saem com 3; `--bash` com a string `exit 4` sai 4.
   - AC8 e C5: com `platform: 'win32'` injetado na função exportada, `--cwd /tmp/x` dá `{tool: 'capture', error: 'caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...'}` e saída 2; `--task` com `/` dá saída 2; nos dois casos nada é executado nem gravado.
   - Limpeza de 14 dias: um arquivo em `pt-evidence` com `mtime` de 15 dias some no começo do `run`; um de 13 dias fica.
   - Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e confirmar a falha.
2. Implementar `plugins/productivity-tools/scripts/capture.mjs` com `export function runCapture(argv, { platform = process.platform, env = process.env, now = Date.now } = {})` → `{ code, line }`, e a CLI que imprime `line` e sai com `code`:
   - Uso: `node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash "<string>")`. `--task` contra `^[A-Za-z0-9._-]+$`; `--nonce` contra `^[A-Za-z0-9:._@-]{1,160}$`; no win32, `--cwd` que comece com uma única `/` é recusado com o erro acima e saída 2.
   - `git rev-parse --absolute-git-dir` a partir de `--cwd` (padrão: o diretório atual); fora de um repositório git, erro claro e saída 2.
   - `spawnSync` com `shell: false` e `maxBuffer` de 512 MiB. Com `--bash`, a string vai como um argumento a `-c` do Git Bash, achado por `PT_BASH` ou por `git --exec-path` (`<raiz do git>/bin/bash.exe`) no win32, e por `PT_BASH` ou `bash` fora dele; programa inexistente dá erro claro e saída 2. `exit` é `status ?? 1`.
   - Grava `<seq>-stdout.txt` e `<seq>-stderr.txt` em `<git-dir>/pt-evidence/<task>/`, com `seq` de 4 dígitos (maior existente + 1, abertura com `wx`, nova tentativa em `EEXIST`). Antes, apaga arquivos de `pt-evidence` com mais de 14 dias e pastas de tarefa vazias.
   - Linha JSON `{tool: 'capture', nonce, task, cmdDigest, exit, bytes, sha256, lines, path, stderrBytes, stderrSha256, stderrPath, tail, tailCut, extract?, digest}`: `cmdDigest = commandDigest({argv})` ou `commandDigest({bash})`; `bytes`, `sha256` e `lines` do stdout bruto; `tail` com até as 40 últimas linhas, tiradas do começo até a linha caber em `SLICE_BYTES` (a última linha cortada pelo começo se sozinha não couber); `tailCut` é o número de linhas do stdout que não estão inteiras em `tail`; com `--tests`, `extract = extractTests(stdout, exit)` e, se ainda não couber, `failedNames` cortada do fim com `failedNamesCut`; `digest = fnv1a(JSON.stringify(canon(resto)))`.
   - Sai com o exit do comando.
3. Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T5 capture.mjs run`.

### Tarefa 6: capture.mjs slice e prune

Arquivos: modificar `plugins/productivity-tools/scripts/capture.mjs` e `plugins/productivity-tools/scripts/capture.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/scripts/capture.test.mjs`:
   - `slice`: depois de um `run` de 12,7 KB, `node capture.mjs slice --nonce S1 --path <path> --sha <sha256> --slice <k>` para todo `k` devolve envelopes que passam em `checkSlice` e que `joinSlices` remonta com o mesmo `sha256` do `run`; `--sha` diferente do arquivo dá erro e saída 1; `--slice` fora do intervalo dá saída 2; `--path` fora de `<git-dir>/pt-evidence/` dá saída 2; no win32 injetado, `--path /tmp/x` dá o erro msys e saída 2.
   - `prune`: com pastas `E41-T1`, `E41-T2` e `E40-T1` em `pt-evidence`, `node capture.mjs prune --task-prefix E41- --cwd <repo>` apaga só as duas primeiras e imprime `{tool: 'capture', command: 'prune', removed: ['E41-T1', 'E41-T2'], digest}`; prefixo vazio ou com `/` dá saída 2.
   - Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e confirmar a falha.
2. Implementar em `plugins/productivity-tools/scripts/capture.mjs`:
   - `slice --nonce <n> --path <arquivo> [--cwd <dir>] --sha <sha256> --slice <k>`: lê o arquivo, confere `sha256Hex` do texto contra `--sha` e imprime `sliceEnvelopes({tool: 'capture', command: 'slice', nonce}, texto)[k]`.
   - `prune --task-prefix <p> [--cwd <dir>]`: apaga as pastas de `<git-dir>/pt-evidence/` cujo nome começa com o prefixo e imprime a linha assinada.
3. Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T6 capture.mjs slice e prune`.

### Tarefa 7: progress.mjs read --slice com payload determinístico

Arquivos: modificar `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs` e `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`:
   - Plano sintético de 40 passos (cerca de 19 KB, recriando `progress/plan.md` do intake) iniciado pelo sandbox existente: `read --nonce N --slice k` para todo `k` devolve envelopes com até 3.072 bytes que passam em `checkSlice({tool: 'progress', command: 'read', nonce, slice: k})`; `joinSlices` remonta `{root, planChanged, stateDigest, state}` igual ao estado do arquivo sem `history`.
   - AC7: um passo com título e descrição de 5 KB, com caracteres de vários bytes e um emoji na fronteira, atravessa várias fatias, todas até 3.072 bytes, e `joinSlices` devolve o estado original.
   - Duas chamadas seguidas (nonces diferentes) dão o mesmo `total.sha256`; o `now` fica só no envelope.
   - `--slice` fora do intervalo dá saída 2; `--slice` junto com `--page` dá saída 2; `--page` continua igual (os testes existentes das linhas 1283-1420 não mudam).
   - Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` e confirmar a falha.
2. Implementar em `progress.mjs`: `--slice` em `parseArgs` de `read` e no `USAGE`; o payload `{root, planChanged, stateDigest, state: {...state, history: []}}` é serializado por `JSON.stringify(canon(payload))` e fatiado por `sliceEnvelopes({tool: 'progress', command: 'read', nonce, now}, texto)`; nada é gravado (R3 da spec). `READ_PAGE_CHARS` e `readPages` ficam só para `--page` (R4/DEC-033).
3. Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T7 progress read --slice`.

### Tarefa 8: verify-run.mjs read em fatias pelo campo slice

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs` e `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`:
   - Com um CLI falso que imprime status e brief longos, o payload `read` com `slice: k` devolve, para todo `k`, um envelope até 3.072 bytes que passa em `checkSlice({tool: 'verify-run', command: 'read', nonce, slice: k})`, e `joinSlices` remonta exatamente a saída de `buildRead` (`exits`, `status`, `brief`, `pendingDecisions`, `head`, `porcelain`, `clean`), sem `tool`, `mode` nem `nonce`.
   - Duas leituras seguidas do mesmo estado com nonces diferentes dão o mesmo `total.sha256` em todas as fatias: o nonce e o `mode` ficam só no envelope.
   - `slice` que não é inteiro de 0 em diante dá saída 2; `slice` fora do intervalo dá erro com o número de fatias; sem `slice`, a saída de hoje não muda.
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e confirmar a falha.
2. Implementar em `verify-run.mjs`: `REQUIRED.read` aceita `slice` opcional inteiro >= 0; com ele, o payload fatiado é a saída de `buildRead` (sem `tool`, `mode` nem `nonce`, que `runRead` acrescenta), e o `cli` imprime `sliceEnvelopes({tool: 'verify-run', mode: 'read', nonce}, JSON.stringify(canon(d)))[slice]`, com `d` a saída de `buildRead`; `nonce` e `mode` vão só no envelope, para que o `total.sha256` seja o mesmo entre fatias e entre leituras (o digest do envelope é o de `sliceEnvelopes`, não o de `signDigest`). `group`, `check` e `procs` não mudam. O comentário de uso do cabeçalho ganha o campo `slice`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T8 verify-run read em fatias`.

### Tarefa 9: preflight.mjs discover --slice sem remover campos

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` e `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`:
   - Com um roadmap de muitos cartões (gerado a partir de `discRepo`), `discover ... --nonce N --slice k` para todo `k` devolve envelopes até 3.072 bytes que passam em `checkSlice({tool: 'release-discovery', command: 'discover', nonce, slice: k})`; `joinSlices` remonta exatamente `discoverRoadmap(...)` com as mesmas opções.
   - Todo `disc.<campo>` lido em `skills/roadmap-release/workflow/roadmap-release.js` (achado por `/\bdisc\.([A-Za-z_]\w*)/g` sobre o texto do workflow) existe no objeto remontado ou é um campo que o próprio workflow escreve (`cards` depois da remontagem por páginas).
   - `--slice` junto com `--page` dá saída 2; `--slice` fora do intervalo dá erro; o teste de `--page` (linha 1021) não muda.
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e confirmar a falha.
2. Implementar em `discoverCli`: `--slice` no regex de opções e no texto de uso; o payload é o objeto inteiro de `discoverRoadmap` (nenhum campo removido), serializado por `JSON.stringify(canon(data))` e fatiado por `sliceEnvelopes({tool: 'release-discovery', command: 'discover', nonce}, texto)`. `DISCOVERY_PAGE_CHARS`, `discoveryPages` e o formato `{nonce, data}` de `--page` ficam sem mudança (R4/DEC-033).
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T9 discover --slice`.

### Tarefa 10: review-package.mjs imprime sha256 e lines do pacote

Arquivos: modificar `plugins/productivity-tools/scripts/review-package.mjs` e `plugins/productivity-tools/scripts/review-package.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/scripts/review-package.test.mjs`: o JSON impresso ganha `sha256` igual ao `createHash('sha256')` do arquivo gravado e `lines` igual ao número de linhas do arquivo; os campos de hoje (`ok`, `path`, `base`, `tip`, `commits`, `bytes`) não mudam. Rodar `node --test plugins/productivity-tools/scripts/review-package.test.mjs` e confirmar a falha.
2. Implementar em `buildPackage`: `sha256` por `createHash('sha256')` de `node:crypto` sobre o texto gravado e `lines` como a contagem de `\n` mais 1 quando o texto não termina em `\n`.
3. Rodar `node --test plugins/productivity-tools/scripts/review-package.test.mjs` e fazer o commit `feat(productivity-tools): E41 A T10 review-package com sha256 e lines`.

### Tarefa 11: Teste copy-budget de nenhuma resposta copiada acima de 3.500 bytes

Arquivos: criar `plugins/productivity-tools/scripts/copy-budget.test.mjs`.

Passos:

1. Escrever `plugins/productivity-tools/scripts/copy-budget.test.mjs`, com geradores próprios no arquivo e tudo em diretórios temporários:
   - `capture.mjs run` com 12,7 KB e com a suíte de 63 testes de nomes longos (`--tests`).
   - `capture.mjs slice` de todas as fatias do stdout de 12,7 KB.
   - `progress.mjs read --slice` de todas as fatias de 40 passos com um passo de 5 KB.
   - `verify-run.mjs read` com `slice`, com brief e status longos (CLI falso).
   - `preflight.mjs discover --slice` de todas as fatias de um roadmap com muitos cartões.
   - Em cada resposta, `utf8Length(stdout) <= MAX_COPY_BYTES`, importados de `../lib/plan-digest.mjs`.
   - Varredura: entre os arquivos não-teste de `plugins/productivity-tools/` (fora de `*.test.mjs` e de `fixtures/`), o literal `\b3500\b` só aparece em `lib/plan-digest.mjs`; os blocos `// <embed src=".../plan-digest.mjs" ...>` até `// </embed>` são tirados antes da busca.
2. Rodar `node --test plugins/productivity-tools/scripts/copy-budget.test.mjs` e fazer o commit `test(productivity-tools): E41 A T11 copy-budget`.

### Tarefa 12: Conferência final do plano A

Arquivos: nenhum (sem commit).

Passos:

1. Rodar o `embed.mjs --check` nos 4 alvos, os dois `size.test.mjs`, a suíte inteira (G1), `claude plugin validate plugins/productivity-tools` e `lint-plugin.mjs plugins/productivity-tools`. As linhas de evidência de AC1, AC2, AC4 e AC5 não rodam aqui: elas só fecham no plano B.
2. Medir e informar no relatório os caracteres LF de `roadmap-release.js` e `coordinator.js` depois do plano A, para o plano B partir deles.

### Tarefa 13: Sonda paga AC2b (efeito do plano B; recusar no plano A)

Arquivos: nenhum (sem commit).

Passos:

1. Esta tarefa existe porque o `plan-tool check` exige uma tarefa externa que cubra cada efeito externo da spec (X1 e X2; sem ela o check dá `external-effect-unperformed`). A sonda depende dos workflows do plano B e é feita lá, com roteiro em `tools/measure/` e a linha em `docs/plans/roadmap-pos-2-3-0/measurements.md` (AC3, H1 e H2 da spec).
2. No plano A, o dono recusa a autorização deste passo (`refused`), e ele fica parado sem ser lançado. Se for lançado por engano, o executor não roda nada, não chama `claude -p`, não liga o context-mode e devolve que o passo pertence ao plano B.
3. Efeitos marcados, nunca feitos aqui: X1 (6 execuções reais de `claude -p`, teto somado de US$ 1, DEC-029) e X2 (ligar o context-mode só na config descartável do `CLAUDE_CONFIG_DIR`).

## Evidência dos critérios

| Critério | Tipo | Comando | Externo |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` | false |
| AC2 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false |
| AC3 | human | - | false |
| AC4 | test | `node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs` | false |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs` | false |
| AC6 | test | `node --test plugins/productivity-tools/scripts/copy-budget.test.mjs` | false |
| AC7 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false |
| AC8 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs` | false |

## Decisões do plano

- R1: o plano A cobre por inteiro AC6, AC7 e AC8, em parte AC1, AC2, AC4 e AC5, e nada de AC3; as linhas de evidência mantêm os comandos da spec, e AC1, AC2, AC4 e AC5 só fecham no plano B.
- R2: a T13 é uma tarefa externa só de marcação para X1 e X2, recusada no plano A.
- R3: os 3 alvos regenerados pelo `embed.mjs` entram em `files` da T2 e da T3, porque o coordinator só faz commit de `files`; a T2 fica com 5 arquivos, dos quais 2 escritos à mão. O aviso `task-too-wide` fica: separar a regeneração deixaria a árvore vermelha entre tarefas.
- R4: `roadmap-release.js` fica em até 259.883 caracteres LF (R14); o teste exige abaixo de 290.000 (DEC-034).
- R5: `discover --slice` não remove campo nenhum da discovery.
- R6: nome das provas `<seq>-stdout.txt` com `seq` de 4 dígitos e cauda de até 40 linhas cortada até caber em `SLICE_BYTES`.
- R7: `checkSlice` confere `env.command ?? env.mode`; cada script tem seu cabeçalho de envelope; no `verify-run.mjs read` em fatias, o payload é a saída de `buildRead`, com `nonce` e `mode` só no envelope.
- R8: `slice` do capture só lê dentro de `<git-dir>/pt-evidence/`.
- R9: `review-package.mjs` calcula o SHA-256 por `node:crypto`.
- R10: geradores de fixtures locais em cada arquivo de teste, sem helper comum.
- R11: a T3 é isenta de teste primeiro (movimento sem mudança de comportamento).
- R12: `extractTests` recebe o `exit` de quem chama.
- R13: a troca da folga de `size.test.mjs` (DEC-034) é a T1, tarefa própria antes do embed da lib, e a T2 depende dela.

## Itens para o dono

- H1 (decisão): recusar a autorização da T13. Na execução, o plan-coordinator faz a revisão opus prévia do passo externo, pede `authorize` ao dono, o dono recusa; depois vem uma pergunta `ask` sobre o item manual em aberto, respondida "no". Todos os commits do plano (T1 a T11) já estão feitos antes dela.
- H2 (resolvido pela DEC-034): a folga de `size.test.mjs` (linha 21) e o orçamento de +15.000 caracteres da spec (R14) não cabiam juntos no plano B. A DEC-034 troca a folga por `> 10000` (gatilho de 290.000 da DEC-003), o que a T1 faz; o orçamento de `roadmap-release.js` segue até 259.883 caracteres LF.

```json data
{
  "schema": "plan/1",
  "id": "E41",
  "title": "Saída de script sem recópia por LLM (plano A: biblioteca e scripts)",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Plano A da R12 da spec: não editar coordinator.js nem roadmap-release.js além do embutido regenerado pelo embed.mjs e da remoção das cópias locais de checkSigned e checkRun (T2); prompts, readSigned, portões, testFirstGap e cargas B07 ficam para o plano B.",
    "Não escrever as palavras process, Buffer, crypto, import nem require no código de lib/plan-digest.mjs (IMPURE_RE de scripts/embed.mjs), nem em strings ou identificadores.",
    "Depois de toda edição de lib/plan-digest.mjs, regenerar e conferir na mesma tarefa: node plugins/productivity-tools/scripts/embed.mjs --check nos 4 alvos (check-roadmap.mjs, roadmap-release.js, coordinator.js, fixtures/plan-tool/workflow-copy.js).",
    "roadmap-release.js até 259.883 caracteres LF ao fim de cada tarefa (R14); o teste exige abaixo de 290.000 (size.test.mjs com folga > 10000 sobre o teto de 300.000, DEC-034, trocada pela T1); coordinator.js até 120.000; os tetos de size.test.mjs não mudam.",
    "Não remover --page, READ_PAGE_CHARS, DISCOVERY_PAGE_CHARS, readPages, discoveryPages, o formato {nonce, data} de checkRun na discovery nem a assinatura de 3 argumentos de testFirstGap (R4/DEC-033, R9 da spec).",
    "Exports novos de lib/plan-digest.mjs sem nome repetido em outro módulo de LIB_MODULES do agy-bridge.py.",
    "O literal 3500 só em lib/plan-digest.mjs entre os arquivos não-teste do plugin (copias embutidas à parte).",
    "Não citar superpowers em arquivo não-teste do plugin (independence.test.mjs).",
    "Provas só em <git-dir>/pt-evidence/, nunca na árvore de trabalho nem em docs/; testes em diretórios e repositórios temporários (os.tmpdir), sem depender de D:/claude-pos23-out/cm-tests/; relatórios citam só path, sha256 e exit (DEC-026).",
    "Não editar docs/plans/roadmap-pos-2-3-0/, plugins/_template/, coordinator-agy.py, roadmap-release-agy.py, scripts/agy-bridge.py nem tools/measure/.",
    "Nenhuma chamada paga (claude -p) e nenhum efeito externo no plano A; a T13 é recusada.",
    "Sem bump de versão (DEC-042); commits na branch release/pos-2.3.0 (DEC-008), um por tarefa, no formato type(scope): descrição.",
    "Comando de teste da suíte: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\".",
    "slices.test.mjs e os casos E41 de gates.test.mjs, gate.test.mjs e review.test.mjs são criados ou estendidos pelo plano B; AC1, AC2, AC4 e AC5 só fecham no plano B; a conferência final do plano A (T12) roda o G1, não essas evidências."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Troca da folga de size.test.mjs para > 10000 (DEC-034)",
      "deps": [],
      "files": {
        "create": [],
        "modify": [],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "size.test.mjs: MAX_WORKFLOW_CHARS - size > 10000 (DEC-034; roadmap-release.js abaixo de 290.000 caracteres LF, gatilho da DEC-003), teto 300.000 mantido"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": {
        "exempt": "A tarefa só troca a folga mínima de uma asserção de teste já existente (DEC-034); o próprio size.test.mjs é a conferência e passa antes e depois da troca."
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com a asserção > 10000 e a mensagem citando DEC-034 e DEC-003"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Fatias, SHA-256 puro e conferência do capture em lib/plan-digest.mjs",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/lib/plan-digest.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js"
        ],
        "test": [
          "plugins/productivity-tools/scripts/signed-output.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 2,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "export const MAX_COPY_BYTES = 3500; export const SLICE_BYTES = 3072",
        "export function utf8Length(str) e export function sha256Hex(str) (SHA-256 dos bytes UTF-8, 64 hex)",
        "export function sliceEnvelopes(head, text) -> [{...head, slice, slices, total: {bytes, sha256}, text, digest}]",
        "export function checkSlice(env, {tool, command, nonce, slice}) -> {ok, why}",
        "export function joinSlices(envs) -> {ok: true, text} | {ok: false, why}",
        "export function commandDigest(cmd) -> fnv1a(JSON.stringify(canon(cmd))), cmd = {argv} ou {bash}",
        "export function checkCapture(stdout, {nonce, noncePrefix, cmdDigest}) -> {ok: true, data} | {ok: false, why}"
      ],
      "consumes": [],
      "covers": [
        "AC2",
        "AC7",
        "C1",
        "C2"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/signed-output.test.mjs",
          "expect": "exit 0, incluindo sha256Hex igual a node:crypto e a fronteira de par substituto"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0 sem linha stale"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs",
          "expect": "exit 0 (roadmap-release.js até 259.883 caracteres LF pela R14 e abaixo de 290.000 pela DEC-034, e cópias não defasadas)"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "checkSigned e checkRun como fonte única em lib/plan-digest.mjs",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/lib/plan-digest.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js"
        ],
        "test": []
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "export function checkSigned(out, nonce, command) e export function checkRun(stdout, tool, nonce) em lib/plan-digest.mjs, embutidos nos workflows"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": {
        "exempt": "Movimento sem mudança de comportamento: checkSigned e checkRun já são testados pelos workflows (gate.test.mjs, flow.test.mjs) e pelo agy (coordinator-agy.test.mjs, roadmap-release-agy.test.mjs), que passam a exercitar a cópia embutida da lib."
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs",
          "expect": "exit 0 com o mesmo comportamento de checkSigned e checkRun"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0 sem linha stale"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "git grep -nE \"export (function|const) (checkSigned|checkRun|utf8Length|sha256Hex|sliceEnvelopes|checkSlice|joinSlices|commandDigest|checkCapture|MAX_COPY_BYTES|SLICE_BYTES)\\b\" -- plugins/productivity-tools/lib",
          "expect": "só linhas de plugins/productivity-tools/lib/plan-digest.mjs"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Extrator determinístico de saída do node:test",
      "deps": [],
      "files": {
        "create": [
          "plugins/productivity-tools/scripts/test-extract.mjs"
        ],
        "modify": [],
        "test": [
          "plugins/productivity-tools/scripts/test-extract.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 0
      },
      "produces": [
        "export function extractTests(text, exit) -> {format, exit, total, pass, fail, skipped, failedNames}"
      ],
      "consumes": [],
      "covers": [
        "AC4",
        "C3"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs",
          "expect": "exit 0 com failedNames = [FAIL_A, FAIL_B, FAIL_C] e total = 63 em TAP e em spec"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "capture.mjs run com prova gravada no git-dir e JSON assinado",
      "deps": [
        2,
        4
      ],
      "files": {
        "create": [
          "plugins/productivity-tools/scripts/capture.mjs"
        ],
        "modify": [],
        "test": [
          "plugins/productivity-tools/scripts/capture.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 2,
        "blast": 1,
        "verifiability": 1
      },
      "produces": [
        "node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash <string>) -> uma linha JSON {tool:'capture', nonce, task, cmdDigest, exit, bytes, sha256, lines, path, stderrBytes, stderrSha256, stderrPath, tail, tailCut, extract?, digest} e saída com o exit do comando",
        "export function runCapture(argv, {platform, env, now}) -> {code, line}"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export const MAX_COPY_BYTES = 3500; export const SLICE_BYTES = 3072"
        },
        {
          "task": 2,
          "sig": "export function utf8Length(str) e export function sha256Hex(str) (SHA-256 dos bytes UTF-8, 64 hex)"
        },
        {
          "task": 2,
          "sig": "export function commandDigest(cmd) -> fnv1a(JSON.stringify(canon(cmd))), cmd = {argv} ou {bash}"
        },
        {
          "task": 2,
          "sig": "export function checkCapture(stdout, {nonce, noncePrefix, cmdDigest}) -> {ok: true, data} | {ok: false, why}"
        },
        {
          "task": 4,
          "sig": "export function extractTests(text, exit) -> {format, exit, total, pass, fail, skipped, failedNames}"
        }
      ],
      "covers": [
        "AC1",
        "AC4",
        "AC5",
        "AC8",
        "C3",
        "C4",
        "C5"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
          "expect": "exit 0: 400 linhas com bytes e sha256 iguais à execução direta, JSON até 3.500 bytes, par exit 1/exit 0 conferido, exit 3 por Git Bash e PowerShell e /tmp/x com saída 2"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "capture.mjs slice e prune",
      "deps": [
        5
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/capture.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/capture.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "node capture.mjs slice --nonce <n> --path <arquivo> [--cwd <dir>] --sha <sha256> --slice <k> -> envelope de sliceEnvelopes({tool:'capture', command:'slice', nonce}, texto)",
        "node capture.mjs prune --task-prefix <p> [--cwd <dir>] -> {tool:'capture', command:'prune', removed, digest}"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export function sliceEnvelopes(head, text) -> [{...head, slice, slices, total: {bytes, sha256}, text, digest}]"
        }
      ],
      "covers": [
        "AC6"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
          "expect": "exit 0 com fatias remontadas pelo mesmo sha256, SHA mudado recusado e prune só do prefixo"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "progress.mjs read --slice com payload determinístico",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "node progress.mjs read <progress.json> --nonce <n> --slice <k> -> envelope de sliceEnvelopes({tool:'progress', command:'read', nonce, now}, JSON canônico de {root, planChanged, stateDigest, state})"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export function sliceEnvelopes(head, text) -> [{...head, slice, slices, total: {bytes, sha256}, text, digest}]"
        },
        {
          "task": 2,
          "sig": "export function joinSlices(envs) -> {ok: true, text} | {ok: false, why}"
        }
      ],
      "covers": [
        "AC2",
        "AC6",
        "AC7"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs",
          "expect": "exit 0: 40 passos e um passo de 5 KB em fatias até 3.072 bytes, remontados por joinSlices; --page sem mudança"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "verify-run.mjs read em fatias pelo campo slice",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "verify-run.mjs read com slice: <k> no payload -> envelope de sliceEnvelopes({tool:'verify-run', mode:'read', nonce}, JSON canônico da saída de buildRead, sem tool/mode/nonce; nonce e mode só no envelope, total.sha256 igual entre fatias)"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export function sliceEnvelopes(head, text) -> [{...head, slice, slices, total: {bytes, sha256}, text, digest}]"
        }
      ],
      "covers": [
        "AC6"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs",
          "expect": "exit 0 com read em fatias até 3.072 bytes, joinSlices igual à saída de buildRead, total.sha256 igual entre fatias e entre nonces, e read sem slice igual ao de hoje"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "preflight.mjs discover --slice sem remover campos",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "node preflight.mjs discover ... --nonce <n> --slice <k> -> envelope de sliceEnvelopes({tool:'release-discovery', command:'discover', nonce}, JSON canônico de discoverRoadmap)"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export function sliceEnvelopes(head, text) -> [{...head, slice, slices, total: {bytes, sha256}, text, digest}]"
        }
      ],
      "covers": [
        "AC6"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
          "expect": "exit 0 com todo disc.<campo> do workflow presente na discovery remontada e --page sem mudança"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 10,
      "title": "review-package.mjs imprime sha256 e lines do pacote",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/review-package.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/review-package.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "review-package.mjs imprime {ok, path, base, tip, commits, bytes, sha256, lines}"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/review-package.test.mjs",
          "expect": "exit 0 com sha256 e lines iguais aos do arquivo gravado"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 11,
      "title": "Teste copy-budget de nenhuma resposta copiada acima de 3.500 bytes",
      "deps": [
        6,
        7,
        8,
        9
      ],
      "files": {
        "create": [],
        "modify": [],
        "test": [
          "plugins/productivity-tools/scripts/copy-budget.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 2,
        "blast": 0,
        "verifiability": 0
      },
      "produces": [
        "plugins/productivity-tools/scripts/copy-budget.test.mjs (AC6: toda resposta copiada até MAX_COPY_BYTES e literal 3500 só em lib/plan-digest.mjs)"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "export const MAX_COPY_BYTES = 3500; export const SLICE_BYTES = 3072"
        },
        {
          "task": 5,
          "sig": "node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash <string>) -> uma linha JSON {tool:'capture', nonce, task, cmdDigest, exit, bytes, sha256, lines, path, stderrBytes, stderrSha256, stderrPath, tail, tailCut, extract?, digest} e saída com o exit do comando"
        },
        {
          "task": 6,
          "sig": "node capture.mjs slice --nonce <n> --path <arquivo> [--cwd <dir>] --sha <sha256> --slice <k> -> envelope de sliceEnvelopes({tool:'capture', command:'slice', nonce}, texto)"
        },
        {
          "task": 7,
          "sig": "node progress.mjs read <progress.json> --nonce <n> --slice <k> -> envelope de sliceEnvelopes({tool:'progress', command:'read', nonce, now}, JSON canônico de {root, planChanged, stateDigest, state})"
        },
        {
          "task": 8,
          "sig": "verify-run.mjs read com slice: <k> no payload -> envelope de sliceEnvelopes({tool:'verify-run', mode:'read', nonce}, JSON canônico da saída de buildRead, sem tool/mode/nonce; nonce e mode só no envelope, total.sha256 igual entre fatias)"
        },
        {
          "task": 9,
          "sig": "node preflight.mjs discover ... --nonce <n> --slice <k> -> envelope de sliceEnvelopes({tool:'release-discovery', command:'discover', nonce}, JSON canônico de discoverRoadmap)"
        }
      ],
      "covers": [
        "AC6"
      ],
      "testFirst": {
        "exempt": "O arquivo é o próprio teste de aceitação AC6 sobre saídas já implementadas e testadas nas tarefas 5 a 9; não há código de produção a escrever depois dele."
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0: nenhuma resposta acima de 3.500 bytes UTF-8 e o literal 3500 só em lib/plan-digest.mjs"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 12,
      "title": "Conferência final do plano A",
      "deps": [
        3,
        10,
        11
      ],
      "files": {
        "create": [],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 0
      },
      "produces": [
        "caracteres LF de roadmap-release.js e coordinator.js depois do plano A, informados no relatório"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": {
        "exempt": "Conferência sem código: roda o embed, os testes de tamanho, a suíte inteira e as validações do plugin."
      },
      "checks": [
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0 sem linha stale"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs",
          "expect": "exit 0 (roadmap-release.js abaixo de 290.000 caracteres LF pela DEC-034; coordinator.js até 120.000)"
        },
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 (G1)"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    },
    {
      "n": 13,
      "title": "Sonda paga AC2b (efeito do plano B; recusar no plano A)",
      "deps": [
        12
      ],
      "files": {
        "create": [],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 2,
        "verifiability": 2
      },
      "produces": [],
      "consumes": [],
      "covers": [
        "AC3",
        "X1",
        "X2"
      ],
      "testFirst": {
        "exempt": "Passo externo só de marcação: a sonda paga é feita no plano B e este passo é recusado no plano A."
      },
      "checks": [
        {
          "cmd": "git grep -n \"E41\" -- docs/plans/roadmap-pos-2-3-0/measurements.md",
          "expect": "no plano A, nenhuma linha da sonda AC2b do E41; a linha só nasce no plano B"
        }
      ],
      "locks": [],
      "external": true,
      "externalDedupe": "A sonda roda uma vez só, no plano B, com --max-budget-usd por execução e soma limitada a US$ 1 (DEC-029); no plano A o passo é recusado (refused) e nunca lançado, e um lançamento por engano não executa nada.",
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
      "question": "Como o plano A trata critérios que só fecham com os workflows do plano B?",
      "decision": "O plano A cobre por inteiro AC6, AC7 e AC8; em parte AC1 (capture.test.mjs), AC2 (signed-output.test.mjs e progress read --slice), AC4 (test-extract.test.mjs e capture --tests) e AC5 (par na ponta do script); nada de AC3. As linhas de evidência repetem os comandos das marcas da spec, e as de AC1, AC2, AC4 e AC5 só fecham no plano B (slices.test.mjs e os casos E41 de gates.test.mjs, gate.test.mjs e review.test.mjs são do plano B); a conferência final do plano A roda o G1, não essas evidências.",
      "basis": "R12 da spec e DEC-025 dividem o E41 em dois planos; o plan-tool check exige linha de evidência com o comando da marca para todo critério e uma tarefa que cubra cada critério executável; o plan-coordinator não roda as linhas de evidência.",
      "alternative": "Trocar os comandos das linhas de evidência pelos arquivos do plano A (o check recusa: evidence-command-differs).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como cobrir os efeitos externos X1 e X2 da spec num plano que não faz a sonda?",
      "decision": "T13 é uma tarefa externa só de marcação (noCommit, sem arquivos), dependente da conferência final, que o dono recusa no plano A; a sonda real fica no plano B.",
      "basis": "O plan-tool check exige uma tarefa externa cobrindo cada efeito externo da spec (external-effect-unperformed); o plan-coordinator nunca lança um passo externo sem revisão prévia e autorização do dono, e um passo recusado fica parado sem efeito.",
      "alternative": "Trazer o roteiro e a sonda para o plano A (depende dos workflows do plano B) ou deixar o check falhar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Os alvos regenerados pelo embed.mjs entram em files mesmo passando de 4 arquivos (aviso task-too-wide)?",
      "decision": "Sim: coordinator.js, roadmap-release.js e workflow-copy.js entram em files.modify da T2 e da T3; a T2 fica com 5 arquivos, dos quais só lib/plan-digest.mjs e signed-output.test.mjs são escritos à mão. O aviso task-too-wide do plan-tool check na T2 fica, sem dividir a tarefa.",
      "basis": "O plan-coordinator só faz commit dos caminhos de files (progress-state.mjs), e o embutido tem de entrar no mesmo commit da lib porque size.test.mjs do coordinator e plan-tool.test.mjs falham com cópia defasada; separar a regeneração deixaria a árvore vermelha entre tarefas.",
      "alternative": "Separar a regeneração numa tarefa própria (portão de onda vermelho no meio) ou pôr os alvos só em writes (ficariam fora do commit).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Qual o orçamento de roadmap-release.js no plano A e o que o teste exige?",
      "decision": "roadmap-release.js até 259.883 caracteres LF (R14); o teste exige abaixo de 290.000 (DEC-034, folga > 10000 trocada na T1). lib/plan-digest.mjs é escrito compacto (comentário de uma linha por função), já contando checkSigned que passa a ser embutido também no roadmap-release.js.",
      "basis": "R14 da spec (orçamento de +15.000 sobre 244.883) e DEC-034 (folga mínima de 10.000, gatilho de 290.000 da DEC-003); o teto de 300.000 não muda.",
      "alternative": "Manter a folga > 50.000 (limite efetivo de 250.000, que não cabe no orçamento da R14; a DEC-034 recusou).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Quais campos a projeção de preflight.mjs discover --slice remove (deixado para o plano pela spec)?",
      "decision": "Nenhum: o payload é o objeto inteiro de discoverRoadmap, e um teste confere que todo disc.<campo> lido em roadmap-release.js existe na discovery remontada.",
      "basis": "discoverRoadmap é determinístico (o runToken é da preflight, não da discovery), e o fatiamento já leva qualquer tamanho a fatias de 3 KB; remover campos traria risco de faltar um campo lido pelo workflow sem ganho no invariante.",
      "alternative": "Remover warnings e campos não lidos pelo workflow para ter menos fatias.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Qual o nome dos arquivos em pt-evidence e o tamanho da cauda (deixado para o plano)?",
      "decision": "<git-dir>/pt-evidence/<task>/<seq>-stdout.txt e <seq>-stderr.txt com seq de 4 dígitos (maior existente + 1, abertura wx); tail com até as 40 últimas linhas, cortadas do começo até a linha JSON caber em SLICE_BYTES, e depois failedNames cortada do fim com failedNamesCut.",
      "basis": "Ordem legível por tarefa e sem colisão entre execuções concorrentes; 40 linhas cobrem o resumo do node:test e cabem no orçamento na maioria dos casos.",
      "alternative": "Nome por carimbo de tempo e fnv1a do nonce, ou cauda por bytes fixos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como checkSlice confere o comando quando verify-run usa mode e não command?",
      "decision": "checkSlice compara env.command ?? env.mode; cabeçalhos: progress {tool:'progress', command:'read', nonce, now}, verify-run {tool:'verify-run', mode:'read', nonce}, discovery {tool:'release-discovery', command:'discover', nonce}, capture {tool:'capture', command:'slice', nonce}. No verify-run.mjs read com slice, o payload fatiado é a saída de buildRead (exits, status, brief, pendingDecisions, head, porcelain, clean), sem tool, mode nem nonce; nonce e mode vão só no envelope, para que o total.sha256 seja o mesmo entre fatias e entre leituras.",
      "basis": "verify-run já assina com mode em todas as saídas; manter o campo evita um formato novo só para as fatias. runRead acrescenta {tool, mode, nonce} ao resultado de buildRead; com o nonce dentro do texto fatiado, cada chamada de fatia (nonce novo) teria outro total.sha256 e joinSlices recusaria a mistura.",
      "alternative": "Acrescentar command ao envelope do verify-run.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Que arquivo capture.mjs slice aceita servir?",
      "decision": "Só arquivos dentro de <git-dir>/pt-evidence/ do --cwd, conferidos pelo sha256 do texto contra --sha; fora disso, saída 2.",
      "basis": "O slice existe para as provas do run (B07, DEC-026); limitar a pasta impede usar o script-runner para ler arquivos arbitrários.",
      "alternative": "Aceitar qualquer caminho legível.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como review-package.mjs calcula o sha256?",
      "decision": "Por createHash('sha256') de node:crypto sobre o texto gravado; lines é a contagem de quebras de linha mais 1 quando o texto não termina em quebra.",
      "basis": "review-package.mjs é script, não fonte pura; o resultado é o mesmo de sha256Hex, testado contra node:crypto na T1.",
      "alternative": "Importar sha256Hex de lib/plan-digest.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Onde ficam os geradores de fixtures (deixado para o plano)?",
      "decision": "Cada arquivo de teste tem seus geradores locais (script de 400 linhas, suíte de 63 testes, plano de 40 passos, roadmap de muitos cartões); não há helper comum.",
      "basis": "Um helper comum seria mais um arquivo nas tarefas de até 4 arquivos e acoplaria testes de tarefas paralelas; os geradores são curtos.",
      "alternative": "Helper comum em scripts/fixtures/.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "A T3 precisa de teste primeiro?",
      "decision": "Não: é isenta, porque só move checkSigned e checkRun sem mudar comportamento, e os testes que já existem nos workflows e no agy exercitam a cópia embutida.",
      "basis": "gate.test.mjs (linhas 51-59) testa checkSigned por loadPure; flow.test.mjs e os testes do agy usam checkRun; um teste novo seria mais um arquivo na tarefa.",
      "alternative": "Acrescentar casos de checkSigned e checkRun em signed-output.test.mjs (quinto arquivo).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "De onde vem o exit de extractTests?",
      "decision": "De quem chama: extractTests(text, exit) devolve o exit recebido; o capture passa o status do processo.",
      "basis": "O texto do node:test não carrega o exit code do processo, e a spec exige que o exit venha de script, não de texto.",
      "alternative": "Inferir o exit de fail > 0.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Onde entra a troca da folga de size.test.mjs decidida na DEC-034?",
      "decision": "Numa tarefa própria no início do plano (T1), que edita só size.test.mjs (asserção > 10000, mensagem citando DEC-034 e DEC-003 e uma linha no comentário do topo sobre o gatilho de 290.000); a tarefa do embed da lib (T2) depende dela.",
      "basis": "DEC-034 (vigente) e R14 da spec; a troca vem antes de qualquer crescimento de roadmap-release.js, e um commit separado deixa a decisão rastreável.",
      "alternative": "Fazer a troca dentro da T2 (sexto arquivo na tarefa) ou deixá-la para o plano B.",
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
      "what": "Recusar (refused) a autorização da T13 quando o plan-coordinator pedir: a sonda AC2b é do plano B. Na execução: revisão opus prévia do passo externo, pedido authorize ao dono, o dono recusa; depois uma pergunta ask sobre o item manual em aberto, respondida \"no\".",
      "why": "Só o dono autoriza ou recusa passos externos; a T13 existe só para o check cobrir X1 e X2 (external-effect-unperformed).",
      "blocking": false,
      "workaround": "Todos os commits do plano (T1 a T11) já estão feitos antes da pergunta ask; com a T13 parada, o plano A fica com um passo externo recusado e nenhum efeito feito. H2 (folga de size.test.mjs) foi resolvido pela DEC-034 e sai da lista."
    }
  ]
}
```
