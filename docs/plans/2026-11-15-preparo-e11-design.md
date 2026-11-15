# Preparo de E11: design

Data: 2026-11-15. Base: `release/roadmap-skills-v2` em `e7feeeb`. Escopo: o que precisa estar feito antes do lote pago de E11 (peça 1 do card, estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md:612`) e o acoplamento com a peça 3 de E26. Publicação, nota e volta (peças 3 e 4 do card) ficam fora, exceto o commit de versão que o lote mede.

Restrição vigente: o lote de E27 B está rodando (porta 48731). Até ele terminar não roda G1, release workflow, suíte do sandbox nem outro lote; escrever código em worktrees pode seguir; merge na release só entre lotes (DEC-710).

## 1. Fatos de partida (lidos no código e nos arquivos)

- E11 `nao-iniciado`, depende de E7 e E8 (`na-branch`) e de E15 (publicado). O painel ainda diz "Aguardar E7, E8 e E15": o tracker o atualiza quando o preparo começar.
- Ratificação: DEC-711 e DEC-714 ratificadas; DEC-719 ratificada com a emenda DEC-751. Seguem pendentes as demais decisões do executor anteriores a DEC-741. Publicar exige zero pendentes (estratégia:78; critério 3 do card).
- Plugin em 1.7.0 (`e38cb35`). Desde então mudaram 59 arquivos de `plugins/productivity-tools` e 2 de `plugins/marketplace-tools` (`lint-plugin.mjs` e o teste dele). `check-roadmap.mjs` não mudou desde `e38cb35`.
- Config descartável `D:\claude-e17-cfg`: productivity-tools 1.7.0 (`e38cb35`), superpowers **7.0.2** (`22f0b46`), `autoUpdatesChannel: latest`. A linha de base de E15 usou superpowers 7.0.0 (`bb92a77`).
- `make-scenario.mjs:25-32`: as variantes semeadas do pipeline gravam spec e plano em `docs/superpowers/` (E5_PATHS), que o release nativo não lê (artifactPaths, DEC-537). O código legado de `scenario/e5/code` não serve ao spec nativo:
  - `truncate` usa `text.length`/`slice`, contra o ruling R2 (code points; `scenario/e5-native/spec.md:31,78`);
  - os testes legados não têm os casos do plano nativo;
  - C3 e C5 ancoram em literais legados;
  - C4 lê e regrava `src/index.mjs` no seed, e o plano nativo não tem `index.mjs`.
- A pasta da 2ª sonda (`D:/claude-e8q-work`) não existe mais. Só as sementes copiadas em `scenario/e5-native/` restam.
- Assuntos de commit: o release conta as tarefas por `^E5 T(\d+): ` (`roadmap-release.js:2124`). `taskTitles` (`make-scenario.mjs`) só casa `### Task n:`, não `### Tarefa n:`.
- `scenario/coordinator-plan.md` não tem bloco de dados, e o coordinator de hoje recusa esse plano (`plan-no-data-block`, `plan-coordinator/SKILL.md:21`).
- `run-baseline.mjs:17-28`: plano fixo com as variantes antigas, sem repasse de `--plugin-dir`. Em `:109-113`, o commit é lido da instalação (`readPlugin`) contra `--tag`, então com `--plugin-dir` a execução sai 2. `baseline.mjs:350` filtra e confere a completude por BASELINE_PLAN; `isPlanVariant` só casa `plano-semeado-[AB]`. `checkpoint.mjs:116` grava as linhas com `E17` fixo.
- `coordinator.js`: a pergunta do gate (`:1427`) e `failedNames` (`:639`, `:1420`) não têm teto; `runCmd` (`:1038`) não recusa comando acima de CMD_CAP (6.000, `:1112`); `progress.mjs:386-389` não conta o tamanho do estado na página 0.
- N5-1/N5-2 (DEC-458) seguem abertos. `agents/plan-author.md` é o agente que o release usa para o plano.
- Por tentativa, `rolesByLabel` só separa review/fix/verify/other, e o papel `gates` junta gate e gate-fix. Faltam os contadores da peça 3 de E26.

## 2. Itens de preparo

Tipo: **C** código, **D** decisão (já tomada), **F** conferência. "Antes" = precisa estar feito antes do lote.

| ID | Item | Fonte | Tipo | Antes |
|---|---|---|---|---|
| P1 | Passada de ratificação das pendentes decidíveis (contrato de E8 já feito) | estratégia:77-79; DEC-751 | D (ato) | sim |
| P2 | Teto de evento no coordinator: pergunta do gate até 600, `failedNames` até 50 + "+N" com marca de corte, tail do baseline, página 0 contada, `runCmd` recusa > CMD_CAP | state.md:75; DEC-702 | C (plugins) | sim, antes de M |
| P3 | N5-1 (passo 3 da adoção cola literais) e N5-2 (passo 4 do plan-author: acrescentado/derivado; coluna sem campo ganha linha) | pendências:25-26; DEC-458; DEC-744 | C (plugins) | sim, antes de M |
| P4 | Conferir P3: 1 `claude -p` até APPROVAL QUESTION, 1 recusa, spec do card; cadeia spec-writer → plan-writer com `check --roadmap` 0. Se falhar, o gatilho de DEC-458 manda a impressão da aprovação para a ferramenta e muda os bytes do plugin (DEC-702) | pendências:25,27,29; DEC-744 | F (paga, US$ 10) | sim, antes de M |
| P5 | Código limpo nativo, C1..C8 portados com entradas `set: e5-native` (obrigatórias) e variantes `codigo-nativo-A/B` | DEC-745; pendências:17,20 | C (tools/measure) | sim |
| P5c | Conferência local antes de qualquer pago: suíte verde no limpo; cada C presente após a semeadura e ausente no limpo; nenhuma acusação por código (check da ferramenta); assuntos `E5 T<n>:` | DEC-745 (gatilho); DEC-724 | F (sem custo, entre lotes: a suíte usa a porta) | sim |
| P6 | Parada-retomada com `--ratify off`; `parou-por-decisao` é inválida e encerra a variante | DEC-746 | C (tools/measure) | sim |
| P7 | `baseline.mjs`: plano de E11, classes nativas e superpowers por variante | DEC-745; pendências:15; baseline.mjs:25,350 | C (tools/measure) | sim |
| P8 | `run-baseline.mjs` (plano de E11, `--plugin-dir`, commit pela pasta) e `checkpoint.mjs` (`--deliverable`, lado antes do coordinator trocável) | DEC-744; DEC-747; DEC-016 | C (tools/measure) | sim |
| P9 | Fixture do coordinator com bloco plan/1, mesmos 3 passos | DEC-747; SKILL.md:21 | C (tools/measure) | sim |
| P10 | Contadores da peça 3 por tentativa: correções por tarefa, gate-fix, modelo do autor | state.md:83; DEC-727; DEC-741 | C (tools/measure) | antes da comparação da peça 3 |
| P11 | Config: superpowers fixado em 7.0.0 `bb92a77` com atualização desligada; commit conferido antes de cada lote. Saída de DEC-747: 2 falhas na fixação valem 7.0.2 fixado, citando DEC-747; commit diferente antes de um lote para o lote. Pasta de M e `--work` com caminho de comprimento ≥ ao de E15 (os caminhos entram nos bytes; tolerância 3%, DEC-033) | DEC-747; pendências:14 | F | sim |
| P12 | Cópia de medição para a peça 3 (`plan-author.md` em sonnet, commit local sobre M, nunca mesclado), só se o braço opus sair do piso | DEC-727; DEC-741 | F | condicional |
| P13 | Commit de versão M: productivity-tools 2.0.0 e marketplace-tools 1.3.0, nos dois lugares; linha 1 do checker não muda | DEC-028; DEC-744 | C (plugins) | sim |
| P14 | G1 a G5 em M, entre lotes | card E11 DoD | F | sim |
| P15 | Sondas, 1 execução cada (válida com o mesmo M, arnês e config conta como 1ª tentativa, DEC-749). Lista abaixo da tabela | DEC-744 a DEC-747, DEC-749 | F (paga) | sim |
| P16 | Proposta de bytes por variante com os números das sondas, decidida antes do lote. Subida conhecida: plan-only 1 em E15, 3 em E17, 8 a 11 nas sondas de E8; completo 7→13. O haiku já está liberado nas condições de DEC-750 | DEC-750 | D (pendente de proposta) | sim |

Sondas de P15:

- `codigo-nativo-A`;
- `parada-retomada` com `--ratify off` (nunca rodou no release nativo);
- coordinator em M e em 1.7.0 com a fixture nova (a de 1.7.0 decide a fixture, DEC-747, e é evidência do critério 6 do card);
- `completo` por `--plugin-dir`: conferir nas transcrições que os scripts vêm da pasta de M, não do cache 1.7.0 (a precedência é só inferida; gatilho de DEC-744).

Regra de identidade de M (DEC-744): o lote só roda com `git diff M..HEAD -- plugins/` vazio. Fix só do arnês depois de M vale; fix do produto gera novo M, G1-G5 e sondas.

Ficam para durante ou depois do lote:

- trechos do registro ≤ 6.000 confirmados pelo digest (state.md:72);
- cwd das tarefas e Co-Authored-By duplo (state.md:82);
- negações espontâneas e limpeza incompleta (state.md:81), com destino na nota da 2.0.0 e em E28 ou fix próprio (DEC-751);
- critério do spec que contradiz ruling (pendências:12, DEC-403);
- meta de E23 na parada-retomada, opus 9→7 e ponderado 669→589 (pendências:19);
- custo do effort high do sonnet (DEC-207);
- registro repetido na retomada (pendências:16);
- gatilhos de DEC-565 e DEC-746;
- receita da loja por tag do GitHub para a nota (pendências:9, DEC-056);
- AskUserQuestion da adoção (pendências:24).

Fora do lote:

- a retomada review-owed do coordinator (state.md:76) vai para E28;
- `SANDBOX_RELEASE_RULES` fica como está, para manter o conjunto de `--allow` medido;
- `spec-review-atual.md` só é conferido na seção de braços do checkpoint;
- o spec-3 já tem regra (DEC-748).

## 3. Tarefas de código

Teste antes em todas. No máximo 4 arquivos de código por tarefa; dados contados à parte (DEC-730). Executor sonnet/medium. Revisão por tarefa opus para `plugins/` (DEC-696, DEC-720) e sonnet para `tools/measure`. Portão opus/high no fim.

| Tarefa | Itens | Código | Dados | plugins/? |
|---|---|---|---|---|
| T-A | P2 | `plan-coordinator/workflow/coordinator.js`, `plan-coordinator/scripts/progress.mjs`, `workflow/gate.test.mjs`, `scripts/progress.test.mjs` | - | sim |
| T-B | P3 | `skills/plan-writer/SKILL.md`, `agents/plan-author.md`, `skills/plan-writer/adoption-text.test.mjs` (novo) | - | sim |
| T-C1 | P5 | `tools/measure/native-code.test.mjs` (novo) | `scenario/e5-native/code/t1..t3/{src,tests}` (6) | não |
| T-C2 | P5 | `defects/sentinels/native/C1..C4.mjs` (até 3 novos, só os de âncora trocada), `defects/native-sentinels.test.mjs` (novo) | `defects/manifest.json` (C1..C4 `set: e5-native`) | não |
| T-C3 | P5 | `defects/sentinels/native/C5..C8.mjs` (até 3), `defects/native-sentinels.test.mjs` | `defects/manifest.json` (C5..C8) | não |
| T-C4 | P5 | `tools/measure/make-scenario.mjs`, `make-scenario.test.mjs` | - | não |
| T-D | P6 | `tools/measure/run-batch.mjs`, `run-batch.test.mjs` | - | não |
| T-E | P7 | `tools/measure/baseline.mjs`, `baseline.test.mjs` | - | não |
| T-F | P8 | `tools/measure/run-baseline.mjs`, `run-baseline.test.mjs`, `checkpoint.mjs`, `checkpoint.test.mjs` | - | não |
| T-G | P9 | `tools/measure/make-scenario.mjs`, `make-scenario.test.mjs` | `scenario/coordinator-plan-native.md` (novo) | não |
| T-H | P10 | `tools/measure/session-metrics.mjs`, `session-metrics.test.mjs`, `run-batch.mjs`, `run-batch.test.mjs` | - | não |
| T-I | P13 | `plugins/productivity-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md` (2 linhas) | - | sim |

Desenho:

- **T-A.** `GATE_Q_CAP = 600`, `NAMES_CAP = 50`. `capNames(list)` devolve `{ names, cut }` com `+N`. O evento `baseline` grava `failedNamesCut`, e `tail` passa por `tailOf`. `runCmd` falha com o tamanho acima de CMD_CAP. `readPages` conta a página 0 como o estado sem passos mais os passos dela. Testes: pergunta de 2.000 caracteres sai com 600; 80 nomes saem como 50 + "+30"; comando de 6.001 é recusado; página 0 grande fica abaixo de READ_PAGE_CHARS.
- **T-B.** Redação do passo 3 da adoção e do passo 4 (modo adopt), nos termos de DEC-458. O teste de texto confere "cole literalmente", a regra do `--stat` acima de 200 linhas e "acrescentado ou derivado, nunca mantido".
- **T-C1.** Código limpo escrito pelo plano nativo (`scenario/e5-native/plan.md`): T1 slugify, T2 truncate em code points (R2), T3 word-count, cada um com os testes do plano. O teste confere que a suíte do sandbox fica verde com T1..T3 e que nenhum arquivo fica fora da lista de arquivos do plano.
- **T-C2 e T-C3.** C1..C8 portados para o código limpo, com entradas `set: e5-native` no manifest. Um sentinela novo só nasce quando a âncora legada não casa. C4 extrai e importa helpers de um arquivo de T3, sem `index.mjs`. O teste confere cada C presente após o seed e ausente no limpo. Um C que não porta sem acusação por código ganha id novo e volta ao dono (DEC-745).
- **T-C4.** `codigo-nativo-A/B` em SEEDED (`class: 'code'`, `set: 'e5-native'`). `prepareNativeBranch(withPlan: true)` cria a branch, e T1..T3 nativos são commitados com assunto `E5 T<n>: <título>`. `taskTitles` passa a aceitar `### Tarefa n:` e o título do bloco de dados. As variantes entram em `RELEASE_RUN_VARIANTS` com `paths: NATIVE_PATHS`.
- **T-D.** `--ratify between|off`, com padrão `between`. Com `off`, a tentativa grava `pendingAtResume`; uma retomada parada por decisão vira `parou-por-decisao`, inválida, e encerra a variante (DEC-746).
- **T-E.** `--plan e11` com a lista de E11 no filtro e na completude da linha 350. O mapa `CLASS_OF` leva `plano-nativo-*` e `codigo-nativo-*` às classes `plano-semeado` e `codigo-semeado`. O superpowers é registrado por variante; a divergência é aceita com `--accept-superpowers DEC-xxx`, gravada no agregado.
- **T-F.** `E11_PLAN`:
  - planner 1 e tracker 1 (DEC-016);
  - plan-only 5;
  - coordinator 5 em M e 5 em 1.7.0, com `--out` próprio para o lado 1.7.0;
  - completo 3 e parada-retomada 3 (`--ratify off`);
  - plano-nativo-A/B 5+5 (plan-review, atual, rodada única);
  - codigo-nativo-A/B 5+5.

  `--plugin-dir` é repassado a cada `runBatch`. Com ele, `:109-113` usa `readPluginDir(pluginDir).commit` contra `--tag M`. `checkpoint --deliverable E11` (padrão E17). `--before-coordinator <agregado 1.7.0>` troca o lado antes da variante coordinator, e o relatório registra a troca.
- **T-G.** Os mesmos 3 passos com bloco `plan/1` que passe em `plan-tool check`, em `docs/plans/fixed-plan/plan.md`. A fixture antiga fica byte a byte, para o caso de DEC-747 cair nela em 1.7.0.
- **T-H.** Na tentativa: `piece3: { taskFixByTask, gateFix, planAuthorModel }`. `gateFix` vem dos rótulos `gates*-fix*`; o modelo, do `meta.model` do rótulo `<E>:plan`. Teste com transcrições sintéticas.
- **T-I.** productivity-tools 1.7.0 → 2.0.0 e marketplace-tools 1.2.0 → 1.3.0, em `plugin.json` e na linha do README. `check-roadmap.mjs` sem diff desde `e38cb35`, então a linha 1 fica. O commit resultante é M, e a regra de identidade da seção 2 vale a partir dele.

Bump: T-A, T-B e T-I tocam `plugins/`. A regra do repo se cumpre uma vez, em T-I. As correções de preparo entram sem bump próprio (DEC-696, DEC-702, DEC-720) e antes de M (DEC-744). T-C1..T-H ficam em `tools/measure`, não publicado.

Conflitos em série:

- T-C1 → T-C2 → T-C3 → T-C4, e T-G antes ou depois de T-C4 (`make-scenario.mjs`);
- T-D → T-H (`run-batch.mjs`);
- T-F depois de T-E e de T-C4;
- T-I por último.

## 4. Decisões vigentes que este preparo segue

- **DEC-744:** `--plugin-dir` de worktree destacada em M; versões; N5-1/N5-2 e P4 antes de M; identidade de M.
- **DEC-745:** classes de detecção pelo release nativo em M.
- **DEC-746:** `--ratify off` na parada-retomada.
- **DEC-747:** coordinator 5+5 e superpowers 7.0.0.
- **DEC-748:** spec-3.
- **DEC-749:** tetos.
- **DEC-750:** haiku liberado de antemão e bytes decididos antes do lote.
- **DEC-751:** emenda a DEC-719.
- **DEC-741:** piso da peça 3 de E26.

Falta só a proposta de bytes de P16, depois das sondas.

## 5. Peça 3 de E26 no lote de E11

- **Braço opus:** as 3 completo válidas do lote de E11 em M por `--plugin-dir` (DEC-744).
- **Piso (DEC-741):** braço opus com 0 correções por tarefa e 0 falhas de gate. Saber se ele está no piso exige os contadores de P10 (T-H), que seguem necessários.
- **No piso:** o braço sonnet não roda. Registra-se sonnet com 0 execuções, e fica opus.
- **Fora do piso:** P12 (cópia sonnet) e 3 completo válidas no mesmo SHA, comando e config. É lote próprio, depois do lote de E11 (DEC-710, DEC-728), com teto US$ 25. A 1ª tentativa confere `planAuthorModel = sonnet`; se não for sonnet, o lote para. Sonnet só entra sem piora (DEC-727).
- **Decisão:** a linha da política só nasce na passada de ratificação, já com a resposta do dono.

## 6. Custo: tetos e projeção (só números de fonte)

| Fonte | Variante | Valor |
|---|---|---|
| E15, só válidas (measurements.md) | plan-only 5 / coordinator 3 / completo 3 / parada 3 / plano A+B / código A+B | 7,03 / 0,91 / 11,03 / 14,37 / 1,89+1,68 / 21,39+21,53 = **US$ 79,83** |
| E17, mediana × n (comparacao.md; aproximação) | mesmas + planner | 6,03 / 1,16 / 9,94 / 13,06 / 3,29 / 36,01 / 0,96 ≈ **US$ 70,5** |
| Release nativo, 1 execução | 3º plan-only (af782a4) / completo da 2ª sonda (c5658cf) | US$ 1,44 / US$ 3,24 |
| E26 peça 2 (laço, 10 válidas) | plano-nativo A+B | US$ 7,04 |
| Inválidas da classe código em E15 | 5 de 15 (33,3%); custo não lançado | - |
| Projeção de DEC-749 | com inválidas, coordinator nos dois lados, planner e tracker | US$ 80 a 95 |
| Tetos vigentes (DEC-749, DEC-728) | lote com sondas 120; por sessão pipeline 10, plan-only 5, arnês e coordinator 3; P4 10; peça 3 de E26 25 | - |

Total do preparo pago: até US$ 120 + 10 + 25 = **US$ 155**, sendo os 25 só se o braço opus sair do piso. Parada: projeção acima de 120 depois das sondas, ou gasto em 120 com variante incompleta, volta ao dono; o lote retoma do que está em `--out` (DEC-749).

## 7. Ordem de execução

1. **Agora, com o lote de E27 B rodando:** código em worktrees: T-A, T-B, T-E e T-C1 em paralelo; depois as séries da seção 3. Sem G1, suíte do sandbox nem merge.
2. **Fim do lote de E27 B:** P1, ratificação. O tracker passa E11 a `executando`.
3. **Merges na release,** em série e entre lotes, com G1 a G5 a cada um. Portão opus/high das fixes de `plugins/`. P5c roda logo depois do merge de T-C4.
4. **P4,** conferência de N5-1/N5-2 (até US$ 10). Se falhar, vale o gatilho de DEC-458 antes de M.
5. **T-I:** commit de versão M; G1 a G5 em M (P14); worktree destacada em M; `git diff M..HEAD -- plugins/` vazio.
6. **P11:** superpowers 7.0.0 fixado, atualização desligada, caminhos de comprimento ≥ ao de E15, commits registrados.
7. **P15:** sondas. Inválida por defeito do arnês: corrigir no arnês (M vale) e repetir. Defeito do produto: novo M.
8. **P16:** proposta de bytes com os números das sondas, decidida pelo dono antes do lote (DEC-750).
9. **Lote de E11** em série: `run-baseline --plan e11 --dry-run`, depois o lote, e o lado 1.7.0 do coordinator em `--out` próprio. Durante o lote, as conferências da lista "durante".
10. **Peça 3 de E26:** P10 classifica o braço opus. Fora do piso, P12 e o braço sonnet em lote próprio; no piso, registro com 0 execuções.
11. **Agregar e comparar:** `baseline.mjs --plan e11` e `checkpoint.mjs --deliverable E11 --before-coordinator ...`. Resultado em `docs/reports/` e `measurements.md`.
12. **Ratificação final** (zero pendentes) e, então, as peças 3 e 4 de E11 (nota, volta, publicação: dono).
