/* ============================================================
 * core/strategyEngine.js —— 周战略引擎（v3 核心）
 * 决定"有限时间应该如何分配"（§29）。
 * 两条来源：
 *   1) 默认策略（无 AI）：§51/§52 默认优先级 + GPA 风险 + 考试临近调整
 *   2) AI 策略（Strategy AI 输出，经 aiSchema 严格校验）
 * 输出统一结构：
 *   { week, source, summary, mainPriorities, risks, researchFocus,
 *     competitionFocus, budget, allocation[{subject,hours,reason,category,priority}],
 *     warnings, examMode, gpaStatus }
 * 原则：所有时间分配必须来自有限 Time Budget；不无限增加任务。
 * ============================================================ */

const StrategyEngine = {
  /* 基础分配表（§52 初始建议；每科 reason 说明为何分配） */
  baseAllocation: function () {
    return [
      { subject: '微积分',      hours: 5.5, category: 'core',     priority: 100, reason: 'GPA主线，4学分，期末占比高' },
      { subject: '程序设计',    hours: 3.5, category: 'core',     priority: 90,  reason: 'GPA主线 + 编程地基（当前 for/while 阶段）' },
      { subject: '英语/四级',   hours: 2.5, category: 'english',  priority: 60,  reason: '维持词汇/听力，四级目标 550+' },
      { subject: 'Python',      hours: 1,   category: 'tech',     priority: 55,  reason: '副线：为科研/数据处理打地基，不挤占 C 主线' },
      { subject: '科研/AI探索', hours: 1.5, category: 'research', priority: 50,  reason: '探索 AI/机器人方向兴趣，记录试错，不重押' },
      { subject: '中国近现代史', hours: 1.5, category: 'core',     priority: 45,  reason: '3学分，框架记忆，考前冲刺' },
      { subject: '专业英语',    hours: 0.5, category: 'english',  priority: 40,  reason: '跟课进度，积累 AI 专业词汇' },
      { subject: '大学语文',    hours: 0.5, category: 'core',     priority: 35,  reason: '2学分，平时跟课，考前2周集中' },
      { subject: '综合',        hours: 0.5, category: 'meta',     priority: 30,  reason: '周日收尾复习' },
      { subject: '复盘',        hours: 0.5, category: 'meta',     priority: 20,  reason: '每日/每周复盘，数据驱动调整' }
    ];
  },

  /* 等比例缩放分配表到目标总时长（0.5h 步长，末尾兜底找平） */
  scaleAllocation: function (alloc, targetHours) {
    var total = alloc.reduce(function (s, a) { return s + a.hours; }, 0);
    if (total <= 0 || targetHours <= 0) return alloc;
    var scale = targetHours / total;
    var out = alloc.map(function (a) {
      return Object.assign({}, a, { hours: Math.max(0.5, Math.round(a.hours * scale * 2) / 2) });
    });
    /* 找平舍入误差：从优先级最高的科目上微调 */
    var sum = out.reduce(function (s, a) { return s + a.hours; }, 0);
    var diff = Math.round((targetHours - sum) * 2) / 2;
    if (diff !== 0) {
      out.sort(function (a, b) { return b.priority - a.priority; });
      var first = out[0];
      first.hours = Math.max(0.5, Math.round((first.hours + diff) * 2) / 2);
    }
    return out;
  },

  /* 考试模式：none / approaching（≤14天）/ urgent（≤7天） */
  examMode: function (week) {
    var s = state.data.semester;
    if ((s.examWeeksHint || []).indexOf(week) !== -1) return 'urgent';
    var weekEnd = dateOfWeek(week, 7);
    var minDays = null;
    state.data.courses.forEach(function (c) {
      if (!c.examDate || (c.credits || 0) < 2) return;
      var d = diffDays(weekEnd, c.examDate);   // 距周末还有几天（diffDays(a,b) = a−b）
      if (d >= 0 && (minDays == null || d < minDays)) minDays = d;
    });
    if (minDays == null) return 'none';
    return minDays <= 7 ? 'urgent' : (minDays <= 14 ? 'approaching' : 'none');
  },

  /* 默认周战略（无 AI / 首轮生成） */
  getDefaultWeeklyStrategy: function (week, opts) {
    opts = opts || {};
    var budget = opts.budget || TimeBudgetEngine.computeWeeklyBudget(week);
    var risk = (typeof GpaRiskEngine !== 'undefined') ? GpaRiskEngine.assessWeek(week) : { status: 'green', courses: [] };
    var mode = this.examMode(week);
    var special = specialWeekInfo(week);
    var warnings = [];
    var risks = [];

    var alloc = this.baseAllocation();

    /* 军训等特殊周：仅保留英语碎片 + 复盘，不套用正常预算 */
    if (special && special.noClasses) {
      alloc = [
        { subject: '英语/四级', hours: 1, category: 'english', priority: 60, reason: special.label + '期间保持单词+听力习惯' },
        { subject: '复盘', hours: 0.5, category: 'meta', priority: 20, reason: '每日简短复盘' }
      ];
      return {
        week: week, source: 'default',
        summary: special.label + '期间：保持英语单词+听力习惯，量力而行',
        mainPriorities: ['英语/四级'], risks: risks, researchFocus: '', competitionFocus: '',
        budget: budget, allocation: alloc, warnings: warnings, examMode: mode, gpaStatus: risk.status
      };
    }

    /* GPA 保护模式（§8）：RED → 科研 Maintenance、竞赛暂停 */
    var adj = GpaRiskEngine.protectionAdjustments(risk.status);
    if (risk.status !== 'green') {
      risks.push(adj.note);
      warnings.push(adj.note);
      alloc = alloc.map(function (a) {
        var h = a.hours;
        if (a.category === 'research') h = Math.round(h * adj.researchScale * 2) / 2;
        if (a.category === 'external') h = Math.round(h * adj.externalScale * 2) / 2;
        return Object.assign({}, a, { hours: h });
      });
      /* YELLOW/RED：给风险课程加时（最多 +1h，优先从科研/综合里扣） */
      var atRisk = risk.courses.filter(function (c) { return c.risk !== 'green'; });
      if (atRisk.length) {
        var riskSubj = { 'calc': '微积分', 'cprogramming': '程序设计', 'english': '英语/四级', 'history': '中国近现代史' };
        atRisk.forEach(function (rc) {
          var subj = riskSubj[rc.id];
          if (!subj) return;
          var a = alloc.find(function (x) { return x.subject === subj; });
          if (a) { a.hours = Math.round((a.hours + 0.5) * 2) / 2; a.reason += '；课程风险（' + rc.risk + '）追加复习'; }
        });
      }
    }

    /* 考试模式（§53）：逐步提高核心课程权重、削减科研探索 */
    if (mode !== 'none') {
      var scale = mode === 'urgent' ? 0.25 : 0.5;
      risks.push(mode === 'urgent' ? '大考 ≤7 天：竞赛/科研/外部课程明显减少，核心课程优先' : '考试 ≤14 天：逐步提高核心课程权重');
      alloc = alloc.map(function (a) {
        var h = a.hours;
        if (a.category === 'research') h = Math.round(h * scale * 2) / 2;
        if (a.category === 'tech' && mode === 'urgent') h = Math.round(h * 0.5 * 2) / 2;
        if (a.category === 'core') h = Math.round(h * 1.15 * 2) / 2;
        return Object.assign({}, a, { hours: h });
      });
    }

    /* 缩放到 Time Budget 的 planned（§9：分配不能超过预算） */
    alloc = this.scaleAllocation(alloc, budget.planned);

    var summary = 'GPA主线（微积分/程序设计）+ C语言推进 + Python副线 + 科研探索，全部控制在 ' + budget.planned + 'h 预算内';
    if (risk.status === 'red') summary = 'GPA Protection Mode：核心课程优先，科研仅维持最低接触（' + budget.planned + 'h 预算）';
    else if (risk.status === 'yellow') summary = '核心课程风险提示：适当向复习倾斜（' + budget.planned + 'h 预算）';

    return {
      week: week, source: 'default',
      summary: summary,
      mainPriorities: alloc.filter(function (a) { return a.category === 'core'; }).sort(function (x, y) { return y.hours - x.hours; }).slice(0, 3).map(function (a) { return a.subject; }),
      risks: risks,
      researchFocus: '当前阶段：编程地基（' + (state.data.research && state.data.research.stage ? state.data.research.stage : 'programming-foundation') + '），探索记录为主',
      competitionFocus: '竞赛优先级低：仅保留低成本技术训练型比赛',
      budget: budget,
      allocation: alloc,
      warnings: warnings,
      examMode: mode,
      gpaStatus: risk.status
    };
  },

  /* ---------------- AI 输出解析与 Schema 校验（§44，P9 使用） ---------------- */

  /* 校验单个 action */
  validateAction: function (a) {
    if (!a || typeof a !== 'object') return 'action 不是对象';
    if (['add', 'delete', 'move', 'reallocate'].indexOf(a.type) === -1) return '不支持的 action 类型：' + a.type;
    if (a.type === 'add') {
      if (!a.subject || !a.day || !a.time || !a.title) return 'add 缺少 subject/day/time/title';
      if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(a.time)) return 'add 时间格式无效：' + a.time;
    } else if (a.type === 'delete') {
      if (!a.day || !a.time || (!a.title && !a.taskId)) return 'delete 缺少定位字段（day/time/title 或 taskId）';
    } else if (a.type === 'move') {
      if (!a.title && !a.taskId) return 'move 缺少定位字段';
      if (a.newTime && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(a.newTime)) return 'move 新时间格式无效';
    } else if (a.type === 'reallocate') {
      if (!a.from || !a.to || !(Number(a.hours) > 0)) return 'reallocate 需要 from/to/hours(>0)';
    }
    return null;
  },

  /* 解析 AI 回复中的策略 JSON（严格校验，非法 → {ok:false, errors}） */
  parseAiStrategy: function (content) {
    var text = String(content || '');
    var m = /```json\s*([\s\S]*?)```/i.exec(text);
    var jsonStr = m ? m[1] : null;
    if (!jsonStr) {
      var s = text.indexOf('{');
      var e = text.lastIndexOf('}');
      if (s === -1 || e === -1 || e <= s) return { ok: false, errors: ['未找到 JSON 内容'] };
      jsonStr = text.slice(s, e + 1);
    }
    var obj;
    try { obj = JSON.parse(jsonStr); } catch (err) { return { ok: false, errors: ['JSON 解析失败：' + err.message] }; }
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['JSON 根不是对象'] };

    var errors = [];
    var ws = obj.weekly_strategy;
    if (!ws || typeof ws !== 'object') { errors.push('缺少 weekly_strategy'); ws = {}; }
    if (!ws.summary || typeof ws.summary !== 'string') errors.push('weekly_strategy.summary 缺失');
    if (!Array.isArray(ws.main_priorities)) errors.push('weekly_strategy.main_priorities 必须是数组');
    if (!Array.isArray(ws.risks)) errors.push('weekly_strategy.risks 必须是数组');

    var tb = obj.time_budget;
    if (tb && typeof tb === 'object') {
      if (!(Number(tb.available_hours) >= 0)) errors.push('time_budget.available_hours 无效');
      if (!(Number(tb.planned_hours) >= 0)) errors.push('time_budget.planned_hours 无效');
      if (!(Number(tb.buffer_hours) >= 0)) errors.push('time_budget.buffer_hours 无效');
    } else {
      errors.push('缺少 time_budget');
    }

    var alloc = [];
    if (!Array.isArray(obj.allocation)) {
      errors.push('allocation 必须是数组');
    } else {
      obj.allocation.forEach(function (a, i) {
        if (!a || typeof a !== 'object' || !a.subject || !(Number(a.hours) > 0)) {
          errors.push('allocation[' + i + '] 无效（需要 subject 与 hours>0）');
        } else {
          alloc.push({ subject: String(a.subject), hours: Number(a.hours), reason: String(a.reason || '') });
        }
      });
    }

    var actions = [];
    if (!Array.isArray(obj.actions)) {
      errors.push('actions 必须是数组');
    } else {
      obj.actions.forEach(function (a, i) {
        var err = StrategyEngine.validateAction(a);
        if (err) errors.push('actions[' + i + ']：' + err);
        else actions.push(a);
      });
    }

    /* 时间预算一致性：planned + buffer ≤ available（允许小误差），allocation 总和 ≤ planned */
    if (tb && typeof tb === 'object') {
      var avail = Number(tb.available_hours), planned = Number(tb.planned_hours), buffer = Number(tb.buffer_hours);
      if (planned + buffer > avail + 0.5) {
        errors.push('time_budget 矛盾：planned(' + planned + ')+buffer(' + buffer + ') 超过 available(' + avail + ')');
      }
      var allocSum = alloc.reduce(function (s, x) { return s + x.hours; }, 0);
      if (allocSum > planned + 0.5) {
        errors.push('allocation 总和 ' + allocSum + 'h 超过 planned ' + planned + 'h');
      }
    }

    if (errors.length) return { ok: false, errors: errors };

    return {
      ok: true,
      strategy: {
        source: 'ai',
        summary: ws.summary,
        mainPriorities: ws.main_priorities || [],
        risks: ws.risks || [],
        researchFocus: String(ws.research_focus || ''),
        competitionFocus: String(ws.competition_focus || ''),
        timeBudget: tb ? {
          availableHours: Number(tb.available_hours),
          plannedHours: Number(tb.planned_hours),
          bufferHours: Number(tb.buffer_hours)
        } : null,
        allocation: alloc,
        actions: actions,
        warnings: Array.isArray(obj.warnings) ? obj.warnings : []
      }
    };
  },

  /* ---------------- 上下文序列化（AI Prompt 用，§29/§43） ---------------- */

  serializeContext: function (week) {
    var d = state.data;
    var wk = week != null ? week : currentWeek();
    var parts = [];

    /* 用户与目标 */
    var p = d.userProfile;
    parts.push('用户：' + p.name + '，' + p.school + ' ' + p.major + '，' + p.grade + '，2026 年入学，2030 年毕业。');
    parts.push('长期目标：2030 获得推免资格 → 中上985，方向 AI/Robotics/具身智能。研究兴趣>竞赛兴趣。');
    var ov = GoalEngine.overview(wk);
    parts.push('当前阶段：' + ov.stage.label + '（' + ov.stage.phase + '），阶段目标：' + (ov.stage.goals || []).join('、') + '。');

    /* 睡眠与健身 */
    parts.push('睡眠硬约束：' + p.sleep.start + ' 睡 / ' + p.sleep.end + ' 起；22:30 后不排高认知任务。健身：每周' +
      (p.gym.daysPerWeek || [2, 3]).join('-') + '次，' + p.gym.endBy + ' 左右结束。');

    /* 课程与成绩 */
    d.courses.forEach(function (c) {
      var bd = c.gradeBreakdown ? ('期末' + Math.round((c.gradeBreakdown.final || 0) * 100) + '%') : '构成未知';
      parts.push('课程「' + c.name + '」：' + c.credits + '学分，优先级' + c.priority + '，目标' + c.targetScore +
        '分，' + bd + '，当前成绩：' + (c.currentScore != null ? c.currentScore : '未知') +
        (c.examDate ? '，考试 ' + c.examDate : ''));
    });

    /* 执行数据（近4周） */
    var lines = [];
    for (var i = 0; i < 4; i++) {
      var w = wk - i;
      if (w < 1) continue;
      var actual = TimeBudgetEngine.actualHoursOfWeek(w);
      var plan = getWeekPlan(w);
      var done = 0, total = 0;
      if (plan) {
        plan.subjects.forEach(function (sb) {
          sb.tasks.forEach(function (t) { total++; if (t.status === 'done') done++; });
        });
      }
      lines.push('第' + w + '周：实际' + actual + 'h，任务完成 ' + done + '/' + total);
    }
    parts.push('近4周执行数据：\n' + lines.join('\n'));

    /* 编程 / 科研 / 英语 / 竞赛进度 */
    var prog = d.programming;
    var cTopics = (prog && prog.c && prog.c.topics) || [];
    var doneC = cTopics.filter(function (t) { return t.status === 'done'; }).map(function (t) { return t.name; });
    var curC = cTopics.filter(function (t) { return t.status === 'inProgress'; }).map(function (t) { return t.name; });
    var pyTopics = (prog && prog.python && prog.python.topics) || [];
    var donePy = pyTopics.filter(function (t) { return t.status === 'done'; }).map(function (t) { return t.name; });
    parts.push('C语言：已完成「' + doneC.join('、') + '」，当前「' + (curC.join('、') || '—') + '」。Python：已完成「' + (donePy.join('、') || '无') + '」（副线）。');
    parts.push('科研阶段：' + (d.research && d.research.stage) + '；实验室接触：未联系（先提升基础）。');
    parts.push('英语：四级目标 ' + p.englishTarget + '+，每日单词/听力打卡中。竞赛：低优先级。');

    /* 预算 */
    var budget = TimeBudgetEngine.computeWeeklyBudget(wk);
    parts.push('第' + wk + '周时间预算：理论可用 ' + budget.theoretical + 'h，历史实际 ' + budget.historicalAvg +
      'h，近期执行率 ' + Math.round(budget.recentRate * 100) + '%，建议计划 ' + budget.suggested +
      'h（planned ' + budget.planned + 'h + Buffer ' + budget.buffer + 'h）。' +
      '健身排期：' + budget.gymDays.map(function (x) { return DAY_NAMES[x - 1]; }).join('、') + '。' +
      (budget.examProximity ? '【考试临近，注意提高核心课程权重】' : ''));

    var text = parts.join('\n');
    if (text.length > 3000) text = text.slice(0, 3000) + '（其余省略）';
    return text;
  }
};
