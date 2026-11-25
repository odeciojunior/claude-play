# Spec E45 -- Diagnósticos do preflight

Roadmap: `docs/plans/roadmap-pos-2-6-0/` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, card E45). Requisitos: REQ-005, REQ-006, REQ-007. Detalhe técnico: tarefas A3 mínimo, B2 e B3 de `docs/plans/2026-11-25-correcoes-issues-plan.md` (SRC-02; issues #4, #5 e #7, SRC-03). Decisão vigente: DEC-010 (A3 só no mínimo). Sem dependências.

Caminhos curtos abaixo são relativos a `plugins/productivity-tools/skills/roadmap-release/`.

## Intenção

Três falhas do preflight do roadmap-release hoje param a execução ou a deixam seguir sem explicar a causa:

1. Um commit no branch durante a descoberta em fatias faz a fatia seguinte falhar com `slice k does not exist`, sem dizer que o branch mudou (#4).
2. Um `release.config.json` no alvo diferente do da árvore de trabalho é usado em silêncio, mesmo quando o alvo está atrás do base (#5).
3. O preflight mede só a cópia do workflow do cache. Se o nome do Workflow carregar a cópia do clone do marketplace, a medida olha o arquivo errado e os docs mandam editar o arquivo errado (#7).

O E45 dá a cada falha uma mensagem com a causa. Sem mudar o `roadmap-release.js`, mede as duas cópias e documenta qual delas o nome carrega, depois de confirmar isso numa sessão headless.

## Escopo

**Dentro:**
- `scripts/preflight.mjs`:
  - envelope das fatias com o SHA lido;
  - mensagem "de X para Y" quando a fatia pedida não existe mais;
  - aviso de config divergente, com dica de fast-forward;
  - medida do clone do marketplace.
- `scripts/preflight.test.mjs` e `workflow/docs.test.mjs`.
- `SKILL.md` (passos 2 e 4), `references/operator.md` e `references/config.md`:
  - nota sobre não comitar no base durante a execução;
  - "used as is" reescrito;
  - qual cópia o nome carrega.
- A confirmação headless da cópia carregada, como primeira tarefa do plano, com a evidência no `log.md` do roadmap. A DEC de executor e a revisão da ASSUMPTION só entram se a premissa se mostrar falsa.

**Fora:**
- A fixação completa por SHA (`--at <sha>`, `discCmd`/`readSlices` repassando o SHA, `checkSlice` com cabeçalho novo). Fica fora por DEC-010 e DEC-019.
- Qualquer edição em `workflow/roadmap-release.js`, `workflow/roadmap-release-agy.py` e `lib/`. O `roadmap-release.js` tem fila própria (E42, E43, E46 a E49, DEC-005), e a trava de 284.500 é da DEC-007.
- Bump de versão (DEC-042).

**O que não fazer:**
- Não editar o `~/.claude` real na confirmação.
- Não deixar a descoberta rodar na sessão headless.
- Não passar de 2 tentativas.
- Não executar o fast-forward: a dica é só texto (resposta Q4 do dono).
- Não remover nem afrouxar os testes E34 do limite de 524.288 bytes (DEC-004).

## Design

**Tarefa 1: confirmação da cópia carregada (antes da peça de docs, resposta Q1 do dono).**

Montagem:
- Um subagente opus dirige uma sessão `claude` headless com `CLAUDE_CONFIG_DIR` apontando para uma pasta descartável no scratchpad.
- Nessa pasta, o marketplace `claude-play` é adicionado a partir do git, e `productivity-tools` é instalado dela.
- A sessão headless precisa de credencial no `CLAUDE_CONFIG_DIR` descartável: copie só o `.credentials.json` do `~/.claude` real (leitura, sem editar) ou use `CLAUDE_CODE_OAUTH_TOKEN`. Uma falha de autenticação antes do lançamento do Workflow não conta entre as 2 tentativas. Apague a pasta descartável ao final.
- Um comentário marcador diferente entra no `roadmap-release.js` do clone (`<cfg>/plugins/marketplaces/<mkt>/...`) e no do cache (`<cfg>/plugins/cache/<mkt>/productivity-tools/<versão>/...`).

Disparo e leitura:
- O Workflow é lançado pelo nome `productivity-tools:release-workflow` com `args` `{}`. O workflow retorna em `roadmap-release.js:1602` (`args.config is missing`) antes de qualquer agente, então a descoberta não roda.
- Lê-se qual marcador aparece em `<sessão>/workflows/scripts/release-workflow-<run>.js`.
- No máximo 2 tentativas. A evidência vai para o `log.md` do roadmap: marcadores, caminho do script da sessão e desfecho.

Os três desfechos fixam a constante `LOADED_BY_NAME` de R7 e o texto dos docs:
- **Clone (premissa confirmada):**
  - `LOADED_BY_NAME = 'clone'`;
  - os docs dizem que o nome carrega o clone, que editar o cache não tem efeito no lançamento pelo nome, que o fallback `scriptPath` `<dir>/workflow/roadmap-release.js` carrega o cache e que o contorno é usar a cópia da sessão;
  - a ASSUMPTION fica confirmada no log.
- **Cache (premissa falsa, resposta Q2):**
  - `LOADED_BY_NAME = 'cache'`;
  - os docs dizem que vale o cache;
  - o preflight continua medindo as duas cópias e avisando a divergência, e o erro de 524.288 bytes fica só na cópia carregada (o cache);
  - o executor registra uma DEC de origem executor e revisa a ASSUMPTION da estratégia.
- **Inconclusivo (resposta Q3):**
  - `LOADED_BY_NAME = 'both'`;
  - os docs citam as duas cópias e recomendam a cópia da sessão por `scriptPath`;
  - o limite de 524.288 bytes vale para as duas, e a ASSUMPTION permanece.

**AC1: mensagem de X para Y (A3 mínimo, DEC-010).**

Mudanças em `scripts/preflight.mjs`:
- `discoverCli` resolve, antes de `sliceEnvelopes`, o SHA dos refs que a descoberta leu: `readFrom` quando é um ref e o ref de merges (`target` ou base) quando difere. Cada um sai de `gitTry(root, ['rev-parse', '--verify', '--quiet', '<ref>^{commit}'])`.
- O SHA entra no cabeçalho passado a `sliceEnvelopes` como `at: [{ ref, sha }]`. Assim fica no envelope da fatia 0, e em todas, coberto pelo `digest` (R2).
- Quando a leitura vem da árvore de trabalho, `at` fica vazio.
- `checkSlice` e `joinSlices` (`lib/plan-digest.mjs:205`, `:220`) aceitam o campo a mais sem mudança, porque o digest cobre o envelope inteiro.

No ramo `slice >= envs.length` (`preflight.mjs:667`):
- Para cada ref de `at` cujo SHA anterior (`<ref>@{1}` no reflog, R1) difere do atual, a mensagem passa a ser `the branch <ref> changed during the discovery (from <X> to <Y>); do not commit to it while roadmap-release runs, then run again`.
- Sem reflog, a mensagem diz `(now at <Y>; the SHA read first is in slice 0)`.
- Lida da árvore de trabalho, diz que a descoberta mudou entre fatias.
- O código de saída continua 1. O `readSlices` do workflow já devolve esse texto como `slice k: release-discovery refused: ...`, sem mudança.

A nota "não comitar no branch base (nem no alvo) enquanto o roadmap-release roda; uma descoberta perdida custa cerca de 23 agentes e 250 mil tokens" entra no passo 2 de `SKILL.md` e em `references/operator.md`.

O teste em `scripts/preflight.test.mjs`, junto aos testes `E41 T9` (`discRepo`, `discCli`):
- lê a fatia 0;
- comita um card que aumenta a descoberta;
- pede a última fatia da contagem nova e confere que a mensagem traz o SHA de antes e o de depois;
- com a mesma contagem, confere que o `at` do envelope muda. O `joinSlices` acusa `different reads` pelo `total.sha256` do texto, e não pelo `at`, então o commit do teste precisa mudar o texto da descoberta.

**AC2: config divergente e dica de fast-forward (B2).**

Em `runPreflight` (`preflight.mjs:547-553`), quando `onRef !== null` e existe `release.config.json` na árvore de trabalho:
- O preflight compara `canon(JSON.parse(onRef))` com `canon(readJson(configPath))`.
- Se diferirem, entra em `warnings`: `release.config.json on <ref> differs from the working tree in: <chaves>; the one on <ref> applies`. As chaves são as de primeiro nível que diferem, inclusive as presentes de um só lado (R5).
- Se o alvo for ancestral estrito do base (`isAncestor`, `preflight.mjs:424`, e SHAs diferentes), a mesma linha ganha `<ref> is N commits behind <base>; fast-forward it to take the working-tree config`, com N de `git rev-list --count <ref>..<base>`.
- O base vem da opção nova `base` (CLI `--base <b>`) e, sem ela, do `integrationBranch` do `roadmap.config.json` da pasta (R4).
- Sem config na árvore de trabalho, sem config no ref ou com JSON inválido de um lado, não há aviso de divergência. O JSON inválido no ref já é erro.

O "used as is" de `SKILL.md:28` e o texto de `--ref` em `references/config.md:54` passam a dizer que o arquivo do alvo vale e que uma divergência com a árvore de trabalho aparece em `warnings`. O passo 2 de `SKILL.md` diz para passar `--base <args.baseBranch>` quando houver.

Testes em `scripts/preflight.test.mjs`, no modelo de `runPreflight --ref uses the reviewed config` (`:222`), com quatro casos:
- configs diferentes: aviso com as chaves;
- iguais: sem aviso;
- sem config na árvore: sem aviso;
- alvo ancestral do base: aviso com N e `fast-forward`.

**AC3: medida do clone e erro de 524.288 bytes (B3).**

Em `runPreflight`, depois da medida atual (`preflight.mjs:574-580`), o preflight procura o clone em `<configDir || home/.claude>/plugins/marketplaces/<mkt>/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`:
- `<mkt>` sai do caminho do cache (`trackerFrom` dentro de `plugins/cache/<mkt>/productivity-tools/<versão>/`).
- Fora do cache (laço de desenvolvimento), entra cada pasta de `plugins/marketplaces/*` que tenha o arquivo (R6).
- Clone ausente, inclusive de marketplace local sem pasta em `marketplaces/`, não gera erro nem aviso.

Para cada clone achado:
- O preflight compara o tamanho em disco e o sha256 dos bytes com os da cópia do cache.
- Se diferirem, entra em `warnings`: `the release workflow clone <p> differs from the cache copy <wfPath> (<a> vs <b> bytes, sha256 ...); launching by name loads <cópia de LOADED_BY_NAME>`.
- Um clone acima de `MAX_WORKFLOW_LAUNCH_BYTES` dá erro quando `LOADED_BY_NAME` é `clone` ou `both`, e aviso quando é `cache` (R7).
- O erro atual do cache (`:578`) continua em todos os desfechos, para não afrouxar os testes E34 (`preflight.test.mjs:1195-1238`).

Testes em `scripts/preflight.test.mjs`, com `home` fictício e `configDir: null`, com quatro casos:
- clone maior que 524.288 bytes: erro;
- clone diferente e pequeno: só aviso;
- clone ausente: nada;
- marketplace local: nada.

`workflow/docs.test.mjs` estende o teste `the scriptPath fallback states the dialog limit` (`:67-76`), sem tirar asserts. O passo 4 de `SKILL.md` e `references/operator.md` passam a dizer qual cópia o nome carrega, conforme o desfecho da tarefa 1. Também dizem que o preflight mede o clone e o cache e avisa a divergência.

## Deixado para o plano

- A ordem das tarefas:
  - confirmação headless primeiro;
  - código no `preflight.mjs` em série (A3, B2, B3), porque é arquivo quente (SRC-02, "Arquivos quentes");
  - docs por último, com o desfecho da tarefa 1.
- O nome exato do marcador e do diretório descartável.
- O texto final das mensagens em inglês, dentro das formas acima.
- O tier de cada tarefa. A confirmação usa opus por regra do dono; o código, T1.

```json data
{
  "schema": "spec/1",
  "id": "E45",
  "title": "Diagnósticos do preflight",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um commit no branch entre duas fatias da descoberta, quando a fatia seguinte é lida, então a mensagem diz que o branch mudou de X para Y. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dados configs diferentes no alvo e na árvore de trabalho, quando o preflight roda com --ref, então avisa as chaves divergentes e, com o alvo atrás do base, sugere fast-forward. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado um clone do marketplace diferente do cache, quando o preflight roda, então avisa a diferença e dá erro acima de 524.288 bytes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "De onde a fatia seguinte tira o SHA anterior (X) para a mensagem de X para Y?",
      "decision": "Do reflog do ref (<ref>@{1}) no momento da falha; sem reflog, a mensagem dá só o SHA atual e aponta o envelope da fatia 0, que guarda o SHA lido.",
      "basis": "Passar X pelo workflow exigiria editar discCmd/readSlices do roadmap-release.js, fora da fila do E45 (DEC-005) e fora do mínimo da DEC-010; no caso da #4 (um commit durante a descoberta) o reflog dá exatamente X.",
      "alternative": "Flag nova no discover (por exemplo --seen <sha>) repassada pelo workflow a partir do envelope da fatia 0.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como gravar o SHA no envelope da fatia 0 sem mexer em lib/?",
      "decision": "Como campo at: [{ ref, sha }] do cabeçalho passado a sliceEnvelopes, que o põe em todos os envelopes e o cobre pelo digest.",
      "basis": "sliceEnvelopes já calcula o espaço da fatia com o cabeçalho; checkSlice e joinSlices aceitam campos a mais; só a fatia 0 exigiria reassinar fora do cálculo de espaço ou editar lib/plan-digest.mjs (embed nos 4 alvos).",
      "alternative": "Campo só na fatia 0, com mudança em lib/plan-digest.mjs e embed.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Em que língua ficam as mensagens novas do preflight?",
      "decision": "Em inglês, como todas as mensagens de preflight.mjs; os testes conferem os SHAs e as palavras-chave (changed, from, to, fast-forward, differs).",
      "basis": "O arquivo e os testes existentes usam inglês; misturar línguas na saída JSON confunde o relatório do skill.",
      "alternative": "Mensagens em pt-BR, literais do comentário do dono na #4.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Qual é o base para a dica de fast-forward do B2?",
      "decision": "A opção nova base (CLI --base <b>), e sem ela o integrationBranch do roadmap.config.json da pasta; N = git rev-list --count <ref>..<base>.",
      "basis": "É a mesma regra de base do passo 3 do SKILL.md (args.baseBranch, senão integrationBranch); runPreflight hoje não recebe base.",
      "alternative": "Comparar o alvo com o HEAD da árvore de trabalho.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Com que granularidade o aviso lista as chaves divergentes?",
      "decision": "Chaves de primeiro nível, comparadas por canon, incluindo as presentes de um só lado.",
      "basis": "O config tem poucas chaves de primeiro nível (gates, install, locks, taskReview...) e a pessoa só precisa saber onde olhar; caminhos profundos alongam a linha sem ajudar a decisão.",
      "alternative": "Caminhos completos (gates[1].cmd).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Qual clone do marketplace o preflight mede?",
      "decision": "O de plugins/marketplaces/<mkt>/ com <mkt> tirado do caminho do cache onde o preflight roda; fora do cache, cada marketplaces/* que tenha o arquivo; marketplace local sem pasta em marketplaces/ conta como clone ausente.",
      "basis": "SRC-02 (B3) fixa o caminho plugins/marketplaces/*/plugins/productivity-tools/... e manda clone ausente não ser erro; o nome do marketplace no caminho do cache evita medir um clone de outro marketplace.",
      "alternative": "Ler plugins/known_marketplaces.json para achar installLocation.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Em que cópia vale o erro de 524.288 bytes em cada desfecho da confirmação?",
      "decision": "Uma constante LOADED_BY_NAME em preflight.mjs ('clone', 'cache' ou 'both', padrão 'both' até a tarefa 1) decide: o clone acima do limite dá erro em 'clone' e 'both' e aviso em 'cache'; o erro do cache continua em todos os desfechos.",
      "basis": "Respostas Q2 e Q3 do dono fixam 'cache' e 'both'; para 'clone' o dono não fixou o cache, e tirar o erro dele afrouxaria os testes E34 (DEC-004); o fallback scriptPath carrega o cache.",
      "alternative": "No desfecho 'clone', rebaixar o erro do cache a aviso.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Sessão claude headless dirigida por subagente opus, com CLAUDE_CONFIG_DIR descartável, lançando productivity-tools:release-workflow pelo nome com args {} (até 2 tentativas; gasto pago pequeno, autorizado pelo dono na resposta Q1).",
      "target": "conta Claude do dono (uso de modelo)"
    },
    {
      "id": "X2",
      "what": "Adicionar o marketplace claude-play a partir do git e instalar productivity-tools dentro do CLAUDE_CONFIG_DIR descartável (leitura de rede; nada no ~/.claude real).",
      "target": "repositório git remoto do marketplace (leitura) e pasta descartável no scratchpad"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Fatia pedida além da contagem nova, com o ref sem reflog.",
      "expected": "Mensagem diz que o branch mudou, com o SHA atual e a indicação de que o SHA lido está na fatia 0; saída 1."
    },
    {
      "id": "C2",
      "input": "Descoberta lida da árvore de trabalho (sem ref) e a contagem de fatias muda.",
      "expected": "at vazio nos envelopes; mensagem diz que a descoberta mudou entre fatias e pede para não editar nem comitar durante a execução."
    },
    {
      "id": "C3",
      "input": "Config igual no alvo e na árvore de trabalho, ou ausente na árvore de trabalho.",
      "expected": "Nenhum aviso de divergência."
    },
    {
      "id": "C4",
      "input": "Configs diferentes e o alvo não é ancestral do base (ou é o mesmo commit).",
      "expected": "Aviso com as chaves divergentes e 'the one on <ref> applies', sem dica de fast-forward."
    },
    {
      "id": "C5",
      "input": "Clone ausente, marketplace local sem pasta em plugins/marketplaces/, ou clone idêntico ao cache em bytes.",
      "expected": "Nem erro nem aviso sobre o clone."
    }
  ]
}
```
