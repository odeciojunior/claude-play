# Spec E42 -- Medida de base válida e com motivo por portão

Entregável E42 do roadmap `docs/plans/roadmap-pos-2-6-0` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, seção E42), sem dependências, no caminho crítico. Cobre REQ-001, REQ-002 e REQ-025. Detalhe técnico: tarefa A1 de `docs/plans/2026-11-25-correcoes-issues-plan.md` (issues #2 e #6). Branch de trabalho: `release/pos-2.6.0`, no worktree `D:/projects/claude-play-wt/pos-2-6-0`.

## Intenção

Hoje a instrução de medida diz aos agentes que, nos portões `kind: exit`, "only name, ran and exit matter". O agente então omite a linha de captura, o `gateFromCapture` devolve `null`, o portão some da medida e o preflight para com `preflight:baseline-invalid` dizendo só "gate X missing from the measure". É a primeira causa do baseline-invalid (A1 do SRC-02). O E42 faz três coisas: (1) a instrução passa a exigir a captura também nos portões `exit` e passa `--brief` ao `capture.mjs`; (2) a mensagem de baseline-invalid traz, por portão, o motivo da rejeição da captura, com o valor esperado e o recebido; (3) a trava de tamanho do `roadmap-release.js` sobe de 266.673 para 284.500 caracteres LF (DEC-007), para que essa mudança e as seguintes caibam.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `measureTxt` (linha 1959-1960), `capturedMeasure` (204-207), `measureProblems` (664-676) e a cópia embutida de `checkCapture` (1537-1550).
- `plugins/productivity-tools/lib/plan-digest.mjs`: `checkCapture` (251-264), mudança aditiva, regenerada nos 4 alvos do embed.
- Testes: `workflow/gates.test.mjs`, `workflow/merge.test.mjs`, `workflow/flow.test.mjs`, `workflow/prompts.test.mjs` (só se algum caso quebrar), `workflow/discovery-slices.test.mjs:119-123` e `scripts/capture.test.mjs`.

Fora:

- A releitura da linha de captura copiada errada (E43, REQ-003) e a leitura da linha por arquivo (A5): o E42 só reduz a taxa de erro de cópia e torna o erro legível; não zera o baseline-invalid sozinho (comentário do dono na #2).
- O extrator do vitest e de ANSI (E44).
- O caminho agy: `workflow/roadmap-release-agy.py` não é tocado (resposta Q4 do dono, DEC-008).
- O prompt do agente `gates-fix`: não ganha linha CAPTURE (resposta Q2 do dono).
- A mensagem de medida nula do pós-merge (`gates()`, linha 2036) e o acúmulo de motivo entre as duas tentativas de `measuredGroup` (ver R4).
- Versão dos plugins (DEC-042).

O que não fazer:

- Não mudar o valor de retorno de `gateFromCapture` nem os testes negativos que esperam `null` (`gates.test.mjs:234-252`); tirar ou afrouxar teste negativo volta ao dono via subagente opus (DEC-004, DEC-021).
- Não alterar a fixture `scripts/fixtures/plan-tool/workflow-copy.js` à mão: ela muda só pela regeneração do `embed.mjs`.
- Não pôr `--brief` depois de `--bash`: o `CAP_LINE` de `flow.test.mjs:184` deixaria de casar.
- Não passar do teto de 3.000 caracteres LF da tarefa em `roadmap-release.js` (DEC-007). Acima de 3.600 (20%), parar e voltar ao dono via subagente opus (DEC-007, DEC-021).

## Linha de base medida (G1)

Medida pelo Git Bash no worktree novo, conforme a resposta Q3 do dono, em `release/pos-2.6.0` no commit `e9e75e0136a48f02ce9496979d4fbfe09cb7a3ba` (o mesmo antes e depois da execução), com Node 26.13.1 e o comando `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`:

- exit 0; tests 2616; pass 2614; fail 0; skipped 2; cancelled 0; todo 0.

Uma primeira execução, iniciada no `1ee2fa7`, saiu com exit 1 (pass 2612, fail 2). As duas falhas foram em `tools/measure/run-batch.test.mjs`: "harness aggregate records the arm source and workflow commit" e "aggregate.harness records harnessCommit and a different plugin commit prints a warning". Elas vieram de um commit de outra sessão (`e9e75e0`, estratégia v1.1) que entrou no branch durante a execução: o teste lê o HEAD ao carregar (`run-batch.test.mjs:37`) e o compara com o HEAD lido depois. Com o HEAD estável, a segunda execução saiu com exit 0, e ela é a linha de base. Isso não é um defeito do E42, mas mostra que o G1 é sensível a commits no meio da execução: meça com o worktree parado.

O pwsh puro falha até o E50 e não serve de base (resposta Q3).

## Design

**Critério 1 (portão exit com captura literal entra na medida).** Em `measureTxt` (`roadmap-release.js:1960`), o sufixo `' (only name, ran and exit matter)'` dos portões que não são `tests` passa a ser o literal testado pelo dono na #2: `' (no test counts; the capture line is still required, copied literally)'` (resposta Q1). Na mesma linha, a linha de comando de cada portão ganha ` --brief` entre `--cwd ${dir}` e `--bash`, como o prompt de tarefa já faz (`:623`); o `CAP_LINE` de `flow.test.mjs:184` (`--cwd .* --bash`) continua casando. Como `measureTxt` serve tanto o preflight (`:1972`) quanto o `gateOnce` (`:2021`), o `--brief` vale para toda medida, inclusive a pós `gates-fix`, num ponto único (resposta Q2). O `--brief` omite `tail` e `tailCut` e o digest assina o objeto impresso (`scripts/capture.mjs:5`), então `checkCapture` e `gateFromCapture` aceitam a linha sem mudança. Testes: em `gates.test.mjs`, um portão `exit` com captura real (`realCapture` com `--brief`) passa por `capturedMeasure`, entra em `gates`, `validMeasure` é verdadeiro e `measureProblems` volta vazio; em `flow.test.mjs`, o teste "E41 B2 T2" (312-331) passa a conferir que cada linha de captura traz `--brief` entre `--cwd` e `--bash`, que a frase nova aparece na linha do portão `exit` e que a antiga não aparece. `prompts.test.mjs:503` cobre o prompt de tarefa, que não muda; ajustar só se quebrar.

**Critério 2 (motivo específico por portão no baseline-invalid).** Três peças:

- `checkCapture` em `plugins/productivity-tools/lib/plan-digest.mjs:251` ganha, de forma aditiva, `expected` e `got` nos dois retornos que comparam valores: nonce (`expected: nonce, got: o.nonce`) e cmdDigest (`expected: cmdDigest, got: o.cmdDigest`). Os demais retornos ficam iguais. Os chamadores atuais (`roadmap-release.js:193`, `:844`, `:2499`, `:2941` e o `coordinator.js`) só leem `ok`, `why` e `data`, então nada muda neles. Depois, `node plugins/productivity-tools/scripts/embed.mjs` regenera os três alvos que embutem `plan-digest.mjs` (`roadmap-release.js`, `skills/plan-coordinator/workflow/coordinator.js`, `scripts/fixtures/plan-tool/workflow-copy.js`; o `check-roadmap.mjs` não o embute e não muda) e `embed.mjs --check` com os 4 alvos de `.claude/rules/workflows-and-lib.md` fecha o G5. O `coordinator.js` tem 88.499 caracteres LF contra a trava de 90.000 de `skills/plan-coordinator/workflow/flow.test.mjs:837`; a mudança aditiva, de menos de 100 caracteres, cabe. Teste em `scripts/capture.test.mjs`: nonce e cmdDigest errados devolvem `expected` e `got` corretos.
- `capturedMeasure` (`roadmap-release.js:204`) passa a montar `gateWhy`, um objeto nome do portão -> motivo, fora de `gates` (R2), para cada portão cujo `gateFromCapture` devolveu `null`. O motivo vem de uma função pura nova, de nível superior para o `loadPure` exportar, que repete a checagem sobre o mesmo dado: sem captura -> `no capture line`; `checkCapture` falhou -> o `why`, mais `expected <e>, got <g>` quando houver, mais `path <p>` quando a linha for JSON com `path`; `exit` não inteiro -> `the capture exit is not an integer`. `gateFromCapture` continua devolvendo `null` (R1). O `gateWhy` é posto pelo script depois da resposta do agente, então o schema `S_MEASURE` (`:1698`) não o remove, e `validMeasure` não o lê.
- `measureProblems` (`:664`) anexa `m.gateWhy[def.name]`, quando houver, à frase `gate X missing from the measure`, no formato `gate X missing from the measure: <motivo>`. O consumo continua em `:1997` (`preflight:baseline-invalid`), sem mudança de código ali.

Testes em `merge.test.mjs` (ao lado de `:28`): `measureProblems` com `gateWhy` traz o motivo de cada portão, e sem `gateWhy` a frase antiga continua igual. Em `gates.test.mjs` (ao lado de `:234`): capturas com nonce errado, cmdDigest errado e digest adulterado dão, via `capturedMeasure` e `measureProblems`, o motivo específico de cada uma, com o cmdDigest esperado contra o recebido no caso do comando trocado.

**Critério 3 (trava de 284.500 caracteres LF).** Em `discovery-slices.test.mjs:119-123`, o limite passa de 266673 para 284500 e o nome e a mensagem do teste citam DEC-007 do roadmap pós-2.6.0 (sucede a DEC-057 do pós-2.3.0). `size.test.mjs` não muda: o teto de 300.000 e a folga acima de 10.000 continuam valendo. O arquivo tem hoje 266.001 caracteres LF; o crescimento previsto do E42 fica na casa de 1.000 caracteres, abaixo do teto de 3.000 da tarefa. O plano mede o tamanho antes e depois de cada tarefa que toca o arquivo.

**Checklist paridade agy (DEC-008).** Item: "paridade agy: pendente #13". O `.py` não é tocado (resposta Q4).

**Pronto.** Critérios verdes em `release/pos-2.6.0`, G1 verde com contagem igual ou maior que a da linha de base acima, G5 verde com os 4 alvos e o item de paridade agy registrado.

## Deixado para o plano

- A divisão em tarefas e a ordem, com a medida de tamanho em cada tarefa. A trava de 284.500 tem de entrar antes ou junto da primeira tarefa que faça o `roadmap-release.js` passar de 266.673 (hoje 266.001, folga de 672), senão o teste atual falha no meio.
- O nome da função pura nova do motivo e o texto exato do motivo "sem captura".
- Os nomes dos testes novos.

```json data
{
  "schema": "spec/1",
  "id": "E42",
  "title": "Medida de base válida e com motivo por portão",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um portão kind exit com captura literal, quando o preflight mede a base, então o portão entra na medida e não aparece como missing. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma captura com nonce, cmdDigest ou digest errados, quando a base é inválida, então a mensagem de baseline-invalid traz o motivo específico de cada portão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado o workflow alterado, quando a trava de tamanho roda, então o arquivo cabe em 284.500 caracteres LF. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como levar o motivo da rejeição da captura até measureProblems: mudar o retorno de gateFromCapture ou calcular o motivo à parte?",
      "decision": "gateFromCapture continua devolvendo null; uma função pura nova de nível superior calcula o motivo do mesmo dado, e capturedMeasure o grava em gateWhy.",
      "basis": "Os testes negativos de gates.test.mjs:234-252 esperam null; mudar o retorno obrigaria a reescrevê-los, e afrouxar teste negativo volta ao dono (DEC-004). Os outros usos de gateFromCapture também tratam null como rejeição.",
      "alternative": "Fazer gateFromCapture devolver { why, expected, got } em vez de null, como sugere a tarefa A1 do plano de correções.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Onde guardar o motivo por portão na medida?",
      "decision": "Em m.gateWhy, um objeto nome do portão para motivo, fora de gates, posto pelo script depois da resposta do agente.",
      "basis": "Um item em gates faria o portão rejeitado contar como presente em gateResult e validMeasure; fora de gates, a validação não muda e o schema S_MEASURE não remove o campo, que só existe depois do agente.",
      "alternative": "Um campo why em cada item de gates para o portão rejeitado.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Onde produzir expected e got do nonce e do cmdDigest?",
      "decision": "Em checkCapture de lib/plan-digest.mjs, de forma aditiva, com regeneração pelo embed.mjs e G5 verde.",
      "basis": "O card pede expected e got de checkCapture; os chamadores atuais só leem ok, why e data, então os campos novos não mudam o comportamento deles.",
      "alternative": "Reler o JSON da captura no workflow e comparar ali, sem tocar a lib.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "O motivo também aparece na medida nula do pós-merge, com o acúmulo das duas tentativas de measuredGroup?",
      "decision": "Não neste entregável: só a mensagem de preflight:baseline-invalid mostra o motivo. capturedMeasure grava gateWhy em toda medida, mas measuredGroup e gates() ficam como estão.",
      "basis": "REQ-002 e os critérios do card tratam só do baseline-invalid; measuredGroup devolve null na falha e a mensagem de gates() não lê a medida, então mostrar o motivo ali pede mais código, contra o teto de 3.000 caracteres da DEC-007.",
      "alternative": "Acumular retry: <motivo> em measuredGroup e mostrá-lo no summary de gates().",
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
      "input": "O agente devolve o portão sem o campo capture.",
      "expected": "O portão continua fora da medida e measureProblems diz gate X missing from the measure com o motivo de captura ausente."
    },
    {
      "id": "C2",
      "input": "A captura não é JSON ou não vem do capture.",
      "expected": "O motivo é o why de checkCapture, sem expected, got nem path."
    },
    {
      "id": "C3",
      "input": "A captura confere, mas o exit dela não é inteiro.",
      "expected": "O portão fica fora da medida com o motivo de exit não inteiro."
    },
    {
      "id": "C4",
      "input": "O portão vem com ran false.",
      "expected": "O portão entra como hoje, com exit -1 quando faltar, e não ganha motivo."
    },
    {
      "id": "C5",
      "input": "A base vem gravada pelo run-record (pre.recorded), sem gateWhy.",
      "expected": "measureProblems dá a mesma frase de hoje, sem motivo anexado."
    }
  ]
}
```
