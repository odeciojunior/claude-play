# Plano E42 -- Medida de base válida e com motivo por portão

Spec: `docs/plans/pos-2-6-0-E42/spec.md`. Branch `release/pos-2.6.0`, no worktree `D:/projects/claude-play-wt/pos-2-6-0`. Todos os caminhos abaixo são relativos à raiz do repositório.

As quatro tarefas correm em sequência: a trava de tamanho entra primeiro, depois o texto da medida (AC1), depois `expected` e `got` na lib e, por último, o motivo por portão (AC2). As tarefas 2, 3 e 4 tocam `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`.

## Medida de tamanho

Antes de começar e depois de terminar cada tarefa que toca o `roadmap-release.js` (2, 3 e 4), medir os caracteres LF e informar os dois números no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=269001?0:1)"
```

O ponto de partida é 266.001. O teto do E42 neste arquivo é de 3.000 caracteres, somadas as tarefas (no máximo 269.001, DEC-007). Acima de 269.601 (teto mais 20%), parar e voltar ao dono via subagente opus (DEC-007, DEC-021). O crescimento previsto fica na casa de 1.000 a 1.500 caracteres.

## Tarefas

### Tarefa 1: Trava de tamanho em 284.500 caracteres LF

Em `plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs` (linhas 119-123), trocar o limite de 266673 por 284500. O nome do teste passa a ser `roadmap-release.js stays within the size budget of 284500 LF characters (DEC-007 of the pos-2.6.0 roadmap, succeeds DEC-057 of pos-2.3.0)`, e a mensagem da asserção cita DEC-007 do roadmap pós-2.6.0 com o número novo. `size.test.mjs` não muda: o teto de 300.000 e a folga acima de 10.000 continuam valendo.

É uma troca de nome, não uma remoção de teste: não entra em `removedTests`.

Rodar os dois testes da trava, ver passar e commitar só o arquivo da tarefa.

### Tarefa 2: Captura exigida nos portões exit, com --brief

Teste primeiro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, no teste "E41 B2 T2" do portão com espaço no nome (por volta das linhas 311-337): conferir que cada linha de captura traz `--brief` entre `--cwd` e `--bash`, que a frase `(no test counts; the capture line is still required, copied literally)` aparece na linha do portão `exit` e que `only name, ran and exit matter` não aparece. O `CAP_LINE` (linha 184) não muda. Rodar e relatar a falha.
- `plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs`: novo teste `E42 AC1: an exit gate with a real --brief capture enters the measure and is not reported missing`. O helper `realCapture` ganha uma opção para passar `--brief` ao `capture.mjs` (sem mudar os usos atuais). O portão `exit` com a captura real passa por `capturedMeasure`, aparece em `gates`, `validMeasure` é verdadeiro e `measureProblems` volta vazio (importar `measureProblems` do `loadPure`). Este caso caracteriza o comportamento que o script já tem e pode passar antes da mudança; a falha exigida pelo teste primeiro vem do `flow.test.mjs`.

Implementação em `roadmap-release.js`, só em `measureTxt` (linhas 1959-1960):

- o sufixo `' (only name, ran and exit matter)'` dos portões que não são `tests` passa a ser `' (no test counts; the capture line is still required, copied literally)'`;
- a linha de comando de cada portão ganha ` --brief` entre `--cwd ${dir}` e `--bash`.

`measureTxt` serve o preflight e o `gateOnce`, então a mudança vale para toda medida, inclusive a posterior ao `gates-fix`. O prompt do `gates-fix` e o prompt de tarefa não mudam; ajustar `prompts.test.mjs` só se algum caso quebrar.

Medir o tamanho antes e depois. Commitar só os arquivos da tarefa, com a linha `paridade agy: pendente #13` no corpo do commit; o `.py` não é tocado.

### Tarefa 3: expected e got no checkCapture

A tarefa passa de quatro arquivos porque os três alvos gerados têm de mudar no mesmo commit que a lib, senão o `embed.mjs --check` fica vermelho entre tarefas.

Teste primeiro, em `plugins/productivity-tools/scripts/capture.test.mjs`: novo teste `E42 checkCapture: a wrong nonce and a wrong cmdDigest return expected and got`. Sobre uma captura real, conferir que o nonce errado devolve `expected` igual ao nonce pedido e `got` igual ao da linha, e que o cmdDigest errado devolve o par correspondente, com o `why` de cada caso igual ao de hoje. Rodar e relatar a falha.

Implementação em `plugins/productivity-tools/lib/plan-digest.mjs` (`checkCapture`, linhas 251-264), só aditiva: o retorno da comparação de nonce ganha `expected: nonce, got: o.nonce`; o da comparação de cmdDigest ganha `expected: cmdDigest, got: o.cmdDigest`. Os demais retornos ficam iguais.

Regenerar os três alvos que embutem a lib, nunca à mão:

```
node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js
```

Depois, `embed.mjs --check` com os quatro alvos (os três acima mais `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`, que não embute a lib e não muda). O `coordinator.js` tem hoje 88.499 caracteres LF (88.704 bytes em LF) e a trava é de 90.000 (`plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs:837`): conferir que continua abaixo nas duas medidas.

Medir o tamanho do `roadmap-release.js` antes e depois. Commitar só os arquivos da tarefa, com a linha `paridade agy: pendente #13` no corpo do commit.

### Tarefa 4: Motivo por portão no baseline-invalid

Teste primeiro:

- `gates.test.mjs`, ao lado do teste negativo das linhas 221-239, sem alterar os testes que esperam `null`:
  - `E42 AC2: wrong nonce, foreign command and tampered digest give a specific reason per gate`: via `capturedMeasure` e `measureProblems`, cada captura rejeitada dá o seu motivo; no comando trocado, a mensagem mostra o cmdDigest esperado e o recebido; com `path` na linha, o caminho aparece. O mesmo teste cobre: portão sem o campo `capture` (motivo `no capture line`); captura que não é JSON ou não vem do capture (só o `why`, sem `expected`, `got` nem `path`); captura que confere com `exit` não inteiro (`the capture exit is not an integer`); portão com `ran: false` (entra como hoje e não ganha motivo).
  - `E42 parity: captureRejection gives a reason only when gateFromCapture returns null`: sobre uma matriz de entradas (portão ausente; sem `capture`; `capture` que não é string; `ran: false`; não JSON; JSON de outra ferramenta; recusa do capture; saída acima do limite de cópia; nonce errado; cmdDigest errado; digest adulterado; `exit` não inteiro; captura boa de portão `exit`; captura boa de portão `tests`; formato `unknown`), afirmar em cada uma que `captureRejection` devolve texto se e somente se `gateFromCapture` devolve `null`.
- `merge.test.mjs`, ao lado do teste da linha 28: `E42 measureProblems appends the gateWhy reason to the missing gate and keeps the old sentence without it`. Com `gateWhy`, cada portão ausente sai como `gate X missing from the measure: <motivo>`; sem `gateWhy` (base gravada pelo run-record), a frase é exatamente a de hoje.

Rodar e relatar a falha.

Implementação em `roadmap-release.js`:

- função pura nova, de nível superior dentro do bloco `// <pure>`, junto de `gateFromCapture`: `captureRejection(g, expect) -> string | null`. Repete a checagem sobre o mesmo dado: `ran: false` dá `null`; sem captura em string dá `no capture line`; `checkCapture` falhou dá o `why`, mais `, expected <e>, got <g>` quando houver, mais `, path <p>` quando a linha for JSON do capture (`tool` igual a `capture`) com `path` em string; `exit` não inteiro dá `the capture exit is not an integer`; caso contrário, `null`;
- `capturedMeasure` (linhas 204-207) passa a montar `gateWhy`, um objeto nome do portão para motivo, fora de `gates`, para cada portão cujo `gateFromCapture` devolveu `null`; o campo é sempre gravado pelo script (vazio quando nada foi rejeitado), por cima do que vier do agente; medida nula continua voltando como veio;
- `measureProblems` (linhas 664-676) anexa `: <motivo>` à frase `gate X missing from the measure` quando `m.gateWhy` tiver o nome do portão.

Não mudam: o retorno de `gateFromCapture`, o schema `S_MEASURE`, `validMeasure`, o consumo em `preflight:baseline-invalid`, `measuredGroup` e a mensagem de `gates()`.

Fechamento do entregável:

- medir o tamanho antes e depois;
- rodar todos os testes da pasta do workflow e o `embed.mjs --check` com os quatro alvos (G5);
- commitar só os arquivos da tarefa, com a linha `paridade agy: pendente #13` no corpo do commit;
- depois do commit, rodar o G1 pelo Git Bash (se E44 ou E50 já estiverem no branch, refazer o piso de `tests`/`pass` com a linha de base remedida após esses merges), com o worktree parado (nenhum commit durante a execução, de nenhuma sessão): exit 0, `fail 0`, `tests` maior ou igual a 2616 e `pass` maior ou igual a 2614. O pwsh puro falha até o E50 e não serve de base. Se o HEAD mudar durante a execução, repetir com o HEAD estável.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E42",
  "title": "Medida de base válida e com motivo por portão",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0, branch release/pos-2.6.0; autonomia só local: sem push, tag nem publicação (DEC-004).",
    "Sem bump de versão em plugin.json, README.md ou na linha 1 do check-roadmap.mjs; o bump é só no E54 (DEC-003, DEC-042).",
    "roadmap-release.js: trava de 284.500 caracteres LF e teto de 3.000 caracteres para o E42 (de 266.001 até no máximo 269.001); acima de 269.601, parar e voltar ao dono via subagente opus (DEC-007, DEC-021).",
    "coordinator.js continua abaixo da trava de 90.000 (hoje 88.499 caracteres LF, 88.704 bytes em LF).",
    "Não mudar o valor de retorno de gateFromCapture nem os testes negativos que esperam null; tirar ou afrouxar teste negativo volta ao dono via subagente opus (DEC-004, DEC-021).",
    "A fixture scripts/fixtures/plan-tool/workflow-copy.js e os blocos embutidos mudam só pela regeneração do embed.mjs.",
    "Não pôr --brief depois de --bash.",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py (DEC-008).",
    "Fora do escopo: releitura da linha de captura copiada errada (E43), leitura da linha por arquivo, extrator do vitest e de ANSI (E44), prompt do gates-fix, mensagem de medida nula do pós-merge e acúmulo de motivo em measuredGroup.",
    "G1 roda pelo Git Bash com o worktree parado; linha de base: exit 0, tests 2616, pass 2614, fail 0, skipped 2."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Trava de tamanho em 284.500 caracteres LF",
      "deps": [],
      "files": {
        "create": [],
        "modify": [],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "trava de tamanho do roadmap-release.js em 284500 caracteres LF"
      ],
      "consumes": [],
      "covers": [
        "AC3"
      ],
      "testFirst": {
        "exempt": "a mudança é o próprio limite do teste da trava; não há comportamento de produção para ver falhar"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 2,
      "title": "Captura exigida nos portões exit, com --brief",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "linha de medida: capture.mjs run --nonce <n> --task <id> [--tests] --cwd <dir> --brief --bash <cmd>"
      ],
      "consumes": [],
      "covers": [
        "AC1"
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
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=269001?0:1)\"",
          "expect": "exit 0, com o número de caracteres LF impresso (no máximo 269001)"
        }
      ]
    },
    {
      "n": 3,
      "title": "expected e got no checkCapture",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/lib/plan-digest.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js",
          "plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js"
        ],
        "test": [
          "plugins/productivity-tools/scripts/capture.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "checkCapture(stdout, { nonce, noncePrefix, cmdDigest }) -> { ok: false, why, expected, got } nas falhas de nonce e de cmdDigest"
      ],
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
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const s=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').split(String.fromCharCode(13)).join('');console.log(s.length,Buffer.byteLength(s));process.exit(Buffer.byteLength(s)<=90000?0:1)\"",
          "expect": "exit 0, com caracteres e bytes em LF impressos (no máximo 90000)"
        },
        {
          "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=269001?0:1)\"",
          "expect": "exit 0, com o número de caracteres LF impresso (no máximo 269001)"
        }
      ]
    },
    {
      "n": 4,
      "title": "Motivo por portão no baseline-invalid",
      "deps": [
        2,
        3
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "captureRejection(g, expect) -> string | null",
        "capturedMeasure(defs, m, nonceOf) -> { ...m, gates, gateWhy }"
      ],
      "consumes": [
        {
          "task": 3,
          "sig": "checkCapture(stdout, { nonce, noncePrefix, cmdDigest }) -> { ok: false, why, expected, got } nas falhas de nonce e de cmdDigest"
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
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/*.test.mjs\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13)).join('').length;console.log(n);process.exit(n<=269001?0:1)\"",
          "expect": "exit 0, com o número de caracteres LF impresso (no máximo 269001)"
        },
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 pelo Git Bash com o worktree parado; fail 0, tests >= 2616, pass >= 2614"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir e ordenar o trabalho?",
      "decision": "Quatro tarefas em sequência: trava de tamanho, texto da medida, expected e got na lib, motivo por portão.",
      "basis": "A spec exige a trava antes ou junto da primeira tarefa que passe de 266.673; cada tarefa seguinte tem teste próprio, e três delas tocam o roadmap-release.js, então não correm em paralelo.",
      "alternative": "Uma tarefa única, ou a trava junto da tarefa do texto da medida.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Qual o nome da função pura do motivo e o texto do motivo sem captura?",
      "decision": "captureRejection(g, expect), que devolve null quando não há rejeição; o texto sem captura é no capture line, também quando o agente omite o portão inteiro.",
      "basis": "A spec deixa o nome e o texto ao plano e dá no capture line no design; a assinatura espelha a de gateFromCapture, e o motivo não depende da definição do portão.",
      "alternative": "captureWhy(def, g, expect), com um texto separado para o portão omitido.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quando o motivo leva o path da linha?",
      "decision": "Só na falha de checkCapture e quando a linha é um objeto JSON com tool igual a capture e path em string.",
      "basis": "O design pede path quando a linha for JSON com path, e o caso de borda C2 pede que a captura que não vem do capture saia sem path; a condição sobre tool atende os dois.",
      "alternative": "Anexar o path de qualquer JSON que o tenha.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "gateWhy é gravado só quando há rejeição ou em toda medida?",
      "decision": "Em toda medida não nula, vazio quando nada foi rejeitado, por cima de qualquer campo de mesmo nome vindo do agente.",
      "basis": "A decisão R4 da spec diz que capturedMeasure grava gateWhy em toda medida, e o schema S_MEASURE não barra um campo extra do agente.",
      "alternative": "Omitir o campo quando não há rejeição.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Que alcance tem o teste de paridade pedido na aprovação da spec?",
      "decision": "Bicondicional sobre uma matriz de entradas: há motivo se e somente se gateFromCapture devolve null.",
      "basis": "A observação pede prova de que há motivo só quando gateFromCapture devolve null; a volta garante também que nenhum portão rejeitado fica sem motivo, já que a função repete a checagem em separado.",
      "alternative": "Provar só a implicação de motivo para null.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O teste da trava renomeado entra em removedTests?",
      "decision": "Não.",
      "basis": "O teste continua existindo com o limite novo e a contagem não cai; a revisão do workflow trata como defeito um teste declarado removido que só foi renomeado.",
      "alternative": "Declarar o nome antigo como removido.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Onde registrar o item de paridade agy?",
      "decision": "Na constraint do plano e no corpo do commit de cada tarefa que toca o roadmap-release.js: paridade agy: pendente #13.",
      "basis": "A DEC-008 pede o item de checklist em todo entregável que toca o arquivo, e o plano só escreve no código, não no roadmap.",
      "alternative": "Registrar só no log do roadmap, pelo tracker.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "A trava do coordinator.js se mede em caracteres ou em bytes?",
      "decision": "Conferir os bytes em LF contra 90.000, o que implica os caracteres LF do teste.",
      "basis": "O teste de flow.test.mjs:837 mede caracteres LF (88.499 hoje) e a observação da aprovação cita 88.704, que são os bytes em LF; a medida em bytes é a mais estrita e a mudança de menos de 100 caracteres cabe nas duas.",
      "alternative": "Conferir só o teste existente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Dividir a tarefa do checkCapture, que passa de quatro arquivos?",
      "decision": "Não: a lib, os três alvos gerados e o teste ficam numa tarefa só.",
      "basis": "Três dos cinco arquivos mudam só pela regeneração do embed.mjs, e separá-los da lib deixaria o embed.mjs --check vermelho entre dois commits.",
      "alternative": "Uma tarefa para a lib e o teste e outra para a regeneração.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
