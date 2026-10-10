/* ============================================================
 * migration.js —— 数据迁移（v2 → v3）
 * 原则：迁移只做字段级转换与旧数据导出，绝不丢用户数据。
 * 旧体系周计划的重建是幂等的：只重建 engineVersion !== 3 的计划，
 * 已勾选状态按 day|time|title 匹配保留；
 * 匹配不上的历史完成记录仍保存在 dailyLogs.tasksStatus 镜像中。
 * ============================================================ */

const DATA_VERSION = 5;

/* v2 → v3 字段级迁移（幂等，无 UI 依赖）。
 * mergeData 已为缺失字段补默认值，这里只处理：
 * 需要从旧字段【导出】的内容。 */
function runMigration(data) {
  if (!data || typeof data !== 'object') return data;
  var from = (data.version == null) ? 2 : Number(data.version);
  if (from >= DATA_VERSION) return data;

  var notes = [];

  if (from < 5) {
    /* v5：① 初始化个人英语词汇中心结构（旧数据无损，words 从空开始，
     *        历史打卡数据仍留在 dailyLogs.checklist）；
     *    ② 为存量缺失 id 的任务补确定性 id（taskStableId）——
     *       修复"勾选任何任务都只作用于第一项"的 bug；
     *       幂等：已有 id 的任务不重复处理。 */
    if (!data.vocabCenter) data.vocabCenter = defaultVocabCenterState();
    var fixedIds = 0;
    Object.keys(data.weekPlans || {}).forEach(function (k) {
      var plan = data.weekPlans[k];
      if (!plan || !plan.subjects) return;
      plan.subjects.forEach(function (sb) {
        sb.tasks.forEach(function (t) {
          if (!t.id) {
            t.id = taskStableId(Number(k), t.day, t.time, t.title);
            fixedIds++;
          }
        });
      });
    });
    if (fixedIds) notes.push('为 ' + fixedIds + ' 条历史任务补充唯一 id（修复任务勾选问题）');
  }

  if (from < 4) {
    /* 2026 国庆假期日期修正：法定假期 10-01 ~ 10-07，10-08 为上班日。
       同时使第5周计划失效重建（原计划按"10-08 假期"生成，缺周四任务）。 */
    (data.holidays || []).forEach(function (h) {
      if (h.name === '国庆节' && h.start === '2026-10-01' && h.end === '2026-10-08') {
        h.end = '2026-10-07';
        notes.push('国庆假期结束日修正：10-08 → 10-07（2026-10-08 为上班日）');
      }
    });
    if (data.weekPlans && data.weekPlans['5'] && data.weekPlans['5'].engineVersion != null) {
      data.weekPlans['5'].engineVersion = null;   // 下次加载按新假期数据重建（保留勾选状态）
      notes.push('第5周计划将按修正后的假期数据重建');
    }
  }

  if (from < 3) {
    /* 0. 兜底：确保 v3 新增结构存在（正常流程已由 mergeData 补全，此处防结构损坏的旧数据） */
    if (!data.goals) data.goals = clone(GOALS_DEFAULTS);
    if (!data.policies) data.policies = clone(POLICIES_DEFAULTS);
    if (!data.resources) data.resources = clone(RESOURCES_DEFAULTS);
    if (!data.programming) data.programming = defaultProgrammingState();
    if (!data.research) data.research = defaultResearchState();
    if (!data.competitions) data.competitions = clone(COMPETITIONS_DEFAULTS);
    if (!data.timeBudgets) data.timeBudgets = {};
    if (!data.snapshots) data.snapshots = [];
    if (!data.weekPlans) data.weekPlans = {};
    if (!data.dailyLogs) data.dailyLogs = {};
    if (!data.weekReviews) data.weekReviews = {};

    /* 1. 旧 C 语言路线图（v2 dashboard 勾选记录）→ 编程训练进度 */
    if (data.roadmap && typeof data.roadmap === 'object') {
      var topicMap = { '循环': 'c-loop', '数组': 'c-array', '指针': 'c-pointer', '文件': 'c-file' };
      var prog = data.programming;
      Object.keys(data.roadmap).forEach(function (nodeId) {
        var node = data.roadmap[nodeId];
        if (!node || !node.topics) return;
        Object.keys(node.topics).forEach(function (topicName) {
          if (!node.topics[topicName]) return;
          var tid = topicMap[nodeId] || topicMap[topicName];
          if (!tid || !prog) return;
          var list = prog.c && prog.c.topics;
          for (var i = 0; i < list.length; i++) {
            /* v2 中用户勾选过 = 已完成，覆盖初始 inProgress 状态 */
            if (list[i].id === tid) list[i].status = 'done';
          }
        });
      });
      notes.push('v2 C语言路线图勾选进度已迁移到编程训练中心');
    }

    /* 2. AI 单快照 → 快照列表 */
    if (data.aiChat && data.aiChat.snapshot) {
      var s = data.aiChat.snapshot;
      data.snapshots = data.snapshots || [];
      data.snapshots.unshift({
        id: uid(),
        label: 'AI 采纳前快照（旧系统迁移）',
        createdAt: s.createdAt || new Date().toISOString(),
        week: s.week,
        payload: { subjects: s.subjects || [] },
        source: 'migration'
      });
      data.aiChat.snapshot = null;
      notes.push('v2 单次撤销快照已迁入快照系统');
    }

    /* 3. 每日复盘 checklist 补齐 v3 字段 */
    Object.keys(data.dailyLogs || {}).forEach(function (dateStr) {
      var log = data.dailyLogs[dateStr];
      if (!log) return;
      log.checklist = mergeChecklist(defaultChecklist(), log.checklist || {});
    });

    /* 4. 旧科目名映射说明（计划将在下次加载时由新引擎重建） */
    notes.push('周计划将在下次加载时由 v3 引擎重建（勾选状态保留）');
  }

  data.version = DATA_VERSION;
  data.migrationLog = {
    from: from,
    to: DATA_VERSION,
    at: new Date().toISOString(),
    notes: notes
  };
  return data;
}

/* checklist 合并：旧字段保留 + 新字段补默认 */
function mergeChecklist(base, loaded) {
  var out = clone(base);
  Object.keys(loaded || {}).forEach(function (k) { out[k] = loaded[k]; });
  return out;
}

/* 旧体系周计划重建（幂等；依赖 PlanGenerator，未加载时延后到下次运行） */
function rebuildLegacyWeekPlans(data) {
  if (typeof PlanGenerator === 'undefined') {
    return { rebuilt: 0, deferred: true };
  }
  var rebuilt = 0;
  var unmatched = [];
  Object.keys(data.weekPlans || {}).forEach(function (k) {
    var plan = data.weekPlans[k];
    /* 计划引擎版本（3）与数据版本（DATA_VERSION）相互独立：
       只重建缺失 engineVersion 的旧体系计划，避免数据升级导致全量重生成 */
    if (!plan || (plan.engineVersion != null && plan.engineVersion >= 3)) return;

    /* 收集已完成/跳过任务的勾选状态 */
    var kept = {};
    plan.subjects.forEach(function (sb) {
      sb.tasks.forEach(function (t) {
        if (t.status !== 'todo') {
          kept[t.day + '|' + t.time + '|' + t.title] = { status: t.status, note: t.note, subject: sb.subject };
        }
      });
    });

    /* record:false —— 重建历史周不覆盖本周战略与预算记录 */
    var fresh = PlanGenerator.generate(Number(k), { record: false });
    if (!fresh || !fresh.subjects) return;

    var matched = 0;
    fresh.subjects.forEach(function (sb) {
      sb.tasks.forEach(function (t) {
        var key = t.day + '|' + t.time + '|' + t.title;
        if (kept[key]) {
          t.status = kept[key].status;
          t.note = kept[key].note;
          matched++;
        }
      });
    });

    /* 未匹配的历史完成记录：已存在于 dailyLogs.tasksStatus 镜像（不丢），记录日志 */
    var keptCount = Object.keys(kept).length;
    if (keptCount > matched) {
      unmatched.push({ week: Number(k), kept: keptCount, matched: matched });
    }

    data.weekPlans[k] = fresh;
    rebuilt++;
  });

  if (rebuilt) {
    var log = data.migrationLog || {};
    log.rebuild = {
      at: new Date().toISOString(),
      rebuilt: rebuilt,
      unmatched: unmatched,
      note: '旧体系周计划已按 v3 引擎重建；未匹配的历史完成记录保留在每日复盘镜像中'
    };
    data.migrationLog = log;
  }
  return { rebuilt: rebuilt, unmatched: unmatched };
}
