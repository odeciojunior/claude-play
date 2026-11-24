import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SLICE_BYTES, utf8Length, sha256Hex, sliceEnvelopes, checkSlice, joinSlices, canon, fnv1a } from '../lib/plan-digest.mjs'

// E41 B3: the real state whose slice 6 never passed the digest (a haiku turned "," into "." and a sonnet turned the
// escape \n into a space, in 6 of 6 copies of the raw text). The fake runner below corrupts the text of each copied
// envelope that way; with the text in base64 there is nothing for it to corrupt and the read passes.
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'slice-prose', 'progress-at-fail.json')
const state = JSON.parse(readFileSync(FIXTURE, 'utf8'))
const text = JSON.stringify(canon({ root: '/r', planChanged: false, stateDigest: 'abc', state: { ...state, history: [] } }))
const head = { tool: 'progress', command: 'read', nonce: 'n1', now: '2026-11-24T00:00:00.000Z' }
const sign = (o) => ({ ...o, digest: fnv1a(JSON.stringify(canon(o))) })
const mangle = (t) => t.replace(/,/g, '.').split(String.fromCharCode(92) + 'n').join(' ')

// What the runner agent prints: the envelope line with its text field mangled.
function copy(env) {
  return JSON.parse(JSON.stringify({ ...env, text: mangle(env.text) }))
}

test('the fixture state has the prose that broke the raw copy', () => {
  assert.ok(utf8Length(text) > 15000)
  const prose = state.steps[8].note
  assert.match(prose, /,/)
  assert.ok(prose.includes('\n'))
  assert.ok(state.steps[8].handoff.length > 100)
})

test('a runner that swaps "," for "." and the escape of a newline for a space still reads the real state (base64)', () => {
  const envs = sliceEnvelopes(head, text)
  assert.ok(envs.length >= 6)
  const copies = envs.map(copy)
  copies.forEach((c, k) => {
    assert.deepEqual(c, envs[k], 'base64 text has no comma or backslash to corrupt')
    assert.equal(checkSlice(c, { tool: 'progress', command: 'read', nonce: 'n1', slice: k }).ok, true)
    assert.ok(utf8Length(JSON.stringify(c)) <= SLICE_BYTES)
  })
  const joined = joinSlices(copies)
  assert.equal(joined.ok, true, joined.why)
  assert.equal(joined.text, text)
  assert.equal(sha256Hex(joined.text), envs[0].total.sha256)
  assert.equal(JSON.parse(joined.text).state.steps[8].note, state.steps[8].note)
})

test('the same runner breaks a raw-text envelope (what the old format did): the digest catches it', () => {
  // Built here, not by the code: the raw format no longer exists in plan-digest.mjs.
  const raw = sign({ ...head, slice: 0, slices: 1, total: { sha256: sha256Hex(text), bytes: utf8Length(text) }, text: state.steps[8].note })
  const bad = copy(raw)
  assert.notEqual(bad.text, raw.text)
  const { digest, ...rest } = bad
  assert.notEqual(digest, fnv1a(JSON.stringify(canon(rest))))
})

test('a corrupted base64 copy is caught: an extra AA== at the end of one slice', () => {
  const envs = sliceEnvelopes(head, text)
  const bad = envs.map((e, k) => (k === 3 ? { ...e, text: e.text + 'AA==' } : e))
  assert.equal(checkSlice(bad[3], { tool: 'progress', command: 'read', nonce: 'n1', slice: 3 }).ok, false)
  assert.equal(joinSlices(bad).ok, false)
})
