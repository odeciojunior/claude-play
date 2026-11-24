# Spec E41 -- Saída de script sem recópia por LLM

## Intenção

Hoje os workflows `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` e `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` mandam o agente `productivity-tools:script-runner` (haiku/low) rodar um script e devolver "o exit code e o stdout completo, literal". Depois conferem essa cópia por tool, nonce e digest. Os testes de 2026-11-23 (SRC-08, `docs/reports/2026-11-23-saida-de-script-sem-recopia.md`) mostraram três falhas. Com o context-mode ligado, a cópia perde linhas e o exit code. Sem corte nenhum, a leitura assinada de 19 KB foi resumida pelo modelo. E a saída de uma rodada que passa, que é a prova de sucesso das barreiras e do teste primeiro, é justamente a que se perde. Pela restrição confirmada no intake, o JS do workflow não tem sistema de arquivos nem processos, então a cópia por agente não some. O E41 diminui e confere o que o agente copia (REQ-011, DEC-024 a DEC-030):

- o exit code vem de um script (`plugins/productivity-tools/scripts/capture.mjs`), não da memória do modelo;
- nenhuma resposta copiada por agente passa de 3.500 bytes UTF-8 (constante única);
- conteúdo grande chega em fatias de até 3 KB, com digest por fatia e SHA-256 do total, e só a fatia que falhou é repetida;
- as barreiras de teste leem um extrator determinístico;
- os revisores leem diffs por arquivo, com offset/limit;
- a carga mecânica de spec e plano (B07, absorvida do E37 por DEC-030) deixa de depender de recópia literal.

Numeração dos critérios: o `spec/1` exige ids sequenciais, por isso os rótulos do cartão viram ids assim: AC1→AC1, AC2a→AC2, AC2b→AC3, AC3→AC4, AC4→AC5, AC5→AC6, AC6→AC7 e AC7→AC8. O texto de cada critério é o do cartão, palavra por palavra. Só a evidência das marcas `{verify: test}` foi trocada pelos arquivos de teste reais (R1).

## Escopo

Dentro:

- `plugins/productivity-tools/lib/plan-digest.mjs`: passa a ser a fonte única da conferência (R2). Fica uma fonte pura (DEC-058), embutida por `scripts/embed.mjs` nos 4 alvos e conferida com `embed.mjs --check`. Ganha:
  - `MAX_COPY_BYTES = 3500` e `SLICE_BYTES = 3072`;
  - `utf8Length` e `sha256Hex` em JS puro;
  - `sliceEnvelopes`, `checkSlice` e `joinSlices`;
  - `checkSigned`, movido de `coordinator.js`, e `checkRun`, movido de `roadmap-release.js`, com o mesmo comportamento;
  - `commandDigest` e `checkCapture`.
- `plugins/productivity-tools/scripts/capture.mjs` (novo):
  - `run`: roda o comando, grava stdout e stderr em `<git-dir absoluto>/pt-evidence/<tarefa>/` e imprime um JSON compacto assinado (exit, bytes, sha256, path, lines, cauda limitada, `extract` opcional);
  - `slice`: serve em fatias um arquivo já gravado;
  - `prune`: faz a limpeza da DEC-026.
- `plugins/productivity-tools/scripts/test-extract.mjs` (novo): extrator determinístico de saída do `node:test`, nos formatos TAP e spec, que devolve `{format, exit, total, pass, fail, skipped, failedNames}`.
- Opção `--slice <k>` com fatias de até 3 KB em três scripts: `progress.mjs read` (`skills/plan-coordinator/scripts/`), `preflight.mjs discover` (`skills/roadmap-release/scripts/`) e `verify-run.mjs read`, este por um campo `slice` no payload.
- `coordinator.js`:
  - leitura assinada por fatias;
  - `runTest`, linha de base e portão de onda pelo `capture.mjs` com extrator;
  - prompts do script-runner e do implementer;
  - limpeza no fecho.
- `roadmap-release.js`:
  - discovery e `readBack` por fatias;
  - portões (`gateOnce`, linha de base do preflight) pelo JSON do `capture.mjs`;
  - par do teste primeiro conferido pelo `capture.mjs`;
  - cargas de spec e plano por fatias do `capture.mjs` (B07);
  - limpeza no fecho.
- Contratos em `plugins/productivity-tools/agents/`: `script-runner.md`, `implementer.md`, `test-integrity.md`, `task-reviewer.md` e `final-reviewer.md`.
- `plugins/productivity-tools/scripts/review-package.mjs`: passa a imprimir `sha256` e `lines` do pacote.
- Documentação da pasta de provas, da limpeza e da retomada nas duas skills. Para a retomada vale a DEC-028: execuções da 2.4.0 não são retomáveis com `resumeFromRunId`.
- Testes novos e atualizados, com fixtures recriadas dentro dos testes do plugin a partir de geradores. Os testes não dependem de `D:/claude-pos23-out/cm-tests/`.
- Sonda paga AC2b (até US$ 1, DEC-029), com roteiro em `tools/measure/` e registro em `docs/plans/roadmap-pos-2-3-0/measurements.md`.

Fora:

- As skills do superpowers (terceiros, DEC-030), executar o E41 pelo release-workflow e publicar a 2.5.0 (E40, DEC-028).
- O caminho agy: `coordinator-agy.py`, `roadmap-release-agy.py` e `scripts/agy-bridge.py` rodam por subprocess, sem recópia. A única dependência real é o formato de `--page` de `progress.mjs read` e de `preflight.mjs discover`, e de `checkRun`/`testFirstGap`/`allPass` via `call_pure`. Ela é preservada sem mudar o agy (R4, R9).
- `verify-run.mjs group`, `check` e `procs`: fora do cartão e do AC5. O grupo do plano já é idempotente por nonce.
- Remover o retry em sonnet do script-runner (R11) e religar o context-mode na config do dono (DEC-027).
- Atualizar os braços congelados de `tools/measure/arms/` (R10).

O que não fazer:

- Não escrever as palavras `process`, `Buffer`, `crypto`, `import` nem `require` no código de `lib/plan-digest.mjs`. O `IMPURE_RE` de `scripts/embed.mjs` recusa a fonte, mesmo quando aparecem em identificadores ou strings.
- Não citar "superpowers" em arquivo não-teste do plugin (`scripts/independence.test.mjs`).
- Não mudar as linhas de prompt dos revisores em `roadmap-release.js` (`buildTaskReviewPrompt`, `Mode: review, lens:`), que são a base dos braços `tools/measure/arms/*-atual.md` (R10).
- Não remover `--page`, `checkRun` com o formato `{nonce, data}` da discovery nem a assinatura de 3 argumentos de `testFirstGap`. O caminho agy depende deles (R4, R9).
- Não gravar provas dentro da árvore de trabalho nem em `docs/`, e não citar o conteúdo de uma saída gravada num relatório. Só path, sha256 e exit (DEC-026).
- Não deixar o retry de uma fatia repetir as outras fatias, nem juntar fatias de leituras diferentes.

## Desenho

**AC1: captura de 12,7 KB pelo `capture.mjs` (`exit`, `bytes` e `sha256` iguais à execução direta, arquivo com 400 linhas).**

Uso: `node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] -- <programa> [args...]`. A alternativa ao `--` é `--bash "<string>"` (R6).

1. O script valida `--task` contra `^[A-Za-z0-9._-]+$` e resolve `git rev-parse --absolute-git-dir` a partir de `--cwd` (padrão: o diretório atual).
2. Roda o comando com `spawnSync` (`shell: false`, `maxBuffer` de 512 MiB) e grava `<seq>-stdout.txt` e `<seq>-stderr.txt` em `<git-dir>/pt-evidence/<task>/` (DEC-026).
3. Imprime uma linha JSON e sai com o exit code do comando. A linha tem `{tool:'capture', nonce, task, cmdDigest, exit, bytes, sha256, lines, path, stderrBytes, stderrSha256, stderrPath, tail, tailCut, extract?, digest}`.
   - `bytes` e `sha256` são do stdout bruto.
   - `cmdDigest = fnv1a(JSON.stringify(canon({argv})))`, ou `{bash}` no outro formato.
   - `path` usa barras normais.
   - `tail` traz as últimas linhas até caber em `SLICE_BYTES`.
   - `digest` é o fnv1a de `canon` do resto, como em `progress.mjs`.

No `coordinator.js`, o prompt do script-runner passa a dizer "devolva a única linha JSON impressa, literal". O workflow ignora o `exit` do `S_RUN` e usa o `exit` do JSON conferido por `checkCapture(stdout, {nonce, cmdDigest})`. Esse JSON é recusado antes do parse se o stdout copiado passar de `MAX_COPY_BYTES`. Testes:

- `plugins/productivity-tools/scripts/capture.test.mjs` gera um script de 400 linhas (~12,7 KB). Compara `bytes`/`sha256` com a execução direta por `spawnSync`, confere que o arquivo gravado tem 400 linhas e que o JSON tem até 3.500 bytes.
- `plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs` (novo, com o simulador de `flow.test.mjs`) roda o mesmo comando como comando de teste. O runner falso executa de verdade, e o teste confere que o evento `baseline` registra o exit e a cauda vindos do JSON conferido.

**AC2: leitura de 40 passos página a página com runner que corta acima de 3.500 bytes e omite o exit, e retry só da página resumida.**

Em `lib/plan-digest.mjs`:

- `sliceEnvelopes(head, text)` corta o texto do JSON canônico do payload projetado em pedaços. Cada envelope `{...head, slice, slices, total:{bytes, sha256}, text, digest}`, serializado, fica com no máximo `SLICE_BYTES` bytes UTF-8. O corte nunca divide um par substituto.
- `checkSlice` confere tool, comando, nonce, índice e digest da fatia.
- `joinSlices` confere a contagem, a ordem, o mesmo `total` em todas as fatias e o `sha256Hex` do texto remontado.

Em `progress.mjs read --slice <k>`:

- o payload é `{root, planChanged, stateDigest, state}`, sem `history` e sem `now`;
- o `now` vai no envelope, então o payload é determinístico entre chamadas;
- o script recalcula tudo a cada chamada e não grava arquivo (R3).

Em `coordinator.js`, `readSigned`:

1. Pede a fatia 0 com `A.runToken` como nonce, para manter a primeira chamada distinta na retomada.
2. Pede cada fatia seguinte com nonce próprio. Cada fatia tem até 3 tentativas (haiku, haiku, sonnet, R11), e só a fatia que falhou é repetida.
3. Junta as fatias com `joinSlices`. Se o SHA do total não bater, descarta tudo e recomeça a leitura uma vez.

Testes:

- `slices.test.mjs` gera um plano sintético de 40 passos (~19 KB, recriando `progress/plan.md` do intake). Com um runner falso que corta toda resposta acima de 3.500 bytes e devolve `exit` ausente, a leitura passa fatia a fatia. Com um runner falso que resume uma fatia na primeira cópia, só aquela fatia ganha um rótulo `-retry2`.
- `plugins/productivity-tools/scripts/signed-output.test.mjs` (novo) testa `sliceEnvelopes`/`checkSlice`/`joinSlices` e `sha256Hex` contra `node:crypto`.

**AC3: sonda paga AC2b (humano).**

O plano escreve um roteiro em `tools/measure/`, seguindo `.claude/rules/measure.md`: `--work` fora do repositório, config descartável e `--max-budget-usd` por execução, com a soma limitada a US$ 1 (DEC-029).

- O roteiro roda o plan-coordinator do plugin da branch num sandbox de 40 passos cujo primeiro passo é externo e não autorizado. Assim a execução lê o estado em fatias pelo script-runner/haiku e para em hold, sem despachar o implementer.
- São 3 execuções seguidas com o context-mode ligado só na config descartável e 3 com ele desligado (X1, X2).
- O resultado e o custo entram numa linha de `docs/plans/roadmap-pos-2-3-0/measurements.md`, que o dono confere (H1).
- Se a sonda passar, a retirada do retry em sonnet vira proposta ao dono, fora desta spec (R11).

**AC4: barreira com 60 testes passando e 3 falhando (`failedNames = [FAIL_A, FAIL_B, FAIL_C]`, `total = 63`).**

`scripts/test-extract.mjs` lê o stdout gravado e reconhece dois formatos (R7):

- `node-tap`: linhas `# tests N`, `# pass N`, `# fail N`, `# skipped N` e `not ok N - nome`, com subtestes indentados e sem contar suítes;
- `node-spec`: linhas `ℹ tests N`, `ℹ pass N` e `✖ nome (Xms)`, sem a seção "failing tests".

`failedNames` sai com nomes simples, sem repetição e em ordem. Formato não reconhecido dá `format:'unknown'` e contadores nulos. O `capture.mjs run --tests` põe esse objeto em `extract`, cortando a lista para caber no orçamento (`failedNamesCut`).

- No `coordinator.js`, `runTest` vira `capture.mjs run --tests --cwd ROOT --bash <teste>`. `baselineEvent`, `baselineProblem` e o portão de onda passam a usar `extract` e deixam de usar `failedTestNames(out.stdout)`. Um formato desconhecido ou uma lista cortada nunca passa uma falha.
- No `roadmap-release.js`, `measureTxt`/`gateOnce` e o passo 4 do preflight mandam o agente de medição rodar cada portão por `capture.mjs run --tests` com o nonce dado pelo workflow e devolver esse JSON em `S_GATE.capture`. A nova função pura `gateFromCapture` toma `exit`, `total`, `skipped` e `failedNames` do JSON conferido e só usa os números do agente quando `format` é `unknown` (R8).
- `gateSubset` compara nomes sem o prefixo `arquivo::`, para manter compatíveis as linhas de base da 2.4.0 e o caminho agy.

Testes: `plugins/productivity-tools/scripts/test-extract.test.mjs` gera a suíte de 63 testes (recriando `suite/big.test.js`) e a roda com `--test-reporter=tap` e `--test-reporter=spec`. `skills/roadmap-release/workflow/gates.test.mjs` cobre `gateFromCapture` com texto do agente divergente. `skills/plan-coordinator/workflow/gate.test.mjs` cobre o portão de onda.

**AC5: par de rodadas do implementer (exit 1 e depois exit 0, saída de 7 KB ou mais) conferido pelos JSON do `capture.mjs`.**

O prompt do implementer, nos dois workflows, passa a trazer a linha do capture com o caminho do `capture.mjs` e um prefixo de nonce `<RUN_TAG>:<E ou plano>:T<n>:`. `agents/implementer.md` troca a regra que proíbe pipe para `tail` (linhas 43 a 46) pelo uso obrigatório do capture:

- cada verificação roda como `node <capture> run --nonce <prefixo><k> --task <E>-T<n> -- <comando>`;
- `checks[].output` é a linha JSON do capture, literal;
- `checks[].exit` é o `exit` dela;
- o relatório cita path, sha256 e exit (DEC-026).

Em `roadmap-release.js`, `testFirstGap(task, impl, resumed, cap)` ganha o quarto argumento opcional `{noncePrefix}`:

- com ele, só conta um par de JSON conferidos por `checkCapture` (prefixo de nonce, digest), com `exit≠0` antes de `exit=0` e o mesmo `cmdDigest`;
- sem ele, o comportamento atual continua, para o agy (R9).

`fmtChecks` mostra o JSON (path, sha256, exit, cauda). Testes: `skills/roadmap-release/workflow/review.test.mjs` ganha casos com JSON reais gerados pelo `capture.mjs` sobre um comando de 7 KB ou mais que sai 1 e depois 0, e casos com digest adulterado, `cmdDigest` diferente e nonce fora do prefixo. `capture.test.mjs` confere o par na ponta do script.

**AC6: nenhuma resposta copiada passa de 3.500 bytes, numa constante única.**

O novo `plugins/productivity-tools/scripts/copy-budget.test.mjs` roda com fixtures grandes geradas no teste e percorre todas as respostas:

- `capture.mjs run`, com 12,7 KB e com 63 testes e nomes longos;
- `capture.mjs slice`;
- `progress.mjs read --slice`, com 40 passos e um passo de 5 KB;
- `verify-run.mjs read` com `slice`, com brief e status longos;
- `preflight.mjs discover --slice`, com um roadmap de muitos cartões.

Em cada resposta, confere `utf8Length(stdout) <= MAX_COPY_BYTES`, importado de `lib/plan-digest.mjs`. Uma varredura confere também que o literal `3500` só aparece nesse módulo entre os arquivos não-teste do plugin, embutidos à parte. Os workflows usam a mesma constante embutida para recusar uma cópia acima do limite antes do parse.

**AC7: um passo isolado maior que 3 KB ainda sai em fatias de até 3 KB.**

O fatiamento é pelo texto serializado, não por passos. Por isso `READ_PAGE_CHARS` e `readPages` ficam só para `--page` (agy), e um passo de 5 KB atravessa várias fatias. Testes:

- `skills/plan-coordinator/scripts/progress.test.mjs` gera um passo com título e descrição de 5 KB, incluindo caracteres de vários bytes e um emoji na fronteira. Confere cada envelope com até 3.072 bytes e que `joinSlices` devolve o estado original.
- `signed-output.test.mjs` cobre a fronteira de pares substitutos.

**AC8: `capture.mjs` em Git Bash e em PowerShell, com caminho `C:/...` e exit preservado, e `/tmp/...` com erro claro.**

No Windows (`process.platform === 'win32'`, injetável nos testes), todo argumento de caminho (`--cwd`, `--path`) que comece com uma única `/` é recusado. A recusa é o JSON `{tool:'capture', error:'caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...'}`, com saída 2 e nada gravado. `C:/...` e `C:\...` são aceitos. O `--` separa as opções do comando, e tudo depois dele vai ao programa sem reinterpretar aspas. Com `--bash`, a string vai como um argumento ao Git Bash, localizado por `git --exec-path` (`<raiz do git>/bin/bash.exe`) ou por `PT_BASH`, nunca ao `bash` do PATH, que no PowerShell pode ser o do WSL. `capture.test.mjs` chama o `capture.mjs`:

- por `bash -c` e por `powershell -NoProfile -Command`, cada um pulado com motivo quando o shell não existe;
- com `--cwd C:/...` e o comando `node -e "process.exit(3)"`, conferindo que o processo e o JSON saem com 3;
- com `--cwd /tmp/x`, conferindo o erro claro e saída 2.

**Provas, limpeza e retomada (DEC-026, DEC-028).**

- `capture.mjs run` apaga, ao começar, arquivos de `pt-evidence` com mais de 14 dias.
- `capture.mjs prune --task-prefix <p>` roda no fecho: no `coordinator.js`, quando o plano termina, para o prefixo do plano; no `roadmap-release.js`, no estágio CLEANUP, para `<E>-`.
- A pasta some com o worktree porque fica no git-dir dele.
- `SKILL.md` e `references/state.md` do plan-coordinator, e `SKILL.md` e `references/operator.md` do roadmap-release, documentam a pasta, a limpeza e que `resumeFromRunId` de execuções da 2.4.0 não é retomável. Os trechos que `workflow/docs.test.mjs` exige continuam lá.

**Carga de spec e plano (B07, DEC-030).**

Em `specLoadOnce` e `planLoadOnce`, o `emit` e o `check --json` deixam de ser copiados inteiros em `S_TOOLOUT`:

- o script-runner roda `capture.mjs run` do comando e, para cada fatia, `capture.mjs slice --nonce <n> --path <arquivo> --sha <sha256> --slice <k>`, que serve o arquivo gravado e recusa se o SHA mudou;
- o workflow remonta com `joinSlices` e entrega o texto a `checkSpecLoad`/`checkPlanLoad` sem mudar essas funções;
- head, blob e porcelain, que são curtos, vêm da cauda conferida do JSON do capture.

**Revisores (DEC-024).**

`agents/task-reviewer.md` e `agents/final-reviewer.md` ganham a regra: um diff ou log de intervalo nunca é lido numa saída só do Bash. Ele vai para um arquivo em `$(git rev-parse --absolute-git-dir)/pt-evidence/review/`, ou para o pacote do `review-package.mjs`, que agora imprime `sha256` e `lines`. O revisor lê esse arquivo com Read `offset`/`limit` de até 400 linhas e cita path e sha256. No `coordinator.js` (sem braços), a linha `Diff:` da revisão final passa a usar `review-package.mjs`.

`agents/script-runner.md` passa a dizer: copie só a linha JSON impressa, e uma linha acima de 3.500 bytes é erro do comando, não do agente. O modelo continua haiku/low. `agents/test-integrity.md` passa a dizer: se o JSON impresso não vier inteiro, devolva `removedAsserts=-1`, nunca uma cópia parcial.

**Impacto de tamanho.**

- `roadmap-release.js` tem hoje 244.883 caracteres LF (247.930 bytes em disco, CRLF). O orçamento do E41 é de até +15.000 caracteres LF, para no máximo 259.883, abaixo do teto de 300.000 da DEC-003 e com mais de 40.000 de folga para E35 a E37. Em disco fica perto de 263 KB, metade do limite de lançamento de 524.288 bytes.
- `coordinator.js` tem 76.187 caracteres LF. O orçamento é de até +12.000, para no máximo 88.187, abaixo de 120.000 (subido para 88.500 pela DEC-039, depois das correções do portão T3).
- O embutido de `plan-digest.mjs` cresce cerca de 4 a 5 KB nos dois alvos.
- `size.test.mjs`: tetos não mudam (R14); a asserção de folga passa a `> 10000` (DEC-034).

## Deixado para o plano

- Dividir em dois planos, como R12 recomenda e DEC-025 permite:
  - plano A, scripts: `lib/plan-digest.mjs` com embed; `capture.mjs`; `test-extract.mjs`; `--slice` em `progress.mjs`, `preflight.mjs` e `verify-run.mjs`; `review-package.mjs`; `copy-budget.test.mjs`;
  - plano B: `coordinator.js`; `roadmap-release.js` (discovery, `readBack`, portões, teste primeiro, cargas B07, limpeza); contratos dos agentes; documentação; roteiro da sonda AC2b.
  - Cada tarefa tem até 4 arquivos.
- A lista exata de campos que a projeção de `preflight.mjs discover` remove. Um teste confere que todo `disc.<campo>` lido em `roadmap-release.js` sobrevive.
- O número de linhas da cauda e o formato do nome do arquivo em `pt-evidence`.
- Os nomes dos blocos `test(...)` e o gerador comum de fixtures, que pode ficar num helper de teste.
- O roteiro e o nome do arquivo da sonda em `tools/measure/`, e as frases exatas das mudanças em `agents/*.md`, dentro de `prose-budget.test.mjs`.

```json data
{
  "schema": "spec/1",
  "id": "E41",
  "title": "Saída de script sem recópia por LLM",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "AC1: Dado um comando de 12,7 KB (400 linhas) rodado pelo script-runner através do capture.mjs, quando o workflow recebe a resposta, então exit=0, bytes e sha256 são iguais aos da execução direta e o arquivo gravado tem 400 linhas. {verify: test; evidence: node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "AC2a (teste, G1): Dado um runner falso que corta toda resposta acima de 3.500 bytes e omite o exit code, quando o workflow lê um plano de 40 passos (cerca de 19 KB), então a leitura passa página a página no checkSigned, e com um runner falso que resume uma página só aquela página é repetida. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/slices.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "AC2b: Dado o plugin atualizado na branch de release, quando a sonda real script-runner/haiku roda 3 execuções seguidas com context-mode ligado e desligado (até US$ 1 da reserva comum, DEC-029), então todas as páginas passam na conferência e a sonda fica registrada em measurements.md. {verify: human; evidence: o dono confere a linha da sonda AC2b do E41 em measurements.md}"
    },
    {
      "id": "AC4",
      "text": "AC3: Dada uma barreira com 60 testes passando e 3 falhando, quando o workflow mede a suíte, então obtém failedNames = [FAIL_A, FAIL_B, FAIL_C] e total = 63 vindos do extrator, não de texto copiado. {verify: test; evidence: node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs}"
    },
    {
      "id": "AC5",
      "text": "AC4: Dado o implementer com um par de rodadas do mesmo comando (exit 1 e depois exit 0) e saída de 7 KB ou mais, quando o workflow confere as provas, então o par é conferido pelos JSON do capture.mjs. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/scripts/capture.test.mjs}"
    },
    {
      "id": "AC6",
      "text": "AC5: Dados capture, progress read, verify-run read e preflight discover com fixtures grandes, quando os testes percorrem as respostas, então nenhuma resposta copiada por agente passa de 3.500 bytes UTF-8, limite definido numa constante única. {verify: test; evidence: node --test plugins/productivity-tools/scripts/copy-budget.test.mjs}"
    },
    {
      "id": "AC7",
      "text": "AC6: Dado um passo isolado maior que 3 KB, quando a leitura é paginada, então ele ainda sai em fatias de até 3 KB. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/scripts/signed-output.test.mjs}"
    },
    {
      "id": "AC8",
      "text": "AC7: Dado o capture.mjs chamado em Git Bash e em PowerShell, quando recebe um caminho C:/..., então funciona e preserva o exit code do comando, e com um caminho /tmp/... falha com erro claro. {verify: test; evidence: node --test plugins/productivity-tools/scripts/capture.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "A marca {verify: test} dos critérios deve manter a evidência genérica do cartão (node --test \"plugins/productivity-tools/**/*.test.mjs\") ou citar os arquivos de teste de cada critério?",
      "decision": "Citar os arquivos de teste reais de cada critério (capture.test.mjs, slices.test.mjs, signed-output.test.mjs, test-extract.test.mjs, gates.test.mjs, gate.test.mjs, review.test.mjs, copy-budget.test.mjs, progress.test.mjs), mantendo o texto do cartão palavra por palavra; o G1 completo continua obrigatório antes de cada commit e merge.",
      "basis": "Pedido explícito no intake e questão em aberto da estratégia v1.1 ('a spec do E41 define os arquivos de teste de cada critério (refino do executor registrado como DEC)'); uma evidência por arquivo mostra o que prova cada critério e roda em segundos.",
      "alternative": "Manter a evidência genérica do cartão, que roda a suíte inteira do plugin para cada critério sem dizer qual teste prova o quê.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Onde fica a fonte única da conferência (checkSigned, checkRun, fatias, captura, SHA-256 puro e as constantes de tamanho)?",
      "decision": "Estender lib/plan-digest.mjs, que já tem canon e fnv1a, já é embutido em coordinator.js e roadmap-release.js (dentro de // <pure>, então loadPure e o call_pure do agy continuam vendo checkRun) e já é importado por progress.mjs, preflight.mjs e verify-run.mjs; o nome do arquivo não muda porque o agy-bridge.py o carrega pelo nome.",
      "basis": "DEC-058 exige módulo puro sem imports; um módulo novo não poderia usar canon/fnv1a sem duplicá-los (duas fontes do algoritmo) ou importá-los (proibido); o intake pede a conferência em lib/ embutida por embed.mjs com --check.",
      "alternative": "Módulo novo lib/script-output.mjs com cópia própria de canon/fnv1a.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como fatiar e como manter a coerência entre chamadas de fatia?",
      "decision": "Fatiar o texto do JSON canônico do payload projetado (não por campos nem por passos), com envelope assinado por fnv1a e total {bytes, sha256}; cada chamada recalcula o payload de forma determinística (now e nonce só no envelope) e o script não grava arquivo; se o SHA do total não bater ao juntar, a leitura recomeça uma vez.",
      "basis": "DEC-024 pede fatias de até 3 KB em bytes UTF-8 do JSON serializado, digest por fatia, SHA do total e retry por fatia; o prompt do script-runner manda não mudar arquivo, e progress read, discover e verify-run read são leituras baratas e determinísticas.",
      "alternative": "Gravar um instantâneo na fatia 0 e servir as demais dele (exige escrita pelo script-runner e limpeza de mais um arquivo).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "As leituras antigas por --page (READ_PAGE_CHARS, DISCOVERY_PAGE_CHARS) saem ou ficam?",
      "decision": "Ficam, sem mudança, só para os chamadores por subprocess (coordinator-agy.py e roadmap-release-agy.py); os workflows JS passam a usar só --slice.",
      "basis": "O caminho agy lê progress.mjs read --page e preflight.mjs discover --page por subprocess, sem recópia por LLM; removê-los obrigaria a mexer no agy, que o intake deixa fora de escopo salvo dependência real; manter evita a dependência.; a divergência da letra de DEC-024 foi ratificada pelo dono como DEC-033 (2026-11-23)",
      "alternative": "Remover --page e migrar também o agy para --slice.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual o tamanho de fatia e onde fica o limite de 3.500 bytes?",
      "decision": "SLICE_BYTES = 3072 (envelope serializado inteiro, em bytes UTF-8) e MAX_COPY_BYTES = 3500 como constante única em lib/plan-digest.mjs; toda resposta copiada é construída abaixo de SLICE_BYTES e o workflow recusa antes do parse um stdout copiado acima de MAX_COPY_BYTES.",
      "basis": "DEC-024 (fatias até 3 KB) e DEC-027 (invariante de 3.500 bytes por resposta copiada numa constante única); a folga de ~430 bytes absorve o que o agente acrescenta sem quebrar o invariante.",
      "alternative": "Fatias de 3.500 bytes, encostadas no limite.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como o capture.mjs recebe o comando e trata caminhos no Windows?",
      "decision": "Duas formas: '-- <programa> [args...]' com spawnSync sem shell (padrão, para os scripts node do plugin) e '--bash \"<string>\"' para comandos de shell do usuário (teste e portões), executado pelo Git Bash achado por git --exec-path ou PT_BASH; no win32 um caminho de opção que comece com uma única '/' é recusado com erro claro e saída 2.",
      "basis": "SRC-08 registrou que um caminho /tmp/... no estilo msys fez o arquivo não ser criado; no PowerShell 'bash' pode resolver para o WSL; sem shell não há reinterpretação de aspas nem do '--'.",
      "alternative": "Sempre 'bash -c' do PATH, ou converter /tmp/... para C:/... silenciosamente.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como o extrator de testes obtém exit, total, pass, fail e failedNames?",
      "decision": "Ler o stdout gravado pelo capture.mjs reconhecendo node:test TAP (# tests, not ok) e spec (ℹ tests, ✖, Node >= 23), com failedNames de nomes simples, sem repetição e ordenados, e format 'unknown' quando nada é reconhecido; o capture não injeta --test-reporter no comando do usuário.",
      "basis": "Palpite do dono no intake (TAP em arquivo e spec do Node >= 23) adotado na parte de ler os dois formatos; os comandos de teste e de portão são do usuário e podem não ser node --test, então forçar um reporter quebraria outros executores; ordenar torna o resultado determinístico sob concorrência de arquivos.",
      "alternative": "Forçar node --test --test-reporter=tap --test-reporter-destination=<arquivo> em todo comando de teste.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Nos portões do roadmap-release.js, o que acontece quando o extrator não reconhece o formato e como comparar com linhas de base antigas?",
      "decision": "O exit vem sempre do JSON conferido do capture; total, skipped e failedNames vêm do extract, e só com format 'unknown' usam os números do agente de medição; gateSubset compara nomes sem o prefixo 'arquivo::', mantendo compatíveis as linhas de base da 2.4.0 e o caminho agy.",
      "basis": "O roadmap-release é genérico (portões de qualquer projeto); sem fallback um projeto pytest ficaria sem medida; a conferência por nome do E36 lerá o extrator (DEC-030).",
      "alternative": "Tratar format 'unknown' como medida inválida (needs-operator) em portões kind 'tests'.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como mudar a conferência do teste primeiro sem quebrar o caminho agy, que chama testFirstGap(t, i, r) por call_pure?",
      "decision": "testFirstGap ganha um quarto argumento opcional {noncePrefix}: com ele (workflow JS) só conta um par de JSON do capture conferidos (exit≠0 antes de exit=0, mesmo cmdDigest, nonce no prefixo); sem ele, o comportamento atual.",
      "basis": "roadmap-release-agy.py:1524 chama testFirstGap com 3 argumentos e o implementer agy roda por subprocess sem capture; o card deixa o agy fora.",
      "alternative": "Função nova separada para o par do capture, duplicando a regra do teste primeiro.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como os revisores passam a ler diffs por caminho e SHA com offset/limit sem defasar os braços congelados de tools/measure?",
      "decision": "Pelos contratos agents/task-reviewer.md e agents/final-reviewer.md (diff ou log redirecionado para arquivo em <git-dir>/pt-evidence/review/ ou pacote do review-package.mjs, que passa a imprimir sha256 e lines, lido com Read offset/limit de até 400 linhas); as linhas de prompt dos revisores em roadmap-release.js não mudam; em coordinator.js a linha Diff: da revisão final passa a usar review-package.mjs.",
      "basis": "DEC-024 (diffs por caminho e SHA, offset/limit); .claude/rules/measure.md exige que tools/measure/arms/*-atual.md (final-review-atual.md copia 'Diff: git -C ... diff') seja igual ao workflow, e E39 mede depois do E41.",
      "alternative": "Trocar a linha Range:/Diff: dos prompts de revisão do roadmap-release.js e atualizar os braços.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "O retry em sonnet do script-runner sai neste entregável?",
      "decision": "Não: as fatias mantêm tentativas haiku, haiku, sonnet; a retirada só é proposta ao dono depois de a sonda AC2b passar, fora desta spec.",
      "basis": "Resposta do dono no intake: 'script-runner continua haiku/low; o retry com sonnet só sai depois da sonda AC2b passar'.",
      "alternative": "Remover o retry em sonnet já no E41.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Um plano ou dois?",
      "decision": "Dois planos: A (biblioteca, capture.mjs, extrator, --slice nos 3 scripts, review-package, copy-budget) e B (os dois workflows, cargas B07, contratos dos agentes, documentação e roteiro da sonda), tarefas de até 4 arquivos.",
      "basis": "DEC-025 permite plano curto (até ~15 passos) ou dois planos porque o E41 roda no coordinator da 2.4.0, que recopia a leitura inteira; as peças somam mais de 15 tarefas de até 4 arquivos; o plano A não depende de mudanças nos workflows.",
      "alternative": "Um plano só com tarefas maiores.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Quem limpa a pasta de provas e quando?",
      "decision": "capture.mjs run apaga arquivos de pt-evidence com mais de 14 dias ao começar; capture.mjs prune --task-prefix roda no fecho do plano (coordinator.js) e no estágio CLEANUP de cada entregável (roadmap-release.js); a pasta de um worktree some com ele.",
      "basis": "DEC-026 (limpeza no fecho do entregável e de arquivos com mais de 14 dias, provas fora do commit no git-dir); mesmo padrão dos marcadores de verify-run.mjs, podados no início.",
      "alternative": "Limpeza só manual pelo dono.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "O impacto de tamanho dos workflows precisa de teste novo?",
      "decision": "Não: declarar orçamento (roadmap-release.js até +15.000 caracteres LF, máximo 259.883; coordinator.js até +12.000, máximo 88.187) e manter size.test.mjs com os tetos atuais (300.000 e 120.000).",
      "basis": "DEC-003 e o risco transversal da estratégia pedem declarar o impacto em cada spec; os tetos já são verificados pelo G1.; a folga mínima da asserção de size.test.mjs é regida pela DEC-034 (> 10000, gatilho de 290.000 da DEC-003)",
      "alternative": "Teto novo e mais baixo em size.test.mjs só para o E41.",
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
      "what": "O dono confere a linha da sonda AC2b do E41 em docs/plans/roadmap-pos-2-3-0/measurements.md (3 execuções com context-mode ligado e 3 desligado, todas as páginas conferidas, custo até US$ 1).",
      "why": "AC2b é verify: human; só o dono aceita a medição paga.",
      "blocking": false,
      "workaround": "AC1, AC2a e AC3 a AC7 entram na branch com o G1 verde; o E41 fica em 'na-branch' até a conferência."
    },
    {
      "id": "H2",
      "kind": "credential",
      "what": "Sessão autenticada da conta na config descartável indicada pela variável de ambiente CLAUDE_CONFIG_DIR (D:/claude-pos23-cfg), feita pelo dono, para a sonda paga.",
      "why": "A sonda AC2b faz chamadas reais de claude -p; o login é ato do dono (DEC-012) e nunca é gravado em arquivo.",
      "blocking": false,
      "workaround": "Reusar a sessão já logada para o lote do E35, se ainda estiver ativa; sem ela, só a AC2b espera."
    }
  ],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Sonda paga AC2b: 6 execuções reais de claude -p com o plugin da branch (script-runner/haiku), teto somado de US$ 1 da reserva comum (DEC-029), registrada em measurements.md.",
      "target": "API da Anthropic pela config descartável D:/claude-pos23-cfg"
    },
    {
      "id": "X2",
      "what": "Ligar o plugin context-mode só na config descartável durante as 3 execuções com context-mode ligado e desligá-lo em seguida (a config do dono fica com ele desligado até a 2.5.0, DEC-027).",
      "target": "config descartável D:/claude-pos23-cfg"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Texto com caracteres de vários bytes e um emoji (par substituto) caindo exatamente na fronteira de uma fatia.",
      "expected": "Nenhuma fatia divide um ponto de código, todo envelope fica até 3.072 bytes UTF-8 e joinSlices devolve o texto com o mesmo sha256."
    },
    {
      "id": "C2",
      "input": "O estado muda entre a fatia 0 e a fatia 3 de uma leitura (total.sha256 diferente entre envelopes).",
      "expected": "joinSlices recusa a mistura, o workflow descarta as fatias e recomeça a leitura uma vez; nunca monta estado com fatias de leituras diferentes."
    },
    {
      "id": "C3",
      "input": "Comando de teste cujo stdout não é node:test (format 'unknown') e que sai com exit 1.",
      "expected": "O exit 1 vem do capture; no coordinator o portão não passa (falha sem nome reconhecível nunca passa); no roadmap-release total e failedNames vêm do agente de medição, marcado como fallback no resumo."
    },
    {
      "id": "C4",
      "input": "Suíte com mais nomes de falha do que cabem no orçamento do JSON do capture.",
      "expected": "extract.failedNames é cortado com failedNamesCut > 0 e a lista cortada nunca passa uma falha contra a linha de base (pede decisão)."
    },
    {
      "id": "C5",
      "input": "capture.mjs chamado no Windows com --cwd /tmp/x ou com --task contendo '/'.",
      "expected": "Sai com 2 e o JSON {tool:'capture', error} com mensagem clara; nada é executado nem gravado."
    }
  ]
}
```
