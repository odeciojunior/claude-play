# roadmap-release workflow for Antigravity (agy): the Python twin of roadmap-release.js.
# Run by run_workflow(ScriptPath=..., Args={...}): the runtime compiles this file with top-level await, exposes the
# dict `args` and the functions agent(), parallel(), phase() and log(), and runs it once in a python3 process, without
# replaying cached agent() calls. The final JSON goes to stdout (`print(json.dumps(result))`).
# Python >= 3.8, standard library only. Every subprocess runs with shell=False (agy-bridge.py).
#
# Deterministic work (preflight discover, verify-run, spec-tool, plan-tool, roadmap.mjs, git, test-integrity) is done
# here by subprocess: 0 agent tokens. agent() is called only for cognitive stages, with the Gemini model of STAGE_MODELS.
# Nothing of the .js logic is copied: the pure functions of roadmap-release.js (the `// <pure>` block: card status,
# selection, holds, signature check) are evaluated by Node from that file (call_pure), the lib/*.mjs modules go through
# call_lib, the schemas and the test-integrity program come from roadmap-release.js (agy-bridge.py).
#
# ARGS: the vocabulary of roadmap-release.js (config, runToken, trackerCli, wtRoot, mode, deliverables, ...).
# minBudgetPerDeliverable is ignored: agy exposes no budget (an operator note says so).
# RETURN: { status, mode, operatorActions, resumeArgs, selection, results, ownerReview, truth, lastGood, reportPath, report }
# Modes: dry-run (this file), plan-only and run (not implemented yet: status "error").
import json
import os
import re

TRACKER_SUFFIX = '/skills/roadmap-tracker/scripts/roadmap.mjs'
RELEASE_JS_REL = 'skills/roadmap-release/workflow/roadmap-release.js'
PREFLIGHT_REL = 'skills/roadmap-release/scripts/preflight.mjs'
VERIFY_RUN_REL = 'skills/roadmap-release/scripts/verify-run.mjs'
MODES = ('run', 'plan-only', 'dry-run')

# The Gemini model of every cognitive stage with a fixed model (spec 7.4). Implementers have no entry: their model is
# agyModelFor(tier, effort) and the fix escalation is nextAgyTier. Mechanical stages (setup, sanitize, rollback,
# cleanup, test-integrity, script-runner) have no entry either: they are subprocesses.
STAGE_MODELS = {
    'spec-author': 'pro', 'plan-author': 'pro', 'spec-review': 'pro', 'spec-fix': 'pro', 'plan-review': 'pro',
    'task-reviewer': 'pro', 'final-reviewer': 'pro', 'conflict-review': 'pro', 'delta-review': 'pro',
    'gates-fix-review': 'pro', 'merge-fix-review': 'pro', 'resume-fix-review': 'pro',
    'discovery-donot': 'flash', 'gates': 'flash', 'evidence': 'flash', 'plan-fix': 'flash', 'final-fix': 'flash',
    'delta-fix': 'flash', 'gates-fix': 'flash', 'merge-fix': 'flash', 'sync': 'flash', 'resync': 'flash',
    'merge': 'flash', 'review-log': 'flash', 'docs': 'flash', 'report': 'flash',
}

_STR = {'type': 'string'}
_STRS = {'type': 'array', 'items': _STR}
S_DONOT = {'type': 'object', 'properties': {'donotHolds': {'type': 'array', 'items': {
    'type': 'object', 'properties': {'text': _STR, 'affects': _STRS}, 'required': ['text', 'affects']}}}, 'required': ['donotHolds']}

# The selection of roadmap-release.js (lines "TODAY .. heldAtStart/selection") as one expression over its pure functions.
# p: { disc, A, MODE, cfgRelease }. Returns { error } or the computed plan; disc.cards come back normalized.
PURE_SELECT_JS = r"""(() => {
  const { disc, A, MODE, cfgRelease } = p
  const INTEG = disc.integrationBranch
  const BASEBR = A.baseBranch || INTEG
  const TARGET = A.targetBranch || cfgRelease || disc.releaseBranch || `integracao/${disc.roadmapSlug}`
  const STATUSES = {
    integrated: disc.integratedStatuses,
    plan: disc.deliverableStatuses[2],
    executing: disc.deliverableStatuses[3],
    onBranch: disc.deliverableStatuses[4],
    discarded: disc.discardedStatus || 'discarded',
    blocked: disc.blockedStatus || 'blocked',
  }
  disc.cards.forEach(c => { c.cell = c.status; c.status = cardStatus(c.status, STATUSES); c.onTarget = onTargetEffective(c, STATUSES) })
  const STATUS_AFTER_MERGE = TARGET === INTEG ? STATUSES.integrated[0] : STATUSES.onBranch
  if (TARGET === INTEG && !A.allowIntegrationBranch) return { error: `targetBranch (${TARGET}) is the integrationBranch; pass allowIntegrationBranch: true to merge into it.` }
  if (disc.checkerExists === false) return { error: `checker ${disc.checker} does not exist` }
  const byId = Object.fromEntries(disc.cards.map(c => [c.id, c]))
  const heldMap = new Map((disc.donotHolds || []).flatMap(h => (h.affects || []).filter(id => byId[id]).map(id => [id, h.text])))
  const picked = selectDeliverables({
    cards: disc.cards, statuses: STATUSES, selector: A.deliverables,
    filters: { phase: A.phase, priority: A.priority, track: A.track },
    heldBy: MODE === 'plan-only' ? new Map() : heldMap,
    overrideDonot: A.overrideDonot, autoDeps: !!A.autoDeps, force: !!A.force, maxDeliverables: A.maxDeliverables,
  })
  if (picked.error) return { error: picked.error }
  const order = picked.order
  const noCriteria = order.filter(id => !(byId[id].acceptance || []).length)
  if (noCriteria.length) return { error: `discovery failed: no acceptance criteria extracted for ${noCriteria.join(', ')}` }
  const notes = [...picked.notes, ...(disc.donot || []).map(d => `roadmap "do not" restriction (check before running): ${d}`)]
  const interrupted = unfinishedOutside(disc.cards, STATUSES, order)
  for (const id of interrupted) notes.push(`${id}: interrupted merge on the target, outside this selection`)
  if (A.force) for (const id of order) if (isUnfinished(byId[id], STATUSES)) notes.push(`${id}: force does not apply to an interrupted merge: it is validated and documented first`)
  const isContract = d => d && (d.scope === 'contract' || d.scope === 'contrato')
  const pendContract = disc.pendingDecisions.filter(d => isContract(d) && d.id && d.deliverable).map(d => ({ id: d.id, deliverable: d.deliverable }))
  const startedByPending = disc.pendingDecisions.flatMap(d => (isContract(d) && Array.isArray(d.startedDependents) ? d.startedDependents : []))
  const holdOf = id => {
    const h = heldBy({ cards: disc.cards, selected: order, contractDecisions: pendContract, started: startedByPending }).get(id)
    return h ? holdReason(h) : ''
  }
  const heldAtStart = order.map(id => ({ id, reason: holdOf(id) })).filter(h => h.reason)
  const isDone = c => !!c && ((c.onTarget && !isUnfinished(c, STATUSES)) || c.status === STATUSES.discarded)
  const selection = { target: TARGET, base: BASEBR, integrationBranch: INTEG, readFrom: disc.readFrom, statusAfterMerge: STATUS_AFTER_MERGE, order, skippedUpfront: picked.skipped, held: heldAtStart, notes,
    deps: Object.fromEntries(order.map(id => [id, byId[id].deps.map(d => `${d}:${isDone(byId[d]) ? 'on target' : 'in this run'}`)])) }
  return { selection, order, interrupted, target: TARGET, base: BASEBR, integrationBranch: INTEG, statusAfterMerge: STATUS_AFTER_MERGE,
    statuses: STATUSES, cards: disc.cards, pendContract, startedByPending }
})()"""

# Node program of call_pure. stdin: { pure, expr, payload }; the expression sees every function (and const) of the
# `// <pure>` block of roadmap-release.js and the payload as `p`; the JSON of its value goes to stdout.
CALL_PURE_JS = """
(async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const fn = new Function('p', req.pure + '\\nreturn (' + req.expr + '\\n)');
  const out = await fn(req.payload);
  process.stdout.write(JSON.stringify(out === undefined ? null : out));
})().catch((e) => { process.stderr.write(String((e && e.stack) || e)); process.exit(1); });
"""

# State of one run (module level: the runtime executes this file once).
ROOT = None
A = {}
MODE = 'run'
OPS = []
RESULTS = []
_PURE_TEXT = None


def without_approve(a):
    """Resume args: approveRulings is typed by the person and never goes back (withoutApprove of the .js)."""
    if not isinstance(a, dict):
        return a
    return {k: v for k, v in a.items() if k != 'approveRulings'}


def op(kind, deliverable, what, do_now, resume_with, extra=None):
    d = {'kind': kind, 'deliverable': deliverable, 'what': what, 'doNow': do_now, 'resumeWith': without_approve(resume_with)}
    d.update(extra or {})
    OPS.append(d)


def mk_result(status, **extra):
    r = {
        'status': status, 'mode': MODE, 'operatorActions': OPS, 'resumeArgs': without_approve(A), 'selection': None,
        'results': RESULTS, 'ownerReview': {'acceptedRisks': [], 'decisionsPending': [], 'criteriaOpen': []},
        'truth': None, 'lastGood': None, 'reportPath': None, 'report': None,
    }
    r.update(extra)
    return r


def err(message, **extra):
    r = {'status': 'error', 'error': message}
    r.update(extra)
    return r


def _log(msg):
    f = globals().get('log')
    if callable(f):
        f(msg)


def _phase(title):
    f = globals().get('phase')
    if callable(f):
        f(title)


def _root_of(tracker_cli):
    """Plugin root from the tracker CLI path (pluginRootOf), before the bridge that has plugin_root_from is loaded."""
    if not isinstance(tracker_cli, str):
        return None
    p = tracker_cli.replace('\\', '/')
    return p[:-len(TRACKER_SUFFIX)] if p.endswith(TRACKER_SUFFIX) else None


def _load_bridge(root):
    bridge = root + '/scripts/agy-bridge.py'
    with open(bridge, encoding='utf-8') as f:
        src = f.read()
    exec(compile(src, bridge, 'exec'), globals())


def _pure_block(root):
    global _PURE_TEXT
    if _PURE_TEXT is None:
        with open(root + '/' + RELEASE_JS_REL, encoding='utf-8-sig') as f:
            lines = f.read().replace('\r\n', '\n').split('\n')
        start = next((i for i, ln in enumerate(lines) if ln.strip() == '// <pure>'), -1)
        end = next((i for i, ln in enumerate(lines) if ln.strip() == '// </pure>'), -1)
        if start == -1 or end < start:
            raise RuntimeError('pure markers not found in ' + RELEASE_JS_REL)
        _PURE_TEXT = '\n'.join(lines[start + 1:end])
    return _PURE_TEXT


def call_pure(root, expr, payload):
    """Evaluate a JS expression over the pure functions of roadmap-release.js (single source with the .js workflow)."""
    req = json.dumps({'pure': _pure_block(root), 'expr': expr, 'payload': payload}, ensure_ascii=True)
    r = run_cli(['node', '-e', CALL_PURE_JS], input=req)
    if r['exit'] != 0:
        raise RuntimeError('call_pure failed (exit %s): %s' % (r['exit'], r['stderr'].strip()))
    return json.loads(r['stdout'])


async def call_agent(role, prompt, schema, model=None, body=None):
    """One cognitive stage: the model comes from STAGE_MODELS unless given (implementer: agyModelFor / nextAgyTier).
    `body` (the agent .md body from load_agent_body) goes first in the prompt."""
    m = model or STAGE_MODELS[role]
    text = (body + '\n\n' + prompt) if body else prompt
    return await agent(text, schema, role=role, type_name='self', model=m)


def _check_run(stdout, tool, nonce):
    return call_pure(ROOT, 'checkRun(p.stdout, p.tool, p.nonce)', {'stdout': stdout, 'tool': tool, 'nonce': nonce})


def _read_disc(page, pre_target, prefix, token):
    argv = ['node', ROOT + '/' + PREFLIGHT_REL, 'discover', '--repo', A.get('repo') or '.']
    if A.get('roadmap'):
        argv += ['--roadmap', A['roadmap']]
    if pre_target:
        argv += ['--ref', pre_target]
    if A.get('baseBranch'):
        argv += ['--base', A['baseBranch']]
    if A.get('today'):
        argv += ['--today', A['today']]
    argv += ['--prefix', prefix, '--nonce', token]
    if page:
        argv += ['--page', str(page)]
    r = run_cli(argv)
    v = _check_run(r['stdout'], 'release-discovery', token)
    if v.get('ok'):
        return {'data': v['data']}
    why = v.get('why') or ''
    if not r['stdout'].strip() and r['stderr'].strip():
        why = r['stderr'].strip()
    return {'why': why}


def _discover(pre_target, prefix, token):
    """preflight.mjs discover by subprocess: signed pages assembled, signature and nonce checked. (disc, why)."""
    r0 = _read_disc(0, pre_target, prefix, token)
    disc = r0.get('data')
    if disc is None:
        return None, r0.get('why', '')
    if 'pages' in disc:
        n = disc['pages']
        count = disc.get('cardCount')
        if type(n) is not int or n < 1 or type(count) is not int:
            return None, 'the pages count of the discovery is not valid'
        cards = []
        for pg in range(1, n + 1):
            rp = _read_disc(pg, pre_target, prefix, token)
            d = rp.get('data')
            if d is None:
                return None, 'page %d: %s' % (pg, rp.get('why', ''))
            if d.get('page') != pg or d.get('pages') != n or not isinstance(d.get('cards'), list):
                return None, 'page %d is not the page asked for' % pg
            cards.extend(d['cards'])
        if len(cards) != count or len(set(c.get('id') for c in cards)) != len(cards):
            return None, 'the cards of the pages do not add up to the count of page 0'
        disc['cards'] = cards
    return disc, ''


def _donot_prompt(disc):
    items = '\n'.join('  * %s' % d for d in disc['donot'])
    cards = '\n'.join(
        '  * %s: %s%s' % (
            c['id'], c.get('title') or '',
            (' | criteria: ' + ' / '.join(str(a.get('text', '')) for a in c['acceptance'])) if c.get('acceptance') else '')
        for c in disc['cards'])
    return ('DO-NOT CHECK (read-only; change nothing). Return donotHolds: for each item below, { text: the item, affects: ids of the '
            'cards whose main object is exactly what the item forbids (read card title and criteria; "do not migrate X" only affects '
            'the card that migrates X; when in doubt, do not list) }.\nItems:\n%s\nCards:\n%s' % (items, cards))


def _validate_args(cfg, token):
    """The validation of roadmap-release.js, in its order, before any agent() call. Returns an error result or None."""
    root = _root_of(A.get('trackerCli'))
    if not isinstance(cfg, dict) or not isinstance(cfg.get('gates'), list) or not cfg['gates']:
        return err('args.config is missing or has no gates: run scripts/preflight.mjs and pass its config')
    if not token:
        return err('runToken is missing: launch the workflow through the roadmap-release skill, which runs scripts/preflight.mjs and passes its config, runToken and trackerCli')
    tc = A.get('trackerCli')
    if not isinstance(tc, str) or not tc.strip():
        return err('args.trackerCli is missing: run scripts/preflight.mjs and pass its trackerCli')
    if not root:
        return err('args.trackerCli does not end with %s: the plugin root cannot be derived' % TRACKER_SUFFIX)
    if plugin_root_from(tc, TRACKER_SUFFIX) != root:
        return err('the plugin root derived from args.trackerCli is inconsistent')
    if MODE not in MODES:
        return err('invalid mode: %s' % MODE)
    notes = A.get('notes') or {}
    unfilled = [k for k in notes if re.fullmatch(r'\s*<.*>\s*', str(notes[k]))]
    if unfilled:
        return err("notes still hold the template text, without the owner's answer: %s" % ', '.join(unfilled))
    if not A.get('wtRoot'):
        return err('args.wtRoot is missing: the skill passes <dirname(repo)>/<basename(repo)>-wt (or the folder the user named)')
    return None


async def main():
    global A, MODE, ROOT
    raw = globals().get('args')
    raw = raw if isinstance(raw, dict) else {}
    token_arg = raw.get('runToken')
    token = token_arg.strip() if isinstance(token_arg, str) else ''
    A = {k: v for k, v in raw.items() if k != 'runToken'}
    MODE = A.get('mode') or 'run'
    cfg = A.get('config')
    del OPS[:]
    del RESULTS[:]

    # parseAuthorizeExternal comes first in the .js; it needs the plugin root (lib/external-auth.mjs through call_lib).
    early_root = _root_of(A.get('trackerCli'))
    auth = {'items': [], 'error': None}
    if early_root:
        try:
            ROOT = early_root
            _load_bridge(early_root)
            auth = call_lib(early_root, 'parseAuthorizeExternal(p)', A.get('authorizeExternal'))
        except (OSError, RuntimeError) as e:
            return err('agy bridge unavailable: %s' % e)
        if auth.get('error'):
            return err(auth['error'])
    bad = _validate_args(cfg, token)
    if bad:
        return bad
    items = auth.get('items') or []
    authorized = lambda item: item in items

    gates = [g for g in cfg['gates'] if not g.get('restricted') or authorized('gate:' + g.get('name', ''))]
    for g in [g for g in cfg['gates'] if g.get('restricted') and not authorized('gate:' + g.get('name', ''))]:
        if MODE != 'run':
            continue
        item = 'gate:' + g['name']
        op('authorize-external', None, 'the gate "%s" is restricted (it touches something outside the branch) and was not measured: %s' % (g['name'], g.get('cmd')),
           'Authorize it by running again with authorizeExternal including "%s". The authorization applies only to deliverables merged after it: it measures nothing for deliverables already merged. Once authorized, the gate runs several times per deliverable: baseline, branch, post-merge and retries' % item,
           dict(A, authorizeExternal=items + [item]), {'item': item})
    if not gates:
        return err('every gate is restricted and none is authorized: pass authorizeExternal with "gate:<name>" items', operatorActions=OPS)
    if 'minBudgetPerDeliverable' in A:
        op('note', None, 'minBudgetPerDeliverable is ignored in agy: the runtime exposes no token budget, so nothing is checked before the preflight',
           'No action needed; remove minBudgetPerDeliverable from the args or keep it for the Claude Code workflow', A)

    root = ROOT
    try:
        SCHEMAS = load_js_schemas(root + '/' + RELEASE_JS_REL)  # shared with the .js; used by the stages of later modes
    except (OSError, RuntimeError) as e:
        return err('schemas of roadmap-release.js unavailable: %s' % e)
    globals()['SCHEMAS'] = SCHEMAS

    # ---- discovery
    _phase('Discovery')
    prefix = A.get('branchPrefix') or 'feat/'
    pre_target = A.get('targetBranch') or cfg.get('releaseBranch') or ''
    try:
        disc, why = _discover(pre_target, prefix, token)
    except (OSError, RuntimeError, ValueError) as e:
        return err('discovery failed: %s' % e)
    if not disc:
        return err('discovery failed: %s' % why)
    if not disc.get('cards'):
        return err('discovery failed: no cards')
    no_merge = [c.get('id') for c in disc['cards'] if not isinstance(c.get('mergeFound'), bool)]
    if no_merge:
        return err('discovery failed: mergeFound not reported for %s' % ', '.join(str(x) for x in no_merge))
    if not (A.get('repo') or disc.get('repo')):
        return err('discovery failed: repo not reported')
    for f in ('integrationBranch', 'integratedStatuses', 'deliverableStatuses', 'roadmapDir', 'strategy', 'checker'):
        v = disc.get(f)
        if not v:
            return err('discovery failed: %s not reported' % f)
    if not isinstance(disc.get('pendingDecisions'), list):
        return err('discovery failed: pendingDecisions is not a list')
    if not isinstance(disc.get('language'), str):
        return err('discovery failed: language not reported')
    if len(disc['deliverableStatuses']) < 5:
        return err('discovery failed: deliverableStatuses not reported (needs at least 5 items)')
    if not (A.get('today') or disc.get('today')):
        return err('discovery failed: today not reported')
    for c in disc['cards']:
        c['deps'] = c.get('deps') or []
        c['reqs'] = c.get('reqs') or []
    # "Do not" items are a judgement, not code: one flash call, only when the roadmap has any.
    if disc.get('donot'):
        dn = await call_agent('discovery-donot', _donot_prompt(disc), S_DONOT)
        if not isinstance(dn, dict) or not isinstance(dn.get('donotHolds'), list):
            return err('discovery failed: the do-not check returned nothing')
        disc['donotHolds'] = dn['donotHolds']

    # ---- selection
    sel_args = {k: A[k] for k in ('baseBranch', 'targetBranch', 'deliverables', 'phase', 'priority', 'track', 'overrideDonot',
                                   'autoDeps', 'force', 'maxDeliverables', 'allowIntegrationBranch', 'today', 'repo') if k in A}
    try:
        plan = call_pure(root, PURE_SELECT_JS, {'disc': disc, 'A': sel_args, 'MODE': MODE, 'cfgRelease': cfg.get('releaseBranch')})
    except (OSError, RuntimeError, ValueError) as e:
        return err('selection failed: %s' % e)
    if plan.get('error'):
        return err(plan['error'])
    selection = plan['selection']
    _log('selection: %s' % (' -> '.join(plan['order']) or '(empty)'))
    if MODE == 'dry-run' or not plan['order']:
        return mk_result('done' if plan['order'] else 'partial', selection=selection)
    return mk_result('error', error='mode not implemented yet: %s runs in a later task of the agy workflow' % MODE, selection=selection)


RESULT = await main()
print(json.dumps(RESULT, ensure_ascii=True))
