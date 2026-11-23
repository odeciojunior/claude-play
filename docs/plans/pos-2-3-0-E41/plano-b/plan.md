# Plano E41 (parte B) -- Saída de script sem recópia por LLM: workflows, cargas B07, contratos, documentação e sonda

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E41/spec.md` (R12: este é o plano B; o plano A é `docs/plans/pos-2-3-0-E41/plan.md`).

**Branch:** `release/pos-2.3.0` (DEC-008), um commit por tarefa. O coordinator faz os commits com o assunto `E41 T<n>: <título>`. Por isso todo título começa com `B:`, o que separa os commits deste plano dos do plano A, que tem o mesmo id E41.

**Comando de teste (portão de onda):** `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.

## Pré-condição: o plano A já está integrado

Este plano roda depois do plano A. Ao começar, o código já tem o que a spec põe no plano A:

- `lib/plan-digest.mjs` estendida e embutida nos 4 alvos: `MAX_COPY_BYTES`, `SLICE_BYTES`, `utf8Length`, `sha256Hex`, `sliceEnvelopes`, `checkSlice`, `joinSlices`, `checkSigned`, `checkRun`, `commandDigest` e `checkCapture`;
- `scripts/capture.mjs` com `run`, `slice` e `prune`;
- `scripts/test-extract.mjs`;
- `--slice` em `progress.mjs read`, em `preflight.mjs discover` e em `verify-run.mjs read` (campo `slice` do payload);
- `review-package.mjs` imprimindo `sha256` e `lines`;
- `copy-budget.test.mjs`;
- a asserção de folga de `skills/roadmap-release/workflow/size.test.mjs` já em `> 10000` (DEC-034), trocada pela tarefa inicial do plano A.

No payload de `verify-run.mjs read --slice`, o plano A deixa só os dados de `buildRead`. `tool`, `mode` e `nonce` vão no envelope da fatia.

Este plano não edita nenhum desses arquivos. A Tarefa 1 confere a pré-condição antes de qualquer mudança. Se faltar um export ou o `embed.mjs --check` acusar bloco velho, a tarefa devolve BLOCKED com o nome do que falta (R1). As assinaturas exatas (argumentos de `checkSlice`, `checkCapture` e `commandDigest`, e o formato dos envelopes) são as que o plano A deixou: cada tarefa lê o cabeçalho de `lib/plan-digest.mjs` e de `scripts/capture.mjs` antes de chamá-las.

## Contexto lido

- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` (76.187 caracteres LF):
  - `failedTestNames` (842-855), `waveGatePasses` (858-865) e `checkSigned` (868-877; vai para a lib no plano A);
  - `baselineEvent` (953-958) e `baselineProblem` (961-975);
  - `S_RUN` (1090), `runPrompt` (1095) e `runCmd` (1098-1103);
  - `readSigned` (1139-1172), que hoje pagina por `--page`;
  - `flushChunk` (1179-1210);
  - `implPrompt` (1245-1261) e `finalPrompt` (1283-1296), cuja linha `Diff:` está em 1290;
  - `runTest` (1317) e `ensureBaseline` (1320-1337);
  - o caso `wave-gate` (1483-1499), que usa `failedTestNames(out.stdout)`, e o caso `done` (1532).
- Testes do coordinator:
  - `flow.test.mjs` (682 linhas): o simulador `makeSim` roda de verdade os comandos do script-runner por `execLine`, que lê `cd X && ...` e chama node e git sem shell;
  - `gate.test.mjs` (145 linhas) e `size.test.mjs` (teto de 120.000; confere o embutido).
- `coordinator-agy.py` tem o próprio `checkSigned` no `JS_PRELUDE` e lê os esquemas de `coordinator.js` (`load_js_schemas`).
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (244.883 caracteres LF):
  - portões: `gateSubset` (186-188) e `gatePasses` (218-229);
  - prompts e conferências: `buildImplPrompt` (588), `tailOf`/`fmtChecks` (596-607), `buildTaskReviewPrompt` (608-620, não muda: R10 da spec) e `testFirstGap` (808-813);
  - embutido de `plan-digest` (1246) e `checkRun` (1277-1288);
  - esquemas: `S_GATE`/`S_MEASURE` (1412-1413) e `S_TOOLOUT` (1425);
  - leituras: `runPrompt` (1459), `readBack` (1465-1476), `discCmd` (1479) e `readDisc` com as páginas (1484-1512);
  - medição: `gateDesc` (1616, comando em `def.cmd`), `measureTxt` (1668), passo 4 do preflight (1681) e `gateOnce`/`measuredGroup`/`gates` (1730-1757);
  - `ctxFor` (1853) e a chamada `CLEANUP of deliverable` (2069-2071);
  - `specLoadOnce`/`load3` (2204-2221), `planLoadOnce`/`loadPlan` (2333-2342) e a chamada de `testFirstGap` (2634).
- Testes do roadmap-release:
  - `flow.test.mjs` (5.250 linhas): o mock padrão de `exec` responde `discovery`, `:spec-load\d`, `:plan-load\d` e as medições por `gm`;
  - `gates.test.mjs`, `review.test.mjs` (`testFirstGap` nas linhas 422-500) e `cleanup.test.mjs` (fixa a linha literal do CLEANUP);
  - `prompts.test.mjs`, que fixa frases de `agents/implementer.md` (linhas 357-372 e 447-456) e de `agents/script-runner.md` (DEC-715, linha 424);
  - `size.test.mjs`: teto de 300.000; a asserção de folga passa de `> 50000` a `> 10000` no plano A (DEC-034), e este plano não a edita. O orçamento da R14 da spec continua: até 259.883 caracteres LF.
- `roadmap-release-agy.py` chama por `pure(...)` as funções `buildImplPrompt`, `buildTaskReviewPrompt`, `testFirstGap` (3 argumentos), `checkSpecLoad`, `checkPlanLoad` e `allPass`, e usa `SCHEMAS['S_GATE']`.
- `plugins/productivity-tools/agents/`:
  - `script-runner.md` e `test-integrity.md` (24 linhas cada);
  - `implementer.md` (52 linhas; a regra "nothing piped after it (`| grep`, `| tail`, `| head`)" está nas linhas 43-46);
  - `task-reviewer.md` e `final-reviewer.md`.
- Documentação:
  - `skills/plan-coordinator/SKILL.md` (5.741 bytes LF) entra inteiro no teto de 6.000 de `skills/plan-coordinator/scripts/prose-budget.test.mjs`, com a fronteira `## After the workflow returns`;
  - `references/state.md` (6.758), `skills/roadmap-release/SKILL.md` (23.165) e `references/operator.md` (19.489, com `docs.test.mjs`).
- `.claude/rules/measure.md`: `--work` fora do repositório, config descartável, `--max-budget-usd` e os braços `arms/*-atual.md` iguais ao workflow. `tools/measure/session-metrics.test.mjs` (`scanPrivacy`) recusa UUIDs reais e caminhos pessoais em `tools/measure/`.

## Tarefas

### Tarefa 1: B: roadmap-release lê discovery e readBack por fatias e recusa cópia acima do limite

Arquivos:

- modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`;
- testar em `plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs` (novo) e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Pré-condição (R1). Rode `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`. Confira em `lib/plan-digest.mjs` os exports da pré-condição e, em `size.test.mjs`, a folga `> 10000` (DEC-034). Se algo faltar, devolva BLOCKED. Este plano não edita `size.test.mjs`.
2. Teste primeiro, em `discovery-slices.test.mjs`, com `loadPure()` e o mesmo jeito de rodar o workflow de `flow.test.mjs` (`AsyncFunction` sobre o texto):
   - Discovery de um roadmap sintético com muitos cartões. Gere o payload projetado e os envelopes com `sliceEnvelopes` da lib. O runner falso corta toda resposta acima de 3.500 bytes e devolve `exit` ausente. A discovery passa fatia a fatia. O rótulo da fatia 0 é `discovery` e usa `RUN_TOKEN` como nonce (continua a primeira chamada `agent()`). As demais são `discovery-slice<k>`, com nonce próprio.
   - Um envelope adulterado em uma fatia faz só essa fatia ganhar `discovery-slice<k>-retry2`.
   - Caso C2: fatias com `total.sha256` diferente entre si fazem `joinSlices` recusar. O workflow descarta tudo e recomeça a leitura uma vez. Sem acerto na segunda leitura, o erro é `discovery failed: ...`.
   - Todo campo `disc.<campo>` lido em `roadmap-release.js` (varredura por regex `\bdisc\.([A-Za-z]+)`) existe no payload projetado que `preflight.mjs discover --slice 0` devolve num roadmap gerado no teste. Esta é a conferência que a spec deixa para o plano. Se o plano A já tiver esse teste em `preflight.test.mjs`, não o repita aqui.
   - `readBack` por `verify-run.mjs read` com `slice` no payload: um status e um brief longos chegam em fatias e são remontados. O texto remontado é a saída de `buildRead`, sem `tool`, `mode` nem `nonce`. Um envelope com `command`/`mode` diferente de `read` é recusado na fatia.
   - Uma cópia acima de `MAX_COPY_BYTES` é recusada antes do `JSON.parse`. Confira pelo motivo registrado, sem exceção de parse.
   - Rode `node --test plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs` e confirme a falha.
3. Implemente em `roadmap-release.js`:
   - `copyFits(stdout)`: falso quando `utf8Length(stdout) > MAX_COPY_BYTES`, a constante embutida. Nunca escreva o literal do limite.
   - `readSlices({ label, phase, cmdOf, tool, command, firstNonce, nonceOf, tries })`, logo depois de `runPrompt`. Ela:
     - pede a fatia 0 e lê `slices` do envelope;
     - pede cada fatia seguinte com nonce próprio;
     - repete só a fatia que falhou em `copyFits` ou em `checkSlice`, até `tries` vezes. As tentativas 1 e 2 são haiku/low e as demais sonnet/medium, como hoje;
     - junta com `joinSlices`. Se o total não bater, recomeça uma vez.
     - Devolve `{ text, envs }` ou `{ why }`.
   - `readDisc` e o laço de páginas (1484-1512) passam a ser uma leitura `readSlices` de `${discCmd} --slice <k>` com `tries: 5`. `disc = JSON.parse(text)` segue pelas validações atuais sem mudança. `--page` e o formato `{nonce, data}` de `checkRun` ficam intocados para o agy (R4 da spec).
   - `readBack` passa `slice: k` no payload de `encArg` e lê por `readSlices` com `tries: 5`. `tool`, `command` e `mode` são conferidos só no envelope de cada fatia, por `checkSlice(env, { tool: 'verify-run', command: 'read', ... })`, que compara `env.command ?? env.mode`. O texto remontado não tem `mode`: é tratado como a saída de `buildRead` e segue pelas validações atuais desses dados. O teste de `CMD_CAP` continua antes do despacho.
4. Atualize o mock padrão de `exec` em `flow.test.mjs`, sem mudar os casos:
   - as respostas `discovery`/`discovery-retry` viram envelopes de fatia gerados por um helper `discSlices(prompt, data)`, que usa a lib;
   - os testes de páginas (`E10 final-fix`, 808-832) passam a cobrir as fatias, com os rótulos novos. A paginação por `--page` continua coberta pelos testes do agy.
5. Verificação (comandos em `checks`):
   - rode `node --test` em `discovery-slices.test.mjs`, `flow.test.mjs` e `size.test.mjs` (folga `> 10000`, DEC-034), depois em `roadmap-release-agy.test.mjs`;
   - meça o tamanho: até 259.883 caracteres LF.

### Tarefa 2: B: portões do roadmap-release medidos pelo JSON do capture.mjs (gateFromCapture)

Arquivos:

- modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`;
- testar em `plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro, em `gates.test.mjs`, com `loadPure()`:
   - `gateFromCapture(def, g, expect)` recebe um JSON real do `capture.mjs run --tests`. O teste gera a suíte de 63 testes (60 passam e 3 falham: `FAIL_A`, `FAIL_B`, `FAIL_C`) num diretório temporário e chama o `capture.mjs` por `spawnSync`. O texto do agente diverge: `total: 99` e `failedNames: ['x']`. Resultado: `exit` 1, `total` 63 e `failedNames` igual a `['FAIL_A', 'FAIL_B', 'FAIL_C']`, vindos do JSON conferido.
   - `format: 'unknown'` com exit 1 (C3): o `exit` vem do capture, e `total`/`failedNames` vêm do agente, com `fallback: true` no resultado.
   - Lista cortada (`extract.failedNamesCut > 0`, C4): `gatePasses` nunca passa contra uma linha de base vermelha com os mesmos nomes.
   - Nonce errado, digest adulterado ou `cmdDigest` de outro comando: `gateFromCapture` devolve `null`, e `validMeasure` acusa o portão ausente.
   - Um portão chamado `unit tests` (com espaço) e com `def.cmd` contendo aspas simples (`node -e 'process.exit(0)'`): o nonce do prompt casa `^[A-Za-z0-9:._@-]{1,160}$`, a linha traz `--bash ${shq(def.cmd)}`, e o `cmdDigest` do JSON gerado pelo `capture.mjs` real bate com `commandDigest({ bash: def.cmd })`.
   - `gateSubset` compara `path/of/file.test.mjs::nome` com `nome` como iguais, porque compara os nomes sem o prefixo de arquivo (R4).
   - Portão com `ignoreFailuresWhenChanged`: os nomes vêm do agente, com o prefixo de arquivo, e o exit vem do capture (R4).
   - Rode `node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs` e confirme a falha.
2. Implemente em `roadmap-release.js`:
   - `S_GATE` ganha `capture: STR` opcional. A lista `required` não muda (R5; o agy usa `SCHEMAS['S_GATE']`).
   - `measureTxt(defs, nonceOf)` manda rodar cada portão assim: `node "<pluginRoot>/scripts/capture.mjs" run --nonce <nonce> --task <E ou preflight>-gates [--tests] --cwd <dir> --bash ${shq(def.cmd)}`, com o escape de shell `shq` que o workflow já tem (linha 860), para que um comando com aspas simples não quebre e o `cmdDigest` bata. O `--tests` vai só quando `kind` é `tests`. O agente devolve a linha JSON impressa, literal, em `capture`. A instrução atual de ler `total`/`skipped`/`failedNames` da saída fica só como fallback. O nonce é `${RUN_TAG}:<rótulo da chamada>:g<i>`, com `<i>` o índice do portão em `defs`, nunca o nome cru do portão: o `capture.mjs` aceita `--nonce` só com `^[A-Za-z0-9:._@-]{1,160}$`, e um nome de portão pode ter espaço. O resultado é associado ao portão pelo índice.
   - Função pura `gateFromCapture(def, g, expect)` com `expect = { nonce, cmdDigest: commandDigest({ bash: def.cmd }) }`:
     - recusa com `copyFits` (Tarefa 1) antes do parse e confere com `checkCapture`;
     - toma `exit` sempre do JSON;
     - toma `total`, `skipped` e `failedNames` de `extract`, salvo com `format: 'unknown'` ou `ignoreFailuresWhenChanged`, quando usa os do agente e marca `fallback`;
     - uma lista cortada (`extract.failedNamesCut > 0`, lido dentro de `extract`) leva `failedNamesCut` ao resultado, e `gatePasses` recusa a falha.
   - `gateSubset` compara por `nameKey(n)`, que tira o prefixo `^[^\s:]+\.[A-Za-z0-9]+::`.
   - `gateOnce`, `measuredGroup` e o passo 4 do preflight passam cada `g` por `gateFromCapture` antes de `validMeasure`. Um portão sem JSON válido vira portão ausente: a medida é inválida, é repetida uma vez e depois conta como falha de infra, nunca como verde (R5).
   - `gateSummary` marca `fallback` quando houver.
3. Atualize `flow.test.mjs` com um adaptador no `exec`. Quando a resposta de uma medição traz `gates` sem `capture`, o adaptador gera o JSON do capture de cada portão a partir do nonce (por índice) e do comando (desfeito o `shq`) lidos no prompt, com `canon`/`fnv1a`/`commandDigest` da lib. As respostas `gm(...)` existentes continuam valendo sem edição.
4. Verificação:
   - rode `node --test` em `gates.test.mjs`, `flow.test.mjs` e `roadmap-release-agy.test.mjs`;
   - meça o tamanho: até 259.883.

### Tarefa 3: B: prompt do implementer, teste primeiro pelo capture.mjs e limpeza no CLEANUP do roadmap-release

Arquivos:

- modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`;
- testar em `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs`.

Passos:

1. Teste primeiro:
   - Em `review.test.mjs`, gere num diretório temporário um script node que imprime 7 KB ou mais e sai com 1 enquanto um arquivo marcador existe, e com 0 depois que ele some. Rode o `capture.mjs run` duas vezes com os nonces `<prefixo>1` e `<prefixo>2` e as linhas JSON reais em `checks[].output`. Os casos:
     - `testFirstGap(task, impl, false, { noncePrefix })` devolve `''`;
     - digest adulterado dá gap;
     - `cmdDigest` diferente entre as duas rodadas dá gap;
     - nonce fora do prefixo dá gap;
     - só verde, ou verde antes de vermelho, dá gap;
     - sem o quarto argumento, os testes atuais (422-500) continuam iguais (R9 da spec).
   - `fmtChecks` mostra `path`, `sha256`, `exit` e a cauda quando `output` é JSON do capture, e o texto atual quando não é.
   - Em `prompts.test.mjs`:
     - com `ctx.capture`, `buildImplPrompt` traz a linha `CAPTURE: node "<capture.mjs>" run --nonce <RUN_TAG>:<E>:T<n>:<k> --task <E>-T<n> -- <command>` (contrato da Tarefa 8);
     - sem `ctx.capture`, que é o caso do agy, o prompt fica igual ao de hoje.
   - Em `cleanup.test.mjs`, depois da chamada CLEANUP vem uma chamada do script-runner com `capture.mjs" prune --task-prefix ` e `<E>-`, rodada com `--cwd` no worktree de integração. A linha literal atual do CLEANUP continua conferida sem mudança.
   - Rode `node --test` em `review.test.mjs`, `prompts.test.mjs` e `cleanup.test.mjs` e confirme a falha.
2. Implemente em `roadmap-release.js`:
   - `testFirstGap(task, impl, resumed, cap)`: com `cap.noncePrefix`, só conta um par em que:
     - os dois JSON passam `copyFits` e `checkCapture` com o próprio nonce;
     - os dois nonces começam com o prefixo;
     - `exit !== 0` vem antes de `exit === 0`;
     - o `cmdDigest` é o mesmo.
     Sem `cap`, o código atual não muda.
   - A chamada em 2634 passa `{ noncePrefix: \`${RUN_TAG}:${E}:T${t.n}:\` }`.
   - `ctxFor` da implementação (2603) ganha `capture: { path, noncePrefix, task }`, e `buildImplPrompt` emite a linha `CAPTURE:` só quando `ctx.capture` existe (R3).
   - `fmtChecks` como no teste.
   - Depois do agente de CLEANUP (2069-2071), uma chamada `runPrompt` do script-runner roda `node "<pluginRoot>/scripts/capture.mjs" prune --task-prefix '<E>-' --cwd '<INTWT>'` (R13 da spec; R12 deste plano). Uma falha entra só em `out.concerns`.
3. Verificação:
   - rode `node --test` em `review.test.mjs`, `prompts.test.mjs`, `cleanup.test.mjs` e `roadmap-release-agy.test.mjs`;
   - meça o tamanho: até 259.883.

### Tarefa 4: B: cargas de spec e plano (B07) por fatias do capture.mjs no roadmap-release

Arquivos:

- modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`;
- testar em `plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs` (novo) e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro, em `load-slices.test.mjs`:
   - Uma spec e um plano sintéticos geram um `emit` de 19 KB ou mais. O runner falso executa de verdade os comandos `capture.mjs run` e `capture.mjs slice` sobre arquivos reais num repositório temporário, e corta toda resposta acima de 3.500 bytes. A carga remonta o texto e entrega a `checkSpecLoad`/`checkPlanLoad` o mesmo objeto que a cópia literal de hoje entregaria.
   - `capture.mjs slice` com o SHA mudado entre as chamadas é recusado. A carga recomeça pelo `load3`.
   - Uma fatia resumida na primeira cópia é repetida sozinha.
   - `head`, `blob` e `porcelain` vêm da cauda conferida (`tailCut === 0`), sem fatias.
   - `capture.mjs run` e `capture.mjs slice` recebem o mesmo `--cwd`. Um `slice` com `--cwd` de outro repositório não acha o arquivo e a fatia é recusada.
   - Rode `node --test plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs` e confirme a falha.
2. Implemente em `roadmap-release.js` (R7):
   - `loadVia(E, base, k, cmds)` roda cada comando por `capture.mjs run --nonce <n> --task <E>-load --cwd <dir> -- <argv>` numa chamada do script-runner. O `<dir>` é o mesmo diretório em que a carga roda hoje, e o mesmo `--cwd` vai em todo `capture.mjs slice` da carga, porque o `slice` só serve arquivos de `<git-dir de --cwd>/pt-evidence/`. Os rótulos são:
     - `${E}:spec-load${k}` ou `${E}:plan-load${k}` para o primeiro comando;
     - `-emit`, `-blob`, `-head` e `-porcelain` para os seguintes;
     - `-emit-slice<j>` para as fatias.
   - `tailCut` é número. Com `tailCut === 0`, o texto é a cauda conferida. Com `tailCut > 0`, o texto vem de `readSlices` (Tarefa 1) sobre `capture.mjs slice --nonce <n> --cwd <dir> --path <path> --sha <sha256> --slice <j>`, com o mesmo `<dir>` do `run`. O `total.sha256` remontado tem de ser igual ao `sha256` do JSON do capture.
   - O resultado `{ checkExit, checkStdout, emitExit, emitStdout, blob, head, clean }` vai sem mudança a `checkSpecLoad`/`checkPlanLoad`, que não mudam. `S_TOOLOUT` sai se não tiver outro uso.
   - `load3` continua com 5 tentativas externas.
3. Atualize `flow.test.mjs` com um adaptador no `exec`, sem mudar os casos. As respostas em forma de `S_TOOLOUT` devolvidas para `:spec-load\d$`/`:plan-load\d$` (de `specLoadOk`, `planLoadOf` e dos overrides) viram a série de JSON do capture e de envelopes de fatia de cada rótulo novo.
4. Verificação:
   - rode `node --test` em `load-slices.test.mjs`, `flow.test.mjs`, `prompts.test.mjs`, `size.test.mjs` e `roadmap-release-agy.test.mjs`;
   - meça o tamanho: até 259.883.

### Tarefa 5: B: leitura assinada do coordinator por fatias com retry por fatia

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
   - `copyFits(stdout)`, como na Tarefa 1.
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
   - meça o tamanho: até 88.187. Depois do embutido do plano A sobram cerca de 6 KB até esse limite para as Tarefas 5 a 7 juntas (R14). Se a medida passar de 88.187, pare, não corte funcionalidade e reporte no relatório da tarefa a medida e o que a tarefa acrescentou.

### Tarefa 6: B: linha de base e portão de onda do coordinator pelo capture.mjs com extrator

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

### Tarefa 7: B: prompt do implementer, revisão final por review-package e limpeza no fecho do coordinator

Arquivos:

- modificar `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`;
- testar em `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro, em `flow.test.mjs`:
   - O prompt do implementer traz `CAPTURE: node "<CAPTURE>" run --nonce <RUN_TAG>:<id do plano>:T<n>:<k> --task <id do plano>-T<n> -- <command>`, no contrato da Tarefa 8.
   - O prompt do `final-reviewer` traz uma linha `Diff:` com `review-package.mjs`, `ROOT`, a base, `HEAD` e o arquivo `$(git -C ROOT rev-parse --absolute-git-dir)/pt-evidence/review/<id>-final.txt`. Quando a política de commits é `none`, pede também `git -C ROOT diff HEAD` redirecionado para `<id>-worktree.diff` na mesma pasta (R13). `ls-files --others --exclude-standard` continua na linha.
   - No `done`, uma chamada do script-runner roda `capture.mjs" prune --task-prefix '<id do plano>-' --cwd '<ROOT>'`. Uma falha dela não muda o `status: 'done'` (R12).
   - Rode `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` e confirme a falha.
2. Implemente em `coordinator.js`:
   - `implPrompt` ganha a linha `CAPTURE:` acima.
   - `finalPrompt` ganha a linha `Diff:` nova, com o caminho de `review-package.mjs` derivado de `PROGRESS` como em `CAPTURE`.
   - O caso `done` chama a limpeza por `runCmd` antes de `finish`.
   - Os prompts de revisão por passo não mudam.
3. Verificação:
   - rode `node --test` em `flow.test.mjs`, `slices.test.mjs`, `size.test.mjs` e `coordinator-agy.test.mjs`;
   - meça o tamanho: até 88.187. Se passar, pare, não corte funcionalidade e reporte no relatório da tarefa a medida e o que a tarefa acrescentou.

### Tarefa 8: B: contratos do script-runner, do test-integrity e do implementer com capture.mjs

Arquivos:

- modificar `plugins/productivity-tools/agents/script-runner.md`, `plugins/productivity-tools/agents/test-integrity.md` e `plugins/productivity-tools/agents/implementer.md`;
- testar em `plugins/productivity-tools/scripts/agent-contracts.test.mjs` (novo).

Passos:

1. Teste primeiro, em `agent-contracts.test.mjs`:
   - `script-runner.md` diz para copiar só a linha JSON impressa quando o prompt pede JSON, e que uma linha acima de 3,500 bytes é erro do comando, não do agente. Continua com `after the Bash result has arrived`, `never in the same message as the Bash call` e `never a placeholder` (DEC-715). Não tem chave `model`.
   - `test-integrity.md` diz que, se o JSON impresso não vier inteiro, a resposta é `removedAsserts=-1`, nunca uma cópia parcial.
   - `implementer.md` tem uma seção `CAPTURE` que diz:
     - com a linha `CAPTURE:` no prompt, cada verificação roda como `node <capture> run --nonce <prefixo><k> --task <id> -- <comando>`, com `<k>` crescente, ou com `--bash "<comando>"` quando o comando precisa de shell;
     - `checks[].command` é o comando interno, idêntico entre a rodada vermelha e a verde;
     - `output` é a linha JSON literal;
     - `exit` é o `exit` dela;
     - o relatório cita só `path`, `sha256` e `exit` (DEC-026);
     - pipe para `tail`, `head` ou `grep` continua proibido.
   - Todas as frases que `prompts.test.mjs` fixa em `implementer.md` continuam presentes (R3: sem a linha `CAPTURE:` vale a regra atual, usada pelo agy).
   - Nenhum dos três arquivos contém o literal do limite em algarismos sem separador (AC6) nem a palavra proibida por `independence.test.mjs`.
   - Rode `node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs` e confirme a falha.
2. Escreva as frases nos três arquivos, em inglês, como o resto dos contratos.
3. Verificação:
   - rode `node --test` em `agent-contracts.test.mjs`, `prompts.test.mjs` e `independence.test.mjs`;
   - rode `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.

### Tarefa 9: B: contratos do task-reviewer e do final-reviewer com leitura por offset/limit

Arquivos:

- modificar `plugins/productivity-tools/agents/task-reviewer.md` e `plugins/productivity-tools/agents/final-reviewer.md`;
- testar em `plugins/productivity-tools/scripts/agent-contracts.test.mjs`.

Passos:

1. Teste primeiro, em `agent-contracts.test.mjs`: os dois contratos dizem que um diff ou log de intervalo nunca é lido numa saída só do Bash. Ele vai para um arquivo em `$(git rev-parse --absolute-git-dir)/pt-evidence/review/`, ou é o pacote de `review-package.mjs` (que imprime `path`, `sha256` e `lines`). Esse arquivo é lido com Read `offset`/`limit` de até 400 linhas, e a revisão cita path e sha256. O modo `restricted` do task-reviewer continua lendo o pacote. Rode o teste e confirme a falha.
2. Escreva a regra nos dois arquivos. As linhas de prompt dos revisores em `roadmap-release.js` e os braços `tools/measure/arms/*-atual.md` não mudam (R10 da spec).
3. Verificação:
   - rode `node --test` em `agent-contracts.test.mjs`, `prompts.test.mjs` e `review.test.mjs`;
   - rode `lint-plugin.mjs` em `plugins/productivity-tools`.

### Tarefa 10: B: documentação da pasta de provas, da limpeza e da retomada nas duas skills

Arquivos:

- modificar `plugins/productivity-tools/skills/plan-coordinator/SKILL.md` e `plugins/productivity-tools/skills/plan-coordinator/references/state.md`;
- modificar `plugins/productivity-tools/skills/roadmap-release/SKILL.md` e `plugins/productivity-tools/skills/roadmap-release/references/operator.md`.

Passos:

1. Documente, em inglês, o mesmo conteúdo nas duas skills:
   - a pasta `<absolute git-dir>/pt-evidence/<task>/` (fora da árvore e fora de `docs/`, DEC-026);
   - a limpeza: arquivos com mais de 14 dias apagados pelo `capture.mjs run`, e `prune --task-prefix` no fecho do plano (coordinator) e no CLEANUP de cada entregável (`<E>-`, roadmap-release); a pasta de um worktree some com ele;
   - que relatórios citam só path, sha256 e exit;
   - que execuções da 2.4.0 não são retomáveis com `resumeFromRunId` (DEC-028): relance com um `runToken` novo.
2. `plan-coordinator/SKILL.md` tem só 259 bytes de folga no teto de 6.000 (R9). Acrescente no máximo uma frase, depois da linha `## After the workflow returns`, apontando para `references/state.md`. O texto completo fica em `state.md`. Não cite `references/state.md` antes da fronteira.
3. Em `roadmap-release/SKILL.md` e `operator.md`, acrescente junto do parágrafo de retomada (operator.md, linha 93) sem tirar nenhum trecho que `docs.test.mjs` exige.
4. Verificação:
   - rode `node --test` em `plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs` e `plugins/productivity-tools/scripts/independence.test.mjs`;
   - rode `claude plugin validate plugins/productivity-tools`.

### Tarefa 11: B: roteiro e preparador offline da sonda AC2b em tools/measure

Arquivos:

- criar `tools/measure/sonda-e41-ac2b.md` (roteiro) e `tools/measure/sonda-e41-ac2b.mjs`;
- testar em `tools/measure/sonda-e41-ac2b.test.mjs` (novo).

Passos:

1. Teste primeiro, offline e sem `claude -p`, em `sonda-e41-ac2b.test.mjs`:
   - `prepare --work <tmp> --plugin <repo>/plugins/productivity-tools` cria `<work>/sandbox`, um repositório git com `docs/plans/sonda/spec.md` (spec/1) e `docs/plans/sonda/plan.md` (plan/1 de 40 passos). T1 é externo, com `externalDedupe`, e os outros dependem dele.
   - O `prepare` roda `progress.mjs init --commits none` e aplica por `progress.mjs apply` os eventos `approve-map` e `prelaunch-review` com `value: 'pass'` para T1 (R10). Assim `nextAction` do estado é `authorize`, e nenhum revisor nem implementer é despachado.
   - `progress.mjs read --slice 0` do sandbox anuncia pelo menos 2 fatias.
   - `prepare` recusa `--work` dentro do repositório.
   - `summarize --work <tmp> --config <tmp-cfg>` lê `runs/<k>-on.json` e `runs/<k>-off.json`, que são saídas `--output-format json` geradas no teste, com `session_id` `00000000-0000-4000-8000-*`. Ele:
     - imprime uma linha de tabela para `measurements.md`, com execuções, parada `authorize` alcançada, retries de fatia e custo somado;
     - sai com 0 quando as 6 execuções chegaram à parada `authorize` e a soma é até US$ 1;
     - sai com 1 quando uma execução falhou na leitura ou quando a soma passa de US$ 1.
   - O roteiro contém:
     - 3 execuções com context-mode ligado e 3 com ele desligado;
     - `--max-budget-usd 0.16` em cada uma (soma 0,96);
     - `CLAUDE_CONFIG_DIR` apontando para a config descartável;
     - `--plugin-dir` com o plugin da branch, sem instalar nada na config;
     - `--work` fora do repositório;
     - o ligar e desligar do context-mode só com `CLAUDE_CONFIG_DIR` da config descartável;
     - a nota de que a execução é do dono ou com a autorização dele (X1, X2, H2).
   - Rode `node --test tools/measure/sonda-e41-ac2b.test.mjs` e confirme a falha.
2. Implemente:
   - `sonda-e41-ac2b.mjs` com os subcomandos `prepare` e `summarize`. Ele importa `canon`/`fnv1a` de `plugins/productivity-tools/lib/plan-digest.mjs` e `applyEvents` de `lib/progress-state.mjs` para o payload de `apply`.
   - Para achar os rótulos das fatias, `summarize` usa `extract` de `tools/measure/session-metrics.mjs` (leia a assinatura antes) no transcript da sessão, dentro da config indicada.
   - O roteiro `sonda-e41-ac2b.md` traz o comando completo de cada execução: `CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json`, rodado em `<work>/sandbox` com a saída em `<work>/runs/<k>-<on|off>.json`.
   - O roteiro também diz que a linha do resultado é registrada em `docs/plans/roadmap-pos-2-3-0/measurements.md` pelo roadmap-tracker, fora deste plano, e conferida pelo dono (H1).
3. Verificação: rode `node --test` em `sonda-e41-ac2b.test.mjs` e `session-metrics.test.mjs` (`scanPrivacy`).

### Tarefa 12: B: verificação final dos critérios e dos portões G1 a G5

Arquivos: nenhum (`noCommit`). Depende das Tarefas 4, 7, 9, 10 e 11 e, por elas, de todas as outras de código.

Passos:

1. Rode a evidência de cada critério executável, exatamente como na tabela abaixo: AC1, AC2, AC4, AC5, AC6, AC7 e AC8.
2. Rode o `embed.mjs --check` dos 4 alvos e meça os tamanhos: `roadmap-release.js` até 259.883 e `coordinator.js` até 88.187 caracteres LF.
3. Rode os portões:
   - G1: o comando de teste do plano;
   - G2: `claude plugin validate .`;
   - G3: `claude plugin validate plugins/productivity-tools`;
   - G4: `check-roadmap.mjs` sobre `fixtures/valid`;
   - G5: `lint-plugin.mjs`.
4. Devolva os comandos, exits e saídas em `checks`. Se algo falhar, devolva o defeito com o arquivo e não corrija aqui.

### Tarefa 13: B: sonda paga AC2b (externa, só com autorização do dono)

Arquivos: nenhum (`noCommit`). É uma tarefa externa: o coordinator para em `authorize` e só a roda com o item `plan:T13@<digest>` dado pelo dono. Antes disso, o dono faz o login na config descartável (H2). Nenhuma credencial é escrita.

Passos (os do roteiro `tools/measure/sonda-e41-ac2b.md`, uma vez):

1. `node tools/measure/sonda-e41-ac2b.mjs prepare --work D:/claude-pos23-out/e41-ac2b --plugin <repo>/plugins/productivity-tools`.
2. Com o context-mode ligado só na config descartável (X2), faça as 3 execuções `on`. Desligue o context-mode e faça as 3 execuções `off`. Cada uma tem `--max-budget-usd 0.16` (X1).
3. Rode `node tools/measure/sonda-e41-ac2b.mjs summarize --work D:/claude-pos23-out/e41-ac2b --config D:/claude-pos23-cfg` e devolva a linha impressa. O registro em `measurements.md` é feito pelo roadmap-tracker e conferido pelo dono (H1). Se a sonda passar, a retirada do retry em sonnet vira proposta ao dono, fora deste plano (R11 da spec).

## Evidência dos critérios

| Critério | Tipo | Comando | Externo | Fechado por |
|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` | false | B (T6), com `capture.test.mjs` do plano A |
| AC2 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false | B (T5), com `signed-output.test.mjs` do plano A |
| AC3 | human | - | false | B (T11, T13) e o dono (H1) |
| AC4 | test | `node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs` | false | B (T2, T6), com o extrator do plano A |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs` | false | B (T3), com `capture.test.mjs` do plano A |
| AC6 | test | `node --test plugins/productivity-tools/scripts/copy-budget.test.mjs` | false | plano A; B mantém (T1, T5, T8) e reconfere (T12) |
| AC7 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs` | false | plano A; B reconfere (T5, T12) |
| AC8 | test | `node --test plugins/productivity-tools/scripts/capture.test.mjs` | false | plano A; B reconfere (T12) |

O plano B fecha os critérios que dependem dos workflows: AC1, AC2, AC4 e AC5. Também prepara e executa, com autorização, a sonda do AC3 (AC2b do cartão), cuja aceitação é humana (H1). AC6, AC7 e AC8 são fechados pelo plano A. Este plano só os mantém verdes e os roda de novo na Tarefa 12.

## Decisões do plano

- R1: o plano A integrado é pré-condição, conferida na Tarefa 1. Sem ela, BLOCKED, e nenhum arquivo do plano A é editado.
- (Sem R2: a folga de `size.test.mjs` é `> 10000` pela DEC-034 e é trocada pelo plano A; este plano não a decide nem a edita.)
- R3: a linha `CAPTURE:` só entra quando o workflow JS passa `ctx.capture`. `checks[].command` é o comando interno. O agy fica igual.
- R4: os nomes de portão são comparados sem o prefixo `arquivo::`. Um portão com `ignoreFailuresWhenChanged` usa os nomes do agente.
- R5: um portão sem JSON do capture válido conta como ausente e nunca como verde. `S_GATE.required` não muda.
- R6: as fatias do coordinator têm 3 tentativas (haiku, haiku, sonnet). As do roadmap-release têm 5, como as leituras de hoje.
- R7: a carga B07 é uma série de chamadas do capture, com cauda quando cabe (`tailCut === 0`) e fatias quando não cabe, com o mesmo `--cwd` no `run` e no `slice`. `checkSpecLoad`/`checkPlanLoad` não mudam.
- R8: no coordinator, a recusa acima do limite vale para as saídas JSON assinadas. As saídas de git ficam como estão.
- R9: o `SKILL.md` do plan-coordinator ganha uma frase depois da fronteira. O texto completo fica em `state.md`.
- R10: a sonda usa `--plugin-dir`, um estado pré-aprovado que para em `authorize` sem revisor opus e US$ 0,16 por execução.
- R11: os títulos começam com `B:`, para separar os commits dos do plano A, que tem o mesmo id.
- R12: a limpeza do coordinator roda com `--cwd ROOT` e a do roadmap-release com `--cwd` no worktree de integração. Uma falha de limpeza só vira aviso.
- R13: a revisão final do coordinator lê o pacote do `review-package.mjs` em `pt-evidence/review/`, mais um diff do que não foi commitado quando os commits são `none`.

```json data
{
  "schema": "plan/1",
  "id": "E41",
  "title": "Saída de script sem recópia por LLM (parte B: workflows, cargas B07, contratos, documentação e sonda)",
  "spec": "../spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Pré-condição: o plano A (docs/plans/pos-2-3-0-E41/plan.md) está integrado na branch; este plano não edita lib/*.mjs, scripts/capture.mjs, scripts/test-extract.mjs, scripts/review-package.mjs, skills/plan-coordinator/scripts/progress.mjs, skills/roadmap-release/scripts/preflight.mjs, skills/roadmap-release/scripts/verify-run.mjs nem os testes do plano A; se faltar algo deles, a tarefa devolve BLOCKED.",
    "Não editar coordinator-agy.py, roadmap-release-agy.py, scripts/agy-bridge.py nem tools/measure/arms/; não remover --page, o formato {nonce, data} de checkRun da discovery nem a assinatura de 3 argumentos de testFirstGap; S_GATE e S_RUN mantêm a mesma lista required.",
    "Não mudar buildTaskReviewPrompt nem as linhas 'Mode: review, lens:' e 'Diff:' dos prompts de revisão de roadmap-release.js (R10 da spec).",
    "Não escrever o literal do limite de cópia em algarismos sem separador em arquivo não-teste do plugin fora de lib/plan-digest.mjs (usar MAX_COPY_BYTES; em prosa, 3,500 ou 3.500) e não citar a palavra proibida por independence.test.mjs em arquivo não-teste do plugin.",
    "roadmap-release.js fica com no máximo 259.883 caracteres LF e coordinator.js com no máximo 88.187 (R14 da spec); os tetos de 300.000 e 120.000 de size.test.mjs não mudam, e a folga > 10000 (DEC-034) vem do plano A; este plano não edita size.test.mjs. Se coordinator.js passar de 88.187 nas Tarefas 5 a 7, a tarefa para e reporta a medida no relatório, sem cortar funcionalidade.",
    "Provas só em <git-dir absoluto>/pt-evidence/; nada gravado na árvore de trabalho nem em docs/; relatório cita só path, sha256 e exit (DEC-026).",
    "Nenhuma tarefa escreve em docs/plans/roadmap-pos-2-3-0/; a linha da sonda em measurements.md é registrada pelo roadmap-tracker e conferida pelo dono.",
    "Chamadas pagas (claude -p) só na Tarefa 13, externa, com autorização do dono, config descartável, --max-budget-usd por execução e soma até US$ 1 (DEC-029); os testes não dependem de D:/claude-pos23-out/.",
    "As frases que prompts.test.mjs, docs.test.mjs, cleanup.test.mjs e prose-budget.test.mjs exigem continuam presentes.",
    "Branch release/pos-2.3.0 (DEC-008), um commit por tarefa feito pelo coordinator."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "B: roadmap-release lê discovery e readBack por fatias e recusa cópia acima do limite",
      "deps": [],
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
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "roadmap-release.js: readSlices({ label, phase, cmdOf, tool, command, firstNonce, nonceOf, tries }) devolve { text, envs } ou { why }",
        "roadmap-release.js: copyFits(stdout) é false quando utf8Length(stdout) > MAX_COPY_BYTES, antes do parse"
      ],
      "consumes": [],
      "covers": ["AC6", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0 (pré-condição do plano A)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0 (agy intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=259883?0:1)\"", "expect": "exit 0 com no máximo 259883 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "B: portões do roadmap-release medidos pelo JSON do capture.mjs (gateFromCapture)",
      "deps": [1],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "roadmap-release.js: função pura gateFromCapture(def, g, expect) devolve o GateResult com exit, total, skipped e failedNames do JSON conferido do capture"
      ],
      "consumes": [
        { "task": 1, "sig": "roadmap-release.js: copyFits(stdout) é false quando utf8Length(stdout) > MAX_COPY_BYTES, antes do parse" }
      ],
      "covers": ["AC4", "C3", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0 com failedNames [FAIL_A, FAIL_B, FAIL_C] e total 63 vindos do capture" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0 (agy intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=259883?0:1)\"", "expect": "exit 0 com no máximo 259883 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "B: prompt do implementer, teste primeiro pelo capture.mjs e limpeza no CLEANUP do roadmap-release",
      "deps": [2, 8],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "roadmap-release.js: testFirstGap(task, impl, resumed, cap) com cap = { noncePrefix } opcional",
        "roadmap-release.js: ctx.capture = { path, noncePrefix, task } opcional em buildImplPrompt"
      ],
      "consumes": [
        { "task": 1, "sig": "roadmap-release.js: copyFits(stdout) é false quando utf8Length(stdout) > MAX_COPY_BYTES, antes do parse" },
        { "task": 8, "sig": "agents/implementer.md: com a linha CAPTURE do prompt, cada verificação roda como node <capture> run --nonce <prefixo><k> --task <id> -- <comando>; checks[].command é o comando interno, output é a linha JSON literal e exit é o exit dela" }
      ],
      "covers": ["AC5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs", "expect": "exit 0 com o par exit 1 e exit 0 de 7 KB conferido pelos JSON do capture" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0 (testFirstGap de 3 argumentos intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=259883?0:1)\"", "expect": "exit 0 com no máximo 259883 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "B: cargas de spec e plano (B07) por fatias do capture.mjs no roadmap-release",
      "deps": [3],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "roadmap-release.js: loadVia(E, base, k, cmds) monta { checkExit, checkStdout, emitExit, emitStdout, blob, head, clean } de JSON do capture e fatias de capture.mjs slice"
      ],
      "consumes": [
        { "task": 1, "sig": "roadmap-release.js: readSlices({ label, phase, cmdOf, tool, command, firstNonce, nonceOf, tries }) devolve { text, envs } ou { why }" },
        { "task": 1, "sig": "roadmap-release.js: copyFits(stdout) é false quando utf8Length(stdout) > MAX_COPY_BYTES, antes do parse" }
      ],
      "covers": ["AC6", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 com emit de 19 KB remontado por fatias" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0 (checkSpecLoad e checkPlanLoad intactos)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=259883?0:1)\"", "expect": "exit 0 com no máximo 259883 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "B: leitura assinada do coordinator por fatias com retry por fatia",
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
      "n": 6,
      "title": "B: linha de base e portão de onda do coordinator pelo capture.mjs com extrator",
      "deps": [5],
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
        { "task": 5, "sig": "coordinator.js: CAPTURE (caminho de scripts/capture.mjs derivado de args.progress) e copyFits(stdout)" }
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
      "n": 7,
      "title": "B: prompt do implementer, revisão final por review-package e limpeza no fecho do coordinator",
      "deps": [6, 8],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": [
        "coordinator.js: linha CAPTURE no implPrompt, linha Diff: por review-package.mjs no finalPrompt e capture.mjs prune --task-prefix '<id do plano>-' no done"
      ],
      "consumes": [
        { "task": 5, "sig": "coordinator.js: CAPTURE (caminho de scripts/capture.mjs derivado de args.progress) e copyFits(stdout)" },
        { "task": 6, "sig": "coordinator.js: runCapture({ argv | bash, task, label, phase, tests, cwd }) devolve o JSON conferido por checkCapture ou null" },
        { "task": 8, "sig": "agents/implementer.md: com a linha CAPTURE do prompt, cada verificação roda como node <capture> run --nonce <prefixo><k> --task <id> -- <comando>; checks[].command é o comando interno, output é a linha JSON literal e exit é o exit dela" }
      ],
      "covers": ["AC5", "AC6"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs", "expect": "exit 0 (agy intacto)" },
        { "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').replace(/\\r\\n/g,'\\n').length;console.log(n);process.exit(n<=88187?0:1)\"", "expect": "exit 0 com no máximo 88187 caracteres LF" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "B: contratos do script-runner, do test-integrity e do implementer com capture.mjs",
      "deps": [],
      "files": {
        "create": [
          "plugins/productivity-tools/scripts/agent-contracts.test.mjs"
        ],
        "modify": [
          "plugins/productivity-tools/agents/script-runner.md",
          "plugins/productivity-tools/agents/test-integrity.md",
          "plugins/productivity-tools/agents/implementer.md"
        ],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "agents/implementer.md: com a linha CAPTURE do prompt, cada verificação roda como node <capture> run --nonce <prefixo><k> --task <id> -- <comando>; checks[].command é o comando interno, output é a linha JSON literal e exit é o exit dela"
      ],
      "consumes": [],
      "covers": ["AC5", "AC6"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/scripts/independence.test.mjs", "expect": "exit 0 com as frases fixadas do implementer intactas" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "B: contratos do task-reviewer e do final-reviewer com leitura por offset/limit",
      "deps": [8],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/task-reviewer.md",
          "plugins/productivity-tools/agents/final-reviewer.md"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agent-contracts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "agents/task-reviewer.md e agents/final-reviewer.md: diff ou log de intervalo lido de arquivo em <git-dir>/pt-evidence/review/ ou do pacote do review-package.mjs, com Read offset/limit de até 400 linhas, citando path e sha256"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 10,
      "title": "B: documentação da pasta de provas, da limpeza e da retomada nas duas skills",
      "deps": [4, 7],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/SKILL.md",
          "plugins/productivity-tools/skills/plan-coordinator/references/state.md",
          "plugins/productivity-tools/skills/roadmap-release/SKILL.md",
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md"
        ],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [
        "documentação de pt-evidence, prune e resumeFromRunId da 2.4.0 nas skills plan-coordinator e roadmap-release"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": {
        "exempt": "Só documentação; os testes que a protegem (prose-budget.test.mjs, docs.test.mjs, independence.test.mjs) já existem e rodam nas checks."
      },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/scripts/independence.test.mjs", "expect": "exit 0 com SKILL.md do plan-coordinator dentro de 6000 bytes LF" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 11,
      "title": "B: roteiro e preparador offline da sonda AC2b em tools/measure",
      "deps": [],
      "files": {
        "create": [
          "tools/measure/sonda-e41-ac2b.md",
          "tools/measure/sonda-e41-ac2b.mjs"
        ],
        "modify": [],
        "test": [
          "tools/measure/sonda-e41-ac2b.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [
        "tools/measure/sonda-e41-ac2b.mjs: prepare --work <dir> e summarize --work <dir> --config <dir>"
      ],
      "consumes": [],
      "covers": ["AC3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test tools/measure/sonda-e41-ac2b.test.mjs tools/measure/session-metrics.test.mjs", "expect": "exit 0 offline, sem claude -p, com scanPrivacy limpo" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 12,
      "title": "B: verificação final dos critérios e dos portões G1 a G5",
      "deps": [4, 7, 9, 10, 11],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 1 },
      "produces": [
        "verificação final: evidências AC1, AC2 e AC4 a AC8 e G1 a G5 com saída 0"
      ],
      "consumes": [],
      "covers": ["AC1", "AC2", "AC4", "AC5", "AC6", "AC7", "AC8", "C5"],
      "testFirst": {
        "exempt": "Só executa as evidências e os portões; não muda código."
      },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs", "expect": "exit 0 (AC1)" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs", "expect": "exit 0 (AC2)" },
        { "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0 (AC4)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs", "expect": "exit 0 (AC5)" },
        { "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs", "expect": "exit 0 (AC6)" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs", "expect": "exit 0 (AC7)" },
        { "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs", "expect": "exit 0 (AC8)" },
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid", "expect": "exit 0 (G4)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    },
    {
      "n": 13,
      "title": "B: sonda paga AC2b (externa, só com autorização do dono)",
      "deps": [11, 12],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 2 },
      "produces": [
        "linha de resultado da sonda AC2b do E41 (6 execuções, paradas authorize, retries de fatia, custo somado) impressa por summarize"
      ],
      "consumes": [
        { "task": 11, "sig": "tools/measure/sonda-e41-ac2b.mjs: prepare --work <dir> e summarize --work <dir> --config <dir>" },
        { "task": 12, "sig": "verificação final: evidências AC1, AC2 e AC4 a AC8 e G1 a G5 com saída 0" }
      ],
      "covers": ["AC3", "X1", "X2"],
      "testFirst": {
        "exempt": "Medição paga feita pelo roteiro já testado offline na Tarefa 11; não muda código."
      },
      "checks": [
        { "cmd": "node tools/measure/sonda-e41-ac2b.mjs summarize --work D:/claude-pos23-out/e41-ac2b --config D:/claude-pos23-cfg", "expect": "exit 0 com 6 execuções na parada authorize e custo somado até US$ 1" }
      ],
      "locks": [],
      "external": true,
      "externalDedupe": "Antes de cada execução k, se <work>/runs/<k>-<on|off>.json já existe, a execução não roda de novo; se a linha da sonda AC2b do E41 já está em measurements.md, nada roda; cada execução tem --max-budget-usd 0.16 (soma 0,96, até US$ 1, DEC-029).",
      "noCommit": true
    }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "human", "command": null, "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC4", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC5", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC6", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC7", "kind": "test", "command": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC8", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs", "external": false, "externalDedupe": null, "blq": null }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "O que o plano B faz se, ao começar, faltar algo que a spec põe no plano A?",
      "decision": "A Tarefa 1 confere a pré-condição (embed.mjs --check dos 4 alvos e os exports de lib/plan-digest.mjs) e devolve BLOCKED nomeando o que falta; nenhuma tarefa do plano B edita arquivos do plano A.",
      "basis": "Intake: o plano B roda depois do plano A e assume o código dele; R12 da spec separa os dois planos; editar a lib aqui duplicaria trabalho e quebraria a embed.",
      "alternative": "Completar no plano B o que faltar do plano A.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como trocar a proibição de pipe para tail pelo capture obrigatório sem mudar o caminho agy, que usa o mesmo agents/implementer.md e chama buildImplPrompt por pure()?",
      "decision": "O capture é obrigatório quando o prompt traz a linha CAPTURE:, que os dois workflows JS sempre passam (buildImplPrompt só a emite com ctx.capture); checks[].command é o comando interno, idêntico nas duas rodadas, output é a linha JSON e exit o dela; sem a linha vale a regra atual, e as frases fixadas por prompts.test.mjs ficam.",
      "basis": "roadmap-release-agy.py chama pure('buildImplPrompt') e testFirstGap com 3 argumentos, que compara command; o agy está fora do escopo (R9 da spec).",
      "alternative": "Regra incondicional em implementer.md e checks[].command com a chamada inteira do capture.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como comparar nomes do extrator (sem arquivo) com linhas de base e com ignoreFailuresWhenChanged.failurePrefix, que usa o prefixo de arquivo?",
      "decision": "gateSubset compara por nameKey, que tira o prefixo '<arquivo com extensão>::'; num portão com ignoreFailuresWhenChanged os nomes vêm do agente (com arquivo) e o exit sempre do capture.",
      "basis": "R8 da spec pede nomes sem o prefixo para manter as linhas de base da 2.4.0; gateEffective filtra por failurePrefix de caminho, que o extrator não conhece.",
      "alternative": "Recusar ignoreFailuresWhenChanged em portões medidos pelo capture.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que vale um resultado de portão sem JSON do capture válido?",
      "decision": "Conta como portão ausente: validMeasure falha, a medida repete uma vez e depois é falha de infra, nunca verde; S_GATE ganha capture opcional e required não muda; flow.test.mjs ganha um adaptador que gera o JSON a partir do prompt.",
      "basis": "Uma cópia não conferida não pode virar verde (DEC-024/DEC-027); o agy lê SCHEMAS['S_GATE'].",
      "alternative": "Aceitar os números do agente quando o JSON falta.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Quantas tentativas por fatia em cada workflow?",
      "decision": "coordinator.js: 3 (haiku, haiku, sonnet), como manda a spec; roadmap-release.js: 5 por fatia (haiku, haiku, sonnet, sonnet, sonnet), as mesmas de readDisc e readBack hoje.",
      "basis": "Desenho do AC2 da spec para o coordinator; R11 da spec mantém o retry em sonnet; no roadmap-release manter as tentativas atuais evita mudar o comportamento dos testes de discovery.",
      "alternative": "3 tentativas também no roadmap-release.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como fazer a carga B07 sem recópia literal mantendo checkSpecLoad e checkPlanLoad?",
      "decision": "Uma chamada de capture.mjs run por comando (check, emit, blob, head, porcelain), com a cauda conferida quando tailCut === 0 (tailCut é número) e as fatias de capture.mjs slice (SHA conferido, mesmo --cwd do run) quando tailCut > 0; o objeto montado é o de S_TOOLOUT e vai sem mudança às duas funções; os rótulos novos derivam de spec-load<k> e plan-load<k>.",
      "basis": "Desenho B07 da spec (DEC-030); as funções de conferência são chamadas pelo agy por pure().",
      "alternative": "Um só agente rodando os 5 comandos e devolvendo as 5 linhas JSON.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "No coordinator, a recusa acima de MAX_COPY_BYTES vale para toda chamada do script-runner?",
      "decision": "Só para as saídas JSON assinadas (fatias da leitura, apply e capture); as saídas de git (status, add, commit, log) continuam pedidas e lidas como hoje.",
      "basis": "A spec pede a recusa antes do parse do JSON copiado; um git status --porcelain de muitos arquivos pode passar do limite sem ser JSON.",
      "alternative": "Recusar toda saída acima do limite.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Onde documentar a pasta de provas no plan-coordinator, que tem 259 bytes de folga no teto de 6.000 de prose-budget.test.mjs?",
      "decision": "Uma frase depois de '## After the workflow returns' no SKILL.md apontando para references/state.md, que recebe o texto completo; nenhuma citação de references/ antes da fronteira.",
      "basis": "prose-budget.test.mjs soma o SKILL.md inteiro e as referências citadas antes da fronteira; state.md tem 6.758 bytes.",
      "alternative": "Documentar só em state.md, sem tocar o SKILL.md que a spec cita.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como a sonda AC2b para em hold sem despachar revisor opus nem implementer, dentro de US$ 1?",
      "decision": "O prepare aplica approve-map e prelaunch-review pass do passo externo T1 no estado do sandbox, então a execução lê o estado em fatias e para em authorize; o plugin da branch entra por --plugin-dir (nada instalado na config); --model sonnet e --max-budget-usd 0.16 por execução (soma 0,96).",
      "basis": "nextAction de lib/progress-state.mjs pede prelaunch-review (task-reviewer opus) antes de authorize; DEC-029 limita a sonda a US$ 1; .claude/rules/measure.md exige config descartável e --max-budget-usd.",
      "alternative": "Deixar o revisor opus de pré-lançamento rodar em cada execução.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Os planos A e B têm o mesmo id E41 (o plan-tool exige o id da spec), e o coordinator procura commits pelo assunto 'E41 T<n>:'. Como evitar confusão?",
      "decision": "Todo título do plano B começa com 'B:', então os assuntos ficam 'E41 T<n>: B: ...'; o estado do plano B fica em plano-b/progress.json.",
      "basis": "commitSubject e commitGrep de coordinator.js usam só o id do plano; parseLogLine pega o commit mais recente com o assunto, então só o caso de pathspec já limpo poderia achar um commit do plano A.",
      "alternative": "Um id diferente para o plano B, que plan-tool check recusa (spec-id-mismatch).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Onde e com que diretório rodar capture.mjs prune no fecho?",
      "decision": "coordinator.js: no caso done, --task-prefix '<id do plano>-' --cwd ROOT; roadmap-release.js: depois do agente de CLEANUP, --task-prefix '<E>-' --cwd no worktree de integração (o worktree do entregável já foi removido com o seu git-dir); a falha só vira aviso (concerns ou nada no done).",
      "basis": "R13 da spec; a pasta fica no git-dir absoluto de quem rodou, e a do worktree do entregável some com ele.",
      "alternative": "Prune sem --cwd, pelo diretório atual do script-runner.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Como a revisão final do coordinator lê o diff quando os commits são none e o review-package só cobre base..HEAD?",
      "decision": "A linha Diff: manda rodar review-package.mjs ROOT base HEAD <git-dir>/pt-evidence/review/<id>-final.txt e, com commits none, redirecionar git diff HEAD para <id>-worktree.diff na mesma pasta; ls-files --others continua na linha.",
      "basis": "Desenho dos revisores (DEC-024) e R10 da spec; review-package.mjs recebe <repo> <base> <tip> <out>.",
      "alternative": "Manter git diff direto na saída do Bash para o caso none.",
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
      "what": "O dono confere a linha da sonda AC2b do E41 em docs/plans/roadmap-pos-2-3-0/measurements.md (3 execuções com context-mode ligado e 3 desligado, todas as fatias conferidas, custo até US$ 1).",
      "why": "AC3 (AC2b do cartão) é verify: human; só o dono aceita a medição paga.",
      "blocking": false,
      "workaround": "AC1, AC2 e AC4 a AC8 entram na branch com o G1 verde; o E41 fica em na-branch até a conferência."
    },
    {
      "id": "H2",
      "kind": "credential",
      "what": "Sessão autenticada da conta na config descartável indicada pela variável de ambiente CLAUDE_CONFIG_DIR (D:/claude-pos23-cfg), feita pelo dono antes da Tarefa 13.",
      "why": "A sonda faz chamadas reais de claude -p; o login é ato do dono (DEC-012) e nunca é gravado em arquivo.",
      "blocking": false,
      "workaround": "Reusar a sessão já logada para o lote do E35, se ainda ativa; sem ela, só a Tarefa 13 espera."
    }
  ]
}
```
