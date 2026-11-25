# E39: correção extra antes do lote reiniciado (DEC-054)

Origem: execução 1 do lote parada-retomada (measurements.md, 2026-11-25), diagnóstico do Fable registrado na DEC-054. Classe do E41: um LLM barato recopiando texto longo.

## Defeitos

1. **Sha longo no argv.** `roadmap-release.js` monta `capture.mjs slice ... --sha <64 hex>`; o script-runner (haiku) emendou 24 hex ao copiar o comando, e o retry repetiu o erro.
2. **Test-first depende da cópia do `tail`.** O implementer (haiku) abreviou o stack trace do campo `tail` da linha vermelha do capture; o digest não confere, `testFirstGap` recusa o par e o entregável bloqueia com `conteudo`, embora a evidência esteja em disco.

## Correção

- `capture.mjs slice --sha` aceita um prefixo hexadecimal minúsculo de 12 a 64 caracteres; confere o sha256 do arquivo por prefixo. A saída continua com `total.sha256` completo, que o workflow confere como antes.
- `capture.mjs run --brief` omite `tail` e `tailCut` da linha (o resto, inclusive `digest`, igual).
- `roadmap-release.js`: o `slice` passa só os 12 primeiros hex; a linha `CAPTURE:` do implementer passa `--brief`.
- `implementer.md`: a linha sem `tail`; para ver a saída, ler o arquivo em `path`.

Fora: o espaço inserido no stdout devolvido (detectado e repetido pelo desenho do E41; contador da DEC-055); script-runner em sonnet (descartado na DEC-054); coordinator.js e o port agy.

## Verificação

Testes offline em `capture.test.mjs`, `flow.test.mjs` e `agent-contracts.test.mjs`; suíte completa; `roadmap-release.js` dentro de 265.673 caracteres LF (DEC-050); revisão por tarefa opus. Sem sonda própria: a reconferência é a execução 1 do lote reiniciado.
