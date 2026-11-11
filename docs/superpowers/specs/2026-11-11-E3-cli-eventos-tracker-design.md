# E3 -- Eventos do tracker por CLI (design)

Entregável E3 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQ: REQ-003. Depende de E2 (parser único em `plugins/productivity-tools/lib/roadmap-format.mjs`, DEC-102 a DEC-115) e de E14 (DEC-058, DEC-060). Card crítico, trilha de engenharia, fase roadmap-sem-llm.

## Por quê

Quase todo evento do tracker é edição determinística de tabelas em Markdown, hoje feita à mão por um LLM que lê o contrato de formato inteiro (`roadmap-planner/references/formats.md`) e as receitas de `roadmap-tracker/references/events.md`. O reuso de um identificador já fechado é invisível ao checker, que vê só um retrato da pasta (risco do card E2). E3 é a primeira fatia do corte de DEC-013: carrega o custo comum, o escritor que troca linhas e os comandos. E18 (registro do release) e E22 (skill enxuta) só passam a chamar a CLI; a regra de ratificação ganha aqui os comandos de ratificar e rejeitar (DEC-030, DEC-031), e o registro do release ganha os três comandos de acréscimo (DEC-023).

## Critérios de aceite (do card, literais)

1. Dada a pasta de exemplo válida, com finais de linha de um tipo e do outro e com uma célula de status de vários segmentos, quando cada comando de escrita roda, então a pasta passa no checker sem erros e os bytes fora das linhas tocadas são idênticos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
2. Dado um bloqueio fechado e já removido do estado, quando se pede o próximo identificador de bloqueio, então o número devolvido nunca apareceu em nenhum arquivo da pasta, log incluído. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
3. Dado um painel com um segmento já integrado, quando se pede um status anterior na ordem, então o comando recusa com erro e não altera o arquivo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
4. Dados uma decisão do executor, um item pendente e uma linha em andamento, quando os comandos de acréscimo rodam, então cada um aparece uma vez no bloco certo, a decisão sai com origem executor e status pendente, e repetir o comando não duplica. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
5. Dada uma decisão do executor pendente, quando o comando de ratificação roda, então só o status da linha passa a vigente, o item pendente sai e há uma linha de log; uma decisão que não é do executor ou não está pendente é recusada sem alterar arquivo. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
6. Dada uma decisão do executor pendente e a decisão do dono que a rejeita, quando o comando de rejeição roda, então entra uma linha nova de origem user e a antiga passa a substituída por ela, sem outra célula alterada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Uma CLI determinística, `roadmap.mjs`, sobre o parser único de E2, com os comandos de leitura (peça 1), de escrita (peça 2) e de acréscimo, ratificação e rejeição (peça 3) que REQ-003 enumera.
- Um escritor por linhas que troca, insere ou remove só as linhas que o evento toca e preserva o resto byte a byte, inclusive BOM, CRLF ou LF e texto não normalizado.
- Toda escrita conferida pelo checker em memória antes de gravar: a CLI nunca deixa a pasta com um erro de checker que ela não tinha.

Não objetivos:

- Mudar a skill do tracker, `events.md` ou o contrato de formato: a skill passa a chamar a CLI em E22, e o release em E18. Nenhum formato de arquivo da pasta muda; `formatVersion` continua 1.
- Os julgamentos do tracker: preencher Contradiz, decidir se uma decisão substitui outra, propor revisão da estratégia, reescrever em prosa uma citação de bloqueio fechado, atualizar `critical-path.md`, podar itens de `now`, migração de formato. Ficam com o agente.
- Gravar `measurements.md`, `sources.md`, `requirements.md`, o bloco `releases` ou a estratégia: nenhum desses eventos está em REQ-003.
- Commitar, ou chamar `git` para algo além de ler (existência e ancestralidade de commit). Como a skill, a CLI só edita a árvore de trabalho.
- Subir a versão de `productivity-tools` ou a linha 1 do checker: branches de entregável não mexem na versão (estratégia, "Execução deste roadmap"; DEC-042).
- Editar `docs/plans/roadmap-evolucao-skills/` ou `plugins/_template/`.

Anti-objetivos (falha mesmo funcionando):

- Regravar o arquivo inteiro a partir do texto normalizado: muda finais de linha, BOM ou acentos de linhas que o evento não tocou (risco do card).
- Aceitar um comando que deixaria a pasta com erro de checker novo, ou que gravaria metade dos arquivos de um evento e falharia no resto sem dizer quais foram gravados.
- Devolver como próximo identificador um número que já apareceu em qualquer arquivo da pasta ou na estratégia.
- Mensagem de sucesso quando nada foi gravado, ou código de saída 0 numa recusa: o chamador (E18) confere por código, não pelo texto.

## Desenho

### Arquivos

| Arquivo | Papel |
|---|---|
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` (novo) | CLI e lógica dos comandos; exporta funções puras sobre textos para o teste |
| `plugins/productivity-tools/lib/roadmap-edit.mjs` (novo) | escritor por linhas, puro e sem imports, no molde de `roadmap-format.mjs` |
| `plugins/productivity-tools/lib/roadmap-format.mjs` | ganha `parseStatusSegments(cell)` e `decisionScope(cell)`, hoje código local do checker |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` | regenerado por `embed.mjs`; as checagens `status-order`, `blocked-no-blq`, `blocker-no-restore` e `executor-decision-pending` passam a usar as duas funções do módulo-fonte, com a mesma saída; linha 1 não muda |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` (novo) | o arquivo de teste do card |
| `.claude/rules/roadmap-checker.md` | uma linha sobre a CLI |

A CLI fica ao lado do checker porque o card fixa o arquivo de teste nessa pasta. Ela importa `../../../lib/roadmap-format.mjs`, `../../../lib/roadmap-edit.mjs` e, do checker irmão, `loadRoadmap`, `createGitAdapter`, `checkRoadmap`, `compareVersions` (o checker só roda `main` quando é o processo principal). Não é script de workflow, então a importação vale (DEC-058 trata só de workflow). O nome `roadmap.mjs` é único no plugin, o que a regra de permissão por nome do script exige (DEC-060, DEC-133).

### Escritor por linhas (`lib/roadmap-edit.mjs`)

O parser lê o texto normalizado (`norm`: sem BOM, LF, NFC). `norm` não muda o número de linhas quando a quebra é `\r\n`, `\r` ou `\n`, então o índice de linha do texto normalizado é o mesmo do texto cru partido por `/\r\n|\r|\n/`. O escritor:

1. Parte o texto cru em linhas guardando o terminador de cada uma (e o BOM como prefixo da linha 0).
2. Recebe do parser o intervalo de linhas do corpo de um bloco (`blockLines(text, name)`, função nova exportada por `roadmap-format.mjs` sobre o `scanBlocks` existente) e, numa tabela, o índice de linha de cada linha de dados, pulando cabeçalho e separador como `parseTable` faz.
3. Aplica operações: trocar a linha `i`, inserir uma linha antes ou depois de `i`, remover a linha `i`, e o mesmo para itens de lista (um item com linhas de continuação é removido inteiro).
4. Linha nova ou trocada leva o terminador da linha vizinha dentro do bloco (o da linha de cabeçalho, se a tabela está vazia); o texto é gravado em NFC.
5. Serializa uma linha de tabela como `| c1 | c2 | ... |`, com `|` de célula escrito `\|` e quebras de linha da célula trocadas por espaço.

O teste compara, para cada comando, os bytes do arquivo antes e depois com as linhas tocadas retiradas dos dois lados: têm de ser idênticos (critério 1).

### Funções novas do parser (`lib/roadmap-format.mjs`)

- `parseStatusSegments(cell)` -> `[{ raw, label, word, note }]`: separa por `;`, tira a nota final entre parênteses com `stripNote`, rótulo antes do primeiro `:`. `parseStatus` continua igual e passa a usá-la.
- `decisionScope(cell)` -> `'local' | 'contract'`: `local` só quando a célula termina em `Alcance: local.` ou `Scope: local.` (DEC-045, DEC-111); o resto é `contract`.
- `blockLines(text, name)` -> intervalo de linhas e índice das linhas de dados do primeiro bloco bem formado com esse nome, ou `null`.

O checker passa a usar `parseStatusSegments` e `decisionScope` no lugar do código local equivalente; `check-roadmap.test.mjs` continua passando sem mudança, e o teste de defasagem do gerador acusa cópia não regenerada.

### Comandos

Forma geral: `node roadmap.mjs <comando> <pasta> [argumentos] [--json]`. A pasta é a que tem `roadmap.config.json`. Datas são `--date AAAA-MM-DD`; sem a opção, a data local de hoje (regra 3 da skill: data do evento). O idioma das frases que a CLI escreve sozinha (linhas de log, itens pendentes, a frase de restauração) segue `language` do config: `pt*` em português, qualquer outro em inglês; todo comando que escreve linha de log aceita `--what <texto>` para substituí-la. Palavras de status, de decisão e de tipo de branch vêm sempre de `vocab` (posicionais, regra 7 da skill).

**Peça 1 -- leitura (não gravam nada):**

| Comando | Saída |
|---|---|
| `status` | versão da estratégia, linha de cabeçalho do estado, painel (`id`, segmentos com rótulo, palavra, posição e nota, evidências, próximo passo), bloqueios, `now`, pendentes, em andamento. É o que E18 relê para conferir uma gravação. |
| `brief` | resumo de partida a frio, curto: versão da estratégia e do formato, versão do checker da pasta e do plugin (defasado ou não), contagem de erros e avisos do checker com os códigos, entregáveis por status, bloqueios abertos, itens de `now`, número de pendentes, próximo identificador de cada tipo, decisões do executor pendentes. |
| `next-id <DEC\|BLQ\|REQ\|SRC\|E>` | o maior número desse tipo que aparece em qualquer arquivo regular da pasta (recursivo, fora `.git` e `node_modules`, texto e código, o checker copiado incluído) e na estratégia, mais um; largura mínima do contrato (`DEC-NNN`, `REQ-NNN`, `SRC-NN`, `BLQ-n`, `E<n>`). |
| `pending-decisions` | linhas de origem executor com status pendente: id, entregável, alcance (`decisionScope`), dependentes já iniciados (cards cujo `depends` cita o entregável e cujo status está nas posições 2 a 8) e se o entregável já foi publicado; a mesma regra de `executor-decision-pending` (DEC-111). |
| `verify-commit <sha>` | se o commit existe e se é ancestral de `integrationBranch` ou de `origin/<integrationBranch>`, pelo adaptador git do checker. Fora de git ou com git indisponível, diz isso; não é erro de uso. |

**Peça 2 -- escrita (trocam só as linhas tocadas):**

| Comando | O que grava |
|---|---|
| `log --deliverable <E<n>\|-> --what <texto> --evidence <ref> [--date]` | uma linha em `log.md`, antes da primeira linha cuja data é igual ou anterior (mais nova primeiro, `events.md`, Common). Recusa `what` acima de `limits.cellChars`, frase de `bannedPhrases` (sem distinguir caixa) e evidência vazia; evidência sem crase ganha crase. |
| `set-status <E<n>> <palavra> [--piece <rótulo>] [--evidence <ref>]... [--next <texto>] [--note <texto>]` | a célula de status do painel pela posição do vocabulário. Só palavras das posições 1 a 8; bloqueado vai por `block-open`, descartado é decisão (fica com o agente). Posição menor que a atual no segmento-alvo é recusada (critério 3); igual é no-op para o status. Linha com vários segmentos exige `--piece`, e só aquele segmento muda; rótulo inexistente acrescenta o segmento, salvo quando a linha tem um único segmento sem rótulo, caso em que recusa. Segmento bloqueado ou descartado não é alterado. Evidências entram ao lado das existentes (nunca as substituem), sem repetir, com `-` trocado; `--next` troca o próximo passo. A palavra de integrado (posição 6) ou posterior exige que alguma SHA da evidência final seja ancestral da ref de integração; toda SHA nova citada precisa existir. |
| `integrate --sha <sha> [--only E<a>,E<b>] [--date]` | a virada em lote de `events.md` § 16: a SHA tem de ser ancestral da ref de integração; os candidatos são as linhas em que todo segmento está na palavra de na-branch e toda SHA existente já é ancestral (a condição de `integrated-pending`), filtradas por `--only`. Cada uma vai à palavra de integrado em todos os segmentos e ganha a SHA na evidência; uma linha de log lista todos. Nenhum candidato: no-op, sem log. |
| `block-open --what <texto> --affects E<a>[,E<b>] --unblocks <condição> [--piece <rótulo>] [--since] [--evidence <ref>]` | próximo `BLQ-n` (mesma regra de `next-id`) no bloco de bloqueios; cada afetado vai à palavra de bloqueado com a nota `(BLQ-n)`, e "Desbloqueia quando" termina com "restaura E<n> para <status anterior>" (`restores E<n> to ...` em inglês), por afetado. Linha com vários segmentos exige `--piece` e bloqueia só esse segmento ("restaura E<n> (<rótulo>) para ..."), como na exceção de `events.md` § 17. Linha de log. |
| `block-close <BLQ-n> --how <texto> [--evidence <ref>] [--next E<n>=<texto>]...` | lê de "Desbloqueia quando" a palavra de status que segue cada `E<n>` (a mesma leitura de `blocker-no-restore`), remove a linha do bloqueio, devolve cada segmento bloqueado com nota `BLQ-n` à palavra lida, remove os itens de `donot` que citam só esse bloqueio, aplica os `--next`, e grava a linha de log (evidência padrão `state.md`). Recusa quando não acha a palavra de restauração, e quando ainda resta citação do `BLQ-n` em `state.md` ou `critical-path.md` fora do que o comando reescreve: lista onde está, para o agente reescrever a prosa e rodar de novo. |
| `prune` | remove as linhas de em andamento com a palavra de branch removida e os itens de `donot` cujos `BLQ-n` todos já saíram dos bloqueios e cujos `DEC-NNN` todos estão substituídos. Itens de `now` não (é julgamento). Sem log. |
| `refresh-checker [--date]` | `events.md` § 10: compara a linha 1 do checker do plugin (o irmão da CLI) com a da cópia da pasta (`<pasta>/check-roadmap.mjs`; ausente conta como mais velha); plugin não mais novo é no-op. Roda o checker do plugin na pasta: sem erro, copia o arquivo byte a byte e grava a linha de log "checker atualizado <velho> -> <novo>", tirando o pendente "checker ... disponível"; com erro ou falha interna, mantém a cópia e grava ou atualiza o pendente `(mantenedor) checker <novo> disponível: N erros a corrigir` (ou "erro interno"). |

**Peça 3 -- acréscimo, ratificação e rejeição:**

| Comando | O que grava |
|---|---|
| `add-decision --deliverable <E<n>\|-> --decision <texto> --scope <local\|contrato> [--discarded <t>] [--revisit <t>] [--contradicts <t>] [--date]` | uma linha em `decisions.md` com o próximo `DEC-NNN`, origem `executor`, status `decisionPending`, e a célula Decisão terminando em `Alcance: local.` / `Alcance: contrato.` (`Scope: local.` / `Scope: contract.` em inglês; DEC-045). Sem `--discarded`, `none stated` (`events.md` § 1). Já existe linha de origem executor com o mesmo entregável e a mesma decisão, comparadas depois de `norm`, colapso de espaço e sem a frase de alcance: no-op que devolve o id existente. Sem log e sem pendente: o chamador agrega (o release grava uma linha "DEC-a a DEC-b registradas"). |
| `add-pending --owner <dono> --text <texto>` | um item `- (<dono>) <texto>` no fim do bloco `pending`. Dono vazio é recusado (`pending-no-owner`). Item igual depois da mesma normalização: no-op. |
| `inflight-add <branch> [--note <texto>]` / `inflight-remove <branch>` | põe a linha `| <branch> | <branchLive> | <nota> |`, ou tira a linha da branch. Branch já presente com a palavra de viva, ou ausente na remoção: no-op. Branch presente com a palavra de removida: a linha passa a viva. A CLI não confere se a branch existe no git; isso é do chamador (§ 4 de `events.md`). |
| `ratify <DEC-NNN> [--date] [--what]` | recusa, sem tocar arquivo, decisão inexistente, de origem diferente de `executor` ou com status diferente de `decisionPending`. Senão: só a célula Status vira `decisionInForce`; saem os itens de `pending` cuja única citação de `DEC-NNN` é essa; uma linha de log "DEC-NNN ratificada pelo dono", evidência `` `decisions.md` ``. Item pendente que cita essa e outras decisões fica e é listado nos avisos. |
| `reject <DEC-NNN> --decision <texto> [--discarded <t>] [--revisit <t>] [--date] [--what]` | as mesmas recusas. Senão: linha nova com o próximo `DEC-NNN`, o mesmo entregável, a decisão do dono, origem `user`, status `decisionInForce`, Contradiz `-`, alternativa descartada padrão "a escolha do executor em DEC-NNN"; na linha antiga só o Status muda, para `<decisionSupersededBy> DEC-novo`; saem os pendentes como em `ratify`; linha de log "DEC-velho rejeitada pelo dono; DEC-novo a substitui". |

### Garantias de toda escrita

1. **Checker antes de gravar.** O comando calcula os textos novos em memória, monta o objeto de roadmap como `loadRoadmap` o monta, com os textos novos, e roda `checkRoadmap` com o adaptador git da pasta, antes e depois. Um erro que aparece depois e não antes (mesmo código, arquivo e mensagem) recusa o comando com `checker-errors`, listando os erros, e nada é gravado. Avisos novos não recusam; saem nos avisos da CLI.
2. **Resumo antes de gravar.** Cada arquivo que o comando vai gravar é lido uma vez no início; antes de gravar, é relido e comparado byte a byte. Diferente: `concurrent-change`, nada gravado (risco do card: dois chamadores).
3. **Gravação.** Cada arquivo é gravado num temporário na mesma pasta e renomeado por cima. Os arquivos de um evento são gravados numa ordem fixa (`decisions.md`, `state.md`, `log.md`, checker copiado); se um falhar no meio, a saída lista os já gravados e o código é 2.
4. **Formato.** Pasta com `formatVersion` maior que o do checker do plugin: `format-newer`, nada gravado (camada 3 da skill).
5. **No-op é sucesso.** Um comando que não muda nada sai 0 com `changed: []`.

### Saída e códigos de saída

Códigos de saída: 0 feito ou no-op; 1 recusado por regra (nenhum arquivo alterado); 2 uso inválido, arquivo ilegível ou falha de gravação. Modo texto: uma linha por arquivo alterado e por achado, `ERROR <código>: <mensagem>` ou `WARN <código>: <mensagem>`, e a última linha `roadmap <comando>: changed <n> file(s), <e> error(s), <w> warning(s)`. Com `--json`, no molde do checker (DEC-112):

```
{ "tool": "roadmap", "command": "<comando>", "folder": "<pasta>",
  "changed": ["state.md", ...], "result": { ... },
  "errors": [{ "code", "message" }], "warnings": [{ "code", "message" }],
  "summary": { "errors": n, "warnings": n, "exitCode": n } }
```

`result` traz o que o comando produziu: os ids alocados (`{ id }`), o painel lido (`status`), o resumo (`brief`), `{ exists, integrated }` (`verify-commit`), etc. O código de saída é o mesmo nos dois modos.

Códigos de recusa: `usage`, `not-found`, `status-backward`, `status-not-allowed`, `segment-required`, `segment-locked`, `sha-missing`, `sha-not-integrated`, `git-unavailable`, `not-executor`, `not-pending`, `owner-missing`, `cell-too-long`, `banned-phrase`, `evidence-missing`, `restore-unreadable`, `blocker-cited`, `checker-errors`, `concurrent-change`, `format-newer`, `write-failed`. Avisos: `pending-multi-cite`, `checker-warning` (avisos novos do checker), `no-git`.

### Testes (só no arquivo do card)

`plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`, com `node:test`. Cada caso copia `scripts/fixtures/valid/` para uma pasta de `fs.mkdtempSync(os.tmpdir())`, removida no fim, e muta a cópia em memória; a fixture original não muda, o que mantém G4. Para as SHAs, o caso faz `git init` na pasta temporária, um commit, e um branch `main` (ancestral) e outro fora dela.

- Critério 1: para cada comando de escrita (`log`, `set-status`, `integrate`, `block-open`, `block-close`, `prune`, `refresh-checker`, `add-decision`, `add-pending`, `inflight-add`, `inflight-remove`, `ratify`, `reject`), em duas variantes da pasta, LF e CRLF (com BOM numa delas e uma linha em NFD fora do bloco), e com o painel tendo uma linha `piece 1: integrated; piece 2: spec`: depois do comando, o checker do plugin dá zero erros e os bytes fora das linhas tocadas são iguais aos de antes.
- Critério 2: abrir `BLQ-1`, fechá-lo (a linha sai do estado, fica no log); `next-id BLQ` devolve um número que não aparece em nenhum arquivo da pasta nem na estratégia; idem com `BLQ-7` citado só num arquivo fora dos acompanhados.
- Critério 3: segmento `integrated` e `set-status` pedindo `spec` nele: sai 1 com `status-backward` e os bytes do arquivo são os mesmos; idem sem `--piece` numa linha segmentada (`segment-required`).
- Critério 4: `add-decision`, `add-pending` e `inflight-add` rodados duas vezes cada: um item em cada bloco certo, a decisão com origem `executor`, status `pending` e a frase de alcance; a segunda vez sai 0 com `changed: []`.
- Critério 5: `ratify` numa pendente do executor: só a célula Status muda na linha, o item `(owner) ratify DEC-NNN` sai, e há uma linha de log nova; `ratify` numa decisão de origem `user` e numa já vigente: sai 1 (`not-executor`, `not-pending`) e nenhum arquivo muda.
- Critério 6: `reject`: linha nova de origem `user`, a antiga com Status `superseded by DEC-novo` e todas as outras células iguais.
- Garantias: escrita que deixaria erro de checker (por exemplo `set-status` integrado sem SHA na ancestralidade) -> `sha-not-integrated` ou `checker-errors` sem gravação; arquivo alterado entre a leitura e a gravação (gancho de teste exportado) -> `concurrent-change`; `--json` com o mesmo código de saída do texto; uso inválido sai 2.
- Módulo-fonte: `parseStatusSegments`, `decisionScope` e `blockLines` com CRLF, BOM e NFD; `lib/roadmap-edit.mjs` sem `import`, `process`, `Buffer` ou `crypto` (a checagem de fonte pura que E5 já usa).

`check-roadmap.test.mjs` não ganha caso: o teste de defasagem existente acusa o checker não regenerado, e a suíte atual prova que a troca para as funções do módulo-fonte não muda a saída.

### Verificação fora dos testes

Antes de cada commit: G1 a G5. G4 roda o checker regenerado na fixture e precisa seguir com zero erros e zero avisos. `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` sem defasagem. Um uso manual de `status` e `brief` sobre `docs/plans/roadmap-evolucao-skills/` (só leitura) confirma que a CLI lê a pasta real em português.

## Deixado ao planejador

- Ordem das tarefas e divisão em até quatro arquivos por tarefa. Uma ordem natural: funções do módulo-fonte e regeneração do checker; escritor por linhas; leitura; escrita; acréscimo, ratificação e rejeição; garantias; a linha da regra.
- Os textos exatos das mensagens e das frases de log, desde que nomeiem o código e os ids.
- A ajuda da CLI (`--help`), que lista os comandos e as opções desta seção.

## Decisões autônomas (revisáveis pelo dono)

1. A CLI é `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`, ao lado do checker e do arquivo de teste do card, com a forma `node roadmap.mjs <comando> <pasta> [opções] [--json]`. Alcance: contrato.
2. Nomes dos comandos: `status`, `brief`, `next-id`, `pending-decisions`, `verify-commit`, `log`, `set-status`, `integrate`, `block-open`, `block-close`, `prune`, `refresh-checker`, `add-decision`, `add-pending`, `inflight-add`, `inflight-remove`, `ratify`, `reject`, com as opções desta seção. Alcance: contrato.
3. Saída `--json` `{ tool, command, folder, changed, result, errors, warnings, summary }` no molde de DEC-112, e códigos de saída 0 feito ou no-op, 1 recusado sem alteração, 2 uso ou gravação. Alcance: contrato.
4. Códigos de recusa e de aviso da lista da seção "Saída e códigos de saída". Alcance: contrato.
5. O escritor por linhas fica em `plugins/productivity-tools/lib/roadmap-edit.mjs`, puro e sem imports, e opera sobre o texto cru pelo índice de linha do texto normalizado. Alcance: contrato.
6. `roadmap-format.mjs` ganha `parseStatusSegments`, `decisionScope` e `blockLines`, e o checker regenerado passa a usar as duas primeiras no lugar do código local, sem mudar a saída nem a linha 1 (DEC-042). Alcance: contrato.
7. A CLI importa do checker do plugin `loadRoadmap`, `createGitAdapter`, `checkRoadmap` e `compareVersions` em vez de duplicar o adaptador git e o carregamento. Alcance: local.
8. Toda escrita é conferida pelo checker em memória antes e depois e recusada se surgir um erro novo; avisos novos só são relatados. Alcance: contrato.
9. Mudança concorrente é detectada relendo e comparando byte a byte cada arquivo antes de gravar; gravação por temporário e renomeação, em ordem fixa. Alcance: local.
10. `next-id` varre todo arquivo regular da pasta, recursivo (fora `.git` e `node_modules`), e a estratégia, inclusive texto em cerca de código: o maior número visto mais um, nunca reaproveitado. Alcance: contrato.
11. `set-status` aceita só as posições 1 a 8; bloqueado vai por `block-open` e descartado fica com o agente; recusa posição anterior no segmento, exige `--piece` em linha segmentada e nunca altera segmento bloqueado ou descartado. Alcance: contrato.
12. A palavra de integrado ou posterior exige SHA ancestral de `integrationBranch` ou de `origin/<integrationBranch>`, e toda SHA nova citada precisa existir; sem git, recusa (`events.md` § 3). Alcance: local.
13. `block-open` grava a restauração como "restaura E<n> para <status>" (inglês "restores E<n> to <status>"), por afetado, e `block-close` a lê com a mesma regra de `blocker-no-restore`; `block-close` recusa enquanto restar citação do bloqueio em prosa que ele não reescreve. Alcance: contrato.
14. `add-decision`, `add-pending`, `inflight-add` e `inflight-remove` não gravam log nem pendente sozinhos; o chamador agrega (como o release faz hoje). `ratify`, `reject`, `block-open`, `block-close`, `integrate` e `refresh-checker` gravam a própria linha de log. Alcance: contrato.
15. Idempotência: decisão igual do executor (mesmo entregável e texto normalizado, sem a frase de alcance), item pendente igual e branch já viva são no-op com saída 0. Alcance: contrato.
16. `ratify` e `reject` removem só os itens pendentes cuja única citação de `DEC-NNN` é a decisão tratada; item que cita várias fica e vira aviso `pending-multi-cite`. Alcance: local.
17. `reject` grava a decisão do dono com origem `user`, status vigente, Contradiz `-` e alternativa descartada padrão "a escolha do executor em DEC-NNN". Alcance: local.
18. As frases que a CLI escreve sozinha seguem `language` do config: `pt*` em português, o resto em inglês; `--what` substitui a linha de log. A frase de alcance segue DEC-045 (`Alcance: local.` / `Alcance: contrato.`) e, em inglês, `Scope: local.` / `Scope: contract.`, que DEC-111 já lê. Alcance: contrato.
19. A CLI não toca a linha de cabeçalho de `state.md`, `critical-path.md`, `now`, a estratégia, `measurements.md`, `sources.md`, `requirements.md` nem o bloco `releases`; esses ficam com o agente. Alcance: local.
20. A skill do tracker, `events.md` e `formats.md` não mudam nesta entrega (a skill passa a chamar a CLI em E22); a única documentação é uma linha em `.claude/rules/roadmap-checker.md` e a ajuda da CLI. Alcance: local.
21. Os testes usam cópias da fixture `valid/` mutadas em pasta temporária com repositório git próprio, sem fixture nova no repositório. Alcance: local.
22. Nenhuma versão sobe nesta branch; a publicação que levar E3 (E17) sobe `productivity-tools` e a linha 1 do checker (DEC-042). Alcance: local.

## Depende de entrada humana

Nada bloqueia a entrega. Os seis critérios são `verify: test`, e o card não pede efeito externo (sem push, sem publicação, sem credencial).

- Ratificação pelo dono das decisões acima (DEC-030); as de alcance contrato (1 a 6, 8, 10, 11, 13 a 15 e 18) seguram o início de E18 e E22, que leem o que elas fixam, sem impedir a entrega de E3.
- E3 se apoia em decisões de contrato de E2 ainda pendentes de ratificação (DEC-102, DEC-103, DEC-107, DEC-111, DEC-112, DEC-115). Se o dono rejeitar alguma, E3 recebe um bloqueio até a correção (estratégia, regra de ratificação); o desenho não espera por isso.
