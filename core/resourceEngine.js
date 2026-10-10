/* ============================================================
 * core/resourceEngine.js —— 资源库引擎（v3，§14-§15）
 * 原则：
 *   - 加入资源库 ≠ 加入计划（§62）：只有 StrategyEngine 判断"当前需要"
 *     才进入周计划；本引擎只提供候选与评估。
 *   - 不能因为课程有名就自动推荐；新增资源必须能回答
 *     "为什么现在需要/解决什么问题/替代了什么/投入多少小时/
 *      是否挤压GPA/是否与已有资源重复"（准入检查，§15）。
 *   - 不默认推荐付费课程（§41）。
 * ============================================================ */

const ResourceEngine = {
  /* 列表（可按分类过滤） */
  list: function (category) {
    var list = state.data.resources || [];
    if (!category || category === '全部') return list.slice();
    return list.filter(function (r) { return r.category === category; });
  },

  get: function (id) {
    return (state.data.resources || []).find(function (r) { return r.id === id; }) || null;
  },

  categories: function () {
    var set = [];
    (state.data.resources || []).forEach(function (r) {
      if (r.category && set.indexOf(r.category) === -1) set.push(r.category);
    });
    return set;
  },

  /* 综合评分（0-25）：质量×1 + 方向匹配×1 + 技术价值×0.8 + 保研价值×0.6（评估参考，非硬门槛） */
  evaluateScore: function (r) {
    return Math.round(((r.quality || 0) + (r.directionMatch || 0) + (r.techValue || 0) * 0.8 + (r.baoyanValue || 0) * 0.6) * 10) / 10;
  },

  /* 准入检查（§15）：新增资源前必须回答的问题；全部有答案才允许加入 */
  gateCheck: function (r) {
    var missing = [];
    if (!r.whyNow || r.whyNow.trim().length < 5) missing.push('为什么现在需要？');
    if (!r.solves) missing.push('它解决什么问题？');
    if (!r.replaces) missing.push('它替代了什么？');
    if (!r.estHours || r.estHours <= 0) missing.push('预计投入多少小时？');
    if (r.squeezesGpa == null) missing.push('是否会挤压 GPA？');
    if (r.overlaps == null) missing.push('是否与已有资源重复？');
    return { ok: missing.length === 0, missing: missing };
  },

  /* 新增资源（通过准入检查后写入，返回 {ok, error, resource}） */
  add: function (spec) {
    var check = this.gateCheck(spec);
    if (!check.ok) return { ok: false, error: '准入检查未通过：' + check.missing.join('；') };
    if (state.data.resources.some(function (r) { return r.name === spec.name; })) {
      return { ok: false, error: '已存在同名资源：「' + spec.name + '」' };
    }
    var r = Object.assign({
      id: 'res-' + uid(),
      quality: 3, directionMatch: 3, techValue: 3, baoyanValue: 2,
      timeCost: '—', recommend: '可选', type: 'resource'
    }, spec);
    state.data.resources.push(r);
    saveData();
    return { ok: true, resource: r };
  },

  /* 更新资源字段 */
  update: function (id, patch) {
    var r = this.get(id);
    if (!r) return false;
    for (var k in patch) r[k] = patch[k];
    saveData();
    return true;
  },

  remove: function (id) {
    var list = state.data.resources || [];
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveData();
    return true;
  },

  /* 计划候选（§62 的界限：只是"候选"，StrategyEngine 才决定是否进计划） */
  planCandidates: function () {
    var stage = GoalEngine.currentStage(currentWeek());
    return (state.data.resources || []).filter(function (r) {
      return r.recommend === '推荐' && (!r.suitableStage || r.suitableStage.indexOf(stage.label) !== -1);
    });
  }
};
