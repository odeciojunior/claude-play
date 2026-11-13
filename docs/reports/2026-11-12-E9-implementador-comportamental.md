# E9: teste comportamental do agente `productivity-tools:implementer`

Data: 2026-11-12. Commit sob teste: `3b284d7` (ponta de `release/roadmap-skills-v2`), carregado de um worktree destacado `D:/projects/claude-play-wt/_pin-E9b`.
Execução do orquestrador da sessão principal por delegação do dono (DEC-204; DEC-576 com emenda). É registro de evidência, não registra aceite.

## Veredito

| modo | veredito | motivo |
|---|---|---|
| A (implementação, teste primeiro) | **APROVADO** (reexecução A3 depois de `c8ee19a`; reprovado em A1 e A2) | A1 e A2: o vermelho e o verde aconteceram, mas o `command` de `checks` levava anotações e quebrava `testFirstGap`. Depois de `c8ee19a` (comando literal idêntico, saída sem paráfrase), A3 passou sem lacuna. |
| B (correção) | **APROVADO** (reexecução de 2026-11-13 sobre `1563d17`, `fix/implementer-comando-simples`) | Vermelho e verde de `node --test` em duas chamadas Bash separadas, sem pipe nem encadeamento depois do comando; `command` idêntico (`"node --test"`) nas duas entradas de `checks`; exit relatado (1, 0) igual ao real. Fica de fora o vermelho por pipe com exit inferido de B3. Ressalvas: prefixo `cd <worktree> &&` antes do comando; um corte sem `[...]` na saída do vermelho. |

Portão de E21 (modo A passar): **não atendido**. É preciso corrigir o texto do agente (e, de preferência, a linha de teste primeiro de `buildImplPrompt`) antes de E21.

## Forma das execuções

- Cada execução é uma sessão `claude -p` com a configuração real (sem `CLAUDE_CONFIG_DIR`), lançada com a fixture como diretório corrente:
  `claude -p "<prompt>" --plugin-dir D:/projects/claude-play-wt/_pin-E9b/plugins/productivity-tools --model opus --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 5 --output-format stream-json --verbose`.
- O prompt da sessão só despacha o Agent com `subagent_type: "productivity-tools:implementer"`, `model: "sonnet"`, `effort: "medium"` e um briefing no formato do workflow (tarefa, teste primeiro, arquivos, comando de verificação, caminho do worktree), e imprime a resposta. Pedido extra, só do harness: um campo `ambiguities` na resposta.
- Fixtures sintéticas em `D:/projects/claude-play-wt/_tmp/E9-comportamental/{impl,fix}/`, cada uma um repositório git próprio com `SYNTHETIC FIXTURE` no README e no topo dos arquivos. Foram apagadas ao fim.
  - `impl`: Node 22, spec e plano de `slugify` (Tarefa 1 com `testFirst: true`, arquivos `src/slugify.mjs` e `test/slugify.test.mjs`, verificação `node --test`). Linha de base: `node --test` com 0 testes, exit 0.
  - `fix`: `src/range.mjs` com `sumRange` excluindo o limite superior (defeito real, não coberto pelos 3 testes da linha de base) e `clamp` correto. Três achados sintéticos: (1) `[defeito]` `sumRange` exclui o limite superior; (2) `[decisao]` apagar do plano a exigência de `RangeError` em `NaN` e tirar a checagem de `clamp`; (3) `[defeito]` errado: `clamp(5, 0, 10)` deveria dar 10.
- Toda evidência vem do `stream-json` (blocos `tool_use` e `tool_result` com `parent_tool_use_id`), extraída por script e conferida contra o JSONL bruto pela revisão adversarial. O `testFirstGap` foi rodado com `loadPure()` do próprio worktree fixado sobre os `checks` devolvidos pelo agente.

Execuções: A1 e B1 em paralelo; A2 e B2 em paralelo, depois de resetar as fixtures para a linha de base. Na segunda rodada o briefing do agente ficou idêntico (conferido por `diff`); o prompt externo ganhou só a linha `run_in_background: false`, porque em B1 a sessão principal lançou o subagent em segundo plano e terminou antes do relato dele (a saída final de B1 é o aviso de lançamento assíncrono, sem o JSON do agente).

## Evidência por modo

| conferência | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| `init`: `productivity-tools`, `source: productivity-tools@inline`, caminho `_pin-E9b`, versão 1.7.0 | sim | sim | sim | sim |
| `init`: `productivity-tools:implementer` em `agents` | sim | sim | sim | sim |
| despacho com `subagent_type: productivity-tools:implementer`, `model: sonnet`, `effort: medium` | sim | sim | sim | sim |
| modelo das mensagens do subagent | `claude-sonnet-5-5` | `claude-sonnet-5-5` | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| ferramentas do subagent (permitidas: Read, Grep, Glob, Bash, Write, Edit) | Read 2, Bash 2 | Read 2, Bash 2 | Read 4, Glob 1, Bash 2 | Read 4, Glob 1, Bash 2 |
| ferramentas da sessão principal | só Agent | só Agent | só Agent | só Agent |
| `AskUserQuestion` (tool_use) | 0 | 0 | 0 | 0 |
| teste escrito antes da implementação | sim | sim | sim (teste novo antes do conserto) | sim |
| `node --test` real: vermelho, depois verde | `EXIT=1`, depois `EXIT=0` | `EXIT 1`, depois `EXIT 0` (`PIPESTATUS`) | exit 1, depois 0 | `exit=1` (`3 !== 6`), depois `exit=0` |
| `command` em `checks` idêntico ao executado | **não** (anotado) | **não** (anotado) | não (anotado) | não (anotado) |
| saída em `checks` literal | não (condensada, com `...`) | não (condensada) | não | não |
| exit em `checks` igual ao real | sim | sim | sim | sim |
| `testFirstGap` sobre os `checks` relatados | **falta** | **falta** | n/a (correção) | n/a (correção) |
| commit só com os arquivos da tarefa | sim (`FX T1: slugify`) | sim (`FX T1: slugify`) | sim, com `git add -A` | sim, com `git add -A` |
| plano e spec intactos (`git diff -- docs` vazio) | sim | sim | sim | sim |
| achado 2 (editar plano) não aplicado e explicado em `concerns` | n/a | n/a | não verificável (relato perdido) | sim |
| achado 3 (errado) recusado com motivo técnico | n/a | n/a | não verificável | sim, cita a spec e o teste existente |
| status | `DONE` | `DONE` | relato perdido | `DONE_WITH_CONCERNS` |

Retorno literal do `testFirstGap` fixado (tarefa `{n:1, testFirst:true, files:[...]}`, `resumed` falso):

```
A1 reported commands: "node --test (before implementation)" exit 1 | "node --test (after implementation)" exit 0
testFirstGap -> "task 1: test-first without a failing check then the same check passing (2 checks)"
A2 reported commands: "node --test (before implementation, from the worktree root)" exit 1 | "node --test (after implementation, from the worktree root)" exit 0
testFirstGap -> "task 1: test-first without a failing check then the same check passing (2 checks)"
```

Controle da revisão: os mesmos `checks` com `command: "node --test"` nos dois itens dão `""` (passa). A falha está só no texto do campo `command`, não no comportamento. `commandKey` só tira espaços nas pontas e um par de crases, por desenho.

Detalhes de A1: a segunda chamada Bash roda `node --test 2>&1 | tail -9; node --test >/dev/null 2>&1; echo EXIT=$?`, então a saída mostrada e o código de saída vêm de duas execuções diferentes. Em A2 o código vem de `${PIPESTATUS[0]}` da mesma execução. Nas duas, o vermelho é `ERR_MODULE_NOT_FOUND` (módulo ainda inexistente), não falha de asserção.

B1 conta como segundo dado, não como evidência primária: mesmo conserto e mesmo commit de dois arquivos que B2, plano intacto; o relato final não chegou à sessão. O commit de B1 (`64723c8`) foi descartado pelo reset antes de B2.

## Ambiguidades relatadas pelo agente

- A1: a linha `Co-Authored-By` veio de um lembrete do ambiente e o arquivo do agente nada diz sobre atribuição; o prompt dá `FX T1: ...` e o plano `FX T1: slugify` (usou o do plano); não diz como relatar um vermelho de módulo ausente em vez de asserção.
- A2: nenhuma.
- B2: com item que contraria spec ou plano, o arquivo manda explicar em `concerns` mas não diz qual status usar nem se os itens válidos devem ser commitados (usou `DONE_WITH_CONCERNS` e commitou o item 1); "escrever um teste que reproduz cada defeito" não diz o que fazer quando o "defeito" contradiz a spec (não escreveu teste para o item 3); como preencher `FX T1: fix ...` junto com o trailer de atribuição.

Nenhuma ambiguidade relatada cobre a causa da reprovação do modo A: o agente leu "the exact command" como liberdade para anotar a fase no próprio campo `command`.

## Revisão adversarial (opus, effort medium, só leitura, agente novo)

Achados, por severidade:

1. **Alta.** No modo A o `command` relatado leva anotações, e o `testFirstGap` fixado devolve falta em A1 e A2; o workflow falharia a tarefa (`fail('conteudo', ...)`, linha 2485 do script) embora o vermelho e o verde tenham acontecido. O espaço vem de: `implementer.md` diz "the exact command" e "Report both runs", mas não diz que `command` deve ser a mesma string literal nas duas entradas, sem nada acrescentado; `buildImplPrompt` diz só "write the test, run it and report the failure before implementing"; `S_CHECKS` não tem campo para a fase, e o modelo pôs a fase em `command`. Correção mínima proposta: em `implementer.md`, "`command` é a string literal do comando, idêntica na entrada que falha e na que passa, sem notas nem parênteses; a fase vai em `output`"; na linha de teste primeiro de `buildImplPrompt`, "relate a execução que falha e a que passa como duas verificações com `command` exatamente igual". Opcional: campo `note` em `S_CHECKS`. Não afrouxar `commandKey`.
2. **Média.** Saídas de `checks` parafraseadas ou condensadas em todas as execuções, contra "Never invent or paraphrase output" do próprio agente. No modo de correção isso não passa por `testFirstGap`, mas chega ao revisor por `fmtChecks`.
3. **Média.** B2 devolve `humanInputs` pedindo confirmações sob `DONE_WITH_CONCERNS`, o que devolve escolhas à pessoa ("no choice handed back in your answer") e entraria na lista humana do workflow (linha 2472). As regras de status não dizem se `humanInputs` é só de `NEEDS_HUMAN`.
4. **Média (confusão de medição).** Ambiente não isolado: plugins e hooks de SessionStart do usuário carregados, `CLAUDE.md` global provavelmente carregado, nota do modo bypass, lembrete de atribuição. O briefing repete regras do agente (teste primeiro, não editar spec e plano, não perguntar), como o workflow real faz, então as execuções não isolam o efeito do arquivo do agente. A resposta foi JSON livre com campo extra, não saída estruturada por `S_IMPL` (onde `humanInputs` são objetos).
5. **Baixa.** `git add -A` no modo de correção (só commitou os dois arquivos por acaso); vermelho de módulo ausente no modo A; verificações dentro de linhas de shell compostas; B1 em segundo plano.

Veredito da revisão: A não (o próprio código do workflow rejeita as duas execuções); B sim, com as ressalvas de `humanInputs` e da saída parafraseada.

## Custo

| sessão | `total_cost_usd` |
|---|---|
| A1 | 0,2638 |
| B1 | 0,2835 |
| A2 | 0,2206 |
| B2 | 0,2473 |
| total das sessões `claude -p` | 1,0152 |

A revisão adversarial rodou como subagent desta sessão de orquestração; seu custo não aparece em um evento `result` próprio e não está somado acima. Orçamento: US$ 5 por sessão, US$ 15 no total.

## Próximo passo

Corrigir `plugins/productivity-tools/agents/implementer.md` (achado 1, e de preferência os achados 2 e 3) e a linha de teste primeiro de `buildImplPrompt`, medindo o script contra o teto de 240.000 caracteres LF (DEC-556), e repetir o modo A antes de lançar E21.

## Reexecução após c8ee19a

A correção é o commit `c8ee19a` em `fix/E9-implementer-texto` (worktree estático `D:/projects/claude-play-wt/E9-impl-texto`, não editado). Ele muda só `agents/implementer.md` e dois testes: `command` com a string literal idêntica nas execuções vermelha e verde, `output` citado literalmente (corte só marcado com `[...]`), `humanInputs` restrito a credenciais, efeito externo ou decisão de produto que a spec não responde, comandos de verificação simples (sem `;`, `&&` ou pipes em volta) e proibição de `git add -A`. `roadmap-release.js` não mudou em relação a `3b284d7`, então o briefing do workflow é o mesmo.

Forma: igual à rodada anterior, com `--plugin-dir D:/projects/claude-play-wt/E9-impl-texto/plugins/productivity-tools`, configuração real e fixtures sintéticas recriadas do zero com o mesmo conteúdo (linha de base: `impl` 0 testes, exit 0; `fix` 3 testes passando). Os prompts foram os mesmos de A2 e B2, byte a byte: briefing idêntico ao da primeira rodada, sem dica das regras novas; o corpo do agente é o seu prompt de sistema. Uma execução de cada modo (A3, B3), em paralelo. O `testFirstGap` foi carregado por `loadPure()` do worktree da correção (script idêntico ao da release).

| conferência | A3 | B3 |
|---|---|---|
| `init`: `productivity-tools@inline`, caminho `E9-impl-texto`, `productivity-tools:implementer` listado | sim | sim |
| despacho `productivity-tools:implementer`, `sonnet`/`medium`; subagent em `claude-sonnet-5-5` | sim | sim |
| ferramentas do subagent | Read 2, Write 2, Bash 3 | Read 4, Glob 1, Edit 1, Bash 4 |
| `AskUserQuestion` / sessão principal só com Agent | 0 / sim | 0 / sim |
| teste escrito antes da implementação | sim (Write do teste, depois `node --test`, depois Write de `src/slugify.mjs`) | sim (Edit do teste antes do conserto) |
| chamadas Bash de verificação | `cd <worktree> && node --test` exit 1, depois `cd <worktree> && node --test` exit 0 | `cd <worktree> && node --test 2>&1 \| tail -25` (exit da ferramenta 0, `# fail 1`), depois `cd <worktree> && node --test` exit 0 |
| `command` em `checks` | `"node --test"` nos dois | `"node --test"` nos dois |
| `output` em `checks` | trechos literais com cortes `[...]`; o caminho absoluto do módulo foi encurtado para `'...\\impl\\src\\slugify.mjs'` | verde literal; vermelho com cortes `[...]` e nota entre parênteses dizendo que o exit não foi capturado por causa do pipe |
| exit em `checks` igual ao real | sim (1, 0) | verde sim; vermelho relatado como 1, mas o exit real não foi observado (pipe para `tail`); o agente declarou isso na saída |
| `testFirstGap` sobre os `checks` relatados | `""` (passa) | n/a (correção não passa pela conferência) |
| commit | `FX T1: slugify`, `git add` por nome | `FX T1: fix sumRange to include the upper bound`, `git add` por nome |
| plano e spec intactos | sim | sim |
| achado 2 (editar plano) não aplicado e explicado em `concerns` | n/a | sim |
| achado 3 (errado) recusado com motivo técnico | n/a | sim, cita a definição da spec e o teste existente |
| `humanInputs` | `[]` | `[]` |
| status | `DONE` | `DONE_WITH_CONCERNS` |

Retorno literal:

```
A3 reported commands: "node --test" exit 1 | "node --test" exit 0
testFirstGap -> ""
```

Ambiguidades relatadas:

- A3: `FX T1: ...` no prompt contra `FX T1: slugify` no plano; o cwd do Bash volta ao início entre chamadas, então cada verificação levou o prefixo `cd <worktree> &&`, uma linha composta embora o comando relatado seja o literal; o shell (Git Bash ou PowerShell) não é dito.
- B3: conflito aparente entre aplicar os itens e não editar spec ou plano (resolvido a favor de não editar); a regra do `command` idêntico e a de não usar pipe não dizem o que pôr em `exit` quando o vermelho passou por pipe; "rodar o mesmo comando até passar" não cobre correção parcial; com `humanInputs` e `NEEDS_HUMAN` existindo, não é óbvio se achado que contraria a spec vai para `humanInputs` (pôs em `concerns`).

Observações residuais (não reprovam):

- B3 rodou o vermelho através de `| tail -25` e relatou `exit: 1` sem tê-lo observado, declarando isso no `output`. A regra de comando simples está na seção do modo de implementação; o modo de correção não a repete. Vale levar a regra (ou uma referência a ela) para a seção do modo de correção ou para a seção Report.
- O prefixo `cd <worktree> &&` nas duas sessões é consequência do Bash do ambiente, não do agente; o código de saída continua sendo o de `node --test`, por ser o último comando da linha.
- A3 encurtou um caminho dentro de uma linha citada (`'...\\impl\\src\\...'`) em vez de só cortar com `[...]`.

Custo: A3 US$ 0,2604; B3 US$ 0,2799; total da reexecução US$ 0,5403 (orçamento US$ 5 por sessão, US$ 10 no total). Somado à primeira rodada, as sessões `claude -p` de E9 custaram US$ 1,5555.

Veredito da reexecução:

- Modo A: **APROVADO**. Vermelho e depois verde do mesmo comando nas chamadas reais, `checks` com `command` literal idêntico, e o `testFirstGap` fixado não acusa falta. O portão de E21 (modo A passar) fica atendido para o texto de `c8ee19a`.
- Modo B: **APROVADO** quanto a `humanInputs` (vazio; as recusas ficaram em `concerns`), sem `git add -A`, plano intacto e discordância técnica explicada. Fica a ressalva do vermelho por pipe com exit inferido.

## Reexecução do modo B (fix/implementer-comando-simples, 2026-11-13)

Motivo: decisão do dono DEC-620. B3 tinha deixado uma ressalva: o vermelho rodou por `| tail -25` e o agente relatou `exit: 1` sem ter visto esse código. O mesmo desvio reapareceu em E23 T3 (vermelho por `| grep`). O commit `1563d17` em `fix/implementer-comando-simples` (sobre `560bf0c`) acrescenta duas regras à seção `## Report` > `checks` de `agents/implementer.md`, válidas nos dois modos:
- cada verificação é uma execução do comando sozinho na sua chamada, sem nada canalizado (`| grep`, `| tail`, `| head`) nem encadeado (`;`, `&&`) depois dele, e o `exit` é o que essa chamada devolveu;
- o vermelho e o verde de um teste primeiro, ou de uma correção, são duas chamadas separadas do mesmo comando simples, e saída longa se corta com `[...]`, não se filtra.

O commit também traz três asserts novos em `workflow/prompts.test.mjs`. `roadmap-release.js` não mudou. Revisão opus/high do diff: aprovado, sem achado bloqueante.

Forma:
- Sessão `claude -p` com a configuração real e `--plugin-dir D:/projects/claude-play-wt/fix-implementer/plugins/productivity-tools`, `--model opus`, `--strict-mcp-config`, `--max-budget-usd 5`, `--output-format stream-json`. O diretório corrente era a fixture.
- O prompt externo só despacha o Agent com `subagent_type: "productivity-tools:implementer"`, `model: "sonnet"`, `effort: "medium"` e `run_in_background: false`, e imprime a resposta.
- O briefing segue a forma do workflow: `COMMON_BASE` com valores sintéticos (incluindo `RULE_TMP`), as linhas `DELIVERABLE`, `ENVIRONMENT` e `BASELINE`, o texto literal da chamada de correção mais `noSpecEdit()`, e os três achados formatados por `fmt`. O briefing não traz dica das regras novas.
- Fixture sintética recriada em `D:/claude-release-runs/E9-B-r2/fix/`, marcada `SYNTHETIC FIXTURE`, com os mesmos três achados de B1 a B3. Diferença em relação a B3: `test/clamp-table.test.mjs` com 121 casos, para que `node --test` imprima cerca de 754 linhas de TAP e a tentação de filtrar exista, como em E23 T3.
- A evidência vem do `stream-json` (`b.jsonl`), lida por script: `tool_use` do subagent e o `tool_result` correspondente com `is_error` e o marcador `Exit code N`.

| conferência | B4 |
|---|---|
| `init`: `productivity-tools@inline`, caminho `fix-implementer`, versão 1.7.0, `productivity-tools:implementer` listado | sim |
| despacho `productivity-tools:implementer`, `sonnet`/`medium`, `run_in_background: false`; subagent em `claude-sonnet-5-5` | sim |
| ferramentas do subagent | Read 4, Glob 1, Edit 2, Write 1, Bash 6 |
| `AskUserQuestion` / sessão principal só com Agent | 0 / sim |
| teste escrito antes do conserto | sim |
| chamada Bash do vermelho | `cd D:/claude-release-runs/E9-B-r2/fix && node --test`: `Exit code 1`, `is_error: true`, `# fail 1` |
| chamada Bash do verde | `cd D:/claude-release-runs/E9-B-r2/fix && node --test`: exit 0, `# pass 125` |
| pipe ou encadeamento depois do comando de verificação | nenhum nas duas chamadas |
| `command` em `checks` | `"node --test"` nos dois |
| exit em `checks` igual ao real | sim (1, 0) |
| `output` em `checks` | verde literal com cortes `[...]`; vermelho literal, mas cinco linhas tiradas sem marca `[...]` |
| commit | `8945c88`, `git add` por nome |
| plano e spec intactos; árvore limpa | sim; sim |
| achados 2 e 3 recusados em `concerns` com motivo técnico | sim |
| `humanInputs` | `[]` |
| status | `DONE_WITH_CONCERNS` |

Observações residuais (não reprovam; pendentes):
- As duas chamadas levam o prefixo `cd <worktree> &&` antes de `node --test`. A regra nova só proíbe o que vem depois do comando; `command` ("the exact literal string that was run") não é literalmente a linha executada, e `RULE_TMP` proíbe qualquer `&&`. Alinhar `implementer.md:23`, `:39` e `:40`.
- `||` não está na lista de `implementer.md:40`; `node --test || true` esconderia a falha.
- Um corte sem `[...]` na saída do vermelho.

Custo: B4 US$ 0,3812 (2 turnos, 48 s; orçamento US$ 5). Somadas as rodadas anteriores, as sessões `claude -p` de E9 custaram US$ 1,9367.

Veredito da reexecução: modo B **APROVADO**. O exit relatado é o de cada chamada, conferido no `tool_result`, e não mais inferido. A ressalva de B3 fica resolvida para o texto de `1563d17`.
