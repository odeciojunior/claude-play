# Spec E9 -- Implementador e corretor nativos

## Intenção

O release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`) ainda manda o implementador seguir `superpowers:test-driven-development` e os corretores de merge e de gates usarem `superpowers:systematic-debugging` (pendente deixado por E8: DEC-495, DEC-525, DEC-550), e a disciplina de teste primeiro não é conferida por código (REQ-028). E9 cria o implementador do plugin, um agente com dois modos (implementar uma tarefa e corrigir achados), despacha por ele as seis chamadas de implementação e correção de código do workflow e confere em código, antes de qualquer revisor, a evidência de teste falhando e depois passando das tarefas que o plano marca como teste primeiro. As revisões por tarefa e final continuam as de hoje (card E9; DEC-039).

## Escopo

Dentro:

- Novo agente `plugins/productivity-tools/agents/implementer.md` (`productivity-tools:implementer`), com o modo de implementação (peça 1) e o modo de correção (peça 3).
- Em `roadmap-release.js`: as seis chamadas com `schema: S_IMPL` passam a despachar o agente por `agentType` (implementador `:impl`/`:impl-lock`, corretor por tarefa `-fix`, corretor da revisão final `final-fix`, corretor de gates `gates-fix`, corretor pós-merge `merge-fix` e corretor da sincronização tardia `delta-fix`/`resync-fix`); o texto genérico desses prompts sai do script e vai para o agente; `tasksFromPlan` passa a levar `testFirst`; nova função pura de conferência de teste primeiro e sua chamada logo depois do retorno do implementador (peça 2).
- Testes em `workflow/review.test.mjs` (critérios 1 e 2) e `workflow/prompts.test.mjs` (critério 3); ajuste dos testes existentes que conferem texto movido para o agente.
- Linha do agente na seção Agents de `plugins/productivity-tools/README.md`.
- Relatório do teste comportamental (SRC-03), feito pelo orquestrador da sessão principal (DEC-204).

Fora:

- Revisor por tarefa com achados identificados (E21) e verificação adversarial na revisão final (E24); os prompts de revisão não mudam.
- O teto de `size.test.mjs` (240.000 caracteres LF, DEC-556, DEC-563): não muda.
- Versão do plugin (sem bump, nota do dono) e a pasta do roadmap `docs/plans/roadmap-evolucao-skills/` (só nos estágios de registro e docs).
- Os estágios de spec e de plano (E8), os agentes `spec-author` e `plan-author` e o texto de `references/operator.md`.

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` nem editar `size.test.mjs`; não fazer push nem tocar em `main`.
- Não reaplicar a conferência de teste primeiro em rodadas de correção nem em tarefas retomadas.
- Não citar `superpowers` no agente nem em prompt do workflow; não trocar os modelos e efforts calculados pela rota (DEC-486, DEC-516, DEC-543).

## Desenho

**Critério 1 (tarefa de teste primeiro sem vermelho antes do verde falha em código, sem revisor).** `tasksFromPlan` (`roadmap-release.js`, dentro do bloco `// <pure>`) copia `testFirst` do emit de `plan/1` (`true` ou `{ exempt: "<motivo>" }`, validado por `scripts/plan-tool.mjs`). Nova função pura `testFirstGap(task, impl, resumed)` no mesmo bloco: devolve `''` quando a conferência não se aplica ou passa, e um texto curto com o número da tarefa e a quantidade de verificações relatadas quando falha. Passa quando há em `impl.checks` um índice `i` com `exit` diferente de 0 e um índice `j > i` com `exit` 0 cujo `commandKey(command)` (função pura já existente) é igual ao de `i` (R3). No laço de tarefas de `runDeliverable`, logo depois do tratamento de `DONE`/`DONE_WITH_CONCERNS` (registro de efeito e `closeEffect`, para que as marcas de efeito externo fiquem coerentes) e antes do `reviewLoop` de `spec`, a chamada `const gap = testFirstGap(t, impl, resumed)` faz `return fail('conteudo', ...)` quando `gap` não é vazio (R5). `review.test.mjs` carrega a função por `loadPure()` e confere a falha: só verificações passando, falha depois do verde, vermelho e verde de comandos diferentes e lista vazia; a ordem no laço (conferência antes do primeiro revisor) é conferida no mesmo arquivo pelo texto do script, sem chamada de revisor depois de um `testFirstGap` não vazio.

**Critério 2 (retomada e tarefa não marcada não são reprovadas).** `testFirstGap` devolve `''` quando `resumed` é verdadeiro (o stub de retomada tem `checks: []`), quando `task.testFirst !== true` (isenção ou campo ausente, como nas fixtures de `flow.test.mjs`), quando `noFiles(task)` é verdadeiro e quando `impl.status` não é `DONE` nem `DONE_WITH_CONCERNS` (BLOCKED e NEEDS_HUMAN seguem os caminhos de hoje) (R4). `review.test.mjs` cobre os quatro casos, incluindo o stub de retomada literal do script, e o caso que passa (vermelho seguido do verde do mesmo comando).

**Critério 3 (nenhum prompt de implementador ou corretor cita superpowers e todos proíbem perguntar).** `agents/implementer.md` tem frontmatter `name: implementer`, `description` (diz que nunca pergunta à pessoa) e `tools: Read, Grep, Glob, Bash, Write, Edit`, sem `model` nem `effort` (R2). O corpo traz: a frase de `NO_ASK` literal do workflow; o modo de implementação (implementar só a tarefa pedida, teste primeiro quando o prompt marca a tarefa assim: escrever o teste, rodar o comando exato e relatar a falha, implementar e rodar o mesmo comando até passar, relatando as duas execuções em ordem; relatar em `checks` toda verificação com comando exato, saída real e código de saída; o significado de cada status de `S_IMPL`); o modo de correção, escolhido quando o prompt lista problemas a corrigir (causa raiz antes do conserto, teste que reproduz cada defeito, nunca mascarar falha, nunca editar spec nem plano aprovados para fazer um achado sumir, discordância técnica não aplicada e explicada em `concerns`); e a regra de que o prompt da chamada vence o arquivo onde divergirem. No script, uma função `implAgent = (p, o) => agent(p, { agentType: 'productivity-tools:implementer', schema: S_IMPL, ...o })` fica ao lado de `NO_ASK`, e as seis chamadas passam por ela, mantendo `model` e `effort` de hoje (`implModel`/`implEffort`, `tier`/`effortFor`, `sonnet`/`medium`). Saem do script: `Follow TDD (superpowers:test-driven-development).`, o parágrafo de relato de `checks` e a lista de status de `buildImplPrompt`, o texto longo de não editar spec e plano e de discordância do corretor por tarefa (trocado por `noSpecEdit()`), as três frases "If you disagree technically..." e as duas instruções `Use superpowers:systematic-debugging` (o pedido específico de cada corretor, com rodar o gate, commitar com o assunto e não mascarar, fica). `buildImplPrompt` ganha uma linha curta conforme `task.testFirst`: tarefa de teste primeiro, ou isenta com o motivo (R10). Todo prompt continua abrindo com o briefing (`briefing(ctx)`, `C()` ou `Cn()`), cujo `COMMON_BASE` já diz que perguntar ao usuário é proibido (R7). `prompts.test.mjs` confere: o texto de `roadmap-release.js` não contém `superpowers`; `schema: S_IMPL` aparece só em `implAgent` e há seis chamadas de `implAgent(` com os rótulos `:impl`, `-fix`, `final-fix`, `gates-fix`, `merge-fix` e `delta-fix`, cada uma abrindo com o briefing; `agents/implementer.md` não contém `superpowers` e contém a frase de `NO_ASK` extraída do script; `buildImplPrompt` traz a linha de teste primeiro e a de isenção. Os asserts existentes de `prompts.test.mjs` e `flow.test.mjs` sobre texto que saiu do script são ajustados para o agente, sem perder o que conferem.

**Tamanho do script.** `roadmap-release.js` mede 239.908 caracteres LF na ponta da release, 92 sob o teto (state.md, DEC-556). O texto movido para o agente (perto de 1.200 caracteres) cobre a função de conferência, a chamada, `implAgent` e a linha de teste primeiro (R6). O plano mede o tamanho com `workflowChars` depois de cada tarefa que edita o script; se o total passar de 240.000, a tarefa para com BLOCKED e uma ação do dono, sem editar `size.test.mjs`.

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal (DEC-204), no worktree de E9 antes do merge: um subagent segue `agents/implementer.md` literalmente numa tarefa de teste primeiro sobre uma fixture sintética marcada numa pasta temporária, outro no modo de correção sobre uma lista de achados; cada um lista as ambiguidades; uma revisão adversarial só de leitura confere a saída; o relatório vai para `docs/reports/2026-11-12-E9-implementador-comportamental.md` (R8). Sem ferramenta de subagent no executor do workflow, essa tarefa não roda dentro dele.

## Deixado para o plano

- A ordem das tarefas (agente, função pura com testes, troca das chamadas e remoção de texto, ajuste dos testes antigos, README, comportamental) e a medição de tamanho depois de cada edição do script.
- O texto exato de `agents/implementer.md` e da mensagem de `testFirstGap`, respeitando R2, R3 e R7.
- Como o teste de ordem do critério 1 localiza a chamada no laço (texto do script ou rodada pelo arnês de `flow.test.mjs` copiado para `review.test.mjs`).
- Os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo.

```json data
{
  "schema": "spec/1",
  "id": "E9",
  "title": "Implementador e corretor nativos",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada uma tarefa de teste primeiro sem verificação falhando antes da verificação passando, quando o workflow recebe o retorno do implementador, então a tarefa falha em código, sem chamada de revisor. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma tarefa já commitada por uma execução anterior e retomada sem verificações relatadas, ou uma tarefa que o plano não marca como teste primeiro, quando o workflow aplica a conferência, então a tarefa não é reprovada por ela e segue para a revisão. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dados os prompts de implementador e de corretor de código (por tarefa, revisão final, gates, merge e sincronização), quando inspecionados, então nenhum cita o superpowers e todos proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Implementador e corretores são um agente ou dois, e como são despachados?",
      "decision": "Um agente do plugin, productivity-tools:implementer (agents/implementer.md), com modo de implementação e modo de correção; as seis chamadas com schema S_IMPL o despacham por agentType através de uma função implAgent.",
      "basis": "Peça 3 do card pede o modo de correção no mesmo papel; DEC-057 comprova agentType em workflow; a nota do dono manda o texto do implementador e dos corretores para o agente do plugin.",
      "alternative": "Dois agentes, implementer e fixer, com texto repetido.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "O frontmatter do implementador fixa modelo e effort?",
      "decision": "Não: sem model nem effort no frontmatter; cada chamada passa o model e o effort de hoje (rota da tarefa, tier do escalonamento, sonnet/medium nos corretores de gates e merge).",
      "basis": "DEC-486, DEC-516 e DEC-543 tiram modelo e effort do implementador da rota; a sonda de E14 mostrou que o model do frontmatter vale e não mediu se o da chamada vence, então um model no frontmatter poderia anular a rota em silêncio.",
      "alternative": "model: sonnet e effort: medium no frontmatter como padrão.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O que conta como evidência de teste falhando e depois passando?",
      "decision": "Em impl.checks, uma verificação com exit diferente de 0 seguida, em índice maior, de uma com exit 0 e o mesmo commandKey.",
      "basis": "O critério 1 fala da verificação falhando antes da verificação passando, a mesma; commandKey já é a comparação de comando do script.",
      "alternative": "Qualquer verificação falhando antes de qualquer verificação passando, de comandos diferentes.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Quando a conferência de teste primeiro se aplica?",
      "decision": "Só quando task.testFirst === true, a tarefa foi lançada nesta execução (não retomada), noFiles(task) é falso e o status é DONE ou DONE_WITH_CONCERNS; nunca nas rodadas de correção.",
      "basis": "Segundo risco do card e critério 2: retomada, tarefa sem arquivos e tarefa não marcada não podem ser reprovadas; BLOCKED e NEEDS_HUMAN já têm caminho próprio.",
      "alternative": "Aplicar também ao retorno de cada corretor por tarefa.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que acontece quando a evidência falta?",
      "decision": "fail('conteudo') do entregável com o número da tarefa e a contagem de verificações, antes do primeiro revisor e depois do registro de efeito e de closeEffect; sem nova tentativa do implementador.",
      "basis": "O critério 1 diz que a tarefa falha em código, sem chamada de revisor; fechar as marcas de efeito antes evita relançar um efeito externo na retomada.",
      "alternative": "Mandar uma rodada de correção ao implementador com a falta apontada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como E9 cabe sob o teto de 240.000 caracteres com folga de 92?",
      "decision": "Mover para o agente o texto genérico dos prompts (TDD, relato de checks, status, não editar spec e plano, discordância técnica, método de depuração), passar as seis chamadas por implAgent e medir com workflowChars depois de cada edição; se não couber, parar com BLOCKED e ação do dono, sem editar size.test.mjs.",
      "basis": "DEC-556 e DEC-563 fixam o teto e proíbem aumentá-lo sem nova decisão do dono; a nota do dono manda caber encolhendo o script.",
      "alternative": "Encurtar outros textos do workflow fora dos prompts de E9.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Onde fica a proibição de perguntar à pessoa nos prompts de implementador e corretor?",
      "decision": "Na frase de NO_ASK literal no corpo do agente (prompt de sistema de todas as seis chamadas) e no briefing com que todo prompt abre (COMMON_BASE); os prompts das chamadas não repetem NO_ASK, e o teste amarra o texto do agente à constante do script.",
      "basis": "REQ-013; o briefing já proíbe perguntar; repetir NO_ASK em seis prompts gasta caracteres que o teto não tem.",
      "alternative": "Interpolar NO_ASK em cada um dos seis prompts.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como fazer o teste comportamental pedido pela definição de pronto?",
      "decision": "Tarefa do orquestrador da sessão principal no worktree de E9: dois subagents seguem agents/implementer.md literalmente (implementação de teste primeiro sobre fixture sintética marcada, e correção sobre lista de achados), uma revisão adversarial só de leitura, relatório em docs/reports/2026-11-12-E9-implementador-comportamental.md.",
      "basis": "SRC-03 (.claude/rules/skills.md) e DEC-204: o executor do workflow não tem ferramenta de subagent.",
      "alternative": "Rodar o release inteiro em sandbox com o agente novo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Há bump de versão e documentação do agente novo?",
      "decision": "Sem bump; a seção Agents de plugins/productivity-tools/README.md ganha a linha do implementer.",
      "basis": "Nota do dono (sem bump); o README do plugin já lista spec-author e plan-author.",
      "alternative": "Subir a versão nos dois lugares.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como o implementador sabe se a tarefa é de teste primeiro?",
      "decision": "tasksFromPlan leva testFirst e buildImplPrompt acrescenta uma linha curta: tarefa de teste primeiro, ou isenta com o motivo; o agente explica a evidência pedida.",
      "basis": "plan/1 já valida testFirst por tarefa; a conferência de R4 usa o mesmo campo, então o implementador e o código leem a mesma marca.",
      "alternative": "Pedir teste primeiro em toda tarefa, sem ler o plano.",
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
      "input": "Tarefa testFirst true cujo implementador relata o mesmo comando com exit 1 e depois com exit 0.",
      "expected": "A conferência passa e a tarefa segue para a revisão de spec."
    },
    {
      "id": "C2",
      "input": "Tarefa testFirst true com a falha relatada depois do único verde, ou com vermelho e verde de comandos diferentes.",
      "expected": "A tarefa falha em código, sem chamada de revisor."
    },
    {
      "id": "C3",
      "input": "Tarefa testFirst { exempt: \"motivo\" }, tarefa retomada com checks vazio, ou tarefa noCommit sem arquivos.",
      "expected": "A conferência não se aplica e a tarefa segue para a revisão."
    },
    {
      "id": "C4",
      "input": "Implementador devolve BLOCKED ou NEEDS_HUMAN numa tarefa testFirst true.",
      "expected": "Vale o caminho de hoje para esses status; a conferência não roda."
    },
    {
      "id": "C5",
      "input": "Depois das edições, roadmap-release.js passa de 240.000 caracteres LF.",
      "expected": "A tarefa para com BLOCKED e ação do dono; size.test.mjs não é editado."
    }
  ]
}
```
