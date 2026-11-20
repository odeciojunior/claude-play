# Retrospectiva: evolução das skills de produtividade (2026-11-10 a 2026-11-20)

2026-11-20. Fontes no repo (worktree `D:/projects/claude-play-wt/retro`, main `dae686b`), na memória do projeto e nos fatos da conversa do orquestrador com o dono (citados como "sessão"). Convenção: "anterior" é o roadmap de evolução das skills (`docs/plans/2026-11-10-roadmap-evolucao-skills.md`, pasta `docs/plans/roadmap-evolucao-skills/`); "pós-2.2.0" é o roadmap leve seguinte (`docs/plans/2026-11-15-roadmap-pos-2-2-0.md`, pasta `docs/plans/roadmap-pos-2-2-0/`). Todo ID de decisão traz o roadmap entre parênteses.

## 1. Resumo

- **Ponto de partida:** productivity-tools 1.6.0 (tag em `3fbb59b`, 2026-11-10). O objetivo eram sete frentes pedidas pelo dono para `roadmap-planner`, `roadmap-tracker`, `roadmap-release` e `plan-coordinator`: execução mais rápida, menos tokens, mais código determinístico, julgamento do LLM só onde é necessário, melhor uso de workflow, subagents que não param para perguntar, e spec e plano feitos pelo próprio plugin, sem o superpowers (estratégia v2.0 do anterior, "Objetivo").
- **Ponto de chegada:** cinco versões publicadas no período: 1.7.0 (2026-11-12), 2.0.0, 2.1.0 e 2.2.0 (as três em 2026-11-15) e 2.3.0 (2026-11-17). `origin/main` está em `dae686b`, com tags `productivity-tools--v1.6.0` a `--v2.3.0`.
- **O que o produto ganhou:** plano e spec com bloco de dados (`plan/1`, `spec/1`); estado do coordinator em `progress.json`, escrito só por script; coordinator e release rodando como workflows do plugin; skills `spec-writer` e `plan-writer`; 7 agentes próprios; independência do superpowers provada por teste; detecção de base de testes vermelha; modo `procs` para limpar processos; conferência das cargas e dos commits da spec (`docs/releases/*.md`).
- **Efeito medido:** contra a linha de base E15 (1.6.0), sonnet e opus não subiram em nenhuma variante. Em parada-retomada, opus caiu de 9 para 5 e o ponderado sem haiku de 660 para 420. A conta é paga em haiku e bytes: haiku foi de 9 para 22 (`docs/reports/2026-11-15-E13-medicao-final.md`).
- **Custo pago:** pós-2.2.0, US$ 24,33 de um teto de 40 (`docs/plans/roadmap-pos-2-2-0/measurements.md`). O anterior não registra um total. As linhas de `measurements.md` somam cerca de US$ 439 (conta do redator); somadas ao gasto de E17 (cerca de US$ 87,4, `log.md`) e às sondas de E11 que ficaram fora da tabela (US$ 14,89, `2026-11-15-E11-lote.md`), chegam perto de US$ 541. Ver seção 4.
- **O que ficou:** a troca do revisor por tarefa para opus (medida em E30, adiada para um roadmap com spec própria), dois defeitos do workflow do release, as pendências de roadmap futuro no `state.md` do pós-2.2.0, a branch local `volta/productivity-tools-2.3.1` e as transcrições pagas em `D:/claude-e30-out`, `D:/claude-e31-out` e `D:/claude-e33-out`.

## 2. Linha do tempo

| Versão | Data | Entregáveis | O que mudou para o usuário | Commit / tag |
|---|---|---|---|---|
| 1.6.0 (partida) | 2026-11-09/10 | Antes do período (`2169d24`, "productivity-tools 1.6.0") | `roadmap-release` novo; serviu de linha de base E15 | tag `v1.6.0` em `3fbb59b` |
| 1.7.0 | 2026-11-12 | E1 a E6, E14, E15, E17, E18, E22, E25 (`state.md` do anterior) | Formato do roadmap verificado por código, eventos do tracker por CLI, planner com scaffold e rubrica, formatos e ferramentas de spec e de plano, registro do release pela CLI, release lançado pelo nome, tracker enxuto (títulos dos cards). Nenhuma nota em `docs/releases/` | main `3fbb59b..73cd476`, publicado pelo dono (log do anterior, 2026-11-12); tag `v1.7.0` em `73cd476` |
| 2.0.0 (quebra) | 2026-11-15 | E7 a E12, E19 a E21, E23, E24 (E26 só medido) | Plano e spec só com bloco `plan/1`/`spec/1`, `progress.json`, coordinator como workflow, `spec-writer` e `plan-writer`, 7 agentes, Claude Code mínimo 2.1.322; migração por adoção (`docs/releases/2026-11-15-productivity-tools-2.0.0.md`). marketplace-tools 1.3.0 junto | main `1017db5`; tag `v2.0.0` criada na publicação da 2.1.0 |
| 2.1.0 | 2026-11-15 | E16, E28 e as pendências da 2.0.1 (E27 só medido) | Coordinator para diante de base de testes vermelha ou vazia; implementador na worktree; SHA só completo; `taskReview.single` existe, mas desligada e "não recomendada" | main `779bae0`; tag `v2.1.0` criada na publicação da 2.2.0 |
| 2.2.0 | 2026-11-15 | E13 | Nenhuma mudança de comportamento: teste de independência sobre os 140 arquivos do plugin, um exemplo de caminho corrigido, diagramas | main `b5812b3`; tag `v2.2.0` criada na publicação da 2.3.0 |
| 2.3.0 | 2026-11-17 | E29, E31 (correção), E32, E33 (E30 e E31 medidos) | `taskReview.single` removida (o preflight recusa a chave), modo `procs` do `verify-run`, conferência no git das cargas e dos commits da spec e do plano | publicado em `3d30412` (tag `v2.3.0`); 2º push só de docs leva main a `dae686b` (DEC-034 (pós-2.2.0)) |

Datas e SHAs: `git log --first-parent main`, `git tag`, `log.md` dos dois roadmaps. A tag de cada versão foi criada na publicação seguinte, não na própria.

## 3. Como trabalhamos

**Delegação.**
- **Decisões do dono via Fable.** Regra literal de 2026-11-12: "sempre que precisar de alguma decisao do dono, dispare um subagent fable para analisar as questoes e recomendar o melhor caminho, decida por estas recomendacoes" (memória `owner-decisions-via-fable.md`; sessão). No pós-2.2.0 isso virou a DEC-006 (pós-2.2.0): DEC-007 a DEC-036 foram ratificadas por esse caminho. A exceção é a DEC-018 (pós-2.2.0), emenda do próprio dono. No anterior, 91 das 779 linhas de `decisions.md` citam "dono via Fable" ou "por delegação".
- **Conferências interativas por opus headless.** Regra de 2026-11-12 (memória `interactive-checks-via-opus-headless.md`). Exemplos: a conferência P4 de E11 (4 sessões `claude -p`, US$ 4,25) e a S3-01, a loja fixada numa tag, conferida sem custo (`log.md` do pós-2.2.0).
- **bypassPermissions** quando há problema de permissão (memória `bypass-on-permission-problems.md`). O escopo ficou restrito à orquestração e às medições em sandbox descartável (sessão).
- **Roteamento de modelos** pelo CLAUDE.md global: haiku para o mecânico, sonnet como padrão, opus para julgamento, opus/high no portão final; Fable só para as decisões do dono (sessão).

**Dogfooding.** Os entregáveis foram executados pelo próprio `release-workflow` (relatórios `*-run.md`: E9, E10, E12, E21, E23, E24, E29, E31). O estado foi mantido pelo `roadmap-tracker` (linhas "passou para executando/na-branch" e BLQ-1 a BLQ-14 em `log.md`), e o pós-2.2.0 nasceu do `roadmap-planner` em modo leve (DEC-001 (pós-2.2.0)). O `plan-coordinator` foi medido como variante dos lotes, mas os logs não registram seu uso para executar trabalho do próprio roadmap. E33 rodou fora do workflow por decisão (DEC-032 (pós-2.2.0)).

**Medições pagas.**
- Rodaram em config descartável (`CLAUDE_CONFIG_DIR`, `D:/claude-e17-cfg` no anterior e `D:\claude-pos22-cfg` no pós-2.2.0), com o plugin por `--plugin-dir` e o superpowers fixado em 7.0.0 (relatórios de E11, E16, E30).
- Antes de cada lote ficavam fixados a regra de decisão, as paradas e o teto. Exemplos: as regras R1 a R3 de E30 no desenho `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`; a regra por lente da passada C (DEC-770 a DEC-772 (anterior)); o orçamento de E30 e E31 (DEC-021 (pós-2.2.0)).
- Exceção: as execuções do release (E9 em diante) usaram, por decisão, a config real do dono com `--max-budget-usd 150` (DEC-567 (anterior)).

**Publicação.** Cada versão teve autorização explícita do dono, pedida na hora (sessão; log do anterior para 2.1.0 e 2.2.0; DEC-034 (pós-2.2.0) para a 2.3.0). Cada versão também teve roteiro de publicação, nota em `docs/releases/` (a partir da 2.0.0), branch de volta com G1 a G5 verdes (`volta/productivity-tools-1.7.1`, `-2.1.1`, `-2.2.1`, `-2.3.1`) e conferência do cache depois do update.

## 4. Medições

Custos tirados de `measurements.md` de cada roadmap, salvo indicação.

| Lote (roadmap) | O que mediu | Resultado | Custo US$ | Decisão |
|---|---|---|---|---|
| E14 sondas (anterior) | Viabilidade: permissão do Workflow, agente do plugin, fidelidade do plano, script pelo cache | Suposições da estratégia testadas | 10,18 | DEC-057 a DEC-061 (anterior), estratégia v1.1 |
| E1 plan-only (anterior) | Duas execuções plan-only da 1.6.0 | Plano semeado viável | 3,39 | Ferramentas de medição integradas |
| E15 linha de base (anterior) | 1.6.0 em todas as variantes | Detecção: plano 40/40, código 38/40; parada-retomada US$ 4,78 de mediana | 79,83 | Base de comparação de tudo o que veio depois |
| E17 ponto de medição (anterior) | 1.7.0 contra E15 | Liberado; lote de US$ 6,97 descartado; codigo-semeado-A parado por duas inválidas seguidas (US$ 52,4) | cerca de 87,4 (`log.md`; fora de `measurements.md`) | DEC-507 a DEC-509 (anterior); 1.7.0 publicada |
| E20 suíte de gatilho (anterior) | Gatilho das skills novas, haiku e opus | 22/24 na 2ª passada | 13,08 | DEC-581 (anterior) |
| E27 passada A (anterior) | Revisor por tarefa sonnet contra opus, sementes de código | 40/40 nos dois | 8,60 | Sonnet fica (DEC-699 (anterior)) |
| E8 sondas (anterior) | Sandbox plan-only e acceptEdits | 3 paradas por defeito do produto antes de aprovar | 9,04 | Correções e depois "aprovado" (DEC-717, DEC-721 (anterior)) |
| E26 peças 1 a 3 (anterior) | Laço de revisão de spec e de plano; modelo do autor do plano | Efeito teto (39/40, 40/40); autor no piso | 16,90 | Ficam os laços; autor opus (DEC-741 (anterior)) |
| E27 passada B (anterior) | Revisão restrita, adversarial, onda única | Teto; 0 refutações em 78 veredictos | 32,28 | Fica a completa; adversarial e onda única não entram (DEC-752 a DEC-755 (anterior)) |
| E11 (anterior) | Linha de base da 2.0.0 | 43/43 válidas, código 40/40; plan-only acima do teto de bytes | 113,04 (inclui 12,26 perdidos na config real) | Teto do plan-only vai a 90.000 (DEC-763 (anterior)) |
| E27 passada C (anterior) | Revisão única contra os dois laços | Única 18/40 contra 20/40; spec 11 contra 15; 0,331 contra 0,301 por tentativa | 6,32 | Ficam os dois laços (DEC-773 (anterior)) |
| E16 M16 (anterior) | 2.1.0, completo e coordinator | Medianas iguais às de E11 | 11,71 | Sem piora; 2.1.0 publicada |
| E13 final (anterior) | 2.2.0, parada-retomada e completo sem superpowers | 6 de 7 metas; salto de correção em parada-retomada reproduzido | 10,03 | Exceção nomeada; causa vai ao pós-2.2.0 (DEC-777, DEC-778 (anterior)) |
| E30 (pós-2.2.0) | Revisor por tarefa sonnet contra opus, sementes da passada C | Opus 28/40 contra 20/40, custo 1,56 vez; R3 inconclusiva | 9,22 de 16 | Opus aprovado; troca adiada; laço quality fica (DEC-023 (pós-2.2.0)) |
| E31 (pós-2.2.0) | Causa da correção extra em parada-retomada | Causa provável (n=1): achado sintético de haiku; x3 inválida por causa externa | 13,24 de 15 | Corrigir antes de E33 (DEC-025 (pós-2.2.0)) |
| E33 sonda (pós-2.2.0) | Prompt novo de commit com modelo real | Commits de primeira, `pending` vazio | 1,87 | Publicar (DEC-033 (pós-2.2.0)) |

Execuções do release que contam como gasto, embora não sejam medições (anterior): E21 38,37; E23 19,33 (sem o r2); E24 22,56; E10 30,05; E12 27,04. Total de 137,35. Já entram na soma de cerca de US$ 439. O custo das 3 execuções de E9 não foi lançado (nota S2-05 de `docs/reports/2026-11-15-E32-triagem-backlog.md`). Os entregáveis E2 a E6, E15, E18, E22 e E25 não têm custo de execução registrado.

## 5. O que funcionou

1. **Regra fixada antes do lote pago.** Ninguém reinterpretou um resultado depois de vê-lo:
   - Na passada C a regra por lente decidiu, mesmo com o total quase empatado (20 contra 18).
   - Em E30 o caso "1 captura marginal por braço" caiu no inconclusivo previsto, e o laço ficou.
   - Em E31 a DEC-024 (pós-2.2.0) disse antes da x4 o que cada desfecho fecharia.
2. **A medição barrou mudanças que pareciam boas:**
   - A revisão única custou mais e pegou menos defeitos de spec (DEC-773 (anterior)) e acabou removida na 2.3.0.
   - Adversarial e onda única não entraram (passada B).
   - O laço quality não saiu sem prova (E30 R3).
3. **A revisão final da branch inteira encontrou o que as revisões por tarefa deixaram passar:** em E33, 2 achados importantes no modo `procs` (encerrar processo alheio por porta com `taskkill /T`; `netstat` sem IPv6 e sem Windows localizado). Fontes: `log.md` do pós-2.2.0 e sessão.
4. **Sondas pequenas antes de gastar ou publicar.** A sonda de E33 (US$ 1,87) confirmou com modelo real o prompt de commit, que só tinha rodado com mocks. Em E8, as sondas acharam três defeitos do produto, a US$ 1,4 a 3,2 cada, antes da 2.0.0.
5. **Tetos respeitados:** pós-2.2.0 em 24,33 de 40; E30 em 9,22 de 16; E31 em 13,24 de 15, sem usar a reserva; E11 em 113,04 de 160; passada C em 6,32 de 25.
6. **Publicação reversível e explícita.** Cada versão saiu com branch de volta verde, roteiro com os comandos exatos e autorização do dono. Nenhum push sem ela (sessão).
7. **Contadores determinísticos como régua, em vez de dólar:**
   - Sonnet e opus não subiram contra E15 em nenhuma variante.
   - O custo do coordinator caiu de US$ 1,15 para 0,46 (E11).
   - A independência do superpowers virou teste executável, com mutações conferidas no portão (E13).
8. **Decisão via Fable deu ritmo.** O anterior fechou 28 entregáveis e 779 decisões em 6 dias (2026-11-10 a 2026-11-15). As ratificações não esperaram o dono, e as decisões guardam a alternativa descartada e um gatilho para revisitar.
9. **Triagem do backlog como entregável (E32).** As 47 notas foram conferidas contra código e log: 10 obsoletas, 1 corrigida, 36 pendentes com dono. Isso evitou carregar notas mortas para o roadmap seguinte.

## 6. O que deu errado ou custou caro

| # | Problema | Causa | O que mudou depois |
|---|---|---|---|
| 1 | Defeitos do workflow achados usando o workflow: E29 bloqueado no G1 (2175 para 2172 testes, 0 falhas, remoção intencional); o gates-fix gastou 2 rodadas opus sem poder resolver | O gate `tests` só compara o total | Fable viu que um teste removido cobria comportamento que fica; uma tarefa nova repôs 3 testes (DEC-016, DEC-017 (pós-2.2.0)). O defeito do gate foi para o backlog (`state.md` do pós-2.2.0) |
| 2 | A 2ª rodada de E29 parou antes do autor do plano (`edge-case-uncovered`) | A carga do plano congelado "sem spec" lê a spec pelo campo do próprio plano | Contornado chamando o `plan-author` à mão; pendente para um roadmap futuro (sessão; `state.md`) |
| 3 | Achados sintéticos de haiku: em E31, 7 de 20 cargas haiku vieram com erro de transcrição, e 2 delas viraram correções opus (cerca de US$ 0,72 só na S2) | Saída mecânica transcrita por modelo e aceita sem conferência. O Bash não mostrou o exit 1 de `git diff --cached --quiet`; o texto de `R_LOAD` ("checkExit = 1, emitExit = 2") induziu o valor errado | Correção de E31 (merge `8fcc042`; DEC-028 a DEC-030 (pós-2.2.0)): código de saída conferido contra o stdout e commit conferido no git. Sinal anterior não seguido: falhas de carga do plano custaram US$ 8,85 em E21 e 2,92 em E24 (`measurements.md` do anterior) |
| 4 | Morte externa de processo: a x3 de E31 morreu (exit 127) | Outra sessão rodou `release-bdesk.ps1`, que faz `Stop-Process -Name node -Force` | A x4 rodou com pré-voo e sentinela, criados ad hoc (sessão). Arnês formal pendente (`state.md`). Em E23, o r2 já tinha morrido "sem evento result, interrupção do host" |
| 5 | Premissa de custo errada: parada-retomada estimada em US$ 2,26 | O agregado da CLI pegava só a sessão de retomada | Medida em 3,54 a 4,76 em E31; premissa da estratégia v1.1 passa a cerca de US$ 4,0; orçamento refeito (DEC-021 (pós-2.2.0)) |
| 6 | Teto fixado sem sonda: o plan-only passou de 80.000 bytes | O teto da DEC-761 (anterior) não tinha medição prévia; os bytes extras eram de haiku (rótulo `other`) | Aceito e teto subido para 90.000 (DEC-763 (anterior)) |
| 7 | US$ 12,26 perdidos na config real (sondas P15 de E11) | O script removia `CLAUDE_CONFIG_DIR`; "erro do condutor, não do arnês" (`2026-11-15-E11-P15-sondas.md`) | Rodada refeita; tetos de E11 revistos (DEC-758 a DEC-760 (anterior)) |
| 8 | Colisão de IDs: E1 a E5 do pós-2.2.0 | O workflow lia os merges antigos `merge: E1..E5` da história como merges inacabados | Renumerados para E29 a E33 (`ccac3c5`) |
| 9 | Meta não atingida: 27 chamadas no completo contra a meta de 22 (E10) | O excesso é haiku de desenho; sonnet 9 e opus 5 não sobem | Aceita como não atingida (DEC-777 (anterior)); fora do pós-2.2.0 ("Não objetivos") |
| 10 | Uma correção introduziu defeito: a 2ª rodada de correção da revisão final de E33 criou órfãos | Ordem de encerramento dos processos | Toda rodada teve nova revisão opus/high; a 3ª corrigiu (sessão; `log.md` do pós-2.2.0) |
| 11 | Teto de tamanho do `roadmap-release.js` travou entregas: a T5 de E21 foi revertida (240.252 contra 240.000); a T4 de E24 não coube (BLQ-13) | Script único de workflow perto do limite de lançamento | Teto fixado em 250.000 LF sem aumento sem decisão do dono (DEC-647 (anterior)); metade de E21 virou E28. Hoje são 245.049 caracteres LF, depois das correções da revisão final de E33 (sessão; o `state.md` do pós-2.2.0 ainda cita 244.453, medido antes delas) |
| 12 | Lotes de E17 descartados ou parados (US$ 6,97 descartados; US$ 52,4 até a parada) | O arnês contava como válida a retomada parada no preflight | Nova razão inválida `retomada-sem-agentes` (`achados-1.7.0.md`) |
| 13 | O commit final do tracker do anterior ficou fora de main | A autorização cobria só a 2.2.0 (DEC-779 (anterior)) | Levado na 2.3.0; o pedido ao dono passou a incluir um 2º push só de docs (DEC-034 (pós-2.2.0)) |
| 14 | O pós-2.2.0 pagou para refazer transcrições | O anterior apagou as dele (texto de DEC-035 (pós-2.2.0)) | As transcrições de E30, E31 e E33 ficam até a spec do revisor opus e a nova linha de base |
| 15 | Ambiente compartilhado | Outras sessões mudavam o HEAD do checkout comum (memória `shared-working-tree-branching.md`); subagents não gravam arquivos com nome de relatório (memória `subagent-report-file-filter.md`) | Branch de base explícita ou worktree; o orquestrador escreve os relatórios |

## 7. Lições

1. **Nunca confie em campo transcrito por modelo barato: confira contra a fonte (git, stdout, exit code).** Fato: 7 de 20 cargas haiku erradas em E31; correções opus por achado sintético.
2. **Quando um defeito aparece duas vezes, trate a classe, não a ocorrência.** Fato: as falhas de carga já custavam US$ 11,77 em E21 e E24 antes de E31 isolar a causa.
3. **Fixe a regra de decisão, as paradas e o orçamento antes de pagar o lote.** Fato: passada C, E30 e E31 fecharam sem renegociar resultado.
4. **Meça a premissa de custo antes de orçar, e pela execução inteira.** Fato: 2,26 contra cerca de 4,0 em parada-retomada; teto do plan-only fixado sem sonda.
5. **Medição em máquina compartilhada precisa de pré-voo e sentinela de processos desde o início.** Fato: x3 de E31 morta por `Stop-Process -Name node` de outro projeto.
6. **Confirme o isolamento da config antes do primeiro token pago (variável de ambiente, plugins carregados, modelo servido).** Fato: US$ 12,26 perdidos na config real; E30 conferiu `message.model` e a loja carregada.
7. **A revisão final da branch inteira é obrigatória, mesmo com todas as revisões por tarefa verdes.** Fato: 2 importantes de segurança no `procs` em E33.
8. **Toda rodada de correção precisa de nova revisão.** Fato: a 2ª rodada de E33 criou órfãos.
9. **Um gate que só compara totais pune remoção legítima.** Prefira comparar nomes de testes contra a spec. Fato: E29 bloqueado por 3 testes a menos, com 2 rodadas opus perdidas.
10. **IDs de entregável devem ser únicos no repo, não só no roadmap.** Fato: renumeração de E1–E5 para E29–E33.
11. **Uma sonda barata com modelo real vale antes de publicar um prompt que só rodou com mocks.** Fato: sonda de E33 por US$ 1,87.
12. **Guarde as transcrições pagas até a última decisão que depende delas.** Fato: o pós-2.2.0 pagou para refazer o que o anterior apagou (DEC-035 (pós-2.2.0)).
13. **Acompanhe tetos estruturais (tamanho do script) como orçamento.** Fato: E21 e E24 bloqueados pelo limite do `roadmap-release.js`, que está em 245.049 de 250.000.
14. **Peça ao dono a autorização completa da publicação, inclusive o push de fecho do tracker.** Fato: o commit final do anterior ficou fora de main até a 2.3.0.
15. **Dogfooding acha defeitos reais. Reserve tempo e orçamento para corrigi-los no meio do roadmap.** Fato: os defeitos de E8, E11 (headSha truncado) e E29 só apareceram usando o próprio workflow.

## 8. Estado final

**Publicado.**
- productivity-tools 2.3.0: `origin/main` = `dae686b`; tags `productivity-tools--v1.6.0` a `--v2.3.0` no remoto. Os dois roadmaps estão concluídos (DEC-779 (anterior); `state.md` do pós-2.2.0).
- S3-01 conferida: `marketplace add "<url>#productivity-tools--v2.3.0"` instala a 2.3.0. A prova completa, com main em outro commit, ficou pendente.

**Só local** (conferido em 2026-11-20):
- Branch `volta/productivity-tools-2.3.1` (`67a7bfa`, conteúdo da 2.2.0 com versão 2.3.1). Não está no remoto. A branch `release/pos-2.2.0` também existe só localmente.
- Transcrições pagas: `D:/claude-e30-out`, `D:/claude-e31-out` e `D:/claude-e33-out`. Ficam até o próximo roadmap fechar a spec do revisor opus e a nova linha de base de parada-retomada (DEC-035 (pós-2.2.0)).

**Pendências do dono.**
- Nenhuma de limpeza: o dono fez o logout da config descartável e apagou `D:\claude-pos22-cfg`, `D:\claude-pos22-mkt`, `D:\claude-e30-work`, `D:\claude-e31-work` e `D:\claude-e33-work` (ausentes em 2026-11-20).
- Decidir quando abrir o próximo roadmap ("Executa: dono", `state.md` do pós-2.2.0).

**Entrada para o próximo roadmap** (detalhada em `docs/plans/2026-11-20-proximo-roadmap-plano.md`; fontes: pendências do `state.md` do pós-2.2.0 e `docs/reports/2026-11-15-E32-triagem-backlog.md`):
- Spec do revisor por tarefa opus, incluindo a S3-24 e a regra da R3 para 1 captura marginal por braço; precisa caber no limite do `roadmap-release.js`.
- Os dois defeitos do workflow: gate `tests` só por total; carga do plano congelado sem spec.
- Carga de spec e plano que não dependa de transcrição por modelo.
- Pré-voo e sentinela no arnês; regex do extrator que conta `*-fix-review` como correção.
- `procs`: ppid reaproveitado como prova de ancestralidade; caminho Linux nunca rodado num host real.
- Reuso da spec quando o autor commita.
- Nova linha de base paga de parada-retomada depois da correção de E31 (DEC-026 (pós-2.2.0)).
- As 22 notas com dono executor e a S3-13 da triagem E32.
