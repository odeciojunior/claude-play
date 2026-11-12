# E19 -- Autor de spec e skill interativa de spec: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** entregar o agente do plugin `productivity-tools:spec-author` (modo autônomo, sem perguntar, fecha com `spec-tool check`), a skill interativa `spec-writer` que o despacha fora de um roadmap, a regra de lint que acusa `subagent_type` num script de workflow registrado (DEC-057), o card de cenário fixo com credencial e as execuções comportamentais dos dois critérios com relatório.

**Arquitetura:** seis tarefas em commits separados: regra de lint (marketplace-tools), variante `spec-author` do cenário de medição com o card E6 e o roteiro sintético, o agente, a skill, a documentação, e por fim as execuções comportamentais conduzidas pelo orquestrador da sessão principal (DEC-204). Nenhum arquivo de teste novo (card): os testes entram em `lint-plugin.test.mjs`, `make-scenario.test.mjs` e `spec-tool.test.mjs`, que já existem.

**Tecnologia:** JavaScript ESM (Node >= 18; medido v22.17.1), `node:test`, sem dependências; Markdown. Textos embarcados (agente, SKILL.md, README do plugin, card do sandbox) em inglês, como o resto do plugin e do sandbox; plano, relatório e commits em português.

**Spec:** `docs/superpowers/specs/2026-11-12-E19-autor-spec-skill-interativa-design.md` (ler junto com este plano; as seções "Peça 1", "Peça 2", "Teste que acusa `subagent_type`", "Card do cenário fixo com credencial" e "Execuções comportamentais" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell 7, Node v22.17.1, git 2.50.1, claude CLI 2.1.322, `core.autocrlf=true` (checkouts CRLF; `.sh` em LF por `.gitattributes`). Todo teste que lê Markdown ou JS do disco normaliza `\r\n` para `\n` antes de regex de várias linhas.
- Worktree `D:/projects/claude-play-wt/E19`, branch `feat/E19`, faixa de portas 5200-5209 (nenhuma tarefa sobe servidor). Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E19/` (criar e apagar no fim da tarefa). Ao fim de cada tarefa `git status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`).
- Não editar: `docs/plans/roadmap-evolucao-skills/` e a estratégia, `plugins/_template/`, `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (E8), `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs` (decisão autônoma 10 da spec, DEC-301), `tools/measure/run-batch.mjs` (a variante não é painel), o esquema `spec/1` e `spec-tool.mjs`, os diagramas de arquitetura. Sem subir versão (`productivity-tools` fica 1.7.0; decisão 14 da spec).
- Nomes fixados pela spec: agente `plugins/productivity-tools/agents/spec-author.md`, `name: spec-author`, `model: opus`, `effort: medium`, `tools: Read, Grep, Glob, Bash, Write, Edit`; skill `plugins/productivity-tools/skills/spec-writer/SKILL.md` com frontmatter só `name`, `description`, `argument-hint`; despacho `productivity-tools:spec-author`; saída interativa `docs/plans/<tópico>/spec.md`; `specTool: ${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs`; regra de permissão mostrada `Bash(node *spec-tool.mjs" *)`; variante `spec-author`; arquivos `tools/measure/scenario/spec-author-card.md` e `tools/measure/scenario/spec-writer-request.md`; variável `REPORT_STORE_TOKEN`; relatório `docs/reports/2026-11-12-E19-autor-spec-comportamental.md`.
- Credenciais: nenhum valor de credencial, token ou chave em arquivo, fixture, spec, relatório ou commit; só "provided through environment variable `REPORT_STORE_TOKEN`".
- DEC-312: nenhum texto embarcado (agente, SKILL.md, README) contém `bypassPermissions` nem sugere modo sem permissões.
- Commits: `E19 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (linha de base do alvo: G1 exit 0, total 1421, skipped 0, nenhum falhando; G2 a G5 exit 0; nenhuma falha é esperada em nenhuma tarefa, e nenhum gate canônico muda):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total ≥ 1421 (cresce com os testes novos), failing 0, skipped 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
  - Extras (regra do `CLAUDE.md`, plugin alterado na Tarefa 1): `claude plugin validate plugins/marketplace-tools` → exit 0; `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools` → exit 0.
  - "Gates completos" abaixo = G1 a G5 mais os dois extras, todos antes de cada commit.
- Nenhuma tarefa precisa de navegador, de lock, de credencial real nem tem efeito externo; todas rodam na worktree do entregável antes do merge. Quando um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando que mostra o motivo, no relatório da tarefa; para a Tarefa 6, se quem a recebe não tiver ferramenta de subagent, a tarefa volta ao orquestrador da sessão principal (DEC-204), nunca é simulada.
- Execução decidida sob as regras permanentes do dono (decisões delegadas a um subagent Fable; `bypassPermissions` só nas sessões orquestradoras, DEC-311): segue sem as regras Bash que faltam porque a sessão orquestradora roda em `bypassPermissions`. Execuções pagas de medição não são tarefas deste plano.

## Foco da revisão

1. Workflow registrado que cita `subagent_type` só num comentário, ou que não tem `meta.name`: a regra lê o texto de cada caminho de `plugin.json` `workflows` (não só os que `registeredWorkflows` devolve) e acusa FAIL do mesmo jeito; caminho registrado que não existe não lança e não gera FAIL desta regra. Testes na Tarefa 1.
2. Caminho de `spec-tool.mjs` com espaços (por exemplo `C:/Users/Some One/.claude/plugins/cache/...`): agente e skill sempre o citam entre aspas (`node "<specTool>" check "<output>"`); teste na Tarefa 3 e na Tarefa 4.
3. Valor de credencial vazando: o card E6 e o roteiro sintético citam `REPORT_STORE_TOKEN` só como nome; nenhuma atribuição (`REPORT_STORE_TOKEN=`, `REPORT_STORE_TOKEN: <valor>`) nem padrão de segredo aparece; teste na Tarefa 2. O agente diz que a credencial vira `needsPerson` de `kind: credential` com o nome da variável; teste na Tarefa 3.
4. Checkout CRLF: o card E6 chega ao sandbox em LF (o checker e a checagem de critérios comparam por linha) e o sandbox fica com `git status --porcelain` vazio e o checker em exit 0; teste na Tarefa 2.
5. Agente que poderia perguntar: o frontmatter `tools` não tem `AskUserQuestion` nem `Agent`, e nenhum texto embarcado menciona `bypassPermissions`; o SKILL.md limita a rodada a cinco perguntas numa única chamada e pede uma só aprovação; testes nas Tarefas 3 e 4.

## Mapa de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` | 1 | regra `subagent_type` em workflow registrado |
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` | 1 | casos da regra |
| `tools/measure/scenario/spec-author-card.md` | 2 | card E6 com credencial (inglês, formato do sandbox) |
| `tools/measure/scenario/spec-writer-request.md` | 2 | pedido avulso, respostas roteirizadas e aprovação (entrada sintética marcada) |
| `tools/measure/make-scenario.mjs` | 2 | variante `spec-author` |
| `tools/measure/make-scenario.test.mjs` | 2 | variante na lista e caso do card E6 |
| `plugins/productivity-tools/agents/spec-author.md` | 3 | o agente |
| `plugins/productivity-tools/scripts/spec-tool.test.mjs` | 3, 4 | testes estruturais do agente e da skill |
| `plugins/productivity-tools/skills/spec-writer/SKILL.md` | 4 | a skill interativa |
| `plugins/productivity-tools/README.md` | 5 | linha da skill e seção do agente |
| `CLAUDE.md` | 5 | linha de Layout sobre `agents/` |
| `docs/reports/2026-11-12-E19-autor-spec-comportamental.md` | 6 | relatório das execuções comportamentais |

---

### Tarefa 1: regra de lint que acusa `subagent_type` em workflow registrado (DEC-057)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`
- Test: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`

**Interfaces:**
- Produces: em `lintPlugin(dir)`, para cada string `file` de `pj.workflows` cujo arquivo existe, um resultado de nome `` `${file} agent option` ``: `FAIL` com detalhe `uses subagent_type, which a workflow script ignores silently; write agentType (DEC-057)` quando o texto do arquivo contém `subagent_type`; `OK` caso contrário. Nenhum resultado desta regra para caminho ausente ou não string. SKILL.md, referências e agentes não são lidos por esta regra.

- [ ] **Passo 1: escrever os testes que falham** em `lint-plugin.test.mjs`, perto dos testes E25 de `workflows` (reusar `freshGrant` ou o auxiliar com `withWorkflows`):
  - `E19: registered workflow using subagent_type -> FAIL naming agentType`: workflow `./workflow/w.js` com `export const meta = { name: 'w' }` e `agent(p, { subagent_type: 'x:y' })` → existe resultado `FAIL` cujo nome contém `workflow/w.js` e cujo detalhe casa `/agentType/` e `/DEC-057/`.
  - `E19: registered workflow using agentType -> OK`: mesmo arquivo com `agentType: 'x:y'` → nenhum `FAIL`; resultado `OK` com nome contendo `agent option`.
  - `E19: subagent_type only in a comment of a registered workflow -> FAIL`: `// never subagent_type` → `FAIL`.
  - `E19: registered workflow without meta.name using subagent_type -> FAIL`.
  - `E19: SKILL.md and agent citing subagent_type are not flagged`: `skills/s/SKILL.md` e `agents/a.md` (frontmatter válido) com o texto `subagent_type: "x:y"` e workflow limpo → nenhum `FAIL`.
  - `E19: registered workflow path that does not exist -> no agent option result`: `workflows: ['./workflow/missing.js']` → nenhum resultado com nome contendo `agent option` e nenhuma exceção.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → FAIL nos casos "subagent_type", "comment", "without meta.name" e "agentType -> OK" (a regra não existe).
- [ ] **Passo 3: implementar** a regra em `lintPlugin`, logo depois das checagens de `plugin.json` (onde `pj` já está lido), percorrendo `pj.workflows` com `path.join(dir, ...file.split('/'))`, `isFile` e `readText` já existentes.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0. O caso `real plugins have no FAIL` continua passando (o workflow do release não tem `subagent_type`).
- [ ] **Passo 5: gates completos** → todos exit 0; G1 total = 1421 + 6, failing 0, skipped 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs
  git commit -m "E19 T1: lint acusa subagent_type em workflow registrado (DEC-057)" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 2: card E6 com credencial e variante `spec-author` do cenário

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `tools/measure/scenario/spec-author-card.md`
- Create: `tools/measure/scenario/spec-writer-request.md`
- Modify: `tools/measure/make-scenario.mjs`
- Test: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Produces: `VARIANTS` com 14 itens, o último `'spec-author'`; `makeScenario(dir, 'spec-author')` monta o sandbox de `makeSandbox`, acrescenta o card E6 (texto de `spec-author-card.md`, lido com `readText`) ao fim de `docs/plans/roadmap-sandbox/strategy.md`, a linha `| REQ-006 | A report can be published to remote storage with an access token | functional | SRC-01 | E6 | covered |` ao bloco `requirements` e a linha `| E6 | not-started | - | Run the release skill |` ao bloco `panel` de `state.md` (só os blocos que o checker do sandbox exige para um card novo), commita `docs(roadmap): add E6 card` e devolve `prompts: []`, `stopResume: null`, `seeded: []`. Não grava `settings.local.json` (não é variante de execução do release). As Tarefas 6 e o relatório usam `node tools/measure/make-scenario.mjs <dir> --variant spec-author`.
- `spec-author-card.md`: bloco `<!-- roadmap:card id=E6 phase=extras track=engineering priority=Should size="not estimated" depends=- reqs=REQ-006 critical=false -->` ... `<!-- /roadmap:card -->`, título `### E6 -- Publish report to remote storage`, "Why" citando `src/upload.mjs` e `uploadRequest(report)`, e dois critérios no bloco `roadmap:acceptance`: (1) um testável sobre a montagem do envio (`{verify: test; evidence: node --test tests/e6.test.mjs}`), (2) um que exige o token de acesso, dizendo que ele é provided through environment variable `REPORT_STORE_TOKEN` (`{verify: human; evidence: <texto curto>}`). Sem valor de token.
- `spec-writer-request.md`: primeira linha `<!-- synthetic input: scripted answers for the E19 behavioral run, not a person -->`; seções `## Request` (pedido avulso de uma mudança pequena no sandbox, por exemplo uma função `wordWrap` em `src/`), `## Scripted answers` (uma resposta por pergunta provável, com a regra "for any other question, take the recommended option") e `## Approval` (`approved`).

- [ ] **Passo 1: escrever os testes que falham** em `make-scenario.test.mjs`:
  - atualizar `lists every variant of the spec table`: incluir `'spec-author'` e `VARIANTS.length === 14`.
  - `E19: spec-author variant adds the E6 card with the token only by name`: `makeScenario(t.dir, 'spec-author')` → `s.prompts` vazio; `strategy.md` do sandbox contém `<!-- roadmap:card id=E6` e `REPORT_STORE_TOKEN`, sem `\r`; `git status --porcelain` vazio; último commit `docs(roadmap): add E6 card`; `node docs/plans/roadmap-sandbox/check-roadmap.mjs` (cwd sandbox) → status 0; nenhum `settings.local.json`.
  - `E19: spec-author card and request carry no credential value`: o texto de `spec-author-card.md` e de `spec-writer-request.md` não casa `/REPORT_STORE_TOKEN\s*[=:]\s*\S/`, nem `/(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]/`; `spec-writer-request.md` começa com `<!-- synthetic input:`.
  - `E19: spec-author card passes spec-tool against the sandbox roadmap`: num sandbox da variante, gravar um spec mínimo `spec/1` com `mode: unattended`, `id: E6`, os dois critérios copiados do card e um `needsPerson` `{ id: 'H1', kind: 'credential', ... }`, e rodar `node plugins/productivity-tools/scripts/spec-tool.mjs check <spec> --roadmap <sandbox>/docs/plans/roadmap-sandbox --json` → status 0. Isso prova que o card é legível pela ferramenta de E5 antes das execuções da Tarefa 6.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/make-scenario.test.mjs` → FAIL em "lists every variant" e nos três casos E19 (variante e arquivos não existem).
- [ ] **Passo 3: criar os dois arquivos de cenário e implementar** o `case 'spec-author'` em `makeScenario` e o item em `VARIANTS`. Se o checker do sandbox acusar outro bloco faltando para E6, acrescentar a linha mínima nesse bloco e anotar qual no relatório da tarefa.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0; G1 failing 0, skipped 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add tools/measure/scenario/spec-author-card.md tools/measure/scenario/spec-writer-request.md tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
  git commit -m "E19 T2: card E6 com credencial e variante spec-author do cenário" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 3: agente `spec-author` (peça 1)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `plugins/productivity-tools/agents/spec-author.md`
- Test: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: `spec-tool.mjs` (`check <spec> [--roadmap <dir>] --json`, `emit <spec>`, `summary <spec>`), esquema `spec/1` (campos `TOP`, `rulings`, `needsPerson` com `kind` em `data|credential|acceptance|decision`, `externalEffects`, `edgeCases`).
- Produces: agente `productivity-tools:spec-author` com o contrato de entrada da spec (campos `mode`, `output`, `specTool`, `language`, `roadmap`, `card`, `ownerNote`, `topic`, `intake`), os oito passos do processo da spec, as regras fixas e a última mensagem = saída literal de `emit` (ou do último `check --json` após a terceira falha). Corpo em inglês, alvo de cerca de 0,9 mil tokens (não conferido).

- [ ] **Passo 1: escrever os testes que falham** em `spec-tool.test.mjs` (normalizar CRLF; ler o arquivo de `path.join(HERE, '..', 'agents', 'spec-author.md')`):
  - `E19: spec-author frontmatter pins opus, medium effort and tools without asking`: `name: spec-author`, `model: opus`, `effort: medium`, `tools` com exatamente `Read, Grep, Glob, Bash, Write, Edit`; `tools` não contém `AskUserQuestion` nem `Agent`.
  - `E19: spec-author body names the call contract`: o corpo contém cada um de `mode`, `output`, `specTool`, `language`, `roadmap`, `card`, `ownerNote`, `topic`, `intake`, `unattended`, `interactive`.
  - `E19: spec-author closes with a quoted spec-tool check and returns emit`: o corpo casa `/node "<specTool>" check "<output>"/`, contém `--json`, `emit` e um limite de três execuções (`/three|3/`).
  - `E19: spec-author records a credential as needsPerson by variable name`: o corpo contém `needsPerson`, `credential` e `environment variable`; casa `/never (ask|commit)/i` para as duas regras.
  - `E19: shipped spec texts never mention bypassPermissions` (só o agente nesta tarefa; a Tarefa 4 acrescenta o SKILL.md à lista): nenhum contém `bypassPermissions`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs` → FAIL nos cinco casos E19 (`ENOENT` do agente).
- [ ] **Passo 3: escrever o agente** segundo a seção "Peça 1" da spec: frontmatter (só chaves de `AGENT_KEYS`; `description` diz quando usar e "not for plans"), contrato em tabela, processo em oito passos numerados, regras fixas (não perguntar, não esperar resposta, não dizer "should I...?"; não commitar; não inventar credencial, dado de produção, aceite ou aprovação; credencial = `needsPerson` `kind: credential` só com nome de variável de ambiente; efeito externo registrado em `externalEffects`, nunca executado; `specTool` ausente ou ilegível → devolver a falha literal sem procurar outro caminho; não gravar fora de `output`). Despacho por workflow com `agentType` e por skill com `subagent_type` descritos numa linha cada.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0; G5 mostra `agents/spec-author.md frontmatter` OK; G3 exit 0.
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/agents/spec-author.md plugins/productivity-tools/scripts/spec-tool.test.mjs
  git commit -m "E19 T3: agente spec-author em modo autônomo e interativo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 4: skill interativa `spec-writer` (peça 2)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Create: `plugins/productivity-tools/skills/spec-writer/SKILL.md`
- Test: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:**
- Consumes: agente `productivity-tools:spec-author` e seu contrato (Tarefa 3); `spec-tool.mjs summary` e `check`.
- Produces: skill `productivity-tools:spec-writer` com os cinco passos da spec, as recusas e o bloco interativo (`id` = tópico, cada critério com `{verify: ...}`). Corpo em inglês, abaixo de 500 linhas, alvo de cerca de 0,5 mil tokens (não conferido).

- [ ] **Passo 1: escrever os testes que falham** em `spec-tool.test.mjs` (normalizar CRLF; arquivo `path.join(HERE, '..', 'skills', 'spec-writer', 'SKILL.md')`):
  - `E19: spec-writer frontmatter keeps name, description and argument-hint only`: chaves exatamente `name`, `description`, `argument-hint`; `name: spec-writer`; sem `allowed-tools`; a descrição contém `roadmap`, `plan-writer` e `one round` (perda do risco 3 do card).
  - `E19: spec-writer dispatches spec-author with the call fields`: o corpo contém `subagent_type`, `productivity-tools:spec-author`, `mode: interactive`, `docs/plans/<topic>/spec.md`, `${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs`, `topic`, `language`.
  - `E19: spec-writer asks one round of at most five questions and one approval`: contém `AskUserQuestion`, casa `/(five|5) questions/i`, `/one approval/i` e `/recommended/i`; não contém `commit` como ação da skill além da frase de que ela não commita (`/does not commit|never commits/i`).
  - `E19: spec-writer refusals show the exact rule and reload`: contém `` Bash(node *spec-tool.mjs" *) `` e `/reload-plugins`; casa `/node "[^"]*spec-tool[^"]*" (summary|check)/` ou usa a mesma forma entre aspas da Tarefa 3.
  - estender `E19: shipped spec texts never mention bypassPermissions` para incluir o SKILL.md.
  - `E19: spec-writer stays under 500 lines`.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs` → FAIL nos casos de `spec-writer` (`ENOENT`).
- [ ] **Passo 3: escrever o SKILL.md** segundo a seção "Peça 2" da spec, com os casos de borda: spec existente vira pergunta da rodada e, sem resposta, o tópico ganha `-2`; recusa de aprovação sem mudança encerra com o spec e o resumo, sem nova pergunta; pedido de mudança redespacha o autor, roda `check` e relata sem segunda aprovação.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0, failing 0.
- [ ] **Passo 5: gates completos** → todos exit 0; G5 sem WARN novo para `skills/spec-writer/SKILL.md` (chaves da política, tamanho).
- [ ] **Passo 6: commit.**
  ```bash
  git add plugins/productivity-tools/skills/spec-writer/SKILL.md plugins/productivity-tools/scripts/spec-tool.test.mjs
  git commit -m "E19 T4: skill interativa spec-writer" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 5: documentação (README do plugin e `CLAUDE.md`)

**tier:** haiku · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nomes e descrições das Tarefas 3 e 4.

- [ ] **Passo 1: README do plugin.** Linha `spec-writer` na tabela "Skills" (gatilho: a spec for a change outside a roadmap; descrição: one round of up to five questions, one approval, writes `docs/plans/<topic>/spec.md` through the `spec-author` agent) e uma seção curta `## Agents` com `spec-author` (o que faz, `model: opus`, sem perguntar, despacho por `agentType` num workflow e por `subagent_type` numa skill). Sem `bypassPermissions`.
- [ ] **Passo 2: `CLAUDE.md`.** Na linha de Layout `agents/<agent>.md`, trocar "(today only sql-server-tools)" por "(sql-server-tools and productivity-tools)"; nada mais muda.
- [ ] **Passo 3: verificação.** `git diff --stat` mostra só os dois arquivos; `grep -c "bypassPermissions" plugins/productivity-tools/README.md` → `0`; gates completos → todos exit 0 (G5 confere a linha de versão do README, que não muda).
- [ ] **Passo 4: commit.**
  ```bash
  git add plugins/productivity-tools/README.md CLAUDE.md
  git commit -m "E19 T5: documentação do agente spec-author e da skill spec-writer" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

### Tarefa 6: execuções comportamentais e relatório (critérios 1 e 2, REQ-037)

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Executada pelo orquestrador da sessão principal (DEC-204), não pelo executor do workflow do release** (que não tem ferramenta de subagent): o orquestrador monta os sandboxes, despacha o autor em opus com effort medium (decisão autônoma 11 da spec), conduz a skill do critério 2 ele mesmo (decisão 16), repassa as saídas literais e escreve o relatório. Roda na worktree `D:/projects/claude-play-wt/E19`, na `feat/E19`, depois das Tarefas 1 a 5 e antes do merge, sem efeito externo: os sandboxes ficam em `D:/projects/claude-play-wt/_tmp/E19/` (fora do repositório) e são apagados ao fim. Nenhum `AskUserQuestion`: perguntas e aprovação do critério 2 vêm do roteiro sintético. O aceite é do dono; esta tarefa não registra aceite.

**Files:**
- Create: `docs/reports/2026-11-12-E19-autor-spec-comportamental.md` (escrito pelo orquestrador: subagents não gravam arquivos com nome de relatório)

- [ ] **Passo 1: forma de despacho.** Conferir se a sessão carrega o plugin da worktree (o tipo `productivity-tools:spec-author` aparece para a ferramenta Agent). Se sim, forma do plugin (`subagent_type: "productivity-tools:spec-author"`); senão, forma de reserva: subagent geral `model: opus`, `effort: medium`, prompt = corpo literal de `plugins/productivity-tools/agents/spec-author.md` (sem frontmatter) seguido do prompt de chamada. Registrar a forma no relatório.
- [ ] **Passo 2: critério 1, três execuções.** Para `i` em 1, 2, 3: `node tools/measure/make-scenario.mjs D:/projects/claude-play-wt/_tmp/E19/c1-<i> --variant spec-author` (sandbox novo a cada vez); despachar o autor com `mode: unattended`, `output: <sandbox>/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md`, `specTool: D:/projects/claude-play-wt/E19/plugins/productivity-tools/scripts/spec-tool.mjs`, `language: English`, `roadmap: <sandbox>/docs/plans/roadmap-sandbox`, `card: E6`. Conferir e guardar literal:
  - `node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json` → exit 0;
  - `node "<specTool>" summary "<output>" --json` → `needsPerson` com um item `kind: "credential"` que cita `REPORT_STORE_TOKEN`;
  - `grep -nE "REPORT_STORE_TOKEN\s*[=:]\s*\S|(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]" "<output>"` → nenhuma linha (exit 1);
  - a transcrição do subagent não tem chamada de `AskUserQuestion` e a última mensagem não pede resposta à pessoa (sem `?` dirigido à pessoa); a última mensagem é o JSON de `emit`.
- [ ] **Passo 3: critério 2, uma execução.** Sandbox `D:/projects/claude-play-wt/_tmp/E19/c2` da mesma variante. O orquestrador segue `plugins/productivity-tools/skills/spec-writer/SKILL.md` na ordem, com o pedido de `tools/measure/scenario/spec-writer-request.md`; nos passos 2 e 4 grava no relatório, literal, a rodada que montaria (texto e opções, recomendada primeiro) e o pedido de aprovação, e toma as respostas e a aprovação do roteiro; no passo 3 despacha o autor (forma do passo 1) com `mode: interactive`, `output: <sandbox>/docs/plans/<tópico>/spec.md`, `specTool` absoluto como no passo 2, `topic`, `language: English` e a nota de entrada. Conferir: arquivo gravado; `node "<specTool>" check "<output>" --json` → exit 0; perguntas ≤ 5; uma aprovação pedida; lista de ambiguidades do SKILL.md encontradas ao segui-lo.
- [ ] **Passo 4: revisão adversarial somente leitura** do resultado do critério 2 e do SKILL.md (subagent `model: sonnet`, instruído a não editar), achados literais no relatório.
- [ ] **Passo 5: relatório** `docs/reports/2026-11-12-E19-autor-spec-comportamental.md`: data, commit da branch, forma de despacho, modelos e esforços; por execução: entrada, saídas literais dos comandos, resultado esperado, resultado obtido; a nota de que as perguntas e a aprovação do critério 2 vieram do roteiro sintético, não de uma pessoa; achados da revisão; a linha "aceite: aguardando o dono" para cada critério. Nenhum valor de credencial.
- [ ] **Passo 6: limpar e verificar.** Apagar `D:/projects/claude-play-wt/_tmp/E19/`; gates completos → todos exit 0 (o relatório não muda nenhum gate).
- [ ] **Passo 7: commit.**
  ```bash
  git add docs/reports/2026-11-12-E19-autor-spec-comportamental.md
  git commit -m "E19 T6: relatório das execuções comportamentais do autor de spec" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

Se uma execução falhar uma conferência, o relatório registra a falha literal; a correção volta à tarefa dona do arquivo (3 ou 4) e as execuções do critério afetado rodam de novo, sem apagar as anteriores do relatório.

## Decisões deste plano (origem executor, pendentes para o dono)

1. Os testes estruturais do agente e da skill entram em `plugins/productivity-tools/scripts/spec-tool.test.mjs`, que já existe, porque o card proíbe arquivo de teste novo e é a ferramenta que os dois textos dirigem. Alcance: local.
2. Agente, SKILL.md, README e card do sandbox em inglês, como o resto do plugin e do sandbox; o relatório e os commits em português. Alcance: local.
3. A regra de lint lê cada caminho de `plugin.json` `workflows` diretamente, não só os com `meta.name`, para não deixar passar um workflow sem nome. Alcance: local.
4. A Tarefa 6 roda o critério 1 com `language: English`, o idioma do sandbox. Alcance: local.

## Acceptance criteria evidence

| AC | kind | command | testRef | blq | external | externalDedupe | evidence |
|---|---|---|---|---|---|---|---|
| AC1 | human | - | - | - | false | - | o dono confere o resultado das execuções comportamentais registrado em docs/reports (`docs/reports/2026-11-12-E19-autor-spec-comportamental.md`, Tarefa 6, seção do critério 1: três execuções, check exit 0, needsPerson de kind credential, nenhum valor, nenhuma pergunta) |
| AC2 | human | - | - | - | false | - | o dono confere o resultado da execução comportamental registrado em docs/reports (`docs/reports/2026-11-12-E19-autor-spec-comportamental.md`, Tarefa 6, seção do critério 2: spec gravado em docs/plans/<tópico>/spec.md com check exit 0) |
