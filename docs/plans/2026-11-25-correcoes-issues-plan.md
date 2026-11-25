# Plano de correções das issues abertas (#1 a #29)

Data: 2026-11-25 (revisado no mesmo dia). Branch de referência: `release/pos-2.3.0`, sem diferença de `main` em `plugins/` e `tools/measure/` nos arquivos citados.

## Como foi feito

1. As 29 issues abertas, com corpo e comentários, foram lidas com `gh issue view --comments`.
2. **Validação:** um subagente sonnet (esforço medium, somente leitura) por issue conferiu o defeito contra o código e propôs a correção.
3. **Revisão:** um segundo subagente sonnet por issue releu a issue e os comentários e confrontou o texto deste plano com o código. As 29 revisões voltaram com "ajustar" e nenhuma com "errado". As correções estão incorporadas abaixo.
4. O orquestrador conferiu à mão o único veredito negativo (#27), o teto de tamanho do workflow e as quatro afirmações de revisão de maior impacto (#6, #8, #19, #24).

Limites: defeitos que dependem de modelo (cópia pelo haiku: #3, #18, #20) e de binário externo (`agy`: #9, #11, #14, #16) foram confirmados pelo mecanismo no código, não reproduzidos. As linhas são as do branch atual. Os caminhos curtos são relativos a `plugins/productivity-tools/` (`skills/roadmap-release/...`, `scripts/...`, `lib/...`), salvo quando indicado. O `roadmap-release.js` fica em `skills/roadmap-release/workflow/`.

## Resultado

| # | Assunto | Veredito | Tam. | Risco | Bloco |
|---|---|---|---|---|---|
| 1 | Motivo opaco de dependência sem segmento `code` | Confirmada | P | baixo | B |
| 2 | Portões `kind: "exit"` fora da medida de base | Confirmada | P | baixo | A |
| 3 | Cópia não literal da captura (ANSI, hashes); extract sem vitest | Confirmada | M | médio | A |
| 4 | Descoberta em fatias com branch mudando | Confirmada | P (mínimo) / M (SHA) | baixo / médio | A |
| 5 | `release.config.json` do alvo defasado sem aviso | Confirmada | P | baixo | B |
| 6 | `baseline-invalid` sem motivo por portão | Confirmada | P | baixo | A |
| 7 | Workflow pelo nome carrega o clone do marketplace | Parcial | P | baixo | B |
| 8 | Base inválida só falha depois da descoberta | Confirmada | G | alto | A |
| 9 | wsl-health-check: exit 127 no pwsh (agy) | Confirmada | P | baixo | G |
| 10 | Testes usam `bash` do PATH (System32) | Confirmada | P | baixo | D |
| 11 | Docs de distribuição global no agy | Parcial | P | baixo | G |
| 12 | agy: `test-extract.mjs` antes do flash | Confirmada | P | baixo/médio | G |
| 13 | agy: `CAPTURE:`, `review-package.mjs` e itens do E39 | Confirmada | M | médio | G |
| 14 | agy: mapear ferramentas Claude Code | Confirmada | P | baixo | G |
| 15 | agy: paridade E36/E37 (`removedTests`, piso, blob) | Confirmada | G | médio/alto | G |
| 16 | agy: empacotamento nativo | Parcial | P (só spec) | baixo | G |
| 17 | Retomada finish-merge ignora `removedTests` | Confirmada | M | médio/alto | B |
| 18 | script-runner perde aspa ao recopiar | Parcial | P (A) / M (B) | médio | C |
| 19 | Campo `gate` de `removedTests` sem explicação | Confirmada | P | baixo | B |
| 20 | Cópias pelo haiku repetem | Parcial | M | médio | C |
| 21 | run-batch não fixa o modelo da sessão principal | Confirmada | P–M | baixo | E |
| 22 | run-batch sem transcrições nem SHA256SUMS | Confirmada | P–M | baixo | E |
| 23 | `aggregate.json` sem `attemptCostUsd` | Confirmada | P | baixo | E |
| 24 | `capture.mjs` assina com checksum público | Confirmada | M | médio | F (viabilidade em aberto) |
| 25 | Completar amostra da DEC-060 | Confirmada (acompanhamento) | P + medição | baixo | E |
| 26 | Resíduos do arnês do E30 | Confirmada | M | médio | E |
| 27 | `plan-frozen-tasks` falso por formato de emit | Não reproduz | — | — | Fechar |
| 28 | `maxParallel 1` em config gerado | Parcial | P | médio | B |
| 29 | lint não confere `allowed-tools` em `commands/` | Confirmada | P–M | baixo | D |

## Restrições que valem para todos os blocos

- **Tamanho do workflow.** O `roadmap-release.js` tem 266.001 caracteres (LF; 269.424 bytes no disco). O teto é de 300.000 e o gatilho de 290.000 (`size.test.mjs:12`, DEC-003/DEC-034). Restam cerca de 24 mil caracteres, que A1, A3 (completo), A4, A5, B1, B4, B6 e C1 dividem. Medir em toda tarefa que toque o arquivo. A cifra de 266.673 da #17 não é o teto.
- **Arquivos quentes.** `roadmap-release.js` (A1, A3 completo, A4, A5, B1, B4, B6, C1) e `skills/roadmap-release/scripts/preflight.mjs` (A3, B2, B3) recebem tarefas uma por vez, cada arquivo em sua fila.
- **Fixtures.** Não alterar `tools/measure/fixtures/workflow-com-single/roadmap-release.js` nem `scripts/fixtures/plan-tool/workflow-copy.js`, a menos que a tarefa diga.
- **Embed.** Toda edição em `lib/` exige `node plugins/productivity-tools/scripts/embed.mjs --check <alvos>`. Os 4 alvos estão em `.claude/rules/workflows-and-lib.md`. Os módulos de `lib/` não importam nada nem usam APIs de Node.
- **Versão.** Não subir a versão nas tarefas (DEC-042).
- **agy.** O bloco G mexe no acoplamento com o Antigravity e só roda com pedido direto do dono (regra global de 2026-11-22).

## Bloco A: medida de base e captura (roadmap-release), prioridade 1

As issues #2, #3, #6 e #8 descrevem a mesma falha. O preflight acusa `baseline-invalid` só depois da descoberta inteira e não diz o motivo. A instrução diz que os portões `exit` não precisam de captura, mas o validador exige a captura. E a cópia literal pelo modelo erra hashes.

**A1 (#2, #6 e parte de #3), P, risco baixo/médio, `roadmap-release.js`:**
- `:1960`: trocar o sufixo `' (only name, ran and exit matter)'` por um texto que exija a linha de captura também nos portões `exit`.
- Passar `--brief` ao `capture.mjs run` dos portões, como o prompt de tarefa já faz (`:617-623`). O `--brief` entra entre `--cwd` e `--bash`, para continuar casando com `CAP_LINE` (`flow.test.mjs:184`). Revisar `flow.test.mjs:312-331` e `prompts.test.mjs:503`.
- `checkCapture` (`:1537-1550`) passa a devolver, de forma aditiva, `{ ok, why, expected, got }` (nonce e cmdDigest). A função é compartilhada (`:844`, `:2499`, `:2941`).
- `gateFromCapture` (`:189-203`) repassa esses dados em vez de devolver `null`. Hoje devolve `null` também quando `exit` não é inteiro; `ran: false` fica de fora.
- `capturedMeasure` (`:204-207`) guarda o motivo em `m.gateWhy`, fora de `gates`. O campo tem de sobreviver ao `S_MEASURE` (`:1698`) e ao `validMeasure`.
- `measureProblems` (`:664-676`, mensagem em `:672`) anexa o motivo, o cmdDigest esperado contra o recebido e o `path` da captura.
- O consumo fica em `:1997` (`preflight:baseline-invalid`). `measuredGroup` (`:2024-2028`) mede duas vezes e descarta a primeira, então o `gateWhy` vem da última tentativa e acumula o motivo da primeira (`retry: ...`).
- Aceite: um portão `exit` com captura literal entra na medida, e um portão com cópia adulterada acusa o motivo específico. A #2 sozinha não zera o `baseline-invalid`, porque a #3 continua (dono, comentário da #2).
- Testes:
  - a mensagem de `baseline-invalid` traz o motivo (nonce, cmdDigest, digest adulterado), em `merge.test.mjs:28` e `gates.test.mjs:234`;
  - a frase nova aparece na linha dos portões `exit`, e a antiga não;
  - portão `exit` com captura válida passa (`gates.test.mjs:197`).

**A5 (#3, correção definitiva pedida pelo dono nos 3 comentários), M, risco médio, logo depois de A1:**
- O workflow lê a linha assinada de `pt-evidence/<seq>-line.json`, que o `capture.mjs` já grava. O agente devolve só o caminho, e o `checkCapture` valida o conteúdo do arquivo.
- Com o `--brief`, a linha ainda traz `digest`, `cmdDigest`, `sha256` e `nonce` para copiar. O comentário 3 mostra o modelo trocando `digest` por `cmdDigest` numa linha de cerca de 550 bytes. Por isso A1 e A2 só reduzem a taxa de erro, e A5 é o que a elimina.
- Ajustar a fixture `scripts/fixtures/plan-tool/workflow-copy.js`, que copia o `checkCapture`.
- Teste do caminho de leitura por arquivo.
- Estimar o custo em caracteres antes de começar.
- A5 não depende do bloco F.

**A2 (#3, extrator), P, risco baixo, `scripts/test-extract.mjs` e `scripts/capture.mjs`:**
- Em `test-extract.mjs`, o formato é decidido em `:115-128`. Remover ANSI (`/\x1b\[[0-9;]*m/g`) antes de decidir e reconhecer o resumo do vitest 4 (`Tests  97 passed (97)`, `Test Files ...`, falhas e skipped).
- Em `capture.mjs`, rodar o processo filho com `NO_COLOR=1` e `FORCE_COLOR=0`. Tirar o ANSI do `tail` e do texto do extract antes do `sign` (`buildLine`, `:358-395`), e nunca do `stdout.txt` gravado, que é a evidência com sha256.
- Testes: saída do vitest 4 com e sem cor (`total` 97) e `tail` sem ANSI.

**A3 (#4), `skills/roadmap-release/scripts/preflight.mjs`:**
- **Mínimo (P), em série com B2 e B3 no mesmo arquivo:**
  - A fatia 0 grava no envelope o SHA lido de `ref`.
  - Se `slice >= envs.length` (`:664-668`), a mensagem passa a ser "o branch `<ref>` mudou durante a descoberta (de X para Y); rode de novo", como pedido no comentário do dono.
  - Nota em `SKILL.md` e `references/operator.md`: não comitar no branch base enquanto o roadmap-release roda. Uma descoberta perdida custa cerca de 23 agentes e 250 mil tokens.
  - O workflow já percebe leituras diferentes pelo `total.sha256` (`roadmap-release.js:1517`). A falha atual acontece porque o índice da fatia passa do total antes dessa checagem.
- **Completo (M, risco médio, toca o `roadmap-release.js`, então entra na fila dele):**
  - Resolver `ref` e `base` para SHA (`git rev-parse --verify <ref>^{commit}`) e aceitar `--at <sha>` nas fatias seguintes, cobrindo também `mergeOf` e `readRoadmapTexts` (`:476-490`). Com `ref` nulo a leitura vem da árvore de trabalho e não tem proteção.
  - No workflow, `discCmd` (`:1794`) e `readSlices` (`:1799`) repassam o SHA. O cabeçalho assinado é conferido por `checkSlice` (`lib/plan-digest.mjs:205`, cópia embutida em `roadmap-release.js:1491`), então exige o embed e `discovery-slices.test.mjs`.
- Testes: commit entre as fatias, com contagem de fatias menor e com a mesma contagem mas conteúdo diferente. O teste afirma a mensagem nova (mínimo) ou a leitura estável (completo).

**A4 (#8), G, risco alto, revisão T2, depois de A1, A3 e A5:**
- O preflight depende da descoberta: `TARGET = A.targetBranch || CFG.releaseBranch || disc.releaseBranch || integracao/${disc.roadmapSlug}` (`:1836`), o passo 1 do preflight cria o branch e o worktree (`:1967-1968`), e `BASEBR`/`order` vêm da seleção (`:1860`). Por isso, antecipar a medição dos portões só quando o alvo vier explícito em `args` ou no config. Sem isso, manter a ordem atual ou medir num worktree próprio no SHA do alvo.
- Não antecipar em `dry-run`, que retorna em `:1894`. Conferir o `MIN_BUDGET` (`:1895`) antes de medir.
- Guardar a base válida em cache fora do `run.json` (por exemplo em `.git/`), com chave (alvo, SHA, gatesKey, `envFacts`), assim que o preflight passar. Hoje `run-record.mjs:72` grava a base só no `approve`. O `exit 1` sem saída de `run-record baseline` (`:88`, `:99`) é o esperado quando não há registro, não um defeito.
- Atenção ao `runToken` da leitura da descoberta (`:1583-1584`) e ao cache de `resumeFromRunId`.
- Opcional: `mode: "baseline-only"`.
- Testes em `flow.test.mjs`:
  - `baseline-invalid` sem nenhum agente de descoberta (com alvo explícito);
  - acerto e invalidação do cache (SHA, gatesKey e `envFacts` diferentes);
  - `dry-run` sem preflight.

## Bloco B: diagnóstico, retomada e contratos (roadmap-release), prioridade 2

**B1 (#1), P, `roadmap-release.js:167`, e a nota de `:153` (`pending dependencies`), que tem a mesma opacidade:**
- Anexar `E4: <motivo>` para cada dependência faltante, com a guarda `byId[d] && byId[d].onTargetEvidence`. Um ID sem card não pode quebrar; o padrão já está em `:136`. O campo chega aos cards (`preflight.mjs:514`).
- Encurtar o caso "sem segmento code" para `status sem segmento code (várias peças)`. Hoje o motivo cru repete a célula Status inteira (`preflight.mjs:505`).
- Item firme, pedido do dono: aviso no checker para Status com várias peças e sem `code`. A regra espelha `codeWord` (`preflight.mjs:428`) e usa `parseStatusSegments` (`lib/roadmap-format.mjs:193`), mais o embed nos 4 alvos.
- Testes: o `reason` contém o motivo; uma dependência sem card não quebra; o skip continua em `skipped`; teste do checker para o aviso.

**B2 (#5), P, `preflight.mjs:547-553`:**
- Com `--ref` e `release.config.json` nos dois lados (alvo por `readRef`, árvore de trabalho por `readJson(configPath)`), comparar o JSON parseado.
- Se diferirem, `warnings.push` com as chaves divergentes e a frase "vale o do alvo".
- Pedido do dono no comentário: se o alvo for ancestral do base (`isAncestor`/`gitTry`, perto de `:425`), acrescentar "o alvo está N commits atrás do base; faça fast-forward".
- Sem config na árvore de trabalho, nenhum aviso.
- Reescrever o "used as is" de `SKILL.md:28` e de `references/config.md`.
- Testes em `scripts/preflight.test.mjs`, no modelo do teste de `:222`: configs diferentes, iguais, sem config na árvore, alvo ancestral.

**B3 (#7), P, docs e `preflight.mjs`:**
- **Antes de tudo:** confirmar qual cópia o nome do Workflow carrega. A confirmação é interativa e vai para uma sessão headless com subagente opus (regra de 2026-11-12).
- **Se for o clone,** documentar em `SKILL.md` (passo 4) e em `references/operator.md:71`:
  - editar o cache não tem efeito;
  - o fallback `scriptPath` `<dir>/workflow/...` carrega o cache, e não o clone;
  - o contorno é usar a cópia da sessão;
  - o limite de 213.337 vem do diálogo de aprovação. Esse ponto já está escrito; o dado novo é que, sem prompt, um `scriptPath` de 259.738 caracteres passou.
- Os asserts atuais de `skills/roadmap-release/workflow/docs.test.mjs:67-76` continuam valendo e o teste é estendido.
- No preflight (`:574`), medir também o clone. O caminho é `home` ou `CLAUDE_CONFIG_DIR` + `plugins/marketplaces/*/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`. Clone ausente não é erro.
- Avisar se o tamanho ou o hash diferir do cache e dar erro acima de 524.288 bytes. Hoje o cache 2.6.0 e o clone são iguais byte a byte; o cache 2.5.0 difere.
- Testes em `preflight.test.mjs` com `home` fictício: clone maior, diferente, ausente e de marketplace local.

**B4 (#17), M, risco médio/alto, revisão T2, `roadmap-release.js:2399-2415`:**
- O `test-extract.mjs removed` não serve na retomada. Ele exige `--output`/`--sha` de uma saída de portão, mais `--gate`, `--spec`, `--plan` e `--cwd` (`:169-190`), e rejeita um nome que ainda roda (`:229`). Além disso, `specLoad`/`planLoad` só existem a partir de `:2541`/`:2653`.
- **Decidir antes de codar:**
  - (a) estender o `test-extract` com um modo sem saída de portão, ou (b) uma verificação própria da retomada, por `git show` em `mergeSha^1` e em `mergeSha`;
  - a regra para `removedAsserts`. É uma contagem (`:1661`), sem mapa de nome para asserções. Por padrão, descontar só os arquivos de `deletedTests`, e não afrouxar `removedAsserts`.
- Função pura `integrityNetOfDeclared(integ, declared, verifiedPairs)`, que desconta só o que foi declarado e verificado (`file::name`) e mantém o resto como alerta duro.
- Testes:
  - declarada e verificada passa;
  - declarada sem verificação quebra, e não declarada quebra;
  - `acceptIntegrityAlerts` continua valendo;
  - um teste do ramo de retomada, e não só da função pura.

**B5 (#19), P, `agents/spec-author.md:35` e `agents/plan-author.md:36`:**
- Acrescentar uma frase: `gate` é o **`name`** do portão de testes no `release.config.json` (ex.: `"G1"`, e não o kind `"tests"`). O workflow passa `gate: name` (`roadmap-release.js:3077`) e o extrator compara `e.gate !== opt.gate` (`test-extract.mjs:205`).
- O campo é obrigatório quando há mais de um portão `kind: tests` sem `invariant` nem `ignoreFailuresWhenChanged` (`roadmap-release.js:3072`). Sem ele, o extrator acusa "gate obrigatório" (`test-extract.mjs:221`).
- Mandar o autor ler esses nomes no `release.config.json` (os passos de leitura em `spec-author.md:32-39` e `plan-author.md:34-40` não o incluem), ou passá-los no brief.
- Manter o literal `{ file, name, why, gate? }` (`agent-contracts.test.mjs:68-73`). Assert novo para a frase nos dois arquivos, mais o lint.

**B6 (#28), P, risco médio, revisão T2:**
- Em `roadmap-release.js:1613`, argumento `parallelOk: true`, aceito só em `args` e nunca no config. Com `generated: true`, `MAXPAR = intArg(A.maxParallel, 3, 1)` somente se `A.parallelOk === true`.
- Tirar o argumento de `resumeArgs` (`:3310`, `:3323`, que copiam `{...A}`), como já é feito com `approveRulings` (`:728`).
- Docs: `roadmap-release.js:32` (ARGS) e `:3341` (item 6 do relatório), `config.md:30,50`, `operator.md:82-89`, `SKILL.md:35,42`. O contorno atual, remover `generated` e comitar, continua valendo; o argumento serve a quem não quer comitar.
- Testes em `flow.test.mjs`, onde hoje nada cobre o `MAXPAR`: padrão 1; liberação pelo argumento; `CFG.parallelOk` ignorado; `resumeArgs` sem o argumento.
- **Exige uma DEC nova do dono.** A DEC-020 e a DEC-009 têm alcance local, então basta uma DEC nova, sem revogá-las.

## Bloco C: cópia literal pelo haiku, prioridade 3 (melhoria, exige medição)

**C1 (#18), opção A, P, risco médio:**
- O `shq` de `roadmap-release.js:898` deixa de pôr aspas em valores que casam `^[A-Za-z0-9_@%+=:,./-]+$`. Vazio continua `''`, e qualquer outro valor continua com aspas.
- A mudança alcança todos os usos: carregamento (`:2498`, `:2504`), tracker (`:975-1013`) e preflight (`:1794`). O `node "${CAP}"` (`:2491`) mantém as aspas duplas.
- O `commandDigest` é calculado sobre o argv (`:2499`), então a verificação não quebra.
- O `shq` duplicado em `skills/plan-coordinator/workflow/coordinator.js:1146` fica de fora, registrado.
- Testes: ajustar `cleanup.test.mjs:31-32`, `flow.test.mjs:5616`, o unitário do `shq` (`flow.test.mjs:3088-3091`) e o `unshq` (`:185`, `:312-329`). Casos novos: valor seguro, com espaço, com `\`, vazio e com `'`.
- O efeito sobre o haiku só se prova na medição paga (E5).
- A opção B, comando gravado em arquivo, é mais robusta. O custo M não foi medido.

**C2 (#20), M, risco médio:**
- A escada é `load3`/`loadVia` (`roadmap-release.js:2095`, `:2515-2520`, `:2638`): até 5 tentativas, com a 1ª e a 2ª em haiku e da 3ª à 5ª em sonnet. O `MAX_COPY_BYTES = 3500` está em `lib/plan-digest.mjs:30`. Os rótulos `-retryN` (`plan-load2`, `discovery-retry3`) são o que o contador da DEC-055 conta.
- Opções: fatia menor, 2ª tentativa já em sonnet, ou fatia 0 só com digest e caminho.
- Riscos: a fatia menor aumenta o número de chamadas (DEC-055); a 2ª tentativa em sonnet empurra o contador sonnet além do limite 11 da DEC-060.
- Testes: flow da nova escada ou do novo tamanho de fatia, mais `copy-budget.test.mjs` e `discovery-slices.test.mjs`.
- A prova é a medição paga do **E5 (#25)**. A5 pode reduzir a necessidade de C2.

## Bloco D: portabilidade de testes e lint, prioridade 2 (independente)

**D1 (#10), P, risco baixo, só testes:**
- Um helper único `gitBash()`: usa `PT_BASH` e, sem ela, `git --exec-path`. Devolve `null` (ou pula o teste) quando o Git Bash não existe.
- Reaproveitar o `gitBashPath()` que já existe em `flow.test.mjs:3077`, movendo-o para um módulo compartilhado de teste. A `findBash` de `capture.mjs:281` não é exportada.
- Usar em `capture.test.mjs:238` e em `load-slices.test.mjs:81` e `:185`.
- Opcional: alinhar `plugins/mcp-sql-server/scripts/setup.test.mjs:16`, que fixa o caminho do Git.
- Verificação: rodar as duas suítes em pwsh puro, sem mexer no PATH (41/41).

**D2 (#29), P–M, risco baixo, gatilho: o primeiro plugin com `commands/`:**
- Em `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`, o bloco `allowed-tools` fica em `:329-347` e a guarda de linhas cruas em `:306-327`. Extrair a checagem para uma função e aplicá-la a `commands/**/*.md` e aos caminhos customizados do `plugin.json`. Hoje o lint não descobre esses caminhos (`:274-278`); `agents/` fica fora.
- Padrão: recusar `allowed-tools` fora da exceção da DEC-049. A decisão do dono só é necessária se ele quiser permitir em commands.
- Teste em `lint-plugin.test.mjs`, com fixtures: command com `allowed-tools`, command sem, e caminho customizado.
- Atualizar `validate-plugin/SKILL.md` e `docs/claude-code-extensibility-reference.md:264`.

## Bloco E: arnês de medição (`tools/measure`), prioridade 3

Não é publicado, mas condiciona a próxima medição paga. Fazer antes dela.

**E1 (#21), `run-batch.mjs`:**
- Exigir `--model` em `parseCli` (`:2722-2740`), porque toda variante chama `claude -p` (`:2461`). Ajustar `baseOpts` (`run-batch.test.mjs:101`) e os testes de `parseCli`.
- Gravar no run e no aggregate `sessionModels: { parada, retomada }` e `modelDivergence`. O modelo efetivo é a família dominante de `message.model` das transcrições, via `session-metrics.mjs` (`:35`, `:121`, `:146`). A retomada é `sessions.slice(resumeFrom)` (`:2459`).
- Testes: `exec` simulado com parada em opus e retomada em sonnet dá `modelDivergence: true`; sem `--model` dá `UsageError`.
- Referência: DEC-058 (`docs/plans/roadmap-pos-2-3-0/decisions.md:62`).

**E2 (#22), `run-batch.mjs`:**
- Logo depois de registrar as sessões da tentativa (`:2535`), antes de qualquer `continue`, para incluir as tentativas inválidas: copiar de `<config>/projects/<slug>/` o `<sid>.jsonl` e a pasta `<sid>/` (subagents e journals; `:324`, `session-metrics.mjs:259`) para `private/transcripts/<k>/`.
- Depois de escrever o `aggregate.json` (`:2717`) e de parar o sentinel, gerar `SHA256SUMS` no formato `hash  caminho/relativo`, com `/`, ordenado, em LF e sem listar a si mesmo.
- Uma falha vira aviso.
- Teste com configDir fictício: transcrição de tentativa válida e de tentativa inválida, e hashes que conferem.

**E3 (#23), `run-batch.mjs`:**
- Gravar `attempt.costUsd = attemptCostUsd(attempt)` logo depois de montar o `attempt` (`:2653`), em toda tentativa válida, e não só no ramo lenses (`:2662`). Tentativa inválida não tem `rolesByLabel`.
- Acrescentar `aggregate.cost.total` (`:2708`), a soma das válidas.
- Manter `counters.cost`, que é só dos papéis e é lido por `baseline.mjs:122,236`. Comentar isso no código e em `.claude/rules/measure.md`.
- Teste perto de `run-batch.test.mjs:2101`: com `cliCostUsd` maior que os papéis, conferir `costUsd` e `cost.total`.

**E4 (#26), um teste por item:**
- **Gate vazio:** a regex está em `run-batch.mjs:1598`. Identificar a origem do formato `N tests, N pass, N fail` antes de reconhecê-lo. Testes perto de `run-batch.test.mjs:3553-3573`.
- **Regra inerte:** remover de `make-scenario.mjs:56` e ajustar os testes `:349` e `:499`.
- **`parentMention`:** campo no CR3 de `defects/manifest.json` (`:532-545`, texto de C5, DEC-753/`state.md:67`). `mentionStats` passa a usar `m.parentMention ?? m.mention`; os outros usos de `mention` (`:718`, `:1895`) ficam como estão. Teste novo.
- **`E5_PATHS` (por último, em separado, risco médio):** os usos estão em `make-scenario.mjs:208-213` e `:408`, em `run-batch.mjs:1057`, `:1121` e `:1374-1390`, nos fallbacks `scenario.paths ?? E5_PATHS` e em dezenas de testes. **Decidir o destino das variantes legadas** (plano-semeado e codigo-semeado) antes.

**E5 (#25), sem código, exige autorização de gasto:**
- Há 2 execuções válidas (3 e 4 do relatório E39). A execução 3 tem a ressalva da DEC-058, porque a retomada rodou em sonnet. Falta 1 válida para chegar a 3.
- Medir no commit que a DEC definir: antes de C1, C2 e A5, ou declarando que a base mudou. Não misturar "completar a amostra" com "nova base".
- Decidir os limites:
  - sonnet 11 ou 12 (a execução 4 deu 12 por gatilho explicado);
  - ponderado sem haiku, 420 contra 440;
  - se o haiku (49 a 50) ganha limite.
- O teto da DEC-053 já foi consumido (US$ 14,65 de 15, `measurements.md:13`). A DEC sucessora da DEC-060 fixa um teto novo e o gatilho de parada. A estimativa é de cerca de US$ 4,4 por válida e US$ 3 por inválida.
- Aceite: 3 válidas, `SHA256SUMS` (depende de E2), DEC registrada, relatório e `measurements.md` atualizados.

## Bloco F: assinatura da evidência, prioridade 3, viabilidade em aberto

**F1 (#24):**
- **O dono decide a viabilidade antes de qualquer código.** Quem assina é o `capture.mjs`, que roda pelo agente `script-runner` (haiku): `roadmap-release.js:2938`, `agentType: 'productivity-tools:script-runner'`. Qualquer segredo passado a esse processo (argv, ambiente, arquivo) fica legível pelo próprio agente, e o workflow não executa scripts sem agente. Sem um executor confiável, o HMAC não impede a fabricação e só aumenta o custo.
- Se houver caminho viável, a mudança inclui:
  - `capture.mjs:115-116,352-353`;
  - o `checkCapture` de `lib/plan-digest.mjs:251-262`, com SHA-256 em JS puro. `lib/` não usa APIs de Node; o workflow já tem `sha256Bytes` (`:1363`);
  - o embed nos 4 alvos e testes de integração, incluindo um teste em que um processo sem o segredo não consegue produzir a linha.
- O escopo, se avançar, cobre todos os digests `fnv1a`: `lib/plan-digest.mjs:180,214,233,262,273,286` e `scripts/progress.mjs`.
- Alternativa honesta: registrar numa DEC que o `fnv1a` é checksum de cópia (DEC-056) e que a falsificação por um agente está fora do modelo de ameaça.

## Bloco G: paridade e distribuição agy, só com pedido direto do dono

**G1, P, texto:**
- **#9.** No `skills/wsl-health-check/SKILL.md:12`, manter o comando POSIX e acrescentar a variante para pwsh: `wsl -e bash -lc 'p=$(wslpath -u "$1"); exec bash "$p" --full --no-color' -- "${CLAUDE_SKILL_DIR}/scripts/health-report.sh"`, com barras normais e nunca o `bash` do System32.
  - Atualizar a descrição (`SKILL.md:3`) e o README do plugin (`:26`, `:75`).
  - Preservar o CRLF do `SKILL.md`.
  - Não há teste do skill: verificar com lint, `independence.test.mjs` e uma execução manual no pwsh com exit 0.
- **#11.** Criar a seção "Antigravity (agy)" no `README.md` do plugin, que hoje não tem nenhuma menção ao agy:
  - (a) `skills.json` com caminho relativo a `~/.gemini/config/`, ou absoluto, e nunca `~/`;
  - (b) `--add-dir "<pasta do plugin>"` em `agy -p`, necessário porque spec-writer e plan-writer leem `agents/*.md` do disco (`spec-writer/SKILL.md:17`, `plan-writer/SKILL.md:28,38`);
  - (c) aviso de que `agy plugin validate` reprova os agents.
  - Escrever `<versão>` no lugar de número fixo. Verificar com `claude plugin validate` e lint.
- **#14.** Anexar a `AGY_TOOL_NOTE` ao prompt em `call_agent` (`roadmap-release-agy.py:207-213`) e no equivalente de `coordinator-agy.py:880`. Não alterar `load_agent_body`, porque o AC7 (`agy-bridge.test.mjs:266-272`) exige o corpo exato.
  - Fallback `search_web` em `deep-researcher/SKILL.md:15-16`. O agy não tem `WebFetch`.
  - Limite: spec-writer e plan-writer leem o agent do disco e ficam sem a nota.
  - Teste: a nota aparece no prompt e os `agents/*.md` ficam intactos.

**G2 (#12), P, risco baixo/médio:**
- Em `read_tests_gate` (`roadmap-release-agy.py:666-679`, chamado em `:702`), gravar a saída completa num arquivo temporário. O CLI do `test-extract.mjs` lê arquivo (`:243-252`), e o `run_cli` passa só stdin (`agy-bridge.py:55`).
- Rodar `node scripts/test-extract.mjs <arq> --exit N`, ou usar `capture.mjs run --tests`.
- O flash só roda quando `format == 'unknown'`. O `.py` não tem `ignoreFailuresWhenChanged`.
- Teste Python em `roadmap-release-agy.test.mjs`:
  - TAP e spec sem chamada de agente;
  - saída desconhecida vai ao flash;
  - uma falha anterior aos últimos 4000 caracteres é vista.
- G2 é pré-requisito do G3b.

**G3a (#13), M, médio:**
- Linhas: `coordinator-agy.py` (`impl_prompt` `:576-595`, `review_prompt` `:611`, `final_prompt` `:642`) e `roadmap-release-agy.py` (`:1490`, `:1655`, cleanup). O task-reviewer já recebe `diffPath` (`:1538`).
- Passar `capture` com `--cwd` e `--brief`.
- Trocar o `git diff` direto pelo `review-package.mjs`, lido por páginas.
- Chamar `capture.mjs prune` no cleanup.
- Conferir a linha assinada, como o `.js` faz em `coordinator.js:1037-1044`. Hoje o `ctx_for` não passa `capture`.
- Incluir os itens do comentário do dono: `slice --sha` de 12 hex, `<seq>-line.json` e `pairs` para o test-first. No `.js` estão em `roadmap-release.js:617-623,839-846` e `capture.mjs:4-14`.
- O `.py` usa `call_pure` sobre o `.js` (`:227`, `:423`), então o risco está no encanamento.
- Testes: asserções sobre os prompts gerados nos dois `*-agy.test.mjs`. O prompt do implementer contém `CAPTURE:` e `--brief`; os dos revisores contêm `review-package.mjs` e não contêm `git diff`; o cleanup chama `prune`.

**G3b (#15), G, risco médio/alto, revisão T2, depois de G2:**
- Portar para `roadmap-release-agy.py`:
  - `removedTests`, `declared()` e `RM_CLAUSE`;
  - `removedFloor`, por `test-extract.mjs removed`;
  - `totalOnlyGates` (`roadmap-release.js:284`, `:3100`);
  - o `outPath`/`outSha` devolvido por `gateFromCapture`.
- Passar `removed` a `pure('allPass')` (`:739`) e a `pure('mergeFloor')` (`:1977`). Hoje o `{}` padrão desliga o piso em silêncio, e esse é o risco real.
- Medir o blob em `load_spec` (`:1198`) e compará-lo em `skip_rev('spec')` (`:2292`), como o `.js` faz em `:2514` e `:2554`.
- Conferir se o `--no-spec` já está coberto. O `.py` tem `load_plan(use_spec=False)` (`:1207`, `:2411`), mas omite a flag, o que não tem efeito em `data.tasks`.
- Testes em `roadmap-release-agy.test.mjs`. A paridade entre `.js` e `.py` entra como item de checklist de entrega, como a issue pede.

**G4 (#16), P, risco baixo, só spec:**
- Spec de um gerador de pacote agy (`tools/agy-pack`, que hoje não existe) que:
  - (a) exclua `agents/*.md`;
  - (b) emita `source` como struct no marketplace do agy;
  - (c) mantenha o texto agy fora dos `SKILL.md`, por causa do `prose-budget.test.mjs` (o plan-coordinator tem 5.849 B);
  - (d) documente a invocação explícita do `roadmap-release` na seção agy do README (G1).
- A `disable-model-invocation` é por desenho (DEC-275, `docs/plans/roadmap-evolucao-skills/decisions.md:280`) e já está registrada em `docs/plans/productivity-tools-agy/spec.md:22`.
- Critérios: lint, `independence.test.mjs` e `agent-contracts.test.mjs` continuam passando; o pacote gerado não contém agents e contém as 11 skills.

## Fechar sem código

**#27, não reproduz.**
- Os dois lados vêm do `plan.md` commitado, na mesma execução e com o mesmo plan-tool (`${pluginRoot}/scripts/plan-tool.mjs`, `roadmap-release.js:2614`): `prevPlan` por `loadPlan(false)` (`:2663`) e o plano novo por `loadPlan()`.
- Nada vem de `run.json`, progress, cache ou de um emit gravado antes.
- O `--spec` só valida (`plan-tool.mjs:329`) e não altera `data.tasks`.
- O emit enxuto já traz o hash `authored` (`plan-tool.mjs:643-660`), testado em `flow.test.mjs:4225-4236`.
- O caminho agy repete a mesma lógica (`roadmap-release-agy.py:2411-2423`).
- Ação: comentar a explicação e fechar, sem teste novo.

## Decisões pendentes do dono

1. Autorizar o bloco G (regra do acoplamento do agy).
2. #3: A5 logo depois de A1 (recomendado) ou adiar. Paliativo até lá: subir os agentes de captura (preflight e `gateOnce`) para opus.
3. #4: só a mensagem (mínimo) ou também a fixação por SHA.
4. #17: forma de verificar na retomada, (a) ou (b), e a regra para `removedAsserts`.
5. #28: DEC nova para o argumento `parallelOk`.
6. #29: só se quiser permitir `allowed-tools` em commands (o padrão é recusar).
7. #24: viabilidade do HMAC com o script-runner. Se avançar, o escopo cobre todos os digests `fnv1a`; senão, uma DEC aceita o risco.
8. #18: opção A (`shq` mínimo) ou B (comando em arquivo).
9. #26: destino das variantes legadas que usam `E5_PATHS`.
10. #25: DEC de orçamento e de commit base da próxima medição paga, e decisão dos limites (sonnet 11 ou 12, haiku).

## Ordem de execução sugerida

1. **Fila do `roadmap-release.js`:** A1, A5, A3 completo (se aprovado), A4, B1, B4, B6 e C1 (se aprovado).
2. **Fila do `preflight.mjs`,** em paralelo à fila 1: A3 mínimo, B2 e B3 (B3 depois da confirmação headless).
3. **Independentes,** em paralelo: A2, B5, D1, E1, E2, E3 e E4. D2 espera o primeiro plugin com `commands/`.
4. **E5** (medição paga) depois de E1 a E4 e no commit base que a DEC definir. C2 é medido em seguida.
5. **F1** só se for viável.
6. **G,** se autorizado: G1, G2, G3a, G3b e G4.
7. Fechar a #27.

Roteamento (política global): implementação T1 (sonnet, medium). Revisão T2 (opus) nas tarefas de risco médio/alto: A4, A5, B4, B6, C1, E4 (`E5_PATHS`), F1 e G3b. Portão final T3 na branch inteira.

## Verificação por tarefa

```
node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"
node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools
claude plugin validate plugins/productivity-tools
node plugins/productivity-tools/scripts/embed.mjs --check <alvos>   # se lib/ mudou
```

Os textos brutos das issues e os laudos ficaram no scratchpad da sessão de 2026-11-25. Os resumos estão neste arquivo.
