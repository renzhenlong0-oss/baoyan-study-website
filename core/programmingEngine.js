/* ============================================================
 * core/programmingEngine.js —— 编程训练中心引擎（v3）
 * 流程（§20）：知识点 → 讲解(题目描述) → 示例 → 练习 → 提交 → 结果 → 错误类型 → AI分析
 * 关键规则：
 *   - 进度【由提交记录动态计算】，不是手填：
 *     知识点 mastery = 该知识点累计 2 次正确提交 → done；
 *     locked 知识点在全部前置 done 后自动解锁（inProgress）。
 *   - 推荐算法（§21）：当前知识点优先 → 错题复做 → 难度递增。
 *   - 错误模式检测（§22）：同一错误类型连续 ≥3 次 → 专项训练推荐。
 *   - 提示梯子（§23）：提示 → 思路 → 局部代码 → 完整答案，不直接给答案。
 * ============================================================ */

const ProgrammingEngine = {
  TOPIC_MASTERY_COUNT: 2,        // 知识点解锁为 done 所需正确提交数
  ERROR_PATTERN_THRESHOLD: 3,    // 连续同类型错误触发专项训练

  /* 题目查找 */
  getProblem: function (problemId) {
    return PROBLEMS.find(function (p) { return p.id === problemId; }) || null;
  },

  /* 某语言知识点列表 / 单知识点 */
  getTopics: function (language) {
    var prog = state.data.programming;
    var key = language === 'Python' ? 'python' : 'c';
    return (prog && prog[key] && prog[key].topics) || [];
  },

  getTopic: function (language, topicId) {
    return this.getTopics(language).find(function (t) { return t.id === topicId; }) || null;
  },

  /* 某知识点已正确通过的题数 */
  correctCountOfTopic: function (topicId) {
    var subs = (state.data.programming && state.data.programming.submissions) || [];
    var solved = {};
    subs.forEach(function (s) {
      if (s.status === 'correct') solved[s.problemId] = true;
    });
    return Object.keys(solved).filter(function (pid) {
      var p = ProgrammingEngine.getProblem(pid);
      return p && p.topic === topicId;
    }).length;
  },

  /* 前置检查 + 自动解锁 + mastery 升级（提交后调用） */
  refreshTopicStatus: function (language) {
    var topics = this.getTopics(language);
    topics.forEach(function (t) {
      if (t.status === 'locked') {
        var allDone = (t.requires || []).every(function (rid) {
          var r = topics.find(function (x) { return x.id === rid; });
          return r && r.status === 'done';
        });
        if (allDone) t.status = 'inProgress';
      } else if (t.status === 'inProgress') {
        if (ProgrammingEngine.correctCountOfTopic(t.id) >= ProgrammingEngine.TOPIC_MASTERY_COUNT) {
          t.status = 'done';
        }
      }
    });
  },

  /* 提交结果记录（self-report：在本地编译器/洛谷写完代码后回填结果） */
  submit: function (problemId, status, errorType) {
    var p = this.getProblem(problemId);
    if (!p) return { ok: false, error: '题目不存在：' + problemId };
    if (['correct', 'wrong', 'timeout', 'unfinished'].indexOf(status) === -1) {
      return { ok: false, error: '非法状态：' + status };
    }
    var prog = state.data.programming;
    prog.submissions = prog.submissions || [];
    var rec = {
      id: uid(),
      problemId: problemId,
      ts: new Date().toISOString(),
      status: status,
      errorType: status === 'wrong' ? (errorType || '语法') : null,
      attempts: 1
    };
    prog.submissions.push(rec);

    /* 错题本：wrong/timeout/unfinished 进入（correct 后移除） */
    prog.wrongBook = prog.wrongBook || [];
    if (status === 'correct') {
      prog.wrongBook = prog.wrongBook.filter(function (w) { return w.problemId !== problemId; });
    } else {
      var exist = prog.wrongBook.find(function (w) { return w.problemId === problemId; });
      if (!exist) prog.wrongBook.push({ problemId: problemId, ts: rec.ts, resolved: false });
    }

    this.refreshTopicStatus(p.language === 'Python' ? 'Python' : 'C');
    saveData();
    return { ok: true, record: rec };
  },

  /* 错误模式检测：最近连续同类型错误 ≥3 → 专项训练 */
  detectErrorPatterns: function () {
    var subs = ((state.data.programming && state.data.programming.submissions) || []).slice();
    var streak = 0, lastType = null;
    for (var i = subs.length - 1; i >= 0; i--) {
      var s = subs[i];
      if (s.status === 'wrong' && s.errorType) {
        if (lastType == null) lastType = s.errorType;
        if (s.errorType === lastType) streak++;
        else break;
      } else {
        break;
      }
    }
    if (streak >= this.ERROR_PATTERN_THRESHOLD) {
      return { errorType: lastType, streak: streak, suggestion: lastType + '类错误连续 ' + streak + ' 次，建议先做' + lastType + '专项训练再继续推进' };
    }
    return null;
  },

  /* 推荐下一题（§21：当前知识点 → 错题复做 → 难度递增 → 专项训练优先） */
  recommendProblem: function (language) {
    var pattern = this.detectErrorPatterns();
    var topics = this.getTopics(language);
    var langKey = language === 'Python' ? 'Python' : 'C';

    /* 专项训练：按错误类型匹配 tag 的题（当前阶段范围内；tag 含类型关键字即命中，如"循环边界"⊃"边界"） */
    if (pattern) {
      var special = PROBLEMS.filter(function (p) {
        return p.language === langKey &&
          (p.tags || []).some(function (tag) { return tag.indexOf(pattern.errorType) !== -1; }) &&
          topics.some(function (t) { return t.id === p.topic && t.status !== 'locked'; });
      });
      if (special.length) {
        return { problem: special[0], reason: pattern.suggestion, special: true };
      }
    }

    /* 错题复做优先 */
    var wrong = (state.data.programming && state.data.programming.wrongBook) || [];
    if (wrong.length) {
      var wp = wrong.map(function (w) { return ProgrammingEngine.getProblem(w.problemId); })
        .filter(Boolean).sort(function (a, b) { return a.difficulty.length - b.difficulty.length; });
      if (wp.length) return { problem: wp[0], reason: '错题复做：巩固未掌握的知识点', wrongRetry: true };
    }

    /* 当前知识点：第一个 inProgress */
    var cur = topics.find(function (t) { return t.status === 'inProgress'; });
    if (!cur) {
      /* 全部 done 或全部 locked：找第一个已解锁（前置 done）的 locked 或直接返回空 */
      cur = topics.find(function (t) { return t.status === 'locked'; }) || null;
    }
    if (!cur) return { problem: null, reason: 'C 语言路线全部完成！可进入 Python 或算法训练' };

    var candidates = PROBLEMS.filter(function (p) { return p.language === langKey && p.topic === cur.id; });
    var solved = {};
    ((state.data.programming && state.data.programming.submissions) || []).forEach(function (s) {
      if (s.status === 'correct') solved[s.problemId] = true;
    });
    var fresh = candidates.filter(function (p) { return !solved[p.id]; })
      .sort(function (a, b) { return a.difficulty.length - b.difficulty.length; });
    if (fresh.length) {
      return { problem: fresh[0], reason: '当前知识点「' + cur.name + '」，按难度递增推荐', special: false };
    }
    /* 该知识点题已刷完 → 下一个知识点 */
    var idx = topics.indexOf(cur);
    if (idx < topics.length - 1) {
      return { problem: null, reason: '「' + cur.name + '」的题目已全部通过！继续学习下一个知识点「' + topics[idx + 1].name + '」' };
    }
    return { problem: null, reason: '当前阶段题目已全部通过' };
  },

  /* 提示梯子（§23）：level 1 提示 → 2 思路 → 3 局部代码 → 4 完整答案 */
  getHintLadder: function (problem) {
    return [
      { level: 1, label: '提示', content: problem.hint || '' },
      { level: 2, label: '思路', content: problem.thought || '' },
      { level: 3, label: '局部代码', content: problem.partialCode || '', code: true },
      { level: 4, label: '完整答案', content: problem.solution || '', code: true, last: true }
    ];
  },

  /* 统计（训练中心头部） */
  stats: function () {
    var subs = (state.data.programming && state.data.programming.submissions) || [];
    var solved = {};
    subs.forEach(function (s) { if (s.status === 'correct') solved[s.problemId] = true; });
    var correct = subs.filter(function (s) { return s.status === 'correct'; }).length;
    var wrongBook = (state.data.programming && state.data.programming.wrongBook) || [];
    return {
      submissions: subs.length,
      solved: Object.keys(solved).length,
      correctRate: subs.length ? Math.round(correct / subs.length * 100) : 0,
      wrongBookCount: wrongBook.length
    };
  }
};
