// Hook: PreToolUse (Edit|MultiEdit|Write|NotebookEdit) — block edits to plugins/_template/
// Reads the tool input JSON from stdin. Exit 2 blocks the tool call; stderr is shown to Claude.
// Node instead of jq: a missing jq made the bash version exit 0 and protect nothing.
//
// There is deliberately no Bash guard: `cp -r plugins/_template plugins/<new>` is the documented
// way to start a plugin, and source vs destination cannot be told apart reliably in shell text.

import path from 'node:path';

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let filePath;
  try {
    const ti = JSON.parse(input).tool_input;
    filePath = String(ti?.file_path ?? ti?.notebook_path ?? '');
  } catch {
    console.error('protect-template: could not parse the hook input; blocking to be safe.');
    process.exit(2);
  }
  // Windows paths arrive with backslashes and any letter case; normalise ".." segments too
  const normalised = path.posix.normalize(filePath.replace(/\\/g, '/')).toLowerCase();
  if (normalised.includes('plugins/_template/')) {
    console.error('BLOCKED: Do not modify plugins/_template/ directly. Copy it to a new plugin directory instead (see CONTRIBUTING.md).');
    process.exit(2);
  }
  process.exit(0);
});
