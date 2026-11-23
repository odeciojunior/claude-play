# plan-coordinator workflow for the Antigravity (agy) host: the Python twin of coordinator.js.
# Run it with run_workflow(ScriptPath=<this file>, Args={...}); the runtime hands the arguments over as the global `args`,
# runs the script once (no replayed agent() calls) and the script prints its final JSON on stdout. Behaviour reference:
# coordinator.js (same state machine, same events, same stops); what changes is how it is done:
#   - every progress.mjs read/apply, every git command and the test command run as a plain subprocess (shell=False;
#     the test command through Git Bash, never the Windows command shell), so there is no script-runner agent and no token spent on them;
#   - hashes, signatures, routing and the state machine come from lib/*.mjs through agy-bridge.py (node), never from Python;
#   - the implementer runs on agyModelFor(s.tier, s.effort); task-reviewer and final-reviewer run on 'pro';
#   - progress.json keeps the Claude tiers only: no Gemini tier is ever sent to progress.mjs (the model is chosen at dispatch).
#
# ARGS (same as coordinator.js)
#   plan, state, runToken, progress (required), authorizeExternal, answers, test
# RETURN (printed as JSON): { status: 'done', run, wave, map, steps, finalGate, open }
#       | { status: 'stopped', stop: { kind, ... }, resumeArgs } | { status: 'error', error }
import asyncio
import json
import os
import re

AGY_REQUEST_RE = re.compile(r'^(owner|delegate:[^\s\x00-\x1f\x7f-\x9f]+)\Z')
AGY_REQUEST_ERR = ('agy path needs a direct request: args.agyRequestedBy must be "owner" or "delegate:<name>", where <name> is a token with no spaces or control characters (e.g. delegate:plan-reviewer) '
                   '(set only when the owner, or a subagent the owner delegated decision power to, asked to run on Antigravity)')
PROGRESS_SUFFIX = '/skills/plan-coordinator/scripts/progress.mjs'
# Event size caps: the gate question, the failed names kept in the baseline and the command of one progress.mjs apply.
GATE_Q_CAP = 600
NAMES_CAP = 50
CMD_CAP = 6000

# JS helpers that run inside call_lib next to the lib/*.mjs exports (canon and fnv1a come from plan-digest.mjs).
JS_PRELUDE = r"""
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const stateDigest = (s) => fnv1a(JSON.stringify(canon({ ...s, history: [] })));
const parseJson = (text) => {
  const t = String(text == null ? '' : text).trim();
  try { return JSON.parse(t); } catch (e) { /* look for the object inside the text */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
};
const checkSigned = (out, nonce, command) => {
  if (!out || typeof out !== 'object' || Array.isArray(out)) return { ok: false, error: 'signed output is not an object' };
  if (out.tool !== 'progress') return { ok: false, error: 'signed output has the wrong tool' };
  if (out.command !== command) return { ok: false, error: `signed output is not from the ${command} command` };
  if (out.nonce !== nonce) return { ok: false, error: 'signed output has the wrong nonce' };
  const { digest, ...rest } = out;
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, error: 'signed output digest does not match' };
  return { ok: true, error: null };
};
const eventsPayload = (expect, events) => {
  const rest = { expect, events };
  return encodeURIComponent(JSON.stringify({ ...rest, digest: fnv1a(JSON.stringify(canon(rest))) })).replace(/'/g, '%27');
};
const applyCmd = (progress, stateFile, expect, events, nonce) =>
  `node ${shq(progress)} apply ${shq(stateFile)} --events ${shq(eventsPayload(expect, events))} --nonce ${shq(nonce)} --json`;
"""

JS_VERIFY = """
const d = parseJson(p.text);
const v = checkSigned(d, p.nonce, p.command);
return { ok: v.ok, error: v.error, data: v.ok ? d : null };
"""

JS_PREPARE = """
const expect = stateDigest(p.disk);
const after = applyEvents(p.disk, p.events, p.now);
if (!after.ok) return { ok: false, code: after.code, index: after.index };
return { ok: true, expect, want: stateDigest(after.state), payload: eventsPayload(expect, p.events), state: after.state };
"""

# The chunks of consecutive events: each apply command stays under the cap (sized with a 24 character nonce).
JS_CHUNKS = """
const expect = stateDigest(p.disk);
const sizing = 'x'.repeat(24);
const len = (evs) => applyCmd(p.progress, p.state, expect, evs, sizing).length;
const chunks = [];
for (const ev of p.events) {
  const k = chunks.length - 1;
  if (k >= 0 && len([...chunks[k], ev]) <= p.cap) chunks[k].push(ev);
  else chunks.push([ev]);
}
const big = chunks.map((c) => len(c)).find((n) => n > p.cap);
return { chunks, big: big === undefined ? null : big };
"""

# ---------------------------------------------------------------- run-wide state (module globals)
PLUGIN = None
A = None
PROGRESS = None
STATE_FILE = None
RUN_TAG = None
SEQ = 0
S = None  # the state with every queued event applied
DISK = None  # the state as the last signed read or write left it on disk
NOW = None  # the instant of the last signed output: the `at` of every event
ROOT = None
QUEUED = []
SWEPT = False
AGAIN = set()  # steps that passed again after a fix and were committed before
CARRY = {}  # findings of the final review to hand to the next run of a step
REPORTS = {}  # last return of each step's implementer
LOST = {}  # reviews that returned nothing, by step
MAP = None
SCHEMAS = {}
BODIES = {}
AUTH_ITEMS = []

RULES = '\n'.join([
    '- Only modify the files of this step. Other agents are editing other files in parallel right now.',
    '- Do not add or remove dependencies, run code generators, update snapshots or run full builds unless the brief says so: report BLOCKED instead.',
    '- Run targeted checks only; the orchestrator runs the full suite.',
    '- Do not spawn subagents.',
    '- Never commit. The orchestrator commits.',
    "- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless the brief marks the step external and this prompt says it is authorized; then do it exactly as written, once.",
    '- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.',
])


class StateRefused(Exception):
    pass


# ---------------------------------------------------------------- small pure helpers (ported from coordinator.js)
def slash(p):
    return str(p).replace('\\', '/')


def shq(s):
    return "'" + str(s).replace("'", "'\\''") + "'"


def tail_of(text, n=1500):
    t = '' if text is None else str(text)
    return t[len(t) - n:] if len(t) > n else t


def cap_names(lst):
    allv = lst if isinstance(lst, list) else []
    return allv[:NAMES_CAP], max(0, len(allv) - NAMES_CAP)


def gate_question(wave, exit_code, failed_names):
    names, cut = cap_names(failed_names)
    more = ' +%d' % cut if cut > 0 else ''
    head = 'the gate of wave %s failed (exit %s' % (wave, exit_code)
    tail = '); the person decides'
    lst = ', failing: ' + '; '.join(names) if names else ', no failing test name recognized'
    full = head + lst + more + tail
    if len(full) <= GATE_Q_CAP:
        return full
    keep = GATE_Q_CAP - (len(head) + len(more) + len(tail) + 3)
    return head + lst[:max(0, keep)] + '...' + more + tail


def failed_test_names(text):
    names = []
    for raw in re.split(r'\r?\n', '' if text is None else str(text)):
        line = raw.strip()
        m = re.match(r'^not ok \d+ - (.+)$', line) or re.match('^✖ (.+)$', line)
        if not m:
            continue
        name = re.sub(r'\s+\(\d+(?:\.\d+)?ms\)$', '', m.group(1))
        name = re.sub(r'\s+# (?:TODO|SKIP).*$', '', name).strip()
        if not name or re.match(r'^failing tests:?$', name):
            continue
        if name not in names:
            names.append(name)
    return names


def wave_gate_passes(gate, baseline):
    if not gate or not isinstance(gate.get('exit'), int):
        return False
    if gate['exit'] == 0:
        return True
    names = gate.get('failedNames') if isinstance(gate.get('failedNames'), list) else []
    if not names:
        return False
    if not baseline or baseline.get('exit') == 0 or not isinstance(baseline.get('failedNames'), list):
        return False
    return all(n in baseline['failedNames'] for n in names)


def baseline_event(test, out):
    names, cut = cap_names(failed_test_names(out.get('stdout')))
    ev = {'type': 'baseline', 'test': test, 'exit': out['exit'], 'tail': tail_of(out.get('stdout')), 'failedNames': names}
    if cut > 0:
        ev['failedNamesCut'] = cut
    return ev


def baseline_problem(out):
    if out['exit'] != 0:
        return 'the baseline test run exited %s' % out['exit']
    tests = None
    passed = None
    for raw in re.split(r'\r?\n', '' if out.get('stdout') is None else str(out['stdout'])):
        line = raw.strip()
        t = re.match('^(?:#|ℹ) tests (\\d+)$', line)
        p = re.match('^(?:#|ℹ) pass (\\d+)$', line)
        if t:
            tests = int(t.group(1))
        if p:
            passed = int(p.group(1))
    if tests == 0:
        return 'the baseline test run executed 0 tests'
    if passed == 0:
        return 'the baseline test run passed 0 tests'
    return None


def answer_kind(a):
    return a.get('event') if a.get('event') is not None else a.get('type')


def normalize_answer(a):
    if a.get('event') is not None:
        rest = {k: v for k, v in a.items() if k != 'event'}
        rest['type'] = a['event']
        return rest
    return dict(a)


def same_plan(state_path, plan_arg):
    a = re.sub(r'^\./', '', slash(state_path))
    b = slash(plan_arg)
    return a != '' and (b == a or b.endswith('/' + a))


def brief_path(root, plan_path, brief):
    return re.sub(r'/+$', '', slash(root)) + '/' + re.sub(r'[^/]*$', '', slash(plan_path)) + brief


def commit_subject(plan_id, step):
    return '%s T%s: %s' % (plan_id, step['n'], step['title'])


def commit_grep(plan_id, n):
    return '^' + re.sub(r'[.*\[\\^$]', lambda m: '\\' + m.group(0), '%s T%s:' % (plan_id, n))


def parse_log_line(stdout, plan_id, n):
    lines = [ln.strip() for ln in re.split(r'\r?\n', '' if stdout is None else str(stdout)) if ln.strip()]
    line = lines[0] if lines else ''
    m = re.match(r'^([0-9a-f]{40,64}) (.*)$', line)
    return m.group(1) if m and m.group(2).startswith('%s T%s:' % (plan_id, n)) else None


def steps_to_commit(state, again):
    out = [s for s in state['steps'] if s['status'] == 'pass' and s.get('noCommit') is not True and (not s.get('sha') or s['n'] in again)]
    return sorted(out, key=lambda s: s['n'])


def report_event(n, out, at):
    if not isinstance(out, dict) or not isinstance(out.get('status'), str):
        return {'type': 'no-report', 'step': n, 'at': at}
    summary = str(out.get('summary') or '').strip()
    if out['status'] in ('DONE', 'DONE_WITH_CONCERNS'):
        handoff = ' '.join([ln for ln in re.split(r'\r?\n', summary) if ln][:5])[:500]
        return {'type': 'report', 'step': n, 'value': 'pass', 'text': summary[:400], 'handoff': handoff, 'at': at}
    hi = out.get('humanInputs') if isinstance(out.get('humanInputs'), list) else []
    asks = [h.get('what') for h in hi if isinstance(h, dict) and h.get('what')]
    parts = ['%s: %s' % (out['status'], summary), str(out.get('concerns') or '')] + asks
    return {'type': 'report', 'step': n, 'value': 'blocked', 'text': ' | '.join([x for x in parts if x])[:600], 'at': at}


def issues_text(issues):
    lines = []
    for i in issues:
        ident = i['id'] + ' ' if i.get('id') else ''
        cat = '/' + i['category'] if i.get('category') else ''
        f = ' ' + i['file'] if i.get('file') else ''
        lines.append('%s[%s%s]%s %s' % (ident, i.get('severity'), cat, f, i.get('description')))
    return '\n'.join(lines)


def blocking_issues(review):
    out = []
    issues = review.get('issues') if isinstance(review, dict) and isinstance(review.get('issues'), list) else []
    for i in issues:
        if not isinstance(i, dict) or i.get('severity') == 'minor' or i.get('category') in ('fora-do-escopo', 'pelo-plano', 'ambiente'):
            continue
        out.append(i)
    return out


def review_verdict(out):
    if not isinstance(out, dict):
        return {'verdict': 'lost', 'text': ''}
    blocking = blocking_issues(out)
    if not blocking and out.get('spec') != 'fail' and out.get('quality') != 'fail':
        return {'verdict': 'pass', 'text': ''}
    return {'verdict': 'defects', 'text': issues_text(blocking) if blocking else 'the review marked spec or quality as fail without a finding'}


def owning_step(state, issues):
    hits = []
    for i in issues:
        if not i.get('file'):
            continue
        f = slash(i['file'])
        for s in state['steps']:
            if any(f == x or f.endswith('/' + x) for x in (s.get('files') or [])):
                hits.append(s['n'])
    return min(hits) if hits else None


# ---------------------------------------------------------------- the lib bridge (node) and the signed state
def lib(expr, payload=None):
    return call_lib(PLUGIN, expr, payload)


def js(body):
    return '(() => {' + JS_PRELUDE + body + '})()'


def verify_signed(text, nonce, command):
    return lib(js(JS_VERIFY), {'text': text, 'nonce': nonce, 'command': command})


def state_digest(state):
    return lib(js('return stateDigest(p);'), state)


def nonce_of():
    global SEQ
    SEQ += 1
    return '%s-%d' % (RUN_TAG, SEQ)


def progress_read(nonce, page=None):
    argv = ['node', PROGRESS, 'read', STATE_FILE, '--nonce', nonce]
    if page is not None:
        argv += ['--page', str(page)]
    return run_cli(argv + ['--json'])


def read_signed(first):
    """A signed read of progress.mjs (the pages put together, the digest of the whole state checked). A read only, so it repeats."""
    why = ''
    for _ in range(3):
        nonce = A['runToken'] if first else nonce_of()
        v = verify_signed(progress_read(nonce)['stdout'], nonce, 'read')
        if not v['ok']:
            why = v['error']
            continue
        data = v['data']
        st = data.get('state')
        if (not isinstance(st, dict) or st.get('schema') != 'progress/1' or not isinstance(st.get('steps'), list)
                or not isinstance(data.get('root'), str) or not isinstance(data.get('now'), str)):
            why = 'the signed read has no valid progress/1 state'
            continue
        pages = data['pages'] if isinstance(data.get('pages'), int) else 1
        steps = list(st['steps'])
        bad = ''
        for pg in range(1, pages):
            pn = nonce_of()
            pv = verify_signed(progress_read(pn, pg)['stdout'], pn, 'read')
            if not pv['ok']:
                bad = pv['error']
                break
            pd = pv['data']
            if pd.get('page') != pg or pd.get('stateDigest') != data.get('stateDigest') or not isinstance(pd.get('steps'), list):
                bad = 'page %d of the signed read does not belong to the same state' % pg
                break
            steps.extend(pd['steps'])
        if not bad and pages > 1 and state_digest(dict(st, steps=steps)) != data.get('stateDigest'):
            bad = 'the pages of the signed read do not add up to the state they sign'
        if bad:
            why = bad
            continue
        return {'data': dict(data, state=dict(st, steps=steps)) if pages > 1 else data}
    return {'why': why}


def resume_args():
    # What only the person gives (authorizations, answers) and the run token never come back.
    return {k: v for k, v in A.items() if k not in ('runToken', 'authorizeExternal', 'answers', 'agyRequestedBy')}


def stop_with(kind, **extra):
    stop = {'kind': kind}
    stop.update(extra)
    return {'status': 'stopped', 'stop': stop, 'resumeArgs': resume_args()}


def fail_with(error, **extra):
    out = {'status': 'error', 'error': error}
    out.update(extra)
    return out


def divergence(message):
    return stop_with('state-divergence', message=message)


def step_of(n):
    for x in S['steps']:
        if x['n'] == n:
            return x
    return None


def queue(ev):
    """Applies one event to the local state and keeps it for the next write."""
    global S
    e = dict(ev, at=NOW)
    r = lib('applyEvents(p.state, [p.event], p.now)', {'state': S, 'event': e, 'now': NOW})
    if not r.get('ok'):
        raise StateRefused('the progress state refused %s: %s%s' % (e['type'], r.get('code'), ' (%s)' % r['message'] if r.get('message') else ''))
    S = r['state']
    QUEUED.append(e)


def flush_chunk(why, events):
    """One signed apply of consecutive events on top of DISK. None when they are on disk, else the result to return. A write is
    not repeated blindly: an output that does not check leads to a new read, and the chunk is sent again only when the state
    read still has the digest the chunk started from."""
    global DISK, NOW
    prep = lib(js(JS_PREPARE), {'disk': DISK, 'events': events, 'now': NOW})
    if not prep.get('ok'):
        return fail_with('the local state refused the queued events: %s at event %s' % (prep.get('code'), prep.get('index')))
    expect, want = prep['expect'], prep['want']

    def written(now):
        global DISK, NOW
        DISK = prep['state']
        del QUEUED[:len(events)]
        if now:
            NOW = now
        return None

    for attempt in (1, 2):
        nonce = nonce_of()
        out = run_cli(['node', PROGRESS, 'apply', STATE_FILE, '--events', prep['payload'], '--nonce', nonce, '--json'])
        v = verify_signed(out['stdout'], nonce, 'apply')
        if v['ok']:
            data = v['data']
            if data.get('ok') is not True:
                if data.get('code') == 'concurrent-change':
                    return divergence('progress.json changed while the run was writing (concurrent-change); this chunk was not written')
                idx = data.get('index')
                where = ' at event %s (%s)' % (idx, events[idx].get('type') if isinstance(events[idx], dict) else None) if isinstance(idx, int) and 0 <= idx < len(events) else ''
                return fail_with('progress.mjs refused the events: %s%s' % (data.get('code'), where))
            if data.get('stateDigest') != want:
                return divergence('the state written by progress.mjs differs from the state this run computed')
            return written(data.get('now'))
        rd = read_signed(False)
        if 'data' not in rd:
            return fail_with('the output of apply did not check and the state could not be read again: %s' % rd['why'])
        got = state_digest(rd['data']['state'])
        if got == want:
            return written(rd['data']['now'])
        if got != expect or attempt == 2:
            return divergence('the state on disk is neither the one before nor the one after this write')
        NOW = rd['data']['now']
    return fail_with('the events could not be written')


def flush(why):
    """Writes the queued events in order, in signed applies of at most CMD_CAP characters each. None when all are on disk."""
    if not QUEUED:
        return None
    events = list(QUEUED)
    plan = lib(js(JS_CHUNKS), {'disk': DISK, 'events': events, 'progress': PROGRESS, 'state': STATE_FILE, 'cap': CMD_CAP})
    if plan['big']:
        return fail_with('a single event makes an apply command of %d characters, above the limit of %d: not dispatched' % (plan['big'], CMD_CAP))
    chunks = plan['chunks']
    for k, chunk in enumerate(chunks):
        r = flush_chunk('%s-%dof%d' % (why, k + 1, len(chunks)) if len(chunks) > 1 else why, chunk)
        if r:
            return r
    return None


def finish(result):
    """Writes what is queued, then returns the result, unless the write itself fails."""
    return flush('return') or result


# ---------------------------------------------------------------- shell, git and the dispatch of agents
def git(*argv):
    return run_cli(['git', '-C', ROOT] + list(argv))


def files_of(s):
    return s['files'] if isinstance(s.get('files'), list) else []


def brief_of(s):
    return brief_path(ROOT, S['plan']['path'], s['brief'])


def test_cmd():
    return S['run'].get('test') or A.get('test') or 'none'


def run_test():
    """The test command through Git Bash in the repository. None when Git Bash is missing (never the Windows command shell, never a shell string)."""
    try:
        return run_shell(test_cmd(), ROOT)
    except RuntimeError as e:
        if str(e) == 'git-bash-not-found':
            return None
        raise


NO_BASH = ('Git Bash was not found (git-bash-not-found), so the test command cannot run: install Git for Windows (its bin\\bash.exe) '
           'and answer unblock; the System32 bash (WSL launcher) and the Windows command shell are never used')


def stop_no_bash():
    queue({'type': 'block', 'text': NO_BASH})
    return stop_with('ask', question=NO_BASH)


async def call_agent(role, prompt, schema_name, model):
    return await agent(BODIES[role] + '\n\n' + prompt, SCHEMAS[schema_name], role=role, type_name='self', model=model)


def guard_snapshot():
    """git_snapshot (HEAD + porcelain) plus the content of what is already dirty. The files of a step are still uncommitted while it is
    reviewed, so a rewrite of one of them leaves the porcelain line as it was: the diff against HEAD and the bytes of every untracked
    file are part of the snapshot (compared as is, never hashed here)."""
    base = git_snapshot(ROOT)
    diff = run_cli(['git', '--no-optional-locks', 'diff', 'HEAD', '--binary'], cwd=ROOT)
    if diff['exit'] != 0:
        raise RuntimeError('git diff HEAD failed: %s' % diff['stderr'].strip())
    names = run_cli(['git', '--no-optional-locks', 'ls-files', '--others', '--exclude-standard', '-z'], cwd=ROOT)
    if names['exit'] != 0:
        raise RuntimeError('git ls-files failed: %s' % names['stderr'].strip())
    untracked = {}
    for rel in sorted(x for x in names['stdout'].split('\0') if x):
        try:
            with open(os.path.join(ROOT, rel), 'rb') as fh:
                untracked[rel] = fh.read()
        except OSError:
            untracked[rel] = None
    return (base, diff['stdout'], untracked)


async def read_only_agent(role, prompt, schema_name):
    """A reviewer on 'pro'. It runs with the tools of the session, so HEAD, the git status and the content of the dirty files are compared around it."""
    before = guard_snapshot()
    out = await call_agent(role, prompt, schema_name, 'pro')
    return out, guard_snapshot() != before


def impl_prompt(s, defects):
    handoffs = ['HANDOFF T%s: %s' % (d['n'], d['handoff']) for d in (step_of(n) for n in s['deps']) if d and d.get('handoff')]
    prev = 'The previous attempt of this step reported: %s' % s['note'] if not defects and s['attempts'] > 1 and s.get('note') else ''
    if defects:
        head = 'Fix mode. Step T%s of plan %s: %s. A review found these problems; fix each one and change nothing else:\n%s' % (s['n'], S['plan']['id'], s['title'], defects)
    else:
        head = 'Implement step T%s of plan %s: %s.' % (s['n'], S['plan']['id'], s['title'])
    parts = [
        head,
        'Repository: %s. Read the brief of the step first: %s (plan constraints, files, checks and the interfaces this step consumes). Never read the plan file.' % (ROOT, brief_of(s)),
        'Files of this step: %s.' % (', '.join(files_of(s)) if files_of(s) else 'none (this step writes no file)'),
        '\n'.join(handoffs) if handoffs else 'HANDOFF: none (no dependency of this step left a handoff).',
        'This step is external and the owner authorized it (plan:T%s@%s): perform the external effect exactly as the brief says, once, and report what happened.' % (s['n'], S['plan']['digest']) if s.get('external') else '',
        prev,
        'Rules:',
        RULES,
        'Return status (DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_HUMAN), summary (up to 5 lines: what now exists and how downstream steps use it), concerns, humanInputs and checks (the exact command, the real output and the exit code of every verification you ran).',
    ]
    return '\n'.join([p for p in parts if p])


def review_prompt(s, rep):
    paths = ' '.join(shq(f) for f in files_of(s))
    if isinstance(rep, dict) and isinstance(rep.get('checks'), list) and rep['checks']:
        checks = '\n'.join('$ %s\nexit %s\n%s' % (c.get('command'), c.get('exit'), tail_of(c.get('output'), 600)) for c in rep['checks'])
    else:
        checks = '(no checks reported)'
    if not isinstance(rep, dict):
        summary = 'resumed from a previous run: the implementer report of this step was lost with that run; run the step verification commands from the plan yourself'
    else:
        summary = rep.get('summary') or '(no summary)'
    return '\n'.join([
        'Mode: review',
        'Review step T%s of plan %s: %s, in %s. Read-only: never edit, stage or commit.' % (s['n'], S['plan']['id'], s['title'], ROOT),
        'Brief of the step (what it must do): %s.' % brief_of(s),
        'Range: the step is not committed yet. Run git -C %s status --porcelain -- %s and git -C %s diff HEAD -- %s, then read each file of the step.' % (shq(ROOT), paths, shq(ROOT), paths),
        'Summary: %s' % summary,
        checks,
        'Measure: headSha = git rev-parse HEAD; clean = git status --porcelain empty (false is expected while the step is uncommitted); commitsInRange = 0.',
    ])


def prelaunch_prompt(s):
    return '\n'.join([
        'Mode: review',
        'Pre-launch review of external step T%s of plan %s: %s, in %s. Read-only: never edit, stage, commit or run the step.' % (s['n'], S['plan']['id'], s['title'], ROOT),
        'Brief of the step: %s. Read it and check that it names the exact external effect and its target, says how a repeat is avoided (externalDedupe), lists the checks that prove the result and needs nothing that is not written there. Never read the plan file.' % brief_of(s),
        'Files of the step: %s.' % (', '.join(files_of(s)) if files_of(s) else 'none'),
        'Measure: headSha = git -C %s rev-parse HEAD; clean = git status --porcelain empty; commitsInRange = 0. Set spec to fail when the brief cannot be executed once, as written, without asking anyone.' % shq(ROOT),
    ])


def final_prompt():
    base = S['run'].get('base') or 'HEAD'
    steps = '\n'.join('- T%s %s [%s]%s: %s' % (s['n'], s['title'], s['status'], ' (no commit)' if s.get('noCommit') else '', ', '.join(files_of(s)) or 'no files') for s in S['steps'])
    bl = S['run'].get('baseline')
    if bl:
        names = bl.get('failedNames')
        bl_text = 'Baseline of the tests: exit %s%s.' % (bl.get('exit'), ', already failing: ' + '; '.join(names) if names else '')
    else:
        bl_text = 'Baseline of the tests: none recorded.'
    return '\n'.join([
        'Mode: review, lens: all',
        'Final review of the whole change of plan %s (%s/%s), read-only, in %s.' % (S['plan']['id'], ROOT, S['plan']['path'], ROOT),
        'Diff: git -C %s diff %s and git -C %s ls-files --others --exclude-standard (the steps are committed one by one: git -C %s log -p %s..HEAD shows them).' % (shq(ROOT), base, shq(ROOT), shq(ROOT), base),
        'Steps:\n%s' % steps,
        bl_text,
        'Look for broken contracts between steps, regressions outside the changed files and acceptance criteria with no test. Give each finding its file.',
        'Measure: headSha = git rev-parse HEAD; clean = git status --porcelain empty; commitsInRange = git -C %s rev-list --count %s..HEAD.' % (shq(ROOT), base),
    ])


# ---------------------------------------------------------------- the pieces of the loop
async def impl_step(s, defects, model):
    out = await call_agent('implementer', impl_prompt(s, defects), 'S_IMPL', model)
    REPORTS[s['n']] = out
    return {'n': s['n'], 'out': out}


def models_of(steps):
    """The Gemini model of each step, computed at dispatch from the Claude tier and effort the state keeps."""
    return lib('p.map((s) => agyModelFor(s.tier, s.effort))', [{'tier': s['tier'], 'effort': s['effort']} for s in steps])


def take_carry(n):
    return CARRY.pop(n, None)


def record_reports(results):
    """Every return becomes a report event; a step with no return in 3 attempts is held for the person."""
    for r in sorted(results, key=lambda x: x['n']):
        ev = report_event(r['n'], r['out'], NOW)
        queue(ev)
        s = step_of(r['n'])
        if ev['type'] == 'report' and ev['value'] == 'pass' and s.get('sha'):
            AGAIN.add(r['n'])
        if ev['type'] == 'no-report' and s['status'] == 'pending' and s['attempts'] >= 3:
            queue({'type': 'hold', 'step': r['n'], 'text': 'step T%s returned no report in %s attempts' % (r['n'], s['attempts'])})


def ensure_baseline():
    """The tests before the first launch, recorded once in run.baseline ("none" records a green baseline without running); a
    baseline that fails or runs 0 tests stops the run before the first step."""
    if S['run'].get('baseline') is not None:
        return None
    test = test_cmd()
    if test == 'none':
        queue({'type': 'baseline', 'test': 'none', 'exit': 0, 'tail': None, 'failedNames': []})
        return None
    out = run_test()
    if out is None:
        return stop_no_bash()
    if not isinstance(out.get('exit'), int):
        return fail_with('the baseline test run returned nothing')
    queue(baseline_event(test, out))
    why = baseline_problem(out)
    if why is None:
        return None
    tail = '); fix the command and recreate the state with progress.mjs init <plan> --restart (nothing has launched yet), or answer unblock to accept this baseline'
    room = GATE_Q_CAP - (len(why) + len(' (command: ') + len(tail))
    cmd = str(test)
    question = '%s (command: %s%s' % (why, cmd[:max(0, room - 3)] + '...' if len(cmd) > room else cmd, tail)
    queue({'type': 'block', 'text': question})
    return stop_with('ask', question=question, excerpt=tail_of(out.get('stdout')))


def sweep_committed():
    """`AGAIN` is lost with a kill: once per run, before any launch, a committed step whose files changed after a fix goes back to the list."""
    global SWEPT
    if S['run'].get('commits') != 'per-step' or SWEPT:
        return
    SWEPT = True
    # A file that an unfinished step also owns may hold that step's partial work: it is left to the step that commits it.
    open_files = set(f for x in S['steps'] if x['status'] != 'pass' for f in files_of(x))
    for s in S['steps']:
        if s['status'] != 'pass' or s.get('noCommit') is True or not s.get('sha') or not files_of(s):
            continue
        if any(f in open_files for f in files_of(s)):
            continue
        d = git('status', '--porcelain', '--', *files_of(s))
        if d['exit'] == 0 and d['stdout'].strip() != '':
            AGAIN.add(s['n'])


def commit_steps():
    """Per-step commits, one at a time in the order of n, after every return of the wave and its review. {result} to stop or {did}."""
    if S['run'].get('commits') != 'per-step':
        return {'did': False}
    todo = steps_to_commit(S, AGAIN)
    if not todo:
        return {'did': False}
    phase('Commit')
    bare = next((s for s in todo if not files_of(s)), None)
    if bare:
        return {'result': fail_with('step T%s passed but the state has no files to commit for it (a state made before E12?): run progress.mjs init --restart to rebuild the state; nothing was committed' % bare['n'], step=bare['n'])}
    for s in todo:
        paths = files_of(s)
        # A clean pathspec means the files are already committed (a kill between the commit and its event, a fix that changed nothing).
        dirty = git('status', '--porcelain', '--', *paths)
        if dirty['exit'] != 0:
            return {'result': fail_with('git status failed for step T%s: %s' % (s['n'], tail_of(dirty['stdout'] or dirty['stderr'], 400)), step=s['n'])}
        clean = dirty['stdout'].strip() == ''
        if not clean:
            add = git('add', '--', *paths)
            if add['exit'] != 0:
                return {'result': fail_with('git add failed for step T%s: %s' % (s['n'], tail_of(add['stdout'] or add['stderr'], 400)), step=s['n'])}
            com = git('commit', '-m', commit_subject(S['plan']['id'], s), '--', *paths)
            if com['exit'] != 0:
                return {'result': fail_with('git commit failed for step T%s: %s' % (s['n'], tail_of(com['stdout'] or com['stderr'], 400)), step=s['n'])}
        log = git('log', '-1', '--format=%H %s', '--grep', commit_grep(S['plan']['id'], s['n']))
        sha = parse_log_line(log['stdout'], S['plan']['id'], s['n'])
        if not sha and clean:  # the files matched an earlier commit: the step records the current head
            head = git('rev-parse', 'HEAD')
            h = head['stdout'].strip()
            if head['exit'] == 0 and re.match(r'^[0-9a-f]{40,64}$', h):
                sha = h
        if not sha:
            return {'result': fail_with('the commit of step T%s was not found by its subject "%s T%s:"' % (s['n'], S['plan']['id'], s['n']), step=s['n'])}
        queue({'type': 'commit', 'step': s['n'], 'sha': sha})
        AGAIN.discard(s['n'])
        w = flush('commit-T%s' % s['n'])
        if w:
            return {'result': w}
    return {'did': True}


def summary_of():
    return {
        'run': S['run']['status'],
        'wave': S['run']['wave'],
        'map': MAP,
        'steps': [{'n': s['n'], 'title': s['title'], 'status': s['status'], 'attempts': s['attempts'], 'sha': s.get('sha')} for s in S['steps']],
        'finalGate': S['finalGate'],
        'open': [m for m in S['manual'] if m.get('open')],
    }


def read_only_violation(role, what):
    return fail_with('the %s %s changed the repository (HEAD or git status differ): reviewers are read-only' % (role, what))


# ---------------------------------------------------------------- args and the plugin root
def early_args_error(a):
    if not isinstance(a, dict):
        return 'args must be an object with plan, state and runToken'
    if not isinstance(a.get('agyRequestedBy'), str) or not AGY_REQUEST_RE.fullmatch(a['agyRequestedBy']):
        return AGY_REQUEST_ERR
    for k in ('plan', 'state', 'runToken'):
        if not isinstance(a.get(k), str) or a[k].strip() == '':
            return 'args.%s must be a non-empty string' % k
    p = a.get('progress')
    if not isinstance(p, str) or p.strip() == '':
        return 'args.progress must be the absolute path of scripts/progress.mjs of the plan-coordinator skill (the skill passes <dir>/scripts/progress.mjs)'
    if not slash(p).endswith(PROGRESS_SUFFIX):
        return 'args.progress must end with %s: the plugin root is derived from it' % PROGRESS_SUFFIX
    return None


def late_args_error(a):
    """The checks of validateArgs that need lib/external-auth.mjs. Sets AUTH_ITEMS."""
    global AUTH_ITEMS
    auth = lib('parseAuthorizeExternal(p)', a.get('authorizeExternal'))
    if auth['error']:
        return auth['error']
    for item in auth['items']:
        if re.match(r'^plan:T[1-9]\d*@[0-9a-f]{8}$', item):
            continue
        bare = re.match(r'^plan:T([1-9]\d*)$', item)
        if bare:
            return 'authorizeExternal item "%s" needs the plan digest: use "plan:T%s@<8 hex>"' % (item, bare.group(1))
        return 'authorizeExternal item "%s" is not allowed: only "plan:T<n>@<8 hex>"' % item
    AUTH_ITEMS = auth['items']
    answers = a.get('answers')
    if answers is not None:
        if not isinstance(answers, list):
            return 'args.answers must be a list'
        allowed = ['answer', 'unblock', 'release', 'hold', 'refuse']
        for x in answers:
            if not isinstance(x, dict) or answer_kind(x) not in allowed:
                return 'args.answers accepts only %s' % ', '.join(allowed)
    if a.get('test') is not None and not isinstance(a.get('test'), str):
        return 'args.test must be a string'
    return None


# ---------------------------------------------------------------- run
async def main():
    global PLUGIN, A, PROGRESS, STATE_FILE, RUN_TAG, SEQ, S, DISK, NOW, ROOT, SWEPT, MAP, SCHEMAS, BODIES, AUTH_ITEMS
    PLUGIN = None
    A = None
    PROGRESS = None
    STATE_FILE = None
    RUN_TAG = None
    SEQ = 0
    S = None
    DISK = None
    NOW = None
    ROOT = None
    del QUEUED[:]
    SWEPT = False
    AGAIN.clear()
    CARRY.clear()
    REPORTS.clear()
    LOST.clear()
    MAP = None
    SCHEMAS = {}
    BODIES = {}
    AUTH_ITEMS = []
    A = globals().get('args')
    why = early_args_error(A)
    if why:
        return fail_with(why)
    PROGRESS = slash(A['progress'])
    STATE_FILE = slash(A['state'])
    PLUGIN = PROGRESS[:-len(PROGRESS_SUFFIX)]
    bridge = PLUGIN + '/scripts/agy-bridge.py'
    if not os.path.isfile(bridge):
        return fail_with('the shared helper agy-bridge.py was not found at %s' % bridge)
    exec(compile(open(bridge, encoding='utf-8').read(), bridge, 'exec'), globals())
    why = late_args_error(A)
    if why:
        return fail_with(why)
    # The run token stays only in the first read: every later nonce carries a hash of it.
    RUN_TAG = lib('fnv1a(p)', A['runToken'])
    SCHEMAS = load_js_schemas(PLUGIN + '/skills/plan-coordinator/workflow/coordinator.js')
    BODIES = {r: load_agent_body(PLUGIN, r) for r in ('implementer', 'task-reviewer', 'final-reviewer')}

    phase('Read')
    first = read_signed(True)
    if 'data' not in first:
        return fail_with('the progress state could not be read: %s' % first['why'])
    S = DISK = first['data']['state']
    NOW = first['data']['now']
    ROOT = slash(first['data']['root'])
    if not same_plan(S['plan']['path'], A['plan']):
        return fail_with('the state belongs to another plan: it records %s and the launch names %s' % (S['plan']['path'], A['plan']))
    if first['data'].get('planChanged') is True:
        return stop_with('plan-changed', message='the plan changed after progress.mjs init; the state is kept as it is. Recreate it with init --restart only if the person asks')

    try:
        # A step still launched on disk belongs to a run that died: no report came. A common step goes back to pending; an external
        # step becomes stopped and the person is asked, because its effect may have happened (it never runs twice).
        for s in sorted([x for x in S['steps'] if x['status'] == 'launched'], key=lambda x: x['n']):
            queue({'type': 'no-report', 'step': s['n'], 'text': 'the run that launched this step ended without its report'})
        # What the person answered is applied before the loop, then both are on disk before anything is dispatched.
        for a in (A.get('answers') or []):
            queue(normalize_answer(a))
        resumed = flush('resume')
        if resumed:
            return resumed
        sweep_committed()

        for _turn in range(500):
            act = lib('nextAction(p)', S)
            # Every other action means the wave is settled: its passed steps are committed first.
            if act['action'] not in ('launch', 'review', 'await', 'approve-map'):
                c = commit_steps()
                if c.get('result'):
                    return finish(c['result'])
                if c.get('did'):
                    continue
            kind = act['action']
            if kind == 'approve-map':
                queue({'type': 'approve-map'})
                MAP = [{'wave': w['n'], 'steps': w['tasks']} for w in S['waves']]
            elif kind == 'launch':
                bad = ensure_baseline()
                if bad:
                    return finish(bad)
                queue({'type': 'launch', 'steps': [x['n'] for x in act['steps']]})
                w = flush('launch')
                if w:
                    return w
                phase('Wave')
                launched = [step_of(x['n']) for x in act['steps']]
                models = models_of(launched)
                results = await asyncio.gather(*[impl_step(s, take_carry(s['n']), m) for s, m in zip(launched, models)])
                record_reports(list(results))
                w2 = flush('reports')
                if w2:
                    return w2
            elif kind == 'await':  # steps launched by a run that died: no report came, the state decides what happens to each
                for n in act['steps']:
                    queue({'type': 'no-report', 'step': n, 'text': 'the run that launched this step ended without its report'})
            elif kind == 'review':
                phase('Review')
                s = step_of(act['step'])
                out, changed = await read_only_agent('task-reviewer', review_prompt(s, REPORTS.get(s['n'])), 'S_TASKREVIEW')
                if changed:
                    return finish(read_only_violation('task-reviewer', 'of step T%s' % s['n']))
                v = review_verdict(out)
                if v['verdict'] == 'lost':
                    LOST[s['n']] = LOST.get(s['n'], 0) + 1
                    queue({'type': 'review-result', 'step': s['n'], 'value': 'lost'})
                    if LOST[s['n']] >= 3:
                        question = 'the reviewer of step T%s returned nothing 3 times' % s['n']
                        queue({'type': 'block', 'text': question})
                        return finish(stop_with('ask', question=question))
                    continue
                if v['verdict'] == 'pass':
                    queue({'type': 'review-result', 'step': s['n'], 'value': 'pass'})
                    continue
                queue({'type': 'review-result', 'step': s['n'], 'value': 'defects', 'text': v['text'][:600]})
                if step_of(s['n'])['status'] == 'launched':  # a fix round of the same step
                    w = flush('review')
                    if w:
                        return w
                    phase('Wave')
                    fixing = step_of(s['n'])
                    record_reports([await impl_step(fixing, v['text'], models_of([fixing])[0])])
                    w2 = flush('fix')
                    if w2:
                        return w2
            elif kind == 'wave-gate':
                phase('Gate')
                gate = {'exit': 0, 'failedNames': []}
                excerpt = ''
                if test_cmd() != 'none':
                    out = run_test()
                    if out is None:
                        return finish(stop_no_bash())
                    gate = {'exit': out['exit'], 'failedNames': failed_test_names(out['stdout'])}
                    excerpt = tail_of(out['stdout'])
                if wave_gate_passes(gate, S['run'].get('baseline')):
                    queue({'type': 'wave-gate', 'value': 'pass'})
                    continue
                question = gate_question(act['wave'], gate['exit'], gate['failedNames'])
                queue({'type': 'wave-gate', 'value': 'fail', 'text': question})
                queue({'type': 'block', 'text': question})
                return finish(stop_with('ask', question=question, excerpt=excerpt))
            elif kind == 'advance':
                queue({'type': 'advance'})
            elif kind == 'final-gate':
                phase('Gate')
                out = None
                for k in (1, 2):
                    if out:
                        break
                    out, changed = await read_only_agent('final-reviewer', final_prompt(), 'S_REVIEW')
                    if changed:
                        return finish(read_only_violation('final-reviewer', 'of the final review'))
                if not out:
                    question = 'the final reviewer returned nothing twice'
                    queue({'type': 'block', 'text': question})
                    return finish(stop_with('ask', question=question))
                blocking = blocking_issues(out)
                if not blocking:
                    queue({'type': 'final-gate', 'value': 'pass'})
                    continue
                owner = owning_step(S, blocking)
                if owner is not None and S['finalGate']['rounds'] < 3:  # the step that owns the finding goes back to be fixed, then the gate runs again
                    CARRY[owner] = issues_text(blocking)
                    queue({'type': 'final-gate', 'value': 'defects', 'step': owner, 'text': issues_text(blocking)[:600]})
                    continue
                question = 'the final review found problems that no step owns or that survived 3 rounds; the person decides'
                queue({'type': 'block', 'text': question})
                return finish(stop_with('ask', question=question, findings=issues_text(blocking)))
            elif kind == 'hold':  # pending steps that wait on a held dependency
                for n in act['steps']:
                    queue({'type': 'hold', 'step': n, 'text': 'step T%s waits on a step held for the person' % n})
            elif kind == 'ask':
                manual = act.get('manual') or []
                question = act.get('question') or S['run'].get('question') or ' | '.join('T%s: %s' % (m['step'], m['text']) for m in manual)
                return finish(stop_with('ask', question=question, manual=manual))
            elif kind == 'done':
                return finish(dict({'status': 'done'}, **summary_of()))
            elif kind == 'prelaunch-review':  # external steps are reviewed before the person is asked, read-only on the brief
                phase('Review')
                before = guard_snapshot()
                ns = list(act['steps'])
                outs = await asyncio.gather(*[call_agent('task-reviewer', prelaunch_prompt(step_of(n)), 'S_TASKREVIEW', 'pro') for n in ns])
                if guard_snapshot() != before:
                    return finish(read_only_violation('task-reviewer', 'of the pre-launch review'))
                for n, out in sorted(zip(ns, outs), key=lambda x: x[0]):
                    v = review_verdict(out)
                    if v['verdict'] == 'lost':
                        k = 'pre%s' % n
                        LOST[k] = LOST.get(k, 0) + 1
                        if LOST[k] >= 3:
                            question = 'the pre-launch reviewer of external step T%s returned nothing 3 times' % n
                            queue({'type': 'block', 'text': question})
                            return finish(stop_with('ask', question=question))
                        continue
                    if v['verdict'] == 'pass':
                        queue({'type': 'prelaunch-review', 'step': n, 'value': 'pass'})
                    else:
                        queue({'type': 'prelaunch-review', 'step': n, 'value': 'defects', 'text': v['text'][:600]})
            elif kind == 'authorize':  # the item is bound to the digest of the plan: another digest never authorizes
                asks = []
                for n in act['steps']:
                    s = step_of(n)
                    item = lib('externalHold({ n: p.n, external: p.external }, "plan", p.items, p.fp)',
                               {'n': n, 'external': s.get('external'), 'items': AUTH_ITEMS, 'fp': S['plan']['digest']})
                    if item is None:
                        queue({'type': 'authorize', 'step': n})
                    else:
                        asks.append({'item': item, 'step': n, 'title': s['title']})
                if asks:
                    return finish(stop_with('authorize', items=asks))
            else:
                return finish(fail_with('action %s is not handled by coordinator-workflow' % kind, action=act))
        return finish(fail_with('coordinator-workflow: the loop did not settle in 500 turns'))
    except StateRefused as e:
        return finish(fail_with(str(e)))


try:
    result = await main()
except Exception as e:  # the run never dies without a result: the person reads the error, the state on disk is the truth
    result = {'status': 'error', 'error': '%s: %s' % (type(e).__name__, e)}
print(json.dumps(result, ensure_ascii=True))
