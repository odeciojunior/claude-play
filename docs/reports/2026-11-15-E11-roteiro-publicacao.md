# E11: roteiro de publicação da 2.0.0 (atos do dono)

Data: 2026-11-15. Tudo abaixo é ato do dono (DEC-007, DEC-036, DEC-311); o executor não deu push, não criou tag e não tocou em `main`.

## Identidade do que se publica

- Branch: `release/roadmap-skills-v2` (worktree `D:/projects/claude-play-wt/_integracao`). A ponta é o commit que traz este roteiro; confira com `git -C D:/projects/claude-play-wt/_integracao log --oneline -1`.
- Árvore do plugin medida no lote de E11: `git rev-parse release/roadmap-skills-v2:plugins` deve dar `41a882a0fe3f15d4cb36dc955571beaa82ae0eb9` (igual a M′ `2b8c56e`). Se der outro valor, não publique: o medido difere do publicado.
- `main` = `origin/main` = `73cd47604eb22c008a6e4092f2efd3297d523efa` (1.7.0); `main` é ancestral da release (fast-forward possível, 524+ commits).
- Versões: productivity-tools 2.0.0, marketplace-tools 1.3.0. Nota: `docs/releases/2026-11-15-productivity-tools-2.0.0.md` (link no README).
- Branch de volta pronta e testada: `volta/productivity-tools-2.0.1` (`7082c60`), relatório `docs/reports/2026-11-15-E11-volta-2.0.1.md`. Só se publica se a 2.0.0 quebrar um projeto em uso.

## Antes

1. Nenhum lote de medição nem execução de entregável deste roadmap rodando (card E11, riscos).
2. Rodar G1 a G5 na ponta (comandos no CLAUDE.md do projeto) e conferir 0 falhas.

## Passos

1. Tag da versão anterior, no commit instalado (critério 5), no formato da tag existente `productivity-tools--v1.6.0` (anotada):
   `git -C D:/projects/claude-play tag -a productivity-tools--v1.7.0 73cd47604eb22c008a6e4092f2efd3297d523efa -m "productivity-tools 1.7.0"`
2. Avançar `main` por fast-forward até a ponta da release (num checkout de `main`): `git merge --ff-only release/roadmap-skills-v2`.
3. Push: `git push origin main` e `git push origin productivity-tools--v1.7.0`. Conferir com `git ls-remote --tags origin` que a tag aponta para `73cd476` (critério 5).
4. Atualizar: `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `claude plugin update marketplace-tools@claude-play`, `/reload-plugins`.
5. Conferir que existem `~/.claude/plugins/cache/claude-play/productivity-tools/2.0.0/` e `.../marketplace-tools/1.3.0/`.
6. Depois: avisar o executor para levar E11 e E26 a `publicado`/`medido` no tracker (`set-status` exige o SHA em `main`).

## Se a 2.0.0 quebrar um projeto em uso

Corrigir adiante (2.0.x) é a primeira escolha. Último caso: avançar `main` até `volta/productivity-tools-2.0.1`, push e atualizar o plugin (DEC-036).

## Limpeza (quando quiser)

Pastas descartáveis de medição: `D:/claude-e11-out*`, `D:/claude-crit6`, `D:/projects/claude-play-wt/_baseline-e11`, `_baseline-b11`, `_sonda*`, `_falha1-*`, e as worktrees `_medicao-e11-release-*`, `e11-*`, `volta-2.0.1` (depois de decidir se a volta fica). Config `D:/claude-e17-cfg`: sair da conta antes de apagar.
