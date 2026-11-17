# E31: origem da correção extra em parada-retomada (desenho da medição)

Data: 2026-11-17. Branch: `design/e31` (worktree `D:/projects/claude-play-wt/e31d`, base `b1e3fe0`, que é a ponta de `release/pos-2.2.0`, árvore `plugins/` `8eae29d`). Base: card E31 da estratégia `docs/plans/2026-11-15-roadmap-pos-2-2-0.md` (REQ-004, REQ-008), DEC-004 (teto de US$ 40), DEC-006 (dono via Fable), DEC-778 e DEC-746 do roadmap anterior, S3-08 e a parte de parada-retomada da S2-17 em `docs/reports/2026-11-15-E32-triagem-backlog.md`. Este documento fixa tudo antes do lote e não gasta nada; o lote só roda depois da resposta às questões do dono (ou da recomendação via Fable, DEC-006).

## Objetivo

Achar a chamada de correção extra que a variante parada-retomada faz desde a 2.0.0 (extraRounds e fixCalls 1 na mediana em E11 e E13) e registrar estágio, agente e motivo num relatório em `docs/reports` (critério 1 do card). Depois, conforme a causa, corrigir o produto com teste (G1) ou registrar uma decisão que aceita o comportamento (critério 2).

## O que já se sabe (dados commitados, sem gasto)

As transcrições de E11 e E13 foram apagadas junto com `D:/claude-e17-cfg`. As saídas `D:/claude-e13-out` e `D:/claude-e16-out` também não existem mais. Sobram os agregados de E11 e E15 em `docs/reports/2026-11-15-e11-linha-de-base/baseline.json` e `docs/reports/2026-11-11-e15-linha-de-base/baseline.json`:

| Lote | Plugin | Variante | extraRounds/fixCalls por tentativa | Modelo da correção | `taskFixByTask` / `gateFix` | Ratificação |
|---|---|---|---|---|---|---|
| E15 | 1.6.0 | parada-retomada | 0/0, 0/0, 0/0 | - | - | `between` (padrão de então) |
| E15 | 1.6.0 | completo | 0/0, 0/0, 0/0 | - | - | - |
| E11 | 2.0.0 | parada-retomada | 2/2, 1/1, 1/1 | opus (2, 1, 1) | `{}` / 0 | `off`, `pendingAtResume` vazio nas 3 |
| E11 | 2.0.0 | completo | 1/1, 0/0, 0/0 | opus (1) | `{}` / 0 | - |
| E16 | 2.1.0 | completo | 0/0, 1/1, 0/0 (relatório) | opus | `{}` / 0 | - |
| E13 | 2.2.0 | parada-retomada | mediana 1/1 (relatório, n=3) | - | `{}` / 0 | sem registro commitado |

Leitura: a correção extra é sempre opus, fora das tarefas e dos portões. Na revisão final não houve correção: as conferências de E11 viram só `final-1-r1`, sem `final-fix`. Com isso sobram `spec-fix` ou `plan-fix`, os dois em opus no workflow (`roadmap-release.js:2254` e `:2424`); E16 anotou "mesma assinatura do estágio de spec vista em E11". O completo também faz essa correção, mas em 2 de 6 tentativas (E11 e E16). A parada-retomada fez em pelo menos 5 de 6 (3 de 3 em E11; mediana 1 em E13, logo pelo menos 2 de 3). Na 1.6.0, nenhuma das duas variantes fez.

Fatos do código lidos para este desenho:

- O arnês corta a 1ª sessão assim que `feat/E5` ganha um commit com assunto `E5 T1:` (`STOP_RESUME` em `make-sandbox.mjs:20`, consulta ao `git log` a cada 5 s em `run-batch.mjs`). Um agente que ainda estiver rodando é morto no meio do trabalho.
- Na retomada, a revisão da spec só é pulada quando `docs/plans/sandbox-E5/run.json` registra a spec aprovada com o mesmo conteúdo (`skipReview`, `roadmap-release.js:1084`; `skipRev` em `:2152`). Quando pula, o workflow grava a nota "spec review skipped: … matches". O registro é gravado pelo agente de progresso (`recAt('spec,plan')`, `:2478`), que roda antes das tarefas.
- `reviewTruth` (`roadmap-release.js`) cria um achado crítico sintético quando a árvore está suja ("dirty working tree") ou quando o intervalo tem menos commits do que o esperado. Um achado sintético basta para disparar uma correção opus e uma 2ª rodada.
- A retomada limpa arquivos não commitados com o agente `clean-<estágio>` (haiku), guarda o patch em `_tmp/E5-dirty/` e grava a nota "resume: uncommitted files from a previous run were discarded".
- O extrator conta como correção todo rótulo que casa com `/-fix\d*(-|$)/` (`session-metrics.mjs:240`). Isso inclui revisões e sondas: `merge-fix-review` (opus), `resume-fix-review` (opus) e `merge-fix-probe` (haiku), conferido com `node -e` sobre a regex. extraRounds conta só `spec-review`, `plan-review` e `final` com rodada acima de 1, somando as duas sessões.
- O custo que o arnês lê da CLI (`cliCostUsd`) vem só da sessão de retomada: a 1ª sessão é abortada e não devolve JSON. Daí os US$ 2,26 da premissa. Pelas transcrições (`prices.json`), a execução inteira custou em E11 US$ 3,37 a 3,91 nos agentes, mais cerca de US$ 0,94 na sessão principal, o que dá **≈ US$ 4,39** (o número do relatório de E11). Em E15 foram US$ 4,78.

## Hipóteses de causa

| Id | Hipótese | Assinatura esperada nas transcrições | O que a refuta |
|---|---|---|---|
| H1 | **Achado real na 1ª sessão**, sem relação com a parada: o revisor opus da spec (ou do plano) bloqueia algo que o autor escreveu, como no completo. A taxa maior seria acaso ou efeito do cenário. | `spec-review2` e `spec-fix1` (ou `plan-…`) na **1ª sessão**, antes do commit `E5 T1:`; achado vindo do revisor (não sintético) e citando card, REQ ou decisão; commit do fix mudando `spec.md`/`plan.md`. | Correção só na sessão de retomada. |
| H2 | **Revisão refeita na retomada**: o pulo por `run.json` falha (registro ausente, não persistido ou com outro hash) e a retomada revisa de novo a spec ou o plano. Uma 2ª revisão independente acha algo. | `spec-review1` (ou `plan-review1`) nas **duas** sessões; ausência da nota "spec review skipped" na retomada; correção **na retomada**; `run.json` sem `spec`/`plan` registrados no início da retomada. Liga-se à S3-08 (a retomada repete setup, progress e status-record). | Nota "skipped" presente na retomada, ou correção só na 1ª sessão. |
| H3 | **Achado sintético de estado depois do corte**: o aborto deixa árvore suja ou contagem de commits diferente do esperado, e `reviewTruth` cria um achado crítico ("dirty working tree", "fewer commits than expected") ou a carga da spec falha (`specLoadIssues`). | Correção na retomada; texto do achado igual ao sintético; agente `clean-*` ou nota "uncommitted files … discarded"; agente vivo da 1ª sessão no instante do aborto; commit do fix vazio ou sem mudança de conteúdo. | Achado da correção vindo do revisor, sem texto sintético. |
| H4 | **Sem ratificação entre as sessões** (`--ratify off`, DEC-746): uma decisão de contrato pendente leva o revisor a bloquear. | Achado citando decisão pendente ou DEC; `pendingAtResume` não vazio. | `pendingAtResume` vazio e achado sem decisão. Já fraca: vazio nas 3 de E11. |
| H5 | **Artefato de contagem do arnês**: um rótulo que não é correção conta como correção, ou a numeração da rodada continua entre as sessões. | `fixCalls` sem commit de correção; rótulo `*-fix-review` ou `*-fix-probe`; `spec-review2` sem `spec-fix1` antes. | Par `review2` + `fix1` com commit de conteúdo. |

As hipóteses não se excluem: H1 explica a taxa do completo (2 de 6), e H2 ou H3 explicariam o que a parada-retomada tem a mais. O relatório classifica **cada ocorrência**, não o lote inteiro.

## O que cada execução registra

O arnês já grava agregado, `private/attempts.json` (ids das sessões e índice da retomada), métricas por sessão e `pendingAtResume`. A leitura, sem gasto, acrescenta por execução, numa tabela do relatório:

1. **Linha do tempo de agentes por sessão**: rótulo, modelo, ordem, e se o agente está na 1ª sessão ou na retomada. A fonte são os `journal.jsonl` de `subagents/workflows/wf_*` e os `agent-*.meta.json` de cada sessão.
2. **Toda rodada acima de 1 e toda correção**: rótulo, sessão, lista de achados que a disparou (severidade, categoria, texto), se cada achado é **sintético** (texto de `reviewTruth` ou `specLoadIssues`) ou do revisor, e o commit da correção com o diff de `spec.md`/`plan.md` (vazio ou não).
3. **Notas do workflow** (`concerns` do resultado) de cada sessão, em especial "spec review skipped", "plan review skipped", "resume: uncommitted files … discarded" e "resume: review log not read".
4. **Estado no corte**: último agente iniciado e não concluído na 1ª sessão, intervalo entre o commit `E5 T1:` e o aborto, `git log feat/E5` no sandbox, conteúdo de `docs/plans/sandbox-E5/run.json` (estágios registrados) no commit da ponta antes da retomada, e o patch de `_tmp/E5-dirty/` quando existir.
5. **S3-08**: chamadas de `setup`, `progress` e `status-record` (e `clean-*`, `resume-review-log`) por sessão, com modelo e bytes.
6. **Contadores**: extraRounds, fixCalls, `piece3`, turnos do principal, haiku/sonnet/opus, ponderado sem haiku, e o custo da execução (agentes mais sessões principais, pelas transcrições) ao lado de `cliCostUsd` (só a retomada).
7. **Classificação** da ocorrência em H1 a H5 (ou "outra", com o texto), com a linha da transcrição que a sustenta (arquivo e índice da entrada).

A leitura é feita por um script no scratchpad da sessão, sem mudança em `tools/measure`. Um agente sonnet (T1) pode rodá-lo e resumir. A classificação final e o relatório ficam com o executor, como nas conferências de E11.

## Lote

- **Árvore medida:** worktree destacada da ponta de `release/pos-2.2.0` (hoje `b1e3fe0`, `plugins/` `8eae29d`) por `--plugin-dir`. É o que E33 vai publicar. A 2.2.0, onde o salto foi visto, é `d7d1c53` (`plugins/` `775a600`); ver a questão 3.
- **Config:** `D:\claude-pos22-cfg` (logada em 2026-11-17), `bypassPermissions` só na medição. Antes da 1ª execução, conferir sem gasto a versão do superpowers e a atualização automática das lojas desligada (S3-06, preparo comum com E30). Registrar a versão da CLI.
- **Comando, uma execução por invocação**, com `--work` próprio, porque o arnês nomeia o sandbox `parada-retomada-<k>` e `k` recomeça em 1 a cada invocação:

  ```
  node tools/measure/run-batch.mjs --variant parada-retomada --runs 1 --ratify off --stop-on-denial \
    --work D:/claude-e31-work/x<i> --out D:/claude-e31-out --config-dir D:/claude-pos22-cfg \
    --permission-mode bypassPermissions --plugin-dir <worktree destacada> --max-budget-usd 6
  ```

  `--ratify off` repete a condição de E11 (DEC-746) em que o salto apareceu (questão 4).
- **Número de execuções:** sequenciais, lendo a transcrição de cada uma antes da próxima.
  - **Base: até 3.** Para antes das 3 quando houver **2 ocorrências com a mesma assinatura** (mesma sessão, mesmo rótulo e mesma classe de achado). O esperado é parar em 2 ou 3.
  - **Reserva: até 2 a mais**, só na parte condicional do orçamento: quando as ocorrências tiverem assinaturas diferentes, ou para o controle na 2.2.0 se nada se reproduzir (questão 3).
  - Máximo absoluto: 5. Com a taxa vista (pelo menos 5 de 6), a chance de 3 execuções sem nenhuma ocorrência é menor que 1%, se a causa ainda estiver na árvore medida.
- **Um lote pago por vez:** nada de E30, G1 ou release rodando junto (risco transversal da estratégia, decisão 710 do roadmap anterior).

### Paradas

- **Sonda (1ª execução):** custo pelas transcrições acima de US$ 6 → parar e perguntar, porque a premissa corrigida (US$ 4,39) erraria por mais de 35%.
- **Gasto acumulado** atingir a parte firme de E31 (questão 1) com a regra de conclusão ainda aberta → parar, concluir com o que houver e não entrar na reserva sem resposta à questão 1.
- **Inválidas:** `parou-por-decisao` → parar e voltar ao dono (regra de DEC-746). A 1ª `retomada-sem-agentes`, `retomada-incompleta` ou `extrator-falhou` → parar, ler sem gasto e só seguir com a causa entendida. 2 inválidas de qualquer motivo → parar.
- **Negação de permissão:** `--stop-on-denial` encerra.
- **Gatilhos de DEC-778:** correção fora do estágio de spec, extraRounds ou fixCalls acima de 1, ou sonnet, opus ou ponderado sem haiku acima de E13 (11, 5, 420). Não param o lote (E11 já teve 2/2), mas são registrados e voltam ao dono no fechamento, via Fable (DEC-006).

## Preservação das transcrições

A config descartável `D:\claude-pos22-cfg` **não é apagada nem deslogada** antes de o relatório de E31 (e o de E30, que usa a mesma config) estar escrito, conforme a pendência de `state.md`. Logo depois de cada execução, antes da próxima:

1. Ler os ids das sessões em `D:/claude-e31-out/parada-retomada-<carimbo>/private/attempts.json`.
2. Copiar, para cada id, `D:\claude-pos22-cfg\projects\<pasta do sandbox>\<id>.jsonl` e a pasta `<id>\` inteira (`subagents\`, `workflows\wf_*\journal.jsonl`, `agent-*.meta.json`) para `D:/claude-e31-out/parada-retomada-<carimbo>/private/transcripts/<id>/`.
3. Gravar `transcripts/SHA256SUMS` (sha256 de cada arquivo copiado) e conferir que o número de arquivos bate com a origem.
4. Manter o sandbox `D:/claude-e31-work/x<i>` intacto: histórico git, `run.json` e `_tmp/E5-dirty/` são a evidência do estado no corte.

Nada disso é commitado: as transcrições têm caminhos e conteúdo da conta. O relatório cita caminho, id da sessão e índice da entrada, e transcreve só os trechos curtos que sustentam a classificação. A cópia é feita por script no scratchpad (questão 5). Apagar a config, `D:/claude-e31-out` e `D:/claude-e31-work` fica para depois de E33, como a S2-02 fez com a config anterior.

## Orçamento

- **Premissa corrigida:** os US$ 2,26 por execução da estratégia são o custo da CLI **só da sessão de retomada**. Pelas transcrições, a execução inteira custa ≈ US$ 4,39 (E11). Conta-se **US$ 5 por execução**, com margem. A premissa "revalidar na sonda de E31" fica revalidada aqui; a estratégia deve trocar o número (proposta para o tracker, não editada neste commit).
- **Teto do roadmap:** US$ 40 (DEC-004), gasto até agora US$ 0, dividido com E30.
- **Parte proposta para E31: US$ 15 firmes** (3 execuções a US$ 5), mais **reserva condicional de até US$ 10** (2 execuções). A reserva só se usa com o gasto de E30 conhecido e com a soma dos dois ainda até US$ 40. Para E30 ficam US$ 25 garantidos.
- **Projeção:** 2 execuções (causa achada cedo) ≈ US$ 8,80; 3 execuções ≈ US$ 13,20; com a reserva inteira ≈ US$ 22.
- **Medição do gasto:** soma, pelas transcrições (`prices.json`), dos agentes e das duas sessões principais de cada execução, conferida contra `cliCostUsd` da retomada. O total vai no relatório e no log do roadmap.

## Leitura da S3-08 e da S2-17

- **S3-08** ("a retomada repete setup, progress e status-record, 4 haiku a mais por execução em duas sessões; avaliar pular o registro já feito na 1ª sessão"): é custo de haiku e não entra em extraRounds nem em fixCalls. Por si só não explica a correção opus. O lote mede a repetição (item 5 do registro) sem custo extra. **Leitura:** se a repetição vier do mesmo mecanismo de H2 (a retomada não confia no `run.json` da 1ª sessão), a correção de H2 cobre as duas, e a S3-08 fecha como corrigida com o mesmo commit e um teste. Se não vier, a S3-08 segue pendente com dono executor e destino roadmap futuro, como otimização (cerca de 4 haiku por retomada), sem gasto em E31.
- **S2-17, parte de parada-retomada** ("apurar nas transcrições pagas a correção de parada-retomada"): é o próprio E31 e fecha com o relatório (critério 1). A parte de E30 segue com E30.
- **Achado deste desenho (H5):** a regex de correção do extrator conta `*-fix-review` e `*-fix-probe` como correção. Isso não muda os números de E11 (lá extraRounds = fixCalls em todas as tentativas, assinatura de laço real), mas distorce `fixCalls` em execuções que passem pela correção do merge. Vira nota de backlog do arnês (dono executor, roadmap futuro), salvo se explicar uma ocorrência do lote: aí é corrigida em E31 com teste em `session-metrics.test.mjs`.

## Regra de conclusão

Cada ocorrência é classificada em H1 a H5 pelo registro acima. O resultado do E31 é um destes:

| Resultado | Condição | Desfecho |
|---|---|---|
| **Causa achada: defeito do produto** | 2 ocorrências com a mesma assinatura, de H2 ou H3, e as outras hipóteses refutadas pelos campos registrados | Correção em `roadmap-release.js` (ou no script de registro) com teste que reproduz a retomada sem `run.json` válido ou com árvore suja, e G1 verde. Vai numa branch de E31 para `release/pos-2.2.0` quando cabe na regra de "pequena" de DEC-012 (até 3 arquivos de produto além dos testes, sem mudar formato de plano ou de estado). Maior que isso: vira pendente com dono e decisão de aceite até lá. |
| **Causa achada: defeito do arnês** | H5 | Correção em `tools/measure` com teste; relatório diz que o salto de E11 e E13 era de contagem; decisão registrada. |
| **Causa achada: não é defeito** | H1 (ou H4 com decisão pendente real) | Decisão registrada que aceita a correção como comportamento esperado do revisor (critério 2, ramo "não é"). A exceção nomeada de DEC-778 vira explicada. Qualidade do autor da spec vai como nota de roadmap futuro se o achado se repetir no mesmo ponto da spec. |
| **Causa provável (n=1)** | Só 1 ocorrência antes de o orçamento firme acabar | Mesmo desfecho da linha correspondente, marcado como n=1. Correção de produto só se o mecanismo for visível no código, com teste. Senão, decisão de aceite com revisitar quando aparecer de novo. |
| **Não reproduzida** | 0 ocorrências em 3 execuções na árvore medida | Risco do card: registrar como não reproduzida e aceitar com decisão. Se a reserva for liberada, 1 a 2 execuções de controle na 2.2.0 (`d7d1c53`) dizem se a causa sumiu entre 2.2.0 e a release (E29 ou E32) ou se era acaso. |
| **Inconclusiva** | Ocorrências com assinaturas diferentes depois da reserva, ou campos ausentes nas transcrições | Decisão de aceite com as classificações registradas. Sem gasto além do teto. O ponto aberto vai ao backlog com dono. |

Em qualquer resultado, os gatilhos de DEC-778 que dispararem voltam ao dono via Fable. Push e publicação seguem com o dono (DEC-005).

## Testes gratuitos do arnês (rodados em 2026-11-17)

`node --test tools/measure/run-batch.test.mjs tools/measure/make-scenario.test.mjs tools/measure/session-metrics.test.mjs tools/measure/baseline.test.mjs tools/measure/run-baseline.test.mjs tools/measure/checkpoint.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` na ponta `b1e3fe0`, Node v22.17.1: **396 testes, 396 pass, 0 fail**, cerca de 269 s.

Testes que cobrem o caminho deste lote:

- Duas sessões numa tentativa: `stop and resume launches two sessions in one attempt` (`run-batch.test.mjs:289`).
- Conjunto da retomada: `E17 D3: the resume set starts at the session index of the resume…` (`:1318`), `…resume session launches no agent is invalid as retomada-sem-agentes` (`:1304`), `an empty resume set is retomada-sem-agentes…` (`:1334`).
- `--ratify off`: `E11 parseCli accepts --ratify between|off` (`:3377`), `…with --ratify off the ratify function is not called… pendingAtResume is recorded` (`:3404`), `…stops for a pending decision is parou-por-decisao…` (`:3431`), `…no agent launched on resume is parou-por-decisao…` (`:3494`), `…unreadable pending list is pendencias-ilegiveis` (`:3508`).
- Negação de permissão: `stopOnDenial stops the batch at the first denied attempt` (`:878`).
- Cenário: `sandbox: the stop and resume script names a deliverable of the panel` (`make-sandbox.test.mjs:114`). Plano `e11` com `ratify off` em `run-baseline.test.mjs:477`.

Nenhum teste cobre a regex de correção do extrator contra `*-fix-review` (H5). Esse teste entra só se H5 for a causa.

## Questões do dono

Nenhuma trava o desenho. Sem resposta, vale a recomendação, por DEC-006.

1. **Parte do orçamento de E31.** (a) US$ 15 firmes mais reserva condicional de US$ 10, com E30 em US$ 25 garantidos. (b) US$ 10 firmes (2 execuções), deixando 30 para E30; arrisca terminar em "causa provável (n=1)". (c) US$ 22 firmes (5 execuções); E30 fica com 18, provavelmente pouco para 20 válidas com revisor opus. **Recomendo (a).**
2. **Ordem dos lotes.** (a) E31 antes de E30: lote pequeno e limitado, e o gasto de E31 fica conhecido antes do lote maior. (b) E30 antes, como em `state.md`. **Recomendo (a)**; nenhum dos dois depende do outro.
3. **Árvore medida.** (a) Ponta de `release/pos-2.2.0` (o que será publicado), com controle na 2.2.0 só se nada se reproduzir. (b) Só a 2.2.0 `d7d1c53`, onde o salto foi visto. (c) As duas desde o início (dobra o custo). **Recomendo (a)**: E29 e E32 não tocam no estágio de spec, e uma correção precisa partir da release.
4. **Ratificação entre as sessões.** (a) `--ratify off`, como E11 (DEC-746). (b) `between`, como E15. **Recomendo (a)**: repete a condição observada; H4 é medida por `pendingAtResume` sem precisar de outro braço.
5. **Preservação.** (a) Cópia por script depois de cada execução, com `SHA256SUMS`, sem mudar `tools/measure`. (b) Opção nova `--keep-transcripts` no `run-batch.mjs` com teste (um ciclo de código antes do lote). **Recomendo (a)**: a config não é apagada até os relatórios, então a cópia é segurança extra e não precisa de código.
6. **Confirmação paga depois de uma correção de produto.** (a) Só G1, como pede o critério 2. (b) 1 execução da reserva depois da correção, para ver o salto sumir. **Recomendo (a)**, com (b) só se a reserva sobrar depois de E30.

## Riscos

- O salto não se reproduz na release: coberto por "não reproduzida" e pelo controle opcional na 2.2.0.
- O corte acontece num ponto diferente a cada execução (consulta a cada 5 s), e as assinaturas variam: o item 4 do registro guarda o estado no corte, e a reserva cobre até 2 execuções a mais.
- Config apagada antes da leitura: proibido por este desenho e pela pendência de `state.md`. A cópia com SHA256SUMS protege contra isso.
- Custo acima do previsto: parada da sonda em US$ 6 e parte firme fixada antes.
