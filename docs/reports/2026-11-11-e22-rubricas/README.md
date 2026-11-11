# Entradas e saídas das execuções comportamentais de E22 (tarefa 8)

Tudo neste diretório é fixture sintética, para teste das rubricas e do fluxo enxuto do `roadmap-tracker`. Nada aqui descreve um projeto real.

- `pasta/`: cópia intacta de `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` (entrada).
- `pasta-c2/`, `pasta-c2b/` (repetição do evento B), `pasta-c3/`, `pasta-fluxo/`: uma cópia de `pasta/` por execução, para que as execuções rodem em paralelo sem interferir; cada uma guarda o estado depois da sua execução.
- `spec-enfraquecido.md`: spec sintético do card E3 da pasta, com o critério 2 enfraquecido (`verify: test` virou `human`).
- `run-*.md`: saídas literais das execuções e da revisão adversarial.
