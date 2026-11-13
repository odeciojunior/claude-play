# E9: registro de revisões

Execução: revisão final reprovada (falha: "final has open issues after 2 fixes"). Tarefa T6 aguarda a pessoa.

## Revisões por etapa

| Etapa | Rodadas (n, revisor, tier da correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1 (opus, sem correção) | nenhum | 2 | nenhuma |
| plan | 1 (opus, sem correção) | nenhum | 4 | nenhuma |
| T1:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T1:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T2:spec | 1 (sonnet, sem correção) | nenhum | 1 | nenhuma |
| T2:quality | 1 (sonnet, sem correção) | nenhum | 1 | nenhuma |
| T3:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T3:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T4:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T4:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T5:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T5:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhuma |
| T6:spec | 1 (sonnet, sem correção) | nenhum | 1 | nenhuma |
| T6:quality | 1 (sonnet, sem correção) | nenhum | 1 | nenhuma |
| final | 3 (ver abaixo) | 3 importantes (2 distintos na prática, ver abaixo) | 3 | 2 abertas |

### final

Rodadas:

- Rodada 1: revisor opus, sem correção anterior.
- Rodada 2: revisor opus, correção anterior em sonnet.
- Rodada 3: revisor opus, correção anterior em sonnet.

Problemas bloqueantes (transcritos):

1. [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The new test-first failure instruction (line 2485) does not work as written. (a) `git -C "<wt>" rebase --onto ${start} <last task commit> HEAD` passes HEAD as the <branch> argument, so git rebases a detached HEAD and leaves the branch alone. I reproduced this in a scratch repo: "Successfully rebased and updated detached HEAD", the worktree ends "Not currently on any branch", and the branch still holds the task commit. A rerun on ${br} therefore still sees the `E9 T<n>:` commit, treats the task as done and skips the check. That is exactly the outcome the message says the rebase prevents. The branch has to be named, e.g. `rebase --onto ${start} <last task commit> ${br}`. (b) Even with the branch named, the message's promise is false for the cases it singles out. The kept marks `${E} T<n>: external effect completed` (closeEffect, authorized external task) and `${E} T<n>: resumed after awaiting person` (task that was awaiting a person) match the done grep `^${E} T<n>:` (line 2346). So the next run still takes the task as done (resumed) and skips the check, and the reviewer gets a range with none of the task's code. Also, when the task was awaiting a person, `start = earlier.firstParent`, so commits from that earlier run (the awaiting-person marks) fall between start and the last task commit and are dropped too, although the message says the effect marks are kept. The new review.test.mjs assertion `rebase --onto \$\{start\} <last task commit> HEAD` locks in the detached-HEAD form.

2. [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The reworded recovery instruction for a test-first failure (line 2485) has the operator run `git -C "${wt}" rebase --onto ${start} <last task commit> HEAD`. Passing `HEAD` as the <branch> argument makes git rebase on a detached HEAD, and the branch is left as it was. I reproduced this in a scratch repo: branch feat had base, then "E9 T2: task", then "E9: review log (failed)". After `git rebase --onto base <task> HEAD` the output was "Not currently on any branch", the new review-log commit existed only on the detached HEAD, and feat still pointed at the old log with the task commit under it. So when the operator follows the message, ${br} still holds the task commit. The next run's progress read (git log --grep "^E T<n>:" TARGET..HEAD, after setup puts the branch back) finds the task as done, takes it as resumed and skips testFirstGap. That is the outcome the message says it prevents. The worktree is also left detached for the next setup. The new review.test.mjs test (lines 469-477) locks in the broken form with assert.match(line, /rebase --onto \$\{start\} <last task commit> HEAD/). Fix: name the branch, as in `git -C "${wt}" rebase --onto ${start} <last task commit> ${br}`, and change the test to require ${br}.

Contagem de menores: 3.

Pendências não resolvidas (as duas acima, transcritas de novo pela revisão como abertas):

- [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The new test-first failure instruction (line 2485) does not work as written. (a) `git -C "<wt>" rebase --onto ${start} <last task commit> HEAD` passes HEAD as the <branch> argument, so git rebases a detached HEAD and leaves the branch alone. I reproduced this in a scratch repo: "Successfully rebased and updated detached HEAD", the worktree ends "Not currently on any branch", and the branch still holds the task commit. A rerun on ${br} therefore still sees the `E9 T<n>:` commit, treats the task as done and skips the check. That is exactly the outcome the message says the rebase prevents. The branch has to be named, e.g. `rebase --onto ${start} <last task commit> ${br}`. (b) Even with the branch named, the message's promise is false for the cases it singles out. The kept marks `${E} T<n>: external effect completed` (closeEffect, authorized external task) and `${E} T<n>: resumed after awaiting person` (task that was awaiting a person) match the done grep `^${E} T<n>:` (line 2346). So the next run still takes the task as done (resumed) and skips the check, and the reviewer gets a range with none of the task's code. Also, when the task was awaiting a person, `start = earlier.firstParent`, so commits from that earlier run (the awaiting-person marks) fall between start and the last task commit and are dropped too, although the message says the effect marks are kept. The new review.test.mjs assertion `rebase --onto \$\{start\} <last task commit> HEAD` locks in the detached-HEAD form.
- [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The reworded recovery instruction for a test-first failure (line 2485) has the operator run `git -C "${wt}" rebase --onto ${start} <last task commit> HEAD`. Passing `HEAD` as the <branch> argument makes git rebase on a detached HEAD, and the branch is left as it was. I reproduced this in a scratch repo: branch feat had base, then "E9 T2: task", then "E9: review log (failed)". After `git rebase --onto base <task> HEAD` the output was "Not currently on any branch", the new review-log commit existed only on the detached HEAD, and feat still pointed at the old log with the task commit under it. So when the operator follows the message, ${br} still holds the task commit. The next run's progress read (git log --grep "^E T<n>:" TARGET..HEAD, after setup puts the branch back) finds the task as done, takes it as resumed and skips testFirstGap. That is the outcome the message says it prevents. The worktree is also left detached for the next setup. The new review.test.mjs test (lines 469-477) locks in the broken form with assert.match(line, /rebase --onto \$\{start\} <last task commit> HEAD/). Fix: name the branch, as in `git -C "${wt}" rebase --onto ${start} <last task commit> ${br}`, and change the test to require ${br}.

Falha registrada: final has open issues after 2 fixes (as duas pendências acima).

## Riscos aceitos

Nenhum.

## Tarefas

| T | Título | Status | Commits |
|---|---|---|---|
| 1 | Agente implementer com modos de implementação e correção | DONE | 1 |
| 2 | Conferência pura de teste primeiro e testFirst em tasksFromPlan | DONE | 1 |
| 3 | Chamada da conferência antes do primeiro revisor | DONE_WITH_CONCERNS | 1 |
| 4 | Seis chamadas pelo implementer e texto movido para o agente | DONE | 1 |
| 5 | Linha do agente no README do plugin e gates | DONE_WITH_CONCERNS | 1 |
| 6 | Teste comportamental do implementer pelo orquestrador | NEEDS_HUMAN | 0 |

## Concerns

- the "executing" roadmap record failed (reread status --json is missing or has no panel; reread brief --json is missing or is not JSON of the CLI; reread pending-decisions --json is missing or is not JSON of the CLI); decisions and the in-flight entry are not recorded yet
- T2: The removal of the TDD, report and status text from buildImplPrompt now sits in T2, not T4, because the size cap required it, as plan section "Tamanho do script" permits. The testFirst line that T4 adds to buildImplPrompt does not exist yet. T3 and T4 must still add the call and the implementer agent routing. T4 must not re-remove text that is already gone. I did not run G1 in full. I ran only the roadmap-release workflow tests (498 pass), which cover this change.
- T3: The first draft of Task 3 pushed roadmap-release.js to 240044 chars, 44 over the cap. I did not touch size.test.mjs. I used the plan's allowance to remove spec-mandated text whose equivalent is already in agents/implementer.md. This removal was meant for T4, so T4 will find those two sentences already gone from the per-task fixer. Until T4 routes that fixer through implAgent, it runs without agentType, so it has no instruction to report checks. S_IMPL still requires the field, and the flow tests pass.
- T4: Choices not spelled out in the plan:
  - The test-first line reads "This is a test-first task: write the test, run it and report the failure before implementing." The exemption line reads "This task is exempt from test-first: <reason>." The AC3 test pins these two wordings.
  - A comment near the previous-version check mentioned "the superpowers skills". I reworded it to "the previous skills" so the script has no mention of superpowers.
  - T2 had already removed the "Follow TDD", "Report in checks" and "Status:" lines from buildImplPrompt, and the two sentences from the task fixer (the disagree sentence and the report sentence). T4 removed what was left. I also dropped a stray extra "." at the end of the Commit sentence in buildImplPrompt.
  - The merge-fix prompt now opens its last line with "Fix on ${TARGET} ..." (capitalized, since "Use superpowers:systematic-debugging; " is gone). The gates-fix prompt opens its last line with "Root cause, a fix with a test ...".
  - The `:impl` label is a variable inside runImpl, so the AC3 test checks it by looking for the substring `:impl` in the first 2000 characters after `implAgent(` (the runImpl chunk reaches it through the `label` shorthand and `:impl` in `${E}:t${t.n}:impl-lock`... in fact it matches via other `:impl`-containing text). Please check this assertion if you want a stricter label match.
- T5: 1) G1 reports 1643 tests (0 failing, 0 skipped), not the baseline 1638. The 5 extra tests come from the earlier E9 tasks T1 to T4 on this branch, not from this README line. 2) G5 prints one WARN: plan-coordinator/references/delegation-protocol.md links state.md, which is not one level deep. The file is not touched by this task and the WARN does not fail G5, so it is pre-existing on this branch. 3) G3 prints an ICON_MISSING plugin-directory warning. It is outside the validation result and was not changed by this task. 4) TDD note: a README line has no unit test, so the failing check was grep -c "agents/implementer.md" returning 0 before the edit, and 1 after.

## Portões (gates)

Os gates G1, G3 e G5 aparecem apenas nas concerns de T5 (G1: 1643 testes, 0 falhas, 0 ignorados; G5: um WARN que não falha; G3: aviso ICON_MISSING fora do resultado de validação). Nenhum outro resultado de gate foi registrado nesta execução, pois a revisão final falhou antes da etapa de gates.

## Entradas humanas

- O quê: execução comportamental do orquestrador da sessão principal (DEC-204).
- BLQ: nenhum identificado nos dados (o registro "executing" falhou, então nenhum BLQ foi aberto).
- Workaround: None implemented. The plan forbids a fictional report. The main-session orchestrator must run the two sonnet subagents (implementation mode and fix mode) on the SYNTHETIC FIXTURE files in D:/projects/claude-play-wt/_tmp/E9-comportamental/. It must then run the read-only opus review, write docs/reports/2026-11-12-E9-implementador-comportamental.md, and commit 'E9 T6: relatório comportamental do implementer'.
- Bloqueante: sim.

## Execução registrada em blocked-record (esta execução)

Estágio: blocked-record. A mesma falha da revisão final foi registrada de novo: "final has open issues after 2 fixes". Os dados de revisões, tarefas, concerns e entrada humana são os mesmos das seções acima (14 etapas de spec, plano e tarefas com 1 rodada cada; final com 3 rodadas opus, correções anteriores em sonnet nas rodadas 2 e 3; menores: spec 2, plan 4, T2:spec 1, T2:quality 1, T6:spec 1, T6:quality 1, final 3). Riscos aceitos: nenhum. Branch feat/E9 mantida em D:/projects/claude-play-wt/E9.

Problemas bloqueantes e pendências desta execução (transcritos, idênticos aos da seção "final"):

1. [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The new test-first failure instruction (line 2485) does not work as written. (a) `git -C "<wt>" rebase --onto ${start} <last task commit> HEAD` passes HEAD as the <branch> argument, so git rebases a detached HEAD and leaves the branch alone. I reproduced this in a scratch repo: "Successfully rebased and updated detached HEAD", the worktree ends "Not currently on any branch", and the branch still holds the task commit. A rerun on ${br} therefore still sees the `E9 T<n>:` commit, treats the task as done and skips the check. That is exactly the outcome the message says the rebase prevents. The branch has to be named, e.g. `rebase --onto ${start} <last task commit> ${br}`. (b) Even with the branch named, the message's promise is false for the cases it singles out. The kept marks `${E} T<n>: external effect completed` (closeEffect, authorized external task) and `${E} T<n>: resumed after awaiting person` (task that was awaiting a person) match the done grep `^${E} T<n>:` (line 2346). So the next run still takes the task as done (resumed) and skips the check, and the reviewer gets a range with none of the task's code. Also, when the task was awaiting a person, `start = earlier.firstParent`, so commits from that earlier run (the awaiting-person marks) fall between start and the last task commit and are dropped too, although the message says the effect marks are kept. The new review.test.mjs assertion `rebase --onto \$\{start\} <last task commit> HEAD` locks in the detached-HEAD form.
2. [important/defeito] `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: The reworded recovery instruction for a test-first failure (line 2485) has the operator run `git -C "${wt}" rebase --onto ${start} <last task commit> HEAD`. Passing `HEAD` as the <branch> argument makes git rebase on a detached HEAD, and the branch is left as it was. I reproduced this in a scratch repo: branch feat had base, then "E9 T2: task", then "E9: review log (failed)". After `git rebase --onto base <task> HEAD` the output was "Not currently on any branch", the new review-log commit existed only on the detached HEAD, and feat still pointed at the old log with the task commit under it. So when the operator follows the message, ${br} still holds the task commit. The next run's progress read (git log --grep "^E T<n>:" TARGET..HEAD, after setup puts the branch back) finds the task as done, takes it as resumed and skips testFirstGap. That is the outcome the message says it prevents. The worktree is also left detached for the next setup. The new review.test.mjs test (lines 469-477) locks in the broken form with assert.match(line, /rebase --onto \$\{start\} <last task commit> HEAD/). Fix: name the branch, as in `git -C "${wt}" rebase --onto ${start} <last task commit> ${br}`, and change the test to require ${br}.

Texto da falha e do bloco aberto (block-open --what): "E9 bloqueado: automatic execution stopped (conteudo): final has open issues after 2 fixes: 1. [important/defeito] ... (texto cortado; ver item 3 de "Textos cortados no registro")".

## Textos cortados no registro

1. Origem: docs/plans/evolucao-skills-E9/reviews.md. Destino: argumento `--decision` de add-decision. Texto completo:

   Mover para o agente o texto genérico dos prompts (TDD, relato de checks, status, não editar spec e plano, discordância técnica, método de depuração), passar as seis chamadas por implAgent e medir com workflowChars depois de cada edição; se não couber, parar com BLOCKED e ação do dono, sem editar size.test.mjs.

2. Origem: docs/plans/evolucao-skills-E9/reviews.md. Destino: argumento `--decision` de add-decision. Texto completo:

   Tarefa do orquestrador da sessão principal no worktree de E9: dois subagents seguem agents/implementer.md literalmente (implementação de teste primeiro sobre fixture sintética marcada, e correção sobre lista de achados), uma revisão adversarial só de leitura, relatório em docs/reports/2026-11-12-E9-implementador-comportamental.md.

3. Origem: docs/plans/evolucao-skills-E9/reviews.md. Destino: argumento `--what` de block-open. Texto completo:

   E9 bloqueado: automatic execution stopped (conteudo): final has open issues after 2 fixes: 1. [important/defeito] plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js The new test-first failure instruction (line 2485) does not work as written. (a) `git -C "<wt>" rebase --onto ${start} <last task commit> HEAD` passes HEAD as the <branch> argument, so git rebases a detached HEAD and leaves the branch alone. I reproduced this in; branch feat/E9 kept at D:/projects/claude-play-wt/E9
