# Roteiro do dono: linha de base de E15

As execuções pagas são ato do dono (DEC-011, DEC-043). Este roteiro traz os comandos completos; `<...>` marca uma pasta ou valor que você escolhe. Nenhum caminho pessoal está gravado aqui. Rode tudo a partir da raiz do repositório, na tag da linha de base.

## 1. Pré-condições

- Plugin `productivity-tools` 1.6.0 instalado, e o repositório no commit da tag `productivity-tools--v1.6.0` (o condutor confere o commit da tag; a opção `--tag <nome>` troca a tag).
- Regras de permissão da execução sem interface: as que o preflight do release exige (`Bash(git:*)`, `Bash(node:*)` e as demais que ele listar) e `Workflow(productivity-tools:roadmap-release)` (DEC-043). Passe cada uma com `--allow <regra>`. Se o plugin vier do cache, passe também `--add-dir <pasta da versão do plugin>`; sem isso o lançamento por caminho é negado (sondas de E14).
- Pasta de trabalho `<work>` fora do repositório, pasta de saída `<out>` (use `tools/measure/out/`, ignorada pelo git) e pasta de configuração `<config-dir>` com o `installed_plugins.json` do plugin medido e do superpowers.
- Modo de permissão `<modo>` anotado: ele é gravado nos agregados e muda o resultado (risco de E14).

Uso das duas CLIs (sem argumentos, ambas imprimem o uso e saem com código 2):

```
node tools/measure/run-baseline.mjs --work <dir> --out <dir> --config-dir <dir> --permission-mode <mode> [--allow <rule>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--from-run <folder>] [--only v1,v2] [--dry-run] [--tag <name>]
node tools/measure/baseline.mjs --out <dir> --dest <dir> [--date YYYY-MM-DD] [--tag <name>]
```

`--model <m>` e `--max-budget-usd <x>` são opcionais: o primeiro fixa o modelo das sessões, o segundo limita o gasto de cada tentativa.

## 2. Dry-run e a primeira execução (sem `--from-run`)

Primeiro veja os comandos, sem lançar nada e sem custo:

```
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode <modo> --allow "Workflow(productivity-tools:roadmap-release)" --allow "Bash(git:*)" --allow "Bash(node:*)" --dry-run
```

A saída é um comando `run-batch` por variante, na ordem: planner, tracker, plan-only, coordinator, completo, parada-retomada, plano-semeado-A, plano-semeado-B, codigo-semeado-A, codigo-semeado-B. Nas semeadas aparece o marcador `<pasta-da-execucao-aprovada>`.

Depois rode de verdade (mesmos argumentos, sem `--dry-run`):

```
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode <modo> --allow "Workflow(productivity-tools:roadmap-release)" --allow "Bash(git:*)" --allow "Bash(node:*)"
```

Esperado: roda as variantes não semeadas e pula as semeadas com a mensagem "variantes semeadas exigem --from-run <pasta de uma execução aprovada>" e código de saída 1. O código 1 aqui é esperado, não é falha.

Como retomar após uma parada (negação de permissão, orçamento, queda): corrija a causa e rode o mesmo comando de novo. O condutor procura em `<out>` os agregados da variante, soma as execuções válidas e roda só o que falta; variantes completas são puladas. A primeira negação de permissão para o condutor inteiro, com código 1 e a mensagem do lançador, antes de gastar nas variantes seguintes. Para repetir só algumas variantes, use `--only planner,tracker`.

## 3. Trocar a semeadura sintética pela de uma execução aprovada

Pendente do dono em `state.md`; faça antes das tentativas de detecção. A escolha da execução é sua; o executor não a faz.

1. Escolha uma tentativa de `completo` que aprova (E5 integrado em `release/sandbox` do sandbox daquela tentativa). O sandbox fica sob `<work>` (a pasta exata consta na saída do lançador).
2. Crie uma árvore dessa branch fora do repositório:

```
git -C <sandbox da tentativa> worktree add <pasta-aprovada> release/sandbox
```

3. Confira que a árvore tem os dois arquivos de E5:

```
ls <pasta-aprovada>/docs/superpowers/specs/*-E5-*-design.md
ls <pasta-aprovada>/docs/superpowers/plans/*-E5-*.md
```

4. Veja os comandos com a origem real (a conferência prévia roda aqui, sem `claude -p` e sem custo):

```
node tools/measure/run-baseline.mjs --work <work> --out <out> --config-dir <config-dir> --permission-mode <modo> --allow "Workflow(productivity-tools:roadmap-release)" --allow "Bash(git:*)" --allow "Bash(node:*)" --from-run <pasta-aprovada> --dry-run
```

5. Rode de verdade, com o mesmo comando sem `--dry-run`. As variantes já completas são puladas.
6. Se a conferência prévia disser `anchor not found` (código 2, antes de gastar), o plano daquela execução tem outra forma e as sentinelas não acham a âncora: escolha outra tentativa aprovada e repita desde o passo 2. Pasta sem spec ou plano de E5 também sai com código 2.

Nunca semeie com os textos sintéticos para a linha de base. As inválidas das semeadas são repetidas pelo condutor até 5 tentativas extras por variante; se ainda faltar, ele para com código 1 e diz quanto falta, e a decisão é sua (inconclusivo bloqueia e só o dono libera, DEC-081).

## 4. Consolidar e conferir

```
node tools/measure/baseline.mjs --out <out> --dest <dest> --date <AAAA-MM-DD>
```

`<dest>` é uma pasta temporária. O comando grava `baseline.json` e `linha-de-base.md`; peças faltantes não impedem a escrita, mas dão código 1 e aparecem em "Pendências". Dado privado (caminho pessoal) faz o consolidador recusar.

O que conferir em `linha-de-base.md`:

- Critério 1: em "Release e coordinator", cada variante com execuções válidas/pedidas, contadores por papel, custo mediano e faixa, versão e commit do plugin, versão do superpowers, modelos, data da tabela de preços, versão da CLI e modo de permissão.
- Critério 2: em "Planner e tracker", os contadores por papel e a nota "custo não é comparado nesta skill (DEC-016)".
- Critério 3: em "Detecção por classe", por defeito, capturas, perdas e indeterminados; 40 tentativas válidas por classe; tentativas inválidas, taxa e motivos. Confira a origem da semeadura: tipo `execucao-aprovada` (não `sintetico`), nomes dos arquivos e hashes do spec e do plano. Uma classe marcada `incompleta (semeadura sintética)` não vale.
- Critério 4: em "Valores de referência para as metas", a mediana de cada contador por variante, base da tabela de metas (passo 6).

## 5. Guardar a referência

Copie os dois arquivos para a pasta do roteiro e commite; é a referência que E17, E11, E16 e E13 comparam:

```
cp <dest>/baseline.json <dest>/linha-de-base.md docs/reports/2026-11-11-e15-linha-de-base/
git add docs/reports/2026-11-11-e15-linha-de-base/baseline.json docs/reports/2026-11-11-e15-linha-de-base/linha-de-base.md
git commit -m "docs(report): linha de base de E15"
```

Nunca commite `tools/measure/out/` (saídas brutas, ignoradas pelo git).

## 6. Registro e metas

Peça ao tracker (`productivity-tools:roadmap-tracker`) duas coisas:

1. Registrar em `measurements.md` as linhas da seção "Linhas para roadmap:measurements" de `linha-de-base.md` (critérios 1 a 3, que você confere ali).
2. Propor a revisão da estratégia com a tabela de metas: para cada entregável que promete economia, contador, variante e cálculo, onde meta = linha de base menos o que a mudança remove por construção (DEC-034). Meta não atingida depois não bloqueia a publicação; é registrada e exige decisão sua no fechamento.

A revisão só é gravada com a sua aprovação (critério 4).
