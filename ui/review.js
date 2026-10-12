/* ============================================================
 * ui/review.js —— 复盘页（v3，替代 v2 review.js，§35-§36）
 * 结构：每日记录（表单 + 效率/跳过分类）→ 周复盘（引擎汇总 +
 *       偏差分析 + 过载检测）→ 趋势图（Chart.js 按需加载）
 * 原则：复盘读历史执行数据；失败先检查计划过载，不归因自律。
 * ============================================================ */

let reviewSubTab = 'daily';   // 'daily' | 'weekly' | 'trends'
let reviewDate = null;        // 每日记录选中的日期

/* ============================================================
 * 微积分总结的数学符号语言（v5）：
 *   符号面板（点击插入 LaTeX 片段）+ KaTeX 实时渲染预览。
 *   支持行内 $...$ 与独立公式 $$...$$；KaTeX 按需从 CDN 加载。
 * ============================================================ */

/* 微积分常用符号面板：[显示, 插入的 LaTeX 片段] */
const CALC_SYMBOLS = [
  ['∫', '\\int '], ['∫ₐᵇ', '\\int_a^b '], ['∑', '\\sum_{i=1}^{n} '], ['√', '\\sqrt{ }'],
  ['分数', '\\frac{ }{ }'], ['lim', '\\lim_{x \\to a} '], ['d/dx', '\\frac{d}{dx} '],
  ['∂', '\\partial '], ['∇', '\\nabla '], ['∞', '\\infty '],
  ['x²', '^{2}'], ['xₙ', '_{n}'],
  ['α', '\\alpha '], ['β', '\\beta '], ['γ', '\\gamma '], ['δ', '\\delta '],
  ['ε', '\\varepsilon '], ['θ', '\\theta '], ['λ', '\\lambda '], ['π', '\\pi '],
  ['σ', '\\sigma '], ['φ', '\\varphi '], ['ω', '\\omega '], ['Δ', '\\Delta '], ['Σ', '\\Sigma '],
  ['≤', '\\leq '], ['≥', '\\geq '], ['≠', '\\neq '], ['≈', '\\approx '],
  ['→', '\\to '], ['⇒', '\\Rightarrow '], ['∈', '\\in '], ['∀', '\\forall '], ['∃', '\\exists ']
];

const KATEX_CDNS = [
  { css: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css', js: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js' },
  { css: 'https://cdn.bootcdn.net/ajax/libs/KaTeX/0.16.11/katex.min.css', js: 'https://cdn.bootcdn.net/ajax/libs/KaTeX/0.16.11/katex.min.js' },
  { css: 'https://unpkg.com/katex@0.16.11/dist/katex.min.css', js: 'https://unpkg.com/katex@0.16.11/dist/katex.min.js' }
];
let katexFailed = false;
let katexQueue = null;

function ensureKatex(onDone) {
  if (typeof katex !== 'undefined') { onDone(); return; }
  if (katexQueue) { katexQueue.push(onDone); return; }
  katexQueue = [onDone];
  var i = 0;
  function flush() {
    var q = katexQueue;
    katexQueue = null;
    q.forEach(function (cb) { cb(); });
  }
  function tryNext() {
    if (typeof katex !== 'undefined') { flush(); return; }
    if (i >= KATEX_CDNS.length) { katexFailed = true; flush(); return; }
    var cdn = KATEX_CDNS[i++];
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cdn.css;
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.src = cdn.js;
    s.onload = tryNext;    // 加载成功后仍需确认 katex 已定义
    s.onerror = tryNext;
    document.head.appendChild(s);
  }
  tryNext();
}

/* 构建符号面板：点击把对应 LaTeX 片段插入 textarea 光标处 */
function buildMathPalette(textarea) {
  var bar = el('div', 'math-palette');
  CALC_SYMBOLS.forEach(function (item) {
    var b = el('button', 'math-sym', item[0]);
    b.type = 'button';
    b.title = '插入 ' + item[1].replace(/\\/g, '').trim() + '（点击插入光标处）';
    b.addEventListener('click', function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      insertAtCursor(textarea, item[1]);
    });
    bar.appendChild(b);
  });
  bar.appendChild(el('span', 'hint', '支持 LaTeX：行内 $x^2$、独立公式 $$\\int_a^b$$'));
  return bar;
}

/* 在 textarea 光标处插入文本（无选区时追加到末尾） */
function insertAtCursor(textarea, snippet) {
  var start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length;
  var end = textarea.selectionEnd != null ? textarea.selectionEnd : start;
  textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
  var pos = start + snippet.length;
  if (textarea.focus) textarea.focus();
  if (textarea.setSelectionRange) textarea.setSelectionRange(pos, pos);
  if (textarea.dispatchEvent && typeof Event !== 'undefined') {
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/* 渲染数学预览：解析 $$ 独立公式 与 $ 行内公式，其余为普通文本。
 * KaTeX 未加载时先提示并排队，全部 CDN 失败则退回纯文本。 */
function renderMathPreview(container, text) {
  container.innerHTML = '';
  var content = String(text || '').trim();
  if (!content) { container.style.display = 'none'; return; }
  container.style.display = '';

  if (typeof katex === 'undefined') {
    if (katexFailed) {
      container.appendChild(el('div', 'hint', '数学渲染组件加载失败（需要网络），以下为纯文本：'));
      container.appendChild(document.createTextNode(content));
      return;
    }
    container.appendChild(el('div', 'hint', '正在加载数学渲染组件（需要网络）…'));
    ensureKatex(function () { renderMathPreview(container, content); });
    return;
  }

  var parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  parts.forEach(function (part) {
    if (!part) return;
    if (/^\$\$/.test(part)) {
      var block = el('div', 'math-block');
      try {
        katex.render(part.slice(2, -2), block, { displayMode: true, throwOnError: false });
      } catch (e) { block.textContent = part; }
      container.appendChild(block);
    } else if (/^\$/.test(part)) {
      var inline = el('span', 'math-inline');
      try {
        katex.render(part.slice(1, -1), inline, { displayMode: false, throwOnError: false });
      } catch (e) { inline.textContent = part; }
      container.appendChild(inline);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

/* Chart.js 按需加载：依次尝试多个 CDN，全部失败才提示不可用 */
const CHART_CDNS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://cdn.bootcdn.net/ajax/libs/Chart.js/4.4.3/chart.umd.min.js',
  'https://lib.baomitu.com/Chart.js/4.4.3/chart.umd.min.js',
  'https://unpkg.com/chart.js@4.4.3/dist/chart.umd.min.js'
];
let chartFailed = false;
let chartQueue = null;

function ensureChart(onDone) {
  if (typeof Chart !== 'undefined') { onDone(); return; }
  if (chartQueue) { chartQueue.push(onDone); return; }
  chartQueue = [onDone];
  var i = 0;
  function flush() {
    var q = chartQueue;
    chartQueue = null;
    q.forEach(function (cb) { cb(); });
  }
  function tryNext() {
    if (typeof Chart !== 'undefined') { flush(); return; }
    if (i >= CHART_CDNS.length) { flush(); return; }
    var s = document.createElement('script');
    s.src = CHART_CDNS[i++];
    s.onload = tryNext;    // 加载成功后仍需确认 Chart 已定义
    s.onerror = tryNext;
    document.head.appendChild(s);
  }
  tryNext();
}

function renderReview() {
  var root = document.getElementById('view-review');
  root.innerHTML = '';

  var nav = el('div', 'subnav');
  [['daily', '每日记录'], ['weekly', '周复盘'], ['trends', '趋势图']].forEach(function (item) {
    var b = el('button', 'subnav-btn' + (reviewSubTab === item[0] ? ' active' : ''), item[1]);
    b.addEventListener('click', function () {
      reviewSubTab = item[0];
      renderReview();
    });
    nav.appendChild(b);
  });
  root.appendChild(nav);

  if (reviewSubTab === 'daily') renderReviewDaily(root);
  else if (reviewSubTab === 'weekly') renderReviewWeekly(root);
  else renderReviewTrends(root);
}

/* ---------------- 每日记录 ---------------- */

function renderReviewDaily(root) {
  if (!reviewDate) reviewDate = todayStr();

  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '每日记录'));
  var picker = document.createElement('input');
  picker.type = 'date';
  picker.value = reviewDate;
  picker.addEventListener('change', function () {
    reviewDate = picker.value;
    renderReview();
  });
  title.appendChild(picker);
  card.appendChild(title);

  var body = el('div');
  renderReviewForm(body, reviewDate, { showDateInfo: true });
  card.appendChild(body);
  root.appendChild(card);
}

/* ---------------- 每日复盘表单（今日计划与每日记录共用） ---------------- */
/**
 * opts: { showDateInfo, flash }
 */
function renderReviewForm(container, dateStr, opts) {
  opts = opts || {};
  var log = ensureDailyLog(dateStr);
  var c = log.checklist;

  if (opts.showDateInfo) {
    var info = el('p', 'hint', fmtDateCN(dateStr) + ' · 第' + weekOfDate(dateStr) + '周');
    container.appendChild(info);
  }

  /* 三连勾选 */
  var cbBox = el('div');
  var defs = [
    ['notesOrganized', '上课内容已整理笔记'],
    ['homeworkDone', '作业已完成'],
    ['gymDone', '健身完成']
  ];
  defs.forEach(function (d) {
    var label = el('label', 'checkbox-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!c[d[0]];
    cb.addEventListener('change', function () {
      c[d[0]] = cb.checked;
      saveDailyLog(dateStr, { checklist: c });
      updateStatusbar();
    });
    label.appendChild(cb);
    label.appendChild(el('span', null, d[1]));
    cbBox.appendChild(label);
  });
  container.appendChild(cbBox);

  /* 填数：背单词 / 听力 */
  var numRow = el('div', 'field-row');
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '背单词（个）'));
  var inpVocab = document.createElement('input');
  inpVocab.type = 'number';
  inpVocab.min = '0';
  inpVocab.value = c.vocabCount;
  inpVocab.addEventListener('change', function () {
    c.vocabCount = Number(inpVocab.value) || 0;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f1.appendChild(inpVocab);
  numRow.appendChild(f1);

  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '听力（分钟）'));
  var inpListen = document.createElement('input');
  inpListen.type = 'number';
  inpListen.min = '0';
  inpListen.value = c.listeningMinutes;
  inpListen.addEventListener('change', function () {
    c.listeningMinutes = Number(inpListen.value) || 0;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f2.appendChild(inpListen);
  numRow.appendChild(f2);
  container.appendChild(numRow);

  /* 一句话总结（微积分：数学符号面板 + LaTeX 实时预览 + 可拖拽扩大） */
  var f3 = el('div', 'field');
  f3.appendChild(el('label', null, '微积分一句话总结'));
  var inpCalc = document.createElement('textarea');
  inpCalc.rows = 3;
  inpCalc.className = 'math-textarea';
  inpCalc.value = c.calculusSummary || '';
  inpCalc.addEventListener('change', function () {
    c.calculusSummary = inpCalc.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f3.appendChild(buildMathPalette(inpCalc));   // 符号面板：点击插入光标处
  f3.appendChild(inpCalc);
  var calcPreview = el('div', 'math-preview');
  calcPreview.style.display = 'none';
  f3.appendChild(calcPreview);
  var calcTimer = null;
  inpCalc.addEventListener('input', function () {
    clearTimeout(calcTimer);
    calcTimer = setTimeout(function () { renderMathPreview(calcPreview, inpCalc.value); }, 300);
  });
  renderMathPreview(calcPreview, inpCalc.value);   // 载入时先渲染已有内容
  container.appendChild(f3);

  var f4 = el('div', 'field');
  f4.appendChild(el('label', null, 'C语言一句话总结'));
  var inpCoding = document.createElement('textarea');
  inpCoding.rows = 1;
  inpCoding.value = c.codingSummary || '';
  inpCoding.addEventListener('change', function () {
    c.codingSummary = inpCoding.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f4.appendChild(inpCoding);
  container.appendChild(f4);

  /* v3：学习效率自评（1-5）——自适应调整输入 */
  var fEff = el('div', 'field');
  fEff.appendChild(el('label', null, '学习效率自评（1=很低 … 5=很高）'));
  var selEff = document.createElement('select');
  [['0', '未评价'], ['1', '1 · 很低'], ['2', '2 · 偏低'], ['3', '3 · 正常'], ['4', '4 · 较高'], ['5', '5 · 很高']].forEach(function (g) {
    var opt = document.createElement('option');
    opt.value = g[0]; opt.textContent = g[1];
    if (String(c.efficiency || 0) === g[0]) opt.selected = true;
    selEff.appendChild(opt);
  });
  selEff.addEventListener('change', function () {
    c.efficiency = Number(selEff.value);
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  fEff.appendChild(selEff);
  container.appendChild(fEff);

  /* 完成度评级 */
  var f5 = el('div', 'field');
  f5.appendChild(el('label', null, '今日完成度'));
  var selGrade = document.createElement('select');
  [['', '未评级'], ['A', 'A（100%）'], ['B', 'B（80%+）'], ['C', 'C（不足80%）']].forEach(function (g) {
    var opt = document.createElement('option');
    opt.value = g[0]; opt.textContent = g[1];
    if (c.completionGrade === g[0]) opt.selected = true;
    selGrade.appendChild(opt);
  });
  selGrade.addEventListener('change', function () {
    c.completionGrade = selGrade.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f5.appendChild(selGrade);
  container.appendChild(f5);

  /* v3：当日跳过原因分类（§35 选项） */
  var fSkip = el('div', 'field');
  fSkip.appendChild(el('label', null, '今日未完成任务的主要原因（用于归因分析）'));
  var selSkip = document.createElement('select');
  [''].concat(SKIP_REASON_OPTIONS).forEach(function (r) {
    var opt = document.createElement('option');
    opt.value = r; opt.textContent = r || '无/不适用';
    if ((c.skipCategory || '') === r) opt.selected = true;
    selSkip.appendChild(opt);
  });
  selSkip.addEventListener('change', function () {
    c.skipCategory = selSkip.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  fSkip.appendChild(selSkip);
  container.appendChild(fSkip);

  /* 未完成原因 / 明日调整 */
  var f6 = el('div', 'field');
  f6.appendChild(el('label', null, '未完成原因（可空）'));
  var inpReason = document.createElement('textarea');
  inpReason.rows = 1;
  inpReason.value = c.unfinishedReason || '';
  inpReason.addEventListener('change', function () {
    c.unfinishedReason = inpReason.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f6.appendChild(inpReason);
  container.appendChild(f6);

  var f7 = el('div', 'field');
  f7.appendChild(el('label', null, '明日调整（可空）'));
  var inpAdjust = document.createElement('textarea');
  inpAdjust.rows = 1;
  inpAdjust.value = c.tomorrowAdjust || '';
  inpAdjust.addEventListener('change', function () {
    c.tomorrowAdjust = inpAdjust.value;
    saveDailyLog(dateStr, { checklist: c });
    updateStatusbar();
  });
  f7.appendChild(inpAdjust);
  container.appendChild(f7);

  /* AI 工具使用记录 */
  var f8 = el('div', 'field');
  f8.appendChild(el('label', null, 'AI工具使用记录（如：用Claude Code debug了循环嵌套题）'));
  var inpAi = document.createElement('textarea');
  inpAi.rows = 1;
  inpAi.value = log.aiToolLog || '';
  inpAi.addEventListener('change', function () {
    saveDailyLog(dateStr, { aiToolLog: inpAi.value });
    updateStatusbar();
  });
  f8.appendChild(inpAi);
  container.appendChild(f8);

  var saveBtn = el('button', 'btn btn-primary', '保存今日复盘');
  saveBtn.addEventListener('click', function () {
    saveDailyLog(dateStr, {});
    updateStatusbar();
    saveBtn.textContent = '已保存';
    setTimeout(function () { saveBtn.textContent = '保存今日复盘'; }, 1200);
  });
  container.appendChild(saveBtn);

  var savedHint = el('span', 'hint', '　输入内容会自动暂存，无需每次点保存');
  container.appendChild(savedHint);

  /* 21:00 后闪烁提醒一次 */
  if (opts.flash && dateStr === todayStr() && new Date().getHours() >= 21) {
    var parentCard = container.closest && container.closest('.card');
    if (parentCard && parentCard.classList) parentCard.classList.add('flash-once');
  }
}

/* ---------------- 周复盘（v3：引擎汇总 + 偏差分析 + 过载检测） ---------------- */

function renderReviewWeekly(root) {
  var w = state.viewWeek;
  var review = state.data.weekReviews[String(w)] || {
    weekNumber: w,
    autoSummary: null,
    whatWentWell: '',
    whatDidntWork: '',
    nextWeekAdjust: '',
    nextWeekFocus: '',
    savedAt: null
  };
  var summary = ReviewEngine.computeWeekSummary(w);
  var analysis = ReviewEngine.analyzeWeek(w);

  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '第' + w + '周复盘'));
  var btnCalc = el('button', 'btn btn-sm', '重新计算本周汇总');
  btnCalc.addEventListener('click', function () {
    review.autoSummary = summary = ReviewEngine.computeWeekSummary(w);
    state.data.weekReviews[String(w)] = review;
    saveData();
    renderReview();
  });
  title.appendChild(btnCalc);
  card.appendChild(title);

  /* 自动汇总区 */
  var stats = el('div', 'summary-stats');
  function statBox(v, k) {
    var box = el('div', 'stat-box');
    box.appendChild(el('div', 'v', v));
    box.appendChild(el('div', 'k', k));
    stats.appendChild(box);
  }
  statBox(Math.round(summary.taskCompletionRate * 100) + '%', '任务完成率（' + summary.doneTasks + '/' + summary.totalTasks + '）');
  statBox(Math.round(summary.gymCompletionRate * 100) + '%', '健身完成率');
  statBox(String(summary.vocabTotal), '背单词累计（个）');
  statBox(String(summary.aiToolUsageCount), 'AI工具使用（次）');
  statBox(summary.actualHours + 'h', '实际学习时长（预算 ' + analysis.budgetPlanned + 'h）');
  statBox(summary.efficiencyAvg || '—', '效率自评均值（' + summary.efficiencyCount + '天）');
  card.appendChild(stats);

  /* v3：计划过载检测（§36：先检查计划，不归因自律） */
  if (analysis.overload.overload) {
    card.appendChild(el('div', 'banner danger', analysis.overload.message));
  }

  /* v3：偏差分析（实际 vs 计划 + 跳过归因建议） */
  card.appendChild(el('div', 'sec-title', '偏差分析：实际投入 vs 计划（小时）'));
  if (!analysis.gaps.length) {
    card.appendChild(el('div', 'hint', '本周计划未生成，无计划学时可比对'));
  } else {
    analysis.gaps.forEach(function (g) {
      var row = el('div', 'bar-compare');
      row.appendChild(el('span', 'b-label', g.subject));

      var track = el('div', 'bar-track');
      var fill = el('div', 'bar-actual');
      var max = Math.max(g.planned, g.actual, 0.1);
      fill.style.width = (g.actual / max * 100) + '%';
      track.appendChild(fill);
      var marker = el('div', 'bar-plan-marker');
      marker.style.left = (g.planned / max * 100) + '%';
      marker.title = '计划 ' + g.planned + 'h';
      track.appendChild(marker);
      row.appendChild(track);

      row.appendChild(el('span', 'b-val', '实际 ' + g.actual + 'h / 计划 ' + g.planned + 'h（' + g.ratio + '%）'));
      card.appendChild(row);
    });
  }

  /* 跳过原因归因（§35） */
  if (analysis.topSkipCategory) {
    card.appendChild(el('div', 'sec-title', '跳过原因归因'));
    var catLine = el('div', 'hint',
      '主要跳过原因：' + analysis.topSkipCategory + '（' + summary.skipCategories[analysis.topSkipCategory] + ' 次）。' + analysis.skipAdvice);
    card.appendChild(catLine);
  }

  /* 未完成任务清单 */
  card.appendChild(el('div', 'sec-title', '未完成任务清单'));
  if (!summary.incompleteTasks.length) {
    card.appendChild(el('div', 'hint', '本周任务全部完成'));
  } else {
    summary.incompleteTasks.forEach(function (t) {
      var line = el('div', 'hint',
        DAY_NAMES[t.day - 1] + ' ' + t.time + ' ' + t.title + (t.reason ? '（' + t.reason + '）' : ''));
      card.appendChild(line);
    });
  }

  /* 手动填写区 */
  card.appendChild(el('div', 'divider'));
  card.appendChild(el('div', 'sec-title', '手动填写'));

  function textField(label, getter) {
    var f = el('div', 'field');
    f.appendChild(el('label', null, label));
    var ta = document.createElement('textarea');
    ta.rows = 2;
    ta.value = getter() || '';
    f.appendChild(ta);
    card.appendChild(f);
    return ta;
  }
  var taWell = textField('做得好的', function () { return review.whatWentWell; });
  var taBad = textField('没做到的', function () { return review.whatDidntWork; });
  var taAdjust = textField('下周调整', function () { return review.nextWeekAdjust; });
  var taFocus = textField('下周重点', function () { return review.nextWeekFocus; });

  var btnSave = el('button', 'btn btn-primary', '保存周复盘');
  btnSave.addEventListener('click', function () {
    review.autoSummary = summary;
    review.whatWentWell = taWell.value;
    review.whatDidntWork = taBad.value;
    review.nextWeekAdjust = taAdjust.value;
    review.nextWeekFocus = taFocus.value;
    review.savedAt = new Date().toISOString();
    state.data.weekReviews[String(w)] = review;
    saveData();
    btnSave.textContent = '已保存';
    setTimeout(function () { btnSave.textContent = '保存周复盘'; }, 1200);
  });
  card.appendChild(btnSave);

  root.appendChild(card);
}

/* ---------------- 趋势图 ---------------- */

function renderReviewTrends(root) {
  if (typeof Chart === 'undefined') {
    if (chartFailed) {
      root.appendChild(el('div', 'banner warn',
        'Chart.js 加载失败（所有 CDN 均不可用，需要网络），趋势图暂不可用。其余功能不受影响。'));
      return;
    }
    root.appendChild(el('div', 'banner info', '正在加载图表组件（Chart.js，需要网络）…'));
    ensureChart(function () {
      if (typeof Chart === 'undefined') chartFailed = true;
      renderReview();
    });
    return;
  }

  var w = state.viewWeek;
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '趋势图（最近4周，以第' + w + '周为基准）'));
  root.appendChild(card);

  var weeks = [];
  for (var i = 3; i >= 0; i--) {
    if (w - i >= 1) weeks.push(w - i);
  }

  /* ---- 图1：每日任务完成率折线 ---- */
  var box1 = el('div', 'card chart-box');
  box1.appendChild(el('div', 'card-title', '每日任务完成率（%）'));
  var labels1 = [], data1 = [];
  weeks.forEach(function (wk) {
    for (var d = 1; d <= 7; d++) {
      var plan = getWeekPlan(wk);
      var dayTasks = [];
      if (plan) {
        plan.subjects.forEach(function (sb) {
          sb.tasks.forEach(function (t) { if (t.day === d) dayTasks.push(t); });
        });
      }
      if (!dayTasks.length) continue;   // 无任务的日期跳过
      var done = dayTasks.filter(function (t) { return t.status === 'done'; }).length;
      labels1.push(dateOfWeek(wk, d).slice(5).replace('-', '/'));
      data1.push(Math.round(done / dayTasks.length * 100));
    }
  });
  appendChart(box1, labels1.length ? [{
    type: 'line',
    data: { labels: labels1, datasets: [{ label: '完成率%', data: data1, borderColor: '#1C3A5E', backgroundColor: 'rgba(45,95,138,0.12)', fill: true, tension: 0.3 }] },
    options: chartOpts()
  }] : null, '暂无任务数据');
  root.appendChild(box1);

  /* ---- 图2：最近4周计划 vs 实际学时柱状 ---- */
  var box2 = el('div', 'card chart-box');
  box2.appendChild(el('div', 'card-title', '每周计划学时 vs 实际学时（小时）'));
  var labels2 = [], planned2 = [], actual2 = [];
  weeks.forEach(function (wk) {
    var plan = getWeekPlan(wk);
    var sum = computeWeekSummary(wk);
    var p = 0, a = 0;
    if (plan) {
      plan.subjects.forEach(function (sb) { p += Number(sb.plannedHours || 0); });
    }
    a = sum.actualHours;
    labels2.push('第' + wk + '周');
    planned2.push(Math.round(p * 10) / 10);
    actual2.push(Math.round(a * 10) / 10);
  });
  var hasChart2 = weeks.some(function (wk) { return getWeekPlan(wk); });
  appendChart(box2, hasChart2 ? [{
    type: 'bar',
    data: {
      labels: labels2,
      datasets: [
        { label: '计划', data: planned2, backgroundColor: '#2D5F8A' },
        { label: '实际', data: actual2, backgroundColor: '#2A6B5A' }
      ]
    },
    options: chartOpts()
  }] : null, '暂无周计划数据');
  root.appendChild(box2);

  /* ---- 图3：背单词数周累计折线 ---- */
  var box3 = el('div', 'card chart-box');
  box3.appendChild(el('div', 'card-title', '背单词数（周累计）'));
  var labels3 = [], data3 = [];
  weeks.forEach(function (wk) {
    var sum = computeWeekSummary(wk);
    if (!sum.vocabTotal) return;
    labels3.push('第' + wk + '周');
    data3.push(sum.vocabTotal);
  });
  appendChart(box3, labels3.length ? [{
    type: 'line',
    data: { labels: labels3, datasets: [{ label: '单词数', data: data3, borderColor: '#B8860B', backgroundColor: 'rgba(184,134,11,0.12)', fill: true, tension: 0.3 }] },
    options: chartOpts()
  }] : null, '暂无背单词记录');
  root.appendChild(box3);
}

function chartOpts() {
  /* v3 暗色主题：刻度/网格/图例用浅色（否则在深色玻璃卡上不可见） */
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#9AA3AD', font: { family: '"Microsoft YaHei", "PingFang SC", sans-serif' } } }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: '#9AA3AD' },
        grid: { color: 'rgba(255, 255, 255, 0.08)' }
      },
      x: {
        ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14, color: '#9AA3AD' },
        grid: { display: false }
      }
    }
  };
}

function appendChart(container, config, emptyText) {
  if (!config) {
    container.appendChild(el('div', 'chart-empty', emptyText));
    return;
  }
  var canvas = document.createElement('canvas');
  canvas.style.height = '260px';
  container.appendChild(canvas);
  new Chart(canvas, config[0]);
}
