/* ============================================================
 * core/competitionEngine.js —— 竞赛引擎（v3，§28）
 * Value Score = 保研价值 + 技术价值 + 方向匹配 + 成果可迁移性 − 时间成本
 * 原则：竞赛不是越多越好；大一当前策略：竞赛优先级【低】，
 *       仅保留极低成本的技术训练型比赛（§51）。
 * 竞赛投入同样必须进入 Time Budget，由 StrategyEngine 决定是否排入计划。
 * ============================================================ */

const CompetitionEngine = {
  /* 列表（附 valueScore 与阶段建议） */
  list: function () {
    var list = (state.data.competitions || []).slice();
    return list.map(function (c) {
      return Object.assign({}, c, { valueScore: competitionValueScore(c) });
    });
  },

  get: function (id) {
    return (state.data.competitions || []).find(function (c) { return c.id === id; }) || null;
  },

  add: function (spec) {
    if (state.data.competitions.some(function (c) { return c.name === spec.name; })) {
      return { ok: false, error: '已存在同名比赛：「' + spec.name + '」' };
    }
    var c = Object.assign({
      id: 'comp-' + uid(),
      estHours: 0, baoyanValue: 1, techValue: 1, directionMatch: 1, outcomeValue: 1, timeCost: 1,
      teamRequired: false, transferability: '', status: '候选', note: ''
    }, spec);
    state.data.competitions.push(c);
    saveData();
    return { ok: true, competition: c };
  },

  update: function (id, patch) {
    var c = this.get(id);
    if (!c) return false;
    for (var k in patch) c[k] = patch[k];
    saveData();
    return true;
  },

  remove: function (id) {
    var list = state.data.competitions;
    var idx = list.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveData();
    return true;
  },

  /* 阶段建议（§51：大一 = 低优先级，只保留极低成本技术训练型） */
  stageAdvice: function (week) {
    var stage = GoalEngine.currentStage(week);
    if (stage.id === 's1') {
      return {
        text: '大一上策略：竞赛优先级【低】。只保留极低成本的技术训练型比赛（如 ACM 新生赛），以赛促学，不追求名次。高投入比赛（机器人大赛等）建议大二确定方向后精选 1 项。',
        allowHighCost: false
      };
    }
    if (stage.id === 's2') return { text: '大一下策略：竞赛优先级【低-中】。可准备蓝桥杯等算法型比赛，注意不与 GPA 主线冲突。', allowHighCost: false };
    return { text: '大二起策略：确定方向后精选 1-2 项高价值竞赛投入（方向匹配优先）。', allowHighCost: true };
  }
};
