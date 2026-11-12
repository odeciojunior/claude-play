import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Valor provisório: tamanho de roadmap-release.js na ponta de feat/E8 (238036 caracteres em T13),
// arredondado para cima ao múltiplo de 10.000. A medida é a do conteúdo commitado (LF): com
// core.autocrlf=true a cópia de trabalho ganha um \r por linha, que não conta. A concessão de
// lançamento pelo nome ainda não foi medida; crescimento acima deste teto pede nova medição ou
// decisão, não aumento silencioso.
export const MAX_WORKFLOW_CHARS = 240000;

const WF = new URL('./roadmap-release.js', import.meta.url);

// Characters of the committed (LF) text, whatever the line endings of the working copy.
export const workflowChars = (text) => text.replace(/\r\n/g, '\n').length;

test('the release workflow stays within the size launched by name', () => {
  const size = workflowChars(readFileSync(WF, 'utf8'));
  assert.ok(size <= MAX_WORKFLOW_CHARS, `roadmap-release.js has ${size} chars, cap is ${MAX_WORKFLOW_CHARS}`);
});

test('a CRLF working copy measures the same as the committed LF text', () => {
  const lf = 'const a = 1\nconst b = 2\n\nexport { a, b }\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.notEqual(crlf.length, lf.length);
  assert.equal(workflowChars(crlf), lf.length);
  assert.equal(workflowChars(lf), lf.length);
  const wf = readFileSync(WF, 'utf8');
  assert.equal(workflowChars(wf.replace(/\r?\n/g, '\r\n')), workflowChars(wf.replace(/\r\n/g, '\n')));
});
