# Plano E52 -- Caminho agy: pwsh, docs, ferramentas e extrator

Spec: `docs/plans/pos-2-6-0-E52/spec.md`. Cobre REQ-020 (#9), REQ-021 (#11), REQ-022 (#14) e REQ-023 (#12), os blocos G1 e G2 autorizados pela DEC-008. Branch `plan/pos-2-6-0-E52`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E52`, com merge em `release/pos-2.6.0` depois da conferência. O worktree ainda não existe: criá-lo a partir de `release/pos-2.6.0`, já com este plano commitado, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E52 D:/projects/claude-play-wt/pos-2-6-0-E52 release/pos-2.6.0`). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz de `D:/projects/claude-play-wt/pos-2-6-0-E52` (rodados em outro checkout, testam outro código e dão verde falso).

Três tarefas em sequência, um commit por tarefa, cada uma com no máximo 4 arquivos: a nota de ferramentas (AC1), o extrator antes do flash (AC2) e os textos (variante pwsh, README e `deep-researcher`). Depois delas, o executor da sessão principal faz a verificação do AC3.

Nenhuma tarefa e nenhum critério roda o Antigravity (`agy`) em forma nenhuma (`agy -p`, `agy plugin install`, `agy plugin validate`, `run_workflow`). A DEC-008 cobre só editar os arquivos; os testes usam `agent()` simulado.

## Linha de base (G1)

Linha de base no merge do E50 (`857624a`): exit 0, tests 2636, pass 2634, fail 0, skipped 2. Outros entregáveis integram antes do E52 e sobem o piso: vale a contagem do último merge em `release/pos-2.6.0` de onde o worktree nasce, registrada no log do roadmap.

Antes da Tarefa 1, medir o G1 pelo Git Bash com o worktree parado e anotar exit, tests, pass, fail e skipped:

```
node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"
```

Nenhum commit, de nenhuma sessão, durante a execução (um commit no meio quebra `tools/measure/run-batch.test.mjs`); se o HEAD mudar, repetir com o HEAD estável. A suíte é sensível a carga: não rodá-la enquanto outra execução de testes corre em outro worktree. O E52 acrescenta 10 testes: no fim, `tests` e `pass` são pelo menos a medida inicial mais 10, `fail 0` e `skipped 2`.

Os testes Python pulam sem Python >= 3.8 e dariam verde falso: nos checks dos arquivos de teste agy, exigir `skipped 0`.

## Tarefas

### Tarefa 1: Nota de ferramentas do agy no prompt dos agentes

Arquivos: mudar `plugins/productivity-tools/scripts/agy-bridge.py`, `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py` e `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py`; teste em `plugins/productivity-tools/scripts/agy-bridge.test.mjs`.

Contrato em `agy-bridge.py`, logo depois de `load_agent_body`, que não muda:

- constante `AGY_TOOL_NOTE`, com este texto exato numa única linha lógica (569 caracteres; teto de 600):

```text
HOST TOOLS (Antigravity): the instructions above may name Claude Code tools; use these instead. Read with offset/limit: read_file with StartLine/EndLine. Write: write_file. Edit: edit_file. Bash: run_command, which on Windows is pwsh, so no POSIX syntax such as $(...): run the inner command first (for example git rev-parse --absolute-git-dir) and use its literal output. AskUserQuestion: ask_question. Grep and Glob: the search tools of this host, or run_command. WebSearch: search_web; there is no WebFetch. agentType and subagent dispatch do not exist on this host.
```

- a nota não contém `subagent_type`, `System32`, nome de tier Claude entre aspas nem a frase `Do not spawn subagents` (o arnês dos dois workflows confere essa frase nos prompts, e a nota não pode satisfazê-la sozinha);
- função `with_tool_note(body, prompt) -> str`: devolve o corpo, uma linha em branco, `AGY_TOOL_NOTE`, uma linha em branco e o prompt.

Nos workflows:

- `roadmap-release-agy.py`, `call_agent` (linha 213): com `body`, o texto sai de `with_tool_note(body, prompt)`; sem `body`, fica o `prompt` de hoje, sem a nota. A docstring passa a citar a nota entre o corpo e o prompt.
- `coordinator-agy.py`, `call_agent` (linha 527): o texto sai de `with_tool_note(BODIES[role], prompt)`.

Passos:

1. Teste primeiro, em `agy-bridge.test.mjs`, depois do teste `AC7: load_agent_body returns the agent body without the frontmatter`:
   - `E52 AC1: with_tool_note keeps the agent body first, then the note, then the prompt, for the seven agents` (com Python): listar os `agents/*.md`, conferir que são 7 e, para cada um, que `with_tool_note(load_agent_body(root, nome), 'PROMPT')` começa pelo corpo exato, contém `AGY_TOOL_NOTE` depois do corpo e termina em `PROMPT`;
   - `E52 AC1: AGY_TOOL_NOTE names the agy tools` (com Python): a nota contém `read_file`, `StartLine`, `EndLine`, `write_file`, `edit_file`, `run_command`, `pwsh` e `search_web`, tem no máximo 600 caracteres e não contém `subagent_type`, `System32`, `'haiku'`, `'sonnet'`, `'opus'` nem `Do not spawn subagents`;
   - `E52 AC1: agents stay free of the note and both workflows call with_tool_note in call_agent` (estático, sem Python): nenhum `agents/*.md` contém `read_file` nem `AGY_TOOL_NOTE`; no trecho da função `call_agent` de cada um dos dois `.py` há `with_tool_note(`; nenhum dos dois arquivos contém `body + '\n\n' + prompt` nem `BODIES[role] + '\n\n' + prompt` (comparação literal do texto-fonte, com as barras invertidas como estão no `.py`);
   - no teste `AC7: the bridge loads by exec into a fresh globals dict and exposes the contract`, acrescentar `with_tool_note` à lista de nomes.
2. Rodar `node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs` e ver os casos novos falharem.
3. Implementar a constante, a função e as duas chamadas; ver o arquivo de teste passar.
4. Rodar os checks da tarefa. `coordinator-agy.test.mjs` (o prompt começa pelo corpo do agent) e o teste do `DO-NOT CHECK` em `roadmap-release-agy.test.mjs` continuam verdes sem edição.
5. Commit só com os arquivos da tarefa: `feat(productivity-tools): nota de ferramentas do agy no prompt dos agentes (#14)`.

### Tarefa 2: Extrator de testes antes do flash no roadmap-release-agy

Arquivos: mudar `plugins/productivity-tools/scripts/agy-bridge.py` e `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py`; teste em `plugins/productivity-tools/scripts/agy-bridge.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs`.

Contrato em `agy-bridge.py`, logo depois de `run_test_integrity`: função `run_test_extract(root, text, exit) -> dict | None`.

- grava `text` em UTF-8 num arquivo de uma pasta criada por `tempfile.mkdtemp(prefix='agy-extract-')`, fora do worktree;
- roda por `run_cli` o comando `node <root>/scripts/test-extract.mjs <arquivo> --exit <exit>`;
- apaga a pasta num `finally`;
- devolve o objeto JSON lido, ou `None` quando o exit não é 0, o JSON é inválido ou não é um objeto.

Contrato em `roadmap-release-agy.py`, em `read_tests_gate(d, r)`:

- primeiro, `run_test_extract(ROOT, r['stdout'], r['exit'])` sobre o stdout inteiro, sem `tail_text` e sem o stderr;
- o extrato vale quando é um objeto, `format` é diferente de `unknown`, `total` é inteiro, `failedNames` é lista e `d` não tem `ignoreFailuresWhenChanged` (chave ausente, `None` ou `False`; qualquer outro valor, inclusive objeto vazio, vai ao flash);
- nesse caso devolve `{total, skipped, failedNames}`, com `skipped` 0 quando não for inteiro, sem chamar `agent()`;
- o extrato vale mesmo quando contradiz o exit, e não vai ao flash: o `validMeasure` recusa o resultado depois (R7 e C6 da spec);
- em todos os outros casos segue o leitor flash de hoje, com o mesmo prompt, a cauda de 4.000 caracteres de stdout e stderr e as duas tentativas;
- a docstring passa a citar o extrator antes do flash. `measure_defs`, `test-extract.mjs`, `capture.mjs` e `roadmap-release.js` não mudam.

Passos:

1. Teste primeiro, em `agy-bridge.test.mjs`, depois do teste `AC7: run_test_integrity counts a removed assert in a temporary repo`:
   - `E52 AC2: run_test_extract returns None without the CLI and leaves no agy-extract folder` (com Python): apontar `tempfile.tempdir` do snippet para uma pasta temporária só do teste (os outros arquivos de teste rodam em paralelo e também criam pastas `agy-extract-`); listar as `agy-extract-*` de `tempfile.gettempdir()` antes e depois; chamar com uma raiz inexistente e com uma raiz temporária que tem `scripts/` sem o `test-extract.mjs`; as duas chamadas devolvem `None` e as listagens são iguais;
   - acrescentar `run_test_extract` à lista de nomes do teste de carga.
2. Em `roadmap-release-agy.test.mjs`, no fim do arquivo (depois de `GATE_READ`), um snippet próprio `GATE_SNIPPET(d, r)`, no molde do `LOOP_SNIPPET`: define `ROOT`, chama `_load_bridge(ROOT)`, define `SCHEMAS` com `load_js_schemas(ROOT + '/' + RELEASE_JS_REL)` e, em `snip()`, devolve o resultado de `read_tests_gate(d, r)`, com `d = json.loads(${JSON.stringify(JSON.stringify(d))})` e o mesmo para `r` (um objeto JSON colado como literal Python quebra em `true`; o módulo já importa `json`). O `d` base é `{ name: 'unit', cmd: 'node --test', kind: 'tests' }` e o `r` traz `exit`, `stdout`, `stderr` vazio e `ran` verdadeiro. Todos os casos rodam com as respostas `{ gates: GATE_READ }`:
   - `E52 AC2: a TAP failure before the last 4000 characters is seen without the flash reader`: exit 1, `not ok 1 - early failure` no começo, linhas `ok` até passar de 4.000 caracteres e o resumo `# tests`, `# pass`, `# fail 1`, `# skipped 0`; conferir no próprio teste que há mais de 4.000 caracteres depois do `not ok`; retorno com o total do resumo, `skipped` 0 e `failedNames` com `early failure`; lista de chamadas vazia;
   - `E52 AC2: a green node-spec output is read without the flash reader`: resumo com `ℹ tests` e `ℹ fail 0`, exit 0; total certo, `failedNames` vazio e nenhuma chamada;
   - `E52 AC2: an output of unknown format goes to the flash reader`: stdout `tests 3 pass 3`; exatamente 1 chamada de papel `gates` e retorno `{ total: 3, skipped: 0, failedNames: [] }`;
   - `E52 AC2: a vitest summary goes to the flash reader`: stdout com `Tests  97 passed (97)`; 1 chamada `gates` e o mesmo retorno;
   - `E52 AC2: a gate with ignoreFailuresWhenChanged goes to the flash reader`: `d` com `ignoreFailuresWhenChanged: true` e saída TAP; 1 chamada `gates` e o mesmo retorno;
   - `E52 AC2: an extract that contradicts the exit stands and does not go to the flash reader`: saída TAP toda `ok` com exit 1; `failedNames` vazio, total do resumo e nenhuma chamada.
3. Rodar `node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs` e ver os casos novos falharem (os três que esperam o flash podem passar antes da implementação).
4. Implementar `run_test_extract` e a mudança de `read_tests_gate`; ver os dois arquivos passarem. Os testes T6 e T7 que esperam a chamada `gates` com a saída `tests 3 pass 3` não mudam.
5. Rodar os checks da tarefa.
6. Commit só com os arquivos da tarefa: `feat(productivity-tools): extrator de testes antes do flash no caminho agy (#12)`.

### Tarefa 3: Variante pwsh, seção agy do README e fallback search_web

Arquivos: mudar `plugins/productivity-tools/skills/wsl-health-check/SKILL.md`, `plugins/productivity-tools/README.md` e `plugins/productivity-tools/skills/deep-researcher/SKILL.md`. Sem teste novo de texto (R11 da spec).

`wsl-health-check/SKILL.md`:

- a descrição (linha 3) troca a frase `Not for Windows-native or macOS hosts.` por `Also works from pwsh on Windows when WSL is installed. Not for Windows without WSL, nor for macOS hosts.`; o resto da descrição fica igual;
- o passo 1 mantém a linha do comando POSIX como está e ganha logo abaixo, dentro do mesmo item, estes três subitens:

```text
   - That command is for Linux and WSL. From pwsh on Windows with WSL installed, run this one instead: `wsl -e bash -lc 'p=$(wslpath -u "$1"); exec bash "$p" --full --no-color' -- "${CLAUDE_SKILL_DIR}/scripts/health-report.sh"`
   - In pwsh, replace the `${CLAUDE_SKILL_DIR}` placeholder with the absolute folder of this skill, written with `/`, before running it (if it is empty or not expanded, use the folder this SKILL.md was loaded from). Copied literally, pwsh reads it as one of its own variables, expands it to nothing without an error, and the path becomes `/scripts/health-report.sh`.
   - Never call bare `bash` from pwsh: it resolves to the System32 launcher and exits 127.
```

`deep-researcher/SKILL.md` (linhas 15 e 16, só ASCII):

```text
3. **Search broadly** using varied, specific queries via WebSearch (`search_web` where WebSearch is absent, as on Antigravity) to uncover different facets
4. **Fetch and verify** the most promising sources via WebFetch, following citation trails. Where WebFetch is absent, use the results and links returned by `search_web` and mark every source you did not read in full as unverified
```

`README.md`:

- na linha do `wsl-health-check` da tabela de skills (linha 26), trocar `WSL/Linux only.` por `Linux or WSL, also from pwsh on Windows with WSL installed; not for Windows without WSL or for macOS.`;
- em `## Prerequisites` (linha 75), a linha passa a ser `- A WSL/Linux shell, or pwsh on Windows with WSL installed, for wsl-health-check`;
- entre `## Prerequisites` e `## License`, uma seção nova de nível 2 com o título `Antigravity (agy)` e este corpo:

```markdown
The skills of this plugin can also be used on Google Antigravity. `<version>` below is the version of your copy of the plugin.

- **Register the skills** in `~/.gemini/config/skills.json`, with a path relative to the `~/.gemini/config/` folder (for example `"vendor/productivity-tools-<version>/skills"`) or an absolute path written with `/`. Never start the path with `~/`: on Windows no skill is discovered.
- **Headless runs (`agy -p`)**: pass `--add-dir "<plugin folder>"` when the plugin is outside the workspace, because `spec-writer` and `plan-writer` read `agents/*.md` from disk.
- **Validation**: `agy plugin validate` rejects the `agents/*.md` files, which use the Claude Code format, although `agy plugin install` exposes the skills.
- **Open gaps**:
  - the agy workflows have no CAPTURE and no review-package (#13);
  - `roadmap-release-agy.py` does not handle declared removed tests or the test floors (#15);
  - there is no native agy package (#16);
  - `spec-writer` and `plan-writer` read the agent file from disk and get no tool note.
```

Não documentar a invocação explícita do `roadmap-release` (item d do G4, fora do escopo).

Passos:

1. Editar os três arquivos só com a ferramenta de edição.
2. `git add` dos três e conferir `git ls-files --eol`: os três continuam `i/lf` (a cópia de trabalho `w/crlf` é o esperado).
3. Rodar os checks da tarefa, menos o G1.
4. Commit só com os arquivos da tarefa: `docs(productivity-tools): wsl-health-check pelo pwsh, seção agy no README e search_web no deep-researcher (#9, #11, #14)`.
5. Com o commit feito e o worktree parado, rodar o G1.

## Fechamento

### AC3, pelo executor da sessão principal

Depois das três tarefas e antes do merge. Não é tarefa de subagente e não depende de pessoa; não usa o `agy`.

1. `<WT>` é a saída de `git rev-parse --show-toplevel` na raiz do worktree do E52, com barras normais.
2. Gravar no scratchpad do executor o arquivo `e52-ac3.ps1` com estas duas linhas, a primeira copiada da variante nova do `SKILL.md` com a pasta do skill no lugar do placeholder:

```text
wsl -e bash -lc 'p=$(wslpath -u "$1"); exec bash "$p" --full --no-color' -- "<WT>/plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh"
exit $LASTEXITCODE
```

3. Rodar `pwsh -NoProfile -File "<scratchpad>/e52-ac3.ps1"` e ler o código de saída. Passa com exit 0 e a linha `HEALTH SUMMARY` presente na saída.
4. Ler a versão com `pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'` e a distribuição padrão com `pwsh -NoProfile -Command 'wsl -e printenv WSL_DISTRO_NAME'`.
5. Registrar pelo CLI do roadmap-tracker no `log.md` do worktree da release, com o SHA do HEAD do worktree do E52:

```
node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs log D:/projects/claude-play-wt/pos-2-6-0/docs/plans/roadmap-pos-2-6-0 --deliverable E52 --what "AC3: wsl-health-check pela variante pwsh (pwsh <versão>, WSL <distribuição>) saiu com exit 0; HEALTH SUMMARY presente" --evidence <sha>
```

6. Commitar só o `log.md` em `release/pos-2.6.0` (`docs(roadmap): AC3 do E52`). Com exit diferente de 0, o `--what` do passo 5 leva, em vez do texto de sucesso, o prefixo `AC3:`, o exit e o fim da saída, com o `--what` inteiro em no máximo 300 caracteres e sem barra vertical nem quebra de linha; o AC3 fica vermelho e não há merge.

### Merge e pronto

- Conferir AC1, AC2, AC3, G1 e G2 na branch e fazer o merge de `plan/pos-2-6-0-E52` em `release/pos-2.6.0` depois da conferência.
- O merge é feito no worktree da release (`D:/projects/claude-play-wt/pos-2-6-0`). Com ele parado e sem outra execução de testes, rodar o G1 ali, na árvore do merge: exit 0, `fail 0`, `skipped 2`, e `tests` e `pass` não menores que o maior entre a medida inicial mais 10 e o último piso registrado no log mais 10. Com o G1 vermelho, desfazer o merge.
- Pronto: AC1 e AC2 verdes em `release/pos-2.6.0`; AC3 registrado no log; G1 na árvore do merge com exit 0, `fail 0` e `tests` e `pass` não menores que o piso mais os testes novos; G2 sem FAIL. G5 não se aplica, porque `lib/` não muda.
- Sem bump de versão, push, tag ou comentário em issue. Fora a linha do AC3 no log, este plano não edita o roadmap.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E52",
  "title": "Caminho agy: pwsh, docs, ferramentas e extrator",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E52, branch plan/pos-2-6-0-E52, criado a partir de release/pos-2.6.0; merge em release/pos-2.6.0 depois da conferência. Todo comando e check roda com o diretório atual na raiz desse worktree. A única escrita fora dele é a linha do AC3 no log.md do worktree da release, feita pelo executor no fechamento.",
    "Nenhuma tarefa nem critério roda o Antigravity (agy) real em forma nenhuma; a DEC-008 cobre só editar os arquivos, e os testes usam agent() simulado.",
    "Fora dos testes, o número 3500 só existe em lib/plan-digest.mjs (copy-budget.test.mjs); não escrevê-lo em nenhum outro arquivo.",
    "Cada tarefa edita no máximo 4 arquivos, e cada commit leva só os arquivos da própria tarefa.",
    "Autonomia só local: sem push, tag, publicação nem comentário em issue (DEC-004).",
    "Sem bump de versão em nenhum plugin; o bump é do E54 (DEC-003).",
    "load_agent_body e os agents/*.md não mudam.",
    "roadmap-release.js, test-extract.mjs, capture.mjs e lib/ não mudam.",
    "O comando POSIX do wsl-health-check continua para Linux e WSL; não usar bash puro no pwsh.",
    "Não ir além de G1 e G2 no caminho agy (G3a, G3b e G4 ficam fora, DEC-008 e DEC-019); uma necessidade fora disso volta ao dono via subagente opus (DEC-004, DEC-021).",
    "Não afrouxar validMeasure nem tirar ou afrouxar teste negativo (DEC-004); os testes que esperam a chamada gates com a saída 'tests 3 pass 3' não mudam.",
    "Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "G1 roda pelo Git Bash com o worktree parado, no início e no fim, sem outra execução de testes em outro worktree; linha de base no merge do E50 (857624a): exit 0, tests 2636, pass 2634, fail 0, skipped 2; entregáveis integrados antes sobem o piso."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Nota de ferramentas do agy no prompt dos agentes",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/agy-bridge.py",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agy-bridge.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "AGY_TOOL_NOTE: str",
        "with_tool_note(body, prompt) -> str"
      ],
      "consumes": [],
      "covers": [
        "AC1",
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
          "cmd": "node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs",
          "expect": "exit 0, fail 0, skipped 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        },
        {
          "cmd": "git diff --quiet --merge-base release/pos-2.6.0 -- plugins/productivity-tools/agents",
          "expect": "exit 0"
        },
        {
          "cmd": "! git diff -U0 --merge-base release/pos-2.6.0 -- '*.test.mjs' | grep -nE '^\\+.*(\\.(skip|only|todo)\\b|skipIf)'",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 2,
      "title": "Extrator de testes antes do flash no roadmap-release-agy",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/agy-bridge.py",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agy-bridge.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "run_test_extract(root, text, exit) -> dict | None"
      ],
      "consumes": [],
      "covers": [
        "AC2",
        "C1",
        "C2",
        "C3",
        "C6"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.test.mjs",
          "expect": "exit 0, fail 0, skipped 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        },
        {
          "cmd": "git diff --quiet --merge-base release/pos-2.6.0 -- plugins/productivity-tools/agents plugins/productivity-tools/lib plugins/productivity-tools/scripts/test-extract.mjs plugins/productivity-tools/scripts/capture.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "expect": "exit 0"
        },
        {
          "cmd": "! git diff -U0 --merge-base release/pos-2.6.0 -- '*.test.mjs' | grep -nE '^\\+.*(\\.(skip|only|todo)\\b|skipIf)'",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 3,
      "title": "Variante pwsh, seção agy do README e fallback search_web",
      "deps": [
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/wsl-health-check/SKILL.md",
          "plugins/productivity-tools/README.md",
          "plugins/productivity-tools/skills/deep-researcher/SKILL.md"
        ],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [
        "AC3",
        "C4"
      ],
      "testFirst": {
        "exempt": "só texto: a spec (R11) dispensa teste novo; a verificação é o lint, o claude plugin validate, o independence.test.mjs e o AC3"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "f=plugins/productivity-tools/skills/wsl-health-check/SKILL.md; grep -qF 'bash \"${CLAUDE_SKILL_DIR}/scripts/health-report.sh\" --full --no-color' \"$f\" && grep -qF 'wsl -e bash -lc' \"$f\" && grep -qF 'wslpath -u \"$1\"' \"$f\" && grep -qF 'exec bash \"$p\" --full --no-color' \"$f\"",
          "expect": "exit 0, com o comando POSIX mantido e a variante pwsh presente"
        },
        {
          "cmd": "! grep -nF -e 'Not for Windows-native or macOS hosts' -e 'WSL/Linux only' plugins/productivity-tools/skills/wsl-health-check/SKILL.md plugins/productivity-tools/README.md",
          "expect": "exit 0"
        },
        {
          "cmd": "f=plugins/productivity-tools/README.md; grep -qF '## Antigravity (agy)' \"$f\" && grep -qF 'A WSL/Linux shell, or pwsh on Windows with WSL installed, for wsl-health-check' \"$f\" && grep -qF -e '--add-dir' \"$f\" && grep -qF 'vendor/productivity-tools-<version>/skills' \"$f\" && ! grep -nE 'productivity-tools-[0-9]' \"$f\"",
          "expect": "exit 0"
        },
        {
          "cmd": "f=plugins/productivity-tools/skills/deep-researcher/SKILL.md; test \"$(grep -cF 'search_web' \"$f\")\" -eq 2 && node -e \"process.exit(require('fs').readFileSync('plugins/productivity-tools/skills/deep-researcher/SKILL.md').some(b=>b>127)?1:0)\"",
          "expect": "exit 0, com search_web nos passos 3 e 4 e o arquivo só em ASCII"
        },
        {
          "cmd": "test \"$(git ls-files --eol plugins/productivity-tools/skills/wsl-health-check/SKILL.md plugins/productivity-tools/README.md plugins/productivity-tools/skills/deep-researcher/SKILL.md | grep -c '^i/lf')\" -eq 3",
          "expect": "exit 0, depois do git add"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/agent-contracts.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0 pelo Git Bash, depois do commit e com o worktree parado; fail 0, skipped 2, tests e pass pelo menos a medida inicial mais 10"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "human",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir os 8 arquivos em tarefas de no máximo 4?",
      "decision": "Três tarefas em sequência: nota (bridge, os dois workflows e o teste do bridge); extrator (bridge, roadmap-release-agy e os dois testes); textos (wsl-health-check, README e deep-researcher). O fallback do deep-researcher vai com os textos, e o G1 final fica na Tarefa 3.",
      "basis": "A spec sugere essa divisão, mas a nota com o fallback somaria 5 arquivos; as tarefas 1 e 2 dividem arquivos, e a ordem única deixa o G1 rodar com o worktree parado depois do último commit.",
      "alternative": "Uma quarta tarefa só para o deep-researcher.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Qual o texto da nota e o que o teste fixa nele?",
      "decision": "O texto de 569 caracteres da Tarefa 1; o teste exige os nomes da spec, no máximo 600 caracteres e a ausência de subagent_type, System32, tiers entre aspas e da frase Do not spawn subagents.",
      "basis": "A spec deixa o texto ao plano com cerca de 600 caracteres; o arnês dos dois workflows confere Do not spawn subagents em cada prompt, e a nota com a frase mascararia a falta dela no prompt.",
      "alternative": "Fixar o texto inteiro da nota no teste.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O snippet do AC2 reaproveita o LOOP_SNIPPET?",
      "decision": "Não: um GATE_SNIPPET próprio no fim do arquivo, que define ROOT, carrega o bridge e define SCHEMAS.",
      "basis": "O LOOP_SNIPPET traz fixtures do laço de revisão; SCHEMAS só é preenchido pelo main do workflow, que o snippet não roda, e o caminho do flash lê S_GATE.",
      "alternative": "Estender o LOOP_SNIPPET com as variáveis do portão.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como o teste da pasta temporária evita falso vermelho com testes em paralelo?",
      "decision": "O snippet aponta tempfile.tempdir para uma pasta só do teste antes de listar tempfile.gettempdir() e chamar run_test_extract.",
      "basis": "Com o E52, os testes do modo run em outro arquivo criam pastas agy-extract- na pasta temporária comum enquanto o teste do bridge roda.",
      "alternative": "Listar a pasta temporária do sistema.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que conta como portão sem ignoreFailuresWhenChanged no Python?",
      "decision": "Chave ausente, None ou False; qualquer outro valor, inclusive objeto vazio, vai ao flash.",
      "basis": "O gateFromCapture usa a verdade do JavaScript, em que um objeto vazio conta como presente; no Python ele seria falso, e o valor documentado em config.md descreve exceções, não um booleano.",
      "alternative": "Usar a verdade do Python sobre o valor.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Como e onde a linha do AC3 entra no log?",
      "decision": "Pelo subcomando log do roadmap.mjs, no log.md do worktree da release, commitada ali só com esse arquivo antes do merge.",
      "basis": "A spec deixa o modo ao plano; o CLI grava a tabela no formato do roadmap, e os registros do roadmap são feitos em release/pos-2.6.0, onde uma linha na branch do plano conflitaria com as de outros entregáveis.",
      "alternative": "Editar a tabela à mão na branch plan/pos-2-6-0-E52.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Onde o E52 é executado e contra qual piso o G1 é conferido?",
      "decision": "Na branch plan/pos-2-6-0-E52, no worktree próprio criado de release/pos-2.6.0; o G1 é medido antes da Tarefa 1 e depois do commit da Tarefa 3, contra a medida inicial mais 10 testes novos, nunca abaixo de tests 2646 e pass 2644.",
      "basis": "Pedido deste plano; entregáveis que integram antes sobem o piso de 2636 e 2634, e a spec exige o total acima do piso somado aos testes novos.",
      "alternative": "Conferir só contra a contagem do merge do E50.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "removedTests": []
}
```
