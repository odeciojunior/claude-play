# E1 -- Ferramentas de medição e cenário fixo: desenho

Entregável E1 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, card E1). Requisitos: REQ-001, REQ-031, REQ-035. Depende de: nada. Decisões que este desenho segue: DEC-011, DEC-016, DEC-017, DEC-032, DEC-033, DEC-043, DEC-051, as decisões deste desenho ratificadas pelo dono como DEC-062 a DEC-080, e as emendas DEC-081 (comparador), DEC-082 (validade) e DEC-083 (arnês) (e DEC-034 e DEC-084, só como contexto de E15).

Escopo: só ferramentas e dados de exemplo fabricados. Nenhuma execução paga acontece aqui (são de E15), nenhuma transcrição real entra no repositório, e nenhuma versão de plugin muda (branches de entregável não mexem na versão).

## Critérios de aceite (do card, literais)

1. Dado um diretório de transcrições de exemplo, quando o extrator roda, então produz por execução e por papel as chamadas por modelo, os bytes de prompt, as rodadas de revisão, os tokens e o custo estimado, contando o uso uma vez por mensagem. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
2. Dada uma sessão de exemplo com registro de status, log de revisões e relatório final, quando o extrator classifica os papéis, então cada um sai numa linha separada. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
3. Dado o gerador de sandbox, quando ele cria o cenário, então existe um entregável com mais de uma tarefa e o roteiro de parada e retomada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs}
4. Dado o gerador de cenário, quando ele semeia os defeitos, então cada defeito do manifesto está presente no artefato semeado e a sentinela dele acusa presença. {verify: test; evidence: node --test tools/measure/make-scenario.test.mjs}
5. Dados os arquivos de `tools/measure/`, quando o teste de privacidade roda, então nenhum contém id de sessão, caminho de diretório pessoal nem texto fora dos dados fabricados. {verify: test; evidence: node --test tools/measure/session-metrics.test.mjs}
6. Dados dois conjuntos de contadores de exemplo, quando o comparador roda, então devolve piorou, não piorou ou inconclusivo por contador segundo a classe, e a queda de detecção por classe com a margem definida. {verify: test; evidence: node --test tools/measure/compare.test.mjs}
7. Dado um número de execuções e uma variante, quando o lançador em lote roda com um executor simulado, então lança esse número de execuções, chama o extrator e grava um agregado sem ids de sessão. {verify: test; evidence: node --test tools/measure/run-batch.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes.

## Visão geral

```
tools/measure/                         (só no repositório, fora do plugin publicado: DEC-032)
  session-metrics.mjs                  extrator (peça 1)
  session-metrics.test.mjs             critérios 1, 2 e 5
  prices.json                          tabela de preços datada
  make-scenario.mjs                    gerador de cenário: variantes e artefatos semeados (peças 3 e 4)
  make-scenario.test.mjs               critério 4
  scenario/                            plano fixo do coordinator, tema roteirizado do planner, evento fixo do tracker,
                                       spec e plano de E5 e código de E5 usados na semeadura
  defects/manifest.json                24 defeitos (8 de plano, 8 de código, 8 de spec) + 3 de plano acusados por código
  defects/sentinels/*.mjs              sentinelas, nunca copiadas para o sandbox
  run-batch.mjs                        lançador em lote e arnês de estágio de revisão (peças 5 e 6)
  run-batch.test.mjs                   critério 7 e testes do arnês
  arms/                                prompts do braço "atual" do revisor de spec e de plano, com teste de defasagem
  compare.mjs                          comparador (peça 6)
  compare.test.mjs                     critério 6
  fixtures/                            transcrições e agregados fabricados
  out/                                 saída padrão sugerida; ignorada pelo git
plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs (+ .test.mjs)   entregável E5 e roteiro (peça 3)
CLAUDE.md, .gitignore                                                                      peça 2
```

O código segue o projeto: ESM, Node 18+ sem dependências, identificadores e comentários em inglês, `node:test`. Todo script de `tools/measure/` exporta suas funções e só executa a CLI quando chamado diretamente (mesmo padrão de `make-sandbox.mjs`), para que os testes chamem as funções sem processo.

## Peça 1: extrator `session-metrics.mjs`

Parte de `docs/reports/2026-11-10-session-metrics/skill-runs.mjs` (dedupe por `message.id`, leitura dos agentes em `subagents/` e `subagents/workflows/wf_*/`, índice por `toolUseId`), com as correções de SRC-10, revisão 2.

CLI: `node tools/measure/session-metrics.mjs --root <raiz das transcrições> --out <pasta de saída> [--sessions <id,id,...>] [--runs <manifesto de tentativas.json>] [--prices <prices.json>]`. `--root` e `--out` são obrigatórios e sem padrão: sem eles, código de saída 2 e uso no stderr. `--out` dentro do repositório só é aceito se estiver sob `tools/measure/out/`.

Unidade "execução":

- Sem `--runs`, cada sessão principal (`<root>/<projeto>/<sessão>.jsonl`, filtrada por `--sessions` quando dado) é uma execução.
- Com `--runs` (gerado pelo lançador), uma execução é uma tentativa, que pode juntar mais de uma sessão (parada e retomada).
- A detecção heurística de janelas EXT/TURN do script antigo sai: sob o lançador, cada execução de skill é uma sessão `claude -p` própria.

Contadores por execução e por papel:

- `calls`: chamadas de agente por modelo (família: haiku, sonnet, opus, fable, other), pelo modelo dominante do agente.
- `promptBytes`: bytes UTF-8 da primeira mensagem de usuário de cada agente (o prompt despachado); o contexto principal é o papel `main`, com os bytes das mensagens humanas.
- `reviewRounds`: maior número de rodada visto por laço de revisão (`spec-review<k>`, `plan-review<k>`, `t<n>:spec<k>`, `t<n>:quality<k>`, `final<k>`), e o total de rodadas além da primeira.
- `tokens`: input, escrita de cache (5 min e 1 h separadas), leitura de cache e output.
- `cost`: estimado pela tabela de preços; modelo sem preço deixa `cost: null` e entra em `unpriced`, nunca vira zero.
- Por tarefa: número de tarefas (rótulos `E<n>:t<k>:*`) e contadores do laço de tarefas.

Uso contado uma vez por mensagem: as linhas de um mesmo `message.id` (ou `requestId`) contam uma vez, guardando a de maior `output_tokens`; mensagens `<synthetic>` são ignoradas.

Papéis (critério 2): a classificação usa o rótulo do agente de workflow (`meta.description`, sem o prefixo `E<n>:`) e nunca agrupa registro de status, progresso, log de revisões e relatório:

| Rótulo | Papel |
|---|---|
| `discovery` | discovery |
| `preflight*`, `preparar*` | preflight |
| `setup` | setup |
| `spec` / `spec-review<k>` / `spec-fix<k>` | spec / spec-review / spec-fix |
| `plan` / `plan-review<k>` / `plan-fix<k>` | plan / plan-review / plan-fix |
| `status-*` | status-record |
| `progress*` | progress |
| `review-log*` | review-log |
| `report` | report |
| `t<k>:impl`, `exec:*` | implementer |
| `t<k>:spec<r>` / `t<k>:quality<r>` | task-spec-review / task-quality-review |
| `t<k>:fix*` | task-fix |
| `final*`, `revisao-final*`, `sync*`, `test-integrity*` | final-review |
| `gates*`, `evidence*`, `suite*` | gates |
| `merge*`, `pre-merge*`, `cleanup*` | merge |
| `docs*` | docs |
| `guarda*`, `conferir*`, `commit*`, `git-truth*` | guards |
| outro rótulo de workflow | `other:<rótulo sem números>` |
| subagent fora de workflow | `agent:<agentType ou "general">` |

Saída em `--out`: `metrics.json` (execuções com papéis e contadores; traz os ids de sessão, por isso nunca é commitada) e `metrics.csv` (uma linha por execução e papel).

`prices.json`: `{ "date", "source", "models": { <família>: { "input", "output", "cacheRead" } }, "cacheWrite5m", "cacheWrite1h" }`, em dólar por milhão de tokens e multiplicadores. Os valores vêm da página oficial de preços lida na implementação (SRC-06), com a data e a URL no arquivo. Já conhecidos por SRC-10: leitura de cache a 0,05x em Opus e Sonnet 5.5 e a 0,025x em Fable; escrita de 1 hora a 2x e de 5 minutos a 1,25x; Fable a US$ 10/50. Os testes usam uma tabela fabricada em `fixtures/`, para não depender dos valores reais.

Os scripts de `docs/reports/2026-11-10-session-metrics/` ficam como estão, como registro do relatório que os usou.

## Peça 2: G1, `CLAUDE.md` e `.gitignore`

- `CLAUDE.md`: o comando de testes da seção de regras passa a `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`; o bloco Layout ganha a linha de `tools/measure/` (ferramentas de medição só do repositório, não publicadas; saídas nunca commitadas).
- `.gitignore`: `tools/measure/out/`.
- O gate canônico G1 do release (`release.config.json` e a tabela de gates da estratégia) não é tocado nesta branch: a estratégia diz que a tabela é atualizada por revisão quando E1 integrar, e a pasta do roadmap só é editada nos estágios de registro e documentação. Por isso a evidência de cada critério é o comando `{verify}` do card, que roda os testes de `tools/` diretamente.

## Peça 3: cenário fixo

### Sandbox do release (`make-sandbox.mjs`)

E1 a E4 continuam idênticos, para manter comparáveis as execuções passadas. Entram:

- **E5 -- Text utilities**: entregável de engenharia sem dependência, com três peças (`slugify(text)` em `src/slugify.mjs`, `truncate(text, max)` em `src/truncate.mjs`, `wordCount(text)` em `src/word-count.mjs`), cada uma com seu teste `tests/e5-<nome>.test.mjs` e critérios `{verify: test; ...}`. Sem efeito externo, para que a variante completa rode sem parada. Os critérios cobrem também casos que os defeitos de código exploram (acentos no `slugify`, fronteira e erro no `truncate`), sem que o teste do card os cubra todos.
- REQ-005, linha do painel, visão geral, fase e caminho crítico atualizados; a pasta continua passando no checker e no preflight sem erros.
- **Roteiro de parada e retomada** em `scenario/stop-resume.json`, na raiz do sandbox (fora da pasta do roadmap): `{ "deliverable": "E5", "first": "run E5", "stopWhen": { "branch": "feat/E5", "subjectPrefix": "E5 T1:" }, "then": "resume E5" }`. A parada é a interrupção da sessão depois do primeiro commit de tarefa; a retomada é um lançamento novo que lê o estado do git, como numa interrupção real. `makeSandbox` exporta também esse roteiro.

`make-sandbox.test.mjs` ganha os casos: E5 está no card com mais de uma peça e mais de um critério, o roteiro existe e nomeia um entregável do painel, e a pasta passa no checker e no preflight.

### Demais peças fixas (`tools/measure/scenario/`)

- `coordinator-plan.md`: plano fixo pequeno para o plan-coordinator no sandbox (três passos de funções puras), copiado para `docs/plans/2026-11-10-fixed-plan.md` do sandbox.
- `planner-theme.md`: tema roteirizado para o roadmap-planner, com as respostas da clarificação já escritas, para rodar sem pessoa.
- `tracker-event.md`: evento fixo para o roadmap-tracker sobre a pasta do sandbox (uma decisão nova e um entregável integrado).
- `e5/`: spec e plano de E5 no formato que o release reusa (receita de SRC-13: cabeçalho `**Roadmap:**`, tarefas 1..3 com arquivos, `tier`, `reviewTier`, `external: false`; seção `## Acceptance criteria evidence` com uma linha por critério e o comando do `{verify}`), e o código de E5 por tarefa.

O texto do cenário é em inglês, a língua do sandbox (`language: "en"`).

### Gerador de cenário (`make-scenario.mjs`)

`node tools/measure/make-scenario.mjs <dir> --variant <nome>` cria o sandbox (importando `makeSandbox` do plugin), aplica a variante e imprime em JSON o diretório, o prompt de lançamento e o que a variante precisa (roteiro, defeitos semeados, blobs semeados). `<dir>` precisa estar fora do repositório.

| Variante | O que monta | Prompt |
|---|---|---|
| `plan-only` | sandbox | `/productivity-tools:roadmap-release plan-only E1` |
| `completo` | sandbox | `/productivity-tools:roadmap-release run E5` |
| `parada-retomada` | sandbox + roteiro | `run E5`, parada no roteiro, depois `resume E5` |
| `coordinator` | sandbox + plano fixo | `/productivity-tools:plan-coordinator docs/plans/2026-11-10-fixed-plan.md` |
| `planner` | sandbox | tema roteirizado |
| `tracker` | sandbox | evento fixo |
| `plano-semeado-A`, `plano-semeado-B` | branch `feat/E5` com spec e plano de E5 e um commit que planta 4 defeitos no plano | `plan-only E5` |
| `codigo-semeado-A`, `codigo-semeado-B` | branch `feat/E5` com spec, plano, tarefas 1..3 commitadas com assunto `E5 T<k>: ...` e os 4 defeitos nos commits de T3 | `run E5` |
| `spec-semeado-A`, `spec-semeado-B` | branch `feat/E5` com o spec de E5 e um commit que planta 4 defeitos nele | só pelo arnês (peça 6) |
| `plano-semeado-codigo` | branch `feat/E5` com spec e plano de E5 e um commit que planta no plano os 3 defeitos `detectedBy: code` (artefato `C`) | `plan-only E5` |

Os nomes das variantes são lidos pelo lançador e pelos cards de medição (E15, E17, E11, E16, E26, E27, E13).

## Peça 4: defeitos plantados com sentinela

`defects/manifest.json`: uma entrada por defeito com `id`, `class` (`plan`, `code`, `spec`), `kind`, `artifact` (`A`, `B` ou, só para os defeitos de plano acusados por código, `C`), `file`, `sentinel` (módulo em `defects/sentinels/`), `detectedBy` (`reviewer` ou `code`) e uma descrição curta.

Plano (8, todos `detectedBy: reviewer`, conforme DEC-051): P1 tarefa sem comando de verificação; P2 comando que não existe; P3 ordem de tarefas errada; P4 evidência que não prova o critério; P5 tarefa que toca algo fora da branch declarada `external: false`; P6 `needsLock` ausente numa tarefa que roda o teste da porta `sandbox-port`; P7 tarefa que edita a pasta do roadmap; P8 `reviewTier: opus` sem raio de impacto 2. A recebe P1 a P4 e B recebe P5 a P8.

Os três defeitos de plano que o código do workflow acusa sozinho (critério sem linha de evidência, critério testável marcado como humano, comando `{verify}` trocado) ficam no manifesto como PX1 a PX3, com `detectedBy: code` e artefato `C`. Eles não entram em A nem em B: são semeados só pela variante `plano-semeado-codigo` e contados à parte, fora da taxa de captura da classe `plan` (ver desfechos abaixo, peça 5 e comparador).

Código (8): C1 critério do card não implementado com o teste do card passando; C2 teste que não afirma nada; C3 erro de fronteira com teste passando; C4 arquivo fora da lista da tarefa; C5 erro engolido; C6 teste que grava arquivo fora da pasta temporária (na raiz do repositório); C7 teste existente enfraquecido; C8 valor fixo que satisfaz o teste. A recebe C1 a C4 e B recebe C5 a C8. Os testes do repositório e os comandos de evidência continuam passando no artefato semeado, senão os gates acusariam por código.

Spec (8, da lista de bloqueios da revisão de spec do workflow): S1 critério do card ausente; S2 critério do card alterado; S3 REQ não atendido; S4 decisão autônoma que contraria uma decisão registrada do sandbox; S5 escopo fora do card; S6 dado humano inventado; S7 entrada humana marcada bloqueante sem necessidade; S8 efeito externo exigido deixado ao operador em vez de tarefa do plano. A recebe S1 a S4 e B recebe S5 a S8.

Sentinelas: cada uma exporta `present(repoDir, ref?)` e devolve `true` quando o defeito está no artefato. As de plano e de spec leem o arquivo no ref; as de código rodam uma checagem oculta contra o código do sandbox (importando o módulo ou lendo arquivos), sem nada ser copiado para o sandbox. O teste do critério 4 gera todas as variantes semeadas (A, B e `C`) e confere, para cada entrada do manifesto, sem exceção (os 27 defeitos, PX1 a PX3 incluídos), que ela é semeada por exatamente uma variante, que o arquivo do defeito mudou no commit semeado e que a sentinela acusa presença; e, no artefato limpo, que a mesma sentinela não acusa (evita sentinela que sempre diz sim). Uma entrada do manifesto que nenhuma variante semeia faz o teste falhar. Nos artefatos de código, o teste confere também que `node --test` passa no sandbox semeado.

Validade de uma tentativa (lida do diário completo do workflow, `subagents/workflows/wf_*/journal.jsonl`, porque o resumo do estágio vem truncado quando há achados, SRC-14):

- Plano semeado: o resultado de `E5:plan` tem `reused: true` e o `measuredPlanBlob` de `E5:plan-review1` é igual ao blob semeado.
- Plano semeado por código (`plano-semeado-codigo`): o resultado de `E5:plan` tem `reused: true` (a checagem do código roda sobre o plano reusado, que pode parar o estágio antes de `E5:plan-review1`).
- Código semeado: nenhum `E5:t<k>:impl` para as tarefas já commitadas, e `E5:t3:spec1` rodou.
- Spec semeado (arnês): o artefato medido pelo revisor é o blob semeado.

Fora disso a tentativa é inválida, contada à parte e repetida pelo operador.

Formato do diário (DEC-082): a checagem só dá `valid` quando encontra no diário os campos de que a regra da variante depende (o rótulo de cada entrada e, conforme a regra, o resultado de `E5:plan` com `reused`, o `measuredPlanBlob` de `E5:plan-review1`, as entradas de tarefa e de revisão, o blob medido pelo arnês). Diário ausente, linha que não é JSON, entrada sem rótulo ou campo esperado ausente fazem a tentativa sair inválida com o motivo `formato-do-diario`, nunca válida por falta de dado. O motivo fica no agregado com a contagem das inválidas, para que uma mudança de formato da CLI apareça logo na primeira tentativa.

Desfecho por defeito, numa tentativa válida, pela sentinela no fim do estágio:

- **capturado**: a sentinela não acusa mais;
- **perdido**: o estágio foi aprovado (plano aprovado ou merge feito) com a sentinela acusando;
- **indeterminado**: o estágio parou com a sentinela acusando; fica fora do denominador.

Para os defeitos `detectedBy: code` (PX1 a PX3), o desfecho vem do diário, não da sentinela, porque a checagem do código pode parar o estágio com o defeito ainda no plano: **acusado-pelo-codigo** quando o diário registra a recusa ou o achado da checagem do workflow para aquele defeito; **perdido** quando o plano foi aprovado com a sentinela acusando; **indeterminado** nos demais casos. Esses desfechos nunca entram na taxa de captura da classe `plan`.

## Peça 5: lançador em lote `run-batch.mjs`

CLI: `node tools/measure/run-batch.mjs --variant <nome> --runs <n> --work <pasta fora do repositório> --out <pasta> --config-dir <pasta de configuração do Claude Code> --permission-mode <modo> [--allow <regra>]... [--add-dir <pasta>]... [--model <modelo>] [--max-budget-usd <valor>]`.

- `--work`, `--out`, `--config-dir` e `--permission-mode` são obrigatórios e sem padrão; o modo de permissão fica registrado no agregado.
- Para cada tentativa: `make-scenario` gera o sandbox em `<work>/<variante>-<k>/`, o lançador roda `claude -p <prompt> --output-format json --permission-mode <modo> --allowedTools <regras> [--add-dir ...]` com o sandbox como diretório de trabalho e lê do JSON final `session_id`, `is_error`, `total_cost_usd` e `permission_denials`.
- Negação de permissão: `permission_denials` não vazio marca a tentativa como `negada` (a sessão negada termina com código 0, SRC-14). Ela fica fora dos contadores, é listada no agregado, e o lançador sai com código 1.
- Parada e retomada: o lançador acompanha `git log feat/E5 --format=%s` no sandbox e, quando aparece o assunto do roteiro, encerra a árvore de processos da sessão; em seguida lança o segundo passo. As duas sessões formam uma tentativa.
- Antes da primeira tentativa, o lançador registra a versão e o `gitCommitSha` de `productivity-tools@claude-play` lidos de `<config-dir>/plugins/installed_plugins.json` (`unknown`, com aviso, quando a entrada não existe), e a saída de `claude --version`.
- Depois de cada tentativa, chama o extrator com `--root <config-dir>/projects`, `--sessions` e o manifesto de tentativas; nas variantes semeadas, roda a checagem de validade e as sentinelas e grava os desfechos.
- Saída em `<out>/<variante>-<data e hora>/`: `aggregate.json` (variante, n pedido, tentativas válidas, inválidas e negadas, versão e commit do plugin, versão da CLI, modelos, data da tabela de preços, modo de permissão, contadores por tentativa numerados 1..n, por papel, mediana e faixa de custo, desfechos por defeito com o `detectedBy` de cada um, e um bloco `deteccaoPorCodigo` separado com a contagem de acusado-pelo-codigo, perdido e indeterminado por defeito PX, que não soma nos desfechos da classe `plan`) sem nenhum id de sessão, caminho pessoal ou descrição de agente; e `private/` com o manifesto de tentativas e a saída bruta do extrator, que trazem ids.
- Executor injetável: `runBatch(opts, { exec, now })`, onde `exec(cmd, args, { cwd })` devolve `{ code, stdout }`. A CLI usa `spawn`; o teste do critério 7 usa um executor simulado que grava transcrições fabricadas numa pasta de configuração temporária e devolve o JSON de `claude -p`, e confere: n lançamentos, uma chamada ao extrator por tentativa e nenhum id de sessão no agregado (busca pelos ids fabricados e pelo padrão de UUID).

## Peça 6: comparador e arnês de estágio de revisão

### Comparador `compare.mjs`

`node tools/measure/compare.mjs --before <aggregate.json> --after <aggregate.json> [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]` imprime JSON: um veredito por contador (`piorou`, `nao-piorou`, `inconclusivo`), a detecção por classe e `bloqueia` (verdadeiro se algum contador que bloqueia piorou, se a detecção de alguma classe caiu ou se a detecção de alguma classe saiu inconclusiva por faltarem tentativas válidas, DEC-081). Código de saída: 0 sem bloqueio, 1 com bloqueio, 2 erro de uso.

Classes de contador (DEC-033, detalhadas em SRC-12):

| Classe | Contadores | Piorou | Não piorou | Inconclusivo | Bloqueia |
|---|---|---|---|---|---|
| estrutural | chamadas por modelo fora do laço de tarefas e de rodadas além da primeira; total ponderado (haiku 1, sonnet 20, opus 40) | mediana depois > mediana antes | mediana depois ≤ mediana antes | algum lado sem valores; no total ponderado, também alguma chamada em família sem peso (`fable`, `other`) em algum lado (DEC-081) | sim |
| bytes | bytes de prompt dessas mesmas chamadas | mediana depois > 1,03 × mediana antes | caso contrário | algum lado sem valores | sim (o dono pode liberar com decisão registrada, DEC-033) |
| por tarefa | chamadas ponderadas do laço de tarefas divididas pelo número de tarefas | mínimo depois > máximo antes | máximo depois ≤ mínimo antes | faixas se sobrepõem | sim |
| condicional | rodadas além da primeira e chamadas de correção | separação total, como acima | idem | idem | sim |
| contexto principal | chamadas Agent por modelo pedido, bytes e turnos do contexto principal | separação total | idem | idem | sim |
| estático | bytes de prosa carregável (planner e tracker) | depois > antes | depois ≤ antes | algum lado sem valor | sim |
| custo | custo estimado | separação total | idem | idem | nunca (DEC-017) |

Contadores dinâmicos de planner e tracker (uma execução cada, DEC-016) saem como `registrado`, sem veredito.

Detecção por classe (`plan`, `code`, `spec`): taxa de captura = capturados / (capturados + perdidos). Queda = (taxa antes − taxa depois) × `--attempts`. Com queda ≥ `--margin` (padrão 6 em 40, 15 pontos), a classe `caiu` e bloqueia; abaixo, `nao-caiu`. Com menos de `--attempts` tentativas válidas em algum lado, `inconclusivo`, e a saída diz quantas faltam; esse inconclusivo bloqueia o ponto de medição (`bloqueia` verdadeiro), e o dono pode liberá-lo com decisão registrada, como já acontece com os bytes (DEC-081, DEC-033). A taxa conta só defeitos `detectedBy: reviewer`.

Família sem peso: os pesos só existem para haiku, sonnet e opus. Uma chamada em `fable` ou `other` nas tentativas de algum lado deixa o total ponderado `inconclusivo`, com a família e a contagem na saída, em vez de entrar com peso zero (DEC-081). Os contadores por família continuam com veredito próprio. Como o estrutural bloqueia só quando piora, esse inconclusivo não liga `bloqueia` sozinho; a saída o lista para o dono.

Detecção por código: a saída traz um campo `deteccaoPorCodigo` à parte, com, para cada PX, a contagem antes e depois e `regrediu` quando algum PX acusado em todas as tentativas antes aparece como perdido depois. É informativo e não entra em `bloqueia`, porque essas checagens são determinísticas e já cobertas pelos testes do workflow em G1.

O teste do critério 6 usa agregados fabricados em `fixtures/` com um caso de cada veredito por classe, um caso de queda de detecção acima e abaixo da margem, um caso de detecção inconclusiva por faltarem tentativas válidas que confere `bloqueia` verdadeiro (DEC-081), um caso com chamada em `fable` ou `other` que confere o total ponderado `inconclusivo` em vez de somado com peso zero (DEC-081), e um caso com desfechos de PX que confere que eles saem em `deteccaoPorCodigo` e não mudam a taxa da classe `plan`.

### Arnês de estágio de revisão

Modo do lançador: `run-batch.mjs --stage <spec-review|plan-review|task-review> --arm <nome> --variant <variante semeada> ...`.

- Gera no sandbox um script de workflow `review-only.js` que chama só o revisor do estágio sobre o artefato semeado e, se houver achado que bloqueia, uma rodada do corretor; depois o lançador avalia as sentinelas e aplica os mesmos desfechos da peça 4 (capturado, perdido, indeterminado).
- O script fica dentro do sandbox, que é o diretório de trabalho e portanto legível, e é lançado por caminho com `--allowedTools Workflow` (SRC-14).
- Prompts do braço `atual`: para a revisão por tarefa, `buildTaskReviewPrompt` do bloco `// <pure>` do workflow, carregado com `load-pure.mjs`; para spec e plano, cujos prompts estão embutidos fora do bloco puro, modelos em `arms/spec-review-atual.md` e `arms/plan-review-atual.md` (e os dos corretores), com um teste de defasagem que falha quando a lista de bloqueios do modelo não aparece, literal, em `roadmap-release.js`.
- Origem da cópia (DEC-083): cada modelo `arms/*-atual.md` de spec e de plano abre com uma linha `Copied from: plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js at commit <sha>`, onde `<sha>` é o commit completo (40 hex) do último commit que alterou `roadmap-release.js` quando a cópia foi tirada. O agregado do arnês registra, por estágio, `arm`, `armSource: "copia-do-prompt"` e `workflowCommit: <sha>` para os braços `atual` de spec e de plano; o braço `atual` de tarefa, carregado do próprio workflow, registra `armSource: "workflow"`. Um modelo sem essa linha faz o arnês recusar o braço (erro de uso, código 2).
- Outros braços (de E26 e E27) entram como arquivos novos em `arms/`, sem mudar o arnês.
- Os testes do arnês ficam em `run-batch.test.mjs`, com executor simulado: o script gerado é JavaScript válido, despacha só o revisor e o corretor, os desfechos saem das sentinelas, e o agregado traz `armSource` e `workflowCommit` lidos do modelo (e a recusa de um modelo sem a linha de origem).

## Privacidade (critério 5)

O teste em `session-metrics.test.mjs` percorre todo arquivo de `tools/measure/` (exceto `out/`) e falha quando encontra:

- id de sessão: UUID fora da faixa reservada às fixtures (`00000000-0000-4000-8000-xxxxxxxxxxxx`) ou id de agente `agent-a<hex>` fora da faixa fabricada `agent-afab...`;
- caminho de diretório pessoal: `C:\Users\<nome>`, `/Users/<nome>`, `/home/<nome>` (em qualquer barra ou caixa), ou um slug de projeto como `C--Users-<nome>`;
- texto fora dos dados fabricados: nas fixtures, todo campo de texto livre (texto de mensagem, prompt de agente, descrição, resultado de ferramenta) começa com `[fab]`.

O extrator e o lançador nunca gravam em `tools/measure/` fora de `out/`, que o `.gitignore` exclui.

## Testes e gates

- Critérios 1, 2 e 5: `tools/measure/session-metrics.test.mjs`, sobre transcrições fabricadas em `fixtures/` com mensagens repetidas por `message.id` (para provar a contagem única), um workflow com `status-plan`, `review-log`, `progress` e `report`, um subagent avulso e um modelo sem preço.
- Critério 3: `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` (casos novos; os atuais continuam passando).
- Critério 4: `tools/measure/make-scenario.test.mjs`.
- Critério 6: `tools/measure/compare.test.mjs`.
- Critério 7, validade e arnês: `tools/measure/run-batch.test.mjs`, com um caso de diário sem os campos esperados (e um de diário ausente) que confere a tentativa `invalid` com o motivo `formato-do-diario` (DEC-082).
- Nenhum teste chama `claude`, rede ou a pasta de configuração real; tudo roda em pastas temporárias.
- G1 (comando canônico), G2, G3 e G5 continuam verdes; o lint do plugin (G5) e a validação (G3) cobrem a mudança em `make-sandbox.mjs`. Os testes de `tools/` rodam pelos comandos `{verify}` e pelo comando novo do `CLAUDE.md`.
- Nenhum servidor nem porta: a faixa 5200-5209 não é usada.

## Riscos

- Transcrições com dados privados: só ferramentas e fixtures fabricadas no repositório; saídas com ids ficam em `out/` ou fora do repositório (critério 5).
- O agente de plano reescreve um plano semeado: a checagem de validade invalida a tentativa; a taxa de inválidas é medida em E15.
- A interrupção da sessão na parada e retomada pode cair no meio da tarefa 2: a retomada lê o estado do git e limpa a árvore (caminho de retomada do próprio release); a tentativa só é contada se a segunda sessão terminar.
- Execução sem interface com regras faltando: o lançador passa as regras por parâmetro e confere `permission_denials`. No release atual (antes de E25) o workflow é lançado por caminho a partir do cache, que no modo padrão é recusado sem a pasta legível (DEC-061); o operador escolhe o modo e as regras (`--permission-mode`, `--allow`, `--add-dir`), e o modo fica registrado.
- Lista de bloqueios do revisor muda no workflow: o teste de defasagem dos braços `atual` falha em G1 de quem roda `tools/**`.
- Pontos de medição retidos por tentativas inválidas (DEC-081, DEC-082): a detecção inconclusiva bloqueia e um diário fora do formato invalida a tentativa; o agregado mostra quantas faltam e o motivo das inválidas, e o dono libera com decisão registrada.

## Autonomous decisions (reviewable by the owner)

As decisões 1 a 19 da versão anterior deste desenho foram ratificadas pelo dono como DEC-062 a DEC-080 (vigentes em `decisions.md`), com as emendas DEC-081 (a DEC-074, comparador), DEC-082 (a DEC-073, validade) e DEC-083 (a DEC-076, arnês), já absorvidas nas peças 4 e 6; DEC-084 (a DEC-080) é só operação de E15 e não muda este desenho. Não são listadas de novo. Ficam pendentes só as decisões novas que as emendas exigiram.

Origem executor, status pendente. Alcance na última frase.

1. Os campos esperados do diário são os de que a regra de validade da variante depende (rótulo de cada entrada e, conforme a variante, `reused` de `E5:plan`, `measuredPlanBlob` de `E5:plan-review1`, as entradas de tarefa e de revisão, o blob medido pelo arnês); diário ausente, linha que não é JSON e entrada sem rótulo também dão `formato-do-diario`, e o motivo entra no agregado com a contagem das inválidas. Base: DEC-082. Custo se errada: tentativas invalidadas por um campo que a regra não usa, ou aceitas com diário quebrado. Reversível. Alcance: contrato.
2. O total ponderado inconclusivo por família sem peso não liga `bloqueia` sozinho (o estrutural bloqueia só quando piora, como os demais inconclusivos de contador); a saída lista a família e a contagem para o dono. Só o inconclusivo de detecção bloqueia, como diz DEC-081. Os contadores por família (`fable`, `other` incluídos) mantêm veredito próprio. Base: DEC-081, que trata os dois casos de forma diferente. Custo se errada: uma piora de custo estrutural escondida numa família sem peso passar sem bloqueio até o dono olhar a saída. Reversível. Alcance: contrato.
3. A origem da cópia dos braços `atual` de spec e de plano fica numa linha `Copied from: ... at commit <sha>` no topo de cada modelo de `arms/`, com o sha completo do último commit que alterou `roadmap-release.js` quando a cópia foi tirada; o agregado do arnês registra `armSource: "copia-do-prompt"` e `workflowCommit`, o braço de tarefa registra `armSource: "workflow"`, e um modelo sem a linha é recusado com código 2. Base: DEC-083. Custo se errada: trocar onde a origem é guardada. Reversível. Alcance: contrato.

## Depends on human input

- **Primeira execução real do lançador contra `claude -p`** (pago). Não bloqueia: os critérios de E1 usam executor simulado; a primeira execução real é a primeira tentativa de E15, operada pelo dono, que confere a saída e o formato real do diário (DEC-011, DEC-043, DEC-082).

Resolvido pelo dono: spec e plano de E5 ficam na versão sintética, escrita à mão na receita de SRC-13 e marcada como fixture sintética em `tools/measure/scenario/e5/`, com a opção `--from-run <pasta>` de `make-scenario.mjs` para trocá-los pelos arquivos de uma execução real aprovada, se o dono quiser.
