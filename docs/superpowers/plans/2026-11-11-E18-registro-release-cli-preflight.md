# E18 -- Registro do release pela CLI e permissões no preflight: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** o preflight do `roadmap-release` passa a listar as regras de permissão da CLI do tracker e dos comandos `{verify}` dos cards abertos, e as decisões do executor pendentes lidas da branch alvo; o workflow passa a registrar status, log, decisões, pendentes e linha em andamento por comandos exatos da CLI de E3, com veredito calculado por código sobre o JSON da CLI e uma releitura independente.

**Arquitetura:** `preflight.mjs` (Node, lê arquivos e git) ganha `WORKFLOW_SCRIPTS`, o segundo parâmetro de `requiredCommands`, `trackerCli` e `pendingDecisions` (função exportada de `roadmap.mjs`). O workflow (`roadmap-release.js`, sem import nem processo, DEC-058) ganha funções puras entre `// <pure>` e `// </pure>` que montam os comandos (`recordCommands`) e julgam o resultado (`recordVerdict`); `recordStatus` e a etapa de documentação despacham um agente mecânico que roda a lista na ferramenta Bash e uma leitura independente que devolve `status --json` e `brief --json` crus.

**Stack:** Node 22 (ESM), `node:test`, `node:assert/strict`; sem dependência nova.

**Spec:** docs/superpowers/specs/2026-11-11-E18-registro-release-cli-preflight-design.md (ler inteiro antes de cada tarefa; as seções citadas abaixo são dela).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell, Node v22.17.1, claude CLI 2.1.322, `core.autocrlf=true` (checkout CRLF). Todo teste novo normaliza `\r\n` ao ler texto do disco; caminhos que o código devolve usam `/` como separador.
- Trabalho só no worktree `D:/projects/claude-play-wt/E18`, branch `feat/E18`; portas 5200-5209 (nenhuma tarefa sobe servidor). Temporários só em `D:/projects/claude-play-wt/_tmp/E18/`, apagados no fim. Testes usam `mkdtempSync(join(tmpdir(), ...))` e não deixam nada no repositório.
- Nada de `git add -A` nem `git stash`: cada commit adiciona só os arquivos listados da tarefa. Mensagens começam com `E18 T<n>:` e terminam com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`. Nunca push.
- Não editar `docs/plans/roadmap-evolucao-skills/` nem `plugins/_template/`. Não subir versão de plugin nem a linha 1 do checker (DEC-042). Nenhum arquivo de teste novo: os casos vão para `preflight.test.mjs` e `flow.test.mjs` (decisão autônoma 19).
- `roadmap.mjs` muda só por `export` em `pendingDecisions`; nenhum comando novo na CLI.
- Workflow sem import, sem leitura de arquivo, sem processo (DEC-058). O veredito do registro nunca lê `statusWritten`, `details` nem outra frase do agente.
- Regra de script: `Bash(node *<nome>" *)` (DEC-060); `WORKFLOW_SCRIPTS = ['roadmap.mjs']`. `Bash(node:*)` e `Bash(git:*)` continuam exigidos.
- Cláusula fixa `BASH_ONLY` (constante do workflow, texto da spec "Shell dos comandos") em todo prompt com comandos montados; sem Bash, o agente devolve `error: "no-bash"` e o veredito reprova.
- Limite de célula: `limits.cellChars` de `roadmap.config.json` da pasta, 300 quando ausente. Sufixo do corte: `[...] texto completo em <source>` (pt) / `[...] full text in <source>` (en). Dono dos pendentes: `dono` (language `pt*`) / `owner`.
- Escopo de decisão: frase final `Alcance: local.` ou `Scope: local.` vira `--scope local`; o resto, `--scope contrato`.
- Gates canônicos (rodar antes de cada commit, no worktree E18):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` -- esperado exit 0, `fail 0`, total maior ou igual a 1236 (baseline 1236, sem falha preexistente) e crescendo com os casos novos.
  - G2: `claude plugin validate .` -- exit 0.
  - G3: `claude plugin validate plugins/productivity-tools` -- exit 0.
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` -- exit 0.
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` -- exit 0.
- Nenhuma tarefa precisa de navegador. Nenhuma tarefa precisa de lock (needsLock: nenhum). Nenhuma tarefa tem efeito externo.

## Foco de revisão

1. Texto com `'`, `$`, crase, `"` ou quebra de linha (decisão do spec, nota de risco) chegando a `recordCommands`: o comando montado, rodado em Git Bash, entrega à CLI o texto literal (quebra de linha vira espaço); o teste de `shq` roda a string montada com `bash -c 'printf %s ...'` quando `bash` existe no PATH (Git Bash no ambiente medido) e compara.
2. `trackerCli` resolvido em Windows (`D:\...`): sai com `/`, absoluto, existente; com `"` no caminho vira erro (Tarefa 1).
3. Retomada com o mesmo status já gravado: `set-status` e `log` somem da lista (`skipStatus`), a releitura confere a palavra e não há linha de log repetida (Tarefa 4).
4. Saída de `brief --json` ausente, não JSON, ou sem `result.checker.errors` numérico: veredito reprovado, nunca aprovado em silêncio; `status --json` sem `checker` ao lado de um `brief` sem erro: aprovado (Tarefa 3).
5. Linha do painel com segmentos rotulados (`code: ...; piece 2: ...`) e bloqueio que afeta outros entregáveis: `--piece code` nos comandos; bloqueio compartilhado reprova por código com mensagem de fechamento manual (Tarefas 3 e 4).

---

### Tarefa 1: preflight -- regras dos scripts do plugin, dos comandos `{verify}` e `trackerCli` (peça 1)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`
- Teste: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`

**Interfaces:**
- Produz: `export const WORKFLOW_SCRIPTS = ['roadmap.mjs']`; `export function scriptRule(name) -> string` (= `Bash(node *${name}" *)`); `export function openCardCommands(parsed, vocab) -> string[]` (comandos `evidence` de critérios com `tag.kind` em `EXECUTABLE_KINDS` dos cards abertos); `requiredCommands(cfg, extras = {}) -> { [rule]: string[] }`, onde `extras = { cards?: string[], scripts?: { name, path }[] }`; `runPreflight(...)` devolve também `trackerCli: string` (absoluto, `/`).
- Consome: `parseRoadmapTexts`, `EXECUTABLE_KINDS` de `../../../lib/roadmap-format.mjs`; `subcommands`, `missingRules` existentes.

- [ ] **Passo 1: testes que falham** em `preflight.test.mjs`:
  - `requiredCommands sem extras devolve o mesmo de hoje`: `deepEqual(requiredCommands(cfg), <objeto atual para o cfg de exemplo>)` e `deepEqual(requiredCommands(cfg, {}), requiredCommands(cfg))`.
  - `AC1: card aberto com verify e script do plugin sem regra aparecem em missingRules`: `cmds = requiredCommands(cfg, { cards: ['npx vitest run'], scripts: [{ name: 'roadmap.mjs', path: '/p/roadmap.mjs' }] })`; com configurações sem regra de `node` nem de `npx`, `missingRules(Object.keys(cmds), settings, cmds)` inclui `'Bash(npx:*)'` e `'Bash(node *roadmap.mjs" *)'`; com `allow: ['Bash(node:*)', 'Bash(npx:*)', 'Bash(git:*)']` nenhuma das duas falta; `cmds['Bash(node *roadmap.mjs" *)']` é `['node "/p/roadmap.mjs" status']`.
  - `AC1 ponta a ponta`: repositório temporário (padrão do teste existente da linha 181) com `roadmap.config.json` (vocab com `deliverableStatuses` de pelo menos 5 palavras), estratégia com tabela `roadmap:gates` e um card `E1` com `{verify: test; evidence: npx vitest run}` e `state.md` com `E1` na 1ª palavra; `runPreflight(folder, { home, configDir })` com configurações vazias traz em `missingRules` as duas regras.
  - `card na branch não pede regra`: o mesmo card com status `deliverableStatuses[4]` -> `openCardCommands` vazio; card sem linha no painel e card bloqueado contam como abertos.
  - `trackerCli aponta para arquivo existente com /`: `existsSync(r.trackerCli)`, `!r.trackerCli.includes('\\')`, termina em `roadmap-tracker/scripts/roadmap.mjs`.
  - `trackerCli com aspas duplas vira erro`: exportar `export function trackerCliPath(from = <dir do preflight>) -> { path, error }`; `trackerCliPath('/a"b/c').error` não vazio, e `runPreflight` põe esse erro em `errors`.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` -- esperado FAIL (export inexistente).
- [ ] **Passo 3: implementar.** Regras de script: amostra `node "<path>" status`. Comandos de card: como os de gates (`subcommands`, sem `ENV_PREFIX`, `Bash(<primeira palavra>:*)`). Card aberto: algum segmento do status (de `parseStatusSegments` sobre a célula do painel) com posição anterior à de `deliverableStatuses[4]`, ou igual a `vocab.blockedStatus`/palavra de bloqueado, ou card sem linha. `runPreflight` lê a estratégia e `state.md` da branch `ref` com `readRef` quando ela tem a pasta; senão da árvore de trabalho, com o aviso `roadmap cards read from the working tree (<ref> has no <pasta>)`; falha de leitura vira aviso. `trackerCli` = `resolve(dirname(fileURLToPath(import.meta.url)), '../../roadmap-tracker/scripts/roadmap.mjs')` com `sep` trocado por `/`; ausente ou com `"` -> `errors`. Atualizar o comentário de `Bash(node:*)` (o workflow não roda mais o checker; roda programas Node temporários).
- [ ] **Passo 4:** o mesmo comando do Passo 2 -- esperado PASS. Depois G1 a G5 -- todos exit 0.
- [ ] **Passo 5: commit** `git add plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e `git commit -m "E18 T1: preflight lista regras da CLI do tracker e dos comandos verify, e devolve trackerCli"`.

### Tarefa 2: preflight -- decisões do executor pendentes da branch alvo (peça 4)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` (só `export` em `function pendingDecisions`, linha ~192)
- Modificar: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`
- Teste: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`

**Interfaces:**
- Consome: `export function pendingDecisions(ctx)` de `roadmap.mjs`, com `ctx = { roadmap: { config }, parsed }` (`parsed = parseRoadmapTexts({ strategy, files })`).
- Produz: `runPreflight(...)` devolve `pendingDecisions: [{ id, deliverable, scope, startedDependents, released }]`, na ordem de `decisions.md`.

- [ ] **Passo 1: testes que falham:**
  - `AC4: decisão do executor pendente da branch alvo aparece com o entregável`: repositório git temporário com cópia de `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` como pasta; na branch `alvo`, `decisions.md` com uma linha a mais (9 colunas, Entregável `E2`, decisão terminada em `Alcance: contrato.`, Origem `executor`, Status = `vocab.decisionPending`); a árvore de trabalho volta a outra branch sem essa linha. `runPreflight(folder, { ref: 'alvo', home, configDir })`: `pendingDecisions` contém `{ id: <id novo>, deliverable: 'E2', scope: 'contrato' }` (comparar só esses campos com `partialDeepStrictEqual` ou campo a campo).
  - `sem ref a lista vem da árvore de trabalho e há aviso de origem`: a mesma pasta sem `ref` -> nenhum item com o id novo e um `warnings` que cita a árvore de trabalho.
  - `falha de leitura é aviso, não erro`: `roadmap.config.json` inválido na pasta -> `pendingDecisions: []`, aviso presente, e nenhum erro novo vindo dessa leitura.
  - `export sem mudança de comportamento`: `node roadmap.mjs pending-decisions <fixtures/valid> --json` continua com `summary.exitCode` 0 (o teste da CLI existente cobre; não duplicar).
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` -- esperado FAIL.
- [ ] **Passo 3: implementar.** No preflight, ler `roadmap.config.json`, a estratégia e os arquivos de `config.files` (só os que `pendingDecisions` usa: `state`, `decisions`) por `git show <ref>:<caminho>` quando a branch tem a pasta, senão do disco com aviso; normalizar BOM e `\r\n`; montar `ctx` mínimo e chamar `pendingDecisions`. Toda exceção vira aviso. Reutilizar a mesma leitura de textos da Tarefa 1 (uma função `readRoadmapTexts(root, dir, ref, warnings) -> { config, strategy, files, from }`).
- [ ] **Passo 4:** comando do Passo 2 -- esperado PASS; G1 a G5 -- exit 0. Uso manual só de leitura: `node plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs docs/plans/roadmap-evolucao-skills --ref release/roadmap-skills-v2` -- esperado JSON com `pendingDecisions` (lista das pendentes de origem executor da release) e `trackerCli`; nenhum arquivo muda (`git status --porcelain` vazio).
- [ ] **Passo 5: commit** dos três arquivos: `E18 T2: preflight lista decisões do executor pendentes da branch alvo`.

### Tarefa 3: funções puras de montagem e veredito do registro

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (dentro de `// <pure>` ... `// </pure>`)
- Teste: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces (assinaturas exatas, seção "Funções puras novas" da spec):**
- `shq(s) -> string`; `fitCell(text, room, source, lang) -> { text, cut }`; `fitEvidence(refs, max) -> string[]`; `cliCmd(cli, command, folder, args) -> string` (`node "<cli>" <comando> <shq(folder)> <args...> --json`).
- `phrases(lang) -> { owner, log(E, word), next(E, word), inflightNote(E), blockWhat(E, reason), blockUnblocks(E), commit(E, word) }` (tabela pt/en; textos curtos, citam entregável e status, abaixo de 300 e sem `bannedPhrases`).
- `recordCommands({ cli, folder, E, word, piece, blockedBy, evidence, next, logWhat, decisions, pending, inflight, skipStatus, lang, cellChars, source }) -> { commands: string[], cuts: [{ where, source, full }], error? }`. `decisions: [{ text, scope }]`; `pending: string[]`; `inflight: { add?: branch, remove?: branch, note? }`; `blockedBy: { id, affects: string[] } | null` (bloqueio que afeta outros -> `error`); `word === blockedStatus` monta `block-open` (com `--what`, `--affects E`, `--unblocks`, `--evidence`) no lugar de `set-status`/`log`.
- `recordVerdict({ expected, results, read, E, word, piece, blockedStatus }) -> { ok, failures: string[], decisionIds: string[] }`, com `results` = `{ error?, runs: [{ command, exit, stdout }] }` e `read` = `{ status, brief, pendingDecisions, head, porcelain }` (saídas cruas, strings).

- [ ] **Passo 1: testes que falham** (via `loadPure()`):
  - `shq`: `shq("a'b")` = `'a'\''b'`; `$`, crase e `"` ficam literais; `"a\nb"` -> `'a b'`. Quando `bash` existe (`spawnSync('bash',['-c','true']).status === 0`), `bash -c "printf %s " + shq(x)` imprime `x` com a quebra trocada por espaço; senão o caso é `skip` com motivo.
  - `fitCell`: texto que cabe -> igual (espaços juntados) e `cut: ''`; 600 caracteres com `room` 300 -> `text.length <= 300`, termina em `texto completo em docs/s.md`, o trecho antes do sufixo termina em fronteira de palavra, `cut` = original; `room` reduzido pela frase `Alcance: contrato.` mais 1.
  - `fitEvidence`: cinco refs longas com `max` 120 -> prefixo das refs cuja junção `` `a`, `b` `` cabe em 120.
  - `recordCommands`: sem rótulo nenhum `--piece`; com `piece: 'code'`, `--piece code` em `set-status`; `skipStatus` omite `set-status` e `log`; ordem `block-close`, `set-status`, `log`, `add-decision`..., `add-pending`..., `inflight-*`; decisão de 600 caracteres -> o valor de `--decision` mais a frase de alcance cabe em 300 e `cuts[0].full` é o texto inteiro; `blockedBy` com `affects: ['E1','E2']` para `E1` -> `error` citando fechamento manual; `word` bloqueado -> `block-open` e nenhum `set-status`.
  - `recordVerdict` (um teste por caso, todos com `ok` false salvo o último): comando esperado faltando; fora de ordem; texto diferente; `exit` 1; `stdout` não JSON; JSON com `tool` diferente de `roadmap`; `summary.exitCode` 1 ou `errors` não vazio (inclusive em `add-decision`); releitura com outra palavra no segmento; `brief` ausente; `brief` sem `result.checker`; `result.checker.errors` 2; id de `add-decision` com `changed` não vazio ausente de `pending-decisions --json`; `error: 'no-bash'`; `runs` vazia. Aprovado: tudo `exit` 0, `status --json` sem `checker`, `brief` com `checker.errors: 0`, palavra igual -> `ok: true`, `decisionIds` com o id.
  - `nenhum campo do agente decide`: um `results` com `statusWritten: 'ok'` e `details: 'tudo certo'` mas releitura errada -> `ok: false`.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` -- esperado FAIL só nos casos novos.
- [ ] **Passo 3: implementar** as funções puras sem import (o `load-pure` avalia o trecho com `new Function`). Saída da CLI: `{ tool: 'roadmap', summary: { exitCode }, errors, warnings, changed, result }`; o id gravado por `add-decision` vem de `result` (ler `roadmap.mjs`, comando `add-decision`, para o campo exato).
- [ ] **Passo 4:** comando do Passo 2 -- esperado PASS; G1 a G5 -- exit 0.
- [ ] **Passo 5: commit** dos dois arquivos: `E18 T3: funções puras de montagem e veredito do registro pela CLI`.

### Tarefa 4: `recordStatus` pela CLI, argumento `trackerCli` e descoberta

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Teste: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`
- Modificar só se fixarem texto ou esquema do registro antigo (`statusWritten`, `checkerErrors`, `trackerAvailable`, `roadmap-tracker`): `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` (nenhum caso novo neles)

**Interfaces:**
- Consome: Tarefa 3 (`recordCommands`, `recordVerdict`, `cliCmd`, `phrases`, `fitCell`).
- Produz: `const BASH_ONLY = '...'` (fora de `<pure>`, texto da spec); `args.trackerCli` obrigatório; descoberta devolve `language` e não exige `trackerAvailable`; `recordStatus(E, status, refs, extra) -> { ok, failures, head, cuts }`, com `extra = { decisions?: string[], pending?: string[], inflight?: {add|remove, note}, reason?: string }`; `out.recordCuts: [{ where, source, full }]`, transcrito por `persistReviews` na seção "Textos cortados no registro".

- [ ] **Passo 1: testes que falham** em `flow.test.mjs` (o mock de `/:status-/` passa a devolver `{ runs: [...] }` com `stdout` JSON da CLI gerado a partir dos comandos do prompt, e `/:status-.*-read$/` devolve `{ status, brief, pendingDecisions, head, porcelain }` crus; ajustar `exec` para passar `trackerCli: '/t/roadmap.mjs'` por padrão):
  - `AC2 registro de plano e executando pela CLI`: os prompts de `E1:status-<plano>` e `E1:status-<executando>` contêm `node "/t/roadmap.mjs" set-status` e `node "/t/roadmap.mjs" log` para `E1`; nenhum prompt de registro contém `roadmap-tracker`; a decisão do spec vira `add-decision`, a entrada humana vira `add-pending`, a branch vira `inflight-add`.
  - `AC3 releitura com outra palavra reprova por código`: agente de registro com todos `exit` 0, releitura com outra palavra -> no `plan-only` o entregável falha com `failKind: 'infra'`; no `run`, `concerns` contém o registro de `executando` falho.
  - `AC3 add-decision com erro da CLI reprova`: `exit` 1 e `errors: [{ code: 'x' }]` no `add-decision` -> falho.
  - `AC3 stdout que não é JSON da CLI, ou comando omitido, reprova`.
  - `AC3 no-bash reprova`: agente devolve `{ error: 'no-bash', runs: [] }` -> falho.
  - `textos longos não viram concern`: decisão e entrada humana com 400 caracteres -> todo valor de opção nos comandos montados cabe em 300, nenhum `concern` de registro, e os textos inteiros chegam ao prompt do `review-log` em `recordCuts`.
  - `retomada não repete log`: descoberta com `E1` já na palavra pedida -> o prompt não tem `set-status` nem `log`, e o veredito confere a palavra.
  - `falta de trackerCli`: `exec({ args: { trackerCli: undefined } })` devolve `status: 'error'` e `calls` vazio.
  - `BASH_ONLY literal` em todo prompt `/:status-/`.
  - Atualizar os testes antigos que fixam `checkerErrors`/`statusWritten`/`trackerAvailable` para o esquema novo, sem afrouxar o que verificam.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` -- esperado FAIL nos casos novos.
- [ ] **Passo 3: implementar.** `recordStatus` segue os passos 1-4 da spec ("`recordStatus(E, status, refs, extra)` passa a"): agente `${E}:status-${status}` (haiku/low) roda a lista com `BASH_ONLY`, para no primeiro `exit` diferente de 0, e comita só `git add -- <roadmapDir>` quando há algo em stage, com a mensagem de `phrases(lang).commit` e o trailer; leitura `${E}:status-${status}-read` (haiku/low, só leitura, `BASH_ONLY`) devolve cru `status --json`, `brief --json`, `pending-decisions --json`, `git rev-parse HEAD`, `git status --porcelain`. Segmento `--piece code` quando a célula tem rótulos. Última palavra gravada por entregável num `Map` iniciado pela descoberta. `lastGood` só avança com veredito ok e `head` da releitura. Chamadores: `plan-only` falha `infra` com veredito falho; `executando` vira `concern`; bloqueado (linha ~2018) segue em `safe`, montando `block-open` com o motivo por `fitCell`. Remover `trackerAvailable` do esquema da descoberta e da checagem da linha ~994; acrescentar `language`. Na retomada, `trackerCli` entra na lista de argumentos substituídos como `config` (`withoutConfig`).
- [ ] **Passo 4:** comando do Passo 2 -- esperado PASS; `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` -- esperado PASS; G1 a G5 -- exit 0.
- [ ] **Passo 5: commit** só dos arquivos tocados da lista: `E18 T4: registro de status do release pela CLI com veredito por código`.

### Tarefa 5: etapa de documentação e relatório pela CLI (peça 3)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (etapa `docs`, linhas ~1335-1358; item do checker no relatório final)
- Teste: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: Tarefas 3 e 4 (`recordCommands`, `recordVerdict`, `BASH_ONLY`, `phrases`).
- Produz: `S_DOCS = { runs, error? }`; `S_DOCMEAS = { status, brief, clean, head, measureOk?, measureDetails? }`; `docsOk = recordVerdict ok && checker sem erro && clean && medição ok`.

- [ ] **Passo 1: testes que falham:**
  - `AC2 documentação pela CLI`: o prompt `E1:docs1` contém `node "/t/roadmap.mjs" set-status` para `STATUS_AFTER_MERGE`, `node "/t/roadmap.mjs" log`, `inflight-remove`, um `add-pending` por risco aceito, entrada humana e critério sem evidência automática; não contém `roadmap-tracker`.
  - `AC3 documentação: releitura falha leva à 2ª rodada só com o que faltou`: 1ª medição com outra palavra no painel -> o prompt `E1:docs2` não repete o comando `log` que teve veredito ok e repete o `set-status`; persistindo, `op('docs', ...)` aparece nas ações de operador.
  - `checker só de brief`: nenhum prompt gerado cita `check-roadmap.mjs` nem `disc.checker`; `docs-measure` e `status-*-read` pedem `status ... --json` e `brief ... --json`.
  - `forma das chamadas de script`: em todo prompt gerado, cada ocorrência de `roadmap.mjs` está em `node "<...>roadmap.mjs" <argumento>` (regex `/node "[^"]*roadmap\.mjs" \S/`), e o nome está em `WORKFLOW_SCRIPTS` (importar de `preflight.mjs`).
  - `BASH_ONLY` literal em `docs<k>` e `docs-measure<k>`.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` -- esperado FAIL nos casos novos.
- [ ] **Passo 3: implementar** conforme a seção "Etapa de documentação" da spec: item 2 do prompt vira a lista exata montada por `recordCommands` com `source` apontando para o log de revisões integrado (riscos, entradas humanas) e para o plano (critérios); itens marcados `[already authorized and run in this run: ...]` seguem no julgamento do agente, que roda o `add-pending` montado sem mudar o texto; proibição de revisão da estratégia e de migração de formato continua (`NO_REVISION`). Relatório final: o item do checker cita `result.checker` (erros, avisos, `folder`, `stale`) de `brief --json`.
- [ ] **Passo 4:** comando do Passo 2 -- esperado PASS; G1 a G5 -- exit 0.
- [ ] **Passo 5: commit** dos dois arquivos: `E18 T5: etapa de documentação registra o roadmap pela CLI`.

### Tarefa 6: SKILL.md e config.md

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/SKILL.md` (passo 2, passo 4 e regra das paradas)
- Modificar: `plugins/productivity-tools/skills/roadmap-release/references/config.md` (seção "Permission preflight")

- [ ] **Passo 1:** SKILL.md passo 2: a saída do preflight lista também `trackerCli` e `pendingDecisions`; a frase "`missingRules` cannot see the `{verify}` commands..." sai e entra: `missingRules` cobre os comandos `{verify}` executáveis dos cards abertos e os scripts de `WORKFLOW_SCRIPTS`. Parada única: em `run`, acontece também com uma pendente de alcance `contract`/`contrato`, mostrada por entregável com `startedDependents`; as `local` só entram no relatório; a pessoa ratifica ou rejeita pelo tracker ou diz para seguir; a skill nunca ratifica; após a resposta o preflight roda uma vez de novo, sem segunda parada pelas mesmas decisões; em `dry-run` e `plan-only`, só relato. Passo 4: passar `trackerCli` junto de `config` e `runToken`, e substituí-lo na retomada. Manter as quatro perguntas permitidas do item 12 (a parada continua sendo a pergunta (2)).
- [ ] **Passo 2:** config.md: regras exigidas passam a incluir `Bash(node *roadmap.mjs" *)` (forma de DEC-060) e as regras dos comandos `{verify}` dos cards abertos; some a frase de que o preflight não os vê.
- [ ] **Passo 3:** G5 -- exit 0 (frontmatter e lint); G1 a G4 -- exit 0.
- [ ] **Passo 4: commit** dos dois arquivos: `E18 T6: skill e config do release descrevem trackerCli, regras de script e decisões pendentes`.

### Tarefa 7: teste comportamental da skill (tarefa do orquestrador da sessão principal, DEC-204)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhum

**Arquivos:** nenhum. Esta tarefa não muda arquivo da branch e não faz commit.

**Execução:** pela emenda DEC-204, esta tarefa é do **orquestrador da sessão principal**, não do executor do workflow do release (que não tem ferramenta de subagent, BLQ-1). O executor do workflow não tenta despachar subagents para ela; marca-a como pendente para o orquestrador.

- [ ] **Passo 1:** o orquestrador despacha um subagent sonnet que segue `plugins/productivity-tools/skills/roadmap-release/SKILL.md` literalmente, no worktree E18, sobre `docs/plans/roadmap-evolucao-skills/`, em `dry-run`, até o passo 2 e a montagem dos argumentos do passo 4, sem chamar o Workflow: roda `node plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs docs/plans/roadmap-evolucao-skills --ref release/roadmap-skills-v2`, compõe a parada com `missingRules` e `pendingDecisions`, e grava a saída e a lista de ambiguidades em `D:/projects/claude-play-wt/_tmp/E18/`.
- [ ] **Passo 2:** um segundo subagent (sonnet, só leitura) faz a revisão adversarial do resultado contra a spec (seções "Peça 4" e "Teste comportamental").
- [ ] **Passo 3:** o orquestrador repassa a saída literal e o resumo para o log de revisões do entregável; apaga `D:/projects/claude-play-wt/_tmp/E18/`. Verificação: `git status --porcelain` vazio no worktree E18.
- Evidência aceitável se o passo não puder rodar neste ambiente: a saída do preflight do Passo 1 e o registro do motivo no log de revisões; nunca um aceite fictício.

## Evidência dos critérios de aceite

| ac | kind | command | testRef | blq | external | externalDedupe |
|---|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs | preflight.test.mjs: "AC1: card aberto com verify e script do plugin sem regra aparecem em missingRules", "AC1 ponta a ponta" | | false | |
| AC2 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC2 registro de plano e executando pela CLI", "AC2 documentação pela CLI" | | false | |
| AC3 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC3 releitura com outra palavra reprova por código", "AC3 add-decision com erro da CLI reprova", "AC3 stdout que não é JSON da CLI, ou comando omitido, reprova", "AC3 no-bash reprova", "AC3 documentação: releitura falha leva à 2ª rodada só com o que faltou" | | false | |
| AC4 | test | node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs | preflight.test.mjs: "AC4: decisão do executor pendente da branch alvo aparece com o entregável" | | false | |
