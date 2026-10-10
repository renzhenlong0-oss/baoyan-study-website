/* ============================================================
 * core/reviewEngine.js —— 复盘引擎（v3，§35-§36）
 * 周复盘读取【历史执行数据】（dailyLogs.tasksStatus 镜像优先），
 * 周计划重建也不会丢历史实际时长。
 * 核心设计原则（§36）：连续多周完成率偏低时，
 * 系统首先检查【计划是否过载】，而不是归因于"自律不足"。
 * ============================================================ */

const ReviewEngine = {
  /* 周复盘汇总（镜像优先：历史实际时长来自 dailyLogs 镜像） */
  computeWeekSummary: function (week) {
    var res = {
      taskCompletionRate: 0,
      gymCompletionRate: 0,
      subjectHoursActual: {},
      subjectHoursPlanned: {},
      vocabTotal: 0,
      aiToolUsageCount: 0,
      incompleteTasks: [],
      totalTasks: 0,
      doneTasks: 0,
      skippedTasks: 0,
      skipCategories: {},      // 结构化跳过原因统计（§35）
      efficiencyAvg: 0,        // 学习效率自评均值（1-5）
      efficiencyCount: 0,
      actualHours: 0
    };
    var plan = getWeekPlan(week);

    /* 每日镜像汇总（历史执行数据：周计划重建后依然准确） */
    var mirrorStats = { done: 0, skipped: 0, total: 0 };
    var effSum = 0, effCount = 0;
    var gymDoneDays = 0, gymTotal = 0;
    for (var d = 1; d <= 7; d++) {
      var dateStr = dateOfWeek(week, d);
      var log = state.data.dailyLogs[dateStr];
      if (!log) { if (d >= 2) gymTotal++; continue; }
      if (log.checklist) {
        res.vocabTotal += Number(log.checklist.vocabCount || 0);
        if (log.checklist.efficiency > 0) { effSum += Number(log.checklist.efficiency); effCount++; }
        if (d >= 2) {
          gymTotal++;
          if (log.checklist.gymDone) gymDoneDays++;
        }
      }
      var ts = log.tasksStatus || {};
      Object.keys(ts).forEach(function (id) {
        var st = ts[id];
        if (!st) return;
        mirrorStats.total++;
        if (st.status === 'done') {
          mirrorStats.done++;
          res.subjectHoursActual[st.subject] = (res.subjectHoursActual[st.subject] || 0) + Number(st.duration || 0);
          res.actualHours += Number(st.duration || 0);
        } else if (st.status === 'skipped') {
          mirrorStats.skipped++;
          var cat = st.skipCategory || '其他';
          res.skipCategories[cat] = (res.skipCategories[cat] || 0) + 1;
        }
      });
    }
    res.gymCompletionRate = gymTotal ? Math.round(gymDoneDays / gymTotal * 100) / 100 : 0;
    res.efficiencyAvg = effCount ? Math.round(effSum / effCount * 10) / 10 : 0;
    res.efficiencyCount = effCount;
    res.actualHours = Math.round(res.actualHours * 10) / 10;

    /* 计划侧汇总（v3 计划的完成率以计划为准；旧/重建周的完成率以镜像为准） */
    if (plan && plan.engineVersion === 3) {
      plan.subjects.forEach(function (sb) {
        res.subjectHoursPlanned[sb.subject] = (res.subjectHoursPlanned[sb.subject] || 0) + Number(sb.plannedHours || 0);
        sb.tasks.forEach(function (t) {
          res.totalTasks++;
          if (t.status === 'done') res.doneTasks++;
          else if (t.status === 'skipped') {
            res.skippedTasks++;
            var c = t.skipCategory || '其他';
            res.skipCategories[c] = (res.skipCategories[c] || 0) + 1;
          }
          if (t.status !== 'done') {
            res.incompleteTasks.push({ day: t.day, title: t.title, time: t.time, reason: t.status === 'skipped' ? (t.note || '跳过') : '' });
          }
        });
      });
      res.taskCompletionRate = res.totalTasks ? Math.round(res.doneTasks / res.totalTasks * 100) / 100 : 0;
    } else if (mirrorStats.total) {
      res.totalTasks = mirrorStats.total;
      res.doneTasks = mirrorStats.done;
      res.skippedTasks = mirrorStats.skipped;
      res.taskCompletionRate = Math.round(mirrorStats.done / mirrorStats.total * 100) / 100;
    }

    /* AI 工具使用次数（修复 v2 双计数：按日期去重） */
    var counted = {};
    for (var d2 = 1; d2 <= 7; d2++) {
      var ds = dateOfWeek(week, d2);
      var lg = state.data.dailyLogs[ds];
      if (lg && lg.aiToolLog && lg.aiToolLog.trim()) { counted[ds] = true; res.aiToolUsageCount++; }
    }
    (state.data.aiLogs || []).forEach(function (a) {
      if (weekOfDate(a.date) === week && !counted[a.date]) {
        res.aiToolUsageCount++;
        counted[a.date] = true;
      }
    });

    return res;
  },

  /* 计划过载检测（§36）：连续 ≥2 周完成率 ≤60% → 先怀疑计划本身 */
  checkPlanOverload: function (week) {
    var wk = week != null ? week : currentWeek();
    var lowWeeks = [];
    var rates = [];
    for (var i = 0; i < 4; i++) {
      var w = wk - i;
      if (w < 1) continue;
      var s = this.computeWeekSummary(w);
      if (s.totalTasks >= 5) {
        rates.push({ week: w, rate: s.taskCompletionRate });
        if (s.taskCompletionRate <= 0.6) lowWeeks.push(w);
      }
    }
    var overload = rates.length >= 2 && lowWeeks.length >= 2 &&
      rates.slice(0, 2).every(function (r) { return r.rate <= 0.6; });
    return {
      overload: overload,
      lowWeeks: lowWeeks,
      rates: rates,
      message: overload
        ? '连续多周完成率偏低（' + lowWeeks.map(function (w) { return '第' + w + '周'; }).join('、') + '）。先检查计划是否过载：' +
          '1) 预算是否超出历史实际能力（时间预算引擎会自动下调建议值）；' +
          '2) 任务难度与前置基础是否匹配；' +
          '3) 是否被临时事件集中冲击。优先调整计划，而不是要求"更努力"。'
        : ''
    };
  },

  /* 偏差分析：实际 vs 计划的科目级差距 + 跳过原因归因 */
  analyzeWeek: function (week) {
    var s = this.computeWeekSummary(week);
    var plan = getWeekPlan(week);
    var gaps = [];
    Object.keys(s.subjectHoursPlanned).forEach(function (subject) {
      if (subject === '健身') return;
      var planned = s.subjectHoursPlanned[subject];
      var actual = s.subjectHoursActual[subject] || 0;
      gaps.push({
        subject: subject,
        planned: Math.round(planned * 10) / 10,
        actual: Math.round(actual * 10) / 10,
        ratio: planned ? Math.round(actual / planned * 100) : 0
      });
    });
    gaps.sort(function (a, b) { return a.ratio - b.ratio; });

    /* 跳过原因归因（§35 选项） */
    var cats = Object.keys(s.skipCategories).sort(function (a, b) { return s.skipCategories[b] - s.skipCategories[a]; });
    var topCat = cats[0] || null;
    var catAdvice = {
      '课程太多': '课程压力大：确认本周课表与作业量，预算引擎应下调建议值，减少自主学习计划。',
      '任务估计错误': '任务时长估计偏低：把同类任务时长上调 20% 再排计划。',
      '难度过高': '任务难度与当前基础不匹配：检查前置知识点（编程路线依赖），降低单次任务量。',
      '疲劳': '疲劳积累：减少晚间高认知任务，保证睡眠与 Buffer。',
      '临时事件': '临时事件集中：属正常波动，复盘保留 Buffer 即可。',
      '拖延': '拖延：把任务切小（≤1h 起步），与健身/课程锚点绑定。',
      '兴趣不足': '兴趣不足：该科目是否被过度分配？与 AI 讨论重新分配。',
      '其他': '原因分散：逐条查看未完成任务的备注。'
    };

    var budget = TimeBudgetEngine.computeWeeklyBudget(week);
    var planHours = plan ? plan.subjects.reduce(function (sum, sb) {
      return sum + (sb.subject === '健身' ? 0 : Number(sb.plannedHours || 0));
    }, 0) : 0;

    return {
      week: week,
      completionRate: s.taskCompletionRate,
      actualHours: s.actualHours,
      plannedHours: Math.round(planHours * 10) / 10,
      budgetPlanned: budget.planned,
      efficiencyAvg: s.efficiencyAvg,
      gaps: gaps,
      topSkipCategory: topCat,
      skipAdvice: topCat ? (catAdvice[topCat] || '') : '',
      overload: this.checkPlanOverload(week)
    };
  }
};
