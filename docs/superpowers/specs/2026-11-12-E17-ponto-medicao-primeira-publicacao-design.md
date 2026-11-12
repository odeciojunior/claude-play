# E17 -- Ponto de medição e primeira publicação (desenho)

**Roadmap:** `docs/plans/roadmap-evolucao-skills/` (estratégia v1.5, `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, seção E17). REQs: REQ-002, REQ-034, REQ-044. Depende de E15 e E18. Crítico.

**Estado da execução (instrução do dono, 2026-11-12):** execução decidida pelo decisor delegado do dono (regra Fable); a sessão orquestradora roda em `bypassPermissions`, então segue sem as regras de Bash que faltavam. Spec e plano em `feat/E17` revisados, com as 12 decisões ratificadas (DEC-285 a DEC-299, emendas DEC-297, DEC-298 e DEC-299), reaproveitados sem reescrita. A Tarefa 7 (branch de volta) foi autorizada pelo dono em pessoa (E17:T7@3cd7b4c7). A correção `c7efe09` de `armMatches` (DEC-310) está em `feat/E17` depois da T6. Execuções pagas não são tarefas do workflow (DEC-297). Nunca push, nunca `main`.

## Por quê

E17 é a única publicação compatível do roadmap (DEC-015): leva o checker reforçado (E2), a CLI do tracker (E3) e o registro do release por ela (E18), além do que já está integrado na branch de release (E1, E4, E5, E6, E22, E25). O release nativo (E8), E7 e E19 só começam sobre a versão publicada (DEC-046). A publicação só sai se o ponto de medição não mostrar piora nos contadores nem queda na detecção (REQ-002, DEC-017), com tag e branch de volta ensaiada (REQ-034, DEC-036), e sem decisão do executor pendente (REQ-044, DEC-030).

Este é um entregável da trilha de medição: operado pelo dono, com o executor preparando (estratégia, "Execução deste roadmap"; DEC-011). As execuções pagas não rodam dentro do workflow do release: são tarefas do orquestrador da sessão principal ou do dono (DEC-204, DEC-088, DEC-011).

## Critérios de aceite (do card, literais)

<!-- roadmap:acceptance -->
1. Dado o cenário fixo, quando roda na branch de release, então a comparação com a linha de base está registrada por contadores e por custo, e o painel produzido pelo registro por CLI é o esperado. {verify: human; evidence: o dono confere as linhas de comparação em measurements.md}
2. Dada a comparação sem piora nos contadores, pela saída do comparador de E1, quando o dono publica, então a versão nova existe no cache do plugin e os entregáveis seguintes passam a rodar nela; custo inconclusivo não bloqueia (DEC-017). {verify: human; evidence: o dono avança main até a branch de release, dá push, atualiza o plugin e confere a pasta da versão no cache}
3. Dada a lista de decisões do executor pendentes, quando o dono publica, então nenhuma está pendente: cada uma foi ratificada ou substituída por decisão do dono. {verify: human; evidence: o dono responde à lista de ratificação e confere que decisions.md não tem linha de origem executor com status pendente}
4. Dada a publicação preparada, quando o executor monta a branch de volta, então ela parte da ponta da branch de release, o conteúdo do plugin difere da tag anterior só na versão, na linha 1 do checker e nas constantes do teste dela, e G1 a G5 passam nela. {verify: human; evidence: o dono confere o diff contra a tag e a saída dos gates registrada em docs/reports}
5. Dado o avanço de `main`, quando o dono publica, então a tag da versão anterior existe no remoto no commit que estava instalado, e esse commit está no log. {verify: human; evidence: o dono roda git ls-remote --tags origin e compara com o commit registrado}
6. Dada uma meta derivada cujo entregável já está integrado, quando o ponto de medição termina, então ela está marcada atingida ou não atingida em measurements.md; uma meta não atingida não bloqueia a publicação (DEC-034). {verify: human; evidence: o dono confere as linhas de meta em measurements.md}
<!-- /roadmap:acceptance -->

Definição de pronto (card): comparação registrada; G1 a G5 verdes na branch de release; versão publicada conferida pelo dono.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Deixar pronto, na branch `feat/E17`, tudo o que o executor pode entregar: o arnês de E1 apto a medir a versão 1.7.0 e a compará-la com a linha de base de E15, a versão nas duas posições de cada plugin alterado, a linha 1 do checker, a branch de volta ensaiada, a lista de ratificação e o roteiro do dono.
- Dar ao dono um roteiro com comandos completos para as execuções pagas, a ratificação e a publicação.

Não objetivos:

- Rodar execuções pagas dentro do workflow (DEC-204, DEC-088).
- Push, avanço de `main`, atualização da loja ou do plugin, envio de tag: atos do dono (DEC-007, DEC-014, DEC-036). Nenhuma tarefa do plano faz isso.
- Editar a pasta `docs/plans/roadmap-evolucao-skills/` nesta branch: o registro em `measurements.md`, `decisions.md` e no log é feito pelo tracker nos estágios de registro e docs, na branch de release, e a cópia do checker da pasta só é atualizada pelo tracker depois da publicação.
- A nota de atualização com a receita de fixar a loja numa tag (DEC-056 é de E11).
- Mudar limiares, regras ou unidades do comparador (DEC-033, DEC-081, DEC-089, DEC-279) ou qualquer gate canônico.

Anti-objetivos (falha mesmo se "funcionar"):

- Uma comparação que mede outra coisa que a linha de base: outro modo de permissão (DEC-280), outro modo de medição da classe plano (DEC-279), outra semeadura (DEC-278), outro cenário ou outra versão do superpowers sem registro.
- Medir um commit cujo conteúdo do plugin não é o que vai para `main`.
- Marcar uma meta como atingida sem o valor medido ao lado.

## Contexto medido (2026-11-12)

- `feat/E17` parte de `5030ce9`, que contém a ponta de `release/roadmap-skills-v2`.
- Versões hoje: `productivity-tools` 1.6.0, `marketplace-tools` 1.1.0 (em `plugin.json` e na tabela do `README.md`); linha 1 do checker `// check-roadmap 1.5.0 format 1`; seis asserções de versão em `check-roadmap.test.mjs`: três constantes `'1.5.0'` (linha 153, cabeçalho `// check-roadmap 1.5.0 format 1`; linha 155, `CHECKER_VERSION`; linha 1725, campo `checker` do JSON) e três sobre a saída de `--version`, `'1.5.0 format 1'` (linhas 421, 531 e 1783). O comentário de seção da linha 1104 (`// ---------- 1.5.0: ...`) é histórico e não é asserção. Na tag `productivity-tools--v1.6.0` o mesmo teste tem quatro asserções de versão (linhas 150, 152, 418 e 528); as das linhas 1725 e 1783 vieram depois. `CHECKER_VERSION` vem da linha 1 (`SELF_HEADER`), sem outra cópia.
- Fora do teste do checker há uma asserção da versão do plugin: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` linha 3294, no teste `E25 AC3: plugin.json registers the release workflow file`, `assert.equal(p.version, '1.6.0')`, que lê o `plugin.json` real; veio com E25 e já está na ponta da branch de release. Na tag `productivity-tools--v1.6.0` o `flow.test.mjs` não tem essa asserção. O `'1.6.0'` de `tools/measure/run-baseline.test.mjs` (linha 45) é o valor de um `readPlugin` simulado e não lê `plugin.json`; não muda com a versão.
- Tag anotada `productivity-tools--v1.6.0` (objeto `c098f8a`), já enviada ao remoto (`git ls-remote --tags origin` mostra `refs/tags/productivity-tools--v1.6.0^{}` em `3fbb59b`), apontando para `3fbb59b`, o commit da linha de base. Por ser anotada, toda comparação de commit usa `productivity-tools--v1.6.0^{commit}`. Nessa tag a linha 1 do checker é 1.5.0.
- Nenhuma decisão de origem executor está pendente em `decisions.md` na branch de release (contagem 0). As decisões deste spec nascem pendentes.
- `tools/measure/run-baseline.mjs` recusa rodar se o `gitCommitSha` do plugin em `<config-dir>/plugins/installed_plugins.json` não for o commit de `--tag` (padrão `productivity-tools--v1.6.0`); `--tag` aceita qualquer ref que `git rev-parse <ref>^{commit}` resolva, inclusive uma SHA.
- `tools/measure/compare.mjs` compara dois agregados de uma mesma variante; `baseline.json` de E15 guarda um agregado por variante (`variants`) e por classe consolidada (`classes`, DEC-089).
- Os braços do arnês de estágio (`tools/measure/arms/*-atual.md`) foram copiados do workflow em `3fbb59b`; uma sondagem por prefixo mostrou o texto de plan-review, plan-fix, spec-review e spec-fix presente também no workflow da ponta atual. A conferência exata fica para o plano (peça 1).
- `tools/measure/make-scenario.mjs` grava no sandbox as regras `SANDBOX_RELEASE_RULES` (`Bash(node:*)`, `Bash(git:*)`, `Workflow`, `Workflow(productivity-tools:roadmap-release)`), porque o preflight só lê regras de arquivos de configuração (achado 5 de E15). O preflight 1.7.0 acrescenta `Bash(node *roadmap.mjs" *)` (DEC-211, DEC-212) e o nome `productivity-tools:release-workflow` (E25).
- O lint atual (`lint-plugin.mjs`) sobre o conteúdo do plugin na tag 1.6.0 sai com 0 FAIL.

## Desenho

### Peça 1 -- ponto de medição (executor prepara; execuções pagas são do dono)

**O que se mede.** O commit `M` = o commit de versão da peça 2 (a ponta de `feat/E17` no instante desse commit), identificado pela SHA completa que o roteiro grava logo depois dele. Commits posteriores em `feat/E17` (`gates.md`, `volta.md`, `roteiro.md`, `ratificacao.md`, relatórios) não mudam `M`: só tocam `docs/reports/`, e a conferência de árvore abaixo garante que o plugin não mudou. Como `feat/E17` contém a ponta da branch de release e é integrada nela, o conteúdo de `plugins/productivity-tools` em `M` é o que vai para `main`. O roteiro grava a árvore `git rev-parse M:plugins/productivity-tools`; antes de publicar, o dono confere que a mesma expressão na ponta de `release/roadmap-skills-v2` dá o mesmo hash. Se diferir (outro merge entrou), a comparação não vale para essa ponta e as variantes afetadas são medidas de novo.

**Como a versão da branch é carregada nas execuções pagas: cache instalado, não loja local por pasta.** O dono cria uma pasta de configuração descartável `<config-dir>` (usada como `CLAUDE_CONFIG_DIR` e passada a `--config-dir`), sem tocar a configuração real (DEC-298, emenda a DEC-285). A pasta fica fora do repositório e de qualquer worktree. Paridade com a linha de base: E15 mediu na configuração real `~/.claude` (`CLAUDE.md` global com a política de roteamento de modelos, `settings.json`, hooks e plugins), então a pasta descartável recebe uma cópia do `CLAUDE.md` e do `settings.json` reais, nunca arquivos de credencial; o dono entra na conta nela uma vez (a mesma entrada serve ao roteiro B de E25). A diferença entre o conjunto de plugins instalado nela e o da configuração real é registrada no relatório. Ao fim, o dono sai da conta e a pasta é apagada. Nela:

1. adiciona a loja `claude-play` como fonte git local apontando para o repositório, fixada em `M` e não no nome da branch (na forma que DEC-056 viu funcionar com fonte git local: o ref na declaração da loja e o comando de adicionar repetido com o ref). O ref é a SHA de `M`; se a CLI não aceitar SHA como ref, o dono cria antes uma tag local leve `e17-medicao` em `M` (`git tag e17-medicao <M>`, nunca enviada) e fixa a loja nela. Fixar em `feat/E17` está proibido: os commits de relatório das etapas 3 e 4 da Ordem entram nessa branch antes das execuções pagas (etapa 5), e o `gitCommitSha` instalado seria a ponta posterior, não `M`;
2. instala `productivity-tools@claude-play` e o superpowers 7.0.0 (a mesma versão da linha de base). A CLI não instala plugin por número de versão: a loja do superpowers é fixada no commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` (o `superpowers.commit` de `baseline.json` de E15); se a fixação não for aceita ou o `gitCommitSha` instalado do superpowers diferir, o dono para e registra (categoria ambiente);
3. confere em `<config-dir>/plugins/installed_plugins.json` a versão `1.7.0` e `gitCommitSha` igual à SHA de `M`, e que `<config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0/` existe.

Com a loja fixada em `M`, o `--tag` de `run-baseline.mjs` e de `baseline.mjs` é a SHA de `M` (ou `e17-medicao`, que resolve para ela); a conferência atual do arnês (`readPlugin().commit` igual a `resolveTag(--tag)`) passa sem mudança e o commit instalado é o mesmo commit registrado. O arnês não ganha modo que aceite outro commit. Se o dono reinstalar a partir de outro ref, refaz os passos 1 a 3.

Razões: a linha de base de E15 mediu o plugin instalado do cache, e `run-baseline.mjs` confere o commit instalado; a loja por pasta (`claude plugin marketplace add <pasta>`) não garante `gitCommitSha`, e carregar do caminho local mediria outro modo de carga. A mesma `<config-dir>` serve ao roteiro B de E25 (cache em `CLAUDE_CONFIG_DIR` descartável), que o dono roda antes da publicação. Se a CLI não gravar `gitCommitSha` para a fonte git local, o dono para e registra o achado (categoria ambiente); o arnês não ganha um modo que pule a conferência.

**Condições iguais à linha de base.** Modo `bypassPermissions` em todas as variantes (DEC-280); classe plano pelo arnês de estágio `--stage plan-review --arm atual` (DEC-279); classe código pelo pipeline; semeadura da execução aprovada arquivada em `docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1/` (DEC-278), passada a `--from-run` por uma árvore montada a partir dela; mesmas contagens de execuções (DEC-033); mesmo cenário fixo de E1; `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (achado 6, já no lançador). O planner (E4) e a skill enxuta do tracker (E22) estão integrados e entram na comparação, só por contadores (DEC-016).

**Trabalho do executor em `tools/measure/` (repo-only, não publicado):**

1. **Regras do sandbox para o 1.7.0.** Acrescentar a `SANDBOX_RELEASE_RULES` as regras que o preflight 1.7.0 lista como ausentes para o sandbox do cenário (no mínimo `Bash(node *roadmap.mjs" *)` e `Workflow(productivity-tools:release-workflow)`), mantendo as atuais. O conjunto é fixado pela saída real do preflight: um teste roda `preflight.mjs` sobre um sandbox de `make-sandbox.mjs` com o `settings.local.json` que `make-scenario` grava e exige `missingRules` vazio e `errors` vazio. Regras extras são inertes em `bypassPermissions` e só servem ao preflight (achado 5); não mudam contador.
2. **Semeadura a partir do arquivo de E15.** `--from-run` exige uma árvore com o spec e o plano de E5. O roteiro monta essa árvore numa pasta descartável a partir dos dois arquivos de `semeadura-completo-1/` (mesmos sha256 `7b9cc139…` e `ea14b7ab…`, conferidos antes); se o pré-check atual de `run-baseline.mjs` exigir mais que os dois arquivos, o plano acrescenta o mínimo para aceitar essa árvore, com teste, sem mudar a semeadura.
3. **Painel do registro por CLI (critério 1, segunda parte).** `run-batch.mjs` passa a gravar em cada tentativa das variantes do release (`plan-only`, `completo`, `parada-retomada`) o campo `panel`: a linha de E5 do painel do sandbox lida pela CLI do plugin medido (`roadmap.mjs status --json` na branch alvo do sandbox) e o resultado do checker sobre a pasta do sandbox. O valor esperado por variante fica numa tabela no código (status de E5 no vocabulário da pasta do sandbox depois de cada variante, evidência citando o commit de merge presente em `release/sandbox` quando a variante integra, zero erros do checker). Campo novo e opcional: agregados antigos sem ele continuam válidos e `compare.mjs` o ignora.
4. **Conferência do braço.** Antes de comparar a classe plano, conferir que o texto de `plan-review-atual.md` e `plan-fix-atual.md` (sem a linha "Copied from" e com os marcadores `{{…}}` tratados como lacunas) aparece byte a byte em `roadmap-release.js` no commit `M`, com duas exceções fixadas por DEC-310 (correção `c7efe09` em `armMatches`, em `feat/E17` depois da T6): o fim de linha final do braço é ignorado e a barra de escape antes de `|` é removida nos dois textos (o fonte JS tem `\\|`, o prompt em execução `\|`, o braço `|`). O braço `plan-fix-atual.md` não é corrigido, por ser o instrumento das execuções de E15, e a linha de base da classe plano continua válida. Se aparecer, o braço `atual` mede o prompt do 1.7.0 e o modo é o mesmo da linha de base; se não, a classe sai `inconclusivo (braço defasado)` e o dono decide (inconclusivo bloqueia até o dono liberar, DEC-081).
5. **Ferramenta do ponto de medição: `tools/measure/checkpoint.mjs`.** Uso: `node tools/measure/checkpoint.mjs --before <baseline.json> --after <baseline.json> --dest <dir> [--date AAAA-MM-DD] [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]`. Para cada variante presente nos dois lados chama `compare()` de `compare.mjs` sobre `variants[v]`, e para cada classe consolidada sobre `classes[c]` (DEC-089); acrescenta custo mediano e faixa antes e depois (registrado, nunca bloqueia, DEC-017); confere o painel (item 3) e o braço (item 4); calcula as metas (item 6). Grava `comparacao.json` e `comparacao.md` com: a tabela por variante e contador (antes, depois, veredito), a detecção por classe, o custo, o painel, as metas, e a seção "Linhas para roadmap:measurements" pronta para o tracker. Saída 0 sem bloqueio, 1 com bloqueio (qualquer `bloqueia` do comparador ou painel diferente do esperado), 2 erro de uso ou entrada de outro modo de permissão (DEC-280). Não muda nenhum limiar: é um laço sobre o comparador de E1. Fica para E11, E16 e E13.
6. **Metas (critério 6).** Pela tabela de metas da estratégia v1.4 (DEC-281), as metas conferidas em E17 são as de entregáveis já integrados: E4 (prosa carregável do planner, bytes LF, ≤ 43.335) e E22 (prosa do tracker por evento, bytes LF, ≤ 29.096). As de E23, E12 e E10 são conferidas em E13 e ficam "não aplicável neste ponto". `checkpoint.mjs` mede as duas no commit `M` com as mesmas definições dos testes de orçamento de prosa (E4: soma LF de `SKILL.md`, `references/clarify.md`, `references/decompose.md` e `references/model.md` do planner; E22: carga do evento de maior carga por DEC-234), num módulo próprio em `tools/measure/` que não importa arquivos `*.test.mjs`; um teste exige que os valores medidos na ponta coincidam com os que os dois testes de orçamento aceitam (≤ meta) e com a definição de DEC-234. Cada meta sai `atingida` ou `não atingida` com o valor medido; não atingida não bloqueia (DEC-034). Se um arquivo da definição não existe no commit lido (em `3fbb59b` o planner não tem `references/model.md`, o `prose-budget.test.mjs` não existe e o tracker não tem `references/events/`), a meta sai `não medida`, sem valor, e não bloqueia.

**Tarefas de execução paga (orquestrador ou dono, fora do workflow).** O roteiro (`docs/reports/2026-11-12-e17-ponto-de-medicao/roteiro.md`) traz, com `<...>` nas pastas que o dono escolhe e nenhum caminho pessoal:

1. preparar `<config-dir>` como acima e conferir versão, commit e cache;
2. `node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode bypassPermissions --tag <SHA de M> --allow … --add-dir <pasta da versão no cache> --dry-run`, depois sem `--dry-run`, depois com `--from-run <árvore da semeadura>`;
3. `node tools/measure/baseline.mjs --out <out> --dest <dest> --tag <SHA de M>`;
4. `node tools/measure/checkpoint.mjs --before docs/reports/2026-11-11-e15-linha-de-base/baseline.json --after <dest>/baseline.json --dest docs/reports/2026-11-12-e17-ponto-de-medicao/`;
5. commitar `comparacao.md`, `comparacao.json` e o `baseline.json` depois (renomeado `medicao-1.7.0.json`) na pasta do relatório; nunca `tools/measure/out/`. As execuções pagas rodam depois do merge de `feat/E17` na branch de release (DEC-297, emenda a DEC-296): os resultados entram por um commit só de `docs/reports/` em `feat/E17` e um novo merge na branch de release, antes da publicação.

**Portão.** `checkpoint.mjs` saindo 1 = não publicar: o dono abre um bloqueio no entregável responsável (risco do card). Aumento de bytes de prompt acima de 3% pode ser liberado pelo dono com decisão registrada (DEC-033). Custo inconclusivo não bloqueia (DEC-017). Uma variante inválida por `sem-agentes` no release (por exemplo, se o comando digitado em `claude -p` deixar de carregar a skill com `disable-model-invocation: true`, gatilho de DEC-275) é achado do ponto de medição e segura a publicação até o dono decidir.

### Peça 2 -- preparação da publicação (executor, em `feat/E17`)

Um commit `chore(release): productivity-tools 1.7.0 e marketplace-tools 1.2.0` com:

- `plugins/productivity-tools/.claude-plugin/plugin.json`: `1.7.0` (DEC-028);
- `plugins/marketplace-tools/.claude-plugin/plugin.json`: `1.2.0` (o lint mudou em E25; minor seguinte);
- `README.md`: as duas linhas da tabela com as versões novas;
- `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` linha 1: `// check-roadmap 1.7.0 format 1` (DEC-042; o formato da pasta continua 1);
- `check-roadmap.test.mjs`: as seis asserções de versão passam a 1.7.0 -- as três constantes `'1.5.0'` (linhas 153, 155 e 1725) a `'1.7.0'` (a da linha 153 vira `'// check-roadmap 1.7.0 format 1'`) e as três da saída de `--version` (linhas 421, 531 e 1783) de `'1.5.0 format 1'` a `'1.7.0 format 1'`. Antes do commit, `grep -n "1.5.0" check-roadmap.test.mjs` só pode mostrar o comentário de seção da linha 1104; com uma asserção esquecida, G1 falha.
- `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` linha 3294 (teste `E25 AC3: plugin.json registers the release workflow file`): `assert.equal(p.version, '1.6.0')` passa a `'1.7.0'`. Antes do commit, `grep -rn "'1.6.0'" plugins/productivity-tools` não pode mostrar nenhuma linha; sem essa troca, G1 falha no commit de versão.

Nada mais muda nesse commit. `formats.md` continua com "since 1.5.0" (histórico) e o exemplo de JSON fica como está. Depois do commit, G1 a G5 rodam em `feat/E17` e a saída de cada um (comando, código de saída, resumo) fica em `docs/reports/2026-11-12-e17-ponto-de-medicao/gates.md`. A pasta de roadmap não é tocada (a cópia do checker dela só muda pelo tracker, depois da publicação).

### Peça 3 -- publicação (somente passos do dono)

Nenhuma tarefa do plano executa estes passos; o plano os entrega como seção do roteiro, na ordem:

1. Pré-condições: comparação sem bloqueio (ou liberação registrada); nenhuma decisão do executor pendente (peça 4); roteiros A e B de E25 rodados (pendentes do dono em `state.md`); nenhum entregável deste roadmap em execução; árvore do plugin na ponta da branch de release igual à de `M`; branch de volta pronta (peça 5).
2. Anotar o commit hoje instalado do `productivity-tools` (`installed_plugins.json` da configuração real) e conferir que é o commit da tag, `git rev-parse productivity-tools--v1.6.0^{commit}` (`3fbb59b`).
3. Conferir a tag no remoto (DEC-036): ela já foi enviada, então o passo é só `git ls-remote --tags origin productivity-tools--v1.6.0` e conferir que a linha `refs/tags/productivity-tools--v1.6.0^{}` mostra o commit do passo 2. Se faltar ou apontar para outro commit, o dono não força nem reenvia: registra e decide.
4. Avançar `main` até `release/roadmap-skills-v2` (fast-forward ou merge), `git push origin main`.
5. `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `claude plugin update marketplace-tools@claude-play`, `/reload-plugins`.
6. Conferir `~/.claude/plugins/cache/claude-play/productivity-tools/1.7.0/` e `…/marketplace-tools/1.2.0/`, e anotar o commit instalado novo.
7. Pedir ao tracker o registro: linhas de comparação e de metas em `measurements.md`, a publicação e os dois commits (o anterior, com a tag, e o novo) no log, E17 no painel, e depois a atualização da cópia do checker da pasta.

### Peça 4 -- ratificação em lote (executor prepara; dono decide)

Hoje não há decisão do executor pendente na branch de release, então a condição "antes da preparação" do card vale para as decisões anteriores a E17. As que E17 cria (as deste spec e as do plano e da execução) são ratificadas pelo dono numa passada antes da publicação, nunca com execução em andamento (estratégia, "Ratificação das decisões do executor").

O executor gera `docs/reports/2026-11-12-e17-ponto-de-medicao/ratificacao.md` a partir de `node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs pending-decisions docs/plans/roadmap-evolucao-skills --json` rodado em `feat/E17`, mais as decisões deste spec, com uma linha por decisão: id, alcance, custo se errada, o que já foi construído em cima e resposta recomendada. As respostas do dono são gravadas pelo tracker (`ratify` / `reject`, com `--amend` para emendas, DEC-200) na branch de release, nos estágios de registro e docs. O critério 3 é conferido pelo mesmo comando, que deve devolver lista vazia.

### Peça 5 -- branch de volta (executor, Tarefa 7 externa do plano, autorizada pelo dono em pessoa; DEC-299, emenda a DEC-294)

- Nome: `volta/productivity-tools-1.7.1`, local, nunca enviada ao remoto (DEC-036).
- Ponto de partida: `M` (a ponta de `feat/E17`, cujo conteúdo é a ponta da branch de release após a integração; a conferência de árvore da peça 1 vale aqui também). Montada numa árvore descartável em `D:/projects/claude-play-wt/_tmp/E17/volta`, removida ao fim; a branch fica.
- Conteúdo: `plugins/productivity-tools/` igual ao da tag `productivity-tools--v1.6.0` (arquivos novos depois da tag removidos), versão `1.7.1` em `plugin.json` e na linha da tabela do `README.md` (DEC-028: a volta leva o patch seguinte), linha 1 do checker `// check-roadmap 1.7.1 format 1` e todas as asserções de versão do teste dela em 1.7.1 (DEC-042). Como o teste volta ao da tag, as asserções são as da tag, não as seis da ponta: na tag são quatro -- linha 150 (`'// check-roadmap 1.5.0 format 1'`), linha 152 (`CHECKER_VERSION`, `'1.5.0'`), linhas 418 e 528 (saída de `--version`, `'1.5.0 format 1'`) --, que passam a `'// check-roadmap 1.7.1 format 1'`, `'1.7.1'` e `'1.7.1 format 1'`. As asserções das linhas 1725 e 1783 da ponta pertencem a testes que não existem na tag. O `flow.test.mjs` volta ao da tag, que não tem a asserção de versão do `plugin.json`; nada a mudar nele na volta. O plano refaz a contagem com `git show productivity-tools--v1.6.0:<teste> | grep -n "1.5.0"` (só o comentário de seção da linha 1101 fica) e a volta muda todas as asserções que ela listar. `marketplace-tools` fica em 1.2.0 com o conteúdo de `M` (o lint atual sobre o conteúdo da tag dá 0 FAIL).
- Fora dos plugins: um arquivo repo-only (`tools/`, `.claude/`) cujo teste falha em G1 só porque importa código do plugin que não existe ou mudou na tag volta ao estado da tag (removido se não existia), com a lista no relatório. Falha de G1 dentro de outro plugin não é contornada: fica registrada e o critério 4 fica não atendido, com item pendente para o dono.
- Conferência: `git diff productivity-tools--v1.6.0 volta/productivity-tools-1.7.1 -- plugins/productivity-tools` mostra só `plugin.json` (versão), a linha 1 do checker e as quatro linhas de asserção de versão do teste dela (150, 152, 418 e 528 na numeração da tag), nada mais; G1 a G5 rodam na árvore da volta. Diff e saídas vão para `docs/reports/2026-11-12-e17-ponto-de-medicao/volta.md`, commitado em `feat/E17`.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `tools/measure/make-scenario.mjs` (+ teste) | regras do sandbox para o preflight 1.7.0 |
| `tools/measure/run-batch.mjs` (+ teste) | campo `panel` por tentativa do release |
| `tools/measure/run-baseline.mjs` (+ teste) | só se o pré-check de `--from-run` precisar aceitar a árvore montada da semeadura arquivada |
| `tools/measure/checkpoint.mjs`, `tools/measure/prose-goals.mjs` (+ testes) | novos: ponto de medição e metas de prosa |
| `plugins/productivity-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md` | versões |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`, `check-roadmap.test.mjs` | linha 1 e constantes |
| `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | asserção da versão do `plugin.json` (linha 3294) de 1.6.0 a 1.7.0, no commit de versão |
| `docs/reports/2026-11-12-e17-ponto-de-medicao/` | `roteiro.md`, `gates.md`, `ratificacao.md`, `volta.md`; depois das execuções pagas, `comparacao.md`, `comparacao.json`, `medicao-1.7.0.json` |

Todos os testes novos ficam sob `tools/**/*.test.mjs` ou nos arquivos de teste existentes, cobertos por G1 sem mudar o comando.

### Ordem

1. Arnês (itens 1 a 6 da peça 1), com testes, G1 verde.
2. Commit de versão (peça 2) e gates.
3. Branch de volta (peça 5).
4. Roteiro e lista de ratificação (peças 1, 3, 4).
5. Execuções pagas e `checkpoint.mjs` (orquestrador ou dono), depois do merge de `feat/E17` na branch de release; relatório por commit só de `docs/reports/` em `feat/E17` e novo merge na branch de release, antes da publicação (DEC-297).

O merge na branch de release, a ratificação e a publicação ficam fora das tarefas do plano; nenhuma tarefa depende do merge, da branch alvo ou da worktree de integração.

## Casos de borda

- A ponta da branch de release recebe outro merge entre a medição e a publicação: a árvore do plugin difere de `M`, a comparação e a branch de volta são refeitas sobre a ponta nova.
- O superpowers instalado na `<config-dir>` não é 7.0.0: registrar a versão; uma diferença torna a comparação das variantes afetadas inconclusiva até o dono decidir (risco de E15 sobre mudança de modelo e dependência).
- Modelos mudam entre E15 e E17: registrados por linha; a variante afetada é repetida (risco de E15).
- `checkpoint.mjs` recebe um lado em outro modo de permissão ou com a classe plano em outro modo: sai 2 / inconclusivo, sem veredito.
- Uma decisão do executor criada depois da lista de ratificação: a lista é gerada de novo antes da passada do dono.
- A tag `productivity-tools--v1.6.0` já existe no remoto num commit diferente: o dono não força; registra e decide.

## Autonomous decisions (reviewable by the owner)

1. A versão medida carrega do cache instalado numa `CLAUDE_CONFIG_DIR` descartável, com a loja como fonte git local fixada na SHA de `M` (ou na tag local leve `e17-medicao` em `M`, nunca enviada, se a CLI não aceitar SHA), nunca no nome da branch `feat/E17`, e `--tag` é essa SHA, e não de uma loja por pasta nem por `--plugin-dir`; sem `gitCommitSha` gravado, o dono para e registra. Base: E15 mediu do cache e `run-baseline.mjs` confere o commit; custo se errada: refazer a preparação da pasta de configuração; reversível. Alcance: contrato. Ratificada com emenda do dono (DEC-298): "Medição pelo cache instalado numa CLAUDE_CONFIG_DIR descartável, loja git local fixada na SHA de M; o dono entra na conta ali uma vez (serve também ao roteiro B de E25); a pasta recebe cópia do CLAUDE.md e settings.json reais, sem credencial; diferença de plugins registrada."
2. O commit medido `M` é o commit de versão da peça 2, fixado pela SHA; commits posteriores de relatório em `feat/E17` não o mudam, e a validade para a branch de release é dada pela igualdade da árvore `plugins/productivity-tools`; outra árvore na ponta exige medir de novo. Base: regra de que nenhuma tarefa depende do merge; custo se errada: medição sem valor para a publicação; reversível. Alcance: local.
3. `tools/measure/checkpoint.mjs` é a ferramenta do ponto de medição (um laço sobre `compare()` de E1, sem limiar novo), reutilizada por E11, E16 e E13, com saída `comparacao.json` e `comparacao.md`. Base: o card pede a comparação "pela saída do comparador de E1"; custo se errada: reescrever a ferramenta antes de E11; reversível. Alcance: contrato.
4. As regras do sandbox são as que o preflight 1.7.0 aponta como ausentes, fixadas por teste, somadas às atuais. Base: achado 5 de E15 e DEC-211; custo se errada: execuções paradas no preflight, contadas como inválidas; reversível. Alcance: local.
5. O painel esperado (critério 1) é conferido por campo novo `panel` por tentativa e tabela de valores esperados em código, e um painel diferente bloqueia a publicação no `checkpoint.mjs`. Base: o critério exige "o painel ... é o esperado"; custo se errada: falso bloqueio ou falsa aprovação do registro; reversível. Alcance: contrato.
6. A classe plano continua no braço `atual` copiado de `3fbb59b` quando seu texto aparece byte a byte no workflow de `M` (salvo o fim de linha final do braço e a barra de escape antes de `|`, DEC-310); caso contrário, a classe sai inconclusiva e o dono decide. Base: DEC-279; custo se errada: detecção de plano medida com prompt diferente do publicado; reversível. Alcance: local.
7. Metas conferidas em E17 são só as de E4 e E22 (entregáveis integrados com "Conferida em E17"), medidas por `tools/measure/prose-goals.mjs` com as definições dos testes de orçamento, sem importar arquivos de teste. Base: tabela de metas v1.4 (DEC-281) e DEC-034; custo se errada: meta marcada com valor de outra definição; reversível. Alcance: local.
8. `marketplace-tools` vai a 1.2.0 (minor seguinte, o lint mudou em E25), sem atualizar `formats.md` ("since 1.5.0" e o exemplo de JSON ficam). Base: instrução do dono e DEC-042; custo se errada: um commit de correção de documentação; reversível. Alcance: local.
9. A ratificação das decisões anteriores a E17 está satisfeita (nenhuma pendente); as de E17 são ratificadas pelo dono antes da publicação, a partir de `ratificacao.md` gerado pela CLI. Base: DEC-030 e REQ-044; custo se errada: publicação retida até a passada; reversível. Alcance: local.
10. A branch de volta `volta/productivity-tools-1.7.1` parte de `M`, é montada numa árvore descartável por tarefa do orquestrador fora do workflow, nunca é enviada, devolve só `plugins/productivity-tools` à tag e mantém `marketplace-tools` em 1.2.0; arquivos repo-only acoplados ao plugin novo voltam ao estado da tag. Base: DEC-036, DEC-028, DEC-042; custo se errada: volta que não publica limpo, descoberta antes de ser necessária; reversível. Alcance: contrato. Ratificada com emenda do dono (DEC-299): "A branch de volta volta/productivity-tools-1.7.1 parte de M e é a Tarefa 7 externa do plano, autorizada pelo dono em pessoa; nunca enviada; devolve só plugins/productivity-tools à tag e mantém marketplace-tools 1.2.0; repo-only acoplado ao plugin volta ao estado da tag."
11. A publicação (avanço de `main`, push, envio da tag, atualização da loja e do plugin, conferência do cache) existe só como passos do dono no roteiro; nenhuma tarefa do plano a executa. Base: DEC-007, DEC-014, instrução do dono; custo se errada: nenhum; reversível. Alcance: local.
12. As execuções pagas são tarefas do orquestrador ou do dono, fora do workflow, e os resultados (`comparacao.*`, `medicao-1.7.0.json`) são commitados em `feat/E17` antes do merge. Base: DEC-204, DEC-088, DEC-011; custo se errada: relatório entrando por outro caminho; reversível. Alcance: local. Ratificada com emenda do dono (DEC-297): "Execuções pagas são tarefas do orquestrador ou do dono, fora do workflow, depois do merge de feat/E17; os resultados (comparacao.*, medicao-1.7.0.json) entram por commit só de docs/reports em feat/E17 e novo merge na release, antes da publicação."

## Depende de entrada humana

1. **Execuções pagas do ponto de medição** (dono ou orquestrador com autorização do dono; gasto em dinheiro): critérios 1 e 6 e o portão do critério 2 dependem delas. Não bloqueia: o arnês, a versão, a branch de volta, o roteiro e a lista de ratificação são entregues sem elas; os relatórios de comparação ficam marcados como pendentes.
2. **Ratificação em lote das decisões do executor** (critério 3). Não bloqueia: `ratificacao.md` é entregue com respostas recomendadas.
3. **Publicação** (critérios 2 e 5): conferência da tag `productivity-tools--v1.6.0` no remoto (já enviada), avanço e push de `main`, atualização da loja e do plugin, conferência do cache e registro dos commits. Não bloqueia: os passos ficam no roteiro.
4. **Aceite da branch de volta** (critério 4): o dono confere o diff contra a tag e a saída dos gates em `volta.md`. Não bloqueia.
5. **Roteiros A e B de E25** antes da publicação (pendentes do dono em `state.md`); o roteiro B pode usar a mesma `<config-dir>`. Não bloqueia a preparação; é pré-condição da publicação.
6. **Liberação de um aumento de bytes acima de 3%** ou de uma classe inconclusiva, se `checkpoint.mjs` acusar (DEC-033, DEC-081). Condicional; não bloqueia a preparação.
