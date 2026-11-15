# E13: roteiro de publicação da productivity-tools 2.2.0 (ato do dono)

Data: 2026-11-15. Publicar é ato do dono (DEC-007); o executor só roda estes passos com autorização explícita.

## Estado conferido

- Release `release/roadmap-skills-v2`; árvore `plugins/` `775a600d7ad520dfe2a462e0e6ca06cd5d03b3da`, a mesma medida em `3ea2649` (`docs/reports/2026-11-15-E13-medicao-final.md`).
- `main` = `origin/main` = `779bae0` (2.1.0), ancestral da release: avanço por fast-forward.
- Tags no remoto: v1.6.0, v1.7.0, v2.0.0. Falta `productivity-tools--v2.1.0` em `779bae0` (critério 6).
- G1 a G5 verdes na release (2175 testes, 0 falhas; validate; check-roadmap 0 erros; lint 57 OK, 1 WARN preexistente). Teste de independência no plugin inteiro passa (critério 1).
- Decisões do executor pendentes: nenhuma (critério 4).
- Branch de volta `volta/productivity-tools-2.2.1` (`3c63bd5`, worktree `D:/projects/claude-play-wt/volta-2.2.1`): `plugins/productivity-tools` e `tools/` iguais a `779bae0` salvo a versão (2 linhas); G1 2174 testes, 0 falhas; G2 a G5 verdes (critério 5).
- Nota de atualização: `docs/releases/2026-11-15-productivity-tools-2.2.0.md`, com link no README.

## Passos

1. `git tag -a productivity-tools--v2.1.0 779bae0 -m "productivity-tools 2.1.0"` e `git push origin productivity-tools--v2.1.0`.
2. `git rev-parse release/roadmap-skills-v2:plugins` deve dar `775a600d7ad520dfe2a462e0e6ca06cd5d03b3da`; se diferir, não publicar.
3. Avançar `main` por fast-forward até a release e `git push origin main`.
4. `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`.
5. Conferir `~/.claude/plugins/cache/claude-play/productivity-tools/2.2.0/` (critério 3) e `git ls-remote --tags origin` com `productivity-tools--v2.1.0` em `779bae0` (critério 6).
6. Tracker: E13 `publicado` com o SHA de `main`; log da publicação; ratificação final do roadmap.

## Se algo quebrar

Corrigir adiante numa 2.2.x; a volta (`volta/productivity-tools-2.2.1`, conteúdo da 2.1.0) é último caso, pelos passos 3 a 5.
