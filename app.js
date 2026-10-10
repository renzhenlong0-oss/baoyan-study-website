/* ============================================================
 * app.js —— 全局主逻辑：初始化、Tab 切换、周次选择器、
 *           底部状态栏、弹窗系统、DOM 工具
 * ============================================================ */

/* 运行时错误横幅：出现异常时在页面底部红条提示，方便排查 */
window.addEventListener('error', function (ev) {
  console.error('[学习计划管理] 页面错误：', ev.error || ev.message);
  var b = document.getElementById('err-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'err-banner';
    b.style.cssText =
      'position:fixed;left:10px;right:10px;bottom:44px;z-index:999;' +
      'background:#B42318;color:#fff;padding:10px 14px;border-radius:8px;' +
      'font-size:13px;line-height:1.5;max-width:680px;margin:0 auto;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    document.body.appendChild(b);
  }
  b.textContent = '页面出现错误：' + (ev.message || '未知错误') + '（按 F12 打开控制台查看详情，刷新页面重试）';
});

document.addEventListener('DOMContentLoaded', init);

/* 存储配额超限提示（封面图过大/聊天记录过长时由 saveData 派发） */
document.addEventListener('planner-save-error', function () {
  var b = document.getElementById('err-banner');
  if (!b) return;
  b.textContent = '保存失败：浏览器本地存储空间不足（封面图片过大或聊天记录过长）。请在「设置」中恢复默认封面或清空聊天记录。';
  setTimeout(function () { b.textContent = ''; }, 8000);
});

function init() {
  state.data = loadData();
  /* v3：旧体系周计划（无 engineVersion）按新引擎重建，保留勾选状态 */
  var rb = rebuildLegacyWeekPlans(state.data);
  if (rb.rebuilt) saveData();
  state.viewWeek = currentWeek();
  bindTopbar();
  bindTabs();
  document.addEventListener('planner-data-changed', updateStatusbar);
  /* 先显示封面，点击后缩动画结束后进入主页。
     若用户已在封面顶部导航直接点击了某个页面，则保持用户选择 */
  showCover(function () { switchTab(state.activeTab || 'home'); });
}

/* ---------------- DOM 工具 ---------------- */

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------- Tab 切换 ---------------- */

function bindTabs() {
  document.getElementById('tabs').addEventListener('click', function (ev) {
    var btn = ev.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

/* v3 Tab 清单与渲染分发 */
const TAB_VIEWS = ['home', 'today', 'weekplan', 'courses', 'programming', 'research', 'english', 'competition', 'resources', 'review'];

const TAB_RENDERERS = {
  home: 'renderDashboard',
  today: 'renderToday',
  weekplan: 'renderWeekPlan',
  courses: 'renderCourses',
  programming: 'renderProgramming',
  research: 'renderResearch',
  english: 'renderEnglish',
  competition: 'renderCompetition',
  resources: 'renderResources',
  review: 'renderReview'
};

/* 页面尚未实现时的占位渲染（随各 Phase 落地后自动消失） */
function renderTabPlaceholder(tab) {
  var root = document.getElementById('view-' + tab);
  root.innerHTML = '';
  var card = el('div', 'card empty-state');
  card.appendChild(el('div', null, '「' + tab + '」页面开发中，将在后续阶段上线'));
  root.appendChild(card);
}

function switchTab(tab) {
  /* 导航条在封面页也常显：封面显示中点击导航 → 直接收起封面进入对应页面 */
  if (typeof coverActive !== 'undefined' && coverActive && typeof dismissCover === 'function') {
    dismissCover();
  }
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  TAB_VIEWS.forEach(function (t) {
    document.getElementById('view-' + t).hidden = (t !== tab);
  });

  var fnName = TAB_RENDERERS[tab];
  if (fnName && typeof window[fnName] === 'function') {
    window[fnName]();
  } else {
    renderTabPlaceholder(tab);
  }
  updateStatusbar();

  /* v3：周次选择器在所有页面（含首页）常显，导航一致。
     首页内容本身固定显示"今天"，不受 viewWeek 影响 */
  document.querySelector('.week-nav').style.display = '';
  document.body.classList.toggle('home-active', tab === 'home');

  /* 封面时钟 → 功能页顶栏左上角（联动） */
  if (typeof mountCoverClockIntoView === 'function') mountCoverClockIntoView();
}

/* ---------------- 周次选择器 ---------------- */

function bindTopbar() {
  document.getElementById('week-prev').addEventListener('click', function () {
    setViewWeek(state.viewWeek - 1);
  });
  document.getElementById('week-next').addEventListener('click', function () {
    setViewWeek(state.viewWeek + 1);
  });
  document.getElementById('week-label').addEventListener('click', function () {
    setViewWeek(currentWeek());
  });
  document.getElementById('week-back-today').addEventListener('click', function () {
    setViewWeek(currentWeek());
  });
  document.getElementById('btn-settings').addEventListener('click', function () {
    if (typeof coverActive !== 'undefined' && coverActive && typeof dismissCover === 'function') {
      dismissCover();
    }
    openSettingsPanel();
  });
  /* 返回封面（未来多网页的入口枢纽） */
  document.getElementById('btn-cover').addEventListener('click', returnToCover);
  /* 点击品牌名回主页 */
  document.querySelector('.brand').addEventListener('click', function () {
    switchTab('home');
  });
}

function setViewWeek(w) {
  var total = state.data.semester.totalWeeks;
  state.viewWeek = clamp(w, 1, total);
  updateWeekLabel();
  switchTab(state.activeTab);
}

function updateWeekLabel() {
  var cur = currentWeek();
  document.getElementById('week-label-text').textContent = '第' + state.viewWeek + '周';
  document.getElementById('week-current-badge').hidden = (state.viewWeek !== cur);
  document.getElementById('week-back-today').hidden = (state.viewWeek === cur);
}

/* ---------------- 底部状态栏 ---------------- */

function updateStatusbar() {
  var cur = currentWeek();
  var summary = computeWeekSummary(cur);
  var pct = Math.round(summary.taskCompletionRate * 100);
  var saved = state.data.lastModified
    ? new Date(state.data.lastModified).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '尚未保存';
  var bar = document.getElementById('statusbar');
  bar.textContent = '当前第' + cur + '周  |  本周任务完成率 ' + pct + '%  |  最后保存 ' + saved;
  updateWeekLabel();
}

/* ---------------- 弹窗系统 ---------------- */

/**
 * openModal({ title, body, actions, onClose, cardCls, origin })
 *   actions: [{ label, cls, onClick }]  onClick 返回 false 可阻止关闭
 *   cardCls: 附加卡片类（如全屏展开 'modal-card-fs'）
 *   origin:  { x:'50%', y:'50%' } 卡片放大动画的起点（从点击位置丝滑展开）
 * 返回 { close }
 */
function openModal(opts) {
  var root = document.getElementById('modal-root');

  var overlay = el('div', 'modal-overlay');
  var card = el('div', 'modal-card' + (opts.cardCls ? ' ' + opts.cardCls : ''));
  if (opts.origin) {
    card.style.transformOrigin = opts.origin.x + ' ' + opts.origin.y;
  }
  overlay.appendChild(card);   // 必须挂载卡片，否则弹窗只有空遮罩

  var head = el('div', 'modal-head');
  head.appendChild(el('span', null, opts.title || ''));
  var closeBtn = el('button', 'modal-close', '×');
  head.appendChild(closeBtn);
  card.appendChild(head);

  var body = el('div', 'modal-body');
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else if (opts.body) body.appendChild(opts.body);
  card.appendChild(body);

  var actions = el('div', 'modal-actions');
  card.appendChild(actions);

  var closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    if (opts.onClose) opts.onClose();
    /* 先播退出动画，动画结束后再移除 DOM */
    overlay.classList.add('closing');
    card.classList.add('closing');
    setTimeout(function () { overlay.remove(); }, 200);
  }

  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);

  (opts.actions || []).forEach(function (a) {
    var btn = el('button', 'btn ' + (a.cls || ''), a.label);
    btn.addEventListener('click', function () {
      var keep = a.onClick ? a.onClick(close) : true;
      if (keep !== false) close();
    });
    actions.appendChild(btn);
  });

  root.appendChild(overlay);
  return { close: close, body: body };
}

/* 全屏展开组件：复用 openModal 的 ESC/遮罩/× 关闭逻辑，换宽版卡片
   （学科放大版、设计逻辑区块使用） */
function openFullscreen(opts) {
  opts.cardCls = 'modal-card-fs';
  return openModal(opts);
}

/* 确认弹窗，返回 Promise<boolean> */
function confirmModal(title, message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var body = el('div');
    body.appendChild(el('p', 'hint', message));
    openModal({
      title: title,
      body: body,
      actions: [
        {
          label: opts.okLabel || '确定',
          cls: opts.danger ? 'btn-danger' : 'btn-primary',
          onClick: function () { resolve(true); }
        },
        { label: '取消', cls: '', onClick: function () { resolve(false); } }
      ],
      onClose: function () { resolve(false); }
    });
  });
}

/* 文本输入弹窗，返回 Promise<string|null>（取消为 null） */
function promptModal(title, label, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var body = el('div');
    var f = el('div', 'field');
    f.appendChild(el('label', null, label));
    var input;
    if (opts.multiline) {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.value = opts.value || '';
    f.appendChild(input);
    body.appendChild(f);
    if (opts.hint) body.appendChild(el('p', 'hint', opts.hint));

    var modal = openModal({
      title: title,
      body: body,
      actions: [
        {
          label: '确定', cls: 'btn-primary',
          onClick: function () { resolve(input.value.trim()); }
        },
        { label: '取消', cls: '', onClick: function () { resolve(null); } }
      ],
      onClose: function () { resolve(null); }
    });
    setTimeout(function () { input.focus(); }, 50);
  });
}

/* ---------------- 渲染刷新辅助 ---------------- */

/* 重新渲染当前 Tab（数据变化后调用） */
function refreshCurrentView() {
  switchTab(state.activeTab);
}
