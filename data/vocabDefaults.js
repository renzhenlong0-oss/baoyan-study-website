/* ============================================================
 * data/vocabDefaults.js —— 个人英语词汇中心（v5）默认数据与常量
 * 三个词库：general_advanced（雅思进阶/四六级薄弱词）、
 *          academic_english（学术英语）、ai_robotics（AI/机器人专业词）
 * 设计分工（规格§一）：
 *   外部背词软件（墨墨等）负责通用词汇日常间隔复习；
 *   本网站负责个人专业词库、论文生词收集、语境学习、统计与导入导出。
 * AI 只辅助释义/例句，AI 生成内容必须带 aiGenerated 标记，
 * 未经用户确认不入库，不标记为可靠原文。
 * ============================================================ */

/* 三个主要词库（顺序即展示顺序；ratio 为初始新增比例，用户可改） */
const VOCAB_LIBRARIES = [
  {
    key: 'general_advanced',
    label: '通用进阶',
    desc: '雅思进阶词汇及四六级薄弱词（配合墨墨背单词日常复习）',
    defaultRatio: 50,      // 初始新增比例 %
    defaultWeeklyNew: 30   // 每周新增目标（个）
  },
  {
    key: 'academic_english',
    label: '学术英语',
    desc: '论文常用表达、学术搭配与书面语',
    defaultRatio: 30,
    defaultWeeklyNew: 18
  },
  {
    key: 'ai_robotics',
    label: 'AI·机器人专业词',
    desc: '机器学习、计算机视觉、机器人学、具身智能等专业词汇',
    defaultRatio: 20,
    defaultWeeklyNew: 12
  }
];

const VOCAB_LIBRARY_KEYS = VOCAB_LIBRARIES.map(function (l) { return l.key; });

/* 考试标签与专业方向标签（可多选；导入时未知标签仍保留，仅不参与预置筛选器） */
const VOCAB_EXAM_TAGS = ['CET4', 'CET6', 'IELTS', 'TOEFL', '考研'];
const VOCAB_DOMAIN_TAGS = ['AI', 'ML', 'CV', 'Robotics', 'EmbodiedAI', 'Academic', 'CS', 'Math'];

/* 来源类型（区分考试词库/学术材料/技术文档/论文/手动录入） */
const VOCAB_SOURCE_TYPES = ['exam', 'academic', 'techdoc', 'paper', 'manual'];

/* 掌握等级：0 未学 / 1 认识 / 2 模糊 / 3 熟练 / 4 精通（基础与语境分开记录） */
const VOCAB_MASTERY_LEVELS = [0, 1, 2, 3, 4];
const VOCAB_STATUSES = ['new', 'learning', 'mastered'];

/* 字段长度上限（防 localStorage 膨胀） */
const VOCAB_LIMITS = {
  word: 80, phonetic: 80, definition: 200, englishDefinition: 300,
  example: 300, collocation: 100, sourceTitle: 120, sourceExcerpt: 200,
  notes: 500, sense: 200, maxWords: 2000
};

/* 复习间隔（天）：按 status + mastery 查表；未到期不算积压 */
const VOCAB_REVIEW_INTERVALS = {
  new: 0,       // 新词当天就应复习
  learning: 1,
  mastered: 3
};

function defaultVocabSettings() {
  var libraries = {};
  VOCAB_LIBRARIES.forEach(function (l) {
    libraries[l.key] = {
      ratio: l.defaultRatio,          // 新增比例 %（三库之和不必为 100，仅作分配权重）
      weeklyNew: l.defaultWeeklyNew   // 每周新增目标（个）
    };
  });
  return {
    /* 每日词汇学习预算（分钟，默认 20–25）；复习积压多时优先复习、自动降新增 */
    dailyBudget: { min: 20, max: 25 },
    weeklyNewTotal: 60,               // 每周新增总目标（个）
    reviewFirst: true,                // 积压优先复习
    /* 复习积压阈值：超过该数量时新词减半；超过 2 倍时暂停新增 */
    backlogReduceAt: 40,
    backlogPauseAt: 80,
    /* 各词库配置：ratio 新增比例权重 / weeklyNew 每周新增目标（均可改） */
    libraries: libraries
  };
}

/* 词汇中心初始状态（无词条；migration v5 为旧数据初始化该结构） */
function defaultVocabCenterState() {
  return {
    schemaVersion: 1,
    words: [],                 // 词条列表（结构见 core/vocabEngine.js 头部注释）
    settings: defaultVocabSettings(),
    /* 每日练习记录 { 'YYYY-MM-DD': { minutes, newWords, reviewedWords, errors } } */
    dailyLog: {},
    lastBackupAt: null
  };
}

/* 新建词条（AI 或手动表单共用；未提供字段取空值/默认值） */
function newVocabWord(seed) {
  seed = seed || {};
  var now = new Date().toISOString();
  return {
    id: 'v' + uid(),
    word: String(seed.word || '').trim(),
    normalizedWord: '',            // 由引擎统一规范化（查重键）
    phonetic: String(seed.phonetic || ''),
    partOfSpeech: String(seed.partOfSpeech || ''),
    definitions: (seed.definitions || []).map(function (d) {
      if (typeof d === 'string') return { text: d, aiGenerated: !!seed.aiGenerated };
      return { text: String(d.text || ''), aiGenerated: !!d.aiGenerated };
    }),
    englishDefinition: String(seed.englishDefinition || ''),
    exampleSentence: String(seed.exampleSentence || ''),
    collocations: (seed.collocations || []).map(String),
    sourceType: VOCAB_SOURCE_TYPES.indexOf(seed.sourceType) !== -1 ? seed.sourceType : 'manual',
    sourceTitle: String(seed.sourceTitle || ''),
    sourceExcerpt: String(seed.sourceExcerpt || ''),   // 只保存用户提供/有权保存的短文本
    examTags: (seed.examTags || []).map(String),
    domainTags: (seed.domainTags || []).map(String),
    difficulty: Number(seed.difficulty) || 3,          // 1-5
    basicMastery: { level: Number(seed.basicMastery) || 0, updatedAt: null },
    /* 专业语境词义分别追踪：同一单词在不同词库的新词义不因基础词义掌握而自动算掌握 */
    contexts: (seed.contexts || []).map(function (c) {
      return {
        library: c.library,
        sense: String(c.sense || ''),
        mastery: { level: Number(c.mastery) || 0, updatedAt: null },
        addedAt: c.addedAt || now
      };
    }),
    /* status 由基础掌握度导出（导入带 basicMastery 的数据同样生效） */
    status: (function () {
      var lv = Number(seed.basicMastery) || 0;
      return lv >= 3 ? 'mastered' : (lv >= 1 ? 'learning' : 'new');
    })(),
    errorCount: 0,
    correctCount: 0,
    createdAt: seed.createdAt || now,
    lastReviewedAt: null,
    notes: String(seed.notes || ''),
    /* AI 生成内容标记（不得把未经核实的信息当作可靠原文） */
    aiGenerated: {
      definitions: !!seed.aiGenerated,
      example: !!seed.aiGenerated,
      collocations: !!seed.aiGenerated
    }
  };
}
