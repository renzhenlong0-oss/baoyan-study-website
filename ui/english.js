/* ============================================================
 * ui/english.js —— 英语页（v3 → v5）
 * 子导航：词汇中心（个人英语词汇中心，v5 新增）/ CET 目标 /
 *         打卡统计 / 本周任务。
 * CET4/CET6 目标与进度：数据来自每日 checklist 打卡
 * （vocabCount/listeningMinutes）+ 周复盘聚合 + 本周英语任务。
 * ============================================================ */

let englishSubTab = 'vocab';   // vocab | cet | checkin | tasks

function renderEnglish() {
  var root = document.getElementById('view-english');
  root.innerHTML = '';

  var nav = el('div', 'subnav');
  [['vocab', '词汇中心'], ['cet', 'CET目标'], ['checkin', '打卡统计'], ['tasks', '本周任务']].forEach(function (item) {
    var b = el('button', 'subnav-btn' + (englishSubTab === item[0] ? ' active' : ''), item[1]);
    b.addEventListener('click', function () {
      englishSubTab = item[0];
      renderEnglish();
    });
    nav.appendChild(b);
  });
  root.appendChild(nav);

  if (englishSubTab === 'vocab') {
    var box = el('div');
    root.appendChild(box);
    renderVocabCenter(box);
    return;
  }
  if (englishSubTab === 'cet') root.appendChild(renderCetCard());
  else if (englishSubTab === 'checkin') root.appendChild(renderVocabCard());
  else root.appendChild(renderEnglishTasksCard());
}

/* CET4 目标卡 */
function renderCetCard() {
  var cet = state.data.semester.cet4Exam || {};
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, 'CET-4 目标'));
  title.appendChild(el('span', 'card-sub', '目标 ' + (state.data.userProfile.englishTarget || 550) + '+'));
  card.appendChild(title);

  var rows = el('div');
  rows.appendChild(el('div', 'hint', '报考状态：' +
    (cet.planned === true ? '计划报考' : (cet.planned === false ? '不报考' : '待确认')) +
    (cet.notAllowed ? '（学校暂不允许大一上报考）' : '')));
  if (cet.expectedDate) {
    var days = diffDays(cet.expectedDate, todayStr());
    rows.appendChild(el('div', 'hint',
      '预计考试：' + cet.expectedDate + (days >= 0 ? '（还有 ' + days + ' 天）' : '（已过）')));
  }
  if (cet.confirmHint) rows.appendChild(el('div', 'hint', cet.confirmHint));
  rows.appendChild(el('div', 'hint', '长期：大二下六级高分；学术英语随科研阶段逐步强化。'));
  card.appendChild(rows);
  return card;
}

/* 打卡统计卡 */
function renderVocabCard() {
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '单词 / 听力打卡（近14天）'));

  var logs = state.data.dailyLogs;
  var days = 0, vocabSum = 0, listenSum = 0;
  var dayList = [];
  for (var i = 0; i < 14; i++) {
    var d = parseDate(todayStr());
    d.setDate(d.getDate() - i);
    var ds = fmtISODate(d);
    var log = logs[ds];
    var v = log && log.checklist ? Number(log.checklist.vocabCount || 0) : 0;
    var l = log && log.checklist ? Number(log.checklist.listeningMinutes || 0) : 0;
    if (log && log.checklist) { days++; vocabSum += v; listenSum += l; }
    dayList.push({ ds: ds, v: v, l: l });
  }
  var vocabAvg = days ? Math.round(vocabSum / days) : 0;
  var listenAvg = days ? Math.round(listenSum / days) : 0;

  var grid = el('div', 'budget-grid');
  var cells = [
    { label: '日均单词', value: vocabAvg + ' / 30 个' },
    { label: '日均听力', value: listenAvg + ' / 15 分' },
    { label: '打卡天数', value: days + ' / 14 天' },
    { label: '词汇累计', value: vocabSum + ' 个' },
    { label: '听力累计', value: Math.round(listenSum / 60 * 10) / 10 + ' 小时' }
  ];
  cells.forEach(function (c) {
    var box = el('div', 'budget-cell');
    box.appendChild(el('div', 'budget-label', c.label));
    box.appendChild(el('div', 'budget-value', c.value));
    grid.appendChild(box);
  });
  card.appendChild(grid);

  /* 近14天柱状迷你图（纯 CSS） */
  var bars = el('div', 'vocab-bars');
  dayList.slice().reverse().forEach(function (dd) {
    var col = el('div', 'vocab-bar-col');
    var bar = el('div', 'vocab-bar');
    bar.style.height = Math.round(dd.v / 30 * 40) + 'px';
    bar.title = dd.ds.slice(5) + '：单词 ' + dd.v + ' / 听力 ' + dd.l + 'min';
    col.appendChild(bar);
    col.appendChild(el('div', 'vocab-bar-label', dd.ds.slice(8, 10)));
    bars.appendChild(col);
  });
  card.appendChild(bars);
  card.appendChild(el('div', 'hint', '打卡数据在「今日 → 今日复盘」中填写。'));
  return card;
}

/* 本周英语任务卡 */
function renderEnglishTasksCard() {
  var wk = currentWeek();
  var plan = getWeekPlan(wk);
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '本周英语任务'));

  if (!plan) {
    card.appendChild(el('div', 'hint', '第' + wk + '周计划未生成。'));
    return card;
  }
  var found = false;
  plan.subjects.forEach(function (sb) {
    if (['英语/四级', '专业英语'].indexOf(sb.subject) === -1) return;
    found = true;
    card.appendChild(el('div', 'hint', sb.subject + '：' + sb.plannedHours + 'h（' + (sb.goal || '') + '）'));
    sb.tasks.slice().sort(function (a, b) { return (a.day - b.day) || timeToMin(a.time) - timeToMin(b.time); })
      .forEach(function (t) {
        var row = el('div', 'task-row');
        if (t.status === 'done') row.classList.add('done');
        row.appendChild(el('span', 'task-time', DAY_NAMES[t.day - 1] + ' ' + t.time));
        row.appendChild(el('span', 'task-title', t.title));
        row.appendChild(el('span', 'st ' + (t.status === 'done' ? 'st-done' : (t.status === 'skipped' ? 'st-skip' : 'st-todo')),
          t.status === 'done' ? '已完成' : (t.status === 'skipped' ? '跳过' : '未开始')));
        card.appendChild(row);
      });
  });
  if (!found) card.appendChild(el('div', 'hint', '本周英语维持策略：碎片时间打卡，未单独排大块任务。'));
  return card;
}
