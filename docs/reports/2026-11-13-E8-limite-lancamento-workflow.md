# E8: limite de tamanho do lançamento pelo nome

Data: 2026-11-13. Item pendente de E8; decisão DEC-641. Claude Code 2.1.323.

## Contexto

`size.test.mjs` limita `roadmap-release.js` a `MAX_WORKFLOW_CHARS = 240000` caracteres LF (DEC-556, DEC-563). O valor saiu do tamanho da ponta de feat/E8 arredondado, sem medição do lançamento pelo nome. Nenhum relatório anterior em `docs/reports/` mediu esse limite. A DEC-641 manda medir agora, com teto de US$ 4: se o script lançar com 300.000 ou mais, o teto sobe a 250.000 em commit próprio na release, antes de E10.

## Método

- Fonte: `plugins/productivity-tools` de `_integracao` (cd5d292), só lida. Para cada tamanho, uma cópia em `D:/claude-release-runs/cap-measure/plugin-<tamanho>/productivity-tools`, com `roadmap-release.js` normalizado para LF e completado até o tamanho exato com um comentário de bloco no fim. O comportamento do script não muda. O controle é o arquivo atual, sem preenchimento (239.994 caracteres LF, 240.018 bytes).
- Cada tamanho rodou numa sessão headless num repositório git vazio: `claude -p ... --plugin-dir <cópia> --model sonnet --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 1 --output-format stream-json --verbose`. O prompt pede uma única chamada `Workflow` com `name: "productivity-tools:release-workflow"` e `args: {"mode":"dry-run"}`, sem `scriptPath`.
- Critério: lançou = `status: async_launched` e o script devolve o próprio erro da primeira checagem (`args.config is missing or has no gates`), que é a prova de que ele executou. Não lançou = a ferramenta recusa a chamada. Bisseção de 300.000 para cima.

## Resultados

| Caracteres LF | Bytes | Lançou | Evidência |
|---|---|---|---|
| 239.994 (controle) | 240.018 | sim | `async_launched`, depois o erro `args.config` do script |
| 300.000 | 300.024 | sim | idem (cópia da sessão com 300.024 bytes) |
| 400.000 | 400.024 | sim | idem |
| 500.000 | 500.024 | sim | idem |
| 524.000 | 524.024 | sim | idem |
| 524.264 | 524.288 | sim | idem |
| 524.265 | 524.289 | não | `Workflow "productivity-tools:release-workflow" not found. Available: deep-research` |
| 525.000 | 525.024 | não | idem |
| 600.000 | 600.024 | não | idem |

Custo: US$ 0,896 em 9 sessões (cerca de US$ 0,106 por lançamento e US$ 0,086 por recusa). O dry-run parou antes de qualquer agente.

## Leitura

- O limite é de 512 KiB, 524.288 bytes do arquivo. Ele conta bytes: com 24 bytes de caracteres não ASCII, 524.265 caracteres (524.289 bytes) já falham.
- Acima do limite não sai erro de tamanho. O workflow some do registro do plugin e a chamada pelo nome responde "not found", como se o manifesto não o declarasse. Esse sintoma deve entrar no diagnóstico do preflight e da skill.
- No Windows, as cópias instaladas em `~/.claude/plugins/cache/claude-play/productivity-tools/<versão>/` vêm em CRLF (1.7.0: 216.543 bytes, 2.397 `\r`). Cada linha soma 1 byte ao que o limite mede. O arquivo atual tem 242.904 bytes em CRLF (239.994 caracteres LF + 2.886 `\r` + 24 bytes de não ASCII), o que deixa uns 281 mil bytes de folga.

## Implicação para a DEC-641

O script lançou com 300.000 caracteres e com muito mais. Pela DEC-641, `MAX_WORKFLOW_CHARS` sobe a 250.000 em commit próprio na release, antes de E10, fora de entregável. Por decisão do dono (Fable, DEC-639), a subida acontece depois do merge de E24, para não reabrir o spec de E24, que fecha em 239.930. O teto de 250.000 continua bem abaixo do limite medido: mesmo em CRLF, um arquivo de 250.000 caracteres LF fica perto de 253 mil bytes, menos da metade de 524.288. O comentário de `size.test.mjs` que diz que a concessão "ainda não foi medida" pode citar este relatório.
