/* ============================================================
 * ui/courses.js —— 课程页（v3，§39）
 * 结构：GPA 模拟器 → 课表 → 每门课程卡
 * 课程卡（§39）：当前成绩/风险/考试日期（可维护）、成绩构成、
 *   策略、学校资料、推荐外部课程（资源库联动）、练习入口（编程训练）、
 *   错题统计、AI 建议。
 * GPA 风险数据（currentScore/risk）是 GpaRiskEngine 与策略调整的输入。
 * ============================================================ */

/* 学分加权绩点（与 v2 看板一致的算法） */
function calcGpa(courses, scores) {
  var totalCredits = 0, weighted = 0;
  courses.forEach(function (c) {
    if (!c.credits || c.credits <= 0) return;
    var s = scores[c.id];
    if (s == null) return;
    totalCredits += c.credits;
    weighted += gpaForScore(s) * c.credits;
  });
  return totalCredits ? Math.round(weighted / totalCredits * 100) / 100 : 0;
}

function renderCourses() {
  var root = document.getElementById('view-courses');
  root.innerHTML = '';

  root.appendChild(renderGpaSimulatorCard());

  /* 课表容器必须先挂入 DOM 再调 renderSchedule（其内部 getElementById('view-schedule')） */
  var schedWrap = renderScheduleWrapper();
  root.appendChild(schedWrap);
  renderSchedule();

  state.data.courses.forEach(function (c) {
    root.appendChild(renderCourseCard(c));
  });
}

/* ---------------- GPA 模拟器 ---------------- */

function renderGpaSimulatorCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, 'GPA 模拟器'));
  title.appendChild(el('span', 'card-sub', '拖动滑块维护每门课当前成绩 → 风险引擎自动预警'));
  card.appendChild(title);

  var courses = state.data.courses.filter(function (c) { return c.credits > 0; });
  var sim = state.data.gpaSimulation;
  var scores = {};
  courses.forEach(function (c) {
    scores[c.id] = sim && sim.scores && sim.scores[c.id] != null ? sim.scores[c.id] : (c.currentScore != null ? c.currentScore : (c.targetScore || 90));
  });

  var list = el('div', 'gpa-list');
  courses.forEach(function (c) {
    var row = el('div', 'gpa-row');
    row.appendChild(el('span', 'gpa-name', c.name + '（' + c.credits + '学分）'));
    var range = document.createElement('input');
    range.type = 'range';
    range.min = 0; range.max = 100;
    range.value = scores[c.id];
    range.addEventListener('input', function () {
      scores[c.id] = Number(range.value);
      updateGpaResult(card, courses, scores);
    });
    row.appendChild(range);
    var val = el('span', 'gpa-val', String(scores[c.id]));
    range.addEventListener('input', function () { val.textContent = String(range.value); });
    row.appendChild(val);
    list.appendChild(row);
  });
  card.appendChild(list);

  var result = el('div', 'gpa-result');
  updateGpaResult(card, courses, scores);
  card.appendChild(result);

  var saveBtn = el('button', 'btn btn-primary', '保存模拟成绩');
  saveBtn.addEventListener('click', function () {
    state.data.gpaSimulation = { scores: scores, gpa: calcGpa(courses, scores), savedAt: new Date().toISOString() };
    saveData();
    renderCourses();
  });
  card.appendChild(saveBtn);
  card.appendChild(el('div', 'hint', '注：这是"模拟"——真实成绩出来后在每门课程卡维护 currentScore，风险引擎会据此调整策略。'));
  return card;
}

function updateGpaResult(card, courses, scores) {
  var old = card.querySelector('.gpa-result');
  if (old) old.remove();
  var result = el('div', 'gpa-result');
  var gpa = calcGpa(courses, scores);
  result.appendChild(el('div', 'gpa-big', '预期绩点 ' + gpa.toFixed(2) + ' / 目标 ' + (state.data.userProfile.gpaTarget || 4.0)));

  var risky = courses.filter(function (c) { return scores[c.id] < 80; });
  if (risky.length) {
    result.appendChild(el('div', 'banner warn',
      '风险科目（<80）：' + risky.map(function (c) { return c.name + ' ' + scores[c.id]; }).join('、') +
      '。若期末占比高，请及时加复习时长（GPA 风险引擎会同步调整策略）。'));
  }
  /* what-if：每门课 +3 分收益最大者 */
  var best = null, bestGain = 0;
  courses.forEach(function (c) {
    var base = scores[c.id];
    scores[c.id] = Math.min(100, base + 3);
    var gain = calcGpa(courses, scores) - gpa;
    scores[c.id] = base;
    if (gain > bestGain) { bestGain = gain; best = c; }
  });
  if (best && bestGain > 0) {
    result.appendChild(el('div', 'hint', '提分最划算：' + best.name + '（+3 分可提升绩点约 ' + bestGain.toFixed(2) + '）'));
  }
  card.appendChild(result);
}

/* ---------------- 课表 ---------------- */

function renderScheduleWrapper() {
  var wrapper = el('div', 'card');
  wrapper.appendChild(el('div', 'card-title', '课表（按周次动态渲染）'));
  var inner = el('div');
  inner.id = 'view-schedule';
  wrapper.appendChild(inner);
  /* 注意：renderSchedule() 必须在 wrapper 挂入 DOM 后由 renderCourses 调用，
   * 否则 getElementById('view-schedule') 取不到节点（schedule.js 渲染进该容器） */
  return wrapper;
}

/* ---------------- 单课程卡（§39） ---------------- */

function renderCourseCard(c) {
  var card = el('div', 'card course-card');
  var title = el('div', 'card-title');
  var dot = el('span', 'subject-dot');
  dot.style.background = COURSE_COLORS[c.id] || '#2D5F8A';
  title.appendChild(dot);
  title.appendChild(el('span', null, c.name));
  title.appendChild(el('span', 'card-sub',
    c.credits + '学分 · ' + c.examType + ' · 优先级' + c.priority + ' · 目标 ' + c.targetScore + ' 分'));
  card.appendChild(title);

  /* 可维护字段：当前成绩 / 风险 / 考试日期（GPA 风险引擎输入） */
  var editRow = el('div', 'field-row');
  editRow.appendChild(el('span', 'hint', '当前成绩'));
  var inpScore = document.createElement('input');
  inpScore.type = 'number';
  inpScore.min = 0; inpScore.max = 100;
  inpScore.style.width = '70px';
  inpScore.value = c.currentScore != null ? c.currentScore : '';
  inpScore.placeholder = '未录入';
  inpScore.addEventListener('change', function () {
    c.currentScore = inpScore.value === '' ? null : clamp(Number(inpScore.value), 0, 100);
    saveData();
    renderCourses();
  });
  editRow.appendChild(inpScore);

  editRow.appendChild(el('span', 'hint', '风险'));
  var selRisk = document.createElement('select');
  [['unknown', '未评估'], ['green', '稳定'], ['yellow', '风险'], ['red', '严重']].forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item[0]; opt.textContent = item[1];
    if ((c.risk || 'unknown') === item[0]) opt.selected = true;
    selRisk.appendChild(opt);
  });
  selRisk.addEventListener('change', function () {
    c.risk = selRisk.value;
    saveData();
    renderCourses();
  });
  editRow.appendChild(selRisk);

  editRow.appendChild(el('span', 'hint', '考试日期'));
  var inpExam = document.createElement('input');
  inpExam.type = 'date';
  inpExam.value = c.examDate || '';
  inpExam.addEventListener('change', function () {
    c.examDate = inpExam.value || null;
    saveData();
    renderCourses();
  });
  editRow.appendChild(inpExam);
  card.appendChild(editRow);

  /* 引擎评估的风险状态 */
  var engineRisk = GpaRiskEngine.assessCourse(c, currentWeek());
  if (engineRisk !== 'green') {
    card.appendChild(el('div', 'banner warn',
      '引擎评估：' + (engineRisk === 'red' ? '🔴 高风险（保护模式会压缩科研/竞赛）' : '🟡 有风险（建议增加本课复习）')));
  }

  /* 考核方式 */
  if (c.gradeBreakdown) {
    card.appendChild(el('div', 'hint', '成绩构成：期末 ' + Math.round(c.gradeBreakdown.final * 100) + '% · 期中 ' +
      Math.round((c.gradeBreakdown.midterm || 0) * 100) + '% · 平时 ' + Math.round((c.gradeBreakdown.usual || 0) * 100) + '%'));
  } else {
    card.appendChild(el('div', 'hint', '成绩构成：未知（可在设置中补充）'));
  }

  /* 策略与 AI 建议 */
  if (c.strategy) {
    card.appendChild(el('div', 'hint', '策略：' + c.strategy.summary));
    if (c.strategy.aiUsage) card.appendChild(el('div', 'hint', 'AI 用法：' + c.strategy.aiUsage));
  }

  /* 学校资料 + 推荐外部课程（资源库联动） */
  var courseCategoryMap = { 'calc': '数学', 'cprogramming': 'C', 'english': '英语', 'major-english': '英语' };
  var cat = courseCategoryMap[c.id];
  if (cat) {
    var res = ResourceEngine.list(cat);
    if (res.length) {
      card.appendChild(el('div', 'hint', '推荐外部课程（资源库 · ' + cat + '）：'));
      res.forEach(function (r) {
        card.appendChild(el('div', 'hint', '· ' + r.name + '（' + r.recommend + '）—— ' + (r.whyNow || '')));
      });
    }
  }

  /* 练习入口（程序设计） + 错题 */
  if (c.id === 'cprogramming') {
    var btn = el('button', 'btn btn-sm', '去编程训练中心练习 →');
    btn.addEventListener('click', function () { switchTab('programming'); });
    card.appendChild(btn);
  }

  return card;
}
