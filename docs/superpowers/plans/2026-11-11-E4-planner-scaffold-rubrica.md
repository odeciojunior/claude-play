# E4 -- Planner com scaffold e revisão com rubrica: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** um modelo estruturado `planning-model.json` que é também o rascunho de retomada, um scaffold determinístico que gera a pasta de roadmap e a estratégia v1.0 a partir dele, e um revisor com rubrica e saída estruturada, com a prosa carregável do planner abaixo de 43.335 bytes LF.

**Arquitetura:** `roadmap-planner/scripts/scaffold.mjs` exporta funções puras (validar e completar o modelo, derivar grafo, caminho crítico e cobertura, renderizar cada arquivo, conferir no checker em memória) e uma CLI que só grava quando o checker dá 0 erros. A skill grava o modelo depois de cada passo, chama o scaffold no passo 6 e despacha o revisor com `references/review-rubric.md` no passo 7, em até três rodadas. O contexto principal deixa de ler `formats.md` inteiro.

**Tecnologia:** Node >= 18 (medido: v22.17.1), ESM, sem dependências, `node:test`; git só para leitura (via `createGitAdapter` do checker).

**Spec:** `docs/superpowers/specs/2026-11-11-E4-planner-scaffold-rubrica-design.md` (ler junto com este plano; as seções "O modelo", "O que o scaffold deriva", "CLI e saída", "Rubrica" e "Meta derivada de prosa" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell, `core.autocrlf=true` (checkouts CRLF), Node v22.17.1, claude CLI 2.1.322. Os testes nunca dependem do final de linha do checkout: leem com `.replace(/\r\n?/g, '\n')` e o scaffold escreve sempre LF.
- Worktree `D:/projects/claude-play-wt/E4`, branch `feat/E4`. Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E4/` (criar e apagar no fim da tarefa) ou em `fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'))` dentro dos testes, removidos em `t.after`.
- Não editar `docs/plans/roadmap-evolucao-skills/`, a estratégia, `plugins/_template/`, `roadmap-tracker/` (checker, CLI, SKILL, `events.md`) nem `lib/`. Não regenerar o checker. Não subir a versão de `productivity-tools` nem a linha 1 do checker (`// check-roadmap 1.5.0 format 1`; DEC-042). `formatVersion` continua 1.
- `scaffold.mjs` importa de `../../../lib/roadmap-format.mjs` e de `../../roadmap-tracker/scripts/check-roadmap.mjs` (`checkRoadmap`, `validateConfig`, `createGitAdapter`, `FORMAT_VERSION`), como `roadmap.mjs` faz; `main` só roda quando é o processo principal (mesma guarda `realpathSync.native` de `roadmap.mjs` linha ~1169).
- O scaffold nunca lê stdin, nunca pergunta, nunca chama git para escrever, nunca commita, nunca apaga o modelo, nunca escreve prosa que o modelo não traz (só estrutura derivada e os textos de "nenhum"/padrão listados em `defaulted`).
- Códigos de saída: 0 gerado (avisos não mudam o código); 1 recusado sem gravar nada; 2 uso ou falha de gravação. `--json` dá o mesmo código.
- Frase de "nenhum" e tamanho padrão por idioma: `language` começando com `pt` → "Nenhuma." e "não estimado"; o resto → "None." e "not estimated". Vocabulário padrão `pt*` = constante `VOCAB_PT` copiada de `docs/plans/roadmap-evolucao-skills/roadmap.config.json` (bloco `vocab` inteiro, sem ler o arquivo em tempo de execução); demais idiomas = `VOCAB_EN` do exemplo de `formats.md` §2. `limits` padrão `{nowItems: 5, cellChars: 300, pendingItems: 20}`; `tracks` padrão `["engineering", "decisions", "external", "release", "measurement"]`.
- Títulos de seção da estratégia: `en` exatamente os de `formats.md` §5; `pt` = Changelog, Objetivo, Não objetivos, Premissas, Onde estamos, Tese, Visão geral dos entregáveis, Fases, Entregáveis, Gates e verificação, Métricas e metas, Flags, Riscos transversais, Decisões, Pendências externas, Questões em aberto, Resumo de cobertura, Histórico de versões, Fontes (constante `HEADINGS` no script). Os demais arquivos seguem os títulos de `formats.md` §6-8, traduzidos no mesmo estilo para `pt`.
- Commits: `E4 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (linha de base do alvo: G1 exit 0, 1051 testes, nenhum falhando; G2-G5 exit 0; nenhuma falha é esperada em nenhuma tarefa):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total ≥ 1051, failing 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
- Nenhuma tarefa precisa de navegador, de servidor (faixa de portas 5250-5259 não usada), de lock, de credencial, nem tem efeito externo. Todas rodam na worktree do entregável antes do merge.
- Quando um passo não puder ser exercido neste ambiente (ex.: git ausente do PATH num teste), a evidência aceitável é o caso pulado com `t.skip('<motivo>')` explícito e o resto da suíte verde; na Tarefa 9, se o executor não tiver ferramenta de subagent, o orquestrador despacha o revisor e passa a saída literal ao executor.

## Foco da revisão

1. `planning-model.json` gravado com BOM UTF-8 ou CRLF (a ferramenta de escrita no Windows): o scaffold remove o BOM antes de `JSON.parse` e gera os mesmos bytes que sem BOM; teste na Tarefa 5.
2. Texto do modelo com `|` ou quebra de linha que vai para célula de tabela (requisito, título, decisão): `|` sai como `\|` e o texto relido pelo parser é igual ao do modelo; quebra de linha em valor de célula é recusa `multiline-cell` com o caminho JSON, sem gravar; teste na Tarefa 3.
3. Ids fora de ordem ou com dois dígitos (`E10` antes de `E2` no modelo): "primeira cadeia máxima em ordem de id" e a ordem das linhas usam ordem numérica (`E2` < `E10`), nunca lexicográfica; teste na Tarefa 2.
4. Caminho do modelo relativo, com espaço, e `cwd` diferente da pasta: a CLI resolve tudo a partir do diretório do modelo; teste na Tarefa 5 (pasta temporária com espaço no nome, `cwd` = `os.tmpdir()`).
5. Passo 6 interrompido (pasta com config e modelo) e rodada repetida: a segunda execução regrava a pasta inteira com os mesmos bytes, não apaga arquivo que não gerou e não toca no modelo; teste na Tarefa 5.

---

## Mapa de arquivos

Prefixo `P` = `plugins/productivity-tools/skills/roadmap-planner`.

| Arquivo | Responsabilidade | Tarefas |
|---|---|---|
| `P/scripts/scaffold.mjs` (novo) | validação, padrões, derivações, renderização, checker em memória, CLI | 1-5 |
| `P/scripts/scaffold.test.mjs` (novo) | testes dos critérios 1 e 2, recusas, determinismo, fixture plantada | 1-5, 7 |
| `P/scripts/fixtures/model-full.json`, `model-mid.json` (novos) | modelos de exemplo | 1 |
| `P/references/model.md` (novo) | contrato do modelo | 6 |
| `P/SKILL.md` | passos 0, 1-5, 6 (T6); passo 7 (T7); cortes (T8) | 6, 7, 8 |
| `P/references/formats.md` | só a linha `planning-draft.md` do layout §1 | 6 |
| `P/references/review-rubric.md` (novo) | rubrica do revisor | 7, (9) |
| `P/scripts/fixtures/review-planted/` (novo) | pasta com três defeitos plantados + `expected-findings.json` | 7 |
| `P/references/decompose.md`, `clarify.md` | exemplos trabalhados, §13 aponta o scaffold, cortes | 8 |
| `P/scripts/prose-budget.test.mjs` (novo) | orçamento de prosa (critério 3) | 8 |
| `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` (novo) | registro comportamental (critério 4) | 9 |

As tarefas são sequenciais (1-5 e 7 tocam `scaffold.test.mjs`; 6, 7 e 8 tocam `SKILL.md`); nenhuma roda em paralelo.

---

### Tarefa 1: validação do modelo, padrões e fixtures

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`
- Criar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`
- Criar: `plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/model-full.json`
- Criar: `plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/model-mid.json`

**Interfaces:**
- Produz, exportadas de `scaffold.mjs`:
  - `validateModel(model: object) -> Array<{ path: string, code: string, message: string }>`: `path` é o caminho JSON (`deliverables[2].acceptance[0].verify`). Códigos: `model-version` (`modelVersion` ≠ 1), `required` (campo obrigatório ausente ou vazio, lista da spec "Obrigatórios"), `duplicate-id` (REQ, E, SRC, DEC, BLQ), `unknown-dependency`, `cycle` (mensagem com a cadeia), `unknown-req`, `unknown-phase`, `unknown-track`, `acceptance-min` (< 2 critérios), `verify-missing` (critério sem `verify` ou `kind` fora de `VERIFY_KINDS`), `verify-blocked-no-blq`. Lista vazia = válido.
  - `applyDefaults(model) -> { model: object, defaulted: Array<{ path: string, value: unknown }> }`: não muta a entrada; aplica os padrões de "O modelo" da spec (vocab, tracks, limits, files, `strategyPath`, priority, size, track, seções de prosa "nenhum", `now`, `pending`) e só para campos ausentes; um `critical` presente em card é removido e listado com `value: 'ignored (derived)'`.
  - Constantes exportadas: `VOCAB_PT`, `VOCAB_EN`, `DEFAULT_TRACKS`, `DEFAULT_LIMITS`, `HEADINGS` (`{ en: {...}, pt: {...} }`).
- Fixtures: `model-full.json` = modo `full`, `language: "en"`, ≥5 cards com um losango (`E2` e `E3` dependem de `E1`, `E4` de ambos) e um card isolado, um `blockers[]` com `BLQ-1` bloqueando um card, `gates[]` (G1-G2 com comandos do próprio fixture), `measurements[]`, `questions`, `sources`, `decisions`. `model-mid.json` = `language: "pt-BR"`, `nextStep: 6`, base, `sources`, `questions` com respostas, `requirements`, `phases`, `deliverables` (cada um só com `id`, `title`, `phase`, `depends`, `reqs`, `why`, `acceptance` com `verify`), sem `gates`, `now`, `pending`, `priority`, `size`, `track`, `objective` em prosa, `thesis`. Datas fixas `2026-01-01`; nada de dados reais (fixture sintética).

- [ ] **Passo 1: testes que falham** em `scaffold.test.mjs` (`describe('validateModel')`, `describe('applyDefaults')`):
  - `validateModel` de cada fixture → `[]`.
  - Variações construídas por código a partir de `model-full.json` (`structuredClone`): `modelVersion: 2` → código `model-version`; sem `topic` → `required` em `topic`; `E1` duplicado → `duplicate-id`; `depends: ['E99']` → `unknown-dependency` em `deliverables[i].depends[0]`; `E1→E2→E1` → `cycle`; `reqs: ['REQ-999']` → `unknown-req`; `phase` inexistente → `unknown-phase`; `track` fora de `tracks` → `unknown-track`; um critério só → `acceptance-min`; critério sem `verify` → `verify-missing`.
  - `applyDefaults(model-mid)`: `defaulted` contém `deliverables[0].priority` com `'Must'`, `deliverables[0].size` com `'não estimado'`, `deliverables[0].track` com `'engineering'`, `vocab` com `VOCAB_PT`, `gates`; não contém nenhum caminho que exista em `model-mid.json` (conferido percorrendo o JSON); a entrada não muda (`deepStrictEqual` com a cópia anterior).
  - `applyDefaults` com `critical: true` num card → card sem `critical` e item `value: 'ignored (derived)'`.

- [ ] **Passo 2: rodar e ver falhar**
  Rodar: `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`
  Esperado: FAIL (módulo `scaffold.mjs` não existe).

- [ ] **Passo 3: implementar** `validateModel`, `applyDefaults` e as constantes em `scaffold.mjs` (detecção de ciclo por DFS com cores; ordem das mensagens estável: na ordem dos campos do modelo).

- [ ] **Passo 4: verificar** — o comando do Passo 2 → PASS; G1 → exit 0, failing 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/model-full.json plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/model-mid.json
git commit -m "E4 T1: validação do modelo de planejamento, padrões e fixtures" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 2: grafo, caminho crítico e cobertura

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`

**Interfaces:**
- Consome: modelo já passado por `applyDefaults` (Tarefa 1).
- Produz:
  - `compareIds(a: string, b: string) -> number`: ordem por prefixo e depois numérica (`E2` < `E10`, `REQ-002` < `REQ-010`).
  - `deriveGraph(deliverables) -> { edges: Array<[string, string]>, longest: number, critical: Set<string>, chain: string[] }`: `edges` = `[dep, card]` para cada dependência declarada, ordenadas por `compareIds`; `longest` = número de cards na maior cadeia; `critical` = cards que estão em alguma cadeia de comprimento `longest`; `chain` = a primeira cadeia máxima em ordem de id (comparar cadeias elemento a elemento com `compareIds`). Card isolado é cadeia de comprimento 1.
  - `deriveCoverage(requirements, deliverables, vocab) -> { rows: Array<{ id, deliverables: string[], coverage: string }>, summary: { covered: number, outOfScope: number, needsClarification: number } }`: `deliverables` = cards cujo `reqs` cita o REQ (ordem `compareIds`); `coverage` = palavra do vocab (`coverageCovered` se não há `coverage` no requisito; senão `coverageOutOfScope: <motivo>` ou `coverageNeedsClarification` conforme o modelo).

- [ ] **Passo 1: testes que falham** (`describe('deriveGraph')`, `describe('deriveCoverage')`):
  - `model-full`: `edges` igual exatamente ao conjunto `{[d, c.id] para cada c e d em c.depends}`; `critical` = cards da maior cadeia do losango (`E1`, `E2`, `E3`, `E4` quando `E2` e `E3` empatam), card isolado fora; `chain` começa em `E1`, passa por `E2` (empate resolvido por id) e termina em `E4`.
  - Modelo construído no teste com `E10 → E11` e `E2 → E3` (empate de comprimento 2, `E10` aparece antes no array): `chain` = `['E2', 'E3']`; os quatro em `critical`.
  - `compareIds('E2', 'E10') < 0`.
  - `deriveCoverage` em `model-full`: cada linha bate com a inversão dos `reqs` dos cards; um requisito com `coverage: {kind: 'out-of-scope', reason}` sai com a palavra e o motivo; `summary` conta.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → FAIL (`deriveGraph` não exportada).

- [ ] **Passo 3: implementar** as três funções (cadeia mais longa por programação dinâmica sobre a ordem topológica, comprimento para frente e para trás; card crítico quando `forward + backward - 1 === longest`).

- [ ] **Passo 4: verificar** — o comando do Passo 2 → PASS; G1 → exit 0, failing 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs
git commit -m "E4 T2: grafo de dependências, caminho crítico e cobertura derivados" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 3: renderização dos arquivos da pasta

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`

**Interfaces:**
- Consome: `deriveGraph`, `deriveCoverage`, `compareIds`, `HEADINGS`, `VOCAB_*` (Tarefas 1-2).
- Produz:
  - `cell(text: string, path: string) -> string`: escapa `|` como `\|`; lança `ScaffoldError` com `{ path, code: 'multiline-cell' }` quando o texto tem `\n` ou `\r`.
  - `class ScaffoldError extends Error { constructor(problems: Array<{path, code, message}>) }`.
  - `buildConfig(model) -> object` (o `roadmap.config.json` de `formats.md` §2: `formatVersion: FORMAT_VERSION`, `strategy: model.strategyPath`, `files.measurements: null` quando `measurements` ausente, `releaseBranch` só quando presente).
  - `renderFiles(model) -> Record<string, string>`: chaves = nomes de `config.files` (menos o `null`) e `roadmap.config.json`; valores LF terminados em `\n`. Conteúdo conforme "O que o scaffold deriva" da spec e `formats.md` §6-8: `state.md` (now, painel com primeiro status / bloqueado com `BLQ-n` / descartado, inflight vazio, pending, blockers com "restores E<n> to <primeiro status>" ou "restaura E<n> para <primeiro status>", `donot` e `releases` só quando presentes), `decisions.md`, `log.md` (uma linha: `model.date`, `-`, roadmap criado, evidência = `strategyPath`), `sources.md` (com `conflicts`), `requirements.md` (coluna Entregáveis e Cobertura de `deriveCoverage`), `critical-path.md` (`graph LR`, uma aresta por item de `edges`, um nó por card, `BLQn["BLQ-n: <texto>"]` ligado aos cards bloqueados, linha "Critical path: E.. -> E.." / "Caminho crítico: ..." com `chain`, "Next gate per track" apontando `state.md`), `measurements.md` quando presente, `README.md` (comando `node <pasta>/check-roadmap.mjs`, tabela "when to update" de `formats.md` §8).

- [ ] **Passo 1: testes que falham** (`describe('renderFiles')`), sobre `applyDefaults(model-full).model`:
  - Arestas extraídas do bloco Mermaid de `critical-path.md` com `/^\s*(E\d+)\s*-->\s*(E\d+)/gm` = conjunto de `edges`; nós `BLQ1[...]` presentes e ligados ao card bloqueado.
  - Tabela do bloco de requisitos lida com `parseRoadmapTexts` (de `lib/roadmap-format.mjs`): coluna Entregáveis de cada REQ = `deriveCoverage(...).rows`.
  - Painel do `state.md` tem uma linha por card; o card bloqueado tem a palavra `blockedStatus` e cita `BLQ-1`; a linha do bloqueio contém `restores E<n> to not-started`.
  - `cell('a|b', 'x') === 'a\\|b'`; um título de card com `\n` faz `renderFiles` lançar `ScaffoldError` com `code: 'multiline-cell'` e o caminho `deliverables[i].title`.
  - Nenhum arquivo contém `\r`; todos terminam em `\n`.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → FAIL (`renderFiles` não exportada).

- [ ] **Passo 3: implementar** `cell`, `ScaffoldError`, `buildConfig`, `renderFiles` (um renderizador por papel; textos fixos por idioma num objeto `TEXT.en`/`TEXT.pt`).

- [ ] **Passo 4: verificar** — o comando do Passo 2 → PASS; G1 → exit 0, failing 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs
git commit -m "E4 T3: renderização dos arquivos da pasta de roadmap" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 4: estratégia v1.0 e checker em memória

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`

**Interfaces:**
- Consome: `renderFiles`, `buildConfig`, `deriveGraph`, `deriveCoverage` (Tarefas 2-3); do checker irmão `checkRoadmap`, `validateConfig`, `createGitAdapter`.
- Produz:
  - `renderStrategy(model) -> string`: estratégia de `formats.md` §5 com os títulos de `HEADINGS[lang]`: âncora `<!-- roadmap:version 1.0 <date> -->`, changelog v1.0 com o modo ("full mode"/"modo completo", "light mode"/"modo leve") e os `DEC` do modelo, objetivo, não objetivos, premissas, tese, "Deliverables overview" (ID, título, fase, depende de; ordem `compareIds`), bloco `phases` com a coluna de entregáveis tirada dos cards (ordem das fases do modelo), um bloco `card` por entregável com `critical` derivado, `acceptance` com o tag `{verify: kind; [blq: BLQ-n;] evidence: ...}`, `risks`, `dod`; gates (só com `gates`), Métricas e Flags (só quando presentes), riscos transversais, pendências externas, questões em aberto, resumo de cobertura (`deriveCoverage().summary`), histórico de versões, fontes. Seção de prosa ausente = texto "nenhum" aplicado por `applyDefaults`.
  - `generate(model, { folder: string }) -> { files: Record<string, string>, config: object, strategyRel: string, problems: Array<{severity, code, file, message}> }`: `files` = `renderFiles` mais a estratégia na chave `strategyRel` (= `config.strategy`, relativa à pasta); monta `{ folder, config, strategyPath: path.resolve(folder, config.strategy), strategy, files: {papel: texto|null}, paths: config.files, invalidUtf8: [] }`, chama `validateConfig(config, folder, null)` e `checkRoadmap(r, git)` com `git = createGitAdapter(<primeiro ancestral existente de folder>)`.

- [ ] **Passo 1: testes que falham** (`describe('generate')`):
  - Critério 1: `generate(applyDefaults(model-full).model, { folder: tmp })` → `problems.filter(p => p.severity === 'error')` vazio; os cards com `critical=true` lidos da estratégia via `parseRoadmapTexts` = `deriveGraph(...).critical`; a linha do caminho crítico de `critical-path.md` = `chain.join(' -> ')`; a tabela "Deliverables overview" e a coluna Entregáveis dos requisitos batem com os cards.
  - O modelo de empate da Tarefa 2 completado com o mínimo obrigatório → 0 erros e `chain` = `['E2', 'E3']` na linha do caminho crítico.
  - Critério 2: `generate(applyDefaults(model-mid).model, ...)` → 0 erros; cada `requirements[].text` aparece literal (depois de `cell`) em `requirements.md`, cada `deliverables[].title` e `acceptance[].text` na estratégia, cada fonte em `sources.md` e cada decisão (`decisions[]`, que é onde a resposta de escolha da pessoa vira registro, `formats.md` §6) em `decisions.md`. `questions[]` fica só no modelo (formats.md não tem lugar para a conversa; a pergunta adiada já está em `openQuestions`, que aparece literal na estratégia).
  - Um card com um só critério de aceite (`acceptance` de tamanho 1) faz o checker em memória acusar `card-acceptance` → `problems` com `severity: 'error'` (prova de que o checker roda de verdade). `verify.kind: 'test'` com `evidence` vazio NÃO serve: o checker só emite o aviso `ac-verify-invalid` (warning), e o checker não pode ser alterado.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → FAIL (`generate` não exportada).

- [ ] **Passo 3: implementar** `renderStrategy` e `generate`.

- [ ] **Passo 4: verificar** — o comando do Passo 2 → PASS; G1 → exit 0, failing 0; G4 → exit 0 (o checker não mudou).

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs
git commit -m "E4 T4: estratégia v1.0 e conferência no checker em memória" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 5: CLI, gravação, recusas e determinismo

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`

**Interfaces:**
- Consome: `validateModel`, `applyDefaults`, `generate`, `ScaffoldError` (Tarefas 1-4).
- Produz:
  - `runScaffold(modelPath: string, { dryRun?: boolean }) -> { tool: 'scaffold', model, folder, written: string[], defaulted, errors, warnings, summary: { errors, warnings, exitCode } }` (forma de "CLI e saída" da spec; `errors` itens `{path, code, message}` ou problemas do checker; `written` caminhos relativos à pasta, ordenados). Lê o modelo removendo BOM; pasta = diretório do modelo; recusa (exit 1, nada gravado) por modelo inválido, `ScaffoldError`, erro do checker em memória, ou pasta com `roadmap.config.json` e sem o modelo (código `existing-roadmap`, verificado antes de ler o modelo quando o arquivo do modelo não existe). Grava os arquivos e copia `../../roadmap-tracker/scripts/check-roadmap.mjs` byte a byte para `<pasta>/check-roadmap.mjs`, conferindo que o formato da linha 1 = `formatVersion` (senão exit 2). Falha de gravação = exit 2.
  - `main(argv: string[]) -> number`: `node scaffold.mjs <modelo> [--dry-run] [--json]`; opção desconhecida ou sem modelo → exit 2 com `usage`; sem `--json` imprime uma linha por arquivo gravado, por item de `defaulted`, por erro e por aviso.

- [ ] **Passo 1: testes que falham** (`describe('cli')`), cada caso numa pasta temporária com `git init -b main` (e `-c user.name=t -c user.email=t@t -c commit.gpgsign=false` se commitar) e o modelo copiado para `<tmp>/roadmap-x/planning-model.json`; a CLI roda com `spawnSync(process.execPath, [script, ...], { input: '', timeout: 30000 })`:
  - `model-full` → exit 0; existem os arquivos de `config.files`, `roadmap.config.json`, `check-roadmap.mjs` (bytes iguais à fonte) e a estratégia; `loadRoadmap` + `checkRoadmap` do checker sobre a pasta gravada → 0 erros; o modelo continua lá.
  - Critério 2: `model-mid` com stdin fechado (`input: ''`) → exit 0 antes do timeout, pasta completa, 0 erros no checker; `--json` → `defaulted` só com caminhos ausentes de `model-mid.json`.
  - Recusas → exit 1 e a pasta só com o modelo (listagem igual à de antes): ciclo, dependência inexistente, critério sem `verify`; pasta com `roadmap.config.json` e sem modelo → exit 1, código `existing-roadmap`, nenhum arquivo novo.
  - `--dry-run` → exit 0 e nenhum arquivo novo; `--json` → JSON com as chaves `tool, model, folder, written, defaulted, errors, warnings, summary` e `summary.exitCode` igual ao código do processo, em sucesso e em recusa.
  - Uso: sem argumento, ou `--nope` → exit 2.
  - Determinismo: duas execuções sobre o mesmo modelo → mesmos bytes em todos os arquivos (hash por arquivo); a segunda execução (pasta com config e modelo) é aceita, não apaga um `extra.txt` criado entre as duas e não muda o modelo. Nenhum arquivo gerado contém `\r`.
  - Foco 1: modelo gravado com BOM e CRLF → mesmos bytes que sem.
  - Foco 4: pasta temporária com espaço no nome, `cwd: os.tmpdir()`, caminho do modelo relativo a esse cwd → exit 0.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → FAIL (`runScaffold` não exportada / CLI sem `main`).

- [ ] **Passo 3: implementar** `runScaffold` e `main` com a guarda de processo principal de `roadmap.mjs`.

- [ ] **Passo 4: verificar** — o comando do Passo 2 → PASS; G1 → exit 0, failing 0; G3 e G5 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs
git commit -m "E4 T5: CLI do scaffold com gravação atômica por checker, recusas e determinismo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 6: contrato do modelo e a skill nos passos 0 a 6

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-planner/references/model.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/references/formats.md` (só a linha `planning-draft.md` de §1)

**Interfaces:**
- Consome: CLI `node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" "<pasta>/planning-model.json" --json` e a forma da saída (Tarefa 5); campos e padrões de `applyDefaults` (Tarefa 1).
- Produz: `references/model.md` com: campos (base, opcionais com padrão, conversa, requisitos, estrutura, estratégia, estado), obrigatórios, o que o scaffold deriva (e por isso o modelo não guarda), saída e códigos, recusas com seus códigos (os de `validateModel`, `multiline-cell`, `existing-roadmap`), e um card de exemplo em JSON (o mesmo card do exemplo trabalhado que a Tarefa 8 põe em `decompose.md`). Seções numeradas `§1..§n` para serem citadas.

Orçamento: o conjunto contado (SKILL + clarify + decompose + model.md) hoje sem `model.md` já soma 43.335 bytes LF, a meta exata. Esta tarefa deve sair com `SKILL.md` menor do que entrou (o passo 6 e o "Planning draft" encolhem); a Tarefa 8 fecha a conta. Medir com:
`node -e "let s=0;for(const f of process.argv.slice(1))s+=Buffer.byteLength(require('fs').readFileSync(f,'utf8').replace(/\r\n?/g,'\n'));console.log(s)" plugins/productivity-tools/skills/roadmap-planner/SKILL.md plugins/productivity-tools/skills/roadmap-planner/references/clarify.md plugins/productivity-tools/skills/roadmap-planner/references/decompose.md plugins/productivity-tools/skills/roadmap-planner/references/model.md`

- [ ] **Passo 1: escrever `references/model.md`** dentro dos campos da spec; não repetir templates de `formats.md` (citar `formats.md §n`).

- [ ] **Passo 2: editar `SKILL.md`** conforme "A skill" da spec:
  - Tabela Paths: `references/model.md` (contrato do modelo, lido no passo 6), `scripts/scaffold.mjs`; `formats.md` passa a "consultado por seção (`formats.md` §n) quando um campo do modelo pedir", e a frase "Take every file template from `references/formats.md`" sai.
  - Passo 0: busca por `docs/plans/*/planning-model.json`; tabela de estados com `planning-model.json`; linha "config e modelo" = "rode o scaffold de novo a partir do modelo, depois o passo 7"; um `planning-draft.md` antigo é lido uma vez e convertido no modelo; a coluna Card da tabela de modos aponta `decompose.md` §12.
  - "Planning draft" vira "Planning model": gravar o modelo inteiro (com `nextStep`) depois dos passos 1, 2, 3, 4 e 5 e de cada rodada de perguntas; nunca um segredo ("[omitted: secret]").
  - Passos 1-5: "Write planning-draft.md" → gravar o modelo.
  - Passo 6: completar o modelo (gates copiados do CLAUDE.md e das fontes, nunca inventados; estado inicial), rodar o scaffold com `--json`, corrigir o modelo e repetir até exit 0, tratar cada item de `defaulted`; sai o bloco de cópia manual do checker (o scaffold copia).
  - Toda menção a `formats.md` vem com `§` (exigência do teste da Tarefa 8).

- [ ] **Passo 3: editar `formats.md` §1**: a linha `<root>/planning-draft.md ...` vira `<root>/planning-model.json  temporary, planner only: the planning model (references/model.md of roadmap-planner); deleted after Step 7 passes; the checker ignores it`. Nenhuma outra linha muda.

- [ ] **Passo 4: verificar**
  - `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → PASS.
  - Medição acima: valor menor que antes da tarefa + bytes de `model.md` (registrar os dois números no relatório da tarefa).
  - `grep -n "planning-draft" plugins/productivity-tools/skills/roadmap-planner/SKILL.md` → só a linha da conversão do rascunho antigo.
  - G1, G3, G5 → exit 0; G4 → exit 0 (prova de que `formats.md` não afetou o checker).

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/references/model.md plugins/productivity-tools/skills/roadmap-planner/SKILL.md plugins/productivity-tools/skills/roadmap-planner/references/formats.md
git commit -m "E4 T6: contrato do modelo de planejamento e skill nos passos 0 a 6" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 7: rubrica do revisor, passo 7 e fixture plantada

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-planner/references/review-rubric.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/SKILL.md` (só o passo 7)
- Criar: `plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/review-planted/` (pasta: `roadmap.config.json`, `strategy.md`, `state.md`, `decisions.md`, `log.md`, `sources.md`, `requirements.md`, `critical-path.md`, `README.md`, `expected-findings.json`; sem `check-roadmap.mjs` e sem modelo)
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`

**Interfaces:**
- Consome: CLI do scaffold (Tarefa 5) para gerar a fixture.
- Produz:
  - `review-rubric.md`: as nove regras da tabela "Rubrica do revisor" da spec, com id, o que procurar, severidade padrão e um exemplo curto de achado e de não achado cada; o esquema de saída `{"findings":[{"file","line","rule","severity","evidence","fix"}],"summary":{"error":n,"warning":n}}` num só bloco JSON cercado, `file` relativo à raiz do repositório, `line` opcional, regra fora da tabela = `other`; "sem estilo, sem elogio, não edite arquivos".
  - `expected-findings.json`: `[{ "file": "plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/review-planted/<arquivo>", "rule": "unsourced-number" | "compound-requirement" | "unverifiable-criterion", "severity": "error", "evidence": "<trecho plantado>" }]`, um por defeito.

- [ ] **Passo 1: teste que falha** em `scaffold.test.mjs` (`describe('review-planted fixture')`): `loadRoadmap` + `checkRoadmap(r, null)` sobre `fixtures/review-planted` → 0 erros; `expected-findings.json` tem exatamente 3 itens, com as três regras distintas, e o `evidence` de cada um aparece literal no arquivo citado (lido com CRLF normalizado).
  Rodar: `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → FAIL (pasta não existe).

- [ ] **Passo 2: gerar a fixture**: escrever em `D:/projects/claude-play-wt/_tmp/E4/planted/planning-model.json` um modelo sintético `language: "en"`, `strategyPath: "strategy.md"`, com os três defeitos plantados como texto do modelo: um número sem fonte nem marca na tese ou no objetivo (ex.: "cuts onboarding time by 40%"), um requisito composto (dois comportamentos verificáveis no mesmo `REQ`), um critério com `verify: {kind: "test", evidence: "node --version"}` que não exercita o critério. Rodar `node plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs D:/projects/claude-play-wt/_tmp/E4/planted/planning-model.json` → exit 0; copiar os arquivos gerados (menos o modelo e `check-roadmap.mjs`) para a pasta da fixture; escrever `expected-findings.json`; apagar `_tmp/E4/planted/`.

- [ ] **Passo 3: escrever `review-rubric.md`** e editar o passo 7 do `SKILL.md`: no modo completo, o revisor (opus/medium, contexto novo, só leitura) recebe a pasta, a estratégia, as fontes e o caminho de `references/review-rubric.md`, que ele lê; laço: corrigir no modelo, rodar scaffold e checker, despachar revisor novo só se a rodada anterior teve achado `error`; teto de três rodadas no total; `error` restante depois da terceira vai para o handoff como pendência; modo leve e sem ferramenta de subagent como hoje; o passo 7 apaga `planning-model.json` no fim. A linha que cita `review-rubric.md` contém a palavra "reviewer" (exigência do teste da Tarefa 8).

- [ ] **Passo 4: verificar** — o comando do Passo 1 → PASS; `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/review-planted` → exit 0 (avisos aceitos); G1, G3, G4, G5 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/references/review-rubric.md plugins/productivity-tools/skills/roadmap-planner/SKILL.md plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/review-planted plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs
git commit -m "E4 T7: rubrica do revisor, laço do passo 7 e fixture com defeitos plantados" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 8: exemplos trabalhados, cortes de repetição e orçamento de prosa

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar (teste): `plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/references/decompose.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/references/clarify.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`

**Interfaces:**
- Consome: `references/model.md` (Tarefa 6), `review-rubric.md` (Tarefa 7).
- Produz: `prose-budget.test.mjs` com as constantes `BASELINE_LF = 74602` e `TARGET_LF = 43335`, cada uma com comentário citando a spec, seção "Meta derivada de prosa" (SRC-02 §1, commit `bf9d948`; DEC-034; a constante segue a estratégia se a revisão registrar outro valor), `COUNTED = ['SKILL.md', 'references/clarify.md', 'references/decompose.md', 'references/model.md']` e `EXCLUDED = { 'references/formats.md': '<motivo>', 'references/review-rubric.md': '<motivo>' }`.

- [ ] **Passo 1: teste que falha** — `prose-budget.test.mjs` (caminhos a partir de `import.meta.url`):
  - (a) soma de `Buffer.byteLength(texto.replace(/\r\n?/g, '\n'))` de `COUNTED` ≤ `TARGET_LF`; a mensagem de falha mostra a soma e a diferença.
  - (b) os arquivos de `references/` (listados com `readdirSync`) são exatamente a união disjunta de `COUNTED` (menos `SKILL.md`) e das chaves de `EXCLUDED`.
  - (c) em cada arquivo contado, toda ocorrência de `formats.md` tem `§` nos 15 caracteres seguintes; toda linha que contém `review-rubric.md` contém também `reviewer` ou `revisor`.
  - `TARGET_LF === BASELINE_LF - 31267`.
  Rodar: `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs` → FAIL em (a) (soma > 43.335 depois de `model.md`) e possivelmente em (c).

- [ ] **Passo 2: editar** conforme "Exemplos trabalhados" e "Prosa repetida" da spec:
  - `decompose.md`: três exemplos curtos no formato do card (card completo = o card de `model.md`, citado e não repetido; requisito composto dividido em dois `REQ`; par de critérios ruim "works well" e bom Dado/Quando/Então com `verify` e comando); §13 vira um parágrafo que aponta `scripts/scaffold.mjs` e `references/model.md` (a tabela de arquivos sai); padrões do modo leve ficam só em §12; passe de cobertura só em §11; menções a `formats.md` com `§`.
  - `clarify.md`: o orçamento de perguntas fica só na regra 6 do SKILL; clarify.md aponta para ela (linhas 3, 99, 124, 134).
  - `SKILL.md`: passo 2 aponta a regra 6 em vez de repetir o orçamento; passo 4 aponta `decompose.md` §11 e §12 em vez de repetir cobertura e padrões do modo leve.
  - Nenhuma regra de que o planner precisa é cortada (anti-objetivo da spec): cada corte remove texto que existe em outro arquivo contado.

- [ ] **Passo 3: verificar**
  - `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs` → PASS (registrar a soma final).
  - `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` → PASS.
  - G1, G3, G4, G5 → exit 0.

- [ ] **Passo 4: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/references/decompose.md plugins/productivity-tools/skills/roadmap-planner/references/clarify.md plugins/productivity-tools/skills/roadmap-planner/SKILL.md
git commit -m "E4 T8: exemplos trabalhados, cortes de repetição e teste de orçamento de prosa" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 9: execução comportamental do revisor e do fluxo, e relatório

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

Sem efeito externo: subagents locais, só leitura no repositório, temporários em `D:/projects/claude-play-wt/_tmp/E4/`. O aceite do critério 4 é do dono; esta tarefa não registra aceite.

**Arquivos:**
- Criar: `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` (escrito pelo orquestrador: subagents não gravam arquivos com nome de relatório)
- Modificar (só se a 1ª execução perder um defeito): `plugins/productivity-tools/skills/roadmap-planner/references/review-rubric.md`

**Interfaces:**
- Consome: `review-rubric.md`, `fixtures/review-planted/` e `expected-findings.json` (Tarefa 7); o SKILL dos passos 0, 6 e 7 (Tarefas 6-7); o scaffold (Tarefa 5).

- [ ] **Passo 1: revisor**: despachar um subagent novo, `model: opus`, `effort: medium`, só leitura ("do not edit files"), com o brief do passo 7 do SKILL, o caminho de `references/review-rubric.md` e a pasta `plugins/productivity-tools/skills/roadmap-planner/scripts/fixtures/review-planted` (sem mostrar `expected-findings.json`). Guardar a saída JSON literal.

- [ ] **Passo 2: comparar** com `expected-findings.json`: para cada defeito, existe achado com mesmo `file` e `rule`, e a severidade; listar os achados extras. Se faltar um: corrigir `review-rubric.md`, repetir o Passo 1 com um subagent novo e guardar as duas execuções.

- [ ] **Passo 3: fluxo (regra de SRC-03)**: copiar `fixtures/model-mid.json` para `D:/projects/claude-play-wt/_tmp/E4/flow/docs/plans/roadmap-flow/planning-model.json` (com `git init -b main` em `_tmp/E4/flow`); um subagent sonnet segue o SKILL ao pé da letra a partir dali (retomada do passo 0 pelo modelo, passo 6 com o scaffold, checker do passo 7; sem perguntar ao usuário: as respostas estão no modelo, e o que faltar ele registra como pendência); depois uma revisão adversarial (subagent novo, opus/medium, só leitura) confere a pasta resultante contra o modelo e o SKILL. Guardar as duas saídas e o exit do checker.

- [ ] **Passo 4: relatório**: o orquestrador escreve `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` com: data, commit da branch, modelos e esforços usados, a saída JSON literal de cada execução do revisor, a tabela defeito plantado × achado (arquivo, regra, severidade, encontrado sim/não), achados extras, o resultado do fluxo (passos seguidos, exit do scaffold e do checker, achados da revisão adversarial) e a linha "Aceite do critério 4: pendente do dono". Apagar `D:/projects/claude-play-wt/_tmp/E4/`.

- [ ] **Passo 5: verificar** — G1 a G5 → exit 0; `git status --porcelain` só com os arquivos desta tarefa.

- [ ] **Passo 6: commit**
```bash
git add docs/reports/2026-11-11-E4-revisor-planner-comportamental.md
# e, se o Passo 2 exigiu correção:
git add plugins/productivity-tools/skills/roadmap-planner/references/review-rubric.md
git commit -m "E4 T9: execução comportamental do revisor com rubrica e do fluxo do planner" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
Depois: `git status --porcelain` vazio (diferença só de final de linha: `git checkout -- <arquivo>`).

---

## Acceptance criteria evidence

Os critérios 1 a 3 são `verify: test` com o comando do card; os arquivos de teste são criados nas Tarefas 1 e 8. Nenhum comando tem efeito externo: só lê o repositório e escreve em pastas temporárias do sistema. O critério 4 é ato humano (aceite do dono sobre o relatório da Tarefa 9).

| ac | kind | command | testRef | blq | external | externalDedupe |
|---|---|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` | `scaffold.test.mjs`: `generate` de `model-full` com 0 erros, arestas = dependências, `critical` = cadeias máximas, linha do caminho crítico, empate por id (Tarefas 2, 4); CLI grava e checker 0 erros (Tarefa 5) | - | false | - |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs` | `scaffold.test.mjs`: `model-mid` com stdin fechado → exit 0, pasta completa, 0 erros, textos do modelo literais, `defaulted` só com campos ausentes (Tarefas 1, 4, 5) | - | false | - |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs` | `prose-budget.test.mjs`: soma LF do conjunto contado ≤ 43.335, partição de `references/`, menções a `formats.md` com § (Tarefa 8) | - | false | - |
| AC4 | human | - | o dono confere o resultado da execução comportamental registrado em `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` (Tarefa 9) | - | false | - |
