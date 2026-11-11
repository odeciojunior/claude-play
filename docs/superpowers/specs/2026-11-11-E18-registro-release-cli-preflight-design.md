# E18 -- Registro do release pela CLI e permissões no preflight (design)

Entregável E18 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQ: REQ-021, REQ-040, REQ-044. Depende de E3 (CLI do tracker `roadmap.mjs`, DEC-136 a DEC-157, ratificadas pelo dono em 2026-11-11 com as emendas DEC-200 a DEC-202; BLQ-2 fechado) e de E14 (regra de permissão pelo nome do script, DEC-060; código de workflow sem import, DEC-058). Card crítico, trilha de engenharia, fase roadmap-sem-llm. O lançamento pelo nome ficou em E25 (DEC-047).

## Por quê

Cada registro feito pelo release abre hoje uma sessão de LLM (sonnet) com a skill do tracker, que edita `state.md`, `decisions.md` e `log.md` à mão, e o workflow confia no `statusWritten` e no `checkerErrors` que esse agente devolve (`recordStatus`, `roadmap-release.js`; SRC-02 §3, SRC-10). A CLI de E3 já faz essas edições de forma determinística e conferida pelo checker. O preflight, por sua vez, não vê os comandos `{verify}` dos cards nem os scripts do plugin que os subagentes rodam (SRC-02 §4; `references/config.md` admite a lacuna), e a regra de ratificação pede que as decisões do executor pendentes apareçam no lançamento (DEC-030, DEC-031).

## Critérios de aceite (do card, literais)

1. Dado um card com comando de verificação e um script do plugin que nenhuma regra de permissão das configurações cobre, quando o preflight roda, então as duas regras aparecem na lista de regras ausentes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado o workflow do release, quando ele registra o status de um entregável, no registro de status e na etapa de documentação, então o status e a linha de log são gravados por comando da CLI, e não por edição feita pela skill do tracker. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado um registro em que o status lido do painel depois da gravação não é o pedido, ou em que a CLI devolveu erro, inclusive ao gravar uma decisão do executor, quando o workflow recebe o retorno, então trata o registro como falho por código, sem depender do que o agente relata. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dada uma pasta com uma decisão do executor pendente, quando o preflight roda com a branch alvo, então a decisão aparece na saída com o entregável a que pertence. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1: o preflight lista as regras de permissão dos scripts do plugin que os agentes do workflow rodam e as dos comandos de verificação dos cards abertos.
- Peça 2: o registro de status do release (status, linha de log, decisões do executor, pendentes e linha em andamento) é feito por comandos exatos da CLI de E3, montados pelo código do workflow, e o resultado é conferido por código numa leitura independente.
- Peça 3: a parte de roadmap da etapa de documentação é feita pela mesma via.
- Peça 4: o preflight lista as decisões do executor pendentes por entregável, lidas da branch alvo, e a skill as mostra na parada única antes de qualquer agente.

Não objetivos:

- Lançar o workflow pelo nome, registrar o workflow no manifesto, trava por token ou concessão por `allowed-tools`: são de E25.
- Reter os dependentes de uma decisão de contrato pendente no código do release: é de E8 (DEC-031). Aqui a regra continua escrita; o preflight só lista.
- Mudar a semântica de autorização de efeito externo, de retomada, de revisão ou de merge (risco do card). Nenhuma regra dessas áreas muda; os testes atuais continuam passando, exceto onde o teste fixa o texto ou o esquema do próprio registro, que este card substitui.
- Mudar o modelo de algum revisor ou autor (DEC-021).
- Subir versão de plugin ou a linha 1 do checker (estratégia, "Execução deste roadmap"; DEC-042).
- Editar `docs/plans/roadmap-evolucao-skills/` ou `plugins/_template/`.
- Comandos novos na CLI de E3. A única mudança em `roadmap.mjs` é exportar a função de decisões pendentes que já existe.

Anti-objetivos (falha mesmo funcionando):

- O workflow aceitar um registro porque o agente disse que deu certo: o veredito vem do JSON da CLI e da releitura do painel, avaliados pelo código.
- Um texto vindo de spec, de revisão ou de nota do dono chegar ao shell sem escape, ou quebrar o comando montado.
- Um texto longo (decisão, risco, entrada humana, critério, motivo de bloqueio) fazer a CLI recusar o registro por `cell-too-long` no fluxo normal.
- O veredito do registro depender da versão do checker copiado na pasta do roadmap.
- Uma linha de log repetida a cada retomada para um status que já estava gravado.
- O preflight gravar qualquer arquivo ou configuração (hoje é só leitura; continua).

## Desenho

### Arquivos

| Arquivo | Mudança |
|---|---|
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` | regras dos scripts do plugin e dos comandos `{verify}` (peça 1); `trackerCli`; `pendingDecisions` lidas da branch alvo (peça 4) |
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | casos dos critérios 1 e 4 |
| `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` | registro pela CLI (peças 2 e 3): funções puras de montagem e conferência, `recordStatus` e etapa de documentação reescritos |
| `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | casos dos critérios 2 e 3; ajuste dos mocks e das asserções que fixam o texto ou o esquema do registro antigo |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` | `export` em `pendingDecisions` (sem mudança de comportamento) |
| `plugins/productivity-tools/skills/roadmap-release/SKILL.md` | passo 2 (caminho entre aspas, `pendingDecisions`, `trackerCli`), passo 4 (passar `trackerCli`) |
| `plugins/productivity-tools/skills/roadmap-release/references/config.md` | regras exigidas: scripts do plugin e comandos `{verify}`; some a frase de que o preflight não os vê |

Outros arquivos de teste do workflow (`prompts.test.mjs`, `review.test.mjs` e os demais) só mudam se fixarem texto que este card substitui; nenhum caso novo entra neles.

### Peça 1 -- regras de permissão no preflight

Scripts do plugin. O preflight passa a exigir uma regra por script do plugin que os agentes do workflow rodam, na forma que a sonda de E14 confirmou: `Bash(node *<nome do arquivo>" *)`, sem versão no caminho e sem curinga depois de barra invertida (DEC-060; resultados de E14, peça 2). A lista é uma constante exportada, `WORKFLOW_SCRIPTS = ['roadmap.mjs']`: a CLI do tracker. O workflow deixa de rodar o checker copiado na pasta do roadmap (`check-roadmap.mjs`): o veredito do checker vem de `brief --json` da CLI (ver "Fonte do veredito do checker" nas peças 2 e 3), então nenhum prompt do workflow chama esse arquivo e ele não pede regra. Para a forma da regra casar, toda chamada da CLI nos prompts do workflow tem o caminho entre aspas duplas e ao menos um argumento depois dele. Um teste em `flow.test.mjs` confere que todo `node "..."` de script do plugin nos prompts do workflow usa um nome de `WORKFLOW_SCRIPTS` e segue essa forma, e que nenhum prompt cita `check-roadmap.mjs`.

A cobertura usa a lógica atual de `missingRules`: cada regra de script recebe como comando de amostra `node "<caminho>" status`, então ela fica coberta pela própria regra, por `Bash(node:*)`, por `Bash`, por `Bash(*)` ou por uma regra exata. `Bash(node:*)` e `Bash(git:*)` continuam exigidos como hoje: o workflow também roda programas Node temporários (medição da documentação, integridade dos testes), que regra pelo nome não cobre.

Comandos de verificação. O preflight lê os cards da estratégia (da branch alvo quando `--ref` aponta para uma branch que tem a pasta; senão, da árvore de trabalho, com aviso) e, para cada card aberto, cada critério com `verify` em `test`, `smoke` ou `integration` (`EXECUTABLE_KINDS` do parser) e evidência não vazia entra em `requiredCommands` como os comandos dos gates: partido em subcomandos por `subcommands`, sem prefixo de variável, regra `Bash(<primeira palavra>:*)` com o subcomando como amostra. Card aberto = algum segmento do status do painel numa posição anterior à de na-branch (`deliverableStatuses[4]`, a mesma que o workflow usa como `onBranch`) ou na palavra de bloqueado; card sem linha no painel conta como aberto. Os comandos dos cards já na branch ou integrados não rodam de novo e não pedem regra.

`requiredCommands(cfg, extras)` ganha um segundo parâmetro opcional `{ cards, scripts }`; sem ele, a saída é a de hoje, o que mantém os testes atuais. A saída do preflight ganha:

- `trackerCli`: caminho absoluto da CLI do tracker, resolvido a partir do próprio `preflight.mjs` (`../../roadmap-tracker/scripts/roadmap.mjs`), com `/` como separador. Ausente, ou com aspas duplas no caminho: entra em `errors`.

### Peça 4 -- decisões do executor pendentes no preflight

`roadmap.mjs` passa a exportar `pendingDecisions(ctx)`, que hoje serve o comando `pending-decisions` (a regra de `executor-decision-pending`, DEC-111: alcance por `decisionScope`, dependentes já iniciados, entregável publicado). O preflight monta o `ctx` mínimo que ela usa (`{ roadmap: { config }, parsed }`) a partir dos textos da pasta na branch alvo, lidos com `git show <ref>:<caminho>` (`roadmap.config.json`, estratégia, `state.md`, `decisions.md`), e com `parseRoadmapTexts`. Sem `--ref`, ou quando a branch alvo não tem a pasta, lê a árvore de trabalho e acrescenta um aviso dizendo de onde leu.

A saída ganha `pendingDecisions: [{ id, deliverable, scope, startedDependents, released }]`, na ordem de `decisions.md`. Leitura que falha (arquivo ausente, JSON inválido) vira aviso, nunca erro: a lista é informação para a parada, não condição do preflight.

Na skill (passo 2), `pendingDecisions` entra na parada única que já existe:

- Em `run`, a parada acontece também quando há ao menos uma pendente de alcance `contract`, mostrada por entregável, com os dependentes já iniciados; as de alcance `local` são só listadas no relatório (DEC-030: local espera o ponto de medição). A pessoa ratifica ou rejeita pelo tracker, ou diz para seguir; a skill nunca ratifica sozinha. Depois da resposta, o preflight roda uma vez de novo e a execução segue, sem segunda parada pelas mesmas decisões.
- Em `dry-run` e `plan-only`, só relata.

### Peças 2 e 3 -- registro pela CLI no workflow

O workflow continua sem ler arquivos nem rodar processos (DEC-058): ele monta, em código, a lista exata de comandos, um agente mecânico os roda e devolve a saída crua, e uma leitura independente devolve o painel pela própria CLI. O veredito é calculado por funções puras sobre o JSON da CLI.

Shell dos comandos. Todo prompt que entrega comandos montados (agente de registro, leitura independente, agente de documentação e sua medição) exige, numa cláusula fixa vinda de uma constante do código (`BASH_ONLY`), que cada comando rode exatamente como foi escrito, um por chamada, na ferramenta Bash (Git Bash no Windows), nunca na ferramenta PowerShell nem em `cmd`, sem reescrever aspas nem escapes; sem a ferramenta Bash, o agente não roda nada e devolve a lista vazia com `error: "no-bash"`, o que reprova o veredito. Motivo: o escape de `shq` é POSIX (`'\''` muda de sentido no PowerShell) e a regra `Bash(node *roadmap.mjs" *)` só vale para a ferramenta Bash. Um teste em `flow.test.mjs` confere que todo prompt com comandos montados traz `BASH_ONLY` literal.

Fonte do veredito do checker. O workflow não roda o checker da pasta: a cópia na pasta pode ser mais antiga que a do plugin e não aceitar `--json` (a deste roadmap, `check-roadmap 1.5.0`, ignora a opção e imprime só o texto), e ela só é renovada depois de uma publicação (E17). O veredito usa `result.checker.errors` de `node "<trackerCli>" brief "<roadmapDir>" --json`, que a CLI calcula em memória com o checker do próprio plugin, o mesmo que confere cada escrita (DEC-143). O objeto `checker` (`folder`, `plugin`, `stale`, `errors`, `warnings`, `errorCodes`, `warningCodes`) só existe na saída de `brief`; `status --json` devolve estratégia, cabeçalho, painel, bloqueios, agora, pendentes e em andamento, sem `checker` (medido nesta branch: `status` sem `result.checker`, `brief` com `checker: { folder: '1.5.0', plugin: '1.5.0', stale: false, errors: 0, warnings: 6 }`). Por isso toda releitura roda os dois comandos: `status --json` para a palavra do painel e `brief --json` para o checker. Saída de `brief` ausente, que não é JSON da CLI, ou sem `result.checker.errors` numérico reprova o veredito: a falta do dado nunca passa como checker sem erro. `result.checker.stale`, `result.checker.warnings` e a versão da cópia (`result.checker.folder`) entram só como informação no relatório final; renovar a cópia é `refresh-checker`, do tracker, fora do release.

Argumento novo `trackerCli` (da saída do preflight). Ausente: o workflow devolve erro antes de qualquer agente, como faz com `config`. Na retomada, a skill o substitui pelo do preflight novo, como `config` e `runToken`. A descoberta deixa de exigir `trackerAvailable` (nenhum estágio usa mais a skill do tracker) e passa a devolver `language` de `roadmap.config.json` (vazio quando ausente).

Funções puras novas (entre os marcadores `// <pure>` e `// </pure>`, carregadas por `load-pure.mjs` e testadas em `flow.test.mjs`):

- `shq(s)`: aspas simples POSIX (`'` vira `'\''`); quebras de linha viram espaço antes. Todo texto variável vai por ela; o caminho da CLI vai entre aspas duplas (a forma da regra de permissão), e caminho com aspas duplas já foi recusado no preflight. Vale só no shell da ferramenta Bash (ver "Shell dos comandos").
- `fitCell(text, room, source)` -> `{ text, cut }`: junta espaços (como `collapse` da CLI) e devolve o texto inteiro quando ele cabe em `room`; senão corta na última palavra que cabe e acrescenta o sufixo da tabela de frases (`[...] texto completo em <source>` / `[...] full text in <source>`), com o total dentro de `room`. `room` é o limite da célula descontado do que a CLI acrescenta na mesma célula: a frase de alcance em `add-decision`, `(<dono>) ` em `add-pending`. `source` é o nome do arquivo comitado que guarda o texto inteiro (o spec, o log de revisões ou o plano). `cut` = o texto original quando houve corte, vazio no resto.
- `fitEvidence(refs, max)`: mantém as referências na ordem dada enquanto a junção que a CLI faz (crases e `, `) cabe em `max`; as que sobram saem da linha de log e ficam só na célula de evidência do painel.
- `cliCmd(cli, command, folder, args)`: `node "<cli>" <comando> <pasta> <args...> --json`.
- `recordCommands({ E, word, piece, blockedBy, evidence, next, logWhat, decisions, pending, inflight, skipStatus, lang })`: a lista ordenada de comandos de um registro, nesta ordem: `block-close` (quando o segmento está bloqueado por um bloqueio que afeta só `E`), `set-status` e `log` (omitidos quando `skipStatus`), `add-decision` por decisão, `add-pending` por item, `inflight-add` ou `inflight-remove`. O status de bloqueado vai por `block-open`, que grava a própria linha de log (DEC-149). Todo texto variável passa por `fitCell` antes de entrar no comando (`--decision`, `--discarded`, `--revisit`, `--contradicts`, `--text`, `--what`, `--unblocks`, `--note`, `--next`), e a evidência de `log` e de `block-open` por `fitEvidence`, com `limits.cellChars` do `roadmap.config.json` da pasta (300 quando ausente). `recordCommands` devolve também `cuts: [{ where, source, full }]`, um por texto cortado.
- `recordVerdict({ expected, results, read, E, word, piece })` -> `{ ok, failures, decisionIds }`: falha quando um comando esperado falta, aparece fora de ordem ou com texto diferente; quando um `exit` não é 0; quando a saída não é JSON da CLI (`tool: "roadmap"`) com `summary.exitCode` 0 e `errors` vazio; quando a releitura (`status --json`) não mostra, no segmento `piece` da linha `E`, a palavra pedida (ou a de bloqueado com a nota `BLQ-n` devolvida por `block-open`); quando a releitura não traz a saída de `brief --json` como JSON da CLI com `result.checker.errors` numérico, ou quando esse número é maior que 0; quando um `add-decision` que mudou arquivo devolve um id que não está em `pending-decisions --json`. Também falha quando o agente devolve `error: "no-bash"` ou a lista vazia. O veredito nunca lê `statusWritten`, `details` nem outra frase do agente.

Segmento. Quando a célula de status de `E` (verbatim da descoberta) tem rótulos, os comandos levam `--piece code`, o segmento que o release já trata como o do código (regra 7 da descoberta); sem rótulos, nenhum `--piece`.

Retomada sem log repetido. O workflow guarda a última palavra gravada por entregável (começa com a do segmento lido na descoberta). Se a palavra pedida é a mesma, `set-status` e `log` saem da lista (`skipStatus`) e a releitura confere a palavra igual; decisões, pendentes e linha em andamento seguem, porque a CLI os trata como no-op quando já existem (DEC-150).

Frases. O texto de `log --what`, `--next`, `--note` de em andamento, `block-open --what/--unblocks`, o dono dos pendentes e a mensagem de commit saem de uma tabela no código com duas línguas: `language` começando por `pt` usa português (dono `dono`), qualquer outra usa inglês (dono `owner`), a mesma regra da CLI (DEC-153). Pela emenda DEC-202, em `log` o `--what` é o próprio texto da linha, e em `block-open` é o texto do bloqueio, que a linha de log cita com o prefixo padrão da CLI; o release não passa `--what` a `integrate`, `ratify` nem `reject`. `log --what` fica abaixo de `limits.cellChars` do contrato (300) e sem frase de `bannedPhrases`. Os textos que vêm de fora da tabela (decisões do spec, riscos aceitos formatados por `fmtRisk`, entradas humanas, critérios sem evidência automática, motivo de bloqueio) passam por `fitCell`; o texto inteiro fica no arquivo comitado que `source` nomeia e, no registro de `plano`, no de `executando` e no de bloqueado, também em `out.recordCuts`, que `persistReviews` transcreve no log de revisões numa seção "Textos cortados no registro" (origem, onde entrou e texto inteiro). Na etapa de documentação, que roda depois do último `persistReviews`, os riscos e as entradas humanas já estão inteiros no log de revisões integrado e os critérios no plano, e `source` aponta para esses arquivos.

`recordStatus(E, status, refs, extra)` passa a:

1. Montar os comandos (`recordCommands`) com as referências como `--evidence` (caminhos do spec e do plano, SHA quando houver) e, de `extra`, as decisões do spec (texto sem a frase final de alcance, que vira `--scope local` só quando a frase é `Alcance: local.` ou `Scope: local.`, e `contrato` no resto, a regra de `decisionScope`), os pendentes não bloqueantes e a linha em andamento.
2. Despachar o agente de registro (`${E}:status-${status}`, haiku/low, mecânico, T0) no worktree de integração: com a cláusula `BASH_ONLY`, roda os comandos exatamente, em ordem, na ferramenta Bash, para no primeiro `exit` diferente de 0, devolve `{ command, exit, stdout }` de cada um, e então comita só a pasta do roadmap (`git add -- <roadmapDir>`; commit apenas se algo ficou em stage), com a mensagem da tabela e o trailer.
3. Despachar a leitura independente (`${E}:status-${status}-read`, haiku/low, só leitura, com `BASH_ONLY`): `status --json` (palavra do painel), `brief --json` (veredito do checker), `pending-decisions --json`, `git rev-parse HEAD` e `git status --porcelain`, devolvendo as saídas cruas.
4. Acrescentar os `cuts` de `recordCommands` a `out.recordCuts` e calcular `recordVerdict`. Falhou: o registro é falho por código. No `plan-only`, o entregável falha (`infra`) como hoje falhava com `checkerErrors > 0`; no registro de `executando`, vira `concern` como hoje; no de bloqueado (dentro de `safe`), segue como melhor esforço. `lastGood` só avança com veredito ok e `head` lido na releitura.

Etapa de documentação. O agente `${E}:docs<k>` continua fazendo a documentação do projeto (item 1, quando configurada) e recebe a lista exata de comandos da parte de roadmap: `set-status` para `STATUS_AFTER_MERGE` com evidências (SHA do merge, spec, plano, log de revisões, nomes dos gates verdes), `log`, `inflight-remove`, e um `add-pending` por risco aceito, por entrada humana e por critério sem evidência automática, cada texto já passado por `fitCell`. O prompt traz `BASH_ONLY`. Ele não edita arquivo da pasta do roadmap à mão. Os itens humanos com a marca `[already authorized and run in this run: ...]` continuam no julgamento do agente, como hoje (sai do pendente quando só pedia aquela autorização; qualquer outra necessidade fica): para os que ficam, ele roda o `add-pending` montado para o item, sem mudar o texto. O agente devolve `{ command, exit, stdout }` de cada comando, e `${E}:docs-measure<k>` passa a devolver crus `status --json` (palavra do painel) e `brief --json` (o veredito do checker vem dele), além de `clean`, `head` e da medição do projeto, também com `BASH_ONLY`. `docsOk` = `recordVerdict` ok, checker sem erro, árvore limpa e medição do projeto ok. Na segunda rodada, só entram os comandos que não tiveram veredito ok na primeira, o que evita repetir a linha de log. A proibição de revisão da estratégia e de migração de formato continua no prompt.

O relatório final passa a citar, no item do checker, `result.checker` de `node "<trackerCli>" brief "<roadmapDir>" --json` (erros, avisos, versão da cópia da pasta e `stale`), e não roda mais `node <checker>`. A descoberta continua devolvendo `checker` e `checkerExists` como hoje; o workflow só não executa esse arquivo.

### Testes

`preflight.test.mjs`:

- Critério 1: configurações sem regra de `node` nem de `npx`, um card aberto com `{verify: test; evidence: npx vitest run}` e o script `roadmap.mjs` em `WORKFLOW_SCRIPTS`: `missingRules` traz `Bash(npx:*)` e `Bash(node *roadmap.mjs" *)`. Com `Bash(node:*)` e `Bash(npx:*)` nas configurações, nenhuma das duas falta. Card já na branch: o comando dele não entra. Sem o segundo parâmetro, `requiredCommands` devolve o mesmo de hoje.
- Critério 4: repositório git temporário com a pasta de exemplo; na branch alvo, `decisions.md` com uma linha de origem `executor` e status pendente de `E2`; na árvore de trabalho, sem ela. `runPreflight(folder, { ref })` traz em `pendingDecisions` o id com `deliverable` `E2` e o alcance; sem `ref`, a lista vem da árvore de trabalho (sem a decisão) e há o aviso de origem.
- `trackerCli` aponta para um arquivo que existe; caminho com aspas duplas vira erro.

`flow.test.mjs`:

- Critério 2: nos registros de `plano`, `executando` e na etapa de documentação, o prompt traz `node "<trackerCli>" set-status` e `node "<trackerCli>" log` para `E1`, e nenhum prompt de registro cita `roadmap-tracker`. Decisões do spec viram `add-decision`, entradas humanas viram `add-pending`, e a branch vira `inflight-add` e, no fim, `inflight-remove`.
- Critério 3: (a) releitura com outra palavra no painel: registro falho (no `plan-only`, o entregável falha; no `executando`, há `concern`), mesmo com o agente de registro devolvendo tudo com `exit` 0; (b) `add-decision` com `exit` 1 e `errors` não vazio: falho; (c) agente que devolve `exit` 0 mas `stdout` que não é JSON da CLI, ou omite um comando: falho; (d) na documentação, falha da releitura leva à segunda rodada só com os comandos que faltaram e, persistindo, à ação de operador `docs`.
- Funções puras: `shq` com aspas, `$`, crase e quebra de linha; `fitCell` com texto que cabe (inalterado, `cut` vazio), com 600 caracteres (resultado dentro de `room`, termina no sufixo com `source`, corta em fronteira de palavra) e com `room` descontando a frase de alcance; `fitEvidence` com referências que passam do limite; `recordCommands` com e sem `piece`, com `skipStatus`, com bloqueio e com uma decisão de 600 caracteres (o `--decision` montado mais a frase de alcance cabe em 300, e `cuts` traz o texto inteiro); `recordVerdict` nos casos acima, com `result.checker.errors` maior que 0 no `brief --json` da releitura, com a saída de `brief` ausente ou sem `result.checker` (falho, nunca aprovado em silêncio), com uma saída de `status --json` sem `checker` ao lado de um `brief` sem erro (aprovado: o checker é lido só de `brief`) e com `error: "no-bash"`.
- Textos longos no fluxo: registro de `executando` com uma decisão do spec e uma entrada humana acima de 300 caracteres: os comandos montados cabem no limite, o registro não vira `concern` por isso, e os textos inteiros chegam aos dados de `persistReviews` em `recordCuts`.
- Shell: todo prompt de registro, de releitura, de documentação e de medição da documentação traz a cláusula `BASH_ONLY` literal.
- Checker: nenhum prompt gerado cita `check-roadmap.mjs`; a releitura e a medição pedem `status --json` e `brief --json`.
- Forma das chamadas de script: todo `node "...roadmap.mjs"` nos prompts gerados tem aspas e argumento depois (peça 1).
- Falta de `trackerCli`: erro antes de qualquer chamada de agente.

### Teste comportamental (definição de pronto, SRC-03)

Pela emenda DEC-204, a execução comportamental não roda dentro do workflow do release, cujo executor não tem ferramenta de subagent (BLQ-1): o plano a marca como tarefa do orquestrador da sessão principal, que despacha os subagents no tier do plano, repassa a saída literal e escreve o relatório. O executor do workflow não tenta despachar subagents para ela.

Na tarefa do orquestrador, um subagent segue o `SKILL.md` do release literalmente sobre a pasta real `docs/plans/roadmap-evolucao-skills/`, em `dry-run`, até o passo 2 e a montagem dos argumentos do passo 4 (sem chamar o Workflow): roda o preflight com `--ref release/roadmap-skills-v2`, compõe a parada com `missingRules` e `pendingDecisions`, e grava a saída e a lista de ambiguidades em `D:/projects/claude-play-wt/_tmp/E18/`. Em seguida, uma revisão adversarial só de leitura do resultado. O resumo entra no log de revisões do entregável; a pasta temporária é apagada no fim.

### Verificação fora dos testes

Antes de cada commit: G1, G2, G3, G4 e G5. Um uso manual do preflight sobre a pasta real (só leitura) confirma que `pendingDecisions` lista as decisões pendentes de `decisions.md` e que `missingRules` mostra as regras dos scripts quando as configurações não têm `Bash(node:*)`.

## Casos de borda

- Card com comando `{verify}` que tem efeito externo: a regra aparece como as outras; a pessoa pode seguir sem ela na parada, como já pode para gates.
- Pasta sem `roadmap:gates` ou sem cards: nenhuma regra de card; o resto do preflight é o de hoje.
- Segmento de `E` bloqueado por um bloqueio que afeta outros entregáveis: o registro não fecha o bloqueio; falha por código com a mensagem de que o bloqueio precisa ser fechado à mão.
- `set-status` recusado por `status-backward` (pedido anterior ao status gravado): registro falho, sem tratamento especial.
- Decisão do executor pendente com Entregável `-`: a regra de `pendingDecisions` já inclui a emenda DEC-198 (aviso quando qualquer entregável está liberado); o preflight a lista com `deliverable` `-`.
- Registro de status até a posição 5 com SHA na evidência num ambiente sem git: a CLI aceita com o aviso `no-git` (emenda DEC-201); aviso não reprova o veredito, só erro.
- Spec sem decisões e sem entradas humanas: o registro é só `set-status`, `log` e a linha em andamento.
- Pasta com checker copiado antigo, sem `--json` (caso da pasta deste roadmap até E17): nada muda no registro, porque o veredito vem de `brief --json` da CLI; o relatório mostra `stale`.
- Texto longo (o `decisions.md` deste roadmap já tem 28 linhas acima de 300 caracteres): entra cortado por `fitCell`, com o texto inteiro no arquivo nomeado e em `recordCuts`; nunca chega à CLI acima do limite.
- Host sem a ferramenta Bash: o agente devolve `no-bash` e o registro é falho por código (no `plan-only`, `infra`), sem tentar outro shell.

## Deixado ao planejador

- Ordem das tarefas e divisão em até quatro arquivos por tarefa. Uma ordem natural: preflight (peças 1 e 4, com o export em `roadmap.mjs`) e seus testes; funções puras do workflow e seus testes; `recordStatus` e a etapa de documentação com os testes de fluxo; skill e `config.md`; teste comportamental.
- Os textos exatos da tabela de frases, desde que caibam no limite de célula e citem o entregável e o status.
- A forma exata do commit do agente de registro (comando condicional ou devolução do stage vazio), desde que só a pasta do roadmap entre e nada seja comitado quando nenhum comando mudou arquivo.

## Decisões autônomas (revisáveis pelo dono)

1. A regra de permissão de script do plugin tem a forma `Bash(node *<nome>" *)`, a confirmada na sonda de E14, e as chamadas desses scripts nos prompts do workflow passam a ter o caminho entre aspas duplas e ao menos um argumento. Alcance: contrato.
2. Os scripts listados são os que os agentes do workflow rodam, numa constante exportada `WORKFLOW_SCRIPTS = ['roadmap.mjs']`; o checker copiado na pasta não entra porque o workflow deixa de rodá-lo, e o `preflight.mjs`, que a sessão principal roda com a pessoa presente, também não. Alcance: contrato.
3. `Bash(node:*)` e `Bash(git:*)` continuam exigidos, porque o workflow roda programas Node temporários que a regra pelo nome não cobre; as regras de script são listadas além dela e ficam cobertas por ela. Alcance: local.
4. Os comandos `{verify}` listados são os de critérios executáveis (`test`, `smoke`, `integration`) dos cards abertos (algum segmento antes de na-branch, ou bloqueado, ou sem linha no painel), lidos da branch alvo quando ela tem a pasta. Alcance: local.
5. O preflight devolve `trackerCli`, o caminho absoluto da CLI com `/`, e o workflow exige esse argumento antes de qualquer agente; na retomada ele é substituído como `config`. Alcance: contrato.
6. `roadmap.mjs` exporta `pendingDecisions`, e o preflight a usa sobre os textos lidos da branch alvo, em vez de reimplementar a regra. Alcance: local.
7. A saída do preflight ganha `pendingDecisions: [{ id, deliverable, scope, startedDependents, released }]`; falha de leitura vira aviso. Alcance: contrato.
8. Em `run`, uma decisão do executor pendente de alcance contrato faz a parada única do passo 2 acontecer; as de alcance local só são listadas; em `dry-run` e `plan-only`, só relato. A skill nunca ratifica. Alcance: local.
9. O registro é feito por comandos montados em código e rodados por um agente mecânico em haiku/low, com uma leitura independente também em haiku/low; o veredito é de funções puras sobre o JSON da CLI e a releitura do painel. Alcance: local.
10. A descoberta deixa de exigir a skill do tracker (`trackerAvailable`) e passa a devolver `language`. Alcance: local.
11. Todo texto variável vai ao shell por aspas simples POSIX, com quebras de linha trocadas por espaço, e todo prompt com comandos montados exige, por uma cláusula fixa (`BASH_ONLY`), que eles rodem exatamente como escritos na ferramenta Bash, nunca no PowerShell; sem Bash, o registro falha por código. Alcance: local.
12. `set-status` e `log` são omitidos quando a palavra pedida já é a gravada (lida na descoberta ou gravada nesta execução), para a retomada não repetir log; decisões, pendentes e em andamento contam com a idempotência da CLI. Alcance: local.
13. Linha com segmentos rotulados recebe `--piece code`; linha sem rótulo, nenhum. Alcance: local.
14. Um segmento de `E` bloqueado por um bloqueio que afeta só `E` é reaberto por `block-close` antes do `set-status`; bloqueio que afeta outros entregáveis faz o registro falhar. O status de bloqueado é gravado por `block-open`. Alcance: local.
15. Frases da CLI chamadas pelo release (log, próximo passo, nota, bloqueio, dono do pendente, commit) vêm de uma tabela no código: português para `language` `pt*` (dono `dono`), inglês no resto (dono `owner`). Alcance: local.
16. Riscos aceitos, entradas humanas e critérios sem evidência automática viram itens pendentes por `add-pending`; os itens humanos marcados como já autorizados e executados continuam no julgamento do agente de documentação, que também grava pela CLI os que ficam. Alcance: local.
17. Na segunda rodada da documentação, só os comandos sem veredito ok na primeira rodam de novo. Alcance: local.
18. O veredito do checker no registro, na medição da documentação e no relatório vem de `result.checker` de `brief --json` da CLI (checker do plugin, em memória, DEC-143; `status --json` não traz `checker`), e a releitura roda `status --json` e `brief --json`; saída de `brief` ausente ou sem `result.checker.errors` reprova o veredito; o workflow não roda o checker copiado na pasta, que pode ser antigo e não ter `--json`. Alcance: local.
19. Nenhuma versão sobe nesta branch, e nenhum arquivo de teste novo é criado: os casos vão para os dois arquivos do card. Alcance: local.
20. O teste comportamental vai até o passo 2 e a montagem dos argumentos do passo 4, em `dry-run`, sem chamar o Workflow, para não abrir uma execução paga aninhada; é tarefa do orquestrador da sessão principal, conforme DEC-204. Alcance: local.
21. Textos variáveis acima do limite de célula são cortados em código por `fitCell` (fronteira de palavra, sufixo com o arquivo que guarda o texto inteiro, espaço reservado para o que a CLI acrescenta) antes de `add-decision`, `add-pending`, `log`, `block-open` e `inflight-add`; a evidência da linha de log é limitada por `fitEvidence`; os textos cortados no registro de `plano`, no de `executando` e no de bloqueado vão inteiros ao log de revisões, em "Textos cortados no registro". Alcance: local.

## Depende de entrada humana

Os quatro critérios são `verify: test`, o teste comportamental é tarefa do orquestrador da sessão principal com subagents (DEC-204), e o card não pede efeito externo (sem push, sem publicação, sem credencial). Nenhuma entrada humana é bloqueante.

- Resolvida: a ratificação das decisões de contrato de E3 (DEC-136 a DEC-157), que segurava E18 (BLQ-2), foi feita pelo dono em 2026-11-11, com as emendas DEC-200 a DEC-202, já absorvidas neste desenho; BLQ-2 está fechado e a `feat/E18` foi sincronizada com a release.
- Ratificação pelo dono das decisões autônomas acima (DEC-030). As de alcance contrato (1, 2, 5 e 7) fixam o que E25 e E8 leem e seguram o início deles; as de alcance local esperam o ponto de medição.
