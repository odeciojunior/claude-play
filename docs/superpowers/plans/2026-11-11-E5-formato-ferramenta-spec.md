# E5 -- Formato e ferramenta de spec: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** Um leitor puro de bloco de dados `json data` em Markdown, o esquema `spec/1`, a ferramenta `spec-tool` (`check`, `emit`, `summary`) que confere o spec contra o card, e o lint de plugin cobrindo frontmatter de agentes (recursivo, chaves ignoradas e fora da política) e nomes de script únicos.

**Architecture:** `plugins/productivity-tools/lib/data-block.mjs` é fonte pura (sem `import`, `process`, `Buffer`, `crypto`, DEC-058) que acha, lê e troca o bloco de dados. `plugins/productivity-tools/scripts/spec-tool.mjs` importa esse leitor e `../lib/roadmap-format.mjs` (`norm`, `parseVerifyTag`, `parseRoadmapTexts`), exporta funções puras sobre texto (`checkSpec`, `emitSpec`, `summarize`, `formatSummary`) e uma CLI fina que lê arquivos e imprime. `lint-plugin.mjs` ganha a checagem de agentes recursiva com política de chaves, a de nome de script único e `lib/` na checagem de escrita na raiz.

**Tech Stack:** Node 18+ (medido: v22.17.1), ESM, `node:test`, `node:assert/strict`, sem dependências nem npm.

**Spec:** `docs/superpowers/specs/2026-11-11-E5-formato-ferramenta-spec-design.md` (o executor lê o spec junto: esquema, códigos e regras estão lá, na peça 1, 2 e 3).

## Global Constraints

- `lib/data-block.mjs` sem `import`, `require`, `process`, `Buffer` nem `crypto`; `checkPureSource` de `plugins/productivity-tools/scripts/embed.mjs` devolve `null` para ele.
- Bloco de dados: cerca de nível superior com informação exata `json data` (3+ crases ou tis; fechamento com o mesmo caractere e comprimento >= abertura). Texto normalizado como `norm` (BOM removido, CRLF -> LF, NFC), reescrito localmente.
- `schema` exatamente `"spec/1"`. Campo obrigatório ausente é sempre erro, nunca padrão (anti-objetivo).
- Comparação com o card: literal após `norm` e colapso de espaço em branco (sequências viram um espaço, pontas aparadas), nada além (anti-objetivo).
- Códigos de erro (exatos): `data-block-missing`, `data-block-multiple`, `data-block-json`, `schema-version`, `field-missing`, `field-type`, `id-invalid`, `id-duplicate`, `card-not-found`, `acceptance-count`, `acceptance-text`, `acceptance-tag-missing`, `acceptance-tag-differs`, `acceptance-tag-invalid`, `ruling-incomplete`, `needs-person-kind`, `needs-person-blocking`, `needs-person-workaround`, `needs-person-blq`. Avisos: `card-not-checked`, `edge-cases-limit`, `field-unknown`.
- Saída texto do `check`: `ERROR <código> <ref>: <mensagem>` / `WARN <código> <ref>: <mensagem>`, última linha `Result: <e> errors, <w> warnings`. `--json`: `{ tool: "spec-tool", schema: "spec/1", path, errors: [{code,ref,message}], warnings: [...], summary: { errors, warnings, exitCode } }`. Exit 0 sem erro, 1 com erro, 2 uso inválido ou arquivo ilegível.
- Chaves de agente permitidas (exatas): `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `skills`, `memory`, `background`, `isolation`, `omitClaudeMd`, `color`, `autoCompactWindow`, `experimental`. Ignoradas (FAIL, mensagem atual "key X is ignored for plugin agents"): `hooks`, `mcpServers`, `permissionMode`, `initialPrompt`. Outra chave: FAIL "key X is outside the allowed agent frontmatter keys (repo policy)".
- Nome de script repetido: `WARN` com check "Script names are unique"; sem colisão, `OK` "Script names are unique". Nenhuma checagem nova pode fazer G5 falhar nos plugins atuais (anti-objetivo).
- Testes só em `plugins/productivity-tools/scripts/spec-tool.test.mjs` (novo) e `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`. Nenhum outro arquivo de teste.
- Nenhuma versão sobe (`plugin.json` e `README.md` intocados). Não editar `docs/plans/roadmap-evolucao-skills/`, `plugins/_template/`, `roadmap-release.js` nem o comando de nenhum gate.
- Ambiente medido: Windows 11, Git Bash e PowerShell 7, Node v22.17.1, `core.autocrlf=true` (checkout CRLF). Todo leitor aceita `\r\n`. Rode os comandos a partir de `D:/projects/claude-play-wt/E5`, branch `feat/E5`.
- Nenhum servidor nem porta (a faixa 5270-5279 não é usada). Nenhuma tarefa precisa de navegador. Nenhum push, nenhum efeito externo.
- Commits só com os arquivos da tarefa (`git add <arquivos>`, nunca `git add -A` nem `git stash`), mensagem começando por `E5 T<n>:` e terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Temporários de verificação manual só em `D:/projects/claude-play-wt/_tmp/E5/` (apagar no fim); os testes usam `fs.mkdtempSync(path.join(os.tmpdir(), ...))` removidos em `after`.

## Review Focus

- Spec em checkout CRLF (o próprio `fixtures/spec-tool/spec.md` vira CRLF no Windows) e com BOM: `check --roadmap` passa. Teste na Task 1 (leitor) e na Task 4 (`CRLF copy of the fixture passes check`).
- Bloco `json data` dentro de outra cerca mais longa (exemplo num ```` ```markdown ````), e bloco com informação `json` só: ignorados. Teste na Task 1.
- Valores falsos não são ausência: `reversible: false`, `blocking: false` com contorno, `alternative: ""`, `contradicts: null` passam. Teste na Task 3 (`falsy values are not missing`).
- Card com acento em NFD e spec em NFC (ou espaço duplo / quebra de linha no meio do critério): passa; uma palavra trocada: falha. Teste na Task 4.
- Spec `E<n>` checado sem `--roadmap`: só aviso `card-not-checked`, exit 0; spec com `id` kebab-case sem `--roadmap`: zero avisos. Teste na Task 4.

---

### Task 1: leitor de bloco de dados (`lib/data-block.mjs`)

**Files:**
- Create: `plugins/productivity-tools/lib/data-block.mjs`
- Create: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: `checkPureSource(text, name)` de `plugins/productivity-tools/scripts/embed.mjs` (só no teste).
- Produces: `findDataBlocks(text) -> Array<{ line: number, start: number, end: number, info: string, body: string }>` (line 1-based da cerca de abertura; start/end offsets no texto normalizado, cobrindo da abertura ao fim do fechamento); `readDataBlock(text) -> { data: any|null, prose: string, line: number|null, error: null | { code, message } }`; `replaceDataBlock(text, data) -> string` (lança `Error` se não houver exatamente um bloco). Todas normalizam o texto antes.

- [ ] **Step 1: Escrever os testes do leitor em `spec-tool.test.mjs`** (cabeçalho com `node:test`, `assert/strict`, `fs`, `os`, `path`, `fileURLToPath`; helper `tmp()` com `mkdtempSync` e `after` que remove). Testes:
  - `reader: no block -> data-block-missing` (`readDataBlock('# t\n').error.code === 'data-block-missing'`).
  - `reader: one block parses JSON and returns prose without it` (texto `'# T\n\n```json data\n{"a":1}\n```\n\nfim\n'` -> `data` deepEqual `{a:1}`, `line === 3`, `prose` contém `# T` e `fim` e não contém `"a"`).
  - `reader: two blocks -> data-block-multiple citing both lines` (mensagem contém os dois números de linha).
  - `reader: block nested in a longer fence is ignored` (```` ````markdown ```` contendo um ```` ```json data ```` interno, mais um bloco de nível superior: `findDataBlocks` tem tamanho 1 e é o de fora; só o aninhado -> `data-block-missing`).
  - `reader: info "json" alone is not a data block` e `reader: tilde fence works` (`~~~json data` ... `~~~`).
  - `reader: CRLF and BOM` (`'\uFEFF# T\r\n\r\n```json data\r\n{"a":1}\r\n```\r\n'` -> `data` `{a:1}`).
  - `reader: invalid JSON -> data-block-json with parser message` (`error.message` não vazia e `code === 'data-block-json'`).
  - `replaceDataBlock keeps prose and rewrites body` (resultado relido dá o novo `data`; texto antes e depois do bloco igual; com zero blocos, `assert.throws`).
  - `lib/data-block.mjs is pure source` (`checkPureSource(fs.readFileSync(<caminho>, 'utf8'), 'data-block.mjs') === null`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: FAIL (`Cannot find module .../lib/data-block.mjs`).

- [ ] **Step 3: Implementar `lib/data-block.mjs`** com as três funções e um `norm` local (`String(t).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC')`). Varredura por linha no estilo CommonMark: uma cerca aberta (qualquer informação) consome linhas até o fechamento com mesmo caractere e comprimento >= abertura, e o que está dentro dela não abre bloco; só conta a cerca de nível superior cuja informação, aparada, é exatamente `json data`. Cerca não fechada vai até o fim do texto (CommonMark) e não conta como bloco de dados. Comentário de cabeçalho em português dizendo que é fonte pura (DEC-058).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS, todos os testes.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/lib/data-block.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs
git commit -m "E5 T1: leitor puro de bloco de dados json data" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: spec de exemplo e roadmap mínimo

**Files:**
- Create: `plugins/productivity-tools/scripts/fixtures/spec-tool/spec.md`
- Create: `plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/roadmap.config.json`
- Create: `plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/strategy.md`
- Create: `plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/state.md`

**Interfaces:**
- Consumes: `readDataBlock` (Task 1); `parseRoadmapTexts` de `lib/roadmap-format.mjs`.
- Produces: o spec válido do card `E1` usado nas Tasks 3 a 5 e pelo teste de E6. Conteúdo fixado:
  - `roadmap.config.json`: copiar a forma de `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid/roadmap.config.json` com `strategy: "strategy.md"`, `files.state: "state.md"` e os demais `files` em `null`.
  - `strategy.md`: um `<!-- roadmap:card id=E1 ... -->` (mesma forma do card E1 do fixture `valid`) com `<!-- roadmap:acceptance -->` de três itens: (1) com `{verify: test; evidence: node --test tests/e1.test.mjs}`, (2) com `{verify: blocked BLQ-1; evidence: aguarda credencial do dono}`, (3) sem marca.
  - `state.md`: bloco `<!-- roadmap:blockers -->` com cabeçalho `| ID | Blocker | Affects | Since | Unblocks when |` e uma linha `BLQ-1`.
  - `spec.md`: prosa curta e um bloco ```` ```json data ```` com `schema: "spec/1"`, `id: "E1"`, `mode: "unattended"`, `acceptance` AC1..AC3 com os textos literais do card (marcas incluídas), `rulings` R1 (`scope: "local"`) e R2 (`scope: "contract"`, `costIfWrong: "high"`, `reversible: false`), `needsPerson` H1 (`blocking: true`, `blq: "BLQ-1"`, `workaround: ""`) e H2 (`blocking: false`, `workaround` preenchido, `blq: "BLQ-1"`), `externalEffects` X1, `edgeCases` C1. Todo item com todos os campos do esquema (peça 1 do spec).

- [ ] **Step 1: Escrever os quatro arquivos** conforme acima.

- [ ] **Step 2: Conferir que o leitor e o parser os leem**

Grave o script em `D:/projects/claude-play-wt/_tmp/E5/fixture-check.mjs` (importa os dois módulos por caminho absoluto `file:///D:/projects/claude-play-wt/E5/plugins/productivity-tools/lib/...`; imprime `readDataBlock(spec).error`, `data.acceptance.length`, o número de cards e `cards[0].acceptance.map(a => a.problem)`, e as linhas de `blocks.state.blockers.rows`) e rode:

Run: `node D:/projects/claude-play-wt/_tmp/E5/fixture-check.mjs`
Expected: `null`, `3`, `1`, `[null, null, null]`, uma linha começando por `BLQ-1`. Depois apague `D:/projects/claude-play-wt/_tmp/E5/`.

- [ ] **Step 3: Conferir que o lint ignora a pasta**

Run: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`
Expected: exit 0 (G5), sem linha citando `fixtures/spec-tool`.

- [ ] **Step 4: Commit**

```bash
git add plugins/productivity-tools/scripts/fixtures/spec-tool/spec.md plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/roadmap.config.json plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/strategy.md plugins/productivity-tools/scripts/fixtures/spec-tool/roadmap/state.md
git commit -m "E5 T2: spec de exemplo e roadmap mínimo para o spec-tool" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: esquema `spec/1` e `check` sem roadmap (critério 2)

**Files:**
- Create: `plugins/productivity-tools/scripts/spec-tool.mjs`
- Modify: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: `readDataBlock` (Task 1); fixture `fixtures/spec-tool/spec.md` (Task 2); `parseVerifyTag` de `../lib/roadmap-format.mjs`.
- Produces:
  - `checkSpec(text, { roadmap = null } = {}) -> { data: object|null, errors: Array<{code, ref, message}>, warnings: Array<{code, ref, message}> }`, onde `roadmap` é `null` ou `{ cards, openBlockers: Set<string> }` (Task 4 usa).
  - `main(argv: string[], io = { stdout, stderr }) -> number` (exit code); a CLI chama `process.exit(main(process.argv.slice(2)))` só quando é o módulo principal (mesmo `isMainModule` de `lint-plugin.mjs`).
  - `ref` é `AC<n>`, `R<n>`, `H<n>`, `X<n>`, `C<n>`, o caminho do campo (`schema`, `mode`, `rulings[2]`) ou `-`.

- [ ] **Step 1: Escrever os testes** (mutação em memória do texto do fixture: helper `mutate(fn)` lê `spec.md`, aplica `fn(data)` e regrava com `replaceDataBlock`):
  - `AC2: fixture passes schema check with no errors` (`checkSpec(texto).errors` vazio).
  - `AC2: ruling without <campo> -> ruling-incomplete naming R<n>`, em laço sobre `basis`, `costIfWrong`, `reversible`, `scope` com `delete`, e sobre valores fora do domínio (`basis: ""`, `costIfWrong: "huge"`, `reversible: "no"`, `scope: "global"`): erro `ruling-incomplete` com `ref === 'R1'` e o campo na mensagem.
  - `AC2: needsPerson without blocking -> needs-person-blocking naming H<n>` (também `blocking: "yes"`).
  - `AC2: non-blocking item without workaround -> needs-person-workaround` (H2 com `workaround: ""`), e `kind: "other"` -> `needs-person-kind`.
  - `schema: wrong version -> schema-version`; `missing acceptance -> field-missing`; `rulings item not object -> field-type`; `id R1 repeated -> id-duplicate`; `acceptance id AC2 at position 1 -> id-invalid`; `invalid verify tag -> acceptance-tag-invalid` (marca `{verify: maybe}`); `unknown field -> field-unknown warning`; `six edge cases -> edge-cases-limit warning`; `missing mode -> field-missing`; `mode "batch" -> field-type`.
  - `falsy values are not missing` (R1 `reversible: false`, `alternative: ""`, `contradicts: null`; H2 `blocking: false` com contorno -> zero erros).
  - CLI: `check` no fixture sem `--roadmap` sai 0 e imprime `Result: 0 errors, 1 warnings` (o aviso é `card-not-checked`, que chega na Task 4; nesta tarefa o teste espera `Result: 0 errors` e sai 0); spec com R1 sem `basis` sai 1 com linha `ERROR ruling-incomplete R1:`; `--json` tem o mesmo exit e `summary.errors` igual ao número de linhas `ERROR`; sem argumentos, comando desconhecido ou arquivo inexistente sai 2. CLI rodada por `spawnSync(process.execPath, [SCRIPT, ...])` com o spec mutado gravado em `tmp()`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: FAIL nos testes novos (`spec-tool.mjs` não existe); os da Task 1 passam.

- [ ] **Step 3: Implementar `spec-tool.mjs`** com `checkSpec` cobrindo a peça 1 (tabela e "Regras dos registros" do spec) e a CLI `check [--json]`. Erro do leitor vira o erro do mesmo código com `ref: '-'` e para a checagem. Valor de tipo errado ou fora do domínio num campo sem código próprio (`mode`, `id`, `text`, `what`, `target`, `input`, `expected`, `question`, `decision`, `alternative`, `contradicts`, `blq`) é `field-type`; ausência é `field-missing`. `contradicts` aceita `null` ou `/^(DEC-\d+|G\d+)$/`; `blq` `/^BLQ-\d+$/`. Padrões de id: `AC<pos>`, `/^R\d+$/`, `/^H\d+$/`, `/^X\d+$/`, `/^C\d+$/`. Ordem de emissão: campos de topo, depois `acceptance`, `rulings`, `needsPerson`, `externalEffects`, `edgeCases`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/spec-tool.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs
git commit -m "E5 T3: esquema spec/1 e comando check" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: `check --roadmap` contra o card (critério 1)

**Files:**
- Modify: `plugins/productivity-tools/scripts/spec-tool.mjs`
- Modify: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: `checkSpec` (Task 3); `norm`, `parseVerifyTag`, `parseRoadmapTexts` de `../lib/roadmap-format.mjs`; `fixtures/spec-tool/roadmap/` (Task 2).
- Produces: `loadRoadmap(dir: string) -> { cards, openBlockers: Set<string> }` (lê `roadmap.config.json`, a estratégia de `strategy` e os `files` não nulos que existirem; `openBlockers` = primeira coluna de `blocks.state.blockers.rows`; lança `Error` com mensagem legível se o config não existir ou for JSON inválido, e a CLI converte em exit 2); flag `--roadmap <pasta>` em `check`.

- [ ] **Step 1: Escrever os testes** (mutação do spec como na Task 3, mais mutação do texto do card em memória e `checkSpec(texto, { roadmap })` com `roadmap` montado por `loadRoadmap(FIXTURE_ROADMAP)` ou por `parseRoadmapTexts` sobre a estratégia mutada):
  - `AC1: fixture passes check --roadmap with exit 0 and no warnings` (CLI; stdout termina com `Result: 0 errors, 0 warnings`).
  - `AC1: changed criterion text -> acceptance-text naming AC<n>` (uma palavra trocada no AC1 do spec; erro com `ref === 'AC1'` e a mensagem contém o início do texto do card).
  - `AC1: tag removed -> acceptance-tag-missing` (AC1 sem `{verify: ...}`).
  - `AC1: evidence changed -> acceptance-tag-differs` (outro comando em AC1) e `kind changed -> acceptance-tag-differs` (AC2 `blocked BLQ-2`).
  - `AC1: one criterion fewer -> acceptance-count`.
  - `AC1: whitespace, line-ending and NFD-only differences pass` (espaços duplos e `\n` dentro do texto do spec; card com uma palavra acentuada em NFD).
  - `CRLF copy of the fixture passes check` (spec e estratégia reescritos com `\r\n` numa pasta `tmp()`; zero erros).
  - `AC2: closed blq -> needs-person-blq` (H1 `blq: "BLQ-9"`, com `--roadmap`; `ref === 'H1'`).
  - `card id not in roadmap -> card-not-found` (spec `id: "E9"`).
  - `E<n> without --roadmap -> card-not-checked warning, exit 0`; `kebab-case id without --roadmap -> zero warnings` (`id: "spec-writer"`).
  - `--roadmap on missing folder -> exit 2`.
  - Atualizar o teste da Task 3 sobre `check` sem `--roadmap` para esperar `Result: 0 errors, 1 warnings`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: FAIL nos testes novos (`loadRoadmap` não exportado / códigos não emitidos).

- [ ] **Step 3: Implementar** a comparação da peça 2 ("Comparação dos critérios"): os dois lados por `norm` e colapso `s.replace(/\s+/g, ' ').trim()`; o spec passa por `parseVerifyTag` igual ao card; `acceptance-count` quando os tamanhos diferem (e então compara só até o menor); por posição, `acceptance-text`, `acceptance-tag-missing`, `acceptance-tag-differs` (compara `kind`, `blq`, `evidence` colapsados). Mensagem: `` `AC<n>: <descrição> (card: "<primeiros 60 caracteres do texto do card>...")` ``. `card-not-checked` só quando `roadmap === null` e `id` casa `/^E\d+$/`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/spec-tool.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs
git commit -m "E5 T4: spec-tool check compara critérios e bloqueios com o card" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: `emit` e `summary`

**Files:**
- Modify: `plugins/productivity-tools/scripts/spec-tool.mjs`
- Modify: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: `checkSpec`, `loadRoadmap` (Tasks 3 e 4).
- Produces:
  - `emitSpec(text, { roadmap = null } = {}) -> { errors, warnings, data }`, onde cada `data.acceptance[i]` ganha `verify: { kind, blq, evidence } | null` (`blq` `null` quando ausente) e `textWithoutTag`; CLI `emit <spec> [--roadmap <pasta>]` imprime `{ tool: "spec-tool", schema: "spec/1", path, data }` (JSON, 2 espaços) em stdout e sai 0, ou os erros (formato texto do `check`) em stderr e sai 1.
  - `summarize(text) -> { error: null | {code, message}, rulings, needsPerson, externalEffects, stops: string[] }` (`stops`: ids de rulings com `costIfWrong === 'high' && reversible === false` ou `contradicts` preenchido, e de needsPerson com `blocking === true`, na ordem do bloco).
  - `formatSummary(s) -> string` (Markdown, três tabelas com cabeçalhos em português: decisões `| ID | Decisão | Custo se errada | Reversível | Alcance | Contradiz | Para |`, pessoas `| ID | Tipo | O quê | Bloqueia | Contorno | BLQ | Para |`, efeitos `| ID | O quê | Alvo |`; a coluna Para traz `para` ou vazio). CLI `summary <spec> [--json]`; `--json` imprime `{ rulings, needsPerson, externalEffects, stops }`; spec sem bloco legível sai 1 com o erro do leitor em stderr.

- [ ] **Step 1: Escrever os testes**:
  - `emit: fixture prints data with parsed verify` (CLI com `--roadmap`; JSON com `tool === 'spec-tool'`, `data.acceptance[0].verify` deepEqual `{ kind: 'test', blq: null, evidence: 'node --test tests/e1.test.mjs' }`, `data.acceptance[1].verify.blq === 'BLQ-1'`, `data.acceptance[2].verify === null`, `textWithoutTag` sem `{verify:`).
  - `emit: spec with an error exits 1 and prints nothing on stdout`.
  - `summary: marks para on blocking item and high irreversible ruling` (`stops` deepEqual `['R2', 'H1']`; texto Markdown contém a linha de H1 com `para` e a de H2 sem).
  - `summary: no data block -> exit 1 with data-block-missing`.
  - `emit/summary: invalid usage -> exit 2`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar** `emitSpec`, `summarize`, `formatSummary` e os dois comandos na CLI; `|` dentro de célula escapado como `\|`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/spec-tool.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs
git commit -m "E5 T5: spec-tool emit e summary" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: lint de agentes e scripts (critério 3)

**Files:**
- Modify: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`
- Modify: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`

**Interfaces:**
- Consumes: `lintPlugin`, `parseFrontmatter`, `walk`, `rel` já existentes.
- Produces: constante `AGENT_KEYS` (Set com as 15 chaves permitidas); checagem 5 recursiva; nova checagem "Script names are unique"; checagem 7 sobre `['scripts', 'skills', 'hooks', 'lib']`. Nenhuma assinatura exportada muda.

- [ ] **Step 1: Escrever os testes** (helpers `fresh`, `write`, `lint`, `has` existentes):
  - `AC3: ignored key in a nested agent -> FAIL naming the file`, em laço sobre `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` em `agents/review/demo.md`: `has(results, 'FAIL', 'agents/review/demo.md')` e a mensagem contém `is ignored for plugin agents`.
  - `AC3: out-of-policy key -> FAIL naming the file` (`modle: sonnet` em `agents/demo.md`; FAIL com `agents/demo.md` e `outside the allowed agent frontmatter keys`).
  - `agent with every allowed key -> OK` (frontmatter com as 15 chaves, `experimental:` com uma subchave indentada; zero FAIL e OK `agents/demo.md frontmatter`).
  - `duplicate script names -> WARN with both paths` (`skills/a/scripts/run.mjs` e `skills/b/scripts/run.mjs`; WARN `Script names are unique` citando os dois caminhos); `same name under fixtures or as .test.mjs is not a duplicate`.
  - `writing into CLAUDE_PLUGIN_ROOT from lib -> WARN` (`lib/x.mjs` com `mkdir -p "${CLAUDE_PLUGIN_ROOT}/x"`).
  - `real plugins have no FAIL`: `lintPlugin` sobre `plugins/sql-server-tools` e `plugins/productivity-tools` (caminhos a partir da raiz do repositório, `path.resolve(here, '../../../../..')`, com `marketplace` = `.claude-plugin/marketplace.json` da raiz) sem resultado `FAIL` e com OK `Script names are unique`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`
Expected: FAIL nos testes novos (agente em subpasta não é visto; chave fora da política passa; sem checagem de nome).

- [ ] **Step 3: Implementar** a peça 3 do spec, itens 1 a 4: checagem 5 sobre `walk(path.join(dir, 'agents'))` filtrando `.md`, nome `agents/<caminho relativo com />`; ignoradas antes, depois "outside" para chave que não está em `AGENT_KEYS` nem nas ignoradas; nova checagem logo depois da 7 sobre arquivos `.mjs|.js|.cjs|.sh|.ps1|.py` (não `.test.mjs`) em `scripts/`, `skills/*/scripts/`, `skills/*/workflow/` e `lib/` (via `walk`, que já pula `fixtures`), agrupando por nome de arquivo.

- [ ] **Step 4: Rodar e ver passar, e conferir os plugins reais**

Run: `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`
Expected: PASS, todos (os antigos sem mudança de expectativa).

Run: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` (G5), depois o mesmo com `plugins/marketplace-tools` e `plugins/sql-server-tools`
Expected: exit 0 nos três; nenhuma linha `[FAIL]`.

- [ ] **Step 5: Commit**

```bash
git add plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs
git commit -m "E5 T6: lint valida agentes recursivos, chaves fora da política e nomes de script" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: documentação e gates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `plugins/marketplace-tools/skills/validate-plugin/SKILL.md`

**Interfaces:**
- Consumes: o que as Tasks 1 a 6 entregaram (nomes de arquivo e chaves).
- Produces: só texto.

- [ ] **Step 1: Editar** `CLAUDE.md`: logo depois do item "SKILL.md frontmatter keys (repo policy)", um item "**Agent frontmatter keys (repo policy):**" com as 15 chaves permitidas, dizendo que `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` são ignoradas em agentes de plugin e que outra chave falha no lint; na seção Layout, a linha de `lib/` cita também `data-block.mjs` e a de `scripts/` cita `spec-tool.mjs` (checagem de spec contra o card). Em `validate-plugin/SKILL.md`, na frase "The script covers: ...", trocar `agent frontmatter` por `agent frontmatter (recursive; ignored and out-of-policy keys)` e acrescentar `unique script names` depois de `writes into ${CLAUDE_PLUGIN_ROOT}`. Nenhuma outra mudança (versão intocada).

- [ ] **Step 2: Rodar os gates**

Run: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (G1)
Expected: exit 0, `fail 0`, `skipped 0`, total maior que a linha de base 894 (nenhuma falha é pré-existente).

Run: `claude plugin validate .` (G2), `claude plugin validate plugins/productivity-tools` (G3), `claude plugin validate plugins/marketplace-tools`
Expected: exit 0 nos três.

Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` (G4)
Expected: exit 0.

Run: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` (G5), e o mesmo para `plugins/marketplace-tools` e `plugins/sql-server-tools`
Expected: exit 0.

Run: `git status --porcelain`
Expected: só os dois arquivos desta tarefa (diferença só de fim de linha em outro arquivo: `git checkout -- <arquivo>`).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md plugins/marketplace-tools/skills/validate-plugin/SKILL.md
git commit -m "E5 T7: documenta política de chaves de agente, data-block e spec-tool" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Roteamento por tarefa

| Tarefa | tier | reviewTier | external | needsLock | Navegador | Depende de |
|---|---|---|---|---|---|---|
| T1 | sonnet | sonnet | false | (nenhum) | não | - |
| T2 | sonnet | sonnet | false | (nenhum) | não | T1 |
| T3 | sonnet | sonnet | false | (nenhum) | não | T1, T2 |
| T4 | sonnet | sonnet | false | (nenhum) | não | T3 |
| T5 | sonnet | sonnet | false | (nenhum) | não | T4 |
| T6 | sonnet | sonnet | false | (nenhum) | não | - |
| T7 | haiku | sonnet | false | (nenhum) | não | T5, T6 |

Pontuação (routing.md): T1 a T6 têm escopo 1, ambiguidade 0-1 (esquema, códigos e assinaturas fixados no spec e aqui), raciocínio 1-2 (varredura de cercas CommonMark, validação por registro), raio de impacto 1 (código interno compartilhado que E6, E8 e E19 vão ler; nenhum auth, segredo, produção, migração nem push), verificabilidade 0 (testes) -> 3-5, sonnet. T7 é texto e rodar gates (0-2), haiku; revisor sonnet (nunca abaixo do executor). Nenhuma tarefa tem raio 2, então nenhum revisor opus. T3, T4 e T5 tocam os mesmos dois arquivos: rodam em sequência. T6 é independente e pode rodar em paralelo com T1 a T5.

Nenhuma tarefa tem efeito externo (nenhum push, publicação, escrita em dado compartilhado nem leitura de produção), então nenhuma declara `externalDedupe`; o card e o spec não pedem efeito externo ("Depende de entrada humana: Nada"). Nenhum passo depende de navegador ou de algo fora deste ambiente: todo passo é exercitado aqui pelos testes e comandos listados, e a evidência aceitável é a saída desses comandos.

## Acceptance criteria evidence

| ac | kind | command | testRef | blq | external |
|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/scripts/spec-tool.test.mjs | spec-tool.test.mjs: os testes "AC1: ..." da Task 4 (acceptance-text, acceptance-tag-missing, acceptance-tag-differs, acceptance-count, fixture limpo) | | false |
| AC2 | test | node --test plugins/productivity-tools/scripts/spec-tool.test.mjs | spec-tool.test.mjs: os testes "AC2: ..." das Tasks 3 e 4 (ruling-incomplete por campo, needs-person-blocking, needs-person-workaround, needs-person-blq) | | false |
| AC3 | test | node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs | lint-plugin.test.mjs: "AC3: ignored key in a nested agent -> FAIL naming the file", "AC3: out-of-policy key -> FAIL naming the file" | | false |

Todos os comandos são os das marcas `{verify: test; ...}` do card, mantidos; os arquivos de teste que eles citam são criados (T1) ou estendidos (T6) por este plano. Cada um sai 0 só se todos os testes do arquivo passam, incluindo os de testRef. Nenhum é externo: só lê arquivos da branch e escreve em pastas temporárias do sistema.

## Decisões autônomas deste plano (Origem executor, status pendente)

1. Valor de tipo errado ou fora do domínio num campo sem código próprio (`mode`, `contradicts`, `blq`, textos) é `field-type`; ausência é `field-missing`. Alcance: contrato.
2. O spec de exemplo e o roadmap mínimo nascem numa tarefa própria (T2, quatro arquivos) verificada por um script temporário, para manter cada tarefa em até quatro arquivos; os testes que os usam chegam nas Tasks 3 a 5. Alcance: local.
3. `acceptance-count` não impede a comparação posição a posição até o menor tamanho, para nomear também o critério divergente. Alcance: local.
4. A mensagem dos erros de critério traz os primeiros 60 caracteres do texto do card. Alcance: local.
5. Os cabeçalhos das tabelas de `summary` são em português, a língua do roadmap. Alcance: local.
