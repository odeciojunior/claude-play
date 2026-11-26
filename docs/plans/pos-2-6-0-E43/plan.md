# Plano E43 -- Releitura da linha de captura

Spec: `docs/plans/pos-2-6-0-E43/spec.md`. Cobre REQ-003 (#3), com o desenho da DEC-009. Branch `plan/pos-2-6-0-E43`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E43`, com merge em `release/pos-2.6.0` depois da conferência. O worktree ainda não existe: criá-lo a partir de `release/pos-2.6.0`, depois do merge do E51, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E43 D:/projects/claude-play-wt/pos-2-6-0-E43 release/pos-2.6.0`). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz de `D:/projects/claude-play-wt/pos-2-6-0-E43` (rodados em outro checkout, testam outro código e dão verde falso).

Duas tarefas em sequência, um commit por tarefa: primeiro o subcomando `line` do `capture.mjs` (AC1), depois a releitura no workflow (AC2), que depende dele.

## Linha de base (G1)

Linha de base no merge do E50 (`857624a`): exit 0, tests 2636, pass 2634, fail 0, skipped 2. O E51 integra antes do E43 e sobe o piso: vale a contagem do merge do E51, registrada no log do roadmap.

Antes da Tarefa 1, medir o G1 pelo Git Bash com o worktree parado e anotar exit, tests, pass, fail e skipped:

```
node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"
```

Nenhum commit, de nenhuma sessão, durante a execução (um commit no meio quebra `tools/measure/run-batch.test.mjs`); se o HEAD mudar, repetir com o HEAD estável. A suíte é sensível a carga: não rodá-la enquanto outra execução de testes corre em outro worktree.

## Medida de tamanho

Antes de começar e depois de terminar a Tarefa 2, medir os caracteres LF do `roadmap-release.js` e informar os dois números no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=270740?0:1)"
```

O ponto de partida medido na escrita do plano é 267.240. O teto do E43 neste arquivo é de 3.500 caracteres (no máximo 270.740, DEC-007). Acima de 271.440 (teto mais 20%), parar e voltar ao dono via subagente opus (DEC-007, DEC-021). Se a partida medida for outra, porque outro entregável integrou antes, o teto é a partida mais 3.500 e a parada é a partida mais 4.200; a trava de 284.500 não muda. Crescimento estimado: 1.500 a 2.500 caracteres. Entre o teto e a parada (270.741 a 271.440), o executor enxuga o wrapper até o arquivo caber no teto e não marca a tarefa como pronta antes disso.

## Tarefas

### Tarefa 1: Subcomando line no capture.mjs

Arquivos: mudar `plugins/productivity-tools/scripts/capture.mjs`; teste em `plugins/productivity-tools/scripts/capture.test.mjs`.

Contrato:

- Uso: `node capture.mjs line --nonce <n> --task <id> [--cwd <dir>]`. Função `runLine(argv, platform) -> { code, line }`, no molde de `runPairs`, despachada por `runCapture` quando `argv[0] === 'line'`.
- Argumentos por `parseFlags` com essas três chaves. `--nonce` em `NONCE_RE` e `--task` em `TASK_RE`; ausentes ou fora do padrão dão `UsageError` (exit 2, `{tool, error}` sem nonce). `--cwd` no estilo msys no win32 dá `MSYS_MSG`. O git-dir vem de `gitDirOrThrow(o.cwd)`.
- Leitura: os `^\d{4,}-line\.json$` de `<git-dir>/pt-evidence/<task>/` em ordem de seq. Descartar o arquivo que não parseia, que não é objeto com `tool: 'capture'`, cujo `digest` não confere (a mesma conferência de `runPairs`) ou com `nonce` diferente de `--nonce`. Entre os que sobram vale o de maior seq.
- Achou (exit 0): o objeto gravado sem `digest`, `tail` e `tailCut`, assinado de novo com `sign`.
- Não achou (pasta ausente, podada ou sem linha válida com o nonce): exit 1 e `{"tool":"capture","command":"line","nonce":<n>,"task":<id>,"error":"no signed line with this nonce in pt-evidence/<task>"}`, com o nonce e a task do pedido. Nada é reassinado.
- O cabeçalho do arquivo ganha a linha de uso e a descrição de `line`, e a mensagem de `parseArgs` passa a citar `line` entre os subcomandos.

`lib/plan-digest.mjs`, a fixture `scripts/fixtures/plan-tool/workflow-copy.js` e o `embed.mjs` não mudam. Não escrever o literal do limite de cópia no arquivo (`copy-budget.test.mjs` exige que ele exista só na lib).

Passos:

1. Teste primeiro, em `capture.test.mjs`, depois do teste `run grava <seq>-line.json igual a linha impressa, com e sem --brief`:
   - `E43 AC1: line reimprime em forma brief a linha gravada, com e sem --brief`: uma captura com `--brief` e outra sem (com `--tests` numa delas), cada uma relida com o mesmo nonce e task. Nos dois casos a saída passa em `checkCapture` com o nonce e o `cmdDigest` da execução e não tem `tail` nem `tailCut`. No caso brief, a saída é igual ao stdout daquela execução e ao `<seq>-line.json`. No caso sem brief, comparar com o `<seq>-line.json` gravado depois de tirar `digest`, `tail` e `tailCut` e assinar de novo.
   - `E43 AC1: com o mesmo nonce vale a maior seq e o arquivo de digest errado é ignorado`: duas execuções com o mesmo nonce; depois, um `<seq>-line.json` com o digest adulterado é ignorado e, sem outra linha válida, sai a recusa.
   - `E43 AC1: nonce sem linha e task sem pasta saem 1 com o nonce do pedido`.
   - `E43 AC1: uso errado de line sai 2 sem nonce`: nonce inválido, task com `/` e `--cwd` msys com `platform` injetada em `runCapture`.
2. Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e ver os casos novos falharem.
3. Implementar `runLine`, o despacho, o cabeçalho e a mensagem de `parseArgs`; ver o arquivo de teste passar.
4. Rodar os checks da tarefa.
5. Commit só com os arquivos da tarefa: `feat(productivity-tools): capture.mjs line reimprime a linha gravada em forma brief (#3)`.

### Tarefa 2: Releitura da captura recusada no workflow

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` e `plugins/productivity-tools/skills/roadmap-release/references/operator.md`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Contrato do wrapper, `rereadMeasure(defs, m, nonceOf, dir, task, label, ph) -> Promise<medida>`, assíncrono, de nível superior junto de `gateNonce`, `gateTask` e `measureTxt` (linhas 1975-1977), fora do bloco puro:

- chama `capturedMeasure(defs, m, nonceOf)`; se o resultado não for objeto, se o `gateWhy` estiver vazio ou se `dir` estiver vazio, devolve-o como está;
- para cada portão `i` com motivo no `gateWhy`, em sequência e fora dos locks, faz até 5 chamadas `agent(runPrompt(cmd), ...)` com `agentType: 'productivity-tools:script-runner'`, `phase: ph`, `schema: S_RUN`, modelo haiku e effort low nas tentativas 1 e 2, sonnet e medium nas tentativas 3 a 5; `model` e `effort` ficam na mesma linha (`prompts.test.mjs` confere);
- `cmd`: `node "<plugin>/scripts/capture.mjs" line --nonce <nonceOf(i)> --task <task> --cwd <shq(dir)>`, com o `<plugin>` de `pluginRootOf(A.trackerCli)`, como no `measureTxt`;
- rótulos: `<label>:reread-g<i>` na primeira tentativa e `<label>:reread-g<i>-retry<t>` nas tentativas 2 a 5;
- em cada tentativa o stdout relido troca só o campo `capture` do item do portão, numa cópia da medida bruta (os outros campos do agente ficam); stdout vazio ou agente nulo entra sem `capture` em string, para o motivo sair `no capture line`; portão omitido entra como `{ name, ran: true, capture }`;
- a validação é só a do `capturedMeasure` sobre a cópia; quando o portão sai do `gateWhy`, a cópia passa a ser a medida de trabalho e a escada daquele portão acaba;
- portão omitido pelo agente cujo resultado vem marcado `fallback`: não entra na medida de trabalho, a escada dele acaba e o motivo da releitura é `the gate needs the agent's counts`;
- a escada para cedo quando o stdout é JSON com `tool: 'capture'`, `command: 'line'`, `error` presente e `nonce` igual a `nonceOf(i)`; recusa sem nonce ou stdout que não é JSON não para;
- no fim devolve a medida do `capturedMeasure` sobre a medida de trabalho; o `gateWhy` de cada portão que continua fora é `<motivo original>; reread: <motivo da última tentativa>`.

Pontos de chamada, só estes dois:

1. Preflight (linha 1998): `pre.baseline = await rereadMeasure(GATES, pre.baseline, i => gateNonce('preflight', i), pre.integrationWorktree, 'preflight-gates', 'preflight', 'Preflight')`, no mesmo ramo de hoje; o ramo de `pre.recorded` não muda.
2. `measuredGroup` (linha 2045): o `capturedMeasure` passa a `await rereadMeasure(g.defs, await gateOnce(...), i => gateNonce(label + suffix, i), dir, gateTask(label), label + suffix, ph)`, antes do `validMeasure`; as duas tentativas (a primeira e a `-retry`) são relidas, e `dir` vai cru (o wrapper aplica o `shq`).

Não escrever o literal do limite de cópia em `roadmap-release.js` nem em `operator.md`, nem em comentário: `copy-budget.test.mjs` exige que o número 3500 exista, fora dos testes, só em `lib/plan-digest.mjs` (o teto de caracteres da DEC-007 não é citado no código).

Não mudam: `gateFromCapture`, `captureRejection`, `capturedMeasure`, `checkCapture`, `measureTxt`, os schemas, `validMeasure`, o começo das frases de `gateWhy`, `gates.test.mjs`, `merge.test.mjs`, as leituras que já repetem sozinhas (spec e plano, `pairs`, `removed`, escritas de status), o `workflow/roadmap-release-agy.py` e os blocos embutidos.

Em `operator.md`, no fim do parágrafo da seção "Evidence folder, cleanup and resume" (linha 93), acrescentar a frase: "A capture line the workflow refuses, or a gate left out of the measure, is read back by a script-runner with `capture.mjs line --nonce <n> --task <id>` without measuring the gates again; when the read-back fails too, its reason follows `; reread: ` in the reason of that gate."

Passos:

1. Medir o tamanho do `roadmap-release.js`.
2. Teste primeiro, em `flow.test.mjs`. Ajustes no arnês:
   - em `answerRaw`, rota padrão para os rótulos `:reread-g<i>` (com ou sem `-retry<t>`), antes das rotas `/merge-gates/` e `/gates\d/`, devolvendo `{ exit: 1, stdout }` com a recusa do `line` e o nonce e a task lidos do prompt;
   - no teste `E41 B2 T2: a tests gate runs capture with --tests ...`, o padrão do `over` passa a `/^E1:gates1-2(-retry)?$/`, sem mudar nenhuma asserção.
3. Ainda em `flow.test.mjs`, depois desse teste, casos novos com `exec()`, com a resposta de releitura montada por `captureLine` a partir do nonce e da task do prompt `line` e do comando do portão no config:
   - `E43 AC2: a tampered preflight capture is read back and the baseline is accepted without a second measure`: sem `preflight:baseline-invalid`, uma só chamada `preflight`, e o comando da releitura com `--task preflight-gates` e `--cwd '/wt/_integracao'`;
   - `E43 AC2: a wrong copy on a branch gate is read back and no retry measure runs`: cópia errada em `E1:gates1-2`, nenhum rótulo `E1:gates1-2-retry`, o entregável integra, `--task E1-gates` e o `--cwd` do worktree do entregável;
   - `E43 AC2: a read-back of another nonce or cmdDigest is refused with both reasons`: no preflight, para com `preflight:baseline-invalid` e a frase traz `; reread: ` com o motivo de nonce e, no outro caso, com o de comando; no portão da branch, a medida `-retry` acontece e também é relida (rótulo `E1:gates1-2-retry:reread-g0`);
   - `E43 AC2: an omitted gate is accepted only when it needs no agent counts`: portão `exit` omitido com releitura válida entra; portão `tests` omitido com extrato de formato `unknown` continua fora, o preflight para com `preflight:baseline-invalid` (e não `preflight:red-baseline`), a frase traz `; reread: the gate needs the agent's counts` e há uma só releitura dele;
   - `E43 AC2: the read-back stops on a refusal with its nonce and otherwise tries 5 times`: recusa com o nonce do pedido dá uma chamada por portão em cada medida; recusa sem nonce e stdout que não é JSON dão 5 chamadas por portão em cada medida, as duas primeiras haiku e as três últimas sonnet, com os rótulos de `-retry2` a `-retry5`;
   - `E43 AC2: nothing is read back without a rejected capture`: caminho feliz, base gravada em `recorded`, preflight sem `baseline` em checkout alheio sem autorização e portão com `ran: false` (a resposta traz `capture` nos demais portões) não geram rótulo `:reread-`.
4. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e ver os casos novos falharem.
5. Implementar o wrapper, os dois pontos de chamada e a frase de `operator.md`; ver o arquivo de teste passar. Se outro `over` do arquivo casar um rótulo de releitura e mudar uma contagem, ajustar só o padrão do rótulo, sem tirar nem afrouxar asserção.
6. Medir o tamanho de novo e rodar os checks da tarefa, menos o G1.
7. Commit só com os arquivos da tarefa: `fix(productivity-tools): reler a linha de captura recusada antes de repetir a medida (#3)`, com a linha `paridade agy: pendente #13` no corpo do commit.
8. Com o commit feito e o worktree parado, rodar o G1.

## Fechamento

- Conferir AC1 e AC2, G1, G2 e G5 na branch; fazer o merge de `plan/pos-2-6-0-E43` em `release/pos-2.6.0` depois da conferência, com a linha `paridade agy: pendente #13` no corpo do commit de merge.
- Pronto: AC1 e AC2 verdes em `release/pos-2.6.0`; G1 na árvore do merge com exit 0, `fail 0` e `tests` e `pass` não menores que o piso; G5 verde com os 4 alvos e sem regeneração; `roadmap-release.js` dentro do teto e da trava de 284.500.
- Sem bump de versão, push, tag ou comentário em issue. O roadmap não é editado por este plano.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E43",
  "title": "Releitura da linha de captura",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E43, branch plan/pos-2-6-0-E43, criado a partir de release/pos-2.6.0 depois do merge do E51; merge em release/pos-2.6.0 depois da conferência. Todo comando e check roda com o diretório atual na raiz desse worktree.",
    "Fora dos testes, o número 3500 só existe em lib/plan-digest.mjs (copy-budget.test.mjs); não escrevê-lo em roadmap-release.js, capture.mjs nem operator.md.",
    "Autonomia só local: sem push, tag, publicação nem comentário em issue (DEC-004).",
    "Sem bump de versão em nenhum plugin; o bump é do E54 (DEC-003, DEC-042).",
    "roadmap-release.js: teto de 3.500 caracteres LF para o E43 (de 267.240 até no máximo 270.740); acima de 271.440, parar e voltar ao dono via subagente opus (DEC-007, DEC-021); trava de 284.500 mantida.",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py; todo commit que tocar roadmap-release.js, inclusive o de merge, leva a linha 'paridade agy: pendente #13' no corpo (DEC-008).",
    "G1 roda pelo Git Bash com o worktree parado, no início e no fim; linha de base no merge do E50 (857624a): exit 0, tests 2636, pass 2634, fail 0, skipped 2; o merge do E51 sobe o piso.",
    "Não medir os portões de novo para reler: a releitura só roda capture.mjs line.",
    "A linha relida só é aceita pelo capturedMeasure de hoje; gateFromCapture, captureRejection, capturedMeasure e checkCapture não mudam, e o line não aceita linha de digest errado.",
    "lib/plan-digest.mjs, scripts/fixtures/plan-tool/workflow-copy.js e embed.mjs não mudam.",
    "Não mudar o começo das frases de gateWhy nem os testes do E42 em gates.test.mjs e merge.test.mjs; não tirar nem afrouxar teste negativo (DEC-004, DEC-021).",
    "Fora do escopo: ramo de extrato do gateFromCapture e extract.format vitest (DEC-022, DEC-033) e releitura nas leituras de spec e plano, pairs, removed e escritas de status.",
    "Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "Cada commit leva só os arquivos da própria tarefa."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Subcomando line no capture.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/capture.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/capture.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "capture.mjs line --nonce <n> --task <id> [--cwd <dir>] -> exit 0 com a linha brief assinada; exit 1 com {tool:'capture', command:'line', nonce, task, error}; exit 2 em erro de uso, sem nonce"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C3"
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
          "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs",
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
      "title": "Releitura da captura recusada no workflow",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "rereadMeasure(defs, m, nonceOf, dir, task, label, ph) -> Promise<medida com gates e gateWhy>"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "capture.mjs line --nonce <n> --task <id> [--cwd <dir>] -> exit 0 com a linha brief assinada; exit 1 com {tool:'capture', command:'line', nonce, task, error}; exit 2 em erro de uso, sem nonce"
        }
      ],
      "covers": [
        "AC2",
        "C1",
        "C2",
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
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/*.test.mjs\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=270740?0:1)\"",
          "expect": "exit 0, com o número de caracteres LF impresso (no máximo 270740)"
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
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 pelo Git Bash, depois do commit e com o worktree parado; fail 0, tests e pass não menores que o piso do merge do E51 (no mínimo 2636 e 2634)"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir o trabalho em tarefas?",
      "decision": "Duas tarefas em sequência: o subcomando line com o AC1; depois o workflow, os testes de AC2 e a frase de operator.md numa tarefa só, com três arquivos.",
      "basis": "A spec manda o capture.mjs vir antes do workflow. O wrapper, os dois pontos de chamada e a rota padrão do arnês só ficam verdes juntos, e a frase de operator.md descreve esse mesmo comportamento; tudo cabe no limite de quatro arquivos.",
      "alternative": "Uma terceira tarefa só para operator.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Qual o nome do wrapper, o texto da recusa do line e o formato dos rótulos de releitura?",
      "decision": "rereadMeasure; a recusa diz no signed line with this nonce in pt-evidence/<task>; os rótulos são <label>:reread-g<i> e <label>:reread-g<i>-retry<t> nas tentativas 2 a 5, com label preflight no preflight e label mais sufixo no measuredGroup.",
      "basis": "A spec deixa os três ao plano, dá esses nomes como exemplo no design e fixa em R7 que o rótulo começa com o da medida, contém reread, o índice do portão e -retry<t>.",
      "alternative": "Um prefixo próprio reread: nos rótulos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como o wrapper tenta uma linha relida sem sujar a medida nem os motivos?",
      "decision": "Cada tentativa vale sobre uma cópia da medida de trabalho, que só é adotada quando o portão sai do gateWhy sem ser um portão omitido em fallback; stdout vazio ou agente nulo entra sem capture em string; o motivo original é o do primeiro capturedMeasure.",
      "basis": "A spec exige que o portão omitido em fallback fique fora de gates, que o motivo original seja mantido e que o stdout vazio dê no capture line; captureRejection só devolve esse texto quando capture não é string.",
      "alternative": "Trocar a medida a cada tentativa e remover o item recusado no fim.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde o E43 é executado, já que a spec cita release/pos-2.6.0 no worktree da release?",
      "decision": "Na branch plan/pos-2-6-0-E43, no worktree D:/projects/claude-play-wt/pos-2-6-0-E43, criado depois do merge do E51, com merge em release/pos-2.6.0 depois da conferência. Os critérios continuam a valer em release/pos-2.6.0.",
      "basis": "Instrução do pedido deste plano, no mesmo molde dos planos E42 e E50; há outra execução em outro worktree que integra antes.",
      "alternative": "Commitar direto no worktree de release/pos-2.6.0.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Quando o G1 é medido e contra qual piso?",
      "decision": "Antes da Tarefa 1 e depois do commit da Tarefa 2, pelo Git Bash com o worktree parado e sem outra suíte sensível a carga rodando; o piso é a contagem do merge do E51, nunca abaixo de tests 2636 e pass 2634.",
      "basis": "A spec pede a medida no início com o worktree parado; o E51 integra antes e sobe o piso informado no merge do E50 (857624a).",
      "alternative": "Medir só no fim, contra o piso do merge do E42 citado na spec.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como o teto de tamanho vale se a partida medida mudar antes da execução?",
      "decision": "O check usa 270740 sobre a partida de 267240; se a partida medida for outra, o teto é a partida mais 3500 e a parada a partida mais 4200, com a trava de 284500 inalterada.",
      "basis": "A DEC-007 dá o teto como crescimento do entregável; o E51, que integra antes, só tem arquivos de tools/ no plano.",
      "alternative": "Manter o número absoluto qualquer que seja a partida.",
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
