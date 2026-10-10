/* ============================================================
 * schedule.js —— 课表 Tab：按周次动态渲染（weekRange 过滤、
 *                slot 借用归属、自习判定、冲突检测、当前日高亮）
 * ============================================================ */

/* 收集第 week 周命中的课表条目（解析 courseId 借用，归属真实课程） */
function getWeekEntries(week) {
  var out = [];
  /* 军训等特殊周：课表全空 */
  var special = specialWeekInfo(week);
  if (special && special.noClasses) return out;
  state.data.courses.forEach(function (course) {
    (course.schedule || []).forEach(function (e) {
      if (week < e.weekRange[0] || week > e.weekRange[1]) return;
      /* 节假日当天不上课 */
      if (isHolidayDate(dateOfWeek(week, e.day))) return;
      var realCourse = e.courseId ? findCourse(e.courseId) : course;
      if (!realCourse) {
        console.warn('课表条目引用了不存在的课程：' + e.courseId);
        return;
      }
      SCHEDULE_ROWS.forEach(function (row) {
        if (!row.periods.length) return;
        if (e.periods.some(function (p) { return row.periods.indexOf(p) !== -1; })) {
          out.push({
            day: e.day,
            rowKey: row.key,
            course: realCourse,
            entry: e,
            row: row
          });
        }
      });
    });
  });
  return out;
}

/* 同一格内多条条目命中且归属不同课程 → 冲突 */
function detectConflicts(entries) {
  var conflicts = [];
  var byCell = {};
  entries.forEach(function (it) {
    var k = it.day + '|' + it.rowKey;
    (byCell[k] = byCell[k] || []).push(it);
  });
  for (var k in byCell) {
    var items = byCell[k];
    var ids = [];
    items.forEach(function (it) { if (ids.indexOf(it.course.id) === -1) ids.push(it.course.id); });
    if (ids.length > 1) {
      var d = items[0].day, r = items[0].row;
      conflicts.push({
        day: d,
        row: r,
        names: ids.map(function (id) { return COURSE_SHORT[id] || id; })
      });
    }
  }
  return conflicts;
}

function renderSchedule() {
  var w = state.viewWeek;
  var root = document.getElementById('view-schedule');
  root.innerHTML = '';

  /* ---- 顶部提示条 ---- */
  var special = specialWeekInfo(w);
  if (special) {
    var b = el('div', 'banner info');
    b.textContent = '第' + special.weeks.join('、') + '周：' + special.label + '（' + special.note + '）';
    root.appendChild(b);
  }
  if (w >= 7) {
    var hint = el('div', 'banner warn');
    hint.textContent = '提示：第7周起周三7-8节心理健康课占用原健身时段，健身改到课后';
    root.appendChild(hint);
  }
  var hols = holidaysInWeek(w);
  if (hols.length) {
    var hb = el('div', 'banner warn');
    hb.textContent = '本周含假期：' + hols.map(function (h) {
      return h.name + '（' + h.start.slice(5).replace('-', '/') + ' ~ ' + h.end.slice(5).replace('-', '/') + '）';
    }).join('、') + '，假期日无课、不安排任务';
    root.appendChild(hb);
  }

  var entries = getWeekEntries(w);
  var conflicts = detectConflicts(entries);
  var isCurWeek = (w === currentWeek());
  var todayWd = weekdayOf(todayStr());

  /* ---- 课表网格 ---- */
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '第' + w + '周课表'));
  var sub = el('span', 'card-sub', '点击"自习/健身/午休"格子可快速创建该时段任务');
  title.appendChild(sub);
  card.appendChild(title);

  var scroll = el('div', 'sched-scroll');
  var table = document.createElement('table');
  table.className = 'sched-grid';

  /* 表头 */
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  hr.appendChild(document.createElement('th'));
  for (var d = 1; d <= 7; d++) {
    var th = document.createElement('th');
    th.textContent = DAY_NAMES[d - 1] + ' ' + dateOfWeek(w, d).slice(5).replace('-', '/');
    if (isCurWeek && d === todayWd) th.classList.add('today-col');
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  /* 表体 */
  var tbody = document.createElement('tbody');
  SCHEDULE_ROWS.forEach(function (row) {
    var tr = document.createElement('tr');
    var rl = document.createElement('td');
    rl.className = 'row-label';
    var rt = el('div', 'rt', row.label);
    var rtime = el('div', null, row.time);
    rl.appendChild(rt);
    rl.appendChild(rtime);
    tr.appendChild(rl);

    for (var day = 1; day <= 7; day++) {
      var td = document.createElement('td');
      if (isCurWeek && day === todayWd) td.classList.add('today-col');
      td.appendChild(renderScheduleCell(w, day, row, entries, conflicts));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  card.appendChild(scroll);

  /* 图例 */
  var legend = el('div', 'sched-legend');
  [
    ['#1C3A5E', '上课'],
    ['#2A6B5A', '自习（可点击创建任务）'],
    ['#B8860B', '健身（可点击创建任务）'],
    ['#5B4B8A', '复盘/晚间任务'],
    ['#9CA3AF', '休息']
  ].forEach(function (item) {
    var li = el('span', 'legend-item');
    var swatch = el('span', 'legend-swatch', '');
    swatch.style.background = item[0];
    li.appendChild(swatch);
    li.appendChild(el('span', null, item[1]));
    legend.appendChild(li);
  });
  card.appendChild(legend);
  root.appendChild(card);

  /* 冲突列表 */
  if (conflicts.length) {
    var cb = el('div', 'banner danger');
    cb.textContent = '课表冲突（同一时段出现两门不同课程，红色边框标出）：';
    conflicts.forEach(function (c) {
      var line = el('div', null,
        DAY_NAMES[c.day - 1] + ' ' + c.row.label + '：' + c.names.join(' 与 '));
      cb.appendChild(line);
    });
    root.appendChild(cb);
  }
}

/* 渲染某个格子 */
function renderScheduleCell(w, day, row, entries, conflicts) {
  var cell = el('div', 'sched-cell');
  var isConflict = conflicts.some(function (c) { return c.day === day && c.row.key === row.key; });
  if (isConflict) cell.classList.add('conflict');

  /* 节假日：整列显示"假期" */
  var cellDate = dateOfWeek(w, day);
  var holiday = holidayOfDate(cellDate);
  if (holiday) {
    var hol = el('div', 'cell-chip rest', '假期');
    hol.title = holiday.name;
    cell.appendChild(hol);
    return cell;
  }

  /* 午休行：固定碎片自习 */
  if (row.key === 'lunch') {
    var chip = el('div', 'cell-chip lunch', '碎片自习');
    chip.title = '12:40-13:30 碎片任务（背单词/阅读），点击快速创建';
    chip.addEventListener('click', function () {
      openAddTaskModal({ week: w, day: day, time: '12:40-13:30' });
    });
    cell.appendChild(chip);
    return cell;
  }

  var hits = entries.filter(function (it) { return it.day === day && it.rowKey === row.key; });
  if (hits.length) {
    /* 同一格按真实课程去重（slot 借用场景） */
    var seen = [];
    hits.forEach(function (it) {
      if (seen.indexOf(it.course.id) !== -1) return;
      seen.push(it.course.id);
      cell.appendChild(renderCourseChip(it));
    });
    return cell;
  }

  /* 无课格子：自动判定自习 / 健身 */
  if (row.key === 'pm2' && day >= 2) {
    var gym = el('div', 'cell-chip gym', '健身');
    gym.title = '16:00-17:40 健身时段，点击快速创建任务';
    gym.addEventListener('click', function () {
      openAddTaskModal({ week: w, day: day, time: '16:00-17:40' });
    });
    cell.appendChild(gym);
    return cell;
  }

  var self = el('div', 'cell-chip self', '自习');
  self.title = row.time + ' 可自习，点击快速创建任务';
  self.addEventListener('click', function () {
    openAddTaskModal({ week: w, day: day, time: row.time });
  });
  cell.appendChild(self);
  return cell;
}

/* 课程格子内容 */
function renderCourseChip(it) {
  var chip = el('div', 'course-chip');
  chip.style.setProperty('--cc', COURSE_COLORS[it.course.id] || '#2D5F8A');

  var name = el('div', 'cc-name', COURSE_SHORT[it.course.id] || it.course.name);
  if (it.entry.label) {
    var tag = el('span', 'cc-tag', it.entry.label);
    name.appendChild(tag);
  }
  chip.appendChild(name);

  var meta = el('div', 'cc-meta', (it.entry.location || '') + ' · ' + (it.entry.teacher || ''));
  chip.appendChild(meta);
  return chip;
}
