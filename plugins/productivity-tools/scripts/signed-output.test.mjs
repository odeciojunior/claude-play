import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  MAX_COPY_BYTES, SLICE_BYTES, utf8Length, sha256Hex, sliceEnvelopes, checkSlice, joinSlices,
  commandDigest, checkCapture, canon, fnv1a,
} from '../lib/plan-digest.mjs'

const ref = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const head = { tool: 'progress', command: 'read', nonce: 'n1' }
const sign = (o) => ({ ...o, digest: fnv1a(JSON.stringify(canon(o))) })

test('constants', () => {
  assert.equal(MAX_COPY_BYTES, 3500)
  assert.equal(SLICE_BYTES, 3072)
})

test('utf8Length matches Buffer.byteLength', () => {
  for (const s of ['', 'abc', 'ação é útil', '漢字かな', 'x😀y', '😀😀']) assert.equal(utf8Length(s), Buffer.byteLength(s, 'utf8'))
})

test('sha256Hex matches node:crypto', () => {
  const big = 'abcdefghij'.repeat(100000)
  for (const s of ['', 'abc', big, 'a😀b漢é'.repeat(50)]) assert.equal(sha256Hex(s), ref(s))
})

function planText() {
  let t = ''
  for (let i = 1; i <= 40; i++) t += `- passo ${i}: ${'descrição longa do passo '.repeat(18)}\n`
  return t
}

test('sliceEnvelopes: size, indexes, total, digest', () => {
  const text = planText()
  assert.ok(utf8Length(text) > 15000)
  const envs = sliceEnvelopes(head, text)
  assert.ok(envs.length > 4)
  envs.forEach((env, i) => {
    assert.ok(utf8Length(JSON.stringify(env)) <= SLICE_BYTES)
    assert.equal(env.slice, i)
    assert.equal(env.slices, envs.length)
    assert.deepEqual(env.total, envs[0].total)
    const { digest, ...rest } = env
    assert.equal(digest, fnv1a(JSON.stringify(canon(rest))))
  })
  assert.deepEqual(joinSlices(envs), { ok: true, text })
})

test('C1: surrogate pair and multibyte at the slice boundary', () => {
  const base = sliceEnvelopes(head, 'a'.repeat(10))[0]
  const room = SLICE_BYTES - utf8Length(JSON.stringify({ ...base, text: '' }))
  for (let pad = room - 8; pad <= room + 8; pad++) {
    const text = 'a'.repeat(Math.max(0, pad)) + '😀é漢😀'.repeat(900)
    const envs = sliceEnvelopes(head, text)
    for (const env of envs) {
      assert.ok(utf8Length(JSON.stringify(env)) <= SLICE_BYTES)
      const first = env.text.charCodeAt(0)
      const last = env.text.charCodeAt(env.text.length - 1)
      assert.ok(!(last >= 0xd800 && last <= 0xdbff))
      assert.ok(!(first >= 0xdc00 && first <= 0xdfff))
    }
    const j = joinSlices(envs)
    assert.equal(j.ok, true)
    assert.equal(sha256Hex(j.text), ref(text))
  }
})

test('checkSlice', () => {
  const envs = sliceEnvelopes(head, planText())
  const want = { tool: 'progress', command: 'read', nonce: 'n1', slice: 1 }
  assert.equal(checkSlice(envs[1], want).ok, true)
  assert.equal(checkSlice(envs[1], { ...want, tool: 'x' }).ok, false)
  assert.equal(checkSlice(envs[1], { ...want, command: 'y' }).ok, false)
  assert.equal(checkSlice(envs[1], { ...want, nonce: 'n2' }).ok, false)
  assert.equal(checkSlice(envs[1], { ...want, slice: 2 }).ok, false)
  assert.equal(checkSlice({ ...envs[1], text: envs[1].text + 'x' }, want).ok, false)
  const m = sliceEnvelopes({ tool: 'progress', mode: 'read', nonce: 'n1' }, 'oi')
  assert.equal(checkSlice(m[0], { tool: 'progress', command: 'read', nonce: 'n1', slice: 0 }).ok, true)
})

test('joinSlices refusals', () => {
  const text = planText()
  const envs = sliceEnvelopes(head, text)
  assert.equal(joinSlices([]).ok, false)
  assert.equal(joinSlices(envs.slice(0, -1)).ok, false)
  assert.equal(joinSlices([envs[1], envs[0], ...envs.slice(2)]).ok, false)
  assert.equal(joinSlices([envs[0], ...envs.slice(2)]).ok, false)
  const other = sliceEnvelopes(head, text + 'mais')
  assert.equal(joinSlices([envs[0], other[1], ...envs.slice(2)]).ok, false)
  const bad = envs.map((e) => ({ ...e }))
  bad[2] = sign({ ...bad[2], digest: undefined, text: bad[2].text.replace('a', 'b') })
  assert.equal(joinSlices(bad).ok, false)
})

test('commandDigest', () => {
  assert.equal(commandDigest({ argv: ['a', 'b'] }), fnv1a(JSON.stringify(canon({ argv: ['a', 'b'] }))))
  assert.equal(commandDigest({ bash: 'ls -l' }), fnv1a(JSON.stringify(canon({ bash: 'ls -l' }))))
})

test('checkCapture', () => {
  const cmdDigest = commandDigest({ argv: ['x'] })
  const line = sign({ tool: 'capture', nonce: 'abc1', cmdDigest, data: { exit: 0 } })
  const opts = { nonce: 'abc1', cmdDigest }
  assert.deepEqual(checkCapture(JSON.stringify(line), opts), { ok: true, data: { exit: 0 } })
  assert.equal(checkCapture('x'.repeat(MAX_COPY_BYTES + 1), opts).ok, false)
  assert.equal(checkCapture('{nope', opts).ok, false)
  assert.equal(checkCapture(JSON.stringify(sign({ tool: 'other', nonce: 'abc1', cmdDigest, data: 1 })), opts).ok, false)
  assert.equal(checkCapture(JSON.stringify(sign({ tool: 'capture', error: 'boom', nonce: 'abc1' })), opts).ok, false)
  assert.equal(checkCapture(JSON.stringify(line), { ...opts, nonce: 'zzz' }).ok, false)
  assert.equal(checkCapture(JSON.stringify(line), { noncePrefix: 'zz', cmdDigest }).ok, false)
  assert.equal(checkCapture(JSON.stringify(line), { noncePrefix: 'abc', cmdDigest }).ok, true)
  assert.equal(checkCapture(JSON.stringify(line), { ...opts, cmdDigest: 'ffffffff' }).ok, false)
  assert.equal(checkCapture(JSON.stringify({ ...line, data: { exit: 1 } }), opts).ok, false)
})
