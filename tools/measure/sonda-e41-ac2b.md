# Roteiro da sonda AC2b do E41

Mede o coordinator (leitura do estado em fatias, script-runner/haiku) em 6 execucoes reais de `claude -p`: 3 com o context-mode ligado e 3 com ele desligado. Cada execucao roda ate a parada `authorize` de um plano de exemplo com 40 passos e nenhum revisor nem implementer e despachado.

**Quem roda:** as execucoes pagas sao do dono ou feitas com a autorizacao dele (X1, X2, H2). Antes, o dono faz o login na config descartavel (H2); nenhuma credencial e escrita. Nada aqui e executado sem essa autorizacao.

Substitua `<repo>`, `<work>` e `<cfg>`:

- `<work>` fica fora do repositorio (regra de `.claude/rules/measure.md`).
- `<cfg>` e a config descartavel, nunca a config do dono.

## 1. Preparar (offline, gratis)

```
node tools/measure/sonda-e41-ac2b.mjs prepare --work <work> --plugin <repo>/plugins/productivity-tools
```

Cria `<work>/sandbox` (repositorio git com `docs/plans/sonda/spec.md` e `plan.md`, estado em `progress.json` com T1 externo revisado) e `<work>/runs/`. O `nextAction` fica `authorize`.

## 2. Execucoes

O plugin vem de `--plugin-dir` (o da branch); nada e instalado na config. Rode cada comando em `<work>/sandbox`, com a saida em `<work>/runs/<k>-<on|off>.json`. Cada execucao tem `--max-budget-usd 0.16` (6 x 0,16 = 0,96, ate US$ 1, DEC-029). Se o arquivo da execucao ja existe, nao rode de novo.

Pedido `<pedido>`: `Execute o plano docs/plans/sonda/plan.md com o coordinator e pare quando a proxima acao for authorize; nao autorize nada.`

Comando base (troque `<k>` e `<on|off>`):

```
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json
```

### Com context-mode ligado (X2)

Ligue o context-mode so com `CLAUDE_CONFIG_DIR=<cfg>` (a config descartavel). Numa config nova nem o marketplace nem o plugin existem, entao `enable` sozinho falha; instale os dois nela antes (gratis, sem chamada de modelo):

```
CLAUDE_CONFIG_DIR=<cfg> claude plugin marketplace add mksglu/context-mode
CLAUDE_CONFIG_DIR=<cfg> claude plugin install context-mode@context-mode
CLAUDE_CONFIG_DIR=<cfg> claude plugin enable context-mode@context-mode
CLAUDE_CONFIG_DIR=<cfg> claude plugin list
```

O `install` ja deixa o plugin ligado; o `enable` so garante isso. Confira no `plugin list` que `context-mode@context-mode` aparece ligado antes da primeira execucao. A config do dono nao e tocada.

Execucoes (saida em `<work>/runs/1-on.json`, `2-on.json`, `3-on.json`):

```
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/1-on.json
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/2-on.json
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/3-on.json
```

### Com context-mode desligado

Desligue-o em seguida, so com `CLAUDE_CONFIG_DIR=<cfg>`: `CLAUDE_CONFIG_DIR=<cfg> claude plugin disable context-mode@context-mode`.

Execucoes (saida em `<work>/runs/1-off.json`, `2-off.json`, `3-off.json`):

```
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/1-off.json
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/2-off.json
CLAUDE_CONFIG_DIR=<cfg> CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<pedido>" --plugin-dir <repo>/plugins/productivity-tools --model sonnet --permission-mode acceptEdits --allowedTools "Bash(git:*)" "Bash(node:*)" "Workflow(productivity-tools:coordinator-workflow)" --max-budget-usd 0.16 --output-format json > <work>/runs/3-off.json
```

## 3. Resumir (offline)

```
node tools/measure/sonda-e41-ac2b.mjs summarize --work <work> --config <cfg>
```

Imprime a linha de tabela (execucoes, parada `authorize` alcancada, retries de fatia, custo somado). Sai com 0 quando as 6 execucoes chegaram a `authorize` e a soma e ate US$ 1; sai com 1 se uma execucao falhou na leitura ou a soma passou de US$ 1.

## 4. Registro

A linha impressa e registrada em `docs/plans/roadmap-pos-2-3-0/measurements.md` pelo roadmap-tracker, fora deste plano, e conferida pelo dono (H1).
