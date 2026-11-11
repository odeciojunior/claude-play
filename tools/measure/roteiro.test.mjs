import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const roteiro = readFileSync(
  new URL('../../docs/reports/2026-11-11-e15-linha-de-base/roteiro.md', import.meta.url), 'utf8');

test('roteiro: ferramentas rodam da branch com E15, so o plugin fica na tag', () => {
  assert.doesNotMatch(roteiro, /na tag da linha de base\./);
  assert.doesNotMatch(roteiro, /o reposit[óo]rio no commit da tag/);
  assert.match(roteiro, /branch que cont[ée]m E15/);
  assert.match(roteiro, /plugin instalado no commit da tag/);
});
