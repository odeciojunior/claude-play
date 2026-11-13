import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Teto de 250.000 caracteres LF (DEC-641). A medida é a do conteúdo commitado (LF): com
// core.autocrlf=true a cópia de trabalho ganha um \r por linha, que não conta. O lançamento pelo
// nome foi medido em docs/reports/2026-11-13-E8-limite-lancamento-workflow.md: o limite é de
// 524.288 bytes do arquivo (acima disso o workflow some e a chamada responde "not found"); mesmo
// em CRLF, 250.000 caracteres ficam perto de 253 mil bytes. Crescimento acima deste teto pede
// nova decisão, não aumento silencioso.
export const MAX_WORKFLOW_CHARS = 250000;

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
