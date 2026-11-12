# E17: ponto de medição da primeira publicação, registro de revisões

Execução de 2026-11-12 (branch `feat/E17`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante registrado (lista de bloqueantes vazia em ambos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em ambos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, -; 2: opus, correção opus; 3: opus, correção opus | nenhum | 0 | nenhuma |
| plan | 1: opus, - | nenhum | 1 | nenhuma |

Riscos aceitos: nenhum.

Falha da execução: nenhuma.

## Concerns

Nenhuma.

## Gates

Nenhum registrado nesta execução.

## Entradas humanas

| O quê | Bloqueante (blq) | Workaround |
|---|---|---|
| Execuções pagas do ponto de medição (gasto em dinheiro); critérios 1 e 6 e o portão do critério 2 dependem delas | não | arnês, versão, branch de volta, roteiro e lista de ratificação entregues sem elas; relatórios de comparação marcados pendentes |
| Ratificação em lote das decisões do executor (critério 3) | não | ratificacao.md entregue com respostas recomendadas |
| Publicação (critérios 2 e 5): envio da tag productivity-tools--v1.6.0, avanço e push de main, atualização da loja e do plugin, conferência do cache e registro dos commits | não | passos no roteiro do dono |
| Aceite da branch de volta (critério 4): o dono confere o diff contra a tag e os gates em volta.md | não | nenhum |
| Roteiros A e B de E25 antes da publicação (pendentes do dono em state.md) | não | pré-condição da publicação, não da preparação |
| Liberação de aumento de bytes acima de 3% ou de classe inconclusiva, se checkpoint.mjs acusar (DEC-033, DEC-081) | não | condicional |

## Textos cortados no registro

Um item por corte do registro do roadmap (origem = source, destino = where, texto completo).

### Corte 1
- Origem: `docs/superpowers/reviews/2026-11-12-E17-ponto-medicao-primeira-publicacao-reviews.md`
- Destino: add-decision --decision
- Texto completo: A versão medida carrega do cache instalado numa CLAUDE_CONFIG_DIR descartável, com a loja como fonte git local fixada na SHA de M (ou na tag local leve e17-medicao em M, nunca enviada, se a CLI não aceitar SHA), nunca no nome da branch feat/E17, e --tag é essa SHA, e não de uma loja por pasta nem por --plugin-dir; sem gitCommitSha gravado, o dono para e registra.

### Corte 2
- Origem: `docs/superpowers/reviews/2026-11-12-E17-ponto-medicao-primeira-publicacao-reviews.md`
- Destino: add-decision --decision
- Texto completo: marketplace-tools vai a 1.2.0 (minor seguinte, o lint mudou em E25), sem atualizar formats.md (since 1.5.0 e o exemplo de JSON ficam); o commit de versão também troca a asserção assert.equal(p.version, '1.6.0') de flow.test.mjs (linha 3294) para '1.7.0', e o '1.6.0' do readPlugin simulado em run-baseline.test.mjs fica como está.

### Corte 3
- Origem: `docs/superpowers/reviews/2026-11-12-E17-ponto-medicao-primeira-publicacao-reviews.md`
- Destino: add-decision --decision
- Texto completo: A branch de volta volta/productivity-tools-1.7.1 parte de M, é montada numa árvore descartável por tarefa do orquestrador fora do workflow, nunca é enviada, devolve só plugins/productivity-tools à tag (flow.test.mjs volta ao da tag, sem asserção de versão) e mantém marketplace-tools em 1.2.0; arquivos repo-only acoplados ao plugin novo voltam ao estado da tag.
