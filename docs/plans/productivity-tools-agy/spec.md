# Spec productivity-tools-agy -- Refatoração dual-host do plugin productivity-tools para Claude Code e Antigravity (agy) com roteamento Gemini por complexidade

## Intenção

Adaptar o plugin `plugins/productivity-tools` para funcionar nativamente em dois ambientes — **Claude Code** e **Google Antigravity (`agy`)** — roteando cada etapa e tarefa para o tier Gemini adequado (`flash_lite`, `flash`, `pro`) de acordo com o nível de complexidade (0–10), sem quebrar nenhum contrato, teste ou digest FNV-1a (`plan/1` e `progress/1`) existente no Claude Code.

A filosofia central *"cheapest route that finishes it first time"* (minimizar o custo total esperado considerando o custo de falhas, revisões e rodadas de correção) precisa ser traduzida dos 4 patamares de implementação do Claude (`(haiku, low)`, `(sonnet, medium)`, `(sonnet, high)`, `(opus, medium)`) para os 3 tiers discretos da API do `agy` (`flash_lite`, `flash`, `pro`, além de `inherit`), onde `run_workflow` (`agent(...)`) e `invoke_subagent` não expõem um parâmetro `effort` separado. Ao mesmo tempo, o runtime Python real do `run_workflow` no `agy` permite eliminar chamadas LLM puramente mecânicas (`script-runner`) substituindo-as por `subprocess.run` determinístico com custo zero de tokens e zero risco de erro de transcrição.

**Princípio de estado canônico:** o tier gravado em `plan.md` e em `progress.json` é sempre o tier Claude (`haiku`, `sonnet`, `opus`). A tradução para Gemini acontece só no momento do despacho, nos workflows Python. Assim um mesmo `progress.json` pode ser retomado por qualquer um dos dois hosts.

## Escopo

### Dentro

- `plugins/productivity-tools/lib/agy-routing.mjs` (novo, fonte pura DEC-058, sem imports, **não embutido** em nenhum alvo de `embed.mjs`): exporta `AGY_MODEL_RANK`, `agyModelFor(tier, effort)`, `agyReviewModelFor(reviewTier, gate, agyModel)`, `nextAgyTier(model, sameFindingAgain)` e `toAgyRoute(r)`, que recebe a saída de `route()` de `lib/routing.mjs`. `lib/routing.mjs` fica byte a byte inalterado.
- `plugins/productivity-tools/scripts/agy-bridge.py` (novo): helper Python compartilhado pelos dois workflows `agy`, carregado por `exec(compile(...))` (o runtime do `run_workflow` não permite importar módulos locais). Concentra a ponte `node --input-type=module` para `lib/*.mjs`, a execução de CLIs e `git` via `subprocess.run(..., shell=False)`, a resolução explícita do Git Bash no Windows, a leitura dos corpos de `agents/*.md`, a extração dos schemas JSON e do programa de test-integrity dos workflows JS (fonte única) e a guarda read-only por snapshot git.
- Workflows Python para a tool `run_workflow` do `agy` (com basenames únicos em todo o plugin para passar no Check 7b de `lint-plugin.mjs`):
  - `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py`
  - `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py`
  Ambos executam operações determinísticas (`progress.mjs`, `preflight.mjs`, `verify-run.mjs`, `spec-tool.mjs`, `plan-tool.mjs`, `roadmap.mjs`, `git`, `test-integrity` e ponte com `lib/*.mjs`) via `agy-bridge.py` (0 tokens de `script-runner`) e despacham `await agent(prompt, schema, role=..., model=...)` apenas para etapas cognitivas (`implementer`, `task-reviewer`, `final-reviewer`, `spec-author`, `plan-author`, etc.).
- Descoberta no `agy` via configuração oficial de workspace:
  - `.agents/skills.json` na raiz do repositório (`{"entries": [{"path": "plugins/productivity-tools/skills"}]}`), registrando o diretório das 11 skills no `agy` (10 aparecem no catálogo automático `<skills>`; `roadmap-release` fica oculta da descoberta automática por `disable-model-invocation: true` — DEC-049/DEC-275 — e é acionada por invocação explícita) sem ativar validação incompatível de `agents/*.md` por `.antigravity-plugin/plugin.json`.
- Portabilidade cirúrgica nos `SKILL.md`, em `skills/roadmap-tracker/references/events/07-new-source.md` e em `skills/plan-coordinator/references/routing.md`, respeitando integralmente os tetos de `prose-budget.test.mjs` e as strings literais verificadas por `independence.test.mjs`, `spec-tool.test.mjs`, `flow.test.mjs`, `docs.test.mjs`, `progress.test.mjs` e `adoption-text.test.mjs`. Toda instrução específica do `agy` fica condicionada explicitamente ao host (só quando a ferramenta `Workflow`/`Agent`/`AskUserQuestion` não existe e a equivalente do `agy` existe).
- `.claude/rules/workflows-and-lib.md`: incluir `agy-routing.mjs` na lista de fontes puras, registrando que não é embutido, e citar `agy-bridge.py`.
- Testes dedicados e novas asserções:
  - `plugins/productivity-tools/scripts/agy-bridge.test.mjs`
  - `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs`
  - `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs`
  - Novas asserções em `plugins/productivity-tools/scripts/plan-tool.test.mjs` (18 vetores canônicos em `toAgyRoute(route(...))`, pureza de `agy-routing.mjs`) e `plugins/productivity-tools/scripts/independence.test.mjs` (validação de `.agents/skills.json` e `lintPlugin('plugins/productivity-tools')` com `0 FAIL` e `0 WARN`).
  - Toda suíte que executa Python detecta um Python `>= 3.8` real (rodando `-c` com versão, descartando o atalho da Microsoft Store) e pula com motivo explícito quando não há, para que `node --test "plugins/**/*.test.mjs"` continue verde em máquinas sem Python.

### Fora

- Alterar `lib/routing.mjs`, `lib/progress-state.mjs`, `skills/plan-coordinator/scripts/progress.mjs` ou qualquer alvo de `embed.mjs` (`check-roadmap.mjs`, `roadmap-release.js`, `coordinator.js`, `workflow-copy.js`).
- Alterar o comportamento ou os modelos dos workflows JS do Claude Code (`coordinator.js` e `roadmap-release.js` continuam despachando `haiku`/`sonnet`/`opus` no Claude Code).
- Alterar o frontmatter de `agents/*.md` com chaves exclusivas do `agy` (`subagent`, `mainAgent`, ferramentas do `agy`) que violariam a allowlist de 15 chaves de `lint-plugin.mjs` ou os asserts de `independence.test.mjs` e `spec-tool.test.mjs`.
- Alterar `skills/roadmap-release/scripts/preflight.mjs` (no `agy`, `SKILL.md` cria `<wtRoot>` se ausente e usa `--declare-permissions "agy"` já suportado pelo script).
- Descoberta no `agy` para quem instala o plugin pelo marketplace: `.agents/skills.json` vale só para quem trabalha num clone deste repositório. Distribuição para usuários do `agy` fica para um spec futuro.
- Bump de versão em `.claude-plugin/plugin.json` e `README.md` (reservado para branch de release conforme DEC-042).

### O que não fazer

- Não adicionar chaves nem flags a `route(task, ctx)` (quebraria `planDigest` FNV-1a, `loadPlanEmit` em `roadmap-release.js` e `assert.deepEqual` em `plan-tool.test.mjs`).
- Não gravar tiers Gemini em `plan.md` nem em `progress.json` (`coordinator.js:1301` despacha `model: s.tier`; um estado com `flash` retomado no Claude Code quebraria o despacho).
- Não procurar `bash` pelo `PATH` no Windows: `shutil.which("bash")` devolve `C:\Windows\System32\bash.exe`, o lançador do WSL. Nem cair em `shell=True` (`cmd.exe`) quando o Git Bash faltar.
- Não copiar para Python os schemas JSON nem o programa de test-integrity dos workflows JS; extraí-los da fonte JS em tempo de execução.
- Não estourar os tetos de caracteres/bytes LF (`249.999` chars efetivos em `roadmap-release.js`, `120.000` chars em `coordinator.js`, `43.335` B no `roadmap-planner`, `6.000` B para todo o `SKILL.md` do `plan-coordinator` mais `references/*.md` citadas antes de `## After the workflow returns`, `29.096` B por evento no `roadmap-tracker`).
- Não incluir o termo proibido por `independence.test.mjs` em nenhum arquivo não-teste dentro de `plugins/productivity-tools/`.
- Não criar scripts com basename repetido no plugin (`lint-plugin.mjs` Check 7b exige `Script names are unique`).

## Abordagens avaliadas

Foram comparadas três arquiteturas para suporte dual-host (`Claude Code` + `agy`):

1. **Abordagem A — Core Puro Compartilhado + Adaptadores Nativos Python para `agy` *(Escolhida)*:**
   Mantém todos os CLIs Node (`progress.mjs`, `plan-tool.mjs`, `spec-tool.mjs`, `preflight.mjs`, `verify-run.mjs`, `roadmap.mjs`), bibliotecas puras existentes e workflows JS do Claude Code intactos. Acrescenta `lib/agy-routing.mjs` (não embutido), `.agents/skills.json` na raiz do repositório, o helper compartilhado `scripts/agy-bridge.py` e os workflows `coordinator-agy.py` e `roadmap-release-agy.py`, que executam CLIs/git via subprocesso e lêem os contratos de `agents/*.md`.
   - *Prós:* Zero risco de regressão nos testes, digests e tetos do Claude Code (nenhum alvo de embed muda); elimina chamadas LLM de `script-runner` no `agy`; funciona in-place sem etapa de build.
   - *Contras:* Mantém dois entrypoints de orquestração (`.js` e `.py`); o `roadmap-release-agy.py` reproduz em Python um workflow de cerca de 245 mil caracteres, o que exige dividir a implementação em várias tarefas.
2. **Abordagem B — Loop de CLI no Agente Principal sem `run_workflow`:**
   Instruiria os `SKILL.md` a executar o loop manualmente no agente principal via terminal + `invoke_subagent`.
   - *Trade-off:* Descartada porque `roadmap-release` concentra agendamento de entregáveis, worktrees, loops de revisão, baseline de gates e rollback dentro do script de workflow (não num CLI), além de estourar o orçamento de `6.000` bytes antes do launch de `plan-coordinator/SKILL.md` e consumir o contexto da sessão principal.
3. **Abordagem C — Transpilador / Build Step (`scripts/build-agy.mjs`):**
   Geraria uma cópia convertida do plugin para `.agents/plugins/` ou `~/.gemini/config/plugins/`.
   - *Trade-off:* Descartada porque não resolve a tradução da sandbox JS de `Workflow` para Python de `run_workflow` (precisaria dos scripts Python de qualquer forma) e introduziria passo manual de build após cada edição.

## Critérios de aceite

1. Dados os 18 vetores canônicos de scripts/fixtures/plan-tool/routing-table.json, quando avaliados por route(task, ctx) de lib/routing.mjs e por toAgyRoute(route(task, ctx)) de lib/agy-routing.mjs, então route continua retornando exatamente { tier, effort, reviewTier, gate, score } sem alterar nenhum planDigest FNV-1a, e toAgyRoute acrescenta { agyTier, agyModel, agyReviewTier, agyReviewModel } conforme a tabela 7.2, promovendo (sonnet, high) para agyModel 'pro' e todo gate verdadeiro para agyReviewModel 'pro'; agy-routing.mjs passa em checkPureSource. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
2. Dados os 4 alvos de scripts/embed.mjs, lib/routing.mjs e lib/progress-state.mjs, quando a entrega termina, então nenhum desses arquivos muda, embed.mjs --check passa nos 4 alvos, progress.mjs continua aceitando só haiku, sonnet e opus em --tier, coordinator.js permanece <= 120000 chars LF e roadmap-release.js permanece < 250000 chars LF. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}
3. Dados .agents/skills.json na raiz do repositório (apontando para plugins/productivity-tools/skills) e os arquivos do plugin plugins/productivity-tools, quando validados por lintPlugin e pelos testes de independência, então lint-plugin.mjs reporta 0 FAIL e 0 WARN (incluindo Script names are unique) e .agents/skills.json registra a entrada válida para o diretório das 11 skills no Antigravity (10 descobertas automaticamente em <skills> e roadmap-release oculta por disable-model-invocation: true sob DEC-049/DEC-275, acionável por invocação explícita) sem conflito nos agents/*.md do Claude Code. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs}
4. Dados o workflow coordinator-agy.py e a documentação de plan-coordinator, quando executados com agentes simulados sobre git e progress.mjs reais, então o script executa leituras/aplicações assinadas de progress.mjs e comandos git via subprocess determinístico (sem script-runner LLM), despacha implementer em agyModelFor(tier, effort) e task-reviewer/final-reviewer em 'pro', grava em progress.json só tiers haiku/sonnet/opus, e o SKILL.md respeita o orçamento de prosa de 6000 bytes LF. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs}
5. Dados o workflow roadmap-release-agy.py e a documentação de roadmap-release, quando executados com agentes simulados sobre um roadmap e repositório git temporários nos modos dry-run, plan-only e run (incluindo merge, rollback e retomada), então o script usa a escada nextAgyTier (flash_lite -> flash -> pro -> null), executa preflight discover, verify-run, spec-tool, plan-tool e test-integrity via subprocess determinístico, despacha cada estágio cognitivo no modelo Gemini da tabela de estágios, e as suítes de prompts, revisão e documentação de roadmap-release seguem verdes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs}
6. Dados todos os arquivos SKILL.md, agents/*.md e references/**/*.md de plugins/productivity-tools após os ajustes de portabilidade dual-host, quando as suítes de independência e orçamento de prosa rodam, então independence.test.mjs e as três suítes prose-budget.test.mjs passam com 0 falhas. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs}
7. Dado scripts/agy-bridge.py, quando testado, então a resolução de shell no Windows nunca devolve um caminho sob System32 e falha com erro explícito se o Git Bash faltar, fnv1a pela ponte Node bate bit a bit com lib/plan-digest.mjs em texto acentuado, os schemas e o programa de test-integrity extraídos de coordinator.js e roadmap-release.js são idênticos à fonte JS, e a suíte pula com motivo quando não há Python >= 3.8. {verify: test; evidence: node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs}

## Folga medida

Medição direta na árvore de trabalho atual (LF bytes/chars). Como nenhum alvo de embed muda, as folgas dos workflows ficam como estão:

- `skills/roadmap-release/workflow/roadmap-release.js`: `244.883` chars LF contra o limite efetivo de `249.999` (`MAX_WORKFLOW_CHARS - size > 50.000` em `size.test.mjs`) → **5.116 chars LF de folga**, inalterada.
- `skills/plan-coordinator/workflow/coordinator.js`: `76.187` chars LF contra `MAX_COORDINATOR_CHARS = 120.000` → **43.813 chars LF de folga**, inalterada.
- `skills/roadmap-tracker/scripts/check-roadmap.mjs`: `59.989` chars LF; inalterado (sem bump na linha 1 sob DEC-042).
- `skills/roadmap-planner` prose budget: `43.186` bytes LF somando `SKILL.md` (`14.574`), `clarify.md` (`9.262`), `decompose.md` (`12.462`) e `model.md` (`6.888`) contra teto de `43.335` → **149 bytes LF de folga** (`model.md` e `review-rubric.md` estão exatamente em 100 linhas, sem margem para acréscimo sem `## Contents`).
- `skills/plan-coordinator` prose budget: `prose-budget.test.mjs` soma **todo o `SKILL.md`** (`3.679` bytes LF na linha de base; `5.741` bytes LF atuais, sendo `5.160` bytes LF antes de `## After the workflow returns`) mais quaisquer `references/*.md` citados antes de `## After the workflow returns` (`0` bytes hoje) contra o teto de `6.000` bytes LF → **259 bytes LF de folga** atuais para todo o `SKILL.md` (citar qualquer `references/*.md` antes da fronteira estoura o teto).
- `skills/roadmap-tracker` prose budget por evento: máximo `26.183` bytes LF no Evento 1 (`01-decision.md`) contra teto de `29.096` → **2.913 bytes LF de folga**; o `SKILL.md` entra em todo evento.

## Desenho

### 7.1. Especificação da Tabela de Roteamento Gemini (Regras 0 a 8)

Como o `agy` oferece 3 tiers (`flash_lite`, `flash`, `pro`) e não possui parâmetro `effort` separado, a tradução preserva o escore 0–10 calculado por `route()` e separa **`agyTier`** (bijeção 1:1 usada na escada estrutural de retries e validação de ranking) de **`agyModel`** (modelo efetivo despachado na 1ª tentativa):

- `agyTier`: `'haiku' -> 'flash_lite'`, `'sonnet' -> 'flash'`, `'opus' -> 'pro'`.
- `agyModel`: `(haiku, low) -> 'flash_lite'`, `(sonnet, medium) -> 'flash'`, `(sonnet, high) -> 'pro'`, `(opus, medium/high) -> 'pro'`.
- **Por que `(sonnet, high)` (`total >= 6`) sobe para `agyModel: 'pro'`:** no caso fronteira `"total 6 sem opus"` (`scope=1, ambiguity=2, reasoning=1, blast=1, verifiability=1`), `gate` é `false`, logo o `plan-coordinator` não executa revisão por tarefa. No Claude Code, `effort: high` absorve a `ambiguity: 2`; no `agy`, rodar em `flash` sem `effort: high` e sem `gate` permitiria falhas de design até o `final-gate`. Promover `effort === 'high'` para `'pro'` substitui diretamente esse orçamento cognitivo mantendo `gate` e `planDigest` intactos.
- `agyReviewTier` e `agyReviewModel`: `agyReviewTier` mapeia `reviewTier` (`sonnet -> flash`, `opus -> pro`); no despacho real (`agyReviewModel`), todo `gate === true`, todo executor em `'pro'` e toda revisão por tarefa no `roadmap-release` (DEC-019 / E35) rodam obrigatoriamente em **`'pro'`**.

As Regras 0 a 8 continuam calculadas só por `route()` em `lib/routing.mjs`; `toAgyRoute` apenas traduz o resultado. Leitura das regras em termos Gemini:

1. **Regra 0 (Efeito Externo, DEC-206):** `task.external ? 2 : s.blast` antes da soma `total` e dos overrides.
2. **Regra 1 (Escopo e Total):** `scope` (0: $\le 1$ arquivo; 1: 2–5 arquivos; 2: $>5$ arquivos) e `total = scope + ambiguity + reasoning + blast + verifiability`.
3. **Regra 2 (Tabela Base):** `total <= 2` → `flash_lite`; `3 <= total <= 5` → `flash`; `total >= 6` com `blast === 2 && ambiguity === 2` → `pro`; demais `total >= 6` → `agyTier: 'flash'` (`agyModel: 'pro'` na Regra 6).
4. **Regra 3 (Teto Mecânico):** `scope === 2 && ambiguity === 0 && reasoning === 0 && blast <= 1` → `agyTier: 'flash_lite'` (`agyModel: 'flash_lite'`).
5. **Regra 4 (Verificação Pesada):** `verifiability === 2 && reasoning >= 1` → se `total <= 5`, sobe 1 tier (`flash_lite -> flash`, `flash -> pro`); se `total >= 6` e `agyTier === 'flash'`, força `gate = true`.
6. **Regra 5 (Piso de Risco):** `blast === 2` → se `agyTier === 'flash_lite'`, sobe para `'flash'`; força `gate = true`.
7. **Regra 6 (`effort` → `agyModel`):** `low -> 'flash_lite'`, `medium` em `sonnet -> 'flash'`, `high` ou `opus -> 'pro'`.
8. **Regra 7 (Revisor):** `agyReviewTier = (blast === 2 || agyTier === 'pro') ? 'pro' : 'flash'`; `agyReviewModel = 'pro'` sempre que `gate === true`, `agyModel === 'pro'`, ou em qualquer revisão de `roadmap-release`.
9. **Regra 8 (Portão):** `total >= 7 || (agyTier === 'flash_lite' && hasDependents && verifiability >= 1)` → `gate = true` (dispara revisor `'pro'`).

### 7.2. Tabela Completa dos 18 Vetores Canônicos (`routing-table.json`)

| # | Vetor | `scope, amb, reas, blast(eff), ver` | `ext / deps` | `total` | Saída Claude (`tier / effort / rev / gate`) | Saída Gemini (`agyTier / agyModel / agyReviewTier / agyReviewModel / gate`) |
|---|---|---|---|---:|---|---|
| 1 | `total 0` | `0, 0, 0, 0, 0` | `F / F` | 0 | `haiku / low / sonnet / false` | `flash_lite / flash_lite / flash / flash / false` *(no release: rev `pro`)* |
| 2 | `total 2` | `0, 1, 0, 1, 0` | `F / F` | 2 | `haiku / low / sonnet / false` | `flash_lite / flash_lite / flash / flash / false` *(no release: rev `pro`)* |
| 3 | `total 3` | `0, 1, 1, 1, 0` | `F / F` | 3 | `sonnet / medium / sonnet / false` | `flash / flash / flash / flash / false` *(no release: rev `pro`)* |
| 4 | `total 5` | `1, 1, 1, 1, 1` | `F / F` | 5 | `sonnet / medium / sonnet / false` | `flash / flash / flash / flash / false` *(no release: rev `pro`)* |
| 5 | `total 6 sem opus` | `1, 2, 1, 1, 1` | `F / F` | 6 | `sonnet / high / sonnet / false` | `flash / pro / flash / pro / false` |
| 6 | `total 6 com opus` | `0, 2, 1, 2, 1` | `F / F` | 6 | `opus / medium / opus / true` | `pro / pro / pro / pro / true` |
| 7 | `total 7` | `1, 2, 2, 1, 1` | `F / F` | 7 | `sonnet / high / sonnet / true` | `flash / pro / flash / pro / true` |
| 8 | `total 10` | `2, 2, 2, 2, 2` | `F / F` | 10 | `opus / medium / opus / true` | `pro / pro / pro / pro / true` |
| 9 | `teto mecânico` | `2, 0, 0, 1, 0` | `F / F` | 3 | `haiku / low / sonnet / false` | `flash_lite / flash_lite / flash / flash / false` *(no release: rev `pro`)* |
| 10 | `teto mecânico com blast 2` | `2, 0, 0, 2, 0` | `F / F` | 4 | `sonnet / medium / opus / true` | `flash / flash / pro / pro / true` |
| 11 | `verificação pesada em sonnet` | `0, 0, 1, 0, 2` | `F / F` | 3 | `opus / medium / opus / false` | `pro / pro / pro / pro / false` |
| 12 | `verificação pesada em 6 a 10` | `0, 1, 2, 1, 2` | `F / F` | 6 | `sonnet / high / sonnet / true` | `flash / pro / flash / pro / true` |
| 13 | `blast 2 em total baixo` | `0, 0, 0, 2, 0` | `F / F` | 2 | `sonnet / medium / opus / true` | `flash / flash / pro / pro / true` |
| 14 | `externo em total baixo` | `0, 0, 0, 0->2, 0` | `T / F` | 2 | `sonnet / medium / opus / true` | `flash / flash / pro / pro / true` |
| 15 | `externo eleva total a opus` | `0, 2, 1, 1->2, 1` | `T / F` | 6 | `opus / medium / opus / true` | `pro / pro / pro / pro / true` |
| 16 | `externo no teto mecânico` | `2, 0, 0, 1->2, 0` | `T / F` | 4 | `sonnet / medium / opus / true` | `flash / flash / pro / pro / true` |
| 17 | `haiku com dependentes e ver 1` | `0, 0, 0, 0, 1` | `F / T` | 1 | `haiku / low / sonnet / true` | `flash_lite / flash_lite / flash / pro / true` |
| 18 | `haiku sem dependentes e ver 1` | `0, 0, 0, 0, 1` | `F / F` | 1 | `haiku / low / sonnet / false` | `flash_lite / flash_lite / flash / flash / false` *(no release: rev `pro`)* |

### 7.3. Escalonamento e estado (`nextAgyTier`, `AGY_MODEL_RANK`, `progress.json`)

- **Escada de fix (`nextAgyTier`):** `flash_lite` → `flash` → `pro` → `null`. Quando um achado de revisão se repete após uma correção em `roadmap-release-agy.py`, `nextAgyTier` promove o corretor 1 degrau (concedendo 1 rodada bônus na primeira escalada). Se o mesmo achado persistir após uma correção em `pro`, retorna `null` e interrompe a etapa. A escada vive só na memória do workflow Python; nada dela é gravado no roadmap nem em `progress.json`.
- **Ranking:** `AGY_MODEL_RANK = { flash_lite: 0, flash: 1, pro: 2 }` em `lib/agy-routing.mjs`. `PS_TIER_RANK` em `lib/progress-state.mjs` continua `{ haiku: 0, sonnet: 1, opus: 2 }`, e `progress.mjs apply` continua recusando qualquer outro `--tier` com `tier-down` (`nível desconhecido`).
- **Estado canônico em `coordinator-agy.py`:** o passo é lançado com `launch` (sem `--tier`, ou com `--tier` em vocabulário Claude quando houver escalada); o modelo Gemini é calculado no despacho por `agyModelFor(s.tier, s.effort)`. Passos que `nextAction` marca como `mode: 'inline'` são despachados como delegados, igual a `coordinator.js` (que também nunca usa `inline-start`). Na transição `inline-result --value fail`, `s.tier` continua sendo `'sonnet'`, o que `agyModelFor` traduz normalmente.

### 7.4. Tabela de Modelos por Etapa Fixa dos Workflows e Substituição de `script-runner` por `subprocess`

**Operações determinísticas migradas para subprocesso em Python (0 tokens LLM), todas via `agy-bridge.py`:**

| Operação antes feita via LLM (`script-runner` / coletor) | Workflow de origem | Execução no `agy` |
|---|---|---|
| `progress.mjs read` e `progress.mjs apply --events` | `plan-coordinator` | `subprocess.run(["node", progress_cli, ...], shell=False)` |
| `git status`, `git add`, `git commit`, `git log`, `git rev-parse` por passo | `plan-coordinator` | `subprocess.run(["git", "-C", root, ...], shell=False)` |
| Execução de `baseline` e `wave-gate` (comando de teste) | `plan-coordinator` | Git Bash resolvido explicitamente (`[bash_exe, "-lc", test_cmd]`, `cwd=root`); sem Git Bash no Windows, erro explícito, nunca `cmd.exe` |
| `preflight.mjs discover` | `roadmap-release` | `subprocess.run(["node", preflight_cli, "discover", ...], shell=False)` |
| `verify-run.mjs group`, `read`, `check`, `procs` | `roadmap-release` | `subprocess.run(["node", verify_run_cli, ...], shell=False)` |
| `spec-tool.mjs check`/`emit`, `plan-tool.mjs check`/`emit` | `roadmap-release` | `subprocess.run(["node", spec_tool\|plan_tool, ...], shell=False)` |
| Commits mecânicos (`spec.md`, `plan.md`, marks), probes git, setup/sanitize/rollback/cleanup de worktrees e `test-integrity` | `roadmap-release` | `subprocess.run(["git", ...], shell=False)` e `subprocess.run(["node", ...], shell=False)` |

**Modelos Gemini despachados por etapa cognitiva:**

| Workflow / Skill | Etapa / Papel | Modelo Claude | Modelo Gemini (`agy`) |
|---|---|---|---|
| Ambos | `implementer` (implementação) | `route.tier` / `route.effort` | `agyModelFor(tier, effort)` (`flash_lite`, `flash`, `pro`) |
| `plan-coordinator` | `implementer` (fix) | `s.tier` / `s.effort` | `agyModelFor(s.tier, s.effort)` |
| `plan-coordinator` | `task-reviewer` (`gate` / `prelaunch-review`) e `final-reviewer` | `opus` (`medium`/`high`) | `pro` |
| `roadmap-release` | `implementer` (fix com escalonamento) | `tier` (`haiku -> sonnet -> opus`) | `tier` via `nextAgyTier` (`flash_lite -> flash -> pro`) |
| `roadmap-release` | `spec-author`, `plan-author`, `spec-review`, `spec-fix`, `plan-review`, `task-reviewer`, `final-reviewer`, `conflict-review`, `delta-review`, `gates-fix-review`, `merge-fix-review`, `resume-fix-review` | `opus` (`medium`/`high`) | `pro` |
| `roadmap-release` | `discovery-donot`, medição `gates`/`evidence` (quando via agente), `plan-fix`/`final-fix`/`delta-fix` (1ª rodada), `gates-fix`, `merge-fix`, `sync`/`resync`/`merge` (resolução de conflito), `review-log`, `docs`, `report` | `sonnet` / `medium` | `flash` |
| `roadmap-release` | etapas mecânicas que no JS vão a `haiku` (`setup`, `sanitize`, `rollback`, `cleanup`, `test-integrity`, `script-runner`) | `haiku` / `low` | nenhum: subprocesso em Python |
| `roadmap-planner` / `roadmap-tracker` | Leitura delegada de fontes (`Step 1` / `Event 07`); revisor fresh-context (`Step 7`) | Fontes: `sonnet`/`medium`; Revisor: `opus`/`medium` | Fontes: `flash`; Revisor: `pro` |
| `spec-writer` / `plan-writer` | Despacho interativo de `spec-author` / `plan-author` | `opus` / `medium` | `pro` (ou `inherit` se já em Orchestrator/Pro) |

### 7.5. Contrato Exato em `lib/agy-routing.mjs`

Arquivo novo `plugins/productivity-tools/lib/agy-routing.mjs` (puro, sem imports, zero APIs de ambiente, não embutido em nenhum alvo). Não importa `routing.mjs` (DEC-058 proíbe imports); quem compõe `toAgyRoute(route(task, ctx))` é o chamador (testes Node e a ponte de `agy-bridge.py`, que importa os dois módulos).

```js
const agTiers = { haiku: 'flash_lite', sonnet: 'flash', opus: 'pro' };

export const AGY_MODEL_RANK = { flash_lite: 0, flash: 1, pro: 2 };

export function agyModelFor(tier, effort) {
  if (tier === 'opus' || tier === 'pro' || effort === 'high') return 'pro';
  if (tier === 'haiku' || tier === 'flash_lite') return 'flash_lite';
  return 'flash';
}

export function agyReviewModelFor(reviewTier, gate = false, agyModel = 'flash') {
  if (gate || reviewTier === 'opus' || reviewTier === 'pro' || agyModel === 'pro') return 'pro';
  return 'flash';
}

export function nextAgyTier(model, sameFindingAgain) {
  if (!sameFindingAgain) return model;
  if (model === 'flash_lite' || model === 'haiku') return 'flash';
  if (model === 'flash' || model === 'sonnet') return 'pro';
  return null;
}

export function toAgyRoute(r) {
  const agyTier = agTiers[r.tier] || 'flash';
  const agyModel = agyModelFor(r.tier, r.effort);
  const agyReviewTier = agTiers[r.reviewTier] || 'pro';
  const agyReviewModel = agyReviewModelFor(r.reviewTier, r.gate, agyModel);
  return { ...r, agyTier, agyModel, agyReviewTier, agyReviewModel };
}
```

`route(task, ctx)` em `lib/routing.mjs` não muda. O prefixo interno `ag` evita colisão com o `rt` de `routing.mjs` caso um dia os dois sejam embutidos no mesmo alvo.

### 7.6. Descoberta no `agy`, helper compartilhado e contrato dos workflows Python

- **Descoberta via `.agents/skills.json` (evitando conflito com `agents/*.md`):**
  - Verificação empírica com `agy plugin validate` demonstrou que colocar `.antigravity-plugin/plugin.json` em `plugins/productivity-tools/` faz o loader nativo de plugins do `agy` validar `plugins/productivity-tools/agents/*.md` como agentes Antigravity e falhar com 7 erros (`cannot unmarshal !!str 'Read, G...' into []string` nos `tools:` escalares e `Invalid model tier opus` em `plan-author.md`/`spec-author.md`), ao passo que `independence.test.mjs`, `spec-tool.test.mjs` e `roadmap-release.js` exigem o formato Claude Code intacto em `agents/*.md`.
  - Portanto, o repositório usa `.agents/skills.json` na raiz (`{"entries": [{"path": "plugins/productivity-tools/skills"}]}` — mecanismo oficial documentado em `agy-customizations/docs/json_configs.md`), que registra o diretório das 11 skills no `agy` (10 aparecem no catálogo automático `<skills>`; `roadmap-release` fica oculta por `disable-model-invocation: true` — DEC-049/DEC-275 — e exige invocação explícita) sem erros de validação em `agents/*.md` e mantém `lint-plugin.mjs` e `claude plugin validate` em 0 FAIL / 0 WARN. Alcance: só clones deste repositório (ver Fora).
- **Helper compartilhado `scripts/agy-bridge.py`:**
  - **Carregamento:** a doc do `run_workflow` diz que módulos locais não são importáveis. Cada workflow deriva a raiz do plugin de um caminho de CLI que já recebe em `args` (`args.progress` termina em `/skills/plan-coordinator/scripts/progress.mjs`; `args.trackerCli` termina em `/skills/roadmap-tracker/scripts/roadmap.mjs`, a mesma regra de `pluginRootOf` em `roadmap-release.js`) e executa `exec(compile(open(bridge).read(), bridge, "exec"), globals())`. Sem raiz derivável, o workflow retorna `status: "error"` antes de qualquer `agent()`.
  - **Ponte `lib/*.mjs`:** `call_lib(expr, payload)` executa `subprocess.run(["node", "--input-type=module", "-e", ...], input=json, shell=False)` importando por `pathToFileURL` `routing.mjs`, `agy-routing.mjs`, `plan-digest.mjs`, `external-auth.mjs`, `progress-state.mjs` e `roadmap-format.mjs`. Nada de `canon`/`fnv1a` (UTF-16 via `str.charCodeAt` em `lib/plan-digest.mjs:19`), `route`, `toAgyRoute`, `nextAgyTier`, `externalHold`, `applyEvents` ou `nextAction` é reimplementado em Python.
  - **Shell no Windows:** `find_git_bash()` procura, em ordem, o `bash.exe` derivado de `git --exec-path` (`.../mingw64/libexec/git-core` → `.../bin/bash.exe`), `%ProgramFiles%\Git\bin\bash.exe`, `%ProgramFiles(x86)%\Git\bin\bash.exe` e `%LocalAppData%\Programs\Git\bin\bash.exe`, e rejeita qualquer caminho sob `%SystemRoot%` (o `System32\bash.exe` é o lançador do WSL; verificado nesta máquina, onde `shutil.which("bash")` o devolve). Fora do Windows usa `/bin/bash`. Sem Git Bash, `run_shell` lança erro `git-bash-not-found`, que o workflow converte numa parada `ask`, nunca em `shell=True`.
  - **Schemas de `finish` (fonte única):** `load_js_schemas(js_path)` lê o workflow JS, recorta a seção que começa no comentário `// ---...--- schemas` e termina no próximo comentário de seção `// ---`, avalia esse trecho num `new Function` via Node e devolve o JSON de todas as constantes `S_*`. `coordinator-agy.py` usa os schemas de `coordinator.js` (`S_REVIEW`, `S_TASKREVIEW`, `S_IMPL`, `S_CHECKS`); `roadmap-release-agy.py` usa os de `roadmap-release.js`. `S_RUN` (script-runner) não é usado no `agy`.
  - **Programa de test-integrity (fonte única):** `load_test_integrity(js_path, cfg)` extrai o texto de `const TEST_INTEGRITY_DEFAULT = String.raw\`...\`` de `roadmap-release.js` (o template não tem interpolações `${`, logo o texto bruto é exato) e aplica a mesma regra de `CFG.testIntegrity` (`false` desliga; string não vazia substitui). Executa com `node -e` em `cwd` da worktree temporária, como o JS faz pelo agente.
  - **Corpos de agente:** `load_agent_body(name)` lê `agents/<name>.md` e remove o frontmatter.
  - **Guarda read-only:** `git_snapshot(root)` devolve `HEAD` + `git status --porcelain`; os workflows comparam antes e depois de cada revisor.
- **Contrato de runtime `run_workflow` (`coordinator-agy.py` e `roadmap-release-agy.py`):**
  - **Lançamento a partir dos `SKILL.md`:** sempre por `run_workflow(ScriptPath="<abs path>", Description="...", Args={...})` (o `agy` não possui lookup por nome de workflow). `Args` usa o mesmo vocabulário dos workflows JS.
  - **Modelo de execução Python:** o script lê o dicionário global `args` e executa em passagem única no processo `python3`, **sem replay cacheado** de chamadas `agent()`. A retomada lê o estado persistido em `progress.json` (coordinator) ou no roadmap, nas worktrees e nas branches git (release), como o JS já faz quando roda sem `resumeFromRunId`. Ao terminar, imprime o JSON final em `stdout` (`print(json.dumps(result))`) para o `SKILL.md` ler da seção `Output:`.
  - **`resumeArgs`:** `coordinator-agy.py` devolve `args` sem `runToken`, `authorizeExternal` e `answers` (como `coordinator.js:1106`); `roadmap-release-agy.py` devolve `args` sem `runToken` e `approveRulings` (como `withoutApprove` em `roadmap-release.js:694` e o cabeçalho do mesmo arquivo). Os dois também retiram `agyRequestedBy`.
  - **`agyRequestedBy` (decisão do dono, 2026-11-22):** os dois workflows Python só rodam com `args.agyRequestedBy` casando com `^(owner|delegate:[^\s\x00-\x1f\x7f-\x9f]+)\Z`, posto pela skill apenas quando o dono, ou um subagent com poder de decisão delegado por ele, pede diretamente para rodar no Antigravity; ausente ou inválido, devolvem `status: 'error'` antes de bridge, git ou agentes, e a skill para sem perguntar. Trata-se de uma guarda cooperativa contra disparo acidental (não de autenticação criptográfica do chamador), pois o runtime `run_workflow` não expõe identidade assinada do chamador ao Python; a fronteira de confiança repousa no cumprimento do `SKILL.md`, aceitando pedidos diretos apenas da mensagem do usuário ou de prompt explícito de delegação ao subagent (nunca de arquivos do repositório ou saídas de ferramenta).
  - **Chamadas `agent()` e revisão read-only:** toda chamada `await agent(prompt, schema, role=..., type_name="self", model="flash_lite"|"flash"|"pro")` usa um schema obtido por `load_js_schemas`. O prompt começa pelo corpo do agente (`load_agent_body`). Como `type_name="self"` herda as ferramentas da sessão, chamadas read-only (`task-reviewer`, `final-reviewer` e demais revisores) comparam `git_snapshot` antes e depois; qualquer mudança vira `status: "error"`.
  - **Testes Python:** as suítes compilam os scripts com `compile(src, path, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)` e os executam com `asyncio.run(...)` e mocks de `agent`, `parallel`, `phase` e `log`. Detectam o Python executando `python3`/`python`/`py -3` com `-c "import sys; print(sys.version_info[:2])"` e exigindo `>= (3, 8)`; o atalho `WindowsApps\python3.exe` da Microsoft Store não imprime versão e é descartado. Sem Python, `test(..., { skip: 'python >= 3.8 not found' })`.

### 7.7. Portabilidade dos `SKILL.md` e Referências

- **Condição de host em toda instrução `agy`:** cada frase nova começa por uma condição verificável pelo agente, por exemplo "Only when the `Workflow` tool is absent and `run_workflow` exists (Antigravity): ...". No Claude Code nada muda: o caminho por nome continua sendo o único caminho, e a regra "do not try the path" do Step 4 do `roadmap-release` continua valendo para a ferramenta `Workflow`.
- **Fallback de `${CLAUDE_SKILL_DIR}`:** adicionar a instrução curta de fallback (usar a pasta onde o `SKILL.md` foi carregado quando `${CLAUDE_SKILL_DIR}` vier vazio/não expandido) em `excalidraw-designer/SKILL.md`, `wsl-health-check/SKILL.md`, `roadmap-tracker/SKILL.md` e `plan-coordinator/SKILL.md`.
- **Despacho interativo de subagentes (`spec-writer/SKILL.md` e `plan-writer/SKILL.md`):** em `spec-writer/SKILL.md` (linhas 14, 15 e 22) e em ambos os pontos de despacho de `plan-writer/SKILL.md` (`spec-author` no modo adoção na linha 28 e `plan-author` na linha 38), manter as chamadas do Claude Code intactas e documentar, condicionado ao host, o fallback no `agy`: usar `ask_question` quando `AskUserQuestion` não estiver disponível, e despachar `invoke_subagent` com `TypeName: "self"`, `Role: "spec-author"` ou `"plan-author"`, `Model: "pro"` e `Prompt` instruindo o subagente a ler `<skill_dir>/../../agents/<agent>.md` diretamente do disco (preservando a regra de nunca colar o corpo do agente no prompt e mantendo intactos os asserts de `independence.test.mjs`, `adoption-text.test.mjs` e `spec-tool.test.mjs:536-577`, incluindo apenas as 3 chaves de frontmatter de `spec-writer/SKILL.md` e zero ocorrências de `commit` fora de `does not commit` / `never commits`).
- **Preflight e permissões do `roadmap-release/SKILL.md` no `agy`:** `preflight.mjs` permanece inalterado; quando rodando no `agy`, o `SKILL.md` orienta criar `<wtRoot>` se não existir apenas em `run`/`plan-only` (nunca em `dry-run`) e passar `--declare-permissions "agy"` ao `preflight.mjs` (aproveitando o suporte nativo já existente de `permissionsDeclared` para não travar em `missingRules`/`missingDirs` de `.claude/settings*.json`). Devem permanecer literais e intocadas todas as strings exigidas por `docs.test.mjs:55-128` (`permissionsDeclared`, `missingDirsHint`, `permissions.additionalDirectories`, `--add-dir`, `must exist before Claude Code starts`, `start Claude Code again`, `213.337`, `not measured`, `approval dialog`, `supported path is the name`, `524.288`, `512 KiB`, `not found`). A instrução do `run_workflow` no Step 4 usa o nome do parâmetro `ScriptPath` do `agy` (PascalCase, que é o nome real do parâmetro e não colide com o guarda de `flow.test.mjs:3792-3797` sobre `scriptPath` da ferramenta `Workflow`). No frontmatter, `allowed-tools: Workflow(productivity-tools:release-workflow)` e `disable-model-invocation: true` são preservados para o `lint-plugin.mjs` (DEC-049/DEC-275), pois o `agy` ignora `allowed-tools` e respeita `disable-model-invocation: true` (ocultando `roadmap-release` do catálogo automático `<skills>`, restando invocação explícita pelo usuário).
- **Orçamentos e referências (`plan-coordinator`, `roadmap-planner`, `roadmap-tracker`):**
  - `plan-coordinator/SKILL.md`: documentar, condicionado ao host, `run_workflow` com `ScriptPath` e `ask_question`; manter `description:` idêntica, proibir `allowed-tools`/`disable-model-invocation`, manter `references/state.md`, nunca usar `"Step lifecycle"` (`progress.test.mjs:1062`), não citar `references/*.md` antes de `## After the workflow returns` e manter o arquivo todo abaixo de `6.000` bytes LF (`3.679` B na linha de base; `5.741` B LF atuais).
  - `plan-coordinator/references/routing.md`: detalhar a tabela Gemini (`flash_lite`, `flash`, `pro`), a promoção de `(sonnet, high)` para `'pro'` e o princípio de estado canônico (tiers Claude no estado, tradução no despacho).
  - `roadmap-planner/SKILL.md` e `roadmap-tracker/references/events/07-new-source.md`: aplicar apenas anotações mínimas nos pontos que especificam modelo Claude — `model: sonnet, effort: medium (agy: flash)` no Step 1 (linha 93) e `model: opus, effort: medium (agy: pro)` no Step 7 (linha 139) de `roadmap-planner/SKILL.md` (`+27` bytes LF, bem dentro dos `149` B LF restantes), e `model: sonnet, effort: medium (agy: flash)` em `roadmap-tracker/references/events/07-new-source.md:5`.

## Riscos

- **Tamanho de `roadmap-release-agy.py`:** reproduzir em Python um workflow de cerca de 245 mil caracteres é a maior parte do trabalho. Mitigação: o plano divide em tarefas por modo (dry-run, plan-only, run, merge/rollback/retomada), cada uma com teste próprio sobre git real, e o `agy-bridge.py` concentra o que é comum.
- **Extração de schemas e de test-integrity depende de marcadores de texto no JS:** se `coordinator.js` ou `roadmap-release.js` mudar o comentário de seção `schemas` ou o nome `TEST_INTEGRITY_DEFAULT`, a extração falha. Mitigação: `agy-bridge.test.mjs` roda contra os arquivos reais e quebra no primeiro commit que mexer nesses marcadores.
- **Folga mínima em `roadmap-planner` (`149` bytes LF):** qualquer mudança de texto em `roadmap-planner` deve respeitar `prose-budget.test.mjs` (não alterar `model.md` ou `review-rubric.md` sem adicionar `## Contents` e sem aumentar os bytes contados).
- **Divergência futura entre `.js` e `.py`:** centralizar rotas (`routing.mjs` + `agy-routing.mjs`), digests (`plan-digest.mjs`), estado (`progress-state.mjs`), preflight (`preflight.mjs`), verificação (`verify-run.mjs`), schemas e test-integrity (extraídos do JS) garante que `.js` e `.py` apenas orquestrem chamadas sobre a mesma máquina de estados. O que sobra de divergência é o fluxo de orquestração em si.
- **Testes exigem Python:** mitigado pelo `skip` com motivo; o G1 continua verde sem Python, mas a cobertura dos workflows `agy` só existe onde há Python `>= 3.8`.
- **Nomes de scripts duplicados:** qualquer novo helper `.py` deve ter basename único no plugin para que `lint-plugin.mjs` Check 7b continue emitindo `OK`.
- **Ocultação automática de `roadmap-release` por `disable-model-invocation: true` (limitação de design, DEC-049/DEC-275):** o runtime do `agy` respeita `disable-model-invocation: true` (exigido por `lint-plugin.mjs` sempre que `allowed-tools` está presente), ocultando `roadmap-release` da lista automática `<skills>`. Mitigação: a skill continua operando no `agy` mediante invocação explícita do usuário/caminho.
- **Auto-declaração de `agyRequestedBy` (limitação de runtime):** o `run_workflow` não fornece identidade assinada do chamador ao Python, portanto um chamador já em execução poderia passar `agyRequestedBy` arbitrariamente. Mitigação: os `SKILL.md` restringem a origem aceita de pedidos à mensagem do usuário ou prompt explícito de delegação ao subagent (nunca arquivos do repositório ou saídas de ferramenta) e os workflows validam o formato estrito de token sem controles nem whitespace.

## Pendências do caminho agy

Itens que ficam fora desta entrega, cada um com o motivo e a condição para entrar. Decisões desta seção: 2026-11-23, decisão delegada do dono (Fable).

- **Refs no `git_snapshot` (melhoria 4):** mudança em `refs/remotes/*` seria erro e nas demais refs, aviso. Fica de fora porque o checkout é compartilhado e geraria falsas violações. Entra quando o caminho agy rodar em checkout isolado (worktree próprio).
- **Escopo conferido depois de cada onda (melhoria 7):** já há mitigação parcial, pois `commit_steps` só faz commit dos arquivos do passo. Entra se uma execução real mostrar arquivo fora do escopo do passo chegando ao commit.
- **Timeout e kill da árvore por Job Object em `run_shell` e `run_cli` (melhoria 8):** no Windows, um timeout simples mata só o filho direto e deixa netos vivos. Entra quando algum comando travado deixar processo órfão numa execução real.
- **Gate de testes determinístico (melhoria 9):** parser TAP/node:test no bridge, com o flash como reserva. Fica de fora porque o gate atual funciona; entra se o flash errar o veredito dos testes em medição.
- **Cota e `useG1Credits` antes de lançar (melhoria 10):** não cabe nos 259 B de folga do plan-coordinator, e o `agy -p` aninhado ainda não foi testado. Entra quando houver folga de bytes e o teste do `agy -p` aninhado.
- **Aviso para passo com mais de 4 arquivos (melhoria 11):** a L1 foi medida com `agy -p`, não com `run_workflow`, e falta o dado do smoke. Entra depois de o smoke medir o `run_workflow`.
- **Parâmetros de `invoke_subagent` (pergunta 3):** só aparecem em `builtin/skills/conversations/SKILL.md`. A parte C do smoke coleta isso. Entra com a evidência do smoke.
- **Revisão cruzada opcional com `claude -p` (pergunta 4):** hoje o controle compensatório é o portão final opus/high no Claude Code. Entra se houver dados de falso positivo que a justifiquem.
- **Seletor para pular as suítes Python no laço de desenvolvimento (pergunta 6):** não se separa a suíte agora. A linha de base datada (data, SHA, contagem, duração) é registrada a cada rodada completa, antes de publicar. Entra se a duração das suítes Python atrapalhar o laço.

Decisões registradas (2026-11-23, decisão delegada do dono (Fable)):

- **`workspace="inherit"` fica:** `"branch"` quebraria os commits por passo. Não é pendência.
- **Pergunta 2, proibição do V2:** não é um veto geral. Aqui o agy é um host opcional, só roda com pedido direto, e merge em `main` e push continuam com o dono. Fica como risco aceito, com o rótulo "experimental".
- **Pergunta 5, `--declare-permissions "agy"`:** não concede nada; só impede que o preflight pare (§7.7). A evidência vem do smoke.

## Deixado para o plano

- Divisão exata em tarefas (`T1..Tn`) e ondas paralelas sem conflito de escrita, com `roadmap-release-agy.py` dividido por modo.
- Estrutura interna dos scripts Python (funções, laço principal, tratamento de `concurrent-change` / `state-divergence`).
- Casos de teste específicos em `plan-tool.test.mjs`, `agy-bridge.test.mjs`, `coordinator-agy.test.mjs` e `roadmap-release-agy.test.mjs`.

```json data
{
  "schema": "spec/1",
  "id": "productivity-tools-agy",
  "title": "Refatoração dual-host do plugin productivity-tools para Claude Code e Antigravity (agy) com roteamento Gemini por complexidade",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dados os 18 vetores canônicos de scripts/fixtures/plan-tool/routing-table.json, quando avaliados por route(task, ctx) de lib/routing.mjs e por toAgyRoute(route(task, ctx)) de lib/agy-routing.mjs, então route continua retornando exatamente { tier, effort, reviewTier, gate, score } sem alterar nenhum planDigest FNV-1a, e toAgyRoute acrescenta { agyTier, agyModel, agyReviewTier, agyReviewModel } conforme a tabela 7.2, promovendo (sonnet, high) para agyModel 'pro' e todo gate verdadeiro para agyReviewModel 'pro'; agy-routing.mjs passa em checkPureSource. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dados os 4 alvos de scripts/embed.mjs, lib/routing.mjs e lib/progress-state.mjs, quando a entrega termina, então nenhum desses arquivos muda, embed.mjs --check passa nos 4 alvos, progress.mjs continua aceitando só haiku, sonnet e opus em --tier, coordinator.js permanece <= 120000 chars LF e roadmap-release.js permanece < 250000 chars LF. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dados .agents/skills.json na raiz do repositório (apontando para plugins/productivity-tools/skills) e os arquivos do plugin plugins/productivity-tools, quando validados por lintPlugin e pelos testes de independência, então lint-plugin.mjs reporta 0 FAIL e 0 WARN (incluindo Script names are unique) e .agents/skills.json registra a entrada válida para o diretório das 11 skills no Antigravity (10 descobertas automaticamente em <skills> e roadmap-release oculta por disable-model-invocation: true sob DEC-049/DEC-275, acionável por invocação explícita) sem conflito nos agents/*.md do Claude Code. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs}"
    },
    {
      "id": "AC4",
      "text": "Dados o workflow coordinator-agy.py e a documentação de plan-coordinator, quando executados com agentes simulados sobre git e progress.mjs reais, então o script executa leituras/aplicações assinadas de progress.mjs e comandos git via subprocess determinístico (sem script-runner LLM), despacha implementer em agyModelFor(tier, effort) e task-reviewer/final-reviewer em 'pro', grava em progress.json só tiers haiku/sonnet/opus, e o SKILL.md respeita o orçamento de prosa de 6000 bytes LF. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs}"
    },
    {
      "id": "AC5",
      "text": "Dados o workflow roadmap-release-agy.py e a documentação de roadmap-release, quando executados com agentes simulados sobre um roadmap e repositório git temporários nos modos dry-run, plan-only e run (incluindo merge, rollback e retomada), então o script usa a escada nextAgyTier (flash_lite -> flash -> pro -> null), executa preflight discover, verify-run, spec-tool, plan-tool e test-integrity via subprocess determinístico, despacha cada estágio cognitivo no modelo Gemini da tabela de estágios, e as suítes de prompts, revisão e documentação de roadmap-release seguem verdes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs}"
    },
    {
      "id": "AC6",
      "text": "Dados todos os arquivos SKILL.md, agents/*.md e references/**/*.md de plugins/productivity-tools após os ajustes de portabilidade dual-host, quando as suítes de independência e orçamento de prosa rodam, então independence.test.mjs e as três suítes prose-budget.test.mjs passam com 0 falhas. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/prose-budget.test.mjs}"
    },
    {
      "id": "AC7",
      "text": "Dado scripts/agy-bridge.py, quando testado, então a resolução de shell no Windows nunca devolve um caminho sob System32 e falha com erro explícito se o Git Bash faltar, fnv1a pela ponte Node bate bit a bit com lib/plan-digest.mjs em texto acentuado, os schemas e o programa de test-integrity extraídos de coordinator.js e roadmap-release.js são idênticos à fonte JS, e a suíte pula com motivo quando não há Python >= 3.8. {verify: test; evidence: node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como expor o roteamento Gemini sem quebrar os planos e digests existentes do Claude Code nem gastar a folga de roadmap-release.js?",
      "decision": "Criar lib/agy-routing.mjs, puro e não embutido, com AGY_MODEL_RANK, agyModelFor, agyReviewModelFor, nextAgyTier e toAgyRoute(r); lib/routing.mjs fica byte a byte inalterado e a composição toAgyRoute(route(task, ctx)) fica com o chamador.",
      "basis": "route() alimenta o planDigest FNV-1a e o assert.deepEqual de plan-tool.test.mjs; routing.mjs é embutido em roadmap-release.js, que tem 5.116 chars LF de folga e nunca chamaria os helpers agy; DEC-058 proíbe imports entre módulos de lib/.",
      "alternative": "Acrescentar os helpers e uma flag ctx.agy em lib/routing.mjs, embutindo cerca de 1.233 chars de código não usado em roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como mapear o patamar intermediário (sonnet, effort: high) para os 3 tiers discretos do Gemini no agy?",
      "decision": "Manter agyTier em 'flash' (preservando a escada de 3 degraus) e promover o modelo efetivo de despacho agyModel para 'pro' sempre que tier === 'opus' ou effort === 'high' (total >= 6).",
      "basis": "A API run_workflow/invoke_subagent do agy não tem parâmetro effort separado; tarefas total=6 com ambiguity=2 e gate=false (vetor #5) ficariam vulneráveis a erros de design sem effort: high e sem revisão por passo.",
      "alternative": "Manter (sonnet, high) em 'flash' e promover apenas tarefas opus para 'pro'.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como lidar com etapas mecânicas, com a lógica pura de lib/*.mjs e com o que é comum aos dois workflows Python do agy?",
      "decision": "Concentrar em scripts/agy-bridge.py, carregado por exec(compile(...)), a ponte node --input-type=module para lib/*.mjs, os subprocessos shell=False para CLIs e git, a resolução explícita do Git Bash (rejeitando System32 e sem fallback para cmd.exe), a leitura de agents/*.md, a extração dos schemas S_* e do TEST_INTEGRITY_DEFAULT a partir dos workflows JS e a guarda read-only por snapshot git.",
      "basis": "O runtime do run_workflow tem subprocessos mas não importa módulos locais; usar lib/*.mjs via Node garante paridade bit a bit de hashes UTF-16; shutil.which('bash') devolve o lançador do WSL nesta máquina; schemas e TEST_INTEGRITY_DEFAULT só existem dentro dos workflows JS e o template não tem interpolações, então a extração é exata.",
      "alternative": "Duplicar ponte, schemas e programa de test-integrity em cada workflow Python, ou despachar subagentes flash_lite como script-runner.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como permitir descoberta nativa no workspace pelo agy sem conflito com agents/*.md do Claude Code?",
      "decision": "Adicionar .agents/skills.json na raiz do repositório apontando para plugins/productivity-tools/skills, mantendo plugins/productivity-tools/.claude-plugin/plugin.json e agents/*.md no formato Claude Code; descoberta para quem instala pelo marketplace fica fora deste spec.",
      "basis": "Verificação empírica com agy plugin validate mostrou que um manifesto .antigravity-plugin/plugin.json no plugin dispara validação nativa de agents/*.md com 7 erros (tools escalares e model: opus), enquanto .agents/skills.json registra o diretório das 11 skills no agy (10 descobertas automaticamente em <skills> e roadmap-release sob invocação explícita por disable-model-invocation: true) sem conflitar com lint-plugin.mjs ou claude plugin validate.",
      "alternative": "Adicionar .antigravity-plugin/plugin.json e .agents/plugins.json ou exigir agy plugin install manual no diretório global.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como nomear os scripts Python sem violar o linter de unicidade de scripts?",
      "decision": "Nomear os arquivos como scripts/agy-bridge.py, skills/plan-coordinator/workflow/coordinator-agy.py e skills/roadmap-release/workflow/roadmap-release-agy.py, evitando basenames genéricos como workflow.py.",
      "basis": "Check 7b de lint-plugin.mjs verifica unicidade de basename entre todos os scripts .mjs, .js, .cjs, .sh, .ps1 e .py sob scripts/, lib/ e skills/*/(scripts|workflow)/.",
      "alternative": "Usar workflow.py em cada pasta de skill.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como reutilizar os contratos de agents/*.md no agy sem violar a allowlist de frontmatter de lint-plugin.mjs?",
      "decision": "Manter o frontmatter de agents/*.md dentro das 15 chaves permitidas por lint-plugin.mjs; nos workflows Python ler o corpo Markdown desses agentes passando model explicitamente a agent(..., type_name='self', model=...) (com snapshot git antes/depois para revisores read-only), e em spec-writer/plan-writer despachar invoke_subagent(TypeName='self', Model='pro') instruindo a leitura do arquivo agents/<agent>.md do disco.",
      "basis": "lint-plugin.mjs falha em chaves desconhecidas de agente e independence.test.mjs/spec-tool.test.mjs exigem model, effort e tools literais em plan-author.md e spec-author.md, além de proibirem colar o corpo do agente no prompt.",
      "alternative": "Alterar o frontmatter dos agents/*.md para chaves do agy ou duplicar 7 arquivos de agente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como atualizar os SKILL.md para suportar ambos os ambientes (incluindo preflight do roadmap-release) sem estourar orçamentos de prosa, quebrar docs.test.mjs ou confundir o Claude Code?",
      "decision": "Aplicar edições cirúrgicas, cada frase agy condicionada explicitamente ao host (só quando Workflow/Agent/AskUserQuestion não existe e a ferramenta do agy existe): fallback de ${CLAUDE_SKILL_DIR} onde falta; no roadmap-release/SKILL.md orientar criação de <wtRoot> se ausente e uso de preflight.mjs --declare-permissions \"agy\" mantendo preflight.mjs e as strings de docs.test.mjs intactos; detalhar a tabela Gemini em plan-coordinator/references/routing.md após o boundary.",
      "basis": "roadmap-planner tem apenas 149 bytes LF de folga, plan-coordinator proíbe referências antes de '## After the workflow returns' sob teto de 6.000 bytes, docs.test.mjs valida literalmente as strings de Step 2 do roadmap-release/SKILL.md, e o Step 4 manda o Claude Code nunca tentar o caminho do script.",
      "alternative": "Alterar preflight.mjs com flag --host agy ou duplicar os arquivos SKILL.md por plataforma.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Os tiers Gemini devem ser gravados no estado (progress.json) e aceitos por progress-state.mjs?",
      "decision": "Não: o estado guarda só tiers Claude (haiku, sonnet, opus); a tradução para Gemini acontece no despacho com agyModelFor(s.tier, s.effort). lib/progress-state.mjs, PS_TIER_RANK, psInline e progress.mjs ficam inalterados, e passos marcados inline são despachados como delegados, como em coordinator.js.",
      "basis": "coordinator.js:1301 despacha model: s.tier, então um progress.json com 'flash' retomado no Claude Code quebraria o despacho; coordinator.js não usa inline-start; plan-tool emite sempre tiers Claude, logo aceitar tiers Gemini no estado não teria nenhum consumidor.",
      "alternative": "Ampliar PS_TIER_RANK e psInline para flash_lite/flash/pro e reembutir coordinator.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Tarefa com total=6 (ambiguity=2, blast=1, gate=false — Vetor #5 de routing-table.json).",
      "expected": "route(task) retorna tier='sonnet', effort='high', gate=false; toAgyRoute(route(task)) retorna agyTier='flash', agyModel='pro', agyReviewModel='pro', gate=false."
    },
    {
      "id": "C2",
      "input": "Tarefa haiku/flash_lite com dependentes e verifiability=1 (Vetor #17 de routing-table.json).",
      "expected": "Executor permanece em 'flash_lite' (agyModel='flash_lite'), mas gate=true ativa revisão obrigatória em agyReviewModel='pro'."
    },
    {
      "id": "C3",
      "input": "progress.mjs apply com launch --tier flash (vocabulário Gemini) sobre um passo de progress.json, e retomada no Claude Code de um progress.json escrito por coordinator-agy.py.",
      "expected": "progress.mjs recusa com código 'tier-down' (nível desconhecido); coordinator-agy.py nunca envia tier Gemini, e todo s.tier gravado é haiku, sonnet ou opus, de modo que coordinator.js consegue retomar o mesmo estado."
    },
    {
      "id": "C4",
      "input": "Repetição do mesmo achado F<n> no run_review_loop após correção em tier 'pro'.",
      "expected": "nextAgyTier('pro', true) retorna null e o loop encerra com falha controlada sem reiniciar em loop infinito."
    },
    {
      "id": "C5",
      "input": "Windows em que shutil.which('bash') devolve C:\\Windows\\System32\\bash.exe (lançador do WSL), com ou sem Git for Windows instalado, e máquina sem Python >= 3.8 (ou só com o atalho WindowsApps) rodando node --test \"plugins/**/*.test.mjs\".",
      "expected": "find_git_bash() ignora o caminho sob %SystemRoot% e devolve o bash.exe do Git for Windows; sem Git Bash, run_shell lança git-bash-not-found e o workflow para com stop.kind 'ask', sem usar cmd.exe; sem Python, as suítes agy marcam skip com o motivo 'python >= 3.8 not found' e o G1 termina com exit 0."
    }
  ]
}
```
