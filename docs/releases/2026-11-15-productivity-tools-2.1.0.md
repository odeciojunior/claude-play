# Nota de atualização: productivity-tools 2.1.0

Data: 2026-11-15. Versão de correção e de uma chave nova opcional sobre a 2.0.0. Não muda formato de plano nem de estado: atualizar não exige migração. Quem ainda está na 1.7.0 lê antes a [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md).

## O que muda no que você vê

- **Base de testes vermelha ou vazia para o coordinator.** Ao iniciar, o `plan-coordinator` mede a base de testes. Se o comando de teste sai com erro, roda 0 testes ou passa 0 testes, a execução para antes de despachar qualquer passo e pergunta: corrija o comando de teste, ou responda `unblock` para aceitar essa base. Antes, uma base assim seguia e os portões finais não tinham com o que comparar. Executores de teste cuja saída não tem a linha de resumo do `node:test` seguem como antes quando saem com 0.
- **Implementadores na worktree.** O implementador recebe a worktree do entregável como diretório de trabalho e roda todo comando com caminho absoluto ou `git -C`. Na 2.0.0, a maioria começava no repositório principal e errava o primeiro teste por caminho relativo.
- **Referências de SHA.** `targetHead`, `mergeCommit` e as cabeças devolvidas por agente no `roadmap-release` só valem como SHA completo (40 ou 64 hexadecimais). Uma referência cortada ou corrompida para o release antes dos portões, em vez de seguir com um commit errado.

## Chave nova, desligada

- `taskReview.single` no `release.config.json`: revisão única por tarefa (um laço `review` que julga spec e qualidade numa chamada), em vez dos dois laços `spec` e `quality`. **Fica desligada por padrão e não é recomendada:** na medição de 2026-11-15 ela pegou menos defeitos de spec e custou mais por tarefa que os dois laços (DEC-773). Combina com `taskReview.restricted`.

## Ainda não corrigido

- **Limpeza de processos.** Nenhuma regra do preflight cobre o comando que encerra processos; confira processos que sobrarem depois de uma execução (DEC-751).

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.1.0/` existe.

Se algo quebrar: o caminho preferido é corrigir adiante numa 2.1.x; a volta (conteúdo da 2.0.0 publicado como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
