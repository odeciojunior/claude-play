# E45 T1: confirmação em sessão headless da cópia que o nome carrega

## Dedupe

- 2026-11-26: `confirmacao.md` não existia e o `log.md` do roadmap não tem `LOADED_BY_NAME=`; nenhuma tentativa anterior.

## Pré-condições

- `claude --help` (2.1.332) lista `--max-budget-usd <amount>`.
- `--permission-mode default` é aceito pelo CLI (alias fora da lista de escolhas; `claude --permission-mode default --version` sai 0, um valor inválido sai 1).
- `CLAUDE_CODE_OAUTH_TOKEN` não está definida: a credencial é a cópia por arquivo de `~/.claude/.credentials.json` para `c45/.credentials.json`.

## Pastas descartáveis (relativas a `os.tmpdir()`)

- c45: `claude/25a90f2008b31a17/59d82cd3-ae90-4075-9380-77dddfbc1657/scratchpad/c45`
- p45: `claude/25a90f2008b31a17/59d82cd3-ae90-4075-9380-77dddfbc1657/scratchpad/p45`

## Livro de tentativas

tentativa 1 de 2 lançada: sessão 5fbf13cf-1a53-47a6-9595-a3acca131afa

Uma tentativa bastou: conclusiva, sem segunda (o brief proíbe outra depois de uma conclusiva).

## Montagem (tentativa 1)

- Script Node no scratchpad da sessão executora, fora do repositório, com `try/finally`; `rmSync` só em `c45` e `p45`, depois de conferir que o caminho fica dentro de `os.tmpdir()` e termina em `c45` ou `p45`.
- Ambiente dos processos `claude` filhos: sem as variáveis `CLAUDE*` herdadas, com `CLAUDE_CONFIG_DIR=<scratchpad>/c45`, `DISABLE_AUTOUPDATER=1` e `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`; CLI 2.1.332.
- `claude plugin marketplace add https://github.com/odeciojunior/claude-play`: exit 0 ("Successfully added marketplace: claude-play").
- `claude plugin install productivity-tools@claude-play`: exit 0 ("Successfully installed plugin: productivity-tools@claude-play (scope: user)").
- Versão instalada: 2.6.0 (única pasta em `c45/plugins/cache/claude-play/productivity-tools/`).
- Caminhos gravados em `c45/plugins/installed_plugins.json` e `c45/plugins/known_marketplaces.json`: todos sob `c45` (nenhum fora).
- As duas cópias têm `args.config is missing or has no gates` na linha 1602, sem chamada de `agent(`, `parallel(` ou `pipeline(` fora de comentário antes dela:
  - clone: `c45/plugins/marketplaces/claude-play/plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
  - cache: `c45/plugins/cache/claude-play/productivity-tools/2.6.0/skills/roadmap-release/workflow/roadmap-release.js`
- Marcadores acrescentados como última linha: `// E45-MARCA-CLONE` no clone e `// E45-MARCA-CACHE` no cache.
- Credencial: cópia por `fs.copyFileSync` de `~/.claude/.credentials.json` para `c45/.credentials.json` (conteúdo nunca lido nem impresso). A autenticação funcionou na primeira forma: nenhuma tentativa anulada.
- sha256 de `~/.claude/settings.json` antes e depois: `7f8696eb0ff64a44c756a13debd48c42df68fb66320e7cb2c81c9f2b89db1559` (igual).
- sha256 de `~/.claude/plugins/known_marketplaces.json` antes e depois: `0b6cbbfdcdc96fd8b18cffa4b61ec00b883fe58b19a5f4a1ca0c3e3ed2dc2bb6` (igual).

## Lançamento (tentativa 1)

- Sessão `5fbf13cf-1a53-47a6-9595-a3acca131afa`, pasta de trabalho `p45`, `claude -p` com `--model sonnet --permission-mode default --max-budget-usd 1 --output-format json`, `--allowedTools "Workflow(productivity-tools:release-workflow)"` e `--disallowedTools` Bash, PowerShell, Edit, Write, Agent, Skill, WebFetch, WebSearch, NotebookEdit; tempo limite de 10 minutos.
- Saída do `claude -p`: exit 0, `subtype` `success`, `is_error` false, `num_turns` 1, `total_cost_usd` 0.078083, `permission_denials` vazio.
- Chamada no transcript: `Workflow` com `name` `productivity-tools:release-workflow` e `args` `{}`, sem `scriptPath`. Retorno da ferramenta: "Workflow launched in background", Run ID `wf_3ae6ef0a-d06`.
- Resultado literal devolvido pela sessão:

```
The workflow finished with an error, and no agents ran. I haven't retried it, as you asked. Its literal result:

{"status":"error","error":"args.config is missing or has no gates: run scripts/preflight.mjs and pass its config"}
```

- Sinal de agente do workflow: nenhum. A sessão só tem `subagents/workflows/wf_3ae6ef0a-d06/journal.jsonl` (o diário do run), sem transcript de agente; um único Run ID e um único script. O transcript tem um segundo registro `tool_use` do Workflow com `args` como texto `"{}"`, sem segundo Run ID nem segundo script: tratado como registro duplicado do mesmo lançamento.

## Leitura

- Script da sessão, a partir do `<uuid>`: `5fbf13cf-1a53-47a6-9595-a3acca131afa/workflows/scripts/release-workflow-wf_3ae6ef0a-d06.js`.
- Marcador no script: `E45-MARCA-CACHE` sim, `E45-MARCA-CLONE` não.
- Os dois marcadores continuavam nos arquivos de origem depois da sessão (clone com `E45-MARCA-CLONE`, cache com `E45-MARCA-CACHE`).
- Um só marcador no script e as duas origens intactas: tentativa conclusiva.

## Desfecho

LOADED_BY_NAME=cache

A premissa da estratégia é falsa: com a 2.6.0 instalada do git e o CLI 2.1.332, o nome `productivity-tools:release-workflow` carregou a cópia da pasta de versão do cache, não o clone do marketplace.

### Texto proposto da DEC (origem executor, alcance local; id = o próximo livre na etapa de registro, DEC-035 neste worktree)

| DEC-035 | 2026-11-26 | E45 | Confirmação headless (sessão 5fbf13cf, CLI 2.1.332, productivity-tools 2.6.0 instalada do git em CLAUDE_CONFIG_DIR descartável): o nome do Workflow carrega a cópia da pasta de versão do cache, não o clone do marketplace; o script da sessão tinha só E45-MARCA-CACHE. Alcance: local. | Premissa da estratégia (vale o clone, medida única da #7) | - | Uma versão nova do Claude Code mudar a resolução do Workflow pelo nome | executor | vigente |

### Revisão proposta da ASSUMPTION (a estratégia não é tocada por esta tarefa; DEC-029: proposta pelo roadmap-tracker, aprovada por opus e só então escrita)

- Linha nova em Premissas, no lugar da atual: `| Confirmado (DEC-035): o nome do Workflow carrega a cópia da pasta de versão do cache, não o clone do marketplace (sessão headless do E45, CLI 2.1.332, productivity-tools 2.6.0); a medida única da #7 não se repetiu | executor do E45 | Uma versão nova do Claude Code mudar a resolução do Workflow pelo nome |`
- Changelog: `- v1.3 (2026-11-26): a premissa da cópia carregada pelo nome sai como falsa pela confirmação headless do E45 (DEC-035): vale o cache, não o clone; os docs e o aviso do preflight do E45 tratam o cache como a cópia carregada. Aprovada por opus por delegação (DEC-021, DEC-029).`
- Histórico de versões: `| 1.3 | 2026-11-26 | Premissa da cópia carregada revista pelo E45 (vale o cache) |`
- Versão seguinte: v1.3 sobre a v1.2 vista neste worktree; se a estratégia já tiver passado da v1.2 no base, usar a versão seguinte à vigente.

## Limpeza

- `c45` e `p45` apagadas no `finally` do script; conferido depois: `c45Exists=false`, `p45Exists=false`.
