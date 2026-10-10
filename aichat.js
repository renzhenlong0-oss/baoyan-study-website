/* ============================================================
 * aichat.js —— Strategy AI（v3，§43-§45）
 * 你不是待办事项生成器 —— 你是长期学习策略助手：
 *   目标 = 在有限时间内最大化用户 2030 推免进入中上985 AI/机器人
 *   方向研究生项目的概率；优先保护 GPA；分配来自有限 Time Budget。
 * 安全流程（§31）：
 *   AI 输出 → aiSchema 严格校验 → Constraint Engine 验证（虚拟应用）
 *   → 提案卡展示差异 → 用户确认 → 应用 + 自动快照。
 *   任何校验失败 → 拒绝执行并展示错误，绝不直接修改计划。
 * 快照：应用前 SnapshotEngine.create，可恢复（替代 v2 单次撤销）。
 *
 * 安全声明（§45）：API Key 仅存本机浏览器 localStorage，适用于
 * 本地个人使用。若未来公开部署，【禁止】在前端暴露 API Key，
 * 必须改为 Backend/API Proxy。production deployment requires backend proxy.
 * ============================================================ */

let aiChatPending = false;   // 是否正在等待回复
let aiChatListEl = null;     // 聊天列表容器引用（渲染时可能未挂载，不能靠 getElementById）

/* ---------------- 区块渲染 ---------------- */

function renderAiChatCard() {
  var card = el('div', 'home-card chat-box');
  card.id = 'home-ai';

  var title = el('div', 'card-title');
  title.appendChild(el('span', null, 'AI 助手'));
  title.appendChild(el('span', 'card-sub', '问学习 · 质疑安排 · 制定本周战略'));
  card.appendChild(title);

  aiChatListEl = el('div', 'chat-list');
  card.appendChild(aiChatListEl);

  var inputRow = el('div', 'chat-input-row');
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.id = 'home-ai-input';
  inp.placeholder = state.data.aiConfig.apiKey
    ? '说「帮我制定本周战略」，或问任何学习问题…'
    : '请先在「设置」配置 DeepSeek API Key';
  inp.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') sendAiMessage();
  });
  var btn = el('button', 'btn btn-primary', '发送');
  btn.addEventListener('click', sendAiMessage);
  inputRow.appendChild(inp);
  inputRow.appendChild(btn);
  card.appendChild(inputRow);

  renderAiChatList();
  return card;
}

/* 重建聊天列表（局部重渲，不碰其他区块） */
function renderAiChatList() {
  var list = aiChatListEl || document.getElementById('home-ai-list');
  if (!list) return;
  list.innerHTML = '';

  /* 撤销条（最近一次 AI 采纳后可撤销，快照系统支持） */
  if (state.data.aiChat.lastApply) {
    var la = state.data.aiChat.lastApply;
    var bar = el('div', 'banner warn undo-bar');
    var label = el('span', null, '已采纳 AI 战略（' + la.summary.slice(0, 20) + '…）');
    var undo = el('button', 'btn btn-sm', '撤销');
    undo.addEventListener('click', function () { undoLastApply(); });
    bar.appendChild(label);
    bar.appendChild(undo);
    list.appendChild(bar);
  }

  var msgs = state.data.aiChat.messages || [];
  if (!msgs.length) {
    list.appendChild(el('div', 'chat-empty',
      '我是你的长期学习策略助手。可以问我学习方法，也可以说「帮我制定本周战略」——我会基于你的目标、执行数据与时间预算给出可采纳的完整方案（经约束引擎校验）。'));
    return;
  }

  msgs.forEach(function (m) {
    if (m.role === 'assistant' && m.strategyProposal) {
      list.appendChild(buildStrategyProposalCard(m.strategyProposal));
    }
    if (m.role === 'assistant' && m.planProposal) {
      list.appendChild(buildProposalCard(m.planProposal));
    }
    var bubble = el('div', 'chat-msg ' + m.role);
    bubble.textContent = m.content;
    list.appendChild(bubble);
  });

  if (aiChatPending) {
    list.appendChild(el('div', 'chat-msg ai chat-typing', '思考中…'));
  }
  list.scrollTop = list.scrollHeight;
}

/* ---------------- 消息发送与 DeepSeek 调用 ---------------- */

function sendAiMessage() {
  var inp = document.getElementById('home-ai-input');
  if (!inp || aiChatPending) return;
  var text = inp.value.trim();
  if (!text) return;

  if (!state.data.aiConfig.apiKey) {
    pushChatMessage('assistant', '尚未配置 DeepSeek API Key：点击右上角「设置」→「AI 助手」填写后即可使用。');
    inp.value = '';
    return;
  }

  inp.value = '';
  pushChatMessage('user', text);
  aiChatPending = true;
  renderAiChatList();

  callDeepSeek(text, function (err, reply) {
    aiChatPending = false;
    if (err) {
      pushChatMessage('assistant', err);
    } else {
      /* 优先按 v3 战略协议解析（严格 Schema）；失败再降级 v2 建议协议 */
      var strat = StrategyEngine.parseAiStrategy(reply);
      if (strat.ok) {
        pushChatMessage('assistant', reply, null, strat.strategy);
      } else {
        pushChatMessage('assistant', reply, parseProposal(reply), null);
      }
    }
    renderAiChatList();
  });
}

function pushChatMessage(role, content, planProposal, strategyProposal) {
  var msgs = state.data.aiChat.messages;
  msgs.push({
    role: role,
    content: content,
    ts: new Date().toISOString(),
    planProposal: planProposal || null,
    strategyProposal: strategyProposal || null
  });
  if (msgs.length > 40) msgs.splice(0, msgs.length - 40);   // 上限 40 条，保护存储配额
  saveData();
}

/* systemPrompt 可选：词汇辅助等场景传入专用提示词（默认=学习策略助手） */
function callDeepSeek(userText, cb, systemPrompt) {
  var cfg = state.data.aiConfig;
  var messages = [{ role: 'system', content: systemPrompt || buildAiSystemPrompt() }];

  /* 只带最近 12 条历史，控制上下文长度 */
  (state.data.aiChat.messages || []).slice(-12).forEach(function (m) {
    if (m.role !== 'user' && m.role !== 'assistant') return;
    messages.push({ role: m.role, content: m.content });
  });
  messages.push({ role: 'user', content: userText });

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 60000);

  fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2500,
      stream: false
    }),
    signal: controller.signal
  }).then(function (res) {
    return res.json().then(function (data) {
      return { status: res.status, data: data };
    });
  }).then(function (r) {
    clearTimeout(timer);
    if (r.status === 200 && r.data.choices && r.data.choices[0]) {
      cb(null, r.data.choices[0].message.content);
    } else if (r.status === 401) {
      cb('API Key 无效或已失效，请在「设置」中检查。');
    } else if (r.status === 402) {
      cb('DeepSeek 账户余额不足，请充值后重试。');
    } else if (r.status === 429) {
      cb('请求过于频繁，请稍后再试。');
    } else {
      var msg = (r.data && r.data.error && r.data.error.message) || ('HTTP ' + r.status);
      cb('调用失败（' + msg + '）');
    }
  }).catch(function (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      cb('响应超时（60s），请重试。');
    } else {
      cb('请求失败：可能是跨域（CORS）限制或网络问题。可在项目目录执行 python -m http.server 8080，然后通过 http://localhost:8080 打开页面再试。');
    }
  });
}

/* ---------------- 系统提示词（§43：策略助手，不是待办生成器） ---------------- */

function buildAiSystemPrompt() {
  var schemaExample = {
    weekly_strategy: {
      summary: '一句话总述本周战略',
      main_priorities: ['优先项1', '优先项2', '优先项3'],
      risks: ['风险与应对'],
      research_focus: '本周科研关注（当前阶段：探索记录，不设论文数量指标）',
      competition_focus: '本周竞赛关注（大一：低优先级）'
    },
    time_budget: { available_hours: 24, planned_hours: 18, buffer_hours: 6 },
    allocation: [
      { subject: '微积分', hours: 5.5, reason: 'GPA主线' }
    ],
    actions: [],
    warnings: []
  };
  return [
    '你不是待办事项生成器。你是用户的长期学习策略助手。',
    '你的目标是在有限时间内最大化用户 2030 年获得推免资格并进入目标 AI/机器人方向研究生项目的概率。',
    '',
    '核心原则：',
    '1. 你必须优先保护 GPA 和核心课程；同时考虑科研成长；你不能无限增加任务。',
    '2. 所有时间分配必须来自有限 Time Budget：planned_hours + buffer_hours ≤ available_hours，allocation 小时总和 ≤ planned_hours。',
    '3. 你必须识别计划过载：当历史完成率长期偏低时，先检查计划是否过载，不要把失败简单归因于自律。',
    '4. 你不能未经验证修改时间表：你的输出只是提议，必须经过约束引擎校验和用户确认。',
    '5. 当信息不足时，应明确指出不确定性，而不是编造。',
    '6. 课程/资源加入计划必须回答"为什么现在需要"，不能因为有名就推荐；竞赛大一优先级低。',
    '7. 科研指标随阶段变化：大一初期编程能力比论文数量重要得多，不要出现"每周读10篇论文"。',
    '',
    '【输出协议】当用户要求制定或调整本周战略时，回答的最后必须输出一个 JSON 代码块（```json ... ```）：',
    JSON.stringify(schemaExample, null, 2),
    'actions 可选（也可为空数组）：',
    '  {"type":"add","subject":"微积分","day":3,"time":"19:00-20:30","title":"微积分补漏","note":""}',
    '  {"type":"delete","day":3,"time":"19:00-20:30","title":"微积分补漏"}（或 {"type":"delete","taskId":"t123"}）',
    '  {"type":"move","day":3,"time":"19:00-20:30","title":"微积分补漏","newDay":4,"newTime":"14:00-15:30"}',
    '  {"type":"reallocate","from":"英语/四级","to":"程序设计","hours":1}',
    'day 为 1-7（周一=1）；time 格式 HH:MM-HH:MM；add/move 的时段必须避开课程时间、不得与其他任务重叠、不得晚于 23:30 结束、不得落在假期。',
    '纯答疑时不要输出 JSON。',
    '',
    '【用户与学期上下文】',
    StrategyEngine.serializeContext(currentWeek())
  ].join('\n');
}

/* ---------------- v3 战略提案卡（§44 JSON → 校验 → 确认） ---------------- */

function buildStrategyProposalCard(strategy) {
  var card = el('div', 'plan-proposal strategy-proposal');
  card.appendChild(el('div', 'pp-title', '本周战略提案（待你确认后应用）'));

  card.appendChild(el('div', 'pp-sugg', strategy.summary));
  if (strategy.mainPriorities && strategy.mainPriorities.length) {
    card.appendChild(el('div', 'pp-reason', '优先项：' + strategy.mainPriorities.join(' ＞ ')));
  }
  (strategy.risks || []).forEach(function (r) {
    card.appendChild(el('div', 'pp-reason', '⚠ ' + r));
  });

  /* 分配表 */
  if (strategy.allocation && strategy.allocation.length) {
    var list = el('div', 'pp-actions');
    strategy.allocation.slice().sort(function (a, b) { return b.hours - a.hours; }).forEach(function (a) {
      var row = el('div', 'pp-action');
      row.appendChild(el('span', 'pp-badge add', a.hours + 'h'));
      row.appendChild(el('span', null, a.subject + (a.reason ? ' —— ' + a.reason : '')));
      list.appendChild(row);
    });
    card.appendChild(list);
  }

  /* actions 预览 */
  if (strategy.actions && strategy.actions.length) {
    var acts = el('div', 'pp-actions');
    (strategy.actions || []).forEach(function (a) {
      var row = el('div', 'pp-action');
      var label = { add: '新增', delete: '删除', move: '移动', reallocate: '重新分配' }[a.type] || a.type;
      row.appendChild(el('span', 'pp-badge del', label));
      row.appendChild(el('span', null, describeAction(a)));
      acts.appendChild(row);
    });
    card.appendChild(acts);
  }

  (strategy.warnings || []).forEach(function (w) {
    card.appendChild(el('div', 'pp-reason', '· ' + w));
  });

  if (strategy.applied) {
    card.appendChild(el('div', 'pp-state', '已采纳到第' + strategy.week + '周（可点上方"撤销"恢复）'));
  } else if (strategy.ignored) {
    card.appendChild(el('div', 'pp-state', '已忽略'));
  } else if (strategy.rejected) {
    card.appendChild(el('div', 'pp-state pp-state-err', '已拒绝：' + (strategy.rejectReason || '约束校验未通过')));
  } else {
    var btnRow = el('div', 'pp-btns');
    var bOk = el('button', 'btn btn-sm btn-primary', '采纳并应用');
    bOk.addEventListener('click', function () {
      applyStrategyProposal(strategy);
      renderAiChatList();
    });
    var bNo = el('button', 'btn btn-sm', '忽略');
    bNo.addEventListener('click', function () {
      strategy.ignored = true;
      saveData();
      renderAiChatList();
    });
    btnRow.appendChild(bOk);
    btnRow.appendChild(bNo);
    card.appendChild(btnRow);
  }
  return card;
}

function describeAction(a) {
  if (a.type === 'add') return DAY_NAMES[Number(a.day) - 1] + ' ' + a.time + ' · ' + a.subject + ' · ' + a.title;
  if (a.type === 'delete') return (a.taskId ? '任务#' + a.taskId : DAY_NAMES[Number(a.day) - 1] + ' ' + a.time + ' · ' + a.title);
  if (a.type === 'move') return (a.title || a.taskId) + ' → ' + (a.newDay ? DAY_NAMES[Number(a.newDay) - 1] : '') + ' ' + (a.newTime || '');
  if (a.type === 'reallocate') return a.from + ' → ' + a.to + '：' + a.hours + 'h';
  return JSON.stringify(a);
}

/* 采纳 AI 战略：约束校验 → 快照 → 应用 → 入库（§31：校验失败拒绝执行） */
function applyStrategyProposal(strategy) {
  var week = currentWeek();
  if (!getWeekPlan(week)) ensureWeekPlan(week);

  /* 1. 约束校验（虚拟应用；任何 error → 拒绝，绝不部分应用） */
  var check = ConstraintEngine.validateProposal(strategy, week);
  if (!check.ok) {
    var msgs = check.errors.map(function (e) { return '· ' + e.message; }).join('\n');
    strategy.rejected = true;
    strategy.rejectReason = msgs.slice(0, 200);
    saveData();
    alert('AI 提案被约束引擎拒绝（未做任何修改）：\n' + msgs);
    return;
  }

  /* 2. 快照（可随时恢复） */
  var snap = SnapshotEngine.create('AI 采纳：' + strategy.summary.slice(0, 24), week);

  /* 3. 应用 actions（用校验通过的虚拟预览整体替换，保留未改动任务的勾选状态） */
  var plan = getWeekPlan(week);
  plan.subjects = check.preview.subjects;
  plan.updatedAt = new Date().toISOString();

  /* 4. 战略入库（用户确认过的才生效） */
  strategy.week = week;
  strategy.confirmedAt = new Date().toISOString();
  strategy.source = 'ai';
  state.data.weeklyStrategy = strategy;
  state.data.aiChat.lastApply = {
    snapshotId: snap.id,
    at: new Date().toISOString(),
    week: week,
    summary: strategy.summary
  };
  strategy.applied = true;
  saveData();

  refreshCurrentView();
  updateStatusbar();
}

/* 撤销最近一次 AI 采纳（快照恢复） */
function undoLastApply() {
  var la = state.data.aiChat.lastApply;
  if (!la) return;
  var r = SnapshotEngine.restore(la.snapshotId);
  if (!r.ok) { alert(r.error); return; }
  state.data.aiChat.lastApply = null;
  saveData();
  refreshCurrentView();
  renderAiChatList();
  updateStatusbar();
}

/* ============================================================
 * v2 遗留：结构化建议解析/采纳/撤销（add/delete 协议）
 * 已由 v3 战略协议取代；保留以保证旧聊天记录与冒烟测试兼容。
 * ============================================================ */

function findTaskByKey(week, day, time, title) {
  var plan = getWeekPlan(week);
  if (!plan) return null;
  for (var i = 0; i < plan.subjects.length; i++) {
    var t = plan.subjects[i].tasks.find(function (x) {
      return x.day === day && x.time === time && x.title === title;
    });
    if (t) return t;
  }
  return null;
}

/* 从 AI 回复中提取 JSON 建议；非法项剔除并计数；完全失败返回 null（降级纯文本渲染） */
function parseProposal(content) {
  var text = String(content || '');
  var m = /```json\s*([\s\S]*?)```/i.exec(text);
  var jsonStr = m ? m[1] : null;
  if (!jsonStr) {
    var s = text.indexOf('{');
    var e = text.lastIndexOf('}');
    if (s === -1 || e === -1 || e <= s) return null;
    jsonStr = text.slice(s, e + 1);
  }

  var obj;
  try { obj = JSON.parse(jsonStr); } catch (err) { return null; }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.actions)) return null;

  var actions = [];
  var dropped = 0;
  obj.actions.forEach(function (a) {
    if (!a || typeof a !== 'object') { dropped++; return; }
    if (a.op === 'add') {
      if (!a.subject || !a.day || !a.time || !a.title) { dropped++; return; }
      actions.push({
        op: 'add',
        subject: String(a.subject),
        day: Number(a.day),
        time: String(a.time),
        title: String(a.title),
        note: String(a.note || '')
      });
    } else if (a.op === 'delete') {
      if (!a.day || !a.time || !a.title) { dropped++; return; }
      actions.push({ op: 'delete', day: Number(a.day), time: String(a.time), title: String(a.title) });
    } else {
      dropped++;
    }
  });
  if (!actions.length) return null;

  return {
    suggestion: obj.suggestion ? String(obj.suggestion) : '',
    reason: obj.reason ? String(obj.reason) : '',
    actions: actions,
    dropped: dropped
  };
}

/* 建议卡（附在 AI 回复气泡上方） */
function buildProposalCard(proposal) {
  var card = el('div', 'plan-proposal');
  card.appendChild(el('div', 'pp-title', '调整建议'));
  if (proposal.suggestion) card.appendChild(el('div', 'pp-sugg', proposal.suggestion));
  if (proposal.reason) card.appendChild(el('div', 'pp-reason', proposal.reason));
  if (proposal.dropped) card.appendChild(el('div', 'hint', '有 ' + proposal.dropped + ' 条建议格式不合法，已忽略'));

  var list = el('div', 'pp-actions');
  (proposal.actions || []).forEach(function (a) {
    var row = el('div', 'pp-action');
    if (a.op === 'add') {
      row.appendChild(el('span', 'pp-badge add', '新增'));
      row.appendChild(el('span', null, DAY_NAMES[a.day - 1] + ' ' + a.time + ' · ' + a.subject + ' · ' + a.title));
    } else {
      row.appendChild(el('span', 'pp-badge del', '删除'));
      row.appendChild(el('span', null, DAY_NAMES[a.day - 1] + ' ' + a.time + ' · ' + a.title));
    }
    list.appendChild(row);
  });
  card.appendChild(list);

  if (proposal.appliedWeek) {
    card.appendChild(el('div', 'pp-state', '已采纳到第' + proposal.appliedWeek + '周计划'));
  } else if (proposal.ignored) {
    card.appendChild(el('div', 'pp-state', '已忽略'));
  } else {
    var btnRow = el('div', 'pp-btns');
    var bOk = el('button', 'btn btn-sm btn-primary', '采纳');
    bOk.addEventListener('click', function () {
      applyProposal(proposal);
      renderAiChatList();
    });
    var bNo = el('button', 'btn btn-sm', '忽略');
    bNo.addEventListener('click', function () {
      proposal.ignored = true;
      saveData();
      renderAiChatList();
    });
    btnRow.appendChild(bOk);
    btnRow.appendChild(bNo);
    card.appendChild(btnRow);
  }
  return card;
}

/* v2 遗留采纳：写入当前周计划（先快照，支持撤销最近一次） */
function applyProposal(proposal) {
  var week = currentWeek();
  if (!getWeekPlan(week)) ensureWeekPlan(week);

  state.data.aiChat.snapshot = {
    week: week,
    subjects: clone(getWeekPlan(week).subjects),
    createdAt: new Date().toISOString()
  };

  var added = 0, deleted = 0, failed = 0;
  proposal.actions.forEach(function (a) {
    if (a.op === 'add') {
      addTaskToPlan(week, {
        subject: a.subject,
        day: clamp(a.day, 1, 7),
        time: a.time,
        title: a.title,
        note: a.note || ''
      });
      added++;
    } else if (a.op === 'delete') {
      var t = findTaskByKey(week, clamp(a.day, 1, 7), a.time, a.title);
      if (t) { deleteTask(week, t.id); deleted++; }
      else failed++;
    }
  });

  proposal.appliedWeek = week;
  saveData();

  refreshCurrentView();
  updateStatusbar();

  if (failed) alert('已采纳（新增 ' + added + ' / 删除 ' + deleted + '），但有 ' + failed + ' 条删除未找到目标任务，已跳过。');
}

/* v2 遗留撤销（回退到快照状态） */
function undoAdopt() {
  var s = state.data.aiChat.snapshot;
  if (!s) return;
  var plan = getWeekPlan(s.week);
  if (plan) {
    plan.subjects = clone(s.subjects);
    plan.updatedAt = new Date().toISOString();
  }
  state.data.aiChat.snapshot = null;
  saveData();
  refreshCurrentView();
  renderAiChatList();
  updateStatusbar();
}
