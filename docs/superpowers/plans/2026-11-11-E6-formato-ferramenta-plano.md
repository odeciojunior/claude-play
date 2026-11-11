# E6 -- Formato e ferramenta de plano, com roteamento, mapa e briefs: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** O esquema `plan/1` no bloco `json data`, a ferramenta `plan-tool` (`check`, `emit`, `map`, `brief`), a definição de roteamento única em `lib/routing.mjs` e o resumo de integridade em `lib/plan-digest.mjs`, ambos com cópia gerada para os workflows conferida por teste.

**Architecture:** `lib/plan-digest.mjs` (`canon`, `fnv1a`, `planDigest`) e `lib/routing.mjs` (`route`) são fontes puras (DEC-058), importadas por `scripts/plan-tool.mjs` e embutidas por `scripts/embed.mjs` em `scripts/fixtures/plan-tool/workflow-copy.js`, que o teste roda em `node:vm` sem `process`, `require` nem `crypto`. `plan-tool.mjs` lê o plano com `readDataBlock` (E5), valida o spec com `checkSpec` e reusa o validador de registros extraído de `spec-tool.mjs` (`checkRecords`); exporta funções sobre texto e objetos (`checkPlan`, `emitPlan`, `buildMap`, `buildBriefs`) e uma CLI fina.

**Tech Stack:** Node 18+ (medido: v22.17.1), ESM, `node:test`, `node:assert/strict`, `node:vm`, sem dependências nem npm.

**Spec:** `docs/superpowers/specs/2026-11-11-E6-formato-ferramenta-plano-design.md` (o executor lê o spec junto: tabelas do esquema, códigos de erro, regras 0 a 8 do roteamento e as quatro seções do brief estão lá, nas peças 1, 2 e 3).

## Global Constraints

- `lib/routing.mjs` e `lib/plan-digest.mjs` sem `import`, `require`, `process`, `Buffer` nem `crypto`, nem mesmo dentro de texto entre aspas (`checkPureSource` de `plugins/productivity-tools/scripts/embed.mjs` tira só comentários); `checkPureSource(texto, nome)` devolve `null` para os dois. Os nomes de topo dos dois arquivos não se repetem entre si (a cópia gerada junta os dois num só escopo).
- `schema` exatamente `"plan/1"`. Campo obrigatório ausente é sempre erro, nunca padrão (anti-objetivo); só `title` e `externalPatterns` são opcionais no topo, e toda chave da tabela "Tarefa" do spec é obrigatória.
- Códigos de erro (exatos): `dependency-cycle`, `dep-unknown`, `write-conflict`, `acceptance-uncovered`, `evidence-kind-differs`, `evidence-command-differs`, `cover-unknown`, `edge-case-uncovered`, `external-effect-unperformed`, `interface-unproduced`, `interface-not-upstream`, `external-undeclared`, `external-dedupe-missing`, `roadmap-edit`, `task-number`, `task-heading-missing`, `task-heading-orphan`, `task-title-differs`, `spec-invalid`, `spec-id-mismatch`, mais `data-block-missing`, `data-block-multiple`, `data-block-json`, `schema-version`, `field-missing`, `field-type`, `id-invalid`, `id-duplicate` e os de registro de E5. Avisos: `task-too-wide`, `field-unknown`.
- Saída texto do `check`: `ERROR <código> <ref>: <mensagem>` / `WARN <código> <ref>: <mensagem>`, última linha `Result: <e> errors, <w> warnings`. `--json`: `{ tool: "plan-tool", schema: "plan/1", path, errors, warnings, summary: { errors, warnings, exitCode } }`. Exit 0 sem erro, 1 com erro, 2 uso inválido ou arquivo ilegível. `map`, `emit` e `brief` rodam `check` antes e saem 1 com os erros em stderr.
- Lista padrão de efeito externo (regex, flag `i`), literal do spec: `\bgit\s+push\b`, `\b(npm|pnpm|yarn)\s+publish\b`, `\bdeploy\b`, `\bcurl\b.*\s-X\s*(POST|PUT|PATCH|DELETE)\b`, `\bkubectl\s+(apply|delete|create|patch|rollout)\b`, `\bterraform\s+(apply|destroy)\b`, `\bdocker\s+push\b`, `\bgh\s+(pr\s+(create|merge)|release\s+create|issue\s+create)\b`, `\b(sendmail|mail)\b`, `\bclaude\s+plugin\s+(update|install|marketplace\s+(add|update))\b`.
- Resumo: `fnv1a` de 32 bits igual ao de `planFingerprint` (`roadmap-release.js:642`: `h = 0x811c9dc5`; por unidade UTF-16 `h ^= code; h = Math.imul(h, 0x01000193) >>> 0`; `h.toString(16).padStart(8, '0')`). Texto normalizado antes de `textDigest`: BOM removido, `\r\n?` -> `\n`, NFC. O mesmo plano em CRLF e em LF dá o mesmo resumo (anti-objetivo).
- Largura máxima padrão do mapa: 4; `--max-width` inteiro >= 1, senão exit 2.
- Testes só em `plugins/productivity-tools/scripts/plan-tool.test.mjs` (novo). `spec-tool.test.mjs` não muda e continua passando. Testes que gravam usam `fs.mkdtempSync(path.join(os.tmpdir(), 'plan-tool-'))` removidas em `after`; `brief` nos testes sempre com `--out <tmp>` (nada é gravado em `fixtures/`).
- Não editar `roadmap-release.js` nem nenhum arquivo de workflow, nenhuma SKILL.md, `plan-coordinator/references/*`, `docs/plans/roadmap-evolucao-skills/`, `plugins/_template/`, `plugin.json` nem `README.md` (nenhuma versão sobe), nem o comando de nenhum gate.
- Ambiente medido: Windows 11, Git Bash e PowerShell 7, Node v22.17.1, `core.autocrlf=true` (checkout CRLF: `fixtures/plan-tool/plan.md` e o spec de exemplo chegam em CRLF). Rode os comandos a partir de `D:/projects/claude-play-wt/E6`, branch `feat/E6`.
- Nenhum servidor nem porta (a faixa 5290-5299 não é usada). Nenhuma tarefa precisa de navegador. Nenhum push, nenhum efeito externo.
- Commits só com os arquivos da tarefa (`git add <arquivos>`, nunca `git add -A` nem `git stash`), mensagem começando por `E6 T<n>:` e terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Temporários de verificação manual só em `D:/projects/claude-play-wt/_tmp/E6/` (apagar no fim).

## Review Focus

- Plano e spec em checkout CRLF (o caso real neste repositório): `check` passa com zero erros e `emit` dá o mesmo `digest` que a versão LF. Testes na Task 3 (`CRLF copy of the example plan passes check`) e na Task 5 (`AC2: CRLF copy gives the same digest`).
- Ferramenta rodada de outro diretório de trabalho: o `spec` relativo resolve contra a pasta do plano, não contra o cwd; `--spec` substitui. Teste na Task 3 (`spec path resolves from the plan folder, not the cwd`).
- Grafo malformado não derruba a ferramenta: dependência de si mesma (`deps: [2]` na T2) dá `dependency-cycle` `T2 -> T2`; dependência desconhecida dá `dep-unknown` e não quebra a detecção de ciclo nem as ondas. Teste na Task 3.
- Nota ausente não vira 0: `score` sem `blast` dá `field-missing` e o `route` nunca roda com nota ausente (anti-objetivo). Teste na Task 3 (`missing score.blast -> field-missing`).
- `--max-width 0`, `--max-width abc` e `--max-width` sem valor saem 2; `brief` não muda o plano nem o spec e grava LF mesmo com o plano em CRLF. Testes na Task 6.

---

### Task 1: resumo de integridade em fonte pura (`lib/plan-digest.mjs`)

**Files:**
- Create: `plugins/productivity-tools/lib/plan-digest.mjs`
- Test: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `checkPureSource(text, name) -> string|null` de `./embed.mjs`.
- Produces:
  - `canon(value) -> value` (cópia com chaves de objeto ordenadas por `<` de string, recursivo em objetos e listas; primitivos iguais).
  - `fnv1a(str: string) -> string` (8 dígitos hexadecimais minúsculos).
  - `planDigest({ plan, source }) -> string` = `fnv1a(JSON.stringify(canon({ plan, source })))`.

- [ ] **Step 1: Escrever os testes** em `plan-tool.test.mjs` (novo; importa de `../lib/plan-digest.mjs`):
  - `fnv1a matches the release fingerprint algorithm`: `fnv1a('')` === `'811c9dc5'`; `fnv1a('a')` === `'e40c292c'`.
  - `canon sorts keys recursively`: `JSON.stringify(canon({ b: 1, a: { d: [ { y: 1, x: 2 } ], c: 0 } }))` === `'{"a":{"c":0,"d":[{"x":2,"y":1}]},"b":1}'`.
  - `planDigest ignores key order`: `planDigest({ plan: { a: 1, b: 2 }, source: { path: 'p', textDigest: '0' } })` === `planDigest({ source: { textDigest: '0', path: 'p' }, plan: { b: 2, a: 1 } })`, e muda com `plan.a = 3`.
  - `plan-digest is pure`: `checkPureSource(readFileSync(lib/plan-digest.mjs), 'plan-digest.mjs')` === `null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL (`lib/plan-digest.mjs` não existe).

- [ ] **Step 3: Implementar `lib/plan-digest.mjs`** com as três funções exportadas (cabeçalho em comentário: fonte pura, DEC-058, algoritmo de `planFingerprint`). Nomes auxiliares de topo prefixados por `pd` para não colidir com `routing.mjs`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/lib/plan-digest.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T1: resumo de integridade em fonte pura (plan-digest)" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: definição de roteamento e tabela de exemplo (critério 3, fonte)

**Files:**
- Create: `plugins/productivity-tools/lib/routing.mjs`
- Create: `plugins/productivity-tools/scripts/fixtures/plan-tool/routing-table.json`
- Modify: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `checkPureSource` de `./embed.mjs`.
- Produces: `route(task, ctx) -> { tier: 'haiku'|'sonnet'|'opus', effort: 'low'|'medium'|'high', reviewTier: 'sonnet'|'opus', gate: boolean, score: { scope, ambiguity, reasoning, blast, verifiability, total } }`, com `task = { score: { ambiguity, reasoning, blast, verifiability }, files: { create, modify, test }, external }` e `ctx = { hasDependents: boolean }`. `score.blast` devolvido é o efetivo (regra 0); `task` não é alterado.

- [ ] **Step 1: Escrever `routing-table.json`** como `{ "rows": [ { "name", "source", "input": { "fileCount", "ambiguity", "reasoning", "blast", "verifiability", "external", "hasDependents" }, "expected": { "tier", "effort", "reviewTier", "gate" } } ] }`, com estas linhas, escritas a partir das regras atuais (fc = fileCount; notas na ordem amb/rea/blast/ver; ext; deps):

| name | source | fc | amb rea bla ver | ext | deps | tier | effort | reviewTier | gate |
|---|---|---|---|---|---|---|---|---|---|
| total 0 | routing.md §2 | 1 | 0 0 0 0 | false | false | haiku | low | sonnet | false |
| total 2 | routing.md §2 | 1 | 1 0 1 0 | false | false | haiku | low | sonnet | false |
| total 3 | routing.md §2; roadmap-release.js:395 | 1 | 1 1 1 0 | false | false | sonnet | medium | sonnet | false |
| total 5 | routing.md §2 | 3 | 1 1 1 1 | false | false | sonnet | medium | sonnet | false |
| total 6 sem opus | routing.md §2 | 3 | 2 1 1 1 | false | false | sonnet | high | sonnet | false |
| total 6 com opus | routing.md §2, §3.1; roadmap-release.js:387 | 1 | 2 1 2 1 | false | false | opus | medium | opus | true |
| total 7 | routing.md §4 | 3 | 2 2 1 1 | false | false | sonnet | high | sonnet | true |
| total 10 | routing.md §2, §3.3 | 8 | 2 2 2 2 | false | false | opus | medium | opus | true |
| teto mecânico | routing.md §3.2 | 8 | 0 0 1 0 | false | false | haiku | low | sonnet | false |
| teto mecânico com blast 2 | routing.md §3.2, §3.1 | 8 | 0 0 2 0 | false | false | sonnet | medium | opus | true |
| verificação pesada em sonnet | routing.md §3.3; roadmap-release.js:387 | 1 | 0 1 0 2 | false | false | opus | medium | opus | false |
| verificação pesada em 6 a 10 | routing.md §3.3, §4 | 1 | 1 2 1 2 | false | false | sonnet | high | sonnet | true |
| blast 2 em total baixo | routing.md §3.1; roadmap-release.js:387 | 1 | 0 0 2 0 | false | false | sonnet | medium | opus | true |
| externo em total baixo | routing.md §3.1; roadmap-release.js:387 | 1 | 0 0 0 0 | true | false | sonnet | medium | opus | true |
| externo eleva total a opus | routing.md §3.1, §2 | 1 | 2 1 1 1 | true | false | opus | medium | opus | true |
| externo no teto mecânico | routing.md §3.1, §3.2 | 8 | 0 0 1 0 | true | false | sonnet | medium | opus | true |
| haiku com dependentes e ver 1 | routing.md §4 | 1 | 0 0 0 1 | false | true | haiku | low | sonnet | true |
| haiku sem dependentes e ver 1 | routing.md §4 | 1 | 0 0 0 1 | false | false | haiku | low | sonnet | false |

"Verificação pesada em haiku" não tem linha: com verifiability 2 e reasoning >= 1 o total é >= 3, então a base nunca é haiku (decisão 2 abaixo).

- [ ] **Step 2: Escrever os testes** em `plan-tool.test.mjs`:
  - `AC3: routing table row <name> (source)`: um teste por linha; monta `task = { score: {...}, files: { create: ['f1'..'f<fc>'], modify: [], test: [] }, external }` e confere `tier`, `effort`, `reviewTier`, `gate` de `route(task, { hasDependents })`.
  - `route does not mutate the task` (tarefa externa com blast 1: `task.score.blast` continua 1; `route(...).score.blast` === 2).
  - `route counts distinct files` (o mesmo caminho em `create` e `test` conta 1).
  - `routing is pure`: `checkPureSource` de `lib/routing.mjs` === `null`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL nos testes novos (`lib/routing.mjs` não existe); os da Task 1 passam.

- [ ] **Step 4: Implementar `lib/routing.mjs`** com as regras 0 a 8 da peça 2 do spec, nesta ordem: blast efetivo; escopo (0/1 arquivo -> 0, 2 a 5 -> 1, >5 -> 2) e total; tabela; teto mecânico; verificação pesada (total <= 5: um nível acima, haiku -> sonnet -> opus; total 6 a 10: se a tabela deu sonnet, fica sonnet high e ganha portão; se deu opus, fica opus, decisão 1); piso de risco; effort; `reviewTier`; `gate`. Nomes auxiliares de topo prefixados por `rt`.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS. Se uma linha da tabela falhar, corrija o código, nunca a linha (os esperados vêm das regras atuais, não da saída de `route`).

- [ ] **Step 6: Commit**

```bash
git add plugins/productivity-tools/lib/routing.mjs plugins/productivity-tools/scripts/fixtures/plan-tool/routing-table.json plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T2: definição de roteamento única e tabela de exemplo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: plano de exemplo, `checkRecords` e `check` (esquema, spec, prosa, grafo, conflito de escrita)

**Files:**
- Modify: `plugins/productivity-tools/scripts/spec-tool.mjs`
- Create: `plugins/productivity-tools/scripts/plan-tool.mjs`
- Create: `plugins/productivity-tools/scripts/fixtures/plan-tool/plan.md`
- Modify: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `readDataBlock`, `replaceDataBlock` (`../lib/data-block.mjs`); `norm`, `parseVerifyTag` (`../lib/roadmap-format.mjs`); `checkSpec` (`./spec-tool.mjs`); spec de exemplo `fixtures/spec-tool/spec.md` (id `E1`: `AC1` test `node --test tests/e1.test.mjs`, `AC2` blocked BLQ-1, `AC3` sem marca, `C1`, `X1`).
- Produces:
  - Em `spec-tool.mjs`: `export function checkRecords(name, items, { roadmap = null } = {}) -> { errors, warnings }` para `name` em `rulings|needsPerson|externalEffects|edgeCases`, com os mesmos códigos, refs e mensagens de hoje; `checkSpec` passa a chamá-la e concatena na mesma ordem (resultado de `checkSpec` idêntico).
  - Em `plan-tool.mjs`: `export const SCHEMA = 'plan/1'`; `export function checkPlan(text, { planPath, specText = null, specPath = null }) -> { data, spec, errors, warnings, levels: Map<n, nivel> }` (`spec` é o `data` do spec ou `null`; com `specText` dado, não lê disco); `export function main(argv, io) -> number` com `check <plan.md> [--spec <spec.md>] [--json]` (o resto chega nas Tasks 4 a 6); `process.exit(main(...))` só como módulo principal (mesmo `isMainModule` de `spec-tool.mjs`).
  - Fixture `plan.md` (estrutura fixa, usada pelas Tasks 4 a 6): `id: "E1"`, `spec: "../spec-tool/spec.md"`, `roadmap: "docs/plans/roadmap-exemplo/"`, duas `constraints`, `rulings` com um `R1` completo, `needsPerson: []`, prosa com `### Tarefa <n>: <título>` por tarefa e o bloco `json data` no fim. Tarefas:

| n | título | deps | arquivos (create / test) | produces / consumes | covers | locks | external |
|---|---|---|---|---|---|---|---|
| 1 | Armazenamento local de itens | [] | `src/store.mjs` / `tests/store.test.mjs` | produz `saveItem(item) -> id` e `loadItem(id) -> item` | AC1 | [] | false |
| 2 | Rejeitar item vazio | [1] | `src/validate.mjs` / `tests/validate.test.mjs` | consome T1 `saveItem(item) -> id` | C1 | [] | false |
| 3 | Mostrar o item salvo | [1] | `src/view.mjs` / `tests/view.test.mjs` | consome T1 `loadItem(id) -> item` | AC1 | ["fixture-db"] | false |
| 4 | Recarregar e mostrar o mesmo item | [1] | `src/reload.mjs` / `tests/reload.test.mjs` | consome T1 `loadItem(id) -> item` | AC3 | ["fixture-db"] | false |
| 5 | Gravar o item no backend real | [1] | `scripts/sync-backend.mjs` / - | consome T1 `loadItem(id) -> item` | X1 | [] | true, `externalDedupe` "consulta o id no backend antes de gravar; se existe, não grava" |
| 6 | Documentar o armazenamento | [2, 3, 4, 5] | modify `README.md` | - | - | [] | false |

  Notas (`ambiguity/reasoning/blast/verifiability`): T1 `1/1/1/0`, T2 `0/1/0/0`, T3 `0/1/0/0`, T4 `0/1/0/0`, T5 `1/1/1/1`, T6 `0/0/0/1`. Todas `testFirst: true` exceto T6 (`{ exempt: "só documentação" }`), `noCommit: false`, `writes: []` (T1: `["data/"]`), `checks` com `{ cmd: "node --test tests/<arquivo>", expect: "exit 0" }` (T5: `node scripts/sync-backend.mjs --dry-run`; T6: `[]`). `evidence`: `AC1` test `node --test tests/e1.test.mjs` external false; `AC2` blocked `command: null`, `blq: "BLQ-1"`; `AC3` test `node --test tests/reload.test.mjs` external false. Nível 1 = T2..T5 (quatro tarefas, T3 e T4 com trava em comum); nenhuma tarefa com mais de quatro arquivos.

- [ ] **Step 1: Escrever os testes** em `plan-tool.test.mjs` (helper `mutate(fn)` lê `plan.md`, aplica `fn(data)` e regrava com `replaceDataBlock`; helper `check(text)` chama `checkPlan` com `planPath` do fixture):
  - `example plan passes check with zero errors and zero warnings`.
  - `CRLF copy of the example plan passes check` (texto com `\n` -> `\r\n`, gravado em tmp com o spec copiado ao lado como `../spec-tool/spec.md` relativo, ou com `specText`).
  - `spec path resolves from the plan folder, not the cwd` (CLI `check` com `cwd: os.tmpdir()` e caminho absoluto do plano sai 0; `--spec <spec mutado com erro>` sai 1 com `spec-invalid`).
  - `checkRecords is exported and matches checkSpec` (para o spec de exemplo e para ele com `R1.basis` removido: os erros de `rulings` de `checkSpec` são os de `checkRecords('rulings', ...)`).
  - `AC1: dependency cycle -> dependency-cycle naming the tasks` (T1 `deps: [4]`: mensagem contém `T1 -> T4 -> T1`); `self dependency -> dependency-cycle T2 -> T2`; `unknown dep -> dep-unknown` (T2 `deps: [9]`, sem exceção).
  - `AC1: two tasks of the same wave write the same file -> write-conflict` (T4 `files.create` recebe `src/view.mjs`: ref `T3/T4`, `src/view.mjs` na mensagem); também por `writes` e com `./src/view.mjs`; T6 escrevendo `src/view.mjs` não conflita (outro nível).
  - Esquema e prosa, um caso cada: `schema-version`, `field-missing` (sem `evidence`; `missing score.blast -> field-missing`), `field-type` (`external: "no"`; nota `3`), `task-number` (T2 com `n: 3`), `spec-id-mismatch` (`id: "E2"`), `field-unknown` (aviso), `task-heading-missing` (seção 6 removida da prosa), `task-heading-orphan` (seção `### Task 7: Extra`), `task-title-differs`, `ruling-incomplete` (registro de E5 via `checkRecords`), `data-block-missing`.
  - CLI `check`: fixture sai 0 com `Result: 0 errors, 0 warnings`; plano com ciclo sai 1 com linha `ERROR dependency-cycle`; `--json` com o mesmo exit e `summary.errors` igual ao número de linhas `ERROR`; sem argumentos, comando desconhecido ou arquivo inexistente sai 2.
- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL nos testes novos (`plan-tool.mjs` não existe); os das Tasks 1 e 2 passam.

- [ ] **Step 3: Extrair `checkRecords`** de `checkSpec` (laço `for (const [name, spec] of Object.entries(RECORDS))` e o aviso `edge-cases-limit`) sem mudar códigos, mensagens nem ordem.

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS, sem nenhuma mudança no arquivo de teste.

- [ ] **Step 4: Escrever `fixtures/plan-tool/plan.md`** com a estrutura da tabela acima e implementar em `plan-tool.mjs` o `checkPlan` desta tarefa: leitor; esquema de topo, de tarefa e de evidência (tabelas da peça 1); `rulings`/`needsPerson` por `checkRecords`; spec por `checkSpec` sem roadmap (`spec-invalid` com o primeiro erro; ilegível também); `spec-id-mismatch`; prosa (cabeçalho `^### (Tarefa|Task) (\d+):\s*(.+)$`, seção até o próximo título de nível <= 3; títulos comparados após colapso de espaço); grafo (`dep-unknown`, ciclo por DFS em ordem de `n`, nomeando o ciclo na ordem achada a partir da menor tarefa); níveis topológicos (tarefa em ciclo ou com dep desconhecida fica fora dos níveis); `write-conflict` por nível com caminhos normalizados (`\` -> `/`, sem `./` inicial). Só roda as checagens de grafo e de conflito quando o esquema das tarefas passou.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS.

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/productivity-tools/scripts/spec-tool.mjs plugins/productivity-tools/scripts/plan-tool.mjs plugins/productivity-tools/scripts/fixtures/plan-tool/plan.md plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T3: esquema plan/1, plano de exemplo e check de esquema, grafo e conflito" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: `check` de cobertura, interfaces, efeito externo e pasta do roadmap (critério 1)

**Files:**
- Modify: `plugins/productivity-tools/scripts/plan-tool.mjs`
- Modify: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `checkPlan` e o fixture (Task 3); `parseVerifyTag`, `EXECUTABLE_KINDS` de `../lib/roadmap-format.mjs`.
- Produces: `export const EXTERNAL_PATTERNS` (as dez regex da lista padrão, como strings); `checkPlan` completo com os códigos abaixo.

- [ ] **Step 1: Escrever os testes** (um plano com defeito por teste, por `mutate`, cada um conferindo código e ref):
  - `AC1: acceptance without evidence row -> acceptance-uncovered naming AC1` (remove a linha de `AC1`) e `AC1: acceptance covered by no task -> acceptance-uncovered naming AC3` (remove `AC3` de `covers` da T4; a linha continua). `AC2` (blocked) sem tarefa que o cubra não dá erro.
  - `AC1: consumed interface never produced -> interface-unproduced` (T3 consome `deleteItem(id)` de T1: ref `T3`, assinatura na mensagem); `interface-not-upstream` (T4 consome de T2 uma assinatura que T2 passa a produzir, sem dependência).
  - `AC1: external command declared internal -> external-undeclared` (T2 `checks` com `git push origin main`: ref `T2`, padrão na mensagem); o mesmo comando na T5 (externa) não dá erro; `externalPatterns: ["\\bsync-backend\\b"]` faz `node scripts/sync-backend.mjs` numa tarefa interna dar erro; linha de evidência interna com `npm publish` dá `external-undeclared` com ref `AC1`.
  - `external task without dedupe -> external-dedupe-missing` (T5 `externalDedupe: null`; também `""`).
  - Um caso cada: `evidence-kind-differs` (`AC1` com `kind: "smoke"`), `evidence-command-differs` (`AC1` com outro comando; espaço duplo no mesmo comando não dá erro), `cover-unknown` (`covers: ["AC9"]` e linha de evidência `AC9`), `edge-case-uncovered` (sem `C1`), `external-effect-unperformed` (T5 com `external: false` e `X1` em `covers`, ou `X1` removido), `roadmap-edit` (T6 modifica `docs/plans/roadmap-exemplo/status.md`), `task-too-wide` (aviso com cinco arquivos).
  - `AC1: each planted defect gives its named error`: laço sobre os cinco defeitos do critério (ciclo, conflito de escrita, critério sem cobertura, interface sem produtor, efeito externo como interno) conferindo que cada plano dá exatamente o código esperado entre os seus erros.
- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL nos testes novos; os das Tasks 1 a 3 passam.

- [ ] **Step 3: Implementar** em `checkPlan` as checagens de cobertura, interfaces (ancestral pelo fecho transitivo de `deps`; assinaturas comparadas após colapso de espaço), efeito externo (lista padrão + `externalPatterns`, flag `i`, sobre `checks[].cmd` de tarefas internas e `command` de evidências internas), dedupe, `roadmap-edit` (caminho normalizado que começa com `roadmap` normalizado com `/` final) e o aviso `task-too-wide` (mais de quatro arquivos distintos em `files`), na regra do spec, peça 1. `externalPatterns` inválida é `field-type`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS, com o plano de exemplo ainda em zero erros e zero avisos.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/plan-tool.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T4: check de cobertura, interfaces e efeito externo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: `emit` com resumo e cópia gerada para os workflows (critérios 2 e 3, cópia)

**Files:**
- Modify: `plugins/productivity-tools/scripts/plan-tool.mjs`
- Create: `plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`
- Modify: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `route` (Task 2); `canon`, `fnv1a`, `planDigest` (Task 1); `checkPlan` (Tasks 3 e 4); `embedFile` de `./embed.mjs`.
- Produces:
  - `export function emitPlan(text, { planPath, cwd = process.cwd(), specText, specPath, maxWidth = 4 }) -> { errors, warnings, out: null | { tool: 'plan-tool', schema: 'plan/1', path, source: { path, textDigest }, plan, digest } }`; `plan` é o bloco com, por tarefa, `route` (de `route(task, { hasDependents })`), `wave` (índice 1-based da onda em `buildMap` com `maxWidth`) e `fileCount` (arquivos distintos). `source.path` = `path.relative(cwd, planPath)` com `/`.
  - Enquanto `buildMap` (Task 6) não existe, `wave` é o nível topológico + 1; a Task 6 troca pela onda do mapa e ajusta o teste que fixa os valores.
  - CLI `emit <plan.md> [--spec <spec.md>]`: imprime `out` em JSON (2 espaços); com erro, sai 1 com as linhas `ERROR` em stderr.
  - `workflow-copy.js`, já gerado e commitado:

```js
// Cópia gerada para os workflows (E6): E8 e E12 repetem estes marcadores nos arquivos de workflow.
// Regerar: node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js
// <embed src="../../../lib/routing.mjs" exports="strip">
// </embed>
// <embed src="../../../lib/plan-digest.mjs" exports="strip">
// </embed>
;({ route, planDigest })
```

- [ ] **Step 1: Escrever os testes** (helper `loadCopy()`: `vm.runInNewContext(readFileSync(workflow-copy.js), Object.create(null))`):
  - `AC2: digest changes when a block value changes` (T1 `title` igual, `checks[0].expect` diferente), `AC2: digest changes when only the prose changes` (uma palavra trocada fora do bloco), `AC2: digest changes when the source path changes` (mesmo texto com `planPath` em outra pasta, ou `cwd` diferente).
  - `AC2: CRLF copy gives the same digest` (e com BOM).
  - `AC2: workflow copy recomputes the same digest`: `loadCopy().planDigest({ plan: out.plan, source: out.source })` === `out.digest`, com `out` da CLI `emit` (stdout `JSON.parse`).
  - `emit adds route, wave and fileCount` (T5 externa: `route.tier` `'sonnet'`, `reviewTier` `'opus'`, `gate` `true`; T1 `fileCount` 2).
  - `AC3: workflow copy routes every table row like the source`: para cada linha de `routing-table.json`, `loadCopy().route(...)` dá os mesmos quatro campos esperados.
  - `AC3: workflow copy is not stale`: `embedFile(workflow-copy.js, { check: true }).stale` === `false`.
  - `workflow copy runs without process, require or crypto` (o contexto do `vm` não tem esses nomes; `typeof` deles no contexto é `'undefined'`).
  - CLI `emit` em plano com erro sai 1 e stdout vazio.
- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar `emitPlan` e a CLI `emit`; escrever os marcadores de `workflow-copy.js` e gerar a cópia**

Run: `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`
Expected: exit 0; o arquivo passa a conter o corpo das duas fontes, sem `export`.

Run: `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`
Expected: exit 0, sem linha `stale:`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/plan-tool.mjs plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T5: emit com resumo de integridade e cópia gerada para os workflows" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: `map` e `brief` (critério 4)

**Files:**
- Modify: `plugins/productivity-tools/scripts/plan-tool.mjs`
- Modify: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `checkPlan` (níveis), `route`, `emitPlan` (Task 5).
- Produces:
  - `export function buildMap(plan, levels, { maxWidth = 4 }) -> { maxWidth, waves: [{ n, tasks: [{ n, title, tier, effort, reviewTier, gate, external, locks }] }], external: number[], gates: number[] }`; `emitPlan` passa a tirar `wave` daqui.
  - `export function buildBriefs(plan, { spec, prose, waves }) -> Array<{ n, name: 'T<n>.md', text }>` com as seções `## Restrições`, `## Tarefa`, `## Interfaces consumidas` (`T<m>: <sig>` por item, ou `nenhuma`), `## Passos` (a seção do plano, literal), nesta ordem; `## Tarefa` traz os campos listados no spec, peça 3, item 2, com o texto de cada id de `covers` tirado do spec (AC: texto sem a marca; C: `input` -> `expected`; X: `what` (`target`)).
  - CLI `map <plan.md> [--spec] [--max-width <n>] [--json]` e `brief <plan.md> [--spec] [--out <pasta>] [--task <n>]` (padrão de `--out`: `briefs/` ao lado do plano; `--task` de tarefa inexistente: exit 2).

- [ ] **Step 1: Escrever os testes**:
  - `AC4: map with default width` (`--json`): ondas `[[1], [2, 3, 5], [4], [6]]`; nenhuma onda com mais de 4; nenhuma com T3 e T4 juntas; toda tarefa numa onda depois das suas dependências; `external` === `[5]`; `gates` contém 5.
  - `AC4: map with --max-width 2`: ondas `[[1], [2, 3], [4, 5], [6]]`; nenhuma onda acima de 2.
  - `emit wave matches the map` (T3 `wave` 2, T4 `wave` 3, T6 `wave` 4).
  - `--max-width 0`, `--max-width abc` e `--max-width` sem valor saem 2; `map` em plano com erro sai 1.
  - `AC4: brief writes one file per task with the four sections` (`--out <tmp>`): `T1.md` a `T6.md`; cada um tem as quatro seções na ordem, as duas `constraints`, `tier`/`effort`/`reviewTier`/`gate`, os arquivos e os `covers` com o texto do spec (T2 contém o texto de `C1`; T5 o de `X1` e o `externalDedupe`); `T3.md` em `## Interfaces consumidas` contém `T1: loadItem(id) -> item`; `T1.md` contém `nenhuma`; `## Passos` de cada um é a seção da tarefa no plano.
  - `brief --task 3` grava só `T3.md`; `--task 9` sai 2.
  - `brief leaves plan and spec untouched and writes LF` (plano CRLF em tmp: bytes do plano e do spec iguais antes e depois; nenhum `\r` nos briefs).
- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar** `buildMap` (cada nível, em ordem de `n`, repartido em sub-ondas: a tarefa entra na primeira sub-onda com menos de `maxWidth` tarefas e sem trava em comum; ondas numeradas a partir de 1), a saída texto de `map` (uma linha por onda: `Onda <n>: T<a> (<tier>/<effort>, revisor <reviewTier>[, portão][, externa]), ...`), `buildBriefs` e a CLI `brief` (cria `--out` com `recursive: true`, grava LF, imprime os caminhos gravados).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/plan-tool.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs
git commit -m "E6 T6: mapa de ondas com largura máxima e briefs por tarefa" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: documentação e gates

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: os nomes de arquivo das Tasks 1 a 6.
- Produces: só texto.

- [ ] **Step 1: Editar `CLAUDE.md`**, seção Layout: a linha de `lib/` cita também `routing.mjs` e `plan-digest.mjs` (fontes puras embutíveis: roteamento único e resumo de integridade do plano); a de `scripts/` cita `plan-tool.mjs` (checa um plano `plan/1` contra o spec, emite com resumo, gera mapa e briefs). Nenhuma outra mudança.

- [ ] **Step 2: Rodar os gates**

Run: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (G1)
Expected: exit 0, `fail 0`, `skipped 0`, total maior que a linha de base 1051 (nenhuma falha é pré-existente).

Run: `claude plugin validate .` (G2) e `claude plugin validate plugins/productivity-tools` (G3)
Expected: exit 0 nos dois.

Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` (G4)
Expected: exit 0 (checker e formato do roadmap não foram tocados).

Run: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` (G5)
Expected: exit 0 (`fixtures/` fica fora do lint; `plan-tool.mjs` é nome único no plugin).

Run: `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`
Expected: exit 0.

Run: `git status --porcelain`
Expected: só `CLAUDE.md` (diferença só de fim de linha em outro arquivo: `git checkout -- <arquivo>`).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "E6 T7: documenta plan-tool, routing e plan-digest no Layout" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Roteamento por tarefa

| Tarefa | tier | reviewTier | external | externalDedupe | needsLock | Navegador | Depende de |
|---|---|---|---|---|---|---|---|
| T1 | sonnet | sonnet | false | - | (nenhum) | não | - |
| T2 | sonnet | sonnet | false | - | (nenhum) | não | T1 |
| T3 | sonnet | sonnet | false | - | (nenhum) | não | T2 |
| T4 | sonnet | sonnet | false | - | (nenhum) | não | T3 |
| T5 | sonnet | sonnet | false | - | (nenhum) | não | T4 |
| T6 | sonnet | sonnet | false | - | (nenhum) | não | T5 |
| T7 | haiku | sonnet | false | - | (nenhum) | não | T6 |

Pontuação (`plan-coordinator/references/routing.md`): T1 escopo 1, ambiguidade 0, raciocínio 1, raio 1 (código interno compartilhado que E7, E8 e E12 vão ler), verificabilidade 0 -> 3, sonnet. T2 1+1+1+1+0 = 4, sonnet. T3 e T4 1+1+2+1+0 = 5, sonnet (grafo, ciclo, cobertura). T5 1+0+1+1+0 = 3, sonnet. T6 1+1+1+1+0 = 4, sonnet. T7 é texto e rodar gates (0-2), haiku; revisor sonnet (nunca abaixo do executor). Nenhuma tarefa tem raio 2 (nenhum auth, segredo, escrita em produção, migração nem push), então nenhum revisor opus. Todas as tarefas de código tocam `plan-tool.test.mjs`, então rodam em sequência.

Nenhuma tarefa tem efeito externo (nenhum push, publicação, mensagem, escrita em dado compartilhado nem leitura de produção), então nenhuma declara `externalDedupe`; o spec diz "o card não pede efeito externo" (Depende de entrada humana: Nada). A tarefa externa T5 do plano de exemplo é dado de fixture: nunca roda. Nenhum passo depende de navegador ou de algo fora deste ambiente: todo passo é exercitado aqui pelos testes e comandos listados, e a evidência aceitável é a saída desses comandos.

## Acceptance criteria evidence

| ac | kind | command | testRef | blq | external |
|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/scripts/plan-tool.test.mjs | plan-tool.test.mjs: os testes "AC1: ..." das Tasks 3 e 4 (dependency-cycle, write-conflict, acceptance-uncovered, interface-unproduced, external-undeclared, "each planted defect gives its named error") | | false |
| AC2 | test | node --test plugins/productivity-tools/scripts/plan-tool.test.mjs | plan-tool.test.mjs: os testes "AC2: ..." da Task 5 (digest muda com bloco, prosa e caminho; CRLF igual; cópia gerada recalcula o mesmo digest) | | false |
| AC3 | test | node --test plugins/productivity-tools/scripts/plan-tool.test.mjs | plan-tool.test.mjs: "AC3: routing table row ..." da Task 2 (fonte) e "AC3: workflow copy routes every table row like the source", "AC3: workflow copy is not stale" da Task 5 (cópia) | | false |
| AC4 | test | node --test plugins/productivity-tools/scripts/plan-tool.test.mjs | plan-tool.test.mjs: "AC4: map with default width", "AC4: map with --max-width 2", "AC4: brief writes one file per task with the four sections" da Task 6 | | false |

Todos os comandos são os das marcas `{verify: test; ...}` do card, mantidos; o arquivo de teste que eles citam é criado na Task 1 e estendido nas Tasks 2 a 6. Cada um sai 0 só se todos os testes do arquivo passam, incluindo os de testRef. Nenhum é externo: só lê arquivos da branch e escreve em pastas temporárias do sistema.

## Decisões autônomas deste plano (Origem executor, status pendente)

1. Verificação pesada (routing.md §3.3) com total 6 a 10 em que a tabela já deu opus (blast 2 e ambiguity 2): fica opus, com portão; a frase "does not reach opus through this override" só impede subir por ela. Linha "total 10" da tabela. Alcance: contrato.
2. A linha "verificação pesada em haiku" pedida pelo spec é inalcançável (verifiability 2 + reasoning >= 1 dá total >= 3); a tabela traz no lugar "verificação pesada em sonnet" (sonnet -> opus) e a nota na Task 2. Alcance: local.
3. `checkRecords` devolve `{ errors, warnings }` em vez de receber callbacks, e a extração entra na Task 3, junto do primeiro uso. Alcance: local.
4. Plano de exemplo com seis tarefas e o nível 1 com quatro (T2 a T5), T3 e T4 com a trava `fixture-db`, para que a largura padrão e a largura 2 deem mapas diferentes. Alcance: local.
5. Tarefa em ciclo ou com dependência desconhecida fica fora dos níveis, e `write-conflict` só é checado entre tarefas com nível. Alcance: local.
