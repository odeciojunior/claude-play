# E22: tracker enxuto e rubricas, registro de revisões

Execução de 2026-11-11 (branch `feat/E22`). Resultado: falha da execução por entrada humana bloqueante. Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). "Menores" é a contagem de problemas menores. Só o estágio spec foi executado; plano e execução ficaram parados.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, correção opus | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Falha da execução

blocking human input: Ratificação pelo dono das decisões de alcance contrato de E3 em que E22 se apoia (DEC-136, DEC-137, DEC-138, DEC-139, DEC-143, DEC-145, DEC-146, DEC-148, DEC-149, DEC-150, DEC-153), exigida por DEC-030 antes de um dependente começar; state.md: 'seguram o início de E18 e E22'. Mesmo caso de BLQ-2 para E18.

## Concerns

Nenhum registrado.

## Gates

O relatório não traz resultado de gates: nenhum gate foi rodado, pois a execução parou antes do plano.

## Entradas humanas

### 1. Ratificação das decisões de alcance contrato de E3 (bloqueante)
- O quê: Ratificação pelo dono das decisões de alcance contrato de E3 em que E22 se apoia (DEC-136, DEC-137, DEC-138, DEC-139, DEC-143, DEC-145, DEC-146, DEC-148, DEC-149, DEC-150, DEC-153), exigida por DEC-030 antes de um dependente começar; state.md: 'seguram o início de E18 e E22'. Mesmo caso de BLQ-2 para E18.
- Bloqueia: sim.
- Workaround: Nenhum: plano e execução de E22 ficam parados; o spec pode ser revisado. Ao chegar ao plano com alguma pendente, registrar o bloqueio no alvo no molde de BLQ-2. Se alguma for rejeitada, revisar o spec conforme a tabela da seção 'Pré-condição bloqueante'.

### 2. Aceite dos critérios 2 e 3 (verify: human)
- O quê: Aceite dos critérios 2 e 3 (verify: human): o dono confere o relatório docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md.
- Bloqueia: não.
- Workaround: O executor entrega o relatório com 'aceite: aguardando o dono'; não bloqueia o código.

### 3. Registro da meta derivada de prosa na estratégia
- O quê: Registro da meta derivada de prosa (29.096 bytes LF) na estratégia, por revisão proposta pelo tracker depois de E15 e gravada só com aprovação do dono (DEC-034, DEC-098).
- Bloqueia: não.
- Workaround: O teste usa a constante declarada no spec; se a revisão registrar outro valor, a constante segue a estratégia.

### 4. Ratificação das decisões autônomas de E22 (DEC-030)
- O quê: Ratificação pelo dono das decisões autônomas de E22 (DEC-030): as de alcance contrato (1, 2 e 3) seguram o início de E7 e E20; as locais em lote no ponto de medição.
- Bloqueia: não.
- Workaround: Não impede a entrega de E22.

---

# Execução 2 (2026-11-11, branch `feat/E22`)

Resultado: falha. As tarefas 1 a 7 foram entregues; a tarefa 8 ficou BLOQUEADA. O registro acima é o da execução anterior e foi mantido sem alteração.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). "Menores" é a contagem de problemas menores.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, - | nenhum | 4 | nenhuma |
| plan | 1: opus, -; 2: opus, correção sonnet | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, -; 2: sonnet, correção sonnet | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 2 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T6:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T7:spec | 1: sonnet, - | nenhum | 2 | nenhuma |
| T7:quality | 1: sonnet, - | nenhum | 1 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| Tarefa | Título | Status | Commits |
|---|---|---|---|
| 1 | divisão de events.md em 20 receitas e teste do índice | DONE | 3 |
| 2 | rubrica de contradição e receitas de decisão (§ 1, § 18) | DONE | 1 |
| 3 | rubrica de critérios e receitas § 17, § 19, § 20 | DONE | 2 |
| 4 | receitas § 2, § 3, § 4, § 5 pela CLI | DONE | 1 |
| 5 | receitas § 10, § 11, § 15, § 16 | DONE | 1 |
| 6 | receitas sem comando (§ 6, § 7, § 8, § 9) e § 12, § 13, § 14 | DONE | 2 |
| 7 | SKILL.md enxuto, Common enxuto e orçamento de prosa (critério 1) | DONE | 1 |
| 8 | (sem título no relatório) | BLOCKED | 0 |

## Falha da execução

task 8 BLOCKED: Task 8 not executed. It consists of dispatching sonnet and opus subagents (Steps 2-5) and having the orchestrator write the report. The plan and the owner instruction assign it to the main-session orchestrator (DEC-204), and the plan says it must never be simulated. This executor has no subagent-spawning tool. I changed nothing, committed nothing, and created no temporary files.

## Concerns

- T2: I did not run G2, G3 or G4. The task only listed G1 and G5, and only Markdown under references/ changed. The 4 lint WARNs in G5 were not inspected, though the lint exited 0. In the § 18 recipe I made one call beyond the plan text: an item that exists only as pending has no DEC id, so ratify cannot drop it, and the recipe tells the executor to remove it by hand.
- T3: Autonomous choices, all recorded here. (1) In § 17 the acceptance segment is created with set-status --piece acceptance at word `executing`, because block-open --piece needs an existing segment and block-close restores that word. This choice is not in the spec and the owner should confirm it. (2) The § 19 pending text is "card says <A>, spec says <B>: confirm (<class>)", with the owner passed through --owner owner. (3) § 20 keeps the original rule that under `no questions` the no-piece case overrides steps 3 and 4. I did not run the CLI end to end against a fixture, since that belongs to the behavioral task for the main-session orchestrator (DEC-204). I only checked the command options against the usage text and the source of roadmap.mjs.
- T3:quality fix1: The first run of the G4 and G5 commands failed with a bad path, because my cd had gone one directory too deep. I reran both from the worktree root and they passed. I did not run `claude plugin validate .` (G2), which is unaffected by this docs-only change.
- T5: Two judgment calls. (1) § 15 calls inflight-add for the release branch with a note, which the plan lists for § 15 but does not detail. (2) § 15 keeps `git cat-file -e` for the merge SHA, because verify-commit only checks the integration branch.
- T6: The prose-budget test passes 6 of 6, but the plan only fully exercises the budget in Task 7, so the per-event load of recipes 6 to 9 and 12 to 14 is not yet checked. To keep the load small I cited only `formats.md § 7` and `§ 8` in recipes 6 to 8 and `§ 5` in recipe 9. I dropped the § 2 and § 5 citations that would have been heavy. The plan's test commands never run G2 or G3 for this task, and I did not run them either. Git printed only the LF-to-CRLF working-copy warning when I committed.
- T8: The orchestrator of the main session must run Task 8 on feat/E22 (HEAD 136695a). Steps: (1) copy fixtures/valid to docs/reports/2026-11-11-e22-rubricas/pasta/, write a README marking it synthetic, and write spec-enfraquecido.md; (2) run the criterion 2 subagent (sonnet, medium); (3) run the criterion 3 subagent (sonnet); (4) run the lean-flow subagent (sonnet), then check-roadmap on pasta; (5) run the opus adversarial review; (6) write the report; (7) run G1-G5; (8) commit "E22 T8: ...". Acceptance for criteria 2 and 3 stays with the owner and is not recorded.

## Gates

O relatório desta execução não traz resultado consolidado de gates. Os concerns acima registram o que foi dito por tarefa: G1 e G5 listados em T2 (G5 com 4 WARNs de lint, exit 0, não inspecionados); G4 e G5 de T3 reexecutados com sucesso após correção de caminho; G2 não rodado em T2, T3 e T6; G3 não rodado em T2 e T6; G1 a G5 da tarefa 8 não rodados (tarefa não executada).

## Entradas humanas

### 1. Aceite dos critérios 2 e 3 (verify: human)
- O quê: o dono confere o relatório docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md produzido pelo orquestrador da sessão principal (DEC-204).
- Bloqueia: não.
- Workaround: O relatório é entregue com 'aceite: aguardando o dono'; não bloqueia o código.

### 2. Registro da meta derivada de prosa (29.096 bytes LF) na estratégia
- O quê: por revisão proposta pelo tracker depois de E15 e aprovada pelo dono (DEC-034, DEC-098).
- Bloqueia: não.
- Workaround: O teste usa a constante do spec; critério 1 fica parcialmente atendido até o registro (decisão 14, molde de DEC-203).

### 3. Ratificação das decisões autônomas de E22 (DEC-030)
- O quê: as de alcance contrato (1, 2, 3) seguram o início de E7 e E20; as locais em lote no ponto de medição.
- Bloqueia: não.
- Workaround: Não impede a entrega de E22.

### 4. Ratificação das decisões de alcance contrato de E3 em que E22 se apoia
- O quê: DEC-136, DEC-137, DEC-138, DEC-139, DEC-143, DEC-145, DEC-146, DEC-148, DEC-149, DEC-150, DEC-153, exigida por DEC-030 antes de um dependente começar; state.md: 'seguram o início de E18 e E22'. Mesmo caso de BLQ-2 para E18. (O spec registra como respondida pelo dono em 2026-11-11, emendas DEC-200 a DEC-202, DEC-209; BLQ-3 fechado; deixa de bloquear.)
- Bloqueia: sim (conforme o campo `blocking` nos dados).
- Workaround: Nenhum: plano e execução de E22 ficam parados; o spec pode ser revisado. Ao chegar ao plano com alguma pendente, registrar o bloqueio no alvo no molde de BLQ-2. Se alguma for rejeitada, revisar o spec conforme a tabela da seção 'Pré-condição bloqueante'.

### 5. Aceite dos critérios 2 e 3 (verify: human), repetição nos dados
- O quê: o dono confere o relatório docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md. O orquestrador da sessão principal entrega o relatório (DEC-204) com 'aceite: aguardando o dono'.
- Bloqueia: não.
- Workaround: O executor entrega o relatório com 'aceite: aguardando o dono'; não bloqueia o código.

### 6. Registro da meta derivada de prosa, repetição nos dados
- O quê: meta de 29.096 bytes LF na estratégia, por revisão proposta pelo tracker depois de E15 e gravada só com aprovação do dono (DEC-034, DEC-098).
- Bloqueia: não.
- Workaround: O teste usa a constante declarada no spec; se a revisão registrar outro valor, a constante segue a estratégia. Critério 1 fica parcialmente atendido até lá (decisão 14).

### 7. Ratificação das decisões autônomas de E22, repetição nos dados
- O quê: ratificação pelo dono das decisões autônomas de E22 (DEC-030): as de alcance contrato (1, 2 e 3) seguram o início de E7 e E20; as locais em lote no ponto de medição.
- Bloqueia: não.
- Workaround: Não impede a entrega de E22.
