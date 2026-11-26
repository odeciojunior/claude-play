# Plano E46 -- Motivos, contratos e aspas no roadmap-release

Spec: `docs/plans/pos-2-6-0-E46/spec.md`. Cobre REQ-008, REQ-009 e REQ-011 (#1, #19, #18), com as decisões DEC-007, DEC-008, DEC-015 e DEC-021. Branch `plan/pos-2-6-0-E46`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E46`, com merge em `release/pos-2.6.0` depois da conferência. O worktree ainda não existe: criá-lo a partir de `release/pos-2.6.0`, depois do commit do merge do E43 e do commit deste plano, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E46 D:/projects/claude-play-wt/pos-2-6-0-E46 release/pos-2.6.0`). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz de `D:/projects/claude-play-wt/pos-2-6-0-E46` (rodados em outro checkout, testam outro código e dão verde falso).

Os números de linha são do código com o E43 integrado, lidos na árvore da release com o merge ainda sem commit. Servem para achar o trecho; se a linha tiver andado, vale o texto citado.

Seis tarefas em sequência, um commit por tarefa: aviso do checker, motivo curto do preflight, motivo por dependência no workflow, frase sobre `gate` nos agentes, testes que passam a aceitar as duas formas de aspas e, por último, o `shq`.

## Linha de base (G1)

Linha de base antes do E43, no merge do E51 (`4329c5e`): exit 0, tests 2660, pass 2658, fail 0, skipped 2. O merge do E43 sobe o piso: vale a contagem do merge do E43 registrada em `docs/plans/roadmap-pos-2-6-0/log.md`, nunca abaixo de tests 2660 e pass 2658.

Antes da Tarefa 1, medir o G1 pelo Git Bash com o worktree parado e anotar exit, tests, pass, fail e skipped:

```
node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"
```

Nenhum commit, de nenhuma sessão, enquanto uma suíte roda (um commit no meio quebra `tools/measure/run-batch.test.mjs`); se o HEAD mudar, repetir com o HEAD estável. A suíte é sensível a carga: não rodá-la enquanto outra execução de testes corre em outro worktree.

## Medida de tamanho

Antes da Tarefa 3 e depois das Tarefas 3 e 6, medir os caracteres LF do `roadmap-release.js` e informar o número no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length;console.log(n)"
```

A partida medida na escrita do plano, com o E43 integrado, é 269.471. A medida de cada teto é o delta líquido de caracteres LF entre o commit anterior à tarefa e o commit da tarefa.

| Tarefa | Teto (B1, C1) | Parada |
|---|---|---|
| 3 | 1.200 | acima de 1.440 |
| 6 | 300 | acima de 360 |

Entre o teto e a parada, o executor enxuga até caber no teto e não marca a tarefa como pronta antes disso. Acima da parada, parar e voltar ao dono via subagente opus (DEC-007, DEC-021). A trava de 284.500 não muda.

O check de tamanho de cada uma das duas tarefas compara o arquivo com a versão mais nova do histórico que ainda não tem a marca da tarefa (`explain: true` na Tarefa 3; `A-Za-z0-9_%+=:./-` na Tarefa 6), então vale antes e depois do commit e com commits de correção. Por isso as duas marcas são escritas literalmente no código.

## Tarefas

### Tarefa 1: Aviso status-no-code no checker

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` e `plugins/productivity-tools/skills/roadmap-planner/references/formats.md`; teste em `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`.

Contrato:

- Em `extraChecks`, depois de `blocked-no-blq` (linha 972), fora do bloco embutido: aviso `status-no-code`, arquivo de estado, para cada linha do painel com célula Status que tem ao menos um segmento (lidos com `parseStatusSegments`), nenhum com rótulo `code`, e que não é um segmento único sem rótulo. É a regra em que o `codeWord` do preflight dá `null`, sem a célula vazia.
- A mensagem traz o ID do entregável e diz que o roadmap-release não sabe se o código está no alvo. Não repete o texto da célula: a CLI compara os problemas antes e depois de cada escrita, e uma mensagem estável não reaparece como aviso novo quando a célula muda.
- Só aviso: o exit continua 0. A linha 1 do checker não muda (DEC-042).
- `formats.md` § 9, na lista de avisos junto de `blocked-no-blq`: "`status-no-code`: a panel Status cell with several segments, or a single labelled one, and no `code` segment, so roadmap-release cannot tell whether the code is on the target."
- Nada em `lib/` muda e o bloco embutido do checker não muda.

Passos:

1. Teste primeiro, em `check-roadmap.test.mjs`, depois do teste `blocked-no-blq`: `E46 AC1: status-no-code warns on several pieces and on a single labelled segment that is not code`, com `piece 1: spec (draft); piece 2: not-started` e `spec: spec` (palavras do vocabulário da fixture), severidade `warning` e exit 0 pela CLI; `E46 AC1: status-no-code is silent on an empty cell, an unlabelled status and a code segment`, com célula vazia, `not-started` e `code: spec; acceptance: not-started`.
2. No mesmo arquivo, três testes de hoje esperam zero problemas numa célula de várias peças sem `code` e passam a esperar exatamente um problema, `status-no-code` com severidade `warning` e o ID na mensagem: `multi-segment status with labels and notes is accepted` (linha 214), `fix9: balanced nested parentheses in a status note are accepted` (linha 634) e a primeira asserção de `final1: per-piece status needs only one integrated SHA; siblings only need to exist` (linha 712, entregável E1). As demais asserções dos três ficam como estão.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` e ver os casos novos e ajustados falharem.
4. Implementar o aviso e a linha de `formats.md`; ver o arquivo de teste passar (o teste `AC5: every code the checker emits is documented in formats.md section 9` cobre a linha).
5. Commit só com os arquivos da tarefa: `feat(productivity-tools): aviso status-no-code no check-roadmap (#1)`.
6. Com o commit feito e o worktree parado, rodar os checks da tarefa.

O orçamento de prosa foi conferido na escrita do plano: só o evento 11 do tracker carrega o § 9, com 25.444 de 29.096 bytes LF (folga de 3.652).

### Tarefa 2: Motivo curto no preflight sem segmento code

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`; teste em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

Contrato: só o ramo `word === null` (linha 505) muda, e o `onTargetEvidence` deixa de repetir a célula. Os textos, em inglês:

| Célula Status | `onTargetEvidence` |
|---|---|
| sem segmento (vazia) | `no status on the panel` |
| dois ou mais segmentos sem `code` | `status without a code segment (several pieces)` |
| um segmento único rotulado que não é `code` | `status without a code segment` |

`codeWord`, a ordem dos ramos (merge encontrado, revertido e sem ref vêm antes) e os demais textos não mudam. As linhas que o E45 muda neste arquivo (547-553 e 574) não são tocadas.

Passos:

1. Teste primeiro, em `preflight.test.mjs`, depois de `E10 AC1: onTarget by the integrated code segment, never by the delivery branch or several pieces`: `E46 AC1: onTargetEvidence names why there is no code segment without repeating the cell`, com `discRepo(panelEdit(rows))` e as linhas E1 de célula vazia, E2 `piece 1: done; piece 2: plan` e E3 `spec: done`; igualdade exata com os três textos da tabela.
2. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e ver o caso novo falhar.
3. Mudar o ramo e ver o arquivo de teste passar.
4. Commit só com os arquivos da tarefa: `fix(productivity-tools): motivo curto no preflight para Status sem segmento code (#1)`.
5. Rodar os checks da tarefa.

### Tarefa 3: Motivo por dependência na seleção

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Contrato:

- `selectDeliverables` (linha 102) ganha o argumento opcional `explain`. Com ele, cada dependência faltante vira `<id>: <motivo>` e a lista é juntada por `; ` nos dois pontos: o `reason` do pulo (linha 167) e a nota `outside the selection (pending dependencies: ...)` (linha 153). Sem ele, o texto é o de hoje, juntado por `, `.
- O motivo vem de uma função local, dentro do bloco puro, nesta ordem: ID sem card, `no card` (guarda `byId[d]`, como na linha 136); merge interrompido (`isUnfinished`), `interrupted merge`; senão o `onTargetEvidence` do card, com o `status` como reserva.
- A chamada da seleção (linha 1871) passa `explain: true`, escrito assim.
- `roadmap-release-agy.py` não muda (DEC-008), e `selection.test.mjs` e `roadmap-release-agy.test.mjs` não mudam: sem `explain` o comportamento é o mesmo.

Passos:

1. Medir o tamanho do `roadmap-release.js`.
2. Teste primeiro, em `flow.test.mjs`:
   - `E46 AC1: with explain the skip reason and the outside note name why each dependency is missing`: com `loadPure().selectDeliverables`, uma dependência de Status `piece 1: done; piece 2: plan` (passada por `cardStatus`, com `onTargetEvidence` `status without a code segment (several pieces)`), o motivo no `reason`, o pulo ainda em `skipped` e a nota do seletor `ready` no mesmo formato; duas dependências faltantes juntadas por `; `; um card sem `onTargetEvidence` usa o `status`;
   - `E46 AC1: a dependency without a card does not break and reads no card` (C1);
   - `E46 AC1: an interrupted merge reads interrupted merge, not the evidence of the merge` (C2);
   - `E46 AC1: without explain the reason and the note keep the old text`, por igualdade exata;
   - `E46 AC1: a dry-run carries the reason of each dependency to the selection`: com `exec()`, `mode: 'dry-run'` e `deliverables: ['E2']`, o `reason` chega em `r.selection.skippedUpfront`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e ver os casos novos falharem.
4. Implementar e ver o arquivo de teste passar.
5. Medir o tamanho de novo (teto de 1.200 sobre a medida do passo 1).
6. Commit só com os arquivos da tarefa: `fix(productivity-tools): motivo de cada dependência não atendida na seleção do roadmap-release (#1)`, com a linha `paridade agy: pendente #13` no corpo do commit.
7. Com o commit feito e o worktree parado, rodar os checks da tarefa.

### Tarefa 4: Frase sobre gate nos agentes de spec e plano

Arquivos: mudar `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`; teste em `plugins/productivity-tools/scripts/agent-contracts.test.mjs`.

Contrato: no passo 4 de `spec-author.md` (linha 35) e no passo 3 de `plan-author.md` (linha 36), logo depois da frase que contém o literal `{ file, name, why, gate? }`, que fica intacto, entra a mesma frase nos dois arquivos:

> `gate` is the `name` of the tests gate in `release.config.json` (for example `"G1"`, never the kind `"tests"`); it is required when the config does not have exactly one `kind: tests` gate without `invariant` nor `ignoreFailuresWhenChanged` (so also when the only tests gate has `ignoreFailuresWhenChanged`); read the gate names in `release.config.json` or take them from the brief.

Em `plan-author.md` a frase entra antes de "Break the work into `plan/1` tasks". O frontmatter não muda.

Passos:

1. Teste primeiro, em `agent-contracts.test.mjs`, depois de `spec-author and plan-author declare removedTests as { file, name, why, gate? }` (linha 68): `E46 AC2: spec-author and plan-author say what gate is and when it is required`, conferindo nos dois arquivos, por `includes`, estes quatro trechos literais, um por linha:

```
is the `name` of the tests gate in `release.config.json`
never the kind `"tests"`
does not have exactly one `kind: tests` gate without `invariant` nor `ignoreFailuresWhenChanged`
read the gate names in `release.config.json`
```

2. Rodar `node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs` e ver o caso novo falhar.
3. Editar os dois agentes e ver o arquivo de teste passar.
4. Commit só com os arquivos da tarefa: `docs(productivity-tools): spec-author e plan-author dizem o que é o gate de removedTests (#19)`.
5. Com o commit feito e o worktree parado, rodar os checks da tarefa.

### Tarefa 5: Testes aceitam valores com e sem aspas

Arquivos de teste: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, `discovery-slices.test.mjs` e `load-slices.test.mjs` (mesma pasta). O `roadmap-release.js` não muda: os três arquivos ficam verdes com o `shq` de hoje, e a Tarefa 6 só troca o que é literal.

Regra: toda regex de teste que extrai um valor passado pelo `shq` aceita as duas formas, a aspeada (com o idioma `'\''`) ou um token sem espaço, e devolve o grupo que casou.

Em `flow.test.mjs`:

- tracker falso, leitura da palavra do `set-status` (linha 153);
- `nonceOf` (linha 179);
- `CAP_LINE` no grupo do `--bash` e `unshq`, que devolve o valor como está quando não começa por aspa (linhas 185-186);
- `loadAnswer`: o argv é lido com tokens aspeados ou não (linha 218; sem isso o argv sai vazio e o `cmdDigest` deixa de bater);
- ` --cwd ` das linhas de captura (linha 339);
- injeção por `replace` do teste do digest errado (linha 1060): troca nas duas formas, e o teste guarda cada par de antes e depois numa lista fora do callback e afirma, depois da execução, que houve ao menos uma troca e que o texto mudou (uma asserção dentro do callback do agente pode ser engolida pelo workflow);
- `--decision`, `--text` (linhas 3339 e 3347) e o laço `--(decision|text|what|note|next)` (linha 3815, mantendo `seen >= 4`);
- teste negativo `status --deliverable` (linha 3494): a pasta casa nas duas formas, e o laço corre sobre os prompts mais uma linha de controle `PU.cliCmd(TOOL_PATH, 'status', 'docs/plans/roadmap-x/', ['--deliverable E1'])`, conta os casamentos e exige ao menos 1; as asserções por prompt ficam;
- `plan-tool` com `--no-spec` e `--spec` (linhas 4777-4779): casam nas duas formas; a asserção negativa da linha 4778 passa a olhar a linha do `capture.mjs" run` do prompt e recusa o token `--spec` com ou sem aspas;
- `--base` (linhas 5729, 5845 e 5867).

Em `discovery-slices.test.mjs`: `--nonce` (linhas 31, 56 e 94).

Em `load-slices.test.mjs`: `--nonce` (linha 91); a injeção do teste `a slice of another repository is not found` (linha 188) troca o `--cwd` nas duas formas por `--cwd ` mais `shq(world.other)` do bloco puro (importar `loadPure` de `./load-pure.mjs`), guarda os pares fora do callback e afirma depois que houve troca.

Passos:

1. Aplicar a lista. Passar de novo o arquivo inteiro à procura de outro consumidor de valor do `shq` (o E43 integrado já foi conferido na escrita do plano); um achado novo segue a mesma regra.
2. Rodar os checks da tarefa com o `roadmap-release.js` sem mudança: tudo verde.
3. Prova do ramo sem aspas: copiar o `roadmap-release.js` para um arquivo temporário fora do repositório; aplicar no original, sem commit, o `shq` do contrato da Tarefa 6; rodar os três arquivos de teste. `discovery-slices.test.mjs` e `load-slices.test.mjs` ficam verdes, e em `flow.test.mjs` só podem falhar as asserções literais da lista da Tarefa 6. Restaurar o `roadmap-release.js` copiando de volta o arquivo temporário e confirmar com `git diff --quiet -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (exit 0) antes do commit.
4. Commit só com os arquivos da tarefa: `test(productivity-tools): testes do roadmap-release leem valores com e sem aspas (#18)`.

### Tarefa 6: shq sem aspas em valores seguros

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e `prompts.test.mjs`.

Contrato:

- `shq(s) -> string` (linha 916): aplica `oneLine`; devolve o valor sem aspas quando ele casa `^[A-Za-z0-9_%+=:./-]+$`, regex escrita literalmente assim; vazio continua `''`; qualquer outro valor continua entre aspas simples com o idioma `'\''`. O comentário acima da função acompanha, curto.
- A regra vale para todos os usos (DEC-015): descoberta, leitura de registro, cargas, tracker (`recordCommands`), captura, releitura e `test-extract removed`. Nenhum ponto de chamada muda; o `node "${CAP}"` mantém as aspas duplas.
- Não mudam: o `shq` de `plan-coordinator/workflow/coordinator.js`, `roadmap-release-agy.py`, `verify-run.mjs`, `lib/` e `cleanup.test.mjs` (lê o fonte `${shq(...)}`, que fica igual).

Testes. Em `flow.test.mjs`:

- `shq: aspas simples POSIX, quebra de linha vira espaço` (linha 3229) ganha: valor seguro sai sem aspas; com espaço, com barra invertida (`C:\x`), vazio (`''`), com aspa, com `@` e com vírgula saem entre aspas;
- `shq: o Git Bash entrega o texto literal` (linha 3236) ganha um valor com todos os caracteres do conjunto seguro, valores que começam com `-`, `=` e `@`, um com vírgula e o vazio conferido como argumento que existe (por exemplo com um formato de `printf` que delimita o argumento);
- asserções literais passam a esperar o valor seguro sem aspas, nas linhas 391, 407, 704, 1033-1036, 1040, 1043, 1235, 1570, 3009, 3273-3274, 3302-3303, 3305-3306, 3309-3310, 3313, 3325-3329, 3331-3332, 3578-3585, 3840, 3878-3879, 3908-3910, 4443, 5757-5758 e 5900. Valores com espaço ou parênteses continuam aspeados na expectativa (por exemplo `--what`, `--note` padrão e `--decision 'Usar X.'`). Na linha 3274 só a pasta perde as aspas: os argumentos passados já aspeados ao `cliCmd` ficam. Trecho de regex que só pula a pasta aceita as duas formas.

Em `prompts.test.mjs`: o teste `E41 T3: with ctx.capture the implementer prompt carries the CAPTURE line` (linha 503) espera `--cwd /wt/E7`.

Esperado que dependa de caminho real (tmpdir) vem de `PU.shq(...)`, nunca escrito à mão. Nenhum teste é apagado e nenhum teste negativo muda de sentido ou fica vazio (DEC-004). Um consumidor fora da lista segue a mesma regra, sem tirar nem afrouxar asserção.

Passos:

1. Medir o tamanho do `roadmap-release.js`.
2. Teste primeiro: os casos novos do `shq` e as asserções literais; rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e ver falhar.
3. Mudar o `shq` e ver os dois arquivos passarem.
4. Medir o tamanho de novo (teto de 300 sobre a medida do passo 1).
5. Commit só com os arquivos da tarefa: `fix(productivity-tools): shq sem aspas em valores seguros no roadmap-release (#18)`, com a linha `paridade agy: pendente #13` no corpo do commit.
6. Com o commit feito e o worktree parado, rodar os checks da tarefa, o G1 por último.

## Fechamento

- Conferir AC1, AC2 e AC3, G1, G2 e G5 na branch; fazer o merge de `plan/pos-2-6-0-E46` em `release/pos-2.6.0` depois da conferência. O corpo do commit de merge leva obrigatoriamente a linha `paridade agy: pendente #13`, porque o coordinator dá o próprio assunto aos commits das tarefas e a linha pedida nelas pode se perder.
- Pronto: AC1, AC2 e AC3 verdes em `release/pos-2.6.0`; G1 na árvore do merge com exit 0, `fail 0` e `tests` e `pass` não menores que o piso; G2 sem FAIL; G5 verde com os 4 alvos e sem regeneração; `roadmap-release.js` dentro dos dois tetos e da trava de 284.500.
- Itens para o registro do entregável, feitos por quem integra, pela CLI do tracker (este plano não edita o roadmap): checklist "paridade agy: pendente #13 (o motivo por dependência não chega ao agy; os comandos do tracker no agy saem sem aspas nos valores seguros porque o agy avalia o recordCommands do .js, roadmap-release-agy.py:321)"; fechar o pendente "(executor) registrar o shq do coordinator.js como pendente fora do escopo (DEC-015)" com o registro de que o `shq` do `coordinator.js` continua com aspas.
- Sem bump de versão, push, tag ou comentário em issue.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E46",
  "title": "Motivos, contratos e aspas no roadmap-release",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E46, branch plan/pos-2-6-0-E46, criado a partir de release/pos-2.6.0 depois do commit do merge do E43 e deste plano; merge em release/pos-2.6.0 depois da conferência. Todo comando e check roda com o diretório atual na raiz desse worktree.",
    "Fora dos testes, o número 3500 só existe em lib/plan-digest.mjs (copy-budget.test.mjs); não escrevê-lo em nenhum arquivo tocado.",
    "Autonomia só local: sem push, tag, publicação nem comentário em issue (DEC-004).",
    "Sem bump de versão em nenhum plugin nem da linha 1 do check-roadmap.mjs; o bump é do E54 (DEC-003, DEC-042).",
    "roadmap-release.js: delta líquido em caracteres LF de no máximo 1200 na Tarefa 3 e 300 na Tarefa 6; entre o teto e a parada (1440 e 360), enxugar até o teto; acima da parada, parar e voltar ao dono via subagente opus (DEC-007, DEC-021); trava de 284500 mantida.",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py (DEC-008); o corpo do commit de merge em release/pos-2.6.0 leva obrigatoriamente a linha 'paridade agy: pendente #13', e os commits que tocam roadmap-release.js também a pedem no corpo.",
    "G1 roda pelo Git Bash com o worktree parado, antes da Tarefa 1 e depois do commit da Tarefa 6; o piso é a contagem do merge do E43 registrada no log do roadmap, nunca abaixo de tests 2660 e pass 2658 (4329c5e: exit 0, fail 0, skipped 2).",
    "Nenhum commit enquanto uma suíte roda, e nenhuma suíte enquanto outra execução de testes corre em outro worktree.",
    "lib/ não muda e nenhum bloco embutido é regenerado; embed.mjs --check nos 4 alvos segue em dia.",
    "Não mudar o shq de skills/plan-coordinator/workflow/coordinator.js (DEC-015) nem a trava de discovery-slices.test.mjs.",
    "Fora do escopo: a opção B do C1 (comando em arquivo) e a medição paga do efeito no haiku (E53).",
    "Não apagar teste nem afrouxar teste negativo; teste negativo não pode ficar vazio em silêncio (DEC-004).",
    "Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "Cada commit leva só os arquivos da própria tarefa, e cada tarefa edita no máximo 4 arquivos."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Aviso status-no-code no checker",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs",
          "plugins/productivity-tools/skills/roadmap-planner/references/formats.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "check-roadmap: aviso status-no-code por linha do painel com Status de segmentos sem code (exceto o segmento único sem rótulo)"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs tools/measure/make-scenario.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs docs/plans/roadmap-pos-2-6-0",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 2,
      "title": "Motivo curto no preflight sem segmento code",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "card.onTargetEvidence sem segmento code: 'no status on the panel' | 'status without a code segment (several pieces)' | 'status without a code segment'"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs tools/measure/make-scenario.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 3,
      "title": "Motivo por dependência na seleção",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "selectDeliverables({ ..., explain }) -> { order, skipped, notes, error }; com explain cada dependência faltante é '<id>: <motivo>', juntadas por '; '"
      ],
      "consumes": [
        {
          "task": 2,
          "sig": "card.onTargetEvidence sem segmento code: 'no status on the panel' | 'status without a code segment (several pieces)' | 'status without a code segment'"
        }
      ],
      "covers": [
        "AC1",
        "C1",
        "C2"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/*.test.mjs\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs",
          "expect": "exit 0, depois do commit e com o HEAD estável"
        },
        {
          "cmd": "node -e \"const c=require('child_process'),f='plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js',len=s=>s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length,git=a=>c.execFileSync('git',a,{encoding:'utf8',maxBuffer:67108864}),show=r=>git(['show',r+':'+f]),rev=git(['rev-list','HEAD','--',f]).split(String.fromCharCode(10)).filter(Boolean).find(r=>show(r).indexOf('explain: true')<0),now=len(require('fs').readFileSync(f,'utf8')),d=now-len(show(rev));console.log(now,d);process.exit(d<=1200?0:1)\"",
          "expect": "exit 0, com o tamanho e o delta impressos (delta de no máximo 1200)"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 4,
      "title": "Frase sobre gate nos agentes de spec e plano",
      "deps": [
        3
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/spec-author.md",
          "plugins/productivity-tools/agents/plan-author.md"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agent-contracts.test.mjs"
        ]
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [
        "AC2"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs tools/measure/make-scenario.test.mjs tools/measure/run-batch.test.mjs",
          "expect": "exit 0, depois do commit e com o HEAD estável"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 5,
      "title": "Testes aceitam valores com e sem aspas",
      "deps": [
        4
      ],
      "files": {
        "create": [],
        "modify": [],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "extratores de teste (nonceOf, unshq, CAP_LINE, loadAnswer, tracker falso) leem valores do shq com e sem aspas"
      ],
      "consumes": [],
      "covers": [
        "AC3"
      ],
      "testFirst": {
        "exempt": "só testes: os extratores passam a aceitar as duas formas e ficam verdes com o shq de hoje; o teste que falha primeiro é o da Tarefa 6"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "git diff --quiet -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "expect": "exit 0 (o shq temporário da prova foi desfeito)"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
          "expect": "exit 0, com o roadmap-release.js sem mudança"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 6,
      "title": "shq sem aspas em valores seguros",
      "deps": [
        5
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "shq(s) -> valor sem aspas quando casa ^[A-Za-z0-9_%+=:./-]+$; senão entre aspas simples POSIX; vazio vira ''"
      ],
      "consumes": [
        {
          "task": 5,
          "sig": "extratores de teste (nonceOf, unshq, CAP_LINE, loadAnswer, tracker falso) leem valores do shq com e sem aspas"
        }
      ],
      "covers": [
        "AC3",
        "C3",
        "C4"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 2,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/!(roadmap-release-agy).test.mjs\"",
          "expect": "exit 0 (o roadmap-release-agy.test.mjs é do orquestrador antes do merge, DEC-036)"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs",
          "expect": "exit 0, depois do commit e com o HEAD estável"
        },
        {
          "cmd": "node -e \"const c=require('child_process'),f='plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js',len=s=>s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length,git=a=>c.execFileSync('git',a,{encoding:'utf8',maxBuffer:67108864}),show=r=>git(['show',r+':'+f]),rev=git(['rev-list','HEAD','--',f]).split(String.fromCharCode(10)).filter(Boolean).find(r=>show(r).indexOf('A-Za-z0-9_%+=:./-')<0),now=len(require('fs').readFileSync(f,'utf8')),d=now-len(show(rev));console.log(now,d);process.exit(d<=300?0:1)\"",
          "expect": "exit 0, com o tamanho e o delta impressos (delta de no máximo 300)"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        },
        {
          "cmd": "node --test \"plugins/**/!(roadmap-release-agy).test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/!(run-batch|make-scenario).test.mjs\"",
          "expect": "exit 0 pelo Git Bash, depois do commit e com o worktree parado; fail 0 (comando do gate da DEC-036; o G1 completo, com o piso do merge anterior, é do orquestrador no merge)"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/cleanup.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir o trabalho respeitando o limite de 4 arquivos por tarefa, se o shq e as expressões de teste que o leem somam cinco arquivos?",
      "decision": "Seis tarefas em sequência. O C1 vira duas: a Tarefa 5 faz os extratores de flow, discovery-slices e load-slices aceitarem as duas formas, verde com o shq de hoje; a Tarefa 6 muda o shq com as asserções literais de flow.test.mjs e prompts.test.mjs. O conjunto indivisível (o shq e os literais) fica em três arquivos, sem exceção ao limite.",
      "basis": "O pedido limita cada tarefa a 4 arquivos de edição e manda manter o menor conjunto; só as asserções literais precisam mudar junto com o fonte, e cleanup.test.mjs lê o fonte, que não muda nesse ponto.",
      "alternative": "Uma tarefa única do C1 com cinco arquivos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como dar contagem mínima ao teste negativo de status sem a flag, se a leitura estática mostra que hoje nenhum prompt traz o comando status em texto (a releitura vai codificada no payload do verify-run read)?",
      "decision": "O laço corre sobre os prompts mais uma linha de controle montada por PU.cliCmd com --deliverable E1, a regex aceita a pasta nas duas formas, a contagem de casamentos é de ao menos 1 e as asserções por prompt continuam.",
      "basis": "A spec pede contagem mínima para o laço não passar vazio; uma contagem só sobre os prompts falharia, e o controle prova que a regex ainda reconhece o comando que o workflow montaria, no formato novo e no antigo.",
      "alternative": "Exigir ao menos um casamento nos prompts (falha hoje) ou deixar o laço como está (vazio em silêncio, contra a DEC-004).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O que fazer com consumidores que a lista do R5 da spec não cita ou cita só como expectativa?",
      "decision": "flow.test.mjs 3273-3274 (cliCmd com a pasta) passa ao formato novo na Tarefa 6; a asserção negativa da linha 4778, que ficaria vazia sem aspas, passa a olhar a linha do capture run e a recusar --spec nas duas formas, na Tarefa 5.",
      "basis": "A spec manda o plano conferir a lista contra o código integrado e tratar um consumidor achado pelas regras do R5; DEC-004 proíbe teste negativo vazio.",
      "alternative": "Ajustar só as linhas citadas e descobrir o resto na execução.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como afirmar que uma injeção por replace aconteceu sem a asserção ser engolida pelo workflow?",
      "decision": "O teste guarda os pares de antes e depois numa lista fora do callback do agente e afirma, depois da execução, que houve ao menos uma troca e que cada texto mudou.",
      "basis": "Os dois testes esperam falha da execução; um erro lançado dentro do callback pode virar essa mesma falha e passar.",
      "alternative": "assert dentro do callback.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que fazer com os testes do checker que esperam zero problemas numa célula de várias peças sem code?",
      "decision": "Os três (multi-segment, fix9 e final1) passam a esperar exatamente um aviso status-no-code, com severidade e ID conferidos, sem trocar a fixture.",
      "basis": "A spec deixou a conferência ao plano; a leitura achou esses três. A igualdade exata mantém o rigor: continuam provando que a célula é aceita sem erro.",
      "alternative": "Trocar as fixtures para rótulos code, o que deixaria de cobrir células por peça.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O texto do aviso status-no-code cita a célula?",
      "decision": "Não: cita o ID e a consequência para o roadmap-release.",
      "basis": "commitWrites do roadmap.mjs compara os problemas antes e depois de cada escrita; com a célula na mensagem, toda mudança de status numa linha por peças repetiria o aviso como novo.",
      "alternative": "Repetir a célula na mensagem.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual a frase literal sobre gate nos agentes?",
      "decision": "A frase em inglês escrita na Tarefa 4, igual nos dois arquivos, com quatro trechos conferidos pelo teste de contrato.",
      "basis": "Os agentes são escritos em inglês; a spec fixa o conteúdo (name, exemplo do kind, condição e release.config.json) e a condição segue a linha 3123 do workflow.",
      "alternative": "Deixar a redação ao executor, com o teste escrito depois.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como o check mede o delta de cada teto sem saber o SHA anterior à tarefa e com o assunto dos commits dado pelo coordinator?",
      "decision": "O check compara o arquivo com a versão mais nova do histórico sem a marca da tarefa (explain: true na Tarefa 3, a classe de caracteres seguros na Tarefa 6), e as marcas são escritas literalmente; entre o teto e a parada o executor enxuga até o teto.",
      "basis": "A spec define a medida entre o commit anterior e o commit da tarefa; a marca acha esse ponto antes e depois do commit e com commits de correção, e o tratamento do intervalo repete o do plano do E43.",
      "alternative": "Número absoluto sobre a partida de 269471, que não separa os dois tetos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "As tarefas independentes podem correr em paralelo, e onde se executa?",
      "decision": "Cadeia linear de 1 a 6, no worktree próprio da branch plan/pos-2-6-0-E46, com o shq por último e o G1 antes da Tarefa 1 e depois do commit da Tarefa 6.",
      "basis": "As Tarefas 3, 5 e 6 partilham arquivos e há testes que quebram com commit no meio da execução; o G1 final cobre as seis. A branch e o merge vêm do pedido deste plano.",
      "alternative": "Paralelizar as Tarefas 1, 2 e 4.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "removedTests": []
}
```
