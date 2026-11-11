# E15: linha de base e detecção, registro de revisões

Execução de 2026-11-11 (branch `feat/E15`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, correção opus | nenhum | 0 | nenhuma |
| plan | 1: opus, - | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, -; 2: sonnet, correção sonnet | nenhum | 0 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T5:quality | 1: sonnet, -; 2: sonnet, correção sonnet | nenhum | 0 | nenhuma |
| T6:spec | 1: sonnet, -; 2: sonnet, correção sonnet | nenhum | 0 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| final | 1: opus, -; 2: opus, correção sonnet | nenhum | 2 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | origem da semeadura em make-scenario.mjs | DONE | 1 |
| 2 | superpowers, --from-run e seedSource no lançador | DONE | 1 |
| 3 | detecção por classe no comparador | DONE | 1 |
| 4 | condutor da linha de base (run-baseline.mjs) | DONE | 2 |
| 5 | consolidador e texto das linhas (baseline.mjs) | DONE | 2 |
| 6 | roteiro do dono e gates | DONE | 2 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados)

### T5:quality fix1
I did not confirm that the new test fails without the fix. I ran the test only after applying the fix. The coherenceErrors seed-divergence check still only compares seeded variants that have seedSource. A missing seedSource is now caught in buildBaseline through the incomplete list, not as a coherence error.

### T6
I did not run TDD in the usual sense: the deliverable is a document, and the plan's check for it is comparing the guide against the CLI usage output. I checked that by grep. The roteiro assumes the sandbox sits under `<work>` and that the launcher prints the exact folder; I did not confirm that, so the guide says the exact folder is in the launcher's output. The plan's commit line was followed except that I used the plan's Co-Authored-By line.

### T6:spec fix1
Não rodei a suíte nem os gates G1-G5, porque a mudança é só de texto em um .md. Também não alterei o código: a conferência continua após o --dry-run, como a spec e o plano a definem. O dono só vê um erro de âncora ao iniciar a execução real, que sai com código 2 antes de qualquer gasto. Os trechos 3.4 e 3.6 do feedback correspondem aos passos 4 e 6 do roteiro.

## Gates

O relatório não traz um campo de gates estruturado. Os gates citados nos concerns acima:
- G1 a G5: não rodados na correção T6:spec fix1 (mudança só de texto em um .md).
- Nenhum outro resultado de gate foi registrado no relatório.

## Entradas humanas

Nenhuma entrada humana tem BLQ associado no relatório. Todas são não bloqueantes.

1. O quê: Execuções pagas da linha de base, operadas pelo dono com run-baseline.mjs no ambiente dele (plugin 1.6.0 instalado, regras de permissão da execução sem interface). Bloqueante: não. Alternativa (workaround): Ferramentas, roteiro e testes com agregados fabricados ([fab]) e runBatch simulado são entregues sem elas.
2. O quê: Escolha, pelo dono, da execução aprovada (tentativa de completo com E5 integrado em release/sandbox) cuja árvore vai em --from-run, antes das tentativas de detecção (pendente do dono em state.md). Bloqueante: não. Alternativa (workaround): Testes usam pasta temporária montada a partir da fixture sintética; sem --from-run o condutor pula as semeadas com código 1 e nunca semeia com os textos sintéticos.
3. O quê: Conferência do dono das linhas da linha de base e de detecção (critérios 1 a 3). Bloqueante: não. Alternativa (workaround): O consolidador gera linha-de-base.md e as linhas prontas para measurements.md; o aceite fica com o dono.
4. O quê: Aprovação do dono da revisão da estratégia com a tabela de metas (critério 4, DEC-034), depois das execuções pagas. Bloqueante: não. Alternativa (workaround): O consolidador entrega os valores de referência; o tracker propõe a revisão depois.
5. O quê: Ratificação das decisões de alcance contrato (2, 3, 4, 5, 8, 12, 13) antes de E17 começar (DEC-030). Bloqueante: não. Alternativa (workaround): nenhuma registrada.
