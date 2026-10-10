/* ============================================================
 * core/goalEngine.js —— 目标引擎（v3）
 * 长期目标（2030 推免 → 中上985 → AI/Robotics）+ 阶段目标（8 学期）。
 * 数据存于 state.data.goals（可编辑，默认见 data/goals.js）。
 * ============================================================ */

const GoalEngine = {
  /* 当前所处阶段（周次 → 阶段） */
  currentStage: function (week) {
    var wk = week != null ? week : currentWeek();
    return stageForWeek(wk, state.data.goals && state.data.goals.stages);
  },

  /* 阶段进度：阶段内已过周数 / 总周数 */
  stageProgress: function (week) {
    var s = this.currentStage(week);
    var wk = week != null ? week : currentWeek();
    var span = s.weeks ? s.weeks : s.offset;
    var total = span[1] - span[0] + 1;
    var done = clamp(wk - span[0] + 1, 0, total);
    return { stage: s, total: total, done: done, pct: Math.round(done / total * 100) };
  },

  /* 目标概览（首页用）：{ longTerm, stage, nextStage } */
  overview: function (week) {
    var wk = week != null ? week : currentWeek();
    var stages = (state.data.goals && state.data.goals.stages) || GOALS_DEFAULTS.stages;
    var cur = this.currentStage(wk);
    var idx = stages.indexOf(cur);
    return {
      longTerm: (state.data.goals && state.data.goals.longTerm) || GOALS_DEFAULTS.longTerm,
      stage: cur,
      nextStage: idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null,
      progress: this.stageProgress(wk)
    };
  }
};
