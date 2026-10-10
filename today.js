/* ============================================================
 * today.js —— 今日计划 Tab（默认首屏）：今日课表、任务清单
 *             勾选保存、每日复盘表单、节日系统（假期卡片、
 *             节前收尾总任务）
 * ============================================================ */

function renderToday() {
  var root = document.getElementById('view-today');
  root.innerHTML = '';

  var t = todayStr();
  var wk = weekOfDate(t);       // 实际今天所在周（不受查看周次影响）
  var wd = weekdayOf(t);
  syncHolidayTasksForWeek(wk);  // 今天所在周含节前最后一天时，确保收尾总任务已生成

  var plan = getWeekPlan(wk);
  var dayTasks = collectDayTasks(plan, wd);
  var doneCount = dayTasks.filter(function (x) { return x.t.status === 'done'; }).length;
  var hol = holidayOfDate(t);

  /* ---- 头部：大字日期 + 进度 ---- */
  var head = el('div', 'card');
  head.appendChild(el('div', 'overline', 'TODAY · 第' + wk + '周'));
  head.appendChild(el('div', 'big-date', fmtDateCN(t)));
  if (!hol && dayTasks.length) {
    var progRow = el('div', 'field-row');
    progRow.style.alignItems = 'center';
    var track = el('div', 'progress-track');
    var fill = el('div', 'progress-fill' + (doneCount === dayTasks.length ? ' green' : ''));
    var pct = Math.round(doneCount / dayTasks.length * 100);
    fill.style.width = pct + '%';
    track.appendChild(fill);
    progRow.appendChild(track);
    progRow.appendChild(el('span', 'hint', pct + '%（已完成' + doneCount + '/' + dayTasks.length + '）'));
    head.appendChild(progRow);
  }
  root.appendChild(head);

  if (hol) {
    /* ---- 假期日：不显示课表与任务清单，只放假期卡片 ---- */
    var holCard = el('div', 'card holiday-hero');
    holCard.appendChild(el('div', 'overline', 'HOLIDAY'));
    holCard.appendChild(el('div', 'big-date', hol.name + '假期'));
    var dayIdx = diffDays(t, hol.start) + 1;
    holCard.appendChild(el('p', 'hint', '今天是' + hol.name + '假期第' + dayIdx + '天。假期不安排任务，好好休息。'));
    root.appendChild(holCard);
  } else {
    root.appendChild(renderTodayClassesCard(wk, wd));
    root.appendChild(renderTodayTasksCard(wk, wd, plan, dayTasks));
    /* v3：今日时间轴（从旧主页迁入：课表与任务按时间段合并） */
    root.appendChild(renderTodayTimelineCard(wk, wd));
    /* 节前最后一天：显示独立的收尾总任务（不计入周计划统计） */
    var hTask = state.data.holidayTasks[t];
    if (hTask) root.appendChild(renderHolidayTaskCard(hTask));
  }

  /* ---- 今日复盘卡片 ---- */
  var reviewCard = el('div', 'card');
  var rTitle = el('div', 'card-title');
  rTitle.appendChild(el('span', null, '今日复盘'));
  var savedToday = !!getDailyLog(t) && getDailyLog(t).savedAt;
  rTitle.appendChild(el('span', 'card-sub', savedToday ? '今天已保存过复盘' : '21:00 后记得填写'));
  reviewCard.appendChild(rTitle);
  renderReviewForm(reviewCard, t, { flash: true });
  root.appendChild(reviewCard);
}

/* ---- 今日课表 ---- */
function renderTodayClassesCard(wk, wd) {
  var clsCard = el('div', 'card');
  clsCard.appendChild(el('div', 'card-title', '今日课表'));

  var entries = getWeekEntries(wk).filter(function (it) { return it.day === wd; });
  /* 同一课程跨行（如近现代史1-3节）去重显示 */
  var seenCourse = {};
  var shown = entries.filter(function (it) {
    var key = it.course.id + '|' + it.entry.location + '|' + it.entry.label;
    if (seenCourse[key]) return false;
    seenCourse[key] = true;
    return true;
  }).sort(function (a, b) { return timeToMin(a.row.time) - timeToMin(b.row.time); });

  if (!shown.length) {
    var special = specialWeekInfo(wk);
    clsCard.appendChild(el('div', 'hint',
      special ? '今日无课（' + special.label + '期间）' : '今日无课，可自由安排自习'));
  } else {
    shown.forEach(function (it) {
      var line = el('div', 'task-row');
      line.style.cursor = 'default';
      line.appendChild(el('span', 'task-time', it.row.time));
      var name = COURSE_SHORT[it.course.id] || it.course.name;
      line.appendChild(el('span', 'task-title', name + (it.entry.label ? '（' + it.entry.label + '）' : '')));
      line.appendChild(el('span', 'hint', (it.entry.location || '') + ' ' + (it.entry.teacher || '')));
      clsCard.appendChild(line);
    });
    if (wd === 1 && shown.some(function (x) { return x.course.id === 'pe'; })) {
      clsCard.appendChild(el('p', 'hint', '注：周一基础体育课代替当日健身'));
    }
  }
  return clsCard;
}

/* ---- 今日任务清单 ---- */
function renderTodayTasksCard(wk, wd, plan, dayTasks) {
  var taskCard = el('div', 'card');
  var taskTitle = el('div', 'card-title');
  taskTitle.appendChild(el('span', null, '今日任务清单'));
  taskTitle.appendChild(el('span', 'card-sub', '勾选即保存，可跳过/备注'));
  taskCard.appendChild(taskTitle);

  if (!dayTasks.length) {
    var empty = el('div', 'empty-state');
    empty.appendChild(el('div', null, '本日无计划任务'));
    var addBtn = el('button', 'btn btn-primary', plan ? '添加今日任务' : '从周计划模板添加');
    addBtn.addEventListener('click', function () {
      if (!plan) {
        ensureWeekPlan(wk);
        renderToday();
        updateStatusbar();
      } else {
        openAddTaskModal({ week: wk, day: wd });
      }
    });
    empty.appendChild(addBtn);
    taskCard.appendChild(empty);
  } else {
    dayTasks.forEach(function (item) {
      taskCard.appendChild(renderTodayTaskRow(wk, item.t, item.sb));
    });
    var hasReview = dayTasks.some(function (x) { return x.t.subject === '复盘'; });
    if (hasReview) {
      taskCard.appendChild(el('p', 'hint', '完成后记得填写下方今日复盘卡片'));
    }
  }
  return taskCard;
}

/* ---- 节前收尾总任务（独立于周计划） ---- */
function renderHolidayTaskCard(t) {
  var card = el('div', 'card holiday-task-card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '节日总任务（' + t.holiday + '前）'));
  title.appendChild(el('span', 'card-sub', '独立安排，不计入周计划统计'));
  card.appendChild(title);
  card.appendChild(el('p', 'hint', t.note));

  var row = el('div', 'task-row');
  if (t.status === 'done') row.classList.add('done');

  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = (t.status === 'done');
  cb.title = '勾选 = 完成';
  cb.addEventListener('change', function () {
    setHolidayTaskStatus(t.date, cb.checked ? 'done' : 'todo');
    renderToday();
    updateStatusbar();
  });
  row.appendChild(cb);
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
      renderToday();
    });
  });
  actions.appendChild(bEdit);
  row.appendChild(actions);
  card.appendChild(row);
  return card;
}

function collectDayTasks(plan, wd) {
  var out = [];
  if (!plan) return out;
  plan.subjects.forEach(function (sb) {
    sb.tasks.forEach(function (t) {
      if (t.day === wd) out.push({ t: t, sb: sb });
    });
  });
  out.sort(function (a, b) { return timeToMin(a.t.time) - timeToMin(b.t.time); });
  return out;
}

/* 今日任务行：checkbox 切换、跳过（结构化原因分类，§35）、备注 */
function renderTodayTaskRow(wk, t, sb) {
  var row = el('div', 'task-row');
  if (t.status === 'done') row.classList.add('done');
  if (t.status === 'skipped') row.classList.add('skipped');

  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = (t.status === 'done');
  cb.title = '勾选 = 完成（再次点击可取消）';
  cb.addEventListener('change', function () {
    setTaskStatus(wk, t.id, cb.checked ? 'done' : 'todo');
    renderToday();
    updateStatusbar();
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
      setTaskStatus(wk, t.id, t.status, v);
      renderToday();
    });
  });
  actions.appendChild(bNote);

  if (t.status !== 'done') {
    var bSkip = el('button', 'btn btn-sm', '跳过');
    bSkip.addEventListener('click', function () {
      openSkipModal(wk, t);   // ui/weeklyPlan.js：结构化原因分类
    });
    actions.appendChild(bSkip);
  }
  row.appendChild(actions);

  if (t.note) {
    row.appendChild(el('div', 'task-note', '备注：' + t.note));
  }
  if (t.status === 'skipped' && t.skipCategory) {
    row.appendChild(el('div', 'task-note', '跳过原因：' + t.skipCategory));
  }
  return row;
}

/* ============================================================
 * 今日时间轴（从 v2 主页迁入：课表 + 任务镶嵌进 6 个时段行）
 * ============================================================ */

/* 六行分钟跨度（与 SCHEDULE_ROWS 顺序对应） */
const TL_ROW_MINS = [
  { key: 'am1',   start: 480,  end: 580 },
  { key: 'am2',   start: 600,  end: 700 },
  { key: 'lunch', start: 760,  end: 810 },
  { key: 'pm1',   start: 840,  end: 940 },
  { key: 'pm2',   start: 960,  end: 1060 },
  { key: 'night', start: 1140, end: 1305 }
];

/* 任务起始分钟 → 归属行 key；不命中任何行时归"上一行"（如 17:40 健身课后 → pm2） */
function findTimelineRow(startMin) {
  var last = null;
  for (var i = 0; i < TL_ROW_MINS.length; i++) {
    var r = TL_ROW_MINS[i];
    if (startMin >= r.start && startMin < r.end) return r.key;
    if (startMin >= r.end) last = r.key;
  }
  return last || 'night';
}

/* 今日时间轴数据（纯函数，可 Node 测试）：课程条目与任务条目合并进 SCHEDULE_ROWS 六行 */
function buildTimelineData(wk, wd) {
  var rows = SCHEDULE_ROWS.map(function (r) {
    return { row: r, courses: [], tasks: [] };
  });

  /* 课表（去重规则同今日课表卡：courseId|location|label） */
  var seen = {};
  getWeekEntries(wk).filter(function (it) { return it.day === wd; }).forEach(function (it) {
    var key = it.course.id + '|' + it.entry.location + '|' + it.entry.label;
    if (seen[key]) return;
    seen[key] = true;
    var row = rows.find(function (r) { return r.row.key === it.rowKey; });
    if (row) row.courses.push(it);
  });

  /* 任务 */
  var plan = getWeekPlan(wk);
  if (plan) {
    collectDayTasks(plan, wd).forEach(function (item) {
      var key = findTimelineRow(timeToMin(item.t.time));
      var row = rows.find(function (r) { return r.row.key === key; });
      if (row) row.tasks.push(item);
    });
  }

  /* 节前收尾总任务（无具体时间，放晚上段） */
  var hTask = state.data.holidayTasks[todayStr()];
  if (hTask) {
    var night = rows.find(function (r) { return r.row.key === 'night'; });
    if (night) night.tasks.push({ t: hTask, sb: null, holiday: true });
  }

  /* 同段内排序：开始分钟升序 */
  rows.forEach(function (r) {
    r.courses.sort(function (a, b) { return timeToMin(a.row.time) - timeToMin(b.row.time); });
    r.tasks.sort(function (a, b) { return timeToMin(a.t.time) - timeToMin(b.t.time); });
  });
  return rows;
}

/* 今日时间轴卡片：时段六行，课程与任务按时间镶嵌 */
function renderTodayTimelineCard(wk, wd) {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '今日时间轴'));
  title.appendChild(el('span', 'card-sub', '课表与任务按时间段合并'));
  card.appendChild(title);

  var rows = buildTimelineData(wk, wd);
  var list = el('div', 'tl-list');
  rows.forEach(function (r) {
    var seg = el('div', 'tl-seg');
    var lab = el('div', 'tl-label');
    lab.appendChild(el('div', 'rt', r.row.label));
    lab.appendChild(el('div', null, r.row.time));
    seg.appendChild(lab);

    var body = el('div', 'tl-body');
    r.courses.forEach(function (it) {
      var chip = el('div', 'tl-item tl-course');
      chip.style.setProperty('--cc', COURSE_COLORS[it.course.id] || '#2D5F8A');
      chip.appendChild(el('div', null, COURSE_SHORT[it.course.id] || it.course.name));
      chip.appendChild(el('div', 'tl-meta', (it.entry.location || '') + (it.entry.teacher ? ' · ' + it.entry.teacher : '')));
      body.appendChild(chip);
    });
    r.tasks.forEach(function (item) {
      if (item.holiday) {
        var hc = el('div', 'tl-item tl-holiday');
        hc.appendChild(el('div', null, item.t.title));
        hc.appendChild(el('div', 'tl-meta', '节日总任务 · 不计入统计'));
        body.appendChild(hc);
        return;
      }
      var t = item.t;
      var it = el('div', 'tl-item tl-task' + (t.status === 'done' ? ' done' : ''));
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = (t.status === 'done');
      cb.title = '勾选 = 完成';
      cb.addEventListener('change', function () {
        setTaskStatus(wk, t.id, cb.checked ? 'done' : 'todo');
        renderToday();
        updateStatusbar();
      });
      it.appendChild(cb);
      var info = el('div', 'tl-task-info');
      info.appendChild(el('div', null, t.time + ' ' + t.title));
      info.appendChild(el('div', 'tl-meta', item.sb ? item.sb.subject : ''));
      it.appendChild(info);
      body.appendChild(it);
    });
    if (!r.courses.length && !r.tasks.length) {
      body.appendChild(el('div', 'tl-empty', '—'));
    }
    seg.appendChild(body);
    list.appendChild(seg);
  });
  card.appendChild(list);
  return card;
}
