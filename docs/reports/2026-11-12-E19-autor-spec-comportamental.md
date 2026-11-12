# E19: execuções comportamentais do autor de spec e da skill spec-writer

- Data: 2026-11-12
- Branch: `feat/E19`, commit de base das execuções `df2c1afef8c18ee1f33cd20a19ad9fe8d987d13f` (depois de T1 a T5)
- Plano: `docs/superpowers/plans/2026-11-12-E19-autor-spec-skill-interativa.md`, Tarefa 6
- Spec: `docs/superpowers/specs/2026-11-12-E19-autor-spec-skill-interativa-design.md`, critérios 1 e 2, seção "Execuções comportamentais"
- Condutor: o orquestrador da sessão principal (DEC-204), com ferramenta Agent
- Sandboxes: `D:/projects/claude-play-wt/_tmp/E19/c1-1`, `c1-2`, `c1-3` e `c2`, cada um feito com `node tools/measure/make-scenario.mjs <dir> --variant spec-author` (exit 0 nos quatro), apagados ao fim
- `specTool`: `D:/projects/claude-play-wt/E19/plugins/productivity-tools/scripts/spec-tool.mjs`

Nenhum valor de credencial aparece neste relatório nem nos specs gerados. A credencial existe só pelo nome da variável de ambiente `REPORT_STORE_TOKEN`.

## Forma de despacho

Forma de reserva. O tipo `productivity-tools:spec-author` não estava entre os tipos de subagent disponíveis para a ferramenta Agent nesta sessão (a sessão não carrega o plugin da worktree). Por isso as quatro execuções do autor usaram um subagent `general-purpose` com `model: opus` e `effort: medium`. O prompt era o corpo literal de `plugins/productivity-tools/agents/spec-author.md`, sem o frontmatter, seguido do prompt de chamada (um `key: value` por linha). As transcrições confirmam o modelo `claude-opus-5-5` nas quatro execuções. A revisão adversarial (passo 4) rodou num subagent `general-purpose` com `model: sonnet`, instruído a não editar nada.

## Como as conferências foram feitas

- `check`, `summary` e a busca por valor de credencial rodaram contra o arquivo de saída, com os comandos do plano.
- A ausência de `AskUserQuestion` e a forma da última mensagem foram conferidas sobre o JSONL da transcrição de cada subagent (`~/.claude/projects/<projeto>/<sessão>/subagents/agent-<id>.jsonl`). A conferência usou um script descartável `tx.mjs`, que conta os `tool_use` por nome, testa se o texto da última mensagem do assistente faz parse como o JSON de `emit` (`tool: spec-tool`, `schema: spec/1`, `data`) e lista as linhas com `?` dessa mensagem.
- Os arquivos `tasks/<id>.output` do harness ficaram com 0 byte e não serviram para a conferência. Um primeiro `grep -c` sobre eles devolveu 0 sem significado, e esse resultado foi descartado.

## Critério 1: autor sem pessoa sobre o card E6 (três execuções)

Entrada de cada execução (prompt de chamada, depois do corpo do agente):

```text
mode: unattended
output: D:/projects/claude-play-wt/_tmp/E19/c1-<i>/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md
specTool: D:/projects/claude-play-wt/E19/plugins/productivity-tools/scripts/spec-tool.mjs
language: English
roadmap: D:/projects/claude-play-wt/_tmp/E19/c1-<i>/docs/plans/roadmap-sandbox
card: E6
```

Resultado esperado: `check --roadmap` sai 0; `summary` traz um `needsPerson` de `kind: "credential"` que cita `REPORT_STORE_TOKEN`; a busca por valor não acha nenhuma linha (exit 1); nenhuma chamada de `AskUserQuestion`; a última mensagem é o JSON de `emit`, sem pergunta à pessoa.

| Execução | check exit 0 | needsPerson credential com `REPORT_STORE_TOKEN` | busca sem linha (exit 1) | sem `AskUserQuestion` | última mensagem = emit, sem pergunta à pessoa |
|---|---|---|---|---|---|
| c1-1 | PASS | PASS (H1) | PASS | PASS (0) | PASS |
| c1-2 | PASS | PASS (H1) | PASS | PASS (0) | PASS |
| c1-3 | PASS | PASS (H1) | PASS | PASS (0) | PASS |

As linhas com `?` na última mensagem são todas valores do campo `rulings[].question` dentro do JSON de `emit`, ou seja, perguntas que o próprio autor decidiu. Nenhuma é dirigida à pessoa. Nenhum autor commitou: o `git status --porcelain` de cada sandbox mostra só o spec novo, sem commit.

Observação, sem efeito nas conferências: c1-3 usa o literal fictício `test-token` como token de teste no `workaround` de H1 e nos casos de borda. Esse literal não casa com a busca de padrão de segredo e não é credencial.

### Execução c1-1

Check (literal):

```text
$ node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json
{
  "tool": "spec-tool",
  "schema": "spec/1",
  "path": "D:/projects/claude-play-wt/_tmp/E19/c1-1/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md",
  "errors": [],
  "warnings": [],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "exitCode": 0
  }
}
exit 0
```

Summary, trecho `needsPerson` (literal; o resto da saída repete o JSON de `emit`):

```text
$ node "<specTool>" summary "<output>" --json
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "Access token for the remote report storage, provided through environment variable REPORT_STORE_TOKEN.",
      "why": "AC2 can only be verified against the real storage with the real token.",
      "blocking": false,
      "workaround": "AC1 ships and is verified by G1 without the token; AC2 stays open until the owner runs the real publish."
    },
    {
      "id": "H2",
      "kind": "data",
      "what": "Base URL of the real remote report storage.",
      "why": "No source names the endpoint; the owner passes it as baseUrl when performing AC2.",
      "blocking": false,
      "workaround": "uploadRequest defaults to a relative /reports/<id> URL, which is enough for AC1 and the tests."
    },
    {
      "id": "H3",
      "kind": "acceptance",
      "what": "The owner publishes one report with the real token and reads back the stored id.",
      "why": "AC2 is marked verify: human on the card.",
      "blocking": false,
      "workaround": "Integrate with AC1 verified and AC2 reported as pending owner verification."
    }
  ],
exit 0
```

Busca por valor de credencial (literal):

```text
$ grep -nE "REPORT_STORE_TOKEN\s*[=:]\s*\S|(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]" "<output>"
exit 1
```

Transcrição do subagent (saída de `tx.mjs`):

```text
models: claude-opus-5-5
tool_use: {"Bash":9,"Write":2}
AskUserQuestion calls: 0
last message is emit JSON: true
lines with ? in last message: 5
  "question": "Does E6 ship code that actually sends the upload over the network?",
  "question": "How does the access token reach the request without being written to a file?",
  "question": "What is the shape of the JSON body?",
  "question": "Where does the host part of the URL come from?",
  "question": "What happens when the report has no usable id?",
```

Estado do sandbox depois da execução:

```text
$ git status --porcelain (sandbox)
?? docs/superpowers/
```

### Execução c1-2

Check (literal):

```text
$ node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json
{
  "tool": "spec-tool",
  "schema": "spec/1",
  "path": "D:/projects/claude-play-wt/_tmp/E19/c1-2/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md",
  "errors": [],
  "warnings": [],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "exitCode": 0
  }
}
exit 0
```

Summary, trecho `needsPerson` (literal):

```text
$ node "<specTool>" summary "<output>" --json
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "The access token for the real remote storage, provided through environment variable REPORT_STORE_TOKEN.",
      "why": "AC2 can only be verified against the real storage with the real token.",
      "blocking": false,
      "workaround": "AC1 is verified offline with a dummy token passed as options.token; AC2 is reported as pending human verification."
    },
    {
      "id": "H2",
      "kind": "data",
      "what": "The base URL of the real remote storage.",
      "why": "No source names the host; the owner passes it as options.baseUrl when publishing for AC2.",
      "blocking": false,
      "workaround": "Tests use a non-routable example host; the module never hard-codes a host."
    },
    {
      "id": "H3",
      "kind": "acceptance",
      "what": "The owner publishes one report to the real storage with the real token and reads back the stored id.",
      "why": "AC2 is marked verify: human.",
      "blocking": false,
      "workaround": "The deliverable merges with AC1 verified and AC2 recorded as pending owner verification."
    }
  ],
exit 0
```

Busca por valor de credencial (literal):

```text
$ grep -nE "REPORT_STORE_TOKEN\s*[=:]\s*\S|(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]" "<output>"
exit 1
```

Transcrição do subagent (saída de `tx.mjs`):

```text
models: claude-opus-5-5
tool_use: {"Bash":12,"Write":2}
AskUserQuestion calls: 0
last message is emit JSON: true
lines with ? in last message: 4
  "question": "Does E6 ship code that sends the request to the remote storage?",
  "question": "Where does the host of the remote storage come from, given that the card does not name it?",
  "question": "How does the access token reach the request headers?",
  "question": "What happens when the report has no usable id, or the id contains characters that would break the path?",
```

Estado do sandbox depois da execução:

```text
$ git status --porcelain (sandbox)
?? docs/superpowers/
```

### Execução c1-3

Check (literal):

```text
$ node "<specTool>" check "<output>" --roadmap "<sandbox>/docs/plans/roadmap-sandbox" --json
{
  "tool": "spec-tool",
  "schema": "spec/1",
  "path": "D:/projects/claude-play-wt/_tmp/E19/c1-3/docs/superpowers/specs/2026-11-12-E6-publish-remote-design.md",
  "errors": [],
  "warnings": [],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "exitCode": 0
  }
}
exit 0
```

Summary, trecho `needsPerson` (literal):

```text
$ node "<specTool>" summary "<output>" --json
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "The storage access token, provided through environment variable REPORT_STORE_TOKEN in the owner's shell when running criterion 2.",
      "why": "Criterion 2 publishes to the real remote storage, which only the owner can authenticate to.",
      "blocking": false,
      "workaround": "Criterion 1 and its tests use the fake literal test-token; criterion 2 stays pending until the owner runs it."
    },
    {
      "id": "H2",
      "kind": "data",
      "what": "The real storage base URL and confirmation that it accepts a Bearer authorization header and a PUT to /reports/<id> returning the stored id.",
      "why": "No source names the storage host or its auth scheme; R1 and R2 assume a configurable origin and Bearer.",
      "blocking": false,
      "workaround": "baseUrl is an argument and the header is built in one place, so a different origin or scheme is a one-line change after the owner answers."
    },
    {
      "id": "H3",
      "kind": "acceptance",
      "what": "The owner publishes one report with the real token and reads back the stored report id (criterion 2).",
      "why": "Criterion 2 is marked verify: human; no agent may perform or accept it.",
      "blocking": false,
      "workaround": "The deliverable merges with criterion 1 green and criterion 2 reported as an operator action."
    }
  ],
exit 0
```

Busca por valor de credencial (literal):

```text
$ grep -nE "REPORT_STORE_TOKEN\s*[=:]\s*\S|(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]" "<output>"
exit 1
```

Transcrição do subagent (saída de `tx.mjs`):

```text
models: claude-opus-5-5
tool_use: {"Bash":7,"Write":1}
AskUserQuestion calls: 0
last message is emit JSON: true
lines with ? in last message: 4
  "question": "Where does the storage origin in the URL come from?",
  "question": "How does the access token reach the request?",
  "question": "Does E6 ship code that sends the request?",
  "question": "How is the report id validated and placed in the path?",
```

Estado do sandbox depois da execução:

```text
$ git status --porcelain (sandbox)
?? docs/superpowers/
```

Aceite do critério 1: aguardando o dono.

## Critério 2: skill spec-writer num pedido fora de roadmap (uma execução)

As perguntas e a aprovação desta execução vieram do roteiro sintético `tools/measure/scenario/spec-writer-request.md` (marcado `<!-- synthetic input: ... not a person -->`), não de uma pessoa. Nenhuma chamada de `AskUserQuestion` foi feita. O orquestrador seguiu `plugins/productivity-tools/skills/spec-writer/SKILL.md` passo a passo no sandbox `D:/projects/claude-play-wt/_tmp/E19/c2`.

### Passo 1: leitura e tópico

O orquestrador leu o pedido (seção `## Request` do roteiro) e o código do sandbox: `package.json` (`"type": "module"`), `src/greet.mjs` e `tests/baseline.test.mjs` (`node:test`). Não existem `src/word-wrap.mjs` nem `tests/word-wrap.test.mjs`. O tópico ficou `word-wrap`. Spec existente:

```text
$ test -e docs/plans/word-wrap/spec.md && echo EXISTS || echo "no existing spec"
no existing spec
```

Por isso a pergunta de sobrescrever ou manter os dois não entrou na rodada.

### Passo 2: a rodada que seria feita (literal) e as respostas do roteiro

Uma única chamada de `AskUserQuestion` com quatro perguntas, a opção recomendada primeiro:

1. "What should happen when width is below 1?" (header `Width < 1`). Opções: "Throw a RangeError (Recommended)", "Clamp width to 1", "Return the text unchanged". Resposta do roteiro: "throw a RangeError".
2. "Should leading and trailing spaces of a line be kept?" (header `Trim`). Opções: "No, trim them (Recommended)", "Yes, keep them". Resposta do roteiro: "no, trim them".
3. "How should line breaks already in the text be handled?" (header `Newlines`). Opções: "Keep them as hard breaks (Recommended)", "Treat them as spaces and reflow". Resposta do roteiro: a recomendada ("For any other question, take the recommended option").
4. "What should wordWrap return?" (header `Return`). Opções: "A string with lines joined by \n (Recommended)", "An array of lines". Resposta do roteiro: a recomendada.

A pergunta roteirizada "Where should the spec be written?" não entrou na rodada. O SKILL.md fixa o caminho `docs/plans/<topic>/spec.md` e só faz do caminho uma pergunta quando o spec já existe. A resposta do roteiro (`docs/plans/word-wrap/spec.md`) coincide com esse caminho.

Perguntas na rodada: 4 (limite 5).

### Passo 3: despacho do autor (forma de reserva)

Prompt de chamada, depois do corpo literal do agente:

```text
mode: interactive
output: D:/projects/claude-play-wt/_tmp/E19/c2/docs/plans/word-wrap/spec.md
specTool: D:/projects/claude-play-wt/E19/plugins/productivity-tools/scripts/spec-tool.mjs
topic: word-wrap
language: English
intake: Request (verbatim): "Add a small `wordWrap(text, width)` function in `src/word-wrap.mjs` that breaks text into lines of at most `width` characters at word boundaries. A word longer than `width` stays on a line of its own. Tests go in `tests/word-wrap.test.mjs`." Repository root: D:/projects/claude-play-wt/_tmp/E19/c2 (ESM package, node:test; existing code src/greet.mjs, tests/baseline.test.mjs). Answers (verbatim): Q "What should happen when width is below 1?" -> "Throw a RangeError". Q "Should leading and trailing spaces of a line be kept?" -> "No, trim them". Q "How should line breaks already in the text be handled?" -> "Keep them as hard breaks (Recommended)". Q "What should wordWrap return?" -> "A string with lines joined by \n (Recommended)". Guesses (not confirmed by the person): runs of spaces between words inside a line collapse to one space; width is counted in UTF-16 code units (String length).
```

`output` foi passado como caminho absoluto dentro do sandbox, como pede o plano. O SKILL.md escreve o caminho relativo `docs/plans/<topic>/spec.md` (ver ambiguidade 2).

A última mensagem do autor foi o JSON de `emit`, com `id: word-wrap`, `mode: interactive`, sete critérios (AC1 a AC7, todos `{verify: test; ...}`), quatro `rulings` (R1 a R4), `needsPerson: []`, `externalEffects: []` e cinco casos de borda. Transcrição (saída de `tx.mjs`):

```text
models: claude-opus-5-5
tool_use: {"Bash":8,"Write":2}
AskUserQuestion calls: 0
last message is emit JSON: true
lines with ? in last message: 5
  "question": "How are runs of whitespace between words inside a line handled?",
  "question": "In what unit is width counted?",
  "question": "What happens when width is not an integer (1.5, NaN, Infinity)?",
  "question": "Is \\r\\n treated as a hard break?",
  "decision": "Yes: the text is split on /\\r?\\n/ and output lines are always joined with \\n.",
```

### Passo 4: summary e o pedido de aprovação que seria feito (literal)

Saídas literais das conferências:

```text
$ test -f "<output>"
exit 0
$ node "<specTool>" check "<output>" --json
{
  "tool": "spec-tool",
  "schema": "spec/1",
  "path": "D:/projects/claude-play-wt/_tmp/E19/c2/docs/plans/word-wrap/spec.md",
  "errors": [],
  "warnings": [],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "exitCode": 0
  }
}
exit 0
$ node "<specTool>" summary "<output>"
## Decisões

| ID | Decisão | Custo se errada | Reversível | Alcance | Contradiz | Para |
|---|---|---|---|---|---|---|
| R1 | Any run of whitespace other than a line break (spaces, tabs) separates words and is collapsed to one space in the output. | low | true | local |  |  |
| R2 | UTF-16 code units, i.e. JavaScript String length. | low | true | contract |  |  |
| R3 | Throw RangeError, the same error as for width below 1. | low | true | contract |  |  |
| R4 | Yes: the text is split on /\r?\n/ and output lines are always joined with \n. | low | true | contract |  |  |

## Pessoas

| ID | Tipo | O quê | Bloqueia | Contorno | BLQ | Para |
|---|---|---|---|---|---|---|

## Efeitos externos

| ID | O quê | Alvo |
|---|---|---|

exit 0
$ git status --porcelain (sandbox)
?? docs/plans/word-wrap/
```

O pedido de aprovação, um só, que seria mostrado depois da tabela acima: "Approve the spec at docs/plans/word-wrap/spec.md?", com as opções "Approve (Recommended)", "Request a change" e "Refuse". Resposta do roteiro (`## Approval`): `approved`. Sem pedido de mudança, não houve segundo despacho do autor nem segunda aprovação.

### Passo 5: relato

O relato ao fim da skill: "Spec written at docs/plans/word-wrap/spec.md (check exit 0). The implementation plan comes from plan-writer once it exists." A skill não commitou. O sandbox mostra o spec só como arquivo não rastreado.

### Conferências do critério 2

| Conferência | Esperado | Obtido | Resultado |
|---|---|---|---|
| spec gravado em `docs/plans/<tópico>/spec.md` (no sandbox) | arquivo existe | `test -f` exit 0, `docs/plans/word-wrap/spec.md` | PASS |
| `node "<specTool>" check "<output>" --json` | exit 0 | exit 0, 0 erro, 0 aviso | PASS |
| perguntas da rodada | ≤ 5, numa chamada | 4, numa chamada (registrada, não feita) | PASS |
| aprovações pedidas | 1 | 1 (registrada, respondida pelo roteiro) | PASS |
| `AskUserQuestion` do autor | 0 | 0 | PASS |

### Ambiguidades do SKILL.md encontradas ao segui-lo

1. A recusa "Do not paste the agent body into the prompt" contradiz a forma de reserva que o plano e a spec mandam usar quando o tipo do plugin não está carregado. Esta execução seguiu o plano e colou o corpo. O SKILL.md não prevê nenhuma alternativa sancionada.
2. `output: docs/plans/<topic>/spec.md` é relativo e não diz a que raiz se refere (raiz do repositório, cwd da sessão ou cwd do subagent). Para `specTool` o texto exige caminho absoluto, mas para `output` não. Esta execução passou caminho absoluto dentro do sandbox, como pede o plano.
3. "one `key: value` per line" não diz como levar o `intake`, que tem várias linhas (pedido e respostas). Esta execução pôs o `intake` numa linha só.
4. O passo 4 manda pedir "one approval", mas não diz por qual meio (`AskUserQuestion` ou texto) nem com quais opções. Uma segunda chamada de `AskUserQuestion` convive mal com "one round". As opções registradas acima são do orquestrador.
5. O SKILL.md não diz o que fazer quando o autor devolve a saída de `check --json` com erro depois da terceira tentativa, em vez do JSON de `emit`. O passo 4 roda `summary` de qualquer jeito.
6. Não fica claro se a pergunta sobre spec existente (passo 1) conta dentro do limite de cinco, nem o que sai da rodada se ela for a sexta.
7. O caso de zero perguntas (tudo resolvido pelo pedido ou pelo código) não está descrito: o texto não diz se a chamada de `AskUserQuestion` é pulada.
8. A pessoa não tem como escolher outro caminho para o spec fora do caso "spec existente". O roteiro sintético previa justamente "Where should the spec be written?".
9. O passo 4 mostra a saída de `summary` sem regra de idioma. Os títulos saem em português ("Decisões", "Pessoas") mesmo com `language: English`. Isso vem de `spec-tool.mjs`, que esta entrega não edita.

## Revisão adversarial somente leitura (passo 4 do plano)

Revisor: subagent `general-purpose`, `model: sonnet`, instruído a não editar. Achados literais:

> **A. Produced spec**
>
> 1. **Medium.** The spec adds scope the request never asked for.
>    - R3 and AC3 extend the RangeError to non-integer widths (1.5, NaN, Infinity). The person's answer covered only "below 1".
>    - The Design paragraph for AC3 says "per the person's answer. Per R3 it also throws...", so the split is visible. But the AC3 text in the data block reads "A width below 1 (or not an integer) throws", with no ruling marker. A reader of the AC alone would take it as the person's requirement.
>    - R3 is tagged `costIfWrong: low`, but it is a `contract` change, and it is in the AC rather than only in the rulings.
>
> 2. **Medium.** R4 invents a `\r\n` requirement. Its basis ("Windows checkouts with core.autocrlf") is speculation, and no intake guess covers it. AC5's design text builds the CRLF behaviour in with no criterion or edge case for it. The `\r\n` handling is untestable from the ACs, because the AC5 text mentions only "line breaks".
>
> 3. **Medium.** R1 contradicts the person's answer to question 3, or at least blurs it.
>    - Hard breaks are kept, but R1 says "any run of whitespace other than a line break (spaces, tabs)" is collapsed. The Design splits words "on runs of whitespace" with no line-break exclusion, and the paragraphs are split on `\n` first. So the two agree only because of ordering, and the text never states it.
>    - A lone `\r` or a `\f` or `\v` is ambiguous.
>    - Collapsing inner spaces goes beyond the request, and "trim" is stretched into "collapse". R1 is marked as a guess, which is honest.
>
> 4. **Low.** AC4 reads "Leading and trailing spaces of every output line are trimmed", but a collapse of inner runs is also implied and has no AC. Only C3 touches it, and C3 has `   hello   world   `, whose inner run is collapsed, so C3 tests R1 too. Fine, but R1 has no AC of its own.
>
> 5. **Low.** The intake guess about width counted in UTF-16 code units appears as R2 and is ruled `contract` scope. It is also stated in the Out scope as "Unicode grapheme... counting". Consistent.
>
> 6. **Medium.** The ACs and edge cases check out by hand with one gap.
>    - C1: `a abcdefghij b` at 4 gives "a", the long word alone, then "b", matching AC2.
>    - C2 matches AC3. C3 matches AC4. C4 matches AC5. C5 matches AC6.
>    - Gap: nothing tests a normal wrap boundary (a line of exactly `width`). The AC1 test is only described in prose ("a multi-word sentence"), with no concrete input or expected value.
>    - The "every line has length at most width when no word exceeds it" check follows from the greedy rule.
>    - Edge: C5 passes `wordWrap('', 5)`, but AC6 also says whitespace-only input returns `""`. With the paragraph model, `"   \n   "` would give `"\n"`, not `""`. This contradicts AC6 ("whitespace-only input returns an empty string") for any input containing a newline. Whitespace-only counts newlines as whitespace to most readers. Severity medium.
>
> 7. **Low.** Scope "Do not touch `docs/plans/roadmap-sandbox/`", `package.json`, `src/greet.mjs` and `tests/baseline.test.mjs`. These are sandbox-specific. They are probably real, since the agent read the sandbox, but they are not in the request.
>
> 8. **Low.** AC7 (whole suite passes) is not in the request. It is a reasonable derived criterion, but it was not marked as a ruling.
>
> **B. SKILL.md**
>
> 1. **High.** Fallback dispatch contradicts the refusal. Line 31 says "Do not paste the agent body into the prompt", but the run used exactly that. The skill has no sanctioned fallback for when `productivity-tools:spec-author` is not registered in a worktree or sandbox. Either permit it or drop the refusal.
>
> 2. **High.** Paths are never anchored. `output: docs/plans/<topic>/spec.md` is relative, with no statement of which root (the repo root, the cwd). The spec-author's contract says `output` is "path of the spec", and `specTool` alone is called absolute. A subagent's cwd can differ. The run had to use an absolute sandbox path, which contradicts the literal text in step 3.
>
> 3. **Medium.** Step 1 says the spec path is fixed, but the person may want another place. There is no question for it, and "Where should the spec be written?" is a plausible scripted question. The skill gives no way to override the path.
>
> 4. **Medium.** The existing-spec question counts toward the five? Step 1 says "make that one of the questions", so it does count, but step 2 does not say what to drop when five other questions are already needed.
>
> 5. **Medium.** The zero-question case is unspecified. Step 2 says "skip anything settled", but if nothing remains, can `AskUserQuestion` be skipped? There is no statement of the intake note then.
>
> 6. **Medium.** The intake format conflicts with "one key: value per line". The intake holds the request plus four answers verbatim, which is multi-line. Step 3 gives no encoding (the run squeezed it onto one line, which loses structure). The agent contract says the same.
>
> 7. **Medium.** Step 4 does not say how to ask for approval. It does not say whether to use `AskUserQuestion` (another call, after the "one call" in step 2 — a possible conflict with "one round") or plain text. The options "Approve / Request a change / Refuse" are the orchestrator's invention.
>
> 8. **Medium.** No handling of an agent failure result. The agent's last message is `emit` JSON, or the failing `check --json` output after three tries. Step 4 runs `summary` regardless, with no branch for a failed check or non-zero exit. It also does not say whether to parse the JSON.
>
> 9. **Low.** After a change request, step 4 runs `check` but not `summary`, so the person never sees the revised decisions. It also means a second agent call after "one agent call".
>
> 10. **Low.** "This skill does not commit and never commits" is redundant. Step 5 mentions `plan-writer`, which the description says is not yet available ("once it exists").
>
> 11. **Low.** `${CLAUDE_SKILL_DIR}` guidance is fine. `node "<specTool>"` quoting versus the permission rule `Bash(node *spec-tool.mjs" *)` is consistent only if the path is quoted.
>
> **C. Recorded round**
>
> Compliant on count (4 ≤ 5), single call, recommended first, and the path question skipped. Two concerns:
> - Questions 3 and 4 are not obviously "only the person can answer". Return type and hard-break handling were options the agent could rule itself, as it did for R1 to R4. Asking them is allowed, but it spent the budget while the real unknowns (whitespace collapsing, non-integer width) went to guesses.
> - The existing-spec check was never recorded as having been done, only asserted ("no spec existed").
> - Question 3 ("Treat them as spaces and reflow") is distinct from the request, so it was not settled by it. Fine.

Nota do orquestrador sobre o achado C, segundo item: a checagem do spec existente foi feita e está registrada no passo 1 acima (`no existing spec`). O revisor não recebeu essa saída.

Os achados não reprovam nenhuma conferência dos critérios: o spec do critério 2 passa no `check`, e o critério não exige qualidade de conteúdo além disso. Os achados B1 a B8 batem com as ambiguidades listadas acima e ficam para o dono decidir se voltam à Tarefa 4.

Aceite do critério 2: aguardando o dono.

## Limpeza

`D:/projects/claude-play-wt/_tmp/E19/` foi apagado depois das conferências. Os scripts descartáveis (`c1-check.sh`, `tx.mjs`, `frag.mjs`) ficaram fora do repositório, no diretório temporário da sessão.
