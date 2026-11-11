# E2 -- Formato do roadmap verificado por código: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** Um módulo-fonte único do parser do formato de roadmap, embutido no checker por um gerador de cópias com detecção de defasagem e importado pelo preflight, mais onze checagens novas (todas aviso), a saída `--json` do checker e o contrato `formats.md` atualizado junto.

**Architecture:** `plugins/productivity-tools/lib/roadmap-format.mjs` guarda as funções puras do parser (tiradas do checker sem mudança de comportamento) e a composição `parseRoadmapTexts`, sem `import` nem globais de Node (DEC-058). `plugins/productivity-tools/scripts/embed.mjs` copia esse módulo entre marcadores para dentro de `check-roadmap.mjs`, que continua um arquivo único copiável; o preflight importa o módulo por caminho relativo. As checagens novas e o `--json` ficam no checker.

**Tech Stack:** Node 18+ (medido: v22.17.1), ESM, `node:test`, `node:assert/strict`, sem dependências nem npm.

**Spec:** `docs/superpowers/specs/2026-11-11-E2-formato-roadmap-verificado-design.md`

## Global Constraints

- O módulo-fonte não usa `import`, `require`, `process`, `Buffer` nem `crypto` (DEC-058); só funções puras e globais da linguagem (`String`, `RegExp`, `Set`, `Map`, `Object`, `Date`).
- A linha 1 do checker continua `// check-roadmap 1.5.0 format 1`; a versão do plugin (`plugin.json` e `README.md`) não muda; `formatVersion` continua 1 (DEC-042). Os códigos novos são documentados como "since 1.7.0".
- Nenhuma checagem nova é erro: todas emitem `warning`. Uma pasta válida hoje (exit 0) continua exit 0 (anti-objetivo do spec).
- Códigos, mensagens e ordem de emissão das checagens antigas não mudam; todos os testes atuais de `check-roadmap.test.mjs` e `preflight.test.mjs` passam sem mudança de expectativa. A saída da CLI do preflight (`runPreflight`) não muda.
- Nomes de código fixos: `status-order`, `card-phase-table`, `phase-order`, `dod-no-gate`, `pending-no-owner`, `state-header`, `blocked-no-blq`, `blocker-no-restore`, `source-uncited`, `strategy-plan-suffix`, `executor-decision-pending`.
- Formato do `--json`: `{ "checker": "1.5.0", "format": 1, "errors": [{code,file,message}], "warnings": [{code,file,message}], "summary": { "errors": n, "warnings": m, "exitCode": 0|1|2 } }`; `config`, `bad-header` e `internal` são erros de mesmo nome.
- Marcadores do gerador, em linhas próprias: `// <embed src="<caminho relativo ao destino>" exports="keep|strip">` e `// </embed>`; primeira linha gerada: `// Gerado de <src> por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.`
- Testes só nos dois arquivos do card: `roadmap-tracker/scripts/check-roadmap.test.mjs` e `roadmap-release/scripts/preflight.test.mjs` (nenhum arquivo de teste novo).
- Esta branch não edita `docs/plans/roadmap-evolucao-skills/` (nem a cópia vendorizada do checker), nem a estratégia, nem `roadmap-release.js`, nem o comando de nenhum gate.
- Ambiente medido: Windows 11, Git Bash e PowerShell 7, `core.autocrlf=true` (checkout CRLF, índice LF). Todo leitor aceita `\r\n`; o gerador compara em LF e preserva o fim de linha do destino ao escrever. Rode os comandos a partir de `D:/projects/claude-play-wt/E2`.
- Nenhum servidor nem porta (a faixa 5210-5219 não é usada). Nenhuma tarefa precisa de navegador. Nenhum push, nenhum efeito externo.
- Commits só com os arquivos da tarefa (`git add <arquivos>`, nunca `git add -A` nem `git stash`), mensagem começando por `E2 T<n>:` e terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Arquivos temporários de verificação manual só em `D:/projects/claude-play-wt/_tmp/E2/` (apagar no fim); os testes usam `fs.mkdtempSync(os.tmpdir())` com o helper `tmp()` já existente.

## Review Focus

- Checkout CRLF: `embed.mjs --check` sobre o checker em CRLF diz "em dia", e a reescrita mantém CRLF. Teste na Task 2 (`embed keeps CRLF and compares in LF`).
- Palavras proibidas só em comentário (por exemplo "process" num comentário do módulo) não são uso como identificador: a recusa ignora comentários; `process.env` no código é recusado. Teste na Task 2.
- Roadmap localizado: o teste existente `localized accented vocabulary` continua dando `[]` com as checagens novas (a palavra de bloqueio e o cabeçalho localizados não podem gerar aviso). Conferido na Task 5 e na Task 6 (rodar o teste existente).
- Roadmap em inglês: `executor-decision-pending` lê `Scope: contract.`/`Scope: local.` como `Alcance: contrato.`/`Alcance: local.`. Teste na Task 5.
- Card cujo único `G1` está dentro do bloco `acceptance` (comando de evidência) não cumpre a definição de pronto: `dod-no-gate` olha só o `body` fora de `acceptance` e `risks`. Teste na Task 6.

---

### Task 1: módulo-fonte do parser (`lib/roadmap-format.mjs`)

**Files:**
- Create: `plugins/productivity-tools/lib/roadmap-format.mjs`
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: as funções atuais de `check-roadmap.mjs` linhas 27-258 (`norm`, `escapeRe`, `parseAttrs`, `scanFences`, `scanComments`, `WS_RE`, `skipWs`, `readBlocks`, `splitRow`, `parseTable`, `parseList`, `stripNote`, `parseStatus`, `idsIn`, `shasIn`, `VERIFY_KINDS`, `EXECUTABLE_KINDS`, `parseVerifyTag`), copiadas sem mudança de comportamento. O checker ainda não muda nesta tarefa.
- Produces (todas com `export`):
  - as funções acima, com os mesmos nomes e assinaturas;
  - `export const ROADMAP_BLOCKS`: lista `{ role, name, kind: 'table'|'list', cols? }` conforme `formats.md` §3: strategy `gates` table 5, strategy `phases` table 4 (bloco novo opcional: Fase, Critérios de entrada, Critérios de saída, Entregáveis); state `now` list, `panel` table 4, `blockers` table 5, `pending` list, `inflight` table 3, `donot` list, `releases` table 6; decisions `decisions` table 9; log `log` table 4; sources `sources` table 5, `conflicts` list; requirements `requirements` table 6; measurements `measurements` table 7;
  - `export function parseRoadmapTexts({ strategy, files })` → `{ version, cards, blocks }`:
    - `version`: `attrs` do primeiro anchor `roadmap:version` bem formado, ou `null`;
    - `blocks[role][name]`: tabela `{ present, closed, malformed, rows }`, lista `{ present, closed, malformed, items }`. `present` = há ao menos um opener bem formado; `closed` = o primeiro bem formado tem fechamento; `malformed` = número (inteiro) de openers malformados com esse nome; `rows` = `parseTable(body)` do primeiro bem formado, sem filtrar contagem de colunas (`[]` se ausente); `items` = `parseList(body)`. Texto `null`/`undefined` (ex.: `measurements: null`) → `{ present: false, closed: false, malformed: 0, rows: [] }` (ou `items: []`);
    - `blocks.strategy.version = { present, malformed }` e `blocks.strategy.card = { malformed }` (openers de card malformados);
    - `cards`: um por opener `roadmap:card` bem formado, na ordem do texto: `{ id, attrs, closed, depends, reqs, critical, acceptance, risks, body, malformed: { acceptance, risks } }`, com `depends`/`reqs`/`critical`/`acceptance` (itens passados por `parseVerifyTag`)/`risks` calculados como hoje em `checkRoadmap` (linhas 526-540); `body` = corpo do card sem os trechos dos blocos `acceptance` e `risks` (do opener ao fechamento, inclusive); `malformed` conta os openers malformados desses dois blocos no corpo do card.
  - Todo campo é propriedade enumerável comum (o `deepEqual` da Task 4 compara só enumeráveis; não use `Object.defineProperty` não enumerável no resultado da composição; `readBlocks` mantém o comportamento atual).
  - Papéis aceitos em `files`: `state`, `decisions`, `log`, `sources`, `requirements`, `measurements` (os demais são ignorados).

- [ ] **Step 1: Escrever os testes que falham**

Em `check-roadmap.test.mjs`, importar `* as fmt from '../../../lib/roadmap-format.mjs'` e adicionar:
- `roadmap-format module has no import, require, process, Buffer or crypto`: lê o arquivo do módulo, remove comentários `//...` e `/*...*/`, e afirma que não casa `/^\s*import\b|\bimport\s*\(|\brequire\s*\(|\b(?:process|Buffer|crypto)\b/m`.
- `roadmap-format parser functions match the checker`: para os textos do fixture `VALID` (lidos com `readFolder`), `fmt.readBlocks(t, n)` deepEqual `readBlocks(t, n)` do checker para `card`, `gates`, `panel`, `decisions`; `fmt.parseTable`, `fmt.scanFences` idem num caso com `\|` e um fence.
- `parseRoadmapTexts reads the valid fixture`: `version` deepEqual `{ _0: '1.0', _1: '2026-01-01' }`; `cards.map(c => c.id)` = `['E1','E2','E3']`; `cards[1].depends` = `['E1']`; `cards[0].acceptance.length === 2`; `cards[0].body` contém `Definition of done` e não contém `{verify:`; `blocks.state.panel.rows.length === 3` e `blocks.state.panel.present && blocks.state.panel.closed`; `blocks.state.pending.items` = `['(owner) Confirm the storage choice.']`; `blocks.strategy.gates.rows[0][0] === 'G1'`; `blocks.strategy.phases.present === false`; `blocks.measurements.measurements` deepEqual `{ present: false, closed: false, malformed: 0, rows: [] }`.
- `parseRoadmapTexts counts malformed openers and keeps raw rows`: estado com `<!-- roadmap:pending` sem `-->` antes do próximo comentário → `blocks.state.pending.malformed === 1`, `present === false`; painel com uma linha de 3 colunas → essa linha aparece crua em `rows`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL ao carregar (`Cannot find module ... roadmap-format.mjs`).

- [ ] **Step 3: Criar `plugins/productivity-tools/lib/roadmap-format.mjs`**

Copiar as funções listadas (corpo idêntico), acrescentar `export`, declarar `ROADMAP_BLOCKS` e escrever `parseRoadmapTexts` usando `readBlocks` (que já distingue `closed`/`malformed`). Comentários sem as palavras `process`, `Buffer`, `crypto`, `require` (nem em comentário, por clareza).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/lib/roadmap-format.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T1: módulo-fonte do parser do formato de roadmap" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: gerador de cópias embutidas (`scripts/embed.mjs`)

**Files:**
- Create: `plugins/productivity-tools/scripts/embed.mjs`
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: `plugins/productivity-tools/lib/roadmap-format.mjs` (Task 1), só para o teste de recusa sobre o módulo real.
- Produces:
  - `export function checkPureSource(text, name): string | null` → `null` se puro; senão mensagem que nomeia `name` e o termo achado. Remove comentários `//` e `/* */` antes de procurar `/^\s*import\b|\bimport\s*\(|\brequire\s*\(|\b(?:process|Buffer|crypto)\b/m` (strings não são removidas).
  - `export function embedText(targetText, readSource): string` (pura): normaliza `targetText` para LF; para cada par de marcadores `// <embed src="..." exports="keep|strip">` … `// </embed>`, substitui o miolo por `// Gerado de <src> por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.` + o texto da fonte em LF (sem BOM, terminado por uma `\n`), com `exports="strip"` removendo `export ` do início das declarações de topo (`/^export (?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm`). Lança `Error` (mensagem com o `src`) se a fonte não for pura, se um marcador não fechar ou se `exports` não for `keep`/`strip`. Devolve sempre LF; linhas fora dos marcadores ficam intactas.
  - `export function embedFile(targetPath, { check = false } = {}): { path, stale }`: `readSource(src)` resolve `src` relativo à pasta do destino; compara `embedText(...)` com o arquivo em LF; sem `check`, se defasado, grava convertendo para CRLF quando o arquivo original tem `\r\n`.
  - CLI `node plugins/productivity-tools/scripts/embed.mjs [--check] <destino>...`: exit 0 em dia ou reescrito; com `--check`, exit 1 e uma linha `stale: <destino>` por defasado, sem gravar; exit 2 com `embed: <mensagem>` em fonte impura, marcador inválido, arquivo inexistente ou sem destino. Guarda de execução direta igual à do checker (`isMain`).

- [ ] **Step 1: Escrever os testes que falham**

Em `check-roadmap.test.mjs`, importar `{ embedText, embedFile, checkPureSource }` de `../../../scripts/embed.mjs` e adicionar (destinos e fontes sintéticos em `tmp()`):
- `embed keep copies the source with exports`: destino `'// head\n// <embed src="src.mjs" exports="keep">\nold\n// </embed>\ntail\n'`, fonte `'export function f() { return 1; }\n'` → resultado contém a linha de aviso com `src.mjs`, contém `export function f()`, não contém `old`, começa por `// head` e termina por `tail\n`.
- `embed strip removes top-level export`: mesmo caso com `exports="strip"` → contém `function f()` e não contém `export function`.
- `embed refuses impure sources`: `checkPureSource` devolve mensagem para fontes com `import fs from 'node:fs';`, `const x = require('y');`, `process.env.X`, `Buffer.from('a')`, `crypto.randomUUID()`; devolve `null` para `// process is a word in a comment\nexport const a = 1;\n`; `embedText` lança com fonte impura.
- `the real roadmap-format module passes the purity check`: `checkPureSource(<texto do módulo>, 'roadmap-format.mjs') === null` (DEC-058).
- `embed keeps CRLF and compares in LF`: destino gravado em CRLF e já gerado (`embedText` aplicado e convertido para CRLF) → `embedFile(p, { check: true }).stale === false`; destino defasado em CRLF → `embedFile(p)` reescreve e o arquivo final contém `\r\n` e não contém `\n` solto (`/[^\r]\n/`).
- `embed --check exits 1 when stale and 0 when current`: via `spawnSync(process.execPath, [EMBED, '--check', p])`: defasado → status 1, stdout contém `stale:` e o arquivo não muda; depois de `embedFile(p)` → status 0. Sem argumentos → status 2.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL ao carregar (`Cannot find module ... embed.mjs`).

- [ ] **Step 3: Implementar `plugins/productivity-tools/scripts/embed.mjs`** com as assinaturas acima (imports só `node:`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T2: gerador de cópias embutidas com detecção de defasagem" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: checker lê pelo módulo embutido

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (linhas 25-258 e `checkRoadmap`, 467-560)
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: `parseRoadmapTexts`, `ROADMAP_BLOCKS` e as funções do parser (Task 1); `embedText`/`embedFile` e a CLI do gerador (Task 2).
- Produces: `export function parseRoadmap(roadmap)` = `parseRoadmapTexts({ strategy: roadmap.strategy, files: roadmap.files })`; o checker continua exportando `readBlocks`, `parseTable`, `scanFences`, `parseVerifyTag` (agora vindos do bloco embutido com `exports="keep"`) e todos os demais exports atuais.

- [ ] **Step 1: Escrever o teste que falha**

- `AC5: embedded parser copy is current`: `embedText(<texto do checker em LF>, (src) => <texto de path.resolve(here, src)>)` é igual ao texto do checker em LF, e o checker contém a linha `// <embed src="../../../lib/roadmap-format.mjs" exports="keep">`.
- `parseRoadmap equals parseRoadmapTexts on the valid fixture`: `parseRoadmap(loadRoadmap(VALID))` deepEqual `fmt.parseRoadmapTexts({ strategy, files })` com os textos lidos do fixture.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL nos dois testes novos (sem marcador; `parseRoadmap` não exportado); os demais passam.

- [ ] **Step 3: Substituir as cópias locais pelo bloco embutido**

Logo depois dos imports (a linha 1 fica acima e intocada), pôr os dois marcadores com `src="../../../lib/roadmap-format.mjs" exports="keep"`, apagar as definições locais que o módulo traz (sem deixar nome duplicado) e rodar `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`. Ficam no checker: `isEmptyCell`, `localIsoDate`, `blankCommandText` e o resto.

- [ ] **Step 4: `checkRoadmap` lê pela composição**

Chamar `parseRoadmap(r)` uma vez e trocar `blocksOf`/`firstBlock`/`tableRows`/`listItems` por leitores sobre `blocks[role][name]` e `cards`, emitindo `malformed-anchor` (uma vez por opener malformado), `missing-block` (só quando `!present && malformed === 0` e o arquivo não é `null`), `unclosed-block` e `bad-row` com as mesmas mensagens e na mesma ordem de hoje (versão, openers de card, por card: fechamento, `acceptance`, `risks`; depois `gates`, `panel`, `blockers`, `inflight`, `donot`, `releases`, `now`, `pending`, `decisions`, `log`, `sources`, `conflicts`, `requirements`, `measurements`). Exportar `parseRoadmap`.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas (todos os testes antigos sem mudança de expectativa).
Run: `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`
Expected: exit 0.
Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`
Expected: `check-roadmap: 0 error(s), 0 warning(s)`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T3: checker lê blocos pelo módulo-fonte embutido" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: preflight importa o módulo e expõe `readRoadmapStructure`

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` (linhas 52-153)
- Test: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`

**Interfaces:**
- Consumes: `parseRoadmapTexts` (Task 1); `parseRoadmap`, `loadRoadmap` do checker (Task 3).
- Produces: `export function readRoadmapStructure(folder): ReturnType<parseRoadmapTexts>`: lê `roadmap.config.json`, a estratégia (`config.strategy`, relativa à pasta) e os arquivos de `config.files` (um valor `null` vira `null`), com BOM removido e CRLF tratado como hoje, e devolve `parseRoadmapTexts({ strategy, files })`. `parseGatesTable(markdown, warnings)` mantém assinatura, mensagens e resultado.

- [ ] **Step 1: Escrever o teste que falha**

Em `preflight.test.mjs`, importar `readRoadmapStructure` e `{ parseRoadmap, loadRoadmap }` do checker e adicionar:
- `AC4: preflight and checker read the same blocks and rows`: `VALID = join(<pasta do teste>, '..', '..', 'roadmap-tracker', 'scripts', 'fixtures', 'valid')`; `assert.deepEqual(readRoadmapStructure(VALID), parseRoadmap(loadRoadmap(VALID)))`; e afirma `cards.length === 3` e `blocks.state.panel.rows.length === 3` (para o deepEqual não passar com dois resultados vazios).
- `preflight carries no copy of the parser`: o texto de `preflight.mjs` não contém `function blankFences`, `function splitRow`, `function scanComments` nem `function firstBlockBody`, e contém `lib/roadmap-format.mjs`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`
Expected: FAIL nos dois testes novos (`readRoadmapStructure` não exportada; cópias presentes).

- [ ] **Step 3: Trocar as cópias pela importação**

`import { parseRoadmapTexts } from '../../../lib/roadmap-format.mjs';`, apagar `blankFences`, `splitRow`, `scanComments`, `firstBlockBody`. `parseGatesTable` lê `parseRoadmapTexts({ strategy: markdown, files: {} }).blocks.strategy.gates`; devolve `[]` quando `!present || !closed || malformed > 0`; aplica às `rows` as regras atuais (pula `r.length === 1 && r[0] === ''`, linha com contagem diferente de 5 vai para `warnings` com a mesma mensagem, comando vazio, `-` ou `—` descartado como hoje). Implementar `readRoadmapStructure`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`
Expected: PASS, 0 falhas (testes antigos sem mudança de expectativa).

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs
git commit -m "E2 T4: preflight importa o módulo-fonte e expõe readRoadmapStructure" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: oito checagens novas de configuração, estado, fontes e decisões

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (`checkRoadmap`)
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: `parseRoadmap(r)`, `parseStatus`, `stripNote`, `idsIn` (Tasks 1 e 3); `r.config`, `r.files`, `r.strategy`.
- Produces: avisos `status-order`, `pending-no-owner`, `state-header`, `blocked-no-blq`, `blocker-no-restore`, `source-uncited`, `strategy-plan-suffix`, `executor-decision-pending`, todos com `add('warning', '<código>', <arquivo>, <mensagem>)` (o teste da Task 8 extrai os códigos por esse padrão), emitidos depois de todas as checagens atuais (a ordem das antigas não muda).

Regras (do spec, seção Peça 3; `blocked` = `vocab.blockedStatus` ou `'blocked'`, `discarded` = `vocab.discardedStatus` ou `'discarded'`, `released` = `vocab.releasedStatuses` ou `['released','measured']`; posições contam a partir de 1):
- `status-order` (arquivo `roadmap.config.json`): `deliverableStatuses` com menos de 8 palavras; palavra de `integratedStatuses` fora das posições 6-8; de `released` fora de 7-8; `blocked` presente fora da 9; `discarded` presente fora da 10. Uma mensagem por violação.
- `pending-no-owner` (estado): item de `pending` que não casa `/^\(\s*[^)\s][^)]*\)/`.
- `state-header` (estado): texto de `state.md` antes do primeiro `<!-- roadmap:` (o arquivo todo se não houver) não contém `v<versão>` como palavra inteira, onde versão = `version._0`; não roda sem `version`.
- `blocked-no-blq` (estado): só se `blocked` está em `deliverableStatuses`; segmento do painel (separado por `;`) cuja palavra de status é `blocked`, sem `BLQ-\d+` na nota do segmento nem na coluna Próximo passo.
- `blocker-no-restore` (estado): para cada linha de `blockers` e cada `E<n>` da coluna Afeta cujo painel tem segmento `blocked`: a célula "Desbloqueia quando" não casa `E<n>` como palavra inteira seguido, mais adiante na célula, de uma palavra de `deliverableStatuses` diferente de `blocked`.
- `source-uncited` (fontes): `SRC-NN` definido em `sources` que não aparece como palavra inteira em nenhum de estratégia, requisitos, decisões, estado, log, caminho crítico, medições (mesmo texto que a varredura de `unknown-id` usa: fences em branco exceto mermaid, comandos em branco na estratégia).
- `strategy-plan-suffix` (`roadmap.config.json`): `config.strategy` casa `/-plan\.md$/i`.
- `executor-decision-pending` (decisões): linha com Origem (col 8) `executor` e Status (col 9) igual a `decisionPending`; alcance = última frase da Decisão (col 4): `Alcance: local.`/`Scope: local.` → local; `Alcance: contrato.`/`Scope: contract.` ou ausente → contrato. Aviso se (a) contrato e algum card que depende de um `E<n>` da coluna Entregável (col 3) tem segmento de status nas posições 2-8; ou (b) o `E<n>` da coluna Entregável tem segmento em `released`.

- [ ] **Step 1: Escrever os testes que falham** (um por código, com `fixture(mutate)` e `expectCode(run(dir), '<código>', 'warning')`, e o par limpo com `assert.ok(!codes(run(dir)).includes('<código>'))`):
- `status-order`: em `roadmap.config.json` trocar `"blocked", "discarded"` por `"discarded", "blocked"` → 2 avisos `status-order`.
- `pending-no-owner`: `- (owner) Confirm the storage choice.` → `- Confirm the storage choice.`.
- `state-header`: `Strategy v1.0 -- 2026-01-01` → `Strategy v0.9 -- 2026-01-01`.
- `blocked-no-blq`: no painel `| E3 | not-started | - | Wait for E2 |` → `| E3 | blocked | - | Wait for E2 |`; limpo: `| E3 | blocked (BLQ-1) | - | Wait for E2 |` com a linha `| BLQ-1 | Storage vendor undecided | E3 | 2026-01-02 | the owner picks a vendor; restores E3 to not-started |` em `blockers`.
- `blocker-no-restore`: o mesmo par, com a célula `the owner picks a vendor` (sem restauração) → aviso; com `...; restaura E3 a not-started` → sem aviso (independe do idioma).
- `source-uncited`: acrescentar `| SRC-03 | \`docs/extra.md\` | Extra notes | 2026-01-01 | Informal |` à tabela `sources` → aviso citando `SRC-03`.
- `strategy-plan-suffix`: renomear `strategy.md` para `roadmap-plan.md` nos `files` do helper e em `"strategy"` da config.
- `executor-decision-pending`: acrescentar `| DEC-002 | 2026-01-03 | E1 | Items are stored as JSON files. Alcance: contrato. | A database | - | Volume grows | executor | pending |` e mudar E2 no painel para `plan` → aviso; com `Scope: contract.` → aviso; com `Alcance: local.` → sem aviso; com `Alcance: local.` e E1 `released` (com SHA na Evidência e bloco `releases` ausente) → aviso.
- Rodar também o teste existente `localized accented vocabulary` (deve continuar `[]`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL nos testes dos oito códigos; os demais passam.

- [ ] **Step 3: Implementar as oito checagens** em `checkRoadmap`, depois das atuais.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.
Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`
Expected: `0 error(s), 0 warning(s)`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T5: checagens novas de status, estado, fontes e decisões do executor" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: checagens de fase e definição de pronto, fixture com `roadmap:phases`, aceite 1 e 2

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (`checkRoadmap`)
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid/strategy.md` (seção Phases)
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: `blocks.strategy.phases`, `blocks.strategy.gates`, `cards[].attrs.phase`, `cards[].depends`, `cards[].acceptance[].tag.kind`, `cards[].body`, `EXECUTABLE_KINDS` (Tasks 1 e 3); as checagens da Task 5.
- Produces: avisos `card-phase-table`, `phase-order`, `dod-no-gate` (arquivo: a estratégia).

Regras:
- `card-phase-table` (só com `phases.present`): `E<n>` da coluna 4 de cada linha; card ausente de toda linha; card em mais de uma linha; linha cujos cards têm `attrs.phase` diferentes; duas linhas cujos cards têm o mesmo `phase`. Uma mensagem por caso.
- `phase-order` (só com `phases.present`): card que depende de outro cuja linha vem depois na tabela.
- `dod-no-gate` (só quando `gates` tem ao menos uma linha): card com ao menos um critério de tipo em `EXECUTABLE_KINDS` cujo `body` não cita, como palavra inteira, nenhum ID da coluna 1 de `gates`.

- [ ] **Step 1: Escrever os testes que falham**
- `card-phase-table`: na linha 2 do bloco de fases, `| E2, E3 |` → `| E2 |` → aviso citando E3. Limpo: o fixture.
- `phase-order`: trocar a ordem das duas linhas do bloco de fases → aviso (E2 depende de E1, cuja linha vem depois).
- `phase checks need the phases block`: o fixture sem os comentários `roadmap:phases` e com a mesma mutação de `card-phase-table` → nenhum dos dois códigos.
- `dod-no-gate`: no card E1, `Definition of done: acceptance passes in the integration branch; G1 and G2 green.` (primeira ocorrência) → `...; all checks green.` → aviso citando E1.
- `dod-no-gate ignores gate ids inside acceptance`: a mesma mutação e um item de aceite de E1 terminando em `{verify: test; evidence: G1}` → aviso continua.
- `dod-no-gate skips human-only cards`: E2 com os dois critérios `{verify: human; ...}` e DoD sem gate → sem aviso para E2.
- `AC1: one defect of each new check emits its named code`: uma pasta com as onze mutações das Tasks 5 e 6 juntas (helper `allNewDefects(files)`, reusando as mesmas substituições: `phase-order` pela troca das linhas e depois `card-phase-table` por `| E2, E3 |` → `| E2 |`; E3 `blocked` sem `BLQ` no painel junto com a linha `BLQ-1` sem restauração em `blockers`, o que dispara `blocked-no-blq` e `blocker-no-restore`; a troca do nome da estratégia por último) → cada um dos onze códigos aparece em `codes(run(dir))`.
- `AC2: a pre-1.7 folder and a folder with every new defect stay at exit 0 with warnings only`: (a) fixture sem os comentários `roadmap:phases` e sem a linha `Strategy v1.0 -- 2026-01-01`; (b) a pasta de `allNewDefects`. Para cada uma: `cli([dir]).status === 0`, e nenhum problema com código em `NEW_CODES` (lista dos onze) tem `severity === 'error'`.
- Rodar também `localized accented vocabulary` e `valid fixture has no problems` (devem continuar `[]`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL nos testes novos (códigos ausentes; mutação do bloco de fases não acha `roadmap:phases`).

- [ ] **Step 3: Envolver a tabela de fases do fixture** em `<!-- roadmap:phases -->` … `<!-- /roadmap:phases -->` (tabela inalterada) e implementar as três checagens.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.
Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`
Expected: `0 error(s), 0 warning(s)`, exit 0 (G4).

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid/strategy.md
git commit -m "E2 T6: checagens de fase e definição de pronto; fixture com roadmap:phases" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 7: saída `--json` do checker

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (`main`, linhas 907-953, e o `catch` de `isMain`)
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: `checkRoadmap`, `loadRoadmap`, `createGitAdapter`, `findNewerPluginCopy`, o helper `cli()` dos testes.
- Produces: com `--json`, stdout é só `JSON.stringify(obj)` (uma linha), `obj = { checker, format, errors, warnings, summary: { errors, warnings, exitCode } }`, itens `{ code, file, message }` na mesma ordem do modo texto. `bad-header` → `checker: null, format: null`, erro `{ code: 'bad-header', file: <basename>, message }`, exit 1. `config:` → erro `{ code: 'config', file: 'roadmap.config.json', message: <mensagem sem o prefixo "config: "> }`, exit 1. Falha interna → erro `{ code: 'internal', file: <basename>, message: <primeira linha> }`, exit 2, sem pilha. `checker-stale` em `warnings`. `--version` continua texto. Sem `--json`, a saída de texto é idêntica à atual.

- [ ] **Step 1: Escrever os testes que falham** (`AC3: --json matches text mode counts and exit code`, com subtestes):
- pasta válida: `JSON.parse(cli([VALID,'--json']).stdout)` tem `checker === '1.5.0'`, `format === 1`, `summary` `{ errors: 0, warnings: 0, exitCode: 0 }`, status 0.
- pasta com erro (`fixture` com `bad-status`, como o teste existente) e pasta com aviso (`pending-no-owner`): contagens do JSON iguais às da linha `check-roadmap: N error(s), M warning(s)` do modo texto na mesma pasta; `status` igual nos dois modos; os pares `code` do JSON na mesma ordem dos `[code]` do texto.
- config inválida (como o teste `loadRoadmap throws config: on invalid config`): JSON com um erro `config`, `summary.exitCode === 1`, status 1 nos dois modos.
- falha forçada (`env: { ROADMAP_CHECK_SELFTEST_THROW: '1' }`): JSON com um erro `internal`, sem `\n    at ` na mensagem, status 2 nos dois modos.
- `--version --json` imprime `1.5.0 format 1`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL nos subtestes de AC3 (`Unexpected token` ao fazer `JSON.parse` da saída de texto).

- [ ] **Step 3: Implementar `--json` em `main`** (e no `catch` de `isMain` quando `process.argv` tem `--json`), sem mudar o modo texto.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T7: saída --json do checker" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 8: contrato de formato, regras do repositório, aceite 5 e gates

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-planner/references/formats.md` (§1, §2, §3, §5, §6, §9)
- Modify: `.claude/rules/roadmap-checker.md`
- Modify: `CLAUDE.md` (seção Layout)
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: todos os códigos emitidos pelo checker (Tasks 3, 5, 6, 7); o formato `--json` (Task 7).

- [ ] **Step 1: Escrever o teste que falha**

- `AC5: every code the checker emits is documented in formats.md section 9`: extrai do texto do checker os códigos de `/add\([^,()]+,\s*'([a-z0-9-]+)'/g` e `/code: '([a-z0-9-]+)'/g`, mais `config`, `bad-header`, `internal`; pega em `formats.md` o trecho de `## 9.` até o fim; cada código aparece nele como `` `<código>` ``. Também afirma que o trecho contém `--json` e `since 1.7.0`.
- `AC5: valid fixture is clean`: `run(fixture())` deepEqual `[]` e `cli([VALID]).stdout` contém `0 error(s), 0 warning(s)` (reforço explícito do teste antigo).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: FAIL em `AC5: every code ...` (os onze códigos novos e `--json` ausentes de §9).

- [ ] **Step 3: Atualizar `formats.md`**
- §1: sufixo `-plan.md` no nome do arquivo da estratégia gera `strategy-plan-suffix`.
- §2: a frase "The checker does not verify the order" passa a dizer que a ordem é conferida por `status-order` (aviso).
- §3: linha `strategy (optional) | phases | Phase, Entry criteria, Exit criteria, Deliverables` na tabela de blocos.
- §5: o esqueleto da estratégia envolve a tabela de fases com `<!-- roadmap:phases -->`; regra: a definição de pronto de um card com critério executável cita um ID de gate (`dod-no-gate`); fases conferidas por `card-phase-table` e `phase-order` só com o bloco (adoção).
- §6: cabeçalho do estado (`state-header`), dono no pendente (`pending-no-owner`), segmento bloqueado (`blocked-no-blq`) e texto de restauração (`blocker-no-restore`) passam de "not checked" a aviso; decisão do executor pendente (`executor-decision-pending`, alcance `Alcance:`/`Scope:`).
- §9: uso `node check-roadmap.mjs [folder] [--require-git] [--json]`, o formato do objeto JSON (seção Global Constraints deste plano) e a regra de exit igual ao texto; em Warnings, item "since 1.7.0" com os onze códigos, cada um com uma frase.

- [ ] **Step 4: Regras do repositório**
- `.claude/rules/roadmap-checker.md`: uma linha: o parser vive em `plugins/productivity-tools/lib/roadmap-format.mjs`; edita-se a fonte e roda-se `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (`--check` acusa cópia defasada); a subida da linha 1 é feita no preparo da publicação, na branch de release (DEC-042).
- `CLAUDE.md`, Layout, sob `plugins/<name>/`: linha `lib/` (módulos-fonte puros embutidos em scripts por `scripts/embed.mjs`; hoje `productivity-tools/lib/roadmap-format.mjs`) e, na linha `scripts/`, menção a `embed.mjs`.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`
Expected: PASS, 0 falhas.

- [ ] **Step 6: Verificação fora dos testes (só leitura)**

Run: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs docs/plans/roadmap-evolucao-skills`
Expected: exit 0 (nenhum erro novo). Copiar os avisos novos para o relatório final da tarefa (texto da resposta, não arquivo), para o tracker e o dono decidirem. Nenhum arquivo dessa pasta é editado.
Run: `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`
Expected: exit 0.

- [ ] **Step 7: Gates canônicos** (a partir de `D:/projects/claude-play-wt/E2`)
- G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, 0 falhas, total acima de 847 (linha de base do alvo: 847, nenhuma falha pré-existente).
- G2: `claude plugin validate .` → exit 0.
- G3: `claude plugin validate plugins/productivity-tools` → exit 0.
- G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0.
- G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-planner/references/formats.md .claude/rules/roadmap-checker.md CLAUDE.md plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
git commit -m "E2 T8: contrato de formato e regras do repositório com os códigos novos" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Roteamento por tarefa

| Tarefa | tier | reviewTier | external | needsLock | Navegador | Depende de |
|---|---|---|---|---|---|---|
| T1 | sonnet | sonnet | false | (nenhum) | não | - |
| T2 | sonnet | sonnet | false | (nenhum) | não | T1 |
| T3 | sonnet | sonnet | false | (nenhum) | não | T1, T2 |
| T4 | sonnet | sonnet | false | (nenhum) | não | T3 |
| T5 | sonnet | sonnet | false | (nenhum) | não | T3 |
| T6 | sonnet | sonnet | false | (nenhum) | não | T5 |
| T7 | sonnet | sonnet | false | (nenhum) | não | T3 |
| T8 | sonnet | sonnet | false | (nenhum) | não | T4, T6, T7 |

Pontuação (routing.md): escopo 1, ambiguidade 0-1 (assinaturas e regras fixadas aqui e no spec), raciocínio 1-2 (T3 reescreve a leitura de blocos mantendo ordem de emissão), raio de impacto 1 (código interno compartilhado e checker vendorizado, sem autenticação, segredo, produção, migração nem push), verificabilidade 0 (testes) → 3-5, sonnet. Nenhuma tarefa tem ambiguidade e raio altos juntos; nenhuma tem raio 2, então todo revisor é sonnet. T5, T6 e T7 tocam o mesmo `check-roadmap.mjs` e `check-roadmap.test.mjs`: rodam em sequência (T5 → T6 → T7 ou T7 depois de T6), nunca em paralelo.

Nenhuma tarefa tem efeito externo (nenhum push, publicação, escrita em dado compartilhado nem leitura de produção), então nenhuma declara `externalDedupe`. A leitura de `docs/plans/roadmap-evolucao-skills/` na Task 8 é local e só de leitura. Nenhum passo depende de navegador ou de algo fora deste ambiente; todo passo é exercitado aqui pelos testes e comandos listados.

## Acceptance criteria evidence

| ac | kind | command | testRef | blq | external |
|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs | check-roadmap.test.mjs: "AC1: one defect of each new check emits its named code" e os testes por código das Tasks 5 e 6 | | false |
| AC2 | test | node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs | check-roadmap.test.mjs: "AC2: a pre-1.7 folder and a folder with every new defect stay at exit 0 with warnings only" | | false |
| AC3 | test | node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs | check-roadmap.test.mjs: "AC3: --json matches text mode counts and exit code" | | false |
| AC4 | test | node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs | preflight.test.mjs: "AC4: preflight and checker read the same blocks and rows" | | false |
| AC5 | test | node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs | check-roadmap.test.mjs: "AC5: valid fixture is clean", "AC5: every code the checker emits is documented in formats.md section 9", "AC5: embedded parser copy is current" | | false |

Todos os comandos são os das tags `{verify: test; ...}` do card, mantidos. Cada um sai 0 só se todos os testes do arquivo passam, incluindo os nomeados em testRef. Nenhum é externo (só lê arquivos da branch e escreve em pastas temporárias do sistema).

## Decisões autônomas deste plano (Origem executor, status pendente)

1. O resultado de `parseRoadmapTexts` acrescenta ao desenho do spec: `malformed` como contagem (para o checker repetir `malformed-anchor` uma vez por opener, como hoje), `blocks.strategy.version`, `blocks.strategy.card`, e em cada card `closed` e `malformed: { acceptance, risks }`. Alcance: contrato.
2. `parseGatesTable` do preflight devolve `[]` quando há qualquer opener `gates` malformado (hoje só quando o primeiro opener é malformado); o checker já dá erro `malformed-anchor` nesse caso. Alcance: local.
3. As checagens novas são emitidas depois de todas as atuais, para não mudar a ordem das antigas no texto e no `--json`. Alcance: local.
4. `source-uncited` usa o mesmo texto da varredura de `unknown-id` (fences e comandos em branco). Alcance: local.
5. No `--json`, a mensagem do erro `config` vem sem o prefixo `config: ` e o arquivo é `roadmap.config.json`; `bad-header` e `internal` usam o nome do arquivo do checker. Alcance: contrato.
