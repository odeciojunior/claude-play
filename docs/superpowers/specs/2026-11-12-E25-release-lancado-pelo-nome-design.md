# E25 -- Workflow do release lançado pelo nome (design)

Entregável E25 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQ: REQ-033. Depende de E14 (sondas: nome `<plugin>:<meta.name>`, regra `Workflow(<plugin>:<nome>)`, concessão por `allowed-tools`, cache não legível para o caminho; SRC-14, SRC-15, DEC-035, DEC-049, DEC-050, DEC-061) e de E18 (preflight com `missingRules`, `warnings`, `runToken` e `trackerCli`; DEC-211, DEC-250). Card não crítico, trilha de engenharia, fase roadmap-sem-llm. Fatia de E18 (DEC-047); nomes de DEC-041.

## Por quê

Hoje a skill `roadmap-release` lança o workflow por caminho (`scriptPath` = `<dir>/workflow/roadmap-release.js`). No modo padrão esse lançamento é recusado quando a pasta do script não está no conjunto legível, e a pasta do cache do plugin não é legível (SRC-13, SRC-14, SRC-15); só o lançamento pelo nome oferece "Yes, and don't ask again", que grava `Workflow(<plugin>:<nome>)` em `.claude/settings.local.json` e deixa a sessão seguinte lançar sem diálogo (SRC-14, rota A). O manifesto do plugin não tem a chave `workflows`, então o nome não existe (SRC-15, peça 3). O plugin não embarca hook que aprove o lançamento (DEC-035); a concessão pela própria skill, por `allowed-tools`, funcionou sem diálogo e o dono decidiu que ela entra (DEC-049).

## Critérios de aceite (do card, literais)

1. Dadas configurações sem regra que cubra o workflow do release, quando o preflight roda, então a regra aparece nos avisos com o texto exato a acrescentar, e não entre as regras ausentes que bloqueiam; com a regra presente, o aviso não aparece. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
2. Dado o workflow do release lançado sem configuração ou sem o token de execução, quando ele inicia, então devolve erro antes de qualquer chamada de agente. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dado o manifesto do plugin, quando o teste o lê, então ele registra o arquivo do workflow do release, o nome do workflow não é o de nenhuma skill do plugin, e a skill manda lançar por esse nome. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
4. Dada uma sessão no modo padrão, sem regra e sem hook, quando o dono lança o release pela skill e escolhe não perguntar de novo, então o lançamento seguinte no mesmo projeto começa sem diálogo. {verify: human; evidence: o dono confere em duas sessões seguidas e registra o modo de permissão}
5. Dado o SKILL.md do release, quando o lint do plugin roda, então `compatibility` declara a versão mínima e, se `allowed-tools` estiver presente, ele lista só o workflow do próprio plugin; qualquer outra entrada em `allowed-tools` é acusada. {verify: test; evidence: node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs}
6. Dada a concessão por `allowed-tools`, quando o dono lança o release pela skill numa sessão no modo padrão, sem regra de permissão, então o lançamento começa sem diálogo. {verify: human; evidence: o dono confere numa sessão nova e registra o modo de permissão}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes; teste comportamental da skill feito conforme as regras de SRC-03.

Os critérios 4 e 6 são atos humanos: este entregável produz os passos e o estado do código que permitem conferi-los, e nunca os marca como cumpridos. Eles ficam como pendências do dono (ver "Depende de entrada humana").

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- O workflow do release passa a existir como workflow nomeado do plugin, `productivity-tools:release-workflow`, sem mover o arquivo (peça 2).
- A skill lança pelo nome, e cai para o caminho só quando a CLI não conhece o nome (peças 2 e 4).
- O preflight avisa, sem bloquear, a regra `Workflow(productivity-tools:release-workflow)` quando nenhuma configuração lida a cobre (peça 1).
- O workflow recusa, antes de qualquer agente, um lançamento sem `config` ou sem `runToken` (peça 3).
- A skill concede o próprio workflow por `allowed-tools`, e o lint acusa qualquer outra entrada; o `CLAUDE.md` ganha uma frase de exceção (peça 5).

Não objetivos:

- Workflow nomeado do coordinator (`coordinator-workflow`, DEC-041): não é deste card.
- Mudar a semântica de autorização de efeito externo, de retomada ou de registro pela CLI (E18, E23).
- Subir versão, publicar, fazer push ou levar algo a `main` (instrução do dono, item 7). A entrada na publicação fica para quando o card integrar (o card diz que não segura E17).
- Atualizar `tools/measure/make-scenario.mjs`, cuja lista `SANDBOX_RELEASE_RULES` cita o nome antigo `Workflow(productivity-tools:roadmap-release)` ao lado do `Workflow` sem conteúdo, que já cobre o lançamento (decisão autônoma 14).
- Mudar `CONTRIBUTING.md` (decisão autônoma 13).

Anti-objetivos:

- Nenhum hook do plugin aprova o lançamento (DEC-035).
- A skill nunca edita arquivos de configuração (`settings.json`, `settings.local.json`); só mostra a regra.
- `allowed-tools` nunca recebe outra ferramenta além do workflow do próprio plugin (critério 5, instrução do dono item 3).
- A trava da peça 3 não remove nenhuma condição existente (instrução do dono item 4).

## Desenho

### Arquivos

| Arquivo | Peça | Mudança |
|---|---|---|
| `plugins/productivity-tools/.claude-plugin/plugin.json` | 2 | Chave `workflows: ["./skills/roadmap-release/workflow/roadmap-release.js"]`. A versão não muda. |
| `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` | 2, 3 | `meta.name` passa de `roadmap-release` para `release-workflow`; recusa anterior sem `runToken`. |
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs` | 1 | Constantes `RELEASE_WORKFLOW` e `releaseWorkflowRule()`, função `workflowRuleCovered()`, aviso em `warnings`. |
| `plugins/productivity-tools/skills/roadmap-release/SKILL.md` | 2, 4, 5 | Passo 4 lança pelo nome com reserva por caminho; `compatibility`; depois `allowed-tools`. |
| `plugins/productivity-tools/skills/roadmap-release/references/config.md` | 1 | Uma frase na seção "Permission preflight" sobre o aviso do workflow. |
| `plugins/productivity-tools/skills/roadmap-release/references/operator.md` | 4 | Só se o texto atual citar o lançamento por caminho como único: uma frase que remete ao passo 4 do SKILL.md. |
| `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | 1 | Casos do critério 1. |
| `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | 2, 3 | Casos dos critérios 2 e 3. |
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` | 4, 5 | Checagem de `compatibility` (peça 4) e de `allowed-tools` (peça 5). |
| `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` | 4, 5 | Casos do critério 5. |
| `CLAUDE.md` (raiz) | 5 | Uma frase de exceção na regra "SKILL.md frontmatter keys". |

Nenhum arquivo de teste novo: os casos vão para os arquivos que o card nomeia e para o teste do lint que o critério 5 nomeia. Nenhum arquivo da pasta `docs/plans/roadmap-evolucao-skills/` é editado nesta branch.

### Ordem dos commits

A ordem existe para que o critério 4 possa ser conferido no código antes da concessão (instrução do dono item 6) e para que a peça 5 fique isolada para a revisão de raio de impacto alto:

1. Arnês de teste (só se preciso, ver peça 3).
2. Peça 3: trava do `runToken`.
3. Peça 1: aviso do preflight.
4. Peças 2 e 4: manifesto, `meta.name`, lançamento pelo nome com reserva, `compatibility` e a checagem de `compatibility` no lint. O último commit desta etapa tem o assunto `feat(roadmap-release): workflow do release lançado pelo nome (E25)`, e é ele o "commit anterior à concessão" dos passos do dono.
5. Peça 5: `allowed-tools`, checagem de `allowed-tools` no lint e a frase do `CLAUDE.md`. Último commit de código da branch.

### Peça 3 -- trava antes de qualquer agente

Hoje o workflow já devolve `status: 'error'` antes de qualquer agente quando `args.config` falta ou não tem `gates` (`roadmap-release.js`, bloco "args and config"), e só exige o `runToken` quando há item de tarefa autorizado (`MODE === 'run' && !RUN_TOKEN && AUTH.items.some(...)`), além da checagem dentro da tarefa externa.

Mudança: logo depois da checagem de `config`, uma recusa nova, em qualquer modo:

```js
if (!RUN_TOKEN) return { status: 'error', error: 'runToken is missing: launch the workflow through the roadmap-release skill, which runs scripts/preflight.mjs and passes its config, runToken and trackerCli' }
```

- Nenhuma condição existente é removida nem afrouxada: a checagem com item de tarefa autorizado e a checagem dentro da tarefa externa ficam no código, ainda que a primeira passe a ser alcançada só por quem já passou da nova (instrução do dono item 4, risco do card).
- A recusa vem antes de `parseAuthorizeExternal`? Não: fica depois da checagem de `config` e depois de `AUTH`, para que um `authorizeExternal` malformado continue devolvendo o erro de hoje; o que importa ao critério é que nenhuma chamada de `agent()` ocorra, e nenhuma ocorre antes da descoberta.
- Sem `config`, a mensagem continua a de hoje (critério 2, primeira metade). Os dois casos são testados contando as chamadas de agente do arnês: zero.

Arnês de teste: o `exec()` de `flow.test.mjs` já passa `runToken: 'pf-test'` por padrão desde `f01bbbd`, e os três testes que passam `runToken: undefined` (B4, FF/M6, F2/m2) esperam erro que casa `/runToken/`, que a recusa nova também casa. Os outros arquivos de teste do workflow não executam o script. A primeira tarefa do plano roda a suíte com a recusa nova num rascunho e lista os testes que quebram por falta de token; se houver algum, a mudança do padrão do arnês (ou do teste) entra num commit próprio, antes da recusa, com a suíte atual verde (G1); se não houver, o commit não existe e o relatório da tarefa diz isso com a saída do G1.

### Peça 1 -- aviso da regra no preflight

Em `preflight.mjs`:

- `export const RELEASE_WORKFLOW = 'productivity-tools:release-workflow'` e `export function releaseWorkflowRule() { return \`Workflow(${RELEASE_WORKFLOW})\` }`.
- `export function workflowRuleCovered(settingsList)`: verdadeiro quando algum `permissions.allow` das configurações lidas (as mesmas três de hoje: usuário, projeto, local do projeto; `CLAUDE_CONFIG_DIR` respeitado) tem exatamente `Workflow(productivity-tools:release-workflow)` ou `Workflow` sem conteúdo (a regra sem conteúdo cobre o lançamento pelo nome; SRC-14). Qualquer outra forma (`Workflow(*)`, curingas) não conta: um aviso a mais não bloqueia nada.
- Em `runPreflight`, dentro do mesmo bloco em que `missingRules` é calculado (só quando `config` existe e `errors` está vazio), quando `workflowRuleCovered` é falso, um aviso:

  `release workflow: no permission rule covers it, so a run without the interface (claude -p) or a launch outside this skill is denied; to allow it, add to permissions.allow in .claude/settings.local.json: Workflow(productivity-tools:release-workflow)`

- A regra nunca entra em `requiredCommands` nem em `missingRules`, então nunca causa a parada do passo 2 da skill (critério 1).
- `references/config.md`, seção "Permission preflight": uma frase que descreve esse aviso e diz que o lançamento pela skill é concedido por `allowed-tools` (depois da peça 5) ou pelo "don't ask again" do diálogo.

Um teste confere que `RELEASE_WORKFLOW` é `<name de plugin.json>:<meta.name do script>`, lendo os dois arquivos, para que a constante não se separe do manifesto.

DEC-250 não é acionada: nenhum script do plugin passa a rodar fora do workflow; a regra avisada é de `Workflow`, não de `Bash`.

### Peça 2 -- workflow nomeado e lançamento pelo nome

- `plugin.json` ganha `"workflows": ["./skills/roadmap-release/workflow/roadmap-release.js"]`, a forma do plugin de sonda (`docs/reports/2026-11-10-e14-sondas/wfprobe2/.claude-plugin/plugin.json`). O arquivo não se move.
- `meta.name` do script passa a ser `release-workflow` (DEC-041). O nome não repete o de nenhuma skill do plugin (DEC-035, DEC-041).
- Passo 4 do `SKILL.md`: "Call the `Workflow` tool with `name` set to `productivity-tools:release-workflow` and `args` ..." no lugar de `scriptPath`; o resto do passo (os seis argumentos, a retomada, o mapeamento) não muda. A frase de abertura do SKILL.md passa a nomear o workflow pelo nome, citando o arquivo como fonte.
- Se o lançamento pelo nome for negado por permissão (não por nome desconhecido), a skill não tenta o caminho: relata a negação e mostra a regra exata `Workflow(productivity-tools:release-workflow)`, como já faz com as regras do preflight, sem editar configuração.

Teste do critério 3 (em `flow.test.mjs`): lê `plugin.json`, confere que `workflows` contém o caminho do script e que o arquivo existe; extrai `meta.name` do script e confere que é `release-workflow` e que não é o `name` de nenhum `skills/*/SKILL.md` do plugin nem o nome de nenhuma pasta de skill; confere que o `SKILL.md` do release manda chamar `Workflow` com `name` igual a `productivity-tools:release-workflow`.

`claude plugin validate plugins/productivity-tools` (G3) precisa aceitar a chave `workflows`; o plugin de sonda já a usava. Se o validador a recusar, a tarefa para e devolve o erro: o card se reduz à peça 1, como prevê o primeiro risco do card.

### Peça 4 -- reserva por caminho e versão mínima

- Passo 4 do `SKILL.md`: quando o `Workflow` responder que o nome não existe (erro de workflow não encontrado ou nome desconhecido), a skill faz uma única chamada com `scriptPath` = `<dir>/workflow/roadmap-release.js` (absoluto, montado da linha "Base directory for this skill", como hoje) e os mesmos `args`, e diz à pessoa que essa reserva só funciona para quem roda sem prompts de permissão ou libera a pasta do script (por exemplo com `--add-dir`), porque no modo padrão a pasta do cache não é legível (DEC-061). Se a reserva também falhar, a skill relata os dois erros literais e termina; não tenta de novo.
- `compatibility` no frontmatter: `"Claude Code 2.1.322 or later launches the release workflow by name; older versions fall back to the script path, which works only without permission prompts or with the script folder readable."` (menos de 500 caracteres).
- Lint (`lint-plugin.mjs`), parte da peça 4: um SKILL.md que nomeia no corpo um workflow registrado do próprio plugin (`<plugin>:<meta.name>` de um arquivo listado em `workflows` de `plugin.json`), ou cujo `allowed-tools` tem alguma entrada `Workflow(...)`, precisa ter `compatibility` com uma versão `\d+\.\d+\.\d+`; sem isso, FAIL `compatibility must declare the minimum Claude Code version that launches <nome> by name`.

### Peça 5 -- concessão por `allowed-tools` (raio de impacto alto)

- Frontmatter do `SKILL.md` do release: `allowed-tools: Workflow(productivity-tools:release-workflow)`, na forma de linha única (o parser de frontmatter do lint junta itens de lista YAML numa linha; a forma de linha única evita depender disso; o plugin de sonda usou lista e funcionou, SRC-14).
- Lint, parte da peça 5:
  - `allowed-tools` sai do aviso "outside the allowed frontmatter keys" e passa a ter checagem própria.
  - As entradas são separadas por espaço ou vírgula fora de parênteses, sem o `-` de item de lista.
  - Cada entrada precisa ser exatamente `Workflow(<name de plugin.json>:<meta.name>)` de um arquivo listado em `workflows` do próprio `plugin.json`. Qualquer outra entrada (outra ferramenta, `Workflow` sem conteúdo, workflow de outro plugin, nome não registrado, curinga) é FAIL `allowed-tools may only grant a workflow of this plugin (DEC-049); remove <entrada>`. `allowed-tools` vazio também é FAIL.
  - Plugin sem `workflows`: qualquer `allowed-tools` é FAIL.
- `CLAUDE.md`, na regra "SKILL.md frontmatter keys (repo policy)", uma única frase acrescentada ao fim, sem tocar no resto:

  `Exception (DEC-049): a skill may declare \`allowed-tools\` only to grant a workflow of its own plugin, today \`roadmap-release\` with \`Workflow(productivity-tools:release-workflow)\`; \`lint-plugin\` fails any other entry.`

Revisão de raio de impacto alto (instrução do dono item 2; DEC-049; GLOBAL T2/T3): a revisão por tarefa da peça 5 e a revisão de segurança rodam em opus; o portão final da branch em opus/high; nenhum revisor sonnet na peça 5. A revisão de segurança confere, no mínimo:

1. Que a concessão vale só para `Workflow(productivity-tools:release-workflow)`, e que nenhum outro texto do SKILL.md ou do lint a amplia.
2. Que um lançamento sem preflight é recusado antes de qualquer agente (peça 3) e que `authorizeExternal` continua crescendo só pela resposta da pessoa (regras do SKILL.md): a concessão tira o diálogo de lançamento, não a pergunta de autorização de efeito externo nem a parada do passo 2.
3. O cenário de injeção: conteúdo do repositório (card, plano, nota) que leve o modelo a carregar a skill e lançar o workflow sem a pessoa pedir. O que o workflow pode fazer sem autorização: criar worktrees e branches em `<wtRoot>`, rodar agentes, comitar e fazer merge local no alvo (nunca na `integrationBranch` sem `allowIntegrationBranch`, nunca push sem tarefa externa autorizada), com custo de LLM. A revisão diz se a restrição ao próprio workflow, a trava e as regras da skill cobrem esse cenário.
4. Que o lint acusa as formas de escape (`Workflow`, `Workflow(*)`, `Bash(...)`, `Workflow(outro-plugin:x)`, nome não registrado, lista YAML com entrada extra).

Se a revisão de segurança apontar risco que essas restrições não cobrem, a execução para como decisão (gatilho de revisão de DEC-049), devolvida ao dono, e a peça 5 não entra no merge; as peças 1 a 4 seguem (instrução do dono item 8).

### Pendências do executor de `state.md` sobre E25 (resolvidas neste desenho)

1. "Nome, regra e concessão por `allowed-tools` só foram vistos com o plugin carregado do caminho local." Resolução: os critérios 4 e 6 têm dois roteiros do dono (abaixo). O roteiro A, com o plugin carregado do caminho local da worktree, basta para o critério conforme o risco do card. O roteiro B instala o plugin a partir da worktree num diretório de configuração descartável (`CLAUDE_CONFIG_DIR`), o que põe o plugin no cache sem push e sem tocar a configuração real do dono, e confere o nome e a concessão vindos do cache; ele responde os gatilhos de DEC-061 ("o nome não resolve com o plugin instalado") e de DEC-049 ("a concessão não funcionar com o plugin instalado do cache"). Nenhum dos dois é executado por agente; os dois ficam como pendências do dono. Se B falhar, o dono abre a revisão de DEC-061 e DEC-049; o código não muda nesta branch por isso.
2. "`skipWorkflowUsageWarning` não testado na sessão interativa." Resolução: nenhum código deste card lê, grava ou depende dessa chave; ela não é regra de permissão e o preflight não a conta como cobertura. Os roteiros do dono registram, como observação, o hash do `settings.json` do usuário antes e depois do diálogo e se a chave apareceu; o resultado não muda nenhum critério.

### Como o dono confere os critérios 4 e 6

Com a concessão presente nenhum diálogo aparece, então o critério 4 é conferido no código anterior à concessão (instrução do dono item 6).

Preparação (comum):

1. Numa pasta fora de `D:/projects/claude-play` e de `D:/projects/claude-play-wt`, por exemplo `<tmp>/e25-dono`, criar duas cópias de trabalho da branch: `git -C D:/projects/claude-play-wt/E25 worktree add <tmp>/e25-dono/sem-concessao <SHA do commit "feat(roadmap-release): workflow do release lançado pelo nome (E25)">` e `git -C D:/projects/claude-play-wt/E25 worktree add <tmp>/e25-dono/com-concessao feat/E25` (o relatório da execução traz o SHA).
2. Gerar um sandbox novo para cada critério: `node <tmp>/e25-dono/sem-concessao/plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs <tmp>/e25-dono/sb4` e o mesmo com `sb6`. Conferir que `<sandbox>/.claude/` não tem `settings.local.json` com regra `Workflow`, e que nenhuma configuração do usuário tem `Workflow` ou `Workflow(productivity-tools:release-workflow)`.
3. Anotar o hash de `~/.claude/settings.json` (`certutil -hashfile` ou `sha256sum`).

Critério 4, roteiro A (plugin do caminho local):

1. `cd <tmp>/e25-dono/sb4` e `claude --plugin-dir <tmp>/e25-dono/sem-concessao/plugins/productivity-tools --permission-mode default`.
2. Digitar `/productivity-tools:roadmap-release dry-run`. Quando aparecer o diálogo `Run a dynamic workflow?`, escolher `Yes, and don't ask again for productivity-tools:release-workflow in <pasta>`.
3. Conferir que `<sandbox>/.claude/settings.local.json` tem `Workflow(productivity-tools:release-workflow)` em `permissions.allow`. Sair.
4. Sessão nova, mesma pasta, mesmo comando de abertura e `/productivity-tools:roadmap-release dry-run`: o lançamento começa sem diálogo.
5. Registrar: modo de permissão (`default`), as duas sessões, o texto do diálogo, o conteúdo do arquivo e se `skipWorkflowUsageWarning` apareceu no `settings.json` do usuário (hash antes e depois). Remover essa chave, se apareceu e o dono quiser, e a regra do sandbox não importa (sandbox descartável).

Critério 6, roteiro A:

1. `cd <tmp>/e25-dono/sb6` (sem regra) e `claude --plugin-dir <tmp>/e25-dono/com-concessao/plugins/productivity-tools --permission-mode default`.
2. `/productivity-tools:roadmap-release dry-run`: o lançamento começa sem diálogo, e `<sandbox>/.claude/settings.local.json` continua sem regra `Workflow`.
3. Registrar modo de permissão, ausência de diálogo e ausência de regra.

Roteiro B (cache, para os dois critérios): repetir os roteiros acima com `CLAUDE_CONFIG_DIR=<tmp>/e25-dono/cfg` (pasta vazia; entrar na conta nela se a CLI pedir), trocando `--plugin-dir` por `claude plugin marketplace add <worktree>` e `claude plugin install productivity-tools@claude-play` (uma cópia de trabalho por vez, desinstalando entre os critérios), e conferir antes de lançar que `<tmp>/e25-dono/cfg/plugins/cache/claude-play/productivity-tools/1.6.0/` existe. Registrar o mesmo que no roteiro A.

Limpeza: `git -C D:/projects/claude-play-wt/E25 worktree remove` das duas cópias e apagar `<tmp>/e25-dono`.

`dry-run` para depois da seleção e não faz merge; ainda assim paga a descoberta (um agente). O lançamento pelo nome é o que o critério observa.

### Testes

- `preflight.test.mjs` (critério 1): configurações sem regra `Workflow`: o aviso aparece com o texto exato `Workflow(productivity-tools:release-workflow)` e a regra não está em `missingRules`; com `Workflow(productivity-tools:release-workflow)` em qualquer das três configurações, ou `Workflow` sem conteúdo, o aviso não aparece; com `Workflow(*)`, aparece; com `errors` não vazio, o aviso não é calculado; `RELEASE_WORKFLOW` igual a `<plugin.json name>:<meta.name>`.
- `flow.test.mjs` (critério 2): sem `config`: erro e zero chamadas de agente; sem `runToken` em `run`, `plan-only` e `dry-run`, sem item autorizado: erro que casa `/runToken/` e zero chamadas de agente; os testes existentes de `runToken` continuam passando.
- `flow.test.mjs` (critério 3): manifesto, `meta.name`, nome distinto das skills, SKILL.md manda lançar por esse nome; o SKILL.md descreve a reserva por caminho só para nome desconhecido e cita a limitação de DEC-061.
- `lint-plugin.test.mjs` (critério 5): `compatibility` ausente ou sem versão num SKILL.md que nomeia um workflow registrado: FAIL; presente com versão: OK; `allowed-tools` só com o workflow do próprio plugin (linha única e lista YAML): OK; cada forma de escape listada na revisão de segurança: FAIL; plugin sem `workflows` com `allowed-tools`: FAIL; o lint sobre `plugins/productivity-tools` real (G5) sai 0.

### Teste comportamental (definição de pronto, SRC-03)

Por DEC-204, é tarefa do orquestrador da sessão principal, não do executor do workflow. Um subagent segue o `SKILL.md` do release literalmente sobre o sandbox de `make-sandbox.mjs` (em `D:/projects/claude-play-wt/_tmp/E25/`), em `dry-run`, até a montagem da chamada do passo 4, sem chamar o Workflow, em dois cenários: (a) o nome é conhecido: a chamada tem `name: "productivity-tools:release-workflow"` e os seis argumentos; (b) a resposta simulada é "workflow not found": a chamada seguinte usa `scriptPath` absoluto e a mensagem cita a limitação de DEC-061; (c) a resposta simulada é negação por permissão: nenhuma reserva, a regra exata é mostrada. Grava a saída e a lista de ambiguidades no mesmo `_tmp`; depois, revisão adversarial só de leitura. O resumo entra no log de revisões; a pasta temporária é apagada.

### Verificação fora dos testes

Antes de cada commit: G1, G2, G3, G4 e G5, mais `claude plugin validate plugins/marketplace-tools` e `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/marketplace-tools`, porque o lint muda nesse plugin (regra do `CLAUDE.md`: validar cada plugin alterado). Nenhum portão canônico muda.

## Casos de borda

- CLI anterior a 2.1.322, ou plugin carregado sem a chave `workflows`: nome desconhecido, reserva por caminho uma vez (peça 4).
- Pessoa em `bypassPermissions`: o nome lança sem diálogo; o aviso do preflight aparece mesmo assim se nenhuma regra existir (é só informação).
- `Workflow` sem conteúdo nas configurações: cobre; nenhum aviso.
- Retomada (`resumeArgs`): o `runToken` nunca volta neles; a skill sempre passa o do preflight novo, então a trava não muda a retomada correta, e uma retomada sem preflight passa a falhar antes da descoberta (antes falhava só com item autorizado).
- Lançamento pelo nome fora da skill (pessoa digita a chamada, ou outra skill): sem `runToken` e `config`, recusa imediata, sem custo de agente.
- Plugin de sonda ou outro plugin com workflow de mesmo `meta.name`: o nome inclui o plugin, sem colisão.
- `allowed-tools` em lista YAML: aceita pelo lint se a única entrada for a permitida.

## Deixado ao planejador

- A divisão em tarefas dentro da ordem de commits acima, com a peça 5 numa tarefa só, marcada de risco alto (revisão opus, segurança opus).
- O texto exato das frases novas no `SKILL.md` e no `config.md`, dentro do que este desenho fixa.
- Se `operator.md` precisa da frase de remissão (só se citar o caminho como único lançamento).

## Nota de execução

Execução decidida pelo decisor delegado do dono (Fable), não digitada pelo dono: ela segue sem as regras `Bash(node:*)`, `Bash(claude:*)`, `Bash(node *roadmap.mjs" *)` e `Bash(git:*)` porque a sessão orquestradora roda em `bypassPermissions`; o relatório da execução diz isso.

## Decisões autônomas (revisáveis pelo dono)

1. O nome completo é `productivity-tools:release-workflow`, vindo de `meta.name: 'release-workflow'` no script que não se move, registrado por `workflows` em `plugin.json`. Alcance: contrato (E8 edita o mesmo arquivo e o lança pelo mesmo nome).
2. A regra avisada é `Workflow(productivity-tools:release-workflow)`; cobrem o aviso essa regra exata e `Workflow` sem conteúdo, nas três configurações que o preflight já lê; outras formas não contam. Alcance: local.
3. O aviso só é calculado quando o preflight chega a calcular `missingRules` (config válida, sem `errors`). Alcance: local.
4. A constante `RELEASE_WORKFLOW` fica em `preflight.mjs`, com teste que a amarra a `plugin.json` e a `meta.name`. Alcance: local.
5. A trava nova exige `runToken` em todos os modos, logo depois das checagens de `config` e de `authorizeExternal`; nenhuma condição existente sai. Alcance: contrato (todo lançamento precisa passar pelo preflight).
6. O commit próprio do arnês só existe se a recusa nova quebrar algum teste; hoje o `exec()` já passa `runToken: 'pf-test'` (desde `f01bbbd`), e a tarefa registra a saída do G1 que mostra isso. Alcance: local.
7. A reserva por caminho dispara só com nome desconhecido, uma única vez; negação por permissão não cai para o caminho e mostra a regra. Alcance: local.
8. `compatibility` declara 2.1.322, a versão em que o nome do workflow de plugin e a concessão foram observados (SRC-14, SRC-15); versões anteriores não foram testadas e ficam com a reserva (DEC-050). Alcance: local.
9. O lint exige `compatibility` com versão em todo SKILL.md que nomeia um workflow registrado do plugin ou concede `Workflow(...)`. Alcance: local.
10. `allowed-tools` em linha única; o lint aceita linha única ou lista YAML e acusa qualquer entrada que não seja `Workflow(<plugin>:<meta.name registrado>)`, inclusive `Workflow` sem conteúdo e curingas. Alcance: local.
11. A frase de exceção no `CLAUDE.md` é genérica (qualquer skill pode conceder só workflow do próprio plugin), cita o caso de hoje e fica numa frase só. Alcance: local.
12. A peça 5 é o último commit de código, para que o critério 4 seja conferido no commit anterior; os passos do dono usam worktrees descartáveis e o sandbox de `make-sandbox.mjs`, em `dry-run`. Alcance: local.
13. `CONTRIBUTING.md`, que diz que `allowed-tools` não é usado, não muda nesta branch, para manter a edição de política na frase única do `CLAUDE.md` (instrução do dono item 3); fica como item para a etapa de documentação. Alcance: local.
14. `tools/measure/make-scenario.mjs` não muda: sua lista já tem `Workflow` sem conteúdo, que cobre o nome novo; a entrada com o nome antigo fica inerte e é item para quem mexer na medição. Alcance: local.
15. As pendências do executor de `state.md` sobre E25 são resolvidas pelos roteiros A (caminho local) e B (cache num `CLAUDE_CONFIG_DIR` descartável) do dono, e `skipWorkflowUsageWarning` vira só observação registrada. Alcance: local.
16. O teste comportamental vai até a montagem da chamada do passo 4, sem chamar o Workflow, com três respostas simuladas; é tarefa do orquestrador (DEC-204). Alcance: local.
17. Nenhuma versão sobe, nenhum push, nada em `main` (instrução do dono item 7). Alcance: local.

## Depende de entrada humana

Nenhuma entrada humana é bloqueante: os critérios 1, 2, 3 e 5 são `verify: test`, o teste comportamental é do orquestrador com subagents, e o card não pede efeito externo.

- Critério 4 (humano): o dono confere em duas sessões seguidas, no commit anterior à concessão, pelo roteiro A acima, e registra o modo de permissão. Não bloqueante; nunca marcado como cumprido por agente; registrado como pendência do dono.
- Critério 6 (humano): o dono confere numa sessão nova, com a concessão, pelo roteiro A, e registra o modo de permissão. Não bloqueante; pendência do dono.
- Roteiro B (cache): o dono confere nome e concessão com o plugin instalado do cache num `CLAUDE_CONFIG_DIR` descartável; responde os gatilhos de DEC-061 e DEC-049. Não bloqueante; se falhar, o dono abre a revisão dessas decisões.
- Ratificação pelo dono das decisões autônomas acima (DEC-030); as de alcance contrato (1 e 5) seguram o início de E8.
