/* ============================================================
 * data/goals.js —— 目标系统默认数据（v3）
 * 长期目标 + 8 学期阶段目标。全部为【可修改数据】，
 * 运行时存于 state.data.goals，在「设置 → 目标」中编辑。
 * 周次字段：weeks=[起,止] 直连学期周次；offset=[起,止] 为连续周编号。
 * ============================================================ */

const GOALS_DEFAULTS = {
  longTerm: {
    year: 2030,
    graduateYear: '2030届',
    target: '获得推免资格',
    targetSchool: '中上985',
    direction: 'AI / Robotics / Embodied Intelligence',
    directions: ['智能机器人', '具身智能', '自动驾驶', '智能硬件'],
    preference: '研究兴趣 > 竞赛兴趣；喜欢发现问题、探索未知',
    note: '科研具有不确定性，当前不重押科研；现阶段最重要：GPA/专业排名 + 编程基础 + 科研探索'
  },
  stages: [
    {
      id: 's1', label: '大一上', phase: 'GPA筑底期', weeks: [1, 18],
      goals: ['GPA筑底', 'C语言基础', 'Python入门', '科研探索'],
      focus: '微积分与程序设计稳住 90+，C 语言完成基础语法到函数，科研只做探索记录'
    },
    {
      id: 's2', label: '大一下', phase: '筑基期', offset: [19, 36],
      goals: ['Python', 'NumPy', 'PyTorch', '机器学习基础', '开始接触实验室'],
      focus: 'Python/NumPy 打牢，PyTorch 入门，机器学习基础概念，尝试联系实验室'
    },
    {
      id: 's3', label: '大二上', phase: '积累期', offset: [37, 54],
      goals: ['科研方向确定', '项目', '论文阅读', '实验能力'],
      focus: '在实验室确定具体方向，跑通一个完整项目，形成论文阅读习惯'
    },
    {
      id: 's4', label: '大二下', phase: '积累期', offset: [55, 72],
      goals: ['科研产出', '竞赛精选', '英语六级'],
      focus: '项目/论文初稿，精选 1-2 个高价值竞赛，六级高分'
    },
    {
      id: 's5', label: '大三上', phase: '冲刺期', offset: [73, 90],
      goals: ['科研成果', '论文/项目', '推免材料'],
      focus: '成果落地（论文录用/项目完成），GPA 收口，准备推免材料'
    },
    {
      id: 's6', label: '大三下', phase: '冲刺期', offset: [91, 108],
      goals: ['目标院校申请', '夏令营', '科研深化'],
      focus: '夏令营与预推免申请，科研方向持续深入'
    },
    {
      id: 's7', label: '大四上', phase: '决胜期', offset: [109, 126],
      goals: ['推免资格确认', '预推免/九推'],
      focus: '确认推免资格，完成预推免与九推'
    },
    {
      id: 's8', label: '大四下', phase: '过渡期', offset: [127, 144],
      goals: ['毕业论文', '研究生预备'],
      focus: '毕业论文，提前进入目标实验室衔接'
    }
  ]
};

/* 当前所处阶段（周次 → 阶段）。offset 为连续周编号，18 周一学期。 */
function stageForWeek(week, stages) {
  var list = (stages && stages.length) ? stages : GOALS_DEFAULTS.stages;
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.weeks && week >= s.weeks[0] && week <= s.weeks[1]) return s;
    if (s.offset && week >= s.offset[0] && week <= s.offset[1]) return s;
  }
  return list[0] || null;
}
