(function () {
  "use strict";
  const catalog = window.productCatalog;
  const { analyze, search } = window.selectionEngine;
  const $ = (id) => document.getElementById(id);
  const selectionForm = $("selection-form");
  const keywords = $("keywords");
  const minimum = $("min-price");
  const maximum = $("max-price");
  const budget = $("budget");
  const dialog = $("details");
  const dialogBody = $("dialog-body");
  const modelMode = $("model-mode");
  const toggleResults = $("toggle-results");
  const formatMoney = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  const money = (value) => "¥" + formatMoney.format(value);
  let modelAvailable = false;
  let summaries = new Map();
  let selectedProduct = null;
  let activeRequest = null;
  let latestResult = null;
  let expanded = false;
  let lastQuery = "";
  $("catalog-size").textContent = catalog.length;

  function missingProcurement(product) {
    return [
      product.unitCost == null ? "采购单价" : "",
      product.minimumOrder == null ? "起订量" : "",
    ].filter(Boolean).join("、");
  }

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
    const missing = missingProcurement(product);
    const quote = missing ? missing + "待补充" : "起订采购 " + money(product.unitCost * product.minimumOrder);
    add(dialogBody, "p", product.id + " · 目标售价 " + money(product.price) + " · " + quote);

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
      add(insight, "p", missing ? missing + "缺失，暂无法判断是否符合备货预算。" : trend.text);
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
    add(dialogBody, "p", "库内检索覆盖全部 " + catalog.length + " 条模拟样本，不受工作台售价和预算限制。", "detail-note");
    const field = add(dialogBody, "input", null, "catalog-search");
    field.type = "search";
    field.maxLength = 100;
    field.placeholder = "搜索商品名、编号、类目或证据";
    field.setAttribute("aria-label", "搜索样本商品库");
    const count = add(dialogBody, "p", null, "detail-note");
    count.setAttribute("role", "status");
    const rows = add(dialogBody, "div");
    function renderCatalogRows() {
      const matches = search(catalog, field.value);
      count.textContent = "找到 " + matches.length + " 条";
      rows.replaceChildren();
      for (const { product } of matches) {
        const row = add(rows, "div", null, "catalog-row");
        add(row, "span", product.name + " · " + money(product.price));
        button(row, "查看证据", () => showProduct(product));
      }
    }
    field.addEventListener("input", renderCatalogRows);
    renderCatalogRows();
    if (!dialog.open) dialog.showModal();
    field.focus();
  }

  function renderResults(result) {
    const list = $("result-list");
    const pending = $("pending");
    list.replaceChildren();
    pending.replaceChildren();
    const visible = expanded ? result.matches : result.matches.slice(0, 3);
    $("sort-label").textContent = lastQuery ? "按搜索相关性与评分排序" : "按综合评分排序";
    $("result-count").textContent = (lastQuery ? "搜索命中 " + result.searchCount + " 条 · " : "") +
      "符合条件 " + result.matchedCount + " 款，展示 " + visible.length + " 款 · 售价不符 " +
      result.outsidePrice + " 款 · 超出预算 " + result.overBudget + " 款";
    toggleResults.hidden = result.matchedCount <= 3;
    toggleResults.textContent = expanded ? "收起至前 3 款" : "查看全部 " + result.matchedCount + " 款";
    if (visible.length === 0) {
      const message = result.searchCount === 0 ? "没有找到对应的商品或证据，可以换一个商品词或风险词。"
        : "当前没有可确认符合条件的商品，可以调整售价区间或备货预算。";
      add(list, "p", message, "panel empty");
    }
    visible.forEach((product, index) => {
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
      const box = add(pending, "details", null, "pending");
      add(box, "summary", result.pending.length + " 款缺少采购数据，待核验预算");
      const items = add(box, "div", null, "pending-items");
      for (const product of result.pending) button(items, product.name, () => showProduct(product));
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

  function runSelection(requestModel = false) {
    activeRequest?.abort();
    activeRequest = null;
    summaries = new Map();
    const filters = { min: minimum.valueAsNumber, max: maximum.valueAsNumber, budget: budget.valueAsNumber };
    lastQuery = keywords.value.trim();
    expanded = false;
    latestResult = analyze(catalog, { ...filters, query: lastQuery }, catalog.length);
    renderResults(latestResult);
    modelMode.textContent = modelAvailable ? "模型已配置 · 提交后分析" : "离线检索与规则分析";
    if (requestModel && modelAvailable && latestResult.matches.length) void enrich(latestResult.matches.slice(0, 3), filters);
  }

  const validateRange = () => maximum.setCustomValidity(
    minimum.valueAsNumber > maximum.valueAsNumber ? "最高售价须大于或等于最低售价。" : "",
  );
  minimum.addEventListener("input", validateRange);
  maximum.addEventListener("input", validateRange);
  selectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    validateRange();
    if (selectionForm.reportValidity()) runSelection(true);
  });
  $("reset").addEventListener("click", () => {
    selectionForm.reset();
    validateRange();
    runSelection();
  });
  $("catalog-open").addEventListener("click", showCatalog);
  toggleResults.addEventListener("click", () => {
    expanded = !expanded;
    renderResults(latestResult);
    if (!expanded) $("results").scrollIntoView({ block: "start" });
  });
  dialog.addEventListener("close", () => { selectedProduct = null; });
  runSelection();

  if (location.protocol !== "file:") {
    fetch("/api/status")
      .then((response) => response.ok ? response.json() : {})
      .then(({ configured }) => {
        if (!configured) return;
        modelAvailable = true;
        modelMode.textContent = "模型已配置 · 提交后分析";
      })
      .catch(() => {});
  }
})();
