# E30: revisor por tarefa sonnet contra opus e destino do laço quality

Data: 2026-11-17. Desenho: `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md` (Revisão 2; decisões do dono DEC-021 e DEC-022). Lote pago na config descartável `D:\claude-pos22-cfg`, worktree `D:/claude-pos22-release` em `a15165b` (árvores `plugins` 8eae29d e `tools/measure` 9ac17eb, iguais às de b1e3fe0).

## Resultado

- **R1:** o braço sonnet não dá teto (20 < 37; QL2 perdido em todas as tentativas A). O opus roda.
- **R2:** o opus passa em todas as condições. **Resultado da medição: o revisor por tarefa opus é melhor que o sonnet nas sementes da passada C.** Pela decisão 7 do dono, a mudança de produto vai para um roadmap futuro, com spec própria; nada muda antes de E33.
- **R3:** inconclusivo, **o laço quality fica**. Há 1 captura marginal em cada braço; o piso de oportunidades foi atingido (27 ≥ 10).

## Ambiente

| Item | Valor |
|---|---|
| CLI | 2.1.326 (igual antes e depois) |
| Plugin | `--plugin-dir`, versão 2.2.0, commit a15165b em todas as tentativas |
| superpowers | 7.0.0, bb92a77, loja local `pos22-fixo` |
| settings.json da config | sha256 52a74e7f… (tirado depois do install; igual antes e depois) |
| Plugin `@claude-play` carregado | nenhum (enabledPlugins, installed_plugins, known_marketplaces e cache conferidos) |
| Modelo servido do revisor | `claude-sonnet-5-5` em todo o braço sonnet, `claude-opus-5-5` em todo o braço opus (message.model das transcrições) |

## Gasto

| Braço | US$ | Teto |
|---|---|---|
| sonnet | 3,602 | 5 |
| opus | 5,613 | 11 |
| **E30** | **9,216** | 16 |

Sobra de E30 para a reserva comum: US$ 6,78 (reserva passa a 15,78, liberada só via Fable).

## Totais por braço

| | Sonnet | Opus |
|---|---|---|
| Válidas / inválidas | 10 / 0 | 10 / 0 |
| Capturas / perdidos | 20 / 20 | 28 / 12 |
| Lente spec (capt. / perd.) | 15 / 5 | 18 / 2 |
| Lente quality (capt. / perd.) | 5 / 15 | 10 / 10 |
| Sintéticos, laço divergente, falha com risco aceito, captura sem menção | 0 | 0 |
| Custo por válida (US$) | 0,360 | 0,561 |

Reconta independente feita pelo orquestrador sobre os 20 `aggregate.json`: mesmos números.

## Aplicação das regras

**R2 (opus entra):**

| Condição | Conta | Passa |
|---|---|---|
| Determinadas O ≥ 32 | 40 | sim |
| Capturas O ≥ S + 4 | 28 ≥ 24 | sim |
| Spec O ≥ S − 2 | 18 ≥ 13 | sim |
| Quality O ≥ S − 2 | 10 ≥ 3 | sim |
| Perdidos O ≤ S − 2 | 12 ≤ 18 | sim |
| Custo O ≤ 2,5 × S | 0,561 ≤ 0,901 | sim |

As recontagens (sem menção, falha com risco aceito) dão os mesmos números; o lado não muda. O ganho vem do artefato B: SP4 em 3 de 5 e QL4 em 5 de 5 com opus; com sonnet, QL4 ficou perdido nas 5.

**R3 (laço quality):** capturas marginais do laço quality: sonnet 1 (A-3, QL1), opus 1 (B-5, QL4). "Retirar" exige 0 nos dois; "manter" exige 2 ou mais no braço escolhido (opus tem 1). Cai em inconclusivo: o laço fica. Custo médio do laço por tentativa: sonnet US$ 0,047, opus US$ 0,143. O laço gerou correção por tarefa em 2 de 10 tentativas sonnet e 5 de 10 opus (em E16 foram 0).

## Observações

1. **Reprodução da passada C:** o braço sonnet repetiu os números dela (20/40, spec 15, quality 5). O custo por válida subiu de 0,301 para 0,360.
2. **Sementes nomeadas e não removidas** (contadas como perdidas, pela regra): sonnet B-1, B-3, B-5 (QL4 nomeado pelo spec); opus A-2 (QL2 nomeado pelo quality, aprovado sem correção); opus B-3 e B-4 (SP4); opus B-3 (QL3 corrigido sem remover o defeito). Não mudam R2 nem R3; valem para o desenho da mudança de produto.
3. **Lacuna da R3:** o caso "1 captura marginal em cada braço" não tem regra própria e cai no inconclusivo genérico.
4. **Loja `pos22-fixo` no settings.json:** escrita pelo `marketplace add`/`install` depois da limpeza; sem `claude-play`, não é parada.

## Saídas

- Agregados: `D:/claude-e30-out/<sonnet|opus>/<A|B>-<k>/.../aggregate.json` (20).
- Transcrições copiadas: `D:/claude-e30-out/transcripts/<braço>/<exec>/`.
- `D:/claude-e30-out/SHA256SUMS`: 348 arquivos, conferidos com `sha256sum -c` pelo orquestrador.
- A config descartável fica intacta até o relatório de E31.
