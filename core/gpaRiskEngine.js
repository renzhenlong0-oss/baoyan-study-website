/* ============================================================
 * core/gpaRiskEngine.js —— GPA 风险引擎（v3）
 * 三态：GREEN / YELLOW / RED
 *   GREEN  核心课程稳定 → 正常推进科研/编程
 *   YELLOW 某门核心课出现风险 → 减少科研、增加该课复习
 *   RED    挂科风险/严重落后/大考临近且准备不足 → Protection Mode：
 *          科研→Maintenance、竞赛→暂停、外部课程→暂停/减少、核心课程→优先
 *          注意：不默认完全停止科研，保持最低科研接触。
 * 数据来源：course.currentScore / course.risk（用户维护）、examDate、examWeeksHint
 * ============================================================ */

const GpaRiskEngine = {
  /* 单课程风险状态 */
  assessCourse: function (course, week) {
    if (!course) return 'green';
    if (course.examType === '考查') return 'green';

    var daysToExam = null;
    if (course.examDate) {
      daysToExam = diffDays(dateOfWeek(week, 7), course.examDate);   // 距周末还有几天
    }
    var inExamWeeks = (state.data.semester.examWeeksHint || []).indexOf(week) !== -1;
    var score = course.currentScore;   // null = 未知
    var risk = course.risk || 'unknown';

    /* RED：挂科风险 / 严重落后 / 大考临近且准备不足 */
    if (risk === 'red') return 'red';
    if (score != null && score < 65) return 'red';
    if ((inExamWeeks || (daysToExam != null && daysToExam <= 7)) &&
        (score == null || score < 75)) return 'red';

    /* YELLOW：成绩风险 / 考试临近准备一般 */
    if (risk === 'yellow') return 'yellow';
    if (score != null && score < 80) return 'yellow';
    if ((daysToExam != null && daysToExam <= 14) && (score == null || score < 85)) return 'yellow';

    return 'green';
  },

  /* 整周风险评估：核心课程（考试课 & 学分≥2）逐个评估 */
  assessWeek: function (week) {
    var list = [];
    var status = 'green';
    state.data.courses.forEach(function (c) {
      if (c.examType !== '考试' || (c.credits || 0) < 2) return;
      var risk = GpaRiskEngine.assessCourse(c, week);
      list.push({ id: c.id, name: c.name, risk: risk, credits: c.credits });
      if (risk === 'red') status = 'red';
      else if (risk === 'yellow' && status !== 'red') status = 'yellow';
    });
    return { week: week, status: status, courses: list, protectionMode: status === 'red' };
  },

  /* Protection Mode 的资源调整系数（strategyEngine 消费） */
  protectionAdjustments: function (status) {
    if (status === 'red') {
      return { researchScale: 0.3, competitionScale: 0, externalScale: 0, note: 'GPA Protection Mode：科研→Maintenance、竞赛→暂停、外部课程→暂停、核心课程→优先' };
    }
    if (status === 'yellow') {
      return { researchScale: 0.6, competitionScale: 0.5, externalScale: 0.5, note: '核心课程风险：适当减少科研/竞赛投入，增加复习' };
    }
    return { researchScale: 1, competitionScale: 1, externalScale: 1, note: '' };
  }
};
