# Nota de atualização: productivity-tools 2.0.0 e marketplace-tools 1.3.0

Data: 2026-11-15. Para quem instalou o plugin pelo marketplace do GitHub (`claude plugin install productivity-tools@claude-play`). A 2.0.0 é uma versão de quebra: muda os formatos de plano e de estado. Leia "Antes de atualizar" antes de rodar `claude plugin update`.

## O que muda (quebras)

- **Plano com bloco de dados.** O `plan-coordinator` e o `roadmap-release` só aceitam plano com bloco `plan/1`. Plano sem o bloco é recusado (`plan-no-data-block`). O spec equivalente é o bloco `spec/1`.
- **Onde ficam spec e plano.** `docs/plans/<topic>/spec.md` e `docs/plans/<topic>/plan.md`. O coordinator não procura mais planos em `docs/superpowers/plans/` nem em arquivos soltos `docs/plans/*-plan.md`. Os artefatos de um entregável do `roadmap-release` ficam em `docs/plans/<slug>-<E>/`.
- **Estado do coordinator.** O estado agora é `docs/plans/<topic>/progress.json` (esquema `progress/1`), escrito só pelo script `progress.mjs`; os briefs dos passos ficam em `briefs/T<n>.md` na mesma pasta. O `progress-*.md` deixou de existir (o modelo `progress-template.md` foi removido). Estado em Markdown da 1.7.0 não é lido: não há migração automática.
- **Coordinator e release como workflow.** O loop do coordinator virou o workflow `productivity-tools:coordinator-workflow`, chamado pelo nome pela skill; o release segue como `productivity-tools:release-workflow`. Os dois ficam registrados no `plugin.json`.
- **Skills novas:** `spec-writer` (spec de uma mudança fora de um roadmap: uma rodada de até cinco perguntas, uma aprovação) e `plan-writer` (plano a partir de um spec, ou adoção de plano antigo). Nenhuma skill foi removida.
- **Agentes novos (internos aos fluxos):** `spec-author`, `plan-author`, `implementer`, `task-reviewer`, `final-reviewer`, `test-integrity`, `script-runner`.
- **Chaves novas, opcionais, no `release.config.json`:** `taskReview` (`restricted`) e `finalReview` (`adversarial`, `singleWave`). Todas desligadas por padrão. O preflight recusa outros valores ou chaves nesses objetos. O preflight também ganhou `--wt-root` e o aviso `missingDirs`: a pasta das worktrees do release precisa existir e estar em `permissions.additionalDirectories`, senão o release para antes de rodar.
- **Claude Code mínimo para lançar por nome:** 2.1.322 (campo `compatibility` do `plan-coordinator` e do `roadmap-release`). Em versão anterior o lançamento cai no caminho do script, que só funciona sem pedidos de permissão ou com a pasta do script legível.
- O `roadmap-tracker` localiza a pasta do roadmap por `plan.roadmap` do `progress.json` e fecha passos e ondas a partir dele.

## Antes de atualizar

1. Termine, na 1.7.0, os planos que o coordinator está executando e os entregáveis em andamento no `roadmap-release`. Não atualize no meio de uma execução.
2. Atualize todas as máquinas e sessões que mexem no mesmo repositório ao mesmo tempo (veja "O que a 1.7.0 faz com os formatos novos").
3. Commite ou guarde o que está solto: o coordinator exige árvore sem mudanças alheias à execução ao iniciar.

## Como migrar

Planos já escritos, e ainda não executados, entram pela adoção:

1. `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`.
2. Peça ao `plan-writer` a adoção do plano antigo, passando o caminho dele (`<plan.md>`; `--roadmap <pasta>` se o plano não tiver a linha `**Roadmap:**`).
3. O `plan-writer` acha o spec (o que você indicou, o citado no plano, um `spec/1` ao lado ou o do card do roadmap); sem nenhum, chama o `spec-author` e escreve `docs/plans/<topic>/spec.md`.
4. Ele grava a adoção ao lado, como `plan.adopted.md`, e mostra a seção `## Adoção` (o que cada passo antigo virou), o diff contra o original, a pasta do roadmap e o resumo. Você aprova ou recusa numa pergunta.
5. Aprovou: o arquivo provisório substitui o original e o `check` confirma. Recusou: o provisório é apagado e o original fica intacto. A skill não faz commit; faça você.

Depois, o `plan-coordinator` cria o `progress.json` na primeira execução. Para um plano novo, use `spec-writer` e depois `plan-writer`.

## Se algo quebrar

- **Alívio individual:** fixar a loja numa tag da versão anterior (DEC-036). O dono cria a tag de cada versão publicada; `git ls-remote --tags origin` lista as existentes. Este repositório não documenta o comando para fixar um marketplace numa tag ou ref (o campo `ref` documentado aqui vale para a fonte de um plugin, não para `claude plugin marketplace add`); consulte `claude plugin marketplace --help` e a documentação do Claude Code. Fixar a loja vale só para a sua máquina e não substitui a volta.
- **Correção:** o caminho preferido na versão de quebra é corrigir adiante, numa versão de correção (2.0.x).
- **Volta:** só em último caso. Voltar é publicar uma versão nova e maior com o conteúdo da versão anterior (`main` nunca anda para trás), e quem publica é o dono. Trabalho iniciado na 2.0.0 termina nela ou recomeça a partir do plano (DEC-036).

## O que a 1.7.0 faz com os formatos novos

Medido em 2 sessões da 1.7.0 (uma por caso); o comportamento não é determinístico, então pode variar.

- A 1.7.0 não entende o `progress.json` (progress/1) da 2.0.0.
- Estado ainda não iniciado: ela costuma ignorá-lo e criar o próprio `progress-*.md` ao lado, o que deixa dois estados divergentes.
- Estado em andamento: ela tende a parar e recomendar a 2.0.0, sem mudar nada nem duplicar commit.
- O bloco de dados do plano é lido junto com o plano e não é usado; os 3 passos do plano de teste rodaram certo.
- Depois de iniciar um plano com a 2.0.0, atualize todas as máquinas e sessões antes de retomá-lo.

## Limitações conhecidas

Previstas para a 2.0.1 ou além, ainda não corrigidas:

- **Limpeza de processos.** A limpeza manda encerrar processos, mas nenhuma regra do preflight cobre o comando para isso; nas sondas a limpeza ficou incompleta (DEC-751). Confira processos que sobrarem depois de uma execução.
- Os portões finais do coordinator e de gates do release ainda não recusam um comando de teste cuja base falha ou roda 0 testes.
- Referências de SHA devolvidas por agente (`targetHead`, `mergeCommit`) ainda não passam por validação de 40 hex em todos os pontos.
- Os implementadores começam no repositório principal, não na worktree: no lote medido, 9 de 12 rodaram o primeiro teste com caminho relativo e falharam antes de corrigir para caminho absoluto.
- Custo medido no plano de teste: o coordinator custa menos que na 1.7.0 (mediana US$ 0,46 contra 1,15), embora envie mais bytes de prompt, por usar agentes haiku. Um release só até o plano (sem executar tarefas) subiu de US$ 1,37 (medido na 1.6.0) para US$ 1,93.

## marketplace-tools 1.3.0

Mudança única: o `lint-plugin` (skill `validate-plugin`) passa a reprovar um workflow registrado em `workflows` do `plugin.json` cujo script use `subagent_type`, que um script de workflow ignora sem avisar; o nome certo é `agentType` (DEC-057). Plugins sem `workflows` não mudam.
