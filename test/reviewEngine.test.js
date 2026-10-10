/* ============================================================
 * reviewEngine.test.js —— 复盘引擎测试（验收标准#12）
 * 用法：node test/reviewEngine.test.js
 * 覆盖：周复盘读取历史执行数据（镜像优先，周计划重建不丢）、
 *       跳过原因归因、计划过载检测（不归因自律）、效率统计
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  ReviewEngine, clone, DEFAULT_INIT_DATA, state, currentWeek,
  ensureDailyLog, dateOfWeek, setTaskStatus, ensureWeekPlan, getWeekPlan,
  rebuildLegacyWeekPlans
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 复盘引擎测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); X.state.data.currentWeekOverride = 6; }

function putMirror(week, day, subject, hours, status, skipCategory) {
  var ds = X.dateOfWeek(week, day);
  var log = X.ensureDailyLog(ds);
  log.tasksStatus = log.tasksStatus || {};
  log.tasksStatus['m-' + week + '-' + day + '-' + subject + '-' + status] = {
    status: status, note: '', subject: subject, title: subject + '任务', duration: hours,
    skipCategory: skipCategory || ''
  };
}

console.log('1. 历史执行数据来自 dailyLogs 镜像（重建周计划不丢实际时长）');
fresh();
/* 第4周历史：完成 6h + 跳过 1h */
putMirror(4, 1, '微积分', 2.5, 'done');
putMirror(4, 3, '微积分', 2.5, 'done');
putMirror(4, 5, '程序设计', 1, 'done');
putMirror(4, 6, '英语/四级', 1, 'skipped', '疲劳');
var s4 = X.ReviewEngine.computeWeekSummary(4);
t.eq('第4周实际时长 = 6h', s4.actualHours, 6);
t.eq('微积分实际 5h', s4.subjectHoursActual['微积分'], 5);
t.eq('跳过原因"疲劳"计数 1', s4.skipCategories['疲劳'], 1);
/* 模拟周计划重建（v3 计划任务 id 全变）——镜像数据仍可读 */
X.state.data.weekPlans['4'] = {
  weekNumber: 4, engineVersion: 3, subjects: [
    { subject: '微积分', plannedHours: 5, goal: '', tasks: [
      { id: 'new-1', day: 1, time: '19:00-21:30', title: '微积分复习+作业', status: 'todo' }
    ] }
  ]
};
var s4b = X.ReviewEngine.computeWeekSummary(4);
t.eq('重建后镜像实际时长仍 = 6h（历史不丢）', s4b.actualHours, 6);
t.eq('重建后跳过原因统计仍在', s4b.skipCategories['疲劳'], 1);

console.log('\n2. 效率自评与 AI 工具计数（去重）');
fresh();
var ds1 = X.dateOfWeek(5, 1);
var l1 = X.ensureDailyLog(ds1);
l1.checklist.efficiency = 4;
l1.aiToolLog = '用 Claude Code 调试循环题';
var ds2 = X.dateOfWeek(5, 2);
var l2 = X.ensureDailyLog(ds2);
l2.checklist.efficiency = 2;
var s5 = X.ReviewEngine.computeWeekSummary(5);
t.eq('效率均值 = 3', s5.efficiencyAvg, 3);
t.eq('AI 工具使用 = 1 次（不因 aiLogs 同步双计数）', s5.aiToolUsageCount, 1);

console.log('\n3. 计划过载检测（§36：先检查计划，不归因自律）');
fresh();
/* 第5、6周完成率都 ≤60% → 触发过载提示 */
[5, 6].forEach(function (wk) {
  for (var d = 1; d <= 5; d++) {
    putMirror(wk, d, '微积分', 1, 'done');
  }
  for (var d2 = 1; d2 <= 5; d2++) {
    putMirror(wk, d2, '程序设计', 1, 'skipped', '课程太多');
  }
});
var ov = X.ReviewEngine.checkPlanOverload(6);
t.ok('连续低完成率 → overload = true', ov.overload === true);
t.ok('提示语包含"检查计划是否过载"而非"更努力"', ov.message.indexOf('过载') !== -1 && ov.message.indexOf('更努力') !== -1);

console.log('\n4. 偏差分析与归因建议');
fresh();
X.state.data.currentWeekOverride = 6;
X.ensureWeekPlan(6);
putMirror(6, 1, '微积分', 2.5, 'done');
putMirror(6, 3, '程序设计', 1, 'skipped', '难度过高');
var an = X.ReviewEngine.analyzeWeek(6);
t.ok('gaps 含科目级实际 vs 计划', an.gaps.some(function (g) { return g.subject === '微积分' && g.actual === 2.5; }));
t.eq('主要跳过原因 = 难度过高', an.topSkipCategory, '难度过高');
t.ok('归因建议提到"前置"（难度过高 → 检查前置基础）', an.skipAdvice.indexOf('前置') !== -1);
t.ok('计划学时与预算字段齐全', an.plannedHours > 0 && an.budgetPlanned > 0);

t.report();
