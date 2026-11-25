# Spec E43 -- Releitura da linha de captura

Entregável E43 do roadmap `docs/plans/roadmap-pos-2-6-0` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, seção E43), no caminho crítico, depois de E42 e E44 (os dois já em `release/pos-2.6.0`). Cobre REQ-003. Detalhe técnico: tarefa A5 de `docs/plans/2026-11-25-correcoes-issues-plan.md` (issue #3), com o desenho da DEC-009, que substitui o "o agente devolve só o caminho" da A5 (o workflow não lê arquivos). Branch de trabalho: `release/pos-2.6.0`, no worktree `D:/projects/claude-play-wt/pos-2-6-0`. Pode correr junto com o E50 (pedido do dono).

## Intenção

Mesmo com `--brief` (E42), o agente de medida ainda copia uma linha JSON de cerca de 550 bytes com `digest`, `cmdDigest`, `sha256` e `nonce`, e às vezes troca um hash por outro (comentário 3 da #3). Hoje essa cópia errada tira o portão da medida: no preflight vira `preflight:baseline-invalid`, e nos portões da branch e do merge vira uma medida `-retry` inteira, com os portões rodando de novo. O E43 torna o erro de cópia barato e repetível (DEC-009): (1) o `capture.mjs` ganha o subcomando `line --nonce --task`, que reimprime em forma brief a linha que ele mesmo gravou em `pt-evidence/<task>/<seq>-line.json`; (2) quando um portão fica fora da medida, o workflow pede essa linha a um script-runner, numa escada de 5 tentativas (2 haiku, 3 sonnet), e valida a linha relida com as mesmas checagens de hoje, sem medir os portões de novo. O caminho normal (cópia certa) não muda.

## Escopo

Dentro:

- `plugins/productivity-tools/scripts/capture.mjs`: subcomando `line` (função `runLine`, despacho em `runCapture` perto da linha 407, cabeçalho das linhas 2-27).
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: um wrapper assíncrono novo de releitura, definido junto de `gateNonce`, `gateTask` e `measureTxt` (linhas 1975-1977), e as duas chamadas dele: no preflight (linha 1998) e em `measuredGroup` (linha 2045).
- Testes: `scripts/capture.test.mjs` (AC1) e `skills/roadmap-release/workflow/flow.test.mjs` (AC2, rota padrão dos rótulos de releitura em `exec()` e o ajuste do `over` do teste da linha 342).
- `plugins/productivity-tools/skills/roadmap-release/references/operator.md`: uma frase no parágrafo da linha 93 dizendo que uma linha de captura recusada é relida por `capture.mjs line` e que o motivo da releitura aparece depois de `; reread:`.

Fora:

- O ramo de extrato do `gateFromCapture` (`roadmap-release.js:199`) e o uso de `extract.format: "vitest"` no workflow. Resposta Q1 do dono: o portão vitest continua pelo fallback de hoje (DEC-022). A pendência sai do E43 por uma DEC nova, registrada pelo roadmap-tracker e não por esta spec, que a declara fora deste roadmap, com o gatilho "o lote do E53 mostrar um portão vitest com o total do agente diferente do resumo". Como o E43 não passa a usar o total do vitest, a condição da DEC-031 também não dispara.
- A releitura nas leituras que já repetem sozinhas: load de spec e plano (`:2516`), `pairs` (`:2958`), `removed` (`:3099`) e as escritas de status (`:2118`). Resposta Q2.
- `lib/plan-digest.mjs`, `checkCapture`, `commandDigest`, a fixture `scripts/fixtures/plan-tool/workflow-copy.js` e o `embed.mjs`. Ver "Nada muda na lib" abaixo.
- O caminho agy: `workflow/roadmap-release-agy.py` não é tocado (DEC-008).
- O `gateFromCapture`, o `captureRejection` e o `capturedMeasure`, que não mudam.
- Versão dos plugins (DEC-042; o bump é do E54, DEC-003).

O que não fazer:

- Não medir os portões de novo para reler: a releitura só roda `capture.mjs line`.
- Não aceitar a linha relida por outro caminho que não o `capturedMeasure` de hoje: nonce, cmdDigest e digest são conferidos pelo mesmo `checkCapture`, sem código novo de validação.
- Não mudar o começo das frases de `gateWhy` nem os testes do E42 que as comparam (`gates.test.mjs:242-276`, `merge.test.mjs:44-57`); não tirar nem afrouxar teste negativo (DEC-004, DEC-021).
- Não fazer o `line` aceitar uma linha cujo digest gravado não confere.
- Não passar do teto de 3.500 caracteres LF no `roadmap-release.js` (DEC-007). Acima de 4.200 (20%), parar e voltar ao dono via subagente opus (DEC-007, DEC-021).

## Linha de base (G1)

Piso do G1 hoje em `release/pos-2.6.0`, no merge do E42 (`b31ba00`): exit 0; tests 2630; pass 2628; fail 0; skipped 2. O E50 roda em outro worktree e pode integrar antes do E43; nesse caso o piso passa a ser a contagem do merge do E50, registrada no log do roadmap. O plano mede o G1 no início com o worktree parado (um commit no meio da execução quebra `tools/measure/run-batch.test.mjs`, como registrado na spec do E42).

## Design

**Nada muda na lib (fato conferido).** Com o desenho da DEC-009, o `line` reimprime a linha gravada com o nonce original da medida, o mesmo que o workflow espera em `capturedMeasure` (`gateNonce(label + suffix, i)` ou `gateNonce('preflight', i)`). O `cmdDigest` é o do comando que de fato rodou. `checkCapture(raw, { nonce, cmdDigest })` (`lib/plan-digest.mjs`, cópia embutida em `roadmap-release.js:1555`) aceita a linha relida sem mudança. Por isso `lib/plan-digest.mjs`, a fixture `scripts/fixtures/plan-tool/workflow-copy.js` (que embute `checkCapture`, linha 311) e o `embed.mjs` não mudam, e o G5 (`embed.mjs --check` com os 4 alvos de `.claude/rules/workflows-and-lib.md`) fica verde sem regenerar nada. O risco do card "fixture workflow-copy.js copia o checkCapture -> ajustar junto" valia para o desenho de leitura por arquivo da A5 e não se aplica.

**AC1 (o `line` reimprime a linha em forma brief).** Em `capture.mjs`, `runCapture` despacha `argv[0] === 'line'` para uma função nova `runLine(argv, platform)`, no mesmo molde de `runPairs` (linhas 101-133):

- Uso: `node capture.mjs line --nonce <n> --task <id> [--cwd <dir>]`. `parseFlags` com essas três chaves; `--nonce` em `NONCE_RE` e `--task` em `TASK_RE`, ausentes ou fora do padrão dão `UsageError` (exit 2, `{tool, error}` sem nonce, como hoje na linha 453); `--cwd` no estilo msys no win32 dá `MSYS_MSG`; `gitDirOrThrow(o.cwd)` acha o git-dir.
- Leitura: os `^\d{4,}-line\.json$` de `<git-dir>/pt-evidence/<task>/` em ordem de seq. Cada um é descartado quando não parseia, quando não é objeto com `tool: 'capture'`, quando o `digest` não confere com `fnv1a(JSON.stringify(canon(rest)))` (a mesma conferência de `runPairs`, linhas 115-117) ou quando `nonce !== --nonce`. Entre os que sobram vale o de maior seq (R1).
- Saída quando acha (exit 0): o objeto gravado sem `digest`, `tail` e `tailCut`, assinado de novo com `sign`. É exatamente o objeto que `run --brief` imprime, porque `buildLine` (linhas 365-403) monta `{ ...base, extract }` no brief e `{ ...base, tail, tailCut, extract }` sem brief, e o corte de `failedNames` usa `tail: ''` nos dois casos. Para uma linha gravada com `--brief`, que é o caso de toda medida de portão desde o E42, a saída é byte a byte igual ao `<seq>-line.json` (R2).
- Saída quando não acha (pasta ausente, podada ou sem linha válida com o nonce): exit 1 e `{"tool":"capture","command":"line","nonce":<n>,"task":<id>,"error":"no signed line with this nonce in pt-evidence/<task>"}`. A recusa traz o nonce do pedido para que a escada do workflow pare cedo com segurança (R3).
- O cabeçalho do arquivo ganha a linha de uso e a descrição de `line`, e a mensagem de `parseArgs` (linha 58) passa a citar `line` entre os subcomandos.

Testes em `capture.test.mjs`, perto de "run grava <seq>-line.json igual a linha impressa" (linha 806): uma captura com `--brief` e outra sem `--brief` (com `--tests` numa delas), cada uma relida por `line` com o mesmo nonce e task. Nos dois casos a saída passa em `checkCapture` com o nonce e o `cmdDigest` da execução e não tem `tail` nem `tailCut`. No caso brief, a saída é igual ao stdout daquela execução e ao `<seq>-line.json` gravado. No caso sem brief, a execução não imprimiu linha brief (nonce, seq, `path` e `sha256` são os dela, `capture.mjs:418-432`); por isso a saída é comparada com o `<seq>-line.json` gravado, depois de tirar `digest`, `tail` e `tailCut` e assinar de novo. Também entram: duas execuções com o mesmo nonce, em que vale a de maior seq; um `<seq>-line.json` com o digest adulterado, que é ignorado (sem outra linha válida dá a recusa); nonce sem linha e task sem pasta, que dão exit 1 com `nonce` igual ao pedido; e nonce inválido, task com `/` e `--cwd` msys injetado, que dão exit 2.

**AC2 (o workflow relê a linha recusada e aceita a medida sem medir de novo).** Pelas respostas Q2 e Q3 do dono:

- *Gatilho.* Qualquer portão que acabe em `gateWhy`, ou seja, todo `null` do `gateFromCapture` com `ran !== false`, inclusive `no capture line` (portão sem captura ou ausente da medida). A DEC-009 fala só da linha que "falha no checkCapture"; a resposta Q2 do dono estende o gatilho a todo motivo do `gateWhy`.
- *Wrapper.* Uma função assíncrona nova, por exemplo `rereadMeasure(defs, m, nonceOf, dir, task, label, ph)`, recebe a medida bruta do agente e chama `capturedMeasure(defs, m, nonceOf)`, que não muda. Se o resultado tiver `gateWhy` vazio, ou se `dir` estiver vazio, devolve-o como está. Para cada portão `i` com motivo, em sequência (R5), roda a escada: até 5 chamadas `agent(runPrompt(cmd), { agentType: 'productivity-tools:script-runner', label, phase: ph, schema: S_RUN, model: t < 3 ? 'haiku' : 'sonnet', effort: t < 3 ? 'low' : 'medium' })`, com `cmd = node "<plugin>/scripts/capture.mjs" line --nonce <nonceOf(i)> --task <task> --cwd <shq(dir)>`, a mesma montagem de caminho de `measureTxt` (linha 1978). Em cada tentativa o stdout relido entra no lugar do `capture` do portão na medida bruta (R6), e o wrapper chama `capturedMeasure` de novo; se o portão sair do `gateWhy`, a escada desse portão acaba. Exceção para o portão que o agente omitiu da medida: a linha relida só é aceita quando o resultado não depende de campos do agente, ou seja, quando o `gateFromCapture` não marca `fallback` (linha 202). Num portão `tests` com extrato `unknown` (o vitest no fallback, DEC-022) ou com `ignoreFailuresWhenChanged`, o resultado sairia com `total` indefinido e `failedNames: []`. `validMeasure` e `gateCoherent` (linhas 243-251) não olham o `total`, então essa medida passaria e cairia no `gatePasses` (linha 265) como falha de conteúdo, ou, no preflight, no `isRedBaseline` (linhas 286-292) como `preflight:red-baseline`, no lugar da falha de infra ou do `preflight:baseline-invalid` de hoje. Nesse caso o wrapper tira o portão de `gates`, encerra a escada dele (reler de novo não muda nada) e grava o motivo `the gate needs the agent's counts` depois de `; reread: `. A escada também para cedo quando o stdout é JSON com `tool: 'capture'`, `command: 'line'`, `error` presente e `nonce` igual ao do pedido (recusa escrita do próprio `line`). Uma recusa sem nonce, como um erro de uso, não para a escada, porque pode ser um comando mal copiado pelo agente.
- *Pontos de chamada, só estes dois.* (1) Preflight: a linha 1998 passa a `pre.baseline = await rereadMeasure(GATES, pre.baseline, i => gateNonce('preflight', i), pre.integrationWorktree, 'preflight-gates', 'preflight', 'Preflight')`. A releitura fica depois da conferência das capturas e antes do `validMeasure` (linha 2014) e da montagem de `BASE` (linha 2011). O `--cwd` é `pre.integrationWorktree` (o `INTWT` da linha 2009), porque o `dir` do `measureTxt` do preflight é o literal `"<integration worktree>"`. (2) `measuredGroup` (linha 2045): `capturedMeasure(...)` passa a `await rereadMeasure(g.defs, await gateOnce(...), i => gateNonce(label + suffix, i), dir, gateTask(label), label + suffix, ph)`, antes do `validMeasure` da linha 2046 e, portanto, antes da tentativa `-retry`. Isso cobre os portões da branch, os de merge e os que rodam depois do `gates-fix`. Como o corpo do laço roda nas duas tentativas, a medida `-retry` também é relida, com os nonces de `-retry` (R4).
- *Quando a releitura também falha (Q3).* O caminho é o de hoje: o portão fica fora de `gates`, e o `gateWhy` do portão guarda o motivo original e acrescenta o da última tentativa no formato `<motivo original>; reread: <motivo da releitura>`. O motivo da releitura é o `gateWhy` que o `capturedMeasure` deu para o stdout relido (por exemplo `capture refused: no signed line ...` ou `the nonce of the output is not the one of this run, expected ..., got ...`); com stdout vazio, é o `no capture line` desse mesmo cálculo. No `measuredGroup` segue a medida `-retry` que já existe. No preflight a parada continua sendo `preflight:baseline-invalid`, agora com os dois motivos na frase de `measureProblems` (`gate X missing from the measure: <original>; reread: <releitura>`).
- *Testes do E42 (conferido).* `gates.test.mjs:242-276` e `merge.test.mjs:44-57` comparam o `gateWhy` e as frases por igualdade exata (`deepEqual`), mas chamam `capturedMeasure` e `measureProblems` direto, sem o wrapper. Como as duas funções não mudam, esses testes continuam verdes sem ajuste. Nenhum teste de `flow.test.mjs` compara hoje a frase de `baseline-invalid`.
- *Testes de AC2 em `flow.test.mjs`.* Usam o `exec()` (linha 222) e uma resposta de releitura montada com `captureLine` (linha 186) a partir do nonce e da task do prompt `line` e do comando do portão no config. Casos: (a) preflight com a captura de um portão adulterada (digest trocado) e releitura certa: a execução segue sem `preflight:baseline-invalid`, e há uma só chamada `preflight` (nenhuma medida nova); (b) portão da branch (`E1:gates1-2`) com cópia errada e releitura certa: nenhum rótulo `E1:gates1-2-retry` e o entregável integra; (c) releitura que devolve linha de outro nonce e releitura que devolve linha de outro `cmdDigest`: o portão continua recusado, o preflight para com `preflight:baseline-invalid` e a frase traz `; reread: ` com o motivo de nonce e de comando; no portão da branch, a medida `-retry` acontece; também entra um portão `tests` omitido pelo agente, com releitura válida cujo extrato tem formato `unknown` (cairia no fallback): o portão continua fora, o preflight para com `preflight:baseline-invalid` (e não `preflight:red-baseline`) e a frase traz `; reread: the gate needs the agent's counts`; (d) recusa do `line` com o nonce do pedido: uma só chamada de releitura por portão; recusa sem nonce: 5 chamadas, as duas primeiras haiku e as três últimas sonnet.
- *Ajustes no arnês de `flow.test.mjs`.* `answerRaw` ganha uma rota padrão para os rótulos de releitura, antes das rotas genéricas `/merge-gates/` e `/gates\d/` (linhas 281-282). Ela devolve `{ exit: 1, stdout: <recusa do line com o nonce do prompt> }`, o que equivale a "a captura nunca rodou" e mantém o comportamento dos testes que mandam captura inválida. O `over` do teste da linha 342 (`/^E1:gates1-2/`) também casaria os rótulos de releitura e contaria `n` a mais; ele passa a excluí-los (por exemplo `/^E1:gates1-2(-retry)?$/`) sem mudar nenhuma asserção (R7).
- *Tamanho.* O método de medida é o de `discovery-slices.test.mjs:118-122`: `readFileSync(..., 'utf8')`, depois `split('\r\n').join('\n').length`. Hoje são 267.240 caracteres LF contra a trava de 284.500. O teto do E43 é de 3.500 caracteres (DEC-007), e acima de 4.200 o executor para e volta ao dono via subagente opus (DEC-021). Estimativa: de 1.500 a 2.500 caracteres. O plano mede antes e depois de cada tarefa que toca o arquivo.

**Linhas repetidas e arquivo adulterado.** Duas execuções do mesmo portão com o mesmo nonce: o `line` devolve a de maior seq (R1). Um `<seq>-line.json` editado à mão, com digest que não confere, é ignorado; sem outra linha válida, o `line` sai 1 com a recusa e nada é reassinado (R2).

**Arquivo podado.** O `prune --task-prefix <E>-` só roda no CLEANUP, depois do merge (linha 2374), e nunca casa `preflight-gates`. Uma pasta sumida pela varredura de 14 dias cai no caso "não acha" do `line`: a escada para na primeira recusa com nonce e vale o caminho de Q3, sem tratamento especial.

**Checklist paridade agy (DEC-008).** Item: "paridade agy: pendente #13". O `.py` não é tocado.

**Pronto.** AC1 e AC2 verdes em `release/pos-2.6.0`; G1 verde com contagem igual ou maior que o piso acima; G5 verde com os 4 alvos e sem regeneração; `roadmap-release.js` dentro do teto de 3.500 caracteres e da trava de 284.500; item de paridade agy registrado.

## Deixado para o plano

- O nome final do wrapper, o texto exato da recusa "não acha" do `line` e o formato exato dos rótulos de releitura, dentro das restrições de R7.
- A divisão em tarefas: o `capture.mjs` com AC1 vem antes do workflow, que depende do subcomando.
- Os nomes e a posição dos testes novos.
- A frase de `operator.md`.

```json data
{
  "schema": "spec/1",
  "id": "E43",
  "title": "Releitura da linha de captura",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada uma linha gravada, quando o subcomando line roda com o mesmo nonce e task, então reimprime a linha em forma brief. {verify: test; evidence: node --test plugins/productivity-tools/scripts/capture.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma cópia recusada pelo checkCapture, quando o workflow relê a linha, então a medida é aceita sem medir os portões de novo, e uma linha de outro nonce ou cmdDigest é recusada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Com várias linhas gravadas com o mesmo nonce na mesma task (o agente rodou o portão mais de uma vez), qual o line devolve?",
      "decision": "A de maior seq entre as válidas (digest conferido e nonce igual).",
      "basis": "saveEvidenceOnce (capture.mjs:328) grava um <seq>-line.json por execução, então pode haver várias linhas com o mesmo nonce. Hoje o agente já pode copiar qualquer uma delas, e cada uma passa pelo mesmo checkCapture, então escolher a mais recente não enfraquece nenhuma checagem e corresponde à última execução.",
      "alternative": "Recusar a ambiguidade quando houver mais de uma linha com o nonce (o portão ficaria fora da medida sem defeito real).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como o line monta a forma brief e o que faz com um arquivo de linha adulterado?",
      "decision": "Confere o digest gravado como o pairs faz (capture.mjs:115-117) e descarta o arquivo que não confere; das válidas, tira digest, tail e tailCut e assina de novo com sign. Para linhas gravadas com --brief, a saída é igual ao arquivo.",
      "basis": "buildLine monta { ...base, extract } no brief e { ...base, tail, tailCut, extract } sem brief, com o mesmo corte de failedNames nos dois, então tirar tail e tailCut dá o objeto de --brief. Conferir antes de reassinar impede que o line lave um arquivo alterado à mão com um digest novo.",
      "alternative": "Reimprimir o arquivo como está, sem conferir nem reassinar (uma linha sem --brief voltaria com o tail, que é o que mais erra na cópia).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o line responde quando não acha a linha, e quando a escada do workflow para cedo?",
      "decision": "Exit 1 e {tool:'capture', command:'line', nonce, task, error}, com o nonce do pedido. A escada para cedo só com uma recusa JSON de command line cujo nonce é o do pedido; erros de uso (exit 2, sem nonce, capture.mjs:453) não param a escada.",
      "basis": "Um erro de uso pode vir de um comando mal copiado pelo agente e merece outra tentativa. A recusa com o nonce do pedido mostra que o line rodou com o pedido certo e não achou nada, então repetir não ajuda. Parar cedo só diminui tentativas e nunca faz uma medida ser aceita.",
      "alternative": "Parar a escada em qualquer recusa do capture, inclusive erros de uso sem nonce.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "No measuredGroup, a medida -retry também passa pela releitura?",
      "decision": "Sim. O wrapper substitui a chamada de capturedMeasure no corpo do laço (roadmap-release.js:2045), então as duas tentativas são relidas, cada uma com os seus nonces (gateNonce(label + suffix, i)).",
      "basis": "A resposta Q2 põe a releitura entre o capturedMeasure e a tentativa -retry. A -retry passa pelo mesmo ponto do código, e uma cópia errada nela custaria uma falha de infra inteira que a releitura evita pelo mesmo preço.",
      "alternative": "Reler só a primeira tentativa (a -retry com cópia errada viraria falha de infra).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Os portões recusados de uma medida são relidos em paralelo ou em sequência, e dentro ou fora dos locks de gateOnce?",
      "decision": "Em sequência e fora dos locks: o wrapper roda depois que gateOnce (withLocks) devolveu a medida.",
      "basis": "Um grupo tem poucos portões e a releitura raramente dispara, então o paralelo pouco ganha e custa caracteres contra o teto de 3.500. O line só lê arquivos de pt-evidence e não usa o recurso travado.",
      "alternative": "Reler todos os portões recusados em paralelo com o helper parallel.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como a linha relida entra na medida, inclusive quando o agente omitiu o portão?",
      "decision": "O stdout relido troca só o campo capture do item do portão na medida bruta, mantendo os outros campos do agente (total, skipped e failedNames do fallback). Se o agente omitiu o portão, o wrapper acrescenta { name, ran: true, capture }, e o resultado só é aceito sem fallback. Quando o gateFromCapture marca fallback (tests com extrato unknown ou com ignoreFailuresWhenChanged), o portão fica fora de gates com o motivo 'the gate needs the agent's counts' depois de '; reread: ', e a escada dele acaba. Depois, capturedMeasure roda sobre a medida trocada.",
      "basis": "A resposta Q2 manda trocar o capture e chamar capturedMeasure de novo. Manter os campos do agente preserva o fallback de hoje (DEC-022). No portão ausente, a linha assinada prova que o comando rodou com o nonce da medida e dá o exit. Mas no fallback o gateFromCapture (roadmap-release.js:202) devolveria total indefinido e failedNames [], e validMeasure e gateCoherent (243-251) não olham total. A medida passaria e viraria falha de conteúdo no gatePasses (265), ou preflight:red-baseline no isRedBaseline (286-292), no lugar da falha de infra ou do baseline-invalid de hoje. Por isso o fallback de portão omitido é recusado.",
      "alternative": "Reler só portões presentes na medida e deixar o portão ausente como missing.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como nomear os rótulos das chamadas de releitura sem quebrar as rotas de teste existentes?",
      "decision": "O rótulo começa com o rótulo da medida, contém reread e o índice do portão, e ganha -retry<t> nas tentativas 2 a 5 (por exemplo E1:gates1-2:reread-g1-retry2). O exec() de flow.test.mjs ganha uma rota padrão para esses rótulos antes de /merge-gates/ e /gates\\d/, e o over do teste da linha 342 passa a excluí-los, sem mudar nenhuma asserção.",
      "basis": "Começar com o rótulo da medida mantém a releitura agrupada com o entregável e a fase no diário. A rota padrão de recusa com nonce reproduz o caso real de uma captura que nunca rodou e mantém os testes que mandam captura inválida no comportamento de hoje.",
      "alternative": "Um prefixo próprio (reread:...) que nenhuma rota existente casa, ao custo de separar a releitura do rótulo do entregável.",
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
      "input": "O agente devolve a captura com digest e cmdDigest trocados, e o line relê a linha certa na primeira tentativa.",
      "expected": "O portão entra na medida com o exit e o extrato da linha relida; nenhuma medida -retry e nenhum preflight:baseline-invalid."
    },
    {
      "id": "C2",
      "input": "O agente rodou um comando diferente do configurado (aspas trocadas), e a linha gravada tem outro cmdDigest.",
      "expected": "A linha relida é recusada pelo checkCapture; o gateWhy fica '<motivo original>; reread: the output is not from the expected command, expected ..., got ...'."
    },
    {
      "id": "C3",
      "input": "A pasta pt-evidence/<task> não existe ou foi varrida.",
      "expected": "O line sai 1 com a recusa e o nonce do pedido; a escada para na primeira tentativa e vale o caminho de hoje (Q3)."
    },
    {
      "id": "C4",
      "input": "O script-runner devolve um erro de uso do capture (exit 2, sem nonce) ou um stdout que não é JSON.",
      "expected": "A escada segue até 5 tentativas (2 haiku, 3 sonnet); se nenhuma servir, o motivo da última vai depois de '; reread: '."
    },
    {
      "id": "C5",
      "input": "Portão com ran false, base gravada pelo run-record (pre.recorded) ou checkout alheio sem autorização (foreignHold, sem baseline).",
      "expected": "Nenhuma releitura: o portão ran false não entra em gateWhy, e o wrapper só roda no ramo de pre.baseline medido; recordedBaseline não muda."
    }
  ]
}
```
