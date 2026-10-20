// Hook: PostToolUse — validate .claude-plugin/marketplace.json after edits
// Reads the tool input JSON from stdin. Always exits 0: a failure is reported as
// {"decision":"block","reason":...} on stdout, which Claude Code feeds back to Claude.
// Node instead of jq: a missing jq made the bash version report a pass without checking.
// Any unexpected error also blocks (a crash would exit 1, which does not block).
// Checks: 1 valid JSON · 2 top-level fields · 3 owner is an object with name+email ·
// 4 plugins is a non-empty array · 5 entry required fields · 6 source is a ./plugins/ string (repo policy) ·
// 7 no duplicate names · 8 plugins/<dir>/.claude-plugin/plugin.json exists, name and version match (repo policy) ·
// 9 entry name is kebab-case (repo policy)

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const block = (reason) => {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
};

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = String(JSON.parse(input).tool_input?.file_path ?? '');
  } catch {
    block('validate-marketplace-json: could not parse the hook input');
  }
  if (!/(^|\/)\.claude-plugin\/marketplace\.json$/.test(filePath.replace(/\\/g, '/'))) process.exit(0);

  try {
    const candidates = [
      process.env.CLAUDE_PROJECT_DIR && join(process.env.CLAUDE_PROJECT_DIR, '.claude-plugin', 'marketplace.json'),
      join('.claude-plugin', 'marketplace.json'),
    ].filter(Boolean);
    const file = candidates.find((p) => existsSync(p));
    if (!file) block('marketplace.json file not found on disk after edit');

    // Check 1: valid JSON
    let m;
    try {
      m = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      block('marketplace.json is not valid JSON. Please fix the syntax error.');
    }
    if (!m || typeof m !== 'object' || Array.isArray(m)) block('marketplace.json must be a JSON object');

    // Check 2: top-level required fields
    const missing = ['name', 'description', 'owner', 'plugins'].filter((k) => !(k in m));
    if (missing.length) block(`marketplace.json missing top-level fields: ${missing.join(', ')}`);

    // Check 3: owner is an object with name and email
    if (!m.owner || typeof m.owner !== 'object' || !('name' in m.owner) || !('email' in m.owner)) {
      block('marketplace.json owner must be an object with both name and email fields');
    }

    // Check 4: plugins is a non-empty array
    if (!Array.isArray(m.plugins) || m.plugins.length === 0) {
      block('marketplace.json plugins must be a non-empty array');
    }

    // Check 5: each plugin has the required fields
    const required = ['name', 'source', 'description', 'version', 'author', 'license', 'keywords', 'category'];
    const entryErrors = m.plugins
      .map((p) => [p?.name ?? 'unknown', required.filter((k) => !(k in (p ?? {})))])
      .filter(([, miss]) => miss.length)
      .map(([name, miss]) => `${name}: missing ${miss.join(', ')}`);
    if (entryErrors.length) block(`Plugin entry errors: ${entryErrors.join('; ')}`);

    // Check 6: each plugin source is a string starting with ./plugins/ (repo policy)
    const sourceErrors = m.plugins
      .filter((p) => typeof p.source !== 'string' || !p.source.startsWith('./plugins/'))
      .map((p) => typeof p.source === 'string'
        ? `${p.name}: source must start with ./plugins/ (got ${p.source})`
        : `${p.name}: source must be a ./plugins/ path string (repo policy)`);
    if (sourceErrors.length) block(`Plugin source path errors: ${sourceErrors.join('; ')}`);

    // Check 7: plugin names are unique
    const names = m.plugins.map((p) => String(p.name));
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    if (dupes.length) block(`Duplicate plugin names: ${dupes.join(', ')}`);

    // Check 8: each local plugin.json exists and agrees with the entry (repo policy)
    const root = dirname(dirname(file));
    const syncErrors = [];
    for (const p of m.plugins) {
      const pj = join(root, p.source, '.claude-plugin', 'plugin.json');
      if (!existsSync(pj)) { syncErrors.push(`${p.name}: ${p.source}/.claude-plugin/plugin.json not found`); continue; }
      let manifest;
      try { manifest = JSON.parse(readFileSync(pj, 'utf8')); } catch { syncErrors.push(`${p.name}: plugin.json is not valid JSON`); continue; }
      if (manifest?.name !== p.name) syncErrors.push(`${p.name}: name differs from plugin.json (${manifest?.name})`);
      if ('version' in p && manifest?.version !== p.version) {
        syncErrors.push(`${p.name}: version ${p.version} differs from plugin.json (${manifest?.version})`);
      }
    }
    if (syncErrors.length) block(`marketplace.json out of sync with plugin.json (repo policy): ${syncErrors.join('; ')}`);

    // Check 9: entry names are kebab-case (repo policy)
    const badNames = names.filter((n) => !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(n));
    if (badNames.length) block(`Plugin names must be kebab-case, matching ^[a-z][a-z0-9-]*[a-z0-9]$ (repo policy): ${badNames.join(', ')}`);

  } catch (e) {
    block(`validate-marketplace-json: unexpected error (${e.message})`);
  }
  process.exit(0);
});
