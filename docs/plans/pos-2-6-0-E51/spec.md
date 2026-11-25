# Spec E51 -- Arnês de medição pronto para a base nova

Entregável E51 do roadmap pós-2.6.0 (`docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, card E51; REQ-016 a REQ-019; sem dependências). Detalhe técnico nas tarefas E1 a E4 do bloco E de `docs/plans/2026-11-25-correcoes-issues-plan.md` (issues #21, #22, #23 e #26). Nenhuma execução paga acontece nesta spec nem no plano que sair dela: todo teste é offline, com `exec` simulado.

## Intenção

O lote de base nova do E53 (DEC-017) roda `run-batch.mjs` com parada em opus e retomada, e precisa de quatro coisas que o arnês ainda não faz: fixar e conferir o modelo de cada fase (a execução 3 do E39 retomou em sonnet sem aviso, DEC-058 do pós-2.3.0), guardar as transcrições de toda tentativa com um `SHA256SUMS` conferível, trazer no `aggregate.json` o custo por tentativa que os tetos da DEC-017 usam, e limpar os resíduos do arnês do E30 que a #26 lista (gate vazio, regra inerte, `parentMention`).

## Escopo

**Dentro:**

- `tools/measure/run-batch.mjs`: `--model` obrigatório; `sessionModels` e `modelDivergence` por tentativa e no aggregate; cópia das transcrições para `private/transcripts/<k>/`; `SHA256SUMS` na raiz da pasta de saída; `attempt.costUsd` em toda tentativa válida e `aggregate.cost.total`; formatos novos do gate vazio em `coordinatorGateVazio`; `parentMention` em `mentionStats`.
- `tools/measure/make-scenario.mjs`: tirar a regra inerte de `SANDBOX_RELEASE_RULES`.
- `tools/measure/defects/manifest.json`: campo `parentMention` no CR3.
- Testes: `tools/measure/run-batch.test.mjs`, `tools/measure/make-scenario.test.mjs` e `tools/measure/roteiro-e17.test.mjs` (ajuste forçado pela regra removida).
- `.claude/rules/measure.md`: `--model` obrigatório, onde ficam transcrições e `SHA256SUMS`, e a diferença entre `counters.cost` e `costUsd`.

**Fora:**

- `E5_PATHS` e as variantes legadas `plano-semeado` e `codigo-semeado` ficam congelados (DEC-016, DEC-019).
- A medição paga (#25, E5 do bloco E) é do E53, com teto e regras da DEC-017.
- `run-baseline.mjs` não muda de CLI: continua aceitando `--model` opcional; sem ele, cada variante falha na guarda do `runBatch` antes de qualquer `claude -p` (ver R1).
- O tratamento de `modelDivergence` no lote (invalidar, repetir, ressalvar) é do E53.
- Nenhuma mudança em `plugins/`, nem bump de versão (DEC-003, DEC-042 do repositório): `tools/measure` não é publicado.

**O que não fazer:**

- Não alterar `tools/measure/fixtures/workflow-com-single/roadmap-release.js` (restrição geral do plano).
- Não mudar o significado de `counters.cost`: `baseline.mjs:122` e `baseline.mjs:236` e `checkpoint.mjs:23` o leem como custo só dos papéis.
- Não mudar os outros usos de `mention` (o `rx` de `mentionedAfterFix` em `mentionStats` e `recountWithoutMention`).
- Não gravar transcrição nem caminho pessoal fora de `private/`; não commitar nada de `tools/measure/out/`.
- Não rodar `run-batch.mjs`, `run-baseline.mjs` nem `run-trigger.mjs` de verdade.

## Desenho

### AC1 -- `--model` obrigatório e `modelDivergence`

`parseCli` (`run-batch.mjs`, perto da linha 2724) continua devolvendo `null` quando falta um dos argumentos já obrigatórios (o `USAGE` sai como hoje). Depois dessa checagem, se `o.model` for ausente ou string vazia, lança `UsageError('--model is required: every attempt runs claude -p, and the batch must pin the model (#21)')`. A resposta do dono (Q3) fixa os valores: qualquer string não vazia, repassada como está ao `claude -p` por `promptArgs` (linha 254, que já repassa), sem lista fixa. O `USAGE` passa a mostrar `--model <m>` entre os obrigatórios. A mesma guarda entra no começo de `runBatch` (linha 2340), antes de `prepareHarness`, de `mkdirSync` e do `claude --version`, para que chamadas programáticas (testes e `run-baseline.mjs:285`) também sejam recusadas sem custo (R1).

O modelo efetivo de cada fase vem das transcrições principais: para cada sessão, o `<configDir>/projects/<slug>/<sid>.jsonl`, só as linhas sem `isSidechain`, deduplicadas por `dedupeMessages` e classificadas por `family` (os dois já exportados de `session-metrics.mjs:23` e `:30`; `readJsonl` em `:10`); a família com mais mensagens é a da fase; sem mensagem nenhuma, `null` (R3). Nas variantes com parada (`stop !== null`), a fase `parada` são as sessões `sessions.slice(0, resumeFrom)` e a `retomada` são `sessions.slice(resumeFrom)` (`resumeFrom` é fixado na linha 2457); sem retomada, `retomada: null`. Nas demais variantes, todas as sessões formam uma fase só, `sessao` (R5). `modelDivergence` é `true` quando alguma fase não nula tem família diferente de `family(opts.model)`; se o modelo pedido não tiver família conhecida (`other`), compara as fases não nulas entre si (R4). O cálculo acontece logo depois do laço de prompts da tentativa, e os dois campos entram em toda tentativa com sessões pelo `extra()` (que já é espalhado em todo `attempts.push` de tentativa inválida e válida), e não em `denied` nem em `preflight-processo-matador`. No aggregate entram `requestedModel` (a string pedida) e `modelDivergence` (lista dos `n` das tentativas com divergência, vazia quando nenhuma). Pela resposta do dono (Q4), a divergência não invalida a tentativa: só marca e escreve no stderr `run-batch: warning: attempt <k> model divergence: requested <m>, <fase> <família>, ...`.

Testes em `run-batch.test.mjs`: `parseCli(CLI_BASE)` sem `--model` lança `UsageError`, e com `--model ''` também; `runBatch(baseOpts(s, { model: undefined }))` rejeita com `UsageError` sem nenhuma chamada a `claude`; uma tentativa `parada-retomada` simulada (o `makeFake` ganha uma opção que reescreve `message.model` da transcrição copiada por número de chamada) com parada em opus e retomada em sonnet e `--model opus` sai com `sessionModels: { parada: 'opus', retomada: 'sonnet' }`, `modelDivergence: true`, o `n` na lista do aggregate e o aviso no stderr; com as duas fases em opus, `false` e lista vazia. O risco do card (exigir `--model` quebra os testes atuais) é tratado no mesmo entregável: `baseOpts` (`run-batch.test.mjs:101`) ganha `model: 'opus'` (e com isso `seededOpts` e `taskOpts`), e `CLI_BASE` (`:3401`) ganha `'--model', 'opus'`.

### AC2 -- Transcrições em `private/` e `SHA256SUMS`

Logo depois do laço de prompts da tentativa, antes do ramo `denied` e de qualquer `continue`, para toda tentativa com sessões (válida, inválida ou negada), cada sessão é procurada em `<configDir>/projects/*/` e o `<sid>.jsonl` e a pasta `<sid>/` (subagentes e diários; a mesma estrutura que `readSessionJournals` em `run-batch.mjs:324` e `listAgents` em `session-metrics.mjs:258` leem) são copiados com `cpSync(..., { recursive: true })` para `<dir>/private/transcripts/<k>/` (R6). Sessão não encontrada ou erro de cópia vira aviso no stderr (`run-batch: warning: transcript <sid> of attempt <k> not copied: ...`) e não muda o status da tentativa.

Depois de gravar `aggregate.json` (linha 2717), `runBatch` grava `<dir>/SHA256SUMS`, no formato fixado pelo dono (Q1): cobre `aggregate.json` e todo arquivo sob `private/` (transcrições, `attempts*.json`, `metrics/`, `sentinel.log`); cada linha é `<sha256 em hex minúsculo><dois espaços><caminho relativo a dir com />`; linhas ordenadas pelo caminho; final de linha LF, com LF no fim; o próprio `SHA256SUMS` não é listado. O resultado confere com `sha256sum -c SHA256SUMS` rodado em `dir`. Uma falha ao gerar vira aviso e não muda `exitCode`. Pela resposta do dono (Q5), as transcrições ficam só em `private/`, que já é saída fora do repositório ou sob `tools/measure/out/` (gitignored, `.claude/rules/measure.md`); o relatório e o `measurements.md` do E53 levam só caminhos e hashes.

Teste em `run-batch.test.mjs` com `configDir` fictício: um lote de 2 com a segunda chamada falhando (`failOn`) deixa uma válida e uma inválida; `private/transcripts/1/` e `private/transcripts/2/` têm o `.jsonl` e a pasta da sessão; o teste lê `SHA256SUMS`, confere a forma de cada linha (`/^[0-9a-f]{64}  [^\\]+$/`), a ordem, o LF, a ausência de `SHA256SUMS`, que a lista é exatamente `aggregate.json` mais os arquivos sob `private/`, e recalcula cada hash com `createHash('sha256')`.

### AC3 -- `parentMention` no CR3

O CR3 de `tools/measure/defects/manifest.json` (linhas 532 a 545) ganha `"parentMention"`, um regex sobre o texto do achado pai, o C5 ("truncate swallows the RangeError and returns an empty string when max is 0"), como pede a DEC-753 do roadmap de evolução: `truncate.*(swallow|RangeError|empty string|max(imum)? (is |of |= ?)?0|zero)|(swallow|RangeError|empty string).*truncate` (R8). Em `mentionStats` (`run-batch.mjs:684`), o filtro dos achados pai da revisão 1 passa a usar `new RegExp(m.parentMention ?? m.mention, 'is')`; o `rx` de `m.mention` continua sendo o de `mentionedAfterFix`, e a guarda `typeof m.mention !== 'string'` fica.

Testes: em `run-batch.test.mjs`, `mentionStats` com `fixIds` `['CR3', 'CG2']` e uma revisão 1 com um achado no texto de C5 (que não casa o `mention` do CR3) dá `residuoSemAchadoPai: 0`; sem esse achado, `1`. Em `make-scenario.test.mjs`, o `parentMention` do CR3 compila com as flags `is`, casa `file + ' ' + description` do C5 e pelo menos 3 paráfrases do achado pai, e o teste B1 (linha 1050) continua verde.

### Peças sem critério próprio no card (cobertas pelos mesmos comandos de evidência)

- **Custo por tentativa (REQ-018):** `attempt.costUsd = attemptCostUsd(attempt)` logo depois de montar o `attempt` (linha 2653), em toda tentativa válida; a linha do ramo lentes (2662) sai por redundância (`lensAttemptStats` não toca `counters` nem `rolesByLabel`). `aggregate.cost.total` é a soma de `costUsd` das válidas, `null` sem nenhuma válida (R7). `counters.cost` fica como está, com um comentário no código dizendo que é só dos papéis e é lido por `baseline.mjs` e `checkpoint.mjs`. Teste perto do teste A5 (`run-batch.test.mjs:2101`): com `total_cost_usd` simulado maior que transcrição mais papéis, `costUsd` é o custo da CLI e `cost.total` a soma.
- **Gate vazio (REQ-019):** `coordinatorGateVazio` (linha 1598) tira o ANSI do `tail` (`/\x1b\[[0-9;]*[A-Za-z]/g`) e reconhece `tests 0` e `pass 0` em começo de linha com prefixo `# ` (TAP) ou `ℹ ` (reporter spec do node), mais a forma de uma linha `(\d+) tests, (\d+) pass, (\d+) fail`, vazio quando tests ou pass for 0 (resposta do dono, Q2). O prefixo `ℹ ` (U+2139 e espaço) foi conferido no reporter spec do Node 26.13.1 nesta máquina (`ℹ tests 1`, `ℹ pass 1`). A forma de uma linha tem **origem não identificada**: nenhum produtor no código, só citada pela nota S2-15 do arnês antigo; só a variante coordinator usa essa conferência, e o lote do E53 não a roda, então nada bloqueia. Testes perto de `run-batch.test.mjs:3553` a `:3573`: um caso por forma (spec com ANSI, spec sem ANSI, uma linha com 0 tests, uma linha com 0 pass, uma linha com testes passando).
- **Regra inerte (REQ-019):** `SANDBOX_RELEASE_RULES` (`make-scenario.mjs:56`) perde `Workflow(productivity-tools:roadmap-release)`, a regra inerte que a #26 aponta (o preflight exige só `Workflow(productivity-tools:release-workflow)`, `preflight.mjs:214`). Os testes que afirmam os 4 primeiros (`make-scenario.test.mjs:349` e o teste E17 perto de `:499`) passam a afirmar a lista inteira de 5 e a ausência da regra; `roteiro-e17.test.mjs:37` passa de `>= 6` para `>= 5`, e o laço que exige `--allow` de cada regra no roteiro fica (R9). Nenhum teste é apagado.
- **Documentação:** `.claude/rules/measure.md` ganha um item curto: `--model` obrigatório; transcrições em `private/transcripts/<k>/` e `SHA256SUMS` na raiz da saída; `costUsd` e `cost.total` são o custo dos tetos, `counters.cost` é só dos papéis (R10).

## Deixado para o plano

- Ordem das tarefas e divisão em fatias (as quatro peças do card são independentes; AC1 primeiro, porque mexe em `baseOpts` e todos os outros testes dependem disso).
- Forma exata da opção nova do `makeFake` para o modelo por chamada e da simulação de `total_cost_usd` maior.
- Texto final dos avisos no stderr e posição exata das funções auxiliares (`sessionFamily`, `copyTranscripts`, `writeSums`) dentro de `run-batch.mjs`.
- Medir o tempo da suíte: as cópias de transcrição e os hashes rodam em todo teste de `runBatch`.

```json data
{
  "schema": "spec/1",
  "id": "E51",
  "title": "Arnês de medição pronto para a base nova",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um run-batch sem --model, quando é chamado, então recusa com UsageError; com parada em opus e retomada em sonnet, marca modelDivergence. {verify: test; evidence: node --test tools/measure/run-batch.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado um lote com tentativa válida e inválida, quando termina, então as transcrições das duas estão em private/ e o SHA256SUMS confere. {verify: test; evidence: node --test tools/measure/run-batch.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado o CR3 do manifest, quando mentionStats roda, então usa parentMention para achar o achado pai. {verify: test; evidence: node --test tools/measure/run-batch.test.mjs tools/measure/make-scenario.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica a guarda do --model obrigatório?",
      "decision": "Em parseCli (UsageError depois da checagem dos obrigatórios atuais) e no começo de runBatch, antes de qualquer efeito; baseOpts e CLI_BASE dos testes ganham model opus.",
      "basis": "O card pede recusa com UsageError para o run-batch; a guarda em runBatch cobre também chamadas programáticas como run-baseline.mjs, sem custo, e o risco do card manda ajustar baseOpts no mesmo entregável.",
      "alternative": "Guarda só em parseCli, deixando runBatch e run-baseline aceitarem lote sem modelo fixado.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como medir o modelo efetivo de uma fase?",
      "decision": "Família dominante das mensagens deduplicadas da thread principal (sem isSidechain) dos <sid>.jsonl da fase, com family e dedupeMessages de session-metrics.mjs; null sem mensagem.",
      "basis": "O --model fixa o modelo da sessão principal; os subagentes têm modelo próprio e misturá-los faria toda fase parecer divergente.",
      "alternative": "Família dominante de todas as mensagens, incluindo subagentes.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Contra o que modelDivergence compara?",
      "decision": "Contra family(opts.model): true quando alguma fase não nula tem outra família; se o pedido for de família other, compara as fases não nulas entre si.",
      "basis": "Pega o caso da DEC-058 (retomada em sonnet com opus pedido) e também o de duas fases no modelo errado, que a comparação só entre fases deixaria passar.",
      "alternative": "Comparar só parada contra retomada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Qual a forma de sessionModels e da marca no aggregate?",
      "decision": "Por tentativa, sessionModels { parada, retomada } nas variantes com parada e { sessao } nas demais, mais modelDivergence booleano; no aggregate, requestedModel e modelDivergence como lista dos n divergentes.",
      "basis": "Não dá nome de parada a fase que não parou, e a lista diz ao E53 quais tentativas ressalvar sem reler cada uma.",
      "alternative": "Sempre { parada, retomada }, com retomada null nas variantes de uma fase, e um booleano único no aggregate.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Quais tentativas têm transcrições copiadas e quando?",
      "decision": "Toda tentativa com sessões, inclusive negada, logo depois do laço de prompts e antes de qualquer continue; falha de cópia vira aviso.",
      "basis": "O card exige as transcrições da válida e da inválida; copiar no mesmo ponto para a negada custa nada e preserva a evidência de por que foi negada.",
      "alternative": "Copiar só tentativas válidas e inválidas, deixando as negadas de fora.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "O que cost.total soma e quanto vale sem tentativa válida?",
      "decision": "Soma de costUsd das tentativas válidas; null quando não há válida.",
      "basis": "O plano E3 fixa a soma das válidas (inválida não tem rolesByLabel); null segue o padrão de cost.median e cost.session sem dados.",
      "alternative": "Somar também o total_cost_usd da CLI das inválidas, ou 0 sem válida.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Qual o valor de parentMention no CR3?",
      "decision": "O regex truncate.*(swallow|RangeError|empty string|max(imum)? (is |of |= ?)?0|zero)|(swallow|RangeError|empty string).*truncate, com as flags is.",
      "basis": "A DEC-753 pede o texto do C5; o regex casa a descrição do C5 e paráfrases dela, e o contador é só auxiliar (DEC-737: o desfecho vem do sentinela).",
      "alternative": "Reaproveitar o mention do C5 da variante nativa, que não existe no manifest.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como ajustar os testes que contam as regras do sandbox depois de tirar a regra inerte?",
      "decision": "make-scenario.test.mjs afirma a lista inteira de 5 e a ausência da regra inerte; roteiro-e17.test.mjs passa de >= 6 para >= 5 e mantém o laço que exige cada regra no roteiro.",
      "basis": "A remoção é o pedido da #26; a afirmação da lista inteira aperta mais do que a contagem antiga afrouxa, e nenhum teste é apagado.",
      "alternative": "Apagar a checagem de contagem do roteiro-e17.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Onde documentar as regras novas do arnês?",
      "decision": "Um item curto em .claude/rules/measure.md, que carrega ao tocar tools/measure.",
      "basis": "O plano E3 pede o comentário em measure.md; é a regra escopada que todo agente lê ao editar o arnês.",
      "alternative": "Só comentários no código de run-batch.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "run-batch chamado com --model seguido de string vazia.",
      "expected": "UsageError, como sem --model."
    },
    {
      "id": "C2",
      "input": "Tentativa parada-retomada que falha antes da retomada.",
      "expected": "sessionModels.retomada é null e não conta para modelDivergence; a transcrição da parada é copiada."
    },
    {
      "id": "C3",
      "input": "Sessão registrada cujo <sid>.jsonl não existe no configDir.",
      "expected": "Aviso no stderr, fase sem família (null), status da tentativa inalterado, SHA256SUMS gerado com o que existe."
    },
    {
      "id": "C4",
      "input": "Saída do gate do reporter spec com códigos ANSI de cor e ℹ tests 0.",
      "expected": "coordinatorGateVazio devolve vazio true."
    },
    {
      "id": "C5",
      "input": "Lote sem nenhuma tentativa válida.",
      "expected": "aggregate.cost.total é null; SHA256SUMS cobre aggregate.json e private/."
    }
  ]
}
```
