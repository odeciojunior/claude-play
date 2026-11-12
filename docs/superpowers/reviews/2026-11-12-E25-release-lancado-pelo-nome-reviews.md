# E25: release lançado pelo nome, registro de revisões

Execução de 2026-11-12 (branch `feat/E25`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante registrado (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, correção opus | nenhum | 1 | nenhuma |
| plan | 1: opus, -; 2: opus, correção sonnet | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T5:spec | 1: opus, - | nenhum | 1 | nenhuma |
| T5:quality | 1: opus, -; 2: opus, correção sonnet; 3: opus, correção sonnet | nenhum | 1 | nenhuma |
| T6:spec | 1: opus, -; 2: opus, correção opus | nenhum | 0 | nenhuma |
| T6:quality | 1: opus, - | nenhum | 0 | nenhuma |
| final | 1: opus, - | nenhum | 3 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | peça 3 -- recusa sem runToken antes de qualquer agente (critério 2) | DONE | 1 |
| 2 | peça 1 -- aviso da regra do workflow no preflight (critério 1) | DONE | 1 |
| 3 | peças 2 e 4 -- workflow nomeado, lançamento pelo nome com reserva e compatibility (critério 3) | DONE | 1 |
| 4 | peça 4 -- lint exige compatibility com versão (critério 5, parte 1) | DONE | 1 |
| 5 | peça 5 -- concessão por allowed-tools, checagem no lint e frase do CLAUDE.md (critério 5, parte 2; raio de impacto alto) | DONE | 3 |
| 6 | revisão de segurança da peça 5 (somente leitura) | DONE_WITH_CONCERNS | 1 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados)

### Registro "executing" do roadmap
the "executing" roadmap record failed (command 2 (log) is missing from the runs; command 3 (add-decision) is missing from the runs; command 4 (add-decision) is missing from the runs; command 5 (add-decision) is missing from the runs; command 6 (add-decision) is missing from the runs; command 7 (add-decision) is missing from the runs; command 8 (add-decision) is missing from the runs; command 9 (add-decision) is missing from the runs; command 10 (add-decision) is missing from the runs; command 11 (add-decision) is missing from the runs; command 12 (add-decision) is missing from the runs; command 13 (add-decision) is missing from the runs; command 14 (add-decision) is missing from the runs; command 15 (add-decision) is missing from the runs; command 16 (add-decision) is missing from the runs; command 17 (add-decision) is missing from the runs; command 18 (add-decision) is missing from the runs; command 19 (add-decision) is missing from the runs; command 20 (add-decision) is missing from the runs; command 21 (add-decision) is missing from the runs; command 22 (add-pending) is missing from the runs; command 23 (add-pending) is missing from the runs; command 24 (add-pending) is missing from the runs; command 25 (add-pending) is missing from the runs; command 26 (add-pending) is missing from the runs; command 27 (inflight-add) is missing from the runs); decisions and the in-flight entry are not recorded yet

### T2
The first RED run failed on a duplicate identifier in my test code (S already declared), not on the missing exports the plan expected. I fixed the helper name and the suite then ran green. Both the AC1 tests and the implementation exist in the one commit, as the plan prescribes.

### T4
The commit printed a warning that LF will be replaced by CRLF in lint-plugin.test.mjs. This is the normal autocrlf behaviour in this repo and caused no diff. G2, G3 and G4 output was suppressed, so only their exit codes are recorded.

### T5
Two things for the opus reviewer. First, lint-plugin.mjs has mixed line endings (CRLF and LF), so I inserted the new block with the line ending of the surrounding code. Second, the escape-form tests compare the entry as the lint tokenizes it. An allowed-tools value with a space inside the parentheses would split into two entries and FAIL, which is the safe direction.

### T5:quality fix1
The commit warned that LF in lint-plugin.test.mjs will become CRLF, which is only the autocrlf setting. The new check also reports a FAIL for a bare `allowed-tools:` written at column 0 in other contexts, which is intended. The Task 6 security review should confirm that the raw-line guard closes this bypass and that no other uncovered risk remains.

### T5:quality fix2
The allow-list also FAILs a column-0 continuation line of a multi-line plain scalar or flow collection in frontmatter. That is unusual YAML, and the real SKILL.md files pass lint. Task 6 security review should still judge whether any remaining YAML spelling is an uncovered risk under DEC-049 (owner instruction 8). One mid-task slip: a bad sed edit damaged the test file, so I restored it with git checkout and redid the edit with a script before committing.

### T6
I raised no DEC-049 revisit trigger. Four findings go to the orchestrator; the task forbids fixing them here.
- F1 (defeito, important, CONFIRMED by probe): a duplicate top-level `allowed-tools` key in the exception SKILL.md, with the extra entry first, passes the lint. parseFrontmatter keeps the last value. It is exploitable only if Claude Code's YAML parser keeps the first value, which is unverified. Fix: FAIL on any repeated top-level frontmatter key. I recommend doing this in a piece-5 fix round before the merge. If the owner reads it as uncovered risk, piece 5 is held back per owner instruction item 8.
- F2 (defeito, minor): lint-plugin.test.mjs:717 has two String.raw cases identical to an earlier case, so escaped-key coverage is missing from the tests. The guard itself works.
- F3 (fora-do-escopo, pre-existing): the lint does not check commands/*.md, or custom skills/commands paths in plugin.json, for allowed-tools.
- F4 (fora-do-escopo): .claude/agents/plugin-reviewer.md:108 is now stale about allowed-tools.
Residual risk in the injection scenario: the runToken check does not defend against injection. The bounds are the grant's scope (this one workflow, the invoking turn only) and the person's own Bash permission rules, which the workflow's agents still follow in the default mode. `disable-model-invocation: true` would close model invocation; that choice is the owner's. Criteria 4 and 6 stay owner pendings; this task marks neither.

### T6:spec fix1
1) The plan does not call for a commit in Task 6. Task 6 is a read-only security review: "Nenhuma correção é feita nesta tarefa". This commit actually changes piece 5 (Task 5) files, so it belongs to Task 5's review-and-fix cycle (like the earlier "E25 T5: fix" commits), even though its message carries the T6 label the orchestrator asked for. I applied it because it fixes a piece 5 defect inside Task 5's scope and adds no new feature. If the orchestrator counts this as a commit outside the plan, revert 48524fb and redo it as a Task 5 fix. 2) This changes piece 5 (high blast radius, DEC-049). Per owner instruction item 2 it should get an opus task re-review, and the final gate stays at opus high. 3) I did not show that the new tests fail without the fix (no stash allowed). The escape was already confirmed by the earlier reviewer, who read parseFrontmatter.

## Gates

O relatório não traz um campo de gates estruturado. Dados disponíveis:
- Baseline medido no preflight: todos os gates passam; G1 rodou 1314 testes, 0 ignorados.
- Gates citados nos concerns acima: em T4, G2, G3 e G4 tiveram a saída suprimida e só os códigos de saída foram registrados.

## Entradas humanas

Nenhuma entrada humana tem BLQ associado no relatório. Nenhuma é bloqueante.

1. O quê: Criterion 4 (human): after E25 is integrated, the owner checks two consecutive sessions at the pre-grant commit (reachable from release/roadmap-skills-v2) using script A in the spec, and records the permission mode. Never marked met by an agent. Bloqueante: não. Alternativa (workaround): Owner pending; exact steps in the spec section 'Como o dono confere os critérios 4 e 6'.
2. O quê: Criterion 6 (human): after integration, the owner checks a new session with the grant (release/roadmap-skills-v2) using script A and records the permission mode. If piece 5 is not merged, the owner records that it cannot be checked. Bloqueante: não. Alternativa (workaround): Owner pending.
3. O quê: Script B (cache): the owner checks name and grant with the plugin installed from cache in a disposable CLAUDE_CONFIG_DIR; answers the DEC-061 and DEC-049 revisit triggers. Bloqueante: não. Alternativa (workaround): Owner pending; on failure the owner opens the revisit of DEC-061/DEC-049.
4. O quê: Any broader allowed-tools policy (other skills or future workflows such as coordinator-workflow) is the owner's decision; this card fixes the single exception. Bloqueante: não. Alternativa (workaround): nenhuma registrada.
5. O quê: Owner ratification of the autonomous decisions (DEC-030); contract-scope decisions 1 and 5 hold the start of E8. Bloqueante: não. Alternativa (workaround): nenhuma registrada.

## Textos cortados no registro

Um item por texto que o registro do roadmap cortou. Origem = fonte do texto; "entrou em" = onde ele foi gravado cortado; texto completo transcrito abaixo.

### 1. Origem: docs/superpowers/reviews/2026-11-12-E25-release-lancado-pelo-nome-reviews.md; entrou em: add-decision --decision

10. allowed-tools on a single line; lint accepts single line or YAML list, but only in productivity-tools/skills/roadmap-release/SKILL.md and only with the single entry Workflow(productivity-tools:release-workflow), fixed as a lint constant (not derived from workflows), and checks that workflow is registered in plugin.json; it fails allowed-tools in any other skill of any plugin and any other entry, including bare Workflow, wildcards and other workflows of the plugin (local).

### 2. Origem: docs/superpowers/reviews/2026-11-12-E25-release-lancado-pelo-nome-reviews.md; entrou em: add-decision --decision

12. Piece 5 is the last code commit so criterion 4 is checked on the previous commit; owner steps run after integration, using git from the integration worktree D:/projects/claude-play-wt/_integracao, detached disposable worktrees at the pre-grant SHA and at release/roadmap-skills-v2, and the make-sandbox.mjs sandbox in dry-run (local).

## Ressincronização (segunda execução, 2026-11-12)

Esta execução recebeu os mesmos dados de revisão, tarefas, concerns, entradas humanas e textos cortados já registrados acima (sem diferença nas rodadas, nos modelos, nas contagens de menores, nas pendências ou nos riscos aceitos). O que ela acrescenta é o campo de gates, que a execução anterior não tinha. Nada do que a execução anterior registrou foi removido ou reescrito.

### Gates (campo estruturado, transcrito)

| Gate | Saída | Baseline |
|---|---|---|
| G1 | exit 0, total 1347, ignorados 0, falhas [] | exit 0, total 1314, ignorados 0, falhas [] |
| G2 | exit 0 | exit 0 |
| G3 | exit 0 | exit 0 |
| G4 | exit 0 | exit 0 |
| G5 | exit 0 | exit 0 |

Riscos aceitos: nenhum. Falha da execução: nenhuma. Bloqueantes: nenhum em todos os estágios.

### Textos cortados no registro (esta execução)

Os dois itens recebidos (decisão 10 e decisão 12, origem `docs/superpowers/reviews/2026-11-12-E25-release-lancado-pelo-nome-reviews.md`, entrada `add-decision --decision`) são os mesmos já transcritos por inteiro nos itens 1 e 2 da seção "Textos cortados no registro" acima.

## Teste comportamental (orquestrador da sessão principal, DEC-204, DEC-271), 2026-11-12

Executor: subagent sonnet seguindo `roadmap-release/SKILL.md` literalmente sobre o sandbox de `make-sandbox.mjs`, em `dry-run`, até a montagem da chamada do passo 4, sem chamar o Workflow, nos três cenários da spec. Checkout de integração e arquivos de settings sem mudança.

### Avisos do preflight (exit 0; 0 erros, 3 missingRules, 2 avisos, 0 decisões pendentes)

(Transcrito do relatório do testador: os arquivos de `_tmp/E25/` foram apagados antes de serem copiados para cá.)

- missingRules: `Bash(node:*)`, `Bash(node *roadmap.mjs" *)`, `Bash(git:*)` (em dry-run não param).
- Aviso 1: "roadmap cards read from the working tree (release/sandbox has no docs/plans/roadmap-sandbox)".
- Aviso 2: "release workflow: no permission rule covers it, so a run without the interface (claude -p) or a launch outside this skill is denied; to allow it, add to permissions.allow in .claude/settings.local.json: Workflow(productivity-tools:release-workflow)".

### Cenário (a): nome conhecido

(Transcrito do relatório do testador.)

- `name`: `productivity-tools:release-workflow`; sem `scriptPath`.
- Chaves dos argumentos: `mode` ("dry-run", do pedido), `config`, `runToken`, `trackerCli`, `repo`, `roadmap`, `wtRoot`.

### Cenário (b): "workflow not found"

The `Workflow` tool answered that `productivity-tools:release-workflow` was not found. Falling back once to the script path (call-b.json: `scriptPath` = `D:/projects/claude-play-wt/_integracao/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, same args).

Note: this fallback works only without permission prompts, or with the script folder readable (for example `--add-dir <skill folder>/workflow`), because in the default permission mode the plugin cache folder is not readable (DEC-061 limitation). If this call fails too, I will report both literal errors and stop, with no further attempt.


### Cenário (c): negação por permissão

The `Workflow` tool denied the launch of `productivity-tools:release-workflow` by permission. I am not trying the script path and not making any further call. I did not edit any settings file.

To allow it, add this exact rule to `permissions.allow` (for example in `.claude/settings.local.json`):

Workflow(productivity-tools:release-workflow)

Then ask me to run it again. (Preflight in this dry-run also reported missing rules, not blocking in dry-run: Bash(node:*), Bash(node *roadmap.mjs" *), Bash(git:*).)


### Revisão adversarial (sonnet, só leitura): aprovada com ressalvas

- Critério 1: a regra `Workflow(productivity-tools:release-workflow)` aparece nos avisos, idêntica ao modelo de `preflight.mjs`, e não entre as regras ausentes. (a) usa o nome, sem `scriptPath`, com as seis chaves. (b) faz uma única chamada de reserva com `scriptPath` absoluto e cita a limitação de DEC-061. (c) não cai na reserva e mostra a regra exata.
- Baixas, a corrigir no SKILL.md: o passo 4 (linha 39) não diz como distinguir "não encontrado" de "negado" nem o que emitir depois de uma negação; as Regras (pergunta 2) não repetem a exceção de dry-run e plan-only do passo 2; falta a cláusula que pula a pergunta de autorização em dry-run sem ações authorize-external.
- Fora de E25: qual árvore de trabalho guarda o `release.config.json` da resolução do alvo; condições de pulo do passo 3 sobrepostas.
