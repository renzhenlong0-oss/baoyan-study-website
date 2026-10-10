/* ============================================================
 * ui/weeklyPlan.js —— 周计划页（v3，替代 v2 weekplan.js）
 * 结构：时间预算卡 → 本周战略卡 → 节日卡 → 科目/日历视图 → 课程概览
 * 原则：计划由 PlanGenerator（战略 + 预算 + 约束）生成；
 *       手动新增任务必须过 ConstraintEngine 校验。
 * ============================================================ */

let weekPlanViewMode = 'subject';   // 'subject' | 'calendar'

/* ---------------- 新增任务弹窗（课表自习格/今日页也会调用） ---------------- */

function openAddTaskModal(prefill) {
  prefill = prefill || {};
  var w = prefill.week != null ? prefill.week : state.viewWeek;
  var plan = getWeekPlan(w);
  if (!plan) {
    confirmModal('周计划未生成',
      '第' + w + '周计划还未生成，将按当前战略与时间预算生成。要现在生成吗？')
      .then(function (ok) {
        if (!ok) return;
        plan = ensureWeekPlan(w);
        openAddTaskModal(prefill);
      });
    return;
  }

  var body = el('div');

  var subjectOptions = [];
  plan.subjects.forEach(function (sb) {
    if (subjectOptions.indexOf(sb.subject) === -1) subjectOptions.push(sb.subject);
  });
  Object.keys(SUBJECT_META).forEach(function (s) {
    if (subjectOptions.indexOf(s) === -1) subjectOptions.push(s);
  });
  state.data.courses.forEach(function (c) {
    if (subjectOptions.indexOf(c.name) === -1) subjectOptions.push(c.name);
  });
  if (subjectOptions.indexOf('自定义') === -1) subjectOptions.push('自定义');

  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '科目'));
  var selSubject = document.createElement('select');
  subjectOptions.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    selSubject.appendChild(opt);
  });
  f1.appendChild(selSubject);
  body.appendChild(f1);

  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '日期（本周）'));
  var selDay = document.createElement('select');
  for (var d = 1; d <= 7; d++) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = DAY_NAMES[d - 1] + ' ' + dateOfWeek(w, d).slice(5).replace('-', '/') +
      (isHolidayDate(dateOfWeek(w, d)) ? '（假期）' : '');
    if (prefill.day === d) opt.selected = true;
    selDay.appendChild(opt);
  }
  f2.appendChild(selDay);
  body.appendChild(f2);

  var f3 = el('div', 'field-row');
  var fStart = el('div', 'field');
  fStart.appendChild(el('label', null, '开始时间'));
  var inpStart = document.createElement('input');
  inpStart.type = 'time';
  inpStart.value = prefill.time ? prefill.time.split('-')[0] : '19:00';
  fStart.appendChild(inpStart);
  f3.appendChild(fStart);

  var fEnd = el('div', 'field');
  fEnd.appendChild(el('label', null, '结束时间'));
  var inpEnd = document.createElement('input');
  inpEnd.type = 'time';
  inpEnd.value = prefill.time ? prefill.time.split('-')[1] : '21:00';
  fEnd.appendChild(inpEnd);
  f3.appendChild(fEnd);
  body.appendChild(f3);

  var f4 = el('div', 'field');
  f4.appendChild(el('label', null, '任务标题'));
  var inpTitle = document.createElement('input');
  inpTitle.type = 'text';
  inpTitle.placeholder = '如：微积分第3章作业';
  f4.appendChild(inpTitle);
  body.appendChild(f4);

  var f5 = el('div', 'field');
  f5.appendChild(el('label', null, '备注（可选）'));
  var inpNote = document.createElement('input');
  inpNote.type = 'text';
  f5.appendChild(inpNote);
  body.appendChild(f5);

  /* 约束校验提示区（提交时填充） */
  var errBox = el('div', 'banner danger');
  errBox.style.display = 'none';
  body.appendChild(errBox);

  openModal({
    title: '新增任务（第' + w + '周）',
    body: body,
    actions: [
      {
        label: '添加', cls: 'btn-primary',
        onClick: function () {
          if (!inpTitle.value.trim()) { alert('请填写任务标题'); return false; }
          if (!inpStart.value || !inpEnd.value || inpStart.value >= inpEnd.value) {
            alert('请填写有效的时间段'); return false;
          }
          var spec = {
            subject: selSubject.value,
            day: Number(selDay.value),
            time: inpStart.value + '-' + inpEnd.value,
            title: inpTitle.value.trim(),
            note: inpNote.value.trim()
          };
          /* 约束校验：冲突拒绝并展示原因（§32） */
          var check = ConstraintEngine.validateTask(spec, { week: w, plan: plan });
          if (check.errors.length) {
            errBox.style.display = '';
            errBox.innerHTML = '无法添加：<br>' +
              check.errors.map(function (e) { return '· ' + escapeHtml(e.message); }).join('<br>');
            return false;
          }
          if (check.warnings.length) {
            var okWarn = confirm(check.warnings.map(function (e) { return e.message; }).join('\n') + '\n\n仍要添加吗？');
            if (!okWarn) return false;
          }
          addTaskToPlan(w, spec);
          refreshCurrentView();
        }
      },
      { label: '取消', cls: '' }
    ]
  });
  setTimeout(function () { inpTitle.focus(); }, 50);
}

/* 直接添加任务（约束校验后调用；AI 提议路径走 ConstraintEngine.validateProposal） */
function addTaskToPlan(w, spec) {
  var plan = ensureWeekPlan(w);
  var sb = plan.subjects.find(function (x) { return x.subject === spec.subject; });
  if (!sb) {
    sb = { subject: spec.subject, plannedHours: 0, goal: '', tasks: [] };
    plan.subjects.push(sb);
  }
  sb.tasks.push({
    id: uid(),
    day: spec.day,
    time: spec.time,
    title: spec.title,
    type: spec.type || '自定义',
    status: 'todo',
    note: spec.note || '',
    topicId: spec.topicId
  });
  if (sb.plannedHours === 0) {
    var h = taskHours(sb.tasks[sb.tasks.length - 1]);
    sb.plannedHours = Math.round(h * 10) / 10;
  }
  plan.updatedAt = new Date().toISOString();
  saveData();
}

/* ---------------- 主渲染 ---------------- */

function renderWeekPlan() {
  var w = state.viewWeek;
  var root = document.getElementById('view-weekplan');
  root.innerHTML = '';

  var plan = getWeekPlan(w);
  if (!plan) {
    var empty = el('div', 'card empty-state');
    empty.appendChild(el('div', null, '第' + w + '周计划还未生成，将按【当前战略 + 时间预算 + 硬约束】自动生成'));
    var btn = el('button', 'btn btn-primary', '生成周计划');
    btn.addEventListener('click', function () {
      ensureWeekPlan(w);
      renderWeekPlan();
      updateStatusbar();
    });
    empty.appendChild(btn);
    root.appendChild(empty);
    return;
  }

  /* ---- 时间预算卡 ---- */
  root.appendChild(renderBudgetCard(w, plan));

  /* ---- 本周战略卡（含设计逻辑闭环） ---- */
  root.appendChild(renderStrategyCard(w, plan));

  /* ---- 工具栏 ---- */
  var toolbar = el('div', 'card weekplan-toolbar');
  var toggle = el('div', 'view-toggle');
  var bSub = el('button', weekPlanViewMode === 'subject' ? 'active' : '', '科目分块');
  bSub.addEventListener('click', function () { weekPlanViewMode = 'subject'; renderWeekPlan(); });
  var bCal = el('button', weekPlanViewMode === 'calendar' ? 'active' : '', '日历视图');
  bCal.addEventListener('click', function () { weekPlanViewMode = 'calendar'; renderWeekPlan(); });
  toggle.appendChild(bSub);
  toggle.appendChild(bCal);
  toolbar.appendChild(toggle);

  var bAdd = el('button', 'btn btn-primary', '新增任务');
  bAdd.addEventListener('click', function () { openAddTaskModal({ week: w }); });
  toolbar.appendChild(bAdd);

  var bRegen = el('button', 'btn', '按当前战略重新生成');
  bRegen.addEventListener('click', function () { regenerateWeekPlan(w); });
  toolbar.appendChild(bRegen);
  root.appendChild(toolbar);

  /* ---- 节日安排 ---- */
  var hc = renderHolidayCard(w);
  if (hc) root.appendChild(hc);

  /* ---- 内容 ---- */
  if (weekPlanViewMode === 'subject') {
    root.appendChild(renderSubjectView(w, plan));
  } else {
    root.appendChild(renderCalendarView(w, plan));
  }

  /* ---- 本周课程概览 ---- */
  root.appendChild(renderWeekCourseOverview(w));
}

/* 时间预算卡：理论可用/历史实际/执行率/建议/已计划/Buffer */
function renderBudgetCard(w, plan) {
  var budget = TimeBudgetEngine.computeWeeklyBudget(w);
  var plannedSum = 0;
  plan.subjects.forEach(function (sb) {
    if (sb.subject === '健身') return;
    plannedSum += Number(sb.plannedHours || 0);
  });
  plannedSum = Math.round(plannedSum * 10) / 10;

  var card = el('div', 'card budget-card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '第' + w + '周 · 时间预算'));
  title.appendChild(el('span', 'card-sub', '计划量由执行数据决定，不是固定 28 小时'));
  card.appendChild(title);

  var grid = el('div', 'budget-grid');
  var cells = [
    { label: '理论可用', value: budget.theoretical + 'h', hint: '清醒时间 − 上课/作业/吃饭/通勤/健身/固定活动' },
    { label: '历史实际', value: budget.historicalAvg + 'h', hint: '近4周实际完成均值（无数据锚定真实能力）' },
    { label: '近期执行率', value: Math.round(budget.recentRate * 100) + '%', hint: '近14天完成/跳过' },
    { label: '建议计划', value: budget.suggested + 'h', hint: 'min(理论, 历史) × 执行率调整' },
    { label: '本周已计划', value: plannedSum + 'h', hint: '分配表总和（≠任务时长和）' },
    { label: 'Buffer', value: budget.buffer + 'h', hint: '延期/临时作业/疲劳/突发' }
  ];
  cells.forEach(function (c) {
    var box = el('div', 'budget-cell');
    box.appendChild(el('div', 'budget-label', c.label));
    box.appendChild(el('div', 'budget-value', c.value));
    box.appendChild(el('div', 'hint', c.hint));
    grid.appendChild(box);
  });
  card.appendChild(grid);

  /* 预算使用进度条 */
  var usedPct = clamp(Math.round(plannedSum / Math.max(budget.planned, 0.1) * 100), 0, 100);
  var bar = el('div', 'progress-track');
  var fill = el('div', 'progress-fill' + (usedPct > 100 ? ' over' : ''));
  fill.style.width = Math.min(usedPct, 100) + '%';
  bar.appendChild(fill);
  card.appendChild(bar);
  card.appendChild(el('div', 'hint',
    '已计划 ' + plannedSum + 'h / 预算 ' + budget.planned + 'h' + (usedPct > 100 ? '（超预算！请减少任务或让 AI 重新分配）' : '')));
  return card;
}

/* 本周战略卡：summary + 优先项 + 风险 + 分配条 + 闭环说明 */
function renderStrategyCard(w, plan) {
  var strat = state.data.weeklyStrategy && state.data.weeklyStrategy.week === w
    ? state.data.weeklyStrategy
    : (plan.strategy || null);
  var card = el('div', 'card strategy-card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '本周战略'));
  if (strat) {
    var badgeTxt = '';
    if (strat.gpaStatus === 'red') badgeTxt = 'GPA Protection';
    else if (strat.gpaStatus === 'yellow') badgeTxt = 'GPA 风险提示';
    if (strat.examMode !== 'none' && strat.examMode) badgeTxt += (badgeTxt ? ' · ' : '') + '考试模式';
    if (badgeTxt) {
      var badge = el('span', 'st st-skip', badgeTxt);
      title.appendChild(badge);
    }
    title.appendChild(el('span', 'card-sub', '目标 → 策略 → 预算 → 计划 → 执行 → 数据 → 复盘 → 调整'));
  }
  card.appendChild(title);

  if (strat) {
    var focusRow = el('div', 'hint');
    focusRow.textContent = '本周重点：' + (strat.summary || plan.focus);
    var editFocus = el('button', 'btn btn-sm', '编辑重点');
    editFocus.addEventListener('click', function () {
      promptModal('编辑本周重点', '本周重点', { value: plan.focus }).then(function (v) {
        if (v == null) return;
        plan.focus = v;
        plan.updatedAt = new Date().toISOString();
        saveData();
        renderWeekPlan();
      });
    });
    focusRow.appendChild(editFocus);
    card.appendChild(focusRow);

    if (strat.mainPriorities && strat.mainPriorities.length) {
      card.appendChild(el('div', 'hint', '优先项：' + strat.mainPriorities.join(' ＞ ')));
    }
    (strat.risks || []).forEach(function (r) {
      card.appendChild(el('div', 'banner warn', r));
    });

    /* 分配条：每科 hours 与占比 */
    if (strat.allocation && strat.allocation.length) {
      var total = strat.allocation.reduce(function (s, a) { return s + a.hours; }, 0);
      var list = el('div', 'alloc-list');
      strat.allocation.slice().sort(function (a, b) { return b.hours - a.hours; }).forEach(function (a) {
        var row = el('div', 'alloc-row');
        row.appendChild(el('span', 'alloc-name', a.subject));
        var track = el('div', 'progress-track');
        var f = el('div', 'progress-fill');
        f.style.width = Math.round(a.hours / Math.max(total, 0.1) * 100) + '%';
        track.appendChild(f);
        row.appendChild(track);
        row.appendChild(el('span', 'alloc-hours', a.hours + 'h'));
        row.appendChild(el('div', 'hint', a.reason));
        list.appendChild(row);
      });
      card.appendChild(list);
    }

    if (strat.researchFocus) card.appendChild(el('div', 'hint', '科研：' + strat.researchFocus));
    if (strat.competitionFocus) card.appendChild(el('div', 'hint', '竞赛：' + strat.competitionFocus));
  }

  /* 设计逻辑闭环（替代 v2 logic.js 的静态说明） */
  var loop = el('div', 'logic-loop');
  loop.appendChild(el('div', 'hint',
    '闭环：2030保研目标 → 阶段目标 → 竞争力分析 → 策略 → 时间预算 → 硬约束检查 → 周计划 → 每日执行 → 数据 → 周复盘 → 偏差分析 → 调整分配 → 重新生成'));
  card.appendChild(loop);
  return card;
}

/* 节日安排卡片（与 v2 一致） */
function renderHolidayCard(w) {
  var hols = holidaysInWeek(w);
  var tasks = [];
  for (var d = 1; d <= 7; d++) {
    var ds = dateOfWeek(w, d);
    if (state.data.holidayTasks[ds]) tasks.push(state.data.holidayTasks[ds]);
  }
  if (!hols.length && !tasks.length) return null;

  var card = el('div', 'card holiday-card');
  card.appendChild(el('div', 'card-title', '节日安排'));

  hols.forEach(function (h) {
    card.appendChild(el('div', 'hint',
      h.name + '假期：' + fmtDateCN(h.start) + ' ~ ' + fmtDateCN(h.end) + '（假期不安排任务）'));
  });

  tasks.forEach(function (t) {
    var row = el('div', 'task-row');
    if (t.status === 'done') row.classList.add('done');

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (t.status === 'done');
    cb.title = '勾选 = 完成';
    cb.addEventListener('change', function () {
      setHolidayTaskStatus(t.date, cb.checked ? 'done' : 'todo');
      renderWeekPlan();
    });
    row.appendChild(cb);
    row.appendChild(el('span', 'task-time', fmtDateCN(t.date)));
    row.appendChild(el('span', 'task-title', t.title));
    row.appendChild(el('span', 'st ' + (t.status === 'done' ? 'st-done' : 'st-todo'),
      t.status === 'done' ? '已完成' : '待办'));

    var actions = el('div', 'task-actions');
    var bEdit = el('button', 'btn btn-sm', '编辑');
    bEdit.addEventListener('click', function () {
      promptModal('编辑节日总任务', '任务标题', { value: t.title }).then(function (v) {
        if (v == null) return;
        t.title = v;
        saveData();
        renderWeekPlan();
      });
    });
    actions.appendChild(bEdit);
    var bDel = el('button', 'btn btn-sm btn-danger', '删除');
    bDel.addEventListener('click', function () {
      confirmModal('删除节日任务', '确定删除「' + t.title + '」吗？', { danger: true, okLabel: '删除' })
        .then(function (ok) {
          if (!ok) return;
          deleteHolidayTask(t.date);
          renderWeekPlan();
        });
    });
    actions.appendChild(bDel);
    row.appendChild(actions);

    if (t.note) row.appendChild(el('div', 'task-note', t.note));
    card.appendChild(row);
  });
  return card;
}

/* 科目分块视图 */
function renderSubjectView(w, plan) {
  var card = el('div', 'card');
  if (!plan.subjects.length) {
    card.appendChild(el('div', 'empty-state', '本周暂无任务，点上方"新增任务"或"按当前战略重新生成"'));
    return card;
  }

  plan.subjects.forEach(function (sb) {
    var block = el('div', 'subject-block');
    var head = el('div', 'subject-head');

    var dot = el('span', 'subject-dot');
    dot.style.background = subjectColor(sb.subject);
    head.appendChild(dot);
    head.appendChild(el('span', 'subject-name', sb.subject));

    var hoursInput = document.createElement('input');
    hoursInput.type = 'number';
    hoursInput.className = 'subject-hours-input';
    hoursInput.step = '0.5';
    hoursInput.min = '0';
    hoursInput.value = sb.plannedHours;
    hoursInput.title = '计划学时（分配契约，可修改）';
    hoursInput.addEventListener('change', function () {
      sb.plannedHours = Math.max(0, Number(hoursInput.value) || 0);
      plan.updatedAt = new Date().toISOString();
      saveData();
      renderWeekPlan();
    });
    head.appendChild(hoursInput);
    head.appendChild(el('span', 'subject-hours', 'h / 周'));

    var goalText = el('span', 'hint', '目标：' + (sb.goal || '—'));
    head.appendChild(goalText);
    block.appendChild(head);

    sb.tasks.slice().sort(function (a, b) {
      return (a.day - b.day) || (timeToMin(a.time) - timeToMin(b.time));
    }).forEach(function (t) {
      block.appendChild(renderTaskRow(w, t, sb));
    });

    card.appendChild(block);
  });
  return card;
}

/* 日历视图：7列，每列一天 */
function renderCalendarView(w, plan) {
  var card = el('div', 'card');
  var grid = el('div', 'cal-grid');
  var isCurWeek = (w === currentWeek());
  var todayWd = weekdayOf(todayStr());

  for (var d = 1; d <= 7; d++) {
    var col = el('div', 'cal-day');
    if (isCurWeek && d === todayWd) col.classList.add('today-col');
    var head = el('div', 'cal-day-head', DAY_NAMES[d - 1] + ' ');
    head.appendChild(el('span', 'd-date', dateOfWeek(w, d).slice(5).replace('-', '/')));
    col.appendChild(head);

    var hol = holidayOfDate(dateOfWeek(w, d));
    if (hol) {
      col.classList.add('holiday-col');
      col.appendChild(el('div', 'hint', '假期 · ' + hol.name));
    }

    var dayTasks = [];
    plan.subjects.forEach(function (sb) {
      sb.tasks.forEach(function (t) { if (t.day === d) dayTasks.push({ t: t, sb: sb }); });
    });
    dayTasks.sort(function (a, b) { return timeToMin(a.t.time) - timeToMin(b.t.time); });
    if (!dayTasks.length) {
      col.appendChild(el('div', 'hint', '无任务'));
    }
    dayTasks.forEach(function (item) {
      var wrap = el('div', 'cal-task');
      wrap.style.setProperty('--cc', subjectColor(item.sb.subject));
      wrap.appendChild(el('div', 't-time', item.t.time));
      wrap.appendChild(el('div', null, item.t.title));
      col.appendChild(wrap);
    });
    grid.appendChild(col);
  }
  card.appendChild(grid);
  return card;
}

/* 任务行（勾选/跳过（原因分类）/备注/删除） */
function renderTaskRow(w, t, sb) {
  var row = el('div', 'task-row');
  if (t.status === 'done') row.classList.add('done');
  if (t.status === 'skipped') row.classList.add('skipped');

  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = (t.status === 'done');
  cb.title = '勾选 = 完成';
  cb.addEventListener('change', function () {
    setTaskStatus(w, t.id, cb.checked ? 'done' : 'todo');
    updateStatusbar();
    renderWeekPlan();
  });
  row.appendChild(cb);

  row.appendChild(el('span', 'task-time', t.time));
  row.appendChild(el('span', 'task-title', t.title));

  var tag = el('span', 'subject-tag', t.type === '碎片' ? '碎片' : (sb.subject.length > 6 ? sb.subject.slice(0, 6) : sb.subject));
  tag.style.background = subjectColor(sb.subject);
  row.appendChild(tag);

  var st;
  if (t.status === 'done') st = el('span', 'st st-done', '已完成');
  else if (t.status === 'skipped') st = el('span', 'st st-skip', '跳过');
  else st = el('span', 'st st-todo', '未开始');
  row.appendChild(st);

  var actions = el('div', 'task-actions');
  var bNote = el('button', 'btn btn-sm', '备注');
  bNote.addEventListener('click', function () {
    promptModal('任务备注', t.title, { value: t.note, multiline: true }).then(function (v) {
      if (v == null) return;
      setTaskStatus(w, t.id, t.status, v);
      renderWeekPlan();
    });
  });
  actions.appendChild(bNote);

  if (t.status !== 'done') {
    var bSkip = el('button', 'btn btn-sm', '跳过');
    bSkip.addEventListener('click', function () { openSkipModal(w, t); });
    actions.appendChild(bSkip);
  }

  var bDel = el('button', 'btn btn-sm btn-danger', '删除');
  bDel.addEventListener('click', function () {
    confirmModal('删除任务', '确定删除任务「' + t.title + '」吗？（不影响已保存的每日复盘记录）', { danger: true, okLabel: '删除' })
      .then(function (ok) {
        if (!ok) return;
        deleteTask(w, t.id);
        renderWeekPlan();
      });
  });
  actions.appendChild(bDel);
  row.appendChild(actions);

  if (t.note) {
    row.appendChild(el('div', 'task-note', '备注：' + t.note));
  }
  if (t.status === 'skipped' && t.skipCategory) {
    row.appendChild(el('div', 'task-note', '跳过原因：' + t.skipCategory));
  }
  return row;
}

/* 跳过弹窗：结构化原因分类（§35）+ 备注 */
function openSkipModal(w, t) {
  var body = el('div');
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '跳过原因（用于复盘归因）'));
  var sel = document.createElement('select');
  SKIP_REASON_OPTIONS.forEach(function (r) {
    var opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    if (t.skipCategory === r) opt.selected = true;
    sel.appendChild(opt);
  });
  f1.appendChild(sel);
  body.appendChild(f1);

  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '补充说明（可选）'));
  var ta = document.createElement('textarea');
  ta.rows = 2;
  ta.value = t.note || '';
  f2.appendChild(ta);
  body.appendChild(f2);

  openModal({
    title: '跳过任务：' + t.title,
    body: body,
    actions: [
      {
        label: '跳过', cls: 'btn-primary',
        onClick: function () {
          setTaskStatus(w, t.id, 'skipped', ta.value.trim() || sel.value, sel.value);
          updateStatusbar();
          refreshCurrentView();   // 周计划页与今日页共用
        }
      },
      { label: '取消', cls: '' }
    ]
  });
}

/* 按当前战略重新生成（保留已完成/跳过任务的勾选状态） */
function regenerateWeekPlan(w) {
  confirmModal('重新生成本周计划',
    '将按【当前战略 + 时间预算 + 硬约束】重新生成第' + w + '周计划，自定义修改会被覆盖；\n已完成/跳过任务的勾选状态按（星期|时段|标题）匹配保留。确定继续吗？',
    { danger: true, okLabel: '重新生成' })
    .then(function (ok) {
      if (!ok) return;
      var plan = PlanGenerator.regenerate(w);
      var note = plan.keptFromPrevious ? ('已保留 ' + plan.keptFromPrevious + ' 项勾选状态。') : '';
      alert('已重新生成。' + note);
      renderWeekPlan();
      updateStatusbar();
    });
}

/* 本周课程概览（只读） */
function renderWeekCourseOverview(w) {
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '本周课程概览'));

  var entries = getWeekEntries(w);
  var byDay = {};
  entries.forEach(function (it) {
    var key = it.day + '|' + it.course.id + '|' + it.row.time;
    (byDay[it.day] = byDay[it.day] || []).push({ key: key, it: it });
  });

  var list = el('div', 'course-overview');
  var hasAny = false;
  for (var d = 1; d <= 7; d++) {
    var items = byDay[d] || [];
    var seen = {};
    var uniq = items.filter(function (x) {
      if (seen[x.key]) return false;
      seen[x.key] = true;
      return true;
    }).sort(function (a, b) { return timeToMin(a.it.row.time) - timeToMin(b.it.row.time); });
    if (!uniq.length) continue;
    hasAny = true;
    var line = el('div');
    line.appendChild(el('span', 'co-day', DAY_NAMES[d - 1] + '：'));
    uniq.forEach(function (x) {
      line.appendChild(el('span', null,
        '　' + (COURSE_SHORT[x.it.course.id] || x.it.course.name) +
        (x.it.entry.label ? '(' + x.it.entry.label + ')' : '') +
        ' ' + x.it.row.time + ' ' + (x.it.entry.location || '') + ' ' + (x.it.entry.teacher || '')));
    });
    list.appendChild(line);
  }
  if (!hasAny) {
    list.appendChild(el('div', 'hint', '本周无课程安排'));
  }
  card.appendChild(list);
  return card;
}
