# E9: teste comportamental do agente `productivity-tools:implementer`

Data: 2026-11-12. Commit sob teste: `3b284d7` (ponta de `release/roadmap-skills-v2`), carregado de um worktree destacado `D:/projects/claude-play-wt/_pin-E9b`.
Execução do orquestrador da sessão principal por delegação do dono (DEC-204; DEC-576 com emenda). É registro de evidência, não registra aceite.

## Veredito

| modo | veredito | motivo |
|---|---|---|
| A (implementação, teste primeiro) | **REPROVADO** (2 de 2 execuções) | O vermelho e depois o verde de `node --test` aconteceram de fato, mas o agente escreveu o campo `command` de `checks` com anotações (`node --test (before implementation)` / `(after implementation)`). O `testFirstGap` fixado devolve falta nas duas execuções, então o workflow falharia a tarefa com `conteudo` antes de qualquer revisor. |
| B (correção) | **APROVADO**, com ressalvas | Corrigiu o defeito real com teste que reproduz (vermelho, depois verde), não editou o plano, discordou tecnicamente do achado errado. Ressalvas: `humanInputs` preenchido sob `DONE_WITH_CONCERNS` e saída de `checks` parafraseada. |

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
