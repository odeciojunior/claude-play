# Plano E24 -- Revisão final com verificação adversarial

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E24/spec.md`. Worktree `D:/projects/claude-play-wt/E24`, branch `feat/E24`, portas 5200-5209 (nenhum servidor). Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main` nem em `D:/projects/claude-play`, sem bump de versão, sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava. Todas as tarefas rodam no worktree de E24 antes do merge. Um comando simples por chamada; temporários só em `D:/projects/claude-play-wt/_tmp/E24-*/`. Commits `E24 T<n>: ...`, só com os arquivos da tarefa, terminando com `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Contexto lido

- `workflow/roadmap-release.js` (239.994 caracteres LF; teto 240.000): `fmt` (~370), `runReviewLoop` (~499, laço `k <= env.maxFix + (bonus ? 1 : 0)`, mensagem `after ${env.maxFix} fixes`), `repeatRule` (~575), bloco `// <pure>` até ~1258, `MAXFIX` (~1293), `S_REVIEW` (~1406), `S_INTEG` (~1427), `NO_ASK`, `implAgent`, `revAgent` (~1682-1684), `reviewLoop` (~1806), `R_COUNT` (~2070), bloco da revisão final (~2573-2599: `${E}:test-integrity`, `integTxt`, `lenses`, `finalLoop`).
- `workflow/flow.test.mjs`: arnês `exec({ cards, deliverables, config, over })` (~142) com `AsyncFunction`; resposta padrão `/:final-/` e `/test-integrity$/`; teste R3/I-2 (~2177-2190).
- `workflow/review.test.mjs`: `loadPure()` (`P2.runReviewLoop` ~521) e conferências sobre `SRC`; não tem arnês de execução do workflow.
- `workflow/prompts.test.mjs`: teste `AC3` de E9 (~313-350, lista `/:impl/` ~336); teste do `task-reviewer.md` (~200).
- `scripts/preflight.mjs` `validateReleaseConfig` (~17, forma de `taskReview` ~25-30); `preflight.test.mjs` ~765.
- `references/config.md` ~21 (linha de `taskReview`); `README.md` do plugin, seção Agents (~28-33); `agents/task-reviewer.md` e `agents/implementer.md` (modo de correção, ~30-34).

## Tamanho do script

Toda tarefa que edita `roadmap-release.js` (T2, T3, T4) mede `workflowChars` de `size.test.mjs` depois de cada edição. Espaço só se libera no bloco da revisão final (do agente `${E}:test-integrity` ao fim de `finalLoop`), pelas fontes da tabela do Desenho da spec, e só na T2, antes de somar código. Nunca encurtar outro estágio, comentário ou helper compartilhado, nunca tirar regra, nunca editar `size.test.mjs` nem `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563).

| Tarefa | Limite de `workflowChars` | Estimativa da spec |
|---|---|---|
| T2 (primeira) | 239.300 | ~238.900 |
| T3 (meio) | 239.600 | ~239.040 |
| T4 (última) | 239.800 | ~239.790 |

Se a T4 passar do limite, usa a reserva da spec, nesta ordem: chave de lente mais curta para o card não crítico (-15), `S_VERIFY` com `required` só no nível de cima (-20), mensagem da onda única sem o número de correções (-30, só se a T3 já a escreveu; o teste da T3 se ajusta no mesmo commit). Nenhuma rodada de correção termina acima de 240.000. A tarefa que não alcança o limite não commita nada e devolve `BLOCKED` com o déficit medido (total menos limite).

## Como rodar os checks

Cada check roda sozinho na sua chamada, sem pipe nem encadeamento (sem `grep`, `tail`, `;` ou `&&` depois). Numa tarefa com teste primeiro, a execução vermelha e a verde são duas chamadas do mesmo comando idêntico. Saída longa é cortada no relatório com `[...]`, nunca filtrada.

## Tarefas

### Tarefa 1: Validação de finalReview no preflight

Teste primeiro em `preflight.test.mjs`, caso `E24: validateReleaseConfig accepts a missing finalReview and the two booleans, refuses other shapes and keys`: `finalReview` ausente, `{}`, `{ adversarial: true }`, `{ singleWave: false }` e os dois juntos dão `[]`; `'x'`, `[]`, `{ adversarial: 'sim' }` e `{ single: true }` dão erro que nomeia `finalReview`, `finalReview.adversarial` ou `finalReview.single` (C5). Rodar e relatar a falha. Implementar em `validateReleaseConfig` na forma de `taskReview`. Em `config.md`, uma linha da tabela para `finalReview`: dois booleanos opcionais lidos com `=== true`, desligados por padrão, E27 decide ligá-los; o preflight recusa outra forma e nomeia a chave. Commit `E24 T1: finalReview no preflight`.

### Tarefa 2: Agentes da revisão final e espaço no teto

Primeira tarefa que edita o script. Teste primeiro em `flow.test.mjs`: no teste R3/I-2, a asserção sobre o prompt de `E1:final-1-r2` (~2189) vira três (R11 da spec): `opts.agentType === 'productivity-tools:final-reviewer'`; o prompt traz `Mode: review` e a lista dos achados anteriores; `agents/final-reviewer.md`, lido pelo teste, traz no modo `review` a frase `Blocks (defeito): an edit to the spec or the plan made by a fix round`. A asserção de `E1:gates-fix1-review` não muda. Rodar `flow.test.mjs` sozinho e relatar a falha.

Implementar: criar `agents/final-reviewer.md` (forma de `task-reviewer.md`: `name: final-reviewer`, descrição que diz que só lê e nunca pergunta, `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort`, `NO_ASK` literal, precedência do prompt; modo `review` com todo o texto genérico que sai do prompt, as lentes definidas por chave curta, a regra dos alertas, a dos achados anteriores e a medida `headSha`, `clean`, `commitsInRange`; modo `verify`: tentar refutar cada achado numerado lendo o código e rodando só comandos de leitura, `refuted: true` só com evidência concreta, arquivo e linha ou saída de comando, na dúvida `refuted: false`, devolver `verdicts: [{ n, refuted, reason }]`, sem `superpowers`). Criar `agents/test-integrity.md` (`name: test-integrity`, `tools: Read, Write, Bash`, sem `model` nem `effort`, `NO_ASK` literal; gravar o programa, rodar o comando exato, apagar o arquivo, devolver os campos, `removedAsserts=-1` e zero nos outros se o programa falhar). No bloco da revisão final: `FRA` (agente, fase, opus, high); as chamadas `${E}:final-<n>-r<rodada>` com `...FRA` e prompt só com dados (`C()`, `Mode: review, lens: <chave>`, diff, spec, plano, `cardRef`, alertas com rótulo curto, achados anteriores com `repeatRule()`); retorno `{ ...rs[0], issues, clean }`; `${E}:test-integrity` com `agentType: 'productivity-tools:test-integrity'`, haiku, low, prompt com caminho, comando exato e `TEST_INTEGRITY`; tirar ` with a test for each defect, run the affected tests` de `${E}:final-fix<k>`. Medir depois de cada edição. Rodar de novo o mesmo comando de `flow.test.mjs`, depois `review.test.mjs`, `prompts.test.mjs`, `integrity.test.mjs`, G5, o teste de tamanho e o check do limite (até 239.300). Commit `E24 T2: agentes da revisão final`.

### Tarefa 3: Onda única da correção final

Teste primeiro em `review.test.mjs`, caso `AC3: by default the final review has no verification call and today's fix rounds; the single wave has one fix and one re-review`: por `P2.runReviewLoop` com achado que volta: sem `once`, as correções e revisões são as de hoje (`maxFix` 2 e a rodada extra da escalada); com `once: true`, um só `fix` (k=1) e duas revisões, `ok: false` e mensagem com o número de correções feitas; `once` com `maxFix: 0` não corrige; e, sobre `SRC`, `finalLoop` passa `once` só com `FR.singleWave === true` e `FR` é `CFG.finalReview || {}`. Em `flow.test.mjs`, caso `E24 AC3: the default final review calls no final-verify; singleWave makes one final-fix1 and one final re-review` por `exec` (padrão: `E1:final-fix1` chamado, nenhum `:final-verify`; `config.finalReview.singleWave`: só `E1:final-fix1`, só `-r2`, entregável parado). Rodar `review.test.mjs` sozinho e relatar a falha. Implementar `opt.once` em `runReviewLoop` (`k <= Math.min(1, env.maxFix)`, sem bônus; sem `once` nada muda), `FR` e `once` em `finalLoop`. Rodar de novo o mesmo comando, `flow.test.mjs`, o teste de tamanho e o check do limite (até 239.600). Commit `E24 T3: onda única da correção final`.

### Tarefa 4: Verificação adversarial

Teste primeiro em `review.test.mjs`: `AC1: splitRefuted drops only an explicitly refuted finding and keeps its reason` (por `loadPure`); `AC1: with the adversarial mode a refuted finding gets no fix and is recorded as refuted` (`P2.runReviewLoop` com callback que aplica `splitRefuted`: nenhum `fix`; e, sobre `SRC`, o callback de `finalLoop` só chama `${E}:final-verify-r` com `FR.adversarial === true` e achado bloqueante, com `...FRA`, `Mode: verify` e `S_VERIFY`, e empurra `stage: 'final-verify'`); `AC2: a confirmed finding or a null verification goes to the fix` (`refuted: false`, sem veredicto, número fora da lista, `reason` vazio e verificação `null` ficam em `keep`; o `fix` recebe o achado) (C3). Em `flow.test.mjs`, por `exec` com `config.finalReview.adversarial`: `E24 AC1: a refuted final finding calls no final-fix and is in reviews as refuted` (C1), `E24 AC2: a confirmed finding or a null verification reaches final-fix1`, e um caso só com achado menor sem `:final-verify` (C2). Rodar `review.test.mjs` sozinho e relatar a falha. Implementar `S_VERIFY`, `splitRefuted(iss, verify) -> { keep, refuted }` no bloco `// <pure>` e, no callback, a chamada única por rodada, o filtro e `out.reviews.push({ stage: 'final-verify', round, refuted })`; o achado refutado que volta passa por nova verificação (C4). Medir depois de cada edição. Rodar de novo o mesmo comando, `flow.test.mjs`, o teste de tamanho e o check do limite (até 239.800; reserva na seção Tamanho). Commit `E24 T4: verificação adversarial`.

### Tarefa 5: Teste dos prompts, README e gates

Em `prompts.test.mjs`, caso `AC4: the final review and verification prompts cite no superpowers and forbid asking`: frontmatter e corpo de `final-reviewer.md` (nome, descrição que diz que nunca pergunta e só lê, `tools: Read, Grep, Glob, Bash`, sem `model` nem `effort`, `NO_ASK` literal, modos `review` e `verify`) e de `test-integrity.md` (nome, `tools: Read, Write, Bash`, sem `model` nem `effort`, `NO_ASK` literal); nenhum agente nem o script cita `superpowers`; as chamadas `:final-` e `:final-verify` carregam `agentType: 'productivity-tools:final-reviewer'` (por `FRA`) e abrem com `${C()}`, cujo briefing traz "Asking the user is FORBIDDEN". No teste `AC3` de E9, `/:impl/` passa a exigir `runImpl` chamado com `` `${E}:t${t.n}:impl` `` e a chamada de `implAgent` de `runImpl` começando por `buildImplPrompt(` (nota do dono). Na seção Agents do `README.md` do plugin, as linhas de `final-reviewer` e `test-integrity`. Sem bump. Rodar `prompts.test.mjs`, G1, G2, G3, G5 e o teste de tamanho. Evidência aceitável se um gate não rodar aqui: saída literal e motivo. Commit `E24 T5: teste dos prompts e README`.

### Tarefa 6: Teste comportamental pelo orquestrador

Tarefa do orquestrador da sessão principal (DEC-204, R8 da spec), no worktree de E24 antes do merge: sessões `claude -p` com `--plugin-dir` no worktree (DEC-566) despacham `productivity-tools:final-reviewer` pelo nome nos modos `review` e `verify` sobre fixture sintética marcada (`SYNTHETIC FIXTURE`) em `D:/projects/claude-play-wt/_tmp/E24-comportamental/`, com um defeito plantado real e um achado falso; relatório em `docs/reports/2026-11-13-E24-revisao-final-comportamental.md`; pasta apagada no fim. Sem ferramenta de subagent, devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)", sem relatório fictício; essa é a evidência aceitável. Commit `E24 T6: relatório comportamental`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC1: with the adversarial mode a refuted finding gets no fix and is recorded as refuted` |
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `E24 AC1: a refuted final finding calls no final-fix and is in reviews as refuted` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC2: a confirmed finding or a null verification goes to the fix` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `E24 AC2: a confirmed finding or a null verification reaches final-fix1` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `AC3: by default the final review has no verification call and today's fix rounds; the single wave has one fix and one re-review` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `E24 AC3: the default final review calls no final-verify; singleWave makes one final-fix1 and one final re-review` |
| AC4 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | `AC4: the final review and verification prompts cite no superpowers and forbid asking` |

## Decisões do plano

- R12: seis tarefas; preflight primeiro; T2 libera espaço e cria os agentes; T3 e T4 somam código; T5 testa os prompts e roda os gates; T6 é do orquestrador.
- R13: os critérios 1 a 3 têm casos em `review.test.mjs` (comando da tag, por `loadPure` e sobre `SRC`) e casos de ponta a ponta em `flow.test.mjs`, onde está o arnês `exec`.
- R14: lentes por chave `correctness`, `security` e `all`; função `splitRefuted`; objeto `FRA`.
- R15: T6 sem subagent devolve `NEEDS_HUMAN`.

```json data
{
  "schema": "plan/1",
  "id": "E24",
  "title": "Revisão final com verificação adversarial",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ nem a estratégia.",
    "Medir roadmap-release.js com workflowChars depois de cada edição; liberar espaço só no bloco da revisão final (do agente test-integrity ao fim de finalLoop), só na T2, antes de somar código, sem tirar regra; nunca encurtar outro estágio, comentário ou helper compartilhado; nunca editar size.test.mjs nem MAX_WORKFLOW_CHARS (DEC-556, DEC-563).",
    "Limites de workflowChars: T2 <= 239300, T3 <= 239600, T4 <= 239800; nenhuma rodada de correção termina acima de 240000; tarefa fora do limite não commita e devolve BLOCKED com o déficit medido.",
    "Cada check roda sozinho na sua chamada, sem pipe nem encadeamento; vermelho e verde são duas chamadas do mesmo comando; saída longa cortada com [...], nunca filtrada.",
    "Modos desligados por padrão: sem finalReview nenhuma chamada nova e as rodadas de hoje; só o achado refutado explicitamente sai da correção.",
    "Sem bump de versão; sem push; nunca tocar em main nem em D:/projects/claude-play; não citar superpowers.",
    "Execução comportamental com subagent é do orquestrador da sessão principal (DEC-204); sem relatório fictício."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Validação de finalReview no preflight",
      "deps": [],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs", "plugins/productivity-tools/skills/roadmap-release/references/config.md"], "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": ["validateReleaseConfig(cfg) aceita finalReview { adversarial?: boolean, singleWave?: boolean }"],
      "consumes": [],
      "covers": ["AC3", "C5"],
      "testFirst": true,
      "checks": [{ "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Agentes da revisão final e espaço no teto",
      "deps": [],
      "files": { "create": ["plugins/productivity-tools/agents/final-reviewer.md", "plugins/productivity-tools/agents/test-integrity.md"], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["agent productivity-tools:final-reviewer (Mode: review | verify)", "agent productivity-tools:test-integrity", "FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }"],
      "consumes": [],
      "covers": ["AC4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/integrity.test.mjs", "expect": "exit 0" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239300 ? 0 : 1\"", "expect": "exit 0 (até 239300; acima: BLOCKED com o déficit, sem commit)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Onda única da correção final",
      "deps": [2],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["runReviewLoop(env, stage, review, fix, truth, { ...opt, once })", "FR = CFG.finalReview || {}"],
      "consumes": [{ "task": 2, "sig": "FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }" }],
      "covers": ["AC3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239600 ? 0 : 1\"", "expect": "exit 0 (até 239600; acima: BLOCKED com o déficit, sem commit)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Verificação adversarial",
      "deps": [3],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["splitRefuted(iss, verify) -> { keep, refuted }", "S_VERIFY = { verdicts: [{ n, refuted, reason }] }"],
      "consumes": [{ "task": 2, "sig": "FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }" }, { "task": 3, "sig": "FR = CFG.finalReview || {}" }],
      "covers": ["AC1", "AC2", "C1", "C2", "C3", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239800 ? 0 : 1\"", "expect": "exit 0 (até 239800; acima: reserva da spec e, se não bastar, BLOCKED com o déficit, sem commit)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Teste dos prompts, README e gates",
      "deps": [1, 4],
      "files": { "create": [], "modify": ["plugins/productivity-tools/README.md"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [{ "task": 2, "sig": "agent productivity-tools:final-reviewer (Mode: review | verify)" }, { "task": 4, "sig": "S_VERIFY = { verdicts: [{ n, refuted, reason }] }" }],
      "covers": ["AC4"],
      "testFirst": { "exempt": "o teste confere texto já entregue por T2 e T4; o próprio teste é a entrega" },
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Teste comportamental pelo orquestrador",
      "deps": [5],
      "files": { "create": ["docs/reports/2026-11-13-E24-revisao-final-comportamental.md"], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [{ "task": 2, "sig": "agent productivity-tools:final-reviewer (Mode: review | verify)" }],
      "covers": [],
      "testFirst": { "exempt": "execução comportamental do orquestrador (DEC-204), sem código" },
      "checks": [{ "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-13-E24-revisao-final-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC4", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "external": false, "externalDedupe": null, "blq": null }
  ],
  "rulings": [
    {
      "id": "R12",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Seis tarefas: preflight e config.md (T1); agentes e espaço no teto (T2, primeira a editar o script); onda única (T3); verificação adversarial (T4, última a editar o script); teste dos prompts, README e gates (T5); comportamental (T6).",
      "basis": "A spec deixa a ordem ao plano e manda a primeira tarefa que edita o script mover o texto para o agente; a nota do dono dá limites crescentes; cada tarefa fica com até quatro arquivos.",
      "alternative": "Uma tarefa única para todo o roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Onde testar os critérios 1 a 3, se review.test.mjs não tem arnês de execução do workflow?",
      "decision": "review.test.mjs, comando da tag, ganha os casos AC1-AC3 por loadPure (splitRefuted e runReviewLoop com o callback que filtra e com once) e conferências sobre SRC do callback de finalLoop; flow.test.mjs, onde está o arnês exec com AsyncFunction, ganha os casos E24 AC1-AC3 de ponta a ponta como evidência adicional.",
      "basis": "A spec pede o workflow rodado com agentes simulados, mas o arnês exec só existe em flow.test.mjs, que já está no escopo; copiar o arnês para review.test.mjs duplicaria centenas de linhas de simulação.",
      "alternative": "Copiar o arnês exec para review.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "Quais nomes finais da função pura, do objeto de opções e das chaves das lentes?",
      "decision": "splitRefuted, FRA, FR e S_VERIFY; lentes correctness e security para card crítico e all para o não crítico, definidas no modo review de final-reviewer.md.",
      "basis": "A spec já usa esses nomes e deixa as chaves ao plano; chaves curtas cabem na estimativa de -224.",
      "alternative": "Chaves descritivas mais longas.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "O que a tarefa comportamental faz num executor sem ferramenta de subagent?",
      "decision": "Devolve NEEDS_HUMAN com humanInputs citando a execução do orquestrador da sessão principal (DEC-204) e não escreve relatório.",
      "basis": "DEC-204, R8 da spec e a nota do dono.",
      "alternative": "Deixar o relatório fora do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
