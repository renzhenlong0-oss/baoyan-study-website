/* ============================================================
 * competitiveness.test.js —— 竞争力引擎测试
 * 用法：node test/competitiveness.test.js
 * 覆盖：六维计算（真实数据驱动）、Top3 建议、不产出假概率、
 *       GPA 风险对学业维度的影响、编程/英语/执行维度的数据反馈
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  CompetitivenessEngine, clone, DEFAULT_INIT_DATA, state, currentWeek,
  ensureDailyLog, dateOfWeek, todayStr, parseDate, fmtISODate
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 竞争力引擎测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }

function putMirror(dateStr, status, duration) {
  var log = X.ensureDailyLog(dateStr);
  log.tasksStatus = log.tasksStatus || {};
  log.tasksStatus['c-' + dateStr + '-' + status] = { status: status, duration: duration || 1, subject: '测试', title: 'x', note: '' };
}

console.log('1. 空数据状态（如实反映，不编造）');
fresh();
var c0 = X.CompetitivenessEngine.compute();
t.ok('六维齐全', ['academic', 'research', 'programming', 'english', 'competition', 'execution']
  .every(function (k) { return typeof c0.dimensions[k].score === 'number'; }));
t.ok('分数范围 0-100', Object.keys(c0.dimensions).every(function (k) {
  var s = c0.dimensions[k].score;
  return s >= 0 && s <= 100;
}));
t.ok('说明包含"不是概率预测"（不伪造保研概率）', c0.note.indexOf('概率') !== -1 && c0.note.indexOf('状态条') !== -1);
t.ok('空数据时执行维度如实提示数据不足', c0.dimensions.execution.items.some(function (s) { return s.indexOf('不足') !== -1; }));
t.ok('竞赛维度空时说明低优先级符合策略', c0.dimensions.competition.items.some(function (s) { return s.indexOf('低') !== -1; }));

console.log('\n2. GPA 模拟与课程风险 → 学业维度');
fresh();
X.state.data.gpaSimulation = { scores: { calc: 92, english: 88, cprogramming: 85 }, gpa: 3.7, savedAt: 'x' };
var c1 = X.CompetitivenessEngine.compute();
t.ok('有 GPA 模拟后学业分数 > 0', c1.dimensions.academic.score > 0);
t.ok('学业明细含 GPA 模拟', c1.dimensions.academic.items.some(function (s) { return s.indexOf('GPA') !== -1; }));
X.state.data.courses[0].risk = 'red';
var c2 = X.CompetitivenessEngine.compute();
t.ok('风险课程使学业分数下降（' + c1.dimensions.academic.score + ' → ' + c2.dimensions.academic.score + '）',
  c2.dimensions.academic.score < c1.dimensions.academic.score);
t.ok('学业明细列出风险课程', c2.dimensions.academic.items.some(function (s) { return s.indexOf('风险课程') !== -1; }));

console.log('\n3. 编程维度（进度 + 提交正确率）');
fresh();
var c3 = X.CompetitivenessEngine.compute();
t.ok('C 进度（2 done/10 知识点）反映在编程分数', c3.dimensions.programming.score >= 5 && c3.dimensions.programming.score <= 30);
X.state.data.programming.c.topics.forEach(function (tp) {
  if (['c-loop', 'c-array', 'c-func', 'c-pointer', 'c-struct', 'c-file', 'c-ds'].indexOf(tp.id) !== -1) tp.status = 'done';
});
X.state.data.programming.submissions = [
  { problemId: 'c-io-01', status: 'correct', ts: 'x' },
  { problemId: 'c-if-01', status: 'correct', ts: 'x' },
  { problemId: 'c-loop-01', status: 'wrong', ts: 'x' }
];
var c4 = X.CompetitivenessEngine.compute();
t.ok('完成进度+提交后编程分数上升（' + c3.dimensions.programming.score + ' → ' + c4.dimensions.programming.score + '）',
  c4.dimensions.programming.score > c3.dimensions.programming.score);

console.log('\n4. 英语维度（打卡数据）');
fresh();
for (var i = 0; i < 10; i++) {
  var d = X.parseDate(X.todayStr());
  d.setDate(d.getDate() - i);
  var log = X.ensureDailyLog(X.fmtISODate(d));
  log.checklist.vocabCount = 30;
  log.checklist.listeningMinutes = 15;
}
var c5 = X.CompetitivenessEngine.compute();
t.ok('坚持打卡后英语分数接近满分（' + c5.dimensions.english.score + '）', c5.dimensions.english.score >= 55);

console.log('\n5. 执行稳定性（完成率）');
fresh();
for (var j = 0; j < 7; j++) {
  var dd = X.parseDate(X.todayStr());
  dd.setDate(dd.getDate() - j);
  putMirror(X.fmtISODate(dd), j % 2 === 0 ? 'done' : 'skipped');
}
var c6 = X.CompetitivenessEngine.compute();
t.ok('有执行记录后执行分数 > 0', c6.dimensions.execution.score > 0);

console.log('\n6. Top3 提升建议');
fresh();
var c7 = X.CompetitivenessEngine.compute();
t.ok('给出 1-3 条提升建议', c7.topImprovements.length >= 1 && c7.topImprovements.length <= 3);
t.ok('每条建议含维度名与建议文本', c7.topImprovements.every(function (tp) {
  return tp.label && tp.advice && tp.advice.length > 10;
}));

t.report();
