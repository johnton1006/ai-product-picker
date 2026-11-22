(function () {
  "use strict";
  const samples = [
    ["magnetic", "磁吸模块化理线收纳盒", "线材收纳", 59, 14.5, 100, 24, 118, 39, 79, "插头和线材散放，模块化分区便于取用。", "磁力偏弱，满载时安装位容易松动。", "检查磁吸配件的承重和背胶在不同桌面的稳定性。"],
    ["drawer", "透明叠加式桌面抽屉", "小物收纳", 79, 23.8, 100, 18, 154, 49, 99, "透明结构让小物清晰可见，叠放可以节省桌面空间。", "抽屉拉出时容易卡顿，运输后有划痕。", "拿样检查滑轨公差、耐刮性和单件运输包装。"],
    ["clamp", "免打孔夹式桌边挂篮", "桌边扩容", 49, 11.2, 150, 15, 78, 29, 69, "可利用桌边空位放常用物，安装过程简便。", "固定夹可能压伤桌板，部分厚桌面装不上。", "检查最大适配桌板厚度与防滑软垫。"],
    ["stand", "带抽屉双层显示器增高架", "桌面增高", 119, 43.5, 100, 21, 90, 89, 159, "显示器下方形成可用空间，便于收纳键盘。", "承重不足时板材中部容易弯曲。", "确认承重上限和包装体积。"],
    ["tray", "可拆格桌面零件托盘", "分类收纳", 39, 9.6, 200, 6, 210, 19, 49, "隔板可调整，适合整理尺寸不同的小物件。", "隔板偏松，倾斜时小物易串格。", "检查格位间隙与隔板锁扣。"],
    ["rotating", "旋转式多格桌面笔筒", "文具收纳", 69, 19.8, 180, 10, 174, 39, 89, "转盘让多个格口容易够到。", "底座噪音较大，单侧装满后容易倾倒。", "做偏载旋转测试并复核起订量。"],
    ["felt", "毛毡桌面收纳组合套装", "组合收纳", 89, null, 80, 12, 66, 69, 119, "软质收纳格适合存放易刮擦的小物。", null, "补齐供应商报价与同类评论后再核算。"],
    ["vertical", "可调节立式文件架", "文件收纳", 45, 13.2, 100, -4, 130, 29, 59, "可调隔距便于同时收纳纸张和文件夹。", "重文件夹可能把薄隔板压弯。", "检查隔板厚度和安装后的左右稳定性。"],
  ];

  const catalog = samples.map(([id, name, type, price, unitCost, minimumOrder, change, competitors, low, high, benefit, complaint, check]) => ({
    id, name, type, price, unitCost, minimumOrder, change, competitors, low, high,
    evidence: [
      { id: id + "-market", label: "竞品样本", text: "同类商品 " + competitors + " 款，参考售价 ¥" + low + "–" + high + "。", period: "演示快照" },
      { id: id + "-trend", label: "趋势样本", text: "近 30 天需求指标较前 30 天变化 " + (change > 0 ? "+" : "") + change + "%。", period: "模拟 30 天窗口" },
      ...(benefit ? [{ id: id + "-benefit", label: "好评主题", text: benefit, period: "样本评论归纳" }] : []),
      ...(complaint ? [{ id: id + "-risk", label: "差评主题", text: complaint, period: "样本评论归纳" }] : []),
      ...(unitCost !== null ? [{ id: id + "-cost", label: "采购报价", text: "采购单价 ¥" + unitCost + "，起订 " + minimumOrder + " 件。", period: "模拟供应商报价" }] : []),
    ],
    check,
  }));

  if (typeof module === "object" && module.exports) module.exports = catalog;
  else window.productCatalog = catalog;
})();
