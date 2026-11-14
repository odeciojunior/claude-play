import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(HERE, '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
const skillMd = read(path.join(SKILL, 'SKILL.md'));
const operatorMd = read(path.join(SKILL, 'references', 'operator.md'));

function shippedFiles() {
  const files = [path.join(SKILL, 'SKILL.md'), path.join(HERE, 'roadmap-release.js')];
  const refs = path.join(SKILL, 'references');
  for (const f of fs.readdirSync(refs)) if (f.endsWith('.md')) files.push(path.join(refs, f));
  return files;
}

function section(text, heading) {
  const start = text.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing section ${heading}`);
  const rest = text.slice(start + heading.length + 2);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

test('no shipped file sets bypassPermissions as the default', () => {
  for (const f of shippedFiles()) {
    for (const line of read(f).split('\n')) {
      if (!line.includes('bypassPermissions')) continue;
      assert.match(line, /not the default|never the default|não é o padrão/i, `${path.basename(f)}: ${line.slice(0, 120)}`);
    }
  }
});

test('operator.md has the headless recipe', () => {
  const s = section(operatorMd, '## Without the interface (claude -p)');
  assert.ok(s.includes('--allowedTools "Bash(git:*)" "Bash(node:*)"'));
  assert.ok(s.includes('CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0'));
  assert.ok(s.includes('.claude/settings.local.json'));
  assert.ok(s.includes('--declare-permissions'));
});

test('operator.md lists the new action kinds', () => {
  assert.match(operatorMd, /\| `previous-version` \|/);
  assert.match(operatorMd, /\| `plan-frozen-tasks` \|/);
  const row = operatorMd.split('\n').find((l) => l.startsWith('| `approve-ruling` |'));
  assert.ok(row, 'approve-ruling row');
  assert.ok(row.includes('approveRulings'));
  assert.match(row, /typed by the person/i);
  assert.match(row, /not in `?resumeWith`?|outside `?resumeWith`?|never in `?resumeWith`?/i);
});

test('SKILL.md step 2 keeps DEC-218 with the owner-resume exception', () => {
  const m = /\n2\. \*\*Preflight\.\*\*[\s\S]*?\n3\. \*\*/.exec(skillMd);
  assert.ok(m, 'step 2');
  const s = m[0];
  assert.ok(s.includes('permissionsDeclared'));
  assert.match(s, /`permissionsDeclared` is not null[^\n]*`missingRules` alone does not stop the run/);
  assert.match(s, /record the declared text[^\n]*in the report/i);
  assert.ok(s.includes('startedDependents'));
  assert.match(s, /owner/i);
  assert.match(s, /no other selected deliverable depends/i);
  assert.match(s, /pending `?contract`? decision/i);
});

test('the scriptPath fallback states the dialog limit', () => {
  const m = /\n4\. \*\*Run the workflow\.\*\*[\s\S]*?\n5\. \*\*/.exec(skillMd);
  assert.ok(m, 'step 4');
  for (const [name, text] of [['SKILL.md step 4', m[0]], ['operator.md', operatorMd]]) {
    assert.ok(text.includes('213.337'), `${name} cites 213.337`);
    assert.match(text, /not measured/i, `${name} says not measured`);
    assert.match(text, /approval dialog/i, `${name} names the dialog`);
    assert.match(text, /supported path is the name/i, `${name} says the name is supported`);
  }
});

test('SKILL.md forbids adding approveRulings from doNow or resumeArgs', () => {
  const line = skillMd.split('\n').find((l) => l.startsWith('- Never add `approveRulings`'));
  assert.ok(line, 'approveRulings rule');
  assert.match(line, /doNow/);
  assert.match(line, /person's own message/);
  assert.match(line, /never goes into `resumeWith`/);
});

test('SKILL.md treats missingDirs like missingRules and forbids composed shell commands', () => {
  const m = /\n2\. \*\*Preflight\.\*\*[\s\S]*?\n3\. \*\*/.exec(skillMd);
  assert.ok(m, 'step 2');
  assert.ok(m[0].includes('--wt-root <wtRoot>'));
  assert.ok(m[0].includes('missingDirs'));
  for (const way of ['permissions.additionalDirectories', '--add-dir', '/add-dir']) assert.ok(m[0].includes(way), way);
  assert.ok(skillMd.split('\n').some((l) => l.startsWith('- One simple command per Bash call')));
  assert.ok(operatorMd.includes('--permission-mode acceptEdits --add-dir'));
});
