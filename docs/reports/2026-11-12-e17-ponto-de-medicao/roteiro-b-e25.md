# E25: roteiro B (plugin instalado do cache)

Data: 2026-11-12. Executado pelo orquestrador por delegação do dono, na mesma `CLAUDE_CONFIG_DIR` descartável da medição de E17. Resultado: **PASS** nas duas sessões.

## Preparação

- Pasta de configuração descartável com cópia do `CLAUDE.md` e do `settings.json` reais (sem credencial); login feito pelo dono uma vez.
- Loja `claude-play` como fonte git fixada em `M` = `e38cb355de668a334193bd46d783d6f0e6313d5f`. A CLI 2.1.322 recusou a SHA como ref (`claude plugin marketplace add <caminho>#<sha>`: "Path does not exist"; com URL git: "Remote branch <sha> not found", porque ela clona com `--branch`). Usada a alternativa do roteiro: tag local leve `e17-medicao` em `M`, criada só num clone bare servido em `http://127.0.0.1` (somente leitura), nunca enviada.
- Uma loja por pasta local foi tentada antes e descartada: o plugin carregava da pasta (no lugar), não do cache. A sessão feita assim não conta.
- `installed_plugins.json`: `productivity-tools@claude-play` versão `1.7.0`, `gitCommitSha` = `M`, `installPath` em `plugins/cache/claude-play/productivity-tools/1.7.0/` (conteúdo idêntico à árvore de `M`). Nas duas sessões o evento `init` mostra o plugin carregado desse caminho do cache.

## Sessões

Ambas em modo de permissão `default` (não bypass), `claude -p "/productivity-tools:roadmap-release dry-run" --allowedTools "Bash(git:*)" "Bash(node:*)"`, sandbox novo copiado do sandbox de E25, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`.

| Sessão | Regra `Workflow(...)` no sandbox | Lançamento de `productivity-tools:release-workflow` | Negações de Workflow | Custo (US$) |
|---|---|---|---|---|
| (a) concessão | nenhuma | "Workflow launched in background", dry-run terminou `done` | nenhuma | 0,14 |
| (b) controle | `Workflow(productivity-tools:release-workflow)` em `.claude/settings.local.json` | "Workflow launched in background", dry-run terminou `done` | nenhuma | 0,11 |

As negações registradas em `permission_denials` são só de comandos `Bash` compostos (`cd ... &&`, laço `for`) e, em (a), de `Glob`/`Read` na pasta do cache; nenhuma de `Workflow`. O modelo contornou cada uma e chegou ao lançamento.

## Gatilhos

- DEC-061 (o nome não resolve com o plugin instalado): não disparou; o comando e o workflow resolveram pelo nome a partir do cache.
- DEC-049 (a concessão não funciona com o plugin instalado do cache): não disparou; (a) lançou sem regra.
- DEC-275 (comando digitado em `claude -p` deixar de carregar a skill com `disable-model-invocation: true`): não disparou.

Observação: o `settings.json` real não foi tocado (SHA-256 igual antes e depois, ver relatório da medição).
