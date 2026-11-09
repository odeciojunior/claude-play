# roadmap-release: desenho

Status: rascunho para aprovação. Data: 2026-11-09. Plugin: `productivity-tools`.
Convenção: **[dono]** foi decidido pelo dono; **[recomendação]** é escolha do autor do desenho, que o dono pode trocar.

## 1. Intenção

Hoje, executar um roadmap com várias entregas exige copiar instruções entrega por entrega ou escrever um workflow próprio. O release E1–E16 do `udv-center` provou o caminho (850 agentes num run, 16 entregas mergeadas), mas com um script amarrado ao projeto.

`roadmap-release` torna isso reutilizável: **um comando resolve a lista de entregas de um roadmap acompanhado, em paralelo, numa noite, decidindo pela melhor recomendação e acionando a pessoa só quando for estritamente necessário.** [dono]

Sucesso é voltar e encontrar as entregas mescladas numa branch de integração, com gates comprovados, decisões autônomas listadas para ratificar e uma lista curta do que só um humano pode fazer, com os argumentos prontos para retomar.

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- Executar várias entregas `E<n>` respeitando o DAG do roadmap, em paralelo. [dono]
- Não interromper durante a execução. [dono]
- Levar cada entrega de card a merge: spec, plano, tarefas com revisão, revisão final, gates, merge, docs.
- Funcionar em qualquer projeto com pasta de roadmap (`roadmap.config.json`), sem conhecimento embutido de stack.
- Retomar de qualquer ponto de interrupção pelo estado do git.

**Não objetivos**
- Criar ou replanejar roadmaps (`roadmap-planner`).
- Executar um plano único de uma entrega (`plan-coordinator` continua sendo a escolha).
- Fazer push, publicar ou integrar na branch principal sem autorização explícita.

**Antiobjetivos** (falha mesmo que funcione)
- Registrar aceite humano, credencial ou dado que ninguém forneceu.
- Marcar gate como verde com medição inválida ou com teste enfraquecido.
- Deixar merge ruim na branch de integração sem rollback conferido ou sem parar os merges seguintes.
- Contrariar uma decisão registrada no roadmap por conta própria.

## 3. Restrições

- Regras do repositório: `SKILL.md` abaixo de 500 linhas; referências acima de 100 linhas com índice; frontmatter restrito; bump em `plugin.json` e no README raiz; teste comportamental por subagente com revisão adversarial; `validate-plugin` antes do commit.
- Texto do skill em inglês; artefatos gerados no idioma do projeto, conforme `roadmap.config.json`.
- Limites documentados de workflow: 16 agentes simultâneos por padrão e 1.000 por run. `isolation: worktree` parte da branch padrão, por isso não serve aqui.
- Formato de roadmap: `formatVersion` 1, conforme `roadmap-planner/references/formats.md` (versão 1.5.0, com tag de verificação, bloco de gates e `releaseBranch`).

## 4. Arquitetura [recomendação, aceita pelo dono ao priorizar o paralelismo]

Skill fino mais workflow empacotado, sem subagents aninhados:

```
skills/roadmap-release/
  SKILL.md                     lê o roadmap, valida a configuração, chama Workflow
  workflow/roadmap-release.js  orquestração determinística
  references/config.md         contrato de release.config.json
  references/operator.md       ações do operador e retomada
```

- O `SKILL.md` instrui chamar a ferramenta `Workflow` com o script empacotado (invocar o skill conta como autorização do usuário para o workflow).
- O script deriva do `.claude/workflows/roadmap-release.js` do `udv-center`, removendo tudo o que é do projeto.
- Cada tarefa é um `agent()` direto. **Não** chama o `plan-coordinator` por dentro: as travas de recursos compartilhados só valem na camada que enxerga todos os agentes, e DAG, rollback e comparação de gates precisam ser código, não instrução.
- Worktrees são criadas pelo próprio script com `git worktree add`, a partir da última ponta validada (`lastGood`).

## 5. Fluxo

1. **Descoberta (somente leitura):** config, cards, painel, bloqueios, "não fazer" e estado do git na branch alvo.
2. **Seleção:** `next` (padrão), `ready`, `all` ou lista de IDs; filtros por fase, prioridade e trilha; ordem topológica; ciclo é erro; card vetado pelo "não fazer" fica de fora.
3. **Preflight:** alvo e worktree de integração, ambiente medido (`envFacts`, colado em todo briefing) e baseline de todos os gates.
4. **Por entrega, em paralelo até `maxParallel` (padrão 3):** worktree, spec autônoma com revisão, plano com seção de evidência dos critérios e revisão, tarefas (implementador, revisão de spec, revisão de qualidade), sincronização, integridade dos testes, revisão final em opus, gates na branch, evidência de cada critério.
5. **Merge serializado:** re-sincroniza, mescla com `--no-ff`, revisa conflitos, roda gates pós-merge, faz rollback conferido por SHA se falhar, depois docs e `roadmap-tracker`.
6. **Relatório:** verdade do git, tabela por entrega, ações do operador, riscos aceitos, decisões a ratificar e `resumeArgs`.

Modos: `run`, `plan-only`, `dry-run`.

## 6. Comportamento decidido

**Interrupções.** O workflow nunca pergunta. [dono] Quando algo só um humano resolve, ele para aquela entrega, ou o run se o preflight falhar, e devolve `operatorActions` com `resumeArgs`. Tipos de falha: `infra`, `conteudo`, `decisao`, `humano`.

**Permissões.** [dono] Antes de iniciar um `run`, o skill confere se as regras de permissão cobrem os comandos de gates, `install`, `setup`, `beforeEvidence` e git do run. Se faltar alguma, para uma única vez, antes de lançar qualquer agente, e mostra as regras exatas a adicionar. Nunca altera as configurações sozinho.

**Falha de uma entrega.** [recomendação] As independentes continuam, as dependentes ficam de fora. Novos merges param apenas se a branch de integração ficar comprometida (`integBroken`).

**Branch alvo.** [recomendação] `releaseBranch` da config, ou `integracao/<slug>`. Mesclar na `integrationBranch` exige `allowIntegrationBranch`. Push, nunca.

**Decisões autônomas.** [recomendação] Seguem a opção recomendada e entram no roadmap com Origin `executor` e status pendente; o relatório as reúne. Divergir de decisão registrada ou mudar gate para a entrega com falha `decisao`.

**Humano.** Credencial, aceite, go/no-go e sessão com usuários são atos humanos: o workflow produz os artefatos e nunca registra o aceite. Input bloqueia só se nenhuma parte útil do card puder ser entregue sem ele.

**Critérios.** Lê a tag `{verify: ...}` do card. Comandos de `test`, `smoke` e `integration` são executados na branch; `human` e `blocked` vão para `criteriaOpen`. Critério sem linha de evidência reprova o plano.

**Modelos.** [recomendação] Spec, plano e revisão final em opus; implementação e revisões por tarefa em sonnet; coleta e medições em haiku. Revisão final com esforço alto; entrega `critical` tem duas lentes.

## 7. Melhorias sobre o workflow atual [recomendação]

1. **Sincronização tardia:** quando outra entrega entra depois da última sincronização, refazer a evidência dos critérios e rodar uma revisão em opus só do delta trazido pela sincronização, mesmo sem conflito, dentro da trava de merge. Delta só de docs ou do roadmap dispensa a revisão. Revisar só o delta evita custo quadrático com o número de entregas. Fecha o caso em que a matriz de papéis da E4 não viu as RPCs da E8.
2. **Saída real para o revisor:** o script faz o implementador devolver comando, saída e exit code de cada verificação, e entrega isso ao revisor por tarefa. Elimina reprovações por falta de evidência.
3. **Escalonamento:** o achado que reaparece após correção sobe um tier em vez de falhar direto; falha em opus para a entrega.
4. **Tier por tarefa:** o plano declara o tier do implementador de cada tarefa, usando as regras de pontuação de `plan-coordinator/references/routing.md`. As revisões seguem a seção 6: sonnet por tarefa, medido no release, e opus apenas em tarefa com raio de impacto 2.
5. **Registro de revisões:** incluir rodada e modelo, em `docs/superpowers/reviews/`, e commitá-lo antes da medição final de gates.
6. **Resumos determinísticos:** o orquestrador do skill confere por `git` direto, no fim do run, o que os agentes declararam (`headSha`, merges, árvore limpa).

## 8. Configuração do projeto: `release.config.json` na pasta do roadmap

Tudo o que é específico do projeto sai do script. [recomendação] Campos:

- `projectContext`: texto com regras do projeto, colado nos briefings.
- `install`: comando de instalação do worktree.
- `setup` (opcional): comandos de preparo do ambiente no preflight, como subir serviços.
- `beforeEvidence` (opcional): comandos executados antes dos gates que dependem de estado, como recriar o banco.
- `gates`: lista de `{ name, cmd, kind, needsLock?, invariant?, ignoreFailuresWhenChanged? }`. `kind` é `exit` (só o código de saída importa, como lint e build) ou `tests` (um agente lê a saída e devolve `{ name, ran, exit, total, skipped, failedNames }`, sob o `validMeasure`). Baseline vermelho, que para o preflight: gate `exit` diferente de zero, gate `tests` com total zero ou invariante violado, salvo `acceptRedBaseline`. Sem baseline para `invariant`. Deriva de schema e política de migrations são invariantes do projeto. `ignoreFailuresWhenChanged` descreve exceções como o smoke que testa código antigo.
- `locks`: nomes dos recursos compartilhados; os gates e as tarefas `needsLock` os usam.
- `conflictRules`: como resolver conflitos em arquivos gerados.
- `docsStage` (opcional): instruções do passo de docs e um script fixo de medição.
- `testIntegrity` (opcional): script próprio ou `false`.

Se o arquivo não existir, o skill o gera a partir do bloco `gates` da estratégia e do `CLAUDE.md` do projeto, faz commit dele na branch alvo e segue, sem perguntar. Um arquivo gerado leva `generated: true`, e enquanto essa marca existir o run usa `maxParallel: 1`, porque um recurso compartilhado não detectado corromperia execuções paralelas; o relatório indica como revisar e liberar o paralelismo. Gate é verde quando as falhas por nome são subconjunto do baseline e as contagens não caem.

O `release.config.json` do `udv-center` (Supabase, RLS, Deno e migrations) é uma entrega posterior, fora da construção do skill.

**Critérios com tag.** O comando da tag é obrigatório: o plano pode acrescentar evidência, nunca substituir, e cria o teste que o comando referencia. Em cards antigos sem tag, valem as linhas de evidência do plano.

## 9. O que se preserva do script atual

Travas com ordem fixa, `validMeasure`, baseline por nome com piso de contagem, `TEST_INTEGRITY`, `reviewLoop` com categorias, retomada por commit `E<n> T<k>:` revendo a última tarefa, merge interrompido virando "validar e documentar", `sanitize` com patch salvo, rollback conferido e `integBroken`.

## 10. Verificação da entrega do skill

- Prova inicial: um workflow mínimo iniciado a partir do skill, com o script empacotado, confirma o caminho de chamada antes de portar o restante.
- Testes automatizados para a lógica pura: seleção e ordem, comparação de gates, `validMeasure`, retomada e slug.
- Repositório de exemplo descartável com roadmap de três entregas (uma falha de propósito) em `dry-run`, `plan-only` e `run`.
- Teste comportamental e revisão adversarial exigidos pelo repositório.

## 11. Deixado para quem construir

Organização interna do script, como compartilhar a lógica pura entre script e testes, redação final dos prompts, e nomes internos de funções e schemas.
