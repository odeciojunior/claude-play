# Spec E47 -- Retomada finish-merge com testes removidos declarados

## Intenção

REQ-010 (#17, B4 do plano de correções, DEC-011). Quando o roadmap-release retoma um merge que já está no alvo (ramo `finish-merge`), ele mede o test-integrity no intervalo `merge^1..merge` e quebra o entregável com `conteudo` se houver arquivo de teste apagado, mesmo que a spec ou o plano do merge tenham declarado e justificado essas remoções em `removedTests`. O `test-extract.mjs removed` de hoje não serve à retomada: exige uma saída de portão (`--output`, `--sha`, `--gate`, `--base`) e lê spec e plano do disco. Este entregável dá ao `test-extract.mjs` um modo `removed --merge <sha>`, sem saída de portão, e faz o ramo de retomada descontar só os arquivos apagados que esse modo devolver em `deletedCovered`, numa linha assinada. `removedAsserts` e `skipsAdded` nunca são descontados.

## Escopo

Dentro:

- `plugins/productivity-tools/scripts/test-extract.mjs`: modo `removed --merge`, ao lado do `removedCommand` de hoje.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: função pura de desconto no bloco `<pure>`, chamada do modo novo no ramo `finish-merge` (o bloco que começa com `resumeAction(card, STATUSES) === 'finish-merge'`) e a lista do verificado na mensagem do `markBroken`.
- Testes: `plugins/productivity-tools/scripts/test-extract.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.
- Uma frase em `plugins/productivity-tools/skills/roadmap-release/references/operator.md`, seção "Integrity alerts".

Fora:

- `roadmap-release-agy.py` e o teste dele: paridade agy pendente #13 (DEC-008). Os commits que tocam `roadmap-release.js` e o commit de merge levam no corpo a linha `paridade agy: pendente #13`.
- O caminho sem retomada (`removedFloor`, portões na branch) e o subcomando `removed` de hoje, que continuam com o mesmo contrato e os mesmos testes.
- O programa de test-integrity (`TEST_INTEGRITY_DEFAULT`), `lib/` e qualquer bloco embutido.
- Remoção parcial dentro de um arquivo que continua existindo: segue como `removedAsserts` e quebra (gatilho de revisão da DEC-011).

O que não fazer:

- Não descontar `removedAsserts`, `skipsAdded` nem alerta heurístico; não afrouxar nem apagar teste negativo existente (DEC-004).
- Não mudar `acceptIntegrityAlerts`: continua lido só de `args`, para o SHA exato, e fora dos `resumeArgs`.
- Não escrever o número do limite de cópia em nenhum arquivo do plugin fora de `lib/plan-digest.mjs` (`copy-budget.test.mjs`); usar `MAX_COPY_BYTES`.
- Não depender de número de linha do `roadmap-release.js`: o E46 (`docs/plans/pos-2-6-0-E46/plan.md`) entra antes e desloca linhas (`selectDeliverables` com `explain`, `shq` sem aspas em valores seguros). Citar símbolos.
- Sem bump, push, tag ou comentário em issue.

## Desenho

### AC1 -- remoção declarada e verificada não quebra a retomada

`test-extract.mjs`: `removed --merge <sha>` exige `--nonce`, `--merge`, `--spec`, `--plan` e `--cwd`; `--spec` e `--plan` são caminhos relativos ao repositório (os `AP.spec` e `AP.plan` do workflow) e são lidos por `git show <merge>:<caminho>`, com o mesmo `readDataBlock` e o mesmo `checkRemovedTests` do modo de hoje. `--output`, `--sha`, `--base` e `--gate` junto com `--merge` são recusados (R1). Toda recusa do modo novo sai no formato do `refuse()` de hoje (`{ tool, command: 'removed', nonce, error }`, com nonce e sem digest, exit 2), que o `checkRun` do workflow já trata como recusa; esse contrato não muda. O merge precisa resolver para um commit com primeiro pai (`<merge>^1^{commit}`). Para cada par `file::name` declarado, de qualquer `gate` (R2), as checagens literais do modo de hoje passam a comparar `merge^1` (antes) com `merge` (depois): arquivo presente em `merge^1`, literal do nome uma única vez, como 1º argumento de `test(`/`it(`, e ausente do arquivo em `merge` (arquivo apagado conta como ausente). No modo `--merge`, "1º argumento" quer dizer o argumento inteiro: depois do literal só cabem espaços opcionais e `,` ou `)`; `test('caso ' + i, ...)` não verifica o par `caso ` (R3). Não há checagem de "ainda roda", porque não há saída de portão (DEC-011). Um arquivo apagado entre `merge^1` e `merge` entra em `deletedCovered` só quando está inteiro coberto (R3, R11): importa `node:test` sem renomear, não tem laço e toda chamada de teste, inclusive subteste `t.test(`, tem par verificado. A linha sai como hoje, assinada por `fnv1a(JSON.stringify(canon(rest)))`: `{ tool: 'test-extract', command: 'removed', nonce, merge, verified, deletedCovered, unverified, unverifiedCut, digest }`, com `merge` igual ao valor recebido (R7); só `unverified` é cortado para caber em `MAX_COPY_BYTES` (R9).

`roadmap-release.js`: no ramo `finish-merge`, depois da medida `${E}:resume-test-integrity` e antes da decisão sobre `hardAlerts`, quando a medida veio (`removedAsserts >= 0`), `deletedTests` não está vazio e `integrityAckMatches` não casa (R4), um `productivity-tools:script-runner` roda `node "<pluginRoot>/scripts/test-extract.mjs" removed --merge <card.mergeSha> --nonce <n> --spec <AP.spec> --plan <AP.plan> --cwd <INTWT>`, com cada valor passado por `shq` e o `runPrompt` de hoje; nonce `${RUN_TAG}:${E}:removed-merge`, saneado como no `removedFloor`; rótulos `${E}:resume-removed`, `${E}:resume-removed-retry2` e `${E}:resume-removed-retry3`, com haiku, haiku e sonnet (R6). `pluginRoot` passa a ser declarado antes do ramo `finish-merge` (R8). A linha só vale se `checkRun(stdout, 'test-extract', nonce)` aceitar, `merge === card.mergeSha` e `deletedCovered` for lista de strings. A função pura nova `integrityNetOfDeclared(integ, covered)` no bloco `<pure>`, junto de `integrityHardAlerts`, devolve `integ` com `deletedTests` sem as entradas iguais, string a string, a um item de `covered` (sem normalizar caminho nem comparar sufixo) e todos os outros campos iguais (R5); `hardAlerts` e os alertas heurísticos passam a ser calculados sobre esse resultado. Com desconto, o entregável segue para `postMerge` e o relatório ganha a preocupação `resume: deleted test files declared in removedTests and verified at the merge <sha>: <arquivos>`.

`flow.test.mjs`: teste do ramo de retomada, não só da função pura. Com `deletedTests: ['t/a.test.js']` e o runner devolvendo uma linha assinada com `deletedCovered: ['t/a.test.js']` e o `merge` do card, o entregável fecha com `merged: true`, sem `broken` nem `error`, com a preocupação que nomeia o arquivo; o prompt do runner traz `removed --merge`, o merge do card e os caminhos `AP.spec`/`AP.plan`. Teste direto de `integrityNetOfDeclared` por `loadPure()`, incluindo que `covered` `['t/a.test.js']` não remove `x/t/a.test.js` e que `removedAsserts` e `skipsAdded` saem iguais. As regex que leem valores do comando aceitam o valor com e sem aspas (o `shq` do E46 tira as aspas dos valores seguros, como SHA e nonce).

### AC2 -- remoção sem verificação ou arquivo coberto em parte continua quebrando

`test-extract.test.mjs`, num repositório temporário com um commit de merge (dois pais) feito à mão, spec e plano versionados no merge: (a) declarada e verificada com o arquivo inteiro coberto sai em `deletedCovered` e `verified` conta o par; (b) arquivo apagado com duas chamadas `test(` e só uma declarada fica fora de `deletedCovered`, com o motivo de cobertura parcial em `unverified`; (c) nome declarado que não aparece em `merge^1`, ou que continua no arquivo em `merge`, fica em `unverified`; (d) ficam fora de `deletedCovered`, cada um num arquivo apagado com os demais testes declarados e verificados: `it.each(`; chamada com nome em template; `test('caso ' + i, ...)` dentro de `for` com `caso ` declarado; teste declarado que contém `t.test('sub', ...)`; `import { test as check } from 'node:test'`; arquivo com `xit(`; e um arquivo coberto cujo corpo usa `/re/.test(s)` continua coberto (o argumento não é literal); (e) recusas no formato do `refuse()` de hoje (nonce, sem digest, exit 2): `--output` junto com `--merge`, merge inexistente, spec ausente no merge, bloco `removedTests` inválido; (f) a linha passa por `checkRun` e falha com outro nonce. O teste do modo de hoje não muda.

`flow.test.mjs`, ramo de retomada, todos com `broken: true`: linha com `deletedCovered: []` e um `unverified`; linha com `merge` de outro SHA; linha válida de outro nonce (C4); `deletedTests` com dois arquivos e `deletedCovered` com um só, com a mensagem nomeando o arquivo que sobrou; linha com digest errado nas três tentativas; runner nulo nas três tentativas; linha que cobre o arquivo mas `removedAsserts: 1` (o desconto não toca nas asserções). Em todos, a ação `merge-rejected` traz em `what` o que foi verificado: os arquivos de `deletedCovered` (ou `none`), os pares não verificados com motivo (mais `N more` quando houver `unverifiedCut`) ou o motivo de a linha não valer. `acceptIntegrityAlerts` com o SHA exato continua aceitando sem chamar o runner, e os testes de hoje de `acceptIntegrityAlerts`, de integridade desligada ou não medida e de alertas heurísticos continuam verdes sem mudança de sentido. Sem `deletedTests`, nenhum rótulo `resume-removed` aparece.

### Frase de operação

Em `operator.md`, "Integrity alerts", uma frase: arquivos de teste apagados por um merge retomado, declarados em `removedTests` na spec ou no plano do próprio merge e verificados por `test-extract.mjs removed --merge`, não são alerta quando o arquivo inteiro está coberto; asserções removidas e skips continuam sendo.

## Para o plano

- Divisão em tarefas (sugestão: modo novo com testes; desconto no workflow com testes; frase de operação), máximo de 4 arquivos por tarefa e um commit por tarefa, em worktree próprio criado de `release/pos-2.6.0` depois do merge do E46.
- Tamanho do `roadmap-release.js`: medir antes e depois da tarefa do workflow; teto do B4 de 3.500 caracteres LF de delta líquido; entre o teto e 20% acima, enxugar até o teto; acima disso parar e voltar ao dono via subagente opus (DEC-007, DEC-021); trava de 284.500 mantida. Avaliar se um auxiliar comum ao laço de tentativas do `removedFloor` reduz o custo sem mudar os testes dele.
- Regex exatas da chamada de teste e do import (R3), da busca de laço (R11) e texto exato das mensagens.
- Prova da frase de `operator.md` contra os orçamentos de prosa que a cobrem, se houver.
- G1 pelo Git Bash com o worktree parado, nunca com outra execução de testes correndo; piso: a contagem do último merge registrado em `docs/plans/roadmap-pos-2-6-0/log.md` antes do E47 (o do E46; antes dele, o do E52). G5 (`embed.mjs --check` nos 4 alvos) verde e lint do plugin sem FAIL. Revisão T2.

```json data
{
  "schema": "spec/1",
  "id": "E47",
  "title": "Retomada finish-merge com testes removidos declarados",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um merge retomado com testes removidos declarados e verificados, quando o test-integrity roda, então o entregável não quebra. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma remoção declarada sem verificação, ou um arquivo coberto só em parte, quando a retomada roda, então continua quebrando. {verify: test; evidence: node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Quais argumentos o modo removed --merge aceita?",
      "decision": "Exige --nonce, --merge, --spec, --plan e --cwd; --spec e --plan são caminhos relativos ao repositório lidos por git show <merge>:<caminho>; --output, --sha, --base e --gate junto com --merge são recusados no formato do refuse() de hoje ({ tool, command, nonce, error }, com nonce e sem digest) e exit 2; esse contrato de recusa não muda.",
      "basis": "DEC-011 manda ler spec e plano do merge e não usar saída de portão; recusar a mistura evita uma chamada meio de portão, meio de merge que ninguém testa.",
      "alternative": "Ignorar em silêncio os argumentos do modo de portão quando --merge vier.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como tratar o campo gate das entradas no modo --merge?",
      "decision": "Todas as entradas contam, com ou sem gate, e o motivo 'gate obrigatório' não se aplica.",
      "basis": "O gate filtra entradas contra a saída de um portão; o test-integrity da retomada não é por portão e o modo não tem saída de portão.",
      "alternative": "Exigir --gate e filtrar como no modo de hoje.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quando um arquivo apagado conta como coberto por inteiro?",
      "decision": "Quando, em merge^1, o arquivo importa test ou it de node:test sem renomear, e toda chamada test ou it, com sufixos (\\.\\w+)*, e toda chamada .test( ou .it( cujo 1º argumento começa por literal de string ou template, tem como 1º argumento exatamente o literal de um par declarado e verificado desse arquivo, seguido de espaços opcionais e de , ou ), e há ao menos uma chamada. Ficam fora de deletedCovered: import renomeado de test ou it (test as check), nomes de outro framework (xit, fit, specify), chamada sem literal (t.test(name, ...)), literal seguido de outra coisa ('caso ' + i), it.each, nome em template e qualquer chamada sem par verificado. /re/.test(s) não conta porque o argumento não é literal. O mesmo critério de argumento inteiro vale para verificar cada par no modo --merge.",
      "basis": "Sem saída de portão não há lista de testes que rodavam, então a cobertura é decidida pelo texto do arquivo em merge^1; os 72 arquivos *.test.mjs e *.test.js versionados importam node:test. Limites conhecidos, que a regra textual não pega: testes registrados por um auxiliar importado de outro módulo, chamadas por acesso indexado (test['skip'](...)) ou indireto ((0, test)(...)), e nome único registrado várias vezes em laço (tratado pela R11).",
      "alternative": "Contar os nomes declarados contra uma execução do arquivo em merge^1 (exigiria rodar testes dentro do script).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Quando o ramo de retomada chama o modo --merge?",
      "decision": "Só com a medida de integridade válida, deletedTests não vazio e acceptIntegrityAlerts sem casar com o merge.",
      "basis": "Sem arquivo apagado não há o que descontar, e com o aceite do operador o resultado não muda; evita um agente a mais no caso comum.",
      "alternative": "Chamar sempre que houver merge retomado.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual a forma da função pura de desconto?",
      "decision": "integrityNetOfDeclared(integ, covered) no bloco pure, que devolve integ com deletedTests sem as entradas iguais, string a string, a um item de covered (sem normalizar caminho nem casar sufixo: covered ['t/a.test.js'] não remove x/t/a.test.js) e os demais campos iguais; covered é o deletedCovered da linha aceita, ou [] quando a linha não vale.",
      "basis": "DEC-011 fixou que o desconto é por arquivo coberto; a verificação dos pares fica no script assinado, e o workflow não refaz o que não pode conferir.",
      "alternative": "integrityNetOfDeclared(integ, declared, verifiedPairs), como sugeria o B4 do plano de correções antes da DEC-011.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O que acontece quando o runner falha ou a linha não vale?",
      "decision": "Até três tentativas (haiku, haiku, sonnet), parando na recusa assinada com o nonce; sem linha válida não há desconto, os alertas duros seguem para o markBroken de hoje (kind conteudo) e a mensagem diz por que a verificação não valeu.",
      "basis": "Repete o laço já testado do removedFloor; falhar sem desconto mantém a guarda de integridade como está (DEC-004).",
      "alternative": "Marcar infra quando a verificação não roda.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como o workflow amarra a linha ao merge certo?",
      "decision": "O script devolve em merge o valor recebido em --merge, e o workflow só aceita a linha com checkRun válido e merge igual a card.mergeSha.",
      "basis": "É o mesmo padrão do campo base no removedFloor; nonce mais merge impedem reaproveitar a linha de outra execução ou de outro merge.",
      "alternative": "Devolver o SHA resolvido por rev-parse e comparar por prefixo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como o ramo finish-merge obtém o pluginRoot, declarado hoje depois dele?",
      "decision": "Mover a declaração const pluginRoot = pluginRootOf(A.trackerCli) para antes do ramo finish-merge; com pluginRoot nulo, não há verificação nem desconto e a mensagem diz isso.",
      "basis": "A declaração só depende de A; mover não custa caracteres e evita uma segunda chamada.",
      "alternative": "Chamar pluginRootOf(A.trackerCli) de novo dentro do ramo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "O que cortar quando a linha passa do limite de cópia?",
      "decision": "Só unverified é cortado, com unverifiedCut; deletedCovered nunca é cortado, e se a linha não cabe com unverified vazio o script recusa no formato do refuse() de hoje.",
      "basis": "Cortar deletedCovered mudaria o desconto em silêncio; recusar leva ao caminho sem desconto, que é o seguro.",
      "alternative": "Cortar também deletedCovered.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "A documentação de operação muda?",
      "decision": "Uma frase na seção Integrity alerts de operator.md sobre o desconto de arquivos apagados declarados e verificados no merge retomado, dizendo que asserções removidas e skips continuam alerta.",
      "basis": "A seção descreve exatamente o alerta que passa a ter exceção; sem a frase, o operador leria que todo arquivo apagado quebra.",
      "alternative": "Não documentar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como impedir que um nome único registrado várias vezes em laço conte como um só teste coberto?",
      "decision": "O arquivo em merge^1 fica fora de deletedCovered se tiver qualquer laço: a palavra for ou while seguida de (, ou uma chamada .forEach(, .map(, .flatMap( ou .reduce(, fora de comentário de linha; a checagem de cada par não muda.",
      "basis": "Saber se uma chamada está dentro de um laço exige casar chaves e parênteses sem confundir strings, templates e regex, que custa código e testes; a recusa por presença é uma busca simples, só erra para o lado de quebrar e o operador ainda tem acceptIntegrityAlerts.",
      "alternative": "Recusar só chamadas de teste aninhadas num laço, com um analisador de chaves e parênteses que pule strings e comentários.",
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
      "input": "Spec ou plano ausente no commit do merge, ou bloco removedTests inválido.",
      "expected": "O script recusa no formato do refuse() de hoje (com nonce, sem digest) e exit 2; a retomada não desconta e quebra com o motivo da recusa."
    },
    {
      "id": "C2",
      "input": "Arquivo apagado com testes declarados e verificados, mas com mais uma chamada test( não declarada.",
      "expected": "O arquivo fica fora de deletedCovered, com motivo de cobertura parcial em unverified, e a retomada quebra."
    },
    {
      "id": "C3",
      "input": "Merge que apaga um arquivo inteiro coberto e também remove asserções num arquivo que continua.",
      "expected": "O arquivo apagado é descontado, removedAsserts não, e a retomada quebra pelas asserções."
    },
    {
      "id": "C4",
      "input": "Linha válida de outro merge ou com outro nonce copiada pelo agente.",
      "expected": "A linha é recusada pelo workflow, não há desconto e a retomada quebra."
    },
    {
      "id": "C5",
      "input": "acceptIntegrityAlerts com o SHA exato do merge e deletedTests não vazio.",
      "expected": "O runner do modo --merge não é chamado e o aceite fecha como hoje, com a preocupação do operador."
    }
  ],
  "removedTests": []
}
```
