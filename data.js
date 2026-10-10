/* ============================================================
 * data.js —— 【薄层】全局状态、localStorage 持久化、通用工具、
 *            以及 v2 遗留的周计划生成/写入兼容函数。
 * 常量与默认数据已拆分到 data/*.js（默认数据组装见 data/defaultData.js）。
 * 数据迁移见 migration.js；各领域引擎见 core/*.js。
 * ============================================================ */

const STORAGE_KEY = 'studyPlanner';

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/* 跳过原因选项（复盘/跳过弹窗共用，§35） */
const SKIP_REASON_OPTIONS = ['课程太多', '任务估计错误', '难度过高', '疲劳', '临时事件', '拖延', '兴趣不足', '其他'];

/* ---------------- 工具函数 ---------------- */

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* 确定性任务 id：同 week|day|time|title 生成/重建后 id 稳定，
 * 保证 dailyLogs.tasksStatus 镜像 key 不因周计划重建而变化。
 * （修复：生成任务缺 id 导致勾选任何一项都只作用于第一项） */
function taskStableId(week, day, time, title) {
  var s = week + '|' + day + '|' + time + '|' + title;
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 't' + week + '-' + day + '-' + h.toString(36);
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function parseDate(str) {
  var p = String(str).split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}

function fmtISODate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function todayStr() { return fmtISODate(new Date()); }

/* a - b 的天数差（a、b 为 YYYY-MM-DD） */
function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }

/* 周一=1 ... 周日=7 */
function weekdayOf(dateStr) {
  var wd = parseDate(dateStr).getDay();
  return wd === 0 ? 7 : wd;
}

/* 日期 → 周次（夹在 1..totalWeeks） */
function weekOfDate(dateStr) {
  var s = state.data.semester;
  var w = Math.floor(diffDays(dateStr, s.weekOneMonday) / 7) + 1;
  return clamp(w, 1, s.totalWeeks);
}

/* 第 week 周的第 day 天（1=周一）→ 日期字符串 */
function dateOfWeek(week, day) {
  var base = parseDate(state.data.semester.weekOneMonday);
  base.setDate(base.getDate() + (week - 1) * 7 + (day - 1));
  return fmtISODate(base);
}

/* 统一日期显示格式：MM月DD日 周X */
function fmtDateCN(dateStr) {
  var d = parseDate(dateStr);
  return (d.getMonth() + 1) + '月' + String(d.getDate()).padStart(2, '0') + '日 ' +
    DAY_NAMES[weekdayOf(dateStr) - 1];
}

function timeToMin(t) {
  var m = /(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/* 由任务时间段计算时长（小时），如 19:00-21:30 = 2.5h */
function taskHours(task) {
  var m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(task.time || '');
  if (!m) return 0;
  return ((Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]))) / 60;
}

/* 分钟 → 'HH:MM' 字符串 */
function minToTime(mins) {
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function findCourse(id) {
  return state.data.courses.find(function (c) { return c.id === id; }) || null;
}

function subjectColor(subject) {
  for (var key in SUBJECT_COLORS) {
    if (subject.indexOf(key) !== -1) return SUBJECT_COLORS[key];
  }
  return '#4A5568';
}

/* 绩点换算（按 data.gradeRules 从高到低匹配） */
function gpaForScore(score) {
  var rules = (state.data.gradeRules || DEFAULT_GRADE_RULES)
    .slice().sort(function (a, b) { return b.min - a.min; });
  for (var i = 0; i < rules.length; i++) {
    if (score >= rules[i].min) return rules[i].gpa;
  }
  return 0;
}

/* 实际当前周（受 currentWeekOverride 影响） */
function currentWeek() {
  if (state.data.currentWeekOverride != null) {
    return clamp(Number(state.data.currentWeekOverride), 1, state.data.semester.totalWeeks);
  }
  return weekOfDate(todayStr());
}

/* 该周命中的特殊安排（军训/金工实习等） */
function specialWeekInfo(week) {
  var list = state.data.semester.specialWeeks || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].weeks.indexOf(week) !== -1) return list[i];
  }
  return null;
}

/* ---------------- 节日系统 ---------------- */

/* 日期命中的节日（无则 null） */
function holidayOfDate(dateStr) {
  var list = state.data.holidays || [];
  for (var i = 0; i < list.length; i++) {
    var h = list[i];
    if (diffDays(dateStr, h.start) >= 0 && diffDays(h.end, dateStr) >= 0) return h;
  }
  return null;
}

function isHolidayDate(dateStr) { return !!holidayOfDate(dateStr); }

/* 第 week 周包含的节日（按名称去重） */
function holidaysInWeek(week) {
  var out = [];
  var seen = {};
  for (var d = 1; d <= 7; d++) {
    var h = holidayOfDate(dateOfWeek(week, d));
    if (h && !seen[h.name]) { seen[h.name] = true; out.push(h); }
  }
  return out;
}

/* 假期开始前一天（安排收尾总任务的日期） */
function preHolidayDate(h) {
  var d = parseDate(h.start);
  d.setDate(d.getDate() - 1);
  return fmtISODate(d);
}

/* 为第 week 周补齐缺失的"节前收尾总任务"（独立存储，不计入周计划统计） */
function syncHolidayTasksForWeek(week) {
  (state.data.holidays || []).forEach(function (h) {
    var pre = preHolidayDate(h);
    if (weekOfDate(pre) !== week) return;
    if (state.data.holidayTasks[pre]) return;
    state.data.holidayTasks[pre] = {
      date: pre,
      holiday: h.name,
      title: '「' + h.name + '」假期前收尾安排',
      note: '把本周作业与待办全部收尾，并规划好假期安排（带回家的书、假期学习计划、行程等）',
      status: 'todo',
      createdAt: new Date().toISOString()
    };
  });
}

function setHolidayTaskStatus(dateStr, status) {
  var t = state.data.holidayTasks[dateStr];
  if (!t) return;
  t.status = status;
  saveData();
}

function deleteHolidayTask(dateStr) {
  delete state.data.holidayTasks[dateStr];
  saveData();
}

/* ---------------- localStorage 持久化 ---------------- */

/* 改造前备份原始数据（规格§10）：版本升级首次触发时，把旧版原始 JSON
 * 存入独立 key（studyPlannerBackup_v<旧版>_<日期>），可供恢复/导出。
 * 同一旧版本每天只备份一次；失败（如配额不足）不阻断正常加载。 */
const BACKUP_KEY_PREFIX = 'studyPlannerBackup_v';

function backupRawData(raw, fromVersion) {
  try {
    var key = BACKUP_KEY_PREFIX + fromVersion + '_' + todayStr();
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
  } catch (e) {
    console.warn('[学习计划管理] 升级前备份失败（不影响使用）：', e);
  }
}

/* 列出本地所有版本备份 { key, fromVersion, date } */
function listBackups() {
  var out = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(BACKUP_KEY_PREFIX) === 0) {
        var rest = key.slice(BACKUP_KEY_PREFIX.length).split('_');
        out.push({ key: key, fromVersion: rest[0], date: rest.slice(1).join('_') });
      }
    }
  } catch (e) { /* 读取失败返回空列表 */ }
  out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return out;
}

/* 恢复某条备份到主存储（覆盖当前数据；调用方需先经用户确认） */
function restoreBackup(key) {
  var raw = localStorage.getItem(key);
  if (!raw) return { ok: false, error: '备份不存在' };
  localStorage.setItem(STORAGE_KEY, raw);
  return { ok: true };
}

/* 手动备份当前数据到独立 key（词汇中心设置页调用） */
function manualBackup() {
  try {
    var key = BACKUP_KEY_PREFIX + (state.data.version || 'current') + '_' + todayStr() + '_manual';
    localStorage.setItem(key, JSON.stringify(state.data));
    return { ok: true, key: key };
  } catch (e) {
    return { ok: false, error: '备份失败：' + e.message };
  }
}

function saveData() {
  state.data.lastModified = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch (e) {
    /* 存储配额超限（封面图过大/聊天记录过长）：提示并保留内存态，不中断操作 */
    console.error('[学习计划管理] 保存失败：', e);
    var ev = new CustomEvent('planner-save-error');
    document.dispatchEvent(ev);
  }
  document.dispatchEvent(new CustomEvent('planner-data-changed'));
}

function loadData() {
  var raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) { /* 读取失败按全新数据处理 */ }

  if (!raw) return clone(DEFAULT_INIT_DATA);

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('读取本地数据失败，使用默认数据', e);
    return clone(DEFAULT_INIT_DATA);
  }

  /* 版本升级前先备份原始数据（恢复/导出用） */
  var rawVersion = parsed.version || 2;
  if (rawVersion < DATA_VERSION) backupRawData(raw, rawVersion);

  var merged = mergeData(clone(DEFAULT_INIT_DATA), parsed);
  /* 旧数据（v2）没有 version 字段 → 视为 2，交给 runMigration 升级 */
  merged.version = parsed.version || 2;
  runMigration(merged);
  return merged;
}

/* 把旧数据合并进默认结构（兼容缺字段的情况） */
function mergeData(base, loaded) {
  if (!loaded || typeof loaded !== 'object') return base;
  for (var key in base) {
    if (!(key in loaded)) continue;
    if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key]) &&
        loaded[key] && typeof loaded[key] === 'object' && !Array.isArray(loaded[key])) {
      // 浅合并一层对象（userProfile/semester 等）
      for (var k2 in loaded[key]) base[key][k2] = loaded[key][k2];
    } else {
      base[key] = loaded[key];
    }
  }
  return base;
}

function doExport() {
  var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'study-planner-backup-' + todayStr().replace(/-/g, '') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* 校验并导入 JSON 字符串，返回 { ok, error } */
function importFromJson(text) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'JSON 解析失败：' + e.message };
  }
  if (!parsed || typeof parsed !== 'object' ||
      !parsed.userProfile || !Array.isArray(parsed.courses) || !parsed.semester) {
    return { ok: false, error: '不是有效的学习计划数据文件（缺少 userProfile / courses / semester）' };
  }
  var data = mergeData(clone(DEFAULT_INIT_DATA), parsed);
  data.version = parsed.version || 2;
  runMigration(data);
  return { ok: true, data: data };
}

function clearData() {
  localStorage.removeItem(STORAGE_KEY);
  state.data = clone(DEFAULT_INIT_DATA);
  saveData();
}

/* ---------------- dailyLogs ---------------- */

function defaultChecklist() {
  return {
    notesOrganized: false,
    homeworkDone: false,
    gymDone: false,
    vocabCount: 30,
    listeningMinutes: 15,
    calculusSummary: '',
    codingSummary: '',
    completionGrade: '',
    unfinishedReason: '',
    tomorrowAdjust: '',
    /* v3 新增 */
    efficiency: 0,        // 学习效率自评 1-5（0=未评）
    skipCategory: ''      // 结构化跳过原因（SKIP_REASON_OPTIONS 之一，可空）
  };
}

function ensureDailyLog(dateStr) {
  var logs = state.data.dailyLogs;
  if (!logs[dateStr]) {
    logs[dateStr] = {
      date: dateStr,
      weekNumber: weekOfDate(dateStr),
      weekday: weekdayOf(dateStr),
      tasksStatus: {},
      checklist: defaultChecklist(),
      aiToolLog: '',
      savedAt: null
    };
  }
  return logs[dateStr];
}

function getDailyLog(dateStr) {
  return state.data.dailyLogs[dateStr] || null;
}

/* 保存每日复盘（部分字段），并同步 aiToolLog → aiLogs */
function saveDailyLog(dateStr, patch) {
  var log = ensureDailyLog(dateStr);
  for (var key in patch) log[key] = patch[key];
  log.savedAt = new Date().toISOString();
  saveData();

  var text = (log.aiToolLog || '').trim();
  var aiLogs = state.data.aiLogs;
  if (text) {
    var exist = aiLogs.find(function (a) { return a.date === dateStr; });
    if (exist) {
      exist.purpose = text;
    } else {
      aiLogs.push({
        date: dateStr,
        subject: '综合',
        tool: '',
        purpose: text,
        effectRating: null,
        takeaway: ''
      });
      saveData();
    }
  }
  return log;
}

/* ---------------- 周计划 ---------------- */

function getWeekPlan(week) {
  return state.data.weekPlans[String(week)] || null;
}

/* 确保第 week 周计划存在：v3 起由 PlanGenerator（战略 + 预算 + 约束）生成 */
function ensureWeekPlan(week) {
  var plan = getWeekPlan(week);
  if (!plan) {
    syncHolidayTasksForWeek(week);   // 该周含节前最后一天时，自动安排收尾总任务
    plan = PlanGenerator.generate(week);
    state.data.weekPlans[String(week)] = plan;
    saveData();
  }
  return plan;
}

/* 修改任务状态（todo/done/skipped），并镜像写入 dailyLogs.tasksStatus。
 * skipCategory：结构化跳过原因（SKIP_REASON_OPTIONS 之一，可选）。 */
function setTaskStatus(week, taskId, status, note, skipCategory) {
  var plan = getWeekPlan(week);
  var task = null, subject = null;
  if (plan) {
    for (var i = 0; i < plan.subjects.length; i++) {
      var t = plan.subjects[i].tasks.find(function (x) { return x.id === taskId; });
      if (t) { task = t; subject = plan.subjects[i]; break; }
    }
  }
  if (!task) return null;

  task.status = status;
  if (note !== undefined) task.note = note;
  if (status === 'skipped' && skipCategory) task.skipCategory = skipCategory;
  if (status !== 'skipped') task.skipCategory = '';
  plan.updatedAt = new Date().toISOString();

  // 镜像写入 dailyLogs
  var dateStr = dateOfWeek(week, task.day);
  var log = ensureDailyLog(dateStr);
  log.tasksStatus = log.tasksStatus || {};
  log.tasksStatus[taskId] = {
    status: status,
    note: task.note || '',
    subject: subject.subject,
    title: task.title,
    duration: taskHours(task),
    skipCategory: task.skipCategory || ''
  };

  // 健身任务完成时联动勾选 checklist.gymDone
  if (subject.subject === '健身' && status === 'done') {
    log.checklist.gymDone = true;
  }

  saveData();
  return task;
}

/* 删除任务（不影响 dailyLogs 已有记录） */
function deleteTask(week, taskId) {
  var plan = getWeekPlan(week);
  if (!plan) return false;
  plan.subjects.forEach(function (sb) {
    sb.tasks = sb.tasks.filter(function (t) { return t.id !== taskId; });
  });
  plan.subjects = plan.subjects.filter(function (sb) { return sb.tasks.length > 0; });
  plan.updatedAt = new Date().toISOString();
  saveData();
  return true;
}

/* ---------------- 周复盘自动汇总 ----------------
 * v3：由 core/reviewEngine.js 实现（镜像优先，重建周计划不丢历史时长；
 * 修复 v2 aiToolUsageCount 双计数）。此函数保留为兼容入口。 */

function computeWeekSummary(week) {
  if (typeof ReviewEngine !== 'undefined') return ReviewEngine.computeWeekSummary(week);
  return {
    taskCompletionRate: 0, gymCompletionRate: 0, subjectHoursActual: {},
    vocabTotal: 0, aiToolUsageCount: 0, incompleteTasks: [],
    totalTasks: 0, doneTasks: 0, skippedTasks: 0, skipCategories: {},
    efficiencyAvg: 0, efficiencyCount: 0, actualHours: 0
  };
}

/* ---------------- 全局状态 ---------------- */

const state = {
  data: null,        // 根数据对象
  viewWeek: null,    // 当前查看的周次（不影响"今天"的判定）
  activeTab: 'home'
};
