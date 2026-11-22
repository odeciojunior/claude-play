const agTiers = { haiku: 'flash_lite', sonnet: 'flash', opus: 'pro' };

export const AGY_MODEL_RANK = { flash_lite: 0, flash: 1, pro: 2 };

export function agyModelFor(tier, effort) {
  if (tier === 'opus' || tier === 'pro' || effort === 'high') return 'pro';
  if (tier === 'haiku' || tier === 'flash_lite') return 'flash_lite';
  return 'flash';
}

export function agyReviewModelFor(reviewTier, gate = false, agyModel = 'flash') {
  if (gate || reviewTier === 'opus' || reviewTier === 'pro' || agyModel === 'pro') return 'pro';
  return 'flash';
}

export function nextAgyTier(model, sameFindingAgain) {
  if (!sameFindingAgain) return model;
  if (model === 'flash_lite' || model === 'haiku') return 'flash';
  if (model === 'flash' || model === 'sonnet') return 'pro';
  return null;
}

export function toAgyRoute(r) {
  const agyTier = agTiers[r.tier] || 'flash';
  const agyModel = agyModelFor(r.tier, r.effort);
  const agyReviewTier = agTiers[r.reviewTier] || 'pro';
  const agyReviewModel = agyReviewModelFor(r.reviewTier, r.gate, agyModel);
  return { ...r, agyTier, agyModel, agyReviewTier, agyReviewModel };
}
