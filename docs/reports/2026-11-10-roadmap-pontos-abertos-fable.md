<!-- Três propostas feitas por subagents Fable 5.2 (effort medium) em 2026-11-10 para os pontos de decisão em aberto do roadmap docs/plans/roadmap-evolucao-skills/. Gravadas sem edição pela sessão principal. Fonte SRC-13 do roadmap. Os números de DEC e de entregável que cada proposta sugere valem só se constarem em decisions.md e na estratégia. -->


---

# Proposta 1: ratificação das cinco decisões do executor

## Ratificação de DEC-013 e DEC-026 a DEC-029: preparação

Nada foi editado. As cinco decisões devem ser **ratificadas com emenda**; nenhuma deve ser rejeitada. Todas ficaram incompletas ou defasadas diante de DEC-030 a DEC-036, e quatro delas juntam escolhas de alcance diferente numa linha só.

Abreviações de arquivo (caminhos absolutos):

- EST = `D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`
- DECS, STATE, CP = `decisions.md`, `state.md`, `critical-path.md` em `D:\projects\claude-play\docs\plans\roadmap-evolucao-skills\`
- WF = `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`
- CHK = `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-tracker\scripts\check-roadmap.mjs`
- SRC-11, SRC-12 = `D:\projects\claude-play\docs\reports\2026-11-10-roadmap-decisoes-analise-fable.md` e `...-roadmap-questoes-solucoes-fable.md`

## Quatro achados que atravessam as cinco

1. **A ordem em STATE fecha a janela de correção no lugar.** STATE:10-12 manda commitar a pasta (item 1) antes de ratificar (item 3). Depois do commit, `decisions.md` é só de acréscimo (`formats.md:308`): cada emenda abaixo viraria linha nova do dono, com "Contradiz" preenchido e o aviso `contradiction-unabsorbed` (CHK:705-708). Ratificar tem de vir antes do primeiro commit.
2. **Nenhuma das cinco linhas traz o alcance que DEC-030 exige**, e nenhuma decisão diz onde ele é gravado. E2, E3 e E18 leem esse dado. Proponho a linha DEC-045 abaixo.
3. **Nada impede E7, E19 e E20 de entrarem na 1.7.0.** E17 depende só de E15 e E18; E19 só de E5 e E14; E7 de E3 e E6 (EST:360, 417, 501). A publicação leva a branch de release inteira (EST:54). Se E7 integrar antes de E17, a versão "compatível" leva o estado novo do coordinator, contra DEC-015 e o risco de E7 (EST:529). Isso é leitura do grafo, não teste; o custo de DEC-027 e DEC-028 depende da resposta (pergunta 5).
4. **A lista de SRC-12:59-69 tem quatro erros**, corrigidos na lista final:
   - DEC-029 não é "contrato": pela definição de DEC-030, a operação das sondas é local.
   - DEC-028 não é "local, pode adiar": a regra da linha 1 e o formato são lidos pelo spec de E2.
   - Os nomes de DEC-027 são necessários antes dos specs de E18 e E7, não de E19 e E20.
   - "Alonga a cadeia" não vale mais para DEC-013: E24 é Should e saiu do caminho crítico (CP:56).

## DEC-013 — cortes dos quatro cards

**Verificado**
- As prioridades dos cards batem com DEC-022: 19 Must; Should em E4, E10, E22 e E24.
- O checker roda com 0 erros na pasta, então todo requisito tem dono e nenhuma fatia ficou sem requisito.
- Cada fatia tem peças e critérios próprios. E19 não tem teste novo, só critérios humanos (EST:427).
- Uma dependência descartada conta como satisfeita (WF:110), então cortar E24 não prende E10.
- Não existe E23 em nenhum arquivo, e nada registra por quê (SRC-11:91).
- E18 cresceu depois do corte: peças 4 e 5 vieram de DEC-031 e DEC-035, e o card tem 8 critérios (EST:281-294).
- E4 depende de E22 só pelo arquivo `prose-budget.test.mjs` (EST:317, 344); E12 usa um arquivo próprio para o mesmo tipo de teste (EST:764).
- As peças de E20 estão fora de ordem: 1, 2, 4, 3 (EST:478-481).
- E20 peça 3 edita as skills do planner e do tracker; o risco transversal (EST:851) só nomeia E22 e E7.

**Inferido**
- E23 foi perdido na divisão.
- A aresta E4→E22 não é funcional.
- As colisões de E20 com E22 e E4 só são inofensivas enquanto a trava de paralelismo valer (WF:810).

**Alcance e prazo.** Contrato. Cada corte antes do spec da primeira fatia (E3, E5, E6, E9); na prática, antes do primeiro commit.

**Custo**
- Ratificar e errar: revisão da estratégia e novo spec das fatias afetadas. Os ids não voltam, então a fatia abandonada vira `descartado`.
- Rejeitar agora: replanejar 23 cards, `requirements.md`, o painel e o caminho crítico. Nada de código se perde.

**Veredito: ratificar com emenda, dividida em quatro linhas.**

```
| DEC-013 | 2026-11-10 | E3 | A pedido do dono, o card E3 foi dividido em três, com o corte proposto por subagents: E3 (CLI do tracker), E18 (registro do release pela CLI e preflight) e E22 (skill do tracker enxuta e rubricas). As prioridades das fatias estão em DEC-022. Alcance: contrato. | Dois cortes, como SRC-10 sugeria: CLI com o registro do release, e skill enxuta. | - | E18 passar de oito critérios no spec (já recebeu peças de DEC-031 e DEC-035), ou o dono preferir outro corte. | executor | pendente |
| DEC-037 | 2026-11-10 | E5 | O card E5 foi dividido em dois: E5 (formato e ferramenta de spec, só código) e E19 (autor de spec e skill interativa de spec). E6 lê de E5 só o esquema e o leitor. As prioridades das fatias estão em DEC-022. Alcance: contrato. | Formato, ferramenta e autor num card só. | - | O esquema do spec mudar em E19 depois de E6 já o ler. | executor | pendente |
| DEC-038 | 2026-11-10 | E6 | O card E6 foi dividido em dois: E6 (formato e ferramenta de plano, com roteamento, mapa e briefs, só código) e E20 (autor de plano, skill interativa, adoção, suíte de gatilho e ponteiros). E7 parte de E6 sem esperar o autor. As prioridades das fatias estão em DEC-022. Alcance: contrato. | Formato, ferramenta e autor num card só. | - | O autor de E20 não conseguir preencher o esquema fixado em E6. | executor | pendente |
| DEC-039 | 2026-11-10 | E9 | O card E9 foi dividido em três, em série por editarem o mesmo arquivo de workflow: E9 (implementador e corretor), E21 (revisor por tarefa com achados identificados) e E24 (verificação adversarial na revisão final). Não existe E23, e o número não é usado. Prioridades em DEC-022. Alcance: contrato. | Dois cortes, como SRC-10 sugeria: implementador com revisor único, e verificação adversarial. | - | A cadeia E9, E21 atrasar E16 ou E12 a ponto de o dono preferir fundir E21 em E9. | executor | pendente |
```

**Se rejeitada** (exemplo para o corte de E9):

```
| DEC-NNN | <data> | E9 | O dono rejeita o corte de DEC-039: E21 volta para dentro de E9, e E24 continua separado e Should. | Três fatias em série (DEC-039). | Cards E9 e E21 e as dependências de E12, E16 e E13 na estratégia v1.0 | - | user | vigente |
```

A linha antiga passa a `substituída por DEC-NNN`.

**Linhas que mudam junto**
- EST:851: `(a CLI do tracker em E3, E18 e E22; a skill do tracker em E22, E7 e E20; a skill do planner em E4 e E20; o workflow do release em E9, E21 e E24) -> um comando ou função nova entra pela fatia que criou o arquivo, por revisão do card; E22, E7 e E20 não rodam ao mesmo tempo, nem E4 e E20, o que a trava de DEC-044 garante enquanto a configuração do release for gerada.`
- EST:478-481: renumerar para que os ponteiros sejam a peça 3 e a suíte de gatilho a peça 4.
- A aresta E4→E22 fica na pergunta 6.

## DEC-026 — local dos artefatos

**Verificado**
- O release grava hoje em `docs/superpowers/specs|plans|reviews|reports`, com data no nome (WF:1464, 1502, 1219, 2051), e localiza por glob na retomada (WF:1230, 1259-1261). Não existe `run.json`.
- O coordinator procura `docs/plans/<topic>/steps-*.md` e `*-plan.md` (`plan-coordinator\SKILL.md:39`). Um `plan.md` não casa com esse padrão.
- O `CLAUDE.md` do repositório documenta nomes datados soltos em `docs/plans/`.
- O checker só lê os arquivos da configuração; não varre a pasta do roadmap, então tolera arquivos extras.
- O revisor do release bloqueia edição da pasta do roadmap (WF:509, 1544).
- Já existe `docs/plans/roadmap-planner-v2/`, uma pasta de progresso do coordinator sem `roadmap.config.json`.
- E7, E19 e E20 gravam ou leem esses caminhos antes de E8 ou em paralelo com ele (EST:417, 471, 501).
- O E8 roda na 1.7.0, que ainda grava nos caminhos antigos (EST:540).

**Onde a linha falha**
- Não dá os nomes dos arquivos.
- "Id do entregável como chave" é ambíguo, e o id sozinho se repete entre roadmaps: o próprio SRC-11:265 usa esse argumento.
- "E8 é dono de todos os caminhos" não se sustenta: três entregáveis usam os caminhos antes dele.
- Não diz onde fica um plano adotado (DEC-018). SRC-12:771 supõe reescrita no lugar; a proposta de desenho (linha 358) supõe a pasta nova.
- A nota de atualização de E11 (EST:583) não tem lugar definido.
- Consequência não escrita: os artefatos de E1 a E8 deste roadmap vão para `docs/superpowers/`, que não existe no repositório.

**Inferido**
- O `run.json` na branch muda a árvore que ele próprio registra; o spec de E8 precisa excluí-lo da chave de retomada (EST:567).
- Depois da 2.0.0, mudar um caminho é outra quebra.

**Alcance e prazo.** Contrato. Antes dos specs de E19 e E7; E20 e E8 em seguida.

**Custo**
- Ratificar e errar antes de E11: trocar constantes e testes em E8, a prosa de duas skills e a busca de E7.
- Ratificar e errar depois de E11: projetos de usuários já têm artefatos nesses caminhos.
- Rejeitar agora: nenhum código; a retomada continua por glob.

**Veredito: ratificar com emenda** (uma linha; a chave e a adoção dependem das perguntas 2 e 3).

```
| DEC-026 | 2026-11-10 | E8 | O que o release e as skills criam para um entregável fica em `docs/plans/<slug do roadmap>-<E>/` (fora de roadmap, `docs/plans/<tópico>/`), com nomes fixos: `spec.md`, `plan.md`, `run.json`, `reviews.md`. Plano adotado fica onde está. Relatório da execução em `docs/reports/`. Alcance: contrato. | Nomes datados soltos em `docs/plans/`; só o id do entregável como pasta, que se repete entre roadmaps; relatório dentro da pasta do roadmap. | - | Antes da publicação de E11, o dono preferir a data no nome para ordenar; depois dela, mudar um caminho exige nova adoção. | executor | pendente |
```

**Se rejeitada:**

```
| DEC-NNN | <data> | E8 | O dono rejeita DEC-026: spec, plano e log de revisões continuam com data no nome, em `docs/plans/`, e a retomada os localiza pelo id do entregável. | Pasta por entregável com nomes fixos (DEC-026). | Peça 1 de E8 e peça 2 de E19 na estratégia v1.0 | - | user | vigente |
```

**Linhas que mudam junto**
- EST:540, trecho do meio: `Este card aplica no release a regra de caminhos de DEC-026 (spec, plano, registro da execução, log de revisões e relatório), que deixam a pasta do superpowers.`
- EST:425: `- Peça 2: skill interativa de spec, `spec-writer` (DEC-041), para uso fora de um roadmap, que usa o mesmo autor; faz uma rodada de até cinco perguntas, outra só a pedido, e pede uma aprovação (DEC-027); grava em `docs/plans/<tópico>/spec.md` (DEC-026).`
- E7, peça 2, acrescentar: `O estado e os briefs ficam na pasta do plano (DEC-026); o plano é `plan.md` nessa pasta ou o caminho dado pela pessoa.`
- Riscos transversais, linha nova: `- Até a versão de quebra o release instalado grava spec, plano, log e relatório em `docs/superpowers/` -> os artefatos de E1 a E8 deste roadmap ficam lá e não são migrados (DEC-018, DEC-026).`
- Nenhuma linha de `requirements.md` muda.

## DEC-027 — skills interativas e nome

**Verificado**
- A linha nomeia só a skill de plano; `spec-writer` aparece apenas na proposta de desenho (linha 71).
- O workflow do release tem `meta.name: 'roadmap-release'`, igual ao da skill (WF:2). E18 critério 7 exige um nome diferente do de toda skill (EST:293), e nenhuma decisão escolhe esse nome.
- O nome do workflow do release é publicado em E17, antes de as skills novas existirem.
- E7 critério 7 cita a skill de plano na mensagem de recusa (EST:522), e E7 não depende de E20.
- O planner faz até 5 perguntas por rodada, com mais rodadas só com consentimento (`roadmap-planner\SKILL.md:38`); a regra do spec é coerente com isso.
- As descrições que disputam o gatilho são três: `roadmap-planner` (manda planos de tarefa para `superpowers:writing-plans`), `plan-coordinator` ("offer to write one", SKILL.md:39) e `report-analyzer`.
- O superpowers está habilitado nas configurações do dono (`~\.claude\settings.json`, `enabledPlugins`).

**Inferido**
- Com o superpowers ligado, `brainstorming` e `writing-plans` vencem as skills novas, e a suíte de gatilho de E20 mede outra coisa.
- Renomear um workflow publicado invalida o consentimento gravado e a regra `Workflow(<nome>)` do usuário (pela documentação citada em SRC-12:578-584). Por isso o nome do workflow custa mais caro de errar que o da skill.
- Um agente `plan-author` ao lado da skill `plan-writer` pode ser despachado direto; a descrição dele deve dizer que não é entrada.

**Alcance e prazo**
- Perguntas e aprovações: local; specs de E19 e E20.
- Nomes: contrato; antes dos specs de E18 e E7.

**Custo**
- Protocolo de perguntas: prosa da skill, barato a qualquer momento.
- Nome de skill: barato até a primeira publicação que a contenha (E11, se a pergunta 5 for respondida com a opção a).
- Nome do workflow: fica público na 1.7.0.
- Rejeitar agora: zero.

**Veredito: ratificar com emenda, dividida em três linhas.**

```
| DEC-027 | 2026-11-10 | E19 | A skill interativa de spec faz uma rodada de até cinco perguntas, outra só a pedido da pessoa, e pede uma aprovação. Alcance: local. | Rodada única, sem a extra; mais de uma aprovação. | - | A execução comportamental de E19 mostrar specs gravados com suposição errada. | executor | pendente |
| DEC-040 | 2026-11-10 | E20 | A skill interativa de plano não pede aprovação: relata o plano gravado e oferece a execução. Só a adoção de um plano já escrito pede uma aprovação, depois de mostrar o que mudou (DEC-018). Alcance: local. | Aprovação também no plano. | - | Planos gravados sem aprovação precisarem de correção manual com frequência. | executor | pendente |
| DEC-041 | 2026-11-10 | E18 | Nomes: as skills interativas são `spec-writer` e `plan-writer`; os workflows do plugin são `release-workflow` (E18) e `coordinator-workflow` (E12). Nenhum workflow repete o nome de uma skill (DEC-035). Alcance: contrato. | `task-planner` e `implementation-planner` para a skill de plano; manter no workflow do release o nome `roadmap-release`, igual ao da skill. | - | A suíte de gatilho de E20, rodada sem o superpowers habilitado, mostrar confusão de nomes; ou a sonda de E14 mostrar que o nome do workflow precisa de outra grafia. | executor | pendente |
```

**Se rejeitada** (nome):

```
| DEC-NNN | <data> | E20 | O dono rejeita o nome de DEC-041: a skill interativa de plano se chama `<nome>`. | `plan-writer` (DEC-041). | Peça 2 de E20 na estratégia v1.0 | - | user | vigente |
```

**Linhas que mudam junto**
- EST:479: `- Peça 2: skill interativa de plano, `plan-writer` (DEC-041), que usa o mesmo autor, não pede aprovação e grava `plan.md` na pasta do spec (DEC-040, DEC-026). Modo de adoção (DEC-018): aceita qualquer arquivo de plano sem bloco de dados, de qualquer origem, reescreve-o uma vez no formato novo, no mesmo caminho, e mostra o que mudou.`
- EST:282: trocar "com um nome diferente do de toda skill" por "com o nome `release-workflow` (DEC-041)".
- EST:771: trocar "com nome próprio" por "com o nome `coordinator-workflow` (DEC-041)".
- EST:490, critério 5 de E20, acrescentar ao fim do texto: ", e com o registro de o superpowers estar ou não habilitado na sessão". É mudança de critério, então depende da aprovação do dono.
- EST:497: "antes da publicação" passa a "antes da publicação de E11".

## DEC-028 — numeração

**Verificado**
- A linha 1 só aceita `\d+\.\d+\.\d+` (CHK:876), então sufixo de pré-lançamento dá `bad-header`.
- O plugin está em 1.6.0 e a linha 1 em 1.5.0, o que é correto pela regra de `D:\projects\claude-play\.claude\rules\roadmap-checker.md`.
- O teste fixa a linha 1 em quatro pontos (`check-roadmap.test.mjs:150, 152, 418, 528`).
- O tracker só troca a cópia da pasta quando a do plugin é mais nova (`roadmap-tracker\SKILL.md:88`).
- A branch de volta leva "a versão de correção seguinte" e a linha 1 nessa versão (EST:77).
- 2.0.0 em E11 está coerente com DEC-015.
- E5 altera o lint do `marketplace-tools` (EST:401), que está em 1.1.0 e não entra em nenhuma numeração.

**Onde a linha falha**
- "Depois só muda quando o checker mudar" contradiz a volta de DEC-036 e deixa pastas presas. Sequência: a volta 1.7.1 leva o checker antigo com linha 1 em 1.7.1; a branch de release continua em 1.7.0; a republicação 1.7.2 não mexe na linha 1 porque "o checker não mudou"; toda pasta já em 1.7.1 nunca recebe o checker de E2.
- Não diz que volta e republicação consomem patches. A volta da 2.0.0 é uma 2.0.1 com conteúdo da 1.7.x.
- Junta três coisas de alcance diferente: os números, a regra da linha 1 e o formato.

**Inferido**
- A regra do repositório manda subir a linha 1 junto com a mudança do checker; a estratégia adia isso para o preparo da publicação (EST:58). O spec de E2 precisa saber disso.
- Um spec posterior a E11 que mude um formato gravado pela 2.0.0 torna a publicação seguinte uma major.

**Alcance e prazo**
- Números: local; preparo de E17.
- Linha 1, formato e gravação do alcance: contrato; antes do spec de E2.

**Custo**
- Números: quase nenhum, porque a publicação seguinte corrige.
- Regra da linha 1 errada: checkers presos nas pastas; corrige-se com mais um patch.
- Rejeitar agora: zero.

**Veredito: ratificar com emenda, dividida em duas linhas, mais a linha nova do alcance.**

```
| DEC-028 | 2026-11-10 | E17 | Numeração do productivity-tools: 1.7.0 na primeira publicação (E17), 2.0.0 na de quebra (E11), 2.1.0 em E16 e 2.2.0 no fechamento (E13). Correção, volta e a publicação que refaz uma versão voltada levam cada uma o patch seguinte (DEC-036). Sem sufixo de pré-lançamento. Alcance: local. | Só patches até a quebra; sufixos de pré-lançamento, que a linha 1 do checker não aceita; minor novo para cada volta. | - | Uma publicação a mais ou a menos mudar a sequência; ou um spec posterior a E11 mudar um formato que a 2.0.0 grava, caso em que a publicação que o levar passa a ser a major seguinte. | executor | pendente |
| DEC-042 | 2026-11-10 | E2 | A linha 1 do checker só muda no preparo de uma publicação, na branch de release: vai a 1.7.0 em E17 e, depois, à versão de toda publicação cujo checker difira do publicado, o que inclui cada volta e a publicação seguinte a ela. O formato da pasta de roadmap continua 1. Alcance: contrato. | Subir a linha 1 em toda publicação; subir na branch do entregável que muda o checker; formato 2 com receita de migração. | - | Uma checagem nova de E2 precisar virar erro, ou o alcance das decisões precisar de coluna própria. | executor | pendente |
| DEC-045 | 2026-11-10 | E3 | O alcance de uma decisão do executor é a última frase da célula Decisão: `Alcance: local.` ou `Alcance: contrato.`. Linha do executor sem a frase conta como contrato. Nenhuma coluna nova em `decisions.md`. Alcance: contrato. | Coluna Alcance, que muda o contrato de formato; alcance só no spec. | - | A CLI de E3 ou o aviso de E2 não conseguirem ler a frase de forma confiável. | executor | pendente |
```

DEC-045 é proposta minha, não estava entre as cinco.

**Se rejeitada** (números):

```
| DEC-NNN | <data> | E17 | O dono rejeita a sequência de DEC-028: <sequência>. | 1.7.0, 2.0.0, 2.1.0 e 2.2.0 (DEC-028). | Texto de "Execução deste roadmap" na estratégia v1.0 | - | user | vigente |
```

**Linhas que mudam junto**
- EST:58, parêntese: `(versão nos dois lugares de cada plugin alterado, o que inclui o marketplace-tools na publicação que levar E5; linha 1 do checker quando ele difere do publicado e sempre na publicação que segue uma volta, DEC-042; G1 a G5)`.
- EST:79, acrescentar ao fim: `e leva a linha 1 do checker a esse número (DEC-042)`.

## DEC-029 — operação

**Verificado**
- A linha diz "no seu modo de permissão e no modo padrão". O card E14 peça 3, reescrito depois, pede cada modo de permissão, a execução sem interface e as variantes por caminho e pelo nome (EST:132).
- A peça 2 do card cita só o modo real do dono (EST:131), menos do que a decisão pede.
- As configurações do dono não têm bloco `permissions` e têm `skipDangerousModePermissionPrompt: true` (`settings.json:86`).
- O plugin de sonda cobre as duas variantes (`D:\projects\claude-play\docs\reports\2026-11-10-e14-sondas\wfprobe\skills\launch\SKILL.md`).
- A skill do release para uma vez quando faltam regras de permissão (`roadmap-release\SKILL.md:24-25`).
- A trava está em WF:810, e a liberação está documentada em `operator.md:66-73`.
- E1 e E15 não dependem de E14 (EST:149, 183).
- A sonda de versão (EST:867) e as duas conferências de E1 antes do spec (EST:866) não têm operador.

**Inferido**
- O dono costuma rodar sem permissões; nesse modo as sondas de script e de consentimento passam sem dizer nada, e as rodadas informativas são as do modo padrão e de `claude -p`.
- O lançador em lote roda `claude -p`. Com as configurações atuais ele para na parada única do preflight, ou tem o Workflow negado, até a sonda dizer que regra passar.
- A trava é o que hoje torna inofensivas as colisões de arquivo não codificadas (ver DEC-013).
- As sondas do executor exigem a sessão principal, porque subagents não têm a ferramenta Workflow. É afirmação de SRC-11:640, que não conferi.

**Alcance e prazo**
- Sondas: local; antes de E14 começar, ou seja, agora.
- Lançador: contrato (E15, E17, E11, E16 e E13 o operam); antes do spec de E1.
- Trava: local; nada a construir.

**Custo**
- Sonda no modo errado dá resultado falso e contamina DEC-035 e os specs de E18 e E12.
- Lançador: uma peça de E1.
- Trava: tempo de parede.
- Rejeitar agora: zero código, mas E14 fica sem operador.

**Veredito: ratificar com emenda, dividida em três linhas.**

```
| DEC-029 | 2026-11-10 | E14 | Operação das sondas: o executor roda, na sessão principal, as de agente em workflow, de fidelidade do plano e de compartilhamento de código. O dono lança as de script do plugin e de consentimento, no seu modo de permissão, no modo padrão e em `claude -p`, por caminho e pelo nome. Alcance: local. | O dono rodar todas as sondas; rodar só no modo de permissão do dono. | - | Uma sonda rodada pelo executor depender do modo de permissão. | executor | pendente |
| DEC-043 | 2026-11-10 | E1 | As medições pagas são lançadas por um lançador em lote, peça de E1: o dono inicia um comando por variante e confere a saída. As permissões de que a execução sem interface precisa (regras do preflight e a do Workflow) entram por parâmetro, com o valor da sonda de E14. Alcance: contrato. | Operar as medições à mão; rodar as medições como tarefa do próprio release. | - | A sonda de E14 mostrar que nenhuma regra libera o workflow na execução sem interface. | executor | pendente |
| DEC-044 | 2026-11-10 | E10 | A trava que limita a um entregável por vez a execução com configuração de release gerada é mantida. Liberar o paralelismo continua sendo rever `locks`, tirar `generated` e commitar a configuração. Alcance: local. | Remover a trava; deixar um `maxParallel` explícito vencer a trava. | - | O tempo de parede com a trava virar o gargalo; antes de liberar o paralelismo neste roadmap, as colisões de arquivo entre fatias viram dependência. | executor | pendente |
```

**Se rejeitada** (sondas):

```
| DEC-NNN | <data> | E14 | O dono rejeita DEC-029: o dono lança todas as sondas, e o executor só as prepara. | O executor rodar três das cinco sondas (DEC-029). | - | - | user | vigente |
```

**Linhas que mudam junto**
- EST:131: `- Peça 2: script do plugin rodado por um subagent por caminho absoluto do cache, no modo de permissão real do dono e no modo padrão, inclusive após uma troca de versão; alternativa se falhar.`
- EST:160, acrescentar ao fim da peça 5: `As permissões da execução sem interface (regras que o preflight exige e a do Workflow) entram por parâmetro (DEC-043).`
- E1, risco novo: `- Na execução sem interface ninguém responde à parada única do preflight, e as configurações do dono não têm regras de permissão -> o lançador passa as regras por parâmetro, com o texto da regra do Workflow definido pela sonda de E14; até lá ele é testado só com executor simulado (critério 7).`
- E15 passa a `depends=E1,E14` (EST:183). Acompanham: a tabela em EST:88, a aresta `E14 --> E15` em CP e STATE:36 ("Aguardar E1 e E14").
- STATE, pendentes, duas linhas novas:
  - `- (dono) Rodar a sonda de versão de E17 (uma versão menor substitui a instalada?), que altera estado; o executor prepara os comandos.`
  - `- (dono) Iniciar as duas conferências de E1 antes do spec (plano semeado preservado; retomada aceita commit semeado), que o executor prepara.`

## Linhas de registro que mudam em qualquer caso

- STATE:10-12: ratificar passa a ser o item 1 e commitar o item 2. STATE:12 e STATE:57 passam a citar DEC-013, DEC-026 a DEC-029 e DEC-037 a DEC-045.
- CP:62 e EST:6 e EST:856: a mesma lista de ids.
- Depois da ratificação, somem de EST:425, 479 e 540 as expressões "do executor, pendente de ratificação".
- Os ids DEC-037 a DEC-045 valem se nada for acrescentado antes; DEC-036 é a última linha hoje.

## Lista de ratificação (uma passada)

| DEC | Alcance | O que fixa | Custo se errada | Necessária antes de | Recomendo |
|---|---|---|---|---|---|
| 013 | contrato | E3 → E3, E18, E22 | Revisão da estratégia; novo spec das fatias | spec de E3 | ratificar |
| 037 | contrato | E5 → E5, E19 | Idem | spec de E5 | ratificar |
| 038 | contrato | E6 → E6, E20 | Idem | spec de E6 | ratificar |
| 039 | contrato | E9 → E9, E21, E24; E23 não usado | Idem | spec de E9 | ratificar |
| 026 | contrato | Pasta por entregável, quatro nomes fixos, adoção no lugar, relatório em `docs/reports/` | Antes de E11: constantes e prosa. Depois: outra quebra | specs de E19 e E7 | ratificar, após as perguntas 2 e 3 |
| 027 | local | Spec: até 5 perguntas, extra a pedido, 1 aprovação | Prosa da skill | spec de E19 | ratificar |
| 040 | local | Plano sem aprovação, salvo adoção | Prosa da skill | spec de E20 | ratificar |
| 041 | contrato | `spec-writer`, `plan-writer`, `release-workflow`, `coordinator-workflow` | Skill: barato até E11. Workflow: público na 1.7.0, e renomear invalida consentimento e regra | specs de E18 e E7 | ratificar, após a pergunta 4 |
| 028 | local | 1.7.0, 2.0.0, 2.1.0, 2.2.0; patches para correção, volta e republicação | Quase nenhum | preparo de E17 | ratificar (pode esperar E17) |
| 042 | contrato | Linha 1 só no preparo; sobe em toda volta e na publicação seguinte; formato 1 | Checkers presos nas pastas; um patch corrige | spec de E2 | ratificar |
| 045 | contrato | Alcance como última frase da célula Decisão | CLI, aviso e preflight leem errado; trocar a convenção | spec de E2 | ratificar |
| 029 | local | Quem roda cada sonda; modos e variantes | Resultado falso, que contamina DEC-035, E18 e E12 | início de E14 | ratificar |
| 043 | contrato | Lançador em lote; permissões por parâmetro | Uma peça de E1; a linha de base atrasa | spec de E1 | ratificar |
| 044 | local | Trava de paralelismo mantida | Tempo de parede | spec de E10 | ratificar |

Nada foi construído em cima de nenhuma; a estratégia v1.0, os requisitos, o painel e o caminho crítico já refletem DEC-013. Resposta por linha: `ratifico`, `rejeito: <o que vale>` ou `adio` (só as locais).

## Perguntas que são do dono

1. **Ratificar antes do primeiro commit da pasta?**
   - (a) Sim: corrigir as linhas no lugar, ratificar e só então commitar. **Recomendo.**
   - (b) Commitar como está: cada emenda vira linha nova do dono, com revisão da estratégia.
2. **Chave da pasta de artefatos.**
   - (a) `<slug do roadmap>-<E>`. **Recomendo**: não se repete entre roadmaps e não muda se o card for renomeado.
   - (b) `<E>-<slug do título>`, como na proposta de desenho.
   - (c) Só `<E>`.
   - (d) Nomes datados soltos, o que rejeita DEC-026.
3. **Plano adotado.**
   - (a) Reescrito no mesmo caminho. **Recomendo**: o histórico do git mostra o que mudou, e é o que DEC-036 supõe.
   - (b) Gravado como `plan.md` na pasta nova, com o original mantido.
4. **Nomes dos workflows**, que viram comando visível e texto de regra de permissão.
   - (a) `release-workflow` e `coordinator-workflow`. **Recomendo**: não começam por `plan-` nem repetem skill. O segundo coincide com o id de uma fase deste roadmap, o que é inofensivo.
   - (b) `release-run` e `plan-run`.
   - (c) Deixar para o spec de E18, como nova decisão de contrato pendente.
5. **O que pode entrar na 1.7.0.**
   - (a) E7 e E19 passam a depender de E17. **Recomendo**: o caminho crítico vai de 10 para 12 elos, e a 1.7.0 fica compatível de fato.
   - (b) Só E7 espera; E19 e E20 saem na 1.7.0, e então nomes e suíte de gatilho fecham antes de E17.
   - (c) Como está, aceitando que a primeira publicação possa quebrar, contra DEC-015.
6. **Aresta E4 → E22.**
   - (a) Cada um com seu arquivo de teste de prosa, como E12 já faz, e E4 depende só de E2. **Recomendo.**
   - (b) Manter.
7. **Onde vive a nota de atualização da 2.0.0.**
   - (a) `docs/releases/productivity-tools-2.0.0.md`, com link no README da raiz. **Recomendo.**
   - (b) Seção no README da raiz.
   - (c) Texto do release do GitHub na tag.
8. **Artefatos de E1 a E8 em `docs/superpowers/`.**
   - (a) Aceitar e deixar lá. **Recomendo**: é coerente com DEC-018.
   - (b) Mover à mão depois de E11.


---

# Proposta 2: divisão de E8, E11 e E18

Nada foi editado nem validado pelo checker; o texto abaixo é para colar. Recomendo dividir os três cards, cada um em dois (E23, E25 e E26 novos), e a cadeia até E13 continua com dez.

## Veredictos

| Card | Veredicto | O que separa |
|---|---|---|
| E8 | Dividir em 2: E8 (estágios nativos, carga do plano, paradas, guarda) e E23 (registro da execução e retomada) | Região de código, risco e requisitos diferentes; REQ-011 e REQ-036 só existem em E8 e saem inteiros |
| E18 | Dividir em 2: E18 (registro pela CLI e preflight) e E25 (lançamento pelo nome) | A peça 5 é condicional à sonda, tem o único critério `human`, mexe no manifesto e na checagem do token que o próprio card manda não tocar |
| E11 | Dividir em 2: E11 (comparação, portão e publicação da quebra) e E26 (as três medições de política) | Portão que bloqueia contra medição que nunca bloqueia; E26 não precisa de E7 |

## O que o código mostrou

Arquivo: `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`.

**E8**
- **Estágios, caminhos e paradas são um bloco só.** Spec em 1455-1499, plano em 1502-1568, parada por item humano em 1494-1499. Os caminhos `docs/superpowers/` estão em 1219, 1230, 1259-1261, 1291, 1304, 1457-1464, 1502-1507 e 2051.
- **A guarda da versão anterior é inseparável da troca de caminhos.** Sem ela, uma branch com spec no caminho antigo ganharia um spec novo por cima.
- **As paradas leem o mesmo retorno do spec.** Hoje é `S_SPEC` (917), com `decisions` como lista de texto, e a contradição com decisão registrada é julgada pelo revisor LLM (1473). A retenção por alcance contrato é pequena: 1999-2004, mais `heldBy` em 105-160.
- **A retomada é outra região.** Ela toca os três laços de revisão (1469, 1540, 1800), `readPersistedLog` (1230, chamado em 1405 e 1613) e a leitura de progresso (1600).
- **A medição de preparação é da execução, não do entregável.** Ela sai do agente de preflight (1092-1100), no worktree de integração, uma vez por execução. O registro da peça 3 é por entregável, na branch. Onde guardar essa medição é desenho que o card atual não resolve.
- **O registro é "gravado por script", mas o workflow não tem acesso a arquivos (linha 20).** É um script novo do plugin, e o card não nomeia arquivo de teste para ele.
- **`flow.test.mjs` não ajuda a separar.** São 2636 linhas e 273 testes sobre um único arnês `exec` (linha 48); as funções puras são testadas em outros arquivos via `load-pure.mjs`.

**E18**
- **O registro confia no agente.** `recordStatus` (1172-1182) é chamado em 1580, 1586 e 2018 e só olha `checkerErrors` devolvido pelo próprio agente. A etapa de docs (1343-1353) já tem medição independente (1341).
- **O preflight não lê cards.** `runPreflight` em `scripts\preflight.mjs` 325-377, e o `SKILL.md` linha 23 admite que `missingRules` não enxerga os `{verify}`.
- **A trava da peça 5 mexe na autorização de efeito externo.** Sem config o workflow já para antes de qualquer agente (799). O token só é exigido quando há tarefa externa autorizada (808). O risco 3 do card manda não alterar essa lógica, e a peça 5 exige alterá-la.
- **Token obrigatório muda o padrão do arnês inteiro.** Só 25 linhas de `flow.test.mjs` citam `runToken`.
- **O manifesto não tem workflow registrado.** `plugins\productivity-tools\.claude-plugin\plugin.json`.

**E11**
- Não há código. Comparei com E15, E17 e E16 e com "Execução deste roadmap".
- As peças 2 a 4 só produzem decisões, e inconclusivo mantém o atual (critério 3). As peças 1 e 5 a 7 são o portão de DEC-017 e a publicação.
- O card diz que depende de E7 só por causa da publicação. As medições de política podem começar quando E8 integra.

## Efeito na cadeia

- **Cadeia até E13: continua dez.** E14, E2, E3, E18, (E17 ou E25), E8, E9, E21, (E12, E16 ou E23), E13.
- **Cadeia Should até E10: sobe de dez para onze.** E24 passa a vir depois de E23, porque um Must não pode depender de um Should (DEC-022).
- **Ordem no arquivo de workflow:** E18, E25, E8, E9, E21, E23, E24, E10.
- **E25 roda na janela em que E8 espera a publicação de E17,** então não custa tempo de parede.
- **Critical:** E23 e E25 `true` (estão numa cadeia mais longa); E26 e E11 `false`.

## Cards prontos para colar

### E18 (substitui o atual)

```markdown
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
- O caminho do script muda a cada versão e a regra de permissão deixa de casar -> seguir a decisão da sonda de E14 sobre onde o script vive.
- A etapa de documentação grava riscos aceitos e pendências humanas em texto livre, sem comando na CLI -> o spec decide se viram itens pendentes pelos comandos de E3 ou ficam com o agente; decisões e status passam sempre pela CLI.
- A semântica de autorização de efeito externo e de retomada regride (área com mais correções recentes, SRC-02 §1) -> não alterar essa lógica nesta entrega e manter os testes atuais passando.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->
```

### E25 (novo, logo depois de E18)

```markdown
<!-- roadmap:card id=E25 phase=roadmap-sem-llm track=engineering priority=Must size="não estimado" depends=E14,E18 reqs=REQ-033 critical=true -->
### E25 -- Workflow do release lançado pelo nome

Por quê: REQ-033. Lançar o workflow por caminho pede consentimento a cada vez e trava uma execução sem interface; o plugin não embarca hook que aprove o lançamento (DEC-035). Fatia de E18: segue a decisão da sonda de consentimento de E14 e tem aceite do dono, por isso fecha separada do registro pela CLI. Vem depois de E18 e antes de E8 porque edita o mesmo arquivo de workflow e o preflight. Não segura E17: entra na publicação que estiver em preparação quando integrar.

Peças:

- Peça 1: o preflight informa, como aviso que não bloqueia, a regra de permissão que libera o workflow numa execução sem interface.
- Peça 2: o workflow do release é registrado como workflow do plugin pelo manifesto, sem mover o arquivo, com um nome diferente do de toda skill, e a skill o lança pelo nome.
- Peça 3: lançado sem configuração ou sem o token de execução, o workflow para antes de qualquer agente.

Arquivos de teste deste card: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, que já existem e ganham os casos deste card.

<!-- roadmap:acceptance -->
1. Dadas configurações sem regra que cubra o workflow do release, quando o preflight roda, então a regra aparece nos avisos com o texto exato a acrescentar, e não entre as regras ausentes que bloqueiam; com a regra presente, o aviso não aparece. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado o workflow do release lançado sem configuração ou sem o token de execução, quando ele inicia, então devolve erro antes de qualquer chamada de agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado o manifesto do plugin, quando o teste o lê, então ele registra o arquivo do workflow do release, o nome do workflow não é o de nenhuma skill do plugin, e a skill manda lançar por esse nome. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dada uma sessão no modo padrão, sem regra e sem hook, quando o dono lança o release pela skill e escolhe não perguntar de novo, então o lançamento seguinte no mesmo projeto começa sem diálogo. {verify: human; evidence: o dono confere em duas sessões seguidas e registra o modo de permissão}
<!-- /roadmap:acceptance -->

Definição de pronto: aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

<!-- roadmap:risks -->
- O lançamento pelo nome ou a regra de permissão não se comportam como a documentação indica -> seguir a decisão da sonda de E14; se o lançamento pelo nome falhar, o card se reduz à peça 1 e a skill continua lançando por caminho.
- A trava mexe na checagem do token de execução, que hoje só barra a execução com tarefa externa autorizada, e a maior parte dos testes do fluxo roda sem token -> a trava só acrescenta uma recusa anterior, nenhuma condição existente é removida, e o padrão do arnês de teste muda num commit próprio, com a suíte atual passando (G1).
- O critério 4 só pode ser conferido com o workflow nomeado carregado -> o dono confere com o plugin carregado do caminho local do repositório, como na sonda de E14.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->
```

### E8 (substitui o atual)

```markdown
<!-- roadmap:card id=E8 phase=ponta-a-ponta track=engineering priority=Must size="não estimado" depends=E17,E18,E19,E20,E25 reqs=REQ-008,REQ-013,REQ-016,REQ-020,REQ-026,REQ-044 critical=true -->
### E8 -- Release com spec e plano nativos e paradas em código

Por quê: REQ-026, REQ-013, REQ-016, REQ-008, REQ-020, REQ-044. Os estágios de spec e plano dependem de skills externas, o plano é transcrito por um agente e relido por outro, e a decisão de parar depende do que o agente relata (SRC-02 §4, confirmado em SRC-10). Vem depois de E25 porque edita o mesmo arquivo de workflow. A retomada sem repetição saiu para E23.

Peças:

- Peça 1: estágios de spec e plano do workflow usando os autores do plugin, sem pergunta à pessoa. Este card é dono de todos os caminhos de artefato do release (spec, plano, registro da execução, log de revisões, relatório de execução), que deixam a pasta do superpowers e seguem DEC-026, do executor, pendente de ratificação; o registro da execução só é gravado em E23. Começa sobre a versão publicada em E17.
- Peça 2: guarda para trabalho da versão anterior (DEC-018): uma branch de entregável com commits de tarefa e sem spec nativo para com ação de operador, em vez de receber um spec novo por cima.
- Peça 3: carga do plano conferida por resumo de integridade, sem transcrição nem releitura por LLM; o número de novas tentativas vem da sonda de E14; nível e effort de cada tarefa vêm da definição de roteamento.
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
```

Critérios antigos → novos em E8: 1→1, 10→2, 2→3, 8→4, 6→5, 7→6, 9→7, 11→8. Os antigos 3, 4 e 5 e o risco da chave de retomada vão para E23.

### E23 (novo, depois de E21 no documento)

```markdown
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
```

### E11 (substitui o atual)

```markdown
<!-- roadmap:card id=E11 phase=ponta-a-ponta track=measurement priority=Must size="não estimado" depends=E7,E8,E15 reqs=REQ-002,REQ-034,REQ-044 critical=false -->
### E11 -- Ponto de medição e publicação da versão de quebra

Por quê: REQ-002, REQ-034, REQ-044. A publicação que sai daqui é a versão de quebra (DEC-015): leva o formato novo de plano do release e o estado novo do coordinator, por isso depende também de E7. Operado pelo dono (DEC-011), com portão por contadores e detecção (DEC-017). As medições de política de spec e plano saíram para E26, que não segura esta publicação.

Peças:

- Peça 1: comparação do release nativo com a linha de base no cenário fixo, incluindo a parada e a retomada.
- Peça 2: ratificação em lote das decisões do executor pendentes, antes da preparação da publicação (DEC-030).
- Peça 3: preparação da versão de quebra pelo executor (versão nos dois lugares, G1 a G5, nota de atualização fora dos arquivos publicados do plugin: terminar planos e entregáveis em andamento na versão anterior antes de atualizar; planos já escritos entram pela adoção) e publicação pelo dono.
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
```

Critérios antigos → novos em E11: 1→1, 4→2, 5→3, 6→4, 7→5, 8→6. O primeiro risco é novo e copia o de E17, porque o card ficou sem risco para o próprio portão.

### E26 (novo, logo depois de E11)

```markdown
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
```

## Dependências que mudam em outros cards

| Card | Antes | Depois | Motivo |
|---|---|---|---|
| E24 | `E21` | `E21,E23` | Mesmo arquivo de workflow; E23 é Must e não pode vir depois de um Should |
| E13 | `E2,E3,E7,E9,E11,E12,E16,E17,E18,E21` | `E2,E3,E7,E9,E11,E12,E16,E17,E18,E21,E23,E25,E26` | O fechamento exige todos os Must |

E9, E21, E10, E12, E16 e E17 não mudam. No "Por quê" de E24, acrescentar: "Vem depois de E23 porque edita o mesmo arquivo de workflow."

## Requisitos (só a coluna Entregáveis)

| REQ | Antes | Depois |
|---|---|---|
| REQ-011 | E8 | E23 |
| REQ-036 | E8 | E23 |
| REQ-033 | E12, E14, E18 | E12, E14, E25 |
| REQ-015 | E11 | E26 |

Nenhum requisito precisa ser dividido, então não há REQ-046.

## Demais linhas que mudam

**Estratégia** (`D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`)

- **Visão geral:** trocar as linhas de E8 e E11 e acrescentar três.
  ```
  | E25 | Workflow do release lançado pelo nome | roadmap-sem-llm | E14, E18 |
  | E8 | Release com spec e plano nativos e paradas em código | ponta-a-ponta | E17, E18, E19, E20, E25 |
  | E11 | Ponto de medição e publicação da versão de quebra | ponta-a-ponta | E7, E8, E15 |
  | E26 | Medição de política: revisão de spec e plano e modelo do autor de plano | ponta-a-ponta | E8, E15 |
  | E23 | Retomada do release sem repetir revisões | ponta-a-ponta | E8, E21 |
  ```
  E24 passa a `E21, E23`; E13 ganha `E23, E25, E26`.
- **Fases, coluna Entregáveis:** segunda linha `E3, E18, E25, E22, E4, E17`; quarta linha `E8, E11, E26, E9, E21, E23, E24, E16, E10`.
- **Linha 25 (não objetivos):** "(E26 para spec e plano, E16 para a revisão por tarefa; DEC-021)".
- **Linha 61:** "(E14, E15, E17, E11, E26, E16)".
- **Linha 71:** "medições de política (E26, E16)".
- **E1, peça 6:** "medições de política de E26 e E16".
- **E19, peça 1:** "é um braço da medição de E26".
- **Linha 843:** "(E18, E25, E8, E9, E21, E23, E24, E10)".
- **Linha 851:** "o workflow do release em E18 e E25, em E8 e E23, e em E9, E21 e E24".
- **Linha 852:** substituir por "E8, E11 e E18 foram divididos em E8 e E23, E11 e E26, E18 e E25 -> E8 ficou com oito critérios e um spec só: estágios, carga e paradas leem o mesmo retorno do spec, no mesmo trecho do workflow."
- **Linha 864:** "até E26 (REQ-015)".
- **Resumo de cobertura:** "REQ-015 por E26".
- **Versão:** âncora, registro de mudanças e histórico passam a v1.1, citando a decisão nova da divisão.

**`critical-path.md`**

- Acrescentar ao grafo:
  ```
  E14 --> E25
  E18 --> E25
  E25 --> E8
  E8 --> E26
  E15 --> E26
  E8 --> E23
  E21 --> E23
  E23 --> E24
  E23 --> E13
  E25 --> E13
  E26 --> E13
  ```
- Linha 56: "Caminho crítico até o fechamento (dez entregáveis em cadeia): E14, E2, E3, E18, depois E17 ou E25, E8, E9, E21, depois E12, E16 ou E23, e por fim E13. A cadeia que termina em E10, passando por E23 e E24, tem onze, mas E24 e E10 são Should e não estão no caminho do objetivo. Só ordem; não há datas (DEC-003)."
- A linha 58 (publicações) não muda.

**`state.md`**

- Cabeçalho: "Estratégia v1.1".
- Painel:
  ```
  | E8 | nao-iniciado | - | Aguardar E17, E18, E19, E20 e E25 |
  | E23 | nao-iniciado | - | Aguardar E8 e E21 |
  | E24 | nao-iniciado | - | Aguardar E21 e E23 |
  | E25 | nao-iniciado | - | Aguardar E14 e E18 |
  | E26 | nao-iniciado | - | Aguardar E8 e E15 |
  ```
- Pendente da linha 60: "Operar os pontos de medição E15, E17, E11, E26 e E16 e a medição final de E13, e publicar em E17, E11, E16 e E13 (DEC-014, DEC-017)."

## Publicações em E17 e E16

- **E17: manter inteiro.** Não tem medição de política; os seis critérios são portão e publicação.
- **E16: mesmo defeito de E11.** As peças 2 a 5 e os critérios 2 e 3 são política e podem segurar a 2.1.0. O corte simétrico cria E27 "Medição de política: revisão por tarefa" (`depends=E15,E21`, REQ-039, Must, `critical=true`). E16 fica com as peças 1, 6, 7 e 8 e os critérios 1, 4, 5, 6 e 7, e E13 ganha E27. A cadeia continua dez. Não escrevi o card; fica para a pergunta 4.
- **Trilha:** nenhuma publicação deve virar card da trilha `release`. A comparação é o que aprova a publicação (DEC-017), e a regra de quem passa pelo `roadmap-release` é escrita por trilha (linha 61).

## Riscos que a recomendação introduz

- **A economia da retomada chega mais tarde.** E9 e E21 deste roadmap ainda retomam repetindo revisões, e a comparação de E11 mede parada e retomada sem o ganho. A meta derivada é conferida em E16, se E23 já estiver integrado, ou em E13.
- **E23 é escrito sobre laços que E9 e E21 já mudaram,** e E24 mexe na revisão final depois dele.
- **Três cards a mais** são três passagens pelo pipeline de spec, plano e revisões. Se a sonda de E14 for negativa, E25 encolhe a uma peça e deve voltar para E18 por revisão.
- **Decisões que citam E11 e E18 na coluna Entregável não mudam.** DEC-010 e DEC-035 ficam como histórico, e a decisão nova da divisão explica.
- **Uma decisão de política pendente pode segurar uma publicação.** E26 roda em paralelo com E11; o risco do card trata disso.

## Pontos para o dono decidir

1. **Onde fica E23?**
   - (a) Depois de E21: cadeia dez, ganho medido em E16 ou E13. **Recomendo.**
   - (b) Entre E8 e E9: cadeia onze, mas E9 e E21 já retomam sem repetir e E11 mede o ganho.
   - (c) Manter em E8, com onze critérios e duas áreas de risco num spec.
2. **E18: quantas fatias?**
   - (a) Duas, E18 e E25. **Recomendo.**
   - (b) Três, separando também o preflight (peças 1 e 4), que rodaria em paralelo ao registro; fica um card de dois critérios num arquivo só.
   - (c) Manter inteiro.
3. **A publicação de E11 espera E26 fechar?**
   - (a) Não: E26 corre em paralelo e só E13 depende dele. **Recomendo;** DEC-021 continua cumprida, porque a versão de quebra sai com os laços atuais.
   - (b) Sim: `depends` de E11 ganha E26 e nada melhora em relação a hoje.
4. **Aplicar o mesmo corte em E16 (E27) nesta revisão?**
   - (a) Sim, por simetria. **Recomendo;** escrevo o card no mesmo formato.
   - (b) Não, avaliar no spec de E16.
5. **Quem implementa uma política que E26 ou E16 mudar?** Hoje nenhum card troca o padrão no workflow depois da medição.
   - (a) Revisão do card da fatia seguinte que edita o arquivo. **Recomendo.**
   - (b) Entregável novo aberto na hora.
6. **Como registrar a divisão?**
   - (a) Decisão nova de origem `user` ao aprovar a v1.1. **Recomendo.**
   - (b) Decisão do executor pendente, como foi DEC-013.


---

# Proposta 3: os três pontos que dependiam de execução

## Três pontos "só uma execução responde": o que a evidência já fecha e o que sobra

Nada foi alterado no repositório, em `~\.claude` nem no estado instalado. Os scripts de extração e a sonda ajustada estão em `<scratchpad da sessão>\q-execucao\`. O scratchpad é da sessão: copie a pasta antes de encerrar.

**Resumo**

- **Ponto 1:** quase tudo fechado por código da CLI 2.1.322, documentação e dois plugins da Anthropic em disco. Sobra confirmar o diálogo no modo padrão (15 min, centavos).
- **Ponto 2:** o desenho de semeadura funciona, com cinco mudanças. Sobra só a preservação de um plano com defeito plantado (cerca de US$ 3 a 6, estimativa do relatório anterior).
- **Ponto 3:** pelo código, a comparação é de igualdade: versão menor substitui a instalada. Sobra confirmar na prática e ver como o ref troca (10 min, custo zero).

Achado fora do pedido: pelo código, o lançamento por caminho (o que a 1.6.0 faz hoje) é recusado com erro quando o script não está no conjunto legível; não abre diálogo. Todas as sessões suas com lançamento registrado eram `bypassPermissions`, então isso nunca apareceu.

---

## Ponto 1: lançar workflow do plugin pelo nome (DEC-035)

### Estabelecido

| Fato | Evidência | Confiança |
|---|---|---|
| A ferramenta aceita `name`, e o nome de um workflow de plugin é `<plugin>:<meta.name>` (não o nome do arquivo) | Bundle da CLI: `let r=\`${a}:${f.meta.name}\`` no carregador de workflows de plugin; erro `Workflow "<nome>" not found. Available: …`. Docs (workflows): "A plugin called `acme-tools` containing a script whose `meta.name` is `release-audit` runs as `/acme-tools:release-audit`". `claude-security/skills/claude-security/jobs/scan-codebase.md:74`: `Workflow({ name: "claude-security:scan"`. `code-modernization/commands/modernize-assess.md:30`: `name: "code-modernization:modernize-portfolio-assess"` (arquivo `portfolio-assess.js`) | Alta |
| Lançamento pelo nome já funcionou nesta máquina, só com workflows salvos de projeto | 355 chamadas `Workflow` nas transcrições, 14 com `name` (várias são linhas repetidas): sucesso em 2.1.310 a 2.1.319 (`status: async_launched`, script copiado para `<sessão>/workflows/scripts/`); em 2.1.304 falhou com "not found. Available: deep-research". Nenhum workflow de plugin foi lançado pelo nome | Alta |
| O manifesto aceita um arquivo `.js` em `workflows`, então "sem mover o arquivo" é viável | Bundle: `p.isFile()&&r.endsWith(".js")`; docs: "`workflows`: Workflow `.js` files or directories. Replaces the default `workflows/` scan" | Alta |
| O consentimento é uma regra de permissão: "não perguntar de novo" grava `Workflow(<nome>)` como `allow` em `localSettings` (`.claude/settings.local.json` do projeto) | Bundle: `addRules … rules:[{toolName:Ac,ruleContent:h}],behavior:"allow",destination:"localSettings"` | Alta |
| A opção só existe no lançamento pelo nome sem `scriptPath` | Bundle: `h=r.scriptPath||w?void 0:r.name`; a sugestão sai só com `h` definido. Docs: "when you run a bundled, saved, or plugin workflow by name" | Alta |
| Uma regra `Workflow(<plugin>:<nome>)` dispensa o diálogo também no modo interativo; nenhuma regra com nome cobre lançamento por caminho | Mesmo trecho: a busca de regra usa `h`; com `allow` encontrado, devolve `allow` antes de qualquer `ask` | Alta para o nome; a regra `Workflow` sem conteúdo só tem apoio na frase da documentação |
| Lançamento por caminho exige que a ferramenta Read leria o arquivo sem perguntar, ou modo bypass; senão é negado | Bundle: `case"allow":return!0;case"path-mode-ask":return n.mode==="bypassPermissions"`; mensagem "scriptPath must be a script path this tool returned, or a file you can already read (the working directory or a directory you have added)" | Alta para a regra; não sei se o cache do plugin ou a pasta da skill entram como legíveis no modo padrão |
| Lançar do cache funciona em bypass | 5 lançamentos distintos com `scriptPath` em `plugins/cache/claude-play/productivity-tools/1.6.0/…`, todos `async_launched`, sessões em `bypassPermissions` | Alta |
| Colisão skill × workflow não afeta a ferramenta | Bundle: `name` é resolvido só no registro de workflows, e a chave do plugin é sempre prefixada. Os dois plugins da Anthropic usam nomes distintos; o `scan.js` devolve `{started:false, reason:"no-args"}` quando chamado sem args, igual à trava da peça 5 de E18 | Alta para a ferramenta; qual comando `/x:y` vence fica sem resposta e deixa de importar com nome distinto |
| Não há consentimento gravado nesta máquina | `settings.json` sem `permissions`; `.claude.json` sem chave de consentimento de workflow | Alta |
| Existe uma terceira rota: `allowed-tools` da skill | `claude-security/skills/claude-security/SKILL.md:11-12` lista `Workflow` e `Workflow(claude-security:scan)` | Alta que a Anthropic usa; não conferi se dispensa o diálogo |

### Em aberto

- O diálogo e a persistência entre sessões no modo padrão, vistos de fato (o código é minificado e de uma versão só).
- Se o cache do plugin conta como legível no modo padrão.
- Se a regra `Workflow` sem conteúdo libera lançamento por caminho no modo interativo.
- Se `allowed-tools` dispensa o diálogo.

Nenhuma transcrição sua tem lançamento fora de bypass, por isso a evidência não fecha.

### Experimento mínimo (15 min, centavos: um agente haiku por lançamento)

Use `<scratchpad da sessão>\q-execucao\wfprobe2`. É o `wfprobe` com uma skill a mais, `/wfprobe:launch-granted`, que declara `allowed-tools: Workflow(wfprobe:probe-run)`; passa em `claude plugin validate` (só o aviso de ícone). O hook já grava `tool_input` e `permission_suggestions` em `%TEMP%\wfprobe-hook.log`.

```powershell
$P = "<pasta onde você copiou wfprobe2>"
mkdir $env:TEMP\wfp1; cd $env:TEMP\wfp1; git init
claude --plugin-dir $P --permission-mode default
```

| # | Onde | Ação | Observar |
|---|---|---|---|
| 1 | `wfp1` | `/wfprobe:launch name`; escolher "Yes, and don't ask again"; sair | Nome que resolveu; a opção existe; conteúdo de `.claude\settings.local.json` |
| 2 | `wfp1`, sessão nova | `/wfprobe:launch name` | Sem diálogo |
| 3 | `wfp1`, mesma sessão | `/wfprobe:launch path` | Recusa com a mensagem "scriptPath must be…", ou diálogo sem a opção |
| 4 | `wfp2` (pasta nova, `git init`), com `--allowedTools "Workflow"` | `/wfprobe:launch path`; se recusar, repetir com `--add-dir $P` | Se a regra sem conteúdo cobre caminho; se falta só leitura |
| 5 | `wfp3` (pasta nova) | `/wfprobe:launch-granted` | Diálogo ou não |
| 6 (opcional) | `wfp4` | `claude -p "/wfprobe:launch name" --plugin-dir $P --output-format json`, sem e com `--allowedTools "Workflow(wfprobe:probe-run)"` | O que o lançador em lote de E1 precisa passar |

Limite: `--plugin-dir` carrega no lugar, não do cache. A linha 3 é indicativa para o cache real; o critério 8 de E18 confere no plugin instalado. Não rode em modo auto: um "sim" grava nas suas configurações de usuário.

### Tabela de decisão

| Resultado | Mudanças |
|---|---|
| **A.** Linhas 1 e 2 positivas (esperado) | DEC-035 fica, com a frase final trocada por: "Confirmado pela sonda de E14: o nome é `productivity-tools:<meta.name>`, a regra é `Workflow(productivity-tools:<nome>)` e o 'não perguntar de novo' a grava em `.claude/settings.local.json` do projeto." Fecha a linha de E14 em "Questões em aberto". REQ-033 passa a coberto. Critério 5 de E18 ganha o texto exato da regra |
| **B.** Nome resolve, mas o diálogo volta na sessão seguinte | DEC-035 emendada: "o consentimento não persiste; o preflight informa a regra como recomendação para todo modo". Critério 8 de E18 vira: "com a regra presente em qualquer configuração, o lançamento começa sem diálogo" |
| **C.** Nome não resolve a partir da skill | Vale a cláusula que DEC-035 já tem: a peça 5 de E18 se reduz ao aviso; saem os critérios 6, 7 e 8; o critério 5 de E12 sai; o segundo risco de E12 manda revisitar DEC-006 |
| **D.** Linha 3 recusa (independente de A a C) | Risco novo em E18: "No modo padrão o lançamento por caminho é recusado, não perguntado, quando o cache do plugin não está no conjunto legível -> o lançamento pelo nome é o caminho principal; o preflight avisa a regra de leitura para quem ficar no caminho." Nota em `references/operator.md` na preparação de E17 |
| **E.** Linha 5 sem diálogo | Nenhuma mudança automática: vira a pergunta 1 ao dono |

### Texto do card, a trocar já

E14, peça 3:

> - Peça 3: consentimento do Workflow. Já estabelecido por código e documentação (SRC a registrar): o nome é `<plugin>:<meta.name>`, o "não perguntar de novo" grava a regra `Workflow(<nome>)` nas configurações locais do projeto e só existe no lançamento pelo nome, e um lançamento por caminho exige script legível. A sonda confirma no modo padrão: o diálogo e a persistência entre sessões, a recusa ou não do caminho a partir do plugin, a regra sem conteúdo, e a concessão por `allowed-tools`. Plugin de sonda em `docs/reports/2026-11-10-e14-sondas/`.

"Questões em aberto", linha de E14: trocar a última frase por "A documentação e o código respondem nome, regra e local do consentimento; falta a confirmação no modo padrão."

E18, peça 5: acrescentar "Se a ferramenta não conhecer o nome (CLI anterior ao suporte), a skill cai para o caminho", que é o padrão do `code-modernization`. Depende da pergunta 2.

---

## Ponto 2: semear artefatos para medir detecção (DEC-033, E1)

### Estabelecido

Linhas de `plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`.

**Plano**

- O estágio de spec roda antes e também reusa (`:1457`); o laço de revisão do spec é incondicional (`:1469-1487`). Uma branch semeada precisa de spec e plano.
- O reuso do plano é só instrução de prompt (`:1506`): "reuse it (reused=true)", com uma exceção: plano sem declaração `external` em tarefas ou linhas de evidência é reescrito ("add the declarations, commit and return reused=false").
- O laço de revisão do plano é incondicional e vem antes do desvio de plan-only (`:1540-1560`, desvio em `:1579`). Com reuso, o mínimo de commits exigido é 0 (`:1559`).
- O revisor recebe o plano, o spec, o card e o JSON das tarefas transcrito pelo agente, e mede ele mesmo o blob e as linhas de evidência (`:1543-1546`); o script compara (`planBlobGaps` `:1534`, `evidenceRowGaps` `:717`).
- A impressão digital é o blob do plano (`:642-651`).
- **Parte dos defeitos de plano é pega por código, não pelo revisor:** `evidenceGaps` (`:325-343`) acusa critério sem linha, comando do `{verify}` trocado e tag trocada. Todos os critérios do sandbox têm `{verify: test; …}` (`make-sandbox.mjs:261-327`). Da lista proposta, os defeitos 1, 6 e 8 saem capturados em 100% das execuções.

**Retomada**

- Uma tarefa conta como feita quando `git log --grep "^E<n> T<k>:" <alvo>..HEAD` acha commits (`:1600`). Nada além do git e do log de revisões é lido.
- Só a última tarefa da sequência contígua é revista de novo, sem implementador, nas duas revisões, no intervalo `pai-do-primeiro-commit..HEAD` (`:1611`, `:1688-1690`, `:1708`, `:1740-1757`). As anteriores são puladas.
- Depois vêm integridade de testes (`:1790`), revisão final do diff inteiro (`:1799`), gates e comandos de evidência (`:1826`).
- Tarefa externa já commitada e não autorizada para a execução (`:1638-1647`); marca `launching` ou `started` como a mais nova para e pergunta (`:1621`).

**Execuções passadas** (diário `workflows/wf_*.json`, campos `label`, `state` e `resultPreview`; script `mine-resume.mjs`)

- 7 retomadas em `roteiros-B3` a `B8`: spec `reused=true` em 7 de 7, plano `reused=true` em 7 de 7.
- `planBlob` idêntico ao da execução anterior nas 6 retomadas em que a anterior está registrada (5 repositórios).
- `plan-review1` rodou sobre o plano reusado em 7 de 7; nenhum `plan-fix`.
- Com tarefas feitas 1 e 2 (B3, B8), só `t2.spec1` e `t2.quality1` rodaram; com só a 1 (B4, B6, B7), `t1.spec1` e `t1.quality1`. Nenhum `impl` da tarefa revista.
- As 20 execuções plan-only de `regressao` são todas novas: reuso em plan-only nunca foi observado, mas o caminho de código é o mesmo até `:1579`.
- Os repositórios de sandbox não existem mais em disco.

Confiança: alta para a aceitação do commit semeado (por construção, a retomada só lê assuntos de commit) e para o laço rodar sobre plano reusado; média para a preservação de um plano com defeito visível, porque os 7 casos são planos que o próprio pipeline escreveu.

### Conclusão: funciona com mudanças

1. **Semear spec e plano juntos**, tirados de uma execução real aprovada. Um spec escrito à mão pode levar correção na revisão do spec e mudar a base.
2. **Regra de validade por tentativa, por código:** o agente de plano devolveu `reused=true` e o blob medido em `plan-review1` é o do commit semeado. Fora disso a tentativa é inválida e se repete.
3. **Trocar ou separar os defeitos de plano 1, 6 e 8.** Substitutos que só o revisor pega (`:1544`): `needsLock` errado, tarefa que edita a pasta do roadmap, `tier` ou `reviewTier` contra o raio de impacto, `noCommit` com passos que commitam, efeito externo exigido sem tarefa externa, tarefa marcada para depois do merge.
4. **Três desfechos por defeito.** Com 4 defeitos por artefato, uma parada por um deles hoje contaria os outros 3 como capturados. Proponho: capturado (sentinela limpa), perdido (aprovado com sentinela acusando) e indeterminado (parou com sentinela acusando; fica fora do denominador).
5. **Código: todas as tarefas do plano commitadas e os 4 defeitos nos commits da última.** Assim nada é implementado e a revisão por tarefa vê todos. A sentinela, avaliada no commit anterior ao `E<n>: sync with <alvo>`, separa captura na revisão por tarefa de captura na revisão final.

O arnês de estágio não é necessário para a detecção de linha de base; continua valendo para os braços de E11 e E16.

### Receita exata

**Comum**

- Branch `feat/E<n>` (prefixo padrão, `:811`), nascida do alvo.
- Árvore limpa: sujeira é descartada por `reset --hard` (`:1451`, `:1603`).
- Sem commit `merge: E<n> ` no alvo; painel em qualquer status não concluído.
- Nunca passar `notes`: com nota, o agente ajusta o plano (`:1506`).

**Arquivos**

- `docs/superpowers/specs/<data>-E<n>-<slug>-design.md` e `docs/superpowers/plans/<data>-E<n>-<slug>.md`.
- No plano: a linha `**Roadmap:** <pasta do roadmap>/` no cabeçalho.
- Tarefas numeradas 1..N; em cada uma: arquivos, `tier`, `reviewTier`, `external: false`, e `noCommit` só onde for verdade.
- Seção `## Acceptance criteria evidence` com uma linha por critério: `ac` só o id (`AC1`), `kind`, comando igual ao do `{verify}`, `external` booleano.

**Plano semeado**

- Um commit a mais na branch, com qualquer assunto, alterando só o arquivo do plano. Rodar em plan-only.

**Código semeado**

- Para cada tarefa 1..N, ao menos um commit com assunto `E<n> T<k>: <texto>`, em ordem e sem lacuna.
- Os defeitos nos commits de `T<N>`.
- Nenhum assunto `E<n> T<k> launching`, `started` ou `awaiting person`.
- Testes do repositório e comandos de evidência passando (senão os gates capturam por código).
- Sentinela fora do repositório.
- Log de revisões opcional: sem ele sai só um aviso.
- Rodar em modo normal.

**O que faz o pipeline descartar ou refazer**

- Plano sem `external` (reescrito).
- Spec ausente (spec novo).
- Tarefa `external: true` sem `authorizeExternal` (para).
- Lacuna na numeração (a execução retoma dali e implementa).

### Experimento mínimo (cerca de US$ 3 a 6, 30 min; valores estimados no relatório anterior, não medidos por mim)

1. Gerar um sandbox com `node plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs <pasta>` e, numa sessão nele, pedir `plan-only E1`.
2. Na branch `feat/E1`, plantar um defeito que só o revisor pega (por exemplo, apagar o comando de verificação de uma tarefa) e commitar. Anotar `git rev-parse HEAD:<plano>`.
3. Pedir `plan-only E1` de novo.
4. Ler o diário: `node …\q-execucao\mine-resume.mjs "<trecho do nome da pasta do sandbox>" E1`.

Positivo: `plan.reused = "true"`, blob de `plan-review1` igual ao anotado, e `plan-fix1` nos rótulos (ou parada com achado).

A execução de código semeado é dispensável agora: entra como primeira tentativa de E15, com a regra de validade.

### Tabela de decisão

| Resultado | Mudanças |
|---|---|
| **A.** Plano preservado e revisado (esperado) | DEC-033 fica, com acréscimo: "Tentativa válida só com plano reusado e blob igual ao semeado; desfechos capturado, perdido e indeterminado; defeitos que o código pega são registrados à parte." Fecha a linha de E1 em "Questões em aberto". E1 peça 4 e risco 2 conforme abaixo |
| **B.** O agente reescreve o plano semeado | DEC-033 emendada: "a detecção de plano usa o arnês de estágio; a de código segue semeada". E15 peça 3 vira "dois planos pelo arnês de estágio e duas branches semeadas". A peça 6 de E1 passa a ser pré-requisito de E15 |
| **C.** Inválido só às vezes | Igual a A, com a regra de validade repetindo a tentativa; registrar a taxa de inválidas em `measurements.md` |

### Texto do card E1, a trocar já

Peça 4:

> - Peça 4: defeitos plantados com sentinela: oito de plano, oito de código e oito de spec, semeados em artefatos prontos (DEC-033). Plano semeado: spec e plano tirados de uma execução aprovada, com um commit que planta os defeitos. Código semeado: todas as tarefas commitadas com o assunto `E<n> T<k>:` e os defeitos na última. Cada tentativa tem checagem de validade (plano reusado, blob igual ao semeado) e três desfechos por defeito. Os defeitos que o código do workflow pega sozinho são marcados no manifesto e contados à parte.

Segundo risco:

> - O agente de plano reescreve um plano com defeito visível -> a checagem de validade invalida a tentativa; uma execução plan-only confirma antes do spec, e se a reescrita for regra a detecção de plano passa ao arnês de estágio. A retomada com commit semeado já está evidenciada (lê só os assuntos dos commits).

---

## Ponto 3: versão calculada menor substitui a instalada? (DEC-036, E17)

### Estabelecido

| Fato | Evidência | Confiança |
|---|---|---|
| A atualização compara por igualdade, sem ordem | Bundle 2.1.322: `ze=!Y&&!fe&&(T.version===qe\|\|T.installPath===X\|\|T.installPath===ue)`; com `ze` devolve `up_to_date`, senão instala a versão calculada. Docs (loading): "don't replace the cached copy when it matches what `installed_plugins.json` records"; (host-marketplace): "Users get a new copy only when the plugin's computed version differs from the one they have" | Alta para 2.1.322; a referência da CLI diz "When nothing is newer", redação solta |
| Fixar a loja num ref é mecanismo documentado para segurar versão | "Hold users on one version": "`#<ref>` on the add command"; `claude plugin tag --help` cria `{name}--v{version}` | Alta |
| Nunca houve descida de versão nesta máquina | 10 comandos de atualização nas transcrições, todos para cima (`mine-plugin-cmds.mjs`); productivity-tools: 1.1.0, 1.3.0, 1.4.0, 1.4.1, 1.4.2, 1.6.0 | Alta |
| `install` e `update` não têm opção de versão; não há comando para trocar ref | `--help` dos subcomandos | Alta |
| Dá para trocar o ref sem remover, editando a declaração nas configurações | Docs (loading): "A declared marketplace whose source changed in settings: Claude Code re-fetches it from the new source"; `marketplace add` grava em `extraKnownMarketplaces` (o seu tem `claude-play` sem `ref`). Repetir o `add` responde "already on disk". Remover "uninstalls every plugin you installed from it" e apaga opções e dados | Média: só documentação |
| `.orphaned_at`: arquivo com a hora (ms) em que a versão foi superada; a pasta sai 14 dias depois | 1.4.2 tem `1794328779201` = 2026-11-10T16:39:39.201Z, igual ao `lastUpdated` da 1.6.0. Remoção prevista: 1.4.0 em 22/11, 1.4.1 em 23/11, 1.4.2 em 24/11 | Alta |
| `.in_use`: pasta com um arquivo por processo que carregou aquela versão | Conteúdo `{"pid":…,"procStartFt":"…"}`; os 4 PIDs presentes são `claude.exe` vivos; 1.4.0 e 1.4.2 ainda têm uma sessão antiga cada, 1.4.1 nenhuma. Changelog 2.1.169: "plugin `.in_use` PID lock files … swept once per day". Explica a data mais nova que a do `.orphaned_at` | Alta |
| `installed_plugins.json`: `version: 2`; por id, lista de `{scope, installPath, version, installedAt, lastUpdated, gitCommitSha}` | Leitura do arquivo | Alta |

Consequência da igualdade: quem tem "1.6.0" de um commit antigo não recebe nada ao fixar a tag `productivity-tools--v1.6.0`. Reforça "nenhum número reaproveitado" de DEC-036.

### Em aberto

- A descida vista de fato.
- Se `claude plugin marketplace update` aplica um ref trocado nas configurações ou só a sessão o faz.
- O que acontece ao voltar para uma versão cuja pasta ainda existe como órfã.

### Experimento mínimo (10 min, custo zero, não precisa de login)

O único ref remoto é `origin/main` (1.6.0); não há tags. O commit `6ff49a3`, já no remoto, tem a 1.5.0, cuja pasta não existe no seu cache. Você envia uma tag descartável nele (ato seu) e roda isolado:

```powershell
git -C D:\projects\claude-play tag probe-pt-1.5.0 6ff49a3
git -C D:\projects\claude-play push origin probe-pt-1.5.0

$env:CLAUDE_CONFIG_DIR = "$env:TEMP\cc-probe\cfg"
$env:CLAUDE_CODE_PLUGIN_CACHE_DIR = "$env:TEMP\cc-probe\plugins"
mkdir $env:CLAUDE_CONFIG_DIR, $env:CLAUDE_CODE_PLUGIN_CACHE_DIR
claude plugin marketplace add odeciojunior/claude-play
claude plugin install productivity-tools@claude-play
claude plugin list --json                                   # 1.6.0
## conferir que ~\.claude\plugins\installed_plugins.json não mudou de data
## editar $env:CLAUDE_CONFIG_DIR\settings.json: em extraKnownMarketplaces.claude-play.source, acrescentar "ref": "probe-pt-1.5.0"
claude plugin marketplace update claude-play
claude plugin update productivity-tools@claude-play         # esperado: "updated from 1.6.0 to 1.5.0"
claude plugin marketplace add odeciojunior/claude-play#probe-pt-1.5.0   # só se o update não pegou o ref: ver a mensagem
## tirar o "ref", repetir os dois updates: volta à 1.6.0; olhar .orphaned_at nas duas pastas
git -C D:\projects\claude-play push origin :refs/tags/probe-pt-1.5.0
```

Feche o terminal ao fim, para as duas variáveis não vazarem.

### Tabela de decisão

| Resultado | Mudanças |
|---|---|
| **A.** Desce para a 1.5.0 e o ref troca pelas configurações (esperado) | DEC-036 fica como caminho de volta. Acrescentar à linha: "Fixar a loja numa tag (campo `ref` em `extraKnownMarketplaces`) é alívio individual, citado na nota de atualização; não substitui a volta." Em "Revisitar quando", tirar a cláusula da sonda de versão. Fecha a linha de E17 em "Questões em aberto". Nota de atualização (E11): "Para ficar na versão anterior enquanto a correção não sai: acrescente `\"ref\": \"productivity-tools--v<versão>\"` à fonte da loja `claude-play` em `extraKnownMarketplaces`, rode `claude plugin marketplace update claude-play` e `claude plugin update productivity-tools@claude-play`; isso fixa os três plugins da loja." Risco 2 de E13: "manter a tag da versão anterior e a receita de fixação na nota" |
| **B.** "already at the latest version" (contraria o código lido) | DEC-036 fica sem acréscimo. Linha de E17 fecha com "versão menor não desce; a volta por versão maior é o único caminho" |
| **C.** Desce, mas o ref só troca removendo a loja | DEC-036 fica; a nota diz que fixar exige remover e readicionar a loja, o que desinstala os três plugins e apaga opções e dados, e por isso não é recomendado |

### Lugar no roadmap

Não precisa de peça em E14 nem em E17. É um experimento solto, que pode rodar hoje, e fecha uma linha de "Questões em aberto" com um acréscimo em DEC-036.

---

## Roteiro de uma sentada (cerca de 1h, US$ 3 a 6 mais centavos)

1. Copiar `…\scratchpad\q-execucao\` para uma pasta estável.
2. **Ponto 3 (10 min, zero):** tag descartável em `6ff49a3`, os comandos isolados, anotar as três mensagens, apagar a tag, fechar o terminal.
3. **Ponto 2 (30 min, em segundo plano):** gerar o sandbox e pedir o primeiro `plan-only E1`.
4. **Ponto 1 (15 min, enquanto o passo 3 roda):** linhas 1 a 5 em `wfp1`, `wfp2`, `wfp3`; guardar `%TEMP%\wfprobe-hook.log` e o `settings.local.json` de `wfp1`.
5. **Ponto 2, segunda metade:** plantar o defeito, commitar, anotar o blob, segundo `plan-only E1`, rodar `mine-resume.mjs`.
6. Levar os resultados às três tabelas e pedir ao tracker as linhas de decisão e a revisão da estratégia.

---

## Perguntas que são suas

**1. A skill deve conceder o próprio workflow por `allowed-tools`, como o plugin da Anthropic?**

- (a) Não: nome mais regra informada pelo preflight. **Recomendado.** Mantém DEC-035 ("o plugin não aprova sozinho") e a política do repositório de não usar `allowed-tools`.
- (b) Sim, se a linha 5 da sonda mostrar que funciona. Na prática é a autoaprovação que DEC-035 descartou, por outro mecanismo.

**2. A skill mantém o caminho como reserva quando o nome não é conhecido?**

- (a) Sim, com `compatibility` declarando a versão mínima da CLI. **Recomendado**; é o padrão do `code-modernization`. Serve a quem roda em bypass ou CLI antiga.
- (b) Não: só nome, e erro claro em CLI antiga.

**3. Como contar a detecção com 4 defeitos por artefato?**

- (a) Manter 4 por artefato, com três desfechos e os defeitos pegos por código contados à parte. **Recomendado**; mesmo custo.
- (b) Um defeito por artefato: atribuição limpa, cerca de 4 vezes o custo da detecção.
- (c) Como está: mais simples, mas infla as capturas.

**4. Trocar os defeitos de plano 1, 6 e 8?**

- (a) Trocar pelos da lista do revisor. **Recomendado**: 15 das 40 tentativas deixam de ser constantes.
- (b) Manter e reportar em duas colunas.

**5. A fixação por tag entra na nota de atualização?**

- (a) Sim, como alívio individual, se o experimento der o resultado A. **Recomendado.**
- (b) Não: só a volta por versão maior.

**6. Rodar o experimento do ponto 2 agora ou dentro de E15?**

- (a) Agora, antes do spec de E1. **Recomendado**: a forma da medição entra no spec.
- (b) Como primeira tentativa de E15, com a regra de validade: economiza a execução, mas o spec de E1 nasce com a dúvida.
