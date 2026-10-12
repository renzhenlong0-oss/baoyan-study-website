/* ============================================================
 * mathPalette.test.js —— 微积分总结数学符号面板与 LaTeX 预览测试（v5）
 * 用法：node test/mathPalette.test.js
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  CALC_SYMBOLS, buildMathPalette, insertAtCursor, renderMathPreview, el
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 数学符号面板测试开始 ===\n');

console.log('1. 符号表');
t.ok('符号表非空（' + X.CALC_SYMBOLS.length + ' 个）', X.CALC_SYMBOLS.length >= 30);
t.ok('每个符号都有显示与插入片段', X.CALC_SYMBOLS.every(function (s) { return s[0] && s[1]; }));
t.ok('覆盖微积分核心符号（∫/∑/√/lim/d/dx/∂）',
  ['∫', '∑', '√', 'lim', 'd/dx', '∂'].every(function (name) {
    return X.CALC_SYMBOLS.some(function (s) { return s[0] === name; });
  }));

console.log('\n2. 符号面板渲染');
var ta = H.dummyEl();
ta.value = '';
var bar = X.buildMathPalette(ta);
t.eq('面板按钮数与符号表一致', bar._children.filter(function (c) { return c.className === 'math-sym'; }).length,
  X.CALC_SYMBOLS.length);
t.ok('面板含 LaTeX 用法提示', bar._children.some(function (c) { return c.className === 'hint'; }));

console.log('\n3. 光标插入');
var box = H.dummyEl();
box.value = '今天学了';
X.insertAtCursor(box, '\\int ');
t.eq('无选区时追加到末尾', box.value, '今天学了\\int ');

console.log('\n4. 数学预览渲染（mock katex）');
sandbox.katex = {
  render: function (expr, node, opts) {
    node.textContent = '[' + (opts.displayMode ? 'BLOCK' : 'INLINE') + ']' + expr;
  }
};
var cont = H.dummyEl();
cont.style = { setProperty: function () {} };
X.renderMathPreview(cont, '极限的定义：$\\lim_{x \\to a} f(x) = L$，以及 $$\\int_a^b$$。');
var texts = cont._children.map(function (c) { return c.textContent; });
t.ok('普通文本保留', texts.indexOf('极限的定义：') !== -1);
t.ok('行内公式渲染', texts.some(function (s) { return s.indexOf('[INLINE]') === 0; }));
t.ok('独立公式渲染（display 模式）', texts.some(function (s) { return s.indexOf('[BLOCK]') === 0; }));

/* 空内容 → 预览隐藏 */
var cont2 = H.dummyEl();
cont2.style = { setProperty: function () {} };
X.renderMathPreview(cont2, '   ');
t.eq('空内容时预览隐藏', cont2.style.display, 'none');

/* KaTeX 未加载 → 提示加载中（不崩溃） */
delete sandbox.katex;
sandbox.fetch = function () { return Promise.reject(new Error('no')); };
var cont3 = H.dummyEl();
cont3.style = { setProperty: function () {} };
X.renderMathPreview(cont3, '$x^2$');
t.ok('KaTeX 未加载时显示加载提示', cont3._children.some(function (c) {
  return c.textContent && c.textContent.indexOf('正在加载数学渲染组件') !== -1;
}));

t.report();
