(function () {
  "use strict";
  const catalog = window.productCatalog;
  const { analyze } = window.selectionEngine;
  const $ = (id) => document.getElementById(id);
  const selectionForm = $("selection-form");
  const minimum = $("min-price");
  const maximum = $("max-price");
  const budget = $("budget");
  const dialog = $("details");
  const dialogBody = $("dialog-body");
  const modelMode = $("model-mode");
  const formatMoney = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  const money = (value) => "¥" + formatMoney.format(value);
  let modelAvailable = false;
  let summaries = new Map();
  let selectedProduct = null;
  let activeRequest = null;

  function add(parent, tag, value, className) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    parent.append(node);
    return node;
  }

  function button(parent, label, action) {
    const node = add(parent, "button", label, "secondary");
    node.type = "button";
    node.addEventListener("click", action);
  }

  function section(title) {
    const node = add(dialogBody, "section", null, "detail-section");
    add(node, "h3", title);
    return node;
  }

  function renderProduct(product) {
    $("dialog-title").textContent = product.name;
    dialogBody.replaceChildren();
    const quote = product.unitCost == null ? "采购报价待补充" : "起订采购 " + money(product.unitCost * product.minimumOrder);
    add(dialogBody, "p", "目标售价 " + money(product.price) + " · " + quote);

    const insight = section("拿样判断");
    const summary = summaries.get(product.id);
    const trend = product.evidence.find((item) => item.id === product.id + "-trend");
    const risk = product.evidence.find((item) => item.id === product.id + "-risk");
    if (summary) {
      const points = add(insight, "ul");
      for (const point of summary.points) {
        const item = add(points, "li", point.text + " ");
        for (const sourceId of point.sources) {
          const source = product.evidence.find((entry) => entry.id === sourceId);
          if (!source) continue;
          const link = add(item, "a", "[" + source.label + "] ", "text-button");
          link.href = "#evidence-" + source.id;
        }
      }
      add(insight, "small", "以上内容由模型根据样本证据生成。", "detail-note");
    } else {
      add(insight, "p", product.unitCost == null ? "采购报价缺失，暂无法判断是否符合备货预算。" : trend.text);
      add(insight, "p", risk ? risk.text : "差评样本缺失，暂无法归纳常见问题。");
    }
    add(insight, "p", "拿样时重点复核：" + product.check);

    if (product.scores) {
      const scoring = section("综合评分 " + product.score + " / 100");
      const { demand, competition, cost } = product.scores;
      add(scoring, "p", "需求 " + Math.round(demand) + "（45%） · 竞争 " + Math.round(competition) + "（30%） · 预算余量 " + Math.round(cost) + "（25%）");
      add(scoring, "small", "需求看趋势变化，竞争看同类商品数，预算余量以备货预算为基准。", "detail-note");
    }

    const evidence = section("竞品与证据");
    for (const entry of product.evidence) {
      const item = add(evidence, "article", null, "evidence");
      item.id = "evidence-" + entry.id;
      add(item, "strong", entry.label);
      add(item, "p", entry.text);
      add(item, "small", entry.period + " · 模拟数据");
    }
  }

  function showProduct(product) {
    selectedProduct = product;
    renderProduct(product);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }

  function showCatalog() {
    selectedProduct = null;
    $("dialog-title").textContent = "样本商品库";
    dialogBody.replaceChildren();
    add(dialogBody, "p", "共 " + catalog.length + " 款桌面收纳商品，所有数据均为模拟样本。", "detail-note");
    for (const product of catalog) {
      const row = add(dialogBody, "div", null, "catalog-row");
      add(row, "span", product.name + " · " + money(product.price));
      button(row, "查看证据", () => showProduct(product));
    }
    if (!dialog.open) dialog.showModal();
  }

  function renderResults(result) {
    const list = $("result-list");
    const pending = $("pending");
    list.replaceChildren();
    pending.replaceChildren();
    $("result-count").textContent = "符合条件 " + result.matchedCount + " 款，展示 " + result.matches.length + " 款 · 售价不符 " +
      result.outsidePrice + " 款 · 超出预算 " + result.overBudget + " 款";
    if (result.matches.length === 0) {
      add(list, "p", "当前没有可确认符合条件的商品，可以调整售价区间或备货预算。", "panel empty");
    }
    result.matches.forEach((product, index) => {
      const card = add(list, "article", null, "result-card");
      add(card, "span", index + 1, "rank");
      const identity = add(card, "div");
      add(identity, "h3", product.name);
      const risk = product.evidence.find((entry) => entry.id === product.id + "-risk");
      add(identity, "p", product.type + " · 售价 " + money(product.price));
      add(identity, "p", risk ? "风险：" + risk.text : "差评样本待补充");
      const metrics = add(card, "div", null, "card-metrics");
      const stock = add(metrics, "div");
      add(stock, "small", "起订采购");
      add(stock, "strong", money(product.stockCost));
      const score = add(metrics, "div");
      add(score, "small", "综合评分");
      add(score, "strong", product.score, "score");
      button(card, "查看分析", () => showProduct(product));
    });
    if (result.pending.length) {
      const box = add(pending, "div", null, "pending");
      add(box, "span", result.pending.length + " 款缺少采购数据，待核验预算");
      for (const product of result.pending) button(box, product.name, () => showProduct(product));
    }
  }

  async function enrich(products, filters) {
    const controller = new AbortController();
    activeRequest = controller;
    modelMode.textContent = "模型分析中";
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          products: products.map(({ id, name, evidence }) => ({ id, name, evidence })),
        }),
      });
      if (!response.ok) throw new Error("Analysis unavailable");
      const data = await response.json();
      if (activeRequest !== controller) return;
      summaries = new Map(data.summaries.map((item) => [item.id, item]));
      modelMode.textContent = "模型分析已完成";
      if (dialog.open && selectedProduct && summaries.has(selectedProduct.id)) renderProduct(selectedProduct);
    } catch {
      if (activeRequest === controller) modelMode.textContent = "模型暂不可用 · 规则分析";
    } finally {
      if (activeRequest === controller) activeRequest = null;
    }
  }

  function runSelection() {
    activeRequest?.abort();
    activeRequest = null;
    summaries = new Map();
    const filters = { min: minimum.valueAsNumber, max: maximum.valueAsNumber, budget: budget.valueAsNumber };
    const result = analyze(catalog, filters);
    renderResults(result);
    modelMode.textContent = modelAvailable ? "模型已配置" : "规则分析模式";
    if (modelAvailable && result.matches.length) void enrich(result.matches, filters);
  }

  const validateRange = () => maximum.setCustomValidity(
    minimum.valueAsNumber > maximum.valueAsNumber ? "最高售价须大于或等于最低售价。" : "",
  );
  minimum.addEventListener("input", validateRange);
  maximum.addEventListener("input", validateRange);
  selectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    validateRange();
    if (selectionForm.reportValidity()) runSelection();
  });
  $("reset").addEventListener("click", () => {
    selectionForm.reset();
    validateRange();
    runSelection();
  });
  $("catalog-open").addEventListener("click", showCatalog);
  dialog.addEventListener("close", () => { selectedProduct = null; });
  runSelection();

  if (location.protocol !== "file:") {
    fetch("/api/status")
      .then((response) => response.ok ? response.json() : {})
      .then(({ configured }) => {
        if (!configured) return;
        modelAvailable = true;
        if (selectionForm.checkValidity()) runSelection();
        else modelMode.textContent = "模型已配置";
      })
      .catch(() => {});
  }
})();
