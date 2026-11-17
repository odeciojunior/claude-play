# Nota de atualização: productivity-tools 2.3.0

Data: 2026-11-17. Sobre a 2.2.0. Traz **uma mudança incompatível de configuração** (`taskReview.single`) e correções no `release-workflow`. Formato de plano e de estado não mudam.

## Mudança incompatível: `taskReview.single` removida

A chave `taskReview.single` do `release.config.json` foi removida (E29, cumprindo o que a nota da 2.2.0 anunciava). A revisão por tarefa sempre roda os laços de spec e de quality. O preflight recusa qualquer valor dessa chave, `true` ou `false`, com a mensagem:

`taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json`

**O que fazer:** apagar a chave `single` de `taskReview` no `release.config.json` de cada roadmap. `taskReview.restricted` continua valendo.

## O que muda

- **E32, modo `procs` do `verify-run`.** Lista e encerra os processos do entregável; a limpeza do release passa a usá-lo.
- **E32, correções menores.** O `plan-coordinator` marca a revisão de passo retomado; o `plan-author` descreve o emit enxuto; o `roadmap-tracker` cita `status --deliverable`.
- **E31, cargas da spec e commits.** O `release-workflow` confere o código de saída das cargas da spec contra a saída e confere no git o commit da spec e do plano (repete em sonnet quando o commit está pendente). Isso evita correções em opus por achado sintético, sobretudo na retomada.

## Medição sem mudança de produto

- **E30, revisor por tarefa.** Nas sementes medidas, o revisor opus capturou 28 de 40 contra 20 de 40 do sonnet. Pela decisão do dono, a troca do revisor fica para um roadmap futuro, com spec própria: nada muda nesta versão. O laço quality foi mantido (resultado inconclusivo para retirá-lo).

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Antes, apague `taskReview.single` dos `release.config.json`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.3.0/` existe.

## Se algo quebrar

Prefira corrigir adiante numa 2.3.x. Para reverter, a branch `volta/productivity-tools-2.3.1` (conteúdo da 2.2.0, republicado como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
