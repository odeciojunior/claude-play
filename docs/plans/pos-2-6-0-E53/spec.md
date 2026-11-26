# Spec E53 -- Revisão final e linha de base nova de parada-retomada

Entregável E53 do roadmap `docs/plans/roadmap-pos-2-6-0` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, card E53, fase "2.7.0 medida e publicada"), no caminho crítico, depois de E45, E49, E50, E51 e E52. Cobre REQ-024 (#25). Decisões que regem: DEC-017 (lote de base nova), DEC-005 (T3 é a primeira peça do E53, o lote roda no commit candidato revisado), DEC-004 e DEC-021 (gasto pago e mudança de teto voltam a um subagente opus), DEC-018 (o E49 pode sair por orçamento), DEC-033, DEC-015 e DEC-009 (gatilhos que o lote observa), DEC-036 e DEC-037 (G1 no merge e falha isolada do teste de processos), DEC-016 e DEC-019 (o que fica fora). Código lido em `release/pos-2.6.0` (`94f4152`), worktree `D:/projects/claude-play-wt/pos-2-6-0`. E47, E48 e E49 ainda não estão integrados, então esta spec descreve o procedimento sobre o commit candidato, seja ele qual for, e diz o que muda se algum deles sair.

## Intenção

O workflow alterado por E42 a E49 invalida os limites provisórios de parada-retomada da decisão 060 do pós-2.3.0 (opus 5, sonnet 11, ponderado sem haiku 420). O E53 faz três coisas, nesta ordem:

1. A revisão final T3 (opus, high) da branch `release/pos-2.6.0` inteira, até não restarem achados bloqueantes.
2. Um lote pago único da variante `parada-retomada` do arnês `tools/measure`, no commit candidato já revisado, com `--model opus`, uma execução por vez e o teto de US$ 18 da DEC-017.
3. A DEC dos limites novos, com o registro em `measurements.md`.

Nenhum gasto começa sem uma autorização registrada como DEC antes da primeira execução. Cada regra de parada da DEC-017 é conferida por um script determinístico; a pessoa (ou o delegado opus) entra só nas decisões que o script não pode tomar.

## Escopo

Dentro:

- Script novo `tools/measure/lote-gate.mjs` e o teste `tools/measure/lote-gate.test.mjs` (offline, gratuito). O script confere as regras da DEC-017 sobre as pastas de saída do lote e diz se a próxima execução pode começar. Não é publicado (DEC-003).
- Revisão final T3 de `main...<candidato>` e as correções que ela pedir, na própria `release/pos-2.6.0`, com G1 a G5 verdes no candidato final.
- Lote pago de `parada-retomada` com `tools/measure/run-batch.mjs`, uma invocação com `--runs 1` por execução, até 3 válidas.
- Registros, pelo roadmap-tracker: `docs/plans/roadmap-pos-2-6-0/measurements.md` (novo), `files.measurements` em `docs/plans/roadmap-pos-2-6-0/roadmap.config.json`, a DEC de autorização, a DEC dos limites e as linhas de log em `decisions.md` e `log.md`.
- Relatórios, gravados pelo orquestrador: `docs/reports/<data>-E53-linha-de-base-parada-retomada.md` e o relatório da revisão final.
- Fecho das três pendências de `state.md` marcadas para o E53: `--model` no `run-baseline.mjs` do roteiro, releitura numa retomada com o mesmo `runToken`, e o total do vitest (gatilho da DEC-033).

Fora:

- Push, tag, bump, publicação, branches `volta/` e atualização do cache: são do E54.
- Comentar ou fechar a #25 no GitHub: vai com o fecho do roadmap, pelo tracker, depois do E54.
- Corrigir no código o que o lote mostrar (releitura com `runToken` repetido, aspas, escada de cópia C2, total do vitest no `gateFromCapture`). Isso vira pendência ou DEC nova; reabrir item adiado volta ao delegado opus (DEC-004, DEC-019, DEC-033).
- Mudar `run-baseline.mjs` (ruling R1) e as variantes legadas do arnês (DEC-016).
- Apagar ou deslogar a config descartável e as pastas de saída: só depois da publicação, como no E40.

O que não fazer:

- Não iniciar nenhuma execução paga sem três coisas: a DEC de autorização do gasto (H1) vigente para o candidato, o login da config descartável (H2) e o `lote-gate.mjs` devolvendo `pode-seguir` logo antes.
- Não rodar duas execuções ao mesmo tempo, nem o lote junto com G1, outro lote ou release na mesma máquina.
- Não lançar `run-batch.mjs` sem o prefixo `CLAUDE_CONFIG_DIR=<config>` na mesma linha do comando. O `--config-dir` do arnês só lê a config, e o `claude -p` herda o ambiente do processo (`run-batch.mjs:250-258`). Sem a variável, a sessão paga roda na config real.
- Não mudar o teto de US$ 18, o limite de US$ 6 por execução nem a reserva de US$ 5,50 (DEC-017). Qualquer mudança volta ao delegado opus (DEC-004).
- Não gravar no repositório transcrições, ids de sessão ou caminhos pessoais: só caminhos de pasta de saída, hashes e números (`.claude/rules/measure.md`; spec do E51, Q5).
- Não ler, imprimir ou registrar o valor de credenciais ou de variáveis de ambiente. O orquestrador não roda `env`, `printenv` nem `set`.

## Desenho

### Commit candidato e o que muda se E47, E48 ou E49 saírem

O candidato é a ponta de `release/pos-2.6.0` no momento em que cada entregável de E42 a E52 está `na-branch` (ou integrado) ou `descartado` no painel de `state.md` (critério de entrada da fase). Ele inclui o commit do `lote-gate.mjs`. O SHA entra no log, no relatório, na DEC de autorização e na DEC dos limites.

A medição fica inválida se, entre o candidato e a tag do E54, mudar qualquer arquivo que ela usa: `plugins/` e os arquivos de `tools/measure/` que o `run-batch.mjs` importa. O caso volta ao delegado opus. Duas exceções não invalidam e vão ao delegado só como registro:

- o bump de versão do E54 (manifests e `README.md`, estratégia, card E54);
- mudanças só em `lote-gate.mjs` e no teste dele.

Mudanças fora de `plugins/` e de `tools/measure/` não invalidam. Conferência no E54: `git diff --name-only <candidato> <tag> -- plugins/ tools/measure/`.

O relatório e a DEC dos limites registram, ao lado dos números, o efeito esperado de cada entregável incerto:

- **E49 integrado:** o `release.config.json` do sandbox traz `releaseBranch: 'release/sandbox'` (`plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs`) e o skill sempre passa `repo`. Por isso o agente `preflight-early` (sonnet medium) roda na parada e na retomada, e a retomada mede os portões de novo em vez de reaproveitar o `run.json` (R6 da spec do E49). Esperado em relação a uma base sem o E49: sonnet maior em cerca de 2, ponderado maior em cerca de 40 e retomada mais longa. O executor confere a presença do rótulo `preflight-early` nas duas fases.
- **E49 descartado (DEC-018):** o agente não existe e a retomada usa o registro de base como hoje.
- **E48:** só libera paralelo com `generated: true`, que o sandbox não usa. Sem efeito esperado, com ou sem ele.
- **E47:** só muda a retomada `finish-merge` com testes removidos declarados, que o cenário E5 não tem. Sem efeito esperado.

Se a ausência de um deles aparecer nos números de modo diferente do esperado, o relatório diz qual contador mudou.

### Script de conferência do lote (`tools/measure/lote-gate.mjs`)

**Chamada.** `node tools/measure/lote-gate.mjs --out <pasta do lote> --commit <sha do candidato> --autorizacao <DEC-NNN> --decisions <caminho de decisions.md>`.

**Constantes.** Fixas no código, com a DEC-017 citada no comentário: teto 18,00; limite por execução 6,00; reserva antes de cada execução 5,50; meta de 3 válidas; o lote fecha na 2ª inválida. O script não lança nada e não usa a rede.

**Passos.**

1. **Autorização.** Em `decisions.md`, a linha `<DEC-NNN>` precisa existir com:
   - `E53` na coluna Entregável e Status `vigente`;
   - Origem exatamente `dono` ou `dono (delegado, opus)`;
   - um texto que cite o SHA curto de `--commit` e o teto de US$ 18.
2. **Pastas.** As pastas `parada-retomada-*` de `--out` são lidas na ordem do carimbo do nome. Uma pasta sem `aggregate.json` legível (execução em curso ou morta) dá `parar`. Mesmo assim, o script mostra o custo das transcrições que já estejam em `private/transcripts/`.
3. **Contrato de cada `aggregate.json`.** `variant` `parada-retomada`, `requested` 1, `requestedModel` `opus` e `plugin.commit` igual a `--commit`. `cli`, `superpowers` e `permissionMode` têm de ser iguais em todos os aggregates do lote (`run-batch.mjs:2797-2805`).
4. **`SHA256SUMS`.** O script recalcula o sha256 de cada linha do arquivo e confere que a lista cobre `aggregate.json` e todo arquivo sob `private/`. Divergência dá `parar`.
5. **Classificação de cada execução** (`attempts[0]`):
   - **válida para a DEC-017:** `status === 'valid'` e `integrated === true` (`run-batch.mjs:2775`);
   - **válida no arnês sem integração:** dá `parar`, e o delegado decide, como na decisão 054 do pós-2.3.0 (`docs/plans/roadmap-pos-2-3-0/measurements.md:10-11`);
   - **inválida:** `status` `invalid` ou `denied` (`run-batch.mjs:2611`, `:2795`);
   - **inválida sem sessão** (por exemplo `preflight-processo-matador`, `run-batch.mjs:2484-2488`): custo 0; dá `parar` e não conta sozinha como a 2ª inválida, o delegado decide.
6. **Custo.**
   - Execução válida: `attempts[0].costUsd`.
   - Execução inválida ou negada: o `extract` de `tools/measure/session-metrics.mjs` (importado, offline), com `root` em `private/transcripts` e as sessões dadas pelos `<sid>.jsonl` presentes em `private/transcripts/<k>/`, não por `attempts.json` (uma negada não grava `attempts.json`, `run-batch.mjs:2609-2613`). O custo é `main.cost + total.cost` do run, a mesma parcela de transcrição que `attemptCostUsd` soma (`run-batch.mjs:2016-2019`, `:2749-2752`).
   - `unpriced` não vazio, ou custo `null` numa sessão que existe, dá `parar`.
   - O custo de CLI das inválidas não é gravado em lugar nenhum; o relatório registra isso.
7. **Por execução válida, o script lista:** `counters.structural` (haiku, sonnet, opus, weighted e o ponderado sem haiku), `sessionModels`, `modelDivergence` e os rótulos de repetição. Os rótulos de repetição são os nomes de papel em `private/metrics/<k>/metrics.json` que terminam em `-retry<n>` ou em `load<n>` com n de 2 a 5, mais os de releitura `reread`. Com uma fase divergente, a execução fica válida com ressalva. Com as duas fases divergentes, o script devolve `parar` (R5).
8. **Veredito**, com precedência `parar` > `fechar` > `pode-seguir`:
   - `parar` (código 4) em qualquer destes casos: execução acima de 6,00; acumulado acima de 18,00; autorização ausente ou fora do formato do passo 1; pasta incompleta; `SHA256SUMS` que não confere; aggregate fora do contrato do passo 3; válida sem integração; inválida sem sessão; `unpriced`; duas fases divergentes;
   - `fechar` (código 3) com 3 válidas, ou na 2ª inválida (`invalid` + `denied`), ou quando acumulado + 5,50 > 18,00;
   - `pode-seguir` (código 0) nos outros casos;
   - uso errado sai com código 2.

**Saída.** JSON numa linha com `executions`, `valid`, `invalid`, `accumulatedUsd`, `verdict`, `reason` e `nextMaxBudgetUsd`. `nextMaxBudgetUsd` = mín(3.00, (18.00 − acumulado) / 2), arredondado para baixo em centavos e escrito com ponto, pronto para o CLI (R4).

**Teste e revisão.**

- A tarefa passa pela revisão dupla normal antes do commit e entra no diff da T3.
- O teste cobre cada veredito com pastas montadas à mão em diretório temporário (aggregate, `SHA256SUMS` e transcrição mínima). Pelo menos um caso usa uma pasta gerada pelo próprio `runBatch` com `exec` falso, no formato real.
- Casos obrigatórios:
  - autorização ausente, de outro entregável, `pendente`, com origem `dono (delegado, Fable)` e sem o SHA;
  - `SHA256SUMS` adulterado;
  - negada sem `attempts.json`;
  - válida sem integração;
  - `unpriced`;
  - duas fases divergentes;
  - inválida sem sessão.

**Conferência contra o E39.** Antes do pedido de H1, uma conferência única e offline aplica a função de custo às pastas de `D:/claude-e39-out`. Os valores têm de bater com `docs/plans/roadmap-pos-2-3-0/measurements.md:10-13` a menos de um centavo. Se as pastas não existirem mais, isso vira pergunta ao delegado opus; a conferência não é pulada.

### AC1 -- revisão final T3 sem achados bloqueantes

**Portões antes da revisão.** G1 a G5 rodam no candidato pelo orquestrador, com o worktree parado e nenhuma outra suíte na máquina:

- **G1:** completo, sem a exclusão do gate de onda da DEC-036. O piso é a contagem do último merge registrado em `docs/plans/roadmap-pos-2-6-0/log.md` mais os testes do `lote-gate.test.mjs`. Uma falha isolada do teste "... ended by its own port kill, with its subtree" de `verify-run.test.mjs` segue a DEC-037.
- **G2 e G3:** sem FAIL.
- **G4:** válido.
- **G5:** alvos do `embed.mjs` em dia.

**Revisão.** Um subagente opus com effort high (T3) faz uma revisão adversarial de `git diff main...<candidato>` inteiro: produto, `tools/measure` e docs de referência. Ele recebe como contexto as specs de E42 a E52 e as DECs vigentes, e devolve achados classificados em bloqueante, importante e menor, cada um com arquivo e linha.

**Rodadas.**

- Achado bloqueante é corrigido na branch por um executor no tier da política global, com G1 a G5 de novo.
- A rodada seguinte revisa as correções e os achados abertos sobre o novo `main...<candidato>`.
- Na terceira rodada ainda com bloqueante, o processo para e volta ao delegado opus (DEC-021).
- Achado importante ou menor não corrigido entra no relatório como aceito, com o motivo.

**Registro.** Subagentes não gravam arquivos com nome de relatório, então o orquestrador grava o texto devolvido em `docs/reports/<data>-E53-revisao-final.md`. O tracker cita no log o caminho e o SHA revisado. O AC1 fecha quando a última rodada devolve zero bloqueantes no candidato que vai ao lote.

### AC2 -- lote, `SHA256SUMS` conferido e DEC dos limites

**Ponto de autorização (H1).** Depois do AC1 e antes de qualquer `claude -p` pago, o orquestrador leva o pedido de gasto ao dono. As duas vias possíveis:

- a estratégia lista a aprovação como pendência do dono, e `.claude/rules/measure.md:9` pede autorização explícita dele;
- a DEC-004 com a DEC-021 delega qualquer gasto pago ao opus.

O pedido traz o candidato (SHA curto), o teto de US$ 18, as regras da DEC-017, a projeção de cerca de US$ 4,4 por válida (ASSUMPTION da estratégia) e de US$ 3 por inválida, e o resultado da conferência contra o E39. A autorização só vale como DEC registrada pelo roadmap-tracker em `decisions.md` com:

- Entregável `E53` e Status `vigente`;
- Origem exatamente `dono` ou `dono (delegado, opus)`, conforme a via que valeu;
- texto que cite o SHA curto do candidato e o teto de US$ 18.

Um candidato novo exige autorização nova. Esta spec não autoriza gasto nenhum. O `lote-gate.mjs --autorizacao` é a conferência por script; sem a DEC, ele devolve `parar` antes da primeira execução.

**Preparação, sem gasto.**

- **Worktree:** um worktree destacado do candidato fora do repositório (por exemplo `D:/claude-e53-cand`, com `git worktree add --detach`). O arnês roda dele, e o `--plugin-dir` é `<worktree>/plugins/productivity-tools`. Para `parada-retomada`, o arnês não grava `harnessCommit` nem avisa diferença de commit (`prepareHarness` devolve null sem `--stage`, `run-batch.mjs:1336-1340`, `:2452-2463`). Por isso, antes de cada execução, o executor confere que `git -C <worktree> rev-parse HEAD` é o candidato e que `git -C <worktree> status --porcelain` sai vazio (o `plugin.commit` vem do `git rev-parse HEAD` da pasta, `run-batch.mjs:128-130`).
- **Config descartável:** uma config nova (por exemplo `D:/claude-e53-cfg`), montada como a do desenho do E31 (`docs/plans/2026-11-17-measure-e31-parada-retomada-design.md`, seção Lote) e com o mesmo `env` da config do E39. O sha256 do `settings.json` dela é anotado ao lado do sha256 do da config do E39.
- **Login (H2):** o padrão é o login interativo do dono na config descartável. O token só entra se o dono o puser no ambiente por conta própria; nunca vai no chat nem num comando.
- **Pastas de trabalho e de saída:** `--work` e `--out` fora do repositório (por exemplo `D:/claude-e53-work/x<i>` e `D:/claude-e53-out`).
- **Parâmetros do E39:** `permissionMode` e `--ratify` vêm do `aggregate.json` das válidas do E39 em `D:/claude-e39-out` (campo `permissionMode`; `ratify: 'off'` ou `ratified` nas tentativas). As regras `--allow` não são gravadas no aggregate (`run-batch.mjs:2790-2806`). Elas vêm do desenho do E31 (linhas 70-72) e do relatório do E39, ou de decisão do delegado opus antes de gastar.
- **Antes de cada execução:** `claude --version` e o sha256 do `settings.json` têm de ser iguais aos anotados no início; se mudarem, o lote para. Com a pasta de saída vazia, o `lote-gate.mjs` deve devolver `pode-seguir` com `nextMaxBudgetUsd` `3.00`.

**Cada execução.** O comando é este modelo pronto, rodado de dentro do worktree do candidato, com `<i>` crescente e `<budget>` igual ao `nextMaxBudgetUsd` do último veredito:

```
cd <worktree>
CLAUDE_CONFIG_DIR=<config> node tools/measure/run-batch.mjs --variant parada-retomada --runs 1 --model opus --stop-on-denial --ratify <do E39> --work <work>/x<i> --out <out> --config-dir <config> --permission-mode <do E39> --allow <regra>... --plugin-dir <worktree>/plugins/productivity-tools --max-budget-usd <budget>
```

Logo antes de lançar, uma conferência compara o caminho resolvido de `CLAUDE_CONFIG_DIR` com o de `--config-dir`; se forem diferentes, o comando não é lançado. Logo depois de cada execução:

- `sha256sum -c SHA256SUMS` dentro da pasta da execução (pessoa ou executor, Git Bash);
- `lote-gate.mjs` (script).

O veredito decide o próximo passo: `pode-seguir` libera a próxima execução; `fechar` encerra o lote; `parar` encerra e leva a saída do script ao delegado opus. A primeira execução também revalida a ASSUMPTION de custo da estratégia: o executor registra o custo dela e, se passar de US$ 5,50, avisa o delegado antes da segunda, mesmo com `pode-seguir`.

**Como cada regra é conferida.**

| Regra | Quem confere |
|---|---|
| Teto de US$ 18 e reserva de 5,50 antes de cada execução | Script (`accumulatedUsd` e veredito). O teto é garantido pela reserva, não pela trava `--max-budget-usd` (R4). Se o total passar de 18, o E53 não fecha e o caso vai ao delegado. |
| Uma execução por vez | Procedimento (uma invocação `--runs 1`; a seguinte só depois do veredito) e script (`requested` 1; pasta sem aggregate dá `parar`). |
| Execução acima de US$ 6 | Script. |
| Segunda inválida | Script. |
| Modelo opus | Argumento `--model opus` e script (`requestedModel`, `modelDivergence`, R5). |
| Commit medido | Executor (`rev-parse` e `status --porcelain`) e script (`plugin.commit`, mais `cli`, `superpowers` e `permissionMode` iguais). |
| `SHA256SUMS` | Script e `sha256sum -c`. |
| Autorização | Script (linha da DEC) e dono ou delegado (a decisão em si). |
| Limites | Script (contadores e rótulos de repetição); a classificação de "valor limpo" e a DEC ficam com o delegado opus. |

**Observações que o lote fecha.** Ficam registradas no relatório e em `measurements.md`. Um achado vira pendência em `state.md` pelo tracker, sem código no E53.

- **(a) Releitura com o mesmo `runToken`** (pendência do E43): o executor confere nas transcrições de `private/transcripts/<k>/` que o `runToken` da retomada difere do da parada (o skill gera um novo a cada lançamento) e que nenhuma linha de releitura aceita na retomada tem nonce da parada. Se o caso aparecer, vira pendência com a execução citada.
- **(b) Total do vitest** (DEC-033): o único portão do sandbox é `node --test` (`make-sandbox.mjs`), então o gatilho não é observável neste lote. A pendência continua fora do escopo, e o registro diz isso.
- **(c) `--model` no `run-baseline.mjs`** (achado m1 do E51): o roteiro não usa `run-baseline.mjs` (R1); a pendência fecha com esse registro.
- **(d) Gatilhos da DEC-009, da DEC-015 e da DEC-019:** releitura falhando, aspas perdidas em valores aspeados, e válida com mais de 2 rótulos de repetição ou com `discovery-retry3`. São listados por execução, a partir dos rótulos do script e das transcrições. O que disparar vai ao delegado opus no fecho.

**DEC dos limites.**

- **Com 3 válidas:** os limites saem da regra da DEC-017. Para opus, sonnet e ponderado sem haiku, o limite é o maior valor limpo das válidas, sem margem; sonnet 12 só entra se veio sem gatilho de repetição. O haiku ganha só limite de alerta: o máximo das válidas mais 5.
- **Com 2 válidas:** os mesmos cálculos, marcados provisórios (DEC-017).
- **Com menos de 2:** não há DEC de limites e valem os da decisão 060 do pós-2.3.0. O AC2 não fecha e o caso volta ao delegado opus (gatilho "Revisitar quando" da DEC-017).

A DEC é proposta pelo roadmap-tracker, aprovada pelo delegado opus e registrada com alcance contrato. Ela traz o candidato, a composição (E47, E48 e E49 integrados ou não), os números por válida, as ressalvas de `modelDivergence` e os gatilhos observados.

`measurements.md` recebe uma linha por execução, do tipo `run`, com: pasta de saída, SHA do plugin, situação, contadores, custo e a origem dele, ressalvas, e os hashes do `aggregate.json` e do `SHA256SUMS`. Recebe também uma linha de fecho com o total do lote contra o teto. Nenhuma transcrição ou id de sessão entra no arquivo.

O AC2 fecha quando três coisas valem juntas: há pelo menos 2 válidas (integradas) com `SHA256SUMS` conferido; a DEC dos limites está registrada; e `aggregate.json` e `SHA256SUMS` estão citados em `measurements.md`.

## Para o plano

- **Ordem:**
  1. tarefa do `lote-gate.mjs` com teste, com revisão dupla (pode correr antes do merge de E47 a E49, porque só toca `tools/measure`);
  2. fixação do candidato;
  3. G1 a G5;
  4. rodadas T3;
  5. conferência contra o E39;
  6. autorização (H1) e login (H2);
  7. preparação;
  8. execuções;
  9. registros.
- As tarefas com gasto e as de registro não vão a coordinator: ficam com o orquestrador, em série.
- Texto exato do pedido de autorização ao dono, com a projeção, as regras e o SHA curto.
- Lista exata dos alvos do G5 e do piso do G1 no momento do candidato.
- Valores de `permissionMode`, `--ratify` e das regras `--allow` lidos antes da primeira execução. Se não forem legíveis, decidir com o delegado opus antes de gastar.
- Montagem da config descartável com o `env` da do E39, sem tocar `~/.claude`.
- Formato das linhas de `measurements.md` contra o `check-roadmap.mjs` (7 colunas), depois que `files.measurements` passar a `measurements.md`.

```json data
{
  "schema": "spec/1",
  "id": "E53",
  "title": "Revisão final e linha de base nova de parada-retomada",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o commit candidato, quando a revisão final T3 termina, então não restam achados bloqueantes. {verify: human; evidence: revisor final opus high, relatório citado no log}"
    },
    {
      "id": "AC2",
      "text": "Dado o lote, quando ele fecha, então há pelo menos 2 válidas com SHA256SUMS conferido e uma DEC registra os limites. {verify: human; evidence: executor, aggregate.json e SHA256SUMS citados em measurements.md}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "O lote roda pelo run-baseline.mjs (com --model, como pede a pendência do E51) ou direto pelo run-batch.mjs?",
      "decision": "Direto pelo run-batch.mjs, uma invocação com --runs 1 e --model opus por execução. O run-baseline.mjs não entra no roteiro e não é alterado, e a pendência do E51 fecha com esse registro (qualquer uso futuro do run-baseline.mjs, mesmo em --dry-run, leva --model).",
      "basis": "O run-baseline.mjs exige a tag padrão productivity-tools--v1.6.0 ou outra tag existente, roda as 3 execuções numa chamada e não para entre elas por custo, o que contraria a execução por vez e as paradas da DEC-017. Sem --model ele já falha antes de gastar, porque o runBatch chama requireModel.",
      "alternative": "run-baseline.mjs --only parada-retomada --model opus com uma tag criada para o candidato.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como as regras de gasto e de parada da DEC-017 são conferidas entre as execuções?",
      "decision": "Por um script novo, tools/measure/lote-gate.mjs, com teste offline (inclusive uma pasta gerada por runBatch com exec falso), revisão dupla e commit antes da revisão T3, para entrar no diff revisado. Ele lê as pastas de saída e a DEC de autorização e devolve parar, fechar ou pode-seguir, nessa precedência.",
      "basis": "A política global pede verificação determinística para conferências mecânicas, e a aritmética de teto, reserva e limite por execução feita à mão por um agente é o tipo de cópia que já falhou no arnês. O script também confere o SHA256SUMS, o commit medido e a integração do E5.",
      "alternative": "O delegado opus somar à mão o cost.total e os custos das inválidas a partir dos aggregate.json.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Qual custo uma execução inválida ou negada soma ao acumulado e à regra de US$ 6, se o aggregate só traz costUsd das válidas?",
      "decision": "O extract do session-metrics.mjs, offline, com root em private/transcripts e as sessões dadas pelos <sid>.jsonl presentes em private/transcripts/<k>/; o custo é main.cost + total.cost do run, a mesma parcela de transcrição de attemptCostUsd. unpriced não vazio, ou custo null numa sessão que existe, dá parar. O custo é 0 sem sessão, e o relatório registra que o custo de CLI das inválidas não é gravado.",
      "basis": "O E51 grava costUsd e cost.total só para válidas, mas copia as transcrições de toda tentativa antes de qualquer saída (run-batch.mjs:2609). Uma negada não grava attempts.json, por isso as sessões vêm dos arquivos. Sem somar as inválidas, o teto seria subestimado (no E39 as duas inválidas custaram US$ 5,94).",
      "alternative": "Contar só o cost.total das válidas e estimar US$ 3 por inválida.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Que --max-budget-usd passar a cada claude -p do lote?",
      "decision": "mín(3.00, (18.00 menos o acumulado) / 2), calculado pelo lote-gate.mjs antes de cada execução e passado ao CLI com ponto. É só uma trava adicional por sessão: o teto é garantido pela reserva de 5,50 da DEC-017. Se o total passar de 18, o E53 não fecha e o caso vai ao delegado opus.",
      "basis": "O --max-budget-usd limita só o custo de CLI de cada sessão. No E39 o custo real foi cerca de 1,55 vez o de CLI (4,37 contra 2,83 e 4,34 contra 2,78), então a última execução pode passar do teto de US$ 18. O teto é garantido pela reserva de 5,50 da DEC-017, não pela trava.",
      "alternative": "--max-budget-usd 6 por sessão, como no E31, que deixa uma execução chegar a 12 de CLI.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Uma execução com modelDivergence conta como válida para a meta da DEC-017?",
      "decision": "Com uma fase divergente, a execução é válida com ressalva registrada em measurements.md e na DEC dos limites, e o custo dela entra no acumulado. Com as duas fases divergentes, o lote-gate.mjs devolve parar e o delegado opus decide se ela conta.",
      "basis": "Os contadores estruturais contam subagentes com modelo fixado no workflow e não mudam com o modelo de uma fase da sessão principal. Esse foi o critério da decisão 058 do pós-2.3.0 para a execução 3 do E39, e o E51 deixou o tratamento ao E53. As duas fases fora de opus contrariam o --model opus da DEC-017.",
      "alternative": "Invalidar toda execução divergente e repetir, o que gasta até US$ 4,4 a mais dentro do mesmo teto.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Em qual measurements.md o lote é registrado, se o roadmap.config.json deste roadmap tem files.measurements nulo?",
      "decision": "Num docs/plans/roadmap-pos-2-6-0/measurements.md novo, no formato de 7 colunas do pós-2.3.0, com files.measurements passando a measurements.md. As duas mudanças são do roadmap-tracker.",
      "basis": "O card cita measurements.md, e o check-roadmap.mjs já aceita o papel measurements com 7 colunas. Registrar no arquivo do pós-2.3.0 misturaria gastos de dois roadmaps com tetos diferentes.",
      "alternative": "Acrescentar as linhas ao docs/plans/roadmap-pos-2-3-0/measurements.md.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Qual o alcance da revisão final T3 e quando ela para?",
      "decision": "Branch inteira (git diff main...<candidato>), por subagente opus high adversarial. Bloqueante é corrigido e revisado de novo; na terceira rodada ainda com bloqueante, o processo para e volta ao delegado opus.",
      "basis": "A DEC-005 põe a T3 como portão do commit que vai ao lote e ao E54. As revisões por entregável não veem as interações entre E42 e E49 no mesmo roadmap-release.js. O pós-2.3.0 aprovou na 3ª e na 4ª rodada (E41), o que justifica o limite de 3 antes de escalar.",
      "alternative": "Revisar só o delta desde a última revisão de cada entregável.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Que mudança depois do candidato invalida o lote?",
      "decision": "Qualquer mudança, entre o candidato e a tag do E54, nos arquivos que a medição usa (plugins/ e os arquivos de tools/measure/ que o run-batch.mjs importa) invalida o lote e volta ao delegado opus. Não invalidam: o bump de versão do E54 (manifests e README) e mudanças só em lote-gate.mjs e no teste dele, que vão ao delegado como registro. Mudanças fora de plugins/ e tools/measure/ não invalidam. Conferência: git diff --name-only <candidato> <tag> -- plugins/ tools/measure/. O candidato só é fixado depois de todos os entregáveis de engenharia estarem na branch ou descartados.",
      "basis": "A DEC-017 e a tese da estratégia medem a base no commit que será publicado, e o card E54 prevê o bump nos manifests e no README. O E49 sozinho muda o contador sonnet e o tempo da retomada.",
      "alternative": "Aceitar mudanças pequenas de produto depois do lote, com nota no relatório.",
      "costIfWrong": "high",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "As pendências do E43 (runToken repetido) e do vitest (DEC-033) são corrigidas no E53?",
      "decision": "Não: o lote só observa e registra. O runToken é conferido nas transcrições, e o gatilho do vitest é declarado não observável, porque o portão do sandbox é node --test. Um caso observado vira pendência pelo tracker.",
      "basis": "O E53 é de medição. Corrigir mexeria no workflow depois da T3 e invalidaria o candidato (R8), e a DEC-033 tira o vitest deste roadmap.",
      "alternative": "Corrigir a releitura no E53 antes do lote.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "O que conta como válida para a meta da DEC-017?",
      "decision": "attempts[0].status === 'valid' e attempts[0].integrated === true. Uma execução válida no arnês sem integração faz o lote-gate.mjs devolver parar, e o delegado opus decide.",
      "basis": "releaseRunValidity só exige agentes (run-batch.mjs:1641-1645), e o integrated é gravado à parte (run-batch.mjs:2775). No E39 houve duas execuções válidas no arnês que bloquearam a entrega na retomada, tratadas pela decisão 054 do pós-2.3.0.",
      "alternative": "Aceitar como válida qualquer execução com status valid.",
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
      "why": "A estratégia lista a aprovação como pendência do dono, e .claude/rules/measure.md:9 pede autorização explícita do dono. A DEC-004 com a DEC-021 delega qualquer gasto pago ao opus. O pedido vai ao dono, e a DEC registra qual das duas vias valeu.",
      "blocking": false,
      "workaround": "O AC1 (revisão T3, G1 a G5, o lote-gate.mjs e a conferência contra o E39) segue sem gasto; o lote espera a DEC."
    },
    {
      "id": "H2",
      "kind": "credential",
      "what": "Login da conta na config descartável do lote. O padrão é o login interativo do dono nessa config. O token (variável de ambiente CLAUDE_CODE_OAUTH_TOKEN) só entra se o dono o puser no ambiente por conta própria, nunca no chat nem num comando.",
      "why": "Cada execução roda claude -p com CLAUDE_CONFIG_DIR na config descartável, que precisa estar logada; a config real não pode ser usada (.claude/rules/measure.md). O orquestrador não roda env, printenv nem set.",
      "blocking": false,
      "workaround": "O AC1 segue sem credencial; o lote espera o login."
    }
  ],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Chamadas pagas de claude -p (duas sessões por execução, até 3 válidas e 2 inválidas), dentro do teto de US$ 18 garantido pela reserva da DEC-017.",
      "target": "conta Anthropic do dono (faturamento)"
    },
    {
      "id": "X2",
      "what": "Login da conta numa config descartável nova e criação de worktree, pastas de trabalho e pastas de saída fora do repositório.",
      "target": "máquina local do dono (D:/claude-e53-*) e sessão da conta"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "A segunda execução inválida (invalid ou denied, com sessão) do lote termina.",
      "expected": "O lote-gate.mjs devolve fechar, e o lote fecha com as válidas que houver: com 2 ou mais, limites provisórios; com menos de 2, sem DEC de limites, e o caso volta ao delegado opus."
    },
    {
      "id": "C2",
      "input": "Uma execução custa mais de US$ 6 pelo costUsd ou pelo custo das transcrições.",
      "expected": "O lote-gate.mjs devolve parar; nenhuma execução nova começa, e o caso vai ao delegado opus com a saída do script."
    },
    {
      "id": "C3",
      "input": "Uma execução fica válida no arnês, mas sem E5 integrado.",
      "expected": "O lote-gate.mjs devolve parar, e o delegado opus decide como tratá-la, como na decisão 054 do pós-2.3.0."
    },
    {
      "id": "C4",
      "input": "Uma pasta de saída sem aggregate.json, ou com SHA256SUMS que não confere com os arquivos.",
      "expected": "O lote-gate.mjs devolve parar e mostra o custo das transcrições já copiadas; a execução não conta como válida para o AC2 até o caso ser resolvido com o delegado opus."
    },
    {
      "id": "C5",
      "input": "O lote-gate.mjs roda sem DEC de autorização vigente, com origem diferente de dono ou dono (delegado, opus), ou com DEC que não cita o SHA do candidato.",
      "expected": "Devolve parar antes da primeira execução, e nada pago é lançado."
    }
  ]
}
```
