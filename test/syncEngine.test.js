/* ============================================================
 * syncEngine.test.js —— 跨设备云同步引擎测试（v5）
 * 用法：node test/syncEngine.test.js
 * 覆盖：配对码、载荷构建（去除设备专属字段）、内容哈希防 ping-pong、
 *       新设备首次拉取必采纳云端、push 冲突让位、pull 采纳并本地备份、
 *       内容相同不重复提交、base64 往返
 * ============================================================ */

const H = require('./harness');

const files = H.DEFAULT_FILES.slice();

const EXPORT_SNIPPET = `{
  SyncEngine, clone, DEFAULT_INIT_DATA, state, saveData, runMigration, mergeData,
  manualBackup, listBackups
}`;

const sandbox = H.makeSandbox();
const X = H.loadBundle(sandbox, files, EXPORT_SNIPPET);
const t = H.makeTester();

console.log('=== 同步引擎测试开始 ===\n');

/* ---------------- mock fetch：模拟远端文件存储 ---------------- */
function makeRemote() {
  var store = { content: null, sha: 'sha-1' };   // content = base64 或 null
  sandbox.fetch = function (url, opts) {
    var method = (opts && opts.method) || 'GET';
    if (method === 'GET') {
      if (store.content === null) {
        return Promise.resolve({ status: 404, json: function () { return Promise.resolve({ message: 'Not Found' }); } });
      }
      return Promise.resolve({
        status: 200,
        json: function () { return Promise.resolve({ content: store.content, sha: store.sha }); }
      });
    }
    /* PUT */
    var body = JSON.parse(opts.body);
    store.content = body.content;
    store.sha = 'sha-' + (Number(store.sha.replace('sha-', '')) + 1);
    return Promise.resolve({
      status: 201,
      json: function () { return Promise.resolve({ content: { sha: store.sha } }); }
    });
  };
  return {
    getRecord: function () {
      if (store.content === null) return null;
      return JSON.parse(X.SyncEngine.base64ToUtf8(store.content));
    },
    getSha: function () { return store.sha; }
  };
}

/* 两台设备共用同一 vm（各自通过 SyncEngine 实例操作 state 与远端） */
function freshDevice(code, enabled) {
  X.state.data = X.clone(X.DEFAULT_INIT_DATA);
  var cfg = X.SyncEngine.defaultCfg();
  cfg.token = 'test-token';
  cfg.code = code;
  cfg.enabled = enabled !== false;
  cfg.clientId = code === 'AAA111' ? 'client-A' : 'client-B';
  X.SyncEngine.cfg = cfg;
  X.SyncEngine._lastPushedJson = '';
  X.SyncEngine._lastError = '';
  X.SyncEngine._pushing = false;
  X.SyncEngine._pulling = false;
  return cfg;
}

function opResult() {
  var out = {};
  return { cb: function (err, r) { out.err = err; out.r = r; }, get: function () { return out; } };
}

/* 等一轮微任务 + 定时器（fetch mock 的 Promise 链完成） */
function tick() { return new Promise(function (res) { setTimeout(res, 10); }); }

(async function () {

  console.log('1. 配对码与配置');
  t.ok('genCode 生成 6 位', /^[A-Z2-9]{6}$/.test(X.SyncEngine.genCode()));
  freshDevice('AAA111', false);
  t.eq('filePath 由配对码决定', X.SyncEngine.filePath('AAA111'), 'sync/AAA111.json');
  t.ok('默认未启用', !X.SyncEngine.isEnabled());
  X.SyncEngine.cfg.enabled = true;
  t.ok('配置后启用', X.SyncEngine.isEnabled());

  console.log('\n2. 载荷构建（去除设备专属字段 + 内容哈希）');
  freshDevice('AAA111');
  X.state.data.coverImage = 'data:image/png;base64,xxx';
  X.state.data.snapshots = [{ id: 's1' }];
  var p = X.SyncEngine.buildPayload();
  t.ok('不含 coverImage', !('coverImage' in p.data));
  t.ok('不含 snapshots', !('snapshots' in p.data));
  t.ok('不含 lastModified', !('lastModified' in p.data));
  t.ok('含内容哈希', !!p.hash && p.hash === X.SyncEngine.hash(JSON.stringify(p.data)));
  t.ok('新设备 updatedAt = 0', p.updatedAt === 0);
  X.saveData();
  var p2 = X.SyncEngine.buildPayload();
  t.ok('保存后 updatedAt = lastModified 时间戳', p2.updatedAt > 0);
  t.ok('内容不变则哈希不变', p2.hash === p.hash);

  console.log('\n3. base64 UTF-8 往返（中文数据）');
  var zh = '{"word":"梯度","definitions":["梯度","斜率"]}';
  t.eq('base64 往返无损', X.SyncEngine.base64ToUtf8(X.SyncEngine.utf8ToBase64(zh)), zh);

  console.log('\n4. 双设备同步主流程（电脑推 → 手机拉 → 手机改 → 电脑拉）');
  var remote = makeRemote();
  /* 设备A（电脑）：有真实数据 + 一次修改 */
  freshDevice('AAA111');
  X.state.data.userProfile.name = '电脑用户';
  X.state.data.weekPlans['6'] = { weekNumber: 6, subjects: [] };
  X.saveData();
  var o1 = opResult();
  X.SyncEngine.push(o1.cb);
  await tick();
  t.ok('A 首次推送成功', !o1.get().err && o1.get().r && o1.get().r.pushed);
  var rec1 = remote.getRecord();
  t.ok('远端记录存在且含 A 数据', !!rec1 && rec1.data.userProfile.name === '电脑用户');
  t.ok('远端记录带哈希与时间戳', !!rec1 && !!rec1.hash && rec1.updatedAt > 0);

  /* 设备B（手机）：全新空数据 + 相同配对码 → 首次拉取必须采纳云端 */
  freshDevice('AAA111');
  var o2 = opResult();
  X.SyncEngine.pull(o2.cb);
  await tick();
  t.ok('B 首次拉取采纳云端数据', !o2.get().err && o2.get().r && o2.get().r.adopted === true);
  t.ok('B 数据与云端一致（名字=电脑用户）', X.state.data.userProfile.name === '电脑用户');
  t.ok('B 采纳前自动做了本地备份', X.listBackups().length >= 1);

  /* B 采纳后立即再拉 → 不重复采纳（哈希相等） */
  var o3 = opResult();
  X.SyncEngine.pull(o3.cb);
  await tick();
  t.ok('内容相同不重复采纳', o3.get().r && o3.get().r.adopted === false);

  /* 保存 A（电脑）的数据快照：此时 A/B 数据一致（均无手机勾选） */
  var aSnapshot = X.clone(X.state.data);

  /* B 修改（手机上勾任务）→ 推送 */
  X.state.data.weekPlans['6'].subjects.push({ subject: '英语/四级', tasks: [{ id: 't9', day: 5, time: '12:40-13:30', title: '英语单词30个', status: 'done' }] });
  X.saveData();
  var o4 = opResult();
  X.SyncEngine.push(o4.cb);
  await tick();
  t.ok('B 推送成功', !o4.get().err);
  var rec2 = remote.getRecord();
  t.ok('远端已含 B 的修改（手机勾选）', JSON.stringify(rec2.data.weekPlans).indexOf('英语单词30个') !== -1);

  /* A（电脑）拉取 → 看到手机勾选（恢复到 A 在手机修改前的数据快照再拉） */
  freshDevice('AAA111');
  X.state.data = aSnapshot;
  var o5 = opResult();
  X.SyncEngine.pull(o5.cb);
  await tick();
  t.ok('A 拉取采纳 B 的修改', o5.get().r && o5.get().r.adopted === true);
  t.ok('A 数据包含手机勾的任务', JSON.stringify(X.state.data.weekPlans).indexOf('英语单词30个') !== -1);

  console.log('\n5. 防 ping-pong（内容相同不再互推互拉）');
  var shaBefore = remote.getSha();
  var o6 = opResult();
  X.SyncEngine.push(o6.cb);
  await tick();
  t.ok('内容相同 push 直接跳过（无新提交）', o6.get().r && o6.get().r.skipped === true && remote.getSha() === shaBefore);
  var o7 = opResult();
  X.SyncEngine.pull(o7.cb);
  await tick();
  t.ok('内容相同 pull 不采纳', o7.get().r && o7.get().r.adopted === false);

  console.log('\n6. 冲突让位（远端更新时本地 push 不覆盖）');
  /* A 先推一个更新 */
  freshDevice('AAA111');
  X.state.data.userProfile.name = 'A的新修改';
  X.saveData();
  var o8 = opResult();
  X.SyncEngine.push(o8.cb);
  await tick();
  /* B（陈旧数据，时间戳更早）尝试 push → 应让位采纳远端 */
  X.state.data.userProfile.name = 'B的旧修改';
  X.state.data.lastModified = '2020-01-01T00:00:00.000Z';
  X.SyncEngine._lastPushedJson = '';
  var o9 = opResult();
  X.SyncEngine.push(o9.cb);
  await tick();
  t.ok('B 推送让位（不覆盖远端新数据）', o9.get().r && o9.get().r.adopted === true);
  t.ok('B 数据被远端 A 的新修改覆盖', X.state.data.userProfile.name === 'A的新修改');

  console.log('\n7. 错误处理');
  sandbox.fetch = function () { return Promise.reject(new Error('network down')); };
  freshDevice('AAA111');
  X.state.data.userProfile.name = 'x';
  X.saveData();
  var o10 = opResult();
  X.SyncEngine.pull(o10.cb);
  await tick();
  t.ok('网络失败返回错误并记录', !!o10.get().err && X.SyncEngine._lastError.indexOf('network down') !== -1);
  t.ok('statusText 显示同步失败', X.SyncEngine.statusText().indexOf('同步失败') !== -1);

  t.report();
})().catch(function (e) { console.error('测试异常：', e); process.exit(1); });
