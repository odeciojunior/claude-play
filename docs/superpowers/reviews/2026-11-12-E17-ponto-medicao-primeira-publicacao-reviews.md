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

### Corte 4
- Origem: decisão do dono por delegação (Fable), emenda à decisão 1 (DEC-285)
- Destino: ratify --amend (DEC-298)
- Texto completo: Medição pelo cache instalado numa CLAUDE_CONFIG_DIR descartável, loja git local fixada na SHA de M; o dono entra na conta ali uma vez (serve também ao roteiro B de E25); a pasta recebe cópia do CLAUDE.md e settings.json reais, sem credencial; diferença de plugins registrada.

### Corte 5
- Origem: decisão do dono por delegação (Fable), emenda à decisão 10 (DEC-294)
- Destino: ratify --amend (DEC-299)
- Texto completo: A branch de volta volta/productivity-tools-1.7.1 parte de M e é a Tarefa 7 externa do plano, autorizada pelo dono em pessoa; nunca enviada; devolve só plugins/productivity-tools à tag e mantém marketplace-tools 1.2.0; repo-only acoplado ao plugin volta ao estado da tag.

## Ratificação delegada (Fable) e correções pré-execução, 2026-11-12

Decisões DEC-285 a DEC-296 ratificadas por delegação do dono (Fable), na branch de release: 2 a 9 e 11 como estão; 1, 10 e 12 com emenda, registradas como DEC-298 (a DEC-285), DEC-299 (a DEC-294) e DEC-297 (a DEC-296). As emendas 1 e 10 passam de 300 caracteres com o prefixo da CLI e ficam cortadas na célula, com o texto completo nos cortes 4 e 5 acima.

Correções no spec e no plano:

1. Paridade da pasta de configuração (spec, peça 1; plano, Tarefa 8): E15 mediu na configuração real `~/.claude`; a `CLAUDE_CONFIG_DIR` descartável recebe cópia do `CLAUDE.md` e do `settings.json` reais (nunca credencial), fica fora do repositório e das worktrees, é apagada depois da saída da conta, e a diferença de plugins é registrada. `roteiro-e17.test.mjs` ganha a asserção desses passos.
2. Teste aninhado (plano, Tarefa 3): o `node --test` filho roda com `delete env.NODE_TEST_CONTEXT`, como `tools/measure/compare.test.mjs` linha 17.
3. Metas lidas na tag (plano, Tarefas 3 e 4; spec, peça 1 item 6): em `3fbb59b` faltam `references/model.md` do planner, `prose-budget.test.mjs` e `references/events/` do tracker; arquivo ausente dá meta `não medida`, sem bloquear, com teste.
4. Tarefa 7 (plano, Tarefa 7 e decisão 2 do plano; spec, peça 5 e decisão 10): alinhada à emenda DEC-299, tarefa externa do plano autorizada pelo dono em pessoa.
5. Tag já no remoto (spec, contexto e peça 3; plano, Tarefas 7 e 8): `productivity-tools--v1.6.0` é anotada (objeto `c098f8a`), já enviada, e aponta para `3fbb59b`; o passo 3 da publicação vira conferência com `git ls-remote`, e as comparações de commit usam `productivity-tools--v1.6.0^{commit}`.
6. Momento do commit de resultados (spec, peça 1 e Ordem; plano, restrições globais, Tarefa 8 e passos do dono): alinhado à emenda DEC-297, depois do merge de `feat/E17`, por commit só de `docs/reports/` e novo merge na release, antes da publicação.
7. Menores: o spec cita a estratégia v1.5; o superpowers 7.0.0 é instalado com a loja fixada no commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` (o de `baseline.json` de E15), ou o dono para e registra.
