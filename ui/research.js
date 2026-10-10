/* ============================================================
 * ui/research.js —— 科研页（v3，§25-§27）
 * 结构：技术路线图（展示位）→ 当前科研阶段 → 方向试错记录 →
 *       潜在科研入口（赵凤军老师实验室）→ 科研探索记录
 * 原则：允许试错、阶段指标真实（大一=编程地基，不是论文数量）、
 *       实验室入口不预设为"最终导师"。
 * ============================================================ */

function renderResearch() {
  var root = document.getElementById('view-research');
  root.innerHTML = '';

  root.appendChild(renderResearchRoadmapCard());
  root.appendChild(renderResearchStageCard());
  root.appendChild(renderDirectionsCard());
  root.appendChild(renderLabCard());
  root.appendChild(renderEntriesCard());
}

/* ---------------- 技术路线图 ---------------- */

function renderResearchRoadmapCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '技术路线图'));
  title.appendChild(el('span', 'card-sub', 'C → Python → NumPy → Git → Linux → PyTorch → ML → DL → CV → SLAM → Robotics → RL → Embodied AI'));
  card.appendChild(title);

  var pos = ResearchEngine.roadmapPosition();
  var chips = el('div', 'topic-chips');
  pos.nodes.forEach(function (node, i) {
    var state2 = i < pos.doneCount ? 'done' : (i === pos.doneCount ? 'inProgress' : 'locked');
    var chip = el('div', 'topic-chip ' + state2, (state2 === 'done' ? '✓ ' : (state2 === 'inProgress' ? '● ' : '')) + node.name);
    chip.title = node.note;
    chips.appendChild(chip);
  });
  card.appendChild(chips);
  card.appendChild(el('div', 'hint', '当前位置：「' + pos.current.name + '」——' + pos.current.note + '。' + pos.note));
  return card;
}

/* ---------------- 当前科研阶段 ---------------- */

function renderResearchStageCard() {
  var info = ResearchEngine.stageInfo();
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '当前科研阶段：' + info.stage.label));
  title.appendChild(el('span', 'card-sub', '目标：成为"实验室愿意培养的人"，不是现在发论文'));
  card.appendChild(title);
  card.appendChild(el('div', 'hint', info.stage.note));
  card.appendChild(el('div', 'hint', '阶段指标：' + (info.stage.metrics || []).join('、')));
  card.appendChild(el('div', 'hint', '近14天科研投入：' + ResearchEngine.recentHours() + 'h（本周计划中科研/AI探索 1-1.5h）'));
  return card;
}

/* ---------------- 方向试错记录（§26） ---------------- */

function renderDirectionsCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '方向试错记录'));
  title.appendChild(el('span', 'card-sub', '记录投入与感受，不强迫现在决定方向'));
  card.appendChild(title);

  var dirs = (state.data.research && state.data.research.directions) || [];
  dirs.forEach(function (d) {
    var row = el('div', 'resource-row');
    var head = el('div', 'resource-head');
    head.appendChild(el('span', 'resource-name', d.name));
    head.appendChild(el('span', 'hint', '兴趣 ' + d.interest + '/5 · 难度 ' + d.difficulty + '/5 · 已投入 ' + d.hours + 'h · ' + (d.willing ? '愿意继续' : '暂不继续')));
    row.appendChild(head);
    var actions = el('div', 'task-actions');
    var bEdit = el('button', 'btn btn-sm', '记录感受');
    bEdit.addEventListener('click', function () { openDirectionModal(d); });
    actions.appendChild(bEdit);
    var bToggle = el('button', 'btn btn-sm', d.willing ? '暂不继续' : '愿意继续');
    bToggle.addEventListener('click', function () {
      ResearchEngine.updateDirection(d.id, { willing: !d.willing });
      renderResearch();
    });
    actions.appendChild(bToggle);
    row.appendChild(actions);
    if (d.note) row.appendChild(el('div', 'hint', d.note));
    card.appendChild(row);
  });
  return card;
}

function openDirectionModal(d) {
  var body = el('div');
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '兴趣（1-5）'));
  var inpInterest = document.createElement('input');
  inpInterest.type = 'number';
  inpInterest.min = 1; inpInterest.max = 5;
  inpInterest.value = d.interest;
  f1.appendChild(inpInterest);
  body.appendChild(f1);
  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '难度（1-5）'));
  var inpDiff = document.createElement('input');
  inpDiff.type = 'number';
  inpDiff.min = 1; inpDiff.max = 5;
  inpDiff.value = d.difficulty;
  f2.appendChild(inpDiff);
  body.appendChild(f2);
  var f3 = el('div', 'field');
  f3.appendChild(el('label', null, '投入时长（小时）'));
  var inpHours = document.createElement('input');
  inpHours.type = 'number';
  inpHours.value = d.hours;
  f3.appendChild(inpHours);
  body.appendChild(f3);
  var f4 = el('div', 'field');
  f4.appendChild(el('label', null, '感受备注'));
  var inpNote = document.createElement('input');
  inpNote.value = d.note || '';
  f4.appendChild(inpNote);
  body.appendChild(f4);

  openModal({
    title: '记录试错感受：' + d.name,
    body: body,
    actions: [
      {
        label: '保存', cls: 'btn-primary',
        onClick: function () {
          ResearchEngine.updateDirection(d.id, {
            interest: clamp(Number(inpInterest.value) || 1, 1, 5),
            difficulty: clamp(Number(inpDiff.value) || 1, 1, 5),
            hours: Number(inpHours.value) || 0,
            note: inpNote.value.trim()
          });
          renderResearch();
        }
      },
      { label: '取消', cls: '' }
    ]
  });
}

/* ---------------- 潜在科研入口（赵凤军实验室） ---------------- */

function renderLabCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '当前潜在科研入口'));
  title.appendChild(el('span', 'card-sub', '潜在科研训练入口，不是"最终导师"'));
  card.appendChild(title);

  ResearchEngine.labContacts().forEach(function (lab) {
    var block = el('div', 'lab-block');
    block.appendChild(el('div', 'resource-name', lab.name));
    block.appendChild(el('div', 'hint', '研究方向：' + (lab.fields || []).join('、')));
    if (lab.url) {
      var link = el('a', 'resource-link', '官方主页 ↗');
      link.href = lab.url;
      link.target = '_blank';
      link.rel = 'noopener';
      block.appendChild(link);
    }
    var statusRow = el('div', 'field-row');
    statusRow.appendChild(el('span', 'hint', '当前状态：'));
    var sel = document.createElement('select');
    ['未联系', '已了解', '已联系', '已进入'].forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      if (lab.status === s) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      ResearchEngine.updateLab(lab.id, { status: sel.value });
      renderResearch();
    });
    statusRow.appendChild(sel);
    block.appendChild(statusRow);
    block.appendChild(el('div', 'hint', '计划：' + lab.plan));
    card.appendChild(block);
  });
  return card;
}

/* ---------------- 科研探索记录 ---------------- */

function renderEntriesCard() {
  var card = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '科研探索记录'));
  title.appendChild(el('span', 'card-sub', '方向探索/论文阅读/复现实验……全部计入时间预算'));
  card.appendChild(title);

  var addBtn = el('button', 'btn btn-primary', '新增记录');
  addBtn.addEventListener('click', openEntryModal);
  card.appendChild(addBtn);

  var entries = ((state.data.research && state.data.research.entries) || []).slice().reverse().slice(0, 20);
  if (!entries.length) {
    card.appendChild(el('div', 'hint', '暂无记录。每周 1-1.5h 的科研/AI探索任务完成后，来这里记录收获。'));
  }
  entries.forEach(function (e) {
    var row = el('div', 'task-row');
    row.appendChild(el('span', 'task-time', (e.ts || '').slice(5, 10)));
    row.appendChild(el('span', 'task-title', '[' + e.type + '] ' + e.title));
    row.appendChild(el('span', 'hint', e.hours + 'h'));
    if (e.note) row.appendChild(el('div', 'task-note', e.note));
    card.appendChild(row);
  });
  return card;
}

function openEntryModal() {
  var body = el('div');
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '类型'));
  var sel = document.createElement('select');
  ResearchEngine.allowedTaskTypes().forEach(function (tp) {
    var opt = document.createElement('option');
    opt.value = tp; opt.textContent = tp;
    sel.appendChild(opt);
  });
  f1.appendChild(sel);
  body.appendChild(f1);
  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '标题（含方向名会自动累计该方向投入，如"Computer Vision 入门资料浏览"）'));
  var inpTitle = document.createElement('input');
  f2.appendChild(inpTitle);
  body.appendChild(f2);
  var f3 = el('div', 'field');
  f3.appendChild(el('label', null, '投入（小时）'));
  var inpHours = document.createElement('input');
  inpHours.type = 'number';
  inpHours.step = 0.5;
  inpHours.value = 1;
  f3.appendChild(inpHours);
  body.appendChild(f3);
  var f4 = el('div', 'field');
  f4.appendChild(el('label', null, '收获/笔记'));
  var ta = document.createElement('textarea');
  ta.rows = 2;
  f4.appendChild(ta);
  body.appendChild(f4);

  openModal({
    title: '新增科研探索记录',
    body: body,
    actions: [
      {
        label: '保存', cls: 'btn-primary',
        onClick: function () {
          if (!inpTitle.value.trim()) { alert('请填写标题'); return false; }
          ResearchEngine.addEntry(sel.value, inpTitle.value.trim(), inpHours.value, ta.value.trim());
          renderResearch();
        }
      },
      { label: '取消', cls: '' }
    ]
  });
}
