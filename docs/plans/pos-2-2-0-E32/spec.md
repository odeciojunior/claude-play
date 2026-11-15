# Spec E32 -- Triagem do backlog do executor

## Intenção

O roadmap anterior terminou (decisão 779 do roadmap anterior) com 17 pendentes em `docs/plans/roadmap-evolucao-skills/state.md` (SRC-02) e 30 notas arquivadas em `docs/reports/2026-11-13-pendencias-por-entregavel.md` (SRC-03, decisão 673 do roadmap anterior), parte delas já resolvida pelas versões 2.x (conflito SRC-02 vs SRC-04 em `sources.md`). REQ-005 e DEC-003 mandam conferir cada nota contra log e código, fechar as obsoletas, corrigir as pequenas ainda válidas e dar dono às grandes. REQ-006 manda tratar a lacuna da limpeza de processos: o agente de limpeza do release (`CLEANUP of deliverable` em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`) manda encerrar processos pelo caminho do worktree e pela faixa de portas, e nenhuma regra exigida pelo preflight cobre os comandos que listam e encerram processos (decisão 751 do roadmap anterior; 10 negações e limpeza incompleta na 2ª sonda; limitação conhecida na nota da 2.1.0). E32 entrega um relatório de triagem com a situação de cada nota, as correções pequenas com teste e, como correção principal, um modo `procs` em `skills/roadmap-release/scripts/verify-run.mjs` que lista e encerra esses processos por Node, comando já coberto pela regra `Bash(node:*)` que o preflight exige.

## Escopo

Dentro:

- Relatório `docs/reports/2026-11-15-E32-triagem-backlog.md` com as 47 notas (17 de SRC-02 e 30 de SRC-03), cada uma com situação e prova (peça 1, R1, R2).
- Modo `procs` em `skills/roadmap-release/scripts/verify-run.mjs`, com testes em `scripts/verify-run.test.mjs` (peça 2, R3).
- O prompt do agente de limpeza em `roadmap-release.js` passa a rodar `node "<verify-run.mjs>" procs <payload>` no lugar do texto livre de encerrar processos, com teste novo em `workflow/cleanup.test.mjs` (peça 2, R3).
- As outras correções pequenas que a triagem achar válidas e que cumprirem o critério de R2, até oito no total contando a de `procs`, cada uma com teste (peça 2, R4).

Fora:

- Mudanças grandes que a triagem achar válidas: viram pendência com dono no relatório (risco do card).
- O que já é de outro card deste roadmap: a remoção de `taskReview.single` e do texto do modo de revisão única (E29), o revisor sonnet contra opus e o laço quality (E30), a correção extra de parada-retomada (E31), nota de atualização, bump e publicação (E33). Notas sobre esses temas recebem o card como dono.
- Correções no arnês `tools/measure/` que E30 ou E31 usam nos lotes pagos: viram pendência com dono E30 ou E31 (R5).
- Formatos de plano ou de estado (não objetivo da estratégia), portões canônicos e `size.test.mjs` com o teto `MAX_WORKFLOW_CHARS` (decisão 647 do roadmap anterior).
- Notas de atualização já publicadas (`docs/releases/`), relatórios antigos em `docs/reports/` e o `state.md` do roadmap anterior: são histórico, não mudam.
- O `state.md` deste roadmap: as pendências com dono entram nele só nos estágios de registro e docs, na release.

O que não fazer:

- Não editar a pasta `docs/plans/roadmap-pos-2-2-0/` nem `docs/plans/roadmap-evolucao-skills/`.
- Não fazer execução paga nem lote de medição (DEC-004 cobre E30 e E31).
- Não mexer nas linhas que E29 altera (`TR`, laço por tarefa, `taskIssues`, `validateReleaseConfig` de `taskReview`, modos do `task-reviewer`, `run-batch.mjs`).
- Não marcar nota como corrigida sem commit nem como obsoleta sem prova; não inventar dono que não seja executor, dono ou um card.
- Não fazer push, não tocar em `main` nem na branch de release; não subir a versão do plugin.

## Desenho

**Relatório de triagem (critério 1, R1, R2).** O relatório fica em `docs/reports/2026-11-15-E32-triagem-backlog.md`, em português, com uma tabela por fonte (SRC-02 na ordem do `state.md` anterior, SRC-03 na ordem das seções `E11`, `Gate DEC-458`, `E12`, `E13`, `E28 ou próxima edição do release workflow`). Cada linha traz: número, início literal da nota (até 120 caracteres), situação e prova. A situação é uma de três: `obsoleta` com evidência (hash de commit em `main` ou na release, DEC do log anterior, ou arquivo e linha que mostram a nota resolvida ou sem objeto); `corrigida` com o hash do commit em `feat/E32` e o teste que a cobre; `pendente` com dono (executor, dono ou card E29, E30, E31, E33) e destino (card deste roadmap ou roadmap futuro). As duas notas-ponteiro de SRC-02 (E13: 1 nota; E28: 6 notas) fecham como obsoletas citando as linhas de SRC-03 que as consomem. Um quadro final soma as situações e confere 47 linhas. A conferência de cada nota lê o código atual da release e o `log.md` e o `decisions.md` do roadmap anterior; a nota da 2ª sonda sobre a limpeza que lista processos por PowerShell, tasklist e netstat (item 13 de SRC-02) fecha como corrigida pela peça `procs`. O critério é humano: o dono confere o relatório (H1).

**Modo `procs` do `verify-run.mjs` (critério 2, REQ-006, R3).** `REQUIRED` ganha `procs: (p) => typeof p.wt === 'string' && p.wt && Array.isArray(p.ports) && p.ports.length === 2 && p.ports.every(Number.isInteger)`, com payload `{ nonce, digest, wt, ports: [lo, hi] }` assinado como os outros modos e sem marcador (encerrar é idempotente). O modo lista processos e portas em escuta com `spawnSync` dentro do Node: no win32, `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"` e `netstat -ano -p tcp`; nos demais, `ps -eo pid=,ppid=,args=` e `lsof -nP -iTCP -sTCP:LISTEN`. Funções puras e exportadas fazem o resto: `parseCimProcs`, `parsePs`, `parseNetstatListen`, `parseLsofListen` e `selectProcs(procs, listens, { wt, ports, self, platform })`, que escolhe os processos cuja linha de comando contém o caminho do worktree (barras normalizadas, sem diferença de caixa no win32, sem barra final) seguido de fronteira, isto é, fim do texto, `/`, `\`, aspas (`"` ou `'`) ou espaço em branco, para que o worktree `E3` não case `E32/...` de outro entregável (a mesma armadilha de prefixo que o prompt já evita em `_tmp`), ou que escutam numa porta de `lo` a `hi`, e exclui o próprio processo e toda a sua cadeia de ancestrais (o shell e a sessão que rodam o comando). Cada escolhido é encerrado com `taskkill /PID <pid> /T /F` no win32 e `process.kill(pid, 'SIGTERM')` nos demais. A saída é `{ tool, mode: 'procs', nonce, matched: [{ pid, why, cmd }], ended: [pid], failed: [{ pid, error }], unchecked: [texto], digest }`, com `cmd` cortado em 200 caracteres e `unchecked` dizendo qual listagem não rodou (por exemplo, `lsof` ausente), sem falhar o comando. O cabeçalho do arquivo ganha a linha do modo e o uso da CLI passa a `group|read|check|procs`. Em `verify-run.test.mjs`, testes novos cobrem os quatro parsers com saídas fixas, `selectProcs` (caminho com `\` e caixa diferente no win32, fronteira depois do caminho: wt `.../E3` não casa a linha de comando `node D:/projects/claude-play-wt/E32/server.js` e casa `node D:/projects/claude-play-wt/E3/server.js`, `"D:/projects/claude-play-wt/E3"` e o caminho no fim do texto, porta dentro e fora da faixa, exclusão do próprio processo e dos ancestrais), a recusa de payload sem `wt` ou com `ports` inválido, e um teste de ponta a ponta que sobe um processo Node filho com um diretório temporário na linha de comando, roda `procs` com esse diretório e confere o filho encerrado e o pid em `ended`.

**Limpeza do release pelo `procs` (critério 2, R3).** No prompt `CLEANUP of deliverable ${E}` de `roadmap-release.js`, o trecho `end processes whose command contains "${wt}" or that listen on the ports ${port}-${port + 9}` passa a pedir para rodar uma vez `node "${VERIFY_RUN}" procs ${encArg({ nonce, wt, ports: [port, port + 9] })}` e pôr em `leftovers` cada pid de `failed` e cada item de `unchecked`; o nonce é derivado do `RUN_TOKEN` e do entregável, como nos outros payloads. O resto do prompt (patch do worktree sujo, `worktree remove`, `_tmp`, branch) e `S_CLEAN` não mudam. O preflight não muda: `requiredCommands` já exige `Bash(node:*)`, que cobre o comando. Um teste novo em `workflow/cleanup.test.mjs` (arquivo próprio, fora dos testes que E29 altera) lê `roadmap-release.js` e confere que o prompt de limpeza contém `procs` e `VERIFY_RUN` e não contém mais `end processes whose command contains`. O texto do prompt não pode crescer a ponto de passar o teto de `size.test.mjs`, que roda sem mudança.

**Demais correções pequenas (critério 2, R2, R4).** Cada nota classificada como válida e pequena por R2 vira uma tarefa com teste: mudança em código ganha teste de comportamento no arquivo de teste vizinho; mudança só em texto de agente ou skill ganha teste de conteúdo que lê o arquivo (padrão de `workflow/review.test.mjs`). Os arquivos e testes exatos dependem da triagem e ficam para o plano. A evidência do critério é G1 inteiro; G2 a G5 rodam na tarefa final do plano.

## Riscos

- Uma nota válida exige mudança grande -> vira pendente com dono no relatório (R2), não cresce o entregável.
- O modo `procs` encerra um processo alheio -> só casa caminho do worktree seguido de fronteira (fim, `/`, `\`, aspas ou espaço; `E3` não casa `E32`) ou porta da faixa do entregável e exclui a própria cadeia; o teste de ponta a ponta usa um diretório temporário exclusivo.
- Conflito de merge com E29 em `roadmap-release.js` -> a única linha tocada é o prompt de limpeza, que E29 não altera; o teste novo fica em arquivo próprio.
- `powershell.exe` ou `lsof` ausente na máquina -> a listagem que falta vai a `unchecked` e o agente de limpeza a relata em `leftovers`.

## Deixado para o plano

- Ordem das tarefas: modo `procs` e testes; prompt de limpeza e `cleanup.test.mjs`; uma tarefa por correção pequena; relatório de triagem por último, citando os hashes; G1 a G5 na tarefa final.
- A classificação nota a nota, feita na tarefa de triagem, e a lista das correções pequenas escolhidas.
- O formato exato do nonce do payload `procs` e o nome dos testes novos.

```json data
{
  "schema": "spec/1",
  "id": "E32",
  "title": "Triagem do backlog do executor",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o backlog, quando a triagem termina, então cada nota tem situação registrada (obsoleta com evidência, corrigida com commit, ou pendente com dono) num relatório em docs/reports. {verify: human; evidence: o dono confere o relatório de triagem em docs/reports}"
    },
    {
      "id": "AC2",
      "text": "Dadas as correções pequenas, quando integradas, então cada uma tem teste e G1 a G5 passam. {verify: test; evidence: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Qual é o universo da triagem e onde fica o relatório?",
      "decision": "As 47 notas: os 17 pendentes de docs/plans/roadmap-evolucao-skills/state.md e as 30 notas de docs/reports/2026-11-13-pendencias-por-entregavel.md; relatório docs/reports/2026-11-15-E32-triagem-backlog.md com uma linha por nota (situação obsoleta, corrigida ou pendente, e prova) e um quadro que soma 47; as duas notas-ponteiro fecham como obsoletas citando as notas de SRC-03.",
      "basis": "REQ-005 cita as duas fontes (SRC-02, SRC-03); critério 1 do card pede relatório em docs/reports; DEC-003 manda conferir cada nota contra log e código.",
      "alternative": "Triar só os 17 pendentes de SRC-02 e deixar as notas arquivadas para quando cada entregável citado rodar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "O que conta como correção pequena e quem é o dono de uma pendência?",
      "decision": "Pequena: até 3 arquivos de produto além dos testes, com teste, sem execução paga, sem mudar formato de plano ou de estado, portão canônico ou teto de tamanho, e fora das linhas que E29 altera; o resto vira pendente com dono executor, dono ou card (E29, E30, E31, E33) e destino (card deste roadmap ou roadmap futuro).",
      "basis": "Risco do card (nota grande vira pendência com dono); não objetivo da estratégia (formatos); DEC-003; DEC-004 (gasto pago só em E30 e E31).",
      "alternative": "Corrigir toda nota válida, qualquer que seja o tamanho.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como fechar a lacuna da limpeza de processos?",
      "decision": "Modo procs em verify-run.mjs (payload { nonce, digest, wt, ports }) que lista por Node os processos com o caminho do worktree na linha de comando, seguido de fronteira (fim do texto, /, \\, aspas ou espaço, para que E3 não case E32), ou em escuta na faixa de portas, exclui a própria cadeia e os encerra; o prompt de limpeza de roadmap-release.js roda esse comando no lugar do texto livre; o preflight não muda, porque Bash(node:*) já é exigido.",
      "basis": "Decisão 751 do roadmap anterior (nenhuma regra cobre o comando de encerrar processos); requiredCommands em preflight.mjs já exige Bash(node:*); padrão de scripts do plugin com caminho exato (verify-run group, read e check).",
      "alternative": "O preflight passa a exigir regras para ps, kill, taskkill, netstat e powershell.exe, que o dono acrescenta às permissões.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Há limite de correções nesta branch?",
      "decision": "Até oito correções, contando a de procs; nota válida e pequena além disso vira pendente com dono executor e destino roadmap futuro.",
      "basis": "Risco do card (o entregável não cresce); card sem tamanho estimado e caminho crítico até E33.",
      "alternative": "Sem limite: corrigir todas as pequenas válidas.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Notas sobre o arnês tools/measure entram nas correções?",
      "decision": "Não quando o arnês é usado por E30 ou E31: viram pendente com dono E30 ou E31; nota do arnês já resolvida fecha como obsoleta com prova.",
      "basis": "E30 e E31 medem com o arnês da passada C e E29 já o altera (DEC-010); risco transversal da estratégia (um lote por vez) e premissa de E30 (medir sem mudança de código).",
      "alternative": "Corrigir as notas pequenas do arnês nesta branch.",
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
      "what": "O dono confere o relatório de triagem docs/reports/2026-11-15-E32-triagem-backlog.md (critério 1).",
      "why": "O critério 1 é verify human: só o dono aceita a situação de cada nota.",
      "blocking": false,
      "workaround": "O executor entrega o relatório e as correções; a aceitação fica para o dono depois do merge."
    }
  ],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "procs no win32 com wt D:/x/E3, um processo cuja linha de comando traz d:\\x\\e3\\server.js e outro, de outro entregável, com D:/x/E32/server.js.",
      "expected": "O primeiro casa (barras e caixa normalizadas, seguido da fronteira \\) e é encerrado; o segundo não casa (depois de E3 vem 2, que não é fronteira) e segue vivo; teste de selectProcs cobre os dois."
    },
    {
      "id": "C2",
      "input": "procs rodado por um shell cuja linha de comando contém o caminho do worktree.",
      "expected": "O shell e seus ancestrais não são encerrados."
    },
    {
      "id": "C3",
      "input": "procs numa máquina sem lsof.",
      "expected": "Saída 0 com a listagem de portas em unchecked; o agente de limpeza a põe em leftovers."
    },
    {
      "id": "C4",
      "input": "Nota válida cuja correção mexe em mais de 3 arquivos de produto.",
      "expected": "Fica pendente com dono e destino no relatório, sem correção na branch."
    },
    {
      "id": "C5",
      "input": "Nota sobre o modo de revisão única ou sobre o laço quality.",
      "expected": "Pendente com dono E29 ou E30, ou obsoleta com prova se já resolvida."
    }
  ]
}
```
