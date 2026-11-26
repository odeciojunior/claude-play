# Plano E47 -- Retomada finish-merge com testes removidos declarados

Spec: `docs/plans/pos-2-6-0-E47/spec.md`. Cobre REQ-010 (#17), com as decisões DEC-004, DEC-007, DEC-008, DEC-011, DEC-021 e DEC-036. Branch `plan/pos-2-6-0-E47`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E47`, com merge em `release/pos-2.6.0` depois da conferência. O worktree ainda não existe: criá-lo a partir de `release/pos-2.6.0`, depois do commit deste plano, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E47 D:/projects/claude-play-wt/pos-2-6-0-E47 release/pos-2.6.0`). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz de `D:/projects/claude-play-wt/pos-2-6-0-E47` (rodados em outro checkout, testam outro código e dão verde falso).

O código foi lido com E42 a E46 e E50 a E52 integrados (último merge `26cfb3c`). Os trechos são citados por símbolo, não por número de linha.

Três tarefas em sequência, um commit por tarefa: o modo `removed --merge` no `test-extract.mjs`, o desconto no ramo `finish-merge` do workflow e a frase em `operator.md`.

## Testes: o que roda e quando

- Piso do G1, do merge do E46 registrado em `docs/plans/roadmap-pos-2-6-0/log.md`: exit 0, tests 2713, pass 2711, fail 0, skipped 2.
- DEC-036: nenhum check de tarefa inclui `roadmap-release-agy.test.mjs` nem o G1 completo. O teste do agy sozinho, o `run-batch.test.mjs` sozinho e o G1 completo são do orquestrador (seção Fechamento), com rollback no merge.
- Cada check precisa terminar com folga abaixo de 600 s. Medidas sob carga: `run-batch.test.mjs` 576 s, `make-scenario.test.mjs` 388 s, `flow.test.mjs` do plan-coordinator 351 s. `run-batch.test.mjs` e `make-scenario.test.mjs` não entram em nenhum check de tarefa (DEC-036).
- Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree. A suíte é sensível a carga: não rodá-la enquanto outra execução de testes corre em outro worktree.

## Medida de tamanho

Antes e depois da Tarefa 2, medir os caracteres LF do `roadmap-release.js` e informar os dois números no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length;console.log(n)"
```

A partida medida na escrita do plano é 269.884. O teto do E47 (B4) é de 3.500 caracteres LF de delta líquido entre o commit anterior à Tarefa 2 e o commit da tarefa. Entre o teto e 4.200 (20% acima), o executor enxuga até caber no teto e não marca a tarefa como pronta antes disso. Acima de 4.200, parar e voltar ao dono via subagente opus (DEC-007, DEC-021). A trava de 284.500 não muda.

O check de tamanho compara o arquivo com a versão mais nova do histórico que ainda não tem a marca `integrityNetOfDeclared`, então vale antes e depois do commit e com commits de correção. Por isso a marca é o nome literal da função.

A estimativa na escrita do plano é de cerca de 2.000 caracteres, com o auxiliar comum ao laço de tentativas (ruling R1).

## Tarefas

### Tarefa 1: Modo removed --merge no test-extract

Arquivos: mudar `plugins/productivity-tools/scripts/test-extract.mjs`; teste em `plugins/productivity-tools/scripts/test-extract.test.mjs`.

Contrato da chamada:

- `removed --merge <sha> --nonce <n> --spec <rel> --plan <rel> --cwd <dir>`. `removedCommand` desvia para o modo novo quando o argumento `--merge` está presente (mesmo sem valor). O `capture.mjs` importa `extractTests`, e o `load-slices.test.mjs` copia só `capture.mjs` e `test-extract.mjs`: `lib/` e `spec-tool.mjs` continuam carregados só por import dinâmico dentro do subcomando.
- Ordem das recusas, todas pelo `refuse()` de hoje (`{ tool, command: 'removed', nonce, error }`, sem digest, exit 2):
  1. `--output`, `--sha`, `--base` ou `--gate` presentes: `--<nome> não vale com --merge`;
  2. `nonce`, `merge`, `spec`, `plan` ou `cwd` vazios ou ausentes: `falta --<nome>`;
  3. `git -C <cwd> rev-parse --verify <merge>^1^{commit}` com exit diferente de 0: `merge inválido (não resolve para um commit com primeiro pai)`;
  4. `git show <merge>:<caminho>` falha: `spec ausente no merge` ou `plano ausente no merge`;
  5. bloco de dados ilegível ou `removedTests` inválido: `spec: <mensagem>` ou `plano: <mensagem>`, com o mesmo `readDataBlock` e o mesmo `checkRemovedTests` do modo de hoje.
- A leitura do bloco de um texto (parse, ausência de `removedTests`, validação) vira um auxiliar único usado pelos dois modos. O modo de hoje mantém argumentos, mensagens e saída.
- Pares `file::name`: todas as entradas de spec e plano, com ou sem `gate`, sem repetição.

Verificação de cada par, nesta ordem, com o motivo que vai para `unverified`:

| Checagem | Motivo |
|---|---|
| arquivo existe em `<merge>^1` | `arquivo ausente em merge^1` |
| o literal do nome aparece em `merge^1` | `nenhum literal do nome em merge^1 (teste gerado em laço ou nome diferente)` |
| uma única vez | `o nome aparece N vezes em merge^1` |
| `TEST_CALL` de hoje casa o texto antes do literal | `o literal não é o 1º argumento de test( ou it(` |
| o texto depois do literal casa `^\s*[,)]` | `o literal não é o argumento inteiro (depois dele só , ou ))` |
| o literal não aparece no arquivo em `<merge>` (arquivo apagado conta como ausente) | `o nome continua no arquivo em merge` |

O tamanho do literal depende das aspas achadas: o escape que o `literalHits` já faz vira um auxiliar usado nos dois lugares. Não há checagem de "ainda roda".

Cobertura do arquivo inteiro. Candidatos: arquivos com par declarado que existem em `merge^1` e não existem em `<merge>`. O texto é o de `merge^1` (o `gitShow` já normaliza CRLF). Regex exatas:

```
NODE_IMPORT  /^[ \t]*(?:import\s+([^;'"]*?)\s+from\s*['"]node:test['"]|(?:const|let|var)\s+([^=;]*?)\s*=\s*require\(\s*['"]node:test['"]\s*\))/gm
BARE_CALL    /(?<![\w$.])(?:test|it)(?:(?:\.\w+)*\s*\(|(?:\.\w+)+\s*`)\s*/g
MEMBER_CALL  /\.(?:test|it)(?:\.\w+)*\s*\(\s*(?=['"`]|async\b|function\b|\([^()\n]*\)\s*=>|(?:[^()\n]|\([^()\n]*\))*,)/g
OTHER_CALL   /(?<![\w$.])(?:xit|fit|specify)(?:\.\w+)*\s*\(/
LOOP         /\bfor(?:\s+await)?\s*\(|\bwhile\s*\(|\.(?:forEach|map|flatMap|reduce)\s*\(/
LINE_COMMENT /^[ \t]*\/\/.*$/gm
```

- Import: o grupo 1 ou 2 de `NODE_IMPORT` é a cláusula. O nome fora das chaves (import default ou `const x = require(...)`) precisa ser `test` ou `it`; qualquer outro nome, inclusive `* as x`, reprova. Dentro das chaves, cada item se divide em origem e nome local por `as` ou `:`. Para origem `test` ou `it`, o nome local tem de ser igual à origem; para `default`, tem de ser `test` ou `it`; nesses casos, qualquer outro nome reprova. Itens de outra origem (`describe`, `before`, `after`, `mock` etc.) não reprovam, desde que o nome local não seja `test` nem `it`. O arquivo precisa de ao menos um nome local `test` ou `it` vindo de `node:test`.
- Laço: `LOOP` é aplicado ao texto sem as linhas que casam `LINE_COMMENT` (comentário no fim de uma linha de código não é removido).
- `OTHER_CALL` presente reprova.
- Chamadas: todos os casamentos de `BARE_CALL` e `MEMBER_CALL` no texto inteiro. A posição do 1º argumento é o fim do casamento. Precisa haver ao menos uma chamada, e a posição de cada uma tem de ser a posição do literal de um par verificado desse arquivo. `/re/.test(s)` não casa; `t.test(name, fn)` casa e reprova.

Arquivo aprovado entra em `deletedCovered`, em ordem alfabética, com o caminho exatamente como declarado. Arquivo candidato reprovado ganha uma entrada `{ file, name: '*', reason }` em `unverified`, posta antes das entradas de pares, com o primeiro motivo que valer, nesta ordem:

- `cobertura parcial: o arquivo não importa test ou it de node:test sem renomear`
- `cobertura parcial: o arquivo tem laço`
- `cobertura parcial: o arquivo chama xit, fit ou specify`
- `cobertura parcial: nenhuma chamada de teste`
- `cobertura parcial: N chamada(s) de teste sem par verificado (1ª na linha L)`

Saída: `{ tool: 'test-extract', command: 'removed', nonce, merge, verified, deletedCovered, unverified, unverifiedCut, digest }`, assinada por `fnv1a(JSON.stringify(canon(rest)))`, com `merge` igual ao valor recebido. Só `unverified` é cortado (do fim) para caber em `MAX_COPY_BYTES`; se a linha não cabe com `unverified` vazio, recusa `a linha passa do limite de cópia`. `verified` conta pares verificados, cobertos ou não.

Testes, num auxiliar novo ao lado do `removedRepo`: repositório temporário com commit base, uma branch que apaga ou muda testes e versiona spec e plano em `docs/plans/x/`, um commit próprio no ramo principal e `git merge --no-ff` (dois pais). Casos, com nomes começados por `E47`:

- (a) declarada (uma das entradas com `gate`) e verificada com o arquivo inteiro coberto: sai em `deletedCovered`, `verified` conta o par, a linha passa no `checkRun`, o `digest` confere, as chaves são as do contrato, outro nonce falha, e um SHA curto em `--merge` volta igual em `merge`; o arquivo coberto importa `{ test, after } from 'node:test'`;
- (b) arquivo apagado com duas chamadas `test(` e uma declarada: fora de `deletedCovered`, `verified` 1, motivo de cobertura parcial;
- (c) nome que não aparece em `merge^1` e nome que continua no arquivo em `<merge>`: em `unverified`;
- (d) um arquivo apagado por caso, com os demais testes declarados e verificados, todos fora de `deletedCovered`: `it.each(`; chamada com nome em template; `test('caso ' + i, ...)` dentro de `for` com `caso ` declarado (o par fica em `unverified` pelo argumento inteiro); nome único dentro de `.forEach(`; teste declarado com `t.test('sub', ...)`; `t.test(name, ...)`; `import { test as check, it } from 'node:test'` com um `it` declarado; arquivo com `xit(`. No mesmo repositório, um arquivo coberto cujo corpo usa `/re/.test(s)` entra em `deletedCovered`;
- (e) recusas, cada uma com as chaves exatas `tool, command, nonce, error` e exit 2: cada um de `--output`, `--sha`, `--base`, `--gate` junto com `--merge`; merge inexistente; commit sem primeiro pai; spec ausente no merge; plano ausente no merge; bloco `removedTests` inválido;
- corte: muitos pares não verificados dão `unverifiedCut` maior que 0 e linha dentro de `MAX_COPY_BYTES`; `deletedCovered` que sozinho passa do limite dá a recusa.

Os fixtures são strings dentro do arquivo de teste: não escrever `.skip`, `.only`, `.todo` nem `skipIf` neles, nem linha começada por `// test(`, `// it(` ou `// expect`. Os testes `removed` de hoje não mudam.

Passos:

1. Teste primeiro: o auxiliar e os casos acima; rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs` e ver os casos novos falharem.
2. Implementar o modo e ver o arquivo de teste passar.
3. Commit só com os arquivos da tarefa: `feat(productivity-tools): modo removed --merge no test-extract (#17)`.
4. Com o commit feito e o worktree parado, rodar os checks da tarefa.

### Tarefa 2: Desconto no ramo finish-merge

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Contrato:

- No bloco `<pure>`, logo depois de `integrityHardAlerts`: `integrityNetOfDeclared(integ, covered) -> integ` com `deletedTests` sem as entradas iguais, string a string, a um item de `covered`; os outros campos iguais; sem normalizar caminho nem casar sufixo. É declarada com `function`, no começo da linha: o `loadPure` só exporta declarações `function`.
- Junto de `runPrompt` e `S_RUN`, fora do bloco puro, dois auxiliares comuns ao `removedFloor` e à retomada:
  - `askRemoved(cmd, nonce, label, phase) -> Promise<{ ok, why?, data? }>`: até três tentativas com `productivity-tools:script-runner`, rótulos `<label>`, `<label>-retry2`, `<label>-retry3`, modelos haiku, haiku, sonnet, `effortFor`, `S_RUN` e `runPrompt`; devolve o resultado do `checkRun(..., 'test-extract', nonce)` na primeira linha válida ou na recusa que traz o nonce; sem nenhuma, `{ ok: false, why: 'bad copy' }`;
  - `unvTxt(data) -> string`: o texto de hoje, `; <file>::<name> (<reason>)` por item de `unverified` e `; N more` quando `unverifiedCut > 0`.
- `removedFloor` passa a usar os dois, com o mesmo comportamento: `why` continua `none` sem declaração, `bad copy`, o motivo da recusa ou `wrong line`; rótulos, fase `Gates` e textos iguais. Os testes `E36 T5` não mudam.
- `const pluginRoot = pluginRootOf(A.trackerCli)` sobe para antes do ramo que começa com `resumeAction(card, STATUSES) === 'finish-merge'`; a declaração antiga sai.
- No ramo, depois da medida `${E}:resume-test-integrity` e do aviso de integridade não medida, e antes dos alertas heurísticos e de `hardAlerts`: só com a medida válida (`removedAsserts >= 0`), `deletedTests` não vazio e `integrityAckMatches` sem casar:
  - nonce `${RUN_TAG}:${E}:removed-merge`, saneado como no `removedFloor`;
  - comando `node "<pluginRoot>/scripts/test-extract.mjs" removed --merge <card.mergeSha> --nonce <n> --spec <AP.spec> --plan <AP.plan> --cwd <INTWT>`, nessa ordem, cada valor por `shq`;
  - chamada por `askRemoved` com o rótulo `${E}:resume-removed` e a fase `Merge`; com `pluginRoot` nulo não há chamada;
  - a linha só vale com `ok`, `data.merge === card.mergeSha` e `data.deletedCovered` lista de strings (senão o motivo é `wrong line`);
  - `covered` é o `deletedCovered` da linha aceita, ou `[]`.
- Os alertas heurísticos e `hardAlerts` passam a ser calculados sobre o resultado de `integrityNetOfDeclared` (sem verificação, sobre o `integ` medido).
- Com ao menos um arquivo descontado, `out.concerns` ganha `resume: deleted test files declared in removedTests and verified at the merge <sha>: <arquivos>` (arquivos separados por `, `), mesmo que outro alerta ainda quebre.
- Quando a verificação foi tentada e o entregável quebra, o motivo do `markBroken` (que vira o `what` da ação `merge-rejected`) termina, depois dos alertas, com um destes sufixos:
  - linha aceita: `; removed --merge verified deletedCovered: <arquivos ou none>` seguido de `unvTxt(data)`;
  - linha não aceita: `; removed --merge not verified: <motivo>`, com motivo `bad copy`, `test-extract refused: <erro>`, `wrong line` ou `the plugin root cannot be derived from trackerCli`.
- Não mudam: `doNow`, `kind` `conteudo`, `acceptIntegrityAlerts` (lido só de `args`, para o SHA exato, fora dos `resumeArgs`), `TEST_INTEGRITY_DEFAULT`, o caminho sem retomada, `lib/`, os blocos embutidos e `roadmap-release-agy.py`.

Testes, em `flow.test.mjs`:

- No `answerRaw` do `exec`, resposta padrão `null` para os rótulos `:resume-removed`, `-retry2` e `-retry3` (verificação indisponível): os testes de hoje com `deletedTests` continuam quebrando sem mudar uma asserção.
- Um auxiliar que assina a linha do modo novo, com o nonce de `nonceOf(prompt)` e o `merge` de `shqValue(prompt, '--merge')`. Toda regex que lê valor do comando aceita as duas formas, com e sem aspas.
- `E47 AC1: deleted test files covered by the signed removed --merge line do not break the resumed merge`: `merged: true`, sem `broken` nem `error`, a preocupação nomeia `t/a.test.js`; uma só chamada, `script-runner`, haiku, fase `Merge`; o prompt traz `removed --merge` com `e0`, o nonce terminado em `:E1:removed-merge`, `--spec` e `--plan` com `docs/plans/x-E1/spec.md` e `plan.md` e `--cwd /wt/_integracao`.
- `E47 AC1: integrityNetOfDeclared removes only exact entries and keeps every other field`, por `loadPure()`: `covered` `['t/a.test.js']` não remove `x/t/a.test.js`; `removedAsserts`, `skipsAdded`, `prodChanged` e `assertsAdded` saem iguais.
- `E47 AC2: ...`, todos com `broken: true` e conferindo o `what` da ação `merge-rejected`:

| Caso | `what` contém | Conferência extra |
|---|---|---|
| `deletedCovered: []` com um `unverified` e `unverifiedCut: 2` | `deletedCovered: none`, arquivo, nome, motivo, `2 more` | uma chamada |
| `merge` de outro SHA | `not verified: wrong line` | uma chamada |
| `deletedCovered` que não é lista de strings | `not verified: wrong line` | uma chamada |
| linha válida de outro nonce | `not verified: bad copy` | três chamadas |
| dois arquivos apagados, um coberto | `deleted test files: t/b.test.js` e `deletedCovered: t/a.test.js` | a preocupação nomeia `t/a.test.js` |
| digest errado nas três tentativas | `not verified: bad copy` | rótulos `resume-removed`, `-retry2`, `-retry3`; haiku, haiku, sonnet |
| runner nulo nas três tentativas | `not verified: bad copy` | três chamadas |
| recusa do `refuse()` de hoje, sem digest: o mock devolve `{ tool: 'test-extract', command: 'removed', nonce, error }` com o nonce do prompt (spec ausente no merge) | `refused: spec ausente no merge` | uma chamada |
| linha que cobre o arquivo, com `removedAsserts: 1` | `1 assertions removed` | `what` sem `deleted test files` |

- `E47 AC2: an acknowledged merge and a merge without deleted test files never call the runner`: com `acceptIntegrityAlerts: { E1: 'e0' }` fecha como hoje, com a preocupação do operador; com `deletedTests: []` não aparece nenhum rótulo `resume-removed`.

Nenhum teste de hoje é apagado, afrouxado ou muda de sentido (DEC-004).

Passos:

1. Medir o tamanho do `roadmap-release.js`.
2. Teste primeiro, em `flow.test.mjs`; rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e ver os casos novos falharem.
3. Implementar e ver o arquivo de teste passar.
4. Medir o tamanho de novo (teto de 3.500 sobre a medida do passo 1; parada acima de 4.200).
5. Commit só com os arquivos da tarefa: `feat(roadmap-release): retomada desconta testes removidos declarados e verificados no merge (#17)`, com a linha `paridade agy: pendente #13` no corpo do commit.
6. Com o commit feito e o worktree parado, rodar os checks da tarefa.

### Tarefa 3: Frase de operação sobre o desconto

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/references/operator.md`.

Na seção `## Integrity alerts`, no fim do primeiro parágrafo (o que termina em "`doNow` carries the full merge SHA."), acrescentar esta frase, literal:

> Test files deleted by a resumed merge, declared in `removedTests` in the spec or the plan of that merge and verified by `test-extract.mjs removed --merge`, are not an alert when the whole file is covered; removed assertions and added skips still are.

Nenhum orçamento de prosa cobre o `operator.md` (conferido na escrita do plano: os testes de orçamento não carregam as referências do roadmap-release). Os testes que leem o arquivo são `docs.test.mjs` e `flow.test.mjs`; o `copy-budget.test.mjs` e o `encoding.test.mjs` varrem os arquivos do plugin.

O comando do gate da DEC-036 não é check desta tarefa: o coordinator o roda como gate de onda, depois da onda.

O segundo check cabe no limite de 600 s por inferência, sem medida isolada: os cinco arquivos dele fazem parte do comando do gate, que inteiro levou 247 s na linha de base do E45 e 268 s na do E46 (`progress.json` de cada um).

Passos:

1. Editar o `operator.md`.
2. Commit só com o arquivo da tarefa: `docs(roadmap-release): desconto de testes removidos na retomada (#17)`.
3. Com o commit feito e o worktree parado, rodar os checks da tarefa.

## Fechamento

- Conferir AC1 e AC2, G2 e G5 na branch.
- Antes do merge, o orquestrador roda pelo Git Bash, com o worktree parado: `node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs` sozinho, `node --test tools/measure/run-batch.test.mjs` sozinho e o G1 completo (`node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`). Se o teste do agy falhar por causa do workflow, não editar o `roadmap-release-agy.py` (DEC-008): voltar a decisão ao dono via subagente opus.
- Merge de `plan/pos-2-6-0-E47` em `release/pos-2.6.0` depois da conferência (revisão T2). O corpo do commit de merge leva obrigatoriamente a linha `paridade agy: pendente #13`.
- No merge, o G1 completo na árvore do merge: exit 0, `fail 0`, `tests` não menor que 2713 e `pass` não menor que 2711. Com falha, desfazer o merge (rollback).
- Pronto: AC1 e AC2 verdes em `release/pos-2.6.0`; G1 acima do piso; G2 sem FAIL; G5 verde com os 4 alvos e sem regeneração; G4 (`claude plugin validate .`) válido; `roadmap-release.js` dentro do teto da tarefa e da trava de 284.500.
- Item para o registro do entregável, feito por quem integra, pela CLI do tracker (este plano não edita o roadmap): checklist "paridade agy: pendente #13".
- Sem bump de versão, push, tag ou comentário em issue.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E47",
  "title": "Retomada finish-merge com testes removidos declarados",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E47, branch plan/pos-2-6-0-E47, criado a partir de release/pos-2.6.0 depois do commit deste plano; merge em release/pos-2.6.0 depois da conferência. Todo comando e check roda com o diretório atual na raiz desse worktree.",
    "Cada tarefa edita no máximo 4 arquivos e tem um commit com só os arquivos da própria tarefa.",
    "Nenhum check de tarefa inclui roadmap-release-agy.test.mjs nem o G1 completo; check por diretório usa o padrão !(roadmap-release-agy).test.mjs. O teste do agy sozinho, o run-batch.test.mjs sozinho e o G1 completo são do orquestrador, com rollback no merge (DEC-036).",
    "Piso do G1, do merge do E46: exit 0, tests 2713, pass 2711, fail 0, skipped 2.",
    "Cada check termina com folga abaixo de 600 s; run-batch.test.mjs e make-scenario.test.mjs não entram em nenhum check de tarefa (DEC-036).",
    "Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree; nenhuma suíte enquanto outra execução de testes corre em outro worktree.",
    "roadmap-release.js: delta líquido de no máximo 3500 caracteres LF na Tarefa 2; entre o teto e 4200, enxugar até o teto; acima de 4200, parar e voltar ao dono via subagente opus (DEC-007, DEC-021); trava de 284500 mantida.",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py nem no teste dele (DEC-008); os commits que tocam roadmap-release.js e o commit de merge levam no corpo a linha 'paridade agy: pendente #13'.",
    "Não descontar removedAsserts, skipsAdded nem alerta heurístico; não apagar teste nem afrouxar teste negativo (DEC-004).",
    "acceptIntegrityAlerts não muda: lido só de args, para o SHA exato, e fora dos resumeArgs.",
    "O caminho sem retomada (removedFloor, portões na branch) e o subcomando removed de hoje mantêm contrato e testes.",
    "TEST_INTEGRITY_DEFAULT, lib/ e os blocos embutidos não mudam; embed.mjs --check nos 4 alvos segue em dia.",
    "Não escrever o número do limite de cópia em nenhum arquivo do plugin fora de lib/plan-digest.mjs; usar MAX_COPY_BYTES.",
    "Citar símbolos, nunca depender de número de linha do roadmap-release.js.",
    "Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "Não editar nada em docs/plans/roadmap-pos-2-6-0/.",
    "Sem bump de versão, push, tag ou comentário em issue."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Modo removed --merge no test-extract",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/test-extract.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/test-extract.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "test-extract.mjs removed --merge <sha> --nonce <n> --spec <rel> --plan <rel> --cwd <dir> -> { tool, command, nonce, merge, verified, deletedCovered, unverified, unverifiedCut, digest }; recusa { tool, command, nonce, error } com exit 2"
      ],
      "consumes": [],
      "covers": [
        "AC2",
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
        "reasoning": 2,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
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
      "title": "Desconto no ramo finish-merge",
      "deps": [
        1
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
        "integrityNetOfDeclared(integ, covered) -> integ sem os deletedTests cobertos"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "test-extract.mjs removed --merge <sha> --nonce <n> --spec <rel> --plan <rel> --cwd <dir> -> { tool, command, nonce, merge, verified, deletedCovered, unverified, unverifiedCut, digest }; recusa { tool, command, nonce, error } com exit 2"
        }
      ],
      "covers": [
        "AC1",
        "AC2",
        "C1",
        "C3",
        "C4",
        "C5"
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
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs tools/measure/review-loop.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const c=require('child_process'),f='plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js',len=s=>s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length,git=a=>c.execFileSync('git',a,{encoding:'utf8',maxBuffer:67108864}),show=r=>git(['show',r+':'+f]),rev=git(['rev-list','HEAD','--',f]).split(String.fromCharCode(10)).filter(Boolean).find(r=>show(r).indexOf('integrityNetOfDeclared')<0),now=len(require('fs').readFileSync(f,'utf8')),d=now-len(show(rev));console.log(now,d);process.exit(d<=3500&&now<=284500?0:1)\"",
          "expect": "exit 0, com o tamanho e o delta impressos (delta de no máximo 3500 e tamanho de no máximo 284500)"
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
      "n": 3,
      "title": "Frase de operação sobre o desconto",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md"
        ],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [
        "AC1"
      ],
      "testFirst": {
        "exempt": "só documentação: uma frase em operator.md, conferida por um check de texto"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "node -e \"const s=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/references/operator.md','utf8').split('## Integrity alerts')[1].split(String.fromCharCode(10)+'## ')[0];process.exit(s.includes('removed --merge')&&s.includes('are not an alert when the whole file is covered; removed assertions and added skips still are.')?0:1)\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
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
      "command": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "O laço de tentativas do removedFloor vira um auxiliar comum com a retomada?",
      "decision": "Sim: askRemoved(cmd, nonce, label, phase) e unvTxt(data), no nível do módulo, usados pelo removedFloor e pelo ramo finish-merge, com os rótulos, modelos e textos de hoje.",
      "basis": "A spec pediu a avaliação; o laço e o texto dos não verificados são iguais nos dois usos, o auxiliar poupa caracteres e os testes E36 T5 conferem que o removedFloor não mudou.",
      "alternative": "Copiar o laço dentro do ramo de retomada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como uma cobertura parcial aparece em unverified, que é uma lista de pares?",
      "decision": "Uma entrada por arquivo apagado reprovado, com name '*' e o motivo começado por 'cobertura parcial:', posta antes das entradas de pares.",
      "basis": "O AC2 pede o motivo em unverified; o mesmo formato { file, name, reason } já é lido pelo workflow, e as entradas na frente sobrevivem ao corte.",
      "alternative": "Um campo novo na linha, fora do contrato da spec.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quando uma chamada .test( ou .it( sem literal conta, se t.test(name, ...) deve reprovar e /re/.test(s) não?",
      "decision": "Conta quando o 1º argumento começa por literal, por async ou function, por uma arrow na mesma linha, ou quando há vírgula depois dele antes de fechar a chamada (com um nível de parênteses).",
      "basis": "Um registro de teste leva nome e função, e RegExp.prototype.test leva um só argumento; a regra textual atende aos dois exemplos da spec e, ao errar, erra para o lado de quebrar.",
      "alternative": "Contar toda chamada .test(, o que reprovaria o arquivo com /re/.test(s) que o AC2 exige coberto.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como ler o import de node:test e o comentário de linha na busca de laço?",
      "decision": "Import default, namespace ou require em variável só valem com o nome test ou it; nas chaves, test e it não podem ser renomeados, default só vale com o nome test ou it, e itens de outra origem não reprovam desde que o nome local não seja test nem it. Na busca de laço saem só as linhas inteiras de comentário.",
      "basis": "Cobre as formas usadas nos testes do repositório; remover comentário no fim da linha confundiria URLs em strings e poderia esconder um laço.",
      "alternative": "Analisar o arquivo com um parser de JavaScript.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que fazer com --single-tests-gate junto de --merge?",
      "decision": "O modo novo não o usa nem o recusa; só os quatro argumentos listados na spec são recusados.",
      "basis": "A flag só afeta o filtro por gate, que não existe no modo --merge, e a spec fixa a lista das recusas.",
      "alternative": "Recusar também a flag.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como manter os testes de retomada de hoje, que passam a disparar um runner que o mock não conhece?",
      "decision": "O exec do flow.test.mjs responde null por padrão aos rótulos resume-removed; cada teste novo responde pelo próprio over.",
      "basis": "Sem resposta o mock lança erro e muda o resultado; null é a verificação indisponível, que mantém a quebra de hoje sem editar asserção.",
      "alternative": "Editar cada teste de retomada com deletedTests.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como dividir o trabalho e quais suítes cada tarefa roda?",
      "decision": "Três tarefas em cadeia: script, workflow e frase. A Tarefa 2 roda o diretório do workflow sem o agy e os testes que leem o roadmap-release.js; a Tarefa 3 roda os testes que leem o operator.md; o run-batch.test.mjs fica com o orquestrador e o comando do gate é o gate de onda do coordinator, fora dos checks; o delta de tamanho é medido contra a última versão sem a marca integrityNetOfDeclared.",
      "basis": "Segue a sugestão da spec, o limite de 4 arquivos, a DEC-036 e o padrão de check de delta do plano do E46.",
      "alternative": "Juntar a frase à Tarefa 2.",
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
