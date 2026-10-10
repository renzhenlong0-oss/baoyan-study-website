/* ============================================================
 * taskId.test.js —— 任务 id 修复测试（v5）
 * 用法：node test/taskId.test.js
 * 覆盖：生成任务 id 唯一且确定性、勾选精确作用于目标任务、
 *       周计划重建后 id 稳定、镜像按 id 写入
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('ui/weeklyPlan.js');

const EXPORT_SNIPPET = `{
  PlanGenerator, clone, DEFAULT_INIT_DATA, state, ensureWeekPlan, getWeekPlan,
  currentWeek, setTaskStatus, saveData, rebuildLegacyWeekPlans, dateOfWeek,
  taskStableId, mergeData
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 任务 id 修复测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }
function flatTasks(plan) {
  var out = [];
  plan.subjects.forEach(function (sb) { sb.tasks.forEach(function (x) { out.push(x); }); });
  return out;
}

console.log('1. 生成任务 id 唯一且非空');
fresh();
var p = X.PlanGenerator.generate(6, { record: false });
var tasks = flatTasks(p);
t.ok('生成任务数 ≥ 5', tasks.length >= 5);
var ids = tasks.map(function (x) { return x.id; });
t.ok('所有任务都有非空 id', ids.every(function (id) { return !!id; }));
t.ok('id 全部唯一', new Set(ids).size === ids.length);

console.log('\n2. 任务 id 确定性（同 week|day|time|title 稳定）');
fresh();
var pA = X.PlanGenerator.generate(6, { record: false });
fresh();
var pB = X.PlanGenerator.generate(6, { record: false });
var mapA = {};
flatTasks(pA).forEach(function (x) { mapA[x.day + '|' + x.time + '|' + x.title] = x.id; });
var stable = flatTasks(pB).every(function (x) { return mapA[x.day + '|' + x.time + '|' + x.title] === x.id; });
t.ok('两次生成相同任务得到相同 id', stable);
var gym = pA.subjects.find(function (sb) { return sb.subject === '健身'; });
t.ok('健身任务也有 id', gym && gym.tasks.every(function (x) { return !!x.id; }));

console.log('\n3. 勾选精确作用于目标任务（bug 修复核心）');
fresh();
X.state.data.currentWeekOverride = 6;
var plan = X.ensureWeekPlan(6);
var list = flatTasks(plan);
var second = list[1], first = list[0];
X.setTaskStatus(6, second.id, 'done');
t.ok('勾选第二条 → 第二条为 done', second.status === 'done');
t.ok('第一条不受影响（保持 todo）', first.status !== 'done');
X.setTaskStatus(6, first.id, 'done');
t.ok('勾选第一条 → 第一条为 done', first.status === 'done');

console.log('\n4. 镜像按 id 写入且周计划重建后 id 稳定');
fresh();
X.state.data.currentWeekOverride = 6;
var plan2 = X.ensureWeekPlan(6);
var tgt = flatTasks(plan2)[2];
X.setTaskStatus(6, tgt.id, 'done');
var logDate = X.dateOfWeek(6, tgt.day);
var mirror = X.state.data.dailyLogs[logDate].tasksStatus;
t.ok('dailyLogs 镜像以任务 id 为 key', !!mirror[tgt.id] && mirror[tgt.id].status === 'done');

/* 重建旧体系计划（engineVersion 置空 → 按新引擎重建），id 应保持稳定 */
var beforeIds = {};
flatTasks(plan2).forEach(function (x) { beforeIds[x.day + '|' + x.time + '|' + x.title] = x.id; });
plan2.engineVersion = null;
var rb = X.rebuildLegacyWeekPlans(X.state.data);
t.ok('重建执行', rb.rebuilt >= 1);
var after = X.getWeekPlan(6);
var sameIds = flatTasks(after).every(function (x) {
  return beforeIds[x.day + '|' + x.time + '|' + x.title] === x.id;
});
t.ok('重建后任务 id 全部稳定（镜像 key 不失效）', sameIds);

console.log('\n5. taskStableId 与迁移补 id 一致性');
t.eq('taskStableId 确定性', X.taskStableId(6, 3, '19:00-20:30', '微积分复习'),
  X.taskStableId(6, 3, '19:00-20:30', '微积分复习'));
t.ok('不同 title 不同 id', X.taskStableId(6, 3, '19:00-20:30', '微积分复习') !==
  X.taskStableId(6, 3, '19:00-20:30', '微积分作业'));

t.report();
