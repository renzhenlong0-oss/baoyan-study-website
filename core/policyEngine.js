/* ============================================================
 * core/policyEngine.js —— 政策引擎（v3）
 * 推免政策库（可编辑）。原则：不假装知道——
 * 校级规则未核实标注 confirmed:false；院级细则未知时
 * 明确显示"院系实施细则待补充，当前采用学校级规则进行估算"。
 * ============================================================ */

const PolicyEngine = {
  /* 当前生效的政策（返回 null = 无可用政策） */
  active: function () {
    return getActivePolicy(state.data);
  },

  /* 院级细则是否缺失 */
  collegeMissing: function () {
    return !hasCollegePolicy(state.data);
  },

  /* 政策对界面的提示文案 */
  hint: function () {
    var p = this.active();
    var parts = [];
    if (p) {
      parts.push('当前采用：' + p.school + ' ' + p.year + ' ' + (p.status === 'school' ? '校级' : '院级') + '规则' +
        (p.confirmed ? '' : '（未与官方文件核实）'));
      if (p.note) parts.push(p.note);
    } else {
      parts.push('暂无推免政策数据，请在设置中录入。');
    }
    if (this.collegeMissing()) {
      parts.push('院系实施细则待补充，当前采用学校级规则进行估算。');
    }
    return parts.join(' ');
  },

  /* 必达条件清单（requiredConditions 汇总） */
  conditions: function () {
    var p = this.active();
    return p && p.requiredConditions ? p.requiredConditions.slice() : [];
  }
};
