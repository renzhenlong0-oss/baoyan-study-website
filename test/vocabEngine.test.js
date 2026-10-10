/* ============================================================
 * vocabEngine.test.js —— 个人英语词汇中心引擎测试（v5）
 * 用法：node test/vocabEngine.test.js
 * 覆盖：规范化/查重、三词库与语境分别追踪、多标签、导入预览/
 *       确认（重复导入不重复建词）、CSV/JSON 无损往返、复习调度
 *       与掌握度、每日时间预算（20–25 分钟）、学习统计、会话记录
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  VocabEngine, clone, DEFAULT_INIT_DATA, state, saveData, todayStr, parseDate,
  VOCAB_LIBRARIES, VOCAB_LIBRARY_KEYS, newVocabWord, VOCAB_LIMITS
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 词汇引擎测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); }
function count() { return X.state.data.vocabCenter.words.length; }

console.log('1. 词形规范化与查重键');
t.eq('去首尾空格 + 小写', X.VocabEngine.normalizeWord('  Embodied AI  '), 'embodied ai');
t.eq('连续空白折叠', X.VocabEngine.normalizeWord('machine   learning'), 'machine learning');
t.ok('短语内部空格保留（take over ≠ takeover）',
  X.VocabEngine.normalizeWord('take over') !== X.VocabEngine.normalizeWord('takeover'));
t.eq('查重键 = 词形+词库', X.VocabEngine.dedupKey('embodiment', 'ai_robotics'), 'embodiment||ai_robotics');

console.log('\n2. 新增词条与语境追踪');
fresh();
var r1 = X.VocabEngine.addWord({ word: 'Embodiment', library: 'ai_robotics', definitions: ['具身；体现'] });
t.ok('新增成功', r1.ok && !r1.duplicate);
t.eq('词形规范化入库', r1.word.normalizedWord, 'embodiment');
t.ok('seed.library 生成语境条目', X.VocabEngine.contextOf(r1.word, 'ai_robotics') !== null);
t.ok('语境初始掌握度为 0（不从基础继承）', X.VocabEngine.contextOf(r1.word, 'ai_robotics').mastery.level === 0);

var r1b = X.VocabEngine.addWord({ word: '  EMBODIMENT ', library: 'ai_robotics', definitions: ['再次导入'] });
t.ok('同词同词库 → 查重（大小写/空格不敏感）', r1b.duplicate === true);
t.eq('重复添加不新建词条', count(), 1);
t.ok('重复导入不覆盖已有释义', r1b.word.definitions[0].text === '具身；体现' && r1b.word.definitions.length === 1);

/* 同一单词不同词库 → 合并语境，分别追踪 */
var r2 = X.VocabEngine.addWord({ word: 'embodiment', library: 'academic_english', sense: '体现（学术语境）' });
t.ok('同词不同词库 → 合并语境不重复建词条', r2.ok && r2.mergedContexts.length === 1 && count() === 1);
t.ok('academic_english 语境已追加且掌握度为 0', X.VocabEngine.contextOf(r1.word, 'academic_english').mastery.level === 0);

console.log('\n3. 多标签与字段完整性');
var r3 = X.VocabEngine.addWord({
  word: 'gradient', library: 'ai_robotics',
  definitions: ['梯度'], phonetic: '/ˈɡreɪdiənt/', partOfSpeech: 'n.',
  examTags: ['CET6', 'IELTS', '考研'], domainTags: ['AI', 'ML'],
  sourceType: 'paper', sourceTitle: 'Attention Is All You Need',
  sourceExcerpt: 'gradient descent', difficulty: 4, notes: '反向传播核心'
});
t.ok('多考试标签保存', r3.word.examTags.length === 3 && r3.word.examTags.indexOf('IELTS') !== -1);
t.ok('多专业标签保存', r3.word.domainTags.indexOf('AI') !== -1 && r3.word.domainTags.indexOf('ML') !== -1);
t.ok('来源字段完整（paper/标题/摘录）',
  r3.word.sourceType === 'paper' && r3.word.sourceTitle === 'Attention Is All You Need' && r3.word.sourceExcerpt === 'gradient descent');
t.ok('难易度/备注保存', r3.word.difficulty === 4 && r3.word.notes === '反向传播核心');

console.log('\n4. 掌握度与语境分离（验收#4）');
fresh();
X.VocabEngine.addWord({ word: 'feature', library: 'general_advanced', definitions: ['特征；容貌'], basicMastery: 4 });
var fw = X.VocabEngine.findWord('feature', 'general_advanced');
X.VocabEngine.addWord({ word: 'feature', library: 'ai_robotics', sense: '特征（机器学习输入变量）' });
var fw2 = X.VocabEngine.findWord('feature', 'ai_robotics');
t.ok('基础词义已掌握（basicMastery=4）', fw.basicMastery.level === 4);
t.ok('AI 语境新词义掌握度为 0（不因基础词义掌握而自动掌握）',
  X.VocabEngine.contextOf(fw2, 'ai_robotics').mastery.level === 0);
X.VocabEngine.recordReview(fw2.id, { library: 'ai_robotics', correct: true });
t.ok('AI 语境复习答对 → 语境掌握度+1', X.VocabEngine.contextOf(fw2, 'ai_robotics').mastery.level === 1);
t.ok('语境复习不影响基础掌握度', fw2.basicMastery.level === 4);
X.VocabEngine.recordReview(fw.id, { correct: false });
t.ok('基础复习答错 → 基础掌握度-1（4→3）', fw.basicMastery.level === 3);
t.eq('答错计入 errorCount', fw.errorCount, 1);
t.ok('status 由基础掌握度驱动（3 → mastered）', fw.status === 'mastered');

console.log('\n5. 复习调度');
fresh();
X.VocabEngine.addWord({ word: 'newborn', library: 'general_advanced' });
X.VocabEngine.addWord({ word: 'yesterday', library: 'general_advanced', basicMastery: 2 });
X.VocabEngine.addWord({ word: 'oldword', library: 'general_advanced', basicMastery: 4 });
var nb = X.VocabEngine.findWord('newborn', 'general_advanced');
var yd = X.VocabEngine.findWord('yesterday', 'general_advanced');
var ow = X.VocabEngine.findWord('oldword', 'general_advanced');
/* 设置 lastReviewedAt */
nb.lastReviewedAt = '2026-10-01T00:00:00Z'; nb.status = 'learning';
yd.lastReviewedAt = '2026-10-10T00:00:00Z'; yd.status = 'learning';
ow.lastReviewedAt = '2026-10-08T00:00:00Z'; ow.status = 'mastered';
t.ok('learning 间隔 1 天：10-01 复习 → 到期', X.VocabEngine.isDue(nb, '2026-10-10'));
t.ok('learning 今天复习过 → 未到期', !X.VocabEngine.isDue(yd, '2026-10-10'));
t.ok('mastered 间隔 3 天：10-08 复习 → 10-10 未到期', !X.VocabEngine.isDue(ow, '2026-10-10'));
t.ok('mastered 间隔 3 天：10-11 到期', X.VocabEngine.isDue(ow, '2026-10-11'));
/* 三词都已设置 lastReviewedAt：到期 = newborn（间隔1天已过）+ 一个新词 */
fresh();
X.VocabEngine.addWord({ word: 'nevertouched', library: 'general_advanced' });
t.eq('从未复习的词立即到期', X.VocabEngine.dueWords({ dateStr: '2026-10-10' }).length, 1);

console.log('\n6. CSV 导入：预览 + 确认 + 重复防护（验收#2）');
fresh();
var csvText = 'word,library,phonetic,partOfSpeech,definitions,exampleSentence,examTags,domainTags,difficulty,notes\r\n' +
  'manifold,ai_robotics,/ˈmænɪfoʊld/,n.,"流形;多种多样",The data lies on a manifold.,"CET6,IELTS","AI,Math",5,微分几何\r\n' +
  'Manifold,ai_robotics,/x/,,重复导入检查,,CET4,,3,\r\n' +
  'attention,academic_english,,,注意力;关注,,CET6,Academic,2,论文常用\r\n' +
  ',ai_robotics,,,,,,,,,\r\n';
var csvPrev = X.VocabEngine.parseImportCsv(csvText);
t.ok('CSV 解析成功', csvPrev.ok === true);
t.eq('预览统计（2 新 / 1 重复 / 1 错误）', JSON.stringify(csvPrev.counts), '{"new":2,"duplicate":1,"error":1}');
var applied = X.VocabEngine.applyImport(csvPrev.items);
t.eq('确认导入：新增 2 条、重复与错误跳过', JSON.stringify(applied), '{"added":2,"skippedDuplicate":1,"skippedError":1}');
t.eq('词库现有 2 条', count(), 2);
var mf = X.VocabEngine.findWord('manifold', 'ai_robotics');
t.ok('CSV 字段完整映射（音标/词性/释义/标签/难度）',
  mf.phonetic === '/ˈmænɪfoʊld/' && mf.partOfSpeech === 'n.' &&
  mf.definitions.length === 2 && mf.examTags.length === 2 && mf.difficulty === 5);
t.ok('内嵌分号释义正确切分（RFC4180）',
  mf.definitions[0] && mf.definitions[0].text === '流形' && mf.definitions[1] && mf.definitions[1].text === '多种多样');

/* 重复导入同一文件 → 0 新增 */
var csvPrev2 = X.VocabEngine.parseImportCsv(csvText);
var applied2 = X.VocabEngine.applyImport(csvPrev2.items);
t.ok('重复导入同一文件 → 不重复创建词汇（0 新增）', applied2.added === 0 && count() === 2);

console.log('\n7. CSV / JSON 导出往返（验收#5）');
var csvOut = X.VocabEngine.buildCsv(X.VocabEngine.words(), { template: 'standard' });
t.ok('标准 CSV 带 BOM（防 Excel 乱码）', csvOut.charCodeAt(0) === 0xFEFF);
var rePrev = X.VocabEngine.parseImportCsv(csvOut);
t.eq('导出的 CSV 再导入 → 全部判为重复（字段无损往返）',
  rePrev.counts.duplicate, 2);
var mfRound = rePrev.items.find(function (it) { return it.seed.word === 'manifold'; });
t.ok('往返后字段完整（抽查音标/词性/释义/标签/难度/备注）',
  mfRound && mfRound.seed.phonetic === '/ˈmænɪfoʊld/' && mfRound.seed.partOfSpeech === 'n.' &&
  mfRound.seed.definitions.length === 2 && mfRound.seed.examTags.length === 2 &&
  mfRound.seed.domainTags.length === 2 && mfRound.seed.difficulty === 5 && mfRound.seed.notes === '微分几何');

var jsonOut = X.VocabEngine.buildJson(X.VocabEngine.words());
var jPrev = X.VocabEngine.parseImportJson(jsonOut);
t.ok('JSON 导出可解析且全部判重复（无损往返）', jPrev.ok && jPrev.counts.duplicate === 2);
var anki = X.VocabEngine.buildCsv(X.VocabEngine.words(), { template: 'anki' });
t.ok('Anki 模板 Front/Back/Tags 三列', anki.split('\r\n')[0].indexOf('Front,Back,Tags') === 1);
var momo = X.VocabEngine.buildCsv(X.VocabEngine.words(), { template: 'momo' });
t.ok('墨墨模板 word/definition 两列', momo.split('\r\n')[0].indexOf('word,definition') === 1);
/* 外部简易格式导入 */
var momoBack = X.VocabEngine.parseImportCsv('word,definition\r\nsparse,稀疏的\r\n');
t.ok('墨墨格式（word,definition）可导入', momoBack.ok && momoBack.counts.new === 1);

console.log('\n8. 每日学习计划（时间预算 20–25 分钟，验收#7）');
fresh();
var plan0 = X.VocabEngine.computeDailyPlan('2026-10-10');
t.ok('默认预算 20–25 分钟', plan0.budgetMin === 20 && plan0.budgetMax === 25);
t.ok('无积压时总时长 ≤ 25 分钟', plan0.minutes <= 25);
t.ok('三词库均有每日新增目标', X.VOCAB_LIBRARY_KEYS.every(function (k) { return plan0.byLibrary[k] && plan0.byLibrary[k].weeklyNew > 0; }));
/* 积压触发降新增 */
for (var i = 0; i < 50; i++) {
  X.VocabEngine.addWord({ word: 'backlog' + i, library: 'general_advanced' });
}
var plan1 = X.VocabEngine.computeDailyPlan('2026-10-10');
t.ok('积压 ≥40 触发减半（backlogReduced）', plan1.backlogReduced === true && !plan1.backlogPaused);
for (var j = 0; j < 50; j++) {
  X.VocabEngine.addWord({ word: 'pause' + j, library: 'general_advanced' });
}
var plan2 = X.VocabEngine.computeDailyPlan('2026-10-10');
t.ok('积压 ≥80 暂停新增（backlogPaused）', plan2.backlogPaused === true && plan2.newWords === 0);
t.ok('暂停时优先复习（时长=复习时长）', plan2.minutes === plan2.dueMinutes);
/* 用户可改预算 */
X.state.data.vocabCenter.settings.dailyBudget = { min: 30, max: 35 };
var plan3 = X.VocabEngine.computeDailyPlan('2026-10-10');
t.eq('预算可修改（30–35）', plan3.budgetMax, 35);

console.log('\n9. 学习统计');
fresh();
X.VocabEngine.addWord({ word: 'tensor', library: 'ai_robotics', definitions: ['张量'], basicMastery: 3 });
X.VocabEngine.addWord({ word: 'whereas', library: 'academic_english', definitions: ['然而'], basicMastery: 1 });
var tw = X.VocabEngine.findWord('tensor', 'ai_robotics');
X.VocabEngine.recordReview(tw.id, { library: 'ai_robotics', correct: true });
var stats = X.VocabEngine.computeStats();
t.eq('总词数 2', stats.total, 2);
t.ok('分词库统计（AI 词库 1 条）', stats.byLibrary.ai_robotics.total === 1 && stats.byLibrary.academic_english.total === 1);
t.ok('语境弱项检测：tensor 基础掌握而 AI 语境未掌握',
  stats.byLibrary.ai_robotics.contextWeak === 1);
t.ok('复习积压计数 ≥1', stats.backlog >= 1);
X.VocabEngine.recordReview(tw.id, { library: 'ai_robotics', correct: false });
var stats2 = X.VocabEngine.computeStats();
t.ok('错误率计算（1 对 1 错 = 0.5）', Math.abs(stats2.byLibrary.ai_robotics.errorRate - 0.5) < 0.001);

console.log('\n10. 练习会话记录');
fresh();
X.VocabEngine.addWord({ word: 'session', library: 'general_advanced' });
X.VocabEngine.logSession('2026-10-10', { minutes: 22, reviewedWords: 10, newWords: 5, errors: 2 });
var log = X.VocabEngine.getDailyLog('2026-10-10');
t.ok('会话分钟/复习/新增/错误写入', log.minutes === 22 && log.reviewedWords === 10 && log.newWords === 5 && log.errors === 2);
var stats3 = X.VocabEngine.computeStats();
t.eq('近7天练习分钟统计', stats3.activity.minutes7d, 22);

console.log('\n11. 筛选与删除');
fresh();
X.VocabEngine.addWord({ word: 'alpha', library: 'general_advanced', examTags: ['CET4'], basicMastery: 1 });
X.VocabEngine.addWord({ word: 'beta', library: 'ai_robotics', domainTags: ['AI'], basicMastery: 4 });
t.eq('按词库筛选', X.VocabEngine.listWords({ library: 'ai_robotics' }).length, 1);
t.eq('按考试标签筛选', X.VocabEngine.listWords({ examTag: 'CET4' }).length, 1);
t.eq('按专业标签筛选', X.VocabEngine.listWords({ domainTag: 'AI' }).length, 1);
t.eq('按状态筛选（mastered）', X.VocabEngine.listWords({ status: 'mastered' }).length, 1);
t.eq('关键词搜索', X.VocabEngine.listWords({ search: 'ALP' }).length, 1);
t.ok('删除词条', X.VocabEngine.deleteWord(X.VocabEngine.findWord('alpha', 'general_advanced').id) && count() === 1);

t.report();
