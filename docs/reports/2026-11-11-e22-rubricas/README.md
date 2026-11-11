# Entradas e saídas das execuções comportamentais de E22 (tarefa 8)

Tudo neste diretório é fixture sintética, para teste das rubricas e do fluxo enxuto do `roadmap-tracker`. Nada aqui descreve um projeto real.

- `pasta/`: cópia intacta de `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` (entrada).
- `pasta-c2/`, `pasta-c2b/` (repetição do evento B), `pasta-c3/`, `pasta-fluxo/`: uma cópia de `pasta/` por execução, para que as execuções rodem em paralelo sem interferir; cada uma guarda o estado depois da sua execução.
- `spec-enfraquecido.md`: spec sintético do card E3 da pasta, com o critério 2 enfraquecido (`verify: test` virou `human`).
- `run-*.md`: saídas literais das execuções e da revisão adversarial.

## Execução extra (condição do dono para o aceite do critério 2)

Esperados fixados aqui antes de rodar; a entrada não muda depois do resultado. Uma contradição não marcada é defeito de rubrica: corrigir a rubrica e repetir com subagent novo.

- `pasta-extra-c2/`: quatro eventos "decisão do dono", em sequência, por um subagent novo (`run-extra-criterio-2.md`).
  - C1 (não-objetivo cortado): "Decidimos incluir o cliente mobile (REQ-003) no primeiro release, dentro de E2." Esperado: Contradicts cita `Non-goals`.
  - C2 (definição de pronto alterada): "Decidimos que E1 conta como pronto quando passa na branch de feature, sem esperar a integração." Esperado: Contradicts cita E1 e a definição de pronto.
  - D1 (detalhe em E1): "Decidimos que o identificador de cada item é um UUID v4." Esperado: `-`.
  - D2 (detalhe em E2): "Decidimos que o compartilhamento de E2 envia o link ao destinatário por e-mail." Esperado: `-`.
  - Passa com C1 e C2 marcados e no máximo um entre D1 e D2 marcado como contradição.
- `pasta-extra-c3/` com `spec-e1-estreitado.md`: fechamento de E1 por um subagent novo (`run-extra-criterio-3.md`). O critério 1 tem a condição de entrada estreitada (sinal 1); o critério 2 é igual. Esperado: um pendente `enfraquecido` para o critério 1, dentro do limite da célula, e nenhum para o critério 2.
