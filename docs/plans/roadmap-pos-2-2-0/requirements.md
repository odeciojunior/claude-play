# Requisitos

<!-- roadmap:requirements -->
| ID | Requisito | Tipo | Fontes | Entregáveis | Cobertura |
|---|---|---|---|---|---|
| REQ-001 | Remover a chave taskReview.single do produto (workflow, preflight, agente task-reviewer, testes e docs), mantendo os dois laços por tarefa como único caminho. | functional | SRC-04, SRC-05, SRC-01 | E1 | coberto |
| REQ-002 | Medir o revisor por tarefa sonnet contra opus nas sementes da passada C e registrar a decisão de modelo do revisor. | measurement | SRC-04, SRC-05, SRC-01 | E2 | coberto |
| REQ-003 | Decidir se o laço quality da revisão por tarefa fica, com base em medição (0 capturas na passada C e nenhuma correção por tarefa no lote de entregável 16 do roadmap anterior). | decision | SRC-04, SRC-05, SRC-06, SRC-01 | E2 | coberto |
| REQ-004 | Apurar a origem da correção extra de parada-retomada (extraRounds e fixCalls 1 em entregável 11 do roadmap anterior e entregável 13 do roadmap anterior, fora de tarefas e portões) e corrigir se for defeito do produto. | functional | SRC-04, SRC-06 | E3 | coberto |
| REQ-005 | Triar o backlog do executor (pendentes do roadmap anterior e o relatório de pendências por entregável): fechar as notas obsoletas, corrigir as pequenas válidas e dar dono às grandes. | functional | SRC-02, SRC-03, SRC-01 | E4 | coberto |
| REQ-006 | Tratar a lacuna da limpeza de processos (nenhuma regra do preflight cobre o comando que encerra processos, decisão 751 do roadmap anterior). | functional | SRC-04, SRC-07, SRC-02 | E4 | coberto |
| REQ-007 | Publicar a versão nova do productivity-tools com o resultado deste roadmap, com nota de atualização, branch de volta e o commit final do tracker anterior em main. | functional | SRC-01, SRC-08, SRC-04 | E5 | coberto |
| REQ-008 | O gasto pago do roadmap não passa de US$ 40 no total, registrado por medição em measurements.md. | constraint | SRC-01 | E2, E3 | coberto |
<!-- /roadmap:requirements -->
