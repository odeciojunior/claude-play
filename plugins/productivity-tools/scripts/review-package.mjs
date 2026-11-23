#!/usr/bin/env node
// Gera um único arquivo de revisão para um intervalo de commits: cabeçalho (base, ponta,
// log do intervalo) seguido de `git diff base tip`. Uso: node review-package.mjs <repo> <base> <tip> <out>
// Sai com 0 e imprime JSON ok; sai com 1 e imprime {"ok":false,"error":...} se a ref não
// resolve ou a base não é ancestral da ponta (nada é gravado); sai com 2 se o uso estiver errado.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GIT_OPTS = { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512, stdio: ['ignore', 'pipe', 'pipe'] };

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], GIT_OPTS);
}

function resolveCommit(repo, ref) {
  return git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
}

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
}

export function buildPackage(repo, base, tip, out) {
  let baseSha;
  let tipSha;
  try {
    baseSha = resolveCommit(repo, base);
  } catch {
    fail(`ref base não resolve: ${base}`);
  }
  try {
    tipSha = resolveCommit(repo, tip);
  } catch {
    fail(`ref ponta não resolve: ${tip}`);
  }
  try {
    git(repo, ['merge-base', '--is-ancestor', baseSha, tipSha]);
  } catch {
    fail(`a base ${base} não é ancestral da ponta ${tip}`);
  }

  const log = git(repo, ['log', '--format=%h %s', `${baseSha}..${tipSha}`]);
  const commits = Number(git(repo, ['rev-list', '--count', `${baseSha}..${tipSha}`]).trim());
  const diff = git(repo, ['diff', baseSha, tipSha]);

  const text = [
    '# Pacote de revisão',
    '',
    `Base: ${baseSha}`,
    `Ponta: ${tipSha}`,
    `Commits: ${commits}`,
    '',
    '## Log do intervalo',
    '',
    log.trimEnd(),
    '',
    '## Diff',
    '',
    diff,
  ].join('\n');

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text, 'utf8');
  const data = Buffer.from(text, 'utf8');
  const bytes = data.length;
  const sha256 = createHash('sha256').update(data).digest('hex');
  const newlines = text.split('\n').length - 1;
  const lines = newlines + (text.endsWith('\n') ? 0 : 1);
  return { ok: true, path: out, base: baseSha, tip: tipSha, commits, bytes, sha256, lines };
}

function main(argv) {
  if (argv.length !== 4) {
    process.stderr.write('uso: node review-package.mjs <repo> <base> <tip> <out>\n');
    process.exit(2);
  }
  const [repo, base, tip, out] = argv;
  const result = buildPackage(repo, base, tip, out);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
