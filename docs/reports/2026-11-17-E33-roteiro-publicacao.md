# E33: roteiro de publicação da productivity-tools 2.3.0

Data: 2026-11-17. Decisões: DEC-031 a DEC-036 (dono via Fable). Nada deste roteiro roda sem o "sim" explícito do dono (DEC-034).

## Estado conferido

| Item | Valor |
|---|---|
| `main` = `origin/main` | `b5812b3bf6630157ae1b53322552d653bb0762e6` (2.2.0) |
| `release/pos-2.2.0` | `ba8983a0a0546b96415022739e029ffb217bf64e` |
| Árvore `plugins` na release | `2750ed6133b64520a9ceb02be3edece0f7e40479` |
| `main` ancestral da release | sim (`merge-base --is-ancestor` saiu 0): o avanço é fast-forward e leva `d7d1c53` |
| Tags no remoto | até `productivity-tools--v2.1.0`; falta `productivity-tools--v2.2.0` (em `b5812b3`) |
| Versão | 2.3.0 em `plugin.json`, na linha do README e no teste de versão |
| Nota | `docs/releases/2026-11-17-productivity-tools-2.3.0.md` |
| Branch de volta | `volta/productivity-tools-2.3.1` em `67a7bfa`: `plugins/productivity-tools` igual a `b5812b3` salvo a versão (2.3.1, `plugin.json` e o teste de versão); `tools` idêntico (`7296043`); G1 a G5 verdes (2175 testes, 0 falhas) |

## Portões na ponta da release

| Gate | Resultado |
|---|---|
| G1 | exit 0: 2204 testes, 2202 pass, 0 falhas, 2 skipped |
| G2 | exit 0, Validation passed |
| G3 | exit 0, Validation passed (aviso `ICON_MISSING` preexistente) |
| G4 | exit 0, 0 erros, 0 avisos |
| G5 | exit 0, 57 OK, 1 WARN (links de `delegation-protocol.md`, preexistente), 0 FAIL |

## Verificações antes da publicação

- **Sonda paga (DEC-033):** plan-only com o plugin 2.3.0; `spec-commit` e `plan-commit` feitos de primeira, `pending` vazio, sem `-commit2`. US$ 1,87.
- **Revisão final opus/high da release contra `main`:** 2 importantes e 5 menores no modo `procs` do `verify-run` e no reuso de commit; corrigidos em `fix/e33-procs-revisao` em três rodadas, cada uma revista de novo; a última sem crítico nem importante. Dois menores ao backlog (ppid reaproveitado como prova de ancestralidade; reuso da spec se o autor commitar).
- **Gasto pago do roadmap:** US$ 24,33 de 40 (`measurements.md`).
- **Decisões pendentes do executor:** nenhuma.

## Diff de produto `main..release` (plugins, tools, README)

24 arquivos, +3842 / −188, dos quais 3006 linhas são a cópia congelada `tools/measure/fixtures/workflow-com-single/roadmap-release.js` (braço `unica` do arnês). Produto: `roadmap-release.js` (59 linhas), `verify-run.mjs` (123), `preflight.mjs` (5), `coordinator.js` (2), `task-reviewer.md`, `plan-author.md`, `roadmap-tracker/SKILL.md`, `config.md`, `plugin.json`; o resto são testes e o arnês.

## Passos que exigem o "sim" do dono (um pedido só)

1. `git -C D:/projects/claude-play tag -a productivity-tools--v2.2.0 b5812b3 -m "productivity-tools 2.2.0"`
2. `git -C D:/projects/claude-play fetch . release/pos-2.2.0:main` (fast-forward; recusa se não for)
3. `git -C D:/projects/claude-play tag -a productivity-tools--v2.3.0 main -m "productivity-tools 2.3.0"`
4. `git -C D:/projects/claude-play push origin main productivity-tools--v2.2.0 productivity-tools--v2.3.0`
5. Na config real: `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, depois `/reload-plugins`.
6. Conferir `~/.claude/plugins/cache/claude-play/productivity-tools/2.3.0/` e `git ls-remote --tags origin`.
7. Fecho do tracker na release (`integrate`, E29/E32/E33 `publicado`, E30/E31 `medido`), fast-forward de `main` de novo e segundo push só de docs. Se o diff desse segundo push tocar `plugins`, `tools` ou `README.md`, para e volta ao dono.

Não se mexe em `origin/release/roadmap-skills-v2`.

## Depois da publicação

1. Conferir a receita de fixar a loja numa tag (S3-01) na config descartável, até US$ 1 da reserva.
2. Aviso ao dono para o logout de `D:\claude-pos22-cfg`; só então a limpeza (config, loja fixa, worktree do lote, sandboxes, branches de desenho e de volta antigas). As transcrições de E30 e E31 ficam.

## Se algo quebrar

Corrigir adiante numa 2.3.x. Em último caso, publicar `volta/productivity-tools-2.3.1` (conteúdo da 2.2.0), ato do dono.
