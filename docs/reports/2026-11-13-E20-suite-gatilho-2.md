# E20, critério 5: suíte de gatilho, 2ª passada opus

Execução pelo orquestrador por delegação do dono (DEC-581). Data da execução: 2026-11-12. Primeira passada: [2026-11-13-E20-suite-gatilho.md](2026-11-13-E20-suite-gatilho.md).

## Condições

| Item | Valor |
| --- | --- |
| Ferramenta | `tools/measure/run-trigger.mjs` + `tools/measure/trigger/cases.json` (12 casos x pt/en = 24 execuções), com fixtures por caso semeadas no sandbox e `--max-turns 3` (DEC-580) |
| Ponta da release usada | `11fb81007525e5f3f7e25864c9c0bf79b9336f78` (release/roadmap-skills-v2), worktree em `chore/E20-gatilho-2` |
| Commit do plugin | `12f0efc77d6d4ad26746acde43b2ff98dd7fb879` (último commit que toca `plugins/productivity-tools`), versão 1.7.0 no plugin.json |
| Carga do plugin | `--plugin-dir` apontando para `plugins/productivity-tools` do worktree; o `init` de todas as 26 execuções mostra esse caminho |
| CLI | Claude Code 2.1.323 |
| Modelo | `ANTHROPIC_MODEL=claude-opus-5-5`; o `init` de todas as execuções mostra `claude-opus-5-5`. Haiku não rodou |
| Configuração | `CLAUDE_CONFIG_DIR=D:\claude-e17-cfg` (conta descartável já logada). Essa configuração tem um `CLAUDE.md` de usuário (de 2026-11-08, anterior às duas passadas) com regras de roteamento de modelo |
| superpowers | habilitado em todas as execuções |
| Sandbox | repositório git por caso, fora do repositório, com os arquivos listados em `fixtures` do caso |

O executor não grava transcrições nem custo. Um script de apoio, fora do repositório, chamou `runTrigger` com um `spawn` que salva o stream-json de cada execução, sem mudar o executor. O custo vem de `total_cost_usd` do evento `result` de cada transcrição.

## Custo

| Etapa | Execuções | Custo (US$) |
| --- | --- | --- |
| Sonda opus (spec-3 en, roadmap-1 en) | 2 | 0,6203 |
| Passada opus completa | 24 | 6,4229 |
| **Total** | 26 | **7,0432** |

Projeção da sonda: 0,31 por execução, 7,44 por passada, 8,06 com a sonda, abaixo do teto de US$ 10. Por isso a passada rodou com os 3 turnos do executor, sem cair para `--max-turns 2` (o executor nem aceita essa opção). O script de apoio parava de abrir execuções novas ao passar de US$ 8,75 acumulados; o limite não foi atingido.

## Resultados por caso

"-" = nenhuma chamada à ferramenta Skill dentro dos 3 turnos (inconclusivo). Os nomes sem prefixo são `productivity-tools:<skill>`.

| id | lang | esperado | obtido | resultado | 1ª passada opus |
| --- | --- | --- | --- | --- | --- |
| spec-1 | pt | spec-writer | spec-writer | acerto | acerto |
| spec-1 | en | spec-writer | spec-writer | acerto | acerto |
| spec-2 | pt | spec-writer | spec-writer | acerto | acerto |
| spec-2 | en | spec-writer | spec-writer | acerto | acerto |
| spec-3 | pt | spec-writer | - | inconclusivo | - |
| spec-3 | en | spec-writer | - | inconclusivo | - |
| plan-1 | pt | plan-writer | plan-writer | acerto | acerto |
| plan-1 | en | plan-writer | plan-writer | acerto | acerto |
| plan-2 | pt | plan-writer | plan-writer | acerto | - |
| plan-2 | en | plan-writer | plan-writer | acerto | acerto |
| plan-3 | pt | plan-writer | plan-writer | acerto | acerto |
| plan-3 | en | plan-writer | plan-writer | acerto | acerto |
| roadmap-1 | pt | roadmap-planner | roadmap-planner | acerto | acerto |
| roadmap-1 | en | roadmap-planner | roadmap-planner | acerto | acerto |
| roadmap-2 | pt | roadmap-planner | roadmap-planner | acerto | acerto |
| roadmap-2 | en | roadmap-planner | roadmap-planner | acerto | acerto |
| roadmap-3 | pt | roadmap-planner | roadmap-planner | acerto | acerto |
| roadmap-3 | en | roadmap-planner | roadmap-planner | acerto | acerto |
| plan-execution-1 | pt | plan-coordinator | plan-coordinator | acerto | erro (superpowers:subagent-driven-development) |
| plan-execution-1 | en | plan-coordinator | plan-coordinator | acerto | erro (superpowers:subagent-driven-development) |
| plan-execution-2 | pt | plan-coordinator | plan-coordinator | acerto | acerto |
| plan-execution-2 | en | plan-coordinator | plan-coordinator | acerto | acerto |
| plan-execution-3 | pt | plan-coordinator | plan-coordinator | acerto | acerto |
| plan-execution-3 | en | plan-coordinator | plan-coordinator | acerto | acerto |

Sonda: spec-3 en deu "-" e roadmap-1 en acertou, igual à passada.

| categoria | 1ª passada opus | 2ª passada opus |
| --- | --- | --- |
| spec | 4/6 | 4/6 (2 inconclusivos) |
| plan | 5/6 | 6/6 |
| roadmap | 6/6 | 6/6 |
| plan-execution | 4/6 | 6/6 |
| **total** | **19/24** | **22/24** |

Acertos 22, erros 0, inconclusivos 2. Nenhuma execução deu ERROR.

## plan-execution-1

Com o caso corrigido (DEC-580: cita `docs/plans/text-utilities/plan.md`, que agora existe no sandbox), plan-execution-1 vai para `productivity-tools:plan-coordinator` em pt e em en, já no primeiro turno. A condição de revisão de DEC-580 (seguir indo para `subagent-driven-development` nas duas línguas) não se cumpriu; a descrição do plan-coordinator não precisa mudar.

## spec-3 e rota estável

spec-3 não chama a ferramenta Skill nas duas línguas. Nas duas, o modelo lê os três arquivos do roadmap semeados (Glob e três Read) e depois chama o subagente `productivity-tools:spec-author`, o agente do próprio plugin para escrever spec a partir de um card, com `model: opus`. Ele justifica a delegação pelas regras de roteamento de modelo do `CLAUDE.md` da configuração descartável. A spec segue no fluxo do plugin; o que não aparece é a skill `spec-writer`.

Pela regra do relatório, sem chamada a skill o caso é inconclusivo, não erro. Mas o padrão é estável nas duas línguas e se repete na sonda, então não vem do corte de turnos. Duas leituras possíveis, que esta passada não separa:

- o `CLAUDE.md` da configuração descartável empurra para um subagente, e numa sessão sem essas regras a skill seria chamada;
- para um pedido "a partir do card do roadmap", o modelo prefere o agente `spec-author` à skill `spec-writer`.

Separar as duas pede uma execução de spec-3 com uma configuração sem `CLAUDE.md` de usuário, ou a suíte contar a chamada ao agente `spec-author` como rota do plugin. Fica registrado como ressalva, não como rota errada para fora do plugin.

Nenhuma rota errada estável (as duas línguas em opus) para skill diferente da esperada. Nenhum pedido foi para outra skill de `productivity-tools` nem para o superpowers.

## Ressalvas

- Os 3 turnos e os arquivos no sandbox mudaram todos os casos em relação à 1ª passada; a comparação 19/24 contra 22/24 mistura o efeito das correções de DEC-580 com o da variação natural do modelo.
- O `CLAUDE.md` de usuário da configuração descartável estava presente nas duas passadas, mas a 1ª passada não o registrou.
- `superpowers` habilitado em todas as execuções; a suíte não mediu a sessão com ele desligado.
- Uma passada por modelo, sem repetição: um acerto isolado não mede a taxa.
