# E25 -- Workflow do release lançado pelo nome: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** o workflow do release vira o workflow nomeado `productivity-tools:release-workflow`, a skill o lança pelo nome (com reserva por caminho só para nome desconhecido), o preflight avisa sem bloquear a regra `Workflow(productivity-tools:release-workflow)`, o workflow recusa antes de qualquer agente um lançamento sem `runToken`, e a skill concede o próprio workflow por `allowed-tools`, com o lint aceitando essa única exceção.

**Arquitetura:** cinco peças em commits na ordem da spec: trava do `runToken` (peça 3), aviso do preflight (peça 1), manifesto + `meta.name` + lançamento pelo nome + `compatibility` (peças 2 e 4), checagem de `compatibility` no lint (peça 4, commit que fecha a etapa "anterior à concessão"), e por último a concessão por `allowed-tools` com sua checagem no lint e a frase do `CLAUDE.md` (peça 5, raio de impacto alto), seguida da revisão de segurança.

**Tecnologia:** JavaScript ESM (Node >= 18; medido v22.17.1), `node:test`, sem dependências; Markdown (texto das skills em inglês, como o resto do plugin).

**Spec:** `docs/superpowers/specs/2026-11-12-E25-release-lancado-pelo-nome-design.md` (ler junto com este plano; as seções "Peça 1" a "Peça 5", "Como o dono confere os critérios 4 e 6" e "Testes" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash 5.2.37 e PowerShell 7, Node v22.17.1, git 2.50.1, claude CLI 2.1.322, `core.autocrlf=true` (checkouts CRLF). Todo teste que lê SKILL.md, `plugin.json` ou o script do workflow tolera `\r\n` (normalizar com `.replace(/\r\n?/g, '\n')` antes de regex de várias linhas).
- Worktree `D:/projects/claude-play-wt/E25`, branch `feat/E25`, faixa de portas 5200-5209 (nenhuma tarefa sobe servidor). Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E25/` (criar e apagar no fim da tarefa). Ao fim de cada tarefa `git status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`).
- Não editar: `docs/plans/roadmap-evolucao-skills/` e a estratégia, `plugins/_template/`, `tools/measure/make-scenario.mjs` (decisão autônoma 14), `CONTRIBUTING.md` (decisão autônoma 13), `references/operator.md` (conferido: não cita o lançamento por caminho como único, então a frase de remissão da spec não é necessária). Sem subir versão (`productivity-tools` continua 1.6.0; instrução do dono item 7). Nenhum hook do plugin aprova o lançamento (DEC-035). A skill nunca edita arquivo de configuração.
- Nomes fixados pela spec: `RELEASE_WORKFLOW = 'productivity-tools:release-workflow'`; `meta.name = 'release-workflow'`; regra `Workflow(productivity-tools:release-workflow)`; `plugin.json` `"workflows": ["./skills/roadmap-release/workflow/roadmap-release.js"]`; `compatibility` com o texto literal da spec ("Peça 4"); textos literais de aviso, de erro e de FAIL da spec, copiados sem mudança.
- `allowed-tools` só em `productivity-tools/skills/roadmap-release/SKILL.md` e só com `Workflow(productivity-tools:release-workflow)` (instrução do dono item 3, DEC-049); a edição do `CLAUDE.md` é só a frase de exceção da spec, acrescentada ao fim da regra "SKILL.md frontmatter keys (repo policy)".
- A peça 3 só acrescenta uma recusa anterior; nenhuma condição existente de `runToken` é removida nem afrouxada (instrução do dono item 4).
- Commits: `E25 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`. O commit da Tarefa 4 tem o assunto exato `E25 T4: feat(roadmap-release): workflow do release lançado pelo nome (E25)`, que contém a cadeia que os passos do dono procuram com `git log --fixed-strings --grep="feat(roadmap-release): workflow do release lançado pelo nome (E25)"`; nenhum outro commit da branch contém essa cadeia.
- Gates canônicos (linha de base do alvo: G1 exit 0, total 1314, skipped 0, nenhum falhando; G2 a G5 exit 0; nenhuma falha é esperada em nenhuma tarefa, e nenhum gate canônico muda):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total ≥ 1314, failing 0, skipped 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
  - Extras (regra do `CLAUDE.md`, plugin alterado nas Tarefas 4 e 5): `claude plugin validate plugins/marketplace-tools` → exit 0; `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools` → exit 0.
  - "Gates completos" abaixo = G1 a G5 mais os dois extras, todos antes de cada commit.
- Nenhuma tarefa precisa de navegador, de lock, de credencial nem tem efeito externo; todas rodam na worktree do entregável antes do merge. Quando um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando que mostra o motivo, no relatório da tarefa.
- Execução decidida pelo decisor delegado do dono (Fable), não digitada pelo dono: segue sem as regras `Bash(node:*)`, `Bash(claude:*)`, `Bash(node *roadmap.mjs" *)` e `Bash(git:*)` porque a sessão orquestradora roda em `bypassPermissions`; o relatório da execução diz isso.
- Revisão: Tarefas 1 a 4 com revisor sonnet; Tarefa 5 (peça 5) com revisor opus e nenhum revisor sonnet; Tarefa 6 (revisão de segurança) em opus; portão final da branch em opus com effort high (instrução do dono item 2). O teste comportamental da skill (definição de pronto, SRC-03) é do orquestrador da sessão principal (DEC-204), não deste plano, conforme a seção "Teste comportamental" da spec.

## Foco da revisão

1. `runToken` só com espaços (`'   '`): o workflow o trata como ausente (`trim()`) e recusa antes de qualquer agente; teste na Tarefa 1.
2. Configuração ilegível ou malformada (arquivo ausente, JSON inválido, `permissions` sem `allow`, `allow` que não é lista): `workflowRuleCovered` não lança e conta como não coberta, então o aviso aparece; teste na Tarefa 2.
3. `allowed-tools` escrito de outras formas no SKILL.md da exceção: lista YAML com `- ` e entrada extra, entrada entre aspas, duas entradas separadas por vírgula sem espaço (`Workflow(productivity-tools:release-workflow),Bash`), e SKILL.md com fim de linha CRLF: a entrada permitida passa (com ou sem aspas, linha única ou lista), qualquer extra é FAIL nomeando a entrada; testes na Tarefa 5.
4. Caminho Windows: a exceção compara o caminho relativo do SKILL.md com `/` (`skills/roadmap-release/SKILL.md`), nunca com `\`, então o lint dá o mesmo resultado em qualquer sistema; o teste roda no Windows medido e confere OK na exceção e FAIL em `skills/roadmap-release-x/SKILL.md` e em `skills/other/roadmap-release/SKILL.md` (Tarefa 5).
5. Plugin com o mesmo nome de pasta mas `plugin.json` com outro `name` (ou outro plugin com uma pasta `skills/roadmap-release/`): a exceção vale só quando `plugin.json` `name` é `productivity-tools`; em outro plugin é FAIL; teste na Tarefa 5.

## Mapa de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` | 1, 3 | recusa sem `runToken` (T1); `meta.name: 'release-workflow'` (T3) |
| `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | 1, 3 | critério 2 (T1); critério 3 (T3) |
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` | 2 | `RELEASE_WORKFLOW`, `releaseWorkflowRule()`, `workflowRuleCovered()`, aviso |
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | 2 | critério 1 |
| `plugins/productivity-tools/skills/roadmap-release/references/config.md` | 2 | frase do aviso em "Permission preflight" |
| `plugins/productivity-tools/.claude-plugin/plugin.json` | 3 | chave `workflows` |
| `plugins/productivity-tools/skills/roadmap-release/SKILL.md` | 3, 5 | abertura e passo 4 pelo nome com reserva; `compatibility` (T3); `allowed-tools` (T5) |
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` | 4, 5 | checagem de `compatibility` (T4) e de `allowed-tools` (T5) |
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` | 4, 5 | critério 5 |
| `CLAUDE.md` | 5 | frase de exceção única |

---

### Tarefa 1: peça 3 -- recusa sem `runToken` antes de qualquer agente (critério 2)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (bloco "args and config", linhas ~995-1012)
- Test: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Produces: o workflow devolve `{ status: 'error', error: 'runToken is missing: launch the workflow through the roadmap-release skill, which runs scripts/preflight.mjs and passes its config, runToken and trackerCli' }` em qualquer modo quando `RUN_TOKEN` (já `trim()`ado) é vazio, logo depois da checagem de `config` (que vem depois de `AUTH`), antes de `trackerCli`, `mode`, `notes` e `wtRoot`.

- [ ] **Passo 1: sondar o arnês num rascunho.** Inserir a linha da recusa (texto exato da spec, "Peça 3") logo depois do `if (!CFG || ...) { return ... }` e rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/*.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/*.test.mjs`. Anotar no relatório a lista de testes que falham por falta de token (esperado: nenhum, porque `exec()` passa `runToken: 'pf-test'` desde `f01bbbd` e os três testes com `runToken: undefined`, B4, FF/M6 e F2/m2, esperam `/runToken/`).
- [ ] **Passo 2: se algum teste quebrou por falta de token:** desfazer o rascunho (`git checkout -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`), mudar o padrão do arnês (ou o teste) para passar `runToken`, rodar G1 (esperado exit 0, total 1314, failing 0) e commitar só o arquivo de teste: `E25 T1: arnês do flow passa runToken por padrão`. Se nada quebrou, não há esse commit: desfazer o rascunho e registrar no relatório a saída resumida (linhas `# tests`, `# pass`, `# fail`) do passo 1 que mostra isso.
- [ ] **Passo 3: escrever os testes que falham** em `flow.test.mjs`, perto dos testes FF/M6:
  - `E25 AC2: without config the workflow errors before any agent call`: `run({ runToken: 'pf-test', wtRoot: '/wt', trackerCli: '/t/roadmap.mjs', deliverables: ['E1'] }, agentQueConta, ...)` sem `config` → `status === 'error'`, `error` casa `/args\.config is missing/`, zero chamadas de agente. Usar `exec()` com `config` anulado se o arnês permitir; senão chamar `run` direto com um `agent` que conta chamadas.
  - `E25 AC2: without a runToken and with no authorized item, every mode errors before any agent call`: para `mode` em `run`, `plan-only`, `dry-run`: `exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode, runToken: undefined } })` → `r.status === 'error'`, `r.error` casa `/runToken is missing: launch the workflow through the roadmap-release skill/`, `labels.length === 0`.
  - `E25 AC2: a whitespace-only runToken counts as missing`: `args: { runToken: '   ' }` → mesmo erro, `labels.length === 0`.
  - `E25 AC2: a malformed authorizeExternal keeps its own error without a runToken`: `args: { authorizeExternal: 42, runToken: undefined }` (ou outra forma que hoje faz `parseAuthorizeExternal` devolver `error`) → `r.error` é o erro de `AUTH`, não o de `runToken`.
- [ ] **Passo 4: rodar e ver falhar.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` → FAIL nos testes de "every mode" e "whitespace-only" (hoje `plan-only`/`dry-run` sem item autorizado chegam à descoberta).
- [ ] **Passo 5: implementar** a recusa no lugar fixado em Interfaces. Não tocar na linha `if (MODE === 'run' && !RUN_TOKEN && AUTH.items.some(...))` nem na checagem dentro da tarefa externa (`if (!RUN_TOKEN) return fail('infra', ...)`).
- [ ] **Passo 6: rodar e ver passar.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` → exit 0, incluindo B4, FF/M6 e F2/m2. Conferir com `git diff` que nenhuma linha existente de `runToken` foi removida (o diff de `roadmap-release.js` só tem linhas `+`).
- [ ] **Passo 7: gates completos** → todos exit 0; G1 total ≥ 1318, failing 0.
- [ ] **Passo 8: commit** `git add` dos dois arquivos; `E25 T1: workflow recusa lançamento sem runToken antes de qualquer agente`.

### Tarefa 2: peça 1 -- aviso da regra do workflow no preflight (critério 1)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` (constantes perto de `WORKFLOW_SCRIPTS`, linha ~189; aviso em `runPreflight`, bloco de `missingRules`, linhas ~386-402)
- Modify: `plugins/productivity-tools/skills/roadmap-release/references/config.md` (seção "Permission preflight")
- Test: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`

**Interfaces:**
- Produces: `export const RELEASE_WORKFLOW = 'productivity-tools:release-workflow'`; `export function releaseWorkflowRule(): string` → `'Workflow(productivity-tools:release-workflow)'`; `export function workflowRuleCovered(settingsList: Array<object|null>): boolean`.
- Consumes: a lista `settings` já lida em `runPreflight` (usuário em `configDir || <home>/.claude`, projeto, local do projeto).

- [ ] **Passo 1: escrever os testes que falham** em `preflight.test.mjs` (importar as três novas exportações):
  - `E25 AC1: workflowRuleCovered accepts only the exact rule or bare Workflow`: `true` para `[S('Workflow(productivity-tools:release-workflow)')]` e `[S('Workflow')]`, também na segunda ou terceira posição da lista; `false` para `[]`, `[S('Workflow(*)')]`, `[S('Workflow(productivity-tools:roadmap-release)')]`, `[S('Bash')]`, `[null]`, `[{}]`, `[{ permissions: {} }]`, `[{ permissions: { allow: 'Workflow' } }]` (sem lançar).
  - `E25 AC1: without a covering rule the warning carries the exact rule and missingRules does not`: `repoWithRoadmap(true)`, `home` vazio, `ref: 'rel'` → `warnings` contém exatamente a string da spec (`release workflow: no permission rule covers it, ... Workflow(productivity-tools:release-workflow)`); `missingRules` não contém `Workflow(productivity-tools:release-workflow)` nem nenhuma entrada que comece com `Workflow`.
  - `E25 AC1: with the rule in any of the three settings, or bare Workflow, no warning`: a regra em `<home>/.claude/settings.json`, em `configDir/settings.json`, em `<root>/.claude/settings.json`, em `<root>/.claude/settings.local.json`, e `Workflow` sem conteúdo → nenhum aviso que comece com `release workflow:`.
  - `E25 AC1: Workflow(*) does not cover, so the warning appears`.
  - `E25 AC1: with errors the warning is not computed`: uma config inválida no ref (por exemplo sem `gates`) → `errors` não vazio e nenhum aviso `release workflow:`.
  - `E25 AC1: RELEASE_WORKFLOW starts with the plugin.json name`: lê `../../../.claude-plugin/plugin.json` e confere `RELEASE_WORKFLOW === \`${name}:release-workflow\``. A amarração com `meta.name` do script entra na Tarefa 3, em `flow.test.mjs` (o script só muda de nome lá; decisão do planejador para manter a Tarefa 3 em 4 arquivos, sem teste vermelho entre commits).
- [ ] **Passo 2: ajustar os testes existentes que conferem `warnings` exatos** (linhas ~262, ~264 e o caso `L3-B` não precisa): nos casos `npm.warnings` e `reviewed ... .warnings` do teste `I5: a derived config detects the lockfile...`, gravar em `home` um `.claude/settings.json` com `{ permissions: { allow: ['Workflow(productivity-tools:release-workflow)'] } }` antes de chamar `runPreflight`, para que as asserções exatas fiquem como estão. Nenhuma asserção é removida.
- [ ] **Passo 3: rodar e ver falhar.** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` → FAIL por import ausente.
- [ ] **Passo 4: implementar** as três exportações e, em `runPreflight`, depois de `missing = missingRules(...)` e dentro do mesmo bloco (só com `config` e sem `errors`), `if (!workflowRuleCovered(settings)) warnings.push(<texto exato da spec, com releaseWorkflowRule() no fim>)`. A regra nunca entra em `requiredCommands` nem em `missingRules`.
- [ ] **Passo 5: `config.md`**, seção "Permission preflight": uma frase ao fim do primeiro parágrafo: o preflight também adiciona a `warnings` a regra `Workflow(productivity-tools:release-workflow)` quando nenhuma das três configurações tem essa regra ou `Workflow` sem conteúdo; é só aviso (nunca entra em `missingRules`, nunca para o passo 2), e o lançamento pela skill é concedido pelo `allowed-tools` da skill ou pelo "don't ask again" do diálogo; a regra só é necessária para rodar sem interface (`claude -p`) ou lançar fora da skill.
- [ ] **Passo 6: rodar e ver passar.** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` → exit 0.
- [ ] **Passo 7: gates completos** → todos exit 0; G1 failing 0, skipped 0.
- [ ] **Passo 8: commit** `git add` dos três arquivos; `E25 T2: preflight avisa a regra do workflow do release sem bloquear`.

### Tarefa 3: peças 2 e 4 -- workflow nomeado, lançamento pelo nome com reserva e `compatibility` (critério 3)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `plugins/productivity-tools/.claude-plugin/plugin.json`
- Modify: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (linha 2, `meta.name`)
- Modify: `plugins/productivity-tools/skills/roadmap-release/SKILL.md` (frontmatter, linha 8 e passo 4)
- Test: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consumes: `RELEASE_WORKFLOW` (Tarefa 2).
- Produces: `plugin.json` com `"workflows": ["./skills/roadmap-release/workflow/roadmap-release.js"]` (versão continua `1.6.0`); `meta.name === 'release-workflow'`; SKILL.md com `compatibility` (texto literal da spec) e passo 4 que chama `Workflow` com `name` `productivity-tools:release-workflow`.

- [ ] **Passo 1: escrever os testes que falham** em `flow.test.mjs` (ler arquivos com `readFileSync` relativos a `dirname(fileURLToPath(import.meta.url))`, normalizando CRLF):
  - `E25 AC3: plugin.json registers the release workflow file`: `workflows` é lista e contém `./skills/roadmap-release/workflow/roadmap-release.js`; o arquivo resolvido a partir da raiz do plugin existe; `version` continua `1.6.0`.
  - `E25 AC3: the workflow name is release-workflow and is no skill's name`: `meta.name` (regex `/export const meta = \{[\s\S]*?\bname:\s*'([^']+)'/` sobre o fonte) é `release-workflow`; `RELEASE_WORKFLOW` importado de `../scripts/preflight.mjs` é igual a `` `${plugin.json name}:${meta.name}` ``; não é igual a nenhum `name:` do frontmatter de `skills/*/SKILL.md` do plugin nem a nenhum nome de pasta em `skills/`.
  - `E25 AC3: the skill launches by that name`: o corpo do SKILL.md contém `` `name` set to `productivity-tools:release-workflow` `` no passo 4 e não manda mais `scriptPath` como primeira chamada (a única menção a `scriptPath` fica no parágrafo da reserva, que contém `not found` ou `unknown` e cita `--add-dir`); a abertura (linha 8) cita `productivity-tools:release-workflow`.
  - `E25 AC3: the fallback is only for an unknown name and a permission denial shows the rule`: o passo 4 contém a frase de negação por permissão com `Workflow(productivity-tools:release-workflow)` e diz que não tenta o caminho.
  - `E25 AC3: compatibility declares the minimum version`: frontmatter tem `compatibility` com `2.1.322` e menos de 500 caracteres.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` → FAIL nos cinco testes novos.
- [ ] **Passo 3: `plugin.json`**: acrescentar a chave `workflows` depois de `keywords`. Rodar G3 já aqui: se `claude plugin validate plugins/productivity-tools` recusar a chave, parar a tarefa e devolver o erro literal (primeiro risco do card: o card se reduz à peça 1); não contornar.
- [ ] **Passo 4: `roadmap-release.js`**: `name: 'release-workflow'`. Nada mais muda no script.
- [ ] **Passo 5: `SKILL.md`**:
  - Frontmatter: `compatibility: "Claude Code 2.1.322 or later launches the release workflow by name; older versions fall back to the script path, which works only without permission prompts or with the script folder readable."`
  - Linha 8: "Runs ... through the plugin workflow `productivity-tools:release-workflow` (source: `workflow/roadmap-release.js`), then verifies ...".
  - Passo 4: "Call the `Workflow` tool with `name` set to `productivity-tools:release-workflow` and `args` ..."; o resto (os seis argumentos, retomada, mapeamento) sem mudança. Substituir as frases do caminho por: (a) reserva: quando o `Workflow` responder que o nome não existe (workflow not found / unknown name), uma única chamada com `scriptPath` = `<dir>/workflow/roadmap-release.js` (absoluto, da linha "Base directory for this skill: <dir>", nunca fixo) e os mesmos `args`, dizendo à pessoa que essa reserva só funciona sem prompts de permissão ou com a pasta do script liberada (por exemplo `--add-dir`), porque no modo padrão a pasta do cache do plugin não é legível; se a reserva falhar, relatar os dois erros literais e terminar, sem nova tentativa; (b) negação por permissão: não tentar o caminho; relatar a negação e mostrar a regra exata `Workflow(productivity-tools:release-workflow)` para a pessoa acrescentar, sem editar configuração.
- [ ] **Passo 6: rodar e ver passar.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` → exit 0.
- [ ] **Passo 7: gates completos** → todos exit 0 (G3 aceita `workflows`; G5 continua 0 porque o lint ainda não tem a checagem de `compatibility` e o SKILL.md já a tem).
- [ ] **Passo 8: commit** `git add` dos quatro arquivos; `E25 T3: workflow do release registrado e lançado pelo nome, com reserva por caminho`.

### Tarefa 4: peça 4 -- lint exige `compatibility` com versão (critério 5, parte 1)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` (laço de SKILL.md, linhas ~221-250; ler `plugin.json` já lido como `pj`)
- Test: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`

**Interfaces:**
- Produces (interno ao lint, usado de novo na Tarefa 5): `registeredWorkflows(dir, pj): Array<{ file: string, name: string, full: string }>`, que lê cada caminho de `pj.workflows` (lista; ausente = `[]`), extrai `meta.name` por regex sobre o fonte (arquivo ausente ou sem `meta.name` é ignorado) e devolve `full = \`${pj.name}:${name}\``; e `skillAllowedTools(fm): string[]`, que separa o valor de `allowed-tools` em entradas (espaço ou vírgula fora de parênteses; remove `-` inicial de item de lista e aspas envolventes de cada entrada; descarta vazias).
- Regra: um SKILL.md cujo corpo contém algum `full` de `registeredWorkflows`, ou cujo `skillAllowedTools` tem entrada que começa com `Workflow(`, precisa de `compatibility` que case `/\d+\.\d+\.\d+/`; senão `FAIL` `compatibility must declare the minimum Claude Code version that launches <full> by name` (para `allowed-tools`, `<full>` = o conteúdo entre parênteses da primeira entrada `Workflow(...)`).

- [ ] **Passo 1: escrever os testes que falham** em `lint-plugin.test.mjs`, com um helper `freshNamed(name)` que copia o fixture `valid` para `<tmp>/<name>`, troca `name` no `plugin.json`, e grava um workflow `workflow/w.js` com `export const meta = { name: 'w1' }` e `workflows: ['./workflow/w.js']`:
  - `E25 AC5: a skill naming a registered workflow without compatibility -> FAIL`: SKILL.md com corpo citando `<name>:w1` e sem `compatibility` → `has(r, 'FAIL', 'compatibility must declare the minimum Claude Code version')`.
  - `E25 AC5: compatibility without a version -> FAIL`: `compatibility: Claude Code recent` → o mesmo FAIL.
  - `E25 AC5: compatibility with a version -> OK`: `compatibility: "Claude Code 2.1.322 or later ..."` → nenhum FAIL de `compatibility`.
  - `E25 AC5: a skill not naming any registered workflow needs no compatibility`: nenhum FAIL de `compatibility`.
  - `E25 AC5: plugin.json without workflows -> nothing is registered`: corpo citando `<name>:w1` sem `workflows` → nenhum FAIL de `compatibility`.
  - `E25 AC5: the real productivity-tools plugin lints with 0 FAIL`: `lintPlugin(<repo>/plugins/productivity-tools)` sem `FAIL`.
  - O teste existente `valid fixture has 0 FAIL and 0 WARN` continua passando.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → FAIL nos dois primeiros testes novos.
- [ ] **Passo 3: implementar** `registeredWorkflows`, `skillAllowedTools` e a regra no laço de SKILL.md (o FAIL entra em `problems`). `allowed-tools` continua com o aviso "outside the allowed frontmatter keys" nesta tarefa (a Tarefa 5 o troca).
- [ ] **Passo 4: rodar e ver passar.** O mesmo comando → exit 0.
- [ ] **Passo 5: gates completos** → todos exit 0 (G5 sai 0: o SKILL.md do release cita `productivity-tools:release-workflow` e tem `compatibility` com `2.1.322`).
- [ ] **Passo 6: commit** `git add` dos dois arquivos; assunto exato `E25 T4: feat(roadmap-release): workflow do release lançado pelo nome (E25)`. Este é o "commit anterior à concessão" dos passos do dono; registrar o SHA (`git rev-parse HEAD`) no relatório da tarefa.

### Tarefa 5: peça 5 -- concessão por `allowed-tools`, checagem no lint e frase do `CLAUDE.md` (critério 5, parte 2; raio de impacto alto)

tier: sonnet · reviewTier: opus · needsLock: nenhum · external: false · navegador: não

Risco alto (DEC-049, instrução do dono item 2): revisão por tarefa em opus, nenhum revisor sonnet; a Tarefa 6 (segurança) vem logo depois e o portão final da branch é opus/high.

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-release/SKILL.md` (frontmatter)
- Modify: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`
- Modify: `CLAUDE.md` (regra "SKILL.md frontmatter keys (repo policy)", linha 9)
- Test: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`

**Interfaces:**
- Consumes: `registeredWorkflows`, `skillAllowedTools` (Tarefa 4).
- Produces: constante no lint `ALLOWED_TOOLS_EXCEPTION = { plugin: 'productivity-tools', skill: 'skills/roadmap-release/SKILL.md', entry: 'Workflow(productivity-tools:release-workflow)' }` (fixa, nunca derivada de `workflows`); três FAILs com os textos literais da spec ("Peça 5"): `allowed-tools is allowed only in productivity-tools/skills/roadmap-release/SKILL.md (DEC-049); remove it`, `allowed-tools may only grant Workflow(productivity-tools:release-workflow) (DEC-049); remove <entrada>` (um por entrada proibida; para lista vazia, `<entrada>` = `(empty)`), `allowed-tools grants Workflow(productivity-tools:release-workflow), which plugin.json does not register`.

- [ ] **Passo 1: escrever os testes que falham** em `lint-plugin.test.mjs`, com `freshNamed('productivity-tools')` (Tarefa 4) mais um workflow registrado de `meta.name` `release-workflow` e um segundo registrado `other-workflow`, e SKILL.md em `skills/roadmap-release/SKILL.md` com `compatibility` com versão:
  - `E25 AC5: the exception skill with only the allowed entry -> OK` (linha única; lista YAML `allowed-tools:\n  - Workflow(productivity-tools:release-workflow)`; entrada entre aspas; arquivo com CRLF): nenhum FAIL e nenhum WARN de `allowed-tools`.
  - `E25 AC5: escape forms in the exception skill -> FAIL naming the entry`, um caso por forma: `Workflow`, `Workflow(*)`, `Bash(git:*)`, `Workflow(other-plugin:x)`, `Workflow(productivity-tools:other-workflow)`, lista YAML com a entrada permitida mais `- Bash`, `Workflow(productivity-tools:release-workflow),Bash`, `allowed-tools:` vazio → `has(r, 'FAIL', 'allowed-tools may only grant')` e a mensagem nomeia a entrada proibida.
  - `E25 AC5: allowed-tools in another skill of productivity-tools -> FAIL even with the allowed entry`: `skills/roadmap-planner/SKILL.md`, `skills/roadmap-release-x/SKILL.md` e `skills/other/roadmap-release/SKILL.md` → `has(r, 'FAIL', 'allowed-tools is allowed only in productivity-tools/skills/roadmap-release/SKILL.md')`.
  - `E25 AC5: allowed-tools in a skill of another plugin -> FAIL`: plugin `valid` (e plugin `other` com pasta `skills/roadmap-release/`) com a entrada permitida → o mesmo FAIL.
  - `E25 AC5: the allowed entry without a registered release-workflow -> FAIL`: `plugin.json` sem `workflows`, e com `workflows` só de `other-workflow` → `has(r, 'FAIL', 'which plugin.json does not register')`.
  - `E25 AC5: allowed-tools with a Workflow entry and no compatibility -> FAIL` (regra da Tarefa 4 alcançada por `allowed-tools`).
  - `E25 AC5: allowed-tools is no longer reported as outside the allowed keys`: nenhum WARN `key "allowed-tools" is outside`.
  - `E25 AC5: the real productivity-tools SKILL.md declares the grant`: frontmatter do SKILL.md real tem `allowed-tools: Workflow(productivity-tools:release-workflow)` e `lintPlugin` do plugin real dá 0 FAIL.
- [ ] **Passo 2: rodar e ver falhar.** `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → FAIL nos testes novos.
- [ ] **Passo 3: implementar** no lint: `allowed-tools` sai do aviso de chave fora da lista (sem entrar em `SKILL_KEYS`, que continua a política geral) e ganha a checagem própria: caminho relativo do SKILL.md com `/`; exceção só quando `pj.name === ALLOWED_TOOLS_EXCEPTION.plugin` e caminho `=== ALLOWED_TOOLS_EXCEPTION.skill`; fora dela, FAIL "allowed only in"; dentro dela, lista vazia ou qualquer entrada diferente de `entry` → FAIL "may only grant" por entrada; com a entrada única, FAIL "does not register" quando nenhum `registeredWorkflows` tem `name === 'release-workflow'`.
- [ ] **Passo 4: `SKILL.md` do release**: no frontmatter, `allowed-tools: Workflow(productivity-tools:release-workflow)` em linha única, depois de `compatibility`. Nenhum outro texto do SKILL.md muda.
- [ ] **Passo 5: `CLAUDE.md`**: acrescentar ao fim da linha 9 (regra "SKILL.md frontmatter keys (repo policy)"), depois de "spelling matters.", um espaço e a frase literal da spec: ``Single exception (DEC-049): `productivity-tools/skills/roadmap-release/SKILL.md` declares `allowed-tools: Workflow(productivity-tools:release-workflow)`, and `lint-plugin` fails `allowed-tools` in any other skill and any other entry.``. `git diff CLAUDE.md` mostra só essa linha alterada, sem outra mudança de texto.
- [ ] **Passo 6: rodar e ver passar.** `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → exit 0; `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` → exit 0 (o teste do critério 3 continua válido com o frontmatter novo).
- [ ] **Passo 7: gates completos** → todos exit 0.
- [ ] **Passo 8: commit** `git add` dos quatro arquivos; `E25 T5: skill do release concede o próprio workflow por allowed-tools, exceção única no lint (DEC-049)`. Último commit de código da branch.

### Tarefa 6: revisão de segurança da peça 5 (somente leitura)

tier: opus · reviewTier: opus · needsLock: nenhum · external: false · navegador: não

**Files:** nenhum. Esta tarefa não altera arquivo e não faz commit; o resultado vai no relatório da tarefa (o orquestrador o leva ao log de revisões).

- [ ] **Passo 1: ler** o diff `git diff <SHA da Tarefa 4>..HEAD` e os arquivos inteiros que ele toca, mais o bloco "args and config" de `roadmap-release.js` e as "Rules" e passos 2 e 4 do SKILL.md.
- [ ] **Passo 2: conferir os quatro pontos da spec** ("Peça 5", revisão de raio de impacto alto), cada um com veredito e evidência (arquivo:linha): (1) concessão só para `Workflow(productivity-tools:release-workflow)` e só no SKILL.md do release, nenhum texto a amplia; (2) lançamento sem preflight recusado antes de qualquer agente (Tarefa 1) e `authorizeExternal` só cresce pela resposta da pessoa, a parada do passo 2 continua; (3) o cenário de injeção (conteúdo do repositório levando o modelo a carregar a skill e lançar sem pedido): o que o workflow faz sem autorização e se a restrição ao próprio workflow, a trava e as regras da skill o cobrem; (4) o lint acusa cada forma de escape listada (rodar `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → exit 0 e apontar o teste de cada forma).
- [ ] **Passo 3: veredito.** PASS, ou risco não coberto. Com risco não coberto: a execução para como decisão (gatilho de revisão de DEC-049), devolvida ao dono, e a peça 5 (commit da Tarefa 5) não entra no merge; as peças 1 a 4 seguem (instrução do dono item 8). Nenhuma correção é feita nesta tarefa.

---

## Passos do dono para os critérios 4 e 6 (pendências do dono, nunca marcadas por agente)

Os critérios 4 e 6 são atos humanos e ficam registrados como pendências do dono. Os passos exatos estão na spec, seção "Como o dono confere os critérios 4 e 6" (preparação comum, critério 4 roteiro A no commit anterior à concessão, achado pelo assunto `feat(roadmap-release): workflow do release lançado pelo nome (E25)` em `release/roadmap-skills-v2`; critério 6 roteiro A com a concessão; roteiro B pelo cache num `CLAUDE_CONFIG_DIR` descartável; limpeza). Com a concessão presente nenhum diálogo aparece, por isso o critério 4 só se confere no commit da Tarefa 4. Os passos rodam depois da integração, a partir da worktree de integração; nenhum agente os executa. `skipWorkflowUsageWarning` é só observação registrada nesses passos (nenhum código deste plano a lê ou grava).

## Acceptance criteria evidence

Os comandos só leem o repositório e escrevem em pastas temporárias do sistema: nenhum tem efeito externo. Os critérios 4 e 6 são ato humano do dono (sessões interativas no modo padrão), nunca marcados como cumpridos por agente.

| ac | kind | command | testRef | blq | external | externalDedupe |
|---|---|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | `preflight.test.mjs`: testes `E25 AC1: ...` (Tarefa 2) | - | false | - |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `flow.test.mjs`: testes `E25 AC2: ...` (Tarefa 1) e B4, FF/M6, F2/m2 | - | false | - |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `flow.test.mjs`: testes `E25 AC3: ...` (Tarefa 3) | - | false | - |
| AC4 | human | - | o dono confere em duas sessões seguidas, no commit da Tarefa 4 (anterior à concessão), pelo roteiro A da spec, e registra o modo de permissão | - | false | - |
| AC5 | test | `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` | `lint-plugin.test.mjs`: testes `E25 AC5: ...` (Tarefas 4 e 5) | - | false | - |
| AC5 | test | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` | G5 sobre o plugin real com `compatibility` e `allowed-tools` (Tarefa 5) | - | false | - |
| AC6 | human | - | o dono confere numa sessão nova, com a concessão em `release/roadmap-skills-v2`, pelo roteiro A da spec, e registra o modo de permissão | - | false | - |
