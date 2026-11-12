# E20 -- Autor de plano, skill `plan-writer` e ponteiros nativos: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** entregar o agente do plugin `productivity-tools:plan-author` (forma de `spec-author` com a emenda DEC-421), a skill `plan-writer` com modo de escrita e modo de adoção, o `summary --lang` em `spec-tool` e `plan-tool`, os ponteiros do planner e do tracker para `spec-writer`/`plan-writer` (sem "superpowers" nos arquivos publicados das duas skills), a suíte de casos de gatilho com executor e testes, a variante de cenário e as execuções comportamentais com relatório.

**Arquitetura:** doze tarefas em commits separados. Primeiro as ferramentas (`summary --lang` em `spec-tool`, depois `plan-tool summary`, que reusa as tabelas de `spec-tool`); depois o agente e a skill, fixados por um teste novo `plugins/productivity-tools/scripts/independence.test.mjs`; depois os ponteiros do planner e do tracker; a suíte de gatilho em `tools/measure/` (não publicada); a variante de cenário; o README; e por fim as execuções comportamentais conduzidas pelo orquestrador da sessão principal (DEC-204).

**Tecnologia:** JavaScript ESM (Node >= 18; medido v22.17.1), `node:test`, sem dependências; Markdown. Textos embarcados (agente, SKILL.md, README do plugin, specs e roteiros do sandbox, casos de gatilho) em inglês, como o resto do plugin e do sandbox (os casos de gatilho levam também o prompt em português); plano, relatório e commits em português.

**Spec:** `docs/superpowers/specs/2026-11-12-E20-autor-plano-plan-writer-ponteiros-design.md` (ler junto com este plano; as seções "Peça 1" a "Peça 4", "Resumo com idioma nas duas ferramentas", "Execuções comportamentais" e "Casos de borda" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell 7, Node v22.17.1, claude CLI 2.1.322, `core.autocrlf=true` (checkouts CRLF, índice LF; `.sh` em LF por `.gitattributes`), `rerere.enabled=true`. Todo teste que lê Markdown, JSON ou JSONL do disco normaliza `\r\n` para `\n` antes de regex de várias linhas ou de dividir linhas.
- Worktree `D:/projects/claude-play-wt/E20`, branch `feat/E20`, faixa de portas 5200-5209 (nenhuma tarefa sobe servidor). Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E20/` (criar e apagar no fim da tarefa). Ao fim de cada tarefa `git status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`).
- Não editar: `docs/plans/roadmap-evolucao-skills/` e a estratégia; `plugins/_template/`; `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (E8); `plugins/productivity-tools/agents/spec-author.md` (E8, DEC-421); `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs` (E7; só se fixa o contrato em teste); `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs` (DEC-301, DEC-413); o esquema `plan/1` e `spec/1`; os diagramas e o `CLAUDE.md`. Sem subir versão (`productivity-tools` fica 1.7.0 em `plugin.json` e no `README.md` da raiz).
- Nomes fixados pela spec: agente `plugins/productivity-tools/agents/plan-author.md`, `name: plan-author`, `model: opus`, `effort: medium`, `tools: Read, Grep, Glob, Bash, Write, Edit`; despacho `productivity-tools:plan-author`; campos de chamada `mode` (`unattended`, `interactive`, `adopt`), `output`, `planTool`, `spec`, `language`, `roadmap`, `card`, `source`, `ownerNote`, `intake`; skill `plugins/productivity-tools/skills/plan-writer/SKILL.md` com frontmatter só `name`, `description`, `argument-hint` (`<spec.md or plan.md> [--roadmap <folder>]`); `planTool: ${CLAUDE_SKILL_DIR}/../../scripts/plan-tool.mjs`; regras de permissão mostradas `Bash(node *plan-tool.mjs" *)` e `Bash(node *spec-tool.mjs" *)`; provisório da adoção `<plano antigo>.adopted.md`; seção `## Adoção` no plano adotado; teste `plugins/productivity-tools/scripts/independence.test.mjs`; suíte `tools/measure/trigger/cases.json`, `tools/measure/run-trigger.mjs`, `tools/measure/run-trigger.test.mjs`, fixtures em `tools/measure/fixtures/trigger/`; variante `plan-author`; arquivos `tools/measure/scenario/plan-author-spec.md`, `tools/measure/scenario/plan-writer-spec.md`, `tools/measure/scenario/plan-writer-adopt.md`; plano antigo do sandbox em `docs/superpowers/plans/2026-01-01-e5-text-utilities.md`; relatório `docs/reports/2026-11-12-E20-autor-plano-comportamental.md`.
- DEC-312: nenhum texto embarcado (agente, SKILL.md, README) contém `bypassPermissions` nem sugere modo sem permissões.
- Credenciais: nenhum valor de credencial, token ou chave em arquivo, fixture, plano, relatório ou commit; uma credencial só aparece como "provided through environment variable <NAME>". Nenhuma tarefa precisa de credencial.
- Commits: `E20 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (linha de base do alvo: G1 exit 0, total 1514, skipped 0, nenhum falhando; G2 a G5 exit 0; nenhuma falha é esperada em nenhuma tarefa, e nenhum gate canônico muda):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total ≥ 1514 (cresce com os testes novos), failing 0, skipped 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
  - "Gates completos" abaixo = G1 a G5, todos antes de cada commit.
- Nenhuma tarefa precisa de navegador, de lock nem tem efeito externo; todas rodam na worktree do entregável antes do merge, nenhuma precisa do merge, do alvo ou da worktree de integração. Quando um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando que mostra o motivo, no relato da tarefa. A Tarefa 12 precisa de sessões `claude -p` que despacham subagents: se quem a recebe não tem como lançá-las, a tarefa volta ao orquestrador da sessão principal (DEC-204), nunca é simulada.
- Execução decidida sob as regras permanentes do dono (decisões delegadas a um subagent Fable): as sessões orquestradoras rodam em `bypassPermissions`, sem as regras de Bash que faltam; o que é embarcado nunca indica esse modo. A execução paga da suíte de gatilho é do dono (DEC-025, DEC-011) e não é tarefa deste plano.

## Foco da revisão

1. Caminho de `plan-tool.mjs` ou do plano com espaços (por exemplo `C:/Users/Some One/.claude/plugins/cache/...`): agente e skill sempre citam os caminhos entre aspas (`node "<planTool>" check "<output>" --json`); testes nas Tarefas 3 e 4.
2. Adoção que perde o plano original: o provisório é `<plano antigo>.adopted.md`, o original só é substituído depois de "approve", recusa ou falha de checagem apaga o provisório e deixa o original intacto, e o caminho final é o do original (DEC-026); teste estrutural na Tarefa 4 e conferência literal na Tarefa 12.
3. Ponteiro do roadmap que cai: `--roadmap` para pasta sem `roadmap.config.json` para antes de despachar; linha `**Roadmap:**` ou pasta `<nome>-E<n>` inválidas viram `roadmap: null` com o ponteiro e o motivo no relato e na aprovação, nunca em silêncio; teste estrutural na Tarefa 4, execução nas Tarefas 12 (critério 2 dá `null`, critério 4 dá `docs/plans/roadmap-sandbox/`).
4. Idioma do resumo: `spec-tool summary` sem `--lang` produz exatamente a saída de hoje; `--lang xx` sai 2; `plan-tool summary` de plano inválido imprime os erros e sai 1; testes nas Tarefas 1 e 2.
5. Transcrição `stream-json` real que foge do fixture (linha vazia, linha que não é JSON, CRLF, sem evento `init`): o parser de `run-trigger.mjs` não lança, pula a linha ruim e registra `superpowers: "unknown"` quando não há `init`; testes na Tarefa 7.

## Mapa de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `plugins/productivity-tools/scripts/spec-tool.mjs` | 1 | rótulos por idioma, `summary --lang`, tabelas reusáveis |
| `plugins/productivity-tools/scripts/spec-tool.test.mjs` | 1 | testes do `--lang` |
| `plugins/productivity-tools/scripts/plan-tool.mjs` | 2 | comando `summary` |
| `plugins/productivity-tools/scripts/plan-tool.test.mjs` | 2 | testes do `summary` |
| `plugins/productivity-tools/agents/plan-author.md` | 3 | o agente |
| `plugins/productivity-tools/scripts/independence.test.mjs` | 3, 4, 6 | independência, REQ-013, ponteiro do roadmap, REQ-020 |
| `plugins/productivity-tools/skills/plan-writer/SKILL.md` | 4 | a skill (escrita e adoção) |
| `plugins/productivity-tools/skills/spec-writer/SKILL.md` | 4 | passo 4 com `--lang`, passo 5 aponta `plan-writer` |
| `plugins/productivity-tools/skills/roadmap-planner/references/clarify.md` | 5 | §8 aponta `spec-writer` |
| `plugins/productivity-tools/skills/roadmap-planner/references/decompose.md` | 5 | tarefas são de `plan-writer` |
| `plugins/productivity-tools/skills/roadmap-planner/references/formats.md` | 5 | pergunta aberta "for spec-writer" |
| `plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs` | 5 | comentário cita E4 e DEC-034 |
| `plugins/productivity-tools/skills/roadmap-planner/SKILL.md` | 6 | descrição, tabela de limites, passo 8 encadeado |
| `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md` | 6 | descrição aponta `plan-writer` |
| `tools/measure/run-trigger.mjs` | 7, 8 | parser, pontuação, tabela, executor e CLI |
| `tools/measure/run-trigger.test.mjs` | 7, 8 | testes sobre transcrições gravadas e `--dry-run` |
| `tools/measure/fixtures/trigger/*.jsonl` | 7, 8 | transcrições gravadas à mão |
| `tools/measure/trigger/cases.json` | 8 | casos de gatilho |
| `tools/measure/scenario/plan-author-spec.md` | 9 | spec `spec/1` do E5 do sandbox |
| `tools/measure/scenario/plan-writer-spec.md` | 9 | spec `spec/1` fora de roadmap |
| `tools/measure/make-scenario.mjs` | 9 | variante `plan-author` |
| `tools/measure/make-scenario.test.mjs` | 9, 10 | testes da variante e do roteiro |
| `tools/measure/scenario/plan-writer-adopt.md` | 10 | aprovação sintética da adoção |
| `plugins/productivity-tools/README.md` | 11 | linha de `plan-writer` e item de `plan-author` |
| `docs/reports/2026-11-12-E20-autor-plano-comportamental.md` | 12 | relatório das execuções comportamentais |

---

### Tarefa 1: `spec-tool summary --lang`

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/scripts/spec-tool.mjs`
- Test: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Produces (exportados de `spec-tool.mjs`, consumidos pela Tarefa 2):
  - `SUMMARY_LANGS = ['pt', 'en']`.
  - `SUMMARY_LABELS[lang]` com `decisions`, `people`, `effects` (títulos de seção), `rulingCols`, `personCols`, `effectCols` (nomes de coluna) e `stop` (marca da coluna de parada). `pt` reproduz o texto de hoje: `## Decisões` / `ID | Decisão | Custo se errada | Reversível | Alcance | Contradiz | Para`, `## Pessoas` / `ID | Tipo | O quê | Bloqueia | Contorno | BLQ | Para`, `## Efeitos externos` / `ID | O quê | Alvo`, marca `para`. `en`: `## Decisions` / `ID | Decision | Cost if wrong | Reversible | Scope | Contradicts | Stop`, `## People` / `ID | Kind | What | Blocking | Workaround | BLQ | Stop`, `## External effects` / `ID | What | Target`, marca `stop`.
  - `mdTable(head: string[], rows: any[][]) -> string` (a função `table` interna de hoje, com `cell`).
  - `stopsOf(rulings, needsPerson) -> string[]` (a regra de `stops` de `summarize`, extraída sem mudança).
  - `formatRecords(s, { lang = 'pt' } = {}) -> string`: seções de decisões e de pessoas.
  - `formatSummary(s, { lang = 'pt' } = {}) -> string` = `formatRecords` + seção de efeitos externos.
- CLI: `summary <spec.md> [--lang pt|en] [--json]`; `--lang` só em `summary` (em `check`/`emit` é opção desconhecida, exit 2); valor ausente ou fora de `SUMMARY_LANGS` → exit 2 com o `USAGE` atualizado; `--json` ignora o idioma.

- [ ] **Passo 1: escrever os testes que falham** em `spec-tool.test.mjs`, usando `scripts/fixtures/spec-tool/spec.md`:
  - `E20: summary without --lang is byte-identical to --lang pt and keeps the Portuguese headers`: `main(['summary', spec])` e `main(['summary', spec, '--lang', 'pt'])` capturados → iguais; a saída contém `| ID | Decisão | Custo se errada | Reversível | Alcance | Contradiz | Para |` e `## Efeitos externos`.
  - `E20: summary --lang en prints English headers`: contém `## Decisions`, `| ID | Decision | Cost if wrong | Reversible | Scope | Contradicts | Stop |`, `## People`, `## External effects`; não contém `Decisões`.
  - `E20: summary --lang with an unknown or missing value is a usage error`: `['summary', spec, '--lang', 'fr']` e `['summary', spec, '--lang']` → retorno 2, stderr contém `--lang`.
  - `E20: --lang is refused outside summary`: `['check', spec, '--lang', 'en']` → 2.
  - `E20: summary --json ignores --lang`: o JSON com `--lang en` é igual ao sem.
  - `E20: formatRecords holds decisions and people only`: `formatRecords(summarize(text), { lang: 'en' })` contém `## Decisions` e `## People`, não contém `## External effects`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs` → FAIL nos casos E20 (`--lang` é opção desconhecida; `formatRecords` não exportado).
- [ ] **Passo 3: implementar** as exportações acima e o parse de `--lang` em `main`; `summarize` passa a chamar `stopsOf`.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0; os testes E5/E19 já existentes do arquivo seguem passando.
- [ ] **Passo 5: gates completos** → todos exit 0; G1 total = 1514 + 6, failing 0, skipped 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/scripts/spec-tool.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs
  git commit -m "E20 T1: spec-tool summary com --lang pt|en" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 2: `plan-tool summary`

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/scripts/plan-tool.mjs`
- Test: `plugins/productivity-tools/scripts/plan-tool.test.mjs`

**Interfaces:**
- Consumes: `SUMMARY_LANGS`, `SUMMARY_LABELS`, `mdTable`, `stopsOf`, `formatRecords` (Tarefa 1); `checkPlan`, `route` (já existentes).
- Produces:
  - `summarizePlan(data) -> { tasks: [{ n, title, deps, tier, effort, reviewTier, external }], evidence: [{ ac, kind, command }], rulings, needsPerson, stops }`, com `tier`, `effort` e `reviewTier` de `route(task, { hasDependents })`, onde `hasDependents` é verdadeiro quando algum outro `deps` cita `n`.
  - `formatPlanSummary(s, { lang = 'pt' } = {}) -> string`: seção de tarefas (`pt`: `## Tarefas` / `N | Título | Dependências | Nível | Effort | Revisão | Externo`; `en`: `## Tasks` / `N | Title | Deps | Tier | Effort | Review | External`), seção de evidência (`pt`: `## Evidência` / `Critério | Tipo | Comando`; `en`: `## Evidence` / `Criterion | Kind | Command`) e `formatRecords(s, { lang })`. Os rótulos novos ficam numa tabela local de `plan-tool.mjs` com as mesmas chaves `pt`/`en`.
  - CLI: `summary <plan.md> [--spec <spec.md>] [--lang pt|en] [--json]` acrescentado ao `USAGE` e à lista de comandos; plano com erro de checagem → as mesmas linhas `ERROR <code> <ref>: <msg>` e `Result: ...` de `check` sem `--json`, exit 1; `--lang` inválido ou fora de `summary` → exit 2; `--json` imprime o objeto de `summarizePlan`.

- [ ] **Passo 1: escrever os testes que falham** em `plan-tool.test.mjs`, usando `scripts/fixtures/plan-tool/plan.md`:
  - `E20: plan summary lists tasks with the route of each`: saída padrão contém `## Tarefas`, `## Evidência`, `## Decisões`, `## Pessoas`; a linha da tarefa 1 começa com `| 1 | Armazenamento local de itens |` e traz o `tier`, o `effort` e o `reviewTier` que `route` dá a essa tarefa (calculados no teste com `route` e `hasDependents`); a tarefa externa do fixture (5) aparece com o valor de externo verdadeiro.
  - `E20: plan summary --lang en prints English headers`: `## Tasks`, `| N | Title | Deps | Tier | Effort | Review | External |`, `## Evidence`, `## Decisions`, `## People`.
  - `E20: plan summary of an invalid plan prints the errors and exits 1`: plano temporário com o bloco do fixture sem `tasks` → retorno 1, saída com `ERROR` e `Result:`.
  - `E20: plan summary rejects an unknown --lang`: `--lang fr` → 2.
  - `E20: plan summary --json returns tasks, evidence, rulings, needsPerson and stops`: chaves exatamente essas; `tasks.length` igual ao do fixture; uma linha de `evidence` por item do bloco.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs` → FAIL nos casos E20 (`comando desconhecido: summary`).
- [ ] **Passo 3: implementar** `summarizePlan`, `formatPlanSummary` e o ramo `summary` de `main` (o parse de `--lang` aceito só quando `cmd === 'summary'`).
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0; o teste de pureza de fonte (`checkPureSource`) segue passando.
- [ ] **Passo 5: gates completos** → todos exit 0; G1 failing 0, skipped 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/scripts/plan-tool.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs
  git commit -m "E20 T2: plan-tool summary com tarefas, evidência e --lang" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 3: agente `plan-author` (peça 1)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `plugins/productivity-tools/agents/plan-author.md`
- Create: `plugins/productivity-tools/scripts/independence.test.mjs`

**Interfaces:**
- Consumes: `plan-tool.mjs` (`check <plan> --json`, `emit <plan>`), esquema `plan/1` (campos de topo `schema`, `id`, `title`, `spec`, `roadmap`, `constraints`, `externalPatterns`, `tasks`, `evidence`, `rulings`, `needsPerson`; campos de tarefa de `TASK_FIELDS`; `score` com `ambiguity`, `reasoning`, `blast`, `verifiability` para `lib/routing.mjs`).
- Produces: agente `productivity-tools:plan-author` com a tabela de contrato da spec (todos os campos, `roadmap` em todos os modos, a nota `ownerNote`/`intake` como último campo de várias linhas), os sete passos do processo da spec, a seção `## Adoção` no modo `adopt` (por passo antigo: tarefas novas e o que mudou), as regras fixas e a última mensagem = saída literal de `node "<planTool>" emit "<output>"` (ou do último `check --json` depois da terceira execução). Corpo em inglês, alvo de cerca de 1 mil tokens (não conferido). `independence.test.mjs` com a função `read(rel)` (lê relativo a `plugins/productivity-tools/`, normaliza CRLF) e `frontmatter(text) -> { keys: string[], fields: Record<string,string>, body: string }`, usadas pelas Tarefas 4 e 6.

- [ ] **Passo 1: escrever os testes que falham** em `independence.test.mjs` (novo):
  - `E20: plan-author frontmatter pins opus, medium effort and tools without asking (REQ-013)`: `name: plan-author`, `model: opus`, `effort: medium`, `tools` exatamente `Read, Grep, Glob, Bash, Write, Edit`; nem `AskUserQuestion` nem `Agent` em `tools`; a `description` casa `/not for specs/i`.
  - `E20: plan-author body forbids asking and committing`: o corpo casa `/never ask/i`, `/never commit/i` e `/write only to .?output/i`.
  - `E20: plan-author body names the call contract with roadmap in every mode`: contém `mode`, `output`, `planTool`, `spec`, `language`, `roadmap`, `card`, `source`, `ownerNote`, `intake`, `unattended`, `interactive`, `adopt`; a linha da tabela que começa com `` | `roadmap` `` traz `all` na coluna de modo e cita `null`.
  - `E20: plan-author closes with a quoted plan-tool check and returns emit`: casa `/node "<planTool>" check "<output>" --json/` e `/node "<planTool>" emit "<output>"/`, e um limite de três execuções (`/three|3/`).
  - `E20: plan-author adopt mode keeps every old step in an Adoção section`: contém `## Adoção`, `source` e casa `/(split|merged|added|removed)/`.
  - `E20: shipped E20 texts never mention bypassPermissions` (só o agente nesta tarefa; a Tarefa 4 acrescenta o SKILL.md).
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/independence.test.mjs` → FAIL nos seis casos (`ENOENT` do agente).
- [ ] **Passo 3: escrever o agente** segundo a seção "Peça 1" da spec, na estrutura de `agents/spec-author.md` (frontmatter só com chaves aceitas por `lint-plugin.mjs` para agentes; parágrafo de abertura com o despacho por `agentType` num workflow e por `subagent_type` numa skill; tabela de contrato; processo numerado; regras fixas: não perguntar, não esperar, não oferecer escolha; não commitar; não inventar credencial, dado de produção, aceite ou aprovação; efeito externo marcado `external: true` com `externalDedupe`, nunca executado; `planTool` ausente ou ilegível → devolver a falha literal sem procurar outro caminho; `roadmap` gravado literal no bloco, sem procurar nem trocar; gravar só em `output`; no modo `adopt`, `source` é só lido).
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0; G5 mostra `agents/plan-author.md frontmatter` OK; G3 exit 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/agents/plan-author.md plugins/productivity-tools/scripts/independence.test.mjs
  git commit -m "E20 T3: agente plan-author nos modos autônomo, interativo e de adoção" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 4: skill `plan-writer` (peça 2) e ajuste de `spec-writer`

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `plugins/productivity-tools/skills/plan-writer/SKILL.md`
- Modify: `plugins/productivity-tools/skills/spec-writer/SKILL.md`
- Test: `plugins/productivity-tools/scripts/independence.test.mjs`

**Interfaces:**
- Consumes: agente `productivity-tools:plan-author` e seu contrato (Tarefa 3); agente `productivity-tools:spec-author` (E19, só no modo de adoção sem spec); `plan-tool summary --lang` (Tarefa 2); `spec-tool summary --lang`, `check --roadmap` (Tarefa 1); a mensagem `NO_DATA_BLOCK` de `skills/plan-coordinator/scripts/progress.mjs` (E7).
- Produces: skill `productivity-tools:plan-writer` com a resolução da pasta do roadmap nas quatro fontes da spec, os três modos pelo arquivo recebido (spec `spec/1` → escrita em `<pasta do spec>/plan.md`; plano sem bloco → adoção com provisório `<plano antigo>.adopted.md`, uma aprovação em uma chamada de `AskUserQuestion` com "approve" e "refuse"; plano com bloco → só `plan-tool check`), os casos de borda da spec e as recusas. `--lang` do `summary` = `pt` se a pessoa escreve em português, senão `en`. Corpo em inglês, abaixo de 500 linhas, alvo de cerca de 0,8 mil tokens (não conferido).

- [ ] **Passo 1: escrever os testes que falham** em `independence.test.mjs`:
  - `E20: plan-writer frontmatter keeps name, description and argument-hint only`: chaves exatamente essas três; `name: plan-writer`; a descrição contém `spec-writer`, `roadmap-planner`, `plan-coordinator` e casa `/adopt/i`.
  - `E20: plan-writer dispatches plan-author in interactive and adopt mode`: o corpo contém `subagent_type`, `productivity-tools:plan-author`, `mode: interactive`, `mode: adopt`, `${CLAUDE_SKILL_DIR}/../../scripts/plan-tool.mjs`, `.adopted.md`, `## Adoção` e casa `/node "[^"]*plan-tool[^"]*" (check|summary)/` e `/summary[^\n]*--lang/`.
  - `E20: plan-writer resolves the roadmap folder from its three sources (pointer)`: o corpo contém `--roadmap`, `**Roadmap:**` e `roadmap.config.json`, e casa `/null/`.
  - `E20: plan-writer adoption asks one approval and never overwrites before it`: contém `AskUserQuestion`, casa `/one approval/i`, `/original[^\n]*(intact|unchanged)/i` e `/does not commit|never commits/i`.
  - `E20: plan-writer refusals show the exact rules and reload`: contém `` Bash(node *plan-tool.mjs" *) ``, `` Bash(node *spec-tool.mjs" *) `` e `/reload-plugins`.
  - `E20: progress refusal and plan-writer adoption stay in step (REQ-020)`: o texto de `skills/plan-coordinator/scripts/progress.mjs` tem a linha `const NO_DATA_BLOCK =` citando `plan-writer` e casando `/modo de adoção/`; `skills/plan-writer/SKILL.md` existe com `name: plan-writer` e casa `/adoption mode/i`.
  - `E20: spec-writer points to plan-writer and passes --lang to summary`: `skills/spec-writer/SKILL.md` não contém `once it exists`; casa `/summary[^\n]*--lang/`.
  - estender `E20: shipped E20 texts never mention bypassPermissions` para incluir `skills/plan-writer/SKILL.md`; `E20: plan-writer stays under 500 lines`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/independence.test.mjs` → FAIL nos casos de `plan-writer` (`ENOENT`) e no de `spec-writer`; o caso REQ-020 falha só pelo lado do SKILL.md.
- [ ] **Passo 3: escrever o SKILL.md** segundo a seção "Peça 2" da spec, com os casos de borda da spec (item de pessoa bloqueante para antes do despacho; spec sem bloco aponta `spec-writer`; autor que não passa em três execuções mostra o `check --json` e para, apagando o provisório na adoção; `plan.md` com bloco é relatado, não reescrito; spec fora de roadmap relata que o coordinator não chamará o tracker). **Editar `spec-writer/SKILL.md`**: passo 4 roda `summary ... --lang <pt|en>`; passo 5 diz que o plano sai de `plan-writer`. Nem o SKILL.md nem o agente da Tarefa 3 podem conter a palavra "superpowers" (nem como exemplo de caminho de plano antigo): o teste do critério 3 (Tarefa 6) os varre.
- [ ] **Passo 4: rodar e ver passar.** `node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs` → exit 0, failing 0 (os testes E19 de `spec-writer` seguem passando).
- [ ] **Passo 5: gates completos** → todos exit 0; G5 sem WARN novo para `skills/plan-writer/SKILL.md`.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/skills/plan-writer/SKILL.md plugins/productivity-tools/skills/spec-writer/SKILL.md plugins/productivity-tools/scripts/independence.test.mjs
  git commit -m "E20 T4: skill plan-writer com modo de adoção; spec-writer aponta plan-writer" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 5: referências do planner apontam `spec-writer` e `plan-writer`

**tier:** haiku · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-planner/references/clarify.md`
- Modify: `plugins/productivity-tools/skills/roadmap-planner/references/decompose.md`
- Modify: `plugins/productivity-tools/skills/roadmap-planner/references/formats.md`
- Modify: `plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs`

**Interfaces:**
- Consumes: nomes `spec-writer` e `plan-writer` (Tarefas 3 e 4).

- [ ] **Passo 1: trocas literais**, de mesmo tamanho ou menores (o orçamento de `prose-budget.test.mjs` soma `clarify.md` e `decompose.md`; `formats.md` entra nas cargas do tracker):
  - `clarify.md` §8: título `## 8. Boundary with brainstorming` → `## 8. Boundary with spec-writer`; `belong to \`superpowers:brainstorming\`, which runs per deliverable` → `belong to \`spec-writer\`, which runs per deliverable`.
  - `decompose.md`: `tasks are for \`superpowers:writing-plans\`` → `tasks are for \`plan-writer\``.
  - `formats.md`: `for superpowers:brainstorming>` → `for spec-writer>`.
  - `prose-budget.test.mjs` linha 2: `// Spec: docs/superpowers/specs/2026-11-11-E4-planner-scaffold-rubrica-design.md,` → `// Card E4 do roadmap evolucao-skills,` (a linha 3 com DEC-034 fica).
- [ ] **Passo 2: verificação.** `git grep -n -i -e superpowers -e brainstorming -e writing-plans -- plugins/productivity-tools/skills/roadmap-planner/references plugins/productivity-tools/skills/roadmap-planner/scripts` → nenhuma linha (exit 1). `node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs` → exit 0, failing 0. Gates completos → todos exit 0.
- [ ] **Passo 3: commit.**
  ```bash
  git add plugins/productivity-tools/skills/roadmap-planner/references/clarify.md plugins/productivity-tools/skills/roadmap-planner/references/decompose.md plugins/productivity-tools/skills/roadmap-planner/references/formats.md plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs
  git commit -m "E20 T5: referências do planner apontam spec-writer e plan-writer" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 6: planner e tracker sem superpowers (critério 3)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`
- Test: `plugins/productivity-tools/scripts/independence.test.mjs`

**Interfaces:**
- Consumes: `read`, `frontmatter` (Tarefa 3); argumentos de `plan-writer` (`<spec.md> --roadmap <folder>`, Tarefa 4).
- Produces: `independence.test.mjs` com `filesUnder(rel) -> string[]` (todos os arquivos, recursivo) e o teste do critério 3, que E13 estende.

- [ ] **Passo 1: escrever os testes que falham** em `independence.test.mjs`:
  - `E20: no published planner, tracker or E20 file mentions superpowers (criterion 3)`: para cada arquivo de `filesUnder('skills/roadmap-planner')`, `filesUnder('skills/roadmap-tracker')`, `filesUnder('skills/plan-writer')` e `agents/plan-author.md`, o texto não casa `/superpowers/i`; a mensagem de falha lista arquivo e linha.
  - `E20: planner chains spec-writer, plan-writer with --roadmap, and plan-coordinator`: o SKILL.md do planner casa `/spec-writer/`, `/plan-writer[^\n]*--roadmap/`, `/plan-coordinator/` e `/roadmap-release/`, e a descrição contém `BEFORE spec-writer` e `use plan-writer`.
  - `E20: tracker description points task plans to plan-writer`: a descrição do tracker contém `use plan-writer`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/independence.test.mjs` → FAIL nos três casos (ocorrências nas linhas 3, 12, 149 e 150 do planner e na linha 3 do tracker).
- [ ] **Passo 3: editar** segundo a seção "Peça 3" da spec: descrição do planner (`BEFORE superpowers:brainstorming ... (brainstorming then runs once per deliverable)` → `BEFORE spec-writer ... (spec-writer then runs once per deliverable)`; `use superpowers:writing-plans` → `use plan-writer`), tabela de limites (`plan-writer`), passo 8 com a cadeia por entregável: (1) `spec-writer` com o card, os REQs e as dependências, tópico `<roadmap slug>-E<n>`; (2) `plan-writer <folder of that spec>/spec.md --roadmap <roadmap folder>` (o campo `roadmap` do bloco toma o lugar da antiga linha de cabeçalho); (3) `plan-coordinator`; vários entregáveis sem pessoa seguem em `roadmap-release`. Descrição do tracker: `use superpowers:writing-plans` → `use plan-writer`. Sem crescer a prosa contada pelo orçamento.
- [ ] **Passo 4: rodar e ver passar.** `node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs` → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0 (G5 confere as descrições das skills); `git grep -n -i superpowers -- plugins/productivity-tools/skills/roadmap-planner plugins/productivity-tools/skills/roadmap-tracker` → nenhuma linha (exit 1).
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/skills/roadmap-planner/SKILL.md plugins/productivity-tools/skills/roadmap-tracker/SKILL.md plugins/productivity-tools/scripts/independence.test.mjs
  git commit -m "E20 T6: planner e tracker apontam spec-writer e plan-writer; teste de independência" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 7: parser e pontuação da suíte de gatilho

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `tools/measure/run-trigger.mjs`
- Create: `tools/measure/run-trigger.test.mjs`
- Create: `tools/measure/fixtures/trigger/hit-superpowers-on.jsonl`
- Create: `tools/measure/fixtures/trigger/wrong-skill-superpowers-off.jsonl`

**Interfaces:**
- Produces (exportados de `run-trigger.mjs`):
  - `parseTranscript(text: string) -> { skill: string|null, superpowers: true|false|'unknown', plugins: string[] }`: lê JSONL (CRLF aceito; linha vazia ou não JSON é pulada); do primeiro evento `type: "system", subtype: "init"` tira `plugins` (nomes de `plugins[].name`) e marca `superpowers: true` se algum plugin se chama `superpowers` ou algum item de `skills`/`slash_commands` começa com `superpowers:`, `false` se há `init` sem isso, `'unknown'` sem `init`; `skill` é o `input.skill` do primeiro `tool_use` de nome `Skill` em mensagens `type: "assistant"`, ou `null`.
  - `scoreCase(c, parsed) -> { id, category, lang, expect, got, hit, superpowers }`, `hit = got === c.expect`.
  - `renderTable(results) -> string`: tabela Markdown `| id | lang | category | expect | got | hit | superpowers |`, seguida de uma tabela de acertos por categoria (`| category | hits | total |`).
- Fixtures gravados à mão (formato de `claude -p --output-format stream-json --verbose`): `hit-superpowers-on.jsonl` = `init` com plugin `superpowers` e um `tool_use` `Skill` `productivity-tools:plan-writer`; `wrong-skill-superpowers-off.jsonl` = `init` sem superpowers, com uma linha em branco e terminações CRLF, e um `tool_use` `Skill` `productivity-tools:roadmap-planner`.

- [ ] **Passo 1: escrever os testes que falham** em `run-trigger.test.mjs`:
  - `parses the first Skill call and superpowers present`: fixture `hit-superpowers-on` → `skill: 'productivity-tools:plan-writer'`, `superpowers: true`, `plugins` contém `productivity-tools`.
  - `parses a wrong skill with superpowers absent, CRLF and a blank line`: → `skill: 'productivity-tools:roadmap-planner'`, `superpowers: false`.
  - `a transcript without init and with a non-JSON line does not throw`: texto inline `not json\n{"type":"assistant",...Skill...}` → `superpowers: 'unknown'`, `skill` lido.
  - `scoreCase marks hit and miss`: caso com `expect: 'productivity-tools:plan-writer'` contra os dois fixtures → `hit` verdadeiro e falso.
  - `renderTable lists each case and the hits per category`: duas linhas de caso e a linha `| plan | 1 | 2 |`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/run-trigger.test.mjs` → FAIL (`Cannot find module`).
- [ ] **Passo 3: implementar** as três funções (sem CLI nesta tarefa).
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add tools/measure/run-trigger.mjs tools/measure/run-trigger.test.mjs tools/measure/fixtures/trigger/hit-superpowers-on.jsonl tools/measure/fixtures/trigger/wrong-skill-superpowers-off.jsonl
  git commit -m "E20 T7: parser e pontuação da suíte de gatilho" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 8: casos de gatilho, executor e `--dry-run` (peça 4)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `tools/measure/trigger/cases.json`
- Create: `tools/measure/fixtures/trigger/no-skill.jsonl`
- Modify: `tools/measure/run-trigger.mjs`
- Test: `tools/measure/run-trigger.test.mjs`

**Interfaces:**
- Consumes: `parseTranscript`, `scoreCase`, `renderTable` (Tarefa 7).
- Produces:
  - `cases.json`: `{ "cases": [ { "id", "category", "expect", "prompt": { "pt", "en" }, "pairOf"? } ] }`, `category` em `spec`, `plan`, `roadmap`, `plan-execution`; `expect` em `productivity-tools:spec-writer`, `productivity-tools:plan-writer`, `productivity-tools:roadmap-planner`, `productivity-tools:plan-coordinator`; ao menos três casos por categoria; `pairOf` liga pares próximos (risco 2 do card), com ao menos um par `plan`↔`roadmap` e um `plan`↔`plan-execution`.
  - `buildArgs(prompt, { pluginDir }) -> string[]` = `['-p', prompt, '--plugin-dir', pluginDir, '--output-format', 'stream-json', '--verbose', '--max-turns', '2']`.
  - `runTrigger(opts, deps = { spawn, mkdtemp, rm, writeFile, log }) -> Promise<{ exitCode, results }>`: `opts` = `{ casesFile, pluginDir, work, out, lang: 'pt'|'en'|'both', only?: string[], dryRun }`; por caso e idioma cria um sandbox vazio com `git init` sob `work`, roda `claude` com `buildArgs` e `cwd` no sandbox, pontua e apaga o sandbox; grava `renderTable` em `out`. `--dry-run` só registra, por caso e idioma, a linha de comando (`claude` + argumentos citados), sem chamar `claude` nem criar sandbox, e não grava `out`.
  - CLI: `node tools/measure/run-trigger.mjs --plugin-dir <dir> --work <dir> --out <file> [--cases <json>] [--lang pt|en|both] [--only <id,...>] [--dry-run]`; `--work` dentro do repositório → exit 1 (mesma regra de `insideRepo` de `make-scenario.mjs`); argumento faltando → exit 2 com o uso.
- Fixture `no-skill.jsonl`: `init` sem superpowers e só texto do assistente, sem `tool_use`.

- [ ] **Passo 1: escrever os testes que falham** em `run-trigger.test.mjs`:
  - `cases.json covers four categories with at least three cases each`: ids únicos; `prompt.pt` e `prompt.en` não vazios; `expect` coerente com a categoria; contagem ≥ 3 por categoria; pares `plan`↔`roadmap` e `plan`↔`plan-execution` presentes via `pairOf` (o caso apontado existe).
  - `dry-run lists one command per case and language without spawning`: `runTrigger({ ..., dryRun: true, lang: 'both' }, { spawn: () => { throw new Error('spawned'); }, log })` → `exitCode: 0`, linhas registradas = 2 × número de casos, cada uma contém `--plugin-dir`, `stream-json` e `--max-turns 2`.
  - `run scores cases from recorded transcripts`: `spawn` falso que devolve como `stdout` o fixture `no-skill.jsonl` → todo resultado com `got: null`, `hit: false`, `superpowers: false`; o arquivo `out` (em pasta temporária do teste) contém a tabela.
  - `buildArgs keeps the prompt as one argument`: prompt com espaços e aspas → é um único item do array.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/run-trigger.test.mjs` → FAIL nos casos novos (`cases.json` ausente, `runTrigger` não exportado).
- [ ] **Passo 3: escrever `cases.json` e o fixture, e implementar** `buildArgs`, `runTrigger` e a CLI.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0. Conferência manual sem custo: `node tools/measure/run-trigger.mjs --plugin-dir plugins/productivity-tools --work D:/projects/claude-play-wt/_tmp/E20/trigger --out D:/projects/claude-play-wt/_tmp/E20/trigger.md --dry-run` → exit 0 e uma linha por caso e idioma; apagar `D:/projects/claude-play-wt/_tmp/E20/` depois.
- [ ] **Passo 5: gates completos** → todos exit 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add tools/measure/trigger/cases.json tools/measure/fixtures/trigger/no-skill.jsonl tools/measure/run-trigger.mjs tools/measure/run-trigger.test.mjs
  git commit -m "E20 T8: casos de gatilho, executor e dry-run da suíte" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 9: variante `plan-author` do cenário

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `tools/measure/scenario/plan-author-spec.md`
- Create: `tools/measure/scenario/plan-writer-spec.md`
- Modify: `tools/measure/make-scenario.mjs`
- Test: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Produces: `VARIANTS` com 15 itens, o último `'plan-author'`; `makeScenario(dir, 'plan-author')` monta o sandbox de `makeSandbox` e grava, com `writeIn` e `readText` (LF): `docs/plans/roadmap-sandbox-E5/spec.md` (texto de `plan-author-spec.md`: spec `spec/1`, `id: "E5"`, `mode: "unattended"`, critérios iguais aos do card E5 do sandbox com a marca `{verify: ...}`), `docs/plans/word-count/spec.md` (texto de `plan-writer-spec.md`: spec `spec/1`, `id: "word-count"`, `mode: "interactive"`, uma função `wordCount(text)` em `src/word-count.mjs`, critérios com `{verify: test; evidence: node --test tests/word-count.test.mjs}`) e `docs/superpowers/plans/2026-01-01-e5-text-utilities.md` (cópia de `tools/measure/scenario/e5/plan.md`, plano em prosa com `**Roadmap:** docs/plans/roadmap-sandbox/`); commita `docs: E5 spec, word-count spec and legacy E5 plan`; devolve `prompts: []`, `stopResume: null`, `seeded: []`; não grava `settings.local.json`. A Tarefa 12 usa `node tools/measure/make-scenario.mjs <dir> --variant plan-author`.

- [ ] **Passo 1: escrever os testes que falham** em `make-scenario.test.mjs`:
  - atualizar `lists every variant of the spec table`: incluir `'plan-author'`, `VARIANTS.length === 15`, último item `'plan-author'`.
  - `E20: plan-author variant writes the E5 spec, the word-count spec and the legacy plan`: os três arquivos existem no sandbox sem `\r`; `git status --porcelain` vazio; último commit `docs: E5 spec, word-count spec and legacy E5 plan`; `s.prompts` vazio; nenhum `settings.local.json`.
  - `E20: the E5 spec passes spec-tool against the sandbox roadmap`: `node plugins/productivity-tools/scripts/spec-tool.mjs check <sandbox>/docs/plans/roadmap-sandbox-E5/spec.md --roadmap <sandbox>/docs/plans/roadmap-sandbox --json` → status 0.
  - `E20: the word-count spec passes spec-tool outside a roadmap`: `spec-tool.mjs check <sandbox>/docs/plans/word-count/spec.md --json` → status 0; a pasta não tem sufixo `-E<n>`.
  - `E20: the legacy plan has no data block and names the sandbox roadmap`: `readDataBlock` (de `plugins/productivity-tools/lib/data-block.mjs`) devolve erro `data-block-missing`; o texto contém `**Roadmap:** docs/plans/roadmap-sandbox/`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/make-scenario.test.mjs` → FAIL em "lists every variant" e nos quatro casos E20 (`unknown variant: plan-author`).
- [ ] **Passo 3: escrever os dois specs e implementar** o `case 'plan-author'` e o item em `VARIANTS`. Se `spec-tool check --roadmap` acusar critério divergente, copiar o texto do card E5 de `make-sandbox.mjs` literalmente (o roadmap do sandbox não muda).
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add tools/measure/scenario/plan-author-spec.md tools/measure/scenario/plan-writer-spec.md tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
  git commit -m "E20 T9: variante plan-author do cenário com specs e plano antigo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 10: roteiro sintético da aprovação da adoção

**tier:** haiku · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `tools/measure/scenario/plan-writer-adopt.md`
- Test: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Produces: `plan-writer-adopt.md` com primeira linha `<!-- synthetic input: scripted approval for the E20 behavioral run, not a person -->`, seção `## Request` (adotar `docs/superpowers/plans/2026-01-01-e5-text-utilities.md`) e seção `## Approval` com a única palavra `approve` (como DEC-419). Usado pela Tarefa 12, critério 4.

- [ ] **Passo 1: escrever o teste que falha** `E20: plan-writer adopt script is marked synthetic and approves` em `make-scenario.test.mjs`: o arquivo começa com `<!-- synthetic input:`; tem `## Request` citando o caminho do plano antigo e `## Approval` seguido de `approve`; não casa `/(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]/`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/make-scenario.test.mjs` → FAIL (`ENOENT`).
- [ ] **Passo 3: escrever o roteiro.**
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0. Gates completos → todos exit 0.
- [ ] **Passo 5: commit.**
  ```bash
  git add tools/measure/scenario/plan-writer-adopt.md tools/measure/make-scenario.test.mjs
  git commit -m "E20 T10: roteiro sintético da aprovação da adoção" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 11: README do plugin

**tier:** haiku · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/README.md`

**Interfaces:**
- Consumes: nomes e descrições das Tarefas 3 e 4.

- [ ] **Passo 1: editar.** Linha `plan-writer` na tabela "Skills", logo depois de `spec-writer` (gatilho: an implementation plan for a checked spec, or adopting an old plan with no data block: "write the plan for this spec", "adopt this plan"; descrição: dispatches the `plan-author` agent, writes `plan.md` next to the spec with no approval; adoption mode rewrites an old plan in place after one approval; not for specs, roadmaps or execution). Na seção `## Agents`, um item **plan-author** (`agents/plan-author.md`, `model: opus`, `effort: medium`) no formato do item de `spec-author`. Linha de `plan-writer` na tabela "Output Directories" (`docs/plans/<topic>/plan.md`, or the old plan's own path in adoption mode). Versão não muda.
- [ ] **Passo 2: verificação.** `git diff --stat` mostra só o README; `grep -c "bypassPermissions" plugins/productivity-tools/README.md` → `0`; `node --test plugins/productivity-tools/scripts/independence.test.mjs` → exit 0; gates completos → todos exit 0 (G5 confere a linha de versão do README da raiz, que não muda).
- [ ] **Passo 3: commit.**
  ```bash
  git add plugins/productivity-tools/README.md
  git commit -m "E20 T11: README com plan-writer e o agente plan-author" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 12: execuções comportamentais e relatório (critérios 1, 2 e 4; REQ-037; pendência de E19)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Executada pelo orquestrador da sessão principal (DEC-204), não por um executor sem ferramenta de subagent.** Cada execução é uma sessão `claude -p` lançada pelo orquestrador, com o sandbox como diretório de trabalho e `--plugin-dir D:/projects/claude-play-wt/E20/plugins/productivity-tools --model opus --permission-mode bypassPermissions --output-format stream-json --verbose` (instrução do dono; as sessões são do orquestrador, nada embarcado indica esse modo). Essa sessão tem a ferramenta Agent e despacha os agentes por nome do plugin, sem forma de reserva. Roda na worktree `D:/projects/claude-play-wt/E20`, na `feat/E20`, depois das Tarefas 1 a 11 e antes do merge, sem efeito externo: os sandboxes ficam em `D:/projects/claude-play-wt/_tmp/E20/` (fora do repositório) e são apagados ao fim. Nenhum `AskUserQuestion` dirigido ao dono: a aprovação do critério 4 vem do roteiro sintético. O aceite é do dono; esta tarefa não registra aceite.

**Files:**
- Create: `docs/reports/2026-11-12-E20-autor-plano-comportamental.md` (escrito pelo orquestrador: subagents não gravam arquivos com nome de relatório)

Em todas as execuções, guardar do `stream-json`: a origem do plugin carregado (evento `init`: caminho de `productivity-tools` igual ao `--plugin-dir`), o modelo das mensagens do subagent (opus) e as ferramentas que ele usou (só `Read, Grep, Glob, Bash, Write, Edit`). `planTool` = `D:/projects/claude-play-wt/E20/plugins/productivity-tools/scripts/plan-tool.mjs`; `specTool` = `D:/projects/claude-play-wt/E20/plugins/productivity-tools/scripts/spec-tool.mjs`.

- [ ] **Passo 1: pendência de E19 (DEC-400).** `node tools/measure/make-scenario.mjs D:/projects/claude-play-wt/_tmp/E20/e19 --variant spec-author`; sessão que despacha `productivity-tools:spec-author` por nome com `mode: unattended`, `output: <sandbox>/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md`, `specTool`, `language: English`, `roadmap: <sandbox>/docs/plans/roadmap-sandbox`, `card: E6`. Conferir: agente achado pelo nome; modelo opus; ferramentas da lista; `node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json` → exit 0.
- [ ] **Passo 2: critério 1, três execuções.** Para `i` em 1, 2, 3: `node tools/measure/make-scenario.mjs D:/projects/claude-play-wt/_tmp/E20/c1-<i> --variant plan-author`; sessão que despacha `productivity-tools:plan-author` com `mode: unattended`, `output: <sandbox>/docs/plans/roadmap-sandbox-E5/plan.md`, `planTool`, `spec: <sandbox>/docs/plans/roadmap-sandbox-E5/spec.md`, `language: English`, `roadmap: docs/plans/roadmap-sandbox/`, `card: E5`. Conferir e guardar literal: `node "<planTool>" check "<output>" --json` → exit 0; o campo `roadmap` do bloco = `docs/plans/roadmap-sandbox/`; no máximo três chamadas de `check` na transcrição do agente; nenhuma chamada de `AskUserQuestion` e nenhuma pergunta à pessoa na saída; a última mensagem do agente é o JSON de `emit`; modelo e ferramentas como acima.
- [ ] **Passo 3: critério 2, uma execução.** Sandbox `D:/projects/claude-play-wt/_tmp/E20/c2` da variante `plan-author`; sessão com o prompt `/productivity-tools:plan-writer docs/plans/word-count/spec.md`. Conferir: `docs/plans/word-count/plan.md` gravado; `node "<planTool>" check "<sandbox>/docs/plans/word-count/plan.md" --json` → exit 0; campo `roadmap` do bloco `null`; nenhuma pergunta de aprovação; a saída mostra o `plan-tool summary`; lista de ambiguidades do SKILL.md encontradas.
- [ ] **Passo 4: critério 4, uma execução.** Sandbox `D:/projects/claude-play-wt/_tmp/E20/c4` da variante `plan-author`; sessão com o prompt `/productivity-tools:plan-writer docs/superpowers/plans/2026-01-01-e5-text-utilities.md` e a instrução de, onde a skill chamaria `AskUserQuestion`, gravar o texto literal da aprovação e tomar a resposta de `tools/measure/scenario/plan-writer-adopt.md` (entrada sintética, marcada). Conferir: a seção `## Adoção` e a pasta do roadmap mostradas antes da aprovação; uma aprovação pedida; o plano gravado no mesmo caminho; `node "<planTool>" check "<sandbox>/docs/superpowers/plans/2026-01-01-e5-text-utilities.md" --json` → exit 0; campo `roadmap` do bloco = `docs/plans/roadmap-sandbox/`; o provisório `.adopted.md` apagado; se a skill despachou `spec-author` (o plano antigo não cita spec `spec/1`), o spec gravado em `docs/plans/<tópico>/spec.md` com `spec-tool check` em 0.
- [ ] **Passo 5: revisão adversarial somente leitura** dos resultados dos critérios 2 e 4 e do SKILL.md (subagent `model: sonnet`, instruído a não editar), achados literais no relatório.
- [ ] **Passo 6: relatório** `docs/reports/2026-11-12-E20-autor-plano-comportamental.md`: data, commit da branch, forma de despacho (por nome, plugin da worktree), modelos e esforços; por execução: entrada, saídas literais dos comandos, resultado esperado, resultado obtido; a nota de que a aprovação do critério 4 veio do roteiro sintético, não de uma pessoa; achados da revisão; a linha "aceite: aguardando o dono" para cada critério; a nota de que a rodada paga da suíte de gatilho (critério 5) é do dono, com o comando `node tools/measure/run-trigger.mjs --plugin-dir <plugin> --work <pasta fora do repositório> --out docs/reports/<data>-E20-gatilho.md --lang both`. Nenhum valor de credencial.
- [ ] **Passo 7: limpar e verificar.** Apagar `D:/projects/claude-play-wt/_tmp/E20/`; gates completos → todos exit 0 (o relatório não muda nenhum gate).
- [ ] **Passo 8: commit.**
  ```bash
  git add docs/reports/2026-11-12-E20-autor-plano-comportamental.md
  git commit -m "E20 T12: relatório das execuções comportamentais do autor de plano" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

Se uma execução falhar uma conferência, o relatório registra a falha literal; a correção volta à tarefa dona do arquivo (3, 4 ou 9) e as execuções do critério afetado rodam de novo, sem apagar as anteriores do relatório.

## Decisões deste plano (origem executor, pendentes para o dono)

1. Os testes estruturais do agente, da skill, dos ponteiros e do contrato de `progress.mjs` ficam todos em `independence.test.mjs` (arquivo do card), não em `plan-tool.test.mjs`, para que E13 estenda um só arquivo. Alcance: local.
2. `spec-tool.mjs` exporta as tabelas de decisões e de pessoas (`formatRecords`, `mdTable`, `SUMMARY_LABELS`) e `plan-tool summary` as reusa, para os dois resumos terem o mesmo formato. Alcance: local.
3. A suíte de gatilho usa as categorias `spec`, `plan`, `roadmap`, `plan-execution` e liga pares próximos por `pairOf`, o que torna o risco 2 do card conferível por teste. Alcance: local.
4. O executor cria cada sandbox com `git init` sob uma pasta `--work` obrigatória, recusada dentro do repositório. Alcance: local.
5. O cabeçalho da seção de adoção é sempre `## Adoção`, literal da spec, em qualquer idioma do plano, para a skill achá-lo sem depender do idioma. Alcance: local.
6. A variante `plan-author` grava também o spec fora de roadmap (`docs/plans/word-count/spec.md`) para o critério 2 usar o mesmo sandbox montado. Alcance: local.
7. O formato do evento `init` (`plugins[].name`, `skills`, `slash_commands`) é suposto a partir do `stream-json` documentado; a Tarefa 12 grava o `init` real de cada execução no relatório, e uma divergência volta à Tarefa 7. Alcance: local.

## Acceptance criteria evidence

| AC | kind | command | testRef | blq | external | externalDedupe | evidence |
|---|---|---|---|---|---|---|---|
| AC1 | human | - | - | - | false | - | o dono confere o resultado das execuções comportamentais registrado em docs/reports (`docs/reports/2026-11-12-E20-autor-plano-comportamental.md`, Tarefa 12, passo 2: três execuções de `plan-author`, check exit 0 em até três tentativas, nenhuma pergunta) |
| AC2 | human | - | - | - | false | - | o dono confere o resultado da execução comportamental registrado em docs/reports (`docs/reports/2026-11-12-E20-autor-plano-comportamental.md`, Tarefa 12, passo 3: `plan-writer` grava `docs/plans/word-count/plan.md` com check exit 0) |
| AC3 | test | node --test plugins/productivity-tools/scripts/independence.test.mjs | plugins/productivity-tools/scripts/independence.test.mjs: "E20: no published planner, tracker or E20 file mentions superpowers (criterion 3)" | - | false | - | Tarefa 6 |
| AC4 | human | - | - | - | false | - | o dono confere o resultado da execução comportamental registrado em docs/reports (`docs/reports/2026-11-12-E20-autor-plano-comportamental.md`, Tarefa 12, passo 4: seção `## Adoção` mostrada, uma aprovação, plano no mesmo caminho com check exit 0) |
| AC5 | human | - | - | - | false | - | o dono roda a suíte e confere o resultado registrado em docs/reports (`node tools/measure/run-trigger.mjs ... --out docs/reports/<data>-E20-gatilho.md`; suíte, executor e testes entregues nas Tarefas 7 e 8) |
