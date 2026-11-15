# Spec E28 -- Revisão única por tarefa com dois veredictos (metade adiada do critério 3 de E21)

## Intenção

Hoje o release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`) revisa cada tarefa em dois laços em sequência, `spec` e `quality`, cada um com seu revisor e seu corretor, despachados por `revAgent` para o agente `productivity-tools:task-reviewer` (E21). A revisão única com dois veredictos foi escrita em E21 (T5, `f8df406`) e revertida em `0ee4677` porque não cabia no teto da época (DEC-597 emendada por DEC-598); o texto do modo `review` ficou sem uso em `agents/task-reviewer.md` e os campos `spec` e `quality` de `S_TASKREVIEW` também (DEC-600). E28 entrega essa metade como modo desligado por padrão: com `taskReview.single` verdadeiro em `release.config.json`, cada rodada da revisão por tarefa é uma chamada só, laço `kind` `review`, que devolve os dois veredictos `spec` e `quality` (DEC-589, confirmado aqui como ponto de partida por DEC-607). O padrão continua o de hoje, dois laços no modelo e effort de hoje (DEC-021); só E27 decide ligar o modo, com medição.

## Escopo

Dentro:

- `roadmap-release.js`: normalização única de `taskReview` com `single` ao lado de `restricted`; laço por tarefa `['review']` quando `TR.single`, senão `['spec', 'quality']`; `taskIssues` acrescenta o achado crítico `defeito` de veredicto (peça 1).
- `agents/task-reviewer.md`: o texto do modo `review` passa a ser usado; ganha a combinação com o modo restrito (peça 2).
- `skills/roadmap-release/scripts/preflight.mjs`: `validateReleaseConfig` volta a aceitar `taskReview.single` booleano ao lado de `restricted`; `references/config.md` documenta a chave (peça 2).
- Testes: `workflow/review.test.mjs` (critérios 1 e 3), `workflow/prompts.test.mjs` (critério 2), `workflow/flow.test.mjs` (complemento ponta a ponta do critério 1), `scripts/preflight.test.mjs` (chaves de `taskReview`); ajuste dos testes de E21 que afirmam a ausência de `single` (`AC2: taskReview is normalized once ...` e `AC3: by default each task gets the spec and quality reviews on today's model` em `review.test.mjs`; `E21: validateReleaseConfig accepts a missing taskReview and restricted only ...` em `preflight.test.mjs`).

Fora:

- Ligar o modo por padrão: só E27 decide, com medição e decisão ratificada (DEC-021, segundo risco do card).
- As outras revisões (spec, plano, final, sincronização, delta, merge, gates): seguem com `S_REVIEW`, `repeatRule()` e o laço de hoje; o texto e os comentários delas não mudam.
- O teto de `size.test.mjs` (`MAX_WORKFLOW_CHARS = 250000` LF, DEC-647) e o próprio arquivo: não mudam.
- Versão do plugin (sem bump) e a pasta do roadmap `docs/plans/roadmap-evolucao-skills/`.
- As pendências de E28 anotadas em `state.md` (auditoria das cópias por modelo de DEC-715, notas de revisão de `2bb59c6`, `7ee7f23` e do `reviews.md` do 2º plan-only, negações espontâneas da 2ª sonda, nota de `(no checks reported)` na retomada review-owed do coordinator): ficam fora deste card; nenhuma é exigida pelos critérios. Continuam para um fix próprio ou para a próxima edição do workflow.
- `implAgent`, `agents/implementer.md`, `testFirstGap`, `MAXFIX`, `reviewModelFor`, `effortFor` e `sameFinding`: não mudam.

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` nem editar `size.test.mjs`; não tocar texto ou comentário de outro estágio para abrir espaço.
- Não ler `taskReview` cru fora da normalização única; não usar `single` para mudar modelo, effort, corretor ou número de rodadas.
- Não citar `superpowers` no agente, no script nem em prompt; não fazer push nem tocar em `main` ou na branch de release.

## Critérios de aceite (literais do card)

1. Dado o modo de revisão única ligado, quando o workflow revisa uma tarefa, então faz uma chamada que devolve os dois veredictos, spec e quality, e um veredicto ausente ou reprovado sem achado bloqueante vira achado crítico de defeito. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}
2. Dados os prompts de revisão por tarefa com o modo de revisão única ligado, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}
3. Dada a configuração padrão, quando o workflow revisa uma tarefa, então segue em dois laços e não lê `taskReview.single`; o teste de tamanho do script continua passando sem mudar o teto. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}

## Folga medida (condição de início do card)

O card só começa com pelo menos 450 caracteres de folga medida em `roadmap-release.js`. Medido em 2026-11-15 na ponta `1017db5` da release (worktree `D:/projects/claude-play-wt/E28`, branch `feat/E28`), sobre o texto commitado em LF:

```
node -e "const s=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\r\n/g,'\n').length;console.log(s,250000-s)"
241819 8181
```

O mesmo valor sai de `git show HEAD:plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (241.819 caracteres). Teto 250.000 (DEC-647), folga 8.181 ≥ 450: o card pode começar. O acréscimo previsto de E28 no script é de algumas centenas de caracteres (normalização, laço e `taskIssues`); o texto genérico do modo fica no agente, que não conta no teto.

## Desenho

**Uma chamada, dois veredictos (critério 1, R1).** `runDeliverable` normaliza `taskReview` uma vez, antes do laço por tarefa: `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }` (`CFG.taskReview` continua lido uma única vez; só `true` liga cada modo). O laço passa a `for (const kind of TR.single ? ['review'] : ['spec', 'quality'])`. Com `review`, cada rodada é uma chamada de `revAgent` com o mesmo `model: rvModel || reviewModelFor(t)` e `effort: effortFor(...)` de hoje, rótulo `${E}:t${n}:review${round}` e estágio `T${n}:review`; o prompt sai de `buildTaskReviewPrompt` sem mudança de código, pois a linha `Mode: ${kind}` já escreve `Mode: review`. `S_TASKREVIEW` já declara `spec` e `quality` (`PF`: `pass` ou `fail`), sem torná-los obrigatórios, e não muda. O corretor é o `implAgent` de hoje, com `kind` `review` no texto (`fix the review problems below`) e no rótulo (`review-fix<k>`), como manda DEC-589; o laço, `MAXFIX`, a escalada por repetição e `byId: true` não mudam.

**Veredicto ausente ou reprovado vira achado (critério 1, R2).** `taskIssues(r, c)` (bloco `// <pure>`) continua montando os achados que `reviewTruth` recebe e ganha uma regra, só quando `c.taskReview.single` é verdadeiro: se `r.spec !== 'pass'` ou `r.quality !== 'pass'` (veredicto ausente, `fail` ou outro valor) e a lista final não tem achado bloqueante (`blocking`), acrescenta um achado `{ severity: 'critical', category: 'defeito', description: 'single review: spec or quality verdict missing or fail, no blocking finding' }`. Um `fail` acompanhado de achado bloqueante não ganha outro (o achado já leva a rodada ao corretor); dois `pass` sem achado passam. A leitura de "ausente ou reprovado sem achado bloqueante" é a de DEC-589: o qualificador "sem achado bloqueante" vale para os dois casos, de modo que a regra é uma rede de segurança e nunca duplica um achado real. O achado não tem `id`; se o revisor omitir o veredicto de novo, `sameFinding` reconhece a repetição pelo texto e o laço escala como em qualquer achado repetido (C5). Fora do modo único, `taskIssues` devolve o mesmo valor de hoje, sem olhar `spec` nem `quality`.

**Preflight e documentação (peça 2, R3).** `validateReleaseConfig` aceita em `taskReview` as chaves `restricted` e `single`, cada uma booleana quando presente; recusa `taskReview` que não é objeto (`taskReview must be an object`), valor não booleano (`taskReview.<chave> must be a boolean`) e qualquer outra chave, nomeando-a (`taskReview.<chave> is not a supported key (only taskReview.restricted and taskReview.single)`). A regra de permissão de `review-package.mjs` continua só com `restricted === true`: o modo único não roda script novo. A linha `taskReview` de `references/config.md` passa a documentar as duas chaves: `single` troca os dois laços por uma chamada por rodada com os dois veredictos, desligado por padrão, E27 decide ligar; a frase "any other key" continua.

**Interação de `single` com `restricted` (R4).** Os dois modos se combinam. Com os dois ligados, a primeira rodada é `Mode: review`; uma nova rodada depois de correção, com todo achado aberto identificado, é `Mode: restricted, review` (o prompt de hoje já monta isso): o revisor lê o pacote da correção, devolve `verdicts` para os achados abertos e, além disso, `spec` e `quality` sobre a tarefa como ficou. `taskIssues` aplica primeiro a junção do modo restrito (achados novos mais os abertos sem veredicto que os feche) e depois a regra de veredicto sobre essa lista. Um achado aberto sem `id` faz a rodada usar a releitura completa, como em E21, e a regra de veredicto vale do mesmo jeito. O agente ganha uma frase na seção do modo `review` dizendo como responder a `restricted, review`.

**Prompts sem superpowers e proibindo perguntar (critério 2, R5).** O prompt do modo único é o mesmo `buildTaskReviewPrompt`, que abre com `briefing(ctx)`, cujo `COMMON_BASE` proíbe perguntar ("Asking the user is FORBIDDEN"); o agente traz a frase de `NO_ASK` literal (E21, R10). O corretor do modo único abre com `C()` (o mesmo briefing). `prompts.test.mjs` ganha um teste que monta o prompt de `kind` `review` com `taskReview: { single: true }` e com `{ single: true, restricted: true }` e um achado aberto identificado, e confere: abre com o briefing, traz `Mode: review` (ou `Mode: restricted, review`), não cita `superpowers`; a seção `## Review mode` do agente não cita `superpowers`, manda aplicar as duas listas de bloqueio, exige achado bloqueante para cada `fail` e descreve a combinação com `verdicts`; o trecho do corretor no laço por tarefa abre com `${C()}` e usa `${kind}`, de modo que vale para `review`.

**Padrão de hoje e `taskReview.single` não lido (critério 3, R6).** Na configuração padrão (`taskReview` ausente, `{}`, `{ restricted: ... }` ou `single` diferente de `true`), `TR.single` é falso, o laço é `['spec', 'quality']` e `taskIssues` não olha os veredictos. "Não lê `taskReview.single`" fica verificável assim: o script não contém a expressão `taskReview.single`; em `runDeliverable`, `.single` aparece só na linha da normalização e na linha do laço; e uma configuração com `single: 'true'` (texto) segue em dois laços. `review.test.mjs` confere esses pontos por texto do script e por `taskIssues` puro; `flow.test.mjs` confere os rótulos `spec1` e `quality1` no padrão e com `single: 'true'`. O teste de tamanho roda sem mudança.

**Teste comportamental (definição de pronto, SRC-03).** O agente muda (seção do modo `review`), então o teste comportamental se repete só para os modos `review` e `restricted, review`, como em E21: tarefa do orquestrador da sessão principal (DEC-204), no worktree de E28 antes do merge, com subagents que seguem `agents/task-reviewer.md` literalmente sobre uma fixture sintética marcada; no workflow ela não roda e não vira relatório fictício. Não é tarefa deste plano.

**Tamanho.** Toda tarefa que edita `roadmap-release.js` mede depois de cada edição com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` e relata o total. Acima de 250.000 caracteres LF, a tarefa para com `BLOCKED` e ação do dono, sem editar `size.test.mjs` nem o teto (DEC-647) e sem tocar outro estágio (R7).

## Riscos

- O modo vira padrão sem medição -> o critério 3 fixa o padrão de hoje e o teste confere os dois laços com `single` ausente ou não booleano; só E27 muda isso, com decisão ratificada.
- O achado de veredicto vai ao corretor, que não consegue "consertar" uma omissão do revisor -> o achado só entra sem nenhum achado bloqueante; a omissão repetida escala e termina com a mensagem de achado repetido, que o dono vê como falha de conteúdo (C5). Tratar veredicto ausente como revisão nula (nova chamada `1b`) seria outra decisão, fora de DEC-589.
- A combinação `restricted, review` confunde o revisor (pacote só da correção, veredictos sobre a tarefa inteira) -> o agente diz o que devolver; a regra de veredicto pega a falta de `spec` ou `quality`; o teste comportamental da definição de pronto (SRC-03), feito pelo orquestrador da sessão principal fora das tarefas do plano (DEC-204), exercita os modos `review` e `restricted, review`.
- Os testes de E21 que afirmam a ausência de `single` quebram -> são ajustados na mesma tarefa que muda o script, sem perder o que conferem (só `true` liga; `CFG.taskReview` lido uma vez; modelo e effort de hoje).
- O script passa do teto -> folga medida de 8.181 caracteres, acréscimo previsto de centenas; medição depois de cada edição e `BLOCKED` acima de 250.000.

## Deixado para o plano

- Ordem das tarefas: preflight e `config.md`; script com `review.test.mjs` e `flow.test.mjs`; agente e `prompts.test.mjs`; gates.
- O texto exato das mensagens do preflight e do achado de veredicto, os nomes dos testes e os retornos simulados do arnês de `flow.test.mjs` para o rótulo `review1` (que hoje não tem retorno padrão).
- Os gates G1 (subconjunto do release), G2, G3 e G5 na tarefa final; a revisão final da branch inteira é estágio do workflow, não tarefa.

```json data
{
  "schema": "spec/1",
  "id": "E28",
  "title": "Revisão única por tarefa com dois veredictos (metade adiada do critério 3 de E21)",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o modo de revisão única ligado, quando o workflow revisa uma tarefa, então faz uma chamada que devolve os dois veredictos, spec e quality, e um veredicto ausente ou reprovado sem achado bloqueante vira achado crítico de defeito. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dados os prompts de revisão por tarefa com o modo de revisão única ligado, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dada a configuração padrão, quando o workflow revisa uma tarefa, então segue em dois laços e não lê `taskReview.single`; o teste de tamanho do script continua passando sem mudar o teto. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como uma chamada devolve os dois veredictos?",
      "decision": "taskReview normalizado uma vez em runDeliverable (const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }); o laço por tarefa usa TR.single ? ['review'] : ['spec', 'quality']; com review, uma chamada de revAgent por rodada, no model e effort de hoje, com o prompt de buildTaskReviewPrompt (Mode: review) e S_TASKREVIEW (spec e quality pass ou fail), sem mudar o schema; o corretor é o implAgent de hoje com kind review.",
      "basis": "Peça 1 do card; DEC-589 e DEC-607 (desenho de partida confirmado); DEC-600 (texto do modo review já no agente e campos já no schema).",
      "alternative": "Duas chamadas em paralelo, uma por veredicto.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como um veredicto ausente ou reprovado sem achado bloqueante vira achado?",
      "decision": "taskIssues, só com taskReview.single verdadeiro, acrescenta um achado critical/defeito ('single review: spec or quality verdict missing or fail, no blocking finding') quando spec ou quality não é 'pass' e a lista final, depois da junção do modo restrito, não tem achado bloqueante; fail com achado bloqueante não ganha outro; fora do modo único devolve o mesmo valor de hoje.",
      "basis": "Critério 1 do card e DEC-589; o qualificador 'sem achado bloqueante' vale para ausente e para reprovado, para nunca duplicar um achado real.",
      "alternative": "Veredicto ausente vira achado mesmo com achado bloqueante presente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O que o preflight aceita em taskReview?",
      "decision": "validateReleaseConfig aceita restricted e single, cada um booleano quando presente; recusa taskReview que não é objeto, valor não booleano e qualquer outra chave, nomeando-a; a regra de review-package.mjs continua só com restricted === true; config.md documenta as duas chaves, desligadas por padrão, E27 decide ligar.",
      "basis": "Peça 2 do card; DEC-598 tirou single do preflight e do config.md em E21 para voltar aqui.",
      "alternative": "Aceitar single como qualquer valor e deixar o workflow ignorar o que não for true.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como single interage com restricted?",
      "decision": "Os modos se combinam: a primeira rodada é Mode: review; a nova rodada após correção, com todo achado aberto identificado, é Mode: restricted, review, e o revisor devolve verdicts para os achados abertos e spec e quality sobre a tarefa; taskIssues aplica a junção restrita e depois a regra de veredicto; o agente ganha uma frase para a combinação.",
      "basis": "O prompt de hoje já monta 'restricted, <kind>'; DEC-021 trata os dois como modos independentes, desligados por padrão; E27 mede combinações.",
      "alternative": "single desliga restricted (a nova rodada do modo único relê o intervalo inteiro).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como os prompts do modo único proíbem perguntar e ficam sem superpowers?",
      "decision": "O mesmo buildTaskReviewPrompt, que abre com briefing(ctx) (COMMON_BASE proíbe perguntar), o agente com a frase de NO_ASK literal e o corretor que abre com C(); prompts.test.mjs confere o prompt de review com single e com single e restricted, a seção Review mode do agente e o trecho do corretor.",
      "basis": "Critério 2 do card; mesmo arranjo de E21 (R10 de E21, DEC-575).",
      "alternative": "Interpolar NO_ASK no prompt do modo único.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como se verifica que a configuração padrão segue em dois laços e não lê taskReview.single?",
      "decision": "O script não contém a expressão taskReview.single; em runDeliverable, .single aparece só na normalização e na linha do laço; taskIssues sem single devolve r.issues sem olhar veredictos; flow.test.mjs confere spec1 e quality1 no padrão e com single: 'true'; o teste de tamanho roda sem mudança.",
      "basis": "Critério 3 do card; segundo risco do card (só E27 muda o padrão); ler a chave uma vez na normalização é o mínimo para o modo existir.",
      "alternative": "Ler taskReview.single só quando a chave existe ('single' in tr), sem normalização.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como E28 cabe sob o teto?",
      "decision": "Folga medida de 8.181 caracteres LF (241.819 de 250.000) na ponta 1017db5; o texto genérico do modo fica no agente; medir com size.test.mjs depois de cada edição do script; acima de 250.000, BLOCKED com ação do dono, sem editar size.test.mjs nem o teto e sem tocar outro estágio.",
      "basis": "Condição de início do card (450 caracteres); DEC-647 (teto 250.000, nunca aumentado sem decisão do dono).",
      "alternative": "Encurtar texto de outros estágios.",
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
      "input": "single ligado; a revisão devolve spec 'pass', sem quality e sem achados.",
      "expected": "taskIssues acrescenta um achado critical/defeito de veredicto e o corretor E1:t1:review-fix1 é chamado."
    },
    {
      "id": "C2",
      "input": "single ligado; quality 'fail' com um achado bloqueante.",
      "expected": "Nenhum achado extra; a rodada segue para o corretor só com o achado do revisor."
    },
    {
      "id": "C3",
      "input": "single e restricted ligados; nova rodada depois de correção com todo achado aberto identificado.",
      "expected": "Prompt com Mode: restricted, review e o comando do pacote; taskIssues junta achados novos e abertos sem veredicto que os feche e depois aplica a regra de veredicto."
    },
    {
      "id": "C4",
      "input": "taskReview { single: 'true' } (texto).",
      "expected": "O preflight recusa com taskReview.single must be a boolean; se o workflow rodar mesmo assim, TR.single é falso e a tarefa segue em dois laços."
    },
    {
      "id": "C5",
      "input": "single ligado; o revisor omite os veredictos em duas rodadas seguidas, sem achados.",
      "expected": "O achado de veredicto repete pelo texto, o corretor escala de tier e, já em opus, o laço para com 'the same finding reappeared after a fix at opus'."
    }
  ]
}
```
