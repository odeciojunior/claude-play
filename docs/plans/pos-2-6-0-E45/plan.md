# Plano E45 -- Diagnósticos do preflight

Spec: `docs/plans/pos-2-6-0-E45/spec.md`. Roadmap: `docs/plans/roadmap-pos-2-6-0/`. Branch `plan/pos-2-6-0-E45`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E45`, com merge em `release/pos-2.6.0` depois da conferência. Todos os caminhos deste plano são relativos à raiz do repositório, e todo comando e check roda com o diretório atual na raiz desse worktree. Linha de base do G1, medida no merge do E51 (`4329c5e`): exit 0, tests 2660, pass 2658, fail 0, skipped 2. O bloco de dados no fim é o contrato.

## Ordem

1. Confirmação headless da cópia carregada (efeitos externos X1 e X2).
2. A3 mínimo no `preflight.mjs`.
3. B2 no `preflight.mjs`.
4. B3 no `preflight.mjs`, com o desfecho da tarefa 1.
5. Docs, com o desfecho da tarefa 1.

A série é estrita porque `preflight.mjs` é arquivo quente. Abaixo, `RR` abrevia `plugins/productivity-tools/skills/roadmap-release` só na prosa.

Cada tarefa de código segue o mesmo ciclo: escrever os testes, ver falhar, implementar, ver passar, rodar os `checks` e commitar só os arquivos da tarefa (`type(scope): description`).

## Tarefas

### Tarefa 1: Confirmar em sessão headless a cópia que o nome carrega

Sem código no repositório. Um subagente opus executa (regra do dono). Gasto autorizado pela DEC-025 e credencial pela DEC-026. Se o executor exigir um item `authorizeExternal` para a tarefa, ele vem da mensagem da pessoa, nunca é inventado.

A tarefa não escreve na pasta do roadmap (o `plan/1` reserva isso às etapas de registro). O livro de tentativas e a evidência vão para `docs/plans/pos-2-6-0-E45/confirmacao.md`, e a etapa de registro os leva ao `log.md`.

**Antes de qualquer coisa (dedupe).** Ler `confirmacao.md` e o `log.md` do roadmap. Se algum já tiver `LOADED_BY_NAME=`, não lançar nada e encerrar a tarefa. Contar as linhas `tentativa N de 2 lançada` do `confirmacao.md` menos as linhas `tentativa N anulada (autenticação)`; com 2, não lançar: registrar `LOADED_BY_NAME=both`.

**Montagem (X2).**
- Antes de montar, conferir sem modelo que `claude --help` lista `--max-budget-usd`. Sem a opção, não lançar: desfecho `both`.
- Antes de montar, gravar no `confirmacao.md` o caminho de `c45` e `p45` relativo a `os.tmpdir()` (sem o nome de usuário). Na retomada, reconstruir com `path.join(os.tmpdir(), rel)` e apagar as sobras desses caminhos antes de tudo. Se a retomada for em outra máquina ou com outro usuário (o caminho não resolve), anotar a sobra no `confirmacao.md` como pendência de limpeza e não lançar: desfecho `both`.
- Montagem, lançamento e leitura ficam num script Node no scratchpad, fora do repositório, com `try/finally` que chama `fs.rmSync` só em `c45` e `p45` e depois confirma que as pastas não existem. Antes de cada `rmSync`, o script confere que o caminho resolvido fica dentro de `os.tmpdir()` e termina em `c45` ou `p45`.
- Registrar o sha256 de `~/.claude/settings.json` e de `~/.claude/plugins/known_marketplaces.json` antes da montagem e depois da limpeza (só leitura). Se algum mudar, parar e escalar.
- Pastas descartáveis novas e vazias no scratchpad da sessão executora: `<scratchpad>/c45` (o `CLAUDE_CONFIG_DIR`) e `<scratchpad>/p45` (pasta de trabalho da sessão filha). Nomes curtos por causa do limite de caminho do Windows.
- Ambiente de todo processo `claude` filho: sem as variáveis `CLAUDE*` herdadas (exceto `CLAUDE_CODE_OAUTH_TOKEN` e `CLAUDE_CODE_GIT_BASH_PATH`), com `CLAUDE_CONFIG_DIR=<scratchpad>/c45`, `DISABLE_AUTOUPDATER=1` e `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`.
- `claude plugin marketplace add https://github.com/odeciojunior/claude-play` e `claude plugin install productivity-tools@claude-play`.
- Conferir que os caminhos de instalação gravados em `c45/plugins/` ficam todos sob `c45`. O `~/.claude` real nunca é editado.
- Conferir que as duas cópias abaixo têm o texto `args.config is missing or has no gates` e que, na versão instalada, esse retorno vem antes de qualquer chamada de agente. Se não, não lançar: desfecho `both`.
  - Clone: `c45/plugins/marketplaces/claude-play/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`.
  - Cache: `c45/plugins/cache/claude-play/productivity-tools/<versão>/skills/roadmap-release/workflow/roadmap-release.js`.
- Acrescentar como última linha: `// E45-MARCA-CLONE` no clone e `// E45-MARCA-CACHE` no cache.
- Credencial: `CLAUDE_CODE_OAUTH_TOKEN` quando estiver definida; senão copiar só `~/.claude/.credentials.json` (leitura) para `c45/.credentials.json`. Preferir o token. Copiar o arquivo só por cópia de arquivo (`fs.copyFileSync`, `cp` ou `Copy-Item`), nunca com Read ou `cat`. Nunca imprimir o conteúdo nem o valor, nem listar o ambiente sem filtro.

**Lançamento (X1), no máximo 2 tentativas.**
- Antes de cada lançamento, gravar e commitar no `confirmacao.md` a linha `tentativa N de 2 lançada: sessão <uuid>`.
- Com a pasta de trabalho em `p45`, uma sessão: `claude -p "<pedido>" --session-id <uuid novo> --model sonnet --permission-mode default --max-budget-usd 1 --output-format json --allowedTools "Workflow(productivity-tools:release-workflow)" --disallowedTools "Bash" "PowerShell" "Edit" "Write" "Agent" "Skill" "WebFetch" "WebSearch" "NotebookEdit"`, com tempo limite de 10 minutos para o `claude -p`.
- O pedido manda chamar a ferramenta Workflow uma única vez, com `name` `productivity-tools:release-workflow` e `args` `{}`, sem `scriptPath`, sem repetir e sem outra ferramenta, e devolver o resultado literal.
- O resultado esperado é o erro `args.config is missing or has no gates` (a descoberta não roda). Se aparecer qualquer sinal de agente do workflow, encerrar a sessão, não tentar de novo e anotar o fato.
- Falha de autenticação antes do lançamento do Workflow não conta: trocar a forma da credencial, e anotar no `confirmacao.md` a linha `tentativa N anulada (autenticação)`. Se nenhuma das duas formas autenticar, ou a montagem falhar, registrar `LOADED_BY_NAME=both` sem gastar tentativa.

**Leitura.** Achar `c45/projects/*/<uuid>/workflows/scripts/release-workflow-<run>.js` e ver qual marcador ele tem; conferir que os dois marcadores continuam nos arquivos de origem. Só um marcador no script: tentativa conclusiva, não há segunda. Script ausente, nenhum marcador, os dois, ou marcador sumido na origem: inconclusiva.

**Desfecho e evidência.** No `confirmacao.md`: marcadores, versão instalada, caminho do script da sessão a partir do `<uuid>`, resultado literal e uma linha própria, no início da linha, com `LOADED_BY_NAME=clone`, `LOADED_BY_NAME=cache` ou `LOADED_BY_NAME=both`.
- `clone`: anotar que a ASSUMPTION foi confirmada.
- `cache` (premissa falsa): escrever no `confirmacao.md` o texto proposto da DEC e da revisão da ASSUMPTION (linha nova, Changelog, versão seguinte); a estratégia não é tocada pela tarefa.
- `both`: a ASSUMPTION permanece.

**Limpeza.** Apagar `c45` e `p45` ao fim, em qualquer desfecho, inclusive falha, e conferir que não existem mais. Depois commitar o `confirmacao.md`.

**Etapa de registro (do executor, fora das tarefas, obrigatória).** Levar a evidência ao `docs/plans/roadmap-pos-2-6-0/log.md` com `roadmap.mjs log ... --deliverable E45` (células de até 300 caracteres: marcadores, caminho do script, desfecho, e no `clone` a confirmação da ASSUMPTION). No desfecho `cache`, registrar também a DEC de origem executor com `roadmap.mjs add-decision ... --deliverable E45 --scope local`, usando o próximo id livre. No `cache`, propor a revisão pelo roadmap-tracker, obter a aprovação por subagente opus (DEC-021) e só então escrevê-la; sem aprovação, deixar um item pendente em `state.md`. Rodar o checker do roadmap com 0 erros.

### Tarefa 2: Mensagem de X para Y quando o branch muda durante a descoberta

Arquivos: `RR/scripts/preflight.mjs` e `RR/scripts/preflight.test.mjs`. Não editar `lib/`, o `roadmap-release.js` nem o `.py`.

**Assinaturas.**
- `discoverRoadmap(opts, seen = {})`: preenche `seen.refs` com `readFrom` e o ref de merges (`gitRef`), sem repetir. Com `readFrom === 'working tree'`, `seen.refs` é `[]`. O objeto devolvido (os dados da descoberta) não muda.
- `discoverCli`, só no caminho `--slice`: `at = [{ ref, sha }]` com `gitTry(root, ['rev-parse', '--verify', '--quiet', '<ref>^{commit}'])` para cada ref de `seen.refs`, passado no cabeçalho de `sliceEnvelopes`. `--page` não muda.

**Mensagens no ramo `slice >= envs.length`** (saída 1, mesmo formato `{ tool, error }`):
- Para cada ref de `at` cujo `<ref>@{1}` existe e difere do atual: `the branch <ref> changed during the discovery (from <X> (previous reflog entry) to <Y>); do not commit to it while roadmap-release runs, then run again`. Várias cláusulas são unidas por `. `.
- Se nenhum ref se qualifica (sem reflog ou entrada anterior igual), para cada ref de `at`: `the branch <ref> changed during the discovery (now at <Y>; the SHA read first is in slice 0); do not commit to it while roadmap-release runs, then run again`.
- `at` vazio: `the discovery changed between slices (read from the working tree); do not edit or commit while roadmap-release runs, then run again`.

**Testes**, junto aos `E41 T9`, com `discRepo`, `discCli` e `bigBlockers`:
- ler a fatia 0, commitar mais bloqueios (a descoberta cresce) e pedir o índice igual à contagem nova (o primeiro inexistente): a mensagem traz o SHA de antes e o de depois;
- ler com a descoberta grande, commitar a redução e pedir a última fatia da contagem antiga (caso da #4): mesma conferência;
- commit que muda o texto sem mudar a contagem: o `at` do envelope muda, e `joinSlices` da fatia 0 antiga com as novas acusa `different reads`;
- sem reflog (`core.logAllRefUpdates=false` e `.git/logs` removida): `now at <Y>` e `slice 0`;
- leitura da árvore de trabalho (`integrationBranch` da fixture apontando para um branch inexistente): `at` vazio nos envelopes e a mensagem de árvore de trabalho;
- os envelopes continuam dentro de `SLICE_BYTES` e passam em `checkSlice`.

### Tarefa 3: Aviso de config divergente e dica de fast-forward

Mesmos arquivos da tarefa 2.

**Assinaturas.** `runPreflight(folder, { ..., base = null })`; o CLI (fora do `discover`) aceita `--base <b>` e a linha de uso passa a citá-lo.

**Comportamento.** Com `onRef !== null` e `release.config.json` na árvore de trabalho, e os dois lados JSON de objeto válido: comparar por chave de primeiro nível com `canon`, incluindo chaves presentes de um só lado. Havendo diferença, um item em `warnings`: `release.config.json on <ref> differs from the working tree in: <chaves ordenadas, separadas por vírgula>; the one on <ref> applies`. O base é a opção `base`, senão o `integrationBranch` do `roadmap.config.json` da pasta. Se o ref for ancestral estrito do base (`isAncestor` e SHAs diferentes), a mesma linha ganha `; <ref> is N commits behind <base>; fast-forward it to take the working-tree config`, com N de `git rev-list --count <ref>..<base>`. Nada é executado: a dica é só texto. `config`, `generated` e `errors` não mudam.

**Testes**, no modelo de `runPreflight --ref uses the reviewed config`, com `configDir: null`:
- configs diferentes e ref à frente do base: aviso com as chaves (inclusive uma só de um lado), sem `fast-forward`;
- diferentes e base igual ao ref: sem `fast-forward`;
- iguais, com ordem de chaves diferente: sem aviso;
- sem config na árvore: sem aviso;
- ref ancestral estrito do base: aviso com N e `fast-forward`, uma vez com `base` na opção, uma com o `integrationBranch` da pasta e uma pelo CLI com `--base`.

### Tarefa 4: Medir o clone do marketplace e dar o erro de 524.288 bytes

Mesmos arquivos da tarefa 2. Ler no `confirmacao.md` a linha `LOADED_BY_NAME=` da tarefa 1.

**Assinaturas.**
- `export const LOADED_BY_NAME = '<clone|cache|both>'`, com o valor do `confirmacao.md`.
- `runPreflight(folder, { ..., loadedByName = LOADED_BY_NAME })`.

**Comportamento**, depois da medida atual e só quando a cópia do cache (`wfPath`) existe:
- raiz: `<configDir || home/.claude>/plugins/marketplaces`;
- `<mkt>` vem de `trackerFrom` dentro de `plugins/cache/<mkt>/productivity-tools/<versão>/`; fora do cache, cada pasta de `marketplaces/*`;
- arquivo: `<mkt>/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; ausente não gera nada;
- bytes e sha256 iguais aos do cache (ou o mesmo caminho): nem erro nem aviso;
- diferentes: aviso `the release workflow clone <p> differs from the cache copy <wfPath> (<a> vs <b> bytes, sha256 <x> vs <y>); launching by name loads <cópia>`, onde `<cópia>` é `the clone copy <p>` (`clone`), `the cache copy <wfPath>` (`cache`) ou `either copy (not confirmed): <p> or <wfPath>` (`both`);
- clone diferente acima de `MAX_WORKFLOW_LAUNCH_BYTES`: texto `release workflow clone exceeds 524.288 bytes (512 KiB): <p> has N bytes (limit is 524288 bytes)`; em `clone` e `both` vai para `errors`, seguido de `; launching productivity-tools:release-workflow by name will fail with 'not found'` (em `both`, `may fail`); em `cache` vai para `warnings`, seguido de `; launching by name loads the cache copy`;
- o erro atual do cache fica como está em todos os desfechos.

**Testes**, com `home` fictício, `configDir: null` e `workflowPath` para a cópia do cache:
- clone com 524.289 bytes: erro em `clone` e `both`, aviso sem erro em `cache`;
- clone diferente e pequeno: só aviso, com o texto da cópia em cada um dos três valores;
- clone idêntico, clone ausente e marketplace local (só `plugins/known_marketplaces.json`, sem pasta em `marketplaces/`): nada sobre o clone;
- `trackerFrom` num cache fictício `plugins/cache/mk/productivity-tools/9.9.9/...` (com um `roadmap.mjs` de enfeite), com dois marketplaces: só o `mk` é medido;
- `LOADED_BY_NAME` é um dos três valores. Os testes `E34` ficam sem mudança.

### Tarefa 5: Documentar o aviso de commit, a config do alvo e a cópia carregada

Arquivos: `RR/SKILL.md`, `RR/references/operator.md`, `RR/references/config.md` e `RR/workflow/docs.test.mjs`. Começar pelo teste. Texto em inglês, como os arquivos. Ler o valor de `LOADED_BY_NAME`.

**Teste.** Estender `the scriptPath fallback states the dialog limit` sem tirar asserts, importando `LOADED_BY_NAME` de `../scripts/preflight.mjs`. No passo 4 do `SKILL.md` e no `operator.md`, exigir `marketplace clone`, `cache`, que o preflight mede as duas cópias e avisa a divergência, e a frase do desfecho:
- `clone`: `Launching by name loads the marketplace clone copy`, mais `session copy`;
- `cache`: `Launching by name loads the cache copy`;
- `both`: `Which copy launching by name loads is not confirmed`, mais `session copy`.

Exigir também `do not commit` no passo 2 e no `operator.md`, e a divergência em `warnings` no passo 2 e no `config.md`.

**Passo 2 do `SKILL.md`.** Dizer para passar `--base <args.baseBranch>` quando houver; reescrever "used as is": o arquivo do alvo vale, e uma divergência com o da árvore de trabalho aparece em `warnings` (com dica de fast-forward só em texto, que a skill não executa); nota: do not commit to the base branch (nor the target) while roadmap-release runs; uma descoberta perdida custa cerca de 23 agentes e 250 mil tokens. Manter `--wt-root <wtRoot>`, o trecho do limite de 524.288 bytes e os demais textos que os testes citam.

**Passo 4 do `SKILL.md` e `operator.md`**, conforme o desfecho:
- `clone`: o nome carrega o clone; editar o cache não tem efeito no lançamento pelo nome; o fallback `scriptPath` `<dir>/workflow/roadmap-release.js` carrega o cache; o contorno é relançar por `scriptPath` a cópia da sessão (`<session>/workflows/scripts/release-workflow-<run>.js`);
- `cache`: vale o cache;
- `both`: citar as duas cópias, recomendar a cópia da sessão por `scriptPath` e dizer que o limite de 524.288 bytes vale para as duas.

O contorno não afrouxa a regra do passo 4: uma negação de permissão continua sem caminho alternativo. `operator.md` leva também a nota de não comitar.

**`config.md`.** Em "Permission preflight": `--base <b>` na linha de uso, o texto de `--ref` com o aviso de divergência em `warnings` e a medida do clone do marketplace junto da do cache.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E45",
  "title": "Diagnósticos do preflight",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Não editar plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js, roadmap-release-agy.py nem plugins/productivity-tools/lib/.",
    "Sem bump de versão (DEC-003 do roadmap, DEC-042).",
    "A fixação completa por SHA (--at) fica fora (DEC-010, DEC-019).",
    "Não remover nem afrouxar os testes E34 do limite de 524.288 bytes nem os asserts existentes de docs.test.mjs (DEC-004).",
    "A dica de fast-forward é só texto: nada a executa.",
    "A única sessão claude paga é a da tarefa 1: no máximo 2 tentativas, sem deixar a descoberta rodar, com CLAUDE_CONFIG_DIR descartável, apagado ao fim (DEC-025, DEC-026); qualquer outro gasto volta ao dono via opus.",
    "O ~/.claude real nunca é editado; o valor de uma credencial nunca é impresso nem gravado no repositório.",
    "A tarefa 1 roda num subagente opus; as tarefas de código são T1.",
    "Antes do merge, o G1 e o G4 da estratégia ficam verdes; linha de base do G1 no merge do E51 (4329c5e): exit 0, tests 2660, pass 2658, fail 0, skipped 2.",
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E45, branch plan/pos-2-6-0-E45; todo comando e check roda com o diretório atual na raiz dele. Autonomia só local: sem push, tag ou comentário em issue (DEC-004)."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Confirmar em sessão headless a cópia que o nome carrega",
      "deps": [],
      "files": {
        "create": [
          "docs/plans/pos-2-6-0-E45/confirmacao.md"
        ],
        "modify": [],
        "test": []
      },
      "writes": [],
      "produces": [
        "linha LOADED_BY_NAME=<clone|cache|both> em confirmacao.md"
      ],
      "consumes": [],
      "covers": [
        "X1",
        "X2"
      ],
      "testFirst": {
        "exempt": "confirmação externa em sessão headless, sem código no repositório"
      },
      "locks": [],
      "external": true,
      "externalDedupe": "antes de lançar, ler confirmacao.md e o log.md do roadmap: com LOADED_BY_NAME= não lança; cada tentativa é gravada e commitada em confirmacao.md antes do lançamento e, com 2 contadas, não lança mais; o marketplace só é adicionado dentro de uma pasta descartável nova",
      "noCommit": false,
      "score": {
        "ambiguity": 2,
        "reasoning": 2,
        "blast": 2,
        "verifiability": 2
      },
      "checks": [
        {
          "cmd": "grep -E \"^LOADED_BY_NAME=(clone|cache|both)\" docs/plans/pos-2-6-0-E45/confirmacao.md",
          "expect": "exit 0"
        },
        {
          "cmd": "node docs/plans/roadmap-pos-2-6-0/check-roadmap.mjs docs/plans/roadmap-pos-2-6-0",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 2,
      "title": "Mensagem de X para Y quando o branch muda durante a descoberta",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "envelope de fatia com at: [{ ref, sha }] e mensagens de descoberta mudada"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C1",
        "C2"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/discovery-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 3,
      "title": "Aviso de config divergente e dica de fast-forward",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "runPreflight(folder, { base }) e CLI --base <b>, com aviso de config divergente"
      ],
      "consumes": [],
      "covers": [
        "AC2",
        "C3",
        "C4"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 4,
      "title": "Medir o clone do marketplace e dar o erro de 524.288 bytes",
      "deps": [
        1,
        3
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "export const LOADED_BY_NAME e medida do clone em runPreflight"
      ],
      "consumes": [
        {
          "task": 1,
          "sig": "linha LOADED_BY_NAME=<clone|cache|both> em confirmacao.md"
        }
      ],
      "covers": [
        "AC3",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 5,
      "title": "Documentar o aviso de commit, a config do alvo e a cópia carregada",
      "deps": [
        1,
        2,
        3,
        4
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/SKILL.md",
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md",
          "plugins/productivity-tools/skills/roadmap-release/references/config.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs"
        ]
      },
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "linha LOADED_BY_NAME=<clone|cache|both> em confirmacao.md"
        },
        {
          "task": 2,
          "sig": "envelope de fatia com at: [{ ref, sha }] e mensagens de descoberta mudada"
        },
        {
          "task": 3,
          "sig": "runPreflight(folder, { base }) e CLI --base <b>, com aviso de config divergente"
        },
        {
          "task": 4,
          "sig": "export const LOADED_BY_NAME e medida do clone em runPreflight"
        }
      ],
      "covers": [
        "AC1",
        "AC2",
        "AC3"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como ordenar as cinco tarefas?",
      "decision": "Série estrita: confirmação, A3, B2, B3 e docs.",
      "basis": "A spec manda a confirmação primeiro, o preflight.mjs em série (arquivo quente) e os docs por último.",
      "alternative": "A3 e B2 em paralelo com a confirmação, pois não dependem do desfecho.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Com que modelo, teto de gasto e ferramentas roda a sessão headless?",
      "decision": "Modelo sonnet, --max-budget-usd 1 por tentativa, só a regra do Workflow permitida e Bash, PowerShell, Edit, Write, Agent, Skill, WebFetch, WebSearch e NotebookEdit negados; o subagente que a dirige é opus.",
      "basis": "A DEC-025 autoriza um gasto pequeno e a sessão só precisa fazer uma chamada de ferramenta; a regra do dono fixa opus para o condutor.",
      "alternative": "Sessão em haiku (mais barata, com mais risco de gastar uma tentativa com chamada errada) ou em opus.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como contar as tentativas e o que fazer se nenhuma puder ser lançada?",
      "decision": "Uma linha no confirmacao.md, commitada antes de cada lançamento; se a montagem ou as duas formas de credencial falharem antes de lançar, o desfecho é both, sem gastar tentativa.",
      "basis": "O scratchpad não sobrevive a outra sessão e um arquivo commitado sobrevive; both é o desfecho inconclusivo da resposta Q3 e é o mais conservador.",
      "alternative": "Parar o entregável e pedir a pessoa quando o login falhar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "De onde discoverCli tira o ref de merges?",
      "decision": "De um segundo parâmetro opcional seen de discoverRoadmap, que recebe os refs lidos sem mudar os dados da descoberta.",
      "basis": "Recalcular fora usaria o integrationBranch dos textos finais, que pode diferir do base usado na leitura; um campo novo nos dados mudaria o texto fatiado.",
      "alternative": "Recalcular target ou base dentro de discoverCli.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual é o texto da mensagem, dado que <ref>@{1} é só a entrada anterior do reflog?",
      "decision": "Manter from X to Y e marcar X como previous reflog entry; sem ref qualificado, usar a forma now at, que aponta a fatia 0.",
      "basis": "A observação da aprovação: com 2 ou mais commits durante a descoberta X não é o SHA da fatia 0; o AC1 continua atendido.",
      "alternative": "O texto sem a ressalva.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Que índice o teste pede depois de um commit que aumenta a descoberta?",
      "decision": "O índice igual à contagem nova (o primeiro inexistente), e um segundo caso com commit que reduz a descoberta, pedindo a última fatia da contagem antiga.",
      "basis": "A última fatia da contagem nova existe na leitura atual e não passa pelo ramo da mensagem; o texto de teste da spec só produz o erro com um índice fora da contagem, e o caso da #4 é a redução.",
      "alternative": "Seguir o texto literal da spec, que não dispara a mensagem.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como testar os três valores de LOADED_BY_NAME se a constante tem um só?",
      "decision": "Opção loadedByName em runPreflight, com a constante como padrão; o docs.test.mjs escolhe a frase exigida pela constante.",
      "basis": "Os testes ficam determinísticos em qualquer desfecho da tarefa 1 e os docs ficam presos ao mesmo valor do código.",
      "alternative": "Testar só o valor vigente.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como cumprir a evidência no log.md do roadmap se a tarefa não pode escrever na pasta do roadmap?",
      "decision": "A tarefa 1 grava a evidência em docs/plans/pos-2-6-0-E45/confirmacao.md; a etapa de registro do executor a leva ao log.md e, no desfecho cache, registra a DEC.",
      "basis": "O check do plan/1 recusa tarefa que escreve na pasta do roadmap (roadmap-edit); a spec continua atendida pela etapa de registro, e as tarefas 4 e 5 leem o arquivo do entregável.",
      "alternative": "Omitir a escrita dos campos files e escrever no log.md de dentro da tarefa.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "Login da sessão headless da tarefa 1, provido pela variável de ambiente CLAUDE_CODE_OAUTH_TOKEN.",
      "why": "A sessão com CLAUDE_CONFIG_DIR descartável começa sem credencial.",
      "blocking": false,
      "workaround": "Copiar só o .credentials.json do ~/.claude real (leitura) para a pasta descartável, como autoriza a DEC-026."
    }
  ]
}
```
