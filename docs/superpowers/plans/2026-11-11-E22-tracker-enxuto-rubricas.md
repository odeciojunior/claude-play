# E22 -- Tracker enxuto com rubricas: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** a skill `roadmap-tracker` chama a CLI de E3 em todo passo que ela cobre, carrega por evento só o SKILL.md, o índice `events.md`, o arquivo da receita, a rubrica que a receita cita e as seções `formats.md § N` citadas, com carga máxima ≤ 29.096 bytes LF, e ganha duas rubricas com exemplos (contradição; conferência de critérios no fechamento).

**Arquitetura:** `references/events.md` vira índice (tabela `| § | Event | Recipe file |` + bloco Common) e as 20 receitas vão para `references/events/NN-<slug>.md`, com a numeração atual, para que as citações `events.md § N` de fora continuem válidas. As receitas trocam por comando de `scripts/roadmap.mjs` todo passo que a CLI cobre e citam o contrato só por seção. `plugins/productivity-tools/scripts/prose-budget.test.mjs` calcula a carga de cada evento lendo os arquivos do disco e confere o orçamento e a ausência do contrato inteiro.

**Tecnologia:** Markdown (texto das skills em inglês, como o resto do plugin); Node >= 18 (medido: v22.17.1), ESM, sem dependências, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-11-E22-tracker-enxuto-rubricas-design.md` (ler junto com este plano; as seções "Receitas", "SKILL.md enxuto", "Rubricas", "Meta derivada de prosa" e "Execuções comportamentais" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell, `core.autocrlf=true` (checkouts CRLF), Node v22.17.1, claude CLI 2.1.322. Toda contagem de bytes normaliza com `.replace(/\r\n?/g, '\n')` antes de `Buffer.byteLength`; nada depende do final de linha do checkout.
- Worktree `D:/projects/claude-play-wt/E22`, branch `feat/E22` (já sincronizada com `release/roadmap-skills-v2` depois da ratificação de E3: DEC-200 a DEC-202, DEC-209; BLQ-3 fechado). Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E22/` (criar e apagar no fim da tarefa).
- Não editar (spec, "Não objetivos"): `scripts/roadmap.mjs`, `scripts/check-roadmap.mjs` e testes do tracker, `plugins/productivity-tools/lib/`, `roadmap-planner/` (inclusive `formats.md` e `decompose.md`), o workflow do release e o preflight, `.claude/rules/`, `plugins/_template/`, `docs/plans/roadmap-evolucao-skills/` e a estratégia. Sem subir versão de `productivity-tools` (DEC-042); `formatVersion` continua 1; a linha 1 do checker não muda.
- Forma da CLI em toda receita (DEC-136): `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" <comando> "<pasta>" [opções] [--json]`. Comandos existentes (conferidos em `roadmap.mjs`): `next-id`, `add-decision`, `add-pending`, `ratify` (vários `DEC-NNN`; `--amend <texto>` só com um), `reject <DEC-NNN> --decision <texto>`, `log`, `set-status`, `verify-commit`, `integrate`, `inflight-add`, `inflight-remove`, `block-open`, `block-close`, `refresh-checker`, `prune`, `status`, `brief`, `pending-decisions`. Nenhum outro comando pode ser citado.
- Código de saída da CLI (DEC-138, DEC-143): a regra fica uma vez no SKILL.md (0 feito ou no-op; 1 recusado, nada mudou, relatar e nunca contornar editando à mão; 2 parar e relatar). Receita não chama `log` depois de comando que grava a própria linha (DEC-149): `integrate`, `ratify`, `reject`, `block-open`, `block-close`, `refresh-checker` (só esses chamam `logRow` em `roadmap.mjs`). `add-decision`, `add-pending`, `inflight-add`, `inflight-remove`, `set-status` e `prune` não gravam linha de log: a receita agrega o `log` depois deles, como a DEC-149 manda ("o chamador agrega").
- Toda menção a `formats.md` em SKILL.md, `events.md`, receitas e rubricas vem seguida de `§ <n>` (com ou sem crase entre eles), salvo a linha de tabela do SKILL.md que começa com `| Format contract`. As receitas citam só as seções que tocam (cada seção citada entra inteira na carga: § 1 1.021, § 2 5.520, § 3 3.040, § 4 4.030, § 5 6.382, § 6 4.988, § 7 2.239, § 8 1.934, § 9 4.689 bytes LF, medido na `feat/E22`).
- Orçamento por arquivo (guia para caber em 29.096 no pior evento, § 1 = SKILL + índice + receita + rubrica + `formats.md § 6`): SKILL.md ≤ 8.000, `events.md` ≤ 4.500, cada rubrica ≤ 5.000, `01-decision.md` ≤ 4.500 bytes LF. O SKILL.md não cita `formats.md § N` além do mínimo (cada seção citada nele entra na carga de todos os eventos).
- Anti-objetivos da spec valem para toda tarefa: nenhuma regra necessária some (nunca commitar, nunca inventar número, estratégia só por revisão aprovada, `no questions`, palavras de status posicionais, IDs nunca reusados, 0 erros no checker); prosa obrigatória não vai para arquivo fora da contagem; receita não manda editar à mão o que a CLI faz; rubrica tem exemplos no formato do roadmap.
- Commits: `E22 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (linha de base do alvo: G1 exit 0, total 1286, skipped 0, nenhum falhando; G2-G5 exit 0; nenhuma falha é esperada em nenhuma tarefa):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total ≥ 1286, failing 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
- Nenhuma tarefa precisa de navegador, de servidor (faixa 5210-5219 não usada), de lock, de credencial, nem tem efeito externo. Todas rodam na worktree do entregável antes do merge. Quando um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando que mostra o motivo, registrada no relatório da tarefa; para a Tarefa 8, se o executor não tiver ferramenta de subagent, a tarefa é do orquestrador da sessão principal (DEC-204), nunca simulada.

## Foco da revisão

1. Checkout CRLF: a carga em bytes tem de ser a mesma num checkout LF e num CRLF; teste com texto CRLF sintético na Tarefa 1 (`lfBytes`).
2. Menção a `formats.md` em formas variadas (`` `formats.md` § 6 ``, `formats.md §6`, `formats.md § 6.`, `formats.md` sem seção no meio de uma frase): `sectionsCited` pega a seção nas três primeiras e `unsectionedMentions` acusa a quarta; teste com strings sintéticas na Tarefa 7.
3. Índice fora de sincronia (arquivo em `events/` ausente da tabela, linha duplicada, linha apontando arquivo inexistente): a conferência (a) falha nomeando o arquivo; teste com strings sintéticas de índice na Tarefa 1 (`parseIndex` + `indexProblems`).
4. Referência nova órfã em `references/` (uma rubrica que nenhuma receita cita): a conferência (d) falha nomeando o arquivo; teste com lista sintética na Tarefa 1 (`orphanReferences`).
5. SKILL.md citando uma rubrica na tabela de caminhos: isso não a põe na carga de todo evento (só a receita puxa referência), mas uma `formats.md § N` citada no SKILL.md entra em toda carga; teste em `loadFor` com textos sintéticos na Tarefa 7.

---

## Mapa de arquivos

Prefixo `T` = `plugins/productivity-tools/skills/roadmap-tracker`.

| Arquivo | Responsabilidade | Tarefas |
|---|---|---|
| `plugins/productivity-tools/scripts/prose-budget.test.mjs` (novo) | helpers puros + conferências (a)-(e) | 1, 7 |
| `T/references/events.md` | índice + Common | 1 (índice), 7 (Common enxuto) |
| `T/references/events/NN-<slug>.md` (20 novos) | uma receita por arquivo | 1 (divisão), 2-6 (edição) |
| `T/references/rubric-contradiction.md` (novo) | rubrica de contradição | 2 |
| `T/references/rubric-criteria.md` (novo) | rubrica de critérios no fechamento | 3 |
| `T/SKILL.md` | SKILL enxuto | 7 |
| `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` (novo) | relatório comportamental (critérios 2 e 3, REQ-037) | 8 |
| `docs/reports/2026-11-11-e22-rubricas/` (novo) | entradas e saídas das execuções | 8 |

Nomes dos 20 arquivos de receita (numeração de `events.md` preservada): `01-decision.md`, `02-piece-closed.md`, `03-integration.md`, `04-branch-deleted.md`, `05-blocker.md`, `06-measurement.md`, `07-new-source.md`, `08-new-requirement.md`, `09-revision.md`, `10-checker-refresh.md`, `11-migration.md`, `12-package-published.md`, `13-do-not-do-now.md`, `14-plan-coordinator.md`, `15-merge-release.md`, `16-release-integrated.md`, `17-acceptance-pending.md`, `18-executor-decision.md`, `19-criteria-check.md`, `20-spec-plan-started.md`.

As tarefas são sequenciais: 1 antes de todas; 2 a 6 tocam receitas disjuntas e podem rodar em paralelo entre si depois de 1; 7 depois de 2-6 (o orçamento depende das receitas e rubricas finais); 8 por último.

---

### Tarefa 1: divisão de `events.md` em 20 receitas e teste do índice

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar (teste): `plugins/productivity-tools/scripts/prose-budget.test.mjs`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events.md`
- Criar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/01-decision.md` ... `20-spec-plan-started.md` (os 20 nomes do mapa de arquivos)

Divisão mecânica (pacote único por diretório, teto mecânico de routing.md §3.2): só a linha de título muda; o corpo de cada seção vai byte a byte (LF) para o arquivo.

**Interfaces:**
- Produz, exportadas de `prose-budget.test.mjs` (o arquivo é teste e módulo; os `test(...)` ficam no mesmo arquivo):
  - `lfBytes(text: string) -> number` = `Buffer.byteLength(text.replace(/\r\n?/g, '\n'))`.
  - `parseIndex(eventsMd: string) -> Array<{ n: number, event: string, file: string }>`: linhas da tabela `| § | Event | Recipe file |`; `file` sem crases, relativo a `references/` (`events/01-decision.md`).
  - `indexProblems(rows, filesOnDisk: string[]) -> string[]`: mensagens para arquivo do disco fora da tabela, arquivo da tabela inexistente, arquivo repetido, `n` repetido ou fora de 1..20.
  - `orphanReferences(allRefs: string[], loads: Array<Set<string>>) -> string[]`: arquivos de `references/` (relativos, recursivo) que não estão em nenhuma carga.
  - `recipeLoadFiles(skillDir, row) -> Set<string>` (provisória, completada na Tarefa 7): `SKILL.md`, `references/events.md`, `references/<row.file>` e todo arquivo de `references/` (fora `events.md` e `events/`) cujo nome base aparece no texto da receita.
  - Caminhos a partir de `import.meta.url`: `SKILL_DIR = ../skills/roadmap-tracker/`, `FORMATS = ../skills/roadmap-planner/references/formats.md`.

- [ ] **Passo 1: testes que falham** em `prose-budget.test.mjs`:
  - `lfBytes('a\r\nb\rc\n') === lfBytes('a\nb\nc\n')` (foco 1).
  - `indexProblems` com índice sintético: arquivo extra no disco, linha para arquivo inexistente e linha duplicada → uma mensagem cada, com o nome do arquivo; índice correto → `[]` (foco 3).
  - `orphanReferences(['rubric-x.md', 'events/01-a.md'], [new Set(['events/01-a.md'])])` → `['rubric-x.md']` (foco 4).
  - (a) real: `indexProblems(parseIndex(events.md), readdirSync(references/events))` → `[]` e 20 linhas, `n` de 1 a 20.
  - (d) real: `orphanReferences` sobre todos os arquivos de `references/` (recursivo, menos `events.md`) e as 20 cargas → `[]`.
  Rodar: `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → FAIL em (a) (não há tabela nem `references/events/`).

- [ ] **Passo 2: dividir** com um script em `D:/projects/claude-play-wt/_tmp/E22/split.mjs` (não commitado): para cada `## N. <Event>` de `events.md`, gravar `events/<nome do mapa>` com a primeira linha `# § N. <Event>` e o corpo seguinte inalterado (LF); reescrever `events.md` com o título, um parágrafo de propósito (citações `events.md § N` resolvem pela tabela), a tabela `| § | Event | Recipe file |` com as 20 linhas (arquivo em crases) e o bloco "Common to every recipe" inalterado. O sumário `## Contents` sai (a tabela o substitui).

- [ ] **Passo 3: conferir a preservação** com `D:/projects/claude-play-wt/_tmp/E22/check-split.mjs`: para cada N, o corpo do arquivo (sem a linha 1) é idêntico (LF) ao corpo da seção `## N.` de `git show HEAD:plugins/productivity-tools/skills/roadmap-tracker/references/events.md`, e o bloco Common é idêntico. Esperado: 21 linhas `ok`, exit 0. Apagar `D:/projects/claude-play-wt/_tmp/E22/`.

- [ ] **Passo 4: verificar** — o comando do Passo 1 → PASS; G1 → exit 0, failing 0; G5 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-tracker/references/events.md plugins/productivity-tools/skills/roadmap-tracker/references/events/
git commit -m "E22 T1: events.md vira índice e as 20 receitas vão para references/events" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 2: rubrica de contradição e receitas de decisão (§ 1, § 18)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-tracker/references/rubric-contradiction.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/01-decision.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/18-executor-decision.md`

**Interfaces:**
- Consome: arquivos de receita da Tarefa 1; `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` (a, d).
- Produz: `rubric-contradiction.md`, citado pelo nome nas receitas § 1 e § 18 (é o que a põe na carga desses eventos).

- [ ] **Passo 1: rubrica** conforme a spec, "Rubricas (peça 2)": pergunta única; lista do que a estratégia afirma; classes `contradiz`, `detalha`, `diverge de DEC`, `incerto` (com o padrão atual de `no questions`); testes de desempate (inclusive `ratify --amend` → `-` por DEC-209 salvo se mudar a estratégia); ≥ 3 exemplos `contradiz` e ≥ 3 `detalha`, cada um como linha de `decisions.md` no formato da pasta, sobre a pasta `scripts/fixtures/valid` (marcados "example"), com a célula Contradicts esperada e uma frase de motivo. Texto em inglês, ≤ 5.000 bytes LF, sem citar `formats.md` sem `§ N`.

- [ ] **Passo 2: receita § 1**: a classificação da célula Contradicts aponta a rubrica (o texto de critério sai da receita); ID por `next-id DEC`; novo passo "Rejection of a recorded executor decision" com `reject <DEC-NNN> --decision <text>` (linha nova Origin `user`, a antiga vira substituída, o pendente sai; recusa `not-executor`/`not-pending` = código 1, relatada); a linha de Origin `user` comum e a troca de Status por `substituída por` continuam edição citando `formats.md § 6`; `log` só onde nenhum comando grava a linha. Mantém **When** e `Checker:`. ≤ 4.500 bytes LF.

- [ ] **Passo 3: receita § 18**: `add-decision --scope`, `add-pending`, `ratify` (vários DEC numa chamada), `ratify <DEC-NNN> --amend <text>`, `reject` (aponta § 1), `--what` onde a spec (DEC-202) o prevê; a classificação aponta a rubrica; recusas da CLI citadas pelos códigos de DEC-139.

- [ ] **Passo 4: verificar**
  - `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → PASS (a, d; a rubrica está na carga de § 1).
  - `grep -n "formats.md" <os 3 arquivos>` → toda linha com `formats.md` tem `§` logo depois.
  - G1 e G5 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/rubric-contradiction.md plugins/productivity-tools/skills/roadmap-tracker/references/events/01-decision.md plugins/productivity-tools/skills/roadmap-tracker/references/events/18-executor-decision.md
git commit -m "E22 T2: rubrica de contradição e receitas de decisão pela CLI (reject, ratify --amend)" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 3: rubrica de critérios e receitas § 17, § 19, § 20

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-tracker/references/rubric-criteria.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/19-criteria-check.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/17-acceptance-pending.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/20-spec-plan-started.md`

**Interfaces:**
- Consome: Tarefa 1. Produz: `rubric-criteria.md`, citado pelo nome só em § 19.

- [ ] **Passo 1: rubrica** conforme a spec: classes `igual`, `acrescentado`, `enfraquecido`, `reinterpretado`, `ausente`; lista fechada de sinais de `enfraquecido` (Dado/Quando estreitado; resultado afrouxado; `verify` mais fraco: `test`/`smoke`/`integration` → `human`, qualquer → `blocked` sem bloqueio no card, ou evidência sem comando que exercite o critério; caso negativo removido; critério ausente), um par card/spec por sinal no formato de critério do card com `{verify: ...}`; saída: um pendente por critério não `igual` no formato "(owner) card says <A>, spec says <B>: confirm" com a classe; nunca editar o card. ≤ 5.000 bytes LF.

- [ ] **Passo 2: receitas**: § 19 aponta a rubrica e mantém o log ("criteria compared: none changed" válido); § 17 e § 20 trocam por `set-status`, `inflight-add` e `log` os passos que a CLI cobre (sem `log` depois de comando que grava a própria linha). Mantêm **When** e `Checker:`.

- [ ] **Passo 3: verificar** — `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → PASS; `grep -n "formats.md"` nos 4 arquivos → só com `§`; G1 e G5 → exit 0.

- [ ] **Passo 4: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/rubric-criteria.md plugins/productivity-tools/skills/roadmap-tracker/references/events/19-criteria-check.md plugins/productivity-tools/skills/roadmap-tracker/references/events/17-acceptance-pending.md plugins/productivity-tools/skills/roadmap-tracker/references/events/20-spec-plan-started.md
git commit -m "E22 T3: rubrica de conferência de critérios e receitas 17, 19 e 20 pela CLI" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 4: receitas § 2, § 3, § 4, § 5 pela CLI

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/02-piece-closed.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/03-integration.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/04-branch-deleted.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/05-blocker.md`

**Interfaces:** consome a Tarefa 1; segue o mapa "Receitas" da spec.

- [ ] **Passo 1: editar**: § 2 `set-status --piece`, `log`; § 3 `verify-commit`, `integrate`, `inflight-remove`, com o aviso `no-git` (DEC-201) relatado e o status integrado ou posterior recusado sem git; § 4 `inflight-remove`, `log`; § 5 `block-open` (`--what` é o texto do bloqueio, DEC-202) e `block-close` (recusas de DEC-148 relatadas). O que a CLI não cobre continua passo da receita citando `formats.md § N`. Mantêm **When** e `Checker:`.

- [ ] **Passo 2: verificar** — `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → PASS; `grep -n "formats.md"` nos 4 arquivos → só com `§`; `grep -nE "roadmap\.mjs\"? [a-z-]+" <os 4 arquivos>` → só comandos da lista das restrições globais; G1 e G5 → exit 0.

- [ ] **Passo 3: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/events/02-piece-closed.md plugins/productivity-tools/skills/roadmap-tracker/references/events/03-integration.md plugins/productivity-tools/skills/roadmap-tracker/references/events/04-branch-deleted.md plugins/productivity-tools/skills/roadmap-tracker/references/events/05-blocker.md
git commit -m "E22 T4: receitas 2 a 5 pela CLI" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 5: receitas § 10, § 11, § 15, § 16

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/10-checker-refresh.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/11-migration.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/15-merge-release.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/16-release-integrated.md`

**Interfaces:** consome a Tarefa 1. Produz: `10-checker-refresh.md` passa a conter o detalhe hoje no passo 2 do SKILL.md (comparação de versões da linha 1, `refresh-checker`); `11-migration.md` contém a comparação das três versões de formato hoje no passo 3 do SKILL.md (a Tarefa 7 corta esses passos do SKILL.md e aponta para cá).

- [ ] **Passo 1: editar**: § 10 `refresh-checker` (+ o detalhe do passo 2 do SKILL.md, sem repetir o que o comando faz); § 11 sem comando, cita `formats.md § 1` / `§ 2` / `§ 9` conforme o que toca (toda menção com `§`), recebe a comparação das três versões; § 15 `set-status`, `inflight-add`, `log`; § 16 `verify-commit`, `integrate`, `inflight-remove`, aviso `no-git`. Mantêm **When** e `Checker:`.

- [ ] **Passo 2: verificar** — como na Tarefa 4, sobre estes 4 arquivos.

- [ ] **Passo 3: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/events/10-checker-refresh.md plugins/productivity-tools/skills/roadmap-tracker/references/events/11-migration.md plugins/productivity-tools/skills/roadmap-tracker/references/events/15-merge-release.md plugins/productivity-tools/skills/roadmap-tracker/references/events/16-release-integrated.md
git commit -m "E22 T5: receitas 10, 11, 15 e 16 (refresh, migração, merge e integração da release)" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 6: receitas sem comando (§ 6, § 7, § 8, § 9) e § 12, § 13, § 14

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

Duas metades de até quatro arquivos, cada uma com o próprio commit (6a e 6b), na mesma tarefa porque a mudança é a mesma: citar o contrato por seção.

**Arquivos:**
- 6a — Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/06-measurement.md`, `.../events/07-new-source.md`, `.../events/08-new-requirement.md`, `.../events/09-revision.md`
- 6b — Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events/12-package-published.md`, `.../events/13-do-not-do-now.md`, `.../events/14-plan-coordinator.md`

(prefixo `...` = `plugins/productivity-tools/skills/roadmap-tracker/references`)

**Interfaces:** consome a Tarefa 1. Produz: `09-revision.md` é o único lugar do procedimento de revisão (a Tarefa 7 corta a repetição do SKILL.md, passo 6).

- [ ] **Passo 1 (6a): editar**: cada receita cita a seção do contrato que toca no formato literal `formats.md § N` (§ 6 e § 7 medições e fontes, § 7 requisitos, § 5 só em § 9 que edita a estratégia); `log`, `next-id`, `add-pending` onde cobrem um passo; § 9 absorve o que o SKILL.md passo 6 repete. Mantêm **When** e `Checker:`.
- [ ] **Passo 2 (6a): verificar** como na Tarefa 4; commit:
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/events/06-measurement.md plugins/productivity-tools/skills/roadmap-tracker/references/events/07-new-source.md plugins/productivity-tools/skills/roadmap-tracker/references/events/08-new-requirement.md plugins/productivity-tools/skills/roadmap-tracker/references/events/09-revision.md
git commit -m "E22 T6: receitas 6 a 9 citam o contrato por seção" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
- [ ] **Passo 3 (6b): editar** § 12, § 13, § 14 do mesmo modo (`set-status`, `log`, `add-pending` onde cobrem; § 14 mantém o mapeamento dos eventos do plan-coordinator).
- [ ] **Passo 4 (6b): verificar** como na Tarefa 4; commit:
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/references/events/12-package-published.md plugins/productivity-tools/skills/roadmap-tracker/references/events/13-do-not-do-now.md plugins/productivity-tools/skills/roadmap-tracker/references/events/14-plan-coordinator.md
git commit -m "E22 T6: receitas 12 a 14 citam o contrato por seção" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 7: SKILL.md enxuto, Common enxuto e orçamento de prosa (critério 1)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar (teste): `plugins/productivity-tools/scripts/prose-budget.test.mjs`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/references/events.md`

**Interfaces:**
- Consome: helpers da Tarefa 1; receitas e rubricas das Tarefas 2-6.
- Produz, em `prose-budget.test.mjs`:
  - Constantes com comentário citando a spec, seção "Meta derivada de prosa" (SRC-02 §1, commit `bf9d948`; DEC-034; previsão provisória no molde de DEC-203; segue a estratégia se a revisão registrar outro valor): `BASELINE_LF = 90874`, `REMOVED_LF = 61778`, `TARGET_LF = 29096`.
  - `formatsSections(formatsMd) -> Map<number, string>`: trecho de `## N.` até o próximo `## M.` (cabeçalhos não numerados ficam dentro da seção).
  - `sectionsCited(text) -> Set<number>`: regex que aceita `formats.md`, crase opcional, espaço opcional, `§`, espaço opcional, dígitos.
  - `unsectionedMentions(text, { allowFormatContractRow: boolean }) -> string[]`: linhas com `formats.md` sem `§ <n>` logo depois; com a opção, ignora a linha que começa com `| Format contract`.
  - `loadFor(skillDir, row, formatsMd) -> { files: Map<string, number>, sections: number[], total: number }`: arquivos de `recipeLoadFiles` + cada seção citada em qualquer um deles, bytes LF.

- [ ] **Passo 1: testes que falham** (acrescentar):
  - `TARGET_LF === BASELINE_LF - REMOVED_LF` e `REMOVED_LF === 31267 + (34667 - 4156)`.
  - Foco 2: `sectionsCited('see `formats.md` § 6 and formats.md §7, formats.md § 4.')` → `{6, 7, 4}`; `unsectionedMentions('read formats.md first')` → 1 linha; `unsectionedMentions('| Format contract | `formats.md` |', { allowFormatContractRow: true })` → `[]`.
  - Foco 5: `loadFor` sobre um diretório sintético em `fs.mkdtempSync(path.join(os.tmpdir(), 'prose-'))` (removido em `t.after`) em que o SKILL.md cita `rubric-a.md` e `formats.md § 1` e a receita não cita a rubrica → a carga não tem `rubric-a.md` e tem a seção 1.
  - (b): para cada uma das 20 linhas do índice, `loadFor(...).total <= TARGET_LF`; a mensagem de falha lista arquivo → bytes e seções; um `test` imprime (via `t.diagnostic`) o evento de maior carga e o total.
  - (c): em todo arquivo de toda carga, `unsectionedMentions` → `[]` (opção ligada só para SKILL.md); nenhuma carga tem todas as seções de `formatsSections` (1 a 9).
  - (e): SKILL.md não casa `/Read `formats\.md` before/` nem `/read (the whole|all of|the entire) `?(events|formats)\.md/i`.
  Rodar: `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → FAIL em (b) (SKILL.md ~19.000 bytes), (c) (SKILL.md e Common citam `formats.md` sem `§`) e (e).

- [ ] **Passo 2: SKILL.md enxuto** conforme a spec, "SKILL.md enxuto": tabela de caminhos (CLI, checker do plugin, `events.md`, as duas rubricas, e a linha `| Format contract ...` dizendo que o contrato é lido só pela seção que a receita cita); regras 1 a 8 curtas (inclusive a regra do código de saída da CLI e `no questions` uma vez); passo 1 `roadmap.mjs brief`; passo 2 `refresh-checker` apontando `events/10-checker-refresh.md`; passo 3 apontando `events/11-migration.md`; passo 4 tabela evento → arquivo da receita e "read `events.md` (Common) and the recipe file; read a rubric only when the recipe says so"; passo 5 checker vendorizado, 0 erros, avisos uma linha por código; consulta só de leitura `status` + checker; relatório de entrega e red flags curtos; revisão só em `events/09-revision.md`. Meta: ≤ 8.000 bytes LF.

- [ ] **Passo 3: Common enxuto** em `events.md`: cortar o que a CLI já cumpre (posição da linha de log, próximo ID, pruning → `prune`), `no questions` uma vez, toda menção a `formats.md` com `§`. Meta: `events.md` ≤ 4.500 bytes LF. Nenhuma regra listada nos anti-objetivos some.

- [ ] **Passo 4: verificar**
  - `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` → PASS; registrar a maior carga (evento e bytes) na mensagem de commit.
  - `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → PASS (a CLI não mudou).
  - G1, G2, G3, G4, G5 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-tracker/SKILL.md plugins/productivity-tools/skills/roadmap-tracker/references/events.md
git commit -m "E22 T7: SKILL do tracker enxuto e orçamento de prosa por evento (maior carga <evento> = <n> bytes LF)" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 8: execuções comportamentais e relatório (critérios 2 e 3, REQ-037)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Executada pelo orquestrador da sessão principal (DEC-204), não pelo executor do workflow do release** (que não tem ferramenta de subagent): o orquestrador despacha os subagents nos tiers abaixo, repassa a saída literal e escreve o relatório. Roda na worktree `D:/projects/claude-play-wt/E22`, na `feat/E22`, antes do merge, sem efeito externo (subagents locais, escrita só na pasta de teste sob `docs/reports/2026-11-11-e22-rubricas/`). O aceite dos critérios 2 e 3 é do dono; esta tarefa não registra aceite.

**Arquivos:**
- Criar: `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` (escrito pelo orquestrador: subagents não gravam arquivos com nome de relatório)
- Criar: `docs/reports/2026-11-11-e22-rubricas/` (README.md marcando fixture sintética; `pasta/` cópia de `fixtures/valid`; `spec-enfraquecido.md`; saídas literais `run-*.md`)
- Modificar (só se uma execução falhar o esperado por defeito da rubrica): `plugins/productivity-tools/skills/roadmap-tracker/references/rubric-contradiction.md` ou `rubric-criteria.md`

**Interfaces:** consome o SKILL.md enxuto, as receitas e as rubricas (Tarefas 2-7) e a CLI de E3.

- [ ] **Passo 1: entradas**: copiar `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` para `docs/reports/2026-11-11-e22-rubricas/pasta/`; README.md do diretório diz que tudo ali é fixture sintética; escrever `spec-enfraquecido.md` para um card da pasta, com um critério enfraquecido (`verify: test` → `human`, ou caso negativo removido) e os demais iguais ao card.

- [ ] **Passo 2: critério 2**: subagent sonnet (`effort: medium`) segue o SKILL.md enxuto ao pé da letra, sob `no questions`, com o evento "decisão" duas vezes na `pasta/`: A contraria a estratégia da pasta (muda um `depends` ou uma peça de um card); B só a detalha (nome ou biblioteca que o card deixa aberto). Esperado: A com Contradicts citando a seção, B com `-`. Guardar em `run-criterio-2.md`: linhas gravadas em `decisions.md`, arquivos lidos, ambiguidades.

- [ ] **Passo 3: critério 3**: subagent sonnet novo roda o evento § 19 com o card e `spec-enfraquecido.md`. Esperado: um pendente apontando o critério enfraquecido (classe `enfraquecido`) e nenhum para os iguais. Guardar em `run-criterio-3.md`.

- [ ] **Passo 4: fluxo enxuto (REQ-037)**: subagent sonnet roda em sequência na `pasta/` § 20 (spec escrito), § 5 (abrir e fechar bloqueio), § 18 (decisão do executor ratificada com `ratify --amend`) e a rejeição de § 1 sobre outra decisão do executor, listando cada arquivo lido, cada comando e código de saída, cada ambiguidade; depois `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs docs/reports/2026-11-11-e22-rubricas/pasta` → exit 0, 0 erros (`fixtures/valid` não vendoriza o checker). Guardar em `run-fluxo.md`.

- [ ] **Passo 5: revisão adversarial**: subagent opus (`effort: medium`), só leitura ("do not edit files"), confere as três saídas contra o SKILL, as receitas e as rubricas. Guardar em `run-revisao.md`. Se um esperado falhar por defeito da rubrica: corrigir a rubrica, repetir a execução com subagent novo e guardar as duas.

- [ ] **Passo 6: relatório**: o orquestrador escreve `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` com data, commit da branch, modelos e esforços, e por critério: entrada, saída literal, resultado esperado, resultado obtido e a linha "aceite: aguardando o dono"; mais o fluxo enxuto (exit do checker, ambiguidades) e os achados da revisão adversarial.

- [ ] **Passo 7: verificar** — G1 a G5 → exit 0 (a pasta copiada fica fora dos globs de G1; G4 continua sobre `fixtures/valid`); `git status --porcelain` só com os arquivos desta tarefa.

- [ ] **Passo 8: commit**
```bash
git add docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md docs/reports/2026-11-11-e22-rubricas/
# e, se o Passo 5 exigiu correção:
git add plugins/productivity-tools/skills/roadmap-tracker/references/rubric-contradiction.md plugins/productivity-tools/skills/roadmap-tracker/references/rubric-criteria.md
git commit -m "E22 T8: execuções comportamentais das rubricas e do fluxo enxuto do tracker" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
Depois: `git status --porcelain` vazio (diferença só de final de linha: `git checkout -- <arquivo>`).

---

## Acceptance criteria evidence

O critério 1 é `verify: test` com o comando do card; o arquivo de teste é criado na Tarefa 1 e completado na Tarefa 7. O comando só lê o repositório e escreve numa pasta temporária do sistema: sem efeito externo. Os critérios 2 e 3 são ato humano (o dono confere o relatório da Tarefa 8; o aceite não é registrado por agente).

| ac | kind | command | testRef | blq | external | externalDedupe |
|---|---|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` | `prose-budget.test.mjs`: (b) carga de cada um dos 20 eventos ≤ `TARGET_LF` = 29.096 bytes LF (meta derivada de SRC-02 §1); (c) nenhuma carga reúne todas as seções de `formats.md` e toda menção tem `§ N`; (a), (d), (e) (Tarefas 1 e 7) | - | false | - |
| AC2 | human | - | o dono confere o resultado da execução comportamental registrado em `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` (Tarefa 8, `run-criterio-2.md`) | - | false | - |
| AC3 | human | - | o dono confere o resultado da execução comportamental registrado em `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` (Tarefa 8, `run-criterio-3.md`) | - | false | - |
