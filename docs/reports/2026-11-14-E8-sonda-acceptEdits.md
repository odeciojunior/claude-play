# E8: sonda acceptEdits no sandbox (DEC-503, DEC-709, DEC-717)

Data: 2026-11-14. Commit medido: af782a4, o mesmo do 3º plan-only aprovado, por `--plugin-dir` numa worktree destacada em D:/claude-tr-release. CLI 2.1.325. Variante `completo`, modo `acceptEdits` com as regras exatas do preflight, `--stop-on-denial`, teto de US$ 10, 1 execução sem repetição, sozinha no host (DEC-710). Conduzido pelo orquestrador (DEC-204). É registro de evidência.

## Comando

Regras (`--allow`, lidas do preflight do `completo`): `Bash(node:*)`, `Bash(node *roadmap.mjs" *)`, `Bash(node *run-record.mjs" *)`, `Bash(node *preflight.mjs" *)`, `Bash(node *verify-run.mjs" *)`, `Bash(git:*)`, `Workflow(productivity-tools:release-workflow)`.

`env -u CLAUDE_CONFIG_DIR node tools/measure/run-batch.mjs --variant completo --runs 1 --work D:/claude-e8p-work/completo --out D:/claude-e8p-out --config-dir C:/Users/odeci/.claude --permission-mode acceptEdits <regras> --stop-on-denial --max-budget-usd 10 --plugin-dir D:/claude-tr-release/plugins/productivity-tools`

Resultado do harness: 0 válidas, 0 inválidas, **1 negada** (`permission_denials` não vazio no resultado da sessão).

## O que aconteceu

O preflight rodou na sessão principal e devolveu `errors: []` e `missingRules: []`. O workflow começou E5 e parou no commit da spec: o agente não pôde gravar `D:/claude-e8p-work/completo/completo-1-wt/_tmp/E5-spec-commit.txt` (Write negado). E5 terminou FAILED (infra), sem nenhum commit em feat/E5 nem em release/sandbox, e o relatório do run também foi negado.

## Negações

| Onde | Ferramenta | Alvo | Classe |
|---|---|---|---|
| subagentes do workflow | Write | `<wtRoot>/_tmp/E5-spec-commit.txt`, `<wtRoot>/_tmp/baseline/run.mjs` | pasta fora do diretório da sessão |
| subagentes do workflow | Write | `<wtRoot>/_integracao/docs/reports/2026-11-14-E5-run.md` (relatório) | pasta fora do diretório da sessão |
| subagentes do workflow | Read, Glob | `<wtRoot>/_integracao`, `<wtRoot>/E5` | pasta fora do diretório da sessão |
| subagente do workflow | Read | `D:/claude-tr-release/plugins/productivity-tools/scripts/spec-tool.mjs` | pasta do plugin fora do diretório da sessão |
| sessão principal | Bash | `git ...; ls ...`, `git ...; echo "exit=$?"` (4 a 6 chamadas) | comando composto: a parte `ls`/`echo` não casa com `Bash(git:*)` |

`<wtRoot>` = `D:/claude-e8p-work/completo/completo-1-wt`, a pasta irmã do repositório onde o workflow cria as worktrees (SKILL.md, passo 1).

## Errata (revisão do Fable nas transcrições)

- E5 falhou já no autor do spec: as leituras dele foram negadas, o spec não foi escrito e `spec-load1` deu ENOENT. A negação do Write do commit veio depois.
- Faltam na tabela: `cd <dir> && git ...`, negado até dentro do diretório da sessão ("changes directory before running a version-control command"); atribuição de variável (`R="..."; ...`); 2 chamadas da ferramenta PowerShell pelo agente de baseline; `cd` e `ls` do Bash em wtRoot; `ls; head` do agente do relatório.
- Passou: `git -C <pasta fora da sessão>` sob `Bash(git:*)`.
- `missingRules` veio vazio porque `tools/measure/make-scenario.mjs` grava as regras no `settings.local.json` das variantes run.

## Leitura do executor

1. O `acceptEdits` só aceita edições e leituras dentro do diretório da sessão e das pastas adicionais. O workflow trabalha em `<wtRoot>`, que fica fora do repositório por desenho, e o preflight não pede `additionalDirectories` (ou `--add-dir`) para essa pasta nem para a pasta do plugin. Por isso `missingRules` veio vazio e a execução parou na primeira gravação.
2. A sessão principal (a skill roadmap-release) compõe comandos de verificação com `;` e `echo`, que as regras `Bash(git:*)` não cobrem.
3. Para a pergunta de DEC-312: sem bypass, com as regras que o preflight indica hoje, o `completo` não roda sem perguntar. As duas lacunas são do produto (preflight e texto da skill), não do ambiente.

## Custo

Estimativa pelas transcrições com `prices.json` de 2026-11-10: até US$ 1,00 (haiku 0,02, sonnet 0,30, opus 0,68). O mesmo método deu 1,89 no 3º plan-only, contra 1,44 do harness, então o valor real é menor. O harness não grava o custo de uma tentativa negada. Acumulado do trio de E8: até 5,89 de US$ 20.

## Pastas

Trabalho: `D:/claude-e8p-work/completo/completo-1` e `-wt/{_integracao,E5,_tmp}`. Agregado: `D:/claude-e8p-out/completo-20261114-211957/`. Transcrições: `C:/Users/odeci/.claude/projects/D--claude-e8p-work-completo-completo-1/319ea7aa-89d6-43e6-8c2e-36a4108bc699/` (workflow `wf_e7d5bf92-811`).
