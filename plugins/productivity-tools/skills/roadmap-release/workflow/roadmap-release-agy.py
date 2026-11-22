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
# Modes: dry-run, plan-only (preflight steps 1, 2 and 5, setup by git, spec and plan with their review loops, the roadmap record)
# and run (not implemented yet: status "error"). The report stage of plan-only comes with the merge task: `report` is None.
import inspect
import json
import os
import re
import shutil

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


# ======================================================================== plan-only (pieces that run mode reuses)
# The roadmap record: recordCommands assembles the exact tracker CLI commands, the chunks are signed groups for verify-run.mjs
# (run by subprocess, idempotent by nonce). Same expression as the .js recordStatus, over the same pure functions.
PURE_RECORD_JS = r"""(() => {
  const rc = recordCommands({ cli: p.cli, folder: p.folder, E: p.E, word: p.status, piece: p.piece, blockedBy: p.blockedBy, evidence: p.refs, logWhat: p.reason,
    decisions: rulingDecisions(p.rulings), pending: p.pending, inflight: p.inflight, skipStatus: p.skip, lang: p.lang, cellChars: p.cellChars, source: p.source, blockedStatus: p.blockedStatus })
  if (rc.error) return { error: rc.error }
  const msg = phrases(p.lang).commit(p.E, p.status)
  const grp = (k, steps) => ({ nonce: `${p.tag}:${p.E}:${p.status}:${k}`, cwd: p.intwt, steps, finally: { commit: { add: [p.rm], message: [msg, p.trailer] } } })
  const grpCmd = g => `node "${p.verify}" group ${encArg(g)}`
  const chunks = []
  for (const s of rc.commands) {
    const k = chunks.length - 1
    if (k >= 0 && grpCmd(grp(k, [...chunks[k], s])).length <= p.cap) chunks[k].push(s)
    else chunks.push([s])
  }
  const big = chunks.map((c, k) => grpCmd(grp(k, c)).length).find(n => n > p.cap)
  return { commands: rc.commands, cuts: rc.cuts || [], big: big === undefined ? null : big,
    groups: chunks.map((c, k) => { const g = grp(k, c); return { nonce: g.nonce, arg: encArg(g) } }) }
})()"""

# Findings the code itself computes over a plan load (evidence, external flags, numbering, locks).
PURE_PLAN_GAPS_JS = r"""(() => {
  const gap = description => ({ severity: 'critical', category: 'defeito', description })
  const tasks = p.plan.tasks || []
  const locks = p.taskLocks || []
  return [
    ...evidenceGaps(p.cardAc, p.plan.ac, p.blq),
    ...externalGaps(tasks),
    ...evidenceExternalGaps(p.cardAc, p.plan.ac),
    ...tasks.filter((t, i) => t.n !== i + 1).map(t => gap(`task numbers must run 1..N in order (found ${t.n} at position ${tasks.indexOf(t) + 1})`)),
    ...tasks.flatMap(t => [].concat(t.needsLock || []).filter(n => !locks.includes(n)).map(n => gap(`task ${t.n} needs the unknown lock "${n}" (configured: ${locks.join(', ') || 'none'})`))),
  ]
})()"""

# Last status word and piece of every card, from the discovery (lastWord / pieceOf of the .js).
PURE_LAST_WORD_JS = r"""Object.fromEntries(p.cards.map(c => {
  const segs = statusSegments(c.cell)
  const piece = segs.some(sg => sg.label) ? 'code' : ''
  const sg = piece ? segs.find(x => /^(code|c[oó]digo)$/.test(x.label)) : segs[0]
  return [c.id, { piece, status: sg ? sg.status : '' }]
}))"""

# The resume args of the final result and of every operator action (settleAuth / finalResume of the .js).
PURE_RESUME_JS = r"""(() => {
  const settle = items => {
    const done = p.results.filter(r => r.merged && !r.broken).map(r => r.id)
    const bound = dropStaleBound(Object.keys(p.bound).reduce((acc, id) => bindAuthorizations(acc, id, p.bound[id]), items), p.bound)
    return bound.filter(i => !done.some(id => i.startsWith(id + ':T') || i.startsWith(id + ':AC')))
  }
  const ops = p.ops.map(o => {
    let r = o.resumeWith
    if (r && Array.isArray(r.authorizeExternal)) r = { ...r, authorizeExternal: settle([...new Set(r.authorizeExternal)]) }
    if (r) r = withoutApprove(dropConsumedNotes(r, p.notesRead))
    return { ...o, resumeWith: r }
  })
  const base = withoutApprove(dropConsumedNotes(p.resumeArgs || p.A, p.notesRead))
  let resume = base
  if (p.A.authorizeExternal) {
    const settled = settle(p.items)
    resume = { ...base, authorizeExternal: p.resumeIds.length ? settled : settled.filter(i => !/^(gate|checkout):/.test(i)) }
  }
  return { ops, resume }
})()"""

CMD_CAP = 6000
NO_ASK = 'Never ask the person anything: no question, no AskUserQuestion, no choice handed back in your answer. Take the recommended option, record it and go on.'


class ReadOnlyViolation(Exception):
    pass


class _Run(object):
    """State of one run (the constants and tables the .js keeps as module consts)."""


R = _Run()


def slash(p):
    return str(p).replace('\\', '/')


def as_list(v):
    return [] if v is None or v == '' else (v if isinstance(v, list) else [v])


def int_arg(v, d, mn):
    return v if type(v) is int and v >= mn else d


def pure(expr, payload=None):
    return call_pure(ROOT, expr, payload)


def git_in(d, *argv):
    return run_cli(['git', '-C', d] + [str(a) for a in argv])


def worktrees(repo):
    """[{path, branch}] of git worktree list --porcelain (forward slashes, branch without refs/heads/)."""
    r = git_in(repo, 'worktree', 'list', '--porcelain')
    out = []
    cur = None
    for ln in r['stdout'].splitlines():
        if ln.startswith('worktree '):
            cur = {'path': slash(ln[len('worktree '):].strip()), 'branch': ''}
            out.append(cur)
        elif ln.startswith('branch ') and cur is not None:
            b = ln[len('branch '):].strip()
            cur['branch'] = b[len('refs/heads/'):] if b.startswith('refs/heads/') else b
    return out


def same_path(a, b):
    def n(p):
        x = slash(p).rstrip('/')
        return x.lower() if re.match(r'^[A-Za-z]:', x) else x
    return n(a) == n(b)


def commit_file(wt, rel, subject):
    """The mechanical commit of one file: only `rel` enters it; nothing changed means no commit. Returns S_COMMITTED."""
    a = git_in(wt, 'add', '--', rel)
    if a['exit'] != 0:
        return {'ok': False, 'error': 'git add failed: %s' % a['stderr'].strip()}
    names = git_in(wt, 'diff', '--cached', '--name-only', '--', rel)
    commit = ''
    if names['exit'] == 0 and names['stdout'].strip():
        c = git_in(wt, 'commit', '-q', '-m', subject, '-m', R.trailer)
        if c['exit'] != 0:
            return {'ok': False, 'error': 'git commit failed: %s' % (c['stderr'].strip() or c['stdout'].strip())}
        commit = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
    head = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
    pending = git_in(wt, '--no-optional-locks', 'status', '--porcelain', '--', rel)['stdout'].strip()
    blob = git_in(wt, 'rev-parse', 'HEAD:' + rel)
    return {'ok': True, 'head': head, 'commit': commit, 'pending': pending, 'blob': blob['stdout'].strip() if blob['exit'] == 0 else ''}


def commit_checked(wt, rel, subject):
    """commit_file, once more when the file is still pending after an empty commit; then an error."""
    def left(c):
        return c['pending'] if c.get('ok') and not c.get('commit') else ''
    cm = commit_file(wt, rel, subject)
    if not left(cm):
        return cm
    cm = commit_file(wt, rel, subject)
    return {'ok': False, 'error': '%s still pending after an empty commit: %s' % (rel, left(cm))} if left(cm) else cm


# ---------------------------------------------------------------- the review loop (runReviewLoop of the .js)
async def _call(f, *a):
    v = f(*a)
    return await v if inspect.isawaitable(v) else v


def _next_tier(model, same):
    return call_lib(ROOT, 'nextAgyTier(p.m, p.s)', {'m': model, 's': same})


def _hard(iss, blq):
    return pure('p.iss.filter(i => isHard(i, p.blq))', {'iss': iss, 'blq': blq})


async def run_review_loop(env, stage, review, fix, truth, opt=None):
    """One review/fix cycle. env = { maxFix, blqIds, reviews, concerns, acceptRisks(stage, issues) }.
    review(round, prev, reviewer, extra) -> review dict | None; fix(issues, k, tier) -> dict | None; truth(review) -> issues.
    A finding that reappears after a fix escalates the fixer one step of nextAgyTier (flash_lite -> flash -> pro); the first
    escalation earns one extra round; a repeat at pro (nextAgyTier is None) ends the stage with a controlled failure,
    { ok: False, kind, msg }, never a loop. Every review runs on pro. Same rounds, maxFixRounds, repeat and `once`
    semantics as runReviewLoop of roadmap-release.js."""
    opt = opt or {}
    tier = opt.get('tier') or 'pro'
    rm = opt.get('reviewModel') or 'pro'
    blq = list(env.get('blqIds') or [])
    rounds = []

    def note(rnd, fix_tier=None, model=None):
        rounds.append({'round': rnd, 'reviewModel': model or rm, 'fixTier': fix_tier})

    def record(r, iss=None):
        c = pure('compact(p)', (r or {}).get('issues') if r else None)
        e = {'stage': stage, 'rounds': rounds}
        e.update(c)
        e['unresolved'] = iss or []
        env['reviews'].append(e)

    def kind_of(hard):
        return 'decisao' if any(i.get('category') == 'decisao' for i in hard) else 'conteudo'

    def fmt(iss):
        return pure('fmt(p)', iss)

    r = await _call(review, 1, None, rm, None)
    note(1)
    if not r:
        r = await _call(review, '1b', None, rm, None)
        note('1b')
    if not r:
        record(r)
        return {'ok': False, 'kind': 'infra', 'msg': '%s: null review' % stage}
    iss = truth(r)
    lim = min(1, env['maxFix']) if opt.get('once') else env['maxFix']
    bonus = False
    k = 1
    while iss and env['maxFix'] > 0 and k <= lim + (1 if bonus else 0):
        fixable = _hard(iss, blq)  # ambiente / fora-do-escopo / pelo-plano do not spend a fix
        if not fixable:
            break
        fx = await _call(fix, fixable, k, tier)
        if not fx:
            record(r, iss)
            return {'ok': False, 'kind': 'infra', 'msg': '%s: null fix' % stage}
        if fx.get('status') == 'BLOCKED':
            record(r, iss)
            return {'ok': False, 'kind': 'conteudo', 'msg': '%s: fix BLOCKED: %s' % (stage, fx.get('summary'))}
        if fx.get('concerns'):
            env['concerns'].append('%s fix%s: %s' % (stage, k, fx['concerns']))
        if opt.get('haltOn') and opt['haltOn'](fx):
            record(r, iss)
            return {'ok': False, 'halted': fx}
        fix_tier = tier
        r = await _call(review, k + 1, fmt(iss), rm, {'iss': fixable, 'head': r.get('headSha')})
        note(k + 1, fix_tier, rm)
        if not r:
            record(r, iss)
            return {'ok': False, 'kind': 'infra', 'msg': '%s: null re-review' % stage}
        iss = truth(r)
        if pure('sameFinding(p.prev, p.iss, p.blq, p.byId)', {'prev': fixable, 'iss': iss, 'blq': blq, 'byId': opt.get('byId')}):
            up = _next_tier(tier, True)
            if not up:
                record(r, iss)
                hard = _hard(iss, blq)
                return {'ok': False, 'kind': kind_of(hard), 'msg': '%s: the same finding reappeared after a fix at %s and there is no higher tier:\n%s' % (stage, tier, fmt(hard))}
            tier = up
            bonus = not opt.get('once')
        k += 1
    record(r, iss)
    if not iss:
        return {'ok': True, 'r': r}
    hard = _hard(iss, blq)
    if hard:
        return {'ok': False, 'kind': kind_of(hard), 'msg': '%s has open issues after %s fixes:\n%s' % (stage, lim, fmt(hard))}
    env['acceptRisks'](stage, iss)
    return {'ok': True, 'r': r}


# ---------------------------------------------------------------- run state and preflight (plan-only steps 1, 2 and 5)
def init_run(disc, plan, cfg, token, items, gates):
    R.disc = disc
    R.cfg = cfg
    R.items = items
    R.gates = gates
    R.repo = A.get('repo') or disc.get('repo')
    R.wt = slash(A['wtRoot']).rstrip('/')
    R.rm = disc['roadmapDir']
    R.strat = disc['strategy']
    R.integ = plan['integrationBranch']
    R.target = plan['target']
    R.base = plan['base']
    R.statuses = plan['statuses']
    R.cards = plan['cards']
    R.by_id = {c['id']: c for c in R.cards}
    R.order = plan['order']
    R.pend_contract = plan['pendContract']
    R.started = plan['startedByPending']
    R.dyn_contract = []
    R.begun = []
    R.lang = disc.get('language') or ''
    cc = disc.get('cellChars')
    R.cell_chars = cc if type(cc) is int and cc > 0 else 300
    R.trailer = A.get('trailer') or 'Co-Authored-By: Claude <noreply@anthropic.com>'
    R.maxfix = int_arg(A.get('maxFixRounds'), 2, 0)
    R.prefix = A.get('branchPrefix') or 'feat/'
    R.blq = [b['id'] for b in (disc.get('blockers') or []) if isinstance(b, dict) and b.get('id')]
    R.run_tag = call_lib(ROOT, 'fnv1a(p)', token)
    R.lock_order = ['merge'] + [n for n in as_list(cfg.get('locks')) if n != 'merge']
    R.task_locks = [n for n in R.lock_order if n != 'merge']
    R.project = cfg.get('projectContext') or ''
    R.today = A.get('today') or disc.get('today')
    R.verify_run = ROOT + '/' + VERIFY_RUN_REL
    R.last_word = pure(PURE_LAST_WORD_JS, {'cards': R.cards})
    R.bound = {}
    R.notes_read = []
    R.integ_broken = None
    R.int_wt = None
    R.last_good = None
    R.foreign = False
    R.foreign_ok = False
    R.foreign_item = 'checkout:' + R.target
    R.pre = None


def _env_facts():
    bits = []
    for name, argv in (('git', ['git', '--version']), ('node', ['node', '--version'])):
        r = run_cli(argv)
        bits.append('%s %s' % (name, r['stdout'].strip() if r['exit'] == 0 and r['stdout'].strip() else 'not found'))
    bits.append('bash: %s' % (find_git_bash() or 'not found'))
    bits.append('os: %s' % ('windows' if os.name == 'nt' else 'posix'))
    return '; '.join(bits)


def preflight_plan_only():
    """Steps 1, 2 and 5 of the preflight of plan-only mode, by git: the target branch, the integration worktree, envFacts.
    Returns S_PRE-shaped data: { ok, errorKind?, error?, integrationWorktree, targetHead, clean, envFacts }. No baseline."""
    target, repo = R.target, R.repo
    r = git_in(repo, 'rev-parse', '--verify', '--quiet', 'refs/heads/' + target)
    if r['exit'] != 0:
        b = git_in(repo, 'branch', target, R.base)
        if b['exit'] != 0:
            return {'ok': False, 'errorKind': 'target', 'error': 'the branch %s does not exist and could not be created from %s: %s' % (target, R.base, b['stderr'].strip())}
    git_in(repo, 'config', 'rerere.enabled', 'true')
    found = [w for w in worktrees(repo) if w['branch'] == target]
    if found:
        intwt = found[0]['path']
    else:
        intwt = R.wt + '/_integracao'
        w = git_in(repo, 'worktree', 'add', intwt, target)
        if w['exit'] != 0:
            return {'ok': False, 'errorKind': 'other', 'error': 'worktree add %s failed: %s' % (intwt, w['stderr'].strip())}
    R.foreign = not pure('isOwnWorktree(p.path, p.wt)', {'path': intwt, 'wt': R.wt})
    R.foreign_ok = R.foreign_item in R.items
    facts = _env_facts()
    if R.foreign and not R.foreign_ok:  # the person's own checkout, not authorized: touch nothing in it
        head = git_in(intwt, 'rev-parse', 'HEAD')['stdout'].strip()
        return {'ok': True, 'integrationWorktree': intwt, 'targetHead': head, 'envFacts': facts}
    if not R.foreign:
        mp = git_in(intwt, 'rev-parse', '--git-path', 'MERGE_MSG')
        if mp['exit'] == 0 and mp['stdout'].strip():
            f = mp['stdout'].strip()
            f = f if os.path.isabs(f) else os.path.join(intwt, f)
            try:
                with open(f, encoding='utf-8', errors='replace') as fh:
                    msg = fh.read()
            except OSError:
                msg = ''
            if re.match(r'^merge: E', msg):  # an interrupted merge of a previous run: abort it, only here
                git_in(intwt, 'merge', '--abort')
    st = git_in(intwt, '--no-optional-locks', 'status', '--porcelain')
    if st['exit'] != 0 or st['stdout'].strip():
        return {'ok': False, 'errorKind': 'dirty', 'error': 'the integration worktree %s is not clean: %s' % (intwt, st['stdout'].strip() or st['stderr'].strip()), 'integrationWorktree': intwt}
    head = git_in(intwt, 'rev-parse', 'HEAD')['stdout'].strip()
    return {'ok': True, 'integrationWorktree': intwt, 'targetHead': head, 'clean': True, 'envFacts': facts}


# ---------------------------------------------------------------- shared briefing (the FIXED RULES of the prompts)
def _gate_desc(g):
    locks = as_list(g.get('needsLock'))
    return '%s (%s%s%s): %s' % (g.get('name'), g.get('kind'), ', invariant' if g.get('invariant') else '', (', needs lock ' + '+'.join(locks)) if locks else '', g.get('cmd'))


def _rule_lines():
    d, rm, tgt, integ = R.disc, R.rm, R.target, R.integ
    return {
        'git': '- Git: commits only on your deliverable branch (or on the target %s, only in the record, merge and docs stages). NEVER push, except the effect of a task you were told is external and AUTHORIZED. NEVER touch the branch %s%s or the worktree %s, except the integration worktree of the target when the operator authorized checkout:%s. NEVER use git stash or git add -A: add only your task\'s files. Commit messages end with the line "%s".' % (tgt, integ, (' outside the merge/docs stages' if tgt == integ else ''), R.repo, tgt, R.trailer),
        'rm': '- Delivery branches do NOT edit the roadmap folder %s (that is done only in the record and docs stages, on the target).' % rm,
        'clean': '- When done, the working tree must be clean (git status --porcelain empty). Line-ending-only differences: git checkout -- <file>.',
        'tmp': '- Temporary files only in %s/_tmp/<your label>/ (create and delete when done). Nothing loose in %s/. Scripts: write them to a file and run it; one simple command per call: no heredoc, no loop, no chaining with \'&&\' or \';\'. Write files with the Write tool and commit with git commit -F <file>.' % (R.wt, R.wt),
        'proc': '- Processes: start servers only if the task needs them, in your deliverable\'s port range; stop everything you started before returning.',
        'locks': '- Shared resources: only agents told they HOLD a lock may use the resource that lock protects (%s). Without the lock and needing it: return BLOCKED with needsLock=<name>.' % ', '.join(R.lock_order),
        'ext': "- NEVER perform an external effect (production, deploy, push, sending e-mail or messages, writing shared data, resetting or rolling back someone's checkout) unless your task is marked external and authorized; when in doubt it is external.",
    }


def common_base():
    d = R.disc
    ln = _rule_lines()
    donot = '\n'.join('  * %s' % x for x in (d.get('donot') or [])) or '  (none)'
    blockers = '\n'.join('%s: %s' % (b.get('id'), b.get('text')) for b in (d.get('blockers') or [])) or '(none)'
    gates_txt = '; '.join(_gate_desc(g) for g in R.gates)
    conflict = ('- Conflicts in generated files: %s\n' % R.cfg['conflictRules']) if R.cfg.get('conflictRules') else ''
    return '\n'.join([
        '',
        'FIXED RULES:',
        '- Tracked roadmap in %s (strategy: %s). Registered decisions (%sdecisions.md and those cited in the PROJECT block, or the file it points to) are NEVER reopened or contradicted.' % (R.rm, R.strat, R.rm),
        '- The owner PRE-APPROVED: when a skill asks for confirmation or a choice, take the recommended option, record it and go on, except a strategy revision or migration and any external effect. Asking the user is FORBIDDEN (do not use AskUserQuestion).',
        '- Inputs only humans can provide: do not invent the data; use a configurable placeholder or a marked synthetic fixture and report it in humanInputs. Authorization of an external effect is never a humanInput: the workflow asks the person for it when it reaches a plan task or an acceptance-evidence row declared external. Open roadmap blockers:',
        blockers,
        '  Human acts also include: sessions with users, acceptances, owner approvals, go/no-go, credentials and external accounts. Produce the artifacts; never record a fictional acceptance.',
        '- Roadmap "do not" restrictions (violating any is category decisao, severity critical):',
        donot,
        ln['git'], ln['rm'], ln['clean'], ln['tmp'], ln['proc'], ln['locks'],
        '- Canonical gates: %s.' % gates_txt,
        '- Reviewers classify each problem with category: defeito (bug or unmet criterion), decisao (contradicts a registered decision), ambiente (limit of the local environment, not of the code; when a roadmap blocker is registered, cite its id in blq), fora-do-escopo (only a PRE-EXISTING problem outside the deliverable), pelo-plano (the plan foresaw it). A defect introduced by this diff is never fora-do-escopo nor pelo-plano. Excess scope is a defect.',
        ln['ext'],
        '- Autonomous decisions follow the recommended option and are recorded for the owner (Origin executor, status pending). Contradicting a registered decision, or changing a canonical gate (its command, kind or threshold), is category decisao, severity critical.',
        '- Write code and generated artifacts in the language of the roadmap, consistent with the project.',
        conflict + 'PROJECT:',
        R.project,
    ])


def common_slim():
    ln = _rule_lines()
    conflict = ('- Conflicts in generated files: %s\n' % R.cfg['conflictRules']) if R.cfg.get('conflictRules') else ''
    return '\n'.join([
        '',
        'FIXED RULES (mechanical stage):',
        ln['git'], ln['rm'],
        "- Never write or quote a credential, token or key in any file, commit message, log or report; write 'provided through environment variable <NAME>' instead.",
        ln['clean'], ln['tmp'], ln['proc'], ln['locks'], ln['ext'],
        '- Asking the user is FORBIDDEN (do not use AskUserQuestion).',
        conflict + 'PROJECT:',
        R.project,
        'ENVIRONMENT MEASURED IN THE PREFLIGHT: %s' % (R.pre.get('envFacts') or '(not reported)'),
        "INTEGRATION WORKTREE %s: %s." % (R.int_wt, ("the person's own checkout (%s %s)" % (R.foreign_item, 'authorized by the operator' if R.foreign_ok else 'NOT authorized: do not touch it')) if R.foreign else 'created by this workflow'),
    ])


def repeat_rule():
    return 'If an item of the previous round is still unresolved, report it again with the exact same file and description as listed (same wording), so the script can detect the repeat; do not reword it.'


# ---------------------------------------------------------------- the roadmap record (roadmap.mjs through verify-run.mjs, by subprocess)
def _enc_arg(obj):
    return pure('encArg(p)', obj)


def _read_back(E, piece):
    """verify-run.mjs read: status, brief, pending-decisions, head and porcelain of the integration worktree, signed."""
    for k in range(2):
        R.read_seq = getattr(R, 'read_seq', 0) + 1
        nonce = '%s:%s:read%d' % (R.run_tag, E, R.read_seq)
        payload = {'nonce': nonce, 'cwd': R.int_wt, 'cli': A['trackerCli'], 'folder': R.abs_folder, 'deliverable': E}
        if piece:
            payload['piece'] = piece
        r = run_cli(['node', R.verify_run, 'read', _enc_arg(payload)])
        v = _check_run(r['stdout'], 'verify-run', nonce)
        if v.get('ok') and v['data'].get('mode') == 'read':
            return v['data']
    return None


def hold_unconfirmed(E, rulings, ids):
    """A failed or unconfirmed record of a contract ruling still holds the dependents (holdUnconfirmed of the .js)."""
    scopes = pure('rulingDecisions(p).map(r => r.scope)', rulings or [])
    for i, sc in enumerate(scopes):
        if sc != 'contrato':
            continue
        rid = ids[i] if i < len(ids) and ids[i] else 'unconfirmed contract ruling of %s%s' % (E, (' #%d' % i) if i else '')
        if not any(d['id'] == rid for d in R.dyn_contract):
            R.dyn_contract.append({'id': rid, 'deliverable': E})


def record_status(E, status, refs, extra=None):
    """Records one status of deliverable E through the tracker CLI; the verdict is computed over raw outputs only (recordStatus of
    the .js). Serialized by construction: the workflow runs one deliverable at a time. Returns { ok, failures, head, cuts } or None."""
    if R.integ_broken:
        return None
    x = extra or {}
    c = R.by_id[E]
    lw = R.last_word.get(E) or {'piece': '', 'status': ''}
    piece, cur = lw['piece'], lw['status']
    blocked_by = None
    if cur == R.statuses['blocked'] and status != R.statuses['blocked']:
        m = re.search(r'\bBLQ-\d+\b', c.get('cell') or '')
        if m:
            bl = next((b for b in (R.disc.get('blockers') or []) if b.get('id') == m.group(0)), {})
            blocked_by = {'id': m.group(0), 'affects': bl.get('affects') or [E]}
    payload = {'cli': A['trackerCli'], 'folder': R.abs_folder, 'E': E, 'status': status, 'piece': piece, 'refs': refs, 'rulings': x.get('rulings') or [],
               'skip': cur == status, 'lang': R.lang, 'cellChars': R.cell_chars, 'source': x.get('source') or (R.rm + 'state.md'),
               'blockedStatus': R.statuses['blocked'], 'tag': R.run_tag, 'intwt': R.int_wt, 'rm': R.rm, 'trailer': R.trailer, 'verify': R.verify_run, 'cap': CMD_CAP}
    for k_in, k_out in (('reason', 'reason'), ('pending', 'pending'), ('inflight', 'inflight')):
        if x.get(k_in) is not None:
            payload[k_out] = x[k_in]
    if blocked_by:
        payload['blockedBy'] = blocked_by
    pl = pure(PURE_RECORD_JS, payload)
    if pl.get('error'):
        hold_unconfirmed(E, x.get('rulings'), [])
        return {'ok': False, 'failures': [pl['error']], 'head': None, 'cuts': []}
    if pl.get('big'):
        hold_unconfirmed(E, x.get('rulings'), [])
        return {'ok': False, 'failures': ['a single record step makes a command of %s characters, above the limit of %s: not dispatched' % (pl['big'], CMD_CAP)], 'head': None, 'cuts': pl['cuts']}
    results = {'runs': []}
    for g in pl['groups']:
        # the group is idempotent by nonce (verify-run.mjs): a second run of the same command returns the first output
        v = {'ok': False}
        for _ in range(2):
            r = run_cli(['node', R.verify_run, 'group', g['arg']])
            v = _check_run(r['stdout'], 'verify-run', g['nonce'])
            if v.get('ok') and v['data'].get('mode') == 'group' and isinstance(v['data'].get('steps'), list):
                break
            v = {'ok': False}
            try:
                o = json.loads(r['stdout'])
            except ValueError:
                o = None
            if isinstance(o, dict) and o.get('tool') == 'verify-run' and o.get('error') is not None and o.get('nonce') == g['nonce']:
                break  # a refusal of this very group is final
        if not v.get('ok'):
            results = None
            break
        for s in v['data']['steps']:
            results['runs'].append({'n': len(results['runs']) + 1, 'exit': s.get('exit'), 'stdout': s.get('out')})
        if v['data'].get('stopped') or any(s.get('exit') != 0 for s in v['data']['steps']):
            break
    read = _read_back(E, piece)
    if not results or not read:
        hold_unconfirmed(E, x.get('rulings'), [])
        return {'ok': False, 'failures': ['null record result' if not results else 'null re-read'], 'head': None, 'cuts': pl['cuts']}
    v = pure('recordVerdict(p)', {'expected': pl['commands'], 'results': results, 'read': read, 'E': E, 'word': status, 'piece': piece, 'blockedStatus': R.statuses['blocked']})
    failures = v['failures'] if pl['commands'] else [f for f in v['failures'] if f != 'the record agent ran no command']
    ok = not failures
    if ok:
        rds = pure('rulingDecisions(p)', x.get('rulings') or [])
        for i, did in enumerate(v.get('decisionIds') or []):
            if i < len(rds) and rds[i].get('scope') == 'contrato' and did in (v.get('holdIds') or []) and not any(d['id'] == did for d in R.dyn_contract):
                R.dyn_contract.append({'id': did, 'deliverable': E})
        R.last_word[E] = {'piece': piece, 'status': status}
        if read.get('head'):
            R.last_good = read['head']
    else:
        hold_unconfirmed(E, x.get('rulings'), v.get('decisionIds') or [])
    return {'ok': ok, 'failures': failures, 'head': read.get('head') if ok else None, 'cuts': pl['cuts']}

# ---------------------------------------------------------------- one deliverable (setup, spec, plan, plan-only record)
def collapse(s):
    return ' '.join(str(s if s is not None else '').split())


def numbered(items):
    return '\n'.join('%d. %s' % (i + 1, c) for i, c in enumerate(items))


class Deliverable(object):
    """runDeliverable of roadmap-release.js up to the return of plan-only mode: the git, spec-tool, plan-tool, run-record and
    roadmap.mjs steps are subprocesses; only the cognitive stages (authors, reviewers, fixers, review log) call agent()."""

    def __init__(self, E, idx):
        self.E = E
        self.card = R.by_id[E]
        self.wt = '%s/%s' % (R.wt, E)
        self.br = R.prefix + E
        self.port = 5200 + idx * 10
        self.human = []
        self.out = {'id': E, 'merged': False, 'ok': False, 'human': self.human, 'concerns': [], 'acceptedRisks': [], 'reviews': [], 'externalRun': [], 'recordCuts': []}
        self.ap = pure('artifactPaths(p.slug, p.E)', {'slug': R.disc['roadmapSlug'], 'E': E})
        self.note = (A.get('notes') or {}).get(E)
        self.spec = None
        self.plan = None
        self.spec_ref = None
        self.plan_ref = None
        self.setup_ok = False
        self.card_ac = pure('p.map(a => ({ id: a.id, text: a.text, tag: parseVerifyTag(a.text) }))', self.card.get('acceptance') or [])
        self.card_ref = 'card %s in %s (section %s; REQs %s; depends on %s%s)' % (E, R.strat, E, ', '.join(self.card.get('reqs') or []), ', '.join(self.card.get('deps') or []) or '-', '; CRITICAL' if self.card.get('critical') else '')

    # ---- briefings
    def base_of(self, with_notes=True):
        s = '%s\nDELIVERABLE %s: worktree %s, branch %s, port range %d-%d.' % (common_base(), self.E, self.wt, self.br, self.port, self.port + 9)
        if with_notes and self.note:
            s += "\nOWNER INSTRUCTION OR ANSWER FOR %s: %s\nNever write or quote a credential, token or key from the owner instruction in any file, commit message, review finding or report; write 'provided through environment variable <NAME>' instead." % (self.E, self.note)
        return s

    def briefing(self, with_notes=True):
        return '%s\nENVIRONMENT MEASURED IN THE PREFLIGHT: %s\nCURRENT BASELINE OF THE TARGET (a failure is pre-existing only if it is listed here): %s' % (
            self.base_of(with_notes), R.pre.get('envFacts') or '(not reported)', '(none: plan-only mode measures no baseline)')

    def C(self):
        return self.briefing(True)

    def Cn(self):
        return self.briefing(False)

    def Cs(self):
        return '%s\nDELIVERABLE %s: worktree %s, branch %s, port range %d-%d.' % (common_slim(), self.E, self.wt, self.br, self.port, self.port + 9)

    # ---- agents
    async def ask(self, role, prompt, schema=None, model=None, body=None):
        return await call_agent(role, prompt, SCHEMAS[schema] if schema else None, model, body)

    async def ask_ro(self, role, prompt, schema):
        """A reviewer (always pro). It runs with the tools of the session, so HEAD and the git status of its worktree are compared around it."""
        before = git_snapshot(self.wt)
        out = await call_agent(role, prompt, SCHEMAS[schema])
        if git_snapshot(self.wt) != before:
            raise ReadOnlyViolation('the %s changed the repository (HEAD or git status of %s differ): reviewers are read-only' % (role, self.wt))
        return out

    def body(self, name):
        try:
            return load_agent_body(ROOT, name)
        except OSError:
            return ''

    # ---- results and failure
    def accept_risks(self, stage, issues):
        self.out['acceptedRisks'].extend({'stage': stage, 'severity': i.get('severity'), 'category': i.get('category'), 'description': i.get('description'), 'file': i.get('file')} for i in issues)

    async def persist_reviews(self, tag, stages=None, tip=None):
        o = self.out
        if not self.setup_ok or (not stages and not o['reviews'] and not o['externalRun'] and not o['recordCuts']):
            return
        if stages:  # the run record of the approved spec/plan: a failure is ignored
            enc = pure("encodeURIComponent(JSON.stringify(p)).replace(/'/g, '%27')", {'trailer': R.trailer})
            run_cli(['node', R.root + '/scripts/run-record.mjs', 'approve', self.wt, self.ap['dir'], self.E, stages, tip or '-', enc])
        cuts = ', plus a section "Textos cortados no registro": one entry per item of recordCuts (origin = source, where it went in, the full text), keeping the earlier entries' if o['recordCuts'] else ''
        data = {'reviews': o['reviews'], 'acceptedRisks': o['acceptedRisks'], 'concerns': o['concerns'], 'humanInputs': self.human, 'failure': o.get('error')}
        if o['recordCuts']:
            data['recordCuts'] = o['recordCuts']
        prompt = ('%s\n\nWrite %s/%s on the branch %s, in the language of the roadmap, with the review log (if that file already exists, keep all it holds and add this run; never remove or rewrite an earlier record): per stage or task, the rounds (round number, reviewer model, tier of the fix that preceded it), the critical/important issues with category and description, the count of minor ones, unresolved items and accepted risks, plus concerns, gates and the human inputs (what, blq, workaround, blocking)%s. Transcribe faithfully; do not summarize blocking issues. Do not commit: the caller commits. Data: %s'
                  % (self.Cs(), self.wt, self.ap['reviews'], self.br, cuts, json.dumps(data, ensure_ascii=True)))
        w = await self.ask('review-log', prompt)
        label = ' (%s)' % tag if tag else ''
        if w is None:
            o['concerns'].append('review log%s not written: null agent' % label)
            return
        cm = commit_file(self.wt, self.ap['reviews'], '%s: review log%s' % (self.E, label))
        if not cm.get('ok'):
            o['concerns'].append('review log%s not committed: %s' % (label, cm.get('error')))

    async def fail(self, kind, msg):
        o = self.out
        o['error'] = msg
        o['failKind'] = kind
        o['branch'] = self.br
        o['worktree'] = self.wt
        await self.persist_reviews('failed')
        return o

    def review_env(self):
        return {'maxFix': R.maxfix, 'blqIds': R.blq, 'reviews': self.out['reviews'], 'concerns': self.out['concerns'], 'acceptRisks': self.accept_risks}

    # ---- setup (mechanical, by git -C)
    def sanitize(self, stage):
        """Clears uncommitted files left by an interrupted run; the patch is kept in _tmp."""
        d = '%s/_tmp/%s-dirty' % (R.wt, self.E)
        try:
            os.makedirs(d, exist_ok=True)
            diff = git_in(self.wt, 'diff', '--binary', 'HEAD')
            with open('%s/%s.patch' % (d, stage), 'w', encoding='utf-8', newline='') as f:
                f.write(diff['stdout'])
            un = git_in(self.wt, 'ls-files', '--others', '--exclude-standard')
            with open('%s/%s-untracked.txt' % (d, stage), 'w', encoding='utf-8', newline='') as f:
                f.write(un['stdout'])
            for rel in [x for x in un['stdout'].splitlines() if x.strip()]:
                dst = os.path.join(d, stage + '-untracked', rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                try:
                    shutil.copy2(os.path.join(self.wt, rel), dst)
                except OSError:
                    pass
        except OSError:
            return False
        if git_in(self.wt, 'reset', '--hard', 'HEAD')['exit'] != 0 or git_in(self.wt, 'clean', '-fd')['exit'] != 0:
            return False
        if git_in(self.wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip():
            return False
        self.out['concerns'].append('resume: uncommitted files from a previous run were discarded; patch in %s' % d)
        return True

    def setup(self):
        E, wt, br = self.E, self.wt, self.br
        reused = any(same_path(w['path'], wt) for w in worktrees(R.repo))
        if not reused:
            has = git_in(R.repo, 'rev-parse', '--verify', '--quiet', 'refs/heads/' + br)['exit'] == 0
            argv = ['worktree', 'add', wt, br] if has else ['worktree', 'add', wt, '-b', br, R.last_good or R.target]
            r = git_in(R.repo, *argv)
            if r['exit'] != 0:
                return {'ok': False, 'error': 'worktree add failed: %s' % r['stderr'].strip()}
        install = R.cfg.get('install')
        if install:
            try:
                ir = run_shell(install, wt)
            except RuntimeError as e:
                return {'ok': False, 'error': 'install failed: %s' % e}
            if ir['exit'] != 0:
                return {'ok': False, 'error': 'install failed (exit %s): %s' % (ir['exit'], (ir['stderr'] or ir['stdout']).strip()[-500:])}
        bc = git_in(wt, 'merge-base', br, R.target)
        head = git_in(wt, 'rev-parse', 'HEAD')
        clean = not git_in(wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip()
        subjects = git_in(wt, 'log', '--format=%s', '%s..HEAD' % R.target)['stdout'].splitlines()
        nums = sorted(set(int(m.group(1)) for m in (re.match(r'^%s T(\d+): ' % re.escape(E), s) for s in subjects) if m))
        task_commits = len([s for s in subjects if re.match(r'^%s T(\d+): ' % re.escape(E), s)])
        has_file = lambda rel: git_in(wt, 'cat-file', '-e', 'HEAD:' + rel)['exit'] == 0
        rec = run_cli(['node', R.root + '/scripts/run-record.mjs', 'key', wt, self.ap['dir']])
        return {'ok': bool(bc['stdout'].strip() and head['stdout'].strip()), 'worktree': wt, 'branch': br, 'baseCommit': bc['stdout'].strip(), 'head': head['stdout'].strip(),
                'reused': reused, 'clean': clean, 'taskCommits': task_commits, 'committedTasks': nums, 'nativeSpec': has_file(self.ap['spec']),
                'nativePlan': has_file(self.ap['plan']), 'record': rec['stdout'] if rec['exit'] == 0 else ''}

    def skip_rev(self, stage, ok, k, tip=None):
        if ok and pure('skipReview(p.stage, p.k, p.tip)', {'stage': stage, 'k': k, 'tip': tip}):
            self.out['concerns'].append('%s review skipped: %s matches' % (stage, self.ap['run']))
            return True
        return False

    # ---- tool loads (spec-tool and plan-tool by subprocess)
    def _head_clean(self):
        head = git_in(self.wt, 'rev-parse', 'HEAD')['stdout'].strip()
        clean = not git_in(self.wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip()
        return head, clean

    def load_spec(self):
        ck = run_cli(['node', self.spec_tool, 'check', self.spec_abs, '--roadmap', self.rm_abs, '--json'])
        em = run_cli(['node', self.spec_tool, 'emit', self.spec_abs, '--roadmap', self.rm_abs])
        head, clean = self._head_clean()
        t = {'checkExit': ck['exit'], 'checkStdout': ck['stdout'], 'emitExit': em['exit'], 'emitStdout': em['stdout'], 'head': head, 'clean': clean}
        v = pure('checkSpecLoad(p.t, p.E, p.card)', {'t': t, 'E': self.E, 'card': self.card})
        v['head'] = head
        return v

    def load_plan(self, use_spec=True):
        extra = ['--spec', self.spec_abs] if use_spec else []
        ck = run_cli(['node', self.plan_tool, 'check', self.plan_abs] + extra + ['--json'])
        em = run_cli(['node', self.plan_tool, 'emit', self.plan_abs] + extra)
        blob = git_in(self.wt, 'rev-parse', 'HEAD:' + self.ap['plan'])
        head, clean = self._head_clean()
        t = {'checkExit': ck['exit'], 'checkStdout': ck['stdout'], 'emitExit': em['exit'], 'emitStdout': em['stdout'], 'blob': blob['stdout'].strip() if blob['exit'] == 0 else '', 'head': head, 'clean': clean}
        v = pure('checkPlanLoad(p.t, { E: p.E, RM: p.RM })', {'t': t, 'E': self.E, 'RM': R.rm})
        v['head'] = head
        return v

    def plan_from(self, ld, blob, reused):
        return {'planPath': self.ap['plan'], 'planBlob': blob, 'reused': reused, 'tasks': pure('tasksFromPlan(p)', ld['plan']), 'ac': pure('evidenceFromPlan(p)', ld['plan'])}

    def plan_gaps(self):
        return pure(PURE_PLAN_GAPS_JS, {'plan': {'tasks': self.plan['tasks'], 'ac': self.plan['ac']}, 'cardAc': self.card_ac, 'blq': R.blq, 'taskLocks': R.task_locks})

    def truth_of(self, r, min_commits, label):
        return pure('reviewTruth(p.r, p.min, p.label)', {'r': r, 'min': min_commits, 'label': label})

    # ---- the deliverable
    async def run(self):
        E, o, wt, br = self.E, self.out, self.wt, self.br
        if R.foreign and not R.foreign_ok:
            return await self.fail('externo', 'the target %s is checked out in %s and %s is not authorized' % (R.target, R.int_wt, R.foreign_item))
        closed = pure('closedBlockers(p.ac, p.blq)', {'ac': self.card_ac, 'blq': R.blq})
        if closed:
            o['doNow'] = '%s %s closed on the roadmap but the card still tags %s: change the tag through a strategy revision, or reopen %s, then run again' % (
                ', '.join(closed), 'are' if len(closed) > 1 else 'is', ' and '.join('{verify: blocked %s}' % b for b in closed), ', '.join(closed))
            return await self.fail('decisao', 'the card %s tags a criterion as blocked by %s, which is not registered as open on the roadmap' % (E, ', '.join(closed)))

        # ---------- Setup
        setup = self.setup()
        if not setup.get('ok') or not setup.get('baseCommit'):
            return await self.fail('infra', 'setup failed: %s' % setup.get('error', 'no base commit or head'))
        self.setup_ok = True
        k0 = pure('runKey(p)', setup['record']) if setup.get('record') else None
        if setup.get('clean') is False and not self.sanitize('setup'):
            return await self.fail('infra', 'worktree %s is still dirty after the automatic cleanup' % wt)
        o['setup'] = {'worktree': setup['worktree'], 'branch': setup['branch'], 'baseCommit': setup['baseCommit'], 'head': setup['head'], 'reused': setup['reused']}
        if setup['taskCommits'] > 0 and setup['nativeSpec'] is not True:
            done = ' (tasks %s)' % ', '.join(str(n) for n in setup['committedTasks']) if setup['committedTasks'] else ''
            op('previous-version', E, 'the branch %s already holds %d task commit(s)%s made by the previous version of the release and has no native spec at %s' % (br, setup['taskCommits'], done, self.ap['spec']),
               'Either finish %s on the previous version of the release, or discard the branch and the worktree (git -C "%s" worktree remove --force "%s", then git -C "%s" branch -D %s) and run again with deliverables:["%s"] (the deliverable restarts from scratch with the native spec)' % (E, R.repo, wt, R.repo, br, E),
               dict(A, deliverables=[E]))
            return await self.fail('conteudo', 'the branch %s has %d task commit(s) of the previous version and no native spec; the workflow writes no spec over committed work' % (br, setup['taskCommits']))

        # ---------- Spec (native author; the tool output is read by code)
        self.spec_tool = R.root + '/scripts/spec-tool.mjs'
        self.plan_tool = R.root + '/scripts/plan-tool.mjs'
        self.spec_abs = '%s/%s' % (wt, self.ap['spec'])
        self.plan_abs = '%s/%s' % (wt, self.ap['plan'])
        self.rm_abs = '%s/%s' % (wt, R.rm.rstrip('/'))
        r_wt = 'Every task of the plan, the external ones included, runs in the deliverable worktree %s on %s before the merge; no task of the plan runs in the integration worktree (the workflow\'s own merge, post-merge gates and docs stages run there), and no task needs the merge, the target or that worktree.' % (wt, br)
        r_count = 'commitsInRange (git -C "%s" rev-list --count %s..HEAD)' % (wt, R.target)
        r_note = ("Owner instruction or answer for %s: %s\nNever write or quote a credential, token or key from it in any file; write 'provided through environment variable <NAME>' instead.\n" % (E, self.note)) if self.note else ''
        r_nocommit = 'Do not commit: the caller commits. One simple command per call: no heredoc, no loop, no && and no ;.'
        lang = R.lang or 'the language of the roadmap'
        spec_rules = '\n'.join(['Fixed rules of this run:', '- ' + NO_ASK,
            '- Parts that are human acts: produce the artifacts and leave the acceptance to the human; invent no human data.',
            '- Delivery: there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan (an external evidence row may check that effect, never replaces the task).',
            '- Record every external effect in externalEffects; never perform it.', '- ' + r_wt, '- ' + r_nocommit])
        reused_as_is = setup['nativeSpec'] is True and not self.note
        if not reused_as_is:
            prompt = 'mode: unattended\noutput: %s\nspecTool: %s\nlanguage: %s\nroadmap: %s\ncard: %s\nownerNote:\n%s%s%s\n%s' % (
                self.spec_abs, self.spec_tool, lang, self.rm_abs, E, r_note,
                ('The file %s already exists on this branch: edit it to take the instruction into account. A ruling the instruction does not change keeps its id and its text.\n' % self.ap['spec']) if setup['nativeSpec'] is True else '',
                spec_rules, self.Cn())
            authored = await self.ask('spec-author', prompt, body=self.body('spec-author'))
            if authored is None:
                return await self.fail('infra', 'spec: null agent')
        spec_load = self.load_spec()
        if not spec_load.get('ok'):
            return await self.fail('infra', 'spec load: %s' % spec_load.get('why'))
        spec_reused = reused_as_is
        if not reused_as_is:
            cm = commit_checked(wt, self.ap['spec'], '%s: spec' % E)
            if not cm.get('ok'):
                return await self.fail('infra', 'spec commit: %s' % (cm.get('error') or 'not ok'))
            spec_reused = (not cm.get('commit')) and bool(cm.get('head')) and cm['head'] == spec_load.get('head')
        self.spec = {'specPath': self.ap['spec'], 'reused': spec_reused}
        state = {'load_err': '', 'spec_load': spec_load}

        def spec_issues():
            sl = state['spec_load']
            return [{'severity': 'critical', 'category': 'defeito', 'description': sl.get('why')}] if sl.get('checkFailed') else []

        spec_skip = self.skip_rev('spec', spec_reused and not spec_load.get('checkFailed'), k0)

        async def spec_review(rnd, prev, reviewer=None, extra=None):
            prompt = ('%s\n\nReview (read-only) the spec %s/%s of deliverable %s against the %s, %s/%srequirements.md, %s/%sdecisions.md and the decisions cited in the PROJECT block (or the file it points to).\n'
                      'Blocks: an acceptance criterion of the card missing or altered (defeito); a REQ not met (defeito); an autonomous decision that contradicts a registered decision, or a canonical gate changed (decisao, critical); scope outside the card (defeito); a violation of the "do not" block (decisao, critical); invented human data (defeito); a human input marked blocking without need, or a blocking one handled as a placeholder (defeito); a design or autonomous decision that leaves an external effect the card requires to the workflow, the operator or a later stage instead of a task of the plan, except merging the target into the integration branch and pushing it, which are the owner\'s (a criterion that needs them is a human act) (defeito); a design or autonomous decision that has a task of the plan, or an external effect of the design, run after the merge, in the integration worktree or in the target (defeito); a design that is not viable in the current code (defeito; check the code).%s\n'
                      'Measure: headSha, clean (status --porcelain empty), %s.\n%s') % (
                self.C(), wt, self.ap['spec'], E, self.card_ref, wt, R.rm, wt, R.rm,
                ('\nIssues from the previous round (%s):\n%s' % (repeat_rule(), prev)) if prev else '', r_count, NO_ASK)
            return await self.ask_ro('spec-review', prompt, 'S_REVIEW')

        async def spec_fix(iss, k, tier):
            fmt_iss = pure('fmt(p)', iss)
            prompt = ('%s\n\nFix the spec %s according to the review below, in autonomous mode. Stop after saving the file; do not commit: the caller commits.\n%s\nReturn specPath, slug (without the ID), decisions (full list), humanInputs (full list).\n'
                      'The spec ends with a json data block in the spec/1 schema, which must stay valid: run node "%s" check "%s" --roadmap "%s" before you finish, one simple command per call. Rulings are read from that block, never from your answer.\n%s') % (
                self.C(), self.ap['spec'], fmt_iss, self.spec_tool, self.spec_abs, self.rm_abs, NO_ASK)
            fx = await self.ask('spec-fix', prompt, 'S_SPEC', model=tier)
            if not fx:
                return None
            again = self.load_spec()
            if not again.get('ok'):
                state['load_err'] = again.get('why')
                return None
            cm = commit_checked(wt, self.ap['spec'], '%s: spec fix %d' % (E, k))
            if not cm.get('ok'):
                state['load_err'] = 'spec commit: %s' % cm.get('error')
                return None
            state['spec_load'] = again
            return {'status': 'DONE'}

        def spec_truth(r):
            return self.truth_of(r, 0 if spec_reused else 1, '%s..HEAD' % R.target) + spec_issues()

        spec_loop = {'ok': True} if spec_skip else await run_review_loop(self.review_env(), 'spec', spec_review, spec_fix, spec_truth, {'tier': STAGE_MODELS['spec-fix'], 'reviewModel': 'pro'})
        if state['load_err']:
            return await self.fail('infra', 'spec load: %s' % state['load_err'])
        if not spec_loop.get('ok'):
            return await self.fail(spec_loop.get('kind'), spec_loop.get('msg'))
        spec_data = state['spec_load']['data']
        rulings = spec_data.get('rulings') if isinstance(spec_data.get('rulings'), list) else []
        needs = spec_data.get('needsPerson') if isinstance(spec_data.get('needsPerson'), list) else []
        spec_human = []
        for h in needs:
            e = {'what': str(h.get('what') or ''), 'blocking': h.get('blocking') is True}
            if h.get('blq'):
                e['blq'] = h['blq']
            if h.get('workaround'):
                e['workaround'] = h['workaround']
            spec_human.append(e)
        self.human.extend(spec_human)
        o['spec'] = self.ap['spec']
        self.spec_ref = self.ap['spec']
        approved = ((A.get('approveRulings') or {}).get(E)) if isinstance((A.get('approveRulings') or {}).get(E), list) else []
        stopped = pure('stopOrCarry(p)', {'rulings': rulings, 'needsPerson': needs, 'approved': approved})
        stops = lambda kind: [x for x in stopped['stops'] if x['kind'] == kind]

        def ruling_list(ids):
            return '; '.join('%s: %s%s' % (r['id'], collapse(r.get('decision')), (' (contradicts %s)' % r['contradicts']) if r.get('contradicts') else '') for r in rulings if r.get('id') in ids)

        if stops('humano'):
            blocking = [h for h in spec_human if h['blocking']]
            op('human-input', E, '; '.join('%s%s' % ((h['blq'] + ': ') if h.get('blq') else '', h['what']) for h in blocking),
               'Provide the data (or the decision) and run again passing the answer in notes. Never put a secret in notes: set an environment variable and name it',
               dict(A, deliverables=[E], notes=dict(A.get('notes') or {}, **{E: '<owner answer>'})))
            return await self.fail('humano', 'blocking human input: %s' % '; '.join(h['what'] for h in blocking))
        if stops('decisao'):
            lst = ruling_list([x['id'] for x in stops('decisao')])
            o['doNow'] = 'The spec %s of %s holds ruling(s) that go against a registered decision or a canonical gate (%s). Decide (a new DEC or a revision of the existing one) and run again with the decision in notes' % (self.ap['spec'], E, lst)
            return await self.fail('decisao', 'spec ruling(s) contradict a registered decision or gate: %s' % lst)
        if stops('approve-ruling'):
            lst = ruling_list([x['id'] for x in stops('approve-ruling')])
            keys = pure('p.filter(r => r.costIfWrong === "high" && r.reversible === false).map(approveKey)', rulings)
            op('approve-ruling', E, 'the spec of %s (committed at %s) holds ruling(s) that are costly if wrong and cannot be undone, so the plan was not written: %s' % (E, self.ap['spec'], lst),
               'Read the ruling(s) in %s on the branch %s. To accept them, run again adding approveRulings:%s to the args, typed by you: each key ties the approval to the exact text of its decision, so a decision that changes asks again. To refuse, pass the decision in notes. The resume args leave approveRulings out on purpose' % (self.ap['spec'], br, json.dumps({E: keys}, ensure_ascii=True)),
               dict(A, deliverables=[E]))
            return await self.fail('externo', 'waiting for the approval of costly irreversible ruling(s): %s' % lst)
        o['rulings'] = stopped['carry']
        o['decisions'] = [r.get('decision') for r in stopped['carry']]
        self.spec['humanInputs'] = spec_human
        self.spec['decisions'] = o['decisions']

        # ---------- Plan (native author; the tool output is read by code)
        committed_tasks = [n for n in (setup.get('committedTasks') or []) if type(n) is int]
        has_plan_file = setup['nativePlan'] is True
        reused_plan_as_is = has_plan_file and not self.note
        frozen = has_plan_file and bool(self.note) and bool(committed_tasks)

        async def plan_load_fail(why):
            return await self.fail('infra', 'plan load: integrity digest not confirmed (%s)' % why)

        plan_rules = '\n'.join(['Plan rules of this run:', '- ' + NO_ASK, '- The header of the prose of the plan carries this exact line:', '**Roadmap:** %s' % R.rm,
            '- Each task lists the locks it needs (locks: names from %s, only the ones the task really uses).' % (', '.join(R.task_locks) or '(none configured)'),
            '- Evidence: for EACH criterion of the card, a row with kind test, smoke or integration and the exact command that exits 0 only if that criterion holds (plus testRef), or kind human (a human act listed in the rules), or kind blocked (with blq, a registered blocker id). A criterion with a {verify: ...} tag MANDATORILY keeps the tag\'s command: you may add evidence, never replace it, and you create the test that the command references. The ac of each evidence row is ONLY the criterion id (e.g. AC1).',
            '- Delivery: there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan (an external evidence row may check that effect, never replaces the task).',
            '- Per task declare external (true when the task changes or sends anything outside the branch, or reads production: production, deploy, push, e-mail or message, writing shared data, someone\'s checkout; a command that only reads a local file outside the branch, such as counting the lines of ../outbox.log, is not external; when in doubt, true). An external task also declares externalDedupe: how running it twice avoids a duplicate effect (idempotency key or an existence check before acting). Every external effect the card or the spec requires is a task of the plan with `external: true`, except merging the target into the integration branch and pushing it, which are the owner\'s (a criterion that needs them is a human act); "not a task of this plan" does not apply to it. Order an external task after every task whose code it ships.',
            '- ' + r_wt,
            '- For each evidence row with a command (kind test, smoke or integration) declare external the same way (the same rule: a command that only reads a local file outside the branch is not external; when in doubt, true). An external row also declares externalDedupe, because the command runs again after every gates fix and every late sync.',
            '- Say whether a task needs a browser and what counts as acceptable evidence when a step cannot be exercised in this environment.',
            '- Task commits start with "%s T<n>:".' % E, '- ' + r_nocommit])

        async def plan_author_once(diffs):
            prompt = 'mode: unattended\noutput: %s\nplanTool: %s\nspec: %s\nlanguage: %s\nroadmap: %s\ncard: %s\nownerNote:\n%s%s%s%s%s\n%s' % (
                self.plan_abs, self.plan_tool, self.spec_abs, lang, R.rm, E, r_note,
                ('The file %s already exists on this branch: edit it to take the instruction into account; if the instruction changes nothing, leave the file untouched.\n' % self.ap['plan']) if has_plan_file else '',
                ('Tasks already committed on this branch (%s) are frozen: each keeps its number, its text and every field of its block. Only tasks not yet committed may change, and a new task gets a number greater than the largest existing one.\n' % ', '.join(str(n) for n in committed_tasks)) if frozen else '',
                ('The previous attempt changed frozen tasks: %s. Undo those changes.\n' % '; '.join(diffs)) if diffs else '',
                plan_rules, self.Cn())
            return await self.ask('plan-author', prompt, body=self.body('plan-author'))

        plan_load = None
        plan_committed = False
        plan_blob_now = ''
        if reused_plan_as_is:
            plan_load = self.load_plan()
            if not plan_load.get('ok'):
                return await plan_load_fail(plan_load.get('why'))
            plan_blob_now = plan_load['blob']
        else:
            prev_plan = None
            if frozen:
                first = self.load_plan(False)
                if not first.get('ok'):
                    return await plan_load_fail(first.get('why'))
                prev_plan = first['plan']
            diffs = []
            for _attempt in range(2):
                authored = await plan_author_once(diffs)
                if authored is None:
                    return await self.fail('infra', 'plan: null agent')
                plan_load = self.load_plan()
                if not plan_load.get('ok'):
                    return await plan_load_fail(plan_load.get('why'))
                diffs = pure('frozenTaskDiffs(p.prev, p.next, p.committed)', {'prev': prev_plan, 'next': plan_load['plan'], 'committed': committed_tasks}) if frozen else []
                if not diffs:
                    break
            if diffs:
                restored = git_in(wt, 'checkout', '--', self.ap['plan'])
                frozen_list = '; '.join(diffs)
                op('plan-frozen-tasks', E, 'the owner instruction for %s rewrote task(s) already committed on %s, in two author attempts: %s' % (E, br, frozen_list),
                   'Reword the instruction in notes so that it only touches tasks not yet committed (committed: %s), or revert those task commits on %s first. The plan file %s was restored to its committed version%s; no task ran' % (
                       ', '.join(str(n) for n in committed_tasks), br, self.ap['plan'], '' if restored['exit'] == 0 else ' (WARNING: the restore could not be confirmed; check git status in the worktree)'),
                   dict(A, deliverables=[E]))
                return await self.fail('conteudo', 'the owner instruction rewrote committed task(s) of the plan: %s' % frozen_list)
            cm = commit_checked(wt, self.ap['plan'], '%s: plan' % E)
            if not cm.get('ok'):
                return await self.fail('infra', 'plan commit: %s' % (cm.get('error') or 'not ok'))
            plan_committed = bool(cm.get('commit')) or not cm.get('head') or cm['head'] != plan_load.get('head')
            plan_blob_now = (cm.get('blob') or '').strip() if plan_committed else plan_load['blob']
            if plan_committed and not plan_blob_now:  # committed without its blob: measure it again
                plan_load = self.load_plan()
                if not plan_load.get('ok'):
                    return await plan_load_fail(plan_load.get('why'))
                plan_blob_now = plan_load['blob']
        if not re.match(r'^[0-9a-f]{40,64}$', plan_blob_now or ''):
            return await self.fail('infra', 'plan load: the blob of %s on the branch was not measured' % self.ap['plan'])
        self.plan = self.plan_from(plan_load, plan_blob_now, not plan_committed)
        if not self.plan['tasks']:
            return await self.fail('infra', 'plan: no tasks')
        pstate = {'load_err': ''}

        def plan_blob_gaps(r):
            m = (r.get('measuredPlanBlob') or '').strip() if r and isinstance(r.get('measuredPlanBlob'), str) else ''
            reported = (self.plan.get('planBlob') or '').strip()
            if not m:
                return [{'severity': 'critical', 'category': 'defeito', 'description': 'the plan reviewer did not measure the plan blob (git rev-parse "HEAD:%s"); the plan load reported %s' % (self.plan['planPath'], json.dumps(reported))}]
            if m == reported:
                return []
            return [{'severity': 'critical', 'category': 'defeito', 'description': 'planBlob reported by the plan load (%s) differs from the blob measured by the reviewer (%s); the plan file changed after the load' % (json.dumps(reported), json.dumps(m))}]

        plan_skip = self.skip_rev('plan', spec_skip and self.plan['reused'] and not self.plan_gaps(), k0)

        async def plan_review(rnd, prev, reviewer=None, extra=None):
            pl = self.plan
            prompt = ('%s\n\nReview (read-only) the plan %s/%s against the spec %s/%s and the %s.\n'
                      'Blocks (defeito): an acceptance criterion with no task or no test; a task with no verification command; a command that does not exist or does not run in the MEASURED ENVIRONMENT (check scripts, paths and flags in the repository); wrong needsLock; wrong task order; a missing "**Roadmap:** %s" line in the header; a task that edits the roadmap folder %s; an evidence command that does not prove its criterion; a testable criterion labelled human or blocked; a {verify: ...} command of the card replaced instead of kept; a task tier or reviewTier that contradicts the blast radius (opus reviewTier is only for blast radius 2); a task with no boolean external declaration, or an external task with no externalDedupe (how running it twice avoids a duplicate effect); a task whose steps touch anything outside the branch but which declares external false; a task with noCommit true whose steps change or commit a file; an evidence row whose command touches anything outside the branch but which declares external false; an evidence row with a command and no boolean external, or an external one with no externalDedupe; an external effect that the card or the spec requires (a delivery, a send, a deploy) and that no task declared external performs, except merging the target into the integration branch and pushing it, which are the owner\'s (a criterion that needs them is a human act) (defeito, critical); a task of the plan, or an external effect, marked to run after the merge, in the integration worktree or in the target (defeito, critical); a canonical gate changed (decisao, critical).\n'
                      'THE TASKS THE CODE ACTS ON (read by the script from the plan-tool emit, whose integrity digest it checked; these external and noCommit flags and the files lists decide what is held and how many commits a task must leave, so compare each one with the plan file, and a flag or list that differs from the file is a defect): %s%s\n'
                      'Measure: headSha, clean, %s, measuredPlanBlob = the output of git -C "%s" rev-parse "HEAD:%s", run by you; do not copy it from the plan load.\n%s') % (
                self.C(), wt, pl['planPath'], wt, self.spec['specPath'], self.card_ref, R.rm, R.rm, json.dumps({'tasks': pl['tasks']}, ensure_ascii=True),
                ('\nIssues from the previous round (%s):\n%s' % (repeat_rule(), prev)) if prev else '', r_count, wt, pl['planPath'], NO_ASK)
            return await self.ask_ro('plan-review', prompt, 'S_PLANREVIEW')

        async def plan_fix(iss, k, tier):
            fmt_iss = pure('fmt(p)', iss)
            prompt = ('%s\n\nFix the plan %s according to the review below. Stop after saving the file; do not commit: the caller commits.\n%s\nEvery ac of the evidence list is ONLY the criterion id (e.g. AC1), nothing else; if the review reports an ac mismatch, use exactly the expected id.\n'
                      'The plan ends with a json data block in the plan/1 schema, which must stay valid: run node "%s" check "%s" --spec "%s" before you finish, one simple command per call. Tasks and evidence rows are read from that block, never from your answer.\n%s') % (
                self.C(), self.plan['planPath'], fmt_iss, self.plan_tool, self.plan_abs, self.spec_abs, NO_ASK)
            fx = await self.ask('plan-fix', prompt, model=tier)
            if not fx:
                return None
            cm = commit_checked(wt, self.ap['plan'], '%s: plan fix %d' % (E, k))
            if not cm.get('ok'):
                pstate['load_err'] = 'plan commit: %s' % cm.get('error')
                return None
            again = self.load_plan()
            if not again.get('ok'):
                pstate['load_err'] = again.get('why')
                return None
            self.plan = self.plan_from(again, again['blob'], False)
            return {'status': 'DONE'}

        def plan_truth(r):
            min_c = 0 if self.plan['reused'] else (1 if self.spec['reused'] else 2)
            return self.truth_of(r, min_c, '%s..HEAD (spec + plan)' % R.target) + plan_blob_gaps(r) + self.plan_gaps()

        plan_loop = {'ok': True} if plan_skip else await run_review_loop(self.review_env(), 'plan', plan_review, plan_fix, plan_truth, {'tier': STAGE_MODELS['plan-fix'], 'reviewModel': 'pro'})
        if pstate['load_err']:
            return await plan_load_fail(pstate['load_err'])
        if not plan_loop.get('ok'):
            return await self.fail(plan_loop.get('kind'), plan_loop.get('msg'))
        if self.note and not (self.spec['reused'] is True and self.plan['reused'] is True):
            R.notes_read.append(E)  # a note is consumed only when written into the spec or plan
        o['plan'] = self.plan['planPath']
        self.plan_ref = self.plan['planPath']
        o['acOpen'] = pure('criteriaOpen(p.cardAc, p.planAc)', {'cardAc': self.card_ac, 'planAc': self.plan['ac']})
        _log('%s: plan with %d tasks' % (E, len(self.plan['tasks'])))
        R.bound[E] = pure('planFingerprint(p.tasks, p.blob)', {'tasks': self.plan['tasks'], 'blob': self.plan['planBlob']})

        # ---------- plan-only: the roadmap record, then the log, then done
        extra = {'rulings': o.get('rulings') or [], 'pending': [h['what'] for h in self.human if h.get('blocking') is not True], 'source': self.ap['reviews']}
        rec = record_status(E, R.statuses['plan'], [self.spec['specPath'], self.plan['planPath']], extra)
        if rec:
            o['recordCuts'].extend(rec['cuts'])
        if not rec or not rec['ok']:
            return await self.fail('infra', 'plan-only: the roadmap record failed (%s)' % ('; '.join(rec['failures']) if rec else 'null result or integration worktree broken'))
        ran_sp = (not spec_skip) or (not plan_skip)
        if o['recordCuts'] or ran_sp:
            await self.persist_reviews('record' if o['recordCuts'] else 'plan', 'spec,plan' if ran_sp else None)
        o['planOnly'] = True
        o['ok'] = True
        return o


# ---------------------------------------------------------------- plan-only: scheduling by dependencies and the final result
PURE_HOLD_JS = r"""(() => {
  const h = heldBy({ cards: p.cards, selected: p.order, contractDecisions: [...p.pend, ...p.dyn], started: [...p.started, ...p.begun] }).get(p.id)
  return h ? holdReason(h) : ''
})()"""


def hold_of(E):
    return pure(PURE_HOLD_JS, {'cards': R.cards, 'order': R.order, 'pend': R.pend_contract, 'dyn': R.dyn_contract, 'started': R.started, 'begun': R.begun, 'id': E})


async def run_deliverable(E, idx):
    d = Deliverable(E, idx)
    try:
        return await d.run()
    except ReadOnlyViolation as e:
        return await d.fail('infra', str(e))


def _slim(r):
    s = {'id': r['id'], 'merged': bool(r.get('merged')), 'broken': bool(r.get('broken')), 'planOnly': bool(r.get('planOnly')), 'skipped': r.get('skipped'), 'error': r.get('error'),
         'failKind': r.get('failKind'), 'held': r.get('held'), 'branch': r.get('branch'), 'spec': r.get('spec'), 'plan': r.get('plan'),
         'tasks': len(r.get('tasks') or []), 'concerns': r.get('concerns') or [], 'acceptedRisks': r.get('acceptedRisks') or [], 'decisions': len(r.get('decisions') or []),
         'human': [('%s: ' % h['blq'] if h.get('blq') else '') + str(h.get('what')) for h in (r.get('human') or [])][:12]}
    return {k: v for k, v in s.items() if v is not None}


async def run_plan_only(disc, plan, cfg, token, items, gates, selection):
    """plan-only mode: preflight steps 1, 2 and 5, then per deliverable setup, spec, plan and the roadmap record (the .js plan-only path)."""
    init_run(disc, plan, cfg, token, items, gates)
    R.root = ROOT
    _phase('Preflight')
    pre = preflight_plan_only()
    R.pre = pre
    if not pre.get('ok') or not pre.get('integrationWorktree'):
        kind = pre.get('errorKind') or 'other'
        op('preflight:%s' % kind, None, pre.get('error') or 'incomplete preflight',
           ('Clean or commit the listed files in the integration worktree of %s' % R.target) if kind == 'dirty' else ('Fix the environment setup command and run again' if kind == 'setup' else 'Read the error and fix the environment'), dict(A))
        return mk_result('needs-operator', selection=selection)
    R.int_wt = pre['integrationWorktree']
    th = pre.get('targetHead') or ''
    R.last_good = th if re.match(r'^[0-9a-f]{40,64}$', th) else R.target
    R.abs_folder = R.int_wt.rstrip('/') + '/' + R.rm.rstrip('/')

    # ---- scheduling: the order of the selection already respects the dependencies; one deliverable at a time
    _phase('Plan')
    done = {}
    for idx, E in enumerate(R.order):
        r = None
        for dep in R.by_id[E].get('deps') or []:
            if dep not in done:
                continue  # dependency already on the target
            if not done[dep].get('ok'):
                r = {'id': E, 'merged': False, 'ok': False, 'skipped': True, 'error': hold_of(E) or 'dependency %s did not finish in this run' % dep}
                break
        if r is None:
            why = hold_of(E)
            if why:
                r = {'id': E, 'merged': False, 'ok': False, 'skipped': True, 'error': why}
            elif R.integ_broken:
                r = {'id': E, 'merged': False, 'ok': False, 'skipped': True, 'error': 'integration worktree compromised: %s' % R.integ_broken}
        if r is None:
            R.begun.append(E)
            try:
                r = await run_deliverable(E, idx)
            except Exception as e:  # an unexpected failure of one deliverable is its result, not the end of the run
                r = {'id': E, 'merged': False, 'ok': False, 'error': 'unexpected error: %s' % e, 'failKind': 'infra'}
            if r.get('error') and not r.get('skipped'):
                fk = r.get('failKind')
                if fk == 'infra':
                    op('infra', E, r['error'], 'Run again (the stages reuse spec, plan and commits)', dict(A, deliverables=[E]))
                elif fk in ('conteudo', 'decisao'):
                    notes = dict(A.get('notes') or {})
                    if fk == 'conteudo':
                        kept = notes.get(E) if notes.get(E) and E not in R.notes_read else '<owner instruction>'
                        op('defect', E, r['error'], 'Read the review log on the branch %s; adjust the spec or plan, or pass an instruction in notes, and run again' % r.get('branch'),
                           dict(A, deliverables=[E], notes=dict(notes, **{E: kept})))
                    else:
                        op('decision', E, r['error'], r.get('doNow') or 'Decide (a new DEC or a revision of the existing one) and run again with the decision in notes',
                           dict(A, deliverables=[E], notes=dict(notes, **{E: '<owner decision>'})))
                # externo and humano: waiting for the person, no defect and no blocked record in plan-only
        done[E] = r
        RESULTS.append(r)
    return finish_plan_only(selection)


def finish_plan_only(selection):
    """The result of the plan-only run (the Report section of the .js without the report agent: the report stage is the merge task's)."""
    _phase('Report')
    slim = [_slim(r) for r in RESULTS]
    owner = {
        'acceptedRisks': [dict({'id': r['id']}, **x) for r in RESULTS for x in (r.get('acceptedRisks') or [])],
        'decisionsPending': [{'id': r['id'], 'decision': x} for r in RESULTS for x in (r.get('decisions') or [])],
        'criteriaOpen': [dict({'id': r['id']}, **x) for r in RESULTS for x in (r.get('acOpen') or [])],
    }
    for r in RESULTS:
        acts = [x for x in (r.get('acOpen') or []) if x.get('kind') == 'human']
        if acts and (r.get('merged') or r.get('planOnly')):
            op('human-act', r['id'], 'criteria that need a human act: %s' % ', '.join(x['ac'] for x in acts),
               'Perform the act (acceptance, go/no-go, credentials, session with users) and record it yourself; the workflow never records it', None)
    resume_ids = [r['id'] for r in slim if (not r['merged'] or r['broken']) and not r['planOnly']]
    resume_ids += [s['id'] for s in (selection.get('skippedUpfront') or []) if re.search(r'maxDeliverables', s.get('reason') or '')]
    resume_args = dict(A, deliverables=resume_ids, targetBranch=R.target) if resume_ids else None
    if R.foreign and not R.foreign_ok:
        op('authorize-external', None, 'the target %s is checked out in %s, which is not the integration worktree of this workflow: nothing was written there, and no execution report file was committed' % (R.target, R.int_wt),
           'Authorize it by running again with authorizeExternal including "%s" (or free the branch %s in %s so the workflow uses its own worktree)' % (R.foreign_item, R.target, R.int_wt),
           dict(A, authorizeExternal=R.items + [R.foreign_item]), {'item': R.foreign_item})
    fixed = pure(PURE_RESUME_JS,{'results': slim, 'bound': R.bound, 'ops': OPS, 'notesRead': R.notes_read, 'resumeArgs': resume_args, 'A': A, 'items': R.items, 'resumeIds': resume_ids})
    OPS[:] = fixed['ops']
    all_ok = all(r['merged'] or r['planOnly'] for r in slim)
    needs = any(o.get('kind') != 'note' for o in OPS)  # a note (minBudgetPerDeliverable is ignored) asks for nothing
    return mk_result('needs-operator' if needs else ('done' if all_ok else 'partial'), selection=selection, results=slim, ownerReview=owner, truth=None,
                     lastGood=R.last_good, resumeArgs=fixed['resume'], reportPath=None, report=None)


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
    if MODE == 'run':
        return mk_result('error', error='mode not implemented yet: %s runs in a later task of the agy workflow' % MODE, selection=selection)
    return await run_plan_only(disc, plan, cfg, token, items, gates, selection)


RESULT = await main()
print(json.dumps(RESULT, ensure_ascii=True))
