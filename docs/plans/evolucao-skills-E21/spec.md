# Spec E21 -- Revisor por tarefa com achados identificados

## Intenção

O release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`) reconhece um achado repetido comparando arquivo e descrição normalizada (`sameFinding`), e o revisor por tarefa é um prompt montado no script (`buildTaskReviewPrompt`) despachado sem agente do plugin (SRC-02 §4, REQ-014). E21 cria o revisor por tarefa do plugin, faz o revisor devolver achados com identificador e reconhece a repetição pelo identificador (padrão), e acrescenta dois modos desligados por padrão: a nova revisão restrita aos achados abertos e ao diff da correção, com o diff gravado por um script do plugin, e a revisão única que devolve os dois veredictos numa chamada. O padrão continua o de hoje: dois laços (conformidade com o spec e qualidade), no modelo que o release usa hoje (DEC-021, DEC-543).

## Escopo

Dentro:

- Novo agente `plugins/productivity-tools/agents/task-reviewer.md` (`productivity-tools:task-reviewer`), que recebe o texto genérico dos prompts de revisão por tarefa (peça 3).
- Em `roadmap-release.js`: despacho da revisão por tarefa pelo agente; campo `id` opcional nos achados; repetição por identificador só no laço da revisão por tarefa (peça 1); modo de revisão restrita (peça 2) e modo de revisão única (peça 3), lidos de `release.config.json` e desligados por padrão.
- Novo script `plugins/productivity-tools/scripts/review-package.mjs` e seu teste `review-package.test.mjs` (critério 4).
- `skills/roadmap-release/scripts/preflight.mjs`: validação do campo `taskReview` e regra de permissão do script do pacote quando a revisão restrita está ligada; `references/config.md` documenta o campo.
- Testes em `workflow/review.test.mjs` (critérios 1 a 3), `workflow/prompts.test.mjs` (critério 5), `scripts/review-package.test.mjs` (critério 4); ajuste dos testes existentes de `prompts.test.mjs`, `flow.test.mjs` e `preflight.test.mjs` que conferem texto movido ou a lista `WORKFLOW_SCRIPTS`.
- Linha do agente na seção Agents de `plugins/productivity-tools/README.md`.
- Teste comportamental do revisor (SRC-03), tarefa do orquestrador da sessão principal (DEC-204).

Fora:

- As revisões de spec, de plano, final, de sincronização, de merge e de gates: continuam com `S_REVIEW`, `repeatRule()` e a comparação de texto de hoje.
- Ligar qualquer modo por padrão: só E27 decide, com medição (DEC-021).
- O implementador e os corretores (E9): `implAgent`, `testFirstGap` e `agents/implementer.md` não mudam (DEC-569, nota do dono).
- Verificação adversarial da revisão final (E24) e retomada sem repetir revisões (E23).
- O teto de `size.test.mjs` (240.000 caracteres LF, DEC-556, DEC-563) e o próprio arquivo: não mudam.
- Versão do plugin (sem bump, nota do dono) e a pasta do roadmap `docs/plans/roadmap-evolucao-skills/`.

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` nem editar `size.test.mjs`; não fazer push nem tocar em `main`.
- Não trocar o modelo nem o effort do revisor por tarefa (`reviewModelFor`, `effortFor`, DEC-543) nem `MAXFIX`.
- Não citar `superpowers` no agente, no script nem em prompt; não gravar relatório comportamental fictício.

## Desenho

**Critério 1 (achado reaberto com outra redação e o mesmo identificador é repetição).** O item de `ISSUES` ganha `id: STR`, opcional, o que não muda o contrato das outras revisões. `sameFinding(prevIssues, issues, blqIds, byId)` (bloco `// <pure>`) passa a reconhecer a repetição pelo identificador quando `byId` é verdadeiro e os dois achados têm `id` (`p.id === i.id`, sem olhar a redação), e pela comparação de arquivo e texto de hoje nos outros casos (achado sem `id`, ou `byId` falso) (R3). `runReviewLoop` lê `opt.byId` e o repassa a `sameFinding`; só o laço da revisão por tarefa em `runDeliverable` passa `byId: true`, e as revisões de spec, plano, final e de sincronização seguem sem ele (terceiro risco do card). `fmt` escreve `[<id>]` antes da descrição quando o achado tem identificador, para o revisor da rodada seguinte reusar o mesmo. O agente `task-reviewer.md` diz como numerar (`F1`, `F2`, ... por laço), que um achado ainda aberto da rodada anterior volta com o mesmo `id` mesmo reescrito, e que um achado novo recebe um número novo; o prompt da revisão por tarefa deixa de chamar `repeatRule()`. `review.test.mjs` confere por `loadPure()`: mesmo `id` com outra redação é repetição com `byId`; sem `byId`, a redação diferente não é; um achado sem `id` cai na comparação de texto; e um `runReviewLoop` com revisores simulados escala o corretor quando o achado volta com o mesmo `id` e outra redação.

**Critério 2 (nova revisão: intervalo inteiro por padrão; restrita como modo).** O modo vem de `release.config.json`: `taskReview: { restricted: boolean, single: boolean }`, ausente valendo falso, lido no script com `=== true` (R4). `runReviewLoop` passa à revisão de cada nova rodada um quarto argumento `{ iss, head }`, com os achados da rodada anterior e o `headSha` que o revisor anterior mediu. Na configuração padrão, `buildTaskReviewPrompt` continua mandando o revisor reler `git -C "<wt>" log -p <start>..HEAD` com os achados anteriores para verificar, como hoje. Com `restricted` ligado, numa nova revisão depois de uma correção (`prev` presente) e com todo achado aberto identificado, o prompt traz a linha de modo restrito, os achados abertos com `id` e o comando `node "<pluginRoot>/scripts/review-package.mjs" "<wt>" <head anterior> HEAD "<WT>/_tmp/<E>-t<n>-<kind><round>.diff"`, que o revisor roda para ler só o diff da correção (`pluginRoot` já calculado em `runDeliverable`; a limpeza de `<WT>/_tmp/<E>-*` já apaga o arquivo) (R5). O schema da revisão por tarefa passa a ser `S_TASKREVIEW`, que estende `S_REVIEW` com `verdicts` (lista de `{ id, open }`) e com `spec` e `quality` (`pass` ou `fail`). Uma função pura `taskIssues(r, opt)` monta os achados que `reviewTruth` recebe: no modo restrito, os achados novos de `r.issues` mais cada achado aberto cujo `id` voltou com `open: true` ou sem veredicto (veredicto ausente conta como aberto), sem duplicar por `id`. Se algum achado aberto não tem `id`, aquela rodada usa a releitura completa de hoje. `review.test.mjs` confere: o prompt padrão de nova revisão traz o `log -p` do intervalo inteiro e não traz o pacote; o prompt restrito traz os achados com `id`, o comando do pacote com a ponta anterior e não traz o `log -p` do intervalo; `taskIssues` com veredicto aberto, fechado e ausente; e o despacho no laço por tarefa (texto do script ou arnês de `flow.test.mjs`) usa o modo restrito só quando `taskReview.restricted === true`.

**Critério 3 (modo e modelo de hoje por padrão; revisão única como modo).** Uma função `revAgent = (p, o) => agent(p, { agentType: 'productivity-tools:task-reviewer', schema: S_TASKREVIEW, ...o })`, ao lado de `implAgent`, despacha toda revisão por tarefa, mantendo `model: rvModel || reviewModelFor(t)` e `effort: effortFor(...)` de hoje (R1, R2). Na configuração padrão o laço continua `for (const kind of ['spec', 'quality'])`, dois laços em sequência, cada um com seu corretor, como hoje. Com `single` ligado, a lista é `['review']`: um laço cuja revisão é uma chamada só, no mesmo modelo e effort, que devolve `spec` e `quality`; `taskIssues` acrescenta um achado crítico `defeito` quando um dos dois veredictos falta, ou vem `fail` sem achado bloqueante, para que o laço não aprove uma tarefa reprovada (R6). O corretor dessa rodada é o mesmo `implAgent` de hoje com `kind` `review` no texto e no rótulo (`<E>:t<n>:review-fix<k>`), sem mudar `implAgent` nem `agents/implementer.md`. `review.test.mjs` confere: na configuração padrão, duas revisões por tarefa com rótulos `:spec` e `:quality`, `agentType` do revisor e o modelo de `reviewModelFor`; com `single`, uma revisão por rodada com rótulo `:review` e o mesmo modelo; e `taskIssues` reprova veredicto ausente ou `fail` sem achado.

**Critério 4 (script do pacote de revisão).** `plugins/productivity-tools/scripts/review-package.mjs` recebe `<repo> <base> <tip> <out>` e chama o git por `execFileSync`, sem shell (R7). Recusa com saída 1 e `{"ok":false,"error":...}` no stdout, sem gravar nada, quando `base` ou `tip` não resolvem a um commit (`git rev-parse --verify <ref>^{commit}`) ou quando `base` não é ancestral de `tip` (`git merge-base --is-ancestor`); uso inválido sai com 2. No intervalo válido, cria a pasta de `out` se faltar e grava um único arquivo com cabeçalho (base e ponta resolvidas, `git log --format=%h %s base..tip`) seguido de `git diff base tip`; um intervalo vazio é válido e grava o cabeçalho sem diff. Imprime `{"ok":true,"path","base","tip","commits","bytes"}`. O script fica em `scripts/` do plugin e a regra de permissão casa pelo nome do arquivo (DEC-060): `WORKFLOW_SCRIPTS` em `preflight.mjs` ganha `review-package.mjs`, com o caminho derivado da raiz do plugin, e o preflight só o lista em `missingRules` quando `taskReview.restricted` é `true`, para não parar as execuções na configuração padrão (R8); `validateReleaseConfig` recusa `taskReview` que não seja objeto com campos booleanos. `review-package.test.mjs` cria um repositório git temporário e confere: um arquivo único com o diff do intervalo e o cabeçalho; ref inexistente e base não ancestral recusadas com saída 1 e nenhum arquivo gravado; intervalo vazio aceito.

**Critério 5 (prompts de revisão por tarefa sem superpowers e proibindo perguntar).** `agents/task-reviewer.md` tem frontmatter `name: task-reviewer`, `description` (diz que nunca pergunta à pessoa e que só lê) e `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort` (R2). O corpo traz a frase de `NO_ASK` literal; a precedência do prompt da chamada; os modos `spec`, `quality` e `review` e a nova revisão restrita, escolhidos pela linha de modo do prompt; e o texto que sai de `buildTaskReviewPrompt`: só leitura e não confiar no relato do implementador, as duas listas de bloqueio (spec e qualidade), as regras de reexecutar verificações (sem trava e sem efeito externo), a regra de `ambiente`, a numeração dos identificadores, `verdicts` e os dois veredictos. No prompt da chamada ficam só os dados: tarefa, plano, spec, intervalo, `rangeNote`, modo, resumo e verificações do implementador, achados anteriores e a linha de medida. Todo prompt continua abrindo com `briefing(ctx)`, cujo `COMMON_BASE` proíbe perguntar (R10). `prompts.test.mjs` confere: `roadmap-release.js` não contém `superpowers`; toda chamada com `S_TASKREVIEW` passa por `revAgent`; o prompt de cada modo (padrão spec e qualidade, restrito e único) abre com o briefing; `agents/task-reviewer.md` não contém `superpowers` e contém a frase de `NO_ASK` extraída do script. Os asserts existentes sobre o texto movido (verificações, travas, efeito externo, repetição exata) passam a conferir o agente, sem perder o que conferem.

**Tamanho do script.** `roadmap-release.js` mede 239.997 caracteres LF, 3 sob o teto (nota do dono). `buildTaskReviewPrompt` tem cerca de 1.850 caracteres, dos quais perto de 1.300 são texto genérico, mais os cerca de 190 do texto de verificações vazias de `fmtChecks`. A primeira tarefa que edita o script move esse texto para o agente e troca o despacho por `revAgent` antes de acrescentar qualquer outro código; cada tarefa seguinte mede com `workflowChars` de `size.test.mjs` depois de cada edição; se o total passar de 240.000, a tarefa para com BLOCKED e uma ação do dono, sem editar `size.test.mjs` (R9).

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal (DEC-204), no worktree de E21 antes do merge: no workflow ela devolve NEEDS_HUMAN, sem relatório fictício. O orquestrador despacha subagents que seguem `agents/task-reviewer.md` literalmente sobre uma fixture sintética marcada numa pasta temporária, um por modo (padrão, restrito e único), cada um listando as ambiguidades, com uma revisão adversarial só de leitura, e grava `docs/reports/2026-11-12-E21-revisor-comportamental.md` (R11).

**README.** A seção Agents de `plugins/productivity-tools/README.md` ganha a linha do `task-reviewer`; sem bump (R12).

## Deixado para o plano

- A ordem das tarefas: script do pacote com teste (não edita o workflow); agente e troca do despacho, liberando espaço primeiro; identificadores; modo restrito; modo único; preflight, config.md e README; comportamental.
- O texto exato de `agents/task-reviewer.md`, da linha de modo e dos achados de `taskIssues`, respeitando R1, R5, R6 e R10.
- Como os testes dos critérios 2 e 3 localizam o despacho no laço (texto do script ou arnês de `flow.test.mjs` copiado para `review.test.mjs`).
- A medição de tamanho depois de cada edição do script; os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo.

```json data
{
  "schema": "spec/1",
  "id": "E21",
  "title": "Revisor por tarefa com achados identificados",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um achado reaberto com outra redação e o mesmo identificador, quando o workflow compara as rodadas, então o reconhece como repetição. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada a configuração padrão, quando o workflow despacha uma nova revisão após uma correção, então o revisor relê o intervalo inteiro da tarefa, como hoje; com o modo de revisão restrita ligado, recebe só os achados abertos e o diff da correção e devolve um veredicto por identificador. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dada a configuração padrão, quando o workflow revisa uma tarefa, então usa o modo e o modelo de revisão que o release usa hoje; com o modo de revisão única ligado, faz uma chamada que devolve os dois veredictos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC4",
      "text": "Dadas a base e a ponta do intervalo de uma tarefa, quando o script do pacote de revisão roda, então grava um único arquivo com o diff do intervalo e recusa um intervalo inválido. {verify: test; evidence: node --test plugins/productivity-tools/scripts/review-package.test.mjs}"
    },
    {
      "id": "AC5",
      "text": "Dados os prompts de revisão por tarefa, em todos os modos, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como é o revisor do plugin para a revisão por tarefa e como é despachado?",
      "decision": "Um agente do plugin, productivity-tools:task-reviewer (agents/task-reviewer.md), com os modos spec, quality e review e a nova revisão restrita; toda revisão por tarefa o despacha por agentType através de uma função revAgent com schema S_TASKREVIEW; as outras revisões não mudam.",
      "basis": "Peça 3 do card; DEC-057 comprova agentType em workflow; DEC-569 usou o mesmo desenho no implementador; a nota do dono manda o texto dos prompts de revisão por tarefa para o agente.",
      "alternative": "Um revisor genérico do plugin para todas as revisões do release.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "O frontmatter do revisor fixa modelo, effort ou ferramentas de escrita?",
      "decision": "Não: tools Read, Grep, Glob, Bash, sem model nem effort; cada chamada passa o model e o effort de hoje (rvModel ou reviewModelFor, effortFor).",
      "basis": "DEC-543 tira o modelo do revisor da rota; DEC-570 evitou model no frontmatter do implementador porque a sonda não mediu se o da chamada vence; o revisor só lê e roda git, verificações e o script do pacote.",
      "alternative": "model: sonnet e effort: medium no frontmatter.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o achado ganha identificador e como a repetição é reconhecida?",
      "decision": "Campo id opcional no item de ISSUES, numerado F<n> pelo revisor por laço e reusado num achado ainda aberto; sameFinding compara por id quando recebe byId e os dois achados têm id, e pelo texto de hoje nos outros casos; só o laço por tarefa passa byId: true; fmt mostra [id].",
      "basis": "Peça 1 e critério 1; terceiro risco do card: identificador ligado por estágio, só na revisão por tarefa, sem quebrar os testes atuais do laço.",
      "alternative": "O script numera os achados pela posição em cada rodada.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde se ligam os modos de revisão reduzida?",
      "decision": "Campo taskReview { restricted, single } de release.config.json, ausente valendo falso, lido com === true; preflight recusa valor que não seja objeto com booleanos; config.md documenta.",
      "basis": "Os critérios 2 e 3 falam de configuração padrão; DEC-021 manda os modos entrarem desligados; o arquivo de configuração é por roadmap e E27 o muda com decisão.",
      "alternative": "Argumentos por execução (args.taskReview).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como funciona a nova revisão restrita?",
      "decision": "Só numa nova revisão depois de correção: o prompt traz os achados abertos com id e o comando de review-package.mjs da ponta medida pela revisão anterior até HEAD; o revisor devolve verdicts { id, open }; taskIssues junta os novos achados e os abertos (veredicto ausente conta como aberto); se algum achado aberto não tem id, a rodada usa a releitura completa.",
      "basis": "Peça 2 e critério 2; runReviewLoop já tem o headSha da revisão anterior; contar veredicto ausente como aberto evita fechar achado em silêncio.",
      "alternative": "O revisor calcula o diff da correção com git por conta própria, sem script.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como funciona a revisão única?",
      "decision": "Laço com kind review e uma chamada por rodada, no mesmo modelo e effort, que devolve spec e quality (pass ou fail); veredicto ausente ou fail sem achado bloqueante vira achado crítico defeito; o corretor é o implAgent de hoje com kind review.",
      "basis": "Peça 3 e critério 3; a reprovação em código impede aprovar uma tarefa que um dos veredictos reprovou.",
      "alternative": "Duas chamadas em paralelo, uma por veredicto.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual é o contrato do script do pacote de revisão?",
      "decision": "node review-package.mjs <repo> <base> <tip> <out>; git por execFileSync sem shell; recusa com saída 1 e nada gravado ref que não resolve a commit ou base não ancestral; uso inválido sai 2; grava um arquivo com cabeçalho e git diff base tip; intervalo vazio é válido; imprime JSON com ok, path, base, tip, commits e bytes.",
      "basis": "Critério 4; a correção pode não gerar commit (discordância técnica) e o revisor ainda julga os achados abertos.",
      "alternative": "Recusar também o intervalo vazio.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Quando o preflight lista a regra de permissão do script do pacote?",
      "decision": "WORKFLOW_SCRIPTS ganha review-package.mjs, com caminho derivado da raiz do plugin, e o preflight só o põe em missingRules quando taskReview.restricted é true.",
      "basis": "DEC-060 e quarto risco do card (regra pelo nome do arquivo, script no plugin); listar sempre pararia as execuções padrão por uma regra que elas não usam (DEC-552).",
      "alternative": "Listar a regra em toda execução.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como E21 cabe sob o teto de 240.000 caracteres com folga de 3?",
      "decision": "A primeira tarefa que edita o script move para o agente o texto genérico de buildTaskReviewPrompt e o texto de verificações vazias de fmtChecks e troca o despacho por revAgent antes de acrescentar código; medir com workflowChars depois de cada edição; se passar, BLOCKED com ação do dono, sem editar size.test.mjs.",
      "basis": "DEC-556 e DEC-563 fixam o teto; a nota do dono manda liberar espaço primeiro movendo os prompts de revisão por tarefa para o agente.",
      "alternative": "Encurtar textos de outros estágios do workflow.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Onde fica a proibição de perguntar à pessoa nos prompts de revisão por tarefa?",
      "decision": "Na frase de NO_ASK literal no corpo do agente e no briefing com que todo prompt abre (COMMON_BASE); os prompts não repetem NO_ASK, e o teste amarra o texto do agente à constante do script.",
      "basis": "REQ-013; o mesmo arranjo de DEC-575 no implementador; repetir NO_ASK em cada modo gasta caracteres que o teto não tem.",
      "alternative": "Interpolar NO_ASK em cada prompt de revisão por tarefa.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como fazer o teste comportamental do revisor pedido pela definição de pronto?",
      "decision": "Tarefa do orquestrador da sessão principal no worktree de E21 antes do merge: no workflow devolve NEEDS_HUMAN, sem relatório fictício; o orquestrador despacha subagents que seguem agents/task-reviewer.md literalmente em cada modo sobre fixture sintética marcada, com revisão adversarial só de leitura, e grava docs/reports/2026-11-12-E21-revisor-comportamental.md.",
      "basis": "SRC-03 e DEC-204 (o executor do workflow não tem ferramenta de subagent); nota do dono.",
      "alternative": "Rodar o release inteiro em sandbox com o revisor novo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Há bump de versão e documentação do agente novo?",
      "decision": "Sem bump; a seção Agents de plugins/productivity-tools/README.md ganha a linha do task-reviewer.",
      "basis": "Nota do dono (sem bump); DEC-577 fez o mesmo com o implementer.",
      "alternative": "Subir a versão nos dois lugares.",
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
      "input": "Na revisão por tarefa, a segunda rodada devolve o achado F1 com outra redação depois de uma correção em sonnet.",
      "expected": "sameFinding com byId reconhece a repetição e o corretor sobe para opus com a rodada extra; nas outras revisões a comparação continua pelo texto."
    },
    {
      "id": "C2",
      "input": "taskReview.restricted true e um achado aberto sem id.",
      "expected": "Aquela nova revisão usa a releitura completa do intervalo, como na configuração padrão."
    },
    {
      "id": "C3",
      "input": "Revisão restrita que omite o veredicto de um id aberto.",
      "expected": "taskIssues conta o achado como aberto e o laço o trata como repetição."
    },
    {
      "id": "C4",
      "input": "review-package.mjs com ref inexistente ou com base que não é ancestral da ponta.",
      "expected": "Saída 1 com ok false e o erro, e nenhum arquivo gravado."
    },
    {
      "id": "C5",
      "input": "Depois de uma edição, roadmap-release.js passa de 240.000 caracteres LF.",
      "expected": "A tarefa para com BLOCKED e ação do dono; size.test.mjs não é editado."
    }
  ]
}
```
