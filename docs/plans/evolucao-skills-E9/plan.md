# Plano E9 -- Implementador e corretor nativos

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E9/spec.md`. Worktree `D:/projects/claude-play-wt/E9`, branch `feat/E9`, portas 5200-5209 (nenhum servidor é necessário). Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main`, sem bump de versão, sem editar a pasta do roadmap.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `tasksFromPlan` (linha ~417, dentro de `// <pure>`), `noFiles` e `buildImplPrompt` (~548-559), `commandKey` (~773), `S_IMPL` (~1379), `NO_ASK` (~1647), `noSpecEdit` dentro de `runDeliverable` (~1732), as seis chamadas com `schema: S_IMPL`: `merge-fix` (~1850), `runImpl` (`:impl`/`:impl-lock`, ~2446), corretor por tarefa `-fix` (~2486), `final-fix` (~2551), `gates-fix` (~2613), `delta-fix` (~2674). O laço de tarefas trata `DONE`/`DONE_WITH_CONCERNS` (`recordRun`, `closeEffect`) e então entra no `reviewLoop` de `spec`.
- `workflow/load-pure.mjs` exporta toda função de topo do bloco `// <pure>`, então `testFirstGap` fica disponível para `review.test.mjs` sem mudança no carregador.
- `workflow/size.test.mjs` exporta `workflowChars` e `MAX_WORKFLOW_CHARS = 240000`; o script mede 239.908 caracteres LF (92 de folga).
- `workflow/flow.test.mjs`: linha ~3601 confere as chaves exatas de `tasksFromPlan` (precisa ganhar `testFirst`); linha ~2151 confere `Never edit the spec or the plan to satisfy a finding` no corretor por tarefa (com `noSpecEdit()` o texto passa a trazer os caminhos do spec e do plano); as linhas ~2179, ~2188 e ~2242 já conferem `noSpecEdit()` nos demais corretores e continuam valendo. As tarefas das fixtures do arnês não têm `testFirst`, então a conferência não se aplica a elas.
- `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` (Check 5) aceita `name`, `description` e `tools` no frontmatter de agente; `agents/spec-author.md` é o modelo de formato.

## Tamanho do script

Toda tarefa que edita `roadmap-release.js` roda `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` depois da edição. Se falhar (mais de 240.000 caracteres LF), a tarefa para com `BLOCKED`, diz quantos caracteres passou e pede ação do dono; nunca edita `size.test.mjs` nem `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563, nota do dono). A ordem T2 -> T3 -> T4 põe o acréscimo antes da remoção; se T2 ou T3 sozinhas passarem do teto, a tarefa pode já remover, no mesmo commit, as frases que a spec manda tirar da chamada que ela toca (por exemplo a frase de TDD de `buildImplPrompt`), desde que o texto equivalente já esteja em `agents/implementer.md` (T1) e os testes da tarefa passem; o resto da remoção fica em T4.

## Tarefas

### Tarefa 1: Agente implementer com modos de implementação e correção

Teste primeiro: em `workflow/prompts.test.mjs`, novo teste `AC3: implementer and fixer prompts cite no superpowers and forbid asking` (primeira parte) que lê `plugins/productivity-tools/agents/implementer.md` (caminho relativo ao teste: `../../../agents/implementer.md`) e extrai a constante `NO_ASK` do texto de `roadmap-release.js` por expressão regular sobre `const NO_ASK = '...'`; confere: frontmatter com `name: implementer`, `description` que diz que nunca pergunta à pessoa, `tools: Read, Grep, Glob, Bash, Write, Edit`, sem chave `model` nem `effort`; o corpo não contém `superpowers` e contém a frase de `NO_ASK` literal. Rodar o comando e relatar a falha (arquivo ausente).

Depois criar `agents/implementer.md`, em inglês como os demais agentes, com:

- abertura: agente do plugin despachado por `agentType: 'productivity-tools:implementer'`, um papel com dois modos; a frase de `NO_ASK` literal;
- regra de precedência: o prompt da chamada vence este arquivo onde divergirem;
- escolha do modo: modo de correção quando o prompt lista problemas a corrigir; senão modo de implementação;
- modo de implementação: implementar só a tarefa pedida e parar; quando o prompt marca a tarefa como de teste primeiro, escrever o teste, rodar o comando exato e relatar a falha, implementar e rodar o mesmo comando até passar, relatando as duas execuções em ordem em `checks` (o workflow confere isso em código); tarefa isenta segue o motivo dado;
- relato: em `checks` toda verificação com o comando exato, a saída real (parte relevante) e o código de saída; nunca inventar nem parafrasear saída;
- significado de cada status de `S_IMPL`: `DONE`; `DONE_WITH_CONCERNS` (descrever em `concerns`); `BLOCKED` (impossível sem mudar o plano, ou precisa de trava que não detém: `needsLock=<nome>`); `NEEDS_HUMAN` (depende de entrada humana: `humanInputs` mais placeholder implementado);
- modo de correção: causa raiz antes do conserto; um teste que reproduz cada defeito; nunca mascarar falha; nunca editar spec nem plano aprovados para fazer um achado sumir (se o item só se resolve mudando-os, não aplicar e explicar em `concerns`); discordância técnica não aplicada e explicada em `concerns`.

Rodar o mesmo comando até passar. Sem `model`/`effort` no frontmatter (R2 da spec). Commit `E9 T1: agente implementer`.

### Tarefa 2: Conferência pura de teste primeiro e testFirst em tasksFromPlan

Teste primeiro em `workflow/review.test.mjs`: carregar `testFirstGap` e `tasksFromPlan` por `loadPure()`. Testes:

- `AC1: testFirstGap fails a test-first task without red before green`: com `task = { n: 2, testFirst: true, noCommit: false, files: ['a.js'] }` e status `DONE`, a função devolve texto não vazio que contém `2` e a quantidade de verificações para: só verificações passando; falha depois do único verde do mesmo comando; vermelho e verde de comandos diferentes; `checks: []`; o mesmo vale com `DONE_WITH_CONCERNS`.
- `AC2: testFirstGap passes resumed, unmarked, no-file and blocked tasks`: devolve `''` para `resumed` verdadeiro com o stub literal de retomada (`checks: []`); `testFirst: { exempt: 'docs' }` e `testFirst` ausente; tarefa `noCommit: true` com `files: []`; status `BLOCKED` e `NEEDS_HUMAN`; e o caso C1 (mesmo comando com `exit 1` e depois `exit 0`, também com espaços diferentes nas pontas, comparados por `commandKey`).
- `tasksFromPlan` copia `testFirst` (`true` e `{ exempt }`).

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`, dentro de `// <pure>`: `tasksFromPlan` leva `testFirst: t.testFirst`; nova `function testFirstGap(task, impl, resumed)` logo depois de `commandKey`, devolvendo `''` quando `resumed`, `task.testFirst !== true`, `noFiles(task)` ou status fora de `DONE`/`DONE_WITH_CONCERNS`, e passando quando há `i < j` com `checks[i].exit !== 0`, `checks[j].exit === 0` e `commandKey` igual; senão `task <n>: test-first without a failing check followed by the same check passing (<k> checks)` (texto curto; o número exato de palavras é livre). Ajustar em `workflow/flow.test.mjs` a lista de chaves do teste `tasksFromPlan merges files and copies locks and external` para incluir `testFirst`. Rodar os testes até passar e medir o tamanho (seção Tamanho do script). Commit `E9 T2: conferência de teste primeiro`.

### Tarefa 3: Chamada da conferência antes do primeiro revisor

Teste primeiro em `workflow/review.test.mjs`, teste `AC1: the test-first check runs before the first task reviewer and fails without a reviewer` sobre o texto de `roadmap-release.js` (decisão R12): no corpo de `runDeliverable`, o índice de `testFirstGap(t, impl, resumed)` é maior que o de `closeEffect(t, awaitingPerson.includes(t.n))` e menor que o de ``reviewLoop(`T${t.n}:${kind}` ``; entre a chamada e o `reviewLoop` há `return fail('conteudo'` condicionado ao texto não vazio, e não há chamada `agent(` entre o `testFirstGap` e esse `return`. Rodar `review.test.mjs` e relatar a falha.

Implementar no laço de tarefas de `runDeliverable`, depois do bloco `if (!resumed) { ... }` que trata `DONE`/`DONE_WITH_CONCERNS` e antes de `const cur = ...`: `const gap = testFirstGap(t, impl, resumed)` e `if (gap) return fail('conteudo', gap)` (R5 da spec: sem nova tentativa do implementador). A conferência roda uma vez por tarefa lançada e nunca nas rodadas de correção (o `reviewLoop` não a chama). Rodar `review.test.mjs`, `flow.test.mjs` (as fixtures do arnês não têm `testFirst` e não podem mudar de resultado) e o teste de tamanho. Commit `E9 T3: conferência antes do revisor`.

### Tarefa 4: Seis chamadas pelo implementer e texto movido para o agente

Teste primeiro em `workflow/prompts.test.mjs`, segunda parte do teste `AC3: implementer and fixer prompts cite no superpowers and forbid asking`: o texto de `roadmap-release.js` não contém `superpowers`; `schema: S_IMPL` aparece uma única vez, na linha de `const implAgent`, que contém `agentType: 'productivity-tools:implementer'`; há exatamente seis ocorrências de `implAgent(` além da definição, e os trechos de cada uma contêm os rótulos `:impl`, `-fix`, `final-fix`, `gates-fix`, `merge-fix` e `delta-fix`; o primeiro argumento de cada uma abre com o briefing (`buildImplPrompt(`, `` `${C()} `` ou `` `${Cn()} ``, conforme a chamada de hoje); e `P.buildImplPrompt(ctx, { ...task, testFirst: true })` traz a linha de teste primeiro, `P.buildImplPrompt(ctx, { ...task, testFirst: { exempt: 'only docs' } })` traz a isenção com `only docs`, e o prompt sem `testFirst` não traz nenhuma das duas. Rodar `prompts.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`:

- ao lado de `NO_ASK`: `const implAgent = (p, o) => agent(p, { agentType: 'productivity-tools:implementer', schema: S_IMPL, ...o })`;
- as seis chamadas passam por `implAgent`, sem `schema: S_IMPL` próprio e com `model`/`effort` de hoje (`implModel(t)`/`implEffort(t)`, `tier`/`effortFor(tier)`, `'sonnet'`/`'medium'`), rótulos e fases inalterados;
- sai de `buildImplPrompt`: `Follow TDD (superpowers:test-driven-development).`, o parágrafo `Report in "checks" EVERY verification...` e a linha `Status: ...`; entra uma linha curta: tarefa de teste primeiro (`testFirst === true`) ou isenta com o motivo (`testFirst.exempt`); sem linha quando o campo falta;
- corretor por tarefa: o texto longo de não editar spec e plano vira `${noSpecEdit()}`; saem `If you disagree technically with an item...` e `Report in "checks" every verification...`;
- `final-fix` e `delta-fix`: sai `If you disagree technically, do not apply the item and explain in concerns.`;
- `merge-fix`: sai `Use superpowers:systematic-debugging; ` (fica `fix on ${TARGET} with a test and commit "${E} merge-fix: ...". Do not mask failures. ${noSpecEdit()}`);
- `gates-fix`: sai `Use superpowers:systematic-debugging: ` (fica `root cause, a fix with a test when it is a defect, run the failed gate again and commit "${E} gates-fix: ..."` e a frase de não mascarar).

Nenhum prompt passa a interpolar `NO_ASK` (R7 da spec). Ajustar em `workflow/flow.test.mjs` o teste `B5: the count finding says what was expected, marks included, and a task fix may not edit the spec or the plan` para a forma de `noSpecEdit()` (`/Never edit the spec .* or the plan .* to satisfy a finding/`), sem perder a conferência; conferir que os asserts de `R3/I-2` seguem passando. Rodar `prompts.test.mjs`, `flow.test.mjs`, `review.test.mjs`, o teste de tamanho e G1. Se o tamanho passar do teto, parar com BLOCKED e ação do dono (C5). Commit `E9 T4: implementer nas seis chamadas`.

### Tarefa 5: Linha do agente no README do plugin e gates

Acrescentar na seção `## Agents` de `plugins/productivity-tools/README.md`, depois de `plan-author`, a linha do `implementer` (`agents/implementer.md`, sem `model`/`effort` fixos: cada chamada passa os da rota): implementa uma tarefa do plano ou corrige achados, nunca pergunta à pessoa, despachado pelo workflow do release com `agentType: 'productivity-tools:implementer'` nas seis chamadas de implementação e correção. Sem bump de versão (R9 da spec). Rodar G1, G2, G3 e G5. Commit `E9 T5: README do implementer`.

### Tarefa 6: Teste comportamental do implementer pelo orquestrador

Tarefa do orquestrador da sessão principal (DEC-204, R8 da spec), no worktree de E9 antes do merge. Um subagent sonnet segue `agents/implementer.md` literalmente no modo de implementação, numa tarefa de teste primeiro sobre uma fixture sintética marcada (`SYNTHETIC FIXTURE` no topo de cada arquivo) em `D:/projects/claude-play-wt/_tmp/E9-comportamental/impl/`; outro subagent sonnet segue o arquivo no modo de correção sobre uma lista de três achados sintéticos (um defeito real, um que pede editar o plano, um de que discorda) em `.../_tmp/E9-comportamental/fix/`; cada um lista as ambiguidades do arquivo. Uma revisão adversarial opus, só de leitura, confere: vermelho e verde do mesmo comando em ordem no `checks`; nenhuma pergunta à pessoa; o achado que pede editar o plano não aplicado e explicado em `concerns`; a discordância explicada. O relatório vai para `docs/reports/2026-11-12-E9-implementador-comportamental.md` com a saída literal, as ambiguidades e o veredito; a pasta temporária é apagada no fim. Ambiguidade real achada vira correção em `agents/implementer.md` numa rodada de correção desta tarefa, não reabre a spec.

Sem ferramenta de subagent (executor do workflow), a tarefa não roda: o implementador devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)" e não escreve relatório fictício. Evidência aceitável quando a execução não pode ocorrer neste ambiente: esse `NEEDS_HUMAN` com o motivo; nunca um relatório inventado. Commit `E9 T6: relatório comportamental do implementer`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC1: testFirstGap fails a test-first task without red before green` e `AC1: the test-first check runs before the first task reviewer and fails without a reviewer` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC2: testFirstGap passes resumed, unmarked, no-file and blocked tasks` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | `AC3: implementer and fixer prompts cite no superpowers and forbid asking` |

## Decisões do plano

- R11: seis tarefas na ordem agente -> função pura -> chamada -> troca das chamadas e remoção -> README -> comportamental.
- R12: o teste de ordem do critério 1 lê o texto do script, sem copiar o arnês de `flow.test.mjs`.
- R13: a mensagem de `testFirstGap` em inglês, como as demais mensagens de `fail` do script.
- R14: T6 sem subagent devolve `NEEDS_HUMAN` e não cria relatório.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E9",
  "title": "Implementador e corretor nativos",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ (só nos estágios de registro e docs, na release).",
    "Não aumentar MAX_WORKFLOW_CHARS nem editar workflow/size.test.mjs; se roadmap-release.js passar de 240000 caracteres LF, parar com BLOCKED e ação do dono (DEC-556, DEC-563, nota do dono).",
    "Não citar superpowers em agents/implementer.md nem em prompt do workflow; não trocar model/effort calculados pela rota (DEC-486, DEC-516, DEC-543).",
    "Não reaplicar a conferência de teste primeiro em rodadas de correção nem em tarefas retomadas.",
    "Sem bump de versão; sem push; nunca tocar em main nem no worktree D:/projects/claude-play.",
    "Execuções comportamentais que precisam de ferramenta de subagent são do orquestrador da sessão principal (DEC-204).",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;. Temporários só em D:/projects/claude-play-wt/_tmp/E9-*/, apagados no fim.",
    "Commits de tarefa começam com \"E9 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Agente implementer com modos de implementação e correção",
      "deps": [],
      "files": {
        "create": ["plugins/productivity-tools/agents/implementer.md"],
        "modify": [],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["agents/implementer.md (name: implementer; corpo com a frase de NO_ASK literal; modos de implementação e correção)"],
      "consumes": [],
      "covers": ["AC3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Conferência pura de teste primeiro e testFirst em tasksFromPlan",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["testFirstGap(task, impl, resumed) -> string", "tasksFromPlan(plan) -> tasks com testFirst"],
      "consumes": [],
      "covers": ["AC1", "AC2", "C1", "C2", "C3", "C4", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Chamada da conferência antes do primeiro revisor",
      "deps": [2],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["runDeliverable: fail('conteudo', testFirstGap(...)) antes do reviewLoop de spec"],
      "consumes": [{ "task": 2, "sig": "testFirstGap(task, impl, resumed) -> string" }],
      "covers": ["AC1", "AC2", "C2", "C4", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Seis chamadas pelo implementer e texto movido para o agente",
      "deps": [1, 3],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["implAgent(p, o) -> agent(p, { agentType: 'productivity-tools:implementer', schema: S_IMPL, ...o })"],
      "consumes": [
        { "task": 1, "sig": "agents/implementer.md (name: implementer; corpo com a frase de NO_ASK literal; modos de implementação e correção)" },
        { "task": 2, "sig": "tasksFromPlan(plan) -> tasks com testFirst" }
      ],
      "covers": ["AC3", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Linha do agente no README do plugin e gates",
      "deps": [1, 4],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/README.md"],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só documentação; os gates conferem o conjunto" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Teste comportamental do implementer pelo orquestrador",
      "deps": [4],
      "files": {
        "create": ["docs/reports/2026-11-12-E9-implementador-comportamental.md"],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "execução comportamental do orquestrador (DEC-204), sem código" },
      "checks": [
        { "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-12-E9-implementador-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }
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
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
      "testRef": "AC1: testFirstGap fails a test-first task without red before green; AC1: the test-first check runs before the first task reviewer and fails without a reviewer",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
      "testRef": "AC2: testFirstGap passes resumed, unmarked, no-file and blocked tasks",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
      "testRef": "AC3: implementer and fixer prompts cite no superpowers and forbid asking",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R11",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Seis tarefas: agente (T1), função pura e testFirst (T2), chamada no laço (T3), troca das seis chamadas e remoção de texto (T4), README e gates (T5), comportamental do orquestrador (T6); o agente vem antes da remoção para que o texto movido exista antes de sair do script.",
      "basis": "Ordem deixada para o plano pela spec; T2 a T4 editam o mesmo arquivo e ficam encadeadas; cada tarefa fica com até três arquivos.",
      "alternative": "Uma tarefa única para todo o roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Como o teste de ordem do critério 1 localiza a chamada no laço?",
      "decision": "Pelo texto de roadmap-release.js em review.test.mjs: índice de testFirstGap(t, impl, resumed) depois de closeEffect e antes do reviewLoop de spec, com return fail('conteudo' e sem agent( entre a chamada e esse return.",
      "basis": "A spec admite as duas formas; copiar o arnês de flow.test.mjs para review.test.mjs dobraria centenas de linhas de teste, e o comportamento da função já é coberto pelas chamadas diretas.",
      "alternative": "Copiar o arnês de flow.test.mjs e rodar uma tarefa testFirst com checks vazios.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Em que língua fica a mensagem de testFirstGap e o texto do agente?",
      "decision": "Inglês, como as demais mensagens de fail do script e os demais agentes do plugin (spec-author, plan-author).",
      "basis": "Consistência com o código existente; o texto exato foi deixado para o plano.",
      "alternative": "Português, como a prosa do roadmap.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "O que a tarefa comportamental faz quando roda num executor sem ferramenta de subagent?",
      "decision": "Devolve NEEDS_HUMAN com humanInputs citando a execução do orquestrador da sessão principal (DEC-204) e não escreve relatório.",
      "basis": "DEC-204 e a nota do dono: execuções comportamentais que precisam de subagent voltam ao orquestrador; um relatório sem execução seria aceite fictício.",
      "alternative": "Marcar a tarefa noCommit e deixar o relatório fora do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "O que fazer se uma tarefa intermediária passar do teto antes da remoção de T4?",
      "decision": "A tarefa pode adiantar, no mesmo commit, a remoção das frases da chamada que ela toca cujo equivalente já está no agente; se ainda assim não couber, BLOCKED com ação do dono, sem editar size.test.mjs.",
      "basis": "DEC-556, DEC-563 e a nota do dono fixam o teto; a folga é de 92 caracteres e T2/T3 só acrescentam.",
      "alternative": "Inverter a ordem e remover o texto antes de acrescentar a função.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
