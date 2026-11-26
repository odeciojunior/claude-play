# Shared helper of the agy (Antigravity) Python workflows. Loaded by exec from them:
#   exec(compile(open(bridge, encoding="utf-8").read(), bridge, "exec"), globals())
# Python >= 3.8, standard library only, no state beyond constants. Every subprocess runs
# with shell=False. Nothing from lib/*.mjs is reimplemented here: hashes, routing and
# state go through call_lib (Node). Schemas and the test-integrity program come from the JS
# workflows, so the .js and .py sides share one source.
import json
import ntpath
import os
import re
import shutil
import subprocess
import tempfile

# The lib modules call_lib imports, in this order (later names win on a clash; there is none).
LIB_MODULES = ['routing', 'agy-routing', 'plan-digest', 'external-auth', 'progress-state', 'roadmap-format']

# Node program of call_lib. stdin: {root, expr, payload}. `expr` sees every export of LIB_MODULES by name and the
# payload as `p`; the JSON of its value (awaited) goes to stdout.
CALL_LIB_JS = """
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const scope = {};
for (const n of req.modules) Object.assign(scope, await import(pathToFileURL(join(req.root, 'lib', n + '.mjs')).href));
const keys = Object.keys(scope);
const fn = new Function(...keys, 'p', 'return (' + req.expr + '\\n)');
const out = await fn(...keys.map((k) => scope[k]), req.payload);
process.stdout.write(JSON.stringify(out === undefined ? null : out));
"""

# Node program of load_js_schemas. stdin: the schemas slice; argv: the S_* names to return.
SCHEMAS_JS = """
(async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const slice = Buffer.concat(chunks).toString('utf8');
  const names = process.argv.slice(1);
  const out = new Function(slice + '\\n; return {' + names.join(', ') + '}')();
  process.stdout.write(JSON.stringify(out));
})();
"""

UNMEASURED_INTEGRITY = {'deletedTests': [], 'removedAsserts': -1, 'skipsAdded': 0, 'prodChanged': 0, 'assertsAdded': 0}


def plugin_root_from(path, suffix):
    """Plugin root from a CLI path (accepts \\ and /); None when the path lacks the suffix (pluginRootOf)."""
    p = str(path).replace('\\', '/')
    return p[:-len(suffix)] if suffix and p.endswith(suffix) else None


def run_cli(argv, cwd=None, input=None, timeout=None):
    """Run argv (a list, shell=False). Returns {exit, stdout, stderr}; a missing program is exit 127, a timeout 124."""
    data = input.encode('utf-8') if isinstance(input, str) else input
    try:
        p = subprocess.run(
            [str(a) for a in argv], cwd=cwd, input=data,
            stdin=None if data is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, shell=False,
        )
    except subprocess.TimeoutExpired as e:
        return {'exit': 124, 'stdout': _text(e.stdout), 'stderr': _text(e.stderr) or 'timeout'}
    except OSError as e:
        return {'exit': 127, 'stdout': '', 'stderr': str(e)}
    return {'exit': p.returncode, 'stdout': _text(p.stdout), 'stderr': _text(p.stderr)}


def _text(b):
    if b is None:
        return ''
    return b.decode('utf-8', 'replace') if isinstance(b, bytes) else str(b)


def _env_get(env, *keys):
    for k in keys:
        v = env.get(k)
        if v:
            return v
    return None


def _win_norm(p):
    return ntpath.normcase(ntpath.normpath(str(p)))


def _under_system_root(path, env):
    """True for a path under %SystemRoot% (System32\\bash.exe is the WSL launcher), compared without case."""
    n = _win_norm(path)
    root = _env_get(env, 'SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR')
    if root:
        r = _win_norm(root).rstrip('\\')
        if n == r or n.startswith(r + '\\'):
            return True
    return '\\system32\\' in n


def _git_bash_candidates(env):
    out = []
    ex = run_cli(['git', '--exec-path'])
    if ex['exit'] == 0 and ex['stdout'].strip():
        # .../mingw64/libexec/git-core -> <git root>/bin/bash.exe
        up = ntpath.normpath(ex['stdout'].strip())
        for _ in range(3):
            up = ntpath.dirname(up)
        if up:
            out.append(ntpath.join(up, 'bin', 'bash.exe'))
    pf = _env_get(env, 'ProgramFiles', 'PROGRAMFILES')
    pf86 = _env_get(env, 'ProgramFiles(x86)', 'PROGRAMFILES(X86)')
    la = _env_get(env, 'LocalAppData', 'LOCALAPPDATA')
    if pf:
        out.append(ntpath.join(pf, 'Git', 'bin', 'bash.exe'))
    if pf86:
        out.append(ntpath.join(pf86, 'Git', 'bin', 'bash.exe'))
    if la:
        out.append(ntpath.join(la, 'Programs', 'Git', 'bin', 'bash.exe'))
    return out


def find_git_bash(env=os.environ, candidates=None):
    """The Git for Windows bash.exe (first valid of the ordered candidates), never a path under %SystemRoot%.
    `candidates` replaces the computed list (Windows rules apply to it). Outside Windows: /bin/bash. None when absent."""
    if env is None:
        env = os.environ
    if candidates is None:
        if os.name != 'nt':
            return '/bin/bash' if os.path.isfile('/bin/bash') else None
        candidates = _git_bash_candidates(env)
        if not _env_get(env, 'SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR'):
            env = dict(env)
            env['SystemRoot'] = 'C:\\Windows'
    for c in candidates:
        if c and not _under_system_root(c, env) and os.path.isfile(c):
            return c
    return None


def run_shell(cmd, cwd=None, env=None, candidates=None):
    """Run one shell command line through Git Bash: [bash, -lc, cmd]. Raises RuntimeError('git-bash-not-found') without it."""
    bash = find_git_bash(env if env is not None else os.environ, candidates)
    if not bash:
        raise RuntimeError('git-bash-not-found')
    return run_cli([bash, '-lc', cmd], cwd=cwd)


def call_lib(root, expr, payload):
    """Evaluate a JS expression over lib/*.mjs through `node --input-type=module -e`; JSON in by stdin, JSON out by stdout.
    The expression sees the exports of LIB_MODULES by name and the payload as `p`. A Node error raises with its stderr."""
    req = json.dumps({'root': str(root), 'expr': expr, 'payload': payload, 'modules': LIB_MODULES}, ensure_ascii=True)
    r = run_cli(['node', '--input-type=module', '-e', CALL_LIB_JS], input=req)
    if r['exit'] != 0:
        raise RuntimeError('call_lib failed (exit %s): %s' % (r['exit'], r['stderr'].strip()))
    return json.loads(r['stdout'])


def load_agent_body(root, name):
    """Body of agents/<name>.md without the frontmatter (LF line ends)."""
    with open(os.path.join(root, 'agents', name + '.md'), encoding='utf-8-sig') as f:
        text = f.read().replace('\r\n', '\n')
    m = re.match(r'---\n.*?\n---[ \t]*(?:\n|$)', text, re.S)
    return text[m.end():] if m else text


# The agent bodies name Claude Code tools; this note maps them to the agy ones. At most 600 characters.
AGY_TOOL_NOTE = 'HOST TOOLS (Antigravity): the instructions above may name Claude Code tools; use these instead. Read with offset/limit: read_file with StartLine/EndLine. Write: write_file. Edit: edit_file. Bash: run_command, which on Windows is pwsh, so no POSIX syntax such as $(...): run the inner command first (for example git rev-parse --absolute-git-dir) and use its literal output. AskUserQuestion: ask_question. Grep and Glob: the search tools of this host, or run_command. WebSearch: search_web; there is no WebFetch. agentType and subagent dispatch do not exist on this host.'


def with_tool_note(body, prompt):
    """The prompt of an agent call with a body: the agent body, AGY_TOOL_NOTE and the stage prompt."""
    return body + '\n\n' + AGY_TOOL_NOTE + '\n\n' + prompt


def _read_lf(path):
    with open(path, encoding='utf-8-sig') as f:
        return f.read().replace('\r\n', '\n')


def load_js_schemas(js_path):
    """The S_* schema constants of a workflow JS file as a dict: the slice from the `// ---- ... schemas` section comment
    to the next `// ---` comment is evaluated by Node and every S_* constant of it is returned."""
    text = _read_lf(js_path)
    start = re.search(r'^// -{3,} schemas\b[^\n]*\n', text, re.M)
    if not start:
        raise RuntimeError('schemas section not found in %s' % js_path)
    rest = text[start.end():]
    end = re.search(r'^// -{3,}', rest, re.M)
    section = rest[:end.start()] if end else rest
    names = re.findall(r'^const (S_\w+)\s*=', section, re.M)
    if not names:
        raise RuntimeError('no S_* schema in %s' % js_path)
    r = run_cli(['node', '-e', SCHEMAS_JS] + names, input=section)
    if r['exit'] != 0:
        raise RuntimeError('schemas evaluation failed: %s' % r['stderr'].strip())
    return json.loads(r['stdout'])


def load_test_integrity(js_path, cfg):
    """The test-integrity Node program: the String.raw of TEST_INTEGRITY_DEFAULT in roadmap-release.js, replaced by a
    non-empty string cfg['testIntegrity'], or None when cfg['testIntegrity'] is False (the rule of CFG.testIntegrity)."""
    v = (cfg or {}).get('testIntegrity')
    if v is False:
        return None
    if isinstance(v, str) and v.strip():
        return v
    m = re.search(r'const TEST_INTEGRITY_DEFAULT = String\.raw`([^`]*)`', _read_lf(js_path))
    if not m:
        raise RuntimeError('TEST_INTEGRITY_DEFAULT not found in %s' % js_path)
    if '${' in m.group(1):
        raise RuntimeError('TEST_INTEGRITY_DEFAULT has an interpolation: the raw text is not exact')
    return m.group(1)


def run_test_integrity(program, wt_dir, base):
    """Run the test-integrity program in wt_dir against `base` (argv[2]). A program failure, as in the JS, is
    removedAsserts = -1 with zeros for the rest."""
    bad = dict(UNMEASURED_INTEGRITY, deletedTests=[])
    if not program:
        return bad
    d = tempfile.mkdtemp(prefix='agy-integrity-')  # outside the worktree: it stays clean
    try:
        f = os.path.join(d, 'integrity.cjs')
        with open(f, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(program)
        r = run_cli(['node', f, str(base)], cwd=wt_dir)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    if r['exit'] != 0:
        return bad
    lines = [ln for ln in r['stdout'].splitlines() if ln.strip()]
    try:
        data = json.loads(lines[-1])
        out = {
            'deletedTests': [str(x) for x in data['deletedTests']],
            'removedAsserts': int(data['removedAsserts']),
            'skipsAdded': int(data['skipsAdded']),
            'prodChanged': int(data['prodChanged']),
            'assertsAdded': int(data['assertsAdded']),
        }
    except (IndexError, ValueError, KeyError, TypeError):
        return bad
    return out


def run_test_extract(root, text, exit):
    """The deterministic test extractor (scripts/test-extract.mjs of root) over a gate output. Returns its JSON object, or None when
    it fails (no node or no CLI, a non-zero exit, invalid JSON or not an object)."""
    d = tempfile.mkdtemp(prefix='agy-extract-')  # outside the worktree: it stays clean
    try:
        f = os.path.join(d, 'output.txt')
        with open(f, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
        r = run_cli(['node', str(root) + '/scripts/test-extract.mjs', f, '--exit', exit])
    finally:
        shutil.rmtree(d, ignore_errors=True)
    if r['exit'] != 0:
        return None
    try:
        data = json.loads(r['stdout'])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def git_snapshot(root):
    """(HEAD, git status --porcelain) of root: the read-only guard compares it before and after a reviewer."""
    head = run_cli(['git', 'rev-parse', 'HEAD'], cwd=root)
    if head['exit'] != 0:
        raise RuntimeError('git rev-parse HEAD failed: %s' % head['stderr'].strip())
    st = run_cli(['git', '--no-optional-locks', 'status', '--porcelain'], cwd=root)
    if st['exit'] != 0:
        raise RuntimeError('git status failed: %s' % st['stderr'].strip())
    return (head['stdout'].strip(), st['stdout'].rstrip())
