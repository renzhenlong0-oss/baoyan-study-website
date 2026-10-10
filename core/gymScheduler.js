/* ============================================================
 * core/gymScheduler.js —— 健身排期（v3）
 * 取代 v2 固定"周二/四/五/六/日 16:00-17:40"硬编码。
 * 每周从候选日自动选 2-3 天：
 *   1. 课程少的日子优先
 *   2. 当日学习压力低优先
 *   3. 不与课程冲突（傍晚时段被占用 → 直接排除）
 *   4. 结束时间在 17:30-18:30 附近（userProfile.gym 驱动）
 * ============================================================ */

const GymScheduler = {
  /* 计算该周健身时段窗口（默认：endBy 18:30 前推 durationMin 90min → 17:00-18:30） */
  timeWindow: function () {
    var gym = state.data.userProfile.gym || {};
    var endBy = gym.endBy || '18:30';
    var durationMin = gym.durationMin || 90;
    var endMin = timeToMin(endBy);
    return minToTime(Math.max(0, endMin - durationMin)) + '-' + endBy;
  },

  /* 选日：返回 { days: [1..7], time: 'HH:MM-HH:MM', reason, excluded: {day: reason} } */
  pickGymDays: function (week) {
    var profile = state.data.userProfile;
    var gym = profile.gym || {};
    var range = gym.daysPerWeek || [2, 3];
    var excluded = {};
    var time = this.timeWindow();

    /* 军训等特殊周不安排自主健身 */
    var special = specialWeekInfo(week);
    if (special && special.noClasses) {
      return { days: [], time: time, reason: '特殊周（' + special.label + '）不安排自主健身', excluded: excluded };
    }

    var entries = getWeekEntries(week);
    var byDay = {};        // day → {rows: [rowKey...], hasPe: bool}
    for (var d = 1; d <= 7; d++) byDay[d] = { rows: [], hasPe: false };
    entries.forEach(function (it) {
      if (byDay[it.day].rows.indexOf(it.rowKey) === -1) byDay[it.day].rows.push(it.rowKey);
      if (it.course.id === 'pe') byDay[it.day].hasPe = true;
    });

    var scored = [];
    for (var d2 = 1; d2 <= 7; d2++) {
      var dateStr = dateOfWeek(week, d2);
      var info = byDay[d2];

      /* 排除条件（不可健身的日子） */
      if (isHolidayDate(dateStr)) { excluded[d2] = '假期'; continue; }
      if (info.hasPe) { excluded[d2] = '当日已有体育课，代替健身'; continue; }
      /* 傍晚 7-8 节（16:00-17:40）或晚 9-11 节起始段有课 → 与 17:00-18:30 窗口冲突 */
      if (info.rows.indexOf('pm2') !== -1) { excluded[d2] = '傍晚时段有课（' + SCHEDULE_ROWS[4].time + '）'; continue; }
      if (info.rows.indexOf('night') !== -1) { excluded[d2] = '晚间有课，与健身恢复时间冲突'; continue; }
      /* 下午 5-6 节（14:00-15:40）有课：允许（下课后正好健身），但小幅降分 */
      var score = 20;
      score -= info.rows.length * 3;                      // 课程越少越好
      if (info.rows.indexOf('pm1') !== -1) score -= 1;   // 下午课多扣 1 分
      scored.push({ day: d2, score: score });
    }

    scored.sort(function (a, b) { return b.score - a.score; });

    /* 目标次数：候选充足时选 max，不足则有多少选多少（但不低于 min） */
    var want = scored.length >= range[1] ? range[1] : scored.length;
    want = Math.max(Math.min(want, range[1]), Math.min(range[0], scored.length));

    /* 从高分到低分选，且尽量分散（与已选日相隔 ≥2 天加分优先） */
    var picked = [];
    var i = 0;
    while (picked.length < want && i < scored.length) {
      var cand = scored[i];
      var distOk = picked.every(function (p) { return Math.abs(p - cand.day) >= 2; });
      if (distOk) {
        picked.push(cand.day);
        scored.splice(i, 1);
        i = 0;
      } else {
        i++;
      }
    }
    /* 分散选完后仍不足：按分数补齐 */
    while (picked.length < want && scored.length) {
      picked.push(scored.shift().day);
    }
    picked.sort(function (a, b) { return a - b; });

    var reason = '课程少的日子优先，结束于 ' + time.split('-')[1] + ' 附近';
    return { days: picked, time: time, reason: reason, excluded: excluded };
  },

  /* 为周计划生成健身任务（subject '健身'，type '固定'） */
  buildGymTasks: function (week, pick) {
    pick = pick || this.pickGymDays(week);
    return pick.days.map(function (day) {
      return {
        day: day,
        time: pick.time,
        title: '健身',
        subject: '健身',
        type: '固定'
      };
    });
  }
};
