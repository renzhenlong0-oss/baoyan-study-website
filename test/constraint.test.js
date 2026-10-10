/* ============================================================
 * constraint.test.js —— 硬约束校验引擎测试
 * 用法：node test/constraint.test.js
 * 覆盖（验收标准 §58）：课程冲突、时间冲突、睡眠冲突、超预算、
 *       健身冲突、AI 非法 Action、任务依赖、假期、日负荷
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('core/timeBudgetEngine.js', 'core/gymScheduler.js', 'core/constraintEngine.js');

const EXPORT_SNIPPET = `{
  ConstraintEngine, TimeBudgetEngine, GymScheduler, clone, DEFAULT_INIT_DATA, state,
  currentWeek, dateOfWeek, ensureWeekPlan, getWeekPlan
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 约束引擎测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }
function hasCode(errors, code) { return errors.some(function (e) { return e.code === code; }); }

console.log('1. 时间格式与日期');
fresh();
t.ok('时间格式无效 → BAD_TIME', hasCode(X.ConstraintEngine.validateTask({ day: 1, time: '19:00', title: 'x', subject: '微积分' }, { week: 3 }).errors, 'BAD_TIME'));
t.ok('结束早于开始 → BAD_TIME', hasCode(X.ConstraintEngine.validateTask({ day: 1, time: '21:00-19:00', title: 'x', subject: '微积分' }, { week: 3 }).errors, 'BAD_TIME'));
t.ok('日期越界 → BAD_DAY', hasCode(X.ConstraintEngine.validateTask({ day: 9, time: '19:00-20:00', title: 'x', subject: '微积分' }, { week: 3 }).errors, 'BAD_DAY'));

console.log('\n2. 课程冲突（按节次精确计算）');
fresh();
t.ok('week3 周一 08:00-08:45 与微积分课冲突', hasCode(X.ConstraintEngine.validateTask({ day: 1, time: '08:00-08:45', title: '自习', subject: '微积分' }, { week: 3 }).errors, 'CLASS_CONFLICT'));
t.ok('week3 周二 10:50-12:00 不冲突（近现代史 3 节 10:45 下课）',
  !hasCode(X.ConstraintEngine.validateTask({ day: 2, time: '10:50-12:00', title: '整理笔记', subject: '中国近现代史' }, { week: 3 }).errors, 'CLASS_CONFLICT'));
t.ok('week3 周一 18:00-19:00 不冲突（体育课 17:40 结束）',
  !hasCode(X.ConstraintEngine.validateTask({ day: 1, time: '18:00-19:00', title: '健身', subject: '健身' }, { week: 3 }).errors, 'CLASS_CONFLICT'));

console.log('\n3. 睡眠硬约束（23:30 睡 / 22:30 后不高认知）');
fresh();
t.ok('22:00-23:45 超过就寝时间 → SLEEP',
  hasCode(X.ConstraintEngine.validateTask({ day: 3, time: '22:00-23:45', title: '自习', subject: '微积分' }, { week: 3 }).errors, 'SLEEP'));
t.ok('22:30 起学新章节数学 → NIGHT_COG 警告',
  hasCode(X.ConstraintEngine.validateTask({ day: 3, time: '22:30-23:20', title: '微积分新章节', subject: '微积分' }, { week: 3 }).warnings, 'NIGHT_COG'));
t.ok('22:30 起背单词 → 无 NIGHT_COG',
  !hasCode(X.ConstraintEngine.validateTask({ day: 3, time: '22:30-23:20', title: '英语单词复习', subject: '英语/四级' }, { week: 3 }).warnings, 'NIGHT_COG'));

console.log('\n4. 任务重叠与日负荷');
fresh();
var overlap = X.ConstraintEngine.validateTask(
  { day: 3, time: '19:30-21:00', title: '新任务', subject: '微积分' },
  { week: 3, existingTasks: [{ day: 3, time: '19:00-21:30', title: '微积分复习', subject: '微积分' }] });
t.ok('与已有任务重叠 → TASK_OVERLAP', hasCode(overlap.errors, 'TASK_OVERLAP'));
fresh();
var heavy = X.ConstraintEngine.validateTask(
  { day: 3, time: '19:00-20:30', title: '加时任务', subject: '微积分' },
  { week: 3, existingTasks: [
    { day: 3, time: '12:40-13:30', title: '单词', subject: '英语/四级' },
    { day: 3, time: '20:45-21:30', title: 'C语言', subject: '程序设计' },
    { day: 3, time: '21:30-22:30', title: '自习', subject: '综合' }
  ] });
t.ok('当日学习负荷 4.58h > 上限 4h → DAILY_CAP', hasCode(heavy.errors, 'DAILY_CAP'));

console.log('\n5. 健身冲突');
fresh();
var gymBad = X.ConstraintEngine.validateTask({ day: 1, time: '17:00-18:30', title: '健身', subject: '健身' }, { week: 6 });
t.ok('非排期日健身 → GYM_DAY（周一有体育课）', hasCode(gymBad.errors, 'GYM_DAY'));
var gymOk = X.ConstraintEngine.validateTask({ day: 5, time: '17:00-18:30', title: '健身', subject: '健身' }, { week: 6 });
t.ok('排期日健身无错误（' + JSON.stringify(gymOk.errors) + '）', gymOk.errors.length === 0);

console.log('\n6. 假期与任务依赖');
fresh();
var hol = X.ConstraintEngine.validateTask({ day: 1, time: '19:00-20:00', title: '自习', subject: '微积分' }, { week: 5 });
t.ok('week5 周一（国庆假期）→ HOLIDAY', hasCode(hol.errors, 'HOLIDAY'));
fresh();
t.ok('c-loop 未完成 → c-array 任务 PREREQ',
  hasCode(X.ConstraintEngine.validateTask({ day: 6, time: '14:00-15:00', title: '数组练习', subject: '程序设计', topicId: 'c-array' }, { week: 3 }).errors, 'PREREQ'));
X.state.data.programming.c.topics.forEach(function (tp) { if (tp.id === 'c-loop') tp.status = 'done'; });
t.ok('c-loop 完成后 c-array 任务无 PREREQ',
  !hasCode(X.ConstraintEngine.validateTask({ day: 6, time: '14:00-15:00', title: '数组练习', subject: '程序设计', topicId: 'c-array' }, { week: 3 }).errors, 'PREREQ'));

console.log('\n7. 周预算与整周校验');
fresh();
var fakePlan = {
  weekNumber: 3,
  subjects: [
    { subject: '微积分', plannedHours: 6, goal: '', tasks: [
      { id: 'a1', day: 1, time: '19:00-21:30', title: '微积分1', status: 'todo' },
      { id: 'a2', day: 3, time: '19:00-21:30', title: '微积分2', status: 'todo' },
      { id: 'a3', day: 6, time: '09:00-12:00', title: '微积分3', status: 'todo' }
    ] },
    { subject: '程序设计', plannedHours: 4, goal: '', tasks: [
      { id: 'a4', day: 5, time: '19:00-21:00', title: 'C语言', status: 'todo' },
      { id: 'a5', day: 7, time: '14:00-16:00', title: 'C语言2', status: 'todo' }
    ] }
  ]
};
var over = X.ConstraintEngine.validatePlan(fakePlan, { budget: { planned: 9, suggested: 10, buffer: 1 } });
t.ok('周计划 12h > 预算 9h → WEEK_BUDGET', hasCode(over.errors, 'WEEK_BUDGET'));
t.eq('总学习时长 12h', over.totalHours, 12);
var okPlan = { weekNumber: 3, subjects: [
  { subject: '微积分', plannedHours: 4, goal: '', tasks: [
    { id: 'b1', day: 1, time: '19:00-21:00', title: '微积分1', status: 'todo' },
    { id: 'b2', day: 4, time: '19:00-21:00', title: '微积分2', status: 'todo' }
  ] }
] };
t.ok('4h 任务在 9h 预算内 → ok', X.ConstraintEngine.validatePlan(okPlan, { budget: { planned: 9, suggested: 10, buffer: 1 } }).ok === true);

console.log('\n8. AI 提议校验（拒绝非法 Action）');
fresh();
/* 用一个符合预算的干净周计划（v2 遗留模板超预算，会干扰提议校验） */
X.state.data.weekPlans['6'] = { weekNumber: 6, engineVersion: 3, subjects: [
  { subject: '微积分', plannedHours: 4, goal: '', tasks: [
    { id: 'c1', day: 1, time: '19:00-21:00', title: '微积分复习', status: 'todo' },
    { id: 'c2', day: 3, time: '20:45-21:30', title: '微积分练习', status: 'todo' }
  ] }
] };
var okProp = { actions: [
  { type: 'add', subject: '程序设计', day: 5, time: '19:00-20:00', title: 'C练习' },
  { type: 'reallocate', from: '微积分', to: '程序设计', hours: 1 }
] };
var r1 = X.ConstraintEngine.validateProposal(okProp, 6);
t.ok('合法提议通过（add + reallocate），' + JSON.stringify(r1.errors), r1.ok === true);
var badProp = { actions: [
  { type: 'add', subject: '微积分', day: 1, time: '08:00-08:45', title: '与课冲突' },
  { type: 'explode' }
] };
var r2 = X.ConstraintEngine.validateProposal(badProp, 6);
t.ok('与课表冲突的 add → 拒绝', !r2.ok && hasCode(r2.errors, 'CLASS_CONFLICT'));
t.ok('非法 Action 类型 → BAD_ACTION', hasCode(r2.errors, 'BAD_ACTION'));
var r3 = X.ConstraintEngine.validateProposal({ actions: [{ type: 'reallocate', from: '微积分', to: '英语/四级', hours: 99 }] }, 6);
t.ok('reallocate 超出来源科目学时 → 拒绝', !r3.ok && hasCode(r3.errors, 'REALLOC_OVER'));
var r4 = X.ConstraintEngine.validateProposal({ actions: [{ type: 'delete', day: 9, time: '00:00-01:00', title: '不存在' }] }, 6);
t.ok('删除不存在的任务 → DELETE_MISS', hasCode(r4.errors, 'DELETE_MISS'));

t.report();
