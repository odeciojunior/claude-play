# Spec E34 -- Espaço no workflow e diagnóstico de 512 KiB

## Intenção

`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` está com 245.049 caracteres LF contra o teto atual `MAX_WORKFLOW_CHARS = 250000` em `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`, deixando ~4.950 caracteres de folga — insuficiente para as mudanças de E35, E36 e E37. A medição empírica em `docs/reports/2026-11-13-E8-limite-lancamento-workflow.md` provou que o limite real de lançamento pelo nome no runtime do Claude Code é de 524.288 bytes (512 KiB) do arquivo em disco (incluindo `\r\n` no Windows e bytes multibyte UTF-8), acima do qual o workflow desaparece do registro do plugin e a chamada pelo nome falha silenciosamente com `"not found"`. Em cumprimento a `REQ-001` e `DEC-003`, E34 eleva `MAX_WORKFLOW_CHARS` para `300000` caracteres LF em `size.test.mjs` (~303 KB em CRLF, ~57% do limite real, abrindo mais de 50.000 caracteres de folga) e adiciona diagnóstico explícito de arquivo de workflow acima de 524.288 bytes (512 KiB) em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` e na documentação da skill (`SKILL.md`, `references/operator.md`, `references/config.md`), cobrindo a nota `S3-27` com testes em `size.test.mjs`, `preflight.test.mjs` e `docs.test.mjs`.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`: atualizar `MAX_WORKFLOW_CHARS` de `250000` para `300000`, atualizar o comentário citando `DEC-003` e `docs/reports/2026-11-13-E8-limite-lancamento-workflow.md`, e verificar no teste que o tamanho LF de `roadmap-release.js` fica dentro de `MAX_WORKFLOW_CHARS` com folga superior a 50.000 caracteres (`MAX_WORKFLOW_CHARS - size > 50000`) (peça 1).
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`: exportar `MAX_WORKFLOW_LAUNCH_BYTES = 524288` e `workflowFilePath(from = HERE)` (resolvendo `../workflow/roadmap-release.js` a partir de `scripts/`), e em `runPreflight` (com opção injetável `workflowPath`) medir o tamanho em bytes do arquivo de workflow (`statSync(wfPath).size`); quando exceder `524288` bytes (512 KiB), registrar erro explícito em `errors` diagnosticando que o arquivo tem `<size>` bytes, acima do limite de `524.288` bytes (`512 KiB`), e que o lançamento pelo nome (`productivity-tools:release-workflow`) falhará com `'not found'` (peça 2, R1, R2).
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`: testes unitários cobrindo arquivo de workflow com `524288` bytes (passa sem erro de tamanho) e com `524289` bytes ou mais (empilha erro em `errors` citando `524.288` / `512 KiB` e `'not found'`, fazendo o CLI sair com código 1) (peça 2).
- `plugins/productivity-tools/skills/roadmap-release/SKILL.md`, `references/operator.md` e `references/config.md`: documentar o limite de 524.288 bytes (512 KiB) do lançamento pelo nome, o sintoma `'not found'` quando o arquivo excede 512 KiB (inclusive por CRLF no cache Windows) e o diagnóstico no preflight, preservando todas as frases exigidas por `workflow/docs.test.mjs` e adicionando teste em `workflow/docs.test.mjs` (peça 2, R3).

Fora:

- Alterações funcionais ou de prompts em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (ficam para E35, E36 e E37).
- Mudanças no mecanismo de carregamento de plugins do runtime do Claude Code ou criação de hooks para aprovar/lançar workflows.
- Bump de versão do plugin ou nota de release (escopo de E40).

O que não fazer:

- Não editar `roadmap-release.js` em E34 (mantém os 245.049 caracteres LF atuais para garantir a folga > 50.000 caracteres sob o novo teto de 300.000).
- Não quebrar as asserções existentes em `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs` (como os trechos de `213.337`, `not measured`, `approval dialog`, `supported path is the name`).
- Não medir caracteres LF no preflight para o limite de 512 KiB: o limite do runtime no lançamento pelo nome incide sobre os bytes reais do arquivo em disco (`statSync(wfPath).size`, que no Windows inclui `\r\n` e bytes UTF-8 multibyte).
- Não colocar o diagnóstico de 512 KiB apenas em `warnings`: arquivo acima de 524.288 bytes impede o lançamento pelo nome e deve entrar em `errors` (exit code 1).

## Desenho

**Teto `MAX_WORKFLOW_CHARS = 300000` e folga superior a 50.000 caracteres (critério 1, DEC-003).** Em `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`, a constante exportada `MAX_WORKFLOW_CHARS` passa de `250000` para `300000`. O comentário de topo é atualizado para citar `DEC-003` (roadmap pós-2.3.0) além do histórico `DEC-641` e do relatório `docs/reports/2026-11-13-E8-limite-lancamento-workflow.md` (~303 KB em CRLF, ~57% do limite real de 524.288 bytes). No teste `'the release workflow stays within the size launched by name'`, além de `assert.ok(size <= MAX_WORKFLOW_CHARS, ...)`, afirma-se `assert.ok(MAX_WORKFLOW_CHARS - size > 50000, ...)` para comprovar diretamente a folga superior a 50.000 caracteres LF (com os 245.049 caracteres LF atuais, a folga é de 54.951 caracteres).

**Diagnóstico de arquivo de workflow acima de 524.288 bytes / 512 KiB no preflight (critério 2, R1, R2).** Em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`, importa-se `statSync` de `node:fs` e exporta-se `MAX_WORKFLOW_LAUNCH_BYTES = 524288` junto com `workflowFilePath(from = HERE)`, que resolve `resolve(from, '../workflow/roadmap-release.js').split(sep).join('/')`. Em `runPreflight(folder, options)`, aceita-se a opção `workflowPath = null` (quando omitida, usa `workflowFilePath(trackerFrom)` se existir ou `workflowFilePath(HERE)`). Quando o arquivo apontado existe e `statSync(wfPath).size > MAX_WORKFLOW_LAUNCH_BYTES`, `runPreflight` adiciona a `errors` a mensagem: ``release workflow file exceeds 524.288 bytes (512 KiB): ${wfPath} has ${wfSize} bytes (limit is ${MAX_WORKFLOW_LAUNCH_BYTES} bytes); launching ${RELEASE_WORKFLOW} by name will fail with 'not found'``. Por entrar em `errors` (R1), `preflight.mjs` termina com código de saída 1 e bloqueia a execução no passo 2 da skill antes de tentar lançar o workflow ou despachar agentes. A opção `workflowPath` (R2) permite que `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` teste tanto o arquivo real da branch (que fica abaixo de 524.288 bytes e não gera erro) quanto arquivos temporários com exatos `524288` bytes (fronteira válida, sem erro) e `524289` bytes (1 byte acima de 512 KiB, gera o erro em `errors` contendo `524.288`, `512 KiB`, `524289` e `'not found'`).

**Documentação do limite de 512 KiB na skill e referências (critério 2, S3-27, R3).** Em `plugins/productivity-tools/skills/roadmap-release/SKILL.md`: no passo 2 (**Preflight**), documenta-se que `errors` inclui o diagnóstico quando `workflow/roadmap-release.js` ultrapassa 524.288 bytes (512 KiB, medido em bytes no disco, onde CRLF soma 1 byte por linha), caso em que o lançamento pelo nome falha com `'not found'`; no passo 4 (**Run the workflow**), esclarece-se que um erro `'not found'` no lançamento pelo nome também ocorre se o arquivo do workflow no disco passar de 524.288 bytes (512 KiB, diagnosticado pelo preflight), mantendo intacto o texto sobre o fallback `scriptPath` e o limite de `213.337` caracteres do diálogo de aprovação. Em `plugins/productivity-tools/skills/roadmap-release/references/operator.md` (seção `## Without the interface (claude -p)` ou `## Known limits`) e em `plugins/productivity-tools/skills/roadmap-release/references/config.md` (seção `## Permission preflight`), acrescenta-se a nota do limite de 524.288 bytes (512 KiB) e da checagem em `errors` do preflight. Em `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs`, adiciona-se um teste verificando que `SKILL.md`, `operator.md` e `config.md` documentam o limite de `524.288` bytes (`512 KiB`) e o sintoma `not found`.

## Deixado para o plano

- Divisão em tarefas: Tarefa 1 (`size.test.mjs` com `MAX_WORKFLOW_CHARS = 300000` e asserção de folga > 50.000 chars); Tarefa 2 (`preflight.mjs` e `preflight.test.mjs` com `MAX_WORKFLOW_LAUNCH_BYTES = 524288`, checagem de tamanho em bytes e testes de fronteira 524.288 / 524.289 bytes); Tarefa 3 (`SKILL.md`, `references/operator.md`, `references/config.md` e teste em `workflow/docs.test.mjs`, seguido dos portões G1 a G5).
- Nomes exatos dos blocos `test(...)` adicionados em `preflight.test.mjs` e `docs.test.mjs`.

```json data
{
  "schema": "spec/1",
  "id": "E34",
  "title": "Espaço no workflow e diagnóstico de 512 KiB",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o workflow roadmap-release.js na branch, quando size.test.mjs roda com o novo teto de 300.000 caracteres LF autorizado pela DEC-003, então o teste passa com folga superior a 50.000 caracteres. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um arquivo de workflow com mais de 524.288 bytes (512 KiB), quando o preflight roda, então ele diagnostica que o lançamento pelo nome falhará com 'not found' acima de 512 KiB e o comportamento está coberto por teste. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Quando o arquivo do workflow ultrapassa 524.288 bytes (512 KiB), o preflight deve registrar o diagnóstico em errors (bloqueante, saída 1) ou em warnings?",
      "decision": "Registrar em errors (bloqueante, saída 1), com mensagem citando o caminho do arquivo, o tamanho medido em bytes, o limite de 524.288 bytes (512 KiB) e que o lançamento pelo nome falhará com 'not found'.",
      "basis": "A medição empírica de E8 (docs/reports/2026-11-13-E8-limite-lancamento-workflow.md) provou que a partir de 524.289 bytes o workflow some do registro do plugin e toda chamada pelo nome falha com 'not found', enquanto o fallback por scriptPath também não passa pelo diálogo acima de 213.337 chars; o card E34 (seção Riscos) explicita que 'o preflight passa a barrar acima de 512 KiB'.",
      "alternative": "Registrar apenas em warnings e permitir que a skill tente lançar o workflow e caia no erro 'not found' em tempo de execução.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como preflight.mjs deve localizar e medir o arquivo do workflow para permitir testes determinísticos sem alterar o arquivo real roadmap-release.js?",
      "decision": "Medir em bytes no disco via statSync(wfPath).size contra MAX_WORKFLOW_LAUNCH_BYTES = 524288, resolvendo por padrão ../workflow/roadmap-release.js a partir do diretório do script (HERE) e aceitando a opção workflowPath em runPreflight para injeção nos testes unitários.",
      "basis": "O limite de 524.288 bytes do runtime conta bytes reais do arquivo em disco (incluindo CRLF no Windows e UTF-8 multibyte, conforme docs/reports/2026-11-13-E8-limite-lancamento-workflow.md); injetar workflowPath em runPreflight segue o padrão já usado por trackerFrom, home, configDir e wtRoot em preflight.mjs.",
      "alternative": "Medir caracteres em memória ou substituir temporariamente o arquivo real roadmap-release.js da árvore durante o teste.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quais arquivos de documentação da skill devem registrar o diagnóstico de 512 KiB (S3-27)?",
      "decision": "Documentar em SKILL.md (passos 2 e 4), references/operator.md e references/config.md que arquivos acima de 524.288 bytes (512 KiB) fazem o lançamento pelo nome falhar com 'not found' e são barrados em errors pelo preflight, preservando os trechos verificados por workflow/docs.test.mjs e adicionando teste em docs.test.mjs.",
      "basis": "O card E34 pede diagnóstico em preflight.mjs e documentação da skill (S3-27), com testes; SKILL.md, operator.md e config.md são os três documentos que descrevem o preflight e o lançamento do workflow.",
      "alternative": "Documentar apenas em SKILL.md sem atualizar references/operator.md e references/config.md.",
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
      "input": "Arquivo de workflow com exatamente 524.288 bytes (512 KiB).",
      "expected": "runPreflight não adiciona erro de tamanho em errors (524.288 bytes é o último tamanho válido medido em E8)."
    },
    {
      "id": "C2",
      "input": "Arquivo de workflow com 524.289 bytes (1 byte acima de 512 KiB, por exemplo devido à conversão LF -> CRLF no Windows).",
      "expected": "runPreflight adiciona erro em errors informando os 524.289 bytes, o limite de 524.288 bytes (512 KiB) e que o lançamento pelo nome falhará com 'not found'."
    },
    {
      "id": "C3",
      "input": "Execução de runPreflight quando release.config.json já possui erros de validação e o arquivo de workflow também excede 524.288 bytes.",
      "expected": "A checagem do tamanho do arquivo de workflow roda independentemente da validação da config e ambos os erros aparecem em errors."
    }
  ]
}
```
