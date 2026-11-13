# Plano E21 -- Revisor por tarefa com achados identificados

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E21/spec.md`. Worktree `D:/projects/claude-play-wt/E21`, branch `feat/E21`, portas 5200-5209 (nenhum servidor é necessário). Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main` nem em `D:/projects/claude-play`, sem bump de versão, sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (239.997 caracteres LF): dentro de `// <pure>` (linha 56), `sameFinding(prevIssues, issues, blqIds)` (~272), `fmt` (~370), `reviewTruth` (~378), `reviewModelFor` (~393), `runReviewLoop(env, stage, review, fix, truth, opt)` (~488; a nova revisão é `review(k + 1, fmt(iss), reviewer)` e a repetição é `sameFinding(fixable, iss, env.blqIds)`), `repeatRule` (~564), `fmtChecks` (~567), `buildTaskReviewPrompt(ctx, task, kind, impl)` (~571). Fora do bloco: `ISSUES` e `S_REVIEW` (~1373-1381), `CFG = A.config` (~1244), `NO_ASK` e `implAgent` (~1653-1654), `reviewLoop` de `runDeliverable` (~1776), `pluginRoot` (~2028), laço `for (const kind of ['spec', 'quality'])` com `agent(buildTaskReviewPrompt(...), { ..., schema: S_REVIEW, model: rvModel || reviewModelFor(t), effort: effortFor(...) })` (~2488-2501). As revisões de spec, plano, final, delta, merge e gates usam `S_REVIEW` e `repeatRule()` e não mudam.
- `workflow/load-pure.mjs` exporta as funções de topo do bloco `// <pure>`; `review.test.mjs` e `prompts.test.mjs` já usam `loadPure()` para `sameFinding`, `buildTaskReviewPrompt`, `repeatRule` e `runReviewLoop`.
- `workflow/prompts.test.mjs`: asserts sobre o texto que sai do prompt: `/SPEC/i`, `/QUALITY/i`, `/no checks/i` (~38-40), `shared lock` e `exact same file and description` (~119-124), `do not re-run a check with an external effect` (~190). Os dados (comandos, `exit`, saída, `abc123..HEAD`, achados anteriores) continuam no prompt.
- `workflow/flow.test.mjs`: arnês `exec({ cards, deliverables, config, over })` com `calls[].label/prompt/opts`; asserts sobre o prompt `E1:t1:spec1` (`awaiting person`, `rev-list --count L1..HEAD`, marcas) dependem de dados que ficam no prompt; ~3234 confere `WORKFLOW_SCRIPTS.includes('roadmap.mjs')`.
- `workflow/size.test.mjs`: `MAX_WORKFLOW_CHARS = 240000` e `workflowChars(text)`; não muda.
- `skills/roadmap-release/scripts/preflight.mjs`: `validateReleaseConfig` (~17), `WORKFLOW_SCRIPTS = ['roadmap.mjs']` (~189), `scriptRule` (~208), `requiredCommands` com `extras.scripts` (~252), montagem `WORKFLOW_SCRIPTS.map((name) => ({ name, path: tracker.path }))` (~408); `preflight.test.mjs` ~504 faz `deepEqual(WORKFLOW_SCRIPTS, ['roadmap.mjs'])`.
- `plugins/productivity-tools/agents/implementer.md` é o modelo de formato do agente; `plugins/productivity-tools/README.md` seção `## Agents` (linhas 28-32).

## Tamanho do script

Retomada (BLQ-10, nota do dono): T1-T7 estão commitadas e congeladas. Na ponta `50a80d0` de `feat/E21` o script mede 240.425 caracteres LF (425 acima do teto), porque a T5 (`f8df406`) abriu espaço encurtando comentários de outros estágios e a correção final `66afa1d` os restaurou. O commit `3b5c950` (o arnês de revisão por tarefa mede o `task-reviewer` real) fica. A nova Tarefa 9 libera o espaço só no texto da revisão por tarefa e vem antes da Tarefa 8 (comportamental), que roda sobre a nova ponta. A revisão final da branch inteira (opus, high) é o estágio final do workflow e se repete sobre a ponta nova; não é tarefa deste plano. A decisão do dono (R13 e R14 da spec) é gravada em `decisions.md` pelo estágio de registro do workflow, na release; esta branch não edita a pasta do roadmap.

Toda tarefa que edita `roadmap-release.js` mede depois de cada edição com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` (que usa `workflowChars`). A T2 é a primeira que edita o script: move o texto genérico de `buildTaskReviewPrompt`, a chamada a `repeatRule()` desse prompt e o texto de verificações vazias de `fmtChecks` para `agents/task-reviewer.md`, e troca o despacho por `revAgent`, antes de acrescentar qualquer outro código; relata a folga obtida. T3, T4 e T5 acrescentam o mínimo: as instruções dos modos ficam no agente, o prompt leva só uma linha curta de modo e os dados. Se em qualquer tarefa o total passar de 240.000, a tarefa para com `BLOCKED`, diz quantos caracteres passou e pede ação do dono; nunca edita `size.test.mjs` nem `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563, nota do dono, C5).

## Tarefas

### Tarefa 1: Script do pacote de revisão com teste

Não edita o workflow. Teste primeiro: criar `plugins/productivity-tools/scripts/review-package.test.mjs`, que cria um repositório git temporário em `os.tmpdir()` (`mkdtempSync`, `git init`, `git config user.email/user.name` locais, três commits) e roda o script por `execFileSync(process.execPath, [script, repo, base, tip, out])`. Testes:

- `AC4: review-package writes one file with the header and the diff of the range`: saída 0; JSON com `ok: true`, `path`, `base` e `tip` resolvidos (40 hex), `commits` igual a 2, `bytes` igual ao tamanho do arquivo; o arquivo tem as linhas de `git log --format=%h %s` do intervalo e o texto de `git diff base tip`; a pasta de `out` que faltava foi criada.
- `AC4: review-package refuses an unknown ref and a base that is not an ancestor, writing nothing`: ref inexistente e base posterior à ponta dão saída 1, `{"ok":false,"error":...}` no stdout e `out` inexistente.
- `AC4: review-package accepts an empty range` (base igual à ponta): saída 0, `commits: 0`, arquivo com o cabeçalho e sem diff.
- uso inválido (menos de quatro argumentos) sai com 2.

Rodar `node --test plugins/productivity-tools/scripts/review-package.test.mjs` e relatar a falha (script ausente). Implementar `plugins/productivity-tools/scripts/review-package.mjs` (R7 da spec): `node review-package.mjs <repo> <base> <tip> <out>`; git por `execFileSync('git', ['-C', repo, ...])`, sem shell; `rev-parse --verify <ref>^{commit}` para base e ponta; `merge-base --is-ancestor base tip`; só então `mkdirSync(dirname(out), { recursive: true })` e grava cabeçalho (base, ponta, log do intervalo) seguido de `git diff base tip`; imprime o JSON. Sem citar `superpowers`. Rodar o comando até passar. Commit `E21 T1: script do pacote de revisão`.

### Tarefa 2: Agente task-reviewer e despacho por revAgent liberando espaço

Teste primeiro em `workflow/prompts.test.mjs`, novo teste `AC5: task review prompts cite no superpowers and forbid asking` (primeira parte): lê `plugins/productivity-tools/agents/task-reviewer.md` (relativo ao teste: `../../../agents/task-reviewer.md`) e extrai `NO_ASK` do texto de `roadmap-release.js` por expressão regular sobre `const NO_ASK = '...'`; confere: frontmatter com `name: task-reviewer`, `description` que diz que nunca pergunta à pessoa e que só lê, `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort`; corpo sem `superpowers` e com a frase de `NO_ASK` literal; `roadmap-release.js` sem `superpowers`; `schema: S_TASKREVIEW` aparece só na linha de `const revAgent`, que contém `agentType: 'productivity-tools:task-reviewer'`; o prompt de `P.buildTaskReviewPrompt` em `spec` e `quality` abre com o briefing (`ctx.base`). Os asserts existentes sobre texto movido passam a conferir o agente sem perder o que conferem: `/SPEC/i` e `/QUALITY/i` continuam no prompt pela linha de modo; `no checks`, `shared lock`, `exact same file and description` e `do not re-run a check with an external effect` passam a ser lidos de `task-reviewer.md`; `P.repeatRule()` continua conferido (as outras revisões o usam). Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e relatar a falha.

Criar `agents/task-reviewer.md`, em inglês como os demais agentes, com: abertura (agente do plugin despachado por `agentType: 'productivity-tools:task-reviewer'`, revisão por tarefa só de leitura); a frase de `NO_ASK` literal; precedência do prompt da chamada; escolha do modo pela linha `Mode:` do prompt (`spec`, `quality`, `review`, e `restricted` numa nova revisão); só leitura e não confiar no relato do implementador, ler o código; a lista de bloqueio de `spec` e a de `quality` (texto de hoje de `buildTaskReviewPrompt`); reexecutar as verificações de que duvida, tratar divergência como defeito, sem reexecutar verificação que precisa de trava compartilhada (`shared lock`) nem com efeito externo; sem verificações relatadas (texto de hoje de `fmtChecks`: tarefa que se diz feita sem saída de verificação é defeito, salvo retomada); regra de `ambiente`; numeração dos achados (`id` `F1`, `F2`, ... por laço; achado ainda aberto da rodada anterior volta com o mesmo `id` mesmo reescrito e, quando possível, com o mesmo `file` e a mesma descrição (`exact same file and description`); achado novo recebe número novo); no modo `restricted`: rodar o comando do pacote dado no prompt, ler só esse diff e os achados abertos, devolver `verdicts` com `{ id, open }` para cada achado aberto e achados novos em `issues`; no modo `review`: julgar conformidade e qualidade numa chamada e devolver `spec` e `quality` (`pass` ou `fail`), com todo `fail` acompanhado de achado bloqueante; a medida (`headSha`, `clean`, `commitsInRange`).

Em `roadmap-release.js`: `S_TASKREVIEW` ao lado de `S_REVIEW` (estende com `verdicts: [{ id, open }]`, `spec` e `quality` em `['pass','fail']`, sem novos obrigatórios); ao lado de `implAgent`, `const revAgent = (p, o) => agent(p, { agentType: 'productivity-tools:task-reviewer', schema: S_TASKREVIEW, ...o })`; o despacho do laço por tarefa passa a `revAgent(...)` com `label`, `phase`, `model: rvModel || reviewModelFor(t)` e `effort: effortFor(...)` de hoje; `buildTaskReviewPrompt` fica com `briefing(ctx)`, a linha `Mode: spec` ou `Mode: quality` (com `SPEC`/`QUALITY`), tarefa, plano, spec, intervalo, `rangeNote`, resumo e verificações do implementador, achados anteriores (sem `repeatRule()`) e a linha `Measure:`; `fmtChecks` sem verificações devolve um marcador curto (`(no checks reported)`). `ISSUES`, `sameFinding`, `implAgent`, `testFirstGap`, `MAXFIX`, `reviewModelFor` e `effortFor` não mudam nesta tarefa. Rodar `prompts.test.mjs`, `flow.test.mjs`, `review.test.mjs` e o teste de tamanho; relatar a folga. Commit `E21 T2: agente task-reviewer e despacho por revAgent`.

### Tarefa 3: Identificadores nos achados e repetição por id no laço por tarefa

Teste primeiro em `workflow/review.test.mjs` (por `loadPure()`):

- `AC1: sameFinding with byId treats the same id with other wording as a repeat`: `sameFinding([{ severity: 'critical', id: 'F1', file: 'a.js', description: 'null deref' }], [{ severity: 'critical', id: 'F1', file: 'a.js', description: 'foo may dereference null' }], new Set(), true)` é `true`; sem `byId` é `false`; achado sem `id` com `byId` cai na comparação de arquivo e texto de hoje (mesma redação `true`, outra `false`); ids diferentes com `byId` e redação diferente `false`.
- `AC1: fmt writes the id before the description`: `fmt([{ severity: 'critical', category: 'defeito', id: 'F2', file: 'a.js', description: 'x' }])` contém `[F2] x`; achado sem `id` sai como hoje.
- `AC1: runReviewLoop escalates the fixer when a finding returns with the same id and other wording` (C1): revisores simulados devolvem `F1` com redação nova na segunda rodada; com `opt.byId: true` e `tier: 'sonnet'` o segundo corretor recebe `opus`; sem `byId` o tier não sobe.
- texto do script: no corpo de `runDeliverable`, o `reviewLoop` do laço por tarefa recebe `byId: true`; os `reviewLoop` de `spec`, `plan`, `final` e `delta` não.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e relatar a falha. Implementar: `ISSUES` ganha `id: STR` opcional; `sameFinding(prevIssues, issues, blqIds, byId)` compara `p.id === i.id` quando `byId` e os dois têm `id`, senão como hoje; `runReviewLoop` repassa `opt.byId`; `fmt` escreve `[<id>] ` antes da descrição quando há `id`; o laço por tarefa passa `byId: true` no `opt`. Rodar `review.test.mjs`, `prompts.test.mjs`, `flow.test.mjs` e o teste de tamanho (BLOCKED se passar). Commit `E21 T3: achados com identificador`.

### Tarefa 4: Modo de revisão restrita desligado por padrão

Teste primeiro em `workflow/review.test.mjs`:

- `AC2: by default a re-review rereads the whole task range`: `buildTaskReviewPrompt(ctx com prev e round 2, task, 'spec', impl)` com `ctx.taskReview` ausente ou `{ restricted: false }` contém `log -p <start>..HEAD` e os achados anteriores, e não contém `review-package.mjs`.
- `AC2: the restricted re-review gets only the open findings and the fix diff`: com `restricted: true`, `ctx.prevIss` todos com `id` e `ctx.prevHead` `h1`, o prompt contém `Mode: restricted`, os achados com `[F1]`, `node "<pluginRoot>/scripts/review-package.mjs" "<wt>" h1 HEAD "<WT>/_tmp/<E>-t<n>-spec2.diff"` e não contém `log -p <start>..HEAD`; com um achado aberto sem `id` (C2) volta ao prompt padrão.
- `AC2: taskIssues keeps open and missing verdicts and drops closed ones` (C3): `taskIssues({ issues: [novo], verdicts: [{ id: 'F1', open: true }, { id: 'F2', open: false }] }, { restricted: true, prev: [F1, F2, F3] })` devolve o novo, `F1` e `F3` (veredicto ausente conta como aberto), sem duplicar por `id`; fora do modo restrito devolve `r.issues`.
- texto do script: o laço por tarefa lê `CFG.taskReview` com `=== true` e só passa o modo restrito quando `restricted === true`.

Estender em `workflow/prompts.test.mjs` o teste `AC5: task review prompts cite no superpowers and forbid asking` (mesmo nome, que é a evidência do AC5) com o modo restrito: `P.buildTaskReviewPrompt` com `restricted: true`, `prev` presente e todo achado aberto com `id` abre com o briefing (`ctx.base`), contém `Mode: restricted` e não contém `superpowers`; o mesmo prompt com `restricted` ausente (padrão) continua abrindo com o briefing.

Teste complementar em `workflow/flow.test.mjs` (arnês `exec`): tarefa com achado `F1` na primeira revisão e correção; com `config: { taskReview: { restricted: true } }` o prompt de `E1:t1:spec2` contém `review-package.mjs`; sem a configuração não contém e traz o `log -p` do intervalo.

Rodar `review.test.mjs` e `prompts.test.mjs` e relatar a falha. Implementar: `runReviewLoop` passa à nova revisão um quarto argumento `{ iss, head: r.headSha }` (achados da rodada anterior e ponta medida); função pura `taskIssues(r, opt)` no bloco `// <pure>`; `buildTaskReviewPrompt` usa a linha `Mode: restricted`, os achados abertos (`fmt`) e o comando do pacote quando `ctx.taskReview.restricted === true`, há `prev` e todo achado aberto tem `id`; senão o prompt de hoje; o laço por tarefa calcula o modo a partir de `CFG.taskReview` com `=== true`, passa `pluginRoot`, `prevIss`, `prevHead` e o caminho do diff em `<WT>/_tmp/<E>-t<n>-<kind><round>.diff`, e o `truth` passa a ser `r => reviewTruth({ ...r, issues: taskIssues(r, ...) }, ...)`. Rodar `review.test.mjs`, `prompts.test.mjs`, `flow.test.mjs` e o teste de tamanho (BLOCKED se passar). Commit `E21 T4: revisão restrita`.

### Tarefa 5: Modo de revisão única desligado por padrão

Teste primeiro em `workflow/review.test.mjs`:

- `AC3: by default each task gets the spec and quality reviews on today's model`: texto do script: o laço por tarefa usa `['spec', 'quality']` quando `taskReview.single !== true` e `['review']` só com `=== true`; o despacho é `revAgent(` com `model: rvModel || reviewModelFor(t)` e `effort: effortFor(rvModel || reviewModelFor(t))`.
- `AC3: taskIssues fails a single review with a missing or failing verdict without a blocking finding`: com `single: true`, `{ issues: [], spec: 'pass' }` (falta `quality`) e `{ issues: [], spec: 'pass', quality: 'fail' }` devolvem um achado `critical`/`defeito`; `{ issues: [], spec: 'pass', quality: 'pass' }` devolve `[]`; `fail` com achado bloqueante não acrescenta outro.
- `AC3: the single review prompt asks for both verdicts`: `buildTaskReviewPrompt(ctx, task, 'review', impl)` contém `Mode: review` e abre com o briefing.

Estender em `workflow/prompts.test.mjs` o teste `AC5: task review prompts cite no superpowers and forbid asking` (mesmo nome) com o modo único: `P.buildTaskReviewPrompt(ctx, task, 'review', impl)` abre com o briefing (`ctx.base`) e não contém `superpowers`. Com isso o teste do AC5 cobre os quatro prompts (`spec`, `quality`, restrito e `review`).

Teste complementar em `workflow/flow.test.mjs` (arnês `exec`): na configuração padrão os rótulos `E1:t1:spec1` e `E1:t1:quality1`, com `opts.agentType === 'productivity-tools:task-reviewer'` e `opts.model` igual a `reviewModelFor` da tarefa; com `config: { taskReview: { single: true } }` só `E1:t1:review1`, com o mesmo modelo, e o corretor rotulado `E1:t1:review-fix1`.

Rodar `review.test.mjs` e `prompts.test.mjs` e relatar a falha. Implementar: `const kinds = CFG.taskReview && CFG.taskReview.single === true ? ['review'] : ['spec', 'quality']` no laço por tarefa; `buildTaskReviewPrompt` com `Mode: review` para `kind === 'review'`; `taskIssues` acrescenta o achado crítico `defeito` quando falta `spec` ou `quality`, ou um deles é `fail` sem achado bloqueante (R6); o corretor é o `implAgent` de hoje com `kind` `review` no texto e no rótulo, sem mudar `implAgent` nem `agents/implementer.md`. Rodar `review.test.mjs`, `prompts.test.mjs`, `flow.test.mjs` e o teste de tamanho (BLOCKED se passar). Commit `E21 T5: revisão única`.

### Tarefa 6: Preflight valida taskReview e regra do script do pacote

Teste primeiro em `skills/roadmap-release/scripts/preflight.test.mjs`: `validateReleaseConfig` aceita `taskReview` ausente e `{ restricted: true, single: false }`, e recusa `taskReview: true`, `[]` e `{ restricted: 'yes' }` com mensagem que cita `taskReview`; `WORKFLOW_SCRIPTS` passa a `['roadmap.mjs', 'review-package.mjs']` (ajuste do `deepEqual` de ~504); a lista de regras exigidas inclui `scriptRule('review-package.mjs')`, com caminho `<raiz do plugin>/scripts/review-package.mjs` derivado do caminho do tracker, só quando `taskReview.restricted === true`, e não a inclui na configuração padrão. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e relatar a falha.

Implementar em `preflight.mjs`: validação de `taskReview` (objeto, campos `restricted` e `single` booleanos quando presentes); `WORKFLOW_SCRIPTS` com `review-package.mjs`; a montagem de `extras.scripts` deriva o caminho de cada script (`roadmap.mjs` do tracker, `review-package.mjs` da raiz do plugin) e filtra `review-package.mjs` quando `config.taskReview?.restricted !== true` (R8). Documentar o campo em `references/config.md` (ausente vale falso; `restricted` e `single`; E27 decide ligar; a regra do script entra só com `restricted`). Conferir que o teste de `flow.test.mjs` ~3234 segue passando. Rodar `preflight.test.mjs` e `flow.test.mjs`. Commit `E21 T6: preflight do taskReview`.

### Tarefa 7: Linha do agente no README do plugin e gates

Acrescentar na seção `## Agents` de `plugins/productivity-tools/README.md`, depois de `implementer`, a linha do `task-reviewer` (`agents/task-reviewer.md`, sem `model`/`effort` fixos: cada chamada passa os de hoje): revisa uma tarefa só lendo, devolve achados com identificador, nunca pergunta à pessoa, despachado pelo workflow do release com `agentType: 'productivity-tools:task-reviewer'` em toda revisão por tarefa. Sem bump de versão (R12). Rodar G1, G2, G3 e G5 e o teste de tamanho. Commit `E21 T7: README do task-reviewer`.

### Tarefa 8: Teste comportamental do task-reviewer pelo orquestrador

Tarefa do orquestrador da sessão principal (DEC-204, R11 da spec), no worktree de E21 antes do merge, depois da Tarefa 9 e sobre a ponta que ela deixou (agente e prompt já com os rótulos movidos). Três subagents sonnet seguem `agents/task-reviewer.md` literalmente sobre uma fixture sintética marcada (`SYNTHETIC FIXTURE` no topo de cada arquivo; repositório git com uma tarefa, um defeito plantado e uma correção) em `D:/projects/claude-play-wt/_tmp/E21-comportamental/`, um por modo: padrão (`spec` e `quality`), restrito (com o pacote gerado por `review-package.mjs` e dois achados abertos `F1` e `F2`, um corrigido) e único; cada um lista as ambiguidades do arquivo. Uma revisão adversarial opus, só de leitura, confere: nenhuma pergunta à pessoa; achado reaberto com o mesmo `id`; `verdicts` com um `{ id, open }` por achado aberto no modo restrito; `spec` e `quality` no modo único; nenhuma escrita na fixture. O relatório vai para `docs/reports/2026-11-12-E21-revisor-comportamental.md` com a saída literal, as ambiguidades e o veredito; a pasta temporária é apagada no fim. Ambiguidade real vira correção em `agents/task-reviewer.md` numa rodada de correção desta tarefa, sem reabrir a spec.

Sem ferramenta de subagent (executor do workflow), a tarefa não roda: o implementador devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)" e não escreve relatório fictício. Evidência aceitável quando a execução não pode ocorrer neste ambiente: esse `NEEDS_HUMAN` com o motivo; nunca um relatório inventado. Commit `E21 T8: relatório comportamental do task-reviewer`.

### Tarefa 9: Liberar espaço no texto da revisão por tarefa (retomada de BLQ-10)

Roda no worktree `D:/projects/claude-play-wt/E21`, em `feat/E21` a partir de `50a80d0`, sem navegador. Meta: `workflowChars(roadmap-release.js) <= 240000` (hoje 240.425; liberar pelo menos 425 caracteres). Só pode mexer, em `roadmap-release.js`, em `restrictedRound`, `taskIssues`, `buildTaskReviewPrompt`, no laço `for (const kind of ...)` de `runDeliverable` (linhas ~2504-2522) e nos comentários deles. É proibido tocar comentário ou texto de outro estágio, `fmt`, `fmtChecks`, `repeatRule`, `size.test.mjs` ou `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563, DEC-592). Medir com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` depois de cada edição do script e anotar o total no relato.

Teste primeiro: em `workflow/prompts.test.mjs`, no teste `AC5: task review prompts cite no superpowers and forbid asking` (mesmo nome), acrescentar que `agents/task-reviewer.md` explica a linha `Range:` (comando do intervalo ou do pacote a rodar), a linha `Measure:` com `headSha`, `clean` e `commitsInRange`, o bloco das verificações do implementador e o dos achados da rodada anterior; e que o prompt de `P.buildTaskReviewPrompt` em `spec`, `quality`, restrito e `review` ainda traz os dados (o comando `log -p <start>..HEAD` ou o do pacote, a saída das verificações, os achados anteriores com `[F1]`, `rev-list --count <start>..HEAD`) e não traz mais o rótulo `IMPLEMENTER'S CHECKS` nem `Issues from the previous round`. Em `workflow/review.test.mjs`, ajustar o teste `AC2: the per-task loop turns the restricted mode on only when taskReview.restricted is true` (hoje `/taskReview: CFG\.taskReview/` e `/taskReview\.restricted === true/`, ~591-598) e o equivalente de T5 para conferir a normalização única (`CFG.taskReview` lido com `restricted === true` e `single === true` uma vez em `runDeliverable`, `ctxFor` recebendo o objeto normalizado, o laço usando o booleano pronto), sem perder o que conferem: padrão desligado e valor que não seja `true` não liga. Os casos que hoje passam valor não booleano direto às funções puras (`{ restricted: 'yes' }` ~556, `{ single: 'true' }` ~635) passam a ser conferidos pela normalização (texto do script e `flow.test.mjs` ~4149, que já roda `restricted: 'true'` ponta a ponta), porque as funções puras passam a receber booleanos prontos; o caso `undefined` e `{ restricted: false }` continua nas funções puras. Rodar `prompts.test.mjs` e `review.test.mjs` e relatar a falha.

Implementar, nesta ordem, medindo depois de cada passo:

1. `agents/task-reviewer.md`: parágrafo curto sobre o formato do prompt da chamada (`Mode:`, `Range:` = comando a rodar para ler o intervalo ou o pacote, verificações do implementador, achados da rodada anterior, `Measure:` = devolver `headSha`, `clean` e `commitsInRange` pelo comando dado).
2. `buildTaskReviewPrompt`: tirar os rótulos e instruções genéricos (`IMPLEMENTER'S CHECKS:`, `Issues from the previous round:`, a lista `headSha, clean, commitsInRange` da linha `Measure:`), deixando só os dados com marcadores curtos; chamar `restrictedRound(ctx)` uma vez.
3. Normalizar uma vez em `runDeliverable`: `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }`; o laço usa `TR.single`, `ctxFor` recebe `taskReview: TR`, e `restrictedRound`/`taskIssues` leem `restricted` e `single` já booleanos, sem repetir `=== true`, tolerando `taskReview` ausente (os testes puros o omitem).
4. Encurtar a mensagem do achado crítico do modo único (manter `single review` e `spec`/`quality` no texto, que os testes de T5 conferem) e os comentários sobre `restrictedRound` e `taskIssues`.

Rodar `prompts.test.mjs`, `review.test.mjs`, `flow.test.mjs` e o teste de tamanho. Conferir com `git -C D:/projects/claude-play-wt/E21 diff 50a80d0 -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` que todo trecho alterado fica dentro das funções e do laço listados. Commit `E21 T9: libera espaço na revisão por tarefa`.

Caminho de reversão (R14 da spec, C5): se, esgotado esse texto, o total ainda passar de 240.000, reverter só o código da T5 (`f8df406`) em `roadmap-release.js` e nos testes (`review.test.mjs`, `prompts.test.mjs`, `flow.test.mjs`): o laço volta a `['spec', 'quality']` fixo, `taskIssues` perde a reprovação de veredicto do modo único, `buildTaskReviewPrompt` perde o modo `review`, e saem os testes `AC3` de T5 e a extensão do AC5 para o modo único. Ficam a revisão restrita, o agente (o texto do modo `review` no agente fica, sem uso), `S_TASKREVIEW`, o preflight e `config.md` (fora de "script e testes"). Medir de novo; commitar `E21 T9: reverte o modo único da T5 (AC3 adiado)` e devolver `BLOCKED` parcial com o total medido, o AC3 (parte do modo único) adiado para card novo e a pendência de `taskReview.single` aceito pelo preflight e documentado sem efeito, para o dono. Se nem assim couber, `BLOCKED` com o total, sem outra edição. Nunca editar `size.test.mjs`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC1: sameFinding with byId treats the same id with other wording as a repeat`, `AC1: fmt writes the id before the description`, `AC1: runReviewLoop escalates the fixer when a finding returns with the same id and other wording` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC2: by default a re-review rereads the whole task range`, `AC2: the restricted re-review gets only the open findings and the fix diff`, `AC2: taskIssues keeps open and missing verdicts and drops closed ones` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC3: by default each task gets the spec and quality reviews on today's model`, `AC3: taskIssues fails a single review with a missing or failing verdict without a blocking finding`, `AC3: the single review prompt asks for both verdicts` |
| AC4 | test | `node --test plugins/productivity-tools/scripts/review-package.test.mjs` | `AC4: review-package writes one file with the header and the diff of the range`, `AC4: review-package refuses an unknown ref and a base that is not an ancestor, writing nothing`, `AC4: review-package accepts an empty range` |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | `AC5: task review prompts cite no superpowers and forbid asking` |

## Decisões do plano

- R13: oito tarefas na ordem pacote -> agente e despacho (libera espaço) -> identificadores -> restrito -> único -> preflight -> README -> comportamental.
- R14: os testes dos critérios 2 e 3 em `review.test.mjs` usam funções puras e o texto do script; o arnês de `flow.test.mjs` recebe testes complementares do despacho, sem copiar o arnês.
- R15: o agente nasce na T2 com o texto de todos os modos; T3-T5 só ligam o código.
- R16: T8 sem subagent devolve `NEEDS_HUMAN` e não cria relatório.
- R18: retomada de BLQ-10 como Tarefa 9 depois da T7; a T8 passa a depender da T9.
- R19: `taskReview` normalizado uma vez; a garantia de "só `true` liga" passa ao teste da normalização e ao `flow.test.mjs`.
- R20: no caminho de reversão, `single` fica no preflight, em `config.md` e no agente; o BLOCKED parcial cita a pendência.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E21",
  "title": "Revisor por tarefa com achados identificados",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ (só nos estágios de registro e docs, na release).",
    "Não aumentar MAX_WORKFLOW_CHARS nem editar workflow/size.test.mjs; medir roadmap-release.js com workflowChars depois de cada edição; se passar de 240000 caracteres LF, parar com BLOCKED e ação do dono (DEC-556, DEC-563, nota do dono).",
    "A primeira tarefa que edita roadmap-release.js (T2) move o texto genérico da revisão por tarefa para agents/task-reviewer.md antes de acrescentar código.",
    "Modos taskReview.restricted e taskReview.single desligados por padrão (ausente vale falso, lido com === true); padrão: dois laços spec e quality no modelo de hoje (DEC-021, DEC-543); não mudar reviewModelFor, effortFor nem MAXFIX.",
    "Não mudar implAgent, testFirstGap nem agents/implementer.md (DEC-569); as revisões de spec, plano, final, delta, merge e gates seguem com S_REVIEW e repeatRule().",
    "Não citar superpowers no agente, no script nem em prompt.",
    "Sem bump de versão; sem push; nunca tocar em main nem no worktree D:/projects/claude-play.",
    "Execução comportamental que precisa de ferramenta de subagent é do orquestrador da sessão principal (DEC-204); sem relatório fictício.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;. Temporários só em D:/projects/claude-play-wt/_tmp/E21-*/, apagados no fim.",
    "Commits de tarefa começam com \"E21 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash.",
    "Retomada de BLQ-10 na ponta 50a80d0 de feat/E21, mantendo 3b5c950; T1-T7 commitadas e congeladas.",
    "A T9 só edita restrictedRound, taskIssues, buildTaskReviewPrompt, o laço kind de runDeliverable e seus comentários em roadmap-release.js; nunca comentário ou texto de outro estágio (DEC-556, DEC-563, DEC-592).",
    "Se a T9 não chegar a 240000 caracteres LF, reverter só o código da T5 (f8df406) no script e nos testes, manter a revisão restrita e o agente, AC3 adiado para card novo e BLOCKED parcial para o dono (R14 da spec).",
    "A decisão do dono vai para decisions.md pelo estágio de registro do workflow, na release; a revisão final (opus, high) da branch inteira é o estágio final do workflow e se repete sobre a nova ponta."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Script do pacote de revisão com teste",
      "deps": [],
      "files": {
        "create": ["plugins/productivity-tools/scripts/review-package.mjs"],
        "modify": [],
        "test": ["plugins/productivity-tools/scripts/review-package.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": ["node review-package.mjs <repo> <base> <tip> <out> -> stdout {ok,path,base,tip,commits,bytes} | exit 1 {ok:false,error} | exit 2 uso"],
      "consumes": [],
      "covers": ["AC4", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/scripts/review-package.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Agente task-reviewer e despacho por revAgent liberando espaço",
      "deps": [],
      "files": {
        "create": ["plugins/productivity-tools/agents/task-reviewer.md"],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": [
        "agents/task-reviewer.md (name: task-reviewer; frase de NO_ASK literal; modos spec, quality, review e restricted)",
        "revAgent(p, o) -> agent(p, { agentType: 'productivity-tools:task-reviewer', schema: S_TASKREVIEW, ...o })",
        "S_TASKREVIEW = S_REVIEW + { verdicts: [{ id, open }], spec, quality }"
      ],
      "consumes": [],
      "covers": ["AC5", "AC3", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Identificadores nos achados e repetição por id no laço por tarefa",
      "deps": [2],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["sameFinding(prevIssues, issues, blqIds, byId) -> boolean", "runReviewLoop opt.byId"],
      "consumes": [{ "task": 2, "sig": "revAgent(p, o) -> agent(p, { agentType: 'productivity-tools:task-reviewer', schema: S_TASKREVIEW, ...o })" }],
      "covers": ["AC1", "C1", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
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
      "title": "Modo de revisão restrita desligado por padrão",
      "deps": [1, 3],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["taskIssues(r, opt) -> issues", "runReviewLoop: review(round, prev, model, { iss, head })"],
      "consumes": [
        { "task": 1, "sig": "node review-package.mjs <repo> <base> <tip> <out> -> stdout {ok,path,base,tip,commits,bytes} | exit 1 {ok:false,error} | exit 2 uso" },
        { "task": 3, "sig": "sameFinding(prevIssues, issues, blqIds, byId) -> boolean" }
      ],
      "covers": ["AC2", "AC5", "C2", "C3", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Modo de revisão única desligado por padrão",
      "deps": [4],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["laço por tarefa com kinds ['review'] quando taskReview.single === true"],
      "consumes": [{ "task": 4, "sig": "taskIssues(r, opt) -> issues" }],
      "covers": ["AC3", "AC5", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Preflight valida taskReview e regra do script do pacote",
      "deps": [1, 5],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs",
          "plugins/productivity-tools/skills/roadmap-release/references/config.md"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["WORKFLOW_SCRIPTS = ['roadmap.mjs', 'review-package.mjs']", "validateReleaseConfig recusa taskReview inválido"],
      "consumes": [],
      "covers": ["AC2", "AC4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "Linha do agente no README do plugin e gates",
      "deps": [2, 6],
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
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Teste comportamental do task-reviewer pelo orquestrador",
      "deps": [9],
      "files": {
        "create": ["docs/reports/2026-11-12-E21-revisor-comportamental.md"],
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
        { "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-12-E21-revisor-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 9,
      "title": "Liberar espaço no texto da revisão por tarefa (retomada de BLQ-10)",
      "deps": [7],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/agents/task-reviewer.md",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "roadmap-release.js com workflowChars <= 240000 (ou BLOCKED parcial com o modo único da T5 revertido)",
        "TR = { restricted: tr.restricted === true, single: tr.single === true } normalizado uma vez em runDeliverable",
        "agents/task-reviewer.md explica as linhas Mode, Range e Measure e os blocos de verificações e achados anteriores"
      ],
      "consumes": [
        { "task": 4, "sig": "taskIssues(r, opt) -> issues" },
        { "task": 5, "sig": "laço por tarefa com kinds ['review'] quando taskReview.single === true" }
      ],
      "covers": ["AC2", "AC3", "AC5", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
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
      "testRef": "AC1: sameFinding with byId treats the same id with other wording as a repeat; AC1: fmt writes the id before the description; AC1: runReviewLoop escalates the fixer when a finding returns with the same id and other wording",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
      "testRef": "AC2: by default a re-review rereads the whole task range; AC2: the restricted re-review gets only the open findings and the fix diff; AC2: taskIssues keeps open and missing verdicts and drops closed ones",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
      "testRef": "AC3: by default each task gets the spec and quality reviews on today's model; AC3: taskIssues fails a single review with a missing or failing verdict without a blocking finding; AC3: the single review prompt asks for both verdicts",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC4",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/review-package.test.mjs",
      "testRef": "AC4: review-package writes one file with the header and the diff of the range; AC4: review-package refuses an unknown ref and a base that is not an ancestor, writing nothing; AC4: review-package accepts an empty range",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC5",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
      "testRef": "AC5: task review prompts cite no superpowers and forbid asking",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R13",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Oito tarefas: script do pacote com teste (T1, não edita o workflow); agente e despacho por revAgent, movendo o texto genérico e liberando espaço (T2); identificadores (T3); revisão restrita (T4); revisão única (T5); preflight e config.md (T6); README e gates (T7); comportamental do orquestrador (T8). T2-T5 editam roadmap-release.js e ficam encadeadas.",
      "basis": "Ordem deixada para o plano pela spec e pedida pela nota do dono: a primeira tarefa que edita o script libera espaço antes de acrescentar código; cada tarefa fica com até quatro arquivos.",
      "alternative": "Uma tarefa única para todo o roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "Como os testes dos critérios 2 e 3 localizam o despacho no laço por tarefa?",
      "decision": "Em review.test.mjs (comando da marca), por funções puras (buildTaskReviewPrompt, taskIssues, runReviewLoop) e pelo texto de runDeliverable (taskReview lido com === true, kinds, revAgent com reviewModelFor e effortFor); o arnês exec de flow.test.mjs recebe testes complementares dos rótulos, agentType, modelo e do prompt restrito, sem copiar o arnês para review.test.mjs.",
      "basis": "A spec admite as duas formas; copiar o arnês dobraria centenas de linhas; o comportamento ponta a ponta fica coberto pelo arnês existente, que já aceita config.",
      "alternative": "Copiar o arnês de flow.test.mjs para review.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "Quando o agente recebe o texto dos modos restrito e único?",
      "decision": "Na T2, com o texto de todos os modos e da numeração dos identificadores; T3-T5 só ligam o código e ajustam o agente se o teste da tarefa pedir. A regra de repetição no agente diz reusar o mesmo id mesmo reescrito e, quando possível, o mesmo file e a mesma descrição, o que vale antes e depois da T3.",
      "basis": "O teto exige que o texto saia do script antes de entrar código (nota do dono, R9); escrever o agente uma vez evita retrabalho; o assert existente de repetição exata passa a conferir o agente sem perder o que confere.",
      "alternative": "Acrescentar ao agente o texto de cada modo na tarefa que liga o modo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R16",
      "question": "O que a tarefa comportamental faz num executor sem ferramenta de subagent?",
      "decision": "Devolve NEEDS_HUMAN com humanInputs citando a execução do orquestrador da sessão principal (DEC-204) e não escreve relatório.",
      "basis": "DEC-204, R11 da spec e a nota do dono: um relatório sem execução seria aceite fictício.",
      "alternative": "Marcar a tarefa noCommit e deixar o relatório fora do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R17",
      "question": "O que fazer se, depois de liberar espaço na T2, T3-T5 não couberem sob o teto?",
      "decision": "Cada tarefa mede depois de cada edição; instruções de modo ficam no agente e o prompt leva só a linha Mode e os dados; se ainda assim passar de 240000 caracteres LF, a tarefa para com BLOCKED, diz quantos caracteres passou e pede ação do dono, sem editar size.test.mjs nem encurtar outros estágios.",
      "basis": "DEC-556, DEC-563 e a nota do dono fixam o teto e mandam BLOCKED com ação do dono; a T2 libera perto de 1.100 caracteres líquidos e T3-T5 acrescentam valor parecido.",
      "alternative": "Encurtar textos de outros estágios do workflow.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R18",
      "question": "Como a retomada de BLQ-10 entra no plano com T1-T7 congeladas?",
      "decision": "Nova Tarefa 9 (liberar espaço no texto da revisão por tarefa, com o caminho de reversão da T5) logo depois da T7; a T8 (comportamental, ainda não commitada) passa a depender da T9 e roda sobre a nova ponta; a revisão final é o estágio do workflow, não tarefa. A T9 lista cinco arquivos (aviso task-too-wide aceito): flow.test.mjs só muda no caminho de reversão, que a nota do dono põe na mesma tarefa da medição.",
      "basis": "Nota do dono (decisão delegada), R13 e R14 da spec; tarefa nova recebe número maior que o maior existente; o comportamental deve medir o agente e o prompt finais.",
      "alternative": "Reescrever a T5 ou a T2.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R19",
      "question": "Como os testes ficam com taskReview normalizado uma vez em runDeliverable?",
      "decision": "As funções puras recebem booleanos prontos e toleram taskReview ausente; a garantia de que só true liga passa ao teste de texto da normalização em review.test.mjs e ao teste ponta a ponta de flow.test.mjs com restricted: 'true'.",
      "basis": "R13 da spec manda normalizar uma vez e não repetir === true; manter o === true nas funções puras anularia a economia.",
      "alternative": "Manter === true também nas funções puras.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R20",
      "question": "No caminho de reversão, o que acontece com taskReview.single no preflight, em config.md e no agente?",
      "decision": "Ficam como estão (a nota do dono limita a reversão ao script e aos testes); o BLOCKED parcial cita a pendência de single aceito e documentado sem efeito para o card novo decidir.",
      "basis": "Nota do dono: reverter só o código da T5 no script e nos testes, manter restrita e agente.",
      "alternative": "Tirar single também do preflight e de config.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
