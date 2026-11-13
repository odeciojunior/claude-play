# Spec E12 -- Coordinator como workflow do plugin

## Intenção

Hoje o plan-coordinator roda o laço de ondas na sessão principal: a cada passo a sessão lê `next`, monta o prompt, despacha o `Agent`, confere o relatório e grava o evento com `progress.mjs apply`, carregando antes `SKILL.md`, o protocolo de delegação e as regras de roteamento. O contexto principal é a maior parcela do custo do coordinator (SRC-02 §9A, 42 a 45%). E12 (REQ-010, REQ-017, REQ-033; segunda etapa de DEC-006) leva esse laço para um workflow do plugin, `productivity-tools:coordinator-workflow` (DEC-041): o script guarda o laço e os resultados intermediários, despacha o implementador de E9 e o revisor de E21, valida cada retorno por esquema e decide com as funções de estado (`lib/progress-state.mjs`, DEC-385), de resumo (`lib/plan-digest.mjs`) e de autorização embutidas pelo gerador de E2 (`scripts/embed.mjs`, DEC-058). A sessão principal fica com uma entrada curta: escolher o plano, criar o estado, lançar o workflow pelo nome e repassar as paradas. A meta de chamadas da sessão principal na variante coordinator é 0 (DEC-281, conferida em E13); a meta de prosa é derivada aqui (R9).

## Escopo

Dentro:

- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` (novo): o workflow, com `meta.name = 'coordinator-workflow'`, registrado em `plugins/productivity-tools/.claude-plugin/plugin.json` (`workflows` ganha `./skills/plan-coordinator/workflow/coordinator.js`); testes em `workflow/flow.test.mjs` (novo), `workflow/gate.test.mjs` (novo, decisão do portão de onda), `workflow/size.test.mjs` (novo) e a fixture `workflow/fixtures/two-waves/plan.md` (novo, plano `plan/1` sintético marcado como fixture).
- `plugins/productivity-tools/lib/external-auth.mjs` (novo): `parseAuthorizeExternal`, `isAuthorized`, `externalHold` e `bindAuthorizations` movidas sem mudança de texto de `roadmap-release.js`, que passa a recebê-las por bloco `// <embed ... exports="strip">` dentro do seu `// <pure>` (R3).
- `plugins/productivity-tools/lib/progress-state.mjs`: evento `baseline`, campo `handoff` no evento `report` e a função `applyEvents` (lote atômico), aditivos ao esquema `progress/1` (DEC-423); testes em `skills/plan-coordinator/scripts/progress.test.mjs`.
- `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs`: comandos `token` e `read`, e `apply --events` com saída assinada (R4), com testes em `progress.test.mjs`.
- `plugins/productivity-tools/skills/plan-coordinator/SKILL.md` reescrita como entrada curta (descrição sem mudança, R8); `references/delegation-protocol.md` reduzido ao que o workflow não cobre; `references/state.md` com `gated`, `baseline`, `handoff`, `read`, `token` e `apply --events`; `skills/plan-coordinator/scripts/prose-budget.test.mjs` (novo).
- `plugins/productivity-tools/README.md`: a linha do plan-coordinator e as linhas dos agentes `implementer`, `task-reviewer`, `final-reviewer` e `script-runner` passam a citar também o workflow do coordinator.

Fora:

- O laço do release: só a origem das quatro funções de autorização muda (R3); nenhuma regra de efeito externo, marca de commit ou retomada do release muda.
- As notas arquivadas do lint (`allowed-tools` em `commands/*.md` e caminhos customizados do `plugin.json`): E12 não cria `commands/*.md` nem `allowed-tools`, e a existência do caminho registrado e o `meta.name` são conferidos por `flow.test.mjs` (critério 5); o lint fica como está (R12).
- A conferência de teste primeiro em código de E9 (`testFirstGap`), o modo de revisão restrita de E21 e qualquer execução em modo inline: o workflow despacha todo passo ao implementador no nível da rota (R6).
- A execução real e paga do workflow sobre um plano: fica para a medição de E13 (R11).
- A pasta do roadmap `docs/plans/roadmap-evolucao-skills/` e a estratégia; a versão do plugin (sem bump).

O que não fazer:

- Não editar `skills/roadmap-release/workflow/size.test.mjs` nem `MAX_WORKFLOW_CHARS` (DEC-647); medir `workflowChars` de `roadmap-release.js` depois de cada edição desse arquivo.
- Não copiar à mão código de `lib/`: toda lógica comum chega a `coordinator.js` por `scripts/embed.mjs`, com teste de cópia defasada.
- Não escrever `subagent_type` em `coordinator.js` (DEC-057, conferido pelo lint G5); os agentes vão por `agentType: 'productivity-tools:<agente>'`.
- Não declarar `allowed-tools` nem `disable-model-invocation` no `SKILL.md` do coordinator (DEC-049, DEC-275); não mudar a descrição da skill.
- Não usar `crypto`, `process`, `Buffer`, `import` nem leitura de arquivo em `coordinator.js` (DEC-058).
- Não fazer push, não tocar em `main`, não subir a versão.

## Desenho

**Entrada do workflow e trava (critério 5).** `coordinator.js` começa com `export const meta = { name: 'coordinator-workflow', description, whenToUse, phases }` e, antes de qualquer `agent()`, valida `args`: `plan` (caminho do `plan.md`), `state` (caminho do `progress.json`) e `runToken` são strings não vazias; `authorizeExternal`, quando presente, passa por `parseAuthorizeExternal` e só aceita itens `plan:T<n>@<resumo>` (item sem resumo é recusado com a forma exata a usar, R5); `answers` só aceita os eventos `answer`, `unblock`, `release`, `hold` e `refuse` (R7); `test` é string. Qualquer falha devolve `{ status: 'error', error }` com zero chamadas de agente; essa é a trava de lançamento sem estado de DEC-035, porque o estado só existe depois de `progress.mjs init`. `plugin.json` registra o arquivo em `workflows`, ao lado do release. `flow.test.mjs` carrega o script como `roadmap-release/workflow/flow.test.mjs` faz (texto com `export const meta` trocado por `const meta`, executado num `AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC)`), e confere: `plugin.json` lista o caminho, o arquivo existe, o `meta.name` lido pela mesma expressão de `registeredWorkflows` do lint é `coordinator-workflow`, `SKILL.md` contém `productivity-tools:coordinator-workflow`, as linhas de `SKILL.md` que citam `scriptPath` estão só no parágrafo da reserva (citam "unknown" ou "not found", e `--add-dir`), como o caso equivalente do release, e lançamentos sem `plan`, sem `state` ou sem `runToken` devolvem `status: 'error'` com o agente simulado nunca chamado. `workflow/size.test.mjs` mede `coordinator.js` em caracteres LF (mesma função `workflowChars` de hoje) contra `MAX_COORDINATOR_CHARS = 120000`, bem abaixo dos 524.288 bytes do lançamento pelo nome (`docs/reports/2026-11-13-E8-limite-lancamento-workflow.md`); outro caso confere que `embedFile(coordinator.js, { check: true }).stale` é falso e que as funções embutidas são iguais às de `lib/`.

**Estado por CLI assinada (base dos critérios 1 a 3).** O workflow não lê arquivo, então todo acesso ao `progress.json` passa por `productivity-tools:script-runner` rodando `progress.mjs`, com a saída conferida em código (R4). `progress.mjs read <progress.json> --nonce <runToken> --json` imprime `{ tool: 'progress', command: 'read', nonce, now, root, planChanged, state, digest }`, com `state.history` vazio, `root` o topo do git da pasta do plano e `digest = fnv1a(JSON.stringify(canon(resto)))` de `lib/plan-digest.mjs`. `progress.mjs apply <progress.json> --events <carga> --nonce <runToken> --json` recebe `encodeURIComponent(JSON)` de `{ expect, events, digest }`, onde `expect` é o resumo do estado de que o lote partiu e cada evento leva `at` (o `now` da última saída assinada); recusa sem gravar quando o `digest` da carga não confere (saída 2), quando o estado no disco não tem o resumo `expect` (`concurrent-change`) ou quando um evento é recusado (todo o lote volta, `applyEvents` é atômica); imprime `{ tool, command: 'apply', nonce, now, ok, code, action, stateDigest, digest }`. `progress.mjs token` imprime um token aleatório novo, que a skill passa em `runToken` a cada lançamento; ele vai só na primeira chamada (a leitura), o que faz uma retomada pelo runtime rodar tudo ao vivo, como o `runToken` do release, e nunca volta em `resumeArgs`. O workflow embute `progress-state.mjs`, `plan-digest.mjs` e `external-auth.mjs`, aplica cada evento localmente com `applyEvents` e grava os eventos acumulados num único `apply --events` antes de cada despacho que pode causar efeito (o `launch`) e antes de cada retorno; o `stateDigest` devolvido tem de ser igual ao resumo do estado calculado localmente, senão o workflow para com `state-divergence`. A leitura repete até 3 vezes (haiku, haiku, sonnet) por ser só leitura; a gravação não repete às cegas: uma saída não conferida leva a uma nova `read`, e o lote só é reenviado se o estado lido ainda tiver o resumo `expect`. `plan.path` do estado tem de casar com `args.plan` (barras normalizadas, comparação pelo sufixo relativo) e `planChanged` verdadeiro devolve a parada `plan-changed` antes de qualquer implementador.

**Critério 1 (ondas despachadas juntas, dependência antes).** O laço segue `nextAction` embutido. Em `approve-map`, o workflow aplica o evento (o mapa vai no resultado, como hoje na mensagem que não espera). Antes do primeiro lançamento, sem `run.baseline`, roda `run.test` (ou `args.test` na primeira vez, gravado pelo evento `baseline` com `{ test, exit, tail, failedNames }`, onde `failedNames = failedTestNames(saída completa)`; `test: "none"` dispensa) por `script-runner`. Em `launch`, aplica `launch --steps` com todos os passos listados, grava, e despacha os implementadores numa única chamada `parallel()`, um `agent()` por passo, com `agentType: 'productivity-tools:implementer'`, `model` = nível e `effort` da rota, esquema `S_IMPL` igual ao do release e um prompt curto que dá o caminho absoluto do brief (`<root>/<pasta do plano>/briefs/T<n>.md`), as linhas `HANDOFF` das dependências (do campo `handoff`) e a regra de efeito externo; o implementador nunca commita, em nenhuma política (a linha "Never commit. The orchestrator commits." de hoje continua valendo); o texto fixo do papel continua em `agents/implementer.md`. Cada retorno vira `report` (`DONE`/`DONE_WITH_CONCERNS` = `pass` com `handoff`; `BLOCKED`/`NEEDS_HUMAN` = `blocked`; agente nulo = `no-report`). Passos com portão vão a `productivity-tools:task-reviewer` em opus/medium (DEC-206) com esquema `S_TASKREVIEW`; `defects` volta ao implementador em modo de correção com a lista, até as 2 rodadas da lib. Em `per-step`, os commits são feitos em série pelo workflow, nunca pelos implementadores e nunca dentro do `parallel()`: depois que todos os retornos da onda chegaram (e a revisão, nos passos com portão), para cada passo em `pass`, um de cada vez e na ordem de `n`, um `script-runner` roda `git add -- <arquivos do passo>` e depois `git commit -m "<id do plano> T<n>: <título>" -- <arquivos do passo>` (os arquivos vêm de `files` do passo no estado, como o passo 6 de `delegation-protocol.md` faz hoje), e em seguida `git log -1 --format=%H --grep "^<id do plano> T<n>:"`; o workflow confere que o assunto devolvido é o do passo e aplica `commit --sha` com esse SHA. Como só um `git commit` roda por vez, não há disputa por `.git/index.lock`, e a busca pelo assunto garante o SHA do próprio passo. Em `none`, nada é commitado. `wave-gate` roda `run.test` por `script-runner` e decide em código, pela função pura `waveGatePasses(gate, baseline)` do `// <pure>` de `coordinator.js` (R2), sem agente que julgue: `failedTestNames(saída)` extrai os nomes das linhas `not ok <n> - <nome>` (TAP) e `✖ <nome>` (relator spec do `node --test`); o portão passa com exit 0, ou com exit diferente de 0 quando o baseline também falhou, a lista de nomes da onda não é vazia e está contida nos `failedNames` gravados pelo evento `baseline`; exit diferente de 0 sem nomes reconhecíveis falha (a decisão nunca adivinha). Falhando, `wave-gate --value fail` e `block` com o trecho da saída, e a parada `ask` volta à pessoa (o workflow não adivinha o dono). `workflow/gate.test.mjs` (novo) carrega o `// <pure>` de `coordinator.js` com `load-pure.mjs` e cobre: exit 0; falhas iguais às do baseline; falha nova; baseline verde com falha; saída sem nomes; saídas TAP e spec. `advance` passa de onda. Como `nextAction` só lista passos da onda corrente com dependências em `pass`, nenhum passo começa antes da dependência. `flow.test.mjs` cria num diretório temporário um repositório git com a fixture de duas ondas (T1 e T2 na onda 1, T3 dependente de T1 na onda 2), roda o `progress.mjs init` real, e usa um agente simulado que executa de verdade os comandos de `progress.mjs` e de `git` pedidos ao `script-runner` (o implementador simulado escreve os arquivos do passo sem commitar) e responde aos demais; confere que T1 e T2 foram despachados na mesma chamada de `parallel()`, que T3 só foi despachado depois do `report` `pass` de T1 gravado, que um T1 reprovado mantém T3 sem despacho, que nenhum `git commit` foi pedido dentro do `parallel()`, e que `steps[].sha` de T1 e de T2 são diferentes e cada um aponta o commit com o assunto `<id> T<n>:` do próprio passo.

**Critério 2 (externo para antes do efeito; autorização de outro plano não vale).** Para `prelaunch-review`, o workflow despacha `task-reviewer` em opus/medium, só leitura, sobre o brief do passo externo, e aplica o resultado. Para `authorize`, cada passo listado é conferido com `externalHold({ n, external }, 'plan', itens, state.plan.digest)`: item `plan:T<n>@<resumo do plano>` presente aplica `authorize`; ausente, o workflow grava e devolve `{ status: 'stopped', stop: { kind: 'authorize', items: [{ item: 'plan:T<n>@<resumo>', step, title }] }, resumeArgs }` sem despachar o implementador desse passo. O resumo é o `plan.digest` do estado (DEC-183), então uma autorização dada para outro plano, ou para este plano antes de uma edição, tem outro resumo e não casa; item sem resumo é recusado na entrada (R5). `flow.test.mjs`: sem `authorizeExternal`, a execução para com o item de T3 e o implementador de T3 nunca é chamado; com `plan:T3@<resumo de outro plano>`, para igual; com o item certo, T3 é lançado uma vez.

**Critério 3 (retomada sem reexecutar nem repetir efeito).** A retomada é um novo lançamento com o mesmo `state` (risco 1 do card: a autorização acontece entre lançamentos). Passos em `pass` ou `skip` não aparecem em `launch`, então não são despachados de novo. Um passo `launched` lido no início pertence a um lançamento morto: o workflow aplica `no-report`; um passo comum volta a `pending` e é lançado de novo; um passo externo vira `stopped` (a lib também recusa um segundo `launch` de externo com `external-relaunch`), e o workflow devolve a parada `ask` com a pergunta de que o efeito pode ter acontecido, respondida pela pessoa por `answers` (`done`, `no` ou `rerun`, que cria passo novo com revisão e autorização próprias). Essa é a marca de efeito do coordinator: o `launch` gravado antes do despacho, que a lib transforma em `stopped`. `flow.test.mjs` usa um diário de chamadas como o `makeJournal` do release: mata a execução no implementador de T3 depois de autorizado e lançado, relança com o mesmo estado e confere que T1 e T2 não são despachados de novo, que o implementador de T3 não é chamado de novo e que a saída é a parada `ask` sobre T3; outro caso mata no implementador de T2 (comum) e confere que só T2 volta.

**Critério 4 (orçamento de prosa).** `prose-budget.test.mjs` conta os bytes LF de `SKILL.md` mais os de cada `references/*.md` citado em `SKILL.md` antes da linha `## After the workflow returns` (o caso falha se o título faltar) e confere `≤ TARGET`, com `BASELINE = 56508`, `REMOVED = 50508`, `TARGET = 6000` e a asserção `TARGET === BASELINE - REMOVED` (R9). A nova `SKILL.md` tem: o parágrafo de intenção; o passo de escolha do plano (`progress.mjs select`, com a pergunta de empate como única pergunta antes do lançamento); a criação do estado (ramo `plan/<tópico>` quando a política é `per-step` no ramo padrão, árvore de trabalho sem mudanças alheias, `progress.mjs init`, ou nada se o `progress.json` já existe); o lançamento (`progress.mjs token`, depois o `Workflow` pelo nome `productivity-tools:coordinator-workflow` com `{ plan, state, runToken, test }`; reserva pelo caminho como no release (REQ-033, DEC-050, DEC-061, DEC-262): só quando o erro do `Workflow` diz que o nome é desconhecido ou não encontrado, uma única chamada com `scriptPath` = `<dir>/workflow/coordinator.js` (absoluto, montado da linha "Base directory for this skill: <dir>", nunca fixo) e os mesmos `args`, avisando que a reserva só funciona sem pedidos de permissão ou com a pasta do script legível (por exemplo `--add-dir`), porque no modo padrão a pasta de cache do plugin não é legível; se a reserva também falhar, relatar os dois erros literais e parar; um erro que fala de permissão ou negação, ou qualquer outro erro, é negação e nunca tenta o caminho; depois de uma negação, a regra `Workflow(productivity-tools:coordinator-workflow)` em `.claude/settings.local.json`, que a skill informa e não grava, DEC-035, DEC-282); o parágrafo da reserva cabe em cerca de 700 bytes dos 6.000 da meta (R9); e, depois do título, o que fazer com o retorno, apontando `references/delegation-protocol.md` e `references/state.md`. `delegation-protocol.md` fica com o que o workflow não cobre: repassar à pessoa cada parada (`authorize` com os itens exatos, `ask`, `plan-changed`, `state-divergence`, `error`), montar o relançamento com `authorizeExternal` e `answers`, pedir reinício (`init --restart`) só quando a pessoa pede, invocar o `roadmap-tracker` uma vez com "plan completed" quando `plan.roadmap` nomeia uma pasta (R10), e o relatório final. O teste de `progress.test.mjs` "AC6: executor prompt forbids asking the person" passa a conferir a linha literal no prompt do implementador de `coordinator.js` (a asserção muda de lugar, não sai), e "skill files link only to existing references" continua valendo.

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal no worktree de E12, antes do merge (DEC-204): no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício. O orquestrador abre sessões `claude -p` com `--plugin-dir` sobre um sandbox com a fixture de duas ondas, que levam a skill até `select`, `init`, `token` e a montagem dos argumentos do `Workflow`, sem chamá-lo (DEC-230, DEC-271), e uma revisão adversarial do resultado; relatório em `docs/reports/`. A descrição do plan-coordinator não muda (R8), então os 3 casos `plan-execution` não precisam rodar de novo.

## Deixado para o plano

- A divisão em tarefas, com teste primeiro: lib e CLI (`progress-state.mjs`, `external-auth.mjs`, `progress.mjs`) antes do workflow; o workflow antes da prosa; a troca do bloco do release numa tarefa própria, com `workflowChars` medido antes e depois.
- O texto exato dos prompts curtos, das mensagens de parada e do esquema de retorno; os rótulos das chamadas; a codificação da carga de `apply --events`.
- Cada verificação como chamada simples, sozinha, sem pipe nem encadeamento, com vermelho e verde como duas chamadas do mesmo comando; manter a saída `emit` do plan-tool abaixo de 24 KB; os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo.

```json data
{
  "schema": "spec/1",
  "id": "E12",
  "title": "Coordinator como workflow do plugin",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o plano de exemplo com duas ondas, quando o workflow roda, então os passos de uma mesma onda são despachados juntos e nenhum passo começa antes da sua dependência passar. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um passo externo sem autorização, quando o workflow chega a ele, então para antes do efeito e devolve o item a autorizar; uma autorização dada para outro plano não vale. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dada uma execução parada no meio, quando o workflow é relançado com o estado gravado, então não reexecuta passos concluídos nem repete um efeito externo já feito. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}"
    },
    {
      "id": "AC4",
      "text": "Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa que a sessão principal carrega antes de lançar o workflow não é maior que a meta derivada registrada na estratégia. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs}"
    },
    {
      "id": "AC5",
      "text": "Dado o workflow do coordinator, quando o plugin é carregado, então ele está registrado no manifesto com o nome `coordinator-workflow` (DEC-041) e a skill o lança pelo nome; lançado sem o plano ou sem o estado, para antes de qualquer agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica o workflow e como ele é registrado?",
      "decision": "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js, com meta.name 'coordinator-workflow', registrado como segundo item de workflows em plugin.json; testes flow.test.mjs e size.test.mjs na mesma pasta, teto próprio MAX_COORDINATOR_CHARS = 120000 caracteres LF.",
      "basis": "Card (arquivo de teste workflow/flow.test.mjs; critério 5); DEC-041; DEC-035; nota do dono (teste de tamanho próprio, teto bem abaixo de 524.288 bytes); padrão de skills/roadmap-release/workflow/.",
      "alternative": "Um arquivo em plugins/productivity-tools/workflows/ fora da skill, com teto igual ao do release (250.000).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como a lógica comum chega ao workflow?",
      "decision": "Blocos // <embed src=... exports=\"strip\"> de scripts/embed.mjs para lib/progress-state.mjs, lib/plan-digest.mjs e lib/external-auth.mjs; flow.test.mjs confere a cópia não defasada e a igualdade das funções embutidas com as de lib. A lógica própria do workflow (conferência da saída assinada, montagem de prompts, decisão do portão de onda) fica num bloco // <pure> testado por load-pure.mjs com o caminho do coordinator.",
      "basis": "Card peça 1; DEC-058; DEC-104 (a cópia entra em E8/E12); DEC-385 (progress-state embutível em E12); nota do dono (estado, autorização e marcas pelo gerador de E2).",
      "alternative": "Copiar à mão as funções no workflow.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "As funções de autorização do release passam a ser a fonte comum?",
      "decision": "Sim: parseAuthorizeExternal, isAuthorized, externalHold e bindAuthorizations saem de roadmap-release.js, com o mesmo texto, para lib/external-auth.mjs, e o release as recebe por bloco embed dentro do seu // <pure>, no mesmo lugar; os testes do release continuam passando sem mudança; workflowChars medido depois da edição, crescimento previsto de cerca de 150 caracteres sobre 238.519, nunca acima de 250.000.",
      "basis": "Risco 3 do card (as duas usam as mesmas funções pelo gerador de E2); nota do dono (medir workflowChars a cada edição do release; nunca editar size.test.mjs nem MAX_WORKFLOW_CHARS); DEC-647; load-pure.mjs encontra funções declaradas, e exports=strip as deixa como funções.",
      "alternative": "Deixar o release intocado e criar a lib só para o coordinator, mantendo duas cópias.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como o workflow lê e grava o progress.json sem ler arquivo?",
      "decision": "Por productivity-tools:script-runner rodando progress.mjs: read e apply --events com nonce (o runToken) e digest fnv1a(canon(...)), conferidos em código; apply --events é atômico, leva o resumo esperado do estado (concurrent-change quando difere) e o instante de cada evento, e devolve stateDigest, comparado ao estado aplicado localmente com applyEvents embutida. Gravação antes de cada despacho que pode causar efeito e antes de cada retorno; leitura repete até 3 vezes, gravação não repete às cegas. Comando token gera o runToken.",
      "basis": "DEC-058 (o workflow não lê arquivo); R2 de E10 (saída copiada por agente conferida por nonce e digest); risco do card (o workflow não recebe entrada no meio); o runToken do release evita que uma retomada do runtime devolva leituras em cache cegas a um launch aberto.",
      "alternative": "Um apply por evento, sem lote nem assinatura, confiando na cópia do agente.",
      "costIfWrong": "high",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual é a forma do item de autorização do coordinator?",
      "decision": "plan:T<n>@<plan.digest>, só na forma presa ao resumo; item sem resumo é recusado na entrada com a forma exata; a parada authorize devolve os itens prontos. O prefixo constante 'plan' mantém a gramática de parseAuthorizeExternal, porque o id do plano/1 é qualquer string.",
      "basis": "Card peça 3 e critério 2 (autorização presa ao resumo de integridade; a de outro plano não vale); DEC-183 (resumo do plano); gramática de parseAuthorizeExternal.",
      "alternative": "Aceitar plan:T<n> sem resumo e prendê-lo ao primeiro uso, como o release.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Quais agentes e níveis o workflow usa?",
      "decision": "Implementador productivity-tools:implementer no nível e effort da rota do estado, também em modo de correção; revisor por passo productivity-tools:task-reviewer em opus/medium quando gate (DEC-206) e na revisão prévia de passo externo; portão final productivity-tools:final-reviewer em opus/high; leituras, comandos e commits por productivity-tools:script-runner em haiku/low; o portão de onda não usa agente que julgue (decisão em código, R13). Nenhum passo roda inline: os candidatos a inline vão ao implementador em haiku.",
      "basis": "Card peça 1 (implementador de E9, revisor de E21); DEC-206; protocolo atual (portão final opus em effort high); no workflow não há orquestrador que execute trabalho.",
      "alternative": "Executar os passos inline por um agente geral sem papel do plugin.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como as respostas da pessoa chegam ao workflow?",
      "decision": "args.answers, lista de { event, step, value, text } restrita a answer, unblock, release, hold e refuse, aplicada no início antes do laço; authorize só por authorizeExternal preso ao resumo; nem answers nem authorizeExternal voltam em resumeArgs.",
      "basis": "Risco 1 do card (autorização entre lançamentos, com o estado gravado); o withoutApprove do release (o que só a pessoa dá não volta nos argumentos de retomada).",
      "alternative": "A sessão principal roda progress.mjs apply com as respostas antes de relançar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "O frontmatter da skill muda?",
      "decision": "A descrição não muda; entra só compatibility, no molde do release: 'Claude Code 2.1.322 or later launches the coordinator workflow by name; older versions fall back to the script path, which works only without permission prompts or with the script folder readable.'; o passo de lançamento traz a reserva única por scriptPath <dir>/workflow/coordinator.js, só com nome desconhecido, nunca depois de negação (R14); sem allowed-tools nem disable-model-invocation; a skill informa a regra Workflow(productivity-tools:coordinator-workflow) e não grava configurações.",
      "basis": "Nota arquivada de E12 (mudar a descrição exige rodar de novo os 3 casos plan-execution em opus); DEC-049 e DEC-275 (concessão só no release e só com disable-model-invocation, que tiraria a invocação pelo modelo); DEC-035; DEC-282; política de chaves do CLAUDE.md.",
      "alternative": "Conceder o workflow por allowed-tools com exceção nova no lint e no CLAUDE.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Qual é a meta derivada de prosa de E12?",
      "decision": "Prosa carregada antes do lançamento (bytes LF de SKILL.md mais as referências citadas antes de '## After the workflow returns') ≤ 6.000. Linha de base 56.508 LF: os blobs de bf9d948 (SKILL.md 17.258, delegation-protocol.md 25.517, progress-template.md 4.695, routing.md 9.038), o mesmo conjunto dos 57.397 CRLF de SRC-02 §1. Removido por construção 50.508: as três referências deixam de ser carregadas antes do lançamento (39.250) e as fases 1 e 2 de SKILL.md passam ao workflow (11.258). Conferida pelo teste em toda execução de G1.",
      "basis": "Critério 4; estratégia, Metas derivadas (prosa de E12 derivada no spec); DEC-034; DEC-167 (contagem LF sobre a medida CRLF de SRC-02 §1); DEC-281.",
      "alternative": "Meta de 4.000 bytes, sem folga para a regra de permissão e as paradas na SKILL.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "O que acontece com os eventos do tracker e o baseline da execução?",
      "decision": "O workflow não invoca o roadmap-tracker; depois do retorno done, a skill o invoca uma vez com 'plan completed' quando plan.roadmap nomeia uma pasta. O baseline vai para run.baseline pelo evento novo baseline ({ test, exit, tail, failedNames }), e baseline.md deixa de ser usado; handoff vai para steps[].handoff pelo campo novo do report; agentId fica sem evento, porque o agente de um lançamento morto não é alcançável; o workflow lê o code da recusa assinada.",
      "basis": "Notas arquivadas de E12 (escolhas do executor de E7 fora do registro); DEC-423 (progress/1 aceita campos aditivos; references/state.md lista gated em E12); o workflow não invoca skill.",
      "alternative": "Um agente que invoca o tracker a cada onda fechada dentro do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Quem faz o teste comportamental e até onde ele vai?",
      "decision": "O orquestrador da sessão principal, no worktree de E12 antes do merge: sessões claude -p com --plugin-dir sobre sandbox com a fixture de duas ondas, até select, init, token e a montagem dos argumentos do Workflow, sem chamá-lo, com revisão adversarial; relatório em docs/reports/. No workflow a tarefa devolve NEEDS_HUMAN. A execução real do workflow sobre um plano fica para E13.",
      "basis": "DEC-204; DEC-230; DEC-271; definição de pronto do card (SRC-03).",
      "alternative": "Lançar o workflow de verdade num sandbox, abrindo uma execução paga aninhada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "As notas arquivadas do lint entram em E12?",
      "decision": "Não: E12 não cria commands/*.md nem allowed-tools, e o caminho customizado que adiciona ao plugin.json (workflows) tem existência e meta.name conferidos por flow.test.mjs; o lint de marketplace-tools fica como está. Sem bump de versão.",
      "basis": "Nota do dono (o spec decide o escopo; sem bump); critério 5; o lint já confere subagent_type nos workflows registrados (DEC-057).",
      "alternative": "Estender lint-plugin.mjs para conferir allowed-tools em commands/*.md e todos os caminhos customizados.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Como o portão de onda decide quando o teste sai com exit diferente de 0?",
      "decision": "Em código, sem agente: funções puras failedTestNames(saída) (linhas TAP 'not ok <n> - <nome>' e spec '✖ <nome>') e waveGatePasses(gate, baseline) no // <pure> de coordinator.js; passa com exit 0, ou com exit diferente de 0 quando o baseline falhou, os nomes da onda não são vazios e estão contidos nos failedNames do evento baseline; exit diferente de 0 sem nomes reconhecíveis falha e vira parada ask. Testado em workflow/gate.test.mjs por load-pure.mjs.",
      "basis": "Revisão do spec (I3); nota do dono (lógica nova em scripts do plugin com testes, prompt novo em arquivos de agente); gatePasses do release (subconjunto de failedNames contra o baseline).",
      "alternative": "Um agente sonnet que compara as duas saídas, com prompt num arquivo de agente novo do plugin.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "A skill tem reserva pelo caminho quando o lançamento pelo nome falha?",
      "decision": "Sim, como no release: só quando o erro do Workflow diz que o nome é desconhecido ou não encontrado, uma única chamada com scriptPath <dir>/workflow/coordinator.js (absoluto, da linha Base directory) e os mesmos args, com aviso de que a pasta de cache não é legível no modo padrão (--add-dir); falhando também, relatar os dois erros literais e parar; erro de permissão, negação ou qualquer outro nunca tenta o caminho e leva à regra Workflow(productivity-tools:coordinator-workflow). O parágrafo cabe em cerca de 700 bytes dentro da meta de 6.000 (R9); flow.test.mjs confere que scriptPath só aparece nesse parágrafo.",
      "basis": "REQ-033 (lançado pelo nome, com o caminho como reserva); DEC-050; DEC-061; DEC-262; compatibility do release; revisão do spec (I2).",
      "alternative": "Só o lançamento pelo nome, sem reserva.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "Quem commita cada passo em per-step e como o SHA é obtido?",
      "decision": "O workflow, em série, depois de todos os retornos da onda: para cada passo em pass, na ordem de n, script-runner roda git add -- <arquivos do passo>, git commit -m '<id> T<n>: <título>' -- <arquivos do passo> e git log -1 --format=%H --grep '^<id> T<n>:'; o workflow confere o assunto e aplica commit --sha. Os implementadores nunca commitam. flow.test.mjs confere SHAs diferentes para T1 e T2, cada um com o assunto do próprio passo, e nenhum commit dentro do parallel().",
      "basis": "Revisão do spec (I1: git log -1 devolve o mesmo HEAD para dois passos da onda e commits concorrentes disputam .git/index.lock); passo 6 de delegation-protocol.md e a linha 'Never commit. The orchestrator commits.' do prompt do implementador.",
      "alternative": "Cada implementador commita os seus arquivos e o SHA é procurado pelo assunto.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "decision",
      "what": "Registrar na estratégia, por nova revisão, a meta de prosa de E12 declarada em R9 (≤ 6.000 bytes LF, linha de base 56.508, removido 50.508) na tabela de Metas derivadas.",
      "why": "O critério 4 fala da meta registrada na estratégia, e a estratégia diz que a prosa de E12 é derivada no spec e registrada por nova revisão; revisão de estratégia é ato do dono e a entrega não edita a estratégia nem a pasta do roadmap.",
      "blocking": false,
      "workaround": "prose-budget.test.mjs carrega a constante 6.000 com a derivação e roda no G1; a revisão só copia o valor para a tabela."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Relançamento com o estado em que um passo externo ficou launched (o lançamento anterior morreu durante o implementador).",
      "expected": "O workflow aplica no-report, o passo vira stopped, o implementador não é chamado e o retorno é a parada ask sobre o passo, com a pergunta de que o efeito pode ter acontecido."
    },
    {
      "id": "C2",
      "input": "authorizeExternal com plan:T3 sem resumo, ou com plan:T3@<resumo de outro plano>.",
      "expected": "Sem resumo: status error na entrada, sem agente, com a forma exata. Com outro resumo: o item não casa, o workflow para com authorize listando plan:T3@<resumo deste plano> e T3 não é despachado."
    },
    {
      "id": "C3",
      "input": "O script-runner copia a saída de progress.mjs com um caractere trocado; ou o plano foi editado depois do init.",
      "expected": "Saída trocada: a conferência do digest recusa; uma leitura repete; numa gravação o workflow lê de novo e só reenvia o lote se o estado ainda tiver o resumo esperado, sem gravar duas vezes. Plano editado: read devolve planChanged verdadeiro e o workflow para com plan-changed antes de qualquer implementador; a skill só recria o estado quando a pessoa pede."
    },
    {
      "id": "C4",
      "input": "O portão de onda falha com o baseline verde; ou sai com exit diferente de 0, o baseline também falhou, e a saída não tem linhas de falha reconhecíveis (nem TAP nem spec).",
      "expected": "Nos dois casos waveGatePasses devolve falso, sem agente que julgue: wave-gate fail, block com o trecho da saída e parada ask; nenhum passo da onda seguinte é despachado."
    },
    {
      "id": "C5",
      "input": "Em per-step, T1 e T2 da mesma onda passam.",
      "expected": "Dois commits feitos em série depois dos retornos da onda; steps[].sha de T1 e de T2 diferentes, cada um com o assunto '<id> T<n>:' do próprio passo."
    }
  ]
}
```
