# Spec E23 -- Retomada do release sem repetir revisões

## Intenção

Hoje cada retomada do release refaz a revisão de spec, a de plano e a final, e mede de novo os gates no preflight, mesmo quando nada mudou desde a aprovação (SRC-02 §4, confirmado em SRC-10; REQ-011, REQ-036). E23 grava, por script e na branch do entregável, o registro da execução `run.json` com o que foi aprovado (blob do spec, blob do plano, chave da árvore da branch, ponta do alvo sincronizada) e com a medição de preparação. Na retomada, o workflow pula cada revisão cujos valores são os do registro e reaproveita a medição quando o alvo não mudou. É fatia de E8: usa os caminhos de artefato de DEC-026 e DEC-510 (que reservou `run.json` a E23) e o resumo de integridade do plano que E8 fixou.

## Escopo

Dentro:

- Novo script `plugins/productivity-tools/scripts/run-record.mjs`, com os subcomandos `approve`, `key` e `baseline`, e seu teste `plugins/productivity-tools/scripts/run-record.test.mjs` (peça 1; o card não nomeia o arquivo de teste do script, risco 4).
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `artifactPaths` ganha `run`; funções puras novas no bloco `// <pure>` para ler a saída do script, decidir o pulo de cada revisão, montar o comando de gravação e aceitar a medição registrada; os estágios de preflight, setup, spec, plano, leitura de progresso, sincronização, revisão final e log de revisões passam a ler ou gravar o registro (peça 2).
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`: `WORKFLOW_SCRIPTS` ganha `run-record.mjs`, com a regra de permissão pelo nome do script (estratégia v1.1, DEC-060); teste em `preflight.test.mjs`.
- Casos novos em `workflow/flow.test.mjs` (critérios 1 a 3), que já existe.
- Uma frase em `skills/roadmap-release/references/config.md` (regra do script) e uma em `skills/roadmap-release/references/operator.md` (o que a retomada pula).
- Teste comportamental da skill (definição de pronto, SRC-03), como tarefa do orquestrador da sessão principal (DEC-204).

Fora:

- A lógica de efeito externo, autorizações, `planFingerprint`, a carga do plano e do spec (que continuam rodando em toda retomada) e a revisão por tarefa (E21).
- A revisão final adversarial (E24), a revisão única (E28) e qualquer modo novo de revisão.
- Discovery e o registro do roadmap pela CLI do tracker (DEC-222 já cobre a repetição).
- A pasta do roadmap `docs/plans/roadmap-evolucao-skills/` e a estratégia; versão do plugin (sem bump).

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` nem editar `size.test.mjs` (DEC-556, DEC-563); não encurtar texto de estágio que E23 não muda (DEC-592).
- Não usar a ponta da branch na chave de retomada (risco 1 do card).
- Não pular revisão sem registro ou com qualquer valor diferente; não alterar a lógica de efeito externo; os testes atuais continuam passando (risco 2).
- Não acrescentar chamada de agente nova no caminho comum; não fazer push nem tocar em `main`; não citar `superpowers`.

## Desenho

**Registro da execução (peça 1).** `run-record.mjs` chama o git por `execFileSync`, sem shell. `approve <worktree> <dir> <E> <estágios> <ponta|-> <carga>` mede no `HEAD` do worktree o blob de `<dir>spec.md`, o de `<dir>plan.md` e a chave da árvore, grava `<dir>run.json` (`schema: "run/1"`, um objeto por estágio aprovado: `spec { spec }`, `plan { spec, plan }`, `final { spec, plan, tree, target }`, mais `prep`) e faz o commit só desse arquivo (`git commit -- <dir>run.json`, assunto `<E>: run record (<estágios>)` e a linha de trailer da carga). A carga é JSON codificado com `encodeURIComponent` (aspas simples trocadas por `%27`), entre aspas simples, com `prep { targetHead, gatesKey, baseline }` e `trailer`. A chave da árvore é o sha256 da saída de `git ls-tree -r HEAD` sem as linhas de `<dir>run.json` e `<dir>reviews.md`: gravar o registro ou o log não a muda (R2). `key <worktree> <dir>` imprime `{ recorded, spec, plan, tree }`, com `recorded` lido de `HEAD:<dir>run.json` (null quando não existe). `baseline <repo> <alvo> <gatesKey> <branch:dir>...` imprime o primeiro `prep` cujo `targetHead` é `git rev-parse <alvo>` e cujo `gatesKey` confere, e sai 1 sem nada quando não há; uso inválido sai 2 (forma de DEC-590). O valor de `targetHead` gravado é o `pre.targetHead` da execução, e `gatesKey` é `fnv1a(canon(GATES))`, calculado no workflow.

**Onde a aprovação é gravada (R4).** Nenhuma chamada nova no caminho comum. A aprovação de spec e de plano é o primeiro comando do agente de leitura de progresso (`${E}:progress`), que roda logo depois do laço do plano, e só quando a revisão de spec ou a de plano rodou nesta execução; o prompt deixa de abrir com "Read-only" só nesse caso. A aprovação final é o primeiro comando do agente do log de revisões em `persistReviews('')`, só quando a revisão final rodou. Uma gravação que falha só faz a próxima retomada revisar como hoje. O comando é montado por uma função pura `recordCmd` a partir de `RR` (`<raiz do plugin>/scripts/run-record.mjs`, por `pluginRootOf(A.trackerCli)`), do worktree, de `AP.dir`, dos estágios, da ponta e da carga.

**Critério 1 (spec, plano, árvore e ponta iguais: nenhuma revisão de spec, de plano nem final).** O setup ganha um passo: `record` = a saída crua de `node "${RR}" key "${wt}" ${AP.dir}` (`S_SETUP.record: STR`). Uma função pura `runKey(stdout)` lê o JSON (null quando inválido) e `skipReview(estágio, k, ponta)` devolve verdadeiro só quando o registro tem o estágio e cada valor exigido é uma string não vazia igual ao atual: spec só o blob do spec; plano os blobs de spec e plano; final os quatro valores (R3). O laço do spec é trocado por `{ ok: true }` quando `spec.reused`, a carga do spec não acusou falha de check e `skipReview('spec', K0)`; o do plano quando `spec.reused`, `plan.reused`, `skipReview('plan', K0)` e `planGaps()` vazio. A sincronização (`syncBranch`) devolve também `record`, a saída do mesmo `key` medida depois do merge (`S_SYNC.record: STR`); quando `skipReview('final', runKey(sync.record), sync.targetTip)` é verdadeiro, o workflow não chama a medição de integridade dos testes nem o laço final (R6). Cada pulo entra em `out.concerns` citando `run.json`. O teste em `flow.test.mjs` simula uma retomada com registro igual nos quatro valores e confere que nenhum rótulo `:spec-review`, `:plan-review` ou `:final-` foi chamado e que o entregável segue para os gates.

**Critério 2 (alvo avançou: a revisão final roda de novo).** Com o alvo adiante, a sincronização devolve outra `targetTip` (e outra árvore quando algo entrou), então `skipReview('final', ...)` é falso e a revisão final roda como hoje, seguida da gravação da nova aprovação final. As revisões de spec e de plano continuam puladas se seus blobs não mudaram, porque não dependem do alvo. O teste usa o mesmo registro com `targetTip` diferente e confere que `${E}:final-1-r1` foi chamado.

**Critério 3 (alvo inalterado: reaproveita a medição registrada dos gates).** No modo `run`, o passo 4 do preflight começa pelo comando `node "${RR}" baseline "${REPO}" ${TARGET} ${gatesKey} <branch:dir dos entregáveis selecionados>`: se ele imprime JSON, o preflight devolve essa saída crua em `recorded` (`S_PRE.recorded: STR`) e não mede os gates; o resto do passo (limpeza, `headSha`, instalação) e os passos 1, 2, 3 e 5 ficam como hoje. Uma função pura `recordedBaseline(stdout, head, gatesKey, defs)` aceita a medição só quando `targetHead` é `pre.targetHead`, `gatesKey` confere e `validMeasure(baseline, head, defs)` passa; então ela vira `pre.baseline` antes da conferência de preflight incompleto, e o resto (base vermelha, `BASE`, `lastGood`) segue igual. Sem registro aceito, o preflight mede como hoje (R5). O teste de `flow.test.mjs` faz o preflight devolver `recorded` válido sem `baseline` e confere que o prompt traz o comando `baseline`, que a execução não para em `preflight:` e que o resumo da base vem da medição registrada.

**Permissão do script (R8).** `WORKFLOW_SCRIPTS` passa a `['roadmap.mjs', 'review-package.mjs', 'run-record.mjs']`; o caminho de `run-record.mjs` é derivado da raiz do plugin como o de `review-package.mjs`, e a regra é exigida em toda execução, porque o setup lê o registro também em `plan-only`. `preflight.test.mjs` atualiza o assert da lista e ganha o caso da regra; `config.md` cita a regra `Bash(node *run-record.mjs" *)`.

**Tamanho do script (R7, nota do dono).** `roadmap-release.js` mede 239.866 caracteres LF, 134 sob o teto. Cada tarefa que edita o script mede `workflowChars` de `size.test.mjs` depois de cada edição e libera espaço antes de somar código, só no texto dos estágios que E23 muda (preflight, setup, spec, plano, progresso, sincronização e revisão final, log de revisões e seus comentários); a lógica nova fica em `run-record.mjs`. Nunca encurta outro estágio nem edita `size.test.mjs`; acima de 240.000, a tarefa para com BLOCKED e o déficit medido.

**Metas (estratégia, tabela de metas; DEC-281).** Na parada-retomada, a sessão de retomada encontra spec e plano reutilizados sem nota e com os blobs registrados na primeira sessão, então pula as duas revisões em opus: 9 − 2 = 7 chamadas opus e 669 − 2 × 40 = 589 de ponderado, sem chamada nova (as gravações e leituras vão em agentes que já rodam). As metas de E23 ficam confirmadas.

**Teste comportamental (definição de pronto, SRC-03, R9).** Tarefa do orquestrador da sessão principal no worktree de E23, antes do merge (DEC-204): no workflow ela devolve NEEDS_HUMAN, sem relatório fictício; o orquestrador roda a parada e a retomada sobre uma fixture sintética marcada e escreve o relatório em `docs/reports/`.

## Deixado para o plano

- A ordem das tarefas, com teste primeiro para `run-record.mjs`, as funções puras e os casos de `flow.test.mjs`; o texto exato dos prompts e o que encurtar em cada estágio para caber no teto.
- Os nomes finais das funções puras e da variável dos entregáveis selecionados usada no preflight.
- Os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo; a revisão final da branch inteira é o estágio final do workflow.

```json data
{
  "schema": "spec/1",
  "id": "E23",
  "title": "Retomada do release sem repetir revisões",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada uma retomada em que spec, plano, árvore da branch e ponta do alvo são os registrados na aprovação, quando o workflow roda, então não faz nenhuma chamada de revisão de spec, de plano nem final. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma retomada em que o alvo avançou desde a aprovação, quando o workflow roda, então a revisão final roda de novo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dada uma retomada com o alvo inalterado, quando o workflow chega à preparação, então reaproveita a medição registrada dos gates em vez de medir de novo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica o registro da execução e quem o grava?",
      "decision": "Em docs/plans/<slug>-<E>/run.json na branch do entregável, gravado e commitado só por plugins/productivity-tools/scripts/run-record.mjs (subcomandos approve, key e baseline, git por execFileSync sem shell), com teste em run-record.test.mjs.",
      "basis": "Peça 1 do card; DEC-026 e DEC-510 reservam run.json a E23; DEC-590 dá a forma de script do plugin; nota do dono manda a lógica nova para um script.",
      "alternative": "O agente escreve o JSON com a ferramenta Write e faz o commit.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Quais valores formam a chave de retomada?",
      "decision": "Blob do spec, blob do plano, chave da árvore (sha256 de git ls-tree -r HEAD sem run.json e reviews.md da pasta do entregável) e a ponta do alvo sincronizada (targetTip da sincronização); nunca a ponta da branch.",
      "basis": "Risco 1 do card: gravar a aprovação move a ponta; tirar run.json e reviews.md da árvore deixa a chave estável depois do commit do registro e do log.",
      "alternative": "Usar HEAD^{tree} sem filtro, que muda a cada commit do registro.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Cada revisão é pulada por quais valores?",
      "decision": "Spec: spec sem commit nesta execução, sem falha de check e blob igual ao registrado; plano: spec e plano sem commit, blobs iguais e planGaps vazio; final: os quatro valores iguais. Valor ausente ou diferente revisa como hoje.",
      "basis": "Critérios 1 e 2; risco 2 do card; a meta de E23 (opus 9 − 2) só vale se spec e plano forem pulados na retomada depois da primeira tarefa, quando a árvore já mudou.",
      "alternative": "Pular as três revisões só quando os quatro valores conferem.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Em que chamada a aprovação é gravada?",
      "decision": "Sem chamada nova: spec e plano como primeiro comando do agente de leitura de progresso, só quando uma das duas revisões rodou; final como primeiro comando do agente do log de revisões em persistReviews(''), só quando a revisão final rodou. Falha na gravação só faz a retomada revisar.",
      "basis": "Tabela de metas (DEC-281): ponderado 589 é a linha de base menos 2 × 40, e uma chamada haiku a mais por execução o tiraria do alcance; teto de tamanho (DEC-556).",
      "alternative": "Uma chamada haiku dedicada depois de cada aprovação.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Onde a medição de preparação fica guardada e quando é reaproveitada?",
      "decision": "Em prep { targetHead, gatesKey, baseline } de cada run.json, gravado junto de cada aprovação; no modo run o preflight roda run-record.mjs baseline sobre as branches dos entregáveis selecionados e, se houver saída, não mede; o workflow aceita só com targetHead igual, gatesKey igual a fnv1a(canon(GATES)) e validMeasure, senão mede como hoje.",
      "basis": "Risco 3 do card manda o spec decidir o lugar; critério 3; REQ-036; a chave dos gates evita reaproveitar medição de outra configuração.",
      "alternative": "Levar a medição nos args de retomada (resumeWith).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "A medição de integridade dos testes roda quando a revisão final é pulada?",
      "decision": "Não: seu único consumidor na branch é o prompt da revisão final, e a árvore é a que a revisão aprovada já viu.",
      "basis": "Em roadmap-release.js os alertas de integrity só entram no prompt de finalLoop.",
      "alternative": "Medir sempre a integridade.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como a entrega cabe no teto de 240.000 caracteres?",
      "decision": "Medir workflowChars depois de cada edição; liberar espaço antes de somar código, só no texto dos estágios que E23 muda, com a lógica nova em run-record.mjs; nunca encurtar outro estágio nem editar size.test.mjs; acima de 240.000, BLOCKED com o déficit medido.",
      "basis": "Nota do dono; DEC-556, DEC-563, DEC-592; o script mede 239.866 caracteres LF.",
      "alternative": "Encurtar texto de outros estágios do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como o script ganha regra de permissão?",
      "decision": "WORKFLOW_SCRIPTS ganha run-record.mjs, com caminho derivado da raiz do plugin, exigido em toda execução (o setup lê o registro também em plan-only); config.md cita a regra.",
      "basis": "Estratégia v1.1 (regra pelo nome do script para E23); DEC-060; DEC-591 fez o mesmo para review-package.mjs.",
      "alternative": "Exigir a regra só no modo run.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Quem faz o teste comportamental da skill?",
      "decision": "O orquestrador da sessão principal, no worktree de E23 antes do merge, sobre fixture sintética marcada, com relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.",
      "basis": "DEC-204; definição de pronto do card (SRC-03); nota do dono.",
      "alternative": "Rodar o release inteiro em sandbox dentro do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Há bump de versão?",
      "decision": "Não; só config.md e operator.md ganham uma frase cada.",
      "basis": "Nota do dono; DEC-595 fez o mesmo em E21.",
      "alternative": "Subir a versão nos dois lugares.",
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
      "what": "Corrigir o card E23 por revisão da estratégia para nomear o teste do script, plugins/productivity-tools/scripts/run-record.test.mjs (risco 4 do card).",
      "why": "Revisão de estratégia é ato do dono; a entrega não edita a estratégia nem a pasta do roadmap.",
      "blocking": false,
      "workaround": "O spec nomeia o arquivo e o teste roda no G1."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Retomada de uma branch sem run.json (primeira execução ou branch anterior a E23).",
      "expected": "key devolve recorded null; as três revisões rodam e o preflight mede os gates como hoje."
    },
    {
      "id": "C2",
      "input": "Retomada com nota do dono que muda o spec.",
      "expected": "O spec ganha commit nesta execução, então as revisões de spec, plano e final rodam, e a aprovação nova é gravada."
    },
    {
      "id": "C3",
      "input": "run.json com prep de outra configuração de gates ou medição inválida.",
      "expected": "baseline não imprime ou recordedBaseline recusa; o preflight mede, e sem medição o workflow para como preflight incompleto, como hoje."
    },
    {
      "id": "C4",
      "input": "Correção de gates depois da aprovação final, seguida de parada.",
      "expected": "A árvore mudou, então a revisão final roda de novo na retomada."
    },
    {
      "id": "C5",
      "input": "Depois de uma edição, roadmap-release.js passa de 240.000 caracteres LF.",
      "expected": "A tarefa para com BLOCKED e o déficit medido; size.test.mjs não é editado e nenhum outro estágio é encurtado."
    }
  ]
}
```
