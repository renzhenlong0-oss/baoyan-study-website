/* ============================================================
 * core/planGenerator.js —— 周计划生成器（v3）
 * 彻底取代 v2 的 buildWeekTemplate（按周次硬编码分支）。
 * 流程：战略（默认/AI）→ 时间预算 → 按优先级放置任务（避课/避假/
 *       避重叠/日负荷/睡眠）→ 健身任务 → 组装 subjects → 约束校验。
 * 生成优先级（§33）：GPA风险 > 近期考试 > 核心课程 > 当前技术阶段
 *   > 科研阶段目标 > 英语 > 竞赛 > 其他 —— 由策略层分配表 priority 表达。
 * ============================================================ */

const PlanGenerator = {
  /* 将一个任务种子放入可用时段；成功返回 {task, duration}，失败 null。
   * 时长先【向下取整到 5 分钟】再排——保证各科目任务时长和
   * 不超过分配小时数（周计划总时长 ≤ 预算 planned，验收标准#2）。 */
  placeOne: function (week, seed, durationH, occupied, alloc) {
    /* 最短 0.5h；不足 0.5h 的碎片不放置（避免破坏预算） */
    var wantMin = Math.round(Math.max(0.5, durationH) * 60);
    var durMin = Math.floor(wantMin / 5) * 5;
    if (durMin < 30) durMin = 30;
    var startMin = timeToMin(seed.start);
    var endMin = startMin + durMin;
    var sleepEndMin = timeToMin((state.data.userProfile.sleep && state.data.userProfile.sleep.start) || '23:30');
    var cap = state.data.userProfile.dailyStudyCapHours || 4;

    for (var i = 0; i < (seed.days || []).length; i++) {
      var d = seed.days[i];
      if (isHolidayDate(dateOfWeek(week, d))) continue;

      /* 与课表冲突（按节次精确） */
      var clash = ConstraintEngine.dayClassIntervals(week, d).some(function (iv) {
        return startMin < iv[1] && iv[0] < endMin;
      });
      if (clash) continue;

      /* 与已放置任务（含健身锚点）重叠 */
      var dayTasks = occupied.filter(function (t) { return t.day === d; });
      var overlap = dayTasks.some(function (t) {
        return startMin < timeToMin(t.time.split('-')[1]) && timeToMin(t.time.split('-')[0]) < endMin;
      });
      if (overlap) continue;

      /* 日学习负荷上限 */
      var dayStudy = dayTasks.reduce(function (s, t) {
        return s + (t.subject === '健身' ? 0 : taskHours(t));
      }, 0) + durMin / 60;
      if (dayStudy > cap + 0.01) continue;

      /* 睡眠硬约束 */
      if (endMin > sleepEndMin) continue;

      return {
        task: {
          /* 确定性 id（taskStableId）：重建周计划后 id 不变，
           * 勾选/镜像（dailyLogs.tasksStatus）按 id 精确匹配，
           * 修复"勾选任何任务都只作用于第一项"的问题 */
          id: taskStableId(week, d, minToTime(startMin) + '-' + minToTime(endMin), seed.title),
          day: d,
          time: minToTime(startMin) + '-' + minToTime(endMin),
          title: seed.title,
          subject: alloc.subject,
          type: seed.start === '12:40' ? '碎片' : '学习',
          topicId: seed.topicId || undefined
        },
        duration: Math.round((endMin - startMin) / 60 * 10) / 10
      };
    }
    return null;
  },

  /* 通用空闲时段查找（模板时段全被占时的兜底，保证有分配就有任务）。
   * 注意：不含 12:40 午休时段——午休只留给碎片任务（单词/阅读）。 */
  findFreeSlot: function (week, occupied, wantH, subject) {
    var candidates = [
      { start: '19:00', max: 2 },
      { start: '14:00', max: 2 },
      { start: '09:00', max: 3 },
      { start: '15:40', max: 1.5 },
      { start: '10:50', max: 1.2 }
    ];
    for (var di = 1; di <= 7; di++) {
      for (var ci = 0; ci < candidates.length; ci++) {
        var c = candidates[ci];
        var seed = {
          days: [di],
          start: c.start,
          durationH: Math.min(c.max, wantH),
          title: subject + '（自主安排）'
        };
        var res = PlanGenerator.placeOne(week, seed, seed.durationH, occupied, { subject: subject });
        if (res) return res;
      }
    }
    return null;
  },

  /* 主入口：生成第 week 周的周计划（返回完整 plan 对象，不自动 saveData） */
  generate: function (week, opts) {
    opts = opts || {};
    var strategy = opts.strategy || StrategyEngine.getDefaultWeeklyStrategy(week);
    var budget = strategy.budget || TimeBudgetEngine.computeWeeklyBudget(week);
    var gymPick = GymScheduler.pickGymDays(week);

    /* 1) 健身任务先放（固定锚点），学习任务避让 */
    var gymTasks = gymPick.days.map(function (day) {
      return {
        id: taskStableId(week, day, gymPick.time, '健身'),
        day: day, time: gymPick.time, title: '健身', subject: '健身', type: '固定'
      };
    });

    /* 2) 按优先级放置学习任务 */
    var placed = [];
    var issues = [];
    var sorted = strategy.allocation.slice().sort(function (a, b) { return b.priority - a.priority; });
    sorted.forEach(function (al) {
      if (al.hours <= 0) return;
      var pat = SUBJECT_TASK_PATTERNS[al.subject];
      if (!pat || !pat.patterns.length) {
        issues.push({ code: 'NO_PATTERN', subject: al.subject, message: '科目「' + al.subject + '」暂无任务生成模板，本次跳过' });
        return;
      }
      var remaining = al.hours;
      pat.patterns.forEach(function (seed) {
        if (remaining < 0.5) return;   // 最短任务 0.5h，剩余不足不再放置
        var res = PlanGenerator.placeOne(week, seed, Math.min(remaining, seed.durationH), placed.concat(gymTasks), al);
        if (res) {
          placed.push(res.task);
          remaining = Math.round((remaining - res.duration) * 10) / 10;
        }
      });
      /* 兜底：模板时段全被占（如科研与程设同挤周五晚）→ 扫描空闲时段 */
      if (remaining >= 0.5) {
        var fb = PlanGenerator.findFreeSlot(week, placed.concat(gymTasks), remaining, al.subject);
        if (fb) {
          placed.push(fb.task);
          remaining = Math.round((remaining - fb.duration) * 10) / 10;
        }
      }
    });

    /* 3) 组装 subjects（plannedHours = 分配表的小时数，是"分配契约"而非任务时长和） */
    var byName = {};
    placed.forEach(function (t) {
      if (!byName[t.subject]) {
        byName[t.subject] = {
          subject: t.subject,
          plannedHours: 0,
          goal: (SUBJECT_META[t.subject] || {}).goal || '',
          tasks: []
        };
      }
      byName[t.subject].tasks.push(t);
    });
    strategy.allocation.forEach(function (al) {
      if (byName[al.subject]) byName[al.subject].plannedHours = al.hours;
    });
    var gymH = Math.round(gymTasks.length * ((state.data.userProfile.gym && state.data.userProfile.gym.durationMin) || 90) / 60 * 10) / 10;
    if (gymTasks.length) {
      byName['健身'] = byName['健身'] || { subject: '健身', plannedHours: 0, goal: '', tasks: [] };
      byName['健身'].plannedHours = gymH;
      byName['健身'].goal = '每周' + gymTasks.length + '次（' + gymPick.time + '），' + gymPick.reason;
      gymTasks.forEach(function (t) { byName['健身'].tasks.push(t); });
    }
    var subjects = Object.keys(byName).map(function (k) { return byName[k]; });

    var now = new Date().toISOString();
    var plan = {
      weekNumber: week,
      focus: strategy.summary,
      engineVersion: 3,
      strategy: {
        summary: strategy.summary,
        mainPriorities: strategy.mainPriorities,
        risks: strategy.risks,
        examMode: strategy.examMode,
        gpaStatus: strategy.gpaStatus
      },
      budget: {
        suggested: budget.suggested,
        planned: budget.planned,
        buffer: budget.buffer,
        historicalAvg: budget.historicalAvg,
        recentRate: budget.recentRate
      },
      gym: { days: gymPick.days, time: gymPick.time },
      subjects: subjects,
      createdAt: now,
      updatedAt: now
    };

    /* 4) 约束校验（生成器按约束放置，理论上应无 error；记录 warning 供界面展示） */
    var check = ConstraintEngine.validatePlan(plan, { budget: budget });
    plan.validation = { ok: check.ok, warnings: check.warnings, issues: issues };

    /* 5) 记录预算与战略（migration 重建历史周时不覆盖本周战略） */
    if (opts.record !== false) {
      TimeBudgetEngine.recordForWeek(week, budget);
      state.data.weeklyStrategy = strategy;
    }
    return plan;
  },

  /* 重新生成本周：保留已完成/跳过任务的勾选状态（day|time|title 匹配） */
  regenerate: function (week, opts) {
    opts = opts || {};
    var old = getWeekPlan(week);
    var kept = {};
    if (old) {
      old.subjects.forEach(function (sb) {
        sb.tasks.forEach(function (t) {
          if (t.status !== 'todo') kept[t.day + '|' + t.time + '|' + t.title] = { status: t.status, note: t.note };
        });
      });
    }
    var plan = PlanGenerator.generate(week, opts);
    var matched = 0;
    plan.subjects.forEach(function (sb) {
      sb.tasks.forEach(function (t) {
        var k = kept[t.day + '|' + t.time + '|' + t.title];
        if (k) { t.status = k.status; t.note = k.note; matched++; }
      });
    });
    plan.keptFromPrevious = matched;
    state.data.weekPlans[String(week)] = plan;
    saveData();
    return plan;
  }
};
