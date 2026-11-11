# E22: tracker enxuto e rubricas, registro de revisões

Execução de 2026-11-11 (branch `feat/E22`). Resultado: falha da execução por entrada humana bloqueante. Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). "Menores" é a contagem de problemas menores. Só o estágio spec foi executado; plano e execução ficaram parados.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, correção opus | nenhum | 0 | nenhuma |

Riscos aceitos: nenhum.

## Falha da execução

blocking human input: Ratificação pelo dono das decisões de alcance contrato de E3 em que E22 se apoia (DEC-136, DEC-137, DEC-138, DEC-139, DEC-143, DEC-145, DEC-146, DEC-148, DEC-149, DEC-150, DEC-153), exigida por DEC-030 antes de um dependente começar; state.md: 'seguram o início de E18 e E22'. Mesmo caso de BLQ-2 para E18.

## Concerns

Nenhum registrado.

## Gates

O relatório não traz resultado de gates: nenhum gate foi rodado, pois a execução parou antes do plano.

## Entradas humanas

### 1. Ratificação das decisões de alcance contrato de E3 (bloqueante)
- O quê: Ratificação pelo dono das decisões de alcance contrato de E3 em que E22 se apoia (DEC-136, DEC-137, DEC-138, DEC-139, DEC-143, DEC-145, DEC-146, DEC-148, DEC-149, DEC-150, DEC-153), exigida por DEC-030 antes de um dependente começar; state.md: 'seguram o início de E18 e E22'. Mesmo caso de BLQ-2 para E18.
- Bloqueia: sim.
- Workaround: Nenhum: plano e execução de E22 ficam parados; o spec pode ser revisado. Ao chegar ao plano com alguma pendente, registrar o bloqueio no alvo no molde de BLQ-2. Se alguma for rejeitada, revisar o spec conforme a tabela da seção 'Pré-condição bloqueante'.

### 2. Aceite dos critérios 2 e 3 (verify: human)
- O quê: Aceite dos critérios 2 e 3 (verify: human): o dono confere o relatório docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md.
- Bloqueia: não.
- Workaround: O executor entrega o relatório com 'aceite: aguardando o dono'; não bloqueia o código.

### 3. Registro da meta derivada de prosa na estratégia
- O quê: Registro da meta derivada de prosa (29.096 bytes LF) na estratégia, por revisão proposta pelo tracker depois de E15 e gravada só com aprovação do dono (DEC-034, DEC-098).
- Bloqueia: não.
- Workaround: O teste usa a constante declarada no spec; se a revisão registrar outro valor, a constante segue a estratégia.

### 4. Ratificação das decisões autônomas de E22 (DEC-030)
- O quê: Ratificação pelo dono das decisões autônomas de E22 (DEC-030): as de alcance contrato (1, 2 e 3) seguram o início de E7 e E20; as locais em lote no ponto de medição.
- Bloqueia: não.
- Workaround: Não impede a entrega de E22.
