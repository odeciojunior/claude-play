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

Nenhum esperado falhou por defeito de rubrica, então nenhuma rubrica foi corrigida nem execução repetida por esse motivo.

A saída de `run-fluxo.md` diz que o `next-id` final devolveu DEC-201; o valor real era DEC-203 (o salto do achado 1).

## Decisões do dono sobre este relatório (2026-11-11)

O dono aprovou as recomendações de uma análise Fable deste relatório:

- Achado 1: corrigido na CLI, em `fix/next-id-checker`, integrado na release (DEC-253, emenda do dono a DEC-145) e sincronizado na `feat/E22` (`d07b036`). Na `pasta/` com o checker vendorizado, `next-id` agora devolve DEC-002.
- Achados 2 e 3: textos corrigidos antes do merge (`e7211af`): `01-decision.md` grava `-` em "Revisit when" quando ninguém deu condição; `rubric-criteria.md` manda manter o pendente no limite da célula e citar só a parte que difere.
- Achado 4: sem mudança de texto.
- Desvio de uma pasta por execução: aceito.
- Critério 2: aceite condicionado a uma execução extra com casos fora dos exemplos da rubrica e esperados fixados antes.

## Execução extra

Esperados fixados no README da pasta no commit `6b4e190`, antes das execuções; saídas em `eb86ddc`. Subagents novos, sonnet, effort medium.

| Caso | Esperado | Obtido |
|---|---|---|
| C1: cliente mobile (REQ-003, fora do escopo) entra em E2 | Contradicts cita `Non-goals` | `E2 (pieces, reqs), Non-goals` |
| C2: E1 pronto na branch de feature, sem integração | cita E1 e a definição de pronto | `E1 (definition of done)` |
| D1: identificador UUID v4 | `-` | `-` |
| D2: compartilhamento de E2 por e-mail | `-` | `-` |
| Critério 3: E1 com a condição de entrada estreitada (sinal 1) | um pendente `enfraquecido` para o critério 1, dentro do limite; nenhum para o 2 | um pendente de 110 caracteres, `enfraquecido`; critério 2 `igual` |

Regra de passagem (2 de 2 contradições, no máximo 1 falso positivo): 2 de 2 e 0 falsos positivos. Revisão adversarial (`run-extra-revisao.md`, opus, effort medium): a condição do dono está cumprida. Ressalvas: n=1 por caso; o acerto de C1 dependeu de o agente ler `requirements.md` (a seção Non-goals da fixture só aponta para os itens fora do escopo); o pendente de aprovação da revisão foi gravado com `sed` em vez de `add-pending`; a pasta-extra-c2 ainda mostra o salto para DEC-199, porque rodou antes da sincronização com a correção.

## Gates

Na `feat/E22` sincronizada com a release (`d07b036`): G1 1311 testes, 0 falhas; G2 e G3 exit 0; G4 0 erros; G5 44 OK, 0 WARN; embed check exit 0.
