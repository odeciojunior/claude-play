export const meta = {
  name: 'probe-run',
  description: 'Consent probe: one tiny agent that answers OK',
}

const reply = await agent('Reply with the single word OK. Use no tools.', { label: 'probe', model: 'haiku' })
return { ok: true, reply, args: args ?? null }
