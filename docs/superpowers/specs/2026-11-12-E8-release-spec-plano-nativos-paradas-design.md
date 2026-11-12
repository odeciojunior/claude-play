# E8 -- Release com spec e plano nativos e paradas em código (design)

Entregável E8 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, seção E8, card CRÍTICO). REQ: REQ-008, REQ-013, REQ-016, REQ-020, REQ-026, REQ-044. Depende de E17 (publicação 1.7.0; E8 começa na ponta da release sem esperá-la, DEC-479), E18 (registro pela CLI e `pending-decisions` no preflight), E19 (agente `spec-author`, DEC-057, DEC-371, DEC-421, DEC-422), E20 (agente `plan-author`, DEC-458, DEC-477) e E25 (lançamento pelo nome `productivity-tools:release-workflow`, DEC-256, DEC-283).

Estado da execução: decidido em modo autônomo sob a instrução do dono para E8 (decisões do dono delegadas a um subagent Fable; execuções do orquestrador em `bypassPermissions`; nunca push nem `main`; execução comportamental que precise de ferramenta de subagent volta ao orquestrador da sessão principal, DEC-204). Nenhuma versão sobe nesta branch.

## Por quê

Os estágios de spec e de plano do workflow do release (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, estágios Spec e Plan) mandam um agente genérico usar `superpowers:brainstorming` e `superpowers:writing-plans`, gravam em `docs/superpowers/...`, e o plano é transcrito em JSON pelo próprio autor (schema `S_PLAN`) e relido por um revisor (`evidenceRows`, `measuredPlanBlob`). A decisão de parar depende do que o agente relata em `decisions` e `humanInputs` (texto livre com a frase de alcance analisada por `parseDecision`). SRC-02 §4, confirmado em SRC-10. Os autores nativos (E19, E20), o formato com bloco de dados (E5, E6), a definição única de roteamento e o resumo de integridade (E6, `lib/routing.mjs`, `lib/plan-digest.mjs`) e a CLI do tracker com `pending-decisions` (E3, E18) já estão na branch de release; E8 os liga ao workflow.

## Critérios de aceite (do card, literais)

1. Dado o workflow do release, quando se inspecionam os prompts dos estágios de spec e plano e os caminhos de artefato, então nenhum cita o superpowers e todos os prompts proíbem perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
2. Dada uma branch de entregável com commits de tarefa e sem spec nativo, quando o workflow a encontra, então para com ação de operador e não escreve spec. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado um plano cujo resumo de integridade não confere na carga, quando o workflow o recebe e as novas tentativas se esgotam, então encerra o entregável como falha de infraestrutura, sem executar tarefa. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dado um plano carregado, quando o workflow despacha uma tarefa, então o modelo e o effort são os devolvidos pela definição de roteamento. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
5. Dado um spec com uma decisão autônoma que contraria uma decisão registrada, quando o workflow aplica as regras de parada, então o entregável para. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
6. Dado um spec com uma decisão autônoma comum, quando o workflow aplica as regras de parada, então ela é registrada como pendente de ratificação e a execução segue. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
7. Dado um spec com uma decisão autônoma marcada como cara de errar e irreversível, quando o workflow aplica as regras de parada, então o entregável para depois do spec, sem escrever o plano. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
8. Dado um entregável que termina com uma decisão autônoma de alcance contrato e um dependente selecionado na mesma execução, quando o workflow chega ao dependente, então ele é pulado citando a decisão, e um entregável sem essa dependência roda. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}

Definição de pronto (card): aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

Riscos do card mantidos como restrição de desenho: os laços e os revisores atuais de spec e plano são mantidos (mudá-los é de E26); a lógica de autorização de efeito externo não muda e os testes atuais dela continuam passando.

## Objetivos, não objetivos e anti-objetivos

Objetivos (peças do card):

- Peça 1: estágios de spec e plano usando os agentes do plugin `productivity-tools:spec-author` e `productivity-tools:plan-author`, sem pergunta à pessoa; todos os caminhos de artefato do release seguem DEC-026.
- Peça 2: guarda para trabalho da versão anterior (DEC-018, REQ-020).
- Peça 3: carga do plano por `plan-tool emit` devolvido com schema, resumo de integridade recalculado em JavaScript puro, duas novas tentativas com a última em outro modelo (DEC-059), nível e effort de cada tarefa vindos de `route` (REQ-016).
- Peça 4: regras de parada em código (SRC-04, DEC-007, DEC-020) e retenção dos dependentes por decisão de contrato (DEC-030, DEC-031, REQ-044).

Objetivos vindos dos pendentes de E8 em `state.md` (instrução do dono):

- Alinhar `agents/spec-author.md`: `output` absoluto; `intake` e `ownerNote` como último campo, multilinha (DEC-421); a marca `{verify: ...}` no passo 5 nos dois modos (DEC-422); a regra tópico-id (DEC-477).
- Receita sem interface em `references/operator.md`, sem bypass como padrão (DEC-312), cobrindo o pendente de E25 sobre `--allowedTools "Bash(git:*)" "Bash(node:*)"`.
- Argumento digitado de permissões no preflight (DEC-313) e novo texto do aviso da regra do workflow (DEC-283; roteiro B já passou no cache, `log.md`).
- Sonda completa em `acceptEdits` com regras e `--stop-on-denial`, com as negações listadas.
- Limite de tamanho do script de workflow, medido, com teste.
- Alcance das decisões, notas de execução e duplicatas na retomada (DEC-277; DEC-459 a DEC-475).
- Campo `status` do `docs-measure` (DEC-444).
- Parada da retomada pela decisão de contrato do próprio entregável (DEC-442; pendente de `state.md`).

Não objetivos:

- `superpowers:test-driven-development` no prompt do implementador e `superpowers:systematic-debugging` nos corretores de merge e de gates: são de E9 (implementador e corretor nativos). O critério 1 cobre os estágios de spec e plano e os caminhos de artefato.
- Registro da execução em `run.json` e retomada sem repetição: E23 (DEC-047). E8 não grava `run.json`.
- Adoção do `plan-writer` e o passo 4 do `plan-author` (N5-1, N5-2): DEC-458, branch própria. E8 não edita `skills/plan-writer/SKILL.md` nem `agents/plan-author.md`.
- Trocar o `cp` do checker por subcomando Node (pendente do planner e tracker): E8 não toca a CLI do tracker.
- `SANDBOX_RELEASE_RULES` de `tools/measure` e a regra de lint de `allowed-tools` em `commands/*.md`: fora do card.
- Subir versão: nenhuma (instrução do dono; padrão de DEC-382).

Anti-objetivos (não fazer):

- Não mudar a semântica de autorização de efeito externo (`planFingerprint`, `bindAuthorizations`, `externalHold`, `evidenceHolds`): a impressão digital continua vindo de `planBlob` e das tarefas.
- Não alterar as linhas "Review ..." e "Blocks ..." dos revisores de spec e de plano nem o texto dos corretores de spec e de plano copiado nos braços de `tools/measure/arms/` (DEC-083, DEC-087, DEC-310; `run-batch.test.mjs` e `checkpoint.test.mjs` os comparam com o workflow em HEAD).
- Não editar `tools/measure/arms/*.md` (DEC-310).
- Não indicar `bypassPermissions` como padrão em nenhum arquivo embarcado (DEC-312).
- Não editar a pasta do roadmap `docs/plans/roadmap-evolucao-skills/` na branch.

## Desenho

### Caminhos de artefato (peça 1, critério 1)

`roadmapSlug` (já lido na descoberta: nome da pasta sem o prefixo `roadmap-`) define a pasta do entregável `docs/plans/<roadmapSlug>-<E>/` (aqui `docs/plans/evolucao-skills-E8/`), com `spec.md`, `plan.md` e `reviews.md` (DEC-026). O relatório da execução vai para `docs/reports/<data>-<ids>-run.md`. Todas as ocorrências de `docs/superpowers/specs|plans|reviews|reports` em `roadmap-release.js` (`logPath`, `logSource`, `readPersistedLog`, `specTxt`, `planTxt`, `reviewsTxt`, registro de riscos e de efeitos executados, `reportPath`, prompts de spec e de plano) passam a usar uma única função pura `artifactPaths(roadmapSlug, E)` no bloco `// <pure>`. O `slug` devolvido pelo autor deixa de compor caminhos. Uma retomada `finish-merge` de um entregável feito na versão anterior não acha o log no caminho novo e cai na preocupação que já existe ("review log not read"); não há fallback para a pasta antiga (DEC-055).

### Estágio de spec (peça 1, critérios 1 e 7)

1. **Autor.** `agent(prompt, { agentType: 'productivity-tools:spec-author', label: '<E>:spec', phase: 'Spec' })`, sem `model` (vale o do agente, opus/medium, DEC-057). O prompt segue o contrato do agente, um `key: value` por linha: `mode: unattended`, `output: <wt>/docs/plans/<roadmapSlug>-<E>/spec.md` (absoluto), `specTool: <pluginRoot>/scripts/spec-tool.mjs` (absoluto), `language`, `roadmap: <wt>/<RM>`, `card: <E>` e, por último, `ownerNote:` multilinha até o fim do prompt, com a instrução do dono para o entregável (quando houver) seguida das regras fixas de que o autor precisa: não perguntar, partes que são atos humanos, efeito externo como tarefa de plano, todas as tarefas na worktree do entregável antes do merge. `pluginRoot` é derivado de `trackerCli` (que termina em `skills/roadmap-tracker/scripts/roadmap.mjs`); sem esse sufixo o entregável falha como infraestrutura antes do autor.
2. **Spec existente.** Se a branch já tem `docs/plans/<roadmapSlug>-<E>/spec.md`, sem nota do dono ele é reutilizado sem chamar o autor; com nota, o autor roda com `ownerNote` sobre o arquivo existente (o agente edita `output`).
3. **Carga.** Um agente de carga (schema `S_TOOLOUT = { checkExit, checkStdout, emitExit, emitStdout, blob, head, clean }`) roda, um comando por chamada, `node "<specTool>" check "<abs spec>" --roadmap "<abs roadmap>" --json` e `node "<specTool>" emit "<abs spec>" --roadmap "<abs roadmap>"` e devolve a saída bruta. O JavaScript faz o parse de `emitStdout` e confere: `tool === 'spec-tool'`, `schema === 'spec/1'`, `data.id === E`, e a lista de critérios igual à do card (mesmos ids, `textWithoutTag` e `verify` normalizados). Divergência ou JSON inválido conta como carga falha: mesma política de tentativas da carga do plano (tentativas 1 e 2 em haiku/low, a 3ª em sonnet/medium); esgotadas, falha de infraestrutura. `check` com saída diferente de 0 depois das três execuções do autor não é carga falha: vira problema crítico da revisão (o autor é chamado de novo pelo laço).
4. **Commit.** O agente não commita (DEC-371, DEC-406). O commit é de um agente mecânico (haiku/low): grava a mensagem com Write num arquivo em `<wtRoot>/_tmp/`, roda `git -C "<wt>" add <caminho relativo>` e `git -C "<wt>" commit -F <arquivo>`, apaga o arquivo. Só o artefato entra no commit.
5. **Revisão.** O laço atual é mantido (revisor opus, corretor por `reviewLoop`). O revisor recebe o caminho novo do spec; as linhas "Review (read-only) the spec ..." e "Blocks: ..." ficam idênticas. O corretor mantém o texto atual ("Fix the spec ... according to the review below, in autonomous mode, and commit. Stop after the commit." e o "Return ...") e ganha, depois dele, uma frase: o spec tem um bloco ```` ```json data ```` em `spec/1`, que deve continuar válido; rode `spec-tool check --roadmap` antes do commit. Depois de cada correção a carga roda de novo; o que o corretor devolve em `decisions` e `humanInputs` não é usado pelo código.
6. **Paradas.** Aplicadas sobre `emit` (ver Regras de parada) depois da revisão e antes do plano.

### Estágio de plano (peça 1, peça 3, critérios 3 e 4)

1. **Autor.** `agent(prompt, { agentType: 'productivity-tools:plan-author', label: '<E>:plan', phase: 'Plan' })` com `mode: unattended`, `output: <wt>/docs/plans/<roadmapSlug>-<E>/plan.md`, `planTool: <pluginRoot>/scripts/plan-tool.mjs`, `spec: <abs spec>`, `language`, `roadmap: <RM>` (relativo, terminado em `/`), `card: <E>` e `ownerNote` por último, multilinha, com a nota do dono e as regras de plano que hoje estão no prompt do estágio e não estão no agente: travas válidas (`TASK_LOCKS`), efeito externo e `externalDedupe`, ordem das tarefas externas, tudo na worktree do entregável, comandos de evidência com a marca do card mantida, prefixo de commit `<E> T<n>:`, ambiente medido.
2. **Carga** (peça 3). Agente de carga com schema `S_TOOLOUT` roda `node "<planTool>" emit "<abs plan>" --spec "<abs spec>"` e `git -C "<wt>" rev-parse "HEAD:<rel plan>"` (depois do commit) e devolve a saída bruta. O JavaScript faz o parse e recalcula `planDigest({ plan, source })` com a cópia embutida de `lib/plan-digest.mjs`; aceita só se for igual a `digest`, `tool === 'plan-tool'`, `schema === 'plan/1'`, `plan.id === E` e `plan.roadmap === RM`. Tentativas: 1 e 2 em haiku/low, 3 em sonnet/medium (DEC-059: a última em outro modelo). Esgotadas, `fail('infra', 'plan load: integrity digest ...')` antes do registro "executando" e de qualquer tarefa.
3. **Adaptador.** Função pura `tasksFromPlan(plan)` converte `plan/1` na forma interna que o resto do workflow usa: `files` = união de `files.create`, `files.modify` e `files.test`; `needsLock` = `locks`; `external`, `externalDedupe`, `noCommit` copiados; `route` = `route(task, { hasDependents })` recalculado com a cópia embutida de `lib/routing.mjs` (o `route` vindo do `emit` é coberto pelo resumo e precisa ser igual; diferença é carga falha). `evidenceFromPlan(plan)` converte `evidence` nas linhas `ac` que `evidenceGaps`, `criteriaOpen`, `evidenceHolds` e `evidenceExternalGaps` já consomem. `planBlob` vem do `rev-parse` medido; `planFingerprint(tasks, planBlob)` não muda.
4. **Despacho** (critério 4). Implementador: `model: t.route.tier`, `effort: t.route.effort`. Revisor da tarefa: `t.route.reviewTier`, com `effortFor` do revisor como hoje. `implModel` e `reviewModelFor` deixam de ler `tier` e `reviewTier` transcritos e passam a ler `route`. O escalonamento (`nextTier`, `maxModel`) não muda.
5. **Revisão.** O laço atual é mantido. As linhas "Review (read-only) the plan ..." e "Blocks (defeito): ..." ficam idênticas. A lista "THE TASKS THE CODE ACTS ON" passa a vir do `emit` carregado (não mais de transcrição). O pedido de reler as linhas de evidência (`evidenceRows`) e a checagem `evidenceRowGaps` saem, porque as linhas vêm do `emit` conferido pelo resumo; `measuredPlanBlob` e `planBlobGaps` ficam (protegem a impressão digital das autorizações). O corretor mantém o texto atual ("Fix the plan ..." até o "Return ...", que o braço `plan-fix-atual.md` cita) e ganha depois dele a frase sobre manter o bloco `plan/1` válido e rodar `plan-tool check`; o que ele devolve não é usado pelo código, e a carga roda de novo após cada correção.
6. **Cabeçalho `**Roadmap:**`.** Deixa de ser exigido: o vínculo é o campo `roadmap` do bloco, conferido na carga.

### Cópias embutidas (REQ-016)

`roadmap-release.js` ganha, dentro do bloco `// <pure>`, os marcadores `// <embed src="../../../lib/routing.mjs" exports="strip">` e `// <embed src="../../../lib/plan-digest.mjs" exports="strip">` gerados por `scripts/embed.mjs`, no formato da fixture `scripts/fixtures/plan-tool/workflow-copy.js` (E6). Um teste em `flow.test.mjs` afirma `embedFile(<workflow>, { check: true }).stale === false` e que `route` e `planDigest` carregados por `loadPure` dão o mesmo resultado que os de `lib/` num conjunto de tarefas e planos.

### Guarda da versão anterior (peça 2, critério 2)

O agente de setup passa a medir, além do que já mede: `taskCommits` = número de commits em `<TARGET>..HEAD` cujo assunto casa `^<E> T\d+:` e `nativeSpec` = `docs/plans/<roadmapSlug>-<E>/spec.md` existe na branch. Com `taskCommits > 0` e `nativeSpec` falso, o entregável para antes do estágio de spec: `op('previous-version', E, ...)` com o que fazer (terminar o entregável na versão anterior, ou descartar a branch e a worktree e rodar de novo do zero; planos já escritos entram pela adoção do `plan-writer`, DEC-018) e `fail('conteudo', ...)`. Nenhum spec é escrito e nenhum agente de autor é chamado.

### Regras de parada (peça 4, critérios 5, 6 e 7)

Função pura `stopOrCarry({ rulings, needsPerson, approved })` no bloco `// <pure>`, aplicada ao `data` do `emit` do spec:

- item de `needsPerson` com `blocking: true`: para com `humano` e ação `human-input` (como hoje);
- ruling com `contradicts` preenchido (DEC-<n> ou G<n>): para com `decisao` e ação `decision` (critério 5);
- ruling com `costIfWrong: "high"` e `reversible: false` (DEC-020): para depois do commit do spec, antes do plano, com ação `approve-ruling` (critério 7); só segue quando `approveRulings[E]` contém `R<n>:<fnv1a do texto da decisão>` para cada uma, valor que a pessoa digita: como `acceptIntegrityAlerts`, ele nunca entra em `resumeWith` e o `doNow` mostra o valor exato;
- o resto: registrado como pendente de ratificação e a execução segue (critério 6).

Um teste afirma que o conjunto de paradas de `stopOrCarry` (sem aprovação) é igual ao de `stopsOf` de `scripts/spec-tool.mjs` numa tabela de casos.

### Registro das decisões (DEC-277, duplicatas)

As decisões gravadas vêm só de `data.rulings` do `emit`: `--decision` = `decision`, `--scope` = `local` ou `contrato` (de `scope`), `--discarded` = `alternative`. `parseDecision` deixa de ser usado no registro de decisões do spec; notas de execução e respostas do dono incorporadas nunca viram decisão (vão para o log e o relatório). Duplicatas na retomada: `add-decision` já devolve `existing: true` para texto igual do mesmo entregável; o `spec-author.md` passa a exigir que, ao incorporar `ownerNote` num spec existente, os rulings que a nota não muda fiquem com o mesmo id e o mesmo texto. Um teste roda o registro duas vezes sobre o mesmo `emit` e afirma que a segunda não cria decisão nova.

### Retenção por decisão de contrato (peça 4, critério 8; DEC-030, DEC-031)

- Na mesma execução: quando um entregável termina com ruling de alcance `contract` registrado, cada dependente selecionado (direto ou transitivo, pelos `deps` dos cards) é pulado com o motivo `held by <DEC-id> (<E>, contract, pending ratification)`; um entregável sem essa dependência roda. Os ids vêm de `recordVerdict(...).decisionIds`.
- Antes da execução: a descoberta roda `node "<trackerCli>" pending-decisions "<abs roadmap na worktree de integração>" --json` e devolve o stdout bruto; o JavaScript faz o parse e retém os dependentes não iniciados de cada decisão de contrato pendente. O entregável dono da decisão não é retido (pendente de `state.md`; dispara o gatilho de revisão de DEC-442, registrado para o dono).
- Vale em `run` e em `plan-only`; em `dry-run` só é relatado.
- `SKILL.md`, passo 2: a parada antes de qualquer agente fica só para decisão de contrato pendente com `startedDependents` não vazio; as outras são relatadas e retidas em código.

### Sem perguntas e sem superpowers (critério 1, REQ-008, REQ-013)

Uma constante `NO_ASK` ("Never ask the person anything ...") entra em todo prompt dos estágios de spec e de plano (autores, carga, commit, revisores, corretores). O teste do critério 1 extrai esses prompts do script e afirma que cada um contém `NO_ASK` e que nenhum, nem os caminhos de artefato, contém `superpowers`.

### Comandos simples (sonda `acceptEdits`, DEC-312)

As regras fixas de `C()` ganham: um comando simples por chamada, sem heredoc, sem laço e sem `&&`/`;`; arquivos gravados com Write; commit com `git commit -F <arquivo>`. Os prompts que E8 escreve (autores, carga, commit) seguem isso. Negações em estágios que E8 não reescreve viram pendentes para E9 ou E23.

### Preflight e documentação (DEC-283, DEC-312, DEC-313)

- `scripts/preflight.mjs` aceita `--declare-permissions "<texto>"`, digitado pela pessoa, e devolve `permissionsDeclared` (string ou `null`). `SKILL.md`: com `permissionsDeclared`, `missingRules` não para o run e o relatório registra a declaração; a skill nunca a deriva nem a acrescenta sozinha.
- Novo texto do aviso da regra do workflow: o lançamento pela skill (concessão) não precisa da regra; ela só é precisa para lançar o workflow fora da skill. O texto não diz mais que `claude -p` é negado sem a regra.
- `references/operator.md` ganha a seção "Sem interface (claude -p)": `--allowedTools "Bash(git:*)" "Bash(node:*)"`, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` para execuções acima de 10 minutos, as regras exatas do preflight em `.claude/settings.local.json`, e `--declare-permissions` quando as permissões vêm por outro meio. Nenhum arquivo embarcado indica `bypassPermissions` como padrão; um teste procura `bypassPermissions` em `SKILL.md`, `references/*.md` e no workflow e só aceita menção que diga que não é o padrão.

### `docs-measure` (DEC-444)

`S_DOCMEAS` troca `status` e `brief` por `statusStdout` e `briefStdout` (saída bruta de `status --json` e de `brief`), e o prompt nomeia os campos novos; o JavaScript mapeia para `recordVerdict`. Teste: o schema não tem `status`, e um agente que devolve `statusStdout` com o JSON do CLI passa sem o alarme "reread status --json is missing or has no panel".

### Limite de tamanho do script

Novo `workflow/size.test.mjs` afirma que `roadmap-release.js` tem no máximo `MAX_WORKFLOW_CHARS` caracteres, com comentário citando a medição. Tarefa do orquestrador da sessão principal (precisa da ferramenta Workflow, DEC-204): medir, num sandbox, o maior script que o diálogo do Workflow aprova por `scriptPath` (cópias com enchimento, por bisseção) e conferir que o lançamento pelo nome com a concessão e com a regra funciona com o script acima desse limite; o resultado vai para `docs/reports/`. `MAX_WORKFLOW_CHARS` = limite medido. Se a medição não rodar, o teto é o tamanho do script na ponta de `feat/E8` (nenhum crescimento sem decisão), registrado como provisório no relatório.

### Execuções fora do workflow (tarefas do orquestrador, DEC-204)

- Sonda `acceptEdits`: sandbox por `skills/roadmap-release/scripts/make-sandbox.mjs`, uma execução completa do release por `tools/measure/run-batch.mjs --permission-mode acceptEdits` com as regras exatas do preflight (`--allow`), `--stop-on-denial` e `--max-budget-usd 10`. As negações vão listadas em `docs/reports/`. Se o run não completar em `acceptEdits` com os prompts corrigidos, o gatilho de DEC-312 é relatado ao dono.
- Teste comportamental da skill (definição de pronto, SRC-03): uma execução `plan-only` num sandbox, conferindo spec e plano nativos nos caminhos de DEC-026, sem pergunta; relatório em `docs/reports/`.

### `agents/spec-author.md` (DEC-421, DEC-422, DEC-477)

- Tabela do contrato: `output` "absolute path of the spec to write"; `ownerNote` e `intake` "last field, may span several lines to the end of the prompt"; `topic` "the spec id, used as given: a caller with a topic ending in `-E<n>` passes `E<n>` (DEC-477); never derive or change it" (sem a frase que `independence.test.mjs` proíbe).
- Passo 5: todo critério, nos dois modos, leva a marca `{verify: ...}` (teste com comando, ou human); no modo autônomo os critérios são os do card, com a marca.
- Nova regra: ao incorporar `ownerNote` num spec existente, manter id e texto dos rulings que a nota não muda.
- Os testes de E19 em `spec-tool.test.mjs` continuam passando.

## Casos de borda

- `emit` do plano com `digest` certo mas `route` de uma tarefa diferente do recalculado: carga falha (o resumo cobre `route`).
- Spec reutilizado sem nota: nenhuma chamada ao autor; a carga roda; decisões já gravadas voltam como `existing: true`.
- Ruling caro e irreversível já aprovado com hash de outro texto: para de novo (o texto mudou).
- Dependente transitivo de uma decisão de contrato: pulado; o motivo cita a decisão de origem.
- Entregável dono de decisão de contrato pendente retomado sozinho: roda (não retido).
- Branch com spec antigo em `docs/superpowers/specs/` e sem commit de tarefa: não para; o spec nativo é escrito (o antigo fica onde está, DEC-055).
- `trackerCli` fora do layout do plugin: falha de infraestrutura antes do autor.

## Deixado ao planejador

Divisão em tarefas (o arquivo de workflow tem 216.543 caracteres e muitos testes de `flow.test.mjs` simulam os prompts e schemas atuais), ordem de migração dos testes, nomes finais das funções puras, a forma exata do schema de carga e o enchimento usado na medição do limite.

## Decisões autônomas (revisáveis pelo dono)

1. Artefatos em `docs/plans/<roadmapSlug>-<E>/` (`spec.md`, `plan.md`, `reviews.md`), com `roadmapSlug` = nome da pasta sem `roadmap-`, e relatório em `docs/reports/<data>-<ids>-run.md`, por uma função pura `artifactPaths`; `run.json` não é gravado (E23). Base: DEC-026, DEC-047. Custo se errada: médio. Reversível. Alcance: contrato.
2. Estágio de spec despacha `productivity-tools:spec-author` por `agentType`, com `output` e `specTool` absolutos e `ownerNote` por último levando a nota do dono e as regras fixas de que o autor precisa; `pluginRoot` derivado de `trackerCli`, falha de infraestrutura se o sufixo não casar. Base: DEC-057, DEC-421. Custo se errada: médio. Reversível. Alcance: local.
3. Estágio de plano despacha `productivity-tools:plan-author` do mesmo modo, com `roadmap` relativo e as regras de plano do prompt atual movidas para `ownerNote`; o cabeçalho `**Roadmap:**` deixa de ser exigido, o vínculo é o campo `roadmap` conferido na carga. Base: E20, DEC-057. Custo se errada: médio. Reversível. Alcance: local.
4. O commit de spec e de plano é de um agente mecânico haiku/low que grava a mensagem com Write e usa `git commit -F`, só com o artefato. Base: DEC-371, DEC-406. Custo se errada: baixo. Reversível. Alcance: local.
5. Carga de spec e de plano por agente com schema que devolve a saída bruta das ferramentas; o JavaScript faz o parse, recalcula `planDigest` (plano) ou confere id e critérios contra o card (spec); tentativas 1 e 2 em haiku/low e a 3ª em sonnet/medium; esgotadas, falha de infraestrutura sem tarefa. Base: DEC-059, DEC-123, DEC-125. Custo se errada: médio. Reversível. Alcance: local.
6. Cópias de `lib/routing.mjs` e `lib/plan-digest.mjs` embutidas em `roadmap-release.js` por `scripts/embed.mjs` com `exports="strip"`, dentro do bloco `// <pure>`, com teste de cópia não velha e de igualdade de resultado. Base: REQ-016, DEC-104, decisão 11 de E6. Custo se errada: baixo. Reversível. Alcance: contrato.
7. Modelo e effort do implementador vêm de `route(task, { hasDependents })` recalculado; o revisor da tarefa vem de `route.reviewTier`; o escalonamento não muda. Base: REQ-016, critério 4. Custo se errada: médio. Reversível. Alcance: local.
8. Adaptador puro de `plan/1` para a forma interna de tarefa e de evidência; `planFingerprint(tasks, planBlob)` e toda a autorização de efeito externo ficam como estão. Base: risco 2 do card. Custo se errada: médio. Reversível. Alcance: local.
9. Revisores e corretores de spec e de plano mantêm o texto atual (linhas Review e Blocks, e o texto dos corretores citado em `tools/measure/arms/`); os corretores ganham só uma frase posterior sobre manter o bloco válido, e o que devolvem não é usado pelo código. Base: risco 1 do card, DEC-083, DEC-087, DEC-310. Custo se errada: médio. Reversível. Alcance: contrato.
10. A releitura das linhas de evidência pelo revisor do plano (`evidenceRows`, `evidenceRowGaps`) sai; a conferência de `measuredPlanBlob` fica. Base: peça 3 (sem releitura por LLM), risco 2. Custo se errada: baixo. Reversível. Alcance: local.
11. Guarda da versão anterior medida no setup (`taskCommits` com assunto `^<E> T\d+:` e `nativeSpec`); com commits de tarefa e sem spec nativo, ação `previous-version` e falha `conteudo`, sem autor. Base: DEC-018, REQ-020, critério 2. Custo se errada: baixo. Reversível. Alcance: local.
12. Função pura `stopOrCarry` sobre o `emit` do spec: bloqueante humano e ruling que contraria param; caro e irreversível para depois do spec e antes do plano e só segue com `approveRulings[E]` contendo `R<n>:<fnv1a>` digitado pela pessoa (fora de `resumeWith`); o resto vira pendente; teste de igualdade com `stopsOf` de `spec-tool`. Base: SRC-04, DEC-007, DEC-020, DEC-127. Custo se errada: alto. Reversível. Alcance: contrato.
13. Decisões gravadas só a partir de `data.rulings` (texto, alcance e alternativa estruturados); notas de execução e respostas do dono nunca viram decisão; duplicatas evitadas pelo texto estável dos rulings e pelo `existing: true` de `add-decision`. Base: DEC-277, pendente de DEC-459 a DEC-475. Custo se errada: médio. Reversível. Alcance: contrato.
14. Retenção em código: decisão de contrato registrada na execução pula dependentes diretos e transitivos selecionados, citando o DEC; decisões de contrato pendentes no alvo, lidas por `pending-decisions --json` na descoberta, retêm dependentes não iniciados; o dono da decisão não é retido; vale em `run` e `plan-only`. Base: DEC-030, DEC-031, REQ-044, critério 8. Custo se errada: alto. Reversível. Alcance: contrato.
15. `SKILL.md` passo 2 para antes do run só por decisão de contrato pendente com `startedDependents`; as demais são relatadas e retidas pelo workflow; o gatilho de revisão de DEC-442 é relatado ao dono. Base: pendente de `state.md` (2 de 3 retomadas pararam), DEC-442. Custo se errada: médio. Reversível. Alcance: contrato.
16. Constante `NO_ASK` em todo prompt dos estágios de spec e de plano; as menções a superpowers do implementador e dos corretores de merge e de gates ficam para E9. Base: REQ-013, REQ-008, critério 1, card de E9. Custo se errada: baixo. Reversível. Alcance: local.
17. `spec-author.md` alinhado: `output` absoluto, `ownerNote` e `intake` como último campo multilinha, marca `{verify: ...}` no passo 5 nos dois modos, `topic` usado como dado pelo chamador (que passa `E<n>`), e rulings mantidos ao incorporar nota. Base: DEC-421, DEC-422, DEC-477. Custo se errada: baixo. Reversível. Alcance: contrato.
18. Preflight aceita `--declare-permissions "<texto>"` e devolve `permissionsDeclared`; com ele `missingRules` não para o run e o relatório registra a declaração; a skill nunca o deriva. Base: DEC-313. Custo se errada: baixo. Reversível. Alcance: local.
19. Novo aviso da regra do workflow: a regra só é precisa para lançamento fora da skill; a frase sobre `claude -p` negado sai. Base: DEC-283, roteiro B aprovado no cache. Custo se errada: baixo. Reversível. Alcance: local.
20. `operator.md` ganha a receita sem interface (`--allowedTools "Bash(git:*)" "Bash(node:*)"`, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` acima de 10 minutos, regras em `.claude/settings.local.json`, `--declare-permissions`), com teste de que nada embarcado indica bypass como padrão. Base: DEC-312. Custo se errada: baixo. Reversível. Alcance: local.
21. `S_DOCMEAS` passa a usar `statusStdout` e `briefStdout`, com teste do alarme falso. Base: DEC-444. Custo se errada: baixo. Reversível. Alcance: local.
22. Regras fixas de `C()` pedem comandos simples (um por chamada, sem heredoc, laço, `&&` ou `;`, arquivo por Write, commit com `-F`); negações em estágios não reescritos por E8 viram pendentes de E9 ou E23. Base: pendente da sonda `acceptEdits`, DEC-312. Custo se errada: médio. Reversível. Alcance: local.
23. `workflow/size.test.mjs` com teto `MAX_WORKFLOW_CHARS` igual ao limite medido pelo orquestrador; sem medição, o tamanho na ponta de `feat/E8`, marcado como provisório. Base: pendente de `state.md` (213.337 caracteres não aprovados), DEC-204. Custo se errada: baixo. Reversível. Alcance: local.
24. Sonda `acceptEdits` e teste comportamental da skill são tarefas do orquestrador da sessão principal, em sandbox, uma execução cada, teto de US$ 10 na sonda, resultado em `docs/reports/`. Base: DEC-204, DEC-297, DEC-478, SRC-03. Custo se errada: baixo. Reversível. Alcance: local.
25. Nenhuma versão sobe; `skills/plan-writer/SKILL.md` e `agents/plan-author.md` não são editados; o `cp` do checker não é tratado aqui. Base: instrução do dono, DEC-458, DEC-382. Custo se errada: baixo. Reversível. Alcance: local.
26. Retomada `finish-merge` de entregável da versão anterior não procura o log na pasta antiga; cai na preocupação existente. Base: DEC-055, critério 1. Custo se errada: baixo. Reversível. Alcance: local.

## Depende de entrada humana

- Ratificação pelo dono das decisões de alcance contrato (1, 6, 9, 12, 13, 14, 15 e 17) antes de um dependente de E8 começar (DEC-030). Não bloqueante: ficam pendentes com origem executor e E8 segue.
- Avaliação pelo dono do gatilho de revisão de DEC-442 (E8 deixa de parar a retomada do entregável dono da decisão de contrato). Não bloqueante: o comportamento novo é o da decisão 15, relatado.
- Gasto da sonda `acceptEdits` (até US$ 10) pelo orquestrador sob a delegação do dono. Não bloqueante: sem a sonda, o relatório registra "não rodada" e o gatilho de DEC-312 fica em aberto.
