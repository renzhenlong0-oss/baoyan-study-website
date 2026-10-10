/* ============================================================
 * data/curriculum.js —— 编程路线知识点树（v3）
 * 进度状态（done/inProgress/locked）由【提交记录动态计算】，
 * 这里只定义知识点结构、前置依赖与初始状态。
 *   status 仅作初始值（用户已知进度：C 到 for/while）；
 *   requires = 前置知识点 id 列表（Constraint Engine 任务依赖检查用）。
 * Python 当前只开放基础阶段（stage:'base'），NumPy 起锁定。
 * ============================================================ */

const C_CURRICULUM = [
  { id: 'c-basics',   name: '基础语法',   status: 'done',       requires: [] },
  { id: 'c-if',       name: 'if / else',  status: 'done',       requires: ['c-basics'] },
  { id: 'c-loop',     name: 'for / while',status: 'inProgress', requires: ['c-if'] },
  { id: 'c-array',    name: '数组',       status: 'locked',     requires: ['c-loop'] },
  { id: 'c-string',   name: '字符串',     status: 'locked',     requires: ['c-array'] },
  { id: 'c-func',     name: '函数',       status: 'locked',     requires: ['c-loop'] },
  { id: 'c-pointer',  name: '指针',       status: 'locked',     requires: ['c-array', 'c-func'] },
  { id: 'c-struct',   name: '结构体',     status: 'locked',     requires: ['c-pointer'] },
  { id: 'c-file',     name: '文件',       status: 'locked',     requires: ['c-struct'] },
  { id: 'c-ds',       name: '基础数据结构', status: 'locked',   requires: ['c-struct', 'c-pointer'] }
];

const PYTHON_CURRICULUM = [
  { id: 'py-basics',  name: '基础语法',   status: 'inProgress', requires: [], stage: 'base' },
  { id: 'py-if',      name: '条件',       status: 'locked',     requires: ['py-basics'], stage: 'base' },
  { id: 'py-loop',    name: '循环',       status: 'locked',     requires: ['py-if'], stage: 'base' },
  { id: 'py-func',    name: '函数',       status: 'locked',     requires: ['py-loop'], stage: 'base' },
  { id: 'py-list',    name: 'List',       status: 'locked',     requires: ['py-loop'], stage: 'base' },
  { id: 'py-dict',    name: 'Dict',       status: 'locked',     requires: ['py-list'], stage: 'base' },
  { id: 'py-file',    name: '文件',       status: 'locked',     requires: ['py-func'], stage: 'base' },
  { id: 'py-module',  name: '模块',       status: 'locked',     requires: ['py-file'], stage: 'base' },
  /* 以下阶段未到，锁定（不安排任何训练任务） */
  { id: 'py-numpy',   name: 'NumPy',      status: 'locked',     requires: ['py-module'], stage: 'numpy' },
  { id: 'py-matplotlib', name: 'Matplotlib', status: 'locked',  requires: ['py-numpy'], stage: 'numpy' },
  { id: 'py-pandas',  name: 'Pandas',     status: 'locked',     requires: ['py-numpy'], stage: 'numpy' },
  { id: 'py-torch',   name: 'PyTorch',    status: 'locked',     requires: ['py-numpy'], stage: 'dl' }
];

/* 错误类型（提交时记录，用于错误模式检测） */
const ERROR_TYPES = ['语法', '变量', '条件', '循环', '数组', '边界', '函数', '指针', '算法', '输入输出'];
