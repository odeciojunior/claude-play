import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js');

// Returns every top-level function declared between the `// <pure>` and
// `// </pure>` marker lines of the workflow script.
export function loadPure(scriptPath = DEFAULT_SCRIPT) {
  const lines = readFileSync(scriptPath, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '// <pure>');
  const end = lines.findIndex((l) => l.trim() === '// </pure>');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`loadPure: markers "// <pure>" and "// </pure>" not found (in order) in ${scriptPath}`);
  }
  const body = lines.slice(start + 1, end).join('\n');
  const names = [...body.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  return new Function(`${body}\nreturn { ${names.join(', ')} };`)();
}
