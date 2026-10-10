/* ============================================================
 * core/competitivenessEngine.js —— 竞争力引擎（v3）
 * 六维竞争力：学业 / 科研 / 编程 / 英语 / 竞赛 / 执行稳定性。
 * 全部由【真实数据】计算 0-100 分 + 明细 + "当前最值得提升的三项"。
 * 原则（§7）：绝不输出伪造概率（如"保研概率87%"）——
 * 数据不足时如实说明，只给状态条与建议。
 * ============================================================ */

const CompetitivenessEngine = {
  /* 进度条分值 → 0-100 */
  _pct: function (done, total) {
    if (!total) return 0;
    return Math.round(clamp(done / total, 0, 1) * 100);
  },

  computeAcademic: function () {
    var items = [];
    var score = 0;
    var dataPoints = 0;

    /* GPA 模拟值（用户在看板/课程页维护） */
    var sim = state.data.gpaSimulation;
    if (sim && sim.gpa != null) {
      var target = state.data.userProfile.gpaTarget || 4.0;
      score += this._pct(sim.gpa, target);
      dataPoints++;
      items.push('GPA 模拟 ' + sim.gpa.toFixed(2) + ' / 目标 ' + target);
    } else {
      items.push('GPA 模拟未录入（可在课程页维护每门课当前成绩）');
    }

    /* 课程目标分达成率 */
    var courses = state.data.courses.filter(function (c) { return c.examType === '考试' && c.credits >= 2; });
    var cScore = 0, cTotal = 0;
    courses.forEach(function (c) {
      cTotal++;
      if (c.currentScore != null) {
        cScore += this._pct(c.currentScore, c.targetScore || 90);
        dataPoints++;
      }
    }, this);
    if (cTotal) {
      var cAvg = Math.round(cScore / cTotal);
      score = score + cAvg;
      items.push('核心课程当前成绩平均达成 ' + (cScore ? cAvg : 0) + '%（录入 ' + (cTotal ? Math.round(cScore ? cScore / Math.max(cTotal, 1) : 0) : 0) + '/' + cTotal + ' 门）');
    }

    /* 风险课程惩罚 */
    var risky = courses.filter(function (c) { return c.risk === 'red' || c.risk === 'yellow' || (c.currentScore != null && c.currentScore < 80); });
    if (risky.length) {
      score -= risky.length * 10;
      items.push('风险课程：' + risky.map(function (c) { return c.name; }).join('、'));
    }

    score = clamp(Math.round(score / Math.max(dataPoints, 1)), 0, 100);
    return { score: score, items: items };
  },

  computeResearch: function () {
    var items = [];
    var prog = state.data.programming;
    var cTopics = (prog && prog.c && prog.c.topics) || [];
    var cDone = cTopics.filter(function (t) { return t.status === 'done'; }).length;
    var pyTopics = (prog && prog.python && prog.python.topics) || [];
    var pyBase = pyTopics.filter(function (t) { return t.stage === 'base'; });
    var pyDone = pyBase.filter(function (t) { return t.status === 'done'; }).length;

    /* 大一科研地基 = 编程地基（阶段指标：编程能力 > 论文数量，§56） */
    var score = Math.round(this._pct(cDone, cTopics.length) * 0.6 + this._pct(pyDone, pyBase.length) * 0.2);

    var research = state.data.research;
    if (research) {
      var entries = research.entries || [];
      if (entries.length) {
        var add = Math.min(20, entries.length * 4);
        score += add;
        items.push('科研探索记录 ' + entries.length + ' 条');
      }
      var lab = (research.lab || []).find(function (l) { return l.id === 'lab-zhao'; }) || (research.lab || [])[0];
      if (lab) {
        if (lab.status === '已进入') { score += 25; items.push('已进入实验室'); }
        else if (lab.status === '已联系') { score += 12; items.push('已联系实验室（' + lab.name + '）'); }
        else { items.push('实验室：' + lab.status + '（先提升基础，再准备有内容的联系）'); }
      }
      var tried = (research.directions || []).filter(function (d) { return d.hours > 0; }).length;
      if (tried) items.push('已试错方向 ' + tried + ' 个');
    }
    score = clamp(score, 0, 100);
    return { score: score, items: items };
  },

  computeProgramming: function () {
    var items = [];
    var prog = state.data.programming;
    var cTopics = (prog && prog.c && prog.c.topics) || [];
    var pyBase = ((prog && prog.python && prog.python.topics) || []).filter(function (t) { return t.stage === 'base'; });
    var cDone = cTopics.filter(function (t) { return t.status === 'done'; });
    var cCur = cTopics.filter(function (t) { return t.status === 'inProgress'; });
    var pyDone = pyBase.filter(function (t) { return t.status === 'done'; });

    var subs = prog && prog.submissions ? prog.submissions : [];
    var correct = subs.filter(function (s) { return s.status === 'correct'; }).length;
    var solvedIds = {};
    subs.forEach(function (s) { if (s.status === 'correct') solvedIds[s.problemId] = true; });

    var score = Math.round(
      this._pct(cDone.length, cTopics.length) * 0.5 +
      this._pct(pyDone.length, pyBase.length) * 0.2 +
      Math.min(20, Object.keys(solvedIds).length * 2) +
      Math.min(10, Math.round((subs.length ? correct / subs.length : 0) * 10))
    );
    items.push('C：' + cDone.length + '/' + cTopics.length + ' 个知识点完成' + (cCur.length ? '（当前：' + cCur.map(function (t) { return t.name; }).join('、') + '）' : ''));
    items.push('Python（基础）：' + pyDone.length + '/' + pyBase.length);
    items.push('训练中心：通过 ' + Object.keys(solvedIds).length + ' 题，提交 ' + subs.length + ' 次' + (subs.length ? '（正确率 ' + Math.round(correct / subs.length * 100) + '%）' : ''));
    return { score: clamp(score, 0, 100), items: items };
  },

  computeEnglish: function () {
    var items = [];
    var logs = state.data.dailyLogs;
    var days = 0, vocabSum = 0, listenSum = 0;
    for (var i = 0; i < 14; i++) {
      var d = parseDate(todayStr());
      d.setDate(d.getDate() - i);
      var log = logs[fmtISODate(d)];
      if (!log || !log.checklist) continue;
      days++;
      vocabSum += Number(log.checklist.vocabCount || 0);
      listenSum += Number(log.checklist.listeningMinutes || 0);
    }
    var vocabAvg = days ? Math.round(vocabSum / days) : 0;
    var listenAvg = days ? Math.round(listenSum / days) : 0;
    var cet = state.data.semester.cet4Exam || {};
    var score = Math.round(this._pct(vocabAvg, 30) * 40 + this._pct(listenAvg, 15) * 30);
    if (cet.planned === true) { score += 15; items.push('已计划报考四级（' + (cet.expectedDate || '') + '）'); }
    else if (cet.notAllowed) { items.push('学校暂不允许大一上报考四级'); }
    else { items.push('四级报考待确认'); }
    items.push('近14天：日均单词 ' + vocabAvg + '/30 个，听力 ' + listenAvg + '/15 分钟');
    items.push('四级目标：' + (state.data.userProfile.englishTarget || 550) + '+');
    return { score: clamp(score, 0, 100), items: items };
  },

  computeCompetition: function () {
    var items = [];
    var list = state.data.competitions || [];
    var score = 0;
    list.forEach(function (c) {
      var vs = competitionValueScore(c);
      if (c.status === '参加' || c.status === '已结束') {
        score += Math.min(40, vs * 5);
        items.push(c.name + '（' + c.status + '，Value ' + vs + '）');
      } else if (c.status === '候选') {
        score += Math.min(15, vs * 2);
      }
    });
    if (!items.length) {
      items.push('当前无参加中的竞赛——大一阶段竞赛优先级低，符合默认策略（§51）');
    }
    return { score: clamp(score, 0, 100), items: items };
  },

  computeExecution: function () {
    var items = [];
    var wk = currentWeek();
    var rates = [];
    var totalTasks = 0, totalDone = 0;
    for (var i = 0; i < 4; i++) {
      var w = wk - i;
      if (w < 1) continue;
      var plan = getWeekPlan(w);
      var done = 0, total = 0;
      if (plan) {
        plan.subjects.forEach(function (sb) {
          sb.tasks.forEach(function (t) {
            total++;
            if (t.status === 'done') done++;
          });
        });
      }
      if (total) { rates.push(done / total); totalDone += done; totalTasks += total; }
    }
    var avgRate = rates.length ? rates.reduce(function (a, b) { return a + b; }, 0) / rates.length : null;

    /* 连续执行天数（近14天有 done 记录的天数占比） */
    var activeDays = 0;
    for (var d = 0; d < 14; d++) {
      var dd = parseDate(todayStr());
      dd.setDate(dd.getDate() - d);
      var log = state.data.dailyLogs[fmtISODate(dd)];
      if (log && log.tasksStatus) {
        var anyDone = Object.keys(log.tasksStatus).some(function (id) { return log.tasksStatus[id].status === 'done'; });
        if (anyDone) activeDays++;
      }
    }
    var score = Math.round((avgRate != null ? avgRate : 0.6) * 70 + this._pct(activeDays, 14) * 30);
    items.push(avgRate != null
      ? '近4周平均完成率 ' + Math.round(avgRate * 100) + '%（' + totalDone + '/' + totalTasks + ' 任务）'
      : '执行数据不足：完成几天任务后自动统计');
    items.push('近14天有执行记录 ' + activeDays + ' 天');

    /* 连续低完成率 → 提示过载而非自律（§36） */
    if (rates.length >= 3 && avgRate < 0.6) {
      items.push('⚠ 连续多周完成率偏低：先检查计划是否过载（预算引擎会自动下调），不要归因于"不够自律"');
    }
    return { score: clamp(score, 0, 100), items: items };
  },

  /* 主入口：六维 + Top3 提升建议 */
  compute: function () {
    var dims = {
      academic: this.computeAcademic(),
      research: this.computeResearch(),
      programming: this.computeProgramming(),
      english: this.computeEnglish(),
      competition: this.computeCompetition(),
      execution: this.computeExecution()
    };

    /* 按分数从低到高取三项（排除"无需提升"的高分项），给出针对性建议 */
    var advice = {
      academic: '学业是底盘：在课程页录入每门课当前成绩与风险，系统才能自动预警（GPA Protection Mode）',
      research: '科研当前是"探索"不是"产出"：每周 1-1.5h 记录方向试错；编程地基（C→Python）优先于论文数量',
      programming: '编程是当前最高杠杆：继续 C 主线（for/while → 数组 → 函数），Python 副线每周 1h',
      english: '英语维持即可：每日单词+听力打卡，写作/阅读考前专项',
      competition: '竞赛优先级低（符合当前策略）：大一保持低成本技术训练，大二确定方向后精选 1-2 项',
      execution: '先检查计划是否过载：完成率长期偏低时，系统应下调预算而不是要求"更努力"'
    };
    var labels = {
      academic: '学业', research: '科研', programming: '编程', english: '英语', competition: '竞赛', execution: '执行稳定性'
    };
    var order = Object.keys(dims).sort(function (a, b) { return dims[a].score - dims[b].score; });
    var top = order.filter(function (k) { return dims[k].score < 80; }).slice(0, 3).map(function (k) {
      return { key: k, label: labels[k], score: dims[k].score, advice: advice[k] };
    });

    /* 数据充分度：有多少维度基于真实数据（如实告知，不编造） */
    return {
      dimensions: dims,
      labels: labels,
      topImprovements: top,
      note: '以上为状态条，不是概率预测：数据越完整，状态越接近真实。推免政策会变化，当前数据不足以输出任何"保研概率"。'
    };
  }
};
