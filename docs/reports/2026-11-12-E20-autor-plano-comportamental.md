# E20: execuções comportamentais do autor de plano e da skill plan-writer

Data: 2026-11-12. Commit da branch `feat/E20` sob teste: `5a53f314ce81809e3ff3ed061289f391c672cb05` (depois da Tarefa 11).
Registro de evidência para o dono. Nenhum aceite é registrado aqui.

## Forma das execuções

- Cada execução é uma sessão `claude -p` lançada a partir do sandbox, com `--plugin-dir D:/projects/claude-play-wt/E20/plugins/productivity-tools --model opus --permission-mode bypassPermissions --output-format stream-json --verbose` (instrução do dono; nada embarcado indica esse modo). Os sandboxes ficaram em `D:/projects/claude-play-wt/_tmp/E20/` (fora do repositório) e foram apagados ao fim.
- O despacho dos agentes é por nome do plugin (`productivity-tools:spec-author`, `productivity-tools:plan-author`), sem forma de reserva. Modelo da sessão principal: `claude-opus-5-5`; o agente tem `model: opus`, `effort: medium` no frontmatter.
- Evento `init` em todas as execuções: plugin `productivity-tools`, `source: productivity-tools@inline`, `path: D:\projects\claude-play-wt\E20\plugins\productivity-tools`, versão 1.7.0 (igual ao `--plugin-dir`).
- Adendo de harness nas execuções dos critérios 2 e 4: `--append-system-prompt "Do not pass a model or effort override when dispatching plugin agents; the agent's own frontmatter decides."`. Motivo na seção do critério 1.
- Modelo, ferramentas e contagem de chamadas de `check` vêm do `stream-json` (blocos `tool_use` com `parent_tool_use_id`), não do relato do agente.

## Pendência de E19 (DEC-400): `spec-author` por nome

- Entrada: variante `spec-author`, `mode: unattended`, `output: .../docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md`, `language: English`, `roadmap` e `card: E6` do sandbox.
- Obtido: o despacho `subagent_type: "productivity-tools:spec-author"` achou o agente; modelo das mensagens do subagent `claude-opus-5-5`; ferramentas usadas `Bash, Write` (dentro de `Read, Grep, Glob, Bash, Write, Edit`); nenhuma `AskUserQuestion`; a última chamada do agente foi `spec-tool.mjs emit` e a mensagem devolvida é o JSON de `emit`.
- `node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json` -> `"errors": [], "warnings": [], "summary": {"errors": 0, "warnings": 0, "exitCode": 0}`, exit 0.
- Resultado: conferências atendidas.

## Critério 1: três execuções de `plan-author` em `mode: unattended`

Entrada: variante `plan-author`, `output: <sandbox>/docs/plans/roadmap-sandbox-E5/plan.md`, `spec` do mesmo diretório, `language: English`, `roadmap: docs/plans/roadmap-sandbox/`, `card: E5`.

Primeira rodada (c1-1, c1-2, c1-3, sem proibir sobrescrita de modelo):

| execução | modelo do subagent | ferramentas | check |
|---|---|---|---|
| c1-1 | `claude-sonnet-5-5` (FALHA) | Read, Glob, Grep, Bash | exit 0, 0 avisos |
| c1-2 | `claude-opus-5-5` | Bash, Write | exit 0, 1 aviso |
| c1-3 | `claude-sonnet-5-5` (FALHA) | Read, Glob, Bash | exit 0, 0 avisos |

Falha literal registrada: em c1-1 e c1-3 a sessão principal passou `model: "sonnet", effort: "medium"` na chamada do Agent (o `stream-json` mostra `"model":"sonnet","effort":"medium"` no despacho; a sessão cita a política global de roteamento do dono, que o `claude -p` carregou do `CLAUDE.md` do usuário). A conferência "modelo opus" falhou nessas duas. A causa é a sessão principal sobrescrevendo o frontmatter, não o agente. As duas execuções ficam registradas aqui e foram refeitas (c1-1b e c1-3b) com a instrução "não passe modelo nem esforço; o frontmatter do agente decide" no prompt. É um limite do ambiente de medição; o texto embarcado não controla a sobrescrita.

Rodada válida (c1-1b, c1-2, c1-3b):

| execução | modelo do subagent | ferramentas | chamadas de `plan-tool check` do agente | `AskUserQuestion` | última chamada do agente | check final | campo `roadmap` |
|---|---|---|---|---|---|---|---|
| c1-1b | `claude-opus-5-5` | Bash, Write | 1 | 0 | `plan-tool emit` | exit 0, 1 aviso | `"roadmap": "docs/plans/roadmap-sandbox/"` |
| c1-2 | `claude-opus-5-5` | Bash, Write | 1 | 0 | `plan-tool emit` | exit 0, 1 aviso | `"roadmap": "docs/plans/roadmap-sandbox/"` |
| c1-3b | `claude-opus-5-5` | Bash, Write | 1 | 0 | `plan-tool emit` | exit 0, 1 aviso | `"roadmap": "docs/plans/roadmap-sandbox/"` |

Saída literal do check final (as três iguais, só muda o caminho):

```
{"tool":"plan-tool","schema":"plan/1","path":".../c1-1b/docs/plans/roadmap-sandbox-E5/plan.md","errors":[],"warnings":[{"code":"field-unknown","ref":"mode","message":"campo desconhecido \"mode\" (o esquema cresce por versão)"}],"summary":{"errors":0,"warnings":1,"exitCode":0}}
```

Resultado: no máximo três `check` (obtido 1), nenhuma pergunta, a última mensagem devolvida é o JSON de `emit`, modelo e ferramentas conforme o esperado nas três execuções válidas. O achado AV-1 (aviso `field-unknown mode`) aparece em todas.

## Critério 2: `/productivity-tools:plan-writer docs/plans/word-count/spec.md`

- Sandbox c2 (variante `plan-author`). Despachou `productivity-tools:plan-author` (opus; Bash, Write) com `mode: interactive`.
- `docs/plans/word-count/plan.md` gravado. `plan-tool check ... --json` -> exit 0, `"errors": []`, `warnings` com o mesmo `field-unknown mode`.
- Bloco: `"roadmap": null`, `"spec": "spec.md"`.
- Nenhuma `AskUserQuestion`, nenhuma pergunta de aprovação. A saída final trouxe a pasta de roadmap (`null`, com o motivo: a pasta `word-count` não segue `<name>-E<n>`), o aviso do check e a tabela do resumo (`| 1 | Função wordCount com testes (TDD) | haiku | low | sonnet |`), e ofereceu `plan-coordinator`.
- Observações: o resumo saiu em português embora o prompt estivesse em inglês (a sessão carregou o `CLAUDE.md` do dono, em português; `--lang` do SKILL.md é `pt` se a pessoa escreve em português, então o caso é ambíguo). A "lista de ambiguidades do SKILL.md" citada no passo da tarefa não existe no SKILL.md atual, então não foi conferida.
- Resultado: conferências atendidas, com o aviso AV-1.

## Critério 4: adoção de `docs/superpowers/plans/2026-01-01-e5-text-utilities.md`

Entrada: o pedido, mais a instrução de harness de tomar a resposta de `tools/measure/scenario/plan-writer-adopt.md` (entrada sintética marcada `<!-- synthetic input: scripted approval for the E20 behavioral run, not a person -->`) no lugar da `AskUserQuestion`. A aprovação veio desse roteiro, não de uma pessoa. Duas execuções: c4 (instrução "imprima o texto que perguntaria") e c4b (instrução mais explícita, "escreva a pergunta como texto começando por `APPROVAL QUESTION:`").

| conferência | c4 | c4b |
|---|---|---|
| `plan-author` despachado em `mode: adopt` | sim | sim |
| `## Adoção` e pasta do roadmap mostradas antes da aprovação | só como saída de Bash, nunca em mensagem da sessão | só como saída de Bash |
| uma aprovação pedida, com texto literal | NÃO: nenhum texto de pedido de aprovação; o roteiro foi lido (primeiro Bash) e o `mv` veio sem pergunta | NÃO: a linha `APPROVAL QUESTION:` não foi escrita; o roteiro foi lido e `approve` aplicado |
| plano gravado no mesmo caminho | sim | sim |
| provisório apagado | sim (`...md.adopted.md`) | sim (`...adopted.md`) |
| `plan-tool check` | exit 0, 1 aviso `mode` | exit 0, 1 aviso `mode` |
| campo `roadmap` | `docs/plans/roadmap-sandbox/` | `docs/plans/roadmap-sandbox/` |
| `spec-author` despachado | NÃO | NÃO |
| campo `spec` | `../../plans/roadmap-sandbox-E5/spec.md` | `../../plans/roadmap-sandbox-E5/spec.md` |
| modelo e ferramentas do agente | opus; Bash, Write | opus; Read, Bash, Write |

Falhas literais do critério 4 (a correção volta à Tarefa 4, dona do SKILL.md, e à Tarefa 3, dona do agente; esta tarefa não edita arquivos de outras tarefas):

- F4-1: a etapa de aprovação do SKILL.md não foi exercida em nenhuma das duas execuções, mesmo com instrução explícita do harness na segunda. O dono decide se isso é falha do SKILL.md (sem regra para "pergunta indisponível") ou limite de `claude -p`.
- F4-2: a spec não foi achada pelo passo 1 do SKILL.md. O plano antigo cita um spec que não existe; as duas sessões usaram `docs/plans/roadmap-sandbox-E5/spec.md` por julgamento próprio em vez de despachar `spec-author`. O SKILL.md não cobre "spec citado e ausente".
- F4-3: o nome do provisório diverge entre as sessões (`<plano>.md.adopted.md` e `<plano>.adopted.md`).
- F4-4: em c4b o agente alterou as tarefas (dividiu a Tarefa 3, trocou o tier, removeu os passos de commit) e a seção `## Adoção` afirma "Nothing from the old plan was dropped" ao lado de uma linha "Commit commands removed". Em c4 a seção diz "No step was split, merged, added or removed", mas o plano ganhou restrições e um segundo `check` na Tarefa 3 sem linha na tabela.

## Revisão adversarial somente leitura (sonnet, sem editar)

Sessão `claude -p --model sonnet --permission-mode plan`, só leitura. Achados, com as citações do revisor:

1. Etapa 3 da adoção ("Ask for one approval in a single `AskUserQuestion` call: approve or refuse."): sem fallback quando a pergunta não existe; em c4 a transcrição vai direto ao `mv`.
2. A exibição da `## Adoção` não exige que a pessoa a veja; nas duas execuções ela só aparece em saída de Bash.
3. Passo 1 ("a `spec/1` named in the plan or beside it. If there is none, dispatch `spec-author`"): lacuna para spec citado e ausente.
4. Passo 2 ("`<old plan>.adopted.md`"): ambíguo (dois nomes obtidos).
5. O agente copia `mode` para o bloco ("copy the value into `mode` of the data block"), mas `plan-tool.mjs` tem `TOP = ['schema','id','title','spec','roadmap','constraints','externalPatterns','tasks','evidence','rulings','needsPerson']`, sem `mode`: todo plano do fluxo sai com `field-unknown`.
6. A adoção de c4 altera conteúdo (cláusula DEC-002, duas restrições, parágrafo "Order:", segundo check na Tarefa 3) sem linha na tabela e afirma que nenhum passo mudou.
7. c4b reescreve contra o pedido "sem alterar as tarefas" e a `## Adoção` se contradiz.
8. O SKILL.md não manda despachar em primeiro plano (em c4b a ferramenta respondeu "Async agent launched"). O revisor também disse que o `intake` de c4 inventa o pedido da pessoa; isso NÃO se confirma: o primeiro comando de c4 leu `plan-writer-adopt.md` antes do despacho.

Conferido por mim contra os sandboxes: pontos 1 a 7 e o ponto 8 sobre despacho assíncrono (`Async agent launched` presente em `r-c4b.jsonl`).

## Achados consolidados para o dono (nenhum corrigido nesta tarefa)

- AV-1: o agente `plan-author` copia `mode` para o bloco e `plan-tool check` avisa `field-unknown` (exit 0) em todo plano gerado. Dona: Tarefa 3 (agente) ou Tarefa 2 (`plan-tool`); o esquema `plan/1` não pode mudar (restrição do plano), então a saída coerente é o agente deixar de copiar `mode`, ou o dono aceitar o aviso.
- F4-1 a F4-4: Tarefas 4 (SKILL.md) e 3 (agente).
- Sobrescrita de modelo pela sessão principal por política global do dono: limite do ambiente de medição, tratado com o adendo de harness.

## Aceite

- Pendência de E19 (DEC-400): aceite: aguardando o dono.
- Critério 1: aceite: aguardando o dono.
- Critério 2: aceite: aguardando o dono.
- Critério 4: aceite: aguardando o dono. As conferências de aprovação e de spec falharam como descrito; a aprovação, quando exercida, viria do roteiro sintético, não de uma pessoa.

## Critério 5 (não é desta tarefa)

A rodada paga da suíte de gatilho é do dono (DEC-025, DEC-011). Comando: `node tools/measure/run-trigger.mjs --plugin-dir <plugin> --work <pasta fora do repositório> --out docs/reports/<data>-E20-gatilho.md --lang both`.
