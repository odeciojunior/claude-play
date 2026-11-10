# Roadmap de evolução das skills -- pasta de acompanhamento

Acompanhamento vivo do roadmap. Estratégia: `../2026-11-10-roadmap-evolucao-skills.md`.

## Arquivos

| Arquivo | Natureza |
|---|---|
| `state.md` | Retrato sobrescrito: Agora, painel, bloqueios, pendentes, em andamento |
| `decisions.md` | Decisões, só acréscimo |
| `log.md` | Eventos, só acréscimo, mais recente primeiro |
| `critical-path.md` | Grafo de dependências e próximos portões |
| `sources.md` | Inventário de fontes e conflitos |
| `requirements.md` | Requisitos e sua cobertura |
| `measurements.md` | Execuções pagas e medições |
| `roadmap.config.json` | Caminhos, vocabulário, limites |
| `check-roadmap.mjs` | Cópia do checker |

## Checagem

Rode `node docs/plans/roadmap-evolucao-skills/check-roadmap.mjs` (Node 18 ou mais novo). Saída 1 com erros; avisos passam; saída 2 é falha inesperada (`ERROR internal`). Em CI, acrescente `--require-git` para que checagens de git puladas falhem em vez de passar em silêncio.

## Quando atualizar

| Evento | Atualizar |
|---|---|
| Uma decisão é tomada | `decisions.md` primeiro, depois o que a usa |
| Uma peça ou passo fecha | `log.md` e o painel em `state.md` |
| Uma branch é integrada ou removida | "em andamento" em `state.md` e `log.md` |
| Uma execução paga ou medição | `measurements.md` e `log.md` |
| Um bloqueio abre ou fecha | `state.md` e `critical-path.md` |
| Uma peça ou fase termina | propor uma revisão da estratégia |

As atualizações são feitas pela skill `roadmap-tracker`.
