/* ============================================================
 * harness.js —— 测试公共工具（Node vm 沙箱 + 源码拼接加载 + 断言）
 * 用法示例见 test/smoke.js 与各 *.test.js
 * ============================================================ */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');

/* v3 默认加载清单（按 index.html 顺序；新增 core/ui 文件时在对应测试中追加） */
const DEFAULT_FILES = [
  'data.js', 'migration.js',
  'data/profile.js', 'data/goals.js', 'data/policies.js', 'data/courses.js',
  'data/resources.js', 'data/curriculum.js', 'data/problems.js', 'data/roadmap.js',
  'data/competitions.js', 'data/vocabDefaults.js', 'data/defaultData.js',
  'core/goalEngine.js', 'core/policyEngine.js', 'core/gpaRiskEngine.js',
  'core/timeBudgetEngine.js', 'core/gymScheduler.js', 'core/constraintEngine.js',
  'core/strategyEngine.js', 'core/planGenerator.js', 'core/competitivenessEngine.js',
  'core/reviewEngine.js', 'core/vocabEngine.js', 'core/researchEngine.js', 'core/competitionEngine.js',
  'core/resourceEngine.js', 'core/programmingEngine.js', 'core/snapshot.js', 'core/syncEngine.js',
  'ui/weeklyPlan.js', 'ui/dashboard.js', 'ui/courses.js', 'ui/programming.js',
  'ui/research.js', 'ui/vocabCenter.js', 'ui/english.js', 'ui/competition.js', 'ui/resources.js',
  'ui/review.js', 'ui/settings.js',
  'app.js', 'schedule.js', 'today.js', 'cover.js', 'aichat.js'
];

/* 最小 DOM 元素 stub：属性可任意赋值，方法尽量贴近真实语义。
 * 关键：getElementById 只返回【已挂载到 document 的元素】——
 * 与真实浏览器一致，能抓住"容器未挂载就 getElementById"这类 bug。 */

/* 页面中预先存在的元素 id（等价 index.html 静态节点） */
const PRE_MOUNTED_IDS = [
  'view-home', 'view-today', 'view-weekplan', 'view-courses',
  'view-programming', 'view-research', 'view-english', 'view-competition',
  'view-resources', 'view-review',
  'tabs', 'week-nav', 'week-prev', 'week-next', 'week-label', 'week-label-text',
  'week-current-badge', 'week-back-today', 'btn-cover', 'btn-settings',
  'statusbar', 'modal-root', 'topbar-clock-slot', 'cover-root', 'err-banner'
];

/* 独立元素工厂（脱离挂载上下文，供测试直接造容器） */
function dummyEl(id, markMounted) {
  var el = {
    textContent: '', innerHTML: '', className: '', id: id || '',
    style: { setProperty: function () {} },
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    hidden: false,
    dataset: {},
    children: [],
    _children: [],
    parentNode: null,
    _mounted: false,
    appendChild: function (child) {
      this._children.push(child);
      child.parentNode = this;
      if (this._mounted && markMounted) markMounted(child);
      return child;
    },
    removeChild: function (child) {
      var i = this._children.indexOf(child);
      if (i !== -1) this._children.splice(i, 1);
      return child;
    },
    replaceChild: function (newChild, oldChild) {
      this.removeChild(oldChild);
      this.appendChild(newChild);
      return oldChild;
    },
    remove: function () {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    closest: function () { return null; },
    scrollIntoView: function () {},
    scrollTop: 0, scrollHeight: 0,
    value: '', checked: false, type: '', title: '', alt: '', src: '',
    files: [], rows: 1,
    getContext: function () { return null; },
    getBoundingClientRect: function () { return { x: 0, y: 0, width: 0, height: 0 }; }
  };
  return el;
}

function makeSandbox() {
  const mounted = [];   // 已挂载元素列表（真实语义：getElementById 只在此查找）

  function markMounted(el) {
    if (!el || mounted.indexOf(el) !== -1) return;
    el._mounted = true;
    mounted.push(el);
    (el._children || []).forEach(markMounted);
  }

  /* 预挂载静态节点（等价 index.html 的 section/导航等） */
  const documentEl = dummyEl('#document');
  documentEl._mounted = true;
  mounted.push(documentEl);
  PRE_MOUNTED_IDS.forEach(function (id) {
    var e = dummyEl(id, markMounted);
    e._mounted = true;
    mounted.push(e);
  });

  const documentStub = {
    _mounted: mounted,
    createElement: function () { return dummyEl('', markMounted); },
    getElementById: function (id) {
      for (var i = 0; i < mounted.length; i++) {
        if (mounted[i].id === id) return mounted[i];
      }
      return null;   // 真实语义：未挂载的元素查不到
    },
    querySelector: function () { return dummyEl('', markMounted); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    dispatchEvent: function () {},
    head: { appendChild: function (el) { markMounted(el); } },
    body: {
      appendChild: function (el) { markMounted(el); },
      classList: { toggle: function () {} }
    }
  };

  const sandbox = {
    console: console,
    Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array,
    String: String, Number: Number, Boolean: Boolean, RegExp: RegExp,
    Error: Error, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function () { return 0; }, clearInterval: function () {},
    localStorage: {
      _d: {},
      get length() { return Object.keys(this._d).length; },
      key: function (i) {
        var keys = Object.keys(this._d);
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; }
    },
    document: documentStub,
    window: { addEventListener: function () {} },
    CustomEvent: function (type) { this.type = type; },
    alert: function () {},
    fetch: function () { return Promise.reject(new Error('fetch 不可用（测试环境）')); },
    AbortController: function () { this.signal = {}; this.abort = function () {}; },
    Blob: function () {}, URL: { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} },
    Image: function () {},
    FileReader: function () {},
    /* 浏览器 base64 全局（同步引擎 Contents API 使用） */
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (b) { return Buffer.from(b, 'base64').toString('binary'); }
  };
  vm.createContext(sandbox);
  return sandbox;
}

/* 拼接加载指定文件（相对项目根目录），并注入导出片段。
 * 尚未创建的文件跳过并警告（开发期渐进加载），避免测试因缺失文件崩溃。 */
function loadBundle(sandbox, files, exportSnippet) {
  /* 去重：同一文件在清单中出现两次会导致 const 重复声明 */
  const seen = new Set();
  files = files.filter(function (f) {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
  const code = files.map(function (f) {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) {
      console.warn('  [harness] 跳过缺失文件：' + f);
      return '';
    }
    return fs.readFileSync(p, 'utf8');
  }).join('\n');
  vm.runInContext(code + '\n;globalThis.__exports = ' + exportSnippet + ';', sandbox, { filename: 'bundle.js' });
  return sandbox.__exports;
}

/* 断言器 */
function makeTester() {
  const t = { passed: 0, failed: 0 };
  t.ok = function (name, cond) {
    if (cond) { t.passed++; console.log('  ✓ ' + name); }
    else { t.failed++; console.log('  ✗ ' + name); }
  };
  t.eq = function (name, actual, expected) {
    t.ok(name + '（期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + '）', actual === expected);
  };
  t.report = function () {
    console.log('\n=== 结果：' + t.passed + ' 通过 / ' + t.failed + ' 失败 ===');
    process.exit(t.failed ? 1 : 0);
  };
  return t;
}

module.exports = { DEFAULT_FILES, DIR, makeSandbox, loadBundle, makeTester, dummyEl };
