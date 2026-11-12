# E17: saída dos gates em M

Data: 2026-11-12. Branch: `feat/E17`. Commit de versão `M`: `e38cb355de668a334193bd46d783d6f0e6313d5f` (`E17 T5: chore(release): productivity-tools 1.7.0 e marketplace-tools 1.2.0`).

- SHA completa de `M`: `e38cb355de668a334193bd46d783d6f0e6313d5f`
- Árvore do plugin: `git rev-parse M:plugins/productivity-tools` = `214fb3b50c164094e5eb1c6e18344d7b0bc62e3c`

Os gates rodaram com `HEAD` em `M`, na worktree `<worktree E17>`, antes de qualquer commit posterior.

## Gates canônicos

| Gate | Comando | Exit | Resumo |
|---|---|---|---|
| G1 | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` | 0 | `# tests 1405`, `# pass 1404`, `# fail 0`, `# skipped 0`, `# cancelled 0`, `# todo 1` |
| G2 | `claude plugin validate .` | 0 | `✔ Validation passed` |
| G3 | `claude plugin validate plugins/productivity-tools` | 0 | `✔ Validation passed` |
| G4 | `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` | 0 | `check-roadmap: 0 error(s), 0 warning(s)` |
| G5 | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` | 0 | `Result: 44 OK, 0 WARN, 0 FAIL` |

## Extras (plugin `marketplace-tools` alterado na Tarefa 5)

| Extra | Comando | Exit | Resumo |
|---|---|---|---|
| X1 | `claude plugin validate plugins/marketplace-tools` | 0 | `✔ Validation passed` |
| X2 | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools` | 0 | `Result: 14 OK, 0 WARN, 0 FAIL` |

## Observações

- G1 tem 1405 testes contra a linha de base de 1375 do alvo. A diferença vem dos testes acrescentados nas Tarefas 1 a 5 deste plano; não há falha nem teste pulado.
- Nenhum gate falhou em `M`. Nenhuma falha foi classificada como pré-existente.
