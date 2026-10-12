// Pure rating logic (no DOM). Loaded in the browser and requirable from Node for tests.
(function (root) {
  // baseRating is the starting rating; minRating/maxRating are the caps.
  const CONFIG = { baseRating: 1000, adjustingPeriod: 5, minRating: 0, maxRating: 2000 };
  const APTITUDES = ['sprint', 'mile', 'medium', 'long', 'dirt'];

  // Early on a uma's divisor is small, so its rating moves fast; it grows to
  // adjustingPeriod as the uma settles. roundsRated = rounds it has placed in since (re)entering.
  function effectivePeriod(roundsRated, cfg = CONFIG) {
    return Math.min(cfg.adjustingPeriod, roundsRated + 1);
  }

  // Same shape as target = current + baseRating * placement/20, stepped by 1/period: a fixed-size
  // step per placement, so top placers always rise, bottom placers always fall, and consistent
  // placers keep pulling apart until they hit the min/max cap.
  function newRating(current, placement, roundsRated, cfg = CONFIG) {
    const period = effectivePeriod(roundsRated, cfg);
    const next = current + (cfg.baseRating * placement / 20) / period;
    return Math.min(cfg.maxRating, Math.max(cfg.minRating, next));
  }

  // Shift every rating by the same amount so their mean is baseRating (1000). Clamping at the
  // min/max caps can leave the mean slightly off, so repeat until it settles.
  function recenter(ratings, cfg = CONFIG) {
    let out = ratings.slice();
    if (!out.length) return out;
    for (let i = 0; i < 20; i++) {
      const shift = cfg.baseRating - out.reduce((a, b) => a + b, 0) / out.length;
      if (Math.abs(shift) < 1e-9) break;
      out = out.map(r => Math.min(cfg.maxRating, Math.max(cfg.minRating, r + shift)));
    }
    return out;
  }

  // Top 1 -> +3 ... Top 3 -> +1, Bottom 1 (worst) -> -3 ... Bottom 3 -> -1
  const PLACEMENTS = {
    top1: 3, top2: 2, top3: 1,
    bot3: -1, bot2: -2, bot1: -3,
  };

  root.Rating = { CONFIG, APTITUDES, PLACEMENTS, effectivePeriod, newRating, recenter };
  if (typeof module !== 'undefined') module.exports = root.Rating;
})(typeof window !== 'undefined' ? window : globalThis);
