export const meta = {
  name: 'roadmap-release',
  description: 'Runs tracked roadmap deliverables end to end',
  phases: [{ title: 'probe' }],
};

// roadmap-release workflow script. Self-contained: no imports.
// Runtime API: agent(prompt, {label, phase, model, schema}), phase(), log(), args, budget, parallel().

// <pure>
// </pure>

phase('probe');
const probe = await agent('Reply with exactly the text: ok', { label: 'probe', phase: 'probe', model: 'haiku' });
log(`probe: ${probe}`);

return { status: 'done', args };
