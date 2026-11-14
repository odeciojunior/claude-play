# Medições

Execuções pagas e marcos de medição. Registrado e Faturado são colunas separadas. A linha de base parcial tirada das sessões reais está em SRC-02 §9A e entra aqui quando E1 a consolidar.

<!-- roadmap:measurements -->
| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |
|---|---|---|---|---|---|---|
| 2026-11-10 | E1 | experimento | Plano semeado: duas execuções plan-only do release 1.6.0 em sandbox, em sessão sem interface | US$ 3,39 (custo devolvido pela CLI) | - | concluído |
| 2026-11-10 | E14 | experimento | Permissão do Workflow: dez sessões sem interface no modo padrão, com o plugin de sonda | US$ 1,19 (custo devolvido pela CLI, aproximado) | - | concluído |
| 2026-11-10 | E14 | experimento | Consentimento do Workflow pelo protocolo de controle e por pseudo-terminal, no modo padrão | US$ 0,62 (protocolo de controle; o pseudo-terminal não devolve custo) | - | concluído |
| 2026-11-10 | E14 | sonda | Agente do plugin em workflow e compartilhamento de código: 18 sessões sem interface | US$ 2,44 (custo devolvido pela CLI) | - | concluído |
| 2026-11-10 | E14 | sonda | Fidelidade do plano estruturado: nove células de dez tentativas, haiku e sonnet | US$ 5,7 (US$ 5,29 conferidos, o resto estimado) | - | concluído |
| 2026-11-10 | E14 | sonda | Script do plugin e lançamento por caminho a partir do cache: sessões sem interface em haiku | US$ 0,23 (custo devolvido pela CLI, aproximado) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | planner: 1 execução válida (2 negadas antes), bypassPermissions; bytes principal 1.244, 11 turnos; plugin 1.6.0 (3fbb59b), superpowers 7.0.0 | não comparado (DEC-016) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | tracker: 1/1 válida, bypassPermissions; bytes principal 772, 7 turnos | não comparado (DEC-016) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plan-only: 5/5 válidas; mediana US$ 1,37 (1,29 a 1,64); 1 haiku, 4 sonnet, 4 opus; ponderado 241; 63.062 bytes | US$ 7,03 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | coordinator: 3/3 válidas; mediana US$ 0,33 (0,22 a 0,35); 0 haiku, 2 sonnet, 1 opus; ponderado 80; 9.049 bytes | US$ 0,91 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | completo: 3/3 válidas; mediana US$ 3,71 (3,56 a 3,76); 7 haiku, 11 sonnet, 5 opus; ponderado 427; 113.364 bytes | US$ 11,03 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | parada-retomada: 3/3 válidas; mediana US$ 4,78 (4,69 a 4,90); 9 haiku, 15 sonnet, 9 opus; ponderado 669; 178.543 bytes | US$ 14,37 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plano-semeado-A: 5/5 válidas, arnês de etapa plan-review (DEC-279) | US$ 1,89 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | plano-semeado-B: 5/5 válidas, arnês de etapa plan-review (DEC-279) | US$ 1,68 (custo devolvido pela CLI) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | codigo-semeado-A: 5/5 válidas, pipeline completo (2 inválidas fora do valor) | US$ 21,39 (custo devolvido pela CLI, só válidas) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | codigo-semeado-B: 5/5 válidas, pipeline completo (3 inválidas fora do valor) | US$ 21,53 (custo devolvido pela CLI, só válidas) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | detecção, classe plano: 40 válidas; 40 capturados, 0 perdidos, 0 indeterminados; 0 inválidas; semeadura de execução aprovada (DEC-278) | - (já nas linhas plano-semeado) | - | concluído |
| 2026-11-12 | E15 | linha-de-base | detecção, classe código: 40 válidas; 38 capturados, 0 perdidos, 2 indeterminados (C5, C7); 5 inválidas (33,3%, parou-antes-do-codigo) | - (já nas linhas codigo-semeado) | - | concluído |
| 2026-11-12 | E20 | sonda | Suíte de gatilho: 50 execuções (haiku e opus), fora do teto de E17 (DEC-478) | US$ 6,04 (haiku 0,16; opus 5,87) | - | concluído |
| 2026-11-12 | E20 | sonda | 2ª passada opus da suíte de gatilho: 26 execuções (sonda 0,62); saldo de DEC-478 restante US$ 6,92 | US$ 7,04 | - | concluído |
| 2026-11-13 | E21 | release | Execução do release (DEC-567): r1 13,65; r2 6,80; r3 4,50; r4 4,35; r5 7,73; comportamental 1,34; 8,85 em duas falhas de carga do plano; maior execução sã 13,65 | US$ 38,37 (custo devolvido pela CLI) | - | concluído |
| 2026-11-13 | E23 | release | Execução do release (DEC-567): r1 7,47; r2 sem valor (sessão morta às 04:29 sem evento result, interrupção do host); r3 11,48; B4 0,38 | US$ 19,33 (soma conhecida, sem r2) | - | concluído |
| 2026-11-13 | E24 | release | Execução do release (DEC-567): r1 11,39; r2 2,92 (falha de carga do plano); r3 7,95; comportamental 0,30 | US$ 22,56 (custo devolvido pela CLI) | - | concluído |
| 2026-11-13 | E10 | release | Execução do release (DEC-567): r1 9,85 (defeito de spec); r2 19,82; comportamental 0,38; maior execução sã passa a 19,82 (E10 r2); teto de US$ 150 mantido | US$ 30,05 (custo devolvido pela CLI) | - | concluído |
| 2026-11-13 | E12 | release | Execução do release (DEC-567): r1 26,65; comportamental 0,39; maior execução sã passa a 26,65 (E12 r1); teto de US$ 150 mantido | US$ 27,04 (custo devolvido pela CLI) | - | concluído |
| 2026-11-13 | E27 | medição | Passada A, peça 1 (DEC-698): task-review, braço atual, codigo-semeado-A e B, 5 válidas por artefato e modelo; sonnet 40/40, opus 40/40, 0 inválidas; agentes 3,34 + sessão principal 5,26 (estimada) | US$ 8,60 | sem diferença mensurável (DEC-699) | concluído |
| 2026-11-14 | E27 | medição | Conferência do task-reviewer (DEC-708), e513958: task-review, braço atual, sonnet, codigo-semeado-A e B, 5 válidas cada; capturas 39/40, 0 falso bloqueante | US$ 1,23 | critério atendido (0 falso, ≥ 38/40) | concluído |
| 2026-11-14 | E8 | medição | Trio do sandbox (DEC-709), passo 1: plan-only em 4594315 por --plugin-dir, 1 válida; critérios atendidos, run FAILED por defeito da releitura do registro; sonda acceptEdits não rodou | US$ 1,48 | defeito do produto | parado |
| 2026-11-14 | E8 | medição | 2º plan-only (DEC-713) em b734c12 por --plugin-dir, 1 válida; critérios atendidos, releitura assinada ok, run FAILED pela cópia "PLACEHOLDER" do grupo de escrita | US$ 1,88 | defeito do produto (cópia do grupo) | parado |
| 2026-11-14 | E8 | medição | 3º plan-only (DEC-717) em af782a4 por --plugin-dir, 1 válida; E1 em plan sem FAILED, 5 critérios atendidos, cópias do grupo e da releitura na 1ª tentativa | US$ 1,44 | aprovado | concluído |
| 2026-11-14 | E8 | medição | Sonda acceptEdits (DEC-717) em af782a4 por --plugin-dir, completo, regras exatas do preflight, --stop-on-denial: 0 válidas, 1 negada; E5 FAILED no spec, nada commitado; negações em wtRoot, na pasta do plugin e em comandos compostos da skill | até US$ 1,00 (estimado pelas transcrições) | defeito do produto (pasta adicional; comandos compostos) | parado |
<!-- /roadmap:measurements -->
