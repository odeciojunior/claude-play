# Spec E46 -- Motivos, contratos e aspas no roadmap-release

## Intenção

Três correções pequenas no roadmap-release, cada uma entregável sozinha (REQ-008, REQ-009, REQ-011; B1, B5 e C1 do plano de correções `docs/plans/2026-11-25-correcoes-issues-plan.md`):

1. Uma dependência não atendida passa a dizer por quê no `reason` do item pulado e na nota "outside the selection"; o checker do roadmap avisa quando um Status tem várias peças e nenhuma `code` (a causa mais comum do pulo sem motivo da #1).
2. Os agentes `spec-author` e `plan-author` passam a dizer que o `gate` de `removedTests` é o `name` do portão de testes no `release.config.json` e quando ele é obrigatório (#19).
3. O `shq` do `roadmap-release.js` deixa de pôr aspas em valores seguros, para que o haiku que copia o comando não as perca (#18, DEC-015 opção A).

Pedido do dono: "implantar o roadmap". Depende do E43, que está sendo integrado: os números de linha abaixo são do worktree `D:/projects/claude-play-wt/pos-2-6-0-E43` (branch `plan/pos-2-6-0-E43`, `5525bf6`), lidos só para leitura.

## Escopo

**Dentro:**

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `selectDeliverables` (motivo por dependência, opcional por argumento), a chamada da seleção e o `shq`.
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`: só o texto curto do `onTargetEvidence` do caso sem segmento `code` (linha 505).
- `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`: aviso novo `status-no-code`, fora do bloco embutido.
- `plugins/productivity-tools/skills/roadmap-planner/references/formats.md` § 9: uma linha para o aviso novo.
- `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`: a frase sobre `gate`.
- Testes: `flow.test.mjs`, `prompts.test.mjs`, `cleanup.test.mjs`, `discovery-slices.test.mjs`, `load-slices.test.mjs` (em `skills/roadmap-release/workflow/`), `preflight.test.mjs`, `check-roadmap.test.mjs` e `scripts/agent-contracts.test.mjs`.

**Fora:**

- `roadmap-release-agy.py` (DEC-008): paridade agy fica "pendente #13" no checklist do entregável. O agy avalia o `recordCommands` do `.js` (`roadmap-release-agy.py:320-321`, `PURE_RECORD_JS`), então os comandos do tracker no agy também saem sem aspas nos valores seguros sem tocar no `.py`; o motivo por dependência (AC1) não chega ao agy.
- O `shq` duplicado em `skills/plan-coordinator/workflow/coordinator.js` (DEC-015): continua com aspas; já é pendente registrado em `state.md`.
- `lib/` (nenhum módulo embutido muda; ver R4) e o bump da linha 1 do `check-roadmap.mjs` (DEC-042: só na publicação, E54).
- A opção B do C1 (comando em arquivo) e a medição paga do efeito no haiku (E53).

**O que não fazer:**

- Não mexer na trava de 284.500 de `discovery-slices.test.mjs:122` (DEC-007).
- Não passar de 1.440 caracteres LF (teto B1 de 1.200 mais 20%) nem de 360 (teto C1 de 300 mais 20%) no `roadmap-release.js`; acima disso, parar e voltar ao dono por subagente opus (DEC-007, DEC-021). A medida de cada teto é o delta líquido de caracteres LF do `roadmap-release.js` entre o commit anterior à tarefa e o commit da tarefa: texto com CRLF trocado por LF (split CRLF, join LF) e `length`, a mesma fórmula da trava em `discovery-slices.test.mjs:119-122`.
- Não apagar teste nem afrouxar teste negativo: as mudanças de teste do C1 só trocam o formato esperado (com aspas para sem aspas nos valores seguros).
- Não escrever o número do limite de cópia em dígitos fora de `lib/plan-digest.mjs` e dos testes.

## Desenho

**AC1 (motivo por dependência e aviso no checker).** Em `selectDeliverables` (`roadmap-release.js:102`) entra o argumento opcional `explain`. Com ele, cada dependência faltante vira `E4: <motivo>`, e a lista é juntada por `; ` nos dois pontos com a mesma opacidade: o `reason` do pulo (`:167`) e a nota "outside the selection (pending dependencies: ...)" (`:153`). O motivo vem de uma função local: ID sem card dá `no card` (a guarda `byId[d]` segue o padrão de `:136`, e um ID sem card não quebra); merge interrompido (`isUnfinished`) dá `interrupted merge`; nos outros casos, o `onTargetEvidence` que o preflight já põe em cada card (`preflight.mjs:514`, que chega ao workflow pela descoberta), com `status` como reserva. Sem `explain`, o texto continua como hoje (R2). A chamada da seleção (`:1871`) passa `explain: true`. No preflight, o caso `word === null` (`preflight.mjs:505`) deixa de repetir a célula inteira. O `codeWord` (`preflight.mjs:428-433`) dá `null` em três casos: célula vazia, dois ou mais segmentos sem rótulo `code`, e um segmento único com rótulo que não é `code` (como `spec: done`). Os textos são: célula vazia, `no status on the panel`; dois ou mais segmentos, `status without a code segment (several pieces)`; segmento único rotulado, `status without a code segment` (R3). No checker, `extraChecks` de `check-roadmap.mjs` (perto de `blocked-no-blq`, `:972`) ganha o aviso `status-no-code`: uma linha do painel com célula Status não vazia em que a regra do `codeWord` dá `null` (nenhum segmento com rótulo `code`, e não é um segmento único sem rótulo), lida com `parseStatusSegments`, com a mensagem de que o roadmap-release não sabe se o código está no alvo. É só aviso, e o exit continua 0. `formats.md` § 9 ganha a linha do código.

Testes do AC1, todos obrigatórios e nas checagens do plano (o critério do card cita só `flow.test.mjs`; os outros dois arquivos provam as peças que o critério não alcança):

- `flow.test.mjs`: a função pura com uma dependência de Status `piece 1: done; piece 2: plan` (motivo no `reason`); uma dependência sem card (não quebra e aparece como `no card`); o pulo ainda em `skipped`; o mesmo pulo numa execução dry-run, em que o `reason` chega à seleção do resultado; sem `explain`, o texto de hoje.
- `preflight.test.mjs`: o `onTargetEvidence` da descoberta para célula vazia (`no status on the panel`), para duas peças sem `code` (`status without a code segment (several pieces)`) e para um segmento único rotulado `spec: done` (`status without a code segment`, sem o parêntese), e em nenhum caso o texto da célula repetido.
- `check-roadmap.test.mjs`: `status-no-code` como aviso numa célula de várias peças sem `code` e numa de segmento único rotulado que não é `code`; nenhum aviso numa célula vazia, numa de segmento único sem rótulo e numa com `code:`; exit 0 com o aviso.

**AC2 (frase sobre `gate` nos agentes).** No passo de `spec-author.md` que declara `removedTests` (`:35`) e no passo 3 de `plan-author.md` (`:36`), logo depois do literal `{ file, name, why, gate? }`, que fica intacto (`agent-contracts.test.mjs:68-73`), entra uma frase com três partes: `gate` é o `name` do portão de testes no `release.config.json` (por exemplo `"G1"`, nunca o kind `"tests"`); é obrigatório quando o config não tem exatamente um portão `kind: tests` sem `invariant` nem `ignoreFailuresWhenChanged`, o que inclui o caso de o único portão de testes ter `ignoreFailuresWhenChanged` (a regra de `roadmap-release.js:3123`: só com exatamente um o workflow passa `--single-tests-gate`; sem ela o `test-extract.mjs:245` acusa `gate obrigatório`); os nomes são lidos no `release.config.json` ou vêm no brief. O workflow já passa `gate: name` (`roadmap-release.js:3128`) e o extrator compara `e.gate !== opt.gate` (`test-extract.mjs:229`). Em `agent-contracts.test.mjs`, um teste novo confere nos dois arquivos as frases literais (`name`, o exemplo do kind, a condição "não tem exatamente um portão `kind: tests` sem `invariant` nem `ignoreFailuresWhenChanged`" e `release.config.json`). G2 (lint) confere o frontmatter.

**AC3 (shq sem aspas em valores seguros).** O `shq` (`roadmap-release.js:916`) aplica `oneLine` e devolve o valor sem aspas quando ele casa `^[A-Za-z0-9_%+=:./-]+$`; vazio continua `''`, e qualquer outro valor continua entre aspas simples com o idioma `'\''`. A mudança vale para todos os usos (DEC-015): descoberta (`:1812`), leitura de registro, carregamentos, tracker (`recordCommands`, `:983-1013`), captura e `test-extract removed` (`:3128`). O `node "${CAP}"` mantém as aspas duplas. O conjunto seguro não tem nenhum metacaractere do tokenizador de `verify-run.mjs` (`:38`, `:62-99`) nem barra invertida, então os grupos do tracker seguem aceitos; o `commandDigest` é calculado sobre o argv, então a verificação da captura não muda. O conjunto seguro não tem `@` nem vírgula (R7): o prompt do `gateOnce` (`roadmap-release.js:2069`) não fixa `agentType`, e no Windows o agente pode rodar o comando no PowerShell, onde `@` no início é splatting e a vírgula é operador de array; nonces com `@` continuam entre aspas.

Testes do AC3:

- O unitário do `shq` em `flow.test.mjs` (`:3229-3234`) ganha os casos valor seguro (sai sem aspas), com espaço, com barra invertida, vazio (`''`), com aspa, com `@` e com vírgula (os últimos cinco entre aspas).
- O teste do Git Bash (`:3236-3244`) ganha um valor com todos os caracteres do conjunto seguro e valores que começam com `-`, `=` e `@`, todos devolvidos literais.
- Consumidores que esperam aspas e passam ao formato novo (R5): em `flow.test.mjs`, `nonceOf` (`:179`), `unshq` (`:186`), o tracker falso (`:153`), `loadAnswer` (`:217-218`, que hoje só lê tokens entre aspas: sem aspas o argv sai vazio e o `cmdDigest` deixa de bater) e as asserções de `:339`, `:391`, `:407`, `:704`, `:1033-1043`, `:1060`, `:1235`, `:1570`, `:3009`, `:3302-3313`, `:3325-3332`, `:3494`, `:3578-3585`, `:3840`, `:3878-3879`, `:3908-3910`, `:4443`, `:4777-4779`, `:5729`, `:5757-5758`, `:5845`, `:5867` e `:5900`; `prompts.test.mjs:503` (espera `--cwd '/wt/E7'`, montado em `roadmap-release.js:641`); `discovery-slices.test.mjs:31,56,94`; `load-slices.test.mjs:91,188`.
- `:3494` é teste negativo ("nenhum prompt chama status sem a flag"): com a pasta sem aspas a regex de hoje não casaria nada e o laço passaria vazio; ganha contagem mínima de casamentos (DEC-004: o teste negativo não pode ficar vazio em silêncio).
- Os testes negativos que injetam por `replace` (`flow.test.mjs:1060`, `load-slices.test.mjs:188`) passam a afirmar que a troca aconteceu (o texto depois do `replace` é diferente do original).
- `cleanup.test.mjs:31-32` lê o fonte (`${shq(...)}`) e continua verde sem mudança, ou é ajustado só se o fonte mudar.

O plano confere de novo a lista contra o código integrado com o E43; um consumidor achado fora dela segue as mesmas regras do R5.

## Deixado para o plano

- Rebasear as linhas acima no `roadmap-release.js` integrado com o E43 e medir de novo o tamanho LF de partida (no E43, `5525bf6`, são 269.471; na release antes do E43, 267.240) e o delta de cada tarefa contra os tetos B1 e C1.
- A lista exata de asserts do C1 a ajustar depois do merge do E43 (o E43 pode ter acrescentado comandos com `shq`) e a ordem das tarefas (as três peças são independentes; B1 e C1 tocam o mesmo arquivo e vão em série).
- Conferir se algum teste roda o checker sobre um roadmap real ou de fixture com Status de várias peças sem `code` e espera zero avisos.
- Conferir o orçamento de prosa de `scripts/prose-budget.test.mjs` depois da linha nova em `formats.md` § 9.
- Checklist do entregável: "paridade agy: pendente #13 (o motivo por dependência não chega ao agy; os comandos do tracker no agy saem sem aspas nos valores seguros porque o agy avalia o recordCommands do .js, roadmap-release-agy.py:321)"; fechar o pendente "(executor) registrar o shq do coordinator.js como pendente fora do escopo (DEC-015)".
- Gates: G1 com o piso que o E43 deixar (hoje exit 0, tests 2660, pass 2658, fail 0, skipped 2 no `4329c5e`), G2 e G5 (`embed.mjs --check` nos 4 alvos, que deve seguir em dia sem edição em `lib/`).

```json data
{
  "schema": "spec/1",
  "id": "E46",
  "title": "Motivos, contratos e aspas no roadmap-release",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada uma dependência com Status de várias peças sem code, quando a seleção a pula, então o motivo aparece no reason e um ID sem card não quebra. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dados os agentes de spec e plano, quando o teste de contrato roda, então ambos dizem que gate é o name do portão de testes e quando é obrigatório. {verify: test; evidence: node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado um valor seguro, um com espaço, um vazio e um com aspa, quando o shq os formata, então só os não seguros ficam entre aspas. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "De onde vem e em que forma aparece o motivo de cada dependência faltante?",
      "decision": "Do onTargetEvidence que o preflight já põe em cada card, com 'no card' para ID sem card, 'interrupted merge' para merge interrompido e o status como reserva; formato 'E4: motivo', itens juntados por '; ', no reason do pulo e na nota 'outside the selection'.",
      "basis": "O campo já chega ao workflow pela descoberta (preflight.mjs:514), então o motivo custa poucos caracteres do teto B1 de 1.200 e diz a mesma coisa que o preflight decidiu.",
      "alternative": "Recalcular o motivo no workflow a partir da célula Status (duplica a regra do preflight e gasta mais do teto B1).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como acrescentar o motivo sem quebrar o teste de paridade T4 do agy, que compara skipped e notes do agy com a função pura do .js?",
      "decision": "Argumento opcional explain em selectDeliverables; só a chamada do workflow passa explain: true; sem ele o texto é o de hoje. A falta do motivo no agy fica como 'paridade agy: pendente #13'.",
      "basis": "A DEC-008 proíbe tocar no roadmap-release-agy.py; o T4 (roadmap-release-agy.test.mjs:251-277) continua comparando o agy com o comportamento padrão da função pura, sem afrouxar o teste.",
      "alternative": "Motivo sempre ligado e ajuste do T4 para ignorar o sufixo (afrouxa um teste de paridade, o que a DEC-004 manda para o dono).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Onde e como encurtar o motivo do caso sem segmento code, que hoje repete a célula Status inteira?",
      "decision": "No preflight.mjs:505, em inglês como o resto do arquivo: 'no status on the panel' com célula vazia; 'status without a code segment (several pieces)' com dois ou mais segmentos sem code; 'status without a code segment' com um segmento único rotulado que não é code (como 'spec: done'), casos em que o codeWord (preflight.mjs:428-433) dá null. É uma linha num arquivo da fila do E45, longe das linhas que o E45 muda (547-553 e 574).",
      "basis": "O motivo nasce no preflight; encurtar ali não gasta o teto B1 do workflow, e a célula vazia não é um caso de várias peças.",
      "alternative": "Encurtar no workflow ao montar o reason (gasta o teto B1 e deixa o onTargetEvidence longo nos cards).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde fica o aviso do checker para Status de várias peças sem code?",
      "decision": "Em extraChecks de check-roadmap.mjs, fora do bloco embutido, com o código status-no-code (célula não vazia em que a regra do codeWord dá null: nenhum segmento com rótulo code e não é um segmento único sem rótulo, o que inclui um segmento único rotulado como 'spec: done'), só aviso, com testes obrigatórios em check-roadmap.test.mjs, e uma linha em formats.md § 9. Nenhum módulo de lib/ muda; G5 roda mesmo assim e deve seguir em dia.",
      "basis": "Os avisos do checker (blocked-no-blq e afins) já vivem em check-roadmap.mjs, que usa parseStatusSegments do bloco embutido; sem edição em lib/ não há embed nos 4 alvos nem risco ao G5.",
      "alternative": "Helper novo em lib/roadmap-format.mjs, embutido de novo no checker (embed nos 4 alvos para uma regra de três linhas).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que fazer com os testes que esperam valores seguros entre aspas (nonce, cwd, base, prefix, palavras do tracker)?",
      "decision": "Passam ao formato novo. Toda regex de teste que extrai um valor passado pelo shq aceita as duas formas, (?:'((?:[^']|'\\\\'')*)'|(\\S+)) (nonceOf, unshq, loadAnswer, o tracker falso e afins); as asserções literais esperam o valor seguro sem aspas; os testes negativos que injetam por replace (flow.test.mjs:1060, load-slices.test.mjs:188) afirmam que a troca aconteceu; laços sobre casamentos (como flow.test.mjs:3494) ganham contagem mínima; o esperado de caminhos reais (tmpdir via fwd, que pode conter espaço) vem de PU.shq(...), nunca escrito à mão. Nenhum teste é apagado e nenhum teste negativo muda de sentido ou fica vazio.",
      "basis": "A DEC-015 manda a regra valer para todos os usos; manter aspas para alguns valores exigiria uma segunda função de aspas, contra a decisão.",
      "alternative": "Uma função à parte que mantém aspas nos valores lidos pelos testes (contra 'vale para todos os usos' da DEC-015 e com custo no teto C1 de 300).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Onde entra a frase sobre gate nos agentes?",
      "decision": "No mesmo passo que declara removedTests em cada agente, logo depois do literal { file, name, why, gate? }, que fica intacto; o teste de contrato confere a frase nos dois arquivos.",
      "basis": "É onde o autor decide o campo; manter o literal preserva o teste de agent-contracts.test.mjs:68-73. A condição segue o código: gate é exigido sempre que não há exatamente um portão kind: tests sem invariant nem ignoreFailuresWhenChanged (roadmap-release.js:3123).",
      "alternative": "Uma seção nova sobre portões nos dois agentes (mais prosa, longe do ponto de uso).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "O conjunto seguro do shq inclui @ e vírgula, como no plano de correções?",
      "decision": "Não: o conjunto é ^[A-Za-z0-9_%+=:./-]+$; valores com @ ou vírgula continuam entre aspas.",
      "basis": "O prompt do gateOnce (roadmap-release.js:2069) não fixa agentType, e no Windows o comando pode ir ao PowerShell, onde @ no início é splatting e vírgula é operador de array; tirar os dois não custa caracteres e só deixa alguns nonces entre aspas.",
      "alternative": "O conjunto do plano, ^[A-Za-z0-9_@%+=:,./-]+$ (seguro no Bash, ambíguo no PowerShell).",
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
      "input": "Dependência citada no card sem card correspondente no roadmap.",
      "expected": "O pulo acontece e o reason traz 'E<n>: no card', sem exceção."
    },
    {
      "id": "C2",
      "input": "Dependência com merge no alvo e status ainda não pós-merge.",
      "expected": "O motivo é 'interrupted merge', não o texto do merge encontrado."
    },
    {
      "id": "C3",
      "input": "Valor passado ao shq com barra invertida (como C:\\x), com @ ou vírgula, ou um valor seguro que começa com - ou =.",
      "expected": "Barra invertida, @ e vírgula ficam entre aspas simples; o valor seguro que começa com - ou = sai sem aspas; o Git Bash devolve o texto literal em todos."
    },
    {
      "id": "C4",
      "input": "Valor vazio passado ao shq.",
      "expected": "Sai como '' e o argumento vazio continua existindo no comando."
    },
    {
      "id": "C5",
      "input": "Célula Status vazia, com um só segmento sem rótulo, ou com um só segmento rotulado que não é code (como 'spec: done').",
      "expected": "Vazia ou segmento único sem rótulo: o checker não emite status-no-code, e o preflight diz 'no status on the panel' para a vazia. Segmento único rotulado: o checker emite status-no-code e o preflight diz 'status without a code segment', sem '(several pieces)'."
    }
  ]
}
```
