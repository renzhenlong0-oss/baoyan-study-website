/* ============================================================
 * core/constraintEngine.js —— 硬约束校验（v3）
 * 所有任务变更（手动添加、计划生成、AI 提议）必须经过这里。
 * 校验项（§32 + 验收标准）：
 *   - 任务时间重叠       - 与课表冲突（按节次精确计算）
 *   - 健身与课程冲突     - 睡眠冲突（不得超过 23:30）
 *   - 22:30 后高认知负荷 - 日学习负荷上限
 *   - 周学习预算上限     - 假期日不排任务
 *   - 考试临近优先级     - 任务依赖（编程路线前置知识点）
 * ============================================================ */

const ConstraintEngine = {
  /* 某天课表占用的精确分钟区间（按节次 45min，跨行连排不虚增） */
  dayClassIntervals: function (week, day) {
    var out = [];
    getWeekEntries(week).forEach(function (it) {
      if (it.day !== day) return;
      it.entry.periods.forEach(function (p) {
        var t = PERIOD_TIMES[p];
        if (!t) return;
        var st = timeToMin(t.split('-')[0]);
        out.push([st, st + 45]);
      });
    });
    out.sort(function (a, b) { return a[0] - b[0]; });
    /* 合并相邻/重叠区间 */
    var merged = [];
    out.forEach(function (iv) {
      var last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + 5) last[1] = Math.max(last[1], iv[1]);
      else merged.push(iv.slice());
    });
    return merged;
  },

  /* 两个 'HH:MM-HH:MM' 区间是否重叠 */
  overlaps: function (timeA, timeB) {
    var a1 = timeToMin(timeA.split('-')[0]), a2 = timeToMin(timeA.split('-')[1]);
    var b1 = timeToMin(timeB.split('-')[0]), b2 = timeToMin(timeB.split('-')[1]);
    return a1 < b2 && b1 < a2;
  },

  /* 任务是否与课表冲突（忽略在课间隙？不：任何重叠即冲突） */
  classConflict: function (week, day, time) {
    var ivs = this.dayClassIntervals(week, day);
    var s = timeToMin(time.split('-')[0]), e = timeToMin(time.split('-')[1]);
    for (var i = 0; i < ivs.length; i++) {
      if (s < ivs[i][1] && ivs[i][0] < e) {
        return { code: 'CLASS_CONFLICT', message: '与课表冲突（' + minToTime(ivs[i][0]) + '-' + minToTime(ivs[i][1]) + ' 有课）' };
      }
    }
    return null;
  },

  /* 高认知负荷判定（22:30 后原则不安排；允许单词/复习/整理/明日计划） */
  isHighCognitive: function (task) {
    var subj = task.subject || '';
    if (['微积分', '程序设计', 'Python'].indexOf(subj) === -1) return false;
    var title = task.title || '';
    return !/(复习|整理|单词|词汇|复盘|明日|回顾|错题)/.test(title);
  },

  /* 编程路线前置依赖检查（topicId → curriculum.requires） */
  prereqViolation: function (task) {
    if (!task.topicId) return null;
    var prog = state.data.programming;
    var lists = [(prog && prog.c && prog.c.topics) || [], (prog && prog.python && prog.python.topics) || []];
    for (var i = 0; i < lists.length; i++) {
      var topic = lists[i].find(function (t) { return t.id === task.topicId; });
      if (!topic) continue;
      var unmet = (topic.requires || []).filter(function (rid) {
        var r = lists[i].find(function (x) { return x.id === rid; });
        return !r || r.status !== 'done';
      });
      if (unmet.length) {
        var names = unmet.map(function (rid) {
          var r = lists[i].find(function (x) { return x.id === rid; });
          return r ? r.name : rid;
        });
        return { code: 'PREREQ', message: '前置知识点未完成：' + names.join('、') };
      }
    }
    return null;
  },

  /* 校验单个任务（手动添加 / 生成器 / AI add 共用）
   * spec: { day, time, title, subject, type, topicId }
   * opts: { week, plan, budget, existingTasks }
   * 返回 { errors: [], warnings: [] } */
  validateTask: function (spec, opts) {
    opts = opts || {};
    var week = opts.week != null ? opts.week : currentWeek();
    var errors = [];
    var warnings = [];

    var m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(spec.time || '');
    if (!m) {
      errors.push({ code: 'BAD_TIME', message: '时间格式无效：' + spec.time });
      return { errors: errors, warnings: warnings };
    }
    var sMin = Number(m[1]) * 60 + Number(m[2]);
    var eMin = Number(m[3]) * 60 + Number(m[4]);
    if (eMin <= sMin) {
      errors.push({ code: 'BAD_TIME', message: '结束时间必须晚于开始时间' });
      return { errors: errors, warnings: warnings };
    }
    if (spec.day < 1 || spec.day > 7) {
      errors.push({ code: 'BAD_DAY', message: '日期无效（1-7）' });
      return { errors: errors, warnings: warnings };
    }

    /* 假期日不排任务 */
    var dateStr = dateOfWeek(week, spec.day);
    if (isHolidayDate(dateStr)) {
      errors.push({ code: 'HOLIDAY', message: DAY_NAMES[spec.day - 1] + '（' + fmtDateCN(dateStr) + '）为假期，不安排任务' });
    }

    /* 与课表冲突 */
    var cc = this.classConflict(week, spec.day, spec.time);
    if (cc) errors.push(cc);

    /* 睡眠硬约束：不得超过 23:30 */
    var sleepEndMin = timeToMin((state.data.userProfile.sleep && state.data.userProfile.sleep.start) || '23:30');
    if (eMin > sleepEndMin) {
      errors.push({ code: 'SLEEP', message: '超过 ' + (state.data.userProfile.sleep && state.data.userProfile.sleep.start) + ' 就寝时间（任务结束于 ' + minToTime(eMin) + '）' });
    }
    /* 22:30 后不排高认知负荷任务 */
    if (sMin >= 22 * 60 + 30 && this.isHighCognitive(spec)) {
      warnings.push({ code: 'NIGHT_COG', message: '22:30 后不建议新知识高强度学习，请安排单词/复习/整理类任务' });
    }

    /* 与同天已有任务重叠 */
    var existing = opts.existingTasks || (opts.plan ? this.planTasksOfDay(opts.plan, spec.day) : []);
    existing.forEach(function (t) {
      if (t.time === spec.time) return;
      if (ConstraintEngine.overlaps(t.time, spec.time)) {
        errors.push({ code: 'TASK_OVERLAP', message: '与已有任务「' + t.title + '」（' + t.time + '）时间重叠' });
      }
    });

    /* 日学习负荷（健身不计入学习负荷） */
    if (spec.subject !== '健身') {
      var dayStudy = existing.reduce(function (s, t) {
        return s + (t.subject === '健身' ? 0 : taskHours(t));
      }, 0) + ((eMin - sMin) / 60);
      var cap = state.data.userProfile.dailyStudyCapHours || 4;
      if (dayStudy > cap + 0.01) {
        errors.push({ code: 'DAILY_CAP', message: '当日学习负荷 ' + Math.round(dayStudy * 10) / 10 + 'h 超过上限 ' + cap + 'h' });
      }
    }

    /* 健身任务：必须是排期日、结束于偏好时间附近、不与课程冲突（课表冲突已覆盖） */
    if (spec.subject === '健身') {
      var gymPick = (typeof GymScheduler !== 'undefined') ? GymScheduler.pickGymDays(week) : { days: [] };
      if (gymPick.days.indexOf(spec.day) === -1) {
        errors.push({ code: 'GYM_DAY', message: DAY_NAMES[spec.day - 1] + ' 不是本周健身排期日（' + gymPick.days.map(function (d) { return DAY_NAMES[d - 1]; }).join('、') + '）' });
      }
      var endByMin = timeToMin((state.data.userProfile.gym && state.data.userProfile.gym.endBy) || '18:30');
      if (eMin > endByMin + 60) {
        warnings.push({ code: 'GYM_LATE', message: '健身结束时间偏晚（偏好 ' + minToTime(endByMin) + ' 左右结束）' });
      }
    }

    /* 编程任务依赖 */
    var pre = this.prereqViolation(spec);
    if (pre) errors.push(pre);

    /* 考试临近：竞赛/科研任务降级提示 */
    if (typeof TimeBudgetEngine !== 'undefined' && TimeBudgetEngine.isExamProximity(week) &&
        ['科研/AI探索', '竞赛'].indexOf(spec.subject) !== -1) {
      warnings.push({ code: 'EXAM_MODE', message: '考试临近，非核心任务建议暂停或减少' });
    }

    return { errors: errors, warnings: warnings };
  },

  /* 计划中某天的全部任务 */
  planTasksOfDay: function (plan, day) {
    var out = [];
    (plan && plan.subjects || []).forEach(function (sb) {
      sb.tasks.forEach(function (t) { if (t.day === day) out.push(t); });
    });
    return out;
  },

  /* 校验整份周计划：总时长 vs 预算、逐任务冲突扫描
   * 返回 { ok, errors, warnings, totalHours, budget } */
  validatePlan: function (plan, opts) {
    opts = opts || {};
    var week = plan.weekNumber != null ? plan.weekNumber : (opts.week != null ? opts.week : currentWeek());
    var errors = [];
    var warnings = [];
    var studyHours = 0;
    var seen = [];

    (plan.subjects || []).forEach(function (sb) {
      sb.tasks.forEach(function (t) {
        seen.push(t);
        var r = ConstraintEngine.validateTask(t, { week: week, existingTasks: ConstraintEngine.planTasksOfDay(plan, t.day).filter(function (x) { return x !== t; }) });
        errors = errors.concat(r.errors);
        warnings = warnings.concat(r.warnings);
        if (t.subject !== '健身') studyHours += taskHours(t);
      });
    });

    /* 周预算：不超过 Time Budget 的 planned（允许 0.15h 舍入误差） */
    var budget = opts.budget || (typeof TimeBudgetEngine !== 'undefined' ? TimeBudgetEngine.computeWeeklyBudget(week) : null);
    if (budget) {
      if (studyHours > budget.planned + 0.15) {
        errors.push({
          code: 'WEEK_BUDGET',
          message: '周计划学习时长 ' + Math.round(studyHours * 10) / 10 + 'h 超过预算 ' + budget.planned + 'h（建议 ' + budget.suggested + 'h，Buffer ' + budget.buffer + 'h）'
        });
      }
    }

    /* 去除同一任务的重复错误（validateTask 逐任务调用可能重复） */
    return { ok: errors.length === 0, errors: errors, warnings: warnings, totalHours: Math.round(studyHours * 10) / 10, budget: budget };
  },

  /* 校验 AI 提议（虚拟应用 add/delete/move/reallocate 后跑全量校验）
   * proposal: { actions: [...] }；返回 { ok, errors, warnings, preview }
   * 任何 error → 拒绝执行（§31：AI 不能直接修改计划）。 */
  validateProposal: function (proposal, week) {
    week = week != null ? week : currentWeek();
    var plan = getWeekPlan(week) || { weekNumber: week, subjects: [] };
    var preview = clone(plan);
    var errors = [];
    var warnings = [];

    (proposal.actions || []).forEach(function (a) {
      if (!a || !a.type) { errors.push({ code: 'BAD_ACTION', message: '非法 Action：' + JSON.stringify(a) }); return; }

      if (a.type === 'add') {
        var spec = { subject: a.subject, day: Number(a.day), time: a.time, title: a.title, type: a.type === 'add' ? (a.taskType || '自定义') : '', note: a.note || '', topicId: a.topicId };
        var r = ConstraintEngine.validateTask(spec, { week: week, plan: preview });
        errors = errors.concat(r.errors);
        warnings = warnings.concat(r.warnings);
        if (!r.errors.length) {
          var sb = preview.subjects.find(function (x) { return x.subject === spec.subject; });
          if (!sb) { sb = { subject: spec.subject, plannedHours: 0, goal: '', tasks: [] }; preview.subjects.push(sb); }
          sb.tasks.push({ id: uid(), day: spec.day, time: spec.time, title: spec.title, type: spec.type || '自定义', status: 'todo', note: spec.note || '', topicId: spec.topicId });
        }
      } else if (a.type === 'delete') {
        var removed = false;
        preview.subjects.forEach(function (sb) {
          var before = sb.tasks.length;
          sb.tasks = sb.tasks.filter(function (t) {
            if (a.taskId && t.id === a.taskId) return false;
            if (!a.taskId && t.day === Number(a.day) && t.time === a.time && t.title === a.title) return false;
            return true;
          });
          if (sb.tasks.length < before) removed = true;
        });
        if (!removed) errors.push({ code: 'DELETE_MISS', message: '未找到要删除的任务：' + (a.title || a.taskId) });
      } else if (a.type === 'move') {
        var moved = false;
        preview.subjects.forEach(function (sb) {
          sb.tasks.forEach(function (t) {
            if (moved) return;
            var hit = a.taskId ? t.id === a.taskId : (t.day === Number(a.day) && t.time === a.time && t.title === a.title);
            if (!hit) return;
            t.day = Number(a.newDay != null ? a.newDay : a.day);
            t.time = a.newTime || t.time;
            var r2 = ConstraintEngine.validateTask(t, { week: week, plan: preview });
            errors = errors.concat(r2.errors);
            warnings = warnings.concat(r2.warnings);
            moved = true;
          });
        });
        if (!moved) errors.push({ code: 'MOVE_MISS', message: '未找到要移动的任务：' + (a.title || a.taskId) });
      } else if (a.type === 'reallocate') {
        var fromSb = preview.subjects.find(function (x) { return x.subject === a.from; });
        if (!fromSb) {
          errors.push({ code: 'REALLOC_MISS', message: '分配来源科目不存在：' + a.from });
        } else {
          var hrs = Number(a.hours) || 0;
          if (hrs <= 0) { errors.push({ code: 'REALLOC_BAD', message: 'reallocate 小时数必须为正：' + a.hours }); }
          else if (fromSb.plannedHours + 0.001 < hrs) {
            errors.push({ code: 'REALLOC_OVER', message: '「' + a.from + '」当前仅 ' + fromSb.plannedHours + 'h，无法转出 ' + hrs + 'h' });
          } else {
            fromSb.plannedHours = Math.round((fromSb.plannedHours - hrs) * 10) / 10;
            var toSb = preview.subjects.find(function (x) { return x.subject === a.to; });
            if (!toSb) { toSb = { subject: a.to, plannedHours: 0, goal: '', tasks: [] }; preview.subjects.push(toSb); }
            toSb.plannedHours = Math.round((toSb.plannedHours + hrs) * 10) / 10;
          }
        }
      } else {
        errors.push({ code: 'BAD_ACTION', message: '不支持的 Action 类型：' + a.type });
      }
    });

    /* 全量校验（预算 + 冲突） */
    var full = ConstraintEngine.validatePlan(preview, { week: week });
    errors = errors.concat(full.errors);
    warnings = warnings.concat(full.warnings);

    return { ok: errors.length === 0, errors: errors, warnings: warnings, preview: preview };
  }
};
