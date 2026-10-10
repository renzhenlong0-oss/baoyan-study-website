/* ============================================================
 * ui/competition.js —— 竞赛页（v3，§28）
 * Value Score 透明展示：保研价值 + 技术价值 + 方向匹配 + 成果 - 时间成本。
 * 明确阶段策略：大一竞赛低优先级。
 * ============================================================ */

function renderCompetition() {
  var root = document.getElementById('view-competition');
  root.innerHTML = '';

  var head = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '竞赛选择器'));
  title.appendChild(el('span', 'card-sub', '竞赛不是越多越好：Value Score = 保研价值 + 技术价值 + 方向匹配 + 成果 − 时间成本'));
  head.appendChild(title);
  var advice = CompetitionEngine.stageAdvice(currentWeek());
  head.appendChild(el('div', 'banner info', advice.text));
  var addBtn = el('button', 'btn btn-primary', '新增比赛');
  addBtn.addEventListener('click', function () { openCompetitionModal(null); });
  head.appendChild(addBtn);
  root.appendChild(head);

  var list = CompetitionEngine.list().slice().sort(function (a, b) { return b.valueScore - a.valueScore; });
  var card = el('div', 'card');
  if (!list.length) card.appendChild(el('div', 'empty-state', '暂无比赛记录'));
  list.forEach(function (c) {
    card.appendChild(renderCompetitionRow(c));
  });
  root.appendChild(card);
}

function renderCompetitionRow(c) {
  var row = el('div', 'resource-row');
  var head = el('div', 'resource-head');
  var badgeCls = { '参加': 'st-done', '候选': 'st-todo', '暂不参加': 'st-skip', '已结束': 'st-skip' }[c.status] || 'st-todo';
  head.appendChild(el('span', 'st ' + badgeCls, c.status));
  head.appendChild(el('span', 'resource-name', c.name));
  head.appendChild(el('span', 'hint', c.time + ' · 预计投入 ' + c.estHours + 'h · ' + (c.teamRequired ? '团队赛' : '个人赛')));
  row.appendChild(head);
  row.appendChild(el('div', 'hint',
    '保研价值 ' + c.baoyanValue + ' + 技术价值 ' + c.techValue + ' + 方向匹配 ' + c.directionMatch +
    ' + 成果可迁移 ' + c.outcomeValue + ' − 时间成本 ' + c.timeCost + ' = Value ' + c.valueScore));
  if (c.transferability) row.appendChild(el('div', 'hint', '成果可迁移性：' + c.transferability));
  if (c.note) row.appendChild(el('div', 'hint', c.note));

  var actions = el('div', 'task-actions');
  ['候选', '参加', '暂不参加', '已结束'].forEach(function (s) {
    if (s === c.status) return;
    var b = el('button', 'btn btn-sm', s);
    b.addEventListener('click', function () {
      CompetitionEngine.update(c.id, { status: s });
      renderCompetition();
    });
    actions.appendChild(b);
  });
  var bEdit = el('button', 'btn btn-sm', '编辑');
  bEdit.addEventListener('click', function () { openCompetitionModal(c); });
  actions.appendChild(bEdit);
  var bDel = el('button', 'btn btn-sm btn-danger', '删除');
  bDel.addEventListener('click', function () {
    confirmModal('删除比赛', '确定删除「' + c.name + '」吗？', { danger: true, okLabel: '删除' }).then(function (ok) {
      if (!ok) return;
      CompetitionEngine.remove(c.id);
      renderCompetition();
    });
  });
  actions.appendChild(bDel);
  row.appendChild(actions);
  return row;
}

function openCompetitionModal(existing) {
  var body = el('div');
  var fields = [
    ['name', '比赛名称', 'text'],
    ['time', '时间', 'text'],
    ['estHours', '预计投入（小时）', 'number'],
    ['baoyanValue', '保研价值（1-5）', 'number'],
    ['techValue', '技术价值（1-5）', 'number'],
    ['directionMatch', '方向匹配（1-5）', 'number'],
    ['outcomeValue', '成果可迁移性（1-5）', 'number'],
    ['timeCost', '时间成本（1-5）', 'number'],
    ['transferability', '成果可迁移说明', 'text'],
    ['note', '备注', 'text']
  ];
  var inputs = {};
  fields.forEach(function (f) {
    var fd = el('div', 'field');
    fd.appendChild(el('label', null, f[1]));
    var inp = document.createElement('input');
    inp.type = f[2];
    inp.value = existing ? (existing[f[0]] != null ? existing[f[0]] : '') : '';
    inputs[f[0]] = inp;
    fd.appendChild(inp);
    body.appendChild(fd);
  });

  openModal({
    title: existing ? '编辑比赛' : '新增比赛',
    body: body,
    actions: [
      {
        label: '保存', cls: 'btn-primary',
        onClick: function () {
          var spec = {};
          Object.keys(inputs).forEach(function (k) {
            spec[k] = ['estHours', 'baoyanValue', 'techValue', 'directionMatch', 'outcomeValue', 'timeCost'].indexOf(k) !== -1
              ? (Number(inputs[k].value) || 0) : inputs[k].value.trim();
          });
          if (!spec.name) { alert('请填写比赛名称'); return false; }
          var res;
          if (existing) {
            CompetitionEngine.update(existing.id, spec);
          } else {
            res = CompetitionEngine.add(spec);
            if (!res.ok) { alert(res.error); return false; }
          }
          renderCompetition();
        }
      },
      { label: '取消', cls: '' }
    ]
  });
}
