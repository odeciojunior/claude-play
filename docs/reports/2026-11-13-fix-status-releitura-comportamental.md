# fix/status-releitura: conferência comportamental

Data: 2026-11-13. Branch: `fix/status-releitura` (3e6a6af). Papel: orquestrador (DEC-204), por decisão do dono via Fable (DEC-672). É registro de evidência, não registra aceite.

## Método

- Dados reais: `D:/projects/claude-play-wt/_integracao/docs/plans/roadmap-evolucao-skills` (só leitura, HEAD 7621307).
- CLI do tracker e plugin carregados do worktree do fix (`--plugin-dir`). Sessões `claude -p` com haiku, `bypassPermissions` (só na orquestração e nas medições, DEC-311/312), `--strict-mcp-config` e `--max-budget-usd 0.5`.
- Checagem 1: o prompt de releitura de `E10:status-<palavra>-read` foi montado com as próprias definições do script (regras, `COMMON_SLIM`, `numbered`, `cliCmd`, `BASH_ONLY`); o schema S_RECORD_READ foi pedido no prompt. A própria sessão age como o agente, sem despachar nada. O campo `status` devolvido entra no `recordVerdict` real (via `loadPure`) com a palavra esperada `na-branch`, conferida antes pela CLI.
- Checagem 2: `preflight.mjs discover ... --page 2` montado como em `readDisc`, despachado ao agente `productivity-tools:script-runner` com `runPrompt(cmd)`. O stdout copiado passa pelo `checkRun` real (`release-discovery`, nonce da checagem).

## Resultados

| Checagem | Modelo | Resultado | Evidência |
|---|---|---|---|
| 1. Releitura do registro (E10) | haiku | PASS | 5 comandos na ordem, no Bash; `status` copiado com 852 bytes (direto: 853, diferença só na quebra de linha final), igual em texto e em JSON; `recordVerdict` sem "reread status --json is missing or has no panel" nem "reread panel has no segment of E10"; o controle com `mergeado` reprova. |
| 2. Página 2 da descoberta | haiku → script-runner | PASS | exit 0; stdout de 8178 bytes, igual à execução direta; `checkRun` aceito (página 2/5, 3 cartões). |

## Custos

| Sessão | US$ |
|---|---|
| releitura (haiku) | 0,0084 |
| descoberta página 2 (haiku + script-runner haiku) | 0,0119 |
| **Total** | **≈ 0,020** |

## Leitura

Com `--deliverable E10`, o `status` cai de 16708 para 853 bytes (antes da poda das pendências, o status completo tinha 30.393), bem abaixo do limite de cerca de 30 KB a partir do qual a saída do Bash não chega inteira ao agente. O haiku copiou a saída literalmente e o veredito do registro achou o segmento de E10. Uma página da descoberta, com cerca de 8 KB, também foi copiada literalmente pelo script-runner em haiku na primeira tentativa. Sonnet não foi necessário.

## Limites

- Uma execução por checagem (n=1), sem medir variância.
- O prompt da releitura usa valores de execução plausíveis (`TARGET`, `REPO`, `WT`, `envFacts`), não os de uma execução real do workflow; o schema veio em texto, não como saída estruturada.
- O registro em si (grupo do verify-run) não foi exercitado. A falha "the record agent ran no command" vem desse recorte e é a que o workflow já descarta quando a lista de comandos é vazia.
- Só a página 2 da descoberta foi testada, não as 6 chamadas.
- Com `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, a sessão com subagent em segundo plano emite dois eventos `result`; a resposta válida está no último.
