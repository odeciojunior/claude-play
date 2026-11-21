# Spec E38 -- Arnês e limpeza de processos confiáveis

## Intenção

Em cumprimento a `REQ-005`, `REQ-006`, `DEC-010` e `DEC-011`, E38 endurece o arnês de medição (`tools/measure/`) e o subcomando `procs` do script do plugin (`plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`) antes de executar o lote pago de confirmação de E35 e a nova linha de base E39:
1. **`B10` (`tools/measure/session-metrics.mjs`):** `isFixLabel` usava `/-fix\d*(-|$)/`, contando `*-fix-review`, `*-fix<k>-review` e `*-fix-probe` em `r.fixAgents` (e subtraindo-os do trabalho estrutural em `toAttemptCounters`). Passa a ancorar no fim do rótulo normalizado (`/-fix\d*$/`) e a ser exportada para testes unitários diretos.
2. **`B23 / S3-07` (`tools/measure/baseline.mjs`):** além de registrar `superpowers` por variante e aceitar `--accept-superpowers DEC-xxx` em `baseline.json`, `mergeVariant` passa a priorizar o agregado parcial com execuções válidas ao escolher `superpowers` (alinhado a `permissionMode`), e `buildMarkdown` (`linha-de-base.md`) cita explicitamente a decisão que aceitou a divergência quando aplicável.
3. **`B09` (`tools/measure/run-batch.mjs`):** a execução `x3` do lote anterior (`docs/reports/2026-11-17-E31-parada-retomada.md`) morreu por `Stop-Process -Name "node" -Force` externo (saída 127). E38 integra pré-voo e sentinela de processos diretamente em `runBatch`, exportando helpers puros/injetáveis (`KILLER_RE`, `defaultListProcs`, `detectExternalKiller`, `checkProcessPreflight`, `createProcessSentinel`) e invalidando o lote ou a tentativa com motivo explícito (`preflight-processo-matador` / `morto-por-processo-externo`) e trilha redigida em `private/sentinel.log`.
4. **`B11` (`plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`):** em `selectProcs` e `runProcs`, o Windows pode reaproveitar um PID de pai já encerrado para um processo novo do worktree, ligando um listener órfão mais antigo a esse worktree. E38 inclui `CreationDate` na consulta `Win32_Process`, exporta `parseCreationDate` e corta qualquer vínculo pai-filho quando `parent.created > child.created`.
5. **`B12` (`AC2`, `DEC-011`):** exercita o caminho Linux de `verify-run.mjs procs` (`ps`, `lsof`, `SIGTERM`) sobre processos e portas reais em host Linux/WSL real fora de worktree (registrando também eventual bloqueio de ambiente WSL no sandbox) e documenta os resultados em `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`.

## Escopo

Dentro:

- `tools/measure/session-metrics.mjs` e `tools/measure/session-metrics.test.mjs`: exportar `isFixLabel` ancorado em `/-fix\d*$/` e cobrir rótulos `*-fix-review`, `*-fix<k>-review` e `*-fix-probe` no extrator e em `toAttemptCounters`.
- `tools/measure/baseline.mjs` e `tools/measure/baseline.test.mjs`: registrar `superpowers` do agregado parcial válido em `mergeVariant` e citar `acceptedSuperpowers` no cabeçalho de `linha-de-base.md`, com testes (`S3-07`).
- `tools/measure/run-batch.mjs` e `tools/measure/run-batch.test.mjs`: implementar e integrar pré-voo e sentinela de processos (`KILLER_RE`, `defaultListProcs`, `detectExternalKiller`, `checkProcessPreflight`, `createProcessSentinel`) com injeção em `runBatch` e log redigido em `private/sentinel.log`, sem introduzir caminhos pessoais ou UUIDs reais (mantendo `scanPrivacy` em 0).
- `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs` e `verify-run.test.mjs`: exportar `parseCreationDate`, extrair `CreationDate` em `parseCimProcs` e na consulta `Get-CimInstance Win32_Process`, e cortar ancestralidade quando `parent.created > child.created` em `selectProcs` e `runProcs`.
- `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`: registrar a conferência do caminho Linux (`ps`, `lsof`, `SIGTERM`) de `verify-run.mjs procs` e os resultados de `E38`.

Fora:

- Alterações em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` ou `plugins/_template/`.
- Execuções pagas (`claude -p` / `run-batch.mjs` contra API) — escopo do lote de confirmação de `E35` após `E38` e de `E39`.
- Limpeza das pastas históricas `D:/claude-e30-out`, `D:/claude-e31-out`, `D:/claude-e33-out` (adiada até `E40`).

O que não fazer:

- Não incluir caminhos pessoais (`C:\Users\...`, `/home/...`), UUIDs fora do prefixo fabricado ou IDs de agente fora de `agent-afab...` nos arquivos de `tools/measure/` (barrado por `scanPrivacy` em `session-metrics.test.mjs`).
- Não quebrar chamadas existentes de `parseCimProcs`, `selectProcs` ou `runProcs` quando `CreationDate` estiver ausente nos fixtures ou objetos de processo sem campo `created`.
- Não mudar `rolesByLabel` nem os pesos ou fórmulas estruturais fora de `isFixLabel`.

## Desenho

**`B10` — `isFixLabel` ancorado em `tools/measure/session-metrics.mjs` (`R1`).** Alterar a linha 240 para `export const isFixLabel = (label) => /-fix\d*$/.test(normalizeLabel(label));`. Como `normalizeLabel` remove prefixo `e<n>:` e sufixo `#<n>` em minúsculas, os fixers legítimos fora de tarefas (`spec-fix<k>`, `plan-fix<k>`, `final-fix<k>`, `gates-fix<k>`, `regates-fix<k>`, `delta-fix<k>`, `merge-fix`, `resume-fix`) terminam em `-fix\d*$` e permanecem contados em `r.fixAgents`, enquanto os revisores/sondas após correção (`merge-fix-review`, `resume-fix-review`, `gates-fix1-review`, `regates-fix1-review`, `merge-fix-probe`) passam a retornar `false`, permanecendo no trabalho estrutural.

**`B23 / S3-07` — Registro de `superpowers` em `tools/measure/baseline.mjs` (`R2`).** `coherenceErrors` e `buildBaseline` já suportam `--accept-superpowers DEC-xxx` gravando `acceptedSuperpowers` em `baseline.json` e a coluna `Superpowers` por variante em `linha-de-base.md`. Faltavam dois fechamentos para `S3-07`: (1) `mergeVariant(aggs)` passa a escolher `superpowers` a partir do primeiro agregado parcial com `valid > 0` (`aggs.find((a) => (a.valid ?? 0) > 0)?.superpowers ?? first.superpowers`), evitando que um parcial negado/inválido anterior mascare a versão efetivamente medida; e (2) `buildMarkdown` inclui `Divergência de superpowers aceita por ${baseline.acceptedSuperpowers}.` na linha de cabeçalho de `linha-de-base.md` quando `baseline.acceptedSuperpowers` estiver definido, deixando a decisão visível nos dois artefatos de saída.

**`B09` — Pré-voo e sentinela de processos em `tools/measure/run-batch.mjs` (`R3`).** Reaproveitar `parseCimProcs` e `parsePs` de `verify-run.mjs` em `defaultListProcs(platform, run)` para listar PIDs e linhas de comando sem duplicar parsers. `KILLER_RE` reconhece comandos externos que encerram processos `node` em lote (`Stop-Process ... -Name node`, `taskkill ... /IM node(.exe)`, `tskill node`, `pkill ... node`, `killall ... node`). `detectExternalKiller(procs, { selfPids })` constrói o mapa por PID e desconsidera qualquer processo cujo ancestral esteja em `selfPids` (o próprio `run-batch`, subárvore e invocação `powershell`/`ps` do sentinela), retornando o primeiro processo externo casado. `checkProcessPreflight(procs, { selfPids })` devolve `{ ok: !hit, killer: hit }`. `createProcessSentinel({ listProcs, selfPids, intervalMs, logFile, redact, now })` realiza varreduras periódicas e uma amostra final em `stop()`, acumula eventos no `private/sentinel.log` (com paths redigidos via `redactPaths` no contexto do lote) e memoriza o primeiro matador externo observado. Em `runBatch`, antes do laço de prompts de cada tentativa `k`, se `!pf.ok`, a tentativa entra como `invalid` com motivo `'preflight-processo-matador'` sem disparar `claude -p` e o lote para (`stoppedBy = 'preflight-processo-matador'`). Durante cada `claude -p`, o sentinela monitora o ambiente (incluindo amostra final imediatamente após o término do processo filho) e, se detectar matador externo de `node`, invalida a tentativa com `status: 'invalid', reason: 'morto-por-processo-externo'`. Em testes sem `listProcs` injetado e com `exec !== defaultExec`, o padrão de `listProcs` é `() => []` para não acoplar testes simulados à tabela de processos da máquina.

**`B11` — Filtro de `CreationDate` para PPID reaproveitado em `verify-run.mjs` (`R4`).** Exportar `parseCreationDate(v)` que aceita strings WMI/PowerShell `"/Date(1732190000000)/"`, datas ISO/Date parseáveis e números finitos, retornando o timestamp em milissegundos ou `null`. Em `parseCimProcs`, extrair `created = parseCreationDate(o.CreationDate)` e incluir a propriedade `created` apenas quando diferente de `null`. Em `runProcs`, consultar `Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine`. Em `selectProcs` (`skip` e `inWt`) e `runProcs` (`underPath`), definir `validParent(child, parent)` que devolve `true` salvo quando `Number.isFinite(child?.created) && Number.isFinite(parent?.created) && parent.created > child.created`. Caso o suposto pai tenha sido criado depois do filho (PID reaproveitado pelo Windows), a caminhada de ancestralidade para antes desse pai: o listener órfão não recebe vínculo falso com o worktree e vai para `unchecked`.

**`B12` — Conferência real de `verify-run.mjs procs` no caminho Linux (`AC2`, `DEC-011`).** Executar o ramo Linux (`ps`, `lsof`, `SIGTERM`) sobre processos `node` reais fora de worktree e registrar todas as saídas e eventual diagnóstico de ambiente WSL no relatório `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`.

## Deixado para o plano

- Tarefa 1: `isFixLabel` ancorado e testes em `tools/measure/session-metrics.{mjs,test.mjs}` (`B10`).
- Tarefa 2: `superpowers` em `mergeVariant` e `buildMarkdown` + testes em `tools/measure/baseline.{mjs,test.mjs}` (`S3-07`).
- Tarefa 3: pré-voo e sentinela de processos em `tools/measure/run-batch.{mjs,test.mjs}` (`B09`).
- Tarefa 4: `CreationDate` / PPID reaproveitado em `verify-run.{mjs,test.mjs}` (`B11`).
- Tarefa 5: conferência real Linux (`B12`), relatório em `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md` e execução de `AC1` + portões `G1`–`G5`.

```json data
{
  "schema": "spec/1",
  "id": "E38",
  "title": "Arnês e limpeza de processos confiáveis",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dados o pré-voo e sentinela do arnês, a regex isFixLabel em session-metrics.mjs, baseline.mjs (S3-07) e o filtro de CreationDate para PPID reaproveitado em verify-run.mjs, quando os testes unitários rodam, então todos os casos passam. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um host Linux ou WSL real em sessão fora de worktree, quando o modo procs de verify-run.mjs é exercitado sobre processos e portas reais, então a listagem (ps, lsof) e o encerramento (SIGTERM) funcionam conforme a spec e a saída fica registrada em relatório. {verify: human; evidence: o dono confere o registro da execução Linux/WSL real do modo procs no relatório de E38 em docs/reports}"
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
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Sessão de workflow com rótulos E5:merge-fix, E5:merge-fix-review, E5:resume-fix-review, E5:gates-fix1-review e E5:merge-fix-probe.",
      "expected": "Apenas E5:merge-fix entra em fixAgents (conditional.fixCalls === 1); os quatro rótulos *-review e *-probe retornam false em isFixLabel e permanecem em structural."
    },
    {
      "id": "C2",
      "input": "Agregados de variantes com versões distintas de superpowers e --accept-superpowers DEC-747 (incluindo variante com parcial denied de versão antiga).",
      "expected": "mergeVariant preserva a versão de superpowers do parcial válido, buildBaseline sai com código 0 e tanto baseline.json quanto linha-de-base.md registram DEC-747."
    },
    {
      "id": "C3",
      "input": "listProcs reporta 'pwsh -Command Stop-Process -Name \"node\" -Force' no pré-voo (cenário A) ou durante claude -p (cenário B), mantendo processos benignos e descendentes do próprio PID ignorados.",
      "expected": "Cenário A não chama claude -p e encerra com reason 'preflight-processo-matador'; cenário B invalida a tentativa com reason 'morto-por-processo-externo' e registra em private/sentinel.log."
    },
    {
      "id": "C4",
      "input": "Listener pid 90 (created 1000, ppid 80) onde pid 80 pertence a processo mais novo do worktree (created 2000), versus listener pid 91 (created 2500, ppid 80).",
      "expected": "selectProcs corta a ancestralidade de pid 90 (va para unchecked, não é encerrado) e mantém a ancestralidade de pid 91 (selecionado por port)."
    }
  ]
}
```
