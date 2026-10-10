/* ============================================================
 * ui/vocabCenter.js —— 个人英语词汇中心 UI（v5）
 * 英语页内的词汇中心子导航：
 *   词汇总览（筛选） / 添加生词（含 AI 辅助） / 复习练习（5 模式）
 *   / 导入导出 / 学习统计 / 设置（预算·比例·备份恢复）
 * 原则（规格）：
 *   AI 内容明确标记"未经核实"，确认后才入库；
 *   导入先预览、重复检测、确认后写入，绝不覆盖已有掌握记录；
 *   每日预算 20–25 分钟，复习积压优先、自动降新增。
 * ============================================================ */

let vocabTab = 'overview';   // overview | add | practice | io | stats | settings

const VOCAB_TABS = [
  ['overview', '词汇总览'],
  ['add', '添加生词'],
  ['practice', '复习练习'],
  ['io', '导入导出'],
  ['stats', '学习统计'],
  ['settings', '设置']
];

/* 总览页筛选状态 */
let vcFilter = { library: '', examTag: '', domainTag: '', status: '', sourceType: '', search: '' };

/* ---------------- 小工具 ---------------- */

function libLabel(key) {
  var l = VOCAB_LIBRARIES.find(function (x) { return x.key === key; });
  return l ? l.label : key;
}

function masteryLabel(level) {
  return ['未学', '认识', '模糊', '熟练', '精通'][Number(level) || 0];
}

function statusLabel(s) {
  return s === 'mastered' ? '已掌握' : (s === 'learning' ? '学习中' : '新学');
}

function downloadText(filename, text) {
  var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* select 构造助手 */
function vcSelect(values, current, onChange) {
  var sel = document.createElement('select');
  values.forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v[0]; opt.textContent = v[1];
    if (String(current) === String(v[0])) opt.selected = true;
    sel.appendChild(opt);
  });
  if (onChange) sel.addEventListener('change', onChange);
  return sel;
}

function aiBadge() {
  var b = el('span', 'vc-ai-badge', '✦ AI 生成 · 未经核实');
  b.title = '由 AI 辅助生成，尚未人工核实，请确认后再保存';
  return b;
}

/* ---------------- 主入口 ---------------- */

function renderVocabCenter(root) {
  root.innerHTML = '';   // 每次重渲清空容器（筛选/切换/保存后重绘）

  var nav = el('div', 'subnav');
  VOCAB_TABS.forEach(function (item) {
    var b = el('button', 'subnav-btn' + (vocabTab === item[0] ? ' active' : ''), item[1]);
    b.addEventListener('click', function () {
      vocabTab = item[0];
      renderVocabCenter(root);
    });
    nav.appendChild(b);
  });
  root.appendChild(nav);

  if (vocabTab === 'overview') renderVocabOverview(root);
  else if (vocabTab === 'add') renderVocabAdd(root);
  else if (vocabTab === 'practice') renderVocabPractice(root);
  else if (vocabTab === 'io') renderVocabIO(root);
  else if (vocabTab === 'stats') renderVocabStats(root);
  else renderVocabSettings(root);
}

/* ---------------- 词汇总览（筛选） ---------------- */

function renderVocabOverview(root) {
  var stats = VocabEngine.computeStats();

  var bar = el('div', 'card vc-filter');
  var row = el('div', 'field-row');
  row.appendChild(el('label', null, '词库'));
  row.appendChild(vcSelect([['', '全部']].concat(VOCAB_LIBRARIES.map(function (l) { return [l.key, l.label]; })),
    vcFilter.library, function (ev) { vcFilter.library = ev.target.value; renderVocabCenter(root); }));
  row.appendChild(el('label', null, '考试标签'));
  row.appendChild(vcSelect([['', '全部']].concat(VOCAB_EXAM_TAGS.map(function (x) { return [x, x]; })),
    vcFilter.examTag, function (ev) { vcFilter.examTag = ev.target.value; renderVocabCenter(root); }));
  row.appendChild(el('label', null, '专业方向'));
  row.appendChild(vcSelect([['', '全部']].concat(VOCAB_DOMAIN_TAGS.map(function (x) { return [x, x]; })),
    vcFilter.domainTag, function (ev) { vcFilter.domainTag = ev.target.value; renderVocabCenter(root); }));
  bar.appendChild(row);

  var row2 = el('div', 'field-row');
  row2.appendChild(el('label', null, '掌握程度'));
  row2.appendChild(vcSelect([['', '全部'], ['new', '新学'], ['learning', '学习中'], ['mastered', '已掌握']],
    vcFilter.status, function (ev) { vcFilter.status = ev.target.value; renderVocabCenter(root); }));
  row2.appendChild(el('label', null, '来源'));
  row2.appendChild(vcSelect([['', '全部'], ['exam', '考试词库'], ['academic', '学术材料'], ['techdoc', '技术文档'], ['paper', '论文'], ['manual', '手动录入']],
    vcFilter.sourceType, function (ev) { vcFilter.sourceType = ev.target.value; renderVocabCenter(root); }));
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = '搜索单词或释义…';
  inp.value = vcFilter.search;
  inp.addEventListener('change', function () { vcFilter.search = inp.value; renderVocabCenter(root); });
  row2.appendChild(inp);
  var bClear = el('button', 'btn btn-sm', '清除筛选');
  bClear.addEventListener('click', function () {
    vcFilter = { library: '', examTag: '', domainTag: '', status: '', sourceType: '', search: '' };
    renderVocabCenter(root);
  });
  row2.appendChild(bClear);
  bar.appendChild(row2);

  var hint = el('div', 'hint',
    '共 ' + stats.total + ' 条词条 · 待复习 ' + stats.backlog + ' 条 · 符合筛选 ' +
    VocabEngine.listWords(vcFilter).length + ' 条');
  bar.appendChild(hint);
  root.appendChild(bar);

  var list = VocabEngine.listWords(vcFilter);
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '词条列表'));
  if (!list.length) {
    card.appendChild(el('div', 'empty-state', '没有符合条件的词条。去「添加生词」或「导入导出」建立你的词库。'));
    root.appendChild(card);
    return;
  }
  var shown = list.slice(0, 60);
  shown.forEach(function (w) {
    card.appendChild(renderVocabWordRow(w, root));
  });
  if (list.length > shown.length) {
    card.appendChild(el('div', 'hint', '（仅显示前 60 条，请用筛选缩小范围）'));
  }
  root.appendChild(card);
}

function renderVocabWordRow(w, root) {
  var row = el('div', 'vc-word');
  var head = el('div', 'vc-word-head');
  head.appendChild(el('span', 'vc-word-text', w.word));
  if (w.phonetic) head.appendChild(el('span', 'hint', w.phonetic));
  if (w.partOfSpeech) head.appendChild(el('span', 'hint', w.partOfSpeech));
  head.appendChild(el('span', 'st ' + (w.status === 'mastered' ? 'st-done' : (w.status === 'learning' ? 'st-todo' : 'st-skip')),
    statusLabel(w.status)));

  var actions = el('div', 'task-actions');
  var bEdit = el('button', 'btn btn-sm', '编辑');
  bEdit.addEventListener('click', function () { openVocabEditModal(w, root); });
  var bDel = el('button', 'btn btn-sm', '删除');
  bDel.addEventListener('click', function () {
    confirmModal('删除词条', '确定删除「' + w.word + '」？该操作不可撤销。', { danger: true, okLabel: '删除' })
      .then(function (ok) {
        if (!ok) return;
        VocabEngine.deleteWord(w.id);
        renderVocabCenter(root);
        updateStatusbar();
      });
  });
  actions.appendChild(bEdit);
  actions.appendChild(bDel);
  head.appendChild(actions);
  row.appendChild(head);

  var defs = el('div', 'vc-word-defs');
  w.definitions.forEach(function (d) {
    var s = el('span', null, d.text);
    if (d.aiGenerated) s.appendChild(aiBadge());
    defs.appendChild(s);
  });
  row.appendChild(defs);
  if (w.exampleSentence) row.appendChild(el('div', 'hint', '例：' + w.exampleSentence +
    (w.aiGenerated && w.aiGenerated.example ? '（AI 生成）' : '')));

  var tags = el('div', 'vc-tags');
  (w.examTags || []).forEach(function (x) { tags.appendChild(el('span', 'vc-tag vc-tag-exam', x)); });
  (w.domainTags || []).forEach(function (x) { tags.appendChild(el('span', 'vc-tag vc-tag-domain', x)); });
  (w.contexts || []).forEach(function (c) {
    tags.appendChild(el('span', 'vc-tag', libLabel(c.library) + ' ' + masteryLabel(c.mastery.level) +
      (c.sense ? '·' + c.sense : '')));
  });
  row.appendChild(tags);

  var meta = el('div', 'hint',
    '基础 ' + masteryLabel(w.basicMastery.level) + ' · 错 ' + w.errorCount + ' / 对 ' + w.correctCount +
    ' · 来源 ' + (w.sourceTitle || ({ exam: '考试词库', academic: '学术材料', techdoc: '技术文档', paper: '论文', manual: '手动录入' }[w.sourceType] || '手动录入')) +
    ' · 添加于 ' + String(w.createdAt).slice(0, 10));
  row.appendChild(meta);
  return row;
}

/* ---------------- 添加生词（含 AI 辅助） ---------------- */

let vcAddAiDraft = false;   // 表单当前内容是否来自 AI（保存时打 aiGenerated 标记）

function renderVocabAdd(root) {
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '添加生词'));
  card.appendChild(el('div', 'hint',
    '查重自动进行：忽略大小写与首尾空格；同一单词进入不同词库会作为独立语境词义分别追踪。'));
  card.appendChild(buildVocabForm({}, root));
  root.appendChild(card);
}

/* 表单工厂：添加页与编辑弹窗共用。
 * onSubmit(seed) 由调用方处理保存；aiDraft 指示内容是否 AI 生成。 */
function buildVocabForm(seed, root, onSubmit) {
  var box = el('div', 'vc-form');
  var aiHint = el('div', 'vc-ai-hint');
  aiHint.style.display = 'none';
  box.appendChild(aiHint);

  /* 字段工厂：创建 field 容器但不自动挂载，由调用方按顺序放入行或直接附加 */
  function f(label, key, type, ph) {
    var field = el('div', 'field');
    field.appendChild(el('label', null, label));
    var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type || 'text';
    else input.rows = 2;
    input.value = seed[key] || '';
    input.placeholder = ph || '';
    field.appendChild(input);
    return { field: field, input: input };
  }

  var r1 = el('div', 'field-row');
  var fw = f('单词/短语 *', 'word', 'text', '如 embodiment 或 take over');
  r1.appendChild(fw.field);
  var libField = el('div', 'field');
  libField.appendChild(el('label', null, '词库 *'));
  var libSel = vcSelect(VOCAB_LIBRARIES.map(function (l) { return [l.key, l.label + '（' + l.desc.slice(0, 12) + '…）']; }),
    seed.library || 'general_advanced');
  libField.appendChild(libSel);
  r1.appendChild(libField);
  box.appendChild(r1);

  var r2 = el('div', 'field-row');
  var fp = f('音标', 'phonetic', 'text');
  r2.appendChild(fp.field);
  var fpos = f('词性', 'partOfSpeech', 'text', 'n. / v. / adj.');
  r2.appendChild(fpos.field);
  box.appendChild(r2);

  var fd = f('中文释义（多个用分号或换行分隔）*', 'definitions', 'textarea');
  fd.input.value = (seed.definitions || []).map(function (d) { return typeof d === 'string' ? d : d.text; }).join('\n');
  fd.input.placeholder = '体现；化身\n具身（AI语境）';
  box.appendChild(fd.field);
  var fe = f('英文释义（可空）', 'englishDefinition', 'textarea');
  box.appendChild(fe.field);
  var fx = f('例句（自拟；论文例句只抄短句）', 'exampleSentence', 'textarea');
  box.appendChild(fx.field);
  var fc = f('搭配（多个换行分隔）', 'collocations', 'textarea');
  fc.input.value = (seed.collocations || []).join('\n');
  box.appendChild(fc.field);

  var r3 = el('div', 'field-row');
  var srcField = el('div', 'field');
  srcField.appendChild(el('label', null, '来源类型'));
  var srcSel = vcSelect([['manual', '手动录入'], ['exam', '考试词库'], ['academic', '学术材料'], ['techdoc', '技术文档'], ['paper', '论文']],
    seed.sourceType || 'manual');
  srcField.appendChild(srcSel);
  r3.appendChild(srcField);
  var fst = f('来源标题', 'sourceTitle', 'text', '论文/文档标题（可空）');
  r3.appendChild(fst.field);
  box.appendChild(r3);
  var fse = f('来源摘录（≤200字，只保存你有权保存的短文本）', 'sourceExcerpt', 'textarea');
  box.appendChild(fse.field);

  var r4 = el('div', 'field-row');
  var diffField = el('div', 'field');
  diffField.appendChild(el('label', null, '难度 1-5'));
  var diffSel = vcSelect([[1, '1 很简单'], [2, '2 简单'], [3, '3 中等'], [4, '4 较难'], [5, '5 很难']], seed.difficulty || 3);
  diffField.appendChild(diffSel);
  r4.appendChild(diffField);
  var senseField = el('div', 'field');
  senseField.appendChild(el('label', null, '语境词义说明（可选，如"具身智能语境中的含义"）'));
  var senseInp = document.createElement('input');
  senseInp.type = 'text';
  senseInp.value = seed.sense || '';
  senseField.appendChild(senseInp);
  r4.appendChild(senseField);
  box.appendChild(r4);

  /* 标签复选 */
  var tagBox = el('div', 'vc-tag-check');
  var examWrap = el('div', null);
  examWrap.appendChild(el('div', 'hint', '考试标签（可多选）'));
  VOCAB_EXAM_TAGS.forEach(function (x) {
    var lab = el('label', 'checkbox-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (seed.examTags || []).indexOf(x) !== -1;
    lab.appendChild(cb);
    lab.appendChild(el('span', null, x));
    examWrap.appendChild(lab);
  });
  tagBox.appendChild(examWrap);
  var domWrap = el('div', null);
  domWrap.appendChild(el('div', 'hint', '专业方向标签（可多选）'));
  VOCAB_DOMAIN_TAGS.forEach(function (x) {
    var lab = el('label', 'checkbox-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (seed.domainTags || []).indexOf(x) !== -1;
    lab.appendChild(cb);
    lab.appendChild(el('span', null, x));
    domWrap.appendChild(lab);
  });
  tagBox.appendChild(domWrap);
  box.appendChild(tagBox);

  var fn = f('备注', 'notes', 'textarea', '个人记忆法、易错点…');
  box.appendChild(fn.field);

  function collect() {
    return {
      word: fw.input.value.trim(),
      library: libSel.value,
      phonetic: fp.input.value.trim(),
      partOfSpeech: fpos.input.value.trim(),
      definitions: fd.input.value.split(/[\n;；]/).map(function (x) { return x.trim(); }).filter(Boolean),
      englishDefinition: fe.input.value.trim(),
      exampleSentence: fx.input.value.trim(),
      collocations: fc.input.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      sourceType: srcSel.value,
      sourceTitle: fst.input.value.trim(),
      sourceExcerpt: fse.input.value.trim().slice(0, VOCAB_LIMITS.sourceExcerpt),
      examTags: VOCAB_EXAM_TAGS.filter(function (x) { return tagBox.querySelectorAll('input')[VOCAB_EXAM_TAGS.indexOf(x)].checked; }),
      domainTags: VOCAB_DOMAIN_TAGS.filter(function (x) { return tagBox.querySelectorAll('input')[VOCAB_EXAM_TAGS.length + VOCAB_DOMAIN_TAGS.indexOf(x)].checked; }),
      difficulty: Number(diffSel.value),
      notes: fn.input.value.trim().slice(0, VOCAB_LIMITS.notes),
      sense: senseInp.value.trim(),
      aiGenerated: vcAddAiDraft
    };
  }

  var btns = el('div', 'vc-form-btns');
  var bAi = el('button', 'btn', '✦ AI 辅助补全');
  bAi.addEventListener('click', function () { runVocabAiAssist(fw.input.value.trim(), libSel.value, {
    word: fw.input, phonetic: fp.input, pos: fpos.input, defs: fd.input, eng: fe.input, example: fx.input, colloc: fc.input,
    hint: aiHint, saveBtn: bSave
  }); });
  btns.appendChild(bAi);
  var bSave = el('button', 'btn btn-primary', '保存词条');
  bSave.addEventListener('click', function () {
    var seed = collect();
    if (!seed.word) { alert('请填写单词'); return; }
    if (!seed.definitions.length) { alert('请至少填写一条中文释义'); return; }
    if (onSubmit) { onSubmit(seed); return; }
    var r = VocabEngine.addWord(seed);
    if (!r.ok) { alert(r.error); return; }
    if (r.duplicate) {
      alert('「' + r.word.word + '」在该词库已存在，未重复创建。可在总览中编辑已有词条。');
    } else if (r.mergedContexts && r.mergedContexts.length) {
      alert('已把新词库语境（' + r.mergedContexts.map(libLabel).join('、') + '）追加到已有词条「' + r.word.word + '」，可分别追踪掌握度。');
    } else {
      alert('已保存：' + r.word.word);
    }
    vcAddAiDraft = false;
    renderVocabCenter(root);
    updateStatusbar();
  });
  btns.appendChild(bSave);
  box.appendChild(btns);

  return box;
}

/* 编辑弹窗：整体替换字段保存（updateWord） */
function openVocabEditModal(w, root) {
  var seed = {
    word: w.word, library: (w.contexts[0] || {}).library,
    phonetic: w.phonetic, partOfSpeech: w.partOfSpeech,
    definitions: w.definitions, englishDefinition: w.englishDefinition,
    exampleSentence: w.exampleSentence, collocations: w.collocations,
    sourceType: w.sourceType, sourceTitle: w.sourceTitle, sourceExcerpt: w.sourceExcerpt,
    examTags: w.examTags, domainTags: w.domainTags, difficulty: w.difficulty,
    notes: w.notes, sense: (w.contexts[0] || {}).sense
  };
  var body = el('div');
  var form = buildVocabForm(seed, root, function (s) {
    w.word = s.word;
    w.phonetic = s.phonetic; w.partOfSpeech = s.partOfSpeech;
    w.definitions = s.definitions.map(function (t) { return { text: t, aiGenerated: !!s.aiGenerated }; });
    w.englishDefinition = s.englishDefinition;
    w.exampleSentence = s.exampleSentence;
    w.collocations = s.collocations;
    w.sourceType = s.sourceType; w.sourceTitle = s.sourceTitle; w.sourceExcerpt = s.sourceExcerpt;
    w.examTags = s.examTags; w.domainTags = s.domainTags;
    w.difficulty = s.difficulty; w.notes = s.notes;
    if (s.aiGenerated) {
      w.aiGenerated = { definitions: true, example: true, collocations: true };
    }
    VocabEngine.ensureNormalized(w);
    saveData();
    modal.close();
    renderVocabCenter(root);
    updateStatusbar();
  });
  body.appendChild(form);
  var modal = openModal({ title: '编辑词条', body: body, cardCls: 'modal-card-fs' });
}

/* AI 辅助补全：调用 DeepSeek 获取释义/音标/词性/搭配/自拟例句。
 * 结果只填入表单（aiDraft 标记），用户确认保存后才入库；
 * 未配置 API Key 时给出引导。 */
const VOCAB_AI_SYSTEM_PROMPT = [
  '你是词典编纂助手。用户给一个英文单词/短语与学习语境，你输出严格的 JSON（只输出 JSON，不要多余文字）：',
  '{"phonetic":"音标","partOfSpeech":"词性缩写（n./v./adj./adv.）","definitions":["中文释义1","中文释义2"],"englishDefinition":"英文释义","exampleSentence":"自拟例句","collocations":["搭配1","搭配2"]}',
  '要求：',
  '1. 释义准确简洁，中文释义不超过 3 条；',
  '2. 例句必须是自拟的，尽量贴合用户的学习语境（学术/AI/机器人等），不得从受版权保护材料中复制长句；',
  '3. 拿不准的释义宁可省略，不要编造；',
  '4. 单词是短语时按短语整体解释。'
].join('\n');

function runVocabAiAssist(wordText, library, inputs) {
  if (!wordText) { alert('请先填写单词'); return; }
  if (!state.data.aiConfig.apiKey) {
    alert('尚未配置 DeepSeek API Key：请点击右上角「设置」→「外观与AI」填写。');
    return;
  }
  var lib = VOCAB_LIBRARIES.find(function (l) { return l.key === library; });
  inputs.saveBtn.textContent = 'AI 生成中…';
  callDeepSeek(
    '请为单词「' + wordText + '」生成词典条目。学习语境：' + (lib ? lib.label + '（' + lib.desc + '）' : '通用英语') + '。',
    function (err, reply) {
      inputs.saveBtn.textContent = '保存词条';
      if (err) { alert(err); return; }
      var m = /```json\s*([\s\S]*?)```/i.exec(reply);
      var jsonStr = m ? m[1] : reply;
      var s = jsonStr.indexOf('{');
      var e = jsonStr.lastIndexOf('}');
      if (s === -1 || e <= s) { alert('AI 返回格式异常，请重试。'); return; }
      var obj;
      try { obj = JSON.parse(jsonStr.slice(s, e + 1)); } catch (err2) { alert('AI 返回 JSON 解析失败，请重试。'); return; }
      if (obj.phonetic) inputs.phonetic.value = String(obj.phonetic);
      if (obj.partOfSpeech) inputs.pos.value = String(obj.partOfSpeech);
      if (Array.isArray(obj.definitions) && obj.definitions.length) {
        inputs.defs.value = obj.definitions.map(String).join('\n');
      }
      if (obj.englishDefinition) inputs.eng.value = String(obj.englishDefinition);
      if (obj.exampleSentence) inputs.example.value = String(obj.exampleSentence);
      if (Array.isArray(obj.collocations) && obj.collocations.length) {
        inputs.colloc.value = obj.collocations.map(String).join('\n');
      }
      vcAddAiDraft = true;
      inputs.hint.style.display = '';
      inputs.hint.textContent = '✦ 以上内容由 AI 生成，未经核实——请逐条确认（音标/词性/释义/例句）后再保存。保存的词条将带 AI 生成标记。';
    },
    VOCAB_AI_SYSTEM_PROMPT
  );
}

/* ---------------- 复习练习（5 模式 + 时间预算） ---------------- */

let vcQuiz = null;   // { queue, index, correct, errors, mode, lib, startTs, newLearned }

const PRACTICE_MODES = [
  ['en2zh', '英→中认义'],
  ['zh2en', '中→英回忆'],
  ['fill', '例句填空'],
  ['colloc', '搭配练习'],
  ['wrong', '错词复习']
];

function renderVocabPractice(root) {
  var plan = VocabEngine.computeDailyPlan(todayStr());

  var planCard = el('div', 'card');
  planCard.appendChild(el('div', 'card-title', '今日词汇学习计划'));
  var grid = el('div', 'budget-grid');
  [['每日预算', plan.budgetMin + '–' + plan.budgetMax + ' 分钟'],
   ['待复习积压', plan.dueCount + ' 个'],
   ['今日新增目标', plan.newWords + ' 个（预算封顶后）'],
   ['预计用时', plan.minutes + ' 分钟']].forEach(function (c) {
    var box = el('div', 'budget-cell');
    box.appendChild(el('div', 'budget-label', c[0]));
    box.appendChild(el('div', 'budget-value', c[1]));
    grid.appendChild(box);
  });
  planCard.appendChild(grid);
  if (plan.backlogPaused) {
    planCard.appendChild(el('div', 'banner warn',
      '复习积压 ≥ ' + state.data.vocabCenter.settings.backlogPauseAt + ' 个：今日暂停新增，优先复习（复习优先于一切新增）。'));
  } else if (plan.backlogReduced) {
    planCard.appendChild(el('div', 'banner warn',
      '复习积压 ≥ ' + state.data.vocabCenter.settings.backlogReduceAt + ' 个：今日新增目标自动减半，优先复习。'));
  } else {
    planCard.appendChild(el('div', 'hint',
      '每周新增目标：通用进阶 ' + state.data.vocabCenter.settings.libraries.general_advanced.weeklyNew +
      ' · 学术英语 ' + state.data.vocabCenter.settings.libraries.academic_english.weeklyNew +
      ' · AI专业 ' + state.data.vocabCenter.settings.libraries.ai_robotics.weeklyNew + ' 个（可在「设置」修改）'));
  }
  root.appendChild(planCard);

  if (vcQuiz) {
    root.appendChild(renderVocabQuizCard(root));
    return;
  }

  var startCard = el('div', 'card');
  startCard.appendChild(el('div', 'card-title', '开始练习'));
  var row = el('div', 'field-row');
  row.appendChild(el('label', null, '模式'));
  var modeSel = vcSelect(PRACTICE_MODES, 'en2zh');
  row.appendChild(modeSel);
  row.appendChild(el('label', null, '词库'));
  var libSel2 = vcSelect([['', '全部词库']].concat(VOCAB_LIBRARIES.map(function (l) { return [l.key, l.label]; })), '');
  row.appendChild(libSel2);
  row.appendChild(el('label', null, '题数'));
  var nSel = vcSelect([[5, '5 题'], [10, '10 题'], [20, '20 题']], 10);
  row.appendChild(nSel);
  startCard.appendChild(row);

  var bStart = el('button', 'btn btn-primary', '开始练习');
  bStart.addEventListener('click', function () {
    var pool;
    var mode = modeSel.value;
    if (mode === 'wrong') {
      pool = VocabEngine.wrongWords({ library: libSel2.value || undefined });
      if (!pool.length) { alert('暂无错词，太棒了！试试其他模式。'); return; }
    } else {
      pool = VocabEngine.dueWords({ library: libSel2.value || undefined });
    }
    if (!pool.length) { alert('当前没有到期待复习的词。新词加入后会自动出现在这里。'); return; }
    vcQuiz = {
      queue: shuffle(pool).slice(0, Number(nSel.value)),
      index: 0, correct: 0, errors: 0,
      mode: modeSel.value, startTs: Date.now(), newLearned: 0
    };
    renderVocabCenter(root);
  });
  startCard.appendChild(bStart);
  startCard.appendChild(el('div', 'hint',
    '练习对象 = 到期待复习词（新词当天、学习中 1 天、已掌握 3 天间隔）。答对/答错即时更新掌握度与错误率；指定词库时更新该词库的专业语境掌握度。'));
  root.appendChild(startCard);
}

function renderVocabQuizCard(root) {
  var card = el('div', 'card');
  var q = vcQuiz;
  var w = q.queue[q.index];

  var head = el('div', 'card-title');
  head.appendChild(el('span', null, '练习中（第 ' + (q.index + 1) + ' / ' + q.queue.length + ' 题）'));
  var prog = el('div', 'progress-track vc-progress');
  var fill = el('div', 'progress-fill');
  fill.style.width = Math.round(q.index / q.queue.length * 100) + '%';
  prog.appendChild(fill);
  card.appendChild(prog);
  card.appendChild(head);

  var body = el('div', 'vc-quiz');
  var qText = buildQuizPrompt(q, w);
  body.appendChild(el('div', 'vc-quiz-prompt', qText.prompt));
  if (qText.sub) body.appendChild(el('div', 'hint', qText.sub));

  function answer(correct, chosenText) {
    var wasNew = w.status === 'new' && w.correctCount === 0;   // 记录前判定"新学词"
    VocabEngine.recordReview(w.id, {
      library: (w.contexts[0] || {}).library,
      correct: correct,
      mode: q.mode
    });
    if (correct) q.correct++;
    else q.errors++;
    if (wasNew) q.newLearned++;
    body.innerHTML = '';
    var fb = el('div', 'vc-quiz-fb ' + (correct ? 'ok' : 'bad'), correct ? '✓ 正确' : '✗ 回答错误');
    body.appendChild(fb);
    if (!correct && qText.answer) body.appendChild(el('div', 'hint', '正确答案：' + qText.answer));
    q.index++;
    if (q.index >= q.queue.length) {
      finishVocabQuiz(root);
    } else {
      setTimeout(function () { renderVocabCenter(root); }, 900);
    }
  }

  if (qText.type === 'choice') {
    qText.options.forEach(function (opt) {
      var b = el('button', 'btn vc-opt', opt);
      b.addEventListener('click', function () { answer(opt === qText.correctOption, opt); });
      body.appendChild(b);
    });
  } else {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = '输入英文单词（不区分大小写）';
    body.appendChild(inp);
    var bOk = el('button', 'btn btn-primary', '提交');
    bOk.addEventListener('click', function () {
      var val = VocabEngine.normalizeWord(inp.value);
      answer(val === VocabEngine.normalizeWord(qText.correctOption), inp.value.trim());
    });
    body.appendChild(bOk);
  }
  card.appendChild(body);
  return card;
}

/* 组题：choice 四选一 / input 填空 */
function buildQuizPrompt(q, w) {
  var mode = q.mode;
  var words = VocabEngine.words();
  var otherDefs = words.filter(function (x) { return x.id !== w.id && x.definitions.length; })
    .map(function (x) { return { word: x.word, def: x.definitions[0].text }; });

  if (mode === 'zh2en') {
    var opts = [w.word].concat(shuffle(otherDefs).slice(0, 3).map(function (x) { return x.word; }));
    return {
      type: 'choice',
      prompt: w.definitions.map(function (d) { return d.text; }).join('；'),
      sub: '选择对应的英文单词（' + w.partOfSpeech + '）',
      options: shuffle(opts),
      correctOption: w.word,
      answer: w.word
    };
  }
  if (mode === 'fill') {
    if (!w.exampleSentence) {
      /* 无例句 → 降级为英→中 */
      var defs = shuffle(otherDefs).slice(0, 3).map(function (x) { return x.def; });
      var opts2 = [w.definitions[0].text].concat(defs);
      return {
        type: 'choice',
        prompt: w.word,
        sub: w.phonetic || '',
        options: shuffle(opts2),
        correctOption: w.definitions[0].text,
        answer: w.definitions[0].text
      };
    }
    var blanked = w.exampleSentence.replace(new RegExp(escapeRegExp(w.word), 'i'), '____');
    return { type: 'input', prompt: blanked, sub: '填入缺失的单词', correctOption: w.word, answer: w.word };
  }
  if (mode === 'colloc') {
    var col = (w.collocations || []).find(function (c) { return c.toLowerCase().indexOf(w.normalizedWord) !== -1; });
    if (!col) {
      /* 无搭配 → 降级为英→中 */
      var defs3 = shuffle(otherDefs).slice(0, 3).map(function (x) { return x.def; });
      var opts3 = [w.definitions[0].text].concat(defs3);
      return {
        type: 'choice',
        prompt: w.word,
        sub: w.phonetic || '',
        options: shuffle(opts3),
        correctOption: w.definitions[0].text,
        answer: w.definitions[0].text
      };
    }
    return {
      type: 'input',
      prompt: col.replace(new RegExp(escapeRegExp(w.word), 'i'), '____'),
      sub: '补全搭配',
      correctOption: w.word,
      answer: col
    };
  }
  /* en2zh / wrong */
  var defsE = shuffle(otherDefs).slice(0, 3).map(function (x) { return x.def; });
  var optsE = [w.definitions[0].text].concat(defsE);
  return {
    type: 'choice',
    prompt: w.word,
    sub: (w.phonetic ? w.phonetic + ' · ' : '') + (w.partOfSpeech || ''),
    options: shuffle(optsE),
    correctOption: w.definitions[0].text,
    answer: w.definitions[0].text
  };
}

function finishVocabQuiz(root) {
  var q = vcQuiz;
  vcQuiz = null;
  var minutes = Math.round((Date.now() - q.startTs) / 60000 * 10) / 10;
  VocabEngine.logSession(todayStr(), {
    minutes: Math.round((Date.now() - q.startTs) / 60000),
    reviewedWords: q.correct + q.errors,
    newWords: q.newLearned,
    errors: q.errors
  });
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '本轮练习完成'));
  var grid = el('div', 'budget-grid');
  [['答对', q.correct + ' 题'], ['答错', q.errors + ' 题'],
   ['用时', minutes + ' 分钟'], ['新学词', q.newLearned + ' 个']].forEach(function (c) {
    var box = el('div', 'budget-cell');
    box.appendChild(el('div', 'budget-label', c[0]));
    box.appendChild(el('div', 'budget-value', c[1]));
    grid.appendChild(box);
  });
  card.appendChild(grid);
  card.appendChild(el('div', 'hint', '已记入今日词汇学习记录；答错词汇自动进入「错词复习」。'));
  var bAgain = el('button', 'btn btn-primary', '再练一轮');
  bAgain.addEventListener('click', function () { renderVocabCenter(root); });
  card.appendChild(bAgain);
  root.appendChild(card);
  updateStatusbar();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* ---------------- 导入导出 ---------------- */

let vcPreview = null;   // 解析后的预览结果（确认前不入库）

function renderVocabIO(root) {
  var impCard = el('div', 'card');
  impCard.appendChild(el('div', 'card-title', '导入词条（CSV / JSON）'));
  impCard.appendChild(el('div', 'hint',
    '支持本网站导出的 CSV/JSON、墨墨词表（word,definition）、Anki 卡片（Front,Back,Tags）。导入前先预览：重复与错误行会标出，确认后只新增不覆盖。'));

  var fileInp = document.createElement('input');
  fileInp.type = 'file';
  fileInp.accept = '.csv,.json,.txt';
  impCard.appendChild(fileInp);
  var ta = document.createElement('textarea');
  ta.rows = 4;
  ta.placeholder = '也可以直接把 CSV/JSON 内容粘贴到这里…';
  impCard.appendChild(ta);

  var bParse = el('button', 'btn', '解析预览');
  bParse.addEventListener('click', function () {
    var text = ta.value.trim();
    if (!text && fileInp.files && fileInp.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { parseVocabImport(reader.result, impCard, root); };
      reader.readAsText(fileInp.files[0], 'utf-8');
      return;
    }
    parseVocabImport(text, impCard, root);
  });
  impCard.appendChild(bParse);
  root.appendChild(impCard);

  var expCard = el('div', 'card');
  expCard.appendChild(el('div', 'card-title', '导出词库'));
  expCard.appendChild(el('div', 'hint',
    '按词库与标签导出：标准 CSV 可再导入（Excel 打开不乱码）；Anki 模板 Front/Back/Tags；墨墨模板 word/释义。'));
  var row = el('div', 'field-row');
  row.appendChild(el('label', null, '词库'));
  var libSel = vcSelect([['', '全部']].concat(VOCAB_LIBRARIES.map(function (l) { return [l.key, l.label]; })), '');
  row.appendChild(libSel);
  row.appendChild(el('label', null, '标签（可选）'));
  var tagSel = vcSelect([['', '无']].concat(
    VOCAB_EXAM_TAGS.map(function (x) { return ['exam:' + x, '考试·' + x]; }),
    VOCAB_DOMAIN_TAGS.map(function (x) { return ['domain:' + x, '方向·' + x]; })
  ), '');
  row.appendChild(tagSel);
  expCard.appendChild(row);

  var row2 = el('div', 'vc-form-btns');
  [['standard', '导出标准 CSV'], ['anki', '导出 Anki CSV'], ['momo', '导出墨墨 CSV'], ['json', '导出 JSON']].forEach(function (tpl) {
    var b = el('button', 'btn', tpl[1]);
    b.addEventListener('click', function () {
      var opts = { library: libSel.value || undefined };
      var tg = tagSel.value;
      if (tg.indexOf('exam:') === 0) opts.examTag = tg.slice(5);
      if (tg.indexOf('domain:') === 0) opts.domainTag = tg.slice(7);
      var words = VocabEngine.listWords(opts);
      if (!words.length) { alert('没有符合筛选条件的词条'); return; }
      var fn = 'vocab-' + todayStr().replace(/-/g, '') + '-' + tpl[0] + '.' + (tpl[0] === 'json' ? 'json' : 'csv');
      var content = tpl[0] === 'json'
        ? VocabEngine.buildJson(words)
        : VocabEngine.buildCsv(words, { template: tpl[0], library: opts.library });
      downloadText(fn, content);
    });
    row2.appendChild(b);
  });
  expCard.appendChild(row2);
  expCard.appendChild(el('div', 'hint',
    '协作建议：墨墨背单词负责雅思与四六级通用词的日常记忆，本网站负责学术英语与 AI/机器人专业词库。把「通用进阶」词库导出为墨墨格式即可导入墨墨；本站不假设第三方开放 API，复习结果请以 CSV/JSON 人工互通。'));
  root.appendChild(expCard);
}

/* 解析 + 预览渲染（可重复调用，覆盖上一次预览） */
function parseVocabImport(text, impCard, root) {
  if (!text) { alert('请先粘贴内容或选择文件'); return; }
  var prev = text.trim().charAt(0) === '[' || text.trim().charAt(0) === '{'
    ? VocabEngine.parseImportJson(text)
    : VocabEngine.parseImportCsv(text);
  if (impCard.querySelector) {
    var old = impCard.querySelector('.vc-preview');
    if (old) old.remove();
  }
  if (!prev.ok) { alert(prev.error); return; }
  vcPreview = prev;

  var box = el('div', 'card vc-preview');
  box.appendChild(el('div', 'card-title', '导入预览（尚未写入词库）'));
  var sum = el('div', 'hint', '可新增 ' + prev.counts.new + ' 条 · 重复跳过 ' + prev.counts.duplicate +
    ' 条 · 格式错误 ' + prev.counts.error + ' 条');
  box.appendChild(sum);
  if (prev.counts.error) {
    box.appendChild(el('div', 'banner warn', '有 ' + prev.counts.error + ' 行格式错误，将跳过。请修正文件后重新预览。'));
  }

  var table = el('div', 'vc-preview-table');
  var headRow = el('div', 'vc-preview-row vc-preview-head');
  ['单词', '词库', '状态', '说明'].forEach(function (h) {
    headRow.appendChild(el('span', null, h));
  });
  table.appendChild(headRow);
  prev.items.slice(0, 50).forEach(function (it) {
    var r = el('div', 'vc-preview-row');
    r.appendChild(el('span', null, it.seed.word || '—'));
    r.appendChild(el('span', null, it.seed.library || 'general_advanced'));
    var st = el('span', 'vc-pt ' + it.status, { 'new': '新增', duplicate: '重复', error: '错误' }[it.status]);
    r.appendChild(st);
    r.appendChild(el('span', 'hint', it.reasons.join('；')));
    table.appendChild(r);
  });
  box.appendChild(table);
  if (prev.items.length > 50) box.appendChild(el('div', 'hint', '（仅显示前 50 行）'));

  var bApply = el('button', 'btn btn-primary', '确认导入（只新增，不覆盖）');
  bApply.addEventListener('click', function () {
    if (!vcPreview) return;
    var r = VocabEngine.applyImport(vcPreview.items);
    alert('导入完成：新增 ' + r.added + ' 条，跳过重复 ' + r.skippedDuplicate + ' 条，跳过错误 ' + r.skippedError + ' 条。');
    vcPreview = null;
    renderVocabCenter(root);
    updateStatusbar();
  });
  box.appendChild(bApply);
  impCard.appendChild(box);
}

/* ---------------- 学习统计 ---------------- */

function renderVocabStats(root) {
  var s = VocabEngine.computeStats();
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '学习统计'));
  var grid = el('div', 'budget-grid');
  [['词库总量', s.total + ' 条'], ['待复习积压', s.backlog + ' 条'],
   ['近7天新增', s.activity.added7d + ' 条'], ['近7天复习', s.activity.reviewed7d + ' 次'],
   ['近7天用时', s.activity.minutes7d + ' 分钟']].forEach(function (c) {
    var box = el('div', 'budget-cell');
    box.appendChild(el('div', 'budget-label', c[0]));
    box.appendChild(el('div', 'budget-value', c[1]));
    grid.appendChild(box);
  });
  card.appendChild(grid);

  var table = el('div', 'vc-preview-table');
  var head = el('div', 'vc-preview-row vc-preview-head');
  ['词库', '词量', '新学', '学习中', '已掌握', '基础掌握度', '语境掌握度', '错误率', '待复习', '语境弱项'].forEach(function (h) {
    head.appendChild(el('span', null, h));
  });
  table.appendChild(head);
  VOCAB_LIBRARIES.forEach(function (l) {
    var st = s.byLibrary[l.key];
    if (!st) return;
    var r = el('div', 'vc-preview-row');
    [st.label, st.total, st.newCount, st.learning, st.mastered,
     (st.basicMasteryAvg * 25).toFixed(0) + '%', (st.ctxMasteryAvg * 25).toFixed(0) + '%',
     (st.errorRate * 100).toFixed(1) + '%', st.due, st.contextWeak].forEach(function (v) {
      r.appendChild(el('span', null, String(v)));
    });
    table.appendChild(r);
  });
  card.appendChild(table);
  card.appendChild(el('div', 'hint',
    '基础掌握度 = 基础词义平均掌握水平；语境掌握度 = 各词库专业词义平均掌握水平（两者独立追踪）。语境弱项 = 基础已掌握但专业语境词义未掌握的词数。'));
  root.appendChild(card);
}

/* ---------------- 设置（预算·比例·备份恢复） ---------------- */

function renderVocabSettings(root) {
  var s = state.data.vocabCenter.settings;

  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '学习计划默认值'));

  var r1 = el('div', 'field-row');
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '每日预算下限（分钟）'));
  var inpMin = document.createElement('input');
  inpMin.type = 'number'; inpMin.min = '5'; inpMin.value = s.dailyBudget.min;
  f1.appendChild(inpMin);
  r1.appendChild(f1);
  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '每日预算上限（分钟）'));
  var inpMax = document.createElement('input');
  inpMax.type = 'number'; inpMax.min = '5'; inpMax.value = s.dailyBudget.max;
  f2.appendChild(inpMax);
  r1.appendChild(f2);
  card.appendChild(r1);

  var r2 = el('div', 'field-row');
  var f3 = el('div', 'field');
  f3.appendChild(el('label', null, '每周新增总目标（个）'));
  var inpTotal = document.createElement('input');
  inpTotal.type = 'number'; inpTotal.min = '0'; inpTotal.value = s.weeklyNewTotal;
  f3.appendChild(inpTotal);
  r2.appendChild(f3);
  var f4 = el('div', 'field');
  f4.appendChild(el('label', null, '积压减半阈值'));
  var inpReduce = document.createElement('input');
  inpReduce.type = 'number'; inpReduce.min = '0'; inpReduce.value = s.backlogReduceAt;
  f4.appendChild(inpReduce);
  r2.appendChild(f4);
  var f5 = el('div', 'field');
  f5.appendChild(el('label', null, '积压暂停阈值'));
  var inpPause = document.createElement('input');
  inpPause.type = 'number'; inpPause.min = '0'; inpPause.value = s.backlogPauseAt;
  f5.appendChild(inpPause);
  r2.appendChild(f5);
  card.appendChild(r2);

  var libBox = el('div', 'vc-lib-settings');
  VOCAB_LIBRARIES.forEach(function (l) {
    var cfg = s.libraries[l.key] || {};
    var row = el('div', 'field-row');
    row.appendChild(el('span', 'vc-lib-label', l.label));
    var g1 = el('div', 'field');
    g1.appendChild(el('label', null, '每周新增（个）'));
    var inpW = document.createElement('input');
    inpW.type = 'number'; inpW.min = '0'; inpW.value = cfg.weeklyNew;
    g1.appendChild(inpW);
    row.appendChild(g1);
    var g2 = el('div', 'field');
    g2.appendChild(el('label', null, '新增比例（%）'));
    var inpR = document.createElement('input');
    inpR.type = 'number'; inpR.min = '0'; inpR.max = '100'; inpR.value = cfg.ratio;
    g2.appendChild(inpR);
    row.appendChild(g2);
    row._lib = l.key; row._inpW = inpW; row._inpR = inpR;
    libBox.appendChild(row);
  });
  card.appendChild(libBox);

  var cbRow = el('label', 'checkbox-row');
  var cbFirst = document.createElement('input');
  cbFirst.type = 'checkbox';
  cbFirst.checked = !!s.reviewFirst;
  cbRow.appendChild(cbFirst);
  cbRow.appendChild(el('span', null, '复习积压时优先复习、自动降低新增量'));
  card.appendChild(cbRow);

  var bSave = el('button', 'btn btn-primary', '保存设置');
  bSave.addEventListener('click', function () {
    var min = Number(inpMin.value), max = Number(inpMax.value);
    if (!(min > 0 && max >= min)) { alert('预算区间不合法（下限 ≥ 5 且上限 ≥ 下限）'); return; }
    s.dailyBudget = { min: min, max: max };
    s.weeklyNewTotal = Math.max(0, Number(inpTotal.value) || 0);
    s.backlogReduceAt = Math.max(0, Number(inpReduce.value) || 0);
    s.backlogPauseAt = Math.max(0, Number(inpPause.value) || 0);
    s.reviewFirst = cbFirst.checked;
    libBox.childNodes.forEach(function (row) {
      if (!row._lib) return;
      s.libraries[row._lib].weeklyNew = Math.max(0, Number(row._inpW.value) || 0);
      s.libraries[row._lib].ratio = Math.max(0, Math.min(100, Number(row._inpR.value) || 0));
    });
    saveData();
    alert('已保存。新设置即时生效（复习练习页的今日计划会同步更新）。');
    renderVocabCenter(root);
  });
  card.appendChild(bSave);
  root.appendChild(card);

  /* 数据备份 */
  var bkCard = el('div', 'card');
  bkCard.appendChild(el('div', 'card-title', '数据备份与恢复'));
  bkCard.appendChild(el('div', 'hint', '版本升级前系统会自动备份原始数据；也可以随时手动备份、导出备份文件或恢复。'));

  var bManual = el('button', 'btn', '立即手动备份');
  bManual.addEventListener('click', function () {
    var r = manualBackup();
    if (r.ok) { alert('已备份到 ' + r.key); renderVocabCenter(root); }
    else alert(r.error);
  });
  bkCard.appendChild(bManual);

  var backups = listBackups();
  if (!backups.length) {
    bkCard.appendChild(el('div', 'hint', '暂无备份记录。'));
  } else {
    backups.forEach(function (b) {
      var row = el('div', 'task-row');
      row.appendChild(el('span', 'task-title', 'v' + b.fromVersion + ' 备份 · ' + b.date));
      var acts = el('div', 'task-actions');
      var bExp = el('button', 'btn btn-sm', '导出');
      bExp.addEventListener('click', function () {
        var raw = localStorage.getItem(b.key);
        if (!raw) { alert('备份内容不存在'); return; }
        downloadText(b.key + '.json', raw);
      });
      var bRestore = el('button', 'btn btn-sm', '恢复');
      bRestore.addEventListener('click', function () {
        confirmModal('恢复备份', '恢复会【覆盖】当前全部数据（含词汇中心），且恢复后页面将刷新。确定恢复 ' + b.date + ' 的备份？',
          { danger: true, okLabel: '恢复并刷新' })
          .then(function (ok) {
            if (!ok) return;
            var r = restoreBackup(b.key);
            if (!r.ok) { alert(r.error); return; }
            location.reload();
          });
      });
      acts.appendChild(bExp);
      acts.appendChild(bRestore);
      row.appendChild(acts);
      bkCard.appendChild(row);
    });
  }
  root.appendChild(bkCard);
}
