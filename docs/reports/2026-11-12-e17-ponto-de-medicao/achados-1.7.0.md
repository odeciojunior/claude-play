# E17: achados da medição do 1.7.0

Data: 2026-11-12. Versão medida: `productivity-tools` 1.7.0, commit `M` = `e38cb355de668a334193bd46d783d6f0e6313d5f`, instalada do cache numa `CLAUDE_CONFIG_DIR` descartável, modo `bypassPermissions` (DEC-280). Referência: linha de base de E15 (`docs/reports/2026-11-11-e15-linha-de-base/baseline.json`). Resultado do comparador em `comparacao.md`; `checkpoint.mjs` saiu 1. Os bloqueios foram tratados por decisão delegada do dono (Fable): a deriva do superpowers foi aceita e o haiku +5 de `parada-retomada` foi liberado (emenda a DEC-448), sem novas execuções pagas.

## 1. Deriva do superpowers (7.0.0 para 7.0.2)

A pasta de configuração descartável atualizou sozinha `superpowers@claude-plugins-official` de 7.0.0 (`bb92a77741419a4ab5f06e711a283343f1ada0c3`) para 7.0.2 (`22f0b463e7a5e579904dd6211a520321035526f7`) às 19:18 UTC, entre dois lotes (atualização automática da loja oficial; o `playwright` também mudou às 21:13 UTC).

| Superpowers | Lotes |
|---|---|
| 7.0.0 | plan-only, planner, tracker, coordinator, completo, plano-semeado-A, plano-semeado-B, codigo-semeado-A (dois lotes) |
| 7.0.2 | codigo-semeado-B (quatro lotes), parada-retomada (lote refeito) |

Skills do superpowers chamadas nos lotes afetados (contagem de chamadas `Skill` nas transcrições):

- `codigo-semeado-B`: nenhuma, nas 8 tentativas.
- `parada-retomada`: `brainstorming` 1 vez por tentativa e `writing-plans` 0 a 2 vezes. Entre 7.0.0 e 7.0.2, `brainstorming` mudou (`SKILL.md` e `scripts/start-server.sh`) e `writing-plans` é idêntica. Para comparação, `completo` (em 7.0.0) chamou `brainstorming` 1 vez e `writing-plans` 1 a 2 vezes por tentativa.

Consequência: `baseline.mjs` saiu 1 ("superpowers diverges between variants"), com os arquivos gravados. `medicao-1.7.0.json` é essa saída, sem edição. Decisão do dono: aceitar a deriva.

## 2. Haiku a mais em parada-retomada

`parada-retomada` foi de 9 para 14 chamadas haiku (mediana), acima do limite de +3 de DEC-448; liberado pelo dono. A atribuição por papel (mediana das tentativas, 1.7.0; E15 não guardou papéis) mostra que a diferença está em papéis de registro que a retomada repete por ser feita em duas sessões, não nos papéis de revisão:

| Papel | parada-retomada | completo |
|---|---|---|
| status-record | 4 | 2 |
| setup | 2 | 1 |
| progress | 2 | 1 |
| merge | 2 | 2 |
| docs | 1 a 2 | 2 |
| guards | 1 | 1 |
| final-review | 1 | 1 |
| implementer | 0 a 1 | 0 a 2 |

## 3. Falso alarme no estágio de docs (DEC-444)

Numa tentativa de `parada-retomada` com merge feito (lote descartado, tentativa 3), o estágio de docs falhou após 2 rodadas com "reread status --json is missing or has no panel" e a execução terminou `needs-operator`, embora o merge, as portas e o painel estivessem certos. Não bloqueia (DEC-444); fica como correção para o workflow.

## 4. A CLI não aceita SHA como ref da loja

Na CLI 2.1.322, `claude plugin marketplace add "<caminho>#<sha>"` falha ("Path does not exist") e uma URL git com SHA falha ("Remote branch <sha> not found"), porque a CLI clona com `--branch`. Usada a alternativa do roteiro: tag local leve `e17-medicao` em `M`, criada só num clone bare servido por HTTP em `127.0.0.1` (somente leitura), nunca enviada; a loja ficou `http://127.0.0.1:47117/claude-play.git#e17-medicao`. Uma loja por pasta local também foi tentada e descartada: o plugin carregava da pasta, não do cache. Resultado conferido: versão 1.7.0, `gitCommitSha` = `M`, conteúdo do cache igual à árvore de `M`.

## 5. Lote de parada-retomada descartado (DEC-442)

No primeiro lote, a sessão de retomada de 2 das 3 tentativas parou no preflight: a primeira sessão tinha registrado decisões de E5 de alcance contrato (DEC-008) e o release, ao retomar, pediu ratificação antes de lançar agentes. O arnês contava essas tentativas como válidas e o painel ficava `executing`. O lote (US$ 6,97) foi movido para `_descartado-retomada-preflight` e refeito com o arnês corrigido (ratificação das decisões de contrato de E5 entre as sessões, sem chamada de modelo; nova razão inválida `retomada-sem-agentes`). No lote refeito: 3/3 válidas, painel `on-branch` nas três, ratificadas `DEC-008`, `DEC-003` e `DEC-008`.

## 6. Plugins: configuração descartável e configuração real

- Iguais: superpowers, feature-dev, claude-md-management, learning-output-style, playwright, mcp-sql-server 1.3.0, sql-server-tools 1.1.0, productivity-tools (1.7.0 medido; a real tem 1.6.0).
- Commits diferentes na mesma versão: feature-dev e claude-md-management em `e0ab6e5` (na real, `f8c5e7a` e `aa296ec`).
- Versões que mudaram durante a medição: superpowers (7.0.2, seção 1) e playwright (`23c304a`).
- Não instalados: os plugins que o `settings.json` real deixa desativados (vercel, stripe, cloudflare e outros).
- As duas entradas `enabledPlugins` da loja claude-play, perdidas ao trocar a fonte da loja, foram repostas na cópia do `settings.json`.

## 7. Outros

- Classe código: as tentativas inválidas foram todas `parou-antes-do-codigo` (A: 2 de 7; B: 3 de 8), a mesma causa de E15 (achado 8 de E15).
- coordinator: contadores piores (sonnet 2 para 3, bytes da sessão principal +278%), com a skill `plan-coordinator` igual entre `productivity-tools--v1.6.0` e `M`; liberado como variância (DEC-448).
- A ponta de `release/roadmap-skills-v2` não é `M`, mas a árvore `plugins/productivity-tools` é a mesma (`214fb3b50c164094e5eb1c6e18344d7b0bc62e3c`).
- Metas de prosa: E4 atingida (43.316 de 43.335 bytes) e E22 atingida (26.119 de 29.096).

## 8. Gasto por lote

| Lote | US$ |
|---|---|
| Roteiro B de E25 (inclui uma sessão descartada) | 0,39 |
| plan-only (5) | 6,28 |
| planner (1) | 1,02 |
| tracker (1) | 0,02 |
| coordinator (3) | 1,29 |
| completo (3) | 10,06 |
| parada-retomada, lote descartado (3) | 6,97 |
| plano-semeado-A (5) | 1,78 |
| plano-semeado-B (5) | 1,68 |
| codigo-semeado-A (7, das quais 2 inválidas, cerca de 3,45 estimados) | 22,91 |
| codigo-semeado-B (8, das quais 3 inválidas, cerca de 4,64 estimados) | 21,92 |
| parada-retomada, lote refeito (3) | 13,08 |
| **Total** | **cerca de 87,4** |

Os custos incluem a sessão principal. O das tentativas inválidas, que o arnês não mede, foi estimado das transcrições com `session-metrics.mjs`.
