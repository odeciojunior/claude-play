# E30: revisor por tarefa sonnet contra opus e destino do laço quality

Data: 2026-11-17. Branch: `design/e30` (worktree `D:/projects/claude-play-wt/e30d`, base `b1e3fe0` de `release/pos-2.2.0`). Revisão 2, com as decisões do dono de 2026-11-17 (DEC-021 orçamento e ordem, DEC-022 config única; ver "Decisões do dono"). Base: card E30 da estratégia `docs/plans/2026-11-15-roadmap-pos-2-2-0.md` (REQ-002, REQ-003, REQ-008), DEC-004 (teto de US$ 40), DEC-006 (decisão do dono via Fable), DEC-010 (braço `unica` na cópia congelada), DEC-019, DEC-020, DEC-021 e DEC-022; do roadmap anterior, as decisões 704, 705, 737, 741, 747, 749, 753, 773 e 777. Molde: `docs/plans/2026-11-15-measure-e27-passada-c-design.md` (passada C) e o relatório `docs/reports/2026-11-15-E27-passada-C.md`. Este documento só desenha o lote. Não roda nada pago e não muda código.

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

Ordem (decisão 11): sonda sonnet A, sonda opus A (ver "Sondas"), depois o resto do braço sonnet intercalado por artefato (B, A, B, A, B, A, B, A, B). Uma inválida é reposta no mesmo artefato antes de seguir. A sonda opus válida conta como 1ª tentativa do braço opus; se o sonnet der teto, o custo dela fica como custo do lote.

- **Teto antecipado** (como na passada C): se as 6 primeiras válidas (3 A e 3 B, intercaladas) dão 24 de 24 e o resultado se sustenta nas duas recontagens (`earlyCeiling` sobre `recountLenses(..., 'semMencao', leitura)` e `'failRisco'`), o braço para. O opus não roda e o revisor fica sonnet (o opus não teria o que somar).
- **Teto:** sonnet com 37 ou mais capturas em 40. Mesmo efeito: com 37 o opus não alcança +4 (R2) dentro de 40.
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

- **Piso de oportunidades** (decisão 9): a R3 só pode retirar com pelo menos 10 sementes de quality que chegaram ao laço quality sem captura (não pegas pelo laço spec antes), somadas nos braços rodados. Abaixo disso, ou se o braço opus não rodar, o resultado é inconclusivo e o laço fica.
- **Retirar** (proposta de mudança de produto): piso atingido e 0 capturas marginais nos dois braços (20 tentativas), somando-se às 0 da passada C e às 0 correções por tarefa de E16.
- **Manter:** 2 ou mais capturas marginais no braço do modelo que a R2 escolheu.
- **Inconclusivo, mantém:** qualquer outro caso (piso não atingido, opus não rodou, 1 captura marginal, ou capturas só no braço do modelo não escolhido).
- O relatório traz o custo do laço quality por tentativa (rótulos `E5:t3:quality<r>` e `E5:t3:quality-fix<k>`), lido das métricas por rótulo das transcrições dos subagentes com `session-metrics.mjs`, sem gasto. O `rolesByLabel` do agregado junta spec e quality no balde `review` e não separa esse custo.

Risco que o relatório declara: retirar o laço quality deixa a lista `quality` de `agents/task-reviewer.md` sem laço próprio. O laço spec pegou 5 de 20 sementes de quality na passada C, mas o modo `spec` manda revisar "SPEC COMPLIANCE only". A mudança de produto, se a regra a indicar, precisa de spec própria (decisão 7).

### R4. Registro

Ao fim do lote, uma linha em `docs/plans/roadmap-pos-2-2-0/measurements.md` (o tracker cria o arquivo) com os braços, as tentativas válidas e inválidas por braço, as capturas por lente, o custo e o lado vencedor (critério 1). Uma DEC sobre o modelo do revisor e outra sobre o laço quality vão para `decisions.md` (critério 2). O relatório vai para `docs/reports/2026-11-<dd>-E30-revisor-opus.md`.

## Paradas e sondas

**Sondas.** Duas, antes do resto do braço sonnet: sonda sonnet A e sonda opus A (`lentes-semeadas-A`, `--runs 1`). Uma sonda válida no mesmo M_E30, arnês e config conta como 1ª tentativa do seu braço (decisão 749 do roadmap anterior). Na sonda se confere:

- tentativa válida, com `harnessCommit` igual ao commit do plugin (sem o aviso `harnessCommit differs`);
- `agentType` `productivity-tools:task-reviewer` e modelo do revisor nos subagentes `E5:t3:spec1` e `E5:t3:quality1`: `claude-sonnet-5-5` na sonda sonnet e `claude-opus-5-5` na sonda opus, lido no `message.model` da transcrição do subagente (o `.meta.json` traz `agentType` e só o alias pedido em `model`; `pickedEffortModel` não é o modelo do revisor). A config mantém `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` (passo 2 do setup); a sonda opus confere que, com a variável presente, o `model: 'opus'` da chamada vence. Outro modelo: parar. Tirar a variável invalidaria a paridade com a passada C, então a saída volta ao dono;
- nenhum plugin `@claude-play` carregado: o `productivity-tools` medido vem só do `--plugin-dir`. O arnês roda `--output-format json` e não guarda a lista de plugins da sessão; a conferência é à mão: `enabledPlugins`, `installed_plugins.json`, `known_marketplaces.json` e `plugins/cache` sem `claude-play`;
- superpowers no agregado igual ao fixado (`bb92a77`), versão da CLI e sha256 do `settings.json` iguais aos registrados no setup;
- custo da sonda × 10 dentro do teto do braço.

**Paradas antes do lote:**

- sonda sonnet × 10 acima de US$ 5, ou sonda opus × 10 acima de US$ 11: parar e perguntar;
- modelo do revisor errado em qualquer sonda: parar e voltar ao dono (o lote mediria outra coisa);
- plugin `@claude-play` carregado: parar;
- commit do superpowers diferente do fixado: parar (decisão 747 do roadmap anterior).

**Antes de cada braço** (passo 7 do setup): `claude --version` (hoje 2.1.326), `gitCommitSha` do superpowers e sha256 do `settings.json`. Mudou, para.

**Paradas durante o lote** (por braço, A e B somados por `armTotals` entre invocações):

- mais de 3 inválidas; 2 `laco-divergente`; 2 `semente-ausente`;
- qualquer `bloqueou-sintetico` ou `sinteticoGerado` acima de 0: sem modo único, o achado sintético não pode existir; se aparecer, há defeito no arnês ou na árvore medida;
- `plugins/` ou `tools/measure/` de M_E30 diferente entre os dois braços (`git rev-parse <commit>:plugins`), ou versão da CLI diferente entre os braços: parar e voltar ao dono;
- gasto acumulado de E30 no teto de E30 (US$ 16) com braço incompleto: parar. O lote retoma do que está em `--out`.

O lote nunca roda junto de outro lote (E31), de G1 ou de um release (porta 48731). Ordem dos lotes (DEC-021): E30 inteiro, depois E31, um por vez.

## Orçamento (DEC-021)

Teto total do roadmap: US$ 40 (DEC-004), gasto até agora US$ 0.

| Parte | Teto | Uso |
|---|---|---|
| E30 | **US$ 16** | braço sonnet até US$ 5, braço opus até US$ 11 |
| E31 | **US$ 15 firmes** | 3 execuções a US$ 5 (o desenho de E31 fixa o resto) |
| Reserva comum | **US$ 9 + o que E30 não gastar** | liberada só via Fable; E31 pode pedir até 2 execuções a mais se o total ficar ≤ US$ 40 |

**Projeção de E30:**

- braço sonnet: US$ 0,30 por válida (passada C), 10 válidas ≈ **US$ 3,0**; com 3 inválidas repostas ≈ US$ 4,0;
- braço opus: o custo de revisão dobra (opus custa 2 vezes sonnet por token) e um revisor mais exigente pode pedir rodadas a mais. Estimativa de US$ 0,45 a 0,70 por válida, 10 válidas ≈ **US$ 4,5 a 7,0**; com 3 inválidas, até US$ 9,1;
- total ≈ US$ 7,5 a 10 sem inválidas, até US$ 13 no pior caso. Se o sonnet der teto: braço sonnet e sonda opus (≈ US$ 3,5).

O teto de E30 cobre o pior caso projetado (US$ 13) com 3 de folga.

## Config `D:\claude-pos22-cfg` e setup único (DEC-022)

Estado lido em 2026-11-17, só leitura:

- logada (DEC-019); `plugins/installed_plugins.json` vazio; `known_marketplaces.json` só com `claude-plugins-official` (clone raso em `fd30cee`, catálogo com superpowers no sha `22f0b46`, a 7.0.2);
- `settings.json` é cópia do settings do usuário: `env.CLAUDE_CODE_SUBAGENT_MODEL = "sonnet"`, hooks `PreCompact` e `SessionStart` (compact) que apontam para `C:/Users/odeci/.claude/hooks/recovery`, `statusLine`, `enabledPlugins` com 21 entradas (entre elas `productivity-tools@claude-play` e `superpowers@claude-plugins-official`), e `extraKnownMarketplaces` com `claude-play` (GitHub, `autoUpdate: true`), `cloudflare` e `context-mode`;
- `CLAUDE.md` é cópia do `CLAUDE.md` global do usuário (situação da S3-10).

**Setup único**, comum a E30 e E31, feito uma vez antes da 1ª sonda, com `CLAUDE_CONFIG_DIR=D:/claude-pos22-cfg` exportado (receita do E17: `--config-dir` do arnês só lê, a config da sessão vem do ambiente). Nada toca `~/.claude`.

1. Guardar `settings.json` como `settings.json.orig` dentro da config; anotar o sha256 dele e do `CLAUDE.md`.
2. Editar `D:\claude-pos22-cfg\settings.json`: remover hooks e `statusLine`; remover `extraKnownMarketplaces` inteiro (com `claude-play` e `autoUpdate: true`, uma sessão poderia carregar a 2.2.x da loja ao lado do `--plugin-dir`); `enabledPlugins = {}`; em `env`, manter `CLAUDE_CODE_SUBAGENT_MODEL "sonnet"` e acrescentar `DISABLE_AUTOUPDATER "1"`. O resto e o `CLAUDE.md` ficam. **Motivo de manter `CLAUDE.md` e a variável: paridade** com a passada C e E16, cuja config (`D:/claude-e17-cfg`) era cópia do usuário com os dois. A sonda opus confere que a variável não vence o `model` da chamada.
3. **superpowers fixo em 7.0.0 (`bb92a77741419a4ab5f06e711a283343f1ada0c3`)**, o da passada C e de E16. `claude plugin install` não aceita versão; quem fixa é a fonte, por uma loja local de uma entrada com `url` e `sha`, no formato do catálogo oficial:
   ```
   # D:/claude-pos22-mkt/.claude-plugin/marketplace.json
   { "name": "pos22-fixo", "owner": { "name": "medicao" },
     "plugins": [ { "name": "superpowers",
       "source": { "source": "url", "url": "https://github.com/obra/superpowers.git", "sha": "bb92a77741419a4ab5f06e711a283343f1ada0c3" } } ] }

   claude plugin marketplace add D:/claude-pos22-mkt
   claude plugin install superpowers@pos22-fixo
   ```
   Conferência: `installed_plugins.json` só com `superpowers@pos22-fixo`, `version` 7.0.0 e esse `gitCommitSha` (`readSuperpowers` acha a primeira chave `superpowers@`). Duas falhas levam a 7.0.2 (`22f0b46`) fixado do mesmo jeito (decisão 747 do roadmap anterior).
4. `"autoUpdate": false` em cada entrada de `known_marketplaces.json` (`claude-plugins-official` e `pos22-fixo`). A `D:/claude-e17-cfg` mostrou o risco: o superpowers mudou sozinho de 7.0.0 para 7.0.2 entre dois lotes (`docs/reports/2026-11-12-e17-ponto-de-medicao/achados-1.7.0.md`).
5. Worktree dos lotes, comum a E30 e E31:
   ```
   git -C D:/projects/claude-play-wt/_integracao worktree add --detach D:/claude-pos22-release <M>
   git -C D:/claude-pos22-release rev-parse HEAD:plugins HEAD:tools/measure   # registrados no relatório
   ```
   M (M_E30) = ponta de `release/pos-2.2.0` com `plugins/` e `tools/measure` iguais aos de `b1e3fe0` (E29 e E32 integrados, sem a S3-24). O `productivity-tools` medido vem do `--plugin-dir` dessa worktree (`readPluginDir`), com o arnês no mesmo commit; não se instala da loja.
6. Todo comando pago roda de `D:/claude-pos22-release` com `export CLAUDE_CONFIG_DIR=D:/claude-pos22-cfg DISABLE_AUTOUPDATER=1`, `--config-dir D:/claude-pos22-cfg` e `--plugin-dir D:/claude-pos22-release/plugins/productivity-tools`.
7. Antes de cada braço ou execução: `claude --version` (hoje 2.1.326), `gitCommitSha` do superpowers e sha256 do `settings.json`. Mudou, para. A referência do sha256 é tirada depois dos passos 3 e 4 (a instalação pode escrever em `enabledPlugins`).
8. S3-24 e qualquer correção de E31 só integram na release depois dos dois lotes. A config não é apagada nem deslogada antes dos dois relatórios; as transcrições são lidas antes (pendência do `state.md`).

**Comando do lote** (molde da passada C):

```
cd D:/claude-pos22-release
export CLAUDE_CONFIG_DIR=D:/claude-pos22-cfg DISABLE_AUTOUPDATER=1
node tools/measure/run-batch.mjs --variant lentes-semeadas-<A|B> --runs 1 \
  --work D:/claude-e30-work/<braço>/<artefato>-<k> --out D:/claude-e30-out/<braço>/<artefato>-<k> \
  --config-dir D:/claude-pos22-cfg --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 \
  --stage task-review --rounds loop --arm atual --review-model <sonnet|opus> \
  --plugin-dir D:/claude-pos22-release/plugins/productivity-tools --stop-on-denial
```

`<k>` conta toda invocação por artefato, reposições incluídas (pasta `--work` própria por invocação). `bypassPermissions` só na orquestração da medição (DEC-311/312 do roadmap anterior). As saídas ficam fora do repositório.

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
| S3-06 | Na config descartável, fixar o superpowers e desligar a atualização automática das lojas antes do lote | **Sim** | Passos 3 e 4 do setup único, conferidos na sonda e antes de cada braço (passo 7). Preparo sem código; fecha no relatório do lote. |
| S3-07 | `baseline.mjs`: a divergência de superpowers vira erro global mesmo com decisão do dono | **Não** | E30 consolida por `armTotals`, não por `baseline.mjs`. Com o superpowers fixado nos dois braços, não há divergência. Destino: roadmap futuro (próxima linha de base), dono executor. |
| S3-09 | O arnês ainda espera os artefatos de E5 em `docs/superpowers` (`E5_PATHS`, `make-scenario.mjs:31-33`) | **Não** | O cenário cria a spec e o plano nesses caminhos e o script os passa ao revisor por `H_PLAN` e `H_SPEC`, com o mesmo efeito da passada C. Mudar os caminhos mudaria os bytes dos prompts entre a passada C e E30. Destino: roadmap futuro, junto da S3-02. |
| S3-10 | Gatilho de E20: spec-3 vai direto ao spec-author sem chamar Skill; a config descartável tem `CLAUDE.md` do usuário | **Só a parte da config** | A medição de gatilho não é de E30. A parte da config entra no passo 2 do setup (decisão 6): hooks, `statusLine`, lojas extras e plugins habilitados saem; o `CLAUDE.md` do usuário e a variável de modelo ficam, pela paridade com a passada C, e o relatório registra o estado com os sha256 do passo 1. A parte do `CLAUDE.md` que interessa ao gatilho fica para a medição de gatilho, junto do resto da nota, pendente; destino: roadmap futuro, dono executor. |

Resumo: entram antes do lote S3-06 e a parte da config de S3-10, ambas sem código; S2-16 e S2-17 são o próprio objetivo. S2-10, S2-15, S3-02, S3-03, S3-07 e S3-09 não entram e passam a roadmap futuro. Nenhuma nota pede mudança de código antes do lote. A S3-24 (linha dos modos em `task-reviewer.md`) não é deste conjunto: por pendência do `state.md`, só se corrige depois do lote, porque toca os modos `spec` e `quality` que o lote mede.

## Riscos

- **O opus também não pega QL2, SP4 e QL3** e os braços empatam. Esperado e aceito: a R2 mantém o sonnet, o mais barato.
- **Revisor opus mais exigente gera mais achados menores e mais rodadas.** O efeito aparece no custo (limite de 2,5×) e nos `failRiscoAceito` (recontagem).
- **Contaminação no braço sonnet** por revisão opus depois de correção escalada (`maxModel`). Contada à parte no relatório. É o comportamento do produto, por isso não invalida.
- **Deriva no tempo entre os braços** (serviço do modelo, CLI). A CLI fica travada (`DISABLE_AUTOUPDATER`) e é conferida por braço. O braço por braço segue a passada C e permite o teto antecipado do sonnet; a sonda opus logo depois da sonda sonnet dá um ponto de controle no mesmo momento.
- **`CLAUDE_CODE_SUBAGENT_MODEL=sonnet` fica na config** (paridade) e poderia vencer o `model: 'opus'` da chamada. A sonda opus confere o modelo servido; se não for `claude-opus-5-5`, o lote para e volta ao dono, porque tirar a variável quebra a paridade.
- **Sementes já conhecidas.** São as mesmas da passada C; o desenho delas foi conferido por teste (aceite 1 da passada C) e segue verde na suíte acima.

## Decisões do dono

Respostas de 2026-11-17 (via Fable, DEC-006), registradas no tracker do roadmap pós-2.2.0 como DEC-021 (orçamento e ordem) e DEC-022 (config única). Já aplicadas no corpo.

1. **Braço sonnet:** rodar de novo, na mesma árvore, config e CLI do opus. A passada C fica só como referência.
2. **Limiares da R2:** como recomendados (+4 no total, lentes dentro de −2, perdidos −2, custo ≤ 2,5×), com teto do sonnet em 37 (R1).
3. **n:** 10 válidas por braço, 5 por artefato.
4. **Orçamento (DEC-021):** E30 US$ 16 (sonnet até 5, opus até 11), E31 US$ 15 firmes, reserva comum US$ 9 + sobra de E30, liberada só via Fable.
5. **superpowers:** 7.0.0 (`bb92a77`) por loja local com `sha`; duas falhas levam a 7.0.2 fixado do mesmo jeito.
6. **Config (DEC-022):** limpeza parcial pelo setup único: saem hooks, `statusLine`, `extraKnownMarketplaces` e plugins habilitados; ficam `CLAUDE.md` e `CLAUDE_CODE_SUBAGENT_MODEL`, pela paridade.
7. **Mudança de produto:** a decisão é registrada em E30; a mudança vai a um roadmap futuro com spec própria.
8. **Braço `unica` com opus:** fora.
9. **R3:** como recomendada, mais o piso de 10 oportunidades do laço quality.
10. **Regra:** aplicada à mão sobre `armTotals`.
11. **Ordem:** sonnet inteiro e depois opus, com as sondas sonnet A e opus A antes de seguir o braço sonnet. E30 roda antes de E31, um lote por vez.
