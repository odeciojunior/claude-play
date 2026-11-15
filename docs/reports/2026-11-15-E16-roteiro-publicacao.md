# E16: roteiro de publicação da productivity-tools 2.1.0 (ato do dono)

Data: 2026-11-15. Publicar é ato do dono (DEC-007). Este roteiro só descreve; o executor não roda nenhum destes passos sem autorização explícita.

## Estado conferido

- Release `release/roadmap-skills-v2` em `2d16244`; árvore `plugins/` `3d8fda3`, **idêntica** à medida no lote M16 (`a5e8808`, `docs/reports/2026-11-15-E16-lote-M16.md`).
- `main` = `origin/main` = `1017db5` (2.0.0) é ancestral da release: avanço por fast-forward (37 commits).
- Tags no remoto: `productivity-tools--v1.6.0`, `productivity-tools--v1.7.0`. Falta `productivity-tools--v2.0.0` (critério 5 de E16).
- G1 a G5 verdes na release (2174 testes, 0 falhas; validate do marketplace, de productivity-tools e de marketplace-tools; check-roadmap 0 erros; lint 57 OK, 1 WARN preexistente).
- Decisões do executor pendentes: nenhuma (`pending-decisions` vazio; critério 3).
- Branch de volta `volta/productivity-tools-2.1.1` (`557250d`, worktree `D:/projects/claude-play-wt/volta-2.1.1`): conteúdo de `plugins/productivity-tools` e `tools/` igual a `1017db5` salvo a versão (2 linhas); G1 2094 testes, 0 falhas; G2 a G5 verdes (critério 4).
- Nota de atualização: `docs/releases/2026-11-15-productivity-tools-2.1.0.md`, com link no README.

## Passos

1. Tag da versão instalada antes do avanço: `git tag -a productivity-tools--v2.0.0 1017db5 -m "productivity-tools 2.0.0"` e `git push origin productivity-tools--v2.0.0`.
2. Conferir a identidade: `git rev-parse release/roadmap-skills-v2:plugins` deve dar `3d8fda38acc92451dab73a4e3af29e356a93a749`. Se diferir, **não publicar** (medido ≠ publicado).
3. Avançar `main`: `git checkout main && git merge --ff-only release/roadmap-skills-v2`, depois `git push origin main`.
4. Atualizar: `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`.
5. Conferir que `~/.claude/plugins/cache/claude-play/productivity-tools/2.1.0/` existe (critério 2) e que `git ls-remote --tags origin` lista `productivity-tools--v2.0.0` em `1017db5` (critério 5).
6. Tracker, depois da publicação: E16 e E28 `publicado` com o SHA de `main`; E27 `medido`; registrar a publicação no log.

## Se algo quebrar

Corrigir adiante numa 2.1.x. A volta é último caso: publicar `volta/productivity-tools-2.1.1` (conteúdo da 2.0.0) pelos mesmos passos 3 a 5.
