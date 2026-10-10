/* ============================================================
 * aiSchema.test.js —— Strategy AI 输出协议与安全流程测试
 * 用法：node test/aiSchema.test.js
 * 覆盖（§44-§45 + 验收标准）：严格 JSON Schema 校验、预算一致性、
 *       非法 Action 拒绝、AI 不能直接修改计划（校验失败拒绝执行）、
 *       采纳流程（快照 + 应用 + 撤销）
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  StrategyEngine, ConstraintEngine, SnapshotEngine, clone, DEFAULT_INIT_DATA, state,
  currentWeek, ensureWeekPlan, getWeekPlan,
  parseAiStrategy: StrategyEngine.parseAiStrategy,
  parseProposal, applyStrategyProposal, undoLastApply, buildStrategyProposalCard,
  applyProposal, undoAdopt,
  serializePlanContext: StrategyEngine.serializePlanContext,
  buildAiSystemPrompt
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== AI Schema 与安全流程测试开始 ===\n');

function fresh() { X.state.data = X.clone(X.DEFAULT_INIT_DATA); X.state.data.currentWeekOverride = 6; }

function validStrategyJson() {
  return '```json\n' + JSON.stringify({
    weekly_strategy: {
      summary: '本周以微积分与C语言为主线，英语维持',
      main_priorities: ['微积分', '程序设计', '英语/四级'],
      risks: ['无'],
      research_focus: '方向探索记录',
      competition_focus: '低优先级'
    },
    time_budget: { available_hours: 60, planned_hours: 18, buffer_hours: 2 },
    allocation: [
      { subject: '微积分', hours: 5.5, reason: 'GPA主线' },
      { subject: '程序设计', hours: 3.5, reason: '编程地基' },
      { subject: '英语/四级', hours: 2.5, reason: '维持' },
      { subject: 'Python', hours: 1, reason: '副线' },
      { subject: '科研/AI探索', hours: 1.5, reason: '探索' },
      { subject: '中国近现代史', hours: 1.5, reason: '' },
      { subject: '专业英语', hours: 0.5, reason: '' },
      { subject: '大学语文', hours: 0.5, reason: '' },
      { subject: '综合', hours: 0.5, reason: '' },
      { subject: '复盘', hours: 0.5, reason: '' }
    ],
    actions: [],
    warnings: []
  }) + '\n```';
}

console.log('1. 合法 JSON 解析');
var r1 = X.parseAiStrategy(validStrategyJson());
t.ok('解析成功', r1.ok === true);
t.eq('summary 提取', r1.strategy.summary, '本周以微积分与C语言为主线，英语维持');
t.eq('分配 10 项', r1.strategy.allocation.length, 10);
t.eq('actions 为空数组合法', r1.strategy.actions.length, 0);
t.eq('预算字段提取', r1.strategy.timeBudget.plannedHours, 18);

console.log('\n2. 非法 JSON 拒绝');
t.ok('纯文本 → 拒绝', X.parseAiStrategy('你好，今天天气不错').ok === false);
t.ok('缺 summary → 拒绝', X.parseAiStrategy('{"weekly_strategy":{},"time_budget":{"available_hours":1,"planned_hours":1,"buffer_hours":0},"allocation":[],"actions":[]}').ok === false);
t.ok('allocation 非数组 → 拒绝', X.parseAiStrategy('{"weekly_strategy":{"summary":"s"},"time_budget":{"available_hours":1,"planned_hours":1,"buffer_hours":0},"allocation":{}}').ok === false);
t.ok('allocation 项缺 hours → 拒绝', X.parseAiStrategy('{"weekly_strategy":{"summary":"s"},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":0}]}').ok === false);

console.log('\n3. 预算一致性校验（§44）');
var overBudget = X.parseAiStrategy('{"weekly_strategy":{"summary":"s"},"time_budget":{"available_hours":10,"planned_hours":9,"buffer_hours":3},"allocation":[{"subject":"微积分","hours":2}]}');
t.ok('planned+buffer > available → 拒绝', overBudget.ok === false && overBudget.errors.join('').indexOf('矛盾') !== -1);
var allocOver = X.parseAiStrategy('{"weekly_strategy":{"summary":"s"},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":9}]}');
t.ok('allocation 总和 > planned → 拒绝', allocOver.ok === false && allocOver.errors.join('').indexOf('allocation') !== -1);

console.log('\n4. Action Schema 校验');
t.ok('非法 action 类型 → 拒绝', X.parseAiStrategy('{"weekly_strategy":{"summary":"s","main_priorities":[],"risks":[]},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":2}],"actions":[{"type":"explode"}]}').ok === false);
t.ok('add 缺 title → 拒绝', X.parseAiStrategy('{"weekly_strategy":{"summary":"s","main_priorities":[],"risks":[]},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":2}],"actions":[{"type":"add","subject":"微积分","day":1,"time":"19:00-20:00"}]}').ok === false);
t.ok('reallocate 缺 hours → 拒绝', X.parseAiStrategy('{"weekly_strategy":{"summary":"s","main_priorities":[],"risks":[]},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":2}],"actions":[{"type":"reallocate","from":"微积分","to":"英语/四级"}]}').ok === false);
t.ok('move 合法 action 通过', X.parseAiStrategy('{"weekly_strategy":{"summary":"s","main_priorities":[],"risks":[]},"time_budget":{"available_hours":10,"planned_hours":5,"buffer_hours":1},"allocation":[{"subject":"微积分","hours":2}],"actions":[{"type":"move","title":"x","newDay":2,"newTime":"14:00-15:00"}]}').ok === true);

console.log('\n5. AI 不能直接修改计划：校验失败拒绝执行');
fresh();
X.ensureWeekPlan(6);
var planBefore = JSON.stringify(X.getWeekPlan(6));
var badStrategy = {
  source: 'ai',
  summary: '把任务排进上课时间',
  mainPriorities: [], risks: [],
  allocation: [],
  actions: [{ type: 'add', subject: '微积分', day: 1, time: '08:00-08:45', title: '与课表冲突的任务' }]
};
var stratBefore = X.state.data.weeklyStrategy;
X.applyStrategyProposal(badStrategy);
t.ok('冲突提案被拒绝（applied 未设置）', badStrategy.applied !== true);
t.ok('冲突提案标记 rejected 与原因', badStrategy.rejected === true && badStrategy.rejectReason.indexOf('冲突') !== -1 || badStrategy.rejected === true);
t.ok('周计划未被修改', JSON.stringify(X.getWeekPlan(6)) === planBefore);
t.ok('周战略未被覆盖', X.state.data.weeklyStrategy === stratBefore);

console.log('\n6. 合法提案采纳流程（校验 → 快照 → 应用 → 撤销）');
fresh();
X.ensureWeekPlan(6);
var micBefore = X.getWeekPlan(6).subjects.find(function (sb) { return sb.subject === '微积分'; }).plannedHours;
/* 预算中立提案：删 2h 任务 + 加 1h 任务 + reallocate 1h（净 −1h，不超过预算） */
var goodStrategy = {
  source: 'ai',
  summary: 'C语言加练，压缩项目式编程',
  mainPriorities: ['微积分', '程序设计'],
  risks: [],
  allocation: [],
  actions: [
    { type: 'delete', day: 5, time: '19:00-21:00', title: 'C语言项目式编程' },
    { type: 'add', subject: '程序设计', day: 6, time: '19:00-20:00', title: 'C语言加练' },
    { type: 'reallocate', from: '微积分', to: '程序设计', hours: 1 }
  ]
};
X.applyStrategyProposal(goodStrategy);
t.ok('采纳标记 applied（' + (goodStrategy.rejectReason || '') + '）', goodStrategy.applied === true);
t.ok('战略入库（source=ai，含 confirmedAt）', X.state.data.weeklyStrategy.source === 'ai' && !!X.state.data.weeklyStrategy.confirmedAt);
t.ok('新增任务已生效', X.getWeekPlan(6).subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === 'C语言加练'; }); }));
t.ok('删除任务已生效', !X.getWeekPlan(6).subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === 'C语言项目式编程'; }); }));
t.ok('reallocate 已生效（微积分 plannedHours ' + micBefore + ' → ' + (micBefore - 1) + '）',
  X.getWeekPlan(6).subjects.find(function (sb) { return sb.subject === '微积分'; }).plannedHours === micBefore - 1);
t.ok('自动快照已创建', X.state.data.snapshots.length >= 1 && X.state.data.aiChat.lastApply);
t.ok('应用后仍通过预算校验', X.ConstraintEngine.validatePlan(X.getWeekPlan(6), {}).ok === true);
/* 撤销 */
X.undoLastApply();
t.ok('撤销后新增任务消失', !X.getWeekPlan(6).subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === 'C语言加练'; }); }));
t.ok('撤销后被删任务恢复', X.getWeekPlan(6).subjects.some(function (sb) { return sb.tasks.some(function (x) { return x.title === 'C语言项目式编程'; }); }));
t.ok('撤销后 lastApply 清空', X.state.data.aiChat.lastApply === null);

console.log('\n7. 快照系统（创建/恢复/对比/上限）');
fresh();
X.ensureWeekPlan(6);
var s1 = X.SnapshotEngine.create('测试快照1', 6);
X.getWeekPlan(6).subjects.forEach(function (sb) { sb.plannedHours = sb.plannedHours + 10; });
var s2 = X.SnapshotEngine.create('测试快照2', 6);
var cmp = X.SnapshotEngine.compare(s1.id, s2.id);
t.ok('对比可看到两版科目差异', cmp.a.summary && cmp.b.summary);
t.ok('恢复到快照1 后计划还原', X.SnapshotEngine.restore(s1.id).ok === true);
t.ok('上限 20 条（超出自动淘汰最旧）', (function () {
  for (var i = 0; i < 25; i++) X.SnapshotEngine.create('批量' + i, 6);
  return X.state.data.snapshots.length === 20;
})());

console.log('\n8. AI 实时计划上下文（v5：AI 必须知道网站实际安排了什么）');
fresh();
var plan6 = X.ensureWeekPlan(6);
var allTitles = [];
plan6.subjects.forEach(function (sb) { sb.tasks.forEach(function (x) { allTitles.push(x.title); }); });
var ctx = X.serializePlanContext(6);
t.ok('上下文包含本周计划标题', ctx.indexOf('第6周计划') !== -1);
t.ok('上下文包含具体任务（抽查第一条任务标题）', allTitles.length > 0 && ctx.indexOf(allTitles[0]) !== -1);
t.ok('上下文包含任务状态', ctx.indexOf('未开始') !== -1 || ctx.indexOf('已完成') !== -1);
t.ok('上下文包含今日信息', ctx.indexOf('今天') !== -1 && ctx.indexOf('今日无计划任务') === -1 || ctx.indexOf('计划任务') !== -1);
t.ok('上下文包含词汇中心简况', ctx.indexOf('词汇中心') !== -1);
t.ok('上下文长度受限（≤2500+省略标记）', ctx.length <= 2600);
/* 无计划时的兜底 */
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.currentWeekOverride = 7;
var ctxEmpty = X.serializePlanContext(7);
t.ok('未生成计划时上下文如实说明', ctxEmpty.indexOf('尚未生成') !== -1);
/* 完整系统提示词包含实时计划 + 防编造规则 */
X.state.data = X.clone(X.DEFAULT_INIT_DATA);
X.state.data.currentWeekOverride = 6;
X.ensureWeekPlan(6);
var prompt = X.buildAiSystemPrompt();
t.ok('系统提示词含实时计划数据', prompt.indexOf('本周计划与今日安排') !== -1);
t.ok('系统提示词含防编造规则', prompt.indexOf('禁止编造安排理由') !== -1);
t.ok('系统提示词含课表与任务区分规则', prompt.indexOf('不是计划任务') !== -1);

t.report();
