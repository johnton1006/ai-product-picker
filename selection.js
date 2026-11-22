(function () {
  "use strict";
  const clampScore = (n) => Math.max(0, Math.min(100, n));
  const cents = (value) => Math.round(value * 100);
  const normalize = (value) => value.normalize("NFKC").toLowerCase().trim();

  function search(catalog, query) {
    const terms = [...new Set(normalize(query).split(/[\s,，、;；]+/).filter(Boolean))];
    if (!terms.length) return catalog.map((product) => ({ product, relevance: 0 }));
    return catalog.flatMap((product) => {
      const title = normalize(product.name);
      const type = normalize(product.type);
      const id = normalize(product.id);
      const evidence = normalize([product.check, ...product.evidence.map((item) => item.text)].join(" "));
      const scores = terms.map((term) => {
        if (id === term) return 5;
        if (title.includes(term)) return 3;
        if (type.includes(term)) return 2;
        return evidence.includes(term) ? 1 : 0;
      });
      return scores.every(Boolean) ? [{ product, relevance: scores.reduce((total, value) => total + value, 0) }] : [];
    }).sort((a, b) => b.relevance - a.relevance);
  }

  function analyze(catalog, filters, limit = 3) {
    const { min, max, budget } = filters;
    if (![min, max, budget].every(Number.isFinite) || min <= 0 || max < min || budget < 0) {
      throw new RangeError("请填写有效的售价范围及备货预算。");
    }
    const matches = [];
    const pending = [];
    let outsidePrice = 0;
    let overBudget = 0;

    const searchMatches = search(catalog, filters.query || "");
    for (const { product, relevance } of searchMatches) {
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
      matches.push({ ...product, stockCost: stockCostCents / 100, scores, score, relevance });
    }
    matches.sort((a, b) => b.relevance - a.relevance || b.score - a.score || a.stockCost - b.stockCost || a.id.localeCompare(b.id));
    return { matches: matches.slice(0, limit), matchedCount: matches.length, searchCount: searchMatches.length, pending, outsidePrice, overBudget };
  }

  if (typeof module === "object" && module.exports) module.exports = { analyze, search };
  else window.selectionEngine = { analyze, search };
})();
