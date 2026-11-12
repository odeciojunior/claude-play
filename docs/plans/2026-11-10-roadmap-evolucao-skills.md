<!-- roadmap:version 1.4 2026-11-12 -->
# Evolução das skills de roadmap -- Estratégia v1.4

## Registro de mudanças

- v1.4 (2026-11-12): linha de base de E15 registrada e conferida. Entra a tabela de metas derivadas em "Métricas e metas" (critério 4 de E15; DEC-034, DEC-098), com as metas de prosa do planner (E4) e do tracker (E22). Nenhum entregável, dependência ou critério de aceite muda.
- v1.3 (2026-11-11): E1 integrado na branch de release. A tabela de gates é atualizada: G1 ganha o padrão `tools/**/*.test.mjs` com a linha de base medida de novo (DEC-032), e a célula Quando de G4 é reescrita para o release reconhecê-lo como local. Nenhum entregável, dependência ou critério de aceite muda.
- v1.2 (2026-11-10): absorve as emendas do dono ao ratificar as decisões do spec de E1 (DEC-081 a DEC-084). Muda a regra do portão na peça 6 de E1: detecção inconclusiva bloqueia até o dono liberar. Nenhum entregável, dependência ou critério de aceite muda.
- v1.1 (2026-11-10): absorve as decisões das sondas de E14, ratificadas pelo dono (DEC-057 a DEC-061, SRC-15). Mudam E2 (o gerador de cópias embutidas é necessário), E8 (carga do plano com schema, resumo em JavaScript puro, duas novas tentativas), E18, E21 e E23 (regra de permissão pelo nome do script), E19 (autor como agente do plugin) e E25 (cache não legível para o caminho). Nenhum entregável, dependência ou critério de aceite muda.
- v1.0 (2026-11-10): primeira versão (modo completo), já com as correções das revisões independentes (SRC-10), da análise das decisões (SRC-11) das soluções para as questões em aberto (SRC-12) e dos resultados dos experimentos de DEC-052 (SRC-14). Absorve DEC-001 a DEC-052, incluídas as decisões do executor que o dono ratificou (DEC-013, DEC-026 a DEC-029 e DEC-037 a DEC-045); DEC-053 a DEC-056 são do executor e aguardam ratificação.

## Objetivo

Evoluir `roadmap-planner`, `roadmap-tracker`, `roadmap-release` e `plan-coordinator` (plugin `productivity-tools`) em sete frentes pedidas pelo dono (SRC-01): execução mais rápida, menos tokens, mais código determinístico no harness, julgamento do LLM usado onde é necessário, melhor uso de workflow, subagents que não param para perguntar, e spec e plano produzidos por skills do próprio plugin.

Critério de aceite: um entregável do cenário fixo percorre spec, plano, execução, revisão e registro no roadmap usando só skills e scripts do plugin, sem nenhuma dependência do superpowers (DEC-005), e a comparação com a linha de base de cada skill está registrada em `measurements.md`.

Definição de pronto: todos os entregáveis Must integrados em `main` pela branch de release (DEC-002, DEC-014), com os gates G1 a G5 verdes, e a versão final publicada conferida no cache do plugin.

## Não objetivos

- Portar o superpowers: ele é inspiração, não base (DEC-005).
- Fundir o `plan-coordinator` no `roadmap-release` (alternativa descartada em DEC-006).
- Usar agent teams na orquestração (REQ-022).
- Modo de comparação do checker com a versão anterior da pasta (REQ-023).
- Datas, durações ou metas numéricas arbitrárias: não há prazo nem teto (DEC-003); metas derivadas da linha de base valem (DEC-034).
- Hook do plugin que aprove sozinho o lançamento de um workflow (DEC-035).
- Mudar o formato da pasta de roadmap sem receita de migração (regra de SRC-03).
- Reduzir um laço de revisão ou mudar o modelo de um revisor ou autor antes da medição correspondente (E26 para spec e plano, E27 para a revisão por tarefa; DEC-021).
- Script de migração de artefatos antigos, e leitura permanente do formato antigo: planos já escritos entram pela adoção (DEC-018).

## Suposições

| Suposição | Dono | Revalidar quando |
|---|---|---|
| ASSUMPTION: as proporções de custo de SRC-02 §9A, já com as correções da revisão, representam bem o peso de cada papel; os valores absolutos são estimativa. | dono | E15 fechar a linha de base |
| ASSUMPTION: o script de workflow aceita despachar um agente definido pelo plugin (as referências divergem, SRC-02 §8). | executor de E14 | E14 fechar |
| ASSUMPTION: um subagent consegue rodar um script do cache do plugin por caminho absoluto sem pedido de permissão que trave a execução, inclusive depois de uma troca de versão. | executor de E14 | E14 fechar |
| ASSUMPTION: invocar a skill vale como consentimento para o Workflow no comportamento atual de permissões (afirmação de SRC-07, não conferida). | executor de E14 | E14 fechar |
| ASSUMPTION: um agente consegue devolver o plano estruturado sem alterar caractere com frequência suficiente para a carga conferida por resumo de integridade ser prática. | executor de E14 | E14 fechar |

## Onde estamos

Nenhum entregável iniciado. A pesquisa está em SRC-02, a proposta de desenho nativo em SRC-08 e as revisões em SRC-10. Estado em `state.md`.

## Tese

A ordem segue cinco constatações das fontes:

1. As apostas de arquitetura têm de ser testadas antes de qualquer construção. Suposições não verificadas decidem o desenho de boa parte dos entregáveis (SRC-10, revisão 3); por isso as sondas vêm primeiro e sozinhas.
2. Sem linha de base não se prova ganho, e custo em dólar varia demais entre execuções para servir de régua sozinho. As métricas principais são contadores determinísticos, e as execuções pagas acontecem em pontos de medição operados pelo dono (DEC-011).
3. No release, a maior fatia é spec, plano e as revisões deles; no coordinator e no planner, é o contexto principal (SRC-02 §9A, com as correções). O plano com dados legíveis por código elimina a transcrição por LLM e torna determinísticos o mapa de ondas, o nível de cada tarefa e a retomada (SRC-08).
4. Julgamento não se barateia às cegas: toda redução de revisão entra como modo desligado e só vira padrão com medição própria (DEC-021); essa medição é obrigatória e vem logo depois do que ela mede (DEC-010).
5. O pipeline novo precisa entrar em uso durante o roadmap, não só no fim: o release roda da versão instalada, então há publicações nos pontos de medição, e o release nativo já nasce sobre a primeira delas (DEC-014, DEC-015).

## Execução deste roadmap (qual versão roda o quê)

- Publicações saem de `main` (DEC-014): num ponto de medição aprovado, o dono avança `main` até a branch de release, dá push e atualiza o plugin. São quatro: E17, E11, E16 e E13.
- Só a primeira (E17) é compatível com o que os usuários têm: leva o checker, a CLI do tracker e o registro do release, e por isso E7 e E19 só começam depois dela (DEC-046). Numeração em DEC-028. A de E11 é a versão de quebra: leva o formato novo de plano do release e o estado novo do coordinator. E13 é o fechamento (DEC-015).
- Um ponto de medição bloqueia a publicação quando os contadores pioram ou a detecção de defeitos plantados cai; custo em dólar inconclusivo não bloqueia (DEC-017).
- Cada execução registra a versão e o commit do plugin instalado no início. Não se publica com um entregável deste roadmap em execução: uma retomada em sessão nova já roda na versão nova.
- O executor prepara cada publicação na branch de release (versão nos dois lugares de cada plugin alterado, o que inclui o marketplace-tools na publicação que levar E5; linha 1 do checker quando ele difere do publicado e sempre na publicação que segue uma volta, DEC-042; G1 a G5). Branches de entregável não mexem na versão. Push, avanço de `main` e atualização do plugin são sempre atos do dono (DEC-007).
- Depois de criada a branch de release, a pasta de acompanhamento vive nela: ratificações e respostas são gravadas lá, porque é de lá que o release lê o estado.
- A cópia do checker dentro desta pasta só é atualizada pelo tracker, depois de uma publicação.
- Os entregáveis das trilhas de medição e de decisões (E14, E15, E17, E11, E26, E16, E27) não passam pelo `roadmap-release`: são operados pelo dono, com o executor preparando. O release executa só os de engenharia.
- O preflight atual já exige a regra de permissão para `node`, que cobre os comandos de verificação deste roadmap; os scripts do plugin e comandos de verificação com outros programas só passam a ser listados depois de E18.

Ratificação das decisões do executor (DEC-030, DEC-031):

- Toda decisão do executor é registrada com um alcance: `local` (errar custa só o próprio entregável) ou `contrato` (outro entregável lê o que ela fixa: comando, esquema, caminho, nome ou formato). Na dúvida, `contrato`.
- Uma decisão de `contrato` pendente segura os dependentes do entregável: eles não começam antes da ratificação, e os demais seguem. Uma decisão `local` espera o ponto de medição seguinte.
- Não se publica com decisão do executor pendente: ratificar todas é pré-condição de E17, E11, E16 e E13.
- O dono ratifica numa passada, no lançamento de cada execução do release e em cada ponto de medição, nunca com uma execução em andamento. O executor apresenta a lista (alcance, custo se errada, o que já foi construído em cima, resposta recomendada) e grava as respostas na branch de release, com commit antes do lançamento.
- Rejeitar é registrar uma decisão nova do dono que substitui a do executor. O entregável que a implementou e os dependentes já iniciados recebem um bloqueio até a correção.
- As decisões das sondas (E14) e das medições de política (E26, E27) são ratificadas dentro do próprio card, que não fecha sem isso. Uma política que mude por essas decisões é implementada por revisão do card da fatia seguinte que edita o arquivo de workflow (DEC-048).
- O alcance fica na última frase da célula Decisão de cada linha do executor; linha sem a frase conta como contrato (DEC-045).
- Até o release nativo (E8) o release instalado não confere essa regra: o dono lança por lista explícita de entregáveis, sem pôr na mesma execução um entregável e o dependente de uma decisão de `contrato` dele.

Reversão de uma publicação (DEC-036):

- Antes de cada avanço de `main`, o dono cria e envia a tag `productivity-tools--v<versão que está em main>` no commit instalado, e esse commit fica registrado no log. O número da versão não identifica o conteúdo; a tag identifica.
- Cada preparação de publicação inclui a branch de volta, montada pelo executor a partir da ponta da branch de release: o conteúdo do plugin igual ao da tag anterior, a versão de correção seguinte nos dois lugares, a linha 1 do checker nessa versão (DEC-042), e G1 a G5 verdes. Ela não é enviada ao remoto.
- Voltar é publicar: se uma versão publicada quebrar um projeto em uso, o dono avança `main` até a branch de volta, dá push e atualiza o plugin. `main` nunca anda para trás e nenhum número de versão é reaproveitado. Correção pequena e de causa conhecida sai como versão de correção normal.
- Depois de uma volta, a branch de release recebe `main` por um merge que mantém o conteúdo dela, e a publicação seguinte usa o número acima do da volta.
- Na versão de quebra, corrigir adiante é a primeira escolha e a volta é o último caso: a versão anterior não lê plano com bloco de dados nem estado do coordinator em JSON. Trabalho iniciado na versão de quebra termina nela ou recomeça do plano; a pasta de roadmap continua no formato 1.

## Visão geral dos entregáveis

| ID | Título | Fase | Depende de |
|---|---|---|---|
| E14 | Sondas de viabilidade | base | - |
| E1 | Ferramentas de medição e cenário fixo | base | - |
| E15 | Linha de base registrada | base | E1, E14 |
| E2 | Formato do roadmap verificado por código | base | E14 |
| E3 | Eventos do tracker por CLI | roadmap-sem-llm | E2, E14 |
| E18 | Registro do release pela CLI e permissões no preflight | roadmap-sem-llm | E3, E14 |
| E25 | Workflow do release lançado pelo nome | roadmap-sem-llm | E14, E18 |
| E22 | Tracker enxuto com rubricas | roadmap-sem-llm | E3 |
| E4 | Planner com scaffold e revisão com rubrica | roadmap-sem-llm | E2 |
| E17 | Ponto de medição e primeira publicação | roadmap-sem-llm | E15, E18 |
| E5 | Formato e ferramenta de spec | spec-plano | E14 |
| E19 | Autor de spec e skill interativa de spec | spec-plano | E5, E14, E17 |
| E6 | Formato e ferramenta de plano, com roteamento, mapa e briefs | spec-plano | E2, E5 |
| E20 | Autor de plano, skill interativa de plano e ponteiros nativos | spec-plano | E6, E19 |
| E7 | Coordinator com mapa e estado em código | spec-plano | E3, E6, E17 |
| E8 | Release com spec e plano nativos e paradas em código | ponta-a-ponta | E17, E18, E19, E20, E25 |
| E11 | Ponto de medição e publicação da versão de quebra | ponta-a-ponta | E7, E8, E15 |
| E26 | Medição de política: revisão de spec e plano e modelo do autor de plano | ponta-a-ponta | E8, E15 |
| E9 | Implementador e corretor nativos | ponta-a-ponta | E8 |
| E21 | Revisor por tarefa com achados identificados | ponta-a-ponta | E9 |
| E23 | Retomada do release sem repetir revisões | ponta-a-ponta | E8, E21 |
| E24 | Revisão final com verificação adversarial | ponta-a-ponta | E21, E23 |
| E16 | Ponto de medição e publicação da execução nativa | ponta-a-ponta | E11, E15, E21 |
| E27 | Medição de política: revisão por tarefa | ponta-a-ponta | E15, E21 |
| E10 | Release mecânico por código | ponta-a-ponta | E2, E18, E24 |
| E12 | Coordinator como workflow do plugin | coordinator-workflow | E7, E9, E21 |
| E13 | Fechamento: independência completa e medição final | publicacao | E2, E3, E7, E9, E11, E12, E16, E17, E18, E21, E23, E25, E26, E27 |

## Fases

| Fase (resultado) | Critérios de entrada | Critérios de saída | Entregáveis |
|---|---|---|---|
| Sabemos o que é viável, quanto o release e o coordinator custam hoje, e o formato do roadmap é verificado por código | Roadmap revisado pelo dono; branch de release criada | Sondas respondidas com decisão; linha de base registrada; checker cobre as regras hoje só escritas em prosa | E14, E1, E15, E2 |
| Acompanhar um roadmap não gasta LLM no que é mecânico | Sondas respondidas e parser único disponível | Eventos do tracker e registro do release rodam por CLI; comparação registrada; primeira versão publicada pelo dono | E3, E18, E25, E22, E4, E17 |
| Spec e plano saem de skills do plugin, e o plano é lido por código | Sondas respondidas; primeira versão publicada, para o que depende dela | Um spec e um plano nativos passam nas checagens sem pessoa; o coordinator monta o mapa por script | E5, E19, E6, E20, E7 |
| Um entregável roda de ponta a ponta sem superpowers, e a política de revisão tem evidência | Spec e plano nativos integrados | O release executa o cenário fixo com estágios nativos; a versão de quebra está publicada; as medições de política têm decisão ratificada | E8, E11, E26, E9, E21, E23, E24, E16, E27, E10 |
| O coordinator executa ondas num workflow do plugin | Execução e revisão nativas integradas; estado do coordinator em código | O plano de exemplo roda como workflow, com parada e retomada | E12 |
| A versão final está publicada e o ganho está medido | Todos os Must anteriores integrados na branch de release | Versão conferida no cache do plugin; comparação final com a linha de base registrada | E13 |

## Entregáveis

<!-- roadmap:card id=E14 phase=base track=decisions priority=Must size="não estimado" depends=- reqs=REQ-032,REQ-033 critical=true -->
### E14 -- Sondas de viabilidade

Por quê: REQ-032, REQ-033. Suposições não verificadas decidem a arquitetura de E2, E3, E18, E5, E6, E19, E20, E8, E9, E21 e E12 (SRC-10, revisão 3; SRC-02 §8 e §10). Nenhum código de produto é mesclado aqui: o resultado são decisões.

Peças:

- Peça 1: agente definido pelo plugin despachado de dentro de um workflow.
- Peça 2: script do plugin rodado por um subagent por caminho absoluto do cache, no modo de permissão real do dono e no modo padrão, inclusive após uma troca de versão; alternativa se falhar.
- Peça 3: consentimento do Workflow. Já estabelecido por código e documentação (SRC-13): o nome é `<plugin>:<nome do workflow>`, o "não perguntar de novo" grava a regra de permissão nas configurações locais do projeto e só existe no lançamento pelo nome, e um lançamento por caminho exige script legível. O experimento confirmou no modo padrão, em sessão sem interface e na sessão interativa (SRC-14): o diálogo, a gravação da regra pelo "não perguntar de novo" e a persistência entre sessões, o nome e a regra, a regra valendo por parâmetro e nas configurações locais, a recusa do caminho sem leitura da pasta, a regra sem conteúdo cobrindo o caminho só com a pasta legível, e a concessão por `allowed-tools` (DEC-049). A sonda mostrou que a pasta do cache não é legível para o lançamento por caminho; o lançamento pelo nome com o plugin instalado não pôde ser testado, porque nenhum plugin instalado registra workflow, e fica para o critério do dono em E25 (SRC-15, DEC-061). Plugin de sonda em `docs/reports/2026-11-10-e14-sondas/wfprobe2/`.
- Peça 4: taxa de erro de um agente ao devolver um plano estruturado conferido por resumo de integridade; o número de novas tentativas de E8 sai daqui.
- Peça 5: se um script de workflow consegue compartilhar código com outros arquivos, ou só por cópia gerada.

<!-- roadmap:acceptance -->
1. Dada cada sonda, quando ela roda, então o resultado (funciona, não funciona, com que limite) está registrado como decisão, com a alternativa escolhida em caso negativo. {verify: human; evidence: o dono confere e ratifica as linhas de decisão das sondas em decisions.md}
2. Dadas as decisões das sondas, quando alguma contraria o que um card supõe, então há uma proposta de revisão da estratégia apontando o card e a mudança. {verify: human; evidence: o dono confere a proposta de revisão registrada pelo tracker}
<!-- /roadmap:acceptance -->

Definição de pronto: decisões ratificadas pelo dono; nenhum arquivo do plugin alterado.

<!-- roadmap:risks -->
- Uma sonda negativa invalida a forma de um entregável já descrito -> a estratégia é revisada antes de o entregável afetado começar.
- A sonda roda num modo de permissão diferente do que o dono usa sem supervisão -> registrar o modo em cada decisão.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E1 phase=base track=measurement priority=Must size="não estimado" depends=- reqs=REQ-001,REQ-031,REQ-035 critical=false -->
### E1 -- Ferramentas de medição e cenário fixo

Por quê: REQ-001, REQ-035, REQ-031. A linha de base precisa de um extrator confiável (o atual tem erros de preço e de agrupamento apontados em SRC-10, revisão 2), de um cenário que mostre os ganhos que o roadmap promete, e de uma regra de portão que um script aplique (DEC-033). Só ferramentas e dados de exemplo; as execuções pagas são de E15.

Peças:

- Peça 1: extrator de métricas de sessões transformado em ferramenta com teste (parte de `docs/reports/2026-11-10-session-metrics/`), com contadores determinísticos por papel (chamadas por modelo, bytes de prompt enviados, rodadas de revisão), tabela de preços datada e papéis sem agrupar o registro do tracker com o relatório final. As ferramentas de medição vivem em `tools/measure/`, fora do plugin publicado (DEC-032); a raiz das transcrições e a pasta de saída são parâmetros obrigatórios, sem valor padrão.
- Peça 2: o gate G1 e o `CLAUDE.md` ganham o padrão `tools/**/*.test.mjs`, e as saídas das ferramentas entram no `.gitignore`.
- Peça 3: cenário fixo: um entregável de várias tarefas e o roteiro de parada e retomada entram no gerador de sandbox do release; o plano fixo do coordinator, o tema roteirizado do planner e o evento fixo do tracker ficam em `tools/measure/`.
- Peça 4: defeitos plantados com sentinela: oito de plano, oito de código e oito de spec, semeados em artefatos prontos (DEC-033, DEC-051). Plano semeado: spec e plano tirados de uma execução aprovada, com um commit que planta os defeitos. Código semeado: todas as tarefas commitadas com o assunto que a retomada reconhece e os defeitos na última. Os defeitos de plano são os que só o revisor pega; os que o código do workflow acusa sozinho ficam marcados no manifesto e contados à parte. Cada tentativa tem checagem de validade (plano reusado, conteúdo igual ao semeado), lida do diário completo do workflow, porque o resumo do estágio vem truncado quando há achados (SRC-14), e três desfechos por defeito: capturado, perdido ou indeterminado.
- Peça 5: lançador em lote que gera o sandbox, roda uma variante o número de vezes pedido e chama o extrator, para que operar um ponto de medição seja iniciar um comando e conferir a saída. As permissões da execução sem interface (regras que o preflight exige e a do Workflow) entram por parâmetro, e o lançador confere as negações de permissão na saída de cada sessão, porque a sessão negada termina sem erro (DEC-043, SRC-14).
- Peça 6: comparador que aplica a regra do portão por classe de contador e a regra de detecção (DEC-033); detecção inconclusiva por falta de tentativas válidas bloqueia até o dono liberar com decisão registrada, e família de modelo sem peso deixa o contador inconclusivo (DEC-081); e arnês que roda só o estágio de revisão sobre um artefato semeado, para as medições de política de E26 e E27.

Arquivos de teste deste card: `tools/measure/session-metrics.test.mjs`, `tools/measure/make-scenario.test.mjs`, `tools/measure/run-batch.test.mjs`, `tools/measure/compare.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado um diretório de transcrições de exemplo, quando o extrator roda, então produz por execução e por papel as chamadas por modelo, os bytes de prompt, as rodadas de revisão, os tokens e o custo estimado, contando o uso uma vez por mensagem. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
2. Dada uma sessão de exemplo com registro de status, log de revisões e relatório final, quando o extrator classifica os papéis, então cada um sai numa linha separada. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
3. Dado o gerador de sandbox, quando ele cria o cenário, então existe um entregável com mais de uma tarefa e o roteiro de parada e retomada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs}
4. Dado o gerador de cenário, quando ele semeia os defeitos, então cada defeito do manifesto está presente no artefato semeado e a sentinela dele acusa presença. {verify: test; evidence: node --test tools/measure/make-scenario.test.mjs}
5. Dados os arquivos de `tools/measure/`, quando o teste de privacidade roda, então nenhum contém id de sessão, caminho de diretório pessoal nem texto fora dos dados fabricados. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
6. Dados dois conjuntos de contadores de exemplo, quando o comparador roda, então devolve piorou, não piorou ou inconclusivo por contador segundo a classe, e a queda de detecção por classe com a margem definida. {verify: test; evidence: node --test tools/measure/compare.test.mjs}
7. Dado um número de execuções e uma variante, quando o lançador em lote roda com um executor simulado, então lança esse número de execuções, chama o extrator e grava um agregado sem ids de sessão. {verify: test; evidence: node --test tools/measure/run-batch.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes.

<!-- roadmap:risks -->
- As transcrições contêm dados privados -> o repositório recebe só as ferramentas e os dados de exemplo fabricados; saídas com id de sessão ou descrição de agente nunca são commitadas (critério 5).
- O agente de plano reescreve um plano com defeito visível -> a checagem de validade invalida a tentativa. No experimento o plano foi preservado e revisado, numa execução só (SRC-14); a taxa de tentativas inválidas é medida em E15, e se a reescrita for frequente a detecção de plano passa ao arnês de estágio. A retomada com commit semeado já está evidenciada: ela lê só os assuntos dos commits (SRC-13).
- Na execução sem interface ninguém responde à parada única do preflight, e as configurações do dono não têm regras de permissão -> o lançador passa as regras por parâmetro; a do Workflow é `Workflow(<plugin>:<nome>)`, e a sessão sem interface espera o workflow terminar (SRC-14). O teste do card usa só executor simulado (critério 7).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E15 phase=base track=measurement priority=Must size="não estimado" depends=E1,E14 reqs=REQ-001,REQ-031 critical=false -->
### E15 -- Linha de base registrada

Por quê: REQ-001, REQ-031. Os dados reais só servem de aproximação para o release plan-only, em seis cópias da skill e nenhuma no commit atual (SRC-02 §9A; DEC-004). O dono decidiu pagar a medição onde está o custo (DEC-016). Operado pelo dono, com o lançador em lote de E1 (DEC-011).

Peças:

- Peça 1: execuções pagas no commit de partida, marcado com tag: release plan-only, release completo sem interrupção, release com parada e retomada, e coordinator com um plano fixo pequeno. Execuções por variante: 5 plan-only, 3 completo, 3 parada e retomada, 3 coordinator (DEC-033).
- Peça 2: planner (tema roteirizado) e tracker (evento fixo) com uma execução cada, comparados só por contadores.
- Peça 3: taxa de detecção em cenário semeado: dois planos e duas branches com quatro defeitos cada, cinco execuções de cada, o que dá 40 tentativas por classe.
- Peça 4: registro em `measurements.md` com versão da skill, commit, versão do superpowers, modelos e tabela de preços usados.

<!-- roadmap:acceptance -->
1. Dado o cenário fixo de E1, quando as execuções do release e do coordinator terminam, então cada variante está registrada com contadores por papel, custo mediano e faixa, número de execuções, versão e commit. {verify: human; evidence: o dono confere as linhas da linha de base em measurements.md}
2. Dados o tema roteirizado e o evento fixo, quando o planner e o tracker rodam uma vez cada, então os contadores por papel estão registrados, com a nota de que custo não é comparado nessas duas skills. {verify: human; evidence: o dono confere as linhas da linha de base em measurements.md}
3. Dado o cenário semeado, quando o pipeline atual roda cinco vezes sobre cada artefato, então capturas, perdas e desfechos indeterminados por defeito, pela sentinela, estão registrados com 40 tentativas válidas por classe, e a taxa de tentativas inválidas também (DEC-051). {verify: human; evidence: o dono confere as linhas de detecção em measurements.md}
4. Dada a linha de base registrada, quando o executor deriva as metas dos entregáveis que prometem economia, então cada meta está na tabela de metas da estratégia com o contador, a variante e o cálculo, por revisão aprovada pelo dono (DEC-034). {verify: human; evidence: o dono aprova a revisão da estratégia que traz a tabela de metas}
<!-- /roadmap:acceptance -->

Definição de pronto: linha de base registrada e conferida pelo dono.

<!-- roadmap:risks -->
- Poucas execuções não separam ganho de variação -> comparar primeiro os contadores determinísticos e tratar custo como medida secundária, com mediana e faixa.
- Os modelos mudam entre a linha de base e a comparação -> registrar os modelos em cada linha e repetir a variante afetada se mudarem.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E2 phase=base track=engineering priority=Must size="não estimado" depends=E14 reqs=REQ-004,REQ-019,REQ-024,REQ-044 critical=true -->
### E2 -- Formato do roadmap verificado por código

Por quê: REQ-004, REQ-024, REQ-019, REQ-044. Há três leitores do mesmo formato (checker, preflight e um agente) e dez regras que as skills exigem e o checker não confere (SRC-02 §3, confirmado em SRC-10). O parser único é a base da CLI do tracker e do scaffold do planner.

Peças:

- Peça 1: gerador que embute um módulo-fonte nos arquivos que precisam ser únicos (o checker copiável, os scripts de workflow), com teste que falha quando um arquivo gerado está defasado. E6 e E12 reutilizam o gerador. A sonda de E14 mostrou que um script de workflow não importa nem lê arquivos, então a cópia embutida é o único caminho, e o código embutido usa só as globais que o ambiente do workflow oferece, sem `crypto`, `process` ou `Buffer` (DEC-058).
- Peça 2: parser do formato como módulo-fonte, usado pelo checker e pelo preflight.
- Peça 3: checagens novas: ordem posicional dos status, fase do card contra a tabela de fases, ordem de fase contra dependências, definição de pronto citando gate, dono nos pendentes, cabeçalho do estado contra a versão da estratégia, segmento bloqueado citando bloqueio, texto de restauração no bloqueio, fonte citada, sufixo do nome do arquivo da estratégia, e decisão do executor pendente sob um dependente já iniciado ou sob um entregável publicado (DEC-031).
- Peça 4: saída `--json` com erros, avisos e resumo.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

<!-- roadmap:acceptance -->
1. Dada uma pasta com um defeito de cada checagem nova, quando o checker roda, então emite o código nomeado daquela checagem. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
2. Dada uma pasta criada antes desta versão e válida no checker anterior, quando o checker novo roda, então nenhuma checagem nova vira erro: entra como aviso ou sob regra de adoção. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
3. Dada uma pasta qualquer, quando o checker roda com `--json`, então a saída é um JSON com erros, avisos e resumo, e o código de saída é o mesmo do modo texto. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
4. Dada a pasta de exemplo, quando o preflight e o checker a leem, então devolvem os mesmos blocos e linhas. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
5. Dada a pasta de exemplo do checker, quando o checker gerado roda, então reporta zero erros e zero avisos, todo código que ele emite está documentado no contrato de formato, e o arquivo gerado não está defasado em relação ao módulo-fonte. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

<!-- roadmap:risks -->
- Uma checagem nova quebra pastas de roadmap existentes -> toda checagem nova nasce como aviso ou sob regra de adoção; erro só com receita de migração.
- O arquivo gerado e o módulo-fonte divergem -> o teste de defasagem roda em G1.
- O reuso de um identificador já fechado não é detectável a partir de um retrato da pasta -> essa regra fica na CLI do tracker (E3), que vê todos os arquivos ao alocar.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E3 phase=roadmap-sem-llm track=engineering priority=Must size="não estimado" depends=E2,E14 reqs=REQ-003 critical=true -->
### E3 -- Eventos do tracker por CLI

Por quê: REQ-003. Quase todo o trabalho do tracker é edição determinística de tabelas, hoje feita à mão pelo LLM, e o reuso de um identificador já fechado é invisível ao checker (SRC-02 §3). Primeira fatia: carrega o custo comum (o escritor que troca linhas e os comandos), que E18 e E22 só passam a chamar.

Peças:

- Peça 1: comandos de leitura: situação do roadmap, resumo de partida a frio, próximo identificador livre, e decisões do executor pendentes com os dependentes já iniciados.
- Peça 2: comandos de escrita que trocam só as linhas tocadas: linha de log em ordem, status no painel pela posição do vocabulário, verificação de commit citado, virada em lote dos entregáveis já integrados, abrir e fechar bloqueio, poda e atualização do checker da pasta.
- Peça 3: comandos de acréscimo que o registro do release usa (DEC-023): decisão do executor pendente de ratificação, item pendente, e pôr e tirar a linha em andamento; e ratificar ou rejeitar uma decisão do executor (DEC-030).

Arquivo de teste deste card: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`.

<!-- roadmap:acceptance -->
1. Dada a pasta de exemplo válida, com finais de linha de um tipo e do outro e com uma célula de status de vários segmentos, quando cada comando de escrita roda, então a pasta passa no checker sem erros e os bytes fora das linhas tocadas são idênticos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
2. Dado um bloqueio fechado e já removido do estado, quando se pede o próximo identificador de bloqueio, então o número devolvido nunca apareceu em nenhum arquivo da pasta, log incluído. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
3. Dado um painel com um segmento já integrado, quando se pede um status anterior na ordem, então o comando recusa com erro e não altera o arquivo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
4. Dados uma decisão do executor, um item pendente e uma linha em andamento, quando os comandos de acréscimo rodam, então cada um aparece uma vez no bloco certo, a decisão sai com origem executor e status pendente, e repetir o comando não duplica. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
5. Dada uma decisão do executor pendente, quando o comando de ratificação roda, então só o status da linha passa a vigente, o item pendente sai e há uma linha de log; uma decisão que não é do executor ou não está pendente é recusada sem alterar arquivo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
6. Dada uma decisão do executor pendente e a decisão do dono que a rejeita, quando o comando de rejeição roda, então entra uma linha nova de origem user e a antiga passa a substituída por ela, sem outra célula alterada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

<!-- roadmap:risks -->
- Reescrever tabelas em markdown altera texto que o evento não tocou -> o escritor substitui linhas e nunca regrava o arquivo inteiro; o critério 1 confere os bytes.
- Dois chamadores gravam o estado ao mesmo tempo -> conferir um resumo do arquivo antes de gravar e recusar se mudou.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E18 phase=roadmap-sem-llm track=engineering priority=Must size="não estimado" depends=E3,E14 reqs=REQ-021,REQ-040,REQ-044 critical=true -->
### E18 -- Registro do release pela CLI e permissões no preflight

Por quê: REQ-040, REQ-021, REQ-044. Cada registro feito pelo release abre uma sessão de LLM com a skill do tracker, e o registro de status hoje não é conferido por ninguém: o workflow confia no que o próprio agente devolve (SRC-02 §3, confirmado em SRC-10). O preflight não enxerga os comandos de verificação dos cards (SRC-02 §4). Vem depois de E3 porque só chama a CLI, e antes de E8 porque edita o mesmo arquivo de workflow. O lançamento pelo nome saiu para E25.

Peças:

- Peça 1: o preflight passa a listar as regras de permissão dos scripts do plugin e dos comandos de verificação dos cards.
- Peça 2: o registro do release (status, decisões do executor, pendentes e linha em andamento) é feito pela CLI, e o que foi gravado é conferido por código.
- Peça 3: a parte de roadmap da etapa de documentação é feita pela CLI.
- Peça 4: o preflight lista as decisões do executor pendentes por entregável, lidas da branch alvo, e a skill as mostra na parada única antes de qualquer agente (DEC-031).

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, que já existem e ganham os casos deste card.

<!-- roadmap:acceptance -->
1. Dado um card com comando de verificação e um script do plugin que nenhuma regra de permissão das configurações cobre, quando o preflight roda, então as duas regras aparecem na lista de regras ausentes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado o workflow do release, quando ele registra o status de um entregável, no registro de status e na etapa de documentação, então o status e a linha de log são gravados por comando da CLI, e não por edição feita pela skill do tracker. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado um registro em que o status lido do painel depois da gravação não é o pedido, ou em que a CLI devolveu erro, inclusive ao gravar uma decisão do executor, quando o workflow recebe o retorno, então trata o registro como falho por código, sem depender do que o agente relata. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dada uma pasta com uma decisão do executor pendente, quando o preflight roda com a branch alvo, então a decisão aparece na saída com o entregável a que pertence. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O caminho do script muda a cada versão e a regra de permissão deixa de casar -> os scripts continuam no plugin e a regra casa pelo nome do arquivo do script, sem a versão no caminho e sem curinga depois de barra invertida, que no Windows vira negação dura (DEC-060).
- A etapa de documentação grava riscos aceitos e pendências humanas em texto livre, sem comando na CLI -> o spec decide se viram itens pendentes pelos comandos de E3 ou ficam com o agente; decisões e status passam sempre pela CLI.
- A semântica de autorização de efeito externo e de retomada regride (área com mais correções recentes, SRC-02 §1) -> não alterar essa lógica nesta entrega e manter os testes atuais passando.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E25 phase=roadmap-sem-llm track=engineering priority=Must size="não estimado" depends=E14,E18 reqs=REQ-033 critical=false -->
### E25 -- Workflow do release lançado pelo nome

Por quê: REQ-033. Pelo código da CLI, lançar o workflow por caminho no modo padrão é recusado quando o script não está no conjunto legível, e só o lançamento pelo nome oferece "não perguntar de novo" (SRC-13); o experimento mostrou a recusa, o diálogo com essa opção e o lançamento seguinte sem diálogo (SRC-14). O plugin não embarca hook que aprove o lançamento (DEC-035); a concessão pela própria skill funcionou no experimento e o dono decidiu que ela entra (DEC-049). Fatia de E18: segue o que os experimentos e a sonda de E14 mostraram (SRC-14, SRC-15) e tem aceite do dono, por isso fecha separada do registro pela CLI. Vem depois de E18 e antes de E8 porque edita o mesmo arquivo de workflow e o preflight. Não segura E17: entra na publicação que estiver em preparação quando integrar.

Peças:

- Peça 1: o preflight informa, como aviso que não bloqueia, a regra de permissão que libera o workflow numa execução sem interface.
- Peça 2: o workflow do release é registrado como workflow do plugin pelo manifesto, sem mover o arquivo, com o nome `release-workflow` (DEC-041), e a skill o lança pelo nome.
- Peça 3: lançado sem configuração ou sem o token de execução, o workflow para antes de qualquer agente.
- Peça 4: se a CLI não conhecer o nome do workflow, a skill cai para o lançamento por caminho, como hoje, e declara no campo `compatibility` a versão mínima em que o nome funciona (DEC-050).
- Peça 5: a skill concede o próprio workflow pelo campo `allowed-tools`, restrito a `release-workflow`, e a política de chaves de frontmatter do `CLAUDE.md` do repositório ganha essa exceção (DEC-049).

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, que já existem e ganham os casos deste card.

<!-- roadmap:acceptance -->
1. Dadas configurações sem regra que cubra o workflow do release, quando o preflight roda, então a regra aparece nos avisos com o texto exato a acrescentar, e não entre as regras ausentes que bloqueiam; com a regra presente, o aviso não aparece. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado o workflow do release lançado sem configuração ou sem o token de execução, quando ele inicia, então devolve erro antes de qualquer chamada de agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado o manifesto do plugin, quando o teste o lê, então ele registra o arquivo do workflow do release, o nome do workflow não é o de nenhuma skill do plugin, e a skill manda lançar por esse nome. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dada uma sessão no modo padrão, sem regra e sem hook, quando o dono lança o release pela skill e escolhe não perguntar de novo, então o lançamento seguinte no mesmo projeto começa sem diálogo. {verify: human; evidence: o dono confere em duas sessões seguidas e registra o modo de permissão}
5. Dado o SKILL.md do release, quando o lint do plugin roda, então `compatibility` declara a versão mínima e, se `allowed-tools` estiver presente, ele lista só o workflow do próprio plugin; qualquer outra entrada em `allowed-tools` é acusada. {verify: test; evidence: node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs}
6. Dada a concessão por `allowed-tools`, quando o dono lança o release pela skill numa sessão no modo padrão, sem regra de permissão, então o lançamento começa sem diálogo. {verify: human; evidence: o dono confere numa sessão nova e registra o modo de permissão}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O lançamento pelo nome ou a regra de permissão não se comportam como a documentação indica -> o nome e a regra foram vistos com o plugin carregado do caminho local; com o plugin instalado só o critério 4 confere. Se o lançamento pelo nome falhar ali, o card se reduz à peça 1 e a skill continua lançando por caminho.
- A trava mexe na checagem do token de execução, que hoje só barra a execução com tarefa externa autorizada, e a maior parte dos testes do fluxo roda sem token -> a trava só acrescenta uma recusa anterior, nenhuma condição existente é removida, e o padrão do arnês de teste muda num commit próprio, com a suíte atual passando (G1).
- No modo padrão o lançamento por caminho é recusado, não perguntado, quando a pasta do script não está no conjunto legível, e a regra do Workflow sem conteúdo não muda isso (SRC-14); a pasta do cache do plugin não é legível (SRC-15) -> o lançamento pelo nome é o caminho principal; a reserva da peça 4 serve só a quem roda sem prompts de permissão ou libera a pasta, e a skill diz isso quando cai nela (DEC-061).
- O critério 4 só pode ser conferido com o workflow nomeado carregado -> o dono confere com o plugin carregado do caminho local do repositório, como na sonda de E14.
- A concessão por `allowed-tools` tira o diálogo de lançamento de todo usuário do plugin, o que DEC-035 evitava -> ela é restrita ao workflow do próprio plugin pelo nome, a trava da peça 3 barra o lançamento sem preflight, e a mudança passa por revisão de raio de impacto alto (DEC-049).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E22 phase=roadmap-sem-llm track=engineering priority=Should size="não estimado" depends=E3 reqs=REQ-017,REQ-018,REQ-029,REQ-037 critical=false -->
### E22 -- Tracker enxuto com rubricas

Por quê: REQ-029, REQ-017, REQ-018, REQ-037. Should (DEC-022): a prosa estática pesa pouco perto do contexto da sessão. A skill do tracker exige a leitura integral do contrato de formato até para acrescentar uma linha de log, e os dois julgamentos reais do tracker não têm rubrica nem exemplos (SRC-02 §3). Com a CLI de E3, a skill passa a carregar só o que o evento pede.

Peças:

- Peça 1: skill do tracker enxuta: chama a CLI, lê só a receita do evento e deixa de exigir a leitura integral do contrato de formato.
- Peça 2: rubrica e exemplos para a regra de contradição e para a conferência de critérios no fechamento de um entregável; a receita de decisão ganha a rejeição de uma decisão do executor já registrada (DEC-030).

Arquivo de teste deste card: `plugins/productivity-tools/scripts/prose-budget.test.mjs`, criado aqui.

<!-- roadmap:acceptance -->
1. Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa que o tracker carrega para um evento não é maior que a meta derivada registrada na estratégia e não inclui o contrato de formato inteiro. {verify: test; evidence: node --test plugins/productivity-tools/scripts/prose-budget.test.mjs}
2. Dadas uma decisão que contraria a estratégia e outra que só a detalha, quando o tracker as classifica com a rubrica, então marca a primeira como contradição e a segunda não. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
3. Dado um spec cujos critérios enfraquecem os do card, quando o tracker confere os critérios no fechamento com a rubrica, então aponta o critério enfraquecido. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

<!-- roadmap:risks -->
- A meta de prosa ainda não existe quando o card começa -> ela é derivada depois da linha de base (DEC-034); até lá o critério 1 exige ao menos que o contrato de formato inteiro saia da carga.
- Um evento sem comando na CLI fica sem o trecho do contrato de que precisa -> a receita desse evento aponta a seção do contrato que ele toca, em vez de dispensar a leitura.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E4 phase=roadmap-sem-llm track=engineering priority=Should size="não estimado" depends=E2 reqs=REQ-005,REQ-017,REQ-018,REQ-025 critical=false -->
### E4 -- Planner com scaffold e revisão com rubrica

Por quê: REQ-005, REQ-025, REQ-018, REQ-017. O planner escreve à mão cerca de nove arquivos a partir de modelos, o rascunho de retomada não guarda os cards, e o revisor recebe um brief de uma frase (SRC-02 §2). O ganho de custo esperado é pequeno: a maior parcela do planner é o contexto principal, que o scaffold não reduz (SRC-10, revisão 3).

Peças:

- Peça 1: modelo estruturado do roadmap e scaffold que gera a pasta inteira, com grafo de dependências, caminho crítico e resumo de cobertura derivados dos cards.
- Peça 2: rascunho de planejamento que persiste requisitos e cards depois de cada passo.
- Peça 3: revisor com rubrica voltada ao que o checker não vê, saída estruturada e nova rodada após as correções, com teto; exemplos trabalhados na referência de decomposição; prosa repetida reduzida.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`, `plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado um modelo de roadmap de exemplo, quando o scaffold roda, então a pasta gerada passa no checker sem erros e o grafo e o caminho crítico correspondem às dependências dos cards. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs}
2. Dado um modelo salvo no meio do planejamento, com requisitos e cards e sem os arquivos finais, quando o scaffold o lê, então gera a pasta completa sem pedir dado que o modelo já tem. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs}
3. Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa carregável do planner não é maior que a meta derivada registrada na estratégia. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs}
4. Dado um roadmap com defeitos plantados que o checker não vê (número sem fonte, requisito composto, critério não verificável), quando o revisor roda, então devolve um achado estruturado para cada um, com arquivo, regra e severidade. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

<!-- roadmap:risks -->
- O modelo estruturado engessa o que hoje é texto livre -> o scaffold gera a estrutura e os campos derivados; o texto dos cards continua escrito pelo modelo de linguagem.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E17 phase=roadmap-sem-llm track=measurement priority=Must size="não estimado" depends=E15,E18 reqs=REQ-002,REQ-034,REQ-044 critical=true -->
### E17 -- Ponto de medição e primeira publicação

Por quê: REQ-002, REQ-034, REQ-044. É a única publicação compatível do roadmap (DEC-015): leva o checker reforçado, a CLI do tracker e o registro do release por ela. O release nativo (E8) só começa sobre esta versão publicada. Operado pelo dono (DEC-011), com portão por contadores (DEC-017).

Peças:

- Peça 1: cenário fixo do tracker e do registro de status do release rodado na branch de release; o planner e a skill enxuta do tracker entram na comparação se E4 e E22 já estiverem integrados.
- Peça 2: preparação da publicação na branch de release, feita pelo executor: versão nos dois lugares, linha 1 do checker (ele mudou em E2), G1 a G5.
- Peça 3: publicação pelo dono (DEC-014): `main` avança até a branch de release, push, atualização da loja e do plugin, conferência da pasta da versão no cache e registro do commit instalado. A cópia do checker desta pasta é atualizada pelo tracker depois.
- Peça 4: ratificação em lote das decisões do executor pendentes, antes da preparação da publicação (DEC-030).
- Peça 5: branch de volta montada pelo executor a partir da ponta da branch de release, e tag da versão que está em `main` criada pelo dono antes do avanço (DEC-036).

<!-- roadmap:acceptance -->
1. Dado o cenário fixo, quando roda na branch de release, então a comparação com a linha de base está registrada por contadores e por custo, e o painel produzido pelo registro por CLI é o esperado. {verify: human; evidence: o dono confere as linhas de comparação em measurements.md}
2. Dada a comparação sem piora nos contadores, pela saída do comparador de E1, quando o dono publica, então a versão nova existe no cache do plugin e os entregáveis seguintes passam a rodar nela; custo inconclusivo não bloqueia (DEC-017). {verify: human; evidence: o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache}
3. Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
4. Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
5. Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}
6. Dada uma meta derivada cujo entregável já está integrado, quando o ponto de medição termina, então ela está marcada atingida ou não atingida em measurements.md; uma meta não atingida não bloqueia a publicação (DEC-034). {verify: human; evidence: o dono confere as linhas de meta em measurements.md}
<!-- /roadmap:acceptance -->

Definição de pronto: comparação registrada; G1 a G5 verdes na branch de release; versão publicada conferida pelo dono.

<!-- roadmap:risks -->
- A comparação mostra piora nos contadores -> não publicar; abrir um bloqueio no entregável responsável.
- A publicação troca a versão por baixo de uma execução em andamento -> não publicar com entregável em execução.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E5 phase=spec-plano track=engineering priority=Must size="não estimado" depends=E14 reqs=REQ-026,REQ-038,REQ-042 critical=false -->
### E5 -- Formato e ferramenta de spec

Por quê: REQ-042, REQ-026, REQ-038. Hoje o spec é texto livre: os critérios do card, as decisões autônomas e o que depende de pessoa são conferidos por um revisor LLM e relidos por outro agente (SRC-02 §4). SRC-08, seções B2 e B6, é a proposta de desenho. Trabalho de base sem autor: a ferramenta de plano (E6) lê os dados do spec, e o autor de spec (E19) fecha a própria escrita com esta checagem.

Peças:

- Peça 1: bloco de dados dentro do documento, com leitor compartilhado com a ferramenta de plano (E6), e esquema do spec: critérios de aceite idênticos aos do card, decisões autônomas com base, custo se estiverem erradas e reversibilidade (DEC-020) e alcance, local ou contrato (DEC-030), itens que só uma pessoa resolve, efeitos externos e casos de borda.
- Peça 2: ferramenta de spec (checar contra o card, emitir, resumir).
- Peça 3: o lint do plugin passa a validar os agentes e scripts novos do plugin.

Arquivos de teste deste card: `plugins/productivity-tools/scripts/spec-tool.test.mjs` (criado aqui), `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` (já existe; ganha casos).

<!-- roadmap:acceptance -->
1. Dado um spec cujo critério de aceite difere do card ou perdeu a marca de verificação, quando a ferramenta de spec o checa, então falha nomeando o critério. {verify: test; evidence: node --test plugins/productivity-tools/scripts/spec-tool.test.mjs}
2. Dado um spec com uma decisão autônoma sem base, sem custo se estiver errada, sem marca de reversibilidade ou sem alcance, ou com um item que só uma pessoa resolve sem marca de bloqueio, quando a ferramenta o checa, então falha nomeando o registro. {verify: test; evidence: node --test plugins/productivity-tools/scripts/spec-tool.test.mjs}
3. Dado um agente de plugin com um campo que agentes de plugin ignoram ou com chave fora da política do repositório, quando o lint roda, então acusa o arquivo. {verify: test; evidence: node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes.

<!-- roadmap:risks -->
- O esquema do spec muda quando o autor (E19) for escrito, depois de a ferramenta de plano (E6) já o ler -> o esquema tem versão, e o spec de exemplo deste card é o mesmo que o teste de E6 usa; mudar o esquema em E19 exige passar nos dois testes.
- O caminho do script muda a cada versão e a regra de permissão deixa de casar -> os scripts continuam no plugin e a regra casa pelo nome do arquivo do script, sem a versão no caminho e sem curinga depois de barra invertida, que no Windows vira negação dura (DEC-060).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E19 phase=spec-plano track=engineering priority=Must size="não estimado" depends=E5,E14,E17 reqs=REQ-006,REQ-013,REQ-037 critical=true -->
### E19 -- Autor de spec e skill interativa de spec

Por quê: REQ-006, REQ-013, REQ-037. Começa depois da primeira publicação, que leva só o que é compatível (DEC-046). Hoje o spec sai de uma skill externa embrulhada num modo autônomo por prompt (SRC-02 §4); a decisão é independência total (DEC-005). SRC-08, seção B2, é a proposta de desenho; o que ela deixa para o dono está nas questões em aberto. O autor é um agente do plugin, despachado de dentro do workflow com `agentType` e o nome `<plugin>:<agente>`; um teste acusa a grafia `subagent_type`, que é ignorada em silêncio (DEC-057). O autor de plano de E20 segue a mesma forma.

Peças:

- Peça 1: autor de spec em modo autônomo, que lê o card e o código antes de decidir, não pergunta à pessoa e fecha a escrita com a checagem de E5. A revisão do spec continua a que o release usa hoje; a leitura que devolve só perguntas, proposta em SRC-08, é um braço da medição de E26.
- Peça 2: skill interativa de spec, `spec-writer` (DEC-041), para uso fora de um roadmap, que usa o mesmo autor; faz uma rodada de até cinco perguntas, outra só a pedido, e pede uma aprovação (DEC-027); grava em `docs/plans/<tópico>/spec.md` (DEC-026).

Arquivos de teste deste card: nenhum novo. Os dois critérios são execuções comportamentais; a checagem que eles citam é a ferramenta de E5.

<!-- roadmap:acceptance -->
1. Dado um card do cenário fixo que exige uma credencial, quando o autor roda sem pessoa, então o spec passa na checagem, registra a credencial como item que só uma pessoa resolve, não inventa valor e nenhuma pergunta é feita. {verify: human; evidence: o dono confere o resultado das execuções comportamentais registrado em docs/reports}
2. Dado um pedido fora de um roadmap, quando a skill interativa roda, então grava um spec que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite conferido pelo dono nas execuções registradas; G1, G2, G3 e G5 verdes na branch de release.

<!-- roadmap:risks -->
- O autor ratifica o próprio palpite, sem pessoa para corrigir -> a revisão atual do spec é mantida, as regras de parada ficam em código (E8) e as decisões são listadas com o custo se estiverem erradas.
- Os prompts novos começam sem medição -> a comparação acontece em E11, que é o portão para publicar a fase.
- Quem quer uma conversa exploratória longa recebe menos na skill interativa -> registrar a perda na descrição da skill.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E6 phase=spec-plano track=engineering priority=Must size="não estimado" depends=E2,E5 reqs=REQ-016,REQ-043 critical=false -->
### E6 -- Formato e ferramenta de plano, com roteamento, mapa e briefs

Por quê: REQ-043, REQ-016. O plano hoje é texto que o próprio autor transcreve para JSON e um revisor relê para conferir, e o coordinator o interpreta sem gramática fixa (SRC-02 §4 e §5). SRC-08, seções B3 e B6, é a proposta de desenho. Só código: o coordinator (E7) e o autor de plano (E20) partem daqui, e da parte de spec este card usa apenas o esquema e o leitor de E5.

Peças:

- Peça 1: esquema do plano e ferramenta de plano (checar contra o spec e emitir com resumo de integridade que cobre também o arquivo de origem): tarefas, arquivos, dependências, interfaces produzidas e consumidas, efeitos externos, evidência por critério de aceite.
- Peça 2: uma definição de roteamento (nível, effort e nível de revisão a partir das notas da tarefa), numa só fonte, embutível pelo gerador de E2, com teste de igualdade entre a fonte e a cópia gerada. A cópia entra nos arquivos de workflow em E8 e E12, para este card não editar o workflow do release em paralelo com E18. A tabela de exemplo vem das regras atuais do coordinator e do release, para que nenhum portão de revisão mude sem medição.
- Peça 3: mapa de ondas, com largura máxima, e brief por tarefa gerados pela ferramenta.

Arquivo de teste deste card: `plugins/productivity-tools/scripts/plan-tool.test.mjs` (criado aqui).

<!-- roadmap:acceptance -->
1. Dado um plano com cada defeito plantado (ciclo de dependências, duas tarefas da mesma onda escrevendo o mesmo arquivo, critério de aceite sem cobertura, interface consumida e nunca produzida, comando de efeito externo declarado como interno), quando a ferramenta o checa, então devolve o erro nomeado de cada um. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
2. Dado o plano de exemplo, quando a ferramenta o emite, então o resumo de integridade muda se o conteúdo ou o arquivo de origem mudar, e é igual ao calculado pela cópia gerada para os workflows. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
3. Dada a tabela de exemplo tirada das regras atuais de roteamento do coordinator e de revisão do release, quando a definição de roteamento roda, então reproduz nível, effort e portão de revisão de cada linha, na ferramenta e na cópia gerada. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
4. Dado o plano de exemplo, quando a ferramenta gera o mapa e os briefs, então nenhuma onda passa da largura máxima e cada brief traz as restrições, os dados da tarefa e as interfaces consumidas. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes.

<!-- roadmap:risks -->
- A definição de roteamento muda um portão de revisão sem que ninguém perceba -> a tabela de exemplo é derivada das regras atuais e o critério 3 a confere.
- O esquema do plano é fixado antes de existir um autor que o preencha -> o plano de exemplo deste card é escrito à mão no formato novo, e o critério 1 de E20 mostra se um autor consegue preenchê-lo dentro das tentativas; se não conseguir, o esquema é corrigido por revisão deste card.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E20 phase=spec-plano track=engineering priority=Must size="não estimado" depends=E6,E19 reqs=REQ-007,REQ-008,REQ-013,REQ-020,REQ-037 critical=true -->
### E20 -- Autor de plano, skill interativa de plano e ponteiros nativos

Por quê: REQ-007, REQ-013, REQ-037, REQ-008, REQ-020. O plano hoje sai de uma skill externa com instruções escritas por cima dela (SRC-02 §4), e o planner e o tracker mandam a pessoa para as skills externas de spec e de plano. SRC-08, seção B3, é a proposta de desenho. Depende de E19 só pela peça 3: os ponteiros só podem ser trocados quando as duas skills nativas existem.

Peças:

- Peça 1: autor de plano que registra decisões e não código, não pergunta à pessoa e fecha a escrita com a checagem de E6, no modelo que o release usa hoje.
- Peça 2: skill interativa de plano, `plan-writer` (DEC-041), que usa o mesmo autor, não pede aprovação e grava `plan.md` na pasta do spec (DEC-040, DEC-026). Modo de adoção (DEC-018): aceita qualquer arquivo de plano sem bloco de dados, de qualquer origem, reescreve-o uma vez no formato novo, no mesmo caminho, e mostra o que mudou.
- Peça 3: planner e tracker passam a apontar para as skills de spec e de plano do plugin.
- Peça 4: suíte de casos de gatilho para as skills de spec e de plano, rodada pelo dono (DEC-025).

Arquivo de teste deste card: `plugins/productivity-tools/scripts/independence.test.mjs` (criado aqui; E13 o estende).

<!-- roadmap:acceptance -->
1. Dado um spec do cenário fixo, quando o autor de plano roda três vezes sem pessoa, então cada plano passa na checagem dentro das tentativas do autor e nenhuma pergunta é feita. {verify: human; evidence: o dono confere o resultado das execuções comportamentais registrado em docs/reports}
2. Dado um spec fora de um roadmap, quando a skill interativa de plano roda, então grava um plano que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
3. Dado o repositório após a entrega, quando se procura a palavra superpowers nos arquivos publicados das skills do planner e do tracker, então não há ocorrência. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs}
4. Dado um plano já escrito, sem bloco de dados, quando a skill de plano o adota, então mostra o que mudou nas tarefas, pede uma aprovação e grava um plano que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
5. Dada a suíte de casos de gatilho, quando o dono a roda, então o resultado por caso está registrado, com os pedidos de spec, de plano, de roadmap e de execução de plano indo cada um para a skill certa, e com o registro de o superpowers estar ou não habilitado na sessão. {verify: human; evidence: o dono roda a suíte e confere o resultado registrado em docs/reports}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

<!-- roadmap:risks -->
- A reescrita de um plano adotado altera o conteúdo, e a checagem só confere a estrutura -> a adoção mostra o que mudou e pede uma aprovação (critério 4).
- Os nomes das skills novas confundem o gatilho com `roadmap-planner` e `plan-coordinator` -> a suíte de gatilho do critério 5 mostra se confundem; trocar o nome antes da publicação de E11 é barato.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E7 phase=spec-plano track=engineering priority=Must size="não estimado" depends=E3,E6,E17 reqs=REQ-008,REQ-009,REQ-013,REQ-016,REQ-020,REQ-027 critical=false -->
### E7 -- Coordinator com mapa e estado em código

Por quê: REQ-009, REQ-027, REQ-013, REQ-016, REQ-008, REQ-020. O `plan-coordinator` não tem script nem teste: grafo, ondas, conflitos de escrita, pontuação e 31 transições de estado são seguidos pelo LLM a partir de prosa (SRC-02 §5). Primeira etapa de DEC-006, reduzida ao que sobrevive à segunda (SRC-10, revisão 3). Começa depois da primeira publicação, para o estado novo do coordinator não entrar na versão compatível (DEC-046).

Peças:

- Peça 1: mapa de execução vindo da ferramenta de plano e da definição de roteamento; os cards de passo viram briefs em arquivo.
- Peça 2: esquema de estado em JSON com as transições como funções puras, usáveis por linha de comando agora e por um workflow depois; a retomada lê o estado e devolve a próxima ação. O estado e os briefs ficam na pasta do plano (DEC-026); o plano é `plan.md` nessa pasta ou o caminho dado pela pessoa.
- Peça 3: paradas incidentais viram padrões (melhor correspondência de plano, base, reexecução), e o prompt do executor proíbe perguntar à pessoa.
- Peça 4: o tracker decide o fechamento de peça pelo estado em JSON, com teste de contrato entre as duas skills.

Arquivos de teste deste card: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`, `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado um estado e uma transição inválida (lançar um passo cuja dependência não passou), quando a função de transição é chamada, então recusa e o estado não muda. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
2. Dado um estado com passos em andamento, quando a retomada o lê, então devolve a próxima ação sem depender da conversa anterior. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
3. Dado o plano de exemplo, quando o estado inicial é criado, então suas ondas, níveis e portões de revisão são os que a ferramenta de plano e a definição de roteamento devolvem. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
4. Dada uma pasta com um único plano de correspondência forte e outra com dois candidatos empatados, quando a seleção por padrão roda, então escolhe o plano na primeira e devolve pergunta na segunda. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
5. Dado o estado de um plano concluído, quando o tracker fecha a peça, então decide pelo estado em JSON, e um teste de contrato falha se o esquema do estado mudar sem o tracker acompanhar. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
6. Dado o repositório após a entrega, quando se procura a palavra superpowers nos arquivos publicados da skill do coordinator, então não há ocorrência, e o prompt do executor proíbe perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
7. Dado um plano sem bloco de dados, quando o coordinator o recebe, então recusa com uma mensagem que aponta o modo de adoção da skill de plano, sem tentar interpretá-lo. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes.

<!-- roadmap:risks -->
- Trocar perguntas por padrões faz o coordinator executar o plano errado -> o padrão vale só quando há uma única correspondência forte; empate continua sendo pergunta (critério 4).
- Arquivos de progresso e planos em andamento em outros projetos estão no formato antigo -> o formato novo chega aos usuários na versão de quebra publicada em E11 (DEC-015), cuja nota de atualização manda terminar o que está em andamento antes de atualizar; plano sem bloco de dados é recusado com mensagem que aponta a adoção (critério 7).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E8 phase=ponta-a-ponta track=engineering priority=Must size="não estimado" depends=E17,E18,E19,E20,E25 reqs=REQ-008,REQ-013,REQ-016,REQ-020,REQ-026,REQ-044 critical=true -->
### E8 -- Release com spec e plano nativos e paradas em código

Por quê: REQ-026, REQ-013, REQ-016, REQ-008, REQ-020, REQ-044. Os estágios de spec e plano dependem de skills externas, o plano é transcrito por um agente e relido por outro, e a decisão de parar depende do que o agente relata (SRC-02 §4, confirmado em SRC-10). Vem depois de E25 porque edita o mesmo arquivo de workflow. A retomada sem repetição saiu para E23.

Peças:

- Peça 1: estágios de spec e plano do workflow usando os autores do plugin, sem pergunta à pessoa. Este card é dono de todos os caminhos de artefato do release (spec, plano, registro da execução, log de revisões, relatório de execução), que deixam a pasta do superpowers e seguem DEC-026: a pasta `docs/plans/<slug do roadmap>-<E>/`, com `spec.md`, `plan.md`, `run.json` e `reviews.md`, e o relatório em `docs/reports/`. O registro da execução só é gravado em E23. Começa sobre a versão publicada em E17.
- Peça 2: guarda para trabalho da versão anterior (DEC-018): uma branch de entregável com commits de tarefa e sem spec nativo para com ação de operador, em vez de receber um spec novo por cima.
- Peça 3: carga do plano conferida por resumo de integridade, sem transcrição nem releitura por LLM: o agente roda o script do plano e devolve a saída com schema, e o workflow recalcula o resumo em JavaScript puro; duas novas tentativas, a última em outro modelo (DEC-059); nível e effort de cada tarefa vêm da definição de roteamento.
- Peça 4: regras de parada em código: como hoje, um item bloqueante que só uma pessoa resolve para o entregável (SRC-04); uma decisão que contraria uma decisão registrada ou um gate também para (DEC-007); uma decisão autônoma marcada como cara de errar e irreversível também para, depois do spec e antes do plano (DEC-020); o resto é registrado como pendente de ratificação e a execução segue. Uma decisão de alcance contrato deixa os dependentes do entregável fora da execução, com o motivo, sem parar os demais (DEC-030).

Arquivo de teste deste card: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado o workflow do release, quando se inspecionam os prompts dos estágios de spec e plano e os caminhos de artefato, então nenhum cita o superpowers e todos os prompts proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
2. Dada uma branch de entregável com commits de tarefa e sem spec nativo, quando o workflow a encontra, então para com ação de operador e não escreve spec. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado um plano cujo resumo de integridade não confere na carga, quando o workflow o recebe e as novas tentativas se esgotam, então encerra o entregável como falha de infraestrutura, sem executar tarefa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dado um plano carregado, quando o workflow despacha uma tarefa, então o modelo e o effort são os devolvidos pela definição de roteamento. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
5. Dado um spec com uma decisão autônoma que contraria uma decisão registrada, quando o workflow aplica as regras de parada, então o entregável para. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
6. Dado um spec com uma decisão autônoma comum, quando o workflow aplica as regras de parada, então ela é registrada como pendente de ratificação e a execução segue. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
7. Dado um spec com uma decisão autônoma marcada como cara de errar e irreversível, quando o workflow aplica as regras de parada, então o entregável para depois do spec, sem escrever o plano. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
8. Dado um entregável que termina com uma decisão autônoma de alcance contrato e um dependente selecionado na mesma execução, quando o workflow chega ao dependente, então ele é pulado citando a decisão, e um entregável sem essa dependência roda. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- Trocar os autores de spec e plano num pipeline sem pessoa deixa passar defeito -> os laços e os revisores atuais de spec e plano são mantidos nesta entrega; mudá-los é decisão de E26.
- A semântica de autorização de efeito externo regride (área com mais correções recentes, SRC-02 §1) -> não alterar essa lógica nesta entrega e manter os testes atuais passando.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E11 phase=ponta-a-ponta track=measurement priority=Must size="não estimado" depends=E7,E8,E15 reqs=REQ-002,REQ-034,REQ-044 critical=false -->
### E11 -- Ponto de medição e publicação da versão de quebra

Por quê: REQ-002, REQ-034, REQ-044. A publicação que sai daqui é a versão de quebra (DEC-015): leva o formato novo de plano do release e o estado novo do coordinator, por isso depende também de E7. Operado pelo dono (DEC-011), com portão por contadores e detecção (DEC-017). As medições de política de spec e plano saíram para E26, que não segura esta publicação.

Peças:

- Peça 1: comparação do release nativo com a linha de base no cenário fixo, incluindo a parada e a retomada.
- Peça 2: ratificação em lote das decisões do executor pendentes, antes da preparação da publicação (DEC-030).
- Peça 3: preparação da versão de quebra pelo executor (versão nos dois lugares, G1 a G5, nota de atualização em `docs/releases/`, fora dos arquivos publicados do plugin (DEC-054): terminar planos e entregáveis em andamento na versão anterior antes de atualizar; planos já escritos entram pela adoção) e publicação pelo dono.
- Peça 4: branch de volta montada pelo executor a partir da ponta da branch de release, e tag da versão que está em `main` criada pelo dono antes do avanço (DEC-036).

<!-- roadmap:acceptance -->
1. Dado o cenário fixo, quando o release nativo roda na branch de release, então a comparação com a linha de base está registrada por contadores e por custo, e a detecção dos defeitos plantados não caiu. {verify: human; evidence: o dono confere as linhas de comparação em measurements.md}
2. Dada a comparação sem piora nos contadores e sem queda na detecção, pela saída do comparador de E1, quando o dono publica, então a versão de quebra existe no cache do plugin, com a nota de atualização disponível; custo inconclusivo não bloqueia (DEC-017). {verify: human; evidence: o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache}
3. Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
4. Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
5. Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}
6. Dados um plano com bloco de dados e um estado do coordinator em JSON, quando a versão anterior os recebe num sandbox, então o comportamento (recusa, ignora ou lê errado) está registrado e a nota de atualização o descreve. {verify: human; evidence: o dono confere o resultado registrado em docs/reports}
<!-- /roadmap:acceptance -->

Definição de pronto: comparação registrada; decisões do executor ratificadas pelo dono; G1 a G5 verdes na branch de release; versão publicada conferida pelo dono.

<!-- roadmap:risks -->
- A comparação mostra piora nos contadores ou queda na detecção -> não publicar; abrir um bloqueio no entregável responsável.
- Projetos com planos ou entregáveis em andamento quebram ao atualizar -> a nota de atualização orienta a terminar na versão anterior; não publicar com entregável deste roadmap em execução, nem com um lote de medição de E26 rodando.
- A versão de quebra falha num projeto em uso -> corrigir adiante como versão de correção; a volta ao conteúdo anterior é o último caso, e trabalho iniciado na versão de quebra termina nela ou recomeça do plano (DEC-036).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E26 phase=ponta-a-ponta track=measurement priority=Must size="não estimado" depends=E8,E15 reqs=REQ-015 critical=false -->
### E26 -- Medição de política: revisão de spec e plano e modelo do autor de plano

Por quê: REQ-015. Spec, plano e as revisões deles são a maior fatia do release (SRC-02 §9A), e as fontes divergem sobre o laço de revisão e sobre o modelo do autor de plano (SRC-02 §8, SRC-08 seção 0). Medição obrigatória (DEC-010), operada pelo dono (DEC-011) com o arnês de estágio de E1. Fatia de E11: o resultado é uma decisão, não um portão de publicação, e não depende de E7.

Peças:

- Peça 1: revisão do spec em três braços: o revisor e o laço atuais, uma única rodada, e a leitura que devolve só perguntas.
- Peça 2: revisão do plano em dois braços, o laço atual e uma única leitura, sobre os defeitos de plano plantados.
- Peça 3: autor de plano em dois modelos: rodadas de correção por tarefa e falhas de gate adiante.

<!-- roadmap:acceptance -->
1. Dada cada medição de política, quando ela termina, então os braços, o número de execuções por braço e o resultado estão registrados. {verify: human; evidence: o dono confere as linhas das medições em measurements.md}
2. Dado o resultado de cada medição, quando a política é definida, então há uma decisão registrada que cita a medição, e nenhum laço ou modelo muda sem a ratificação do dono; resultado inconclusivo mantém o atual. {verify: human; evidence: o dono ratifica as linhas de decisão em decisions.md}
<!-- /roadmap:acceptance -->

Definição de pronto: medições registradas em `measurements.md` e decisões de política ratificadas pelo dono.

<!-- roadmap:risks -->
- Poucas execuções por braço não separam os braços -> registrar o número de tentativas e tratar resultado inconclusivo como "manter o atual".
- Uma decisão de política deixada pendente segura a publicação de E11 ou de E16 (DEC-030) -> a linha de decisão só é registrada na passada de ratificação deste card, já com a resposta do dono; medição em andamento não gera linha pendente.
- Uma publicação troca a versão no meio de um lote -> cada linha registra versão e commit, e o dono não publica com um lote rodando.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E9 phase=ponta-a-ponta track=engineering priority=Must size="não estimado" depends=E8 reqs=REQ-008,REQ-013,REQ-028 critical=true -->
### E9 -- Implementador e corretor nativos

Por quê: REQ-028, REQ-013, REQ-008. O release aponta implementadores e corretores para skills externas (SRC-02 §4), e a disciplina de teste primeiro não é conferida por código. Primeira das três fatias da execução e revisão nativas (E9, E21, E24): as revisões por tarefa e final continuam as de hoje nesta entrega.

Peças:

- Peça 1: implementador do plugin, que lê o brief da tarefa, não pergunta à pessoa, trabalha com teste primeiro e devolve a evidência de teste falhando e passando.
- Peça 2: conferência em código dessa evidência, antes de qualquer chamada de revisor.
- Peça 3: modo de correção no mesmo papel, usado pelos corretores de código do workflow (por tarefa, revisão final, gates, merge e sincronização).

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`.

<!-- roadmap:acceptance -->
1. Dada uma tarefa de teste primeiro sem verificação falhando antes da verificação passando, quando o workflow recebe o retorno do implementador, então a tarefa falha em código, sem chamada de revisor. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
2. Dada uma tarefa já commitada por uma execução anterior e retomada sem verificações relatadas, ou uma tarefa que o plano não marca como teste primeiro, quando o workflow aplica a conferência, então a tarefa não é reprovada por ela e segue para a revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
3. Dados os prompts de implementador e de corretor de código (por tarefa, revisão final, gates, merge e sincronização), quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O implementador nativo, sem a skill externa de teste primeiro, entrega tarefas piores que o atual -> as revisões por tarefa e final de hoje são mantidas nesta entrega, e E16 compara a detecção com a linha de base antes de a fase ser publicada.
- A conferência de teste primeiro reprova tarefa legítima (retomada, sem arquivos, ou que o plano não marca como teste primeiro) -> a conferência só vale para tarefa marcada como teste primeiro e lançada nesta execução; o critério 2 confere.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E21 phase=ponta-a-ponta track=engineering priority=Must size="não estimado" depends=E9 reqs=REQ-008,REQ-013,REQ-014 critical=true -->
### E21 -- Revisor por tarefa com achados identificados

Por quê: REQ-014, REQ-013, REQ-008. O release detecta achado repetido por comparação de texto (SRC-02 §4). SRC-08 propõe fundir os dois laços de revisão por tarefa e restringir a nova revisão; as duas mudanças reduzem revisão e por isso entram como modos desligados, com o padrão decidido em E27 (DEC-021). Vem depois de E9 porque edita o mesmo arquivo de workflow.

Peças:

- Peça 1: achados com identificador devolvido pelo revisor, e repetição reconhecida pelo identificador. É o padrão: substitui a comparação de texto sem reduzir revisão.
- Peça 2: nova revisão restrita aos achados abertos e ao diff da correção, com um veredicto por identificador, como modo desligado por padrão; pacote de revisão gravado por script.
- Peça 3: revisor do plugin para a revisão por tarefa. A revisão em dois laços, como hoje, continua o padrão, no modelo que o release usa hoje; a revisão única com dois veredictos existe como modo.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`, `plugins/productivity-tools/scripts/review-package.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado um achado reaberto com outra redação e o mesmo identificador, quando o workflow compara as rodadas, então o reconhece como repetição. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
2. Dada a configuração padrão, quando o workflow despacha uma nova revisão após uma correção, então o revisor relê o intervalo inteiro da tarefa, como hoje; com o modo de revisão restrita ligado, recebe só os achados abertos e o diff da correção e devolve um veredicto por identificador. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
3. Dada a configuração padrão, quando o workflow revisa uma tarefa, então usa o modo e o modelo de revisão que o release usa hoje; com o modo de revisão única ligado, faz uma chamada que devolve os dois veredictos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
4. Dadas a base e a ponta do intervalo de uma tarefa, quando o script do pacote de revisão roda, então grava um único arquivo com o diff do intervalo e recusa um intervalo inválido. {verify: test; evidence: node --test plugins/productivity-tools/scripts/review-package.test.mjs}
5. Dados os prompts de revisão por tarefa, em todos os modos, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O revisor nativo detecta menos defeitos que o atual -> E16 compara a detecção com a linha de base antes de a versão ser publicada.
- Um modo de revisão reduzida vira padrão sem medição -> os critérios 2 e 3 fixam o padrão atual; só E27 o muda, com decisão ratificada.
- O laço de revisão é compartilhado com as revisões de spec, de plano, final e de sincronização -> identificador e modos são ligados por estágio, só na revisão por tarefa, e os testes atuais do laço continuam passando (G1).
- O script do pacote de revisão roda por caminho do cache e pode pedir permissão -> o script continua no plugin e a regra casa pelo nome do arquivo (DEC-060); o preflight de E18 lista a regra.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E23 phase=ponta-a-ponta track=engineering priority=Must size="não estimado" depends=E8,E21 reqs=REQ-011,REQ-036 critical=true -->
### E23 -- Retomada do release sem repetir revisões

Por quê: REQ-011, REQ-036. Cada retomada do release refaz discovery, preflight e as revisões de spec, plano e final mesmo sem mudança (SRC-02 §4, confirmado em SRC-10). Fatia de E8: usa os caminhos de artefato e o resumo de integridade do plano que E8 fixa. Vem depois de E21 porque edita o mesmo arquivo de workflow, fora da cadeia E8, E9, E21 para não alongá-la.

Peças:

- Peça 1: registro da execução gravado por script na branch, com o que foi aprovado (spec, plano, árvore da branch, ponta do alvo sincronizada).
- Peça 2: retomada que pula a revisão de spec, de plano e final quando esses quatro valores são os do registro, e reaproveita a medição de preparação quando o alvo não mudou.

Arquivo de teste deste card: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, que já existe e ganha os casos deste card.

<!-- roadmap:acceptance -->
1. Dada uma retomada em que spec, plano, árvore da branch e ponta do alvo são os registrados na aprovação, quando o workflow roda, então não faz nenhuma chamada de revisão de spec, de plano nem final. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
2. Dada uma retomada em que o alvo avançou desde a aprovação, quando o workflow roda, então a revisão final roda de novo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dada uma retomada com o alvo inalterado, quando o workflow chega à preparação, então reaproveita a medição registrada dos gates em vez de medir de novo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- Gravar a aprovação move a ponta da branch e invalida a própria chave de retomada -> a chave usa a árvore e os arquivos, nunca a ponta da branch.
- A retomada pula uma revisão que devia rodar (área com mais correções recentes, SRC-02 §1) -> sem registro, ou com qualquer dos quatro valores diferente, a retomada revisa como hoje; a lógica de efeito externo não é alterada nesta entrega e os testes atuais continuam passando.
- A medição de preparação é feita uma vez por execução, no alvo, e o registro é por entregável, na branch -> o spec decide onde a medição fica guardada, e ela só é reaproveitada com a ponta do alvo igual à registrada (critério 3).
- O script do registro não tem arquivo de teste nomeado neste card -> conferir o caminho no spec e corrigir o card pela estratégia antes da execução.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E24 phase=ponta-a-ponta track=engineering priority=Should size="não estimado" depends=E21,E23 reqs=REQ-008,REQ-013,REQ-030 critical=false -->
### E24 -- Revisão final com verificação adversarial

Por quê: REQ-030, REQ-013, REQ-008. A revisão final gera correção para todo achado bloqueante sem verificação adversarial (SRC-02). Descartar um achado por refutação e limitar a correção final a uma onda reduzem revisão, e por isso entram como modos desligados, com o padrão decidido em E27 (DEC-021). Should (DEC-022): acrescenta chamadas no modelo mais caro, e a versão final não depende dele. Vem depois de E21 e de E23 porque edita o mesmo arquivo de workflow.

Peças:

- Peça 1: verificação adversarial de cada achado bloqueante da revisão final, como modo desligado por padrão; ligada, só o achado refutado explicitamente deixa de gerar correção, e fica registrado.
- Peça 2: o número de rodadas de correção final continua o atual; a onda única existe como modo.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado o modo de verificação adversarial ligado e um achado bloqueante que a verificação refuta, quando o workflow o processa, então ele não gera correção e fica registrado como refutado no resultado da revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
2. Dado o modo ligado e um achado que a verificação confirma, ou cuja verificação não devolve resultado, quando o workflow o processa, então ele segue para a correção. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
3. Dada a configuração padrão, quando a revisão final tem achados bloqueantes, então todos geram correção, sem chamada de verificação, e o número de rodadas é o que o release usa hoje; com o modo de onda única ligado, há um só despacho de correção e uma só nova revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
4. Dados os prompts da revisão final e da verificação adversarial, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- A verificação adversarial refuta um defeito real -> o modo fica desligado até E27 medir; ligado, só a refutação explícita tira o achado da correção, e o achado refutado fica registrado.
- A verificação acrescenta chamadas no modelo da revisão final -> os contadores por papel de E1 a medem, e E27 registra a comparação.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E16 phase=ponta-a-ponta track=measurement priority=Must size="não estimado" depends=E11,E15,E21 reqs=REQ-002,REQ-034,REQ-044 critical=true -->
### E16 -- Ponto de medição e publicação da execução nativa

Por quê: REQ-002, REQ-034, REQ-044. Compara o implementador e o revisor nativos com a linha de base e publica a versão que os leva. Operado pelo dono (DEC-011), com portão por contadores e detecção (DEC-017). Vem depois de E11 porque publica sobre a versão de quebra. As medições de política da revisão por tarefa saíram para E27, que não segura esta publicação.

Peças:

- Peça 1: comparação da execução e revisão nativas com a linha de base no cenário fixo, com a taxa de detecção dos defeitos plantados, no modo padrão.
- Peça 2: ratificação em lote das decisões do executor pendentes, antes da preparação da publicação (DEC-030).
- Peça 3: preparação da publicação pelo executor e publicação pelo dono.
- Peça 4: branch de volta montada pelo executor a partir da ponta da branch de release, e tag da versão que está em `main` criada pelo dono antes do avanço (DEC-036).

<!-- roadmap:acceptance -->
1. Dado o conjunto de defeitos plantados, quando o pipeline nativo roda no modo padrão, então a taxa de detecção não é inferior à da linha de base e a comparação por contadores e por custo está registrada. {verify: human; evidence: o dono confere as linhas de comparação em measurements.md}
2. Dada a comparação sem piora nos contadores e sem queda na detecção, pela saída do comparador de E1, quando o dono publica, então a versão nova existe no cache do plugin; custo inconclusivo não bloqueia (DEC-017). {verify: human; evidence: o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache}
3. Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
4. Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
5. Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}
<!-- /roadmap:acceptance -->

Definição de pronto: comparação registrada; decisões do executor ratificadas pelo dono; G1 a G5 verdes na branch de release; versão publicada conferida pelo dono.

<!-- roadmap:risks -->
- A comparação mostra piora nos contadores ou queda na detecção -> não publicar; abrir um bloqueio no entregável responsável.
- O cenário tem poucas tarefas e a fatia medida é pequena -> o cenário fixo de E1 tem um entregável de várias tarefas.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E27 phase=ponta-a-ponta track=measurement priority=Must size="não estimado" depends=E15,E21 reqs=REQ-039 critical=true -->
### E27 -- Medição de política: revisão por tarefa

Por quê: REQ-039. O release revisa cada tarefa em sonnet por padrão e o coordinator fixa opus nos passos com portão; o roteamento do coordinator proíbe mover o modelo sem evidência medida (SRC-04), e a medição que o desenho anterior alega não está no repositório (SRC-07). Os modos de revisão reduzida de E21 e E24 só viram padrão por decisão tomada aqui (DEC-021). Medição obrigatória (DEC-010), operada pelo dono com o arnês de estágio de E1. Fatia de E16: o resultado é uma decisão, não um portão de publicação.

Peças:

- Peça 1: revisor por tarefa em dois modelos.
- Peça 2: dois laços por tarefa contra a revisão única com dois veredictos.
- Peça 3: nova revisão completa contra a restrita aos achados e ao diff.
- Peça 4: só se E24 estiver integrado: verificação adversarial ligada contra desligada, rodadas de correção final como hoje contra a onda única, e, no teto de rodadas, parar contra decidir e seguir.

<!-- roadmap:acceptance -->
1. Dada cada medição de política, quando ela termina, então os braços, o número de tentativas por braço e o resultado estão registrados. {verify: human; evidence: o dono confere as linhas das medições em measurements.md}
2. Dado o resultado de cada medição, quando a política é definida, então há uma decisão registrada que cita a medição, e nenhum modelo, modo ou número de rodadas muda sem a ratificação do dono; resultado inconclusivo mantém o atual. {verify: human; evidence: o dono ratifica as linhas de decisão em decisions.md}
<!-- /roadmap:acceptance -->

Definição de pronto: medições registradas em `measurements.md` e decisões de política ratificadas pelo dono.

<!-- roadmap:risks -->
- Poucas tentativas por braço não separam os braços -> registrar o número de tentativas e tratar resultado inconclusivo como "manter o atual".
- Uma decisão de política deixada pendente segura uma publicação (DEC-030) -> a linha de decisão só é registrada na passada de ratificação deste card, já com a resposta do dono.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E10 phase=ponta-a-ponta track=engineering priority=Should size="não estimado" depends=E2,E18,E24 reqs=REQ-012 critical=false -->
### E10 -- Release mecânico por código

Por quê: REQ-012. Parte das chamadas de agente por entregável é só git ou medição, porque o script de workflow não tem acesso a arquivos nem a shell (SRC-02 §4). Vem depois de E24 porque edita o mesmo arquivo de workflow.

Peças:

- Peça 1: descoberta dos cards, status e bloqueios pelo parser único, com as checagens de git em script.
- Peça 2: operações de git agrupadas por fase num único portador barato, em vez de uma chamada por comando.
- Peça 3: verificação pós-execução em script.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

<!-- roadmap:acceptance -->
1. Dada a pasta de exemplo, quando o script de descoberta roda, então devolve cards, dependências, status e bloqueios iguais aos lidos pelo checker. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado um repositório após uma execução, quando o script de verificação roda, então devolve aprovado ou a lista de divergências entre o relatado e o git. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs}
3. Dado um entregável de uma tarefa no caminho sem falhas, quando o workflow roda com agentes simulados, então o número de chamadas de agente é menor que o do workflow anterior no mesmo roteiro, e uma falha num comando agrupado interrompe o grupo e é devolvida. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- Agrupar comandos de git num portador esconde uma falha parcial -> o script devolve o resultado de cada comando e para no primeiro erro (critério 3).
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E12 phase=coordinator-workflow track=engineering priority=Must size="não estimado" depends=E7,E9,E21 reqs=REQ-010,REQ-017,REQ-033 critical=true -->
### E12 -- Coordinator como workflow do plugin

Por quê: REQ-010, REQ-017, REQ-033. O contexto principal é a maior parcela do custo do coordinator (SRC-02 §9A); num workflow o script guarda o laço e os resultados intermediários, e a sessão recebe só o resultado final (SRC-06). Segunda etapa de DEC-006.

Peças:

- Peça 1: workflow embarcado no plugin que executa as ondas do mapa com o implementador de E9 e o revisor de E21, com retorno validado por esquema e as funções de estado, autorização e marcas embutidas pelo gerador de E2.
- Peça 2: retomada pelo estado em JSON de E7.
- Peça 3: passos externos e autorização tratados como parada do workflow, com a autorização presa ao resumo de integridade do plano.
- Peça 4: a skill vira uma entrada curta e o protocolo de delegação em prosa é reduzido ao que o workflow não cobre.

Arquivos de teste deste card: `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`, `plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs`.

<!-- roadmap:acceptance -->
1. Dado o plano de exemplo com duas ondas, quando o workflow roda, então os passos de uma mesma onda são despachados juntos e nenhum passo começa antes da sua dependência passar. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}
2. Dado um passo externo sem autorização, quando o workflow chega a ele, então para antes do efeito e devolve o item a autorizar; uma autorização dada para outro plano não vale. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}
3. Dada uma execução parada no meio, quando o workflow é relançado com o estado gravado, então não reexecuta passos concluídos nem repete um efeito externo já feito. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}
4. Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa que a sessão principal carrega antes de lançar o workflow não é maior que a meta derivada registrada na estratégia. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs}
5. Dado o workflow do coordinator, quando o plugin é carregado, então ele está registrado no manifesto com o nome `coordinator-workflow` (DEC-041) e a skill o lança pelo nome; lançado sem o plano ou sem o estado, para antes de qualquer agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O workflow não recebe entrada da pessoa no meio da execução -> a autorização acontece entre lançamentos, com o estado gravado.
- O lançamento do workflow pede consentimento -> ele acontece com a pessoa presente; o lançamento pelo nome permite não perguntar de novo, e a regra informada pela skill libera a execução sem interface (DEC-035), o que o experimento confirmou, inclusive na sessão interativa (SRC-14).
- A lógica de autorização e retomada é duplicada da do release -> as duas usam as mesmas funções pelo gerador de E2.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E13 phase=publicacao track=release priority=Must size="não estimado" depends=E2,E3,E7,E9,E11,E12,E16,E17,E18,E21,E23,E25,E26,E27 reqs=REQ-002,REQ-008,REQ-034,REQ-044,REQ-045 critical=true -->
### E13 -- Fechamento: independência completa e medição final

Por quê: REQ-008, REQ-034, REQ-002, REQ-044, REQ-045. A quebra de formato já saiu em E11 (DEC-015); o fechamento prova que nenhuma skill, agente, prompt ou script publicado depende do superpowers, mede o coordinator como workflow e o conjunto das quatro skills, e publica a versão final.

Peças:

- Peça 1: teste de independência sobre as skills, os agentes, os prompts e os scripts publicados do plugin; um crédito de inspiração pode existir na documentação (DEC-019). Descrições das skills, README, diagramas e instruções do repositório atualizados.
- Peça 2: medição final: o coordinator como workflow e o conjunto das quatro skills contra a linha de base, com o plano fixo reescrito no formato novo e isso registrado.
- Peça 3: preparação da versão pelo executor e publicação pelo dono.
- Peça 4: ratificação em lote das decisões do executor pendentes, antes da preparação da publicação (DEC-030).
- Peça 5: branch de volta montada pelo executor a partir da ponta da branch de release, e tag da versão que está em `main` criada pelo dono antes do avanço (DEC-036).

Arquivo de teste deste card: `plugins/productivity-tools/scripts/independence.test.mjs` (criado em E20; este card o estende ao plugin inteiro).

<!-- roadmap:acceptance -->
1. Dados as skills, os agentes, os prompts e os scripts publicados do plugin, sem contar os testes nem a documentação de crédito, quando se procura a palavra superpowers, então não há ocorrência. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs}
2. Dada a linha de base de E15, quando a versão final roda o cenário fixo, então a comparação por skill está registrada por contadores e por custo, incluindo o coordinator como workflow, sem piora nos contadores, pela saída do comparador de E1. {verify: human; evidence: o dono confere as linhas de comparação em measurements.md}
3. Dada a comparação sem piora nos contadores, pela saída do comparador de E1, quando o dono publica, então a versão final existe no cache do plugin e as skills carregam; custo inconclusivo não bloqueia (DEC-017). {verify: human; evidence: o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache}
4. Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
5. Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
6. Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}
7. Dadas as metas derivadas, quando a medição final termina, então cada meta está marcada atingida ou não atingida em measurements.md, e cada não atingida tem decisão do dono: aceitar com motivo ou abrir um entregável (DEC-034). {verify: human; evidence: o dono confere as linhas de meta e registra as decisões}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa em `main`; G1, G2, G3, G4 e G5 verdes; versão igual em `plugin.json` e no README (regras de SRC-03).

<!-- roadmap:risks -->
- Publicar exige push, que o executor nunca faz sozinho -> o executor prepara, para antes do push, e o dono autoriza e confere (DEC-007).
- A versão final precisa ser desfeita -> manter a versão anterior instalável e registrar o caminho de volta na nota de atualização.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

## Gates e verificação

<!-- roadmap:gates -->
| ID | Comando | Ambiente | Quando | Linha de base |
|---|---|---|---|---|
| G1 | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` | local | cada tarefa e antes de cada commit | 800 testes, 0 falhas (medido em 2026-11-11 com este comando, no commit `0e443ce`) |
| G2 | `claude plugin validate .` | local | antes de cada commit | passa |
| G3 | `claude plugin validate plugins/productivity-tools` | local | antes de cada commit que toca o plugin | passa |
| G4 | `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` | local | antes de cada commit que muda o checker ou o contrato de formato | 0 erros, 0 avisos |
| G5 | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` | local | antes de cada commit que toca o plugin | passa |
<!-- /roadmap:gates -->

G1 a G4 vêm de SRC-03; G5 é o comando do lint dado em SRC-09. Desde a integração de E1, G1 inclui o padrão `tools/**/*.test.mjs`, com a mesma mudança no `CLAUDE.md` (DEC-032). A suíte de gatilho de E20 não é gate: é rodada pelo dono como critério do card (DEC-025). Regra sem comando (SRC-03): mudança que altera o comportamento de uma skill passa por teste comportamental, com um subagent seguindo a skill ao pé da letra numa entrada real e uma revisão adversarial do resultado.

## Métricas e metas

A linha de base parcial, medida nas sessões reais, está em SRC-02 §9A; a linha de base completa é o resultado de E15 e fica em `measurements.md`.

As metas são derivadas, não fornecidas (DEC-034): o spec de cada entregável que promete economia declara o contador, a variante e o valor previsto, calculado como a linha de base menos o que a mudança remove por construção (chamadas eliminadas, prosa que deixa de ser carregada, revisões puladas na retomada). O ponto de medição seguinte confere o previsto pelo comparador de E1. Meta não atingida não bloqueia a publicação: é registrada e, em E13, exige decisão do dono. Custo em dólar, tempo e turnos não têm meta; ficam registrados com mediana e faixa. A detecção de defeitos só tem a regra de não cair.

O portão de publicação (DEC-017, DEC-033) compara totais por variante: contadores estruturais por mediana, com 3% de tolerância nos bytes de prompt; contadores que dependem de escolhas do modelo só acusam piora quando todas as execuções novas ficam acima de todas as antigas; a detecção bloqueia quando as capturas caem seis ou mais em 40 tentativas por classe. Um aumento de bytes de prompt acima da tolerância pode ser liberado pelo dono com decisão registrada.

### Metas derivadas

Linha de base: `docs/reports/2026-11-11-e15-linha-de-base/linha-de-base.md` (tag `productivity-tools--v1.6.0`, commit 3fbb59b, modo `bypassPermissions` em todas as variantes; os pontos de medição usam o mesmo modo). Meta = linha de base menos o que a mudança remove por construção (DEC-034). Pesos do ponderado: haiku 1, sonnet 20, opus 40.

| Entregável | Contador | Variante | Linha de base | Cálculo | Meta | Conferida em |
|---|---|---|---|---|---|---|
| E4 | prosa carregável do planner, bytes LF | estático | 74.602 (SRC-02 §1; DEC-167) | 74.602 − 31.267 | ≤ 43.335 | E17 |
| E22 | prosa do tracker por evento, bytes LF | estático | 90.874 (SRC-02 §1; DEC-235) | 90.874 − 61.778 | ≤ 29.096 | E17 |
| E23 | chamadas opus | parada-retomada | 9 | 9 − 2: revisão de spec e de plano não repetidas na retomada | 7 | E13 |
| E23 | ponderado | parada-retomada | 669 | 669 − 2 × 40 | 589 | E13 |
| E12 | chamadas (principal) | coordinator | 4 | 4 − 4: o despacho passa ao workflow | 0 | E13 |
| E10 | total de chamadas (haiku + sonnet + opus) | completo | 23 | 23 − 1: mínimo do critério 3 do card | ≤ 22, provisória | E13 |

Sem meta numérica: E3 (o tracker não lança subagente; turnos não têm meta); E18 (o registro segue numa chamada de agente, que passa a rodar a CLI); E8, E19, E20, E9 e E7 (trocam autor ou conferência sem eliminar papel); E21 e E24 (modos desligados, DEC-021); bytes de E23 (a linha de base não isola a chamada da retomada); prosa de E12 (derivada no spec de E12 e registrada por nova revisão). Para esses vale só a regra de não piorar do portão.

As metas de E23 valem se a retomada do cenário mantiver spec e plano aprovados; o spec de E23 confirma. A meta de E10 é substituída pelo valor que o spec de E10 declarar.

## Riscos transversais

- As quatro skills mudam enquanto executam este mesmo roadmap -> regras da seção "Execução deste roadmap": cada entregável roda na versão publicada no seu início.
- Entregáveis diferentes editam o mesmo arquivo de workflow do release -> eles estão em sequência nas dependências (E18, E25, E8, E9, E21, E23, E24, E10), não em paralelo.
- Outras sessões compartilham o checkout deste repositório -> trabalhar em worktree a partir de uma base explícita.
- Regressão na semântica de efeito externo e de retomada, a área com mais correções recentes -> não reescrever essa lógica fora do entregável que a nomeia e manter a suíte atual passando (G1).
- Ganho alegado sem medição -> toda publicação passa por um ponto de medição (REQ-002, DEC-017), e cada economia prometida tem meta derivada conferida (DEC-034).
- Uma decisão do executor é rejeitada depois de um dependente construído em cima dela -> alcance registrado em cada decisão, dependentes retidos e nenhuma publicação com pendência (DEC-030).
- Uma publicação quebra um projeto em uso -> tag e branch de volta ensaiada antes de cada publicação (DEC-036).
- Critério que depende do dono não bloqueia o merge na branch de release -> o que ele bloqueia é a publicação, que é ato do dono.
- Os comandos de verificação dos cards nomeiam arquivos que ainda não existem, e o release rejeita plano que os altere -> conferir os caminhos no spec de cada entregável e corrigir o card pela estratégia antes da execução.
- As fatias de um mesmo card dividido tocam os mesmos arquivos (a CLI do tracker em E3, E18 e E22; a skill do tracker em E22, E7 e E20; a skill do planner em E4 e E20; o workflow do release em E18 e E25, em E8 e E23, e em E9, E21 e E24) -> um comando ou função nova entra pela fatia que criou o arquivo, por revisão do card; E22, E7 e E20 não rodam ao mesmo tempo, nem E4 e E20, o que a trava de DEC-044 garante enquanto a configuração do release for gerada.
- Até a versão de quebra o release instalado grava spec, plano, log e relatório na pasta do superpowers -> os artefatos de E1 a E8 deste roadmap ficam lá e não são migrados (DEC-055).
- O superpowers está habilitado nas configurações do dono, e as skills dele disputam o gatilho com as novas -> a suíte de gatilho de E20 registra se ele estava habilitado.

## Decisões

Ver `decisions.md`. Esta versão absorve DEC-001 a DEC-084; todas as decisões do executor estão ratificadas pelo dono.

## Pendências externas

Nenhuma.

## Questões em aberto

- O laço de revisão de spec e plano e o modelo do autor de plano ficam como estão até E26 (REQ-015); o modelo e o modo da revisão por tarefa, até E27 (REQ-039).
- Dos três experimentos de DEC-052 (resultados em SRC-14) resta:
  - o lançamento pelo nome e a concessão por `allowed-tools` com o plugin instalado do cache, que a sonda não pôde testar e o critério do dono em E25 confere (DEC-061);
  - a receita de fixar a loja numa tag foi vista com fonte git local; a loja do GitHub fica para a primeira publicação com tag (DEC-056);
  - a taxa de reescrita de um plano semeado e a taxa de detecção, que uma execução não mede, são de E15 (DEC-051).

## Resumo de cobertura

44 requisitos: 40 cobertos, 2 a esclarecer (REQ-015 por E26, REQ-039 por E27) e 2 fora de escopo (REQ-022, REQ-023).

## Histórico de versões

| Versão | Data | Resumo |
|---|---|---|
| 1.0 | 2026-11-10 | Primeira versão |
| 1.1 | 2026-11-10 | Absorve as decisões das sondas de E14 (DEC-057 a DEC-061) |
| 1.2 | 2026-11-10 | Absorve as emendas do dono às decisões do spec de E1 (DEC-081 a DEC-084) |
| 1.3 | 2026-11-11 | Tabela de gates atualizada após a integração de E1: G1 com `tools/**`, G4 reconhecido como local |
| 1.4 | 2026-11-12 | Tabela de metas derivadas após a linha de base de E15 (DEC-034) |

## Fontes

Ver `sources.md`.
