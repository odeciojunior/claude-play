// External-effect authorization. Items: "gate:<name>", "<E>:T<n>" and "<E>:AC<k>" (bare, bind on first use), "<E>:T<n>@<fp>", "<E>:AC<k>@<fp>", "checkout:<target>".
export function parseAuthorizeExternal(v) {
  if (v == null || v === '') return { items: [], error: null }
  if (!Array.isArray(v)) return { items: [], error: 'authorizeExternal must be a list of items such as "gate:G3", "E18:T4", "E18:AC1" or "checkout:<target>"' }
  const re = /^(gate:\S+|[A-Za-z][A-Za-z0-9-]*:(T|AC)[1-9]\d*(@[0-9a-f]{8})?|checkout:\S+)$/
  const bad = v.findIndex(i => typeof i !== 'string' || !re.test(i))
  if (bad !== -1) return { items: [], error: `authorizeExternal item not recognized: ${JSON.stringify(v[bad])}` }
  return { items: [...new Set(v)], error: null }
}
export function isAuthorized(items, item) { return (items || []).includes(item) }
// The item to ask for when an external task is not authorized yet (null when it may run). A missing flag counts as external.
export function externalHold(task, E, items, fp) {
  if (task.external === false) return null
  const bare = `${E}:T${task.n}`
  const bound = `${bare}@${fp}`
  return isAuthorized(items, bare) || isAuthorized(items, bound) ? null : bound
}
export function bindAuthorizations(items, E, fp) {
  const re = /^[^:]+:(T|AC)[1-9]\d*$/
  return (items || []).map(i => (i.startsWith(E + ':') && re.test(i) && i.indexOf('@') < 0 ? `${i}@${fp}` : i))
}
