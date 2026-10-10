/* ============================================================
 * data/roadmap.js —— 长期技术路线图 + 科研路线（v3）
 * 这是【路线图】，不是当前任务列表。只用于展示当前位置，
 * 不产生任何每周任务。研究阶段指标由阶段动态变化：
 * 大一初期：编程能力 >> 论文数量。
 * ============================================================ */

/* 技术栈路线（展示用） */
const TECH_ROADMAP = [
  { id: 'c',       name: 'C',          note: '学校主线，编程地基' },
  { id: 'python',  name: 'Python',     note: '科研/数据处理语言' },
  { id: 'numpy',   name: 'NumPy',      note: '科学计算基础' },
  { id: 'git',     name: 'Git',        note: '版本控制（进实验室前必备）' },
  { id: 'linux',   name: 'Linux',      note: '实验环境' },
  { id: 'pytorch', name: 'PyTorch',    note: '深度学习框架' },
  { id: 'ml',      name: '机器学习',   note: 'ML 基础' },
  { id: 'dl',      name: '深度学习',   note: 'DL 理论' },
  { id: 'cv',      name: '计算机视觉', note: 'CV 方向' },
  { id: 'slam',    name: 'SLAM',       note: '机器人感知' },
  { id: 'robotics', name: '机器人学',  note: '运动学/动力学/控制' },
  { id: 'rl',      name: '强化学习',   note: 'RL 基础' },
  { id: 'embodied', name: '具身智能',  note: 'Embodied AI 最终方向' }
];

/* 科研阶段（决定当前科研任务类型与指标；可编辑数据） */
const RESEARCH_STAGES = [
  {
    id: 'programming-foundation',
    label: '编程地基期（大一上）',
    metrics: ['C语言进度', 'Python入门', '每周1-1.5h AI/机器人方向探索'],
    tasks: ['方向探索记录', '技术栈学习'],   // 不做"每周10篇论文"这类伪科研指标
    note: '目标：成为"实验室愿意培养的人"。论文阅读不是当前指标。'
  },
  {
    id: 'lab-preparation',
    label: '实验室准备期（大一下）',
    metrics: ['Python/NumPy 完成', 'Git/Linux 入门', 'PyTorch 入门', '论文阅读入门（每月1-2篇）'],
    tasks: ['论文阅读', '复现实验', '代码实验'],
    note: '开始接触实验室，准备有内容的联系。'
  },
  {
    id: 'lab-active',
    label: '实验室科研期（大二起）',
    metrics: ['论文阅读（每周2-3篇）', '项目数量', '实验记录质量'],
    tasks: ['论文阅读', '复现实验', '代码实验', '实验记录', '讨论准备', '论文笔记'],
    note: '科研方向已确定，围绕方向系统性推进。'
  }
];

/* 科研方向试错记录默认条目（用户兴趣/难度评分可改） */
const RESEARCH_DIRECTIONS_DEFAULTS = [
  { id: 'dir-cv', name: 'Computer Vision',        interest: 4, difficulty: 3, willing: true,  hours: 0, note: '' },
  { id: 'dir-robotics', name: 'Robotics / 具身智能', interest: 5, difficulty: 4, willing: true,  hours: 0, note: '' },
  { id: 'dir-medical', name: 'Medical Imaging（医学图像）', interest: 3, difficulty: 3, willing: false, hours: 0, note: '' }
];

/* 潜在科研入口（实验室/老师） */
const LAB_CONTACTS_DEFAULTS = [
  {
    id: 'lab-zhao',
    name: '赵凤军老师实验室',
    school: '西北大学',
    fields: ['Machine Learning', 'Computer Vision', 'Medical Image Processing',
             'Computer-Aided Diagnosis', 'Radiomics', 'Intelligent Sensing'],
    url: 'https://faculty.nwu.edu.cn/FengjunZhao/zh_CN/index.htm',
    status: '未联系',   // '未联系' | '已了解' | '已联系' | '已进入'
    plan: '先提升基础能力（C→Python→NumPy），再准备有内容的联系。不预设为"最终导师"，定位是潜在科研训练入口。',
    note: ''
  }
];

/* 研究任务类型（进入实验室后可用；当前阶段部分类型不开放） */
const RESEARCH_TASK_TYPES = ['阅读论文', '复现实验', '代码实验', '实验记录', '讨论准备', '论文笔记', '方向探索'];
