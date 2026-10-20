# Claude Code: Agents, Skills e Workflows

Oct 20, 2026 · @Odécio Machado

> Revisado em 20/10/2026 contra a documentação oficial (code.claude.com/docs e platform.claude.com/docs). Vários comportamentos dependem da versão do Claude Code; confira a sua com `claude --version`.

## Resumo

Skills mudam **como** o Claude trabalha, subagents mudam **onde** o trabalho acontece, e workflows mudam **quem** segura o plano. A documentação compara as opções por esse último critério: em skills, subagents e agent teams o Claude orquestra turno a turno; no workflow, quem orquestra é um script. Comece pela opção mais leve que resolve. Agent teams não são um degrau acima dos subagents, e sim uma alternativa para quando os workers precisam conversar entre si.

## As diferenças

|  | Skill | Subagent | Agent team | Workflow |
| --- | --- | --- | --- | --- |
| O que é | Instruções que o Claude segue | Worker que o Claude dispara | Sessões completas coordenadas por um líder | Script JavaScript que o runtime executa |
| Quem decide o próximo passo | O Claude, seguindo o prompt | O Claude, turno a turno | O líder, com uma lista de tarefas compartilhada | O script |
| Contexto | O da conversa principal | Isolado: sem o histórico do pai | Cada teammate na própria janela | Variáveis do script |
| Comunicação | — | Devolve só a mensagem final | Teammates trocam mensagens entre si | O contexto do Claude recebe só a resposta final |
| Escala | Uma tarefa por vez | Algumas delegações por turno | 3 a 5 teammates | Dezenas a centenas de agentes |
| Arquivo | `.claude/skills/<n>/SKILL.md` | `.claude/agents/<n>.md` | Ativado por variável de ambiente | `.claude/workflows/<n>.js` |

**Skills** são um `SKILL.md` com instruções seguidas dentro da conversa. Na inicialização só `name` e `description` entram no contexto; o corpo carrega quando a skill é usada e, depois disso, fica na conversa nos turnos seguintes. Podem ser de referência (convenções, guias de estilo) ou de tarefa (deploy, commit). As skills absorveram os slash commands: uma skill `deploy` cria `/deploy`, e os arquivos antigos em `.claude/commands/` continuam funcionando. Há escopo pessoal (`~/.claude/skills/`), de projeto e de plugin (`/plugin:skill`), e edições valem na mesma sessão, sem reiniciar.

**Subagents** rodam na própria janela de contexto, com system prompt, ferramentas e permissões próprios. Não veem o histórico da conversa nem os resultados de ferramentas do pai: a única coisa que passa é o prompt de delegação, e só a mensagem final volta. Começam com mais do que o prompt, porém: carregam os CLAUDE.md, um snapshot do `git status` e as skills listadas em `skills:` (Explore e Plan pulam o CLAUDE.md, assim como agentes com `omitClaudeMd: true`). Por padrão um subagent pode disparar outros, até três níveis abaixo da conversa principal.

**Agent teams** são um líder coordenando teammates, cada um uma sessão completa do Claude Code. Diferente dos subagents, os teammates compartilham uma lista de tarefas (com dependências), assumem itens dela e conversam diretamente entre si. São experimentais e ficam desligados por padrão.

**Workflows** (`/workflows`) são scripts que orquestram muitos subagents em segundo plano enquanto a sessão continua respondendo. O script guarda loops, ramificações e resultados intermediários; o contexto do Claude recebe só a resposta final.

## Quando usar cada um

- **CLAUDE.md**: regras sempre ativas, curtas (abaixo de 200 linhas). Se uma regra precisa valer toda vez, vire hook: instruções são orientação, hooks são determinísticos.
- **Skill**: quando você cola as mesmas instruções, checklist ou procedimento repetidamente, ou quando uma seção do CLAUDE.md virou procedimento.
- **Subagent**: quando a tarefa gera saída verbosa que não precisa ficar no contexto principal, exige restrições de ferramentas ou permissões, ou é autocontida e pode devolver um resumo. Ex.: rodar testes e trazer só as falhas, pesquisar módulos em paralelo, revisor somente leitura.
- **Conversa principal**: quando há muito vai-e-volta, as fases compartilham bastante contexto, a mudança é rápida e pontual ou a latência importa.
- **Agent team**: quando os workers precisam discutir entre si. Ex.: depuração com hipóteses concorrentes, revisão sob vários ângulos, mudança que cruza camadas. Evite para tarefas sequenciais, edições no mesmo arquivo ou trabalho com muitas dependências.
- **Workflow**: quando o trabalho passou de "alguns subagents" e a escala ou a repetibilidade da orquestração importam. Ex.: varredura de bugs no codebase inteiro, migração de 500 arquivos, pesquisa com checagem cruzada de fontes, plano rascunhado sob vários ângulos. Consome bem mais tokens: teste primeiro numa fatia pequena (um diretório em vez do repo).

## Melhores práticas

### Skills

- A `description` dispara a skill: escreva em terceira pessoa, dizendo o que ela faz e quando usar, com as palavras que o usuário diria. `description` + `when_to_use` são truncados em 1.536 caracteres por entrada (ajustável com `skillListingMaxDescChars`), e a listagem inteira tem um orçamento de cerca de 1% da janela de contexto.
- Seja conciso: o Claude já sabe muito, então escreva só o que ele não sabe. `SKILL.md` abaixo de 500 linhas; referência detalhada em arquivos separados, a no máximo um nível de distância do `SKILL.md`, com sumário nos arquivos acima de 100 linhas.
- Ajuste o grau de liberdade à fragilidade: orientação aberta para tarefas com várias soluções boas, script exato para operações frágeis. Para lotes arriscados, use planejar → validar → executar.
- Prefira scripts prontos a código gerado na hora, deixe claro se o Claude deve executar ("rode X") ou ler ("veja X"), e trate erros dentro do script.
- Ações com efeito colateral (deploy, commit, enviar mensagem): `disable-model-invocation: true`. Para skills que só o Claude deve usar, `user-invocable: false`. Para limitar a ativação automática a certos arquivos, `paths`.
- Use `` !`comando` `` para injetar dados reais antes do prompt chegar ao Claude (ex.: `git diff`), e `$ARGUMENTS`/`$0`/`$nome` para argumentos. `allowed-tools` pré-aprova ferramentas só no turno em que a skill foi invocada; a liberação some na sua próxima mensagem.
- Escreva instruções como regras permanentes ("rode os testes após cada edição", não "rode os testes"): o Claude não relê o arquivo nos turnos seguintes. Regra que precisa valer sempre vai para um hook.
- O mais importante no topo: na compactação, o Claude Code reanexa a invocação mais recente de cada skill guardando só os primeiros 5.000 tokens, num orçamento total de 25.000 preenchido da mais recente para a mais antiga. Skills antigas podem sair inteiras; invoque de novo para restaurar.
- Teste antes de escrever muito: crie pelo menos três cenários de avaliação, compare com o desempenho sem a skill e teste com os modelos que vão usá-la (o que basta para o Opus pode faltar para o Haiku).
- Nomes descritivos, de preferência no gerúndio (`processing-pdfs`), sem termos vagos (`helper`, `utils`); terminologia consistente; nada de informação datada. Instale skills só de fontes confiáveis.

### Subagents

- Uma descrição clara e específica para o Claude rotear certo; "use proactively" incentiva a delegação automática.
- Descrições curtas, detalhes no corpo: o corpo só carrega quando o subagent roda, e acima de 15.000 tokens somados de descrições o Claude Code avisa na inicialização.
- Menor privilégio: `tools` como allowlist (revisor sem `Edit`/`Write`), `disallowedTools` como denylist (aplicada primeiro) e `hooks:` no frontmatter para controle fino, como um `PreToolUse` que só deixa passar `SELECT` no banco. Subagents de plugin ignoram `hooks`, `mcpServers` e `permissionMode`.
- `model: haiku` (ou `sonnet`, `opus`, `inherit`) para casar custo e tarefa; `effort` para o nível de raciocínio; `skills:` para injetar convenções na inicialização (o subagent não herda as skills do pai); `memory: project` para aprendizado versionado (há também `user` e `local`); `isolation: worktree` para edições em paralelo num worktree temporário.
- Coloque no prompt de delegação tudo o que a tarefa exige: caminhos, mensagens de erro, decisões e regras críticas da conversa. O CLAUDE.md chega ao subagent, mas o que foi decidido na conversa não.
- Para revisão, use um subagent de contexto limpo como revisor adversarial e peça que aponte só falhas de correção ou requisitos não atendidos, senão ele exagera nos achados.
- Limite profundidade, concorrência e gasto quando delegar muito: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` e `CLAUDE_CODE_SUBAGENT_MODEL`. Para impedir um agente específico de delegar, tire `Agent` das ferramentas dele.
- Versione os agentes de projeto no git e valide os arquivos: YAML inválido ou `name` ausente faz o agente ser ignorado sem erro. Um diretório `agents` novo exige reiniciar a sessão.
- Subagents disparados da conversa principal rodam em segundo plano por padrão e podem ser retomados com o histórico completo (exceto Explore e Plan).

### Agent teams

- Ative com `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (no ambiente ou em `env` no `settings.json`). Exigem sessão interativa: não funcionam com `-p`.
- Antes de montar um time, confira se uma opção mais leve resolve. Comece com 3 a 5 teammates, use Sonnet para eles e encerre os ociosos.
- Teammates não herdam o histórico do líder nem as `skills` de uma definição de subagent: passe o contexto na criação.
- Modo de exibição em `teammateMode` (`in-process` por padrão; painéis divididos exigem tmux ou iTerm2 e não funcionam no Windows Terminal nem no terminal do VS Code).
- Limitações atuais: um time por sessão, sem times aninhados, líder fixo, `/resume` e `/rewind` não restauram teammates in-process e o status das tarefas pode atrasar.

### Workflows

- Peça ao Claude ("use a workflow to…" ou a palavra `ultracode`, que só vale em prompts digitados, não em `-p` nem em tarefas agendadas). Para começar sem montar nada, rode o workflow embutido `/deep-research`.
- Revise o plano antes de aprovar e leia o script ("View raw script" ou `Ctrl+G`); use "don't ask again" só em workflows salvos e confiáveis. Salve com `s` no `/workflows` para virar `/comando`: projeto em `.claude/workflows/`, pessoal em `~/.claude/workflows/`, ou distribuído num plugin. Entrada vai pelo global `args`.
- Libere antes, nas regras de permissão, as ferramentas que os agentes vão usar: workflows seguem suas regras de permissão e param no meio para pedir aprovação.
- Peça verificação adversarial dos achados e critérios de parada ("até o type check passar ou duas rodadas sem progresso"). Peça saída estruturada (`schema`) quando o resultado for processado pelo script.
- Controle custo com `workflowSizeGuideline` (`small` < 5 agentes, `medium` < 10, `large` < 50, `unrestricted`; padrão `medium`). É uma orientação para o Claude, não um teto. Peça modelos menores nas fases simples e acompanhe o gasto no `/workflows` (`p` pausa, `x` para). Acima de 25 agentes ou 1,5M tokens projetados aparece o aviso "Large workflow".
- Sem input do usuário no meio da execução: para aprovação entre etapas, um workflow por etapa. Uma execução pausada pode ser retomada na mesma sessão, reaproveitando os agentes já concluídos com entradas iguais.
- Ao editar um script salvo, rode `/workflow-authoring`, mantenha `meta` como objeto literal, passe datas por `args` (`Date.now()` e `Math.random()` lançam erro) e mantenha estável a ordem das chamadas `agent()`, senão a retomada refaz agentes. Trate resultados `null` de agentes que falharam.
- Ultracode é uma configuração do Claude Code, não um nível de effort. `/effort ultracode` liga para a sessão e faz o Claude planejar um workflow para toda tarefa substantiva, o que gasta muito mais tokens: use só em sessões pesadas e desligue com `/effort ultracode off`.
- Limites: 1.000 agentes por execução, 16 simultâneos por padrão; subagents não podem disparar workflows.

## Como eles se combinam

Skills guardam o conhecimento; subagents são executores que pré-carregam essas skills pelo campo `skills:`; o workflow é o maestro quando o trabalho passa de alguns subagents e pede verificação cruzada. Uma skill também pode rodar isolada com `context: fork` (o campo `agent:` escolhe o tipo de subagent), mas isso só faz sentido para skills com instruções explícitas de tarefa: o subagent bifurcado não vê o histórico da conversa, então um guia de referência ficaria sem contexto sobre o que aplicar. Em agent teams, a combinação com skills é mais fraca, porque teammates ignoram as `skills` das definições de subagent.

## Custo e contexto

- O contexto é a restrição central: ele enche rápido e o desempenho cai à medida que enche. Use `/context` para ver o que ocupa espaço, `/clear` entre tarefas e `/compact <instruções>` para compactar com foco.
- Subagents economizam contexto, não tokens: a saída verbosa fica na janela deles, mas as requisições contam no seu uso. Muitos subagents devolvendo resultados detalhados também enchem o contexto principal.
- Agent teams usam cerca de 7 vezes mais tokens que uma sessão comum quando os teammates rodam em plan mode.
- Uma execução de workflow pode gastar bem mais tokens que a mesma tarefa feita na conversa.

## Fontes

- [Extend Claude Code – Claude Code Docs](https://code.claude.com/docs/en/features-overview)
- [Extend Claude with skills – Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Create custom subagents – Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Orchestrate teams of Claude Code sessions – Claude Code Docs](https://code.claude.com/docs/en/agent-teams)
- [Orchestrate subagents at scale with dynamic workflows – Claude Code Docs](https://code.claude.com/docs/en/workflows)
- [Best practices for Claude Code – Claude Code Docs](https://code.claude.com/docs/en/best-practices)
- [Manage costs effectively – Claude Code Docs](https://code.claude.com/docs/en/costs)
- [Agent SDK: subagents – Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Agent Skills overview – Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Skill authoring best practices – Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Equipping agents for the real world with Agent Skills – Anthropic Engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
