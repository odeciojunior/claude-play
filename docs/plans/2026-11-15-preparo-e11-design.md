# Preparo de E11: design

Data: 2026-11-15. Base: `release/roadmap-skills-v2` em `e7feeeb`. Escopo: o que precisa estar feito antes do lote pago de E11 (peça 1 do card, estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md:612`) e o acoplamento com a peça 3 de E26. Publicação, nota e volta (peças 3 e 4 do card) ficam fora, exceto o bump que o lote mede.

Restrição vigente: o lote de E27 B está rodando (porta 48731). Até ele terminar não roda G1, release workflow nem outro lote; escrever código em worktrees pode seguir; merge na release só entre lotes (DEC-710).

## 1. Fatos de partida (lidos no código e nos arquivos)

- E11 `nao-iniciado`, depende de E7 e E8 (`na-branch`) e de E15 (publicado). O painel ainda diz "Aguardar E7, E8 e E15": o tracker o atualiza quando o preparo começar.
- `pending-decisions`: 31 decisões do executor pendentes (DEC-707 a DEC-737). De contrato: DEC-711, DEC-714 e DEC-719 (E8, com dependentes iniciados) e DEC-724 (E26). E11 depende de E8, e uma decisão de contrato pendente segura os dependentes (estratégia:77). Publicar exige zero pendentes (estratégia:78; critério 3 do card).
- Plugin em 1.7.0 (`e38cb35`). Desde então mudaram 59 arquivos de `plugins/productivity-tools` e 2 de `plugins/marketplace-tools` (`lint-plugin.mjs` e o teste dele, +64 linhas).
- Config descartável `D:\claude-e17-cfg` existe: productivity-tools 1.7.0 (`e38cb35`), superpowers **7.0.2** (`22f0b46`), `autoUpdatesChannel: latest`. A linha de base de E15 usou superpowers 7.0.0 (`bb92a77`).
- `make-scenario.mjs:25-32`: as variantes semeadas do pipeline (`codigo-semeado-*`, `plano-semeado-*`, `correcao-semeada-*`) gravam spec e plano em `docs/superpowers/` (E5_PATHS). O release nativo lê `docs/plans/sandbox-E5/` (artifactPaths, DEC-537) e não vê esses artefatos. Só as variantes `*-nativo-*` usam NATIVE_PATHS.
- `scenario/coordinator-plan.md` (fixture da variante coordinator, de E1) não tem bloco de dados. O coordinator de hoje recusa esse plano (`plan-no-data-block`, `plan-coordinator/SKILL.md:21`).
- `run-baseline.mjs:17-28`: o plano fixo lista as variantes antigas e não repassa `--plugin-dir`. `run-batch.mjs` aceita `--plugin-dir`.
- `baseline.mjs:15-25`: classes `plano-semeado` e `codigo-semeado`; `isPlanVariant` só casa `plano-semeado-[AB]`. `checkpoint.mjs:116` grava as linhas de medição com `E17` fixo.
- `coordinator.js`: a pergunta do gate (`:1427`) e `failedNames` (`:639`, `:1420`) não têm teto; `runCmd` (`:1038`) não recusa comando acima de CMD_CAP (6.000, `:1112`); `progress.mjs:386-389` divide só os passos em páginas: a página 0 leva o estado sem os passos, e esse tamanho não entra na conta.
- N5-1/N5-2 (DEC-458) seguem abertos: nenhum commit depois de `3205067`. `agents/plan-author.md` (passo 4) é o mesmo agente que o release usa para escrever o plano.
- `ratifyE5Contract` (`run-batch.mjs:1391`) ratifica as decisões de contrato de E5 entre as sessões da parada-retomada (DEC-442). Com DEC-565, a retomada já não para por decisão de contrato do entregável selecionado.
- `rolesByLabel` por tentativa só separa review/fix/verify/other; o papel `gates` junta gate e gate-fix. Faltam, por tentativa, as rodadas de correção por tarefa, as falhas de gate e o modelo do autor do plano, que são os números da peça 3 de E26.

## 2. Itens de preparo

Tipo: **C** código, **D** decisão do dono, **F** conferência. "Antes" = precisa estar feito antes do lote.

| ID | Item | Fonte | Tipo | Antes |
|---|---|---|---|---|
| P1 | Ratificar DEC-711, DEC-714 e DEC-719 (contrato de E8; seguram E11) e, na mesma passada, as demais pendentes já decidíveis | estratégia:77-79; card E11 crit. 3 | D (ato) | sim |
| P2 | Teto de evento no coordinator: pergunta do gate até 600, `failedNames` até 50 + "+N" com marca de lista cortada, tail do baseline, página 0 contada, `runCmd` recusa > CMD_CAP | state.md:75; DEC-702 | C (plugins) | sim |
| P3 | N5-1 (passo 3 da adoção cola literais `## Adoção`, `--stat` e `summary`) e N5-2 (passo 4 do plan-author: valor não declarado entra como acrescentado/derivado; coluna sem campo ganha linha) | pendências:25-26; DEC-458 | C (plugins) | sim (D9) |
| P4 | Conferir P3: 1 `claude -p` até APPROVAL QUESTION, 1 recusa, spec do card; cadeia spec-writer → plan-writer com `check --roadmap` 0 | pendências:25,27,29; DEC-458 | F (paga) | antes de publicar |
| P5 | Variantes `codigo-nativo-A/B`: spec e plano nativos (NATIVE_SEEDS) + código T1..T3 com C1..C8 | pendências:17,20; make-scenario.mjs:25 | C (tools/measure) | sim (D2) |
| P6 | Parada-retomada: ratificação entre sessões por opção, com o desfecho gravado na tentativa | pendências:17,20; DEC-442; DEC-565 | C (tools/measure) | sim (D4) |
| P7 | `baseline.mjs`: `plano-nativo-*` e `codigo-nativo-*` entram nas classes `plano-semeado` e `codigo-semeado`; superpowers registrado por variante, com a divergência aceita quando uma decisão é citada | pendências:15; baseline.mjs:25,148 | C (tools/measure) | sim |
| P8 | `run-baseline.mjs`: plano de E11 (`--plan e11`) e repasse de `--plugin-dir`; `checkpoint.mjs`: `--deliverable` nas linhas | run-baseline.mjs:17; checkpoint.mjs:116 | C (tools/measure) | sim |
| P9 | Fixture do coordinator com bloco de dados (plan/1), mesmos 3 passos | SKILL.md:21; pendências:13 | C (tools/measure) | sim (D5) |
| P10 | Contadores da peça 3 por tentativa: correções por tarefa, gate-fix, modelo do autor (do `.meta.json`) | state.md:83; DEC-727 | C (tools/measure) | antes da peça 3 |
| P11 | Config descartável: superpowers fixado, atualização automática das lojas desligada, commit conferido antes de cada lote | pendências:14 | F + D6 | sim |
| P12 | Cópia de medição do plugin para a peça 3: commit local sobre M com `plan-author.md` em `model: sonnet`, nunca mesclado | DEC-727 | F | antes da peça 3 |
| P13 | Commit de versão M: productivity-tools 2.0.0 (DEC-028) e marketplace-tools na versão seguinte, nos dois lugares; linha 1 do checker se diferir do publicado (DEC-042) | estratégia:68; CLAUDE.md | C (plugins) | sim (D10) |
| P14 | G1 a G5 em M, entre lotes | card E11 DoD | F | sim |
| P15 | Sonda de 1 execução para cada variante nova (`codigo-nativo-A`, coordinator com fixture nova, `completo` por `--plugin-dir`) | DEC-709 (padrão) | F (paga) | sim |

Ficam para durante ou depois do lote (não seguram o preparo): trechos do registro ≤ 6.000 confirmados pelo digest (state.md:72); cwd das tarefas e Co-Authored-By duplo (state.md:82); critério do spec que contradiz ruling (pendências:12, DEC-403); meta de E23 na parada-retomada, opus 9→7 e ponderado 669→589 (pendências:19); custo do effort high do sonnet (DEC-207); haiku da parada-retomada contra DEC-508 e o registro repetido na retomada (pendências:16); gatilho de DEC-565; receita da loja por tag do GitHub para a nota (pendências:9, DEC-056); AskUserQuestion da adoção (pendências:24). A retomada review-owed do coordinator (state.md:76) vai para E28: a variante coordinator não retoma. `SANDBOX_RELEASE_RULES` (pendências:10) já tem `release-workflow`; o nome velho fica para não mudar o conjunto de `--allow` medido em E15 e E17. `spec-review-atual.md` (pendências:11) foi recopiado em E26 A; a classe spec não entra no portão, então basta conferir a seção de braços do checkpoint.

## 3. Tarefas de código

Teste antes em todas. No máximo 4 arquivos por tarefa. Executor sonnet/medium (T1). A revisão por tarefa segue o precedente: opus para `plugins/` (DEC-696, DEC-720) e sonnet para `tools/measure`. Portão opus/high no fim.

| Tarefa | Itens | Arquivos | plugins/? |
|---|---|---|---|
| T-A | P2 | `plan-coordinator/workflow/coordinator.js`, `plan-coordinator/scripts/progress.mjs`, `workflow/gate.test.mjs`, `scripts/progress.test.mjs` | sim |
| T-B | P3 | `skills/plan-writer/SKILL.md`, `agents/plan-author.md`, `skills/plan-writer/adoption-text.test.mjs` (novo) | sim |
| T-C | P5 | `tools/measure/make-scenario.mjs`, `make-scenario.test.mjs`, `defects/manifest.json` (só se a variante pedir entrada nova) | não |
| T-D | P6 | `tools/measure/run-batch.mjs`, `run-batch.test.mjs` | não |
| T-E | P7 | `tools/measure/baseline.mjs`, `baseline.test.mjs` | não |
| T-F | P8 | `tools/measure/run-baseline.mjs`, `run-baseline.test.mjs`, `checkpoint.mjs`, `checkpoint.test.mjs` | não |
| T-G | P9 | `tools/measure/scenario/coordinator-plan-native.md` (novo), `make-scenario.mjs`, `make-scenario.test.mjs` | não |
| T-H | P10 | `tools/measure/session-metrics.mjs`, `session-metrics.test.mjs`, `run-batch.mjs`, `run-batch.test.mjs` | não |
| T-I | P13 | `plugins/productivity-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md` (2 linhas), checker só se P13 pedir | sim |

Desenho:

- **T-A.** Constantes `GATE_Q_CAP = 600` e `NAMES_CAP = 50`. `capNames(list)` devolve `{ names, cut }` e acrescenta `+N`. O evento `baseline` grava `failedNamesCut: true` quando corta, e `tail` passa por `tailOf`. `runCmd` mede o comando e falha com o tamanho acima de CMD_CAP. `readPages` passa a contar a página 0 como o estado sem passos mais os passos dela. Testes: pergunta de 2.000 caracteres sai com 600; 80 nomes saem como 50 + "+30" com a marca; comando de 6.001 é recusado; página 0 com estado grande fica abaixo de READ_PAGE_CHARS.
- **T-B.** Só a redação do passo 3 da adoção e do passo 4 (modo adopt) do agente, nos termos de DEC-458. O teste de texto confere três literais: "cole literalmente", a regra do `--stat` acima de 200 linhas e "acrescentado ou derivado, nunca mantido". O modo unattended do agente, que o release usa, não muda de regra. Os bytes do prompt mudam, e por isso T-B entra antes do lote (D9).
- **T-C.** `codigo-nativo-A/B` em SEEDED: `{ class: 'code', set: 'e5' }` com spec e plano por `prepareNativeBranch(withPlan: true)`. T1 e T2 vêm de `scenario/e5/code`. T3 sem `src/index.mjs`, porque o plano nativo não o lista (`e5-native/plan.md:42`) e sobraria escopo extra, como o cabeçalho da sonda de E26. Os sentinelas C1..C8 não mudam: nenhum toca `index.mjs`. As variantes entram em `RELEASE_RUN_VARIANTS` com `paths: NATIVE_PATHS`. Teste: o cenário gerado tem o spec e o plano em NATIVE_PATHS, os 8 sentinelas presentes e a suíte verde fora dos defeitos esperados.
- **T-D.** `--ratify between|off` (padrão `between`, a ratificação atual). Com `off`, a tentativa grava `pendingAtResume` (ids). Se a retomada parar por decisão, a tentativa fica inválida `parou-por-decisao` (DEC-443 é o análogo).
- **T-E.** Mapa `CLASS_OF` por regex de variante, nativo incluído. `checkSameState` aceita superpowers divergente só por variante, com `--accept-superpowers DEC-xxx`, e grava a decisão no agregado.
- **T-F.** `E11_PLAN`: plan-only 5, coordinator 3 (ou 5, D5), completo 3, parada-retomada 3, plano-nativo-A/B 5+5 (estágio plan-review, braço atual, rodada única), codigo-nativo-A/B 5+5 (D2). `--plugin-dir` repassado a cada `runBatch`. `checkpoint --deliverable E11` (padrão E17, para não mudar a saída antiga).
- **T-G.** O mesmo texto dos 3 passos com bloco `plan/1` que passe em `plan-tool check`. O caminho `docs/plans/fixed-plan/plan.md` segue a descrição da skill. Nova constante; a antiga fica, para medir o lado 1.7.0 se D5 escolher (b). Teste: o check sai 0 e a fixture antiga segue byte a byte.
- **T-H.** Na tentativa: `piece3: { taskFixByTask: {t1:n,…}, gateFix: n, planAuthorModel }`. `gateFix` vem dos rótulos `gates*-fix*`; o modelo vem do `meta.model` do agente com rótulo `<E>:plan`. Teste com transcrições sintéticas.
- **T-I.** Só na preparação da publicação, depois de T-A..T-H mesclados (D10).

Bump: T-A, T-B e T-I tocam `plugins/`. A regra do repo (bump nos dois lugares) se cumpre uma vez, em T-I, com 2.0.0 (DEC-028). As correções de preparo entram sem bump próprio, como em DEC-696, DEC-702 e DEC-720 ("bump agora" foi descartado em DEC-720 por ser do preparo de E11). marketplace-tools precisa de bump porque `lint-plugin.mjs` mudou desde 1.2.0. T-C..T-H ficam em `tools/measure`, que não é publicado, e não pedem bump.

Conflitos: T-C e T-G (`make-scenario.mjs`) em série; T-D e T-H (`run-batch.mjs`) em série. T-F depois de T-E e T-C (usa os nomes das variantes).

## 4. Decisões do dono (para o Fable)

- **D1. Como o plugin é carregado no lote.** (a) loja fixada em M na config (como E17); (b) `--plugin-dir` de uma worktree destacada em M (como E8, E26 e E27). **Recomendo (b):** DEC-727 reaproveita as 3 completo de E11 como braço opus só se forem por `--plugin-dir` (senão são 3 execuções a mais); o conteúdo medido é o de M de qualquer forma. Pede T-F.
- **D2. Classe código.** (a) pipeline nativo `codigo-nativo-A/B`, 5+5 válidas, igual a E15 e E17 ("classe código pelo pipeline", roteiro E17 §3); (b) arnês task-review (E27 já tem 40/40 e 39/40). **Recomendo (a):** o portão de DEC-017 compara igual com igual, e (b) mede só o revisor, não o release. (b) só se o teto de D8 não comportar (a).
- **D3. Classe plano.** (a) `plano-nativo-A/B` em rodada única em M, 5+5; (b) reusar a peça 2 de E26 (`e2b7e11`). **Recomendo (a):** cada lote fixa o SHA medido (DEC-710), o medido é o publicado (DEC-702), e o custo é baixo (seção 6).
- **D4. Ratificação na parada-retomada.** (a) manter (DEC-442); (b) `--ratify off`, que exercita a exceção de DEC-565 com a decisão pendente. **Recomendo (b):** é o caminho que o usuário percorre, e o gatilho de DEC-565 cita esta variante. Se a retomada parar por decisão, a tentativa é inválida e volta ao dono.
- **D5. Base do coordinator.** A fixture velha é recusada; o coordinator virou workflow (E12), e E15 variou com a skill idêntica (sonnet 2→3, bytes 1.423→5.378, turnos 17→26). (a) comparar com E15 usando a fixture nova e liberar bytes e turnos por decisão (DEC-033); (b) medir o lado antes em 1.7.0 (`e38cb35`) com a fixture nova, 5 execuções por lado; (c) coordinator só informativo neste portão (E13 o mede como workflow). **Recomendo (b):** compara igual com igual e responde à variância com n=5.
- **D6. Versão de referência do superpowers.** (a) voltar a 7.0.0 (`bb92a77`) com a atualização desligada; (b) aceitar 7.0.2 (`22f0b46`) por decisão citada (T-E); (c) desinstalar (DEC-005). **Recomendo (a):** iguala a linha de base, e o release nativo não deve chamá-lo. T-E fica como rede de segurança.
- **D7. Gatilho do spec-3 (E20).** (a) contar o despacho a spec-author como rota do plugin; (b) repetir spec-3 pt/en numa config sem CLAUDE.md de usuário. **Recomendo (a):** o portão de DEC-581 já foi cumprido (log, 22/24), e a config copia o CLAUDE.md real para ficar igual a E15.
- **D8. Teto do lote de E11.** DEC-003 não fixa teto, mas os lotes recentes têm um. **Recomendo** US$ 100 para o lote sem a peça 3, US$ 10 por sessão completo (`--max-budget-usd`, DEC-728) e US$ 10 para P4 e P15, com parada se a sonda projetar acima. Base na seção 6.
- **D9. Quando entra N5-1/N5-2.** (a) antes do lote; (b) depois do lote e antes de publicar (DEC-458 exige só antes de publicar). **Recomendo (a):** o `plan-author.md` que o release roda muda de bytes. Medir antes faria o medido diferir do publicado (DEC-702) e trocaria o arquivo da cópia da peça 3.
- **D10. Commit medido.** (a) M = commit de versão 2.0.0, como o M de E17 (`roteiro.md`, "commit de versão"); (b) medir antes do bump e versionar depois. **Recomendo (a):** M fica idêntico ao que será publicado, e a volta (crit. 4) parte dele.

## 5. Peça 3 de E26 no lote de E11

- **Braço opus:** as 3 completo válidas do lote de E11 em M por `--plugin-dir` (D1). Sem D1 (b), são 3 execuções à parte (gatilho de DEC-727).
- **Braço sonnet:** 3 completo válidas, mesmo SHA, comando e config, com `--plugin-dir` na cópia de P12. É lote próprio, depois do lote de E11, nunca junto (DEC-710, DEC-728). Teto US$ 25 (DEC-728).
- **Antes das outras execuções:** conferir na 1ª tentativa do sonnet `piece3.planAuthorModel = sonnet` (T-H) ou o `.meta.json` (state.md:83). Se não for sonnet, o lote para.
- **Regra:** sonnet só entra sem piora em `taskFixByTask` e `gateFix` e fora do piso (DEC-727). Com o cenário de 3 tarefas no piso nos dois braços, mantém opus. Se o dono quiser baixar o custo do plano, mede-se de novo com spec real de 6 tarefas ou mais (gatilho de DEC-727).
- **Dependências:** P10 e P12. Com D9 (a), a cópia deriva do `plan-author.md` já corrigido.
- **Decisão:** a linha da política só nasce na passada de ratificação, já com a resposta do dono (risco do card E26). Assim não sobra pendência que segure a publicação.

## 6. Custo: tetos e projeção (só números de fonte)

| Fonte | Variante | Valor |
|---|---|---|
| E15, só válidas (measurements.md) | plan-only 5 / coordinator 3 / completo 3 / parada 3 / plano A+B / código A+B | 7,03 / 0,91 / 11,03 / 14,37 / 1,89+1,68 / 21,39+21,53 = **US$ 79,83** |
| E17, mediana × n (comparacao.md; aproximação) | mesmas + planner | 6,03 / 1,16 / 9,94 / 13,06 / 3,29 / 36,01 / 0,96 ≈ **US$ 70,5** |
| Release nativo, 1 execução | 3º plan-only (af782a4) / completo da 2ª sonda (c5658cf) | US$ 1,44 / US$ 3,24 |
| E26 peça 2 (laço, 10 válidas) | plano-nativo A+B | US$ 7,04 |
| Inválidas da classe código em E15 | 5 de 15 (33,3%); custo não lançado ("só válidas") | - |
| Tetos já decididos | peça 3 de E26 25 (DEC-728); sessão completo 10 (DEC-728); release real 150 (DEC-567) | - |
| Referência para P4 | conferência claude -p do critério 4 de E20 (log) | US$ 2,2 |

Projeção com D2 (a), D3 (a) e D5 (b): da ordem de E15/E17 (US$ 70,5 a 79,8 só válidas). Somam-se as inválidas da classe código, sem custo de fonte, e o lado 1.7.0 do coordinator: 5 × 0,3864 ≈ US$ 1,9 (mediana E17). Por isso o teto recomendado em D8 é US$ 100. Com D2 (b), a classe código sai do pipeline e a referência passa a ser US$ 1,23 por 10 tentativas sonnet (DEC-708). Total do preparo com a peça 3: até US$ 100 + 25 + 10.

## 7. Ordem de execução

1. **Agora, com o lote de E27 B rodando:** D1 a D10 ao Fable. Código em worktrees: T-A, T-B, T-E e T-G em paralelo; depois T-C, T-D, T-H e T-F (seção 3). Sem G1 nem merge.
2. **Fim do lote de E27 B:** passada de ratificação (P1), com DEC-711, DEC-714 e DEC-719 no mínimo. O tracker passa E11 a `executando`.
3. **Merges na release,** em série e entre lotes, com G1 a G5 a cada um. Portão opus/high das fixes de `plugins/`.
4. **P4,** conferência de N5-1/N5-2 (claude -p), entre lotes.
5. **T-I:** commit de versão M (2.0.0 e marketplace-tools), G1 a G5 em M (P14), worktree destacada em M.
6. **P11:** config com superpowers fixado (D6), atualização desligada e commits registrados.
7. **P15:** sondas de 1 execução. Se uma sonda for inválida por defeito do arnês, corrigir e repetir antes do lote.
8. **Lote de E11** em série: `run-baseline --dry-run`, depois o plano E11; com D5 (b), o lado 1.7.0 do coordinator. Durante o lote, as conferências da lista "durante".
9. **Peça 3 de E26:** P12 e o braço sonnet, em lote próprio.
10. **Agregar e comparar:** `baseline.mjs` e `checkpoint.mjs --deliverable E11`. Resultado em `docs/reports/` e `measurements.md`.
11. **Ratificação final** (zero pendentes) e, então, as peças 3 e 4 de E11 (nota, volta, publicação: dono).
