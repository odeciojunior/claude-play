// Probe hook. Appends the hook input to <os tmp>/wfprobe-hook.log (one JSON object per line) and, only on
// PreToolUse with WFPROBE_ALLOW=1 in the environment, answers "allow". Throwaway: not the product hook.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let input = null;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  /* logged as null */
}
const allow = process.env.WFPROBE_ALLOW === '1' && input?.hook_event_name === 'PreToolUse' && input?.tool_name === 'Workflow';
const line = {
  at: new Date().toISOString(),
  event: input?.hook_event_name ?? null,
  tool: input?.tool_name ?? null,
  permission_mode: input?.permission_mode ?? null,
  agent_id: input?.agent_id ?? null,
  tool_input: input?.tool_input ?? null,
  permission_suggestions: input?.permission_suggestions ?? null,
  pluginRootEnv: process.env.CLAUDE_PLUGIN_ROOT ?? null,
  answered: allow ? 'allow' : 'nothing',
};
try {
  fs.appendFileSync(path.join(os.tmpdir(), 'wfprobe-hook.log'), JSON.stringify(line) + '\n');
} catch {
  /* the probe still answers */
}
if (allow) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'wfprobe: WFPROBE_ALLOW=1' } }));
}
