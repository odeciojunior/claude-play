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

// Trecho da adocao no SKILL.md: da linha do modo de adocao ate a do plano com bloco.
function adoptionText() {
  const { body } = frontmatter(read(PLAN_WRITER));
  const start = body.indexOf('- **Old plan without a data block**');
  const end = body.indexOf('- **Plan with a data block**');
  assert.ok(start >= 0 && end > start, 'sem o trecho de adocao');
  return body.slice(start, end);
}

test('E20: plan-writer adoption checks the provisional before approval and before the move', () => {
  const text = adoptionText();
  const check = text.indexOf('node "<planTool>" check "<output>"');
  assert.ok(check >= 0, 'sem check do provisorio');
  const ask = text.indexOf('AskUserQuestion');
  assert.ok(check < ask, 'check depois da aprovacao');
  assert.ok(check < text.indexOf('move the provisional'), 'check depois do move');
  const before = text.slice(check, ask);
  assert.ok(before.includes('delete the provisional file'), 'check falho sem apagar o provisorio');
  assert.ok(before.includes('do not ask for approval'), 'check falho sem parar a aprovacao');
});

test('E20: plan-writer adoption deletes nothing after the move and drops the spec adjustment', () => {
  const text = adoptionText();
  assert.match(text, /nothing is deleted after the move/i);
  assert.ok(!text.includes('adjust the `spec` field'));
  const from = text.indexOf('move the provisional');
  const to = text.indexOf('Refuse', from);
  assert.ok(from >= 0 && to > from, 'sem o trecho entre o move e a recusa');
  const afterMove = text.slice(from, to).replace(/nothing is deleted/gi, '');
  assert.doesNotMatch(afterMove, /delet/i);
});

test('E20: plan-writer adoption shows the mechanical diff as the full record', () => {
  const text = adoptionText();
  assert.ok(text.includes('git diff --no-index -- "<original>" "<provisional>"'));
  assert.match(text, /--stat/);
  assert.match(text, /over 200 lines/);
  assert.match(text, /exit 1 only means the files differ/);
  assert.match(text, /full record/i);
});

test('E20: plan-writer adoption looks up the spec in order, card spec before spec-author', () => {
  const text = adoptionText();
  const order = ['named by the person', 'cited in the plan', 'beside the plan',
    'docs/plans/<name>-E<n>/spec.md', 'productivity-tools:spec-author'];
  const at = order.map((w) => text.indexOf(w));
  order.forEach((w, i) => assert.ok(at[i] >= 0, `falta "${w}"`));
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i - 1] < at[i], `"${order[i - 1]}" depois de "${order[i]}"`);
  }
  assert.ok(text.includes('docs/plans/<x>-E<n>/spec.md'), 'sem o spec do card em roadmap-<x>');
  assert.ok(text.includes('docs/plans/roadmap-<x>/'));
});

test('E20: plan-writer adoption stops when the provisional output already exists', () => {
  assert.ok(adoptionText().includes('If `output` already exists, stop and report it; dispatch nothing.'));
});

test('E20: plan-writer adoption stops on a missing row or false origin over the whole table', () => {
  const text = adoptionText();
  assert.match(text, /re-dispatch[^.]*once/i);
  assert.match(text, /repeat this step without re-dispatching/);
  assert.match(text, /false origin/i);
  assert.match(text, /`constraints` item/);
  assert.match(text, /structured-field difference \(files, deps, checks, tier, locks, external, commit\)/);
});

test('E20: plan-author adopt accounts one row per old step, task, constraints item and field', () => {
  const { body } = frontmatter(read(AGENT));
  const step = body.split('\n').find((l) => l.startsWith('4. In `adopt` mode')) || '';
  assert.ok(step, 'sem passo 4 de adocao');
  assert.match(step, /one row per old step/i);
  assert.match(step, /one row per item of the data block's `constraints`/);
  assert.match(step, /one row per structured-field difference/i);
  assert.match(step, /literal/i);
  assert.match(step, /"became", "kept" or "carried over"/);
  assert.ok(!step.includes('every difference'));
});

test('E20: plan-writer adoption passes spec-author every field its contract requires', () => {
  const { body } = frontmatter(read(PLAN_WRITER));
  const step = body.split('\n').find((l) => l.includes('productivity-tools:spec-author')) || '';
  assert.ok(step, 'falta o despacho de productivity-tools:spec-author');
  for (const w of ['mode: interactive', '`output`', '`specTool`', '`topic`', '`language`', '`intake`']) {
    assert.ok(step.includes(w), `falta "${w}" no despacho do spec-author`);
  }
});

test('E20: a roadmap deliverable spec keeps id E<n> so the tracker can close it', () => {
  assert.match(read('skills/spec-writer/SKILL.md'), /topic ending in `-E<n>`[^\n]*`id` is `E<n>`/);
  assert.match(read('skills/spec-writer/SKILL.md'), /then `topic: E<n>`/);
  assert.doesNotMatch(read('agents/spec-author.md'), /E<n>` when the topic ends/);
});
