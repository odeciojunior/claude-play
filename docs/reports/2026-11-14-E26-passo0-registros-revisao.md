# E26, passo 0: registros reais de revisão de spec, plano e final (DEC-726)

Data: 2026-11-14. Commit lido: 19ab712 (release/roadmap-skills-v2). Análise só de leitura feita por um agente opus/medium a pedido do orquestrador; o relatório é do orquestrador. Sem custo de lote. É registro de evidência para a condição 3 de DEC-726: "no máximo 1 caso real em que a revisão após a correção pegou defeito verdadeiro, com 8 ou mais estágios reais com correção na classe".

## Fontes e limites

- 15 arquivos em `docs/superpowers/reviews/` e 6 em `docs/plans/evolucao-skills-E{9,10,12,21,23,24}/reviews.md`. `git ls-files | grep -i reviews` não acha outros.
- O laço (`runReviewLoop`, `roadmap-release.js:507-552`) grava só os achados da última rodada. Nos registros antigos, 2 rodadas significam bloqueante na 1ª e 2ª limpa; 3 rodadas significam que a 2ª, já depois da correção, pegou bloqueante. Quando o texto da 2ª rodada não está no registro, o conteúdo veio da mensagem do commit da correção seguinte (marcado "(c)" na análise).
- "Árvore suja" é gerado pelo código a partir do campo `clean` do revisor (`roadmap-release.js:400`), não é julgamento: conta como ruído.
- Duplicatas descartadas (regravações sem artefato novo): E8 execuções 2, 4 e 7; E9 blocked-record; E10 r2 e resync; E19 r3; E20 blocked-record e r3; E23 r2; E24 resync; E17 P9; E17 P6 (repete P5). A execução de E23 das 04h (`0ea32bd`, `4e42250`) não gravou registro e fica fora.
- Duas contagens: **estrita** (só a execução que passou) e **inclusiva** (toda revisão distinta sobre artefato que mudou, mesmo em execução que falhou depois). A análise recomenda a inclusiva, porque as capturas em execuções que falharam são casos reais.

## Resultado

| Classe | Estágios com correção (estrita / inclusiva) | Casos verdadeiros pós-correção (estrita / inclusiva) | Condição 3 de DEC-726 |
|---|---|---|---|
| Spec | 5 / 16 | 2 / 5 | **falha** (5 > 1; na estrita a amostra é pequena, mas já tem 2) |
| Plano | 7 / 12 | 0 / 0 | **elegível na inclusiva**; na estrita, amostra pequena por um (7 < 8) |
| Final | 11 / 17 | 5 / 9 | **falha** (contexto para E27; fora das peças 1 e 2) |

Nenhum estágio de plano chegou a 3 rodadas. Nenhuma parada de spec no teto por achado julgado aceitável (a única, E10 r1, teve o I6 adotado), então o gatilho de revisão de DEC-726 sobre paradas no teto não disparou.

## Casos verdadeiros pós-correção

Spec:

- E18 r2: a correção 1 (`e776054`) passou o veredito do checker para `status --json`; a 2ª rodada levou a `5e63a8d` ("status --json não traz o objeto checker"). Introduzido pela correção.
- E17 P1: a lista "completa" de asserções de versão da correção 1 (`8ac1dca`) deixava fora `flow.test.mjs:3294`; corrigido em `86deb25`. Resíduo.
- E17 P3: a ratificação gerada da ponta da release (correção `0888547`) precisava também do arquivo de estratégia; `af44260`. Introduzido.
- E12: o commit por passo da correção 1 (`0a30e32`) abriu a lacuna de `files`/`noCommit` no estado (I4, `0cf0162`). Introduzido.
- E10 r1: I6 (`evolucao-skills-E10/reviews.md:17-21`), lista de asserções incompleta que quebraria G1; adotado no spec final (`spec.md:47-53`). Resíduo.

Final (contexto para E27): E1 (`a65df44`), E7 (`c62521e`), E17 P4 (`7c7a2f6`, `1d343f4`, vazamento de caminhos em aggregate.json), E20 r1 (evidência do critério 4 velha contra HEAD), E20 r2 (`6a97f9e`), E8 e1 (`d8b0851` e dynContract em `fcc045d`), E9 r1 (`1d6c856` e rebase de HEAD destacado em `d1f4fbf`), E12 (`26fdc0f`), E23 (`c1afdb2`).

Fora das três classes: em E8 e5 a revisão de uma correção pós-merge pegou o motivo errado do aumento de `MAX_WORKFLOW_CHARS` (`644854a`).

## Leitura do orquestrador

1. Pela condição 3, a rodada única de spec não pode entrar, seja qual for o resultado do lote. O lote do laço de spec roda mesmo assim, como controle do braço perguntas (DEC-725/726).
2. A leitura única de plano continua elegível pela contagem inclusiva (12 estágios, 0 casos). Pela estrita, a amostra fica em 7, abaixo de 8, o que acionaria o gatilho de revisão de DEC-726. Este relatório adota a inclusiva, com a justificativa acima, e deixa a escolha explícita para a ratificação de E26.
3. Mais da metade dos casos verdadeiros foi criada pela própria correção (spec 4 de 5, final 5 de 9). Uma rodada única não pega esse tipo de defeito por construção.
