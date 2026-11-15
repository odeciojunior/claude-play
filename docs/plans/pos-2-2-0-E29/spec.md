# Spec E29 -- Remover o modo de revisão única

## Intenção

A revisão única por tarefa (`taskReview.single`, entregue desligada por E28 do roadmap anterior) perdeu na passada C (decisão 773 do roadmap anterior), ficou desligada na 2.1.0 e na 2.2.0 com remoção prevista (decisões 776 e 777 do roadmap anterior) e REQ-001 manda tirá-la do produto. E29 remove a chave e o caminho `review` do release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`), do preflight (`skills/roadmap-release/scripts/preflight.mjs`) e do texto que a liga ao release em `agents/task-reviewer.md`, deixando os dois laços por tarefa, `spec` e `quality`, como único caminho; ajusta os testes, a doc de configuração e o arnês de medição (`tools/measure/run-batch.mjs`) ao caminho único. Um `release.config.json` que ainda traga `taskReview.single` é recusado pelo preflight com mensagem que diz o que fazer (questão em aberto da estratégia, decidida aqui em R2).

## Escopo

Dentro:

- `roadmap-release.js`: normalização `TR = { restricted: tr.restricted === true }` sem `single`; laço por tarefa fixo em `['spec', 'quality']`; `taskIssues` sem a regra do achado sintético de veredicto e com o comentário ajustado (peça 1).
- `skills/roadmap-release/scripts/preflight.mjs`: `validateReleaseConfig` aceita em `taskReview` só `restricted` e recusa `single` com mensagem de remoção (peça 1).
- `agents/task-reviewer.md`: sai a ligação do modo `review` ao release ("the workflow's single review"), a frase do achado feito pelo script e a combinação `restricted, review`; o modo `review` continua, porque o plan-coordinator o usa (R3) (peça 1).
- Testes do release: `workflow/review.test.mjs`, `workflow/flow.test.mjs`, `workflow/prompts.test.mjs`, `scripts/preflight.test.mjs` (remoção dos testes de E28 sobre `single`, novo teste de ausência e teste da recusa) (peça 1).
- `skills/roadmap-release/references/config.md`: linha `taskReview` só com `restricted` e nota da remoção (peça 2).
- Arnês: `tools/measure/run-batch.mjs` exige os literais do modo único só no braço `unica`; os testes do arnês que rodam o braço `unica` leem uma cópia congelada do workflow anterior à remoção (R4) (peça 2).

Fora:

- Nota de atualização, bump de versão e README: são de E33 (DEC-005; risco de E33 sobre quem usa a chave).
- Medir revisor sonnet contra opus ou decidir o laço quality: E30.
- O workflow do plan-coordinator (`skills/plan-coordinator/workflow/coordinator.js`) e o modo `review` que ele despacha ao `task-reviewer`: não mudam.
- `finalReview.singleWave` e `finalReview.adversarial`: outro recurso, não muda.
- As notas de atualização já publicadas (`docs/releases/2026-11-15-productivity-tools-2.1.0.md` e `-2.2.0.md`), os relatórios em `docs/reports/` e os planos antigos: notas históricas, não mudam.
- As funções de leitura e de decisão da passada C no arnês (`ruleSideC`, `armTotals`, `replayLenses`, `syntheticOf`): não mudam.

O que não fazer:

- Não editar a pasta do roadmap `docs/plans/roadmap-pos-2-2-0/`, `size.test.mjs` nem o teto `MAX_WORKFLOW_CHARS` (decisão 647 do roadmap anterior).
- Não remover o modo `review` do `task-reviewer` nem mudar o plan-coordinator.
- Não aceitar `taskReview.single` em silêncio nem tratá-lo como chave desconhecida genérica.
- Não fazer push, não tocar em `main` nem na branch de release.

## Desenho

**Caminho único no workflow (critério 1, R1).** Em `runDeliverable` de `roadmap-release.js` a normalização passa a `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true }` e o laço por tarefa a `for (const kind of ['spec', 'quality'])`; `CFG.taskReview` continua lido uma vez e o literal `tr.restricted === true` fica (o arnês o procura). Em `taskIssues` (bloco `// <pure>`) sai a linha que acrescenta o achado `single review: spec or quality verdict missing or fail, no blocking finding`; a função devolve a junção do modo restrito ou `r.issues`, como antes de E28, e o comentário acima dela perde a frase "Single: ...". `S_TASKREVIEW` mantém `spec` e `quality` opcionais (o schema é compartilhado e não exige os campos). Em `review.test.mjs` saem os testes `E28 AC1` de `taskIssues` com single e as linhas de `single` nos testes de normalização (`AC2: taskReview is normalized once ...`: a contagem de `single === true` passa a zero e os `deepEqual` passam a `{ restricted: ... }`), e o teste do laço confere `for (const kind of ['spec', 'quality'])`. Em `flow.test.mjs` sai o bloco `E28 T2: taskReview.single on the task-reviewer agent`; em `prompts.test.mjs` sai `E28 AC2: single review prompts ...`. Um teste novo em `review.test.mjs` lê `roadmap-release.js`, `preflight.mjs` e `agents/task-reviewer.md` e confere: o workflow não contém `taskReview.single`, `TR.single`, `.single ===` sobre `taskReview`, nem `['review']`, nem o texto `single review`; o preflight contém `taskReview.single` só na mensagem de remoção (R2); o agente não contém `single review` nem `the workflow's single review`; e o laço por tarefa do workflow é `['spec', 'quality']`. A evidência do critério é G1 inteiro.

**Recusa no preflight (critério 2, R2).** `validateReleaseConfig` passa a aceitar em `taskReview` só `restricted` (booleano quando presente). A chave `single`, com qualquer valor (`true`, `false`, texto), dá o erro `taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json`; outra chave dá `taskReview.<chave> is not a supported key (only taskReview.restricted)`; `taskReview` que não é objeto e `restricted` não booleano mantêm as mensagens de hoje. Como erro de validação, o preflight sai com falha e o release não começa, o mesmo canal de qualquer chave inválida. Em `preflight.test.mjs` o teste `E28: validateReleaseConfig accepts taskReview.restricted and taskReview.single ...` vira um teste de E29 que confere: `{}`, `{ restricted: true }` e `{ restricted: false }` passam; `{ single: true }`, `{ single: false }`, `{ single: 'true' }` e `{ restricted: true, single: true }` dão exatamente a mensagem de remoção; outra chave cita `only taskReview.restricted`. O teste `E21: the review-package.mjs rule is required only with taskReview.restricted === true` perde o caso `single` (a regra continua só com `restricted === true`). A evidência é `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

**`task-reviewer` sem a revisão única do release (critério 1, R3).** O plan-coordinator despacha `productivity-tools:task-reviewer` com `Mode: review` (`coordinator.js`, `reviewPrompt` e `preLaunchPrompt`) e trata os veredictos por conta própria (`spec`/`quality` igual a `fail` reprova). Por isso o modo fica no agente, sem a ligação ao release: a linha da lista vira "`review`: judge both in one call (used by the plan-coordinator workflow)."; a seção `## Review mode` fica "Judge compliance and quality in one call, applying both the `spec` and the `quality` block lists, and return `spec` and `quality` (`pass` or `fail`). Every `fail` comes with a blocking finding in `issues`.", sem a frase do achado crítico feito pelo script e sem o parágrafo `restricted, review`. A descrição do frontmatter ("spec compliance, code quality, or both") não muda. Assim, no release a revisão por tarefa roda só `spec` e `quality`, e "modo review" no critério fica lido como a revisão única do release.

**Doc de configuração (peça 2).** Em `references/config.md` a linha `taskReview` passa a: objeto com o booleano opcional `restricted`, lido com `=== true`, desligado por padrão, com a explicação atual do modo restrito; nota "`single` (revisão única, E28) foi removida em E29 depois da passada C: o preflight recusa a chave com mensagem pedindo para apagá-la"; recusa de não objeto, não booleano e outra chave, nomeando-a.

**Arnês de medição ao caminho único (risco do card, R4).** Em `checkLoopWorkflow` de `tools/measure/run-batch.mjs` os literais `TASK_SINGLE_LITERALS` e `TASK_SINGLE_ISSUES_LITERAL` passam a ser exigidos só quando o braço é `unica`: a assinatura ganha `arm` nas opções (`{ lenses, arm }`) e a chamada em `runBatch` passa `h.arm`. O braço `atual` em `lentes-semeadas-A/B` roda contra o workflow novo (é o que E30 usa, trocando só `--review-model`); o braço `unica` contra um workflow sem a chave é recusado na partida pela mensagem de literal ausente de hoje, sem chamada paga. O script do braço `atual` continua gravando `H_TR = {"restricted":false,"single":false}` e `harness.taskReview` com `single: false`, para que os agregados novos tenham a mesma forma dos da passada C em `armTotals`. Os testes que rodam o braço `unica` contra o workflow real (`review-loop.test.mjs`: `lensScript('unica')` e o laço `atual`/`unica` do script de lentes; `run-batch.test.mjs`: `C2: startup refusals on the measured workflow for lentes-semeadas` e os testes C2 e C3 que montam o script de lentes `unica`) passam a ler `tools/measure/fixtures/workflow-com-single/roadmap-release.js`, cópia literal do workflow em `ccac3c5` (ponta da release antes de E29), marcada no topo dos testes como fixture congelada; os testes do braço `atual` continuam no workflow real. O teste de recusa ganha os casos: workflow real com `arm: 'atual'` e `lenses: true` não recusa; workflow real com `arm: 'unica'` recusa citando o literal ausente.

**Tamanho.** A remoção só encolhe `roadmap-release.js`; `size.test.mjs` roda sem mudança.

## Riscos

- O arnês da passada C deixa de partir no braço `atual` -> literais do modo único exigidos só no braço `unica` (R4) e teste com o workflow real no braço `atual`.
- Quem tem `taskReview.single` no `release.config.json` para de rodar -> a mensagem diz o que fazer; a nota de atualização de E33 avisa.
- Remover o modo `review` do agente quebraria o plan-coordinator -> o modo fica, só sai a ligação ao release (R3).
- A cópia congelada do workflow diverge do que a passada C mediu -> é a ponta da release antes de E29 (`ccac3c5`), que traz o mesmo bloco puro do modo único entregue por E28.

## Deixado para o plano

- Ordem das tarefas: workflow e testes do release; preflight, `config.md` e testes; agente; arnês e fixture; gates G1 a G5 na tarefa final.
- A lista exata dos testes do arnês que passam à fixture e os nomes dos testes novos.
- O comando que cria a fixture (`git show ccac3c5:plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`), gravada em LF.

```json data
{
  "schema": "spec/1",
  "id": "E29",
  "title": "Remover o modo de revisão única",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o plugin na release, quando se procura taskReview.single e o modo review no workflow, no preflight e no task-reviewer, então não há ocorrência fora de notas históricas, e a revisão por tarefa roda só spec e quality. {verify: test; evidence: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"}"
    },
    {
      "id": "AC2",
      "text": "Dado um release.config.json com taskReview.single, quando o preflight roda, então o comportamento decidido na spec (recusa com mensagem ou aviso) acontece e está coberto por teste. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como o workflow fica com o caminho único?",
      "decision": "TR = { restricted: tr.restricted === true }; laço por tarefa fixo em ['spec', 'quality']; taskIssues sem o achado sintético de veredicto; S_TASKREVIEW mantém spec e quality opcionais; testes de E28 sobre single removidos e um teste novo de ausência em review.test.mjs.",
      "basis": "REQ-001 e critério 1 do card; decisões 773, 776 e 777 do roadmap anterior (remoção prevista).",
      "alternative": "Manter o código e só desligar a chave no preflight.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "O preflight recusa ou só avisa quando encontra taskReview.single?",
      "decision": "Recusa, com qualquer valor da chave, com a mensagem 'taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json'; é a única ocorrência de taskReview.single no preflight, tratada como nota histórica.",
      "basis": "Questão em aberto da estratégia (decidir na spec); o preflight já recusa toda chave desconhecida de taskReview nomeando-a; quem ligou single esperava outro comportamento e um aviso o faria rodar em silêncio com os dois laços.",
      "alternative": "Aviso sem recusa, ignorando a chave.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O modo review sai do task-reviewer?",
      "decision": "Não: o plan-coordinator despacha o task-reviewer com Mode: review; sai só a ligação ao release (the workflow's single review), a frase do achado feito pelo script e a combinação restricted, review; 'modo review' no critério 1 é lido como a revisão única do release.",
      "basis": "coordinator.js (reviewPrompt e preLaunchPrompt usam Mode: review com agentType productivity-tools:task-reviewer); o plan-coordinator está fora do card.",
      "alternative": "Remover o modo review do agente e mudar o plan-coordinator para spec e quality.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como o arnês da passada C fica com o caminho único?",
      "decision": "checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).",
      "basis": "Risco do card (primeira opção: só exigir os literais no braço unica); premissa de E30 (medir só trocando --review-model); armTotals compara a forma de harness.taskReview.",
      "alternative": "Aposentar o braço unica e seus testes na mesma branch.",
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
      "input": "release.config.json com taskReview { single: false }.",
      "expected": "O preflight recusa com a mensagem de remoção."
    },
    {
      "id": "C2",
      "input": "release.config.json com taskReview { restricted: true, single: true }.",
      "expected": "Um erro só, a mensagem de remoção; restricted continua válido."
    },
    {
      "id": "C3",
      "input": "run-batch --stage task-review --rounds loop em lentes-semeadas-A com --arm atual contra o plugin novo.",
      "expected": "Parte sem recusa."
    },
    {
      "id": "C4",
      "input": "run-batch em lentes-semeadas-A com --arm unica contra o plugin novo.",
      "expected": "Recusa na partida citando o literal ausente, sem chamada paga."
    }
  ]
}
```
