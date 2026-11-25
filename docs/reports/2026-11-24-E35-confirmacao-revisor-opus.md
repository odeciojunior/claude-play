# E35: confirmação do revisor por tarefa opus na 2.5.0 (AC2)

Data: 2026-11-24. Desenho: `docs/plans/2026-11-21-measure-e35-confirmacao-opus-design.md`. Decisões: DEC-004, DEC-018 (piso em 40 oportunidades), DEC-044 a DEC-048 (lote do E35). Relatório de referência: `docs/reports/2026-11-17-E30-revisor-opus.md`. Lote pago na config descartável `D:\claude-pos23-cfg`, worktree `D:/claude-pos23-release` em `6abab96` (árvores `plugins` 4855944 e `tools/measure` 8266a79, iguais às de c683ec5), variante `lentes-semeadas-A/B`, braço opus (`--review-model opus`), laço `loop`.

## Resultado

- **Veredito: o AC2 fica confirmado com amostra reduzida (8 válidas de 10, 32 oportunidades), e não com as 40 oportunidades da DEC-004.** O piso proporcional da DEC-048 foi atingido nas duas recontagens (sem menção, falha com risco aceito). A S3-24 (`reviewModelFor` padrão opus) fica; a regra de reprovação da DEC-044 não foi acionada.
- **Ressalva:** o piso de 32 foi fixado depois de ver 4 execuções (A-1, B-1, A-2, B-2), antes da A-3. Ele não foi escolhido olhando os resultados: é a DEC-018 multiplicada por 0,8 (32 de 40), com os mínimos arredondados para cima e o máximo de perdidos para baixo. Quando ele foi fixado, o placar já era conhecido: 13/16 capturas (spec 8/8, quality 5/8), 3 perdidos; faltavam 8 capturas nas 16 oportunidades restantes. Mesmo assim, não é um piso pré-registrado antes de qualquer execução, e a confirmação vale como tal.
- **Custo:** US$ 8,313 contra o teto de US$ 9,00 (DEC-047); US$ 1,039 por válida, 1,85 vez o opus do E30 (0,561). Ver "Custo".

## Piso da DEC-048

| Condição | Mínimo (DEC-048) | Base | Recontagem sem menção | Recontagem falha com risco aceito | Passa |
|---|---|---|---|---|---|
| Determinadas | >= 26/32 | 30 | 30 | 30 | sim |
| Capturas | >= 21/32 | 26 | 26 | 26 | sim |
| Lente spec | >= 13/16 | 16 | 16 | 16 | sim |
| Lente quality | >= 7/16 | 10 | 10 | 10 | sim |
| Perdidos | <= 11/32 | 4 | 4 | 4 | sim |

As duas recontagens não mudam nada: nenhuma captura ficou sem menção (a leitura do diário confirmou, nas 26 capturas, um achado de revisor que nomeia a semente) e nenhuma tentativa teve `failRiscoAceito`. Os 4 perdidos e as 2 indeterminadas são de origem diferente (ver "Indeterminadas e perdidos").

## Totais consolidados

Soma das 8 válidas por `armTotals` (`tools/measure/run-batch.mjs`), com `recountLenses` para as recontagens. Nenhuma parada do harness disparou (`stop` nulo; 0 inválidas, 0 `laco-divergente`, 0 `semente-ausente`, 0 sintéticos).

| | Total | Spec | Quality |
|---|---|---|---|
| Oportunidades | 32 | 16 | 16 |
| Capturadas | 26 | 16 | 10 |
| Perdidas | 4 | 0 | 4 |
| Indeterminadas | 2 | 0 | 2 |
| Determinadas | 30 | 16 | 14 |

Por execução (artefato A: SP1, SP2, QL1, QL2; artefato B: SP3, SP4, QL3, QL4):

| Execução | Capturas | Perdida / indeterminada | Reviews / correções | `cliCostUsd` (US$) |
|---|---|---|---|---|
| A-1 | 3/4 | QL2 perdida | 3 / 1 | 0,904 |
| B-1 | 4/4 | | 4 / 2 | 1,117 |
| A-2 | 3/4 | QL2 perdida | 3 / 1 | 0,817 |
| B-2 | 3/4 | QL3 perdida | 4 / 2 | 1,071 |
| A-3 | 3/4 | QL2 perdida | 3 / 1 | 0,821 |
| B-3 | 2/4 | QL3 e QL4 indeterminadas | 3 / 2 | 0,964 |
| A-4 | 4/4 | | 4 / 2 | 1,147 |
| B-4 | 4/4 | | 5 / 3 | 1,472 |
| **Total** | **26/32** | 4 perdidas, 2 indeterminadas | 29 / 14 | **8,313** |

## Indeterminadas e perdidos

**B-3, QL3 e QL4 indeterminadas.** O laço `spec` da B-3 não convergiu: depois de 3 revisões e 2 correções ainda sobrava um achado aberto (F3, o `performance.now() < 50` do teste, que é a semente QL4), e o laço terminou com `stop: conteudo` e `ok: false`. O laço `quality` não rodou, então nenhuma das duas sementes da lente quality ficou determinada: a QL3 nunca foi nomeada, e a QL4 foi nomeada só pelo laço spec (menor na rodada 2, importante na rodada 3) e não chegou a ser removida. O harness conta a tentativa como válida e marca as duas como indeterminadas. Não é falha com risco aceito (`failRiscoAceito` falso) nem parada de harness. Efeito no piso: 2 oportunidades a menos nas determinadas (30 de 32), que seguem acima de 26.

**A-1, anomalia da QL2.** A QL2 aparece como `perdido` com `capturadoPor = spec/1` e `mentioned = true`. Lido no diário: o primeiro review do laço spec nomeou a semente, mas dentro do achado F4, de severidade `minor` ("o teste importa por `process.cwd()` e só passa a partir da raiz do repositório"), junto com a falta de teste para texto em branco. O corretor tratou F1 a F3 e deixou o F4 de lado; na revisão `quality` o F4 reaparece sem a menção ao `cwd`. A semente continuou presente no fim (a sentinela comportamental acusou o teste frágil), então o resultado é `perdido`: nomeada e não removida. A regra do arnês já conta assim (no E30, observação 2, "sementes nomeadas e não removidas"). Não é erro de contagem: `capturadoPor` e `mentioned` dizem quem nomeou, `outcome` diz se a semente saiu. A mesma leitura vale para a A-2 e a A-3, só que lá a QL2 nunca foi nomeada (`mentioned = false`).

**Padrão por semente.** A QL2 (teste frágil por `cwd`, artefato A) foi perdida em 3 de 4 (A-1 nomeada e não removida; A-2 e A-3 não nomeada) e capturada na A-4, pelo laço quality (importante, "teste frágil que quebra a convenção do projeto"). A QL3 (ReDoS no trim, artefato B) foi capturada em 2 (B-1 e B-4, ambas pelo laço quality), perdida na B-2 (nunca nomeada) e indeterminada na B-3. A QL4 (teste com tempo, B) foi capturada em 3, indeterminada na B-3. As outras 5 sementes (SP1 a SP4, QL1) foram capturadas em 4 de 4 cada.

## Comparação com o E30

Por oportunidade, porque as amostras têm tamanhos diferentes (E35 opus 32, E30 opus e sonnet 40):

| | E35 opus (8) | E30 opus (10) | E30 sonnet (10) |
|---|---|---|---|
| Capturas | 26/32 (81%) | 28/40 (70%) | 20/40 (50%) |
| Spec | 16/16 (100%) | 18/20 (90%) | 15/20 (75%) |
| Quality | 10/16 (63%) | 10/20 (50%) | 5/20 (25%) |
| Perdidos | 4/32 | 12/40 | 20/40 |
| Indeterminadas | 2 | 0 | 0 |

Por semente (capturadas/perdidas/indeterminadas):

| Semente | E35 opus | E30 opus | E30 sonnet |
|---|---|---|---|
| SP1 | 4/0/0 | 5/0/0 | 5/0/0 |
| SP2 | 4/0/0 | 5/0/0 | 5/0/0 |
| QL1 | 4/0/0 | 5/0/0 | 5/0/0 |
| QL2 | 1/3/0 | 0/5/0 | 0/5/0 |
| SP3 | 4/0/0 | 5/0/0 | 5/0/0 |
| SP4 | 4/0/0 | 3/2/0 | 0/5/0 |
| QL3 | 2/1/1 | 0/5/0 | 0/5/0 |
| QL4 | 3/0/1 | 5/0/0 | 0/5/0 |

O lote da 2.5.0 repete o padrão do E30 e vai além: o opus segue acima do sonnet em tudo, e agora pega a SP4 (4 de 4) e a QL3 (2 de 4), que antes eram 3 de 5 e 0 de 5. A QL4, que o opus pegava em 5 de 5 no E30, ficou em 3 de 3 determinadas (3 de 4 oportunidades, uma indeterminada pela B-3, nenhuma perda). A QL2 continua a semente mais difícil. O E35 não tem braço sonnet: a comparação com ele vem do E30, com outro ambiente (ver abaixo), e vale como ordem de grandeza.

## Projeção informativa para 40

Só ilustrativa, não é medição nem substitui a DEC-048. Mantidas as taxas do lote (fator 1,25): cerca de 32,5 capturas, 20 na lente spec, 12,5 na quality, 5 perdidos e 2,5 indeterminadas (37,5 determinadas). Isso passaria o piso original da DEC-018 (determinadas >= 32, capturas >= 26, spec >= 16, quality >= 8, perdidos <= 14), com folga de 6 capturas, mas a incerteza é grande: pelo intervalo de Wilson a 95% para 26/32 (65% a 91%, tratando as oportunidades como independentes, o que não são), o limite inferior encosta nos 65% do piso (26/40). A confirmação é do piso proporcional; o piso de 40 não foi testado.

## Custo

| | E35 | E30 opus |
|---|---|---|
| Válidas | 8 | 10 |
| Total (US$) | 8,313 | 5,613 |
| Por válida (US$) | 1,039 | 0,561 |
| Artefato A / B por válida (US$) | 0,922 / 1,156 | 0,503 / 0,620 |

**1,85 vez o E30 por válida.** A razão parcial era 1,74 quando a parada da DEC-047 disparou (US$ 3,910 em 4 válidas); com as 8 ela subiu, porque A-4 (1,147) e B-4 (1,472) custaram mais. Diagnóstico do Fable (DEC-047/DEC-048), resumido: a sessão principal passou a ler o script do harness, o corretor (sonnet) trabalha mais por chamada e a paginação do E41 aumentou a leitura. Conferido nas transcrições e nos agregados:

| Rubrica | E35 por execução (US$) | E30 por execução (US$) | Razão |
|---|---|---|---|
| Sessão principal (`session.transcriptCostUsd`) | 0,334 | 0,169 | 2,0 |
| Reviews (opus) | 0,394 | 0,289 | 1,4 |
| Correções (sonnet) | 0,311 | 0,103 | 3,0 |

O número de chamadas mudou pouco (reviews 3,6 contra 3,5 por execução; correções 1,75 contra 1,5); o que subiu foi o custo por chamada de correção (US$ 0,178 contra 0,069) e os turnos da sessão principal (6,4 contra 3,7).

**`cliCostUsd` contra `transcriptCostUsd`.** `cliCostUsd` é o custo da execução inteira, usado como custo da válida. `session.transcriptCostUsd` é só a sessão principal, calculada pelas transcrições: US$ 2,672 de 8,313 (32%). Somado ao custo das transcrições dos subagentes (reviews, correções), dá `cliCostUsd` em todas as 8 execuções (diferença de ordem de 1e-16). O custo registrado é o maior dos dois (`max(cliCostUsd, transcriptCostUsd + papéis)`), então aqui os dois caminhos concordam; `transcriptCostUsd` sozinho subestima.

**Paradas disparadas.**

1. **US$ 3,60 depois de 4 válidas:** acumulado de US$ 3,910 (A-1 0,904, B-1 1,117, A-2 0,817, B-2 1,071). A DEC-047 mandava parar e voltar via Fable; a DEC-048 fechou o lote em 8 válidas (4A + 4B), com piso proporcional fixado antes da A-3. Antes disso, a A-1 (US$ 0,904) já havia passado do limite de US$ 0,62 da DEC-046, o que levou à DEC-047.
2. **B-4 acima de US$ 1,40:** custou US$ 1,472, com o lote já completo (8 de 8). É o gatilho de revisão da DEC-048 ("execução acima de 1,40"); sem efeito no veredito, porque a execução já era válida e a oitava. Acumulado final US$ 8,313, US$ 0,687 abaixo do teto de US$ 9,00.

## Ambiente e diferenças em relação ao E30 (DEC-045)

| Item | E35 | E30 |
|---|---|---|
| CLI | 2.1.331, igual nas 8 execuções | 2.1.326 |
| Produto | 2.5.0 em `6abab96` (com E41 e E38; E41 também mudou o `task-reviewer.md`) | 2.2.0 em `a15165b` |
| superpowers | 7.0.0, `bb92a77`, loja local `pos23-fixo` | igual (`pos22-fixo`) |
| `CLAUDE.md` | nenhum | havia cópia de 2026-11-17 |
| `CLAUDE_CODE_SUBAGENT_MODEL` | ausente (inerte: toda chamada do arnês passa `model`) | definida |
| settings da config | `env` só com `DISABLE_AUTOUPDATER=1`; única loja extra é a local `pos23-fixo`; plugins synced desligados | n/d |
| Plugins synced do claude.ai | desligados | n/d |
| Ritmo | execuções em sequência; pausa de cerca de 3 minutos entre B-2 e A-3 (a parada dos US$ 3,60) | n/d |
| Modelo servido (`message.model` das transcrições) | `claude-opus-5-5` (reviews) e `claude-sonnet-5-5` (sessão principal e correções) | opus-5-5 e sonnet-5-5 |

Por causa dessas diferenças, a comparação com o E30 vale como ordem de grandeza (principalmente o custo, em que a 2.5.0 e o E41 pesam), não como teste controlado. O produto, o harness e a árvore não mudaram durante o lote (versão, commit e `pricesDate` iguais nos 8 agregados).

## Regra da DEC-044

O lote mede a 2.5.0 publicada, e não `fc1d9ee`. Reprovação no piso não reverteria a S3-24 sozinha: o lote pararia e voltaria via Fable, porque o E41 também mudou o `task-reviewer.md`. O piso foi atingido, então a regra não foi acionada e a S3-24 permanece. A regra continua valendo para qualquer lote futuro que reavalie o `reviewModelFor`.

## Contador da R3 (laço quality)

Capturas marginais do laço quality no E35 (semente capturada cujo primeiro achado que a nomeia vem de uma rodada quality, `capturadoPorMatriz`): **3** (B-1 QL3, A-4 QL2, B-4 QL3), todas na 1ª rodada quality, severidade importante, cada uma seguida de 1 correção. Sem menção: 0. Das 10 capturas da lente quality, 7 foram nomeadas primeiro pelo laço spec (QL1 em 4 de 4 e QL4 em 3), mas por remoção a divisão é 5 do laço spec e 5 do laço quality: na B-1 e na B-4 o spec nomeou a QL4 como `minor` sem removê-la, e quem a removeu foi a correção do laço quality. Acumulado do braço opus: 1 (E30) + 3 (E35) = 4 em 18 válidas, acima do limiar de manutenção da R3 (2 ou mais no braço escolhido). Leitura informativa: o laço quality fica; o E35 não foi desenhado para decidir a R3.

## Alerta de custo para E37 e E39

A DEC-047 já manda reprojetar o teto antes da sonda de E37 e E39. O custo unitário do revisor opus na 2.5.0 é cerca de 1,85 vez o do E30 (US$ 1,04 por válida, e não 0,56; B custa mais que A, de US$ 1,16 contra 0,92). Qualquer projeção feita com os custos unitários do E30 subestima quase pela metade, e uma execução isolada pode passar de US$ 1,40 (B-4: 1,472). O teto do E35 subiu US$ 2,00 pela DEC-047 (de 7 para 9) e o gasto passou do teto original em US$ 1,313; o saldo da reserva depende do que o roadmap fizer com os US$ 0,687 que sobraram do teto de 9,00.

## Observações

1. **Laço spec sem convergência (B-3):** com 3 rodadas, um achado menor/importante repetido (`performance.now() < 50`) impediu o laço quality de rodar. Isso reduz a amostra da lente quality e pode acontecer de novo; vale como cuidado ao ler lotes futuros (uma indeterminada por laço que não converge, não por falha do revisor).
2. **Sementes nomeadas e não removidas** (contadas como perdidas, pela regra): A-1 QL2 (nomeada como achado menor pelo laço spec, não corrigida).
3. **Captura marginal maior que no E30:** 3 em 8 válidas, contra 1 em 10 no E30 (opus). Ainda assim o laço spec do opus nomeia defeitos de qualidade sozinho (QL1 em 4 de 4, QL4 em 3), e 7 das 10 capturas da lente quality foram nomeadas primeiro por ele; por remoção, a divisão é 5 e 5, o que reforça manter o laço quality.

## Saídas

- Agregados: `D:/claude-e35-out/opus/<A|B>-<k>/.../aggregate.json` (8, com `private/`).
- Transcrições copiadas das sessões do lote: `D:/claude-e35-out/transcripts/opus/<exec>/` (110 arquivos, 15 MB).
- `D:/claude-e35-out/SHA256SUMS`: 158 arquivos (agregados, `private/` e transcrições), conferidos com `sha256sum -c`: 158 OK.
- Log do lote: `D:/claude-e35-lote.log`.
- A config descartável `D:/claude-pos23-cfg` e a worktree `D:/claude-pos23-release` ficam intactas até nova ordem.
