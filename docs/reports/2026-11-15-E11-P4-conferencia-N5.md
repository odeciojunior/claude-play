# E11, P4: conferência de N5-1 e N5-2 (DEC-458, DEC-744)

Data: 2026-11-15. Plugin medido: worktree destacada `D:/claude-p4-release` em `ae9154b` (release com `feat/e11-prep-plugins` mesclada), carregado por `--plugin-dir`; nada veio do cache. Conduzida por um agente opus com 4 sessões `claude -p` (opus na sessão principal, como em E20), `bypassPermissions` só na medição (DEC-311/312). Sandbox `D:/claude-p4-work/` montado com as fixtures de E20 (`make-scenario.mjs --variant plan-author`). Relatório do orquestrador.

| Item | Resultado | Evidência | Custo |
|---|---|---|---|
| 1. Adoção até `APPROVAL QUESTION:` (N5-1, N5-2) | passou | `A-adopt.jsonl`; script `literal.mjs` comparou a mensagem final com o provisório e as saídas reais | US$ 1,21 |
| 2. Recusa | passou | `B-refuse.jsonl` (`--resume`): uma única chamada, `rm` do provisório; `git status` vazio e original com o mesmo SHA-256 | US$ 1,28 |
| 3. Spec pelo card | passou | na sessão A: spec citado inexistente, a sessão escolheu `docs/plans/roadmap-sandbox-E5/spec.md` com `spec-tool check --roadmap` 0 | (na A) |
| 4. Cadeia spec-writer → plan-writer (card E1) | passou | `C2-chain.jsonl`; `spec-tool check --roadmap` 0/0 e `plan-tool check` 0/0; bloco com `roadmap` | US$ 0,85 |

Total: **US$ 4,25** (inclui uma 1ª tentativa da cadeia descartada, `C-chain.jsonl`, US$ 0,91: o roteiro do condutor acrescentou um 3º critério e o `spec-tool check --roadmap` falhou com `acceptance-count`; a skill gravou `roadmap: null` e explicou, o comportamento certo. Defeito do roteiro, não do produto).

## Detalhes

- **N5-1:** a seção `## Adoção` (6.944 caracteres), o `--stat` real com o comando `git diff --no-index` (diff de 286 linhas), a pasta do roadmap com a origem ("tirada da linha `**Roadmap:**` do cabeçalho do plano antigo") e a saída de `summary --lang pt` aparecem literais e nessa ordem.
- **N5-2:** deps "adicionado | Derivado (ruling R2)", score e effort "derivado", título encurtado "derivado" do spec; `Test reference` com linha própria; nenhum desses valores como "mantido". Ressalva: o tier aparece "mantido via roteamento", e o tier sonnet existe no plano antigo, então não é origem falsa.
- A cobertura pedida pela pendência de E20 (recusa e spec do card) foi exercida.

## Conclusão

N5-1 e N5-2 conferidos antes de M (DEC-744). O gatilho de DEC-458 não dispara; o plugin não muda. Transcripts em `D:/claude-p4-work/transcripts/` (fora do repositório).
