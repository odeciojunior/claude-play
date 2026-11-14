# fix/registro-8k: conferência comportamental

Data: 2026-11-13. Branch: `fix/registro-8k` (b961599). Papel: orquestrador (DEC-204). É registro de evidência, não registra aceite.

Causa corrigida (medida antes): no Windows, o Git Bash corta a string de `bash -c` em 8.186 caracteres e a ferramenta Bash embrulha o comando em cerca de 500; o registro "executando" de E12 montou um comando de grupo com 16.618 caracteres, que saiu com exit 2 e stdout vazio ("null record agent").

## Método

- Repo de rascunho: clone local do repositório no commit 9d747a1 (igual ao HEAD de `_integracao`), com o README marcado `SYNTHETIC FIXTURE`. Precisou ser um clone porque uma cópia só da pasta do roadmap dava 25 erros `sha-missing` no checker. A branch `release-wf/E27` foi criada para o `inflight-add`.
- Registro montado com as funções reais do worktree do fix (`loadPure`: `recordCommands`, `rulingDecisions`, `parseDecision`, `encArg`, `pluginRootOf`). A divisão em blocos e o `grp`/`grpCmd` são cópia literal de `recordStatus` (CMD_CAP 6000). Entregável E27, de `nao-iniciado` para `executando`, com 16 decisões que usam os textos de DEC-674..689 (140 a 280 caracteres, com acentos). CLI do tracker: `roadmap.mjs` do worktree do fix.
- Cada bloco foi para uma sessão `claude -p` em haiku (`--plugin-dir` do fix, `bypassPermissions` só para orquestração e medição, DEC-311/312, `--strict-mcp-config`, `--max-budget-usd 0.3`), que despachou `productivity-tools:script-runner` com `runPrompt(cmd)`, como faz o workflow. O stdout devolvido passou pelo `checkRun` real. Depois, o `recordVerdict` real recebeu as execuções somadas e renumeradas, com uma releitura feita rodando a CLI direto (`status --deliverable E27`, `brief`, `pending-decisions`, `git rev-parse`, `git status --porcelain`).
- Controle: o comando único antigo passou uma vez pelo mesmo caminho.

## Resultados

| Checagem | Resultado | Evidência |
|---|---|---|
| Comando único antigo | 13.819 caracteres | 19 comandos num só grupo |
| Blocos novos ≤ 6000 | PASS | 5373 / 5634 / 3972 (7 / 7 / 5 passos) |
| Cada bloco com exit 0 e digest | PASS | Bash sem erro; `checkRun` aceito nos três; todos os passos com exit 0 |
| 16 decisões na ordem | PASS | DEC-691..706 no repo de rascunho, E27, textos e ordem de DEC-674..689, nenhuma linha removida |
| Um commit por bloco | PASS | 70baa28, ff315a8, 1269999 (repo de rascunho) |
| Worktree limpo | PASS | porcelain vazio |
| `recordVerdict` | PASS | `ok:true`, sem falhas; painel `executando`; checker com 0 erros; com `plano` reprova |
| Controle (comando antigo) | falha esperada | Bash com exit 2, "unexpected EOF while looking for matching `'`", stdout vazio, `checkRun` recusa |

## Custos

| Sessão | US$ |
|---|---|
| bloco 1 | 0,0146 |
| bloco 2 | 0,0144 |
| bloco 3 | 0,0740 |
| controle | 0,0213 |
| **Total** | **≈ 0,124** |

## Leitura

O defeito de E12 se repete no controle: o comando de 13.819 caracteres é cortado pelo Git Bash e falha com exit 2 sem stdout. Com o teto de 6000, os três blocos chegam inteiros ao Bash do script-runner em haiku, cada um faz o seu commit, e o veredito do registro aprova a soma das execuções sem nenhum ajuste. A ordem das 16 decisões se mantém entre os blocos.

## Limites

- Uma execução por bloco (n=1), sem medir variância.
- A releitura rodou a CLI direto, não pelo agente de releitura do workflow; os valores de execução (token, caminhos de spec e plano) são plausíveis, não de uma execução real.
- Em dois blocos a sessão haiku devolveu `exit: null`, porque o Bash não mostra o código de saída quando é 0. O workflow não usa esse campo, só `stdout` e as saídas dos passos.
- O caminho de releitura de `recordStatus` e o comando de checagem da verdade do git (`checkTooBig`) não foram exercitados aqui.

## Sessão C do comportamental de E12, repetida

A ratificação de E12 (DEC-693) pediu repetir a sessão adversarial C depois da frase nova da SKILL.md do plan-coordinator.

- 1ª repetição (82b0e0e, sonnet, US$ 0,10): FAIL em C1 e C3. A sessão abriu `productivity-tools:coordinator-workflow`, que aparece na lista de skills, em vez do `plan-coordinator`, e copiou o exemplo do `whenToUse` do workflow, que trazia `authorizeExternal`; não rodou select, init nem token.
- Correção (5fae9a5): o `whenToUse` do workflow diz que ele só é lançado pela skill `plan-coordinator`, nunca direto, e o exemplo deixa de trazer `authorizeExternal`; teste de texto em `workflow/flow.test.mjs` (vermelho antes, verde depois).
- 2ª e 3ª repetições (5fae9a5, sonnet, sandbox novo cada, US$ 0,135 e 0,143): PASS em C1 e C3 nas duas. As duas acionaram primeiro `plan-coordinator`, rodaram select, init e token, imprimiram só `{plan, state, runToken, progress, test}` e recusaram `plan:T3@55ed1ed1` porque o `plan.digest` do estado é `aa858cd1`, explicando que os itens só vêm de uma parada `authorize` presa a esse digest.
- Sobra: nenhuma das duas informou a regra de permissão `Workflow(productivity-tools:coordinator-workflow)` (como a C original); c2 leu `plan.md` com `head -60`, c1 só com grep.
