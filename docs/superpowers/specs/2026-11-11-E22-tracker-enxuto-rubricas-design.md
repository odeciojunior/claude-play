# E22 -- Tracker enxuto com rubricas (design)

Entregável E22 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-017, REQ-018, REQ-029, REQ-037. Depende de E3 (CLI `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`, integrada na branch de release) e das decisões de alcance contrato de E3 em que este desenho se apoia, ratificadas pelo dono em 2026-11-11 com as emendas DEC-200 a DEC-202 (e DEC-209); BLQ-3 fechado, `feat/E22` sincronizada com a release depois da ratificação (ver "Decisões de contrato de E3, ratificadas"). Prioridade Should (DEC-022), trilha de engenharia, fase roadmap-sem-llm, não crítico. Terceira fatia do corte de DEC-013: E3 carregou a CLI, E18 faz o release chamá-la, E22 faz a skill do tracker chamá-la e carregar só o que o evento pede.

## Por quê

A skill do tracker manda ler o contrato de formato inteiro (`roadmap-planner/references/formats.md`, `SKILL.md` "Read `formats.md` before the first edit of a run") e o arquivo inteiro de receitas (`references/events.md`, 20 receitas) até para acrescentar uma linha de log (SRC-02 §3). Com a CLI de E3, a maior parte das edições é um comando; o que sobra para o LLM é escolher a receita, chamar a CLI e os dois julgamentos reais do tracker: a regra de contradição (`events.md` § 1) e a conferência de critérios no fechamento (§ 19), que hoje não têm rubrica nem exemplos (REQ-018).

## Critérios de aceite (do card, literais)

1. Dados os tamanhos medidos em SRC-02 §1, quando o teste de orçamento de prosa roda, então a prosa que o tracker carrega para um evento não é maior que a meta derivada registrada na estratégia e não inclui o contrato de formato inteiro. {verify: test; evidence: node --test plugins/productivity-tools/scripts/prose-budget.test.mjs}
2. Dadas uma decisão que contraria a estratégia e outra que só a detalha, quando o tracker as classifica com a rubrica, então marca a primeira como contradição e a segunda não. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
3. Dado um spec cujos critérios enfraquecem os do card, quando o tracker confere os critérios no fechamento com a rubrica, então aponta o critério enfraquecido. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

Riscos do card, mantidos: (a) a meta de prosa ainda não existe na estratégia -> o teste usa a meta derivada declarada aqui e exige, em qualquer caso, que o contrato de formato inteiro saia da carga; (b) um evento sem comando na CLI fica sem o trecho do contrato de que precisa -> a receita desse evento aponta a seção do contrato que ele toca (`formats.md § N`), em vez de dispensar a leitura.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1 (REQ-029, REQ-017): a skill do tracker chama a CLI de E3 para todo passo que ela cobre, lê só a receita do evento e só as seções do contrato de formato que essa receita cita; a leitura integral de `formats.md` deixa de ser exigida.
- Peça 2 (REQ-018): rubrica com exemplos trabalhados para a regra de contradição e para a conferência de critérios no fechamento; a receita de decisão ganha a rejeição de uma decisão do executor já registrada (DEC-030), feita pelo comando `reject` da CLI.
- REQ-037: as duas mudanças de comportamento da skill são exercitadas por execução comportamental registrada em `docs/reports/`.
- REQ-017: a carga de prosa por evento cai abaixo da meta derivada declarada na seção "Meta derivada de prosa", conferida por `plugins/productivity-tools/scripts/prose-budget.test.mjs` (arquivo novo, do card).

Não objetivos:

- Mudar a CLI `roadmap.mjs`, o checker, o parser `plugins/productivity-tools/lib/roadmap-format.mjs` ou qualquer formato de arquivo da pasta de roadmap; `formatVersion` continua 1 e a linha 1 do checker não muda (DEC-042).
- Editar arquivos do planner (`roadmap-planner/references/formats.md`, `decompose.md`): as referências externas a `events.md § N` continuam válidas sem tocá-los (ver "Receitas"). Evita colisão com E4 e E20, que editam o planner.
- Mudar o workflow do release ou o preflight (E18, E25).
- Subir versão do plugin nesta branch (DEC-042; a publicação que levar E22 sobe `productivity-tools`).
- Registrar a meta na estratégia: é revisão proposta pelo tracker e gravada só com aprovação do dono (DEC-034, DEC-098).

Anti-objetivos (falham mesmo se o teste passar):

- Cumprir o orçamento escondendo prosa obrigatória num arquivo fora da contagem, ou cortando uma regra de que o tracker precisa (nunca commitar, nunca inventar número, estratégia só por revisão aprovada, `no questions`, palavras de status posicionais, IDs nunca reusados, 0 erros no checker).
- Uma receita que manda editar à mão o que a CLI já faz, ou que chama a CLI e ignora o código de saída.
- Rubrica sem exemplos, ou exemplos tirados de fora do formato do roadmap (devem ser linhas de `decisions.md` e critérios no formato do card).
- Registrar como aceito um critério humano (2 ou 3): o orquestrador da sessão principal produz o relatório (DEC-204); o aceite é do dono.

## Desenho

### Arquivos

Todos sob `plugins/productivity-tools/` salvo indicação.

| Arquivo | Mudança |
|---------|---------|
| `skills/roadmap-tracker/SKILL.md` | enxuto: princípios, regras 1 a 8 (curtas), localizar pasta, partida a frio por `roadmap.mjs brief`, camadas 1 e 3 por CLI, tabela evento -> receita, checker, relatório de entrega; sem passo que mande ler `formats.md` inteiro |
| `skills/roadmap-tracker/references/events.md` | vira índice + regras comuns: título, tabela `§ N` -> evento -> arquivo da receita, e o bloco "Common to every recipe" (enxugado onde a CLI já cumpre a regra) |
| `skills/roadmap-tracker/references/events/NN-<slug>.md` (20 novos) | uma receita por arquivo, numeração de `events.md` preservada (`01-decision.md` ... `20-spec-plan-started.md`); cada passo coberto pela CLI vira o comando |
| `skills/roadmap-tracker/references/rubric-contradiction.md` (novo) | rubrica e exemplos da regra de contradição |
| `skills/roadmap-tracker/references/rubric-criteria.md` (novo) | rubrica e exemplos da conferência de critérios no fechamento |
| `scripts/prose-budget.test.mjs` (novo) | arquivo de teste do card (critério 1) |
| `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` (novo, na raiz do repositório) | registro das execuções comportamentais (critérios 2 e 3, e teste do fluxo enxuto, REQ-037) |
| `docs/reports/2026-11-11-e22-rubricas/` (novo, na raiz) | entradas e saídas das execuções comportamentais (pasta de roadmap de teste, decisões, spec enfraquecido, respostas dos subagents) |

`.claude/rules/roadmap-checker.md` (linha que cita a receita de migração em `events.md`) continua correta porque `events.md` mantém o índice com § 11; não muda.

### Receitas (`events.md` como índice)

- `events.md` guarda: um parágrafo de propósito; a tabela `| § | Event | Recipe file |` com as 20 linhas na numeração atual (1 Decision ... 20 Spec, plan or execution started); e o bloco Common. Uma citação `events.md § 5` (em `formats.md`, `decompose.md`, `SKILL.md`, regras do repositório) resolve pela tabela, sem editar quem cita.
- Cada arquivo de receita começa com `# § N. <Event>` e o bloco **When**, mantém os passos e a linha `Checker:` da receita atual, e troca por comando da CLI todo passo que a CLI cobre. Mapa mínimo (comandos de E3, `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" <comando> "<pasta>"`):

| Receita | Comandos |
|---------|----------|
| § 1 Decision | `next-id DEC`; `reject` (rejeição, novo); `log`. A CLI não acrescenta linha de Origin `user` nem troca o Status de uma decisão antiga por `substituída por`: esses dois passos continuam edição pela receita, que cita `formats.md § 6` |
| § 2 Piece or step closed | `set-status --piece`, `log` |
| § 3 Integration, § 16 Release branch integrated | `verify-commit`, `integrate`, `inflight-remove`; sem git, o status integrado ou posterior é recusado e a SHA nova nas posições 1 a 5 entra com o aviso `no-git` (DEC-201), que a receita relata |
| § 4 Branch deleted | `inflight-remove`, `log` |
| § 5 Blocker opened or closed | `block-open`, `block-close` |
| § 10 Checker refresh | `refresh-checker` |
| § 15 Merge into the release branch, § 17 Acceptance pending, § 20 Started | `set-status`, `inflight-add`, `log` |
| § 18 Executor decision | `add-decision --scope` (aloca o `DEC-NNN`, Origin `executor`, status pendente, sem duplicar), `add-pending`, `ratify` (um ou mais `DEC-NNN` numa chamada, uma linha de log; DEC-200), `ratify <DEC-NNN> --amend <texto>` (emenda do dono ao ratificar: linha nova de Origin `user`, vigente, Contradicts `-` por DEC-209, sem substituir a ratificada), `reject`, `log` |
| Pruning (Common) | `prune` |
| Leitura de status, partida a frio, decisões pendentes | `status`, `brief`, `pending-decisions` |

- Receitas sem comando na CLI (§ 6 Measurement, § 7 New source, § 8 New requirement, § 9 Revision, § 11 Migration, § 12 Package published, § 13 Do not do now, § 14 plan-coordinator, § 19 criteria check) citam a seção do contrato que tocam, no formato literal `formats.md § N` (risco (b) do card).
- Código de saída da CLI em toda receita: 0 feito ou no-op; 1 recusado por regra, nada mudou -> relatar a recusa no relatório de entrega (e, sob `no questions`, como item pendente) sem editar à mão para contornar; 2 -> parar e relatar. A regra fica uma vez no SKILL.md, não em cada receita.
- `--what` (DEC-202): em `integrate`, `ratify` e `reject` substitui o texto padrão da linha de log; em `log` é o próprio texto; em `block-open` é o texto do bloqueio, que o log cita com o prefixo padrão. As receitas não chamam `log` depois de um comando que grava a própria linha (DEC-149).

### SKILL.md enxuto

- Tabela de caminhos: CLI, checker do plugin, `events.md` (índice), as duas rubricas e o contrato de formato. A linha do contrato diz que ele é lido só pela seção que a receita cita; é a única menção a `formats.md` sem `§ N` admitida em toda a carga (o teste a reconhece pelo início da linha de tabela `| Format contract`).
- Passo 1 (partida a frio): `roadmap.mjs brief`; o resto da leitura inicial vem da receita.
- Passo 2 (camada 1): `roadmap.mjs refresh-checker`; o detalhe fica em `events/10-checker-refresh.md`.
- Passo 3 (camada 3): comparar as três versões de formato; a migração fica em `events/11-migration.md`.
- Passo 4: tabela evento -> receita (uma linha por evento, arquivo da receita) e a instrução "leia `events.md` (Common) e o arquivo da receita; leia uma rubrica só quando a receita mandar".
- Passo 5: checker vendorizado, 0 erros, avisos listados (a lista de avisos fica numa linha por código, sem receita repetida).
- Consulta só de leitura: `roadmap.mjs status` mais o checker; nada é escrito.
- Relatório de entrega e red flags mantidos, curtos.
- Repetições cortadas (SRC-02 §3, 15 a 20%): a regra `no questions` fica uma vez no SKILL.md (regra 8) e uma no Common; o procedimento de revisão fica só em `events/09-revision.md`; o refresh do checker só em `events/10-checker-refresh.md`.

### Rubricas (peça 2)

`references/rubric-contradiction.md`, lida pelas receitas § 1 e § 18:

- Pergunta única: "a decisão faz a estratégia passar a dizer algo diferente do que diz?" Lista do que a estratégia afirma (peças, aceite, definição de pronto, `priority`, `phase`, `track`, `depends`, `reqs` do card; objetivo, não objetivos, tese, ordem das fases, visão geral dos entregáveis).
- Classes: `contradiz` (sobrescreve uma afirmação: célula Contradicts preenchida com a seção, por exemplo `E2 (pieces)`), `detalha` (preenche o que a estratégia deixa aberto: `-`), `diverge de DEC` (contraria uma decisão vigente: o ID na célula, § 18 passo 2), e `incerto` (pergunta uma vez recomendando a célula preenchida; sob `no questions`, escreve a seção mais próxima e um item pendente para confirmar, como hoje).
- Testes de desempate: tocar o mesmo entregável não basta; acrescentar um detalhe de implementação não citado no card é `detalha`; mudar um critério, um `depends` ou o que uma peça entrega é `contradiz`; adiar ou cortar um não objetivo também; a emenda do dono gravada ao ratificar uma decisão (`ratify --amend`) refina a decisão e leva `-` (DEC-209), salvo se mudar o que a estratégia diz.
- Exemplos trabalhados: ao menos três `contradiz` e três `detalha`, cada um como linha de `decisions.md` no formato da pasta, com a célula Contradicts esperada e uma frase de motivo. Os exemplos são inventados sobre a pasta de exemplo `skills/roadmap-tracker/scripts/fixtures/valid` (marcados como exemplos), não sobre este roadmap.

`references/rubric-criteria.md`, lida pela receita § 19:

- Para cada critério do card, achar o critério correspondente do spec e classificar: `igual`, `acrescentado`, `enfraquecido`, `reinterpretado`, `ausente`.
- Sinais de `enfraquecido` (lista fechada, com exemplo cada): condição de entrada (Dado/Quando) estreitada; resultado esperado afrouxado (limite maior, "ao menos", "quando possível"); `verify` trocado por um mais fraco (`test`, `smoke` ou `integration` -> `human`; qualquer um -> `blocked` sem bloqueio no card) ou evidência sem comando que exercite o critério; caso negativo do card (recusa, não altera arquivo) removido; critério do card ausente no spec.
- Saída: um item pendente por critério não `igual`, no formato atual de § 19 ("(owner) card says <A>, spec says <B>: confirm"), com a classe; a linha de log diz o resultado ("criteria compared: none changed" continua válido). Nunca editar o card.
- Exemplos trabalhados: ao menos um par card/spec por sinal, no formato de critério do card com o tag `{verify: ...}`.

Receita de decisão (§ 1) ganha o passo "Rejeição de uma decisão do executor já registrada": quando o dono rejeita uma linha de Origin `executor` com status pendente, a decisão do dono entra por `roadmap.mjs reject <DEC-NNN> --decision <texto>` (linha nova de Origin `user`; a antiga passa a substituída por ela; o item pendente sai), e a receita § 18 aponta para ela. Uma rejeição de decisão que não é do executor ou não está pendente é recusada pela CLI (código 1) e relatada.

### Meta derivada de prosa (critério 1; DEC-034)

- Contador: bytes, com finais de linha normalizados para LF, da prosa que o tracker carrega para um evento. Carga de um evento = `SKILL.md` + `references/events.md` (índice e Common) + o arquivo da receita + toda outra referência de `references/` que a receita cite (as rubricas) + cada seção `formats.md § N` citada em qualquer um desses arquivos (a seção é o trecho do cabeçalho `## N.` até o próximo `## M.`). Variante: o evento de maior carga (máximo sobre as 20 receitas).
- Linha de base (SRC-02 §1, tokens 4.815 + 10.215 + 7.930): os três arquivos lidos por evento hoje, no commit `bf9d948`, em LF: `SKILL.md` 19.078 + `events.md` 40.529 + `formats.md` 31.267 = **90.874 bytes LF** (no checkout CRLF, 19.258 e 40.861 para os dois primeiros, conferidos com SRC-02 x4). Os dois arquivos do tracker estão idênticos em HEAD; `formats.md` cresceu depois (34.550 bytes LF na release sincronizada, com E4), o que só aumenta o que sai da carga: a meta continua derivada da linha de base.
- O que a mudança remove por construção: `formats.md` inteiro (31.267) e as 19 receitas que não são do evento. Em `events.md`, o cabeçalho, o sumário e o Common somam 5.862 bytes e as 20 receitas 34.667; a maior é § 1 Decision, com 4.156. Removido: 31.267 + (34.667 − 4.156) = 61.778. **Meta derivada: 90.874 − 61.778 = 29.096 bytes LF** (−68%), igual à carga de hoje sem o contrato e sem as receitas alheias. O que entra de novo (índice, rubricas, seções citadas de `formats.md`) é pago pelos cortes no SKILL.md (passos 2, 3 e 5 viram comando ou apontam para a receita, repetições cortadas).
- O teste `scripts/prose-budget.test.mjs` confere, lendo os arquivos do disco (nada de manifesto copiado à mão):
  (a) a tabela de `events.md` lista exatamente os arquivos de `references/events/`, cada um uma vez, e todos existem;
  (b) para cada evento, a carga calculada acima é ≤ 29.096; a mensagem de falha mostra a carga por arquivo;
  (c) em todo arquivo de qualquer carga, cada menção a `formats.md` vem seguida de `§ <n>` válido, exceto a linha de tabela do SKILL.md que começa com `| Format contract`; e nenhuma carga reúne todas as seções numeradas de `formats.md` (o contrato inteiro nunca entra);
  (d) todo arquivo de `references/` (recursivo) está em alguma carga, para que um arquivo novo não escape da contagem;
  (e) SKILL.md não manda ler `events.md` ou `formats.md` inteiros (sem a frase "Read `formats.md` before").
  A linha de base e a meta ficam como constantes no teste com a citação desta seção.
- A estratégia ainda não tem a tabela de metas derivadas (entra por revisão depois de E15, DEC-098); o valor declarado aqui é o que o tracker propõe registrar. Se a revisão registrar outro valor, a constante do teste muda para ele. No molde de DEC-203 (a emenda do dono para E4), 29.096 é previsão provisória usada como constante do teste; o critério 1, que fala da meta "registrada na estratégia", só conta como atendido por inteiro depois desse registro; até lá o teste exige, além da constante, que o contrato de formato inteiro saia da carga (risco do card).

### Execuções comportamentais (critérios 2 e 3; REQ-037; regra de SRC-03)

Por DEC-204, o plano marca as execuções comportamentais como tarefa do orquestrador da sessão principal, não do executor do workflow do release (que não tem ferramenta de subagent): o orquestrador despacha os subagents no tier do plano, repassa a saída literal e escreve o relatório. A tarefa roda no worktree do entregável `D:/projects/claude-play-wt/E22`, na `feat/E22`, antes do merge, sem efeito externo. Entradas e saídas em `docs/reports/2026-11-11-e22-rubricas/`; o relatório `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` é escrito pelo orquestrador (subagents não gravam arquivos com nome de relatório).

1. Pasta de teste: cópia de `skills/roadmap-tracker/scripts/fixtures/valid` em `docs/reports/2026-11-11-e22-rubricas/pasta/` (marcada como fixture sintética no README do diretório).
2. Critério 2: um subagent segue o SKILL.md enxuto literalmente com o evento "decisão" duas vezes, sob `no questions`: decisão A que contraria a estratégia da pasta (muda o `depends` ou uma peça de um card) e decisão B que só a detalha (escolha de nome ou biblioteca que o card deixa aberta). Esperado: A com Contradicts preenchida citando a seção, B com `-`. A saída (linhas gravadas em `decisions.md`, carga lida, ambiguidades encontradas) vai para o diretório.
3. Critério 3: um card da pasta e um spec sintético em `docs/reports/2026-11-11-e22-rubricas/spec-enfraquecido.md` com um critério enfraquecido (por exemplo `verify: test` trocado por `human`, ou o caso negativo removido) e os demais iguais. O subagent roda o evento "último pedaço fechado" (§ 19). Esperado: um item pendente que aponta o critério enfraquecido e nenhum para os iguais.
4. Teste do fluxo enxuto (REQ-037): o mesmo subagent, ou outro, roda em sequência na pasta de teste os eventos § 20 (spec escrito), § 5 (abrir e fechar bloqueio), § 18 (decisão do executor, ratificada com emenda por `ratify --amend`) e a rejeição nova de § 1 sobre outra decisão do executor, listando cada arquivo que leu, cada comando da CLI e cada ambiguidade; depois o checker vendorizado tem de dar 0 erros.
5. Revisão adversarial só de leitura dos resultados por outro subagent; os achados entram no relatório.
6. O relatório traz, por critério: entrada, saída literal, resultado esperado, resultado obtido, e a linha "aceite: aguardando o dono" (verify: human). Nenhum aceite é registrado pelo orquestrador nem pelo executor.

### Testes (só no arquivo do card)

`scripts/prose-budget.test.mjs`: as conferências (a) a (e) da seção anterior. A suíte G1 já pega o arquivo pelo glob `plugins/**/*.test.mjs`. O teste de E4 (`skills/roadmap-planner/scripts/prose-budget.test.mjs`, outro caminho e outra carga) não muda. G5 (`lint-plugin.mjs`) cobre frontmatter e caminhos das referências novas; toda referência com mais de 100 linhas tem sumário (`.claude/rules/skills.md`).

## Fica com o construtor

- Texto exato do SKILL.md enxuto, do Common, das receitas e das rubricas, dentro das regras fixadas aqui; o idioma das skills do plugin continua inglês.
- Ordem e divisão das tarefas em até quatro arquivos cada. A separação de `events.md` em 20 arquivos pode ser feita por script determinístico, com conferência de que o texto de cada seção foi preservado antes das edições (T0), e as edições por grupos de até quatro receitas.
- Os exemplos das rubricas e as entradas sintéticas das execuções comportamentais, desde que cubram os casos listados.

## Decisões de contrato de E3, ratificadas

DEC-030 exige a ratificação das decisões de alcance contrato de E3 antes de E22 começar. O dono as ratificou em 2026-11-11 (todas vigentes em `decisions.md`), com as emendas DEC-200 (`ratify` com vários DEC e `--amend`), DEC-201 (sem git) e DEC-202 (`--what`), e DEC-209 (a linha de emenda leva Contradicts `-`); BLQ-3 foi fechado e a `feat/E22` foi sincronizada com a release antes de seguir. Nada aqui reabre essas decisões; o desenho as segue:

| DEC de E3 | Onde E22 se apoia |
|-----------|-------------------|
| DEC-136 | tabela de caminhos do SKILL.md; forma `node roadmap.mjs <comando> <pasta> [opções] [--json]` em toda receita |
| DEC-137 e DEC-200 | mapa receita -> comandos; `reject` em § 1; `ratify` com vários DEC e `ratify --amend` em § 18 |
| DEC-138, DEC-143 | regra única do código de saída no SKILL.md (1 = nada mudou, relatar; 2 = parar); checker rodado no passo final da receita, não depois de cada comando |
| DEC-139 | recusas citadas nas receitas e nos esperados da execução 4 (`not-executor`, `not-pending`, `checker-errors`, `blocker-cited` etc.) |
| DEC-145 | alocação de ID por `next-id` em § 1 e § 18 |
| DEC-146 | `set-status` em § 2, § 15, § 17 e § 20; bloqueado só por `block-open`, descartado continua edição da receita citando `formats.md § 6` |
| DEC-147 e DEC-201 | `integrate` em § 3 e § 16, com o aviso `no-git` relatado |
| DEC-148 | frase de `block-open` e recusa de `block-close` em § 5 e na execução 4 |
| DEC-149 | receitas chamam `log` só depois de comandos que não gravam a própria linha |
| DEC-150 | reexecução de receita depois de recusa ou interrupção sem conferência prévia (repetição é no-op) |
| DEC-153 e DEC-202 | frases da CLI no idioma do config; uso de `--what` nas receitas; linhas esperadas nas rubricas e execuções |

As decisões locais de E3 que E22 usa (DEC-151, DEC-152, DEC-155) seguem como estão; DEC-155 ("skill do tracker, events.md e formats.md não mudam em E3") é a fronteira que E22 agora atravessa, só no que é da skill do tracker.

## Decisões autônomas (revisáveis pelo dono)

1. `events.md` vira índice (tabela § -> arquivo) mais o Common, e as 20 receitas vão para `references/events/NN-<slug>.md` com a numeração atual; quem cita `events.md § N` (planner, regra do repositório) não muda. Alcance: contrato.
2. Carga contada de um evento: SKILL.md + `events.md` + receita + referências citadas pela receita + seções `formats.md § N` citadas, em bytes LF; variante: o evento de maior carga. Alcance: contrato.
3. Linha de base 90.874 bytes LF (SKILL 19.078, events 40.529, formats 31.267, commit `bf9d948` = SRC-02 §1); meta derivada 29.096 bytes LF. Alcance: contrato.
4. A meta fica como constante no teste até a estratégia registrar a tabela de metas; se a revisão registrar outro valor, a constante segue a estratégia. Alcance: local.
5. Toda menção a `formats.md` na carga exige `§ N`, salvo a linha da tabela de caminhos do SKILL.md (`| Format contract`). Alcance: local.
6. Duas rubricas em arquivos separados (`rubric-contradiction.md`, lida por § 1 e § 18; `rubric-criteria.md`, lida por § 19), para que cada evento carregue só a sua. Alcance: local.
7. Classes da rubrica de contradição: `contradiz`, `detalha`, `diverge de DEC`, `incerto`, com o padrão de `no questions` atual. Alcance: local.
8. Classes da conferência de critérios: `igual`, `acrescentado`, `enfraquecido`, `reinterpretado`, `ausente`, com lista fechada de sinais de enfraquecimento; saída no formato atual de § 19. Alcance: local.
9. A rejeição entra em § 1 pelo comando `reject` da CLI; a ratificação continua em § 18 pelo comando `ratify`. Alcance: local.
10. Código de saída da CLI tratado uma vez no SKILL.md: 1 recusa relatada sem edição manual de contorno, 2 para. Alcance: local.
11. Nenhum arquivo do planner, da CLI, do checker ou do release muda; nenhuma versão sobe na branch (DEC-042). Alcance: local.
12. As execuções comportamentais usam uma cópia de `fixtures/valid` e entradas sintéticas marcadas em `docs/reports/2026-11-11-e22-rubricas/`; relatório escrito pelo orquestrador. Alcance: local.
13. Emenda do dono ao ratificar entra pela receita § 18 com `ratify <DEC-NNN> --amend <texto>` (DEC-200), e a rubrica de contradição classifica essa linha como `detalha` (`-`, DEC-209) salvo se ela mudar o que a estratégia diz; a execução 4 exercita o caminho. Alcance: local.
14. No molde de DEC-203, 29.096 bytes LF é previsão provisória usada como constante do teste, e o critério 1 só conta como atendido por inteiro depois que a tabela de metas for registrada na estratégia (após E15); até lá o teste exige ao menos que o contrato inteiro saia da carga. Alcance: local.
15. As execuções comportamentais são tarefa do orquestrador da sessão principal (DEC-204), rodada no worktree de E22 antes do merge; o executor do workflow não as roda. Alcance: local.

## Depende de entrada humana

- Ratificação das decisões de contrato de E3 (DEC-136 a DEC-153 em parte; DEC-030): **respondida** pelo dono em 2026-11-11 (emendas DEC-200 a DEC-202, DEC-209; BLQ-3 fechado). Deixa de bloquear; plano e execução podem começar.
- Aceite dos critérios 2 e 3 (verify: human): o dono confere o relatório `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md`. O orquestrador da sessão principal entrega o relatório (DEC-204) com "aceite: aguardando o dono"; não bloqueia o código.
- Registro da meta derivada de prosa na estratégia (revisão proposta pelo tracker depois de E15, gravada só com aprovação do dono, DEC-034, DEC-098). Até lá, o teste usa a constante declarada aqui e o critério 1 fica parcialmente atendido (decisão 14). Não bloqueia.
- Ratificação pelo dono das decisões autônomas acima (DEC-030): as de alcance contrato (1, 2 e 3) seguram o início de E7 e E20, que editam a skill do tracker depois, sem impedir a entrega de E22; as locais, em lote no ponto de medição.
