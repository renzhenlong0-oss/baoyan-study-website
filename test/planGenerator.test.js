/* ============================================================
 * planGenerator.test.js —— 周计划生成器测试
 * 用法：node test/planGenerator.test.js
 * 覆盖：预算约束、优先级占时段、假期不排任务、健身任务、
 *       军训周/考试周/保护模式、兜底放置、重新生成保留勾选
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('ui/weeklyPlan.js');

const EXPORT_SNIPPET = `{
  PlanGenerator, StrategyEngine, TimeBudgetEngine, GymScheduler, ConstraintEngine,
  clone, DEFAULT_INIT_DATA, state, ensureWeekPlan, getWeekPlan, currentWeek,
  dateOfWeek, todayStr, setTaskStatus, saveData
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 计划生成器测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }
function flatTasks(plan) {
  var out = [];
  plan.subjects.forEach(function (sb) { sb.tasks.forEach(function (x) { out.push(x); }); });
  return out;
}

console.log('1. 基本生成与预算约束');
fresh();
var p6 = X.PlanGenerator.generate(6, { record: false });
t.ok('engineVersion = 3', p6.engineVersion === 3);
t.ok('预算信息写入计划', p6.budget && p6.budget.planned > 0);
var allocSum = 0;
X.state.data.weeklyStrategy = null;
var strat = X.StrategyEngine.getDefaultWeeklyStrategy(6);
strat.allocation.forEach(function (a) { allocSum += a.hours; });
t.ok('分配总和 ≤ 预算 planned（' + allocSum + ' ≤ ' + strat.budget.planned + '）', allocSum <= strat.budget.planned + 0.15);
t.ok('约束校验 ok', p6.validation && p6.validation.ok === true);
t.ok('所有任务不与课表冲突', flatTasks(p6).every(function (task) {
  return !X.ConstraintEngine.classConflict(6, task.day, task.time);
}));
t.ok('所有任务不超日负荷上限 4h', [1, 2, 3, 4, 5, 6, 7].every(function (d) {
  var h = flatTasks(p6).filter(function (x) { return x.day === d && x.subject !== '健身'; })
    .reduce(function (s, x) { return s + (x.time ? ((function (tt) {
      var m = /(\\d{1,2}):(\\d{2})-(\\d{1,2}):(\\d{2})/.exec(tt);
      return m ? ((Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]))) / 60 : 0;
    })(x.time)) : 0); }, 0);
  return h <= 4.01;
}));

console.log('\n2. 优先级占时段（微积分/程设 > 科研）');
fresh();
var p6b = X.PlanGenerator.generate(6, { record: false });
var tasks = flatTasks(p6b);
var calcPlaced = tasks.filter(function (x) { return x.subject === '微积分'; });
var research = tasks.filter(function (x) { return x.subject === '科研/AI探索'; });
t.ok('微积分任务已放置（' + calcPlaced.length + ' 个）', calcPlaced.length >= 2);
t.ok('科研任务有放置（兜底空闲时段，' + research.length + ' 个）', research.length >= 1);
t.ok('科研任务不与程设任务时间重叠', research.every(function (r) {
  return !tasks.some(function (o) { return o !== r && o.day === r.day && X.ConstraintEngine.overlaps(o.time, r.time); });
}));

console.log('\n3. 假期与特殊周');
fresh();
var p5 = X.PlanGenerator.generate(5, { record: false });
var tasks5 = flatTasks(p5);
t.ok('week5 周一~三（国庆假期）无任务，周四（10-08 上班日）起有任务', tasks5.every(function (x) { return x.day >= 4; }));
var p2 = X.PlanGenerator.generate(2, { record: false });
t.ok('军训周无健身任务', !p2.subjects.some(function (sb) { return sb.subject === '健身'; }));
t.ok('军训周科目仅英语/复盘', p2.subjects.every(function (sb) { return ['英语/四级', '复盘'].indexOf(sb.subject) !== -1; }));

console.log('\n4. 健身任务');
fresh();
var p6c = X.PlanGenerator.generate(6, { record: false });
var gym = p6c.subjects.find(function (sb) { return sb.subject === '健身'; });
t.ok('健身任务 3 次（week6 排期 [5,6,7]）', gym && gym.tasks.length === 3);
t.ok('健身时段 17:00-18:30', gym.tasks.every(function (x) { return x.time === '17:00-18:30'; }));

console.log('\n5. 考试周模式');
fresh();
X.state.data.courses[0].examDate = X.dateOfWeek(6, 4);   // 距第6周周末 3 天 → urgent
var sU = X.StrategyEngine.getDefaultWeeklyStrategy(6);
t.eq('examMode = urgent', sU.examMode, 'urgent');
t.ok('urgent 模式科研 ≤ 0.5h（1.5h × 0.25 后按 0.5h 步长取整）', sU.allocation.find(function (a) { return a.subject === '科研/AI探索'; }).hours <= 0.5);
t.ok('核心课分配上浮（微积分 > 5h）', sU.allocation.find(function (a) { return a.subject === '微积分'; }).hours > 5);

console.log('\n6. GPA Protection Mode');
fresh();
X.state.data.courses[0].risk = 'red';
X.state.data.courses[0].currentScore = 60;
var sR = X.StrategyEngine.getDefaultWeeklyStrategy(6);
t.ok('gpaStatus = red', sR.gpaStatus === 'red');
t.ok('风险课微积分追加复习（>5h）', sR.allocation.find(function (a) { return a.subject === '微积分'; }).hours >= 5);
t.ok('科研降至 Maintenance（≤0.5h）', sR.allocation.find(function (a) { return a.subject === '科研/AI探索'; }).hours <= 0.5);
var pRed = X.PlanGenerator.generate(6, { record: false });
t.ok('RED 模式下计划仍生成且约束 ok', pRed.validation.ok === true);

console.log('\n7. 重新生成保留勾选状态');
fresh();
X.state.data.currentWeekOverride = 6;
var plan = X.ensureWeekPlan(6);
var target = null;
plan.subjects.forEach(function (sb) {
  sb.tasks.forEach(function (x) { if (x.subject === '微积分' && !target) target = x; });
});
X.setTaskStatus(6, target.id, 'done');
var regen = X.PlanGenerator.regenerate(6);
var doneAfter = [];
regen.subjects.forEach(function (sb) { sb.tasks.forEach(function (x) { if (x.status === 'done') doneAfter.push(x.title); }); });
t.ok('重新生成后勾选状态保留（' + doneAfter.join('、') + '）', doneAfter.indexOf(target.title) !== -1);
t.ok('重新生成后约束 ok', regen.validation.ok === true);

console.log('\n8. 预算与战略记录（record=true）');
fresh();
X.PlanGenerator.generate(6);
t.ok('timeBudgets 写入第6周', X.state.data.timeBudgets['6'] && X.state.data.timeBudgets['6'].suggested > 0);
t.ok('weeklyStrategy 写入', X.state.data.weeklyStrategy && X.state.data.weeklyStrategy.week === 6);

t.report();
