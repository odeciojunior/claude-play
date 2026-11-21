# Plano E34 -- Espaço no workflow e diagnóstico de 512 KiB

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E34/spec.md`.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` (31 linhas): exporta `MAX_WORKFLOW_CHARS = 250000` (comentário linhas 5-10 citando `DEC-641` e `docs/reports/2026-11-13-E8-limite-lancamento-workflow.md`) e `workflowChars`, e testa `'the release workflow stays within the size launched by name'` verificando `size <= MAX_WORKFLOW_CHARS` sobre `roadmap-release.js` (245.049 caracteres LF atuais).
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` (675 linhas): na linha 4 importa `import { readFileSync, existsSync, readdirSync } from 'node:fs';`; na linha 211 exporta `RELEASE_WORKFLOW = 'productivity-tools:release-workflow'`; na linha 357 define `const HERE = dirname(fileURLToPath(import.meta.url));`; na linha 361 exporta `trackerCliPath(from = HERE)`; na linha 530 exporta `runPreflight(folder, { home = homedir(), ref = null, configDir = process.env.CLAUDE_CONFIG_DIR || null, trackerFrom = HERE, declarePermissions = null, wtRoot = null, platform = process.platform } = {})`; nas linhas 563-565 acumula erros de `validateReleaseConfig(config)` e `tracker.error` em `errors` antes do bloco condicional `if (config && errors.length === 0)` na linha 568.
- `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` (1136 linhas): importa `runPreflight`, `RELEASE_WORKFLOW` e auxiliares de `./preflight.mjs`, `repoWithRoadmap` (linhas 202-219), `PF_CLI` e `spawnSync` (linhas 6, 757-761).
- `plugins/productivity-tools/skills/roadmap-release/SKILL.md` (61 linhas), `references/operator.md` (113 linhas), `references/config.md` (74 linhas) e `workflow/docs.test.mjs` (115 linhas): `docs.test.mjs` verifica o passo 2 (`/\n2\. \*\*Preflight\.\*\*[\s\S]*?\n3\. \*\*/`) e o passo 4 (`/\n4\. \*\*Run the workflow\.\*\*[\s\S]*?\n5\. \*\*/`) de `SKILL.md` (incluindo a linha `   - After their reply, re-run preflight`), `operator.md` (`213.337`, `/not measured/i`, `/approval dialog/i`, `/supported path is the name/i`, `must exist before`, `--permission-mode acceptEdits --add-dir`) e `config.md` (`Bash(node *verify-run.mjs" *)`, `the \`procs\` subcommand of the cleanup`).

## Tarefas

### Tarefa 1: Elevar MAX_WORKFLOW_CHARS para 300.000 e testar folga > 50.000 chars em size.test.mjs

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` (também arquivo de teste).

Passos:

1. Em `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`, atualizar o comentário de topo (linhas 5-10) para citar `DEC-003` (roadmap pós-2.3.0, que elevou o teto de 250.000 de `DEC-641` para 300.000 caracteres LF, ~303 KB em CRLF, ~57% do limite real de 524.288 bytes / 512 KiB medido em `docs/reports/2026-11-13-E8-limite-lancamento-workflow.md`) e atualizar a constante exportada na linha 11 para `export const MAX_WORKFLOW_CHARS = 300000;`.
2. No bloco `test('the release workflow stays within the size launched by name', ...)` (linhas 18-21), manter `assert.ok(size <= MAX_WORKFLOW_CHARS, ...)` e adicionar a asserção `assert.ok(MAX_WORKFLOW_CHARS - size > 50000, \`roadmap-release.js slack is \${MAX_WORKFLOW_CHARS - size} chars, expected > 50000\`);` comprovando folga superior a 50.000 caracteres LF sem editar `roadmap-release.js`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` e confirmar saída 0. Commit `E34 T1: elevar MAX_WORKFLOW_CHARS para 300000 com asserção de folga > 50000`.

### Tarefa 2: Diagnosticar arquivo de workflow acima de 524.288 bytes (512 KiB) em preflight.mjs

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`; testar em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`:
   - Importar `MAX_WORKFLOW_LAUNCH_BYTES` e `workflowFilePath` de `./preflight.mjs`.
   - Adicionar `test('E34 AC2: workflowFilePath points to roadmap-release.js and the real workflow is within 524288 bytes', ...)`: verifica que `MAX_WORKFLOW_LAUNCH_BYTES` é `524288`, `workflowFilePath()` termina com `/workflow/roadmap-release.js`, não contém `\`, existe em disco e `runPreflight` sobre `repoWithRoadmap(true).dir` retorna `errors: []`.
   - Adicionar `test('E34 AC2: runPreflight accepts a workflow file of exactly 524288 bytes (C1) and rejects 524289 bytes with a not found error (C2)', ...)`: cria diretório temporário com um arquivo de `524288` bytes (`Buffer.alloc(524288, 0x61)`) e outro de `524289` bytes (`Buffer.alloc(524289, 0x61)`); verifica que `runPreflight(dir, { home, ref: 'rel', workflowPath: wf512k }).errors` é `[]` (C1); verifica que `runPreflight(dir, { home, ref: 'rel', workflowPath: wfOver }).errors` contém 1 erro casando `/524\.288/`, `/512 KiB/`, `/524289/`, `/productivity-tools:release-workflow/` e `/'not found'/`, e que o CLI `spawnSync(process.execPath, [PF_CLI, dir, '--ref', 'rel'], ...)` sai 0 com o workflow real (C2).
   - Adicionar `test('E34 C3: runPreflight reports both config validation errors and the 524.288-byte workflow size error', ...)`: num repositório onde `release.config.json` é inválido (por exemplo `{ projectContext: '', install: '', gates: [] }`) e `workflowPath` aponta para o arquivo de `524289` bytes, `runPreflight` acumula em `errors` tanto o erro de `gates must be a non-empty list` quanto o erro de `524.288 bytes (512 KiB)` / `'not found'`.
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e confirmar que os novos testes falham antes da implementação.
2. Implementar em `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`:
   - Na linha 4, adicionar `statSync` ao import existente de `node:fs`: `import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';`.
   - Exportar `export const MAX_WORKFLOW_LAUNCH_BYTES = 524288;` e `export function workflowFilePath(from = HERE) { return resolve(from, '../workflow/roadmap-release.js').split(sep).join('/'); }`.
   - Em `runPreflight(folder, { home = homedir(), ref = null, configDir = process.env.CLAUDE_CONFIG_DIR || null, trackerFrom = HERE, declarePermissions = null, wtRoot = null, platform = process.platform, workflowPath = null } = {})`, logo após `if (tracker.error) errors.push(tracker.error);` (independentemente de erros anteriores de `config`, cobrindo C3), resolver `const wfPath = workflowPath ? resolve(workflowPath).split(sep).join('/') : (existsSync(workflowFilePath(trackerFrom)) ? workflowFilePath(trackerFrom) : workflowFilePath(HERE));` e, quando `existsSync(wfPath)`, medir `const wfSize = statSync(wfPath).size;` e se `wfSize > MAX_WORKFLOW_LAUNCH_BYTES`, adicionar a `errors`: ``release workflow file exceeds 524.288 bytes (512 KiB): ${wfPath} has ${wfSize} bytes (limit is ${MAX_WORKFLOW_LAUNCH_BYTES} bytes); launching ${RELEASE_WORKFLOW} by name will fail with 'not found'``.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e confirmar que todos os testes passam. Commit `E34 T2: diagnosticar workflow acima de 524.288 bytes (512 KiB) no preflight`.

### Tarefa 3: Documentar o limite de 512 KiB e diagnóstico na skill e referências com teste em docs.test.mjs

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/SKILL.md`, `plugins/productivity-tools/skills/roadmap-release/references/operator.md` e `plugins/productivity-tools/skills/roadmap-release/references/config.md`; testar em `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs`. Depende das Tarefas 1 e 2.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs`:
   - Adicionar `test('E34: SKILL.md, operator.md and config.md document the 524.288-byte (512 KiB) launch limit and preflight error', ...)`: lê `SKILL.md` (passo 2 e passo 4), `references/operator.md` e `references/config.md`, e verifica que o passo 2 de `SKILL.md`, o passo 4 de `SKILL.md`, `operator.md` e `config.md` citam `524.288` (ou `524288`), `512 KiB` e `not found` (com menção a bytes no disco / CRLF e ao erro de preflight).
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs` e confirmar que o novo teste falha.
2. Atualizar a documentação preservando todos os trechos verificados pelos testes existentes de `docs.test.mjs`:
   - Em `plugins/productivity-tools/skills/roadmap-release/SKILL.md`:
     - No passo 2 (`2. **Preflight.**`), acrescentar que `errors` também inclui um diagnóstico bloqueante quando `workflow/roadmap-release.js` ultrapassa `524.288` bytes (`512 KiB`, medidos em bytes reais no disco, onde CRLF soma 1 byte por linha), porque acima de `512 KiB` o lançamento pelo nome (`productivity-tools:release-workflow`) falha com `'not found'`.
     - No passo 4 (`4. **Run the workflow.**`), acrescentar junto à explicação do lançamento pelo nome e do erro `not found` que o lançamento pelo nome também falha com `'not found'` quando `workflow/roadmap-release.js` no disco ultrapassa `524.288` bytes (`512 KiB`, incluindo CRLF no Windows; o preflight já barra esse caso em `errors`), mantendo inalteradas as frases com `213.337`, `not measured`, `approval dialog` e `supported path is the name`.
   - Em `plugins/productivity-tools/skills/roadmap-release/references/operator.md`: na seção `## Without the interface (claude -p)` (ou `## Known limits`), documentar que o lançamento pelo nome (`productivity-tools:release-workflow`) tem limite de `524.288` bytes (`512 KiB`) do arquivo `workflow/roadmap-release.js` no disco (onde CRLF soma 1 byte por linha no Windows), acima do qual o runtime omite o workflow e a chamada pelo nome falha com `'not found'`, e que `preflight.mjs` barra esse caso em `errors`.
   - Em `plugins/productivity-tools/skills/roadmap-release/references/config.md`: na seção `## Permission preflight`, documentar que `preflight.mjs` mede o tamanho em bytes no disco de `workflow/roadmap-release.js` (`MAX_WORKFLOW_LAUNCH_BYTES = 524288`) e adiciona um erro em `errors` (exit 1) se o arquivo exceder `524.288` bytes (`512 KiB`, incluindo CRLF), diagnosticando que o lançamento pelo nome falhará com `'not found'`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs` e em seguida os portões G1 a G5 (`node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`, `claude plugin validate .`, `claude plugin validate plugins/productivity-tools`, `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`, `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`). Commit `E34 T3: documentar limite de 524.288 bytes (512 KiB) e diagnóstico do preflight`.

## Evidência dos critérios

| Critério | Tipo | Comando | Externo |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` | false |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | false |

## Decisões do plano

- R1: Registrar diagnóstico de arquivo de workflow acima de 524.288 bytes (512 KiB) em `errors` (bloqueante, saída 1), com mensagem citando o caminho do arquivo, o tamanho medido em bytes, o limite de 524.288 bytes (512 KiB) e que o lançamento pelo nome falhará com `'not found'`.
- R2: Medir em bytes no disco via `statSync(wfPath).size` contra `MAX_WORKFLOW_LAUNCH_BYTES = 524288`, resolvendo por padrão `../workflow/roadmap-release.js` a partir de `HERE` via `workflowFilePath(from = HERE)` e aceitando a opção `workflowPath` em `runPreflight` para injeção nos testes unitários.
- R3: Documentar em `SKILL.md` (passos 2 e 4), `references/operator.md` e `references/config.md` que arquivos acima de 524.288 bytes (512 KiB) fazem o lançamento pelo nome falhar com `'not found'` e são barrados em `errors` pelo preflight, preservando os trechos verificados por `workflow/docs.test.mjs` e adicionando teste em `docs.test.mjs`.

```json data
{
  "schema": "plan/1",
  "id": "E34",
  "title": "Espaço no workflow e diagnóstico de 512 KiB",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-pos-2-3-0/ em nenhuma tarefa do plano.",
    "Não editar plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js (mantém os 245.049 caracteres LF atuais para garantir folga > 50.000 caracteres sob MAX_WORKFLOW_CHARS = 300000).",
    "Em plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs, adicionar statSync ao import existente de node:fs na linha 4: import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';.",
    "Medir o tamanho real em bytes no disco com statSync(wfPath).size contra MAX_WORKFLOW_LAUNCH_BYTES = 524288 (512 KiB) e registrar o diagnóstico em errors (exit 1), independentemente de erros prévios de validateReleaseConfig.",
    "Preservar todas as asserções e regex existentes em plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs nos passos 2 e 4 de SKILL.md, references/operator.md e references/config.md.",
    "Sem bump de versão do plugin ou README.md (escopo de E40) e sem efeitos externos."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Elevar MAX_WORKFLOW_CHARS para 300.000 e testar folga > 50.000 chars em size.test.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 0
      },
      "produces": [
        "export const MAX_WORKFLOW_CHARS = 300000"
      ],
      "consumes": [],
      "covers": [
        "AC1"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com size <= 300000 e MAX_WORKFLOW_CHARS - size > 50000"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Diagnosticar arquivo de workflow acima de 524.288 bytes (512 KiB) em preflight.mjs",
      "deps": [],
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
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "export const MAX_WORKFLOW_LAUNCH_BYTES = 524288",
        "export function workflowFilePath(from = HERE)",
        "runPreflight(folder, { ..., workflowPath = null })"
      ],
      "consumes": [],
      "covers": [
        "AC2",
        "C1",
        "C2",
        "C3"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
          "expect": "exit 0 cobrindo C1 (524288 bytes), C2 (524289 bytes -> errors com 524.288, 512 KiB e 'not found') e C3 (config inválida + workflow > 512 KiB)"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Documentar o limite de 512 KiB e diagnóstico na skill e referências com teste em docs.test.mjs",
      "deps": [
        1,
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/SKILL.md",
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md",
          "plugins/productivity-tools/skills/roadmap-release/references/config.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 0
      },
      "produces": [
        "SKILL.md (passos 2 e 4), references/operator.md e references/config.md documentam o limite de 524.288 bytes (512 KiB), o erro 'not found' e o diagnóstico em errors do preflight"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "export const MAX_WORKFLOW_CHARS = 300000"
        },
        {
          "task": 2,
          "sig": "export const MAX_WORKFLOW_LAUNCH_BYTES = 524288"
        }
      ],
      "covers": [
        "AC1",
        "AC2"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 (G1)"
        },
        {
          "cmd": "claude plugin validate .",
          "expect": "exit 0 (G2)"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0 (G3)"
        },
        {
          "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid",
          "expect": "exit 0 (G4)"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0 (G5)"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
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
  "needsPerson": []
}
```
