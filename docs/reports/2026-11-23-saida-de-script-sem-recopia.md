# Saída de script sem recópia por LLM no productivity-tools

Data: 2026-11-23. Relatório de diagnóstico (fonte do entregável E41 do roadmap pós-2.3.0).

## Contexto
- Repositório: `D:\projects\claude-play`, branch `release/pos-2.3.0`, plugin `plugins/productivity-tools` (v2.4.0). Cópia instalada em `C:\Users\odeci\.claude\plugins\cache\claude-play\productivity-tools\2.4.0`.
- Os workflows `plan-coordinator` (`skills/plan-coordinator/workflow/coordinator.js`) e `roadmap-release` (`skills/roadmap-release/workflow/roadmap-release.js`) não rodam comandos sozinhos. Eles despacham o agente `productivity-tools:script-runner` (só Bash, `omitClaudeMd: true`, haiku/low, com retry em haiku → haiku → sonnet). O contrato do agente diz: "devolva o exit code e o stdout completo, literal". Depois o workflow confere a cópia no código.
- Em 2026-11-23 desativei o plugin context-mode, porque ele cortava saídas acima de ~3,9 KB. Mas os testes mostraram que **o problema de fundo independe dele**: um modelo de linguagem recopiando a saída de um script não é um canal confiável.

## Evidências (testes de 2026-11-23, Node 26.13.1)
Fixtures e resultados preservados fora do repositório em `D:/claude-pos23-out/cm-tests/`.
1. **script-runner, saída bem-sucedida de 12,7 KB, com context-mode:** voltaram 4 ou 5 de 400 linhas e **sem o exit code**. Sem context-mode: 400 linhas e `exit=0`.
2. **script-runner, suíte `node --test` com 3 falhas (10 KB, exit 1):** voltou inteira. O context-mode não corta chamadas que falham.
3. **Leitura assinada `progress.mjs read --nonce N1 --json` (19,4 KB) via script-runner** (pasta `progress\`, com `plan.md` sintético, `check.mjs` e os resultados):
   - Lida direto: o JSON passa no `checkSigned`.
   - Com context-mode: o JSON chegou quebrado, a verificação falhou, e o retry repete o mesmo corte.
   - **Sem corte** (`CTX_REPLACE_TRIGGER_BYTES=65536`): o subagent **resumiu os passos 2 a 37** ao recopiar ("... (steps 2 to 37 follow the same pattern ...)"). O digest continuou intacto e a verificação falhou do mesmo jeito.
   - Execução única, passando por dois agentes até o arquivo. Isso precisa ser reproduzido.
4. **implementer (testes primeiro):** a rodada que passa (7,4 KB, exit 0) veio cortada e sem exit code. O agente recuperou os totais por outro caminho e fechou como `DONE_WITH_CONCERNS`. As regras dele proíbem `| tail`, então ele só via o corte.
5. **task-reviewer, diff de 74 KB:** o `git log -p` foi cortado, mas o agente se adaptou com comandos menores e achou o defeito plantado. **final-reviewer:** achou o defeito sem sofrer corte. Os dois passaram, mas dependem de o modelo se adaptar.
6. A resposta final de um subagent para o workflow **não** é cortada. O problema está na saída do Bash que o agente recebe e no que ele recopia.

## O problema, em detalhes
O padrão atual é: script → stdout → **o modelo recopia** → o workflow confere (tool, nonce, digest). Ele falha de três formas:
1. **Truncamento por ferramenta** (o context-mode, ou qualquer limite de saída do harness): a cópia chega incompleta, sem exit code, e a conferência falha de forma segura. Mas o retry recebe o mesmo corte, então o workflow trava ou gasta tokens sem avançar.
2. **Recópia lossy pelo modelo:** em saídas grandes (~19 KB), o modelo abrevia, reformata ou resume, mesmo instruído a ser literal. A conferência por digest detecta, mas não corrige. Haiku com effort low é o pior caso, e o retry com sonnet só reduz a chance.
3. **Prova de sucesso frágil:** barreiras e testes primeiro dependem do exit code e da linha de totais de uma rodada que **passa**. É justamente a saída de sucesso que se perde, porque as falhas passam inteiras.

Pontos do código afetados (números de linha da 2.3.0/2.4.0, conferir):
- `coordinator.js`:
  - `runPrompt` (~L1095) e a chamada ao script-runner (~L1101).
  - `checkSigned` (~L868), `canon` (~L792-800) e `fnv1a` (~L803-810).
  - `runTest`, `failedTestNames` (lê `not ok N - nome` / `✖ nome`), `waveGatePasses` ("falha sem nome reconhecível nunca passa") e `ensureBaseline` (`tailOf(out.stdout)`).
- `scripts/progress.mjs`: `READ_PAGE_CHARS = 20000` (~L88). As páginas têm ~5 vezes o tamanho seguro.
- `roadmap-release.js`:
  - `checkRun` (~L1277), `runPrompt` (~L1459) e o read-back do `verify-run.mjs read` (~L1463-1471, até 8000 caracteres).
  - O discovery do `preflight.mjs discover` (~L1477-1488).
  - O grupo do plano (~L1795-1815).
  - As barreiras `S_MEASURE` / `gateOnce` (~L1725-1736): um agente geral mede `total`, `skipped` e `failedNames` a partir de saída de teste.
- `agents/script-runner.md`, `agents/implementer.md` (~L43-46: "output quotes the real output verbatim", sem pipe) e `agents/test-integrity.md`.
- Os revisores (`task-reviewer`, `final-reviewer`) leem `git log -p`/`git diff` inteiros, e a `review-package` grava o diff num arquivo que é lido de uma vez.

## Restrição de desenho (confirmada)
- O script de workflow (JS de orquestração com `agent()`/`parallel()`) **não tem acesso ao sistema de arquivos nem a processos**: a referência oficial de autoria de workflows diz "No filesystem or Node.js API access" (confirmado em 2026-11-23). Por isso existe o script-runner: todo conteúdo que o workflow precisa ainda passa por um agente.
- `agent()` com `schema` devolve o objeto validado na chamada da ferramenta StructuredOutput; a resposta final de um subagent não é cortada (evidência 6).
- O objetivo é **diminuir e verificar o que o agente copia**, e não eliminar a cópia.

## Recomendações
1. **Captura por script, não por modelo.** Criar um `scripts/capture.mjs` que:
   - roda o comando e grava stdout e stderr em arquivo;
   - imprime um JSON **compacto (bem abaixo de 3 KB)**: `{tool:"capture", nonce, exit, bytes, sha256, path, lines, tail: <últimas N linhas, limitadas>}`.
   - O script-runner passa a rodar `node capture.mjs --nonce <n> -- <cmd>` e copia só esse JSON. O exit code passa a vir do script, não da memória do modelo.
2. **Paginar o conteúdo que o workflow precisa em blocos de até ~3 KB.** Isso vale para o `progress.mjs read`, o `verify-run.mjs read` e o `preflight.mjs discover`:
   - Cada página leva o seu próprio `digest`, e o `checkSigned`/`checkRun` confere página por página.
   - Baixar o `READ_PAGE_CHARS` (hoje 20000) para ~3000.
   - Retry por página, e não do documento inteiro.
3. **Barreiras de teste a partir de dados estruturados.**
   - O `runTest` passa pelo `capture.mjs` com um extrator determinístico que imprime `{exit, total, pass, fail, failedNames[]}`, lido de um reporter TAP/JSON gravado em arquivo.
   - Isso elimina o `failedTestNames` lendo texto copiado pelo modelo, e o `S_MEASURE` deixa de "medir" por um modelo.
4. **Provas do implementer em arquivo.** As rodadas de "falha" e "passa" vão pelo `capture.mjs`. O relatório cita `path`, `sha256`, `exit` e a linha de totais, e o workflow confere o par (mesmo comando, exit≠0 e depois exit=0) pelos campos do JSON. Revogar a regra que proíbe `| tail`, ou torná-la desnecessária.
5. **Revisores:** ler o diff do arquivo da `review-package` com `offset`/`limit` (paginado), nunca num Read só nem num `git log -p` inteiro. Pôr isso explicitamente nas instruções dos agentes.
6. **Compatibilidade com cortes de ferramenta:** **nenhuma resposta de ferramenta que o modelo precise copiar deve passar de ~3,5 KB.** Vira critério de aceite, para que religar o context-mode ou mudar o harness não quebre nada.

## Decisões em aberto (para o dono)
1. **Conteúdo grande:** (a) páginas de ≤3 KB mais o arquivo para auditoria (recomendado), (b) só o resumo compacto com os campos usados, ou (c) só arquivo e SHA, com o caminho repassado ao próximo agente.
2. **Escopo:** uma spec só, com o plano dividido por componente (recomendado), ou duas specs (primeiro runner e workflows, depois implementer e barreiras).
3. **Onde ficam as provas:** `<gitdir>/pt-evidence/<tarefa>/`, fora do commit e acompanhando o worktree (recomendado), a pasta temporária do sistema, ou uma pasta versionada em `docs/plans/<topico>/evidence/`.
4. **Compatibilidade com context-mode ligado:** requisito, com teste (recomendado), ou ignorar.
5. **Versão:** 2.5.0, porque é contrato interno do plugin (recomendado), ou 3.0.0.

## Pontos a revisar
- **Compatibilidade da conferência:** `canon`/`fnv1a`/`checkSigned` em `coordinator.js` e `checkRun` em `roadmap-release.js` precisam aceitar páginas e o JSON do `capture.mjs`. As duas implementações devem compartilhar uma única fonte (hoje cada uma tem a sua cópia).
- **Retomada:** os workflows aceitam `resumeFromRunId`. Mudar o formato da resposta do runner pode invalidar o cache de execuções antigas, e isso precisa ser documentado.
- **Windows:** `capture.mjs` tem que funcionar em Git Bash e PowerShell, com caminhos `C:/...`. Num teste, um caminho `/tmp/...` no estilo msys fez o arquivo de saída não ser criado. Atenção também a aspas e ao `--` do comando.
- **Segredos:** a saída gravada em arquivo pode conter tokens. Definir a retenção e a limpeza da pasta de provas.
- **Limite de páginas:** um documento muito grande vira muitas chamadas de agente. Avaliar o custo e se há páginas que o workflow pode pular.
- **Testes do próprio plugin:** atualizar os de `progress.test.mjs`, do `make-sandbox`, e os que validam o formato do `S_RUN`.
- **Modelo e esforço:** com o JSON compacto, haiku/low basta, e o retry com sonnet pode sair.
- **Mudança de contrato dos agentes:** revisar `script-runner.md`, `implementer.md`, `test-integrity.md`, `task-reviewer.md` e `final-reviewer.md`, e as skills `subagent-driven-development` e `verification-before-completion` do superpowers onde elas assumem a saída completa.

## Critérios de aceite sugeridos (cada um com um teste)
1. script-runner com um comando de 12,7 KB (400 linhas): o workflow recebe `exit=0`, `bytes` e `sha256` iguais aos da execução direta, e o arquivo tem 400 linhas.
2. `progress.mjs read` de um plano com 40 passos (~19 KB): todas as páginas passam no `checkSigned` via script-runner/haiku, em 3 execuções seguidas, com o context-mode **ligado** e **desligado**.
3. Barreira com 60 testes passando e 3 falhando: o workflow obtém `failedNames = [FAIL_A, FAIL_B, FAIL_C]` e `total = 63` do extrator, não de texto copiado.
4. implementer: o par de rodadas (exit 1 e depois exit 0 do mesmo comando) é conferido pelos JSON do `capture.mjs`, com a saída de 7 KB ou mais.
5. Nenhuma resposta de ferramenta copiada por um agente passa de 3,5 KB (verificado nos testes do plugin).

Fixtures que podem ser reaproveitados (na pasta `cm-tests`): `suite\big.test.js`, `review-repo\` (diff de 74 KB com o defeito `divide` no fim), `impl-repo\`, `progress\plan.md` e `progress\check.mjs`.
