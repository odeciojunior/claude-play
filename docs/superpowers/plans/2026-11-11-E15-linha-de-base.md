# E15 -- Linha de base registrada: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** Entregar em `tools/measure/` o que o dono precisa para operar e registrar a linha de base (versão do superpowers e origem da semeadura no agregado, `--from-run` no lançador, detecção por classe no comparador, condutor `run-baseline.mjs`, consolidador `baseline.mjs`) e o roteiro do dono, sem lançar nenhuma execução paga.

**Architecture:** Scripts ESM sem dependências, no padrão de E1: cada um exporta suas funções e só roda a CLI quando chamado diretamente. O condutor importa `runBatch` e recebe as dependências por injeção (testado com `runBatch` simulado); o consolidador lê os `aggregate.json` de uma pasta e grava `baseline.json` e `linha-de-base.md`. Os dados reais só entram quando o dono roda as execuções pagas.

**Tech Stack:** Node 18+ (medido: v22.17.1), `node:test`, `node:assert/strict`, `node:crypto` (SHA-256), `git` pelo `child_process`. Sem npm.

**Spec:** `docs/superpowers/specs/2026-11-11-E15-linha-de-base-design.md`

## Global Constraints

- ESM, Node 18+ sem dependências; identificadores, comentários e mensagens em inglês em `tools/measure/`; o roteiro do dono e o texto de `linha-de-base.md` em português.
- Todo script novo exporta suas funções e só executa a CLI quando `resolve(process.argv[1]) === fileURLToPath(import.meta.url)`.
- Nenhum teste chama `claude`, rede ou a pasta de configuração real; tudo roda em `mkdtempSync(join(tmpdir(), ...))`, apagada no fim (`rmSync(..., { recursive: true, force: true })` em `finally`).
- Nenhuma tarefa lança `claude -p` real nem execução paga (DEC-011, DEC-043): rodar, conferir e aprovar são atos do dono.
- Nada é gravado em `tools/measure/` fora de `tools/measure/out/` (ignorada pelo git).
- Fixtures novas seguem a varredura de privacidade de E1 (`session-metrics.test.mjs`, teste `tools/measure holds no session id, personal path or unfabricated text`): UUIDs só `00000000-0000-4000-8000-xxxxxxxxxxxx`, ids de agente só `agent-afab<hex>`, todo campo `text`/`description`/`prompt`/`content` começa com `[fab]`, nenhum caminho `C:\Users\...`, `/home/...`, `/Users/...`.
- Limiares do comparador inalterados: margem 6, 40 tentativas, tolerância de bytes 3%, inconclusivo com falta bloqueia (DEC-033, DEC-081).
- Plano de execuções (DEC-033, DEC-016, DEC-084), nesta ordem: `planner` 1, `tracker` 1, `plan-only` 5, `coordinator` 3, `completo` 3, `parada-retomada` 3, `plano-semeado-A` 5, `plano-semeado-B` 5, `codigo-semeado-A` 5, `codigo-semeado-B` 5. `plano-semeado-codigo` e `spec-semeado-*` não entram.
- Tag de partida padrão: `productivity-tools--v1.6.0` (commit `3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a`, DEC-036). Nenhuma tag é criada.
- Teto de tentativas extras por variante semeada: 5.
- Nenhum arquivo de `plugins/` muda e nenhuma versão é alterada; esta branch não edita `docs/plans/roadmap-evolucao-skills/`, nem `measurements.md`, `decisions.md` ou a estratégia, nem o comando de nenhum gate.
- Nenhum servidor nem porta: a faixa 5200-5209 não é usada. Nenhuma tarefa precisa de navegador.
- Ambiente medido: Windows 11, PowerShell 7 e Git Bash; `core.autocrlf=true`. Todo leitor de texto aceita `\r\n`; hashes de texto são calculados sobre o texto em LF (`readText` de `make-scenario.mjs`).
- Commits só com os arquivos da tarefa (`git add <arquivos>`, nunca `git add -A`), mensagem começando por `E15 T<n>:` e terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`. Nenhum push.

## Review Focus

- `--from-run` apontando para uma pasta sem plano de E5: `seedSourceOf` e o condutor saem com a mensagem do `e5Texts` (código 2 no condutor), sem lançar nada. Teste na Task 1 e na Task 4.
- Retomada depois de uma variante parcial: a soma das execuções válidas de todos os agregados da variante em `--out` decide o que falta, para não relançar o que já rodou. Teste na Task 4 (`resume counts valid attempts across partial aggregates`).
- Agregados de arnês (`harness` presente) na mesma pasta `--out`: ficam fora da retomada e da consolidação. Teste na Task 4 e na Task 5.
- Agregado de classe de detecção com 5+5 execuções válidas: o comparador não pode marcar `missing` (era o defeito que travaria todo ponto de medição). Teste na Task 3 e na Task 5.
- Pasta `--work` reutilizada entre passadas do condutor: cada chamada a `runBatch` recebe uma subpasta própria, para `makeSandbox` não colidir com um sandbox anterior. Teste na Task 4.

---

### Task 1: origem da semeadura em `make-scenario.mjs`

**Files:**
- Modify: `tools/measure/make-scenario.mjs`
- Test: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Consumes: `e5Texts(fromRun)` (interno, já existe), `readText`.
- Produces: `export function seedSourceOf(fromRun?: string): { kind: 'execucao-aprovada' | 'sintetico', spec: string, plan: string, specSha256: string, planSha256: string }`. Com `fromRun`: `spec`/`plan` são só o nome do arquivo (`basename`) escolhido por `pickFromRun`; sem `fromRun`: `spec: 'scenario/e5/spec.md'`, `plan: 'scenario/e5/plan.md'`. Hash = SHA-256 hex do texto em LF devolvido por `e5Texts`. Nunca devolve o caminho da pasta.

- [ ] **Step 1: Escrever os testes que falham**

Em `make-scenario.test.mjs`, três testes:
- `seedSourceOf without a folder describes the synthetic texts`: `kind === 'sintetico'`, `spec === 'scenario/e5/spec.md'`, `plan === 'scenario/e5/plan.md'`, `specSha256` igual a `createHash('sha256').update(readText(join(here,'scenario','e5','spec.md'))).digest('hex')` (idem plano).
- `seedSourceOf with a folder describes the approved run by file name and hash`: monta em tmp `docs/superpowers/specs/2026-01-01-E5-x-design.md` e `docs/superpowers/plans/2026-01-01-E5-x.md` (cópia da fixture sintética com uma linha `[fab] extra line` a mais); espera `kind === 'execucao-aprovada'`, `spec === '2026-01-01-E5-x-design.md'`, `plan === '2026-01-01-E5-x.md'`, hashes diferentes dos sintéticos, e `JSON.stringify(result)` não contém a pasta tmp (nem com `/` nem com `\`).
- `seedSourceOf fails like the scenario when the plan is missing`: pasta só com o spec; `assert.throws` com a mesma mensagem que `makeScenario(dir, 'plano-semeado-A', { fromRun })` dá (compare as duas mensagens).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/measure/make-scenario.test.mjs`
Expected: FAIL nos três testes novos (`seedSourceOf is not a function`); os demais passam.

- [ ] **Step 3: Implementar `seedSourceOf` em `tools/measure/make-scenario.mjs`**

Usa `e5Texts(fromRun)` para os textos (mesmo erro) e uma variante de `pickFromRun` que também devolva o nome do arquivo escolhido (sem mudar o comportamento de `e5Texts`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/measure/make-scenario.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
git commit -m "E15 T1: origem da semeadura no gerador de cenário" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: superpowers, `--from-run` e `seedSource` no lançador

**Files:**
- Modify: `tools/measure/run-batch.mjs`
- Test: `tools/measure/run-batch.test.mjs`

**Interfaces:**
- Consumes: `seedSourceOf(fromRun)` e `makeScenario(dir, variant, { fromRun })` (Task 1).
- Produces:
  - `export function readPlugin(configDir: string): { version: string, commit: string }` (a função atual, agora exportada, sem mudar o comportamento).
  - `export function readSuperpowers(configDir: string): { version: string, commit: string }`: primeira chave de `plugins` em `installed_plugins.json` que comece por `superpowers@`, primeira entrada; `{ version: 'ausente', commit: 'ausente' }` sem entrada, com aviso no stderr.
  - `runBatch(opts)` aceita `opts.fromRun?: string`; agregado ganha `superpowers: { version, commit }` sempre e `seedSource` (valor de `seedSourceOf(opts.fromRun)`) só quando o nome da variante contém `semeado`.
  - CLI: opção `--from-run <pasta>` (chave `fromRun`). `--from-run` (ou `opts.fromRun`) numa variante sem `semeado` lança `UsageError` (CLI sai com 2) antes de criar qualquer pasta.

- [ ] **Step 1: Escrever os testes que falham**

Em `run-batch.test.mjs`, usando `setup()`, `makeFake` e `baseOpts` existentes:
- `aggregate records the superpowers version`: grava na pasta fabricada de configuração uma entrada `superpowers@claude-plugins-official` com `version: '7.0.0'`, `gitCommitSha: 'fab0000000000000000000000000000000000007'`; espera `agg.superpowers` igual a `{ version: '7.0.0', commit: 'fab0000000000000000000000000000000000007' }`.
- `missing superpowers is recorded as ausente`: sem a entrada, `agg.superpowers` é `{ version: 'ausente', commit: 'ausente' }`.
- `seeded variant with --from-run seeds from the given folder and records its source`: pasta tmp montada como na Task 1 (cópia renomeada com uma linha a mais); `plano-semeado-A` com `fromRun`; espera que o arquivo de plano no sandbox contenha a linha extra, `agg.seedSource.kind === 'execucao-aprovada'` e `agg.seedSource.planSha256 === seedSourceOf(folder).planSha256`, e que o texto do agregado não contenha a pasta.
- `seeded variant without --from-run records a synthetic source`: `agg.seedSource.kind === 'sintetico'`.
- `unseeded variant has no seedSource`: `completo` sem `fromRun` → `'seedSource' in agg === false`.
- `--from-run on an unseeded variant is a usage error`: `runBatch({ ...baseOpts(s), variant: 'completo', fromRun: folder })` rejeita com `UsageError`; e a CLI com `--variant completo --from-run <pasta>` sai com status 2.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/measure/run-batch.test.mjs`
Expected: FAIL nos testes novos; os existentes passam.

- [ ] **Step 3: Implementar em `tools/measure/run-batch.mjs`**

`fromRun` repassado a `makeScenario(..., variant, { fromRun: opts.fromRun })`; `seedSourceOf` chamado uma vez por lote; acrescentar `--from-run` a `names` de `parseCli` e ao `USAGE`. Nada mais muda no lançador.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/measure/run-batch.test.mjs tools/measure/make-scenario.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add tools/measure/run-batch.mjs tools/measure/run-batch.test.mjs
git commit -m "E15 T2: superpowers, --from-run e origem da semeadura no lançador" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: detecção por classe no comparador

**Files:**
- Modify: `tools/measure/compare.mjs`
- Test: `tools/measure/compare.test.mjs`
- Create: `tools/measure/fixtures/aggregates/detect-class-before.json`, `tools/measure/fixtures/aggregates/detect-class-after-ok.json`, `tools/measure/fixtures/aggregates/detect-class-after-drop.json`, `tools/measure/fixtures/aggregates/detect-class-after-short.json`

**Interfaces:**
- Produces: `seededClass('plano-semeado') === 'plan'`, `seededClass('codigo-semeado') === 'code'` (além dos atuais `-A`/`-B`). Em `detectionFor`, `valid` de cada lado passa a ser o número de desfechos `detectedBy: 'reviewer'` da classe nas execuções válidas (capturado + perdido + indeterminado); `missing = max(0, attempts - b.valid, attempts - a.valid)` conta tentativas de detecção faltantes. Taxa e queda inalteradas. Agregado de classe (consumido pela Task 5): mesmo formato do agregado do lançador, com `variant: 'plano-semeado' | 'codigo-semeado'`.

As fixtures existentes `detect-*` têm um desfecho de revisor por execução válida, então os vereditos atuais não mudam (inclusive `missing: 1` em `detect-after-39`); elas ficam como estão.

- [ ] **Step 1: Criar as fixtures e escrever os testes que falham**

Fixtures `[fab]` (campo `note` começando com `[fab]`, `variant: 'plano-semeado'`, 10 execuções válidas, cada uma com 4 desfechos `class: 'plan', detectedBy: 'reviewer'`, ids P1-P4 nas 5 primeiras e P5-P8 nas 5 últimas; contadores copiados do formato de `detect-before-nopx.json`):
- `detect-class-before.json`: 36 capturados, 4 perdidos (taxa 0,9).
- `detect-class-after-ok.json`: 33 capturados, 7 perdidos (queda 3).
- `detect-class-after-drop.json`: 28 capturados, 12 perdidos (queda 8).
- `detect-class-after-short.json`: 9 execuções válidas e uma `invalid` (36 tentativas de detecção).

Testes em `compare.test.mjs`:
- `class aggregate counts detection attempts, not runs`: `run('detect-class-before', 'detect-class-after-ok').detection.plan` tem `verdict: 'nao-caiu'`, `drop: 3`, sem `missing`; `bloqueia === false`.
- `class aggregate drop above the margin blocks`: com `detect-class-after-drop`, `verdict: 'caiu'`, `drop: 8`, `bloqueia === true`.
- `class aggregate short of 40 detection attempts is inconclusive and blocks`: com `detect-class-after-short`, `verdict: 'inconclusivo'`, `missing: 4`, `bloqueia === true`.
- `indeterminate outcomes count as attempts but not in the rate`: agregado montado no teste a partir de `detect-class-before` trocando 2 perdidos por `indeterminado`: `missing` ausente/0 e `rateBefore === 36/38`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/measure/compare.test.mjs`
Expected: FAIL nos testes novos (`inconclusivo` com `missing: 30` no caso de classe); os existentes passam.

- [ ] **Step 3: Implementar em `tools/measure/compare.mjs`**

Regex de `seededClass` aceita o sufixo `-[AB]` opcional; `tally` devolve `valid` = número de desfechos de revisor da classe. Nenhum limiar muda.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/measure/compare.test.mjs tools/measure/session-metrics.test.mjs`
Expected: PASS, 0 falhas (inclui a varredura de privacidade sobre as fixtures novas).

- [ ] **Step 5: Commit**

```bash
git add tools/measure/compare.mjs tools/measure/compare.test.mjs tools/measure/fixtures/aggregates/detect-class-before.json tools/measure/fixtures/aggregates/detect-class-after-ok.json tools/measure/fixtures/aggregates/detect-class-after-drop.json tools/measure/fixtures/aggregates/detect-class-after-short.json
git commit -m "E15 T3: comparador conta tentativas de detecção por classe" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: condutor da linha de base (`run-baseline.mjs`)

**Files:**
- Create: `tools/measure/run-baseline.mjs`
- Test: `tools/measure/run-baseline.test.mjs`

**Interfaces:**
- Consumes: `runBatch`, `readPlugin`, `UsageError` (Task 2); `makeScenario`, `seedSourceOf` (Task 1).
- Produces:
  - `export const BASELINE_PLAN: Array<{ variant: string, runs: number }>` com a ordem e as contagens das Global Constraints.
  - `export const MAX_EXTRA = 5`.
  - `export function existingValid(outDir: string, variant: string): number`: soma `valid` de todos os `*/aggregate.json` de `outDir` cujo `variant` é o pedido e que não têm `harness`.
  - `export function dryRunCommands(opts): string[]`: um comando `node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <work>/<v> --out ... --config-dir ... --permission-mode ...` (com `--allow`, `--add-dir`, `--model`, `--max-budget-usd` quando dados) por variante do plano (filtrado por `--only`); nas semeadas acrescenta `--from-run <pasta>` ou o marcador literal `<pasta-da-execucao-aprovada>`.
  - `export async function runBaseline(opts, deps): Promise<{ exitCode: 0 | 1 | 2, results: Array<{ variant, status: 'completa' | 'pulada' | 'incompleta' | 'negada' | 'falhou', valid, missing }> }>`. `opts`: `work, out, configDir, permissionMode, allow, addDir, model, maxBudgetUsd, fromRun, only (string[]), dryRun, tag` (padrão `productivity-tools--v1.6.0`). `deps`: `{ runBatch, makeScenario, seedSourceOf, readPlugin, resolveTag: (tag) => string, log: (msg) => void }`, todos com padrão real.
- Comportamento (ordem): (1) `dryRun` → `log` de cada comando de `dryRunCommands`, exit 0, sem chamar mais nada; (2) `readPlugin(configDir).commit !== resolveTag(tag)` → exit 2 com o commit encontrado; (3) com `fromRun`: `seedSourceOf(fromRun)` e `makeScenario(<work>/_conferencia-semeadura/<v>, v, { fromRun })` para cada semeada pedida, pasta apagada em seguida; erro (pasta sem spec/plano, `<id>: anchor not found`) → exit 2 com a mensagem, sem chamar `runBatch`; (4) para cada variante do plano: falta = `runs - existingValid`; falta 0 → `pulada`; semeada sem `fromRun` → pulada com a mensagem `variantes semeadas exigem --from-run <pasta de uma execução aprovada>` e exit final 1; senão chama `runBatch({ ...opts, variant, runs: falta, work: <work>/<variant>-p<n>, fromRun: só nas semeadas })` com `n` contando as chamadas daquela variante; `aggregate.denied > 0` → para tudo, exit 1, `log` da mensagem; semeada com válidas faltando → nova chamada só com o que falta, até `MAX_EXTRA` tentativas extras somadas, depois `incompleta` com quantas faltam; não semeada não repete; exceção de `runBatch` → `falhou`, exit 1. Exit 0 só com tudo completo.
- CLI: opções do spec (`--work --out --config-dir --permission-mode [--allow]... [--add-dir]... [--model] [--max-budget-usd] [--from-run] [--only v1,v2] [--dry-run] [--tag]`); faltando obrigatória ou variante desconhecida em `--only` → uso e exit 2; `--work` dentro do repositório → exit 2 (mesma regra de `run-batch.mjs`).

- [ ] **Step 1: Escrever os testes que falham**

Em `run-baseline.test.mjs`, `runBatch` simulado que grava `aggregate.json` em `out` e registra as chamadas; `resolveTag` e `readPlugin` simulados (commit `fab0000000000000000000000000000000000016`):
- `plan order and counts`: `BASELINE_PLAN` igual à lista das Global Constraints.
- `runs unseeded variants and skips seeded ones without --from-run`: chamadas na ordem planner..parada-retomada com `runs` 1,1,5,3,3,3; nenhuma semeada chamada; `exitCode === 1`; log contém `variantes semeadas exigem --from-run`.
- `fromRun reaches only seeded variants`: com `fromRun` (pasta montada como na Task 1, com o plano sintético, portanto com as âncoras) e `only: ['completo','plano-semeado-A']`: `completo` chamado sem `fromRun`, `plano-semeado-A` com.
- `skips a complete variant`: `out` já com agregado `[fab]` de `plan-only` com `valid: 5` → `plan-only` não é chamado, status `pulada`.
- `resume counts valid attempts across partial aggregates`: dois agregados de `coordinator` com `valid` 1 e 1 → chamado com `runs: 1`; agregado com `harness` é ignorado.
- `each runBatch call gets its own work folder`: os `work` das chamadas são todos distintos.
- `retries invalid seeded attempts up to the cap`: simulado devolve sempre 0 válidas para `plano-semeado-A` → chamadas somam 5 + 5 tentativas, status `incompleta`, `missing: 5`, exit 1; não semeada com inválida não é repetida.
- `stops at the first denial`: `tracker` devolve `denied: 1` → nenhuma variante seguinte é chamada, exit 1.
- `refuses a plugin outside the start tag`: `readPlugin` com outro commit → exit 2, `runBatch` não chamado, log contém o commit encontrado.
- `dry run prints one command per variant`: com e sem `fromRun`; 10 comandos; semeadas com `--from-run <pasta>` ou `<pasta-da-execucao-aprovada>`; `runBatch` não chamado.
- `pre-check refuses a folder without a plan`: exit 2, `runBatch` não chamado.
- `pre-check refuses a plan without a sentinel anchor`: pasta com spec e um plano `[fab]` sem as âncoras → exit 2, mensagem contém `anchor not found`, `runBatch` não chamado, `_conferencia-semeadura` não existe depois.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/measure/run-baseline.test.mjs`
Expected: FAIL (`Cannot find module .../run-baseline.mjs`).

- [ ] **Step 3: Implementar `tools/measure/run-baseline.mjs`** conforme o bloco Interfaces.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/measure/run-baseline.test.mjs tools/measure/session-metrics.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add tools/measure/run-baseline.mjs tools/measure/run-baseline.test.mjs
git commit -m "E15 T4: condutor da linha de base" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: consolidador e texto das linhas (`baseline.mjs`)

**Files:**
- Create: `tools/measure/baseline.mjs`
- Test: `tools/measure/baseline.test.mjs`
- Create: `tools/measure/fixtures/baseline/` (agregados `[fab]`, um subdiretório por cenário de teste, cada agregado em `<cenario>/<variante>-<n>/aggregate.json`)

**Interfaces:**
- Consumes: `compare` de `compare.mjs` (Task 3); `BASELINE_PLAN` (Task 4); formato do agregado com `superpowers` e `seedSource` (Task 2).
- Produces:
  - `export function loadAggregates(outDir): Aggregate[]` (ignora os que têm `harness`).
  - `export function mergeVariant(aggs: Aggregate[]): Aggregate`: tentativas renumeradas 1..n, `requested`/`valid`/`invalid`/`denied` e `invalidReasons` somados, `roles` somados, `outcomes`/`deteccaoPorCodigo` recalculados das tentativas válidas, `cost` = `{ median, min, max }` dos `counters.cost` válidos.
  - `export function coherenceErrors(merged: Aggregate[], { tagCommit }): string[]`: commit e versão do plugin iguais em todos e commit igual a `tagCommit`; mesma `cli`, mesmo `superpowers` (versão e commit), mesmo `pricesDate`; mesmo `seedSource` (kind, nomes, hashes) nas quatro semeadas presentes.
  - `export function classAggregate(name: 'plano-semeado' | 'codigo-semeado', a: Aggregate, b: Aggregate): Aggregate` (junção de A + B no formato do comparador, com o `seedSource` comum).
  - `export function privacyFindings(text: string): Array<{ kind, match }>` (mesmas regras de `scanPrivacy`: UUID fora de `00000000-0000-4000-8000-`, id `agent-` fora de `agent-afab`, caminhos pessoais Windows/posix/nome de projeto).
  - `export function buildBaseline({ outDir, tagCommit, date }): { baseline, markdown, errors: string[], incomplete: string[], exitCode: 0 | 1 }`.
  - `export function measurementRows(baseline, { date }): string[]`: linhas `| <date> | E15 | linha-de-base | <detalhe> | <soma dos custos devolvidos, US$> | - | concluído |`, uma por variante e uma por classe de detecção.
  - CLI `node tools/measure/baseline.mjs --out <dir> --dest <dir> [--date AAAA-MM-DD] [--tag <nome>]` (tag padrão `productivity-tools--v1.6.0`, resolvida com `git rev-parse <tag>^{commit}`; data padrão = hoje). Grava `baseline.json` e `linha-de-base.md` em `--dest` mesmo com faltas; recusa gravar (exit 1) se `privacyFindings` achar algo em `baseline.json`; exit 1 com erros de coerência ou faltas; exit 2 em uso errado.
- `linha-de-base.md` (português) tem as seções do spec, peça 4: tabela por variante do release e do coordinator (válidas/pedidas, chamadas por família e bytes de prompt por papel, custo mediano e faixa, versão e commit do plugin, versão do superpowers, modelos, data dos preços, CLI, modo de permissão); planner e tracker com a nota literal `custo não é comparado nesta skill (DEC-016)`; detecção por classe (por defeito: capturas, perdas, indeterminados; tentativas válidas da classe com alvo 40; inválidas, taxa de inválidas e motivos; origem da semeadura com tipo, nomes e hashes); valores de referência para as metas (mediana de cada contador por variante); linhas para `roadmap:measurements`. Variante ausente ou abaixo do plano sai marcada `incompleta`; classe com `seedSource.kind === 'sintetico'` ou sem `seedSource` sai `incompleta (semeadura sintética)`.

- [ ] **Step 1: Criar as fixtures e escrever os testes que falham**

Fixtures `[fab]` em `fixtures/baseline/`: `completa/` (todas as variantes do plano com as contagens pedidas, `seedSource` `execucao-aprovada` igual nas semeadas, commit `fab0000000000000000000000000000000000016`, coordinator em dois parciais 2 + 1), `commit-divergente/`, `semeadura-divergente/`, `semeadura-sintetica/`, `incompleta/` (sem `parada-retomada`).

Testes em `baseline.test.mjs`:
- `merges partial aggregates of one variant`: coordinator 2 + 1 → `valid: 3`, tentativas `n` 1,2,3, custo recalculado.
- `class aggregate is read by the comparator without missing`: `compare(classe, classe).detection.plan.missing` ausente ou 0, para `plano-semeado` e `codigo-semeado`.
- `diverging plugin commit is an error`: `commit-divergente` → `errors` cita o commit, `exitCode: 1`.
- `diverging seed source is an error`: `semeadura-divergente` → `errors` cita `seedSource`, `exitCode: 1`.
- `synthetic seeding marks the class incomplete`: `semeadura-sintetica` → markdown contém `incompleta (semeadura sintética)`, `exitCode: 1`.
- `refuses to write a baseline with private data`: agregado montado no teste com um caminho pessoal → CLI exit 1 e `baseline.json` não gravado.
- `planner and tracker carry the cost note`: markdown contém `custo não é comparado nesta skill (DEC-016)`.
- `missing variant is marked incomplete but still written`: `incompleta` → markdown marca `parada-retomada` `incompleta`, arquivos gravados, `exitCode: 1`.
- `measurement rows`: `completa` → 12 linhas (10 variantes + 2 classes), cada uma com `| E15 | linha-de-base |` e `| - | concluído |`.
- `complete baseline exits 0`: `completa` com `tagCommit` certo → `errors: []`, `incomplete: []`, `exitCode: 0`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/measure/baseline.test.mjs`
Expected: FAIL (`Cannot find module .../baseline.mjs`).

- [ ] **Step 3: Implementar `tools/measure/baseline.mjs`** conforme o bloco Interfaces.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/measure/baseline.test.mjs tools/measure/compare.test.mjs tools/measure/session-metrics.test.mjs`
Expected: PASS, 0 falhas (a varredura de privacidade cobre `fixtures/baseline/`).

- [ ] **Step 5: Commit**

```bash
git add tools/measure/baseline.mjs tools/measure/baseline.test.mjs tools/measure/fixtures/baseline
git commit -m "E15 T5: consolidador e texto da linha de base" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: roteiro do dono e gates

**Files:**
- Create: `docs/reports/2026-11-11-e15-linha-de-base/roteiro.md`

**Interfaces:**
- Consumes: CLIs de `run-baseline.mjs` (Task 4) e `baseline.mjs` (Task 5), com as opções exatas.

- [ ] **Step 1: Escrever o roteiro**, em português, com os seis passos da peça 5 do spec, cada comando completo e com marcadores `<...>` para pastas do dono (nenhum caminho pessoal): pré-condições (plugin 1.6.0 no commit da tag, regras de permissão da execução sem interface e `Workflow(productivity-tools:roadmap-release)` (DEC-043), pasta de trabalho fora do repositório, modo de permissão registrado); `--dry-run` e a execução sem `--from-run` (código 1 esperado por causa das semeadas) e como retomar; troca da semeadura pela de uma execução aprovada (`git -C <sandbox da tentativa> worktree add <pasta> release/sandbox`, conferência dos dois arquivos de E5, `--dry-run` e depois `--from-run <pasta>`, o que fazer com `anchor not found`; a escolha é do dono); `baseline.mjs` e o que conferir para cada critério 1 a 4, incluindo a origem da semeadura; copiar `baseline.json` e `linha-de-base.md` para `docs/reports/2026-11-11-e15-linha-de-base/` e commitar, nunca `tools/measure/out/`; pedir ao tracker o registro em `measurements.md` e a proposta de revisão da estratégia com a tabela de metas (contador, variante, cálculo = linha de base menos o que a mudança remove por construção, DEC-034), gravada só com aprovação do dono.

- [ ] **Step 2: Conferir que os comandos do roteiro batem com as CLIs**

Run: `node tools/measure/run-baseline.mjs` e `node tools/measure/baseline.mjs` (sem argumentos)
Expected: as duas saem com código 2 e imprimem o uso; todas as opções citadas no roteiro aparecem no uso.

- [ ] **Step 3: Rodar os gates canônicos**

Run, a partir de `D:/projects/claude-play-wt/E15`:
- G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, 0 falhas, total acima de 800 (linha de base do alvo: 800, nenhuma falha pré-existente).
- G2: `claude plugin validate .` → exit 0.
- G3: `claude plugin validate plugins/productivity-tools` → exit 0.
- G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0.
- G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add docs/reports/2026-11-11-e15-linha-de-base/roteiro.md
git commit -m "E15 T6: roteiro do dono para a linha de base" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Roteamento por tarefa

| Tarefa | tier | reviewTier | external | needsLock | Navegador |
|---|---|---|---|---|---|
| T1 | sonnet | sonnet | false | (nenhum) | não |
| T2 | sonnet | sonnet | false | (nenhum) | não |
| T3 | sonnet | sonnet | false | (nenhum) | não |
| T4 | sonnet | sonnet | false | (nenhum) | não |
| T5 | sonnet | sonnet | false | (nenhum) | não |
| T6 | sonnet | sonnet | false | (nenhum) | não |

Nenhuma tarefa tem efeito externo (nenhum push, nenhuma execução paga, nenhuma escrita em dado compartilhado), então nenhuma declara `externalDedupe`. Raio de impacto 1 em T2-T5 (contrato interno de `tools/measure/`, lido por E17, E11, E16, E13, E26, E27), nunca 2. Evidência aceitável quando um passo não pode ser exercitado aqui: as execuções pagas e a escolha da execução aprovada não rodam neste ambiente; a evidência é o `--dry-run` do condutor, os testes com `runBatch` simulado e agregados `[fab]`, e o roteiro.

## Acceptance criteria evidence

| ac | kind | command | testRef | blq | external |
|---|---|---|---|---|---|
| AC1 | human | o dono confere as linhas da linha de base em measurements.md | | | false |
| AC2 | human | o dono confere as linhas da linha de base em measurements.md | | | false |
| AC3 | human | o dono confere as linhas de detecção em measurements.md | | | false |
| AC4 | human | o dono aprova a revisão da estratégia que traz a tabela de metas | | | false |

Os quatro critérios são `verify: human` (tag mantida): dependem das execuções pagas operadas pelo dono e da sua conferência e aprovação. Apoio não substitutivo, já coberto por G1: `baseline.test.mjs` (linhas por variante, nota de custo, detecção por classe, linhas de `measurements.md`) e `run-baseline.test.mjs`.

## Decisões autônomas deste plano (Origem executor, status pendente)

1. A retomada do condutor soma as execuções válidas de todos os agregados da variante em `--out` (não só do mais recente), coerente com a junção de parciais do consolidador; agregados de arnês ficam fora. Alcance: local.
2. Cada chamada do condutor a `runBatch` usa a subpasta `<work>/<variante>-p<n>`, para não reaproveitar sandboxes. Alcance: local.
3. As fixtures `detect-*` existentes ficam como estão (um desfecho de revisor por execução, vereditos iguais na nova contagem); os casos de classe ganham fixtures `detect-class-*` novas. Alcance: local.
4. `seedSourceOf`, `readPlugin` e `readSuperpowers` são exportados para o condutor e os testes. Alcance: local.
