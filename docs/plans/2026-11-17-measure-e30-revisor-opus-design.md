# E30: revisor por tarefa sonnet contra opus e destino do laço quality

Data: 2026-11-17. Branch: `design/e30` (worktree `D:/projects/claude-play-wt/e30d`, base `b1e3fe0` de `release/pos-2.2.0`). Revisão 1, sem ratificação. Base: card E30 da estratégia `docs/plans/2026-11-15-roadmap-pos-2-2-0.md` (REQ-002, REQ-003, REQ-008), DEC-004 (teto de US$ 40), DEC-006 (decisão do dono via Fable), DEC-010 (braço `unica` na cópia congelada), DEC-019 e DEC-020; do roadmap anterior, as decisões 704, 705, 737, 741, 747, 749, 753, 773 e 777. Molde: `docs/plans/2026-11-15-measure-e27-passada-c-design.md` (passada C) e o relatório `docs/reports/2026-11-15-E27-passada-C.md`. Este documento só desenha o lote. Não roda nada pago e não muda código.

## Objetivo

Duas decisões de política, com a regra fixada antes do lote:

1. **Modelo do revisor por tarefa.** Hoje `reviewModelFor(t)` (`roadmap-release.js:429`) devolve `sonnet`, salvo tarefa com rota opus ou externa. A pergunta é se o revisor opus, nos dois laços do produto (`spec` e depois `quality`), captura nas sementes `lentes-semeadas-A/B` da passada C o bastante para justificar o custo.
2. **Destino do laço quality.** O laço `quality` não capturou nenhuma semente na passada C (matriz `capturadoPorMatriz` do braço atual: laço spec 15 de spec e 5 de quality, laço quality 0) e não gerou correção por tarefa nas 3 tentativas de `completo` de E16 (gatilho da decisão 773 do roadmap anterior). A pergunta é se ele continua ou sai.

Resultado inconclusivo mantém o que existe: revisor sonnet e os dois laços (critério 2 do card).

## O que já se sabe (passada C, E16, E13)

- **Passada C, braço atual (revisor sonnet/medium, dois laços), M_C `94ce9b6`:** 10 válidas, 20 capturas em 40, lente spec 15 de 20, lente quality 5 de 20, 0 indeterminados, US$ 0,301 por válida (US$ 3,01 no braço). Muito determinístico: as cinco tentativas de cada artefato deram o mesmo resultado (A 3 de 4, B 1 de 4). QL2, SP4 e QL3 passaram em todas as tentativas dos dois braços. Ficou exatamente na borda do piso da passada C (piso era abaixo de 20).
- **E16 (M16, 2.1.0):** completo 3 de 3 válidas, `taskFixByTask` vazio; o gatilho da decisão 773 disparou.
- **E13:** a decisão 777 do roadmap anterior manda medir o laço quality depois da versão final; esta medição é essa.
- Custo da projeção da passada C (US$ 0,85 por tentativa do atual) ficou quase 3 vezes acima do real (US$ 0,30). As projeções abaixo partem do real.

## Premissa do arnês: `--review-model opus` sem mudança de código

Conferida em `tools/measure/run-batch.mjs` na ponta `b1e3fe0` e pelos testes.

- `REVIEW_MODELS = ['haiku', 'sonnet', 'opus']` (linha 764); `stageLoopFor('task-review', 'opus')` devolve `{ tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2, byId: true }` (885-888), o mesmo effort que `effortFor` do produto dá a opus (`roadmap-release.js:502`).
- `prepareHarness` aceita `lentes-semeadas-A/B` com `--arm atual --review-model opus` (teste `C2: --stage task-review --rounds loop accepts lentes-semeadas-A/B ...`, `run-batch.test.mjs:3577`, que já passa `reviewModel: 'opus'`).
- O script gerado (`buildLensesLoopScript`, 1104-1163) usa o modelo em `H_RM` e em `H_OPT`, e a revisão chama `model: rvModel || H_RM`. Conferência feita para este desenho, sem gasto e sem commit (script em scratchpad): os scripts de `lentes-semeadas-A` com sonnet e com opus sobre o workflow real diferem em exatamente duas linhas, `const H_RM = "opus"` e `const H_OPT = {"tier":"sonnet","reviewModel":"opus","byId":true}`. Os dois scripts têm cerca de 79.100 caracteres, longe do limite de 200.000.
- O replay (`replayLenses`, 1690-1740) refaz o laço com `stageLoopFor('task-review', h.harness.reviewModel)`: o mesmo modelo do script.
- `armTotals` recusa somar agregados de modelos diferentes (`reviewModel` entra no formato do braço, 1860-1862), e a pasta de saída leva o modelo no nome (`...-task-review-atual-opus-loop-...`, 2292).
- O braço `atual` no workflow da release (sem modo único, E29) passa por `checkLoopWorkflow`: os literais do modo único só são exigidos com `--arm unica` (DEC-010).

**Testes (gratuitos), rodados em 2026-11-17 na worktree `e30d`:** `node --test "tools/measure/*.test.mjs"`: **486 testes, 485 pass, 0 fail, 1 skipped**, 4 min 29 s. A premissa da estratégia vale: o lote roda sem mudar código.

Lacuna, sem efeito no lote: nenhum teste de `runBatch` de ponta a ponta usa `lentes-semeadas` com opus (os `lensBatch` usam sonnet). A diferença entre os dois scripts se resume às duas linhas acima, e a sonda confere o modelo real dos revisores (ver "Sondas").

Comportamento do produto que vale nos dois braços e entra no relatório: o corretor começa em sonnet e sobe um tier quando o mesmo achado volta (`runReviewLoop`, `roadmap-release.js:522-566`); a revisão depois de uma correção escalada roda em `maxModel(rm, fixTier)`. No braço sonnet, uma correção escalada a opus faz a revisão seguinte rodar em opus. O relatório conta essas revisões opus no braço sonnet a partir do diário (`rounds[].reviewModel`).

## Braços

Os dois são o braço `atual` do arnês (dois laços em série, `H_KINDS = ['spec', 'quality']`, `H_TR = { restricted: false, single: false }`), com corretor sonnet, `maxFix` 2 e `byId: true`. A única diferença é `--review-model`:

| Braço | `--review-model` | Effort do revisor | Pasta de saída |
|---|---|---|---|
| `sonnet` | `sonnet` | medium | `D:/claude-e30-out/sonnet/<artefato>-<k>` |
| `opus` | `opus` | medium | `D:/claude-e30-out/opus/<artefato>-<k>` |

**Braço `unica` fora.** E29 tirou `taskReview.single` do produto, e a revisão única perdeu na passada C (decisão 773 do roadmap anterior). O arnês ainda roda o braço, mas só sobre a cópia congelada `tools/measure/fixtures/workflow-com-single/roadmap-release.js`, idêntica ao workflow de `94ce9b6` (DEC-010). Conferido aqui: `checkLoopWorkflow` recusa `--arm unica` sobre o workflow real (`TR.single ? ['review'] : ['spec', 'quality'] is gone`) e aceita sobre a cópia congelada. Para rodá-lo no lote seria preciso montar um `--plugin-dir` com essa cópia no lugar do workflow da release, o que mistura duas árvores. Nada do que E30 decide depende dele.

**Sementes:** `lentes-semeadas-A` e `-B`, sem mudança (C1 da passada C: SP1, SP2, QL1 e QL2 em A; SP3, SP4, QL3 e QL4 em B). 10 válidas por braço (5 por artefato), 40 oportunidades, 20 por lente.

## Regra de decisão (fixada antes do lote)

Ela usa os totais de `armTotals([aggA, aggB, ...])` de cada braço e é aplicada à mão pelo orquestrador. `ruleSideC` não serve aqui: os limiares dela favorecem o braço barato e exigem custo menor do candidato, o que o opus nunca tem. `earlyCeiling` e `recountLenses` servem como estão.

### R1. Braço sonnet primeiro

Intercalado por artefato (sonda A, depois B, A, B, A, B, A, B, A, B). Uma inválida é reposta no mesmo artefato antes de seguir.

- **Teto antecipado** (como na passada C): se as 6 primeiras válidas (3 A e 3 B, intercaladas) dão 24 de 24 e o resultado se sustenta nas duas recontagens (`earlyCeiling` sobre `recountLenses(..., 'semMencao', leitura)` e `'failRisco'`), o braço para. O opus não roda e o revisor fica sonnet (o opus não teria o que somar).
- **Teto:** sonnet com 38 ou mais capturas em 40. Mesmo efeito.
- **Sem piso que impeça o opus.** Na passada C, o piso servia para não comparar dois braços em sementes difíceis demais. Aqui sementes que o sonnet não pega são justamente onde o opus pode ganhar. Um sonnet com poucas capturas não para o lote.
- **Determinadas:** sonnet com menos de 32 determinadas torna a comparação inconclusiva. O opus não roda e fica o sonnet.

### R2. Braço opus (fora do teto)

10 válidas, com a mesma ordem e a mesma reposição. Sejam S os totais do sonnet e O os do opus.

1. O precisa de pelo menos 32 determinadas. Abaixo disso o resultado é inconclusivo e fica o sonnet.
2. **O opus entra** (vira o revisor por tarefa padrão) só se valem ao mesmo tempo:
   - capturas O ≥ capturas S + 4, no total das 40 oportunidades. As sementes são determinísticas por artefato (cinco tentativas iguais na passada C), então uma semente que passa a ser pega costuma somar perto de 5; o limiar 4 exige ao menos uma semente nova pega de forma estável;
   - em cada lente, capturas O ≥ capturas S − 2 (o ganho numa lente não pode esconder perda na outra);
   - perdidos O ≤ perdidos S − 2, no total (o ganho não pode vir só de indeterminados que viraram capturas);
   - custo por válida O ≤ 2,5 × custo por válida S. Na tabela de preços, opus custa o dobro de sonnet; o limite deixa margem para as rodadas a mais que um revisor mais exigente provoca.
3. Fora disso fica o sonnet. Se as capturas passam no limiar mas o custo não, fica o sonnet e o relatório registra o custo por captura a mais, para revisão futura fora desta regra.
4. **Recontagens** (como as de DEC-737 e da passada C): refazer R2 com as capturas sem menção como indeterminadas (a leitura do diário pelo orquestrador prevalece sobre o regex, decisão 753 do roadmap anterior) e, à parte, com as tentativas `failRiscoAceito` como indeterminadas, nos dois braços. Se alguma recontagem muda o lado, o resultado é inconclusivo e fica o sonnet.

### R3. Laço quality

Lido nos dois braços pela matriz `capturadoPorMatriz` (laço × classe). A **captura marginal do laço quality** é uma semente capturada numa tentativa válida cujo primeiro achado que a nomeia vem de uma rodada `quality` (`capturadoPor[id].kind === 'quality'`). Uma captura sem menção conta como marginal só se a leitura do diário mostrar que foi uma correção do laço quality que a removeu.

- **Retirar** (proposta de mudança de produto): 0 capturas marginais nos dois braços (20 tentativas), somando-se às 0 da passada C e às 0 correções por tarefa de E16.
- **Manter:** 2 ou mais capturas marginais no braço do modelo que a R2 escolheu.
- **Inconclusivo, mantém:** qualquer outro caso (1 captura marginal, ou capturas só no braço do modelo não escolhido).
- O relatório traz o custo do laço quality por tentativa (rótulos `E5:t3:quality<r>` e `E5:t3:quality-fix<k>`), lido das métricas por rótulo das transcrições dos subagentes com `session-metrics.mjs`, sem gasto. O `rolesByLabel` do agregado junta spec e quality no balde `review` e não separa esse custo.

Risco que o relatório declara: retirar o laço quality deixa a lista `quality` de `agents/task-reviewer.md` sem laço próprio. O laço spec pegou 5 de 20 sementes de quality na passada C, mas o modo `spec` manda revisar "SPEC COMPLIANCE only". A mudança de produto, se a regra a indicar, precisa de spec própria (ver Q7).

### R4. Registro

Ao fim do lote, uma linha em `docs/plans/roadmap-pos-2-2-0/measurements.md` (o tracker cria o arquivo) com os braços, as tentativas válidas e inválidas por braço, as capturas por lente, o custo e o lado vencedor (critério 1). Uma DEC sobre o modelo do revisor e outra sobre o laço quality vão para `decisions.md` (critério 2). O relatório vai para `docs/reports/2026-11-<dd>-E30-revisor-opus.md`.

## Paradas e sondas

**Sondas.** A 1ª tentativa de cada braço é a sonda (`lentes-semeadas-A`, `--runs 1`). Uma sonda válida no mesmo M_E30, arnês e config conta como 1ª tentativa do braço (decisão 749 do roadmap anterior). Na sonda se confere:

- tentativa válida, com `harnessCommit` igual ao commit do plugin (sem o aviso `harnessCommit differs`);
- `agentType` `productivity-tools:task-reviewer` e modelo do revisor no `.meta.json` dos subagentes `E5:t3:spec1` e `E5:t3:quality1`: `claude-sonnet-5-5` no braço sonnet e `claude-opus-5-5` no braço opus. A config herda `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` do settings do usuário, e esta conferência pega o caso de o ambiente vencer o `model` da chamada;
- superpowers no agregado igual ao fixado (ver "Config descartável") e versão da CLI registrada;
- custo da sonda × 10 dentro do teto do braço.

**Paradas antes do lote:**

- sonda sonnet × 10 acima de US$ 5, ou sonda opus × 10 acima de US$ 11: parar e perguntar;
- modelo do revisor errado no `.meta.json`: parar (o lote mediria outra coisa);
- commit do superpowers diferente do fixado: parar (decisão 747 do roadmap anterior).

**Paradas durante o lote** (por braço, A e B somados por `armTotals` entre invocações):

- mais de 3 inválidas; 2 `laco-divergente`; 2 `semente-ausente`;
- qualquer `bloqueou-sintetico` ou `sinteticoGerado` acima de 0: sem modo único, o achado sintético não pode existir; se aparecer, há defeito no arnês ou na árvore medida;
- `plugins/` ou `tools/measure/` de M_E30 diferente entre os dois braços (`git rev-parse <commit>:plugins`), ou versão da CLI diferente entre os braços: parar e voltar ao dono;
- gasto acumulado de E30 no teto de E30 (US$ 16) com braço incompleto: parar. O lote retoma do que está em `--out`.

O lote nunca roda junto de outro lote (E31), de G1 ou de um release (porta 48731).

## Orçamento

Teto total do roadmap: US$ 40 (DEC-004), gasto até agora US$ 0. E31 parte da premissa de cerca de US$ 2,26 por execução de parada-retomada (E11 e E13; em E13, 3 execuções custaram US$ 6,68).

**Projeção de E30:**

- braço sonnet: US$ 0,30 por válida (passada C), 10 válidas ≈ **US$ 3,0**; com 3 inválidas repostas ≈ US$ 4,0;
- braço opus: o custo de revisão dobra (opus custa 2 vezes sonnet por token) e um revisor mais exigente pode pedir rodadas a mais. Estimativa de US$ 0,45 a 0,70 por válida, 10 válidas ≈ **US$ 4,5 a 7,0**; com 3 inválidas, até US$ 9,1;
- total ≈ US$ 7,5 a 10 sem inválidas, até US$ 13 no pior caso. Se o sonnet der teto: só o braço sonnet (≈ US$ 3).

**Divisão proposta do teto de US$ 40:**

| Parte | Teto | Uso |
|---|---|---|
| E30 | **US$ 16** | braço sonnet até US$ 5, braço opus até US$ 11 |
| E31 | **US$ 18** | ≈ 6 execuções de parada-retomada a US$ 2,26 com folga de 30%, ou 7 sem folga |
| Reserva | **US$ 6** | não alocada; liberada só por decisão do dono via Fable (reposição de sonda que falhou por ambiente, ou execução a mais de E31) |

O teto de E30 cobre o pior caso projetado (US$ 13) com 3 de folga. A parte de E31 é proposta daqui; o desenho de E31 (`design/e31`) fixa o número de execuções e pode pedir parte da reserva.

## Config descartável `D:\claude-pos22-cfg`

Estado lido em 2026-11-17, só leitura:

- logada (DEC-019); `plugins/installed_plugins.json` vazio (nenhum plugin instalado); `known_marketplaces.json` só com `claude-plugins-official` (clone raso em `fd30cee`, catálogo com superpowers no sha `22f0b46`, a versão 7.0.2);
- `settings.json` é cópia do settings do usuário: `env.CLAUDE_CODE_SUBAGENT_MODEL = "sonnet"`, hooks `PreCompact` e `SessionStart` (compact) que apontam para `C:/Users/odeci/.claude/hooks/recovery`, `statusLine`, `enabledPlugins` com 21 entradas (entre elas `productivity-tools@claude-play: true` e `superpowers@claude-plugins-official: true`), e `extraKnownMarketplaces` com `claude-play` (GitHub, `autoUpdate: true`), `cloudflare` e `context-mode`;
- `CLAUDE.md` é cópia do `CLAUDE.md` global do usuário (é a situação da S3-10).

**O que instalar e como.** É preparo do lote, feito depois da ratificação e antes da sonda, com `CLAUDE_CONFIG_DIR=D:/claude-pos22-cfg` exportado (receita do E17: `--config-dir` do arnês só lê, e a config da sessão vem do ambiente).

1. **productivity-tools: não instalar da loja.** O plugin medido vem de `--plugin-dir` de uma worktree destacada em M_E30 (`readPluginDir`), com o arnês no mesmo commit. A ref é M_E30: a ponta de `release/pos-2.2.0` no início do lote, com a árvore `plugins/` igual à de `b1e3fe0` (E29 e E32 integrados, sem a linha S3-24, que só entra depois do lote). Instalar da loja (`main`, 2.2.x) poria uma segunda cópia de `productivity-tools` na sessão.
   ```
   git -C D:/projects/claude-play-wt/_integracao worktree add --detach D:/claude-e30-release <M_E30>
   git -C D:/claude-e30-release rev-parse HEAD:plugins HEAD:tools/measure   # registrado no relatório
   ```
2. **superpowers fixo em 7.0.0 (`bb92a77741419a4ab5f06e711a283343f1ada0c3`)**, o mesmo da config da passada C e de E16 (`D:/claude-e17-cfg`). `claude plugin install` não aceita versão; quem fixa é a fonte. O catálogo oficial está em 7.0.2, então a fixação usa uma loja local de uma entrada, com fonte `url` e `sha`, no formato que o catálogo oficial já usa para o superpowers:
   ```
   # D:/claude-pos22-mkt/.claude-plugin/marketplace.json
   { "name": "pos22-fixo", "owner": { "name": "medicao" },
     "plugins": [ { "name": "superpowers",
       "source": { "source": "url", "url": "https://github.com/obra/superpowers.git", "sha": "bb92a77741419a4ab5f06e711a283343f1ada0c3" } } ] }

   claude plugin marketplace add D:/claude-pos22-mkt
   claude plugin install superpowers@pos22-fixo
   ```
   Conferência: `installed_plugins.json` com `superpowers@pos22-fixo`, `version` 7.0.0 e `gitCommitSha` `bb92a77…` (`readSuperpowers` acha a primeira chave `superpowers@`, seja qual for a loja). Saída da decisão 747 do roadmap anterior: duas falhas na fixação em 7.0.0 levam a 7.0.2 (`22f0b46`) fixado do mesmo jeito, citando a decisão. Nos dois casos o commit é conferido antes de cada braço.
3. **Atualização automática desligada:** `"autoUpdate": false` em cada entrada de `known_marketplaces.json` (`claude-plugins-official` e `pos22-fixo`) e `DISABLE_AUTOUPDATER=1` no ambiente do lote, que também segura a versão da CLI entre os braços. A sessão anterior (`D:/claude-e17-cfg`) mostrou o risco: o superpowers mudou sozinho de 7.0.0 para 7.0.2 entre dois lotes (`docs/reports/2026-11-12-e17-ponto-de-medicao/achados-1.7.0.md`). Conferência por braço: `claude --version` e o `gitCommitSha` do superpowers iguais aos da sonda.
4. **Neutralizar o que veio do usuário** (depende da Q6): no `settings.json` da config descartável, tirar `extraKnownMarketplaces.claude-play` (com `autoUpdate: true` e `productivity-tools@claude-play` habilitado, uma sessão poderia buscar a loja e carregar a 2.2.x ao lado do `--plugin-dir`), `env.CLAUDE_CODE_SUBAGENT_MODEL`, os hooks e o `statusLine` que apontam para a pasta do usuário, e as lojas `cloudflare` e `context-mode`. Também renomear `CLAUDE.md` para `CLAUDE.md.off`. Nenhuma edição toca o settings real do usuário.

**Comando do lote** (molde da passada C, rodado de `D:/claude-e30-release`):

```
export CLAUDE_CONFIG_DIR=D:/claude-pos22-cfg DISABLE_AUTOUPDATER=1
node tools/measure/run-batch.mjs --variant lentes-semeadas-<A|B> --runs 1 \
  --work D:/claude-e30-work/<braço>/<artefato>-<k> --out D:/claude-e30-out/<braço>/<artefato>-<k> \
  --config-dir D:/claude-pos22-cfg --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 \
  --stage task-review --rounds loop --arm atual --review-model <sonnet|opus> \
  --plugin-dir D:/claude-e30-release/plugins/productivity-tools --stop-on-denial
```

`<k>` conta toda invocação por artefato, reposições incluídas (pasta `--work` própria por invocação, como na passada C). `bypassPermissions` só na orquestração da medição (DEC-311/312 do roadmap anterior). As saídas ficam fora do repositório. Antes de apagar a config, as transcrições são lidas (pendência do `state.md`).

## Triagem das 10 notas com dono E30

Fonte: `docs/reports/2026-11-15-E32-triagem-backlog.md`, com o adendo de 2026-11-17.

| Id | Nota (resumo) | Entra antes do lote? | O que fazer |
|---|---|---|---|
| S2-10 | `parentMention` no CR do manifest, lido por `mentionStats`, antes de outro lote com `correcao-semeada` | **Não** | E30 usa `lentes-semeadas`, não `correcao-semeada`. A nota continua valendo para o próximo lote com `correcao-semeada`; destino: roadmap futuro, dono executor. |
| S2-15 | `coordinatorGateVazio` (`run-batch.mjs:1492`) só lê `# tests 0`/`# pass 0`, não o resumo "N tests, N pass, N fail" | **Não** | Só a variante `coordinator` usa essa conferência; E30 não roda coordinator, e E31 (parada-retomada) também não. Destino: roadmap futuro, dono executor. |
| S2-16 | Gatilho da decisão 773 disparou em E16 (laço quality sem correção) | **Sim, como objetivo** | É a R3 deste desenho. Não muda código; fecha com a DEC do laço quality. |
| S2-17 | Pós-2.2.0: medir revisor sonnet contra opus e decidir o laço quality (parte E30) | **Sim, como objetivo** | É a R2 e a R3. A parte de E29 já fechou (`a563e48`); a de E31 segue lá. Fecha com as duas DECs de E30 (só a parte E30). |
| S3-02 | `SANDBOX_RELEASE_RULES` (`make-scenario.mjs:56`) mantém a regra inerte `Workflow(productivity-tools:roadmap-release)` | **Não** | A regra de permissão a mais não autoriza nada que exista. Trocá-la agora mudaria o sandbox de `lentes-semeadas` em relação à passada C sem ganho. A correção (tirar o nome antigo e os dois testes que o afirmam, `make-scenario.test.mjs:349` e `:499`) fica para depois dos lotes de E30 e E31. Destino: roadmap futuro, dono executor. |
| S3-03 | `spec-review-atual.md` não casa com o workflow em HEAD; `checkpoint.mjs` não o confere | **Não** | O braço de `task-review` é `built-in`, com o prompt tirado do próprio workflow (`armSource: 'workflow'`), e não lê arquivo de `arms/`. Destino: roadmap futuro, dono executor (próximo lote de `spec-review`). |
| S3-06 | Na config descartável, fixar o superpowers e desligar a atualização automática das lojas antes do lote | **Sim** | Itens 2 e 3 da seção "Config descartável", conferidos na sonda e antes de cada braço. Preparo sem código; fecha no relatório do lote. |
| S3-07 | `baseline.mjs`: a divergência de superpowers vira erro global mesmo com decisão do dono | **Não** | E30 consolida por `armTotals`, não por `baseline.mjs`. Com o superpowers fixado nos dois braços, não há divergência. Destino: roadmap futuro (próxima linha de base), dono executor. |
| S3-09 | O arnês ainda espera os artefatos de E5 em `docs/superpowers` (`E5_PATHS`, `make-scenario.mjs:31-33`) | **Não** | O cenário cria a spec e o plano nesses caminhos e o script os passa ao revisor por `H_PLAN` e `H_SPEC`, com o mesmo efeito da passada C. Mudar os caminhos mudaria os bytes dos prompts entre a passada C e E30. Destino: roadmap futuro, junto da S3-02. |
| S3-10 | Gatilho de E20: spec-3 vai direto ao spec-author sem chamar Skill; a config descartável tem `CLAUDE.md` do usuário | **Só a parte da config** | A medição de gatilho não é de E30. A parte da config entra no item 4 da seção "Config descartável" (Q6): `CLAUDE.md` do usuário fora da config descartável nos dois braços, e o relatório registra o estado. A parte do gatilho segue pendente; destino: roadmap futuro, dono executor. |

Resumo: entram antes do lote S3-06 e a parte da config de S3-10, ambas sem código; S2-16 e S2-17 são o próprio objetivo. S2-10, S2-15, S3-02, S3-03, S3-07 e S3-09 não entram e passam a roadmap futuro. Nenhuma nota pede mudança de código antes do lote. A S3-24 (linha dos modos em `task-reviewer.md`) não é deste conjunto: por pendência do `state.md`, só se corrige depois do lote, porque toca os modos `spec` e `quality` que o lote mede.

## Riscos

- **O opus também não pega QL2, SP4 e QL3** e os braços empatam. Esperado e aceito: a R2 mantém o sonnet, o mais barato.
- **Revisor opus mais exigente gera mais achados menores e mais rodadas.** O efeito aparece no custo (limite de 2,5×) e nos `failRiscoAceito` (recontagem).
- **Contaminação no braço sonnet** por revisão opus depois de correção escalada (`maxModel`). Contada à parte no relatório. É o comportamento do produto, por isso não invalida.
- **Deriva no tempo entre os braços** (serviço do modelo, CLI). A CLI fica travada (`DISABLE_AUTOUPDATER`) e é conferida por braço. O braço por braço segue a passada C e permite o teto antecipado do sonnet. A alternativa intercalada está na Q11.
- **`CLAUDE_CODE_SUBAGENT_MODEL=sonnet` na config** poderia vencer o `model: 'opus'` da chamada. A sonda pega isso no `.meta.json`, e o item 4 da config tira a variável.
- **Sementes já conhecidas.** São as mesmas da passada C; o desenho delas foi conferido por teste (aceite 1 da passada C) e segue verde na suíte acima.

## Questões do dono

Cada questão tem recomendação e alternativas. Nenhuma trava o resto do desenho: com as recomendações, o lote roda como descrito.

1. **Braço sonnet: rodar de novo ou reusar a passada C.** Recomendo **rodar de novo** (≈ US$ 3): mesma árvore (os modos `spec` e `quality` de `task-reviewer.md` só mudaram numa linha da lista de modos, por E29), mesma config, mesma CLI e mesmo superpowers que o braço opus. Na passada C o resultado ficou na borda (20 em 40) com outra config e outra CLI. Alternativa: reusar os 10 válidos de `94ce9b6` (economiza ≈ US$ 3, mas compara M_C com M_E30 e configs diferentes).
2. **Limiares da R2.** Recomendo **+4 capturas no total, lentes dentro de −2, perdidos −2 e custo até 2,5×.** Alternativas: (a) +2, como a margem da passada C (sensível a uma semente oscilante); (b) +6 (exige mais que uma semente nova); (c) sem limite de custo, com o custo só registrado.
3. **n.** Recomendo **10 válidas por braço** (5 por artefato), como nas passadas anteriores (decisões 704 e 705 do roadmap anterior). Alternativa: 20 por braço, que dobra o custo (≈ US$ 15 a 20 em E30) e aperta E31.
4. **Divisão do teto de US$ 40.** Recomendo **E30 US$ 16, E31 US$ 18, reserva US$ 6.** Alternativas: (a) E30 US$ 13 e E31 US$ 21, sem folga no pior caso do opus; (b) E30 US$ 16 e E31 US$ 24, sem reserva.
5. **Versão do superpowers na config.** Recomendo **7.0.0 (`bb92a77`)** por loja local com `sha`, como a passada C e E16, com saída para 7.0.2 pela decisão 747 do roadmap anterior. Alternativas: (a) 7.0.2 (`22f0b46`), que é o que o catálogo oficial instala hoje: mais simples, mas diferente da passada C; (b) não instalar o superpowers (ambiente diferente de todos os lotes anteriores).
6. **Limpar o `settings.json` e o `CLAUDE.md` da config descartável** (item 4 da config). Recomendo **limpar**: a loja `claude-play` declarada com `autoUpdate` e o plugin habilitado podem carregar uma 2.2.x ao lado do `--plugin-dir`, e a variável de modelo dos subagentes e o `CLAUDE.md` do usuário não fazem parte do produto medido. Alternativa: manter a cópia do usuário, como foi a `D:/claude-e17-cfg` (S3-10), e confiar na sonda. É uma edição de settings, por isso fica com o dono.
7. **Destino da mudança de produto** se o opus entrar ou o laço quality sair. Recomendo **registrar a decisão em E30 e levar a mudança a um roadmap futuro**, com spec própria: a 2.3.0 de E33 foi definida pela remoção da chave `single` (DEC-018), e retirar o laço quality mexe em `roadmap-release.js`, em `task-reviewer.md` e nos testes de E29. Alternativa: uma peça pequena antes de E33 só para o revisor opus (troca em `reviewModelFor` com teste), deixando a retirada do laço quality para depois.
8. **Braço `unica` com revisor opus.** Recomendo **fora**: a revisão única saiu do produto, e rodá-la exigiria um `--plugin-dir` montado com a cópia congelada. Alternativa: medir `unica` com opus para um eventual retorno do modo (≈ US$ 5 a 7 a mais, só com a reserva).
9. **Limiar da R3 (laço quality).** Recomendo **retirar só com 0 capturas marginais nos dois braços e manter com 2 ou mais no braço do modelo escolhido**; 1 é inconclusivo e mantém. Alternativa: retirar com até 1 captura marginal em 20 tentativas, mais agressiva.
10. **Regra aplicada à mão ou por função pura nova.** Recomendo **à mão**, sobre os totais de `armTotals`, com `earlyCeiling` e `recountLenses` como estão: mantém a premissa de nenhum código antes do lote, e a regra tem cinco comparações. Alternativa: uma função `ruleSideE30` com testes em `run-batch.mjs` antes do lote (um ciclo de código, revisão e merge na release, e uma M_E30 nova).
11. **Ordem dos braços.** Recomendo **sonnet inteiro primeiro, depois opus**, como a passada C: o teto do sonnet poupa o braço opus. Alternativa: intercalar os braços (sonnet A, opus A, sonnet B, ...), que controla a deriva no tempo mas perde o teto antecipado e exige as duas sondas antes de tudo.
