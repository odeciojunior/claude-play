# E17 -- Ponto de medição e primeira publicação: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** deixar pronto em `feat/E17` tudo o que o executor entrega para a primeira publicação: o arnês de E1 apto a medir a versão 1.7.0 contra a linha de base de E15 (regras do sandbox, painel por tentativa, metas de prosa, `checkpoint.mjs`), o commit de versão `M`, a saída dos gates, a branch de volta ensaiada, o roteiro do dono e a lista de ratificação.

**Arquitetura:** quatro tarefas de arnês em `tools/measure/` (repo-only, não publicado), cada uma com teste; depois o commit de versão (peça 2), que fixa `M`; a saída dos gates em `M`; a branch de volta montada numa árvore descartável (tarefa externa); por último o roteiro e a lista de ratificação. As execuções pagas e a publicação são passos do dono no roteiro, nunca tarefas deste plano.

**Tecnologia:** JavaScript ESM (Node >= 18; medido v22.17.1), `node:test`, sem dependências; Markdown em português (relatórios), código e mensagens de código em inglês como o resto de `tools/measure/` (os vereditos e rótulos já em português no comparador seguem como estão).

**Spec:** `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md` (ler junto; as seções "Peça 1" a "Peça 5", "Casos de borda" e "Autonomous decisions" são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash 5.2.37 e PowerShell 7, Node v22.17.1, claude CLI 2.1.322, `core.autocrlf=true` (checkouts CRLF). Todo código que lê texto do repositório normaliza com `.replace(/\r\n?/g, '\n')`; bytes de prosa são sempre medidos em LF.
- Worktree `D:/projects/claude-play-wt/E17`, branch `feat/E17`, faixa de portas 5200-5209 (nenhuma tarefa sobe servidor). Nada de push, nada em `main`, nada em `D:/projects/claude-play`, nada na worktree de integração. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa. Temporários só em `D:/projects/claude-play-wt/_tmp/E17/` (criar e apagar no fim da tarefa). Ao fim de cada tarefa `git status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`).
- Não editar: `docs/plans/roadmap-evolucao-skills/` e a estratégia, `plugins/_template/`, os braços `tools/measure/arms/*.md` (DEC-279), limiares, regras e unidades de `tools/measure/compare.mjs` (DEC-033, DEC-081, DEC-089), nenhum gate canônico. `formats.md` fica com "since 1.5.0" e o exemplo de JSON como está.
- Versões fixadas: `productivity-tools` 1.7.0, `marketplace-tools` 1.2.0, linha 1 do checker `// check-roadmap 1.7.0 format 1`; branch de volta `volta/productivity-tools-1.7.1` com `productivity-tools` 1.7.1 e checker `// check-roadmap 1.7.1 format 1`.
- Condições da medição (só no roteiro, nunca mudadas pelo código): `bypassPermissions` (DEC-280), classe plano por `--stage plan-review --arm atual` (DEC-279), semeadura de `docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1/` com sha256 `7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93` (spec) e `ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912` (plano) (DEC-278), contagens de `BASELINE_PLAN`, superpowers 7.0.0.
- Commits: `E17 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`. O commit da Tarefa 5 tem o assunto exato `E17 T5: chore(release): productivity-tools 1.7.0 e marketplace-tools 1.2.0`; esse commit é `M`.
- Gates canônicos (linha de base do alvo não medida; o executor mede G1 no início da Tarefa 1 e anota total e failing no relatório; nenhuma falha é esperada em nenhuma tarefa):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, failing 0
  - G2: `claude plugin validate .` → exit 0
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0
  - Extras da regra do `CLAUDE.md` (plugin `marketplace-tools` alterado na Tarefa 5): `claude plugin validate plugins/marketplace-tools` → exit 0; `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools` → exit 0.
- Nenhuma tarefa precisa de navegador, de lock ou de credencial. Só a Tarefa 7 é externa (cria a branch local `volta/productivity-tools-1.7.1`, fora de `feat/E17`). Quando um passo não puder ser exercido neste ambiente, a evidência aceitável é a saída literal do comando que mostra o motivo, no relatório da tarefa (e, nas Tarefas 6 e 7, no relatório em `docs/reports/`).
- Execução decidida pelo decisor delegado do dono (Fable), não digitada pelo dono: segue sem as regras Bash que faltam porque a sessão orquestradora roda em `bypassPermissions`. Tarefas 1 a 6 já commitadas (`7e9aa48` a `8b6be4a`); a Tarefa 7 foi autorizada pelo dono em pessoa (E17:T7@3cd7b4c7). A correção `c7efe09` de `armMatches` (DEC-310: ignora o fim de linha final do braço e a barra de escape antes de `|`) está em `feat/E17` depois da T6 e não entra em `M` nem na branch de volta; os braços não são editados.
- Execuções pagas (DEC-204, DEC-088, DEC-011) e publicação (DEC-007, DEC-014, DEC-036) não são tarefas deste plano: ficam no roteiro (Tarefa 8) como passos do dono. As execuções pagas rodam depois do merge de `feat/E17` na branch de release; seus resultados (`comparacao.*`, `medicao-1.7.0.json`) entram por um commit só de `docs/reports/` em `feat/E17`, do orquestrador ou do dono, fora do workflow, e um novo merge na branch de release, antes da publicação (DEC-297, emenda a DEC-296).

## Foco da revisão

1. Lado "depois" medido em outro modo de permissão, ou com a classe plano em modo pipeline: `checkpoint.mjs` sai 2 (permissão) ou dá a classe `inconclusivo` (modo), nunca um veredito; testes na Tarefa 4.
2. Variante presente só num dos lados (por exemplo, `tracker` faltando no depois): aparece na tabela como `ausente`, sem veredito e sem lançar; não bloqueia sozinha; teste na Tarefa 4.
3. Agregado antigo sem `panel` nas tentativas (a linha de base de E15): o painel do lado "antes" não é conferido e `compare()` o ignora; só o lado "depois" das três variantes do release é conferido; testes nas Tarefas 2 e 4.
4. Texto com CRLF (checkout Windows) nos braços, no workflow em `M` e nos arquivos de prosa: a conferência do braço e as metas normalizam para LF antes de comparar e medir; testes nas Tarefas 3 e 4.
5. Sandbox onde a CLI ou o checker do plugin medido falha (saída não JSON, exit diferente de 0/1): `panel` grava `{ error: <mensagem> }` e a tentativa continua válida pelos contadores; o checkpoint trata `error` como painel diferente do esperado; testes nas Tarefas 2 e 4.

## Mapa de arquivos

| Arquivo | Tarefa | Responsabilidade |
|---|---|---|
| `tools/measure/make-scenario.mjs` (+ `.test.mjs`) | 1 | regras do sandbox para o preflight 1.7.0; teste da árvore da semeadura arquivada |
| `tools/measure/run-batch.mjs` (+ `.test.mjs`), `tools/measure/baseline.test.mjs` | 2 | campo `panel` por tentativa do release; `installPath` em `readPlugin` |
| `tools/measure/prose-goals.mjs` (+ `.test.mjs`) | 3 | metas de prosa de E4 e E22 |
| `tools/measure/checkpoint.mjs` (+ `.test.mjs`) | 4 | ponto de medição |
| `plugins/productivity-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md`, `check-roadmap.mjs`, `check-roadmap.test.mjs`, `flow.test.mjs` | 5 | commit de versão `M` |
| `docs/reports/2026-11-12-e17-ponto-de-medicao/gates.md` | 6 | saída de G1 a G5 em `M`, SHA de `M` e árvore do plugin |
| `docs/reports/2026-11-12-e17-ponto-de-medicao/volta.md` (+ branch local `volta/productivity-tools-1.7.1`) | 7 | branch de volta |
| `docs/reports/2026-11-12-e17-ponto-de-medicao/roteiro.md`, `ratificacao.md`, `tools/measure/roteiro-e17.test.mjs` | 8 | roteiro do dono e lista de ratificação |

---

### Tarefa 1: regras do sandbox para o preflight 1.7.0 e árvore da semeadura arquivada (peça 1, itens 1 e 2)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `tools/measure/make-scenario.mjs` (linha 31, `SANDBOX_RELEASE_RULES`)
- Test: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Produces: `SANDBOX_RELEASE_RULES` = as quatro regras atuais, na mesma ordem, seguidas das regras que o preflight 1.7.0 exige para o sandbox (no mínimo `Workflow(productivity-tools:release-workflow)` e `Bash(node *roadmap.mjs" *)`; o conjunto final é o que o teste do passo 1 fixa). A Tarefa 8 copia a lista para os `--allow` do roteiro.
- Consumes: `makeSandbox(target)` de `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs`; `runPreflight(folder, { home, configDir })` de `.../scripts/preflight.mjs` (devolve `{ errors, missingRules, warnings, ... }`); `seedSourceOf(fromRun)` de `make-scenario.mjs`.

- [ ] **Passo 1: medir G1 no início** e anotar no relatório as linhas `# tests`, `# pass`, `# fail` (esperado: exit 0, fail 0).
- [ ] **Passo 2: escrever os testes que falham** em `make-scenario.test.mjs`:
  - `E17: sandbox settings leave the 1.7.0 preflight with no missing rule`: `makeSandbox(<tmp>/sb)`, gravar `<sb>/.claude/settings.local.json` com `{ permissions: { allow: SANDBOX_RELEASE_RULES } }` (o mesmo JSON que `makeScenario` grava), `runPreflight(join(sb, 'docs/plans/roadmap-sandbox'), { home: <tmp vazio>, configDir: <tmp vazio> })` → `errors` vazio, `missingRules` vazio, e nenhum `warnings[i]` começa com `release workflow:`.
  - `E17: SANDBOX_RELEASE_RULES keeps the 1.6.0 rules first`: `SANDBOX_RELEASE_RULES.slice(0, 4)` igual a `['Bash(node:*)', 'Bash(git:*)', 'Workflow', 'Workflow(productivity-tools:roadmap-release)']`.
  - `E17: a tree mounted from the archived E15 seed passes the --from-run pre-check`: copiar `docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1/2026-11-12-E5-text-utilities-design.md` para `<tmp>/seed/docs/superpowers/specs/` e `2026-11-12-E5-text-utilities.md` para `<tmp>/seed/docs/superpowers/plans/`; `seedSourceOf(<tmp>/seed)` → `kind === 'execucao-aprovada'`, `specSha256` e `planSha256` iguais aos valores das Restrições globais (conferido no planejamento: o pré-check atual aceita essa árvore, então `run-baseline.mjs` não muda).
  - Todo `<tmp>` sob `os.tmpdir()` com `mkdtempSync`, removido em `after`.
- [ ] **Passo 3: rodar e ver falhar.** `node --test tools/measure/make-scenario.test.mjs` → FAIL no primeiro teste (a mensagem lista as regras ausentes; anotar a lista). O terceiro já passa (é teste de fixação).
- [ ] **Passo 4: implementar** acrescentando a `SANDBOX_RELEASE_RULES` exatamente as regras que o passo 3 listou como ausentes (e `Workflow(productivity-tools:release-workflow)`, que o aviso pede). Não remover nem reordenar as quatro atuais.
- [ ] **Passo 5: rodar e ver passar.** `node --test tools/measure/make-scenario.test.mjs` → exit 0. Depois G1 → exit 0, fail 0.
- [ ] **Passo 6: commit** `git add tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs`; `E17 T1: regras do sandbox para o preflight 1.7.0 e semeadura arquivada fixada`.

### Tarefa 2: painel do registro por CLI por tentativa (peça 1, item 3)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Modify: `tools/measure/run-batch.mjs` (`readPlugin`, linhas 99-111; laço de tentativas de `runBatch`, onde a tentativa válida é empurrada em `attempts`)
- Test: `tools/measure/run-batch.test.mjs`, `tools/measure/baseline.test.mjs`

**Interfaces:**
- Produces (em `run-batch.mjs`):
  - `readPlugin(configDir)` passa a devolver também `installPath` (campo `installPath` da entrada de `installed_plugins.json`; `'unknown'` quando falta). `version` e `commit` não mudam.
  - `export const PANEL_VARIANTS = ['plan-only', 'completo', 'parada-retomada']`
  - `export const EXPECTED_PANEL = { 'plan-only': { status: 'plan', mergeEvidence: false }, completo: { status: 'on-branch', mergeEvidence: true }, 'parada-retomada': { status: 'on-branch', mergeEvidence: true } }` (vocabulário da pasta do sandbox; o alvo `release/sandbox` não é a `integrationBranch` `main`, então o workflow grava `deliverableStatuses[4]` depois do merge e `deliverableStatuses[2]` no plan-only, `roadmap-release.js` linhas 1196-1204).
  - `export function readPanel(sandbox, installPath, { exec = spawnSync } = {}) -> { e5Status: string, e5Evidence: string, mergeCommit: string|null, checkerErrors: number } | { error: string }`: lê com a CLI do plugin medido (`<installPath>/skills/roadmap-tracker/scripts/roadmap.mjs status docs/plans/roadmap-sandbox --json`, rodada no sandbox com `release/sandbox` em checkout) a linha de E5 do painel, o commit de merge `merge: E5 in release/sandbox` do `git log --first-parent release/sandbox` (ou `null`), e o número de erros do checker do plugin medido (`<installPath>/skills/roadmap-tracker/scripts/check-roadmap.mjs docs/plans/roadmap-sandbox --json`). Qualquer falha (CLI ausente, saída não JSON, exit fora de 0/1) devolve `{ error }` sem lançar.
  - `export function panelMatches(variant, panel) -> { ok: boolean, reasons: string[] }`: `ok` quando `panel` não tem `error`, `e5Status === EXPECTED_PANEL[variant].status`, `checkerErrors === 0` e, com `mergeEvidence`, `mergeCommit` não nulo e `e5Evidence` contém os 7 primeiros caracteres dele.
  - Cada tentativa válida de uma variante de `PANEL_VARIANTS` ganha o campo `panel` (resultado de `readPanel`); as demais variantes não ganham o campo.
- Consumes: nada de outras tarefas.

- [ ] **Passo 1: escrever os testes que falham** em `run-batch.test.mjs`:
  - `E17: readPlugin returns installPath`: `installed_plugins.json` sintético com `installPath: '/c/x'` → `installPath === '/c/x'`; sem o campo → `'unknown'`, `version`/`commit` como hoje.
  - `E17: panelMatches accepts the expected panel per variant`: para `completo` com `{ e5Status: 'on-branch', e5Evidence: 'merge abc1234', mergeCommit: 'abc1234def', checkerErrors: 0 }` → `ok`; com `e5Status: 'integrated'` → não ok com razão citando o status; com `checkerErrors: 2` → não ok; com `{ error: 'x' }` → não ok; `plan-only` com `{ e5Status: 'plan', mergeCommit: null, checkerErrors: 0, e5Evidence: '' }` → `ok`.
  - `E17: readPanel never throws`: `exec` falso que devolve `stdout: 'not json'` → `{ error }`.
  - `E17: release attempts carry panel, other variants do not`: pelo arnês de `exec` falso já usado nos testes de `runBatch`, uma tentativa válida de `completo` traz `panel` no agregado e uma de `planner` não traz.
- [ ] **Passo 2: escrever o teste** em `baseline.test.mjs`: `E17: panel survives the merge of partial aggregates` (dois agregados parciais com `attempts[].panel` → o agregado juntado mantém cada `panel`; hoje `structuredClone` já preserva, é teste de fixação).
- [ ] **Passo 3: rodar e ver falhar.** `node --test tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs` → FAIL nos testes de `run-batch` (exports ausentes).
- [ ] **Passo 4: implementar** as interfaces acima. `readPanel` faz `git checkout -q release/sandbox` no sandbox (descartável) depois de `settleSandbox`; se `release/sandbox` não existir, `{ error: 'release/sandbox missing' }`. O nome do campo da linha do painel (status, evidência) é o que `readPanel` de `roadmap.mjs` (linha 166) devolve; o teste usa a forma real.
- [ ] **Passo 5: rodar e ver passar.** Mesmo comando → exit 0. G1 → exit 0, fail 0.
- [ ] **Passo 6: commit** `git add tools/measure/run-batch.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs`; `E17 T2: painel do registro por CLI gravado por tentativa do release`.

### Tarefa 3: metas de prosa de E4 e E22 (peça 1, item 6)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Create: `tools/measure/prose-goals.mjs`
- Test: `tools/measure/prose-goals.test.mjs`

**Interfaces:**
- Produces:
  - `export const GOALS = [{ deliverable: 'E4', goal: 'prosa carregável do planner', unit: 'bytes LF', target: 43335 }, { deliverable: 'E22', goal: 'prosa do tracker por evento', unit: 'bytes LF', target: 29096 }]`
  - `export const NOT_APPLICABLE = ['E23', 'E12', 'E10']` (conferidas em E13; saem `não aplicável neste ponto`).
  - `export function plannerLoad(read) -> { bytes: number, files: string[] }`: soma LF de `plugins/productivity-tools/skills/roadmap-planner/` `SKILL.md`, `references/clarify.md`, `references/decompose.md`, `references/model.md`.
  - `export function trackerMaxEventLoad(read, list) -> { bytes: number, event: string }`: maior carga dos eventos do índice de `roadmap-tracker/references/events.md` pela definição de DEC-234 com a emenda DEC-252 (SKILL.md + `events.md` + receita + arquivos de `references/` fora de `events/` citados pelo nome na receita + seções `formats.md § N` citadas em arquivo da carga; receita encadeada por `§ N` não conta).
  - `export function measureGoals(read, list) -> Array<{ deliverable, goal, unit, target, measured: number|null, verdict: 'atingida'|'não atingida'|'não medida'|'não aplicável neste ponto' }>`; `atingida` quando `measured <= target`. Quando um arquivo da definição não existe no commit lido (`read` lança ou devolve `null`; `list` sem as receitas de `references/events/`), a meta sai `não medida` com `measured: null`, sem lançar e sem bloquear. É o caso de `3fbb59b`: o planner não tem `references/model.md`, `plugins/productivity-tools/scripts/prose-budget.test.mjs` não existe e o tracker não tem `references/events/`.
  - `read(relPath) -> string` (caminho relativo à raiz do repositório, com `/`) e `list(relDir) -> string[]` (nomes de arquivos, recursivo) são injetados: no disco para o teste, por `git show <M>:<path>` / `git ls-tree -r --name-only <M> <dir>` no `checkpoint.mjs`. O módulo não importa nenhum `*.test.mjs` e normaliza CRLF para LF antes de medir.
- Consumes: nada de outras tarefas.

- [ ] **Passo 1: escrever os testes que falham** em `prose-goals.test.mjs`:
  - `E17: planner load equals the E4 budget definition`: soma LF dos quatro arquivos calculada no próprio teste == `plannerLoad(readDisk).bytes`, e `<= 43335`.
  - `E17: tracker max event load equals the E22 budget test`: rodar `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs` por `spawnSync(process.execPath, ...)` com `env` copiado de `process.env` e `delete env.NODE_TEST_CONTEXT` (como `cli()` em `tools/measure/compare.test.mjs`, linha 17; sem isso o `node --test` filho, aninhado no do G1, não escreve a saída em texto), extrair do diagnóstico `largest load: <evento> = <n> bytes LF` o `n` e o evento, e exigir `trackerMaxEventLoad(readDisk, listDisk)` igual (bytes e número do evento), e `<= 29096`.
  - `E17: measureGoals marks each goal with its measured value`: na ponta, E4 e E22 `atingida` com `measured` numérico; E23, E12, E10 `não aplicável neste ponto` com `measured: null`; com um `read` falso que infla `SKILL.md` do planner acima da meta → E4 `não atingida` com o valor ao lado.
  - `E17: CRLF text measures the same as LF`: `read` que devolve o texto com `\r\n` → mesmos bytes.
  - `E17: a missing definition file leaves the goal not measured`: `read` falso que lança para `references/model.md` do planner → E4 `não medida`, `measured: null`, sem lançar; `list` sem `references/events/` → E22 `não medida`; o outro alvo continua medido.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/prose-goals.test.mjs` → FAIL (módulo ausente).
- [ ] **Passo 3: implementar** `prose-goals.mjs` com as interfaces acima.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0. G1 → exit 0, fail 0.
- [ ] **Passo 5: commit** `git add tools/measure/prose-goals.mjs tools/measure/prose-goals.test.mjs`; `E17 T3: metas de prosa de E4 e E22 medidas fora dos testes de orçamento`.

### Tarefa 4: ferramenta do ponto de medição `checkpoint.mjs` (peça 1, itens 4 e 5)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Create: `tools/measure/checkpoint.mjs`
- Test: `tools/measure/checkpoint.test.mjs`

**Interfaces:**
- Consumes: `compare(before, after, { margin, attempts, bytesTolerance })` de `compare.mjs` (inalterado); `PANEL_VARIANTS`, `panelMatches` (Tarefa 2); `measureGoals`, `NOT_APPLICABLE` (Tarefa 3); `readArm(file)` de `run-batch.mjs`.
- Produces:
  - Uso: `node tools/measure/checkpoint.mjs --before <baseline.json> --after <baseline.json> --dest <dir> [--date AAAA-MM-DD] [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]`. O commit medido é `after.tagCommit` (= `M`); braço e metas são lidos nesse commit por `git show`. Um arquivo de meta ausente nesse commit dá a meta `não medida` (Tarefa 3), nunca erro de uso; isso acontece quando o lado "depois" é a linha de base de E15 (`tagCommit` = `3fbb59b`).
  - `export function armMatches(armText, workflowText) -> boolean`: tira a linha `Copied from ...` do braço, normaliza CRLF dos dois textos, parte o braço nos marcadores `{{…}}` e exige que os pedaços apareçam em ordem, byte a byte, no workflow.
  - `export function checkpoint(before, after, { readAt, listAt, margin, attempts, bytesTolerance }) -> { exit: 0|1|2, variants, classes, cost, panel, arm, goals, measurementRows }`:
    - `before.permissionMode !== 'bypassPermissions'` ou `after.permissionMode !== 'bypassPermissions'` → `exit: 2`, sem veredito (DEC-280).
    - para cada variante em `before.variants` ∪ `after.variants`: presente nos dois → `compare()` sobre `variants[v]`; num só → `ausente`, sem veredito, não bloqueia.
    - para cada classe em `classes` (DEC-089) → `compare()`; para `plano-semeado`, com `arm.planReview && arm.planFix` falso, a classe sai `inconclusivo (braço defasado)` e bloqueia (DEC-081).
    - custo: mediana e faixa (mín.-máx.) de `counters.cost` das tentativas válidas, antes e depois, por variante; nunca bloqueia (DEC-017).
    - painel: para cada variante de `PANEL_VARIANTS` no `after`, `panelMatches` em cada tentativa válida; qualquer não ok bloqueia. O lado `before` não é conferido.
    - metas: `measureGoals(readAt, listAt)`; não bloqueiam (DEC-034), nem quando saem `não medida`.
    - `exit: 1` com qualquer `bloqueia` do comparador, classe inconclusiva por braço ou painel diferente; senão `0`.
  - Arquivos gravados em `--dest`: `comparacao.json` (o objeto acima menos `exit`, mais `date`, `before.tagCommit`, `after.tagCommit`) e `comparacao.md` com seções `## Contadores por variante` (variante, contador, antes, depois, veredito), `## Detecção por classe`, `## Custo`, `## Painel`, `## Braço da classe plano`, `## Metas` (meta, entregável, alvo, medido, veredito) e `## Linhas para roadmap:measurements` (uma linha de tabela por contador comparado e uma por meta, no formato das colunas de `measurements.md` da pasta do roadmap, prontas para o tracker).
  - Exit do processo = `exit`; erro de uso (flag desconhecida, arquivo ilegível) → 2.

- [ ] **Passo 1: escrever os testes que falham** em `checkpoint.test.mjs`, com agregados sintéticos mínimos no formato de `baseline.json` (copiar a forma de `docs/reports/2026-11-11-e15-linha-de-base/baseline.json`, reduzida):
  - `E17: equal sides exit 0 and write both reports` → `exit 0`, `comparacao.md` com as sete seções.
  - `E17: a blocking counter exits 1` (lado depois com contador de pior veredito `bloqueia` pelo `compare()`).
  - `E17: other permission mode exits 2 without verdicts`.
  - `E17: plan class in pipeline mode is inconclusive` (o comparador já devolve inconclusivo por modo; o checkpoint repassa).
  - `E17: variant on one side only is absent, not blocking`.
  - `E17: old aggregate without panel is not checked on the before side`; `E17: panel with error or wrong status blocks`.
  - `E17: cost inconclusive never blocks`.
  - `E17: armMatches` — verdadeiro com braço CRLF e marcadores; falso com uma palavra trocada.
  - `E17: arms match the workflow at HEAD`: `armMatches` de `tools/measure/arms/plan-review-atual.md` e `plan-fix-atual.md` contra `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` no disco → verdadeiro. Se der falso na ponta, não editar os braços (DEC-279): parar e devolver ao orquestrador como decisão do dono, com o primeiro pedaço que não casa.
  - `E17: goals are marked with measured value and never block` (meta `não atingida` com `exit 0`).
  - `E17: goals read at a commit without the definition files are not measured`: `readAt`/`listAt` falsos sem `references/model.md` do planner e sem `references/events/` do tracker (a forma de `3fbb59b`) → E4 e E22 `não medida`, `exit` decidido só pelos contadores e pelo painel.
- [ ] **Passo 2: rodar e ver falhar.** `node --test tools/measure/checkpoint.test.mjs` → FAIL (módulo ausente).
- [ ] **Passo 3: implementar** `checkpoint.mjs`; CLI só quando `process.argv[1]` é o próprio arquivo (padrão do repositório). Nenhum limiar novo: `margin`, `attempts` e `bytesTolerance` só repassam os padrões de `compare()`.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando → exit 0. Fumaça: `node tools/measure/checkpoint.mjs --before docs/reports/2026-11-11-e15-linha-de-base/baseline.json --after docs/reports/2026-11-11-e15-linha-de-base/baseline.json --dest D:/projects/claude-play-wt/_tmp/E17/cp` → exit 0 ou 1 conforme os painéis (a linha de base não tem `panel`, então as variantes do release no lado "depois" bloqueiam: esperado exit 1 com motivo "panel"; as metas, lidas em `3fbb59b`, saem `não medida`); anotar a saída no relatório e apagar a pasta. G1 → exit 0, fail 0.
- [ ] **Passo 5: commit** `git add tools/measure/checkpoint.mjs tools/measure/checkpoint.test.mjs`; `E17 T4: ponto de medição como laço sobre o comparador de E1`.

### Tarefa 5: commit de versão `M` (peça 2)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

Seis arquivos num único commit porque a spec exige um commit só com a versão (troca mecânica de valores fixados; não se divide).

**Files:**
- Modify: `plugins/productivity-tools/.claude-plugin/plugin.json` (`version` 1.7.0)
- Modify: `plugins/marketplace-tools/.claude-plugin/plugin.json` (`version` 1.2.0)
- Modify: `README.md` (linhas 26 e 29 da tabela: 1.7.0 e 1.2.0)
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (linha 1: `// check-roadmap 1.7.0 format 1`)
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` (linhas 153, 155, 421, 531, 1725, 1783)
- Modify: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` (linha 3294)

**Interfaces:**
- Produces: o commit `M` com o assunto exato `E17 T5: chore(release): productivity-tools 1.7.0 e marketplace-tools 1.2.0`; as Tarefas 6, 7 e 8 o acham com `git log --format=%H --fixed-strings --grep="E17 T5: chore(release)" -1`.

- [ ] **Passo 1: testes primeiro.** Em `check-roadmap.test.mjs`: linha 153 `'// check-roadmap 1.7.0 format 1'`; linhas 155 e 1725 `'1.7.0'`; linhas 421, 531 e 1783 `'1.7.0 format 1'`. Em `flow.test.mjs` linha 3294 `assert.equal(p.version, '1.7.0')`.
- [ ] **Passo 2: ver falhar.** `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` → FAIL nas sete asserções.
- [ ] **Passo 3: versões.** Os dois `plugin.json`, as duas linhas do `README.md`, a linha 1 do checker. Nada mais.
- [ ] **Passo 4: conferências.** `grep -n "1.5.0" plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` → só a linha 1104 (comentário de seção). `grep -rn "'1.6.0'" plugins/productivity-tools` → nenhuma linha (exit 1). `git diff --stat` → só os seis arquivos.
- [ ] **Passo 5: ver passar.** Comando do passo 2 → exit 0. Gates completos (G1 a G5 e os dois extras) → todos exit 0.
- [ ] **Passo 6: commit** `git add` dos seis arquivos; mensagem com o assunto exato das Interfaces.

### Tarefa 6: saída dos gates em `M` (peça 2)

tier: haiku · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Create: `docs/reports/2026-11-12-e17-ponto-de-medicao/gates.md`

**Interfaces:**
- Consumes: `M` (Tarefa 5).
- Produces: `gates.md` com a SHA completa de `M`, a árvore `git rev-parse <M>:plugins/productivity-tools` e, por gate (G1 a G5 e os dois extras), comando, código de saída e resumo (G1: linhas `# tests`, `# pass`, `# fail`, `# skipped`).

- [ ] **Passo 1:** com `HEAD` em `M` (nenhum commit depois dele ainda), rodar cada gate e anotar. Esperado: todos exit 0, G1 fail 0.
- [ ] **Passo 2:** gravar `gates.md` (português, sem caminho pessoal; a worktree é citada como `<worktree E17>`).
- [ ] **Passo 3: commit** `git add docs/reports/2026-11-12-e17-ponto-de-medicao/gates.md`; `E17 T6: saída de G1 a G5 no commit de versão`. Conferir depois: `git diff --stat <M> HEAD` → só `gates.md`.

### Tarefa 7: branch de volta `volta/productivity-tools-1.7.1` (peça 5) -- externa

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: true · externalDedupe: antes de criar, `git rev-parse --verify --quiet refs/heads/volta/productivity-tools-1.7.1`; se existe e o pai do seu primeiro commit é `M`, não recria e só refaz a conferência e o relatório; se existe com outro ponto de partida, para sem tocar nela e registra o achado para o dono · navegador: não

Efeito externo: cria uma branch local fora de `feat/E17` (nunca enviada ao remoto, DEC-036). Roda depois das Tarefas 5 e 6. É a Tarefa 7 externa do plano, autorizada pelo dono em pessoa (DEC-299, emenda a DEC-294); a chegada do workflow nela não basta como autorização.

**Files:**
- Create: `docs/reports/2026-11-12-e17-ponto-de-medicao/volta.md` (em `feat/E17`)
- Na branch `volta/productivity-tools-1.7.1` (árvore descartável `D:/projects/claude-play-wt/_tmp/E17/volta`, removida ao fim): `plugins/productivity-tools/**` (conteúdo da tag `productivity-tools--v1.6.0`), `plugins/productivity-tools/.claude-plugin/plugin.json` (1.7.1), `README.md` (linha de `productivity-tools` 1.7.1), `check-roadmap.mjs` linha 1, `check-roadmap.test.mjs` (as quatro asserções da tag), e arquivos repo-only de `tools/`/`.claude/` acoplados ao plugin novo (voltam ao estado da tag ou são removidos se não existiam).

**Interfaces:**
- Consumes: `M` (Tarefa 5); tag anotada `productivity-tools--v1.6.0`, já no remoto, com `productivity-tools--v1.6.0^{commit}` = `3fbb59b`.
- Produces: branch local `volta/productivity-tools-1.7.1` com um commit `E17 T7: volta productivity-tools 1.7.1 (conteúdo da tag 1.6.0)` sobre `M`; `volta.md` com o diff e a saída dos gates.

- [ ] **Passo 1: dedupe** (ver externalDedupe). Depois `git worktree add -b volta/productivity-tools-1.7.1 D:/projects/claude-play-wt/_tmp/E17/volta <M>`.
- [ ] **Passo 2: conteúdo da tag.** Na árvore: `git rm -r -q plugins/productivity-tools` e `git checkout productivity-tools--v1.6.0 -- plugins/productivity-tools` (arquivos novos depois da tag somem).
- [ ] **Passo 3: contagem das asserções da tag.** `git show productivity-tools--v1.6.0:plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs | grep -n "1.5.0"` → esperado linhas 150, 152, 418, 528 e o comentário 1101. Mudar todas as asserções listadas (não o comentário) para `'// check-roadmap 1.7.1 format 1'`, `'1.7.1'` e `'1.7.1 format 1'`; linha 1 do checker `// check-roadmap 1.7.1 format 1`; `plugin.json` `1.7.1`; linha da tabela do `README.md` `1.7.1`. `marketplace-tools` fica como em `M` (1.2.0).
- [ ] **Passo 4: gates na árvore da volta.** G1 a G5. Para cada falha de G1 num teste repo-only (`tools/**`, `.claude/**`) que importa ou lê código do plugin ausente ou diferente na tag (esperado: no mínimo `tools/measure/prose-goals.test.mjs`, que lê o teste de orçamento do tracker, inexistente na tag), voltar o arquivo e seu par ao estado da tag (`git checkout productivity-tools--v1.6.0 -- <arquivo>` ou `git rm` se não existia) e anotar a lista. Falha dentro de outro plugin não é contornada: anotar, critério 4 fica não atendido, item pendente para o dono. Rodar de novo até G1 a G5 exit 0 (ou só as falhas não contornáveis anotadas).
- [ ] **Passo 5: conferência.** `git add` dos arquivos da volta e, antes do commit, `git diff --cached productivity-tools--v1.6.0 -- plugins/productivity-tools` (compara o index com a tag; `git diff <tag> HEAD` antes do commit compararia a tag com `M` e não prova nada) → só `plugin.json` (versão), a linha 1 do checker e as quatro linhas de asserção do teste dele. Qualquer outra linha: parar e corrigir.
- [ ] **Passo 6: commit na volta** `git add` dos arquivos mudados (por caminho, sem `-A`); mensagem das Interfaces. `git worktree remove D:/projects/claude-play-wt/_tmp/E17/volta`; a branch fica; apagar `D:/projects/claude-play-wt/_tmp/E17`.
- [ ] **Passo 7: relatório em `feat/E17`.** `volta.md`: SHA de `M`, SHA do commit da volta, o diff do passo 5 (refeito com `git diff productivity-tools--v1.6.0 volta/productivity-tools-1.7.1 -- plugins/productivity-tools`), a lista de arquivos repo-only voltados à tag, a saída de cada gate (comando, exit, resumo). Commit `git add docs/reports/2026-11-12-e17-ponto-de-medicao/volta.md`; `E17 T7: relatório da branch de volta`.

### Tarefa 8: roteiro do dono e lista de ratificação (peças 1, 3 e 4)

tier: sonnet · reviewTier: sonnet · needsLock: nenhum · external: false · navegador: não

**Files:**
- Create: `docs/reports/2026-11-12-e17-ponto-de-medicao/roteiro.md`
- Create: `docs/reports/2026-11-12-e17-ponto-de-medicao/ratificacao.md`
- Test: `tools/measure/roteiro-e17.test.mjs`

**Interfaces:**
- Consumes: `M` e a árvore (Tarefa 6), `SANDBOX_RELEASE_RULES` (Tarefa 1), uso de `checkpoint.mjs` (Tarefa 4), branch de volta (Tarefa 7), ref local `release/roadmap-skills-v2` (só leitura por `git rev-parse` e `git archive`; não é efeito externo).
- Produces: o roteiro com três seções de passos do dono, sem caminho pessoal (pastas como `<config-dir>`, `<work>`, `<out>`, `<dest>`, `<árvore-da-semeadura>`):
  1. `## Execuções pagas (orquestrador ou dono, fora do workflow)`: os passos 1 a 5 da spec ("Tarefas de execução paga") com comandos completos, depois do merge de `feat/E17` na branch de release (DEC-297): `CLAUDE_CONFIG_DIR=<config-dir>`, pasta fora do repositório e de qualquer worktree; cópia do `CLAUDE.md` e do `settings.json` reais da configuração do dono para `<config-dir>` (paridade com E15, medida na configuração real), nunca arquivos de credencial; o dono entra na conta em `<config-dir>` uma vez (serve também ao roteiro B de E25); registrar a diferença entre o conjunto de plugins de `<config-dir>` e o da configuração real; loja `claude-play` como fonte git local fixada na SHA de `M` (ou na tag local leve `e17-medicao`, `git tag e17-medicao <M>`, nunca enviada), nunca em `feat/E17`; instalar `productivity-tools@claude-play` e superpowers 7.0.0 com a loja do superpowers fixada no commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` (o de `baseline.json` de E15), parando e registrando se a fixação não for aceita ou o `gitCommitSha` instalado diferir; conferir `installed_plugins.json` (versão 1.7.0, `gitCommitSha` = `M`) e a pasta `<config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0/`, parando e registrando achado (categoria ambiente) se `gitCommitSha` faltar; montar `<árvore-da-semeadura>` (comandos de cópia da Tarefa 1, conferindo os dois sha256); `run-baseline.mjs` com `--permission-mode bypassPermissions --tag <SHA de M>`, um `--allow "<regra>"` por item de `SANDBOX_RELEASE_RULES`, `--add-dir <pasta da versão no cache>`, primeiro `--dry-run`, depois sem, depois com `--from-run <árvore-da-semeadura>`; `baseline.mjs --out <out> --dest <dest> --tag <SHA de M>`; `checkpoint.mjs --before docs/reports/2026-11-11-e15-linha-de-base/baseline.json --after <dest>/baseline.json --dest docs/reports/2026-11-12-e17-ponto-de-medicao/`; commitar `comparacao.md`, `comparacao.json` e `<dest>/baseline.json` renomeado `medicao-1.7.0.json` num commit só de `docs/reports/` em `feat/E17`, seguido de novo merge na branch de release antes da publicação, nunca `tools/measure/out/`; ao fim, o dono sai da conta em `<config-dir>` e apaga a pasta. Inclui o portão (exit 1 = não publicar; bytes > 3% liberáveis com decisão, DEC-033; custo inconclusivo não bloqueia, DEC-017; `sem-agentes` no release segura a publicação) e os casos de borda da spec (superpowers diferente, modelos mudados, ponta da release com árvore diferente de `M`).
  2. `## Publicação (somente o dono)`: os passos 1 a 7 da peça 3 da spec, na ordem, com os comandos literais (`git rev-parse productivity-tools--v1.6.0^{commit}` contra o commit instalado; a tag anotada já está no remoto, então o passo 3 é só a conferência `git ls-remote --tags origin productivity-tools--v1.6.0`, com a linha `^{}` no mesmo commit, sem `git push` da tag; avanço de `main`, `git push origin main`, `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `claude plugin update marketplace-tools@claude-play`, `/reload-plugins`, conferência de `~/.claude/plugins/cache/claude-play/productivity-tools/1.7.0/` e `.../marketplace-tools/1.2.0/`), a pré-condição de árvore igual (`git rev-parse release/roadmap-skills-v2:plugins/productivity-tools` = árvore de `gates.md`) e o caso da tag já existente no remoto em outro commit (não forçar).
  3. `## Ratificação`: como responder a `ratificacao.md`; o tracker grava `ratify`/`reject` (com `--amend`, DEC-200) na branch de release; o critério 3 é conferido por `roadmap.mjs pending-decisions <pasta do roadmap> --json` sobre a ponta da branch de release no instante da publicação (o dono roda na worktree de integração com `docs/plans/roadmap-evolucao-skills`, ou repete a cópia do passo 3 abaixo), devolvendo lista vazia; se a ponta tem SHA diferente da gravada em `ratificacao.md`, a lista é gerada de novo pela mesma cópia antes da passada do dono, nunca pela pasta de `feat/E17`.
- `ratificacao.md` (peça 4 da spec): gerado da pasta do roadmap da ponta de `release/roadmap-skills-v2`, lida sem tocar na branch alvo nem na worktree de integração (a pasta de `feat/E17` vem da base de merge, não tem as linhas de E17 e nunca é a fonte). Grava a SHA completa da ponta lida (`git rev-parse release/roadmap-skills-v2`) e a saída de `pending-decisions --json` sobre a cópia; depois uma linha por decisão do executor pendente na ponta (por exemplo DEC-300 a DEC-309) e por decisão autônoma da spec (1 a 12) e deste plano (seção abaixo) que ainda não tenha linha no alvo, esta marcada "sem id no alvo"; cada linha com id (ou "sem id no alvo"), alcance, custo se errada, o que já foi construído em cima, resposta recomendada (ratificar). As decisões já ratificadas na ponta (DEC-285 a DEC-299, DEC-310) não entram como pendentes.

- [ ] **Passo 1: escrever o teste que falha** `tools/measure/roteiro-e17.test.mjs` (lê `roteiro.md` com CRLF normalizado):
  - `E17 roteiro: measures in bypassPermissions pinned to M, never to the branch name`: casa `--permission-mode bypassPermissions`; casa `--tag <SHA de M>` e a SHA completa de `M` (lida de `gates.md`); não casa `#feat/E17` nem `--tag feat/E17`.
  - `E17 roteiro: allows every sandbox rule`: cada item de `SANDBOX_RELEASE_RULES` aparece num `--allow "..."`.
  - `E17 roteiro: seeds from the archived E15 run`: casa `semeadura-completo-1` e os dois sha256.
  - `E17 roteiro: throwaway config dir matches the E15 configuration`: a seção de execuções pagas contém os passos de cópia do `CLAUDE.md` e do `settings.json` reais para `<config-dir>`, a proibição de copiar credencial (casa `credencia`), a pasta fora do repositório e das worktrees, o registro da diferença de plugins em relação à configuração real, e a saída da conta seguida da remoção da pasta; e não casa nenhum comando que copie `.credentials.json`.
  - `E17 roteiro: superpowers pinned to the E15 commit`: casa `bb92a77741419a4ab5f06e711a283343f1ada0c3` e a instrução de parar e registrar se a fixação falhar.
  - `E17 roteiro: tag is checked, not pushed`: casa `git ls-remote --tags origin productivity-tools--v1.6.0` e `productivity-tools--v1.6.0^{commit}`; não casa `git push origin productivity-tools--v1.6.0`.
  - `E17 roteiro: publication steps are owner-only and in order`: os comandos da seção de publicação aparecem na ordem da spec (tag antes de `main`, `main` antes do update, update antes da conferência do cache).
  - `E17 roteiro: no personal path`: não casa `/[A-Za-z]:[\\/]Users[\\/]|\/home\//` (nenhum caminho de usuário).
  - `E17 ratificacao: lists every autonomous decision with a recommended answer`: 12 linhas da spec e as do plano (por id do alvo ou "sem id no alvo"), cada uma com "ratificar".
  - `E17 ratificacao: generated from the release tip, never from feat/E17`: `ratificacao.md` contém uma SHA completa de 40 hex rotulada como ponta de `release/roadmap-skills-v2`, cita `git archive release/roadmap-skills-v2` com a estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md` e a pasta `docs/plans/roadmap-evolucao-skills`, e não cita `pending-decisions docs/plans/roadmap-evolucao-skills` rodado em `feat/E17`.
  - `E17 roteiro: criterion 3 is checked on the release tip`: a seção `## Ratificação` casa `pending-decisions` e `release/roadmap-skills-v2` e manda gerar a lista de novo quando a SHA da ponta difere da gravada.
- [ ] **Passo 2: ver falhar.** `node --test tools/measure/roteiro-e17.test.mjs` → FAIL (arquivos ausentes).
- [ ] **Passo 3: gerar a lista da ponta da branch de release** (somente leitura; o `git archive` lê o objeto da branch, sem checkout e sem tocar na worktree de integração):
  ```bash
  mkdir -p D:/projects/claude-play-wt/_tmp/E17/alvo
  git rev-parse release/roadmap-skills-v2
  git archive release/roadmap-skills-v2 docs/plans/2026-11-10-roadmap-evolucao-skills.md docs/plans/roadmap-evolucao-skills | tar -x -C D:/projects/claude-play-wt/_tmp/E17/alvo
  node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs pending-decisions D:/projects/claude-play-wt/_tmp/E17/alvo/docs/plans/roadmap-evolucao-skills --json
  ```
  Esperado: exit 0 e uma lista JSON (as decisões de E17 registradas na ponta, possivelmente vazia). Sem o arquivo de estratégia na cópia o tracker sai 2 (`usage`, ENOENT): é por isso que ele vai junto. Anotar a SHA e a saída; remover `D:/projects/claude-play-wt/_tmp/E17` ao fim.
- [ ] **Passo 3b: escrever** `roteiro.md` e `ratificacao.md` (este com a SHA e a saída do passo 3).
- [ ] **Passo 4: ver passar.** Mesmo comando → exit 0. G1 → exit 0, fail 0.
- [ ] **Passo 5: commit** `git add` dos três arquivos; `E17 T8: roteiro do dono e lista de ratificação`.

---

## Passos do dono (fora das tarefas; nunca marcados por agente)

- Execuções pagas e `checkpoint.mjs` (critérios 1 e 6, portão do critério 2): seção "Execuções pagas" do `roteiro.md`, depois do merge de `feat/E17` na branch de release. Resultados entram por um commit só de `docs/reports/` em `feat/E17`, do orquestrador ou do dono, e um novo merge na branch de release, antes da publicação (DEC-297).
- Ratificação (critério 3): seção "Ratificação" do `roteiro.md`, a partir de `ratificacao.md`.
- Publicação (critérios 2 e 5): seção "Publicação" do `roteiro.md`; nenhuma tarefa faz push, avanço de `main`, envio de tag ou atualização de loja/plugin.
- Aceite da branch de volta (critério 4): o dono confere `volta.md` e `gates.md`.
- Roteiros A e B de E25 antes da publicação (pendentes em `state.md`); o B pode usar a mesma `<config-dir>`.

## Decisões autônomas deste plano (revisáveis pelo dono)

1. As execuções pagas não são tarefas do plano, nem externas: ficam como passos do dono no roteiro, porque DEC-204 e DEC-011 as tiram do workflow e a instrução do dono as dá ao orquestrador ou ao dono. Alcance: local.
2. A branch de volta é uma tarefa externa do plano (Tarefa 7), porque cria uma branch local fora de `feat/E17`; a autorização é do dono em pessoa (DEC-299, emenda a DEC-294), não do workflow ao chegar nela; dedupe por existência da branch. Alcance: local.
3. O painel esperado no sandbox é `plan` para `plan-only` e `on-branch` com evidência do commit de merge para `completo` e `parada-retomada`, pelo vocabulário da pasta do sandbox e pela regra do workflow (alvo diferente da `integrationBranch` grava `deliverableStatuses[4]`). Alcance: contrato.
4. O pré-check de `--from-run` não muda: a árvore montada dos dois arquivos arquivados passa em `seedSourceOf` com os sha256 de origem (conferido no planejamento); um teste fixa isso. Alcance: local.
5. Braço e metas são lidos no commit `after.tagCommit` por `git show`, sem flag nova em `checkpoint.mjs`. Alcance: local.
6. Classe plano com braço defasado bloqueia (`exit 1`) até o dono liberar, como todo inconclusivo (DEC-081). Alcance: local.
7. A Tarefa 8 lê a pasta do roadmap e a estratégia da ponta de `release/roadmap-skills-v2` por `git archive` para uma pasta temporária, sem checkout da branch alvo; essa leitura não é efeito externo (lê um objeto local do repositório) e a tarefa continua `external: false`. Alcance: local.

## Acceptance criteria evidence

Todos os critérios têm `{verify: human}`: a evidência é ato do dono e nunca é marcada por agente. Nenhuma linha tem comando; nenhuma tem efeito externo.

| ac | kind | command | testRef | blq | external | externalDedupe |
|---|---|---|---|---|---|---|
| AC1 | human | - | o dono confere as linhas de comparação em measurements.md (produzidas por `checkpoint.mjs`, Tarefa 4, depois das execuções pagas do roteiro) | - | false | - |
| AC2 | human | - | o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache (seção "Publicação" do roteiro) | - | false | - |
| AC3 | human | - | o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente (`ratificacao.md`, Tarefa 8, gerado da ponta de `release/roadmap-skills-v2`) | - | false | - |
| AC4 | human | - | o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports (`volta.md`, Tarefa 7; `gates.md`, Tarefa 6) | - | false | - |
| AC5 | human | - | o dono roda git ls-remote --tags origin e compara com o commit registrado (seção "Publicação" do roteiro) | - | false | - |
| AC6 | human | - | o dono confere as linhas de meta em measurements.md (produzidas por `checkpoint.mjs` com `prose-goals.mjs`, Tarefas 3 e 4) | - | false | - |
