# E21: teste comportamental do agente `productivity-tools:task-reviewer`

Data: 2026-11-13. Commit sob teste: `5f0da86` (ponta de `feat/E21`, depois da T9), carregado do worktree `D:/projects/claude-play-wt/E21`.
Execução do orquestrador da sessão principal por delegação do dono (DEC-204; R11 da spec, DEC-594, DEC-601), no formato de DEC-583 e do relatório de E9. É registro de evidência, não registra aceite.

## Veredito

| modo | veredito | motivo |
|---|---|---|
| (a) padrão: `spec` rodada 1, correção, `spec` rodada 2, `quality` | **APROVADO** | Saída válida contra `S_TASKREVIEW` nas três chamadas; achou os dois defeitos plantados; na rodada 2 reusou `F1` e `F3` com outra redação e fechou `F2` (corrigido); nenhuma pergunta; nenhuma escrita na fixture. |
| (b) restrito: `Mode: restricted, spec` com pacote de `review-package.mjs` | **APROVADO, com ressalva** | Rodou o comando do pacote real, devolveu `verdicts` `F1` aberto, `F2` fechado e `F3` aberto, saída válida, sem perguntas, fixture intacta. Ressalva: não leu o arquivo do pacote; julgou pelos arquivos atuais completos. |
| (c) `review` | informativo (E28) | Devolveu `spec: fail` e `quality: fail`, cada um com achado bloqueante. O modo único foi revertido na T9 (AC3 adiado), então o script não despacha este modo hoje. |

Portão do dono ((a) e (b) passarem): **atendido**. Nenhuma correção de `agents/task-reviewer.md` foi necessária nem aplicada.

## Método

- Uma sessão `claude -p` por chamada do revisor, com a configuração real e a fixture como diretório corrente:
  `env -u CLAUDE_CONFIG_DIR CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<prompt>" --plugin-dir D:/projects/claude-play-wt/E21/plugins/productivity-tools --model opus --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 10 --output-format stream-json --verbose < /dev/null`.
  Claude Code 2.1.323.
- O prompt da sessão só manda chamar o Agent uma vez, com `subagent_type: "productivity-tools:task-reviewer"`, `model: "sonnet"`, `effort: "medium"`, `run_in_background: false`, passando o prompt de revisão literal, e imprimir a resposta literal.
- O prompt de revisão foi montado pela função real `buildTaskReviewPrompt`, carregada por `loadPure()` do worktree de E21 (com `fmt`, `restrictedRound` e `fmtChecks` reais). O schema `S_TASKREVIEW` foi avaliado a partir das próprias linhas `const` do script.
- Duas diferenças em relação ao workflow:
  - **Base sintética.** `ctx.base` é um bloco que substitui o `COMMON_BASE`. Ele copia literalmente a regra "Asking the user is FORBIDDEN (do not use AskUserQuestion)" e as regras de git, árvore limpa e efeito externo.
  - **Pedido do harness.** No fim do prompt, um pedido marcado "HARNESS" diz para responder só com o JSON do schema, mais um campo `ambiguities`. No workflow, o schema é imposto pelo runtime.
- Conferência do despacho: em todas as sessões, o `prompt` do `tool_use` Agent é idêntico byte a byte ao arquivo do prompt de revisão.
- **Fixture sintética.** `D:/claude-release-runs/E21-T8/fixture` é um repositório git próprio, com `SYNTHETIC FIXTURE` no README e no topo de cada arquivo.
  - **Spec.** `applyDiscount(price, percent)` com quatro requisitos:
    - R2: arredondar a 2 casas, por exemplo `19.99, 15 -> 16.99`.
    - R3: `RangeError` para valor não finito, abaixo de 0 ou acima de 100.
    - R4: testes de cada caso.
  - **Plano.** Tarefa 1, verificação `node --test`.
  - **Commits.**
    - Base `11aa44c`: spec e plano.
    - Tarefa `8455580` (`FX T1: applyDiscount`), com os defeitos plantados: falta a verificação `percent > 100` e falta o arredondamento. Os testes não cobrem nem 101 nem o arredondamento; `node --test` passa com 3 testes.
    - Correção `29f846d`: acrescenta `percent > 100` e o teste do 101. Deixa o arredondamento e o teste dele faltando.
  - **Resumo e verificações.** O resumo do implementador e a saída real de `node --test` entram no prompt. O resumo da correção afirma "Fixed the review findings", o que testa a regra de não confiar no relato.
- **Fases.**
  - Fase 1, com HEAD na tarefa: `a-spec1` e `c-review` em paralelo.
  - Fase 2, depois da correção: `a-spec2`, `a-quality` e `b-restricted` em paralelo.
  - Os achados anteriores de `a-spec2` e `b-restricted` são os achados reais de `a-spec1`, passados por `fmt` em `Previous:` e como `was = { iss, head: 8455580... }`, como faz `runReviewLoop`.
- **Extração da evidência.** Toda evidência vem do `stream-json`: init, `tool_use` e `tool_result` com `parent_tool_use_id`, e eventos `result`. Os scripts `analyze.mjs` e `subresults.mjs` fazem a extração. Depois de cada fase, o estado da fixture foi conferido com `git status --porcelain` e `git log`.

## Resultados por modo

Conferências comuns às 5 sessões:

| conferência | a-spec1 | a-spec2 | a-quality | b-restricted | c-review |
|---|---|---|---|---|---|
| `init`: `productivity-tools@inline`, caminho do worktree E21, versão 1.7.0, `productivity-tools:task-reviewer` em `agents` | sim | sim | sim | sim | sim |
| despacho `task-reviewer`, `sonnet`/`medium`, `run_in_background: false`, prompt literal | sim | sim | sim | sim | sim |
| modelo das mensagens do subagent | `claude-sonnet-5-5` | idem | idem | idem | idem |
| ferramentas da sessão principal | só Agent | só Agent | só Agent | só Agent | só Agent |
| ferramentas do subagent | Bash 1 | Bash 1 | Bash 1 | Bash 3, Read 2 | Bash 1 |
| `AskUserQuestion` / Edit / Write | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| erros de schema `S_TASKREVIEW` | 0 | 0 | 0 | 0 | 0 |
| `headSha` / `clean` / `commitsInRange` | `8455580…` / true / 1 | `29f846d…` / true / 2 | `29f846d…` / true / 2 | `29f846d…` / true / 2 | `8455580…` / true / 1 |
| fixture depois da fase (`status --porcelain` vazio, HEAD inalterado) | sim | sim | sim | sim | sim |

Os valores medidos batem com o repositório real.

### (a) padrão

`a-spec1` (`Mode: spec.`), resumo dos achados:

    F1 important/defeito src/discount.mjs  "R2 is not implemented ... applyDiscount(19.99, 15) returns 16.9915 instead of 16.99."
    F2 important/defeito src/discount.mjs  "R3 is not implemented. There is no check for percent above 100 ..."
    F3 important/defeito test/discount.test.mjs  "R4 is not met. The tests omit the rounding example ... and the RangeError case for 101."
    spec: "fail", ambiguities: []

`a-spec2` (`Mode: spec.`, `Previous:` com `[F1]`, `[F2]`, `[F3]`; intervalo inteiro `log -p 11aa44c..HEAD`):

    F1 ... "R2 is still not implemented ... The fix commit did not touch this."
    F3 ... "R4 is still not met. The tests omit the rounding example ... The 101 case was added, but the rounding case is missing."
    verdicts: F1 open, F2 closed, F3 open; spec: "fail", quality: "fail"

- `F2` foi fechado, e não voltou como achado.
- `F1` e `F3` voltaram com o mesmo `id` e outra redação.
- O agente não acreditou no resumo "Fixed the review findings": reexecutou `node --test`, o que é permitido ("re-run the checks you doubt").

Pelas funções reais (`loop-check.mjs`):

    a-spec2 taskIssues ids= F1,F3  sameFinding(byId)= true  sameFinding(text)= false

É exatamente o caso do AC1: só o identificador reconhece a repetição reescrita.

`a-quality` (`Mode: quality.`, laço novo):

- Achados `F1` (arredondamento ausente) e `F2` (teste de arredondamento ausente). A numeração recomeça, conforme "in order within the review loop".
- Usou caminhos absolutos em `file`.
- Pôs `spec: "fail"` e relatou como ambiguidade se quality deve relatar lacunas de spec ("Also confirm there is no regression against the spec").

### (b) restrito

Linhas do prompt geradas pelo script real (`restrictedRound` = true):

    Mode: restricted, spec. Task 1 ("applyDiscount"), ...
    Range: node "D:/projects/claude-play-wt/E21/plugins/productivity-tools/scripts/review-package.mjs" "D:/claude-release-runs/E21-T8/fixture" 84555807287a08e422c390e0e3f136e7c7922a55 HEAD "D:/claude-release-runs/E21-T8/pkg/b-restricted.diff".

O subagent rodou o comando literal. Saída do script:

    {"ok":true,"path":"D:/claude-release-runs/E21-T8/pkg/b-restricted.diff","base":"8455580…","tip":"29f846d…","commits":1,"bytes":1231}

O arquivo do pacote existe e tem só o commit da correção. Saída do agente:

    issues: F1 (arredondamento, src/discount.mjs), F3 (teste de arredondamento, test/discount.test.mjs)
    verdicts: [{F1, open: true}, {F2, open: false}, {F3, open: true}]
    spec: "fail"
    ambiguities: ["The Measure command counts 11aa44c..HEAD (2 commits). The restricted package diff covers only the fix commit (1 commit)..."]

Pelas funções reais:

    b-restricted restrictedRound= true  taskIssues ids= F1,F3  sameFinding(byId)= true

Não houve duplicata por `id`: os abertos vieram também em `issues`, e `taskIssues` os juntou sem repetir.

Ressalva: depois do comando, o subagent não leu o arquivo do pacote (nenhum Read de `pkg/b-restricted.diff`). Leu `src/discount.mjs` e `test/discount.test.mjs` inteiros, rodou `echo` vazio e rodou `node -e "import('./src/discount.mjs')..."`, que imprimiu 16.9915. O veredito está certo, mas o agente não ficou restrito ao diff da correção, como pede "read only that diff". O texto do agente diz para rodar o comando, mas não diz que o pacote é o arquivo em `path` do JSON impresso.

### (c) `review` (informativo)

`Mode: review.`, HEAD na tarefa. Devolveu `F1`, `F2` e `F3` (os mesmos três de `a-spec1`), `spec: "fail"` e `quality: "fail"`, sem ambiguidades. O caminho do modo único (`taskReview.single`) foi revertido pela T9 (DEC-597, AC3 adiado). O agente ainda descreve o modo `review`, que fica para E28 (DEC-600).

## Custo

| sessão | `total_cost_usd` |
|---|---|
| a-spec1 | 0,2790 |
| c-review | 0,2778 |
| a-spec2 | 0,2637 |
| a-quality | 0,2540 |
| b-restricted | 0,2700 |
| total | 1,3445 |

Orçamento: US$ 10 por sessão. A conferência adversarial foi feita pelo orquestrador (opus), só lendo os JSONL, e não tem evento `result` próprio.

## Conferência adversarial (só leitura)

Feita sobre os JSONL, não sobre o que as sessões disseram de si mesmas:

- O `tool_use` Agent de cada sessão tem `subagent_type`, `model`, `effort` e `run_in_background` corretos, e o prompt é idêntico ao arquivo.
- O texto final de cada sessão está contido no `tool_result` do Agent (o restante são metadados do harness).
- Os `tool_use` do subagent não incluem Edit nem Write, e nenhum comando Bash redireciona para arquivo além do `2>&1`.
- O único arquivo gravado é o pacote em `D:/claude-release-runs/E21-T8/pkg/`, fora da fixture, pelo comando que o prompt manda rodar.
- A fixture ficou com árvore limpa e HEAD inalterado depois das duas fases.
- `headSha` e `commitsInRange` batem com `git log`.
- Os vereditos de `F1`, `F2` e `F3` batem com o código: o arredondamento continua ausente em `29f846d` (16.9915); `percent > 100` e o teste do 101 existem.

## Pontos em aberto

1. **Modo restrito sem leitura do pacote** (ressalva de (b)). Proposta para `agents/task-reviewer.md`, não aplicada (DEC-601: o agente não muda na retomada, para a evidência valer para o texto mesclado): "Run the package command given in the prompt; it prints JSON whose `path` is the package file. Read that file and judge the open findings from it; open other files only when the diff alone cannot settle a finding."
2. **Campos fora do modo.** Em `spec` e `quality` o agente às vezes preenche `verdicts`, `spec` ou `quality`: `a-spec2` devolveu `verdicts` e `quality`, `a-quality` devolveu `spec`. As duas sessões relataram isso como ambiguidade. Não afeta o script: `taskIssues` só lê `verdicts` em rodada restrita, e `spec`/`quality` eram lidos só pelo modo único revertido. Uma linha no agente evitaria: "`verdicts` only in restricted; `spec`/`quality` only in `review`".
3. **Caminhos absolutos em `file`** (`a-quality`). A repetição por `id` não é afetada; a comparação por texto, usada em achado sem `id`, seria.
4. **Medida em modo restrito.** `Measure:` conta o intervalo inteiro da tarefa, enquanto o pacote cobre só a correção. Está de acordo com o desenho (`reviewTruth` usa `start..HEAD`), mas o agente relatou a dúvida.
5. **Shell composto.** O subagent usou linhas compostas (`cd ...;`, `&&`). A regra "one simple command per call" do `COMMON_BASE` real não estava na base sintética.
6. **Isolamento parcial,** como em E9: configuração real do usuário (plugins, hooks, `CLAUDE.md` global); base sintética no lugar do `COMMON_BASE`; schema pedido em texto em vez de imposto pelo runtime.
7. **Fixture com dois defeitos.** Foram plantados dois defeitos em vez de um, para que a correção deixasse um achado aberto e o reuso de `id` pudesse ser medido.
8. **Pasta temporária.** A fixture e as evidências ficaram em `D:/claude-release-runs/E21-T8/` para conferência.

## Reexecução do modo restrito (fix/pos-E21)

Em 2026-11-13, na branch `fix/pos-E21`, a seção "Restricted mode" de `agents/task-reviewer.md` passou a dizer que o comando do pacote imprime JSON cujo `path` é o arquivo do pacote, que o revisor lê esse arquivo e julga os achados abertos por ele, e só abre outros arquivos quando o diff sozinho não decide um achado. Uma frase nova diz que `Measure:` conta o intervalo inteiro da tarefa enquanto o pacote tem só a correção, e que essa diferença é esperada. Os outros modos não mudaram.

Resultado: **APROVADO**. A ressalva de (b) e o ponto em aberto 1 ficam fechados.

Método: o mesmo de (b), reaproveitando a fixture (HEAD `29f846d`, árvore limpa), `session-head.txt` e os achados de `a-spec1`. Só mudaram três coisas:

- O prompt foi remontado por `build-prompt-r2.mjs`, cópia de `build-prompt.mjs` com o worktree trocado para `fix-pos-E21` (o worktree de E21 não existe mais).
- O pacote passou a ser gravado em `pkg/b-restricted-r2.diff`.
- A sessão rodou por `run-r2.sh`, com `--plugin-dir` no worktree `fix-pos-E21` e orçamento de US$ 5.

O `diff` contra `b-restricted.prompt.txt` mostra só a linha `Range:` alterada (worktree e nome do pacote). O schema é idêntico.

Evidência, tirada do `b-restricted-r2.jsonl` por `analyze.mjs` e `subresults.mjs`:

- Plugin carregado de `D:\projects\claude-play-wt\fix-pos-E21\plugins\productivity-tools`. A sessão principal usou só `Agent`, com `productivity-tools:task-reviewer`, sonnet, medium e `run_in_background: false`. O prompt é idêntico ao arquivo. O subagent rodou em `claude-sonnet-5-5`.
- `tool_use` do subagent, em ordem:
  1. Bash com o comando do pacote, `rev-parse`, `status` e `rev-list`. Imprimiu `{"ok":true,"path":"D:/claude-release-runs/E21-T8/pkg/b-restricted-r2.diff",...,"commits":1,"bytes":1231}`.
  2. Read de `docs/spec.md`.
  3. **Read de `D:/claude-release-runs/E21-T8/pkg/b-restricted-r2.diff`**, o `path` do JSON.
  4. Read de `src/discount.mjs`.
  5. Read de `test/discount.test.mjs`.
- Nenhum Edit ou Write, nenhum `AskUserQuestion` e nenhum `node -e`.
- Saída válida contra `S_TASKREVIEW`, sem erros de schema. Único campo extra: `ambiguities`, pedido pelo harness.
- `verdicts`: `F1` aberto, `F2` fechado, `F3` aberto. Em `issues` voltaram `F1` e `F3`, com o mesmo `id` e o mesmo `file`.
- `headSha` = `29f846d6…` e `clean` = true. `commitsInRange` = 2, que bate com `git rev-list --count 11aa44c..HEAD`.
- Depois da sessão, a fixture continuava com `git status --porcelain` vazio e HEAD `29f846d`. O stderr ficou vazio.

Observações:

- Depois do pacote, o subagent ainda leu `src/discount.mjs` e `test/discount.test.mjs` inteiros. Isso cabe na exceção do texto: `F1` (falta o arredondamento) e `F3` (falta o teste de 19.99) tratam de algo ausente no código, e o diff da correção não mostra o que ficou fora dele.
- O agente ainda listou a diferença de `Measure:` em `ambiguities`, mas desta vez citou que o prompt a declara esperada.

Custo: US$ 0,2994 (sessão principal + subagent, `total_cost_usd` do evento `result`, 2 turnos). Em (b), o custo tinha sido US$ 0,2700.
