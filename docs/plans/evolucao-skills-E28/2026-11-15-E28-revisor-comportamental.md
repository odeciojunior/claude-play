# E28: teste comportamental do agente `productivity-tools:task-reviewer` no modo `review`

Data: 2026-11-15. Commit sob teste: `d5cbc83` (ponta de `feat/E28`), carregado do worktree `D:/projects/claude-play-wt/E28`.
Teste da definição de pronto (SRC-03), feito pelo orquestrador da sessão principal (DEC-204), no formato do teste de E21 (`c72dafc`). É registro de evidência, não registra aceite.

## Veredito

| caso | modo | veredito | observado |
|---|---|---|---|
| 1 | `review`, defeitos plantados | **APROVADO** | `spec: "fail"`, `quality: "fail"`, achados `F1` (R3 ausente, critical), `F2` (`console.log` em `src/`, important), `F3` (teste de R3 ausente, important); nenhuma pergunta. |
| 2 | `review`, diff limpo | **APROVADO** | `spec: "pass"`, `quality: "pass"`, `issues: []`. |
| 3 | `restricted, review` | **APROVADO, com observação** | Rodou o comando do pacote e leu o arquivo do pacote; `verdicts` `F1` aberto, `F2` fechado, `F3` aberto; `spec: "fail"`, `quality: "fail"`. |

Nenhuma correção de `agents/task-reviewer.md` foi aplicada.

## Método

- Uma sessão `claude -p` por caso, com `CLAUDE_CONFIG_DIR=D:/claude-e17-cfg` (configuração descartável, productivity-tools instalado desligado) e o repositório da fixture como diretório corrente:
  `claude -p --plugin-dir D:/projects/claude-play-wt/E28/plugins/productivity-tools --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 1 --output-format json < <prompt da sessão>`. Claude Code 2.1.325. O bypass é só porque é uma sandbox de medição.
- O prompt da sessão manda chamar o Agent uma vez, com `subagent_type: "productivity-tools:task-reviewer"`, `model: "sonnet"`, `effort: "medium"`, `run_in_background: false`, passando o prompt de revisão literal, e imprimir a resposta literal.
- O prompt de revisão foi montado pela função real `buildTaskReviewPrompt` (com `fmt`, `restrictedRound` e `fmtChecks` reais), carregada por `loadPure()` do worktree de E28, com `kind = 'review'` e `taskReview: { restricted: true, single: true }`, como o laço `TR.single ? ['review'] : ...` faz. O schema `S_TASKREVIEW` foi avaliado a partir das linhas `const` do script.
- Diferenças em relação ao workflow, como em E21: `ctx.base` é uma base sintética que copia literalmente "Asking the user is FORBIDDEN (do not use AskUserQuestion)" e as regras de git, árvore limpa, temporários e efeito externo; um pedido "HARNESS" no fim pede só o JSON do schema, mais `ambiguities` (no workflow o runtime impõe o schema).
- Conferência do despacho: nas três sessões o `prompt` do `tool_use` Agent é igual ao arquivo do prompt de revisão (diferença só no espaço final), com `subagent_type`, `model`, `effort` e `run_in_background` corretos; o subagent rodou em `claude-sonnet-5-5`.
- **Fixture sintética** em `D:/claude-e28bt/` (fora do repositório), marcada `SYNTHETIC FIXTURE` no README e no topo de cada arquivo. Spec: `slugify(text)` com R1 minúsculas, R2 trocar sequências fora de `a-z0-9` por um `-`, R3 tirar `-` das pontas, R4 `TypeError` para não string, R5 testes de R1-R4. Convenção do bloco PROJECT: nada de console em `src/`.
  - `defect`: base `6ba2333`; tarefa `d389d8c` com R3 ausente (desvio de spec) e `console.log('slugify input', text)` em `src/slug.mjs` (defeito de qualidade); `node --test` passa com 3 testes. Correção `04a5061` (caso 3) tira o `console.log` e deixa R3 e o teste dele faltando; o resumo afirma "Fixed the review findings".
  - `clean`: base `6ba2333`; tarefa `2a7caa8` com R1-R5 e quatro testes.
- O `Previous:` e o `was.iss` do caso 3 são os achados reais do caso 1, passados por `fmt` (`restrictedRound` = true). A evidência vem dos JSONL em `D:/claude-e17-cfg/projects/D--claude-e28bt-*/`.

## Resultados

| conferência | caso 1 | caso 2 | caso 3 |
|---|---|---|---|
| sessão | `cfbda27d` | `0df1ec5d` | `dfd28cf4` |
| ferramentas do subagent | Bash 2, Read 2 | Bash 4, Read 2 | Bash 4, Read 2 |
| `AskUserQuestion` / Edit / Write | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| erros contra `S_TASKREVIEW` | 0 | 0 | 0 |
| `headSha` / `clean` / `commitsInRange` | `d389d8c…` / true / 1 | `2a7caa8…` / true / 1 | `04a5061…` / true / 2 |
| `spec` / `quality` | fail / fail | pass / pass | fail / fail |
| `taskIssues` real (modo único) | `F1,F2,F3` | (vazio) | `F1,F3` |
| fixture depois (`status --porcelain` vazio, HEAD inalterado) | sim | sim | sim |

Caso 1, `summary`: "Spec fails: R3 is missing and has no test. Quality fails: console.log in src/ breaks the project convention."

Caso 2, `summary`: "Task 1 meets R1-R5. ... Only the two planned files changed, and src/ has no console output."

Caso 3: o subagent rodou o comando literal de `review-package.mjs` e leu `D:/claude-e28bt/_pkg/c3-review2.diff` (a ressalva de E21 não se repetiu). Achados `F1` ("R3 is still not implemented ... The fix commit only removed the console.log.") e `F3`, com o mesmo `id`; `verdicts: [{F1, open: true}, {F2, open: false}, {F3, open: true}]`; `summary`: "F2 is fixed ... Quality fails because of the unfixed R3 bug." Ambiguidade relatada: a diferença entre o pacote (1 commit) e `Measure:` (2 commits), que o agente reconheceu como esperada.

## Custo

| sessão | `total_cost_usd` |
|---|---|
| caso 1 | 0,2930 |
| caso 2 | 0,2695 |
| caso 3 | 0,2749 |
| total | 0,8375 |

## Observações

1. **`quality: "fail"` sem achado de qualidade próprio (caso 3).** Com o `console.log` removido, o revisor reprovou `quality` pelo bug de R3, que já é achado de spec (`F1`). A regra "a bug" da lista de `quality` e "confirm there is no regression against the spec" permitem essa leitura; o texto do agente não diz se um defeito já classificado como spec também reprova `quality`. Não muda o fluxo: `F1` é bloqueante e leva a rodada ao corretor.
2. **Shell composto (caso 1).** O subagent rodou `rev-parse; status --porcelain; rev-list --count` numa linha, contra a regra "one simple command per call" copiada na base sintética. Mesma observação de E21 (ponto 5).
3. **Isolamento parcial,** como em E21: base sintética no lugar do `COMMON_BASE`; schema pedido em texto em vez de imposto pelo runtime.
