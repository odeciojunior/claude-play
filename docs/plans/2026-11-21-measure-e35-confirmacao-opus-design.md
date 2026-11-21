# E35: confirmação do revisor por tarefa opus com S3-24 e regra formal da R3 para empate marginal 1×1

Data: 2026-11-21. Branch: `release/pos-2.3.0` (`docs/plans/pos-2-3-0-E35/spec.md` e `plan.md`, `78a3ad1`). Base: card E35 da estratégia `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` (`REQ-002`, `REQ-009`), decisões `DEC-001`, `DEC-002`, `DEC-004`, `DEC-005` e `DEC-012` do roadmap pós-2.3.0, `DEC-023` e `DEC-031` do pós-2.2.0, desenho de E30 (`docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`) e relatório de E30 (`docs/reports/2026-11-17-E30-revisor-opus.md`). Este documento só desenha o lote e fixa as regras antes do gasto; não dispara chamadas pagas.

## Objetivo

1. **Formalizar a regra da R3 para o empate marginal `1×1` (B04 / DEC-005).** Fechar a lacuna registrada na observação 3 do relatório de E30 sobre o caso de 1 captura marginal do laço `quality` em cada braço, e aplicar a regra aos dados preservados de E30 sem lote pago adicional dedicado à R3.
2. **Confirmar o revisor por tarefa `opus` com `S3-24` em `agents/task-reviewer.md` (DEC-004 / DEC-031 do pós-2.2.0).** Medir em 10 execuções válidas do braço único `opus` em `lentes-semeadas-A/B` (teto **US$ 7,00**) se a restrição de campos por modo (`verdicts` só em `restricted`, `spec`/`quality` só em `review`) preserva o ganho de capturas do revisor `opus` medido em E30 (`28/40`, contra `20/40` do `sonnet`).

## Regra formal da R3 (laço quality e empate marginal 1×1 -- B04)

Em E30 (`docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`), a condição **Retirar** exigia `0` capturas marginais nos dois braços (`0×0`), enquanto **Manter** exigia `>= 2` capturas marginais apenas no braço vencedor pela R2 (`opus`), deixando o empate `1×1` (`sonnet: 1`, `opus: 1`) no balde genérico `Inconclusivo, mantém`.

Com a regra formalizada em E35 (`DEC-005`, `R3` da spec de E35), mantêm-se a definição de **captura marginal do laço `quality`** (semente capturada em tentativa válida cujo primeiro achado que a nomeia vem de uma rodada `quality`, `capturadoPor[id].kind === 'quality'`, prevalecendo a leitura do diário sobre o regex nos casos sem menção) e o **piso de oportunidades** (`>= 10` sementes de `quality` que chegam ao laço `quality` sem captura prévia pelo laço `spec`, somadas nos braços rodados):

| Condição (com piso de oportunidades `>= 10` e braço `opus` rodado) | Desfecho formal da R3 |
|---|---|
| `0` capturas marginais nos dois braços (`0×0`) | **Retirar** (proposta em spec própria) |
| `>= 2` capturas marginais no braço escolhido pela R2 **ou** `>= 1` captura marginal em cada braço (`1×1`, somando `>= 2` capturas marginais independentes com evidência positiva no braço escolhido) | **Manter (conclusivo)** |
| Piso `< 10`, braço `opus` não rodado, `0` capturas marginais no braço escolhido pela R2 ou apenas `1` captura marginal no braço escolhido com `0` no outro (`1×0`) | **Inconclusivo, mantém** |

### Aplicação aos dados preservados de E30 (`D:/claude-e30-out`)

- **Oportunidades que chegaram ao laço `quality`:** `27 >= 10` (piso atingido; em `10` tentativas por braço, `sonnet` teve `15` oportunidades não pegas no laço `spec` e `opus` teve `10` de `B` + parte de `A`, somando `27` reportadas em `docs/reports/2026-11-17-E30-revisor-opus.md`).
- **Capturas marginais observadas:** `sonnet = 1` (`A-3`, semente `QL1`) e `opus = 1` (`B-5`, semente `QL4`), caso exato `1×1` (2 capturas marginais independentes em sementes distintas de qualidade, com evidência positiva no braço `opus` escolhido pela R2).
- **Veredito formal pela nova regra:** **Manter (conclusivo)** o laço `quality`. Sem lote pago adicional dedicado à R3 (`DEC-005`). O lote de confirmação de E35 ainda registra o contador de capturas marginais do braço `opus` para acompanhamento.

## Braço medido e premissa do arnês

- **Mudanças de produto já aplicadas na ponta da branch (`release/pos-2.3.0`):**
  1. `reviewModelFor()` em `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` devolve `'opus'` por padrão (`625e535`);
  2. `plugins/productivity-tools/agents/task-reviewer.md` restringe `verdicts` ao modo `restricted` e `spec`/`quality` ao modo `review` (`S3-24`, `78a3ad1`).
- **Braço único (`DEC-004`):** `--stage task-review --rounds loop --arm atual --review-model opus` (dois laços em série `H_KINDS = ['spec', 'quality']`, `H_TR = { restricted: false, single: false }`, corretor `sonnet`, revisor `opus` / effort `medium`, `maxFix: 2`, `byId: true`).
- **Sementes:** `lentes-semeadas-A` (`SP1`, `SP2`, `QL1`, `QL2`) e `lentes-semeadas-B` (`SP3`, `SP4`, `QL3`, `QL4`), `5` válidas por artefato = `10` válidas ao todo (`40` oportunidades: `20` `spec`, `20` `quality`).
- **Ordem das execuções:** sonda `opus` em `lentes-semeadas-A` primeiro (`--runs 1`; se válida no mesmo commit, arnês e config, conta como 1ª tentativa válida `A-1`), seguida das demais execuções intercaladas por artefato (`B, A, B, A, B, A, B, A, B`). Tentativa inválida é reposta no mesmo artefato antes de prosseguir.

## Regra de decisão e piso de não-regressão (fixados antes do lote -- R4 / DEC-004)

Referência do braço `opus` sem `S3-24` em E30 (`docs/reports/2026-11-17-E30-revisor-opus.md`): `28/40` capturas (`spec 18/20`, `quality 10/20`, perdidos `12/40`, indeterminados `0`, custo `US$ 0,561`/válida, total `US$ 5,613`), contra `20/40` do `sonnet` (`spec 15/20`, `quality 5/20`, limiar de entrada da R2 em E30 `>= 24/40`).

O lote de confirmação **aprova `reviewModelFor = 'opus'` junto de `S3-24`** se, após `10` tentativas válidas somadas por `armTotals` (e sustentado nas duas recontagens canônicas — `semMencao` lida no diário e `failRiscoAceito` tratado como indeterminado), todas as condições abaixo valerem ao mesmo tempo:

| Critério | Piso fixado (40 oportunidades) | Referência E30 (`opus`) |
|---|---|---|
| Determinadas | `>= 32 / 40` | `40 / 40` |
| Capturas totais | `>= 26 / 40` | `28 / 40` (máx. `-2`, acima do limiar `24` da R2) |
| Capturas lente `spec` | `>= 16 / 20` | `18 / 20` (máx. `-2`, acima de `15` do `sonnet`) |
| Capturas lente `quality` | `>= 8 / 20` | `10 / 20` (máx. `-2`, acima de `5` do `sonnet`) |
| Perdidos totais | `<= 14 / 40` | `12 / 40` (máx. `+2`) |
| Achados sintéticos / divergências | `sinteticoGerado === 0` e `laco-divergente === 0` | `0` e `0` |
| Gasto total acumulado de E35 | `<= US$ 7,00` | `US$ 5,613` (`0,561`/válida) |

- **Se alguma condição de captura ou perdidos falhar** ao completar `10` execuções válidas (ou cair abaixo do piso em alguma das duas recontagens `semMencao` / `failRiscoAceito`): **reverter `S3-24`** em `plugins/productivity-tools/agents/task-reviewer.md` e manter `reviewModelFor` devolvendo `'opus'` (já comprovado em `28/40` com o texto anterior em E30).

## Sondas, paradas e orçamento (DEC-002 / DEC-004)

- **Sonda inicial (`A-1`):** `lentes-semeadas-A`, `--runs 1`, conferindo antes de seguir:
  1. tentativa válida, com `harnessCommit` igual ao commit do plugin em `D:/claude-pos23-release`;
  2. `agentType` igual a `productivity-tools:task-reviewer` e `message.model` nas transcrições dos subagentes `E5:t3:spec1` e `E5:t3:quality1` pertencente à família `opus` (`claude-opus-*`);
  3. nenhum plugin `@claude-play` carregado (`enabledPlugins`, `installed_plugins.json`, `known_marketplaces.json` e `plugins/cache` sem `claude-play`);
  4. `superpowers` em `7.0.0` (`bb92a77741419a4ab5f06e711a283343f1ada0c3`), versão da CLI e `sha256` do `settings.json` inalterados;
  5. custo da sonda `<= US$ 0,70` (projeção `sonda × 10 <= US$ 7,00`) e custo unitário `<= US$ 6,00` (`DEC-002`).
- **Paradas durante o lote** (somadas por `armTotals` entre `A` e `B`):
  - `> 3` inválidas no lote; `>= 2` `laco-divergente`; `>= 2` `semente-ausente`;
  - qualquer `bloqueou-sintetico > 0` ou `sinteticoGerado > 0`;
  - execução unitária acima de `US$ 6,00` (`DEC-002`) ou gasto acumulado de E35 atingindo `US$ 7,00` antes de completar `10` válidas -> parar e voltar ao dono via Fable (`DEC-012`);
  - mudança de versão da CLI, de commit do `superpowers` ou de árvore em `plugins/` / `tools/measure/`.
- **Concorrência:** nenhum outro lote pago, `G1` ou release pode rodar em paralelo (`DEC-009`). Recomenda-se rodar **E38** antes do lote pago (ou usar pré-voo e sentinela de processos ativos contra encerramento externo de `node.exe`).

## Ambiente isolado e comando do lote

1. **Config descartável (`D:/claude-pos23-cfg`):** criada e logada pelo dono via `CLAUDE_CONFIG_DIR=D:/claude-pos23-cfg claude auth login`, com `DISABLE_AUTOUPDATER=1`, sem hooks nem `statusLine` do usuário, `extraKnownMarketplaces` sem `claude-play`, `enabledPlugins = {}` e `superpowers` fixado em `7.0.0` (`bb92a77741419a4ab5f06e711a283343f1ada0c3`) via loja local `D:/claude-pos23-mkt` com `"autoUpdate": false` em todas as lojas.
2. **Worktree destacada fora do repositório (`D:/claude-pos23-release`):** criada a partir da ponta de `release/pos-2.3.0` após T3 (com `reviewModelFor -> 'opus'` e `S3-24`), registrando `git rev-parse HEAD:plugins HEAD:tools/measure`.
3. **Execução (a rodar somente após login e autorização):**
   ```powershell
   $env:CLAUDE_CONFIG_DIR = 'D:/claude-pos23-cfg'
   $env:DISABLE_AUTOUPDATER = '1'
   Set-Location D:/claude-pos23-release
   node tools/measure/run-batch.mjs --variant lentes-semeadas-<A|B> --runs 1 `
     --work D:/claude-e35-work/opus/<artefato>-<k> --out D:/claude-e35-out/opus/<artefato>-<k> `
     --config-dir D:/claude-pos23-cfg --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 `
     --stage task-review --rounds loop --arm atual --review-model opus `
     --plugin-dir D:/claude-pos23-release/plugins/productivity-tools --stop-on-denial
   ```
4. **Registro após o lote:** consolidar os `10` agregados válidos via `armTotals`, conferir `SHA256SUMS` das transcrições em `D:/claude-e35-out`, acrescentar a linha de E35 em `docs/plans/roadmap-pos-2-3-0/measurements.md` e gravar o relatório em `docs/reports/2026-11-<dd>-E35-confirmacao-revisor-opus.md`.
