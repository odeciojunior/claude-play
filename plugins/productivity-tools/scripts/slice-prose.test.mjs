import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SLICE_BYTES, utf8Length, sha256Hex, sliceEnvelopes, checkSlice, joinSlices, canon, fnv1a } from '../lib/plan-digest.mjs'

// E41 B3: the real state whose slice 6 never passed the digest (a haiku turned "," into "." and a sonnet turned the
// escape \n into a space, in 6 of 6 copies of the raw text). The fake runner below corrupts the text of each copied
// envelope that way; with the text in xor-base64 there is nothing for it to corrupt and the read passes.
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

test('a runner that swaps "," for "." and the escape of a newline for a space still reads the real state (xor-base64)', () => {
  const envs = sliceEnvelopes(head, text)
  assert.ok(envs.length >= 6)
  const copies = envs.map(copy)
  copies.forEach((c, k) => {
    assert.deepEqual(c, envs[k], 'xor-base64 text has no comma or backslash to corrupt')
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

test('a corrupted xor-base64 copy is caught: an extra AA== at the end of one slice', () => {
  const envs = sliceEnvelopes(head, text)
  const bad = envs.map((e, k) => (k === 3 ? { ...e, text: e.text + 'AA==' } : e))
  assert.equal(checkSlice(bad[3], { tool: 'progress', command: 'read', nonce: 'n1', slice: 3 }).ok, false)
  assert.equal(joinSlices(bad).ok, false)
})

// Independent reference in Node (crypto/Buffer) of the format measured in .git/pt-evidence/E41-B3-b64:
// text = base64(bytes XOR concat(sha256(`${nonce}:${slice}:${c}`))), c = 0, 1, 2...
function keystream(nonce, slice, n) {
  return Buffer.concat(Array.from({ length: Math.ceil(n / 32) }, (_, c) => createHash('sha256').update(`${nonce}:${slice}:${c}`).digest()))
}
function xorBytes(buf, nonce, slice) {
  const ks = keystream(nonce, slice, buf.length)
  return Buffer.from(buf.map((b, i) => b ^ ks[i]))
}
function nodeEnvelope(h, slice, slices, total, bytes) {
  const rest = { ...h, enc: 'xor-base64', slice, slices, total, text: xorBytes(bytes, h.nonce, slice).toString('base64') }
  return { ...rest, digest: fnv1a(JSON.stringify(canon(rest))) }
}

test('(a) a fixed vector built in Node with crypto/Buffer decodes the same in the lib', () => {
  const plain = 'ação, "per run" \n \\" 漢字 😀 '.repeat(5)
  const h = { tool: 'progress', command: 'read', nonce: '809df2987c8f73c07373345331f1d3d5' }
  const raw = Buffer.from(plain, 'utf8')
  const total = { sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length }
  // two slices, the cut at byte 91 falls inside a multibyte character or not: the join works on bytes
  const envs = [nodeEnvelope(h, 0, 2, total, raw.subarray(0, 91)), nodeEnvelope(h, 1, 2, total, raw.subarray(91))]
  for (let k = 0; k < 2; k++) assert.equal(checkSlice(envs[k], { ...h, slice: k }).ok, true)
  const joined = joinSlices(envs)
  assert.equal(joined.ok, true, joined.why)
  assert.equal(joined.text, plain)
  // the lib makes the very same single envelope from the same text
  const mine = sliceEnvelopes(h, plain)
  assert.deepEqual(mine, [nodeEnvelope(h, 0, 1, total, raw)])
})

test('(b) real case: a model that decodes the text, rewrites the prose and re-encodes plain base64 fails the digest; the literal xor-base64 copy passes', () => {
  const bs = String.fromCharCode(92)
  assert.ok(text.includes(bs + '"'), 'the state has an escaped quote')
  assert.ok(text.includes('per run'))
  const rewrite = (t) => t.split(bs + '"').join('"').split('per run').join('por run')
  const envs = sliceEnvelopes(head, text)
  let changed = 0
  envs.forEach((env, k) => {
    const want = { tool: 'progress', command: 'read', nonce: 'n1', slice: k }
    // the runner decodes (the plain text of the slice), rewrites and re-encodes valid plain base64
    const plain = xorBytes(Buffer.from(env.text, 'base64'), env.nonce, env.slice).toString('latin1')
    const mangled = rewrite(plain)
    if (mangled !== plain) {
      changed++
      const re = { ...env, enc: 'base64', text: Buffer.from(mangled, 'latin1').toString('base64') }
      assert.equal(checkSlice(re, want).ok, false, `slice ${k}: the rewrite is caught`)
      assert.equal(checkSlice({ ...re, enc: 'xor-base64' }, want).ok, false, `slice ${k}: the rewrite is caught by the digest too`)
    }
    assert.equal(checkSlice(JSON.parse(JSON.stringify(env)), want).ok, true)
    // the slice text shows no prose to rewrite
    assert.ok(!Buffer.from(env.text, 'base64').toString('latin1').includes('per run'))
  })
  assert.ok(changed > 0, 'the rewrite touched at least one slice')
  const joined = joinSlices(envs.map((e) => JSON.parse(JSON.stringify(e))))
  assert.equal(joined.ok, true, joined.why)
  assert.equal(joined.text, text)
})

test('(c) the keystream differs between slices and between nonces', () => {
  const same = 'x'.repeat(5000)
  const envs = sliceEnvelopes(head, same)
  assert.ok(envs.length >= 2)
  assert.notEqual(envs[0].text, envs[1].text)
  const first = (n) => Buffer.from(envs[n].text, 'base64').subarray(0, 32).toString('hex')
  assert.notEqual(first(0), first(1))
  assert.notEqual(envs[0].text, sliceEnvelopes({ ...head, nonce: 'n2' }, same)[0].text)
})
