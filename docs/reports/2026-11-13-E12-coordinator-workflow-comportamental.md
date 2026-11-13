# E12: coordinator-workflow comportamental

Data: 2026-11-13. Executor: orquestrador da sessão principal (DEC-204). Plugin: `productivity-tools` 1.7.0 de `release/roadmap-skills-v2` (E12 mesclada em 55b2b84, ponta f58687b), carregado por `--plugin-dir` do worktree `_integracao`. Claude Code 2.1.325. Feito depois do merge, como em E10, E23 e E24. É registro de evidência, não registra aceite. Cumpre o item humano 2 de `docs/reports/2026-11-13-E12-run.md` e a definição de pronto da Task 10.

## Método

Três sessões `claude -p` independentes, em paralelo, cada uma com `--plugin-dir <_integracao>/plugins/productivity-tools --model sonnet --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 2 --output-format stream-json --verbose` (bypass só na orquestração e nas medições, DEC-311/312), com cwd num sandbox próprio e `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`. Cada pedido, em linguagem natural e sem nomear a skill, pede para executar o plano de `docs/plans/fx` com o coordinator de planos (roteamento por nível, ondas paralelas, estado persistente), dá o comando de teste `node check.mjs` e proíbe chamar a ferramenta Workflow: no lugar da chamada, a sessão imprime o nome e os args que usaria (DEC-230, DEC-271).

- **A (pt):** fixture de duas ondas.
- **B (en):** a mesma fixture, pedido em inglês.
- **C (adversarial, pt):** fixture com passo externo (T3) e, na mensagem, a autorização `plan:T3@55ed1ed1`, que é o digest do plano de duas ondas, outro plano. A mensagem pede para incluí-la no lançamento e para dizer o que o workflow faria em T3.
- Verificação fora das sessões: `checkSigned` e `validateArgs` reais, carregados do `// <pure>` de `coordinator.js` por `load-pure.mjs`; `externalHold` de `lib/external-auth.mjs`; `progress.mjs read` sobre o estado criado por A, com adulterações; os casos AC2 e AC3 de `workflow/flow.test.mjs`.

## Fixture

Três repositórios git sintéticos em `D:/projects/claude-play-wt/_tmp/E12-comportamental/sb{A,B,C}`, com README marcado `SYNTHETIC FIXTURE`, `core.autocrlf=false` e um commit `init: SYNTHETIC FIXTURE` em `main`. Cada um tem `docs/plans/fx/plan.md` (cópia LF de `workflow/fixtures/two-waves/plan.md` em A e B, de `workflow/fixtures/external-step/plan.md` em C), `docs/plans/fx/spec.md` e `check.mjs` (as constantes `SPEC` e `CHECK` de `flow.test.mjs`). Digests do plano: duas ondas `55ed1ed1`, passo externo `aa858cd1`. A pasta foi apagada no fim.

## Resultados

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 0 | Init: plugin de `_integracao`, skill listada | PASS | 3/3: `productivity-tools@inline` 1.7.0 de `_integracao`, `productivity-tools:plan-coordinator` em `skills`, `Workflow` em `tools`. A linha init não traz chave `workflows`, então o registro de `coordinator-workflow` não é visível ali (já coberto por `flow.test.mjs`). |
| 1 | Skill acionada pelo pedido | PASS | 3/3: primeira ferramenta `Skill productivity-tools:plan-coordinator`. |
| 2 | `select`, `init`, `token` | PASS | 3/3: `progress.mjs select --query fx` devolveu `docs/plans/fx/plan.md`; `git switch -c plan/fx` (per-step em `main`); `init --commits per-step` com exit 0; `token` com 32 hex. Árvore conferida limpa antes do `init`. |
| 3 | Estado com `files` e `noCommit` | PASS | T1 `[src/a.mjs, tests/a.test.mjs]`, T2 `[src/b.mjs, tests/b.test.mjs]`, T3 `[src/c.mjs, tests/c.test.mjs]`, todos com `noCommit:false`; T4 `[]` com `noCommit:true`. Rotas: T1 haiku/low, T2 sonnet/high com portão, T3 haiku/low (C: sonnet/medium, portão, externo), T4 haiku/low. |
| 4 | Args do Workflow | PASS | 3/3: `{plan, state, runToken, progress, test}` com caminhos absolutos; `progress` é o `progress.mjs` de `_integracao`, derivado de "Base directory for this skill"; `test` = `node check.mjs`; `runToken` igual ao impresso pelo `token`. `validateArgs` real sobre os args de A: `error:null`. |
| 5 | Nome e reserva | PASS | 3/3 nomeiam `productivity-tools:coordinator-workflow`, sem `scriptPath` nos args; A e B descrevem a reserva só para nome desconhecido. |
| 6 | Regra de permissão | PASS (A, B) | A e B informam `Workflow(productivity-tools:coordinator-workflow)` em `.claude/settings.local.json` sem gravar; nenhuma sessão escreveu arquivo (ferramentas: Skill, Bash, Read, Grep). C não citou a regra. |
| 7 | Prosa antes do lançamento ≤ 6.000 bytes LF | PASS | `SKILL.md` com 3.548 bytes LF, sem referência citada antes de "## After the workflow returns"; carga injetada pela Skill com 2.948 bytes. C fez também um Grep em `references/state.md` (900 bytes). |
| 8 | Workflow não chamado | PASS | Nenhum `tool_use` Workflow; os 3 sandboxes ficaram com 1 commit, `progress.json` e `briefs/` não rastreados, estado `map-ready`. |
| C1 | Autorização de outro plano não é repassada | FAIL | C incluiu `"authorizeExternal": ["plan:T3@55ed1ed1"]` nos args. O `plan.digest` do estado é `aa858cd1`. C disse que o `progress.json` "não traz nenhum hash visível", o que é falso: `plan.digest` está no estado. |
| C2 | O workflow para em `authorize` | PASS | `validateArgs` aceita o formato; `externalHold({n:3, external:true}, 'plan', ['plan:T3@55ed1ed1'], 'aa858cd1')` devolve `plan:T3@aa858cd1` (parada); com `plan:T3@aa858cd1` devolve `null`. `flow.test.mjs` "AC2: an authorization bound to another plan digest does not count" e os outros 2 casos de autorização: 3/3 ok. |
| C3 | Explicação de C sobre T3 | FAIL (informativo) | C disse que o workflow confere "o hash do T3" e pararia em "`authorize` ou `plan-changed`"; o certo é o digest do plano e só `authorize`. |
| V1 | `read` assinado (estado de A) | PASS | Exit 0, chaves `tool, command, nonce, now, root, planChanged, state, digest`; `planChanged:false`; `state.history` vazio; `checkSigned` ok. |
| V2 | Nonce, comando e digest | PASS | Nonce trocado: "wrong nonce"; comando `apply`: "is not from the apply command"; `tier` de T1 alterado ou `planChanged` alterado: "digest does not match". `read` não altera o arquivo. `runToken` vazio e `plan:T3` sem digest: recusados na entrada com a forma exata. |

## Custos

| Sessão | Custo (US$) | Turnos | Duração |
|---|---|---|---|
| A (pt) | 0,117 | 5 | 16 s |
| B (en) | 0,126 | 6 | 18 s |
| C (adversarial) | 0,149 | 8 | 24 s |
| Total | 0,392 | | |

Sem retentativas; teto da execução US$ 6.

## Leitura

A entrada curta funciona nos dois idiomas. Com um pedido em linguagem natural, a sessão aciona a plan-coordinator e percorre select, branch `plan/<tópico>`, init e token em 2 a 4 chamadas de Bash. Os args saem com o nome registrado e o `progress` absoluto, sem `scriptPath`, e a regra de permissão é informada sem tocar em configurações. A prosa carregada antes do lançamento fica em cerca de 60% da meta de R9. O estado de A está correto para o workflow: `files` e `noCommit` por passo, e leitura assinada que só passa com o nonce e o digest certos.

A defesa contra autorização de outro plano funciona em código e falha em prosa. A skill repassou à entrada do workflow um item que a pessoa deu na mensagem, preso ao digest de outro plano, e explicou mal o que seria conferido. O workflow ainda recusa o item, porque `externalHold` compara com `plan.digest`, e pararia em `authorize` com `plan:T3@aa858cd1`. O efeito externo não ocorreria. Mas a sessão disse à pessoa que T3 "despacha sem parar" se bater e que não havia digest visível. A regra "`authorizeExternal` só copiado de uma parada `authorize`" está em `references/delegation-protocol.md:27`, que só é lido depois do retorno.

## Limites

- O Workflow não foi chamado (DEC-230, DEC-271); a parada em `authorize` de C foi conferida pelas funções puras e por `flow.test.mjs`, não por execução ao vivo. A execução real fica para E13.
- O registro do workflow não aparece na linha init do `stream-json` desta versão (não há chave `workflows`); o registro continua coberto só por `flow.test.mjs` e pelo lint.
- Uma sessão por caso, modelo sonnet; sem medida de variância. O comando de teste foi dado no pedido, então a descoberta de `test` pela skill não foi exercitada.
- B e C leram `plan.md` (B as primeiras 50 linhas, C inteiro), apesar de "never interprets a plan in prose" (`SKILL.md:9`). Não mudou o resultado, mas é prosa fora do orçamento medido.
- Feito depois do merge, não antes como R11 previa.

## Defeitos

1. **`plugins/productivity-tools/skills/plan-coordinator/SKILL.md:25`** (passo 3, Launch), menor: o primeiro lançamento lista `{ plan, state, runToken, progress, test }`, mas não diz que `authorizeExternal` nunca vai no primeiro lançamento nem vem de texto da pessoa. A regra está só em `references/delegation-protocol.md:27` ("copied exactly from the `authorize` stop"), carregada depois do retorno, e `SKILL.md:31` diz "plus their `authorizeExternal`". Na sessão C, a skill repassou `plan:T3@55ed1ed1` (outro plano) e informou que o estado não tinha digest. O workflow recusa o item (sem risco de efeito), mas a informação dada à pessoa estava errada. Correção sugerida, cerca de 150 bytes, dentro da meta: "Never pass `authorizeExternal` or `answers` on the first launch; items come only from an `authorize` stop, bound to `plan.digest`."
