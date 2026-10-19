// Hook: PostToolUse — validate .claude-plugin/marketplace.json after edits
// Reads the tool input JSON from stdin. Always exits 0: a failure is reported as
// {"decision":"block","reason":...} on stdout, which Claude Code feeds back to Claude.
// Node instead of jq: a missing jq made the bash version report a pass without checking.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  if (!filePath.replace(/\\/g, '/').endsWith('marketplace.json')) process.exit(0);

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

  // Check 2: top-level required fields
  const missing = ['name', 'description', 'owner', 'plugins'].filter((k) => !(k in m));
  if (missing.length) block(`marketplace.json missing top-level fields: ${missing.join(', ')}`);

  // Check 3: owner has name and email
  if (!m.owner || !('name' in m.owner) || !('email' in m.owner)) {
    block('marketplace.json owner must have both name and email fields');
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

  // Check 6: each plugin source starts with ./plugins/
  const sourceErrors = m.plugins
    .filter((p) => !String(p.source).startsWith('./plugins/'))
    .map((p) => `${p.name}: source must start with ./plugins/ (got ${p.source})`);
  if (sourceErrors.length) block(`Plugin source path errors: ${sourceErrors.join('; ')}`);

  process.exit(0);
});
