# Spec E44 -- Extrator de testes com vitest e sem ANSI

## Intenção

O E44 atende a REQ-004 (issue #3, tarefa A2 de `docs/plans/2026-11-25-correcoes-issues-plan.md`). Hoje a saída colorida de um portão de testes chega ao extrator e à cauda da linha assinada com códigos ANSI. Com isso o resumo do vitest 4 cai em `format: "unknown"` e a cauda fica com bytes de escape que o agente erra ao copiar. O entregável faz duas coisas: o extrator tira o ANSI antes de decidir o formato e passa a reconhecer o resumo do vitest 4; o `capture.mjs` roda o comando sem cor e tira o ANSI só da cauda e do texto que vai ao extrator. O `stdout.txt` gravado continua byte a byte igual à saída do comando, porque é a evidência conferida pelo sha256 (risco do card).

## Escopo

Dentro:

- `plugins/productivity-tools/scripts/test-extract.mjs`: função exportada `stripAnsi`, aplicada em `extractTests` e em `allTestNames`, e o formato `vitest`.
- `plugins/productivity-tools/scripts/capture.mjs`: ambiente do processo filho com `NO_COLOR=1` e `FORCE_COLOR=0`; cauda e extrato calculados sobre o texto sem ANSI.
- Testes em `plugins/productivity-tools/scripts/test-extract.test.mjs` e `plugins/productivity-tools/scripts/capture.test.mjs`.
- Comentários de cabeçalho dos dois scripts, para descrever o comportamento novo.

Fora:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`. Pela resposta Q3 do dono, o E44 não toca o workflow. Se o workflow precisar mudar para usar o total do vitest, a mudança fica como pendência do E43.
- Nomes de testes que falham no vitest. Pela resposta Q2 do dono, o extrator não os lê e os nomes continuam vindo do agente.
- Instalar o vitest no repositório. Pela resposta Q1 do dono, as fixtures são texto literal dentro dos testes.
- Os outros subcomandos do `capture.mjs` (`slice`, `pairs`, `prune`, `list`) e o modo `removed` do `test-extract.mjs`. Esse modo só ganha a limpeza de ANSI que `allTestNames` já recebe.

O que não fazer:

- Não tirar ANSI do `stdout.txt` nem do `stderr.txt`. Também não recalcular `bytes`, `sha256` ou `lines` sobre o texto limpo: os três continuam medidos nos bytes brutos.
- Não devolver `failedNames: []` no formato vitest. O workflow tomaria a lista vazia como verdade e perderia as falhas (R1).
- Não mudar `cmdDigest`. O ambiente não entra em `commandDigest`.

## Design

**AC1 (extrator com vitest 4, com e sem cor).** Em `test-extract.mjs`, uma função exportada `stripAnsi(text)` remove sequências CSI (`/\x1b\[[0-?]*[ -\/]*[@-~]/g`), um conjunto que inclui as sequências SGR citadas na A2 (R3). `extractTests` e `allTestNames` aplicam essa função ao texto antes do `split`. A ordem de detecção fica `node-tap`, depois `node-spec` (as duas também passam a funcionar com saída colorida) e por último `vitest`. A detecção do vitest procura a linha de resumo de testes, `^\s*Tests\s+(.+?)\s+\((\d+)\)\s*$`. A linha `Test Files` não casa com essa expressão (R7). Os campos saem assim: `total` é o número entre parênteses; `pass`, `fail` e `skipped` vêm das partes `N passed`, `N failed` e `N skipped` separadas por `|`, e uma parte ausente conta 0; `todo` e `expected fail` não entram em nenhum campo (R2). O resultado é `{format: "vitest", exit, total, pass, fail, skipped, failedNames: null}` (R1). Para o vitest, `allTestNames` continua devolvendo `[]`. As fixtures de `test-extract.test.mjs` são texto literal e partem das linhas da #3 (`Test Files  2 passed (2)` e `Tests  97 passed (97)`, total 97). Há variantes com `1 failed | 2 passed | 1 skipped | 1 todo (5)` e uma versão colorida das mesmas linhas em SGR, no formato que o vitest 4.1.12 imprime: título em `\x1b[2m`, contagens em negrito e cor, separador ` | ` em `\x1b[2m` e total em `\x1b[90m`. O formato foi conferido com o vitest 4.1.12 real numa pasta temporária fora do repositório, com e sem cor, e o texto de `getStateString` foi lido no código do pacote. ASSUMPTION: as versões 4.0.x imprimem o mesmo resumo. Os testes também cobrem uma saída `node-spec` colorida, que agora sai com o formato e os nomes certos.

**AC2 (cauda sem ANSI, `stdout.txt` intacto).** Em `capture.mjs`, `runCapture` passa ao `spawnSync` o ambiente `{ ...env, NO_COLOR: '1', FORCE_COLOR: '0' }`. O valor sobrescreve o que vier do chamador (R6), e `PT_BASH` continua sendo lido do `env` original. `saveEvidence` grava o `stdout` bruto como hoje. `base` (bytes, sha256, linhas) continua calculado sobre o buffer bruto. A chamada a `buildLine` passa a receber `stripAnsi(stdout.toString('utf8'))`, importado de `./test-extract.mjs` (R4). Assim `tail` e `extract` saem limpos antes do `sign`. Em `buildLine`, o corte de `failedNames` só roda quando `Array.isArray(extract.failedNames)`, porque o vitest traz `null`. O teste em `capture.test.mjs` roda um programa Node que escreve linhas com SGR (`\x1b[32m✔ ok\x1b[39m`) e confere quatro pontos: o `tail` não tem `\x1b`; o arquivo em `o.path` contém os bytes de escape; o sha256 desse arquivo é igual a `o.sha256` e ao da execução direta; `checkCapture` aceita a linha. Um segundo teste imprime `process.env.NO_COLOR` e `process.env.FORCE_COLOR` com o chamador definindo `FORCE_COLOR=1` e espera `1 0` na cauda.

Efeito no workflow, sem editá-lo: `gateFromCapture` em `roadmap-release.js:199` só usa o extrato quando `failedNames` é um array. Com `null`, um portão vitest segue pelo caminho `fallback` de hoje, com total e nomes vindos do agente. O comportamento do workflow fica igual ao atual, e usar o total do vitest no workflow fica para o E43 (Q3).

## Deixado para o plano

- Nomes exatos dos testes novos e a posição deles nos dois arquivos de teste.
- O texto dos comentários de cabeçalho (`test-extract.mjs:2` e `capture.mjs:2-5`).
- Registrar no E43 a pendência de usar o `extract.format: "vitest"` no `gateFromCapture` (Q3).
- Rodar `node --test "plugins/**/*.test.mjs"` inteiro, porque `flow.test.mjs` e `load-slices.test.mjs` importam o extrator.

```json data
{
  "schema": "spec/1",
  "id": "E44",
  "title": "Extrator de testes com vitest e sem ANSI",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada a saída do vitest 4 com e sem cor, quando o extrator a lê, então informa o total de testes e o formato vitest. {verify: test; evidence: node --test plugins/productivity-tools/scripts/test-extract.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma saída colorida, quando o capture.mjs grava a linha, então o tail sai sem ANSI e o stdout.txt gravado continua intacto. {verify: test; evidence: node --test plugins/productivity-tools/scripts/capture.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Qual valor de failedNames o extrator devolve no formato vitest, já que não lê nomes (Q2)?",
      "decision": "failedNames: null. O gateFromCapture do workflow só usa o extrato quando failedNames é array; com null o portão segue o caminho fallback de hoje, com nomes e total do agente, sem editar o workflow (Q3).",
      "basis": "roadmap-release.js:199 exige Array.isArray(e.failedNames). Com [] um portão vitest vermelho chegaria ao workflow sem falhas nomeadas. Respostas Q2 e Q3 do dono.",
      "alternative": "failedNames: [] (o workflow perderia as falhas de um portão vitest vermelho).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como mapear o resumo do vitest para os campos do extrato?",
      "decision": "Usar as chaves que já existem: total é o número entre parênteses da linha Tests; pass, fail e skipped vêm de N passed, N failed e N skipped; uma parte ausente conta 0; todo e expected fail não entram em nenhum campo.",
      "basis": "O consumidor (gateFromCapture) lê total, skipped e failedNames. O node:test também não soma todo a skipped. As palavras passed e failed da resposta Q2 viram as chaves pass e fail que já existem.",
      "alternative": "Somar todo e expected fail a skipped, ou criar chaves passed e failed só para o vitest.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Qual expressão remove o ANSI?",
      "decision": "Toda sequência CSI, /\\x1b\\[[0-?]*[ -\\/]*[@-~]/g, que inclui o SGR.",
      "basis": "Cobre o SGR citado na A2 e também movimentos de cursor de ferramentas que desenham na tela. O custo é o mesmo.",
      "alternative": "Só SGR, /\\x1b\\[[0-9;]*m/g, como na A2.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde fica a função stripAnsi?",
      "decision": "Exportada de test-extract.mjs e importada pelo capture.mjs, que já importa extractTests de lá.",
      "basis": "test-extract.mjs não importa lib/ de forma estática (comentário da linha 7), então a função fica disponível aos dois sem dependência nova.",
      "alternative": "Pôr a função em lib/plan-digest.mjs (exigiria conferir o embed e criaria um import estático no extrator).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "allTestNames, usado pelo modo removed sobre o stdout.txt bruto, também tira ANSI?",
      "decision": "Sim. allTestNames aplica stripAnsi antes de detectar o formato.",
      "basis": "REQ-004 pede que o extrator ignore ANSI. Sem isso, uma saída colorida esconderia um teste que ainda roda, e a checagem 'o teste ainda roda na saída da branch' do modo removed deixaria de pegá-lo.",
      "alternative": "Limpar só em extractTests.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "NO_COLOR e FORCE_COLOR sobrescrevem o ambiente do chamador?",
      "decision": "Sim, sempre: o filho recebe { ...env, NO_COLOR: '1', FORCE_COLOR: '0' }, sem opção para desligar.",
      "basis": "A cauda e o extrato precisam de texto estável para qualquer chamador. A limpeza de ANSI cobre o que ainda sair colorido. Com o Node 22 e o 26 e saída em pipe, as duas variáveis juntas não geraram aviso.",
      "alternative": "Definir as variáveis só quando o chamador não as definiu.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual linha do resumo do vitest decide o formato e as contagens?",
      "decision": "A linha Tests (contagem de testes); a linha Test Files é ignorada.",
      "basis": "O total que o workflow compara é o de testes, como no node:test. Test Files conta arquivos.",
      "alternative": "Exigir também a linha Test Files para reconhecer o formato.",
      "costIfWrong": "low",
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
      "input": "Resumo do vitest com 'Tests  1 failed | 2 passed | 1 skipped | 1 todo (5)'.",
      "expected": "format vitest, total 5, pass 2, fail 1, skipped 1, failedNames null."
    },
    {
      "id": "C2",
      "input": "O mesmo resumo em SGR, com o separador ' | ' e o total também coloridos, e uma saída node:test do reporter spec com marcas coloridas.",
      "expected": "O mesmo extrato do texto sem cor: vitest com as mesmas contagens, node-spec com os mesmos failedNames."
    },
    {
      "id": "C3",
      "input": "Texto com a linha 'Test Files  2 passed (2)' e sem a linha Tests.",
      "expected": "format unknown com total null."
    },
    {
      "id": "C4",
      "input": "Portão vitest vermelho capturado com --tests, com ou sem --brief.",
      "expected": "buildLine não quebra com failedNames null; extract.failedNamesCut 0; bytes, sha256 e lines são os do stdout bruto; o workflow segue o caminho fallback de hoje."
    },
    {
      "id": "C5",
      "input": "Chamador com FORCE_COLOR=1 no ambiente.",
      "expected": "O processo filho vê NO_COLOR=1 e FORCE_COLOR=0."
    }
  ]
}
```
