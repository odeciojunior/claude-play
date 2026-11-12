# E19 -- Autor de spec e skill interativa de spec (design)

Entregável E19 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQ: REQ-006, REQ-013, REQ-037. Depende de E5 (esquema `spec/1` e `spec-tool.mjs`; DEC-119 a DEC-133), de E14 (sondas: agente do plugin despachado com `agentType`; DEC-057, SRC-15) e de E17 (primeira publicação; DEC-046). Card crítico, trilha de engenharia, fase spec-plano. Proposta de desenho: SRC-08, seção B2 (com B1, B4, B5 e B7). Nomes: DEC-041. Caminhos de artefato: DEC-026. Rodada interativa: DEC-027.

Estado da execução: decidido sob as regras permanentes do dono (decisões do dono delegadas a um subagent Fable; `bypassPermissions` só nas sessões orquestradoras, DEC-311). Nunca há push nem toque em `main`. O que é embarcado (agente, skill, README) nunca indica `bypassPermissions` como padrão (DEC-312). Execuções pagas de medição não são tarefas do workflow.

## Por quê

Hoje o spec de um entregável sai de uma skill externa (`superpowers:brainstorming`) embrulhada num modo autônomo escrito no prompt do workflow (SRC-02 §4; `roadmap-release.js`, estágio Spec). O dono decidiu independência total do superpowers (DEC-005), e REQ-006 pede uma skill própria de spec com modo autônomo e modo interativo. REQ-013 exige que o prompt do autor de spec proíba perguntar à pessoa. REQ-037 exige que a mudança de comportamento seja exercitada por execução comportamental registrada. E5 entregou o formato (`spec/1`) e a ferramenta que fecha a escrita sem pessoa; falta o autor que a preenche e a entrada interativa fora de um roadmap.

## Critérios de aceite (do card, literais)

1. Dado um card do cenário fixo que exige uma credencial, quando o autor roda sem pessoa, então o spec passa na checagem, registra a credencial como item que só uma pessoa resolve, não inventa valor e nenhuma pergunta é feita. {verify: human; evidence: o dono confere o resultado das execuções comportamentais registrado em docs/reports}
2. Dado um pedido fora de um roadmap, quando a skill interativa roda, então grava um spec que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1: agente do plugin `productivity-tools:spec-author` (`plugins/productivity-tools/agents/spec-author.md`), modo autônomo, que lê o card e o código antes de decidir, não pergunta à pessoa e fecha a escrita com `spec-tool check`.
- Peça 2: skill interativa `spec-writer` (`plugins/productivity-tools/skills/spec-writer/SKILL.md`), para uso fora de um roadmap, que despacha o mesmo agente; uma rodada de até cinco perguntas, outra só a pedido, uma aprovação (DEC-027); grava em `docs/plans/<tópico>/spec.md` (DEC-026).
- O teste que acusa a grafia `subagent_type` num script de workflow do plugin (DEC-057).
- O card do cenário fixo que exige uma credencial e as execuções comportamentais dos dois critérios, com relatório em `docs/reports/`.

Não objetivos (de outros cards):

- Ligar o autor ao estágio de spec do workflow do release, os caminhos de artefato do release e as regras de parada em código: E8 (peças 1 e 4). E19 não edita `skills/roadmap-release/workflow/roadmap-release.js`.
- A revisão do spec: continua a que o release usa hoje (card). A leitura que devolve só perguntas (builder check de SRC-08) é um braço da medição de E26 e não entra aqui, nem na skill interativa.
- Autor de plano, `plan-writer` e troca dos ponteiros do planner e do tracker para as skills nativas: E20.
- Comparação medida dos prompts novos: E11 (risco 2 do card). O card não tem meta numérica (estratégia, "Sem meta numérica": E19).
- Mudança do esquema `spec/1`: fora, salvo se o autor precisar de campo que o esquema não tem (gatilho de DEC-119 e DEC-037); nesse caso o esquema sobe de versão e os testes de E5 e E6 passam (risco 1 de E5).
- Subir versão: nenhuma versão sobe na branch; a publicação que levar E19 sobe `productivity-tools` (e `marketplace-tools`, pelo lint) nos dois lugares (mesmo padrão de DEC-134).

Anti-objetivos:

- O agente nunca pergunta à pessoa e não tem `AskUserQuestion` entre suas ferramentas.
- Nenhum valor de credencial, token ou chave é escrito no spec, em fixture, em relatório ou em commit; uma credencial aparece só como nome de variável de ambiente ("fornecida pela variável de ambiente `<NOME>`").
- Nenhum texto embarcado indica `bypassPermissions` (DEC-312); numa recusa de permissão, a skill mostra a regra exata a acrescentar.
- O agente não faz commit, não faz push e não grava fora do caminho de saída que recebe.

## Desenho

### Peça 1 -- agente `spec-author`

Arquivo: `plugins/productivity-tools/agents/spec-author.md`. Primeiro agente de `productivity-tools`; `lint-plugin.mjs` já percorre `agents/` (DEC-132) e a política de chaves é a de DEC-131.

Frontmatter (só chaves de `AGENT_KEYS`): `name: spec-author`; `description` (quando usar: escrever um spec `spec/1` para um card de roadmap ou um pedido avulso; não para planos); `model: opus`; `effort: medium` (SRC-08 B5; nível T2 da política do dono para escrever spec); `tools: Read, Grep, Glob, Bash, Write, Edit`. Sem `AskUserQuestion`, sem `Agent`: a proibição de perguntar (REQ-013) fica também na estrutura, não só na prosa.

Despacho:

- De um workflow (E8 em diante): `agent(prompt, { agentType: 'productivity-tools:spec-author' })` (DEC-057).
- De uma skill na sessão principal: ferramenta Agent com `subagent_type: "productivity-tools:spec-author"`. Nessa ferramenta o parâmetro se chama mesmo `subagent_type`; a grafia proibida é só a de dentro de um script de workflow.

Contrato de entrada (prompt da chamada), com campos nomeados em linhas `chave: valor`:

| Campo | Modo | Conteúdo |
|---|---|---|
| `mode` | ambos | `unattended` ou `interactive` (o mesmo valor vai para `mode` do bloco de dados) |
| `output` | ambos | caminho do spec a gravar; o agente não escolhe caminho |
| `specTool` | ambos | caminho absoluto de `spec-tool.mjs`; o agente nunca o adivinha nem o procura no cache |
| `language` | ambos | idioma do spec (o do roadmap, ou o do pedido) |
| `roadmap`, `card` | unattended | pasta do roadmap (com `roadmap.config.json`) e id do card |
| `ownerNote` | unattended, opcional | instrução ou resposta do dono para o entregável |
| `topic`, `intake` | interactive | id do spec (kebab) e nota de entrada: pedido e respostas da pessoa literais, palpites marcados como palpites |

Processo (uma chamada, SRC-08 B2, com as mudanças desta seção):

1. Ler o card pela estratégia apontada em `roadmap.config.json`, os REQs que ele cita em `requirements.md`, as decisões que cita e as vigentes que tocam o mesmo assunto em `decisions.md`, os bloqueios abertos e as restrições de `state.md`. No modo interativo, ler a nota de entrada.
2. Ler o código que o card toca até cada critério de aceite ter um lugar no código (sempre lê antes de decidir; SRC-08, "Drop or invert").
3. Para cada escolha aberta, considerar ao menos duas opções em privado e escolher a recomendada; classificar como resolvida por uma fonte (citar na prosa), decisão autônoma (registro em `rulings`, com a opção descartada em `alternative`) ou item que só uma pessoa resolve (registro em `needsPerson`). Isso fecha a questão em aberto de `sources.md` (SRC-05 vs SRC-02) sobre comparar abordagens.
4. Listar em `externalEffects` todo efeito externo que o card exige.
5. Gravar o arquivo: prosa (Intenção; Escopo com dentro, fora e o que não fazer; Desenho, um parágrafo por critério nomeando arquivos reais; Fica para o plano) e o bloco ```` ```json data ```` no esquema `spec/1`. Os critérios de aceite ficam só no bloco (DEC-120), no modo autônomo idênticos aos do card, com a marca `{verify: ...}`.
6. Revisão própria: todo critério tem resposta no desenho; nenhum espaço reservado; nada fora do escopo do card; toda decisão tem base, custo se errada, reversibilidade e alcance (DEC-020, DEC-030); `contradicts` preenchido quando contraria uma decisão registrada ou um gate; todo item de pessoa está em `needsPerson`, com `blocking` verdadeiro só quando nenhuma parte útil sai sem ele, e nenhum valor inventado.
7. Rodar `node "<specTool>" check "<output>" --roadmap "<roadmap>" --json` (sem `--roadmap` no modo interativo) e corrigir até sair 0, no máximo três execuções.
8. Devolver, como última mensagem, a saída de `node "<specTool>" emit ...` literal (o JSON `{tool, schema, path, data}` de DEC-125); se a checagem ainda falhar depois da terceira execução, a saída literal do último `check --json`. O chamador distingue pelo formato. Quando o chamador pede saída com schema, o agente preenche o schema com os mesmos dados.

Regras fixas no corpo do agente: não perguntar, não esperar resposta, não dizer "devo...?"; não fazer commit (o commit é do chamador: o estágio do workflow em E8, ou a pessoa fora do release); não inventar credencial, dado de produção, aceite ou aprovação; uma credencial é um `needsPerson` de `kind: credential` e aparece só como nome de variável de ambiente; efeito externo é registrado, nunca executado.

Tamanho: alvo de desenho de cerca de 0,9 mil tokens para o corpo (SRC-08 B7); não é meta conferida (o card não tem meta numérica).

### Peça 2 -- skill `spec-writer`

Arquivo: `plugins/productivity-tools/skills/spec-writer/SKILL.md`, com frontmatter `name`, `description`, `argument-hint` (chaves da política do repositório; sem `allowed-tools`, cuja única exceção é a de DEC-049). A descrição diz: para um spec de uma mudança fora de um roadmap; não para um entregável de roadmap rodado pelo release; não para plano (`plan-writer`, E20); e registra a perda do risco 3 do card: quem quer uma conversa exploratória longa recebe só uma rodada de perguntas.

Fluxo:

1. Ler o pedido e o código que ele toca, sem perguntar (o mínimo para formular as perguntas). Calcular o tópico: kebab-case curto a partir do pedido. Se `docs/plans/<tópico>/spec.md` já existe, isso entra como uma das perguntas.
2. Uma rodada de até cinco perguntas que só a pessoa responde, numa única chamada de `AskUserQuestion`, cada uma com a opção recomendada primeiro. Outra rodada só se a pessoa pedir (DEC-027).
3. Montar a nota de entrada no prompt (pedido e respostas literais, palpites marcados) e despachar `productivity-tools:spec-author` com `mode: interactive`, `output: docs/plans/<tópico>/spec.md`, `specTool: ${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs` (absoluto; se `${CLAUDE_SKILL_DIR}` vier vazio, a pasta de onde o SKILL.md foi carregado), `topic` e `language`.
4. Rodar `spec-tool summary` sobre o arquivo e mostrar decisões e itens de pessoa. Pedir uma aprovação. Se a pessoa pede mudança, despachar o autor de novo com a correção na nota, rodar `check` e relatar o resultado sem nova pergunta.
5. Não faz commit; diz o caminho do spec e que o plano sai de `plan-writer` quando E20 existir.

Recusas: agente não encontrado (plugin não recarregado) -> relatar o erro literal e pedir `/reload-plugins`, sem copiar o corpo do agente no prompt. Recusa de permissão ao rodar `spec-tool.mjs` -> mostrar a regra exata por nome do script, sem versão no caminho (DEC-060): `Bash(node *spec-tool.mjs" *)`, para a pessoa acrescentar; nunca editar configuração nem sugerir modo sem permissões (DEC-312).

Bloco de dados no modo interativo: `id` é o tópico (não `E<n>`, logo sem aviso `card-not-checked`); os critérios de aceite são escritos pelo autor a partir do pedido e cada um leva uma marca `{verify: ...}` (test com comando, ou human), para que a ferramenta de plano de E6 e o autor de plano de E20 tenham evidência por critério.

Tamanho: alvo de cerca de 0,5 mil tokens (SRC-08 B7), sem meta conferida. Abaixo de 500 linhas (regra de skills).

### Teste que acusa `subagent_type` (DEC-057)

Em `lint-plugin.mjs` (marketplace-tools): para cada script de workflow registrado em `plugin.json` (`registeredWorkflows`), a presença do texto `subagent_type` é FAIL com mensagem que manda usar `agentType`. Casos novos em `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` (já existe): workflow registrado com `subagent_type` acusa; com `agentType` passa; um SKILL.md ou agente que cita `subagent_type` (parâmetro legítimo da ferramenta Agent) não acusa. G5 passa a cobrir o workflow do release e o futuro workflow do coordinator. Nenhum arquivo de teste novo (card).

### Card do cenário fixo com credencial

O cenário fixo (E1, `tools/measure/`) não tem card que exija credencial. O roadmap do sandbox (`make-sandbox.mjs`) não muda, para não mexer na entrada das variantes medidas nem na árvore `plugins/productivity-tools` usada como prova de validade da medição (DEC-301). Em vez disso:

- `tools/measure/scenario/spec-author-card.md`: card `E6 -- Publish report to remote storage`, no formato do sandbox (inglês, como os demais cards), com um critério testável sobre a montagem do envio e um critério que exige o token de acesso do armazenamento, nomeado pela variável de ambiente `REPORT_STORE_TOKEN`, sem valor em lugar nenhum.
- `tools/measure/make-scenario.mjs`: variante nova `spec-author`, que monta o sandbox como as outras e acrescenta o card E6 à estratégia e a linha do REQ correspondente, de modo que o checker do sandbox passe. A mesma variante serve à execução do critério 2: o pedido avulso fica em `tools/measure/scenario/spec-writer-request.md`, com as respostas roteirizadas da rodada de perguntas e a aprovação, marcadas como entrada sintética. A variante não entra na tabela de painéis de `run-batch.mjs` (não é medição). `make-scenario.test.mjs` (já existe) ganha a variante na lista e um caso que confere o card E6 no sandbox e o checker em 0.

### Execuções comportamentais (REQ-037, SRC-03)

Tarefas do orquestrador da sessão principal, não do executor do workflow (DEC-204: o executor não tem ferramenta de subagent), na worktree do entregável, com o sandbox em `D:/projects/claude-play-wt/_tmp/E19/` (fora do repositório), apagado ao fim.

- Critério 1: três execuções do autor em modo autônomo sobre o card E6 do sandbox, cada uma num sandbox novo. Despacho por `subagent_type: "productivity-tools:spec-author"` quando a sessão carrega o plugin da worktree; senão, um subagent geral em opus, effort medium, cujo prompt é o corpo do agente literal seguido do prompt de chamada; o relatório diz qual forma rodou. Conferido em cada execução: `spec-tool check --roadmap <sandbox>` sai 0; há `needsPerson` de `kind: credential` para o token; nenhum valor de credencial no spec (busca por padrão de segredo e pela atribuição de valor a `REPORT_STORE_TOKEN`); nenhuma chamada de `AskUserQuestion` e nenhuma pergunta à pessoa na saída.
- Critério 2: uma execução da skill `spec-writer` seguida literalmente por um subagent no pedido avulso, com as respostas e a aprovação tiradas do roteiro sintético; conferido: `docs/plans/<tópico>/spec.md` gravado, `spec-tool check` sai 0, perguntas da rodada em no máximo cinco, uma aprovação pedida; lista de ambiguidades encontradas. Depois, uma revisão adversarial somente leitura do resultado (regra de skills).
- Relatório: `docs/reports/2026-11-12-E19-autor-spec-comportamental.md`, escrito pelo orquestrador (subagents não gravam arquivos com nome de relatório), com as saídas literais, commitado em `feat/E19`. O aceite é do dono.

### Documentação

`plugins/productivity-tools/README.md`: linha de `spec-writer` na tabela de skills e uma seção curta do agente `spec-author`. `CLAUDE.md`: a linha de Layout sobre `agents/` deixa de dizer "today only sql-server-tools". Diagramas de arquitetura não mudam (nenhum plugin entra ou sai).

## Casos de borda

- Card sem nenhuma escolha aberta: `rulings` vazio, o spec passa.
- Card cujo critério cita um bloqueio aberto: o `needsPerson` correspondente leva o `blq`; um `blq` fechado é erro `needs-person-blq` e o autor corrige.
- `specTool` ausente ou ilegível no prompt: o agente não procura outro caminho; devolve a falha literal.
- `docs/plans/<tópico>/spec.md` existente na skill: vira pergunta da rodada; sem resposta, o tópico ganha sufixo `-2`.
- Pessoa recusa a aprovação sem dizer o que mudar: a skill encerra com o spec gravado e o resumo, sem nova pergunta.

## Deixado ao planejador

Ordem das tarefas e divisão por arquivo; texto exato do corpo do agente e do SKILL.md dentro dos alvos de tamanho; mensagem exata da regra de lint; o texto do card E6 do sandbox; o roteiro sintético do critério 2.

## Decisões autônomas (revisáveis pelo dono)

1. O autor é o agente `plugins/productivity-tools/agents/spec-author.md`, com `model: opus`, `effort: medium` e `tools: Read, Grep, Glob, Bash, Write, Edit`, sem `AskUserQuestion` nem `Agent`. Base: DEC-057, SRC-08 B1 e B5, REQ-013, nível T2 do dono para spec. Custo se errada: médio (um prompt a reescrever antes de E8). Reversível. Alcance: contrato.
2. Contrato de chamada do agente: campos `mode`, `output`, `specTool` (caminho absoluto passado pelo chamador), `language`, `roadmap` e `card` (autônomo), `ownerNote`, `topic` e `intake` (interativo); última mensagem é a saída literal de `spec-tool emit`, ou a de `check --json` se a checagem ainda falhar depois de três execuções. Base: DEC-125, DEC-060, SRC-08 B2. Custo se errada: médio (E8 e E20 seguem a mesma forma). Reversível. Alcance: contrato.
3. O agente não faz commit; o commit é do chamador (estágio do workflow em E8, ou a pessoa). Base: o agente serve aos dois modos e a skill interativa não deve commitar na branch da pessoa sem pedido. Custo se errada: baixo. Reversível. Alcance: contrato.
4. Para cada escolha aberta, o autor considera ao menos duas opções em privado e registra a descartada em `alternative`; fecha a questão em aberto de `sources.md` sobre comparar abordagens. Base: SRC-08 B2 passo 3. Custo se errada: baixo. Reversível. Alcance: local.
5. Nem o autor nem a skill interativa fazem a leitura que devolve só perguntas (builder check); a revisão do spec no release continua a de hoje e a leitura é braço de E26. Base: texto do card, DEC-021. Custo se errada: baixo. Reversível. Alcance: local.
6. A skill `spec-writer` passa a nota de entrada no prompt do agente, sem arquivo `intake.md`, para manter os nomes fixos de DEC-026. Base: DEC-026. Custo se errada: baixo. Reversível. Alcance: local.
7. A aprovação única da skill: com pedido de mudança, o autor é despachado de novo, a checagem roda e o resultado é relatado sem segunda pergunta de aprovação. Base: DEC-027. Custo se errada: baixo. Reversível. Alcance: local.
8. No modo interativo, cada critério de aceite escrito pelo autor leva uma marca `{verify: ...}` (test com comando, ou human). Base: E6 e E20 leem a evidência por critério. Custo se errada: baixo. Reversível. Alcance: contrato.
9. O teste que acusa `subagent_type` é uma regra de `lint-plugin.mjs` sobre os scripts de workflow registrados em `plugin.json`, com casos em `lint-plugin.test.mjs`; SKILL.md e agentes não são acusados, porque na ferramenta Agent o parâmetro se chama `subagent_type`. Base: DEC-057, DEC-131, card ("nenhum arquivo de teste novo"). Custo se errada: baixo. Reversível. Alcance: contrato.
10. O card do cenário fixo com credencial entra por uma variante nova `spec-author` de `make-scenario.mjs` e por arquivos em `tools/measure/scenario/`, sem mudar o roadmap de `make-sandbox.mjs`. Base: DEC-301 (validade da medição pela árvore do plugin), entrada das variantes medidas inalterada. Custo se errada: baixo. Reversível. Alcance: local.
11. Critério 1 com três execuções e critério 2 com uma, como tarefas do orquestrador da sessão principal, no tier opus/medium do autor, com relatório em `docs/reports/2026-11-12-E19-autor-spec-comportamental.md` escrito pelo orquestrador. Base: DEC-204, DEC-174, regra de skills (SRC-03), forma do critério de E20. Custo se errada: baixo. Reversível. Alcance: local.
12. A credencial do card do sandbox é só o nome `REPORT_STORE_TOKEN`; nenhum valor existe em fixture, spec, relatório ou commit. Base: anti-objetivo do card ("não inventa valor"), regra do dono sobre credenciais. Custo se errada: alto se um valor vazar. Reversível. Alcance: local.
13. Numa recusa de permissão, a skill mostra `Bash(node *spec-tool.mjs" *)` para a pessoa acrescentar e não sugere modo sem permissões. Base: DEC-060, DEC-312. Custo se errada: baixo. Reversível. Alcance: local.
14. Nenhuma versão sobe na branch; a publicação que levar E19 sobe `productivity-tools` e `marketplace-tools`. Base: padrão de DEC-134, DEC-046. Custo se errada: baixo. Reversível. Alcance: local.
15. Documentação: README de `productivity-tools` ganha `spec-writer` e o agente; a linha de Layout do `CLAUDE.md` sobre `agents/` é corrigida; diagramas não mudam. Base: regras do `CLAUDE.md`. Custo se errada: baixo. Reversível. Alcance: local.

## Depende de entrada humana

- Conferência do dono dos resultados das execuções comportamentais (critérios 1 e 2, `{verify: human}`) registrados em `docs/reports/2026-11-12-E19-autor-spec-comportamental.md`. Não bloqueante: as execuções e o relatório são produzidos pelo entregável; o aceite fica com o dono e nenhum aceite fictício é registrado.
- Ratificação das decisões de alcance contrato (1, 2, 3, 8 e 9) antes de E8 e E20 começarem (DEC-030). Não bloqueante para E19: as decisões ficam registradas como pendentes (origem executor) e o entregável segue.
- Nenhuma credencial real é necessária: a do critério 1 é sintética, só o nome da variável `REPORT_STORE_TOKEN` existe.
