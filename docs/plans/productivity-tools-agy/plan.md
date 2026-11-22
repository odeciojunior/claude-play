# Plano productivity-tools-agy -- Refatoração dual-host do plugin productivity-tools para Claude Code e Antigravity (agy) com roteamento Gemini por complexidade

**Roadmap:** nenhum (spec fora de roadmap; `roadmap: null`, logo o `plan-coordinator` não chamará o `roadmap-tracker`).

**Spec:** `docs/plans/productivity-tools-agy/spec.md`. Nenhuma tarefa tem efeito externo (sem push, sem tag, sem bump de versão em `plugin.json` ou `README.md` conforme DEC-042, sem editar `plugins/_template/`).

**Base do plano:** commit `9e62fd4` em `release/pos-2.3.0`. A Tarefa 12 compara contra ele os arquivos que não podem mudar.

## Contexto lido

- `plugins/productivity-tools/lib/routing.mjs` (53 linhas, fonte pura DEC-058 sem imports): `route(task, ctx)` retorna `{ tier, effort, reviewTier, gate, score }`. É embutido em `skills/roadmap-release/workflow/roadmap-release.js:1190` e em `scripts/fixtures/plan-tool/workflow-copy.js:3`. **Não muda nesta entrega** (spec R1).
- `plugins/productivity-tools/lib/progress-state.mjs`: `psInline` (linha 60) e `PS_TIER_RANK = { haiku: 0, sonnet: 1, opus: 2 }` (linha 203); `launch --tier` desconhecido é recusado com `tier-down` (linha 300). Embutido só em `coordinator.js:32`. **Não muda** (spec R8).
- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`: despacha o implementer com `model: s.tier` (linha 1301); revisões sequenciais após a onda (linha 1452); `resumeArgs` na linha 1106; schemas na seção `// --- schemas` (linhas 1083–1090: `S_REVIEW`, `S_TASKREVIEW`, `S_CHECKS`, `S_IMPL`, `S_RUN`); nunca usa `inline-start` no laço.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (244.883 chars LF), por trechos:
  - `runReviewLoop` (linha 523); `withoutApprove` (linha 694); `pluginRootOf(trackerCli)` (linha 1099);
  - args e config (1294), `mkResult` (1310), `TEST_INTEGRITY_DEFAULT` (1353, `String.raw` sem `${`), utilities (1382), schemas (1409–1452), discovery (1453), selection (1561; dry-run retorna na linha 1606), shared briefing (1612), preflight (1666), gates (1727), roadmap record (1756);
  - `runDeliverable` (1842): retomada (1842–2136), Setup (2137), Spec (2166), Plan (2312; plan-only retorna perto da linha 2470), Tasks (2485), Sync + final review com test-integrity (2673), Gates on the branch (2724), Merge + post-merge gates + docs com `rollback` (2805/2862); Report (2948).
- `plugins/productivity-tools/scripts/embed.mjs`: `checkPureSource` recusa `import`, `require(`, `process`, `Buffer`, `crypto` fora de comentários.
- `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`: exporta `lintPlugin(dir)`; Check 7b (linha 464) exige basenames únicos para scripts em `scripts/`, `lib/` e `skills/*/(scripts|workflow)/`. Linha de base medida: `57 OK, 0 WARN, 0 FAIL`.
- `.claude/rules/workflows-and-lib.md`: lista as fontes puras de `lib/`; precisa citar `agy-routing.mjs` (não embutido) e `agy-bridge.py`.
- Runtime do `agy` (`C:/Users/odeci/.gemini/antigravity-cli/builtin/skills/run-workflow/SKILL.md`): `python3 >= 3.8`, `await` no topo, globais `args`, `agent`, `parallel`, `pipeline`, `phase`, `log`; `agent(prompt, schema, role, type_name="self", workspace="inherit", model)` com `schema` obrigatório; "Local modules are not importable"; o usuário não pode ser consultado de dentro do workflow.
- Ambiente local verificado: Python `3.12.10`, Node `v22.17.1`; `shutil.which("bash")` devolve `C:\Windows\System32\bash.EXE` (lançador do WSL, travou no teste); Git Bash existe em `C:\Program Files\Git\bin\bash.exe` e `-lc` preserva o diretório de trabalho.
- Guardas literais de teste: `plan-coordinator/workflow/flow.test.mjs:502-516` (nome do workflow, `description:` idêntica, sem `allowed-tools`/`disable-model-invocation`, toda linha com `scriptPath` minúsculo cita `unknown|not found` e `--add-dir`); `roadmap-release/workflow/flow.test.mjs:3787-3814` (Step 4 por nome, `scriptPath` só no parágrafo de fallback, "do not try the path", `compatibility` com `2.1.322`); `roadmap-release/workflow/docs.test.mjs:55-128`; `scripts/spec-tool.test.mjs:536-577`; `skills/plan-writer/adoption-text.test.mjs`; `scripts/independence.test.mjs`; `plan-coordinator/scripts/progress.test.mjs:1062`.

## Tamanho dos scripts e orçamento de prosa

Nenhum alvo de embed muda, então `roadmap-release.js` (244.883) e `coordinator.js` (76.187) ficam como estão. Antes e depois de editar prosa sujeita a teto, medir com as suítes:
- `roadmap-planner` `<= 43.335` bytes LF (149 B de folga); `plan-coordinator/SKILL.md` `<= 6.000` bytes LF (2.321 B de folga); `roadmap-tracker` `<= 29.096` bytes LF por evento (2.913 B de folga; o `SKILL.md` entra em todo evento).

Se qualquer medição ultrapassar o teto, a tarefa **para com `BLOCKED`**, relata o valor exato obtido e pede decisão — nunca edita as constantes nem relaxa os testes de tamanho ou orçamento.

## Convenções comuns às tarefas Python (2 a 7)

- Todo `*.test.mjs` que executa Python começa por `findPython()`: tenta `python3`, `python` e `py -3` com `-c "import sys; print(sys.version_info[:2])"`, aceita só saída `>= (3, 8)` e descarta o atalho `WindowsApps` (que não imprime versão). Sem Python, cada `test()` recebe `{ skip: 'python >= 3.8 not found' }` (spec C5).
- O harness executa o script com `compile(src, path, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)` dentro de `asyncio.run(...)`, injetando `args` e mocks de `agent`, `parallel`, `pipeline`, `phase` e `log`. O mock de `agent` registra `(role, model, schema)` de cada chamada e responde por roteiro.
- Os workflows protegem o entrypoint (`if "agent" in globals() and "args" in globals(): ...`) e expõem funções puras testáveis.
- Sandboxes: `git init` real em pasta temporária, `progress.mjs init`/roadmap temporário reais; nada toca o repositório de trabalho.
- Toda chamada de revisor compara `git_snapshot` antes e depois (spec 7.6).

## Tarefas

### Tarefa 1: lib/agy-routing.mjs puro, testes dos 18 vetores e regra de lib

Arquivos: criar `plugins/productivity-tools/lib/agy-routing.mjs`; modificar `.claude/rules/workflows-and-lib.md`; testes em `plugins/productivity-tools/scripts/plan-tool.test.mjs` (3 arquivos).

Teste primeiro em `plan-tool.test.mjs`:
- `checkPureSource` de `agy-routing.mjs` devolve `null`.
- `AGY_MODEL_RANK`, `agyModelFor`, `agyReviewModelFor`, `nextAgyTier` (com `false` preserva; com `true`: `flash_lite`/`haiku` → `flash`, `flash`/`sonnet` → `pro`, `pro`/`opus` → `null`, spec C4) e `toAgyRoute`.
- Os 18 vetores de `routing-table.json`: `route(...)` continua com exatamente as 5 chaves (`Object.keys` ordenadas), e `toAgyRoute(route(...))` bate com a coluna Gemini da tabela 7.2 do spec, incluindo C1 (vetor 5: `flash / pro / flash / pro / false`) e C2 (vetor 17: `flash_lite / flash_lite / flash / pro / true`).
- Confirmar a falha inicial (módulo ausente).

Implementação: `agy-routing.mjs` exatamente como no spec 7.5 (prefixo interno `ag`). Em `.claude/rules/workflows-and-lib.md`, acrescentar `agy-routing.mjs` à lista de fontes puras com a nota "not embedded; consumed by the agy bridge" e uma linha sobre `scripts/agy-bridge.py` (carregado por `exec`, basename único).

### Tarefa 2: scripts/agy-bridge.py e agy-bridge.test.mjs

Arquivos: criar `plugins/productivity-tools/scripts/agy-bridge.py`; testes em `plugins/productivity-tools/scripts/agy-bridge.test.mjs` (2 arquivos). Depende da Tarefa 1.

Contrato (stdlib Python `>= 3.8`, sem estado global além de constantes; spec 7.6):
- `plugin_root_from(path, suffix)`: mesma regra de `pluginRootOf` (normaliza `\` para `/`, exige o sufixo).
- `run_cli(argv, cwd=None, input=None, timeout=None)` → `{ exit, stdout, stderr }` com `shell=False`.
- `find_git_bash(env=os.environ, candidates=None)`: ordem do spec 7.6; rejeita qualquer caminho sob `%SystemRoot%` (comparação sem caixa, normalizada); fora do Windows, `/bin/bash`. `run_shell(cmd, cwd)` usa `[bash, "-lc", cmd]` e lança `RuntimeError("git-bash-not-found")` sem bash válido.
- `call_lib(root, expr, payload)`: `node --input-type=module -e` importando por `pathToFileURL` `routing.mjs`, `agy-routing.mjs`, `plan-digest.mjs`, `external-auth.mjs`, `progress-state.mjs` e `roadmap-format.mjs`; JSON entra por `stdin` e sai por `stdout`; erro do Node vira exceção com o `stderr`.
- `load_agent_body(root, name)`: corpo de `agents/<name>.md` sem frontmatter.
- `load_js_schemas(js_path)`: recorta do comentário de seção `schemas` até o próximo `// ---`, avalia via Node (`new Function(slice + '; return {...}')` com todas as constantes `S_*` do trecho) e devolve dict.
- `load_test_integrity(js_path, cfg)`: extrai o `String.raw` de `TEST_INTEGRITY_DEFAULT`, falha se o trecho contiver `${`; aplica `cfg.testIntegrity` (`False` → `None`; string não vazia → ela).
- `run_test_integrity(program, wt_dir, base)` → dict de `{ deletedTests, removedAsserts, skipsAdded, prodChanged, assertsAdded }`; falha do programa → `removedAsserts = -1` e zeros, como o JS.
- `git_snapshot(root)` → `(head, porcelain)`.

Teste primeiro em `agy-bridge.test.mjs` (convenções comuns):
- Carregar o arquivo por `exec(compile(...))` num dict de globais novo (prova que não depende de `import`).
- `find_git_bash` com candidatos simulados: `C:\Windows\System32\bash.exe` primeiro na lista → nunca devolvido; Git Bash presente → devolvido; nenhum válido → `run_shell` lança `git-bash-not-found` (C5). No Windows real, o caminho devolvido não está sob `%SystemRoot%`.
- `call_lib`: `fnv1a("Adoção/portão — café")` e `canon` iguais aos de `lib/plan-digest.mjs` importado direto no Node; `toAgyRoute(route(...))` do vetor 5 igual ao da Tarefa 1.
- `load_js_schemas`: de `coordinator.js` contém `S_REVIEW`, `S_TASKREVIEW`, `S_CHECKS`, `S_IMPL`; de `roadmap-release.js` contém `S_IMPL`, `S_TASKREVIEW`, `S_PLANREVIEW`, `S_SPEC`, `S_MERGE`, `S_INTEG`, `S_ROLLBACK`; cada um é JSON válido com `type`.
- `load_test_integrity`: texto idêntico ao recortado por regex no próprio teste Node, termina na linha `console.log(JSON.stringify({ deletedTests, ...}))`, sem `${`; `testIntegrity: false` → `None`.
- `run_test_integrity` em repo temporário com um commit que remove um `assert` → `removedAsserts >= 1`.
- `git_snapshot` muda quando um arquivo é tocado.

### Tarefa 3: coordinator-agy.py e coordinator-agy.test.mjs

Arquivos: criar `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py`; testes em `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs` (2 arquivos). Depende da Tarefa 2.

Contrato (referência de comportamento: `coordinator.js`):
- `args`: `{ plan, state, runToken, progress, test?, authorizeExternal?, answers? }`, validados como `validateArgs` de `coordinator.js`. Raiz do plugin por `plugin_root_from(args.progress, "/skills/plan-coordinator/scripts/progress.mjs")`; sem raiz → `status: "error"` antes de qualquer `agent()`. Carrega `agy-bridge.py` por `exec`.
- Estado: `progress.mjs read <state> --nonce <n> [--page <k>] --json` (remontando páginas e conferindo `stateDigest`) e `progress.mjs apply <state> --events <carga> --nonce <n> --json` (carga montada e assinada via `call_lib` com `canon`/`fnv1a`; chunking `<= 6.000` como `CMD_CAP`; releitura em falha transitória; `concurrent-change` / `state-divergence` tratados como em `coordinator.js`). **Nunca** envia `--tier` em vocabulário Gemini (spec R8).
- Laço por `nextAction` (via `call_lib`): passos `inline` e `delegated` despachados igual; implementer com `model = agyModelFor(s.tier, s.effort)`; `task-reviewer` (`review` e `prelaunch-review`) e `final-reviewer` com `model = "pro"`; schemas de `load_js_schemas(coordinator.js)`; prompt começa por `load_agent_body`.
- Git: `status --porcelain`, `add --`, `commit -m`, `log -1`, `rev-parse` via `run_cli`, com `sweep_committed` e commits por passo após a onda.
- Testes do plano (`baseline`, `wave-gate`): `run_shell(args.test, root)`; `git-bash-not-found` vira parada `ask` com a pergunta explícita.
- `resumeArgs` = `args` sem `runToken`, `authorizeExternal` e `answers`.

Teste primeiro em `coordinator-agy.test.mjs` (convenções comuns):
- Plano de 4 tarefas cobrindo `haiku/low` → `flash_lite`, `sonnet/medium` → `flash`, C1 (vetor 5, `sonnet/high`, `gate: false`) → `pro` sem `task-reviewer`, C2 (vetor 17) → executor `flash_lite` + `task-reviewer` `pro`; `final-reviewer` em `pro`; commits por passo em git real; zero chamadas com papel `script-runner`.
- C3: depois da execução, todo `s.tier` em `progress.json` é `haiku`, `sonnet` ou `opus`; `progress.mjs apply` com `launch --tier flash` é recusado com `tier-down`.
- Guarda read-only: um mock de revisor que altera arquivo ou `HEAD` → `status: "error"`.
- Base vermelha → `status: "stopped"`, `stop.kind: "ask"` antes de qualquer implementer; retomada com `answers: [{ event: "unblock" }]`.
- Passo externo → `prelaunch-review` em `pro` e parada `authorize` vinculada a `plan:T<n>@<digest>`.
- `resumeArgs` sem `runToken`/`authorizeExternal`/`answers`; `args.progress` fora do padrão → `status: "error"` sem `agent()`.

### Tarefa 4: roadmap-release-agy.py, base e modo dry-run

Arquivos: criar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py`; testes em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs` (2 arquivos). Depende da Tarefa 2.

Escopo (referência: `roadmap-release.js` linhas 1294–1612 e `mkResult` na 1310):
- Raiz do plugin por `plugin_root_from(args.trackerCli, "/skills/roadmap-tracker/scripts/roadmap.mjs")`; carrega `agy-bridge.py`; schemas por `load_js_schemas(roadmap-release.js)`.
- Validação de `args` idêntica ao JS (`config.gates` não vazio, `runToken`, `trackerCli`, `wtRoot`, `mode` em `run|plan-only|dry-run`, `notes` sem `<...>`, `parseAuthorizeExternal` via `call_lib`, `TARGET !== INTEG || allowIntegrationBranch`). `minBudgetPerDeliverable` é ignorado (o `agy` não expõe orçamento) e isso aparece em `operatorActions` como nota.
- `STAGE_MODELS` do spec 7.4: `pro` para autores e revisores, `flash` para os estágios `sonnet/medium`; estágios mecânicos não têm entrada (são subprocesso).
- Discovery: `preflight.mjs discover` via `run_cli` com montagem de páginas e conferência de assinatura/nonce; `discovery-donot` em `flash` quando há bloco `donot`; seleção (`deliverables`, filtros, `autoDeps`, `overrideDonot`, `maxDeliverables`).
- Saída no contrato `{ status, mode, operatorActions, resumeArgs, selection, results, ownerReview, truth, lastGood, reportPath, report }`; `resumeArgs` sem `runToken` e `approveRulings`. Modo dry-run termina aqui; os outros modos retornam `status: "error"` com `"mode not implemented yet"` até as Tarefas 5 e 6.

Teste primeiro (convenções comuns): erros de `args` (`config` ausente, `runToken` vazio, `trackerCli` ausente ou fora do padrão, `wtRoot` ausente, `notes` com `<...>`) antes de qualquer `agent()`; dry-run real sobre roadmap temporário com `git init` — `preflight discover` por subprocesso, zero `script-runner`, `discovery-donot` em `flash`, `selection` igual à que o JS calcularia para o mesmo roadmap (fixture com 3 cartões); cobertura de `STAGE_MODELS` contra a tabela do spec; `resumeArgs` sem `runToken`/`approveRulings`.

### Tarefa 5: roadmap-release-agy.py, modo plan-only e laço de revisão

Arquivos: modificar `roadmap-release-agy.py` e `roadmap-release-agy.test.mjs` (2 arquivos). Depende da Tarefa 4.

Escopo (referência: `runReviewLoop` linha 523; preflight 1666–1726 nos passos de plan-only; roadmap record 1756–1841; `runDeliverable` Setup 2137, Spec 2166 e Plan 2312 até o retorno de plan-only):
- Preflight de plan-only (passos 1, 2 e 5 do JS), worktree de integração e setup de worktree por entregável via `git -C` (`worktree add`, `branch`), sem baseline.
- Spec: `spec-author` (`pro`) → `spec-tool.mjs check|emit` por subprocesso → `spec-review`/`spec-fix` (`pro`) pelo laço de revisão → commit mecânico do `spec.md` por `git`.
- Plan: `plan-author` (`pro`) → `plan-tool.mjs check|emit` → `plan-review` (`pro`) / `plan-fix` (`flash`, depois escada) → commit mecânico do `plan.md`.
- `run_review_loop`: mesma semântica de `runReviewLoop` (rodadas, `maxFixRounds`, achado repetido, `once`), com corretor promovido por `nextAgyTier` via `call_lib`, 1 rodada bônus na primeira escalada, todas as revisões em `pro` e encerramento controlado (`ok: False` + achado) quando `nextAgyTier('pro', True)` é `None` (C4).
- Registros no roadmap por `roadmap.mjs` (subprocesso), serializados como no JS.

Teste primeiro: plan-only sobre roadmap temporário com 1 cartão — sequência de papéis e modelos (`spec-author` `pro`, `spec-review` `pro`, `plan-author` `pro`, `plan-review` `pro`), `spec.md` e `plan.md` commitados por `git` (não por agente), `spec-tool`/`plan-tool` por subprocesso; laço: achado repetido escala `flash_lite → flash → pro` com 1 rodada bônus, e C4 termina com `ok: False` sem laço infinito; guarda read-only em todo revisor.

### Tarefa 6: roadmap-release-agy.py, modo run (tarefas, revisão final, gates)

Arquivos: modificar `roadmap-release-agy.py` e `roadmap-release-agy.test.mjs` (2 arquivos). Depende da Tarefa 5.

Escopo (referência: preflight completo 1666–1726 com setup e baseline; gates 1727–1755; Tasks 2485; Sync + final review 2673 com test-integrity 2690; Gates on the branch 2724):
- Preflight completo: comandos de setup e baseline dos gates na worktree de integração por `run_shell`; `acceptRedBaseline`.
- Tarefas: implementer em `agyModelFor(route.tier, route.effort)`, `task-reviewer` em `pro` (DEC-019/E35), fix pela escada `nextAgyTier`; tarefas externas respeitam `authorizeExternal` via `externalHold`/`bindAuthorizations` (`call_lib`).
- Sync com o alvo e revisão final (`final-reviewer` `pro`; `final-fix` `flash` + escada); test-integrity por `load_test_integrity` + `run_test_integrity` numa worktree destacada temporária, sempre removida.
- Gates na branch medidos por `run_shell` e julgados pelo script (números), `gates-fix` (`flash`) e `gates-fix-review` (`pro`).

Teste primeiro: modo run sobre roadmap temporário com 1 cartão e plano de 2 tarefas (respostas roteirizadas do implementer criam commits reais) — modelos por tarefa, `task-reviewer` sempre `pro`, test-integrity por subprocesso detectando `removedAsserts` num fixture, gate vermelho → `gates-fix` `flash` e re-revisão `pro`, worktree temporária de integridade removida mesmo com falha do programa.

### Tarefa 7: roadmap-release-agy.py, merge, rollback, docs, relatório e retomada

Arquivos: modificar `roadmap-release-agy.py` e `roadmap-release-agy.test.mjs` (2 arquivos). Depende da Tarefa 6.

Escopo (referência: Merge + post-merge gates + docs 2805 com `rollback` 2862; Report 2948; retomada em `runDeliverable` 1842–2136):
- Merge serializado na worktree de integração (`git merge` por `run_cli`), `merge-fix` (`flash`) / `merge-fix-review` (`pro`) e `conflict-review`/`delta-review` (`pro`) quando há conflito ou delta; gates pós-merge; `rollback` por `git` (reset ao `lastGood`, limpeza de worktrees) com `S_ROLLBACK` produzido pelo script.
- `docs` e `review-log` (`flash`), commits mecânicos; relatório (`report`, `flash`) e `reportPath`.
- Retomada sem replay: reconstrói o progresso de cada entregável a partir do roadmap, das branches e das worktrees, como o JS faz sem `resumeFromRunId`; `notes`, `acceptIntegrityAlerts` (só o SHA exato), `resume-fix-review` (`pro`).

Teste primeiro: merge limpo → `status: "done"` com relatório; gate pós-merge vermelho → `rollback` restaura o alvo ao `lastGood` e o resultado lista a ação do operador; conflito → `conflict-review` `pro`; retomada de uma execução interrompida depois do Plan continua em Tasks sem refazer spec/plan; `acceptIntegrityAlerts` com SHA diferente é ignorado.

### Tarefa 8: Portabilidade dual-host nos SKILL.md de plan-coordinator e roadmap-release e em routing.md

Arquivos: modificar `plugins/productivity-tools/skills/plan-coordinator/SKILL.md`, `plugins/productivity-tools/skills/plan-coordinator/references/routing.md` e `plugins/productivity-tools/skills/roadmap-release/SKILL.md` (3 arquivos). Depende das Tarefas 3 e 7. `testFirst` isento: prosa validada pelas suítes de contrato e orçamento.

Regra geral (spec 7.7): toda frase nova começa por uma condição de host, por exemplo "Only when the `Workflow` tool is absent and `run_workflow` exists (Antigravity): ...".
- `plan-coordinator/SKILL.md`: preservar `description:`, ausência de `allowed-tools`/`disable-model-invocation`, `references/state.md`, ausência de `"Step lifecycle"`, nenhuma citação a `references/*.md` antes de `## After the workflow returns` e `Never pass authorizeExternal or answers on the first launch`. Acrescentar o fallback de `${CLAUDE_SKILL_DIR}` e, condicionado ao host, `run_workflow` com o parâmetro `ScriptPath` apontando para `<skill dir>/workflow/coordinator-agy.py` (mesmos `Args`) e `ask_question` no lugar de `AskUserQuestion`. Total abaixo de `6.000` bytes LF.
- `plan-coordinator/references/routing.md`: nova seção `## 6. Antigravity (agy) Gemini routing` com a tradução, a promoção de `(sonnet, high)`, `agyReviewModel: pro` em todo gate e executor `pro`, `nextAgyTier`, e o princípio de estado canônico (tiers Claude no estado, tradução no despacho, `lib/agy-routing.mjs`).
- `roadmap-release/SKILL.md`: preservar frontmatter, linha 11 e todas as strings de `docs.test.mjs:55-128`. Step 2: nota condicionada ao host para criar `<wtRoot>` se ausente e passar `--declare-permissions "agy"`. Step 4: frase condicionada ao host, depois do parágrafo de fallback do Claude Code e sem contradizer "do not try the path" (que continua valendo para a ferramenta `Workflow`), chamando `run_workflow` com `ScriptPath` para `<dir>/workflow/roadmap-release-agy.py`; sem a expressão proibida `Call the Workflow tool with scriptPath`.

### Tarefa 9: Portabilidade dual-host em spec-writer, plan-writer, excalidraw-designer e wsl-health-check

Arquivos: modificar `plugins/productivity-tools/skills/spec-writer/SKILL.md`, `plugins/productivity-tools/skills/plan-writer/SKILL.md`, `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md` e `plugins/productivity-tools/skills/wsl-health-check/SKILL.md` (4 arquivos). `deps: []`. `testFirst` isento.

- `excalidraw-designer/SKILL.md` (linha 22) e `wsl-health-check/SKILL.md` (linha 12): fallback curto para `${CLAUDE_SKILL_DIR}` vazio ou não expandido.
- `spec-writer/SKILL.md`: frontmatter de 3 chaves intacto; **zero** ocorrências de `commit` fora de `does not commit` / `never commits` (`spec-tool.test.mjs:560-561`). Linhas 14 e 22: fallback `ask_question` condicionado à ausência de `AskUserQuestion`. Linha 15: despacho `Agent` intacto e, condicionado ao host, `invoke_subagent` com `TypeName: "self"`, `Role: "spec-author"`, `Model: "pro"` e `Prompt` mandando ler `<skill_dir>/../../agents/spec-author.md` do disco antes dos campos `key: value` (sem colar o corpo).
- `plan-writer/SKILL.md`: frontmatter de 3 chaves e todas as expressões de `independence.test.mjs:94-280` e `adoption-text.test.mjs` (`node "<planTool>" check "<output>"`, `AskUserQuestion`, `APPROVAL QUESTION:`, `productivity-tools:spec-author`, `productivity-tools:plan-author`). Fallback condicionado ao host nas linhas 28 (`spec-author`), 30 (`ask_question`) e 38 (`plan-author`).

### Tarefa 10: Portabilidade dual-host em roadmap-planner e roadmap-tracker dentro dos orçamentos de prosa

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`, `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md` e `plugins/productivity-tools/skills/roadmap-tracker/references/events/07-new-source.md` (3 arquivos). `deps: []`. `testFirst` isento.

- `roadmap-planner/SKILL.md`, só as duas anotações (`+27` B dos 149 B de folga): linha 93 `` `model: sonnet`, `effort: medium` (agy: `flash`) ``; linha 139 `` `model: opus`, `effort: medium` (agy: `pro`) ``. Não editar `references/model.md` nem `references/review-rubric.md`.
- `roadmap-tracker/SKILL.md` (`## Paths`, linha 14): uma frase de fallback para `${CLAUDE_SKILL_DIR}` vazio (entra no orçamento de todo evento).
- `07-new-source.md` (linha 5): `(agy: \`flash\`)` após `` `effort: medium` ``.

### Tarefa 11: Descoberta no agy (.agents/skills.json) e asserções de lint em independence.test.mjs

Arquivos: criar `.agents/skills.json`; testes em `plugins/productivity-tools/scripts/independence.test.mjs` (2 arquivos). Depende das Tarefas 8, 9 e 10 (e, por elas, de todas as anteriores), para que `lintPlugin` valide o estado final do plugin.

Teste primeiro em `independence.test.mjs`:
- `.agents/skills.json` existe na raiz, é JSON válido e tem `entries` com `{"path": "plugins/productivity-tools/skills"}`; as 11 pastas de `skills/` têm `SKILL.md`; `plugins/productivity-tools/.antigravity-plugin/plugin.json` **não** existe.
- `lintPlugin(PLUGIN)` com `0` `FAIL`, `0` `WARN` e `Script names are unique` em `OK` (cobre os três `.py` e `agy-routing.mjs`).
- Confirmar a falha antes de criar o arquivo.

### Tarefa 12: Gates completos do repositório e evidência dos critérios

Sem arquivos e sem commit (`noCommit: true`, depende de todas):
- G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.
- Arquivos que não podem mudar (AC2): `git diff --exit-code 9e62fd4 -- plugins/productivity-tools/lib/routing.mjs plugins/productivity-tools/lib/progress-state.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`. Se a base tiver mudado por motivo alheio a esta entrega, relatar o diff em vez de concluir.
- `embed.mjs --check` nos 4 alvos, `lint-plugin.mjs plugins/productivity-tools` (`0 WARN, 0 FAIL`), `claude plugin validate .` e `claude plugin validate plugins/productivity-tools` (sem a CLI, registrar a saída literal).
- Os 7 comandos de evidência da tabela abaixo.

## Evidência dos critérios

| Critério | Tipo | Comando | Cobertura |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/scripts/plan-tool.test.mjs` | 18 vetores em `route` e `toAgyRoute(route(...))`, pureza de `agy-routing.mjs` (`C1`, `C2`, `C4`) |
| AC2 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` | estado e workflows JS inalterados (somado ao `git diff --exit-code` e ao `embed --check` da Tarefa 12) |
| AC3 | test | `node --test plugins/productivity-tools/scripts/independence.test.mjs` | `.agents/skills.json` e `lintPlugin` com `0 FAIL` e `0 WARN` |
| AC4 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs` | `coordinator-agy.py`, modelos Gemini, estado só com tiers Claude, guarda read-only (`C1`, `C2`, `C3`) |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs` | dry-run, plan-only, run, merge, rollback e retomada (`C4`) |
| AC6 | test | `node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs` | portabilidade nos `SKILL.md` sem estouro de prosa nem termo proibido |
| AC7 | test | `node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs` | Git Bash sem System32, paridade `fnv1a`, schemas e test-integrity de fonte única, skip sem Python (`C5`) |

## Decisões do plano

- **R9 (12 tarefas em 9 ondas):** Onda 1: T1, T9, T10 (arquivos disjuntos). Onda 2: T2. Onda 3: T3 e T4 (arquivos disjuntos). Ondas 4 a 6: T5, T6, T7 (mesmo par de arquivos, em série). Onda 7: T8. Onda 8: T11. Onda 9: T12.
- **R10 (`roadmap-release-agy.py` dividido por modo):** dry-run (T4), plan-only (T5), run (T6) e merge/rollback/retomada (T7), seguindo os trechos de `roadmap-release.js`, cada um com testes sobre git real e modo ainda não implementado devolvendo erro explícito.
- **R11 (Python testado com `ast.PyCF_ALLOW_TOP_LEVEL_AWAIT` e skip sem Python):** `py_compile` rejeita `await` no topo; o harness compila com a flag e roda com `asyncio.run`, e pula com motivo quando não há Python `>= 3.8`.
- **R12 (T11 por último antes dos gates):** `lintPlugin` dentro de `independence.test.mjs` precisa ver todos os `.py`, `agy-routing.mjs` e os `SKILL.md` finais.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "productivity-tools-agy",
  "title": "Refatoração dual-host do plugin productivity-tools para Claude Code e Antigravity (agy) com roteamento Gemini por complexidade",
  "spec": "spec.md",
  "roadmap": null,
  "constraints": [
    "Não alterar lib/routing.mjs, lib/progress-state.mjs, skills/plan-coordinator/scripts/progress.mjs nem os 4 alvos de embed.mjs; route(task, ctx) e todo planDigest FNV-1a ficam idênticos.",
    "Nunca gravar tiers Gemini em plan.md ou progress.json; traduzir no despacho com agyModelFor(s.tier, s.effort).",
    "Sem bump de versão em plugins/productivity-tools/.claude-plugin/plugin.json ou README.md raiz (DEC-042); nunca editar plugins/_template/.",
    "Não alterar o frontmatter de agents/*.md com chaves exclusivas do agy nem mencionar o termo proibido por independence.test.mjs em arquivos não-teste.",
    "Não alterar preflight.mjs e preservar todas as strings literais verificadas por docs.test.mjs, flow.test.mjs, spec-tool.test.mjs, adoption-text.test.mjs e progress.test.mjs; toda instrução agy nos SKILL.md começa por uma condição de host.",
    "Respeitar os tetos LF sem editar testes de tamanho ou orçamento: roadmap-planner <= 43335 B, plan-coordinator <= 6000 B, roadmap-tracker <= 29096 B por evento.",
    "Scripts Python com basename único, subprocessos shell=False, Git Bash resolvido explicitamente (nunca System32 nem cmd.exe), hashes e roteamento pela ponte node --input-type=module, schemas e test-integrity extraídos dos workflows JS.",
    "Nunca executar git push, tag ou alterar configurações do usuário."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "lib/agy-routing.mjs puro, testes dos 18 vetores e regra de lib",
      "deps": [],
      "files": {
        "create": ["plugins/productivity-tools/lib/agy-routing.mjs"],
        "modify": [".claude/rules/workflows-and-lib.md"],
        "test": ["plugins/productivity-tools/scripts/plan-tool.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["AGY_MODEL_RANK, agyModelFor(tier, effort), agyReviewModelFor(reviewTier, gate, agyModel), nextAgyTier(model, sameFindingAgain) e toAgyRoute(r) em plugins/productivity-tools/lib/agy-routing.mjs"],
      "consumes": [],
      "covers": ["AC1", "C1", "C2", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/plan-tool.test.mjs", "expect": "exit 0 (18 vetores em route e toAgyRoute + pureza)" },
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0 (nenhum alvo muda)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "scripts/agy-bridge.py e agy-bridge.test.mjs",
      "deps": [1],
      "files": {
        "create": ["plugins/productivity-tools/scripts/agy-bridge.py"],
        "modify": [],
        "test": ["plugins/productivity-tools/scripts/agy-bridge.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 2 },
      "produces": ["helper Python plugins/productivity-tools/scripts/agy-bridge.py (plugin_root_from, run_cli, find_git_bash, run_shell, call_lib, load_agent_body, load_js_schemas, load_test_integrity, run_test_integrity, git_snapshot) carregado por exec"],
      "consumes": [
        { "task": 1, "sig": "AGY_MODEL_RANK, agyModelFor(tier, effort), agyReviewModelFor(reviewTier, gate, agyModel), nextAgyTier(model, sameFindingAgain) e toAgyRoute(r) em plugins/productivity-tools/lib/agy-routing.mjs" }
      ],
      "covers": ["AC7", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "coordinator-agy.py e coordinator-agy.test.mjs",
      "deps": [2],
      "files": {
        "create": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py"],
        "modify": [],
        "test": ["plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 1 },
      "produces": ["workflow Python plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py com estado canônico em tiers Claude e despacho Gemini por agyModelFor"],
      "consumes": [
        { "task": 2, "sig": "helper Python plugins/productivity-tools/scripts/agy-bridge.py (plugin_root_from, run_cli, find_git_bash, run_shell, call_lib, load_agent_body, load_js_schemas, load_test_integrity, run_test_integrity, git_snapshot) carregado por exec" }
      ],
      "covers": ["AC2", "AC4", "C1", "C2", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0 (estado inalterado)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "roadmap-release-agy.py, base e modo dry-run",
      "deps": [2],
      "files": {
        "create": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py"],
        "modify": [],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["roadmap-release-agy.py com validação de args, STAGE_MODELS, discovery e seleção por subprocesso e modo dry-run no contrato de saída do JS"],
      "consumes": [
        { "task": 2, "sig": "helper Python plugins/productivity-tools/scripts/agy-bridge.py (plugin_root_from, run_cli, find_git_bash, run_shell, call_lib, load_agent_body, load_js_schemas, load_test_integrity, run_test_integrity, git_snapshot) carregado por exec" }
      ],
      "covers": ["AC5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "roadmap-release-agy.py, modo plan-only e laço de revisão",
      "deps": [4],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["modo plan-only (spec e plan com spec-tool/plan-tool por subprocesso e commits mecânicos) e run_review_loop com escada nextAgyTier em roadmap-release-agy.py"],
      "consumes": [
        { "task": 4, "sig": "roadmap-release-agy.py com validação de args, STAGE_MODELS, discovery e seleção por subprocesso e modo dry-run no contrato de saída do JS" }
      ],
      "covers": ["AC5", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "roadmap-release-agy.py, modo run (tarefas, revisão final, gates)",
      "deps": [5],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 1 },
      "produces": ["modo run (preflight com baseline, tarefas com implementer agyModelFor e task-reviewer pro, revisão final, test-integrity por subprocesso, gates na branch) em roadmap-release-agy.py"],
      "consumes": [
        { "task": 5, "sig": "modo plan-only (spec e plan com spec-tool/plan-tool por subprocesso e commits mecânicos) e run_review_loop com escada nextAgyTier em roadmap-release-agy.py" }
      ],
      "covers": ["AC5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "roadmap-release-agy.py, merge, rollback, docs, relatório e retomada",
      "deps": [6],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 2, "reasoning": 2, "blast": 2, "verifiability": 1 },
      "produces": ["merge serializado, rollback ao lastGood, docs, relatório e retomada sem replay em roadmap-release-agy.py"],
      "consumes": [
        { "task": 6, "sig": "modo run (preflight com baseline, tarefas com implementer agyModelFor e task-reviewer pro, revisão final, test-integrity por subprocesso, gates na branch) em roadmap-release-agy.py" }
      ],
      "covers": ["AC5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Portabilidade dual-host nos SKILL.md de plan-coordinator e roadmap-release e em routing.md",
      "deps": [3, 7],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/SKILL.md",
          "plugins/productivity-tools/skills/plan-coordinator/references/routing.md",
          "plugins/productivity-tools/skills/roadmap-release/SKILL.md"
        ],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["instruções dual-host condicionadas ao host (run_workflow com ScriptPath, ask_question, preflight --declare-permissions \"agy\") e tabela Gemini em routing.md"],
      "consumes": [
        { "task": 3, "sig": "workflow Python plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py com estado canônico em tiers Claude e despacho Gemini por agyModelFor" },
        { "task": 7, "sig": "merge serializado, rollback ao lastGood, docs, relatório e retomada sem replay em roadmap-release-agy.py" }
      ],
      "covers": ["AC4", "AC5", "AC6"],
      "testFirst": { "exempt": "edição de prosa e documentação verificada pelas suítes prose-budget, flow, docs, prompts, review e progress" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "Portabilidade dual-host em spec-writer, plan-writer, excalidraw-designer e wsl-health-check",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/spec-writer/SKILL.md",
          "plugins/productivity-tools/skills/plan-writer/SKILL.md",
          "plugins/productivity-tools/skills/excalidraw-designer/SKILL.md",
          "plugins/productivity-tools/skills/wsl-health-check/SKILL.md"
        ],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["fallback de ${CLAUDE_SKILL_DIR} em excalidraw-designer e wsl-health-check; despacho agy condicionado ao host via invoke_subagent/ask_question em spec-writer e plan-writer"],
      "consumes": [],
      "covers": ["AC6"],
      "testFirst": { "exempt": "edição cirúrgica de prosa verificada por spec-tool.test.mjs, adoption-text.test.mjs e independence.test.mjs" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs plugins/productivity-tools/scripts/independence.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 10,
      "title": "Portabilidade dual-host em roadmap-planner e roadmap-tracker dentro dos orçamentos de prosa",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-planner/SKILL.md",
          "plugins/productivity-tools/skills/roadmap-tracker/SKILL.md",
          "plugins/productivity-tools/skills/roadmap-tracker/references/events/07-new-source.md"
        ],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 1, "verifiability": 0 },
      "produces": ["anotações Gemini em roadmap-planner/SKILL.md e 07-new-source.md e fallback de ${CLAUDE_SKILL_DIR} em roadmap-tracker/SKILL.md dentro dos orçamentos de prosa"],
      "consumes": [],
      "covers": ["AC6"],
      "testFirst": { "exempt": "edição cirúrgica de prosa verificada pelas suítes prose-budget de roadmap-planner e roadmap-tracker" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 11,
      "title": "Descoberta no agy (.agents/skills.json) e asserções de lint em independence.test.mjs",
      "deps": [8, 9, 10],
      "files": {
        "create": [".agents/skills.json"],
        "modify": [],
        "test": ["plugins/productivity-tools/scripts/independence.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["configuração .agents/skills.json apontando para plugins/productivity-tools/skills e testes em independence.test.mjs validando .agents/skills.json e lintPlugin com 0 FAIL e 0 WARN"],
      "consumes": [
        { "task": 8, "sig": "instruções dual-host condicionadas ao host (run_workflow com ScriptPath, ask_question, preflight --declare-permissions \"agy\") e tabela Gemini em routing.md" }
      ],
      "covers": ["AC3", "AC6"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/independence.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (0 WARN, 0 FAIL)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 12,
      "title": "Gates completos do repositório e evidência dos critérios",
      "deps": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "somente executa os gates de verificação finais; não cria nem altera arquivos" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1 completo)" },
        { "cmd": "git diff --exit-code 9e62fd4 -- plugins/productivity-tools/lib/routing.mjs plugins/productivity-tools/lib/progress-state.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0 (arquivos protegidos inalterados)" },
        { "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (0 WARN, 0 FAIL)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/plan-tool.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/independence.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC4", "kind": "test", "command": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC5", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC6", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC7", "kind": "test", "command": "node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs", "external": false, "externalDedupe": null, "blq": null }
  ],
  "rulings": [
    {
      "id": "R9",
      "question": "Como particionar as alterações em tarefas e ondas sem conflito de escrita?",
      "decision": "12 tarefas em 9 ondas: T1, T9 e T10 na Onda 1; T2 na Onda 2; T3 e T4 na Onda 3; T5, T6 e T7 em série nas Ondas 4 a 6; T8 na Onda 7; T11 na Onda 8; T12 na Onda 9.",
      "basis": "plan-tool.mjs proíbe conflito de escrita na mesma onda; T5 a T7 editam o mesmo par de arquivos; T2 é base de T3 e T4, que têm arquivos disjuntos.",
      "alternative": "Concentrar todo roadmap-release-agy.py numa tarefa, como na versão anterior do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como dividir a reprodução em Python de um workflow de cerca de 245 mil caracteres?",
      "decision": "Dividir roadmap-release-agy.py por modo e por trecho de roadmap-release.js: dry-run (T4), plan-only com laço de revisão (T5), run com tarefas, revisão final e gates (T6), merge, rollback, docs, relatório e retomada (T7); modo não implementado devolve erro explícito.",
      "basis": "O limite de 4 arquivos por tarefa não mede volume de código; cada fatia tem referência de linhas no JS e testes sobre git real, e o modo run só fica coberto quando T6 e T7 testam execução real.",
      "alternative": "Uma tarefa única de 2 arquivos com testes só de dry-run.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como validar os scripts Python nos testes se python -m py_compile rejeita await no topo e nem toda máquina tem Python?",
      "decision": "Compilar com ast.PyCF_ALLOW_TOP_LEVEL_AWAIT e executar com asyncio.run e mocks; detectar Python >= 3.8 de verdade (descartando o atalho WindowsApps) e marcar skip com motivo quando faltar.",
      "basis": "O runtime run_workflow injeta globais e permite await no topo; o G1 roda plugins/**/*.test.mjs em qualquer máquina de contribuidor.",
      "alternative": "Validação só por regex, ou exigir Python para o G1.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Em que ponto criar .agents/skills.json e rodar lintPlugin dentro de independence.test.mjs?",
      "decision": "Na Tarefa 11, depois de todas as tarefas que criam scripts ou editam SKILL.md, e antes dos gates.",
      "basis": "lintPlugin verifica a unicidade de basename de todos os scripts e os frontmatters de todos os SKILL.md; rodar depois valida o estado final do plugin.",
      "alternative": "Criar .agents/skills.json na Onda 1 antes dos scripts Python.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
