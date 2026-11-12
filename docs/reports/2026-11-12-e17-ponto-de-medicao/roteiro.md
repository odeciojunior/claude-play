# E17: roteiro do dono

Data: 2026-11-12. Branch de origem: `feat/E17`. Este roteiro reúne os passos que o executor não faz: execuções pagas, ratificação e publicação. Nenhum passo daqui foi executado pelo workflow.

- `M` (commit de versão, SHA completa): `e38cb355de668a334193bd46d783d6f0e6313d5f`
- Árvore do plugin em `M` (`git rev-parse M:plugins/productivity-tools`): `214fb3b50c164094e5eb1c6e18344d7b0bc62e3c`
- Pastas que você escolhe: `<config-dir>` (configuração descartável), `<work>` (sandboxes), `<out>` (agregados), `<dest>` (cópia dos agregados), `<árvore-da-semeadura>`, `<repo>` (este repositório), `<alvo>` (cópia somente leitura do roadmap). Nenhuma delas fica dentro do repositório nem de uma worktree; `tools/measure/out/` nunca é commitado.
- Comandos em Git Bash; em PowerShell troque `VAR=valor comando` por `$env:VAR='valor'; comando`.

## Execuções pagas (orquestrador ou dono, fora do workflow)

Rodam depois do merge de `feat/E17` na branch de release (DEC-297). Gastam dinheiro: só com a sua decisão (DEC-204, DEC-088, DEC-011). Modo `bypassPermissions` em todas as variantes (DEC-280).

### 1. Preparar `<config-dir>`

A pasta é usada como `CLAUDE_CONFIG_DIR` e como `--config-dir`, fica fora do repositório e de qualquer worktree, e não toca a configuração real (DEC-298). Paridade com E15: a linha de base mediu na configuração real, então a pasta recebe uma cópia do `CLAUDE.md` e do `settings.json` reais. Nunca copie arquivos de credencial.

```bash
mkdir <config-dir>
cp ~/.claude/CLAUDE.md <config-dir>/CLAUDE.md
cp ~/.claude/settings.json <config-dir>/settings.json
```

1. Entre na conta em `<config-dir>` uma vez: `CLAUDE_CONFIG_DIR=<config-dir> claude` e use o login da própria sessão. A mesma entrada serve ao roteiro B de E25.
2. Fixe a loja `claude-play` em `M`, nunca no nome da branch (fixar na branch faria o `gitCommitSha` instalado ser a ponta posterior, não `M`). Fonte git local do repositório, com o ref na declaração da loja nas configurações de `<config-dir>` e o comando de adicionar repetido com o ref (DEC-056):
   ```bash
   CLAUDE_CONFIG_DIR=<config-dir> claude plugin marketplace add "<repo>#e38cb355de668a334193bd46d783d6f0e6313d5f"
   ```
   Se a CLI não aceitar SHA como ref, crie antes a tag local leve (nunca enviada) e fixe a loja nela:
   ```bash
   git -C <repo> tag e17-medicao e38cb355de668a334193bd46d783d6f0e6313d5f
   CLAUDE_CONFIG_DIR=<config-dir> claude plugin marketplace add "<repo>#e17-medicao"
   ```
3. Instale o plugin medido e o superpowers 7.0.0 (a mesma versão da linha de base). A CLI não instala por número de versão: fixe a loja do superpowers no commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` (o `superpowers.commit` de `baseline.json` de E15), com o mesmo procedimento de ref do item 2. Se a fixação não for aceita ou o `gitCommitSha` instalado do superpowers diferir, pare e registre (categoria ambiente); com outro superpowers a comparação das variantes afetadas fica inconclusiva até você decidir.
   ```bash
   CLAUDE_CONFIG_DIR=<config-dir> claude plugin install productivity-tools@claude-play
   CLAUDE_CONFIG_DIR=<config-dir> claude plugin install superpowers@<loja-do-superpowers>
   ```
4. Confira em `<config-dir>/plugins/installed_plugins.json` a versão `1.7.0` e o `gitCommitSha` igual a `e38cb355de668a334193bd46d783d6f0e6313d5f`, e que a pasta `<config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0/` existe. Se o `gitCommitSha` faltar, pare e registre o achado (categoria ambiente): o arnês não ganha modo que pule a conferência.
5. Registre no relatório a diferença entre o conjunto de plugins instalado em `<config-dir>` e o da configuração real.

### 2. Montar a árvore da semeadura

A semeadura é a da execução aprovada arquivada (DEC-278). Confira os dois sha256 antes de passar a árvore a `--from-run`.

```bash
mkdir -p <árvore-da-semeadura>/docs/superpowers/specs <árvore-da-semeadura>/docs/superpowers/plans
cp docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1/2026-11-12-E5-text-utilities-design.md <árvore-da-semeadura>/docs/superpowers/specs/
cp docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1/2026-11-12-E5-text-utilities.md <árvore-da-semeadura>/docs/superpowers/plans/
sha256sum <árvore-da-semeadura>/docs/superpowers/specs/2026-11-12-E5-text-utilities-design.md   # esperado 7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93
sha256sum <árvore-da-semeadura>/docs/superpowers/plans/2026-11-12-E5-text-utilities.md          # esperado ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912
```

### 3. Rodar as medições

Primeiro `--dry-run`, depois sem, depois com `--from-run`. A classe plano roda pelo arnês de estágio (`--stage plan-review --arm atual`, DEC-279) e a classe código pelo pipeline; o conjunto de `--allow` é `SANDBOX_RELEASE_RULES` de `tools/measure/make-scenario.mjs`, na mesma ordem. `--add-dir` é a pasta da versão no cache. `<SHA de M>` é `e38cb355de668a334193bd46d783d6f0e6313d5f` (ou `e17-medicao`, que resolve para ela); a conferência do arnês (commit instalado igual ao de `--tag`) passa sem mudança.

```bash
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode bypassPermissions --tag <SHA de M> --allow "Bash(node:*)" --allow "Bash(git:*)" --allow "Workflow" --allow "Workflow(productivity-tools:roadmap-release)" --allow "Workflow(productivity-tools:release-workflow)" --allow "Bash(node *roadmap.mjs" *)" --add-dir <config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0 --dry-run
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode bypassPermissions --tag <SHA de M> --allow "Bash(node:*)" --allow "Bash(git:*)" --allow "Workflow" --allow "Workflow(productivity-tools:roadmap-release)" --allow "Workflow(productivity-tools:release-workflow)" --allow "Bash(node *roadmap.mjs" *)" --add-dir <config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode bypassPermissions --tag <SHA de M> --allow "Bash(node:*)" --allow "Bash(git:*)" --allow "Workflow" --allow "Workflow(productivity-tools:roadmap-release)" --allow "Workflow(productivity-tools:release-workflow)" --allow "Bash(node *roadmap.mjs" *)" --add-dir <config-dir>/plugins/cache/claude-play/productivity-tools/1.7.0 --from-run <árvore-da-semeadura>
```

Em Git Bash a regra `Bash(node *roadmap.mjs" *)` tem aspas internas: passe-a entre aspas simples (`--allow 'Bash(node *roadmap.mjs" *)'`) se o shell dividir o argumento.

### 4. Agregar e comparar

```bash
node tools/measure/baseline.mjs --out <out> --dest <dest> --tag <SHA de M>
node tools/measure/checkpoint.mjs --before docs/reports/2026-11-11-e15-linha-de-base/baseline.json --after <dest>/baseline.json --dest docs/reports/2026-11-12-e17-ponto-de-medicao/
```

`checkpoint.mjs` sai 0 sem bloqueio, 1 com bloqueio e 2 em erro de uso ou lado em outro modo de permissão (DEC-280).

### 5. Registrar o resultado

Commit só de `docs/reports/` em `feat/E17` com `comparacao.md`, `comparacao.json` e `<dest>/baseline.json` renomeado `medicao-1.7.0.json`, nunca `tools/measure/out/`. Depois, novo merge de `feat/E17` na branch de release, antes da publicação (DEC-297).

```bash
cp <dest>/baseline.json docs/reports/2026-11-12-e17-ponto-de-medicao/medicao-1.7.0.json
git add docs/reports/2026-11-12-e17-ponto-de-medicao/comparacao.md docs/reports/2026-11-12-e17-ponto-de-medicao/comparacao.json docs/reports/2026-11-12-e17-ponto-de-medicao/medicao-1.7.0.json
```

### 6. Portão

- `checkpoint.mjs` saindo 1 = não publicar: abra um bloqueio no entregável responsável.
- Aumento de bytes de prompt acima de 3% pode ser liberado com decisão registrada (DEC-033).
- Custo inconclusivo não bloqueia (DEC-017). Meta não atingida não bloqueia (DEC-034).
- Variante inválida por `sem-agentes` no release (por exemplo, o comando digitado em `claude -p` deixar de carregar a skill com `disable-model-invocation: true`, gatilho de DEC-275) é achado do ponto de medição e segura a publicação até você decidir.
- Classe plano `inconclusivo (braço defasado)` bloqueia até você liberar (DEC-081).

Casos de borda: superpowers diferente de 7.0.0, ou modelos mudados entre E15 e E17, tornam a variante afetada inconclusiva ou pedem repetição (registre por linha). Se a ponta da branch de release tiver outra árvore em `plugins/productivity-tools` que a de `M` (outro merge entrou), a comparação e a branch de volta são refeitas sobre a ponta nova.

### 7. Limpeza

Ao fim, você sai da conta em `<config-dir>` (`CLAUDE_CONFIG_DIR=<config-dir> claude` e o logout da sessão) e só então apaga a pasta `<config-dir>`; remova também `<work>` e `<árvore-da-semeadura>`. A tag local `e17-medicao`, se criada, pode ser apagada com `git tag -d e17-medicao` e nunca é enviada.

## Publicação (somente o dono)

Nenhuma tarefa do plano executa estes passos (DEC-007, DEC-014, DEC-036). Faça na ordem.

1. Pré-condições: comparação sem bloqueio (ou liberação registrada); nenhuma decisão do executor pendente (seção Ratificação); roteiros A e B de E25 rodados (pendentes em `state.md`); nenhum entregável do roadmap em execução; branch de volta `volta/productivity-tools-1.7.1` pronta (aceite de `volta.md` e `gates.md`); árvore do plugin na ponta da branch de release igual à de `M`:
   ```bash
   git rev-parse release/roadmap-skills-v2:plugins/productivity-tools   # esperado 214fb3b50c164094e5eb1c6e18344d7b0bc62e3c
   ```
   Se diferir, a comparação não vale para essa ponta: meça de novo as variantes afetadas e refaça a volta.
2. Anote o commit hoje instalado do `productivity-tools` (campo `gitCommitSha` em `~/.claude/plugins/installed_plugins.json`, configuração real) e confira que é o commit da tag:
   ```bash
   git rev-parse productivity-tools--v1.6.0^{commit}   # 3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a
   ```
3. Confira a tag no remoto (DEC-036). Ela já foi enviada, então o passo é só a conferência, sem `git push` da tag:
   ```bash
   git ls-remote --tags origin productivity-tools--v1.6.0
   ```
   A linha `refs/tags/productivity-tools--v1.6.0^{}` deve mostrar o commit do passo 2. Se faltar ou apontar para outro commit, o dono não força nem reenvia: registra e decide.
4. Avance `main` até `release/roadmap-skills-v2` (fast-forward ou merge) e envie:
   ```bash
   git checkout main
   git merge --ff-only release/roadmap-skills-v2
   git push origin main
   ```
5. Atualize a loja e os plugins:
   ```bash
   claude plugin marketplace update claude-play
   claude plugin update productivity-tools@claude-play
   claude plugin update marketplace-tools@claude-play
   ```
   e no Claude Code `/reload-plugins` (ou reinicie).
6. Confira as pastas novas e anote o commit instalado novo:
   ```bash
   ls ~/.claude/plugins/cache/claude-play/productivity-tools/1.7.0/
   ls ~/.claude/plugins/cache/claude-play/marketplace-tools/1.2.0/
   ```
7. Peça ao tracker o registro: linhas de comparação e de metas em `measurements.md`, a publicação e os dois commits (o anterior, com a tag, e o novo) no log, E17 no painel e, depois, a atualização da cópia do checker da pasta.

## Ratificação

Responda a `ratificacao.md`, que traz uma linha por decisão do executor pendente com a resposta recomendada (ratificar). O tracker grava as respostas na branch de release, nos estágios de registro e docs: `ratify` para aceitar, `reject` para rejeitar e `--amend` para ratificar com emenda (DEC-200).

Critério 3: com a passada feita e nenhuma execução em andamento, rode sobre a ponta de `release/roadmap-skills-v2`, no instante da publicação, e confira que a lista volta vazia:

```bash
roadmap.mjs pending-decisions docs/plans/roadmap-evolucao-skills --json
```

Rode na worktree de integração (que tem `docs/plans/roadmap-evolucao-skills`) ou repita a cópia somente leitura, sem checkout da branch alvo:

```bash
mkdir -p <alvo>
git archive release/roadmap-skills-v2 docs/plans/2026-11-10-roadmap-evolucao-skills.md docs/plans/roadmap-evolucao-skills | tar -x -C <alvo>
node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs pending-decisions <alvo>/docs/plans/roadmap-evolucao-skills --json
```

O arquivo de estratégia vai junto na cópia porque `roadmap.config.json` aponta para ele um nível acima da pasta; sem ele o tracker sai 2 (`usage`, ENOENT). Se a SHA da ponta de `release/roadmap-skills-v2` for diferente da gravada em `ratificacao.md`, a lista é gerada de novo pela mesma cópia antes da passada, nunca pela pasta de `feat/E17` (ela vem da base de merge e não tem as linhas de E17).
