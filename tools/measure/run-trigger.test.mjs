import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTranscript, scoreCase, renderTable } from './run-trigger.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/trigger/${n}`, import.meta.url), 'utf8');
const PW = 'productivity-tools:plan-writer';

test('parses the first Skill call and superpowers present', () => {
  const p = parseTranscript(fx('hit-superpowers-on.jsonl'));
  assert.equal(p.skill, PW);
  assert.equal(p.superpowers, true);
  assert.ok(p.plugins.includes('productivity-tools'));
});

test('parses a wrong skill with superpowers absent, CRLF and a blank line', () => {
  const p = parseTranscript(fx('wrong-skill-superpowers-off.jsonl'));
  assert.equal(p.skill, 'productivity-tools:roadmap-planner');
  assert.equal(p.superpowers, false);
});

test('a transcript without init and with a non-JSON line does not throw', () => {
  const line = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: PW } }] } });
  const p = parseTranscript(`not json\n${line}\n`);
  assert.equal(p.superpowers, 'unknown');
  assert.equal(p.skill, PW);
  assert.deepEqual(p.plugins, []);
});

test('scoreCase marks hit and miss', () => {
  const c = { id: 'a', category: 'plan', lang: 'pt', expect: PW };
  const hit = scoreCase(c, parseTranscript(fx('hit-superpowers-on.jsonl')));
  const miss = scoreCase(c, parseTranscript(fx('wrong-skill-superpowers-off.jsonl')));
  assert.equal(hit.hit, true);
  assert.equal(miss.hit, false);
  assert.equal(hit.got, PW);
  assert.equal(hit.superpowers, true);
});

test('renderTable lists each case and the hits per category', () => {
  const c = { category: 'plan', lang: 'pt', expect: PW };
  const out = renderTable([
    scoreCase({ ...c, id: 'c1' }, parseTranscript(fx('hit-superpowers-on.jsonl'))),
    scoreCase({ ...c, id: 'c2' }, parseTranscript(fx('wrong-skill-superpowers-off.jsonl'))),
  ]);
  assert.match(out, /\| id \| lang \| category \| expect \| got \| hit \| superpowers \|/);
  assert.match(out, /\| c1 \|/);
  assert.match(out, /\| c2 \|/);
  assert.match(out, /\| category \| hits \| total \|/);
  assert.match(out, /\| plan \| 1 \| 2 \|/);
});
