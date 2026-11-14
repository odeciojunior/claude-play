# E8: 2ª sonda acceptEdits no sandbox (DEC-721)

Data: 2026-11-14. Commit medido: c5658cf (release com fix/pasta-wt-permissao, DEC-719/720), por `--plugin-dir` numa worktree destacada em D:/claude-tr-release. CLI 2.1.325. Variante `completo`, modo `acceptEdits` com as regras exatas do preflight, `--stop-on-denial`, teto de US$ 10, 1 execução, sozinha no host (DEC-710). A pasta `<sandbox>-wt` foi criada e concedida pelo `settings.local.json` do cenário (make-scenario), sem `--add-dir`. Conduzido pelo orquestrador (DEC-204). É registro de evidência.

## Comando

Mesmas regras da 1ª sonda (`docs/reports/2026-11-14-E8-sonda-acceptEdits.md`), com `--work D:/claude-e8q-work/completo --out D:/claude-e8q-out`.

Resultado do harness: 1 válida, 0 inválidas, **0 negadas** (`permission_denials` vazio no resultado da sessão).

## Resultado

| Critério de DEC-721 | Resultado | Evidência |
|---|---|---|
| E5 mesclado | atendido | a7005e6 "merge: E5 in release/sandbox", 0 conflitos |
| Sem FAILED | atendido | relatório do run: "merged, not broken" |
| Sem ação de operador por negação | atendido | lista de ações vazia, nenhuma divergência (`verify-run check` ok) |

Gates: unit com exit 0, 16 testes, igual à linha de base. 3 tarefas com revisão, 3 decisões autônomas registradas para ratificar. O preflight rodou com `--wt-root` e não parou (`missingDirs` vazio).

## Negações espontâneas, contornadas pelos agentes

A sessão principal (a skill) não teve nenhuma negação: a regra de comando simples por chamada funcionou. As negações abaixo foram todas em subagentes do workflow, que contornaram e seguiram:

| Estágio | Negações | Alvo | Classe |
|---|---|---|---|
| `E5:spec` | 2 | Grep em `<plugin>/scripts/spec-tool.mjs`; `sed -i` no spec | pasta do plugin fora da sessão; sed com edição exige aprovação |
| `E5:plan` | 2 | Grep em `<plugin>/scripts/plan-tool.mjs`; Grep na pasta-mãe do trabalho | pasta do plugin e pasta-mãe fora da sessão |
| `E5:spec-commit` | 1 | `git ... --quiet ...; echo "EXIT=$?"` | comando composto |
| `E5:progress` | 2 | `node run-record.mjs approve ...; echo "exit=$?"` | comando composto |
| `E5:cleanup` | 10 | PowerShell composto (`Test-Path; git ...; Get-ChildItem`), `Get-Process \| ... ; netstat`, `tasklist`, `netstat -ano` | PowerShell e listagem de processos sem regra |

Efeito observado: a limpeza não conferiu processos nem portas 5200-5209 (o relatório do run diz "incomplete cleanup"). As tarefas T1 e T2 relatam que não puderam mudar o cwd para a worktree e rodaram o teste com caminho absoluto, sem efeito no resultado. T2 tem duas linhas Co-Authored-By no commit.

## Leitura do executor

1. Para DEC-312: com a pasta de worktrees criada antes da sessão e concedida, e as regras do preflight, o `completo` termina em acceptEdits, sem bypass, do spec ao merge. O gatilho de DEC-312 não disparou.
2. Restam negações que não param o run, mas custam turnos e deixam a limpeza incompleta: comandos compostos nos prompts do workflow (`; echo "exit=$?"`), leitura dos scripts na pasta do plugin, `sed -i`, e o estágio de limpeza tentando listar processos por PowerShell e `tasklist`. Todas estão em `roadmap-release.js` ou nos agentes, fora do escopo de DEC-719.

## Custo

| Item | US$ |
|---|---|
| Execução (agentes e sessão principal, harness, `prices.json` de 2026-11-10) | 3,237 |

Chamadas estruturais: haiku 13, sonnet 9, opus 5. Acumulado do trio de E8: até 5,89 + 0,03 (sonda de 1 caso) + 3,24 = 9,16 de US$ 20.

## Pastas

Trabalho: `D:/claude-e8q-work/completo/completo-1` e `-wt/`. Agregado: `D:/claude-e8q-out/completo-20261114-220459/`. Transcrições: `C:/Users/odeci/.claude/projects/D--claude-e8q-work-completo-completo-1/9e3388cd-66ac-4963-b9de-a1b30c45b602/` (workflow `wf_ffdd8f89-da5`).
