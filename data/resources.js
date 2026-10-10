/* ============================================================
 * data/resources.js —— 资源库默认数据（v3）
 * 原则（Resource Evaluation）：
 *   - 加入资源库 ≠ 加入计划。只有 StrategyEngine 判断"当前需要"
 *     才进入周计划。
 *   - 不能因为课程有名就自动推荐；每门资源必须能回答"为什么现在需要、
 *     解决什么问题、替代了什么、投入多少小时、是否挤压GPA、是否重复"。
 * recommend 等级：'推荐' | '可选' | '暂不推荐' | '不推荐'
 * ============================================================ */

const RESOURCES_DEFAULTS = [
  /* ---- C ---- */
  {
    id: 'res-c-course', category: 'C', name: '学校程序设计基础（含实验）',
    platform: '西北大学', url: '',
    topic: 'C语言基础（主线）', difficulty: '初级', estHours: 80,
    suitableStage: '大一上', quality: 5, directionMatch: 4, techValue: 4, baoyanValue: 5,
    timeCost: '学期内每周3课时+实验', recommend: '推荐',
    whyNow: 'GPA主线课程，C语言是编程能力与后续一切技术栈的地基',
    type: 'course'
  },
  {
    id: 'res-cs50x', category: 'C', name: 'Harvard CS50x',
    platform: 'edX / B站搬运', url: 'https://cs50.harvard.edu/x/',
    topic: 'C语言与计算机科学导论', difficulty: '初级', estHours: 150,
    suitableStage: '大一上', quality: 5, directionMatch: 4, techValue: 5, baoyanValue: 3,
    timeCost: '整学期', recommend: '可选',
    whyNow: '与学校C语言课形成互补视角；若课内进度顺利可作为查漏补缺，勿与课内并行重复投入',
    type: 'course'
  },
  {
    id: 'res-luogu-c', category: 'C', name: '洛谷 C/C++ 入门题单',
    platform: '洛谷', url: 'https://www.luogu.com.cn/',
    topic: 'C语言刷题训练', difficulty: '初级-中级', estHours: 60,
    suitableStage: '大一上', quality: 4, directionMatch: 4, techValue: 4, baoyanValue: 3,
    timeCost: '每周2-3小时', recommend: '推荐',
    whyNow: '配合编程训练中心做巩固练习；本中心已内置题库，洛谷作为扩充题源',
    type: 'practice'
  },
  /* ---- Python ---- */
  {
    id: 'res-cs50p', category: 'Python', name: 'Harvard CS50P（Python 入门）',
    platform: 'edX / B站搬运', url: 'https://cs50.harvard.edu/python/',
    topic: 'Python 基础', difficulty: '初级', estHours: 60,
    suitableStage: '大一上-大一下', quality: 5, directionMatch: 5, techValue: 4, baoyanValue: 2,
    timeCost: '每周1小时左右', recommend: '推荐',
    whyNow: 'Python 副线（约1h/周）：为科研/数据处理打地基，不替代 C 主线',
    type: 'course'
  },
  {
    id: 'res-python-doc', category: 'Python', name: 'Python 官方教程（docs.python.org）',
    platform: '官方文档', url: 'https://docs.python.org/zh-cn/3/tutorial/',
    topic: 'Python 语言参考', difficulty: '初级', estHours: 30,
    suitableStage: '任意', quality: 5, directionMatch: 5, techValue: 4, baoyanValue: 1,
    timeCost: '随查随用', recommend: '推荐',
    whyNow: '权威免费参考；遇到语法/标准库问题时优先查官方文档',
    type: 'document'
  },
  /* ---- AI / ML / DL ---- */
  {
    id: 'res-pytorch', category: 'AI', name: 'PyTorch 官方入门教程',
    platform: 'pytorch.org', url: 'https://pytorch.org/tutorials/beginner/basics/intro.html',
    topic: 'PyTorch 基础', difficulty: '中级', estHours: 40,
    suitableStage: '大一下及以后', quality: 5, directionMatch: 5, techValue: 5, baoyanValue: 4,
    timeCost: '阶段性投入', recommend: '暂不推荐',
    whyNow: '当前阶段未到：先完成 C→Python→NumPy 地基。到达大一下阶段后由系统解锁推荐',
    type: 'course'
  },
  {
    id: 'res-ml-ng', category: '机器学习', name: '吴恩达《机器学习》',
    platform: 'Coursera / B站', url: 'https://www.coursera.org/specializations/machine-learning-introduction',
    topic: '机器学习基础', difficulty: '中级', estHours: 100,
    suitableStage: '大一下-大二', quality: 5, directionMatch: 5, techValue: 5, baoyanValue: 4,
    timeCost: '阶段性投入', recommend: '暂不推荐',
    whyNow: '需 Python/NumPy 基础；大一下开始机器学习基础时解锁',
    type: 'course'
  },
  {
    id: 'res-cs231n', category: '计算机视觉', name: 'Stanford CS231n（深度学习与计算机视觉）',
    platform: 'B站搬运 / 官网', url: 'http://cs231n.stanford.edu/',
    topic: '深度学习 + CV', difficulty: '中高级', estHours: 120,
    suitableStage: '大二及以后', quality: 5, directionMatch: 5, techValue: 5, baoyanValue: 4,
    timeCost: '阶段性投入', recommend: '暂不推荐',
    whyNow: '需要 PyTorch + ML 基础；确定 CV 方向后学习',
    type: 'course'
  },
  /* ---- 科研方法 / 实验室 ---- */
  {
    id: 'res-zhao-lab', category: '科研方法', name: '赵凤军老师实验室（潜在科研训练入口）',
    platform: '西北大学', url: 'https://faculty.nwu.edu.cn/FengjunZhao/zh_CN/index.htm',
    topic: '机器学习 / 计算机视觉 / 医学图像处理 / 计算机辅助诊断 / 影像组学 / 智能感知',
    difficulty: '—', estHours: 0,
    suitableStage: '大一上（先了解，不联系）', quality: 5, directionMatch: 5, techValue: 5, baoyanValue: 5,
    timeCost: '0（当前未联系）', recommend: '推荐',
    whyNow: '潜在科研训练入口，不是"最终导师"。当前状态：未联系。目标：先提升编程基础，再准备有内容的联系',
    type: 'lab'
  },
  /* ---- Git / Linux ---- */
  {
    id: 'res-git', category: 'Git', name: 'Git 官方教程 + Pro Git 中文版',
    platform: 'git-scm.com', url: 'https://git-scm.com/book/zh/v2',
    topic: '版本控制', difficulty: '初级', estHours: 15,
    suitableStage: '大一下', quality: 5, directionMatch: 4, techValue: 5, baoyanValue: 2,
    timeCost: '两周碎片时间', recommend: '暂不推荐',
    whyNow: '进入实验室前必备；当前先专注 C 主线，大一下解锁',
    type: 'document'
  },
  {
    id: 'res-linux', category: 'Linux', name: '《鸟哥的 Linux 私房菜》',
    platform: '官网', url: 'https://linux.vbird.org/',
    topic: 'Linux 基础操作', difficulty: '初级', estHours: 40,
    suitableStage: '大一下', quality: 4, directionMatch: 4, techValue: 5, baoyanValue: 2,
    timeCost: '阶段性投入', recommend: '暂不推荐',
    whyNow: '科研实验环境必备；大一下随实验室准备阶段解锁',
    type: 'document'
  }
];
