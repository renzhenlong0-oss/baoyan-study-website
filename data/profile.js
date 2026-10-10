/* ============================================================
 * data/profile.js —— 用户画像默认值 + 科目策略元数据（v3）
 * 注意：此处只是【默认值】；运行时数据在 state.data.userProfile。
 * ============================================================ */

const PROFILE_DEFAULTS = {
  /* 公网发布版默认匿名（访客在「设置→个人设置」填自己的名字）；
     本机浏览器 localStorage 中的个人数据不受影响 */
  name: '',
  school: '西北大学',
  college: '计算机学院',
  major: '智能科学与技术（中外合办）',
  grade: '大一上学期',
  targetSchool: '中上985',
  gpaTarget: 4.0,
  englishTarget: 550,
  /* 【v2 遗留字段，已废弃】周学习时长不再使用固定目标值，
   * 由 TimeBudgetEngine 根据实际执行数据动态计算。保留仅供历史参考。 */
  weeklyStudyHoursTarget: 28,
  /* 睡眠硬约束：23:30 睡 07:30 起；22:30 后不排高认知负荷任务 */
  sleep: { start: '23:30', end: '07:30' },
  /* 健身偏好：每周 2-3 次，每次约 90 分钟，17:30-18:30 左右结束 */
  gym: {
    daysPerWeek: [2, 3],   // [最少次数, 最多次数]
    durationMin: 90,
    endBy: '18:30'
  },
  /* 每日学习类任务时长上限（小时），约束引擎使用 */
  dailyStudyCapHours: 4,
  /* 无历史数据时锚定的"历史平均学习时长"（小时/周），对应真实能力 14-21h */
  initialHistoryAvgHours: 18,
  /* 每周刚性作业耗时估算（小时）；考试周自动上浮 */
  homeworkHoursPerWeek: 8,
  /* 每周固定活动：{ label, day(1-7), time('HH:MM-HH:MM'), hours } */
  fixedActivities: [],
  /* v2 遗留约束（设置面板仍可编辑；gymTime 已被 gym 取代，仅兼容保留） */
  constraints: {
    gymTime: { start: '16:00', end: '18:00' },
    maxNightStudy: '21:30',
    lunchBreak: { start: '12:40', end: '13:30', taskType: '碎片任务' }
  }
};

/* 科目策略元数据：refHours 只是"参考起点"，不再是预算来源。
 * 每周实际分配由 StrategyEngine（默认策略或 AI 输出）决定，
 * 且必须落在 TimeBudgetEngine 给出的预算内。 */
const SUBJECT_META = {
  '微积分':      { refHours: 5.5, goal: '理解优先于刷题，证明思路要清晰' },
  '程序设计':    { refHours: 3.5, goal: '动手写大于看视频，每章至少独立完成3道编程题' },
  '英语/四级':   { refHours: 2.5, goal: '弱项写作+阅读专项突破，听力利用碎片时间' },
  'Python':      { refHours: 1,   goal: '副线推进：基础语法→循环→函数→List/Dict，为科研打地基' },
  '科研/AI探索': { refHours: 1.5, goal: '探索AI/机器人方向兴趣，记录试错，不重押' },
  '中国近现代史': { refHours: 1.5, goal: '框架记忆法（时间线+因果链），不死记硬背' },
  '专业英语':    { refHours: 0.5, goal: '跟课进度，积累AI/计算机领域专业词汇' },
  '大学语文':    { refHours: 0.5, goal: '课后阅读+笔记，考前2周集中复习' },
  '复盘':        { refHours: 0.5, goal: '每日复盘+周日周复盘' },
  '综合':        { refHours: 0.5, goal: '周日全科复习+作业收尾' }
};

/* 各科目任务生成模板（PlanGenerator 使用）。
 * patterns 中每条 = 一个任务种子（占时段由生成器按可用时段裁剪）。
 * basePriority = 生成时占时段的基准优先级（实际优先级由策略层动态计算）。 */
const SUBJECT_TASK_PATTERNS = {
  '微积分': {
    basePriority: 100,
    patterns: [
      { days: [1], start: '19:00', durationH: 2.5, title: '微积分复习+作业' },
      { days: [3], start: '19:00', durationH: 2.5, title: '微积分练习+错题整理' },
      { days: [6], start: '09:00', durationH: 3,   title: '微积分专题攻坚' }
    ]
  },
  '程序设计': {
    basePriority: 90,
    patterns: [
      { days: [3], start: '20:45', durationH: 0.75, title: 'C语言练习（编程训练中心）' },
      { days: [5], start: '19:00', durationH: 2,    title: 'C语言项目式编程' }
    ]
  },
  '英语/四级': {
    basePriority: 60,
    patterns: [
      { days: [1], start: '12:40', durationH: 0.85, title: '英语单词+听力（碎片）' },
      { days: [2], start: '12:40', durationH: 0.85, title: '英语单词（碎片）' },
      { days: [5], start: '14:00', durationH: 2,    title: '四级阅读/写作专项' }
    ]
  },
  'Python': {
    basePriority: 55,
    patterns: [
      { days: [7], start: '14:00', durationH: 1, title: 'Python基础学习（副线）' }
    ]
  },
  '科研/AI探索': {
    basePriority: 50,
    patterns: [
      { days: [5], start: '19:00', durationH: 1.5, title: 'AI/机器人方向探索与记录' }
    ]
  },
  '中国近现代史': {
    basePriority: 45,
    patterns: [
      { days: [2], start: '10:50', durationH: 1.2, title: '近现代史整理笔记' }
    ]
  },
  '专业英语': {
    basePriority: 40,
    patterns: [
      { days: [4], start: '12:40', durationH: 0.5, title: '专业英语词汇（碎片）' }
    ]
  },
  '大学语文': {
    basePriority: 35,
    patterns: [
      { days: [3], start: '12:40', durationH: 0.5, title: '大学语文阅读（碎片）' }
    ]
  },
  '复盘': {
    basePriority: 20,
    patterns: [
      { days: [2], start: '21:00', durationH: 0.5, title: '当日复盘+补作业' },
      { days: [7], start: '21:00', durationH: 0.5, title: '周复盘+下周计划' }
    ]
  },
  '综合': {
    basePriority: 30,
    patterns: [
      { days: [7], start: '09:00', durationH: 3, title: '本周复习+全科作业' }
    ]
  }
};

/* 主页/看板学科区块归并映射（科目名 → 区块） */
const SUBJECT_BLOCKS = [
  { id: 'math',     label: '数学',       glyph: '数', courseIds: ['calc'],          subjects: ['微积分'] },
  { id: 'english',  label: '英语',       glyph: '英', courseIds: ['english', 'major-english'], subjects: ['英语/四级', '专业英语'] },
  { id: 'coding',   label: '编程',       glyph: '程', courseIds: ['cprogramming'],  subjects: ['程序设计', 'Python'] },
  { id: 'research', label: '科研',       glyph: '研', courseIds: [],                subjects: ['科研/AI探索'] },
  { id: 'gym',      label: '健身',       glyph: '健', courseIds: ['pe'],            subjects: ['健身'] }
];

/* 科目配色（任务标签用） */
const SUBJECT_COLORS = {
  '微积分': '#1C3A5E',
  '英语': '#B8860B',
  '程序设计': '#2A6B5A',
  'Python': '#2A6B5A',
  '科研': '#2A5A6B',
  '近现代史': '#6B2A6B',
  '语文': '#6B7280',
  '专业英语': '#2D5F8A',
  'AI': '#2A5A6B',
  '健身': '#8B5E3C',
  '复盘': '#5B4B8A',
  '综合': '#4A5568'
};
