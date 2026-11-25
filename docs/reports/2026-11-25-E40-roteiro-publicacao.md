# E40: roteiro de publicação da productivity-tools 2.6.0

Data: 2026-11-25. Nada deste roteiro roda sem o "sim" explícito do dono (CLAUDE.md do projeto: push e tag exigem autorização).

## Estado conferido

| Item | Valor |
|---|---|
| `origin/main` | `1d33060` |
| `main` local | `1a7c102` (à frente de `origin/main`, por fast-forward, sem push) |
| `release/pos-2.3.0` | `71af860` |
| Árvore `plugins` na release | `fd15aed` |
| `main` ancestral da release | sim: o avanço é fast-forward |
| Tags no remoto | até `productivity-tools--v2.5.0` (em `6abab96`, ancestral da release) |
| Versão | 2.6.0 em `plugin.json`, na linha do README e no teste de versão (`flow.test.mjs`) |
| `check-roadmap.mjs` | sem mudança desde a 2.5.0, linha 1 continua `check-roadmap 1.7.0 format 1` (DEC-042) |
| Nota | `docs/releases/2026-11-25-productivity-tools-2.6.0.md` |
| Branch de volta | `volta/productivity-tools-2.6.1` em `9269ba0`, a partir de `productivity-tools--v2.5.0`: conteúdo da 2.5.0 com a versão 2.6.1 (`plugin.json`, README, teste de versão) e a correção do teste da sonda E41 |

## Portões

| Gate | Ponta da release | Branch de volta |
|---|---|---|
| G1 | exit 0: 2616 testes, 2614 pass, 0 falhas, 2 skipped | exit 0: 2533 testes, 2531 pass, 0 falhas, 2 skipped (depois da correção abaixo) |
| G2 | exit 0, Validation passed | exit 0, Validation passed |
| G3 | exit 0, Validation passed (aviso de diretório preexistente) | exit 0, idem |
| G4 | exit 0, 0 erros, 0 avisos | exit 0, 0 erros, 0 avisos |
| G5 | exit 0, 57 OK, 0 WARN, 0 FAIL | exit 0, 57 OK, 0 WARN, 0 FAIL |

O primeiro G1 da branch de volta deu 1 falha: `tools/measure/sonda-e41-ac2b.test.mjs` dividia o roteiro por `\n`, e a worktree nova sai com CRLF (`core.autocrlf=true`). Com o arquivo em LF o teste passa 6 de 6. O teste passou a normalizar CRLF nas duas branches (`71af860` na release, `9269ba0` na volta); depois da correção o G1 da volta ficou verde.

## Verificações antes da publicação

- **Revisão final opus/high da release contra `main`:** aprovada com ressalvas, sem crítico. Um achado importante (retomada `finish-merge` ignora `removedTests` no test-integrity) ficou registrado na nota em "Ainda em aberto", com o contorno `acceptIntegrityAlerts`; os nits de redação da nota foram corrigidos (`01ea9a0`). Orçamentos conferidos: `roadmap-release.js` 266.001 de 266.673 caracteres LF (DEC-057), `coordinator.js` 88.704, `embed.mjs --check` exit 0 nos 4 alvos.
- **Lotes pagos do roadmap:** US$ 25,54 de 30 em `measurements.md` (E41 0,39, E35 8,31, E37 2,18, E39 14,65).
- **E39:** 2 válidas integradas, AC1 e AC2 aceitos com ressalva pelo Fable (DEC-060, limites provisórios).

## Diff de produto `main..release` (plugins, tools, README)

27 arquivos, +1613 / −104: E36 (`removedTests`, `test-extract removed`), E37 (`--no-spec`, blob no pulo de revisão, recusas, agentes), correções do E39 (`capture.mjs` slice curto, `--brief`, `line.json`, `pairs`; fallback do test-first em `roadmap-release.js`; `implementer.md`), o prompt do `--stage` no arnês e testes.

## Passos que exigem o "sim" do dono (um pedido só)

1. `git -C D:/projects/claude-play fetch . release/pos-2.3.0:main` (fast-forward; recusa se não for)
2. `git -C D:/projects/claude-play tag -a productivity-tools--v2.6.0 main -m "productivity-tools 2.6.0"`
3. `git -C D:/projects/claude-play push origin main productivity-tools--v2.6.0 volta/productivity-tools-2.6.1`
4. Na config real: `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, depois `/reload-plugins`.
5. Conferir `~/.claude/plugins/cache/claude-play/productivity-tools/2.6.0/` e `git ls-remote --tags origin`.
6. Fecho do tracker na release (integração, E40 e entregáveis publicados), fast-forward de `main` de novo e segundo push só de docs. Se o diff desse segundo push tocar `plugins`, `tools` ou `README.md`, para e volta ao dono.

## Depois da publicação

1. Prova forte de S3-01 (B13): loja fixada na tag `productivity-tools--v2.6.0` numa config descartável, com `main` em outro commit (o segundo push de docs), conferindo que o cache instala 2.6.0 da tag.
2. Limpeza (B25): as pastas `D:/claude-e3x-out` dos três lotes do pós-2.2.0; as transcrições do E39 ficam em `D:/claude-e39-out` (evidência do relatório).
3. Logout de `D:/claude-pos23-cfg` por sessão interativa delegada (subagent opus, regra do dono de 2026-11-12) e só então apagar a pasta, a worktree `D:/claude-pos23-release` e as pastas de trabalho `D:/claude-e3*-work-*`.

## Se algo quebrar

Corrigir adiante numa 2.6.x. Em último caso, publicar `volta/productivity-tools-2.6.1` (conteúdo da 2.5.0), ato do dono.
