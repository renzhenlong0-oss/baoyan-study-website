/* ============================================================
 * data/courses.js —— 学校课程默认数据 + 课表常量（v3）
 * 新增字段（v3）：
 *   gradeBreakdown  成绩构成（期末/期中/平时占比；未知为 null）
 *   examDate        考试日期（YYYY-MM-DD；未知为 null，进入 Exam Mode 依据之一）
 *   currentScore    当前掌握度/成绩（0-100；未知为 null，用户维护）
 *   risk            'unknown' | 'green' | 'yellow' | 'red'（由 GPA Risk Engine 计算）
 * ============================================================ */

/* 节次时间映射 */
const PERIOD_TIMES = {
  1: '08:00-08:45', 2: '08:55-09:40',
  3: '10:00-10:45', 4: '10:55-11:40',
  5: '14:00-14:45', 6: '14:55-15:40',
  7: '16:00-16:45', 8: '16:55-17:40',
  9: '19:00-19:45', 10: '19:55-20:40',
  11: '21:00-21:45'
};

/* 课表 6 个时间行 */
const SCHEDULE_ROWS = [
  { key: 'am1',   label: '上午1-2节', time: '08:00-09:40', periods: [1, 2] },
  { key: 'am2',   label: '上午3-4节', time: '10:00-11:40', periods: [3, 4] },
  { key: 'lunch', label: '午休碎片',   time: '12:40-13:30', periods: [] },
  { key: 'pm1',   label: '下午5-6节', time: '14:00-15:40', periods: [5, 6] },
  { key: 'pm2',   label: '傍晚7-8节', time: '16:00-17:40', periods: [7, 8] },
  { key: 'night', label: '晚上9-11节', time: '19:00-21:45', periods: [9, 10, 11] }
];

/* 课程配色（课表格子用） */
const COURSE_COLORS = {
  'calc': '#1C3A5E',
  'english': '#B8860B',
  'cprogramming': '#2A6B5A',
  'history': '#6B2A6B',
  'chinese': '#6B7280',
  'major-english': '#2D5F8A',
  'security': '#8B5E3C',
  'situation': '#4A5568',
  'pe': '#2A5A6B',
  'psychology': '#5B4B8A',
  'freshman-guide': '#1C3A5E'
};

/* 课程短名（课表格子显示） */
const COURSE_SHORT = {
  'calc': '微积分',
  'english': '大学英语',
  'cprogramming': '程序设计',
  'history': '近现代史',
  'chinese': '大学语文',
  'major-english': '专业英语',
  'security': '国家安全教育',
  'situation': '形势与政策',
  'pe': '基础体育',
  'psychology': '心理健康',
  'freshman-guide': '专业导读'
};

const COURSES_DEFAULTS = [
  {
    id: 'calc',
    name: '微积分（第一层次）Ⅰ',
    credits: 4.0,
    examType: '考试',
    priority: '最高',
    targetScore: 90,
    gradeBreakdown: { final: 0.6, midterm: 0.2, usual: 0.2 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 1, periods: [1, 2], weekRange: [1, 18], location: '1208', teacher: '勾明' },
      { day: 3, periods: [1, 2], weekRange: [1, 18], location: '1208', teacher: '勾明' },
      { day: 5, periods: [1, 2], weekRange: [1, 18], location: '1208', teacher: '勾明' }
    ],
    strategy: {
      summary: '理解优先于刷题，证明思路要清晰',
      weeklyHours: 6,
      slots: ['周一晚19:00-21:30 复习+作业', '周四10:00-11:50 预习+作业', '周五8:00-9:50 复习', '周六9:00-12:00 专题攻坚'],
      aiUsage: '用 ChatGPT/DeepSeek 拆解难懂的证明和概念'
    }
  },
  {
    id: 'english',
    name: '大学英语Ⅰ-中外合作班',
    credits: 4.0,
    examType: '考试',
    priority: '最高',
    targetScore: 90,
    gradeBreakdown: { final: 0.5, midterm: 0.25, usual: 0.25 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 1, periods: [5, 6], weekRange: [1, 18], location: '5209', teacher: '陈娟' },
      { day: 2, periods: [5, 6], weekRange: [1, 18], location: '5209', teacher: '陈娟' }
    ],
    strategy: {
      summary: '弱项写作+阅读专项突破，听力利用碎片时间',
      weeklyHours: 5,
      slots: ['每日午休12:40-13:30 单词30个+听力', '周五14:00-16:00 四级阅读', '周六19:00-21:30 四级写作+听力'],
      aiUsage: '用 ChatGPT 批改英语作文'
    }
  },
  {
    id: 'cprogramming',
    name: '程序设计基础（含实验）',
    credits: 3.0,
    examType: '考试',
    priority: '高',
    targetScore: 90,
    gradeBreakdown: { final: 0.5, midterm: 0.25, usual: 0.25 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      // 周一3-4节
      { day: 1, periods: [3, 4], weekRange: [3, 3], location: '1506', teacher: '郝星星', label: '辅导' },
      { day: 1, periods: [3, 4], weekRange: [10, 11], location: '1506', teacher: '郝星星', label: '辅导' },
      { day: 1, periods: [3, 4], weekRange: [4, 9], location: '3J301', teacher: 'Serafeim Perdikis', label: '理论' },
      { day: 1, periods: [3, 4], weekRange: [13, 18], location: '计算机技术实验室-321', teacher: '刘阳洋', label: '新生专业导读实验', courseId: 'freshman-guide' },
      // 周三3-4节
      { day: 3, periods: [3, 4], weekRange: [3, 3], location: '3J301', teacher: '郝星星', label: '辅导' },
      { day: 3, periods: [3, 4], weekRange: [10, 11], location: '3J301', teacher: '郝星星', label: '辅导' },
      { day: 3, periods: [3, 4], weekRange: [4, 9], location: '计算机技术实验室-321', teacher: '郝星星', label: '实验' },
      { day: 3, periods: [3, 4], weekRange: [13, 18], location: '计算机技术实验室-321', teacher: '刘阳洋', label: '新生专业导读实验', courseId: 'freshman-guide' },
      // 周四1-2节
      { day: 4, periods: [1, 2], weekRange: [3, 3], location: '1508', teacher: '郝星星', label: '辅导' },
      { day: 4, periods: [1, 2], weekRange: [11, 11], location: '1508', teacher: '郝星星', label: '辅导' },
      { day: 4, periods: [1, 2], weekRange: [4, 7], location: '1306', teacher: 'Serafeim Perdikis', label: '理论' },
      { day: 4, periods: [1, 2], weekRange: [13, 16], location: '1306', teacher: 'Jianhua He', label: '新生专业导读理论', courseId: 'freshman-guide' },
      // 周四9-10节
      { day: 4, periods: [9, 10], weekRange: [4, 9], location: '计算机技术实验室-321', teacher: '郝星星', label: '实验' },
      { day: 4, periods: [9, 10], weekRange: [18, 18], location: '计算机技术实验室-321', teacher: '刘阳洋', label: '新生专业导读实验', courseId: 'freshman-guide' },
      // 周五3-4节
      { day: 5, periods: [3, 4], weekRange: [4, 7], location: '计算机技术实验室-321', teacher: '郝星星', label: '实验' },
      // 周五1-4节（整上午连排，仅特定周）
      { day: 5, periods: [1, 2, 3, 4], weekRange: [8, 9], location: '计算机技术实验室-321', teacher: '郝星星', label: '实验(连排)' },
      { day: 5, periods: [1, 2, 3, 4], weekRange: [10, 10], location: '1508', teacher: '郝星星', label: '辅导(连排)' }
    ],
    strategy: {
      summary: '动手写大于看视频，每章至少独立完成3道编程题',
      weeklyHours: 5,
      slots: ['周三20:50-21:30 C语言', '周四20:50-21:30 C语言', '周五19:00-21:30 AI辅助编程', '周六14:00-16:00 项目式练习'],
      aiUsage: '用 Claude Code 辅助编程+debug，DeepSeek 解释概念'
    }
  },
  {
    id: 'history',
    name: '中国近现代史纲要',
    credits: 3.0,
    examType: '考试',
    priority: '高',
    targetScore: 85,
    gradeBreakdown: { final: 0.6, midterm: 0.2, usual: 0.2 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 2, periods: [1, 2, 3], weekRange: [1, 18], location: '1J201', teacher: '李志松' }
    ],
    strategy: {
      summary: '框架记忆法（时间线+因果链），不死记硬背',
      weeklyHours: 2,
      slots: ['周二10:50-12:00 整理笔记', '周日 上午 背诵+框架梳理'],
      aiUsage: '考前用 AI 出题模拟'
    }
  },
  {
    id: 'chinese',
    name: '大学语文',
    credits: 2.0,
    examType: '考试',
    priority: '中',
    targetScore: 85,
    gradeBreakdown: { final: 0.7, usual: 0.3 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 3, periods: [9, 10], weekRange: [1, 18], location: '3J101', teacher: '刘晓' }
    ],
    strategy: {
      summary: '课后阅读+笔记，考前2周集中复习',
      weeklyHours: 2,
      slots: ['周三午休碎片 阅读', '周日10:00-11:30 整理笔记'],
      aiUsage: ''
    }
  },
  {
    id: 'major-english',
    name: '专业英语',
    credits: 2.0,
    examType: '考试',
    priority: '中',
    targetScore: 85,
    gradeBreakdown: { final: 0.6, usual: 0.4 },
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 3, periods: [5, 6], weekRange: [1, 18], location: '3201', teacher: '王思捷' },
      { day: 4, periods: [5, 6], weekRange: [1, 9], location: '3203', teacher: '王思捷' }
    ],
    strategy: {
      summary: '跟课进度，积累AI/计算机领域专业词汇',
      weeklyHours: 1.5,
      slots: ['周四午休碎片 专业词汇'],
      aiUsage: ''
    }
  },
  {
    id: 'security',
    name: '国家安全教育',
    credits: 1.0,
    examType: '考试',
    priority: '低',
    targetScore: 80,
    gradeBreakdown: null,
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 2, periods: [9, 10], weekRange: [1, 9], location: '3J201', teacher: '贾文涛' }
    ],
    strategy: { summary: '跟课，考前2周突击', weeklyHours: 0.5, slots: [], aiUsage: '' }
  },
  {
    id: 'situation',
    name: '形势与政策Ⅰ',
    credits: 0.5,
    examType: '考试',
    priority: '低',
    targetScore: 80,
    gradeBreakdown: null,
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 4, periods: [5, 6], weekRange: [10, 18], location: '4J201', teacher: '晁莹' }
    ],
    strategy: { summary: '跟课即可', weeklyHours: 0.2, slots: [], aiUsage: '' }
  },
  {
    id: 'pe',
    name: '基础体育',
    credits: 1.0,
    examType: '考查',
    priority: '低',
    targetScore: 85,
    gradeBreakdown: null,
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 1, periods: [7, 8], weekRange: [1, 18], location: '南区操场1', teacher: '包静' }
    ],
    strategy: { summary: '正常参与', weeklyHours: 0, slots: [], aiUsage: '' }
  },
  {
    id: 'psychology',
    name: '大学生心理健康教育Ⅰ',
    credits: 1.0,
    examType: '考查',
    priority: '低',
    targetScore: 85,
    gradeBreakdown: null,
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    schedule: [
      { day: 3, periods: [7, 8], weekRange: [7, 15], location: '2407', teacher: '王鹏' }
    ],
    strategy: { summary: '正常参与', weeklyHours: 0, slots: [], aiUsage: '' }
  },
  {
    id: 'freshman-guide',
    name: '新生专业导读课程（含实验）',
    credits: 3.0,
    examType: '考试',
    priority: '中',
    targetScore: 85,
    gradeBreakdown: null,
    examDate: null,
    currentScore: null,
    risk: 'unknown',
    // 该课多数时段借用程序设计的 slot（courseId 引用见 cprogramming.schedule）
    schedule: [
      { day: 5, periods: [5, 6], weekRange: [13, 17], location: '3J201', teacher: 'Jianhua He', label: '理论' },
      { day: 5, periods: [7, 8], weekRange: [18, 18], location: '1J101', teacher: 'Jianhua He', label: '理论' },
      { day: 5, periods: [1, 2], weekRange: [13, 16], location: '1306', teacher: 'Jianhua He', label: '理论' }
    ],
    strategy: { summary: '按课表正常跟课', weeklyHours: 0, slots: [], aiUsage: '' }
  }
];
