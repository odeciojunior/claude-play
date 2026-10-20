# Auditoria de alinhamento com a documentação do Claude Code

Oct 20, 2026 · @Odécio Machado

## Resumo

O repo segue boa parte da spec atual, mas tem três tipos de problema:

1. **Guarda-corpos que falham sem aviso.** O hook `validate-marketplace-json.mjs` falha aberto com TypeError. `claude plugin validate` não olha frontmatter de skill nem agents. A grafia `user-invokable` está errada em quatro arquivos de orientação, e as checagens do repo ensinam essa grafia.
2. **Skills que só funcionam na máquina do autor.** `wsl-health-check` chama um script que não é distribuído. `report-analyzer` usa ferramentas de um plugin não declarado. `mcp-sql-server-setup` monta `claude mcp add` em ordem errada e grava a senha em texto puro.
3. **A spec digest (`docs/claude-code-extensibility-reference.md`) está desatualizada desde março.** Ela tem 52 divergências, entre elas 17 eventos de hook quando hoje são 33, "subagents não aninham" e `tool_result` no lugar de `tool_response`.

> **Status (20/10/2026):** as correções foram aplicadas no branch `chore/claude-code-alignment`, seguindo o plano `docs/plans/2026-10-20-claude-code-alignment-plan.md`. O progresso está em `docs/plans/claude-code-alignment-plan/progress-claude-code-alignment-plan.md`. Falta só D1 (versão apenas no `plugin.json` e no README), que espera o merge do `sql-server-tools` v1.1. Releases prontas e ainda não publicadas: marketplace-tools 1.1.0, mcp-sql-server 1.3.0, productivity-tools 1.4.0. Algumas afirmações abaixo foram corrigidas na execução contra a documentação oficial, por exemplo `accTitle`, Windows Auth e a lista de nomes reservados. O arquivo de progresso registra essas mudanças.

As escolhas que guiam as correções estão em [Decisões](#decisões).

## Método

Cinco subagents Sonnet (`claude-code-guide`, só leitura) compararam cada recorte com as páginas oficiais buscadas ao vivo (code.claude.com/docs, platform.claude.com/docs). Os achados de prioridade alta foram conferidos no arquivo ou reproduzidos nesta sessão.

| Recorte | Arquivos | Achados |
|---|---|---|
| Spec digest | `docs/claude-code-extensibility-reference.md` | 52 |
| Orientação do repo | `CLAUDE.md`, `.claude/rules/`, `CONTRIBUTING.md`, `_template/`, README | 19 |
| Ferramentas de revisão | `plugin-reviewer`, `validate-plugin`, `new-plugin`, hooks, `settings.json`, manifests | 30 |
| Skills, lote 1 | excalidraw, mermaid, deep-researcher, report-analyzer, wsl-health-check | 52 |
| Skills, lote 2 | plan-coordinator, roadmap-planner, roadmap-tracker, mcp-sql-server-setup | 36 |

O `sql-server-tools` ficou de fora: já tem auditoria (`2026-10-20-sql-server-tools-audit.md`) e plano v1.1 em andamento.

### Conferido nesta sessão

- **`claude plugin validate` (v2.1.304) não checa chaves de frontmatter.** Um plugin descartável passou com `user-invokable`, com `model`/`context: fork`/`allowed-tools` e com uma chave inventada.
- **O hook de marketplace falha aberto.** Com `"owner": "bob"` ou com o arquivo `null`, o hook lança TypeError e sai com código 1. Código 1 não bloqueia, então o arquivo inválido passa. Entrada `null` e arquivo válido se comportam como deveriam.
- **`claude mcp add --help`** declara `-e, --env <env...>` como variádico e mostra o nome antes do `-e` (`claude mcp add my-server -e API_KEY=xxx -- npx ...`).
- **Rebaixado:** os SKILL.md de `roadmap-planner` (16,5 KB, cerca de 4.100 tokens) e `roadmap-tracker` (18,7 KB, cerca de 4.700) estão perto do corte de 5.000 tokens na compactação, não acima como um agente estimou.

## Correções (prioridade alta)

Erros de fato ou defeitos que quebram algo hoje.

| # | Onde | Problema | Correção | Versão |
|---|---|---|---|---|
| C1 | `.claude/hooks/validate-marketplace-json.mjs:41,45,64` | TypeError com `owner` string, arquivo `null` ou `source` objeto; `exit 1` deixa passar | `try/catch` em volta das checagens chamando `block()`; checar `typeof m.owner === 'object'` | repo |
| C2 | `CLAUDE.md:8`, `.claude/agents/plugin-reviewer.md:93`, `plugins/marketplace-tools/skills/validate-plugin/SKILL.md:39`, `docs/claude-code-extensibility-reference.md:204,227,249` | `user-invokable`; o campo é `user-invocable`, e chave desconhecida é ignorada sem erro | Trocar a grafia nos quatro arquivos | marketplace-tools |
| C3 | `CLAUDE.md:8` e as mesmas checagens | A justificativa ("skills rodam na conversa principal") é falsa: `context: fork` existe, e `allowed-tools` pré-aprova ferramentas sem restringir | Reescrever como política do repo: "não usamos `model`/`context`/`agent`/`allowed-tools`/`hooks`/`paths` para manter skills simples" | marketplace-tools |
| C4 | `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md:163-172` | `-e` variádico engole `mcp-sql-server` como mais um par de env | Nome primeiro: `claude mcp add --transport stdio --scope user mcp-sql-server -e ... -- <python> -m ...` | mcp-sql-server |
| C5 | mesmo arquivo, :98-146 | Senha digitada no chat, passada em argv e gravada em texto puro; "project-shared" faz commit dela | `${DB_PASSWORD}` no `env` do `.mcp.json` com a variável definida no shell; trocar "project-private" por `--scope local`; remover a opção compartilhada com segredo | mcp-sql-server |
| C6 | mesmo arquivo, :115-118 | Caminho do interpretador com `~/` vai para `command` do `.mcp.json`, que não passa por shell (plausível; depende de o Claude expandir) | Subcomando do `setup.sh` que imprime o caminho absoluto nativo (`cygpath -m` no Windows) | mcp-sql-server |
| C7 | `plugins/productivity-tools/skills/wsl-health-check/SKILL.md:8,12,46` | Depende de `~/health-report.sh`, que não vem no plugin; `redis-server` fixo como serviço crítico | Distribuir `scripts/health-report.sh` e chamar via `${CLAUDE_SKILL_DIR}`; serviços configuráveis | productivity-tools |
| C8 | `plugins/productivity-tools/skills/report-analyzer/SKILL.md:86-89` | Usa ferramentas `mcp__plugin_claude-mem_*` de um plugin não declarado | Remover ou condicionar ("se as ferramentas do claude-mem existirem") | productivity-tools |
| C9 | `plugins/productivity-tools/skills/deep-researcher/SKILL.md:155-164` | Texto de agente numa skill: "atualize MEMORY.md" e "Turn Budget" de 35/40 chamadas | Remover a memória (ou condicionar) e trocar o orçamento por "escreva incrementalmente" | productivity-tools |
| C10 | `.claude/agents/plugin-reviewer.md:77-80` | Regex `curl.*\|.*bash` casa qualquer linha com "bash"; `eval`/`exec`/`nc` sem `\b` casam "evaluate" | `curl[^\n]*\|\s*(ba)?sh`, `\beval\b`, `\bexec\b`, `\bnc\b` | repo |
| C11 | `plugins/marketplace-tools/skills/new-plugin/SKILL.md:140` | Indica `/validate-plugin`; skills de plugin têm prefixo | `/marketplace-tools:validate-plugin <nome>` | marketplace-tools |
| C12 | `docs/claude-code-extensibility-reference.md` | 52 divergências (ver [abaixo](#spec-digest)) | Revisão completa da spec digest | repo |

## Lacunas nas checagens

O validador oficial cobre só o manifest, então as checagens do repo são a única defesa para frontmatter e agents. Hoje faltam:

| # | Checagem | Onde adicionar |
|---|---|---|
| G1 | Agents de plugin: `---` na linha 1, `name`/`description` presentes, `name` sem `:`, YAML válido (arquivo ruim é ignorado sem aviso) | `validate-plugin`, `plugin-reviewer` |
| G2 | Agents de plugin com `hooks`, `mcpServers`, `permissionMode` ou `initialPrompt` (ignorados em plugins) | `validate-plugin`, `plugin-reviewer` |
| G3 | SKILL.md acima de 500 linhas; referência acima de 100 linhas sem sumário; referência a mais de um nível | `validate-plugin` |
| G4 | `description` + `when_to_use` acima de 1.536 caracteres; booleanos de frontmatter válidos | `validate-plugin` |
| G5 | Prefixos reservados no nome (`claude-`, `anthropic-`, `cc-plugin-`), que `claude plugin validate` rejeita | `validate-plugin`, `new-plugin` |
| G6 | Rodar `claude plugin validate plugins/<nome> --strict` como checagem 0 | `validate-plugin` |
| G7 | `hooks/hooks.json` com o invólucro `"hooks"`; `.mcp.json` válido; caminhos de componente com `./` e existentes | `validate-plugin` |
| G8 | Escrita de estado em `${CLAUDE_PLUGIN_ROOT}` (muda a cada update); usar `${CLAUDE_PLUGIN_DATA}` | `validate-plugin` |
| G9 | Nome e versão da entrada do `marketplace.json` iguais aos do `plugin.json`; nomes duplicados | hook de marketplace |
| G10 | Matcher `Edit\|Write` não cobre `NotebookEdit` (que usa `notebook_path`) nem escrita via Bash em `_template/` | `settings.json`, `protect-template.mjs` |
| G11 | `plugin-reviewer` promete "Tool permissions appropriate" no relatório, mas a fase 3 não define a checagem | `plugin-reviewer` |
| G12 | `new-plugin` registra só no `marketplace.json`; o CLAUDE.md exige também README e os dois diagramas | `new-plugin` |

## Melhorias

### Orientação do repo

- **`CLAUDE.md:26`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md:10`:** a spec só exige `name` no `plugin.json`. Os outros campos "obrigatórios" são política do repo, e o texto deve dizer isso.
- **`CLAUDE.md:10`:** "No CI: rode `claude plugin validate`" dá a entender que o validate pega erros de frontmatter. Diga que ele cobre só manifests e aponte para `validate-plugin`.
- **`CLAUDE.md:16-17`:** falta o passo `/reload-plugins` (ou reiniciar) no fluxo de publicação. Versões antigas no cache são apagadas após 14 dias.
- **`CLAUDE.md` (novo):**
  - Para desenvolver sem subir versão, adicione o marketplace por caminho local (`claude plugin marketplace add <caminho>`) e use `/reload-plugins`.
  - Avise que agents de plugin ignoram `hooks`, `mcpServers` e `permissionMode`.
- **`CLAUDE.md:21-37,43`:** a árvore de layout pode ser descoberta lendo o repo, e "used to need jq" é histórico. A doc recomenda cortar o que não muda comportamento.
- **`CONTRIBUTING.md:9`:** o link aponta para o domínio antigo `docs.anthropic.com`.
- **`CONTRIBUTING.md:57-60,83`:** faltam os prefixos reservados e a regra de nome igual entre entrada e manifest. Não diz quem atualiza README e diagramas.
- **`README.md:7-13`:** falta ensinar a atualizar. Marketplaces de terceiros vêm com atualização automática desligada.
- **`_template/` SKILL.md:** um comentário com as chaves permitidas e a grafia `user-invocable`. O arquivo é protegido; ver D3.
- **`.claude/settings.json`:** a doc recomenda a forma exec (`"command":"node","args":["${CLAUDE_PROJECT_DIR}/..."]`). Vale confirmar que o guarda dispara no Windows: no commit `1dae827` o hook já falhou aberto uma vez.

### Skills (productivity-tools)

- **Roteamento.** Descrições em terceira pessoa com "Use quando… Não para…" separando:
  - mermaid de excalidraw;
  - deep-researcher de report-analyzer e das skills de roadmap;
  - plan-coordinator de `superpowers:subagent-driven-development`.

  `wsl-health-check` precisa dizer que é WSL/Linux.
- **excalidraw-designer (506 linhas):**
  - Mover o exemplo JSON de 240 linhas para `references/`.
  - Subir as regras de binding para logo após o fluxo.
  - Criar `scripts/validate-excalidraw.mjs` para o checklist determinístico.
  - Verificar os IDs de `fontFamily` e os campos de binding atuais do Excalidraw (o agente não confirmou).
- **mermaid-designer:**
  - A regra de `accTitle`/`accDescr` aparece quatro vezes; deixar uma.
  - Verificar a afirmação "não suportado em gantt/pie/mindmap" e a de que `init` está "deprecated since v10.5". As duas podem estar desatualizadas.
  - Mover os exemplos por tipo para `references/`.
- **plan-coordinator:**
  - Sugerir dynamic workflows ao usuário para planos grandes ou repetitivos.
  - Proibir executores de disparar subagents: o aninhamento quebra a garantia de write-set.
  - Pré-aprovar comandos de validação antes de ondas em segundo plano.
  - Não repetir o CLAUDE.md no brief, que os subagents já carregam.
  - Registrar o modelo efetivo, porque `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` pode sobrescrever.
  - Adicionar sumário em `delegation-protocol.md`, que tem 107 linhas.
- **roadmap-planner e roadmap-tracker:**
  - Trocar a dependência do texto "Base directory…" por `${CLAUDE_SKILL_DIR}`.
  - Mover blocos longos para `references/` para ganhar folga do corte de 5.000 tokens.
  - Especificar modelo e formato no subagent de leitura e um revisor somente leitura.
- **Geral:**
  - Tirar linhas de persona ("You are a…").
  - Tirar conselhos genéricos ("prefira ferramentas dedicadas").
  - Tirar datas e versões fixas em exemplos.
  - Tornar caminhos como `docs/diagrams/` padrão sobrescrevível.

### mcp-sql-server-setup

- Escopo de projeto exige aprovação (`⏸ Pending approval`). Use `claude mcp get mcp-sql-server` em vez de `claude mcp list --scope user`.
- Use `claude mcp remove` + `claude mcp add-json` em vez de editar `~/.claude.json` à mão.
- `DB_DATABASE` (detectado no `.env`) vs `DB_NAME` (gravado): mapear explicitamente.
- O fluxo de falha da opção C se contradiz: escolher um.
- `setup.sh`: `grep -oP` quebra no grep BSD do macOS; falta o caminho do Homebrew ARM.
- Considere `disable-model-invocation: true`, porque a skill instala software e grava credenciais.

### Spec digest

Agrupado por seção de `docs/claude-code-extensibility-reference.md`. A revisão (C12) deve reconferir cada seção contra a página oficial correspondente, não só estes pontos.

| Seção | Principais divergências |
|---|---|
| Plugins (linhas 20-169) | Faltam `output-styles/`, `themes/`, `monitors/`, `workflows/`, `bin/` e os campos `userConfig`, `dependencies`, `defaultEnabled`. `commands`/`agents` **substituem** a varredura padrão, não complementam. `pip` não é tipo de source. `strict: false` com `plugin.json` gera conflito. Faltam `${CLAUDE_PLUGIN_DATA}`, o escopo `managed` e `validate --strict`. |
| Skills (191-249) | Não existe divisão "standard/extension". `version` não é campo (vai em `metadata.version`). Limite de 1.536 caracteres, não 1.024. `user-invocable`. Faltam substituições (`${CLAUDE_SKILL_DIR}`, `$nome`), o bloco ```` ```! ````, compactação e recarga ao vivo. |
| Hooks (258-407) | 33 eventos, não 17. Hooks de todas as origens rodam, sem escada de prioridade. `tool_response`, não `tool_result`. Faltam `defer` e o tipo `mcp_tool`. `additionalContext` fica dentro de `hookSpecificOutput`. PreCompact pode bloquear. Timeout padrão do HTTP é 600 s. `$CLAUDE_SESSION_ID` não está na lista de env. Regras de matcher (exato vs regex). |
| Subagents (456-544) | Faltam `fable` e `auto`, além de `effort`, `color`, `omitClaudeMd`. Explore usa o modelo principal. Precedência: managed > `--agents` > projeto > usuário > plugin. Aninhamento até 3 níveis. Background por padrão. Edição recarrega sem reiniciar. Memória: 200 linhas **ou** 25 KB. |

## Decisões

Tomadas em 20/10/2026.

| # | Decisão | Escolha | Consequência |
|---|---|---|---|
| D1 | Versão em três lugares | **`plugin.json` + README.** Tirar `version` das entradas do `marketplace.json`. | Antes, conferir na doc que o `plugin.json` prevalece. Ajustar a checagem 5 do hook, a checagem 7 do `validate-plugin`, `CLAUDE.md` e `.claude/rules/roadmap-checker.md`. G9 passa a checar só o nome. |
| D2 | Política de frontmatter de skill | **Manter a lista restrita**, com a grafia `user-invocable` e a justificativa reescrita como política do repo (C3). | Sem campos novos. |
| D3 | Comentário no `_template/` | **Autorizado**: um comentário com as chaves permitidas no SKILL.md do template. | Liberação explícita para passar pelo hook `protect-template`, só para essa edição. |
| D4 | Credenciais no mcp-sql-server | **O Claude nunca vê a senha.** A skill grava `${DB_PASSWORD}` e `${DB_<ALIAS>_PASSWORD}`, e o usuário define a variável (`setx` no Windows, `export` no bash). | Escopos: `.mcp.json` do projeto (pode ir para o git) ou `--scope local`. Sai a opção project-shared com senha literal, e a skill deixa de pedir senha no chat. A doc confirma a expansão de `${VAR}` em `env`. Variável ausente gera aviso no `claude mcp list` e falha de login. |
| D5 | `wsl-health-check` | **Distribuir o script** em `scripts/health-report.sh`, chamado via `${CLAUDE_SKILL_DIR}`. | Depende de receber o `~/health-report.sh` atual e revisar a portabilidade. Os serviços críticos ficam configuráveis. |

## Impacto de versão

| Plugin | Atual | Itens | Próxima sugerida |
|---|---|---|---|
| marketplace-tools | 1.0.0 | C2, C3, C11, G1-G8, G12 | 1.1.0 |
| productivity-tools | 1.3.0 | C7-C9 e melhorias de skills | 1.3.1 (só correções) ou 1.4.0 (com melhorias) |
| mcp-sql-server | 1.2.3 | C4-C6 e melhorias | 1.3.0 (D4 muda o fluxo de setup) |
| sql-server-tools | 1.0.0 | fora do escopo (plano v1.1) | — |

Itens em `.claude/`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` (fora a tabela) e `docs/` não exigem bump.

## Ordem sugerida

1. **Guarda-corpos**, sem bump: C1, C10, G9-G11, `settings.json` e a grafia em `CLAUDE.md` e `plugin-reviewer`. São pequenos e protegem o resto.
2. **marketplace-tools 1.1.0:** C2, C3, C11 e as checagens G1-G8, G12. Depois disso o `validate-plugin` passa a pegar o que o validador oficial não pega.
3. **mcp-sql-server:** C4-C6 com o fluxo de D4. É o único item com risco de segurança.
4. **productivity-tools:** C7-C9 primeiro, depois roteamento das descrições, e por último tamanho e duplicação.
5. **Spec digest (C12)** e orientação do repo, que podem ir em paralelo com os passos 2-4.

## Fontes

- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Manage Claude's memory](https://code.claude.com/docs/en/memory)
- [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
