/* ============================================================
 * migration.test.js —— v2 → v3 数据迁移测试
 * 用法：node test/migration.test.js
 * 覆盖：version 升级、v3 结构兜底、路线图迁移、快照迁移、
 *       checklist 补齐、weekPlans 重建（依赖 PlanGenerator，P3 后启用断言）
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
/* PlanGenerator 就绪后追加 core 引擎文件，启用重建断言 */
let hasGenerator = false;
try {
  require('fs').accessSync(require('path').join(H.DIR, 'core', 'planGenerator.js'));
  hasGenerator = true;
} catch (e) { /* 尚未创建 */ }

if (hasGenerator) {
  files.push(
    'core/goalEngine.js', 'core/policyEngine.js', 'core/gpaRiskEngine.js',
    'core/timeBudgetEngine.js', 'core/gymScheduler.js', 'core/constraintEngine.js',
    'core/strategyEngine.js', 'core/planGenerator.js'
  );
}

const EXPORT_SNIPPET = `{
  runMigration, rebuildLegacyWeekPlans, mergeData, clone, DEFAULT_INIT_DATA,
  getWeekPlan, state, defaultChecklist, uid,
  taskStableId, backupRawData, listBackups, restoreBackup, defaultVocabCenterState
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 数据迁移测试开始 ===\n');

/* 构造一个完整的 v2 数据 fixture（模拟用户真实历史数据）。
 * 周计划为 v2 模板产物（无 engineVersion），含用户勾选记录。 */
function makeV2Fixture() {
  X.state.data = X.clone(X.DEFAULT_INIT_DATA);
  var plan = {
    weekNumber: 4,
    focus: '微积分同步推进 + C语言基础 + 四级词汇积累',
    subjects: [
      { subject: '微积分', plannedHours: 6, goal: '', tasks: [
        { id: 'legacy-1', day: 1, time: '19:00-21:30', title: '微积分复习+作业', type: '学习', status: 'done', note: '' },
        { id: 'legacy-2', day: 6, time: '09:00-12:00', title: '微积分专题攻坚', type: '学习', status: 'todo', note: '' }
      ] },
      { subject: '英语/四级', plannedHours: 5, goal: '', tasks: [
        { id: 'legacy-3', day: 1, time: '12:40-13:30', title: '英语单词30个+听力', type: '碎片', status: 'done', note: '' },
        { id: 'legacy-4', day: 2, time: '12:40-13:30', title: '英语单词30个', type: '碎片', status: 'todo', note: '' }
      ] },
      { subject: '健身', plannedHours: 6, goal: '', tasks: [
        { id: 'legacy-5', day: 2, time: '16:00-17:40', title: '健身', type: '固定', status: 'skipped', note: '太累' }
      ] }
    ],
    createdAt: '2026-09-27T00:00:00Z',
    updatedAt: '2026-09-27T00:00:00Z'
  };
  X.state.data.weekPlans['4'] = plan;
  /* 模拟任务勾选时写入的 dailyLogs 镜像 */
  X.state.data.dailyLogs['2026-09-28'] = {
    date: '2026-09-28', weekNumber: 4, weekday: 1,
    tasksStatus: {
      'legacy-1': { status: 'done', note: '', subject: '微积分', title: '微积分复习+作业', duration: 2.5 },
      'legacy-3': { status: 'done', note: '', subject: '英语/四级', title: '英语单词30个+听力', duration: 0.83 }
    },
    checklist: { vocabCount: 30, gymDone: false }, aiToolLog: ''
  };

  var v2 = X.clone(X.state.data);
  delete v2.version;
  delete v2.goals; delete v2.policies; delete v2.resources; delete v2.programming;
  delete v2.research; delete v2.competitions; delete v2.weeklyStrategy;
  delete v2.timeBudgets; delete v2.snapshots; delete v2.migrationLog;
  v2.roadmap = { '循环': { topics: { '循环': true } }, '数组': { topics: { '数组': true } } };
  v2.aiChat = { messages: [{ role: 'user', content: '你好', ts: '2026-10-01T00:00:00Z' }], snapshot: null };
  v2.dailyLogs['2026-09-30'] = { date: '2026-09-30', checklist: { vocabCount: 15, gymDone: true }, aiToolLog: '' };
  v2.gpaSimulation = { scores: { calc: 85 }, gpa: 3.7, savedAt: '2026-10-01T00:00:00Z' };
  return v2;
}

console.log('1. v2 fixture → v3 迁移');
var v2 = makeV2Fixture();
var doneSubjectsBefore = [];
v2.weekPlans['4'].subjects.forEach(function (sb) {
  sb.tasks.forEach(function (task) { if (task.status === 'done') doneSubjectsBefore.push(task.title); });
});

X.runMigration(v2);
t.eq('version 升级为 5', v2.version, 5);
t.ok('v3 结构全部补齐（goals/policies/resources/programming/research/competitions/snapshots/timeBudgets）',
  !![v2.goals, v2.policies, v2.resources, v2.programming, v2.research, v2.competitions].every(Boolean) &&
  Array.isArray(v2.snapshots) && typeof v2.timeBudgets === 'object');
t.ok('旧路线图勾选迁移为编程进度（c-loop 与 c-array 为 done）',
  v2.programming.c.topics.some(function (x) { return x.id === 'c-loop' && x.status === 'done'; }) &&
  v2.programming.c.topics.some(function (x) { return x.id === 'c-array' && x.status === 'done'; }));
t.ok('聊天记录保留', v2.aiChat.messages.length === 1);
t.ok('旧 checklist 保留旧值并补齐 v3 字段',
  v2.dailyLogs['2026-09-30'].checklist.vocabCount === 15 &&
  v2.dailyLogs['2026-09-30'].checklist.gymDone === true &&
  'efficiency' in v2.dailyLogs['2026-09-30'].checklist);
t.ok('gpaSimulation 保留', v2.gpaSimulation && v2.gpaSimulation.scores.calc === 85);
t.ok('旧周计划数据保留（重建前）', v2.weekPlans['4'] && v2.weekPlans['4'].subjects.length > 0);
t.ok('迁移日志写入', v2.migrationLog && v2.migrationLog.from === 2 && v2.migrationLog.to === 5);
t.ok('v5：词汇中心结构初始化（words/settings/dailyLog）',
  v2.vocabCenter && Array.isArray(v2.vocabCenter.words) && !!v2.vocabCenter.settings &&
  !!v2.vocabCenter.dailyLog && v2.vocabCenter.settings.dailyBudget.min === 20 && v2.vocabCenter.settings.dailyBudget.max === 25);

console.log('\n2. 迁移幂等性');
var snapshotAfter = JSON.stringify(v2);
X.runMigration(v2);
t.ok('再次运行迁移不改变数据', JSON.stringify(v2) === snapshotAfter);

console.log('\n2b. v5 迁移：存量任务补 id + 升级前备份');
(function () {
  /* 构造带【无 id 任务】的旧计划（v3 生成器曾缺 id → 勾选只作用于第一项的 bug） */
  var d = X.clone(X.DEFAULT_INIT_DATA);
  d.version = 4;
  d.vocabCenter = undefined;
  d.weekPlans = {
    '6': { weekNumber: 6, engineVersion: 3, subjects: [{ subject: '微积分', plannedHours: 2, goal: '', tasks: [
      { day: 1, time: '19:00-20:30', title: '微积分复习', type: '学习', status: 'todo' },
      { day: 2, time: '19:00-20:30', title: '微积分作业', type: '学习', status: 'todo' }
    ] }] }
  };
  /* 升级前备份：原始数据写入独立 key */
  X.backupRawData(JSON.stringify(d), 4);
  X.runMigration(d);
  var ids = d.weekPlans['6'].subjects[0].tasks.map(function (t) { return t.id; });
  t.ok('v5：无 id 任务全部补上唯一 id', ids.length === 2 && ids[0] && ids[1] && ids[0] !== ids[1]);
  t.eq('v5：确定性 id 与 taskStableId 一致', ids[0], X.taskStableId(6, 1, '19:00-20:30', '微积分复习'));
  var backups = X.listBackups();
  t.ok('升级前备份已写入独立 key', backups.length >= 1 && backups[0].fromVersion === '4');
  var bKey = backups[0].key;
  var before = sandbox.localStorage.getItem(bKey);
  t.ok('备份内容为原始 JSON', before && before.indexOf('微积分复习') !== -1);
  var r = X.restoreBackup(bKey);
  t.ok('备份可恢复到主存储', r.ok === true && sandbox.localStorage.getItem('studyPlanner') === before);
  /* 再跑一次迁移：幂等（不重复备份、不重复补 id） */
  X.runMigration(d);
  t.ok('补 id 幂等（再跑一次 id 不变）', d.weekPlans['6'].subjects[0].tasks.every(function (t) { return t.id; }) &&
    d.weekPlans['6'].subjects[0].tasks[0].id === ids[0]);
})();

console.log('\n3. 旧体系周计划重建（用户已确认：全部按新引擎重建）');
if (hasGenerator) {
  X.state.data = v2;
  var result = X.rebuildLegacyWeekPlans(X.state.data);
  t.ok('重建执行（rebuilt ≥ 1）', result.rebuilt >= 1);
  var newPlan = X.getWeekPlan(4);
  t.ok('重建后计划带 v3 引擎标记', newPlan && newPlan.engineVersion === 3);
  var keptDone = [];
  newPlan.subjects.forEach(function (sb) {
    sb.tasks.forEach(function (task) { if (task.status === 'done') keptDone.push(task.title); });
  });
  t.ok('已勾选任务按 day|time|title 匹配保留（保留：' + keptDone.join('、') + '）',
    keptDone.indexOf('微积分复习+作业') !== -1);
  t.ok('重建幂等（再跑一次 rebuilt=0）', X.rebuildLegacyWeekPlans(X.state.data).rebuilt === 0);
  /* 未匹配的历史完成记录仍保留在 dailyLogs 镜像中（历史实际时长不丢） */
  var mirror = X.state.data.dailyLogs['2026-09-28'];
  t.ok('dailyLogs 镜像保留旧任务记录（' + (mirror && mirror.tasksStatus ? Object.keys(mirror.tasksStatus).length : 0) + ' 条）',
    mirror && mirror.tasksStatus && mirror.tasksStatus['legacy-1']);
} else {
  t.ok('PlanGenerator 未就绪，重建延后（P3 落地后本组自动启用）', true);
}

t.report();
