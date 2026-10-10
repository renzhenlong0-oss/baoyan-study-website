/* ============================================================
 * smoke.js —— Node 冒烟测试（不入 index.html，纯开发用）
 * 用法：node test/smoke.js
 * 覆盖：数据兼容、v3 计划生成、时间轴合并、AI 建议解析/采纳/撤销、
 *       28h 硬编码移除、v3 数据层、v2→v3 迁移
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('ui/weeklyPlan.js');

const EXPORT_SNIPPET = `{
  mergeData, DEFAULT_INIT_DATA, clone, ensureWeekPlan, getWeekPlan,
  setTaskStatus, deleteTask, saveData, currentWeek,
  todayStr, weekOfDate, dateOfWeek, diffDays, timeToMin, taskHours,
  holidayOfDate, SUBJECT_META, SCHEDULE_ROWS, DAY_NAMES, state,
  findTaskByKey, parseProposal, applyProposal, undoAdopt,
  buildTimelineData, findTimelineRow, getWeekEntries, collectDayTasks, addTaskToPlan,
  runMigration, defaultChecklist, defaultProgrammingState, defaultResearchState,
  stageForWeek, getActivePolicy, competitionValueScore, PROBLEMS,
  PlanGenerator, StrategyEngine, TimeBudgetEngine, GymScheduler, ConstraintEngine
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 冒烟测试开始 ===\n');

/* 1. mergeData 旧数据兼容 */
console.log('1. 旧数据兼容');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
var legacy = {
  userProfile: { name: '旧数据用户' },
  courses: [],
  semester: { totalWeeks: 18 },
  weekPlans: { '3': { weekNumber: 3, subjects: [] } }
};
var merged = X.mergeData(X.clone(X.DEFAULT_INIT_DATA), legacy);
t.ok('旧数据加载后 aiConfig 有默认值', merged.aiConfig && merged.aiConfig.apiKey === '' && merged.aiConfig.model === 'deepseek-chat');
t.ok('旧数据加载后 coverImage 为 null', merged.coverImage === null);
t.ok('旧数据加载后 aiChat.messages 为数组', Array.isArray(merged.aiChat.messages));
t.ok('旧数据 weekPlans 保留', merged.weekPlans['3'] !== undefined);
t.ok('旧数据 userProfile.name 保留', merged.userProfile.name === '旧数据用户');
t.ok('默认数据含 version 5', X.DEFAULT_INIT_DATA.version === 5);
t.ok('v5 默认数据含词汇中心结构', X.DEFAULT_INIT_DATA.vocabCenter && Array.isArray(X.DEFAULT_INIT_DATA.vocabCenter.words));
t.ok('v3 默认数据含编程训练状态', X.DEFAULT_INIT_DATA.programming && X.DEFAULT_INIT_DATA.programming.c.topics.length > 0);
t.ok('v3 默认数据含科研探索状态', X.DEFAULT_INIT_DATA.research && X.DEFAULT_INIT_DATA.research.lab.length === 1);
t.ok('v3 默认数据含题库', Array.isArray(X.PROBLEMS) && X.PROBLEMS.length === 16);
t.ok('题库含 Python 题', X.PROBLEMS.some(function (p) { return p.language === 'Python'; }));

/* 2. v3 计划生成（PlanGenerator） */
console.log('\n2. v3 周计划生成');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
var plan6 = X.ensureWeekPlan(6);
t.ok('计划带 v3 引擎标记', plan6.engineVersion === 3);
t.ok('计划包含预算信息', plan6.budget && plan6.budget.planned > 0);
t.ok('计划包含健身排期 [5,6,7]', JSON.stringify(plan6.gym.days) === '[5,6,7]');
t.ok('科目包含微积分/程序设计/英语/四级/Python/科研', ['微积分', '程序设计', '英语/四级', 'Python', '科研/AI探索'].every(function (s) {
  return plan6.subjects.some(function (sb) { return sb.subject === s; });
}));
t.ok('Python 已进入计划（副线）', plan6.subjects.some(function (sb) { return sb.subject === 'Python' && sb.tasks.length > 0; }));
var studySum = plan6.subjects.reduce(function (s, sb) { return s + (sb.subject === '健身' ? 0 : sb.plannedHours); }, 0);
var budget6 = X.TimeBudgetEngine.computeWeeklyBudget(6);
t.ok('学习类分配 ≤ 时间预算 planned（' + studySum + ' ≤ ' + budget6.planned + '）', studySum <= budget6.planned + 0.15);
t.ok('约束校验通过', plan6.validation && plan6.validation.ok === true);
t.ok('任务不与课表冲突（周一点无 08:00 任务）', !plan6.subjects.some(function (sb) {
  return sb.tasks.some(function (task) { return task.day === 1 && task.time.indexOf('08:00') === 0; });
}));
t.ok('健身任务时段为 17:00-18:30', plan6.subjects.some(function (sb) {
  return sb.subject === '健身' && sb.tasks.every(function (task) { return task.time === '17:00-18:30'; });
}));
/* 军训周：只保留英语碎片 + 复盘 */
var plan2 = X.PlanGenerator.generate(2, { record: false });
t.ok('军训周计划科目仅英语/复盘', plan2.subjects.every(function (sb) { return ['英语/四级', '复盘'].indexOf(sb.subject) !== -1; }));
t.ok('军训周不排健身', !plan2.subjects.some(function (sb) { return sb.subject === '健身'; }));
/* 考试模式：科研削减、核心课加权 */
X.state.data.courses[0].examDate = X.dateOfWeek(6, 5);
var sExam = X.StrategyEngine.getDefaultWeeklyStrategy(6);
t.ok('考试临近 → 科研分配 ≤ 0.8h', sExam.allocation.find(function (a) { return a.subject === '科研/AI探索'; }).hours <= 0.8);
/* GPA Protection：RED → 科研 Maintenance */
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.courses[0].risk = 'red';
var sRed = X.StrategyEngine.getDefaultWeeklyStrategy(6);
t.ok('GPA RED → Protection 风险提示', sRed.gpaStatus === 'red' && sRed.risks.join('').indexOf('Protection') !== -1);
var redResearch = sRed.allocation.find(function (a) { return a.subject === '科研/AI探索'; });
t.ok('RED 模式科研降至 Maintenance（' + redResearch.hours + 'h）', redResearch.hours <= 0.5);

/* 3. findTimelineRow 行归属 */
console.log('\n3. 时间轴行归属');
t.eq('08:00 → am1', X.findTimelineRow(480), 'am1');
t.eq('12:40 → lunch', X.findTimelineRow(760), 'lunch');
t.eq('17:40 → pm2（上一行兜底）', X.findTimelineRow(1060), 'pm2');
t.eq('19:00 → night', X.findTimelineRow(1140), 'night');

/* 4. buildTimelineData 课表+任务合并 */
console.log('\n4. 时间轴合并');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.ensureWeekPlan(6);
var rows6 = X.buildTimelineData(6, 1);
var courseCount = rows6.reduce(function (s, r) { return s + r.courses.length; }, 0);
var taskCount = rows6.reduce(function (s, r) { return s + r.tasks.length; }, 0);
t.ok('week6 周一有课程条目', courseCount >= 3);
t.ok('week6 周一有任务条目', taskCount >= 2);
var lunch6 = rows6.find(function (r) { return r.row.key === 'lunch'; });
t.ok('午休行有英语单词碎片任务', lunch6 && lunch6.tasks.some(function (x) { return x.t.title.indexOf('英语单词') !== -1; }));
var night6 = rows6.find(function (r) { return r.row.key === 'night'; });
t.ok('晚上行有微积分任务', night6 && night6.tasks.some(function (x) { return x.sb.subject === '微积分'; }));

/* 5. parseProposal 五类输入 */
console.log('\n5. AI 建议解析容错');
var p1 = X.parseProposal('分析如下：\n```json\n{"suggestion":"s","reason":"r","actions":[{"op":"add","subject":"微积分","day":3,"time":"20:50-21:30","title":"x"}]}\n```');
t.ok('围栏 JSON 解析成功', p1 && p1.actions.length === 1);
var p2 = X.parseProposal('建议 {"suggestion":"s","actions":[{"op":"delete","day":1,"time":"19:00-21:30","title":"y"}]} 结束');
t.ok('裸 JSON 花括号提取成功', p2 && p2.actions.length === 1 && p2.actions[0].op === 'delete');
t.ok('纯文本无 JSON → null', X.parseProposal('没有任何建议') === null);
t.ok('坏 JSON → null', X.parseProposal('```json\n{bad\n```') === null);
var p5 = X.parseProposal('```json\n{"suggestion":"s","actions":[{"op":"add","subject":"微积分","day":1,"time":"19:00-20:00","title":"ok"},{"op":"bad"},{"op":"delete"}]}\n```');
t.ok('非法 action 剔除并计数', p5 && p5.actions.length === 1 && p5.dropped === 2);

/* 6. applyProposal / undoAdopt（v2 兼容路径，P9 由新协议接管） */
console.log('\n6. AI 采纳与撤销');
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.currentWeekOverride = 6;
X.ensureWeekPlan(6);
var before = X.clone(X.getWeekPlan(6).subjects);
var prop = {
  suggestion: 't', reason: 'r',
  actions: [
    { op: 'add', subject: '程序设计', day: 6, time: '19:00-20:00', title: '测试新增任务', note: '' },
    { op: 'delete', day: 1, time: '12:40-13:30', title: '英语单词+听力（碎片）' }
  ]
};
X.applyProposal(prop);
var after = X.getWeekPlan(6);
t.ok('采纳后快照存在', X.state.data.aiChat.snapshot && X.state.data.aiChat.snapshot.week === 6);
t.ok('新增任务已写入周计划', after.subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === '测试新增任务'; }); }));
t.ok('删除任务已从周计划移除', !after.subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === '英语单词+听力（碎片）' && x.day === 1; }); }));
X.undoAdopt();
var restored = X.getWeekPlan(6);
t.ok('撤销后 subjects 与原快照一致', JSON.stringify(restored.subjects) === JSON.stringify(before));

/* 7. 28h 硬编码已移除 */
console.log('\n7. 28h 硬编码移除');
var refSum = 0;
Object.keys(X.SUBJECT_META).forEach(function (k) { refSum += X.SUBJECT_META[k].refHours; });
t.ok('SUBJECT_META 参考学时总和不再是 28h（实际 ' + Math.round(refSum * 10) / 10 + 'h）', Math.abs(refSum - 28) > 0.01 && refSum <= 20);
t.ok('课程含 v3 扩展字段（gradeBreakdown/examDate）', X.DEFAULT_INIT_DATA.courses[0].gradeBreakdown && 'examDate' in X.DEFAULT_INIT_DATA.courses[0]);
t.ok('用户画像含睡眠与健身偏好', X.DEFAULT_INIT_DATA.userProfile.sleep && X.DEFAULT_INIT_DATA.userProfile.gym);

/* 8. v3 数据层 */
console.log('\n8. v3 数据层');
t.ok('阶段目标 8 学期', X.DEFAULT_INIT_DATA.goals.stages.length === 8);
t.eq('第5周属于大一上阶段', X.stageForWeek(5).id, 's1');
t.eq('第20周属于大一下阶段', X.stageForWeek(20).id, 's2');
t.ok('政策库含校级规则', X.DEFAULT_INIT_DATA.policies.some(function (p) { return p.status === 'school'; }));
t.ok('竞赛 Value Score 公式正确', X.competitionValueScore({ baoyanValue: 3, techValue: 4, directionMatch: 3, outcomeValue: 2, timeCost: 3 }) === 9);
t.ok('资源库含赵凤军实验室入口', X.DEFAULT_INIT_DATA.resources.some(function (r) { return r.id === 'res-zhao-lab' && r.type === 'lab'; }));

/* 9. v2 → v3 迁移 */
console.log('\n9. 数据迁移');
var v2 = X.clone(X.DEFAULT_INIT_DATA);
delete v2.version;
delete v2.goals; delete v2.policies; delete v2.resources; delete v2.programming;
delete v2.research; delete v2.competitions; delete v2.weeklyStrategy;
delete v2.timeBudgets; delete v2.snapshots;
v2.roadmap = { '循环': { topics: { '循环': true } } };
v2.aiChat = { messages: [], snapshot: { week: 5, subjects: [{ subject: '微积分' }], createdAt: '2026-10-01T00:00:00Z' } };
v2.dailyLogs = { '2026-10-05': { checklist: { vocabCount: 20 } } };
X.runMigration(v2);
t.eq('迁移后 version=5', v2.version, 5);
t.ok('迁移后 goals/policies/resources 有默认值', v2.goals && v2.policies && v2.resources && v2.programming);
t.ok('旧 C 路线图勾选迁移为编程进度', v2.programming.c.topics.some(function (x) { return x.id === 'c-loop' && x.status === 'done'; }));
t.ok('旧 AI 快照迁入 snapshots', v2.snapshots.length === 1 && v2.snapshots[0].source === 'migration' && v2.aiChat.snapshot === null);
t.ok('旧 checklist 补齐 v3 字段且保留旧值', v2.dailyLogs['2026-10-05'].checklist.vocabCount === 20 && 'efficiency' in v2.dailyLogs['2026-10-05'].checklist);

t.report();
