# E20 Autor de plano (plan-writer e ponteiros): registro de revisões

Execução de 2026-11-12 na branch feat/E20. Resultado da execução: falhou (revisão final com bloqueio aberto).

## Revisões por estágio e tarefa

Legenda: rodada (número, modelo do revisor, tier da correção que a precedeu). "Menores" é a contagem de achados menores. Onde não há achado crítico ou importante, a coluna diz "nenhum".

| Estágio | Rodadas | Críticos/importantes | Menores | Não resolvidos |
|---|---|---|---|---|
| spec | 1 (opus, sem correção); 2 (opus, correção opus) | nenhum | 0 | nenhum |
| plan | 1 (opus, sem correção); 2 (opus, correção sonnet) | nenhum | 0 | nenhum |
| T1:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T1:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T2:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T2:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T3:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T3:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T4:spec | 1 (sonnet, sem correção) | nenhum | 1 | nenhum |
| T4:quality | 1 (sonnet, sem correção) | nenhum | 2 | nenhum |
| T5:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T5:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T6:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T6:quality | 1 (sonnet, sem correção) | nenhum | 1 | nenhum |
| T7:spec | 1 (sonnet, sem correção); 2 (sonnet, correção sonnet) | nenhum | 0 | nenhum |
| T7:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T8:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T8:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T9:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T9:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T10:spec | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T10:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T11:spec | 1 (sonnet, sem correção) | nenhum | 1 | nenhum |
| T11:quality | 1 (sonnet, sem correção) | nenhum | 0 | nenhum |
| T12:spec | 1 (sonnet, sem correção) | nenhum | 3 | nenhum |
| T12:quality | 1 (sonnet, sem correção); 2 (sonnet, correção sonnet) | 1 importante (ambiente), abaixo | 1 | 1 (abaixo) |
| final | 1 (opus, sem correção); 2 (opus, correção sonnet) | 2 críticos e 2 importantes (defeito), abaixo | 1 | ver abaixo |

### Detalhe: T12:quality

Bloqueio (importante, categoria ambiente, arquivo plugins/productivity-tools/skills/plan-writer/SKILL.md):

> Criterion 4 (adoption) has not been re-run after the fix in 30ff73f. The new SKILL.md/plan-author.md text for F4-1..F4-4 (APPROVAL QUESTION fallback, missing-spec rule, fixed .adopted.md name, per-step Adoção table, foreground dispatch) is plausible on reading but unverified behaviorally; it needs the main-session orchestrator because the Agent tool is required (DEC-204).

Não resolvido ao fim: o mesmo item (importante, ambiente), aceito como risco (ver "Riscos aceitos").

### Detalhe: final

Bloqueios da revisão final (as quatro entradas abaixo aparecem duas vezes na lista de bloqueios do dado, e duas vezes na lista de não resolvidos; o texto é o mesmo e fica transcrito uma vez por entrada distinta).

1. Crítico, categoria defeito, arquivo docs/reports/2026-11-12-E20-autor-plano-comportamental.md:

> The acceptance evidence for criterion 4 (and 1 and 2) is stale against HEAD. The last commit, 30ff73f, rewrote plugins/productivity-tools/agents/plan-author.md (the `mode` field, the adopt-mode `## Adoção` accounting) and plugins/productivity-tools/skills/plan-writer/SKILL.md (approval fallback, cited-but-missing spec, provisional name, foreground dispatch). Those runs were made at 5a53f31, before that commit, and were not repeated. Plan Task 12 requires this: 'a correção volta à tarefa dona do arquivo ... e as execuções do critério afetado rodam de novo, sem apagar as anteriores do relatório'. The strategy rule also requires every skill behaviour change to get a behavioral run and an adversarial review. The report is unchanged. It still pins commit 5a53f31 and records criterion 4 as FAILED (F4-1 to F4-4). It also records AV-1 (the field-unknown `mode` warning) on every plan and says 'nenhum corrigido nesta tarefa'. So the shipped SKILL.md and agent have no recorded run showing that adoption displays `## Adoção`, asks one approval and writes a checked plan. That leaves AC4 of a CRITICAL card with only failing evidence. The criterion 1, 2 and 4 runs must be repeated on the HEAD text by the main-session orchestrator (DEC-204), appended to the report, and followed by an adversarial review.

2. Importante, categoria defeito, arquivo docs/reports/2026-11-12-E20-autor-plano-comportamental.md:

> The authorization gate in adoption mode is not verified at HEAD. The spec forbids overwriting the original plan before approval (spec line 47, ruling 3), and criterion 4 asks for one approval. The only behavioral evidence (runs c4 and c4b, tested at 5a53f31) shows the session ran `mv` over the original plan without ever asking for approval (F4-1). The adoption also ran without the spec lookup (F4-2), and the agent rewrote tasks while its `## Adoção` table claimed nothing changed (F4-4). Commit 30ff73f later added an `APPROVAL QUESTION:` fallback, a rule against moving without an explicit answer, foreground dispatch and stricter Adoção accounting, but only as text in SKILL.md and plan-author.md. Nobody re-ran the behavioral runs. The criterion-4 evidence the owner is told to check (`{verify: human}` in docs/reports) is therefore a failing run against superseded text, and no run shows the overwrite-before-approval guard working. Fix: re-run criterion 4 (and criterion 1, for AV-1) on HEAD, then update the report.

3. Crítico, categoria defeito (sem arquivo): "dirty working tree (uncommitted files)". Esta entrada consta só na lista de não resolvidos da rodada 2; o dado da própria falha do estágio registra que ao fim a árvore estava limpa (git status --porcelain vazio, HEAD 169c3db), portanto o item foi resolvido sem alteração.

Falha do estágio final (transcrita):

> final: fix BLOCKED: I changed nothing and made no commit. Items 1 to 4 (two pairs of duplicates) need new behavioral runs of criteria 1, 2 and 4 on HEAD, followed by an adversarial review. The owner instruction (DEC-204) sends behavioral runs that need a subagent tool back to the main-session orchestrator, and this subagent has no Agent/Task tool, so it cannot dispatch plan-writer, spec-author or plan-author. Writing new run results into docs/reports/2026-11-12-E20-autor-plano-comportamental.md without running them would be a fictional record, so I left the report as it is. Item 5 (dirty working tree) is already resolved: in D:/projects/claude-play-wt/E20 on feat/E20, git status --porcelain is empty and HEAD is 169c3db.

## Riscos aceitos

- T12:quality, importante, categoria ambiente, arquivo plugins/productivity-tools/skills/plan-writer/SKILL.md: Criterion 4 (adoption) has not been re-run after the fix in 30ff73f. The new SKILL.md/plan-author.md text for F4-1..F4-4 (APPROVAL QUESTION fallback, missing-spec rule, fixed .adopted.md name, per-step Adoção table, foreground dispatch) is plausible on reading but unverified behaviorally; it needs the main-session orchestrator because the Agent tool is required (DEC-204).

## Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | spec-tool summary --lang | DONE | 1 |
| 2 | plan-tool summary | DONE | 1 |
| 3 | agente plan-author (peça 1) | DONE | 1 |
| 4 | skill plan-writer (peça 2) e ajuste de spec-writer | DONE | 1 |
| 5 | referências do planner apontam spec-writer e plan-writer | DONE | 1 |
| 6 | planner e tracker sem superpowers (critério 3) | DONE | 1 |
| 7 | parser e pontuação da suíte de gatilho | DONE | 2 |
| 8 | casos de gatilho, executor e --dry-run (peça 4) | DONE | 1 |
| 9 | variante plan-author do cenário | DONE | 1 |
| 10 | roteiro sintético da aprovação da adoção | DONE | 1 |
| 11 | README do plugin | DONE_WITH_CONCERNS | 2 |
| 12 | execuções comportamentais e relatório (critérios 1, 2 e 4; REQ-037; pendência de E19) | DONE_WITH_CONCERNS | 2 |

## Concerns

- the "executing" roadmap record failed (command 3 ran with a different text than the one assembled; command 4 ran with a different text than the one assembled; command 5 ran with a different text than the one assembled; command 6 ran with a different text than the one assembled; command 7 ran with a different text than the one assembled; command 8 ran with a different text than the one assembled; command 9 ran with a different text than the one assembled; command 10 ran with a different text than the one assembled; command 11 ran with a different text than the one assembled; command 12 ran with a different text than the one assembled; command 13 ran with a different text than the one assembled; command 14 ran with a different text than the one assembled; command 15 ran with a different text than the one assembled; command 16 ran with a different text than the one assembled; command 17 ran with a different text than the one assembled; command 18 ran with a different text than the one assembled; command 19 ran with a different text than the one assembled; command 20 ran with a different text than the one assembled; command 21 ran with a different text than the one assembled; command 22 ran with a different text than the one assembled; reread status --json is missing or has no panel; reread brief --json is missing or is not JSON of the CLI); decisions and the in-flight entry are not recorded yet
- T4: Test order: I wrote the SKILL.md and the spec-writer edit first, then added the tests. To still show the red step, I temporarily removed the plan-writer file and restored spec-writer to HEAD. That run gave 9 failures (6 pass), and then I restored both files. The one G5 WARN is on plan-coordinator/references/delegation-protocol.md, which this task did not touch, so I treated it as pre-existing. It is not in the baseline text you gave me, and G5 still exits 0 with 0 FAIL. The bypassPermissions test is named "never mention bypassPermissions in plan-writer", so it sits beside the T3 agent test of the plan's original name. This keeps the T3 test unchanged. The plan said to extend that test.
- T5: G5 reports one WARN (plan-coordinator/references/delegation-protocol.md links state.md, one-level-deep rule). It is not in this diff and the gate exits 0. The G3 validator also prints a non-blocking ICON_MISSING warning. Both are pre-existing and outside Task 5. The red step was observed as the grep matching the old references before editing.
- T7: The wrong-skill fixture is written with CRLF and a blank line, but git normalized it to LF in the index (i/lf, w/crlf, because autocrlf=true). On a CRLF checkout the working copy is CRLF, and the parser strips a trailing CR either way. The CRLF case is therefore only exercised on CRLF checkouts. The tests still pass either way.
- T8: defaultSpawn runs `claude` without a shell. If `claude` is an npm .cmd shim on Windows it would not resolve, but no real claude run was done in this task. A test spy confirmed that dry-run does not call spawn.
- T10: G1 total is 1557 tests, not the 1514 in the BASELINE. The extra tests come from earlier E20 tasks already on the branch (T1-T9), not from this task. All gates exit 0 with no failures. Git printed a CRLF warning for make-scenario.test.mjs on commit; the index and working copy are LF, so this is only the autocrlf warning. The lint-plugin WARN is pre-existing and unrelated to this task. Single-line JSON check of the adopt script was done by the test, not by a separate parser.
- T11: Two commits instead of one: the first commit (1de5c57) had a misplaced row, fixed in 5a53f31 with the same E20 T11 prefix, not amended. G5 reports 51 OK, 1 WARN (plan-coordinator/references/delegation-protocol.md links state.md, outside this task's files); exit 0, matching the baseline. Only one test was run, the independence file; the plan does not add a README test.
- T12: Findings the report records and this task did not fix. Each fix belongs to the owning task, and the plan says the affected criterion's runs are then repeated.
  1. Criterion 4 failed in both runs (c4 and c4b). The SKILL.md approval step was never exercised: no approval question was written and `## Adoção` appeared only in Bash output. Both runs also used the existing roadmap-sandbox-E5 spec instead of dispatching spec-author when the old plan cited a missing spec. The provisional file name differed between the two runs. In c4b the adopted plan changed tasks against the request, and its Adoção section contradicts itself. Owners: Task 4 (SKILL.md) and Task 3 (agent).
  2. plan-author copies `mode` into the data block, but plan-tool's `TOP` list lacks `mode`. Every generated plan therefore gets a `field-unknown mode` warning (exit 0). The plan/1 schema is not editable, so the fix is for the agent to stop copying `mode`, or for the owner to accept the warning. Owner: Task 3 or Task 2.
  3. The main `claude -p` session loaded the owner's global CLAUDE.md and passed `model: sonnet` to the agent in two runs (c1-1 and c1-3). I recorded both as failures and reran them with a harness instruction not to override the model. That limit is in the measurement environment, not in the shipped files.
  4. The skill does not say to dispatch in the foreground: in c4b the Agent tool answered "Async agent launched".
  5. The `--lang` default (`pt` if the person writes Portuguese) is ambiguous: the c2 summary came out in Portuguese for an English prompt, because the session loaded the owner's Portuguese CLAUDE.md.
  6. The plan's "lista de ambiguidades do SKILL.md" check has no counterpart in the current SKILL.md, so I did not run it.
  7. The sonnet review ran as `claude -p` with `--permission-mode plan` and a read-only tool allowlist, not as a named subagent.
- T12:quality fix1: 1. I did not re-run behavioral criterion 4. It needs a `claude -p` session with the Agent tool, which only the main-session orchestrator has. That session also needs a new report entry, and I did not edit the report, since it is Task 12's own file.
  2. The F4-1 fix covers the missing-tool case, but under `claude -p` it makes the skill stop at `APPROVAL QUESTION:`. The harness instruction that supplies the synthetic "approve" answer has to answer that text, for example in a second turn. Whether the scripted answer then gets applied is for the next run to show.
  3. Spec line 104 and plan line 20 write the provisional name as `<old plan>.adopted.md`. My reading, `plan.md` becomes `plan.adopted.md`, is a clarification and not a change. If the owner meant `plan.md.adopted.md`, one sentence in SKILL.md changes.
  4. The report's F4-1 to F4-4 and AV-1 text now describes the pre-fix behavior. The orchestrator should add a note after the re-run, since I did not touch that file.
  5. Edit warns that LF will become CRLF at the next touch. Both files were written back with their original line endings. `git status` is clean.
- final fix1: Item 2: plan-writer SKILL.md adoption step 1 now dispatches productivity-tools:spec-author in the foreground with mode: interactive, output (absolute), specTool (absolute), topic, language and intake last. A new test in independence.test.mjs checks that every one of those fields is present. I ran only independence.test.mjs and the lint (G5), not the full G1 suite. The commit is "E20 final-fix: plan-writer adoption passes spec-author its required fields". The working tree is clean. The text change itself has no behavioral run yet, so the repeated adoption run in items 1 and 3 should also exercise the spec-author dispatch (F4-2).
  Items 1 and 3: not applied. Both need the criterion 1, 2 and 4 behavioral runs repeated on HEAD text. Those runs dispatch subagents, so under DEC-204 the main-session orchestrator has to run them. The docs/reports/2026-11-12-E20-autor-plano-comportamental.md report then needs the new runs appended without deleting the old ones, followed by an adversarial review. I did not write run results into the report because that would be fabricated evidence.

## Gates

Gates de G1 a G5 rodaram localmente nas tarefas; os resultados constam nas concerns acima (T4, T5, T10, T11: saídas 0, sem falhas, com os avisos pré-existentes citados). Nenhum gate foi reexecutado após a correção final (só independence.test.mjs e G5).

## Entradas humanas

| O quê | Bloqueia | Alternativa |
|---|---|---|
| Conferência do dono dos resultados das execuções comportamentais dos critérios 1, 2 e 4 ({verify: human}) em docs/reports/2026-11-12-E20-autor-plano-comportamental.md | não | As execuções e o relatório são produzidos pelo entregável; nenhum aceite fictício é registrado. |
| Execução paga da suíte de gatilho pelo dono e conferência do resultado registrado em docs/reports/ (critério 5, DEC-025) | não | A suíte, o executor com --dry-run e os testes são entregues; a rodada fica com o dono. |
| Ratificação das decisões de alcance contrato (1, 2, 4, 7 e 16) antes de E8 (DEC-030) | não | Ficam registradas como pendentes de origem executor. |

## Textos cortados no registro

Uma entrada por item de recordCuts. Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md. Destino: add-decision --decision.

### Corte 1 (decisão 1)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 1. O autor de plano é o agente plugins/productivity-tools/agents/plan-author.md, com model: opus, effort: medium (o do estágio Plan do release hoje) e tools: Read, Grep, Glob, Bash, Write, Edit, sem AskUserQuestion nem Agent. Opção descartada: sonnet. Base: card peça 1, DEC-057, DEC-404, REQ-013. Custo se errada: médio. Reversível.

### Corte 2 (decisão 2)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 2. Contrato de chamada do plan-author: mode (unattended, interactive, adopt), output e planTool e spec absolutos, language, roadmap em todos os modos (pasta relativa terminada em /, ou null, gravada literal no bloco), card (autônomo), source (adoção), e a nota (ownerNote ou intake) como último campo, com várias linhas; nunca commita; última mensagem é a saída literal de plan-tool emit, ou a do último check --json depois de três execuções. Base: DEC-421, DEC-405, DEC-406. Custo se errada: médio (E8 consome). Reversível.

### Corte 3 (decisão 4)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 4. Um plano adotado sem spec spec/1 ganha um spec escrito por spec-author em docs/plans/<tópico>/spec.md, cujo resumo entra na aprovação única da adoção; o plano fica onde está, com spec relativo. Opção descartada: exigir um spec antes de adotar. Base: plan-tool exige spec válido (DEC-180), DEC-026, DEC-018. Custo se errada: médio. Reversível.

### Corte 4 (decisão 12)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 12. As execuções comportamentais são sessões claude -p lançadas pelo orquestrador da sessão principal com o plugin da worktree (--plugin-dir), opus, bypassPermissions, que despacham os agentes por nome, sem forma de reserva; a pendência de E19 (DEC-400) roda junto. Opção descartada: forma de reserva com o corpo colado. Base: DEC-204, instrução do dono. Custo se errada: baixo. Reversível.

### Corte 5 (decisão 13)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 13. O cenário dos critérios 1 e 4 entra por uma variante nova plan-author de make-scenario.mjs, com spec spec/1 escrito à mão e o plano em prosa do E5 do sandbox posto numa pasta da versão anterior; o roadmap de make-sandbox.mjs não muda. Base: DEC-301, DEC-413. Custo se errada: baixo. Reversível.

### Corte 6 (decisão 16)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: add-decision --decision
- Texto completo: 16. plan-writer resolve a pasta do roadmap antes de despachar, sem perguntar, nesta ordem: --roadmap <pasta> da chamada, a linha **Roadmap:** do plano antigo (adoção), a pasta do spec <nome>-E<n> (docs/plans/<nome>/ ou docs/plans/roadmap-<nome>/, com roadmap.config.json, id igual a E<n> e spec-tool check --roadmap em 0), senão null; um ponteiro achado e recusado vira null com o motivo no relato e na aprovação da adoção; o planner passa --roadmap explícito. Opção descartada: aceitar roadmap só no modo autônomo. Base: DEC-026, DEC-018, delegation-protocol.md do coordinator (plan.roadmap). Custo se errada: médio. Reversível.

### Corte 7 (bloqueio aberto, registro blocked-record)

- Origem: docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md
- Entrou em: block-open --what
- Texto completo: E20 bloqueado: automatic execution stopped (conteudo): final: fix BLOCKED: I changed nothing and made no commit. Items 1 to 4 (two pairs of duplicates) need new behavioral runs of criteria 1, 2 and 4 on HEAD, followed by an adversarial review. The owner instruction (DEC-204) sends behavioral runs that need a subagent tool back to the main-session orchestrator, and this subagent has no Agent/Task tool, so it cannot dispatch plan-writer, spec-author or ; branch feat/E20 kept at D:/projects/claude-play-wt/E20

## Execução do estágio blocked-record

Nesta execução o registro foi refeito com os mesmos dados de revisões, tarefas, concerns, riscos aceitos e entradas humanas já transcritos acima, que permanecem inalterados. O que esta execução acrescenta: o Corte 7 (texto cortado ao abrir o bloqueio de E20) e o resultado final "falhou", com a branch feat/E20 mantida em D:/projects/claude-play-wt/E20.
