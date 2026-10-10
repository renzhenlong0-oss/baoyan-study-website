/* ============================================================
 * render.test.js —— 全页面渲染回归（dummy DOM 下逐一执行所有渲染器）
 * 用法：node test/render.test.js
 * 目的：任何页面渲染函数抛异常都能在这里被抓到，
 *       保证 10 个 Tab + 设置面板在真实浏览器中不会因逻辑错误白屏。
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  clone, DEFAULT_INIT_DATA, state, currentWeek, ensureWeekPlan, getWeekPlan,
  switchTab, setViewWeek, renderDashboard, renderToday, renderWeekPlan,
  renderCourses, renderProgramming, renderResearch, renderEnglish,
  renderCompetition, renderResources, renderReview,
  openSettingsPanel, renderSettingsInto,
  renderSettingsProfile, renderSettingsGoals, renderSettingsPolicies,
  renderSettingsRules, renderSettingsAppearance, renderSettingsData, renderSettingsSync,
  renderVocabCenter,
  VocabEngine,
  setVocabTab: function (v) { vocabTab = v; },
  buildQuizPrompt,
  setVcQuiz: function (q) { vcQuiz = q; },
  renderVocabQuizCard
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 全页面渲染回归测试开始 ===\n');

/* 0. 视图切换语义（用户报告的"每页都有首页内容"回归断言）：
 *   切换 Tab 后，旧视图 hidden=true、新视图 hidden=false（配合 CSS [hidden] 规则） */
function viewEl(id) {
  var m = sandbox.document._mounted;
  for (var i = 0; i < m.length; i++) if (m[i].id === id) return m[i];
  return null;
}
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.viewWeek = 6;
X.switchTab('home');
t.ok('初始：home 可见、today 隐藏', viewEl('view-home').hidden === false && viewEl('view-today').hidden === true);
X.switchTab('today');
t.ok('切到今日：home 隐藏、today 可见', viewEl('view-home').hidden === true && viewEl('view-today').hidden === false);
t.ok('其余视图仍隐藏', ['view-weekplan', 'view-courses', 'view-programming', 'view-research', 'view-english', 'view-competition', 'view-resources', 'view-review']
  .every(function (id) { return viewEl(id).hidden === true; }));
X.switchTab('home');
t.ok('切回首页：home 可见、today 隐藏', viewEl('view-home').hidden === false && viewEl('view-today').hidden === true);

X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.currentWeekOverride = 6;   // 固定第6周（无假期干扰）
X.state.viewWeek = 6;

/* 预生成周计划，模拟真实使用（含执行记录） */
X.ensureWeekPlan(6);

/* 逐 Tab 渲染：任何异常都会导致该断言失败 */
var tabs = [
  ['home', '首页（竞争力工作台）'],
  ['today', '今日（课表/任务/时间轴/复盘）'],
  ['weekplan', '周计划（预算卡/战略卡/科目视图）'],
  ['courses', '课程（GPA模拟器/课表/课程卡）'],
  ['programming', '编程训练（路线/推荐题/错题本）'],
  ['research', '科研（路线图/试错/实验室）'],
  ['english', '英语（CET/打卡/任务）'],
  ['competition', '竞赛（Value Score）'],
  ['resources', '资源库（分类/评估）'],
  ['review', '复盘（每日/每周/趋势）']
];
var failures = 0;
tabs.forEach(function (item) {
  try {
    X.switchTab(item[0]);
    t.ok(item[1] + ' 渲染无异常', true);
  } catch (e) {
    failures++;
    t.ok(item[1] + ' 渲染异常：' + e.message, false);
  }
});

/* 复盘三个子视图 */
try {
  X.renderReview();
  t.ok('复盘子视图（daily）无异常', true);
} catch (e) {
  t.ok('复盘子视图（daily）异常：' + e.message, false);
}

/* v5 词汇中心六个子视图 */
try {
  var vcBox = H.dummyEl();
  ['overview', 'add', 'practice', 'io', 'stats', 'settings'].forEach(function (sub) {
    try {
      X.setVocabTab(sub);
      X.renderVocabCenter(vcBox);
      t.ok('词汇中心子视图 ' + sub + ' 无异常', true);
    } catch (e2) {
      t.ok('词汇中心子视图 ' + sub + ' 异常：' + e2.message, false);
    }
  });
} catch (e) {
  t.ok('词汇中心渲染异常：' + e.message, false);
}

/* v5 词汇中心带数据渲染（含词条/复习记录/会话日志） */
try {
  var box2 = H.dummyEl();
  X.setVocabTab('overview');
  X.VocabEngine.addWord({ word: 'gradient', library: 'ai_robotics', definitions: ['梯度'], examTags: ['CET6'], domainTags: ['AI'], basicMastery: 2 });
  X.VocabEngine.addWord({ word: 'whereas', library: 'academic_english', definitions: ['然而'], basicMastery: 1 });
  ['overview', 'stats', 'practice', 'settings', 'io'].forEach(function (sub) {
    try {
      X.setVocabTab(sub);
      X.renderVocabCenter(box2);
      t.ok('词汇中心（带数据）子视图 ' + sub + ' 无异常', true);
    } catch (e2) {
      t.ok('词汇中心（带数据）子视图 ' + sub + ' 异常：' + e2.message, false);
    }
  });
} catch (e) {
  t.ok('词汇中心带数据渲染异常：' + e.message, false);
}

/* v5 复习练习：五种模式组题 + 练习卡渲染（验收#8 复习练习功能） */
try {
  var w = X.VocabEngine.addWord({
    word: 'gradient', library: 'ai_robotics', definitions: ['梯度'],
    exampleSentence: 'The gradient of the loss function points uphill.',
    collocations: ['gradient descent']
  }).word;
  var modes = ['en2zh', 'zh2en', 'fill', 'colloc', 'wrong'];
  modes.forEach(function (mode) {
    var q = { queue: [w], index: 0, correct: 0, errors: 0, mode: mode, startTs: 1, newLearned: 0 };
    var prompt = X.buildQuizPrompt(q, w);
    t.ok('组题 ' + mode + ' 产出题干', !!prompt.prompt);
    t.ok('组题 ' + mode + ' 产出答案', !!prompt.answer);
    if (prompt.type === 'choice') {
      t.ok('组题 ' + mode + ' 选择题含正确选项', prompt.options.indexOf(prompt.correctOption) !== -1);
    }
  });
  X.setVcQuiz({ queue: [w], index: 0, correct: 0, errors: 0, mode: 'en2zh', startTs: 1, newLearned: 0 });
  var quizCard = X.renderVocabQuizCard(H.dummyEl());
  t.ok('练习卡渲染无异常', !!quizCard);
  X.setVcQuiz(null);
} catch (e) {
  t.ok('练习组题/渲染异常：' + e.message, false);
}

/* 设置面板 */
try {
  X.openSettingsPanel();
  t.ok('设置面板打开无异常', true);
  ['profile', 'goals', 'policies', 'rules', 'appearance', 'data', 'sync'].forEach(function (g) {
    try {
      var body = H.dummyEl();
      /* 直接调用分组渲染（绕过模块态） */
      var renderers = {
        profile: 'renderSettingsProfile',
        goals: 'renderSettingsGoals',
        policies: 'renderSettingsPolicies',
        rules: 'renderSettingsRules',
        appearance: 'renderSettingsAppearance',
        data: 'renderSettingsData',
        sync: 'renderSettingsSync'
      };
      X[renderers[g]](body);
      t.ok('设置分组 ' + g + ' 无异常', true);
    } catch (e) {
      t.ok('设置分组 ' + g + ' 异常：' + e.message, false);
    }
  });
} catch (e) {
  t.ok('设置面板异常：' + e.message, false);
}

/* 空数据状态（新用户首次打开）：每个 Tab 也应正常渲染 */
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.viewWeek = 6;
tabs.forEach(function (item) {
  try {
    X.switchTab(item[0]);
    t.ok(item[1] + '（空数据）渲染无异常', true);
  } catch (e) {
    failures++;
    t.ok(item[1] + '（空数据）渲染异常：' + e.message, false);
  }
});

t.report();
