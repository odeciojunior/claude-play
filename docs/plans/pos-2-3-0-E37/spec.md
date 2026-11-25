# Spec E37 -- Cargas e commits conferidos contra a fonte

## Intenção

Em cumprimento a `REQ-004` e `REQ-009`, o E37 fecha as peças do workflow do release que ainda confiam numa transcrição ou num atalho sem conferir a fonte, sem tocar no que o E41 já resolveu (a carga assinada por `capture.mjs`, `DEC-030`) nem no que o E36 acabou de entregar. São sete correções pequenas e independentes, todas abertas no código de `6c3fee5` (conferido de novo em `7d505de` e em `1a1df35`):

- B06: `loadPlan(false)` (`roadmap-release.js`, l. ~2630 e ~2652) carrega o plano congelado sem `--spec`, mas `plan-tool.mjs` (l. ~329-331) cai então em `data.spec` e lê e valida a spec do mesmo jeito.
- B08: o pulo da revisão da spec (`skipRev('spec', specReused && ...)`, l. ~2543) confia em `specReused` (l. ~2534-2538), decidido pelo `HEAD`; se o autor commita a spec alterada, o commit do workflow sai vazio, o `HEAD` bate com o da carga e `skipReview` (l. ~1114) compara o registro com o blob medido no setup, de antes da edição: a revisão da spec é pulada sobre um texto que ninguém revisou.
- S3-28: `runPrompt` (l. ~1731) termina com `BASH_ONLY` (l. ~1728), que pede "an empty list with error no-bash" a um agente cujo esquema (`S_RUN`) só tem `exit` e `stdout`.
- S3-29: em `readSlices` (l. ~1738; o `readDisc` citado na nota não existe mais), que serve a descoberta, as fatias de carga (`capture slice`) e a releitura (`readBack`, `verify-run read`), uma recusa `{ tool, error }` do script é repetida até 5 vezes, embora o mesmo comando dê sempre a mesma recusa.
- S3-30: `recordCmd` (l. ~1119) põe `prep.baseline` inteiro num argumento só do `run-record approve`, sem guarda de tamanho.
- S2-13, partes 1 a 3: prompts que deixam o modelo acrescentar `; echo exit=$?`, e autores de spec e plano que dão Grep no código das ferramentas do plugin ou editam com `sed -i`.
- S2-08: com a releitura do status recusada pela CLI (`deliverable-unknown`, exit 1), `cliJson` de `verify-run.mjs` (l. ~151) descarta o JSON e `recordVerdict` (l. ~1026) diz "is missing or has no panel" em vez de citar a recusa.

Depois do código, 1 sonda paga plan-only confirma que as cargas e os commits de spec e plano passam de primeira. As escolhas de escopo, tamanho, protocolo da sonda e exclusões são do dono, decididas por um subagent Fable a quem ele delegou (intake desta spec); estão em `R1`, `R3`, `R5`, `R6`, `R7`, `R8`, `R9`, `R10`, `R12` a `R15`. As demais são decisões autônomas desta spec.

## Escopo

Dentro:

- `plugins/productivity-tools/scripts/plan-tool.mjs`: flag `--no-spec` nos cinco subcomandos (`R1`, `R2`).
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `--no-spec` em `planLoadOnce` quando `useSpec` é falso; blob da spec na carga da spec e portão do pulo da revisão por blob, com `specReused` intacto (`R3`, `R4`); variante de `BASH_ONLY` em `runPrompt` (`R5`); parada na 1ª recusa em `readSlices` (`R6`); guarda de tamanho em `recordCmd` e `recAt` (`R7`); frase curta de um comando por chamada (`R8`); código da recusa em `recordVerdict`, e a chamada da etapa docs passa também `exits` da releitura (`R10`).
- `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`: `buildRead` aceita, só para o status, o JSON da CLI com exit diferente de 0 e passa os códigos de erro (`R11`).
- `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`: duas regras curtas cada (`R9`).
- Testes: `flow.test.mjs` e `discovery-slices.test.mjs` (trava de tamanho, `R12`) no workflow; `plan-tool.test.mjs`, `agent-contracts.test.mjs`; `roadmap.test.mjs` (só teste de contrato, `R10`); `verify-run.test.mjs`.
- Registro da sonda em `docs/plans/roadmap-pos-2-3-0/measurements.md` (uma linha `run` do E37, `R13`).

Fora (decisão do dono, `R15`):

- B07 (passou ao E41, `DEC-030`); S3-27 (E34); parte 4 da S2-13 e o `--deliverable` da S2-08 (já corrigidos em `7f0323d`, `e0def99` e `2ec31c6`); S2-01, B17 e B19 a B24 (`DEC-010`).
- Bump de versão do plugin (E40, `DEC-042`).
- Qualquer mudança de código em `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` (só ganha teste).
- Segunda sonda, sonda em `acceptEdits` ou qualquer outra execução paga.
- Arquivos e peças do E36 (`removedTests`, `removedFloor`, `test-extract.mjs removed`, cláusula contra mascaramento).

Não fazer:

- Não mudar o fallback de `plan-tool.mjs` sem flag (o plan-coordinator depende dele).
- Não passar de 265.673 caracteres LF em `roadmap-release.js` (`DEC-050`); se apertar, cortar texto, nunca conferência.
- Não escrever mais de uma linha de comentário por peça em `roadmap-release.js`.
- Não editar `plugins/productivity-tools/lib/` nem os prompts que os braços `tools/measure/arms/*-atual.md` copiam (revisões e correções de spec, plano e final; `R16`).
- Não rodar a sonda dentro de uma tarefa do plano, nem com `--work` ou `--out` dentro do repositório.

## Desenho

### AC1 -- Testes de plano congelado sem spec, spec commitada pelo autor e S3-28, S3-29, S3-30, S2-13 e S2-08

B06 (`R1`, `R2`). Em `plugins/productivity-tools/scripts/plan-tool.mjs`, `main` aceita `--no-spec` em `check`, `emit`, `map`, `brief` e `summary` e passa `noSpec: true` a `checkPlan` (e por ela a `emitPlan`); com `noSpec`, `checkPlan` não resolve `specPath` nem `data.spec`, não lê arquivo e devolve `spec: null`, de modo que o bloco que cruza evidência com a spec (l. ~457) não roda. `--no-spec` junto com `--spec` é erro de uso (exit 2). `USAGE` cita a flag. Sem nenhuma das duas flags o comportamento atual fica. Em `roadmap-release.js`, `planLoadOnce` passa `['--no-spec']` quando `useSpec` é falso. Testes: em `plan-tool.test.mjs`, plano cujo `data.spec` aponta para spec ausente ou inválida passa em `check --no-spec` e em `emit --no-spec` (exit 0, sem `spec-invalid`) e reprova sem a flag; `--no-spec --spec x` sai 2. Em `flow.test.mjs`, no caminho congelado (`frozen`) o comando da 1ª carga do plano leva `--no-spec` e as demais cargas levam `--spec`.

B08 (`R3`, `R4`). `specLoadOnce` ganha o comando `['blob', ...gitIn('rev-parse', 'HEAD:' + AP.spec)]` antes dos `gitCmds`, como já faz `planLoadOnce`; `loadVia` já devolve `blob` (exit 0 e sem corte), e `loadSpec` passa adiante `blob` só quando casa com `^[0-9a-f]{40,64}$`. `specReused` fica exatamente como está, porque também define o mínimo de commits de `reviewTruth` (l. ~2567, `specReused ? 0 : 1`, e l. ~2738, `spec.reused ? 1 : 2`). A condição do blob entra só no portão do pulo (l. ~2543): `skipRev('spec', specReused && <blob não vazio> && <blob> === K0.recorded.spec.spec && !specLoad.checkFailed)`, com `K0.recorded.spec.spec` o blob aprovado gravado em `run.json` (lido por `run-record.mjs key`). Spec ainda não commitada na carga dá blob vazio, então não há pulo. Testes em `flow.test.mjs`: (a) spec nativa, `notes[E1]` presente, registro com `recorded.spec.spec` igual ao blob do setup, autor que commita uma spec alterada (blob da carga diferente, commit do workflow vazio, mesmo `HEAD`): `E1:spec-review1` roda e não há concern "spec review skipped"; (b) com o blob da carga igual ao registro, a revisão é pulada como hoje; (c) spec nativa herdada do alvo, `notes[E1]` presente, sem registro (`run.json` sem `recorded.spec`), autor sem mudança: a revisão roda e não há falha "fewer commits than expected".

S3-28 (`R5`). Uma constante nova deriva de `BASH_ONLY` trocando a frase final por "Without the Bash tool, run nothing and return exit -1 with an empty stdout." (o contrato que `agents/script-runner.md` já tem) e `runPrompt` passa a usá-la; `BASH_ONLY` continua inteiro nos prompts com lista de `runs` (docs, docs-measure, relatório). O teste "BASH_ONLY literal em todo prompt de registro e de releitura" de `flow.test.mjs` passa a exigir a variante nos prompts de `runPrompt` (registro, releitura, descoberta, cargas) e a ausência de `no-bash` neles; "BASH_ONLY literal em docs e docs-measure" segue igual. As asserções literais afetadas mudam na mesma tarefa.

S3-29 (`R6`). Em `readSlices`, dentro de `one`, uma saída JSON com `tool` igual ao `tool` esperado e `error` definido devolve na hora `{ why: 'slice <k>: <tool> refused: <error>' }`, sem `-retryN` e sem a rodada `-redo`, como o precedente de `removedFloor` (l. ~3064). A parada vale para os três usos de `readSlices`: descoberta (`release-discovery`), fatias de carga (`capture`) e releitura (`readBack`, `verify-run`, l. ~1776). Recusa de outro `tool` segue como cópia errada (repete). Testes em `flow.test.mjs`: a descoberta recusada gera uma só chamada `discovery` e o erro "discovery failed: slice 0: release-discovery refused: ..."; uma recusa numa fatia de carga não gera `-retry2`; uma recusa de `verify-run` na releitura `E1:status-<status>-read` não gera `-retry2` e o registro falha com "null re-read agent". O teste existente de `discovery-slices.test.mjs` continua passando.

S3-30 (`R7`). `recordCmd` monta o comando; se ele passar de `CMD_CAP` (6.000 caracteres) e o payload tiver `prep`, monta de novo sem `prep` e avisa por um callback opcional (8º parâmetro). `recAt` passa o callback, que acrescenta uma vez a `out.concerns` uma linha nomeada ("run record: prep left out of run.json, the approve command had N characters, above CMD_CAP; the next run measures the baseline again"). Teste em `flow.test.mjs`: baseline vermelha grande (um gate `tests` com centenas de falhas nomeadas) dá comando de approve sem `prep` com até 6.000 caracteres e a concern presente uma vez; baseline pequena mantém `prep` sem concern; o teste "E23: recordCmd builds the approve command" segue verde.

S2-13 parte 1 (`R8`). Uma constante curta ("One command per call; never append `; echo exit=$?`.") entra na variante de shell de `runPrompt` (que cobre os prompts de registro `status-*` e de releitura), no prompt de `commitAgent` e no prompt `progress`. Teste em `flow.test.mjs`: a frase aparece nos prompts `E1:spec-commit`, `E1:plan-commit`, `E1:progress` e `E1:status-*`.

S2-13 partes 2 e 3 (`R9`). `agents/spec-author.md` e `agents/plan-author.md` ganham, cada um, duas regras de uma linha: não ler nem dar Grep no código das ferramentas do plugin (`spec-tool.mjs`, `plan-tool.mjs` e o resto da pasta `scripts/`), usando só seus comandos e saídas; editar arquivos só com Edit ou Write, nunca com `sed -i`. Teste em `agent-contracts.test.mjs`; os outros testes que leem esses dois arquivos (`scripts/independence.test.mjs`, `scripts/spec-tool.test.mjs` e `skills/plan-writer/adoption-text.test.mjs`) seguem verdes.

S2-08 (`R10`, `R11`). Hoje `cliJson` (`verify-run.mjs`, l. ~151) exige exit 0, então a recusa do status (exit 1) vira `status: null` inteiro em `buildRead` (l. ~152). Só para o status, `buildRead` passa a aceitar o JSON da CLI (`tool` "roadmap") com exit diferente de 0 e emite `{ tool, summary, errors: [{ code }], result: {} }` (até 3 códigos, cada um cortado em 40 caracteres); `brief` e `pending-decisions` seguem com `cliJson` como está, e o corte final de orçamento (que lê `st.result.panel`) tolera `result` vazio. Em `recordVerdict`, quando o status relido tem `summary.exitCode` diferente de 0, `errors` não vazio, ou não é JSON e `read.exits.status` é diferente de 0, a falha passa a ser "reread status --json refused: <código>" (sem código quando não há `errors`) em vez de "is missing or has no panel", que fica para a ausência real. O outro consumidor de `readBack`, a etapa docs (l. ~2309-2313), chama o mesmo `recordVerdict` com `meas.status`; ele tolera status sem `panel` (cai na mesma falha nomeada) e passa a repassar também `exits: meas.exits`. `roadmap.mjs` não muda. Testes: em `roadmap.test.mjs`, contrato da recusa de `status --deliverable E99` (JSON com `tool` "roadmap", `summary.exitCode` 1, `errors[0].code` "deliverable-unknown", sem `result.panel`); em `verify-run.test.mjs`, `buildRead` com status recusado (exit 1) leva o código e `result: {}`, e `brief` recusado segue `null`; em `flow.test.mjs`, `recordVerdict` com essa releitura cita `deliverable-unknown`.

Tamanho (`R12`). `roadmap-release.js` mede 263.648 caracteres LF em `1a1df35`; o E37 tem até 265.673 (`DEC-050`). A primeira tarefa que mexer no workflow atualiza a trava de `discovery-slices.test.mjs` (l. ~117-121) para 265.673, com nome e mensagem citando E37 e `DEC-050`; cada tarefa declara o tamanho medido depois dela. `size.test.mjs` (teto 300.000 e folga maior que 10.000, `DEC-034`) segue valendo.

### AC2 -- Sonda paga plan-only

Depois do plano executado e da branch verde, a sessão principal (não uma tarefa do plano; no plano é uma tarefa externa manual, `R14`) atualiza a worktree `D:/claude-pos23-release` (hoje em `6abab96`) para a ponta de `release/pos-2.3.0` com o E37 e roda uma vez, com `CLAUDE_CONFIG_DIR=D:/claude-pos23-cfg` e `DISABLE_AUTOUPDATER=1`, `node tools/measure/run-batch.mjs --variant plan-only --runs 1 --max-budget-usd 3.6 --config-dir D:/claude-pos23-cfg --plugin-dir D:/claude-pos23-release/plugins/productivity-tools --permission-mode bypassPermissions --model sonnet --work <fora do repositório> --out <fora do repositório>` (flags conferidas em `tools/measure/run-batch.mjs`, l. ~2722-2725, e em `.claude/rules/measure.md`). O critério de validade e de "de primeira" está em `R13`. A linha `run` do E37 em `measurements.md` traz SHA do plugin medido, pasta de saída, contagem de rótulos de repetição, veredito e custo da CLI (`counters.session.cliCostUsd`). A conferência da linha é do dono (`H1`). A sonda plan-only não exercita B06 nem B08: a prova deles é só o AC1.

## Deixado para o plano

- Divisão em tarefas (no máximo 4 arquivos por tarefa) e ordem: `plan-tool.mjs` e `verify-run.mjs` antes das peças do workflow que dependem deles; a tarefa externa manual da sonda por último.
- Texto exato das frases novas e das mensagens, dentro do orçamento; tamanho medido declarado por tarefa. Recomendação do dono (via Fable): comentários de até 60 caracteres e concern do `R7` curta; a estimativa das 7 peças é de 1.900 a 2.100 caracteres, no limite dos 2.000.
- `R7`: `recordCmd` (l. ~1119) é função pura testada via `loadPure`, e `CMD_CAP` (l. ~2051) é const do corpo do fluxo; o limite entra em `recordCmd` por parâmetro, ou a constante sobe para a área pura, sem duplicar o número 6.000.
- Linhas de evidência a mais para o AC1 (sem trocar a da marca): `agent-contracts.test.mjs`, `verify-run.test.mjs`, `discovery-slices.test.mjs` e `tools/measure/checkpoint.test.mjs` (paridade dos braços, `R16`).
- Ajuste dos fixtures de `flow.test.mjs` que respondem às cargas da spec (agora com o rótulo `spec-load<k>-blob`) e das asserções literais de `BASH_ONLY`.
- Riscos a tratar: a carga extra do blob soma uma chamada haiku por carga de spec e muda a contagem que o E39 mede (citar na tarefa e no registro da sonda); trocar a frase de `runPrompt` toca todas as chamadas do script-runner; parar na 1ª recusa confia numa resposta não assinada do haiku (precedente aceito); o fator 1,85 da projeção deixa 4% de margem no teto de US$ 3,60, sem espaço para repetição.

```json data
{
  "schema": "spec/1",
  "id": "E37",
  "title": "Cargas e commits conferidos contra a fonte",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dados testes com plano congelado carregado sem --spec, spec commitada pelo autor e os casos S3-28, S3-29, S3-30, S2-13 e S2-08, quando a suíte de testes roda, então nenhum pulo indevido de revisão ocorre e todos os testes passam. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado o plugin atualizado na branch de release, quando 1 sonda paga plan-only roda em config descartável (até US$ 3), então as cargas e commits de spec e plano passam de primeira sem erro de transcrição e o gasto é registrado em measurements.md. {verify: human; evidence: o dono confere a linha da sonda plan-only de E37 em measurements.md}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como carregar o plano congelado sem ler nem validar a spec (B06)?",
      "decision": "Flag explícita --no-spec em plan-tool.mjs: com ela checkPlan não resolve specPath nem data.spec, não lê arquivo e devolve spec null; loadPlan(false) em roadmap-release.js passa a flag. O fallback sem flag (data.spec relativo ao plano) fica como está.",
      "basis": "Decisão do dono via subagent Fable (intake da spec E37); o plan-coordinator depende do fallback atual.",
      "alternative": "Mudar o fallback para não ler a spec quando --spec falta (quebraria o plan-coordinator).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Em que subcomandos vale --no-spec e o que acontece se vier junto com --spec?",
      "decision": "Vale em check, emit, map, brief e summary (todos já aceitam --spec); --no-spec com --spec é erro de uso, exit 2, com USAGE.",
      "basis": "main de plan-tool.mjs trata --spec igual nos cinco subcomandos; flags contraditórias silenciosas esconderiam erro de chamada.",
      "alternative": "--no-spec só em check e emit, e a última flag vence quando as duas vêm.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como decidir o pulo da revisão da spec quando o autor pode ter commitado (B08)?",
      "decision": "A carga da spec mede o blob HEAD:<spec> por captura assinada (comando blob em specLoadOnce, como em planLoadOnce). specReused não muda; a condição do blob entra só no portão do pulo: skipRev('spec', specReused && blob não vazio && blob === K0.recorded.spec.spec && !specLoad.checkFailed).",
      "basis": "Decisão do dono via subagent Fable (intake e correção na aprovação da spec); skipReview compara o registro com o blob do setup, de antes da edição do autor; specReused também define o mínimo de commits de reviewTruth (l. ~2567 e ~2738).",
      "alternative": "Pôr a condição do blob em specReused (reprova carga legítima: spec nativa herdada do alvo com nota, autor sem mudança e sem registro daria \"fewer commits than expected\" sem saída); ou medir o blob no commitAgent (resposta não assinada do haiku).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Por que a regra do blob fica fora de specReused, e ela vale no ramo reusedAsIs?",
      "decision": "specReused e spec.reused seguem com a regra atual (reusedAsIs, ou sem commit do workflow e mesmo HEAD), porque decidem o mínimo de commits de reviewTruth na revisão da spec (specReused ? 0 : 1) e na do plano (spec.reused ? 1 : 2); o portão do pulo, que só restringe, vale nos dois ramos (em reusedAsIs o blob da carga é o do setup e o resultado não muda).",
      "basis": "Código de roadmap-release.js (l. ~2534-2543, ~2567, ~2738); correção do dono via Fable na aprovação da spec.",
      "alternative": "Exigir o blob dentro de specReused só no ramo !reusedAsIs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que runPrompt pede quando não há Bash (S3-28)?",
      "decision": "runPrompt usa uma variante de BASH_ONLY sem a frase da lista vazia com no-bash, terminando em 'Without the Bash tool, run nothing and return exit -1 with an empty stdout.'; BASH_ONLY inteiro fica nos prompts com lista de runs (docs, docs-measure, relatório).",
      "basis": "Decisão do dono via subagent Fable (intake); S_RUN só tem exit e stdout e agents/script-runner.md já manda exit=-1 com stdout vazio.",
      "alternative": "Trocar a frase em BASH_ONLY para todos os prompts (os de docs têm lista de runs).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O que readSlices faz com uma recusa do script (S3-29)?",
      "decision": "Uma saída JSON com tool igual ao esperado e error definido para na 1ª resposta, sem retry nem rodada -redo, devolvendo 'slice <k>: <tool> refused: <error>', nos três usos de readSlices: descoberta (release-discovery), fatias de carga (capture) e releitura (readBack, verify-run); recusa de outro tool segue como cópia errada. A spec cita readSlices porque readDisc não existe mais.",
      "basis": "Decisão do dono via subagent Fable (intake e correção na aprovação); precedente de removedFloor (l. ~3064) e de recordStatus, que param na recusa; readSlices é o único laço dos três usos.",
      "alternative": "Exigir também o nonce da chamada na recusa (os envelopes de recusa de release-discovery e capture não trazem nonce).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual o limite da guarda de tamanho do run-record approve e o que acontece acima dele (S3-30)?",
      "decision": "Limite: o comando inteiro de approve com até CMD_CAP (6.000 caracteres), a constante já usada por readBack, recordStatus e o conferidor git; acima dele recordCmd monta o comando sem prep e chama um callback opcional, e recAt acrescenta uma vez a out.concerns uma linha nomeada dizendo que o prep ficou fora do run.json e que a próxima execução mede a baseline de novo. O limite chega a recordCmd (função pura testada via loadPure) por parâmetro, ou CMD_CAP sobe para a área pura, sem duplicar o número.",
      "basis": "Decisão do dono via subagent Fable (intake) sobre o comportamento; o número reaproveita CMD_CAP (l. ~2051) em vez de criar outro limite.",
      "alternative": "Limite próprio maior (por exemplo 30.000, perto do teto do CreateProcess no Windows), que deixaria o haiku copiar comandos enormes.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Onde entra a frase de um comando por chamada (S2-13 parte 1)?",
      "decision": "Uma constante curta ('One command per call; never append `; echo exit=$?`.') na variante de shell de runPrompt (cobre os prompts de registro status-* e de releitura), no prompt de commitAgent e no prompt progress.",
      "basis": "Decisão do dono via subagent Fable (intake: prompts de commit, progress e registro); os prompts de registro são montados por runPrompt, então uma inclusão cobre todos.",
      "alternative": "Repetir a frase em cada prompt de registro em vez de runPrompt.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Onde ficam as partes 2 e 3 da S2-13?",
      "decision": "Em agents/spec-author.md e agents/plan-author.md, duas regras de uma linha cada: não ler nem dar Grep no código das ferramentas do plugin (spec-tool.mjs, plan-tool.mjs e o resto de scripts/), usando só seus comandos e saídas; editar só com Edit ou Write, nunca com sed -i. Teste em agent-contracts.test.mjs; independence.test.mjs, spec-tool.test.mjs e adoption-text.test.mjs, que também leem esses arquivos, seguem verdes; nenhum caractere a mais no workflow.",
      "basis": "Decisão do dono via subagent Fable (intake e correção na aprovação); quem lê esses dois arquivos são agent-contracts.test.mjs, independence.test.mjs, spec-tool.test.mjs e skills/plan-writer/adoption-text.test.mjs (prose-budget.test.mjs não os lê).",
      "alternative": "Pôr as regras em specRules e planRules do workflow (custa caracteres do orçamento).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como recordVerdict reporta uma releitura de status recusada (S2-08)?",
      "decision": "Quando o status relido tem summary.exitCode diferente de 0, errors não vazio, ou não é JSON e read.exits.status é diferente de 0, a falha é 'reread status --json refused: <código>' (sem código quando não há errors); 'is missing or has no panel' fica para a ausência real. A etapa docs repassa também exits: meas.exits a recordVerdict. roadmap.mjs não muda; roadmap.test.mjs ganha um teste de contrato da recusa deliverable-unknown de status --deliverable.",
      "basis": "Decisão do dono via subagent Fable (intake); roadmap.mjs l. ~696 já recusa com deliverable-unknown.",
      "alternative": "Citar só o exit sem o código.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como o código da recusa chega a recordVerdict, se buildRead descarta errors?",
      "decision": "Só para o status, buildRead em verify-run.mjs aceita o JSON da CLI (tool roadmap) com exit diferente de 0 e emite { tool, summary, errors: [{ code }], result: {} } (até 3 códigos, cada um cortado em 40 caracteres); brief e pending-decisions seguem com cliJson, que exige exit 0.",
      "basis": "Código: cliJson (verify-run.mjs l. ~151) exige r.exit === 0, então a recusa do status (exit 1) vira status null inteiro e nem summary nem o código chegam ao workflow; a decisão do dono pede o código e só exclui mudar roadmap.mjs; correção do dono via Fable na aprovação.",
      "alternative": "Afrouxar cliJson para os três comandos (mudaria brief e pending-decisions sem necessidade); ou ler o código do stdout bruto do agente (não passa pela releitura assinada).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Qual o orçamento de tamanho de roadmap-release.js?",
      "decision": "Até 265.673 caracteres LF (+2.000 sobre a trava de 263.673; 263.648 medidos em 1a1df35); a primeira tarefa que mexer no workflow atualiza a trava de discovery-slices.test.mjs para 265.673 com nome e mensagem citando E37 e DEC-050; no máximo uma linha de comentário por peça; tamanho medido declarado por tarefa; se apertar, cortar texto, nunca conferência.",
      "basis": "Decisão do dono via subagent Fable (intake) registrada como DEC-050; teto de 300.000 e folga maior que 10.000 (DEC-034) mantidos.",
      "alternative": "Medir o orçamento a partir do tamanho atual (263.648) em vez da trava.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Como a sonda plan-only do AC2 roda e o que conta como aprovada?",
      "decision": "1 execução de run-batch.mjs --variant plan-only --runs 1 --max-budget-usd 3.6, config D:/claude-pos23-cfg, plugin da worktree D:/claude-pos23-release na ponta da release com o E37, bypassPermissions, sonnet, --work e --out fora do repositório. Válida: 1 válida no arnês, stop nulo, E1 com plano commitado. De primeira: nenhum rótulo spec-load2+, plan-load2+, -retryN, -redo, spec-commit2 ou plan-commit2; pending vazio; nenhum 'integrity digest not confirmed'; zero '; echo exit=', 'sed -i' e Grep na pasta do plugin nas transcrições. Repetição por erro de transcrição reprova o AC2 e volta via Fable; falha de infra (agente nulo, API) fica registrada como inválida e só tem nova tentativa com gasto acumulado até US$ 0,14. A linha run do E37 em measurements.md traz SHA do plugin, pasta de saída, contagem de rótulos de repetição, veredito e counters.session.cliCostUsd.",
      "basis": "Decisão do dono via subagent Fable (intake) e DEC-051 (teto de US$ 3,60, que substitui o 'até US$ 3' do texto do cartão conforme a nota v1.4).",
      "alternative": "Duas execuções para ter margem de infra (não cabe no teto).",
      "costIfWrong": "medium",
      "reversible": false,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "Quem executa a sonda?",
      "decision": "A sessão principal, depois do plano executado e da branch verde; no plano ela aparece como tarefa externa manual (external true, sem implementer), não como tarefa automática.",
      "basis": "Decisão do dono via subagent Fable (intake); .claude/rules/measure.md exige autorização explícita para execução paga, dada pela DEC-051.",
      "alternative": "Tarefa automática do plano rodada pelo implementer.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "O que fica fora do E37?",
      "decision": "B07 (E41); S3-27 (E34); parte 4 da S2-13 e o --deliverable da S2-08 (já corrigidos); S2-01, B17 e B19 a B24 (DEC-010); bump de versão (E40); mudança em roadmap.mjs além do teste; segunda sonda ou acceptEdits; arquivos do E36.",
      "basis": "Decisão do dono via subagent Fable (intake); DEC-010, DEC-030 e DEC-042.",
      "alternative": "Absorver S2-01 junto com S2-08 no mesmo grupo B18.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R16",
      "question": "Os braços tools/measure/arms/*-atual.md precisam mudar?",
      "decision": "Não: o E37 não toca os prompts de revisão e correção de spec, plano e final que os braços copiam; o plano confirma com tools/measure/checkpoint.test.mjs (testes 'arms match the workflow at HEAD') e, se algum falhar, atualiza o braço byte a byte na mesma tarefa.",
      "basis": ".claude/rules/measure.md (braço defasado torna a comparação inconclusiva); nenhuma das peças edita specRules, planRules, R_NOCOMMIT nem os prompts de revisão.",
      "alternative": "Atualizar todos os braços preventivamente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "acceptance",
      "what": "Conferir a linha run da sonda plan-only do E37 em docs/plans/roadmap-pos-2-3-0/measurements.md e aceitar ou reprovar o AC2.",
      "why": "O AC2 é verify: human; o workflow nunca registra uma aceitação humana como feita.",
      "blocking": false,
      "workaround": "O código do E37 segue na branch com o AC1 verde; o AC2 fica pendente até a conferência do dono (ou do subagent a quem ele delegar)."
    }
  ],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Atualizar a worktree D:/claude-pos23-release (hoje em 6abab96) para a ponta de release/pos-2.3.0 com o E37, antes da sonda.",
      "target": "worktree local D:/claude-pos23-release (fora do checkout da branch do entregável)"
    },
    {
      "id": "X2",
      "what": "Rodar 1 sonda paga plan-only com run-batch.mjs, teto de US$ 3,60 (DEC-051), config descartável D:/claude-pos23-cfg, --work e --out fora do repositório.",
      "target": "API paga via claude -p (config D:/claude-pos23-cfg)"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Plano congelado cujo data.spec aponta para uma spec que agora reprova no spec-tool, carregado por loadPlan(false)",
      "expected": "plan-tool check e emit com --no-spec saem 0 sem spec-invalid e a carga congelada segue; sem a flag, o check reprova como hoje"
    },
    {
      "id": "C2",
      "input": "Spec escrita e ainda não commitada na hora da carga (git rev-parse HEAD:<spec> sai 128)",
      "expected": "blob vazio, não é falha de carga; specReused falso e a revisão roda"
    },
    {
      "id": "C3",
      "input": "Spec nativa herdada do alvo, notes[E] presente, sem registro (run.json sem recorded.spec), autor sem mudança",
      "expected": "specReused segue verdadeiro (mínimo de commits de reviewTruth inalterado, sem \"fewer commits than expected\"), mas o portão do pulo não abre: a revisão da spec roda"
    },
    {
      "id": "C4",
      "input": "Baseline vermelha grande com recAt chamado mais de uma vez na mesma execução (spec,plan e final)",
      "expected": "Todos os comandos de approve saem sem prep e com até 6.000 caracteres; a concern aparece uma só vez"
    },
    {
      "id": "C5",
      "input": "Releitura de status recusada sem errors no JSON (só summary.exitCode 1), ou com stdout que não é JSON e exits.status diferente de 0",
      "expected": "'reread status --json refused' sem código inventado, nunca 'has no panel'; exits.status, já no envelope da releitura, é o sinal quando não há JSON"
    }
  ]
}
```
