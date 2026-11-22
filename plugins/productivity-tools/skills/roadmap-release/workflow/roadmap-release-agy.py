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
# and run (the full preflight with setup commands and the baseline of the gates, the same spec and plan, the tasks, the sync and
# final review, the gates of the branch, then the serialized merge by git in the integration worktree, the post-merge gates with
# one reviewed merge-fix, the rollback by git when they stay red, the docs stage and the cleanup). Both modes end with the report
# (flash), committed by the script, and in run mode the git truth of verify-run.mjs check (run by subprocess).
# Resume needs no replay: each deliverable rebuilds its progress from the roadmap, its branch and its worktree (the run record skips
# the reviews of an unchanged spec and plan, the task commits mark the tasks done, an interrupted merge is validated and documented).
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
  const rc = recordCommands({ cli: p.cli, folder: p.folder, E: p.E, word: p.status, piece: p.piece, blockedBy: p.blockedBy, evidence: p.refs, statusEvidence: p.statusEvidence, logWhat: p.reason,
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

# The pending items of the docs record (postMerge of the .js): accepted risks, open human inputs and criteria without automatic
# evidence; `maybe` = the human items marked as already run, which the .js leaves to the judgement of its docs agent.
PURE_DOCS_PENDING_JS = r"""(() => {
  const P = phrases(p.lang)
  const room = p.cellChars - `(${P.owner}) `.length
  const ran = h => String(h.what || '').includes('[' + p.mark + ':')
  return {
    pending: [...p.risks.map(x => `${x.stage}: [${x.severity}/${x.category}] ${x.description}`), ...p.human.filter(h => !ran(h)).map(h => h.what),
      ...p.acOpen.map(x => fitCell(P.critNoEvidence(p.E, x.ac, x.kind, x.blq), room, p.planTxt, p.lang).text)],
    maybe: p.human.filter(ran).map(h => h.what),
  }
})()"""

CMD_CAP = 6000
RAN_MARK ='already authorized and run in this run'  # the mark annotateAuthorizedHuman adds to a human item
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


# ---------------------------------------------------------------- run state
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
    R.mode = MODE
    R.accept_red = bool(A.get('acceptRedBaseline') or cfg.get('acceptRedBaseline'))
    R.before_evidence = as_list(cfg.get('beforeEvidence'))
    R.setup_cmds = as_list(cfg.get('setup'))
    R.install = cfg.get('install') or ''
    R.gates_key = pure('fnv1a(JSON.stringify(canon(p)))', gates)
    R.baseline = {}  # gate name -> GateResult of the target (the baseline every measure is judged against)
    R.test_integrity = None
    R.deliv = {}  # E -> Deliverable (its log is written again after the blocked record)
    # docsStage: a string (instructions) or { instructions, measure (Node program printing {"ok":bool,"details":str}), paths (doc prefixes) }
    ds = cfg.get('docsStage')
    R.docs = {'instructions': ds} if isinstance(ds, str) else (ds if isinstance(ds, dict) else {})
    R.docs_paths = R.docs['paths'] if isinstance(R.docs.get('paths'), list) and R.docs['paths'] else ['docs/']
    R.status_after = plan['statusAfterMerge']
    R.checkers = {}  # E -> result.checker of the brief read back after the docs record


def _env_facts():
    bits = []
    for name, argv in (('git', ['git', '--version']), ('node', ['node', '--version'])):
        r = run_cli(argv)
        bits.append('%s %s' % (name, r['stdout'].strip() if r['exit'] == 0 and r['stdout'].strip() else 'not found'))
    bits.append('bash: %s' % (find_git_bash() or 'not found'))
    bits.append('os: %s' % ('windows' if os.name == 'nt' else 'posix'))
    return '; '.join(bits)


def sh(cmd, cwd):
    """One shell command line through Git Bash (the commands of the config are shell text). A missing Git Bash is { ran: False }."""
    try:
        r = dict(run_shell(cmd, cwd))
    except RuntimeError as e:
        return {'exit': 127, 'stdout': '', 'stderr': str(e), 'ran': False}
    r['ran'] = True
    return r


def tail_text(s, n=3000):
    s = str(s or '')
    return s if len(s) <= n else '[...truncated...]\n' + s[-n:]


# ---------------------------------------------------------------- gates: measured by run_shell, judged by the script
async def read_tests_gate(d, r):
    """A tests gate: the exit is the script's own; only the numbers inside its output need a reader (flash, no tools). None when unreadable."""
    text = tail_text(r['stdout'] + (('\n' + r['stderr']) if r['stderr'].strip() else ''), 4000)
    prompt = ('GATE OUTPUT READER (read-only; run nothing, change nothing, no tools needed). The gate "%s" (kind tests) ran `%s` and exited %s. '
              'Read its output below and return { name, ran: true, exit: %s, total, skipped, failedNames }: total = tests executed, skipped = tests skipped, '
              'failedNames = each failing test as path/of/file::test name (a file that does not even load counts as path/of/file::(collect)). '
              'A non-zero exit requires failedNames and failedNames require a non-zero exit. Real numbers from the output, never estimates.\nOUTPUT:\n%s'
              % (d.get('name'), d.get('cmd'), r['exit'], r['exit'], text))
    for _ in range(2):
        g = await call_agent('gates', prompt, SCHEMAS['S_GATE'])
        if isinstance(g, dict) and type(g.get('total')) is int:
            sk = g.get('skipped')
            return {'total': g['total'], 'skipped': sk if type(sk) is int else 0, 'failedNames': [str(x) for x in (g.get('failedNames') or [])]}
    return None


async def measure_defs(defs, wt, rng):
    """One group of gates in `wt`: headSha and clean BEFORE any command, the state preparation of the gates that need a lock, then every
    command by run_shell. Returns { headSha, clean, gates, changedFiles, log } or None when a tests gate could not be read."""
    head = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
    clean = not git_in(wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip()
    before_ok = True
    if R.before_evidence and any(as_list(d.get('needsLock')) for d in defs):
        for c in R.before_evidence:
            if sh(c, wt)['exit'] != 0:
                before_ok = False
                break
    res = []
    logs = []
    for d in defs:
        if not before_ok and as_list(d.get('needsLock')):
            res.append({'name': d['name'], 'ran': False, 'exit': 1})
            continue
        r = sh(d['cmd'], wt)
        g = {'name': d['name'], 'ran': r['ran'], 'exit': r['exit']}
        if r['ran'] and d.get('kind') == 'tests':
            t = await read_tests_gate(d, r)
            if t is None:
                return None
            g.update(t)
        if r['exit'] != 0:
            logs.append('%s (exit %s):\n%s' % (d['name'], r['exit'], tail_text(r['stdout'] + r['stderr'], 1500)))
        res.append(g)
    changed = [x for x in git_in(wt, 'diff', '--name-only', rng)['stdout'].splitlines() if x.strip()] if rng else []
    return {'headSha': head, 'clean': clean, 'gates': res, 'changedFiles': changed, 'log': '\n---\n'.join(logs)}


async def measure_all(wt, exp=None, rng=None):
    """Every gate of the run, one group after the other (the unlocked group first). A group that does not make a valid measure (dirty tree,
    wrong commit, a gate missing, exit and failing names in disagreement) makes the whole measure None."""
    parts = []
    for g in pure('gateGroups(p)', R.gates):
        m = await measure_defs(g['defs'], wt, rng)
        if not m or not pure('validMeasure(p.m, p.e, p.d)', {'m': m, 'e': exp, 'd': g['defs']}):
            return None
        m['headSha'] = str(m['headSha']).strip().lower()
        parts.append(m)
    if not parts or not pure('p.every(x => gateShaMatch(x.headSha, p[0].headSha))', parts):
        return None
    changed = []
    for x in parts:
        for f in x['changedFiles']:
            if f not in changed:
                changed.append(f)
    return {'headSha': parts[0]['headSha'], 'clean': True, 'gates': [g for x in parts for g in x['gates']], 'changedFiles': changed, 'log': '\n---\n'.join(x['log'] for x in parts)}


async def run_gates(wt, base=None, exp=None, rng=None):
    """gates() of the .js: { m, ok, nullAgent, failures, summary }. The verdict is the script's, over the numbers it measured."""
    m = await measure_all(wt, exp, rng or '%s...HEAD' % R.target)
    if not m:
        return {'m': None, 'ok': False, 'nullAgent': True, 'failures': [], 'summary': 'measurement null or invalid (dirty tree, wrong commit, a missing gate or exit and failing names in disagreement)'}
    b = base if base is not None else R.baseline
    v = pure('allPass(p.d, p.m, p.b, p.c)', {'d': R.gates, 'm': m, 'b': b, 'c': m['changedFiles']})
    return {'m': m, 'ok': v['ok'], 'nullAgent': False, 'failures': v['failures'], 'summary': pure('gateSummary(p.d, p.m, p.b)', {'d': R.gates, 'm': m, 'b': b})}


def base_txt():
    return pure("p.d.map(g => g.name + ': ' + resultTxt(p.b[g.name])).join(' | ')", {'d': R.gates, 'b': R.baseline})


def measure_integrity(program, repo, tmp_dir, rev, base):
    """test-integrity (the program of roadmap-release.js) on a temporary detached worktree of `rev`, against `base`. The worktree is
    always removed, also when the program fails or raises. The result is the bridge's: removedAsserts -1 when unmeasured."""
    git_in(repo, 'worktree', 'remove', '--force', tmp_dir)  # a leftover of an earlier run
    a = git_in(repo, 'worktree', 'add', '--detach', tmp_dir, rev)
    if a['exit'] != 0:
        return dict(UNMEASURED_INTEGRITY, deletedTests=[])
    try:
        return run_test_integrity(program, tmp_dir, base)
    finally:
        git_in(repo, 'worktree', 'remove', '--force', tmp_dir)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        git_in(repo, 'worktree', 'prune')


# ---------------------------------------------------------------- preflight (steps 1, 2 and 5 by git; setup and baseline in run mode)
async def preflight():
    """The preflight: steps 1, 2 and 5 by git; in run mode also the setup commands and the baseline of every gate (recorded by an earlier
    run or measured). Returns S_PRE-shaped data: { ok, errorKind?, error?, integrationWorktree, targetHead, clean, envFacts, baseline? }."""
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
    out = {'ok': True, 'integrationWorktree': intwt, 'targetHead': head, 'clean': True, 'envFacts': facts}
    if MODE != 'run':
        return out
    # step 3: the environment setup, in the integration worktree, in order
    for c in R.setup_cmds:
        s = sh(c, intwt)
        if s['exit'] != 0:
            return {'ok': False, 'errorKind': 'setup', 'error': 'setup command failed (exit %s): "%s"\n%s' % (s['exit'], c, tail_text(s['stderr'] or s['stdout'], 500)), 'integrationWorktree': intwt}
    # step 4: the baseline of the gates. A baseline recorded by an earlier run for this exact target head and gates is reused.
    specs = pure("p.ids.map(id => p.pfx + id + ':' + artifactPaths(p.slug, id).dir)", {'ids': R.order, 'pfx': R.prefix, 'slug': R.disc['roadmapSlug']})
    rec = run_cli(['node', R.root + '/scripts/run-record.mjs', 'baseline', R.repo, R.target, R.gates_key] + specs)
    recorded = rec['stdout'] if rec['exit'] == 0 and rec['stdout'].strip() else ''
    if R.install:
        s = sh(R.install, intwt)
        if s['exit'] != 0:
            return {'ok': False, 'errorKind': 'setup', 'error': 'install failed (exit %s): %s' % (s['exit'], tail_text(s['stderr'] or s['stdout'], 500)), 'integrationWorktree': intwt}
    if recorded:
        out['baseline'] = pure('recordedBaseline(p.s, p.h, p.k, p.d)', {'s': recorded, 'h': head, 'k': R.gates_key, 'd': R.gates})
    else:
        m = await measure_all(intwt)
        if m:
            out['baseline'] = {'headSha': m['headSha'], 'clean': m['clean'], 'gates': m['gates']}
    return out


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
    for k_in, k_out in (('reason', 'reason'), ('pending', 'pending'), ('inflight', 'inflight'), ('statusEvidence', 'statusEvidence')):
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
    return {'ok': ok, 'failures': failures, 'head': read.get('head') if ok else None, 'cuts': pl['cuts'], 'brief': read.get('brief'), 'clean': read.get('clean')}

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
            self.base_of(with_notes), R.pre.get('envFacts') or '(not reported)', '(none: plan-only mode measures no baseline)' if MODE == 'plan-only' else base_txt())

    def C(self):
        return self.briefing(True)

    def Cn(self):
        return self.briefing(False)

    def Cs(self):
        return '%s\nDELIVERABLE %s: worktree %s, branch %s, port range %d-%d.' % (common_slim(), self.E, self.wt, self.br, self.port, self.port + 9)

    # ---- agents
    async def ask(self, role, prompt, schema=None, model=None, body=None):
        return await call_agent(role, prompt, SCHEMAS[schema] if schema else None, model, body)

    async def ask_ro(self, role, prompt, schema, body=None, wt=None):
        """A reviewer (always pro). It runs with the tools of the session, so HEAD and the git status of its worktree are compared around it."""
        wt = wt or self.wt
        before = git_snapshot(wt)
        out = await call_agent(role, prompt, SCHEMAS[schema], None, body)
        if git_snapshot(wt) != before:
            raise ReadOnlyViolation('the %s changed the repository (HEAD or git status of %s differ): reviewers are read-only' % (role, wt))
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
            self.rec_approve(stages, tip)
        cuts = ', plus a section "Textos cortados no registro": one entry per item of recordCuts (origin = source, where it went in, the full text), keeping the earlier entries' if o['recordCuts'] else ''
        data = {'reviews': o['reviews'], 'acceptedRisks': o['acceptedRisks'], 'concerns': o['concerns'], 'gates': o.get('gates'), 'tasks': o.get('tasks'), 'humanInputs': self.human, 'failure': o.get('error')}
        if o['externalRun']:
            data['externalRun'] = o['externalRun']
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

    def rec_approve(self, stages, tip=None):
        """run-record.mjs approve: the run record of the approved spec/plan (and, in run mode, the baseline for a resume). A failure is ignored."""
        payload = {'trailer': R.trailer}
        if MODE != 'plan-only' and R.pre.get('baseline'):
            payload['prep'] = {'targetHead': R.pre['targetHead'], 'gatesKey': R.gates_key, 'baseline': R.pre['baseline']}
        enc = pure("encodeURIComponent(JSON.stringify(p)).replace(/'/g, '%27')", payload)
        return run_cli(['node', R.root + '/scripts/run-record.mjs', 'approve', self.wt, self.ap['dir'], self.E, stages, tip or '-', enc])

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
    def save_patch(self, stage):
        """The uncommitted work of the worktree (diff and untracked files) saved in _tmp/<E>-dirty. Returns the folder, or None."""
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
            return None
        return d

    def sanitize(self, stage):
        """Clears uncommitted files left by an interrupted run; the patch is kept in _tmp."""
        d = self.save_patch(stage)
        if not d:
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

    # ---- run mode: the helpers of the stages after the plan
    def ctx_for(self, **extra):
        c = {'base': self.base_of(), 'envFacts': R.pre.get('envFacts'), 'baseline': base_txt(), 'E': self.E, 'target': R.target, 'wt': self.wt,
             'planPath': self.plan['planPath'] if self.plan else None, 'specPath': self.spec['specPath'] if self.spec else None, 'locks': []}
        c.update(extra)
        return c

    def lock_note(self, locks):
        return pure('lockNote(p)', locks)

    def no_spec_edit(self):
        return 'Never edit the spec%s or the plan%s to satisfy a finding: they are approved, so if an item can only be met by changing them, do not apply it and explain in concerns.' % (
            (' ' + self.spec_ref) if self.spec_ref else '', (' ' + self.plan_ref) if self.plan_ref else '')

    def bound_items(self):
        if self.E not in R.bound:
            return list(R.items)
        return pure('bindAuthorizations(p.items, p.E, p.fp)', {'items': R.items, 'E': self.E, 'fp': R.bound[self.E]})

    def external_hold(self, t):
        return pure('externalHold(p.t, p.E, p.items, p.fp)', {'t': t, 'E': self.E, 'items': R.items, 'fp': self.fp})

    def held_tasks(self, xs):
        return pure('p.xs.map(x => ({ x, item: externalHold(x, p.E, p.items, p.fp) })).filter(h => h.item)', {'xs': xs, 'E': self.E, 'items': R.items, 'fp': self.fp})

    def held_evidence(self):
        return pure('evidenceHolds(normalizePlanAc(p.c, p.a), p.E, p.items, p.fp)', {'c': self.card_ac, 'a': self.plan['ac'], 'E': self.E, 'items': R.items, 'fp': self.fp})

    def op_evidence(self, held):
        E = self.E
        for h in held:
            op('authorize-external', E, 'the acceptance evidence of criterion %s of %s runs a command with an external effect and is not authorized, so it was not run: %s' % (h['ac'], E, ' ; '.join(h['commands'])),
               'Authorize it by running again with authorizeExternal including "%s" (externalDedupe: %s); the command runs on the branch, again after each gates fix, after a late sync and on the retry of an invalid measure' % (h['item'], ' ; '.join(h['dedupe']) or 'none declared'),
               dict(A, authorizeExternal=self.bound_items() + [h['item']], deliverables=[E]), {'item': h['item']})

    def op_tasks(self, held):
        E, br = self.E, self.br
        for h in held:
            x = h['x']
            op('authorize-external', E, 'task %s ("%s") of %s is external and not authorized: it was not run' % (x['n'], x['title'], E),
               'Authorize it by running again with authorizeExternal including "%s" (externalDedupe: %s); the tasks before it are already committed on %s' % (h['item'], x.get('externalDedupe') or 'none declared', br),
               dict(A, authorizeExternal=self.bound_items() + [h['item']], deliverables=[E]), {'item': h['item']})

    def failed_record(self, rec):
        return '; '.join(rec['failures']) if rec else 'null result or integration worktree broken'

    def annotate_human(self):
        self.human[:] = pure('annotateAuthorizedHuman(p.h, p.r)', {'h': self.human, 'r': self.out['externalRun']})

    def missing(self, lst, items, key):
        return pure('missingFrom(p.l, p.i, %s)' % key, {'l': lst, 'i': items})

    async def read_persisted_log(self, d=None):
        """Human acts and accepted risks of an earlier run live only in the persisted files: a read (flash, no tools beyond reading).
        `d` is the folder read (the deliverable worktree, or the integration worktree for an interrupted merge)."""
        E, ap = self.E, self.ap
        prompt = ('Read-only. In "%s" read %s (the review log), %s (the spec) and %s (the plan). found = true only if at least one of those files was read. acceptedRisks = every accepted risk listed in the review log '
                  '(stage, severity, category, description, file when given); an accepted risk is an item the log lists as accepted, never a finding that was fixed or that only appears as an issue of a round; empty list when none. '
                  'humanInputs = every item of the "Depends on human input" section of the spec plus every human input listed in the review log (what, blq when named, workaround, blocking), one entry per distinct item; empty list when there are none. '
                  'ac = every row of the "Acceptance criteria evidence" section of the plan (ac = the criterion id alone; kind = test, smoke, integration, human or blocked; blq when named); empty list when the plan or the section is absent. '
                  'externalRun = every line of the "External effects run" section of the review log (item, title, command, status, exit, reviewed, each only when written), one entry per distinct item and command; empty list when the section is absent. '
                  'Transcribe faithfully, do not invent.') % (d or self.wt, ap['reviews'], ap['spec'], ap['plan'])
        return await self.ask('review-log', prompt, 'S_RESUMELOG')

    def restore_from_log(self, rl, unsettled=()):
        o = self.out

        def strip(h):
            w = str(h.get('what') or '')
            for item in unsettled:
                w = w.replace(' [%s: %s]' % (RAN_MARK, item), '')
            return dict(h, what=w)

        self.human.extend(self.missing(self.human, [strip(h) for h in (rl.get('humanInputs') or [])], 'humanKey'))
        o['acceptedRisks'].extend(self.missing(o['acceptedRisks'], rl.get('acceptedRisks') or [], 'x => `${x.stage}|${x.description}`'))
        o['externalRun'].extend(self.missing(o['externalRun'], [e for e in (rl.get('externalRun') or []) if e.get('item') not in unsettled], 'x => `${x.item}|${x.command || \'\'}`'))
        self.annotate_human()

    def commit_mark(self, subject):
        """An empty commit that is a durable mark (launch, completion, awaiting a person). Returns its head, or '' when it is not HEAD."""
        git_in(self.wt, 'reset', '-q')
        c = git_in(self.wt, 'commit', '--allow-empty', '-q', '-m', subject, '-m', R.trailer)
        if c['exit'] != 0:
            return ''
        if git_in(self.wt, 'log', '-1', '--format=%s')['stdout'].strip() != subject:
            return ''
        return git_in(self.wt, 'rev-parse', 'HEAD')['stdout'].strip()

    def read_progress(self, external_ns):
        """What the earlier runs left on the branch, read by git: the commits of each task, the waits for a person and the marks of the external tasks."""
        E, wt = self.E, self.wt
        commits = []  # newest first
        for ln in git_in(wt, 'log', '--format=%H%x09%s', '%s..HEAD' % R.target)['stdout'].splitlines():
            sha, _, subj = ln.partition('\t')
            commits.append((sha, subj))
        head, clean = self._head_clean()

        def newest(prefixes):
            return next((i for i, c in enumerate(commits) if any(c[1].startswith(p) for p in prefixes)), None)

        done = []
        awaiting = []
        for t in self.plan['tasks']:
            n = t['n']
            tn = '%s T%d' % (E, n)
            mine = [c for c in reversed(commits) if c[1].startswith(tn + ':')]
            if mine:
                done.append({'n': n, 'firstParent': git_in(wt, 'rev-parse', mine[0][0] + '^')['stdout'].strip(), 'last': mine[-1][0]})
            a = newest([tn + ' awaiting person:'])
            c = newest([tn + ': external effect completed', tn + ': resumed after awaiting person'])
            if a is not None and (c is None or a < c):
                awaiting.append(n)
        launch_open, completed, may = [], [], []
        for n in external_ns:
            tn = '%s T%d' % (E, n)
            allp = [tn + ' launching', tn + ' started', tn + ' awaiting person:', tn + ' awaiting person (effect may have run):', tn + ' awaiting person (effect unknown):', tn + ': external effect completed']
            for _sha, s in commits:
                if not any(s.startswith(p) for p in allp):
                    continue
                if s.startswith((tn + ' launching', tn + ' started', tn + ' awaiting person (effect unknown):', tn + ' awaiting person: external effect did not complete')):
                    launch_open.append(n)
                elif s.startswith(tn + ': external effect completed'):
                    completed.append(n)
                elif s.startswith((tn + ' awaiting person (effect may have run):', tn + ' awaiting person: a fix round needs a person')):
                    may.append(n)
                break
        return {'head': head, 'clean': clean, 'done': done, 'awaitingPerson': awaiting, 'launchOpen': launch_open, 'effectCompleted': completed, 'effectMayHaveRun': may}

    # ---- the tasks (resumable)
    async def stop_for_person(self, t, res, from_fix=False):
        """An authorized external task that stopped for a person: nothing merges, and only a person can say the effect did not happen."""
        E, br, wt = self.E, self.br, self.wt
        n = t['n']
        self.human.extend(self.missing(self.human, res.get('humanInputs') or [], 'humanKey'))
        needed = '; '.join('%s%s' % ((h['blq'] + ': ') if h.get('blq') else '', h.get('what')) for h in (res.get('humanInputs') or [])) or res.get('summary')
        subject = ('%s T%d awaiting person (effect may have run): a fix round needs a person' % (E, n)) if from_fix else ('%s T%d awaiting person (effect unknown): the implementer needs a person' % (E, n))
        mark = self.commit_mark(subject)
        warn = '' if mark else ' WARNING: the mark commit could not be written, %s: before running again, add an empty commit on %s with the subject "%s"' % (
            'so a resume would count this task as done' if from_fix else 'so a resume will stop and ask, because the launch stays open', br, subject)
        state = 'a fix round needs a person first; the implementer reported the external effect done' if from_fix else 'its implementer stopped for a person and it is not known whether the external effect started'
        check = 'Check whether the effect already happened before repeating it (externalDedupe: %s). ' % (t.get('externalDedupe') or 'none declared')
        confirmed = '%s T%d awaiting person: confirmed not run' % (E, n)
        done = '%s T%d: external effect completed' % (E, n)
        if from_fix:
            how = "the implementer is not launched again: the task's commits stay on %s, its reviews run again and any fix runs without authorization for the effect (if the fix needs the effect run again, run it yourself after its duplicate check, or add \"%s\" only if you undid the first effect)" % (br, confirmed)
        else:
            how = 'any commits it made stay on %s, and the resume stops and asks until you add an empty commit: "%s" if the effect did not start (the task then runs again), or "%s" if it did' % (br, confirmed, done)
        op('human-input', E, 'external task %s ("%s") of %s is authorized, but %s: %s' % (n, t['title'], E, state, needed),
           ('%sProvide the data (or the decision) and run again passing the answer in notes; %s; the authorization of this task stays valid only if the spec and plan files come out unchanged; an answer that changes them is a replan and the authorization is asked again '
            '(pass the bare `%s:T%d` in your own message to re-authorize together with the answer). Never put a secret in notes: set an environment variable and name it.%s') % (check, how, E, n, warn),
           dict(A, authorizeExternal=self.bound_items(), deliverables=[E], notes=dict(A.get('notes') or {}, **{E: '<owner answer>'})))
        if from_fix:
            return await self.fail('humano', 'authorized external task %s: a fix round needs a person; the implementer reported the external effect done: %s' % (n, needed))
        return await self.fail('humano', 'authorized external task %s needs a person; whether its external effect started is unknown: %s' % (n, needed))

    def close_effect(self, t, was_awaiting):
        """Written as soon as the implementer reports completion: a later review failure must not make a resume launch the effect again."""
        E, n = self.E, t['n']
        done = '%s T%d: external effect completed' % (E, n)
        subject = ('%s T%d: resumed after awaiting person' % (E, n)) if t.get('external') is False else (done + (', clears the awaiting-person mark' if was_awaiting else ''))
        ok = bool(self.commit_mark(subject))
        if not ok:
            self.out['concerns'].append(
                ('T%d: the awaiting-person mark was not cleared, so a later resume would launch this task again: before running again, add an empty commit on %s with the subject "%s"' % (n, self.br, ('%s T%d: resumed after awaiting person' % (E, n)) if t.get('external') is False else done))
                if was_awaiting else
                ('T%d: the launch was not closed, so a later resume will stop and ask about this task: before running again, add an empty commit on %s with the subject "%s"' % (n, self.br, done)))
        return ok

    def record_run(self, t, status):
        item = '%s:T%d' % (self.E, t['n'])
        o = self.out
        o['externalRun'] = [e for e in o['externalRun'] if e.get('item') != item]
        o['externalRun'].append({'item': item, 'title': t['title'], 'status': status, 'reviewed': False})

    async def tasks_stage(self, setup, spec_skip, plan_skip):
        """Each task of the plan on its routed model, reviewed twice by the task-reviewer (always pro), fixes up the nextAgyTier ladder.
        Returns None when every task passed, or the failed result of the deliverable."""
        E, o, wt, br, tasks = self.E, self.out, self.wt, self.br, self.plan['tasks']
        human = self.human
        external_ns = [t['n'] for t in tasks if t.get('external') is not False]
        if not (spec_skip and plan_skip):
            self.rec_approve('spec,plan')
        prog = self.read_progress(external_ns)
        if not prog['clean'] and not self.sanitize('tasks'):
            return await self.fail('infra', 'worktree %s is still dirty after the automatic cleanup' % wt)
        # A task stopped for a person has commits but not its effect: it is a gap, so it runs again under the normal authorization rules.
        # The newest mark decides. An open launch or a may-have-run mark is never a gap to run again.
        launch_open = prog['launchOpen']
        may_have_run = prog['effectMayHaveRun']
        awaiting = [n for n in prog['awaitingPerson'] if n not in launch_open and n not in may_have_run]
        done_map = dict((d['n'], d) for d in prog['done'] if d['n'] not in awaiting)
        last_done = pure('lastContiguousDone(p.tasks, p.doneMap)', {'tasks': tasks, 'doneMap': dict((str(k), v) for k, v in done_map.items())})
        if done_map or setup.get('reused') or self.plan['reused']:  # any sign of an earlier run: its log holds what this run must not lose
            rl = await self.read_persisted_log()
            if not rl or rl.get('found') is not True:
                o['concerns'].append('resume: review log not read, so accepted risks and human inputs of the earlier run may be missing')
            else:
                self.restore_from_log(rl, ['%s:T%d' % (E, n) for n in awaiting + launch_open])
        o['externalRun'].extend(self.missing(o['externalRun'], [{'item': '%s:T%d' % (E, t['n']), 'title': t['title'], 'status': 'confirmed by mark', 'reviewed': False} for t in tasks if t['n'] in prog['effectCompleted']], 'x => x.item'))
        self.annotate_human()
        # In doubt whether an external effect happened: stop and ask, never repeat it. Only the person's commit reopens or closes the task.
        doubtful = [t for t in tasks if t['n'] in launch_open or (t['n'] in may_have_run and t['n'] not in done_map)]
        if doubtful:
            for t in doubtful:
                op('human-input', E, 'external task %s ("%s") of %s was launched and no conclusion was recorded: its external effect may or may not have happened, and nothing was run again' % (t['n'], t['title'], E),
                   'Check whether the effect happened (externalDedupe: %s). If it did, add an empty commit on %s with the subject "%s T%d: external effect completed"; the task then counts as done and goes to review. If you confirmed it did not, add an empty commit with the subject "%s T%d awaiting person: confirmed not run"; the task then runs again. Then run with this resumeWith. Without one of those commits the run stops here again.' % (
                       t.get('externalDedupe') or 'none declared', br, E, t['n'], E, t['n']),
                   dict(A, authorizeExternal=self.bound_items(), deliverables=[E]))
            # Nothing is written on the branch while the effect is in doubt (not even the review log): the open mark stays the newest commit for the person to judge.
            o['error'] = 'external task %s was launched with no recorded conclusion: its external effect may have happened' % doubtful[0]['n']
            o['failKind'] = 'humano'
            o['branch'] = br
            o['worktree'] = wt
            return o
        # A replan can declare external a task already committed: it will not run, but its commits must not go on without the person seeing them.
        late = self.held_tasks([t for t in tasks if t['n'] in done_map])
        if late:
            for h in late:
                x = h['x']
                op('authorize-external', E, 'task %s ("%s") of %s is already committed on %s, but the current plan declares it external and it is not authorized' % (x['n'], x['title'], E, br),
                   'Check its commits on %s. It is already committed and will not run again: authorizing "%s" accepts that work as it is and lets the deliverable go on. If the effect must not stand or never happened, revert those commits first (externalDedupe: %s)' % (br, h['item'], x.get('externalDedupe') or 'none declared'),
                   dict(A, authorizeExternal=self.bound_items() + [h['item']], deliverables=[E]), {'item': h['item']})
            self.op_tasks(self.held_tasks([t for t in tasks if t['n'] not in done_map]))
            self.op_evidence(self.held_evidence())
            o['held'] = late[0]['item']
            return await self.fail('externo', 'committed task %s is now declared external and awaits authorization (%s)' % (late[0]['x']['n'], late[0]['item']))

        head = prog['head']
        task_log = []
        o['tasks'] = task_log  # a stop inside the loop still reports the tasks already done
        for t in tasks:
            n = t['n']
            tn = '%s T%d' % (E, n)
            resumed = done_map.get(n)
            # A later task stopped for a person ran after this one passed its reviews, and its commits are not this task's scope.
            if resumed and (n < last_done or any(a > n for a in awaiting)):
                task_log.append({'n': n, 'title': t['title'], 'status': 'RESUMED (already reviewed)'})
                seen = next((e for e in o['externalRun'] if e.get('item') == '%s:T%d' % (E, n)), None)
                if seen:
                    seen['reviewed'] = True
                continue
            earlier = next((d for d in prog['done'] if d['n'] == n), None) if n in awaiting else None
            start = resumed['firstParent'] if resumed else (earlier['firstParent'] if earlier else head)  # a re-run may add nothing to the commits of the run that stopped
            run_rec_note = ' A commit "%s: run record (...)" is bookkeeping, not extra scope.' % E
            bookkeeping_note = (' The range may hold this task\'s commits from a run that stopped for a person: commits with the subject "%s awaiting person:", "%s awaiting person (effect may have run):", "%s awaiting person (effect unknown):", "%s launching", "%s started", "%s: external effect completed", "%s: resumed after awaiting person" or "%s: review log" are bookkeeping and not extra scope. The spec %s and the plan %s, committed by this resume, may be in the range too and are not extra scope.%s'
                                % (tn, tn, tn, tn, tn, tn, tn, E, self.spec['specPath'], self.plan['planPath'], run_rec_note))
            range_note = bookkeeping_note if (earlier or (resumed and t.get('external') is not False)) else (run_rec_note if resumed else '')
            completion = 0  # the completion mark of this run sits inside the range and is not the implementer's commit
            started = 0     # so does the started mark the implementer writes first
            locks = [x for x in as_list(t.get('needsLock')) if x in R.task_locks]
            # A task committed by an earlier run is never launched again, so its fixes do not get the effect either.
            authorized_ext = t.get('external') is not False and self.external_hold(t) is None
            if not resumed:
                held = self.held_tasks([x for x in tasks if x['n'] not in done_map and x['n'] >= n])
                if held and held[0]['x']['n'] == n:
                    self.op_tasks(held)
                    self.op_evidence(self.held_evidence())  # one question lists every external item of the plan
                    o['held'] = held[0]['item']
                    return await self.fail('externo', 'external task %s awaits authorization (%s)' % (n, held[0]['item']))
            m_tier, m_effort = pure('[implModel(p), implEffort(p)]', t)
            impl_model = call_lib(ROOT, 'agyModelFor(p.t, p.e)', {'t': m_tier, 'e': m_effort})  # the Gemini model is chosen at the dispatch only

            async def run_impl(lk, t=t, authorized_ext=authorized_ext):
                prompt = pure('buildImplPrompt(p.c, p.t)', {'c': self.ctx_for(locks=lk, authorizedExternal=authorized_ext), 't': t})
                return await self.ask('implementer', prompt, 'S_IMPL', model=impl_model, body=self.body('implementer'))

            impl = {'status': 'DONE', 'summary': 'resumed: task already committed by a previous run; no checks reported, run the task verifications yourself', 'checks': []}
            if not resumed:
                if authorized_ext:
                    # Durable proof that the effect may have started, written before it can start: without it the implementer does not run.
                    mk = self.commit_mark('%s launching' % tn)
                    if not mk:
                        return await self.fail('infra', 'task %s: the launch mark could not be written, so the external task was not started' % n)
                    if not earlier:
                        start = mk
                        started = 1  # the marks are not this task's commits
                    range_note = bookkeeping_note
                impl = await run_impl(locks)
                if impl and impl.get('status') == 'BLOCKED' and impl.get('needsLock') in R.task_locks and impl['needsLock'] not in locks:
                    locks = locks + [impl['needsLock']]
                    impl = await run_impl(locks)
                if not impl:
                    return await self.fail('infra', 'task %s: null implementer' % n)
                human.extend(self.missing(human, impl.get('humanInputs') or [], 'humanKey'))
                if impl.get('concerns'):
                    o['concerns'].append('T%s: %s' % (n, impl['concerns']))
                if impl['status'] == 'BLOCKED':
                    return await self.fail('conteudo', 'task %s BLOCKED: %s%s' % (n, impl.get('summary'), ('; its launch mark stays open: before running again add `%s awaiting person: confirmed not run` if the effect did not start' % tn) if authorized_ext else ''))
                if authorized_ext and impl['status'] == 'NEEDS_HUMAN':
                    return await self.stop_for_person(t, impl)
                if impl['status'] in ('DONE', 'DONE_WITH_CONCERNS'):
                    if authorized_ext:
                        self.record_run(t, impl['status'])  # the implementer reports the effect done: true even if a review rejects the task later
                    if authorized_ext or n in awaiting:
                        closed = self.close_effect(t, n in awaiting)
                        if closed and not earlier and authorized_ext:
                            completion = 1
            gap = pure('testFirstGap(p.t, p.i, p.r)', {'t': t, 'i': impl, 'r': bool(resumed)})
            if gap:
                return await self.fail('conteudo', '%s. A rerun takes the task as done and skips this check: %s' % (gap, 'ask the owner, as its effect or wait marks count as done' if (authorized_ext or n in awaiting) else
                                       'first drop its commits, keeping the review log: git -C "%s" rebase --onto %s <last task commit> %s' % (wt, start, br)))
            cur = {'summary': impl.get('summary'), 'checks': impl.get('checks') or []}  # refreshed by each fix so the reviewer sees real output
            tr = R.cfg.get('taskReview') or {}
            TR = {'restricted': tr.get('restricted') is True}
            no_files = pure('noFiles(p)', t)
            last_r = None
            for kind in ('spec', 'quality'):
                cxs = {}

                async def review(rnd, prev, rv=None, was=None, kind=kind, cxs=cxs, t=t, locks=locks, start=start, range_note=range_note, cur=cur):
                    cx = self.ctx_for(locks=locks, start=start, round=rnd, prev=prev, rangeNote=range_note, taskReview=TR, pluginRoot=R.root, was=was,
                                      diffPath='%s/_tmp/%s-t%d-%s%s.diff' % (R.wt, E, t['n'], kind, rnd))
                    cxs['cx'] = cx
                    prompt = pure('buildTaskReviewPrompt(p.c, p.t, p.k, p.i)', {'c': cx, 't': t, 'k': kind, 'i': cur})
                    return await self.ask_ro('task-reviewer', prompt, 'S_TASKREVIEW', body=self.body('task-reviewer'))

                async def fix(iss, k, tier, kind=kind, t=t, locks=locks, cur=cur, authorized_ext=authorized_ext, resumed=resumed):
                    ext = ('The external effect of this task already ran (the implementer reported it done): do not run it again, not even through its duplicate check; checks only read. If this fix needs the effect run again, return NEEDS_HUMAN and say why.'
                           if (authorized_ext and not resumed) else pure('externalNote(false, p)', t))
                    prompt = '%s\n\nIn Task %s of the plan %s, fix the %s problems below, run the task\'s checks and commit "%s T%s: fix ...". %s STOP after this fix. %s %s\n%s' % (
                        self.C(), t['n'], self.plan['planPath'], kind, E, t['n'], ext, self.lock_note(locks), self.no_spec_edit(), pure('fmt(p)', iss))
                    fx = await self.ask('task-fix', prompt, 'S_IMPL', model=tier, body=self.body('implementer'))
                    if fx:
                        if fx.get('checks'):
                            cur['checks'] = fx['checks']
                        if fx.get('summary'):
                            cur['summary'] = fx['summary']
                    return fx

                def truth(r, cxs=cxs, kind=kind, start=start, impl=impl, completion=completion, started=started, no_files=no_files):
                    needs = impl.get('status') == 'NEEDS_HUMAN'
                    return pure('reviewTruth(Object.assign({}, p.r, { issues: taskIssues(p.r, p.c) }), p.m, p.l, p.k)', {
                        'r': r, 'c': cxs.get('cx'), 'm': 0 if needs else (0 if no_files else 1) + completion + started, 'l': '%s..HEAD' % start, 'k': 0 if needs else completion + started})

                halt = (lambda fx, a=authorized_ext, rs=bool(resumed): a and not rs and fx.get('status') == 'NEEDS_HUMAN')
                loop = await run_review_loop(self.review_env(), 'T%s:%s' % (n, kind), review, fix, truth, {'tier': impl_model, 'reviewModel': 'pro', 'haltOn': halt, 'byId': True})
                if loop.get('halted'):
                    return await self.stop_for_person(t, loop['halted'], True)
                if not loop.get('ok'):
                    return await self.fail(loop.get('kind'), 'task %s: %s' % (n, loop.get('msg')))
                last_r = loop['r']
            head = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
            task_log.append({'n': n, 'title': t['title'], 'status': impl['status'], 'commits': last_r.get('commitsInRange')})
            ran = next((e for e in o['externalRun'] if e.get('item') == '%s:T%d' % (E, n)), None)
            if ran:
                ran['reviewed'] = True
        o['tasks'] = task_log
        self.annotate_human()
        return None

    # ---- sync with the target and the final review
    async def sync_branch(self, ref, frm, role='sync'):
        """git merge --no-ff of `ref` into the branch, by git. A conflict is a judgement: the sync agent (flash; `resync` on the late
        sync) resolves it and the script checks that the merge really ended. Returns { ok, head, conflictsResolved, details, targetTip, deltaFiles, record }."""
        E, wt = self.E, self.wt
        before = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
        m = git_in(wt, 'merge', '--no-ff', ref, '-m', '%s: sync with %s' % (E, R.target), '-m', R.trailer)
        conflicts = 0
        details = ''
        ok = m['exit'] == 0
        if not ok:
            un = [x for x in git_in(wt, 'diff', '--name-only', '--diff-filter=U')['stdout'].splitlines() if x.strip()]
            conflicts = len(un)
            if un:
                conflict_txt = (' Rules for generated files: %s.' % R.cfg['conflictRules']) if R.cfg.get('conflictRules') else ''
                prompt = ('%s\n\nBring the target state into the branch: the merge of %s into %s stopped with conflicts in: %s. Resolve them keeping both parts.%s Do not use any shared resource. Finish the merge with git commit --no-edit; one simple command per call.' % (
                    self.Cs(), ref, wt, ', '.join(un), conflict_txt))
                r = await self.ask(role, prompt)
                ended = (r is not None and git_in(wt, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')['exit'] != 0
                         and not git_in(wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip() and git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip() != before)
                ok = ended
                details = '' if ok else 'the conflicts in %s were not resolved' % ', '.join(un)
            else:
                details = (m['stderr'] or m['stdout']).strip()
            if not ok:
                git_in(wt, 'merge', '--abort')
        rec = run_cli(['node', R.root + '/scripts/run-record.mjs', 'key', wt, self.ap['dir']])
        return {'ok': ok, 'head': git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip(), 'conflictsResolved': conflicts if ok else 0, 'details': details,
                'targetTip': git_in(wt, 'rev-parse', ref)['stdout'].strip(),
                'deltaFiles': [x for x in git_in(wt, 'diff', '--name-only', '%s..%s' % (frm, ref))['stdout'].splitlines() if x.strip()], 'record': rec['stdout'] if rec['exit'] == 0 else ''}

    async def review_conflicts(self, sha, label, d=None):
        """The review (read-only) of the resolution of a merge conflict: a part of one branch lost, duplicated code, a generated file resolved by hand.
        `d` is the worktree of the merge (the deliverable worktree on a sync, the integration worktree on the merge)."""
        d = d or self.wt
        prompt = ('%s\n\nReview (read-only) the conflict resolutions of the merge %s in %s: git -C "%s" show --cc %s. Blocks (defeito): a part of one of the branches lost, duplicated code, a generated file resolved by hand, inconsistent counts in docs. Measure headSha, clean, commitsInRange=1.' % (
            self.C(), sha, d, d, sha))
        cr = await self.ask_ro('conflict-review', prompt, 'S_REVIEW', wt=d)
        if not cr:
            return {'ok': False, 'kind': 'infra', 'why': 'conflict resolution review: null agent'}
        bl = pure('blocking(p)', cr)
        self.out['reviews'].append(dict({'stage': label, 'rounds': [{'round': 1, 'reviewModel': 'pro', 'fixTier': None}], 'unresolved': bl}, **pure('compact(p)', cr['issues'])))
        if _hard(bl, R.blq):
            return {'ok': False, 'kind': 'conteudo', 'why': 'conflict resolution rejected: %s' % pure('fmt(p)', bl)}
        self.accept_risks(label, bl)
        return {'ok': True}

    async def final_stage(self):
        """Sync with the last validated tip, test-integrity and the final review of the whole branch (pro), fixes up the ladder from flash."""
        E, o, wt = self.E, self.out, self.wt
        plan_locks = [n for n in dict.fromkeys(x for t in self.plan['tasks'] for x in as_list(t.get('needsLock'))) if n in R.task_locks]
        sync_at = R.last_good
        self.sync_at = sync_at  # the late sync of the merge stage reviews the delta of the target since this tip
        self.my_base = json.loads(json.dumps(R.baseline))  # baseline of syncAt (captured with it)
        sync = await self.sync_branch(sync_at, sync_at)
        if not sync['ok']:
            return await self.fail('conteudo', 'sync with %s failed: %s' % (R.target, sync['details']))
        if sync['conflictsResolved'] != 0:  # a resolution is reviewed in full, as on the late sync
            rc = await self.review_conflicts(sync['head'], '%s:sync-review' % E)
            if not rc['ok']:
                return await self.fail(rc['kind'], rc['why'])
        self.sync = sync
        key = pure('runKey(p)', sync['record']) if sync.get('record') else None
        skip_fin = self.skip_rev('final', True, key, sync['targetTip'])
        self.skip_fin = skip_fin
        integ = None
        if R.test_integrity and not skip_fin:
            integ = measure_integrity(R.test_integrity, R.repo, '%s/_tmp/%s-integrity-wt' % (R.wt, E), git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip(), R.target)
            if integ['removedAsserts'] < 0:
                o['concerns'].append('test integrity not measured')
        alerts = pure('integrityAlerts(p)', integ)
        fr = R.cfg.get('finalReview') or {}
        card = self.card
        body = self.body('final-reviewer')

        async def review(rnd, prev, rv=None, was=None):
            rs = []
            for lens in (['correctness', 'security'] if card.get('critical') else ['all']):
                prompt = '%s\n\nMode: review, lens: %s. Diff: git -C "%s" diff %s...HEAD\nSpec %s, plan %s, %s.%s%s' % (
                    self.C(), lens, wt, R.target, self.spec['specPath'], self.plan['planPath'], self.card_ref,
                    ('\nAlerts: %s.' % '; '.join(alerts)) if alerts else '', ('\nPrevious issues (%s):\n%s' % (repeat_rule(), prev)) if prev else '')
                x = await self.ask_ro('final-reviewer', prompt, 'S_REVIEW', body=body)
                if not x:
                    return None
                rs.append(x)
            r = dict(rs[0], issues=[i for x in rs for i in (x.get('issues') or [])], clean=all(x.get('clean') for x in rs))
            bl = pure('blocking(p)', r)
            if fr.get('adversarial') is True and bl:
                v = await call_agent('final-reviewer', '%s\n\nMode: verify.\n%s' % (self.C(), pure('fmt(p)', bl)), SCHEMAS['S_VERIFY'], None, body)
                sp = pure('splitRefuted(p.bl, p.v)', {'bl': bl, 'v': v})
                r['issues'] = [i for i in r['issues'] if i not in bl] + sp['keep']
                o['reviews'].append({'stage': 'final-verify', 'round': rnd, 'refuted': sp['refuted']})
            return r

        async def fix(iss, k, tier):
            prompt = '%s\n\nFix the final review problems below and commit "%s final-fix: ...". %s %s\n%s' % (self.C(), E, self.lock_note(plan_locks), self.no_spec_edit(), pure('fmt(p)', iss))
            return await self.ask('final-fix', prompt, 'S_IMPL', model=tier, body=self.body('implementer'))

        def truth(r):
            return pure('reviewTruth(p.r, 1, p.l)', {'r': r, 'l': '%s..HEAD' % R.target})

        loop = {'ok': True} if skip_fin else await run_review_loop(self.review_env(), 'final', review, fix, truth,
                                                                     {'tier': STAGE_MODELS['final-fix'], 'reviewModel': 'pro', 'once': fr.get('singleWave') is True})
        if not loop.get('ok'):
            return await self.fail(loop.get('kind'), loop.get('msg'))
        self.plan_locks = plan_locks
        return None

    # ---- the gates of the branch (+ reviewed fix); every criterion is proved by a command that ran
    def ac_exec(self):
        return pure('normalizePlanAc(p.c, p.a).filter(p => VERIFY_EXEC.includes(p.kind) && p.command).map(p => ({ ...p, command: commandKey(p.command) }))', {'c': self.card_ac, 'a': self.plan['ac']})

    def external_evidence_note(self):
        rows = [p for p in self.ac_exec() if p.get('external') is not False]
        if not rows:
            return ''
        return '\nThe person AUTHORIZED the external effect of these evidence commands: %s. Run one again only if that command is what failed, and only after its duplicate check: %s.' % (
            ' ; '.join(p['command'] for p in rows), '; '.join('%s: %s' % (p['ac'], p.get('externalDedupe') or 'none declared') for p in rows))

    def run_evidence(self, exp):
        """The command of every criterion with automatic evidence, by run_shell on the branch, after the state preparation (beforeEvidence)."""
        o, wt = self.out, self.wt
        rows = self.ac_exec()
        if not rows and not R.before_evidence:
            return {'ok': True, 'summary': ''}
        head = git_in(wt, 'rev-parse', 'HEAD')['stdout'].strip()
        clean = not git_in(wt, '--no-optional-locks', 'status', '--porcelain')['stdout'].strip()
        before_ok = True
        for c in R.before_evidence:
            if sh(c, wt)['exit'] != 0:
                before_ok = False
                break
        results = []
        if before_ok:
            for p in rows:
                r = sh(p['command'], wt)
                results.append({'ac': p['ac'], 'command': p['command'], 'exit': r['exit'], 'log': tail_text(r['stdout'] + r['stderr'], 600)})
        ev = {'headSha': head, 'clean': clean, 'beforeOk': before_ok, 'results': results}
        if not pure('validEvidence(p.x, p.e, p.n)', {'x': ev, 'e': exp, 'n': len(R.before_evidence) > 0}):
            return {'ok': False, 'infra': True, 'summary': 'evidence measurement null, with a dirty tree, at the wrong commit or with the state preparation failing'}
        problems = []
        for i, p in enumerate(rows):
            x = pure('matchEvidence(p.r, p.row, p.i)', {'r': results, 'row': p, 'i': i})
            if x and p.get('external') is not False and x.get('exit') == 0:  # only an effect that happened; a failed re-run does not erase an earlier success
                o['externalRun'] = [e for e in o['externalRun'] if not (e.get('item') == '%s:%s' % (self.E, p['ac']) and e.get('command') == p['command'])]
                o['externalRun'].append({'item': '%s:%s' % (self.E, p['ac']), 'command': p['command'], 'exit': x['exit']})
            if not x:
                problems.append('criterion %s: command not run' % p['ac'])
            elif x.get('exit') != 0:
                problems.append('criterion %s: "%s" exited %s: %s' % (p['ac'], p['command'], x.get('exit'), str(x.get('log') or '')[:600]))
        self.annotate_human()
        return {'ok': not problems, 'summary': '\n'.join(problems)}

    async def branch_gates(self, tag, first_exp):
        E, o, wt = self.E, self.out, self.wt
        exp = first_exp
        k = 0
        while True:
            g = await run_gates(wt, self.my_base, exp)
            o['gates'] = g['summary']
            if g['nullAgent']:
                return {'ok': False, 'kind': 'infra', 'msg': 'gates: %s' % g['summary']}
            fail_text = 'gates not green (%s): %s' % (', '.join(g['failures']), g['summary'])
            if g['ok']:
                o['brM'] = g['m']
                ev = self.run_evidence(g['m']['headSha'])
                if ev['ok']:
                    return {'ok': True, 'head': g['m']['headSha']}
                if ev.get('infra'):
                    return {'ok': False, 'kind': 'infra', 'msg': ev['summary']}
                fail_text = 'gates green, but the evidence failed:\n%s' % ev['summary']
            if k >= R.maxfix:
                return {'ok': False, 'kind': 'conteudo', 'msg': 'branch gates did not pass: %s' % fail_text}
            pre_fix = g['m']['headSha']
            prompt = ('%s\n\n%s %s The gates failed against the baseline:\n%s\nFailing output: %s\nRoot cause, a fix with a test when it is a defect, run the failed gate again and commit "%s gates-fix: ...". '
                      'A failure outside the baseline cannot be masked; if it comes from the environment, explain in concerns.%s') % (
                self.C(), self.lock_note(self.plan_locks), self.no_spec_edit(), fail_text, str(g['m'].get('log') or '')[:3000], E, self.external_evidence_note())
            fx = await self.ask('gates-fix', prompt, 'S_IMPL', body=self.body('implementer'))
            if not fx:
                return {'ok': False, 'kind': 'infra', 'msg': 'gates fix: null agent'}
            if fx.get('status') == 'BLOCKED':
                return {'ok': False, 'kind': 'conteudo', 'msg': 'gates fix BLOCKED: %s' % fx.get('summary')}
            if fx.get('concerns'):
                o['concerns'].append('%sgates-fix%d: %s' % (tag, k + 1, fx['concerns']))
            rp = ('%s\n\nReview (read-only) the gates fix: git -C "%s" diff %s..HEAD. Blocks (defeito): a fix that masks a test, relaxes an assertion, skips a suite, edits the baseline or introduces a defect, an edit to the spec or the plan. '
                  'Measure headSha, clean, commitsInRange (git rev-list --count %s..HEAD).') % (self.C(), wt, pre_fix, pre_fix)
            rr = await self.ask_ro('gates-fix-review', rp, 'S_REVIEW')
            if not rr:
                return {'ok': False, 'kind': 'infra', 'msg': 'gates fix review: null agent'}
            bl = pure('blocking(p)', rr)
            if _hard(bl, R.blq):
                return {'ok': False, 'kind': 'conteudo', 'msg': 'gates fix rejected: %s' % pure('fmt(p)', bl)}
            self.accept_risks('%sgates-fix%d' % (tag, k + 1), bl)
            o['reviews'].append(dict({'stage': '%sgates-fix%d' % (tag, k + 1), 'rounds': [{'round': 1, 'reviewModel': 'pro', 'fixTier': STAGE_MODELS['gates-fix']}], 'unresolved': bl}, **pure('compact(p)', rr['issues'])))
            await self.persist_reviews('gates')  # committed before re-measuring
            exp = None
            k += 1

    # ---- merge, post-merge gates, rollback, docs and cleanup (serialized: one deliverable at a time)
    def head_of(self, d):
        return git_in(d, 'rev-parse', 'HEAD')['stdout'].strip()

    def is_clean(self, d):
        r = git_in(d, '--no-optional-locks', 'status', '--porcelain')
        return r['exit'] == 0 and not r['stdout'].strip()

    @staticmethod
    def fmt_risk(x):
        return '%s: [%s/%s] %s' % (x.get('stage'), x.get('severity'), x.get('category'), x.get('description'))

    def mark_broken(self, why, kind='conteudo', do_now=None):
        """A merge already on the target that failed validation: it cannot be undone without a human decision (work may sit on top)."""
        E, br, wt, iw = self.E, self.br, self.wt, R.int_wt
        R.integ_broken = 'the merge of %s is already on %s and %s: %s' % (E, R.target, 'could not be validated' if kind == 'infra' else 'failed validation', why)
        dn = do_now or (('Fix the environment and run again with deliverables:["%s"] (the run resumes as validate-and-document); if you decide to drop the merge: git -C "%s" revert -m 1 <merge>' % (E, iw))
                        if kind == 'infra' else
                        ('Fix it on %s and run again with deliverables:["%s"]. To undo: git -C "%s" revert -m 1 <merge>, delete the branch %s and the worktree %s, and run again (the deliverable restarts from scratch)' % (R.target, E, iw, br, wt)))
        op('merge-rejected', E, R.integ_broken, dn, dict(A, deliverables=[E]))
        return {'ok': False, 'broken': True, 'kind': kind, 'why': why}

    def rollback_to(self, pre_sha):
        """The rollback of a merge that did not pass, by git in the integration worktree: abort a merge in progress, reset to the commit
        before the merge (the last validated tip), clean what the merge left and prune the worktrees. The S_ROLLBACK data come from git."""
        E, iw = self.E, R.int_wt

        def rb(why, kind='conteudo'):
            if git_in(iw, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')['exit'] == 0:
                git_in(iw, 'merge', '--abort')
            reset = git_in(iw, 'reset', '--hard', pre_sha)
            if not R.foreign:  # the preflight found it clean: what is left untracked now came from the merge stage
                git_in(iw, 'clean', '-fd')
            git_in(R.repo, 'worktree', 'prune')
            st = git_in(iw, '--no-optional-locks', 'status', '--porcelain')
            left = [x for x in st['stdout'].splitlines() if x.strip()]
            res = {'ok': reset['exit'] == 0 and st['exit'] == 0, 'head': self.head_of(iw), 'clean': st['exit'] == 0 and not left, 'leftovers': left}
            self.out['rollback'] = res
            if not res['ok'] or not pure('gateShaMatch(p.a, p.b)', {'a': res['head'], 'b': pre_sha}) or res['clean'] is False:
                R.integ_broken = 'the rollback of %s did not confirm %s at %s and clean (%s)' % (E, R.target, pre_sha, json.dumps({'head': res['head'], 'leftovers': left}, ensure_ascii=True))
                op('integration', E, R.integ_broken, 'Restore it by hand: git -C "%s" reset --hard %s and confirm a clean git status' % (iw, pre_sha),
                   dict(A, deliverables=[x for x in R.order if x != E]))
            else:
                R.last_good = pre_sha
            return {'ok': False, 'kind': kind, 'why': why}
        return rb

    async def log_on_target(self, what, data, subject):
        """A note the review log of the deliverable on the target must keep (risks accepted or evidence effects run after the last branch log):
        the review-log agent (flash) edits the file, the script commits only it. Returns the new head, or None."""
        iw = R.int_wt
        prompt = '%s\n\nIntegration worktree %s (branch %s). %s %s (create it if there is none), keeping everything the file holds: %s\nDo not commit: the caller commits only that file.' % (
            self.Cs(), iw, R.target, what, self.ap['reviews'], json.dumps(data, ensure_ascii=True))
        w = await self.ask('review-log', prompt)
        if w is None:
            return None
        cm = commit_file(iw, self.ap['reviews'], subject)
        return cm['head'] if cm.get('ok') and cm.get('commit') else None

    async def persist_merge_risks(self, frm, exp):
        o = self.out
        fresh = o['acceptedRisks'][frm:]
        if not fresh:
            return exp
        h = await self.log_on_target('Risks were accepted during the merge of %s. Add them to the accepted risks of its review log on %s,' % (self.E, R.target), fresh, '%s: accepted merge-stage risks' % self.E)
        if not h:
            o['concerns'].append('merge-stage accepted risks not committed to the review log: %s' % '; '.join(self.fmt_risk(x) for x in fresh))
            return exp
        return h

    async def persist_merge_effects(self, exp):
        o = self.out
        ran = [e for e in o['externalRun'] if e.get('command')]
        if not ran:
            return exp
        h = await self.log_on_target('In the section "External effects run" of the review log of %s on %s, add one line per entry (item, command, exit) that is not there yet, in' % (self.E, R.target), ran, '%s: external effects of the acceptance evidence' % self.E)
        if not h:
            o['concerns'].append('external effects not committed to the review log, so a resume of this merge would not know they ran: %s' % ', '.join(e['item'] for e in ran))
            return exp
        return h

    async def review_fixes_after_merge(self, merge_sha):
        """Work committed on the target after the merge was never reviewed: review it (pro) on every re-run. None when clear, or the broken result."""
        E, iw = self.E, R.int_wt
        argv = pure('postMergeFixArgs(p.m, p.rm, p.d)', {'m': merge_sha, 'rm': R.rm, 'd': R.docs_paths})
        r = git_in(iw, *argv)
        if r['exit'] != 0:
            return self.mark_broken('the probe for commits after the merge %s did not confirm a valid range' % merge_sha, 'infra')
        listed = []
        for ln in r['stdout'].splitlines():
            if ln.strip():
                sha, _, subj = ln.partition('\t')
                listed.append({'sha': sha.strip(), 'subject': subj})
        commits = pure('postMergeFixes(p.c, p.E)', {'c': listed, 'E': E})
        if not commits:
            return None
        names = ', '.join('%s (%s)' % (c['sha'], c['subject']) for c in commits)
        prompt = ('%s\n\nReview (read-only) the commits that sit on %s after the merge %s of %s, never reviewed: %s. Read each one with git -C "%s" show <sha>, then the files they touch as they are at HEAD. Judge the NET STATE AT HEAD of those commits: a defect reverted or corrected by a later commit of this list does not block; report only what remains at HEAD. Changes of other deliverables in those files are not under review. '
                  'Blocks (defeito): masking a test, relaxing an assertion, skipping a suite, editing the baseline, introducing a defect. Measure headSha, clean, commitsInRange (how many of the listed commits you actually read).') % (self.C(), R.target, merge_sha, E, names, iw)
        rv = await self.ask_ro('resume-fix-review', prompt, 'S_REVIEW', wt=iw)
        if not rv:
            return self.mark_broken('the review of the commits after the merge returned nothing: %s' % names, 'infra', 'Run again with deliverables:["%s"] to repeat the review. Commits: %s' % (E, names))
        hard = pure('reviewTruth(p.r, p.n, p.l).filter(i => isHard(i, p.blq))', {'r': rv, 'n': len(commits), 'l': 'the %d commits listed after %s' % (len(commits), merge_sha), 'blq': R.blq})
        if hard:
            return self.mark_broken('the commits after the merge were rejected: %s; commits: %s' % (pure('fmt(p)', hard), names), 'conteudo',
                                    'Correct the problem on %s with a later commit, or revert the commits (git -C "%s" revert <sha>), then run again with deliverables:["%s"]. The review judges the net state at HEAD, so a defect reverted or corrected later no longer blocks. Commits: %s' % (R.target, iw, E, names))
        self.accept_risks('resume-merge-fix', pure('blocking(p)', rv))
        return None

    def docs_measure(self):
        """DOCS.measure: a Node program the script runs in the integration worktree (no model); it prints {"ok": bool, "details": str}."""
        f = '%s/_tmp/%s-docs-measure.cjs' % (R.wt, self.E)
        try:
            os.makedirs(os.path.dirname(f), exist_ok=True)
            with open(f, 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(R.docs['measure'])
            r = run_cli(['node', f], cwd=R.int_wt)
        finally:
            try:
                os.remove(f)
            except OSError:
                pass
        lines = [ln for ln in r['stdout'].splitlines() if ln.strip()]
        try:
            j = json.loads(lines[-1])
            return {'measureOk': j.get('ok') is True, 'measureDetails': str(j.get('details') or '')}
        except (IndexError, ValueError, AttributeError):
            return {'measureOk': False, 'measureDetails': 'exit %s: %s' % (r['exit'], tail_text(r['stderr'] or r['stdout'], 300))}

    def changed_paths(self, d):
        r = git_in(d, 'status', '--porcelain', '-z', '-uall')
        parts = r['stdout'].split('\0')
        out = []
        i = 0
        while i < len(parts):
            e = parts[i]
            i += 1
            if len(e) < 4:
                continue
            out.append(e[3:])
            if 'R' in e[:2] or 'C' in e[:2]:
                if i < len(parts) and parts[i]:
                    out.append(parts[i])
                i += 1
        return out

    async def docs_stage(self, merge_commit):
        """The roadmap part (the exact tracker CLI commands, run through verify-run.mjs and judged over raw outputs) and, when configured,
        the project docs (docs, flash), committed by the script; DOCS.measure is a program run by the script. Two rounds for the agent part."""
        E, o, iw = self.E, self.out, R.int_wt
        spec_txt = self.spec_ref or self.ap['spec']
        plan_txt = self.plan_ref or self.ap['plan']
        reviews_txt = self.ap['reviews'] if self.spec_ref else '(review log of the branch %s, if any)' % self.br
        pend = pure(PURE_DOCS_PENDING_JS, {'lang': R.lang, 'cellChars': R.cell_chars, 'mark': RAN_MARK, 'risks': o['acceptedRisks'], 'human': self.human,
                                           'acOpen': o.get('acOpen') or [], 'E': E, 'planTxt': plan_txt})
        if pend['maybe']:
            o['concerns'].append('human items whose external effect this run already ran were left out of the roadmap pending list; add back any that still states an open need: %s' % '; '.join(pend['maybe']))
        refs = [merge_commit, 'gates %s' % ', '.join(g['name'] for g in R.gates), spec_txt, plan_txt, reviews_txt]
        rec = record_status(E, R.status_after, refs, {'pending': pend['pending'], 'inflight': {'remove': self.br}, 'source': reviews_txt, 'statusEvidence': [merge_commit]})
        if rec:
            o['recordCuts'].extend(rec['cuts'])
            bc = pure('parseCli(p)', rec.get('brief')) if rec.get('brief') else None
            if bc and isinstance(bc.get('result'), dict) and bc['result'].get('checker'):
                R.checkers[E] = bc['result']['checker']
        rec_fail = [] if rec and rec['ok'] else ['roadmap record: %s' % self.failed_record(rec)]
        instr = R.docs.get('instructions')
        measure = {}
        agent_fail = []
        docs_measure = None
        for k in range(2):
            agent_fail = []
            if instr:
                prompt = ('%s\n\nDOCS STAGE of deliverable %s in the integration worktree %s (branch %s); merge %s. Only this stage edits the project docs.\n'
                          'Project docs: %s\nThe roadmap folder %s is already recorded by the workflow: do not edit it. Never record a human act (acceptance, go/no-go, credentials) as done. Do not commit: the caller commits the files you changed.%s') % (
                    self.Cn(), E, iw, R.target, merge_commit, instr, R.rm,
                    ('\nFIX ROUND. The independent measurement found: %s. Fix what it lists%s.' % (json.dumps(docs_measure, ensure_ascii=True), ' (measureOk must be true)' if R.docs.get('measure') else '')) if k else '')
                d = await self.ask('docs', prompt)
                if d is None:
                    agent_fail.append('null docs agent')
                files = [f for f in self.changed_paths(iw) if not slash(f).startswith(R.rm)]
                if files:
                    git_in(iw, 'add', '--all', '--', *files)
                    c = git_in(iw, 'commit', '-q', '-m', 'docs: %s on %s' % (E, R.target), '-m', R.trailer)
                    if c['exit'] != 0:
                        agent_fail.append('docs commit failed: %s' % (c['stderr'].strip() or c['stdout'].strip()))
            measure = self.docs_measure() if R.docs.get('measure') else {}
            clean = self.is_clean(iw)
            docs_measure = dict({'failures': rec_fail + agent_fail, 'clean': clean, 'head': self.head_of(iw)}, **measure)
            ok = not rec_fail and not agent_fail and clean and (not R.docs.get('measure') or measure.get('measureOk') is True)
            if ok or not instr:
                break
        docs_ok = not docs_measure['failures'] and docs_measure['clean'] and (not R.docs.get('measure') or measure.get('measureOk') is True)
        if docs_ok and docs_measure['head']:
            R.last_good = docs_measure['head']
        return docs_ok, docs_measure

    async def post_merge(self, merge_commit, conflicts, on_bad, first_exp):
        """Post-merge gates (one reviewed merge-fix: flash, reviewed on pro), the baseline refresh, then the docs stage."""
        E, o, iw = self.E, self.out, R.int_wt
        exp = first_exp
        k = 0
        while True:
            floor = pure('mergeFloor(p.b, p.m)', {'b': R.baseline, 'm': o.get('brM')})
            g = await run_gates(iw, floor, exp, '%s^1..HEAD' % merge_commit)
            if g['ok']:
                break
            if k >= 1 or g['nullAgent']:
                return await _call(on_bad, 'post-merge gates failed: %s' % g['summary'], 'infra' if g['nullAgent'] else 'conteudo')
            pre_fix = g['m']['headSha']
            prompt = '%s\n\nIntegration worktree %s (branch %s). %s The post-merge gates of %s failed:\n%s\nFailing output: %s\nFix on %s with a test and commit "%s merge-fix: ...". Do not mask failures. %s' % (
                self.Cn(), iw, R.target, self.lock_note(R.task_locks), E, g['summary'], str(g['m'].get('log') or '')[:3000], R.target, E, self.no_spec_edit())
            fx = await self.ask('merge-fix', prompt, 'S_IMPL', body=self.body('implementer'))
            if not fx or fx.get('status') == 'BLOCKED':
                return await _call(on_bad, 'post-merge fix %s' % (('BLOCKED: %s' % fx.get('summary')) if fx else 'null'), 'conteudo' if fx else 'infra')
            if fx.get('concerns'):
                o['concerns'].append('merge-fix: %s' % fx['concerns'])
            rp = ('%s\n\nReview (read-only) the post-merge fix: git -C "%s" diff %s..HEAD. Blocks (defeito): masking a test, relaxing an assertion, skipping a suite, introducing a defect, an edit to the spec or the plan. Measure headSha, clean, commitsInRange.') % (self.Cn(), iw, pre_fix)
            rr = await self.ask_ro('merge-fix-review', rp, 'S_REVIEW', wt=iw)
            bl = pure('blocking(p)', rr) if rr else []
            if not rr or _hard(bl, R.blq):
                return await _call(on_bad, 'post-merge fix rejected: %s' % (pure('fmt(p)', bl) if rr else 'null agent'), 'conteudo' if rr else 'infra')
            risk_from = len(o['acceptedRisks'])
            self.accept_risks('merge-fix', bl)
            o['reviews'].append(dict({'stage': 'merge-fix', 'rounds': [{'round': 1, 'reviewModel': 'pro', 'fixTier': STAGE_MODELS['merge-fix']}], 'unresolved': bl}, **pure('compact(p)', rr.get('issues'))))
            exp = await self.persist_merge_risks(risk_from, self.head_of(iw))
            k += 1
        R.baseline = pure('refreshBaseline(p.b, p.d, p.m, p.c)', {'b': R.baseline, 'd': R.gates, 'm': g['m'], 'c': g['m']['changedFiles']})
        R.last_good = g['m']['headSha']
        docs_ok, docs_measure = await self.docs_stage(merge_commit)
        return {'ok': True, 'mergeCommit': merge_commit, 'conflicts': conflicts, 'gates': g['summary'], 'docsOk': docs_ok, 'docsMeasure': docs_measure}

    async def late_sync(self):
        """Another deliverable landed after the last sync of this branch: sync again (resync, flash), review a resolved conflict and the
        delta of the target (pro), then measure the gates of the branch again. Returns the new validated head, or a failed merge result."""
        E, br, wt = self.E, self.br, self.wt
        rs = await self.sync_branch(R.target, self.sync_at, role='resync')
        if not rs['ok']:
            return {'ok': False, 'kind': 'conteudo', 'why': 're-sync failed: %s' % rs['details']}
        if rs['conflictsResolved'] != 0:
            rc = await self.review_conflicts(rs['head'], '%s:resync-review' % E)
            if not rc['ok']:
                return rc
        if pure('needsDeltaReview(p.f, p.rm, p.d)', {'f': rs['deltaFiles'], 'rm': R.rm, 'd': R.docs_paths}):
            prev_sync = self.sync_at
            tip = rs['targetTip'] or R.target

            async def review(rnd, prev, rv=None, was=None):
                prompt = ('%s\n\nLATE-SYNC REVIEW (read-only). Other deliverables landed on %s after the last sync of this branch. Review ONLY what they brought: git -C "%s" diff %s..%s, against this branch (spec %s, %s).\n'
                          'Blocks (defeito): a contract of the incoming change that this branch breaks or that breaks this branch (callers, schemas, permissions, generated files), a criterion of the card no longer proved, a duplicated or conflicting definition%s.%s\n'
                          'Measure: headSha, clean, commitsInRange=0 is fine here.') % (
                    self.C(), R.target, wt, prev_sync, tip, self.spec['specPath'], self.card_ref, ', an edit to the spec or the plan made by a fix round' if prev else '',
                    ('\nPrevious issues (verify them; %s):\n%s' % (repeat_rule(), prev)) if prev else '')
                return await self.ask_ro('delta-review', prompt, 'S_REVIEW')

            async def fix(iss, k, tier):
                prompt = '%s\n\nFix the late-sync review problems below on the branch %s (worktree %s), with tests, and commit "%s resync-fix: ...". %s %s\n%s' % (
                    self.C(), br, wt, E, self.lock_note(self.plan_locks), self.no_spec_edit(), pure('fmt(p)', iss))
                return await self.ask('delta-fix', prompt, 'S_IMPL', model=tier, body=self.body('implementer'))

            dl = await run_review_loop(self.review_env(), 'delta', review, fix, lambda r: pure('reviewTruth(p, 0, "")', r), {'tier': STAGE_MODELS['delta-fix'], 'reviewModel': 'pro'})
            if not dl.get('ok'):
                return {'ok': False, 'kind': dl.get('kind'), 'why': 'late-sync review: %s' % dl.get('msg')}
        self.sync_at = rs['targetTip'] or self.sync_at
        self.my_base = json.loads(json.dumps(R.baseline))
        await self.persist_reviews('resync')  # conflict and delta reviews go into the log before the final measurement
        rg = await self.branch_gates('re', None)
        if not rg['ok']:
            return {'ok': False, 'kind': rg['kind'], 'why': 'gates after the re-sync: %s' % rg['msg']}
        return {'ok': True, 'head': rg['head']}

    async def merge_block(self, validated_head):
        """The merge of the validated branch into the target, by git in the integration worktree (git merge --no-ff); a conflict goes to
        the merge agent (flash) and its resolution to conflict-review (pro). A merge that does not pass is rolled back by git."""
        E, br, iw = self.E, self.br, R.int_wt
        if R.integ_broken:
            return {'ok': False, 'kind': 'infra', 'why': 'integration worktree compromised: %s' % R.integ_broken}
        if not self.is_clean(iw):
            R.integ_broken = 'integration worktree %s dirty before the merge of %s' % (iw, E)
            op('integration', E, R.integ_broken, 'Clean or commit the integration worktree (git -C "%s" status) and run again' % iw, dict(A))
            return {'ok': False, 'kind': 'infra', 'why': R.integ_broken}
        pre_sha = self.head_of(iw)
        has_target = git_in(R.repo, 'merge-base', '--is-ancestor', R.target, br)['exit'] == 0
        merged = git_in(R.repo, 'merge-base', '--is-ancestor', br, R.target)['exit'] == 0
        if not has_target and not merged:
            ls = await self.late_sync()
            if not ls['ok']:
                return ls
            validated_head = ls['head']
        if merged:
            loc = git_in(iw, 'rev-list', '--first-parent', '--reverse', '--ancestry-path', '%s..HEAD' % br)
            sha = (loc['stdout'].splitlines() or [''])[0].strip()
            second = git_in(iw, 'rev-parse', sha + '^2')['stdout'].strip() if sha else ''
            tip = git_in(iw, 'rev-parse', br)['stdout'].strip()
            if loc['exit'] != 0 or not sha or not second or not pure('gateShaMatch(p.a, p.b)', {'a': second, 'b': tip}):
                return self.mark_broken('the branch %s is on %s but its merge commit could not be located' % (br, R.target), 'infra')
            bad = await self.review_fixes_after_merge(sha)
            if bad:
                return bad
            return await self.post_merge(sha, 0, self.mark_broken, pre_sha)
        rollback = self.rollback_to(pre_sha)
        m = git_in(iw, 'merge', '--no-ff', br, '-m', 'merge: %s in %s' % (E, R.target), '-m', R.trailer)
        conflicts = 0
        if m['exit'] != 0:
            un = [x for x in git_in(iw, 'diff', '--name-only', '--diff-filter=U')['stdout'].splitlines() if x.strip()]
            conflicts = len(un)
            if not un:
                return rollback('the merge did not complete: %s' % ((m['stderr'] or m['stdout']).strip()), 'conteudo')
            conflict_txt = (' Rules for generated files: %s.' % R.cfg['conflictRules']) if R.cfg.get('conflictRules') else ''
            prompt = ('%s\n\nMERGE STAGE of deliverable %s in the integration worktree %s (branch %s).%s The merge of %s stopped with conflicts in: %s. Resolve them keeping both parts.%s Do not use any shared resource. '
                      'Finish the merge with git commit --no-edit; one simple command per call. If you cannot finish, git merge --abort.') % (
                self.Cs(), E, iw, R.target, (' The operator authorized %s: this merge may be done in that checkout.' % R.foreign_item) if R.foreign else '', br, ', '.join(un), conflict_txt)
            mg = await self.ask('merge', prompt)
            ended = (mg is not None and git_in(iw, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')['exit'] != 0 and self.is_clean(iw) and self.head_of(iw) != pre_sha)
            if not ended:
                return rollback('the merge did not complete: %s' % ('null agent' if mg is None else 'the conflicts in %s were not resolved' % ', '.join(un)), 'infra' if mg is None else 'conteudo')
        merge_commit = self.head_of(iw)
        par = git_in(iw, 'rev-parse', 'HEAD^1')
        par2 = git_in(iw, 'rev-parse', 'HEAD^2')
        mg = {'mergeCommit': pure('fullRef(p)', merge_commit), 'firstParent': par['stdout'].strip() if par['exit'] == 0 else '',
              'secondParent': par2['stdout'].strip() if par2['exit'] == 0 else '', 'conflicts': conflicts, 'clean': self.is_clean(iw)}
        if not mg['clean'] or not mg['mergeCommit'] or pure('gateShaMatch(p.a, p.b)', {'a': merge_commit, 'b': pre_sha}):
            return rollback('the merge did not complete: %s' % ('the integration worktree is not clean after it' if not mg['clean'] else 'no merge commit'), 'conteudo')
        if not pure('mergeParentsOk(p.mg, p.pre, p.v)', {'mg': mg, 'pre': pre_sha, 'v': validated_head}):
            return rollback('the merge commit %s has first parent %s and second parent %s, expected %s and the validated head %s: the second parent does not match' % (
                merge_commit, mg['firstParent'], mg['secondParent'], pre_sha, validated_head), 'conteudo')
        first_exp = merge_commit
        if conflicts:
            risk_from = len(self.out['acceptedRisks'])
            rc = await self.review_conflicts(merge_commit, '%s:merge-review' % E, iw)
            if not rc['ok']:
                return rollback(rc['why'], rc['kind'])
            first_exp = await self.persist_merge_risks(risk_from, first_exp)
        first_exp = await self.persist_merge_effects(first_exp)
        return await self.post_merge(merge_commit, conflicts, rollback, first_exp)

    def cleanup(self):
        """The cleanup of a merged deliverable, by subprocess: its processes (verify-run.mjs procs), its worktree (a dirty one is saved as a
        patch first, and kept when the patch cannot be written), its _tmp entries (the -dirty folders stay) and its merged branch."""
        E, wt = self.E, self.wt
        left = []
        nonce = '%s:%s:procs' % (R.run_tag, E)
        pr = run_cli(['node', R.verify_run, 'procs', _enc_arg({'nonce': nonce, 'wt': wt, 'ports': [self.port, self.port + 9]})])
        v = _check_run(pr['stdout'], 'verify-run', nonce)
        if v.get('ok'):
            left.extend('pid %s: %s' % (f.get('pid'), f.get('error')) for f in (v['data'].get('failed') or []))
            left.extend(str(u) for u in (v['data'].get('unchecked') or []))
        else:
            left.append('processes of %s not checked: %s' % (E, v.get('why') or pr['stderr'].strip()))
        registered = any(same_path(w['path'], wt) for w in worktrees(R.repo))
        if registered:
            keep = False
            if not self.is_clean(wt):
                d = self.save_patch('cleanup')
                if d:
                    self.out['concerns'].append('cleanup: uncommitted files of %s saved in %s' % (wt, d))
                else:
                    keep = True
                    left.append('%s: dirty and its patch could not be written, so it was not removed' % wt)
            if not keep:
                rm = git_in(R.repo, 'worktree', 'remove', '--force', wt)
                if rm['exit'] != 0:
                    left.append('%s: %s' % (wt, rm['stderr'].strip()))
        tmp = R.wt + '/_tmp'
        if os.path.isdir(tmp):
            for name in os.listdir(tmp):
                if name.startswith(E + '-') and not name.endswith('-dirty'):
                    p = os.path.join(tmp, name)
                    try:
                        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
                    except OSError as e:
                        left.append('%s: %s' % (slash(p), e))
        if not A.get('keepBranches') and git_in(R.repo, 'rev-parse', '--verify', '--quiet', 'refs/heads/' + self.br)['exit'] == 0:
            b = git_in(R.int_wt, 'branch', '-d', self.br)
            if b['exit'] != 0:
                left.append('branch %s: %s' % (self.br, b['stderr'].strip()))
        return left

    async def close_out(self, result):
        """Closes the deliverable from the result of the merge block."""
        E, o = self.E, self.out
        if result.get('broken'):
            o['merged'] = True
            o['broken'] = True
            o['concerns'].append('merge on the target without validation: %s' % result.get('why'))
            return o
        if not result.get('ok'):
            return await self.fail(result.get('kind'), 'not merged: %s' % result.get('why'))
        o['merged'] = True
        o['ok'] = True
        o['merge'] = result
        if not result.get('docsOk'):
            o['concerns'].append('docs with pending items after 2 rounds: %s' % json.dumps(result.get('docsMeasure'), ensure_ascii=True))
            op('docs', E, 'docs or roadmap inconsistent after the merge of %s: %s' % (E, json.dumps(result.get('docsMeasure'), ensure_ascii=True)), 'Fix the record and run the roadmap checker on the target', None)
        left = self.cleanup()
        if left:
            o['concerns'].append('incomplete cleanup: %s' % ', '.join(left))
        _log('%s: merged into %s (%s)' % (E, R.target, result.get('mergeCommit')))
        return o

    async def merge_stage(self, validated_head):
        return await self.close_out(await self.merge_block(validated_head))

    async def finish_merge(self):
        """A merge already on the target without a post-merge status: validate and document it, do not redo the deliverable."""
        E, o, card, iw = self.E, self.out, self.card, R.int_wt
        sha = card.get('mergeSha')
        _log('%s: merge %s already on the target without a record; validating and documenting' % (E, sha or '?'))
        if not sha:
            return await self.close_out(self.mark_broken('a merge of this deliverable is on the target but the discovery did not identify its commit, so it cannot be validated', 'conteudo',
                                                         'Identify the merge commit (git -C "%s" log --first-parent --grep "^merge: %s "), then revert it (git revert -m 1) or fix the roadmap record, and run again with deliverables:["%s"]' % (iw, E, E)))
        rl = await self.read_persisted_log(iw)  # the interrupted run held the human acts and accepted risks in memory
        found = isinstance(rl, dict) and rl.get('found') is True
        o['acOpen'] = pure('criteriaOpen(p.c, p.a)', {'c': self.card_ac, 'a': (rl.get('ac') or []) if found else []})
        if not found:
            o['concerns'].append('resume: review log not read, so accepted risks and human inputs may be missing')
        else:
            self.restore_from_log(rl)
        return await self.close_out(await self.finish_block(sha))

    async def finish_block(self, sha):
        E, o, iw = self.E, self.out, R.int_wt
        if R.integ_broken:
            return {'ok': False, 'kind': 'infra', 'why': 'integration worktree compromised: %s' % R.integ_broken}
        named = [n for r in R.baseline.values() for n in ((r or {}).get('failedNames') or [])]
        if named and not R.accept_red:
            return self.mark_broken('the baseline was measured with this merge already on the target and has named failures that may come from it: %s' % ', '.join(named), 'conteudo',
                                    'Compare those failures with the commit before the merge (%s^1). If they already existed, run again with acceptRedBaseline:true; otherwise fix them on %s' % (sha, R.target))
        bad = await self.review_fixes_after_merge(sha)
        if bad:
            return bad
        # the branch measure is gone on a resume, so the count floor uses a baseline that already holds the merge: measure what the merge did to the tests
        integ = measure_integrity(R.test_integrity, R.repo, '%s/_tmp/%s-integrity-wt' % (R.wt, E), sha, sha + '^1') if R.test_integrity else None
        if not integ or integ['removedAsserts'] < 0:
            o['concerns'].append('resume: the test-count floor was not verified for the merge %s (test integrity %s)' % (sha, 'not measured' if R.test_integrity else 'disabled'))
        for a in pure('integrityHeuristicAlerts(p)', integ):
            o['concerns'].append('resume: test integrity of the merge %s: %s' % (sha, a))
        hard = pure('integrityHardAlerts(p)', integ)
        if hard:
            if pure('integrityAckMatches(p.a, p.E, p.s)', {'a': A.get('acceptIntegrityAlerts'), 'E': E, 's': sha}):
                o['concerns'].append('the operator accepted (acceptIntegrityAlerts) the test integrity alerts of the merge %s: %s' % (sha, '; '.join(hard)))
            else:
                ack = dict(A.get('acceptIntegrityAlerts') or {}) if isinstance(A.get('acceptIntegrityAlerts'), dict) else {}
                ack[E] = sha
                return self.mark_broken('the merge %s weakened the tests: %s' % (sha, '; '.join(hard)), 'conteudo',
                                        'These alerts come from the merge itself, so a later fix does not clear them on a re-run. Check each one, then either undo it: git -C "%s" revert -m 1 %s, delete the branch %s and the worktree %s, and run again (the deliverable restarts from scratch); or, only if you decide to accept the merge as it is, add acceptIntegrityAlerts:%s yourself to the args and run again with deliverables:["%s"] (the resume args below leave it out on purpose, so they re-measure and stay broken)' % (
                                            iw, sha, self.br, self.wt, json.dumps(ack, separators=(',', ':'), ensure_ascii=True), E))
        return await self.post_merge(sha, 0, self.mark_broken, None)  # commits may exist after the merge

    # ---- the deliverable
    async def run(self):
        E, o, wt, br = self.E, self.out, self.wt, self.br
        if R.foreign and not R.foreign_ok:
            return await self.fail('externo', 'the target %s is checked out in %s and %s is not authorized' % (R.target, R.int_wt, R.foreign_item))
        if MODE == 'run' and pure('resumeAction(p.c, p.s)', {'c': self.card, 's': R.statuses}) == 'finish-merge':
            return await self.finish_merge()
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
        self.fp = pure('planFingerprint(p.tasks, p.blob)', {'tasks': self.plan['tasks'], 'blob': self.plan['planBlob']})
        R.bound[E] = self.fp

        extra = {'rulings': o.get('rulings') or [], 'pending': [h['what'] for h in self.human if h.get('blocking') is not True], 'source': self.ap['reviews']}
        refs = [self.spec['specPath'], self.plan['planPath']]
        if MODE == 'plan-only':  # the roadmap record, then the log, then done
            rec = record_status(E, R.statuses['plan'], refs, extra)
            if rec:
                o['recordCuts'].extend(rec['cuts'])
            if not rec or not rec['ok']:
                return await self.fail('infra', 'plan-only: the roadmap record failed (%s)' % self.failed_record(rec))
            ran_sp = (not spec_skip) or (not plan_skip)
            if o['recordCuts'] or ran_sp:
                await self.persist_reviews('record' if o['recordCuts'] else 'plan', 'spec,plan' if ran_sp else None)
            o['planOnly'] = True
            o['ok'] = True
            return o

        # ---------- run: the executing record, the tasks, the sync and final review, the gates of the branch
        rec_run = record_status(E, R.statuses['executing'], refs, dict(extra, inflight={'add': br, 'note': ''}))
        if rec_run:
            o['recordCuts'].extend(rec_run['cuts'])
        if not rec_run or not rec_run['ok']:
            o['concerns'].append('the "executing" roadmap record failed (%s); decisions and the in-flight entry are not recorded yet' % self.failed_record(rec_run))
        failed = await self.tasks_stage(setup, spec_skip, plan_skip)
        if failed is not None:
            return failed
        # Held before the final review: nothing past here is spent without authorization.
        ev_held = self.held_evidence()
        if ev_held:
            self.op_evidence(ev_held)
            o['held'] = ev_held[0]['item']
            return await self.fail('externo', 'external evidence of criterion %s awaits authorization (%s)' % (ev_held[0]['ac'], ev_held[0]['item']))
        failed = await self.final_stage()
        if failed is not None:
            return failed
        await self.persist_reviews('', None if self.skip_fin else 'final', self.sync['targetTip'])  # before the final measurement, which then includes it
        bg = await self.branch_gates('', None)
        if not bg['ok']:
            return await self.fail(bg['kind'], bg['msg'])
        if R.target == R.integ:
            crit = [x for x in o['acceptedRisks'] if x.get('severity') == 'critical']
            if crit and E not in (A.get('acceptRisks') or []):
                risks = '\n'.join('%s: [%s/%s] %s' % (x['stage'], x.get('severity'), x.get('category'), x.get('description')) for x in crit)
                return await self.fail('decisao', 'direct merge into %s with an accepted critical risk; review it and pass acceptRisks:["%s"]:\n%s' % (R.target, E, risks))
        return await self.merge_stage(bg['head'])


# ---------------------------------------------------------------- plan-only: scheduling by dependencies and the final result
PURE_HOLD_JS = r"""(() => {
  const h = heldBy({ cards: p.cards, selected: p.order, contractDecisions: [...p.pend, ...p.dyn], started: [...p.started, ...p.begun] }).get(p.id)
  return h ? holdReason(h) : ''
})()"""


def hold_of(E):
    return pure(PURE_HOLD_JS, {'cards': R.cards, 'order': R.order, 'pend': R.pend_contract, 'dyn': R.dyn_contract, 'started': R.started, 'begun': R.begun, 'id': E})


async def run_deliverable(E, idx):
    d = Deliverable(E, idx)
    R.deliv[E] = d
    try:
        return await d.run()
    except ReadOnlyViolation as e:
        return await d.fail('infra', str(e))


def _slim(r):
    s = {'id': r['id'], 'merged': bool(r.get('merged')), 'broken': bool(r.get('broken')), 'planOnly': bool(r.get('planOnly')), 'skipped': r.get('skipped'), 'error': r.get('error'),
         'failKind': r.get('failKind'), 'held': r.get('held'), 'branch': r.get('branch'), 'spec': r.get('spec'), 'plan': r.get('plan'),
         'merge': ({'commit': r['merge'].get('mergeCommit'), 'conflicts': r['merge'].get('conflicts'), 'gates': r['merge'].get('gates'), 'docsOk': r['merge'].get('docsOk')} if r.get('merge') else None),
         'tasks': len(r.get('tasks') or []), 'concerns': r.get('concerns') or [], 'acceptedRisks': r.get('acceptedRisks') or [], 'decisions': len(r.get('decisions') or []),
         'human': [('%s: ' % h['blq'] if h.get('blq') else '') + str(h.get('what')) for h in (r.get('human') or [])][:12]}
    return {k: v for k, v in s.items() if v is not None}


async def blocked_record(E, r):
    """A deliverable that stopped for a defect, a decision or a person is recorded as blocked on the target (run mode); the cut texts go to its log."""
    d = R.deliv.get(E)
    source = d.ap['reviews'] if d else pure('artifactPaths(p.slug, p.E)', {'slug': R.disc['roadmapSlug'], 'E': E})['reviews']
    rec = record_status(E, R.statuses['blocked'], ['branch ' + r['branch'] if r.get('branch') else R.rm + 'state.md'],
                        {'reason': 'automatic execution stopped (%s): %s; branch %s kept at %s' % (r.get('failKind'), str(r['error'])[:400], r.get('branch'), r.get('worktree')), 'source': source})
    if rec and rec['cuts']:
        r['recordCuts'] = list(r.get('recordCuts') or []) + rec['cuts']
        if d:
            await d.persist_reviews('blocked-record')


async def run_deliverables(disc, plan, cfg, token, items, gates, selection):
    """plan-only and run modes: the preflight (plan-only: steps 1, 2 and 5; run: also the setup commands and the baseline of the gates), then per
    deliverable, one after the other, setup, spec, plan and the roadmap record (plan-only) or the tasks, the final review and the gates (run)."""
    init_run(disc, plan, cfg, token, items, gates)
    R.root = ROOT
    if MODE == 'run':
        try:
            R.test_integrity = load_test_integrity(ROOT + '/' + RELEASE_JS_REL, cfg)
        except (OSError, RuntimeError) as e:
            return err('test-integrity program unavailable: %s' % e)
    _phase('Preflight')
    pre = await preflight()
    R.pre = pre
    foreign_hold = R.foreign and not R.foreign_ok
    if (not pre.get('ok') or not pre.get('integrationWorktree') or (MODE != 'plan-only' and not pre.get('baseline') and not foreign_hold)
            or (MODE != 'plan-only' and not foreign_hold and not pre.get('targetHead'))):
        kind = pre.get('errorKind') or 'other'
        op('preflight:%s' % kind, None, pre.get('error') or 'incomplete preflight',
           ('Clean or commit the listed files in the integration worktree of %s' % R.target) if kind == 'dirty' else ('Fix the environment setup command and run again' if kind == 'setup' else 'Read the error and fix the environment'), dict(A))
        return mk_result('needs-operator', selection=selection)
    R.int_wt = pre['integrationWorktree']
    for g in (pre.get('baseline') or {}).get('gates') or []:
        if isinstance(g, dict) and g.get('name'):
            R.baseline[g['name']] = g
    th = pre.get('targetHead') or ''
    R.last_good = th if re.match(r'^[0-9a-f]{40,64}$', th) else R.target  # target tip already validated
    if MODE == 'run' and not foreign_hold:
        if not pure('validMeasure(p.b, p.h, p.d)', {'b': pre.get('baseline'), 'h': pre.get('targetHead'), 'd': R.gates}):
            op('preflight:baseline-invalid', None, 'the baseline measure is invalid: %s' % '; '.join(pure('measureProblems(p.b, p.h, p.d)', {'b': pre.get('baseline'), 'h': pre.get('targetHead'), 'd': R.gates})),
               'Check the integration worktree and the gate commands, then run again', dict(A))
            return mk_result('needs-operator', selection=selection)
        red = pure('isRedBaseline(p.d, p.b)', {'d': R.gates, 'b': R.baseline})
        if red and not R.accept_red:
            zero = pure('zeroTestGates(p.d, p.b)', {'d': R.gates, 'b': R.baseline})
            op('preflight:red-baseline', None, 'baseline of %s is red in: %s' % (R.target, ', '.join(red)),
               ('Fix the command of %s so it runs tests, or set kind: exit on it in release.config.json if it is not a test suite. An explicitly accepted red baseline is honoured, but a tests gate with total 0 fails any deliverable that adds no tests' % ', '.join(zero))
               if zero else 'Fix the target (or the environment) before running; with a red baseline the matching gates stop blocking regressions. To accept it anyway, pass acceptRedBaseline:true', dict(A))
            return mk_result('needs-operator', selection=selection)
    R.abs_folder = R.int_wt.rstrip('/') + '/' + R.rm.rstrip('/')

    # ---- scheduling: the order of the selection already respects the dependencies; one deliverable at a time.
    # Interrupted merges finish (validate and document) before any new deliverable; one that does not finish validated stops every later merge.
    _phase('Plan')
    finish = [E for E, a in zip(R.order, pure('p.ids.map(id => resumeAction(p.by[id], p.s))', {'ids': R.order, 'by': R.by_id, 's': R.statuses})) if MODE == 'run' and a == 'finish-merge']
    done = {}
    for E in finish + [x for x in R.order if x not in finish]:
        idx = R.order.index(E)
        r = None
        for dep in R.by_id[E].get('deps') or []:
            if dep not in done:
                continue  # dependency already on the target, or (for an interrupted merge) a new one that waits for it
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
            if E in finish and not r.get('ok') and not R.integ_broken:
                R.integ_broken = 'the interrupted merge of %s did not finish validation: %s' % (E, r.get('error') or 'not ok')
            if r.get('error') and not r.get('skipped'):
                fk = r.get('failKind')
                if fk == 'externo':
                    pass  # waiting for the person: no defect, no blocked status
                elif fk == 'infra':
                    op('infra', E, r['error'], 'Run again (the stages reuse spec, plan and commits)', dict(A, deliverables=[E]))
                else:
                    notes = dict(A.get('notes') or {})
                    if fk == 'conteudo':
                        kept = notes.get(E) if notes.get(E) and E not in R.notes_read else '<owner instruction>'
                        op('defect', E, r['error'], 'Read the review log on the branch %s; adjust the spec or plan, or pass an instruction in notes, and run again' % r.get('branch'),
                           dict(A, deliverables=[E], notes=dict(notes, **{E: kept})))
                    if fk == 'decisao':
                        op('decision', E, r['error'], r.get('doNow') or 'Decide (a new DEC or a revision of the existing one) and run again with the decision in notes',
                           dict(A, deliverables=[E], notes=dict(notes, **{E: '<owner decision>'})))
                    if MODE != 'plan-only':
                        await blocked_record(E, r)
        done[E] = r
    RESULTS.extend(done[E] for E in R.order)
    return await finish_run(selection)


async def finish_run(selection):
    """The result of a plan-only or run invocation (the Report section of the .js): the git truth by verify-run.mjs check (run mode, by
    subprocess), the report written by the report agent (flash) and committed by the script on the target, the resume args."""
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
    foreign_hold = R.foreign and not R.foreign_ok
    # Final deterministic check: what the run claims is compared with git itself (verify-run.mjs check, signed, by subprocess).
    truth = None
    divergences = []
    if MODE != 'plan-only':
        claims = [{'id': r['id'], 'commit': r['merge']['mergeCommit']} for r in RESULTS if r.get('merged') and r.get('merge') and r['merge'].get('mergeCommit')]
        nonce = '%s:check' % R.run_tag
        payload = {'nonce': nonce, 'repo': R.repo, 'intwt': R.int_wt, 'wtRoot': R.wt, 'target': R.target, 'lastGood': R.last_good, 'order': R.order, 'claims': claims,
                   'reported': [{'id': r['id'], 'merged': r['merged'], 'broken': r['broken'], 'planOnly': r['planOnly']} for r in slim], 'integBroken': bool(R.integ_broken or foreign_hold)}
        ck = run_cli(['node', R.verify_run, 'check', _enc_arg(payload)])
        v = _check_run(ck['stdout'], 'verify-run', nonce)
        if v.get('ok') and v['data'].get('mode') == 'check' and v['data'].get('truth') and isinstance(v['data'].get('divergences'), list):
            truth, divergences = v['data']['truth'], v['data']['divergences']
        else:
            divergences = ['the git truth check returned nothing (%s): verify the target branch by hand' % (v.get('why') or ck['stderr'].strip() or 'no output')]
    for d in divergences:
        op('divergence', None, d, 'Check git log and git status of the target', None)
    ids = '-'.join(R.order)[:60]
    report_path = pure('reportPathFor(p.t, p.i)', {'t': R.today, 'i': ids})
    write = not (R.integ_broken or foreign_hold)
    ext_run = [e for r in RESULTS for e in (r.get('externalRun') or [])]
    unreviewed = any(e.get('reviewed') is False for e in ext_run)
    where = ("The integration worktree is %s: do NOT write a file or commit, only build the execution report and return the text." % ('compromised' if R.integ_broken else "the person's checkout and was not authorized")
             if not write else 'Write the EXECUTION REPORT to %s/%s. Do not commit: the caller commits only that file on %s.' % (R.int_wt, report_path, R.target))
    prompt = '\n'.join([
        common_slim(), '',
        '%s Write it in the language of the roadmap.' % where,
        'Git truth measured by the script (verify-run.mjs check; null in plan-only mode): %s' % json.dumps(truth, ensure_ascii=True),
        'Divergences between the run and the git truth (each one is already an operator action): %s' % json.dumps(divergences, ensure_ascii=True),
        'Selection: %s' % json.dumps(selection, ensure_ascii=True),
        'Results (summary per deliverable; details in the reviews.md log of each branch, under docs/plans/<roadmap slug>-<E>/): %s' % json.dumps(slim, ensure_ascii=True),
        'Operator actions: %s' % json.dumps([dict(o, resumeWith=pure('withoutConfig(p)', o.get('resumeWith'))) for o in OPS], ensure_ascii=True),
        'Resume args: %s' % json.dumps(pure('withoutConfig(p)', fixed['resume']), ensure_ascii=True),
        'Owner review: %s' % json.dumps(owner, ensure_ascii=True),
        'Authorizations given for this run: %s' % json.dumps(R.items, ensure_ascii=True),
        'External effects authorized and run: %s%s' % (json.dumps(ext_run, ensure_ascii=True), '\nAn entry with reviewed=false ran, or its implementer reported it done, but its task has not passed review in this run (it may not have been reviewed yet): say so, and still never ask for that effect again.' if unreviewed else ''),
        'Content: (1) a table per deliverable (merged/failed/skipped/plan, merge, gates, spec, plan, review log), with divergences from the git truth highlighted; (2) "Operator actions (strictly necessary)", deduplicated and ordered by deadline, with what to do and the resume args; (3) accepted risks, autonomous decisions to ratify in %sdecisions.md, and criteria left open (criteriaOpen) with the human act each needs; the merge of %s into %s and the push are only for the owner to decide; (4) the roadmap checker result per deliverable, as measured after the docs record from brief --json (result.checker: errors, warnings, folder, stale): %s; do not run the checker file yourself; (5) leftovers (strays, worktrees) from the git truth.' % (
            R.rm, R.target, R.integ, json.dumps(R.checkers, ensure_ascii=True)),
        'Be factual. List an action to take only from Operator actions and the open human items of the results (human, criteria left open): never invent an action or resume args. An effect listed as authorized and run already happened: never ask for it again. A human item marked "[%s: ...]" names such an effect: report it as already done and never offer that authorization as an action; any other need the item states stays open. Never state where an external effect came from (this run, an earlier run, a given task) unless the data above or a file you read proves it; otherwise say the origin of an external effect is unknown. Return the report text in report.' % RAN_MARK,
    ])
    rep = await call_agent('report', prompt, {'type': 'object', 'properties': {'report': _STR}, 'required': ['report']})
    report = rep.get('report') if isinstance(rep, dict) else (rep if isinstance(rep, str) else None)
    report = report if isinstance(report, str) and report.strip() else None
    path_out = None
    if report and write:
        if os.path.isfile(R.int_wt + '/' + report_path):
            cm = commit_file(R.int_wt, report_path, 'docs: execution report %s' % ids)
            if cm.get('ok') and cm.get('blob'):
                path_out = report_path
            else:
                op('report', None, 'the execution report %s was written but not committed on %s: %s' % (report_path, R.target, cm.get('error') or 'nothing committed'), 'Commit the file yourself on %s, or rebuild it from this result' % R.target, None)
        else:
            op('report', None, 'the report agent returned the report but did not write %s, so there is no execution report file' % report_path, 'Write the report text of this result to that file and commit it on %s' % R.target, None)
    if not report and MODE != 'plan-only':
        op('report', None, 'the report agent returned nothing, so there is no execution report file', 'Rebuild the report from this result (results, truth, operatorActions)', None)
    all_ok = all(r['merged'] or r['planOnly'] for r in slim)
    needs = any(o.get('kind') != 'note' for o in OPS)  # a note (minBudgetPerDeliverable is ignored) asks for nothing
    return mk_result('needs-operator' if needs else ('done' if all_ok else 'partial'), selection=selection, results=slim, ownerReview=owner, truth=truth,
                     lastGood=R.last_good, resumeArgs=fixed['resume'], reportPath=path_out, report=report)


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
    return await run_deliverables(disc, plan, cfg, token, items, gates, selection)


RESULT = await main()
print(json.dumps(RESULT, ensure_ascii=True))
