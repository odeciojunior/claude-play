# Spec E10 -- Release mecânico por código

## Intenção

O script do workflow do release não lê arquivo nem roda shell (SRC-02 §4), então hoje cada passo mecânico vira uma chamada de agente que transcreve a saída de comandos: a descoberta dos cards (um agente sonnet que reaplica em prosa as regras do parser e do git), o registro de cada status (uma chamada que roda a CLI do tracker e outra que relê o resultado), a conferência da etapa de docs e a verdade do git no fim. E10 (REQ-012) leva esse trabalho para scripts do plugin com testes: a descoberta sai do parser único `lib/roadmap-format.mjs` com as checagens de git em código; os comandos de cada registro rodam agrupados num único portador barato, que para no primeiro erro e devolve o resultado de cada comando, e a releitura independente do registro (DEC-219) passa a ser um script que aplica o veredicto; e a verificação pós-execução compara o relatado com o git por script, rodada dentro da chamada do relatório. O workflow fica só com a ligação: monta o comando, confere a integridade da saída copiada pelo agente e decide. É Should (DEC-022); vem depois de E24 porque edita o mesmo arquivo (estratégia, riscos transversais).

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`: subcomando novo `discover`, com testes em `preflight.test.mjs`.
- `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs` (novo): subcomandos `group` (portador agrupado de comandos), `read` (releitura independente com o veredicto do registro) e `check` (verificação pós-execução), com testes em `verify-run.test.mjs` (novo); recebe `recordVerdict` e `truthDivergences`, que saem do workflow.
- `plugins/productivity-tools/agents/script-runner.md` (novo): o portador, que roda um comando exato e devolve a saída literal.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: descoberta, estágio de registro (`recordStatus`), conferência da etapa de docs e verdade do git passam a chamar os scripts; `flow.test.mjs` ganha os casos e ajusta as respostas simuladas; `merge.test.mjs` perde o teste de `truthDivergences`, que muda para `verify-run.test.mjs` (R10).
- `WORKFLOW_SCRIPTS` em `preflight.mjs` e o texto de `references/config.md`, `references/operator.md` e `SKILL.md` onde descrevem a descoberta, o registro e a verdade do git; a seção de agentes do `README.md` do plugin ganha a linha do `script-runner`.

Fora:

- A carimbagem por hash da carga do `approve` em `run-record.mjs`, a parada própria `preflight:recorded-invalid` com o `trim` do `recorded`, a mudança de `TEST_INTEGRITY_DEFAULT` para script do plugin e a medição de acerto por tentativa da carga (itens do executor em `state.md`; motivo em R9).
- Os estágios de setup, spec, plano, implementação, gates, merge e limpeza, e as marcas de tarefa externa (`launching`, `awaiting-person`, `effect-completed`): nenhuma regra de efeito externo ou de retomada muda.
- A pasta do roadmap `docs/plans/roadmap-evolucao-skills/` e a estratégia; a versão do plugin (sem bump).

O que não fazer:

- Não editar `size.test.mjs` nem `MAX_WORKFLOW_CHARS` (DEC-647); nenhuma tarefa termina acima de 250.000 caracteres LF.
- Não rodar comando de agente por shell no script portador: só `node` e `git`, por lista de argumentos, sem pipe, redirecionamento nem expansão.
- Não transformar em mecânica uma decisão de julgamento: o `donotHolds` da descoberta continua com um agente.
- Não juntar a releitura do registro à chamada que escreve: DEC-219 pede a leitura independente numa chamada própria em haiku/low.
- Não fazer push, não tocar em `main`, não subir a versão.

## Desenho

**Critério 1 (descoberta por script igual ao checker).** `preflight.mjs` ganha o subcomando `node preflight.mjs discover --repo <repo> [--roadmap <pasta relativa>] [--ref <alvo>] [--base <ramo>] [--today <AAAA-MM-DD>] --prefix <prefixo> --nonce <token>`, que só lê. Sem `--roadmap`, a pasta é a única sob `docs/plans/` com `roadmap.config.json` (mais de uma, ou nenhuma, sai 1 com a lista). Sem `--ref`, o alvo é calculado pela regra de hoje: `releaseBranch` do `roadmap.config.json` quando não vazio, senão `integracao/<roadmapSlug>`; o workflow passa `--ref` só quando `PRE_TARGET` (`A.targetBranch || CFG.releaseBranch`) não está vazio e continua montando `TARGET` com a mesma regra sobre `releaseBranch` e `roadmapSlug` devolvidos, então os dois lados concordam. Sem `--base`, o ramo de leitura alternativo é `integrationBranch`. Os textos vêm de `readRoadmapTexts` (já existente), primeiro do alvo quando ele tem a pasta, senão do ramo base, senão da árvore de trabalho, e `readFrom` diz qual; a estrutura vem de `parseRoadmapTexts` do `lib/roadmap-format.mjs`, o mesmo parser do checker (o teste "preflight carries no copy of the parser" continua valendo). `today` é o `--today` quando dado (o workflow passa `A.today` quando existe) e, senão, a data local do sistema em `AAAA-MM-DD`; é campo obrigatório da saída, porque o workflow exige `A.today || disc.today` e `SKILL.md` não passa `today`. A função exportada `discoverRoadmap({ repo, roadmap, ref, base, today, prefix })` devolve todos os campos que o workflow lê hoje de `S_DISC`: `repo`, `today`, `roadmapDir`, `roadmapSlug`, `strategy`, `checker`, `checkerExists`, `integrationBranch`, `releaseBranch`, `target`, `targetExists`, `readFrom`, os vocabulários (`deliverableStatuses`, `integratedStatuses`, `discardedStatus`, `blockedStatus`), `language`, `cellChars`, `cards` (id, título, fase, trilha, prioridade, `deps`, `reqs`, `critical`, `criticalMissing`, `status` = célula do painel literal, `mergeCommit` = primeiro hash da Evidência, `acceptance`), `blockers` (id, texto, afetados), `donot` e `pendingDecisions` (a lista que `readPendingDecisions` já calcula sobre os textos lidos, no formato de `result.decisions` da CLI, que substitui `pendingDecisionsStdout` e o item 10 do prompt atual). `wtRoot` não entra: o workflow já toma `WT` de `A.wtRoot`, que `SKILL.md` passa sempre (passo 4), e não lê `disc.wtRoot`; sem o item 10, a descoberta não procura mais pasta em worktree. As regras de git do item 7 do prompt atual viram código com `execFileSync('git', …)`: `mergeFound` (commit `merge: <id> ` em `git log --first-parent <alvo>` sem `Revert "merge: <id> ` posterior), `mergeSha` (40 caracteres de `git rev-parse`), `onTarget` e `onTargetEvidence` pelas mesmas regras de segmento `code` e ancestralidade, sem contar o ramo `<prefixo><id>`. A saída é `{ tool: 'release-discovery', nonce, digest, data }`, com `digest = fnv1a(JSON.stringify(canon({ nonce, data })))` de `lib/plan-digest.mjs`; sai 1 com `{ tool, error }` quando a pasta ou a estratégia não se lê. `acceptance` vem vazia, com `acceptanceOmitted: true`, para card cujo status de código está em `integratedStatuses` ou é `discardedStatus` (R12). O caso de `preflight.test.mjs` roda `discoverRoadmap` sobre `roadmap-tracker/scripts/fixtures/valid` dentro de um repositório git temporário e confere que ids, `deps`, `status` (célula do painel) e `blockers` são iguais aos de `parseRoadmap(loadRoadmap(VALID))`; outros casos cobrem `today` presente com e sem `--today`, o alvo padrão `integracao/<slug>` sem `--ref`, `mergeFound` com merge revertido, `onTarget` por segmento `code` integrado e a recusa do ramo de entrega como ancestral. No workflow, a chamada `discovery` (a primeira, com o `RUN_TOKEN` como `nonce`, o que mantém a releitura numa retomada) despacha `agentType: 'productivity-tools:script-runner'` com o comando montado e o schema `S_RUN = { exit, stdout }`; uma função pura nova `checkRun(stdout, tool, nonce)` confere `tool`, `nonce` e o `digest` pelo `canon`/`fnv1a` já embutidos e devolve `{ ok, data }` ou `{ ok: false, why }`. As checagens de hoje sobre os campos obrigatórios (incluindo `today`) continuam valendo sobre `data`. A descoberta é só leitura, então repete até 5 vezes (1 e 2 em haiku, 3 a 5 em sonnet, como `load3`); sem confirmação, o workflow para com `discovery failed: <why>`. Só quando `donot` não está vazio há uma chamada sonnet `discovery-donot` que devolve `donotHolds` com o texto do item 8 de hoje. `S_DISC` e o prompt da descoberta saem do script.

**Critério 2 (verificação pós-execução por script).** `verify-run.mjs check '<carga codificada>'` recebe `{ nonce, digest, repo, intwt, wtRoot, target, lastGood, order, claims: [{ id, commit }], reported: [{ id, merged, broken, planOnly }], integBroken }` (o `digest` da carga, sem ele próprio, calculado pelo workflow; carga com `digest` que não confere é recusada com saída 2, sem rodar git). O script mede por `git` os campos de `S_TRUTH` (`targetHead`, `clean`, `lastGoodReachable`, `mergedIds`, `notMergedIds`, `claims` com `reachable`, `worktrees`, `strays` lidos do sistema de arquivos) e aplica `truthDivergences`, que sai do workflow para `verify-run.mjs` sem mudar o texto das divergências. Imprime `{ tool: 'verify-run', mode: 'check', nonce, ok, divergences, truth, digest }`, com `ok` verdadeiro só quando `divergences` está vazio. A chamada separada `git-truth` deixa de existir: o agente do relatório (`report`, que já roda no fim, dentro do `mergeLock`) recebe o comando como primeiro passo, antes de escrever ou commitar qualquer arquivo, e devolve o stdout literal num campo `truthStdout` do seu schema novo `{ report, truthStdout }`; o texto do relatório usa `truth` e `divergences` dessa saída e lista uma ação de operador por divergência, com a ação de hoje (`Check git log and git status of the target`). Depois da chamada, o workflow confere `truthStdout` com `checkRun`, usa `truth` no resultado e transforma cada divergência em `op('divergence', …)` como hoje; saída nula ou não confirmada vale como hoje o agente nulo (a divergência `the git truth agent returned nothing: verify the target branch by hand`, com o texto mantido), e o formato de `truth` que `SKILL.md` lê não muda. No modo `plan-only` nada muda: não há verificação, como hoje. `verify-run.test.mjs` cria repositórios git temporários e confere: execução sem divergência devolve `ok: true`; merge relatado sem commit `merge: <id> in <alvo>`, commit reivindicado fora do alvo, alvo sujo e `lastGood` não ancestral aparecem cada um em `divergences`; os casos de `truthDivergences` de `merge.test.mjs` passam para cá com as mesmas asserções (R10).

**Critério 3 (menos chamadas no caminho sem falhas; falha no grupo interrompe e é devolvida).** A economia de chamadas vem da verificação pós-execução, que entra na chamada do relatório (critério 2, R4): o caminho sem falhas de um entregável perde a chamada `git-truth`. O registro mantém as duas chamadas que DEC-219 define: a que roda os comandos montados em código, num agente mecânico haiku/low, e a leitura independente, também haiku/low. Muda o que cada uma faz:

- `verify-run.mjs group '<carga codificada>'` recebe `{ nonce, digest, steps: [texto], finally: { commit: { cwd, add: [caminhos], message: [m1, m2] } } | null }`. Cada texto é tokenizado por um analisador POSIX mínimo (aspas simples com `'\''`, aspas duplas com `\"` e `\\`, espaço) que recusa metacaractere fora de aspas (`| & ; < > ( ) $` e crase) e `$` ou crase dentro de aspas duplas; só `node` (rodado por `process.execPath`) e `git` são aceitos, por `execFileSync` sem shell. Os `steps` rodam em ordem e o grupo para no primeiro com saída diferente de 0; os restantes não rodam e `stopped = { n, exit }`. A fase `finally` roda sempre, para deixar o worktree de integração limpo como o registro faz hoje: `git -C <cwd> add -- <caminhos>`, `git diff --cached --quiet` (1 = há o que commitar), `git commit -m m1 -m m2` e `git rev-parse HEAD`. A saída é `{ tool: 'verify-run', mode: 'group', nonce, steps: [{ n, exit, done, out }], stopped, commit, head, digest }`, onde `done` segue `runDone` (saída 0 e JSON da CLI sem erro) e `out` é o stdout reduzido ao que o veredicto lê: para JSON da CLI, um JSON com a mesma forma (`tool`, `summary.exitCode`, `errors`, `result.id`, `changed`); para outra saída, os primeiros 2.000 caracteres.
- `verify-run.mjs read '<carga codificada>'` recebe `{ nonce, digest, cwd, cli, folder, E, word, piece, blockedStatus, expected: [comandos reduzidos a node "<cli>" <verbo>], runs: [{ n, exit, stdout }] }`, onde `runs` são os `steps` da saída confirmada do grupo (com `out` como `stdout`), copiados pelo workflow para a carga, que o `digest` protege. O script roda ele mesmo `status --json`, `brief --json` e `pending-decisions --json` da CLI, `git rev-parse HEAD` e `git status --porcelain`, aplica `recordVerdict` (movida do workflow com a assinatura de hoje: `expected`, `results`, `read`, `E`, `word`, `piece`, `blockedStatus`) e imprime `{ tool: 'verify-run', mode: 'read', nonce, ok, failures, decisionIds, holdIds, head, clean, checker, digest }`, sem os stdouts. Os comandos reduzidos bastam porque o grupo sempre nomeia o comando pelo número `n`, e `recordVerdict` só lê de `expected` o tamanho e o verbo.

`recordStatus` monta a carga do grupo e faz a chamada `${E}:status-<status>` ao `script-runner` em haiku/low; com a saída confirmada por `checkRun`, monta a carga de `read` e faz a chamada `${E}:status-<status>-read`, também ao `script-runner` em haiku/low, numa chamada própria e depois da escrita, como DEC-219 manda. O veredicto é o da saída confirmada de `read`, uma função pura sobre o JSON da CLI e a releitura do painel, como em DEC-219 e DEC-228. `S_RECORD` e `S_RECORD_READ` dão lugar a `S_RUN`. Saída do grupo não confirmada vale como falha do registro (`holdUnconfirmed`, como o agente nulo de hoje), sem a releitura e sem repetir o grupo, porque o grupo escreve; saída da releitura não confirmada também é falha do registro, sem repetir. Com `rc.commands` vazio, não há grupo e a releitura roda com `runs` vazios, como hoje. Quando a carga montada do grupo passa de 28.000 caracteres, os `steps` são divididos em trechos consecutivos sem partir um comando, cada trecho é um grupo com o seu `finally`, o trecho seguinte só roda se o anterior passou, e a releitura roda uma vez, depois do último trecho executado, com os `runs` de todos os trechos renumerados em ordem.

Na etapa de docs (DEC-228), o agente sonnet `${E}:docs<k>` continua fazendo a documentação do projeto e o commit da etapa, mas roda os comandos do item 2 por um grupo montado pelo workflow (`steps` = `cmds`, `finally` nulo, porque o commit dos docs é do agente) e devolve a saída literal no campo `outputs`. Cada comando condicional de `docsMaybe` vai num grupo próprio de um passo, com `nonce` e `digest` próprios, listado no prompt; o agente roda, depois do grupo principal, só os grupos dos itens que mantêm uma necessidade aberta (o julgamento de hoje) e devolve as saídas em `outputs`; como hoje, esses comandos não entram no veredicto, que só conta `cmds`. A medida `${E}:docs-measure<k>` continua separada e roda depois do commit do agente: o agente haiku/low roda o programa `DOCS.measure` como hoje e o comando `read` montado com os `runs` da saída confirmada do grupo principal (vazios quando ela não se confirma, o que reprova pela falta de comandos), e devolve o stdout literal de `read`, `measureOk` e `measureDetails`. Assim a releitura de `status` e `brief` continua na medida, sobre o estado final da pasta depois da última edição do agente: uma edição à mão em `state.md` ou um erro do checker introduzido depois do grupo aparecem no veredicto e em `CHECKERS[E]`, que vem do `checker` de `read`, ou seja, de `result.checker` de `brief --json` na medição da documentação. `clean` e `head` da medida também vêm de `read`; `commandsLeft` lê `steps[].done` do grupo principal e a segunda rodada volta a montar os grupos só com os comandos sem bom resultado, mais `set-status` quando a releitura reprova o painel. O falso positivo de E24 r3 some porque nenhum veredicto lê mais a cópia de `runs` feita pelo agente.

`flow.test.mjs`: o caso novo roda o caminho sem falhas de um entregável de uma tarefa com agentes simulados e confere que o rótulo `git-truth` não foi chamado, que `${E}:status-<executando>` e `${E}:status-<executando>-read` foram chamados nessa ordem e que o total de chamadas é `ANTES - 1`, onde `ANTES` é a contagem do mesmo roteiro medida pela primeira tarefa do plano em 3a1d3de e fixada no teste com comentário que cita o commit; outro caso responde ao grupo do registro com `steps` cujo segundo item saiu 1 e `stopped: { n: 2, exit: 1 }` e confere que nenhuma chamada repete o grupo, que a carga do comando de releitura traz os `runs` 1 e 2 e não o 3, e que as falhas da releitura chegam ao resultado do entregável. `verify-run.test.mjs` confere no script real que um grupo de três comandos cujo segundo falha não roda o terceiro, roda a fase `finally` e devolve o resultado de cada comando executado; que `read` sobre essa saída devolve a falha `command 2 (<verbo>) exit 1`; que um texto com `|`, `;`, `&&` ou `$(` é recusado sem rodar; e que carga com `digest` errado sai 2 sem rodar nada, nos três subcomandos. Os casos de `recordVerdict` que hoje estão em `flow.test.mjs` (a partir do comentário `// ---- recordVerdict`, mais o caso de worktree sujo perto da linha 3271) mudam para `verify-run.test.mjs` com as mesmas asserções, importando de `verify-run.mjs` (R10).

**O portador.** `agents/script-runner.md` segue a forma de `test-integrity.md`: `name: script-runner`, `tools: Bash`, sem `model` nem `effort` no frontmatter, a frase de `NO_ASK` literal, precedência do prompt; o corpo manda rodar exatamente o único comando dado, uma vez, sem editar arquivo, e devolver `exit` e o `stdout` inteiro, literal, sem resumir nem reformatar. As chamadas `discovery`, `${E}:status-<status>` e `${E}:status-<status>-read` despacham esse agente; o prompt do workflow guarda só o comando. A medida de docs e o relatório continuam com os seus agentes e recebem o comando com a mesma regra de cópia literal. `WORKFLOW_SCRIPTS` ganha `preflight.mjs` e `verify-run.mjs`, cujos caminhos ficam em `<raiz do plugin>/skills/roadmap-release/scripts/`, e `config.md` descreve as duas regras novas.

**Tamanho do script (nota do dono).** `roadmap-release.js` mede 239.898 caracteres LF em 3a1d3de. Saem o prompt da descoberta (4.642), `S_DISC` (1.693), o prompt da verdade do git (798), `recordVerdict` (4.624) e `truthDivergences` (1.070), e o prompt de releitura do registro (722) vira um comando curto; entram `checkRun`, os montadores de carga e as retentativas da descoberta. Cada tarefa que edita o script mede `workflowChars` de `size.test.mjs` depois de cada edição; nenhuma termina acima de 250.000, e o estado final fica em no máximo 239.898. Uma tarefa acima do seu limite não faz commit e devolve BLOCKED com o déficit medido. Cada conferência é uma chamada simples, sozinha, sem pipe nem encadeamento; vermelho e verde são duas chamadas do mesmo comando.

**Meta derivada.** A meta de E10 na tabela da estratégia (total ≤ 22 em `completo`, provisória) passa ao valor declarado aqui, como ela prevê (DEC-281): ≤ 22, provisória, conferida em E13: linha de base 23 menos a chamada `git-truth`, removida por construção (R7). A chamada `discovery-donot` só existe quando o roadmap tem itens no bloco `donot`; o cenário fixo de medição não tem esse bloco (nenhuma ocorrência de `donot` em `tools/measure/`).

**Teste comportamental (definição de pronto, SRC-03).** Tarefa do orquestrador da sessão principal no worktree de E10, antes do merge (DEC-204): no workflow ela devolve NEEDS_HUMAN, sem relatório fictício. O orquestrador abre sessões `claude -p` com `--plugin-dir` no worktree que levam a skill até o passo 2 e a montagem dos argumentos do passo 4 em `dry-run`, sem chamar o Workflow (DEC-230), e despacham `productivity-tools:script-runner` pelo nome com o comando `discover` sobre a pasta do roadmap e com um `group` seguido de `read` sobre fixture sintética marcada, conferindo a saída literal contra o `digest`; relatório em `docs/reports/`. A primeira execução do release com o plugin da ponta (item do executor em `state.md`) fica para depois do merge.

## Deixado para o plano

- A divisão em tarefas, com teste primeiro: scripts e seus testes antes da ligação no workflow; a primeira tarefa que toca `flow.test.mjs` mede e fixa `ANTES`.
- O texto exato do agente portador, dos prompts curtos e das mensagens de erro; os nomes finais das funções puras novas; a codificação da carga.
- Manter a saída `emit` do plan-tool abaixo de 24 KB; os gates G1, G2, G3 e G5 antes do fim; nenhum efeito externo.

```json data
{
  "schema": "spec/1",
  "id": "E10",
  "title": "Release mecânico por código",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada a pasta de exemplo, quando o script de descoberta roda, então devolve cards, dependências, status e bloqueios iguais aos lidos pelo checker. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um repositório após uma execução, quando o script de verificação roda, então devolve aprovado ou a lista de divergências entre o relatado e o git. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado um entregável de uma tarefa no caminho sem falhas, quando o workflow roda com agentes simulados, então o número de chamadas de agente é menor que o do workflow anterior no mesmo roteiro, e uma falha num comando agrupado interrompe o grupo e é devolvida. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica a descoberta por script e como ela chega ao workflow?",
      "decision": "Subcomando discover de preflight.mjs (função discoverRoadmap), com parseRoadmapTexts do lib/roadmap-format.mjs e as regras de git em execFileSync; devolve todos os campos que o workflow lê de S_DISC, incluindo today (--today quando dado, senão a data local) e pendingDecisions calculada sobre os textos lidos; sem --ref o alvo é releaseBranch ou integracao/<roadmapSlug>, a regra de hoje; wtRoot fica fora porque o workflow usa A.wtRoot. Saída { tool: 'release-discovery', nonce, digest, data }; a chamada discovery, ainda a primeira e com o RUN_TOKEN como nonce, despacha o script-runner, que copia o stdout; o workflow confere com checkRun e repete até 5 vezes (1-2 haiku, 3-5 sonnet), por ser só leitura. donotHolds continua num agente sonnet discovery-donot, chamado só quando donot não está vazio.",
      "basis": "Peça 1 e critério 1 do card; o teste de preflight.test.mjs já compara readRoadmapStructure com o checker; o workflow não lê arquivo (SRC-02 §4); o workflow exige A.today || disc.today e SKILL.md não passa today; load3 de DEC-640 para a cópia; o julgamento de donotHolds não é mecânico.",
      "alternative": "A sessão principal roda a descoberta no passo 2 da skill e a passa em args, o que tira a chamada mas faz a sessão opus recopiar dezenas de KB a cada lançamento.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como o workflow confia na saída copiada por um agente?",
      "decision": "Toda saída dos scripts novos leva nonce e digest = fnv1a(JSON.stringify(canon(...))) de lib/plan-digest.mjs, conferidos pela função pura checkRun com o canon e o fnv1a já embutidos; toda carga passada a verify-run.mjs leva o digest calculado pelo workflow e é recusada (saída 2, nada roda) quando não confere. Saída não confirmada: a descoberta repete; o grupo, a releitura e a verificação não repetem e valem como agente nulo.",
      "basis": "Itens do executor em state.md (cópia de agente não confiável; recordVerdict da etapa docs com falso positivo em E24 r3); DEC-640 usou o mesmo resumo no emit do plano.",
      "alternative": "Confiar na cópia como hoje e só reduzir o texto dos prompts.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como é o portador agrupado e o que acontece numa falha?",
      "decision": "verify-run.mjs group: tokenizador POSIX mínimo, só node e git por execFileSync sem shell, metacaracteres recusados; steps em ordem, parada no primeiro exit diferente de 0 com stopped { n, exit }; fase finally sempre (add, commit só com algo em stage, rev-parse HEAD) para deixar o worktree limpo; saída com { n, exit, done, out } de cada comando executado, out reduzido ao que o veredicto lê. O veredicto não é do grupo: é da releitura independente (R14). Carga acima de 28.000 caracteres vira trechos consecutivos, cada um com seu finally, um trecho falho impede os seguintes, e a releitura roda uma vez depois do último trecho executado.",
      "basis": "Peça 2, critério 3 e risco do card (resultado de cada comando, parada no primeiro erro); o registro de hoje commita mesmo depois de uma falha, para não deixar o worktree de integração sujo; limite de linha de comando do Windows (32.767).",
      "alternative": "Rodar cada texto por bash -c, que no Windows pode resolver para o bash do WSL e aceita qualquer comando.",
      "costIfWrong": "high",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Qual chamada sai do caminho sem falhas?",
      "decision": "A chamada git-truth: a verificação pós-execução (verify-run.mjs check) roda como primeiro passo do agente do relatório, que devolve o stdout literal em truthStdout, conferido pelo workflow com checkRun. O registro mantém as duas chamadas de DEC-219 (escrita e leitura independente, ambas haiku/low) e a etapa de docs mantém docs e docs-measure.",
      "basis": "Critério 3 do card; DEC-219 (registro por comandos montados em código num agente mecânico haiku/low, com uma leitura independente também em haiku/low; veredito de funções puras sobre o JSON da CLI e a releitura do painel), que fica atendida como escrita; o caminho sem falhas em modo run tem um só registro antes do merge (executando); a verdade do git é só leitura e o script dá o resultado com digest, então o agente do relatório só a carrega.",
      "alternative": "Juntar a releitura do registro à chamada de escrita, o que tira uma chamada mas descumpre a leitura independente de DEC-219 e pediria decisão do dono.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como fica a verificação pós-execução?",
      "decision": "verify-run.mjs check mede os campos de S_TRUTH por git e pelo sistema de arquivos, aplica truthDivergences (movida do workflow, mesmo texto) e imprime ok, divergences e truth com digest; roda dentro da chamada report, antes de qualquer escrita, e o workflow transforma as divergências confirmadas em ações do operador; saída nula ou não confirmada vale como o agente nulo de hoje; o formato de truth lido por SKILL.md não muda e o plan-only segue sem verificação.",
      "basis": "Peça 3 e critério 2 do card; R4.",
      "alternative": "Manter a chamada git-truth separada, agora com o script-runner, sem ganho de chamadas.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Onde fica o texto do portador?",
      "decision": "Agente novo productivity-tools:script-runner (agents/script-runner.md), tools: Bash, sem model nem effort, NO_ASK literal, que roda um único comando exato e devolve exit e stdout literal; o workflow passa só o comando nas chamadas discovery, status-<status> e status-<status>-read.",
      "basis": "Nota do dono (texto novo de prompt em arquivo de agente do plugin); forma de test-integrity.md (DEC-593).",
      "alternative": "Repetir a instrução de cópia literal em cada prompt do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual é a meta derivada de E10?",
      "decision": "Total de chamadas (haiku + sonnet + opus) na variante completo ≤ 22, provisória, conferida em E13: linha de base 23 menos a chamada git-truth, removida por construção. A chamada discovery-donot só existe com itens no bloco donot, que o cenário fixo de medição não tem.",
      "basis": "DEC-281 e a tabela de metas da estratégia (a meta de E10 é substituída pelo valor que o spec declarar); DEC-034 (meta = linha de base menos o que a mudança remove por construção); R4.",
      "alternative": "Declarar ≤ 21 tirando também a releitura do registro, o que contraria DEC-219.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como a entrega respeita o teto do script?",
      "decision": "Medir workflowChars de size.test.mjs depois de cada edição; nenhuma tarefa termina acima de 250.000 e o estado final fica em no máximo 239.898 (medido em 3a1d3de); tarefa acima do limite não faz commit e devolve BLOCKED com o déficit; size.test.mjs e MAX_WORKFLOW_CHARS não mudam.",
      "basis": "Nota do dono; DEC-647; saem cerca de 12.800 caracteres medidos (descoberta 4.642, S_DISC 1.693, verdade do git 798, recordVerdict 4.624, truthDivergences 1.070) e o prompt de releitura (722) vira um comando curto.",
      "alternative": "Permitir crescer até o teto de 250.000.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Quais itens do executor marcados para E10 em state.md entram?",
      "decision": "Entra o veredicto do registro e da etapa de docs vindo de script (R3, R14). Ficam fora: o hash da carga do approve em run-record.mjs (outro script e outro contrato, fora das três peças; a fidelidade segue medida no comportamental de E23), a parada preflight:recorded-invalid com trim (estágio de baseline, não descoberta; muda o conjunto de paradas da skill), TEST_INTEGRITY_DEFAULT como script (DEC-646 pede conferir essa chamada na primeira execução de E10 como está) e a medição de acerto por tentativa (medição de execução, não código).",
      "basis": "Nota do dono (o spec decide o escopo e pode deixar itens de fora com motivo); peças 1 a 3 do card; DEC-646.",
      "alternative": "Incluir os cinco itens.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Onde ficam os testes de recordVerdict e truthDivergences depois da mudança?",
      "decision": "As duas funções vão para verify-run.mjs, que é quem as aplica, recordVerdict com a assinatura de hoje; os casos de recordVerdict de flow.test.mjs e o de truthDivergences de merge.test.mjs mudam para verify-run.test.mjs com as mesmas asserções, importando do script, e merge.test.mjs deixa de pedir truthDivergences ao loadPure; o log de revisões registra a mudança para a medida de integridade dos testes.",
      "basis": "Nota do dono (lógica nova em scripts do plugin; só ligação no workflow); arquivos de teste do card; merge.test.mjs testa truthDivergences hoje (loadPure e o teste 'truthDivergences: requires lastGoodReachable').",
      "alternative": "Embutir recordVerdict e truthDivergences no workflow por embed.mjs só para manter os testes por loadPure, sem ganho de tamanho.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Quem faz o teste comportamental da skill?",
      "decision": "O orquestrador da sessão principal, no worktree de E10 antes do merge: sessões claude -p com --plugin-dir que levam a skill até o passo 2 e a montagem dos argumentos do passo 4 em dry-run, sem chamar o Workflow, e despacham o script-runner pelo nome com discover e com group seguido de read sobre fixture sintética marcada; relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.",
      "basis": "DEC-204; DEC-230; definição de pronto do card (SRC-03).",
      "alternative": "Rodar o release inteiro em sandbox dentro do workflow.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "A descoberta devolve os critérios de todos os cards?",
      "decision": "Não: card cujo status de código está em integratedStatuses ou é discardedStatus vem com acceptance vazia e acceptanceOmitted: true; os demais trazem os critérios literais. O workflow só lê acceptance dos entregáveis selecionados (specCardMismatch, noCriteria, cardAc), e a seleção nunca escolhe card integrado ou descartado; um caso de flow.test.mjs confere isso.",
      "basis": "A cópia literal da saída por agente erra mais quanto maior a carga (item do executor em state.md: haiku 13/23 antes de fix/carga-plano).",
      "alternative": "Devolver os critérios de todos os cards.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Há bump de versão?",
      "decision": "Não; config.md, operator.md e SKILL.md são ajustados onde descrevem a descoberta, o registro e a verdade do git, e a seção de agentes do README do plugin ganha a linha do script-runner.",
      "basis": "Nota do dono.",
      "alternative": "Subir a versão nos dois lugares.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "De onde vem o veredicto do registro e da etapa de docs?",
      "decision": "De verify-run.mjs read, uma chamada própria depois da escrita, que relê status, brief e pending-decisions da CLI, HEAD e porcelain por conta própria e aplica recordVerdict sobre os resultados confirmados do grupo; no registro é a chamada status-<status>-read do script-runner em haiku/low; na etapa de docs roda dentro de docs-measure, depois do commit do agente de docs, junto com DOCS.measure, e o checker de CHECKERS vem dela. Os comandos condicionais de docsMaybe vão cada um num grupo próprio que o agente de docs roda por julgamento e ficam fora do veredicto, como hoje.",
      "basis": "DEC-219 (leitura independente haiku/low; veredito de funções puras sobre o JSON da CLI e a releitura do painel); DEC-228 (checker da medição da documentação vem de result.checker de brief --json); a releitura depois do último commit do agente vê uma edição à mão ou um erro do checker introduzido depois do grupo; falso positivo de E24 r3 (veredicto sobre a cópia de runs pelo agente).",
      "alternative": "Tirar o veredicto da saída do grupo rodado pelo agente de docs, o que deixa de ver o que ele muda depois do grupo.",
      "costIfWrong": "medium",
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
      "input": "O segundo comando de um grupo de registro sai 1.",
      "expected": "O terceiro não roda; a fase finally commita o que foi escrito; a saída traz stopped { n: 2, exit: 1 }; a releitura independente roda com os runs 1 e 2 e devolve a falha command 2 (<verbo>) exit 1; o workflow não repete o grupo e segura as decisões (holdUnconfirmed)."
    },
    {
      "id": "C2",
      "input": "O agente copia errado: a saída do grupo com um caractere trocado, ou o comando com a carga corrompida.",
      "expected": "Saída trocada: checkRun recusa pelo digest e o registro vale como não confirmado, sem releitura e sem nova execução do grupo. Carga corrompida: verify-run.mjs sai 2 sem rodar nada, porque o digest da carga não confere."
    },
    {
      "id": "C3",
      "input": "Registro com decisões cuja carga do grupo passa de 28.000 caracteres.",
      "expected": "Os comandos são divididos em trechos sem partir nenhum; um trecho falho impede os seguintes; a releitura roda uma vez, com os runs de todos os trechos executados."
    },
    {
      "id": "C4",
      "input": "Na etapa de docs, o agente edita state.md à mão depois de rodar o grupo e commita.",
      "expected": "A releitura de docs-measure roda depois do commit e reprova pelo painel ou pelo checker; CHECKERS[E] mostra o checker do estado final."
    },
    {
      "id": "C5",
      "input": "Execução sem today em args.",
      "expected": "discover devolve today com a data local do sistema e a descoberta não para por falta de today."
    }
  ]
}
```
