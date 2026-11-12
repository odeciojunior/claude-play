# E20 -- Autor de plano, skill interativa de plano e ponteiros nativos (design)

Entregável E20 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, seção E20). REQ: REQ-007, REQ-008, REQ-013, REQ-020, REQ-037. Depende de E6 (esquema `plan/1` e `plan-tool.mjs`; DEC-176, DEC-180, DEC-188) e de E19 (agente `spec-author` e skill `spec-writer`; DEC-404 a DEC-421). Card crítico, trilha de engenharia, fase spec-plano. Proposta de desenho: SRC-08, seção B3. Nomes: DEC-041. Caminhos: DEC-026. Adoção: DEC-018. Aprovação: DEC-040. Suíte de gatilho: DEC-025. Forma do autor: DEC-057, DEC-404 a DEC-406, com a emenda DEC-421.

Estado da execução: decidido sob as regras permanentes do dono (decisões do dono delegadas a um subagent Fable). As execuções do orquestrador rodam em `bypassPermissions`, sem acrescentar regras de Bash; o que é embarcado (agente, skill, README) nunca indica `bypassPermissions` (DEC-312). Nunca há push nem toque em `main`. Nenhuma versão sobe nesta branch.

## Por quê

O plano de um entregável sai hoje de uma skill externa (`superpowers:writing-plans`) com instruções escritas por cima dela no prompt do workflow (SRC-02 §4; `roadmap-release.js`, estágio Plan, em opus/medium). O planner e o tracker mandam a pessoa para as skills externas de spec e de plano. O dono decidiu independência total (DEC-005, DEC-019; REQ-008), REQ-007 pede uma skill própria de plano com modo autônomo e interativo, REQ-013 exige que o autor de plano proíba perguntar à pessoa, REQ-020 exige que um plano sem bloco de dados entre pela adoção da skill de plano, e REQ-037 exige execução comportamental registrada. E6 entregou o formato e a ferramenta que fecha a escrita; E19 entregou o autor de spec e a forma de agente do plugin; falta o autor de plano, a skill que o usa e os ponteiros.

## Critérios de aceite (do card, literais)

1. Dado um spec do cenário fixo, quando o autor de plano roda três vezes sem pessoa, então cada plano passa na checagem dentro das tentativas do autor e nenhuma pergunta é feita. {verify: human; evidence: o dono confere o resultado das execuções comportamentais registrado em docs/reports}
2. Dado um spec fora de um roadmap, quando a skill interativa de plano roda, então grava um plano que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
3. Dado o repositório após a entrega, quando se procura a palavra superpowers nos arquivos publicados das skills do planner e do tracker, então não há ocorrência. {verify: test; evidence: node --test plugins/productivity-tools/scripts/independence.test.mjs}
4. Dado um plano já escrito, sem bloco de dados, quando a skill de plano o adota, então mostra o que mudou nas tarefas, pede uma aprovação e grava um plano que passa na checagem. {verify: human; evidence: o dono confere o resultado da execução comportamental registrado em docs/reports}
5. Dada a suíte de casos de gatilho, quando o dono a roda, então o resultado por caso está registrado, com os pedidos de spec, de plano, de roadmap e de execução de plano indo cada um para a skill certa, e com o registro de o superpowers estar ou não habilitado na sessão. {verify: human; evidence: o dono roda a suíte e confere o resultado registrado em docs/reports}

Definição de pronto (card): aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Peça 1: agente do plugin `productivity-tools:plan-author` (`plugins/productivity-tools/agents/plan-author.md`), na forma de `spec-author` com a emenda DEC-421, que registra decisões e não código, não pergunta e fecha a escrita com `plan-tool check`.
- Peça 2: skill `plan-writer` (`plugins/productivity-tools/skills/plan-writer/SKILL.md`), que usa o mesmo autor, não pede aprovação ao escrever (DEC-040), grava `plan.md` na pasta do spec (DEC-026), e tem o modo de adoção (DEC-018) com uma aprovação.
- Peça 3: o planner e o tracker apontam para `spec-writer` e `plan-writer`; nenhuma ocorrência de "superpowers" nos arquivos publicados das duas skills.
- Peça 4: suíte de casos de gatilho, com executor e testes, rodada pelo dono (DEC-025).
- Comando `summary` com idioma nas duas ferramentas (`spec-tool summary --lang`, `plan-tool summary --lang`), usado pelas duas skills interativas (instrução do dono).
- Execuções comportamentais dos critérios 1, 2 e 4 e a execução pendente de E19 na forma do plugin (DEC-400), com relatório em `docs/reports/`.

Não objetivos (de outros cards ou fora do card):

- Ligar o autor de plano ao estágio Plan do workflow do release, os caminhos de artefato do release e as regras de parada: E8. E20 não edita `skills/roadmap-release/workflow/roadmap-release.js`.
- Alinhar `agents/spec-author.md` à emenda DEC-421: E8 (DEC-421). E20 não edita `spec-author.md`.
- A recusa do coordinator a plano sem bloco de dados: já entregue por E7 (`progress.mjs`, código `plan-no-data-block`, cuja mensagem já cita `plan-writer` e o modo de adoção). E20 não edita `progress.mjs`; só fixa o contrato em teste.
- Varredura de "superpowers" no resto do plugin: E7, E8, E9, E13, E21 e E24 (REQ-008). `independence.test.mjs` nasce aqui e E13 o estende (card).
- Revisão do plano: continua a que o release usa hoje; a medição do laço e do modelo do autor é E26.
- Subir versão: nenhuma versão sobe (instrução do dono); a publicação que levar E20 sobe `productivity-tools` nos dois lugares.
- Script de migração ou pasta antiga nomeada na adoção (DEC-018).

Anti-objetivos:

- O agente nunca pergunta à pessoa e não tem `AskUserQuestion` nem `Agent` entre suas ferramentas.
- O agente não faz commit, não faz push e grava só no caminho de saída que recebe.
- Nenhum valor de credencial, token ou chave em plano, fixture, relatório ou commit.
- A adoção nunca sobrescreve o plano original antes da aprovação, e nunca muda o caminho do plano (DEC-026: "plano adotado é reescrito onde está").

## Desenho

### Peça 1 -- agente `plan-author` (critério 1)

Arquivo novo `plugins/productivity-tools/agents/plan-author.md`. Frontmatter só com chaves aceitas por `lint-plugin.mjs` para agentes: `name: plan-author`; `description` (escreve um plano `plan/1` para um spec `spec/1` checado, ou reescreve um plano antigo sem bloco de dados; não para specs); `model: opus`, `effort: medium` (o modelo e o effort do estágio Plan do release hoje, `roadmap-release.js` linha do rótulo `${E}:plan`); `tools: Read, Grep, Glob, Bash, Write, Edit`.

Despacho: de um workflow, `agent(prompt, { agentType: 'productivity-tools:plan-author' })` (E8, DEC-057); de uma skill na sessão principal, ferramenta Agent com `subagent_type: "productivity-tools:plan-author"`.

Contrato de chamada, uma linha `chave: valor` por campo, na forma emendada por DEC-421:

| Campo | Modo | Conteúdo |
|---|---|---|
| `mode` | todos | `unattended`, `interactive` ou `adopt` |
| `output` | todos | caminho absoluto do plano a gravar; o agente não escolhe outro |
| `planTool` | todos | caminho absoluto de `plan-tool.mjs`; nunca adivinhado nem procurado no cache |
| `spec` | todos | caminho absoluto do spec `spec/1` (o campo `spec` do bloco é gravado relativo à pasta de `output`) |
| `language` | todos | idioma da prosa do plano |
| `roadmap` | todos | pasta do roadmap relativa à raiz do repositório, com `/` e terminada em `/`, ou `null`; vai literal para o campo `roadmap` do bloco; o agente não procura nem troca o valor |
| `card` | unattended | id do card |
| `source` | adopt | caminho absoluto do plano antigo a reescrever (lido, nunca alterado pelo agente) |
| `ownerNote` | unattended, opcional | instrução do dono; último campo, pode ter várias linhas até o fim do prompt |
| `intake` | interactive, adopt | nota do chamador (pedido da pessoa, palpites marcados); último campo, várias linhas até o fim do prompt |

Processo (uma chamada, SRC-08 B3):

1. Ler o spec (prosa e bloco `spec/1`) e, no modo autônomo, o card, os REQs e as decisões vigentes do assunto; no modo `adopt`, ler `source` inteiro.
2. Ler o código que o spec toca até cada critério de aceite ter tarefa e arquivo reais.
3. Decompor em tarefas `plan/1` (arquivos, dependências, interfaces produzidas e consumidas, efeitos externos marcados, `testFirst`, `checks`, `covers`, `score` para o roteamento de `lib/routing.mjs`) e uma linha de evidência por critério, com a mesma marca do spec. O plano registra decisões (`rulings`) e itens de pessoa (`needsPerson`); não traz código de implementação, só caminhos, assinaturas e comandos de verificação.
4. No modo `adopt`: manter a intenção de cada passo do plano antigo; a prosa do plano novo termina com a seção `## Adoção` que lista, por passo antigo, a tarefa ou as tarefas novas e o que mudou (dividida, fundida, acrescentada, removida, com o motivo). Nada é descartado em silêncio.
5. Revisão própria: todo critério coberto; nenhum espaço reservado; nada fora do escopo do spec; toda decisão com base, custo se errada, reversibilidade e alcance.
6. Rodar `node "<planTool>" check "<output>" --json` e corrigir até sair 0, no máximo três execuções (as "tentativas do autor" do critério 1).
7. Última mensagem: a saída literal de `node "<planTool>" emit "<output>"`; se a checagem ainda falhar depois da terceira execução, a saída literal do último `check --json`. Nada em volta.

Regras fixas no corpo: não perguntar, não esperar resposta, não oferecer escolha de volta; não fazer commit (o commit é do chamador); não inventar credencial, dado de produção, aceite ou aprovação; efeito externo é marcado na tarefa (`external: true`), nunca executado; gravar só em `output`.

### Peça 2 -- skill `plan-writer` (critérios 2 e 4)

Arquivo novo `plugins/productivity-tools/skills/plan-writer/SKILL.md`, frontmatter `name`, `description`, `argument-hint` (`<spec.md ou plano.md> [--roadmap <pasta>]`; política de chaves do repositório). A descrição diz: escreve o plano de implementação de um spec `spec/1`, ou adota um plano antigo sem bloco de dados (modo de adoção); não para escrever spec (`spec-writer`), não para roadmap (`roadmap-planner`), não para executar (`plan-coordinator`).

Entrada: um caminho e, opcional, `--roadmap <pasta>`. A skill decide o modo pelo arquivo, sem perguntar.

Pasta do roadmap (o campo `roadmap` do bloco, que `plan-coordinator` lê para chamar `roadmap-tracker` depois de cada onda e no fim do plano; antes vinha da linha `**Roadmap:**` do cabeçalho). A skill resolve o valor antes de despachar, sem perguntar, na primeira fonte que existir:

1. `--roadmap <pasta>` da chamada. Pasta sem `roadmap.config.json`: a skill para e relata, sem despachar.
2. Só no modo de adoção: a linha `**Roadmap:** <pasta>` do cabeçalho do plano antigo.
3. A pasta do spec com nome `<nome>-E<n>` (DEC-026): `docs/plans/<nome>/` e, se não existir, `docs/plans/roadmap-<nome>/`, aceita só se tiver `roadmap.config.json`, se o `id` do bloco `spec/1` for `E<n>` e se `spec-tool check <spec> --roadmap <pasta>` sair 0.
4. Nenhuma: `null` (spec fora de roadmap).

O valor é normalizado (relativo à raiz do repositório, `/`, terminado em `/`) e vai no campo `roadmap` do despacho de `plan-author` em todos os modos. Uma fonte 2 ou 3 que aponte para pasta sem `roadmap.config.json`, ou cujo card não confira, não é usada em silêncio: a skill grava `null` e diz no relato (e, na adoção, no texto da aprovação) qual ponteiro foi achado e por que caiu. Depois da escrita, a skill confere que o `roadmap` do bloco gravado é o valor resolvido; diferente, relata como falha.

Modos:

- Spec `spec/1` (o bloco tem `schema: "spec/1"`): modo de escrita. `output` = `<pasta do spec>/plan.md` (DEC-026). Se o spec tiver item de pessoa bloqueante (`spec-tool summary --json`, campo `stops`), a skill para e mostra o resumo, sem despachar. Se `plan.md` já existe com bloco de dados, a skill roda `plan-tool check` nele e relata, sem reescrever, salvo pedido explícito da pessoa na própria chamada. Despacha `plan-author` com `mode: interactive` e o `roadmap` resolvido. Sem aprovação (DEC-040): relata o caminho, a pasta do roadmap gravada (ou que o plano não tem roadmap), a saída de `plan-tool summary --lang <idioma>` e oferece a execução com `plan-coordinator`.
- Plano sem bloco de dados, de qualquer origem: modo de adoção (DEC-018). Passos:
  1. Achar o spec: um `spec/1` citado no plano ou ao lado dele. Se não houver, a skill despacha `spec-author` em `mode: interactive` com o plano antigo e o design que ele citar no `intake`, gravando `docs/plans/<tópico>/spec.md` (DEC-026, tópico kebab a partir do título do plano). Esse spec não pede aprovação separada: o seu resumo entra na aprovação única da adoção.
  2. Despachar `plan-author` com `mode: adopt`, `source` = o plano antigo, `roadmap` resolvido (a linha `**Roadmap:**` do plano antigo passa ao campo do bloco) e `output` = `<plano antigo>.adopted.md` (arquivo irmão provisório). O original fica intacto.
  3. Mostrar a seção `## Adoção` do plano novo (o que mudou nas tarefas), a pasta do roadmap do bloco (com a origem: argumento, cabeçalho antigo ou pasta do spec, ou o ponteiro que caiu e por quê) e a saída de `plan-tool summary --lang <idioma>`, e pedir uma aprovação numa única chamada de `AskUserQuestion` (aprovar / recusar).
  4. Aprovado: mover o provisório por cima do original (mesmo caminho), ajustar o campo `spec` relativo à pasta do original e rodar `plan-tool check` no caminho final; relatar. Recusado: apagar o provisório; o original segue como estava.
- Plano com bloco de dados: relatar `plan-tool check`; nada a adotar.

O que só a pessoa decide: nada mais. A skill não faz commit. Recusas: agente não encontrado -> relatar o erro literal e pedir `/reload-plugins`, sem colar o corpo do agente (como DEC-401); permissão negada -> mostrar a regra exata por nome de script, `Bash(node *plan-tool.mjs" *)` (e a de `spec-tool.mjs` quando for o caso), nunca editar configuração nem sugerir modo sem permissões (DEC-312).

`spec-writer/SKILL.md`, passo 5: "que o plano sai de `plan-writer` quando existir" passa a "o plano sai de `plan-writer`", e o passo 4 passa `--lang` ao `summary`.

### Resumo com idioma nas duas ferramentas (instrução do dono)

- `spec-tool.mjs summary <spec.md> [--lang pt|en] [--json]`: os cabeçalhos e os nomes de coluna de `formatSummary` vêm de uma tabela de rótulos por idioma; `pt` é o padrão (a saída atual não muda para quem não passa a opção); outro valor sai com uso inválido (código 2). `--json` não muda.
- `plan-tool.mjs summary <plan.md> [--spec <spec.md>] [--lang pt|en] [--json]`, comando novo: tabela de tarefas (n, título, dependências, nível, effort e revisão vindos de `route`, externo), tabela de evidência por critério (critério, tipo, comando) e as tabelas de decisões e de pessoas no formato de `spec-tool`. Plano com erro de checagem: imprime os erros e sai 1, como `check`.
- Testes nos arquivos existentes `scripts/spec-tool.test.mjs` e `scripts/plan-tool.test.mjs`: saída padrão idêntica à atual, cabeçalhos em inglês com `--lang en`, uso inválido com idioma desconhecido, resumo do plano de exemplo de `fixtures/plan-tool/plan.md`.

### Peça 3 -- ponteiros nativos (critério 3)

Trocas nos arquivos publicados das duas skills, sem mudar comportamento além do ponteiro:

- `skills/roadmap-planner/SKILL.md`: na descrição, "BEFORE superpowers:brainstorming" passa a "BEFORE spec-writer" e "use superpowers:writing-plans" passa a "use plan-writer"; a tabela de limites aponta para `plan-writer`; o passo 8 encadeia `spec-writer` por entregável (pedido com o card, os REQs e as dependências; tópico `<slug do roadmap>-E<n>`, DEC-026), depois `plan-writer` sobre esse spec com `--roadmap <pasta do roadmap>` (o campo `roadmap` do bloco, preenchido por `plan-writer`, faz o papel da antiga linha `**Roadmap:**`), depois `plan-coordinator`; vários entregáveis sem pessoa continuam em `roadmap-release`.
- `skills/roadmap-planner/references/clarify.md` §8, `references/decompose.md` e `references/formats.md`: "brainstorming"/"writing-plans" passam a `spec-writer`/`plan-writer`.
- `skills/roadmap-planner/scripts/prose-budget.test.mjs`: o comentário de cabeçalho cita o card E4 e DEC-034 em vez do caminho do spec sob a pasta do superpowers.
- `skills/roadmap-tracker/SKILL.md`: na descrição, "use superpowers:writing-plans" passa a "use plan-writer".

O orçamento de prosa do planner (`prose-budget.test.mjs`, que soma `SKILL.md`, `clarify.md`, `decompose.md` e `model.md`) não pode estourar: as trocas são de mesmo tamanho ou menores.

Teste novo `plugins/productivity-tools/scripts/independence.test.mjs` (arquivo do card):

- Critério 3: nenhum arquivo sob `skills/roadmap-planner/` e `skills/roadmap-tracker/` contém "superpowers" (sem diferenciar caixa); o mesmo para os arquivos novos deste card (`skills/plan-writer/`, `agents/plan-author.md`).
- REQ-013: o frontmatter de `agents/plan-author.md` não lista `AskUserQuestion` nem `Agent`, e o corpo proíbe perguntar.
- Ponteiro do roadmap: o corpo de `agents/plan-author.md` lista o campo `roadmap` para todos os modos, e `skills/plan-writer/SKILL.md` cita `--roadmap`, a linha `**Roadmap:**` e `roadmap.config.json` (as três fontes da resolução); `skills/roadmap-planner/SKILL.md` passa `--roadmap` ao `plan-writer`.
- REQ-020: a mensagem de `plan-no-data-block` de `progress.mjs` cita `plan-writer` e o modo de adoção, e `skills/plan-writer/SKILL.md` existe, com `name: plan-writer` e o modo de adoção descrito; o teste falha se um lado mudar sem o outro.

E13 estende o arquivo às demais skills (card).

### Peça 4 -- suíte de casos de gatilho (critério 5)

Fica fora do plugin, em `tools/measure/` (ferramenta do repositório, não publicada):

- `tools/measure/trigger/cases.json`: casos com `id`, `prompt` (pt e en), `expect` (`productivity-tools:spec-writer`, `productivity-tools:plan-writer`, `productivity-tools:roadmap-planner`, `productivity-tools:plan-coordinator`) e `category` (spec, plano, roadmap, execução de plano); ao menos três por categoria, incluindo pares próximos que testam o risco 2 do card (plano de tarefas versus roadmap; escrever plano versus executar plano).
- `tools/measure/run-trigger.mjs`: para cada caso, roda `claude -p "<prompt>" --plugin-dir <plugin> --output-format stream-json --verbose --max-turns 2` num sandbox descartável fora do repositório; registra a primeira invocação de `Skill` (ou nenhuma), se bateu com `expect`, e se o superpowers estava habilitado (pela lista de plugins e skills do evento `system/init`). `--dry-run` lista os comandos sem chamar o `claude`. Escreve a tabela por caso num arquivo dado por `--out` (o dono a coloca em `docs/reports/`).
- `tools/measure/run-trigger.test.mjs`: testes com transcrições `stream-json` gravadas à mão em `tools/measure/fixtures/trigger/` (acerto, erro de skill, nenhuma skill, superpowers presente e ausente) e o `--dry-run`. Nenhuma chamada paga nos testes.

A execução paga é do dono (DEC-025, DEC-011); nenhuma tarefa do plano a roda.

### Execuções comportamentais (critérios 1, 2 e 4; REQ-037; pendência de E19)

Tarefas do orquestrador da sessão principal (DEC-204), na worktree de E20, antes do merge, com sandboxes em `D:/projects/claude-play-wt/_tmp/E20/`, apagados ao fim. Cada execução é uma sessão `claude -p` lançada pelo orquestrador com `--plugin-dir D:/projects/claude-play-wt/E20/plugins/productivity-tools`, `--model opus`, `--permission-mode bypassPermissions` (instrução do dono), `--output-format stream-json --verbose`, com o sandbox como diretório de trabalho; essa sessão é a principal e tem a ferramenta Agent, então o despacho é por nome do plugin, sem forma de reserva. O relatório registra, de cada execução, a fonte do plugin carregado (evento `init`), o modelo das mensagens do subagent e as ferramentas que ele usou.

- Cenário: variante nova `plan-author` de `tools/measure/make-scenario.mjs`, que monta o sandbox como as outras e acrescenta `docs/plans/roadmap-sandbox-E5/spec.md`, um spec `spec/1` do E5 do sandbox escrito à mão em `tools/measure/scenario/plan-author-spec.md` (mesmos critérios do card E5 do sandbox), e, para o critério 4, o plano em prosa `tools/measure/scenario/e5/plan.md` copiado para `docs/superpowers/plans/2026-01-01-e5-text-utilities.md` do sandbox (forma de um plano da versão anterior; a cópia vive só no sandbox). `make-scenario.test.mjs` (existente) ganha a variante e confere `spec-tool check --roadmap` em 0 no sandbox. O roadmap de `make-sandbox.mjs` não muda (DEC-301, DEC-413).
- Pendência de E19: uma execução que despacha `productivity-tools:spec-author` por nome, no modo autônomo sobre o card E6 da variante `spec-author`, e confere que o despacho achou o agente, que o modelo das mensagens dele é opus e que só usou ferramentas da lista `Read, Grep, Glob, Bash, Write, Edit`; `spec-tool check` em 0.
- Critério 1: três execuções de `plan-author` em `mode: unattended` sobre o spec do sandbox, cada uma num sandbox novo, com `roadmap: docs/plans/roadmap-sandbox/`. Conferido em cada uma: `plan-tool check` em 0 no plano gravado; campo `roadmap` do bloco igual ao passado; no máximo três `check` na transcrição do agente; nenhuma chamada de `AskUserQuestion` e nenhuma pergunta à pessoa na saída; modelo e ferramentas como acima.
- Critério 2: uma execução da skill `plan-writer` sobre um spec fora de roadmap (`docs/plans/<tópico>/spec.md` do sandbox, `spec/1` escrito à mão em `tools/measure/scenario/plan-writer-spec.md`). A sessão segue o SKILL.md; conferido: `plan.md` gravado na pasta do spec, `plan-tool check` em 0, campo `roadmap` do bloco `null`, nenhuma pergunta de aprovação.
- Critério 4: uma execução da skill `plan-writer` sobre o plano antigo do sandbox. Onde a skill chamaria `AskUserQuestion`, a sessão grava no relatório o texto literal da aprovação e toma a resposta "aprovar" do roteiro sintético `tools/measure/scenario/plan-writer-adopt.md` (marcado como entrada sintética, como DEC-419). Conferido: a seção `## Adoção` e a pasta do roadmap mostradas antes da aprovação, uma aprovação pedida, o plano gravado no mesmo caminho e `plan-tool check` em 0, o campo `roadmap` do bloco igual a `docs/plans/roadmap-sandbox/` (a linha `**Roadmap:**` de `tools/measure/scenario/e5/plan.md`), o provisório apagado.
- Relatório: `docs/reports/2026-11-12-E20-autor-plano-comportamental.md`, escrito pelo orquestrador com as saídas literais, commitado em `feat/E20`. Depois, uma revisão adversarial somente leitura do resultado (regra de skills). O aceite é do dono.

### Documentação

`plugins/productivity-tools/README.md`: linha de `plan-writer` na tabela de skills (com o modo de adoção) e um item do agente `plan-author` ao lado de `spec-author`. Diagramas e `CLAUDE.md` não mudam (nenhum plugin entra ou sai). Sem subir versão.

## Casos de borda

- Spec com item de pessoa bloqueante: `plan-writer` para antes de despachar e mostra o resumo.
- Spec sem bloco `spec/1` dado ao modo de escrita: a skill não adivinha; relata o erro de `spec-tool check` e aponta `spec-writer`.
- Autor que não passa na checagem em três execuções: a skill mostra o `check --json` devolvido e para, sem aprovação nem gravação final (na adoção, o provisório é apagado).
- Adoção recusada: o original não muda.
- Plano antigo sem spec nem design citado: o `intake` do `spec-author` leva só o plano antigo; os critérios de aceite saem dele, cada um com a marca `{verify: ...}`.
- `plan.md` já existente com bloco de dados: relatado, não reescrito.
- `--roadmap` apontando para pasta sem `roadmap.config.json`: a skill para antes de despachar e relata.
- Linha `**Roadmap:**` do plano antigo, ou pasta `<nome>-E<n>` do spec, apontando para pasta sem `roadmap.config.json` ou com card que não confere: `roadmap: null` no bloco, com o ponteiro achado e o motivo no relato e no texto da aprovação; nunca descartado em silêncio.
- Spec fora de roadmap (pasta sem sufixo `-E<n>`, sem argumento): `roadmap: null`, e o relato diz que o coordinator não chamará o tracker.

## Deixado ao planejador

Ordem e divisão das tarefas (no máximo quatro arquivos por tarefa); texto exato do corpo do agente e do SKILL.md; rótulos em inglês das tabelas de resumo; a lista exata de casos de gatilho; o texto dos fixtures de cenário e do roteiro sintético.

## Decisões autônomas (revisáveis pelo dono)

1. O autor de plano é o agente `plugins/productivity-tools/agents/plan-author.md`, com `model: opus`, `effort: medium` (o do estágio Plan do release hoje) e `tools: Read, Grep, Glob, Bash, Write, Edit`, sem `AskUserQuestion` nem `Agent`. Opção descartada: sonnet. Base: card peça 1, DEC-057, DEC-404, REQ-013. Custo se errada: médio. Reversível. Alcance: contrato.
2. Contrato de chamada do `plan-author`: `mode` (`unattended`, `interactive`, `adopt`), `output` e `planTool` e `spec` absolutos, `language`, `roadmap` em todos os modos (pasta relativa terminada em `/`, ou `null`, gravada literal no bloco), `card` (autônomo), `source` (adoção), e a nota (`ownerNote` ou `intake`) como último campo, com várias linhas; nunca commita; última mensagem é a saída literal de `plan-tool emit`, ou a do último `check --json` depois de três execuções. Base: DEC-421, DEC-405, DEC-406. Custo se errada: médio (E8 consome). Reversível. Alcance: contrato.
3. A adoção grava o plano novo num arquivo irmão provisório e só o move por cima do original depois da aprovação; recusa apaga o provisório. Opção descartada: reescrever no lugar antes de aprovar. Base: DEC-018, DEC-026, risco 1 do card. Custo se errada: baixo. Reversível. Alcance: local.
4. Um plano adotado sem spec `spec/1` ganha um spec escrito por `spec-author` em `docs/plans/<tópico>/spec.md`, cujo resumo entra na aprovação única da adoção; o plano fica onde está, com `spec` relativo. Opção descartada: exigir um spec antes de adotar. Base: `plan-tool` exige spec válido (DEC-180), DEC-026, DEC-018 ("de qualquer origem"). Custo se errada: médio. Reversível. Alcance: contrato.
5. O que mudou nas tarefas vem da seção `## Adoção` escrita pelo autor na prosa do plano novo, por passo antigo; o esquema `plan/1` não ganha campo. Base: DEC-176. Custo se errada: baixo. Reversível. Alcance: local.
6. `plan-writer` decide o modo pelo arquivo recebido (spec, plano sem bloco, plano com bloco), sem pergunta; não tem rodada de perguntas no modo de escrita. Base: DEC-040, spec já decidido. Custo se errada: baixo. Reversível. Alcance: local.
7. `spec-tool summary` e o novo `plan-tool summary` aceitam `--lang pt|en`, com `pt` como padrão para não mudar a saída atual; idioma desconhecido é uso inválido. Opção descartada: idioma tirado do bloco de dados (o esquema não tem o campo). Base: instrução do dono. Custo se errada: baixo. Reversível. Alcance: contrato.
8. `progress.mjs` não muda: a mensagem de `plan-no-data-block` já cita `plan-writer` e o modo de adoção; `independence.test.mjs` fixa os dois lados. Base: instrução do dono, E7. Custo se errada: baixo. Reversível. Alcance: local.
9. `independence.test.mjs` cobre o planner, o tracker e os arquivos novos de E20 (busca sem diferenciar caixa), mais o frontmatter de `plan-author` e o contrato de adoção; E13 estende. Base: card, REQ-008, DEC-019. Custo se errada: baixo. Reversível. Alcance: local.
10. O planner encadeia `spec-writer`, `plan-writer` e `plan-coordinator` por entregável, com tópico `<slug do roadmap>-E<n>`, e mantém `roadmap-release` para vários entregáveis sem pessoa. Base: card peça 3, DEC-026, DEC-041. Custo se errada: baixo. Reversível. Alcance: local.
11. A suíte de gatilho fica em `tools/measure/` (não publicada), com casos em JSON, executor por `claude -p --plugin-dir` com `--dry-run`, e testes sobre transcrições gravadas; o registro do superpowers vem do evento `init`. Base: DEC-025, DEC-011. Custo se errada: baixo. Reversível. Alcance: local.
12. As execuções comportamentais são sessões `claude -p` lançadas pelo orquestrador da sessão principal com o plugin da worktree (`--plugin-dir`), opus, `bypassPermissions`, que despacham os agentes por nome, sem forma de reserva; a pendência de E19 (DEC-400) roda junto. Opção descartada: forma de reserva com o corpo colado. Base: DEC-204, instrução do dono. Custo se errada: baixo. Reversível. Alcance: local.
13. O cenário dos critérios 1 e 4 entra por uma variante nova `plan-author` de `make-scenario.mjs`, com spec `spec/1` escrito à mão e o plano em prosa do E5 do sandbox posto numa pasta da versão anterior; o roadmap de `make-sandbox.mjs` não muda. Base: DEC-301, DEC-413. Custo se errada: baixo. Reversível. Alcance: local.
14. Nenhuma versão sobe na branch; `spec-author.md` não é editado (fica para E8). Base: instrução do dono, DEC-421. Custo se errada: baixo. Reversível. Alcance: local.
15. Documentação: README de `productivity-tools` ganha `plan-writer` e o agente `plan-author`; diagramas e `CLAUDE.md` não mudam. Base: regras do `CLAUDE.md`. Custo se errada: baixo. Reversível. Alcance: local.
16. `plan-writer` resolve a pasta do roadmap antes de despachar, sem perguntar, nesta ordem: `--roadmap <pasta>` da chamada, a linha `**Roadmap:**` do plano antigo (adoção), a pasta do spec `<nome>-E<n>` (`docs/plans/<nome>/` ou `docs/plans/roadmap-<nome>/`, com `roadmap.config.json`, `id` igual a `E<n>` e `spec-tool check --roadmap` em 0), senão `null`; um ponteiro achado e recusado vira `null` com o motivo no relato e na aprovação da adoção; o planner passa `--roadmap` explícito. Opção descartada: aceitar `roadmap` só no modo autônomo, que deixava o coordinator sem chamar o tracker nos planos vindos do planner e nos adotados. Base: DEC-026, DEC-018, `delegation-protocol.md` do coordinator (`plan.roadmap`). Custo se errada: médio (o tracker deixa de rodar ou roda na pasta errada). Reversível. Alcance: contrato.

## Depende de entrada humana

- Conferência do dono dos resultados das execuções comportamentais dos critérios 1, 2 e 4 (`{verify: human}`) em `docs/reports/2026-11-12-E20-autor-plano-comportamental.md`. Não bloqueante: as execuções e o relatório são produzidos pelo entregável; nenhum aceite fictício é registrado.
- Execução paga da suíte de gatilho pelo dono e conferência do resultado registrado em `docs/reports/` (critério 5, DEC-025). Não bloqueante: a suíte, o executor com `--dry-run` e os testes são entregues; a rodada fica com o dono.
- Ratificação das decisões de alcance contrato (1, 2, 4, 7 e 16) antes de E8 (DEC-030). Não bloqueante: ficam como pendentes de origem executor.
- Nenhuma credencial é necessária.
