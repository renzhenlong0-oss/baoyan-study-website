/* ============================================================
 * data/policies.js —— 推免政策库默认数据（v3）
 * 原则：不假装知道。校级规则按用户录入内容存为"待核实"，
 * 院级细则未知时界面明确显示"待补充"。
 * ============================================================ */

const POLICIES_DEFAULTS = [
  {
    id: 'nwu-school-2026',
    school: '西北大学',
    college: '计算机学院',
    year: 2026,
    validFrom: '2026-01-01',
    validTo: '2027-12-31',
    source: '西北大学校级推免规则 2026（待核实官方文件）',
    status: 'school',          // 'school' = 校级规则；'college' = 院级细则
    confirmed: false,          // 是否已与官方文件核实
    weightedScoreRule: '学业成绩加权平均分占比 + 创新成果加分（具体比例待核实）',
    innovationRule: '科研成果/论文/竞赛获奖等创新加分项（细则待核实）',
    requiredConditions: ['无不及格课程', '通过英语四级', '遵纪守法、无处分记录'],
    note: '计算机学院具体实施细则当前未知，估算时采用学校级规则，并在界面标注"院系实施细则待补充"。'
  }
];

/* 绩点换算规则默认值（设置面板可编辑，存于 data.gradeRules） */
const DEFAULT_GRADE_RULES = [
  { min: 90, gpa: 4.0 },
  { min: 85, gpa: 3.7 },
  { min: 80, gpa: 3.3 },
  { min: 75, gpa: 3.0 },
  { min: 70, gpa: 2.7 },
  { min: 65, gpa: 2.3 },
  { min: 60, gpa: 1.0 },
  { min: 0, gpa: 0 }
];

/* 当前生效的政策（按 school 匹配、validFrom/validTo 过滤，取最新一条） */
function getActivePolicy(data) {
  var list = (data && data.policies) || [];
  var now = todayStr();
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (p.validFrom && diffDays(now, p.validFrom) < 0) continue;
    if (p.validTo && diffDays(p.validTo, now) < 0) continue;
    if (!hit || p.year > hit.year) hit = p;
  }
  return hit;
}

/* 院级细则是否缺失（决定界面是否显示"待补充"提示） */
function hasCollegePolicy(data) {
  var list = (data && data.policies) || [];
  return list.some(function (p) { return p.status === 'college' && p.college === (data.userProfile && data.userProfile.college); });
}
