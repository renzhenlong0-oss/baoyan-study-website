/* ============================================================
 * programming.test.js —— 编程训练中心引擎测试
 * 用法：node test/programming.test.js
 * 覆盖（验收标准 §58）：题目结构完整、提交记录保存、知识点动态进度、
 *       自动解锁、错题保存与移除、错误模式检测→专项推荐、推荐算法、提示梯子
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();
files.push('ui/programming.js');

const EXPORT_SNIPPET = `{
  ProgrammingEngine, PROBLEMS, C_CURRICULUM, PYTHON_CURRICULUM,
  clone, DEFAULT_INIT_DATA, state
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 编程训练引擎测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }

console.log('1. 题目结构（§21）');
t.ok('C 题库 10 题', X.PROBLEMS.filter(function (p) { return p.language === 'C'; }).length === 10);
t.ok('Python 题库 6 题', X.PROBLEMS.filter(function (p) { return p.language === 'Python'; }).length === 6);
t.ok('题目字段完整（id/language/topic/difficulty/description/input/output/examples/tags/source）',
  X.PROBLEMS.every(function (p) {
    return p.id && p.language && p.topic && p.difficulty &&
      p.description && p.input && p.output && Array.isArray(p.examples) &&
      Array.isArray(p.tags) && p.source;
  }));
t.ok('难度为 ★~★★★★★', X.PROBLEMS.every(function (p) { return /^★{1,5}$/.test(p.difficulty); }));
t.ok('每道题带四级提示梯子', X.PROBLEMS.every(function (p) {
  var ladder = X.ProgrammingEngine.getHintLadder(p);
  return ladder.length === 4 && ladder[3].last === true;
}));

console.log('\n2. 提交记录与知识点动态进度');
fresh();
X.ProgrammingEngine.submit('c-loop-01', 'correct');
var cur1 = X.ProgrammingEngine.getTopic('C', 'c-loop');
t.ok('第 1 次正确提交后 c-loop 仍为 inProgress（需 2 次 mastery）', cur1.status === 'inProgress');
X.ProgrammingEngine.submit('c-loop-02', 'correct');
var cur2 = X.ProgrammingEngine.getTopic('C', 'c-loop');
t.eq('第 2 次正确提交后 c-loop → done', cur2.status, 'done');
var arr = X.ProgrammingEngine.getTopic('C', 'c-array');
t.eq('c-loop done 后 c-array 自动解锁 → inProgress', arr.status, 'inProgress');
t.ok('提交记录已保存（2 条）', X.state.data.programming.submissions.length === 2);
t.ok('提交记录带 id/status/ts 字段', X.state.data.programming.submissions.every(function (s) { return s.id && s.status && s.ts; }));

console.log('\n3. 错题本');
fresh();
X.ProgrammingEngine.submit('c-loop-01', 'wrong', '循环');
t.ok('错误提交进入错题本', X.state.data.programming.wrongBook.length === 1);
X.ProgrammingEngine.submit('c-loop-01', 'correct');
t.ok('正确通过后自动移出错题本', X.state.data.programming.wrongBook.length === 0);

console.log('\n4. 错误模式检测与专项训练（§22）');
fresh();
X.ProgrammingEngine.submit('c-loop-01', 'wrong', '边界');
X.ProgrammingEngine.submit('c-loop-02', 'wrong', '边界');
X.ProgrammingEngine.submit('c-loop-03', 'wrong', '边界');
var pattern = X.ProgrammingEngine.detectErrorPatterns();
t.ok('连续 3 次"边界"错误 → 触发专项', pattern && pattern.errorType === '边界' && pattern.streak === 3);
var rec = X.ProgrammingEngine.recommendProblem('C');
t.ok('专项训练优先推荐（special=true）', rec.special === true);
X.ProgrammingEngine.submit('c-loop-01', 'correct');
t.ok('答对后模式中断', X.ProgrammingEngine.detectErrorPatterns() === null);

console.log('\n5. 推荐算法（§21：当前知识点 → 错题复做 → 难度递增）');
fresh();
var r1 = X.ProgrammingEngine.recommendProblem('C');
t.eq('初始推荐当前知识点 c-loop 的题', r1.problem.topic, 'c-loop');
X.ProgrammingEngine.submit('c-loop-02', 'wrong', '语法');
var r2 = X.ProgrammingEngine.recommendProblem('C');
t.ok('有错题时优先复做', r2.wrongRetry === true && r2.problem.id === 'c-loop-02');
fresh();
X.ProgrammingEngine.submit('py-basics-01', 'wrong', '语法');
var r3 = X.ProgrammingEngine.recommendProblem('Python');
t.eq('Python 错题复做', r3.problem.id, 'py-basics-01');
fresh();
var r4 = X.ProgrammingEngine.recommendProblem('Python');
t.eq('Python 初始推荐基础语法题', r4.problem.topic, 'py-basics');
t.ok('Python 不会推荐锁定阶段的题（NumPy/PyTorch）', ['py-numpy', 'py-torch'].indexOf(r4.problem.topic) === -1);

console.log('\n6. 统计');
fresh();
X.ProgrammingEngine.submit('c-io-01', 'correct');
X.ProgrammingEngine.submit('c-if-01', 'wrong', '条件');
var stats = X.ProgrammingEngine.stats();
t.eq('已通过 1 题', stats.solved, 1);
t.eq('提交 2 次 / 正确率 50%', stats.submissions === 2 && stats.correctRate === 50, true);

t.report();
