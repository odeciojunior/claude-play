# E19: autor de spec e skill interativa, registro de revisões

Execução de 2026-11-12 (branch `feat/E19`). A execução falhou na tarefa 6 (ver "Falha da execução"). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, opus | nenhum | 1 | nenhuma |
| plan | 1: opus, - | nenhum | 1 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T3:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | regra de lint que acusa subagent_type em workflow registrado (DEC-057) | DONE | 1 |
| 2 | card E6 com credencial e variante spec-author do cenário | DONE | 1 |
| 3 | agente spec-author (peça 1) | DONE | 1 |
| 4 | skill interativa spec-writer (peça 2) | DONE | 1 |
| 5 | documentação (README do plugin e CLAUDE.md) | DONE | 1 |
| 6 | execuções comportamentais (critérios 1 e 2) | BLOCKED | 0 |

Falha da execução: task 6 BLOCKED: Task 6 was not run. It needs a subagent tool to dispatch the spec-author agent, and this session has none. The plan says that in this case the task goes back to the orchestrator of the main session (DEC-204) and is never simulated. I created no sandboxes, no report and no commit.

## Concerns (transcritos como registrados)

- the "executing" roadmap record failed (command 2 (log) is missing from the runs; command 3 (add-decision) is missing from the runs; command 4 (add-decision) is missing from the runs; command 5 (add-decision) is missing from the runs; command 6 (add-decision) is missing from the runs; command 7 (add-decision) is missing from the runs; command 8 (add-decision) is missing from the runs; command 9 (add-decision) is missing from the runs; command 10 (add-decision) is missing from the runs; command 11 (add-decision) is missing from the runs; command 12 (add-decision) is missing from the runs; command 13 (add-decision) is missing from the runs; command 14 (add-decision) is missing from the runs; command 15 (add-decision) is missing from the runs; command 16 (add-decision) is missing from the runs; command 17 (add-decision) is missing from the runs; command 18 (add-decision) is missing from the runs; command 19 (add-pending) is missing from the runs; command 20 (add-pending) is missing from the runs; command 21 (add-pending) is missing from the runs; command 22 (inflight-add) is missing from the runs; reread status --json is missing or has no panel; reread brief --json is missing or is not JSON of the CLI); decisions and the in-flight entry are not recorded yet
- T2: The checker for the sandbox needed only the two blocks the plan named (requirements and panel), so no extra block was added for E6. The spec/1 check rejects `blq: null` ("blq deve ser BLQ-<n>"), so the third E19 test omits `blq` from needsPerson H1. The G2, G3 and extra validate exit codes were read from a pipe into `tail`, so the 0 shown is the pipe's; the validators printed "Validation passed".
- T4: The plan's refusals test regex `/node "[^"]*spec-tool[^"]*" (summary|check)/` cannot match the quoted form `node "<specTool>" summary` that Task 3 uses. The plan allows "the same quoted form as Task 3", so I widened the regex to `/node "(<specTool>|[^"]*spec-tool[^"]*)" (summary|check)/`. The assertion is otherwise unchanged. The version stays at 1.7.0, as the plan requires.
- T5: O aviso ICON_MISSING do validador de diretório de plugin aparece em G3 e no extra de marketplace-tools; é pré-existente, porque plugin.json não foi alterado. Não bloqueia (exit 0). A tarefa não tratou ícone.
- T6: The plan (Restrições globais and Tarefa 6) says Task 6 must be done by the orchestrator of the main session (DEC-204). Its steps 2 to 4 need a subagent tool: three spec-author runs in opus at effort medium, one interactive run, and one read-only adversarial review in sonnet. The workflow executor has no such tool. The orchestrator should run Task 6 itself. Tasks 1 to 5 are committed on feat/E19 (HEAD a1c5904) and the working tree is clean.

## Gates

O relatório não traz resultado estruturado de gates nesta execução; as menções a gates estão nos concerns acima (T2: G2, G3 e validate extra com "Validation passed", exit lido de um pipe para `tail`; T5: G3 e extra de marketplace-tools com aviso ICON_MISSING pré-existente, exit 0).

## Entradas humanas

| O quê | Bloqueia | Alternativa (workaround) |
|---|---|---|
| Conferência do dono dos resultados das execuções comportamentais (critérios 1 e 2, verify: human) registrados em docs/reports/2026-11-12-E19-autor-spec-comportamental.md; nenhum aceite fictício é registrado. | não | As execuções e o relatório são produzidos pelo entregável; o aceite fica pendente com o dono. |
| Ratificação das decisões de alcance contrato (1, 2, 3, 8 e 9) antes de E8 e E20 começarem (DEC-030). | não | Decisões registradas como pendentes (origem executor); E19 segue. |
| Respostas da rodada de perguntas e aprovação do critério 2 vêm de um roteiro sintético marcado (tools/measure/scenario/spec-writer-request.md), não de uma pessoa; a credencial do critério 1 é só o nome REPORT_STORE_TOKEN, sem valor real. | não | Fixture sintética marcada; nenhuma credencial real é necessária. |

## Textos cortados no registro

Itens que o registro do roadmap cortou; texto completo transcrito aqui. Cada entrada traz a origem (source) e onde entrou (where).

### 1. Origem: docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md; entrou em: add-decision --decision

1. O autor é o agente plugins/productivity-tools/agents/spec-author.md, com model: opus, effort: medium e tools: Read, Grep, Glob, Bash, Write, Edit, sem AskUserQuestion nem Agent. Base: DEC-057, SRC-08 B1 e B5, REQ-013, nível T2 do dono para spec. Custo se errada: médio. Reversível.

### 2. Origem: docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md; entrou em: add-decision --decision

2. Contrato de chamada do agente: campos mode, output, specTool (caminho absoluto passado pelo chamador), language, roadmap e card (autônomo), ownerNote, topic e intake (interativo); última mensagem é a saída literal de spec-tool emit, ou a de check --json se a checagem ainda falhar depois de três execuções. Base: DEC-125, DEC-060, SRC-08 B2. Custo se errada: médio. Reversível.

### 3. Origem: docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md; entrou em: add-decision --decision

11. Critério 1 com três execuções e critério 2 com uma, como tarefas do orquestrador da sessão principal, no tier opus/medium do autor, com relatório em docs/reports/2026-11-12-E19-autor-spec-comportamental.md escrito pelo orquestrador. Base: DEC-204, DEC-174, regra de skills (SRC-03). Custo se errada: baixo. Reversível.

### 4. Origem: docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md; entrou em: add-decision --decision

16. Na execução do critério 2, o orquestrador da sessão principal conduz a skill spec-writer ele mesmo e despacha spec-author (forma do plugin, ou a de reserva do critério 1), com perguntas e aprovação gravadas literais no relatório e respondidas pelo roteiro sintético, sem AskUserQuestion; o relatório diz qual forma rodou. Opção descartada: subagent no papel da pessoa com o orquestrador despachando o autor. Base: limite de subagent aninhado (o mesmo de DEC-204), proibição de perguntar no workflow. Custo se errada: baixo. Reversível.

### 5. Origem: docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md; entrou em: block-open --what

E19 bloqueado: automatic execution stopped (conteudo): task 6 BLOCKED: Task 6 was not run. It needs a subagent tool to dispatch the spec-author agent, and this session has none. The plan says that in this case the task goes back to the orchestrator of the main session (DEC-204) and is never simulated. I created no sandboxes, no report and no commit.; branch feat/E19 kept at D:/projects/claude-play-wt/E19
