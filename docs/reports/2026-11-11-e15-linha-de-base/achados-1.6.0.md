# Achados das execuções pagas de E15 (plugin 1.6.0, CLI 2.1.322)

Data: 2026-11-12. O que as execuções sem interface (`claude -p`) mostraram sobre o plugin 1.6.0 e sobre o arnês de medição. Os números da linha de base estão em `linha-de-base.md`; este arquivo registra só os comportamentos.

## Execução sem interface do 1.6.0

1. **Modo `default` nega Write.** O planner em `default` não grava a pasta do roadmap, e em `acceptEdits` ainda teve uma negação. Todas as variantes com execuções válidas rodaram em `bypassPermissions` (o modo de cada uma está na tabela da linha de base, e E17 usa o mesmo).
2. **Cópia do checker a partir do cache é negada.** `cp` de `~/.claude/plugins/cache/...` cai na regra de arquivo sensível e nenhuma regra de permissão a libera.
3. **A regra nomeada do Workflow não cobre o lançamento por caminho.** `Workflow(productivity-tools:roadmap-release)` não libera o script lançado por `scriptPath` ("Review dynamic workflow before running"); só a regra `Workflow` sem conteúdo libera. E25 passou a lançar pelo nome (`productivity-tools:release-workflow`).
4. **`acceptEdits` não basta para o release.** O modelo monta comandos compostos (heredoc com texto entre aspas, laços `for` com variáveis) que a CLI recusa ("can't be checked before it runs"); nenhuma regra `Bash(x:*)` os cobre. Por isso todas as variantes do release rodaram em `bypassPermissions`.
5. **O preflight do release só lê regras de arquivos de settings.** `--allowedTools` da linha de comando e o modo `bypassPermissions` não aparecem para ele; em modo `run`, sem interface, a skill para antes de qualquer agente. O arnês grava as regras num `.claude/settings.local.json` do sandbox, excluído do git.
6. **`claude -p` encerra tarefas em segundo plano 10 minutos depois do último turno.** O workflow do release roda em segundo plano e era cortado no meio; o lançador passa `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`. Qualquer uso do release sem interface por mais de 10 minutos precisa dessa variável.

## Pipeline do 1.6.0 sobre artefatos semeados

7. **O autor do plano reescreve o plano semeado.** Nas 2 tentativas de `plano-semeado-A` pelo pipeline completo, o agente de plano devolveu `reused=false` e corrigiu os defeitos antes da revisão (dado de DEC-051; tentativas guardadas fora da classe). A classe plano passou ao arnês de estágio (DEC-279).
8. **Parada antes do código.** Em 5 de 15 tentativas de `codigo-semeado`, o pipeline parou na revisão de spec ou de plano (`E5:status-blocked`) e não chegou à tarefa 3. Causa provável: spec e plano reais de `completo-1` sobre o código sintético semeado, que diverge deles (índice, `TypeError`). Motivo registrado: `parou-antes-do-codigo`.

## Arnês de medição

9. **Formato real do journal do Workflow** (DP-4): a primeira linha é `{"type":"launched"}` e as linhas `result` não trazem rótulo, que vem da linha `started` de mesma `key`. O leitor foi corrigido; antes dele toda tentativa semeada saía `formato-do-diario`.
10. **Sentinelas de plano escritas para o plano sintético** (DEC-278): P3, P4, P6, P7 e P8 não achavam a âncora nos planos reais; passaram a localizá-la pelo significado.
11. **Validade das variantes do release**: uma sessão que parava no preflight contava como válida; agora `completo` e `parada-retomada` sem nenhuma chamada de agente são inválidas (`sem-agentes`), e o campo `integrated` lê o merge de E5 em `release/sandbox`.
