# E22: execuções comportamentais das rubricas e do fluxo enxuto do tracker

Data: 2026-11-11. Branch `feat/E22`, commit de partida `099d596` (sincronizado com `release/roadmap-skills-v2` depois da correção de E4 e da ratificação de DEC-211 a DEC-235). Tarefa 8 do plano `docs/superpowers/plans/2026-11-11-E22-tracker-enxuto-rubricas.md`, executada pelo orquestrador da sessão principal (DEC-204). Critérios 2 e 3 do card E22 e REQ-037.

Entradas e saídas: `docs/reports/2026-11-11-e22-rubricas/` (fixture sintética; ver o README de lá). Cada execução seguiu `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md` ao pé da letra sob `no questions`, sem acesso a esta conversa.

| Execução | Modelo e esforço | Pasta | Saída literal |
|---|---|---|---|
| Critério 2 (eventos A e B) | sonnet, medium | `pasta-c2/` | `run-criterio-2.md` |
| Critério 2, repetição de B | sonnet, medium (subagent novo) | `pasta-c2b/` | `run-criterio-2-repeticao-B.md` |
| Critério 3 | sonnet, medium | `pasta-c3/` | `run-criterio-3.md` |
| Fluxo enxuto (REQ-037) | sonnet, medium | `pasta-fluxo/` | `run-fluxo.md` |
| Revisão adversarial | opus, medium, só leitura | todas | `run-revisao.md` |

Desvio do plano: o plano previa uma única `pasta/`. Cada execução usou uma cópia própria (`pasta-c2`, `pasta-c2b`, `pasta-c3`, `pasta-fluxo`) para rodar em paralelo sem interferência; `pasta/` ficou como entrada intacta.

## Critério 2: rubrica de contradição

- Entrada A: "E3 (Reports) não depende mais de E2: os relatórios saem logo depois de E1". Esperado: Contradicts citando a seção. Obtido: DEC-199 com Contradicts `E3 (depends)`, pendente de aprovação da estratégia v1.1, painel ajustado, card intacto.
- Entrada B (primeira): "a página de relatório lista os itens em ordem de criação, com paginação de 50 itens por página". Esperado: `-`. Obtido: `E3 (acceptance)`. A revisão adversarial confirma que a entrada foi mal escolhida: "paginado em 50" pode ser lido como afrouxar "every item is listed", e a rubrica manda `contradiz` vencer quando duas classes cabem. Não é defeito da rubrica.
- Entrada B (repetição, subagent novo, pasta nova): "a página de relatório é montada com a biblioteca de tabelas `simple-table`". Esperado: `-`. Obtido: DEC-002 com Contradicts `-`, sem outras mudanças.
- Resultado: passa (A e B repetida). Ressalva da revisão: A e B repetida estão próximas dos exemplos da rubrica, então discriminam pouco.

aceite: aguardando o dono

## Critério 3: rubrica de conferência de critérios

- Entrada: fechamento de E3 contra `spec-enfraquecido.md` (critério 2 com `verify: test` trocado por `human`).
- Esperado: um pendente apontando o critério enfraquecido (classe `enfraquecido`) e nenhum para o igual.
- Obtido: critério 1 `igual`, critério 2 `enfraquecido` (sinal 3, test virou human); um pendente `(owner) ... confirm (enfraquecido)`; log "1 igual, 1 enfraquecido"; card intacto; checker 0 erros, 0 avisos. O primeiro `add-pending` foi recusado por passar de 300 caracteres (exit 1, nada mudou) e o agente o repetiu com o texto resumido, pela CLI.
- Resultado: passa.

aceite: aguardando o dono

## Fluxo enxuto (REQ-037)

Sequência § 20 (spec escrito), § 5 (bloqueio aberto e fechado), § 18 (duas decisões do executor), `ratify --amend`, `reject` de § 1. Todos os comandos pela CLI, exit 0 nos definitivos; nenhuma edição à mão. Checker final na pasta: `check-roadmap: 0 error(s), 0 warning(s)`, exit 0. Ambiguidades: texto de `--next` escolhido pelo agente; passos 2 e 3 de § 5 sem efeito porque o bloqueio abriu e fechou em seguida; o agente citou primeiro um DEC tirado do `brief` anterior ao `refresh-checker` e a CLI recusou com `unknown-id`, sem mudar nada.

## Achados da revisão adversarial

1. Média (alta se chegar a `main`): `roadmap.mjs` `nextId` varre todos os arquivos da pasta, inclusive o `check-roadmap.mjs` vendorizado, que cita DEC-198 num comentário; depois do `refresh-checker` o próximo DEC pula para DEC-199. Sem ID duplicado. Fora do escopo de E22 (não-objetivo do spec); registrado como pendente da release.
2. Baixa: `events/01-decision.md` não diz o que gravar em "Revisit when" quando ninguém deu condição (uma execução inventou condições, outra usou `-`).
3. Baixa: `events/19-criteria-check.md` e `rubric-criteria.md` não preveem o limite de 300 caracteres do pendente.
4. Baixa: a repetição de B usou `nextIds` do `brief` em vez de `next-id`.

Nenhum esperado falhou por defeito de rubrica, então nenhuma rubrica foi corrigida nem execução repetida por esse motivo. Os achados 2 a 4 ficam como melhorias opcionais.
