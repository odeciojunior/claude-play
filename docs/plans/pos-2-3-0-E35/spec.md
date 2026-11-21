# Spec E35 -- Revisor por tarefa opus com modos alinhados

## Intenção

O lote pago de E30 no roadmap anterior (`docs/reports/2026-11-17-E30-revisor-opus.md`) comprovou que o revisor por tarefa em `opus` captura `28/40` sementes contra `20/40` do `sonnet` (custo `1,56x`), levando à aprovação de `DEC-001` e `DEC-004` para promover o padrão do revisor por tarefa para `opus` na `productivity-tools 2.4.0`. Em cumprimento a `REQ-002`, `REQ-009`, `DEC-031` do roadmap pós-2.2.0 e `DEC-004`/`DEC-005` do pós-2.3.0, E35: (1) altera `reviewModelFor` em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` para devolver `'opus'` por padrão; (2) aplica a nota `S3-24` em `plugins/productivity-tools/agents/task-reviewer.md` restringindo `verdicts` ao modo `restricted` e os campos `spec`/`quality` ao modo `review`; (3) formaliza a regra da `R3` para o empate marginal `1×1` (`B04`) e fixa o piso de não-regressão (`>= 26/40`, `spec >= 16/20`, `quality >= 8/20`, `perdidos <= 14/40`, `determinadas >= 32/40`, sustentado nas duas recontagens canônicas e teto `US$ 7,00`) no desenho `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md` antes do lote pago de confirmação de 10 execuções do braço `opus` em `lentes-semeadas-A/B`.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: alterar `reviewModelFor` para devolver `'opus'` por padrão (preservando os pontos de chamada `reviewModelFor(t)` exigidos pelo arnês `tools/measure/run-batch.mjs` e mantendo `plugins/productivity-tools/lib/routing.mjs` inalterado).
- `plugins/productivity-tools/agents/task-reviewer.md`: aplicar `S3-24`, explicitando que `verdicts` só deve ser devolvido no modo `restricted` e `spec`/`quality` só no modo `review` (omitidos nos modos `spec` e `quality`), preservando todas as frases exigidas pelos testes existentes.
- `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`, `review.test.mjs` e `flow.test.mjs`: atualizar asserções do modelo padrão antigo `'sonnet'` para `'opus'` e adicionar testes cobrindo `reviewModelFor` e `S3-24`.
- `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md`: formalizar a regra da `R3` para `1×1` (`B04`), aplicá-la aos dados preservados de E30 (`Manter conclusivo`), fixar o piso de confirmação e o protocolo do lote pago de 10 execuções (`<= US$ 7,00`), a ser executado após o login da config descartável (`D:/claude-pos23-cfg`).

Fora:

- Alterar `plugins/productivity-tools/lib/routing.mjs`, `plugins/productivity-tools/scripts/fixtures/plan-tool/routing-table.json` ou qualquer um dos 4 alvos de embed (`routing.mjs` calcula `route.reviewTier` do `plan/1`, não `reviewModelFor`, assim como o `plan-coordinator` já força `opus` na `DEC-206`).
- Executar o lote pago (`tools/measure/run-batch.mjs`) durante as Tarefas 1 a 3 locais e gratuitas (a execução do lote pago depende do login na config descartável pelo dono / conclusão opcional de E38).
- Alterar o laço `quality` ou rodar um segundo lote dedicado à `R3` (`DEC-005`).

O que não fazer:

- Não remover as chamadas `reviewModelFor(t)` nas linhas 2644 e 2654 de `roadmap-release.js`, pois `checkLoopWorkflow` em `tools/measure/run-batch.mjs` exige o literal `{ tier: implModel(t), reviewModel: reviewModelFor(t), haltOn:`.
- Não remover ou quebrar o modo `review` de `agents/task-reviewer.md` usado pelo `plan-coordinator`.
- Não disparar chamadas pagas (`claude -p` / `run-batch.mjs`) antes do login na config descartável e da autorização do lote.

## Desenho

**Promoção de `reviewModelFor` para `'opus'` (critério 1, R1).** Em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (bloco `// <pure>`), `reviewModelFor()` passa a devolver `'opus'` para qualquer tarefa, mantendo `implModel` e `implEffort` dirigidos por `task.route`. O bloco `lib/routing.mjs` não muda: o campo `reviewTier` da rota continua refletindo o cálculo da tabela canônica de `routing.mjs` (verificada contra `routing-table.json` e pela sentinela `P8.mjs`), espelhando o padrão já adotado no `plan-coordinator` (`DEC-206` em `lib/progress-state.mjs`). Os testes em `prompts.test.mjs`, `review.test.mjs` e `flow.test.mjs` passam a verificar `'opus'` como modelo padrão do revisor por tarefa, mantendo o teste da escalação do corretor (`spec-fix1` em `sonnet`, `spec-fix2` em `opus`).

**Alinhamento de modos `S3-24` em `agents/task-reviewer.md` (critério 1, R2).** Em `plugins/productivity-tools/agents/task-reviewer.md`: em `## Choosing the mode`, acrescenta-se a instrução explícita `Return \`verdicts\` only in \`restricted\` mode, and \`spec\` and \`quality\` only in \`review\` mode (omit them in \`spec\` and \`quality\` modes).`; em `## Restricted mode`, explicita-se `(only in \`restricted\` mode)` ao instruir o retorno de `verdicts`; e em `## Review mode`, explicita-se `only in \`review\` mode` ao instruir o retorno de `spec` e `quality`. Todas as frases verificadas por `prompts.test.mjs` e `review.test.mjs` permanecem intactas.

**Regra formal da `R3` para `1×1` e piso de confirmação no desenho do lote (critério 2, R3, R4).** Em `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md`: (a) formaliza-se que, atingido o piso de oportunidades (`>= 10` sementes de `quality` que chegam ao laço `quality` sem captura no laço `spec`), `0×0` significa **Retirar**, enquanto `>= 2` capturas marginais no braço escolhido pela `R2` **ou** `>= 1` captura marginal em cada braço (`1×1`, somando `>= 2` capturas marginais independentes com evidência positiva no braço escolhido) significa **Manter (conclusivo)** — fechando os dados preservados de E30 (`27 >= 10` oportunidades, `sonnet: 1` em `A-3/QL1`, `opus: 1` em `B-5/QL4`) como **Manter (conclusivo)**; (b) fixa-se o piso de não-regressão do lote pago de 10 execuções válidas do braço `opus` em `lentes-semeadas-A/B` (`5 A + 5 B`, teto `US$ 7,00`): `determinadas >= 32/40`, `capturas totais >= 26/40`, `capturas spec >= 16/20`, `capturas quality >= 8/20`, `perdidos <= 14/40`, `sinteticoGerado === 0`, `laco-divergente === 0`, sustentado nas duas recontagens (`semMencao` e `failRiscoAceito`); abaixo do piso após 10 válidas, reverte-se `S3-24` e mantém-se `reviewModelFor` em `'opus'`.

## Deixado para o plano

- Tarefa 1: atualizar `prompts.test.mjs`, `review.test.mjs`, `flow.test.mjs` e `roadmap-release.js` para `reviewModelFor() -> 'opus'`.
- Tarefa 2: adicionar testes de `S3-24` e atualizar `agents/task-reviewer.md`.
- Tarefa 3: criar `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md` e executar os portões G1 a G5 na branch `release/pos-2.3.0`, parando antes do lote pago (`AC2`) para login na config descartável / E38.

```json data
{
  "schema": "spec/1",
  "id": "E35",
  "title": "Revisor por tarefa opus com modos alinhados",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o workflow e o agente task-reviewer atualizados, quando os testes de revisão e prompts rodam, então reviewModelFor devolve opus por padrão e task-reviewer.md restringe verdicts ao modo restricted e os campos spec/quality ao modo review. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado o desenho com a regra da R3 para 1x1 e o piso fixados antes do lote, quando as 10 execuções pagas do braço opus em lentes-semeadas-A/B terminam, então as capturas cumprem o piso, o gasto respeita o teto de US$ 7 e o resultado está registrado em measurements.md e em relatório em docs/reports. {verify: human; evidence: o dono confere a linha do lote de confirmação em measurements.md e o relatório de E35 em docs/reports}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "reviewModelFor deve passar a devolver 'opus' apenas em roadmap-release.js ou também alterar lib/routing.mjs?",
      "decision": "Alterar reviewModelFor em plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js para devolver 'opus' por padrão para toda tarefa, preservando os pontos de chamada reviewModelFor(t) exigidos pelo arnês tools/measure/run-batch.mjs e mantendo lib/routing.mjs e seus 4 alvos de embed inalterados.",
      "basis": "lib/routing.mjs não define reviewModelFor e seu campo reviewTier compõe o contrato canônico de plan/1, a tabela congelada routing-table.json e a sentinela P8.mjs; o plan-coordinator já segue o mesmo padrão (DEC-206 em progress-state.mjs).",
      "alternative": "Alterar lib/routing.mjs para emitir reviewTier: 'opus' em todas as linhas da tabela de roteamento.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Qual texto exato aplicar em plugins/productivity-tools/agents/task-reviewer.md para cumprir S3-24 sem quebrar contratos existentes?",
      "decision": "Acrescentar em '## Choosing the mode' a frase \"Return `verdicts` only in `restricted` mode, and `spec` and `quality` only in `review` mode (omit them in `spec` and `quality` modes).\" e qualificar '(only in `restricted` mode)' em '## Restricted mode' e 'only in `review` mode' em '## Review mode', preservando intactas todas as frases verificadas por prompts.test.mjs e review.test.mjs.",
      "basis": "Fecha o ponto 2 do relatório comportamental de E21 (S3-24) conforme DEC-031 do pós-2.2.0 sem interferir com o modo review usado pelo plan-coordinator.",
      "alternative": "Remover completamente a menção a verdicts/spec/quality do corpo do agente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como formalizar a regra da R3 para o empate marginal 1×1 (B04 / DEC-005)?",
      "decision": "No desenho de E35, com o piso de oportunidades (>= 10 sementes de quality chegando ao laço quality sem captura prévia em spec) atingido: 'Retirar' exige 0 capturas marginais nos dois braços (0×0); 'Manter (conclusivo)' vale para >= 2 capturas marginais no braço escolhido pela R2 OU >= 1 captura marginal em cada braço (caso 1×1, somando >= 2 capturas marginais independentes com evidência positiva no braço escolhido); os demais casos ficam em 'Inconclusivo, mantém'. Aplicada aos dados preservados de E30 (27 oportunidades, sonnet 1 em A-3/QL1, opus 1 em B-5/QL4), a R3 fecha como Manter (conclusivo).",
      "basis": "A R3 de E30 avaliava a soma dos dois braços para retirar (0×0), mas exigia >= 2 num único braço para manter, criando vácuo no empate 1×1; DEC-005 determina formalizar essa regra no desenho de E35 sem lote pago dedicado.",
      "alternative": "Classificar 1×1 perpetuamente como inconclusivo mantendo o laço por omissão.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Qual piso de confirmação fixar antes do lote pago de 10 execuções do braço opus com S3-24 (DEC-004)?",
      "decision": "Fixar para as 10 execuções válidas em lentes-semeadas-A/B (5 A + 5 B, 40 oportunidades, teto US$ 7,00): determinadas >= 32/40, capturas totais >= 26/40, capturas spec >= 16/20, capturas quality >= 8/20, perdidos <= 14/40, sinteticoGerado === 0, laco-divergente === 0, sustentado nas duas recontagens (semMencao e failRiscoAceito). Se as 10 válidas ficarem abaixo do piso de capturas, reverter S3-24 em agents/task-reviewer.md e manter reviewModelFor em 'opus'.",
      "basis": "Em E30 o opus atingiu 28/40 (spec 18/20, quality 10/20, perdidos 12/40) contra 20/40 do sonnet (limiar R2 de entrada 24/40); tolerância de -2 espelha a margem canônica da R2 e exige preservação do ganho em quality.",
      "alternative": "Fixar piso apenas no total >= 24/40 sem piso mínimo por lente nem verificação das recontagens.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "Logar a config descartável fornecida pela variável de ambiente CLAUDE_CONFIG_DIR (D:/claude-pos23-cfg) e autorizar o disparo do lote pago de 10 execuções (teto US$ 7,00).",
      "why": "O critério AC2 exige o lote pago de confirmação em config descartável isolada, com login realizado pelo dono (pendência registrada em state.md).",
      "blocking": false,
      "workaround": "O executor entrega as Tarefas 1 a 3 (código, S3-24, testes unitários, desenho formal do lote e portões G1 a G5 verdes) na branch release/pos-2.3.0 e para antes do lote pago."
    },
    {
      "id": "H2",
      "kind": "acceptance",
      "what": "O dono confere a linha do lote de confirmação em measurements.md e o relatório de E35 em docs/reports após a execução do lote pago.",
      "why": "AC2 é verify human e só fecha após a execução das 10 rodadas pagas do braço opus e conferência pelo dono.",
      "blocking": false,
      "workaround": "O executor entrega as Tarefas 1 a 3 e prepara o desenho do lote; a conferência final ocorre após o lote pago."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Tarefa com route.tier = 'haiku' ou 'sonnet', route.reviewTier = 'sonnet' e external = false.",
      "expected": "reviewModelFor(task) devolve 'opus' e effortFor(reviewModelFor(task)) devolve 'medium'."
    },
    {
      "id": "C2",
      "input": "Tarefa sem route ou valor null passado a reviewModelFor.",
      "expected": "reviewModelFor(task) devolve 'opus' sem lançar erro."
    },
    {
      "id": "C3",
      "input": "Laço de revisão por tarefa com achado repetido em spec1 e spec2 escalando o corretor de sonnet para opus.",
      "expected": "spec1, spec2 e spec3 rodam em 'opus' (reviewModelFor(t) / maxModel('opus', tier)), enquanto spec-fix1 roda em 'sonnet' e spec-fix2 escala para 'opus'."
    },
    {
      "id": "C4",
      "input": "Verificação estática de compatibilidade do arnês checkLoopWorkflow sobre o roadmap-release.js atualizado para stage task-review, rounds loop, arm atual.",
      "expected": "checkLoopWorkflow aceita o workflow sem erros porque reviewModelFor(t), TASK_SLICE_LITERALS e TASK_RESTRICTED_LITERAL permanecem intactos."
    }
  ]
}
```
