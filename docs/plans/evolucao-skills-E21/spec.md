# Spec E21 -- Revisor por tarefa com achados identificados

## Intenção

O release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`) reconhece um achado repetido comparando arquivo e descrição normalizada (`sameFinding`), e o revisor por tarefa é um prompt montado no script (`buildTaskReviewPrompt`) despachado sem agente do plugin (SRC-02 §4, REQ-014). E21 cria o revisor por tarefa do plugin, faz o revisor devolver achados com identificador e reconhece a repetição pelo identificador (padrão), e acrescenta um modo desligado por padrão: a nova revisão restrita aos achados abertos e ao diff da correção, com o diff gravado por um script do plugin. O padrão continua o de hoje: dois laços (conformidade com o spec e qualidade), no modelo que o release usa hoje (DEC-021, DEC-543). A revisão única com dois veredictos saiu de E21 para o card E28 (DEC-597 emendada por DEC-598, estratégia v1.6); o critério 3 deste card ficou só com a metade padrão.

## Escopo

Dentro:

- Novo agente `plugins/productivity-tools/agents/task-reviewer.md` (`productivity-tools:task-reviewer`), que recebe o texto genérico dos prompts de revisão por tarefa (peça 3).
- Em `roadmap-release.js`: despacho da revisão por tarefa pelo agente; campo `id` opcional nos achados; repetição por identificador só no laço da revisão por tarefa (peça 1); modo de revisão restrita (peça 2), lido de `release.config.json` e desligado por padrão.
- Novo script `plugins/productivity-tools/scripts/review-package.mjs` e seu teste `review-package.test.mjs` (critério 4).
- `skills/roadmap-release/scripts/preflight.mjs`: validação do campo `taskReview`, que aceita só a chave `restricted` (DEC-599), e regra de permissão do script do pacote quando a revisão restrita está ligada; `references/config.md` documenta só `restricted`.
- Testes em `workflow/review.test.mjs` (critérios 1 a 3), `workflow/prompts.test.mjs` (critério 5), `scripts/review-package.test.mjs` (critério 4) e `scripts/preflight.test.mjs` (chaves de `taskReview`); ajuste dos testes existentes de `prompts.test.mjs`, `flow.test.mjs` e `preflight.test.mjs` que conferem texto movido ou a lista `WORKFLOW_SCRIPTS`; volta dos testes da metade padrão do critério 3 removidos por `0ee4677`.
- Linha do agente na seção Agents de `plugins/productivity-tools/README.md`.
- Teste comportamental do revisor (SRC-03), tarefa do orquestrador da sessão principal (DEC-204, DEC-601), já feita e commitada (`c72dafc`).

Fora:

- A revisão única com dois veredictos (`taskReview.single`, laço `kind` `review`, reprovação de veredicto no `taskIssues`): card E28 (DEC-597, DEC-598, DEC-589 passa a E28 por DEC-600). E21 não a reimplementa.
- `agents/task-reviewer.md` não muda na retomada: o texto do modo `review` e os campos `spec` e `quality` de `S_TASKREVIEW` ficam sem uso, para E28 (DEC-600).
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
- Na retomada: não reescrever nem refazer as tarefas 1 a 9 do plano, não rodar de novo a tarefa 8 nem reescrever seu relatório, não desfazer `3b5c950`, não editar `agents/task-reviewer.md` nem tocar texto ou comentário de outro estágio de `roadmap-release.js`.

## Desenho

**Critério 1 (achado reaberto com outra redação e o mesmo identificador é repetição).** O item de `ISSUES` ganha `id: STR`, opcional, o que não muda o contrato das outras revisões. `sameFinding(prevIssues, issues, blqIds, byId)` (bloco `// <pure>`) passa a reconhecer a repetição pelo identificador quando `byId` é verdadeiro e os dois achados têm `id` (`p.id === i.id`, sem olhar a redação), e pela comparação de arquivo e texto de hoje nos outros casos (achado sem `id`, ou `byId` falso) (R3). `runReviewLoop` lê `opt.byId` e o repassa a `sameFinding`; só o laço da revisão por tarefa em `runDeliverable` passa `byId: true`, e as revisões de spec, plano, final e de sincronização seguem sem ele (terceiro risco do card). `fmt` escreve `[<id>]` antes da descrição quando o achado tem identificador, para o revisor da rodada seguinte reusar o mesmo. O agente `task-reviewer.md` diz como numerar (`F1`, `F2`, ... por laço), que um achado ainda aberto da rodada anterior volta com o mesmo `id` mesmo reescrito, e que um achado novo recebe um número novo; o prompt da revisão por tarefa deixa de chamar `repeatRule()`. `review.test.mjs` confere por `loadPure()`: mesmo `id` com outra redação é repetição com `byId`; sem `byId`, a redação diferente não é; um achado sem `id` cai na comparação de texto; e um `runReviewLoop` com revisores simulados escala o corretor quando o achado volta com o mesmo `id` e outra redação.

**Critério 2 (nova revisão: intervalo inteiro por padrão; restrita como modo).** O modo vem de `release.config.json`: `taskReview: { restricted: boolean }`, ausente valendo falso, lido no script com `=== true` (R4, DEC-599). `runReviewLoop` passa à revisão de cada nova rodada um quarto argumento `{ iss, head }`, com os achados da rodada anterior e o `headSha` que o revisor anterior mediu. Na configuração padrão, `buildTaskReviewPrompt` continua mandando o revisor reler `git -C "<wt>" log -p <start>..HEAD` com os achados anteriores para verificar, como hoje. Com `restricted` ligado, numa nova revisão depois de uma correção (`prev` presente) e com todo achado aberto identificado, o prompt traz a linha de modo restrito, os achados abertos com `id` e o comando `node "<pluginRoot>/scripts/review-package.mjs" "<wt>" <head anterior> HEAD "<WT>/_tmp/<E>-t<n>-<kind><round>.diff"`, que o revisor roda para ler só o diff da correção (`pluginRoot` já calculado em `runDeliverable`; a limpeza de `<WT>/_tmp/<E>-*` já apaga o arquivo) (R5). O schema da revisão por tarefa é `S_TASKREVIEW`, que estende `S_REVIEW` com `verdicts` (lista de `{ id, open }`); os campos `spec` e `quality` que ele também declara ficam sem uso até E28 (DEC-600). Uma função pura `taskIssues(r, opt)` monta os achados que `reviewTruth` recebe: no modo restrito, os achados novos de `r.issues` mais cada achado aberto cujo `id` voltou com `open: true` ou sem veredicto (veredicto ausente conta como aberto), sem duplicar por `id`. Se algum achado aberto não tem `id`, aquela rodada usa a releitura completa de hoje. `review.test.mjs` confere: o prompt padrão de nova revisão traz o `log -p` do intervalo inteiro e não traz o pacote; o prompt restrito traz os achados com `id`, o comando do pacote com a ponta anterior e não traz o `log -p` do intervalo; `taskIssues` com veredicto aberto, fechado e ausente; e o despacho no laço por tarefa usa o modo restrito só quando `taskReview.restricted === true`.

**Critério 3 (modo e modelo de hoje por padrão).** Uma função `revAgent = (p, o) => agent(p, { agentType: 'productivity-tools:task-reviewer', schema: S_TASKREVIEW, ...o })`, ao lado de `implAgent`, despacha toda revisão por tarefa, mantendo `model: rvModel || reviewModelFor(t)` e `effort: effortFor(...)` de hoje (R1, R2). O laço continua `for (const kind of ['spec', 'quality'])`, dois laços em sequência, cada um com seu corretor, como hoje; o script não lê `taskReview.single` (R6). O código já está assim na ponta atual (`0ee4677` reverteu o modo único da T5); o que falta são os testes da metade padrão que aquele commit removeu junto com os do modo único. A tarefa 11 só os restaura, sem teste primeiro, pois o código já existe (R16): em `review.test.mjs`, que a revisão por tarefa roda os laços `spec` e `quality` em sequência, despachada por `revAgent` com `agentType` `productivity-tools:task-reviewer` e com o modelo de `reviewModelFor`; em `flow.test.mjs`, que o arnês registra as revisões com rótulos `:spec1` e `:quality1` e `agentType` `productivity-tools:task-reviewer`. Nenhum assert do modo único volta.

**Critério 4 (script do pacote de revisão).** `plugins/productivity-tools/scripts/review-package.mjs` recebe `<repo> <base> <tip> <out>` e chama o git por `execFileSync`, sem shell (R7). Recusa com saída 1 e `{"ok":false,"error":...}` no stdout, sem gravar nada, quando `base` ou `tip` não resolvem a um commit (`git rev-parse --verify <ref>^{commit}`) ou quando `base` não é ancestral de `tip` (`git merge-base --is-ancestor`); uso inválido sai com 2. No intervalo válido, cria a pasta de `out` se faltar e grava um único arquivo com cabeçalho (base e ponta resolvidas, `git log --format=%h %s base..tip`) seguido de `git diff base tip`; um intervalo vazio é válido e grava o cabeçalho sem diff. Imprime `{"ok":true,"path","base","tip","commits","bytes"}`. O script fica em `scripts/` do plugin e a regra de permissão casa pelo nome do arquivo (DEC-060): `WORKFLOW_SCRIPTS` em `preflight.mjs` ganha `review-package.mjs`, com o caminho derivado da raiz do plugin, e o preflight só o lista em `missingRules` quando `taskReview.restricted` é `true`, para não parar as execuções na configuração padrão (R8). `review-package.test.mjs` cria um repositório git temporário e confere: um arquivo único com o diff do intervalo e o cabeçalho; ref inexistente e base não ancestral recusadas com saída 1 e nenhum arquivo gravado; intervalo vazio aceito.

**Chaves de `taskReview` no preflight (tarefa 10, DEC-599).** Hoje `validateReleaseConfig` em `skills/roadmap-release/scripts/preflight.mjs` aceita `restricted` e `single` booleanos, e `references/config.md` documenta os dois. A tarefa 10, com teste primeiro, faz `validateReleaseConfig` recusar `taskReview` que não seja objeto, `restricted` que não seja booleano e qualquer outra chave, `single` incluída, com uma mensagem que nomeia a chave (por exemplo `taskReview.single is not a known key; only restricted is accepted`) (R15). Em `preflight.test.mjs`, o teste `E21: validateReleaseConfig ...` deixa de aceitar `{ restricted: true, single: false }`: aceita `taskReview` ausente, `{}` e `{ restricted: true|false }`, e recusa `{ single: true }`, `{ single: false }` e uma chave inventada, conferindo que o erro cita o nome da chave; o caso `{ restricted: false, single: true }` do teste da regra de `review-package.mjs` passa a usar só `{ restricted: false }`. A linha `taskReview` de `config.md` documenta só `restricted` e diz que outra chave é recusada. A tarefa não toca `roadmap-release.js`.

**Critério 5 (prompts de revisão por tarefa sem superpowers e proibindo perguntar).** `agents/task-reviewer.md` tem frontmatter `name: task-reviewer`, `description` (diz que nunca pergunta à pessoa e que só lê) e `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort` (R2). O corpo traz a frase de `NO_ASK` literal; a precedência do prompt da chamada; os modos `spec`, `quality` e `review` e a nova revisão restrita, escolhidos pela linha de modo do prompt (o modo `review` fica sem uso até E28, DEC-600); e o texto que sai de `buildTaskReviewPrompt`: só leitura e não confiar no relato do implementador, as duas listas de bloqueio (spec e qualidade), as regras de reexecutar verificações (sem trava e sem efeito externo), a regra de `ambiente`, a numeração dos identificadores e `verdicts`. No prompt da chamada ficam só os dados: tarefa, plano, spec, intervalo, `rangeNote`, modo, resumo e verificações do implementador, achados anteriores e a linha de medida. Todo prompt continua abrindo com `briefing(ctx)`, cujo `COMMON_BASE` proíbe perguntar (R10). `prompts.test.mjs` confere: `roadmap-release.js` não contém `superpowers`; toda chamada com `S_TASKREVIEW` passa por `revAgent`; o prompt de cada modo que o script monta (padrão spec e qualidade, e restrito) abre com o briefing; `agents/task-reviewer.md` não contém `superpowers` e contém a frase de `NO_ASK` extraída do script. Os asserts existentes sobre o texto movido (verificações, travas, efeito externo, repetição exata) conferem o agente, sem perder o que conferem.

**Tamanho do script.** `roadmap-release.js` mediu 239.997 caracteres LF no início, 3 sob o teto. A primeira tarefa que editou o script moveu o texto genérico para o agente e trocou o despacho por `revAgent` antes de acrescentar código; cada tarefa mede com `workflowChars` de `size.test.mjs` depois de cada edição; se o total passar de 240.000, a tarefa para com BLOCKED e uma ação do dono, sem editar `size.test.mjs` (R9).

**Retomada sob o teto (BLQ-10).** A execução parou em BLQ-10 com 240.425 caracteres LF na ponta `50a80d0`, porque a T5 (`f8df406`) abriu espaço encurtando comentários de outros estágios e a correção final `66afa1d` os restaurou. A tarefa 9 liberou espaço só no texto da própria revisão por tarefa (`restrictedRound`, `taskIssues`, `buildTaskReviewPrompt`, o laço `kind` e seus comentários) (R13), chegou a 240.252 e, pelo caminho de reversão (R14), reverteu o código da T5 em `0ee4677`, deixando o script em 239.866; o dono ratificou a reversão como DEC-597 e a emendou com DEC-598 (só a revisão única vai para E28; a metade padrão do AC3 fica e seus testes voltam). É proibido tocar comentário ou texto de outro estágio, `size.test.mjs` ou o teto (DEC-556, DEC-563, DEC-592).

**Segunda retomada (BLQ-11, nota do dono).** As tarefas 1 a 9 ficam congeladas, texto da tarefa 5 incluído (seu código já foi revertido); a tarefa 8 foi feita pelo orquestrador principal (DEC-204, DEC-601) e está commitada com o relatório em `docs/reports`, sem nova execução nem reescrita. `3b5c950` fica. O plano acrescenta só a tarefa 10 (chaves de `taskReview`) e a tarefa 11 (testes da metade padrão do AC3). `roadmap-release.js` mede 239.866 caracteres LF e nenhuma das duas o edita. Se uma correção de revisão exigir mexer no script, ela fica em `restrictedRound`, `taskIssues`, `buildTaskReviewPrompt` e no laço `kind`, mede `workflowChars` depois de cada edição e devolve BLOCKED acima de 240.000, sem editar `size.test.mjs` nem `MAX_WORKFLOW_CHARS` e sem tocar texto ou comentário de outro estágio. Sem bump, sem push, nunca em `main`.

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal (DEC-204), no worktree de E21 antes do merge: no workflow ela devolve NEEDS_HUMAN, sem relatório fictício. O orquestrador despachou subagents que seguem `agents/task-reviewer.md` literalmente sobre uma fixture sintética marcada numa pasta temporária, nos modos padrão e restrito (portão) e `review` (informativo, DEC-601), com uma revisão adversarial só de leitura, e gravou `docs/reports/2026-11-12-E21-revisor-comportamental.md` (R11), commitado em `c72dafc`. Como a tarefa 10 e a tarefa 11 não mudam o agente nem o prompt, o teste não se repete.

**README.** A seção Agents de `plugins/productivity-tools/README.md` ganha a linha do `task-reviewer`; sem bump (R12).

## Deixado para o plano

- As tarefas 1 a 9 do plano existente ficam como estão (congeladas).
- Tarefa 10, com teste primeiro: `preflight.test.mjs` muda primeiro (chave `single` e chave inventada recusadas, nomeadas no erro), depois `preflight.mjs` e `references/config.md` (R15).
- Tarefa 11, só testes, sem teste primeiro: restaurar em `review.test.mjs` e `flow.test.mjs` os asserts da metade padrão do AC3 removidos por `0ee4677` (R16), partindo do diff desse commit e descartando o que era do modo único.
- O texto exato da mensagem de chave recusada e dos testes restaurados.
- Os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo; a revisão final da branch inteira (opus, high) é o estágio final do workflow e se repete sobre a nova ponta.

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
      "text": "Dada a configuração padrão, quando o workflow revisa uma tarefa, então usa o modo e o modelo de revisão que o release usa hoje. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
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
      "question": "Onde se liga o modo de revisão restrita?",
      "decision": "Campo taskReview { restricted } de release.config.json, ausente valendo falso, lido com === true; o preflight recusa valor que não seja objeto, restricted que não seja booleano e qualquer outra chave; config.md documenta só restricted.",
      "basis": "O critério 2 fala de configuração padrão; DEC-021 manda os modos entrarem desligados; DEC-598 e DEC-599 tiram taskReview.single de E21 e a devolvem em E28.",
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
      "decision": "Não é feita em E21: passa ao card E28. Em E21 o laço fica ['spec', 'quality'], o script não lê taskReview.single, taskIssues não reprova veredicto, e os campos spec e quality de S_TASKREVIEW e o texto do modo review do agente ficam sem uso.",
      "basis": "DEC-597 emendada por DEC-598 (estratégia v1.6, card E28); DEC-600 deixa o texto do modo review no agente para E28; a reversão 0ee4677 já deixou o código assim.",
      "alternative": "Reimplementar a revisão única em E21 abrindo espaço em outros estágios do script.",
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
    },
    {
      "id": "R13",
      "question": "De onde sai o espaço para E21 voltar a 240.000 caracteres ou menos depois de BLQ-10?",
      "decision": "Retomar na ponta 50a80d0 de feat/E21, mantendo 3b5c950, e liberar pelo menos 425 caracteres só no texto da revisão por tarefa (restrictedRound, taskIssues, buildTaskReviewPrompt, o laço kind e seus comentários): mover para agents/task-reviewer.md os rótulos e instruções genéricas do prompt (explicação das linhas Range e Measure, rótulos das verificações e da rodada anterior), normalizar taskReview uma vez, encurtar a mensagem e o comentário do modo único; medir workflowChars após cada edição; nunca tocar comentário ou texto de outro estágio, size.test.mjs ou o teto.",
      "basis": "Nota do dono (decisão delegada); DEC-556, DEC-563 e DEC-592 fixam o teto e descartam encurtar outros estágios; BLQ-10 registra 240.425 caracteres após 66afa1d.",
      "alternative": "Encurtar de novo comentários de outros estágios, como fez a T5.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "O que fazer se o texto da revisão por tarefa não liberar espaço suficiente?",
      "decision": "Reverter só o código da T5 (f8df406) no script e nos testes, manter a revisão restrita e o agente, registrar o AC3 como adiado para um card novo e parar com BLOCKED parcial para o dono, sem editar size.test.mjs nem o teto.",
      "basis": "Nota do dono (decisão delegada); DEC-556 e DEC-563 proíbem subir o teto; o modo único é o código mais recente e o único que o AC3 exige além do padrão.",
      "alternative": "Parar com BLOCKED total, sem entregar nada de E21.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "O que o preflight faz com uma chave de taskReview além de restricted?",
      "decision": "Tarefa 10, com teste primeiro: validateReleaseConfig recusa qualquer chave de taskReview além de restricted, single incluída, com um erro que nomeia a chave; preflight.test.mjs passa a recusar single e uma chave inventada; config.md documenta só restricted e diz que outra chave é recusada.",
      "basis": "DEC-599 (dono via Fable) e nota do dono, item 3; DEC-598 tira taskReview.single do preflight e do config.md.",
      "alternative": "Aceitar single sem efeito até E28.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R16",
      "question": "Como a metade padrão do AC3 volta a ter testes depois de 0ee4677?",
      "decision": "Tarefa 11, só testes e sem teste primeiro (o código já existe): restaurar em review.test.mjs os asserts dos laços spec e quality, de revAgent com agentType productivity-tools:task-reviewer e do modelo de reviewModelFor, e em flow.test.mjs os rótulos spec1 e quality1 e o agentType task-reviewer, sem nenhum assert do modo único; roadmap-release.js e agents/task-reviewer.md não mudam.",
      "basis": "DEC-598 (os testes da metade padrão removidos por 0ee4677 voltam) e nota do dono, itens 4 e 5; DEC-600 deixa o agente como está.",
      "alternative": "Escrever testes novos da metade padrão em vez de restaurar os removidos.",
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
      "expected": "A tarefa para com BLOCKED e ação do dono; size.test.mjs não é editado. Na retomada, se isso persiste depois de movido todo o texto genérico da revisão por tarefa, o código da T5 (f8df406) é revertido no script e nos testes, a revisão restrita e o agente ficam, o AC3 é registrado como adiado para card novo e a tarefa para com BLOCKED parcial; nenhum texto de outro estágio é tocado."
    }
  ]
}
```
