<!-- Três análises feitas por subagents Fable 5.2 (effort medium) em 2026-11-10 sobre as decisões do dono e as questões em aberto do roadmap docs/plans/roadmap-evolucao-skills/. Gravadas sem edição pela sessão principal. Fonte SRC-11 do roadmap. As recomendações são dos subagents; o que o dono decidiu está em decisions.md. -->


---

# Análise 1: decisões registradas (fidelidade, consequências, solidez, ratificações, decisões que faltam)

## Revisão das decisões do roadmap "Evolução das skills de roadmap"

Revisão só de leitura; nada foi editado nem executado além de `git status` e buscas. A pasta do roadmap ainda não está commitada, então as correções de linha em `decisions.md` cabem agora, antes do primeiro commit; depois dele, só por linha nova.

Abreviações: EST = estratégia, DECS = `decisions.md`, WF = `roadmap-release.js`, PESQ = pesquisa, REV = revisões.

## A. Fidelidade (DEC-001 a DEC-011)

1. **DEC-004 registra a inferência do planejador como decisão do dono.** O dono disse "se for suficiente não medir, usar os dados reais". A segunda frase da linha ("bastam só para o plan-only, então o resto é medido com cenário fixo") é achado da pesquisa mais a escolha do ramo "senão", que o dono nunca fez. Além disso, "onde elas bastam" (por skill) é uma leitura; a resposta também admite "tudo ou nada".
   - Correção: reduzir a linha a "usar os dados reais das sessões como linha de base; se bastarem, não medir". Levar o achado para a tabela de suposições ou para uma DEC nova de origem executor, pendente.
   - Pergunta ao dono: "Os dados reais só aproximam o plan-only. Para o resto: (a) pagar a linha de base de E15, (b) aceitar os dados reais como aproximação e comparar só contadores, (c) medir só release e coordinator?"

2. **DEC-011 acrescenta dois compromissos.** A opção escolhida dizia: ponto por fase, operado pelo dono, contadores como métrica principal. A linha acrescenta "que são o portão para publicar a fase" e "custo é secundário". O portão amarra DEC-011 a DEC-009 e vem de REV revisão 3, achados 2 e 10, não da resposta.
   - Correção: tirar as duas frases da linha, ou confirmar com o dono: "o ponto de medição bloqueia a publicação da fase?"

3. **DEC-005 operacionaliza além da resposta e perde uma parte.**
   - "Invoca, cita ou depende de skill ou caminho" é do planejador. O "cita" virou REQ-008 e o teste de zero ocorrências da palavra (E13 critério 1), que proíbe até um crédito ou nota de licença. A fonte é MIT (`sources.md`, SRC-05).
   - Caiu "crie algo melhor ... com base nos objetivos". O roadmap só exige "não pior" (E11 critério 1, E16 critério 1).
   - Correção: a linha fica "Independência total do superpowers; ele serve de inspiração para um desenho próprio, melhor para os objetivos". O "não cita" vira questão ao dono (ver C2).

4. **DEC-007 perdeu "push e publicação ficam sempre com o dono".** A regra existe na EST, linha 58, mas atribuída a "DEC-009 e SRC-03".
   - Correção: acrescentar a frase à linha e trocar a atribuição na EST para DEC-007.

5. **DEC-010 diz mais que "Must, dividido em dois".**
   - A reafirmação "os dez Must continuam; E4 e E10 continuam Should" existe só para sustentar a substituição de DEC-008.
   - A coluna "Contradiz" está "-", embora a linha mude o "E11 é Could" de DEC-008.
   - "E16 ... depois de E9" já não bate com o grafo: E16 depende de E21 e E24.
   - Correção: "Contradiz: DEC-008"; decisão reduzida a "a medição da política de revisão é Must e dividida em dois pontos (spec e plano; revisão por tarefa)".

6. **DEC-008 registra a classificação do planejador como decisão.** O dono respondeu "manter os 10 como Must"; "E4 e E10 são Should; E11 é Could" era proposta. Efeito pequeno.

7. **DEC-009 é fiel se "por fase" estava no texto da opção.** O problema dela é de consequência (B1, B2).

8. **Menores.**
   - DEC-002 fixa como decidido o nome `release/roadmap-skills-v2`, que era exemplo. Sem efeito, já que `roadmap.config.json` usa o mesmo nome.
   - DEC-003 acrescenta "a ordem segue só as dependências", coerente com `clarify.md` §5.4.
   - DEC-001 e DEC-006 estão fiéis.
   - A ordem das linhas em DECS é DEC-010, DEC-012, DEC-011, DEC-013: o arquivo é só de acréscimo e DEC-012 usa conceitos de DEC-011. Reordenar antes do commit.

## B. Consequências (o roadmap segue as decisões?)

1. **DEC-009 contra E7 e E8: formato que quebra entra antes do corte final.** É o achado de maior consequência.
   - E7 troca o arquivo de progresso por JSON e diz que "o formato novo só chega aos usuários na versão de quebra" (EST linha 473).
   - E8 troca spec e plano pelos nativos; E11 é "o portão para publicar o release nativo" (linha 515) e E16 "para publicar a execução nativa" (linha 627).
   - Uma publicação da branch de release depois de E11 ou E16 leva E7 e E8 juntos. Só E2 tem critério de compatibilidade (critério 2).
   - SRC-08 seção D já previa "finish them on 1.x before upgrading", ou seja, quebra.
   - Correção: ou E7 e E8 ganham critério "artefato do formato antigo continua aceito até E13", ou a publicação da fase ponta-a-ponta é declarada a de quebra e E13 vira limpeza. Decisão do dono (ver lista final).

2. **DEC-009 e DEC-011 dizem "por fase"; só uma fase publica.** REQ-034 e REQ-002 estão marcados "coberto" mesmo assim.
   - Base: nenhum ponto de publicação (E15 é linha de base). E2 muda o checker, e a regra do repositório pede bump a cada mudança dele.
   - spec-plano e coordinator-workflow: nenhum ponto de medição nem publicação.
   - ponta-a-ponta: dois pontos (E11, E16).
   - E12 só é medido dentro de E13, a própria versão de quebra, sem cláusula "sem piora" como a de E17.
   - Correção: reescrever DEC-009 e DEC-011 por nova DEC como "publicação nos pontos E17, E11/E16 e E13", ou criar os pontos que faltam. REQ-034 e REQ-002 passam a "a-esclarecer" até lá.

3. **E17 é Must e "portão", mas nada depende dele.** Nenhum card o tem em `depends`, nem E13. O seletor do release pode começar E5 a E8 sem a primeira publicação. A justificativa de DEC-012 ("pré-condição ou portão de publicação de entregáveis Must") não se sustenta no grafo para E17.
   - Correção: acrescentar E17 às dependências de E13, e de E8 se o release nativo deve nascer sobre a versão publicada.

4. **DEC-002 com DEC-009: o caminho da publicação não está escrito.** O marketplace instala do GitHub sem ref (`known_marketplaces.json`, repo `odeciojunior/claude-play`), então publicar é dar push em `main`. Cada incremento exige mesclar release em `main` por fase.
   - E17 não diz isso: a definição de pronto fala em "G1 a G5 verdes na branch de release; versão publicada".
   - Não está escrito onde se faz o bump, nem se o painel passa a "integrado" por fase.
   - Correção: em E17, E11/E16 e E13, uma peça "mesclar a branch de release em `main` (dono), bump na branch de release antes da mescla".

5. **DEC-007: "cada decisão é registrada" não é garantido hoje nem depois de E18.**
   - O WF grava as decisões do spec por um agente com a skill do tracker (WF:1578 a 1587). Se o registro falha, vira só `concern` e a execução segue (WF:1589).
   - A CLI de E3 não tem comando para decisões (risco de E18, EST linha 257; questão em aberto de E18).
   - Correção: incluir em E3 (REQ-003) o comando "acrescentar DEC pendente" e, em E18, falha de registro de decisão tratada como falha por código.

6. **DEC-010 é citada para o que não diz.** A Tese 4 e `sources.md` linha 30 atribuem a ela "o padrão atual é mantido até a medição". DEC-010 só trata de prioridade e divisão. A regra é o último não-objetivo da EST, sem DEC (ver E3).

7. **E21 e E24 reduzem revisão por padrão antes de E16**, contra o não-objetivo da linha 24.
   - E21 critério 2 torna a nova revisão restrita incondicional, enquanto a questão em aberto de E21 ainda pergunta se ela é padrão ou modo.
   - Em E24, o achado refutado deixa de gerar correção já no padrão.
   - Correção: os dois entram como modo desligado, com o padrão decidido em E16.

8. **BLQ-1 afeta mais que E13.** `state.md` lista só E13, mas E20 peça 2 espera a resposta, E20 está no caminho crítico e E7 tem o mesmo problema com arquivos de progresso.
   - Correção: "Afeta: E13, E20"; E13 como segmento (`aceite: bloqueado (BLQ-1)`), não o card inteiro.

9. **DEC-004 contra E15.** A linha diz "onde bastam, não se monta medição nova", e E15 peça 1 roda o plan-only de novo. PESQ §9A dá razão a E15 ("3 ou mais execuções no commit de partida"); o que está errado é o texto da linha.

10. **Menores.**
    - O registro de mudanças da EST e `log.md` falam em "quatro revisões"; `sources.md` e SRC-10 têm três.
    - Com DEC-013, o "dez Must" de DEC-008/DEC-010 virou 21 Must em 23 (ver D).
    - Não há E23, e nada registra por quê.

## C. Solidez contra a evidência

1. **DEC-002 com DEC-009: sustentadas, mas incompletas.**
   - O código exige alvo diferente da branch de integração (WF:993), e o release lê `state.md` e a estratégia do alvo (WF:955).
   - Um incremento compatível chega a `main` antes do corte só se o dono mesclar por fase (B4).
   - Consequência não escrita: depois de criada a branch, ratificações e respostas a bloqueios têm de ser gravadas nela, senão o release lê estado velho.
   - "Revisitar quando" de DEC-002 é vago. Melhor: "a mescla por fase em `main` conflitar com trabalho feito direto em `main`".

2. **DEC-005 contra BLQ-1: a resposta do dono já fecha metade do bloqueio.**
   - Ele descartou exatamente "manter a leitura de planos antigos" (DECS, DEC-005; REV revisão 1, achado 2).
   - Resta aberto só: (a) uma conversão avulsa que recebe o caminho por argumento (SRC-08 seção D e E.2); (b) entregáveis em andamento na troca; (c) se "não cita" proíbe crédito.
   - Correção: reescrever BLQ-1 com essas três perguntas e exigir resposta antes do spec de E20, não de E13.
   - "Revisitar quando" está vazio. Sugestão: "E16 mostrar detecção abaixo da linha de base depois de uma rodada de correção dos prompts nativos". SRC-08 seção C admite que os prompts começam sem medição.

3. **DEC-004: o "revisitar quando" está mal escolhido.** "E15 fechar a linha de base" é depois de o dinheiro gasto.
   - Trocar por "antes de E15 começar, com a estimativa de custo na mão".
   - Minha estimativa, não medida, a partir das medianas corrigidas de §9A: coordinator 32,6 × 3, planner 28,3 × 3, release completo 6,85 × 4, mais plan-only e tracker. Dá perto de US$ 200 a 250 só em E15, se os cenários fixos custarem como as medianas reais. Os braços de E11 e E16 e as repetições em E17 e E13 somam um múltiplo disso.
   - Mudaria a decisão: cenários fixos bem menores que as medianas, ou o dono aceitar comparar só contadores (que são determinísticos e pedem uma execução).

4. **DEC-006: a crítica da revisão foi absorvida só em parte.**
   - E7 foi reduzido (EST linha 449), mas mantém a peça 3 e as transições por linha de comando, que acrescentam turnos ao contexto principal. Esse é o item mais caro: 45% do custo do coordinator, mediana de US$ 32,6 em 62 execuções (§9A).
   - Não há ponto de medição entre E7 e E12 que mostre a piora.
   - O "revisitar quando" só cobre a sonda negativa. REV revisão 3, achado 8, pedia o outro lado.
   - Correção: "Revisitar quando: E14 fechar, nos dois sentidos. Sonda positiva: o dono decide se E7 encolhe para mapa, esquema e contrato, e E12 sobe na ordem. Sonda negativa: ficar só no script."

5. **DEC-007 contra o código.**
   - O release decide pela opção recomendada sempre, por texto fixo (WF:1062). `clarify.md` §7 diz que a DEC "guides planning", não o release. A DEC vale hoje por coincidência.
   - Nada no WF impede um dependente de rodar com DEC pendente.
   - Itens só de pessoa: `human-input` para o entregável quando bloqueante (WF:1494 a 1497); critérios `{verify: human}` são mesclados e viram `human-act`, que "nothing records" (WF:2041, `operator.md` linha 28).
   - O roadmap tem 17 critérios `{verify: human}` e cinco cards sem código (E14, E15, E17, E11, E16), que o seletor escolheria numa execução "próximos" se o operador não filtrar por trilha (WF:113).
   - "Revisitar quando" é vago. Sugestão: "duas ou mais DEC do executor rejeitadas num mesmo ponto de ratificação".

6. **DEC-008 "substituída por DEC-010" está formalmente correto.** `formats.md` §6 só permite esse estado, e DEC-010 carrega o que sobrevive. O defeito é o "Contradiz" vazio em DEC-010 (A5). Depois de DEC-013 as duas listas estão desatualizadas; a nova DEC de prioridades (D) deve substituir DEC-010.

7. **DEC-010 e DEC-011: sustentadas.**
   - Spec, plano e revisões são 37% do release completo e 59% do plan-only (§9A).
   - O custo varia demais para servir de régua (REV revisão 3, achado 10).
   - A regra global do dono já proíbe mexer no modelo do revisor "sem evidência medida".

8. **DEC-003: sustentada.** Falta só o custo acumulado ao lado, que `clarify.md` §5.6 pede quando há estimativa com fonte.

9. **DEC-001: sem ressalva.**

## D. DEC-012 e DEC-013

**DEC-012: ratificar com mudança.**
- E14 e E15 como Must: sim. As sondas decidem a arquitetura (REV revisão 3, achado 3) e sem linha de base não há comparação.
- E17: Must só se virar dependência de fato (B3). Como está, a justificativa é falsa para ele.
- A decisão amplia a lista de Must que o dono fixou em DEC-008/DEC-010, então "Contradiz" deve citar DEC-010.
- Texto proposto: "E14 e E15 são Must por serem pré-condição de entregáveis Must; E17 é Must e passa a ser dependência de E8 e E13; E1 fica só com as ferramentas."

**DEC-013: ratificar os cortes, com três mudanças.**
- **E5 → E5, E19 e E6 → E6, E20:** corretos. É o corte de REV revisão 3, achado 11, e permite E6 e E7 em paralelo com o autor de spec.
- **E3 → E3, E18, E22:** aceitável. E18 isola a edição do arquivo de workflow e traz a regra de permissão que REV revisão 1, achado 4, pedia num Must. E22 fica fora do caminho crítico.
- **E9 → E9, E21, E24:** defensável pelo tamanho, mas é o corte que alonga a cadeia. E9, E21, E24 e E16 rodam em série no mesmo arquivo; SRC-10 sugeria dois cortes.
- **Mudança 1, justificativa:** "Must porque Must depende delas" é circular, porque as arestas foram criadas pelo mesmo executor. E7 → E22, por exemplo, é colisão de arquivo, não dependência funcional. Trocar por "herdam o Must do card de origem (DEC-008)".
- **Mudança 2, prioridade:** o dono deve confirmar. Ele foi consultado com 10 Must em 13; agora são 21 em 23. Candidatos a Should por evidência: E22 (a prosa estática é pequena perto do pico de contexto, REV revisão 3, achado 8) e E24 (acrescenta chamadas no modelo mais caro; REQ-030 tem só SRC-02 como fonte).
- **Mudança 3, B7:** revisão restrita (E21) e descarte por refutação (E24) entram como modos.
- **Efeito do caminho crítico de 10:** a contagem confere (E14, E2, E3, E18, E8, E9, E21, E24, E16, E13). Sem prazo (DEC-003), o custo é o overhead fixo por entregável e as paradas do dono. A única execução real custou 13,7 em dois lançamentos, ambos parados em `needs-operator` (§9A, correção 6). São seis entregáveis a mais, três deles na cadeia.
- Se o dono quiser encurtar: fundir E21 e E24, ou tirar E24 da cadeia de E16 medindo a "onda única" em E13.

## E. Decisões que faltam

| # | Escolha de que o roadmap já depende | Quem decide |
|---|---|---|
| 1 | O que "compatível" significa e onde cai a quebra (B1) | dono |
| 2 | Caminho da publicação: mescla release → `main` por fase, quem faz o bump e em qual branch (B4). A EST linha 56 enuncia a regra sem DEC | dono; o executor prepara |
| 3 | "Nenhum laço ou modelo de revisão muda antes da medição; inconclusivo mantém o atual" (EST linha 24). Hoje é atribuída a DEC-010 | dono |
| 4 | Números das versões intermediárias. A questão está marcada E13, mas a primeira publicação é em E17 | dono |
| 5 | Quem opera E14 e como. `state.md` diz "executor", mas as sondas de workflow não rodam por subagent (REV revisão 3, achado 2) nem pelo release; falta também o modo de permissão | dono |
| 6 | Quais cards passam pelo `roadmap-release` (só `track: engineering`?) e quais são manuais | executor propõe, dono ratifica |
| 7 | Quando se ratifica: a cada ponto de medição, ou antes de um dependente começar. Hoje é só prosa em `state.md`, item 4 | dono |
| 8 | Onde vive a pasta de acompanhamento depois de criada a branch de release (C1) | executor, com ratificação |
| 9 | Reversão de uma publicação intermediária. Só E13 tem esse risco escrito; REV revisão 3, achado 1, pedia a regra geral | dono |
| 10 | Regra de versão em execução: "cada entregável roda na versão publicada no seu início" (EST linha 54) vem da revisão, não de resposta do dono | dono |

## Decisões a reconsiderar com o dono

1. **DEC-009 (com DEC-005): onde cai a quebra.** Recomendo declarar a publicação pós-E16 como a versão de quebra e manter compatíveis só as anteriores, em vez de pedir leitura do formato antigo em E7 e E8. Se errado, projetos com planos ou entregáveis em andamento quebram uma fase mais cedo; a mitigação é terminar em 1.x antes de atualizar. A alternativa custa código de compatibilidade descartável e contraria a alternativa que DEC-005 descartou.

2. **DEC-004: pagar a linha de base completa?** Recomendo pagar para release e coordinator, onde está o dinheiro, e comparar planner e tracker só por contadores, com uma execução cada. Se errado, um ganho ou perda de custo nessas duas skills fica sem prova. O erro inverso gasta cerca de metade do custo de E15 em números que a variação entre execuções não deixa separar.

3. **BLQ-1: responder agora, reduzido a três perguntas.** Recomendo: conversão avulsa por argumento permitida; em andamento termina na versão anterior; crédito de licença permitido fora dos prompts. Se errado, E20 e E13 são replanejados; adiar a resposta bloqueia o caminho crítico em E20.

4. **DEC-006: revisitar ao fechar E14, nos dois sentidos.** Recomendo manter os dois passos com E7 mínimo. Se errado, um entregável de trabalho parcialmente descartável e o maior ganho em dólar (E12) continua em penúltimo.

5. **DEC-013: prioridades.** Recomendo ratificar os cortes e confirmar Must um a um, com E22 e E24 como candidatos a Should. Se errado, a definição de pronto fica presa a dois entregáveis de ganho pequeno, ou se perde a rubrica e a verificação adversarial na versão final.

6. **DEC-012: E17.** Recomendo torná-lo dependência real de E8 e E13. Se errado, um elo a mais antes de E8; sem a mudança, a primeira publicação pode nunca acontecer e o roadmap inteiro roda na 1.6.0.

7. **DEC-011: o ponto de medição é portão de publicação?** Recomendo sim, com a cláusula "sem piora nos contadores", e inconclusivo no custo não bloqueia. Se errado, uma fase boa fica retida por ruído de custo.

## Arquivos

- `D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\decisions.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\state.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\requirements.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\critical-path.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\sources.md`
- `D:\projects\claude-play\docs\reports\2026-11-10-evolucao-skills-roadmap-pesquisa.md` (§9A)
- `D:\projects\claude-play\docs\reports\2026-11-10-skills-nativas-spec-plano-proposta.md` (seções C, D, E)
- `D:\projects\claude-play\docs\reports\2026-11-10-roadmap-revisoes-fable.md`
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js` (linhas 113, 955, 993, 1062, 1494, 1578 a 1589, 2041)
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\references\operator.md`
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-planner\references\clarify.md` (§5, §7)
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-planner\references\formats.md` (§6)


---

# Análise 2: questões de desenho em aberto

## Preparação das questões de desenho em aberto (spec, plano, execução e revisão nativos)

Li a estratégia, `decisions.md`, `state.md`, `requirements.md`, a proposta (SRC-08), as revisões (SRC-10) e o código citado; nada foi editado. Das oito questões, três são do dono (1, 7 e a parada da 3), a 5 e a 6 só pedem o dono numa das metades, e três cabem ao executor por DEC-007 (2, 4 e o campo da 3), sendo que a 8 pode simplesmente ser fechada.

`WF` abaixo é `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`; "estratégia" é `D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`.

## 1. BLQ-1: migração, adoção e trabalho em andamento

**Pergunta.** A versão nova pode trazer (a) um script que move specs e planos antigos recebendo a pasta antiga como argumento e (b) um modo que reescreve um plano sem bloco de dados no formato novo? E quem está no meio de um entregável ou de um plano do coordinator na troca faz o quê?

**Por que é escolha real.**
- DEC-005 descartou "skills nativas mantendo a leitura de planos antigos" (`decisions.md:10`), e a adoção é literalmente ler um plano antigo, ainda que uma vez só.
- O release procura spec, plano e log por glob em `docs/superpowers/...` (WF:1230, 1259-1261, 1457, 1506).
- O coordinator lê `docs/superpowers/plans/*.md` e o legado `docs/plans/*-plan.md` (`plan-coordinator\SKILL.md:23, 39`), e seus arquivos de progresso são markdown que o tracker lê (`events.md:261`).
- A resposta da proposta para progresso antigo ("ler dos commits `E<n> T<m>:`", SRC-08:360) só vale para o release, não para o coordinator.
- A proposta não diz que `plan-tool check` exige um spec `spec/1` (SRC-08:160, 208). Adotar um plano implica adotar também o spec dele, ou criar um modo sem spec.

**Opções.**

| Opção | Custo | Risco | Cards que mudam |
|---|---|---|---|
| A. Nada embarcado: nota de atualização, e o coordinator e o release recusam com mensagem clara o que não tem bloco de dados | Quase zero | Quem tem plano antigo reescreve à mão ou pela skill de plano, como pedido novo | E13 perde a peça 1 e `migrate-artifacts.test.mjs`; o critério 2 vira conferência da recusa; E20 peça 2 fica sem adoção |
| B. Só adoção genérica: a skill de plano aceita qualquer arquivo de plano sem bloco de dados, de qualquer origem, e o reescreve | Modo no autor, adoção de spec, execução comportamental | A reescrita por LLM pode mudar o conteúdo, e a checagem só confere estrutura | E20 peça 2, E7 critério 4, E13 critério 2 |
| C. B mais script de migração com a pasta como argumento (SRC-08) | B mais script e teste | O mesmo de B; a nota de atualização precisa nomear a pasta antiga | E13 inteiro como está, E20 |

O leitor de compatibilidade está fora: é a alternativa descartada em DEC-005.

**Em andamento, nas três opções.** Terminar na versão que iniciou (regra que a estratégia já usa para si, linha 54). Acrescento uma guarda em código: branch de entregável com commits de tarefa e sem spec nativo para com ação de operador, em vez de escrever spec novo por cima. Não rodei esse cenário; a necessidade da guarda é inferência a partir de WF:1457.

**Recomendação: B, com a guarda.** O script de C faz pouco além de `git mv`, e o valor está na adoção. B não nomeia origem nenhuma e serve também aos planos escritos à mão, como os 15 `*-plan.md` deste repositório.
- Custo se errada: adoções com conteúdo alterado. A mitigação é mostrar o diff das tarefas e pedir uma aprovação no modo interativo.
- Mudaria de ideia para A se o dono ler "leitura de planos antigos" como incluindo a conversão única, ou se não houver plano antigo a preservar. A linha de base tem 62 execuções do coordinator em 8 projetos (pesquisa:165), o que sugere que há.

**Classificação: dono.** Interpreta DEC-005.

**Quando.** Antes do spec de E7 (recusar ou adotar plano sem bloco de dados; destino do progresso em markdown), de E20 (peça 2) e de E8 (guarda), não só de E13.

**Três pontos a resolver junto.**
- `state.md:52` diz que BLQ-1 afeta só E13. Mas E7 afirma que o formato novo "só chega aos usuários na versão de quebra" (estratégia:473), enquanto E11 e E16 são portões de publicação anteriores a E13 (linhas 515, 627). A estratégia não diz como E7 e E8 ficam fora dessas publicações.
- Pastas de versão antiga somem do cache em 14 dias (`CLAUDE.md` do repositório). "Terminar na 1.x" significa não atualizar antes de terminar.
- Se a nota de atualização ficar num arquivo publicado do plugin e citar a pasta antiga, o teste de independência (E13 critério 1) falha. Ela precisa ficar fora do plugin.

## 2. E19 e E8: local dos artefatos

**Pergunta.** Spec, plano e registro de execução passam a `docs/plans/<tópico>/spec.md`, `plan.md` e `run.json`, com nome fixo e sem data? E para onde vão o log de revisões e o relatório de execução?

**Por que é escolha real.**
- Hoje o release grava em `docs/superpowers/specs|plans|reviews|reports` com data no nome (WF:1464, 1502, 1219, 2051), e `operator.md:42` cita esse caminho.
- Este repositório usa arquivos datados soltos em `docs/plans/` (31 arquivos, convenção no `CLAUDE.md`) e não tem `docs/superpowers/`.
- `docs/plans/<topic>/` já é convenção do coordinator para progresso e planos (`plan-coordinator\SKILL.md:23, 39, 90`), e há três pastas assim aqui.

**Já respondido.** "Os caminhos de log e relatório mudam junto?" tem resposta em REQ-008 e no critério 1 de E13: nenhum arquivo publicado pode citar caminho do superpowers. Resta decidir onde e em qual card. Hoje nenhum card é dono das linhas WF:1219, 1230, 1261, 1291, 1304, 2051, 2079 nem de `operator.md:42`; o critério 1 de E8 cobre só os prompts de spec e plano.

**Opções.**
- **A.** `docs/plans/<tópico>/{spec.md, plan.md, run.json, reviews.md}` e relatório em `docs/reports/<data>-<ids>-run.md` (SRC-08). Custa as constantes de caminho e os testes de fluxo. A retomada deixa de localizar por glob.
- **B.** Como A, com o relatório dentro da pasta do roadmap. Não polui `docs/reports/`, mas não verifiquei se o checker aceita arquivo extra na pasta.
- **C.** Manter nomes datados em `docs/plans/` solto. Preserva o hábito, mas a retomada continua por glob.

**Recomendação: A, com E8 dono de todos os caminhos.** O leitor de retomada (WF:1230) lê os três de uma vez. Dois detalhes para o spec:
- A chave do tópico deve ser o id do entregável, não o slug do título: renomear o card mudaria o caminho, e dois roadmaps no mesmo repositório têm ambos um E5.
- Tópico livre não deve começar por `roadmap-`, porque o release localiza `docs/plans/roadmap-*/` (`roadmap-release\SKILL.md:22`).

Custo se errada: trocar constantes antes de E13 é barato; depois da publicação exige nova migração. Mudaria de ideia se o dono quiser a data no nome para ordenar.

**Classificação: executor (DEC-007),** pendente de ratificação. Muda onde o dono procura specs, mas não contraria decisão.

**Quando.** Spec de E19 (a skill interativa grava em algum lugar) e spec de E8. E5 não depende: a ferramenta recebe o caminho.

## 3. E5: decisão autônoma cara e irreversível para a execução?

**Pergunta.** Quando o autor do spec decide sozinho algo que ele mesmo classifica como caro de errar e irreversível, o entregável para e espera o dono, ou segue e a decisão fica pendente de ratificação?

**Por que é escolha real.** Hoje as decisões são strings (`decisions: STRS`, WF:917). Só param o item humano bloqueante (WF:1494-1498) e a decisão que contraria decisão registrada ou gate (WF:1062). A regra 3 da proposta (SRC-08:250) cria uma terceira parada, baseada em autoavaliação do autor.

**A questão se divide em duas.**
- **Campo.** O critério 2 de E5 já exige "custo se estiver errada". Incluir `costIfWrong` e `reversible` no esquema custa o mesmo com ou sem parada. O campo não espera a resposta.
- **Parada.** É código de E8 (peça 5).

**Opções para a parada.**
- **A.** Para depois do spec, antes do plano, que é o ponto mais barato. Risco: paradas falsas, cada uma custando uma retomada (`operator.md:77`).
- **B.** Não para; a decisão sai em destaque no relatório e nos pendentes. Risco: retrabalho de um entregável já mesclado na branch de release. DEC-002 amortece, porque o dono ainda revê antes de `main`.
- **C.** Executa, mas não mescla até ratificar. Protege o alvo e gasta a execução; exige status novo e é a mais cara de construir.

**Recomendação: campo já em E5; parada A.** Dentro de uma branch isolada quase nada é irreversível, e os efeitos externos já têm retenção própria. Por isso a regra deve disparar raramente, e quando dispara o custo de errar é alto.
- Custo se errada: retomadas a mais.
- Mudaria de ideia se, no cenário fixo (E11), o autor marcar alto e irreversível em parcela relevante dos specs.

**Classificação.** Campo: executor. Parada: dono. DEC-007 lista só dois motivos para exigir o dono (contrariar decisão, mudar gate); a parada acrescenta um terceiro. A revisão 1 já apontou confusão parecida (SRC-10:95).

**Quando.** Campo: spec de E5. Parada: spec de E8.

## 4. E19 e E20: rodadas de perguntas e aprovações

**Pergunta.** A skill interativa de spec faz quantas rodadas de perguntas e pede aprovação quantas vezes? A de plano pede aprovação?

**Por que é escolha real.** A proposta sugere uma rodada agrupada de até 5 perguntas e uma aprovação no spec, e nenhuma no plano (SRC-08:99-104, 372). O planner usa até 5 por rodada, uma de cada vez, com mais rodadas só com consentimento (`roadmap-planner\SKILL.md:38`). O coordinator nunca pede aprovação do mapa (`plan-coordinator\SKILL.md:94`).

**Opções.**
- **A.** Spec com 1 rodada (≤5) e 1 aprovação; plano com 0 aprovações.
- **B.** Como A, com rodada extra só se a pessoa pedir, igual ao planner.
- **C.** Aprovação também no plano. Custa um turno e protege pouco, porque a checagem estrutural já rodou.

**Recomendação: B para o spec, zero aprovações no plano.** É coerente com o planner e reduz a perda que o risco de E19 já registra (estratégia:387). O plano termina relatando e oferecendo o coordinator. Custo se errada: editar prosa do `SKILL.md`. Mudaria de ideia se a execução comportamental mostrar specs gravados com suposição errada.

**Classificação: executor (DEC-007).** É preferência, mas barata de reverter.

**Quando.** Specs de E19 e de E20.

## 5. E20: nome da skill de plano e avaliação de gatilho

**Pergunta.** Como se chama a skill interativa de plano? E `claude plugin eval` entra como portão?

**Por que é escolha real.**
- A proposta usa `task-planner` e admite a proximidade com `roadmap-planner` e `plan-coordinator` (SRC-08:371).
- As descrições atuais já disputam o verbo "plan": `roadmap-planner\SKILL.md:3` manda planos de tarefa para a skill externa.
- O comando existe na CLI instalada: conferi `claude plugin eval --help` na 2.1.322. Não há pasta `evals/` no repositório.
- É execução paga e não determinística (3 execuções por caso, pesquisa:120).

**Nome.**
- `task-planner`: colide com `roadmap-planner` no substantivo.
- `plan-writer`: simétrico com `spec-writer` e forma a sequência plan-writer → plan-coordinator.
- `implementation-planner`: longo.

Recomendo `plan-writer`. O gatilho depende mais das cláusulas "Not for" da descrição que do nome. Renomear é barato antes da primeira publicação que o contenha e caro depois.

**Avaliação.**
- **A.** Gate canônico G6. Muda a tabela de gates e põe execução paga em todo commit, contra DEC-011.
- **B.** Suíte criada em E20 e rodada pelo dono como critério `{verify: human}`. Exige revisão do card.
- **C.** Sem avaliação.

Recomendo B. O limiar "1 em 10" da proposta não tem fonte e esbarra no não objetivo de metas numéricas; se houver limiar, é o dono quem dá. Mudaria para C se a suíte custar mais que as execuções comportamentais que E19 e E20 já exigem.

**Classificação.** Nome: executor. Avaliação: dono (gate ou critério novo, e interpreta DEC-011).

**Quando.** Spec de E20. O nome também aparece nos ponteiros da peça 3.

## 6. E18: o que o release grava além de status e log

**Pergunta.** As decisões do executor, os itens pendentes e a linha "em andamento" passam a ser gravados por comando da CLI, ou continuam com um agente usando a skill do tracker?

**Por que é escolha real.**
- O mesmo `recordStatus` leva, num texto só, as decisões com origem executor, os insumos humanos não bloqueantes e a linha em andamento (WF:1578, 1587). A etapa de docs remove a linha e grava riscos aceitos (WF:1347).
- A CLI de E3 não tem comando para nada disso (estratégia:215-216).
- Quase todo spec tem decisão autônoma. Se esse resto ficar com o agente, a chamada de LLM por registro continua existindo.

**Opções.**
- **A.** Fica com o agente. E18 entrega só o status conferido por código; REQ-040 não pede mais que isso.
- **B.** Três comandos na CLI: acrescentar decisão pendente, acrescentar pendente, pôr e tirar linha em andamento. São acréscimos mecânicos. O julgamento de contradição já foi feito pelo revisor do spec (WF:1473), e a receita do tracker é linha a linha (`events.md:302-311`).
- **C.** Em andamento e pendentes na CLI; decisões com o agente.

**Recomendação: B.** Sem ela a chamada de LLM por registro não é eliminada. Custo se errada: três comandos a manter e deduplicação por chave em vez de por texto. Mudaria de ideia se E17 mostrar que a fatia é irrelevante; ela é de 6 a 9% do custo do release (SRC-10:155).

**Classificação: executor (DEC-007) para A; B precisa do dono.** Os comandos entram por revisão do card E3 (regra da estratégia:763), e revisão de estratégia só é escrita com aprovação.

**Quando.** Antes do spec de E3 se for B (senão E3 é reaberto depois); no máximo antes do spec de E18.

## 7. E21: nova revisão restrita, padrão ou modo?

**Pergunta.** Depois de uma correção, o revisor relê tudo como hoje, ou só os achados abertos e o diff da correção? Se for modo, quem decide o padrão é a medição de E16?

**Por que é escolha real.** Hoje a nova rodada usa o mesmo prompt e o intervalo inteiro da tarefa (WF:440, 507, 513).

**As fontes se contradizem, e isso precisa ser consertado seja qual for a resposta.**
- O critério 2 de E21 e REQ-014 já descrevem a restrição como incondicional (estratégia:579; `requirements.md:19`).
- A questão em aberto a trata como indecisa (estratégia:786).
- O não objetivo da linha 24 e DEC-010 proíbem reduzir revisão antes da medição.
- As outras duas reduções do mesmo desenho entraram como modo (critério 3 de E21, critério 3 de E24).
- E16 não tem braço para comparar restrita com completa (estratégia:631-634).
- A revisão 1 já tinha apontado o item como proposta apresentada como decidida (SRC-10:89).

**Opções.**
- **A.** Modo, com padrão "completa como hoje", e E16 ganha um braço. Custa um interruptor, mais casos de teste e a revisão de E21, REQ-014 e E16.
- **B.** Padrão restrito já. É o que o card diz hoje. O risco é o do próprio card: não vê defeito que a correção introduz fora do que recebe (estratégia:591).
- **C.** Restrita só quando a correção toca apenas arquivos da tarefa. É heurística sem medição.

**Recomendação: A.** Os identificadores de achado (peça 1) entram como padrão de qualquer modo: substituem a comparação de texto (WF:270-274) sem reduzir revisão. Sem prazo nem teto (DEC-003), pagar revisões completas até E16 custa pouco.
- Custo se errada: matriz de teste maior e ganho adiado.
- Mudaria de ideia se o dono entender que restringir o escopo não é "reduzir um laço", já que o número de rodadas não muda.

**Classificação: dono.** Interpreta o não objetivo e DEC-010, e altera critério de card, requisito e E16.

**Quando.** Spec de E21; o braço novo, antes de E16.

## 8. E10: trava de paralelismo em 1 na configuração gerada

**Pergunta.** Uma configuração de release derivada automaticamente deve continuar forçando um entregável por vez até uma pessoa revisar os recursos compartilhados?

**Por que é escolha real.** A trava está em WF:810. A configuração gerada nasce com `locks: []` (`preflight.mjs:197`), então nada garante que dois entregáveis não disputem um banco ou cache. A liberação já existe e é documentada: rever `locks`, apagar `generated` e commitar (`operator.md:66-73`; `config.md:48`).

**Opções.**
- **A.** Manter. Custo zero; um passo manual por roadmap.
- **B.** Remover. Risco de execuções paralelas corrompidas sem aviso.
- **C.** Deixar `maxParallel` explícito da pessoa vencer a trava. É pequeno, mas uma checagem não prova que não há recurso compartilhado.

**Recomendação: A, e fechar a questão.** O card E10 não tem peça nem critério sobre paralelismo, então nada depende dela. Neste roadmap o paralelismo já é limitado pelas dependências em sequência no arquivo de workflow (estratégia:757). Mudaria de ideia se a linha de base mostrar que o tempo de parede com a trava é o gargalo.

**Classificação: executor para manter; dono para B ou C,** que afrouxam uma guarda de segurança.

**Quando.** Spec de E10 (Should, tardio).

## Contradições com decisões em vigor e questões que podem ser fechadas

- **Contrariam ou interpretam decisão:**
  - Q1, opções B e C: DEC-005.
  - Q3, parada: DEC-007.
  - Q5, avaliação como G6: DEC-011 e a tabela de gates.
  - Q7, opção B: não objetivo da linha 24 e DEC-010.
- **Já respondidas:**
  - Q2, "os caminhos de log e relatório mudam?": sim, por REQ-008 e critério 1 de E13.
  - Q3, "o campo entra no esquema?": sim, o critério 2 de E5 já o exige.
  - Q8: manter, sem nada a construir.
- **Inconsistências a corrigir na estratégia:**
  - O critério 2 de E21 e REQ-014 contra a questão em aberto da Q7.
  - O alcance de BLQ-1, que hoje é só E13 e precisa incluir E7, E8 e E20.
  - A falta de um card dono dos caminhos de log e relatório.
  - A fase spec-plano sem ponto de medição, o que deixa a avaliação de gatilho sem lugar.

## Tabela (ordenada por quando a resposta é necessária)

| Questão | Classificação | Resposta recomendada | Necessária antes de |
|---|---|---|---|
| 6. Registro além de status e log | Executor se ficar com o agente; dono se entrar na CLI | Três comandos na CLI, por revisão de E3 | Spec de E3 (no máximo E18) |
| 3. Campo de custo e reversibilidade | Executor | Incluir `costIfWrong` e `reversible` no esquema | Spec de E5 |
| 2. Local dos artefatos | Executor, a ratificar | `docs/plans/<tópico>/` com nomes fixos, log junto, relatório em `docs/reports/`; E8 dono de todos os caminhos | Specs de E19 e E8 |
| 4. Perguntas e aprovações | Executor | Spec: 1 rodada (≤5), extra a pedido, 1 aprovação. Plano: 0 | Specs de E19 e E20 |
| 1. BLQ-1 | Dono | Adoção genérica sem script; em andamento termina na versão que iniciou; guarda em código | Specs de E7, E20 e E8; depois E13 |
| 5. Nome e avaliação de gatilho | Nome: executor. Avaliação: dono | `plan-writer`; suíte rodada pelo dono como critério humano de E20, não como gate | Spec de E20 |
| 3. Parada por decisão cara e irreversível | Dono | Parar depois do spec, antes do plano | Spec de E8 |
| 7. Nova revisão restrita | Dono | Modo com padrão "completa"; identificadores como padrão; braço novo em E16 | Spec de E21; braço antes de E16 |
| 8. Trava de paralelismo | Fechar (executor); mudar exige o dono | Manter | Spec de E10 |


---

# Análise 3: medição, publicação e operação

## Preparação para as questões em aberto do roadmap (medição, publicação, operação)

Análise somente leitura; nada foi editado nem executado além de leituras. Todos os valores em dólar são estimativas pelas medianas corrigidas de SRC-02 §9A, não fatura.

Cinco fatos do estado instalado enquadram quase tudo:

- **Versão e checker.** `plugin.json` e o README dizem 1.6.0; a linha 1 do checker diz `1.5.0 format 1`, no plugin e na cópia da pasta do roadmap.
- **Loja.** `known_marketplaces.json` aponta `claude-play` para o GitHub `odeciojunior/claude-play`, sem `ref` (logo, `main`), com `autoUpdate: true`.
- **Cache.** `cache\claude-play\productivity-tools\` tem 1.4.0, 1.4.1, 1.4.2 (com `.orphaned_at`) e 1.6.0 (com `.in_use`). O conteúdo de 1.6.0 é igual ao HEAD `3fbb59b`, salvo sete arquivos de fixture que o `diff` marca como diferentes (não abri; presumo fim de linha). O bump para 1.6.0 foi em `2169d24`, vários commits antes, então "1.6.0" não identifica um commit: o `gitCommitSha` de `installed_plugins.json` identifica.
- **Permissões.** `~/.claude/settings.json` não tem bloco `permissions` e tem `skipDangerousModePermissionPrompt: true`. Não existe `settings.local.json`, e o `.claude/settings.json` do repositório só tem hooks. O preflight lê `permissions.allow` exatamente desses três arquivos (`references/config.md:52`).
- **Branches.** `release/roadmap-skills-v2` ainda não existe; `main` está igual a `origin/main`.

## 1. Mecânica de publicação (DEC-002 com DEC-009)

**A escolha real.** A instalação vem de `main` do GitHub, e DEC-002 segura tudo na branch de release "antes de `main`". Publicar por fase exige, portanto, ou levar a branch de release a `main` várias vezes, ou publicar de outro ref.

**Opções.**

| Opção | Como | Custo | Risco |
|---|---|---|---|
| A. Promoção por fase | No portão, a branch de release entra em `main` por fast-forward e continua viva | Nenhuma mudança de configuração | Usuários de `main` recebem versões intermediárias; tudo o que está na branch precisa ser compatível em cada portão |
| B. Publicar do ref da release | A loja do dono passa a usar `ref: release/roadmap-skills-v2` (fontes `github` aceitam `ref`, `docs/claude-code-extensibility-reference.md:144`); `main` só recebe a 2.0.0 | Refazer a entrada da loja duas vezes | "Publicação" deixa de alcançar usuários; os outros projetos do dono recebem o pré-lançamento de qualquer jeito |
| C. Loja local | Carregar do checkout sem bump | Zero | Descartada em DEC-009; contraria decisão vigente |

**Recomendação: A.** DEC-002 e DEC-009 são compatíveis se "antes de `main`" for lido como "passa pela release e é promovido a cada portão". Custo se errado: uma versão intermediária quebra um projeto em uso, que é exatamente o "revisitar quando" de DEC-009; a volta é reinstalar a versão anterior, cuja pasta fica 14 dias no cache.

**Três ajustes de texto necessários (revisão da estratégia, do dono).**

1. **Não é uma publicação por fase.** Só há portão em E17, E11, E16 e E13: quatro publicações para seis fases. As fases "base", "spec-plano" e "coordinator-workflow" não têm ponto de medição. DEC-009 diz "ao fim de cada fase"; ou o texto vira "em cada ponto de medição", ou faltam portões.
2. **A branch carrega mudanças de formato antes do corte.** E7 troca o arquivo de progresso do coordinator para JSON e promete que "o formato novo só chega aos usuários na versão de quebra" (risco de E7). E8 troca spec e plano do release. Se a publicação de E11 ou E16 sai da branch inteira, E7 chega aos usuários em 1.8.0. É preciso definir "compatível": pasta de roadmap em `format 1` e nenhum artefato em andamento rejeitado. Com essa definição, E7 precisa ler o progresso antigo até a 2.0.0.
3. **Definição de pronto.** "Integrados em `main` pela branch de release" continua verdadeira com A.

**Sequência do dono no portão.** Vale para E17, E11, E16 e E13.

1. Conferir a comparação em `measurements.md`; sem piora, seguir.
2. Commit de preparação na branch de release: versão em `plugin.json` e na linha do README; linha 1 do checker igual a essa versão só se o checker mudou desde a última publicação. O executor pode preparar.
3. Rodar G1 a G5 nesse commit.
4. `git checkout main` e `git merge --ff-only release/roadmap-skills-v2`.
5. `git push origin main` e push da branch de release.
6. `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins` ou reinício.
7. Conferir `cache\claude-play\productivity-tools\<versão>\` e anotar o `gitCommitSha` instalado.
8. Pedir ao tracker o evento de publicação, que atualiza a cópia do checker da pasta.

**Como a próxima sessão recebe a versão.** Uma sessão nova resolve o diretório da skill na versão instalada, e o `scriptPath` do workflow sai dele (`roadmap-release/SKILL.md:29`). Com `autoUpdate: true`, o push em `main` pode trocar a versão no próximo início de sessão, sem o passo 6. Por isso o push só deve acontecer com nenhuma execução em andamento.

**Execução em voo.** Na mesma sessão ela continua na versão antiga; a pasta antiga fica marcada como órfã e dura 14 dias. A retomada numa sessão nova roda na versão nova: o `runToken` invalida o cache do Workflow (`operator.md:77`) e todos os estágios reexecutam com o script novo. A regra "termina na versão que a iniciou" só vale, então, se a retomada ocorrer na mesma sessão. O spec deve trocar por "não publicar com entregável em `executando`" e gravar versão e SHA no início de cada execução.

**Classificação:** dono (toca DEC-002, DEC-009 e o texto da estratégia). **Necessária antes de:** criação da branch e spec de E2; a regra de execução em voo, antes de E17.

## 2. E13: numeração das versões

**A escolha real.** Dois pontos do repositório restringem a numeração. A linha 1 do checker só aceita `\d+\.\d+\.\d+` (`check-roadmap.mjs:876`), então `2.0.0-rc.1` daria `bad-header`. E a regra `.claude/rules/roadmap-checker.md:9` manda a linha 1 seguir a versão da publicação que mudou o checker.

**Opções.**

- **A. Minors e 2.0.0 no corte:** 1.7.0 em E17, 1.8.0 em E11, 1.9.0 em E16, 2.0.0 em E13; correções entre portões como patch (1.7.1).
- **B. Só patches até o corte (1.6.1, 1.6.2…):** esconde que E3, E18 e E19 acrescentam funcionalidade.
- **C. Pré-lançamentos 2.0.0-alpha.N:** incompatível com a regex da linha 1.

**Recomendação: A.**

- A linha 1 vai a 1.7.0 em E17, porque E2 muda o checker. Depois, só muda numa publicação em que o checker tenha mudado. Hoje ela diz 1.5.0 com o plugin em 1.6.0, e isso está correto pela regra.
- `format <n>` continua 1 até o fim. As checagens novas nascem como aviso (E2, critério 2), e subir o formato exige receita de migração em `events.md`. A quebra da 2.0.0 é de plano e progresso, não da pasta de roadmap.
- Custo se errado: quase nenhum, porque números não são reaproveitados e a próxima publicação corrige.

**Classificação:** executor sob DEC-007, com ratificação; o número 2.0.0 já vem de SRC-08. **Necessária antes de:** E17 (o primeiro bump); E13 só confirma.

## 3. E1: onde vive o extrator de métricas

**A escolha real.** G1 só enxerga `plugins/**/*.test.mjs` e `.claude/hooks/*.test.mjs`, e o card já fixa o teste em `plugins/productivity-tools/scripts/session-metrics.test.mjs`. Tudo o que está na pasta do plugin vai para o cache dos usuários. O extrator atual lê `~/.claude/projects`, com o caminho do dono fixo no código (`skill-runs.mjs:11`).

**Opções.**

| Opção | Custo | Risco |
|---|---|---|
| A. No plugin, em `scripts/` | Zero mudança de gate; cria o primeiro `scripts/` de nível de plugin | Publica para todos uma ferramenta que lê transcrições privadas; `lint-plugin.mjs:307` passa a varrê-la; vira superfície a manter |
| B. Só no repositório (`tools/session-metrics/`) | Mudar G1 e a linha do CLAUDE.md; mudar gate exige o dono (DEC-007) | Um glob a mais |
| C. No plugin `marketplace-tools` | G1 já cobre; fica separado do produto | Também é publicado; mistura medição com ferramentas de mantenedor |
| D. Em `.claude/hooks/` | Zero | Não é hook; viola o layout |

**Recomendação: B.** O extrator mede o repositório do dono, não é produto, e o risco de privacidade do próprio card pede que nada além de dados fabricados seja distribuído. Há precedente contrário (`make-sandbox.mjs` é publicado dentro da skill), mas ele não lê nada privado.

- Custo se errado: mover uma pasta e reverter um glob.
- Se o dono não quiser tocar G1, a segunda escolha é C.
- Em qualquer opção, o caminho raiz vira parâmetro obrigatório, sem padrão com o nome do usuário.
- O extrator precisa das duas correções da revisão 2: preços (`skill-runs.mjs:22` e `:43`) e papéis agrupados (`:88`).
- Relacionado: o pendente de `state.md` sobre commitar os scripts de `docs/reports/2026-11-10-session-metrics/` como estão. Recomendo commitar como evidência histórica e deixar E1 substituí-los.

**Classificação:** dono, porque a recomendação muda um gate; A e C seriam do executor. **Necessária antes de:** spec de E1 (muda os caminhos dos critérios 1 e 2).

## 4. E15: execuções por variante e regra de detecção

**A escolha real.** A revisão 3 (achado 10) mostrou que 2 ou 3 execuções não dão estimativa de variância diante das faixas observadas: release completo de 0,5 a 21, coordinator de 3 a 368. Os contadores determinísticos (DEC-011) variam muito menos que o custo.

**Regra proposta para ganho.** Declarar ganho só quando todas as execuções "depois" ficam abaixo de todas as "antes" no contador. O falso positivo dessa regra, por cálculo combinatório meu, é:

| Execuções por lado | Falso positivo |
|---|---|
| 2 | 17% |
| 3 | 5% |
| 4 | 1,4% |
| 5 | 0,4% |

Logo, 2 execuções (o mínimo de §9A para o release completo) não bastam; 3 é o piso útil.

**Opções.** Usei 2,13 para plan-only, 6,85 para o completo (por sessão, como proxy), cerca de 13,7 para parada e retomada (suposição minha: dois lançamentos), 32,6 para o coordinator, 28,3 para o planner e 3,4 para o tracker.

| Opção | Execuções (plan-only / completo / retomada / coordinator / planner / tracker) | Estimativa |
|---|---|---|
| A. Mínimo de §9A | 3 / 2 / 2 / 3 / 3 / 3 | ≈ US$ 240 |
| B. Por custo | 5 / 3 / 3 / 3 / 3 / 5 | ≈ US$ 270 |
| C. Cinco em tudo | 5 / 5 / 5 / 5 / 5 / 5 | ≈ US$ 435 |
| D. B sem o planner agora | 5 / 3 / 3 / 3 / 0 / 5 | ≈ US$ 190 |

Coordinator e planner somam dois terços do custo. O custo do coordinator depende do tamanho do plano fixo; um plano de 4 a 6 passos deve ficar bem abaixo da mediana.

**Recomendação: B.** Custa cerca de US$ 30 a mais que A e leva as variantes baratas a 5 e o release completo a 3. Custo se errado: um ponto de medição inconclusivo, que pela regra dos cards significa "manter o atual", ou seja, ganho real não reconhecido.

**Quais variantes medir.**

- **Plan-only: sim.** Barato, faixa estreita (2,0 a 2,8), e cobre a fatia de 59% de spec, plano e revisões.
- **Completo e parada com retomada: sim.** Sem a retomada, o ganho principal de E8 fica invisível.
- **Tracker: sim.** Barato; fixar versão e evento.
- **Coordinator: sim, com plano pequeno.** Só é comparado em E13.
- **Planner: o mais fraco.** É interativo, o ganho esperado é pequeno (E4 é Should) e custa cerca de US$ 85. Pode ser adiado para logo antes de E4. Como as execuções usam cópia da skill em sandbox, a linha de base pode rodar depois sobre o commit de partida, desde que ele seja marcado com tag. O risco é os modelos mudarem no intervalo.

**Regra de detecção.**

- Cerca de 10 defeitos plantados (5 de código, 5 de plano), todos presentes em cada execução completa. Três execuções dão 30 tentativas por braço.
- Aprovação: a taxa agregada não cai mais de 15 pontos, e nenhum defeito detectado em todas as execuções da linha de base é perdido na maioria das novas. Inconclusivo mantém o atual.
- Limite a registrar: com 20 tentativas por braço e detecção de base perto de 80%, só quedas de cerca de 30 pontos são detectáveis; com 40, cerca de 22 (cálculo meu). A regra pega regressões grandes, não pequenas.
- Para os braços de política de E11 e E16, vale um arnês que roda só o estágio de revisão sobre o defeito plantado: custa centavos por tentativa pelas fatias de §9A (revisão de plano ≈ 12% de US$ 2,13) e permite 40 por braço. Isso é uma peça a mais em E1.

**Contradição com decisão vigente:** nenhuma. DEC-004 já diz que os dados reais só bastam para o plan-only, e mesmo ali §9A pede 3 ou mais execuções no commit de partida.

**Classificação:** dono (define gasto e régua, e ele opera, DEC-011). **Necessária antes de:** spec de E1 (o conjunto de defeitos, o cenário e o arnês dependem da regra) e, depois, E15.

## 5. E14: as sondas

**Quem roda.** `state.md` (item 4 de "Agora") já define: o executor executa, o dono aprova. O ponto fraco é o modo de permissão. As configurações indicam que o dono costuma rodar com permissões ignoradas; nesse modo as sondas 2 e 3 passam trivialmente e não dizem nada sobre usuários no modo padrão. Cada decisão deve registrar o modo, e as sondas 2 e 3 devem rodar duas vezes: no modo real do dono e no modo padrão.

| Sonda | Já respondida? | Como rodar | Confirma / refuta | Se negativa | Quem |
|---|---|---|---|---|---|
| 1. Agente do plugin em workflow | Em boa parte, por documentação. A referência do Workflow desta instalação (2.1.322) diz que `agentType` é resolvido no mesmo registro da ferramenta Agent, e esse registro lista agentes de plugin como `sql-server-tools:tsql-specialist`. Falta só a execução. | Workflow de um agente com `agentType: 'sql-server-tools:sql-schema-discovery'` e `schema`, pedindo que diga qual é seu papel; repetir com `model` e `effort` na chamada para ver quem vence | Confirma: responde com o papel do agente e o JSON validado. Refuta: erro de tipo desconhecido ou agente genérico | E19, E20, E9 e E21 usam texto embutido no script, via gerador de E2 | Executor; centavos |
| 2. Script pelo caminho do cache | Em parte, pelo estado instalado. O caminho contém a versão, então uma regra exata deixa de casar a cada bump. A pasta antiga persiste 14 dias. `${CLAUDE_PLUGIN_ROOT}` não existe no ambiente do Bash (`extensibility-reference.md:195`), logo o caminho chega por `args`. | Workflow com um agente que roda `node <cache>/1.6.0/skills/roadmap-tracker/scripts/check-roadmap.mjs --version`, depois o mesmo em `1.4.2` (simula a troca de versão); com regra exata, com curinga na versão e sem regra | Confirma: roda sem pedido nas duas versões com a regra curinga. Refuta: pede permissão ou bloqueia | CLI e ferramentas viram arquivo único copiado para a pasta do roadmap, como o checker. Muda E3, E18, E5, E6 e E21, e o gerador de E2 ganha mais alvos | Executor lança; dono presente nas duas modalidades |
| 3. Consentimento do Workflow | Parcialmente. Por regra: `Workflow(<nome>)` exige workflow nomeado, e o release hoje lança por `scriptPath`. Por hook: `allow` pula o pedido, mas regras de negar e perguntar continuam valendo, não vale em modo de plano, e está documentado só para `claude -p` e SDK (revisão 2, linha 8). Por skill: o dono pode responder de memória se apareceu diálogo nas dezenas de execuções já feitas. | Plugin descartável fora do repositório, com um workflow nomeado e um `hooks/hooks.json` com `PreToolUse` em `Workflow`, carregado com `claude --plugin-dir`. Três execuções com `claude -p`: só skill, só regra, só hook | Confirma cada rota: o workflow inicia sem diálogo. Refuta: fica parado ou é negado | Sem nenhuma rota: DEC-006 é revisitada (o próprio card E12 diz) e o coordinator fica no script de E7. Só a regra funciona: o preflight de E18 lista `Workflow(...)` nas regras ausentes | Executor monta; dono lança as sessões |
| 4. Fidelidade do plano | Não | Workflow com 20 agentes que leem um plano fixo de 10 tarefas e devolvem `{plan, digest}` por `schema`; o script recalcula o resumo e compara com o esperado em `args`. Dois modelos (haiku e sonnet) e dois tamanhos (10 e 30 tarefas) | 0 de 20: uma nova tentativa basta (limite superior ≈ 15%). 1 a 3: duas tentativas e resumo por tarefa. Mais de 3: refuta | E8 peça 2 mantém a transcrição com releitura de hoje, ou passa a resumo por tarefa com repetição parcial; o critério 2 de E8 muda | Executor; ≈ US$ 2 a 5 (estimativa minha) |
| 5. Compartilhar código em workflow | Sim, por documentação. O script não tem `import`, sistema de arquivos nem API do Node, e `meta` é literal puro. O que existe é `workflow()`, que roda outro workflow como subpasso, com um nível de aninhamento. O repositório já contorna com marcas `// <pure>` e `load-pure.mjs`. | Opcional: script com `import` e script que chama `workflow({scriptPath})`; zero agentes | Confirma a cópia gerada: o `import` falha | Nada muda: E2 peça 1 (gerador) já supõe isso | Executor; custo zero |

**Onde construir a pré-aprovação por hook (REQ-033).**

- **A. Peça nova em E18.** Já trata de permissões, é Must, entra na primeira publicação; o `hooks/hooks.json` é arquivo novo, sem colisão com o workflow.
- **B. E12.** É onde o risco está escrito, mas é tarde: o release já usa Workflow desde hoje.
- **C. Card novo na fase 2.** Mais limpo, mais um entregável.
- **D. E10.** É Should; um requisito Must poderia cair.

**Recomendação: A**, com duas condições.

- O hook só aprova quando a entrada aponta para um workflow do próprio plugin. Um hook que aprova qualquer Workflow amplia permissões de todos os usuários.
- A revisão é de raio de impacto alto, T2 pela política global.
- Se a sonda mostrar que a skill ou a regra já bastam, a recomendação muda: REQ-033 passa a fora de escopo, com o motivo registrado.

**Classificação:** resultados das sondas, executor com ratificação. Onde construir o hook e qualquer mudança de card, dono (revisão da estratégia; comportamento de permissão publicado). **Necessária antes de:** specs de E2, E3, E5 e E18.

## 6. Operação pelo dono

**Atos em ordem.**

| # | Ato | Precisa de | Execução paga (estimativa) |
|---|---|---|---|
| 1 | Revisar e commitar a pasta do roadmap e os relatórios; decidir sobre os scripts de métricas | Este material | - |
| 2 | Criar `release/roadmap-skills-v2` | Resposta à questão 1 | - |
| 3 | Ratificar DEC-012 e DEC-013 | `decisions.md` | - |
| 4 | Responder BLQ-1 e as 15 questões em aberto (as de E1, E5 e E14 primeiro) | Tabela abaixo | - |
| 5 | E14: lançar as sessões das sondas 2 e 3; ratificar as decisões; aprovar revisão da estratégia se houver | Plugin descartável montado pelo executor | ≈ US$ 5 a 10 |
| 6 | Ratificar as decisões de executor de cada entregável (cerca de 19 de engenharia) e conferir as execuções comportamentais de E22, E4, E19 e E20 | Linhas pendentes; relatórios em `docs/reports` | Contada no item 13 |
| 7 | E15: operar a linha de base | Extrator e cenário de E1 | ≈ US$ 270 (opção B) |
| 8 | E17: cenário do tracker e do registro de status; publicação 1 (1.7.0) | Linha de base; branch verde | ≈ US$ 30; ≈ US$ 115 com o planner |
| 9 | E11: comparação do release nativo e braços de política; ratificar; publicação 2 | E8 integrado; defeitos de plano | ≈ US$ 150 a 200 |
| 10 | E16: comparação da execução nativa e braços; ratificar; publicação 3 | E21 e E24 integrados | ≈ US$ 150 a 200 |
| 11 | Conferir E12 | Teste comportamental | - |
| 12 | E13: medição final das quatro skills; nota de atualização; corte 2.0.0 em `main` | BLQ-1 respondido; todos os Must integrados | ≈ US$ 270 |
| 13 | Autorizar e retomar as execuções do release (uma pergunta por parada) | Relatório de cada execução | ≈ US$ 200 a 600 no total (suposição minha: US$ 10 a 30 por entregável; a única execução real medida marcou 13,7) |

Total de medição: da ordem de US$ 900 a 1.100, mais a execução dos entregáveis. Não há teto (DEC-003), então o limite é o tempo do dono, não o dinheiro.

**A carga é realista?** As ratificações e as quatro publicações, sim. As medições, não, se feitas à mão: são cerca de 100 execuções a lançar, acompanhar e registrar (22 na linha de base, cerca de 30 em E11, 25 em E16, 20 em E13), várias delas interativas.

**O que pode ir para o executor sem violar DEC-007 nem DEC-011.**

- Um lançador em lote como peça de E1: gera o sandbox, roda N vezes com `claude -p` e chama o extrator. "Operar" vira iniciar um comando e conferir a saída.
- Montar os sandboxes e as cópias da skill, rodar o extrator e redigir as linhas de `measurements.md` pelo tracker, para o dono conferir.
- O commit de preparação de cada publicação (versão nos dois lugares, linha 1, G1 a G5) na branch de release.
- Redigir as decisões de política com a medição citada, como pendentes.
- As sondas 1, 4 e 5 inteiras.

**O que não pode sair do dono.** Push, merge em `main`, atualização da loja e do plugin, ratificações, a decisão de mudar laço ou modelo de revisão, e a ordem de início de cada lote pago.

**Contradição a evitar.** Pôr as execuções de medição como tarefa do próprio release contraria DEC-011 e é inviável: subagents não têm a ferramenta Workflow (SRC-02 §7).

**Classificação:** dono. **Necessária antes de:** spec de E1 (o lançador é peça dele) e E15.

## Tabela final, por ordem de necessidade

| Questão | Classificação | Resposta recomendada | Necessária antes de |
|---|---|---|---|
| 1. Publicação (DEC-002 com DEC-009) | Dono | Promoção por fast-forward da release para `main` em cada portão; trocar "por fase" por "por ponto de medição"; definir "compatível"; não publicar com execução em voo | Criação da branch; spec de E2; E17 |
| 5. Sondas de E14 | Executor roda, dono ratifica; dono lança as sondas 2 e 3 | Sonda 5 respondida, sonda 1 quase; 2 e 3 em dois modos de permissão; 4 com 20 repasses em dois modelos | Specs de E2, E3, E5, E18 |
| 3. Local do extrator (E1) | Dono (muda G1) | Ferramenta só do repositório, com G1 e CLAUDE.md ajustados; segunda escolha `marketplace-tools` | Spec de E1 |
| 4. Execuções e regra de detecção (E15) | Dono | Opção B (5/3/3/3/3/5, ≈ US$ 270); separação total nos contadores; 10 defeitos, margem de 15 pontos, inconclusivo mantém | Spec de E1; E15 |
| 6. Operação | Dono | Lançador em lote em E1; executor prepara e redige, dono inicia, confere, ratifica e publica | Spec de E1; E15 |
| 5b. Hook de pré-aprovação (REQ-033) | Dono | Peça nova em E18, restrita aos workflows do plugin, só se a sonda 3 mostrar que é necessário | Spec de E18 |
| 2. Numeração (E13) | Executor, com ratificação | 1.7.0, 1.8.0, 1.9.0 e 2.0.0; linha 1 em 1.7.0 e depois só quando o checker mudar; `format 1` até o fim; sem sufixos de pré-lançamento | E17; confirmada em E13 |

**Arquivos consultados.**

- `D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`
- `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\` (`decisions.md`, `state.md`, `requirements.md`, `measurements.md`, `roadmap.config.json`)
- `D:\projects\claude-play\docs\reports\2026-11-10-evolucao-skills-roadmap-pesquisa.md`
- `D:\projects\claude-play\docs\reports\2026-11-10-roadmap-revisoes-fable.md`
- `D:\projects\claude-play\docs\reports\2026-11-10-session-metrics\skill-runs.mjs`
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\SKILL.md` e `references\config.md`, `references\operator.md`
- `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-tracker\scripts\check-roadmap.mjs`
- `D:\projects\claude-play\docs\claude-code-extensibility-reference.md`
- `~\.claude\plugins\known_marketplaces.json`, `installed_plugins.json` e `cache\claude-play\productivity-tools\`
- `~\.claude\settings.json` (só as chaves de permissão)
