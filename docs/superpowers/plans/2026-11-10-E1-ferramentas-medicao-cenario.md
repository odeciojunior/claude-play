# E1 -- Ferramentas de medição e cenário fixo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** Entregar em `tools/measure/` o extrator de métricas de sessão, o gerador de cenário com defeitos semeados e sentinelas, o lançador em lote com arnês de estágio de revisão e o comparador, e acrescentar ao sandbox do release o entregável E5 e o roteiro de parada e retomada.

**Architecture:** Scripts ESM sem dependências, um por responsabilidade, cada um exportando suas funções e só rodando a CLI quando chamado diretamente (padrão de `make-sandbox.mjs`). O extrator lê transcrições e devolve contadores por execução e papel; o lançador gera cenários, chama `claude -p` por um executor injetável, chama o extrator por processo e grava um agregado sem ids; o comparador lê dois agregados. Tudo é testado com dados fabricados em pastas temporárias.

**Tech Stack:** Node 18+ (medido: v22.17.1), `node:test`, `node:assert/strict`, `git` pelo `child_process`. Sem npm.

**Spec:** `docs/superpowers/specs/2026-11-10-E1-ferramentas-medicao-cenario-design.md`

## Global Constraints

- ESM, Node 18+ sem dependências, identificadores e comentários em inglês, testes com `node:test`.
- Todo script de `tools/measure/` exporta suas funções e só executa a CLI quando `resolve(process.argv[1]) === fileURLToPath(import.meta.url)`.
- `tools/measure/` fica fora do plugin publicado (DEC-032). Nenhuma versão de plugin muda nesta branch.
- Nenhum teste chama `claude`, rede ou a pasta de configuração real; tudo roda em `mkdtempSync(join(tmpdir(), ...))`, apagada no fim.
- Nada é gravado em `tools/measure/` fora de `tools/measure/out/` (ignorada pelo git).
- Fixtures: UUIDs só na faixa `00000000-0000-4000-8000-xxxxxxxxxxxx`; ids de agente só `agent-afab<hex>`; todo campo de texto livre começa com `[fab]`.
- Texto do cenário (`tools/measure/scenario/`, card E5 do sandbox) em inglês, a língua do sandbox.
- Nenhum servidor nem porta: a faixa 5200-5209 não é usada.
- Esta branch não edita `docs/plans/roadmap-evolucao-skills/`, nem `release.config.json`, nem o comando do gate G1.
- Os scripts de `docs/reports/2026-11-10-session-metrics/` não são alterados.
- Ambiente medido: Windows 11, PowerShell 7 e Git Bash; `core.autocrlf=true`. Todo leitor de texto aceita `\r\n` (`split(/\r?\n/)`); todo sandbox gerado usa `core.autocrlf=false` (como `make-sandbox.mjs`).
- Testes que rodam `node --test` dentro de um sandbox apagam `NODE_TEST_CONTEXT` do ambiente do filho (como `make-sandbox.test.mjs`).
- Commits de tarefa: assunto começa com `E1 T<n>:`, mensagem termina com `Co-Authored-By: Claude <noreply@anthropic.com>`. Só `git add` dos arquivos da tarefa (nunca `-A`).

## Review Focus

1. **Porta do sandbox em testes paralelos.** `make-sandbox.test.mjs` e `make-scenario.test.mjs` rodam `node --test` em sandboxes cujo teste de base liga a porta 48731; com `node --test "plugins/**" "tools/**"` os arquivos rodam em paralelo e podem colidir (EADDRINUSE). Esperado: o teste de `make-scenario` repete a rodada do sandbox até 3 vezes quando a saída contém `EADDRINUSE`, e só falha na terceira. Teste: Task 9, `retries the sandbox suite on EADDRINUSE`.
2. **O artefato semeado não denuncia a semeadura.** Um revisor que lê `git log -p feat/E5` não pode achar `defect`, `seed`, `sentinel` nem `planted`. Teste: Task 7 (`seeded history never names the seeding`) e reaproveitado nas Tasks 8 e 9.
3. **Saídas com caminho pessoal.** O agregado não pode guardar `--work`, `--out`, `--config-dir` nem `scriptPath` (são caminhos pessoais). Teste: Task 11, `aggregate holds no session id, personal path or agent description`.
4. **Transcrição com linha final parcial ou CRLF.** O leitor JSONL ignora linha que não é JSON e aceita `\r\n`. Teste: Task 2, `readJsonl tolerates CRLF and a partial last line`.
5. **`--out` dentro do repositório.** O extrator recusa `--out` no repositório fora de `tools/measure/out/` (código 2), inclusive com `..` e caixa diferente no Windows. Teste: Task 4, `refuses --out inside the repository outside tools/measure/out`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `CLAUDE.md`, `.gitignore` | comando de testes com `tools/**`, linha do Layout, `tools/measure/out/` | 1 |
| `tools/measure/session-metrics.mjs` | extrator | 2, 3, 4 |
| `tools/measure/session-metrics.test.mjs` | AC1, AC2, AC5 | 2, 3, 4 |
| `tools/measure/fixtures/transcripts/**` | transcrições fabricadas | 2, 3 |
| `tools/measure/fixtures/prices.json` | tabela de preços fabricada | 2 |
| `tools/measure/prices.json` | tabela de preços real, datada | 4 |
| `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs` (+ `.test.mjs`) | E5, DEC-002, REQ-005, roteiro | 5 |
| `tools/measure/scenario/**` | peças fixas e E5 (spec, plano, código por tarefa) | 6 |
| `tools/measure/make-scenario.mjs` (+ `.test.mjs`) | gerador de cenário e variantes | 6, 7, 8, 9 |
| `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/*.mjs` | defeitos, semeadura e sentinelas | 7, 8, 9 |
| `tools/measure/compare.mjs` (+ `.test.mjs`), `tools/measure/fixtures/aggregates/*.json` | comparador, AC6 | 10 |
| `tools/measure/run-batch.mjs` (+ `.test.mjs`) | lançador, validade, desfechos, arnês, AC7 | 11, 12, 14 |
| `tools/measure/arms/*.md` | braço `atual` de spec e plano | 13 |

Nenhuma task precisa de navegador. Nenhuma task tem efeito externo: todas declaram `external: false`. Nenhuma trava (`needsLock`) é usada: não há travas configuradas. Todas as tasks têm `reviewTier: sonnet` (nenhuma toca autenticação, segredos, backend de produção, migração de dados ou push).

Decisões do plano (registradas para o dono; origem executor, status pendente):

- **DP-1** Cada defeito é um módulo `defects/sentinels/<id>.mjs` que exporta `seed(repoDir)` (aplica o defeito à árvore de trabalho) e `present(repoDir, ref = 'HEAD')`. Junta semeadura e sentinela no mesmo arquivo, para o defeito e sua checagem não divergirem; nenhum módulo é copiado para o sandbox. Alcance: local.
- **DP-2** O sandbox ganha `DEC-002` ("E5 utilities are pure: no I/O and no dependencies"), para S4 ter uma decisão registrada do sandbox a contrariar. E1 a E4 e DEC-001 não mudam. Alcance: contrato.
- **DP-3** O extrator chama o lançador por processo (`exec(process.execPath, [session-metrics.mjs, ...])`), o que deixa o teste do AC7 contar as chamadas pelo executor simulado. Alcance: local.
- **DP-4** O formato do diário (`journal.jsonl`) lido pela checagem de validade é o das fixtures fabricadas (uma linha JSON por agente com `label` e `result`, objeto ou texto JSON); a leitura é tolerante e o formato real é conferido pelo dono na primeira tentativa de E15. Alcance: local.
- **DP-5** Execução sem transcrição de agente ligada por `toolUseId`: sob o lançador cada execução é uma sessão, então todo arquivo `agent-*.jsonl` dentro da pasta da sessão pertence a ela. Alcance: local.

---

### Task 1: G1 local, `CLAUDE.md` e `.gitignore` (peça 2)

**tier:** haiku · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `CLAUDE.md` (seção "Rules that matter", item **No CI**; bloco Layout)
- Modify: `.gitignore`

**Interfaces:** Produces: o comando de testes do repositório `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.

- [ ] **Step 1:** Em `CLAUDE.md`, troque `` `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` `` por `` `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` ``. No bloco Layout, depois da linha de `docs/plans/  docs/reports/`, acrescente: `tools/measure/                      # Repo-only measurement tools (not shipped); outputs go to tools/measure/out/, never committed`.
- [ ] **Step 2:** Em `.gitignore`, acrescente no fim o bloco:

```
# Measurement outputs (carry session ids)
tools/measure/out/
```

- [ ] **Step 3: Verificar**

Run (Git Bash): `grep -c 'tools/\*\*/\*.test.mjs' CLAUDE.md && grep -c '^tools/measure/out/$' .gitignore && git check-ignore -q tools/measure/out/x.json && echo ok`
Expected: `1`, `1`, `ok`. `docs/plans/roadmap-evolucao-skills/` e `release.config.json` intactos: `git diff --name-only` lista só os dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "E1 T1: comando de testes com tools/** e saída de medição ignorada" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Extrator, contagem por mensagem, tokens e custo (AC1)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/session-metrics.mjs`
- Create: `tools/measure/session-metrics.test.mjs`
- Create: `tools/measure/fixtures/transcripts/` (projeto `fab-project`, sessão `00000000-0000-4000-8000-000000000001.jsonl` e a pasta `00000000-0000-4000-8000-000000000001/subagents/` com `agent-afab01.jsonl` + `.meta.json`, `agent-afab02.jsonl` + `.meta.json`)
- Create: `tools/measure/fixtures/prices.json`

**Interfaces:**
- Produces (em `session-metrics.mjs`):
  - `readJsonl(file: string): object[]`
  - `family(model: string): 'haiku'|'sonnet'|'opus'|'fable'|'other'`
  - `dedupeMessages(lines: object[]): object[]` — mensagens `assistant` com `message.usage`, sem `message.model === '<synthetic>'`, uma por `message.id` (senão `requestId`), guardando a de maior `output_tokens`.
  - `loadPrices(file: string): Prices` — `{ date, source, models: { [family]: { input, output, cacheRead } }, cacheWrite5m, cacheWrite1h }`.
  - `costOf(tokens: Tokens, family: string, prices: Prices): number|null` — `null` quando a família não tem preço.
  - `extract({ root: string, sessions?: string[], runs?: Attempts, prices: Prices }): { runs: Run[], unpriced: string[] }`
  - Tipos: `Tokens = { input, cacheWrite5m, cacheWrite1h, cacheRead, output }`; `Counters = { calls: { haiku, sonnet, opus, fable, other }, promptBytes, tokens: Tokens, cost: number|null, unpriced: string[] }`; `Run = { run: string, sessions: string[], roles: { [role]: Counters & { agents: number } }, total: Counters, reviewRounds: { loops: { [loop]: number }, extra: number }, tasks: { count: number, loop: Counters }, main: { turns: number, agentCalls: { [requestedModel]: number }, promptBytes: number, tokens: Tokens, cost: number|null } }`.

Regras que o teste fixa: escrita de cache 5 min = `usage.cache_creation.ephemeral_5m_input_tokens`, 1 h = `ephemeral_1h_input_tokens`; sem `cache_creation`, todo `cache_creation_input_tokens` conta como 5 min. Custo em dólar = `(input·p.input + cw5m·p.input·cacheWrite5m + cw1h·p.input·cacheWrite1h + cacheRead·p.cacheRead + output·p.output) / 1e6`. `calls` conta cada agente uma vez, na família de maior número de mensagens deduplicadas. `promptBytes` de um agente = `Buffer.byteLength` UTF-8 do texto da primeira mensagem `user` do arquivo do agente. Contexto principal: `turns` = mensagens deduplicadas da sessão principal (fora `isSidechain`); `agentCalls` = blocos `tool_use` `Agent`/`Task` por `input.model ?? 'default'`; `promptBytes` = bytes das mensagens `user` humanas (texto, não `tool_result`, não `isMeta`). Nesta task todo agente vai ao papel provisório `agent:<agentType ?? 'general'>`; a Task 3 troca pelo classificador.

Fixture: a sessão principal tem uma mensagem de assistente gravada 3 vezes com o mesmo `message.id` (`output_tokens` 5, 5, 9), uma mensagem `<synthetic>`, uma chamada `Agent` com `model: 'haiku'`; `agent-afab01` (sonnet, 2 mensagens distintas, uma delas repetida) e `agent-afab02` (modelo `claude-mystery-1`, sem preço). `fixtures/prices.json`: `{ "date": "2026-11-10", "source": "[fab] fabricated price table", "models": { "sonnet": { "input": 2, "output": 10, "cacheRead": 0.1 }, "opus": { "input": 4, "output": 20, "cacheRead": 0.2 }, "haiku": { "input": 1, "output": 5, "cacheRead": 0.05 } }, "cacheWrite5m": 1.25, "cacheWrite1h": 2 }`. Todo texto livre começa com `[fab]`.

- [ ] **Step 1: Escrever os testes que falham** em `session-metrics.test.mjs`:
  - `counts usage once per message id, keeping the largest output` — `extract(...)` na fixture: `main.tokens.output` igual à soma com 9 (não 19) para a mensagem repetida; a `<synthetic>` não conta.
  - `splits cache writes into 5m and 1h` — valores exatos da fixture em `total.tokens.cacheWrite5m` e `cacheWrite1h`.
  - `counts agent calls by dominant model family` — `total.calls` = `{ haiku: 0, sonnet: 1, opus: 0, fable: 0, other: 1 }`; `main.agentCalls` = `{ haiku: 1 }`.
  - `measures prompt bytes as UTF-8 of the first user message` — `promptBytes` do papel do `agent-afab01` igual a `Buffer.byteLength(<texto da fixture>, 'utf8')` com um caractere acentuado no texto.
  - `estimates cost and keeps unpriced models null` — custo do sonnet calculado pela fórmula acima com os números da fixture (`assert.ok(Math.abs(a - b) < 1e-9)`); papel do `agent-afab02` com `cost: null`; `unpriced` = `['other']`; `total.cost` soma só os com preço e `total.unpriced` lista `other`.
  - `readJsonl tolerates CRLF and a partial last line` — arquivo temporário com `\r\n` e última linha cortada devolve só as linhas válidas.
- [ ] **Step 2:** `node --test tools/measure/session-metrics.test.mjs` → Expected: FAIL (`Cannot find module` / export ausente).
- [ ] **Step 3:** Implemente as funções acima em `tools/measure/session-metrics.mjs`. Listagem: sessões principais = `<root>/<projeto>/<sid>.jsonl`; agentes = `<root>/<projeto>/<sid>/subagents/agent-*.jsonl` e `<sid>/subagents/workflows/wf_*/agent-*.jsonl` (`workflow: true` nesses), `meta` de `agent-<id>.meta.json` (ausente = `{}`). Sem `runs`, cada sessão (filtrada por `sessions`) é uma execução com `run = sid`.
- [ ] **Step 4:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS, 6 testes.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/session-metrics.mjs tools/measure/session-metrics.test.mjs tools/measure/fixtures/transcripts tools/measure/fixtures/prices.json
git commit -m "E1 T2: extrator conta uso uma vez por mensagem, tokens e custo" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Papéis, rodadas de revisão e laço de tarefas (AC1, AC2)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/session-metrics.mjs`
- Modify: `tools/measure/session-metrics.test.mjs`
- Create: `tools/measure/fixtures/transcripts/fab-project/00000000-0000-4000-8000-000000000002.jsonl` e `.../00000000-0000-4000-8000-000000000002/subagents/workflows/wf_fab01/agent-afab1*.jsonl` (+ `.meta.json`)

**Interfaces:**
- Consumes: `extract`, `Run`, `Counters` da Task 2.
- Produces: `classifyRole(label: string, { workflow: boolean, agentType?: string }): string`; `Run.roles` passa a usar esse papel; `Run.reviewRounds` e `Run.tasks` preenchidos.

Regras (tabela da peça 1 do spec, nesta ordem, sobre o rótulo em minúsculas sem o prefixo `e<n>:` e sem sufixo `#<n>`): `discovery`→`discovery`; `preflight*`|`preparar*`→`preflight`; `setup`→`setup`; `spec-review<k>`→`spec-review`; `spec-fix<k>`→`spec-fix`; `spec`→`spec`; `plan-review<k>`→`plan-review`; `plan-fix<k>`→`plan-fix`; `plan`→`plan`; `status-*`→`status-record`; `progress*`→`progress`; `review-log*`→`review-log`; `report`→`report`; `t<k>:impl`|`exec:*`→`implementer`; `t<k>:spec<r>`→`task-spec-review`; `t<k>:quality<r>`→`task-quality-review`; `t<k>:fix*`→`task-fix`; `final*`|`revisao-final*`|`sync*`|`test-integrity*`→`final-review`; `gates*`|`evidence*`|`suite*`→`gates`; `merge*`|`pre-merge*`|`cleanup*`→`merge`; `docs*`→`docs`; `guarda*`|`conferir*`|`commit*`|`git-truth*`→`guards`; outro rótulo com `workflow: true`→`other:<rótulo sem dígitos>`; `workflow: false`→`agent:<agentType ?? 'general'>`. O rótulo é `meta.description`.

Laços de revisão: `^(spec-review|plan-review|final)(\d+)$` → laço = o prefixo; `^t(\d+):(spec|quality)(\d+)$` → laço `t<n>:<kind>`. `reviewRounds.loops[laço]` = maior rodada vista; `extra` = soma de `(max − 1)`. `tasks.count` = número de `n` distintos em rótulos `t<n>:*`; `tasks.loop` = soma dos contadores dos agentes com rótulo `t<n>:*`.

Fixture da sessão 2 (workflow `wf_fab01`, rótulos com prefixo `E5:`): `discovery`, `spec`, `spec-review1`, `plan`, `plan-review1`, `plan-review2`, `plan-fix1`, `status-plan`, `progress`, `review-log`, `report`, `t1:impl`, `t1:spec1`, `t1:quality1`, `t2:impl`, `t2:spec1`, `t2:spec2`, `t2:fix1`, `final1`, `gates`, `merge`, `docs`, `commit-plan`, `wobble3`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `classifies every label family of the role table` — tabela de pares `[rótulo, opções, papel esperado]` cobrindo cada linha acima, incluindo `E5:wobble3`→`other:wobble`, `('Explore things', { workflow: false, agentType: 'Explore' })`→`agent:Explore` e `(undefined, { workflow: false })`→`agent:general`.
  - `status, progress, review log and report come out as separate rows` (AC2) — `extract` na sessão 2: `Object.keys(run.roles)` contém `status-record`, `progress`, `review-log` e `report`, cada um com `agents === 1` (as linhas do CSV são conferidas na Task 4).
  - `records review rounds per loop` — `reviewRounds.loops` = `{ 'spec-review': 1, 'plan-review': 2, 't1:spec': 1, 't1:quality': 1, 't2:spec': 2, final: 1 }`, `extra` = 2.
  - `counts tasks and the task loop` — `tasks.count === 2`; `tasks.loop.calls.sonnet` igual ao número de agentes `t*` sonnet da fixture.
- [ ] **Step 2:** `node --test tools/measure/session-metrics.test.mjs` → Expected: FAIL nos 4 testes novos; os 6 da Task 2 passam.
- [ ] **Step 3:** Implemente `classifyRole` e o preenchimento de `reviewRounds` e `tasks` em `extract`.
- [ ] **Step 4:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS, 10 testes.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/session-metrics.mjs tools/measure/session-metrics.test.mjs tools/measure/fixtures/transcripts
git commit -m "E1 T3: papéis por família de rótulo, rodadas e laço de tarefas" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CLI do extrator, CSV, tentativas, preços reais e teste de privacidade (AC1, AC2, AC5)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/session-metrics.mjs`
- Modify: `tools/measure/session-metrics.test.mjs`
- Create: `tools/measure/prices.json`

**Interfaces:**
- Consumes: `extract`, `classifyRole` (Tasks 2, 3).
- Produces: `toCsv(result): string`; `main(argv: string[]): Promise<number>` (código de saída); manifesto de tentativas `Attempts = { attempts: [{ n: number, sessions: string[] }] }` — com ele, cada tentativa é uma execução com `run = 'attempt-<n>'` que soma as sessões listadas.
- CLI: `node tools/measure/session-metrics.mjs --root <dir> --out <dir> [--sessions id,id] [--runs <attempts.json>] [--prices <prices.json>]`. Sem `--root` ou `--out`: código 2 e `usage:` no stderr. `--prices` padrão: `tools/measure/prices.json` ao lado do script. Grava `metrics.json` (`extract` inteiro) e `metrics.csv`.
- CSV: cabeçalho exato `run,role,agents,calls_haiku,calls_sonnet,calls_opus,calls_fable,calls_other,promptBytes,input,cacheWrite5m,cacheWrite1h,cacheRead,output,cost`; uma linha por execução e papel, mais uma linha `main` e uma `total` por execução; `cost` vazio quando `null`.
- `--out` dentro do repositório (raiz achada por `git rev-parse --show-toplevel` a partir do script) só é aceito sob `tools/measure/out/`; comparação depois de `resolve` e, no Windows, sem diferença de caixa. Fora disso: código 2.

`prices.json`: valores da página oficial de preços da Anthropic lida na implementação (`https://docs.claude.com/en/docs/about-claude/pricing`), com `date` = dia da leitura e `source` = a URL. Já conhecidos (SRC-10): leitura de cache 0,05× da entrada em Opus e Sonnet 5.5 e 0,025× em Fable; `cacheWrite5m: 1.25`, `cacheWrite1h: 2`; Fable entrada 10 e saída 50. Se a página não puder ser lida neste ambiente, grave só os valores conhecidos e deixe de fora as famílias sem valor (o custo delas sai `null`), com `source` dizendo isso; registre em DONE_WITH_CONCERNS. A leitura da página é só leitura pública, sem efeito externo.

- [ ] **Step 1: Escrever os testes que falham:**
  - `writes metrics.json and one csv row per run and role` (AC1, AC2) — `main(['--root', fixtures, '--out', tmp, '--prices', fixturePrices])` devolve 0; `metrics.csv` tem o cabeçalho exato; para a sessão 2 há linhas distintas com `role` `status-record`, `progress`, `review-log` e `report`.
  - `groups sessions of one attempt with --runs` — manifesto `{ attempts: [{ n: 1, sessions: [sid1, sid2] }] }` gera uma execução `attempt-1` cujo `total.tokens.output` é a soma das duas sessões.
  - `requires --root and --out` — `spawnSync(node, [script])` sai com 2 e stderr contém `usage:`.
  - `refuses --out inside the repository outside tools/measure/out` — `--out <repo>/tools/measure` e `--out <repo>/tools/measure/out/../x` saem com 2; `--out <repo>/tools/measure/out/t-<random>` sai com 0 (e o teste apaga essa pasta).
  - `real price table is dated and sourced` — `prices.json` tem `date` no formato `YYYY-MM-DD`, `source` não vazio, `cacheWrite5m === 1.25`, `cacheWrite1h === 2`.
  - `tools/measure holds no session id, personal path or unfabricated text` (AC5) — percorre todo arquivo de `tools/measure/` exceto `out/` e falha quando acha: um UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`) que não começa com `00000000-0000-4000-8000-`; `agent-a[0-9a-f]+` que não começa com `agent-afab`; `/[A-Za-z]:[\\/]+Users[\\/]+(?!<|\$)[^\\/\s"'`]+/i`, `/\/(Users|home)\/(?!<|\$)[^\/\s"'`]+/`, `/\b[A-Za-z]--Users-[^\s"'`]+/`; e, nos `.jsonl` e `.json` de `fixtures/`, todo campo string chamado `text`, `content` (string), `description`, `prompt` ou de `tool_result` que não começa com `[fab]`. O próprio arquivo de teste escreve os padrões sem casar com eles (as expressões usam `(?!<|\$)`; não cite caminhos reais).
  - `privacy scan catches a planted personal path and session id` — roda a mesma função sobre uma pasta temporária com `C:\Users\someone\x` e um UUID fora da faixa e espera 2 achados (evita teste que nunca falha).
- [ ] **Step 2:** `node --test tools/measure/session-metrics.test.mjs` → Expected: FAIL nos testes novos.
- [ ] **Step 3:** Implemente `toCsv`, `main`, o manifesto `--runs` e grave `prices.json`. A função de varredura de privacidade fica no próprio arquivo de teste (`scanPrivacy(dir): { file, kind, match }[]`).
- [ ] **Step 4:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS, 17 testes.
- [ ] **Step 5:** `git status --porcelain` → Expected: só os 3 arquivos da task; nada em `tools/measure/out/` aparece (ignorado).
- [ ] **Step 6: Commit**

```bash
git add tools/measure/session-metrics.mjs tools/measure/session-metrics.test.mjs tools/measure/prices.json
git commit -m "E1 T4: CLI do extrator, CSV por papel, tentativas, preços e teste de privacidade" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Sandbox com E5, DEC-002 e roteiro de parada e retomada (AC3)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs`
- Modify: `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs`

**Interfaces:**
- Produces: `export const STOP_RESUME = { deliverable: 'E5', first: 'run E5', stopWhen: { branch: 'feat/E5', subjectPrefix: 'E5 T1:' }, then: 'resume E5' }`; `makeSandbox(target)` passa a gravar `scenario/stop-resume.json` (na raiz do sandbox, fora da pasta do roadmap) com `JSON.stringify(STOP_RESUME, null, 2) + '\n'`, dentro do commit de base. Assinatura e saída da CLI inalteradas.

Conteúdo novo (texto em inglês; E1 a E4, DEC-001 e os textos atuais não mudam):

- Card `<!-- roadmap:card id=E5 phase=extras track=engineering priority=Should size="not estimated" depends=- reqs=REQ-005 critical=false -->`, título `### E5 -- Text utilities`, `Why: REQ-005.`, três peças (`slugify(text)` em `src/slugify.mjs`, `truncate(text, max)` em `src/truncate.mjs`, `wordCount(text)` em `src/word-count.mjs`, cada uma com seu teste `tests/e5-<slugify|truncate|word-count>.test.mjs`) e os critérios:
  1. `Given text with spaces, punctuation and accented letters, when slugify is called, then lowercase ASCII words joined by single hyphens come back (slugify('Café au Lait!') is 'cafe-au-lait'). {verify: test; evidence: node --test tests/e5-slugify.test.mjs}`
  2. `Given text longer than max, when truncate is called, then at most max characters come back, ending with '…'; text of length max or less comes back unchanged; max below 1 throws a RangeError. {verify: test; evidence: node --test tests/e5-truncate.test.mjs}`
  3. `Given text, when wordCount is called, then the number of whitespace-separated words comes back, and 0 for empty or blank text. {verify: test; evidence: node --test tests/e5-word-count.test.mjs}`
- `requirements.md`: `| REQ-005 | Text can be turned into ASCII slugs, truncated and counted in words | functional | SRC-01 | E5 | covered |`.
- `decisions.md`: `| DEC-002 | 2026-11-09 | E5 | E5 utilities are pure: no I/O and no dependencies | Utilities that log or cache to disk | - | The sandbox is retired | SRC-01 | in-force |`; a estratégia passa a dizer `Absorbs DEC-001 and DEC-002.` no changelog e na seção Decisions.
- `state.md`: linha `| E5 | not-started | - | Run the release skill |` no painel; o item de Now passa a citar E5.
- `strategy.md`: linha de E5 na visão geral (`| E5 | Text utilities | Extras | - |`), E5 na linha da fase "Text helper attempted" (`| E3, E5 |`), `critical-path.md` com `E5` como nó isolado, "Coverage summary" com cinco requisitos.

- [ ] **Step 1: Escrever os testes que falham** em `make-sandbox.test.mjs`:
  - `sandbox: E5 has more than one piece and criterion, and the folder passes checker and preflight` (AC3) — gera o sandbox; `strategy.md` casa `/id=E5 [^>]*depends=- reqs=REQ-005/`; o card de E5 (fatia entre o marcador do card E5 e o `<!-- /roadmap:card -->` seguinte) tem ≥ 2 linhas `- Piece` e ≥ 2 linhas `{verify: test; evidence: node --test tests/e5-`; o checker vendorizado sai com 0 e sem `\b[1-9]\d* error`; `preflight.mjs` devolve `errors: []`.
  - `sandbox: the stop and resume script names a deliverable of the panel` (AC3) — `scenario/stop-resume.json` existe, `deepEqual` com `STOP_RESUME` importado de `make-sandbox.mjs`; `state.md` casa `new RegExp('\\| ' + STOP_RESUME.deliverable + ' \\|')`; o arquivo está fora de `docs/plans/roadmap-sandbox/` e o sandbox continua limpo com 1 commit.
  - `sandbox: E1 to E4 are unchanged` — os cards de E1 a E4 na estratégia continuam contendo os comandos `{verify}` atuais (`tests/e1.test.mjs` … `tests/e4.test.mjs`, `node -e "process.exit(1)"`) e `decisions.md` contém DEC-001 com o texto atual.
- [ ] **Step 2:** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` → Expected: FAIL nos 3 novos; os 4 atuais passam.
- [ ] **Step 3:** Implemente as mudanças acima em `make-sandbox.mjs` e atualize o comentário de topo (cinco entregáveis e o roteiro).
- [ ] **Step 4:** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` → Expected: PASS, 7 testes.
- [ ] **Step 5: Gates do plugin**
  - G3: `claude plugin validate plugins/productivity-tools` → Expected: exit 0.
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → Expected: exit 0.
- [ ] **Step 6: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs
git commit -m "E1 T5: sandbox ganha E5, DEC-002 e o roteiro de parada e retomada" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Peças fixas do cenário e `make-scenario` sem semeadura

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/scenario/coordinator-plan.md`, `tools/measure/scenario/planner-theme.md`, `tools/measure/scenario/tracker-event.md`
- Create: `tools/measure/scenario/e5/spec.md`, `tools/measure/scenario/e5/plan.md`, `tools/measure/scenario/e5/code/t1/**`, `.../t2/**`, `.../t3/**`
- Create: `tools/measure/make-scenario.mjs`
- Create: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Consumes: `makeSandbox`, `STOP_RESUME` de `plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs` (Task 5).
- Produces (em `make-scenario.mjs`):
  - `export const VARIANTS` — os 13 nomes da tabela da peça 3 do spec: `plan-only`, `completo`, `parada-retomada`, `coordinator`, `planner`, `tracker`, `plano-semeado-A`, `plano-semeado-B`, `codigo-semeado-A`, `codigo-semeado-B`, `spec-semeado-A`, `spec-semeado-B`, `plano-semeado-codigo`.
  - `export const E5_PATHS = { spec: 'docs/superpowers/specs/2026-11-10-E5-text-utilities-design.md', plan: 'docs/superpowers/plans/2026-11-10-E5-text-utilities.md' }`.
  - `makeScenario(dir: string, variant: string, { fromRun?: string } = {}): Promise<Scenario>` com `Scenario = { dir, variant, prompts: string[], stopResume: object|null, seeded: { id, file }[], seededCommit: string|null, seededBlobs: { [file]: string } }`.
  - `prepareE5Branch(dir, { withPlan: boolean, tasks: number, fromRun?: string }): void` — cria `feat/E5` a partir de `main`, commita o spec (`docs(spec): E5 text utilities design`), o plano se `withPlan` (`docs(plan): E5 text utilities plan`), e as tarefas 1..`tasks` com os arquivos de `scenario/e5/code/t<k>/` e assunto `E5 T<k>: <título da tarefa no plano>`.
  - CLI: `node tools/measure/make-scenario.mjs <dir> --variant <nome> [--from-run <pasta>]` imprime `JSON.stringify(scenario, null, 2)`; variante desconhecida ou `<dir>` ausente: código 2; `<dir>` dentro do repositório (raiz por `git rev-parse --show-toplevel` a partir do script): erro e código 1, sem criar nada.

Prompts por variante: `plan-only` → `['/productivity-tools:roadmap-release plan-only E1']`; `completo` → `['/productivity-tools:roadmap-release run E5']`; `parada-retomada` → `['/productivity-tools:roadmap-release run E5', '/productivity-tools:roadmap-release resume E5']` com `stopResume = STOP_RESUME`; `coordinator` → copia `scenario/coordinator-plan.md` para `docs/plans/2026-11-10-fixed-plan.md` (commit `docs(plan): fixed plan`) e `['/productivity-tools:plan-coordinator docs/plans/2026-11-10-fixed-plan.md']`; `planner` → `['/productivity-tools:roadmap-planner ' + conteúdo de planner-theme.md]`; `tracker` → `['/productivity-tools:roadmap-tracker ' + conteúdo de tracker-event.md]`. As variantes semeadas lançam `Error('variant not implemented yet: <nome>')` nesta task (as Tasks 7 a 9 as implementam).

Conteúdo do cenário (inglês, sem as palavras `defect`, `seed`, `sentinel`, `planted`):
- `coordinator-plan.md`: plano de três passos de funções puras (`src/sum.mjs`, `src/mean.mjs`, `src/median.mjs`), cada um com teste `tests/coord-<nome>.test.mjs`, comando de verificação e commit.
- `planner-theme.md`: tema (uma biblioteca de utilidades de data) e as respostas da clarificação já escritas, para rodar sem pessoa.
- `tracker-event.md`: evento sobre a pasta do sandbox: uma decisão nova (DEC-003 sobre E2) e E1 integrado.
- `e5/spec.md`: spec de E5 no formato do release: critérios do card literais (os 3 da Task 5), seções "Autonomous decisions" (nenhuma que contrarie DEC-001/DEC-002) e "Depends on human input" (nenhum).
- `e5/plan.md`: cabeçalho com `**Roadmap:** docs/plans/roadmap-sandbox/`; tarefas 1 (slugify), 2 (truncate), 3 (wordCount e `src/index.mjs`, que reexporta as três funções; roda `node --test` inteiro e por isso declara `needsLock: sandbox-port`); cada tarefa com `Files:`, `tier: sonnet`, `reviewTier: sonnet`, `external: false`, passos de teste com asserções (o teste de truncate afirma o `RangeError`), comando de verificação; seção `## Acceptance criteria evidence` com uma linha por critério `| AC<n> | test | <comando do {verify}> | <testRef> | external: false |`.
- `e5/code/t<k>/`: os arquivos de cada tarefa (`src/…` e `tests/e5-….test.mjs`). As implementações cumprem os critérios inteiros (acentos no `slugify` por `normalize('NFD')`, `RangeError` no `truncate`), mas os testes do card não cobrem todos os casos: o de slugify não testa acento; o de truncate testa um corte e o `RangeError`, sem testar o comprimento exato do corte; o de word-count testa `'the quick fox'` → 3 e `''` → 0.
- `--from-run <pasta>`: troca `e5/spec.md` e `e5/plan.md` por `<pasta>/docs/superpowers/specs/*-E5-*-design.md` e `<pasta>/docs/superpowers/plans/*-E5-*.md` (erro claro quando um deles falta).

- [ ] **Step 1: Escrever os testes que falham** em `make-scenario.test.mjs` (cada teste em pasta temporária):
  - `lists every variant of the spec table` — `VARIANTS` tem exatamente os 13 nomes.
  - `unseeded variants build a sandbox and the expected prompts` — para `plan-only`, `completo`, `parada-retomada`, `coordinator`, `planner`, `tracker`: `prompts` como acima; `parada-retomada` traz `stopResume` igual a `STOP_RESUME`; `coordinator` deixa `docs/plans/2026-11-10-fixed-plan.md` commitado; sandbox limpo.
  - `E5 code of the scenario passes the card tests in the sandbox` — `prepareE5Branch(dir, { withPlan: true, tasks: 3 })`; em `feat/E5`, `node --test tests/e5-slugify.test.mjs tests/e5-truncate.test.mjs tests/e5-word-count.test.mjs` sai com 0 (ambiente sem `NODE_TEST_CONTEXT`); `git log --format=%s main..feat/E5` = 5 assuntos, os três últimos começando por `E5 T1:`, `E5 T2:`, `E5 T3:`.
  - `E5 plan follows the release recipe` — `e5/plan.md` contém a linha `**Roadmap:** docs/plans/roadmap-sandbox/`, as tarefas 1..3 com `external: false`, a seção `## Acceptance criteria evidence` com as linhas `AC1`, `AC2`, `AC3` e, em cada, o comando exato do `{verify}` do card (lido de `strategy.md` do sandbox gerado, não copiado no teste).
  - `refuses a target inside the repository` — CLI com `<repo>/tools/measure/out/x` sai com 1 e não cria a pasta; variante desconhecida sai com 2.
- [ ] **Step 2:** `node --test tools/measure/make-scenario.test.mjs` → Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Escreva as peças do cenário e implemente `make-scenario.mjs`.
- [ ] **Step 4:** `node --test tools/measure/make-scenario.test.mjs` → Expected: PASS, 5 testes.
- [ ] **Step 5:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS (o teste de privacidade agora também varre `scenario/`).
- [ ] **Step 6: Commit**

```bash
git add tools/measure/scenario tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
git commit -m "E1 T6: peças fixas do cenário e gerador de variantes sem semeadura" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Manifesto, defeitos de plano e variantes `plano-semeado-*` (AC4, parte de plano)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/defects/manifest.json`
- Create: `tools/measure/defects/sentinels/P1.mjs` … `P8.mjs`, `PX1.mjs`, `PX2.mjs`, `PX3.mjs`
- Modify: `tools/measure/make-scenario.mjs`
- Modify: `tools/measure/make-scenario.test.mjs`

**Interfaces:**
- Consumes: `prepareE5Branch`, `E5_PATHS`, `makeScenario` (Task 6).
- Produces:
  - Entrada do manifesto: `{ id, class: 'plan'|'code'|'spec', kind, artifact: 'A'|'B'|'C', file, sentinel: 'sentinels/<id>.mjs', detectedBy: 'reviewer'|'code', description, codeSignal? }`. `codeSignal` (só PX) é a fonte de uma RegExp que o diário casa quando a checagem do workflow acusa o defeito.
  - Cada módulo de defeito exporta `seed(repoDir: string): void` (altera a árvore de trabalho) e `present(repoDir: string, ref = 'HEAD'): boolean` (lê o arquivo por `git show <ref>:<file>`; as de código, na Task 9, leem a árvore de trabalho).
  - `seedVariant(dir, variant)` interno: prepara a branch, aplica `seed` de cada entrada do artefato da variante, commita tudo num só commit de assunto neutro e devolve `seeded`, `seededCommit` e `seededBlobs` (`git rev-parse <commit>:<file>` por arquivo semeado).
  - `export function artifactOf(variant): { class, artifact } | null` — `plano-semeado-A`→`{plan,A}`, `-B`→`{plan,B}`, `plano-semeado-codigo`→`{plan,C}` (e, nas Tasks 8 e 9, `spec-semeado-*` e `codigo-semeado-*`).

Plano: a branch `feat/E5` tem spec e plano limpos (`prepareE5Branch(dir, { withPlan: true, tasks: 0 })`) e o commit semeado `docs(plan): E5 refine plan`. Prompts: `['/productivity-tools:roadmap-release plan-only E5']`.

| id | artefato | `seed` no plano de E5 | `present` (no ref) |
|---|---|---|---|
| P1 | A | apaga o comando de verificação (linha `Run:` e o `Expected:`) da tarefa 2 | a seção da tarefa 2 não tem linha `Run:` |
| P2 | A | troca o comando de verificação da tarefa 1 por `npm run verify-slug` | o plano contém `npm run verify-slug` |
| P3 | A | troca o conteúdo das tarefas 1 e 3, mantendo os números (o índice vem antes do slugify) | a tarefa que cria `src/index.mjs` aparece antes da que cria `src/slugify.mjs` |
| P4 | A | troca o passo de teste da tarefa 2 por um que só afirma `typeof truncate === 'function'` | a seção da tarefa 2 não contém `RangeError` |
| P5 | B | acrescenta à tarefa 1 um passo que anexa `slugify ready` a `../outbox.log`, mantendo `external: false` | o plano contém `../outbox.log` |
| P6 | B | apaga `needsLock: sandbox-port` da tarefa 3 | o plano não contém `sandbox-port` |
| P7 | B | acrescenta `docs/plans/roadmap-sandbox/state.md` à lista `Files:` da tarefa 2 | o plano contém `docs/plans/roadmap-sandbox/` numa lista `Files:` |
| P8 | B | troca o `reviewTier` da tarefa 3 para `opus` | a tarefa 3 declara `reviewTier: opus` |
| PX1 | C | apaga a linha `AC3` da seção de evidência; `codeSignal: "criterion AC3 has no evidence row"` | a seção não tem linha que começa por `\| AC3 \|` |
| PX2 | C | troca a linha `AC1` para `kind` `human` sem comando; `codeSignal: "criterion AC1: the plan (changed the command bound by the card tag\|replaced)"` | a linha `AC1` tem `human` |
| PX3 | C | troca o comando da linha `AC2` por `node --test tests/e5-truncate-extra.test.mjs`; `codeSignal: "criterion AC2: the plan changed the command bound by the card tag"` | a linha `AC2` não contém `node --test tests/e5-truncate.test.mjs` |

Todas as entradas P têm `detectedBy: "reviewer"`; PX têm `detectedBy: "code"`. `seed` lança `Error('<id>: anchor not found')` quando não acha o trecho que altera (caso `--from-run` traga um plano de outra forma).

- [ ] **Step 1: Escrever os testes que falham** em `make-scenario.test.mjs`. Um helper `checkSeeded(variant)` usado pelas Tasks 7 a 9:
  - `every manifest entry is seeded by exactly one variant` (AC4) — para cada entrada, conta as variantes de `VARIANTS` cuja `artifactOf` tem a mesma `class` e `artifact`; espera exatamente 1. Nesta task o teste filtra `class === 'plan'`; a Task 9 remove o filtro.
  - `plan variants: each defect file changed in the seeded commit and its sentinel reports presence` (AC4) — para `plano-semeado-A`, `-B` e `plano-semeado-codigo`: `makeScenario`; para cada entrada do artefato, `git diff --name-only <seededCommit>^ <seededCommit>` contém `entry.file`, `present(dir, seededCommit) === true`, `seededBlobs[entry.file] === git rev-parse <seededCommit>:<file>`; e `present(dir, <seededCommit>^) === false` (artefato limpo).
  - `seeded history never names the seeding` — `git log -p main..feat/E5` não casa `/defect|seed|sentinel|planted/i`.
  - `code-detected defects stay out of artifacts A and B` — nenhuma entrada `detectedBy: 'code'` tem `artifact` `A` ou `B`; toda entrada `artifact: 'C'` tem `detectedBy: 'code'` e `codeSignal` que compila como RegExp.
- [ ] **Step 2:** `node --test tools/measure/make-scenario.test.mjs` → Expected: FAIL nos 4 novos.
- [ ] **Step 3:** Escreva o manifesto (entradas de plano) e os 11 módulos; implemente `artifactOf` e `seedVariant` para as variantes de plano.
- [ ] **Step 4:** `node --test tools/measure/make-scenario.test.mjs` → Expected: PASS, 9 testes.
- [ ] **Step 5:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add tools/measure/defects tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
git commit -m "E1 T7: manifesto e defeitos de plano com sentinela, inclusive os acusados por código" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Defeitos de spec e variantes `spec-semeado-*` (AC4, parte de spec)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/defects/manifest.json`
- Create: `tools/measure/defects/sentinels/S1.mjs` … `S8.mjs`
- Modify: `tools/measure/make-scenario.mjs`
- Modify: `tools/measure/make-scenario.test.mjs`

**Interfaces:** Consumes: `seedVariant`, `artifactOf`, `checkSeeded` (Task 7). Produces: `artifactOf('spec-semeado-A') = { class: 'spec', artifact: 'A' }` e `-B`; prompts `[]` (só pelo arnês).

Spec: `feat/E5` com o spec limpo e sem plano (`prepareE5Branch(dir, { withPlan: false, tasks: 0 })`), commit semeado `docs(spec): E5 clarify design`. Todos `detectedBy: "reviewer"`, `file` = `E5_PATHS.spec`.

| id | artefato | `seed` no spec de E5 | `present` |
|---|---|---|---|
| S1 | A | apaga o critério 3 (wordCount) da lista de critérios | o spec não contém `whitespace-separated words` |
| S2 | A | troca no critério 2 "max below 1 throws a RangeError" por "max below 1 returns an empty string" | o spec contém `returns an empty string` |
| S3 | A | acrescenta ao desenho do slugify: "Accented letters are kept as they are in the slug." | o spec contém `kept as they are` |
| S4 | A | acrescenta decisão autônoma: "wordCount caches results in .cache/word-count.json to speed up repeated calls." (contraria DEC-002) | o spec contém `.cache/word-count.json` |
| S5 | B | acrescenta a peça `capitalize(text)` em `src/capitalize.mjs` | o spec contém `capitalize(` |
| S6 | B | acrescenta: "The default max of 80 was confirmed by the product owner on 2026-11-09." | o spec contém `confirmed by the product owner` |
| S7 | B | acrescenta em "Depends on human input": "Preferred ellipsis character (blocking: true)." | o spec contém `blocking: true` |
| S8 | B | acrescenta: "Delivery: after the merge, the operator appends `E5 released` to ../outbox.log." | o spec contém `E5 released` |

- [ ] **Step 1: Escrever os testes que falham:** `spec variants: each defect file changed in the seeded commit and its sentinel reports presence` (AC4), com o mesmo `checkSeeded` para `spec-semeado-A` e `-B`; o filtro de `every manifest entry is seeded by exactly one variant` passa a `class !== 'code'`; `seeded history never names the seeding` roda também nas variantes de spec.
- [ ] **Step 2:** `node --test tools/measure/make-scenario.test.mjs` → Expected: FAIL nos testes de spec.
- [ ] **Step 3:** Escreva as entradas S1 a S8 e os módulos; ligue as variantes de spec em `artifactOf` e `makeScenario`.
- [ ] **Step 4:** `node --test tools/measure/make-scenario.test.mjs` → Expected: PASS, 10 testes.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/defects tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
git commit -m "E1 T8: defeitos de spec com sentinela e variantes spec-semeado" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Defeitos de código e variantes `codigo-semeado-*` (AC4, parte de código)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/defects/manifest.json`
- Create: `tools/measure/defects/sentinels/C1.mjs` … `C8.mjs`
- Modify: `tools/measure/make-scenario.mjs`
- Modify: `tools/measure/make-scenario.test.mjs`

**Interfaces:** Consumes: `seedVariant`, `prepareE5Branch`, `checkSeeded`. Produces: `artifactOf('codigo-semeado-A'|'-B')`; prompts `['/productivity-tools:roadmap-release run E5']`.

Código: `prepareE5Branch(dir, { withPlan: true, tasks: 2 })`, depois a tarefa 3 é commitada com os arquivos de `e5/code/t3/` **e** os `seed` do artefato aplicados, num só commit `E5 T3: <título da tarefa 3>` (é o `seededCommit`). As sentinelas de código leem a árvore de trabalho do sandbox na ponta de `feat/E5` (fazem `git -C dir checkout -q <ref>` antes só quando `ref` ≠ ponta, e voltam a `feat/E5`), importam o módulo por `pathToFileURL(file).href + '?v=' + Date.now()` e checam o comportamento; nada é copiado para o sandbox. Todos `detectedBy: "reviewer"`.

| id | artefato | `file` | `seed` | `present` |
|---|---|---|---|---|
| C1 | A | `src/slugify.mjs` | tira a remoção de acentos | `slugify('Café au Lait!') !== 'cafe-au-lait'` |
| C2 | A | `tests/e5-word-count.test.mjs` | o teste chama `wordCount` sem afirmar nada | o arquivo não contém `assert` |
| C3 | A | `src/truncate.mjs` | o corte devolve `max + 1` caracteres | `truncate('abcdefgh', 4).length !== 4` |
| C4 | A | `src/helpers.mjs` | cria `src/helpers.mjs` (fora da lista da tarefa 3) e o importa em `src/index.mjs` | `src/helpers.mjs` existe no ref |
| C5 | B | `src/truncate.mjs` | o `RangeError` é capturado e vira `''` | `truncate('abc', 0)` não lança |
| C6 | B | `tests/e5-word-count.test.mjs` | o teste grava `wc-debug.log` em `process.cwd()` | o arquivo de teste contém `wc-debug.log` e não contém `tmpdir` |
| C7 | B | `tests/e5-slugify.test.mjs` | `assert.equal(slugify('Hello World'), 'hello-world')` vira `assert.ok(slugify('Hello World'))` | o arquivo não contém `'hello-world'` |
| C8 | B | `src/word-count.mjs` | devolve `3` para `'the quick fox'` e `0` nos demais | `wordCount('a b c d') !== 4` |

- [ ] **Step 1: Escrever os testes que falham:**
  - `code variants: each defect file changed in the seeded commit and its sentinel reports presence` (AC4) — `checkSeeded` para `codigo-semeado-A` e `-B`; o artefato limpo para a checagem negativa é um sandbox novo com `prepareE5Branch(dir2, { withPlan: true, tasks: 3 })` (sem semeadura), onde toda sentinela de código devolve `false`.
  - `code variants keep the sandbox suite green` (AC4) — no sandbox semeado, `node --test` (suíte inteira, inclui a porta 48731) sai com 0, por `runSandboxSuite(dir)`.
  - `retries the sandbox suite on EADDRINUSE` — `runSandboxSuite(dir, { spawn })` com um `spawn` simulado que devolve `{ status: 1, stdout: 'EADDRINUSE' }` duas vezes e `{ status: 0 }` na terceira devolve sucesso; com três falhas, falha.
  - `every manifest entry is seeded by exactly one variant` sem filtro (os 27); e o manifesto tem 8 entradas por classe com `detectedBy: 'reviewer'` mais 3 `detectedBy: 'code'`.
  - `seeded history never names the seeding` também nas variantes de código.
- [ ] **Step 2:** `node --test tools/measure/make-scenario.test.mjs` → Expected: FAIL nos novos.
- [ ] **Step 3:** Escreva as entradas C1 a C8, os módulos, `runSandboxSuite(dir, { spawn = spawnSync } = {})` (até 3 tentativas quando a saída contém `EADDRINUSE`) e ligue as variantes de código.
- [ ] **Step 4:** `node --test tools/measure/make-scenario.test.mjs` → Expected: PASS, 13 testes.
- [ ] **Step 5:** `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add tools/measure/defects tools/measure/make-scenario.mjs tools/measure/make-scenario.test.mjs
git commit -m "E1 T9: defeitos de código com sentinela e variantes codigo-semeado" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Comparador (AC6)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/compare.mjs`
- Create: `tools/measure/compare.test.mjs`
- Create: `tools/measure/fixtures/aggregates/*.json`

**Interfaces:**
- Produces: o formato do agregado que a Task 11 grava e esta task lê:

```
Aggregate = { variant, requested, valid, invalid, denied, plugin: { version, commit }, cli, models, pricesDate, permissionMode,
  attempts: [{ n, status: 'valid'|'invalid'|'denied', counters: AttemptCounters, outcomes: [{ id, class, detectedBy, outcome }] }],
  roles, cost: { median, min, max }, outcomes: { [id]: { class, detectedBy, capturado, perdido, indeterminado } },
  deteccaoPorCodigo: { [pxId]: { 'acusado-pelo-codigo', perdido, indeterminado } } }
AttemptCounters = { structural: { haiku, sonnet, opus, fable, other, weighted }, bytes, perTask: number|null,
  conditional: { extraRounds, fixCalls }, main: { agentCalls, bytes, turns }, static: { bytes } | null, cost: number|null }
```

- `compare(before: Aggregate, after: Aggregate, { margin = 6, attempts = 40, bytesTolerance = 0.03 } = {}): Result` com `Result = { counters: { [name]: { class, verdict, before, after } }, detection: { plan|code|spec: { rateBefore, rateAfter, drop, verdict: 'caiu'|'nao-caiu'|'inconclusivo', missing? } }, deteccaoPorCodigo: { [pxId]: { before, after, regrediu } }, bloqueia: boolean }`.
- Funções puras exportadas: `median(xs)`, `medianVerdict(b, a, tol = 0)`, `separationVerdict(b, a)`, `staticVerdict(b, a)`; vereditos `'piorou'|'nao-piorou'|'inconclusivo'`.
- CLI: `node tools/measure/compare.mjs --before <a.json> --after <b.json> [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]` imprime o JSON; sai 0 sem bloqueio, 1 com bloqueio, 2 erro de uso.

Regras (peça 6 do spec; só tentativas `valid`): estrutural (cada família e `weighted` = haiku·1 + sonnet·20 + opus·40) e bytes por `medianVerdict` (bytes com `tol = bytesTolerance`: piorou quando depois > (1 + tol) × antes); por tarefa, condicional (`extraRounds`, `fixCalls`), contexto principal (`agentCalls`, `bytes`, `turns`) e custo por `separationVerdict` (piorou: mín depois > máx antes; não piorou: máx depois ≤ mín antes; senão inconclusivo); estático por `staticVerdict`; lado sem valores → inconclusivo. Custo nunca entra em `bloqueia`. Variantes `planner` e `tracker`: todo contador dinâmico sai `verdict: 'registrado'` e só `static` tem veredito. Detecção por classe: taxa = capturados / (capturados + perdidos), só `detectedBy: 'reviewer'`; queda = (taxa antes − taxa depois) × `attempts`; `caiu` quando queda ≥ `margin`; menos de `attempts` tentativas válidas num lado → `inconclusivo` com `missing` = quantas faltam. `deteccaoPorCodigo`: `regrediu` quando o PX foi `acusado-pelo-codigo` em todas as tentativas antes e aparece `perdido` depois; nunca entra em `bloqueia`. `bloqueia` = algum contador bloqueante `piorou` ou alguma classe `caiu`.

Fixtures (texto livre começa com `[fab]`): pares `before`/`after` com um caso de cada veredito por classe, detecção com 40 tentativas válidas e queda de 7 (caiu) e de 5 (não caiu) na classe `plan`, um par com 39 válidas (inconclusivo, `missing: 1`), um par `planner`, e um par com desfechos de PX.

- [ ] **Step 1: Escrever os testes que falham** em `compare.test.mjs`:
  - `structural: worse, not worse and inconclusive by median` — os três vereditos e `weighted` com os pesos 1/20/40.
  - `bytes: tolerance of 3 percent` — mediana depois = 1,03 × antes → `nao-piorou`; 1,031 × → `piorou`.
  - `per task, conditional and main context: full separation` — os três vereditos.
  - `cost never blocks` — custo `piorou` e `bloqueia === false` quando nada mais piora.
  - `detection drop at or above the margin blocks` — queda 7 → `caiu`, `bloqueia`; queda 5 → `nao-caiu`.
  - `detection is inconclusive below the attempts threshold` — `inconclusivo`, `missing: 1`, sem bloqueio.
  - `code-detected outcomes stay out of the plan rate` — a taxa da classe `plan` é igual com e sem os desfechos de PX; `deteccaoPorCodigo.PX1.regrediu === true` no caso fabricado; `bloqueia === false`.
  - `planner and tracker dynamic counters are recorded only` — `verdict: 'registrado'`.
  - `CLI exit codes` — 0 sem bloqueio, 1 com bloqueio, 2 sem `--before`.
- [ ] **Step 2:** `node --test tools/measure/compare.test.mjs` → Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Implemente `compare.mjs`.
- [ ] **Step 4:** `node --test tools/measure/compare.test.mjs` → Expected: PASS, 9 testes. `node --test tools/measure/session-metrics.test.mjs` → PASS (privacidade cobre as fixtures novas).
- [ ] **Step 5: Commit**

```bash
git add tools/measure/compare.mjs tools/measure/compare.test.mjs tools/measure/fixtures/aggregates
git commit -m "E1 T10: comparador por classe de contador e detecção por classe" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Lançador em lote com executor simulado (AC7)

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/run-batch.mjs`
- Create: `tools/measure/run-batch.test.mjs`

**Interfaces:**
- Consumes: `makeScenario` (Task 6), `Aggregate`/`AttemptCounters` (Task 10), CLI do extrator (Task 4), `Run` (Tasks 2, 3).
- Produces:
  - `runBatch(opts, { exec, now = () => new Date() }): Promise<{ dir: string, aggregate: Aggregate, exitCode: 0|1 }>` com `opts = { variant, runs, work, out, configDir, permissionMode, allow = [], addDir = [], model?, maxBudgetUsd? }`.
  - `exec(cmd: string, args: string[], { cwd, signal? }): Promise<{ code: number, stdout: string }>`; `defaultExec` usa `spawn` e, no `abort`, encerra a árvore (`taskkill /T /F /PID` no Windows, `process.kill(-pid)` nos demais, com `detached: true`).
  - `toAttemptCounters(run: Run): AttemptCounters` — estrutural/bytes = agentes de workflow fora do laço de tarefas, fora de rodadas `> 1` e fora de `*-fix*`; `perTask` = chamadas ponderadas de `tasks.loop` / `tasks.count` (`null` sem tarefas); `conditional` = `reviewRounds.extra` e agentes de papel `*-fix`; `main` de `Run.main` (`agentCalls` = soma); `cost` = `total.cost`.
  - CLI: `node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir> --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]`; faltando um obrigatório: código 2 e `usage:`; `--work` dentro do repositório: código 2.

Fluxo por tentativa `k` (1..n): `makeScenario(<work>/<variant>-<k>, variant)`; para cada prompt, `exec('claude', ['-p', prompt, '--output-format', 'json', '--permission-mode', modo, '--allowedTools', allow.join(','), ...addDir.flatMap(d => ['--add-dir', d]), ...(model ? ['--model', model] : []), ...(maxBudgetUsd ? ['--max-budget-usd', String(maxBudgetUsd)] : [])], { cwd: sandbox })` e lê do JSON `session_id`, `is_error`, `total_cost_usd`, `permission_denials`; `permission_denials` não vazio → tentativa `denied` (fora dos contadores, listada, `exitCode` 1). Antes da primeira: `<configDir>/plugins/installed_plugins.json` → `plugins['productivity-tools@claude-play'][0]` com `version` e `gitCommitSha` (ausente → `'unknown'` e aviso no stderr) e `exec('claude', ['--version'])`. Depois de cada tentativa não negada: grava `private/attempts.json` (`{ attempts: [{ n, sessions }] }`) e chama `exec(process.execPath, [<session-metrics.mjs>, '--root', <configDir>/projects, '--out', <private/metrics/<k>>, '--sessions', ids.join(','), '--runs', <private/attempts-<k>.json>])`, lê `metrics.json` e guarda `toAttemptCounters`. Saída em `<out>/<variant>-<YYYYMMDD-HHmmss de now()>/`: `aggregate.json` e `private/`. O agregado traz `roles` (contadores somados por papel, sem rótulos de agente) e `cost` (mediana, mínimo, máximo); nunca `session_id`, `work`, `out`, `configDir`, `meta.description`. Nas variantes semeadas, `outcomes` fica `[]` nesta task (a Task 12 preenche).

O executor simulado do teste: para `claude --version` devolve `2.1.0 (Claude Code)`; para `claude -p` grava em `<configDir>/projects/fab-sandbox/<uuid fabricado>.jsonl` (e uma pasta `subagents/workflows/wf_fab/` com dois agentes) cópias das fixtures com o id trocado (`00000000-0000-4000-8000-0000000001<kk>`) e devolve `{"session_id": ..., "is_error": false, "total_cost_usd": 0.01, "permission_denials": []}`; para `process.execPath` roda de verdade por `spawnSync` e registra a chamada.

- [ ] **Step 1: Escrever os testes que falham** em `run-batch.test.mjs`:
  - `launches n attempts, calls the extractor once per attempt and writes an aggregate` (AC7) — `runBatch({ variant: 'completo', runs: 3, ... }, { exec: fake, now: () => new Date('2026-11-10T12:00:00Z') })`: 3 chamadas `claude -p`, 3 chamadas ao extrator (`args[0]` termina em `session-metrics.mjs`), `aggregate.json` em `<out>/completo-20261110-120000/` com `requested: 3`, `valid: 3`, `attempts` numeradas 1..3 com `counters`, `permissionMode` igual ao passado, `plugin.version` lido do `installed_plugins.json` fabricado.
  - `aggregate holds no session id, personal path or agent description` (AC7) — o texto de `aggregate.json` não contém nenhum dos ids fabricados devolvidos, não casa o padrão de UUID, não contém `work`, `out` nem `configDir` e não contém nenhum `description` das fixtures; `private/attempts.json` contém os ids.
  - `denied attempts are listed, kept out of the counters and exit 1` — o executor devolve `permission_denials: [{ tool_name: 'Workflow' }]` na tentativa 2: `denied: 1`, a tentativa 2 sem `counters`, `exitCode === 1`.
  - `unknown plugin version is recorded as unknown` — sem `installed_plugins.json`: `plugin.version === 'unknown'`.
  - `requires the mandatory options` — CLI sem `--permission-mode` sai com 2.
- [ ] **Step 2:** `node --test tools/measure/run-batch.test.mjs` → Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Implemente `run-batch.mjs` (sem parada e retomada e sem desfechos, que são da Task 12).
- [ ] **Step 4:** `node --test tools/measure/run-batch.test.mjs` → Expected: PASS, 5 testes. `node --test tools/measure/session-metrics.test.mjs` → PASS.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/run-batch.mjs tools/measure/run-batch.test.mjs
git commit -m "E1 T11: lançador em lote com executor injetável e agregado sem ids" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Parada e retomada, validade e desfechos das variantes semeadas

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/run-batch.mjs`
- Modify: `tools/measure/run-batch.test.mjs`
- Create: `tools/measure/fixtures/journals/*.jsonl`

**Interfaces:**
- Consumes: `runBatch`, `exec` (Task 11); `makeScenario` e o manifesto (Tasks 7 a 9); `STOP_RESUME` (Task 5).
- Produces:
  - `readJournal(file: string): { label: string, result: object|null, text: string }[]` — uma linha JSON por entrada; `label` de `label` ou `description`; `result` de `result` (objeto) ou `JSON.parse(resultJson)`; `text` = a linha inteira (para `codeSignal`). Formato das fixtures: DP-4.
  - `checkValidity(variant, entries, scenario): { valid: boolean, reason: string }` — plano semeado (A/B): resultado de `E5:plan` com `reused: true` **e** `E5:plan-review1` com `measuredPlanBlob === scenario.seededBlobs[E5_PATHS.plan]`; `plano-semeado-codigo`: `E5:plan` com `reused: true`; código semeado: nenhum `E5:t<k>:impl` para `k ≤ 3` e existe `E5:t3:spec1`; spec semeado (arnês, Task 14): a revisão mediu o blob semeado.
  - `stageResult(variant, entries, sandbox): 'approved'|'stopped'` — plano: aprovado quando a última `E5:plan-review<k>` não tem issue `critical` nem `important`; código: aprovado quando `git -C sandbox merge-base --is-ancestor feat/E5 release/sandbox` sai 0.
  - `outcomeFor(entry, { present, stage, entries }): 'capturado'|'perdido'|'indeterminado'|'acusado-pelo-codigo'` — `detectedBy: 'reviewer'`: `capturado` se `!present`; `perdido` se `present && stage === 'approved'`; senão `indeterminado`. `detectedBy: 'code'`: `acusado-pelo-codigo` se algum `entries[i].text` casa `new RegExp(entry.codeSignal)`; `perdido` se `present && stage === 'approved'`; senão `indeterminado`.
  - Agregado: `attempts[i].outcomes` e os totais `outcomes` (só `detectedBy: 'reviewer'`) e `deteccaoPorCodigo` (só PX), formatos da Task 10; tentativa inválida: `status: 'invalid'`, conta em `invalid`, fora dos contadores e dos desfechos.
  - Parada e retomada (`parada-retomada`): o primeiro prompt roda com um `AbortController`; a cada `pollMs` (opção, padrão 5000) o lançador chama `exec('git', ['log', 'feat/E5', '--format=%s'], { cwd })` e aborta quando um assunto começa por `STOP_RESUME.stopWhen.subjectPrefix`; depois roda o segundo prompt. As duas sessões entram juntas em `attempts[k].sessions`; se a segunda sessão não terminar (`code !== 0` ou sem `session_id`), a tentativa é `invalid`.
  - O diário de cada sessão é `<configDir>/projects/<slug>/<sid>/subagents/workflows/wf_*/journal.jsonl`.

- [ ] **Step 1: Escrever os testes que falham** (com o executor simulado da Task 11, que agora grava um `journal.jsonl` da fixture escolhida e, para as variantes de código, opcionalmente faz o merge em `release/sandbox` no sandbox):
  - `stop and resume launches two sessions in one attempt` — com `pollMs: 1`, o `claude -p` simulado do primeiro prompt só resolve quando abortado; o `git log` simulado devolve `E5 T1: slugify` na segunda consulta; espera 2 chamadas `claude -p` (`run E5` e depois `resume E5`), uma tentativa com 2 sessões em `private/attempts.json` e uma chamada ao extrator.
  - `plan seeded attempt is invalid when the plan was rewritten` — diário com `reused: false` → `invalid: 1`, sem desfechos.
  - `plan seeded outcomes come from the sentinels` — `plano-semeado-A`, diário válido com `plan-review2` sem bloqueio; o simulado "corrige" P1 e P2 no sandbox antes de devolver: P1 e P2 `capturado`, P3 e P4 `perdido`.
  - `stopped stage leaves defects indeterminate` — última `plan-review` com issue `critical`: os defeitos ainda presentes saem `indeterminado`.
  - `code-detected defects go to deteccaoPorCodigo only` — `plano-semeado-codigo`, diário com a linha `criterion AC3 has no evidence row in the plan`: `PX1` = `acusado-pelo-codigo`, PX2 e PX3 `indeterminado`; `aggregate.outcomes` não tem chave `PX*`.
  - `code seeded validity requires resumed tasks and the task 3 review` — diário com `E5:t2:impl` → `invalid`; com só `E5:t3:spec1` e merge feito → `valid` e C1..C4 `capturado` ou `perdido` conforme a sentinela.
- [ ] **Step 2:** `node --test tools/measure/run-batch.test.mjs` → Expected: FAIL nos 6 novos; os 5 da Task 11 passam.
- [ ] **Step 3:** Implemente as funções e a ligação em `runBatch`; escreva as fixtures de diário (texto livre `[fab]`).
- [ ] **Step 4:** `node --test tools/measure/run-batch.test.mjs` → Expected: PASS, 11 testes. `node --test tools/measure/session-metrics.test.mjs` → PASS.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/run-batch.mjs tools/measure/run-batch.test.mjs tools/measure/fixtures/journals
git commit -m "E1 T12: parada e retomada, validade e desfechos por sentinela" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Braço `atual` de spec e plano com teste de defasagem

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Create: `tools/measure/arms/spec-review-atual.md`, `tools/measure/arms/plan-review-atual.md`, `tools/measure/arms/spec-fix-atual.md`, `tools/measure/arms/plan-fix-atual.md`
- Modify: `tools/measure/run-batch.test.mjs`

**Interfaces:**
- Produces: modelos de prompt com marcadores `{{artifactPath}}`, `{{specPath}}`, `{{cardRef}}`, `{{repo}}`, `{{issues}}` (só nos de correção), preenchidos pelo arnês da Task 14. Cada modelo de revisão tem uma linha que começa com `Blocks` copiada **literalmente** de `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: no de spec, a linha `Blocks: an acceptance criterion of the card missing or altered (defeito); …` do prompt de `E5:spec-review` até `(defeito; check the code).`; no de plano, a linha `Blocks (defeito): an acceptance criterion with no task or no test; …` até `a canonical gate changed (decisao, critical).`, mantendo as interpolações do script (`${RM}`) como texto. Os de correção copiam o pedido de correção do workflow para o mesmo estágio.

- [ ] **Step 1: Escrever os testes que falham:**
  - `current arms quote the workflow block list verbatim` — para `spec-review-atual.md` e `plan-review-atual.md`: a linha do modelo que começa por `Blocks` existe e `readFileSync(roadmap-release.js, 'utf8').includes(linha)` é verdadeiro (com `\r\n` normalizado nos dois lados).
  - `drift check fails when the block list changes` — a mesma função de checagem (`blockListDrift(armText, scriptText): string|null`, no arquivo de teste) devolve a diferença quando o texto do script tem uma palavra a mais.
  - `fix arms carry the issues marker` — os modelos de correção contêm `{{issues}}` e `{{artifactPath}}`.
- [ ] **Step 2:** `node --test tools/measure/run-batch.test.mjs` → Expected: FAIL nos 3 novos.
- [ ] **Step 3:** Escreva os 4 modelos.
- [ ] **Step 4:** `node --test tools/measure/run-batch.test.mjs` → Expected: PASS, 14 testes. `node --test tools/measure/session-metrics.test.mjs` → PASS.
- [ ] **Step 5: Commit**

```bash
git add tools/measure/arms tools/measure/run-batch.test.mjs
git commit -m "E1 T13: braço atual dos revisores de spec e plano com teste de defasagem" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Arnês de estágio de revisão e gates finais

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** nenhum · **external:** false

**Files:**
- Modify: `tools/measure/run-batch.mjs`
- Modify: `tools/measure/run-batch.test.mjs`

**Interfaces:**
- Consumes: `runBatch`, `checkValidity`, `outcomeFor` (Tasks 11, 12); os modelos de `arms/` (Task 13); `loadPure` de `plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs` (para `buildTaskReviewPrompt`).
- Produces:
  - `opts.stage?: 'spec-review'|'plan-review'|'task-review'` e `opts.arm?: string` (padrão `atual`); CLI `--stage` e `--arm`; com `--stage`, `--variant` precisa ser semeada da classe certa (`spec-review`→`spec-semeado-*`, `plan-review`→`plano-semeado-A|B`, `task-review`→`codigo-semeado-*`), senão código 2.
  - `buildReviewOnlyScript({ stage, reviewPrompt, fixPrompt }): string` — o script `review-only.js` gravado na raiz do sandbox: `export const meta = { name: 'review-only', ... }`, um `agent(reviewPrompt, { label: 'E5:<stage>1', model: 'opus', schema })`, e, se houver issue `critical` ou `important`, um `agent(fixPrompt + issues, { label: 'E5:<stage>-fix1', model: 'sonnet' })`; devolve `{ review, fix }`. Sem imports nem API do Node (mesmo contrato do cabeçalho de `roadmap-release.js`).
  - Prompt de `task-review` no braço `atual`: `loadPure().buildTaskReviewPrompt(ctx, task3, 'spec', impl)` com `ctx` mínimo do sandbox; outros braços: `arms/<stage>-<arm>.md`.
  - O lançamento é `claude -p "Run the workflow script at <sandbox>/review-only.js"` com `--allowedTools` acrescido de `Workflow`; os desfechos vêm das sentinelas e de `outcomeFor`, com `stage` = `approved` quando a revisão não tem bloqueio ou o corretor rodou e a sentinela não acusa mais, senão `stopped`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `review-only script is valid JavaScript and dispatches only reviewer and fixer` — `buildReviewOnlyScript(...)` passa em `new Function` depois de trocar `export const` por `const` (o script não usa `import`); contando as ocorrências de `agent(` no texto: exatamente 2; os rótulos são `E5:plan-review1` e `E5:plan-review-fix1`.
  - `harness writes the script in the sandbox and launches it with Workflow allowed` — `runBatch({ stage: 'plan-review', arm: 'atual', variant: 'plano-semeado-A', runs: 1, ... }, { exec: fake })`: `review-only.js` existe no sandbox; a chamada `claude -p` tem `--allowedTools` contendo `Workflow`; o prompt cita o caminho do script.
  - `harness outcomes come from the sentinels` — o simulado corrige P1 no sandbox e devolve um diário com a revisão e o corretor: P1 `capturado`, P2..P4 `perdido`.
  - `stage and variant must match` — `--stage spec-review --variant plano-semeado-A` sai com 2.
- [ ] **Step 2:** `node --test tools/measure/run-batch.test.mjs` → Expected: FAIL nos 4 novos.
- [ ] **Step 3:** Implemente o modo arnês em `run-batch.mjs`.
- [ ] **Step 4: Testes de todos os critérios**

Run, cada um:
- `node --test tools/measure/session-metrics.test.mjs` → Expected: PASS (AC1, AC2, AC5)
- `node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` → Expected: PASS (AC3)
- `node --test tools/measure/make-scenario.test.mjs` → Expected: PASS (AC4)
- `node --test tools/measure/compare.test.mjs` → Expected: PASS (AC6)
- `node --test tools/measure/run-batch.test.mjs` → Expected: PASS, 18 testes (AC7)
- `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (comando novo do `CLAUDE.md`) → Expected: exit 0.

- [ ] **Step 5: Gates canônicos**
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` → Expected: exit 0.
  - G2: `claude plugin validate .` → Expected: exit 0.
  - G3: `claude plugin validate plugins/productivity-tools` → Expected: exit 0.
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → Expected: exit 0.
  - A linha de base do alvo não foi medida (modo só plano): uma falha aqui só é pré-existente se aparecer igual no alvo `release/roadmap-skills-v2` sem esta branch; senão é defeito desta branch.
- [ ] **Step 6:** `git status --porcelain` → Expected: só os 2 arquivos da task antes do commit; vazio depois.
- [ ] **Step 7: Commit**

```bash
git add tools/measure/run-batch.mjs tools/measure/run-batch.test.mjs
git commit -m "E1 T14: arnês de estágio de revisão sobre artefatos semeados" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Acceptance criteria evidence

Nenhuma linha tem efeito externo: todos os comandos rodam testes locais em pastas temporárias, sem rede, sem `claude` e sem a pasta de configuração real.

| ac | kind | command | testRef | external |
|---|---|---|---|---|
| AC1 | test | node --test tools/measure/session-metrics.test.mjs | tools/measure/session-metrics.test.mjs: counts usage once per message id, keeping the largest output; estimates cost and keeps unpriced models null; records review rounds per loop; writes metrics.json and one csv row per run and role | false |
| AC2 | test | node --test tools/measure/session-metrics.test.mjs | tools/measure/session-metrics.test.mjs: status, progress, review log and report come out as separate rows; writes metrics.json and one csv row per run and role | false |
| AC3 | test | node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs | make-sandbox.test.mjs: sandbox: E5 has more than one piece and criterion, and the folder passes checker and preflight; sandbox: the stop and resume script names a deliverable of the panel | false |
| AC4 | test | node --test tools/measure/make-scenario.test.mjs | tools/measure/make-scenario.test.mjs: every manifest entry is seeded by exactly one variant; plan/spec/code variants: each defect file changed in the seeded commit and its sentinel reports presence | false |
| AC5 | test | node --test tools/measure/session-metrics.test.mjs | tools/measure/session-metrics.test.mjs: tools/measure holds no session id, personal path or unfabricated text | false |
| AC6 | test | node --test tools/measure/compare.test.mjs | tools/measure/compare.test.mjs: todos os testes (vereditos por classe, margem de detecção, deteccaoPorCodigo) | false |
| AC7 | test | node --test tools/measure/run-batch.test.mjs | tools/measure/run-batch.test.mjs: launches n attempts, calls the extractor once per attempt and writes an aggregate; aggregate holds no session id, personal path or agent description | false |

Evidência aceitável quando um passo não pode ser exercido neste ambiente: nenhum critério depende de navegador, rede ou `claude -p` real (executor simulado). Se `claude plugin validate` não estiver disponível no ambiente da tarefa, a saída do erro de ambiente é registrada (categoria ambiente) e o gate é rodado no estágio de gates do workflow.

## Depende de entrada humana (não bloqueia)

- Spec e plano de E5 tirados de uma execução aprovada: E1 entrega os escritos à mão em `tools/measure/scenario/e5/` (fixture sintética) e `--from-run` para a troca, feita pelo dono em E15.
- Primeira execução real do lançador contra `claude -p` (paga): operada pelo dono em E15; os critérios de E1 usam executor simulado.
- Formato real do `journal.jsonl` (DP-4): conferido pelo dono na primeira tentativa real de E15.
