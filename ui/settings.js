/* ============================================================
 * ui/settings.js —— 设置面板（v3，替代 v2 settings.js）
 * 六组：个人设置（含睡眠/健身/负荷）/ 目标与阶段 / 推免政策 /
 *       规则与学期 / 外观与AI / 数据管理（含快照系统）
 * ============================================================ */

let settingsModal = null;
let settingsGroup = 'profile';   // 模块级"当前分组"记忆

const SETTINGS_GROUPS = [
  ['profile', '个人设置'],
  ['goals', '目标与阶段'],
  ['policies', '推免政策'],
  ['rules', '规则与学期'],
  ['appearance', '外观与AI'],
  ['data', '数据管理'],
  ['sync', '数据互通']
];

function openSettingsPanel() {
  if (settingsModal) {
    settingsModal.close();
    settingsModal = null;
  }
  var btn = document.getElementById('btn-settings');
  var rect = btn.getBoundingClientRect ? btn.getBoundingClientRect() : { x: 0, y: 0 };
  var origin = { x: (rect.x + rect.width / 2) + 'px', y: (rect.y + rect.height / 2) + 'px' };

  var body = el('div');
  var modal = openModal({
    title: '设置',
    body: body,
    origin: origin,
    onClose: function () {
      settingsModal = null;
      refreshCurrentView();
    }
  });
  settingsModal = modal;
  renderSettingsInto(body);
}

/* 重渲面板 body（切换分组不重开面板） */
function renderSettingsInto(body) {
  body.innerHTML = '';

  var nav = el('div', 'subnav settings-subnav');
  SETTINGS_GROUPS.forEach(function (item) {
    var b = el('button', 'subnav-btn' + (settingsGroup === item[0] ? ' active' : ''), item[1]);
    b.addEventListener('click', function () {
      settingsGroup = item[0];
      renderSettingsInto(body);
    });
    nav.appendChild(b);
  });
  body.appendChild(nav);

  var groupBody = el('div', 'settings-group-body');
  if (settingsGroup === 'profile') renderSettingsProfile(groupBody);
  else if (settingsGroup === 'goals') renderSettingsGoals(groupBody);
  else if (settingsGroup === 'policies') renderSettingsPolicies(groupBody);
  else if (settingsGroup === 'rules') renderSettingsRules(groupBody);
  else if (settingsGroup === 'appearance') renderSettingsAppearance(groupBody);
  else if (settingsGroup === 'sync') renderSettingsSync(groupBody);
  else renderSettingsData(groupBody);
  body.appendChild(groupBody);
}

/* 通用文本字段工厂 */
function textField(label, key, type, obj, onSaved) {
  var f = el('div', 'field');
  f.appendChild(el('label', null, label));
  var inp = document.createElement('input');
  inp.type = type || 'text';
  inp.value = obj[key] != null ? obj[key] : '';
  inp.addEventListener('change', function () {
    obj[key] = type === 'number' ? (Number(inp.value) || 0) : inp.value;
    saveData();
    if (onSaved) onSaved();
  });
  f.appendChild(inp);
  return f;
}

/* ---------------- 1. 个人设置 ---------------- */

function renderSettingsProfile(root) {
  var p = state.data.userProfile;
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '基本信息'));
  sec.appendChild(textField('姓名', 'name', 'text', p));
  sec.appendChild(textField('学校', 'school', 'text', p));
  sec.appendChild(textField('学院', 'college', 'text', p));
  sec.appendChild(textField('专业', 'major', 'text', p));
  sec.appendChild(textField('年级', 'grade', 'text', p));
  sec.appendChild(textField('目标院校', 'targetSchool', 'text', p));
  sec.appendChild(textField('绩点目标', 'gpaTarget', 'number', p));
  sec.appendChild(textField('英语目标（CET）', 'englishTarget', 'number', p));
  root.appendChild(sec);

  var sec2 = el('div', 'settings-section');
  sec2.appendChild(el('div', 'sec-title', '时间与负荷（Time Budget 输入）'));
  sec2.appendChild(el('div', 'hint', '周学习时长不再使用固定目标：由时间预算引擎根据课程、历史执行数据动态计算（旧 28h 目标已废弃）。'));

  var sleepRow = el('div', 'field-row');
  var fs1 = el('div', 'field');
  fs1.appendChild(el('label', null, '就寝时间'));
  var inpSleepStart = document.createElement('input');
  inpSleepStart.type = 'time';
  inpSleepStart.value = p.sleep ? p.sleep.start : '23:30';
  inpSleepStart.addEventListener('change', function () {
    p.sleep = p.sleep || {};
    p.sleep.start = inpSleepStart.value || '23:30';
    saveData();
  });
  fs1.appendChild(inpSleepStart);
  sleepRow.appendChild(fs1);
  var fs2 = el('div', 'field');
  fs2.appendChild(el('label', null, '起床时间'));
  var inpSleepEnd = document.createElement('input');
  inpSleepEnd.type = 'time';
  inpSleepEnd.value = p.sleep ? p.sleep.end : '07:30';
  inpSleepEnd.addEventListener('change', function () {
    p.sleep = p.sleep || {};
    p.sleep.end = inpSleepEnd.value || '07:30';
    saveData();
  });
  fs2.appendChild(inpSleepEnd);
  sleepRow.appendChild(fs2);
  sec2.appendChild(sleepRow);

  var gymRow = el('div', 'field-row');
  var fg1 = el('div', 'field');
  fg1.appendChild(el('label', null, '健身次数（最少）'));
  var inpGymMin = document.createElement('input');
  inpGymMin.type = 'number';
  inpGymMin.value = (p.gym && p.gym.daysPerWeek) ? p.gym.daysPerWeek[0] : 2;
  inpGymMin.addEventListener('change', function () {
    p.gym = p.gym || {};
    p.gym.daysPerWeek = [clamp(Number(inpGymMin.value) || 2, 1, 7), (p.gym.daysPerWeek && p.gym.daysPerWeek[1]) || 3];
    saveData();
  });
  fg1.appendChild(inpGymMin);
  gymRow.appendChild(fg1);
  var fg2 = el('div', 'field');
  fg2.appendChild(el('label', null, '健身次数（最多）'));
  var inpGymMax = document.createElement('input');
  inpGymMax.type = 'number';
  inpGymMax.value = (p.gym && p.gym.daysPerWeek) ? p.gym.daysPerWeek[1] : 3;
  inpGymMax.addEventListener('change', function () {
    p.gym = p.gym || {};
    p.gym.daysPerWeek = [(p.gym.daysPerWeek && p.gym.daysPerWeek[0]) || 2, clamp(Number(inpGymMax.value) || 3, 1, 7)];
    saveData();
  });
  fg2.appendChild(inpGymMax);
  gymRow.appendChild(fg2);
  var fg3 = el('div', 'field');
  fg3.appendChild(el('label', null, '健身结束时间（17:30-18:30 左右）'));
  var inpGymEnd = document.createElement('input');
  inpGymEnd.type = 'time';
  inpGymEnd.value = (p.gym && p.gym.endBy) || '18:30';
  inpGymEnd.addEventListener('change', function () {
    p.gym = p.gym || {};
    p.gym.endBy = inpGymEnd.value || '18:30';
    saveData();
  });
  fg3.appendChild(inpGymEnd);
  gymRow.appendChild(fg3);
  sec2.appendChild(gymRow);

  sec2.appendChild(textField('每日学习负荷上限（小时）', 'dailyStudyCapHours', 'number', p));
  sec2.appendChild(textField('无历史数据时的初始锚定（小时/周，真实能力 14-21）', 'initialHistoryAvgHours', 'number', p));
  sec2.appendChild(textField('每周刚性作业估算（小时）', 'homeworkHoursPerWeek', 'number', p));
  root.appendChild(sec2);
}

/* ---------------- 2. 目标与阶段 ---------------- */

function renderSettingsGoals(root) {
  var goals = state.data.goals;
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '长期目标'));
  var lt = goals.longTerm;
  sec.appendChild(textField('毕业年份', 'year', 'number', lt));
  sec.appendChild(textField('目标（如：获得推免资格）', 'target', 'text', lt));
  sec.appendChild(textField('目标院校', 'targetSchool', 'text', lt));
  sec.appendChild(textField('技术方向（如：AI / Robotics / Embodied Intelligence）', 'direction', 'text', lt));
  sec.appendChild(textField('偏好', 'preference', 'text', lt));
  root.appendChild(sec);

  var sec2 = el('div', 'settings-section');
  sec2.appendChild(el('div', 'sec-title', '阶段目标（8 学期）'));
  goals.stages.forEach(function (s) {
    var block = el('div', 'settings-subsection');
    block.appendChild(el('div', 'hint', s.label + '（' + (s.weeks ? '第' + s.weeks[0] + '-' + s.weeks[1] + '周' : '连续周 ' + s.offset[0] + '-' + s.offset[1]) + '）'));

    var f1 = el('div', 'field');
    f1.appendChild(el('label', null, '阶段定位（phase）'));
    var inpPhase = document.createElement('input');
    inpPhase.value = s.phase || '';
    inpPhase.addEventListener('change', function () { s.phase = inpPhase.value; saveData(); });
    f1.appendChild(inpPhase);
    block.appendChild(f1);

    var f2 = el('div', 'field');
    f2.appendChild(el('label', null, '阶段目标（顿号分隔）'));
    var inpGoals = document.createElement('input');
    inpGoals.value = (s.goals || []).join('、');
    inpGoals.addEventListener('change', function () {
      s.goals = inpGoals.value.split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
      saveData();
    });
    f2.appendChild(inpGoals);
    block.appendChild(f2);

    var f3 = el('div', 'field');
    f3.appendChild(el('label', null, '阶段重点'));
    var inpFocus = document.createElement('input');
    inpFocus.value = s.focus || '';
    inpFocus.addEventListener('change', function () { s.focus = inpFocus.value; saveData(); });
    f3.appendChild(inpFocus);
    block.appendChild(f3);

    sec2.appendChild(block);
  });
  root.appendChild(sec2);
}

/* ---------------- 3. 推免政策 ---------------- */

function renderSettingsPolicies(root) {
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '推免政策库'));
  sec.appendChild(el('div', 'hint', '原则：不假装知道。未与官方文件核实的规则标注"待核实"；院级细则未知时界面明确提示。'));

  state.data.policies.forEach(function (pol) {
    var block = el('div', 'settings-subsection');
    block.appendChild(el('div', 'hint', pol.school + ' ' + pol.year + '（' + (pol.status === 'school' ? '校级' : '院级') + '）'));

    var f1 = el('div', 'field');
    f1.appendChild(el('label', null, '来源'));
    var inpSrc = document.createElement('input');
    inpSrc.value = pol.source || '';
    inpSrc.addEventListener('change', function () { pol.source = inpSrc.value; saveData(); });
    f1.appendChild(inpSrc);
    block.appendChild(f1);

    var f2 = el('div', 'field');
    f2.appendChild(el('label', null, '加权计分规则'));
    var inpW = document.createElement('input');
    inpW.value = pol.weightedScoreRule || '';
    inpW.addEventListener('change', function () { pol.weightedScoreRule = inpW.value; saveData(); });
    f2.appendChild(inpW);
    block.appendChild(f2);

    var f3 = el('div', 'field');
    f3.appendChild(el('label', null, '创新成果加分规则'));
    var inpI = document.createElement('input');
    inpI.value = pol.innovationRule || '';
    inpI.addEventListener('change', function () { pol.innovationRule = inpI.value; saveData(); });
    f3.appendChild(inpI);
    block.appendChild(f3);

    var f4 = el('div', 'field');
    f4.appendChild(el('label', null, '必达条件（顿号分隔）'));
    var inpR = document.createElement('input');
    inpR.value = (pol.requiredConditions || []).join('、');
    inpR.addEventListener('change', function () {
      pol.requiredConditions = inpR.value.split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
      saveData();
    });
    f4.appendChild(inpR);
    block.appendChild(f4);

    var conf = el('label', 'checkbox-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!pol.confirmed;
    cb.addEventListener('change', function () { pol.confirmed = cb.checked; saveData(); });
    conf.appendChild(cb);
    conf.appendChild(el('span', null, '已与官方文件核实'));
    block.appendChild(conf);

    var bDel = el('button', 'btn btn-sm btn-danger', '删除此政策');
    bDel.addEventListener('click', function () {
      confirmModal('删除政策', '确定删除「' + pol.school + ' ' + pol.year + '」吗？', { danger: true, okLabel: '删除' }).then(function (ok) {
        if (!ok) return;
        state.data.policies = state.data.policies.filter(function (x) { return x !== pol; });
        saveData();
        renderSettingsInto(settingsModal.body);
      });
    });
    block.appendChild(bDel);
    sec.appendChild(block);
  });

  var bAdd = el('button', 'btn btn-sm', '新增政策');
  bAdd.addEventListener('click', function () {
    state.data.policies.push({
      id: 'policy-' + uid(), school: '西北大学', college: '计算机学院', year: 2027,
      validFrom: '2027-01-01', validTo: '2028-12-31', source: '', status: 'school',
      confirmed: false, weightedScoreRule: '', innovationRule: '', requiredConditions: [], note: ''
    });
    saveData();
    renderSettingsInto(settingsModal.body);
  });
  sec.appendChild(bAdd);
  root.appendChild(sec);
}

/* ---------------- 4. 规则与学期（v2 迁移） ---------------- */

function renderSettingsRules(root) {
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '绩点换算规则'));
  var table = el('div', 'rule-table');
  state.data.gradeRules.forEach(function (rule) {
    var row = el('div', 'rule-row');
    var inpMin = document.createElement('input');
    inpMin.type = 'number';
    inpMin.value = rule.min;
    inpMin.addEventListener('change', function () {
      rule.min = Number(inpMin.value) || 0;
      saveData();
    });
    row.appendChild(inpMin);
    row.appendChild(el('span', null, '分 → 绩点'));
    var inpGpa = document.createElement('input');
    inpGpa.type = 'number';
    inpGpa.step = '0.1';
    inpGpa.value = rule.gpa;
    inpGpa.addEventListener('change', function () {
      rule.gpa = Number(inpGpa.value) || 0;
      saveData();
    });
    row.appendChild(inpGpa);
    var bDel = el('button', 'btn btn-sm btn-danger', '删除');
    bDel.addEventListener('click', function () {
      state.data.gradeRules = state.data.gradeRules.filter(function (r) { return r !== rule; });
      saveData();
      renderSettingsInto(settingsModal.body);
    });
    row.appendChild(bDel);
    table.appendChild(row);
  });
  sec.appendChild(table);
  var bAddRule = el('button', 'btn btn-sm', '添加规则');
  bAddRule.addEventListener('click', function () {
    state.data.gradeRules.push({ min: 0, gpa: 0 });
    saveData();
    renderSettingsInto(settingsModal.body);
  });
  sec.appendChild(bAddRule);
  root.appendChild(sec);

  /* CET4 */
  var secCet = el('div', 'settings-section');
  secCet.appendChild(el('div', 'sec-title', '英语四级'));
  var cet = state.data.semester.cet4Exam;
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, '是否报考'));
  var sel = document.createElement('select');
  [['', '待确认'], ['true', '计划报考'], ['false', '不报考']].forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item[0]; opt.textContent = item[1];
    if (String(cet.planned == null ? '' : cet.planned) === item[0]) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function () {
    cet.planned = sel.value === '' ? null : sel.value === 'true';
    saveData();
  });
  f1.appendChild(sel);
  secCet.appendChild(f1);
  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '预计考试日期'));
  var inpDate = document.createElement('input');
  inpDate.type = 'date';
  inpDate.value = cet.expectedDate || '';
  inpDate.addEventListener('change', function () {
    cet.expectedDate = inpDate.value || null;
    saveData();
  });
  f2.appendChild(inpDate);
  secCet.appendChild(f2);
  var conf = el('label', 'checkbox-row');
  var cbCet = document.createElement('input');
  cbCet.type = 'checkbox';
  cbCet.checked = !!cet.notAllowed;
  cbCet.addEventListener('change', function () { cet.notAllowed = cbCet.checked; saveData(); });
  conf.appendChild(cbCet);
  conf.appendChild(el('span', null, '学校不允许大一上报考'));
  secCet.appendChild(conf);
  root.appendChild(secCet);

  /* 节假日 */
  var secHol = el('div', 'settings-section');
  secHol.appendChild(el('div', 'sec-title', '节假日'));
  state.data.holidays.forEach(function (h) {
    var row = el('div', 'field-row');
    var iName = document.createElement('input');
    iName.value = h.name;
    iName.addEventListener('change', function () { h.name = iName.value; saveData(); });
    row.appendChild(iName);
    var iStart = document.createElement('input');
    iStart.type = 'date';
    iStart.value = h.start;
    iStart.addEventListener('change', function () { h.start = iStart.value; saveData(); });
    row.appendChild(iStart);
    var iEnd = document.createElement('input');
    iEnd.type = 'date';
    iEnd.value = h.end;
    iEnd.addEventListener('change', function () { h.end = iEnd.value; saveData(); });
    row.appendChild(iEnd);
    var bDel = el('button', 'btn btn-sm btn-danger', '删除');
    bDel.addEventListener('click', function () {
      confirmModal('删除节日', '删除「' + h.name + '」会同时清理对应的节前收尾任务。', { danger: true, okLabel: '删除' }).then(function (ok) {
        if (!ok) return;
        var pre = preHolidayDate(h);
        if (state.data.holidayTasks[pre] && state.data.holidayTasks[pre].holiday === h.name) {
          delete state.data.holidayTasks[pre];
        }
        state.data.holidays = state.data.holidays.filter(function (x) { return x !== h; });
        saveData();
        renderSettingsInto(settingsModal.body);
      });
    });
    row.appendChild(bDel);
    secHol.appendChild(row);
  });
  var bAddHol = el('button', 'btn btn-sm', '添加节日');
  bAddHol.addEventListener('click', function () {
    state.data.holidays.push({ name: '新节日', start: '2026-10-01', end: '2026-10-03' });
    saveData();
    renderSettingsInto(settingsModal.body);
  });
  secHol.appendChild(bAddHol);
  root.appendChild(secHol);

  /* 当前周覆盖 */
  var secWk = el('div', 'settings-section');
  secWk.appendChild(el('div', 'sec-title', '当前周覆盖（调试用，留空=按真实日期）'));
  var fWk = el('div', 'field');
  var inpWk = document.createElement('input');
  inpWk.type = 'number';
  inpWk.value = state.data.currentWeekOverride != null ? state.data.currentWeekOverride : '';
  inpWk.addEventListener('change', function () {
    state.data.currentWeekOverride = inpWk.value === '' ? null : clamp(Number(inpWk.value), 1, state.data.semester.totalWeeks);
    saveData();
    setViewWeek(currentWeek());
  });
  fWk.appendChild(inpWk);
  secWk.appendChild(fWk);
  root.appendChild(secWk);
}

/* ---------------- 5. 外观与 AI ---------------- */

function renderSettingsAppearance(root) {
  /* 封面 */
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '封面图片'));
  var preview = el('div', 'cover-preview' + (state.data.coverImage ? '' : ' default'));
  var img = document.createElement('img');
  if (state.data.coverImage) img.src = state.data.coverImage;
  else img.alt = '当前为默认 CSS 艺术封面';
  preview.appendChild(img);
  if (!state.data.coverImage) preview.appendChild(el('div', 'hint', '当前为默认 CSS 艺术封面'));
  sec.appendChild(preview);

  var uploadInput = document.createElement('input');
  uploadInput.type = 'file';
  uploadInput.accept = 'image/*';
  uploadInput.style.display = 'none';
  uploadInput.addEventListener('change', function () {
    var file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('图片超过 5MB，请压缩后再上传'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      processCoverImage(reader.result, function (dataUrl) {
        state.data.coverImage = dataUrl;
        saveData();
        renderSettingsInto(settingsModal.body);
        ensureHomeBackground();
      });
    };
    reader.readAsDataURL(file);
  });
  var bUp = el('button', 'btn', '上传封面（≤5MB）');
  bUp.addEventListener('click', function () { uploadInput.click(); });
  sec.appendChild(bUp);
  var bReset = el('button', 'btn', '恢复默认封面');
  bReset.addEventListener('click', function () {
    state.data.coverImage = null;
    saveData();
    renderSettingsInto(settingsModal.body);
    ensureHomeBackground();
  });
  sec.appendChild(bReset);
  root.appendChild(sec);

  /* AI */
  var secAi = el('div', 'settings-section');
  secAi.appendChild(el('div', 'sec-title', 'AI 助手（DeepSeek）'));
  secAi.appendChild(el('div', 'hint',
    '安全声明：API Key 仅存本机浏览器 localStorage，仅限本地个人使用。若未来公开部署，禁止在前端暴露 Key，必须改为 Backend/API Proxy。'));

  var cfg = state.data.aiConfig;
  var f1 = el('div', 'field');
  f1.appendChild(el('label', null, 'API Key'));
  var inpKey = document.createElement('input');
  inpKey.type = 'password';
  inpKey.value = cfg.apiKey || '';
  inpKey.addEventListener('change', function () { cfg.apiKey = inpKey.value.trim(); saveData(); });
  f1.appendChild(inpKey);
  secAi.appendChild(f1);

  var f2 = el('div', 'field');
  f2.appendChild(el('label', null, '模型'));
  var sel = document.createElement('select');
  [['deepseek-chat', 'deepseek-chat（推荐）'], ['deepseek-reasoner', 'deepseek-reasoner']].forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item[0]; opt.textContent = item[1];
    if (cfg.model === item[0]) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function () { cfg.model = sel.value; saveData(); });
  f2.appendChild(sel);
  secAi.appendChild(f2);

  var f3 = el('div', 'field');
  f3.appendChild(el('label', null, 'API 地址（baseUrl）'));
  var inpUrl = document.createElement('input');
  inpUrl.value = cfg.baseUrl || '';
  inpUrl.addEventListener('change', function () { cfg.baseUrl = inpUrl.value.trim(); saveData(); });
  f3.appendChild(inpUrl);
  secAi.appendChild(f3);

  var bClear = el('button', 'btn btn-sm btn-danger', '清空聊天记录');
  bClear.addEventListener('click', function () {
    confirmModal('清空聊天记录', '确定清空 AI 聊天记录吗？（不影响计划与数据）', { danger: true, okLabel: '清空' }).then(function (ok) {
      if (!ok) return;
      state.data.aiChat.messages = [];
      state.data.aiChat.lastApply = null;
      saveData();
      renderAiChatList();
      renderSettingsInto(settingsModal.body);
    });
  });
  secAi.appendChild(bClear);
  root.appendChild(secAi);
}

/* ---------------- 6. 数据管理（含快照系统） ---------------- */

function renderSettingsData(root) {
  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '备份与恢复'));
  var bExp = el('button', 'btn', '导出数据（JSON）');
  bExp.addEventListener('click', doExport);
  sec.appendChild(bExp);

  var impInput = document.createElement('input');
  impInput.type = 'file';
  impInput.accept = '.json,application/json';
  impInput.style.display = 'none';
  impInput.addEventListener('change', function () {
    var file = impInput.files && impInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = importFromJson(reader.result);
      if (!res.ok) { alert(res.error); return; }
      confirmModal('覆盖导入', '导入将覆盖当前全部数据（导入文件会自动迁移到当前版本）。确定继续吗？', { danger: true, okLabel: '覆盖导入' })
        .then(function (ok) {
          if (!ok) return;
          state.data = res.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
          setViewWeek(currentWeek());
          refreshCurrentView();
        });
    };
    reader.readAsText(file);
  });
  var bImp = el('button', 'btn', '导入数据');
  bImp.addEventListener('click', function () { impInput.click(); });
  sec.appendChild(bImp);

  var bClear = el('button', 'btn btn-danger', '清空全部数据');
  bClear.addEventListener('click', function () {
    var body = el('div');
    body.appendChild(el('p', 'hint', '此操作将删除所有本地数据（课程/计划/复盘/设置）。输入「清空」二字确认：'));
    var inp = document.createElement('input');
    body.appendChild(inp);
    openModal({
      title: '清空全部数据',
      body: body,
      actions: [
        {
          label: '清空', cls: 'btn-danger',
          onClick: function () {
            if (inp.value.trim() !== '清空') { alert('请输入「清空」确认'); return false; }
            clearData();
            setViewWeek(currentWeek());
            refreshCurrentView();
          }
        },
        { label: '取消', cls: '' }
      ]
    });
  });
  sec.appendChild(bClear);
  root.appendChild(sec);

  /* 快照系统（§46） */
  var secSnap = el('div', 'settings-section');
  secSnap.appendChild(el('div', 'sec-title', '计划快照（版本管理）'));
  var bNew = el('button', 'btn btn-primary', '为本周计划创建快照');
  bNew.addEventListener('click', function () {
    var s = SnapshotEngine.create('手动快照（' + todayStr() + '）');
    alert('快照已创建（' + s.createdAt.slice(5, 16).replace('T', ' ') + '）');
    renderSettingsInto(settingsModal.body);
  });
  secSnap.appendChild(bNew);

  var list = SnapshotEngine.list();
  if (!list.length) {
    secSnap.appendChild(el('div', 'hint', '暂无快照。AI 采纳、重新生成计划前会自动创建快照。'));
  }
  list.forEach(function (s) {
    var row = el('div', 'task-row');
    row.appendChild(el('span', 'task-title', s.label));
    row.appendChild(el('span', 'task-time', s.createdAt.slice(5, 16).replace('T', ' ') + ' · 第' + s.week + '周'));
    var bRestore = el('button', 'btn btn-sm btn-primary', '恢复');
    bRestore.addEventListener('click', function () {
      confirmModal('恢复快照', '恢复到「' + s.label + '」？当前第' + s.week + '周计划将被该快照版本覆盖。', { danger: true, okLabel: '恢复' })
        .then(function (ok) {
          if (!ok) return;
          var r = SnapshotEngine.restore(s.id);
          if (!r.ok) { alert(r.error); return; }
          refreshCurrentView();
          renderSettingsInto(settingsModal.body);
        });
    });
    row.appendChild(bRestore);
    var bDel = el('button', 'btn btn-sm btn-danger', '删除');
    bDel.addEventListener('click', function () {
      SnapshotEngine.remove(s.id);
      renderSettingsInto(settingsModal.body);
    });
    row.appendChild(bDel);
    secSnap.appendChild(row);
  });
  root.appendChild(secSnap);

  /* 迁移日志 */
  if (state.data.migrationLog) {
    var secMig = el('div', 'settings-section');
    secMig.appendChild(el('div', 'sec-title', '数据迁移日志'));
    var log = state.data.migrationLog;
    secMig.appendChild(el('div', 'hint', 'v' + log.from + ' → v' + log.to + '（' + (log.at || '').slice(0, 10) + '）'));
    (log.notes || []).forEach(function (n) {
      secMig.appendChild(el('div', 'hint', '· ' + n));
    });
    if (log.rebuild) {
      secMig.appendChild(el('div', 'hint', '· 旧体系周计划重建 ' + log.rebuild.rebuilt + ' 份' +
        (log.rebuild.unmatched.length ? '（' + log.rebuild.unmatched.length + ' 周有部分勾选记录无法按标题匹配，已保留在每日复盘镜像中）' : '')));
    }
    root.appendChild(secMig);
  }
}

/* ============================================================
 * 数据互通（v5）：手机 PWA 与电脑通过 GitHub 私有仓库同步
 * 配置：细粒度 Token（仅授权 baoyan-sync 仓库 Contents 读写）
 *      + 配对码（两端填相同即可共享同一份数据）
 * ============================================================ */

function renderSettingsSync(root) {
  var cfg = SyncEngine.loadCfg();

  var sec = el('div', 'settings-section');
  sec.appendChild(el('div', 'sec-title', '跨设备云同步'));
  var statusLine = el('div', 'hint', '');
  function refreshStatus() {
    var c = SyncEngine.loadCfg();
    if (!c.enabled) statusLine.textContent = '状态：未启用（填写 Token 与配对码后开启）';
    else if (SyncEngine._lastError) statusLine.textContent = '状态：同步失败 —— ' + SyncEngine._lastError;
    else if (c.lastSyncAt) statusLine.textContent = '状态：已启用 · 上次同步 ' + new Date(c.lastSyncAt).toLocaleString('zh-CN');
    else statusLine.textContent = '状态：已启用 · 等待首次同步（每 25 秒自动拉取，本地改动 2 秒内自动推送）';
  }
  refreshStatus();
  sec.appendChild(statusLine);
  sec.appendChild(el('div', 'hint',
    '手机与电脑填【相同的配对码】即可共享同一份计划数据：手机上勾任务，电脑端 25 秒内自动更新。'));
  root.appendChild(sec);

  /* Token */
  var secToken = el('div', 'settings-section');
  secToken.appendChild(el('div', 'sec-title', 'GitHub Token（只授权 baoyan-sync 仓库）'));
  var fT = el('div', 'field');
  fT.appendChild(el('label', null, 'Token（github_pat_ 开头）'));
  var inpToken = document.createElement('input');
  inpToken.type = 'password';
  inpToken.value = cfg.token || '';
  inpToken.placeholder = '粘贴 github_pat_ 开头的 Token';
  fT.appendChild(inpToken);
  secToken.appendChild(fT);
  secToken.appendChild(el('div', 'hint',
    '创建地址：github.com/settings/personal-access-tokens/new → Only select repositories → baoyan-sync → Contents: Read and write。' +
    'Token 只存在本机浏览器 localStorage，不会上传到网站或任何公开位置。'));
  root.appendChild(secToken);

  /* 配对码 */
  var secCode = el('div', 'settings-section');
  secCode.appendChild(el('div', 'sec-title', '配对码（两端一致）'));
  var fC = el('div', 'field');
  fC.appendChild(el('label', null, '配对码'));
  var inpCode = document.createElement('input');
  inpCode.type = 'text';
  inpCode.value = cfg.code || '';
  inpCode.placeholder = '6 位配对码，如 AB3K7M';
  inpCode.maxLength = 6;
  fC.appendChild(inpCode);
  secCode.appendChild(fC);
  var bGen = el('button', 'btn btn-sm', '生成新配对码');
  bGen.addEventListener('click', function () {
    inpCode.value = SyncEngine.genCode();
    alert('新配对码已生成：' + inpCode.value + '。在另一台设备上填入相同的配对码即可互通。');
  });
  secCode.appendChild(bGen);
  root.appendChild(secCode);

  /* 操作按钮 */
  var btns = el('div', 'settings-section');
  var bSave = el('button', 'btn btn-primary', '保存并立即同步');
  bSave.addEventListener('click', function () {
    var token = inpToken.value.trim();
    var code = inpCode.value.trim().toUpperCase();
    if (!token) { alert('请粘贴 Token'); return; }
    if (!/^[A-Z2-9]{6}$/.test(code)) { alert('配对码应为 6 位字母数字（如 AB3K7M），可点「生成新配对码」创建'); return; }
    var c = SyncEngine.loadCfg();
    c.token = token;
    c.code = code;
    c.enabled = true;
    c.lastError = '';
    SyncEngine.saveCfg();
    bSave.textContent = '同步中…';
    /* start 会立即执行一次实际同步（云端为空→上传本地数据；云端更新→拉取采纳） */
    SyncEngine.start(function (err, r) {
      bSave.textContent = '保存并立即同步';
      if (err) { alert('同步失败：' + err + '\n\n请检查：① Token 是否授权了 baoyan-sync 仓库的 Contents 读写；② 网络是否能访问 api.github.com。'); }
      else alert('同步完成！' + (r && r.adopted ? '云端数据已拉取到本机（本地数据已自动备份）。' : '本机数据已上传云端。'));
      refreshStatus();
      updateStatusbar();
    });
  });
  btns.appendChild(bSave);

  var bSync = el('button', 'btn', '立即同步一次');
  bSync.addEventListener('click', function () {
    if (!SyncEngine.isEnabled()) { alert('请先填写 Token 与配对码并保存'); return; }
    SyncEngine.pull(function (err, r) {
      if (err) { alert('同步失败：' + err); return; }
      refreshStatus();
      updateStatusbar();
    });
  });
  btns.appendChild(bSync);

  var bOff = el('button', 'btn btn-danger', '断开同步');
  bOff.addEventListener('click', function () {
    var c = SyncEngine.loadCfg();
    c.enabled = false;
    SyncEngine.saveCfg();
    SyncEngine.stop();
    refreshStatus();
    updateStatusbar();
  });
  btns.appendChild(bOff);
  root.appendChild(btns);

  sec.appendChild(el('div', 'hint',
    '配对步骤：① 电脑上生成配对码 → ② 手机打开网站（添加主屏幕）→ 设置 → 数据互通 → 粘贴同样的 Token 与配对码 → 完成。'));
}
