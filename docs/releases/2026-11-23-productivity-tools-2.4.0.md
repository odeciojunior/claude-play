# Nota de atualização: productivity-tools 2.4.0

Data: 2026-11-23. Sobre a 2.3.0. Traz **o caminho Antigravity (agy), experimental**, a troca do revisor por tarefa para `opus` e correções de folga e de processos no `release-workflow`. Formato de plano, de estado e de `release.config.json` não mudam: nada a fazer na configuração.

## O que muda

- **Caminho Antigravity (agy), experimental.** Quando o host é o Antigravity (`run_workflow` presente, sem a ferramenta `Workflow`), o `plan-coordinator` roda `workflow/coordinator-agy.py` e o `roadmap-release` roda `workflow/roadmap-release-agy.py`, com modelos Gemini. A tradução de tier fica em `lib/agy-routing.mjs` (haiku → flash_lite, sonnet → flash, opus → pro; revisores em `pro`); `plan.md` e `progress.json` continuam só com tiers Claude. `.agents/skills.json` registra as skills no Antigravity. No Claude Code nada muda.
- **E35, revisor por tarefa em `opus`.** `reviewModelFor` do `release-workflow` passa a devolver `opus` por padrão (DEC-001/DEC-004 do roadmap pós-2.3.0, a partir do lote de E30: 28/40 contra 20/40 do `sonnet`, custo 1,56x). O `task-reviewer` devolve `verdicts` só no modo `restricted` e `spec`/`quality` só no modo `review`.
- **E34, folga e diagnóstico de 512 KiB.** O teto de tamanho de `roadmap-release.js` sobe para 300.000 caracteres LF. O preflight acusa erro quando o arquivo em disco passa de 524.288 bytes (512 KiB, contando CRLF no Windows), acima do qual o lançamento pelo nome falha com `'not found'`.
- **E38, processos e arnês.** O `verify-run procs` corta o vínculo pai-filho quando o pai é mais novo que o filho (PID reaproveitado no Windows). O arnês de medição (`tools/measure/`, não publicado no plugin) ganha pré-voo e sentinela contra processos externos que matam o `node`.

## Avisos do caminho agy

- **Só com pedido direto.** O caminho só roda com pedido direto do dono, ou de um subagent a quem o dono delegou decisão. A skill passa `agyRequestedBy` (`owner` ou `delegate:<nome>`) e o script se recusa a começar sem ele. Sem o pedido, a skill para no início e não pergunta nada. O argumento nunca volta em `resumeArgs` nem em `resumeWith`.
- **Checkout exclusivo.** Rode numa cópia sem outra sessão editando: uma edição concorrente durante uma revisão encerra a execução (`error` no coordinator, falha de infra do entregável no release).
- **Uma só família de modelos.** Spec, plano e revisão são julgados por Gemini. Confira o resultado no Claude Code antes de levar para `main`.
- **Evidência ao vivo parcial.** Um smoke em 2026-11-23 (agy 1.5.15) rodou um plano de 2 passos até `done`, com `finalGate pass` e um commit por passo. O `task-reviewer` não rodou no smoke e segue sem evidência ao vivo; o `roadmap-release-agy.py` só foi testado com agentes simulados.
- **Custo.** Esse smoke de cerca de 15 minutos consumiu 25 pp da cota semanal e 86 pp da cota de 5 horas do Gemini. Reserve o caminho para pedidos que justifiquem o gasto.
- **Aprovações.** Os subagents do agy esperam aprovação própria na TUI; uma sessão sem ninguém para aprovar trava neles.

As pendências conhecidas do caminho estão em `docs/plans/productivity-tools-agy/spec.md`, seção “Pendências do caminho agy”.

## Ainda em aberto

- **E35, AC2.** O lote pago de confirmação do braço `opus` (10 execuções, teto US$ 7) ainda não rodou. Se ele ficar abaixo do piso de não-regressão, o padrão volta a ser discutido numa 2.4.x.
- **E38, AC2.** A conferência humana do caminho Linux de `verify-run procs` (`docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`) ainda está pendente.

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.4.0/` existe.

## Se algo quebrar

Prefira corrigir adiante numa 2.4.x. Para reverter, a branch `volta/productivity-tools-2.4.1` (conteúdo da 2.3.0, republicado como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
