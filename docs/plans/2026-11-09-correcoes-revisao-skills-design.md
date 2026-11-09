# Correções da revisão adversarial dos skills de roadmap: desenho

Branch `feat/roadmap-skills-autonomia`, a partir de `ae8cde0`. Skills em `plugins/productivity-tools/skills/`: `roadmap-release`, `plan-coordinator`, `roadmap-tracker`, `roadmap-planner`.

## 1. Intenção

Cinco revisores independentes concluíram que a branch não está pronta para merge. Os 429 testes e o lint estão verdes, mas não cobrem os defeitos. O dono escolheu a correção completa: os itens 1 a 13 e os importantes listados na seção 5, mais o teste comportamental que faltou.

O motivo de fundo: a autonomia retirou a pessoa que antes barraria certos erros. Cada aprovação retirada precisa de uma parada ou trava que a substitua.

## 2. Objetivos, não objetivos, antiobjetivos

**Objetivos**
- Cada defeito da seção 4 e 5 corrigido, com teste de regressão que falha antes da correção quando o defeito é testável por código.
- Uma regra única de autorização para efeitos externos (seção 3).
- Teste comportamental por subagente em `plan-coordinator`, `roadmap-planner` e `roadmap-tracker`, como `.claude/rules/skills.md` exige.

**Não objetivos**
- Os cerca de 25 achados menores, exceto os que caírem junto de uma correção (seção 7).
- Adotar o `roadmap-release` no `udv-center`.
- Testar em Linux ou macOS.

**Antiobjetivos**
- Executar um efeito externo sem autorização, em qualquer skill. Silêncio nunca é autorização.
- Tocar a branch de integração, fazer push, ou mesclar sobre alvo quebrado.
- Registrar ato humano como feito, ou um agente aprovar o que exige pessoa.
- `roadmap-release` perguntar à pessoa durante o run.
- Merge ou push desta branch sem o dono pedir.

## 3. Regra de autorização de efeitos externos (decisão do dono)

Quando um passo vai mexer em algo fora da branch, a autonomia para ali. Autorizado pelo operador antes do run, o passo segue sem perguntar. Sem isso, o passo não roda e vira uma pergunta de autorização.

No `roadmap-release`, a pergunta vem **no fim do run**: a entrega afetada fica parada antes do passo, as demais seguem, e uma única pergunta reúne todas as autorizações pendentes. A resposta retoma só o que foi liberado.

**Efeito externo** (chamada minha): produção, deploy, push, envio de e-mail ou mensagem, escrita em dados compartilhados, e reset ou rollback no checkout da pessoa. Na dúvida, é externo.

**`plan-coordinator`:** roda na sessão da pessoa, logo pergunta na hora.
- O Passo 1 classifica os passos com efeito externo. O mapa os mostra, e o `Status` e o `Next Action` são gravados antes da pergunta, para sobreviver a uma compactação.
- O template do executor proíbe push, deploy e efeitos externos em geral.
- Autorização dada no pedido inicial, citando o passo, dispensa a pergunta.

**`roadmap-release`** (nomes são chamada minha):
- Argumento `authorizeExternal`: lista de itens exatos, como `"gate:G3"`, `"E18:T4"` ou `"checkout:<alvo>"`. Só a pessoa autoriza, nunca um agente. Decisão do dono: um "sim" à pergunta final vale para exatamente os itens que ela mostrou, por nome, e a pessoa pode liberar só parte citando os itens. Decisão do dono: a autorização vale até a entrega terminar, em todas as rodadas e retomadas dela. Chamada minha: como o passo pode repetir, a revisão do plano exige que toda tarefa `external` diga como evita efeito duplicado, Decisão do dono: qualquer plano refeito invalida a autorização, mesmo com o mesmo número de tarefa, e a pergunta volta. A pergunta única lista todas as tarefas externas pendentes do plano de uma vez. Decisão do dono: `always` e `sempre` são marcas livres no item 4, e `missingRules` não exige regra para gate restrito não autorizado (o preflight só avisa qual regra acrescentar se ele vier a ser autorizado).
- Cada tarefa do plano leva o campo obrigatório `external` (booleano) e a revisão do plano o confere.
- Código determinístico, não o agente, para a entrega antes de uma tarefa `external` sem autorização, sem gastar rodadas de correção.
- Ação nova `authorize-external`, com `doNow` e `resumeWith` carregando a autorização pronta para a pessoa confirmar.
- O prompt de todo implementador proíbe efeito externo fora de tarefa autorizada.
- `SKILL.md`: a pergunta única vira a quarta pergunta permitida, depois do relatório, e reúne todas as `authorize-external`. Ela pode ser combinada com a oferta de `resumeWith`, para não haver duas perguntas.

## 4. Correções principais

Linhas referem-se a `ae8cde0`.

### roadmap-release

| # | Defeito | Comportamento exigido |
|---|---|---|
| 1 | Entrega nova mescla antes de validar uma interrompida da mesma seleção (`roadmap-release.js:61,779,1472-1483`) | Toda entrega nova espera todas as `finish-merge` antes do semáforo de merge. Uma que termine quebrada impede novos merges |
| 2 | Parcial conta como concluída (`:726`, `:99`) | A regra do ancestral vale só quando o segmento de código está finalizado. `piece 1: integrated; piece 2: spec` não é concluída, e uma linha `spec` citando commit da main também não. Alterar o prompt de descoberta |
| 3 | Parser de gates (`preflight.mjs:46-55,75-76`) | Leitura posicional, com a regra de escape e cercas do checker: cabeçalho localizado, âncora com atributo, `\|` no comando, bloco cercado ignorado, célula vazia ou `-` descartada |
| 4 | `Environment` e `When` ignorados | Chamada minha: livre é célula vazia, `-`, ou texto que indique local ou recorrência de tarefa/merge (`local`, `every`, `each`, `before`, `merge`, `task`, `cada`, `todo`, `antes`, `always`, `sempre`) sem nenhuma marca de restrição. Marca de restrição (`prod`, `produção`, `staging`, `owner`, `dono`, `release only`) sempre restringe. Valor desconhecido conta como restrito, com aviso no preflight. A derivação mantém o gate no config com `restricted: true`, e o filtro fica no workflow, que só o roda com `authorizeExternal: "gate:<id>"`. Se todos os gates forem restritos, o preflight dá erro. Configs já commitados sem o campo seguem como foram escritos por uma pessoa |
| 5 | Campos ausentes na descoberta (`:681,742,746-749`) | `S_DISC` exige `integrationBranch`, vocabulário, `today`, `roadmapDir`, `strategy` e `checker`. Sem fallback para `main`; ausência devolve `status: error` |
| 6 | Rollback no checkout da pessoa (`:805,826,1443`) | Chamada minha: vale para qualquer worktree que já tenha o alvo e não seja a própria do workflow em `<wtRoot>/_integracao`, inclusive `INTWT === REPO`. Sem `authorizeExternal: "checkout:<alvo>"`, nenhum merge ocorre e surge `authorize-external`. A regra "NEVER touch" do prompt fica condicionada |
| 7 | `notes` indo para `decisions.md` (`:1152,1211`) | O registro não copia `notes`; anota só que houve resposta. `doNow` de `human-input` e `operator.md` proíbem segredo em `notes` e mandam usar variável de ambiente |
| 8 | Tag executável com `kind: human` (`:323`) | `evidenceGaps` exige `VERIFY_EXEC.includes(p.kind)` para tags executáveis |
| 9 | Retomada perde atos humanos e riscos (`:1070-1094,1208`) | `finish-merge` recalcula `acOpen`, `human` e `acceptedRisks` a partir do card e do log de revisões, igual ao caminho normal |
| 10 | Etapa 3 do `SKILL.md` | Pular a etapa quando `<alvo>:<roadmap>/release.config.json` já existe |
| 14 | BLQ encerrado trava o plano (`:325-326`) | Emitir ação `decision` específica, sem gastar rodadas nem sair como `defect` |

### release + tracker

| # | Defeito | Comportamento exigido |
|---|---|---|
| 11 | Etapa de docs pode reescrever a estratégia (`roadmap-release.js:799,899,1017`; `roadmap-tracker/SKILL.md:32,162`; `events.md:74,191`) | Os prompts de registro e docs proíbem revisão de estratégia e migração, e deixam item em `pending`. O tracker declara que a pré-aprovação nunca cobre isso: sem pessoa, grava só o pending |

### plan-coordinator

| # | Defeito | Comportamento exigido |
|---|---|---|
| 12 | Sem parada para efeito externo (`SKILL.md:91-99`, `delegation-protocol.md:77-82`, `routing.md:35,53`) | Seção 3 |
| 13a | Recuperação fecha passo sem revisor (`delegation-protocol.md:117`) | Vai para Verification e Writing back |
| 13b | Paradas sem estado (`routing.md:62`, `delegation-protocol.md:28`) | Gravar `Status: Blocked` e `Next Action`. O item 5 exclui grupos PASS. Registrar a revisão final e seu contador de rodadas |
| 13c | `Baseline` sem uso (`SKILL.md:51`) | Comparar o portão com o Baseline; falha preexistente não aciona a pessoa |
| 13d | Tracker pergunta no meio do run (`delegation-protocol.md:30`, `events.md:191,254,257`) | Chamar o tracker com "sem perguntas, devolva pendências" e apresentá-las ao final |
| 13e | Passo inline sem caminho (`SKILL.md:73`, `delegation-protocol.md:24,29`) | O item 5 exclui inline, e o item 10 cobre passo inline de qualquer onda, inclusive a primeira |

## 5. Correções importantes de menor alcance

**roadmap-tracker**
- Fechar um BLQ inclui reescrever as citações restantes, mantendo os itens de `pending` que precisam continuar (`events.md:118-119`).
- Receita para as transições spec/plano/executando e consulta somente leitura de "roadmap status" (`SKILL.md:110-129`).
- Alvo informado pelo chamador quando não há `releaseBranch` (`events.md:84,262`).

**roadmap-planner**
- Como derivar o comando de `{verify}` para código que ainda não existe, a partir dos gates, com refinamento registrado em `DEC` (`formats.md:256`, `decompose.md:130`).
- Pergunta de autonomia: como conta no orçamento do modo leve, e o ramo "não" (`clarify.md:124`, `SKILL.md:57,79,99`). Chamada minha: o DEC orienta o planejamento; a autonomia do `roadmap-release` é decidida ao invocá-lo, e o texto dirá isso.

## 6. Como verificar

- Teste de regressão por item testável, visto falhar antes da correção, nos arquivos `*.test.mjs` existentes.
- Suíte e lint com 0 falhas, da raiz da worktree: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` e `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.
- Teste comportamental por subagente dos três skills sem cobertura, e dos trechos alterados do `roadmap-release`.
- Revisão adversarial da branch inteira em T3 (opus, high).
- Run real do Workflow em sandbox descartável, com um cenário de tarefa `external`: a entrega para antes do passo, as demais seguem, a pergunta única aparece, e a retomada autorizada executa só o liberado.

## 7. O que fica com o construtor

- Blocos e ordem das tarefas. Sugestão: um bloco por skill, com o parser de gates e a autorização primeiro.
- Forma exata dos schemas e mensagens, respeitando os contratos acima.
- Aceitar um achado menor quando ele cair na mesma linha de uma correção, como a gramática de tag `{verify:}` duplicada entre checker e workflow.
- Estacionados da etapa anterior continuam estacionados (`_integracao`, throw na trava de merge, custo de re-gate).
- Roteamento de modelos pela política global. Sem merge nem push.
