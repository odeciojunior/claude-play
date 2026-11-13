# Spec E24 -- Revisão final com verificação adversarial

## Intenção

Hoje todo achado bloqueante da revisão final da branch gera correção, sem que ninguém tente refutá-lo (SRC-02; REQ-030). E24 acrescenta dois modos à revisão final do release, os dois desligados por padrão (DEC-021): a verificação adversarial, em que uma chamada no modelo da revisão final tenta refutar cada achado bloqueante e só o achado refutado explicitamente deixa de gerar correção, ficando registrado; e a onda única, em que a correção final tem um só despacho e uma só nova revisão. Sem os modos, a revisão final se comporta como hoje. É a terceira fatia de E9 (DEC-039), depois de E21 e E23, no mesmo arquivo de workflow; os prompts novos não citam o superpowers e proíbem perguntar à pessoa (REQ-008, REQ-013). É Should (DEC-022); o padrão dos modos é decidido em E27 com medição.

## Escopo

Dentro:

- `plugins/productivity-tools/agents/final-reviewer.md` (novo): agente do plugin com os modos `review` (o texto genérico da revisão final da branch, que sai do workflow) e `verify` (a verificação adversarial), só leitura, com a frase de `NO_ASK` literal no corpo (forma de DEC-593).
- `plugins/productivity-tools/agents/test-integrity.md` (novo): agente do plugin que recebe o texto de instrução do agente `${E}:test-integrity` da revisão final (gravar o programa, rodar o comando exato, apagar o arquivo, devolver os campos, `removedAsserts=-1` quando o programa falha), com `tools: Read, Write, Bash` e a frase de `NO_ASK` literal; o comportamento da medida não muda.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: no bloco da revisão final (do agente `${E}:test-integrity` ao fim de `finalLoop`), o despacho da revisão final passa ao agente pelo `agentType`, o texto genérico sai do prompt, a verificação adversarial entra no callback de revisão e a onda única entra nas opções do laço; uma função pura nova no bloco `// <pure>` para separar os achados refutados; um schema `S_VERIFY`; a opção `once` em `runReviewLoop`, sem efeito quando ausente.
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` e `preflight.test.mjs`: `validateReleaseConfig` aceita o campo `finalReview { adversarial, singleWave }`.
- Casos novos em `workflow/review.test.mjs` (critérios 1 a 3) e em `workflow/prompts.test.mjs` (critério 4), que já existem; em `workflow/flow.test.mjs`, a asserção do teste R3/I-2 sobre o prompt de `E1:final-1-r2` (linha 2189) muda de lugar junto com a regra (ver Desenho).
- Uma linha em `skills/roadmap-release/references/config.md` (campo `finalReview`) e duas na seção Agents de `plugins/productivity-tools/README.md` (agentes `final-reviewer` e `test-integrity`).
- Teste comportamental da skill (definição de pronto, SRC-03), como tarefa do orquestrador da sessão principal (DEC-204).

Fora:

- Ligar qualquer modo por padrão (E27 decide, DEC-021); a revisão por tarefa (E21) e a revisão única por tarefa (E28); a retomada e o registro `run.json` (E23), cuja chave do estágio final continua a mesma.
- As revisões de spec, de plano, de conflito, de gates e de delta; o comportamento da medida de integridade dos testes (o programa `TEST_INTEGRITY`, o comando, o modelo haiku e o esforço low, os campos devolvidos e os alertas) e a chamada `${E}:resume-test-integrity` do estágio de merge. Só o texto de instrução do agente `${E}:test-integrity`, que fica no bloco da revisão final, muda de lugar.
- A pasta do roadmap `docs/plans/roadmap-evolucao-skills/` e a estratégia; versão do plugin (sem bump).

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` nem editar `size.test.mjs` (DEC-556, DEC-563); não encurtar texto, comentário ou helper compartilhado de outro estágio; não tirar nenhuma regra do prompt da revisão final, só mudá-la de lugar.
- Não tirar da correção um achado que a verificação não refutou explicitamente, nem um achado cuja verificação não devolveu resultado.
- Não mudar o número de rodadas da correção final no modo padrão; não acrescentar chamada no modo padrão.
- Não citar `superpowers`; não fazer push nem tocar em `main`; não subir a versão.

## Desenho

**Configuração dos modos.** Campo novo `finalReview` em `release.config.json`, com os booleanos opcionais `adversarial` e `singleWave`, ausentes valendo falso e lidos com `=== true`, na forma que DEC-602 deu a `taskReview`. `validateReleaseConfig` em `scripts/preflight.mjs` recusa `finalReview` que não seja objeto, um dos dois campos que não seja booleano e qualquer outra chave, com um erro que nomeia a chave; `preflight.test.mjs` ganha os casos. O workflow lê uma vez, no bloco da revisão final, `const FR = CFG.finalReview || {}`. `config.md` ganha a linha da tabela: os dois modos são desligados por padrão e E27 decide ligá-los.

**Agente da revisão final e espaço no teto.** `roadmap-release.js` mede 239.994 caracteres LF na ponta da release (fc4ccaa), 6 sob o teto. Antes de somar código, a primeira tarefa que edita o script cria `agents/final-reviewer.md` e `agents/test-integrity.md` e move para eles o texto genérico do bloco da revisão final, e as chamadas `${E}:final-<n>-r<rodada>` passam a despachar `agentType: 'productivity-tools:final-reviewer'` com `Mode: review`, o mesmo modelo (opus) e esforço (high) de hoje, por um objeto de opções `FRA` (agente, fase, modelo, esforço) definido no bloco e reusado pela chamada de verificação. O prompt guarda só os dados: o briefing `C()`, a chave da lente, o comando do diff, os caminhos de spec, plano e card (`cardRef`), os alertas de integridade e os achados da rodada anterior com `repeatRule()`. O agente segue a forma de `task-reviewer.md` (DEC-584, DEC-585): `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort` no frontmatter, a precedência do prompt sobre o arquivo. Nenhuma regra sai: cada frase removida do prompt passa a valer no corpo de um agente, e as frases de `cardRef`, `R_COUNT`, `repeatRule()`, `lockNote()` e `noSpecEdit()` (helpers compartilhados) não mudam.

O espaço só é liberado nesse bloco (do agente `${E}:test-integrity` ao fim de `finalLoop`, 2.776 caracteres medidos em fc4ccaa). Fontes, medidas no script em fc4ccaa, com o saldo estimado da primeira tarefa:

| Fonte no bloco | Hoje | Destino | Saldo |
|---|---|---|---|
| Cabeçalho `FINAL REVIEW OF THE WHOLE BRANCH (mandatory; read-only), lens: ` | 63 | `Mode: review, lens: ` no prompt; o resto no corpo do modo `review` | -43 |
| ` (branch already synced with the target)` | 40 | corpo do modo `review` | -40 |
| `Check against the spec …, the plan … and the acceptance criteria of the ${cardRef}.` | 113 | `Spec …, plan …, ${cardRef}.`; o "conferir contra" no corpo | -56 |
| `Look for what per-task reviews miss: …` | 230 | corpo do modo `review` | -231 |
| Regra dos alertas `(check each one; weakening a test without justification is a critical defect)` | 77 | corpo do modo `review` | -77 |
| Rótulo `ALERTS MEASURED IN THE TESTS` e a constante `integTxt`, posta inline no prompt com rótulo curto | ~110 | rótulo curto; o sentido no corpo | -45 |
| `verify them; ` antes de `${repeatRule()}` | 13 | corpo do modo `review` | -13 |
| `\nBlocks (defeito): an edit to the spec or the plan made by a fix round.` | 72 | corpo do modo `review` | -72 |
| `\nMeasure: headSha, clean, ${R_COUNT}.` | 37 | corpo do modo `review` (o `commitsInRange` de `git -C <worktree> rev-list --count <target>..HEAD`, com o worktree e o alvo da linha do diff) | -37 |
| Texto das lentes em `const lenses` | 309 | chaves curtas (`correctness`, `security`, e uma chave única para card não crítico), definidas no corpo | -224 |
| Retorno do callback `{ issues: …, headSha: rs[0].headSha, clean: …, commitsInRange: rs[0].commitsInRange }` | 137 | `{ ...rs[0], issues: …, clean: … }` | -52 |
| Instrução do agente `${E}:test-integrity` (tudo menos o caminho do programa, o comando exato e `TEST_INTEGRITY`) | ~255 | `agents/test-integrity.md`; a chamada ganha o `agentType` | -210 |
| ` with a test for each defect, run the affected tests` no prompt de `${E}:final-fix<k>` | 52 | já está no modo de correção de `agents/implementer.md` ("Write a test that reproduces each defect", "Run the same command until it passes"), que não é editado | -52 |
| `FRA` e o `agentType` da revisão | 0 | definição (~105) menos fase, modelo e esforço da chamada (~42) | +63 |

Saldo da primeira tarefa: cerca de -1.090, o script perto de 238.900 (limite 239.300). Segunda tarefa (onda única: `FR`, opção `once` em `finalLoop`, condição e mensagem em `runReviewLoop`): cerca de +100 a +135, perto de 239.040 (limite 239.600). Terceira tarefa (verificação: `S_VERIFY` ~180, `splitRefuted` ~250, a chamada com `...FRA`, o filtro e o `out.reviews.push` ~350): cerca de +750 a +790, perto de 239.790 (limite 239.800). Reserva, na ordem, se a medida da última tarefa passar do limite: chave de lente mais curta para o card não crítico (-15), `S_VERIFY` com `required` só no nível de cima (-20), a mensagem da onda única sem o número de correções, que fica no log de rodadas (-30). Se nem a reserva bastar, a tarefa não faz commit e devolve BLOCKED com o déficit medido (nota do dono); nenhuma fonte fora do bloco é usada. Cada tarefa que edita o script mede `workflowChars` de `size.test.mjs` depois de cada edição.

**A regra do teste R3/I-2 muda de lugar com a frase.** Hoje `flow.test.mjs:2189` confere `/Blocks \(defeito\): an edit to the spec or the plan/` no prompt de `E1:final-1-r2`. A tarefa que move a frase troca essa asserção por três, no mesmo teste, que mantêm a garantia: a chamada `E1:final-1-r2` tem `opts.agentType === 'productivity-tools:final-reviewer'`; seu prompt traz `Mode: review` e a lista dos achados anteriores; e `agents/final-reviewer.md`, lido pelo teste, traz no modo `review` a frase `Blocks (defeito): an edit to the spec or the plan made by a fix round` ligada à rodada com achados anteriores. A asserção da linha 2188 (`E1:gates-fix1-review`) não muda.

**Critério 1 (modo ligado, achado refutado: sem correção e registrado).** Com `FR.adversarial === true`, o callback de revisão de `finalLoop`, depois de juntar os achados das lentes, toma os achados bloqueantes (`blocking`) e, se houver ao menos um, faz uma única chamada `${E}:final-verify-r<rodada>` ao mesmo agente com `Mode: verify`, modelo opus, esforço high, schema `S_VERIFY = { verdicts: [{ n, refuted, reason }] }` e a lista numerada `fmt(...)` dos achados. O texto do modo `verify` em `final-reviewer.md` manda tentar refutar cada achado lendo o código e rodando só comandos de leitura, dar `refuted: true` só com evidência concreta (arquivo e linha, ou saída de comando) que mostre o achado errado, e na dúvida dar `refuted: false`. Uma função pura nova no bloco `// <pure>`, `splitRefuted(iss, verify)`, devolve `{ keep, refuted }`: sai de `keep` só o achado cujo veredicto de mesmo número tem `refuted === true` e `reason` não vazio; os refutados levam o `reason`. O callback devolve as `issues` sem os refutados, então `runReviewLoop` não os corrige nem os repete na rodada seguinte, e empurra `{ stage: 'final-verify', round, refuted }` em `out.reviews`, que `persistReviews` já transcreve no log de revisões. O caso em `review.test.mjs` roda o workflow com agentes simulados (a forma de `AsyncFunction` que o arquivo já usa) com o modo ligado e um achado refutado, e confere que nenhum rótulo `:final-fix` foi chamado e que o resultado traz o achado em `refuted`; casos de `splitRefuted` pelo `loadPure`.

**Critério 2 (modo ligado, achado confirmado ou sem resultado: segue para a correção).** `splitRefuted` mantém em `keep` o achado com `refuted: false`, sem veredicto, com número que não confere ou com `reason` vazio, e todos quando a chamada de verificação devolve `null`. O caso em `review.test.mjs` usa um achado confirmado e, em outra execução, a verificação nula, e confere que `${E}:final-fix1` foi chamado com o achado.

**Critério 3 (padrão sem verificação e com as rodadas de hoje; onda única com um despacho e uma revisão).** Com `finalReview` ausente, o callback não chama `:final-verify` e o laço é o de hoje: `runReviewLoop` com `env.maxFix = MAXFIX` (`maxFixRounds`, padrão 2) e a rodada extra da escalada. Com `FR.singleWave === true`, `finalLoop` passa `once: true` nas opções; em `runReviewLoop` a condição do laço de correção passa a limitar `k` a `Math.min(1, env.maxFix)` quando `opt.once`, sem a rodada extra da escalada, e a mensagem de falha cita o número de correções feitas; sem `once` nada muda, e os testes atuais de `reviewLoop` continuam passando. Os casos de `review.test.mjs` contam as chamadas: no padrão com um achado que volta, `:final-fix` é chamado como hoje e nenhum `:final-verify`; com a onda única e um achado que volta, há um só `:final-fix1` e uma só nova revisão (`-r2`), e o entregável para com o achado aberto.

**Critério 4 (prompts sem superpowers e proibindo perguntar).** O caso de `prompts.test.mjs` lê `agents/final-reviewer.md` e confere o frontmatter (`name: final-reviewer`, descrição que diz que nunca pergunta e só lê, `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort`), que o corpo traz a frase de `NO_ASK` literal e os dois modos; lê `agents/test-integrity.md` e confere `name: test-integrity`, `tools: Read, Write, Bash`, sem `model` nem `effort`, e a frase de `NO_ASK` literal; confere que nem os agentes nem o script citam `superpowers`, e que as chamadas `:final-` e `:final-verify` carregam o `agentType` do agente e abrem com o briefing, que traz a regra "Asking the user is FORBIDDEN". Como o arquivo é editado, a conferência do rótulo `:impl` do critério 3 de E9 passa de `/:impl/` em qualquer parte do trecho a exigir que `runImpl` seja chamado com o rótulo `` `${E}:t${t.n}:impl` `` e que a chamada de `implAgent` de `runImpl` comece por `buildImplPrompt(` (nota do dono).

**Tamanho do script (nota do dono).** Cada tarefa que edita `roadmap-release.js` tem uma conferência que imprime `workflowChars` e sai 1 acima do seu limite: a primeira até 239.300, as do meio até 239.600, a última até 239.800; nenhuma rodada de correção termina acima de 240.000. Uma tarefa que não cabe no limite não faz commit e devolve BLOCKED com o déficit medido. Cada conferência é uma chamada simples, sozinha, sem pipe nem encadeamento; vermelho e verde são duas chamadas do mesmo comando.

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal no worktree de E24, antes do merge (DEC-204): no workflow ela devolve NEEDS_HUMAN, sem relatório fictício. O orquestrador abre sessões `claude -p` com `--plugin-dir` no worktree (DEC-566) que despacham `productivity-tools:final-reviewer` pelo nome nos modos `review` e `verify` sobre fixture sintética marcada, com um defeito plantado real e um achado falso, e escreve o relatório em `docs/reports/`.

## Deixado para o plano

- A ordem das tarefas, com teste primeiro para `splitRefuted`, a opção `once`, a validação de `finalReview` e os casos de fluxo; a primeira tarefa que edita o script é a que move o texto para o agente.
- O texto exato dos agentes e dos prompts, o nome final da função pura e as chaves das lentes, dentro das fontes da tabela do Desenho; o plano não usa fonte fora do bloco da revisão final.
- Manter a saída `emit` do plan-tool abaixo de 24 KB; os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo; a revisão final da branch inteira é o estágio final do workflow.

```json data
{
  "schema": "spec/1",
  "id": "E24",
  "title": "Revisão final com verificação adversarial",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o modo de verificação adversarial ligado e um achado bloqueante que a verificação refuta, quando o workflow o processa, então ele não gera correção e fica registrado como refutado no resultado da revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado o modo ligado e um achado que a verificação confirma, ou cuja verificação não devolve resultado, quando o workflow o processa, então ele segue para a correção. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dada a configuração padrão, quando a revisão final tem achados bloqueantes, então todos geram correção, sem chamada de verificação, e o número de rodadas é o que o release usa hoje; com o modo de onda única ligado, há um só despacho de correção e uma só nova revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC4",
      "text": "Dados os prompts da revisão final e da verificação adversarial, quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde os modos são ligados?",
      "decision": "Campo finalReview { adversarial, singleWave } de release.config.json, ausente valendo falso, lido com === true; validateReleaseConfig recusa valor que não seja objeto, campo que não seja booleano e qualquer outra chave; config.md documenta.",
      "basis": "DEC-021 (modos desligados por padrão); DEC-602 deu a mesma forma a taskReview.",
      "alternative": "Argumentos por execução (args.finalReview).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como a verificação adversarial é despachada?",
      "decision": "Uma chamada por rodada da revisão final, só quando há achado bloqueante, com todos os achados bloqueantes numerados, no modelo e esforço da revisão final (opus, high), rótulo <E>:final-verify-r<rodada>, schema S_VERIFY { verdicts: [{ n, refuted, reason }] }.",
      "basis": "Peça 1 e risco 2 do card (chamadas no modelo da revisão final, medidas por papel); uma chamada por rodada limita o custo.",
      "alternative": "Uma chamada por achado.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Qual achado sai da correção?",
      "decision": "Só o achado cujo veredicto de mesmo número tem refuted === true e reason não vazio; sem veredicto, número que não confere, reason vazio ou chamada nula: segue para a correção. O refutado fica em out.reviews como { stage: 'final-verify', round, refuted } e vai ao log de revisões.",
      "basis": "Critérios 1 e 2; REQ-030; risco 1 do card.",
      "alternative": "Tirar o achado quando a maioria das lentes não o confirma.",
      "costIfWrong": "high",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde fica o texto da revisão final e da verificação?",
      "decision": "Num agente do plugin, productivity-tools:final-reviewer (agents/final-reviewer.md), com os modos review e verify, só leitura, NO_ASK literal no corpo; as chamadas da revisão final e da verificação o despacham por agentType, com o modelo e o esforço de hoje, por um objeto de opções FRA do bloco; o prompt guarda só os dados, e as lentes viram chaves curtas definidas no corpo.",
      "basis": "Nota do dono (texto novo de prompt em agente do plugin; espaço liberado só no bloco da revisão final); DEC-584, DEC-585 e DEC-593 fizeram o mesmo na revisão por tarefa.",
      "alternative": "Manter a revisão final no agente genérico e criar um agente só para a verificação, liberando espaço por reescrita do prompt.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como a onda única limita a correção final?",
      "decision": "Opção once de runReviewLoop, passada só por finalLoop quando singleWave é true: no máximo um despacho de correção (Math.min(1, maxFix)) e uma nova revisão, sem a rodada extra da escalada; com maxFixRounds 0 continua sem correção; sem a opção o laço não muda.",
      "basis": "Peça 2 e critério 3 do card; o laço é o único lugar que controla rodadas e a escalada daria uma segunda correção.",
      "alternative": "Chamar runReviewLoop com env.maxFix = 1, que ainda permite a rodada extra da escalada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Onde fica a regra que separa os refutados, se a nota do dono manda lógica nova para um script do plugin?",
      "decision": "Numa função pura curta no bloco // <pure> do workflow (splitRefuted), testada por loadPure; nenhum script novo.",
      "basis": "O workflow não importa módulos nem roda shell; um script exigiria um agente para rodá-lo e o workflow teria de reaplicar a regra da refutação explícita sobre a saída dele. E23 manteve as funções puras de decisão no workflow (runKey, skipReview) e o git no script.",
      "alternative": "Um script do plugin rodado pelo agente de verificação, que imprime a lista a corrigir.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como a entrega cabe no teto de 240.000 caracteres?",
      "decision": "Medir workflowChars depois de cada edição; liberar espaço antes de somar código, só no bloco da revisão final (do agente de integridade dos testes ao fim de finalLoop, 2.776 caracteres), pelas fontes da tabela do Desenho: texto genérico da revisão para final-reviewer.md (cerca de -570), lentes por chave (-224), retorno do callback compacto (-52), instrução do agente de integridade para test-integrity.md (-210), a frase do prompt de correção que repete o modo de correção de implementer.md (-52), menos FRA (+63): cerca de -1.090 na primeira tarefa; onda única cerca de +135 e verificação cerca de +790 depois; reserva nomeada para a última; limites por tarefa 239.300 (primeira), 239.600 (meio), 239.800 (última); nenhuma correção acima de 240.000; tarefa fora do limite não faz commit e devolve BLOCKED com o déficit.",
      "basis": "Nota do dono; DEC-556, DEC-563; o script mede 239.994 caracteres LF em fc4ccaa; tamanhos medidos no bloco em fc4ccaa.",
      "alternative": "Encurtar texto de outros estágios do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Quem faz o teste comportamental da skill?",
      "decision": "O orquestrador da sessão principal, no worktree de E24 antes do merge, com sessões claude -p e --plugin-dir que despacham final-reviewer pelo nome nos modos review e verify sobre fixture sintética marcada; relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.",
      "basis": "DEC-204; DEC-566; definição de pronto do card (SRC-03).",
      "alternative": "Rodar o release inteiro em sandbox dentro do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Há bump de versão?",
      "decision": "Não; config.md ganha a linha de finalReview e a seção Agents do README do plugin a linha do final-reviewer.",
      "basis": "Nota do dono; DEC-595 e DEC-618.",
      "alternative": "Subir a versão nos dois lugares.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Para onde vai a instrução do agente de integridade dos testes, que está no bloco da revisão final?",
      "decision": "Para um agente próprio, productivity-tools:test-integrity (agents/test-integrity.md, tools Read, Write, Bash, NO_ASK literal); a chamada <E>:test-integrity o despacha por agentType com haiku e low, e o prompt guarda o caminho do programa, o comando exato e TEST_INTEGRITY; a medida, os campos e os alertas não mudam; resume-test-integrity, do estágio de merge, não muda.",
      "basis": "Nota do dono (espaço só nesse bloco; texto novo de prompt em agente do plugin); o modo só leitura do final-reviewer não tem Write, que o programa precisa.",
      "alternative": "Um modo integrity em final-reviewer.md com a ferramenta Write.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como fica o teste R3/I-2 que confere a regra de edição de spec ou plano no prompt da revisão final?",
      "decision": "flow.test.mjs entra no escopo; a asserção da linha 2189 vira três no mesmo teste: E1:final-1-r2 despacha agentType productivity-tools:final-reviewer, seu prompt traz Mode: review e os achados anteriores, e agents/final-reviewer.md traz no modo review a frase Blocks (defeito): an edit to the spec or the plan made by a fix round.",
      "basis": "Revisão do spec (S1); a nota do dono manda texto de prompt para o agente; a garantia continua testada no mesmo teste.",
      "alternative": "Manter a frase no prompt (72 caracteres a mais no bloco).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "decision",
      "what": "Corrigir o card E24 por revisão da estratégia para nomear também plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs entre os arquivos de teste (validação de finalReview).",
      "why": "Revisão de estratégia é ato do dono; a entrega não edita a estratégia nem a pasta do roadmap.",
      "blocking": false,
      "workaround": "O spec nomeia o arquivo e o teste roda no G1."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Modo adversarial ligado e todos os achados bloqueantes refutados.",
      "expected": "Nenhuma correção; finalLoop termina ok; os refutados ficam em out.reviews com o motivo."
    },
    {
      "id": "C2",
      "input": "Modo adversarial ligado e a revisão final só com achados menores.",
      "expected": "Nenhuma chamada de verificação; o laço segue como hoje."
    },
    {
      "id": "C3",
      "input": "Veredicto com refuted true e reason vazio, ou com número fora da lista.",
      "expected": "O achado segue para a correção."
    },
    {
      "id": "C4",
      "input": "Achado refutado que a nova revisão reporta outra vez depois de uma correção de outro achado.",
      "expected": "Passa por nova verificação na rodada; só sai da correção se for refutado de novo."
    },
    {
      "id": "C5",
      "input": "release.config.json com finalReview { adversarial: 'sim' } ou com a chave single.",
      "expected": "O preflight recusa e nomeia a chave."
    }
  ]
}
```
