# Roadmap Evolução pós-2.3.0 do productivity-tools -- pasta de acompanhamento

Acompanhamento vivo do roadmap. Estratégia: `../2026-11-21-roadmap-pos-2-3-0.md`.

## Arquivos
| Arquivo | Natureza |
|---|---|
| `state.md` | Retrato sobrescrito: Agora, painel, bloqueios, pendências, em andamento |
| `decisions.md` | Decisões, só acrescenta |
| `log.md` | Eventos, só acrescenta, mais novo primeiro |
| `critical-path.md` | Grafo de dependências e próximos gates |
| `sources.md` | Inventário de fontes e conflitos |
| `requirements.md` | Requisitos e sua cobertura |
| `measurements.md` | Execuções, custos e marcos de medição |
| `roadmap.config.json` | Caminhos, vocabulário, limites |

## Verificação
Rode `node <pasta-do-roadmap>/check-roadmap.mjs` (Node 18 ou mais novo). Sai com 1 em erros; avisos passam; saída 2 é falha inesperada (`ERROR internal`). Em CI use `--require-git` para que as conferências de git puladas falhem em vez de passar em silêncio.

## Quando atualizar
| Evento | Atualizar |
|---|---|
| Uma decisão é tomada | `decisions.md` primeiro, depois o que a usa |
| Uma peça ou passo fecha | `log.md` e o painel em `state.md` |
| Uma branch é integrada ou removida | "em andamento" em `state.md` e `log.md` |
| Uma execução paga ou medição | `measurements.md` e `log.md` |
| Um bloqueio abre ou fecha | `state.md` e `critical-path.md` |
| Uma peça ou fase termina | propor uma revisão da estratégia |
