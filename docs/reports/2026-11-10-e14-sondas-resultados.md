<!-- Resultados das sondas de E14, executadas em 2026-11-10 por três subagents sonnet (effort medium), a pedido do dono. Consolidado pela sessão principal a partir dos relatos; os relatos completos não foram gravados. As decisões que saem daqui valem só se constarem em decisions.md. -->

# Sondas de E14: resultados

Ambiente: CLI 2.1.322, Windows 11, productivity-tools 1.6.0 instalado. Todas as sessões rodaram com `claude -p --permission-mode default`, salvo uma, indicada. Os três subagents conferiram por SHA-256 que `~/.claude/settings.json` não mudou. Nada foi editado no repositório, nenhum plugin foi instalado ou atualizado.

Desvio de DEC-029: ela previa as sondas de agente, de fidelidade e de compartilhamento de código na sessão principal. Rodaram em subagents, que lançam o workflow por sessão sem interface, pelo nome, forma comprovada nos experimentos de DEC-052 (SRC-14).

## Peça 1: agente do plugin despachado de dentro de um workflow

**Funciona.** Plugin de sonda carregado por `--plugin-dir`.

- `agent(prompt, { agentType: '<plugin>:<agente>' })` aplica o prompt de sistema do agente (conferido por palavra-senha, 2 de 2 rodadas).
- O `model` do frontmatter do agente vale: o agente se identificou como haiku com a sessão em sonnet (auto-relato, 1 rodada).
- Nome sem o prefixo do plugin: erro `agent type '<nome>' not found. Available agents: …`.
- `subagent_type` no lugar de `agentType`: ignorado em silêncio; o agente roda sem o prompt de sistema (2 de 2 rodadas).
- Não medido: se `model` na chamada vence o do frontmatter.

## Peça 5: compartilhar código num script de workflow

**Não funciona: só arquivo único autocontido.**

| Tentativa | Resultado |
|---|---|
| `import` estático (de `node:fs` ou relativo) | `SyntaxError`; o script não lança |
| `await import(...)` | `SyntaxError: import() is not available in workflow scripts.` |
| `require(...)` | `ReferenceError: require is not defined` |
| `eval` | `Code generation from strings disallowed` |

- Globais do workflow: `log, phase, budget, agent, parallel, pipeline, workflow, args`, mais `console`, `setTimeout`, `clearTimeout`.
- Do JavaScript padrão: `JSON`, `Math` (com `Math.imul`), `Date`, `Intl`, `Temporal`, `Map`, `Set`, `Promise`, `BigInt`, arrays tipados, `encodeURIComponent`.
- Ausentes: `crypto`, `fetch`, `process`, `fs`, `require`, `Buffer`, `TextEncoder`, `URL`, `structuredClone`, `btoa`/`atob`.
- `new Date()` sem argumento lança erro.

## Peça 4: fidelidade de um plano estruturado devolvido por agente

Desenho: um script lê o plano, imprime o JSON canônico e um resumo de integridade; o agente roda o script e devolve a saída; o código do workflow recalcula o resumo (hash em JavaScript puro, porque não há `crypto`) e compara. Sucesso é igualdade exata. Dez tentativas por célula; uma fixture por tamanho.

| Plano (bytes do JSON) | Modelo | Com schema | Sem schema | Controle (só o resumo) |
|---|---|---|---|---|
| 3 tarefas (2.377) | haiku | 0/10 falhas | 0/10 | não rodou |
| 12 tarefas (9.549) | haiku | 0/10 | 0/10 | não rodou |
| 30 tarefas (23.950) | haiku | 0/10 | 0/10 | 0/10 |
| 3 tarefas | sonnet | 0/10 | 10/10 falhas | não rodou |
| 12 tarefas | sonnet | 0/10 | 1/10 falha | não rodou |
| 30 tarefas | sonnet | não rodou | não rodou | não rodou |

- As 11 falhas, todas em sonnet sem schema, foram detectadas pela comparação do resumo; nenhum falso positivo.
- Tipos de falha: o modelo "corrigiu" o texto de um passo para ficar igual ao das tarefas vizinhas (a mesma alteração nas 10 tentativas), e uma vez acrescentou texto depois do JSON. Nenhuma truncagem, nenhuma recusa.
- As falhas são determinísticas por conteúdo: repetir no mesmo modelo e modo não ajuda.
- Com schema: 0 falhas em 80 tentativas (60 em haiku, 20 em sonnet). Limite superior de 95% da taxa por tentativa: cerca de 5% em haiku e 14% em sonnet.
- Sem degradação por tamanho até 24 KB em haiku. Sonnet com 30 tarefas não rodou, por custo.
- Regras usadas: `Workflow(<plugin>:<nome>)` e `Bash(node:*)`.
- Recomendação do subagent: duas novas tentativas (três no total), com a terceira trocando de modelo.

## Peça 2: script do plugin rodado por subagent a partir do cache

Script de teste: `check-roadmap.mjs --version`, na pasta da 1.6.0 e na de uma versão antiga ainda no cache.

| Regra em `--allowedTools` | Resultado |
|---|---|
| Nenhuma | Negado (`This command requires approval`), sem regra sugerida |
| `Bash(node:*)` | Roda |
| `Bash(node "<caminho exato da 1.6.0>" *)` | Roda; não cobre o mesmo script na pasta de outra versão |
| Curinga logo depois de barra invertida (`…\productivity-tools\*\skills\…`) | Negação dura (`Permission to use Bash has been denied`), repetida com o caminho da 1.6.0 |
| `Bash(node "<…\productivity-tools\1.*" *)` | Roda em outra versão 1.x |
| `Bash(node *check-roadmap.mjs" *)` | Roda em outra versão |
| `--permission-mode bypassPermissions`, sem regra | Roda |

Inferido: a barra invertida seguida de asterisco é lida como asterisco escapado; não confirmado na documentação.

## Peça 3: o que restava do consentimento

- **Lançamento por caminho a partir do cache:** o erro `scriptPath must be a script path this tool returned, or a file you can already read…`, sem regra e com `--allowedTools "Workflow"`. Lança só com `--add-dir` (da versão ou da pasta do script) mais a regra. Com `--add-dir` e sem regra, é negado. A pasta do cache não conta como legível.
- **Lançamento pelo nome com plugin instalado:** não testado. Nenhum plugin instalado registra workflow; `productivity-tools:roadmap-release` não existe como nome porque o manifesto não tem a chave `workflows`.
- **Marcador de sessão filha:** quatro pares negado/permitido deram o mesmo resultado com e sem as variáveis `CLAUDE_CODE_*` herdadas.
- **`skipWorkflowUsageWarning`:** nenhuma sessão sem interface gravou a chave. Resta a sessão interativa ao mostrar o diálogo, não testada.

## Custos

| Sonda | Custo devolvido pela CLI |
|---|---|
| Peças 1 e 5 | US$ 2,44 (18 sessões) |
| Peça 4 | cerca de US$ 5,7 (US$ 5,29 conferidos, o resto estimado) |
| Peças 2 e 3 | cerca de US$ 0,23 |

## Limites

- Peças 1, 4 e 5: plugin carregado por `--plugin-dir`, não instalado do cache.
- Peça 4: uma fixture fabricada por tamanho; n=10 por célula; três células de sonnet e o controle em sonnet não rodaram.
- Peça 2: a troca de versão foi simulada com a pasta de uma versão antiga, sem atualizar o plugin.
- Peça 3: o lançamento pelo nome com plugin instalado só pode ser conferido quando E25 registrar o workflow no manifesto.

## O que os resultados pedem na estratégia (proposta, não aplicada)

- **E2, peça 1:** o gerador de cópias embutidas é necessário, não opcional; o código embutido usa só as globais listadas.
- **E8, peça 3:** a carga do plano usa saída com schema; o resumo de integridade é calculado em JavaScript puro dos dois lados; duas novas tentativas, a última em outro modelo.
- **E18, peça 1 e riscos; E21 e E23, riscos:** a regra de permissão dos scripts não pode citar a versão nem usar curinga depois de barra invertida.
- **E19 e E20:** o autor é agente do plugin, despachado com `agentType: '<plugin>:<agente>'`; teste que acusa `subagent_type`.
- **E25:** o risco do caminho recusado passa a citar o cache; a reserva de DEC-050 serve a quem roda sem prompts de permissão ou libera a pasta.
