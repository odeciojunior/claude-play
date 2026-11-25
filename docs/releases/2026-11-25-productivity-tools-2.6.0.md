# Nota de atualização: productivity-tools 2.6.0

Data: 2026-11-25. Sobre a 2.5.0. Fecha o roadmap pós-2.3.0: **E36** (gate de testes com remoção declarada), **E37** (cargas e commits conferidos contra a fonte) e as correções que o lote do **E39** (nova linha de base de parada-retomada) achou no produto. Os formatos de plano, de spec, de estado e de `release.config.json` continuam compatíveis: os campos novos são opcionais. Execuções da 2.5.0 não são retomáveis (veja "Retomada" abaixo).

## O que muda

### Testes removidos de propósito (E36)

- **`removedTests`.** Spec e plano aceitam, no bloco de dados, a lista `removedTests` com `{ file, name, why, gate? }` para cada teste que o entregável apaga de propósito. `spec-tool` e `plan-tool` conferem o formato.
- **Gate aceita a queda declarada.** O subcomando novo `test-extract.mjs removed` confere cada teste declarado contra a base, o `HEAD` e a saída gravada do gate: o literal do nome existe uma vez na base como 1º argumento de `test(`/`it(`, sumiu do arquivo em `HEAD` e não roda mais. O total do gate passa a aceitar `base − n`, com `n` os testes conferidos. Teste declarado e não conferido continua derrubando o gate.
- **Revisões contra mascaramento.** Quando há remoção declarada, as revisões de plano e final conferem cada entrada contra o diff; a remoção não declarada derruba o gate pela queda do total.

### Cargas e commits conferidos contra a fonte (E37)

- **Plano congelado sem spec.** `plan-tool` ganha `--no-spec`. O `roadmap-release` usa a flag para carregar o plano já aprovado de uma retomada sem reler a spec (B06).
- **Revisão pulada só com o blob gravado.** Numa retomada, as revisões de spec e de plano só são puladas quando o blob do arquivo na carga é o mesmo gravado na aprovação (B08). Uma spec ou um plano cujo blob difere do gravado no `run.json` passa por revisão.
- **Recusas que param na hora.** A leitura em fatias para na primeira recusa. O status recusado do `roadmap.mjs` (exit diferente de 0 ou `errors` não vazio) chega ao registro com o código. O `approve` do `run-record` tem guarda de tamanho do comando (6.000).
- **Agentes.** O `script-runner` roda o comando uma única vez, com timeout de 10 min, e devolve a linha do wrapper (por exemplo a do `capture.mjs run`), nunca a saída do comando interno. `spec-author` e `plan-author` não fazem busca na pasta do plugin: o formato vem do próprio agente, dos exemplos `scripts/fixtures/spec-tool/spec.md` e `scripts/fixtures/plan-tool/plan.md` e das saídas das ferramentas.

### Correções do lote do E39

- **Sha curto no argv.** `capture.mjs slice --sha` aceita um prefixo hexadecimal de 12 a 64 caracteres, e o workflow passa só 12. O sha completo continua conferido na volta.
- **Linha curta para o implementer.** `capture.mjs run --brief` omite o `tail` da linha. A linha `CAPTURE:` do `roadmap-release` usa `--brief`. O revisor por tarefa, quando a linha não traz `tail`, é orientado a ler o arquivo em `path`.
- **Test-first conferido por script.** `capture.mjs run` grava a linha assinada de cada execução em `<seq>-line.json`, e o subcomando novo `capture.mjs pairs` decide o par vermelho-verde de uma tarefa pelo prefixo do nonce. Quando a cópia do implementer não confere, o `roadmap-release` consulta o `pairs` antes de bloquear a tarefa. O digest dessas linhas é checksum de cópia, sem segredo.
- **Implementer.** Com a linha `CAPTURE:` no prompt, o `output` de cada check é a linha impressa pelo capture, copiada inteira.

## Medições

- **E39, nova linha de base de parada-retomada:** 2 execuções válidas e integradas (a amostra caiu de 3 para 2 pelas DEC-053 e DEC-056). Limites provisórios para a 2.6.0 (DEC-060): opus 5, sonnet 11, ponderado sem haiku 420, iguais aos do pós-2.2.0. Relatório em `docs/reports/2026-11-25-E39-linha-de-base-parada-retomada.md`.
- **E37, sonda plan-only:** reprovada no critério "de primeira" (DEC-052). As correções de agente entraram nesta versão e foram reconferidas no lote do E39.

## Ainda em aberto

- **Aspa perdida pelo `script-runner` ao copiar um comando** (DEC-059): o workflow recupera na repetição. Fica para depois da 2.6.0.
- **Port agy** do `roadmap-release` não acompanha o E36, o E37 nem as correções do E39.
- **Retomada depois do merge com testes removidos.** Se uma execução parar entre o merge e o registro, a retomada (`finish-merge`) passa pelo test-integrity sem descontar os testes declarados em `removedTests` e para com `conteudo`; siga com `acceptIntegrityAlerts` depois de conferir que os alertas são só das remoções declaradas.

## Retomada

Execuções da 2.5.0 não são retomáveis com `resumeFromRunId`: lance de novo com um `runToken` novo. O extrator de testes passa a tirar o escape de `\#` e `\\` dos nomes no formato TAP; uma linha de base gravada pela 2.5.0 com teste falhando de nome com `#` ou `\` pode não casar no gate de uma execução nova, e nesse caso a linha de base deve ser refeita.

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.6.0/` existe.

## Se algo quebrar

Prefira corrigir adiante numa 2.6.x. Para reverter, a branch `volta/productivity-tools-2.6.1` (conteúdo da 2.5.0, republicado como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
