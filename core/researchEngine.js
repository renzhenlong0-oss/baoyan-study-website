/* ============================================================
 * core/researchEngine.js —— 科研探索引擎（v3，§25-§27）
 * 原则：
 *   - 大一上目标不是发论文，而是成为"实验室愿意培养的人"
 *     （编程地基 + 有内容的接触准备）。
 *   - 科研指标随阶段变化（§56）：编程地基期不出现"每周10篇论文"。
 *   - 科研允许试错（§26）：记录方向/投入/兴趣/难度/是否继续，
 *     不强迫现在决定方向。
 *   - 赵凤军老师实验室是【潜在科研训练入口】，不是"最终导师"。
 * ============================================================ */

const ResearchEngine = {
  /* 当前科研阶段信息 */
  stageInfo: function () {
    var id = (state.data.research && state.data.research.stage) || 'programming-foundation';
    var stage = RESEARCH_STAGES.find(function (s) { return s.id === id; }) || RESEARCH_STAGES[0];
    return { id: id, stage: stage, index: RESEARCH_STAGES.indexOf(stage) };
  },

  /* 技术路线图当前位置（按编程进度：第一个未 done 的节点） */
  roadmapPosition: function () {
    var prog = state.data.programming;
    var cTopics = (prog && prog.c && prog.c.topics) || [];
    var pyTopics = (prog && prog.python && prog.python.topics) || [];
    var techDone = {
      'c': cTopics.every(function (t) { return t.status === 'done'; }),
      'python': pyTopics.filter(function (t) { return t.stage === 'base'; }).every(function (t) { return t.status === 'done'; })
    };
    var current = null, doneCount = 0;
    for (var i = 0; i < TECH_ROADMAP.length; i++) {
      var node = TECH_ROADMAP[i];
      if (techDone[node.id]) { doneCount = i + 1; continue; }
      current = node;
      break;
    }
    if (!current) { doneCount = TECH_ROADMAP.length; current = TECH_ROADMAP[TECH_ROADMAP.length - 1]; }
    return {
      nodes: TECH_ROADMAP,
      current: current,
      doneCount: doneCount,
      total: TECH_ROADMAP.length,
      note: '这是路线图，不是当前任务列表：只展示当前位置，不产生每周任务。'
    };
  },

  /* 科研探索记录 */
  addEntry: function (type, title, hours, note) {
    if (RESEARCH_TASK_TYPES.indexOf(type) === -1) return { ok: false, error: '非法研究任务类型：' + type };
    var entry = { id: uid(), ts: new Date().toISOString(), type: type, title: title, hours: Number(hours) || 0, note: note || '' };
    state.data.research.entries.push(entry);
    /* 该方向投入时长累计（title 命中方向名时累计到 directions） */
    (state.data.research.directions || []).forEach(function (dir) {
      if (title.indexOf(dir.name) !== -1) dir.hours = (dir.hours || 0) + (Number(hours) || 0);
    });
    saveData();
    return { ok: true, entry: entry };
  },

  /* 方向试错更新 */
  updateDirection: function (id, patch) {
    var dir = (state.data.research.directions || []).find(function (d) { return d.id === id; });
    if (!dir) return false;
    for (var k in patch) dir[k] = patch[k];
    saveData();
    return true;
  },

  /* 实验室联系人状态 */
  labContacts: function () {
    return (state.data.research && state.data.research.lab) || [];
  },

  updateLab: function (id, patch) {
    var lab = this.labContacts().find(function (l) { return l.id === id; });
    if (!lab) return false;
    for (var k in patch) lab[k] = patch[k];
    saveData();
    return true;
  },

  /* 当前阶段允许的研究任务类型（编程地基期仅方向探索等） */
  allowedTaskTypes: function () {
    var info = this.stageInfo();
    return info.stage.tasks || [];
  },

  /* 本周科研投入（近14天科研探索记录小时数） */
  recentHours: function () {
    var sum = 0;
    (state.data.research.entries || []).forEach(function (e) {
      var d = diffDays(todayStr(), (e.ts || '').slice(0, 10));
      if (d >= 0 && d <= 14) sum += Number(e.hours || 0);
    });
    return Math.round(sum * 10) / 10;
  }
};
