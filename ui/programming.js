/* ============================================================
 * ui/programming.js —— 编程训练中心（v3，§20-§23）
 * 结构：路线进度（C/Python）→ 推荐练习（题目+提交）→ 错误分析 → 错题本
 * 提交为 self-report：在本机编译器/洛谷写完代码后回填结果，
 * 系统记录正确率与错误类型，动态更新知识点进度与推荐。
 * 提示梯子：答错后逐层解锁 提示 → 思路 → 局部代码 → 完整答案。
 * ============================================================ */

let progLanguage = 'C';
let progCurrentProblem = null;
let progHintLevel = 0;       // 已解锁的提示层级（0=未解锁）
let progResultDirty = false;

function renderProgramming() {
  var root = document.getElementById('view-programming');
  root.innerHTML = '';

  root.appendChild(renderProgrammingRoadmapCard());
  root.appendChild(renderRecommendCard());
  root.appendChild(renderProblemPickerCard());
  root.appendChild(renderErrorAnalysisCard());
  root.appendChild(renderWrongBookCard());
}

/* ---------------- 路线进度 ---------------- */

function renderProgrammingRoadmapCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '编程路线'));
  title.appendChild(el('span', 'card-sub', '进度由提交记录自动更新：知识点累计 2 次正确提交 = 完成'));
  card.appendChild(title);

  var langs = [
    { key: 'C', name: 'C 语言（主线：学校课程 + 编程地基）', data: ProgrammingEngine.getTopics('C') },
    { key: 'Python', name: 'Python（副线：科研/数据处理，当前仅开放基础阶段）', data: ProgrammingEngine.getTopics('Python') }
  ];
  langs.forEach(function (lang) {
    var block = el('div', 'topic-lang');
    block.appendChild(el('div', 'hint', lang.name));
    var chips = el('div', 'topic-chips');
    lang.data.forEach(function (t) {
      var chip = el('div', 'topic-chip ' + t.status);
      var label = t.status === 'done' ? '✓ ' : (t.status === 'inProgress' ? '● ' : '🔒 ');
      chip.appendChild(el('span', null, label + t.name));
      chip.title = t.status === 'locked' ? '前置未完成：' + (t.requires || []).join('、') : '';
      chips.appendChild(chip);
    });
    block.appendChild(chips);
    card.appendChild(block);
  });
  return card;
}

/* ---------------- 推荐练习 + 题目 + 提交 ---------------- */

function renderRecommendCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '推荐练习'));
  var stats = ProgrammingEngine.stats();
  title.appendChild(el('span', 'card-sub',
    '已通过 ' + stats.solved + ' 题 · 提交 ' + stats.submissions + ' 次 · 正确率 ' + stats.correctRate + '%'));
  card.appendChild(title);

  var langRow = el('div', 'field-row');
  var sel = document.createElement('select');
  ['C', 'Python'].forEach(function (l) {
    var opt = document.createElement('option');
    opt.value = l; opt.textContent = l === 'C' ? 'C 语言' : 'Python';
    if (progLanguage === l) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function () {
    progLanguage = sel.value;
    progCurrentProblem = null;
    progHintLevel = 0;
    renderRecommendCard();
  });
  langRow.appendChild(sel);
  card.appendChild(langRow);

  var rec = ProgrammingEngine.recommendProblem(progLanguage);

  /* 用户手动选择的训练项目优先于系统推荐（选择后一直生效，直到做完或点"恢复推荐"） */
  var selected = progCurrentProblem;
  if (!selected && rec.problem) progCurrentProblem = rec.problem;
  var problem = progCurrentProblem || null;

  if (problem) {
    if (selected) {
      card.appendChild(el('div', 'hint', '当前训练项目（自选）：'));
      var backBtn = el('button', 'btn btn-sm', '恢复系统推荐');
      backBtn.addEventListener('click', function () {
        progCurrentProblem = null;
        progHintLevel = 0;
        renderProgramming();
      });
      card.appendChild(backBtn);
    } else {
      if (rec.reason) card.appendChild(el('div', 'hint', '推荐理由：' + rec.reason));
      if (rec.special) card.appendChild(el('div', 'banner warn', '⚠ 专项训练模式：' + rec.reason));
    }
    card.appendChild(renderProblemBody(problem));
  } else {
    progCurrentProblem = null;
    card.appendChild(el('div', 'empty-state', rec.reason || '暂无推荐题目'));
  }
  return card;
}

/* ---------------- 训练项目选择（题库浏览器） ---------------- */

function renderProblemPickerCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '训练项目选择'));
  title.appendChild(el('span', 'card-sub', '按知识点浏览题库，点选任意题目开始训练'));
  card.appendChild(title);

  var langKey = progLanguage === 'Python' ? 'Python' : 'C';
  var topics = ProgrammingEngine.getTopics(progLanguage);

  /* 已通过 / 待复做状态 */
  var solved = {};
  var wrongSet = {};
  ((state.data.programming && state.data.programming.submissions) || []).forEach(function (s) {
    if (s.status === 'correct') solved[s.problemId] = true;
  });
  ((state.data.programming && state.data.programming.wrongBook) || []).forEach(function (w) {
    wrongSet[w.problemId] = true;
  });

  var any = false;
  topics.forEach(function (t) {
    var list = PROBLEMS.filter(function (p) { return p.language === langKey && p.topic === t.id; });
    if (!list.length) return;
    any = true;
    var head = el('div', 'hint',
      t.name + '（' + (t.status === 'done' ? '✓ 已掌握' : (t.status === 'inProgress' ? '● 进行中' : '🔒 未解锁')) + '）' +
      (t.status === 'locked' ? ' —— 前置未完成，暂不可选' : ''));
    card.appendChild(head);

    list.forEach(function (p) {
      var row = el('div', 'task-row problem-pick' +
        (progCurrentProblem && progCurrentProblem.id === p.id ? ' selected' : '') +
        (t.status === 'locked' ? ' locked' : ''));
      var st;
      if (solved[p.id]) st = el('span', 'st st-done', '已通过');
      else if (wrongSet[p.id]) st = el('span', 'st st-skip', '待复做');
      else st = el('span', 'st st-todo', '未做');
      row.appendChild(st);
      row.appendChild(el('span', 'task-title', p.difficulty + ' ' + p.title));
      row.appendChild(el('span', 'hint', (p.tags || []).join(' / ')));
      if (t.status !== 'locked') {
        row.style.cursor = 'pointer';
        row.title = '点击选择此题开始训练';
        row.addEventListener('click', function () {
          progCurrentProblem = p;
          progHintLevel = 0;
          renderProgramming();
        });
      }
      card.appendChild(row);
    });
  });
  if (!any) card.appendChild(el('div', 'hint', '该语言暂无题目。'));
  return card;
}

/* 题目卡片：描述/输入/输出/示例/标签 + 提交区 + 提示梯子 */
function renderProblemBody(p) {
  var wrap = el('div', 'problem-body');

  var head = el('div', 'problem-head');
  head.appendChild(el('span', 'problem-title', p.title));
  var diff = el('span', 'problem-diff', p.difficulty);
  head.appendChild(diff);
  (p.tags || []).forEach(function (tag) {
    head.appendChild(el('span', 'problem-tag', tag));
  });
  wrap.appendChild(head);

  wrap.appendChild(el('div', 'problem-desc', p.description));
  wrap.appendChild(el('div', 'problem-io', '输入：' + p.input));
  wrap.appendChild(el('div', 'problem-io', '输出：' + p.output));
  if (p.examples && p.examples.length) {
    var ex = el('div', 'problem-examples');
    ex.appendChild(el('div', 'hint', '示例：'));
    p.examples.forEach(function (e) {
      var box = el('pre', 'problem-example',
        '输入：' + e.input + '\n输出：' + e.output + (e.explain ? '\n说明：' + e.explain : ''));
      ex.appendChild(box);
    });
    wrap.appendChild(ex);
  }
  wrap.appendChild(el('div', 'hint', '来源：' + (p.source || '内置') + '。先在本地编译器/洛谷完成本题，再回填结果。'));

  /* 提交区（self-report） */
  var submitRow = el('div', 'field-row submit-row');
  var selStatus = document.createElement('select');
  [['correct', '✅ 正确'], ['wrong', '❌ 错误'], ['timeout', '⏱ 超时'], ['unfinished', '📝 未完成']].forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item[0]; opt.textContent = item[1];
    selStatus.appendChild(opt);
  });
  submitRow.appendChild(selStatus);

  var selErr = document.createElement('select');
  selErr.style.display = 'none';
  ERROR_TYPES.forEach(function (et) {
    var opt = document.createElement('option');
    opt.value = et; opt.textContent = '错误类型：' + et;
    selErr.appendChild(opt);
  });
  selStatus.addEventListener('change', function () {
    selErr.style.display = selStatus.value === 'wrong' ? '' : 'none';
  });
  submitRow.appendChild(selErr);

  var btn = el('button', 'btn btn-primary', '提交结果');
  btn.addEventListener('click', function () {
    var res = ProgrammingEngine.submit(p.id, selStatus.value,
      selStatus.value === 'wrong' ? selErr.value : null);
    if (!res.ok) { alert(res.error); return; }
    if (selStatus.value === 'correct') {
      progHintLevel = 0;
      progCurrentProblem = null;
    } else {
      /* 答错：解锁下一层提示（不直接给答案） */
      progHintLevel = Math.min(progHintLevel + 1, 4);
    }
    renderProgramming();
    updateStatusbar();
  });
  submitRow.appendChild(btn);
  wrap.appendChild(submitRow);

  /* 提示梯子（§23：答错后逐层解锁） */
  if (progHintLevel > 0) {
    var ladder = ProgrammingEngine.getHintLadder(p);
    var box = el('div', 'hint-ladder');
    ladder.forEach(function (h) {
      if (h.level > progHintLevel) return;
      var seg = el('div', 'hint-step' + (h.code ? ' code' : ''));
      seg.appendChild(el('div', 'hint-step-label', '第' + h.level + '层 · ' + h.label + (h.last ? '（到此为止，回去动手写）' : '')));
      if (h.code) {
        var pre = document.createElement('pre');
        pre.textContent = h.content;
        seg.appendChild(pre);
      } else {
        seg.appendChild(el('div', null, h.content));
      }
      box.appendChild(seg);
    });
    wrap.appendChild(box);
  }
  return wrap;
}

/* ---------------- 错误分析 ---------------- */

function renderErrorAnalysisCard() {
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '错误分析'));

  var pattern = ProgrammingEngine.detectErrorPatterns();
  if (pattern) {
    card.appendChild(el('div', 'banner warn', '⚠ ' + pattern.suggestion + '（已自动提高该类型题目推荐优先级）'));
  }

  var subs = ((state.data.programming && state.data.programming.submissions) || []).slice(-10).reverse();
  if (!subs.length) {
    card.appendChild(el('div', 'hint', '暂无提交记录。开始做题后，这里会统计错误类型与模式。'));
    return card;
  }
  var list = el('div', 'sub-list');
  subs.forEach(function (s) {
    var p = ProgrammingEngine.getProblem(s.problemId);
    var row = el('div', 'task-row');
    var statusTxt = { correct: '✅ 正确', wrong: '❌ 错误', timeout: '⏱ 超时', unfinished: '📝 未完成' }[s.status];
    row.appendChild(el('span', 'st ' + (s.status === 'correct' ? 'st-done' : 'st-skip'), statusTxt));
    row.appendChild(el('span', 'task-title', (p ? p.title : s.problemId) + '（' + (p ? p.difficulty : '') + '）'));
    if (s.errorType) row.appendChild(el('span', 'hint', '错误类型：' + s.errorType));
    row.appendChild(el('span', 'task-time', (s.ts || '').slice(5, 16).replace('T', ' ')));
    list.appendChild(row);
  });
  card.appendChild(list);
  return card;
}

/* ---------------- 错题本 ---------------- */

function renderWrongBookCard() {
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '错题本'));
  var wrongBook = (state.data.programming && state.data.programming.wrongBook) || [];
  if (!wrongBook.length) {
    card.appendChild(el('div', 'hint', '暂无错题。做错的题会自动进入错题本，通过后自动移除。'));
    return card;
  }
  wrongBook.slice().reverse().forEach(function (w) {
    var p = ProgrammingEngine.getProblem(w.problemId);
    if (!p) return;
    var row = el('div', 'task-row');
    row.appendChild(el('span', 'task-title', p.title + '（' + p.difficulty + ' · ' + (p.topic || '') + '）'));
    var btn = el('button', 'btn btn-sm btn-primary', '复做');
    btn.addEventListener('click', function () {
      progCurrentProblem = p;
      progHintLevel = 0;
      progLanguage = p.language;
      renderProgramming();
      /* 滚动到题目区 */
      var rec = document.getElementById('view-programming');
      if (rec) rec.scrollIntoView();
    });
    row.appendChild(btn);
    card.appendChild(row);
  });
  return card;
}
