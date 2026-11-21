# Plano: insumos para o próximo roadmap das skills de produtividade

Proposta do executor, 2026-11-20; as decisões da seção 7 são do dono. Fonte (SRC) a passar ao roadmap-planner. Lido no worktree `D:/projects/claude-play-wt/retro`, `main` em `dae686b`. Abreviações das fontes:
`state` = `docs/plans/roadmap-pos-2-2-0/state.md` (pendências); `dec` = `docs/plans/roadmap-pos-2-2-0/decisions.md`; `med` = `measurements.md` da mesma pasta; `E32tri` = `docs/reports/2026-11-15-E32-triagem-backlog.md`; `E30rel`, `E31rel`, `E33rel` = relatórios de 2026-11-17; `E30des` = `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`; `estr22` = `docs/plans/2026-11-15-roadmap-pos-2-2-0.md`; `estrEvo` = `docs/plans/2026-11-10-roadmap-evolucao-skills.md`; `sessão` = fatos da conversa do orquestrador com o dono (2026-11-12 a 2026-11-20). DEC sem roadmap citado não existe neste texto: sempre "DEC-nnn do pós-2.2.0" ou "do roadmap de evolução".

## 1. Objetivo proposto

**Proposta do executor, a decidir pelo dono.** Tornar o workflow do release confiável onde ele hoje confia em transcrição de modelo barato ou bloqueia sem saída (cargas por haiku, commit e reuso da spec, gate de testes com remoção declarada), adotar o revisor por tarefa opus aprovado em E30 junto da S3-24, endurecer o arnês de medição contra o ambiente compartilhado, refazer a linha de base de parada-retomada e publicar a versão seguinte. Recomendação: abrir antes o espaço que falta no `roadmap-release.js` e deixar fora as notas de baixo valor e as medições sem hipótese.

## 2. Ponto de partida

| Item | Valor | Fonte |
|---|---|---|
| Versão publicada | productivity-tools 2.3.0; `main` = `896f9ed` (ponta atual, que inclui os docs de 2026-11-20); tag `productivity-tools--v2.3.0` em `3d30412`, 3 commits (só docs) atrás de `main` | `plugin.json`; `git rev-list` |
| Testes (G1) | 2204 testes, 2202 pass, 0 falhas, 2 skipped na ponta da release | E33rel, "Portões na ponta da release" |
| Portões | G1 a G5 verdes; avisos preexistentes `ICON_MISSING` (G3) e 1 WARN de links em `delegation-protocol.md` (G5) | E33rel |
| Tamanho do workflow | `roadmap-release.js` com 245.049 caracteres LF em `dae686b` (245.074 bytes; o `state` registra 244.453, de antes das correções de E33); teto 250.000 caracteres (`MAX_WORKFLOW_CHARS`, `size.test.mjs`); folga cerca de 4.950 | medição; `size.test.mjs` |
| Limite real de lançamento | 524.288 bytes do arquivo; acima disso o lançamento pelo nome responde "not found" | comentário de `size.test.mjs` (relatório de E8 do roadmap de evolução) |
| Estrutura do workflow | arquivo único, sem imports (linha 20); `runDeliverable` ocupa ~100.320 caracteres; bloco `<pure>` ~75.508; 292 linhas de comentário somam 31.236 caracteres; programa embutido `TEST_INTEGRITY_DEFAULT` ~1.500 | medição por script nesta redação |
| Gasto pago do pós-2.2.0 | US$ 24,33 de 40: E30 9,216; E31 13,24; sonda de E33 1,87 | med; DEC-036 do pós-2.2.0 |
| Custos unitários medidos | lote E30: US$ 9,22 por 20 execuções task-review (0,46 em média; sonnet 0,360 e opus 0,561 por válida); parada-retomada inteira ~US$ 4,0 (3,54 a 4,76); sonda plan-only US$ 1,87 | E30rel; E31rel; med |
| Medido e decidido | revisor por tarefa opus passa na R2 (28 contra 20 capturas, custo 1,56x); laço quality fica (R3 inconclusiva) | E30rel; DEC-023 do pós-2.2.0 |
| Medido, sem linha de base nova | parada-retomada: x1/x2/x4 com opus 5/5/7 e ponderado sem haiku 440/420/500; gatilhos mantidos (opus > 5 ou ponderado > 420 sem achado sintético) | E31rel; DEC-026 do pós-2.2.0 |
| Config e transcrições | config descartável deslogada; transcrições de E30, E31 e E33 (`D:/claude-e30-out`, `D:/claude-e31-out` e `D:/claude-e33-out`) ficam até o próximo roadmap fechar a spec do revisor opus e a nova linha de base | DEC-035 do pós-2.2.0; sessão |

## 3. Backlog consolidado e deduplicado

Esforço é estimativa do executor a partir do código lido (P = um arquivo de produto e testes; M = 2 a 4 arquivos ou prompt do workflow com testes de literais em `flow.test.mjs`, 359 KB; G = mudança de formato, CLI nova ou várias skills). "Tam." = consome folga do `roadmap-release.js`.

| ID | Item | Origem | Tipo | Esf. | Risco | Depende de | Rec. |
|---|---|---|---|---|---|---|---|
| B01 | Revisor por tarefa opus como padrão: `reviewModelFor` (`roadmap-release.js:429-432`) devolve `sonnet` salvo rota opus ou tarefa externa; mudar o padrão, com testes em `review.test.mjs`. Tam.: dezenas de caracteres | state; E30rel; DEC-023 do pós-2.2.0 | produto | P | médio: custo por revisão 1,56x em toda execução | B03 | entra |
| B02 | S3-24: em `agents/task-reviewer.md`, verdicts só no modo restrito, spec e quality só no modo review; medida junto com B01 | E32tri S3-24 e adendo; DEC-031 do pós-2.2.0 | produto | P | médio: muda o texto dos modos que E30 mediu | B01 | entra |
| B03 | Folga do `roadmap-release.js`: cerca de 4.950 caracteres. Abrir espaço (comentários históricos, programa embutido para `scripts/`) ou subir o teto por decisão (teto atual veio de DEC-641 do roadmap de evolução; limite de lançamento 524.288 bytes) | state; DEC-025 do pós-2.2.0 (gatilho "não caber no teto"); `size.test.mjs` | workflow | P (teto) / M (extração) | baixo (teto) / médio (extração mexe em literais testados) | - | entra |
| B04 | Regra da R3 para o caso "1 captura marginal em cada braço" (hoje cai no inconclusivo genérico) | E30rel obs. 3; DEC-023 do pós-2.2.0 | medição | P (só texto de desenho) | baixo | - | entra (só a regra; sem lote) |
| B05 | Gate tests aceita total menor com remoção declarada e revisada (nomes que somem citados na spec ou no plano) e o `gates-fix` para na 1ª rodada quando a única falha é o total. Hoje `gatePasses` (`:219-228`) exige `total >= baseline.total`; `branchGates` (`:2763-2800`) roda até `MAXFIX` | state; DEC-017 do pós-2.2.0 (gatilho); sessão (E29: 2175 para 2172, 2 rodadas gastas sem solução) | workflow | M, Tam. | alto: afrouxa a proteção que DEC-017 do pós-2.2.0 preservou | B03 | entra |
| B06 | Carga do plano congelado sem `--spec` ainda lê a spec pelo campo `spec` do plano e falha (`edge-case-uncovered`); contornado à mão no E29. Ponto de chamada `loadPlan(useSpec)` (`:2343`); leitura em `scripts/plan-tool.mjs` | state; sessão | workflow | P | baixo | - | entra |
| B07 | Cargas de spec e plano por haiku sem depender de transcrição: 7 de 20 cargas haiku erradas em E31 (4 exit trocado, 3 emit não JSON); E31 já acrescentou o cruzamento de `checkExit` com `summary.exitCode` em `checkSpecLoad` (`:1156`), mas `checkSpecLoad` ainda cai no `checkExit` transcrito quando o stdout não é JSON, `checkPlanLoad` (`:488-496`) ainda confia no `emitExit` transcrito, e ambos seguem dependendo de transcrição pelo haiku. Ex.: wrapper ou script com JSON único `{ nonce, digest }` (como o modo `procs`) ou carga equivalente sem transcrição | state; E31rel e adendo; sessão (lição) | workflow | M, Tam. | médio | B03 | entra |
| B08 | Reuso da spec compara o head do commit com o head medido depois do autor (`specReused`, `:2241-2245`); se o spec-author commitar (viola R_NOCOMMIT), a revisão de spec alterada pode ser pulada. Decidir pelo blob contra o registro | state; E33rel (menor da revisão final) | workflow | P, Tam. | médio (revisão pulada em silêncio) | B03 | entra |
| B09 | Pré-voo e sentinela de processos no arnês (`tools/measure`), hoje feitos ad hoc no lote de E31 e na sonda de E33; x3 de E31 morreu por `Stop-Process -Name node` de outro projeto | state; DEC-024 do pós-2.2.0; E31rel | arnês | M | baixo | - | entra |
| B10 | Regex do extrator conta `*-fix-review` e `*-fix-probe` como correção (`isFixLabel`, `session-metrics.mjs:240`, usado em `:338`); corrigir com teste em `session-metrics.test.mjs` | state; desenho de E31 (H5) | arnês | P | baixo | - | entra |
| B11 | `procs`: ppid reaproveitado pelo Windows aceito como prova de ancestralidade (`/T` amplia); listar CreationDate e cortar a cadeia quando o pai for mais novo, com teste de mock (`selectProcs`, `verify-run.mjs:278-308`, `inWt` em `:296-300`) | state; E33rel | produto | P | médio: encerra processo alheio | - | entra |
| B12 | `procs`: caminho Linux (ps, lsof, SIGTERM) só rodou com fakes; conferir num host Linux ou WSL real | state; E29-E32 run (T1) | produto | P (execução) | baixo; ambiente: o guarda de worktree recusa `wsl.exe` (memória do projeto) | - | entra (conferência em sessão fora de worktree) |
| B13 | `marketplace update` com a loja fixada numa tag não pula para `main`: repetir com `main` em outro commit. Hoje já está (2 commits de docs à frente da tag); a prova forte é depois de um bump | state; E33rel | docs/medição | P | baixo; até US$ 1 (E33rel) | publicação | entra (na publicação) |
| B14 | Nova linha de base de parada-retomada depois das correções (E31 só a fez antes; DEC-026 do pós-2.2.0 adiou "para o próximo roadmap, depois da correção publicada") | DEC-026 e DEC-035 do pós-2.2.0; estr22 (premissa) | medição | M (3 execuções pagas) | médio: custo, ambiente | B01, B02, B07, B09 | entra |
| B15 | Grupo workflow, achados pequenos em `roadmap-release.js`/`preflight.mjs`: S3-28 (`BASH_ONLY` pede lista vazia com `no-bash`), S3-29 (`readDisc` sem tratar erro determinístico `{ tool, error }`), S3-30 (`run-record approve` sem guarda de tamanho), S3-27 (diagnosticar "not found" acima de 512 KiB no preflight) | E32tri | workflow | M, Tam. | baixo | B03 | entra |
| B16 | Grupo negações espontâneas: S2-13 partes 1 a 3 (prompts com "; echo exit=$?", Grep na pasta de scripts, `sed -i`) | E32tri S2-13 | workflow | M, Tam. | baixo | B03 | talvez |
| B17 | Grupo achados de revisões antigas do workflow: S2-09 (4 achados de registro-8k), S2-12 (auditoria das cópias por modelo, DEC-715 do roadmap de evolução), S3-25 (4 achados do comportamental de E23) | E32tri | workflow | M a G (8+ achados a reconferir) | baixo | B03 | talvez (retriar na spec) |
| B18 | Grupo tracker e planner: S2-08 (mensagem de `recordVerdict` com linha ausente), S2-01 (cópia do checker a partir do cache negada no modo padrão; pede subcomando em `roadmap.mjs` e skills) | E32tri | produto | S2-08 P; S2-01 M | baixo | - | S2-08 entra; S2-01 talvez |
| B19 | Grupo coordinator e plan-writer: S3-22 (texto de `model.md`: W3, W7), S3-26 (normalização em `authoredTask` ou aviso em `operator.md`), S3-20 (escolhas de E7 fora do registro; muda estado e formato), S3-21 (condicional: só se a description do plan-coordinator mudar) | E32tri | produto/docs | S3-22 P; S3-26 P; S3-20 G | baixo | - | S3-22 e S3-26 talvez; S3-20 e S3-21 ficam |
| B20 | Grupo conferências interativas da adoção: S3-16 (recusa e caminho AskUserQuestion não exercidos) e S3-13 (dono: observar na primeira adoção interativa) | E32tri | medição | P | baixo | - | talvez (sessão headless com subagent opus, memória do projeto) |
| B21 | Grupo medições pagas sem hipótese nova: S3-04 (critério de spec contra ruling), S3-05 (variação do coordinator), S3-18 (cadeia `claude -p` spec-writer e plan-writer), S3-23 (sessão lê `plan.md` antes do lançamento) | E32tri | medição | M cada (pagas) | baixo | - | fica |
| B22 | Grupo registros e condicionais: S2-03 (espera 2º caso de testFirstGap), S2-05 (lançar custo de E9 no measurements antigo), S3-19 (lint de `commands/*.md`; nenhum plugin tem `commands/`) | E32tri | docs | P | baixo | gatilho | fica (S2-05 talvez, sem código) |
| B23 | Grupo arnês herdado de E30: S2-10 (`parentMention`), S2-15 (`coordinatorGateVazio` só lê `# tests 0`), S3-02 (regra inerte em `SANDBOX_RELEASE_RULES`), S3-03 (`spec-review-atual.md` não confere), S3-07 (divergência de superpowers vira erro global), S3-09 (`E5_PATHS` em `docs/superpowers`), S3-10 parte de gatilho | E30des (resumo: "passam a roadmap futuro") | arnês | P a M | baixo | B09 | talvez (só as que o lote de B14 usar) |
| B24 | Paralelismo: `release.config.json` com `generated: true` força `maxParallel` 1; gatilho de DEC-020 do pós-2.2.0 é "dois entregáveis de código independentes prontos" | DEC-020 do pós-2.2.0; relatórios de execução | workflow (config) | P | médio: árvore compartilhada com outras sessões (memória do projeto) | - | fica |
| B25 | Limpeza das transcrições de E30, E31 e E33 (`D:/claude-e30-out`, `D:/claude-e31-out` e `D:/claude-e33-out`) quando B01/B02 e B14 fecharem | DEC-035 do pós-2.2.0 | docs | P | baixo | B01, B14 | entra (na publicação) |

Conferência da contagem da triagem: as 22 notas de dono executor e destino roadmap futuro (E32tri, "Pendências com dono") estão em B15 a B22: S2-01, S2-03, S2-05, S2-08, S2-09, S2-12, S2-13 (partes 1 a 3), S3-04, S3-05, S3-16, S3-18, S3-19, S3-20, S3-21, S3-22, S3-23, S3-25, S3-26, S3-27, S3-28, S3-29, S3-30 (7 de SRC-02 + 15 de SRC-03). S3-13 (dono) está em B20; S3-24 em B02.

## 4. Proposta de entregáveis

IDs começam em E34 para não colidir com merges antigos na história (sessão: a colisão obrigou a renumerar E1–E5 para E29–E33).

### E34. Espaço no workflow

- Objetivo: deixar folga para E35 a E37 sem tocar no limite de lançamento.
- Absorve: B03, S3-27 de B15.
- Aceite: `size.test.mjs` verde com folga medida registrada em decisão (teto novo com decisão, ou extração com o total LF menor que antes); preflight diagnostica arquivo acima de 512 KiB com teste; G1 a G5 verdes.
- Medição paga: não.
- Dependências: nenhuma.

### E35. Revisor por tarefa opus com os modos alinhados

- Objetivo: transformar a decisão de E30 em produto.
- Absorve: B01, B02, B04.
- Aceite: (1) teste mostra revisor opus no laço por tarefa padrão e S3-24 no texto de `task-reviewer.md`; (2) regra da R3 para 1×1 escrita no desenho antes de qualquer lote; (3) lote de confirmação só do braço opus com o texto novo, regra fixada antes (ex.: capturas não abaixo de um piso derivado das 28 de E30), registrado em `measurements.md`.
- Medição paga: sim, 10 execuções × US$ 0,561 = US$ 5,61 (teto proposto US$ 7).
- Dependências: E34.

### E36. Gate de testes com remoção declarada

- Objetivo: um entregável que remove testes de propósito não fica bloqueado nem gasta rodadas de correção inúteis.
- Absorve: B05.
- Aceite: teste com total menor e nomes removidos declarados na spec ou no plano passa; total menor sem declaração continua reprovado; o `gates-fix` não roda quando a única falha é o total; `mergeFloor` coerente.
- Medição paga: não.
- Dependências: E34.

### E37. Cargas e commits conferidos contra a fonte

- Objetivo: nenhum campo transcrito por haiku decide revisão, correção ou reuso sem conferência mecânica.
- Absorve: B06, B07, B08, B15 (S3-28, S3-29, S3-30), opcionalmente B16.
- Aceite: testes de mock com exit trocado e emit não JSON não geram achado sintético nem correção opus; carga do plano congelado sem spec passa; spec commitada pelo autor não pula a revisão (decisão por blob); sonda plan-only paga passa com cargas de primeira.
- Medição paga: sim, 1 sonda × US$ 1,87 (teto US$ 3, como DEC-033 do pós-2.2.0).
- Dependências: E34.

### E38. Arnês e limpeza de processos confiáveis

- Objetivo: lote pago não morre nem conta errado por causa do ambiente.
- Absorve: B09, B10, B11, B12, partes de B23 usadas por B14.
- Aceite: pré-voo e sentinela no arnês com teste (detecta processo que encerra `node.exe` e invalida a execução com motivo); regex do extrator com teste; `procs` corta cadeia de ppid reaproveitado (mock); caminho Linux conferido num host real, saída registrada.
- Medição paga: não.
- Dependências: nenhuma.

### E39. Nova linha de base de parada-retomada

- Objetivo: medir o produto corrigido e refazer os limites de DEC-026 do pós-2.2.0.
- Absorve: B14.
- Aceite: 3 execuções válidas com transcrição e `SHA256SUMS`, contadores por execução, decisão do dono sobre os limites (opus, sonnet, ponderado) registrada; correção extra, se houver, identificada por estágio e agente.
- Medição paga: sim, 3 × ~US$ 4,0 = US$ 12 (faixa 10,62 a 14,28 pelos extremos de E31; teto US$ 15).
- Dependências: E35, E37, E38.

### E40. Publicação

- Objetivo: versão nova no cache, como E33 (DEC-032 e DEC-034 do pós-2.2.0).
- Absorve: B13, B25, ratificação de decisões.
- Aceite: bump em `plugin.json` e README, nota em `docs/releases`, revisão final opus/high da release contra `main`, branch de volta, versão no cache conferida pelo dono, conferência da loja fixada na tag com `main` em outro commit, transcrições de E30, E31 e E33 (`D:/claude-e30-out`, `D:/claude-e31-out` e `D:/claude-e33-out`) apagadas.
- Medição paga: até US$ 1 (B13).
- Dependências: E34 a E39.

## 5. Ordem e caminho crítico

Ordem proposta: E34 → (E35, E36, E37 em série, um entregável de código por vez com `maxParallel` 1) → E39 → E40; E38 corre em paralelo a E35–E37 por não tocar o `roadmap-release.js` (só `tools/measure` e `verify-run.mjs`), desde que nenhum lote pago rode junto (estr22, riscos transversais).

Caminho crítico: E34 → E35 → E37 → E39 → E40. E36 sai do caminho crítico se rodar enquanto E38 espera; E39 precisa de E38 pronto (sentinela).

## 6. Orçamento pago proposto e regras de medição

| Item | Conta | Esperado (US$) | Teto (US$) |
|---|---|---|---|
| E35 confirmação opus | 10 × 0,561 (E30rel) | 5,61 | 7 |
| E37 sonda plan-only | 1 × 1,87 (med) | 1,87 | 3 |
| E39 parada-retomada | 3 × ~4,0 (E31rel; 3,54 a 4,76) | 12,00 | 15 |
| E40 loja fixada | E33rel ("até US$ 1") | ≤ 1 | 1 |
| Reserva comum, só via Fable | - | 0 | 4 |
| **Total** | 5,61 + 1,87 + 12 + 1 | **~20,5** | **30** |

Comparação: o pós-2.2.0 teve teto 40 e gastou 24,33 (med). Proposta: teto US$ 30.

Regras (todas com precedente):
- Config descartável por `CLAUDE_CONFIG_DIR`, plugin por `--plugin-dir`, superpowers fixo, atualização automática desligada, sem lojas, hooks nem plugins do usuário (DEC-022 do pós-2.2.0; sessão).
- Regra de decisão, paradas e orçamento fixados no desenho antes do lote (DEC-023 do pós-2.2.0; sessão, lição).
- Pré-voo e sentinela de processos obrigatórios (DEC-024 do pós-2.2.0); com E38, viram parte do arnês, não mais ad hoc.
- Um lote pago por vez, sem G1 nem release rodando junto (estr22).
- Execução acima de US$ 6 volta ao dono (gatilho de DEC-021 do pós-2.2.0).
- Cada lote vira linha em `measurements.md` (DEC-036 do pós-2.2.0); transcrições preservadas até a decisão que as consome (DEC-035 do pós-2.2.0).
- Premissa de custo conferida contra medição, não estimada por sessão parcial (sessão: o 2,26 era só a retomada).

## 7. Decisões do dono antes de começar

Aprovadas pelo dono em 2026-11-21 (viram `DEC-001` a `DEC-012` do roadmap pós-2.3.0):

1. **Objetivo e versão.** **Aprovado:** o objetivo da seção 1 e versão `2.4.0` (o revisor opus muda o comportamento padrão e o custo de toda execução). Alternativa descartada: `2.3.x` só com correções, deixando o revisor opus para depois.
2. **Teto pago.** **Aprovado:** US$ 30 (~US$ 20,5 esperados + reserva comum de US$ 4 liberada só via Fable; parada unitária acima de US$ 6). Alternativa descartada: US$ 20 sem lote de confirmação do opus; US$ 40 como no pós-2.2.0.
3. **Espaço no workflow (B03).** **Aprovado:** subir `MAX_WORKFLOW_CHARS` para `300000` com decisão registrada, mantendo o teste (limite real de lançamento 524.288 bytes; extração mexe em literais cobertos por `flow.test.mjs`), somado ao diagnóstico de 512 KiB no preflight (`S3-27`). Alternativa descartada: extrair comentários históricos (31.236 caracteres) e o programa embutido para `scripts/` sem mudar o teto; não fazer nada e cortar escopo para caber em cerca de 4.950.
4. **Lote de confirmação do revisor opus (E35).** **Aprovado:** sim, só braço `opus`, 10 execuções (`lentes-semeadas-A/B`, teto US$ 7), porque DEC-031 do pós-2.2.0 manda medir a S3-24 junto, com piso de não-regressão fixado antes do lote. Alternativa descartada: adotar opus sem lote e deixar a S3-24 fora; rodar braços sonnet e opus de novo (~US$ 9,2).
5. **Laço quality e R3.** **Aprovado:** manter o laço `quality` e escrever a regra para `1×1` no desenho de E35, sem lote próprio. Alternativa descartada: novo lote pago para decidir o laço (custo do laço opus US$ 0,143 por tentativa, E30rel).
6. **Gate de testes (B05).** **Aprovado:** aceitar remoção declarada na spec ou no plano e conferida por nome, parar o `gates-fix` na 1ª medição quando a única falha é o total e ajustar `mergeFloor`. Alternativa descartada: só parar o `gates-fix` cedo e manter a recusa (cada remoção vira ato do dono, como E29).
7. **Modo do planner.** **Aprovado:** modo leve (`light`), como DEC-001 do pós-2.2.0 (7 entregáveis, fontes já triadas). Alternativa descartada: modo completo, com revisor independente.
8. **IDs e branch.** **Aprovado:** `E34` a `E40`; branch `release/pos-2.3.0` criada da ponta de `main` (`0e363b0`, que já inclui os docs de 2026-11-20, correções de documentação, regras escopadas e `AGENTS.md`). Alternativa descartada: outro prefixo de ID por roadmap ou base anterior.
9. **Paralelismo (B24).** **Aprovado:** manter `generated: true` e `maxParallel` 1 (árvore compartilhada com outras sessões e E34–E37 no mesmo arquivo). Alternativa descartada: rever `locks` e `needsLock` para rodar E36 e E38 juntos.
10. **Notas de baixo valor (B19 a B22) e itens "talvez" (B16, B17, B18, B23).** **Aprovado:** registrar B17 e B19 a B22 (e S2-01 de B18) como `"fica"` (fora de escopo) com motivo e tirá-las do backlog ativo; incluir S2-08 (B18) e B16 (`S2-13` partes 1 a 3) em E37; incluir em E38 apenas os itens de B23 necessários ao lote de E39 (`S3-07`). Alternativa descartada: manter todas pendentes para o roadmap seguinte.
11. **Conferência Linux real (B12).** **Aprovado:** conferir em sessão fora de worktree (WSL/Linux real, delegada a sessão headless com subagent opus). Alternativa descartada: aceitar só os fakes com risco registrado.
12. **Delegação a Fable.** **Aprovado:** manter DEC-006 do pós-2.2.0 (decisões do dono durante a execução via Fable; push, tag e publicação com autorização explícita do dono). Alternativa descartada: dono decide cada parada intermediária.

## 8. Fora de escopo recomendado

- Meta de chamadas do completo (≤ 22, medido 27), aceita como não atingida (DEC-777 do roadmap de evolução; não objetivo de estr22).
- Agent teams na orquestração (REQ-022 do roadmap de evolução) e checker com modo diff (REQ-023 do roadmap de evolução).
- Otimizar a releitura de estado na retomada (S3-08), aceita sem otimização (DEC-027 do pós-2.2.0).
- Mudar formatos de plano ou de estado (não objetivo de estr22), o que deixa S3-20 fora.
- Medições pagas sem hipótese nova (B21) e condicionais sem gatilho disparado (S2-03, S3-19, S3-21).
- Hook que aprove sozinho o lançamento de um workflow (não objetivo de estrEvo, DEC-035 do roadmap de evolução).
- Paralelismo do release (B24), salvo decisão 9 em contrário.

## 9. Riscos

- **Teto do workflow:** E35, E36, E37 e B15 somam mudanças no `roadmap-release.js` com cerca de 4.950 de folga. Mitigação: E34 primeiro; cada spec declara o tamanho previsto.
- **Proteção do gate afrouxada (B05):** remoção declarada pode mascarar perda de cobertura, como Fable viu no E29 (sessão). Mitigação: conferência por nome contra spec/plano, revisão opus, e teste de que total menor sem declaração segue reprovado.
- **Revisor opus encarece toda execução:** 1,56x por revisão (E30rel); se o cenário de parada-retomada tem revisão por tarefa (a conferir no desenho de E39), a contagem opus sobe por construção e o gatilho "opus > 5" de DEC-026 do pós-2.2.0 dispara sem defeito. Mitigação: E39 depois de E35 e limites novos por decisão.
- **Ambiente compartilhado:** outras sessões podem matar `node.exe` ou mexer na árvore (E31rel; memória do projeto). Mitigação: E38 antes de E39; worktree próprio.
- **Erro de transcrição de haiku é aleatório:** uma sonda (n=1) não o provoca (DEC-033 do pós-2.2.0). Mitigação: a correção de E37 é provada por testes de mock com saídas erradas; a sonda só confirma o caminho feliz.
- **Correção que introduz defeito:** a 2ª rodada de correção do `procs` criou órfãos (sessão). Mitigação: toda rodada de correção com nova revisão; revisão final da branch inteira em E40.
- **Custo acima do previsto:** parada-retomada variou de 3,54 a 4,76 (E31rel). Mitigação: teto por lote e parada acima de US$ 6.
- **Linux real indisponível no worktree:** o guarda recusa `wsl.exe` (memória do projeto). Mitigação: decisão 11.

## 10. Como iniciar

Recomendação: modo leve (decisão 7). Pedido ao roadmap-planner, numa sessão em `D:/projects/claude-play` na ponta de `main` (a partir de `896f9ed`, incluindo os dois docs SRC de 2026-11-20):

```
/productivity-tools:roadmap-planner Planeje em modo leve o roadmap pós-2.3.0 do productivity-tools a partir de docs/plans/2026-11-20-proximo-roadmap-plano.md (este plano, depois de aprovado pelo dono, com as decisões da seção 7 respondidas). Entregáveis começam em E34. Branch de release: release/pos-2.3.0, criada da ponta de main (a partir de 896f9ed, incluindo ambos os docs de 2026-11-20); main avança só na publicação, ato do dono. Teto pago: US$ <valor da decisão 2>, em config descartável. Decisões do dono via Fable (DEC-006 do pós-2.2.0 continua).
```

Fontes a passar (SRC):
- este plano (`docs/plans/2026-11-20-proximo-roadmap-plano.md`), com as respostas da seção 7, e a retrospectiva `docs/reports/2026-11-20-retrospectiva-evolucao-skills.md` (lições);
- `docs/plans/roadmap-pos-2-2-0/state.md` (pendências), `decisions.md` (DEC-017, DEC-020 a DEC-036 do pós-2.2.0) e `measurements.md`;
- `docs/reports/2026-11-15-E32-triagem-backlog.md` (com o adendo);
- `docs/reports/2026-11-17-E30-revisor-opus.md`, `docs/reports/2026-11-17-E31-parada-retomada.md`, `docs/reports/2026-11-17-E33-roteiro-publicacao.md`;
- `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md` (notas do arnês que passaram a roadmap futuro) e `docs/plans/2026-11-17-measure-e31-parada-retomada-design.md` (H5);
- `docs/plans/2026-11-15-roadmap-pos-2-2-0.md` (não objetivos, premissas, gates G1 a G5).

Branch de release sugerida: `release/pos-2.3.0`, criada da ponta de `main` (a partir de `896f9ed`, para incluir `2026-11-20-proximo-roadmap-plano.md` e `2026-11-20-retrospectiva-evolucao-skills.md`). Antes do primeiro entregável, medir de novo G1 na ponta de `main` (base da branch, >= `896f9ed`) como linha de base (o 2204 é da ponta da release em E33rel) e o tamanho LF do workflow.
