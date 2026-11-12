// E20: o agente plan-author e os textos embarcados de E20 ficam independentes
// de superpowers, nao perguntam e fixam o contrato de chamada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

// Todos os arquivos sob um diretorio relativo a plugins/productivity-tools/, recursivo.
export function filesUnder(rel) {
  const out = [];
  for (const e of readdirSync(join(PLUGIN, rel), { withFileTypes: true })) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) out.push(...filesUnder(r));
    else out.push(r);
  }
  return out;
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

const PLAN_WRITER = 'skills/plan-writer/SKILL.md';

test('E20: plan-writer frontmatter keeps name, description and argument-hint only', () => {
  const { keys, fields } = frontmatter(read(PLAN_WRITER));
  assert.deepEqual([...keys].sort(), ['argument-hint', 'description', 'name']);
  assert.equal(fields.name, 'plan-writer');
  for (const w of ['spec-writer', 'roadmap-planner', 'plan-coordinator']) {
    assert.ok(fields.description.includes(w), `descrição sem ${w}`);
  }
  assert.match(fields.description, /adopt/i);
});

test('E20: plan-writer dispatches plan-author in interactive and adopt mode', () => {
  const { body } = frontmatter(read(PLAN_WRITER));
  for (const w of ['subagent_type', 'productivity-tools:plan-author', 'mode: interactive', 'mode: adopt',
    '${CLAUDE_SKILL_DIR}/../../scripts/plan-tool.mjs', '.adopted.md', '## Adoção']) {
    assert.ok(body.includes(w), `falta "${w}"`);
  }
  assert.match(body, /node "[^"]*plan-tool[^"]*" (check|summary)|node "<planTool>" (check|summary)/);
  assert.match(body, /summary[^\n]*--lang/);
});

test('E20: plan-writer resolves the roadmap folder from its three sources (pointer)', () => {
  const { body } = frontmatter(read(PLAN_WRITER));
  for (const w of ['--roadmap', '**Roadmap:**', 'roadmap.config.json']) {
    assert.ok(body.includes(w), `falta "${w}"`);
  }
  assert.match(body, /null/);
});

test('E20: plan-writer adoption asks one approval and never overwrites before it', () => {
  const { body } = frontmatter(read(PLAN_WRITER));
  assert.ok(body.includes('AskUserQuestion'));
  assert.match(body, /one approval/i);
  assert.match(body, /original[^\n]*(intact|unchanged)/i);
  assert.match(body, /does not commit|never commits/i);
});

test('E20: plan-writer refusals show the exact rules and reload', () => {
  const { body } = frontmatter(read(PLAN_WRITER));
  assert.ok(body.includes('Bash(node *plan-tool.mjs" *)'));
  assert.ok(body.includes('Bash(node *spec-tool.mjs" *)'));
  assert.ok(body.includes('/reload-plugins'));
});

test('E20: progress refusal and plan-writer adoption stay in step (REQ-020)', () => {
  const progress = read('skills/plan-coordinator/scripts/progress.mjs');
  const line = progress.split('\n').find((l) => l.startsWith('const NO_DATA_BLOCK ='));
  assert.ok(line, 'sem NO_DATA_BLOCK');
  assert.ok(line.includes('plan-writer'));
  assert.match(line, /modo de adoção/);
  const text = read(PLAN_WRITER);
  assert.equal(frontmatter(text).fields.name, 'plan-writer');
  assert.match(text, /adoption mode/i);
});

test('E20: spec-writer points to plan-writer and passes --lang to summary', () => {
  const text = read('skills/spec-writer/SKILL.md');
  assert.ok(!text.includes('once it exists'));
  assert.match(text, /summary[^\n]*--lang/);
});

test('E20: shipped E20 texts never mention bypassPermissions in plan-writer', () => {
  assert.doesNotMatch(read(PLAN_WRITER), /bypassPermissions/);
});

test('E20: plan-writer stays under 500 lines', () => {
  assert.ok(read(PLAN_WRITER).split('\n').length < 500);
});

test('E20: no published planner, tracker or E20 file mentions superpowers (criterion 3)', () => {
  const files = [
    ...filesUnder('skills/roadmap-planner'),
    ...filesUnder('skills/roadmap-tracker'),
    ...filesUnder('skills/plan-writer'),
    AGENT,
  ];
  const hits = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      if (/superpowers/i.test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('E20: planner chains spec-writer, plan-writer with --roadmap, and plan-coordinator', () => {
  const text = read('skills/roadmap-planner/SKILL.md');
  assert.match(text, /spec-writer/);
  assert.match(text, /plan-writer[^\n]*--roadmap/);
  assert.match(text, /plan-coordinator/);
  assert.match(text, /roadmap-release/);
  const { fields } = frontmatter(text);
  assert.ok(fields.description.includes('BEFORE spec-writer'));
  assert.ok(fields.description.includes('use plan-writer'));
});

test('E20: tracker description points task plans to plan-writer', () => {
  const { fields } = frontmatter(read('skills/roadmap-tracker/SKILL.md'));
  assert.ok(fields.description.includes('use plan-writer'));
});
