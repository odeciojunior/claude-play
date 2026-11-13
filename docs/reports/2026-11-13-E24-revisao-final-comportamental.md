# E24: revisão final comportamental

Data: 2026-11-13. Commit sob teste: `04b0685` (ponta de `release/roadmap-skills-v2`, com E24 mesclada em `4308baa`), carregado do worktree `D:/projects/claude-play-wt/_integracao`.
Execução do orquestrador da sessão principal (DEC-204), definição de pronto de E24 (SRC-03, Tarefa 6 do plano). Feita depois do merge, como em E23. É registro de evidência, não registra aceite.

## Veredito

| verificação | veredito | motivo |
|---|---|---|
| A1 modo `review` acha o defeito plantado como bloqueante | **APROVADO** | Achado `critical/defeito` em `src/paging.js`: "lastPage uses Math.floor ... lastPage(25, 10) returns 2 and the spec example requires 3 ... This violates AC1." |
| A2 formato de `S_REVIEW` | **APROVADO** | `issues`, `summary`, `headSha` (ponta real `0c60c94`), `clean: true`, `commitsInRange: 1`; severidades e categorias dentro dos enums. |
| A3 a isca não vira achado bloqueante | **APROVADO** | O código `!!~indexOf` só gerou um achado `minor` verdadeiro (NaN), fora de `blocking()`. |
| B1 formato de `S_VERIFY` | **APROVADO** | `verdicts` com `n` 1 e 2, `refuted` booleano, `reason` texto. |
| B2 achado falso refutado com motivo | **APROVADO** | Veredicto 2 `refuted: true`: "~(-1) is 0 (bitwise NOT of -1), not -1, so !!~list.indexOf(x) is false when x is absent". |
| B3 achado real mantido | **APROVADO** | Veredicto 1 `refuted: false`, com arquivo e o exemplo da spec. |
| C `splitRefuted` real sobre os veredictos | **APROVADO** | `keep` = só o achado 1 (o mesmo objeto); `refuted` = só o achado 2, com o `reason`. |

Nenhum defeito encontrado no agente `final-reviewer` nem no workflow.

## Método

- Uma sessão `claude -p` por modo, com a pasta de rascunho como diretório corrente:
  `env -u CLAUDE_CONFIG_DIR CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<prompt>" --plugin-dir D:/projects/claude-play-wt/_integracao/plugins/productivity-tools --model sonnet --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 2 --output-format stream-json --verbose < /dev/null` (bypass só na orquestração e nas medições, DEC-311/312).
  Claude Code 2.1.323. O `init` das duas sessões mostra `productivity-tools` 1.7.0 carregado do `_integracao` e o agente `productivity-tools:final-reviewer` listado; as mensagens da sessão e do subagent são de `claude-sonnet-5-5`.
- Cada sessão age como arnês: lê um arquivo de prompt e chama a ferramenta Agent uma vez, com `subagent_type: "productivity-tools:final-reviewer"` (despacho pelo nome) e o conteúdo do arquivo sem mudança; depois imprime a resposta do agente literalmente. A sessão não revisa nada por conta própria.
- **Prompt do modo `review`.** Mesmo formato de `roadmap-release.js` (bloco `finalLoop`): briefing (`FIXED RULES`, `PROJECT`, `DELIVERABLE E1: worktree …`, `ENVIRONMENT MEASURED IN THE PREFLIGHT`, `CURRENT BASELINE OF THE TARGET`), linha vazia, `Mode: review, lens: all. Diff: git -C "<fixture>" diff release/fx...HEAD` e `Spec …, plan …, card E1 in …`. Há um bloco "HARNESS" no fim que pede só o JSON de `S_REVIEW` (no workflow, quem impõe o schema é o runtime).
- **Prompt do modo `verify`.** Gerado por script com o modelo das linhas 2599 a 2602 do workflow: `${briefing}\n\nMode: verify.\n${fmt(bl)}`, sem linha `Diff`, com o `fmt` real carregado por `loadPure()`. A lista tem dois achados bloqueantes: 1 = o defeito plantado (real); 2 = um achado inventado, que diz que `hasItem` devolve true para item ausente porque "~(-1) is -1". No fim, bloco "HARNESS" com o JSON de `S_VERIFY`.
- **Conferência.** Um script lê o texto final do subagent em cada stream, confere os formatos contra `S_REVIEW` e `S_VERIFY` e aplica `blocking()` e `splitRefuted()` reais, carregados por `loadPure()` de `roadmap-release.js`.

## Fixture

`D:/projects/claude-play-wt/_tmp/E24-comportamental/fixture` (apagada no fim), repositório git próprio com `SYNTHETIC FIXTURE` no README, na spec, no plano, na estratégia e no código.

- Alvo `release/fx`: README, `package.json`, `docs/plans/fx-strategy.md` (card E1).
- `feat/E1` (um commit, `0c60c94`): `docs/plans/fx-E1/spec.md` e `plan.md`; `src/paging.js` com `lastPage`, `pageSlice` e `hasItem`; `test/paging.test.js` com um teste por critério (3 testes, todos passando).
- **Defeito plantado:** `lastPage` usa `Math.floor`, então `lastPage(25, 10)` dá 2, e a spec pede 3. O teste de AC1 só cobre múltiplos exatos e por isso passa.
- **Isca (suspeito, mas correto):** `hasItem` com `!!~list.indexOf(x)` (`~(-1) === 0`) e `pageSlice` com o início escrito como `page * perPage - perPage`.

## Resultados

### Sessão A (modo `review`)

O subagent leu o diff, a spec, o plano e o card com `git`/`cat`/`grep` e devolveu:

- `critical/defeito` `src/paging.js`: `lastPage` com `Math.floor`; `lastPage(25, 10)` dá 2 em vez de 3; viola AC1.
- `important/defeito` `test/paging.test.js`: o teste de AC1 não tem caso fora de múltiplo exato, então o erro passa.
- `minor/defeito` `src/paging.js`: `!!~indexOf` obscuro; devolve false para `NaN` (verdadeiro: `indexOf` não acha `NaN`); sugere `includes`.
- `headSha` `0c60c94…`, `clean: true`, `commitsInRange: 1`, conferidos com a fixture. O resumo diz que o agente não rodou os testes, só leu o código, o que o modo permite.

### Sessão B (modo `verify`)

- Veredicto 1, `refuted: false`: cita `Math.floor`, o exemplo 25/10 da spec e a lacuna do teste de AC1.
- Veredicto 2, `refuted: true`: "~(-1) is 0 (bitwise NOT of -1), not -1, so !!~list.indexOf(x) is false when x is absent. hasItem(['a','b'],'z') therefore returns false and AC3 holds", com o comentário de `src/paging.js` e a asserção de `test/paging.test.js` como prova.

### `splitRefuted`

Com os veredictos de B e a lista enviada, `splitRefuted(bl, v)` devolve `keep = [achado 1]` (o mesmo objeto) e `refuted = [achado 2 + reason]`. Só o achado falso sai da correção, como o critério 1 da spec define.

## Custo

| sessão | modelo | `total_cost_usd` |
|---|---|---|
| A (review) | sonnet | 0,1664 |
| B (verify) | sonnet | 0,1356 |
| **total** | | **0,3020** |

O valor é o da linha `result` do stream e inclui o subagent (o `modelUsage` só tem `claude-sonnet-5-5`). Teto do teste: US$ 6. Nenhuma repetição.

## Leitura

- O despacho pelo nome funciona com `--plugin-dir`: o agente do plugin aparece no `init` e responde nos dois modos segundo o `Mode:` do prompt.
- No modo `review`, o agente achou o defeito plantado e também a lacuna do teste que o esconde. A isca não gerou achado bloqueante.
- No modo `verify`, o agente refutou o achado inventado com evidência concreta (conta de bits, comentário e asserção do teste) e manteve o real com `refuted: false`, como manda o texto do modo. Junto com `splitRefuted`, o caminho da verificação adversarial descarta só o achado falso.
- Limites: (1) o teste rodou em sonnet; no workflow, `FRA` despacha em opus/high, e se espera resultado igual ou melhor. (2) O briefing reproduz a forma de `COMMON_BASE` de modo resumido (sem `RULE_GIT`, `RULE_RM`, `RULE_TMP`, `RULE_PROC`, `RULE_LOCKS`) e não foi capturado literalmente do workflow. O prompt do modo `verify` usa o `fmt` real. (3) Nas sessões `-p` o Agent rodou em modo assíncrono: a sessão respondeu "still running" e continuou quando chegou a notificação de fim. Isso vem do arnês, não do plugin; no workflow, a chamada `agent()` espera o resultado. (4) No modo `verify`, o subagent encadeou comandos com `;` numa chamada Bash, o que só a regra `RULE_TMP` proíbe, e ela ficou fora deste briefing resumido.

## Defeitos encontrados na skill

Nenhum. `plugins/productivity-tools/agents/final-reviewer.md`, `splitRefuted` (`roadmap-release.js:370-377`), `fmt` (`:378-380`) e `S_VERIFY` (`:1416`) se comportaram como a spec de E24 descreve.
