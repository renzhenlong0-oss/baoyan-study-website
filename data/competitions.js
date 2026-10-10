/* ============================================================
 * data/competitions.js —— 竞赛库默认数据（v3）
 * Value Score = 保研价值 + 技术价值 + 方向匹配 + 成果可迁移性 - 时间成本
 * 原则：竞赛不是越多越好；研究兴趣 > 竞赛兴趣。
 * 大一当前策略：竞赛优先级【低】，仅保留极低成本的技术训练型比赛。
 * status: '候选' | '参加' | '暂不参加' | '已结束'
 * ============================================================ */

const COMPETITIONS_DEFAULTS = [
  {
    id: 'comp-acm-freshman',
    name: 'ACM 新生赛 / 校赛',
    time: '2026 秋季（校赛）',
    estHours: 30,
    baoyanValue: 2, techValue: 4, directionMatch: 3, outcomeValue: 2, timeCost: 1,
    teamRequired: false,
    transferability: '算法能力是面试与科研工程的硬通货',
    status: '候选',
    note: '低成本试水：以赛促学算法与 C 语言，不追求名次'
  },
  {
    id: 'comp-lanqiao',
    name: '蓝桥杯软件赛（C/C++ 组）',
    time: '2027 年 4 月（省赛）',
    estHours: 80,
    baoyanValue: 3, techValue: 4, directionMatch: 3, outcomeValue: 2, timeCost: 3,
    teamRequired: false,
    transferability: '算法与工程能力提升，获奖对推免有一定加分',
    status: '候选',
    note: '2027 年春季参赛；大一上先打牢 C 语言基础再决定'
  },
  {
    id: 'comp-math-model',
    name: '全国大学生数学建模竞赛',
    time: '2027 年 9 月',
    estHours: 100,
    baoyanValue: 4, techValue: 3, directionMatch: 2, outcomeValue: 3, timeCost: 4,
    teamRequired: true,
    transferability: '论文写作与建模能力，推免加分价值较高',
    status: '暂不参加',
    note: '建议大二再参加：需要 Python/数据处理基础与组队'
  },
  {
    id: 'comp-robot',
    name: '中国机器人大赛 / 智能车竞赛',
    time: '2027-2028（大二起）',
    estHours: 150,
    baoyanValue: 4, techValue: 4, directionMatch: 5, outcomeValue: 3, timeCost: 5,
    teamRequired: true,
    transferability: '与目标方向（机器人/具身智能）高度匹配，成果可直接用于科研',
    status: '暂不参加',
    note: '大二确定方向后精选 1 项投入；大一不碰（时间成本过高，挤压 GPA）'
  }
];

/* 计算竞赛 Value Score（§28 公式） */
function competitionValueScore(c) {
  return (c.baoyanValue || 0) + (c.techValue || 0) + (c.directionMatch || 0) + (c.outcomeValue || 0) - (c.timeCost || 0);
}
