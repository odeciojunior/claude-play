# Requisitos

<!-- roadmap:requirements -->
| ID | Requisito | Tipo | Fontes | Entregáveis | Cobertura |
|---|---|---|---|---|---|
| REQ-001 | Portões kind exit com captura literal entram na medida de base (#2) | functional | SRC-03, SRC-02 | E42 | coberto |
| REQ-002 | preflight:baseline-invalid informa o motivo por portão, com cmdDigest esperado e recebido (#6) | functional | SRC-03, SRC-02 | E42 | coberto |
| REQ-003 | Uma linha de captura copiada errada é recuperada por releitura, sem medir os portões de novo (#3) | functional | SRC-03, DEC-009 | E43 | coberto |
| REQ-004 | O extrator reconhece o resumo do vitest e ignora códigos ANSI (#3) | functional | SRC-03, SRC-02 | E44 | coberto |
| REQ-005 | Uma descoberta em fatias com o branch mudando informa a mudança de X para Y (#4) | functional | SRC-03, DEC-010 | E45 | coberto |
| REQ-006 | O preflight avisa quando o release.config.json do alvo difere da árvore de trabalho (#5) | functional | SRC-03, SRC-02 | E45 | coberto |
| REQ-007 | O preflight e os docs dizem qual cópia do workflow o nome carrega e medem essa cópia (#7) | functional | SRC-03, SRC-02 | E45 | coberto |
| REQ-008 | Uma dependência não atendida informa o motivo, e o checker avisa Status de várias peças sem code (#1) | functional | SRC-03, SRC-02 | E46 | coberto |
| REQ-009 | Os autores de spec e plano sabem que gate é o name do portão de testes e quando é obrigatório (#19) | functional | SRC-03, SRC-02 | E46 | coberto |
| REQ-010 | A retomada finish-merge desconta testes removidos declarados e verificados, sem afrouxar removedAsserts (#17) | functional | SRC-03, DEC-011 | E47 | coberto |
| REQ-011 | Comandos copiados por agente não aspeiam valores seguros (#18) | functional | SRC-03, DEC-015 | E46 | coberto |
| REQ-012 | O operador libera paralelismo num config gerado por argumento de execução (#28) | functional | SRC-03, DEC-012 | E48 | coberto |
| REQ-013 | Com alvo explícito, uma base inválida falha antes da descoberta (#8) | functional | SRC-03, DEC-018 | E49 | coberto |
| REQ-014 | Os testes resolvem o Git Bash no Windows sem depender do PATH (#10) | non-functional | SRC-03, SRC-02 | E50 | coberto |
| REQ-015 | O lint falha em plugin com commands/ ou caminhos customizados até a checagem completa existir (#29) | functional | SRC-03, DEC-013 | E50 | coberto |
| REQ-016 | O run-batch exige --model e registra o modelo efetivo de cada fase (#21) | measurement | SRC-03, SRC-02 | E51 | coberto |
| REQ-017 | O run-batch preserva as transcrições e gera SHA256SUMS (#22) | measurement | SRC-03, SRC-02 | E51 | coberto |
| REQ-018 | O aggregate.json traz o custo por tentativa usado nos tetos (#23) | measurement | SRC-03, SRC-02 | E51 | coberto |
| REQ-019 | O arnês reconhece gate vazio em mais formatos, perde a regra inerte e ganha parentMention (#26) | measurement | SRC-03, DEC-016 | E51 | coberto |
| REQ-020 | O wsl-health-check roda a partir do pwsh no Windows (#9) | functional | SRC-03, DEC-008 | E52 | coberto |
| REQ-021 | O README documenta a distribuição global no agy (#11) | functional | SRC-03, DEC-008 | E52 | coberto |
| REQ-022 | Os agentes rodados pelo agy recebem o mapeamento de ferramentas (#14) | functional | SRC-03, DEC-008 | E52 | coberto |
| REQ-023 | O caminho agy extrai os testes de forma determinística antes do flash (#12) | functional | SRC-03, DEC-008 | E52 | coberto |
| REQ-024 | Uma linha de base nova de parada-retomada é medida no commit candidato e os limites são decididos (#25) | measurement | SRC-03, SRC-06, DEC-017 | E53 | coberto |
| REQ-025 | O roadmap-release.js cabe na trava de 284.500 caracteres LF com tetos por tarefa | constraint | SRC-05, DEC-007 | E42 | coberto |
| REQ-026 | productivity-tools 2.7.0 e marketplace-tools no próximo minor são publicados com bump nos dois lugares | constraint | SRC-04, SRC-01, DEC-003 | E54 | coberto |
| REQ-027 | Assinatura HMAC da captura (#24) | non-functional | SRC-03 | - | fora-de-escopo: inviável com o script-runner (DEC-014) |
| REQ-028 | Paridade agy de CAPTURE, review-package e entrega 36/entrega 37 (#13, #15) | functional | SRC-03 | - | fora-de-escopo: roadmap próprio de paridade agy (DEC-008) |
| REQ-029 | Empacotamento nativo agy (#16) | functional | SRC-03 | - | fora-de-escopo: roadmap próprio de paridade agy (DEC-008) |
| REQ-030 | Reduzir repetições de cópia do haiku por tamanho de fatia ou escada (#20) | non-functional | SRC-03 | - | fora-de-escopo: adiado com gatilho medido no lote (DEC-019) |
| REQ-031 | plan-frozen-tasks falso por formato de emit (#27) | functional | SRC-03, SRC-02 | - | fora-de-escopo: não reproduz; issue fechada em 2026-11-25 (DEC-019) |
<!-- /roadmap:requirements -->
