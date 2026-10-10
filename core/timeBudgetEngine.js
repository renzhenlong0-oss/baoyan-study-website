/* ============================================================
 * core/timeBudgetEngine.js —— 时间预算引擎（v3 核心）
 * 彻底取代 v2 的"每周固定 28h"：
 *   理论可用 = 清醒时间 − 上课 − 作业刚性 − 吃饭 − 通勤休息 − 健身 − 固定活动
 *   历史实际 = 近 4 周实际完成时长均值（无数据 → 锚定 18h）
 *   建议值   = min(理论可用, 历史实际) × 执行率调整，且保留 ≥10% Buffer
 * 原则：安排的是"能执行的量"，不是"理论上能塞进去的量"。
 * ============================================================ */

const TimeBudgetEngine = {
  /* 生活常数（小时/周），可在 userProfile 覆盖 */
  defaults: {
    mealsH: 10.5,           // 吃饭
    commuteRestH: 14,       // 通勤/洗漱/必要休息
    bufferRatio: 0.12,      // Buffer 占建议值的比例（≥10%，§10）
    minSuggested: 10,
    maxSuggested: 26,
    examHomeworkBoost: 0.3  // 考试临近时作业刚性需求上浮
  },

  /* 第 week 周上课总时长（按节次 45min 精确计算，跨行连排不重复计） */
  classHoursOfWeek: function (week) {
    var entries = getWeekEntries(week);
    var min = 0;
    entries.forEach(function (it) {
      var hit = it.entry.periods.filter(function (p) {
        return it.row.periods.indexOf(p) !== -1;
      });
      min += hit.length * 45;
    });
    return Math.round((min / 60) * 10) / 10;
  },

  /* 考试临近度：本周内任意核心课 examDate 距周末 ≤14 天（或处于 examWeeksHint） */
  isExamProximity: function (week) {
    var s = state.data.semester;
    if ((s.examWeeksHint || []).indexOf(week) !== -1) return true;
    var weekEnd = dateOfWeek(week, 7);
    var close = state.data.courses.some(function (c) {
      if (!c.examDate || (c.credits || 0) < 2) return false;
      var d = diffDays(c.examDate, weekEnd);
      return d >= 0 && d <= 14;
    });
    return close;
  },

  /* 理论可用学习时间（小时） */
  theoreticalHours: function (week, opts) {
    opts = opts || {};
    var profile = state.data.userProfile;
    var cfg = this.defaults;

    var classH = opts.classH != null ? opts.classH : this.classHoursOfWeek(week);
    var homeworkH = profile.homeworkHoursPerWeek != null ? profile.homeworkHoursPerWeek : 8;
    if (opts.examProximity || this.isExamProximity(week)) {
      homeworkH = Math.round(homeworkH * (1 + cfg.examHomeworkBoost) * 10) / 10;
    }
    var gymDays = opts.gymDays;
    if (gymDays == null && typeof GymScheduler !== 'undefined') {
      gymDays = GymScheduler.pickGymDays(week).days;
    }
    var gymH = Math.round((gymDays || []).length * ((profile.gym && profile.gym.durationMin) || 90) / 60 * 10) / 10;
    var fixedH = (profile.fixedActivities || []).reduce(function (s, a) { return s + (a.hours || 0); }, 0);

    var awakeH = 7 * 16;   // 每天 16h 清醒（睡眠 8h）
    var theoretical = awakeH - classH - homeworkH - cfg.mealsH - cfg.commuteRestH - gymH - fixedH;
    return Math.round(theoretical * 10) / 10;
  },

  /* 第 week 周实际完成时长（来自 dailyLogs.tasksStatus 镜像，
   * 周计划重建也不会丢失历史执行数据） */
  actualHoursOfWeek: function (week) {
    var sum = 0;
    for (var d = 1; d <= 7; d++) {
      var ds = dateOfWeek(week, d);
      var log = state.data.dailyLogs[ds];
      if (!log || !log.tasksStatus) continue;
      Object.keys(log.tasksStatus).forEach(function (id) {
        var st = log.tasksStatus[id];
        if (st && st.status === 'done') sum += Number(st.duration || 0);
      });
    }
    return Math.round(sum * 10) / 10;
  },

  /* 历史平均实际学习时长：近 4 周（排除目标周）有数据的周取均值 */
  historicalAverage: function (week) {
    var profile = state.data.userProfile;
    var weeks = [];
    for (var w = week - 1; w >= Math.max(1, week - 4); w--) {
      var h = this.actualHoursOfWeek(w);
      if (h > 0) weeks.push(h);
    }
    if (weeks.length >= 2) {
      var sum = weeks.reduce(function (a, b) { return a + b; }, 0);
      return Math.round(sum / weeks.length * 10) / 10;
    }
    return profile.initialHistoryAvgHours || 18;
  },

  /* 近 7 天执行率：最近 14 个日历日内镜像记录 done/(done+skipped)；
   * 样本不足 5 条 → 返回 opts.fallback（默认 0.8） */
  recentExecutionRate: function (opts) {
    opts = opts || {};
    var done = 0, attempted = 0;
    var today = todayStr();
    for (var i = 0; i < 14; i++) {
      var d = parseDate(today);
      d.setDate(d.getDate() - i);
      var log = state.data.dailyLogs[fmtISODate(d)];
      if (!log || !log.tasksStatus) continue;
      Object.keys(log.tasksStatus).forEach(function (id) {
        var st = log.tasksStatus[id];
        if (!st) return;
        if (st.status === 'done') { done++; attempted++; }
        else if (st.status === 'skipped') { attempted++; }
      });
    }
    if (attempted < 5) return opts.fallback != null ? opts.fallback : 0.8;
    return Math.round(done / attempted * 100) / 100;
  },

  /* 主入口：计算第 week 周的完整时间预算 */
  computeWeeklyBudget: function (week, opts) {
    opts = opts || {};
    var cfg = this.defaults;
    var profile = state.data.userProfile;

    var examProximity = this.isExamProximity(week);
    var classH = opts.classH != null ? opts.classH : this.classHoursOfWeek(week);
    var gymPick = (typeof GymScheduler !== 'undefined') ? GymScheduler.pickGymDays(week) : { days: [] };
    var theoretical = this.theoreticalHours(week, {
      classH: classH, examProximity: examProximity, gymDays: gymPick.days
    });
    var historicalAvg = this.historicalAverage(week);
    var recentRate = this.recentExecutionRate({ fallback: opts.fallbackRate });

    /* 建议值 = min(理论, 历史实际)，再按近期执行率下调（§9 示例：24/18/76% → 18） */
    var base = Math.min(theoretical, historicalAvg);
    var rateFactor = recentRate >= 0.75 ? 1 : Math.max(0.5, recentRate / 0.75);
    var suggested = clamp(Math.round(base * rateFactor * 2) / 2, cfg.minSuggested, cfg.maxSuggested);

    /* Buffer ≥10%（§10：不把可用时间 100% 排满） */
    var buffer = Math.max(1, Math.round(suggested * cfg.bufferRatio * 2) / 2);
    var planned = Math.round((suggested - buffer) * 10) / 10;

    return {
      week: week,
      theoretical: theoretical,
      historicalAvg: historicalAvg,
      recentRate: recentRate,
      suggested: suggested,
      planned: planned,
      buffer: buffer,
      examProximity: examProximity,
      gymDays: gymPick.days,
      breakdown: {
        sleepH: 7 * 8,
        classH: classH,
        homeworkH: Math.round((profile.homeworkHoursPerWeek || 8) * (examProximity ? 1 + cfg.examHomeworkBoost : 1) * 10) / 10,
        mealsH: cfg.mealsH,
        commuteRestH: cfg.commuteRestH,
        gymH: Math.round(gymPick.days.length * ((profile.gym && profile.gym.durationMin) || 90) / 60 * 10) / 10,
        fixedH: (profile.fixedActivities || []).reduce(function (s, a) { return s + (a.hours || 0); }, 0)
      }
    };
  },

  /* 写入/更新该周预算记录（planGenerator 调用后 saveData） */
  recordForWeek: function (week, budget) {
    state.data.timeBudgets = state.data.timeBudgets || {};
    state.data.timeBudgets[String(week)] = clone(budget);
  }
};
