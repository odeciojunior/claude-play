# E18: registro do release pela CLI e permissões no preflight, registro de revisões

Execução de 2026-11-11 (branch `feat/E18`). Resultado da execução: FALHOU, parada por entrada humana bloqueante (ver "Falha da execução"). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia). "Menores" é a contagem de problemas menores.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, opus | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

Nenhuma tarefa foi executada: a execução parou no estágio de spec.

Falha da execução: blocking human input: Ratificação pelo dono das decisões de contrato de E3 ainda pendentes (DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153), que fixam a forma da CLI, os nomes dos comandos, a saída --json e os códigos de saída sobre os quais E18 é construído (DEC-030, DEC-031; state.md: E18 e E22 esperam essa ratificação).

## Concerns (transcritos como registrados)

Nenhum concern registrado nesta execução.

## Gates

O relatório não traz resultado de gates registrado nesta execução.

## Entradas humanas

1. O que: Ratificação pelo dono das decisões de contrato de E3 ainda pendentes (DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153), que fixam a forma da CLI, os nomes dos comandos, a saída --json e os códigos de saída sobre os quais E18 é construído (DEC-030, DEC-031; state.md: E18 e E22 esperam essa ratificação).
   - BLQ: não informado no relatório.
   - Bloqueante: sim.
   - Contorno: Spec e plano podem ser escritos; E18 não é integrado em release/roadmap-skills-v2 até a ratificação ou a liberação do dono. Se o dono rejeitar alguma, o desenho é corrigido antes conforme a decisão nova.

2. O que: Ratificação pelo dono das 20 decisões autônomas do spec de E18 (DEC-030). As de alcance contrato (1, 2, 5 e 7) seguram o início de E25 e E8; as locais esperam o ponto de medição.
   - BLQ: não informado no relatório.
   - Bloqueante: não.
   - Contorno: Registradas como decisões do executor pendentes; não impedem a entrega de E18.
