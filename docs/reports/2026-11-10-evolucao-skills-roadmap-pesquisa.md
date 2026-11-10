# Evolução das skills de roadmap: pesquisa consolidada

Data: 2026-11-10. Plugin `productivity-tools` 1.6.0. Consolidação de cinco subagents de pesquisa (quatro sonnet/medium, um haiku/low) feita pela sessão principal; a seção 9A veio de mais dois (um haiku/low, um sonnet/medium). A proposta de desenho nativo (`2026-11-10-skills-nativas-spec-plano-proposta.md`, seção 0) corrige três leituras da seção 6 deste relatório; onde divergem, vale a proposta, que cita a linha da fonte. Insumo do roadmap em `docs/plans/roadmap-evolucao-skills/`.

Convenções: **[lido]** = verificado em arquivo ou página; **[inferido]** = leitura do subagent ou minha, não medida. Tokens estimados como bytes/4. Caminhos relativos a `plugins/productivity-tools/skills/`.

## Sumário

1. Medidas
2. roadmap-planner
3. roadmap-tracker
4. roadmap-release
5. plan-coordinator
6. superpowers: spec e plano
7. Documentação oficial e engenharia da Anthropic
8. Conflitos entre fontes
9. Oportunidades consolidadas
10. Lacunas de verificação

## 1. Medidas [lido, por comando]

| Skill | Arquivos | Bytes | ~Tokens | Prosa carregável (SKILL + references) | Código |
|---|---|---|---|---|---|
| roadmap-planner | 4 | 75.531 | 18.883 | 18.883 | 0 |
| roadmap-tracker | 13 | 178.264 | 44.499 | SKILL 4.815 + events 10.215 (+ formats 7.930 do planner) | checker 971 linhas, testes 1.331 |
| roadmap-release | 17 | 553.095 (corrigido na revisão; a soma original dava 518.885) | 138.274 | SKILL 3.474 + operator 3.992 + config 2.123 | workflow 2.092 linhas, preflight 392, make-sandbox 424, testes ~4.300 |
| plan-coordinator | 4 | 57.397 | 14.350 | 14.350 | 0 |

- Suíte: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` → 717 testes, 717 passam, `duration_ms 58703`.
- Menções a `superpowers`: planner 10, tracker 1, release 24 (22 no workflow), coordinator 5.
- Histórico: os últimos ~40 commits nessas skills são `fix(...)` de rodadas de revisão, em 2026-11-09 e 2026-11-10, quase todos sobre semântica de autorização, efeito externo e retomada.
- Linha 1 do checker diz 1.5.0 com o plugin em 1.6.0: correto pela regra de `.claude/rules/roadmap-checker.md`.

## 2. roadmap-planner

Fluxo [lido]: passos 0 a 8 na sessão principal. Só duas delegações: leitura de fontes (sonnet/medium, `SKILL.md:91`) e um revisor de contexto novo no modo completo (opus/medium, `SKILL.md:146`). Único script: o checker no passo 7. O modelo escreve à mão cerca de 9 arquivos a partir de ~250 linhas de templates em `formats.md`.

Custos e atritos:

- `formats.md` (≈7,9K tokens) é necessário inteiro no passo 6; leitura completa do planner ≈19K tokens.
- Repetição [lido]: defaults de card do modo leve em 3 lugares (`SKILL.md:63`, `:116`, `decompose.md`); orçamento de perguntas em 5 lugares; passo de cobertura em 2.
- Lacuna de retomada [inferido]: `planning-draft.md` é gravado após os passos 1 e 2 e após cada rodada, não após os passos 3 a 5. A regra "terminar o passo 6 a partir do rascunho" (`SKILL.md:73`) não tem os cards para isso.
- Até 8 ou mais idas e voltas com a pessoa antes de escrever (modo, idioma, branches fora do orçamento de 5).
- Brief do revisor é uma frase, sem rubrica, sem esquema de saída, sem nova rodada após as correções, sem teto de iterações.
- Faltam exemplos trabalhados em `decompose.md` (card completo, REQ composto dividido, critério bom e ruim).

Mecânico hoje feito pelo LLM (candidato a script): scaffold da pasta a partir de um modelo JSON; DAG Mermaid, flags `critical`, tabela de visão geral e resumo de cobertura derivados dos cards; simetria REQ↔card; roteamento do estado da pasta (5 casos); `integrationBranch`.

## 3. roadmap-tracker

Fluxo [lido]: passos 0 a 7 na sessão principal; scripts só o checker (passos 2 e 5); todo o resto é edição manual de markdown.

- Custo por evento: SKILL ≈4,8K + `formats.md` obrigatório ≈7,9K (`SKILL.md:23`, mesmo para acrescentar uma linha no log) + bloco comum e receita de `events.md` (≈10K no total).
- Chamador de alto volume: `roadmap-release.js:1176-1179` e `:1347-1351` abrem um subagent sonnet/medium com a skill do tracker a cada registro de status e a cada etapa de docs (≥2 por entregável). Só a etapa de docs é conferida de forma independente (`roadmap-release.js:1341`, `:1352`); o registro de status (`:1172-1182`) confia no `checkerErrors` que o próprio agente devolve, isto é, hoje não é verificado por ninguém.
- Repetição [inferido]: 15 a 20% da prosa (regra `no questions` em 6 lugares; procedimento de revisão duas vezes em `events.md:170-201`; refresh do checker em `SKILL.md:83-99` e `events.md` §10).
- Cerca de 20 passos mecânicos [lido como prosa]: digest de partida a frio, próximo ID (DEC/BLQ/REQ/SRC), inserção de linha no log em ordem, escrita de status no painel por posição do vocabulário, verificação de SHA, virada em lote de `integrated-pending`, abrir e fechar BLQ, poda, refresh do checker, consulta de status, regra de fechamento de peça de `events.md:263` (mais de 300 palavras com exceções aninhadas).
- Furo real: reutilização de `BLQ-n` fechado é invisível ao checker (o BLQ some de `state.md`; citações no log são permitidas, checker:587).
- Julgamento sem segunda opinião: regra de contradição (`events.md:57`), conferência de critérios no fechamento do entregável (§19).

Checker [lido no código]: sem `--json`, sem modo de escrita, sem diff contra HEAD. Exigido pelas skills e não verificado: ordem posicional de `deliverableStatuses` (`formats.md:64` admite; o tracker depende dela em `SKILL.md:33`), tabela Phases contra `phase` do card, ordem de fase contra `depends`, DoD citando gate, prefixo `(owner)` em pending, linha de cabeçalho de `state.md`, segmento `blocked` citando BLQ, texto "restores" no BLQ, SRC citado por REQ ou DEC, sufixo `-plan` do arquivo da estratégia.

Acoplamento: `preflight.mjs:78` duplica `scanComments` do checker; três parsers do mesmo formato (checker em JS, preflight em JS, agente de discovery por LLM). O esquema do arquivo de progresso do plan-coordinator é lido pelo tracker sem teste de contrato.

## 4. roadmap-release

Fluxo [lido]: SKILL (localizar, preflight, commit de config gerada, `Workflow`, verificação por git, relatório e uma pergunta de autorização) + script de workflow com fases discovery, seleção (código), preflight, por entregável (setup, spec, revisão do spec, plano, revisão do plano, registro, progresso, tarefas com revisão de spec e de qualidade, sync, integridade de testes, revisão final, gates, merge serializado, docs, limpeza) e relatório.

- 51 ocorrências de `agent(`: 15 haiku, 15 sonnet, 10 opus literais, 6 dinâmicas. Cerca de 22 chamadas por entregável no caminho feliz com uma tarefa, mais ~3 por tarefa extra; ~10 delas são git ou medição [inferido por contagem de estágios]. Medido depois nas sessões de sandbox: 29 a 31 agentes num entregável concluído com duas tarefas e 9 no modo plan-only, ou seja, a estimativa fica cerca de 20% abaixo. Das 51 ocorrências, 3 estão em comentários (48 chamadas, 8 com modelo dinâmico).
- Decidido por código (funções puras testadas via `load-pure.mjs`): seleção, ordem topológica, locks, julgamento de gates, fingerprint do plano, escalonamento do laço de revisão, checagem de pais do merge.
- Primitivas: `agent` com `model`/`effort`/`schema`, `phase`, `log`, `parallel` (2 usos). Não usa `pipeline`, `agentType`, `workflow()` aninhado. Semáforo e locks próprios (`makeSem`, `:868`).
- Restrição do runtime [lido em duas fontes]: o script de workflow não tem filesystem nem shell; todo comando git custa uma chamada `agent()`.
- Retomada: `runToken` na primeira chamada derruba o cache de propósito (`operator.md:77`). Cada retomada repete discovery, preflight com baseline e setup; os laços de revisão de spec e plano rodam de novo sem condição (`:1469`, `:1540`), assim como a revisão final. Maior custo evitável encontrado.
- Estado: git (marcas e commits `E<n> T<m>:`), log de revisões, painel; o estado em memória se perde numa queda.
- Plano: markdown que um agente transcreve para JSON (`:1520`) e um segundo relê para conferir (`:1546`, `evidenceRowGaps`).
- superpowers: `brainstorming` em "AUTONOMOUS MODE" por prompt (`:1455-1467`), `writing-plans` com instruções que o contrariam (`:1519`), `test-driven-development` (`:486`), `systematic-debugging` (`:1325`, `:1877`); caminhos `docs/superpowers/{specs,plans,reviews,reports}` fixos (`readPersistedLog`, `:1230`).
- Prosa: semântica de autorização repetida em `SKILL.md:13`, `:41-47` e `operator.md:38-47`.
- Julgamento: `sameFinding` compara arquivo e descrição normalizada (`:270`), então repetição reescrita escapa; revisão final com um revisor opus/high (duas lentes só em card crítico), sem verificação adversarial dos achados.
- Atrito de autonomia incidental: `missingRules` não enxerga os comandos das tags `{verify}` (`config.md:54`); `maxParallel` forçado a 1 enquanto a config é `generated: true` (`:810`).

## 5. plan-coordinator

Fluxo [lido]: Fase 1 (retomada, carregar plano, pré-requisitos, executores, pontuação em 5 dimensões, ondas, Shared Brief e cards, arquivo de progresso, autoaprovação do mapa) e Fase 2 (laço de ondas com chamadas `Agent`, portões de revisão, gate de onda, tracker, commit; conclusão com portão final opus/high).

- Nenhum script, nenhum teste, nenhum uso de Workflow. Tudo é decidido pelo LLM lendo prosa: DAG, sobreposição de escrita, bundling, ondas, aritmética de pontuação, 31 transições de estado (`delegation-protocol.md:23-55`), montagem de prompts.
- Carga do orquestrador: SKILL 4,35K + protocolo 6,5K + routing 2,3K + template 1,2K ≈ 14K tokens antes de ler o plano; o arquivo de progresso é relido a cada onda.
- Regras de passo externo espalhadas em 5 lugares; a área de estado passou por pelo menos 6 rodadas de correção recentes.
- Paradas incidentais: escolha de plano quando há vários, `Status: Completed` pergunta antes de reexecutar, Base não confiável, duas correções de mapa falhas. O prompt do executor não tem a linha "nunca pergunte à pessoa" que o release tem (`roadmap-release.js:1047`).
- Formato do plano: sem gramática fixa; o LLM é o parser. Lê `docs/superpowers/plans/*.md`, `docs/plans/<topic>/steps-*.md` e `*-plan.md`.

## 6. superpowers: spec e plano

Cópia local 7.0.0 (MIT, Jesse Vincent); upstream em 7.0.2.

- brainstorming 7.0.0 [lido]: conversa de uma pergunta por mensagem, devolução em blocos de 200 a 300 palavras, documento livre (intenção, objetivos, não objetivos, anti-objetivos, restrições, partes decididas, o que fica para o construtor), salvo em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. "Builder check": um subagent novo com prompt de 143 palavras lista só as perguntas que ainda precisaria ver respondidas; rodada única. Aprovação humana é portão rígido.
- writing-plans [lido]: plano de "decisões, não código" (nome e asserções do teste, assinatura exata, valores do spec, comando e saída esperada). Blocos `Global Constraints`, `Review Focus`, por tarefa `Files` e `Interfaces` (Consumes/Produces). Auto-revisão inline em 5 checagens, sem subagent. Títulos `### Task N:` são lidos por script (`task-brief`).
- Medidas do próprio projeto [lido nas notas de versão e no doc de custo]:
  - laço de revisão de spec ou plano por subagent "dobrou o tempo de execução (~25 min) sem melhora mensurável" (5.0.6);
  - planos enxutos: cerca de um quarto do tempo e um terço dos tokens, mesmo resultado de execução (6.4.2);
  - ambiguidade do plano é a principal causa de laços de revisão;
  - controlador sonnet deixou passar defeito plantado em 4 de 5 execuções; revisores haiku acharam 0 de 10: a mecânica barateia, o julgamento não;
  - modelo explícito em toda chamada (uma execução pôs 26 revisores no nível mais alto por herança);
  - artefatos passados como arquivo, nunca colados; pacote de revisão fora do contexto do controlador.
- SDD [lido]: ledger em arquivo, scripts `sdd-workspace`, `task-brief`, `review-package`; um revisor por tarefa com dois veredictos; laço de correção com teto e adjudicação; "rulings, not stalls" com custo se estiver errado; só quatro motivos param a execução.

Para pipeline sem pessoa [inferido]: transfere quase todo o writing-plans, o builder check, o modelo de conteúdo do spec e o formato de ruling. Substituir: perguntas e aprovação humanas por "Decisões autônomas" com custo se errado e "Depende de pessoa" com marca de bloqueio; `Review Focus` por evidência por critério de aceite do card. Dispensar: companheiro visual, dimensionamento, spikes.

Compatibilidade: manter títulos `### Task N:` e os campos de cabeçalho basta para um plano continuar legível pelas ferramentas do superpowers; seções que não são tarefa devem vir antes da primeira tarefa.

## 7. Documentação oficial e engenharia da Anthropic

Lido em 2026-11-10 (URLs no fim de cada item).

- Workflow: o script guarda laço, ramificação e resultados intermediários; o contexto do Claude recebe só a resposta final. Um plugin embarca workflows em `workflows/` (ou campo `workflows` do manifesto), executados como `/<plugin>:<meta.name>`. `schema` em `agent()` devolve JSON validado (até 5 tentativas). Sem `import()`, sem filesystem, sem shell, sem entrada da pessoa no meio: "For sign-off between stages, run each stage as its own workflow." Retomada por replay na mesma sessão: agente cujo prompt muda, e todos depois dele, reexecutam. Limites: 16 agentes simultâneos, 1.000 por execução, aviso acima de 25 agentes ou 1,5M tokens. `Workflow` e `AskUserQuestion` são removidos de todo subagent. (code.claude.com/docs/en/workflows, /sub-agents)
- Subagents: `model` por chamada só por alias; `effort` por chamada desde v2.1.292; `omitClaudeMd` desde v2.1.271; profundidade 3; 20 simultâneos; `isolation: worktree` parte do branch padrão, não do HEAD da sessão. Subagent retomado por `SendMessage` reaproveita o cache da execução original. (code.claude.com/docs/en/sub-agents)
- Hooks: `PreToolUse` casa com `Agent` e `updatedInput` substitui a entrada inteira (permite impor `model`); hooks de plugin rodam dentro de subagents; `SubagentStop` com saída 2 impede a parada; um `PreToolUse` que devolve `allow` pula o pedido de permissão, mas regras de deny e ask continuam valendo e, em modo de plano, o workflow não inicia só com a aprovação do hook; a página de workflows cita essa rota apenas para `claude -p` e o SDK. Não é a única rota: uma regra `Workflow(<nome>)` é alternativa. Hooks `prompt` e `agent` não são determinísticos. (code.claude.com/docs/en/hooks, /best-practices)
- Skills: o corpo carregado "stays in context across turns, so every line is a recurring token cost"; a compactação mantém os primeiros 5.000 tokens de cada skill. Scripts empacotados são executados, não lidos. Injeção dinâmica ``!`cmd` `` roda antes de o modelo ver a skill; comando que falha aborta a invocação. `allowed-tools` concede, não restringe. (code.claude.com/docs/en/skills, agentskills.io/specification)
- Cache: subagents, workflows e forks usam TTL de 5 minutos; trocar de modelo derruba o cache; agentes com o mesmo prefixo compartilham cache. (code.claude.com/docs/en/prompt-caching)
- Preços por MTok entrada/saída: Haiku 5.5 0,10/0,50; Sonnet 5.5 2/10; Opus 5.5 4/20; Fable 5.2 8/40. (platform.claude.com/docs/en/about-claude/pricing)
- Harness: "Workflows are systems where LLMs and tools are orchestrated through predefined code paths"; estado em JSON porque "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files"; subagent devolve resumo de 1 a 2K tokens e referências a arquivos; cada brief com objetivo, formato de saída, orientação de ferramentas e limites. (anthropic.com/engineering: building-effective-agents, effective-harnesses-for-long-running-agents, effective-context-engineering-for-ai-agents, multi-agent-research-system)
- Avaliação: `claude plugin eval` (v2.1.269 ou posterior): casos com graders `regex`, `tool_used`, `tool_order`, `llm`, `baseline`; 3 execuções por caso; `--json` com `overallScore`, `meanDelta`, `costUsd`, `durationSeconds`. A página lista só os campos que um script de gate costuma ler e diz que o documento traz mais; se há tokens por execução não ficou estabelecido. São seis tipos de grader (falta `file_exists` na lista acima). `/skill-doctor` mostra o custo de listagem. (code.claude.com/docs/en/plugin-evals)
- Agent teams: experimental, desligado por padrão, não cria participantes em `-p`, custa cerca de 7x os tokens em modo de plano, retomada com perdas; a página alerta contra edições no mesmo arquivo e contra deixar um time rodando sem supervisão por muito tempo. Mau encaixe para um pipeline determinístico sem supervisão [inferido a partir do lido]. (code.claude.com/docs/en/agent-teams, /costs)
- Autonomia: modo `dontAsk` nunca espera entrada; `auto` usa classificador; plugin não embarca `permissions.allow`; agentes de plugin ignoram `permissionMode`. (code.claude.com/docs/en/permission-modes)

## 8. Conflitos entre fontes

1. Modelo do revisor por tarefa: release usa sonnet por padrão (`reviewModelFor`, `:387`); `plan-coordinator/references/routing.md:53` fixa opus e proíbe mudar "without measured evidence"; o design do release (`docs/plans/2026-11-09-roadmap-release-design.md:92`) diz que sonnet foi medido, e a medição não está no repositório. O superpowers registra piso de nível médio para revisores e 0 de 10 com haiku.
2. Laço de revisão de spec e plano: o release roda até 3 rodadas opus em cada; o superpowers mediu que o laço dobra o tempo sem ganho e trocou por auto-revisão inline mais um builder check de rodada única.
3. API de `agent()` no script: a referência `workflow-authoring` lista `model`, `effort`, `schema`, `agentType`, `isolation`; a página pública lista `schema`, `label`, `stallMs` e diz que o modelo nomeado por estágio vale como modelo da invocação. O workflow atual usa `model` e `effort` e funciona.
4. brainstorming local 7.0.0 não tem a etapa de 2 ou 3 abordagens; o upstream 7.0.1 a reintroduziu.

## 9. Oportunidades consolidadas

| # | Oportunidade | Objetivos | Evidência |
|---|---|---|---|
| A | Linha de base medida (tokens, custo, tempo, chamadas) com `claude plugin eval` e uma execução em sandbox | todos | §7 avaliação; nenhuma medição no repositório |
| B | Biblioteca determinística do formato do roadmap (parser único, leitura e escrita) e CLI de eventos do tracker | harness, tokens, performance | §3; três parsers; ~20 passos mecânicos |
| C | Fechar lacunas do checker e saída `--json` | harness | §3 |
| D | Scaffold do planner a partir de modelo JSON; rascunho que persiste os cards | harness, tokens | §2 |
| E | Skills nativas de spec e de plano, com modo autônomo; plano com dados legíveis por máquina | spec/plano nativos, inferência, tokens | §4, §5, §6 |
| F | Release: retomada sem repetir revisões inalteradas; chamadas mecânicas agrupadas; discovery por parser; verificação pós-execução em script | performance, tokens | §4 |
| G | plan-coordinator: script de mapa e de estado; depois workflow | workflow, harness, autonomia | §5 |
| H | Política única de níveis e de revisão, decidida por medição | inferência, tokens | §8.1, §8.2 |
| I | Autonomia: briefs sem perguntas, defaults no lugar de paradas incidentais, pré-aprovação por hook | autonomia | §4, §5, §7 |
| J | Enxugar prosa duplicada; ler só o trecho do formato que o evento toca | tokens | §2 a §5 |
| K | Julgamento mais forte onde importa: rubricas, exemplos, verificação adversarial de achados bloqueantes | inferência | §2, §3, §4 |

## 9A. Dados reais das sessões (transcrições em `~/.claude/projects`)

> **Correções da revisão de 2026-11-10 (valem sobre a tabela e as leituras abaixo).** Um revisor reexecutou o script (349 execuções, igual) e apontou:
>
> 1. **Preços.** O script usou leitura de cache a 0,1x para todos os modelos (o correto é 0,05x em Opus e Sonnet 5.5 e 0,025x em Fable), escrita de cache de 1 hora a 1,25x (o correto é 2x) e Fable 5.1 ao preço do 5.2. Os dólares das skills interativas estão cerca de 30% altos. Medianas EXT corrigidas: plan-coordinator 32,6; planner 28,3; tracker 3,4; release plan-only 2,13; release completo 6,85. As proporções quase não mudam (contexto principal: 45% no coordinator, 63% no planner).
> 2. **Fatia do tracker.** O grupo "tracker/registro" de 15% soma registro de status, progresso, log de revisões e o relatório final. Só o registro de status pelo tracker é cerca de 9% no plan-only e 6% no completo (cerca de 9% contando a etapa de docs). Fica abaixo da revisão do plano (12% e 9%) e da revisão do spec (10% e 7,5%). A frase "o registro no tracker custa mais que qualquer revisão isolada" está errada.
> 3. **Plan-only.** As 21 execuções carregam seis cópias diferentes da skill (2 a 6 execuções cada), nenhuma no commit atual; uma delas abortou. Os custos são estáveis entre as cópias (2,0 a 2,8), então serve de linha de base aproximada; um antes/depois pede 3 ou mais execuções no commit de partida.
> 4. **Release completo em sandbox.** Cada linha é uma sessão, não um entregável: seis das nove têm 2 ou 3 lançamentos e duas incluem um lançamento de quatro entregáveis. As medianas 7,2 e 46 não valem como "por entregável".
> 5. **Revisores do coordinator.** Cerca de 75% em opus (291 de 386), não "quase todos"; o papel vem de uma expressão regular sobre descrições livres, então os 26% são aproximados.
> 6. **Execução real do release.** Cresceu depois da leitura: 13,7 / 0,43, 39 minutos, 49 subagents, dois lançamentos, ambos parados em `needs-operator`.
> 7. **Viés conhecido.** A janela EXT do coordinator absorve trabalho de planejamento feito depois na mesma sessão; o pico de contexto é da sessão, não o que a skill acrescentou.

Extraídos por `docs/reports/2026-11-10-session-metrics/skill-runs.mjs` (349 execuções de 7 skills; uso deduplicado por `message.id`; conferido à mão numa sessão e contra o `cost-state` do harness: 36 de 154 sessões batem exatamente, sessões interativas longas guardam 80 a 100% dos tokens faturados). Custos são estimativas pela tabela de preços de §7 com escrita de cache a 1,25x; valem como relativos, não como fatura. "EXT" = até a próxima skill, novo comando ou silêncio de 60 min; "TURN" = até o próximo prompt humano (limite inferior).

| Skill | Execuções | Custo mediano EXT / TURN (US$) | Min. ativos | Turnos do principal | Pico de contexto (k) | Subagents | Parcela do principal |
|---|---|---|---|---|---|---|---|
| roadmap-planner | 9 (5 projetos) | 38 [4–64] / 10,6 | 71 | 44 | 424 | 9 | 65% |
| roadmap-tracker | 32 (+15 aninhadas) | 5,1 [0,6–75] / 1,4 | 11 | 22 | 331 | 0 | 100% |
| plan-coordinator | 62 (8 projetos) | 46 [3–368] / 34 | 85 | 123 | 504 | 16 | 48% |
| roadmap-release, plan-only em sandbox | 21 | 2,23 [0,34–2,81] | 6 | 6 | 56 | 9 | 17% |
| roadmap-release, completo em sandbox | 9 | 7,2 [0,5–21] / 3,3 | 18 | 12 | 60 | 46 | 11% |
| roadmap-release, real | 1 (em andamento) | 4,8 / 0,4 | 15 | 21 | 72 | 7 | 20% |

Comparação: subagent-driven-development 8 execuções, 126 [24–400]; writing-plans 59, 3,7; brainstorming 115, 10 / 0,6.

Papéis no custo:

- release plan-only (21 execuções quase idênticas, mesmo E4): plano 20%, spec 17%, tracker/registro 15%, revisão do plano 12%, revisão do spec 10%, discovery + preflight + setup 9%.
- release completo em sandbox: tracker/registro/relatório 15%, plano 11%, spec 9%, revisão do plano 9%, revisão final 8%, revisão do spec 8%, revisão de spec por tarefa 6%, gates 5%, implementadores 3%.
- plan-coordinator: contexto principal 42%, revisores 26% (≈6 por execução, quase todos opus), descrições ad hoc 21%, implementadores 8%.

Leituras: no release, o trabalho de implementar é a menor fatia (em entregáveis pequenos de sandbox) e a maior é spec, plano e suas revisões (37% de uma execução completa, 59% do plan-only); no coordinator e no planner, o contexto principal em opus é a maior parcela.

Suficiência como linha de base antes/depois:

| Skill | Veredito | Motivo | Medição mínima que fecha a lacuna |
|---|---|---|---|
| roadmap-release plan-only | suficiente como aproximação | 21 execuções do mesmo entregável, em seis cópias da skill | 3 ou mais execuções no commit de partida |
| roadmap-release completo | insuficiente | versões de script diferentes, desfechos mistos (done, needs-operator, error, killed), retomadas misturadas; a única real está incompleta | um entregável fixo, 2 execuções ininterruptas por variante |
| plan-coordinator | insuficiente | 5 versões da skill, tamanho de plano sem limite (US$ 3 a 368), fim da execução ambíguo | um plano fixo, 3 execuções por variante, com marca de fim |
| roadmap-planner | insuficiente | 9 execuções, 5 projetos, 3 versões, interativo | um tema fixo, 3 execuções por variante |
| roadmap-tracker | marginal | 32 execuções, mas versões mistas e faixa de 0,3 a 39 no corte TURN | fixar versão e tipo de evento |

## 10. Lacunas de verificação

- Nenhum subagent executou uma rodada real das skills; contagens de chamadas e de tokens são estimativas.
- Não confirmado: se invocar a skill vale como consentimento para o `Workflow` no comportamento atual de permissões; se um plugin pode declarar permissões por outro meio além do hook.
- Notas de versão 7.0.1 e 7.0.2 do superpowers lidas por resumo; páginas `hooks`, `sub-agents` e `skills` lidas parcialmente.
- `make-sandbox.mjs` e os arquivos de teste do release foram apenas folheados.
