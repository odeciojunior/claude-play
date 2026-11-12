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
<!-- /roadmap:measurements -->
