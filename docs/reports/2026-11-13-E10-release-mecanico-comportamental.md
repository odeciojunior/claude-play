# E10: release mecânico comportamental

Data: 2026-11-13. Executor: orquestrador da sessão principal (DEC-204, DEC-662). Plugin: `productivity-tools` 1.7.0 de `release/roadmap-skills-v2` (E10 mesclada em c1d6647, ponta cb67d26), carregado por `--plugin-dir` do worktree `_integracao`. Feito depois do merge, como em E23 e E24. É registro de evidência, não registra aceite.

## Método

Três sessões `claude -p` independentes, em paralelo, cada uma com `--plugin-dir <_integracao>/plugins/productivity-tools --model sonnet --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 2 --output-format stream-json --verbose` (bypass só na orquestração e nas medições, DEC-311/312), com cwd na fixture. A linha init de cada stream confirmou que o plugin veio do `_integracao` e que o agente `productivity-tools:script-runner` estava listado.

- **A (caminho seco da skill):** `/productivity-tools:roadmap-release {"mode":"dry-run"}`, com a instrução de não chamar o Workflow. A sessão percorre os passos 1 a 3, roda o preflight do passo 2 e imprime os argumentos do passo 4.
- **B (descoberta pelo script-runner):** despacho de `productivity-tools:script-runner` pelo nome (haiku) com o prompt `runPrompt(discCmd)` montado como em `roadmap-release.js:1434-1440`: plugin root vindo de `pluginRootOf(trackerCli)`, `shq`, `--prefix 'feat/'` e um nonce no formato do runToken.
- **C (grupo pelo script-runner):** despacho com `node verify-run.mjs group <encArg(payload)>`, payload no formato de `roadmap-release.js:1754` (`nonce = fnv1a(runToken):E1:executing:0`, `cwd` = worktree de integração da fixture, `finally.commit` sobre a pasta do roadmap) e três passos: `git status --porcelain` (passa), `git rev-parse --verify refs/heads/no-such-ref-e10` (falha) e `git tag e10-step3-ran` (não pode rodar).
- A verificação foi feita fora das sessões, com `checkRun`, `encArg`, `shq` e `pluginRootOf` reais carregados por `loadPure` (como em `flow.test.mjs`), comparando o stdout devolvido pelo agente com o resultado bruto da ferramenta Bash do subagente, com uma nova execução direta do script, com o tracker CLI e com o git.
- Teste de adulteração sem sessão: um caractere alterado no stdout de B, nonce trocado e `exit` alterado no stdout de C.

## Fixture

Repositório git sintético em `D:/projects/claude-play-wt/_tmp/E10-comportamental/repo`, com README marcado `SYNTHETIC FIXTURE`. A pasta `docs/plans/roadmap-sample/` é cópia de `roadmap-tracker/scripts/fixtures/valid` mais o `check-roadmap.mjs` vendorizado (checker: 0 erros, 0 avisos). Branches: `main`, `release/sample` com `merge: E1 in release/sample` (merge no-ff de `feat/E1`) e worktree `repo-wt/_integracao` em `release/sample`. A pasta foi apagada no fim.

## Resultados

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 0 | Init: plugin de `_integracao`, agente listado | PASS | 3/3 sessões: `productivity-tools@inline` 1.7.0 de `_integracao`; `productivity-tools:script-runner` em `agents` |
| A1 | Preflight do passo 2 rodou | PASS | `preflight.mjs docs/plans/roadmap-sample --ref release/sample`, exit 0, `errors` [], `generated` true, 6 `missingRules` sem parada no dry-run |
| A2 | Argumentos do passo 4 completos | PASS | `mode, config, runToken, trackerCli, repo, roadmap, wtRoot`; `config`, `runToken` e `trackerCli` iguais à saída do preflight da sessão |
| A3 | Workflow não chamado | PASS | A sessão usou só Bash (2 chamadas) |
| B1 | Despacho por nome, comando intacto | PASS | 1 chamada Bash do subagente, com texto idêntico ao `discCmd` |
| B2 | exit e stdout literal | PASS | exit 0; stdout igual ao resultado bruto da ferramenta e igual, byte a byte, a uma nova execução direta |
| B3 | checkRun aceita | PASS | `ok: true`, nonce = runToken, digest `46773a3c` |
| B4 | Dados conferem com tracker e git | PASS | E1 spec, E2 not-started, E3 not-started = `roadmap.mjs status`; blockers [] = tracker; E1 `onTarget` com `mergeSha` = commit `merge: E1 in release/sample` |
| T1 | Adulteração rejeitada | PASS | 1 caractere: "digest does not match: the copy is not literal"; nonce trocado: "nonce ... is not the one of this run" |
| C1 | Para no primeiro exit não zero | PASS | `steps` n1 exit 0, n2 exit 128; `stopped {n:2, exit:128}`; tag do passo 3 ausente |
| C2 | checkRun aceita o grupo | PASS | `ok: true`, nonce `a59357b5:E1:executing:0`, digest `19b514a1`; `exit` adulterado para 129 é rejeitado |
| C3 | Worktree limpo depois | PASS | porcelain vazio, `commit: false`, HEAD inalterado `ac74d55` |

## Custos

| Sessão | Custo (US$) | Turnos da sessão principal |
|---|---|---|
| A | 0,1391 | 3 |
| B | 0,1295 | 2 |
| C | 0,1129 | 2 |
| Total | 0,3816 | |

Limite: US$ 6. Nenhuma nova tentativa por falha de infraestrutura.

## Leitura

- Nos dois casos testados, a fronteira código/agente que a E10 introduz funciona: o script-runner (haiku) copiou literalmente saídas de 3 KB (descoberta) e de 250 bytes (grupo), e o `checkRun` real do workflow aceitou as duas. Uma alteração de um caractere ou um nonce errado bastam para a rejeição, então a cópia não depende da boa vontade do agente.
- A descoberta por código bate com as duas fontes independentes: o tracker CLI, nos status e bloqueios, e o git, no merge de E1 visto como `onTarget`.
- `verify-run group` respeita a parada no primeiro passo que falha. O exit do processo é 0 e a falha vem dentro da saída assinada, como o contrato diz. O `finally.commit` roda mesmo após a falha (por desenho, `verify-run.mjs:120-127`); aqui nada estava em stage, então `commit: false` e o worktree ficou limpo.
- No dry-run, a skill monta os seis argumentos obrigatórios do passo 4 a partir do preflight recém-rodado, sem tocar no Workflow nem gravar a config gerada (passo 3 em memória).

## Limites

- O Workflow não foi executado (DEC-230): o `agent()` do runtime, com `schema: S_RUN` e saída estruturada imposta, não foi exercitado. No Agent tool de uma sessão `claude -p` não há schema, então o prompt do workflow ganhou uma instrução de devolver `{"exit","stdout"}` em JSON, uma aproximação do contrato estruturado.
- O agente foi despachado pelo Agent tool da sessão, e não pelo `agent()` do workflow. Modelo e prompt são os mesmos (haiku, `runPrompt`).
- Descoberta pequena (uma página só, 3 KB): a paginação (`--page`, acima de 8000 caracteres) não foi exercitada.
- Nada foi de fato gravado no grupo (os passos não escrevem), então a gravação com `finally.commit` real e o caminho do `check` não foram testados por agente; ficam cobertos por `verify-run.test.mjs` e `flow.test.mjs`.
- A execução real do release com o plugin da ponta (E10 r2) mediu a integridade dos testes e rodou o `final-reviewer` em opus; a descoberta e o grupo por script-runner rodam pela primeira vez no release na próxima execução (E12).

## Defeitos

- Baixa: o prompt do script-runner contradiz o agente sobre o que fazer sem a ferramenta Bash. `runPrompt` (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js:1434`) termina com `BASH_ONLY` (`:1431`), que manda "return an empty list with error \"no-bash\"". Já o schema `S_RUN` (`:1432`) só tem `{exit, stdout}`, e o agente manda devolver `exit=-1` e `stdout` vazio (`plugins/productivity-tools/agents/script-runner.md:23`). Como "The call prompt wins over this file" (`script-runner.md:13`), o prompt prevalece e pede uma forma que o schema não comporta. Efeito prático nulo hoje: o `checkRun` rejeita qualquer resposta sem saída assinada e a leitura é repetida. O `runPrompt` deveria usar uma variante de `BASH_ONLY` sem a frase da lista.
