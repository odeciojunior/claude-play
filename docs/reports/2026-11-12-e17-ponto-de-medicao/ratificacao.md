# E17: lista de ratificação

Gerada em 2026-11-12 da pasta do roadmap da ponta da branch de release, lida sem tocar na branch alvo nem na worktree de integração. A pasta de `feat/E17` nunca é a fonte: ela vem da base de merge e não tem as linhas de E17.

- SHA completa da ponta de `release/roadmap-skills-v2` lida: `ebed1241839eeb01a850a8b4dad73d23f43bd98d`
- Cópia: `git archive release/roadmap-skills-v2 docs/plans/2026-11-10-roadmap-evolucao-skills.md docs/plans/roadmap-evolucao-skills | tar -x -C <alvo>` (o arquivo de estratégia vai junto: sem ele o tracker sai 2, `usage`, ENOENT); a cópia foi removida ao fim.
- Comando sobre a cópia: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs pending-decisions <alvo>/docs/plans/roadmap-evolucao-skills --json` (exit 0; o aviso `no-git` da cópia é esperado).
- Já ratificadas na ponta e fora desta lista: DEC-285 a DEC-299 e DEC-310. As decisões anteriores a E17 não têm pendência.

Saída resumida (campos `id`, `deliverable`, `scope` de `result.decisions`):

```json
{
  "command": "pending-decisions",
  "result": {
    "decisions": [
      {
        "id": "DEC-300",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-301",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-302",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-303",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-304",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-305",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-306",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-307",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-308",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-309",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-314",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-315",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-316",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-317",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-318",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-319",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-320",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-321",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-322",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-323",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-324",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-325",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-326",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-327",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-328",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-329",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-330",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-331",
        "deliverable": "E17",
        "scope": "contract"
      },
      {
        "id": "DEC-332",
        "deliverable": "E17",
        "scope": "local"
      },
      {
        "id": "DEC-333",
        "deliverable": "E17",
        "scope": "local"
      }
    ]
  },
  "summary": {
    "errors": 0,
    "warnings": 1,
    "exitCode": 0
  }
}
```

Resposta recomendada para todas as linhas: **ratificar**. As respostas são gravadas pelo tracker (`ratify` / `reject`, `--amend` para emendas, DEC-200) na branch de release. Várias decisões da ponta repetem a mesma escolha (a spec foi registrada mais de uma vez); ratifique cada id, ou rejeite as repetições como duplicata, sem mudar o conteúdo.

## Decisões do executor pendentes na ponta

| id | alcance | custo se errada | o que já foi construído em cima | resposta recomendada |
|---|---|---|---|---|
| DEC-300 | contrato | refazer a preparação da pasta de configuração; reversível | seção "Execuções pagas" do roteiro; conferência de `--tag` do arnês sem mudança | ratificar |
| DEC-301 | local | medição sem valor para a publicação; reversível | `gates.md`, `volta.md` e a conferência de árvore do roteiro | ratificar |
| DEC-302 | contrato | reescrever a ferramenta antes de E11; reversível | `tools/measure/checkpoint.mjs` e seus testes (T4); E11, E16 e E13 vão reutilizá-la | ratificar |
| DEC-303 | contrato | falso bloqueio ou falsa aprovação do registro; reversível | campo `panel` em `run-batch.mjs` (T2) e a conferência em `checkpoint.mjs` (T4) | ratificar |
| DEC-304 | local | detecção de plano medida com prompt diferente do publicado; reversível | `armMatches` em `checkpoint.mjs` (T4, correção `c7efe09`) | ratificar |
| DEC-305 | local | meta marcada com valor de outra definição; reversível | `tools/measure/prose-goals.mjs` (T3) e a seção de metas de `checkpoint.mjs` | ratificar |
| DEC-306 | local | um commit de correção de documentação; reversível | commit de versão M (T5) | ratificar |
| DEC-307 | local | publicação retida até a passada; reversível | este arquivo e a seção "Ratificação" do roteiro (T8) | ratificar |
| DEC-308 | contrato | volta que não publica limpo, descoberta antes de ser necessária; reversível | branch local e `volta.md` (T7) | ratificar |
| DEC-309 | local | relatório entrando por outro caminho; reversível | seção "Execuções pagas" do roteiro (T8) | ratificar |
| DEC-314 | contrato | refazer a preparação da pasta de configuração; reversível | seção "Execuções pagas" do roteiro; conferência de `--tag` do arnês sem mudança | ratificar |
| DEC-315 | local | medição sem valor para a publicação; reversível | `gates.md`, `volta.md` e a conferência de árvore do roteiro | ratificar |
| DEC-316 | contrato | reescrever a ferramenta antes de E11; reversível | `tools/measure/checkpoint.mjs` e seus testes (T4); E11, E16 e E13 vão reutilizá-la | ratificar |
| DEC-317 | local | execuções paradas no preflight, contadas como inválidas; reversível | `SANDBOX_RELEASE_RULES` (T1) e os `--allow` do roteiro | ratificar |
| DEC-318 | contrato | falso bloqueio ou falsa aprovação do registro; reversível | campo `panel` em `run-batch.mjs` (T2) e a conferência em `checkpoint.mjs` (T4) | ratificar |
| DEC-319 | local | detecção de plano medida com prompt diferente do publicado; reversível | `armMatches` em `checkpoint.mjs` (T4, correção `c7efe09`) | ratificar |
| DEC-320 | local | meta marcada com valor de outra definição; reversível | `tools/measure/prose-goals.mjs` (T3) e a seção de metas de `checkpoint.mjs` | ratificar |
| DEC-321 | local | um commit de correção de documentação; reversível | commit de versão M (T5) | ratificar |
| DEC-322 | local | publicação retida até a passada; reversível | este arquivo e a seção "Ratificação" do roteiro (T8) | ratificar |
| DEC-323 | contrato | volta que não publica limpo, descoberta antes de ser necessária; reversível | branch local e `volta.md` (T7) | ratificar |
| DEC-324 | local | nenhum; reversível | seção "Publicação" do roteiro (T8) | ratificar |
| DEC-325 | local | relatório entrando por outro caminho; reversível | seção "Execuções pagas" do roteiro (T8) | ratificar |
| DEC-326 | contrato | refazer a preparação da pasta de configuração; reversível | seção "Execuções pagas" do roteiro; conferência de `--tag` do arnês sem mudança | ratificar |
| DEC-327 | local | medição sem valor para a publicação; reversível | `gates.md`, `volta.md` e a conferência de árvore do roteiro | ratificar |
| DEC-328 | local | detecção de plano medida com prompt diferente do publicado; reversível | `armMatches` em `checkpoint.mjs` (T4, correção `c7efe09`) | ratificar |
| DEC-329 | local | um commit de correção de documentação; reversível | commit de versão M (T5) | ratificar |
| DEC-330 | local | publicação retida até a passada; reversível | este arquivo e a seção "Ratificação" do roteiro (T8) | ratificar |
| DEC-331 | contrato | volta que não publica limpo, descoberta antes de ser necessária; reversível | branch local e `volta.md` (T7) | ratificar |
| DEC-332 | local | relatório entrando por outro caminho; reversível | seção "Execuções pagas" do roteiro (T8) | ratificar |
| DEC-333 | local | nenhum; reversível | nada novo | ratificar |

## Decisões autônomas da spec (1 a 12)

Cada uma tem linha no alvo (id na coluna 2); a linha da lista acima é a mesma decisão.

| decisão | id no alvo | alcance | custo se errada | o que já foi construído em cima | resposta recomendada |
|---|---|---|---|---|---|
| spec 1 | DEC-314 | contrato | refazer a preparação da pasta de configuração; reversível | seção "Execuções pagas" do roteiro; conferência de `--tag` do arnês sem mudança | ratificar |
| spec 2 | DEC-315 | local | medição sem valor para a publicação; reversível | `gates.md`, `volta.md` e a conferência de árvore do roteiro | ratificar |
| spec 3 | DEC-316 | contrato | reescrever a ferramenta antes de E11; reversível | `tools/measure/checkpoint.mjs` e seus testes (T4); E11, E16 e E13 vão reutilizá-la | ratificar |
| spec 4 | DEC-317 | local | execuções paradas no preflight, contadas como inválidas; reversível | `SANDBOX_RELEASE_RULES` (T1) e os `--allow` do roteiro | ratificar |
| spec 5 | DEC-318 | contrato | falso bloqueio ou falsa aprovação do registro; reversível | campo `panel` em `run-batch.mjs` (T2) e a conferência em `checkpoint.mjs` (T4) | ratificar |
| spec 6 | DEC-319 | local | detecção de plano medida com prompt diferente do publicado; reversível | `armMatches` em `checkpoint.mjs` (T4, correção `c7efe09`) | ratificar |
| spec 7 | DEC-320 | local | meta marcada com valor de outra definição; reversível | `tools/measure/prose-goals.mjs` (T3) e a seção de metas de `checkpoint.mjs` | ratificar |
| spec 8 | DEC-321 | local | um commit de correção de documentação; reversível | commit de versão M (T5) | ratificar |
| spec 9 | DEC-322 | local | publicação retida até a passada; reversível | este arquivo e a seção "Ratificação" do roteiro (T8) | ratificar |
| spec 10 | DEC-323 | contrato | volta que não publica limpo, descoberta antes de ser necessária; reversível | branch local e `volta.md` (T7) | ratificar |
| spec 11 | DEC-324 | local | nenhum; reversível | seção "Publicação" do roteiro (T8) | ratificar |
| spec 12 | DEC-325 | local | relatório entrando por outro caminho; reversível | seção "Execuções pagas" do roteiro (T8) | ratificar |

## Decisões autônomas do plano (1 a 7)

Nenhuma tem linha no alvo: `sem id no alvo`. O tracker as registra com id novo no estágio de registro; alcance local para todas, exceto a 3, de contrato.

| decisão | id no alvo | alcance | decisão | custo se errada | o que já foi construído em cima | resposta recomendada |
|---|---|---|---|---|---|---|
| plano 1 | sem id no alvo | local | As execuções pagas não são tarefas do plano, nem externas: ficam como passos do dono no roteiro | nenhum; reversível | seção "Execuções pagas" do roteiro | ratificar |
| plano 2 | sem id no alvo | local | A branch de volta é tarefa externa do plano (T7), autorizada pelo dono em pessoa (DEC-299); dedupe por existência da branch | branch local a refazer; reversível | branch local e `volta.md` (T7) | ratificar |
| plano 3 | sem id no alvo | contrato | Painel esperado: `plan` para `plan-only` e `on-branch` com evidência do commit de merge para `completo` e `parada-retomada` | falso bloqueio ou falsa aprovação do painel; reversível | tabela de painel esperado em `run-batch.mjs` (T2) | ratificar |
| plano 4 | sem id no alvo | local | O pré-check de `--from-run` não muda: a árvore montada dos dois arquivos arquivados passa em `seedSourceOf` | execução semeada recusada; reversível | teste de semeadura em `make-scenario.test.mjs` (T1) e o passo 2 do roteiro | ratificar |
| plano 5 | sem id no alvo | local | Braço e metas lidos no commit `after.tagCommit` por `git show`, sem flag nova em `checkpoint.mjs` | flag a acrescentar depois; reversível | `checkpoint.mjs` (T4) | ratificar |
| plano 6 | sem id no alvo | local | Classe plano com braço defasado bloqueia (`exit 1`) até o dono liberar, como todo inconclusivo (DEC-081) | liberação manual a mais; reversível | `checkpoint.mjs` (T4) e o portão do roteiro | ratificar |
| plano 7 | sem id no alvo | local | A T8 lê a pasta do roadmap e a estratégia da ponta da release por `git archive` para uma pasta temporária, sem checkout da branch alvo | lista gerada de novo; reversível | esta lista e a seção "Ratificação" do roteiro | ratificar |
