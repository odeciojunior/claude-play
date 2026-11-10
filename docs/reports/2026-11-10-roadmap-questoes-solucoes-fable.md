<!-- Três propostas de solução feitas por subagents Fable 5.2 (effort medium) em 2026-11-10 para as seis questões em aberto do roadmap docs/plans/roadmap-evolucao-skills/. Gravadas sem edição pela sessão principal. Fonte SRC-12 do roadmap. Os números de DEC que cada proposta usa (DEC-030 em diante) foram atribuídos em separado por cada subagent e não valem: os números reais estão em decisions.md. -->


---

# Solução 1: quando o dono ratifica as decisões do executor

## Quando o dono ratifica as decisões do executor: recomendação

Nada foi editado. Recomendo ratificar por alcance: a decisão que outro entregável consome é ratificada antes de o dependente começar, as demais em lote no ponto de medição, e nenhuma publicação sai com decisão do executor pendente. A cadência é do dono; o código de apoio protege só 6 ou 7 dos 18 entregáveis que o release roda neste roadmap, então a regra escrita é o que vale no começo.

## 1. Que decisões o executor toma, e o que quebra se forem rejeitadas

| Classe | Exemplos neste pipeline | Rejeição tardia quebra |
|---|---|---|
| Local | Estrutura interna, nomes privados, organização de testes, escolhas do plano | Só o próprio entregável |
| Contrato | Comandos da CLI (E3 → E18, E22, E7), esquema de spec (E5 → E6, E19), esquema de plano (E6 → E20, E7, E8), estado em JSON (E7 → E12), forma do gerador (E2 → E6, E12), identificador de achado (E21 → E24, E12), caminhos de artefato (DEC-026) | O desenho dos dependentes |
| Publicado | Nome de skill (DEC-027), caminhos e formatos depois de E11, numeração (DEC-028) | Artefato na mão de usuários; exige migração |
| Fora da regra | Sondas de E14 e políticas de E11/E16: o card só fecha com ratificação (E14 pronto; E11 e E16 critério 3). Cara e irreversível já para (DEC-020). Contrariar DEC ou gate já para (DEC-007) | Nada novo a decidir |

- **Refinamento de `{verify}`:** não existe sob o release. O workflow rejeita plano que altere o comando do card (`decompose.md:131`).
- **Classe "publicado":** some como classe operacional se nada é publicado com pendência. Por isso o mecanismo só precisa de dois valores, `local` e `contrato`.
- **As cinco pendentes de hoje** são estruturais, tomadas no planejamento. DEC-013 e DEC-029 precisam de resposta antes de qualquer spec; DEC-026 e DEC-027 antes do spec de E19; DEC-028 antes de E17.

## 2. Cadências comparadas

Contagem pelo grafo: 18 entregáveis passam pelo release (os 16 de engenharia, E1 e E13) e 5 são operados pelo dono. Dos 18, 15 têm dependentes. O número de decisões por spec não está medido.

| Cadência | Paradas a mais do dono | Desperdício por rejeição tardia | A execução trava? | Código novo |
|---|---|---|---|---|
| A. Toda pendente segura dependentes | Cerca de 15; a cadeia crítica vira um lançamento por elo | Só o próprio entregável | Sim: `next` nunca encadeia | Espera de dependência lendo `decisions.md`; evento de ratificação |
| B. Lote nos 4 pontos de medição | 0 | Até 11 entregáveis antes de E17; esquema de E5 rejeitado refaz E6, E19, E20, E7 | Não | Só pré-condição nos cards |
| C. Depois de cada execução | 0 (o dono já está no lançamento); 4 a 5 lançamentos no mínimo | O que encadeou na mesma execução (até 12) | Não | Pergunta a mais na skill; evento de ratificação |
| D. Por alcance (recomendada) | 0 sessões novas; cerca de 6 lançamentos se cinco entregáveis produzirem contrato | O próprio entregável, se o alcance estiver certo; senão como C | Só os dependentes do contrato | Campo de alcance, retenção na execução, lista no preflight, ratificar/rejeitar na CLI, aviso no checker |

Dois fatos pesam contra o lote puro (B):

- **Pendente vale como vigente para os agentes.** O prompt comum e o revisor de spec mandam nunca contrariar "decisões registradas", sem distinguir status (`roadmap-release.js:1046`, `1473`). O dependente constrói em cima.
- **O bloco de pendentes estoura.** O limite é 20 (`roadmap.config.json:35`) e cada decisão gera um item (`events.md:309`).

## 3. Rejeição, mecanicamente

- **Registro.** Não cabe uma palavra "rejeitada": o checker só aceita vigente, pendente ou substituída (`check-roadmap.mjs:705-715`), e só Status e "Revisitar quando" mudam numa linha antiga (`formats.md:308`). Rejeitar é o dono acrescentar uma DEC nova (origem user, vigente, com a escolha do executor em "Alternativa descartada"), e a linha antiga passa a `substituída por DEC-NNN` (`events.md:61`, `201`).
- **Lacuna na receita.** `events.md:311` só descreve a rejeição de um item sem linha; a de uma linha existente não tem receita.
- **Regra de contradição.** Se a decisão rejeitada já está citada na estratégia (caso das cinco de hoje), a DEC do dono preenche "Contradiz". O checker avisa `contradiction-unabsorbed` até uma revisão aprovada (`events.md:68`). Se era só do spec, "Contradiz" fica `-`.
- **Entregável já mesclado.** O status não regride. Abre-se um bloqueio que afeta o entregável e os dependentes já iniciados; o seletor já deixa bloqueados fora de `next` (`roadmap-release.js:144`). A correção é um commit corretivo, ou `git revert -m 1` do merge e nova execução com a decisão em `notes` (`operator.md:62`). Não executei esse caminho nem li o que `force` faz com um entregável já mesclado.
- **Já publicado.** A regra impede o caso para decisões do executor. Se o dono mudar de ideia depois, é decisão nova, corrigida como patch (DEC-028), e cai na questão aberta de reversão.

## 4. Como o dono ratifica

- **Unidade.** Uma lista, respondida numa passada, no lançamento de cada execução e em cada ponto de medição. Nunca com execução em andamento: um commit na branch alvo no meio suja o worktree de integração (`roadmap-release.js:1911`).
- **Quem prepara.** O executor. Até E19 as decisões do spec são strings (`roadmap-release.js:917`), então o custo se errada é composto lendo a seção de decisões autônomas do spec. Depois vem do bloco de dados.
- **Onde grava.** Num worktree da branch de release, com commit antes do lançamento. A descoberta lê o estado do alvo (`roadmap-release.js:955`) e o tracker não commita.
- **Envelhecimento.** Um item agregado por entregável no bloco de pendentes, em vez de um por decisão. `local` pode ser adiada só até o ponto de medição seguinte.

### Formato, com as cinco de hoje

```
Ratificação -- 5 decisões do executor pendentes (nada executado em cima de nenhuma)

| DEC | Alcance | O que fixa | Custo se errada | Necessária antes de | Recomendo |
| DEC-013 | contrato | Cortes: E3→E3,E18,E22; E5→E5,E19; E6→E6,E20; E9→E9,E21,E24 | Hoje: revisão da estratégia. Depois dos specs: replanejar as fatias. Alonga a cadeia (E9, E21, E24 em série) | qualquer spec | ratificar |
| DEC-029 | contrato | Quem roda cada sonda; lançador em lote; trava de paralelismo mantida | Sonda no modo de permissão errado dá resultado falso; a trava custa tempo de parede | E14 | ratificar |
| DEC-026 | contrato | Artefatos em docs/plans/<tópico>/ com nomes fixos; relatório em docs/reports/ | Antes de E11: trocar constantes. Depois: migração | spec de E19 e de E8 | ratificar |
| DEC-027 | contrato | Spec: até 5 perguntas e 1 aprovação; plano sem aprovação; nome plan-writer | Prosa da skill; renomear é barato antes de E11 e caro depois | spec de E19 e de E20 | ratificar |
| DEC-028 | local até E17 | 1.7.0, 2.0.0, 2.1.0, 2.2.0; linha 1 do checker; formato 1 | Quase nenhum: número não é reaproveitado | E17 | ratificar (pode adiar) |

Responda "todas", ou por linha: DEC-NNN: ratifico | rejeito: <o que vale no lugar> | adio (só local).
```

DEC-013, DEC-027 e DEC-029 juntam várias escolhas numa linha, contra `events.md:307`. Uma rejeição parcial é uma DEC do dono que repete as partes mantidas.

## 5. Código ou só regra

Os dois, com o limite dito:

- **11 entregáveis** (E1 a E7 e fatias) rodam na 1.6.0, sem nada disso. Vale a regra, com lançamento por lista explícita de entregáveis.
- **E8** roda na 1.7.0, já com a lista no preflight e a CLI.
- **6 entregáveis** (E9, E21, E24, E10, E12, E13) rodam com a retenção na execução.

Não é preciso entregável novo.

## Texto para "Execução deste roadmap"

```
- Toda decisão do executor é registrada com um alcance: `local` (errar custa só o próprio entregável) ou `contrato` (outro entregável lê o que ela fixa: comando, esquema, caminho, nome ou formato). Na dúvida, `contrato`.
- Uma decisão de `contrato` pendente segura os dependentes do entregável: eles não começam antes da ratificação, e os demais seguem. Uma decisão `local` espera o ponto de medição seguinte (DEC-030).
- Não se publica com decisão do executor pendente: ratificar todas é pré-condição de E17, E11, E16 e E13.
- O dono ratifica numa passada, no lançamento de cada execução do release e em cada ponto de medição, nunca com uma execução em andamento. O executor apresenta a lista (alcance, custo se errada, o que já foi construído em cima, resposta recomendada) e grava as respostas na branch de release, com commit antes do lançamento.
- Rejeitar é registrar uma decisão nova do dono que substitui a do executor. O entregável que a implementou e os dependentes já iniciados recebem um bloqueio até a correção.
- As decisões das sondas (E14) e das medições de política (E11, E16) são ratificadas dentro do próprio card, que não fecha sem isso.
- Até a publicação de E11 o release instalado não confere essa regra: o dono lança por lista explícita de entregáveis, sem pôr na mesma execução um entregável e o dependente de uma decisão de `contrato` dele.
```

Em "Riscos transversais": `- Uma decisão do executor é rejeitada depois de um dependente construído em cima dela -> alcance registrado em cada decisão, dependentes retidos e nenhuma publicação com pendência (DEC-030).`

## Linha de decisão

```
| DEC-030 | <data da resposta> | - | As decisões do executor são ratificadas por alcance: a de contrato (outro entregável lê o que ela fixa) antes de um dependente começar; a local, em lote no ponto de medição. Não se publica com decisão do executor pendente. Rejeitar é uma decisão nova do dono que substitui a do executor. | Toda pendente segura os dependentes; só em lote nos pontos de medição; depois de cada execução, sem segurar dependentes. | - | O autor marcar como contrato uma parcela relevante das decisões, ou uma decisão marcada local ser rejeitada depois de um dependente integrado. | user | vigente |
```

"Contradiz" fica `-` se os cards forem ajustados antes do primeiro commit da pasta (ela ainda não está versionada). Depois disso, a célula nomeia os cards e a mudança entra por revisão.

## Mudanças nos cards e requisitos

**E5**
- Peça 1: "...reversibilidade (DEC-020) e alcance (DEC-030)".
- Critério 2: acrescentar "ou sem alcance". Teste: `plugins/productivity-tools/scripts/spec-tool.test.mjs`.

**E3**
- Peça 1: acrescentar "decisões do executor pendentes, com os dependentes já iniciados".
- Peça 3: acrescentar "ratificar e rejeitar uma decisão do executor (DEC-030)".
- Critérios novos:

```
5. Dada uma decisão do executor pendente, quando o comando de ratificação roda, então só o status da linha passa a vigente, o item pendente sai e há uma linha de log; uma decisão que não é do executor ou não está pendente é recusada sem alterar arquivo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
6. Dada uma decisão do executor pendente e a decisão do dono que a rejeita, quando o comando de rejeição roda, então entra uma linha nova de origem user e a antiga passa a substituída por ela, sem outra célula alterada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
```

**E2**
- Peça 3: acrescentar a checagem "decisão do executor pendente sob um dependente já iniciado ou sob um entregável publicado", como aviso.
- O critério 1 já cobre toda checagem nova. Teste: `check-roadmap.test.mjs`.

**E18**
- Peça 1: o preflight lista as decisões do executor pendentes por entregável, lidas do alvo. A skill as mostra na parada única antes de qualquer agente; hoje `SKILL.md:12` só admite quatro perguntas, nenhuma de ratificação.
- Critério novo:

```
4. Dada uma pasta com uma decisão do executor pendente, quando o preflight roda com a branch alvo, então a decisão aparece na saída com o entregável a que pertence. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
```

**E8**
- Peça 5: acrescentar "uma decisão de alcance contrato deixa os dependentes fora da execução, com o motivo, sem parar os demais (DEC-030)".
- Critério novo (o card vai a 11, o que reforça o risco de divisão já escrito):

```
11. Dado um entregável que termina com uma decisão autônoma de alcance contrato e um dependente selecionado na mesma execução, quando o workflow chega ao dependente, então ele é pulado citando a decisão, e um entregável sem essa dependência roda. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
```

**E17, E11, E16, E13**
- Uma peça "ratificação em lote das decisões do executor pendentes, antes da preparação da publicação".
- Critério novo em cada um:

```
Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
```

**E22**: a receita do tracker ganha a rejeição de uma linha existente, sem critério novo.

**Requisitos**
- REQ-003: acrescentar "ratificação e rejeição de decisão do executor".
- REQ-026: acrescentar "e o alcance de cada decisão autônoma".
- REQ-044 (novo): "Uma decisão do executor pendente de alcance contrato segura os entregáveis dependentes, e nenhuma publicação sai com decisão do executor pendente." Tipo constraint; fontes SRC-11, DEC-007, DEC-030; entregáveis E2, E8, E11, E13, E16, E17, E18; coberto.
- O resumo de cobertura passa a 43 requisitos, 38 cobertos.

## Alternativas rejeitadas

1. **Toda pendente segura os dependentes.** Quase todo spec tem decisão autônoma, então nenhuma execução encadearia dois elos. É a alternativa descartada em DEC-007 atrasada em um entregável.
2. **Só em lote nos pontos de medição.** Zero interrupção, mas onze entregáveis antes do primeiro lote, com os contratos mais consumidos (E2, E3, E5, E6) construídos sem o dono ver, e o bloco de pendentes acima do limite.

## O que conferi no código

- `roadmap-release.js:1062`: decisões autônomas pela opção recomendada, por texto fixo.
- `roadmap-release.js:1578-1589`: decisões gravadas por agente com a skill do tracker; falha vira só `concern` (em plan-only é falha, linha 1581).
- `roadmap-release.js:110`, `153`, `1999-2003`: dependência satisfeita só por estar no alvo ou ter terminado na execução; nada lê decisões.
- `roadmap-release.js:955`: a descoberta lê `state.md` e a estratégia do alvo, não `decisions.md`. `preflight.mjs` também não cita `decisions.md`.
- `roadmap-release.js:1494-1498`, `2017`: só insumo humano bloqueante e contradição param o entregável.
- `roadmap-release.js:2035`, `2086`: o relatório lista só as decisões desta execução, sem acumulado.
- `operator.md`: não há passo de ratificação entre as ações do operador.
- `check-roadmap.mjs:709-710`: linha pendente não gera checagem; `:652`: aviso `pending-limit`.
- `events.md:306-311`, `clarify.md:124`: a receita e a política de autonomia como descritas acima.

## Custo se a recomendação estiver errada

- **Autor marca contrato demais:** mais lançamentos, cada um pagando descoberta, preflight e linha de base dos gates (`operator.md:77`).
- **Autor marca de menos:** o desperdício volta ao da cadência C, limitado pelo portão de publicação.
- **Código:** dois comandos, um aviso, um campo, uma lista e uma retenção, com E8 em onze critérios.
- **Voltar atrás** é mudar a regra para "tudo local"; não há dado a migrar.

## Quem decide o quê

- **Dono:** a cadência (cria um motivo novo de retenção, como DEC-020), a pré-condição de publicação (estende o que bloqueia publicar, DEC-017), toda mudança de card ou requisito, e cada ratificação.
- **Executor, sob DEC-007, pendente de ratificação:** o formato da lista, o nome do campo e dos comandos, o código do aviso, onde o alcance aparece em `decisions.md` (sugiro ao fim da célula Decisão, sem mudar o formato) e o item agregado de pendentes.

## Perguntas ao dono

1. **Quando ratificar?**
   - (a) Por alcance: contrato antes do dependente, local em lote, nada publicado com pendência. Recomendada.
   - (b) Só em lote nos quatro pontos de medição.
   - (c) Toda pendente segura os dependentes.
2. **A regra ganha código neste roadmap?**
   - (a) Sim, o mínimo em E2, E3, E5, E18 e E8, sabendo que só protege de E8 em diante. Recomendada.
   - (b) Só a regra escrita e a pré-condição nos quatro cards de medição; o código fica para depois de E13.


---

# Solução 2: local do extrator, execuções e regra de detecção, metas de melhora

## Três questões de medição do roadmap: soluções recomendadas

Nada foi editado no repositório nem em `~/.claude`. Os scripts de apoio e as saídas estão em `<scratchpad da sessão>\q-medicao\`. Todo valor em dólar abaixo é estimativa pelos preços corrigidos de §9A, não fatura.

As três recomendações, em uma linha cada:

1. **Local do extrator:** ferramenta só do repositório em `tools/measure/`, com G1 e CLAUDE.md ajustados. Decisão do dono, porque muda um gate.
2. **Execuções e detecção:** 5/3/3/3/1/1 execuções na linha de base, três classes de contador com regra própria, 16 defeitos em cenário semeado com 40 tentativas por classe e margem de 15 pontos. Decisão do dono.
3. **Metas:** metas derivadas por construção (linha de base menos o que o código remove), que não bloqueiam publicação, mas exigem decisão registrada do dono no fechamento. Decisão do dono.

## O que medi nas sessões reais

Reexecutei `skill-runs.mjs --out <scratch>`: 169 sessões, 353 execuções (eram 349; as sessões cresceram). Reprecifiquei com leitura de cache a 0,05x e escrita de 1 hora a 2x. As medianas reproduzem §9A: planner 28,3, tracker 3,4, coordinator 31,9, plan-only 2,17.

**Release plan-only (20 lançamentos concluídos, seis cópias da skill):**

- 19 de 20 têm exatamente 9 chamadas: 4 opus, 4 sonnet, 1 haiku, com os mesmos rótulos.
- 1 de 20 teve uma segunda rodada de revisão do plano (mais 2 chamadas). Taxa de rodada extra: 5% (intervalo de 95%: 0,9% a 24%).
- Bytes de prompt (soma da primeira mensagem de cada agente) variam de 0,4% a 2,1% dentro de uma mesma cópia.
- Entre cópias, os bytes subiram de cerca de 65,7 mil (cópia A) para 71,9 mil (cópia F), 9,6% em um dia de correções.
- Custo: 1,90 a 2,61.

**Release completo (5 lançamentos concluídos do mesmo card):**

- O número de tarefas variou (2 ou 3), porque o autor do plano decide.
- O modelo do revisor por tarefa variou (sonnet ou opus), porque o plano atribui o nível.
- 2 de 5 tiveram 3 rodadas na revisão de spec de uma tarefa.
- Total de chamadas: 29 a 36.
- O lançamento retomado repete discovery, preflight, setup, spec, revisão do spec, plano, revisão do plano, status, progresso e a revisão da última tarefa pronta.

**Custos por tipo de execução:**

| Tipo | Observado | Base |
|---|---|---|
| Completo sem interrupção | 3,99 | 1 lançamento, 2 tarefas |
| Parada e retomada | 6,73 / 7,10 / 7,57 | 3 sessões |
| Coordinator com 5 a 8 subagents | mediana 17,6 (3 a 37) | 6 execuções |
| Chamada de revisão de plano | 0,27 | preços antigos, levemente altos |
| Chamada de revisão de spec | 0,24 | idem |
| Chamada de revisão por tarefa | 0,11 a 0,12 | idem |
| Chamada de revisão final | 0,15 | idem |

## Questão 1: onde vive o extrator

### Recomendação

Ferramenta só do repositório em `tools/measure/`, com G1 e CLAUDE.md ajustados. O lançador em lote, o comparador, o arnês de revisão e os defeitos plantados ficam no mesmo lugar. `make-sandbox.mjs` continua onde está e ganha apenas o entregável de várias tarefas, que é verificação legítima da skill.

```
tools/measure/
  session-metrics.mjs        extrator; --root e --out obrigatórios, sem padrão
  session-metrics.test.mjs
  prices.json                tabela de preços datada
  make-scenario.mjs          importa makeSandbox do plugin; semeia defeitos e estados
  make-scenario.test.mjs
  defects/manifest.json      id, classe, tipo, arquivo, sentinela
  defects/sentinels/         testes e checagens ocultos, nunca copiados ao sandbox
  run-batch.mjs              lançador (peça 4)
  run-batch.test.mjs
  compare.mjs                aplica a regra do portão (questão 2)
  compare.test.mjs
  review-harness.mjs         arnês de estágio de revisão (E11 e E16)
  review-harness.test.mjs
  fixtures/                  transcrições fabricadas
```

**Mudança em G1 (estratégia e `CLAUDE.md:10`):**

`node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`

**Mudança no bloco Layout do CLAUDE.md:** acrescentar a linha `tools/measure/   # Repo-only measurement tools (not shipped): session-metrics extractor, scenario generator, batch launcher, gate comparator. Outputs are never committed.`

**Mudança no `.gitignore`:** acrescentar `tools/measure/out/`.

**Nunca commitar:**

- `runs.json`, `runs.csv` e `verify.json`: trazem slug de projeto, id de sessão, caminho da skill e descrições de agentes, que são texto de conversa.
- Qualquer transcrição real.
- O caminho do diretório pessoal.
- Sandboxes gerados, que vivem fora do repositório.

`measurements.md` recebe só agregados.

### Texto para o card E1

- **Peça 1 (troca da última frase):** "A ferramenta vive em `tools/measure/`, fora do plugin publicado (DEC-030); a raiz das transcrições e a pasta de saída são parâmetros obrigatórios, sem valor padrão."
- **Peça 2 (acréscimo):** "O entregável de várias tarefas entra em `make-sandbox.mjs`; os defeitos plantados, os estados semeados, o plano fixo, o tema roteirizado e o evento fixo ficam em `tools/measure/`."
- **Arquivos de teste:** `tools/measure/session-metrics.test.mjs`, `tools/measure/make-scenario.test.mjs`, `tools/measure/run-batch.test.mjs`, `tools/measure/compare.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs`.
- **Critérios 1 e 2:** trocar a evidência por `node --test tools/measure/session-metrics.test.mjs`.
- **Critério 3 (dividido):**
  - "3. Dado o gerador de sandbox, quando ele cria o cenário, então existe um entregável com mais de uma tarefa e o roteiro de parada e retomada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs}"
  - "4. Dado o gerador de cenário, quando ele semeia os defeitos, então cada defeito do manifesto está presente no artefato semeado e a sentinela dele acusa presença. {verify: test; evidence: node --test tools/measure/make-scenario.test.mjs}"
- **Critério novo:** "5. Dados os arquivos de `tools/measure/`, quando o teste de privacidade roda, então nenhum contém id de sessão, caminho de diretório pessoal nem texto fora dos dados fabricados. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}"

### Linha de decisão

| ID | Data | Entregável | Decisão | Alternativa descartada | Contradiz | Revisitar quando | Origem | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-030 | 2026-11-10 | E1 | As ferramentas de medição vivem em `tools/measure/`, fora do plugin; G1 ganha o glob `tools/**/*.test.mjs`. `make-sandbox.mjs` fica no plugin e recebe só o entregável de várias tarefas. | Dentro de `plugins/productivity-tools/scripts/`; dentro do `marketplace-tools`. | - | Outro usuário do plugin pedir a ferramenta de medição. | user | vigente |

### Alternativas rejeitadas

- **No plugin (o que o card supõe).** A pasta inteira do plugin vai para o cache, e hoje isso já inclui 12 arquivos de teste, o `make-sandbox` e as fixtures. Uma ferramenta que lê `~/.claude/projects` seria distribuída a todos, e cada correção nela pediria bump nos dois lugares.
- **No `marketplace-tools`.** Também é publicado. Exige bump e validação de outro plugin, que G3 e G5 não cobrem, e a descrição dele (scaffold e validação) não comporta medição.

### Verificado

- **Glob vazio não falha:** `node --test` com um padrão sem arquivos passa em Node 22.17.1; com um teste em `tools/`, ele é contado.
- **Linter:** `lint-plugin.mjs:307-309` varre `scripts`, `skills` e `hooks`, pula `fixtures` e `.test.mjs`, e só procura escrita em `CLAUDE_PLUGIN_ROOT`. Caminho absoluto é checagem de julgamento da skill (`validate-plugin/SKILL.md:42-46`), não do linter.
- **`make-sandbox.mjs`:** exporta `makeSandbox` (`:389`), depende do checker por caminho relativo (`:13`) e não é citado por nenhum SKILL ou reference do release.
- **G1 em outros arquivos:** o comando só aparece em `CLAUDE.md:10` e na tabela de gates da estratégia.

### Correções ao esboço da Análise 3

- "Primeiro `scripts/` de nível de plugin" vale só para o `productivity-tools`: `mcp-sql-server` e `sql-server-tools` já têm.
- Recomendar commitar os três scripts atuais "como evidência histórica" contraria o risco do próprio E1:
  - `skill-runs.mjs:11` e `:332` trazem o diretório pessoal.
  - `aggregate.mjs:4` e `versions.mjs` trazem prefixos de id de sessão.
  - O padrão de `--out` é a pasta do script (`:12`), então uma execução sem `--out` grava `runs.json` dentro de `docs/reports/`.
  - Recomendo não commitar como estão: limpar esses literais ou deixar fora, já que E1 os substitui.

### Custo se errado e quem decide

- **Custo se errado:** mover uma pasta e reverter um glob.
- **Quem decide:** o dono, porque muda um gate (DEC-007). Sem resposta, o executor só pode seguir a opção do card (plugin).

## Questão 2: execuções por variante e regra de detecção

### Recomendação

**Execuções por variante:**

| Variante | E15 | E17 | E11 | E16 | E13 |
|---|---|---|---|---|---|
| Release plan-only | 5 | 5 | 5 | - | 5 |
| Release completo | 3 | 3 | 3 | 3 | 3 |
| Parada e retomada | 3 | - | 3 | 3 | 3 |
| Coordinator, plano fixo | 3 | - | - | - | 3 |
| Planner / tracker | 1 / 1 | 1 / 1 (planner só com E4) | - | - | 1 / 1 |
| Detecção, planos semeados (2 planos × 4 defeitos × 5) | 10 | - | 10 | - | 10 |
| Detecção, código semeado (2 branches × 4 defeitos × 5) | 10 | - | - | 10 | 10 |

**Contadores, por lançamento, extraídos dos rótulos e da primeira mensagem de cada agente:**

| Classe | Definição | Varia? | Regra de "piorou" |
|---|---|---|---|
| Estrutural | Chamadas fora do laço de tarefas e de rodada 1, somadas com peso de preço (haiku 1, sonnet 20, opus 40); e bytes UTF-8 dos prompts dessas chamadas | Chamadas: não (19 de 19 iguais). Bytes: até 2,1%, porque o prompt embute texto gerado | Chamadas: mediana depois maior que mediana antes. Bytes: mediana depois maior que 1,03 × mediana antes |
| Por tarefa | Chamadas ponderadas no laço de tarefas dividido pelo número de tarefas | Sim: número de tarefas e nível são escolhas do autor do plano | Separação total: mínimo depois maior que máximo antes |
| Condicional | Rodadas além da primeira e chamadas de correção | Sim: depende do veredito do revisor | Separação total |
| Contexto principal (coordinator, 3 execuções) | Chamadas Agent por modelo pedido, bytes de prompt, turnos | Sim | Separação total |
| Estático (planner e tracker, 1 execução) | Bytes de prosa carregável para o roteiro, calculados dos arquivos no commit | Não | Maior que o da linha de base. Os contadores dinâmicos dessas duas skills são só registrados |

**Justificativa das tolerâncias:**

- 3% é uma vez e meia a maior variação observada dentro de uma cópia. Nenhum par de execuções da mesma cópia difere tanto.
- Separação total tem falso alarme de no máximo 5% com 3 contra 3, 1,8% com 5 contra 3 e 0,4% com 5 contra 5. Com 2 contra 2 seria 17%.
- "Qualquer execução pior" foi descartada: com 5% de rodada extra por execução, daria alarme em 14% dos pontos com 3 execuções e 23% com 5. Por maioria, 0,7%.

O portão compara totais por variante, não por papel: o pipeline nativo troca os papéis. A tabela por papel é registrada.

**Defeitos plantados: 16, sendo 8 de plano e 8 de código.**

- **Plano**, tirados da lista de bloqueios do revisor (`roadmap-release.js:1543`):
  1. critério sem tarefa ou sem teste;
  2. tarefa sem comando de verificação;
  3. comando que não existe;
  4. ordem de tarefas errada;
  5. evidência que não prova o critério;
  6. critério testável marcado como humano;
  7. tarefa externa declarada não externa;
  8. comando `{verify}` do card trocado.
- **Código:**
  1. critério do card não implementado;
  2. teste que não afirma nada;
  3. erro de fronteira com teste passando;
  4. arquivo fora da lista da tarefa;
  5. erro engolido;
  6. efeito externo não idempotente;
  7. teste existente enfraquecido;
  8. valor fixo que satisfaz o teste.

**Como entram no pipeline, sem arnês:**

- **Planos:** um plano semeado já commitado na branch do entregável, rodado em plan-only. O laço de revisão do plano é incondicional (`:1540`).
- **Código:** um commit semeado como última tarefa pronta, rodado como retomada. A última tarefa pronta é revista de novo (`:1686-1688`).

**Capturado ou perdido, sem pessoa lendo:** cada defeito tem uma sentinela (teste oculto ou checagem do arquivo de plano).

- **Perdido:** o pipeline aprovou o estágio (plano aprovado, ou merge feito) com a sentinela ainda acusando o defeito.
- **Capturado:** qualquer outro desfecho, inclusive parada com achado aberto.
- **Inválido:** falha de infraestrutura antes da revisão; a execução é repetida.

**Regra de aprovação, por classe:** bloqueia quando as capturas caem 6 ou mais em 40 tentativas (15 pontos). A detecção é medida no ponto cujo escopo muda o autor ou o revisor da classe.

**Taxas calculadas** (tentativas binomiais independentes, mesma taxa nos dois lados, linha de base também amostrada):

| Taxa de base | Falso alarme | Queda real de 30 pontos passa | De 20 passa | De 10 passa |
|---|---|---|---|---|
| 90% | 2,0% | 4% | 23% | 68% |
| 80% | 6,1% | 6% | 26% | 65% |
| 60% | 10,5% | 6% | 28% | 63% |

A regra pega quedas grandes, não pequenas. Defeitos de dificuldade desigual reduzem o falso alarme: 3,0% contra 5,2% numa simulação com 36 tentativas.

**Medições de política (E11 e E16):**

- **Arnês de estágio:** vale a pena construir, em `tools/measure/review-harness.mjs`. Ele gera um workflow que chama só o revisor sobre um artefato semeado, com o construtor de prompt do próprio workflow (bloco `// <pure>`, via `load-pure.mjs`).
- **Tamanho:** 80 tentativas por braço (8 defeitos × 10).
- **Regra:** o braço reduzido só é adotado se capturar no máximo 8 a menos que o atual. Fora disso, mantém o atual.
- **Taxas dessa regra:** adota em 95% dos casos se os braços forem iguais, em 9% se for 20 pontos pior, em 0,4% se for 30 pontos pior, e em 54% se for 10 pontos pior.
- **Autor de plano em dois modelos (E11, peça 4):** precisa de execuções completas, 5 por braço, pelos contadores condicionais.
- **Lacuna:** E11 peça 2 mede a revisão de spec em três braços, e o conjunto de E1 só tem defeitos de código e de plano. Faltam 8 defeitos de spec, tirados da lista de `:1473`.

### Custo estimado por ponto

| Ponto | Conteúdo | Estimativa |
|---|---|---|
| E15 | Variantes ≈ 135 + detecção ≈ 80 | ≈ US$ 215 |
| E17 | Plan-only, completo, tracker; planner se E4 | ≈ US$ 30 (≈ 58 com planner) |
| E11 | Variantes ≈ 50, detecção ≈ 30, braços ≈ 150 | ≈ US$ 230 |
| E16 | Variantes ≈ 39, detecção ≈ 50, braços ≈ 160 | ≈ US$ 250 |
| E13 | Tudo | ≈ US$ 215 |

Suposições das estimativas:

- completo ≈ 5 e retomada ≈ 8 com 4 tarefas;
- coordinator ≈ 18;
- execução com plano semeado ≈ 3 e com código semeado ≈ 5.

**Alternativa mais barata (≈ US$ 150 na linha de base):** 3/2/2/2/1/1, 24 tentativas de detecção por classe e braços de 40.

- Com 2 execuções a separação total tem 17% de falso alarme, então os contadores ruidosos deixam de bloquear.
- A detecção com margem de 4 em 24 dá falso alarme de 10% e deixa passar 34% das quedas de 20 pontos (taxa de base de 80%).
- Braços de 40 adotam um braço 20 pontos pior em 19% das vezes.

### Texto para os cards

**E15, peça 1 (troca da última frase):** "Execuções por variante: 5 plan-only, 3 completo, 3 parada e retomada, 3 coordinator (DEC-031)."

**E15, peça 3:** "Taxa de detecção em cenário semeado: 2 planos e 2 branches com 4 defeitos cada, 5 execuções de cada (40 tentativas por classe)."

**E15, critério 3:** "Dado o cenário semeado, quando o pipeline atual roda 5 vezes sobre cada artefato, então capturas e perdas por defeito, pela sentinela, estão registradas com 40 tentativas por classe. {verify: human; evidence: o dono confere as linhas de detecção em measurements.md}"

**E1, critério novo:** "6. Dados dois conjuntos de contadores de exemplo, quando o comparador roda, então devolve piorou, não piorou ou inconclusivo por contador segundo a classe (estrutural, por tarefa, condicional, estático) e a queda de detecção por classe com a margem de 6 em 40. {verify: test; evidence: node --test tools/measure/compare.test.mjs}"

**E17, E11, E16 e E13:** onde está "sem piora nos contadores", acrescentar "pela saída do comparador de E1 (DEC-031)".

**REQ-035 (acréscimo):** "com as classes e tolerâncias de DEC-031".

### Linha de decisão

| ID | Data | Entregável | Decisão | Alternativa descartada | Contradiz | Revisitar quando | Origem | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-031 | 2026-11-10 | E15 | Execuções 5/3/3/3/1/1. Piora: estrutural por mediana (bytes com 3%); por tarefa e condicional por separação total. Detecção: 16 defeitos em cenário semeado, 40 tentativas por classe, bloqueia com queda de 6. Braços: 80 tentativas, margem 8. | Separação total em tudo; 3/2/2/2 com 24 tentativas; regra por defeito. | - | Um ponto ficar retido por contador estrutural que subiu por correção de prompt. | user | vigente |

### Alternativas rejeitadas

- **A regra do esboço** (ganho só com separação total, margem de 15 em 30, cláusula por defeito). Ela é regra de ganho, e o portão de DEC-017 precisa de "piorou"; em contadores determinísticos o empate é a regra. A cláusula "defeito pego em todas as execuções da base e perdido na maioria das novas" dá falso alarme de 19% (base 90%) a 42% (base 80%) com 10 defeitos e 3 execuções.
- **Detecção só pelo arnês de estágio.** Mais barata, mas não mede o laço de correção nem a revisão final, e na linha de base os prompts de revisão de spec e plano estão embutidos, fora do bloco puro.

### Outras correções ao esboço

- As opções com 3 a 5 execuções de planner e tracker contrariam DEC-016, que fixa uma.
- O custo de 6,85 para o "completo" já é de sessões com parada e retomada. O lançamento sem interrupção medido custou 3,99, e a retomada não é 13,7.

### Verificado e não verificado

- **Verificado:** as distribuições da seção de medições acima; `runReviewLoop` (`:417-460`, teto de 2 correções, `:809`); a reutilização declarada pelo agente de plano (`:1519`, campo `reused`); o esquema de achado (`:913-915`).
- **Não verificado:** se o agente de plano preserva um plano semeado sem reescrevê-lo, e se a retomada aceita um commit semeado com as marcas certas. Uma execução de cada (≈ US$ 8) responde, antes do spec de E1.

### Custo se errado e quem decide

- **Custo se errado:** um ponto retido por falso alarme (2% a 10%) ou uma queda de 20 pontos que passa (cerca de um quarto das vezes).
- **Efeito colateral a conhecer:** o contador de bytes sobe com qualquer texto acrescentado a um prompt. As cópias A a F subiram 9,6%, então correções de comportamento contam como piora.
- **Quem decide:** o dono, porque define a régua de um gate e o gasto que ele opera.

## Questão 3: metas de melhora

### Recomendação

Metas derivadas por construção. O spec de cada entregável de engenharia que promete economia declara o contador, a variante e o valor previsto, calculado como a linha de base menos o que o código remove. O ponto de medição confere se o previsto apareceu, com as mesmas tolerâncias da questão 2.

**Onde cabe meta:**

| Skill | Meta | Entregável | Ponto |
|---|---|---|---|
| Release | Chamadas estruturais ponderadas e bytes de prompt por variante | E18, E8, E10 | E17, E11, E13 |
| Release | Chamadas repetidas no segundo lançamento da retomada | E8 | E11 |
| Tracker | Prosa carregada no evento fixo | E22 | E17 |
| Planner | Prosa carregável | E4 | E17 |
| Coordinator | Prosa antes do lançamento; turnos e chamadas no plano fixo | E7, E12 | E13 |

Sem meta: dólar, tempo de parede e turnos, que ficam registrados com mediana e faixa; e detecção, que só tem a regra de não cair. E16 também não tem meta, porque os modos nascem desligados (DEC-021).

**O que já dá para calcular antes de qualquer mudança** (ilustração com os dados aproximados; recalcular em E15):

- **E18, plan-only:** o registro de status sai de um agente sonnet com a skill do tracker para uma chamada haiku que roda a CLI. O total ponderado cai de 241 para 222 (−7,9%), e saem cerca de 8,1 mil bytes de prompt de 68,8 mil, menos o prompt novo.
- **E8, retomada:** o segundo lançamento deixa de repetir a revisão de spec e a de plano quando os arquivos não mudaram. São 2 chamadas opus a menos, 80 de 589 ponderados (−13,6%), e cerca de 16,5 mil bytes de prompt a menos.
- **E22:** a prosa do evento fixo deixa de incluir `formats.md` inteiro (cerca de 7,9 mil tokens).

**Meta perdida:** não bloqueia a publicação (DEC-017 fica como está). O ponto registra "meta não atingida" em `measurements.md` e abre um pendente do dono. No fechamento (E13), uma meta ainda perdida exige decisão registrada do dono (aceitar com motivo ou abrir entregável) antes de publicar.

**Onde é registrado:**

- **Estratégia, seção "Métricas e metas":** troca do texto pelo procedimento, mais uma tabela "Metas derivadas" preenchida por revisão da estratégia logo depois de E15.
- **Estratégia, não objetivo da linha 22:** passa a "Datas, durações ou metas numéricas arbitrárias; metas derivadas da linha de base valem (DEC-032)".
- **`measurements.md`:** linhas de Tipo "meta" e "comparação". Como a célula tem limite de 300 caracteres, o detalhe por papel vai num JSON de agregados citado na linha.
- **Critérios de E22.1, E4.3 e E12.4:** hoje "menor que a medida" passa com um byte a menos. Trocar por "não maior que a meta derivada registrada na estratégia".

**Texto para "Métricas e metas":** "As metas são derivadas, não fornecidas: o spec de cada entregável que promete economia declara o contador, a variante e o valor previsto (linha de base menos o que a mudança remove por construção). O ponto de medição seguinte confere o previsto com as tolerâncias de DEC-031. Meta não atingida não bloqueia a publicação; é registrada e, em E13, exige decisão do dono (DEC-032)."

**Critério novo em E13:** "4. Dadas as metas derivadas, quando a medição final termina, então cada meta está marcada atingida ou não atingida em measurements.md, e cada não atingida tem decisão do dono. {verify: human; evidence: o dono confere as linhas de meta e ratifica as decisões}"

### Linha de decisão

| ID | Data | Entregável | Decisão | Alternativa descartada | Contradiz | Revisitar quando | Origem | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-032 | 2026-11-10 | E15 | Metas derivadas por construção, declaradas no spec de cada entregável e conferidas no ponto de medição. Meta perdida não bloqueia; em E13 exige decisão do dono. | Sem metas ("não pior" basta); percentuais fixados pelo dono; meta perdida bloqueia. | - | Duas metas perdidas num mesmo ponto. | user | vigente |

### Alternativas rejeitadas

- **Sem metas.** O pedido de "melhor" (DEC-005) fica sem prova, e os critérios de prosa passam com um byte.
- **Percentuais fixos (por exemplo, −30% de custo).** São números inventados, numa métrica em que 3 execuções não separam ganho de variação.

### Verificado

- Os três cálculos de ilustração, feitos sobre os rótulos e bytes medidos.
- Os critérios "menor que a medida" nas linhas 283, 312 e 714 da estratégia. O da linha 686 (E10) compara chamadas com agentes simulados e pode ficar.
- A tabela de medições tem 7 colunas e Tipo livre (`check-roadmap.mjs:560`).
- Não verificado: se o checker aceita um arquivo JSON dentro da pasta do roadmap. Por isso sugiro `docs/reports/`.

### Custo se errado e quem decide

- **Custo se errado:** uma previsão mal calculada vira "meta não atingida" sem causa real e custa uma decisão do dono; nada fica retido.
- **Quem decide:** o dono decide se há metas, o efeito de perdê-las e a mudança no não objetivo. O executor deriva os números e os registra como decisão pendente (DEC-007).

## Perguntas para o dono

**Questão 1**

- **O extrator vai para `tools/measure/` com G1 ampliado?** Opções: (a) sim, como acima; (b) fica no plugin, como o card supõe; (c) vai para o `marketplace-tools`.
- **Os três scripts atuais de `docs/reports/2026-11-10-session-metrics/` entram no commit?** Opções: (a) não entram; (b) entram depois de tirar o diretório pessoal e os prefixos de sessão; (c) entram como estão.

**Questão 2**

- **Qual desenho de medição?** Opções: (a) 5/3/3/3/1/1 com 40 tentativas por classe (≈ US$ 215 na linha de base); (b) o mais barato, 3/2/2/2/1/1 com 24 tentativas (≈ US$ 150), em que os contadores ruidosos não bloqueiam.
- **Texto acrescentado a um prompt por correção conta como piora?** Opções: (a) sim, bloqueia acima de 3%; (b) bloqueia só por chamadas, e bytes ficam registrados; (c) bloqueia, mas o dono pode liberar com decisão registrada.

**Questão 3**

- **Haverá metas?** Opções: (a) derivadas por construção, como acima; (b) nenhuma, "não pior" basta; (c) percentuais que você fixa depois de E15.
- **O que faz uma meta perdida?** Opções: (a) é registrada e só no fechamento exige sua decisão; (b) bloqueia a publicação do ponto; (c) é só registrada, sem efeito.


---

# Solução 3: pré-aprovação do Workflow e reversão de publicação

## Questões A e B do roadmap: pré-aprovação do Workflow e reversão de publicação

Nada foi alterado no repositório, em `~\.claude` nem no estado instalado. Tudo o que construí está em `<scratchpad da sessão>\q-publicacao\`. Como o scratchpad é da sessão, copie a pasta antes de encerrar se for usar as sondas.

Resumo das duas respostas:

- **A:** o roadmap não precisa de hook. O lançamento pelo nome mais uma regra de permissão informada pelo preflight basta, condicionado à sonda 3 de E14. O hook fica desenhado e testado como reserva, só por opção do usuário.
- **B:** voltar é publicar uma versão nova e maior com o conteúdo da tag anterior. `main` nunca anda para trás. A branch de volta é ensaiada antes de cada publicação.

---

## Questão A — Pré-aprovação do Workflow por hook (REQ-033)

### O que barra um lançamento, segundo a documentação

Fonte principal: https://code.claude.com/docs/en/workflows, seção "Approve the plan before it runs". CLI instalada: 2.1.322.

| Situação | O que acontece | Citação |
|---|---|---|
| Padrão e aceitar edições | Diálogo a cada execução, salvo "não perguntar de novo" | "Every run, unless you've selected **Yes, and don't ask again** for that workflow in this project" |
| Automático | Diálogo só no primeiro lançamento | "First launch only. Any **Yes** records consent in your user settings" |
| Sem permissões | Sem diálogo | "Claude Code doesn't prompt you. The run starts immediately" |
| `claude -p` e SDK | Sem diálogo; passa pela avaliação normal de permissão | "deny rules, ask rules, and `dontAsk` mode apply to the launch as they apply to every tool call" |

- **"Não perguntar de novo":** só é oferecido "when you run a bundled, saved, or plugin workflow by name, not for a script Claude wrote for the current task". O lançamento por `scriptPath` de um arquivo do plugin, que é o que o release faz hoje (`SKILL.md:29`), não está em nenhum dos dois casos.
- **Regra de permissão:** a única frase é "add `Workflow` to your allow rules to approve every workflow, or `Workflow(<name>)` to approve one saved workflow by name". Ela aparece só na lista de `claude -p`. A página de permissões não menciona a ferramenta.
- **Hook:** `Workflow` está entre as ferramentas que o `PreToolUse` casa (página de hooks). A precedência vale para hooks de plugin: "That precedence covers hooks in settings files and in a plugin's `hooks/hooks.json`". Um `allow` não passa por cima de regras: "a matching deny rule blocks the call, and a matching ask rule still prompts". Em modo de plano, "the workflow doesn't start on the hook's approval alone".
- **`tool_input`:** `{script?, name?, scriptPath?, args?, resumeFromRunId?, title?, description?}`, e "`scriptPath` … Takes precedence over `script` and `name`" (referência do SDK, entrada Workflow). A página de hooks não tem tabela para Workflow.

### Três correções ao esboço da Análise 3

1. **Há uma segunda barreira no `scriptPath`.** "Claude can start a workflow only from a script file the session is already allowed to read. To run a script kept outside your working directory, add its directory with `/add-dir` or a Read allow rule first." O cache do plugin fica fora do diretório de trabalho. Nenhuma fonte do roadmap cita isso; pode barrar quem roda no modo padrão.
2. **O workflow do release não é um workflow do plugin hoje.** Não existe `workflows/` na raiz do plugin nem o campo `workflows` no `plugin.json`. Além disso, `meta.name` é `'roadmap-release'` (`roadmap-release.js:2`), igual ao nome da skill; registrado assim, o comando `/productivity-tools:roadmap-release` colidiria com o da skill.
3. **O diálogo não trava a execução sem supervisão.** Ele aparece no lançamento, com a pessoa presente, e não no meio da execução. Só trava em `claude -p`, que é o caso do lançador em lote de E1, e ali uma regra ou `--allowedTools "Workflow"` resolve.

A suposição "invocar a skill vale como consentimento" não tem apoio em nenhuma página lida.

### Recomendação

**(1) Sem hook.** O plugin lança pelo nome e o preflight informa a regra. Três motivos:

- A plataforma já dá consentimento persistente por usuário e por projeto para workflow de plugin lançado pelo nome.
- Um hook que aprova sozinho tira de todos os usuários o único ponto de controle humano sobre um lançamento. O hook aprova o script, não os `args`: uma sessão com injeção de prompt poderia lançar o release com um `config` forjado, e as regras `Bash(node:*)` e `Bash(git:*)` que o preflight pede já estariam liberadas.
- Para o seu modo real o hook não muda nada. Suas configurações não têm bloco `permissions` e têm `skipDangerousModePermissionPrompt: true`.

**(2) Desenho do hook, caso você o queira mesmo assim.** Está pronto e testado (12 testes, 0 falhas) em `...\q-publicacao\hook-design\hooks\` (`hooks.json`, `approve-own-workflow.mjs`, `approve-own-workflow.test.mjs`).

- **Entrada no `hooks.json`:** `PreToolUse`, matcher `Workflow`, forma exec: `node` com `args: ["${CLAUDE_PLUGIN_ROOT}/hooks/approve-own-workflow.mjs", "${user_config.auto_approve_workflows}"]`, timeout 5.
- **Opção do usuário:** `auto_approve_workflows`, booleana, padrão `false`, em `userConfig`. Desligado, o hook não decide nada.
- **O que aprova:** só `scriptPath` absoluto cujo caminho real é igual ao caminho real de um arquivo de uma lista fechada, relativa à raiz do plugin.
- **Como identifica o plugin:** a raiz vem da localização do próprio arquivo do hook, não do ambiente nem da entrada. Um teste cobre a tentativa de mover a raiz por `CLAUDE_PLUGIN_ROOT`.
- **O que deixa passar sem decidir:** outra ferramenta ou evento, modo de plano, `script` embutido, `name` junto com `scriptPath`, caminho relativo, arquivo inexistente, caminho parecido fora da raiz, e qualquer erro. Nunca nega.
- **Lançamento pelo nome:** a lista de nomes fica vazia até a sonda mostrar o que vem em `tool_input.name`.
- **Revisão de segurança (T2, e T3 no portão final):**
  - os casos acima, mais junção, `..`, maiúsculas e nomes curtos no Windows;
  - o risco residual dos `args`;
  - a substituição de `${user_config.*}` para booleano (a documentação só fala em "plain string");
  - README e CLAUDE.md dizendo que o plugin embarca um hook;
  - conferir se o `lint-plugin` cobre `hooks/`.

**(3) Onde fica.**

- Peça nova em E18: lançamento pelo nome e aviso no preflight.
- Critério novo em E12.
- Nenhum card de hook. Se você escolher o hook, ele vira card próprio depois de E14, e não peça de E18: são arquivos novos em `hooks/` com revisão de raio alto.

### Texto para aplicar

**E14, peça 3 (substitui):**

> - Peça 3: consentimento do Workflow: o que barra o lançamento por caminho e pelo nome em cada modo de permissão (padrão, aceitar edições, automático, sem permissões) e em `claude -p`; o que a regra `Workflow(<nome>)` cobre; se a aprovação por hook dispensa o diálogo interativo; se um script fora do diretório de trabalho exige permissão de leitura.

**E18, atributo `reqs`:** acrescentar `REQ-033`.

**E18, peça nova:**

> - Peça 4 (segue a decisão da sonda 3 de E14): o workflow do release é registrado como workflow do plugin pelo campo `workflows` do manifesto, sem mover o arquivo, com um `meta.name` diferente do nome de toda skill, e a skill o lança pelo nome. Lançado sem `config` ou sem `runToken`, ele para antes de qualquer agente. O preflight informa, como aviso que não bloqueia, a regra `Workflow(<nome>)`.

**E18, critérios novos:**

> 4. Dadas configurações sem regra que cubra o workflow do release, quando o preflight roda, então a regra `Workflow(<nome>)` aparece em `warnings` com o texto exato a acrescentar e não em `missingRules`; com `Workflow` ou `Workflow(<nome>)` presente, o aviso não aparece. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
> 5. Dado o workflow do release lançado sem `config` ou sem `runToken`, quando ele inicia, então devolve erro antes de qualquer chamada de agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
> 6. Dado o manifesto do plugin, quando o teste o lê, então o campo `workflows` aponta para o arquivo do workflow do release, o `meta.name` dele não é nome de nenhuma skill do plugin, e a skill manda lançar por esse nome. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
> 7. Dada uma sessão no modo padrão, sem regra e sem hook, quando o dono lança o release pela skill e escolhe não perguntar de novo, então o lançamento seguinte no mesmo projeto começa sem diálogo. {verify: human; evidence: o dono confere em duas sessões seguidas e registra o modo de permissão}

**E18, risco novo:**

> - O lançamento pelo nome ou a regra `Workflow(<nome>)` não se comportam como a documentação indica -> seguir a decisão da sonda 3 de E14; se o lançamento pelo nome falhar, a peça 4 se reduz ao aviso do preflight com a regra `Workflow`, e a skill continua lançando por caminho.

**E12, atributo `reqs`:** acrescentar `REQ-033`.

**E12, critério novo:**

> 5. Dado o workflow do coordinator, quando o plugin é carregado, então ele está registrado no manifesto com nome próprio e a skill o lança pelo nome; lançado sem o plano ou sem o estado, para antes de qualquer agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}

**E12, segundo risco (substitui):**

> - O lançamento do workflow pede consentimento -> ele acontece com a pessoa presente; o lançamento pelo nome permite não perguntar de novo, e a regra informada pela skill libera `claude -p`. A sonda de E14 confirma; se nenhuma rota funcionar, DEC-006 é revisitada.

**"Questões em aberto", linha de E14:** remover, citando DEC-030.

**`requirements.md`, REQ-033 (substitui):**

> | REQ-033 | O lançamento de um workflow do plugin não exige consentimento repetido de quem já o deu nem trava uma execução sem interface: o workflow é lançado pelo nome e o preflight informa a regra de permissão que o libera. Nenhum hook do plugin aprova o lançamento sem opção explícita do usuário. | functional | SRC-02, SRC-06, SRC-10, SRC-11 | E12, E14, E18 | a-esclarecer |

Passa a `coberto` quando E14 fechar com a sonda positiva. O resumo de cobertura vira então 38 cobertos e 2 a esclarecer.

**`decisions.md`:**

> | DEC-030 | 2026-11-10 | E18 | O plugin não embarca hook que aprove o lançamento do Workflow. O release e o coordinator são lançados pelo nome, como workflows do plugin, e o preflight informa a regra `Workflow(<nome>)` como aviso. REQ-033 é reescrito nesses termos. | Hook `PreToolUse` ligado por padrão, restrito aos workflows do plugin (peça em E18, como SRC-11 sugeria); hook desligado por padrão, ligado por opção do usuário, em card próprio. | - | A sonda 3 de E14 mostrar que o lançamento pelo nome não funciona a partir de uma skill ou que o consentimento não persiste no modo padrão; ou um usuário pedir lançamento sem diálogo por caminho. | executor | pendente |

### Sonda para o dono

O plugin descartável está em `...\q-publicacao\probe\wfprobe\` e passa em `claude plugin validate` (só o aviso de ícone). Ele tem:

- um workflow de um agente haiku, registrado pelo campo `workflows`;
- a skill `/wfprobe:launch path|name`;
- um hook que grava o `tool_input` em `%TEMP%\wfprobe-hook.log` e só aprova com `WFPROBE_ALLOW=1`.

Rode cada linha em sessão nova, numa pasta git vazia fora do repositório, com `claude --plugin-dir <caminho do wfprobe>`. O custo é de centavos por execução.

| # | Como lançar | Observar | Conclusão |
|---|---|---|---|
| 1 | `--permission-mode default`, `/wfprobe:launch path` | Há erro ou pedido de leitura do script? Há diálogo? Há a opção "não perguntar de novo"? | Diálogo presente: a skill não vale como consentimento. Erro de leitura: o preflight precisa listar a regra `Read` do cache, ou o lançamento pelo nome é obrigatório. |
| 2 | Idem, `/wfprobe:launch name`; escolher "não perguntar de novo"; repetir em sessão nova | Qual nome resolveu (`wfprobe:probe-run` ou `probe-run`)? A opção existe? O segundo lançamento sai sem diálogo? Onde ficou gravado (`git status` da pasta, `.claude\settings.local.json`)? | Tudo positivo: adotar DEC-030 como está. Nome não resolve: a peça 4 se reduz ao aviso. |
| 3 | Pasta nova, `$env:WFPROBE_ALLOW='1'`, variante `path` | O diálogo some? Conferir o log | Some: o hook de reserva funciona no modo interativo. Não some: o hook só serve em `claude -p`, onde a regra basta, e o hook sai de cogitação. |
| 4 | Pasta nova, `--allowedTools "Workflow"`; depois `"Workflow(wfprobe:probe-run)"` e `"Workflow(probe-run)"`, nas duas variantes | Qual grafia dispensa o diálogo, e ela cobre o lançamento por caminho? | Define o texto exato da regra no preflight. |
| 5 | `--permission-mode acceptEdits`, variante `path` | Igual à linha 1? | Confirma a tabela da documentação. |
| 6 | Seu modo real | Sem diálogo | Registrar o modo na decisão. |
| 7 | `claude -p "/wfprobe:launch name" --output-format json`: sem regra; com `--allowedTools`; com `WFPROBE_ALLOW=1`; com `--permission-mode dontAsk` | Negado sem regra? Liberado pela regra e pelo hook? | Define o que o lançador em lote de E1 passa na linha de comando. |
| 8 (opcional) | `--permission-mode auto` | Diálogo só na primeira vez | Atenção: um "sim" grava consentimento nas suas configurações de usuário. |

### Alternativas rejeitadas

- **Hook ligado por padrão em E18 (o esboço):** amplia permissão de todos os usuários para resolver um diálogo que a plataforma já deixa cada um dispensar. Também não se sabe se ele vale no modo interativo.
- **Não mudar nada, só documentar:** deixa a barreira de leitura do `scriptPath` sem tratamento, não dá rota para `claude -p`, e E12 nasceria com o mesmo problema.

### O que não consegui estabelecer

Tudo abaixo depende da sonda:

- se a ferramenta aceita `name` de workflow de plugin, e com qual grafia;
- se "não perguntar de novo" aparece quando o modelo lança pelo nome, e onde fica gravado;
- se regra ou hook dispensam o diálogo interativo;
- se `Workflow(<nome>)` cobre lançamento por caminho;
- se o diretório da skill conta como legível;
- como a colisão de nome entre skill e workflow é resolvida.

### Custo se errado e quem decide

- **Custo:** baixo. No pior caso, usuários do modo padrão clicam uma vez por lançamento e o lançador em lote precisa de uma flag; a sonda roda antes do spec de E18. Se o hook se mostrar necessário depois, é um card pequeno e uma versão de correção.
- **Quem decide:** o executor pode registrar DEC-030 como pendente e rodar a sonda (DEC-007, DEC-029). Reescrever REQ-033, mexer em E14, E18 e E12 e decidir sobre comportamento de permissão publicado é revisão da estratégia, do dono.

---

## Questão B — Reversão de uma publicação intermediária

### O que foi estabelecido

- **Fonte da loja:** `known_marketplaces.json` aponta `claude-play` para `github: odeciojunior/claude-play`, sem `ref`, com `autoUpdate: true` (também em `extraKnownMarketplaces` das suas configurações). A entrada do plugin é caminho relativo.
- **Versão:** vem do `plugin.json` primeiro. Só há cópia nova quando ela muda: "don't replace the cached copy when it matches what `installed_plugins.json` records" (https://code.claude.com/docs/en/plugins/loading). A documentação diz "differs", não "maior"; se uma versão menor é instalada não está escrito. A versão é também o nome da pasta do cache, então reaproveitar um número colide com pasta existente.
- **Cache:** "writes an `.orphaned_at` marker into the previous version directory. It removes that directory … 14 days later". Observado: 1.4.0, 1.4.1 e 1.4.2 com `.orphaned_at`, e 1.6.0 sem. As pastas órfãs têm `.in_use` mais recente que o `.orphaned_at`, o que não está documentado.
- **Atualização automática:** "after you send your first message, Claude Code waits a random delay of up to ten minutes"; a sessão em curso mantém a versão carregada. É desligada por padrão para lojas de terceiros: outros usuários só recebem quando atualizam à mão.
- **Fixar versão:** `claude plugin install` e `update` não têm opção de versão (ajuda da CLI). O único meio é o ref da loja: "append `#<ref>`, as in `your-org/your-marketplace#stable`", e "One marketplace serves one version of each plugin at a time" (https://code.claude.com/docs/en/plugins/host-marketplace). Remover a loja para trocar o ref "uninstalls every plugin you installed from it".
- **Tags:** o repositório não tem nenhuma (`git tag -l` vazio). `claude plugin tag plugins/productivity-tools --dry-run` responde "would create tag productivity-tools--v1.6.0 at HEAD".
- **"1.6.0" não identifica um conteúdo:** o bump foi em `2169d24`, e 101 commits tocaram o plugin depois dele até `3fbb59b`, que é o `gitCommitSha` instalado e o `origin/main`. Só uma tag identifica o conteúdo de volta.
- **Checker:**
  - o tracker só troca a cópia da pasta quando a do plugin é mais nova pela linha 1: "Vendored version equal to or newer than the plugin's → Nothing to do" (`roadmap-tracker/SKILL.md:89`);
  - o checker procura cópia mais nova em todas as pastas do cache, inclusive as órfãs (`check-roadmap.mjs`, `findNewerPluginCopy`);
  - os testes fixam a linha 1 em quatro lugares (`check-roadmap.test.mjs:150`, `:152`, `:418`, `:528`).

### Recomendação

Voltar é publicar: uma versão nova e maior, com o conteúdo de `plugins/productivity-tools` igual ao da tag anterior. Ensaiei a sequência de git num repositório descartável (`...\q-publicacao\git-rehearsal\`):

- a restauração remove os arquivos novos;
- o merge `-s ours` mantém o conteúdo da branch de release;
- o fast-forward seguinte funciona.

**Pré-condições de cada publicação:**

1. Antes do avanço de `main`, a tag `productivity-tools--v<versão em main>` é criada e enviada no commit instalado. Para a primeira: `claude plugin tag plugins/productivity-tools --push` em `main`, hoje em `3fbb59b`. É ato do dono.
2. O executor monta a branch de volta, local, a partir da ponta da branch de release:
   - `git switch -c rollback/productivity-tools-<v> <ponta>`;
   - `git restore --source=productivity-tools--v<anterior> --staged --worktree -- plugins/productivity-tools`;
   - versão de correção seguinte no `plugin.json` e no README;
   - linha 1 do checker nessa versão, com as quatro constantes do teste;
   - G1 a G5 verdes.
3. O `gitCommitSha` instalado fica registrado no log.

**Por que a linha 1 do checker muda na volta.** Com a linha 1 antiga (1.5.0), as pastas já atualizadas para 1.7.0 ficariam com o checker de E2 para sempre, mesmo que o defeito seja dele. Com a linha 1 na versão da volta, o tracker troca a cópia no próximo evento. Se o checker antigo acusar erro na pasta, a regra atual mantém a cópia e abre um item pendente. O formato da pasta continua 1 (DEC-028), então não há erro de formato.

**Caso E17 (compatível). Atos do dono:**

1. Conferir que nenhum entregável está em execução; pedir ao tracker um bloqueio no entregável responsável.
2. Escolher correção ou volta. Causa conhecida e correção pequena: versão de correção pelo fluxo normal. Caso contrário, volta.
3. Conferir a branch de volta: `git merge-base --is-ancestor main rollback/productivity-tools-1.7.1`, e `git diff productivity-tools--v1.6.0 rollback/productivity-tools-1.7.1 -- plugins/productivity-tools` mostra só a versão, a linha 1 e as constantes do teste.
4. Conferir G1 a G5 nela.
5. `git switch main` e `git merge --ff-only rollback/productivity-tools-1.7.1`.
6. `git push origin main`.
7. `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, reiniciar.
8. Conferir `cache\claude-play\productivity-tools\1.7.1\` e o `gitCommitSha`; criar e enviar a tag da 1.7.1.
9. Pedir ao tracker o evento de publicação (ele troca a cópia do checker).
10. Na branch de release: conferir que `git log release/roadmap-skills-v2..main` lista só o commit da volta; depois `git merge -s ours main`. Sem isso o próximo fast-forward falha; com merge comum, a volta desfaria o trabalho da branch.
11. A republicação corrigida sai como 1.7.2, por novo ponto de medição.

**Caso E11 (quebra). Atos do dono:**

1. Igual ao ato 1 de E17, e listar o trabalho em andamento iniciado na 2.0.0 nos seus projetos: planos com bloco de dados e estados do coordinator em JSON.
2. Preferir a correção adiante (2.0.1). A volta aqui é outra quebra, no sentido contrário.
3. Se for volta: cada trabalho iniciado na 2.0.0 termina nela antes de atualizar (a sessão aberta mantém a versão carregada) ou é marcado para recomeçar do plano. Registrar no log.
4. Atos 3 a 9 de E17, com a tag da última 1.7.x e a versão 2.0.1. A linha do README diz que a 2.0.1 tem o conteúdo da 1.7.x.
5. Artefatos no formato novo: não apagar. A versão anterior não lê o estado em JSON; apontá-la para um plano já em execução pode repetir passos concluídos, inclusive efeitos externos. Um plano adotado volta ao texto anterior pelo git (`git log -- <plano>`). A pasta de roadmap não é afetada.
6. `git merge -s ours main` na branch de release; bloqueio nos entregáveis que dependem da 2.0.0 (E9, E21, E24, E16, E10, E12) até a republicação como 2.0.2.

**O que o executor pode preparar:**

- a branch de volta e os gates;
- o `--dry-run` da tag;
- o texto da nota;
- as linhas do tracker como pendentes;
- o merge `-s ours` local.

Tags enviadas, avanço de `main`, push e atualização são do dono.

### Texto para aplicar

**"Execução deste roadmap", itens novos:**

> - Antes de cada avanço de `main`, o dono cria e envia a tag `productivity-tools--v<versão que está em main>` no commit instalado, e esse commit fica registrado no log. O número da versão não identifica o conteúdo (a 1.6.0 cobre 101 commits); a tag identifica.
> - Cada preparação de publicação inclui a branch de volta, montada pelo executor a partir da ponta da branch de release: o conteúdo do plugin igual ao da tag anterior, a versão de correção seguinte nos dois lugares, a linha 1 do checker nessa versão, e G1 a G5 verdes. Ela não é enviada ao remoto.
> - Voltar é publicar: se uma versão publicada quebrar um projeto em uso, o dono avança `main` até a branch de volta, dá push e atualiza o plugin. `main` nunca anda para trás e nenhum número de versão é reaproveitado. Correção pequena e de causa conhecida sai como versão de correção normal.
> - Depois de uma volta, a branch de release recebe `main` por um merge que mantém o conteúdo dela, e a publicação seguinte usa o número acima do da volta.
> - A volta da versão de quebra também quebra: a versão anterior não lê plano com bloco de dados nem estado do coordinator em JSON. Trabalho iniciado na versão de quebra termina nela ou recomeça do plano; a pasta de roadmap continua no formato 1.

**"Questões em aberto":** remover a linha da reversão, citando DEC-031.

**Nota de atualização (E11, peça 5), parágrafo a acrescentar:**

> Se esta versão quebrar seu projeto: atualize de novo quando a versão de correção sair (`claude plugin marketplace update claude-play` e `claude plugin update productivity-tools@claude-play`). Se ela for uma volta ao conteúdo anterior, o plano ou entregável que você começou nesta versão não continua na anterior: termine-o antes de atualizar, sem fechar a sessão, ou recomece do plano. Não apague os arquivos; um plano adotado volta ao texto anterior pelo histórico do git. Cada versão publicada tem a tag `productivity-tools--v<versão>` no repositório.

**Critérios novos, em E17 (3 e 4), E11 (5 e 6), E16 (5 e 6) e E13 (4 e 5):**

> Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
>
> Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}

**E11, critério a mais (7):**

> Dados um plano com bloco de dados e um estado do coordinator em JSON, quando a versão anterior os recebe num sandbox, então o comportamento (recusa, ignora ou lê errado) está registrado e a nota de atualização o descreve. {verify: human; evidence: o dono confere o resultado registrado em docs/reports}

**Requisitos:** em REQ-034, acrescentar ao fim "…; cada publicação tem tag e branch de volta ensaiada, e a volta é uma versão nova".

**`decisions.md`:**

> | DEC-031 | 2026-11-10 | E17 | A volta de uma publicação é uma versão nova e maior, com o conteúdo do plugin igual ao da tag anterior, publicada por avanço de `main` até uma branch de volta ensaiada antes de cada publicação. Cada versão publicada ganha a tag `productivity-tools--v<versão>`. A linha 1 do checker acompanha a volta. Na versão de quebra, a correção adiante é a primeira escolha, e trabalho iniciado nela não continua na anterior. | Mover `main` para trás com push forçado; `git revert` dos merges; orientar os usuários a fixar a loja numa tag em vez de republicar. | - | A sonda de versão mostrar que uma versão menor é instalada normalmente; ou a branch de volta falhar nos gates por causa dos formatos novos. | executor | pendente |

### Alternativas rejeitadas

- **Mover `main` para trás:** quebra o clone da loja de quem já atualizou; a versão voltaria a um número cuja pasta já existe no cache; contraria a regra do repositório de que mudança sem bump não chega aos usuários.
- **Só fixar a loja numa tag, sem republicar:** depende de cada usuário agir. Trocar o ref de uma loja já registrada não está documentado, e remover a loja desinstala os três plugins dela. Serve como alívio individual, não como caminho de volta.

### O que não consegui estabelecer

- se uma versão calculada menor substitui a instalada;
- se dá para trocar o ref de uma loja já registrada sem removê-la;
- se `--plugin-dir` sobre uma tag convive com o plugin instalado de mesmo nome;
- como a versão anterior se comporta diante dos formatos novos (eles ainda não existem);
- o significado do `.in_use`.

**Sonda para o dono (altera estado, por isso não rodei):**

1. Enviar a tag `productivity-tools--v1.6.0`.
2. Usar um diretório de configuração isolado: `$env:CLAUDE_CONFIG_DIR` e `$env:CLAUDE_CODE_PLUGIN_CACHE_DIR` apontando para pastas vazias.
3. Rodar `claude plugin marketplace add odeciojunior/claude-play#productivity-tools--v1.6.0`, `claude plugin install productivity-tools@claude-play` e `claude plugin list`.
4. Depois da publicação da 1.7.0, repetir no mesmo diretório com a loja em `main`; trocar para a tag e rodar `claude plugin update`.

Leitura do resultado:

- "already at the latest version": versão menor não desce, e a volta por versão maior é obrigatória.
- Instala a 1.6.0: fixar por tag passa a ser um alívio válido para usuários.

### Custo se errado e quem decide

- **Custo:** uma volta defeituosa custa mais uma versão de correção. O ensaio antes de cada publicação existe para isso e custa um commit e uma rodada de gates. O risco que o ensaio não cobre é o comportamento da versão anterior com artefatos novos, que o critério 7 de E11 mede.
- **Quem decide:** o dono. A recomendação cria atos dele (tags, push), acrescenta critérios a quatro cards e muda o texto da estratégia. O executor registra DEC-031 como pendente e pode ensaiar a branch de volta desde já.

---

## Perguntas ao dono

**A1.** O plugin deve aprovar sozinho o lançamento dos próprios workflows?

- (a) Não: lançamento pelo nome e regra informada pelo preflight. Recomendado.
- (b) Sim, mas só por opção do usuário, desligado por padrão, em card próprio depois de E14.
- (c) Sim, ligado por padrão.

**A2.** Você aceita que o workflow do release vire um comando visível (`/productivity-tools:<nome novo>`), com trava para lançamento sem preflight?

- (a) Sim. Recomendado; depende da sonda.
- (b) Não: continua por caminho, e usuários do modo padrão confirmam a cada lançamento.

**B1.** Se a versão de quebra (E11) falhar num projeto em uso, qual é a regra?

- (a) Corrigir adiante sempre que possível; volta como 2.0.1 com o conteúdo da 1.7.x só em último caso. Recomendado.
- (b) Nunca voltar a quebra, só corrigir adiante.
- (c) Voltar sempre primeiro e corrigir depois.

**B2.** A branch de volta é montada e testada em toda publicação, ou só quando for preciso?

- (a) Em toda publicação, como critério dos quatro cards de medição. Recomendado.
- (b) Só em E11, a única de quebra.
- (c) Só sob demanda.
