// E20: o agente plan-author e os textos embarcados de E20 ficam independentes
// de superpowers, nao perguntam e fixam o contrato de chamada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');

// Le um arquivo relativo a plugins/productivity-tools/, com CRLF normalizado.
export function read(rel) {
  return readFileSync(join(PLUGIN, rel), 'utf8').replace(/\r\n/g, '\n');
}

// Separa o frontmatter: chaves em ordem, campos como texto, corpo.
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { keys: [], fields: {}, body: text };
  const keys = [];
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    keys.push(kv[1]);
    fields[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { keys, fields, body: m[2] };
}

const AGENT = 'agents/plan-author.md';

test('E20: plan-author frontmatter pins opus, medium effort and tools without asking (REQ-013)', () => {
  const { fields } = frontmatter(read(AGENT));
  assert.equal(fields.name, 'plan-author');
  assert.equal(fields.model, 'opus');
  assert.equal(fields.effort, 'medium');
  assert.equal(fields.tools, 'Read, Grep, Glob, Bash, Write, Edit');
  assert.doesNotMatch(fields.tools, /AskUserQuestion|Agent/);
  assert.match(fields.description, /not for specs/i);
});

test('E20: plan-author body forbids asking and committing', () => {
  const { body } = frontmatter(read(AGENT));
  assert.match(body, /never ask/i);
  assert.match(body, /never commit/i);
  assert.match(body, /write only to .?output/i);
});

test('E20: plan-author body names the call contract with roadmap in every mode', () => {
  const { body } = frontmatter(read(AGENT));
  for (const w of ['mode', 'output', 'planTool', 'spec', 'language', 'roadmap', 'card', 'source',
    'ownerNote', 'intake', 'unattended', 'interactive', 'adopt']) {
    assert.ok(body.includes(w), `falta "${w}"`);
  }
  const row = body.split('\n').find((l) => l.startsWith('| `roadmap`'));
  assert.ok(row, 'sem linha da tabela para roadmap');
  const cols = row.split('|').map((c) => c.trim());
  assert.equal(cols[2], 'all');
  assert.match(row, /null/);
});

test('E20: plan-author closes with a quoted plan-tool check and returns emit', () => {
  const { body } = frontmatter(read(AGENT));
  assert.match(body, /node "<planTool>" check "<output>" --json/);
  assert.match(body, /node "<planTool>" emit "<output>"/);
  assert.match(body, /three|3/);
});

test('E20: plan-author adopt mode keeps every old step in an Adoção section', () => {
  const { body } = frontmatter(read(AGENT));
  assert.ok(body.includes('## Adoção'));
  assert.ok(body.includes('source'));
  assert.match(body, /(split|merged|added|removed)/);
});

test('E20: shipped E20 texts never mention bypassPermissions', () => {
  assert.doesNotMatch(read(AGENT), /bypassPermissions/);
});
