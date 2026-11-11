# E6 -- Formato e ferramenta de plano, com roteamento, mapa e briefs (design)

Entregável E6 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-043 (o plano traz dados legíveis por máquina validados por código) e REQ-016 (o roteamento tem uma só definição, usada pelo release e pelo coordinator, com teste de igualdade entre as cópias embutidas). Depende de E2 (gerador de cópias embutidas `scripts/embed.mjs`, DEC-058) e de E5 (esquema `spec/1` e leitor `lib/data-block.mjs`, DEC-117 a DEC-129). Card não crítico, trilha de engenharia, fase spec-plano. Só código (DEC-038): o autor de plano, a skill `plan-writer` e a adoção são de E20; o coordinator com mapa e estado é de E7; a carga do plano no workflow do release é de E8.

## Por quê

O plano hoje é texto que o próprio autor transcreve para JSON (`roadmap-release.js:1520`, retorno do estágio de plano em opus) e que um revisor relê para conferir (`roadmap-release.js:1544`); o `plan-coordinator` o interpreta sem gramática fixa, e grafo, ondas, conflitos de escrita e nível de cada passo são seguidos pelo LLM a partir de prosa (SRC-02 §4 e §5). SRC-08, seções B3 e B6, propõe um bloco de dados no plano, uma ferramenta que o confere contra o spec e o emite com resumo de integridade, uma função de roteamento única e os comandos de mapa e de brief. E6 entrega essa base para que E7 (coordinator), E8 (release) e E20 (autor) partam de um formato fixo e testado.

## Critérios de aceite (do card, literais)

1. Dado um plano com cada defeito plantado (ciclo de dependências, duas tarefas da mesma onda escrevendo o mesmo arquivo, critério de aceite sem cobertura, interface consumida e nunca produzida, comando de efeito externo declarado como interno), quando a ferramenta o checa, então devolve o erro nomeado de cada um. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
2. Dado o plano de exemplo, quando a ferramenta o emite, então o resumo de integridade muda se o conteúdo ou o arquivo de origem mudar, e é igual ao calculado pela cópia gerada para os workflows. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
3. Dada a tabela de exemplo tirada das regras atuais de roteamento do coordinator e de revisão do release, quando a definição de roteamento roda, então reproduz nível, effort e portão de revisão de cada linha, na ferramenta e na cópia gerada. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}
4. Dado o plano de exemplo, quando a ferramenta gera o mapa e os briefs, então nenhuma onda passa da largura máxima e cada brief traz as restrições, os dados da tarefa e as interfaces consumidas. {verify: test; evidence: node --test plugins/productivity-tools/scripts/plan-tool.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- O esquema `plan/1`, versionado, no mesmo bloco ```` ```json data ```` do spec, lido pelo mesmo leitor `lib/data-block.mjs` de E5.
- A ferramenta `plan-tool` com os comandos `check` (contra o esquema e contra o spec), `emit` (plano normalizado com campos calculados e resumo de integridade que cobre também o arquivo de origem), `map` (ondas com largura máxima) e `brief` (um arquivo por tarefa).
- Uma definição de roteamento única, em fonte pura (`lib/routing.mjs`), que devolve nível, effort e portão de revisão a partir das notas da tarefa, e o cálculo do resumo de integridade em fonte pura (`lib/plan-digest.mjs`), ambos embutíveis por `scripts/embed.mjs`, com teste de igualdade entre a fonte e a cópia gerada.
- A tabela de exemplo de roteamento derivada das regras atuais (`plan-coordinator/references/routing.md` §2 a §4 e `reviewModelFor`/`effortFor` de `roadmap-release.js:383-397`), conferida linha a linha.

Não objetivos:

- Editar `roadmap-release.js` ou qualquer arquivo de workflow: a cópia gerada entra no workflow do release em E8 e no do coordinator em E12 (card, peça 2; DEC-104). Aqui a cópia gerada vive numa fixture de teste.
- Editar a skill `plan-coordinator` (SKILL.md, `references/routing.md`, `delegation-protocol.md`): o coordinator passa a usar o mapa e os briefs em E7.
- O autor de plano, a skill `plan-writer`, a adoção de planos antigos e os ponteiros (E20).
- Validar nomes de trava (`locks`) contra a configuração do release, regra de parada (`stopOrCarry`) e autorização de efeito externo (E8; a semântica de autorização não muda neste roadmap antes de E8).
- A escolha "inline" do coordinator para passos de nota 0 a 2: depende do contexto da conversa do orquestrador e fica em E7 (ver decisão 9).
- Subir a versão de `productivity-tools`: branches de entregável não mexem na versão (estratégia, "Execução deste roadmap").
- Editar `docs/plans/roadmap-evolucao-skills/` ou `plugins/_template/`.

Anti-objetivos (falha mesmo funcionando):

- Uma definição de roteamento que muda um portão de revisão ou um modelo de revisor em relação às regras atuais: o padrão continua o de hoje até as medições (DEC-021, risco do card).
- Campo de nota ausente tratado como valor padrão: ausente é sempre erro, como em E5. A regra do coordinator "informação desconhecida vale 1" vira obrigação do autor de escrever 1.
- `lib/routing.mjs` ou `lib/plan-digest.mjs` com `import`, `process`, `Buffer` ou `crypto`: precisam caber num script de workflow (DEC-058); `checkPureSource` os confere.
- Resumo de integridade que depende do fim de linha do checkout: o mesmo plano em CRLF e em LF dá o mesmo resumo (`core.autocrlf=true` neste repositório).
- Mudar o comportamento de `spec-tool` ou do esquema `spec/1`: o teste de E5 continua passando sem mudança de expectativa.

## Desenho

### Peça 1 -- esquema `plan/1` e ferramenta de plano

**Forma do arquivo.** Um plano é Markdown com prosa livre, uma seção por tarefa com o título `### Tarefa <n>: <título>` ou `### Task <n>: <título>` (as duas grafias são aceitas: o roadmap é em português, planos fora dele podem ser em inglês), e exatamente um bloco ```` ```json data ```` de nível superior, lido por `readDataBlock` de `lib/data-block.mjs` (E5, DEC-118). A prosa de cada tarefa (passos, testes, comandos) é o que vai para o brief; o bloco é o contrato.

**Esquema `plan/1`.** Objeto JSON no bloco:

| Campo | Tipo | Regra |
|---|---|---|
| `schema` | string | exatamente `"plan/1"` (`schema-version` se outro) |
| `id` | string não vazia | id do entregável ou do tópico; igual ao `id` do spec (`spec-id-mismatch`) |
| `title` | string | opcional |
| `spec` | string não vazia | caminho do spec, relativo à pasta do plano (DEC-026 põe `spec.md` e `plan.md` na mesma pasta) ou absoluto; `--spec` na CLI substitui |
| `roadmap` | string ou `null` | pasta do roadmap, quando o plano é de um entregável; tarefa que escreve nela é erro `roadmap-edit` |
| `constraints` | lista de strings | restrições que vão para todo brief (podem estar vazias) |
| `externalPatterns` | lista de strings | opcional; expressões regulares somadas à lista padrão de efeito externo |
| `tasks` | lista não vazia de tarefas | numeradas `1..N` na ordem (`task-number`) |
| `evidence` | lista de linhas de evidência | uma por critério de aceite do spec |
| `rulings` | lista | mesmo formato e regras de `spec/1` (`R<n>`) |
| `needsPerson` | lista | mesmo formato e regras de `spec/1` (`H<n>`) |

Tarefa:

| Campo | Tipo | Regra |
|---|---|---|
| `n` | inteiro | posição 1-based |
| `title` | string não vazia | igual, após colapso de espaço, ao título da seção `### Tarefa n:` |
| `deps` | lista de inteiros | números de tarefas existentes (`dep-unknown`); sem ciclo (`dependency-cycle`) |
| `files` | `{ create, modify, test }`, listas de caminhos relativos à raiz do repositório | ao menos um arquivo em toda tarefa com `noCommit: false` |
| `writes` | lista de caminhos | escritas implícitas (lockfile, pasta gerada, snapshot) |
| `score` | `{ ambiguity, reasoning, blast, verifiability }`, inteiros 0..2 | todos obrigatórios; o autor não escolhe o nível |
| `produces` | lista de strings | assinaturas ou interfaces que a tarefa entrega |
| `consumes` | lista de `{ task, sig }` | `sig` igual (após colapso de espaço) a um `produces` da tarefa `task` |
| `covers` | lista de ids | `AC<n>`, `C<n>` e `X<n>` do spec (`cover-unknown` se o id não existe no spec) |
| `testFirst` | `true` ou `{ exempt: "<motivo>" }` | |
| `checks` | lista de `{ cmd, expect }` | comando de verificação da tarefa |
| `locks` | lista de strings | nomes de trava; tarefas que compartilham trava não ficam na mesma onda do mapa |
| `external` | booleano | obrigatório |
| `externalDedupe` | string ou `null` | não vazia quando `external: true` (`external-dedupe-missing`) |
| `noCommit` | booleano | obrigatório |

Linha de evidência: `{ ac, kind, command, external, externalDedupe, blq }`, com `kind` em `test|smoke|integration|human|blocked`, `command` string ou `null`, `external` booleano obrigatório quando há comando, `externalDedupe` não vazio quando externa, `blq` `BLQ-<n>` ou `null`.

**`plugins/productivity-tools/scripts/plan-tool.mjs`.** Script Node sem dependências, no mesmo nível de `spec-tool.mjs` (caminho do arquivo de teste fixado pelo card), nome único no plugin (regra de permissão por nome, DEC-060, DEC-133). Importa `../lib/data-block.mjs`, `../lib/roadmap-format.mjs` (`norm`, `parseVerifyTag`), `../lib/routing.mjs`, `../lib/plan-digest.mjs` e, de `./spec-tool.mjs`, `checkSpec` e o validador de registros (ver abaixo). Lógica exportada como funções sobre texto e objetos (`checkPlan`, `emitPlan`, `buildMap`, `buildBriefs`); a CLI só lê arquivos, grava os briefs e imprime.

```
node plan-tool.mjs check <plan.md> [--spec <spec.md>] [--json]
node plan-tool.mjs emit  <plan.md> [--spec <spec.md>]
node plan-tool.mjs map   <plan.md> [--spec <spec.md>] [--max-width <n>] [--json]
node plan-tool.mjs brief <plan.md> [--spec <spec.md>] [--out <pasta>] [--task <n>]
```

Códigos de saída: 0 sem erro, 1 com erro, 2 uso inválido ou arquivo ilegível (como `spec-tool` e o checker). Saída texto e `--json` no molde de `spec-tool check` (DEC-112, DEC-125): `ERROR <código> <ref>: <mensagem>`, `WARN ...`, `Result: <e> errors, <w> warnings`; `--json` `{ tool: "plan-tool", schema: "plan/1", path, errors, warnings, summary: { errors, warnings, exitCode } }`. `<ref>` é `T<n>`, `T<n>/T<m>`, `AC<n>`, `C<n>`, `X<n>`, `R<n>`, `H<n>`, o caminho do campo ou `-`. `map`, `emit` e `brief` rodam `check` antes e saem 1 com os erros em stderr se houver.

**`check`.** Lê o plano e o spec. O spec passa por `checkSpec` de `spec-tool` (sem `--roadmap`); spec ilegível ou com erro é `spec-invalid` com o primeiro erro do spec na mensagem. Checagens, com o código de erro:

- Esquema: `data-block-missing|multiple|json` (do leitor), `schema-version`, `field-missing`, `field-type`, `task-number`, `id-invalid`, `id-duplicate`; campo desconhecido é aviso `field-unknown`. `rulings` e `needsPerson` usam o mesmo validador de registros do spec: a validação por registro de `checkSpec` é extraída para uma função exportada de `spec-tool.mjs` (`checkRecords(name, items, { roadmap })`), sem mudar códigos, mensagens nem resultado de `checkSpec`.
- Grafo: `dep-unknown`; `dependency-cycle` nomeando as tarefas do ciclo na ordem (`T2 -> T4 -> T2`).
- Conflito de escrita: a onda de uma tarefa é o seu nível topológico (0 sem dependência; senão 1 + o maior nível das dependências). Duas tarefas do mesmo nível cujo conjunto de escrita (`files.create`, `files.modify`, `files.test`, `writes`, caminhos normalizados com `/` e sem `./`) se cruza dão `write-conflict` com ref `T<n>/T<m>` e o arquivo. Tarefas em níveis diferentes nunca rodam juntas, então não conflitam.
- Cobertura: todo `AC<n>` do spec precisa de uma linha de evidência (`acceptance-uncovered`, "sem linha de evidência") e, quando o critério do spec é executável (marca `test`, `smoke` ou `integration`) ou não tem marca, de ao menos uma tarefa com o id em `covers` (`acceptance-uncovered`, "nenhuma tarefa cobre"). Quando o critério do spec tem marca, o `kind` da linha é o da marca (`evidence-kind-differs`) e, para marca executável, o `command` é a evidência da marca, literal após colapso de espaço (`evidence-command-differs`: comando da marca é mantido, nunca trocado). Linha de evidência de um `AC` que não existe no spec: `cover-unknown`. Todo `C<n>` do spec coberto por uma tarefa (`edge-case-uncovered`). Todo `X<n>` do spec coberto por uma tarefa com `external: true` (`external-effect-unperformed`).
- Interfaces: `consumes` cujo `sig` nenhuma tarefa produz é `interface-unproduced`, nomeando a tarefa e a assinatura; produzida por uma tarefa que não é ancestral da consumidora pelas dependências é `interface-not-upstream`.
- Efeito externo: todo comando (`checks[].cmd` de tarefa com `external: false` e `command` de linha de evidência com `external: false`) que casa com a lista de padrões de efeito externo é `external-undeclared`, nomeando a tarefa ou o critério e o padrão. Lista padrão (regex, sem diferenciar caixa): `\bgit\s+push\b`, `\b(npm|pnpm|yarn)\s+publish\b`, `\bdeploy\b`, `\bcurl\b.*\s-X\s*(POST|PUT|PATCH|DELETE)\b`, `\bkubectl\s+(apply|delete|create|patch|rollout)\b`, `\bterraform\s+(apply|destroy)\b`, `\bdocker\s+push\b`, `\bgh\s+(pr\s+(create|merge)|release\s+create|issue\s+create)\b`, `\b(sendmail|mail)\b`, `\bclaude\s+plugin\s+(update|install|marketplace\s+(add|update))\b`, mais `externalPatterns` do plano. Tarefa ou linha externa sem `externalDedupe` é `external-dedupe-missing`.
- Pasta do roadmap: com `roadmap` preenchido, uma tarefa que escreve sob essa pasta é `roadmap-edit`.
- Prosa: tarefa sem seção `### Tarefa <n>:` é `task-heading-missing`; seção sem tarefa no bloco é `task-heading-orphan`; título diferente é `task-title-differs`.
- Avisos: tarefa com mais de quatro arquivos em `files` (`task-too-wide`, regra de dividir do coordinator, `routing.md` §2); `field-unknown`.

**`emit`.** Sem erro, imprime em stdout:

```
{ tool: "plan-tool", schema: "plan/1", path, source: { path, textDigest }, plan, digest }
```

- `plan` é o bloco lido mais, em cada tarefa, `route` (`{ tier, effort, reviewTier, gate, score }` de `route()`, peça 2), `wave` (índice da onda no mapa com a largura padrão) e `fileCount`.
- `source.path` é o caminho do plano relativo ao diretório de trabalho, com `/`; `source.textDigest` é `fnv1a` do texto inteiro do arquivo normalizado (BOM removido, CRLF para LF, NFC): muda quando qualquer byte da prosa ou do bloco muda, e não muda com o fim de linha do checkout.
- `digest = planDigest({ plan, source })` de `lib/plan-digest.mjs`: `fnv1a` de 32 bits (o mesmo algoritmo de `planFingerprint`, `roadmap-release.js:642`) sobre `JSON.stringify` da forma canônica (chaves de objeto ordenadas, recursivo), em 8 dígitos hexadecimais. O workflow, sem sistema de arquivos, recebe o objeto de um agente com schema e recalcula `planDigest({ plan, source })` em JavaScript puro (DEC-059); igualdade prova o transporte.

**Plano de exemplo.** `plugins/productivity-tools/scripts/fixtures/plan-tool/plan.md`, escrito à mão no formato novo (risco do card), para o spec de exemplo de E5 (`spec: "../spec-tool/spec.md"`, DEC-129): cobre `AC1` a `AC3`, `C1` e `X1`; tem uma tarefa externa com dedupe (o efeito `X1`), uma linha `blocked BLQ-1` para `AC2`, ao menos uma interface produzida e consumida, um nível com três tarefas independentes (para o teste de largura com `--max-width 2`) e uma trava compartilhada por duas tarefas do mesmo nível. Passa em `check` com zero erros e zero avisos. Os planos com defeito do critério 1 são gerados no teste por mutação do bloco em memória (`replaceDataBlock`), sem fixture por defeito.

### Peça 2 -- definição de roteamento, numa só fonte

**`plugins/productivity-tools/lib/routing.mjs`.** Fonte pura (sem imports, sem `process`/`Buffer`/`crypto`), exporta `route(task, ctx)`, onde `task` traz `score`, `files`, `external` e `ctx` traz `hasDependents` (alguma tarefa depende desta). Devolve `{ tier, effort, reviewTier, gate, score }`. Regras, transcritas das fontes atuais:

0. Efeito externo (`routing.md` §3.1, "an external step counts as Blast radius 2"): com `external: true`, blast passa a 2 antes de tudo; o total, a tabela e todas as regras abaixo usam esse blast efetivo. O `score` devolvido traz o blast efetivo e o total; o bloco do plano não muda.
1. Escopo pela contagem de arquivos distintos em `files.create`, `files.modify` e `files.test`: 1 (ou 0) -> 0; 2 a 5 -> 1; mais de 5 -> 2 (`routing.md` §1, só a contagem é legível por código). `score` total = escopo + as quatro notas.
2. Tabela (`routing.md` §2): 0 a 2 -> haiku; 3 a 5 -> sonnet; 6 a 10 -> opus só com blast 2 e ambiguity 2, senão sonnet com effort high.
3. Teto mecânico (§3.2): escopo 2, ambiguity 0, reasoning 0 e blast ≤ 1 -> haiku.
4. Verificação pesada (§3.3): verifiability 2 e reasoning ≥ 1 -> um nível acima, exceto total 6 a 10, que fica em sonnet com effort high e ganha portão.
5. Piso de risco (§3.1, sempre vence): blast 2 (efetivo, regra 0) -> ao menos sonnet e portão.
6. Effort (§2): haiku low, opus medium, sonnet medium, sonnet com total 6 a 10 high. Para total ≤ 5 é o mesmo de `effortFor` do release (`roadmap-release.js:395`).
7. `reviewTier` (revisor de toda tarefa no release, `reviewModelFor`, `roadmap-release.js:387` e a instrução de `roadmap-release.js:1511`): opus quando blast 2 (efetivo, regra 0) ou `tier` opus; senão sonnet.
8. `gate` (passo de revisão separado no coordinator, sempre em opus, `routing.md` §4): piso de risco disparado, ou total ≥ 7, ou haiku com `hasDependents` e verifiability ≥ 1, ou o caso 6 a 10 da regra 4.

**`plugins/productivity-tools/lib/plan-digest.mjs`.** Fonte pura com `canon`, `fnv1a` e `planDigest`, usada pelo `plan-tool` e pela cópia gerada.

**Tabela de exemplo.** `plugins/productivity-tools/scripts/fixtures/plan-tool/routing-table.json`: uma linha por regra e por fronteira (pelo menos: total 0, 2, 3, 5, 6 sem opus, 6 com opus, teto mecânico, teto mecânico com blast 2, verificação pesada em haiku e em sonnet, verificação pesada em 6 a 10, blast 2 em total baixo, externo em total baixo, externo com ambiguity 2 e blast 1 declarado e total efetivo de 6 a 10 -> opus (regra 0 com a tabela), externo no teto mecânico -> sonnet com portão, haiku de base com dependentes e verifiability 1, total 7), cada uma com a entrada (`score`, contagem de arquivos, `external`, `hasDependents`), a saída esperada (`tier`, `effort`, `reviewTier`, `gate`) e a fonte da regra (`routing.md §x` ou `roadmap-release.js:<linha>`). Os valores esperados são escritos a partir das regras atuais, não a partir da saída de `route()`.

**Cópia gerada para os workflows.** `plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js` é um alvo de `scripts/embed.mjs` com dois marcadores `// <embed src="../../../lib/routing.mjs" exports="strip">` e `// <embed src="../../../lib/plan-digest.mjs" exports="strip">`, no formato que E8 e E12 vão repetir nos arquivos de workflow, e termina devolvendo `({ route, planDigest })`. O arquivo é commitado já gerado. O teste confere (a) que `embedFile(..., { check: true })` não acusa defasagem (igualdade entre fonte e cópia) e (b) que a cópia roda em `node:vm` num contexto sem `process`, `require` nem `crypto`, como o ambiente do workflow (SRC-15), e dá os mesmos resultados da ferramenta. A pasta `fixtures` fica fora do lint e de G1.

### Peça 3 -- mapa de ondas e briefs

**`map`.** As ondas partem dos níveis topológicos da peça 1. Cada nível é repartido, em ordem de `n`, em sub-ondas de no máximo `--max-width` tarefas (padrão 4, largura padrão do coordinator, `plan-coordinator/SKILL.md:75`; inteiro ≥ 1, senão uso inválido), colocando cada tarefa na primeira sub-onda com vaga e sem trava em comum. As ondas são numeradas a partir de 1 na ordem. Saída texto: uma linha por onda com as tarefas e o roteamento de cada uma. `--json`: `{ tool, schema, path, maxWidth, waves: [{ n, tasks: [{ n, title, tier, effort, reviewTier, gate, external, locks }] }], external: [<n>], gates: [<n>] }`.

**`brief`.** Grava um arquivo `T<n>.md` por tarefa (ou só o da `--task <n>`) em `--out` (padrão: pasta `briefs/` ao lado do plano, onde E7 guarda estado e briefs, DEC-026) e imprime os caminhos gravados. Cada brief tem, nesta ordem, com títulos fixos:

1. `## Restrições`: `constraints` do plano, uma por linha.
2. `## Tarefa`: número, título, onda, roteamento (`tier`, `effort`, `reviewTier`, `gate`), arquivos por tipo, `writes`, `deps`, `covers` com o texto de cada critério e caso de borda do spec, `checks`, `locks`, `external`, `externalDedupe`, `noCommit`, `testFirst`.
3. `## Interfaces consumidas`: cada `consumes` com a tarefa que produz (`T<m>: <sig>`), ou "nenhuma".
4. `## Passos`: a prosa da seção `### Tarefa <n>:` do plano, literal.

Os briefs são gravados em LF; o comando não toca o plano nem o spec.

### Testes (só no arquivo do card)

`plugins/productivity-tools/scripts/plan-tool.test.mjs` (novo), com `node:test`, pastas temporárias por `fs.mkdtempSync(os.tmpdir())` removidas ao fim:

- Critério 1: a partir do plano de exemplo, um plano por defeito plantado, cada um dando o erro nomeado: ciclo -> `dependency-cycle` com as tarefas; duas tarefas do mesmo nível com o mesmo arquivo -> `write-conflict` com o par e o arquivo; linha de evidência removida e `covers` removido -> `acceptance-uncovered` nomeando o `AC`; `consumes` sem produtor -> `interface-unproduced`; `checks` com `git push` numa tarefa `external: false` -> `external-undeclared`. Também os demais códigos da peça 1 com um caso cada, e o plano de exemplo com zero erros e zero avisos.
- Critério 2: `emit` do plano de exemplo; o resumo muda ao alterar um valor do bloco, ao alterar só a prosa e ao mudar o caminho de origem; não muda ao converter o arquivo para CRLF; `planDigest` da cópia gerada, rodada em `node:vm`, sobre `{ plan, source }` emitidos é igual a `digest`.
- Critério 3: cada linha de `routing-table.json` passa por `route()` da fonte e da cópia gerada e dá `tier`, `effort`, `reviewTier` e `gate` esperados; `checkPureSource` sem achado em `lib/routing.mjs` e `lib/plan-digest.mjs`; `embedFile` em modo `check` não acusa defasagem em `workflow-copy.js`.
- Critério 4: `map` do plano de exemplo com a largura padrão e com `--max-width 2`: nenhuma onda acima da largura, nenhuma onda com duas tarefas da mesma trava, toda tarefa depois das dependências; `brief` grava um arquivo por tarefa, cada um com as quatro seções, as restrições, os dados da tarefa e as interfaces consumidas.
- CLI: exit 0/1/2 e `--json` com o mesmo exit do texto.

O teste de E5 (`spec-tool.test.mjs`) continua passando sem mudança; ele confere a extração de `checkRecords`.

### Documentação

`CLAUDE.md`, seção Layout: a linha de `lib/` passa a citar `routing.mjs` e `plan-digest.mjs` (fontes puras embutíveis) e a de `scripts/` cita `plan-tool.mjs` (checa um plano contra o spec, emite com resumo, gera mapa e briefs). Nenhuma SKILL.md muda neste card.

### Verificação fora dos testes

Antes de cada commit: G1, G2, G3 e G5; G4 não muda (checker e formato do roadmap não são tocados), mas rodá-lo confirma. `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js` sai 0.

## Deixado ao planejador

- Ordem das tarefas e a divisão em até quatro arquivos por tarefa; uma ordem natural é fontes puras (`plan-digest`, `routing` com a tabela), depois o esquema e `check`, depois `emit` com a cópia gerada, depois `map` e `brief`, depois a documentação.
- Os textos exatos das mensagens, desde que nomeiem o código e a referência.
- O conteúdo do plano de exemplo e as linhas exatas da tabela de roteamento, dentro do que as peças exigem.

## Decisões autônomas (revisáveis pelo dono)

1. Esquema `plan/1` no mesmo bloco ```` ```json data ```` do spec, lido por `lib/data-block.mjs` de E5, com os campos da peça 1 (forma de SRC-08 B3, com `consumes` como `{ task, sig }` e `covers` aceitando `AC`, `C` e `X`). Base: DEC-037, DEC-117, DEC-118; SRC-08 B3. Custo se errada: medium (E7, E8 e E20 leem o esquema; mudar exige nova versão do esquema). Reversível: sim, por `plan/2`. Alcance: contrato.
2. Ferramenta em `plugins/productivity-tools/scripts/plan-tool.mjs` com os comandos `check`, `emit`, `map` e `brief`, as opções e os códigos de saída da peça 1, e `--json` no molde de `spec-tool`. Base: caminho do teste fixado pelo card; DEC-112, DEC-125, DEC-060. Custo se errada: medium. Reversível: sim. Alcance: contrato.
3. Códigos de erro: `dependency-cycle`, `dep-unknown`, `write-conflict`, `acceptance-uncovered`, `evidence-kind-differs`, `evidence-command-differs`, `cover-unknown`, `edge-case-uncovered`, `external-effect-unperformed`, `interface-unproduced`, `interface-not-upstream`, `external-undeclared`, `external-dedupe-missing`, `roadmap-edit`, `task-number`, `task-heading-missing`, `task-heading-orphan`, `task-title-differs`, `spec-invalid`, `spec-id-mismatch`, mais os do leitor e de esquema de E5; avisos `task-too-wide`, `field-unknown`. Base: card, critério 1; DEC-124. Custo se errada: low. Reversível: sim. Alcance: contrato.
4. "Mesma onda" no critério 1 é o mesmo nível topológico pelas dependências; conflito de escrita é erro do `check`, não uma separação silenciosa no mapa, para que a ordem entre as tarefas fique explícita no plano. Base: card, critério 1; SRC-08 B3 propunha separar no mapa. Custo se errada: low (o autor de E20 acrescenta uma dependência). Reversível: sim. Alcance: contrato.
5. O spec é lido pelo caminho do campo `spec`, relativo à pasta do plano (ou `--spec`), e validado por `checkSpec` de `spec-tool` sem `--roadmap`; o validador de registros (`rulings`, `needsPerson`) é extraído de `spec-tool.mjs` para uma função exportada e reusado no plano, sem mudar o comportamento de E5. Base: DEC-026 (spec e plano na mesma pasta), DEC-037 (E6 usa só o esquema e o leitor de E5). Custo se errada: low. Reversível: sim. Alcance: contrato.
6. Critério executável do spec exige linha de evidência com o `kind` da marca e o comando literal da marca, e ao menos uma tarefa que o cubra; critério `human` ou `blocked` exige só a linha. Cada `X<n>` do spec precisa de uma tarefa externa que o cubra. Base: SRC-08 B3 ("um comando `{verify}` do card é mantido, nunca trocado"); regra de revisão do plano em `roadmap-release.js:1544`. Custo se errada: low. Reversível: sim. Alcance: contrato.
7. Efeito externo declarado como interno é detectado por uma lista padrão de expressões regulares mais `externalPatterns` do plano, aplicada aos comandos das tarefas e das linhas de evidência com `external: false`. Base: SRC-08 B3 (varredura léxica configurável). Custo se errada: medium (falso negativo deixa passar um efeito; a revisão do plano continua existindo até E26). Reversível: sim. Alcance: contrato.
8. Resumo de integridade: `fnv1a` de 32 bits sobre a forma canônica de `{ plan, source }`, com `source.textDigest` do texto normalizado do arquivo (sem BOM, LF, NFC) e `source.path` relativo com `/`; os campos calculados (`route`, `wave`, `fileCount`) entram em `plan` e no resumo. Base: SRC-08 B3; `planFingerprint` (`roadmap-release.js:642`); DEC-058 e DEC-059 (sem `crypto` no workflow); `core.autocrlf=true`. Custo se errada: medium (E8 depende do formato). Reversível: sim. Alcance: contrato.
9. Definição de roteamento em `lib/routing.mjs` com as regras 0 a 8 da peça 2 (a regra 0 eleva o blast de tarefa externa a 2 antes do total, da tabela e das exceções, como `routing.md` §3.1), saída `{ tier, effort, reviewTier, gate, score }`: `reviewTier` reproduz o revisor de toda tarefa no release e `gate` reproduz o passo de revisão em opus do coordinator; o escopo vem só da contagem de arquivos; a escolha "inline" do coordinator fica fora (E7), e o roteamento devolve haiku nesses casos. Base: `routing.md` §1 a §4; `roadmap-release.js:383-397, 1511`; SRC-08 B5 ("um campo expressa os dois"); DEC-021 (nenhum portão muda sem medição). Custo se errada: medium (E7 e E8 despacham por ela). Reversível: sim. Alcance: contrato.
10. Effort: a regra do coordinator (sonnet com total 6 a 10 em high) vale para os dois consumidores; para total até 5 coincide com `effortFor` do release. Base: `routing.md` §2; o card pede uma só definição (REQ-016). Custo se errada: low (só o effort de tarefas de nota alta no release muda, a partir de E8). Reversível: sim. Alcance: contrato.
11. A cópia gerada para os workflows, enquanto E8 e E12 não a põem nos arquivos de workflow, vive em `scripts/fixtures/plan-tool/workflow-copy.js`, gerada por `scripts/embed.mjs` com `exports="strip"`, e é executada no teste em `node:vm` sem `process`, `require` e `crypto`. Base: card, peça 2; DEC-104; DEC-058. Custo se errada: low. Reversível: sim. Alcance: local.
12. Largura máxima padrão 4, configurável por `--max-width`; tarefas com trava em comum não dividem onda. Base: `plan-coordinator/SKILL.md:75`. Custo se errada: low. Reversível: sim. Alcance: contrato.
13. Briefs gravados como `T<n>.md` em `briefs/` ao lado do plano (ou `--out`), com as quatro seções da peça 3. Base: DEC-026, card de E7 (estado e briefs na pasta do plano). Custo se errada: low. Reversível: sim. Alcance: contrato.
14. Seções de tarefa aceitas como `### Tarefa <n>:` ou `### Task <n>:`; título da seção igual ao do bloco. Base: SRC-08 B3 (cabeçalho genérico); planos fora do roadmap podem ser em inglês. Custo se errada: low. Reversível: sim. Alcance: contrato.
15. Tarefa com mais de quatro arquivos é aviso `task-too-wide`, não erro. Base: `routing.md` §2 ("dividir, não promover"); regra de política de tiers do dono (≤ 4 arquivos); toda checagem nova de estilo nasce como aviso (DEC-106). Custo se errada: low. Reversível: sim. Alcance: local.
16. Plano de exemplo, tabela de roteamento e cópia gerada em `plugins/productivity-tools/scripts/fixtures/plan-tool/`; o plano de exemplo usa o spec de exemplo de E5; os planos com defeito são gerados no teste por mutação. Base: DEC-129, DEC-130. Custo se errada: low. Reversível: sim. Alcance: contrato.
17. Nenhuma versão sobe nesta branch; nenhuma SKILL.md e nenhum arquivo de workflow mudam; `CLAUDE.md` ganha as linhas de Layout. Base: estratégia, "Execução deste roadmap"; DEC-134, DEC-135. Custo se errada: low. Reversível: sim. Alcance: local.

## Depende de entrada humana

Nada. Os quatro critérios são `verify: test`, e o card não pede efeito externo (sem push, sem publicação, sem credencial, sem dado real). As decisões acima ficam pendentes de ratificação pelo dono pela regra de DEC-030; as de alcance contrato seguram o início de E7 e E20, que leem o que elas fixam, sem impedir a entrega de E6. As decisões de alcance contrato de E5 (DEC-117 a DEC-125, DEC-129, DEC-131, DEC-133) ainda pendentes são lidas aqui como estão no código integrado; uma rejeição delas pelo dono pode exigir ajuste neste card.
