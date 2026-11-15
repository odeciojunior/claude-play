# Nota de atualização: productivity-tools 2.2.0

Data: 2026-11-15. Versão de fechamento sobre a 2.1.0. Não muda comportamento para quem usa o plugin, não muda formato de plano nem de estado: atualizar não exige migração.

## O que muda

- **Independência provada por teste.** Um teste percorre todos os arquivos do plugin (skills, agentes, workflows, scripts, referências e `plugin.json`) e falha se algum, fora dos testes, citar `superpowers`. A lista de exceções para documentos de crédito existe e está vazia (DEC-019).
- **Exemplo de caminho corrigido.** Em `skills/roadmap-release/references/operator.md`, o exemplo de `git show` usava um caminho do layout antigo; agora usa `docs/reports/2026-01-01-E1-run.md`. É só texto de exemplo.
- **Diagramas.** `docs/diagrams/repo-architecture.md` e `.excalidraw` mostram o `productivity-tools` com as 11 skills (incluindo `spec-writer`, `plan-writer` e `roadmap-release`), os 7 agentes e os 2 workflows registrados.

## Sem mudança

- `taskReview.single` continua desligada por padrão e será removida numa versão futura (DEC-776).

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.2.0/` existe.

## Se algo quebrar

Como a 2.2.0 não muda comportamento, o caminho preferido é corrigir adiante numa 2.2.x. A volta para a 2.1.0 (republicar o conteúdo dela como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
