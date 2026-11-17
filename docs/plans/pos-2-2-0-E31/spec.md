# Spec E31 -- Origem da correção extra em parada-retomada

## Intenção

REQ-004 manda apurar a origem da correção extra de parada-retomada e corrigir se for defeito do produto. As execuções pagas e o relatório `docs/reports/2026-11-17-E31-parada-retomada.md` já existem (peça 1 do card, critério 1, ato humano de conferência). DEC-025 fechou a causa como provável (n=1) e defeito do produto: saída mecânica de agente haiku aceita sem conferência vira achado sintético e correção opus da spec, e mandou corrigir a carga e o commit da spec antes de E33, como peça de E31, só G1. Este entregável entrega só a peça 2, "Correção no produto", pequena pela DEC-012, conforme a instrução do dono de 2026-11-17: duas conferências no workflow `roadmap-release.js`, com teste.

O relatório identifica os dois caminhos: na retomada (S2), `E5:spec-load1` devolveu `checkExit: 1, emitExit: 2` com `summary.exitCode: 0` no stdout, e `checkSpecLoad` virou `checkFailed`, derrubando o pulo das revisões de spec e de plano; antes do corte (S1), `E5:spec-commit` devolveu commit vazio porque o Bash não mostra o exit 1 de `git diff --cached --quiet`, e `specReused = !cm.commit` aceitou o vazio sem conferir.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `checkSpecLoad`, o texto de `R_LOAD`, o prompt de `commitAgent`, o schema `S_COMMITTED` e os dois pontos que usam o commit (spec e plano).
- Testes novos e ajustes de mocks em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Fora:

- A peça 1 do card (execuções pagas, transcrições e relatório): já feita; o critério 1 é a conferência do dono (H1).
- Execução paga, bump de versão, nota de atualização e publicação (E33).
- Formato de plano, de estado e de `run.json`; portões canônicos; `size.test.mjs` e o teto `MAX_WORKFLOW_CHARS`.
- A carga do plano (`checkPlanLoad`) e as caudas "head = 3" e "blob = 3, head = 4" dos prompts de carga (R2).
- A pendência do `state.md` sobre carga que não dependa de transcrição por modelo (roadmap futuro).

O que não fazer:

- Não editar a pasta `docs/plans/roadmap-pos-2-2-0/` nem o relatório de E31.
- Não mexer em outro arquivo de produto além de `roadmap-release.js` (DEC-012).
- Não passar de 2.500 caracteres somados na correção inteira de `roadmap-release.js` (hoje 243.223 de 250.000, medidos em LF), nem mudar o teto.
- Não fazer push, não tocar em `main` nem na branch de release.

## Desenho

**Carga da spec que confere o exit code (critério 2, correção 1).** Em `checkSpecLoad`, logo depois da conferência de que `checkExit` e `emitExit` são inteiros e antes de `if (t.checkExit !== 0)`, o código tenta `JSON.parse(String(t.checkStdout))` (erro de parse é ignorado). Quando o resultado é um objeto com `tool === 'spec-tool'` e `summary.exitCode` inteiro, e esse valor difere de `t.checkExit`, a função devolve `{ ok: false, why: 'spec-tool check exit <checkExit> differs from summary.exitCode <n> in its stdout' }`: é carga falha, e `load3` faz nova tentativa (1-2 haiku, 3-5 sonnet), nunca `checkFailed`. `checkFailed` continua quando os dois concordam num valor diferente de 0, ou quando o stdout não é esse JSON (texto livre, JSON sem `summary.exitCode` inteiro), como hoje. Assim a retomada do relatório (S2) tem `spec-load2` e não perde o pulo das revisões de spec e de plano (`specSkip` e `planSkip`). Em `R_LOAD`, o trecho "checkStdout and checkExit = 1, emitStdout and emitExit = 2," passa a "checkStdout and checkExit from command 1, emitStdout and emitExit from command 2,", que não se lê como valor; o texto vale para a carga da spec e a do plano, que usam a mesma constante.

**Commit da spec e do plano que não depende de exit code (critério 2, correção 2).** No prompt de `commitAgent`, o passo 3 passa a `git -C "<wt>" diff --cached --name-only -- <arquivo>` (saída vazia = nada a commitar: não commitar e apagar o arquivo de mensagem); o passo 4 commita quando a saída não é vazia. O passo de retorno pede, medido depois dos passos, `pending` = a saída de `git -C "<wt>" status --porcelain -- <arquivo>`, além de `head` e `commit`. `S_COMMITTED` ganha `pending: STR` (schema de agente, não formato de `run.json`). Um helper `commitChecked(kind, file, phase, tail)` chama `commitAgent` em haiku; quando o resultado é `ok` com `commit` vazio e o arquivo não está confirmado limpo (`pending` com texto, ou `pending` ausente: R1), repete o commit uma vez em sonnet com o rótulo `${E}:${kind}-commit2` (R3); se persistir, devolve `{ ok: false, error: '<arquivo> still pending after an empty commit: <pending>' }`, que os pontos de chamada já transformam em `fail('infra', 'spec commit: ...')` ou `fail('infra', 'plan commit: ...')`. O commit da spec (`specReused = !cm.commit`) e o do plano (`planCommitted = !!cm.commit`) passam a usar `commitChecked`, de modo que a revisão nunca segue com `specReused` (ou `plan.reused`) calculado de um commit vazio não conferido. Commit vazio com `pending` vazio continua sendo reaproveitamento legítimo.

**Testes (critério 2).** Em `flow.test.mjs`: (a) retomada com `run.json` válido (`recordedSetup(RUN_REC)`) e `E1:spec-load1` devolvendo `checkExit: 1`, `emitExit: 2` e `checkStdout` com `{"tool":"spec-tool",...,"summary":{"exitCode":0}}`: há `E1:spec-load2`, nenhum `E1:spec-fix`, e as notas "spec review skipped" e "plan review skipped" estão nas concerns; (b) check realmente falho, com `checkExit: 1` e `summary.exitCode: 1`: `E1:spec-fix1` roda e seu prompt traz "spec-tool check exited 1" (achado crítico), e o teste puro `checkSpecLoad separates a failed check from a failed load` ganha os casos de desacordo (0 contra 1 e 1 contra 0: `ok` false) e de acordo em 1 (`checkFailed`); (c) spec nova com `E1:spec-commit` devolvendo `{ ok: true, commit: '', pending: 'A  docs/plans/x-E1/spec.md' }`: há `E1:spec-commit2` em sonnet e nenhum `E1:spec-fix`; e, com o pendente persistindo em `spec-commit2`, o entregável falha como infra sem `E1:spec-review1`; (d) commit vazio legítimo (`pending: ''`) segue como reaproveitado, sem `spec-commit2`. O teste existente do agente de commit passa a conferir `diff --cached --name-only`, `status --porcelain -- docs/plans/x-E1/spec.md` e a ausência de `--quiet`, e um teste confere que o prompt de `spec-load1` não contém "checkExit = 1". Os mocks existentes que devolvem commit vazio (FF/I1 e F2/I-A) ganham `pending: ''`. G1 inteiro é a evidência; `size.test.mjs` roda sem mudança e confere o teto.

**Relatório (critério 1).** O relatório já está em `docs/reports/2026-11-17-E31-parada-retomada.md` e identifica estágio, agente e motivo; nada a escrever aqui. A aceitação é do dono (H1).

## Riscos

- A correção passa de 2.500 caracteres ou do teto de 250.000 -> o helper é único para spec e plano e o texto novo do prompt substitui o antigo; se ainda assim não couber, vira pendente com dono e aceite (gatilho de DEC-025).
- O agente sonnet também devolve commit vazio com pendente -> `fail('infra')` com o pendente na mensagem, sem revisão sobre estado não conferido.
- Um agente devolve `summary.exitCode` certo e `checkExit` errado nas cinco tentativas -> a carga falha como infra, o que é melhor que uma correção opus sintética.

## Deixado para o plano

- Ordem das tarefas (correção 1 com testes a e b; correção 2 com testes c e d; G1 e medida de tamanho na tarefa final) e o nome exato dos testes.
- O texto exato da mensagem de erro e do novo passo do prompt, dentro do desenho.

```json data
{
  "schema": "spec/1",
  "id": "E31",
  "title": "Origem da correção extra em parada-retomada",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dadas as transcrições novas de parada-retomada, quando lidas, então a chamada de correção extra está identificada (estágio, agente e motivo) num relatório em docs/reports. {verify: human; evidence: o dono confere o relatório em docs/reports}"
    },
    {
      "id": "AC2",
      "text": "Dada a causa, quando é defeito do produto, então a correção tem teste e G1 passa; quando não é, há decisão registrada que a aceita. {verify: test; evidence: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Commit vazio sem o campo pending conta como conferido?",
      "decision": "Não: S_COMMITTED ganha pending; commit vazio só vale como reaproveitamento com pending string vazia; pending com texto ou ausente leva à repetição em sonnet e, persistindo, a fail('infra'). Os mocks de commit vazio dos testes ganham pending ''.",
      "basis": "Instrução do dono de 2026-11-17 (nunca seguir com specReused de commit vazio não conferido); DEC-025; relatório de E31, S1.",
      "alternative": "Tratar pending ausente como nada pendente, mantendo os mocks atuais sem mudança.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "As caudas head = 3 e blob = 3, head = 4 dos prompts de carga também mudam?",
      "decision": "Não: muda só R_LOAD, como pediu o dono; head e blob são strings conferidas (blob por regex) e não causaram correção no lote.",
      "basis": "Instrução do dono de 2026-11-17 (trocar o texto de R_LOAD); DEC-012 (correção pequena); relatório de E31 (os erros foram checkExit e emitExit).",
      "alternative": "Reescrever também as caudas para 'from command N'.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como repetir o commit e com que rótulo?",
      "decision": "Um helper commitChecked usado pelos commits da spec e do plano; a repetição usa commitAgent em sonnet com o rótulo <E>:<kind>-commit2, distinto do primeiro.",
      "basis": "Teto de 2.500 caracteres da instrução do dono (um helper para os dois pontos); rótulo distinto deixa a repetição visível nas transcrições e nos testes.",
      "alternative": "Repetir inline nos dois pontos com o mesmo rótulo <E>:<kind>-commit.",
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
      "what": "O dono confere o relatório docs/reports/2026-11-17-E31-parada-retomada.md (critério 1).",
      "why": "O critério 1 é verify human; o relatório já existe e só o dono o aceita.",
      "blocking": false,
      "workaround": "O executor entrega a correção do critério 2; a conferência fica com o dono."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "checkExit 1 e checkStdout em texto livre (sem JSON) ou JSON sem summary.exitCode.",
      "expected": "checkFailed como hoje: achado crítico da revisão da spec."
    },
    {
      "id": "C2",
      "input": "checkExit 0 e summary.exitCode 1 no stdout do spec-tool.",
      "expected": "Carga falha e nova tentativa; nunca segue com uma spec inválida lida como válida."
    },
    {
      "id": "C3",
      "input": "Os dois agentes de commit (haiku e sonnet) devolvem commit vazio com o arquivo pendente.",
      "expected": "fail('infra') com o pendente na mensagem, sem revisão de spec."
    },
    {
      "id": "C4",
      "input": "Commit do plano vazio com o plano pendente.",
      "expected": "O mesmo da spec: repetição em sonnet com o rótulo <E>:plan-commit2 e, persistindo, fail('infra')."
    }
  ]
}
```
