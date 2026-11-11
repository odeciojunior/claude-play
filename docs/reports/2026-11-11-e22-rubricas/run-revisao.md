# run-revisao

Saída literal (resposta final) do subagent, opus, effort medium (revisão adversarial, só leitura). Fixture sintética.

---

Os três critérios passam. Nenhuma rubrica ou receita precisa ser corrigida antes do merge de E22: nenhum resultado esperado falhou por defeito de rubrica. O bug do `next-id` não bloqueia E22, mas precisa de correção antes de `release/roadmap-skills-v2` entrar em `main`.

Conferi as quatro pastas `pasta-*` contra `pasta/`. Também rodei `next-id`, que só lê: `git status` ficou igual antes e depois.

## Critério 2 — PASSA

- **A:** saiu DEC-199 com Contradicts `E3 (depends)`, que era o esperado. Correto pelo desempate de `rubric-contradiction.md:29`.
- **B original:** saiu `E3 (acceptance)`. O julgamento "entrada mal escolhida" se sustenta. "Paginado em 50" pode ser lido como afrouxar "every item is listed". A própria `rubric-criteria.md` usa "at least the first 50" como exemplo de enfraquecimento. Com duas classes cabendo, `contradiz` vence (`rubric-contradiction.md:32`), como a rubrica manda. O custo é só um aviso a mais, então não é defeito da rubrica.
- **B repetição:** saiu DEC-002 com `-`, correto. A linha tem Revisit `-` e não houve mudança indevida.
- **Ressalva:** A e B-repetição quase copiam os exemplos DEC-003 e DEC-006 da rubrica, então medem pouco a capacidade de discriminar.

## Critério 3 — PASSA

O critério 1 saiu `igual` e o 2 saiu `enfraquecido` (sinal 3, test→human), com um único pendente `(owner) … confirm (enfraquecido)` e o log "1 igual, 1 enfraquecido". O card não foi tocado e o checker deu 0/0.

## Fluxo — PASSA

O diff confirma que não houve edição à mão. § 20, BLQ-1 aberto e fechado, DEC-199/200 do executor, `ratify --amend` (DEC-201, Contradicts `-`) e `reject` (DEC-202 supersede DEC-200) terminaram com o checker em 0 erros. Ambiguidades que restaram:
- o texto de `--next` ficou a critério do agente;
- os passos 2 e 3 de § 5 foram pulados porque o bloqueio abriu e fechou em seguida;
- o agente citou DEC-002, tirado do `nextIds` do `brief` anterior ao refresh, e a CLI recusou com `unknown-id`, sem mudar nada.

O relatório diz que "next-id devolveu DEC-201" no fim, o que é falso: devolve DEC-203.

## Achados

1. **Média (alta se chegar a `main`).** Causa confirmada em `roadmap.mjs:120-149`: `nextId` passa por todos os arquivos da pasta (`walkFiles`, sem filtro de extensão), inclusive o `check-roadmap.mjs` vendorizado. Esse arquivo cita `DEC-111, DEC-198` num comentário em `check-roadmap.mjs:404`, que veio do commit f1bd7d0. Esse commit só está em `feat/E22` e `release/roadmap-skills-v2`; o checker de `main` não cita nenhum DEC.
   - **Efeito:** todo roadmap novo pula para DEC-199 depois do refresh. O `brief` de antes do refresh diz DEC-002, então as duas fontes divergem.
   - **Gravidade limitada:** não há ID duplicado nem dado corrompido.
   - **Correção:** fora de E22. Varrer só `.md` e a config, ou tirar o ID do comentário. Fica como pendente da release.
2. **Baixa.** `events/01-decision.md:9` não diz o que escrever em Revisit quando ninguém deu uma condição.
   - No run-criterio-2 o agente inventou condições; na repetição B usou `-`.
   - **Correção sugerida:** acrescentar "nobody supplied one → `-`".
   - O agente também listou "confirmar Revisit" em `Pending for the user`, mas não gravou o item em `state.md`. Isso descumpre a regra de `no questions` em `events.md` (Common, último item).
3. **Baixa.** `events/19-criteria-check.md:5` e a seção Output de `rubric-criteria.md` (linha 42) não preveem o limite de 300 caracteres. O agente resumiu bem, mas gravou o log antes do pendente aceito. Vale uma frase: "<A>/<B> só com a parte que difere; `cell-too-long` → encurtar e repetir".
4. **Baixa.** A repetição B não chamou `next-id`: usou o `nextIds` do `brief`, contra a regra de IDs do Common. O resultado foi DEC-002 válido, por sorte do bug.

## Pergunta 5 (run-criterio-2)

Tudo conforme a receita:
- **Linha de decisão à mão:** `01-decision.md:10` manda exatamente isso, porque a CLI não anexa linhas de Origin `user`.
- **Pendente de aprovação:** `(user) approve strategy v1.1 (absorbs …)` cumpre a regra 6 do `SKILL.md` e segue o formato de `01-decision.md:16`.
- **Next step do painel com DEC-199:** `01-decision.md:14` manda ajustar o painel. Card e critical-path ficaram intactos, o que também está certo.

Os achados 2 e 3 são melhorias opcionais. Não exigem repetir as execuções.

Arquivos verificados:
- `D:/projects/claude-play-wt/E22/plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- `D:/projects/claude-play-wt/E22/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`
- `D:/projects/claude-play-wt/E22/plugins/productivity-tools/skills/roadmap-tracker/references/`
- `D:/projects/claude-play-wt/E22/docs/reports/2026-11-11-e22-rubricas/`
