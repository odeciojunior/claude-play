# E18: registro do release pela CLI e permissões no preflight, registro de revisões

Execução de 2026-11-11 (branch `feat/E18`). Resultado da execução: FALHOU, parada por entrada humana bloqueante (ver "Falha da execução"). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia). "Menores" é a contagem de problemas menores.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, opus | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

Nenhuma tarefa foi executada: a execução parou no estágio de spec.

Falha da execução: blocking human input: Ratificação pelo dono das decisões de contrato de E3 ainda pendentes (DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153), que fixam a forma da CLI, os nomes dos comandos, a saída --json e os códigos de saída sobre os quais E18 é construído (DEC-030, DEC-031; state.md: E18 e E22 esperam essa ratificação).

## Concerns (transcritos como registrados)

Nenhum concern registrado nesta execução.

## Gates

O relatório não traz resultado de gates registrado nesta execução.

## Entradas humanas

1. O que: Ratificação pelo dono das decisões de contrato de E3 ainda pendentes (DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153), que fixam a forma da CLI, os nomes dos comandos, a saída --json e os códigos de saída sobre os quais E18 é construído (DEC-030, DEC-031; state.md: E18 e E22 esperam essa ratificação).
   - BLQ: não informado no relatório.
   - Bloqueante: sim.
   - Contorno: Spec e plano podem ser escritos; E18 não é integrado em release/roadmap-skills-v2 até a ratificação ou a liberação do dono. Se o dono rejeitar alguma, o desenho é corrigido antes conforme a decisão nova.

2. O que: Ratificação pelo dono das 20 decisões autônomas do spec de E18 (DEC-030). As de alcance contrato (1, 2, 5 e 7) seguram o início de E25 e E8; as locais esperam o ponto de medição.
   - BLQ: não informado no relatório.
   - Bloqueante: não.
   - Contorno: Registradas como decisões do executor pendentes; não impedem a entrega de E18.

---

# Execução 2 de 2026-11-11 (branch `feat/E18`)

Nova execução, que passou do spec, escreveu o plano e executou as tarefas T1 a T7. Resultado: sem falha registrada (`failure: null`). O registro da execução anterior acima fica como está. Transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa (execução 2)

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Nenhum estágio terminou com pendência.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, opus; 3: opus, opus | nenhum | 0 | nenhuma |
| plan | 1: opus, -; 2: opus, sonnet | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, -; 2: sonnet, sonnet | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, -; 2: sonnet, sonnet | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T4:quality | 1: sonnet, -; 2: sonnet, sonnet | nenhum | 1 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T6:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T7:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| final | 1: opus, -; 2: opus, sonnet | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas (execução 2)

| T | Título | Status | Commits |
|---|---|---|---|
| 1 | preflight -- regras dos scripts do plugin, dos comandos {verify} e trackerCli (peça 1) | DONE | 3 |
| 2 | preflight -- decisões do executor pendentes da branch alvo (peça 4) | DONE_WITH_CONCERNS | 2 |
| 3 | funções puras de montagem e veredito do registro | DONE | 2 |
| 4 | recordStatus pela CLI, argumento trackerCli e descoberta | DONE | 2 |
| 5 | etapa de documentação e relatório pela CLI (peça 3) | DONE_WITH_CONCERNS | 1 |
| 6 | SKILL.md e config.md | DONE | 1 |
| 7 | teste comportamental da skill (tarefa do orquestrador da sessão principal, DEC-204) | DONE_WITH_CONCERNS | 0 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados, execução 2)

- T1: Duas decisões minhas que o plano não especificava, ambas pequenas.
  - Em trackerCliPath, a checagem de aspas duplas olha também o argumento `from`. Com `from='/a"b/c'` o resolve com '../..' descarta o trecho com aspas, e o teste do plano não falharia como esperado.
  - Em openCardCommands, as palavras de bloqueado são 'blocked', deliverableStatuses[8] e vocab.blockedStatus. Uma palavra de status fora do vocabulário (indexOf -1) conta como card aberto.
- T2: 1) The plan's AC4 test expects scope 'contrato', but the CLI's `decisionScope` returns 'contract' (en) or 'local'. The test asserts 'contract'; the decision text still ends with 'Alcance: contrato.'. 2) I fixed a bug carried over from T1, in the same function I refactored. The path of a file read with `git show <ref>:` was not normalized, so a strategy path like `../x.md` made the read fail on the real roadmap. It now goes through `posix.normalize`, which also makes T1's card reading work on the real roadmap. 3) `readCards` is replaced by `readRoadmapTexts` (config, strategy, state and decisions in one read) plus `readPendingDecisions`, as the plan asks. 4) A config without `vocab`, or without a decisions file, returns an empty list with no warning; otherwise the existing stub-config test I5 gets a spurious warning. Any other read or parse exception becomes a warning. 5) I wrote the implementation and the tests together, and did not run the new tests against the old code to see them fail first, because stash is forbidden. They check a field that did not exist before, so they could not have passed on the old code. 6) The plan's roadmap.mjs line number is ~192 and the real one matches.
- T2:spec fix1: The new no-ref warning broke test I5, which asserted that a derived config without --ref has warnings deepEqual []. That expectation contradicted the spec, so I changed it to expect exactly the origin warning. This is a test edit, not a spec or plan edit. I did not run G2 (claude plugin validate .) because only productivity-tools files changed and the task asked for its own checks.
- T3: Four small extensions beyond the plan's literal signatures, all inside the task's two files.
  1. recordCommands also takes `blockedStatus`, which it needs to choose block-open.
  2. For a blocked word, `logWhat` carries the block reason.
  3. phrases() gains `blockHow(E)`, used for the `--how` of block-close.
  4. When `evidence` is empty or the first reference does not fit, the `log` command falls back to the evidence `state.md`, because the CLI refuses a log row without evidence. This mirrors the CLI default for block-open and block-close.

  Decisions: `--decision` room reserves the scope phrase plus 2 characters (one for the space, one for the period the CLI adds). block-open reserves 24 characters for the "BLQ-n opened:" log prefix and 64 for the restore phrase in "Unblocks when". recordVerdict also fails when more commands ran than were assembled. It does not use `head` or `porcelain`, since the spec's failure list does not include them. The shq test against Git Bash ran (not skipped), so literal delivery of quotes, `$`, backtick and newline was verified with the real bash.
- T3:quality fix1: I did not run the new regression test against the old code, so I did not confirm that it fails without the fix. I did not rerun G2, G3 or G4 because the change touches only the workflow script and its test.
- T4: 1) Re-recording an already recorded deliverable can repeat `add-decision` entries, because the CLI does not look idempotent. Within one run there is no duplicate: the plan record happens only in plan-only and the executing record only in run. A run after an earlier plan-only run would add the decisions again. 2) For the blocked record the review-log `source` is the glob `docs/superpowers/reviews/<TODAY>-<E>-*-reviews.md`, because `slug` is not visible at that call site. Cut texts there go to the result's `recordCuts`, not through `persistReviews`, which already ran. 3) `block-close` is built only when the discovery cell cites `BLQ-n` and the current word is blocked. 4) The docs stage still uses `roadmap-tracker` and `disc.checker`; that is Task 5 by the plan.
- T4:quality fix1: The review-log write needs the worktree to exist. If the deliverable failed before the worktree was set up, persistReviews returns early (setupOk false). The cuts then stay only in r.recordCuts in the result, and the source still names the log path. The old glob never named a real file either. A deliverable that failed that early has no log to write to, and a fix would be a design change. The cut-suffix wording is unchanged. I ran the validator and lint but not the G2 or G4 gates, since only productivity-tools files changed.
- T5: 1. Test order: I wrote the implementation before the new tests, so I never ran the new tests against the old code to see them fail. The plan's Passo 2 (red run) was skipped.
  2. G1 exit code: the "G1=0" in my gate loop is the exit of the `grep` filter. The real counts are tests 1283, pass 1283, fail 0, skipped 0.
  3. Discovery prompt: it still names `check-roadmap.mjs`, because the spec says discovery keeps returning `checker` and `checkerExists`. The "checker só de brief" test excludes the `discovery` label for that reason. Every other prompt is free of the file name.
  4. Report data: the report prompt carries the `result.checker` values collected per deliverable (`CHECKERS`), not the `trackerCli` path. A pre-existing test requires that path to stay out of the report prompt.
  5. Marked human items: items carrying "[already authorized and run in this run: ...]" are kept out of the mandatory command list. Their assembled `add-pending` commands go in a separate "run only if an open need remains" list, and their runs are dropped from the verdict. An agent that skips them does not fail the stage, and one that runs them is not counted as running beyond the list.
  6. Fitting and cuts: pending texts are fitted with `fitCell` against the review log as source, and criterion texts against the plan. Text cut in the docs stage is not added to `recordCuts`. The full text is already in the committed review log (risks, human inputs) or the plan.
  7. Existing tests changed: 'm2' and 'real run ... cd' were adapted to the new schema. The `/:docs\d$/` and `/:docs-measure/` mocks now use the record mock.
- T6: Two existing tests in flow.test.mjs (PF/I3 and FF/M2) assert exact old phrases from the docs. I kept those substrings in the new text instead of editing the tests, because the plan lists only the two doc files for this task. The wording is therefore slightly less compact: the preflight output is written as the old seven-field list "plus `trackerCli` and `pendingDecisions`", and the resume rule reads "replacing `config` and `runToken` ..., and `trackerCli` likewise". Task 7 (behavioral test) was not started. It belongs to the main-session orchestrator under DEC-204.
- T7: The behavioral test (Passo 1 skill-following subagent, Passo 2 adversarial review, Passo 3 log hand-off and _tmp/E18 cleanup) is still pending for the main-session orchestrator under DEC-204. The preflight output above is the plan's acceptable fallback evidence, not a replacement for those steps. The preflight output was cut at 3000 characters, so the orchestrator should rerun it to get the full pendingDecisions list. The run showed missingRules non-empty and contract-scope pending decisions (DEC-211, 212, 215, 217), so the skill's single stop would apply when the orchestrator composes it.
- final fix1: The docs-stage set-status now writes only the merge SHA to the panel Evidence cell. The gates list, spec, plan and review log still go to the log row. This follows the first option the reviewer suggested, but the panel no longer shows the review-log reference. I also ran `git checkout -- flow.test.mjs` once by mistake, which discarded my uncommitted test edits, and I re-added the tests. The final tests passed afterwards.

## Gates (execução 2)

O relatório desta execução não traz uma lista de gates com resultado. Os únicos números de gate registrados estão nos concerns: T5 informa G1 com tests 1283, pass 1283, fail 0, skipped 0; T2:spec fix1 não rodou G2; T3:quality fix1 não rodou G2, G3 nem G4; T4:quality fix1 rodou o validador e o lint, mas não G2 nem G4.

## Entradas humanas (execução 2)

1. O que: Ratificação pelo dono das decisões autônomas do spec (DEC-030); as de alcance contrato (1, 2, 5 e 7) seguram o início de E25 e E8, as de alcance local esperam o ponto de medição.
   - BLQ: não informado no relatório.
   - Bloqueante: não.
   - Contorno: Seguem como pendentes do executor (origem executor, status pendente); E18 prossegue.

2. O que: Ratificação pelo dono das decisões de contrato de E3 ainda pendentes (DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153), que fixam a forma da CLI, os nomes dos comandos, a saída --json e os códigos de saída sobre os quais E18 é construído (DEC-030, DEC-031; state.md: E18 e E22 esperam essa ratificação).
   - BLQ: não informado no relatório (o texto cita BLQ-2 apenas na observação final do contorno).
   - Bloqueante: sim.
   - Contorno: Spec e plano podem ser escritos; E18 não é integrado em release/roadmap-skills-v2 até a ratificação ou a liberação do dono. Se o dono rejeitar alguma, o desenho é corrigido antes conforme a decisão nova. (O spec registra como resolvida: ratificada pelo dono em 2026-11-11 com as emendas DEC-200 a DEC-202; BLQ-2 fechado.)

3. O que: Ratificação pelo dono das 20 decisões autônomas do spec de E18 (DEC-030). As de alcance contrato (1, 2, 5 e 7) seguram o início de E25 e E8; as locais esperam o ponto de medição.
   - BLQ: não informado no relatório.
   - Bloqueante: não.
   - Contorno: Registradas como decisões do executor pendentes; não impedem a entrega de E18.

## Tarefa 7: teste comportamental (orquestrador da sessão principal, DEC-204, DEC-230), 2026-11-12

Executor: subagent sonnet seguindo `roadmap-release/SKILL.md` literalmente, em `dry-run` de E17 sobre `docs/plans/roadmap-evolucao-skills/`, até o passo 2 e a montagem dos argumentos do passo 4, sem chamar o Workflow, no checkout da `release/roadmap-skills-v2` (E18 já integrado; o worktree E18 não existe mais). Checkout sem mudança (`git status --porcelain` vazio).

### Saída literal do preflight (exit 0)

```json
{
  "configPath": "D:\\projects\\claude-play-wt\\_integracao\\docs\\plans\\roadmap-evolucao-skills\\release.config.json",
  "generated": true,
  "errors": [],
  "missingRules": [
    "Bash(node:*)",
    "Bash(claude:*)",
    "Bash(node *roadmap.mjs\" *)",
    "Bash(git:*)"
  ],
  "warnings": [],
  "config": {
    "generated": true,
    "projectContext": "Project rules: CLAUDE.md at the repository root (already in your context; if not, read it).",
    "install": "",
    "locks": [],
    "conflictRules": "",
    "gates": [
      {
        "name": "G1",
        "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
        "kind": "tests"
      },
      {
        "name": "G2",
        "cmd": "claude plugin validate .",
        "kind": "exit"
      },
      {
        "name": "G3",
        "cmd": "claude plugin validate plugins/productivity-tools",
        "kind": "exit"
      },
      {
        "name": "G4",
        "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid",
        "kind": "exit"
      },
      {
        "name": "G5",
        "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
        "kind": "exit"
      }
    ]
  },
  "runToken": "2026-11-12T06:06:49.647Z-9e937d5f4a5a",
  "trackerCli": "D:/projects/claude-play-wt/_integracao/plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs",
  "pendingDecisions": []
}

```

### Mensagem de parada composta

# Preflight report (mode: dry-run, target release/roadmap-skills-v2)

Per SKILL.md step 2, in `dry-run` the skill does NOT stop on `missingRules` or pending decisions; it reports them after the run. Conclusion: continue (to step 4); no question to the person.

- errors: none (exit code 0)
- warnings: none
- pendingDecisions: none (no `contract`, no `local`)
- missingRules (4), one per line, for the person to add to their permissions (no settings file was edited):
  Bash(node:*)
  Bash(claude:*)
  Bash(node *roadmap.mjs" *)
  Bash(git:*)
- generated: true (the committed release.config.json on the target still carries `generated: true`, so a real run would use maxParallel 1).

### Revisão adversarial (sonnet, só leitura): aprovada com ressalvas

- Peça 4 conferida: `missingRules` traz a regra da CLI do tracker (`Bash(node *roadmap.mjs" *)`), `trackerCli` absoluto com `/`, `pendingDecisions` presente e vazio, confirmado por `roadmap.mjs pending-decisions --json` (0). `Bash(claude:*)` vem dos gates G2 e G3. Em `dry-run` não para e relata (SKILL.md passo 2). Argumentos do passo 4 completos (as seis chaves, `scriptPath` absoluto).
- Média: SKILL.md passo 1 (fórmula de `wtRoot`, `<dirname(repo)>/<basename(repo)>-wt`) contradiz o passo 3 (`<wtRoot>/_integracao` como checkout da pessoa) quando `repo` já é o worktree `_integracao`. Vira pendente do executor.
- Baixas: o passo 2 não diz que `releaseBranch` ausente no `release.config.json` cai para `roadmap.config.json`; o passo 3 é um parágrafo emaranhado; o teste não exercitou `pendingDecisions` não vazio nem regra vinda de `{verify}` (os testes de unidade cobrem) e não carregou a skill pela ferramenta Skill.
- Ambiguidade "cinco contra seis chaves": leitura errada do testador; a SKILL.md lista seis de forma consistente (a tarefa 7 do plano está desatualizada).
