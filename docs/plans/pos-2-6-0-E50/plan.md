# Plano E50 -- Testes portáveis e disparador do lint

Spec: `docs/plans/pos-2-6-0-E50/spec.md`. Cobre REQ-014 (#10) e REQ-015 (#29). Duas fatias independentes, uma tarefa e um commit por fatia, sem dependência entre elas. Todos os caminhos são relativos à raiz do repositório.

## Estado medido na escrita do plano

- Em pwsh com `System32` antes do Git no PATH e sem `PT_BASH`, `bash` resolve para `C:\Windows\System32\bash.exe`, e as suítes de capture e load-slices dão 52 testes, 44 aprovados e 8 falhas. É o estado vermelho da Tarefa 1.
- O lint sai sem FAIL em `plugins/marketplace-tools`, `plugins/mcp-sql-server`, `plugins/productivity-tools` e `plugins/sql-server-tools`.
- O lint em `plugins/_template` já sai com 2 FAIL antes deste entregável (nome da pasta diferente do `name` do `plugin.json`, e `keywords` ausente). Nenhum deles é do check novo.
- Nenhum plugin, nem o `_template`, tem `commands/` ou as chaves `commands` ou `skills` no `plugin.json`.

## Tarefas

### Tarefa 1: Helper gitBash() compartilhado nos testes

Arquivos: criar `plugins/productivity-tools/scripts/git-bash.mjs`; mudar `plugins/productivity-tools/scripts/capture.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Contrato do módulo, que exporta só `gitBash() -> string | null`, não tem CLI e é importado apenas por testes:

1. com `process.env.PT_BASH` definida, devolve o valor como está, sem conferir se existe;
2. fora do `win32`, devolve `'bash'`;
3. no `win32`, roda `git --exec-path` com `execFileSync` e procura `bin/bash.exe` subindo três níveis e depois dois; devolve o primeiro caminho que existe;
4. devolve `null` quando o git falha ou nenhum candidato existe.

A `findBash` de `plugins/productivity-tools/scripts/capture.mjs` não muda e não é exportada.

Passos:

1. Teste primeiro, em `capture.test.mjs`: importar `gitBash` de `./git-bash.mjs` e escrever dois testes. Um define `PT_BASH` com um caminho inexistente e espera o mesmo valor de volta. O outro apaga `PT_BASH` e espera, no `win32`, `null` ou um caminho existente que termina em `bash.exe` e não passa por `system32`; fora do `win32`, `'bash'`. Os dois restauram o valor anterior de `PT_BASH` (apagando a variável se ela não existia). Não mexer no PATH.
2. Rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs` e ver falhar por módulo ausente.
3. Criar `git-bash.mjs` conforme o contrato.
4. Em `capture.test.mjs`: declarar `const BASH = gitBash()` no topo. `shellTest` ganha um terceiro parâmetro opcional com as opções, repassado a `test(name, opções, fn)`. A chamada `AC8: Git Bash com --cwd C:/... preserva o exit 3` passa `{ skip: BASH ? false : 'Git Bash não encontrado; instale o Git ou defina PT_BASH' }`, devolve `null` no probe quando `BASH` é `null` e usa `BASH` no lugar de `'bash'` no `spawnSync`. O teste do PowerShell não muda.
5. Em `load-slices.test.mjs`: importar de `../../../scripts/git-bash.mjs`, declarar `BASH` uma vez no topo do módulo, usar `BASH` na função `bash` interna de `drive` e no `spawnSync` do hook do teste "a slice of another repository is not found". Os 8 testes que chamam `drive` recebem `{ skip: BASH ? false : 'Git Bash não encontrado; instale o Git ou defina PT_BASH' }` no `test(...)` (uma constante com o objeto serve). A assinatura de `drive` não muda.
6. Em `flow.test.mjs`: remover a função local `gitBashPath`, importar `gitBash` de `../../../scripts/git-bash.mjs` e chamá-lo no teste `shq: o Git Bash entrega o texto literal`. A guarda contra `system32` e `windowsapps` e o probe `bash -c true` ficam. Os imports `execFileSync` e `existsSync` continuam, porque o arquivo os usa em outros testes.

Restrição de integridade de testes: não reescrever, mover nem reindentar as linhas `t.skip` existentes, em especial a de `flow.test.mjs` (perto da linha 3097) e a de dentro de `shellTest` em `capture.test.mjs`. Uma linha com `t.skip` nova ou reescrita conta como `skipsAdded`. A opção `{ skip: ... }` de `test()` não casa essa regra. Também não escrever `.skip`, `.only`, `.todo` ou `skipIf` em nenhuma linha nova ou alterada de teste, nem em comentário. Antes do commit, conferir que `git diff -U0` não traz linha adicionada com esses textos. O `git-bash.mjs` conta como `prodChanged`; os asserts do passo 1 são a asserção nova que o acompanha.

7. Rodar os checks da tarefa. No check em pwsh, todos os testes passam, com `fail 0` e `skipped 0`.
8. Se `independence.test.mjs` ou o lint recusarem o arquivo novo, movê-lo para `plugins/productivity-tools/scripts/fixtures/git-bash.mjs` (o lint pula essa pasta), ajustar os três imports e rodar os checks de novo.
9. Commit só com os arquivos da tarefa: `test(productivity-tools): resolver o Git Bash nos testes sem depender do PATH (#10)`.

### Tarefa 2: FAIL do lint para commands/ e caminhos customizados

Arquivos: mudar `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`, `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`, `plugins/marketplace-tools/skills/validate-plugin/SKILL.md` e `docs/claude-code-extensibility-reference.md`.

Contrato do check, de nome `No commands/ or custom component paths (#29)`, posto logo depois do bloco DEC-057 e antes do bloco "Check 3 + 4: skills" em `lintPlugin`:

- achados: `commands/` quando a pasta existe no plugin; `plugin.json "commands"` e `plugin.json "skills"` quando o `plugin.json` lido tem a chave, qualquer que seja o valor;
- um FAIL por achado, com o detalhe `found <achado>: allowed-tools is not linted there yet, see https://github.com/odeciojunior/claude-play/issues/29`;
- sem achados, um OK com o nome do check;
- `agents`, `hooks` e `mcpServers` não disparam;
- a pasta `commands/` é conferida mesmo quando o `plugin.json` não pôde ser lido.

Passos:

1. Teste primeiro, em `lint-plugin.test.mjs`, com `fresh()`, `write()` e `mutatePluginJson()`, quatro casos:
   - `commands/x.md` criado dá FAIL com `found commands/` e `issues/29`; no mesmo caso, acrescentar a chave `commands` ao `plugin.json` e conferir dois FAIL desse check, um por achado (C4);
   - `"commands": "./cmds"` dá FAIL com `plugin.json "commands"`;
   - `"skills": "./extra"` dá FAIL com `plugin.json "skills"`, e `"skills": "./skills"` também (C3);
   - com `agents`, `hooks` e `mcpServers` no `plugin.json`, esse check não dá FAIL e sai como OK.
2. Rodar `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` e ver os casos novos falharem.
3. Implementar o check e ver o arquivo de teste passar, inclusive `valid fixture has 0 FAIL and 0 WARN`.
4. Em `validate-plugin/SKILL.md`, na lista de cobertura do parágrafo "The script covers" (Step 1), acrescentar o item: `commands/ or custom commands/skills paths in plugin.json (FAIL until #29 lints allowed-tools there; DEC-013)`.
5. Em `docs/claude-code-extensibility-reference.md`, logo depois do parágrafo "Repo policy (claude-play)" da seção de skills, acrescentar um parágrafo de uma linha, em inglês, dizendo que o `lint-plugin.mjs` dá FAIL em plugin com a pasta `commands/` ou com as chaves `commands` ou `skills` no `plugin.json` até a issue #29 conferir `allowed-tools` nesses caminhos (DEC-013).
6. Rodar os checks da tarefa. Parada obrigatória: se o check novo reprovar o `_template` ou qualquer plugin do repositório, não commitar a tarefa, não editar o plugin reprovado nem afrouxar o check, e voltar ao dono por um subagente opus (DEC-021). A Tarefa 1 segue. Os 2 FAIL antigos do `_template` não disparam essa parada; ali vale a linha OK do check novo.
7. Commit só com os arquivos da tarefa: `feat(marketplace-tools): lint falha em commands/ e caminhos customizados (#29)`.

## Fechamento

Pronto quando os dois critérios estão verdes em `release/pos-2.6.0` com os gates G1, G2 e G3 do roadmap verdes. A linha de base do G1 está na spec do E42 (`docs/plans/pos-2-6-0-E42/spec.md`). Não há bump de versão, push, tag nem comentário em issue.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E50",
  "title": "Testes portáveis e disparador do lint",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Sem bump de versão em nenhum plugin; o bump é do E54 (DEC-003).",
    "Autonomia só local: sem push, tag ou comentário em issue (DEC-004).",
    "O FAIL do lint vale só para a pasta commands/ e para as chaves commands ou skills do plugin.json (DEC-013, DEC-024).",
    "Se o check novo reprovar plugins/_template ou qualquer plugin do repositório, a Tarefa 2 para e volta ao dono via subagente opus (DEC-021); a Tarefa 1 segue.",
    "Não editar plugins/_template/ nem plugins/mcp-sql-server/scripts/setup.test.mjs.",
    "git-bash.mjs é importado só por testes; capture.mjs mantém a findBash própria, sem exportá-la.",
    "Não mexer no PATH dentro dos testes.",
    "Não reescrever as linhas t.skip existentes nem acrescentar .skip, .only, .todo ou skipIf em linhas de teste; pular só pela opção { skip } de test().",
    "Cada commit leva só os arquivos da própria tarefa; o worktree pode ter arquivos de outras sessões.",
    "Definição de pronto: AC1 e AC2 verdes em release/pos-2.6.0 com G1, G2 e G3 verdes."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Helper gitBash() compartilhado nos testes",
      "deps": [],
      "files": {
        "create": [
          "plugins/productivity-tools/scripts/git-bash.mjs"
        ],
        "modify": [],
        "test": [
          "plugins/productivity-tools/scripts/capture.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "gitBash() -> string | null"
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
          "cmd": "pwsh -NoProfile -Command '$env:PATH = \"$env:SystemRoot\\System32;\" + $env:PATH; Remove-Item Env:PT_BASH -ErrorAction SilentlyContinue; node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs; exit $LASTEXITCODE'",
          "expect": "exit 0, fail 0, skipped 0"
        },
        {
          "cmd": "node --test --test-name-pattern=\"shq\" plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "expect": "exit 0, skipped 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/scripts/independence.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0"
        },
        {
          "cmd": "! grep -nE \"spawnSync\\('bash'|gitBashPath\" plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "! grep -rlE --include=*.mjs --include=*.js --exclude=*.test.mjs \"(from|import\\()[ ]*['\\\"][^'\\\"]*git-bash\\.mjs\" plugins",
          "expect": "exit 0"
        }
      ]
    },
    {
      "n": 2,
      "title": "FAIL do lint para commands/ e caminhos customizados",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs",
          "plugins/marketplace-tools/skills/validate-plugin/SKILL.md",
          "docs/claude-code-extensibility-reference.md"
        ],
        "test": [
          "plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs"
        ]
      },
      "writes": [],
      "produces": [],
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
          "cmd": "node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "for p in plugins/marketplace-tools plugins/mcp-sql-server plugins/productivity-tools plugins/sql-server-tools; do node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs \"$p\" || exit 1; done",
          "expect": "exit 0"
        },
        {
          "cmd": "for p in plugins/*; do node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs \"$p\" | grep -E \"\\[OK\\] +No commands/ or custom component paths\" || exit 1; done",
          "expect": "exit 0, uma linha OK do check novo por pasta de plugins/, inclusive _template"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como o motivo do pulo por Git Bash ausente entra nos testes sem contar como skipsAdded?",
      "decision": "Pela opção { skip: motivo } de test(), inclusive no teste de Git Bash de capture.test.mjs, com um parâmetro de opções em shellTest. As linhas t.skip existentes em capture.test.mjs e flow.test.mjs não são reescritas.",
      "basis": "Observação da aprovação da spec: linha com t.skip nova ou reescrita conta como skipsAdded no test-integrity do roadmap-release.js; a opção { skip: ... } não casa essa regra.",
      "alternative": "Trocar o texto do t.skip de shellTest para citar o Git Bash e a PT_BASH.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Onde ficam as asserções que acompanham o módulo novo git-bash.mjs?",
      "decision": "Em dois testes de gitBash() dentro de capture.test.mjs, escritos antes do módulo.",
      "basis": "git-bash.mjs conta como prodChanged; a fatia é entregável sozinha e precisa de asserção nova própria. capture.test.mjs já está no escopo da spec e fica ao lado do módulo.",
      "alternative": "Arquivo novo plugins/productivity-tools/scripts/git-bash.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O plugins/_template já sai com FAIL no lint antes deste entregável; isso dispara a parada da Tarefa 2?",
      "decision": "Não. A parada vale para um FAIL do check novo; nos quatro plugins exige-se também exit 0 do lint, e no _template exige-se a linha OK do check novo.",
      "basis": "Medido na escrita do plano: 2 FAIL no _template (nome da pasta e keywords), sem relação com commands/ ou caminhos customizados. A restrição da spec trata da reprovação pelo check novo, e o _template não pode ser editado.",
      "alternative": "Parar e voltar ao dono por causa dos FAIL antigos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como as duas fatias são divididas e ordenadas?",
      "decision": "Uma tarefa e um commit por fatia, D1 como Tarefa 1 e D2a como Tarefa 2, sem dependência entre elas.",
      "basis": "A spec declara as fatias independentes: uma só mexe em testes do productivity-tools e a outra no marketplace-tools e em docs.",
      "alternative": "Uma tarefa única para o entregável.",
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
