# E2 -- Formato do roadmap verificado por código (design)

Entregável E2 do roadmap `docs/plans/roadmap-evolucao-skills/` (estratégia `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-004, REQ-019, REQ-024, REQ-044. Depende de E14 (DEC-058). Card crítico.

## Por quê

Três leitores leem o mesmo formato (o checker, o preflight do release e o agente de discovery do workflow), e o preflight carrega cópias à mão de `scanComments`, `blankFences` e `splitRow` do checker (`preflight.mjs:52-125`). Onze regras que as skills exigem em prosa não são conferidas pelo checker (SRC-02 §3, confirmado em SRC-10). O parser único é a base da CLI do tracker (E3) e do scaffold do planner (E4), e o gerador de cópias embutidas é reusado por E6 e E12. A sonda de E14 mostrou que um script de workflow não importa nem lê arquivos: código comum chega lá só por cópia embutida gerada, usando apenas as globais do ambiente, sem `crypto`, `process` ou `Buffer` (DEC-058).

## Critérios de aceite (do card, literais)

1. Dada uma pasta com um defeito de cada checagem nova, quando o checker roda, então emite o código nomeado daquela checagem. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
2. Dada uma pasta criada antes desta versão e válida no checker anterior, quando o checker novo roda, então nenhuma checagem nova vira erro: entra como aviso ou sob regra de adoção. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
3. Dada uma pasta qualquer, quando o checker roda com `--json`, então a saída é um JSON com erros, avisos e resumo, e o código de saída é o mesmo do modo texto. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}
4. Dada a pasta de exemplo, quando o preflight e o checker a leem, então devolvem os mesmos blocos e linhas. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs}
5. Dada a pasta de exemplo do checker, quando o checker gerado roda, então reporta zero erros e zero avisos, todo código que ele emite está documentado no contrato de formato, e o arquivo gerado não está defasado em relação ao módulo-fonte. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs}

Definição de pronto (do card): aceite passa na branch de release; G1, G2, G3, G4 e G5 verdes.

## Objetivos, não objetivos e anti-objetivos

Objetivos:

- Um módulo-fonte do parser, lido pelo checker (por cópia embutida gerada) e pelo preflight (por importação).
- Um gerador genérico de cópias embutidas, com detecção de cópia defasada, pronto para E6 e E12.
- As onze checagens novas do card, todas como aviso.
- Saída `--json` do checker.
- Contrato de formato (`formats.md`) e checker mudando juntos (REQ-019).

Não objetivos (deixados a outros cards ou decisões):

- Embutir o parser no workflow do release (`roadmap-release.js`) ou trocar o agente de discovery por código: isso é de E8 e E12 (o card de E6 já fixa que a cópia entra nos workflows em E8 e E12, para não editar o workflow em paralelo com E18).
- Detectar reuso de identificador já fechado: fica na CLI do tracker (E3), risco 3 do card.
- Mudar a linha 1 do checker ou a versão do plugin: só no preparo de uma publicação, na branch de release (DEC-042; "Branches de entregável não mexem na versão", seção Execução da estratégia). A regra de `.claude/rules/roadmap-checker.md` (subir versão a cada mudança do checker) é cumprida em E17, que sobe a linha 1 a 1.7.0.
- Atualizar a cópia vendorizada do checker em `docs/plans/roadmap-evolucao-skills/` (só o tracker, depois de uma publicação) ou editar a estratégia deste roadmap (só por revisão aprovada).
- Mudar `formatVersion` (continua 1, DEC-042).

Anti-objetivos (falham o entregável mesmo que os testes passem):

- Uma pasta de roadmap existente, válida hoje, passar a ter erro (sai de exit 0 para exit 1).
- Mudança de comportamento do preflight na saída da CLI (`runPreflight`) ou no texto do checker para as checagens antigas.
- O módulo-fonte usar `import`, `require`, `process`, `Buffer` ou `crypto`, o que impediria embuti-lo num workflow (DEC-058).

## Desenho

### Peça 2 -- módulo-fonte do parser

Arquivo novo: `plugins/productivity-tools/lib/roadmap-format.mjs`. Funções puras, sem importação e sem globais de Node, tiradas do checker atual sem mudança de comportamento: `norm`, `parseAttrs`, `scanFences`, `scanComments`, `readBlocks`, `splitRow`, `parseTable`, `parseList`, `stripNote`, `parseStatus`, `parseVerifyTag` (com `VERIFY_KINDS` e `EXECUTABLE_KINDS`), `shasIn` e `idsIn` se o checker as usar na composição.

Função de composição nova, que é o ponto único de leitura dos blocos:

```
parseRoadmapTexts({ strategy, files }) -> {
  version,            // attrs do anchor roadmap:version (ou null)
  cards: [{ id, attrs, depends, reqs, critical, acceptance: [{ text, tag, problem }], risks, body }],
  blocks: {           // por papel, por nome de bloco
    strategy: { gates, phases },
    state: { now, panel, blockers, pending, inflight, donot, releases },
    decisions: { decisions }, log: { log },
    sources: { sources, conflicts }, requirements: { requirements },
    measurements: { measurements },
  },
}
```

`files` é o mapa papel -> texto (ou `null`, como `measurements`). Cada bloco vem como `{ present, closed, malformed, rows }` (tabela) ou `{ present, closed, malformed, items }` (lista), com as linhas cruas (sem filtrar contagem de colunas), para o checker continuar emitindo `missing-block`, `unclosed-block`, `malformed-anchor` e `bad-row` exatamente como hoje. A tabela de blocos (papel, nome, tipo, colunas) fica declarada uma vez no módulo, conforme a seção 3 de `formats.md`. `body` do card é o texto do card fora dos blocos `acceptance` e `risks` (usado pela checagem de definição de pronto).

### Peça 1 -- gerador de cópias embutidas

Arquivo novo: `plugins/productivity-tools/scripts/embed.mjs` (Node 18+, sem dependências).

- Marcadores no arquivo de destino, em linhas próprias: `// <embed src="<caminho relativo ao destino>" exports="keep|strip">` e `// </embed>`. Entre eles, o gerador escreve uma linha de aviso (`// Gerado de <src> por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.`) seguida do corpo do módulo-fonte.
- `exports="keep"` mantém `export` (destino ESM, como o checker, que continua exportando `readBlocks`, `parseTable`, `scanFences` e `parseVerifyTag` para os testes atuais); `exports="strip"` remove a palavra `export` das declarações de topo (destino script, como os workflows de E8 e E12, cujas funções `load-pure.mjs` extrai com `new Function`).
- O gerador recusa (código 2, mensagem nomeando o arquivo) um módulo-fonte com `import`, `require(`, ou uso de `process`, `Buffer` ou `crypto` como identificador (DEC-058).
- API exportada: `embedText(targetText, readSource) -> string` (pura; `readSource(src)` devolve o texto da fonte) e `embedFile(targetPath, { check })`. CLI: `node plugins/productivity-tools/scripts/embed.mjs [--check] <destino>...`; sem `--check` reescreve; com `--check` sai 1 e lista os destinos defasados, sem escrever.
- Fim de linha: compara e gera com LF; ao escrever, preserva o fim de linha do arquivo de destino (os worktrees deste repositório têm checkout CRLF).
- Destino em E2: só `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`. A linha 1 do checker (`// check-roadmap 1.5.0 format 1`) fica acima dos marcadores e o gerador nunca a toca. O checker continua um arquivo único copiável.

### Checker

- O checker passa a ter o bloco embutido logo depois dos imports e remove as cópias locais das funções do parser.
- `checkRoadmap` lê cartões e blocos de `parseRoadmapTexts(...)` (a mesma composição que o preflight usa), em vez de chamar `readBlocks` bloco a bloco. Todas as mensagens e códigos atuais ficam iguais.
- Exporta `parseRoadmap(roadmap)` = `parseRoadmapTexts({ strategy: roadmap.strategy, files: roadmap.files })`, para o teste de paridade.

### Peça 3 -- checagens novas

Todas emitem aviso (nenhuma vira erro: critério 2 e risco 1 do card). As de fase também seguem regra de adoção. Nomes de código fixados aqui; cada um é documentado em `formats.md` §9 sob "since 1.7.0".

| Checagem do card | Código | Regra |
|---|---|---|
| Ordem posicional dos status | `status-order` | `deliverableStatuses` com menos de 8 palavras; ou palavra de `integratedStatuses` fora das posições 6 a 8; ou de `releasedStatuses` fora de 7 e 8; ou `blockedStatus` presente fora da posição 9; ou `discardedStatus` fora da 10. Uma mensagem por violação. |
| Fase do card contra a tabela de fases | `card-phase-table` | Só quando a estratégia tem o bloco novo opcional `roadmap:phases` (4 colunas: Fase, Critérios de entrada, Critérios de saída, Entregáveis). Card ausente de toda linha, card em mais de uma linha, linha que mistura cards com `phase` diferentes, ou duas linhas com o mesmo `phase`. |
| Ordem de fase contra dependências | `phase-order` | Só com o bloco `phases`: card que depende de outro cuja linha vem depois na tabela. |
| Definição de pronto citando gate | `dod-no-gate` | Quando o bloco `gates` tem ao menos uma linha: card com ao menos um critério de tipo executável (`test`, `smoke`, `integration`) cujo `body` não cita, como palavra inteira, nenhum ID da coluna 1 de `gates`. Cards só com critérios `human` ou `blocked` (decisão, medição) ficam fora. |
| Dono nos pendentes | `pending-no-owner` | Item do bloco `pending` que não começa por `(<dono>)`. |
| Cabeçalho do estado contra a versão da estratégia | `state-header` | O texto de `state.md` antes do primeiro bloco não contém `v<versão>` como palavra inteira, onde a versão é o primeiro atributo do anchor `roadmap:version`. A data não é conferida. |
| Segmento bloqueado citando bloqueio | `blocked-no-blq` | Segmento do painel com a palavra `blockedStatus` (padrão `blocked`, só se estiver em `deliverableStatuses`) sem `BLQ-n` na nota do segmento nem em Próximo passo. |
| Texto de restauração no bloqueio | `blocker-no-restore` | Para cada linha de `blockers` e cada `E<n>` da coluna Afeta cujo painel tem segmento bloqueado: "Desbloqueia quando" não contém esse `E<n>` seguido, mais adiante na célula, de uma palavra de `deliverableStatuses` que não seja a de bloqueio. Independe do idioma da prosa ("restores", "restaura"). |
| Fonte citada | `source-uncited` | `SRC-NN` de `sources.md` que não é citado em nenhum outro arquivo acompanhado (estratégia, requisitos, decisões, estado, log, caminho crítico, medições). |
| Sufixo do nome do arquivo da estratégia | `strategy-plan-suffix` | `config.strategy` termina em `-plan.md` (sem diferenciar maiúsculas). |
| Decisão do executor pendente sob dependente iniciado ou entregável publicado (DEC-031) | `executor-decision-pending` | Linha de `decisions` com Origem `executor` e Status `decisionPending`. Alcance lido da última frase da célula Decisão: `Alcance: local.`/`Alcance: contrato.` (DEC-045), aceitando também `Scope: local.`/`Scope: contract.`; sem a frase, contrato. Aviso quando (a) alcance contrato e algum card que depende de um `E<n>` da coluna Entregável tem segmento de status nas posições 2 a 8 (iniciado; bloqueado e descartado não contam), ou (b) qualquer alcance e o `E<n>` da coluna Entregável tem status em `releasedStatuses` (padrão `released`, `measured`). |

As duas checagens de fase entram por adoção porque a tabela de fases hoje é Markdown sem âncora; o planner passa a escrevê-la com o bloco porque o esqueleto da estratégia em `formats.md` §5 ganha o anchor, e uma estratégia existente adota por revisão.

### Peça 4 -- saída `--json`

`node check-roadmap.mjs [pasta] [--require-git] --json` imprime em stdout só um objeto JSON:

```
{ "checker": "1.5.0", "format": 1,
  "errors":   [{ "code": "...", "file": "...", "message": "..." }],
  "warnings": [{ "code": "...", "file": "...", "message": "..." }],
  "summary":  { "errors": <n>, "warnings": <m>, "exitCode": <0|1|2> } }
```

- O código de saída é o mesmo do modo texto: 0 sem erros, 1 com erro ou `ERROR config`/`bad-header`, 2 em falha interna.
- `ERROR config: ...` vira um erro de código `config`; `bad-header` vira erro `bad-header` (com `checker` e `format` nulos); falha interna vira erro de código `internal`, sem pilha.
- `checker-stale` entra em `warnings` como no modo texto. `--version` continua texto.
- A ordem dos itens é a mesma do modo texto.

### Preflight

- `preflight.mjs` importa `../../../lib/roadmap-format.mjs` e apaga `blankFences`, `splitRow`, `scanComments` e `firstBlockBody`. `parseGatesTable` passa a ler o bloco `gates` pela composição do módulo, com as mesmas regras de hoje (posição das colunas, linha com outra contagem pulada com o mesmo aviso, comando vazio, `-` ou `—` descartado). Todos os testes atuais do preflight continuam passando sem mudança de expectativa.
- Exporta `readRoadmapStructure(folder)`: lê `roadmap.config.json`, a estratégia e os arquivos dos papéis (com o mesmo tratamento de BOM e CRLF) e devolve `parseRoadmapTexts(...)`. A CLI do preflight não muda; E18 usa essa função para a lista de pendentes.

### Contrato de formato e regras do repositório

- `roadmap-planner/references/formats.md`: §2 (a ordem posicional passa a ser conferida por `status-order`), §3 (bloco `phases` na tabela de blocos), §5 (esqueleto com o anchor `phases` em volta da tabela de fases; regra da definição de pronto), §6 (convenções de cabeçalho, dono no pendente, segmento bloqueado e texto de restauração passam a ter aviso), §1 (sufixo `-plan.md` com aviso), §9 (os onze códigos novos sob "since 1.7.0", a opção `--json` e o formato da saída).
- `.claude/rules/roadmap-checker.md`: uma linha dizendo que o parser vive em `plugins/productivity-tools/lib/roadmap-format.mjs`, que se edita a fonte e roda `node plugins/productivity-tools/scripts/embed.mjs <destino>`, e que a subida da linha 1 é feita no preparo da publicação (DEC-042).
- `CLAUDE.md`, seção Layout: as linhas `lib/` (módulos-fonte embutidos) e o gerador em `scripts/`.

### Pasta de exemplo

`roadmap-tracker/scripts/fixtures/valid/strategy.md` ganha o bloco `roadmap:phases` em volta da tabela de fases que já existe; o resto da pasta já satisfaz as checagens novas ou é ajustado para isso. A pasta continua com zero erros e zero avisos (G4, critério 5).

### Testes (só nos arquivos do card)

Em `roadmap-tracker/scripts/check-roadmap.test.mjs`:

- Critério 1: uma pasta derivada da de exemplo com um defeito de cada uma das onze checagens produz cada código; e um teste por código, com a pasta limpa sem ele.
- Critério 2: a pasta de exemplo sem o bloco `phases` e sem cabeçalho de estado (forma anterior a esta versão) e uma pasta com um defeito de cada checagem nova saem com exit 0 e só avisos novos; nenhum código novo aparece com severidade `error`.
- Critério 3: `--json` na pasta válida, numa pasta com erro, numa config inválida e com falha interna forçada (`ROADMAP_CHECK_SELFTEST_THROW`): JSON válido, contagens iguais às do modo texto, código de saída igual.
- Critério 5: o checker na pasta de exemplo dá zero e zero; todo código emitido (extraído do código-fonte do checker, `add('<severidade>', '<código>'` e os códigos da CLI) aparece em `formats.md` §9; `embedText` sobre o checker com o módulo atual devolve o arquivo atual (comparado com LF).
- Gerador: `keep` e `strip` sobre um destino sintético; recusa de fonte com `import`, `process`, `Buffer` ou `crypto`; o módulo real passa nessa recusa (DEC-058); `--check` sai 1 com destino defasado e 0 com destino em dia.

Em `roadmap-release/scripts/preflight.test.mjs`:

- Critério 4: `readRoadmapStructure(VALID)` igual (deepEqual) a `parseRoadmap(loadRoadmap(VALID))` do checker, com cards, blocos e linhas.

### Verificação fora dos testes

- Rodar o checker novo na pasta real `docs/plans/roadmap-evolucao-skills/`: exit 0 (sem erro novo); os avisos novos ficam listados no relatório do entregável para o tracker e o dono decidirem.
- G1 a G5 verdes no worktree de E2.

## Decisões autônomas (revisáveis pelo dono)

1. Módulo-fonte em `plugins/productivity-tools/lib/roadmap-format.mjs`, no nível do plugin, e não dentro de uma skill, porque checker, preflight e os workflows de E8 e E12 o compartilham; o preflight o importa por caminho relativo dentro do plugin. Alcance: contrato.
2. Gerador em `plugins/productivity-tools/scripts/embed.mjs` (publicado com o plugin, como os scripts utilitários do layout), com marcadores `// <embed src="..." exports="keep|strip">` / `// </embed>` e detecção de defasagem por regeneração e comparação, sem resumo criptográfico. Alcance: contrato.
3. Em E2 o único destino embutido é o checker; o workflow do release não é editado (a cópia entra em E8 e E12, como o card de E6 já fixa). Alcance: local.
4. Os testes do gerador ficam em `check-roadmap.test.mjs`, o arquivo de teste que o card lista, e não num arquivo novo. Alcance: local.
5. Todas as onze checagens novas são avisos; as duas de fase só rodam quando a estratégia tem o bloco opcional novo `roadmap:phases`. Alcance: contrato.
6. Nomes dos códigos: `status-order`, `card-phase-table`, `phase-order`, `dod-no-gate`, `pending-no-owner`, `state-header`, `blocked-no-blq`, `blocker-no-restore`, `source-uncited`, `strategy-plan-suffix`, `executor-decision-pending`. Alcance: contrato.
7. `dod-no-gate` só vale para card com ao menos um critério executável; cards de decisão e medição, só com critérios `human`, ficam fora. Alcance: local.
8. `blocker-no-restore` confere o `E<n>` seguido de uma palavra de status, sem depender da frase em inglês ou português. Alcance: local.
9. `source-uncited` aceita citação em qualquer arquivo acompanhado, não só em requisitos e decisões. Alcance: local.
10. `executor-decision-pending`: "iniciado" é status nas posições 2 a 8 (bloqueado e descartado não contam); o alcance aceita também `Scope: local.`/`Scope: contract.` para roadmaps em inglês, além da frase de DEC-045; o caso "publicado" usa o status do próprio entregável da decisão. Alcance: contrato.
11. Formato do `--json`: `{ checker, format, errors, warnings, summary: { errors, warnings, exitCode } }`, com `config`, `bad-header` e `internal` como erros de mesmo nome. Alcance: contrato.
12. Linha 1 do checker e versão do plugin não mudam neste entregável (DEC-042); `formats.md` rotula os códigos novos "since 1.7.0", a versão que E17 publica (DEC-028). Alcance: local.
13. `checkRoadmap` passa a ler blocos pela composição `parseRoadmapTexts`, a mesma do preflight, mantendo códigos e mensagens atuais. Alcance: local.
14. O preflight ganha `readRoadmapStructure(folder)` exportada, sem mudar a saída da CLI. Alcance: contrato.
15. `.claude/rules/roadmap-checker.md` e o Layout do `CLAUDE.md` recebem uma linha cada sobre o módulo-fonte e o gerador. Alcance: local.

## Depende de entrada humana

Nada. Todos os critérios são `verify: test` e não há efeito externo (sem push, sem publicação). As decisões acima ficam pendentes de ratificação pelo dono pela regra de DEC-030; as de alcance contrato (1, 2, 5, 6, 10, 11, 14) seguram o início de E3, E4 e E6 até a ratificação, sem impedir a entrega de E2.
