// Suíte de gatilho: parser do stream-json, pontuação, tabela, executor e CLI.
import { spawn as nodeSpawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CASES = join(here, 'trigger', 'cases.json');
const SANDBOX_FIXTURES = join(here, 'trigger', 'fixtures', 'sandbox');

function events(text) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) continue;
    try {
      const ev = JSON.parse(line);
      if (ev && typeof ev === 'object') out.push(ev);
    } catch {
      // linha que não é JSON: pulada
    }
  }
  return out;
}

export function parseTranscript(text) {
  const evs = events(text);
  const init = evs.find((e) => e.type === 'system' && e.subtype === 'init');
  let plugins = [];
  let superpowers = 'unknown';
  if (init) {
    plugins = (Array.isArray(init.plugins) ? init.plugins : [])
      .map((p) => (typeof p === 'string' ? p : p?.name))
      .filter((n) => typeof n === 'string');
    const pref = (list) => Array.isArray(list) && list.some((s) => typeof s === 'string' && s.startsWith('superpowers:'));
    superpowers = plugins.includes('superpowers') || pref(init.skills) || pref(init.slash_commands);
  }
  let skill = null;
  for (const e of evs) {
    if (e.type !== 'assistant') continue;
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    const use = content.find((b) => b?.type === 'tool_use' && b.name === 'Skill');
    if (use) {
      skill = use.input?.skill ?? null;
      break;
    }
  }
  const res = evs.filter((e) => e.type === 'result').pop();
  return { skill, superpowers, plugins, init: Boolean(init), result: res?.subtype ?? null };
}

// claude -p sai com 1 ao bater --max-turns, o fim normal de um caso que chamou a skill.
export function scoreCase(c, parsed, run = {}) {
  const badExit = run.code !== undefined && run.code !== 0 && parsed.result !== 'error_max_turns';
  const failed = badExit || run.error !== undefined || parsed.init === false;
  if (failed) {
    return { id: c.id, category: c.category, lang: c.lang, expect: c.expect, got: 'ERROR', hit: false, error: true, superpowers: parsed.superpowers };
  }
  return {
    id: c.id,
    category: c.category,
    lang: c.lang,
    expect: c.expect,
    got: parsed.skill,
    hit: parsed.skill === c.expect,
    superpowers: parsed.superpowers,
  };
}

export function renderTable(results) {
  const rows = ['| id | lang | category | expect | got | hit | superpowers |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const cats = new Map();
  for (const r of results) {
    rows.push(`| ${r.id} | ${r.lang} | ${r.category} | ${r.expect} | ${r.got ?? '-'} | ${r.hit} | ${r.superpowers} |`);
    const k = cats.get(r.category) ?? { hits: 0, total: 0 };
    k.total += 1;
    if (r.hit) k.hits += 1;
    cats.set(r.category, k);
  }
  rows.push('', '| category | hits | total |', '| --- | --- | --- |');
  for (const [cat, k] of cats) rows.push(`| ${cat} | ${k.hits} | ${k.total} |`);
  return rows.join('\n') + '\n';
}

// Caminhos docs/... citados nos prompts dos casos (sem a pontuação final).
export function citedPaths(cases) {
  const found = new Set();
  for (const c of cases) {
    for (const text of Object.values(c.prompt ?? {})) {
      for (const m of String(text).matchAll(/docs\/[A-Za-z0-9_./-]*[A-Za-z0-9_]/g)) found.add(m[0]);
    }
  }
  return [...found].sort();
}

// Arquivos que o sandbox recebe: tudo sob trigger/fixtures/sandbox, caminho relativo com '/'.
export async function sandboxFiles(root = SANDBOX_FIXTURES) {
  const out = [];
  const walk = async (dir, prefix) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), rel);
      else out.push(rel);
    }
  };
  await walk(root, '');
  return out.sort();
}

// Grava os arquivos citados no sandbox; texto sempre em LF, mesmo num checkout CRLF.
export async function seedSandbox(sandbox, write, root = SANDBOX_FIXTURES) {
  for (const rel of await sandboxFiles(root)) {
    const text = (await readFile(join(root, rel), 'utf8')).replace(/\r\n/g, '\n');
    await write(join(sandbox, ...rel.split('/')), text);
  }
}

export function buildArgs(prompt, { pluginDir }) {
  return ['-p', prompt, '--plugin-dir', pluginDir, '--output-format', 'stream-json', '--verbose', '--max-turns', '3'];
}

function quote(a) {
  return /^[A-Za-z0-9_@%+=:,./\-]+$/.test(a) ? a : JSON.stringify(a);
}

// Roda um comando e junta stdout; nunca lança por código de saída diferente de zero.
function defaultSpawn(cmd, args, { cwd } = {}) {
  return new Promise((res) => {
    const child = nodeSpawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', (e) => res({ stdout, code: 1, error: e.message }));
    child.on('close', (code) => res({ stdout, code }));
  });
}

const defaultDeps = {
  spawn: defaultSpawn,
  mkdtemp: async (prefix) => {
    await mkdir(dirname(prefix), { recursive: true });
    return mkdtemp(prefix);
  },
  rm: (p) => rm(p, { recursive: true, force: true }),
  writeFile: async (p, data) => {
    await mkdir(dirname(p), { recursive: true });
    return writeFile(p, data);
  },
  log: (line) => console.log(line),
};

export async function runTrigger(opts, deps = {}) {
  const d = { ...defaultDeps, ...deps };
  const { casesFile = DEFAULT_CASES, pluginDir, work, out, lang = 'both', only, dryRun = false } = opts;
  const { cases } = JSON.parse(await readFile(casesFile, 'utf8'));
  const langs = lang === 'both' ? ['pt', 'en'] : [lang];
  const selected = only?.length ? cases.filter((c) => only.includes(c.id)) : cases;
  const results = [];
  for (const c of selected) {
    for (const l of langs) {
      const args = buildArgs(c.prompt[l], { pluginDir });
      if (dryRun) {
        d.log(['claude', ...args].map(quote).join(' '));
        continue;
      }
      const sandbox = await d.mkdtemp(join(work, `${c.id}-${l}-`));
      try {
        await d.spawn('git', ['init', '-q'], { cwd: sandbox });
        await seedSandbox(sandbox, d.writeFile);
        const r = await d.spawn('claude', args, { cwd: sandbox });
        results.push(scoreCase({ ...c, lang: l }, parseTranscript(r?.stdout ?? ''), { code: r?.code, error: r?.error }));
      } finally {
        await d.rm(sandbox);
      }
    }
  }
  if (!dryRun) await d.writeFile(out, renderTable(results));
  return { exitCode: 0, results };
}

function insideRepo(target) {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).stdout.trim();
  const root = resolve(top);
  let rel = relative(root, resolve(target));
  if (process.platform === 'win32') rel = relative(root.toLowerCase(), resolve(target).toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

const USAGE = 'usage: node tools/measure/run-trigger.mjs --plugin-dir <dir> --work <dir> --out <file> [--cases <json>] [--lang pt|en|both] [--only <id,...>] [--dry-run]';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const pluginDir = opt('--plugin-dir');
  const work = opt('--work');
  const out = opt('--out');
  const lang = opt('--lang') ?? 'both';
  if (!pluginDir || !work || !out || !['pt', 'en', 'both'].includes(lang)) {
    console.error(USAGE);
    process.exit(2);
  }
  if (insideRepo(work)) {
    console.error(`--work is inside the repository: ${resolve(work)}`);
    process.exit(1);
  }
  const only = opt('--only')?.split(',').filter(Boolean);
  const { exitCode } = await runTrigger({
    casesFile: opt('--cases') ?? DEFAULT_CASES,
    pluginDir: resolve(pluginDir),
    work: resolve(work),
    out: resolve(out),
    lang,
    only,
    dryRun: args.includes('--dry-run'),
  });
  process.exit(exitCode);
}
