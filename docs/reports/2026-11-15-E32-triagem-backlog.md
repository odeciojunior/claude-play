# Triagem do backlog do executor (E32)

Data: 2026-11-15. Branch `feat/E32`, criada de `release/pos-2.2.0`. Aceitação humana do relatório: H1 (o dono confere depois do merge).

Universo: 47 notas, 17 de SRC-02 (`docs/plans/roadmap-evolucao-skills/state.md`, seção Pendentes, na ordem do arquivo) e 30 de SRC-03 (`docs/reports/2026-11-13-pendencias-por-entregavel.md`, na ordem das seções). Cada nota foi conferida contra o código do worktree e contra `decisions.md` e `log.md` de `docs/plans/roadmap-evolucao-skills/` (só leitura). A coluna Nota traz o início literal da nota, cortado em `…`.

Commits de `feat/E32` citados: T1 `7f0323d` (modo `procs`), T2 `e0def99` (limpeza pelo `procs`), T3 `1f5df47` (coordinator, passo retomado), T4 `ae90217` (plan-author, emit enxuto), T5 `2ec31c6` (tracker, `status --deliverable`).

Regras de leitura: `obsoleta` leva prova (hash, DEC do log anterior, ou arquivo e linha); `corrigida` leva o hash em `feat/E32` e o teste; `pendente` leva dono (executor, dono, E29, E30, E31 ou E33) e destino (card deste roadmap ou roadmap futuro). Nota com várias partes só é corrigida quando toda parte está corrigida ou obsoleta (R9). Notas do arnês `tools/measure` vão a E30 ou E31 (R5). Nota válida e pequena fora das Tarefas 1 a 5, ou que exige arquivo que E29 altera, fica pendente com dono executor e destino roadmap futuro (R7, R8).

## SRC-02 (state.md, 17 notas)

| Id | Nota | Situação | Prova |
|---|---|---|---|
| S2-01 | (executor) Planner e tracker: a cópia do checker a partir do cache é negada no modo padrão (achado 2 de E15). Trocar o cp por… | pendente | Dono executor, destino roadmap futuro. `roadmap.mjs` não tem subcomando que grave a cópia do checker (busca por `cp`/cópia sem resultado em `roadmap-tracker/SKILL.md` e `roadmap.mjs`); exige CLI e skills, mais de uma tarefa. |
| S2-02 | (dono) Depois da publicação: sair da conta em D:\claude-e17-cfg e só então apagar a pasta; apagar D:\claude-e17-work e o clon… | pendente | Dono dono, destino E33 (a publicação). Ato do dono fora do repositório. |
| S2-03 | (executor) DEC-571/573: T3 de E23 r1 (vermelho por \| grep, exit do grep) é o caso 1 de 2 de testFirstGap em tarefa legítima… | pendente | Dono executor, destino roadmap futuro. A nota espera um 2º caso para propor ao dono; nenhum caso novo foi visto aqui. |
| S2-04 | (executor) implementer.md: alinhar as linhas 23, 39 e 40 sobre o prefixo cd <worktree> && antes do comando (admitir ou proibir… | obsoleta | `plugins/productivity-tools/agents/implementer.md:17` proíbe o prefixo `cd <dir> &&`; linhas 27 e 44 trazem `\|\|` na lista de encadeamentos proibidos. |
| S2-05 | (executor) Lançar em measurements.md o custo devolvido pela CLI nas 3 execuções de E9 (DEC-567) e conferir o teto de US$ 150… | pendente | Dono executor, destino roadmap futuro. Lançamento de dados de medição antiga; sem objeto de código. |
| S2-06 | (executor) E13: 1 nota arquivada em docs/reports/2026-11-13-pendencias-por-entregavel.md (seção E13); ler no spec de E13. | obsoleta | Nota-ponteiro: as notas da seção E13 são S3-22 e S3-23 desta triagem, que as consomem. |
| S2-07 | (executor) E28 ou próxima edição do release workflow: 6 notas arquivadas em docs/reports/2026-11-13-pendencias-por-entregavel.md… | obsoleta | Nota-ponteiro: a seção de SRC-03 tem 7 notas (a nota diz 6), triadas em S3-24 a S3-30. |
| S2-08 | (executor) Achados menores da revisão de fix/status-releitura: recordVerdict com linha ausente diz has no panel em vez de no… | pendente | Dono executor, destino roadmap futuro (R9). A parte do `--deliverable` está corrigida em `2ec31c6` (teste `E32: SKILL.md names status --deliverable for one card`), mas a parte `recordVerdict` com linha ausente segue sem prova (`roadmap.mjs:641` e `:696` recusam com `deliverable-unknown`; a mensagem do segmento não foi conferida). |
| S2-09 | (executor) Achados menores de fix/registro-8k e da sessão C: relatório não diz que o check foi pulado por tamanho; mensagem… | pendente | Dono executor, destino roadmap futuro. Quatro achados em `roadmap-release.js` e skills, arquivo que E29 altera (R8). |
| S2-10 | (executor) Antes de outro lote com correcao-semeada: parentMention no CR do manifest (CR3 com o texto de C5), lido por mentio… | pendente | Dono E30, destino E30 (R5). `parentMention` não existe em `tools/measure` (busca sem resultado); é do arnês usado nos lotes. |
| S2-11 | (executor) Nota E11/E28: a retomada review-owed do coordinator manda (no checks reported) sem marca de retomada; a regra do … | corrigida | `1f5df47`; teste `E32: a review-owed step resumed without its report tells the reviewer it was resumed` (`plan-coordinator/workflow/flow.test.mjs`). |
| S2-12 | (executor) E28: auditoria das cópias por modelo (DEC-715) e notas de revisão (2bb59c6, 7ee7f23, reviews.md do 2º plan-only);… | pendente | Dono executor, destino roadmap futuro. Auditoria e notas de revisão sobre `roadmap-release.js` (arquivo de E29, no teto de DEC-647). |
| S2-13 | (executor) E28 ou fix próprio (2ª sonda, c5658cf): negações espontâneas sem parar o run: prompts com "; echo exit=$?" (spec-… | pendente | Dono executor, destino roadmap futuro (R9). A nota tem quatro partes. A parte 4 (limpeza que lista processos por PowerShell, tasklist e netstat) está corrigida em `7f0323d` (modo `procs`, testes `E32 procs: ...` em `verify-run.test.mjs`) e `e0def99` (teste `E32: the cleanup prompt ends processes through verify-run procs` em `cleanup.test.mjs`). Seguem sem commit e sem prova: (1) prompts que acrescentam "; echo exit=$?" (spec-commit, progress), (2) Grep na pasta de scripts do plugin (spec, plan), (3) `sed -i`. |
| S2-14 | (executor) 2.0.1: portões vazios, fullRef e worktree do implementador prontos em fix/2.0.1-pendencias (e2e6060, sobre feat/E2… | obsoleta | `git branch -a --contains e2e6060` lista `main` e `release/pos-2.2.0`: o commit já está integrado. |
| S2-15 | (executor) 2.0.1 (arnês, lote E11): gate-vazio aceitar "N tests, N pass, N fail"; teto de bytes do plan-only (DEC-763). Corr… | pendente | Dono E30, destino E30 (R5). O teto do plan-only já está decidido em DEC-763 (90.000), mas `coordinatorGateVazio` em `tools/measure/run-batch.mjs:1492` ainda lê só `# tests 0`/`# pass 0`, não o resumo "N tests, N pass, N fail". |
| S2-16 | (executor) E13: gatilho de DEC-773 disparou no lote de E16 (laço quality sem correção por tarefa nas 3 tentativas de comple… | pendente | Dono E30, destino E30 (C5: laço quality). |
| S2-17 | (executor) Entregável pós-2.2.0 (DEC-773, DEC-777, DEC-778): remover taskReview.single, medir revisor sonnet contra opus nas… | pendente | Dono E29 (remover `taskReview.single` e o texto do modo de revisão única), E30 (revisor sonnet contra opus, laço quality) e E31 (correção de parada-retomada); destino cards deste roadmap (C5). |

## SRC-03 (pendencias-por-entregavel.md, 30 notas)

| Id | Nota | Situação | Prova |
|---|---|---|---|
| S3-01 | (executor) Incerto, rever na preparação de E17 e na nota de E11: a receita de fixar a loja numa tag foi vista com fonte git l… | pendente | Dono dono, destino E33 (primeira tag publicada com a loja do GitHub). Exige loja real e sessão aberta, externo. |
| S3-02 | (executor) tools/measure: SANDBOX_RELEASE_RULES cita Workflow(productivity-tools:roadmap-release), nome antigo e inerte; tro… | pendente | Dono E30, destino E30 (R5). `tools/measure/make-scenario.mjs:56` já traz `Workflow(productivity-tools:release-workflow)`, mas mantém o nome antigo, e testes (`make-scenario.test.mjs:349`, `:499`) afirmam que ele fica. |
| S3-03 | (executor) Fora de E17: spec-review-atual.md não casa com o workflow em HEAD sob nenhuma normalização; checkpoint.mjs não o… | pendente | Dono E30, destino E30 (R5). Arnês `tools/measure`; `checkpoint.mjs` não referencia `spec-review-atual` (busca sem resultado), a nota segue sem fechamento. |
| S3-04 | (executor) E11: medir se specs do autor trazem critério que contradiz ruling ou caso de borda (AC6 do critério 2 de E19) ou… | pendente | Dono executor, destino roadmap futuro. Medição paga, vedada nesta branch (DEC-004). |
| S3-05 | (executor) Antes de E11: explicar por que coordinator variou com a skill idêntica (sonnet 2 para 3, bytes da sessão princip… | pendente | Dono executor, destino roadmap futuro. Análise de medição, vedada nesta branch (DEC-004). |
| S3-06 | (executor) E11, preparação: na config descartável, fixar o superpowers e desligar a atualização automática das lojas antes d… | pendente | Dono E30, destino E30 (R5). Preparo dos lotes pagos de E30 e E31. |
| S3-07 | (executor) baseline.mjs: a divergência de superpowers vira erro global e saída 1 mesmo com decisão do dono; avaliar registra… | pendente | Dono E30, destino E30 (R5). Arnês `tools/measure`. |
| S3-08 | (executor) Rever depois de E8: a retomada repete setup, progress e status-record (4 haiku a mais por execução em duas sessõe… | pendente | Dono E31, destino E31 (parada-retomada). Mexe em `roadmap-release.js` (E29, R8). |
| S3-09 | (executor) E11, preparação: tools/measure ainda espera os artefatos de E5 em docs/superpowers (make-scenario.mjs, E5_PATHS)… | pendente | Dono E30, destino E30 (R5). `make-scenario.mjs:31-33` ainda define `E5_PATHS` em `docs/superpowers/...`. |
| S3-10 | (executor) E20/gatilho: spec-3 (pt/en) passa direto a spec-author sem chamar Skill; a config descartável tem CLAUDE.md de us… | pendente | Dono E30, destino E30 (R5). Medição de gatilho no arnês. |
| S3-11 | (executor) E11: a variante parada-retomada mede a meta de E23 de ponta a ponta (opus 9 para 7, ponderado 669 para 589) com o… | obsoleta | O lote de E11 já mediu a variante parada-retomada: DEC-761 fixa o teto da parada-retomada (220.000) e DEC-763 registra o resultado do lote E11. |
| S3-12 | (executor) E11, preparo: fix/measure-e26 traz as sementes nativas de plano e os caminhos por artifactPaths só no arnês de es… | obsoleta | O lote de E11 rodou as variantes de pipeline (plan-only, completo, parada-retomada): DEC-761 e DEC-763; `NATIVE_SEEDS` e `RELEASE_RUN_VARIANTS` existem em `tools/measure/make-scenario.mjs` (importados em `make-scenario.test.mjs:9`). |
| S3-13 | (dono) Não bloqueia: o caminho com AskUserQuestion da adoção nunca foi exercido em sessão interativa; observar na primeira ad… | pendente | Dono dono, destino roadmap futuro. Observação em sessão interativa real. |
| S3-14 | (executor) E20/N5-1: no passo 3 da adoção do plan-writer, a mensagem de aprovação deve colar literais a seção ## Adoção, o -… | obsoleta | DEC-744: o lote de E11 usa a versão M "já com N5-1/N5-2 e P4 feitos"; DEC-458 só condicionava a publicação a essa correção. |
| S3-15 | (executor) E20/N5-2: no passo 4 do plan-author, valor que o plano antigo não declara (deps, score, effort, título encurtado)… | obsoleta | DEC-744 (N5-2 feito antes da versão M, junto com N5-1). |
| S3-16 | (executor) E20/cobertura: a adoção não exerceu a recusa (apaga o provisório, original intacto), o caminho com AskUserQuestio… | pendente | Dono executor, destino roadmap futuro. Conferência interativa de `claude -p`, fora desta branch (sem execução paga). |
| S3-17 | (dono) Correção pós-merge de N5-1 e N5-2 conferida antes de publicar plan-writer (DEC-458) | obsoleta | DEC-744 (correção feita antes de M) e `plan-writer` já publicado nas 2.x (`plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs`). |
| S3-18 | (executor) E20/cadeia: antes de publicar plan-writer, 1 execução claude -p de spec-writer e plan-writer com tópico <slug>-E<n>… | pendente | Dono executor, destino roadmap futuro. Execução `claude -p` paga; vedada nesta branch. |
| S3-19 | (executor) E25 F3: o lint não confere allowed-tools em commands/*.md nem em caminhos customizados do plugin.json; rever quan… | pendente | Dono executor, destino roadmap futuro. `lint-plugin.mjs:297-345` só confere SKILL.md; nenhum plugin ganhou `commands/` e o gatilho da nota não disparou. |
| S3-20 | (executor) E12: escolhas do executor de E7 fora do registro: portão de onda devido só sem passo aberto na onda; baseline.md… | pendente | Dono executor, destino roadmap futuro. Registro de escolhas de desenho do coordinator; muda estado e formato (fora do escopo). |
| S3-21 | (executor) E12: se a description do plan-coordinator mudar, rodar de novo os 3 casos plan-execution (pt e en) em opus antes … | pendente | Dono executor, destino roadmap futuro. Nota condicional: a description não mudou nesta branch. |
| S3-22 | (executor) Texto de model.md em E4 sem prazo de publicação: W3 (questions só para retomada), W7 (releaseBranch ausente) e a … | pendente | Dono executor, destino roadmap futuro. Três partes de texto sem conferência (R9). |
| S3-23 | (executor) Na execução real do coordinator, medir se a sessão lê plan.md antes do lançamento (B e C leram no comportamental … | pendente | Dono executor, destino roadmap futuro. Medição em execução real, vedada nesta branch. |
| S3-24 | (executor) E28: em task-reviewer.md, verdicts só no modo restrito e spec/quality só no modo review (ponto 2 do relatório com… | pendente | Dono E29, destino E29. Texto dos modos do `task-reviewer.md`, que E29 altera junto com a remoção do modo de revisão única (C5). |
| S3-25 | (executor) Achados menores do comportamental de E23 (fora do portão): sync lê "run after the merge" como argumento run do ke… | pendente | Dono executor, destino roadmap futuro. Quatro achados em `roadmap-release.js` e prompts (R8). |
| S3-26 | (executor) fix/carga-plano: resumeFromRunId de execução anterior à mudança, mesmo caminho de plugin, pode comparar emit comp… | pendente | Dono executor, destino roadmap futuro (R9). A parte `plan-author.md:40` está corrigida em `ae90217` (teste `E32: plan-author step 7 describes the lean emit`); a normalização em `authoredTask` ou o aviso em `operator.md` segue sem prova (busca por `authoredTask` e `plan-frozen-tasks` em `coordinator.js` e `operator.md` sem resultado). |
| S3-27 | (executor) Preflight/skill: diagnosticar "not found" do lançamento pelo nome como script acima de 512 KiB (docs/reports/2026… | pendente | Dono executor, destino roadmap futuro. `preflight.mjs` e `roadmap-release/SKILL.md` não citam o limite de 512 KiB (busca sem resultado); `preflight.mjs` é arquivo de E29 (R8). |
| S3-28 | (executor) Defeito baixo (comportamental de E10): runPrompt (roadmap-release.js:1434) termina com BASH_ONLY, que pede lista … | pendente | Dono executor, destino roadmap futuro. Segue válido em `roadmap-release.js:1455-1458` (`BASH_ONLY` pede lista vazia com `no-bash`); testes de `flow.test.mjs` afirmam o comportamento atual e E29 os altera (R8). |
| S3-29 | (executor) Próxima edição de roadmap-release.js (E28 ou fix): erro determinístico do script de descoberta ({ tool, error })… | pendente | Dono executor, destino roadmap futuro. Segue válido: `readDisc` em `roadmap-release.js:1482`; mesmo arquivo e testes de E29 (R8). |
| S3-30 | (executor) run-record approve leva prep.baseline num argumento só (roadmap-release.js:1069 e 2088), sem guarda de tamanho; … | pendente | Dono executor, destino roadmap futuro. Sem guarda de tamanho no código (busca por `prep.baseline` com limite sem resultado); arquivo de E29 (R8). |

## Quadro final

| Fonte | Linhas | obsoleta | corrigida | pendente |
|---|---|---|---|---|
| SRC-02 | 17 | 4 | 1 | 12 |
| SRC-03 | 30 | 5 | 0 | 25 |
| Total | 47 | 9 | 1 | 37 |

9 + 1 + 37 = 47. Nenhuma nota corrigida sem commit e nenhuma obsoleta sem prova. Correções de código ou texto desta branch: quatro (`procs` com a limpeza, T3, T4, T5), dentro do teto de oito (R4). `procs`, T4 e T5 corrigem só uma parte de S2-13, S3-26 e S2-08, que por isso seguem pendentes (R9).

## Pendências com dono

- E29: S2-17 (parte `single`), S3-24.
- E30: S2-10, S2-15, S2-16, S2-17 (revisor sonnet contra opus, laço quality), S3-02, S3-03, S3-06, S3-07, S3-09, S3-10.
- E31: S2-17 (parada-retomada), S3-08.
- E33: S2-02, S3-01 (dono).
- Dono, roadmap futuro: S3-13.
- Executor, roadmap futuro: as demais pendentes (S2-01, S2-03, S2-05, S2-08, S2-09, S2-12, S2-13 (partes 1 a 3), S3-04, S3-05, S3-16, S3-18 a S3-23, S3-25 a S3-30).

## Adendo de aceitação (2026-11-17)

Critério 1 de E32 aceito pelo dono via Fable (DEC-006 do roadmap pos-2.2.0). As 47 linhas foram recontadas por script e conferem com o quadro e com as fontes (17 e 30 notas). Três linhas mudam depois da data do relatório:

| Id | Situação nova | Prova |
|---|---|---|
| S2-02 | obsoleta (feita) | Config deslogada e pastas apagadas (informado pelo orquestrador); em 2026-11-17 `Test-Path` devolve False para `D:\claude-e17-cfg`, `D:\claude-e17-work` e `D:\claude-e17-srv`. Não vai para E33. |
| S2-17 | pendente, dono E30 e E31 | A parte de E29 (remover `taskReview.single`) fechou no merge `a563e48`. Seguem as partes de E30 e E31 (R9). |
| S3-24 | pendente, dono executor, depois do lote de E30 | E29 não trouxe a linha: o diff de `a563e48` em `plugins/productivity-tools/agents/task-reviewer.md` só troca a ligação ao release e tira a frase do achado do script. A linha toca os modos `spec` e `quality`, que o lote de E30 mede. |

Quadro corrigido: SRC-02 com 5 obsoletas, 1 corrigida e 11 pendentes; total 10 obsoletas, 1 corrigida e 36 pendentes (47). Pendências com dono: E29 sem nenhuma; E33 só com S3-01.
