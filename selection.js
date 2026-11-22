(function () {
  "use strict";
  const clampScore = (n) => Math.max(0, Math.min(100, n));
  const cents = (value) => Math.round(value * 100);

  function analyze(catalog, filters, limit = 3) {
    const { min, max, budget } = filters;
    if (![min, max, budget].every(Number.isFinite) || min <= 0 || max < min || budget < 0) {
      throw new RangeError("请填写有效的售价范围及备货预算。");
    }
    const matches = [];
    const pending = [];
    let outsidePrice = 0;
    let overBudget = 0;

    for (const product of catalog) {
      if (cents(product.price) < cents(min) || cents(product.price) > cents(max)) {
        outsidePrice++;
        continue;
      }
      if (product.unitCost === null || product.minimumOrder === null) {
        pending.push(product);
        continue;
      }
      const stockCostCents = cents(product.unitCost) * product.minimumOrder;
      if (stockCostCents > cents(budget)) {
        overBudget++;
        continue;
      }
      const scores = {
        demand: clampScore(55 + product.change * 1.7),
        competition: clampScore(100 - product.competitors * 0.28),
        cost: cents(budget) === 0 ? 100 : clampScore(100 * (1 - stockCostCents / cents(budget))),
      };
      const score = Math.round(scores.demand * 0.45 + scores.competition * 0.3 + scores.cost * 0.25);
      matches.push({ ...product, stockCost: stockCostCents / 100, scores, score });
    }
    matches.sort((a, b) => b.score - a.score || a.stockCost - b.stockCost || a.id.localeCompare(b.id));
    return { matches: matches.slice(0, limit), matchedCount: matches.length, pending, outsidePrice, overBudget };
  }

  if (typeof module === "object" && module.exports) module.exports = { analyze };
  else window.selectionEngine = { analyze };
})();
