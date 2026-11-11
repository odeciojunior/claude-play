# E15 -- Linha de base registrada: desenho

Entregável E15 do roadmap `docs/plans/roadmap-evolucao-skills/` (card E15 em `docs/plans/2026-11-10-roadmap-evolucao-skills.md`, v1.3). REQs: REQ-001, REQ-031. Depende de E1 (ferramentas de medição, integrado) e E14 (sondas, decisões ratificadas). Fase base, trilha de medição, Must.

## Critérios de aceite do card (literais)

1. Dado o cenário fixo de E1, quando as execuções do release e do coordinator terminam, então cada variante está registrada com contadores por papel, custo mediano e faixa, número de execuções, versão e commit. {verify: human; evidence: o dono confere as linhas da linha de base em measurements.md}
2. Dados o tema roteirizado e o evento fixo, quando o planner e o tracker rodam uma vez cada, então os contadores por papel estão registrados, com a nota de que custo não é comparado nessas duas skills. {verify: human; evidence: o dono confere as linhas da linha de base em measurements.md}
3. Dado o cenário semeado, quando o pipeline atual roda cinco vezes sobre cada artefato, então capturas, perdas e desfechos indeterminados por defeito, pela sentinela, estão registrados com 40 tentativas válidas por classe, e a taxa de tentativas inválidas também (DEC-051). {verify: human; evidence: o dono confere as linhas de detecção em measurements.md}
4. Dada a linha de base registrada, quando o executor deriva as metas dos entregáveis que prometem economia, então cada meta está na tabela de metas da estratégia com o contador, a variante e o cálculo, por revisão aprovada pelo dono (DEC-034). {verify: human; evidence: o dono aprova a revisão da estratégia que traz a tabela de metas}

Definição de pronto do card: linha de base registrada e conferida pelo dono.

## Contexto e limites

- As execuções pagas são operadas pelo dono (DEC-011, DEC-043; `state.md`, pendente 1: "o executor prepara os comandos do lançador e o dono opera as execuções pagas"). Nenhuma tarefa do plano lança `claude -p` real: o executor entrega as ferramentas, os comandos e o roteiro; rodar, conferir e aprovar são atos do dono. Os quatro critérios são `verify: human` e ficam para o dono.
- A branch de entregável não edita `docs/plans/roadmap-evolucao-skills/` (regra do release). As linhas de `measurements.md` e a revisão da estratégia com a tabela de metas são gravadas depois, pelo tracker, na branch de release, com os dados reais e a aprovação do dono. Este entregável gera o texto dessas linhas pronto para transcrição.
- Commit de partida: o plugin instalado é `productivity-tools@claude-play` 1.6.0, `gitCommitSha` `3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a`, e a tag `productivity-tools--v1.6.0` já aponta para esse commit (convenção de DEC-036). O release medido é o do cache, não o código da worktree; a ferramenta confere que o commit registrado nos agregados é o da tag.
- Variantes e número de execuções (DEC-033, DEC-016, DEC-084): `plan-only` 5, `completo` 3, `parada-retomada` 3, `coordinator` 3, `planner` 1, `tracker` 1; detecção: `plano-semeado-A`, `plano-semeado-B`, `codigo-semeado-A`, `codigo-semeado-B`, 5 cada. `plano-semeado-codigo` fica fora das execuções obrigatórias (DEC-084). As variantes `spec-semeado-*` são do arnês de E26 e não entram.
- 40 tentativas por classe = 2 artefatos x 4 defeitos x 5 execuções válidas (DEC-033, DEC-071). Uma tentativa de detecção é o par (defeito `detectedBy: reviewer`, execução válida).

## Lacunas encontradas em E1 que E15 precisa fechar

### Semeadura sobre spec e plano de uma execução aprovada

Pendente do dono em `state.md`: "Em E15, antes das tentativas de detecção, trocar o spec e o plano sintéticos da semeadura pelos de uma execução aprovada, com a opção `--from-run` do gerador de cenário; o dono aceitou a versão sintética em E1." Hoje isso não passa pelo lançador: `make-scenario.mjs` aceita `fromRun` (`makeScenario(dir, variant, { fromRun })`), mas `run-batch.mjs` chama `makeScenario(dir, variant)` sem ele e não tem a opção `--from-run`. Sem a correção, a detecção da linha de base (critério 3, REQ-031) seria medida sobre os artefatos sintéticos que o dono só aceitou para E1. E15 leva `--from-run` do condutor até o gerador (peças 1 e 3), registra a origem da semeadura no agregado (peça 1) e no texto da linha de base (peça 4), e põe o passo no roteiro (peça 5).

### Detecção por classe no comparador

O comparador de E1 (`tools/measure/compare.mjs`, `detectionFor`) conta como tentativas válidas as execuções válidas de um agregado, e cada agregado é de uma variante (um artefato). Com a linha de base de E15 (5 execuções por artefato), toda comparação futura sairia `inconclusivo` com 35 faltando e bloquearia todo ponto de medição (DEC-081), contrariando a regra de DEC-033 (queda de 6 capturas em 40 tentativas por classe). O agregado da classe também não existe: A e B ficam em agregados separados. E15 corrige isso em dois pontos pequenos (peça 2), sem mudar nenhum limiar: margem 6, 40 tentativas, tolerância de 3% e a regra de bloqueio do inconclusivo continuam como estão.

## Desenho

Todas as ferramentas ficam em `tools/measure/` (DEC-032), em JavaScript puro de Node, com comentários e mensagens em inglês como o resto da pasta; o roteiro do dono fica em português. Saídas brutas só em `tools/measure/out/` (ignorado pelo git).

### Peça 1: versão do superpowers e origem da semeadura no agregado (`run-batch.mjs`, `make-scenario.mjs`)

- Versão do superpowers: o card pede a versão do superpowers em cada linha (peça 4). `run-batch.mjs` passa a ler, do mesmo `installed_plugins.json` de onde já lê o plugin medido, a primeira entrada cuja chave comece por `superpowers@` e grava no agregado o campo aditivo `superpowers: { version, commit }` (`{ version: "ausente", commit: "ausente" }` quando não há entrada, com aviso no stderr).
- `--from-run <pasta>` no lançador: `run-batch.mjs` aceita a opção (e `runBatch` o campo `fromRun`) e a repassa a `makeScenario(dir, variant, { fromRun })` em cada tentativa. Só vale para variantes semeadas (nome com `semeado`); numa variante não semeada é erro de uso (código 2), para que uma origem dada por engano não passe calada. A pasta é a de `make-scenario`: uma árvore com `docs/superpowers/specs/*-E5-*-design.md` e `docs/superpowers/plans/*-E5-*.md`.
- Origem no agregado: `make-scenario.mjs` exporta `seedSourceOf(fromRun)`, que lê os dois textos pelo mesmo caminho de `e5Texts` (mesmo erro quando um falta) e devolve `{ kind: "execucao-aprovada", spec: <nome do arquivo>, plan: <nome do arquivo>, specSha256, planSha256 }`, com o hash do texto em LF como a semeadura o usa; sem `fromRun`, devolve `{ kind: "sintetico", spec: "scenario/e5/spec.md", plan: "scenario/e5/plan.md", specSha256, planSha256 }`. As variantes semeadas gravam no agregado o campo aditivo `seedSource` com esse valor; as não semeadas não têm o campo. O caminho da pasta não é gravado (regra de privacidade de E1: caminho de diretório pessoal); o nome dos arquivos e os hashes bastam para identificar a origem.
- Nada mais muda no lançador.
- Testes: em `run-batch.test.mjs`, superpowers com e sem a entrada, usando a pasta de configuração fabricada que o teste já monta; variante semeada com `--from-run` apontando para uma pasta temporária montada pelo teste (cópia renomeada da fixture sintética com uma linha a mais, para o hash diferir), conferindo que o cenário usou esses textos e que `seedSource` traz `execucao-aprovada` e os hashes; sem `--from-run`, `seedSource.kind` é `sintetico`; `--from-run` numa variante não semeada sai com código 2. Em `make-scenario.test.mjs`, `seedSourceOf` com e sem pasta e o erro quando falta o plano.

### Peça 2: detecção por classe no comparador (`compare.mjs`)

- `seededClass` aceita também o nome de variante da classe consolidada, `plano-semeado` e `codigo-semeado` (sem o sufixo de artefato), além dos atuais `-A`/`-B`.
- Em `detectionFor`, as tentativas válidas da classe passam a ser o número de desfechos `detectedBy: reviewer` daquela classe nas execuções válidas (capturado + perdido + indeterminado), e não o número de execuções válidas. A taxa continua capturados / (capturados + perdidos), e a queda continua (taxa antes - taxa depois) x `--attempts`. O campo `missing` passa a contar tentativas de detecção faltantes.
- As fixtures de detecção de `fixtures/aggregates/` são ajustadas para a nova contagem, mantendo um caso de cada veredito: abaixo de 40 tentativas de detecção (inconclusivo que bloqueia), queda acima e abaixo da margem, PX fora da taxa. Fixtures fabricadas seguem as regras do teste de privacidade de E1 (marca `[fab]`, ids da faixa reservada).

### Peça 3: condutor da linha de base (`tools/measure/run-baseline.mjs`)

Um comando para o dono operar a linha de base inteira, por cima de `runBatch` (importado, não por subprocesso):

```
node tools/measure/run-baseline.mjs --work <dir fora do repo> --out <dir> --config-dir <dir> --permission-mode <modo>
  [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]
  [--from-run <pasta>] [--only <variante,...>] [--dry-run] [--tag <nome>]
```

- O plano de execuções é uma constante exportada (`BASELINE_PLAN`) com as variantes e contagens do contexto acima, na ordem: planner, tracker, plan-only, coordinator, completo, parada-retomada, plano-semeado-A, plano-semeado-B, codigo-semeado-A, codigo-semeado-B (as baratas primeiro, para uma negação de permissão aparecer cedo).
- `--dry-run` imprime os comandos `run-batch` equivalentes, um por variante, e não lança nada: é a forma de "preparar os comandos do lançador" do `state.md`, e o roteiro mostra a saída. Nas variantes semeadas o comando traz `--from-run` com a pasta dada ou, sem ela, o marcador `<pasta-da-execucao-aprovada>`.
- Semeadura de uma execução aprovada (pendente do dono em `state.md`): `--from-run` é repassado a `runBatch` só nas variantes semeadas. Sem `--from-run`, o condutor roda as variantes não semeadas e pula as semeadas com a mensagem "variantes semeadas exigem --from-run <pasta de uma execução aprovada>" e código 1 (incompleto); como o condutor é retomável, o dono escolhe a execução aprovada depois de `completo` e roda de novo com a opção, e as variantes já completas são puladas. Nunca semeia com os textos sintéticos.
- Conferência prévia da origem: com `--from-run`, antes de lançar qualquer variante, o condutor chama `seedSourceOf` e monta, com `makeScenario`, um cenário descartável de cada variante semeada pedida em `<--work>/_conferencia-semeadura/` (sem `claude -p`, sem custo), apagado em seguida. Pasta sem spec ou plano de E5, ou sentinela que não acha a âncora no plano trazido (`<id>: anchor not found`, comportamento previsto em E1), sai com código 2 e a mensagem, antes de gastar.
- Retomável: antes de cada variante, procura em `--out` o agregado mais recente dela; se ele já tem as execuções válidas pedidas, pula. Uma variante incompleta roda só o que falta e o agregado parcial anterior é consolidado depois pela peça 4.
- Variantes semeadas: tentativa inválida (DEC-051, DEC-082) é repetida pelo condutor, até no máximo o número pedido de tentativas extras por variante (5); se ainda faltar, para a variante com código 1 e diz quantas faltam. Variantes não semeadas não repetem.
- Negação de permissão: a primeira tentativa negada para todo o condutor com código 1 e a mensagem do lançador, antes de gastar nas variantes seguintes.
- Antes de começar, confere que o plugin em `installed_plugins.json` tem o commit da tag `productivity-tools--v1.6.0` (resolvida por `git rev-parse`); se não tiver, sai com código 2 e diz o commit encontrado, a menos que `--tag <nome>` aponte outra tag de partida.
- Códigos de saída: 0 tudo completo, 1 negação, falha ou tentativas válidas faltando, 2 erro de uso.
- Teste `tools/measure/run-baseline.test.mjs` com `runBatch` injetado (simulado): ordem e contagens do plano, pulo de variante completa, repetição de inválidas com teto, parada na negação, conferência da tag, saída de `--dry-run` (com e sem `--from-run`), `fromRun` repassado só às variantes semeadas, semeadas puladas com código 1 sem `--from-run`, e conferência prévia que sai com código 2 para uma pasta sem plano e para um plano sem a âncora de uma sentinela (pasta temporária montada pelo teste), sem chamar `runBatch`.

### Peça 4: consolidador e texto das linhas (`tools/measure/baseline.mjs`)

```
node tools/measure/baseline.mjs --out <dir com os agregados> --dest <dir> [--date <AAAA-MM-DD>] [--tag <nome>]
```

- Lê os `aggregate.json` de `--out`, agrupa por variante e junta os agregados parciais da mesma variante (tentativas renumeradas, `valid`/`invalid`/`denied` somados, motivos de inválida somados, custo recalculado).
- Confere a coerência: mesmo commit e versão do plugin medido em todos, igual ao da tag; mesma versão da CLI, do superpowers e data da tabela de preços. Divergência é erro (código 1) com a lista, porque a linha de base tem de vir de um único estado (risco do card: modelos mudam).
- Origem da semeadura: as quatro variantes semeadas têm de ter o mesmo `seedSource` (mesmos nomes e hashes); divergência entra na lista de erros acima (código 1). `seedSource.kind` igual a `sintetico`, ou campo ausente numa variante semeada, marca a classe `incompleta (semeadura sintética)` no texto e no resumo, com código 1, porque o pendente do dono pede a execução aprovada.
- Monta os agregados de classe `plano-semeado` (A + B) e `codigo-semeado` (A + B), no formato que o comparador lê (peça 2), com o `seedSource` comum.
- Grava em `--dest`:
  - `baseline.json`: um agregado por variante e por classe, só com contadores por tentativa, desfechos, papéis somados, custo, versões, modelos e data dos preços. Antes de gravar, aplica as mesmas regras do teste de privacidade de E1 (UUID fora da faixa fabricada, id de agente, caminho de diretório pessoal) e recusa com código 1 se achar algo.
  - `linha-de-base.md`, em português:
    - tabela por variante do release e do coordinator: execuções válidas/pedidas, contadores por papel (chamadas por família, bytes de prompt), custo mediano e faixa, versão e commit do plugin, versão do superpowers, modelos, data da tabela de preços, versão da CLI e modo de permissão (critério 1);
    - planner e tracker: contadores por papel, com a nota "custo não é comparado nesta skill (DEC-016)" (critério 2);
    - detecção por classe: por defeito, capturas, perdas e indeterminados; tentativas válidas da classe (alvo 40); tentativas inválidas e taxa de inválidas por classe, com os motivos; origem da semeadura (tipo, nomes dos arquivos e hashes do spec e do plano) (critério 3); a detecção por código (PX) não aparece porque `plano-semeado-codigo` não roda (DEC-084);
    - valores de referência para as metas: mediana de cada contador por variante, que o executor usa para derivar as metas (critério 4);
    - as linhas prontas para a tabela `roadmap:measurements` de `measurements.md` (Data, Entregável E15, Tipo `linha-de-base`, Detalhe, Registrado com a soma dos custos devolvidos pela CLI, Faturado `-`, Status `concluído`), uma por variante e uma por classe de detecção.
- Faltas não impedem a gravação: variante ausente ou com menos execuções válidas que o plano sai marcada `incompleta` no texto e no resumo final, e o código de saída é 1. Assim o dono vê o que falta sem perder o que já rodou.
- Teste `tools/measure/baseline.test.mjs` com agregados fabricados em `tools/measure/fixtures/baseline/`: junção de parciais, classe A + B lida pelo comparador sem `missing`, divergência de commit, divergência de `seedSource` entre as semeadas, classe marcada `incompleta (semeadura sintética)` quando `seedSource.kind` é `sintetico`, recusa por privacidade, nota de custo de planner e tracker, variante incompleta e as linhas da tabela de medições.

### Peça 5: roteiro do dono

`docs/reports/2026-11-11-e15-linha-de-base/roteiro.md`, em português:

1. Pré-condições: plugin instalado 1.6.0 no commit da tag; regras de permissão da execução sem interface (as que o preflight do release exige e `Workflow(productivity-tools:roadmap-release)`, DEC-043); pasta de trabalho fora do repositório; o modo de permissão usado é registrado (risco de E14).
2. `run-baseline.mjs --dry-run` e depois o comando real sem `--from-run`: roda planner, tracker, plan-only, coordinator, completo e parada-retomada e pula as semeadas com código 1; como retomar após uma parada.
3. Troca da semeadura sintética pela de uma execução aprovada (pendente do dono em `state.md`), antes das tentativas de detecção: o dono escolhe uma tentativa de `completo` que aprova (E5 integrado em `release/sandbox` do sandbox daquela tentativa), cria uma árvore dessa branch fora do repositório (`git -C <sandbox da tentativa> worktree add <pasta> release/sandbox`), confere que ela tem `docs/superpowers/specs/*-E5-*-design.md` e `docs/superpowers/plans/*-E5-*.md`, e roda de novo `run-baseline.mjs` com `--from-run <pasta>` (primeiro com `--dry-run`). Se a conferência prévia acusar âncora não encontrada, o plano daquela execução tem outra forma: escolher outra tentativa aprovada. A escolha é do dono; o executor não a faz.
4. `baseline.mjs` e o que conferir em `linha-de-base.md` para cada critério, incluindo a origem da semeadura (tipo `execucao-aprovada`, nomes e hashes) na seção de detecção.
5. Copiar `baseline.json` e `linha-de-base.md` para a pasta do roteiro e commitar (a referência que E17, E11, E16 e E13 comparam); as saídas brutas de `tools/measure/out/` nunca são commitadas.
6. Pedir ao tracker o registro das linhas em `measurements.md` e a proposta de revisão da estratégia com a tabela de metas (contador, variante, cálculo = linha de base menos o que a mudança remove por construção, DEC-034), que só é gravada com a aprovação do dono.

### Fora do escopo

Rodar as execuções pagas, gravar `measurements.md`, `decisions.md` ou a estratégia, derivar as metas sem os dados reais, mexer na versão do plugin, no workflow do release ou nos gates.

### Arquivos

Alterados: `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`, `tools/measure/make-scenario.mjs`, `tools/measure/make-scenario.test.mjs`, `tools/measure/compare.mjs`, `tools/measure/compare.test.mjs`, fixtures de detecção em `tools/measure/fixtures/aggregates/`. Novos: `tools/measure/run-baseline.mjs`, `tools/measure/run-baseline.test.mjs`, `tools/measure/baseline.mjs`, `tools/measure/baseline.test.mjs`, `tools/measure/fixtures/baseline/`, `docs/reports/2026-11-11-e15-linha-de-base/roteiro.md`. Nenhum arquivo do plugin publicado muda, então G3 e G5 só confirmam a linha de base.

### Verificação

- G1 (`node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`) verde, com os testes novos; o teste de privacidade de E1 cobre os arquivos novos de `tools/measure/`.
- G2 a G5 sem mudança em relação à linha de base do alvo.
- Critérios 1 a 4: conferência e aprovação do dono, depois das execuções pagas.

## Riscos

- Poucas execuções não separam ganho de variação: contadores determinísticos primeiro, custo como medida secundária com mediana e faixa (card).
- Modelos ou CLI mudam no meio da linha de base: o consolidador recusa estados divergentes; a variante afetada é repetida (card).
- Taxa alta de tentativas inválidas nas semeadas (DEC-051): o condutor repete até o teto e o texto registra a taxa; se faltar, o dono decide (inconclusivo bloqueia e só o dono libera, DEC-081).
- O plano de uma execução aprovada pode não ter as âncoras das sentinelas (previsto em E1: `seed` lança `anchor not found`): a conferência prévia do condutor acusa isso com código 2, sem custo, e o dono escolhe outra tentativa aprovada.
- O formato real do diário só aparece na primeira execução real (E1, entrada humana): se as tentativas saírem `formato-do-diario`, o condutor para cedo, porque as semeadas vêm por último e as variantes baratas já terão revelado problemas de permissão.

## Autonomous decisions (reviewable by the owner)

1. As execuções pagas não são tarefa do plano: são ato do dono (DEC-011, DEC-043, `state.md`). O plano entrega ferramentas e roteiro; nenhuma tarefa externa de lançamento pago. Alcance: local.
2. Uma tentativa de detecção é o par (defeito `detectedBy: reviewer`, execução válida); o comparador passa a contar assim e aceita a classe consolidada `plano-semeado`/`codigo-semeado`. Limiares inalterados (DEC-033, DEC-081). Alcance: contrato (E17, E11, E16, E13, E26 e E27 leem o comparador).
3. Os agregados de classe saem de A + B pelo consolidador, não por uma nova variante do lançador. Alcance: contrato.
4. A versão do superpowers entra no agregado como campo aditivo `superpowers` lido de `installed_plugins.json`. Alcance: contrato.
5. Condutor `run-baseline.mjs` sobre `runBatch` importado, com plano fixo, `--dry-run`, retomada por agregado existente, parada na primeira negação e conferência do commit da tag `productivity-tools--v1.6.0` (o commit de partida já tem tag, então nenhuma tag nova é criada). Alcance: contrato.
6. Inválidas das semeadas repetidas até 5 tentativas extras por variante; depois o condutor para e reporta o que falta. Variantes não semeadas não repetem. Alcance: local.
7. A ordem do plano começa pelas variantes baratas (planner, tracker, plan-only) para uma negação de permissão aparecer antes do gasto maior. Alcance: local.
8. `baseline.json` (curado, verificado pelas regras de privacidade de E1) e `linha-de-base.md` são a referência commitável, em `docs/reports/2026-11-11-e15-linha-de-base/`; as saídas brutas continuam em `tools/measure/out/`, nunca commitadas (DEC-032). Alcance: contrato.
9. O consolidador recusa agregados de estados diferentes (commit, versão do plugin, CLI, superpowers, preços) e grava o parcial com marca `incompleta` quando faltam execuções. Alcance: local.
10. O texto das linhas de `measurements.md` usa o Tipo `linha-de-base`, uma linha por variante e por classe; a gravação é do tracker na branch de release. Alcance: local.
11. A derivação das metas (critério 4) fica para depois dos dados reais: o consolidador entrega os valores de referência e o roteiro a regra de DEC-034; a revisão da estratégia é proposta pelo tracker e só gravada com aprovação do dono. Alcance: local.
12. O pendente do dono sobre `--from-run` é atendido levando a opção de `run-baseline` a `run-batch` e a `makeScenario`, só nas variantes semeadas; `--from-run` numa variante não semeada é erro de uso em `run-batch`. Alcance: contrato (nova opção do lançador).
13. A origem da semeadura entra no agregado das variantes semeadas como campo aditivo `seedSource` (`execucao-aprovada` ou `sintetico`, nomes dos arquivos e SHA-256 do texto em LF), sem o caminho da pasta, por privacidade; o consolidador exige a mesma origem nas quatro semeadas e marca a classe `incompleta (semeadura sintética)` quando a origem é sintética. Alcance: contrato.
14. Sem `--from-run`, o condutor pula as semeadas com código 1 em vez de semear com os textos sintéticos; com ela, faz uma conferência prévia sem custo (cenário descartável de cada semeada) e sai com código 2 se a pasta ou as âncoras falharem. A execução aprovada é escolhida pelo dono depois de `completo`, e a retomada do condutor evita repetir variantes. Alcance: local.

## Depends on human input

- Execuções pagas da linha de base, operadas pelo dono com `run-baseline.mjs` no ambiente dele (plugin 1.6.0 instalado, regras de permissão da execução sem interface). Não bloqueia: as ferramentas, o roteiro e os testes com agregados fabricados (`[fab]`) são entregues sem elas; os dados reais entram quando o dono rodar.
- Conferência do dono das linhas da linha de base e de detecção (critérios 1 a 3). Não bloqueia a entrega das ferramentas; é o aceite do card.
- Aprovação do dono da revisão da estratégia com a tabela de metas (critério 4), depois das execuções pagas. Não bloqueia a entrega das ferramentas.
- Escolha, pelo dono, da execução aprovada cuja árvore vai em `--from-run` (pendente do dono em `state.md`), depois das execuções de `completo`. Não bloqueia a entrega: os testes usam uma pasta temporária montada a partir da fixture sintética; bloqueia só as tentativas de detecção reais.
- Ratificação das decisões de alcance contrato acima (2, 3, 4, 5, 8, 12, 13) antes de E17 começar (DEC-030).
