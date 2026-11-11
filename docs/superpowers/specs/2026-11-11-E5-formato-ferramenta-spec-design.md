# E5 -- Formato e ferramenta de spec (design)

Entregável E5 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-026, REQ-038, REQ-042. Depende de E14 (DEC-057, DEC-058, DEC-060). Card não crítico, trilha de engenharia, fase spec-plano.

## Por quê

Hoje o spec é texto livre: os critérios do card, as decisões autônomas e o que depende de pessoa são conferidos por um revisor LLM e relidos por outro agente (SRC-02 §4; no workflow do release, a revisão do spec em `roadmap-release.js:1472` e a releitura de "Depends on human input" em `roadmap-release.js:1230`). SRC-08, seções B2, B4 e B6, propõe um bloco de dados legível por código dentro do spec e uma ferramenta que confere esse bloco contra o card. E5 é trabalho de base sem autor: a ferramenta de plano (E6) lê os dados do spec com o mesmo leitor, e o autor de spec (E19) fecha a própria escrita com esta checagem. A peça 3 fecha uma lacuna do lint: agentes de plugin com chave fora da política passam em silêncio, e os agentes e scripts que E19, E20 e seguintes vão criar precisam estar cobertos antes de existirem.

## Critérios de aceite (do card, literais)

1. Dado um spec cujo critério de aceite difere do card ou perdeu a marca de verificação, quando a ferramenta de spec o checa, então falha nomeando o critério. {verify: test; evidence: node --test plugins/productivity-tools/scripts/spec-tool.test.mjs}
2. Dado um spec com uma decisão autônoma sem base, sem custo se estiver errada, sem marca de reversibilidade ou sem alcance, ou com um item que só uma pessoa resolve sem marca de bloqueio, quando a ferramenta o checa, então falha nomeando o registro. {verify: test; evidence: node --test plugins/productivity-tools/scripts/spec-tool.test.mjs}
3. Dado um agente de plugin com um campo que agentes de plugin ignoram ou com chave fora da política do repositório, quando o lint roda, então acusa o arquivo. {verify: test; evidence: node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Um leitor de bloco de dados em Markdown, puro e embutível, que E6 reusa para o plano.
- O esquema `spec/1`, versionado, com os registros que o card enumera: critérios de aceite, decisões autônomas (base, custo se errada, reversibilidade, alcance), itens que só uma pessoa resolve (com marca de bloqueio), efeitos externos e casos de borda.
- A ferramenta `spec-tool` com três comandos: `check` (contra o esquema e, havendo pasta de roadmap, contra o card), `emit` e `summary`.
- O lint do plugin valida agentes (recursivo, chaves ignoradas e chaves fora da política) e scripts (nome único no plugin, escrita na raiz do plugin também em `lib/`).

Não objetivos:

- O autor de spec, a skill `spec-writer` e a checagem do construtor (E19).
- Mudar o workflow do release ou o formato de spec que ele usa hoje (`docs/superpowers/specs/*-design.md`); a troca é de E8.
- A regra de parada em código (`stopOrCarry`, DEC-020): é de E8. Aqui `summary` só marca as decisões que essa regra vai parar.
- Resumo de integridade do spec: o resumo é contrato de E6 para o plano (DEC-059); o spec emitido não leva resumo.
- Conferir seções de prosa, palavras proibidas como `TBD`, ou tamanho do texto: a prosa fica livre e só o bloco é contrato.
- Subir a versão de `productivity-tools` ou de `marketplace-tools`: branches de entregável não mexem na versão; a publicação que levar E5 sobe as duas (estratégia, "Execução deste roadmap").
- Editar a pasta `docs/plans/roadmap-evolucao-skills/` ou `plugins/_template/`.

Anti-objetivos (falha mesmo funcionando):

- Ferramenta que aceita um critério alterado só porque o texto "parece" o mesmo: a comparação é literal após normalização de espaço em branco, nada além.
- Checagem que passa quando falta um campo obrigatório porque o valor é tratado como padrão: campo ausente é sempre erro.
- `lib/data-block.mjs` com `import`, `process`, `Buffer` ou `crypto`: ele precisa caber num script de workflow (DEC-058).
- Uma checagem nova do lint que faça G5 falhar nos plugins atuais.

## Desenho

### Peça 1 -- bloco de dados e esquema `spec/1`

**Leitor compartilhado: `plugins/productivity-tools/lib/data-block.mjs`.** Fonte pura, sem imports e sem `process`, `Buffer` ou `crypto`, no mesmo nível de `lib/roadmap-format.mjs` (E2), para que E6, E8 e E12 a usem diretamente ou a embutam por `scripts/embed.mjs`. Um teste aplica `checkPureSource` de `embed.mjs` ao arquivo.

O bloco de dados é um bloco de código cercado de nível superior cuja linha de abertura tem a informação exata `json data` (cerca de três ou mais crases ou tis; a de fechamento usa o mesmo caractere e pelo menos o mesmo comprimento, como em CommonMark). Um bloco `json data` aninhado dentro de outro bloco cercado (por exemplo, um exemplo dentro de um bloco ```` ```markdown ````) não conta. O texto entra normalizado (BOM removido, CRLF para LF, NFC), igual a `norm` de `roadmap-format.mjs`; a função é reescrita localmente porque a fonte pura não importa nada.

API exportada:

- `findDataBlocks(text)` -> lista de `{ line, start, end, info, body }` dos blocos `json data` de nível superior (linha 1-based da cerca de abertura).
- `readDataBlock(text)` -> `{ data, prose, line, error }`. `error` é `null` ou `{ code, message }` com `code` em `data-block-missing` (nenhum bloco), `data-block-multiple` (mais de um; a mensagem cita as linhas) ou `data-block-json` (JSON inválido; a mensagem traz a mensagem do `JSON.parse`). `prose` é o texto sem o bloco.
- `replaceDataBlock(text, data)` -> o texto com o corpo do único bloco trocado por `JSON.stringify(data, null, 2)`; lança erro se não houver exatamente um bloco. E5 só testa; E20 usa na adoção.

**Esquema `spec/1`.** Objeto JSON no bloco de dados:

| Campo | Tipo | Regra |
|---|---|---|
| `schema` | string | obrigatório, exatamente `"spec/1"`; outro valor -> `schema-version` |
| `id` | string | obrigatório, não vazio: o ID do card (`E<n>`) ou um tópico em kebab-case fora de roadmap |
| `title` | string | opcional |
| `mode` | string | obrigatório, `"unattended"` ou `"interactive"` |
| `acceptance` | lista | obrigatória, ao menos um item `{ id, text }`; `id` é `AC<n>` com `n` igual à posição (1, 2, ...); `text` é o critério literal, com a marca `{verify: ...}` quando houver |
| `rulings` | lista | obrigatória (pode ser vazia); item `{ id, question, decision, basis, alternative, costIfWrong, reversible, scope, contradicts }` |
| `needsPerson` | lista | obrigatória (pode ser vazia); item `{ id, kind, what, why, blocking, workaround, blq }` |
| `externalEffects` | lista | obrigatória (pode ser vazia); item `{ id, what, target }` |
| `edgeCases` | lista | obrigatória (pode ser vazia); item `{ id, input, expected }` |

Regras dos registros:

- `rulings[]` (decisão autônoma, DEC-020, DEC-030): `id` `R<n>`; `question`, `decision` e `basis` strings não vazias; `alternative` string (pode ser vazia, quando nenhuma foi considerada); `costIfWrong` em `low`, `medium`, `high`; `reversible` booleano; `scope` em `local`, `contract` (DEC-045 escreve "Alcance: local|contrato." em `decisions.md`; no dado o valor é o termo neutro de código); `contradicts` `null` ou string com o ID contrariado (`DEC-n` ou `G<n>`). Ausência ou valor fora do domínio de `basis`, `costIfWrong`, `reversible` ou `scope` é o erro `ruling-incomplete`, nomeando o `R<n>` e os campos; os demais campos faltando são `field-missing`, também nomeando o registro.
- `needsPerson[]` (item que só uma pessoa resolve, REQ-026): `id` `H<n>`; `kind` em `data`, `credential`, `acceptance`, `decision` (`needs-person-kind`); `what` e `why` strings não vazias; `blocking` booleano obrigatório (`needs-person-blocking` quando ausente ou não booleano, nomeando o `H<n>`); com `blocking: false`, `workaround` string não vazia (`needs-person-workaround`); `blq` opcional, `BLQ-<n>`.
- `externalEffects[]`: `id` `X<n>`; `what` e `target` strings não vazias.
- `edgeCases[]`: `id` `C<n>`; `input` e `expected` strings não vazias; mais de cinco itens é o aviso `edge-cases-limit` (SRC-08 B2).
- Em toda lista: `id` fora do padrão -> `id-invalid`; repetido -> `id-duplicate`; item que não é objeto -> `field-type`. Campos desconhecidos são o aviso `field-unknown` (o esquema cresce por versão, não por chave solta).

### Peça 2 -- `plugins/productivity-tools/scripts/spec-tool.mjs`

Script Node sem dependências, no nível do plugin (caminho fixado pelo card), importando `../lib/data-block.mjs` e `../lib/roadmap-format.mjs` (`norm`, `parseVerifyTag`, `parseRoadmapTexts`). A lógica é exportada como funções puras sobre texto (`checkSpec`, `summarize`) e a CLI só lê arquivos e imprime. O nome do arquivo é único no plugin, porque a regra de permissão que o preflight vai listar casa pelo nome do script (DEC-060).

Uso:

```
node spec-tool.mjs check   <spec.md> [--roadmap <pasta>] [--json]
node spec-tool.mjs emit    <spec.md> [--roadmap <pasta>]
node spec-tool.mjs summary <spec.md> [--json]
```

Códigos de saída: 0 sem erro, 1 com ao menos um erro, 2 uso inválido ou arquivo ilegível (como `lint-plugin.mjs` e o checker).

**`check`.** Lê o spec, roda `readDataBlock`, valida o esquema e, com `--roadmap`, compara com o card:

- `--roadmap <pasta>` lê `roadmap.config.json`, a estratégia apontada por `strategy` e os arquivos de `files` que existirem, e passa os textos por `parseRoadmapTexts` (E2). O card é o de `id` igual ao `id` do spec; não achar é `card-not-found`. Os bloqueios abertos são as linhas do bloco `roadmap:blockers` de `state.md`; um `needsPerson[].blq` que não está lá é `needs-person-blq`.
- Sem `--roadmap`, a comparação com o card não roda; se o `id` tiver a forma `E<n>`, sai o aviso `card-not-checked`. Spec fora de roadmap (E19, skill interativa) passa só pelo esquema.
- Comparação dos critérios (critério 1): os dois lados passam por `norm` e por colapso de espaço em branco (sequências viram um espaço, pontas aparadas). Contagem diferente -> `acceptance-count`. Para cada posição `n`, o texto sem a marca diferente -> `acceptance-text`; o card tem marca e o spec não -> `acceptance-tag-missing`; marcas com `kind`, `blq` ou `evidence` diferentes -> `acceptance-tag-differs`. Toda marca do spec que `parseVerifyTag` rejeita é `acceptance-tag-invalid`, com ou sem `--roadmap`. A mensagem de cada erro nomeia `AC<n>` e traz o início do texto do card.

Saída texto: uma linha por achado, `ERROR <código> <ref>: <mensagem>` ou `WARN <código> <ref>: <mensagem>`, com `<ref>` sendo `AC<n>`, `R<n>`, `H<n>`, `X<n>`, `C<n>`, o caminho do campo ou `-`; última linha `Result: <e> errors, <w> warnings`. Saída `--json`: `{ tool: "spec-tool", schema: "spec/1", path, errors: [{ code, ref, message }], warnings: [...], summary: { errors, warnings, exitCode } }`, no mesmo molde do `--json` do checker (DEC-112), com o mesmo código de saída do modo texto.

**`emit`.** Roda `check` (com `--roadmap` se dado). Com erro, imprime os erros em stderr e sai 1. Sem erro, imprime em stdout `{ tool: "spec-tool", schema: "spec/1", path, data }`, onde `data` é o bloco lido e cada item de `acceptance` ganha `verify: { kind, blq, evidence }` (ou `null`) e `textWithoutTag`. É a forma que E8 e E6 consomem; nenhum LLM transcreve o spec.

**`summary`.** Não exige card. Imprime em Markdown três tabelas a partir do bloco: decisões (`R<n>`, decisão, custo se errada, reversível, alcance, contradiz), itens de pessoa (`H<n>`, tipo, o quê, bloqueia, contorno, BLQ) e efeitos externos (`X<n>`, o quê, alvo). Uma decisão com `costIfWrong: "high"` e `reversible: false`, ou com `contradicts` preenchido, e um item com `blocking: true` recebem a marca `para` (o que a regra de E8 vai parar, DEC-020); a marca é só informativa. Com `--json`, devolve `{ rulings, needsPerson, externalEffects, stops: [<ids>] }`. Spec sem bloco legível: sai 1 com o erro do leitor.

**Spec de exemplo.** `plugins/productivity-tools/scripts/fixtures/spec-tool/` guarda um roadmap mínimo (`roadmap/roadmap.config.json`, a estratégia com um card `E1` de três critérios, um deles com marca `blocked BLQ-1`, e `state.md` com `BLQ-1` aberto) e `spec.md`, um spec válido desse card com ao menos uma decisão de cada alcance, um item de pessoa bloqueante e um não bloqueante citando `BLQ-1`, um efeito externo e um caso de borda. É o spec que o teste de E6 vai usar (risco do card); mudar o esquema exige passar nos dois testes. O lint pula pastas `fixtures`, e o caminho fica fora dos padrões de G1 por não terminar em `.test.mjs`.

### Peça 3 -- lint de agentes e scripts (`lint-plugin.mjs`)

Mudanças em `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`:

1. **Agentes recursivos.** A checagem 5 passa a percorrer `agents/` com subpastas (a referência diz que subpastas viram parte do nome, `docs/claude-code-extensibility-reference.md` §4.1), nomeando o arquivo pelo caminho relativo (`agents/review/x.md`).
2. **Política de chaves de agente.** Chaves permitidas, os campos documentados que agentes de plugin respeitam (§4.2): `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `skills`, `memory`, `background`, `isolation`, `omitClaudeMd`, `color`, `autoCompactWindow`, `experimental`. As quatro ignoradas (`hooks`, `mcpServers`, `permissionMode`, `initialPrompt`) continuam `FAIL` com a mensagem atual. Qualquer outra chave é `FAIL` com "key X is outside the allowed agent frontmatter keys (repo policy)": num agente, uma chave mal grafada descarta em silêncio o modelo ou as ferramentas que o autor de E19 depende (DEC-057). Os agentes de `sql-server-tools` usam só chaves da lista e continuam passando.
3. **Nome de script único.** Arquivos `.mjs`, `.js`, `.cjs`, `.sh`, `.ps1` e `.py` sob `scripts/`, `skills/*/scripts/`, `skills/*/workflow/` e `lib/`, fora de `fixtures` e de `*.test.mjs`: dois com o mesmo nome de arquivo dão `WARN` "Script names are unique" citando os caminhos, porque a regra de permissão casa pelo nome (DEC-060). Sem colisão, `OK`. Nenhum plugin atual tem colisão.
4. **Escrita na raiz do plugin.** A checagem 7 passa a percorrer também `lib/`.

`lint-plugin.test.mjs` ganha casos: agente com cada chave ignorada numa subpasta (FAIL nomeando `agents/<sub>/<arquivo>`), agente com chave fora da política (`modle`, FAIL nomeando o arquivo), agente com todas as chaves permitidas (OK), dois scripts com o mesmo nome em skills diferentes (WARN com os dois caminhos), escrita em `${CLAUDE_PLUGIN_ROOT}` a partir de `lib/` (WARN), e o lint de `plugins/sql-server-tools` e `plugins/productivity-tools` reais sem FAIL.

Documentação que acompanha: a frase da etapa 1 de `plugins/marketplace-tools/skills/validate-plugin/SKILL.md` que enumera o que o script cobre ganha "agent frontmatter (recursive; ignored and out-of-policy keys)" e "unique script names"; `CLAUDE.md` ganha, junto da regra de chaves de SKILL.md, a lista de chaves de agente da política, e no Layout a linha de `lib/` passa a citar `data-block.mjs` e a de `scripts/` cita `spec-tool.mjs`.

### Testes (só nos arquivos do card)

`plugins/productivity-tools/scripts/spec-tool.test.mjs` (novo), com `node:test`, pastas temporárias por `fs.mkdtempSync(os.tmpdir())` removidas ao fim, e defeitos plantados por mutação do spec de exemplo em memória:

- Leitor: zero, um, dois blocos; bloco aninhado em outra cerca ignorado; CRLF e BOM; JSON inválido; `replaceDataBlock` preserva a prosa; `checkPureSource` sem achado em `lib/data-block.mjs`.
- Critério 1: texto de um critério alterado -> `acceptance-text` nomeando o `AC<n>`; marca removida -> `acceptance-tag-missing`; evidência trocada -> `acceptance-tag-differs`; critério a menos -> `acceptance-count`; diferença só de espaço em branco ou de fim de linha -> passa.
- Critério 2: para cada um de `basis`, `costIfWrong`, `reversible`, `scope` ausente ou fora do domínio -> `ruling-incomplete` nomeando o `R<n>`; `needsPerson` sem `blocking` -> `needs-person-blocking` nomeando o `H<n>`; não bloqueante sem contorno -> `needs-person-workaround`; `blq` fechado com `--roadmap` -> `needs-person-blq`.
- CLI: o spec de exemplo passa com exit 0 e zero avisos em `check --roadmap`; `--json` tem o mesmo exit do texto; `emit` imprime `data` com `verify` parseado e sai 1 quando há erro; `summary` marca `para` no item bloqueante; uso inválido sai 2.

`plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`: os casos da peça 3.

Nenhum outro arquivo de teste. Os dois entram em G1 pelo padrão `plugins/**/*.test.mjs`.

### Verificação fora dos testes

Antes de cada commit: G1, G2, G3 e G5 (G4 não muda, porque o checker e o contrato de formato do roadmap não são tocados, mas rodá-lo é barato e confirma). Como `marketplace-tools` muda, também `claude plugin validate plugins/marketplace-tools` e o lint de `plugins/marketplace-tools` e de `plugins/sql-server-tools` (regra do `CLAUDE.md` para cada plugin alterado). A mudança no texto de `validate-plugin/SKILL.md` só acrescenta itens à lista do que o script cobre; não muda o comportamento da skill.

## Deixado ao planejador

- Ordem das tarefas e a divisão em até quatro arquivos por tarefa; uma ordem natural é leitor, esquema e `check`, depois `emit` e `summary`, depois o lint, depois a documentação.
- Os textos exatos das mensagens, desde que nomeiem o código e o registro.
- O conteúdo do roadmap mínimo de exemplo, dentro do que a peça 2 exige.

## Decisões autônomas (revisáveis pelo dono)

1. O leitor do bloco de dados fica em `plugins/productivity-tools/lib/data-block.mjs`, fonte pura sem imports (DEC-058), ao lado de `roadmap-format.mjs` (DEC-102); E6 o reusa para o plano. Alcance: contrato.
2. O bloco de dados é o único bloco cercado de nível superior com a informação `json data` (forma de SRC-08 B2); zero ou mais de um é erro. Alcance: contrato.
3. Esquema `spec/1` com os campos e domínios da peça 1, incluindo `scope` em `local|contract` (termo de código; `decisions.md` continua com a frase de DEC-045) e `costIfWrong` em `low|medium|high`. Alcance: contrato.
4. Os critérios de aceite vivem só no bloco de dados (`acceptance[{id, text}]`), sem seção de prosa obrigatória; a prosa do spec é livre e não é conferida. Alcance: contrato.
5. A comparação com o card é literal após `norm` e colapso de espaço em branco, e a marca `{verify: ...}` é comparada campo a campo (`kind`, `blq`, `evidence`). Alcance: contrato.
6. O card vem de `--roadmap <pasta>` (config, estratégia e `state.md` lidos e passados por `parseRoadmapTexts`), e não de um JSON do card; o `id` do spec escolhe o card. Alcance: contrato.
7. A lógica do spec fica no script, que importa `lib/`; só o leitor do bloco é puro. E8 roda o script e consome a saída de `emit`, como DEC-059 faz com o plano. Alcance: contrato.
8. Códigos de erro: `data-block-missing`, `data-block-multiple`, `data-block-json`, `schema-version`, `field-missing`, `field-type`, `id-invalid`, `id-duplicate`, `card-not-found`, `acceptance-count`, `acceptance-text`, `acceptance-tag-missing`, `acceptance-tag-differs`, `acceptance-tag-invalid`, `ruling-incomplete`, `needs-person-kind`, `needs-person-blocking`, `needs-person-workaround`, `needs-person-blq`; avisos: `card-not-checked`, `edge-cases-limit`, `field-unknown`. Alcance: contrato.
9. Formato do `--json` do `check` no molde do checker (DEC-112) e saída de `emit` `{ tool, schema, path, data }` com `verify` e `textWithoutTag` em cada critério. Alcance: contrato.
10. O spec emitido não leva resumo de integridade; o resumo é contrato do plano em E6. Alcance: local.
11. `summary` marca `para` nas decisões altas e irreversíveis, nas que contradizem e nos itens bloqueantes, só como informação; a regra de parada é de E8. Alcance: local.
12. Fora do escopo da checagem: seções de prosa, `TBD`/`TODO` e limite de palavras (SRC-08 os propõe; o card não os pede). Alcance: local.
13. Spec de exemplo e roadmap mínimo em `plugins/productivity-tools/scripts/fixtures/spec-tool/`, o mesmo spec que o teste de E6 usará. Alcance: contrato.
14. Os testes do leitor ficam em `spec-tool.test.mjs`, sem arquivo de teste novo além dos do card (mesma linha de DEC-105). Alcance: local.
15. Política de chaves de agente = campos documentados que agentes de plugin respeitam (lista da peça 3); chave fora dela é `FAIL` (não `WARN`, como em SKILL.md), porque num agente ela descarta modelo ou ferramentas em silêncio. Alcance: contrato.
16. O lint percorre `agents/` recursivamente e `lib/` na checagem de escrita na raiz do plugin. Alcance: local.
17. Nome de script repetido no plugin é `WARN` "Script names are unique", ligado à regra de permissão por nome (DEC-060); nova checagem nasce como aviso. Alcance: contrato.
18. Nenhuma versão sobe nesta branch; a publicação que levar E5 sobe `productivity-tools` e `marketplace-tools` (estratégia, "Execução deste roadmap"). Alcance: local.
19. `CLAUDE.md` e `validate-plugin/SKILL.md` recebem as linhas da peça 3; o README de `marketplace-tools` não muda, porque não enumera as checagens. Alcance: local.

## Depende de entrada humana

Nada. Os três critérios são `verify: test`, e o card não pede efeito externo (sem push, sem publicação, sem credencial). As decisões acima ficam pendentes de ratificação pelo dono pela regra de DEC-030; as de alcance contrato (1 a 9, 13, 15 e 17) seguram o início de E6 e E19, que leem o que elas fixam, sem impedir a entrega de E5.
