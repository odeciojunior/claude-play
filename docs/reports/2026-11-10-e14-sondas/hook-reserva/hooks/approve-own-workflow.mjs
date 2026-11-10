// PreToolUse hook for the Workflow tool. Prints an "allow" decision only for a launch of one of this
// plugin's own workflow scripts, and only when the user opted in. Every other case prints nothing
// (no decision: the normal permission flow applies). It never denies and never falls back to allow.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Scripts this hook may approve, relative to the plugin root. Closed list: adding a workflow means editing it.
export const OWN_SCRIPTS = ['skills/roadmap-release/workflow/roadmap-release.js'];
// Named launches this hook may approve. Empty until the E14 probe shows what tool_input.name holds
// for a plugin workflow and that the name cannot be claimed by a project or personal workflow.
export const OWN_NAMES = [];

const real = (p) => {
  try {
    const r = fs.realpathSync.native(p);
    return process.platform === 'win32' ? r.toLowerCase() : r;
  } catch {
    return null;
  }
};

export function decide(input, { optIn, pluginRoot }) {
  if (optIn !== true) return null;
  if (!input || input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'Workflow') return null;
  if (input.permission_mode === 'plan') return null;
  const ti = input.tool_input;
  if (!ti || typeof ti !== 'object' || Array.isArray(ti)) return null;
  if (ti.script !== undefined) return null; // inline script: never ours
  const hasPath = ti.scriptPath !== undefined;
  const hasName = ti.name !== undefined;
  if (hasPath === hasName) return null; // both or neither: ambiguous, leave it to the person
  if (hasPath) {
    if (typeof ti.scriptPath !== 'string' || !path.isAbsolute(ti.scriptPath)) return null;
    const got = real(ti.scriptPath);
    if (!got) return null;
    for (const rel of OWN_SCRIPTS) {
      const want = real(path.join(pluginRoot, rel));
      if (want && want === got) return allow(`own workflow script ${rel}`);
    }
    return null;
  }
  if (typeof ti.name === 'string' && OWN_NAMES.includes(ti.name)) return allow(`own workflow ${ti.name}`);
  return null;
}

function allow(why) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: `productivity-tools: ${why} (auto_approve_workflows is on)`,
    },
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  // The root comes from this file's own location, never from the environment or from the input.
  const pluginRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const out = decide(input, { optIn: process.argv[2] === 'true', pluginRoot });
  if (out) process.stdout.write(JSON.stringify(out));
}

if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch {
    /* no decision */
  }
}
