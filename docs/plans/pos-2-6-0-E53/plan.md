# Plano E53 -- Revisão final e linha de base nova de parada-retomada

Pré-condição: o merge do E49 está commitado em `release/pos-2.6.0` (`44da934`, sem `MERGE_HEAD`), com o G1 do merge passado e a contagem registrada em `docs/plans/roadmap-pos-2-6-0/log.md` (tests 2759, pass 2757, fail 0, skipped 2). Só então commitar este plano e criar o worktree a partir de `release/pos-2.6.0`, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E53 D:/projects/claude-play-wt/pos-2-6-0-E53 release/pos-2.6.0`).

Spec: `docs/plans/pos-2-6-0-E53/spec.md`. Cobre REQ-024 (#25), com as decisões DEC-003, DEC-004, DEC-005, DEC-009, DEC-015, DEC-016, DEC-017, DEC-018, DEC-019, DEC-021, DEC-033, DEC-036 e DEC-037. Caminhos de arquivo do repositório são relativos à raiz do repositório; só as pastas fora dele (worktrees, config descartável, trabalho e saída) são absolutas.

O código foi lido em `release/pos-2.6.0` com o merge do E49 aplicado na árvore. Os trechos são citados por símbolo.

## Quem faz o quê

- **Coordinator (só a Tarefa 1):** o script `tools/measure/lote-gate.mjs` e o teste dele, offline e sem gasto. A tarefa termina antes de qualquer gasto, para a revisão T3 olhar o candidato com o `lote-gate` dentro. A Tarefa 2 é a marca `external` dos efeitos pagos e do dono: **nunca é autorizada ao coordinator** e é marcada `skip` logo depois do init.
- **Orquestrador e dono (seção Fechamento, fora das tarefas):** merge, G1 a G5, revisão T3, conferência contra o E39, autorização do gasto, config e login, cada execução paga, `measurements.md`, `roadmap.config.json`, DECs e relatórios. Nada do Fechamento vai a implementer ou coordinator, salvo as correções de código pedidas pela revisão T3, que também não lançam nada pago.
- Nenhum implementer lança `claude` (headless ou não) nem `run-batch.mjs`, `run-baseline.mjs` ou `run-trigger.mjs` por linha de comando. Dentro do teste, `runBatch` só é chamado com `exec` falso.

## Testes: o que roda e quando

- Piso do G1 no merge do passo 1 do Fechamento: a contagem do merge do E49 em `docs/plans/roadmap-pos-2-6-0/log.md` (tests 2759, pass 2757) mais os N testes do `lote-gate.test.mjs`, ou seja, tests e pass não menores que 2759 + N e 2757 + N, com exit 0 e fail 0. Do passo 3 em diante, o piso é a contagem que o passo 1 registra no log.
- DEC-036: nenhum check de tarefa inclui `roadmap-release-agy.test.mjs`, `run-batch.test.mjs`, `make-scenario.test.mjs` nem o G1 completo.
- O gate de onda é do coordinator e não é repetido nos checks: `node --test "plugins/**/!(roadmap-release-agy).test.mjs" ".claude/hooks/*.test.mjs" "tools/**/!(run-batch|make-scenario).test.mjs"`.
- Cada check termina com folga abaixo de 600 s.
- DEC-037: falha isolada do teste de processos "... ended by its own port kill, with its subtree" (`verify-run.test.mjs`) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.
- Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree. Nenhuma suíte enquanto outra execução de testes corre em outro worktree.

## Tarefas

### Tarefa 1: Script de conferência do lote (lote-gate)

Cobertura: a parte do AC2 conferida por script e os casos C1 a C5. Esta tarefa entrega só o script e o teste; ela não fecha o AC2. O lote, os registros e a DEC dos limites são do Fechamento.

Arquivos: criar `tools/measure/lote-gate.mjs`; teste em `tools/measure/lote-gate.test.mjs`. Nenhum outro arquivo muda. Seguir `.claude/rules/measure.md`; no teste, montar caminhos com `node:path` e pastas temporárias (`mkdtempSync` em `tmpdir()`), nunca com barra invertida escrita à mão.

O script não lança processo nenhum, não usa a rede e não escreve arquivo. Importa `extract` e `loadPrices` de `./session-metrics.mjs` e lê `prices.json` da própria pasta.

#### Chamada e assinaturas

`node tools/measure/lote-gate.mjs --out <pasta do lote> --commit <sha do candidato> --autorizacao <DEC-NNN> --decisions <caminho de decisions.md>`

- `LIMITS = { capUsd: 18, perRunUsd: 6, reserveUsd: 5.5, validGoal: 3, invalidLimit: 2 }`, exportado, com a DEC-017 citada no comentário.
- `checkAuthorization({ decisionsText, id, commit }) -> { ok, why }`
- `costOfTranscripts(dir, { prices }) -> { usd: number|null, sessions: number, unpriced: string[], why: string|null }`, em que `dir` é a pasta que contém os `<sid>.jsonl`.
- `checkSums(runDir) -> { ok, why }`
- `gate({ out, commit, autorizacao, decisions }) -> { executions, valid, invalid, accumulatedUsd, verdict, reason, nextMaxBudgetUsd }`
- `main(argv) -> 0 | 2 | 3 | 4`, executado só quando o arquivo é o ponto de entrada.

`--commit` tem 40 hex; `--autorizacao` casa `DEC-` seguido de três ou mais dígitos; a pasta de `--out` precisa existir. Opção faltando ou desconhecida, ou valor fora disso: mensagem de uso no stderr e código 2.

#### Autorização

- A tabela é a que fica entre `<!-- roadmap:decisions -->` e `<!-- /roadmap:decisions -->`; as colunas são achadas pelo cabeçalho (`ID`, `Entregável`, `Decisão`, `Origem`, `Status`); `\|` dentro de célula não separa coluna.
- Exatamente uma linha com o ID; `Entregável` igual a `E53`; `Status` igual a `vigente`; `Origem` exatamente `dono` ou `dono (delegado, opus)`.
- A célula `Decisão` cita um token hexadecimal de 7 a 40 caracteres que é prefixo de `--commit` e o teto `US$ 18` (aceita `US$ 18,00` e `US$ 18.` com o ponto no fim de frase, sem dígito depois; não aceita `US$ 180`, `US$ 18,50` nem `US$ 18.5`).
- Arquivo ilegível, sem a tabela ou fora de qualquer regra acima: `parar`.

#### Pastas, contrato e somas

- Entram as pastas de `--out` com nome começando por `parada-retomada-`, em ordem do nome (o carimbo). `--out` vazio dá zero execuções.
- Sem `aggregate.json` legível: execução incompleta, `parar`; o custo das transcrições que existam em `private/transcripts/<k>/` é mostrado e entra no acumulado.
- Contrato: `variant` `parada-retomada`, `requested` 1, exatamente uma entrada em `attempts`, `requestedModel` `opus`, `plugin.commit` igual a `--commit`; `cli`, `superpowers` (versão e commit) e `permissionMode` iguais em todos os aggregates do lote. Qualquer desvio: `parar`.
- `checkSums`: `SHA256SUMS` presente; cada linha (`<sha256>  <caminho relativo com />`) recalculada; a lista cobre `aggregate.json` e todo arquivo sob `private/`, sem linha para arquivo ausente nem caminho que saia da pasta. Divergência: `parar`.

#### Custo

- `costOfTranscripts`: as sessões são os `<sid>.jsonl` de `dir`; chama `extract` com `root` igual à pasta mãe de `dir` e um run por sessão; o custo é a soma de `main.cost + total.cost` (`total.cost` nulo conta 0 só quando a sessão não tem agente, isto é, a soma de `total.calls` é 0). `usd` é nulo, com o motivo em `why`, quando uma sessão tem `main.cost` nulo, quando tem agente e `total.cost` nulo, quando há `unpriced`, ou quando `dir` tem uma subpasta com `subagents/` sem o `<nome>.jsonl` correspondente. Sem sessão nenhuma: `usd` 0 e `sessions` 0. O retorno não leva id de sessão nem caminho.
- Assim vale tanto para o formato do arnês (`private/transcripts/<k>/`) quanto para o formato plano das pastas do E39 (`private/transcripts/`).
- Execução válida: o custo é `attempts[0].costUsd` (ausente ou não numérico: `parar`). As transcrições dela também passam por `costOfTranscripts`: nenhuma sessão, `usd` nulo ou valor acima de 6,00 dão `parar`.
- Execução inválida ou negada: o custo é o `usd` de `costOfTranscripts`, com as sessões dadas pelos arquivos (uma negada não grava `private/attempts.json`). `usd` nulo: `parar`.
- Qual `<k>` se lê: nas válidas, inválidas e negadas, `private/transcripts/<k>/` com `<k>` = `attempts[0].n` (1 com `--runs 1`); numa pasta incompleta, sem aggregate, todas as subpastas de `private/transcripts/`, somadas.
- Quando `private/attempts.json` existe e lista uma sessão sem `<sid>.jsonl` copiado: `parar`.

#### Classificação e lista por execução

Pela única entrada de `attempts`:

| Classe | Condição | Efeito |
|---|---|---|
| `valida` | `status` `valid` e `integrated === true` | conta em `valid` |
| `valida-sem-integracao` | `status` `valid` sem integração | `parar` |
| `invalida` | `status` `invalid` ou `denied`, com sessão | conta em `invalid` |
| `invalida-sem-sessao` | `status` `invalid` ou `denied`, sem sessão (por exemplo `preflight-processo-matador`) | custo 0, `parar`, não conta em `invalid` |
| `incompleta` | sem `aggregate.json` legível | `parar` |

Outro `status`: `parar`. Cada item de `executions` traz o nome da pasta (sem caminho), a classe, o `status` e `costUsd`. Cada válida traz ainda `counters` (`haiku`, `sonnet`, `opus`, `weighted` de `counters.structural`, e `weightedNoHaiku` = `weighted` menos `haiku`, peso 1), `sessionModels`, `modelDivergence`, `caveat` e `repeatLabels`.

- `repeatLabels`: chaves de `runs[0].agents` de `private/metrics/<n>/metrics.json` (`<n>` = `attempts[0].n`) que terminam em `-retry<dígitos>`, ou em `load` seguido de 2 a 5, ou que contêm `reread`. Não usar `runs[0].roles`, que perde os dígitos (ruling R2). Arquivo ilegível ou válida sem contadores: `parar`.
- Divergência de modelo (fases `parada` e `retomada` de `sessionModels`; fase nula não conta): uma fase fora de `opus` deixa a válida com `caveat` verdadeiro; as duas fora de `opus` dão `parar`.

#### Veredito e saída

Precedência `parar` > `fechar` > `pode-seguir`; todas as execuções são avaliadas mesmo depois do primeiro motivo, e `reason` junta os motivos do veredito vencedor (`ok` no `pode-seguir`).

- `parar` (código 4): os casos acima, mais qualquer execução com custo acima de 6,00 e acumulado acima de 18,00.
- `fechar` (código 3): 3 válidas, ou `invalid` igual ou maior que 2, ou acumulado mais 5,50 acima de 18,00.
- `pode-seguir` (código 0): o resto.

As comparações são em milionésimos de dólar arredondados (6,00 exato não para; 12,50 acumulados ainda permitem a próxima; 12,51 fecham). `nextMaxBudgetUsd` é uma string com ponto e duas casas, mín(3.00, (18.00 menos o acumulado) / 2) arredondado para baixo em centavos, e `null` quando o veredito não é `pode-seguir`. A saída é um JSON de uma linha no stdout com `executions`, `valid`, `invalid`, `accumulatedUsd`, `verdict`, `reason` e `nextMaxBudgetUsd`, sem id de sessão nem caminho absoluto.

#### Teste (`lote-gate.test.mjs`)

Offline e gratuito. Um auxiliar monta à mão, em pasta temporária, a pasta de uma execução (`aggregate.json`, `private/transcripts/1/<uuid>.jsonl` mínimo com uma mensagem `assistant` com `model` e `usage`, `private/metrics/1/metrics.json`, `SHA256SUMS` calculado) e um `decisions.md` mínimo. Casos:

- Autorização: válida nas duas origens; ausente; de outro entregável; `pendente`; origem `dono (delegado, Fable)`; sem o SHA; sem o teto; teto `US$ 180`; `US$ 18.` no fim de frase (aceita); ID repetido. Cada recusa dá `parar` com `--out` vazio.
- `--out` vazio com autorização válida: `pode-seguir`, `nextMaxBudgetUsd` `3.00`, código 0.
- `SHA256SUMS` adulterado, ausente e sem cobrir um arquivo de `private/`.
- Pasta sem `aggregate.json`, com o custo das transcrições no acumulado.
- Contrato: cada campo fora (variante, `requested`, modelo, commit) e `cli`, `superpowers` ou `permissionMode` diferentes entre duas pastas.
- Negada sem `attempts.json`, com custo das transcrições; duas inválidas dão `fechar`.
- Válida sem integração; inválida sem sessão; `unpriced`; sessão com `main.cost` nulo; sessão com agente e `total.cost` nulo (`parar`); subpasta de sessão sem `.jsonl`; sessão de `attempts.json` sem transcrição.
- Custo: execução de 6,00 e de 6,01 (por `costUsd` e pelas transcrições); acumulado 12,50 (`pode-seguir`, `2.75`), 12,51 (`fechar`) e acima de 18 (`parar`); 3 válidas (`fechar`); `parar` vencendo `fechar`; arredondamento para baixo do `nextMaxBudgetUsd`.
- Divergência: uma fase (válida com `caveat`) e duas fases (`parar`).
- `repeatLabels`: `spec-load2`, `discovery-retry3` e `preflight:reread-g0` entram; `spec-load1` e `spec-load2-head` não entram.
- `main`: uso errado dá 2 (opção faltando, commit curto, `--out` inexistente); a saída é uma linha de JSON sem o id de sessão nem a pasta temporária.
- Formato real: duas pastas geradas pelo próprio `runBatch` (de `./run-batch.mjs`) com `exec` falso, uma válida e integrada e uma negada na retomada, cada uma no próprio `--out`, passadas ao `gate`: a primeira dá `valida`, `SHA256SUMS` conferido e `pode-seguir`; a segunda, `invalida` sem `attempts.json`.

O `exec` falso segue a forma do `makeFake` de `run-batch.test.mjs`, reescrito no arquivo novo (não importar o arquivo de teste): responde `claude --version`; em cada `claude -p` grava a transcrição a partir de `tools/measure/fixtures/transcripts/fab-project` num `configDir` temporário, com o modelo trocado para um id de opus; na primeira espera o abort e responde ao `git log` com o assunto de parada (`E5 T1:`) na segunda consulta; na segunda cria `feat/E5` com um commit e faz o merge em `release/sandbox` com o assunto `merge: E5 in release/sandbox` (ou devolve `permission_denials` no caso negado); repassa `git` e o extrator ao processo real; nunca repassa um comando `claude` e lança erro para qualquer `claude` cujo primeiro argumento não seja `--version` ou `-p`. O merge usa `git checkout -q -B release/sandbox main`, e todo commit e merge do falso leva `-c user.name=...` e `-c user.email=...`, como o `gitIn` e o `mergeE5` de `run-batch.test.mjs`.

A chamada é `runBatch(opts, { exec, now, ratify, listProcs })`, com mais `pending: () => assert.fail()` no segundo argumento. Em `opts`: `variant` `parada-retomada`, `runs` 1, `model` `opus`, `pollMs` 1, `permissionMode` explícito (o contrato compara o campo) e `work`, `out` e `configDir` em pasta temporária. No segundo argumento: `ratify` falso que devolve `{ ok: true, ratified: [] }` e `listProcs` que devolve lista vazia. O arquivo `<configDir>/plugins/installed_plugins.json` tem a forma `{ "version": 2, "plugins": { "productivity-tools@claude-play": [{ "version": "9.9.9", "gitCommitSha": "<40 hex>", "installPath": "<pasta temporária>" }] } }`: sem `version`, o arnês grava `unknown`; o `gitCommitSha` é o valor passado em `commit` ao `gate`.

Passos:

1. Escrever o teste e rodar `node --test tools/measure/lote-gate.test.mjs`, vendo falhar.
2. Implementar o script até o arquivo passar.
3. Rodar os checks e informar no resumo o número de testes do arquivo (entra no piso do G1). Revisão dupla normal; o commit é do coordinator, depois dos checks, só com os dois arquivos.

### Tarefa 2: Efeitos externos do lote (só orquestrador e dono)

Esta tarefa não tem trabalho de implementer, arquivo, check nem commit. Ela existe para marcar os dois efeitos externos da spec: X1 (chamadas pagas de `claude -p`, dentro do teto de US$ 18) e X2 (login na config descartável e criação do worktree destacado e das pastas fora do repositório).

- O orquestrador **não** inclui a Tarefa 2 em nenhuma autorização de efeito externo do coordinator, nem antes nem depois de H1. A H1 autoriza o orquestrador a rodar o passo 8 do Fechamento, não o coordinator a executar esta tarefa. Logo depois do init, antes do primeiro lançamento, o orquestrador aplica `progress.mjs apply <progress.json> skip --step 2 --value no-outputs`. A T2 fica `skip` e a execução chega à revisão final e ao `done`. Nunca passar `authorizeExternal`.
- Se ainda assim um agente receber esta tarefa: não rodar comando nenhum, não criar pasta, worktree ou config, não fazer login, e devolver como bloqueada, dizendo que os passos são os 6 a 8 do Fechamento.
- Autorização exigida para os efeitos: DEC de H1 vigente para o SHA do candidato, login H2 e `lote-gate.mjs` devolvendo `pode-seguir` logo antes de cada execução. A deduplicação é a pasta de saída lida pelo `lote-gate`.
- Quem a dá por feita é o orquestrador, no registro do entregável, quando o lote fecha (passos 8 a 10).

## Fechamento

Tudo daqui em diante é do orquestrador e do dono, em série, fora do coordinator. Este plano não autoriza gasto nenhum. O orquestrador não roda `env`, `printenv` nem `set`, e não lê nem imprime credenciais.

### 1. Merge do plano

- Conferir a Tarefa 1 (a Tarefa 2 fica `skip` sem saídas) e fazer o merge de `plan/pos-2-6-0-E53` em `release/pos-2.6.0`.
- G1 completo na árvore do merge, pelo Git Bash, com o worktree parado e sem outra suíte na máquina: exit 0, `fail 0`, `tests` e `pass` não menores que o piso do merge (seção Testes). Falha: desfazer o merge, salvo a DEC-037. Passando, registrar `tests`, `pass`, `fail` e `skipped` no log pelo roadmap-tracker; essa contagem é o piso do passo 3.

### 2. Candidato

- O candidato é a ponta de `release/pos-2.6.0` quando cada entregável de E42 a E52 está `na-branch`, integrado ou `descartado` no painel de `state.md`, já com o commit do `lote-gate`. Anotar o SHA completo e o curto; registrar no log pelo roadmap-tracker. Commits posteriores só de docs não movem o candidato.
- Composição a registrar: E47, E48 e E49 integrados ou não, com o efeito esperado de cada um. E49 integrado: agente `preflight-early` (sonnet medium) na parada e na retomada, retomada medindo os portões de novo; sonnet cerca de 2 maior, ponderado cerca de 40 maior e retomada mais longa que numa base sem o E49. E49 descartado: sem o agente. E48 (só com `generated: true`, que o sandbox não usa) e E47 (só `finish-merge` com testes removidos) sem efeito esperado.

### 3. G1 a G5 no candidato

Pelo orquestrador, com o worktree parado e nenhuma outra suíte na máquina.

- G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`, completo, exit 0 e `fail 0`; piso: `tests` e `pass` não menores que os registrados no log pelo passo 1, também nas rodadas refeitas depois de correção da T3.
- G2: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`, sem FAIL.
- G3: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools`, sem FAIL.
- G4: `claude plugin validate .`, válido.
- G5: `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`, alvos em dia.

### 4. Revisão final T3 (AC1)

- Subagente opus, effort high, revisão adversarial de `git diff main...<candidato>` inteiro (produto, `tools/measure` e docs de referência), com as specs de E42 a E52 e as DECs vigentes como contexto; achados em bloqueante, importante e menor, com arquivo e linha.
- Bloqueante: correção em `release/pos-2.6.0` por executor no tier da política global, G1 a G5 de novo, candidato novo, e a rodada seguinte revisa as correções e os achados abertos sobre o novo `main...<candidato>`. Terceira rodada ainda com bloqueante: parar e voltar ao delegado opus (DEC-021). Importante ou menor não corrigido entra no relatório como aceito, com o motivo.
- O orquestrador grava o texto em `docs/reports/<data>-E53-revisao-final.md`; o roadmap-tracker cita no log o caminho e o SHA revisado. O AC1 fecha com zero bloqueantes no candidato que vai ao lote.

### 5. Conferência contra o E39 (offline, antes do pedido de H1)

Na raiz do worktree de `release/pos-2.6.0`, no candidato:

```
node --input-type=module -e "import { costOfTranscripts } from './tools/measure/lote-gate.mjs'; import { loadPrices } from './tools/measure/session-metrics.mjs'; const prices = loadPrices('tools/measure/prices.json'); for (const d of ['parada-retomada-20261125-091505', 'parada-retomada-20261125-093629']) console.log(d, JSON.stringify(costOfTranscripts('D:/claude-e39-out/' + d + '/private/transcripts', { prices })))"
node -e "const f=require('fs');for(const d of ['parada-retomada-20261125-074857','parada-retomada-20261125-083658']){const r=JSON.parse(f.readFileSync('D:/claude-e39-out/'+d+'/private/metrics/1/metrics.json','utf8')).runs[0];console.log(d,(r.main.cost+r.total.cost).toFixed(4))}"
```

Esperado, a menos de um centavo de `docs/plans/roadmap-pos-2-3-0/measurements.md:10-13`: 4,3731 e 4,3386 pela função de custo; 2,9626 e 2,9756 pelo segundo comando. As pastas `074857` e `083658` não têm `private/transcripts` (visto na escrita do plano), então a função de custo não se aplica a elas: levar o fato, com os quatro valores, ao delegado opus antes do pedido de H1 (ruling R6). Valor divergente ou pasta inexistente: pergunta ao delegado opus; a conferência não é pulada.

### 6. Autorização (H1) e login (H2)

Texto do pedido, com os campos entre `< >` preenchidos pelo orquestrador:

> Pedido de autorização de gasto pago, E53. Candidato `<SHA curto>` de `release/pos-2.6.0`, com revisão final T3 sem bloqueantes e G1 a G5 verdes. Composição: E47 `<estado>`, E48 `<estado>`, E49 `<estado>`.
> Autorizar um lote da variante parada-retomada com teto de US$ 18, nas regras da DEC-017: meta de 3 válidas com `--model opus`; uma execução por vez; execução acima de US$ 6 para o lote; a seguinte só começa se o acumulado mais US$ 5,50 couber em 18; na segunda inválida o lote fecha com as válidas que houver (com 2 ou mais, limites provisórios). O `lote-gate.mjs` confere essas regras antes de cada execução.
> Projeção (ASSUMPTION da estratégia): cerca de US$ 4,4 por válida e US$ 3 por inválida. Cada sessão leva `--max-budget-usd` de no máximo 3,00 como trava adicional; o teto é garantido pela reserva.
> Conferência do cálculo de custo contra o E39: `<quatro valores e resultado>`; as execuções 1 e 2 do E39 não têm transcrições guardadas.
> Parâmetros: `--permission-mode bypassPermissions`, `--ratify between`, `--stop-on-denial`, sem `--allow`, em config descartável `D:/claude-e53-cfg`. A config do E39 foi apagada no E40: o sha256 do `settings.json` dela não está disponível.
> Responder se autoriza este candidato. Um candidato novo exige pedido novo. O login da conta na config descartável é feito pelo dono; nunca enviar token pelo chat.

- Vias: o dono, ou o delegado opus (DEC-004 com DEC-021). O roadmap-tracker registra a DEC com Entregável `E53`, Status `vigente`, Origem exatamente `dono` ou `dono (delegado, opus)` conforme a via que valeu, e a célula Decisão citando o SHA curto e o teto `US$ 18`. Sem resposta favorável, nada pago começa.
- H2: login interativo do dono na config descartável (`CLAUDE_CONFIG_DIR=D:/claude-e53-cfg claude auth login`). O token só entra se o dono o puser no ambiente por conta própria.

### Fecho parcial

Sem H1 vigente ou sem H2: o `lote-gate` e o merge do passo 1 ficam integrados. A T3 fecha o AC1 com o relatório e o SHA no log. O roadmap-tracker registra o AC2 como pendência externa do dono, e o E53 não é fechado como `na-branch`. O E54 não começa. O worktree do candidato e a pasta de saída ficam. Commit posterior em `plugins/` ou num arquivo que o `run-batch.mjs` importa exige T3 nova e H1 nova.

### 7. Preparação, sem gasto

- Worktree: `git -C D:/projects/claude-play worktree add --detach D:/claude-e53-cand <SHA do candidato>`.
- Config nova `D:/claude-e53-cfg`, sem tocar `~/.claude`: `settings.json` sem hooks nem `statusLine`, `extraKnownMarketplaces` só com a loja local do superpowers, `enabledPlugins = {}`, `env` só com `DISABLE_AUTOUPDATER` `"1"`, sem `CLAUDE.md`, plugins synced desligados; superpowers 7.0.0 no sha `bb92a77741419a4ab5f06e711a283343f1ada0c3` pela loja `D:/claude-pos23-mkt`, único plugin em `installed_plugins.json` (nenhum `productivity-tools@claude-play`); `autoUpdate` falso em `known_marketplaces.json` (ruling R8).
- Criar `D:/claude-e53-work` e `D:/claude-e53-out`.
- Anotar `claude --version`, `sha256sum D:/claude-e53-cfg/settings.json` (só o hash), a versão e o sha do superpowers; registrar o hash do E39 como indisponível.
- Conferir com a pasta de saída vazia, na raiz do worktree de `release/pos-2.6.0` (o `decisions.md` com a DEC está lá, não no worktree do candidato): `node D:/claude-e53-cand/tools/measure/lote-gate.mjs --out D:/claude-e53-out --commit <SHA> --autorizacao <DEC-NNN> --decisions docs/plans/roadmap-pos-2-6-0/decisions.md` deve devolver `pode-seguir` com `nextMaxBudgetUsd` `3.00`.

### 8. Execuções pagas (efeito externo X1; exigem H1 vigente, H2 e `pode-seguir`)

Antes da primeira execução paga, confirmar a conta que será cobrada: conferir com `claude auth status --help` que o subcomando existe na versão anotada no passo 7 (existe na 2.1.332) e rodar `CLAUDE_CONFIG_DIR=D:/claude-e53-cfg claude auth status` no mesmo shell que vai lançar. Motivo: uma chave de API herdada do shell pode passar por cima do login da config descartável. O método e a conta mostrados têm de ser os do login de H2; chave de API ou outra conta: não lançar e levar ao dono ou ao delegado opus. A saída não vai para o repositório (traz dados da conta), e o orquestrador não lista o ambiente.

Uma por vez, sem G1, outro lote ou release na máquina. Antes de cada uma:

1. `claude --version`, hash do `settings.json` e superpowers iguais aos anotados; mudou algum, o lote para.
2. `git -C D:/claude-e53-cand rev-parse HEAD` igual ao candidato e `git -C D:/claude-e53-cand status --porcelain` vazio.
3. `lote-gate.mjs` (comando do passo 7) devolvendo `pode-seguir` logo antes; `<budget>` é o `nextMaxBudgetUsd` dele. A pasta de saída é o registro do que já foi gasto: nunca relançar uma execução sem passar pelo script.

Lançamento, de dentro do worktree do candidato, com `<i>` crescente, em segundo plano e esperando o fim (a primeira linha confere que `CLAUDE_CONFIG_DIR` e `--config-dir` resolvem para o mesmo caminho; sem o prefixo na linha do `run-batch`, não lançar):

```
cd D:/claude-e53-cand
CLAUDE_CONFIG_DIR=D:/claude-e53-cfg node -e "const p=require('path'),v=process.env.CLAUDE_CONFIG_DIR;process.exit(v&&p.resolve(v)===p.resolve(process.argv[1])?0:1)" D:/claude-e53-cfg && CLAUDE_CONFIG_DIR=D:/claude-e53-cfg node tools/measure/run-batch.mjs --variant parada-retomada --runs 1 --model opus --stop-on-denial --ratify between --work D:/claude-e53-work/x<i> --out D:/claude-e53-out --config-dir D:/claude-e53-cfg --permission-mode bypassPermissions --plugin-dir D:/claude-e53-cand/plugins/productivity-tools --max-budget-usd <budget>
```

Logo depois de cada uma:

- `sha256sum -c SHA256SUMS` dentro da pasta da execução.
- `lote-gate.mjs`: `pode-seguir` libera a próxima; `fechar` encerra o lote; `parar` encerra e a saída do script vai ao delegado opus.
- Primeira execução: registrar o custo; acima de US$ 5,50, avisar o delegado antes da segunda, mesmo com `pode-seguir`.
- Com o E49 integrado, conferir `preflight-early` nas duas fases (o total tem de ser maior que o da retomada, e a retomada maior que zero): `node -e "const f=require('fs'),d=process.argv[1];for(const p of ['private/metrics/1/metrics.json','private/metrics/1/resume/metrics.json']){const a=JSON.parse(f.readFileSync(d+'/'+p,'utf8')).runs[0].agents['preflight-early'];console.log(p,a?a.calls:0)}" <pasta da execução>`.

Nenhuma regra da DEC-017 (teto 18, execução 6, reserva 5,50) muda sem o delegado opus. Total acima de 18: o E53 não fecha.

### 9. Observações e relatório

Registrar no relatório e em `measurements.md`; achado vira pendência em `state.md` pelo tracker, sem código no E53.

- (a) Nas transcrições de `private/transcripts/<k>/`: o `runToken` da retomada difere do da parada e nenhuma linha de releitura aceita na retomada tem nonce da parada.
- (b) Total do vitest (DEC-033): não observável, porque o portão do sandbox é `node --test`; a pendência continua fora do escopo.
- (c) Pendência do E51 sobre `--model` no `run-baseline.mjs`: fecha com o registro de que o roteiro não usa o `run-baseline.mjs`.
- (d) Por execução: releitura falhando, aspas perdidas em valores aspeados, válida com mais de 2 rótulos de repetição ou com `discovery-retry3` (DEC-009, DEC-015, DEC-019), incluindo os rótulos terminados em `-retry` sem número, que o script não lista. O que disparar vai ao delegado opus.

O orquestrador grava `docs/reports/<data>-E53-linha-de-base-parada-retomada.md`: candidato, composição e efeitos esperados (com o contador que mudou diferente do esperado), números por válida, custos e origem deles, ressalvas de `modelDivergence`, a nota de que o custo de CLI das inválidas não é gravado, e as observações. Sem transcrições, ids de sessão, caminhos pessoais ou valores de credencial; só pastas de saída, hashes e números.

### 10. Registros e DEC dos limites (AC2), pelo roadmap-tracker

- Criar `docs/plans/roadmap-pos-2-6-0/measurements.md` e pôr `files.measurements` = `measurements.md` em `docs/plans/roadmap-pos-2-6-0/roadmap.config.json`. Tabela de 7 colunas entre `<!-- roadmap:measurements -->` e `<!-- /roadmap:measurements -->`: `| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |`.
- Uma linha por execução: Entregável `E53`, Tipo `run`, Detalhe com pasta de saída, SHA do plugin, situação, contadores, origem do custo, ressalvas e os sha256 de `aggregate.json` e `SHA256SUMS`; Registrado `US$ <valor>`; Faturado `-`; Status `registrado`. Uma linha de fecho (Tipo `cost`) com o total do lote contra o teto de US$ 18. O checker do roadmap passa sem erro.
- DEC dos limites, proposta pelo tracker, aprovada pelo delegado opus, alcance contrato, com candidato, composição, números por válida, ressalvas e gatilhos. Com 3 válidas: opus, sonnet e ponderado sem haiku = maior valor limpo das válidas, sem margem (sonnet 12 só sem gatilho de repetição); haiku só alerta, máximo mais 5. Com 2: o mesmo, marcado provisório. Com menos de 2: sem DEC, valem os da decisão 060 do pós-2.3.0, o AC2 não fecha e o caso volta ao delegado opus. A classificação de valor limpo é do delegado.
- Fechar as pendências do E43, do vitest e do E51 conforme o passo 9, com as linhas de log e de decisões.
- AC2 pronto com pelo menos 2 válidas integradas e `SHA256SUMS` conferido, DEC registrada e `aggregate.json` e `SHA256SUMS` citados em `measurements.md`.

### 11. Depois

- No E54: `git diff --name-only <candidato> <tag> -- plugins/ tools/measure/`. Mudança em `plugins/` ou num arquivo que o `run-batch.mjs` importa invalida o lote e volta ao delegado opus; o bump de versão (manifests e `README.md`) e mudanças só em `lote-gate.mjs` e no teste dele não invalidam e vão ao delegado como registro.
- Não apagar nem deslogar `D:/claude-e53-cfg` e não apagar as pastas de saída antes da publicação.
- Sem push, tag, bump, `volta/`, cache ou comentário na #25 neste entregável.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E53",
  "title": "Revisão final e linha de base nova de parada-retomada",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Pré-condição: o merge do E49 está commitado em release/pos-2.6.0 (44da934, sem MERGE_HEAD), com o G1 do merge passado e a contagem registrada em log.md (tests 2759, pass 2757, fail 0, skipped 2). Só então commitar este plano e criar o worktree D:/projects/claude-play-wt/pos-2-6-0-E53 (branch plan/pos-2-6-0-E53) a partir de release/pos-2.6.0, antes da Tarefa 1.",
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E53; todo comando e check roda com o diretório atual na raiz dele. Caminhos de arquivo do repositório são relativos à raiz.",
    "Nenhum gasto em tarefa: o implementer não lança claude (headless ou não), run-batch.mjs, run-baseline.mjs nem run-trigger.mjs; runBatch só é chamado no teste com exec falso que nunca repassa um comando claude. Não ler nem imprimir credenciais ou variáveis de ambiente.",
    "A seção Fechamento (merge, G1 a G5, revisão T3, conferência contra o E39, autorização, login, execuções pagas, DECs, measurements.md, roadmap.config.json, relatórios) é do orquestrador e do dono; nenhum passo dela vai a implementer ou coordinator, salvo correções de código pedidas pela revisão T3, que também não lançam nada pago.",
    "A Tarefa 1 toca só tools/measure/lote-gate.mjs e tools/measure/lote-gate.test.mjs (no máximo 4 arquivos por tarefa); um commit por tarefa com arquivos, feito pelo coordinator depois dos checks; nenhum check roda depois do commit.",
    "A Tarefa 2 (external, sem commit) nunca é autorizada ao coordinator nem executada por implementer, e é marcada skip --value no-outputs logo depois do init (progress.mjs apply <progress.json> skip --step 2 --value no-outputs), sem nunca passar authorizeExternal: marca X1 e X2, que são do orquestrador e do dono nos passos 6 a 8 do Fechamento, com H1, H2 e pode-seguir do lote-gate.",
    "Não mudar plugins/, run-batch.mjs, run-baseline.mjs, session-metrics.mjs, make-scenario.mjs nem as variantes legadas do arnês (DEC-016, ruling R1 da spec).",
    "Nenhum check de tarefa inclui roadmap-release-agy.test.mjs, run-batch.test.mjs, make-scenario.test.mjs nem o G1 completo; esses e o G1 completo são do orquestrador no merge, com rollback (DEC-036). Cada check termina com folga abaixo de 600 s.",
    "Piso do G1: no merge do passo 1, tests e pass não menores que 2759 e 2757 (merge do E49 em docs/plans/roadmap-pos-2-6-0/log.md) mais os testes do lote-gate.test.mjs, com exit 0 e fail 0; do passo 3 em diante, a contagem que o passo 1 registra no log.",
    "DEC-037: falha isolada do teste de processos '... ended by its own port kill, with its subtree' (verify-run.test.mjs) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus.",
    "Nenhum commit enquanto uma suíte roda no mesmo worktree; nenhuma suíte enquanto outra execução de testes corre em outro worktree.",
    "Seguir .claude/rules/measure.md em tudo em tools/measure; --work e --out do arnês fora do repositório; nunca commitar transcrições, ids de sessão, caminhos pessoais ou private/.",
    "Windows: montar caminhos em código (node:path), sem barra invertida em argumentos de shell ou heredoc.",
    "Constantes da DEC-017 fixas no código: teto 18,00, por execução 6,00, reserva 5,50, meta de 3 válidas, fecho na 2a inválida; qualquer mudança volta ao delegado opus (DEC-004, DEC-021).",
    "Não editar nada em docs/plans/roadmap-pos-2-6-0/ nas tarefas; no Fechamento, só o roadmap-tracker edita essa pasta.",
    "Sem bump de versão, push, tag ou comentário em issue."
  ],
  "externalPatterns": [
    "run-batch[.]mjs",
    "run-baseline[.]mjs",
    "run-trigger[.]mjs",
    "claude +-p"
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Script de conferência do lote (lote-gate)",
      "deps": [],
      "files": {
        "create": [
          "tools/measure/lote-gate.mjs"
        ],
        "modify": [],
        "test": [
          "tools/measure/lote-gate.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "LIMITS = { capUsd: 18, perRunUsd: 6, reserveUsd: 5.5, validGoal: 3, invalidLimit: 2 }",
        "checkAuthorization({ decisionsText, id, commit }) -> { ok, why }",
        "costOfTranscripts(dir, { prices }) -> { usd: number|null, sessions: number, unpriced: string[], why: string|null }",
        "checkSums(runDir) -> { ok, why }",
        "gate({ out, commit, autorizacao, decisions }) -> { executions, valid, invalid, accumulatedUsd, verdict, reason, nextMaxBudgetUsd }",
        "main(argv) -> 0|2|3|4"
      ],
      "consumes": [],
      "covers": [
        "AC2",
        "C1",
        "C2",
        "C3",
        "C4",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 2,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tools/measure/lote-gate.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/session-metrics.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const f=require('fs'),s=f.readFileSync('tools/measure/lote-gate.mjs','utf8'),t=f.readFileSync('tools/measure/lote-gate.test.mjs','utf8');process.exit(['child_process','node:http','node:https','node:net','fetch(','writeFileSync'].some(x=>s.includes(x))||t.includes('defaultExec')?1:0)\"",
          "expect": "exit 0 (o script não lança processo, não usa a rede nem escreve arquivo; o teste não usa o executor real do arnês)"
        }
      ]
    },
    {
      "n": 2,
      "title": "Efeitos externos do lote (só orquestrador e dono)",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "gate({ out, commit, autorizacao, decisions }) -> { executions, valid, invalid, accumulatedUsd, verdict, reason, nextMaxBudgetUsd }"
        }
      ],
      "covers": [
        "X1",
        "X2"
      ],
      "testFirst": {
        "exempt": "passo externo do orquestrador e do dono, sem código"
      },
      "locks": [],
      "external": true,
      "externalDedupe": "lote-gate.mjs lê as pastas já gravadas em D:/claude-e53-out e a DEC de autorização vigente para o SHA; sem pode-seguir nada é lançado, e config, worktree e pastas que já existem não são recriados",
      "noCommit": true,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 2,
        "verifiability": 2
      },
      "checks": []
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "human",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "human",
      "command": null,
      "external": true,
      "externalDedupe": "antes de cada execução paga, lote-gate.mjs lê as pastas já gravadas em D:/claude-e53-out e a DEC de autorização vigente para o SHA; sem pode-seguir nada é lançado",
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como o trabalho se divide entre o coordinator e o orquestrador?",
      "decision": "Uma única tarefa de implementer (lote-gate e teste, 2 arquivos) e uma tarefa external sem arquivo, check nem commit que só marca X1 e X2, nunca é autorizada ao coordinator e é marcada skip --value no-outputs logo depois do init. Tudo o que gasta, autoriza, revisa o candidato, mede G1 a G5 ou escreve registros é descrito na seção Fechamento.",
      "basis": "O plan-tool check exige uma tarefa external para cada efeito externo da spec; a spec manda as tarefas com gasto e de registro ao orquestrador, em série. No coordinator, um passo external pendente e pronto leva a prelaunch-review e authorize, o done exige que não haja passo pendente, e o skip só vale antes da aprovação do mapa, que o primeiro lançamento faz (coordinator.js, nextAction e o evento skip); autorizado, o prompt mandaria o implementer executar o efeito. Com o skip e sem authorizeExternal, nenhum implementer gasta, e a revisão T3 vê o candidato com o lote-gate dentro.",
      "alternative": "Tarefas external que o coordinator executasse com autorização, uma por execução paga.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "De onde saem os rótulos de repetição que a spec chama de nomes de papel em metrics.json?",
      "decision": "Das chaves de runs[0].agents, com o padrão da spec ao pé da letra (-retry seguido de dígitos, load de 2 a 5, reread). Rótulos terminados em -retry sem número não são listados e entram na observação (d) do Fechamento.",
      "basis": "Em runs[0].roles os rótulos sem regra viram other: com os dígitos removidos (classifyRole em session-metrics.mjs), então load2 e retry3 não são reconhecíveis ali; runs[0].agents guarda o rótulo com os dígitos, conferido nas pastas do E39.",
      "alternative": "Ler runs[0].roles, que nunca casaria o padrão.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como tratar custo que não se pode comprovar?",
      "decision": "As transcrições também são conferidas nas válidas (sem sessão, usd nulo ou acima de 6 dão parar); main.cost nulo, total.cost nulo com agentes presentes, pasta de sessão com subagents sem o jsonl e sessão de attempts.json sem transcrição dão parar; o custo de uma pasta incompleta entra no acumulado.",
      "basis": "O caso C2 da spec vale pelo costUsd ou pelo custo das transcrições, e a spec manda parar com custo nulo numa sessão que existe; na dúvida o portão de gasto para, e o delegado decide.",
      "alternative": "Confiar no costUsd das válidas e contar 0 para sessão sem transcrição.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Quais detalhes de chamada e de leitura a spec não fixa?",
      "decision": "Commit de 40 hex e pasta de --out existente, senão código 2; decisions.md lido pela tabela entre os marcadores, colunas pelo cabeçalho, SHA curto por prefixo de pelo menos 7 hex e teto escrito US$ 18 ou US$ 18,00, aceito também com ponto de fim de frase; nextMaxBudgetUsd nulo fora de pode-seguir; comparações em milionésimos de dólar.",
      "basis": "Uma pasta de saída digitada errada não pode parecer um lote vazio e liberar gasto; sem orçamento na saída, nada se lança por engano.",
      "alternative": "Tratar pasta inexistente como lote vazio.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Que valores usar para permissionMode, --ratify e --allow?",
      "decision": "--permission-mode bypassPermissions, --ratify between e nenhum --allow; o pedido de H1 mostra os três.",
      "basis": "Lidos na escrita do plano: os quatro aggregates do E39 trazem permissionMode bypassPermissions e tentativas com ratified (vazio), sem ratify off; o comando do desenho do E31 (linhas 70 a 72) não tem --allow, o relatório do E39 não cita nenhum, e com bypassPermissions regra de permissão não é necessária.",
      "alternative": "--ratify off como no desenho do E31, que difere do que o E39 rodou.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como fazer a conferência contra o E39 se duas pastas não têm transcrições?",
      "decision": "Aplicar a função de custo às pastas 091505 e 093629; comparar 074857 e 083658 por main.cost mais total.cost do metrics.json guardado; levar a falta ao delegado opus antes do pedido de H1.",
      "basis": "Na escrita do plano, 074857 e 083658 não tinham private/transcripts; as outras duas deram 4,3731 e 4,3386 com o extract, e os metrics.json das primeiras deram 2,9626 e 2,9756. A spec manda perguntar ao delegado quando a evidência falta e não pular a conferência.",
      "alternative": "Conferir só as duas pastas com transcrições, sem perguntar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Onde o lote-gate lê a DEC, se o worktree do candidato não a contém?",
      "decision": "O script do worktree do candidato é chamado da raiz do worktree de release/pos-2.6.0, com --decisions apontando para o decisions.md de lá.",
      "basis": "A DEC de autorização cita o SHA do candidato, então é commitada depois dele; o worktree destacado precisa continuar no candidato e limpo.",
      "alternative": "Copiar a DEC para o worktree do candidato, o que o sujaria.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como montar a config descartável se a do E39 não existe mais?",
      "decision": "env só com DISABLE_AUTOUPDATER=1, sem CLAUDE.md e sem CLAUDE_CODE_SUBAGENT_MODEL, superpowers 7.0.0 (bb92a77) pela loja D:/claude-pos23-mkt, restante como no desenho do E31; o sha256 do settings.json do E39 fica registrado como indisponível e o pedido de H1 diz isso.",
      "basis": "O log do pós-2.3.0 registra que o E40 apagou a config descartável. A DEC-045 do pós-2.3.0 descreve o env da config D:/claude-pos23-cfg (ASSUMPTION: o E39 usou a mesma), e os aggregates do E39 mostram o mesmo superpowers. A spec pede o env do E39, que prevalece sobre o CLAUDE_CODE_SUBAGENT_MODEL do desenho do E31.",
      "alternative": "env do desenho do E31, com CLAUDE_CODE_SUBAGENT_MODEL sonnet.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "decision",
      "what": "Autorização do gasto pago do lote do E53, até US$ 18, com as regras da DEC-017, registrada como DEC vigente com Entregável E53, Origem exatamente dono ou dono (delegado, opus), e texto que cite o SHA curto do candidato e o teto de US$ 18. Um candidato novo exige autorização nova.",
      "why": "A estratégia lista a aprovação como pendência do dono, e .claude/rules/measure.md pede autorização explícita do dono; a DEC-004 com a DEC-021 delega gasto pago ao opus. A DEC registra qual via valeu.",
      "blocking": false,
      "workaround": "A tarefa 1, o merge, G1 a G5, a revisão T3 e a conferência contra o E39 seguem sem gasto; o lote espera a DEC."
    },
    {
      "id": "H2",
      "kind": "credential",
      "what": "Login da conta na config descartável do lote, apontada pela variável de ambiente CLAUDE_CONFIG_DIR. O padrão é o login interativo do dono; o token pela variável de ambiente CLAUDE_CODE_OAUTH_TOKEN só entra se o dono o puser no ambiente por conta própria, nunca no chat nem num comando.",
      "why": "Cada execução roda claude -p na config descartável, que precisa estar logada; a config real não pode ser usada.",
      "blocking": false,
      "workaround": "A tarefa 1 e o AC1 seguem sem credencial; o lote espera o login."
    }
  ],
  "removedTests": []
}
```
