# Requisitos

<!-- roadmap:requirements -->
| ID | Requisito | Tipo | Fontes | Entregáveis | Cobertura |
|---|---|---|---|---|---|
| REQ-001 | Existe uma linha de base medida no commit de partida sobre um cenário fixo: release e coordinator com execuções pagas, planner e tracker por contadores; os dados reais das sessões servem de aproximação. | measurement | SRC-01, SRC-02, SRC-10, SRC-12, DEC-004, DEC-016, DEC-033 | E1, E15 | coberto |
| REQ-002 | Toda publicação passa por um ponto de medição que compara com a linha de base, e não sai se os contadores piorarem ou a detecção cair. | non-functional | SRC-01, SRC-10, DEC-011, DEC-017 | E11, E13, E16, E17 | coberto |
| REQ-003 | Os eventos mecânicos do tracker (situação, resumo de partida, próximo identificador, log, painel, verificação de commit, virada em lote de integrados, bloqueio, poda, o acréscimo de decisão pendente, de item pendente e da linha em andamento, e a ratificação ou rejeição de uma decisão do executor) são executados por uma CLI determinística sobre um parser único. | functional | SRC-01, SRC-02, SRC-04, DEC-023, DEC-030 | E3 | coberto |
| REQ-004 | O checker verifica as regras que as skills hoje exigem só em prosa. | functional | SRC-02, SRC-04 | E2 | coberto |
| REQ-005 | O planner gera a pasta do roadmap por scaffold a partir de um modelo estruturado. | functional | SRC-02, SRC-04 | E4 | coberto |
| REQ-006 | O plugin tem uma skill própria de spec, com modo autônomo e modo interativo. | functional | SRC-01, SRC-05, SRC-08, DEC-005 | E19 | coberto |
| REQ-007 | O plugin tem uma skill própria de plano, com modo autônomo e modo interativo. | functional | SRC-01, SRC-05, SRC-08, DEC-005 | E20 | coberto |
| REQ-008 | Nenhuma skill, agente, prompt ou script publicado do plugin invoca, cita ou depende de skill ou caminho do superpowers; um crédito de inspiração pode existir na documentação. | constraint | DEC-005, DEC-019 | E7, E8, E9, E13, E20, E21, E24 | coberto |
| REQ-009 | O plan-coordinator calcula mapa, ondas, conflitos de escrita, nível de cada passo e transições de estado por código. | functional | SRC-02, SRC-04, DEC-006 | E7 | coberto |
| REQ-010 | O laço de ondas do plan-coordinator roda como workflow embarcado no plugin. | functional | SRC-01, SRC-06, DEC-006 | E12 | coberto |
| REQ-011 | A retomada do release não repete a revisão de spec, de plano nem final quando o que foi aprovado não mudou. | non-functional | SRC-02, SRC-04, SRC-10 | E23 | coberto |
| REQ-012 | Os passos mecânicos do release (descoberta, git, verificação pós-execução) rodam por código, com as chamadas agrupadas. | functional | SRC-02, SRC-04 | E10 | coberto |
| REQ-013 | Os prompts de autor de spec, autor de plano, executor, implementador e revisor proíbem perguntar à pessoa. | functional | SRC-01, SRC-02, SRC-08 | E7, E8, E9, E19, E20, E21, E24 | coberto |
| REQ-014 | O revisor por tarefa devolve achados com identificador, e a nova revisão restrita aos achados e ao diff da correção existe como modo. | functional | SRC-05, SRC-08, DEC-021 | E21 | coberto |
| REQ-015 | O laço de revisão de spec e plano e o modelo do autor de plano são definidos por evidência medida. | measurement | SRC-02, SRC-05, SRC-08, SRC-10, DEC-010, DEC-021 | E26 | a-esclarecer |
| REQ-016 | O roteamento (nível, effort, portão de revisão) tem uma só definição, usada pelo release e pelo coordinator, com teste de igualdade entre as cópias embutidas. | functional | SRC-02, SRC-08, SRC-10 | E6, E7, E8 | coberto |
| REQ-017 | A prosa carregável do tracker, do planner e do coordinator diminui em relação à medida em SRC-02. | non-functional | SRC-01, SRC-02 | E4, E12, E22 | coberto |
| REQ-018 | Os julgamentos do planner e do tracker (revisão do roadmap, regra de contradição, conferência de critérios no fechamento) têm rubrica e exemplos. | functional | SRC-01, SRC-02 | E4, E22 | coberto |
| REQ-019 | O checker e o contrato de formato mudam juntos, e todo código que o checker emite está documentado no contrato. | constraint | SRC-03 | E2 | coberto |
| REQ-020 | Um plano já escrito sem bloco de dados entra pelo modo de adoção da skill de plano; o coordinator o recusa apontando a adoção, e o release para diante de trabalho iniciado na versão anterior. | functional | SRC-08, SRC-10, SRC-11, DEC-018 | E7, E8, E20 | coberto |
| REQ-021 | O preflight do release lista as regras de permissão dos scripts do plugin e dos comandos de verificação dos cards. | functional | SRC-02, SRC-04, SRC-10 | E18 | coberto |
| REQ-022 | Usar agent teams na orquestração. | functional | SRC-02, SRC-06 | - | fora-de-escopo: SRC-02 §7 registra que o recurso é experimental, não cria participantes em execução sem interface e é mau encaixe para um pipeline determinístico sem supervisão |
| REQ-023 | O checker compara a pasta com a versão anterior (modo diff). | functional | SRC-02 | - | fora-de-escopo: nenhuma frente do objetivo pede; a recusa de rebaixar status fica na CLI do tracker |
| REQ-024 | O checker oferece saída em JSON. | functional | SRC-02 | E2 | coberto |
| REQ-025 | O rascunho de retomada do planner guarda requisitos e cards. | functional | SRC-02, SRC-04 | E4 | coberto |
| REQ-026 | O que só uma pessoa resolve e as decisões autônomas têm registro estruturado, com custo se erradas, reversibilidade e alcance, e a decisão de parar ou seguir é tomada por código, incluindo a parada por decisão cara de errar e irreversível. | functional | SRC-04, SRC-08, DEC-007, DEC-020, DEC-030 | E5, E8 | coberto |
| REQ-027 | As paradas incidentais do plan-coordinator viram padrões, e empate continua sendo pergunta. | functional | SRC-02, SRC-04 | E7 | coberto |
| REQ-028 | A disciplina de teste primeiro é conferida por código a partir da evidência do implementador. | functional | SRC-05, SRC-08 | E9 | coberto |
| REQ-029 | O tracker lê só o trecho do contrato de formato que o evento toca. | non-functional | SRC-02, SRC-04 | E22 | coberto |
| REQ-030 | A verificação adversarial dos achados bloqueantes da revisão final existe como modo, e só a refutação explícita tira um achado da correção. | functional | SRC-02, DEC-021 | E24 | coberto |
| REQ-031 | A taxa de detecção de defeitos plantados, de código e de plano, pelo pipeline atual está medida. | measurement | SRC-08, SRC-10, SRC-12, SRC-13, DEC-033, DEC-051 | E1, E15 | coberto |
| REQ-032 | As suposições de arquitetura não verificadas (agente do plugin em workflow, script do plugin em subagent, consentimento do Workflow, devolução fiel do plano, compartilhamento de código em workflow) são respondidas por sonda antes de qualquer entregável que dependa delas. | measurement | SRC-02, SRC-08, SRC-10 | E14 | coberto |
| REQ-033 | O lançamento de um workflow do plugin não exige consentimento repetido de quem já o deu nem trava uma execução sem interface: o workflow é lançado pelo nome, com o caminho como reserva, e o preflight informa a regra de permissão que o libera. Nenhum hook do plugin aprova o lançamento; a skill concede só o próprio workflow, o que o experimento mostrou funcionar. | functional | SRC-02, SRC-06, SRC-10, SRC-11, SRC-12, SRC-13, SRC-14, DEC-035, DEC-049, DEC-050 | E12, E14, E25 | coberto |
| REQ-034 | Cada execução registra a versão e o commit do plugin no início; as publicações saem de main nos pontos de medição, com a quebra de formato na publicação do release nativo; cada publicação tem tag e branch de volta ensaiada, e a volta é uma versão nova. | constraint | SRC-03, SRC-10, SRC-11, SRC-12, DEC-009, DEC-014, DEC-015, DEC-028, DEC-036, DEC-042, DEC-046 | E11, E13, E16, E17 | coberto |
| REQ-035 | As métricas principais de comparação são contadores determinísticos por papel (chamadas por modelo, bytes de prompt, rodadas de revisão), comparados por um script com regra própria para cada classe de contador; custo é medida secundária. | measurement | SRC-10, SRC-12, DEC-011, DEC-033 | E1 | coberto |
| REQ-036 | A retomada do release reaproveita a medição de preparação quando o alvo não mudou. | non-functional | SRC-02, SRC-04 | E23 | coberto |
| REQ-037 | Uma mudança que altera o comportamento de uma skill é exercitada por uma execução comportamental registrada. | constraint | SRC-03 | E19, E20, E22 | coberto |
| REQ-038 | O lint do plugin valida os agentes e scripts novos do plugin. | functional | SRC-03, SRC-10 | E5 | coberto |
| REQ-039 | O modelo do revisor por tarefa, o modo de revisão (dois laços ou revisão única) e as rodadas de correção final são definidos por evidência medida. | measurement | SRC-02, SRC-04, SRC-07, SRC-08, DEC-010, DEC-021 | E27 | a-esclarecer |
| REQ-040 | O release registra o status e a documentação de um entregável pela CLI do tracker, e o status gravado é conferido por código. | functional | SRC-02, SRC-04, SRC-10 | E18 | coberto |
| REQ-042 | O spec traz dados legíveis por máquina, com os critérios de aceite do card, validados por código. | functional | SRC-02, SRC-08 | E5 | coberto |
| REQ-043 | O plano traz dados legíveis por máquina validados por código. | functional | SRC-02, SRC-08 | E6 | coberto |
| REQ-044 | Uma decisão do executor pendente de alcance contrato segura os entregáveis dependentes, e nenhuma publicação sai com decisão do executor pendente. | constraint | SRC-11, SRC-12, DEC-007, DEC-030, DEC-031 | E2, E8, E11, E13, E16, E17, E18 | coberto |
| REQ-045 | Cada entregável que promete economia tem uma meta derivada da linha de base, conferida no ponto de medição; uma meta não atingida exige decisão do dono no fechamento. | measurement | SRC-01, SRC-12, DEC-005, DEC-034 | E13 | coberto |
<!-- /roadmap:requirements -->
