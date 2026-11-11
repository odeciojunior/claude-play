# E4 -- Planner com scaffold e revisão com rubrica (design)

Entregável E4 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-005, REQ-017, REQ-018, REQ-025. Depende de E2 (parser único em `plugins/productivity-tools/lib/roadmap-format.mjs` e checker gerado). Prioridade Should (DEC-022), trilha de engenharia, fase roadmap-sem-llm, não crítico. Arquivo de teste próprio de orçamento de prosa, sem dependência de E22 (DEC-053).

## Por quê

O planner escreve à mão cerca de nove arquivos a partir de umas 250 linhas de modelos em `formats.md`, que ele precisa ler inteiro no passo 6; o grafo Mermaid, as marcas `critical`, a tabela de visão geral, a simetria REQ↔card e o resumo de cobertura são derivações mecânicas feitas pelo LLM. O rascunho de retomada (`planning-draft.md`) é gravado depois dos passos 1 e 2 e de cada rodada de perguntas, mas não guarda os cards, e a regra "terminar o passo 6 a partir do rascunho" não tem os dados para isso. O revisor de contexto novo recebe uma frase, sem rubrica, sem formato de saída, sem nova rodada depois das correções e sem teto (SRC-02 §2). O ganho de custo esperado é pequeno: a maior parcela do planner é o contexto principal, que o scaffold não reduz (SRC-10, revisão 3); o ganho real é determinismo e retomada.

## Critérios de aceite (do card, literais)

1. Dado um modelo de roadmap de exemplo, quando o scaffold roda, então a pasta gerada passa no checker sem erros e o grafo e o caminho crítico correspondem às dependências dos cards. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs}
2. Dado um modelo salvo no meio do planejamento, com requisitos e cards e sem os arquivos finais, quando o scaffold o lê, então gera a pasta completa sem pedir dado que o modelo já tem. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs}
3. Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa carregável do planner não é maior que a meta derivada registrada na estratégia. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs}
4. Dado um roadmap com defeitos plantados que o checker não vê (número sem fonte, requisito composto, critério não verificável), quando o revisor roda, então devolve um achado estruturado para cada um, com arquivo, regra e severidade. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

Risco do card: o modelo estruturado engessa o que hoje é texto livre -> o scaffold gera a estrutura e os campos derivados; o texto dos cards continua escrito pelo modelo de linguagem.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1: um modelo estruturado do roadmap (`planning-model.json`) e um scaffold determinístico (`scaffold.mjs`) que gera a pasta inteira e a estratégia v1.0 a partir dele, com grafo de dependências, caminho crítico, marcas `critical`, tabela de visão geral, coluna Entregáveis dos requisitos e resumo de cobertura derivados dos cards, e com o checker copiado e rodado.
- Peça 2: o próprio modelo é o rascunho de planejamento: a skill o grava depois de cada passo (1 a 5) e de cada rodada de perguntas, com requisitos e cards, e a retomada do passo 0 lê o modelo.
- Peça 3: revisor com rubrica voltada ao que o checker não vê, saída estruturada (arquivo, regra, severidade), nova rodada depois das correções com teto; exemplos trabalhados em `decompose.md`; prosa repetida do planner reduzida.
- REQ-017: a prosa que o contexto principal do planner carrega numa execução completa cai abaixo da meta derivada declarada aqui (seção "Meta derivada de prosa").

Não objetivos:

- Mudar o formato da pasta de roadmap: `formatVersion` continua 1; o scaffold escreve exatamente o que `formats.md` já define. Nenhuma checagem nova no checker e nenhuma regeneração dele.
- Mudar o tracker, o release, o coordinator ou `events.md`. O tracker continua lendo `formats.md` do planner (E22 trata a carga do tracker).
- Trocar o modelo, o esforço ou a existência do revisor: continua opus/medium, só no modo completo (DEC-021 proíbe mudar o modelo de um revisor antes da medição). Também não se reduz laço de revisão: o laço passa de uma rodada para até três.
- Mexer na passagem para o superpowers no passo 8 (ponteiros nativos são de E20).
- Script de migração de rascunhos antigos (DEC-018 por analogia: adoção, não migração).
- Subir a versão de `productivity-tools` ou a linha 1 do checker (estratégia, "Execução deste roadmap"; DEC-042). Editar `docs/plans/roadmap-evolucao-skills/`, a estratégia ou `plugins/_template/`.

Anti-objetivos (falha mesmo funcionando):

- O scaffold escrever prosa de card, critério, risco, objetivo ou tese que o modelo não traz: tudo que é texto vem do modelo, o scaffold só deriva estrutura (risco do card). Também não inventa número, data ou meta (regra 1 do planner).
- O scaffold perguntar algo, ler stdin ou parar à espera: ou gera, ou recusa com a lista exata dos campos que faltam, sem gravar nada.
- Gerar uma pasta que o checker reprova, ou sobrescrever um roadmap existente (pasta com `roadmap.config.json` e sem modelo).
- Cumprir o orçamento de prosa cortando regras de que o planner precisa, ou escondendo prosa obrigatória num arquivo excluído da contagem.

## Desenho

### Arquivos

Todos sob `plugins/productivity-tools/skills/roadmap-planner/`, exceto onde dito.

| Arquivo | Papel |
|---|---|
| `scripts/scaffold.mjs` (novo) | CLI e funções puras exportadas: validar o modelo, derivar grafo, caminho crítico e cobertura, renderizar cada arquivo, gravar a pasta, copiar e rodar o checker |
| `scripts/scaffold.test.mjs` (novo) | arquivo de teste do card (critérios 1 e 2) |
| `scripts/prose-budget.test.mjs` (novo) | arquivo de teste do card (critério 3) |
| `scripts/fixtures/model-full.json` (novo) | modelo completo de exemplo (modo completo, idioma `en`, com bloqueio, gates e medições) |
| `scripts/fixtures/model-mid.json` (novo) | modelo do meio do planejamento: base, fontes, requisitos, fases e cards, sem estado, sem gates, sem prioridades; idioma `pt-BR` |
| `scripts/fixtures/review-planted/` (novo) | pasta de roadmap válida no checker (0 erros) com os três defeitos plantados do critério 4, mais `expected-findings.json` com arquivo e regra esperados de cada um |
| `references/model.md` (novo) | contrato do modelo: campos, obrigatórios, o que o scaffold deriva, saída e recusas, e um card de exemplo em JSON |
| `references/review-rubric.md` (novo) | rubrica do revisor, esquema da saída e exemplos; lido só pelo subagent revisor |
| `SKILL.md` | passo 0 (retomada pelo modelo), "Planning draft" vira "Planning model", passos 1 a 5 gravam o modelo, passo 6 chama o scaffold, passo 7 com rubrica, rodadas e teto; prosa repetida cortada |
| `references/decompose.md` | exemplos trabalhados (card completo, requisito composto dividido, critério bom e ruim); §13 aponta para o scaffold; repetições cortadas |
| `references/clarify.md` | orçamento de perguntas citado num só lugar |
| `references/formats.md` | só a linha do layout: `planning-draft.md` vira `planning-model.json` (temporário, só do planner, ignorado pelo checker) |
| `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` (novo, na raiz do repositório) | registro da execução comportamental do critério 4 e do teste comportamental do fluxo novo (regra de SRC-03) |

Os nomes `scaffold.mjs` e `prose-budget.test.mjs` não repetem nenhum script do plugin hoje (DEC-060, DEC-133); o card de E22 cria depois `plugins/productivity-tools/scripts/prose-budget.test.mjs`, em outra pasta, por escolha da estratégia.

### O modelo (`planning-model.json`)

Um arquivo JSON na pasta do roadmap, gravado pelo LLM com a ferramenta de escrita. Campos (os nomes ficam em inglês, como as chaves do config; os valores de texto vão no idioma do projeto):

- Base: `modelVersion` (1), `date` (ISO; data de criação, fato), `topic`, `title`, `language`, `mode` (`full` ou `light`), `strategyPath` (relativo à pasta, padrão `../<date>-roadmap-<topic>.md` sem sufixo `-plan`), `integrationBranch`, `releaseBranch` (opcional), `nextStep` (número do próximo passo da skill).
- Opcionais com padrão: `vocab`, `tracks`, `limits`, `files`. Padrão de `vocab` por idioma: `pt*` usa o vocabulário de `docs/plans/roadmap-evolucao-skills/roadmap.config.json` (copiado como constante no script, não lido dali); qualquer outro idioma usa o vocabulário em inglês de `formats.md` §2. `limits` padrão `{nowItems: 5, cellChars: 300, pendingItems: 20}`; `tracks` padrão os cinco de `formats.md` §2.
- Conversa: `questions` (pergunta, resposta literal da pessoa; segredo vira "[omitted: secret]"), `sources` e `conflicts`, `decisions` (linhas `DEC` completas), `assumptions` (texto, dono, revalidar quando).
- Requisitos: `requirements[]` com `id`, `text`, `type`, `sources`, e `coverage` só quando não é coberto (`out-of-scope` com motivo, ou `needs-clarification` com o entregável que resolve).
- Estrutura: `phases[]` (nome pelo resultado, entrada, saída), `deliverables[]` com `id`, `title`, `phase`, `track`, `priority`, `size`, `depends`, `reqs`, `why`, `pieces[]`, `acceptance[]` (texto e `verify` `{kind, blq?, evidence}`), `dod`, `risks[]` (`risco -> mitigação`), `status` opcional (`blocked` com `blq`, ou `discarded`).
- Estratégia: `objective` (texto, critério de aceite, definição de pronto), `nonGoals[]`, `thesis`, `gates[]` (as cinco colunas), `metrics` e `flags` (opcionais), `crossRisks[]`, `externalPending[]`, `openQuestions[]`.
- Estado: `now[]`, `pending[]` (com dono), `blockers[]`, `donot[]` e `releases[]` (opcionais), `measurements[]` (opcional; ausente gera `files.measurements: null`).

Obrigatórios para o scaffold gerar: os campos de base menos `releaseBranch` e `nextStep`, `requirements` (≥1), `phases` (≥1) e `deliverables` (≥1, cada um com `id`, `title`, `phase`, `depends`, `reqs` e ≥2 critérios com `verify`). Tudo o mais tem padrão declarado em `model.md`, e cada padrão aplicado sai na lista `defaulted` da saída, para a skill saber o que preencher antes de gravar de vez:

- `priority` ausente: `Must`; `size`: "not estimated"/"não estimado" pelo idioma; `track`: a primeira trilha (os padrões do modo leve, `decompose.md` §12).
- Seções de prosa ausentes da estratégia (não objetivos, tese, riscos transversais, pendências externas, questões em aberto): o texto de "nenhum" no idioma ("None."/"Nenhuma."). Métricas e Flags ausentes: a seção é omitida (`formats.md` §5).
- `gates` ausente: a tabela de gates não é escrita; o checker então avisa `dod-no-gate` onde couber (aviso, não erro).
- `now` ausente: um item por card sem dependência, "Iniciar E<n>. Runs: -. Approves: -. Depends on: -." no idioma. `pending` ausente: bloco vazio.

### O que o scaffold deriva (e o modelo não guarda)

- `critical` de cada card: verdadeiro quando o card está em alguma cadeia de dependências de comprimento máximo (contado em entregáveis, sem datas nem tamanhos). Um `critical` vindo do modelo é ignorado e reportado em `defaulted`.
- `critical-path.md`: `graph LR` com uma aresta `Ex --> Ey` por dependência declarada (e só essas), um nó por card, nós de bloqueio `BLQn["BLQ-n: <texto>"]` ligados aos cards que eles bloqueiam; a linha "Critical path: E.. -> E.." com uma cadeia máxima (a primeira em ordem de id quando há empate); "Next gate per track" apontando para `state.md`.
- Tabela "Deliverables overview" (ID, título, fase, depende de), tabela de fases dentro do bloco `phases` com a coluna de entregáveis tirada dos cards, ordem das fases como no modelo.
- Coluna Entregáveis e Cobertura de `requirements.md` a partir dos `reqs` dos cards (simetria por construção); "Coverage summary" contado.
- Painel de `state.md`: uma linha por card, com o primeiro status do vocabulário, ou o de bloqueado citando o `BLQ-n` (e a linha do bloqueio com "restores E<n> to <primeiro status>" / "restaura E<n> para <primeiro status>", como `block-close` lê, DEC-148), ou descartado com prioridade `Won't`.
- `log.md` com uma linha (data do modelo, `-`, roadmap criado, evidência = caminho da estratégia); README com o comando do checker e a tabela "when to update" de `formats.md` §8; `roadmap.config.json` completo; âncora `version 1.0 <date>` e changelog v1.0 com o modo e os `DEC` absorvidos.
- Cópia do checker: `../roadmap-tracker/scripts/check-roadmap.mjs` copiado byte a byte para `<pasta>/check-roadmap.mjs`, com a conferência de que o formato da linha 1 é igual a `formatVersion`.

Recusas (exit 1, nada gravado): modelo inválido (JSON, `modelVersion` desconhecido, obrigatório ausente, id duplicado, dependência para card inexistente, ciclo no grafo, `reqs` para requisito inexistente, fase de card fora de `phases`, trilha fora de `tracks`); pasta com `roadmap.config.json` e sem o modelo (roadmap existente, linha do passo 0); checker em memória com erro na pasta gerada (o scaffold gera, roda `checkRoadmap` sobre os textos e só grava se não houver erro). A saída lista cada problema com o caminho JSON do campo.

### CLI e saída

`node scaffold.mjs <pasta-do-roadmap>/planning-model.json [--dry-run] [--json]`

- Grava na pasta do modelo: os arquivos da pasta e a estratégia no caminho do config. Uma pasta com config e modelo (passo 6 interrompido) é regravada inteira a partir do modelo. Nunca lê stdin, nunca chama git para escrever, nunca commita; não apaga o modelo (o passo 7 apaga).
- `--dry-run`: valida, gera e roda o checker em memória, sem gravar.
- `--json`: `{ tool: "scaffold", model, folder, written: [...], defaulted: [...], errors: [...], warnings: [...], summary: { errors, warnings, exitCode } }`, no molde de DEC-112 e DEC-138; `warnings` são os avisos do checker na pasta gerada. Códigos: 0 gerado (avisos não mudam o código), 1 recusado sem gravar, 2 uso ou falha de gravação.
- Importa `parseRoadmapTexts` e afins de `../../../lib/roadmap-format.mjs` e, do checker irmão, `checkRoadmap`, `parseRoadmap`, `validateConfig`, `FORMAT_VERSION` (o checker só roda `main` quando é o processo principal), como `roadmap.mjs` faz. Não é script de workflow, então importar vale (DEC-058 trata só de workflow).

### A skill

- Passo 0: a busca por rascunho passa a ser por `docs/plans/*/planning-model.json`; a tabela de estados troca `planning-draft.md` por `planning-model.json`, e a linha "config e modelo" vira "rode o scaffold de novo a partir do modelo, depois o passo 7". Um `planning-draft.md` de versão anterior encontrado na pasta é lido uma vez como fonte da retomada e convertido no modelo; não há leitura permanente do formato antigo.
- "Planning model" substitui "Planning draft": gravar o modelo depois dos passos 1, 2, 3, 4 e 5 e de cada rodada de perguntas, sempre inteiro e com `nextStep`; nunca um segredo.
- Passo 6: completar o modelo (gates copiados do CLAUDE.md e das fontes, nunca inventados; estado inicial), rodar `node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" "<pasta>/planning-model.json" --json`, corrigir o modelo e rodar de novo até exit 0; tratar cada item de `defaulted` (aceitar ou preencher). A instrução de ler todos os modelos de `formats.md` sai; `formats.md` passa a ser consultado só por seção (`§n`) quando um campo do modelo pedir.
- Passo 7: rodar o checker copiado (inalterado); no modo completo, o revisor (opus/medium, contexto novo, só leitura) recebe a pasta, a estratégia, as fontes e o caminho de `references/review-rubric.md`, que ele lê. Laço: corrigir no modelo, rodar o scaffold e o checker, e despachar um revisor novo só se a rodada anterior teve achado `error`; teto de três rodadas no total. Achado `error` restante depois da terceira vai para o handoff como pendência, sem nova rodada. Modo leve e sem ferramenta de subagent: como hoje.
- Prosa repetida: os padrões do card no modo leve ficam só em `decompose.md` §12 (a tabela do passo 0 aponta para ela); o orçamento de perguntas fica só na regra 6 do SKILL (clarify.md e o passo 2 apontam para ela); o passe de cobertura fica só em `decompose.md` §11.

### Rubrica do revisor (`references/review-rubric.md`)

Só o que o checker não vê. Cada regra com id, o que procurar, severidade padrão e um exemplo curto de achado e de não achado:

| Regra | O que procurar | Severidade |
|---|---|---|
| `unsourced-number` | número, data, meta ou estimativa sem `SRC`, `DEC`, `ASSUMPTION` ou `UNSOURCED` | error |
| `compound-requirement` | requisito com dois ou mais comportamentos verificáveis separados | error |
| `unverifiable-criterion` | critério que não dá para conferir pelo comando ou pela evidência do tag (vago, sem resultado observável, comando que não exercita o critério) | error |
| `untraced-claim` | afirmação da estratégia sem fonte, decisão ou marca | error |
| `requirement-gap` | requisito da fonte que não virou `REQ`, ou `REQ` que a fonte não sustenta | error |
| `task-sized-deliverable` | entregável que não pede spec e plano próprios | warning |
| `layer-slice` | entregável ou fase nomeado por camada, não por resultado | warning |
| `hope-mitigation` | mitigação que não é uma ação | warning |
| `conflict-resolved-silently` | divergência entre fontes escolhida sem `DEC` e fora do bloco `conflicts` | error |

Saída: só um bloco JSON cercado, `{"findings":[{"file","line","rule","severity","evidence","fix"}], "summary":{"error":n,"warning":n}}`; `file` relativo à raiz do repositório, `line` opcional, `evidence` a citação literal, `fix` uma frase. Sem estilo, sem elogio. Regra fora da tabela usa `other` com a explicação em `evidence`.

### Exemplos trabalhados (`decompose.md`)

Três exemplos curtos e no formato do card: um card completo (é também o card de exemplo de `model.md` em JSON, para não repetir); um requisito composto dividido em dois `REQ`; um par de critérios ruim e bom (ruim: "funciona bem"; bom: Dado/Quando/Então com resultado observável e `verify` com comando).

### Meta derivada de prosa (critério 3; DEC-034)

- Contador: bytes, com finais de linha normalizados para LF, da prosa que o contexto principal do planner carrega numa execução completa: `SKILL.md` mais os arquivos de `references/` que a skill manda ler inteiros. Variante: modo completo.
- Linha de base (SRC-02 §1): 75.531 bytes no checkout CRLF, os quatro arquivos no commit `bf9d948`; em LF são 74.602 (SKILL 19.092, clarify 10.058, decompose 14.185, formats 31.267; diferença de 929 linhas, conferida com `git show`).
- O que a mudança remove por construção: a leitura inteira de `formats.md` (31.267 bytes na linha de base), que o scaffold substitui. Meta derivada: 74.602 − 31.267 = **43.335 bytes LF** (−42%). O que entra de novo no contexto principal (`model.md`, os exemplos) é pago pelos cortes no SKILL (passo 6 e repetições); a rubrica fica fora porque é lida pelo subagent revisor, não pelo contexto principal.
- O teste: conjunto contado = `SKILL.md`, `references/clarify.md`, `references/decompose.md`, `references/model.md`; conjunto excluído, com motivo no teste = `references/formats.md` (contrato de formato, consultado por seção e lido também pelo tracker e pelo checker) e `references/review-rubric.md` (lido só pelo revisor). Ele confere: (a) soma LF do conjunto contado ≤ 43.335; (b) todo arquivo de `references/` está em exatamente um dos dois conjuntos (um arquivo novo não escapa da contagem); (c) em cada arquivo contado, toda menção a `formats.md` vem com uma seção `§`, e nenhum manda ler `review-rubric.md` no contexto principal. A constante de linha de base e a meta ficam no teste com a citação desta seção.
- A estratégia ainda não tem a tabela de metas derivadas (entra por revisão depois de E15, DEC-098); o valor declarado aqui é o que o tracker propõe registrar. Se a revisão registrar outro valor, a constante do teste muda para ele.

### Testes (só nos arquivos do card)

`scaffold.test.mjs`, em pasta temporária com repositório git próprio quando o caso pede git (o checker sem git só dá o aviso `no-git`):

- Critério 1: `model-full.json` → exit 0, `checkRoadmap` com 0 erros na pasta gerada; as arestas do Mermaid são exatamente o conjunto das dependências dos cards; os cards com `critical=true` são exatamente os das cadeias máximas, e a linha do caminho crítico é uma delas; tabela de visão geral e coluna Entregáveis dos requisitos batem com os cards. Um segundo modelo com um empate de cadeias e um card isolado prova a regra do empate.
- Critério 2: `model-mid.json` → exit 0 com stdin fechado e sem tempo de espera; todos os arquivos da pasta e a estratégia existem; checker com 0 erros; cada requisito, card, critério, fonte e resposta do modelo aparece literal no arquivo certo; `defaulted` lista só campos que o modelo não tem; nenhum campo presente no modelo foi substituído por padrão.
- Recusas: ciclo, dependência inexistente, critério sem `verify`, pasta de roadmap existente sem modelo → exit 1 e nenhum arquivo gravado; `--dry-run` não grava; `--json` tem a forma desta seção e o mesmo código de saída.
- Determinismo: duas execuções sobre o mesmo modelo geram os mesmos bytes; finais de linha LF.

`prose-budget.test.mjs`: as três conferências da seção anterior.

### Execução comportamental (critério 4) e teste comportamental do fluxo

Feitos pelo executor numa tarefa do plano, na worktree do entregável, sem efeito externo (subagents locais, sem push):

1. Revisor: um subagent novo em opus/medium, só leitura, com o brief do passo 7 e `review-rubric.md`, sobre `fixtures/review-planted/`. Registro: a saída JSON literal, a comparação com `expected-findings.json` (cada defeito plantado com achado de mesmo arquivo e regra, e a severidade) e os achados extras. Se faltar um, corrige-se a rubrica e roda-se de novo, com as duas execuções registradas.
2. Fluxo (regra de SRC-03): um subagent segue o SKILL ao pé da letra a partir de um `planning-model.json` do meio do planejamento numa pasta temporária (retomada do passo 0, passo 6 com o scaffold, checker do passo 7), e uma revisão adversarial confere o resultado.

O relatório vai para `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md`, escrito pelo orquestrador (subagents não gravam arquivos com nome de relatório). O aceite do critério 4 é do dono.

### Verificação fora dos testes

Antes de cada commit: G1 a G5 (G3 e G5 porque o plugin muda; G4 porque o checker não muda e precisa seguir verde). `claude plugin validate plugins/productivity-tools` com o SKILL alterado; o lint confere o frontmatter, que não muda.

## Deixado ao planejador

- Ordem e divisão das tarefas em até quatro arquivos cada. Ordem natural: modelo e validação; derivações e renderização; CLI e gravação; fixtures e `scaffold.test.mjs`; `model.md` e a skill (passos 0, 5, 6); rubrica, passo 7 e fixture plantada; exemplos e cortes de repetição com `prose-budget.test.mjs`; execução comportamental e relatório.
- Textos exatos das mensagens, títulos de seção por idioma (en e pt) e a redação de `model.md` e da rubrica, dentro dos campos e regras fixados aqui.
- O conteúdo das fixtures, desde que cubram os casos listados.

## Decisões autônomas (revisáveis pelo dono)

1. O modelo estruturado é `planning-model.json` na pasta do roadmap e substitui `planning-draft.md` como rascunho de retomada (peças 1 e 2 num só arquivo). Alcance: contrato.
2. O scaffold é `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.mjs`, forma `node scaffold.mjs <modelo> [--dry-run] [--json]`, saída `--json` `{tool, model, folder, written, defaulted, errors, warnings, summary}` no molde de DEC-112, exit 0 gerado, 1 recusado sem gravar, 2 uso ou gravação. Alcance: contrato.
3. Campos e obrigatórios do modelo como na seção "O modelo", documentados em `references/model.md`, com `modelVersion` 1. Alcance: contrato.
4. Campo ausente com padrão declarado não é recusa: o scaffold aplica o padrão (os do modo leve para card; "nenhum" para prosa; seção omitida para métricas e flags; sem tabela de gates) e lista em `defaulted`. Alcance: local.
5. `critical` é derivado: cards em qualquer cadeia de dependências de comprimento máximo em entregáveis; o valor do modelo é ignorado; a linha do caminho crítico mostra a primeira cadeia máxima em ordem de id. Alcance: contrato.
6. O scaffold só grava se o checker em memória der 0 erros na pasta gerada, e recusa pasta com config e sem modelo. Alcance: local.
7. Vocabulário padrão: `pt*` usa o de `docs/plans/roadmap-evolucao-skills/roadmap.config.json` (constante no script), os demais idiomas o de `formats.md` §2. Alcance: local.
8. O scaffold importa o parser de `lib/roadmap-format.mjs` e funções exportadas do checker irmão, como `roadmap.mjs`; nenhuma regeneração do checker. Alcance: local.
9. `formats.md` fica onde está e só troca a linha do layout; o contexto principal do planner deixa de lê-lo inteiro e o consulta por seção. Alcance: local.
10. Contador de prosa: bytes LF de `SKILL.md`, `clarify.md`, `decompose.md` e `model.md`; `formats.md` e `review-rubric.md` excluídos com motivo; linha de base 74.602 LF (= 75.531 CRLF de SRC-02 §1, commit `bf9d948`); meta derivada 43.335 bytes LF. Alcance: contrato.
11. A meta fica como constante no teste até a estratégia registrar a tabela de metas; se a revisão registrar outro valor, a constante segue a estratégia. Alcance: local.
12. A rubrica fica em `references/review-rubric.md`, lida só pelo revisor; regras e severidades da tabela da seção "Rubrica"; saída JSON `{findings:[{file,line,rule,severity,evidence,fix}], summary}`. Alcance: contrato.
13. Laço do revisor: nova rodada só quando a anterior teve achado `error`, teto de três rodadas no total; o revisor continua opus/medium e só no modo completo (DEC-021). Alcance: local.
14. Um `planning-draft.md` antigo é lido uma vez e convertido no modelo; sem leitura permanente nem script de migração. Alcance: local.
15. Repetições cortadas: padrões do modo leve só em `decompose.md` §12, orçamento de perguntas só na regra 6, passe de cobertura só em `decompose.md` §11. Alcance: local.
16. O card de exemplo em JSON de `model.md` é o mesmo card do exemplo trabalhado de `decompose.md`, para não repetir. Alcance: local.
17. A execução comportamental do critério 4 e o teste comportamental do fluxo são feitos pelo executor com subagents locais, e o relatório vai para `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md`, escrito pelo orquestrador. Alcance: local.
18. Nenhuma versão sobe nesta branch; a publicação que levar E4 sobe `productivity-tools` (DEC-042). Alcance: local.

## Depende de entrada humana

Nada bloqueia a entrega. Os critérios 1 a 3 são `verify: test`, e o card não pede efeito externo (sem push, sem publicação, sem credencial).

- Aceite do critério 4 pelo dono: conferir o relatório comportamental em `docs/reports/`. O executor produz a execução e o registro; o aceite não é registrado por ele.
- Registro da meta derivada de prosa na estratégia (revisão proposta pelo tracker depois de E15 e gravada só com aprovação do dono, DEC-034, DEC-098). Até lá, o teste usa a constante declarada aqui.
- Ratificação pelo dono das decisões acima (DEC-030); as de alcance contrato (1, 2, 3, 5, 10 e 12) seguram o início de E20, que edita a skill do planner, sem impedir a entrega de E4.
- E4 se apoia em decisões de contrato de E2 ainda pendentes de ratificação (por exemplo DEC-112). Se o dono rejeitar alguma, E4 recebe um bloqueio até a correção; o desenho não espera por isso.
