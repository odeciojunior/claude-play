# E2: formato do roadmap verificado, registro de revisões

Execução de 2026-11-11 (branch `feat/E2`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, - | nenhum | 0 | nenhuma |
| plan | 1: opus, - | nenhum | 1 | nenhuma |
| T8:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T8:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| final | 1: opus, - | nenhum | 9 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

As tarefas 1 a 7 foram retomadas de uma execução anterior (já revisadas); nesta execução só a tarefa 8 foi feita.

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | módulo-fonte do parser (lib/roadmap-format.mjs) | RESUMED (already reviewed) | - |
| 2 | gerador de cópias embutidas (scripts/embed.mjs) | RESUMED (already reviewed) | - |
| 3 | checker lê pelo módulo embutido | RESUMED (already reviewed) | - |
| 4 | preflight importa o módulo e expõe readRoadmapStructure | RESUMED (already reviewed) | - |
| 5 | oito checagens novas de configuração, estado, fontes e decisões | RESUMED (already reviewed) | - |
| 6 | checagens de fase e definição de pronto, fixture com roadmap:phases, aceite 1 e 2 | RESUMED (already reviewed) | - |
| 7 | saída --json do checker | RESUMED (already reviewed) | - |
| 8 | contrato de formato, regras do repositório, aceite 5 e gates | DONE | 3 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados)

Nenhum concern registrado.

## Gates

O relatório não traz resultado de gates registrado nesta execução (a tarefa 8 cobre "aceite 5 e gates", sem resultado estruturado no relatório).

## Entradas humanas

- O quê: Ratificação pelo dono das decisões autônomas de alcance contrato (1, 2, 5, 6, 10, 11, 14), pela regra de DEC-030; segura o início de E3, E4 e E6, não a entrega de E2.
- BLQ: nenhum registrado.
- Workaround: E2 é entregue com as decisões registradas como pendentes (Origem executor); todos os critérios são verify: test e não há efeito externo.
- Bloqueante: não.
