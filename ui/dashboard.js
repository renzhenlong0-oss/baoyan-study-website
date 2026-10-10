/* ============================================================
 * ui/dashboard.js —— 首页：保研状态工作台（v3，替代 v2 home.js/dashboard.js）
 * 布局（§37）：目标横幅 → 本周三件要事 → 竞争力六维 → 时间预算 → AI 战略
 * 原则：首页回答"我现在最该干什么"，不是任务列表堆砌。
 * ============================================================ */

/* 首页背景（与 v2 一致：封面图虚化 underlay，卡片为暗色磨砂玻璃） */
const HOME_BG_DEFAULT = 'linear-gradient(160deg, #10151C 0%, #16283F 55%, #2E5FA3 100%)';

function ensureHomeBackground() {
  var bg = document.getElementById('home-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'home-bg';
    document.body.appendChild(bg);
  }
  bg.style.backgroundImage = state.data.coverImage
    ? 'url("' + state.data.coverImage + '")'
    : HOME_BG_DEFAULT;
}

/* 主渲染入口 */
function renderDashboard() {
  ensureHomeBackground();
  var root = document.getElementById('view-home');
  root.innerHTML = '';

  var grid = el('div', 'home-grid');
  var left = el('div', 'home-col-left');
  var center = el('div', 'home-col-center');
  var right = el('div', 'home-col-right');

  left.appendChild(renderGoalBanner());
  left.appendChild(renderPriorityCard());
  left.appendChild(renderBudgetCardHome());
  center.appendChild(renderCompetitivenessCard());
  right.appendChild(renderStrategyCardHome());
  right.appendChild(renderAiChatCard());   // aichat.js

  grid.appendChild(left);
  grid.appendChild(center);
  grid.appendChild(right);
  root.appendChild(grid);
}

/* ---------------- 目标横幅 ---------------- */

function renderGoalBanner() {
  var ov = GoalEngine.overview(currentWeek());
  var card = el('div', 'home-card goal-banner');
  card.appendChild(el('div', 'overline', '我的保研状态'));
  var h = el('div', 'card-title');
  h.appendChild(el('span', null, ov.longTerm.targetSchool + ' · ' + ov.longTerm.direction.split(' / ')[0] + ' / 机器人方向'));
  card.appendChild(h);
  card.appendChild(el('div', 'card-sub',
    '目标：2030 获得推免资格 → ' + ov.longTerm.targetSchool + '。当前阶段：' +
    ov.stage.label + ' · ' + ov.stage.phase + '（' + ov.progress.done + '/' + ov.progress.total + ' 周）'));
  card.appendChild(el('div', 'card-sub', '阶段目标：' + (ov.stage.goals || []).join('、')));

  /* GPA 风险 banner */
  var risk = GpaRiskEngine.assessWeek(currentWeek());
  if (risk.status === 'red') {
    card.appendChild(el('div', 'banner danger', 'GPA Protection Mode：核心课程优先，科研维持最低接触，竞赛暂停'));
  } else if (risk.status === 'yellow') {
    card.appendChild(el('div', 'banner warn', '核心课程风险提示：适当减少科研/竞赛投入，向复习倾斜'));
  }
  return card;
}

/* ---------------- 本周三件要事 ---------------- */

function renderPriorityCard() {
  var wk = currentWeek();
  var strat = state.data.weeklyStrategy && state.data.weeklyStrategy.week === wk
    ? state.data.weeklyStrategy : StrategyEngine.getDefaultWeeklyStrategy(wk);
  var card = el('div', 'home-card');
  card.appendChild(el('div', 'card-title', '本周最重要的三件事'));

  if (!strat.mainPriorities || !strat.mainPriorities.length) {
    card.appendChild(el('div', 'hint', '生成周计划后显示'));
    return card;
  }
  var nums = ['①', '②', '③'];
  strat.mainPriorities.slice(0, 3).forEach(function (s, i) {
    var row = el('div', 'priority-row');
    row.appendChild(el('span', 'priority-num', nums[i]));
    var al = strat.allocation.find(function (a) { return a.subject === s; });
    row.appendChild(el('span', null, s + (al ? '（' + al.hours + 'h）' : '')));
    card.appendChild(row);
  });
  card.appendChild(el('div', 'hint', strat.summary));
  return card;
}

/* ---------------- 时间预算 ---------------- */

function renderBudgetCardHome() {
  var wk = currentWeek();
  var budget = TimeBudgetEngine.computeWeeklyBudget(wk);
  var card = el('div', 'home-card');
  card.appendChild(el('div', 'card-title', '本周时间预算'));

  var grid = el('div', 'home-budget-grid');
  var cells = [
    { label: '理论可用', value: budget.theoretical + 'h' },
    { label: '历史实际', value: budget.historicalAvg + 'h' },
    { label: '建议计划', value: budget.suggested + 'h' },
    { label: '执行率', value: Math.round(budget.recentRate * 100) + '%' }
  ];
  cells.forEach(function (c) {
    var box = el('div', 'home-budget-cell');
    box.appendChild(el('div', 'home-budget-label', c.label));
    box.appendChild(el('div', 'home-budget-value', c.value));
    grid.appendChild(box);
  });
  card.appendChild(grid);

  var plan = getWeekPlan(wk);
  var plannedSum = 0;
  if (plan) {
    plan.subjects.forEach(function (sb) {
      if (sb.subject !== '健身') plannedSum += Number(sb.plannedHours || 0);
    });
  }
  var usedPct = clamp(Math.round(Math.round(plannedSum * 10) / 10 / Math.max(budget.planned, 0.1) * 100), 0, 120);
  var bar = el('div', 'progress-track');
  var fill = el('div', 'progress-fill' + (usedPct > 100 ? ' over' : ''));
  fill.style.width = Math.min(usedPct, 100) + '%';
  bar.appendChild(fill);
  card.appendChild(bar);
  card.appendChild(el('div', 'card-sub',
    '已计划 ' + Math.round(plannedSum * 10) / 10 + 'h / 预算 ' + budget.planned + 'h · Buffer ' + budget.buffer + 'h（不把时间排满）'));
  return card;
}

/* ---------------- 竞争力六维 ---------------- */

function renderCompetitivenessCard() {
  var comp = CompetitivenessEngine.compute();
  var card = el('div', 'home-card comp-card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '我的保研竞争力'));
  title.appendChild(el('span', 'card-sub', '状态条，不是概率预测'));
  card.appendChild(title);

  var order = ['academic', 'research', 'programming', 'english', 'competition', 'execution'];
  order.forEach(function (key) {
    var d = comp.dimensions[key];
    var row = el('div', 'comp-row');
    var name = el('div', 'comp-name');
    name.appendChild(el('span', null, comp.labels[key]));
    name.appendChild(el('span', 'comp-score', d.score));
    row.appendChild(name);
    var track = el('div', 'comp-track');
    var fill = el('div', 'comp-fill ' + (d.score >= 60 ? 'ok' : (d.score >= 35 ? 'mid' : 'low')));
    fill.style.width = d.score + '%';
    track.appendChild(fill);
    row.appendChild(track);
    card.appendChild(row);
  });

  if (comp.topImprovements.length) {
    var tip = el('div', 'comp-tips');
    tip.appendChild(el('div', 'card-sub', '当前最值得提升的三项：'));
    comp.topImprovements.forEach(function (tp) {
      var line = el('div', 'hint', '· ' + tp.label + '：' + tp.advice);
      tip.appendChild(line);
    });
    card.appendChild(tip);
  }
  card.appendChild(el('div', 'card-sub', comp.note));
  return card;
}

/* ---------------- AI 战略建议 ---------------- */

function renderStrategyCardHome() {
  var wk = currentWeek();
  var strat = state.data.weeklyStrategy && state.data.weeklyStrategy.week === wk
    ? state.data.weeklyStrategy : null;
  var card = el('div', 'home-card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, 'AI 战略建议'));
  title.appendChild(el('span', 'card-sub', strat ? (strat.source === 'ai' ? '来自 AI 分析' : '默认策略') : '尚未生成周计划'));
  card.appendChild(title);

  if (!strat) {
    card.appendChild(el('div', 'hint',
      '生成周计划后，系统会按【目标 → 策略 → 时间预算 → 约束 → 计划】给出本周战略。' +
      '也可以在右侧对话框说「帮我制定本周战略」。'));
    return card;
  }

  card.appendChild(el('div', 'ai-strategy-summary', '“' + strat.summary + '”'));
  (strat.risks || []).forEach(function (r) {
    card.appendChild(el('div', 'hint', '· ' + r));
  });
  if (strat.examMode && strat.examMode !== 'none') {
    card.appendChild(el('div', 'banner warn', '考试模式：核心课程优先，非必要任务压缩'));
  }

  /* 政策提示（§42：院级规则未知必须如实显示） */
  var policyHint = PolicyEngine.hint();
  card.appendChild(el('div', 'hint', '推免政策：' + policyHint));
  return card;
}
