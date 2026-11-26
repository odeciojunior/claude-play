# Plano E48 -- Paralelismo liberado por argumento

Spec: `docs/plans/pos-2-6-0-E48/spec.md`. Cobre REQ-012 (#28), com as decisões DEC-004, DEC-005, DEC-006, DEC-007, DEC-008, DEC-012, DEC-021, DEC-036 e DEC-037. Branch `plan/pos-2-6-0-E48`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E48`, com merge em `release/pos-2.6.0` depois da conferência. Pré-condição: o merge do E47 já está commitado em `release/pos-2.6.0` (sem `MERGE_HEAD`), com o G1 do merge passado e a contagem registrada em `log.md`. Só então commitar este plano e criar o worktree a partir de `release/pos-2.6.0`, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E48 D:/projects/claude-play-wt/pos-2-6-0-E48 release/pos-2.6.0`). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz de `D:/projects/claude-play-wt/pos-2-6-0-E48` (rodados em outro checkout, testam outro código e dão verde falso).

O código foi lido com o merge do E47 aplicado na árvore de `release/pos-2.6.0`. Os trechos são citados por símbolo, não por número de linha.

Duas tarefas em sequência: o argumento no workflow com os testes, e as frases dos docs. Um commit por tarefa, feito pelo coordinator depois dos checks: o executor não commita, e nenhum check depende do commit.

O ruling R3 substitui a exigência da spec (seção "Fora", `spec.md:17`) de levar a linha `paridade agy: pendente #13` nos commits que tocam o `roadmap-release.js`: ela vai só no commit de merge, e o commit da Tarefa 1 sem a linha não é divergência. No caminho agy, o efeito se limita ao `withoutApprove` puro do `.js` avaliado pelo `roadmap-release-agy.py`, que não muda.

## Testes: o que roda e quando

- Piso do G1: a contagem do merge do E47 registrada em `docs/plans/roadmap-pos-2-6-0/log.md`, nunca abaixo de tests 2713 e pass 2711, com exit 0 e fail 0.
- DEC-036: nenhum check de tarefa inclui `roadmap-release-agy.test.mjs`, `run-batch.test.mjs`, `make-scenario.test.mjs` nem o G1 completo.
- O gate de onda é do coordinator, depois de cada onda, e não é repetido nos checks: `node --test "plugins/**/!(roadmap-release-agy).test.mjs" ".claude/hooks/*.test.mjs" "tools/**/!(run-batch|make-scenario).test.mjs"`.
- Cada check precisa terminar com folga abaixo de 600 s.
- DEC-037: falha isolada do teste de processos "... ended by its own port kill, with its subtree" (`verify-run.test.mjs`) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.
- Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree. Não rodar suíte enquanto outra execução de testes corre em outro worktree.

## Medida de tamanho

Antes e depois da Tarefa 1, medir os caracteres LF do `roadmap-release.js` e informar os dois números no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length;console.log(n)"
```

A partida medida na escrita do plano é 271.859. O teto do E48 (B6) é de 700 caracteres LF de delta líquido entre o commit anterior à Tarefa 1 e o commit da tarefa. Entre 700 e 840, o executor enxuga até caber no teto e não marca a tarefa como pronta antes disso. Acima de 840, parar e voltar ao dono via subagente opus (DEC-007, DEC-021). A trava de 284.500 não muda; se o orçamento apertar, o E48 é o primeiro a sair (DEC-005, DEC-006).

O check de tamanho compara o arquivo do worktree com a versão mais nova do histórico que ainda não tem a marca `parallelOk`, então vale antes e depois do commit e com commits de correção.

Com os textos da Tarefa 1 aplicados em memória na escrita do plano, o delta foi de 508 caracteres (272.367 no total).

## Tarefas

### Tarefa 1: Argumento parallelOk no workflow

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Contrato no `roadmap-release.js`:

- Comentário ARGS. Na linha de `maxParallel`, o trecho `(3, forced to 1 while config.generated)` passa a `(3, 1 while config.generated unless parallelOk)`. Linha nova, antes da de `minBudgetPerDeliverable`, no mesmo recuo: `parallelOk (false): with a generated config, true lets maxParallel apply; only from args, never from the config; never returned in resumeArgs/resumeWith`.
- `MAXPAR`: a expressão da spec, `CFG.generated ? (A.parallelOk === true ? intArg(A.maxParallel, 3, 1) : 1) : intArg(A.maxParallel ?? CFG.maxParallel, 3, 1)`, com o comentário de fim de linha `generated: may hide a shared resource`. No ramo gerado não se lê `CFG.parallelOk` nem `CFG.maxParallel`; sem `generated` nada muda.
- `withoutApprove(args)`: passa a tirar `approveRulings` e `parallelOk` pela mesma desestruturação, com o mesmo nome e o mesmo retorno para valor que não é objeto. O comentário que fala de `approveRulings` vira `approveRulings and parallelOk are typed by the person: they never go back in resume args.` A linha de comentário acima dele não muda.
- Item (6) do prompt do agente `report`, só com `CFG.generated`. Os dois ramos começam pelo prefixo de hoje até `(generated: true)`:
  - com `A.parallelOk === true`, o resto do item é `: the run argument parallelOk released maxParallel ${MAXPAR} in this run. Record this release, and say that the argument does not come back in the resume args: it must be typed again.`;
  - sem a liberação, o texto de hoje continua literal até `(maxParallel then applies, default 3).` e ganha ` Or, with no commit, pass parallelOk: true with maxParallel in the run args, never in the config.`
- Não mudam: `makeSem`, o agendamento por dependências, os pontos de saída que já passam por `withoutApprove` (`mkResult`, `op`, o `resumeWith` do `unfinished-merge`, o laço que reescreve `o.resumeWith`, `finalResume`), `lib/`, os blocos embutidos, `preflight.mjs` e `roadmap-release-agy.py`.

Testes, em `flow.test.mjs`, sem mudar o `exec`:

- Um auxiliar `specPeak()` que devolve `{ over, peak() }`. O `over` é uma função síncrona: devolve `undefined` para todo rótulo que não casa `^E\d+:spec$`; para esses, conta a chamada em andamento, atualiza o pico e devolve uma Promise que, depois de um `setImmediate`, desconta a chamada e resolve `'spec written'`. O autor da spec fica fora de `withLocks` e do `mergeLock`.
- Todos os casos usam três cards independentes (`E1`, `E2`, `E3`), `args.mode: 'plan-only'` e conferem que os três rótulos `<E>:spec` foram chamados (o pico não passa vazio).
- `E48 AC1: ...`, pico 1 em cada um: (a) config gerado sem `parallelOk` e sem `maxParallel`; (b) config gerado com `parallelOk: true` e `maxParallel: 3` no config, args sem os dois; (c) config gerado e args com `maxParallel: 3` sem `parallelOk`; (d) args com `parallelOk: 'true'` (string) e `maxParallel: 3`.
- `E48 AC2: ...` com args `{ parallelOk: true, maxParallel: 2 }` e config gerado, com o `over` composto para que `E3:spec-commit` responda `{ ok: false, error: 'boom' }` (falha `infra` depois da etapa medida):
  - pico 2;
  - `r.resumeArgs` sem a chave `parallelOk` e com `maxParallel` 2;
  - existe ao menos um `operatorActions[]` com `resumeWith` (a ação `infra` do `E3`), e nenhum `resumeWith` tem a chave;
  - o JSON da linha `Resume args:` do prompt do agente `report` (ler só essa linha) não tem a chave e mantém `maxParallel` 2;
  - o prompt do `report` contém `the run argument parallelOk released maxParallel 2 in this run`.
- `E48 AC2: ...`, caso do padrão: args `{ parallelOk: true }` sem `maxParallel`: pico 3.
- `E48 AC2: ...`, caso sem `generated`: `config: { generated: false }` e args `{ parallelOk: true, maxParallel: 2 }`: pico 2, e o prompt do `report` não contém `GENERATED release.config.json`.
- No caso (a) de AC1, o prompt do `report` contém `maxParallel was forced to 1` e `pass parallelOk: true with maxParallel in the run args, never in the config`.

Nenhum teste de hoje é apagado, afrouxado ou muda de sentido (DEC-004).

Passos:

1. Medir o tamanho do `roadmap-release.js`.
2. Teste primeiro, em `flow.test.mjs`; rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e ver falhar os casos de AC2 com a liberação e a frase nova do relatório. Os picos 1 de AC1 já passam antes da mudança: são o comportamento a preservar.
3. Implementar e ver o arquivo de teste passar.
4. Medir o tamanho de novo (teto de 700 sobre a medida do passo 1; parada acima de 840).
5. Rodar os checks da tarefa. O commit é do coordinator, depois deles, só com os arquivos da tarefa.

### Tarefa 2: Docs do argumento parallelOk

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/references/config.md`, `plugins/productivity-tools/skills/roadmap-release/references/operator.md` e `plugins/productivity-tools/skills/roadmap-release/SKILL.md`. Cada frase fica numa linha só, literal.

`config.md`:

- Na linha de `maxParallel` da tabela, o texto `Forced to 1 while `generated` is true.` passa a:

> Forced to 1 while `generated` is true, unless the run args carry `parallelOk: true`.

- No fim do último parágrafo de `## Generated config` (o que começa por "While `generated` is true"), acrescentar:

> To release it with no commit, pass `parallelOk: true` in the run args: only then does `maxParallel` apply, read from the args alone (without it, the default 3); the `maxParallel` of this file is ignored in that release. `parallelOk` written in this file has no effect, and the argument never comes back in `resumeArgs` or `resumeWith`.

`operator.md`, seção `## Releasing parallelism on a generated config`, um parágrafo novo depois da lista numerada, sem mudar a lista:

> Without a commit, pass `parallelOk: true` and `maxParallel` in the args of the run. In that release the `maxParallel` of the config is ignored: only the one in the args counts, and without it the default is 3. Step 4, which reads the value in the config or args, applies only to a reviewed config. The review of `locks` and `needsLock` in step 2 is still the responsibility of whoever releases it. `parallelOk` never comes back in `resumeArgs` or `resumeWith`: type it again on each resume, or the generated config goes back to 1.

`SKILL.md`:

- Passo 3, item que começa por "Skip this step when": o fim passa a ser:

> if it still does, the run keeps `maxParallel: 1` unless the person passes `parallelOk: true`.

- Passo 3, item "Then go on without asking", passa a ser:

> - Then go on without asking: the run uses `maxParallel: 1`, unless the person passes `parallelOk: true`, until a person reviews the file and removes `generated: true` (operator.md).

- Passo 4, no mapeamento de pedido para args, um item novo logo depois do item de `"dry run" / "plan only"`, no mesmo recuo:

> - "parallel on a generated config": `{"parallelOk":true,"maxParallel":N}`, or only `{"parallelOk":true}` when the person gives no N (the default 3 applies); pass it only when the person asks in their own message, never add it on your own and never copy it from `resumeArgs`.

Nenhum orçamento de prosa cobre o `SKILL.md` nem as referências do roadmap-release (conferido na escrita do plano). Os testes que leem esses arquivos são `docs.test.mjs`, `flow.test.mjs` e `prompts.test.mjs`; `copy-budget.test.mjs`, `encoding.test.mjs` e `independence.test.mjs` varrem os arquivos do plugin.

Passos:

1. Editar os três arquivos.
2. Rodar os checks da tarefa. O commit é do coordinator, depois deles, só com os arquivos da tarefa.

## Fechamento

- Conferir AC1 e AC2 na branch, com revisão T2 (risco médio).
- Antes do merge e no merge, o G1 completo é do orquestrador, pelo Git Bash, com o worktree parado e sem outra execução de testes correndo: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`. Ele inclui `roadmap-release-agy.test.mjs`, `run-batch.test.mjs` e `make-scenario.test.mjs`. Se o teste do agy falhar por causa do workflow, não editar o `roadmap-release-agy.py` (DEC-008): voltar a decisão ao dono via subagente opus.
- Merge de `plan/pos-2-6-0-E48` em `release/pos-2.6.0` depois da conferência. O corpo do commit de merge leva obrigatoriamente a linha `paridade agy: pendente #13`.
- No merge, o G1 completo na árvore do merge: exit 0, `fail 0`, `tests` e `pass` não menores que os do merge do E47 em `log.md` (nunca abaixo de 2713 e 2711). Com falha, desfazer o merge (rollback). Exceção (DEC-037): falha isolada do teste de processos "... ended by its own port kill, with its subtree" (`verify-run.test.mjs`) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.
- Pronto: AC1 e AC2 verdes em `release/pos-2.6.0`; G1 no piso ou acima; lint do plugin sem FAIL; `claude plugin validate .` válido; `embed.mjs --check` nos 4 alvos em dia; `roadmap-release.js` dentro do teto da tarefa e da trava de 284.500.
- Item para o registro do entregável, feito por quem integra, pela CLI do tracker (este plano não edita o roadmap): checklist "paridade agy: pendente #13".
- Sem bump de versão, push, tag ou comentário em issue.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E48",
  "title": "Paralelismo liberado por argumento",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Pré-condição: o merge do E47 já está commitado em release/pos-2.6.0 (sem MERGE_HEAD), com o G1 do merge passado e a contagem registrada em log.md. Só então commitar este plano e criar o worktree a partir de release/pos-2.6.0, antes da Tarefa 1.",
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E48, branch plan/pos-2-6-0-E48; merge em release/pos-2.6.0 depois da conferência. Todo comando e check roda com o diretório atual na raiz desse worktree.",
    "Cada tarefa edita no máximo 4 arquivos e tem um commit com só os arquivos da própria tarefa, feito pelo coordinator depois dos checks.",
    "Nenhum check de tarefa inclui roadmap-release-agy.test.mjs, run-batch.test.mjs, make-scenario.test.mjs nem o G1 completo; check por diretório usa o padrão !(roadmap-release-agy).test.mjs. Esses três arquivos e o G1 completo são do orquestrador no merge, na árvore do merge, com rollback (DEC-036).",
    "Piso do G1: a contagem do merge do E47 registrada em docs/plans/roadmap-pos-2-6-0/log.md, nunca abaixo de tests 2713 e pass 2711, com exit 0 e fail 0.",
    "Cada check termina com folga abaixo de 600 s. O comando do gate de onda é do coordinator e não é repetido nos checks.",
    "DEC-037: falha isolada do teste de processos '... ended by its own port kill, with its subtree' (verify-run.test.mjs) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.",
    "Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree; nenhuma suíte enquanto outra execução de testes corre em outro worktree.",
    "roadmap-release.js: delta líquido de no máximo 700 caracteres LF na Tarefa 1; entre o teto e 840, enxugar até o teto; acima de 840, parar e voltar ao dono via subagente opus (DEC-007, DEC-021); trava de 284500 mantida.",
    "Com config gerado, só A.parallelOk === true libera, e então vale só A.maxParallel (padrão 3); CFG.parallelOk e CFG.maxParallel não são lidos nesse ramo (DEC-012). Sem generated o comportamento não muda.",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py nem no teste dele (DEC-008); o commit de merge leva no corpo a linha 'paridade agy: pendente #13' (pelo R3, os commits de tarefa não precisam dela). No caminho agy, o efeito se limita ao withoutApprove puro do .js avaliado pelo roadmap-release-agy.py, que não muda.",
    "preflight.mjs, lib/, os blocos embutidos, makeSem e o agendamento por dependências não mudam.",
    "Não apagar nem afrouxar teste existente (DEC-004). Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "Não escrever o número do limite de cópia em nenhum arquivo do plugin fora de lib/plan-digest.mjs.",
    "Citar símbolos, nunca depender de número de linha do roadmap-release.js.",
    "Não editar nada em docs/plans/roadmap-pos-2-6-0/.",
    "Sem bump de versão, push, tag ou comentário em issue."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Argumento parallelOk no workflow",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "args.parallelOk === true -> com config gerado, MAXPAR = intArg(A.maxParallel, 3, 1); fora de resumeArgs e resumeWith (withoutApprove); item (6) do relatório registra a liberação"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "AC2",
        "C1",
        "C2",
        "C3",
        "C4",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/!(roadmap-release-agy).test.mjs\"",
          "expect": "exit 0 (o roadmap-release-agy.test.mjs é do orquestrador no merge, DEC-036)"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs tools/measure/review-loop.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const c=require('child_process'),f='plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js',len=s=>s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length,git=a=>c.execFileSync('git',a,{encoding:'utf8',maxBuffer:67108864}),show=r=>git(['show',r+':'+f]),rev=git(['rev-list','HEAD','--',f]).split(String.fromCharCode(10)).filter(Boolean).find(r=>show(r).indexOf('parallelOk')<0),now=len(require('fs').readFileSync(f,'utf8')),d=now-len(show(rev));console.log(now,d);process.exit(d<=700&&now<=284500?0:1)\"",
          "expect": "exit 0, com o tamanho e o delta impressos (delta de no máximo 700 e tamanho de no máximo 284500)"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 2,
      "title": "Docs do argumento parallelOk",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/references/config.md",
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md",
          "plugins/productivity-tools/skills/roadmap-release/SKILL.md"
        ],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "args.parallelOk === true -> com config gerado, MAXPAR = intArg(A.maxParallel, 3, 1); fora de resumeArgs e resumeWith (withoutApprove); item (6) do relatório registra a liberação"
        }
      ],
      "covers": [
        "AC1",
        "AC2"
      ],
      "testFirst": {
        "exempt": "só documentação: frases em config.md, operator.md e SKILL.md, conferidas por um check de texto"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "node -e \"const fs=require('fs'),d='plugins/productivity-tools/skills/roadmap-release/',r=f=>fs.readFileSync(d+f,'utf8'),has=(t,a)=>a.every(x=>t.includes(x)),s=r('SKILL.md'),s3=s.split('3. **Generated config.**')[1].split('4. **Run the workflow.**')[0],s4=s.split('4. **Run the workflow.**')[1].split('5. **Verify with direct git.**')[0],op=r('references/operator.md').split(String.fromCharCode(10)+'## Releasing parallelism on a generated config')[1].split(String.fromCharCode(10)+'## ')[0],c=r('references/config.md');process.exit(s3.split('unless the person passes').length===3&&has(s4,['parallel on a generated config','when the person gives no N','when the person asks in their own message'])&&has(op,['only the one in the args counts','still the responsibility of whoever releases it','type it again on each resume'])&&has(c,['unless the run args carry','is ignored in that release','written in this file has no effect'])?0:1)\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como medir o pico de paralelismo no flow.test.mjs sem mudar o exec e sem depender dos mocks de merge?",
      "decision": "Um auxiliar specPeak passado como over, que adia só a resposta de <E>:spec por um setImmediate, com os casos em mode plan-only e a conferência de que os três <E>:spec foram chamados; a falha infra que gera o resumeWith é no E3:spec-commit.",
      "basis": "A spec deixou a forma do contador ao plano; o over de hoje já aceita devolver uma Promise, a etapa fica fora de travas, e o modo plan-only passa pelo mesmo makeSem sem que merges simulados de três cards interfiram na medida.",
      "alternative": "Um gancho novo no exec, ou medir em mode run com três merges simulados.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Qual é o texto do item (6) e das frases de docs?",
      "decision": "Os textos literais das Tarefas 1 e 2: no ramo liberado, o relatório registra o valor de MAXPAR e que o argumento tem de ser digitado de novo; no ramo sem liberação, o texto de hoje ganha a saída por argumento.",
      "basis": "A spec deixou o texto exato ao plano; aplicados em memória ao workflow, os textos dão delta de 508 caracteres LF, abaixo do teto de 700.",
      "alternative": "Deixar a redação ao executor.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "A linha 'paridade agy: pendente #13' vai no corpo dos commits de tarefa, como diz a spec?",
      "decision": "Não é exigida nos commits de tarefa; é obrigatória no corpo do commit de merge. Este ruling substitui a exigência da spec (seção Fora, spec.md:17) para os commits de tarefa: o commit da Tarefa 1 sem a linha não é divergência.",
      "basis": "A instrução do chamador deste plano: o coordinator usa assuntos próprios nos commits de tarefa; o commit de merge preserva o registro da paridade pedido pela DEC-008. No caminho agy, o efeito se limita ao withoutApprove puro do .js avaliado pelo roadmap-release-agy.py, que não muda.",
      "alternative": "Exigir corpo de commit na Tarefa 1.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Como dividir o trabalho e conferir o tamanho?",
      "decision": "Duas tarefas em cadeia, workflow com testes (2 arquivos) e docs (3 arquivos); a Tarefa 1 roda o diretório do workflow sem o agy e os testes que leem o roadmap-release.js, a Tarefa 2 os testes que leem os docs; o delta é medido contra a última versão do histórico sem a marca parallelOk.",
      "basis": "Segue a spec, o limite de 4 arquivos, a DEC-036 e o padrão de check de delta do plano do E47; a marca não existia no arquivo na escrita do plano.",
      "alternative": "Uma tarefa única com 5 arquivos, acima do limite.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "removedTests": []
}
```
