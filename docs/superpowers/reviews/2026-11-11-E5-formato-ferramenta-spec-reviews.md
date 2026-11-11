# E5: formato da ferramenta spec, registro de revisões

Execução de 2026-11-11 (branch `feat/E5`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, - | nenhum | 0 | nenhuma |
| plan | 1: opus, - | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, - | nenhum | 3 | nenhuma |
| T4:spec | 1: sonnet, -; 2: sonnet, sonnet | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, - | nenhum | 2 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T6:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| final | 1: opus, - | nenhum | 3 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | leitor de bloco de dados (lib/data-block.mjs) | DONE | 1 |
| 2 | spec de exemplo e roadmap mínimo | DONE | 1 |
| 3 | esquema spec/1 e check sem roadmap (critério 2) | DONE | 1 |
| 4 | check --roadmap contra o card (critério 1) | DONE | 2 |
| 5 | emit e summary | DONE | 1 |
| 6 | lint de agentes e scripts (critério 3) | DONE | 1 |
| 7 | documentação e gates | DONE | 1 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados)

- T3: Decisões autônomas, todas pelo desenho do spec: (1) ruling-incomplete é um erro por ruling, listando todos os campos ruins na mensagem. (2) "workaround" é obrigatório como string em todo needsPerson, e "blq" é opcional. (3) O ref de field-unknown é o caminho do campo, por exemplo rulings[1].zzz. (4) schema ausente gera field-missing; schema com outro valor gera schema-version. (5) A CLI rejeita a opção --roadmap com exit 2 nesta tarefa, e a Task 4 a adiciona. (6) O teste da CLI sem --roadmap espera apenas "Result: 0 errors", como o plano pede.
- T4:spec fix1: The committed test was not quite as the finding described. The card side held precomposed NFC (bytes 303 247) and the spec side held decomposed NFD (314 247), so the directions were swapped and nothing exercised NFC vs NFD. I fixed it to match the plan: the card side is NFD and the spec side is NFC, both as literal characters in the file. Normalization is applied in two places, data-block.mjs norm for the card and roadmap-format.mjs norm for the roadmap, and each one alone is enough to make the test pass. The test therefore fails only if both are removed. I left that as is, since splitting it would need a new test the plan does not call for.
- T5: G2 e G3 (claude plugin validate) não foram rodados: a tarefa só toca scripts e testes, sem manifestos. Os exits baseline eram 0 e nada em manifesto mudou.
- T6: I did not run the full G1 suite. Per the plan it runs in Task 7, and I ran only the task's own test file. I also did not run G3 or G4, which this task does not affect. The new `lint-plugin.mjs` code is LF in the working copy and git warns it will convert to CRLF, as with the existing files.
- T7: Task 7 is text-only, so no new failing test was written first; the TDD cycle is covered by the plan's existing tests (AC3 lint tests from T6, included in G1). Note the plan asked for the lib/ line to cite data-block.mjs; I described it as imported (not embedded) because embed.mjs only embeds roadmap-format.mjs. The plan's validate-plugin marketplace-tools check was run as an extra and passed.

## Gates

O relatório não traz resultado estruturado de gates nesta execução; as menções a gates estão nos concerns acima (T5, T6, T7).

## Entradas humanas

Nenhuma entrada humana registrada.
