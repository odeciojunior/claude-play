# E41 plano B3: texto das fatias em base64 (DEC-036), xor-base64 (DEC-037)

Executado fora do plan-coordinator (DEC-036, como DEC-035). Implementer sonnet, revisor opus, suíte completa antes do relançamento do B2.

## Motivo
O B2 parou antes da T11: a fatia 6 do estado (prosa de `steps[8].note`/`handoff`) nunca passou no digest. O haiku trocou a mesma vírgula por ponto em 4 de 4 tentativas, e o sonnet trocou `\n` por espaço em 2 de 2. Evidência em `.git/pt-evidence/E41-B2-slicefail/`.

Medição de 2026-11-24 (`.git/pt-evidence/E41-B3-b64/`): 10 cópias do mesmo trecho em base64 pelo script-runner/haiku, 9 exatas. A cópia que falhou acrescentou `AA==` ao fim e é pega pelo digest. Hex não foi preciso.

## Passos
1. `lib/plan-digest.mjs`:
   - `sliceEnvelopes` corta o texto por bytes UTF-8 e grava em `text` o base64 dessas partes, com `enc: "base64"` no envelope. O envelope serializado continua <= `SLICE_BYTES`. `total` (sha256 e bytes) segue sobre o texto decodificado.
   - `checkSlice` e `joinSlices` conferem `enc`.
   - `joinSlices` decodifica com um decodificador puro, sem Buffer nem atob, porque a lib não tem APIs do Node (DEC-058). Ele recusa base64 inválido.
   - Uma fatia pode cortar um caractere multibyte no meio: a decodificação junta os bytes antes de converter para texto.
2. Regenerar os 4 alvos com `embed.mjs` e conferir com `--check`.
3. Testes:
   - Atualizar os testes de fatias existentes.
   - Criar um teste novo com `progress-at-fail.json` como fixture. Um runner falso troca `,` por `.` e `\n` por espaço na cópia, e a leitura tem de passar.
   - Criar um teste de fatia com caractere multibyte cortado.
   - Os orçamentos de `size.test.mjs` e `copy-budget.test.mjs` continuam verdes.
4. Sonda: `tools/measure/sonda-e41-ac2b.mjs prepare` grava `note`/`handoff` com prosa (vírgulas, `\n`, aspas, acentos) no estado de exemplo. Reconferir se `--max-budget-usd 0.16` cobre as fatias a mais.
5. Suíte completa, lint e embed `--check`. Depois, revisão opus e relançamento do coordinator do B2 sobre o estado real: ler os 20,5 KB e parar em `authorize` é a prova da correção.

## Complemento (DEC-037): xor-base64
No relançamento real, os modelos decodificaram o base64 de cabeça e reescreveram o conteúdo (haiku removeu um `\"`, sonnet trocou `per run` por `por run`) e re-encodaram válido; o digest pegou. O `enc` passa a ser `"xor-base64"`: os bytes UTF-8 da fatia k são XOR com o keystream ``sha256(`${nonce}:${k}:${c}`)`` (bytes brutos, c = 0, 1, 2...), depois base64. O nonce é o do envelope; o índice da fatia evita keystream repetido. `total` e o digest do envelope não mudam de forma. É ofuscação, não sigilo: o nonce vai no envelope e o objetivo é só não deixar conteúdo visível para o modelo reescrever. `lib/plan-digest.mjs` expõe `sha256Bytes` (núcleo único do SHA-256; `sha256Hex` o usa). Medição: haiku 20/20, sonnet 6/6 (`.git/pt-evidence/E41-B3-b64/`), feita com envelopes simplificados (sem `slices`/`total`/`digest`/`now`, corte do base64 antigo); a prova no formato real é o relançamento do B2.
