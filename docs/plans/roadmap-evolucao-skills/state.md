# Estado

Estratégia v1.0 -- 2026-11-10

Retrato. Sobrescrito a cada atualização; o histórico vai para `log.md`.

## Agora

<!-- roadmap:now -->
1. Rodar as sondas de E14, cada um a sua parte. Executa: executor e dono. Aprova: dono. Depende de: DEC-029.
2. Escrever o spec de E1, com a forma da medição já definida pelo experimento do plano semeado. Executa: executor. Aprova: dono. Depende de: DEC-051.
<!-- /roadmap:now -->

## Painel

<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E1 | nao-iniciado | - | Escrever o spec |
| E2 | nao-iniciado | - | Aguardar E14 |
| E3 | nao-iniciado | - | Aguardar E2 e E14 |
| E4 | nao-iniciado | - | Aguardar E2 |
| E5 | nao-iniciado | - | Aguardar E14 |
| E6 | nao-iniciado | - | Aguardar E2 e E5 |
| E7 | nao-iniciado | - | Aguardar E3, E6 e E17 |
| E8 | nao-iniciado | - | Aguardar E17, E18, E19, E20 e E25 |
| E9 | nao-iniciado | - | Aguardar E8 |
| E10 | nao-iniciado | - | Aguardar E2, E18 e E24 |
| E11 | nao-iniciado | - | Aguardar E7, E8 e E15 |
| E12 | nao-iniciado | - | Aguardar E7, E9 e E21 |
| E13 | nao-iniciado | - | Aguardar os entregáveis de que depende (ver a estratégia) |
| E14 | nao-iniciado | - | Rodar as sondas |
| E15 | nao-iniciado | - | Aguardar E1 e E14 |
| E16 | nao-iniciado | - | Aguardar E11, E15 e E21 |
| E17 | nao-iniciado | - | Aguardar E15 e E18 |
| E18 | nao-iniciado | - | Aguardar E3 e E14 |
| E19 | nao-iniciado | - | Aguardar E5, E14 e E17 |
| E20 | nao-iniciado | - | Aguardar E6 e E19 |
| E21 | nao-iniciado | - | Aguardar E9 |
| E22 | nao-iniciado | - | Aguardar E3 |
| E23 | nao-iniciado | - | Aguardar E8 e E21 |
| E24 | nao-iniciado | - | Aguardar E21 e E23 |
| E25 | nao-iniciado | - | Aguardar E14 e E18 |
| E26 | nao-iniciado | - | Aguardar E8 e E15 |
| E27 | nao-iniciado | - | Aguardar E15 e E21 |
<!-- /roadmap:panel -->

## Bloqueios

<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->

## Pendentes

<!-- roadmap:pending -->
- (dono) Ratificar DEC-053 a DEC-056, do executor, de alcance local, no próximo ponto de medição.
- (dono) Operar os pontos de medição E15, E17, E11 e E16, as medições de política E26 e E27 e a medição final de E13, e publicar em E17, E11, E16 e E13 (DEC-014, DEC-017).
- (dono) Aprovar a tabela de metas derivadas depois da linha de base de E15 (DEC-034).
- (dono) Os scripts em `docs/reports/2026-11-10-session-metrics/` foram limpos de dados pessoais e ficam como evidência; ainda têm os erros de preço e de agrupamento que E1 corrige.
- (executor) Incerto, rever na sonda de E14 e no spec de E25: nome, regra e concessão por `allowed-tools` só foram vistos com o plugin carregado do caminho local; repetir com o plugin instalado do cache, e ver se a pasta do cache conta como legível no lançamento por caminho (SRC-14).
- (executor) Incerto, rever na sonda de E14: as sessões dos experimentos rodaram como filhas de outra sessão, com transcrição desligada, e uma delas gravou `skipWorkflowUsageWarning` nas configurações do usuário; conferir se isso influi na permissão e qual ação grava a chave (SRC-14).
- (executor) Incerto, rever no spec de E1: a causa de a revisão do plano semeado acusar árvore suja logo após um commit limpo, que impede atribuir o conserto só ao revisor (SRC-14).
- (executor) Incerto, rever no spec de E1: o lançador sem interface só foi visto em plan-only e sem prompts de permissão; falta o modo normal, em que o preflight para por regras ausentes, e o modo padrão com as regras por parâmetro (DEC-043).
- (executor) Incerto, medir em E15: a taxa de reescrita de um plano semeado e a taxa de detecção, que uma execução não mede; outros tipos de defeito e vários defeitos no mesmo plano (DEC-051).
- (executor) Incerto, rever na preparação de E17 e na nota de E11: a receita de fixar a loja numa tag foi vista com fonte git local; repetir com a loja do GitHub na primeira tag publicada, e ver como uma sessão aberta reage enquanto a loja fica ignorada (DEC-056).
<!-- /roadmap:pending -->

## Em andamento

<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
