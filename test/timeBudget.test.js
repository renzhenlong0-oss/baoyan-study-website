/* ============================================================
 * timeBudget.test.js —— 时间预算引擎 + 健身排期测试
 * 用法：node test/timeBudget.test.js
 * 覆盖：理论可用计算、历史实际锚定、执行率调整、Buffer≥10%、
 *       考试周作业上浮、健身排期（课少日优先/冲突排除/分散）
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('core/timeBudgetEngine.js', 'core/gymScheduler.js');

const EXPORT_SNIPPET = `{
  TimeBudgetEngine, GymScheduler, clone, DEFAULT_INIT_DATA, state, currentWeek,
  dateOfWeek, todayStr, fmtISODate, parseDate, getWeekEntries,
  timeToMin, taskHours, ensureDailyLog
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 时间预算引擎测试开始 ===\n');

/* 在指定周的某天写入一条 done 镜像（模拟历史执行数据） */
function putMirror(week, day, hours, status) {
  var ds = X.dateOfWeek(week, day);
  var log = X.ensureDailyLog(ds);
  log.tasksStatus = log.tasksStatus || {};
  log.tasksStatus['mir-' + week + '-' + day + '-' + (status || 'done')] = {
    status: status || 'done', note: '', subject: '测试', title: '测试任务', duration: hours
  };
}

console.log('1. 上课时长与理论可用');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
/* week3 周五（9-25）恰逢中秋节 → 周五课程被假期过滤：1305 - 90 = 1215min = 20.25 → 20.3h */
t.eq('week3 上课时长 20.3h（按节次精确计算，周五为中秋节假期已剔除）', X.TimeBudgetEngine.classHoursOfWeek(3), 20.3);

var b3 = X.TimeBudgetEngine.computeWeeklyBudget(3);
/* 健身候选仅剩周四（周五六日为中秋假期）→ 1 次 × 1.5h */
t.ok('week3 理论可用 = 112 - 20.3 - 8 - 10.5 - 14 - 1.5 = 57.7h',
  Math.abs(b3.theoretical - 57.7) < 0.01);
t.eq('无历史数据 → 历史实际锚定 18h（用户真实能力）', b3.historicalAvg, 18);
t.eq('建议值 = min(理论, 历史实际) = 18h（不是 28h）', b3.suggested, 18);
t.eq('planned = 18 - buffer(2) = 16h', b3.planned, 16);
t.eq('Buffer = max(1, 12%×18) = 2h（≥10%）', b3.buffer, 2);
t.ok('planned ≤ suggested × 90%（不为零排满）', b3.planned <= b3.suggested * 0.9 + 0.01);
t.ok('suggested 不高于 theoretical', b3.suggested <= b3.theoretical);

console.log('\n2. 历史实际数据参与计算');
var b5 = X.TimeBudgetEngine.computeWeeklyBudget(5);
/* week5 国庆假期周一~三（10-05~07）；周四（10-08）为上班日：
   上课 7.5h（周四程设+专业英语+程设实验 4.5h、周五微积分+程设 3h），
   周四晚间有实验课被健身排除 → 健身 [5,6,7] 共 4.5h
   → 理论 = 112 − 7.5 − 8 − 10.5 − 14 − 4.5 = 67.5h */
t.ok('week5（国庆周一~三假期）理论可用为 67.5h', Math.abs(b5.theoretical - 67.5) < 0.01);
/* 写入近两周执行数据：week3 实际 14h、week4 实际 6h → 均值 10h */
putMirror(3, 1, 2.5); putMirror(3, 3, 2.5); putMirror(3, 5, 2.5); putMirror(3, 6, 3); putMirror(3, 7, 3.5);
putMirror(4, 2, 2); putMirror(4, 4, 2); putMirror(4, 6, 2);
var b5h = X.TimeBudgetEngine.computeWeeklyBudget(5);
t.eq('历史平均 = (14 + 6) / 2 = 10h', b5h.historicalAvg, 10);
t.eq('建议值 = min(理论 72, 历史 10) = 10h', b5h.suggested, 10);
t.eq('planned = 10 - 1 = 9h', b5h.planned, 9);
t.ok('Buffer ≥ 1h', b5h.buffer >= 1);

console.log('\n3. 近期执行率调整');
/* 近14天内 10 条 done + 10 条 skipped → 执行率 0.5 → 建议值下调 */
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
var today = X.parseDate(X.todayStr());
for (var i = 0; i < 6; i++) {
  var d = X.parseDate(X.todayStr());
  d.setDate(d.getDate() - i);
  var log = X.ensureDailyLog(X.fmtISODate(d));
  log.tasksStatus = log.tasksStatus || {};
  for (var j = 0; j < 4; j++) {
    log.tasksStatus['r' + i + '-' + j + '-d'] = { status: 'done', duration: 1, subject: '测试', title: 'x', note: '' };
    log.tasksStatus['r' + i + '-' + j + '-s'] = { status: 'skipped', duration: 1, subject: '测试', title: 'x', note: '' };
  }
}
t.eq('近7天执行率 = 0.5', X.TimeBudgetEngine.recentExecutionRate({}), 0.5);
var bRate = X.TimeBudgetEngine.computeWeeklyBudget(5, { fallbackRate: 0.5 });
t.eq('执行率 0.5 → 建议值 = 18 × (0.5/0.75) = 12h', bRate.suggested, 12);
t.ok('建议值不低于下限 10h', bRate.suggested >= 10);

console.log('\n4. 考试临近作业上浮');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.courses[0].examDate = X.dateOfWeek(6, 5);   // 距第5周末 ≤14 天
var bExam = X.TimeBudgetEngine.computeWeeklyBudget(5);
t.ok('考试临近 → examProximity = true', bExam.examProximity === true);
t.eq('作业刚性需求上浮 30%：8 → 10.4h', bExam.breakdown.homeworkH, 10.4);
t.ok('理论可用相应下降', bExam.theoretical < 67.5);
X.state.data.courses[0].examDate = X.dateOfWeek(15, 1);
t.ok('考试较远 → examProximity = false', X.TimeBudgetEngine.computeWeeklyBudget(5).examProximity === false);

console.log('\n5. 健身排期（GymScheduler）');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
var g3 = X.GymScheduler.pickGymDays(3);
/* week3：周一有体育课、周二晚国安、周三晚语文、周五六日为中秋节假期 → 仅剩周四 */
t.eq('week3 排期日 = [4]（周一体育课/周二三晚课/周五六日中秋假期均被排除）', JSON.stringify(g3.days), '[4]');
t.eq('健身窗口 = 17:00-18:30（endBy 18:30 - 90min）', g3.time, '17:00-18:30');
t.ok('周一排除原因：体育课', (g3.excluded[1] || '').indexOf('体育') !== -1);
t.ok('周二排除原因：晚间有课', (g3.excluded[2] || '').indexOf('晚间') !== -1);
t.ok('周五排除原因：中秋节假期', (g3.excluded[5] || '').indexOf('假期') !== -1);
var g2 = X.GymScheduler.pickGymDays(2);
t.eq('军训周（week2）不排健身', g2.days.length, 0);
/* week6（10-12~10-18，无假期）：周一体育课、周二~四晚课被排除 → 候选周五六日，选满 3 天 */
var g6 = X.GymScheduler.pickGymDays(6);
t.eq('week6 排期日 = [5,6,7]（课少的三天）', JSON.stringify(g6.days), '[5,6,7]');
var g5 = X.GymScheduler.pickGymDays(5);
t.ok('国庆假期周健身日不落假期（' + JSON.stringify(g5.days) + '，10-08 起为上班日）', g5.days.every(function (d) { return d >= 4; }));

console.log('\n6. 预算记录写入');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
var rec = X.TimeBudgetEngine.computeWeeklyBudget(3);
X.TimeBudgetEngine.recordForWeek(3, rec);
t.ok('预算记录写入 timeBudgets', X.state.data.timeBudgets['3'] && X.state.data.timeBudgets['3'].suggested === 18);

t.report();
