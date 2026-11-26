# Spec E54 -- Publicação da 2.7.0

Entregável E54 do roadmap `docs/plans/roadmap-pos-2-6-0` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, card E54, fase "2.7.0 medida e publicada"), o último do caminho crítico, depois do E53. Cobre REQ-026. Decisões que regem: DEC-003 (uma publicação com dois plugins, bump só no E54, um branch `volta/` por plugin), DEC-020 (release em `release/pos-2.6.0`, no worktree `D:/projects/claude-play-wt/pos-2-6-0`), DEC-004 e DEC-021 (alcance contrato e escalações vão ao delegado opus). Push, tag, avanço de `main` e comentário ou fecho de issue exigem autorização explícita do próprio dono (`CLAUDE.md`, "Publish an update"; pendência externa da estratégia), que o delegado não concede, embora a DEC-004 liste push e tag entre o que volta ao delegado (R7). Também regem: DEC-017 e DEC-039 (lote do E53), DEC-008, DEC-014 e DEC-019 (issues fora do escopo), DEC-036 e DEC-037 (G1). Regem ainda a DEC-042 do pós-2.3.0, citada em `.claude/rules/roadmap-checker.md` (a linha 1 do `check-roadmap.mjs` sobe junto com a versão do plugin, na preparação da publicação), e as seções "Rules that matter", "Publish an update" e "Windows" do `CLAUDE.md` da raiz. Precedente: o roteiro do E40 do pós-2.3.0 (`docs/reports/2026-11-25-E40-roteiro-publicacao.md`), que não teve spec própria.

Código e refs lidos em `release/pos-2.6.0` (`c8e2841`). O candidato do E53 é `d4ac4ee`, revisado pela T3 sem bloqueantes (`docs/reports/2026-11-26-E53-revisao-final.md`). O lote pago ainda não rodou. Hoje `main` e `origin/main` estão em `fb371ab` e são ancestrais da release. A última tag é `productivity-tools--v2.6.0` (`b443374`), e o marketplace-tools nunca teve tag. As versões atuais são productivity-tools 2.6.0 e marketplace-tools 1.3.0, e a linha 1 do checker diz `// check-roadmap 1.7.0 format 1`.

Esta spec é só o documento. Ela não faz bump, branch, merge, push, tag, atualização de cache nem comentário no GitHub.

## Intenção

Levar aos usuários do marketplace as correções das issues #1 a #29 que ficaram no escopo. O E54 publica productivity-tools 2.7.0 e marketplace-tools 1.4.0 (o próximo minor de 1.3.0, DEC-003), com bump nos dois lugares. Cada plugin ganha um branch de volta conferido. Push e tag acontecem só depois da autorização explícita do dono, e a publicação termina com as pastas novas conferidas no cache. Depois disso, e com uma segunda autorização, as issues resolvidas são comentadas e fechadas.

## Escopo

Dentro:

- **Entrada.** Conferir que o E53 fechou, ou que o dono decidiu publicar com fecho parcial (H1).
- **Bump na `release/pos-2.6.0`**, no worktree dela, em um commit:
  - `plugins/productivity-tools/.claude-plugin/plugin.json` passa a 2.7.0, e `plugins/marketplace-tools/.claude-plugin/plugin.json` passa a 1.4.0;
  - as duas linhas da tabela do `README.md` e a frase "What changed" do `README.md`;
  - a asserção de versão em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs:4084`;
  - a linha 1 de `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`, que passa a `// check-roadmap 2.7.0 format 1`;
  - as asserções de versão de `check-roadmap.test.mjs` nas linhas 153, 155, 428, 538, 1756 e 1814, que passam a 2.7.0, e o cache de teste das linhas 474 e 477, que passa de 1.9.0 para uma versão acima de 2.7.0 (por exemplo 2.9.0, na chamada e no `assert.match`).
- **Notas de release:** `docs/releases/<data>-productivity-tools-2.7.0.md` e `docs/releases/<data>-marketplace-tools-1.4.0.md`.
- **Conferência da R8 do E53** contra o bump (R1) e registro do delegado opus.
- **Dois branches de volta:** `volta/productivity-tools-2.7.1` e `volta/marketplace-tools-1.4.1` (R2), cada um no seu worktree fora do repositório, com G1 a G4 verdes.
- **G1 a G5 na ponta da release** e o roteiro de publicação em `docs/reports/<data>-E54-roteiro-publicacao.md`, gravado pelo orquestrador.
- **Com a autorização A (H2):** fast-forward de `main`, as tags `productivity-tools--v2.7.0` e `marketplace-tools--v1.4.0` (R3), push de `main`, das duas tags e dos dois branches de volta, atualização local e conferência do cache (R4), fecho do tracker e um segundo push só de docs.
- **Com a autorização B (H3):** comentário e fecho das issues resolvidas (R6).
- **Limpeza da config descartável do E53**, adiada pelo E53 para depois da publicação ("como no E40").

Fora:

- Corrigir código de produto. Qualquer mudança em `plugins/` além do bump invalida o lote do E53 (R8 do E53) e volta ao delegado opus.
- Mudar o `format <n>` do checker. A publicação não traz migração (`.claude/rules/roadmap-checker.md`).
- Atualizar à mão as cópias vendorizadas do checker em `docs/plans/roadmap-*/`. A cópia de `docs/plans/roadmap-pos-2-6-0/` é atualizada pelo passo 2 do roadmap-tracker na primeira execução depois do bump, e a pasta fechada do pós-2.3.0 não é tocada.
- Apagar os worktrees e branches `plan/pos-2-6-0-E*`, e as pastas de saída do lote (`D:/claude-e53-out`), que ficam como evidência.
- As issues #13, #15, #16 e #20, que já foram comentadas e seguem abertas (DEC-008, DEC-019), e as #24 e #27, já fechadas.

O que não fazer:

- Não começar nada (bump, volta, notas) antes da condição de entrada.
- Não rodar `git checkout`, `switch` ou `reset` em `D:/projects/claude-play`. Esse checkout está em `release/pos-2.3.0` e é compartilhado com outras sessões. Use `git -C <worktree>` e refs explícitas.
- Não fazer push, tag, fast-forward de `main`, comentário ou fecho de issue sem o "sim" do dono no pedido correspondente. Não usar `--force` em nada.
- Não ler, imprimir nem registrar credenciais. O push usa o gerenciador de credenciais do git já configurado. O orquestrador não roda `env`, `printenv` nem `set`.
- Não montar caminhos Windows com `\` pela linha de comando (`CLAUDE.md`, seção Windows).

## Desenho

### Condição de entrada e fecho parcial do E53

O E54 começa quando o painel de `state.md` mostra o E53 fechado. Isso exige que o log registre o AC1 e o AC2 do E53 aceitos e que exista em `decisions.md` a DEC dos limites, vigente e com o candidato citado. O executor confere isso lendo os arquivos e não escolhe nada aqui.

Se o E53 parar sem fechar, o caso é uma pergunta ao dono (H1), nunca uma escolha do executor nem do delegado. São exemplos o lote sem autorização, menos de 2 válidas ou um `parar` do `lote-gate.mjs` não resolvido. A resposta só vale como DEC com Origem exatamente `dono`, Entregável `E54` e o estado do E53 descrito. Com o "sim", a nota de release diz que os limites de parada-retomada continuam os provisórios da decisão 060 do pós-2.3.0 e que a base nova não foi medida (ou foi medida só em parte). A pendência do lote fica em `state.md`. Sem a DEC, o E54 espera.

### Bump e conflito com a R8 do E53 (AC1)

**Arquivos que mudam no commit de bump.** O commit `chore(release): productivity-tools 2.7.0 e marketplace-tools 1.4.0` muda exatamente:

- os dois `plugin.json`: só a linha `"version"`;
- o `README.md`: as linhas 26 e 29 da tabela, e a frase "What changed" com os links das duas notas novas;
- `flow.test.mjs:4084`: passa a `'2.7.0'`;
- a linha 1 de `check-roadmap.mjs`;
- `check-roadmap.test.mjs`: as asserções de versão das linhas 153, 155, 428, 538, 1756 e 1814 passam a `2.7.0`. O cache de teste das linhas 474 e 477 passa de `1.9.0` para uma versão acima de 2.7.0 (por exemplo `2.9.0`, na chamada `cacheWith` e no `assert.match`). Sem isso, o teste de `checker-stale` deixaria de ver uma versão mais nova. A linha 1831 (`since 1.7.0`) fala de `formats.md` e não muda.

O `.claude-plugin/marketplace.json` não tem `version` e não muda. O precedente da 1.7.0 (`e38cb35`) mudou 6 e 6 linhas nesse teste; aqui são 8 e 8. O plano confirma o conjunto rodando `node --test` nesse arquivo depois do bump e antes de pedir a DEC do delegado, e só esse diff exato vai ao delegado.

**Por que a linha 1 do checker sobe.** O conteúdo do checker mudou no E46 (aviso `status-no-code`, commit `43bb22f`). A pendência de `state.md` e a seção "Para a publicação" do relatório da T3 pedem a subida. Sem ela, as pastas de roadmap existentes nunca recebem o checker novo, porque o tracker compara `CHECKER_VERSION` com a cópia da pasta (`roadmap.mjs:733-734`, `:1001`).

**O conflito.** A R8 da spec do E53 diz que só não invalidam o lote, entre o candidato e a tag, o bump de versão em manifests e `README.md` e as mudanças em `lote-gate.mjs` e no teste dele. Três dos arquivos do bump ficam em `plugins/` e não estão nessa lista: `check-roadmap.mjs`, `check-roadmap.test.mjs` e `flow.test.mjs`. O `check-roadmap.mjs` ainda entra na árvore medida, porque `make-sandbox.mjs:434` copia o checker do plugin para a pasta de roadmap do sandbox.

**A decisão (R1).** A mudança é tratada como parte do bump e não invalida o lote. Isso vale só se a conferência mecânica abaixo der exatamente o conjunto permitido, e só depois do registro do delegado opus, que a R8 manda para esses casos. O argumento técnico:

- no sandbox, a versão do tracker (`CHECKER_VERSION`, lida da linha 1 do checker do plugin) e a da cópia da pasta vêm do mesmo arquivo, então são iguais antes e depois do bump, e o tracker segue em `up-to-date`;
- os dois testes não são carregados na execução medida.

**Conferência, sem script novo.** Rode `git -C D:/projects/claude-play-wt/pos-2-6-0 diff --numstat d4ac4ee <ponta> -- plugins/ tools/measure/`. A saída tem de listar só estes arquivos, cada um com as contagens indicadas:

| Arquivo | Linhas adicionadas e removidas |
|---|---|
| os dois `plugin.json` | 1 e 1 |
| `flow.test.mjs` | 1 e 1 |
| `check-roadmap.mjs` | 1 e 1 |
| `check-roadmap.test.mjs` | 8 e 8 |
| `tools/measure/lote-gate.mjs` e o teste dele | qualquer contagem (exceção da R8) |

`git diff -U0` mostra as linhas para o registro. A conferência roda duas vezes: antes do pedido A, e de novo logo antes da tag, com `<ponta>` igual ao commit que vai ser marcado. Qualquer outro arquivo, ou outra contagem, faz parar: o lote fica inválido pela R8 do E53, nada é publicado e o caso vai ao delegado opus.

**Registro do delegado.** Antes do pedido A, o delegado opus recebe a saída das duas formas do diff e o argumento técnico. O tracker registra a resposta como DEC (Entregável `E54`, Origem `dono (delegado, opus)`, alcance local, com o texto citando a R8 da spec do E53, que ela excetua). Se o delegado recusar, a saída recomendada é publicar com a linha 1 em `1.7.0` e o teste do checker intacto, deixando uma pendência para a publicação seguinte. Essa saída contraria a regra do `CLAUDE.md` e de `.claude/rules/roadmap-checker.md` (DEC-042 do pós-2.3.0), então vai explícita ao dono no pedido A. Nesse caso, o comentário da #1 diz onde o aviso `status-no-code` aparece (pelo checker do plugin) e onde não aparece (nas cópias vendorizadas, que o tracker não atualiza). A outra saída, repetir o lote num candidato novo, é decisão de gasto do dono (DEC-004). Depois do passo 4, um lote repetido no candidato veria `checker-stale`, porque `check-roadmap.mjs:1264` consulta o cache real (`~/.claude/plugins/cache`), que já teria a 2.7.0.

**Formato do checker.** O `format 1` continua: não há receita de migração (`.claude/rules/roadmap-checker.md`).

**Notas (R5).** São duas, em `docs/releases/`, no padrão em português das anteriores:

- **productivity-tools 2.7.0:** as issues corrigidas, por entregável; os limites novos da DEC dos limites do E53, ou o fecho parcial (H1); e as dívidas aceitas que tocam o usuário, a partir das pendências "fora do escopo" de `state.md` e dos achados aceitos da T3;
- **marketplace-tools 1.4.0:** o FAIL novo do lint para `commands/` e para as chaves `commands` ou `skills` no `plugin.json` (DEC-013, DEC-024, #29).

**Prova do AC1.** Na ponta da release, depois do bump:

- `claude plugin validate .`, `claude plugin validate plugins/productivity-tools` e `claude plugin validate plugins/marketplace-tools`;
- os lints G2 e G3 sem FAIL;
- G5 com os 4 alvos de `.claude/rules/workflows-and-lib.md`, porque o checker é um deles;
- G1 completo, sem a exclusão do gate de onda da DEC-036. Uma falha isolada do teste de processos segue a DEC-037. O piso é 2826 testes, a contagem do merge do `lote-gate` registrada no log, e o bump não acrescenta nem remove testes.

Os números entram no roteiro e no log.

### Branches de volta (R2)

Cada branch de volta nasce da ponta da release já com o bump, num worktree próprio fora do repositório, por exemplo `D:/claude-e54-volta-pt` e `D:/claude-e54-volta-mt`, criados com `git worktree add -b`. Nele, só a árvore do plugin volta ao estado publicado antes:

- **`volta/productivity-tools-2.7.1`:**
  - `git restore --source=productivity-tools--v2.6.0 --staged --worktree -- plugins/productivity-tools tools/measure`. O `tools/measure` vai junto porque os testes dele usam scripts do plugin; ele não é publicado. Isso desfaz as correções do arnês das issues #21, #22, #23 e #26 e apaga o `lote-gate.mjs` no branch de volta;
  - `plugin.json` em 2.7.1, a linha 26 do `README.md` em 2.7.1 e `flow.test.mjs` com `'2.7.1'`;
  - o checker restaurado já volta com a linha 1 `1.7.0` e o teste dele com `1.7.0`, coerentes entre si.
- **`volta/marketplace-tools-1.4.1`:**
  - `git restore --source=fb371ab --staged --worktree -- plugins/marketplace-tools`. Esse é o conteúdo da 1.3.0 publicada, sem mudança desde `e45ecc5`;
  - `plugin.json` em 1.4.1 e a linha 29 do `README.md` em 1.4.1.

**Conferência mecânica de cada volta**, depois do commit e antes dos portões:

- `git diff --numstat productivity-tools--v2.6.0 volta/productivity-tools-2.7.1 -- plugins/productivity-tools tools/measure` lista só o `plugin.json` e o `flow.test.mjs`, cada um com 1 e 1 (a asserção está em `flow.test.mjs:3916` na tag);
- `git diff --numstat fb371ab volta/marketplace-tools-1.4.1 -- plugins/marketplace-tools` lista só o `plugin.json`, com 1 e 1.

Uma correção de teste feita depois no branch de volta (C4) entra nessa lista e é citada no roteiro.

**Portões.** G1 a G4 rodam em cada branch de volta, mais G5 no da productivity-tools.

- Uma falha só de teste do ambiente, como o CRLF da worktree nova visto no E40, é corrigida no próprio branch de volta, com um commit de teste.
- Uma falha de produto, ou de teste que dependa de outro plugin, faz parar e vai ao delegado opus.

**Por que essa base.** Com ela, voltar um plugin não volta o outro.

**Como se volta.** O fast-forward de `main` até o branch de volta só vale enquanto `main` é ancestral dele, isto é, enquanto ninguém commitou em `main` depois da base do branch. Nesta ordem, o roteiro é commitado na release depois que os branches de volta nascem, e o fecho do passo 6 também entra em `main`, então na prática o fast-forward deixa de valer já no passo 1. A volta é sempre `git merge --no-ff volta/<plugin>-<patch>` em `main`, sem reescrever histórico; o fast-forward é usado só quando `git merge-base --is-ancestor main volta/<...>` confirmar que ainda é possível.

Antes da volta, `git diff --name-only main...volta/<...>` (três pontos, a partir da base comum) tem de mostrar só a árvore do plugin, o `README.md` e, na productivity-tools, `tools/measure`, mais uma eventual correção de teste citada no roteiro. O diff de dois pontos (`main volta/<...>`) mostraria também os docs que entraram em `main` depois da base (o roteiro e o fecho do tracker). O merge mantém esses docs e não os reverte. A volta é ato do dono, com um novo "sim".

### Roteiro e autorização A (push e tag)

**O roteiro.** O orquestrador grava `docs/reports/<data>-E54-roteiro-publicacao.md` (subagentes não gravam arquivos com nome de relatório) e o commita na release. O roteiro traz:

- a tabela de estado: `origin/main` e `git ls-remote origin refs/heads/main` (só leitura), `main` local, a ponta da release e o `tree` dela, `git merge-base --is-ancestor main <ponta>`, as tags no remoto (`git ls-remote --tags origin`, só leitura) e as versões;
- o efeito de cada volta: a da productivity-tools também volta `tools/measure`, o que desfaz as correções das issues #21, #22, #23 e #26 e apaga o `lote-gate.mjs`, e os comentários do pedido B deixariam de valer para as issues afetadas;
- se o delegado recusou a R1, a publicação com a linha 1 em `1.7.0`, explícita, como algo que contraria a regra do `CLAUDE.md`;
- a saída da conferência da R1 e a DEC do delegado;
- o fecho do E53, ou a DEC de H1;
- os portões da release e dos dois branches de volta, com os números;
- o diff de produto `main..<ponta>` em `plugins/` e `README.md`, resumido por entregável;
- os comandos exatos abaixo, com a volta de cada um.

**O pedido.** O dono recebe esse roteiro num pedido só (H2), como no E40. Com o "sim", os passos rodam nesta ordem. Antes de cada um, o executor confere que nada mudou desde o roteiro: `main` local e `git ls-remote origin refs/heads/main` ainda em `fb371ab` (ou no valor do roteiro), e a ponta ainda igual. Essa conferência do remoto repete-se logo antes de cada push (passos 3 e 6). Se algo mudou, para e volta ao dono.

| # | Passo | Volta (rollback) |
|---|---|---|
| 1 | Antes, `git worktree list` confere que nenhum worktree tem `main` em checkout. Depois, `git -C D:/projects/claude-play fetch . release/pos-2.6.0:main` (só fast-forward; recusa se não for). | Antes do push: `git update-ref refs/heads/main <sha antigo> <sha novo>`, local. |
| 2 | `git -C D:/projects/claude-play-wt/pos-2-6-0 tag -a productivity-tools--v2.7.0 main -m "productivity-tools 2.7.0"` e `git -C D:/projects/claude-play-wt/pos-2-6-0 tag -a marketplace-tools--v1.4.0 main -m "marketplace-tools 1.4.0"`, logo depois da segunda conferência da R1 com `<ponta>` = `main`. | Antes do push: `git tag -d <tag>`. |
| 3 | `git -C D:/projects/claude-play push origin main productivity-tools--v2.7.0 marketplace-tools--v1.4.0 volta/productivity-tools-2.7.1 volta/marketplace-tools-1.4.1`, sem `--force`. Push recusado em parte: parar, sem repetir com outra forma. | Depois do push não se reescreve `main`. Seguir adiante numa 2.7.x, ou publicar o branch de volta do plugin afetado: `git merge --no-ff volta/<plugin>-<patch>` em `main` (fast-forward só se `main` ainda for ancestral dele), depois da conferência `main...volta` da R2, com tag `<plugin>--v<patch>` e push, ato do dono com novo "sim". Apagar uma tag remota (`git push origin :refs/tags/<tag>`) só com pedido explícito do dono. |
| 4 | Na config real: `claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play` e `/reload-plugins` (ou reinício). | Publicar o branch de volta pelo merge do passo 3 e repetir o update; a pasta 2.6.0 antiga fica 14 dias, mas não se depura contra ela. |
| 5 | Conferir o cache (R4) e `git ls-remote --tags origin`. | Só leitura. |
| 6 | Fecho do tracker na release, depois fast-forward de `main` e um segundo push só de `main`. O fecho registra a publicação, E42 a E54 publicados, o refresh do checker vendorizado pelo passo 2 do tracker, os branches de volta em inflight e o log com os SHAs. Se `git diff --name-only <main publicado> <ponta nova>` tocar `plugins/`, `tools/` ou `README.md`, parar e voltar ao dono. | Igual aos passos 1 e 3, só com docs. |

**Resposta parcial.** Se o dono autorizar só parte dos passos, roda apenas a parte autorizada, e o resto fica como pendência do dono em `state.md`.

### Conferência do cache (AC2, R4)

**productivity-tools.** Está instalado na config real (`~/.claude/plugins/cache/claude-play/productivity-tools/` vai até `2.6.0`). Depois do passo 4, o executor confere que a pasta `2.7.0/` existe e que o `plugin.json` dela diz 2.7.0. O dono faz a mesma conferência, que é a evidência do AC2.

**marketplace-tools.** Não está instalado na config real: não existe `cache/claude-play/marketplace-tools/`. A pasta 1.4.0 é conferida numa config descartável nova, por exemplo `D:/claude-e54-cfg`, criada com `CLAUDE_CONFIG_DIR` na mesma linha de cada comando:

1. `claude plugin marketplace add` do repositório no GitHub;
2. `claude plugin install marketplace-tools@claude-play`;
3. conferência de `D:/claude-e54-cfg/plugins/cache/claude-play/marketplace-tools/1.4.0/`.

Nada é instalado na config real. Se o CLI pedir login para esses comandos, o executor não loga: leva ao dono, que pode fazer a conferência na própria config. A config é apagada depois da conferência.

**Se a pasta não aparecer.** Não repetir às cegas. O executor confere o clone do marketplace (o `marketplace.json` e o `plugin.json` na versão nova) e leva o estado ao dono.

### Issues e autorização B (R6)

Depois do passo 5, o roteiro ganha uma seção com o texto exato de cada comentário. Cada texto cita a versão, a tag e o entregável, e a lista de issues sai de `requirements.md`:

- **Fecham como resolvidas:** #1 a #12, #14, #17, #18, #19, #21, #22, #23, #25, #26, #28 e #29.
- **#8:** fecha se o E49 estiver integrado, como hoje. Se não estiver, recebe só um comentário com a causa mitigada (DEC-018).
- **#25:** fecha com o resumo da DEC dos limites, ou fica aberta com um comentário se o fecho do E53 foi parcial (H1).
- **#21, #22, #23 e #26** (arnês `tools/measure`, não publicado): o comentário diz que a correção está em `main` e não num pacote.

O dono recebe a lista e os textos num pedido separado (H3). Com o "sim", o executor roda `gh issue comment` e depois `gh issue close`, uma issue por vez, e registra no log a URL de cada uma. A volta é `gh issue reopen <n>` e um comentário de correção, também com autorização do dono. Um comentário errado o dono pode editar ou apagar. Sem o "sim", nada é comentado, e a pendência fica com o dono em `state.md`.

### Limpeza do E53

Depois do passo 5 e sem custo, seguindo o adiamento do E53 e o E40:

1. Logout de `D:/claude-e53-cfg` por uma sessão interativa delegada a um subagente opus (regra do dono de 2026-11-12), conferido por `claude auth status` na mesma config.
2. Só então, apagar a config, o worktree `D:/claude-e53-cand` (com `git worktree remove`) e as pastas `D:/claude-e53-work*`.

`D:/claude-e53-out` fica como evidência do `measurements.md`.

## Para o plano

- Texto exato do roteiro e dos dois pedidos ao dono (A e B), com a tabela de estado preenchida no momento do pedido.
- Texto das duas notas de release, a partir de `state.md`, do relatório da T3, da DEC dos limites do E53 e das specs de E42 a E52.
- Texto de cada comentário de issue, e a confirmação, no momento, de que o E49 segue integrado para a #8.
- Caminhos finais dos worktrees de volta e da config descartável da R4, e a forma exata do `claude plugin marketplace add` (origem do GitHub) lida do `--help` da versão instalada.
- Ordem dos commits na release: bump; notas; roteiro. A segunda conferência da R1 usa a ponta final.
- Tarefas com efeito externo e de registro ficam com o orquestrador, em série; nenhuma vai a coordinator.

```json data
{
  "schema": "spec/1",
  "id": "E54",
  "title": "Publicação da 2.7.0",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o bump, quando a validação roda, então os manifests e o README trazem as versões novas e passam no validate e no lint. {verify: test; evidence: claude plugin validate .}"
    },
    {
      "id": "AC2",
      "text": "Dada a publicação, quando o marketplace é atualizado, então a pasta da versão nova existe no cache local. {verify: human; evidence: dono, conferência em ~/.claude/plugins/cache/claude-play/}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "A subida da linha 1 do check-roadmap.mjs (com as asserções de versão em check-roadmap.test.mjs e flow.test.mjs) invalida o lote do E53, se a R8 da spec do E53 só excetua manifests, README e lote-gate?",
      "decision": "Tratar como parte do bump, sem invalidar o lote, só se git diff --numstat d4ac4ee <ponta> -- plugins/ tools/measure/ listar exatamente: os dois plugin.json, flow.test.mjs e check-roadmap.mjs com 1/1; check-roadmap.test.mjs com 8/8 (asserções das linhas 153, 155, 428, 538, 1756 e 1814 em 2.7.0, e o cache de teste das linhas 474 e 477 de 1.9.0 para uma versão acima de 2.7.0); e lote-gate.mjs e o teste dele. O plano confirma o conjunto com node --test nesse arquivo depois do bump, e só esse diff exato vai ao delegado. A conferência roda antes do pedido A e de novo logo antes da tag. Exige DEC do delegado opus antes do pedido A. Se o delegado recusar, publicar com a linha 1 em 1.7.0 vai explícito ao dono no pedido A. Qualquer outro arquivo ou contagem para a publicação. Esta decisão vai contra a letra da R8 da spec do E53 (ruling de spec, não DEC nem gate, por isso contradicts fica null), que só excetua manifests, README e lote-gate.",
      "basis": "Pela DEC-042 do pós-2.3.0, a linha 1 sobe junto com a versão na preparação da publicação. O conteúdo do checker mudou no E46 (43bb22f), e sem a subida as pastas de roadmap nunca recebem o checker novo (roadmap.mjs:733-734). No sandbox, make-sandbox.mjs:434 copia o checker do próprio plugin, então a versão do tracker e a da pasta são iguais antes e depois, e o tracker segue em up-to-date. Os testes não são carregados na execução medida.",
      "alternative": "Publicar com a linha 1 em 1.7.0 (contraria a DEC-042 do pós-2.3.0 e deixa as pastas sem o aviso status-no-code), ou repetir o lote num candidato novo com a linha já alterada (gasto novo, decisão do dono; depois do passo 4, um lote repetido no candidato antigo veria checker-stale, porque check-roadmap.mjs:1264 consulta o cache real).",
      "costIfWrong": "high",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "De que base nasce cada branch volta/ quando a publicação leva dois plugins?",
      "decision": "Da ponta da release já com o bump, restaurando só a árvore do plugin do estado publicado antes, com git restore --source --staged --worktree: plugins/productivity-tools e tools/measure de productivity-tools--v2.6.0, com a versão 2.7.1; plugins/marketplace-tools de fb371ab, com a versão 1.4.1. A conferência por git diff --numstat contra a origem restaurada lista só plugin.json e flow.test.mjs (productivity-tools) ou só plugin.json (marketplace-tools), com 1/1. Cada branch fica num worktree fora do repositório e passa por G1 a G4 (e G5 no da productivity-tools). A volta é git merge --no-ff volta/<plugin>-<patch> em main, depois de git diff --name-only main...volta/<...> mostrar só a árvore do plugin, o README.md e, na productivity-tools, tools/measure; o fast-forward só vale enquanto main for ancestral do branch. É ato do dono com novo sim.",
      "basis": "Com dois plugins, um branch de volta tirado da tag anterior inteira também voltaria o outro plugin. O roteiro e o fecho do tracker entram em main depois da base do branch de volta, então o fast-forward deixa de valer cedo. O merge --no-ff volta só a árvore do plugin, mantém esses docs e não reescreve o histórico compartilhado.",
      "alternative": "Tirar cada volta da publicação anterior inteira, como no E40 (volta/productivity-tools-2.6.1 a partir de productivity-tools--v2.5.0).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "O marketplace-tools ganha tag, se nunca teve uma?",
      "decision": "Sim: marketplace-tools--v1.4.0 anotada no mesmo commit de productivity-tools--v2.7.0, no padrão <plugin>--v<versão>.",
      "basis": "A definição de pronto do card fala em tags publicadas, no plural, e a DEC-003 trata a publicação como uma só com dois plugins. Com a tag, o rollback e a fixação de loja ficam possíveis também para o marketplace-tools.",
      "alternative": "Taguear só a productivity-tools, como nas publicações anteriores.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Onde conferir a pasta nova do marketplace-tools no cache, se ele não está instalado na config real do dono?",
      "decision": "A productivity-tools é conferida em ~/.claude/plugins/cache/claude-play/productivity-tools/2.7.0/, depois do update na config real. O marketplace-tools é conferido numa config descartável nova (CLAUDE_CONFIG_DIR na mesma linha de cada comando), com marketplace add e install, e a config é apagada depois. Se o CLI pedir login, a conferência vai ao dono.",
      "basis": "Instalar um plugin na config real muda o ambiente do dono sem pedido. O E40 já conferiu instalação por tag numa config descartável, sem custo.",
      "alternative": "Instalar marketplace-tools@claude-play na config real do dono.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Uma nota de release ou uma por plugin?",
      "decision": "Uma por plugin em docs/releases/, com os dois links na frase What changed do README.md.",
      "basis": "O FAIL novo do lint é uma mudança de comportamento do marketplace-tools que não cabe numa nota com nome de productivity-tools. As notas anteriores têm um plugin por arquivo.",
      "alternative": "Uma nota única da productivity-tools 2.7.0, com uma seção sobre o marketplace-tools.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Comentário e fecho das issues entram no E54 e em qual pedido de autorização?",
      "decision": "Entram no E54, depois da conferência do cache, num pedido B separado do pedido A (push e tag), com a lista das issues e o texto de cada comentário. Fecham #1 a #12, #14, #17 a #19, #21 a #23, #25, #26, #28 e #29. A #8 fecha só com o E49 integrado, e a #25 só com o E53 fechado por completo.",
      "basis": "A definição de pronto do Objetivo exige as issues fechadas, e o comentário precisa citar a tag, que só existe depois do push. É um efeito público (notificações no GitHub), diferente do push, e o dono pode aprovar um sem o outro.",
      "alternative": "Um pedido único para push, tag e issues, como no E40; ou deixar as issues para o fecho do roadmap pelo tracker.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Quem autoriza push, tag, avanço de main e comentário ou fecho de issue, se a DEC-004 lista push e tag entre o que volta ao delegado opus?",
      "decision": "Só o próprio dono, nos pedidos A e B; o delegado opus não concede esses passos. O delegado segue decidindo alcance contrato e escalações (DEC-004, DEC-021), como a exceção da R1.",
      "basis": "O CLAUDE.md do projeto (Publish an update) exige autorização explícita do dono antes de push e tag; a pendência externa da estratégia e a de state.md nomeiam o dono; o E40 foi autorizado pelo dono. A regra mais estrita prevalece sobre a delegação genérica da DEC-004.",
      "alternative": "Aceitar a autorização do delegado opus para push e tag, como a letra da DEC-004 com a DEC-021 permitiria.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": "DEC-004"
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "decision",
      "what": "Publicar com fecho parcial do E53, se ele parar sem fechar (lote sem autorização, menos de 2 válidas ou um parar do lote-gate não resolvido). A resposta só vale como DEC com Origem exatamente dono, Entregável E54 e o estado do E53 descrito.",
      "why": "A estratégia faz do lote medido uma condição de saída da fase. Publicar sem ele muda o que os usuários recebem (limites provisórios da decisão 060 do pós-2.3.0), e o pedido do dono põe essa escolha com ele, não com o executor nem com o delegado.",
      "blocking": false,
      "workaround": "Esperar o fecho completo do E53; nada do E54 começa antes."
    },
    {
      "id": "H2",
      "kind": "decision",
      "what": "Autorização A: fast-forward de main, as tags productivity-tools--v2.7.0 e marketplace-tools--v1.4.0, push de main, das tags e dos dois branches volta/, update na config real e segundo push só de docs, a partir do roteiro em docs/reports/<data>-E54-roteiro-publicacao.md.",
      "why": "O CLAUDE.md do projeto (Publish an update) e a pendência externa da estratégia exigem autorização explícita do próprio dono para push e tag; o delegado opus não a concede (R7).",
      "blocking": true,
      "workaround": ""
    },
    {
      "id": "H3",
      "kind": "decision",
      "what": "Autorização B: comentar e fechar as issues resolvidas, a partir da lista e dos textos mostrados no roteiro.",
      "why": "Comentário e fecho de issue são efeitos públicos no GitHub, que exigem autorização explícita do dono.",
      "blocking": false,
      "workaround": "A publicação fica completa sem as issues; o fecho fica como pendência do dono em state.md."
    }
  ],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Fast-forward de main e criação das tags anotadas productivity-tools--v2.7.0 e marketplace-tools--v1.4.0 no repositório local compartilhado.",
      "target": "refs locais de D:/projects/claude-play"
    },
    {
      "id": "X2",
      "what": "Push de main, das duas tags e de volta/productivity-tools-2.7.1 e volta/marketplace-tools-1.4.1, e um segundo push só de docs com o fecho do tracker.",
      "target": "origin (GitHub, marketplace claude-play)"
    },
    {
      "id": "X3",
      "what": "claude plugin marketplace update claude-play e claude plugin update productivity-tools@claude-play na config real.",
      "target": "config real do dono (~/.claude/plugins)"
    },
    {
      "id": "X4",
      "what": "Config descartável nova para conferir o marketplace-tools 1.4.0 (marketplace add e install a partir do GitHub), apagada depois.",
      "target": "máquina local (D:/claude-e54-cfg) e rede"
    },
    {
      "id": "X5",
      "what": "Comentários e fecho das issues resolvidas.",
      "target": "issues do repositório no GitHub"
    },
    {
      "id": "X6",
      "what": "Logout da config descartável do E53 e remoção dela, do worktree do candidato e das pastas de trabalho do lote.",
      "target": "máquina local (D:/claude-e53-cfg, D:/claude-e53-cand, D:/claude-e53-work*) e sessão da conta"
    },
    {
      "id": "X7",
      "what": "Worktrees dos dois branches de volta fora do repositório.",
      "target": "máquina local (D:/claude-e54-volta-*)"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "A conferência da R1 lista um arquivo fora do conjunto permitido, ou outra contagem de linhas.",
      "expected": "A publicação para antes do pedido A (ou antes da tag); o lote do E53 é tratado como inválido pela R8 do E53, e o caso vai ao delegado opus com a saída do diff."
    },
    {
      "id": "C2",
      "input": "O fetch . release/pos-2.6.0:main recusa por não ser fast-forward, ou main mudou desde o roteiro.",
      "expected": "Nada é tagueado nem enviado; o estado novo volta ao dono com o roteiro atualizado."
    },
    {
      "id": "C3",
      "input": "O push é recusado em parte (por exemplo, uma tag já existe no remoto).",
      "expected": "O executor para sem --force e sem repetir de outra forma, e leva ao dono o que entrou e o que não entrou (git ls-remote)."
    },
    {
      "id": "C4",
      "input": "O G1 de um branch de volta falha.",
      "expected": "Falha só de teste do ambiente (por exemplo CRLF) é corrigida no próprio branch de volta; falha de produto, ou de teste que dependa do outro plugin, para e vai ao delegado opus."
    },
    {
      "id": "C5",
      "input": "Depois do update, a pasta 2.7.0 (ou a 1.4.0 na config descartável) não existe no cache.",
      "expected": "Sem repetir às cegas: conferir o clone do marketplace na versão nova e levar o estado ao dono; o AC2 não fecha."
    }
  ]
}
```
