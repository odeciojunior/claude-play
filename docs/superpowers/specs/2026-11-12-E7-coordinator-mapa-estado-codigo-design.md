# E7 -- Coordinator com mapa e estado em código (design)

Entregável E7 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.5). REQs: REQ-009 (mapa, ondas, conflitos, nível e transições por código), REQ-027 (paradas incidentais viram padrões; empate continua pergunta), REQ-013 (o prompt do executor proíbe perguntar à pessoa), REQ-016 (uma só definição de roteamento), REQ-008 (nada publicado da skill cita o superpowers) e REQ-020 (plano sem bloco de dados é recusado apontando a adoção). Depende de E3 (CLI do tracker, DEC-136 a DEC-157), E6 (`plan-tool`, `lib/routing.mjs`, DEC-176 a DEC-192 e emendas DEC-205 a DEC-210) e E17 (primeira publicação; DEC-046: o estado novo do coordinator só entra depois dela). Card não crítico, trilha de engenharia, fase spec-plano. Primeira etapa de DEC-006, reduzida ao que sobrevive à segunda (DEC-024): o workflow do coordinator é E12.

## Por quê

O `plan-coordinator` não tem script nem teste: grafo, ondas, conflitos de escrita, pontuação e as 31 transições da tabela de `references/delegation-protocol.md` (§ Step lifecycle) são seguidos pelo LLM a partir de prosa, e o estado vive num Markdown (`progress-<plano>.md`) que o modelo relê e reescreve (SRC-02 §5). E6 já entrega o plano com bloco de dados, a checagem, o mapa, os briefs e a definição de roteamento. E7 liga o coordinator a essa base: o mapa sai da ferramenta, o estado vira JSON com transições em funções puras (usáveis pela CLI agora e pelo workflow de E12 depois), as paradas incidentais viram padrões e o tracker decide o fechamento de peça lendo o mesmo JSON.

## Critérios de aceite (do card, literais)

1. Dado um estado e uma transição inválida (lançar um passo cuja dependência não passou), quando a função de transição é chamada, então recusa e o estado não muda. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
2. Dado um estado com passos em andamento, quando a retomada o lê, então devolve a próxima ação sem depender da conversa anterior. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
3. Dado o plano de exemplo, quando o estado inicial é criado, então suas ondas, níveis e portões de revisão são os que a ferramenta de plano e a definição de roteamento devolvem. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
4. Dada uma pasta com um único plano de correspondência forte e outra com dois candidatos empatados, quando a seleção por padrão roda, então escolhe o plano na primeira e devolve pergunta na segunda. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
5. Dado o estado de um plano concluído, quando o tracker fecha a peça, então decide pelo estado em JSON, e um teste de contrato falha se o esquema do estado mudar sem o tracker acompanhar. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs}
6. Dado o repositório após a entrega, quando se procura a palavra superpowers nos arquivos publicados da skill do coordinator, então não há ocorrência, e o prompt do executor proíbe perguntar à pessoa. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}
7. Dado um plano sem bloco de dados, quando o coordinator o recebe, então recusa com uma mensagem que aponta o modo de adoção da skill de plano, sem tentar interpretá-lo. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1: o mapa de execução do coordinator é o de `plan-tool` (`buildMap`/`emitPlan`) com o roteamento de `lib/routing.mjs`; os cards de passo viram os briefs em arquivo de `buildBriefs` (`briefs/T<n>.md`, DEC-188).
- Peça 2: esquema de estado `progress/1` em JSON, gravado como `progress.json` na pasta do plano (DEC-026), com as transições como funções puras numa fonte embutível (`lib/progress-state.mjs`), uma CLI (`skills/plan-coordinator/scripts/progress.mjs`) e uma função de retomada que devolve a próxima ação só a partir do arquivo.
- Peça 3: seleção do plano, base e reexecução por padrão, com empate devolvendo pergunta; a regra "nunca pergunte à pessoa" no prompt do executor.
- Peça 4: comando novo da CLI do tracker que decide o fechamento de peça pelo `progress.json`, com teste de contrato entre as duas skills.
- A prosa da skill do coordinator passa a mandar o modelo chamar a CLI em vez de seguir a tabela de 31 linhas, e deixa de citar o superpowers.

Não objetivos:

- O workflow do coordinator (`coordinator-workflow`, DEC-041) e a cópia embutida de `lib/progress-state.mjs` num arquivo de workflow: E12. Aqui a fonte só precisa passar em `checkPureSource` de `scripts/embed.mjs`.
- Reduzir a prosa carregável do coordinator como meta medida (REQ-017 é de E12). E7 não deve aumentá-la, mas não ganha teste de orçamento.
- Editar `roadmap-release.js` ou o SKILL.md do release (E8); o workflow do release continua citando `references/routing.md`, que segue existindo com as dimensões de nota (§1).
- Trocar os ponteiros do planner e do tracker para `plan-writer` e `spec-writer` (E20, peça 3) e criar a skill `plan-writer` ou o modo de adoção (E20).
- Ler ou migrar arquivos `progress-*.md` do formato antigo (DEC-018: sem script de migração; DEC-015: quem tem execução em andamento termina na versão anterior).
- Mudar o esquema `plan/1`, os códigos de `plan-tool` ou `lib/routing.mjs` (contratos de E6). Comando novo em `plan-tool` só se o planejador provar necessidade (gatilho de DEC-177); este desenho não precisa de nenhum.
- Subir versão (branches de entregável não mexem na versão); editar `docs/plans/roadmap-evolucao-skills/` ou `plugins/_template/`.

Anti-objetivos (falha mesmo funcionando):

- Ondas, nível, effort ou portão do estado diferentes dos de `plan-tool`/`route()` para o mesmo plano e a mesma largura (quebra REQ-016 e o critério 3).
- Uma transição recusada que altera o objeto recebido ou o arquivo gravado (critério 1): a função devolve um estado novo ou a recusa, nunca muta a entrada.
- Um caminho em que um passo externo já lançado volte a `Pending` ou seja relançado sem nova autorização (garantia da tabela atual, linha 17).
- Um padrão que escolhe plano havendo empate ou nenhuma correspondência forte (risco do card).
- Recomendar `bypassPermissions` como modo padrão em qualquer arquivo embarcado (DEC-312); as regras de permissão sugeridas continuam sendo regras exatas.
- Interpretar um plano sem bloco de dados "por aproximação" (critério 7).

## Desenho

### Arquivos

| Arquivo | Mudança |
|---|---|
| `plugins/productivity-tools/lib/progress-state.mjs` | novo, fonte pura (sem `import`, `process`, `require`, `crypto`): esquema, `initState`, `applyEvent`, `nextAction`, constantes exportadas |
| `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs` | novo: CLI (`select`, `init`, `next`, `apply`, `show`), leitura/gravação atômica, seleção de plano; importa `plan-tool.mjs` e `lib/progress-state.mjs` |
| `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` | novo, teste do card (critérios 1, 2, 3, 4, 6 e 7) |
| `plugins/productivity-tools/skills/plan-coordinator/scripts/fixtures/` | pastas de seleção (uma com correspondência forte, uma com empate), se o teste não as gerar em pasta temporária |
| `plugins/productivity-tools/skills/plan-coordinator/SKILL.md` | reescrita das fases para a CLI; descrição sem superpowers |
| `plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md` | a tabela de 31 linhas sai (vira código); ficam laço de ondas, prompt do executor (com a proibição de perguntar), verificação, recuperação e conclusão, todos em termos de eventos da CLI |
| `plugins/productivity-tools/skills/plan-coordinator/references/routing.md` | §1 (dimensões) fica, por ser lido pelo release; §2 a §4 passam a remeter a `lib/routing.mjs` como definição; §3.1 reescrito nos termos de DEC-206 |
| `plugins/productivity-tools/skills/plan-coordinator/references/progress-template.md` | substituído pela descrição do esquema `progress/1` (pode ser renomeado para `references/state.md`; decisão do planejador) |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` | comando novo `close-from-state` |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | testes do comando e teste de contrato (critério 5); a contagem de comandos do `--help` passa de 18 para 19 |
| `plugins/productivity-tools/skills/roadmap-tracker/references/events/14-plan-coordinator.md` e `SKILL.md` (linha do passo 0) | lêem `progress.json` e chamam `close-from-state` |
| `plugins/productivity-tools/README.md`, `CLAUDE.md` (Layout) | caminho do estado (`docs/plans/<tópico>/progress.json`), sem `docs/superpowers/plans/`; `lib/progress-state.mjs` na linha de `lib/` |

### Peça 1 -- mapa vindo da ferramenta de plano

`progress.mjs init <plan.md> [--spec <spec.md>] [--max-width <n>] [--piece <rótulo>] [--base <sha>] [--commits per-step|none] [--json]`:

1. Lê o plano. Sem bloco ```` ```json data ```` (`readDataBlock` não acha bloco de nível superior) -> recusa com o código `plan-no-data-block`, exit 1, sem gravar nada, e a mensagem: "plano sem bloco de dados: o coordinator não interpreta planos em prosa; adote-o com a skill plan-writer (modo de adoção), que o reescreve no formato plan/1 no mesmo caminho". Nenhuma outra leitura do texto é tentada (critério 7). O nome `plan-writer` vem de DEC-041; a skill chega em E20.
2. Chama `emitPlan` de `plan-tool.mjs` (que já roda `checkPlan` contra o spec). Erro de checagem -> recusa `plan-invalid`, exit 1, listando os códigos de `plan-tool`.
3. Monta o estado com `initState(emitted, opts)`: uma linha por tarefa com `tier`, `effort`, `reviewTier`, `gate` e `wave` copiados de `emitted.plan.tasks[i].route`/`.wave`, e as ondas copiadas de `buildMap` com a mesma largura. O estado guarda `plan.digest` e `plan.maxWidth` (DEC-208: a largura entra no resumo).
4. Grava os briefs com `buildBriefs` em `briefs/` ao lado do plano (decisão 4) e o estado em `progress.json` na mesma pasta.

Não há bundles: cada tarefa do plano é uma delegação (o autor de plano dimensiona as tarefas em até quatro arquivos; DEC-190). A escolha "inline" (deixada a E7 por DEC-184) é um modo de lançamento, não um nível: uma tarefa `haiku`, não externa e sem portão pode ser executada pelo próprio orquestrador pelo evento `inline-start`; o nível registrado continua o da ferramenta, e o critério 3 compara nível, não modo.

O plano lido é `plan.md` na pasta dada ou o caminho dado pela pessoa (card, peça 2). Na retomada, `next` recalcula o resumo do plano; se mudou, devolve a ação `plan-changed` (parar e perguntar se deve reiniciar), sem transição automática.

### Peça 2 -- esquema `progress/1` e transições puras

Forma (campos obrigatórios; o planejador fixa os nomes finais dentro desta forma e os documenta no esquema de referência):

```
{
  "schema": "progress/1",
  "plan": { "path": "<relativo à raiz do repositório>", "id": "E7", "digest": "<de emitPlan>", "maxWidth": 4, "roadmap": "<pasta ou null>" },
  "piece": null,
  "run": { "status": "map-ready|in-progress|blocked|completed", "worktree": "...", "branch": "...", "base": "<sha>",
           "test": "<comando>", "baseline": "<resultado>", "commits": "per-step|none",
           "waveGateOwed": null, "question": null, "updated": "<ISO>" },
  "waves": [ { "n": 1, "tasks": [1, 2] } ],
  "steps": [ { "n": 1, "title": "...", "wave": 1, "deps": [], "tier": "haiku", "effort": "low", "reviewTier": "sonnet", "gate": false,
               "external": false, "mode": "delegated|inline", "agent": "general-purpose", "status": "pending", "attempts": 0,
               "agentId": null, "preLaunchReview": null, "authorized": null, "handoff": null, "sha": null, "replacedBy": null, "note": null } ],
  "finalGate": { "status": "pending|pass|skip", "rounds": 0, "lastVerdict": null },
  "manual": [ { "kind": "refused|prelaunch-failed|not-named|open-question", "step": 5, "text": "...", "open": true } ],
  "history": [ { "event": "launch", "step": 1, "at": "<ISO>" } ]
}
```

Status de passo: `pending`, `launched`, `review-owed`, `pass`, `skip`, `skip-manual`, `waiting-manual`, `stopped` (os mesmos estados da tabela atual, grafados em código).

`applyEvent(state, event, now)` é pura: devolve `{ ok: true, state: <novo objeto> }` ou `{ ok: false, code, message }`, nunca muta `state` (o teste congela a entrada com `structuredClone` + comparação profunda). Os eventos cobrem as 31 linhas da tabela atual de `delegation-protocol.md`, uma regra por evento, com o número da linha original citado em comentário: `approve-map`, `launch` (lista de passos de uma onda), `inline-start`, `inline-result`, `report` (`pass|fail|blocked`), `review-result` (`pass|defects|lost`), `no-report`, `hold`, `release`, `prelaunch-review` (`pass|defects`), `authorize`, `refuse`, `card-changed`, `answer` (`done|no|rerun|value`), `wave-gate` (`pass|fail` com o passo responsável), `advance`, `final-gate` (`pass|defects|skip`), `block`, `unblock`, `commit` (SHA do passo). Recusas nomeadas, entre outras: `dependency-not-passed` (critério 1: `launch` de um passo com dependência fora de `pass`, ou `skip` sem saída), `wrong-status`, `blocked` (nada começa com `run.status` `blocked`, como hoje), `external-unauthorized`, `external-relaunch`, `wave-order`, `unknown-step`, `unknown-event`. O teste mínimo do critério 1 é o do card; o planejador acrescenta um caso por recusa.

`nextAction(state)` é pura e lê só o estado (critério 2). Ordem, igual à do Step 8 item 6 e do laço de ondas atuais: `blocked` -> `{ action: "ask", question }`; passos `launched` -> `{ action: "await", steps, agentIds }` (após compactação: pedir o relatório ao agente uma vez, ou aplicar `no-report`); `review-owed` -> `{ action: "review", step, reviewTier }`; `waveGateOwed` sem nada em voo -> `{ action: "wave-gate", wave }`; passo externo `pending` sem revisão ou autorização -> `{ action: "prelaunch-review" | "authorize", steps }`; senão a menor onda com passo `pending` admitido -> `{ action: "launch", wave, steps: [{ n, tier, effort, agent, brief }] }` (inline primeiro, como o item 10); nenhum pendente -> `{ action: "final-gate" }`, ou `{ action: "ask" }` com as entradas manuais abertas, ou `{ action: "done" }`. O teste do critério 2 lê um `progress.json` gravado em disco, num processo novo da CLI (`next`), e confere a ação.

CLI (`progress.mjs`): `select`, `init`, `next <progress.json>`, `apply <progress.json> <evento> [--step <n>] [--steps <n,...>] [--value <texto>] [--agent-id <id>] [--sha <sha>]`, `show <progress.json>` (tabela legível, substitui a leitura do Markdown). Saída texto e `--json` no molde de `plan-tool` (`{ tool, command, ... errors, warnings }`); exit 0 feito, 1 recusado sem alteração, 2 uso inválido ou arquivo ilegível (DEC-112, DEC-138). Gravação por temporário e renomeação, conferindo antes que os bytes do arquivo não mudaram desde a leitura (`concurrent-change`, como DEC-144). Mensagens em português, como `plan-tool`.

### Peça 3 -- paradas incidentais viram padrões

`progress.mjs select [--query <texto>] [--root <pasta>] [--json]`, sobre os candidatos `**/plan.md` sob `docs/plans/` da raiz (DEC-026), mais um caminho explícito, que dispensa a seleção:

- Com `--query`: correspondência forte = nome da pasta igual ao texto, ou pasta terminada em `-<ID>` com o texto igual ao ID (sem diferenciar caixa), ou `id` do bloco de dados igual ao texto. Uma forte -> `{ choice: <caminho> }`. Duas ou mais -> `{ question, candidates }`. Nenhuma forte -> `{ question, candidates }` com as fracas (texto contido no caminho), ou, sem candidato, pergunta que oferece escrever o plano.
- Sem `--query`: forte = plano com `progress.json` de `run.status` diferente de `completed` (execução em andamento a retomar). Uma -> escolhe. Nenhuma em andamento e um só `plan.md` sem estado -> escolhe. Qualquer outro caso -> pergunta.
- Exit 0 nos dois resultados; a pergunta é um resultado, não um erro.

Os demais padrões, gravados em Issues do estado (`history`) e reportados no relatório do mapa:

- Base: `git merge-base <ramo padrão> HEAD`; no ramo padrão, o SHA de `HEAD` no início (hoje é pergunta).
- Reexecução: plano com `run.status` `completed` -> `next` devolve `done` e nada roda; `init` sobre estado existente recusa `state-exists`, salvo `--restart`, que só a pessoa pede.
- Plano nomeado inexistente com um parecido: tratado pela seleção (uma forte escolhe, senão pergunta).
- Ficam paradas: autorização de efeito externo, ações manuais, árvore de trabalho com mudanças alheias, empate e ausência de plano.

Prompt do executor (`delegation-protocol.md`, § Prompt template, seção Rules): linha nova "Never ask the person a question. If something only a person can answer blocks you, stop and report BLOCKED with the question in CONCERNS." O teste do critério 6 lê o template e confere essa proibição, e varre todos os arquivos sob `skills/plan-coordinator/` (inclusive `scripts/`) atrás de `superpowers` sem diferenciar caixa; o próprio teste monta a palavra por concatenação para não se acusar.

### Peça 4 -- tracker decide pelo estado em JSON

Comando novo da CLI do tracker (DEC-136/DEC-137 estendidos): `node roadmap.mjs close-from-state <pasta> --state <progress.json> [--dry-run] [--json]`.

- Lê o JSON com leitor próprio (sem importar o coordinator). `schema` diferente de `progress/1` -> recusa `state-schema`, exit 1. `plan.roadmap` que não resolve para `<pasta>` -> `roadmap-mismatch`. `plan.id` sem linha no painel -> `deliverable-unknown`.
- Regra (a de `events/14-plan-coordinator.md` item 3, em código): fecha quando `run.status` é `completed`, `finalGate.status` é `pass` e todo passo é `pass` ou `skip`, seguindo `replacedBy` até o último; `skip-manual`, `waiting-manual` e `stopped` nunca fecham. Fechado -> `set-status` na palavra da posição 5 (na branch), com `--piece` igual a `piece` do estado quando houver, evidência = caminho do `progress.json` mais os `sha` dos passos (cada um conferido como commit, como hoje), e uma linha de log. Não fechado -> só sobe para a posição 3 (plano) se o status atual for anterior; nunca rebaixa (`status-backward` continua valendo) e nunca grava a posição 6 sem SHA integrado.
- Saída `result: { decision: "closed" | "not-closed", deliverable, piece, word, reasons }`; `--dry-run` decide sem gravar.

Teste de contrato em `roadmap.test.mjs`: `lib/progress-state.mjs` exporta só `STATE_SCHEMA`; a lista do que o tracker lê fica do lado do tracker: `roadmap.mjs` exporta `PROGRESS_CONTRACT = { schema: "progress/1", fields: [...], statuses: [...] }` com os campos e status que o leitor usa. O teste (a) cria um estado com `initState` a partir do plano de exemplo de E6 e o leva a `completed` com `applyEvent`, roda `close-from-state` numa cópia da fixture `valid/` em pasta temporária com git (DEC-156) e confere `closed`; (b) confere que `STATE_SCHEMA` da lib é igual a `PROGRESS_CONTRACT.schema` e que cada campo e status do contrato existe no estado gerado. Mudar o esquema, um nome de campo ou um status na lib sem atualizar o tracker faz (a) ou (b) falhar.

`events/14-plan-coordinator.md` passa a: localizar o `progress.json` (o que o coordinator nomeia, ou o da pasta do plano), chamar `close-from-state` e seguir com o resto do evento (`now`, `inflight-add`, § 9). Um `progress-*.md` antigo cai na regra de artefatos (posição 3 a partir do plano).

### Testes

- `progress.test.mjs` (novo, `node:test`, pastas temporárias removidas ao fim): critério 1 (recusa `dependency-not-passed` com entrada congelada e arquivo intacto pela CLI), 2 (estado com passo `launched` e outro `review-owed` gravado em disco; `next` em processo novo devolve `await`; e um caso por ação de `nextAction`), 3 (`init` do plano de exemplo de E6 com largura padrão e com `--max-width 2`: ondas, `tier`, `effort`, `reviewTier` e `gate` iguais a `buildMap`/`route`), 4 (pasta com um plano forte -> escolha; pasta com dois empatados -> pergunta), 6 (varredura e linha do prompt), 7 (plano sem bloco -> `plan-no-data-block`, exit 1, mensagem com `plan-writer` e "adoção", nenhum arquivo gravado); mais `checkPureSource` sem achado em `lib/progress-state.mjs` e a garantia de que nenhum evento devolve um passo externo lançado a `pending`.
- `roadmap.test.mjs` (existente): `close-from-state` fechado, não fechado, `--dry-run`, as três recusas, o teste de contrato, e o `--help` com 19 comandos.
- Os testes de `plan-tool.test.mjs` e `spec-tool.test.mjs` continuam sem mudança de expectativa.

### Verificação fora dos testes

G1, G2, G3, G4 e G5 antes de cada commit (G4 não muda, mas confirma o checker). Lint de G5 sobre `plugins/productivity-tools` com o SKILL.md reescrito (frontmatter só com as chaves da política do repositório).

## Casos de borda

- Plano com tarefa externa (T5 do plano de exemplo): `launch` recusa `external-unauthorized` até `prelaunch-review pass` e `authorize`; depois do lançamento, `report fail` leva a `stopped` com `open-question`, nunca a `pending`.
- Passo `skip` sem saídas como dependência: `launch` do dependente recusa `dependency-not-passed`; `hold` leva o dependente a `skip-manual`.
- `progress.json` em CRLF ou com BOM (checkout `core.autocrlf=true`): lido igual; gravado em LF.
- Plano alterado depois do `init`: `next` devolve `plan-changed`.
- Estado com `schema` desconhecido: `next` e `apply` recusam `state-schema`, exit 1.

## Deixado ao planejador

- Ordem e divisão das tarefas em até quatro arquivos; uma ordem natural é lib pura com transições e testes, CLI e seleção, prosa da skill, comando do tracker com contrato, documentação.
- Nomes finais dos campos dentro da forma acima e o nome do arquivo de referência do esquema.
- Os textos exatos das mensagens, desde que nomeiem o código.
- Quanto da prosa de `delegation-protocol.md` some (a tabela sai inteira; o resto é reescrito em termos de eventos).

## Decisões autônomas (revisáveis pelo dono)

1. Transições em fonte pura `plugins/productivity-tools/lib/progress-state.mjs` (embutível por `scripts/embed.mjs` em E12) e CLI em `skills/plan-coordinator/scripts/progress.mjs`; a lib exporta `STATE_SCHEMA`, `initState`, `applyEvent` e `nextAction`. Base: card, peça 2 ("por linha de comando agora e por um workflow depois"); DEC-058; DEC-006. Custo se errada: medium (E12 embute a lib). Reversível: sim. Alcance: contrato.
2. Esquema `progress/1` gravado em `progress.json` na pasta do plano, com os status de passo da tabela atual em código (`pending`, `launched`, `review-owed`, `pass`, `skip`, `skip-manual`, `waiting-manual`, `stopped`) e os campos da peça 2. Base: card, peça 2; DEC-026 (pasta e nomes fixos). Custo se errada: medium (tracker e E12 leem). Reversível: sim, por `progress/2`. Alcance: contrato.
3. CLI com os comandos `select`, `init`, `next`, `apply` e `show`, saída `--json` e códigos 0/1/2 no molde de `plan-tool` e da CLI do tracker, gravação atômica com detecção de mudança concorrente. Base: DEC-112, DEC-138, DEC-144. Custo se errada: low. Reversível: sim. Alcance: contrato.
4. Briefs gerados no `init` por `buildBriefs` em `briefs/` e mantidos junto do `progress.json` (commitados com o estado quando a política é por passo), e o resumo do plano no estado detecta mudança do plano na retomada; responde ao gatilho de DEC-188. Base: DEC-188; DEC-026. Custo se errada: low. Reversível: sim. Alcance: contrato.
5. Sem bundles: cada tarefa do plano é uma delegação; "inline" é um modo de lançamento (evento `inline-start`) só para tarefa haiku, não externa e sem portão, e o nível registrado continua o da ferramenta. Base: DEC-184 (inline fica em E7); DEC-190; critério 3. Custo se errada: low (custo um pouco maior em tarefas triviais encadeadas). Reversível: sim. Alcance: local.
6. Seleção por padrão: candidatos `docs/plans/**/plan.md`; forte = pasta igual ao texto, pasta terminada em `-<ID>`, ou `id` do bloco igual; sem texto, forte = execução em andamento, ou o único plano sem estado; empate ou nenhuma forte devolvem pergunta. Base: REQ-027; risco do card; DEC-026. Custo se errada: medium (plano errado executado). Reversível: sim. Alcance: contrato.
7. Base padrão: `git merge-base` com o ramo padrão; no ramo padrão, `HEAD` do início. Reexecução padrão: estado `completed` não roda nada; `init` só recria com `--restart`. Base: card, peça 3; SKILL.md atual (Step 0, Step 2). Custo se errada: low. Reversível: sim. Alcance: local.
8. Plano sem bloco de dados recusado com o código `plan-no-data-block` e mensagem que nomeia a skill `plan-writer` e o modo de adoção; nenhum `progress-*.md` antigo é lido ou migrado. Base: REQ-020; DEC-018; DEC-015; DEC-041. Custo se errada: low. Reversível: sim. Alcance: contrato.
9. Proibição de perguntar no prompt do executor como linha da seção Rules do template, com o bloqueio reportado como BLOCKED e a pergunta em CONCERNS. Base: REQ-013; card, peça 3. Custo se errada: low. Reversível: sim. Alcance: local.
10. Comando novo do tracker `close-from-state <pasta> --state <progress.json> [--dry-run] [--json]`, que grava `set-status` e uma linha de log, com recusas `state-schema`, `roadmap-mismatch` e `deliverable-unknown`; a CLI passa a 19 comandos. Base: card, peça 4; DEC-137, DEC-138, DEC-149. Custo se errada: medium. Reversível: sim. Alcance: contrato.
11. O tracker lê o JSON com leitor próprio e declara `PROGRESS_CONTRACT` (esquema, campos e status que usa); o teste de contrato gera o estado com a lib do coordinator e compara. Base: card, critério 5. Custo se errada: low. Reversível: sim. Alcance: contrato.
12. `references/routing.md` mantém §1 (lido pelo workflow do release, que E7 não edita) e passa a remeter §2 a §4 a `lib/routing.mjs`; §3.1 reescrito nos termos de DEC-206. Base: DEC-206; DEC-184; `roadmap-release.js:1804`. Custo se errada: low. Reversível: sim. Alcance: local.
13. A tabela de 31 linhas sai de `delegation-protocol.md` e passa a existir só no código, com o número da linha original em comentário por regra; a prosa da skill não cresce, sem teste de orçamento (REQ-017 é de E12). Base: REQ-009; DEC-024. Custo se errada: low. Reversível: sim. Alcance: local.
14. A peça do estado (`piece`) é dada no `init` por `--piece`; sem ela, o fechamento vale para a linha inteira do entregável; o esquema `plan/1` não ganha campo. Base: contrato de E6 (DEC-176); `events/14-plan-coordinator.md`. Custo se errada: low. Reversível: sim. Alcance: contrato.
15. Nenhuma versão sobe nesta branch; o SKILL.md do coordinator, sua descrição, o README do plugin e as linhas de Layout do `CLAUDE.md` deixam de citar `docs/superpowers/plans/` e o superpowers; os ponteiros do planner ficam para E20. Base: estratégia, "Execução deste roadmap"; REQ-008; card de E20, peça 3. Custo se errada: low. Reversível: sim. Alcance: local.

## Depende de entrada humana

Nada. Os sete critérios são `verify: test`, e o card não pede efeito externo (sem push, sem publicação, sem credencial, sem dado real). Instrução do dono para E7: execução sob as regras permanentes do dono (decisões do dono delegadas a um subagente Fable; `bypassPermissions` só na sessão orquestradora, DEC-311); nunca push, nunca `main`; nada embarcado recomenda `bypassPermissions` como padrão (DEC-312, refletido nos anti-objetivos); execuções pagas de medição não são tarefas do workflow. As decisões acima ficam pendentes de ratificação pela regra de DEC-030; as de alcance contrato seguram os dependentes de E7 (E11, E12, E13), sem impedir a entrega de E7.
