/* ============================================================
 * data/defaultData.js —— 组装 v3 默认初始数据（DEFAULT_INIT_DATA）
 * 必须最后加载（引用前面所有 data/*.js 的常量）。
 * ============================================================ */

/* 编程训练默认状态：进度取自 curriculum.js 的初始 status */
function defaultProgrammingState() {
  return {
    c: {
      topics: C_CURRICULUM.map(function (t) {
        return { id: t.id, name: t.name, status: t.status, requires: t.requires.slice() };
      })
    },
    python: {
      topics: PYTHON_CURRICULUM.map(function (t) {
        return { id: t.id, name: t.name, status: t.status, requires: t.requires.slice(), stage: t.stage };
      })
    },
    submissions: [],   // 提交记录（programmingEngine 写入）
    wrongBook: []      // 错题本（未解决的错题）
  };
}

/* 科研探索默认状态 */
function defaultResearchState() {
  return {
    stage: 'programming-foundation',
    directions: clone(RESEARCH_DIRECTIONS_DEFAULTS),
    lab: clone(LAB_CONTACTS_DEFAULTS),
    entries: []        // 科研探索记录 {ts, type, title, hours, note}
  };
}

const DEFAULT_INIT_DATA = {
  version: 5,
  userProfile: clone(PROFILE_DEFAULTS),
  semester: {
    totalWeeks: 18,
    weekOneMonday: '2026-09-07',
    examWeeksHint: [17, 18],
    specialWeeks: [
      { weeks: [1, 2], label: '军训', note: '课表全空', noClasses: true },
      { weeks: [18], label: '金工实习', note: '特殊安排' }
    ],
    cet4Exam: {
      planned: null,                    // null=未定 true=计划报考 false=不报考
      expectedDate: '2026-12-20',
      notAllowed: false,                // 学校是否允许大一上学期报考
      confirmHint: '需确认学校是否允许大一上学期报考12月四级'
    }
  },
  courses: clone(COURSES_DEFAULTS),
  /* 目标系统（可编辑） */
  goals: clone(GOALS_DEFAULTS),
  /* 推免政策库（可编辑） */
  policies: clone(POLICIES_DEFAULTS),
  /* 资源库（可编辑；加入资源库 ≠ 加入计划） */
  resources: clone(RESOURCES_DEFAULTS),
  /* 编程训练中心 */
  programming: defaultProgrammingState(),
  /* 科研探索 */
  research: defaultResearchState(),
  /* 竞赛库 */
  competitions: clone(COMPETITIONS_DEFAULTS),
  /* 个人英语词汇中心（v5；词库/预算/比例设置可改） */
  vocabCenter: defaultVocabCenterState(),
  /* 本周战略（Strategy AI / 默认策略输出；null = 尚未生成） */
  weeklyStrategy: null,
  /* 执行清单 */
  weekPlans: {},
  /* 每周时间预算记录 { week: {theoretical, historicalAvg, recent7dRate, suggested, planned, buffer, breakdown} } */
  timeBudgets: {},
  dailyLogs: {},
  weekReviews: {},
  aiLogs: [],
  /* 节假日：假期日不生成任务、课表跳过；节前最后一天自动安排一个独立"收尾总任务" */
  holidays: [
    { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
    { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },   // 法定假期 10-01~10-07；10-08 为上班日
    { name: '元旦', start: '2027-01-01', end: '2027-01-03' }
  ],
  holidayTasks: {},     // key 日期字符串：节前收尾总任务（独立存储，不计入周计划统计）
  gradeRules: DEFAULT_GRADE_RULES.map(function (r) { return { min: r.min, gpa: r.gpa }; }),
  gpaSimulation: null,  // { scores: {courseId: score}, gpa: number, savedAt }
  roadmap: {},          // 【v2 遗留】迁移后不再使用，保留以免丢数据
  /* 快照系统（计划/战略版本管理） */
  snapshots: [],
  currentWeekOverride: null,
  /* 封面图片（用户上传，压缩后的 base64 dataURL；null = 默认 CSS 艺术封面） */
  coverImage: null,
  /* AI 助手配置（Key 仅存本机浏览器 localStorage）
   * 注意：若未来公开部署，API Key 绝不允许暴露在前端，
   * 必须改为 Backend/API Proxy。production deployment requires backend proxy. */
  aiConfig: {
    apiKey: '',
    model: 'deepseek-chat',               // 'deepseek-chat' | 'deepseek-reasoner'
    baseUrl: 'https://api.deepseek.com'
  },
  /* AI 对话历史（messages 上限 40 条）；snapshot 为 v2 遗留字段（已迁 snapshots） */
  aiChat: {
    messages: [],
    snapshot: null
  },
  /* 数据迁移日志 */
  migrationLog: null,
  lastModified: null
};
