<!-- Resultados dos três experimentos de DEC-052, executados em 2026-11-10 por subagents Fable 5.2 (effort medium) a partir do roteiro em 2026-11-10-roadmap-pontos-abertos-fable.md (SRC-13). Consolidado pela sessão principal a partir dos relatos dos subagents; os relatos completos não foram gravados. Nada aqui altera decisions.md nem a estratégia: as emendas propostas valem só se constarem lá. -->

# Experimentos de DEC-052: resultados

Ambiente: CLI 2.1.322, Windows 11, productivity-tools 1.6.0 instalado. Os três subagents conferiram por SHA-256 que `~/.claude/settings.json` não mudou; o de versão conferiu também `installed_plugins.json` e `known_marketplaces.json`. Nenhum push, nenhuma tag no repositório, nenhum plugin instalado no ambiente real.

## 1. Versão menor substitui a instalada? (Ponto 3, DEC-036, E17)

**Resultado: variante de A.** A versão desce e o ref troca sem remover a loja, mas a receita do roteiro está incompleta.

Observado, em configuração isolada (`CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`):

- `claude plugin update productivity-tools@claude-play` devolveu `updated from 1.6.0 to 1.5.0` e, na volta, `updated from 1.5.0 to 1.6.0`. Com versão igual: `is already at the latest version (1.6.0)`.
- Editar `ref` em `extraKnownMarketplaces.claude-play.source` e rodar `marketplace update` não basta. A loja fica escondida (`Marketplace claude-play is added but ignored. Its source doesn't match its extraKnownMarketplaces entry`), e os dois updates falham com "not found".
- `marketplace add <fonte>#<tag>` sem editar as configurações é recusado (`its source doesn't match its extraKnownMarketplaces entry`).
- Com as configurações já editadas, `marketplace add <fonte>#<tag>` reclona no ref, o plugin continua instalado e os updates passam.
- Na volta, a pasta órfã da 1.6.0 foi reaproveitada e o `.orphaned_at` dela removido; a 1.5.0 recebeu `.orphaned_at`.

Receita que funcionou:

1. Acrescentar `"ref": "<tag>"` em `extraKnownMarketplaces.claude-play.source`.
2. `claude plugin marketplace add <fonte>#<tag>`
3. `claude plugin marketplace update claude-play`
4. `claude plugin update productivity-tools@claude-play`

A volta é simétrica: tirar o `ref` e repetir o `add` sem `#<tag>`.

Limites:

- A fonte foi um clone bare local, alcançado por uma URL https fictícia reescrita pelo git (`GIT_CONFIG_*` com `insteadOf`), porque o `marketplace add` não aceita `file://` nem repositório bare. Tipo de fonte testado: `git` com `url`. A loja real é `github` com `repo`; que a lógica seja a mesma é inferência.
- A tag descartável não foi enviada ao GitHub (push é do dono, DEC-007).
- Não foi testado como uma sessão aberta reage no intervalo em que a loja fica escondida, nem se o início de uma sessão interativa reconcilia a declaração sozinho.

## 2. O release preserva um plano com defeito plantado? (Ponto 2, DEC-033, E1)

**Resultado: A, com n=1.** O segundo `plan-only E1` reusou o plano semeado sem reescrever, revisou de novo, e o revisor pegou o defeito.

Observado:

- Defeito plantado: `reviewTier: sonnet` trocado por `opus` na Tarefa 1 (função pura, raio de impacto 0), em commit que altera só o plano. O código (`planGaps`) não cobre esse defeito.
- Segunda execução: `plan.reused = true`, `spec.reused = true`; blob anotado, blob devolvido pelo agente de plano e `measuredPlanBlob` de `plan-review1` iguais (`b2cb9429…`).
- Rótulos: `discovery preflight setup spec spec-review1 plan plan-review1 plan-fix1 plan-review2 status-plan report`.
- `plan-review1` devolveu um achado `important` nomeando o `reviewTier` e o commit semeado. `plan-fix1` reverteu; o blob voltou ao da primeira execução. `plan-review2` sem achados.
- `plan-review1` também devolveu `clean: false`, com causa não investigada. Por isso não se pode afirmar que o achado do revisor, sozinho, disparou o conserto.
- `mine-resume.mjs` mostra o blob de `plan-review1` vazio: o `resultPreview` é truncado quando há achados. O valor veio do `journal.jsonl` do workflow. A checagem de validade de E1 deve ler esse arquivo.

Lançamento sem interface, a partir da pasta do sandbox:

```
claude -p "/productivity-tools:roadmap-release plan-only E1" --output-format json --model sonnet --permission-mode bypassPermissions --max-budget-usd 5
```

- O `-p` espera o workflow terminar; o custo devolvido inclui os agentes do workflow.
- Em `plan-only` não houve parada do preflight; as regras ausentes só são relatadas ao final.
- Custo e tempo: US$ 1,85 em 209 s (plano novo) e US$ 1,53 em 175 s (plano semeado). Total US$ 3,39.

O que n=1 não prova: a taxa de reescrita (resultado C não fica descartado), outros tipos de defeito, vários defeitos no mesmo plano, a taxa de detecção do revisor, e o lançamento em outro modo de permissão ou em modo normal.

## 3. Consentimento do workflow no modo padrão (Ponto 1, DEC-035, DEC-049, E14)

**Resultado: C descartado; D e E confirmados em `claude -p`; A depende só de o dono ver o diálogo.** Rodado só em `claude -p --permission-mode default`, com o plugin de sonda `wfprobe2` carregado por `--plugin-dir`.

| Lançamento | Resultado |
|---|---|
| Pelo nome, sem regra | Negado (`Review dynamic workflow before running`); sugestão registrada pelo hook: regra `Workflow(wfprobe:probe-run)`, `allow`, destino `localSettings` |
| Pelo nome, `--allowedTools "Workflow(wfprobe:probe-run)"` | Lança |
| Pelo nome, regra em `.claude/settings.local.json` | Lança |
| Pela skill com `allowed-tools: Workflow(wfprobe:probe-run)` | Lança, sem regra de configuração |
| Por caminho, sem regra | Erro `scriptPath must be a script path this tool returned, or a file you can already read…`, antes de qualquer pedido de permissão |
| Por caminho, `--allowedTools "Workflow"` | Mesmo erro |
| Por caminho, `--allowedTools "Workflow"` e `--add-dir <plugin>` | Lança |
| Por caminho, só `--add-dir <plugin>` | Negado, sem sugestão de "não perguntar de novo" |

Para o lançador em lote (DEC-043):

- Basta `--allowedTools "Workflow(<plugin>:<meta.name>)"`; não precisa de `--add-dir`.
- O `-p` espera o workflow e o resultado vem no JSON final.
- Sem regra o `-p` sai com código 0 e `is_error: false`; a negação fica em `permission_denials`, que o lançador precisa checar.

Limites:

- O diálogo, a opção "Yes, and don't ask again" e a gravação do arquivo pelo clique não foram vistos. Passos que sobram para o dono, com `claude --plugin-dir <wfprobe2> --permission-mode default` em pasta nova com `git init`: (1) `/wfprobe:launch name`, escolher a opção, conferir `.claude/settings.local.json`; (2) sessão nova, mesmo comando, sem diálogo esperado; (3) `/wfprobe:launch path`, erro esperado; (4) em outra pasta, `/wfprobe:launch-granted`, observar se há diálogo.
- Plugin carregado no lugar, não do cache: se a pasta do cache conta como legível no lançamento por caminho continua em aberto.
- As mensagens literais são as citadas pelo modelo da sessão no resultado, não conferidas nas transcrições.
- Custo: cerca de US$ 1,19 em 10 execuções.

## Emendas que os resultados pedem (propostas, não aplicadas)

- **DEC-036:** acrescentar que fixar a loja numa tag é alívio individual, com a receita de quatro passos acima no lugar da do roteiro; tirar de "Revisitar quando" a cláusula da sonda de versão. Fecha a questão em aberto de E17 e confirma DEC-056 com a receita corrigida.
- **DEC-033:** acrescentar a regra de validade (plano reusado e blob igual ao semeado, lido do `journal.jsonl`). Fecha a questão em aberto de E1, com a ressalva de n=1 e a taxa de inválidas registrada em `measurements.md`.
- **DEC-035 e DEC-049:** nome `<plugin>:<meta.name>` e regra `Workflow(<plugin>:<nome>)` confirmados em `-p`; a concessão por `allowed-tools` funciona em `-p`. A confirmação no modo interativo e a exceção no `CLAUDE.md` continuam pendentes.
- **E25 / E18:** risco novo do resultado D (caminho recusado no modo padrão).
- **E1 (DEC-043):** o lançador passa a regra por `--allowedTools` e checa `permission_denials`.

## 4. Consentimento sem o dono na tela (complemento de 3)

Executado em 2026-11-10 por dois subagents sonnet, sempre em `--permission-mode default`, com o plugin de sonda carregado por `--plugin-dir`. As emendas que este resultado pede foram aplicadas ao roadmap no mesmo dia, com a decisão do dono de que a concessão por `allowed-tools` entra (DEC-049).

**Rota A, pseudo-terminal (sessão interativa de verdade).** Driver em Node com `@lydell/node-pty` e `@xterm/headless`, que lê a tela renderizada e envia teclas.

| Passo | Tela | Resultado |
|---|---|---|
| 1. `/wfprobe:launch name`, pasta nova | Diálogo `Run a dynamic workflow?` com as opções `1. Yes, run it`, `2. Yes, and don't ask again for wfprobe:probe-run in <pasta>`, `3. View raw script`, `4. No` | Escolhida a 2; o workflow rodou; a CLI gravou `.claude/settings.local.json` com `Workflow(wfprobe:probe-run)` em `permissions.allow` |
| 2. Sessão nova, mesma pasta, `name` | Sem diálogo | Lançou direto |
| 3. Mesma sessão, `path` | Sem diálogo | Erro `scriptPath must be a script path this tool returned, or a file you can already read…`; o hook não registrou a chamada |
| 4. Pasta nova, `/wfprobe:launch-granted` | Sem diálogo | Lançou direto, sem regra de configuração |

**Rota B, protocolo de controle.** `claude -p --input-format stream-json --output-format stream-json --verbose --permission-prompt-tool stdio` (opção fora do `--help`). O pedido chega como `control_request` `can_use_tool` com a mesma sugestão que o hook registra; devolvê-la em `updatedPermissions` fez a CLI gravar o mesmo arquivo, e a sessão seguinte lançou sem pedido. Sem a opção, o pedido é negado sem chegar ao host. Com `allowed-tools`, nenhum `control_request` chegou.

Enquadramento na tabela de decisão do roteiro: resultado **A** (diálogo, opção e persistência entre sessões vistos), **D** (caminho recusado, não perguntado, também no modo interativo) e **E** (a concessão por `allowed-tools` dispensa o diálogo).

Limites:

- Plugin carregado do caminho local, não do cache.
- As sessões herdaram um marcador de sessão filha (`Transcript saving is off`); não se sabe se influi.
- No passo 3 o modelo montou o caminho do script por conta própria; nas duas rotas o erro foi o mesmo.
- Efeito colateral: durante os testes o arquivo de configurações do usuário ganhou a chave `skipWorkflowUsageWarning: true`. A hora coincide com uma sonda da rota A que abriu o diálogo sem escolher e com sessões da rota B; a causa não foi isolada. Nenhuma regra de permissão foi gravada nele. A chave foi removida a pedido do dono, e o arquivo voltou ao hash registrado antes dos testes, o que mostra que ela era a única diferença.
- Custo: cerca de US$ 0,62 na rota B; a rota A não devolve custo (estimado abaixo de US$ 3).
