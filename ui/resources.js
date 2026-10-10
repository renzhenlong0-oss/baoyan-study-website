/* ============================================================
 * ui/resources.js —— 资源库页（v3，§40-§41）
 * 展示可编辑资源库 + 评估字段 + 准入检查。
 * 明示界限：加入资源库 ≠ 加入计划（§62）。默认不推荐付费课程。
 * ============================================================ */

let resCategory = '全部';

function renderResources() {
  var root = document.getElementById('view-resources');
  root.innerHTML = '';

  var head = el('div', 'card');
  var title = el('div', 'card-title');
  title.appendChild(el('span', null, '资源库'));
  title.appendChild(el('span', 'card-sub', '资源筛选 ≠ 任务堆积：只有 Strategy 判断"当前需要"才进入周计划'));
  head.appendChild(title);

  var bar = el('div', 'field-row');
  var sel = document.createElement('select');
  ['全部'].concat(ResourceEngine.categories()).forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (resCategory === c) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function () { resCategory = sel.value; renderResources(); });
  bar.appendChild(sel);
  var addBtn = el('button', 'btn btn-primary', '新增资源');
  addBtn.addEventListener('click', openResourceModal);
  bar.appendChild(addBtn);
  head.appendChild(bar);
  root.appendChild(head);

  var list = ResourceEngine.list(resCategory);
  var card = el('div', 'card');
  if (!list.length) {
    card.appendChild(el('div', 'empty-state', '该分类暂无资源'));
  }
  list.forEach(function (r) {
    card.appendChild(renderResourceRow(r));
  });
  root.appendChild(card);

  /* 计划候选提示（非任务列表） */
  var candidates = ResourceEngine.planCandidates();
  if (candidates.length) {
    var cand = el('div', 'card');
    cand.appendChild(el('div', 'card-title', '当前阶段建议关注的资源（候选，非本周任务）'));
    candidates.forEach(function (r) {
      cand.appendChild(el('div', 'hint', '· ' + r.name + ' —— ' + r.whyNow));
    });
    root.appendChild(cand);
  }
}

function renderResourceRow(r) {
  var row = el('div', 'resource-row');
  var head = el('div', 'resource-head');
  var badgeCls = { '推荐': 'st-done', '可选': 'st-todo', '暂不推荐': 'st-skip', '不推荐': 'st-skip' }[r.recommend] || 'st-todo';
  head.appendChild(el('span', 'st ' + badgeCls, r.recommend));
  head.appendChild(el('span', 'resource-name', r.name));
  head.appendChild(el('span', 'hint', r.platform + ' · ' + (r.category || '') + ' · ' + (r.difficulty || '') + ' · 约' + r.estHours + 'h'));
  if (r.url) {
    var link = el('a', 'resource-link', '打开 ↗');
    link.href = r.url;
    link.target = '_blank';
    link.rel = 'noopener';
    head.appendChild(link);
  }
  row.appendChild(head);
  if (r.topic) row.appendChild(el('div', 'hint', '主题：' + r.topic));
  row.appendChild(el('div', 'hint', '评估：质量' + (r.quality || '—') + ' · 方向匹配' + (r.directionMatch || '—') +
    ' · 技术价值' + (r.techValue || '—') + ' · 保研价值' + (r.baoyanValue || '—') +
    ' · 综合 ' + ResourceEngine.evaluateScore(r) + '/25 · 适合阶段：' + (r.suitableStage || '—')));
  if (r.whyNow) row.appendChild(el('div', 'hint', '为什么现在需要：' + r.whyNow));
  if (r.type === 'lab') row.appendChild(el('div', 'hint', '类型：实验室入口（不是课程）'));

  var actions = el('div', 'task-actions');
  var bEdit = el('button', 'btn btn-sm', '编辑');
  bEdit.addEventListener('click', function () { openResourceModal(r); });
  actions.appendChild(bEdit);
  var bDel = el('button', 'btn btn-sm btn-danger', '删除');
  bDel.addEventListener('click', function () {
    confirmModal('删除资源', '确定删除「' + r.name + '」吗？', { danger: true, okLabel: '删除' }).then(function (ok) {
      if (!ok) return;
      ResourceEngine.remove(r.id);
      renderResources();
    });
  });
  actions.appendChild(bDel);
  row.appendChild(actions);
  return row;
}

/* 新增/编辑资源弹窗（含 §15 准入检查） */
function openResourceModal(existing) {
  var body = el('div');
  var fields = [
    ['name', '名称', 'text'],
    ['platform', '平台（B站/YouTube/Coursera/edX/官方文档/GitHub…）', 'text'],
    ['url', 'URL', 'text'],
    ['category', '分类（C/Python/数学/英语/AI/机器学习/深度学习/计算机视觉/机器人/具身智能/科研方法/Git/Linux）', 'text'],
    ['topic', '主题', 'text'],
    ['difficulty', '难度（初级/中级/高级）', 'text'],
    ['estHours', '预计投入（小时）', 'number'],
    ['suitableStage', '适合阶段（如：大一上）', 'text'],
    ['whyNow', '为什么现在需要？（准入必答）', 'text'],
    ['solves', '它解决什么问题？（准入必答）', 'text'],
    ['replaces', '它替代了什么？（没有写"无"）', 'text']
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

  /* 准入判断字段 */
  var chkRow = el('div', 'field-row');
  var chk1 = document.createElement('input');
  chk1.type = 'checkbox';
  chk1.checked = !!(existing && existing.squeezesGpa);
  chkRow.appendChild(chk1);
  chkRow.appendChild(el('span', null, '会挤压 GPA'));
  var chk2 = document.createElement('input');
  chk2.type = 'checkbox';
  chk2.checked = !!(existing && existing.overlaps);
  chkRow.appendChild(chk2);
  chkRow.appendChild(el('span', null, '与已有资源重复'));
  body.appendChild(chkRow);

  var errBox = el('div', 'banner danger');
  errBox.style.display = 'none';
  body.appendChild(errBox);

  openModal({
    title: existing ? '编辑资源' : '新增资源',
    body: body,
    actions: [
      {
        label: '保存', cls: 'btn-primary',
        onClick: function () {
          var spec = {};
          Object.keys(inputs).forEach(function (k) { spec[k] = inputs[k].value.trim(); });
          spec.estHours = Number(spec.estHours) || 0;
          spec.squeezesGpa = chk1.checked;
          spec.overlaps = chk2.checked;
          var check = ResourceEngine.gateCheck(spec);
          if (!check.ok) {
            errBox.style.display = '';
            errBox.textContent = '准入检查未通过（§15）：' + check.missing.join('；');
            return false;
          }
          var res;
          if (existing) {
            ResourceEngine.update(existing.id, spec);
          } else {
            res = ResourceEngine.add(spec);
            if (!res.ok) {
              errBox.style.display = '';
              errBox.textContent = res.error;
              return false;
            }
          }
          renderResources();
        }
      },
      { label: '取消', cls: '' }
    ]
  });
}
