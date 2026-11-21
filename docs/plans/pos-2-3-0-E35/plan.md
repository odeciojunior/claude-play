# Plano E35 -- Revisor por tarefa opus com modos alinhados

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E35/spec.md`.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (3023 linhas): bloco `// <pure>` define `implModel(task)` (421-424), `implEffort(task)` (425-428) e `reviewModelFor(task)` (429-432); na linha 2644 e 2654 `runDeliverable` passa `reviewModelFor(t)` para `revAgent` e `reviewLoop`.
- `plugins/productivity-tools/lib/routing.mjs` (53 linhas): calcula `{ tier, effort, reviewTier, gate, score }` a partir de `task.score`; não define `reviewModelFor` e alimenta `plan-tool.mjs`, `routing-table.json` e os 4 alvos de `embed.mjs`.
- `plugins/productivity-tools/agents/task-reviewer.md` (54 linhas): seções `## Choosing the mode` (15-23), `## Rules for every mode` (24-33), `## Numbering the findings` (34-37), `## Restricted mode` (38-41), `## Review mode` (42-45), `## Reading the prompt` (46-54).
- `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` (481 linhas): teste `'reviewer model: ...'` (48-67) verifica `P.reviewModelFor(...)`; linhas 459-470 verificam `## Review mode` e `- \`review\`:` de `task-reviewer.md`.
- `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` (770 linhas): linhas 632-641 verificam `reviewModelFor(t)` em `runDeliverable`; linhas 754-770 verificam ausência de modo único no workflow e em `task-reviewer.md`.
- `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` (5250 linhas): asserções `'sonnet'` em `E1:t1:spec1` e `E1:t1:spec2` nas linhas 2175 (`task review model`), 2185 (`re-review after a fix escalated to opus runs at opus`) e 4427 (`AC4: the implementer and the task reviewer get model and effort from route`).
- `tools/measure/run-batch.mjs` (`checkLoopWorkflow`, 896-960): exige os literais `{ tier: implModel(t), reviewModel: reviewModelFor(t), haltOn:` e `TASK_SLICE_LITERALS` na faixa de tarefa de `roadmap-release.js`.
- `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md` (229 linhas) e `docs/reports/2026-11-17-E30-revisor-opus.md` (74 linhas): molde de desenho e números base do braço `opus` (`28/40`: `spec 18/20`, `quality 10/20`, perdidos `12/40`, custo `US$ 0,561`/válida) e empate marginal `1×1` da `R3` (`sonnet 1` em `A-3/QL1`, `opus 1` em `B-5/QL4`, `27 >= 10` oportunidades).

## Tarefas

### Tarefa 1: Promover reviewModelFor para opus por padrão e atualizar testes do workflow

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; testar em `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `prompts.test.mjs`, `review.test.mjs` e `flow.test.mjs`:
   - Em `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` (linhas 48-67): atualizar o teste `'reviewer model: ...'` para afirmar que `P.reviewModelFor(...)` devolve `'opus'` para `r('sonnet', 'medium', 'opus')`, `r('sonnet', 'medium', 'sonnet')`, `r('haiku', 'low', 'sonnet')`, `r('opus', 'medium', 'sonnet')`, `{ ...r('sonnet', 'medium', 'sonnet'), external: true }`, `{ ...r('sonnet', 'medium', 'sonnet'), external: false }`, `{}`, `null` e `{ tier: 'sonnet', reviewTier: 'sonnet' }` (mantendo inalteradas as asserções de `P.implModel` e `P.implEffort`).
   - Em `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` (após linha 641): adicionar `test('E35 AC1: reviewModelFor returns opus by default for every task route', ...)` verificando `P2.reviewModelFor` e `P2.effortFor(P2.reviewModelFor(t)) === 'medium'`.
   - Em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`: atualizar `modelOf(calls, 'E1:t1:spec1').model` para `'opus'` nas linhas 2175 e 4427 (mantendo a asserção de `emit.plan.tasks` na linha 4423) e `modelOf(calls, 'E1:t1:spec2').model` para `'opus'` na linha 2185 (`spec-fix1` segue em `'sonnet'`, `spec-fix2` escala para `'opus'` e `spec3` segue em `'opus'`).
   - Rodar os três arquivos de teste e confirmar que falham antes da edição de `roadmap-release.js`.
2. Em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (linhas 420-432): atualizar o comentário da linha 420 e alterar `reviewModelFor` para:
   ```js
   function reviewModelFor() {
     return 'opus'
   }
   ```
   mantendo `reviewModelFor(t)` intacto nas chamadas das linhas 2644 e 2654 e sem alterar `plugins/productivity-tools/lib/routing.mjs`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` e confirmar saída 0. Commit `E35 T1: promover reviewModelFor para opus por padrao`.

### Tarefa 2: Alinhar modos em agents/task-reviewer.md (S3-24) com testes unitários

Arquivos: modificar `plugins/productivity-tools/agents/task-reviewer.md`; testar em `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`. Depende da Tarefa 1.

Passos:

1. Teste primeiro em `prompts.test.mjs` e `review.test.mjs`:
   - Em `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`: adicionar `test('E35 AC1 (S3-24): task-reviewer restricts verdicts to restricted mode and spec/quality to review mode', ...)` conferindo que `agents/task-reviewer.md` explicita em `## Choosing the mode` que `verdicts` só é devolvido no modo `restricted` e `spec`/`quality` só no modo `review` (omitidos nos modos `spec` e `quality`), além das frases correspondentes em `## Restricted mode` e `## Review mode`.
   - Em `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`: adicionar `test('E35 AC1: task-reviewer.md restricts verdicts to restricted and spec/quality to review (S3-24)', ...)` conferindo as três seções de `agents/task-reviewer.md`.
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e confirmar falha antes da edição de `task-reviewer.md`.
2. Em `plugins/productivity-tools/agents/task-reviewer.md`:
   - Ao final de `## Choosing the mode`: acrescentar `Return \`verdicts\` only in \`restricted\` mode, and \`spec\` and \`quality\` only in \`review\` mode (omit them in \`spec\` and \`quality\` modes).`
   - Em `## Restricted mode`: atualizar `Return \`verdicts\` (only in \`restricted\` mode) with \`{ id, open }\` for every open finding.`
   - Em `## Review mode`: atualizar `and return \`spec\` and \`quality\` (\`pass\` or \`fail\`, only in \`review\` mode).`
   - Preservar literalmente todas as frases verificadas pelos testes existentes (`prompts.test.mjs` e `review.test.mjs`).
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e confirmar saída 0. Commit `E35 T2: alinhar modos verdicts e spec/quality em task-reviewer.md (S3-24)`.

### Tarefa 3: Escrever desenho do lote E35 (regra R3 1x1 e piso 26/40) e validar portões G1 a G5

Arquivos: criar `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md`. Depende das Tarefas 1 e 2.

Passos:

1. Criar `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md` no molde de `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`, fixando antes do lote pago:
   - A regra formal da `R3` para empate marginal `1×1` (`B04` / `DEC-005` / `R3` do spec) e sua aplicação sobre os dados preservados de E30 em `D:/claude-e30-out` (`27 >= 10` oportunidades, `sonnet: 1` em `A-3/QL1`, `opus: 1` em `B-5/QL4` -> **Manter conclusivo**).
   - O piso de confirmação (`R4` do spec, `DEC-004`) para as 10 execuções válidas do braço `opus` em `lentes-semeadas-A/B` (`5 A + 5 B`, 40 oportunidades): `determinadas >= 32/40`, `capturas totais >= 26/40`, `capturas spec >= 16/20`, `capturas quality >= 8/20`, `perdidos <= 14/40`, `sinteticoGerado === 0`, `laco-divergente === 0`, sustentado nas duas recontagens (`semMencao` e `failRiscoAceito`), e teto `US$ 7,00` (com reversão de `S3-24` mantendo `reviewModelFor` como `'opus'` caso o piso não seja atingido).
   - O protocolo da sonda 1, paradas, preparação isolada (`D:/claude-pos23-cfg`, `D:/claude-pos23-mkt` com `superpowers` `7.0.0` em `bb92a77741419a4ab5f06e711a283343f1ada0c3`, `autoUpdate: false`, worktree `D:/claude-pos23-release`) e comando `tools/measure/run-batch.mjs` (`--work D:/claude-e35-work/opus/<A|B>-<k>`, `--out D:/claude-e35-out/opus/<A|B>-<k>`).
2. Rodar `embed.mjs --check` nos 4 alvos e todos os portões canônicos G1 a G5 (`node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`, `claude plugin validate .`, `claude plugin validate plugins/productivity-tools`, `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`, `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`), além de confirmar `checkLoopWorkflow` verde em `tools/measure/review-loop.test.mjs` e `tools/measure/run-batch.test.mjs` sem rodar nenhuma chamada paga.
3. Commit `E35 T3: desenho do lote de confirmacao do revisor opus e regra R3 1x1`.

## Evidência dos critérios

| Critério | Tipo | Comando | Externo |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | false |
| AC2 | human | - | false |

## Decisões do plano

- R1: Alterar `reviewModelFor` apenas em `roadmap-release.js` para devolver `'opus'` por padrão, preservando as chamadas `reviewModelFor(t)` e mantendo `lib/routing.mjs` e seus 4 alvos de embed inalterados.
- R2: Aplicar `S3-24` em `agents/task-reviewer.md` restringindo `verdicts` ao modo `restricted` e `spec`/`quality` ao modo `review`, preservando todas as frases verificadas por testes.
- R3: Formalizar a regra da `R3` no desenho de E35 classificando `1×1` com piso de oportunidades atingido como **Manter (conclusivo)**.
- R4: Fixar o piso de confirmação (`>= 26/40` total, `>= 16/20` spec, `>= 8/20` quality, `<= 14/40` perdidos, `>= 32/40` determinadas, sustentado nas duas recontagens, teto `US$ 7,00`) e a reversão de `S3-24` caso falhe.

```json data
{
  "schema": "plan/1",
  "id": "E35",
  "title": "Revisor por tarefa opus com modos alinhados",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-pos-2-3-0/ em nenhuma tarefa do plano.",
    "Não editar plugins/productivity-tools/lib/routing.mjs nem plugins/productivity-tools/scripts/fixtures/plan-tool/routing-table.json.",
    "Preservar as chamadas reviewModelFor(t) nas linhas 2644 e 2654 de roadmap-release.js exigidas por checkLoopWorkflow em tools/measure/run-batch.mjs.",
    "Preservar todas as frases de agents/task-reviewer.md verificadas por workflow/prompts.test.mjs e workflow/review.test.mjs, inclusive o modo review usado pelo plan-coordinator.",
    "Não executar chamadas pagas (tools/measure/run-batch.mjs com claude -p) nas Tarefas 1 a 3; parar após T3 antes do lote pago de AC2."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Promover reviewModelFor para opus por padrão e atualizar testes do workflow",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "function reviewModelFor() devolve 'opus' em roadmap-release.js"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C1",
        "C2",
        "C3",
        "C4"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com reviewModelFor devolvendo 'opus' por padrão"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Alinhar modos em agents/task-reviewer.md (S3-24) com testes unitários",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/task-reviewer.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "agents/task-reviewer.md restringe verdicts a restricted e spec/quality a review (S3-24)"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "function reviewModelFor() devolve 'opus' em roadmap-release.js"
        }
      ],
      "covers": [
        "AC1"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "expect": "exit 0 (AC1)"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Escrever desenho do lote E35 (regra R3 1x1 e piso 26/40) e validar portões G1 a G5",
      "deps": [
        1,
        2
      ],
      "files": {
        "create": [
          "docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md"
        ],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 1
      },
      "produces": [
        "docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md com regra R3 1x1 e piso 26/40"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "function reviewModelFor() devolve 'opus' em roadmap-release.js"
        },
        {
          "task": 2,
          "sig": "agents/task-reviewer.md restringe verdicts a restricted e spec/quality a review (S3-24)"
        }
      ],
      "covers": [
        "AC2",
        "C4"
      ],
      "testFirst": {
        "exempt": "documento de desenho e execução dos portões canônicos G1 a G5 já cobertos pelas Tarefas 1 e 2"
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 (G1)"
        },
        {
          "cmd": "claude plugin validate .",
          "expect": "exit 0 (G2)"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0 (G3)"
        },
        {
          "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid",
          "expect": "exit 0 (G4)"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0 (G5)"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "human",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": null
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
  ]
}
```
