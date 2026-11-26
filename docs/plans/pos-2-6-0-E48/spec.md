# Spec E48 -- Paralelismo liberado por argumento

## Intenção

REQ-012 (#28, B6 do plano de correções, DEC-012). Com um `release.config.json` gerado (`generated: true`), o `roadmap-release.js` força `MAXPAR` a 1, e hoje a única saída é revisar o arquivo, tirar a marca e comitá-lo. Este entregável dá ao operador um argumento de execução, `parallelOk: true`, aceito só em `args`: com config gerado, `MAXPAR = intArg(A.maxParallel, 3, 1)` somente quando `A.parallelOk === true`; sem ele o paralelismo continua 1, mesmo que o config traga `parallelOk`. O argumento nunca volta em `resumeArgs` nem em `resumeWith`, e o relatório registra a liberação. O contorno de hoje (revisar, tirar `generated` e comitar) continua valendo; o argumento serve a quem não quer comitar.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: comentário ARGS (linha de `maxParallel` e uma linha nova de `parallelOk`), a constante `MAXPAR`, a função `withoutApprove` (e o comentário acima dela) e o item (6) do prompt do relatório (o trecho `${CFG.generated ? ... : ''}` dentro do agente `report`).
- `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`: testes novos do `MAXPAR` e dos `resumeArgs`, pelo `exec` de hoje (que já usa `generated: true` por padrão).
- Docs: `references/config.md` (linha da tabela de `maxParallel` e o parágrafo final de "Generated config"), `references/operator.md` (seção "Releasing parallelism on a generated config") e `SKILL.md` (passo 3, os dois itens que falam de `maxParallel: 1`, e o mapeamento de pedido para args do passo 4).

Fora:

- `roadmap-release-agy.py` e o teste dele: paridade agy pendente #13 (DEC-008). Os commits que tocam `roadmap-release.js` e o commit de merge levam no corpo a linha `paridade agy: pendente #13`.
- `scripts/preflight.mjs`: não ganha validação nem aviso para `parallelOk` no config (R5).
- `lib/` e qualquer bloco embutido; o `makeSem` e o agendamento por dependências não mudam.
- O B1 e o C1 (E46) e o B4 (E47): o E48 fica só com `parallelOk` (DEC-005).

O que não fazer:

- Não ler `CFG.parallelOk` nem `CFG.maxParallel` no ramo liberado: com config gerado só valem `A.parallelOk` e `A.maxParallel` (DEC-012).
- Não mudar o comportamento sem `generated`: ali `MAXPAR` continua `intArg(A.maxParallel ?? CFG.maxParallel, 3, 1)` e `parallelOk` não tem efeito.
- Não depender de número de linha do `roadmap-release.js`: o E46 (`docs/plans/pos-2-6-0-E46/plan.md`) e o E47 (`docs/plans/pos-2-6-0-E47/spec.md`) entram antes e deslocam linhas. Citar símbolos (`MAXPAR`, `withoutApprove`, `mkResult`, `op`, `finalResume`, `resumeFinal`, o agente `report`).
- Não escrever o número do limite de cópia fora de `lib/plan-digest.mjs` (`copy-budget.test.mjs`).
- Não afrouxar nem apagar teste existente (DEC-004). Sem bump, push, tag ou comentário em issue.

## Desenho

### AC1 -- sem parallelOk nos args, o paralelismo continua 1

`roadmap-release.js`: a constante `MAXPAR` passa a ser `CFG.generated ? (A.parallelOk === true ? intArg(A.maxParallel, 3, 1) : 1) : intArg(A.maxParallel ?? CFG.maxParallel, 3, 1)`, com o comentário de fim de linha mantido em forma curta. Só o booleano `true` libera (R2): `"true"`, `1` ou qualquer outro valor deixam 1. `CFG.parallelOk` nunca é lido, então um config que o traga não muda nada; o `preflight.mjs` não recusa a chave (R5), e o efeito nulo fica documentado em `config.md`. O `makeSem(MAXPAR)` do agendamento por dependências recebe o valor sem outra mudança.

`flow.test.mjs`: um teste com três cards independentes (`E1`, `E2`, `E3`, sem dependências) mede o pico de entregáveis com chamada de agente em andamento ao mesmo tempo, numa etapa fora de trava (sugestão: o autor da spec, rótulo `<E>:spec`), com a resposta do mock adiada por uma macrotarefa (`setImmediate`) para que a concorrência apareça (R6). Casos: (a) config gerado sem `parallelOk` e sem `maxParallel`: pico 1; (b) config gerado com `parallelOk: true` e `maxParallel: 3` no config, args sem `parallelOk`: pico 1; (c) config gerado e args com `maxParallel: 3` sem `parallelOk`: pico 1; (d) args com `parallelOk: 'true'` (string) e `maxParallel: 3`: pico 1. Hoje nada no `flow.test.mjs` cobre o `MAXPAR`; o caso (a) é o padrão que já existia.

### AC2 -- parallelOk true e maxParallel 2 nos args usam 2, e o resumeArgs não leva o argumento

`roadmap-release.js`: `withoutApprove` passa a tirar também `parallelOk` (`const { approveRulings, parallelOk, ...rest } = args`), e o comentário acima dela diz que os dois argumentos são digitados pela pessoa e nunca voltam (R1). Como `mkResult`, `op` (todo `resumeWith`), o `resumeWith` do `unfinished-merge`, o laço que reescreve `o.resumeWith` antes do relatório e `finalResume` já passam por `withoutApprove`, todos os `resumeArgs` e `resumeWith` saem sem o argumento, sem tocar em cada ponto de saída. `maxParallel` continua nos `resumeArgs`: numa retomada sem `parallelOk` digitado de novo, o config gerado volta a 1, que é o efeito pedido pela DEC-012. O comentário ARGS ganha `parallelOk (false)`: com config gerado, deixa `maxParallel` valer; só de `args`, nunca do config, nunca em `resumeArgs`/`resumeWith`; a linha de `maxParallel` diz `1 while config.generated unless parallelOk`.

O item (6) do prompt do relatório (R3): com `CFG.generated` e `A.parallelOk === true`, o texto diz que o config é gerado, que o argumento `parallelOk` liberou `maxParallel` `${MAXPAR}` nesta execução e que ele não volta nos argumentos de retomada (é preciso digitá-lo de novo); com `CFG.generated` sem a liberação, o texto de hoje continua e ganha a segunda saída: passar `parallelOk: true` com `maxParallel` nos args, nunca no config. Sem `generated`, nada muda.

`flow.test.mjs`: com config gerado e args `{ parallelOk: true, maxParallel: 2 }`, três cards independentes: pico 2 (nunca 3); `r.resumeArgs` não tem a chave `parallelOk` e mantém `maxParallel: 2`; nenhum `operatorActions[].resumeWith` tem a chave (forçar ao menos uma ação com `resumeWith`, por exemplo um entregável com falha `infra`, para o laço não passar vazio; essa falha acontece numa etapa posterior à medida, depois de `<E>:spec`, como o commit da spec, ou numa execução separada da que mede o pico: uma falha antes da medida, como a do `setup`, tira o entregável da contagem, e um `MAXPAR` errado de 3 ainda mostraria pico 2); o JSON da linha `Resume args:` do prompt do agente `report` também não tem a chave (ler só essa linha, porque o item (6) cita o nome do argumento); o prompt do `report` traz a frase da liberação com `2`. Caso extra: args `{ parallelOk: true }` sem `maxParallel` usa o padrão 3 (pico 3 com três cards). Caso sem `generated` (config com `generated: false`) e `parallelOk: true` com `maxParallel: 2`: pico 2 e o item (6) não aparece.

### Docs

- `config.md`: a linha de `maxParallel` diz "Forced to 1 while `generated` is true, unless the run args carry `parallelOk: true`"; o parágrafo final de "Generated config" ganha a segunda saída, a frase de que `parallelOk` no arquivo é ignorado e a de que, na liberação por argumento, o `maxParallel` do config também é ignorado (vale só o dos args; sem ele, o padrão 3).
- `operator.md`, "Releasing parallelism on a generated config": um parágrafo depois da lista, com a alternativa sem commit (`parallelOk: true` e `maxParallel` nos args da execução), a regra de que nessa liberação o `maxParallel` do config é ignorado (vale só o dos args; sem ele, o padrão 3), diferente do passo 4, que lê "the value in the config or args" e continua valendo só para o config revisado, o aviso de que a revisão de `locks` e `needsLock` do passo 2 continua sendo responsabilidade de quem libera, e de que o argumento não volta em `resumeArgs` nem `resumeWith`.
- `SKILL.md`: nos itens do passo 3 que dizem `maxParallel: 1`, acrescentar "unless the person passes `parallelOk: true`"; no mapeamento do passo 4, uma linha: "parallel on a generated config": `{"parallelOk":true,"maxParallel":N}`, ou só `{"parallelOk":true}` quando a pessoa não dá N (resulta no padrão 3), só quando a pessoa pede na própria mensagem; a skill nunca o acrescenta sozinha nem o copia de `resumeArgs` (R4).

## Para o plano

- Uma tarefa de workflow e testes (`roadmap-release.js`, `flow.test.mjs`) e uma de docs (`config.md`, `operator.md`, `SKILL.md`), cada uma com no máximo 4 arquivos e um commit, em worktree próprio criado de `release/pos-2.6.0` depois do merge do E47.
- Tamanho do `roadmap-release.js`: teto do B6 de 700 caracteres LF de delta líquido (DEC-007), medido entre o commit anterior à tarefa e o commit da tarefa (CRLF trocado por LF e `length`, a fórmula da trava em `discovery-slices.test.mjs`). Entre 700 e 840, enxugar até o teto; acima de 840, parar e voltar ao dono por subagente opus (DEC-007, DEC-021). A trava de 284.500 não muda; se o orçamento apertar, o E48 é o primeiro a sair (DEC-005, DEC-006). Estimativa do desenho: perto de 400.
- Forma exata do contador de pico no `exec` (um gancho opcional ou um `over` assíncrono) e o rótulo da etapa medida, conferindo que ela fica fora de `withLocks` e do `mergeLock`.
- Texto exato do item (6) nos dois ramos e das frases de docs; provar as frases contra orçamentos de prosa que as cubram, se houver (lint do plugin).
- G1 pelo Git Bash com o worktree parado, nunca com outra execução de testes correndo; piso: a contagem do último merge registrado em `docs/plans/roadmap-pos-2-6-0/log.md` antes do E48. Lint do plugin sem FAIL; G5 não se aplica (sem `lib/`), mas rodar `embed.mjs --check` não custa. Revisão T2 (risco médio no plano de correções).

```json data
{
  "schema": "spec/1",
  "id": "E48",
  "title": "Paralelismo liberado por argumento",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um config gerado, quando o workflow roda sem parallelOk, então o paralelismo continua 1, mesmo com parallelOk no config. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado parallelOk true e maxParallel 2 nos args, quando o workflow roda, então usa 2 e o resumeArgs não leva o argumento. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde tirar parallelOk dos resumeArgs e dos resumeWith?",
      "decision": "Na função withoutApprove, que passa a desestruturar também parallelOk; mkResult, op, o resumeWith do unfinished-merge, o laço que reescreve o.resumeWith e finalResume já passam por ela.",
      "basis": "Um único ponto cobre todas as saídas de retomada com cerca de 12 caracteres, dentro do teto de 700 da DEC-007, e repete o padrão já usado para approveRulings (DEC-012: fora de resumeArgs).",
      "alternative": "Uma função nova withoutPersonArgs aplicada em cada saída, ou tirar a chave só em resumeArgs (deixaria os resumeWith das ações levando o argumento).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Que valor de parallelOk libera o paralelismo?",
      "decision": "Só o booleano true (A.parallelOk === true); string, número ou qualquer outro valor deixam MAXPAR em 1 com config gerado.",
      "basis": "DEC-012 fala em parallelOk: true; aceitar valores truthy liberaria paralelismo por engano de digitação num caso em que o risco é corromper uma execução.",
      "alternative": "Aceitar qualquer valor truthy (Boolean(A.parallelOk)).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o relatório registra a liberação?",
      "decision": "O item (6) do prompt do agente report ganha dois ramos: com parallelOk true, diz que o argumento liberou maxParallel com o valor de MAXPAR e que não volta nos argumentos de retomada; sem ele, mantém o texto de hoje e acrescenta a saída por argumento.",
      "basis": "DEC-012 manda o relatório registrar a liberação; o item (6) já é o lugar em que o relatório fala do config gerado, então o custo é só o texto condicional.",
      "alternative": "Um campo novo no resultado do workflow (parallelReleased) além do texto do relatório.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "A skill pode acrescentar parallelOk aos args por conta própria?",
      "decision": "Não: SKILL.md passa parallelOk só quando a pessoa pede na própria mensagem, nunca o acrescenta sozinha nem o copia de resumeArgs.",
      "basis": "O argumento só faz sentido como ato da pessoa que assume a revisão de locks e needsLock; é o mesmo tratamento de approveRulings e acceptIntegrityAlerts, e é coerente com DEC-012 deixá-lo fora das retomadas.",
      "alternative": "Deixar a skill propor parallelOk quando o config é gerado e a execução tem vários entregáveis.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O preflight deve recusar ou avisar parallelOk escrito no release.config.json?",
      "decision": "Não: o preflight não muda; o workflow ignora CFG.parallelOk e config.md diz que a chave no arquivo não tem efeito.",
      "basis": "O critério AC1 só exige que a chave no config não libere nada; mexer no preflight.mjs abre outra fila de arquivo quente sem necessidade e fica fora das peças do card.",
      "alternative": "Um warnings do preflight quando o config traz parallelOk.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como provar nos testes que o workflow usa 1 ou 2 entregáveis em paralelo?",
      "decision": "Medir no flow.test.mjs o pico de entregáveis com chamada de agente em andamento ao mesmo tempo, numa etapa fora de trava, com três cards independentes e a resposta do mock adiada por uma macrotarefa (setImmediate); a falha que força um resumeWith acontece depois da etapa medida ou numa execução separada.",
      "basis": "MAXPAR não sai no resultado; o pico observado é o efeito real do makeSem e não exige expor estado interno nem gastar caracteres do workflow.",
      "alternative": "Expor MAXPAR no resultado ou no log e conferir o valor (gasta caracteres e testa a variável, não o efeito).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Config gerado com parallelOk: true e maxParallel: 3 no próprio config; args sem parallelOk.",
      "expected": "Paralelismo 1; nada do config libera."
    },
    {
      "id": "C2",
      "input": "Args com parallelOk: 'true' (string) e maxParallel: 3, config gerado.",
      "expected": "Paralelismo 1."
    },
    {
      "id": "C3",
      "input": "Args com parallelOk: true sem maxParallel, config gerado.",
      "expected": "Paralelismo 3 (padrão do intArg)."
    },
    {
      "id": "C4",
      "input": "Config sem generated e args com parallelOk: true e maxParallel: 2.",
      "expected": "Paralelismo 2, como hoje; o item (6) do relatório não aparece."
    },
    {
      "id": "C5",
      "input": "Execução liberada que termina com ação de operador (por exemplo infra) e com resumeArgs.",
      "expected": "Nem resumeArgs nem resumeWith de nenhuma ação trazem parallelOk; maxParallel continua neles."
    }
  ]
}
```
