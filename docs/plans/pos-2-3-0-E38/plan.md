# Plano E38 -- Arnês e limpeza de processos confiáveis

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E38/spec.md`.

## Contexto lido

- `tools/measure/session-metrics.mjs` (453 linhas): `normalizeLabel` (173-180), `piece3Of` (216-225), `isFixLabel` na linha 240 (`/-fix\d*(-|$)/`), `extract` (283-350, usa `isFixLabel` na linha 338 quando `task === null`). Testado em `tools/measure/session-metrics.test.mjs` (444 linhas, inclui `scanPrivacy` nas linhas 287-314).
- `tools/measure/baseline.mjs` (486 linhas): `mergeVariant` (125-154, linha 142 fixa `superpowers: first.superpowers` e linha 148 filtra `permissionMode` por `valid > 0`), `coherenceErrors` (161-184), `buildMarkdown` (330-366, linha 334 cabeçalho sem menção a `acceptedSuperpowers`), `buildBaseline` (370-424). Testado em `tools/measure/baseline.test.mjs` (460 linhas, linhas 402-424 `--accept-superpowers DEC-xxx`).
- `tools/measure/run-batch.mjs` (2669 linhas): `defaultExec` (33-56), `runBatch` (2245-2603, laço por tentativa `k = 1..runs` em 2304, execução de `claude` em 2356-2386, `exitCode` em 2602). Testado em `tools/measure/run-batch.test.mjs` (4535 linhas).
- `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs` (428 linhas): `parseCimProcs` (243-248), `parsePs` (249-256), `selectProcs` (278-308, `skip` em 283 e `inWt` em 296-300), `runProcs` (321-353, consulta CIM na linha 333 e `underPath` na linha 348). Testado em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` (775 linhas).

## Tarefas

### Tarefa 1: Corrigir isFixLabel em session-metrics.mjs para rejeitar *-fix-review e *-fix-probe (B10)

Arquivos: modificar `tools/measure/session-metrics.mjs`; testar em `tools/measure/session-metrics.test.mjs`.

Passos:

1. Teste primeiro em `tools/measure/session-metrics.test.mjs`:
   - Importar `isFixLabel` de `./session-metrics.mjs`.
   - Adicionar `test('E38 AC1 (B10): isFixLabel rejects *-fix-review and *-fix-probe while matching real fixers', ...)` verificando que `isFixLabel` devolve `true` para `E5:spec-fix1`, `E5:plan-fix2`, `E5:final-fix1`, `E5:gates-fix1`, `E5:regates-fix1`, `E5:delta-fix1`, `E5:merge-fix`, `E5:resume-fix` e `false` para `E5:merge-fix-review`, `E5:resume-fix-review`, `E5:gates-fix1-review`, `E5:regates-fix1-review`, `E5:merge-fix-probe`, `E5:spec-review1`.
   - Verificar em `extract` + `toAttemptCounters` (usando `realLabelRoot`) que numa sessão com `E5:spec`, `E5:merge-fix`, `E5:merge-fix-review`, `E5:resume-fix-review`, `E5:gates-fix1-review` e `E5:merge-fix-probe`, apenas `E5:merge-fix` conta em `r.fixAgents` (`c.conditional.fixCalls === 1`) enquanto os 4 rótulos `*-review` / `*-probe` permanecem em `c.structural`.
   - Rodar `node --test tools/measure/session-metrics.test.mjs` e confirmar falha antes da implementação.
2. Implementar em `tools/measure/session-metrics.mjs` (linha 240):
   - Exportar `export const isFixLabel = (label) => /-fix\d*$/.test(normalizeLabel(label));`.
3. Rodar `node --test tools/measure/session-metrics.test.mjs` e confirmar saída 0 (incluindo `scanPrivacy`). Commit `E38 T1: ancorar isFixLabel no fim do rotulo em session-metrics.mjs (B10)`.

### Tarefa 2: Fechar tratamento de superpowers em baseline.mjs (B23 / S3-07)

Arquivos: modificar `tools/measure/baseline.mjs`; testar em `tools/measure/baseline.test.mjs`.

Passos:

1. Teste primeiro em `tools/measure/baseline.test.mjs`:
   - Verificar que quando `--accept-superpowers DEC-747` é passado com divergência entre variantes, `ok.markdown` (`linha-de-base.md`) contém `Divergência de superpowers aceita por DEC-747.` no cabeçalho e lista a versão/commit de cada variante na tabela; quando não há divergência, `linha-de-base.md` não inclui a frase.
   - Adicionar teste para `mergeVariant` verificando que, quando um parcial sem execuções válidas (`valid: 0, denied: 1`) tem `superpowers` diferente do parcial com execuções válidas (`valid: 1`), `mergeVariant` registra o `superpowers` do parcial válido (alinhado a `permissionMode`).
   - Rodar `node --test tools/measure/baseline.test.mjs` e confirmar falha antes da implementação.
2. Implementar em `tools/measure/baseline.mjs`:
   - Em `mergeVariant(aggs)` (linha 142): alterar para `superpowers: aggs.find((a) => (a.valid ?? 0) > 0)?.superpowers ?? first.superpowers,`.
   - Em `buildMarkdown` (linha 334): incluir ``${baseline.acceptedSuperpowers ? ` Divergência de superpowers aceita por ${baseline.acceptedSuperpowers}.` : ''}`` na linha `Data: ${date}. Commit da tag de partida: ${tagCommit}.`.
3. Rodar `node --test tools/measure/baseline.test.mjs` e confirmar saída 0. Commit `E38 T2: citar decisao de superpowers aceita em linha-de-base.md e mergeVariant (S3-07)`.

### Tarefa 3: Integrar pré-voo e sentinela de processos em tools/measure/run-batch.mjs (B09)

Arquivos: modificar `tools/measure/run-batch.mjs`; testar em `tools/measure/run-batch.test.mjs`.

Passos:

1. Teste primeiro em `tools/measure/run-batch.test.mjs`:
   - Importar `detectExternalKiller`, `checkProcessPreflight`, `createProcessSentinel` de `./run-batch.mjs`.
   - Adicionar testes unitários verificando:
     - `detectExternalKiller` casa processos externos com `Stop-Process -Name "node" -Force`, `Stop-Process -Name node`, `taskkill /F /IM node.exe`, `tskill node`, `pkill -f node`, `killall node`, ignora o próprio PID (`selfPids`) e seus descendentes, e ignora `node server.js` ou `taskkill /T /F /PID 1234`.
     - `runBatch` com pré-voo reprovado (`listProcs` retornando processo externo com `Stop-Process -Name "node"` antes do lançamento): não dispara `claude -p`, registra tentativa `status: 'invalid', reason: 'preflight-processo-matador'`, `stoppedBy: 'preflight-processo-matador'`, grava evento redigido em `private/sentinel.log` e retorna `exitCode: 1`.
     - `runBatch` com sentinela durante `claude -p` (`listProcs` vazio no pré-voo e devolvendo `{ pid: 31720, ppid: 4000, cmd: 'pwsh -Command Stop-Process -Name "node" -Force' }` durante a execução ou na amostra final após saída 127): invalida a tentativa com `status: 'invalid', reason: 'morto-por-processo-externo'`, contabiliza `invalidReasons['morto-por-processo-externo'] === 1`, grava `private/sentinel.log`, mantém `aggregate.json` sem vazamento de caminhos e retorna `exitCode: 1`.
   - Rodar `node --test tools/measure/run-batch.test.mjs` e confirmar falha antes da implementação.
2. Implementar em `tools/measure/run-batch.mjs`:
   - Importar `parseCimProcs` e `parsePs` de `../../plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`.
   - Exportar `KILLER_RE`, `defaultListProcs(platform = process.platform, run = spawnSync)`, `detectExternalKiller(procs, { selfPids = new Set([process.pid]) } = {})`, `checkProcessPreflight(procs, { selfPids = new Set([process.pid]) } = {})` e `createProcessSentinel({ listProcs, selfPids = new Set([process.pid]), intervalMs = 2000, logFile = null, redact = (s) => s, now = () => new Date() } = {})`.
   - Estender a assinatura de `runBatch(opts, { exec = defaultExec, now = () => new Date(), ratify = ratifyE5Contract, pending = pendingE5, scenarioFn = makeScenario, listProcs = exec === defaultExec ? defaultListProcs : () => [], sentinelIntervalMs = 2000 } = {})`:
     - Antes de lançar os prompts da tentativa `k`, executar `checkProcessPreflight(listProcs(), { selfPids })`; se reprovar, registrar log redigido em `private/sentinel.log`, registrar tentativa `status: 'invalid', reason: 'preflight-processo-matador'`, gravar `private/attempts.json`, definir `stoppedBy = 'preflight-processo-matador'` e encerrar o laço com `break`.
     - Em torno de cada chamada `exec('claude', args, ...)`, iniciar o sentinela (`sentinel.start()`), forçar amostra final no `finally` (`sentinel.sample()`) e parar (`sentinel.stop()`); se `sentinel.killedBy()` não for nulo, marcar `failed = true`, `failReason = 'morto-por-processo-externo'` e sair do laço da tentativa.
   - Garantir conformidade com `scanPrivacy` (sem caminhos pessoais nem UUIDs reais em `run-batch.mjs` e `run-batch.test.mjs`).
3. Rodar `node --test tools/measure/run-batch.test.mjs` e `node --test tools/measure/session-metrics.test.mjs`, confirmar saída 0. Commit `E38 T3: integrar pre-voo e sentinela de processos em run-batch.mjs (B09)`.

### Tarefa 4: Filtrar PPID reaproveitado por CreationDate em verify-run.mjs (B11)

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`; testar em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`.

Passos:

1. Teste primeiro em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`:
   - Importar `parseCreationDate` de `./verify-run.mjs`.
   - Adicionar testes para `parseCreationDate` e `parseCimProcs` cobrindo `"/Date(1732190000000)/"`, ISO-8601 e ausência/`null`.
   - Adicionar testes em `selectProcs` e `runProcs` cobrindo:
     - Listener órfão `pid 90` (`created: 1000`, `ppid: 80`) com processo atual no `pid 80` criado depois (`created: 2000`, `cmd: 'node D:/x/E3/dev.js'`): `selectProcs` corta o vínculo, não seleciona `pid 90` e envia-o para `unchecked`.
     - Listener legítimo `pid 91` (`created: 2500`, `ppid: 80`) com `parent.created <= child.created`: `selectProcs` mantém o vínculo e seleciona `pid 91` com `why: 'port ...'`.
     - `skip` em `selectProcs` e `underPath` em `runProcs` respeitando `validParent(child, parent)`.
     - Consulta `Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine | ConvertTo-Json -Compress` verificada em `runProcs`.
   - Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e confirmar falha antes da implementação.
2. Implementar em `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`:
   - Exportar `parseCreationDate(v)` (aceita número finito, `"/Date(<ms>)/"`, ou string ISO/data parseável; retorna ms ou `null`).
   - Atualizar `parseCimProcs(text)` para extrair `const created = parseCreationDate(o.CreationDate)` e incluir `...(created !== null ? { created } : {})`.
   - Adicionar `validParent(child, parent)` (`!(Number.isFinite(child?.created) && Number.isFinite(parent?.created) && parent.created > child.created)`) e aplicá-la em `skip` (`selectProcs`), `inWt` (`selectProcs`) e `underPath` (`runProcs`).
   - Atualizar o comando CIM em `runProcs` para `Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine`.
3. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` e confirmar saída 0. Commit `E38 T4: cortar ancestralidade de PPID reaproveitado por CreationDate em verify-run.mjs (B11)`.

### Tarefa 5: Exercício do caminho Linux de verify-run.mjs procs, relatório e portões G1 a G5 (B12 / AC2)

Arquivos: criar `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`. Depende das Tarefas 1, 2, 3 e 4.

Passos:

1. Exercitar o caminho Linux de `verify-run.mjs procs` (`platform: 'linux'`, `ps`, `lsof`, `SIGTERM`) sobre processos reais (ou registrar em seção explícita o diagnóstico completo do ambiente WSL caso `WslService`/`FSE Switch` bloqueie execução no sandbox, junto com execução real de `platform: 'linux'` com processos `node` reais e `ps` / `process.kill(pid, 'SIGTERM')`). Se o comando `wsl` falhar ou travar no sandbox, avaliar se `DEC-011` exige re-plan ou registro transparente para a conferência humana do dono em AC2.
2. Criar `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md` registrando todas as saídas de AC1 e AC2 (`ps`, `lsof`, `SIGTERM`, `matched`, `ended`, `failed`, `unchecked`).
3. Executar o comando completo de `AC1` e os 5 portões canônicos `G1`–`G5`:
   - `node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`
   - `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (G1)
   - `claude plugin validate .` (G2)
   - `claude plugin validate plugins/productivity-tools` (G3)
   - `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` (G4)
   - `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` (G5)
4. Commit `E38 T5: relatorio de conferencia de procs e evidencias de G1 a G5`.

## Evidência dos critérios

| Critério | Tipo | Comando | Externo |
|---|---|---|---|
| AC1 | test | `node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs` | false |
| AC2 | human | - | false |

## Decisões do plano

- R1: Exportar `isFixLabel` e ancorar a regex em `/-fix\d*$/` em `tools/measure/session-metrics.mjs` (`B10`).
- R2: Em `tools/measure/baseline.mjs`, `mergeVariant` prioriza `superpowers` do agregado parcial válido e `buildMarkdown` cita `acceptedSuperpowers` no cabeçalho de `linha-de-base.md` (`S3-07`).
- R3: Exportar e integrar pré-voo e sentinela de processos em `tools/measure/run-batch.mjs` com motivos explícitos e log redigido em `private/sentinel.log` (`B09`).
- R4: Exportar `parseCreationDate` e cortar ancestralidade de PPID reaproveitado com `parent.created > child.created` em `verify-run.mjs` (`B11`).

```json data
{
  "schema": "plan/1",
  "id": "E38",
  "title": "Arnês e limpeza de processos confiáveis",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-pos-2-3-0/ em nenhuma tarefa do plano.",
    "Não editar plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js nem plugins/_template/.",
    "Manter tools/measure/ livre de caminhos pessoais, UUIDs fora de 00000000-0000-4000-8000-* e IDs de agente fora de agent-afab* (scanPrivacy em session-metrics.test.mjs).",
    "Preservar compatibilidade quando CreationDate estiver ausente (fixtures antigos ou ps POSIX).",
    "Não disparar chamadas pagas (claude -p / run-batch.mjs contra API) neste entregável."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Corrigir isFixLabel em session-metrics.mjs para rejeitar *-fix-review e *-fix-probe (B10)",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "tools/measure/session-metrics.mjs"
        ],
        "test": [
          "tools/measure/session-metrics.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "export const isFixLabel = (label) => /-fix\\d*$/.test(normalizeLabel(label))"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C1"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test tools/measure/session-metrics.test.mjs",
          "expect": "exit 0 com *-fix-review e *-fix-probe fora de fixAgents e scanPrivacy limpo"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Fechar tratamento de superpowers em baseline.mjs (B23 / S3-07)",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "tools/measure/baseline.mjs"
        ],
        "test": [
          "tools/measure/baseline.test.mjs"
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
        "mergeVariant prioriza superpowers do parcial válido e buildMarkdown cita acceptedSuperpowers"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C2"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test tools/measure/baseline.test.mjs",
          "expect": "exit 0 com linha-de-base.md citando DEC de superpowers aceita"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Integrar pré-voo e sentinela de processos em tools/measure/run-batch.mjs (B09)",
      "deps": [
        4
      ],
      "files": {
        "create": [],
        "modify": [
          "tools/measure/run-batch.mjs"
        ],
        "test": [
          "tools/measure/run-batch.test.mjs"
        ]
      },
      "writes": [],
      "score": {
        "ambiguity": 0,
        "reasoning": 2,
        "blast": 1,
        "verifiability": 0
      },
      "produces": [
        "export { KILLER_RE, defaultListProcs, detectExternalKiller, checkProcessPreflight, createProcessSentinel } em run-batch.mjs"
      ],
      "consumes": [
        {
          "task": 4,
          "sig": "export function parseCimProcs(text) e export function parsePs(text)"
        }
      ],
      "covers": [
        "AC1",
        "C3"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test tools/measure/run-batch.test.mjs tools/measure/session-metrics.test.mjs",
          "expect": "exit 0 com pré-voo e sentinela de processos e scanPrivacy limpo"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Filtrar PPID reaproveitado por CreationDate em verify-run.mjs (B11)",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs"
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
        "export function parseCreationDate(v) e corte de PPID reaproveitado em selectProcs/runProcs",
        "export function parseCimProcs(text) e export function parsePs(text)"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C4"
      ],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs",
          "expect": "exit 0 cobrindo CreationDate em parseCimProcs, selectProcs e runProcs"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Exercício do caminho Linux de verify-run.mjs procs, relatório e portões G1 a G5 (B12 / AC2)",
      "deps": [
        1,
        2,
        3,
        4
      ],
      "files": {
        "create": [
          "docs/reports/2026-11-21-E38-arnes-e-procs-linux.md"
        ],
        "modify": [],
        "test": []
      },
      "writes": [],
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 1
      },
      "produces": [
        "docs/reports/2026-11-21-E38-arnes-e-procs-linux.md com registro de AC1 e AC2 e evidência G1-G5"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "export const isFixLabel = (label) => /-fix\\d*$/.test(normalizeLabel(label))"
        },
        {
          "task": 2,
          "sig": "mergeVariant prioriza superpowers do parcial válido e buildMarkdown cita acceptedSuperpowers"
        },
        {
          "task": 3,
          "sig": "export { KILLER_RE, defaultListProcs, detectExternalKiller, checkProcessPreflight, createProcessSentinel } em run-batch.mjs"
        },
        {
          "task": 4,
          "sig": "export function parseCreationDate(v) e corte de PPID reaproveitado em selectProcs/runProcs"
        }
      ],
      "covers": [
        "AC1",
        "AC2"
      ],
      "testFirst": {
        "exempt": "Relatório em docs/reports/ e execução final de portões G1 a G5 sem alteração de código"
      },
      "checks": [
        {
          "cmd": "node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs",
          "expect": "exit 0 (AC1)"
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
      "command": "node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "human",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como corrigir isFixLabel em tools/measure/session-metrics.mjs para não contar *-fix-review nem *-fix-probe sem quebrar os fixers legítimos?",
      "decision": "Exportar isFixLabel e ancorar a regex no fim do rótulo normalizado (/-fix\\d*$/), aceitando spec-fix<k>, plan-fix<k>, final-fix<k>, gates-fix<k>, regates-fix<k>, delta-fix<k>, merge-fix e resume-fix e rejeitando *-fix-review, *-fix<k>-review e *-fix-probe.",
      "basis": "normalizeLabel já converte para minúsculas e remove prefixo e<n>: e sufixo #<n>; todos os fixers fora de tarefa emitidos por roadmap-release.js terminam em -fix ou -fix<k>, enquanto os revisores e sondas pós-correção acrescentam -review ou -probe.",
      "alternative": "Manter /-fix\\d*(-|$)/ com lookahead negativo apenas para -review.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "O que falta em tools/measure/baseline.mjs para fechar a nota S3-07 dado que --accept-superpowers DEC-xxx já existe no código?",
      "decision": "Fazer mergeVariant selecionar superpowers a partir do primeiro agregado parcial com valid > 0 (fallback para first.superpowers) e exibir em buildMarkdown (linha-de-base.md) a frase 'Divergência de superpowers aceita por <DEC>.' quando baseline.acceptedSuperpowers estiver presente.",
      "basis": "Atualmente acceptedSuperpowers aparece só em baseline.json, e mergeVariant lê aggs[0].superpowers mesmo quando o primeiro parcial teve valid === 0.",
      "alternative": "Manter acceptedSuperpowers restrito ao JSON sem citá-lo em linha-de-base.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como integrar o pré-voo e o sentinela de processos em tools/measure/run-batch.mjs preservando testabilidade determinística e conformidade com scanPrivacy?",
      "decision": "Exportar KILLER_RE, defaultListProcs, detectExternalKiller, checkProcessPreflight e createProcessSentinel em run-batch.mjs; injetar listProcs e sentinelIntervalMs em runBatch (usando defaultListProcs apenas quando exec === defaultExec e () => [] nos fakes sem listProcs); reprovar no pré-voo com motivo 'preflight-processo-matador' antes de chamar claude -p e invalidar com 'morto-por-processo-externo' quando o sentinela detectar matador externo de node durante a execução, registrando log redigido em private/sentinel.log.",
      "basis": "Na execução x3 de E31, um Stop-Process -Name node externo matou o harness com saída 127; injetar listProcs evita dependência dos processos reais da máquina nos testes unitários com fake exec, e redigir caminhos no log mantém privacyFindings/scanPrivacy limpos.",
      "alternative": "Rodar powershell/ps incondicionalmente mesmo com fake exec ou filtrar apenas exit code 127 sem monitorar processos externos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como cortar cadeia de ancestralidade quando o Windows reaproveita um PID em verify-run.mjs selectProcs e runProcs?",
      "decision": "Exportar parseCreationDate(v) em verify-run.mjs, coletar CreationDate no Get-CimInstance Win32_Process de runProcs, preencher created em parseCimProcs quando válido, e em selectProcs (skip e inWt) e runProcs (underPath) cortar a cadeia sempre que filho e pai tiverem created numérico finito e parent.created > child.created.",
      "basis": "Se o pai original de um listener órfão morreu e o Windows reutilizou aquele PID para um processo mais novo do worktree, parent.created será estritamente maior que child.created; processos sem created (como ps no POSIX ou fixtures antigos) mantêm o comportamento anterior.",
      "alternative": "Mudar parsePs para tentar ler lstart em todas as distribuições Linux além do Windows.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "acceptance",
      "what": "O dono confere o registro da execução Linux/WSL real de verify-run.mjs procs em docs/reports/2026-11-21-E38-arnes-e-procs-linux.md (AC2).",
      "why": "AC2 é verify human conforme o card E38 e DEC-011.",
      "blocking": false,
      "workaround": "O executor realiza o exercício Linux/WSL e documenta integralmente as saídas em docs/reports/2026-11-21-E38-arnes-e-procs-linux.md."
    }
  ]
}
```
