# E20, critério 5: suíte de gatilho

Execução pelo orquestrador por delegação do dono (DEC-478, DEC-025). Data da execução: 2026-11-12.

## Condições

| Item | Valor |
| --- | --- |
| Ferramenta | `tools/measure/run-trigger.mjs` + `tools/measure/trigger/cases.json` (12 casos x pt/en = 24 execuções por passada) |
| Ponta da release usada | `5b0b35faf63f2768bd176d24a8e0aee2c1a94f04` (release/roadmap-skills-v2) |
| Commit do plugin | `12f0efc77d6d4ad26746acde43b2ff98dd7fb879` (último commit que toca `plugins/productivity-tools`), versão 1.7.0 no plugin.json |
| Carga do plugin | `--plugin-dir` apontando para `plugins/productivity-tools` do worktree; o `init` mostra `productivity-tools@inline` nesse caminho, com `plan-writer` e `spec-writer` na lista de skills; a cópia 1.7.0 instalada (sem as duas skills) não aparece |
| CLI | Claude Code 2.1.323 |
| Configuração | `CLAUDE_CONFIG_DIR=D:\claude-e17-cfg` (conta descartável já logada); sem `model` nas settings |
| superpowers | habilitado em todas as 48 execuções (superpowers 7.0.2, `superpowers@claude-plugins-official`) |
| Outros plugins ativos | feature-dev, claude-md-management, learning-output-style, playwright, mcp-sql-server, sql-server-tools |
| Sandbox | repositório git vazio por caso, fora do repositório; `--max-turns 2` |

Passadas:

- **Passada 1**: modelo padrão da configuração descartável, que resolveu para `claude-haiku-5-5`. É a execução da ferramenta como está.
- **Passada 2**: `ANTHROPIC_MODEL=claude-opus-5-5`, o modelo das sessões do dono. A ferramenta não tem opção de modelo; a variável de ambiente foi passada pelo processo que chamou a ferramenta, sem mudar o executor.

## Custo

| Etapa | Execuções | Custo (US$) |
| --- | --- | --- |
| Sonda haiku (plan-1 pt) | 1 | 0,0065 |
| Passada 1 (haiku) | 24 | 0,1573 |
| Sonda opus (spec-3 en) | 1 | 0,2102 |
| Passada 2 (opus) | 24 | 5,6644 |
| **Total** | 50 | **6,0384** |

Projeções das sondas: 0,16 (haiku) e 5,04 (opus) por passada, ambas abaixo do teto de US$ 10. Custo lido de `total_cost_usd` do evento `result` de cada transcrição.

## Correção do executor

A sonda mostrou o executor quebrado: `claude -p` sai com código 1 quando bate `--max-turns` (`result` com `subtype: error_max_turns`), e esse é o fim normal de um caso que chamou a skill no primeiro turno. O executor contava todo código diferente de zero como ERROR, então todo acerto virava erro. A correção, em `tools/measure/run-trigger.mjs`, aceita código 1 quando o último `result` é `error_max_turns`. Coberta pelo teste novo em `run-trigger.test.mjs`. Qualquer outro código diferente de zero continua contando como erro.

## Resultados por caso

"-" = nenhuma chamada à ferramenta Skill dentro dos 2 turnos.

| id | lang | esperado | obtido, passada 1 (haiku) | ok | obtido, passada 2 (opus) | ok |
| --- | --- | --- | --- | --- | --- | --- |
| spec-1 | pt | spec-writer | superpowers:brainstorming | não | spec-writer | sim |
| spec-1 | en | spec-writer | spec-writer | sim | spec-writer | sim |
| spec-2 | pt | spec-writer | spec-writer | sim | spec-writer | sim |
| spec-2 | en | spec-writer | spec-writer | sim | spec-writer | sim |
| spec-3 | pt | spec-writer | - | não | - | não |
| spec-3 | en | spec-writer | - | não | - | não |
| plan-1 | pt | plan-writer | plan-writer | sim | plan-writer | sim |
| plan-1 | en | plan-writer | - | não | plan-writer | sim |
| plan-2 | pt | plan-writer | plan-writer | sim | - | não |
| plan-2 | en | plan-writer | - | não | plan-writer | sim |
| plan-3 | pt | plan-writer | plan-writer | sim | plan-writer | sim |
| plan-3 | en | plan-writer | plan-writer | sim | plan-writer | sim |
| roadmap-1 | pt | roadmap-planner | roadmap-planner | sim | roadmap-planner | sim |
| roadmap-1 | en | roadmap-planner | roadmap-planner | sim | roadmap-planner | sim |
| roadmap-2 | pt | roadmap-planner | roadmap-planner | sim | roadmap-planner | sim |
| roadmap-2 | en | roadmap-planner | roadmap-planner | sim | roadmap-planner | sim |
| roadmap-3 | pt | roadmap-planner | - | não | roadmap-planner | sim |
| roadmap-3 | en | roadmap-planner | roadmap-planner | sim | roadmap-planner | sim |
| plan-execution-1 | pt | plan-coordinator | superpowers:subagent-driven-development | não | superpowers:subagent-driven-development | não |
| plan-execution-1 | en | plan-coordinator | superpowers:subagent-driven-development | não | superpowers:subagent-driven-development | não |
| plan-execution-2 | pt | plan-coordinator | plan-coordinator | sim | plan-coordinator | sim |
| plan-execution-2 | en | plan-coordinator | plan-coordinator | sim | plan-coordinator | sim |
| plan-execution-3 | pt | plan-coordinator | plan-coordinator | sim | plan-coordinator | sim |
| plan-execution-3 | en | plan-coordinator | - | não | plan-coordinator | sim |

Os nomes sem prefixo são `productivity-tools:<skill>`.

| categoria | passada 1 (haiku) | passada 2 (opus) |
| --- | --- | --- |
| spec | 3/6 | 4/6 |
| plan | 4/6 | 5/6 |
| roadmap | 5/6 | 6/6 |
| plan-execution | 3/6 | 4/6 |
| **total** | **15/24** | **19/24** |

Nenhuma execução deu ERROR nas duas passadas.

## Falhas e causa provável

- **Rota errada para o superpowers (válida)**: plan-execution-1 vai para `superpowers:subagent-driven-development` nas duas línguas e nos dois modelos. O pedido diz "com subagentes" e o caminho do plano fica em `docs/superpowers/plans/`, e as duas coisas puxam para a skill do superpowers. É a única rota errada estável. Na passada 1, spec-1 pt foi para `superpowers:brainstorming`, mas no opus acertou.
- **Sem skill em 2 turnos (inconclusivo)**: em todas as falhas "-", o modelo primeiro procura no sandbox os arquivos que o pedido cita (Glob, Bash `ls`/`git log`), e `--max-turns 2` corta a sessão antes de qualquer chamada à skill. O sandbox é um repositório vazio, sem o card, a spec ou o plano citados. spec-3 (pede a spec "a partir do card do roadmap") falha assim nos dois modelos. Em plan-2 pt no opus, o modelo encerrou pedindo a spec, que não existe no sandbox. Esses casos medem o desenho da suíte (sandbox vazio, 2 turnos), não uma confusão entre skills.
- **Nenhuma confusão entre as skills do plugin**: em nenhuma das 48 execuções um pedido foi para outra skill de `productivity-tools`. Os pares do card (plan-1/roadmap-1 e plan-2/plan-execution-1) não trocaram de rota entre `plan-writer`, `roadmap-planner` e `plan-coordinator`. Esse era o risco do card.

## Itens inválidos ou com ressalva

- Passada 1 em haiku: é o padrão da conta descartável, não o modelo de uso do dono. Serve como limite inferior.
- Os 6 "-" da passada 1 e os 3 da passada 2 são inconclusivos, não falhas de rota, pelo motivo acima.
- `superpowers` habilitado em todas as execuções. A suíte não mediu a sessão com ele desligado.
