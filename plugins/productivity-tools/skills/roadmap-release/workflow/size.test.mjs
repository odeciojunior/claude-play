import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Valor provisório: tamanho de roadmap-release.js na ponta de feat/E8 (238036 caracteres),
// arredondado para cima ao múltiplo de 10.000. A concessão de lançamento pelo nome ainda não
// foi medida; crescimento acima deste teto pede nova medição ou decisão, não aumento silencioso.
export const MAX_WORKFLOW_CHARS = 240000;

const WF = new URL('./roadmap-release.js', import.meta.url);

test('the release workflow stays within the size launched by name', () => {
  const size = readFileSync(WF, 'utf8').length;
  assert.ok(size <= MAX_WORKFLOW_CHARS, `roadmap-release.js has ${size} chars, cap is ${MAX_WORKFLOW_CHARS}`);
});
