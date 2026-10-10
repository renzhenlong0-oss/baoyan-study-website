/* ============================================================
 * core/snapshot.js —— 快照系统（v3，§46）
 * 替代 v2 的"只能撤销最近一次"：
 *   - 可创建 / 恢复 / 对比 / 删除快照（上限 20 条，超出自动淘汰最旧）
 *   - AI 采纳、计划重新生成等高风险操作前自动创建快照
 * 快照内容：指定周的周计划 + 该周预算 + 本周战略（裁剪存储）。
 * ============================================================ */

const SnapshotEngine = {
  MAX: 20,

  /* 创建快照（默认当前周），返回快照对象 */
  create: function (label, week) {
    var wk = week != null ? week : currentWeek();
    var plan = getWeekPlan(wk);
    var snapshots = state.data.snapshots || (state.data.snapshots = []);
    var snap = {
      id: 'snap-' + uid(),
      label: label || '手动快照',
      createdAt: new Date().toISOString(),
      week: wk,
      payload: {
        subjects: plan ? clone(plan.subjects) : null,
        focus: plan ? plan.focus : null,
        weeklyStrategy: state.data.weeklyStrategy ? clone(state.data.weeklyStrategy) : null,
        timeBudget: (state.data.timeBudgets && state.data.timeBudgets[String(wk)]) ? clone(state.data.timeBudgets[String(wk)]) : null
      }
    };
    snapshots.push(snap);
    if (snapshots.length > this.MAX) snapshots.splice(0, snapshots.length - this.MAX);
    saveData();
    return snap;
  },

  list: function () {
    return (state.data.snapshots || []).slice().reverse();
  },

  get: function (id) {
    return (state.data.snapshots || []).find(function (s) { return s.id === id; }) || null;
  },

  /* 恢复快照：还原该周计划 + 战略 + 预算 */
  restore: function (id) {
    var snap = this.get(id);
    if (!snap) return { ok: false, error: '快照不存在' };
    if (!snap.payload.subjects) return { ok: false, error: '该快照没有周计划内容（快照时计划未生成）' };

    var plan = getWeekPlan(snap.week);
    if (!plan) {
      plan = {
        weekNumber: snap.week,
        focus: snap.payload.focus,
        engineVersion: 3,
        subjects: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.data.weekPlans[String(snap.week)] = plan;
    }
    plan.subjects = clone(snap.payload.subjects);
    plan.focus = snap.payload.focus || plan.focus;
    plan.updatedAt = new Date().toISOString();
    if (snap.payload.weeklyStrategy) state.data.weeklyStrategy = clone(snap.payload.weeklyStrategy);
    if (snap.payload.timeBudget) {
      state.data.timeBudgets = state.data.timeBudgets || {};
      state.data.timeBudgets[String(snap.week)] = clone(snap.payload.timeBudget);
    }
    saveData();
    return { ok: true, snap: snap };
  },

  /* 对比两个快照（或快照 vs 当前计划）：科目学时与任务数变化 */
  compare: function (idA, idB) {
    var a = this.get(idA);
    var b = idB ? this.get(idB) : null;
    var summaryA = this._summary(a && a.payload ? a.payload.subjects : null);
    var summaryB = this._summary(b && b.payload ? b.payload.subjects : null);
    var cur = getWeekPlan(a ? a.week : currentWeek());
    var summaryCur = this._summary(cur ? cur.subjects : null);
    return {
      a: { label: a ? a.label : '', at: a ? a.createdAt : '', summary: summaryA },
      b: { label: b ? b.label : '当前计划', at: b ? b.createdAt : '', summary: b ? summaryB : summaryCur }
    };
  },

  _summary: function (subjects) {
    if (!subjects) return null;
    var out = [];
    subjects.forEach(function (sb) {
      out.push(sb.subject + ' ' + sb.plannedHours + 'h/' + sb.tasks.length + '任务(' +
        sb.tasks.filter(function (t) { return t.status === 'done'; }).length + '完成)');
    });
    return out;
  },

  remove: function (id) {
    var list = state.data.snapshots || [];
    var idx = list.findIndex(function (s) { return s.id === id; });
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveData();
    return true;
  }
};
