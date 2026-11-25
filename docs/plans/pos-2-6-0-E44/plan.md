# Plano E44 -- Extrator de testes com vitest e sem ANSI

Atende a REQ-004 (issue #3, tarefa A2 de `docs/plans/2026-11-25-correcoes-issues-plan.md`), conforme `spec.md` nesta pasta. São duas tarefas em série: primeiro o extrator (`stripAnsi` e o formato `vitest`), depois o `capture.mjs`, que importa a função nova. Todos os caminhos são relativos à raiz do repositório, no branch `release/pos-2.6.0`.

## Efeito nos consumidores (sem editá-los)

Os dois workflows leem o `extract` da linha do `capture.mjs`. O E44 não edita nenhum deles.

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, `gateFromCapture` (linha 199): só usa o extrato quando `failedNames` é um array. Com `null`, o portão vitest segue o caminho `fallback` de hoje, com total e nomes vindos do agente (DEC-022). Usar o total do vitest é do E43, e a pendência já está em `docs/plans/roadmap-pos-2-6-0/state.md`.
- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`, perto das linhas 1184-1208: `waveGateOf` e `capNames` (usado por `baselineEvent`) já tratam `failedNames: null` como `[]`, e o evento `baseline` continua recebendo uma lista, como `lib/progress-state.mjs` exige. `baselineProblem` lê `total` e `pass`: no vitest eles deixam de ser `null`, então uma base vitest com 0 testes ou 0 aprovados passa a ser recusada, pela mesma regra que já vale para o `node:test`.

## Tarefas

### Tarefa 1: Extrator tira o ANSI e reconhece o resumo do vitest

Arquivos: `plugins/productivity-tools/scripts/test-extract.mjs` e `plugins/productivity-tools/scripts/test-extract.test.mjs`.

Passo 1, testes primeiro. Importar também `stripAnsi` de `./test-extract.mjs`. Pôr os testes novos entre o teste `C3: texto que nao e node:test` e o teste `CLI imprime o JSON`. As fixtures são texto literal dentro do arquivo de teste (nada de instalar o vitest); os bytes de escape são escritos como `\x1b` no código-fonte, nunca como byte cru.

- `E44 stripAnsi: remove SGR e outras sequencias CSI`: um texto com SGR e com movimento de cursor (por exemplo `\x1b[2K` e `\x1b[1G`) sai só com o texto visível, com as quebras de linha preservadas.
- `E44 AC1: resumo do vitest 4 sem cor informa total 97`: as linhas `Test Files  2 passed (2)` e `Tests  97 passed (97)` com exit 0 dão exatamente `{ format: 'vitest', exit: 0, total: 97, pass: 97, fail: 0, skipped: 0, failedNames: null }`.
- `E44 C1: partes failed, passed, skipped e todo`: `Tests  1 failed | 2 passed | 1 skipped | 1 todo (5)` com exit 1 dá `total` 5, `pass` 2, `fail` 1, `skipped` 1 e `failedNames` `null`. Incluir uma variante com a parte `1 expected fail`, que não entra em campo nenhum (em especial, não soma em `fail`).
- `E44 C2: saida colorida da o mesmo extrato do texto sem cor`: as linhas dos dois testes anteriores em SGR, como o vitest 4.1.12 imprime (título em `\x1b[2m`, contagens em negrito e cor, separador ` | ` em `\x1b[2m`, total em `\x1b[90m`), comparadas por `deepEqual` com o extrato do texto sem cor. No mesmo teste, uma saída `node-spec` com as marcas `✔`, `✖` e `ℹ` coloridas dá formato `node-spec` e os mesmos `failedNames` do texto sem cor.
- `E44 C3: so a linha Test Files nao reconhece o formato`: texto com `Test Files  2 passed (2)` e sem a linha `Tests` dá `format` `unknown` e `total` `null`.
- `E44 allTestNames: saida colorida lista os nomes; vitest devolve lista vazia`: uma saída `node-spec` colorida devolve os nomes dos testes; o resumo do vitest, com e sem cor, devolve `[]`.

Rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs` e ver os testes novos falharem.

Passo 2, implementação em `test-extract.mjs`.

- Exportar `stripAnsi(text)`, que remove toda sequência CSI com a expressão `/\x1b\[[0-?]*[ -\/]*[@-~]/g` (R3 da spec).
- `extractTests` e `allTestNames` aplicam `stripAnsi` ao texto antes do `split` (R5 da spec). A assinatura das duas não muda, e o subcomando `removed` não ganha outra alteração.
- Ordem de detecção: `node-tap`, `node-spec`, `vitest`. O vitest é reconhecido pela linha `^\s*Tests\s+(.+?)\s+\((\d+)\)\s*$` (R7 da spec).
- Campos do vitest (DEC-023): `total` é o número entre parênteses; as partes separadas por `|` no formato `N passed`, `N failed` e `N skipped` dão `pass`, `fail` e `skipped`; parte ausente vale 0; `todo` e `expected fail` não entram.
- Retorno do vitest: `{ format: 'vitest', exit, total, pass, fail, skipped, failedNames: null }` (DEC-022). Nunca `[]`. O formato `unknown` continua com `failedNames: []`.
- O arquivo continua sem import estático de `lib/` (comentário da linha 7).
- Trocar o comentário da linha 2 por um que diga: extrator determinístico da saída do `node:test` (TAP e spec) e do resumo do vitest, com o ANSI removido antes de decidir o formato; puro, o exit vem de quem chama; no vitest `failedNames` é `null` porque os nomes não são lidos. Manter o estilo sem acentos do arquivo.

Passo 3. Rodar o mesmo comando e ver passar, incluindo os testes antigos. Commit: `feat(productivity-tools): extrator tira ANSI e reconhece o resumo do vitest`.

### Tarefa 2: capture.mjs roda sem cor e entrega cauda e extrato sem ANSI

Arquivos: `plugins/productivity-tools/scripts/capture.mjs` e `plugins/productivity-tools/scripts/capture.test.mjs`. Depende da tarefa 1 (`stripAnsi` e o extrato `vitest`).

Passo 1, testes primeiro, acrescentados ao fim de `capture.test.mjs` com os auxiliares que o arquivo já tem (`withRepo`, `runCli`, `runCapture`, `cleanEnv`, `sha256Of`, `countLines`, `checkCapture`).

- `E44 AC2: tail sem ANSI e stdout.txt intacto`: um programa Node gravado no repositório temporário escreve linhas com SGR (`\x1b[32m✔ ok\x1b[39m`). Conferir: `tail` sem `\x1b` e com o texto visível; o arquivo em `o.path` contém os bytes de escape; o sha256 desse arquivo é igual a `o.sha256` e ao do stdout da execução direta; `o.bytes` e `o.lines` são os do stdout bruto; `checkCapture` aceita a linha.
- `E44 C5: o filho recebe NO_COLOR=1 e FORCE_COLOR=0`: chamar `runCapture` com `env` igual a `cleanEnv()` mais `FORCE_COLOR: '1'`, num programa que imprime `process.env.NO_COLOR` e `process.env.FORCE_COLOR`; a cauda é `1 0`.
- `E44 C4: portao vitest vermelho com --tests, com e sem --brief`: um programa escreve o resumo `Tests  1 failed | 2 passed | 1 skipped | 1 todo (5)` em SGR e sai 1. Nas duas formas: exit 1; `extract` igual a `{ format: 'vitest', exit: 1, total: 5, pass: 2, fail: 1, skipped: 1, failedNames: null, failedNamesCut: 0 }`; `bytes`, `sha256` e `lines` iguais aos do stdout bruto; `checkCapture` aceita. Sem `--brief`, `tail` sem `\x1b`; com `--brief`, sem a chave `tail`.

Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e ver os três testes novos falharem. No `C4`, só a asserção da cauda sem ANSI falha: as do extrato já passam depois da tarefa 1, porque o extrator limpa o próprio texto e a linha curta não aciona o corte.

Passo 2, implementação em `capture.mjs`.

- Importar `stripAnsi` junto de `extractTests`, de `./test-extract.mjs` (R4 da spec).
- Em `runCapture`, o `spawnSync` do comando recebe `{ ...env, NO_COLOR: '1', FORCE_COLOR: '0' }`, sempre, sem opção para desligar (R6 da spec). `findBash` continua lendo o `env` original.
- `saveEvidence` grava `stdout` e `stderr` brutos, como hoje. `bytes`, `sha256`, `lines`, `stderrBytes` e `stderrSha256` continuam medidos nos buffers brutos. `cmdDigest` não muda.
- A chamada a `buildLine` passa a receber `stripAnsi(stdout.toString('utf8'))`, de modo que `tail` e `extract` saem limpos antes do `sign`.
- Em `buildLine`, o corte de `failedNames` só roda quando `Array.isArray(extract.failedNames)`. `failedNamesCut` continua 0 no vitest. Essa guarda protege o caso em que a linha sem cauda não cabe em `SLICE_BYTES`, que a linha de comando não alcança com caminhos comuns; ela é conferida na revisão, não por teste.
- Atualizar o cabeçalho (linhas 2 a 5): o extrato passa a ser do `node:test` ou do vitest; o comando roda com `NO_COLOR=1` e `FORCE_COLOR=0`; cauda e extrato saem sem ANSI; `stdout.txt`, `stderr.txt`, `bytes`, `sha256` e `lines` são os bytes brutos. Manter o estilo sem acentos.

Passo 3, verificação pelo Git Bash (o pwsh puro não serve de base até o E50): o teste do arquivo; depois `node --test "plugins/**/*.test.mjs"` inteiro, porque `flow.test.mjs` e `load-slices.test.mjs` usam o extrator; o lint e o `claude plugin validate` do plugin. Commit: `feat(productivity-tools): capture roda sem cor e limpa ANSI da cauda e do extrato`.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E44",
  "title": "Extrator de testes com vitest e sem ANSI",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Não tirar ANSI do stdout.txt nem do stderr.txt, e não recalcular bytes, sha256 ou lines sobre o texto limpo: os três são medidos nos bytes brutos.",
    "No formato vitest, failedNames é null, nunca [] (DEC-022).",
    "O resumo do vitest usa as chaves existentes total, pass, fail e skipped (DEC-023).",
    "Não mudar cmdDigest: o ambiente não entra em commandDigest.",
    "Não editar roadmap-release.js nem coordinator.js; usar o total do vitest no workflow é do E43.",
    "Não editar os subcomandos slice, pairs, prune e list do capture.mjs; o modo removed do test-extract.mjs só ganha a limpeza de ANSI de allTestNames.",
    "Não instalar o vitest no repositório: as fixtures são texto literal dentro dos testes.",
    "Sem bump de versão (DEC-003); autonomia só local, sem push, tag ou publicação (DEC-004).",
    "capture.mjs e test-extract.mjs são arquivos quentes: o E43 e o E47 vêm depois do E44.",
    "Não editar a pasta do roadmap nas tarefas deste plano.",
    "Cada tarefa termina com os testes dela passando."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Extrator tira o ANSI e reconhece o resumo do vitest",
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
        "stripAnsi(text) -> string",
        "extractTests(text, exit) -> { format, exit, total, pass, fail, skipped, failedNames }"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C1",
        "C2",
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
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 2,
      "title": "capture.mjs roda sem cor e entrega cauda e extrato sem ANSI",
      "deps": [
        1
      ],
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
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "stripAnsi(text) -> string"
        },
        {
          "task": 1,
          "sig": "extractTests(text, exit) -> { format, exit, total, pass, fail, skipped, failedNames }"
        }
      ],
      "covers": [
        "AC2",
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
          "cmd": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir o E44 em tarefas?",
      "decision": "Duas tarefas em série, uma por script com o seu arquivo de teste: o extrator primeiro, o capture.mjs depois.",
      "basis": "O capture.mjs importa stripAnsi do test-extract.mjs (R4 da spec), e cada critério de aceite tem o seu arquivo de teste.",
      "alternative": "Uma tarefa única com os quatro arquivos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Quando rodar a suíte dos plugins, que a spec deixou para o plano?",
      "decision": "Como check da tarefa 2, pelo Git Bash, com o comando da spec; o esperado é exit 0. A autoria do plano não rodou suíte.",
      "basis": "Seção Deixado para o plano da spec. A linha de base completa está na spec do E42 (G1, medida pelo Git Bash). A nota do chamador de não rodar a suíte vale para a autoria do plano.",
      "alternative": "Rodar a suíte depois de cada tarefa, ou deixar só para o portão da branch.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O que fazer com o coordinator.js, que também lê o extrato da captura?",
      "decision": "Não editar. waveGateOf e capNames já tratam failedNames null como lista vazia. Aceitar que baselineProblem passe a recusar uma base vitest com 0 testes ou 0 aprovados, porque total e pass deixam de ser null.",
      "basis": "coordinator.js, perto das linhas 1184-1208; observação da aprovação da spec; é a mesma regra que o node:test já segue.",
      "alternative": "Editar baselineProblem para ignorar o formato vitest.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "O plano precisa de uma tarefa para registrar a pendência do E43?",
      "decision": "Não. A pendência de usar o format vitest no gateFromCapture já está no tracker.",
      "basis": "docs/plans/roadmap-pos-2-6-0/state.md, bloco de pendências, linha do E43 (DEC-022).",
      "alternative": "Uma tarefa de documentação que edita a pasta do roadmap.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como cobrir a guarda Array.isArray do corte de failedNames em buildLine?",
      "decision": "O teste C4 cobre o portão vitest pela linha de comando; o ramo em que a linha sem cauda não cabe em SLICE_BYTES é conferido na revisão, sem exportar buildLine.",
      "basis": "Com failedNames null a linha só deixaria de caber com caminhos muito maiores que os comuns, e exportar buildLine ampliaria a superfície do script só para o teste.",
      "alternative": "Exportar buildLine e testar o ramo com um base artificialmente grande.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
