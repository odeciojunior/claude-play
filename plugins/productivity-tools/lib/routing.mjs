// Definição única de roteamento (E6, peça 2): fonte pura (DEC-058), sem imports nem acesso a ambiente.
// Regras 0 a 8 transcritas de routing.md §1 a §4 e de roadmap-release.js (effortFor, reviewModelFor).

const rtTiers = ['haiku', 'sonnet', 'opus'];

function rtScope(files) {
  const f = files || {};
  const seen = new Set([...(f.create || []), ...(f.modify || []), ...(f.test || [])]);
  return seen.size <= 1 ? 0 : seen.size <= 5 ? 1 : 2;
}

function rtUp(tier) {
  return rtTiers[Math.min(rtTiers.indexOf(tier) + 1, 2)];
}

export function route(task, ctx) {
  const s = task.score;
  const hasDependents = !!(ctx && ctx.hasDependents);
  // Regra 0: efeito externo conta como blast 2, sem alterar a tarefa recebida.
  const blast = task.external ? 2 : s.blast;
  // Regra 1: escopo e total.
  const scope = rtScope(task.files);
  const total = scope + s.ambiguity + s.reasoning + blast + s.verifiability;
  // Regra 2: tabela.
  let tier = total <= 2 ? 'haiku' : total <= 5 ? 'sonnet' : blast === 2 && s.ambiguity === 2 ? 'opus' : 'sonnet';
  let gate = false;
  // Regra 3: teto mecânico.
  if (scope === 2 && s.ambiguity === 0 && s.reasoning === 0 && blast <= 1) tier = 'haiku';
  // Regra 4: verificação pesada.
  if (s.verifiability === 2 && s.reasoning >= 1) {
    if (total <= 5) tier = rtUp(tier);
    else if (tier === 'sonnet') gate = true;
  }
  // Regra 5: piso de risco.
  const floor = blast === 2;
  if (floor) {
    if (tier === 'haiku') tier = 'sonnet';
    gate = true;
  }
  // Regra 6: effort.
  const effort = tier === 'haiku' ? 'low' : tier === 'sonnet' && total >= 6 ? 'high' : 'medium';
  // Regra 7: revisor.
  const reviewTier = blast === 2 || tier === 'opus' ? 'opus' : 'sonnet';
  // Regra 8: portão.
  if (total >= 7 || (tier === 'haiku' && hasDependents && s.verifiability >= 1)) gate = true;
  return {
    tier,
    effort,
    reviewTier,
    gate,
    score: { scope, ambiguity: s.ambiguity, reasoning: s.reasoning, blast, verifiability: s.verifiability, total },
  };
}
