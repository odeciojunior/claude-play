import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BS = String.fromCharCode(92);
// bash eats backslashes in argv paths on Windows, so hand it forward slashes
const SETUP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'setup.sh').split(BS).join('/');
const isWin = process.platform === 'win32';

// On Windows, plain `bash` can resolve to the WSL launcher in System32; prefer Git Bash.
const GIT_BASH = path.win32.join('C:', BS, 'Program Files', 'Git', 'bin', 'bash.exe');
const BASH = isWin && existsSync(GIT_BASH) ? GIT_BASH : 'bash';

function run(home, args) {
  // Git Bash's runtime brace-expands a lone ${VAR} argv ("${A}" arrives as "$A") when it is
  // started from a native Windows process. Pass every argument through the environment instead.
  const argEnv = {};
  args.forEach((a, i) => { argEnv[`SETUP_ARG_${i}`] = a; });
  const refs = args.map((_, i) => `"$SETUP_ARG_${i}"`).join(' ');
  const r = spawnSync(BASH, ['-c', `exec bash "$SETUP_SH" ${refs}`], {
    // MSYS2_ARG_CONV_EXCL keeps "/usr/bin/python3" from being rewritten into a Windows path
    env: { ...process.env, ...argEnv, SETUP_SH: SETUP, HOME: home, MSYS2_ARG_CONV_EXCL: '*' },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const tmpHome = () => mkdtempSync(path.join(tmpdir(), 'setup-test-'));
const PY = '/usr/bin/python3';
const REF = '${DB_PASSWORD}';

test('print-entry emits a literal ${DB_PASSWORD}', () => {
  const r = run(tmpHome(), ['print-entry', PY, 'h', '1433', 'u', REF, 'n']);
  assert.equal(r.code, 0, r.err);
  const e = JSON.parse(r.out);
  assert.equal(e.env.DB_PASSWORD, '${DB_PASSWORD}');
  assert.equal(e.command, PY);
  assert.deepEqual(e.args, ['-m', 'mcp_sql_server.server']);
});

test('print-entry maps defaults', () => {
  const r = run(tmpHome(), ['print-entry', PY, 'h', '1433', 'u', REF, 'n']);
  const e = JSON.parse(r.out);
  assert.equal(e.env.DB_DRIVER, 'ODBC Driver 18 for SQL Server');
  assert.equal(e.env.DB_ENCRYPT, 'false');
  assert.equal(e.env.DB_TRUST_CERT, 'false');
  assert.equal(e.env.DB_PORT, '1433');
  assert.equal(e.env.DB_HOST, 'h');
  assert.equal(e.env.DB_USER, 'u');
  assert.equal(e.env.DB_NAME, 'n');
  assert.equal(r.out.trim().split('\n').length, 1);
});

test('register-mcp-json writes the same entry as print-entry', () => {
  const home = tmpHome();
  const mcp = path.join(home, 'proj', '.mcp.json');
  const a = run(home, ['print-entry', PY, 'h', '1433', 'u', REF, 'n']);
  const b = run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', REF, 'n']);
  assert.equal(b.code, 0, b.err + b.out);
  const doc = JSON.parse(readFileSync(mcp, 'utf8'));
  assert.deepEqual(doc.mcpServers['mcp-sql-server'], JSON.parse(a.out));
});

test('python-path fails without a venv', () => {
  const r = run(tmpHome(), ['python-path']);
  assert.equal(r.code, 1);
});

test('python-path prints an absolute path when the venv exists', () => {
  const home = tmpHome();
  const venv = path.join(home, '.claude', 'mcp-servers', 'mcp-sql-server', '.venv');
  const rel = isWin ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
  mkdirSync(path.dirname(path.join(venv, rel)), { recursive: true });
  writeFileSync(path.join(venv, rel), '');
  const r = run(home, ['python-path']);
  assert.equal(r.code, 0, r.err);
  const p = r.out.trim();
  assert.ok(path.isAbsolute(p), p);
  assert.ok(!p.startsWith('~'), p);
  assert.ok(p.endsWith(isWin ? 'Scripts/python.exe' : 'bin/python'), p);
});

test('add-database accepts ${DB_X_PASSWORD}', () => {
  const home = tmpHome();
  const mcp = path.join(home, '.mcp.json');
  assert.equal(run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', REF, 'n']).code, 0);
  const r = run(home, ['add-database', mcp, 'x', 'host', '1433', 'user', '${DB_X_PASSWORD}', 'name']);
  assert.equal(r.code, 0, r.err + r.out);
  const env = JSON.parse(readFileSync(mcp, 'utf8')).mcpServers['mcp-sql-server'].env;
  assert.equal(env.DB_X_PASSWORD, '${DB_X_PASSWORD}');
  assert.equal(env.DB_DATABASES, 'x');
});

test('env:NAME becomes a literal ${NAME} in print-entry, register-mcp-json and add-database', () => {
  const home = tmpHome();
  const a = run(home, ['print-entry', PY, 'h', '1433', 'u', 'env:DB_PASSWORD', 'n']);
  assert.equal(a.code, 0, a.err);
  assert.equal(JSON.parse(a.out).env.DB_PASSWORD, '${DB_PASSWORD}');
  const mcp = path.join(home, '.mcp.json');
  const b = run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', 'env:DB_PASSWORD', 'n']);
  assert.equal(b.code, 0, b.err + b.out);
  const c = run(home, ['add-database', mcp, 'x', 'host', '1433', 'user', 'env:DB_X_PASSWORD', 'name']);
  assert.equal(c.code, 0, c.err + c.out);
  const env = JSON.parse(readFileSync(mcp, 'utf8')).mcpServers['mcp-sql-server'].env;
  assert.equal(env.DB_PASSWORD, '${DB_PASSWORD}');
  assert.equal(env.DB_X_PASSWORD, '${DB_X_PASSWORD}');
});

test('invalid env: names are rejected', () => {
  const home = tmpHome();
  const mcp = path.join(home, '.mcp.json');
  for (const bad of ['env:db-pass', 'env:', 'env:1ABC']) {
    assert.equal(run(home, ['print-entry', PY, 'h', '1433', 'u', bad, 'n']).code, 1, bad);
    assert.equal(run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', bad, 'n']).code, 1, bad);
  }
});

test('a mangled $NAME placeholder is rejected with an env: hint', () => {
  const home = tmpHome();
  const mcp = path.join(home, '.mcp.json');
  run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', 'x', 'n']);
  for (const args of [
    ['print-entry', PY, 'h', '1433', 'u', '$DB_PASSWORD', 'n'],
    ['register-mcp-json', path.join(home, 'o.json'), PY, 'h', '1433', 'u', '$DB_PASSWORD', 'n'],
    ['add-database', mcp, 'x', 'host', '1433', 'user', '$DB_X_PASSWORD', 'name'],
  ]) {
    const r = run(home, args);
    assert.equal(r.code, 1, args[0]);
    assert.match(r.out + r.err, /env:<NAME>/, args[0]);
  }
});

test('a literal password that starts with $ but is not a placeholder shape is accepted', () => {
  const r = run(tmpHome(), ['print-entry', PY, 'h', '1433', 'u', '$ecretPw1', 'n']);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).env.DB_PASSWORD, '$ecretPw1');
});

test('the invalid env: error never echoes the password argument', () => {
  const home = tmpHome();
  const mcp = path.join(home, '.mcp.json');
  for (const args of [
    ['print-entry', PY, 'h', '1433', 'u', 'env:myS3cret', 'n'],
    ['register-mcp-json', mcp, PY, 'h', '1433', 'u', 'env:myS3cret', 'n'],
  ]) {
    const r = run(home, args);
    assert.equal(r.code, 1);
    assert.ok(!(r.out + r.err).includes('myS3cret'), args[0]);
    assert.match(r.err, /env:<NAME>/);
  }
  const bad = run(home, ['print-entry', PY, 'h', '1433', 'u', '$DB_PASSWORD', 'n']);
  assert.ok(!(bad.out + bad.err).includes('DB_PASSWORD'));
});

test('literal password values are still accepted', () => {
  const r = run(tmpHome(), ['print-entry', PY, 'h', '1433', 'u', 'p@ss$word', 'n']);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).env.DB_PASSWORD, 'p@ss$word');
});

test('empty password is rejected by print-entry and register-mcp-json', () => {
  const home = tmpHome();
  const mcp = path.join(home, 'e.json').split(BS).join('/');
  const a = run(home, ['print-entry', PY, 'h', '1433', 'u', '', 'n']);
  assert.equal(a.code, 1);
  assert.match(a.err, /password/i);
  const b = run(home, ['register-mcp-json', mcp, PY, 'h', '1433', 'u', '', 'n']);
  assert.equal(b.code, 1);
  assert.match(b.err, /password/i);
});

function detect(content) {
  const dir = mkdtempSync(path.join(tmpdir(), 'setup-env-'));
  writeFileSync(path.join(dir, '.env'), content);
  return run(tmpHome(), ['detect-env', dir.split(BS).join('/')]);
}

test('detect-env on a partial .env succeeds and reports the missing variable', () => {
  const r = detect('DB_HOST=sqlserver.example.com\nDB_PASSWORD=secretpw123\nDB_NAME=appdb_long\n');
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.out, /^DB_HOST=sql\*\*\*com$/m);
  assert.match(r.out, /^DB_PASSWORD=\*{8}$/m);
  assert.match(r.out, /DB_NAME=app\*\*\*ong/);
  assert.match(r.out, /DB_USER missing/);
  assert.ok(!r.out.includes('secretpw123'));
});

test('detect-env reads export lines and DB_DATABASE', () => {
  const r = detect('export DB_HOST=sqlserver.example.com\nexport DB_DATABASE=appdb_long\n');
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.out, /^DB_HOST=sql\*\*\*com$/m);
  assert.match(r.out, /DB_DATABASE=app\*\*\*ong/);
});

test('detect-env handles CRLF files', () => {
  const r = detect('DB_HOST=sqlserver.example.com\r\nDB_USER=sa\r\n');
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.out, /^DB_HOST=sql\*\*\*com$/m);
  assert.match(r.out, /^DB_USER=\*\*\*$/m);
});

test('detect-env fails when DB_HOST is missing', () => {
  assert.equal(detect('DB_USER=sa\n').code, 1);
});
