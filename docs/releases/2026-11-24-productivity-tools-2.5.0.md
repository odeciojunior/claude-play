# Nota de atualização: productivity-tools 2.5.0

Data: 2026-11-24. Sobre a 2.4.0. Traz o **E41, saída de script sem recópia por LLM**: os workflows `plan-coordinator` e `roadmap-release` param de depender de um modelo barato copiando a saída de scripts palavra por palavra. Os formatos de plano, de estado e de `release.config.json` não mudam, então não há nada a fazer na configuração. Execuções da 2.4.0 não são retomáveis (veja "Retomada" abaixo).

## O que muda

- **Exit code vindo de script.** O novo `scripts/capture.mjs run` roda o comando, grava stdout e stderr em `<git-dir>/pt-evidence/<tarefa>/` e imprime uma linha JSON assinada com exit, bytes, sha256, caminho, cauda limitada e, se pedido, o resumo do extrator. O agente `script-runner` copia só essa linha curta.
- **Nenhuma cópia acima de 3.500 bytes.** Toda resposta que um agente copia fica em até 3.500 bytes UTF-8. A constante é única e fica em `lib/plan-digest.mjs`. Conteúdo maior chega em fatias de até 3 KB, cada uma com digest, e o total tem SHA-256. Só a fatia que falhou é repetida. Ganham `--slice <k>` o `progress.mjs read`, o `preflight.mjs discover` e o `verify-run.mjs read` (este pelo campo `slice`).
- **Testes lidos por extrator.** `scripts/test-extract.mjs` lê a saída do `node:test`, nos formatos TAP e spec, e devolve total, pass, fail, skipped e nomes das falhas. As barreiras de teste, a linha de base e o portão de onda usam esse resultado em vez da leitura do modelo.
- **Revisores leem diff por arquivo.** O `review-package` serve diffs por arquivo, com offset e limit. Os contratos de `implementer`, `task-reviewer`, `final-reviewer`, `script-runner` e `test-integrity` foram ajustados para isso.
- **Carga de spec e plano sem recópia (B07).** O `roadmap-release` carrega spec e plano pelo `capture.mjs` e confere o digest, sem pedir ao modelo que copie o arquivo.
- **spec-writer.** O tópico passa a ser ASCII kebab-case de até 64 caracteres, e o sufixo `-E<n>` de card é mantido. Colisão com uma spec existente vira uma das perguntas da rodada única, e o retorno `topic-invalid` faz o skill parar.

## Provas de captura (E41)

- **Nomes.** As provas de `capture.mjs run` ficam em `<git-dir absoluto>/pt-evidence/<tarefa>/`. No `plan-coordinator`, `<taskId>` é o id do plano higienizado (cada caractere fora de `[A-Za-z0-9._-]` vira `_`), cortado em 55 caracteres, mais `_` e o fnv1a de 8 hex de `id|plan.path`. Planos com o mesmo id em caminhos diferentes têm prefixos diferentes, e o prefixo se mantém numa retomada. Pastas: `<taskId>-T<n>/` e `<taskId>-gate/`; a revisão final grava `review/<taskId>-final.txt` e `review/<taskId>-worktree.diff`. No `roadmap-release`: `<E>-T<n>`, `<E>-gates` e `<E>-load`; os diffs de revisão dele ficam em `${WT}/_tmp/`.
- **Prune.** `capture.mjs prune --task-prefix <p>` remove as pastas `<p><resto>` cujo resto não tem hífen e os arquivos `review/<p><resto>`, e depois varre o que tem mais de 14 dias. No Windows o prefixo ignora maiúsculas e minúsculas. `prune --older-than <dias>` só varre por idade. O prune do fecho (`done`) apaga as provas: quem quer guardá-las copia antes.
- **List.** `capture.mjs list [--cwd]` imprime uma linha JSON assinada com `{name, files, bytes, newest}` por pasta (e `cut` quando corta). O `prune` imprime também `swept`, cortado com `sweptCut` quando passa do limite de cópia (`prune --older-than` corta `removed` com `removedCut`; no modo com prefixo o corte extra usa `removedReviewCut`/`removedCut`); `list` e `prune` aceitam `--nonce <n>`, que entra na linha assinada. Para achar o prefixo à mão, rode `list` ou tire o `-T<n>`/`-gate` do nome da pasta no `path` que o capture imprimiu (o prefixo do prune termina em `-`).
- **`id-invalid`.** `plan-tool` e `spec-tool` recusam id fora de `^[A-Za-z0-9._-]{1,64}$`. Um plano já iniciado com id fora da regra (ex.: "Plano B") para com a pergunta `ask` do `plan-coordinator`, que traz o erro `id-invalid`: renomeie o id em `plan.md` e `spec.md` (mesmo valor) e rode `progress.mjs init --restart`, depois relance sem `answers` (o estado volta a `map-ready`, e um `unblock` daria `wrong-status`). O `progress.mjs next` devolve a mesma pergunta e o `read` assinado traz `planAsk`; `plan-changed` continua para plano cujo conteúdo mudou.
- **Retomada.** Execuções da 2.4.0 não são retomáveis com `resumeFromRunId` (DEC-028): lance de novo com um `runToken` novo. Ids válidos de até 64 caracteres mudam de prefixo nesta versão, e as provas antigas ficam para a varredura de 14 dias.

## Ainda em aberto

- **E41, AC3 (sonda paga com context-mode).** A sonda AC2b rodou 6 execuções e parou em `authorize` em 6/6, com US$ 0,39 no total. A conferência humana H1 foi feita por subagent opus, por delegação do dono, e deu "confere com ressalvas". O context-mode continua desligado nesta máquina (DEC-027).
- **E35, AC2 e E38, AC2** seguem como na nota da 2.4.0.
- **Roadmap.** A 2.5.0 sai antes do E40, que previa publicá-la junto com E36, E37 e E39 (DEC-042). Esses entregáveis vão para uma versão seguinte.

## Como atualizar

`claude plugin marketplace update claude-play`, `claude plugin update productivity-tools@claude-play`, `/reload-plugins`. Confira que `~/.claude/plugins/cache/claude-play/productivity-tools/2.5.0/` existe.

## Se algo quebrar

Prefira corrigir adiante numa 2.5.x. Para reverter, a branch `volta/productivity-tools-2.5.1` (conteúdo da 2.4.0, republicado como versão maior) é último caso e ato do dono, como na [nota da 2.0.0](2026-11-15-productivity-tools-2.0.0.md#se-algo-quebrar).
