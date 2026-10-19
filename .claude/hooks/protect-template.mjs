// Hook: PreToolUse — block edits to plugins/_template/
// Reads the tool input JSON from stdin. Exit 2 blocks the tool call; stderr is shown to Claude.
// Node instead of jq: a missing jq made the bash version exit 0 and protect nothing.

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let filePath;
  try {
    filePath = String(JSON.parse(input).tool_input?.file_path ?? '');
  } catch {
    console.error('protect-template: could not parse the hook input; blocking to be safe.');
    process.exit(2);
  }
  // Windows paths arrive with backslashes and any letter case
  if (filePath.replace(/\\/g, '/').toLowerCase().includes('plugins/_template/')) {
    console.error('BLOCKED: Do not modify plugins/_template/ directly. Copy it to a new plugin directory instead (see CONTRIBUTING.md).');
    process.exit(2);
  }
  process.exit(0);
});
