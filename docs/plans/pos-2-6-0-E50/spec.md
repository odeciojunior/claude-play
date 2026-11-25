# Spec E50 -- Testes portáveis e disparador do lint

Entregável E50 do roadmap pós-2.6.0 (`docs/plans/roadmap-pos-2-6-0`, estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, seção E50). Cobre REQ-014 e REQ-015, sem dependências. Detalhe técnico nas tarefas D1 (#10) e D2a (#29) de `docs/plans/2026-11-25-correcoes-issues-plan.md`; decisão vigente DEC-013.

## Intenção

Duas fatias independentes, cada uma entregável sozinha:

1. **Helper `gitBash()` compartilhado nos testes (D1, #10).** As suítes de capture e load-slices chamam `spawnSync('bash', ...)` e herdam o `bash` do PATH. Num pwsh em que `C:\Windows\System32` vem antes do Git, esse `bash` é o do WSL e as suítes falham. Os testes passam a resolver o Git Bash sem depender do PATH, como o `capture.mjs` já faz na produção.
2. **FAIL do lint para `commands/` e caminhos customizados (D2a, #29).** O lint confere `allowed-tools` só em `skills/*/SKILL.md`. Um plugin com `commands/` ou com caminhos customizados no `plugin.json` escaparia da checagem em silêncio. Pela DEC-013 entra só um disparador: o lint dá FAIL nesses casos, com mensagem apontando a #29, até a checagem completa (D2) existir.

## Escopo

**Dentro:**
- Módulo novo `plugins/productivity-tools/scripts/git-bash.mjs`, só para testes.
- `capture.test.mjs` (linha 238), `load-slices.test.mjs` (linhas 81 e 185) e `flow.test.mjs` (o `gitBashPath` da linha 3077) passam a usar o helper.
- Check novo em `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` e testes em `lint-plugin.test.mjs`.
- Uma linha em `plugins/marketplace-tools/skills/validate-plugin/SKILL.md` e uma em `docs/claude-code-extensibility-reference.md`.

**Fora:**
- `plugins/mcp-sql-server/scripts/setup.test.mjs`. É outro plugin e fica como está (R2).
- A checagem completa de `allowed-tools` em commands e em caminhos customizados (D2). Fica para o gatilho da DEC-013 (DEC-019).
- O bump de versão do marketplace-tools e do productivity-tools. Pela DEC-003 e pela DEC-042, ele só acontece no E54.
- Comentários nas issues #10 e #29.

**O que não fazer:**
- Não importar `git-bash.mjs` em código de produção. O `capture.mjs` mantém a `findBash` própria, sem exportá-la.
- Não dar FAIL por `agents`, `hooks` ou `mcpServers` no `plugin.json`.
- Não mexer no PATH dentro dos testes para "consertar" o ambiente.
- Não editar `plugins/_template/`.
- Não contornar uma reprovação. Pela resposta Q3 do dono, se o check novo reprovar o `_template` ou qualquer plugin do repositório, a D2a para e volta ao dono via opus (DEC-021); a D1 segue. Hoje nenhum plugin tem `commands/` nem as chaves `commands` ou `skills` (conferido nesta spec), então esse caso não é esperado e não há item pendente de pessoa.

## Design

**Critério AC1 (suítes de capture e load-slices passam no pwsh com System32 antes do Git).** O módulo novo `plugins/productivity-tools/scripts/git-bash.mjs` exporta `gitBash()`:
- devolve `process.env.PT_BASH` quando definida, sem conferir se o caminho existe, como faz a `findBash` de `capture.mjs:281`;
- fora do `win32`, devolve `'bash'`;
- no `win32`, roda `git --exec-path` com `execFileSync` e procura `bin/bash.exe` subindo três níveis e depois dois, como o `gitBashPath` de `flow.test.mjs:3077`; devolve o primeiro caminho que existe;
- devolve `null` quando o git falha ou nenhum candidato existe.

O nome não termina em `.test.mjs`, então o glob de testes não o executa. É o mesmo padrão de `workflow/load-pure.mjs`. O módulo não tem CLI. O nome `git-bash.mjs` é único no plugin, então o check "Script names are unique" do lint continua OK. Não há texto que dispare o "No writes into CLAUDE_PLUGIN_ROOT" nem que cite "superpowers" (`independence.test.mjs`). Se `independence.test.mjs` ou o lint recusarem o arquivo, ele passa para `plugins/productivity-tools/scripts/fixtures/git-bash.mjs`, que o `walk` do lint pula (R1).

Uso nas três suítes:
- **`capture.test.mjs`:** o teste `AC8: Git Bash ...` (linha 236) troca `spawnSync('bash', ...)` por `spawnSync(BASH, ...)`, com `const BASH = gitBash()` no topo. Quando `BASH` é `null`, o probe devolve `null` e o `shellTest` pula com motivo. O motivo do pulo menciona o Git Bash ausente e a `PT_BASH`.
- **`load-slices.test.mjs`:** a `bash` interna de `drive` (linha 81) e o hook da linha 185 usam `BASH`. Os testes que chamam `drive` (nove ocorrências) recebem `{ skip: BASH ? false : '<motivo>' }` no `test(...)`, para pular com motivo e não falhar (R5).
- **`flow.test.mjs`:** o `gitBashPath` local é removido. O teste `shq: o Git Bash entrega o texto literal` importa `gitBash` e mantém a guarda contra `system32`/`windowsapps` e o probe `bash -c true`.

A verificação é rodar `node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs` num pwsh puro, com System32 antes do Git no PATH e sem `PT_BASH`. Todos os testes passam, sem pulo no Windows com Git instalado (o plano de correções registrou 41/41).

**Critério AC2 (o lint falha com mensagem apontando a #29).** Em `lint-plugin.mjs`, logo depois do bloco DEC-057 (linhas 258-271) e antes do "Check 3 + 4: skills", entra o check `No commands/ or custom component paths (#29)`:
- os achados são `commands/` quando `isDir(path.join(dir, 'commands'))`, `plugin.json "commands"` quando `pj` tem a chave `commands`, e `plugin.json "skills"` quando tem a chave `skills`, qualquer que seja o valor;
- cada achado gera `add('FAIL', check, 'found <achado>: allowed-tools is not linted there yet, see https://github.com/odeciojunior/claude-play/issues/29')`;
- sem achados, `ok(check)`;
- `agents`, `hooks` e `mcpServers` no `plugin.json` não disparam (R3).

Em `lint-plugin.test.mjs`, com `fresh()`, `write()` e `mutatePluginJson()`, entram quatro casos:
- `commands/x.md` criado dá FAIL com `issues/29` e `found commands/`;
- `"commands": "./cmds"` no plugin.json dá FAIL com `plugin.json "commands"`;
- `"skills": "./extra"` dá FAIL com `plugin.json "skills"`;
- `"agents"`, `"hooks"` e `"mcpServers"` não geram FAIL desse check.

O teste `valid fixture has 0 FAIL and 0 WARN` continua verde. O teste T11 de `independence.test.mjs` (0 FAIL e 0 WARN no productivity-tools) também, porque hoje nenhum plugin tem `commands/` nem essas chaves (conferido nesta spec).

Documentação (R4):
- uma linha na lista de cobertura de `validate-plugin/SKILL.md` (linha 36): "commands/ or custom commands/skills paths in plugin.json (FAIL until #29 lints allowed-tools there; DEC-013)";
- uma linha em `docs/claude-code-extensibility-reference.md`, logo depois do parágrafo "Repo policy (claude-play)" (linha 264), dizendo que o lint dá FAIL em plugin com `commands/` ou com as chaves `commands`/`skills` no plugin.json até a #29.

## Deixado para o plano

- A ordem das fatias. São independentes: D1 só mexe em testes do productivity-tools e D2a no marketplace-tools.
- O texto exato do motivo de pulo e o nome da constante (`BASH`).
- Rodar, ao fim, `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` em cada plugin e em `plugins/_template` (se aplicável), e `node --test` nas suítes tocadas mais `independence.test.mjs`. Se algum plugin reprovar, parar a D2a e voltar ao dono via opus.

```json data
{
  "schema": "spec/1",
  "id": "E50",
  "title": "Testes portáveis e disparador do lint",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um pwsh com System32 antes do Git no PATH, quando as suítes de capture e load-slices rodam, então passam. {verify: test; evidence: node --test plugins/productivity-tools/scripts/capture.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/load-slices.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um plugin com commands/ ou caminho customizado no plugin.json, quando o lint roda, então falha com mensagem apontando a #29. {verify: test; evidence: node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica o helper gitBash() e como ele resolve o Git Bash?",
      "decision": "Em plugins/productivity-tools/scripts/git-bash.mjs, módulo só de teste, sem CLI e fora do glob .test.mjs, no padrão de workflow/load-pure.mjs. A ordem é PT_BASH, depois git --exec-path; fora do win32 devolve bash; sem Git Bash devolve null e o teste pula com motivo. A produção não o importa, e o gitBashPath de flow.test.mjs passa a importá-lo. Se independence.test.mjs ou o lint recusarem o arquivo, ele vai para scripts/fixtures/.",
      "basis": "Resposta Q1 do dono (delegado), literal no intake; tarefa D1 do plano de correções.",
      "alternative": "Exportar a findBash de capture.mjs para os testes.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Alinhar plugins/mcp-sql-server/scripts/setup.test.mjs ao helper?",
      "decision": "Não. É outro plugin e fica como está.",
      "basis": "Resposta Q2 do dono (delegado); o item era opcional na D1.",
      "alternative": "Alinhar também o setup.test.mjs do mcp-sql-server.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Qual é o texto e qual é o gatilho do FAIL do lint?",
      "decision": "Check 'No commands/ or custom component paths (#29)', com detalhe 'found <commands/ | plugin.json \"commands\" | plugin.json \"skills\">: allowed-tools is not linted there yet, see https://github.com/odeciojunior/claude-play/issues/29'. Dispara com a pasta commands/ existente ou com as chaves commands ou skills no plugin.json; agents, hooks e mcpServers ficam fora.",
      "basis": "Resposta Q3 do dono (delegado); DEC-013 (só o disparador, D2 completo adiado).",
      "alternative": "Disparar também com agents, hooks e mcpServers no plugin.json.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Que documentação muda?",
      "decision": "Uma linha em validate-plugin/SKILL.md e uma em docs/claude-code-extensibility-reference.md.",
      "basis": "Resposta Q4 do dono (delegado); a D2 do plano cita os dois arquivos.",
      "alternative": "Seção nova no README do marketplace-tools.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como os testes de load-slices.test.mjs pulam quando o Git Bash não existe, se a bash fica dentro de drive(), que não recebe o contexto do teste?",
      "decision": "Resolver BASH = gitBash() uma vez no topo do módulo e passar { skip: BASH ? false : motivo } a cada test(...) que chama drive.",
      "basis": "Pula com motivo visível no relatório do node --test sem mudar a assinatura de drive nem os nove chamadores.",
      "alternative": "Passar t para drive e chamar t.skip lá dentro.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "removedTests": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Windows sem Git instalado e sem PT_BASH.",
      "expected": "gitBash() devolve null; os testes de Git Bash em capture, load-slices e flow pulam com motivo, sem falhar."
    },
    {
      "id": "C2",
      "input": "PT_BASH definida com caminho inexistente.",
      "expected": "gitBash() devolve o valor como está, como a findBash de capture.mjs; o probe do capture falha e o teste pula, e os testes de load-slices falham visivelmente, o que expõe a configuração errada."
    },
    {
      "id": "C3",
      "input": "plugin.json com a chave skills apontando para ./skills, o caminho padrão.",
      "expected": "O lint dá FAIL do mesmo jeito: o gatilho é a presença da chave, não o valor."
    },
    {
      "id": "C4",
      "input": "Plugin com commands/ e com a chave commands no plugin.json.",
      "expected": "Dois FAIL no mesmo check, um por achado."
    }
  ]
}
```
