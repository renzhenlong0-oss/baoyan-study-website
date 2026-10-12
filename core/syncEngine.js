/* ============================================================
 * core/syncEngine.js —— 跨设备数据同步引擎（v5）
 * 场景：手机（PWA）与电脑共用同一份计划数据——手机上勾任务，
 *       电脑端自动更新，反之亦然。
 * 方案：GitHub 私有仓库 baoyan-sync 作为中转（Contents API 读写），
 *       细粒度 PAT 只授权该仓库；国内可直连 api.github.com。
 * 设计：
 *   - 配对码（6位）= 数据文件路径 sync/<code>.json，两端填相同配对码
 *     即共享同一份数据；
 *   - 同步载荷 = 整份 state.data（去除 coverImage/snapshots 等
 *     设备专属大字段）；
 *   - 冲突策略：整文档最后写入胜出（updatedAt 比较，5s 容差），
 *     适合个人单用户双设备场景；
 *   - 拉取采纳前自动本地备份（防误覆盖）；
 *   - 自动同步：每 25s 拉取一次；本地任何 saveData 防抖 2s 推送；
 *     内容与上次推送相同则跳过（防 ping-pong）。
 * ============================================================ */

const SyncEngine = {

  STORAGE_KEY: 'studySync',
  POLL_MS: 25000,
  PUSH_DEBOUNCE_MS: 2000,
  /* 时间戳严格比较（内容哈希已负责防 ping-pong，不再需要容差；
     容差会误伤"内容不同但时间接近"的正常同步） */
  TOLERANCE_MS: 0,

  cfg: null,
  _pollTimer: null,
  _pushTimer: null,
  _pushing: false,
  _pulling: false,
  _lastPushedJson: '',
  _lastSyncAt: 0,
  _lastError: '',

  /* ---------------- 配置 ---------------- */

  defaultCfg: function () {
    return {
      token: '',
      owner: 'renzhenlong0-oss',
      repo: 'baoyan-sync',
      code: '',
      enabled: false,
      clientId: 'c' + Math.random().toString(36).slice(2, 10),
      lastSyncAt: 0,
      lastError: ''
    };
  },

  loadCfg: function () {
    if (this.cfg) return this.cfg;
    var raw = null;
    try { raw = localStorage.getItem(this.STORAGE_KEY); } catch (e) { /* ignore */ }
    this.cfg = this.defaultCfg();
    if (raw) {
      try {
        var p = JSON.parse(raw);
        for (var k in p) this.cfg[k] = p[k];
      } catch (e) { /* 坏配置回默认 */ }
    }
    return this.cfg;
  },

  saveCfg: function () {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cfg)); } catch (e) { /* ignore */ }
  },

  isEnabled: function () {
    var c = this.loadCfg();
    return !!(c.enabled && c.token && c.code);
  },

  /* 配对码：6 位易读字符（去 0/O/1/I），也是远端文件名与访问键 */
  genCode: function () {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  },

  filePath: function (code) {
    return 'sync/' + (code || this.loadCfg().code) + '.json';
  },

  /* ---------------- 基础工具 ---------------- */

  apiUrl: function (code) {
    var c = this.loadCfg();
    return 'https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + this.filePath(code);
  },

  _headers: function () {
    var c = this.loadCfg();
    return {
      'Authorization': 'Bearer ' + c.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'baoyan-sync'
    };
  },

  /* UTF-8 安全的 base64（GitHub Contents API 需要 base64） */
  utf8ToBase64: function (str) {
    if (typeof TextEncoder !== 'undefined') {
      var bytes = new TextEncoder().encode(str);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(str)));
  },

  base64ToUtf8: function (b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    if (typeof TextDecoder !== 'undefined') {
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(bin));
  },

  /* 简单内容哈希（djb2）：用于判断两端数据是否实质相同，防 ping-pong */
  hash: function (str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  },

  /* 同步载荷：整份数据，去掉设备专属/不稳定字段。
   * updatedAt 取数据自身的 lastModified（首次同步的新设备为 0 → 一定采纳云端），
   * hash 用于内容相等判断（采纳后不再互推，避免无限循环）。 */
  buildPayload: function () {
    var data = clone(state.data);
    /* 封面图/快照不跨设备（体积大、桌面专属）；lastModified/migrationLog 不稳定 */
    delete data.coverImage;
    delete data.snapshots;
    delete data.lastModified;
    delete data.migrationLog;
    var c = this.loadCfg();
    var lm = state.data.lastModified ? Date.parse(state.data.lastModified) : 0;
    var dataJson = JSON.stringify(data);
    return {
      v: 5,
      clientId: c.clientId,
      updatedAt: isNaN(lm) ? 0 : lm,
      hash: this.hash(dataJson),
      data: data
    };
  },

  /* ---------------- 远端读写 ---------------- */

  /* 拉取远端记录：cb(err, { ok, record, sha }) */
  fetchRemote: function (cb) {
    var self = this;
    var c = this.loadCfg();
    fetch(this.apiUrl(), { method: 'GET', headers: this._headers() })
      .then(function (res) {
        if (res.status === 404) { cb(null, { ok: false, notFound: true }); return; }
        return res.json().then(function (body) {
          if (res.status !== 200) {
            cb((body && body.message) || ('HTTP ' + res.status));
            return;
          }
          var record;
          try {
            record = JSON.parse(self.base64ToUtf8(body.content));
          } catch (e) {
            cb('远端数据解析失败：' + e.message);
            return;
          }
          cb(null, { ok: true, record: record, sha: body.sha });
        });
      })
      .catch(function (e) { cb('网络请求失败：' + e.message); });
  },

  /* 推送本地数据：cb(err, result)；内容与上次相同则直接跳过 */
  push: function (cb) {
    var self = this;
    if (this._pushing) { if (cb) cb(null, { skipped: true }); return; }
    this._pushing = true;
    var payload = this.buildPayload();
    var payloadJson = JSON.stringify(payload);
    if (payloadJson === this._lastPushedJson) {
      this._pushing = false;
      if (cb) cb(null, { skipped: true });
      return;
    }

    var doPut = function (sha) {
      var body = {
        message: 'sync ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
        content: self.utf8ToBase64(payloadJson)
      };
      if (sha) body.sha = sha;
      fetch(self.apiUrl(), {
        method: 'PUT',
        headers: self._headers(),
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().then(function (b) {
          if (res.status === 409) {
            /* 远端被另一设备抢先更新：重读 sha 重试一次 */
            self.fetchRemote(function (err2, r2) {
              if (err2 || !r2.ok) { self._pushing = false; if (cb) cb(err2 || '冲突且重读失败'); return; }
              doPut(r2.sha);
            });
            return;
          }
          if (res.status !== 200 && res.status !== 201) {
            self._pushing = false;
            if (cb) cb((b && b.message) || ('HTTP ' + res.status));
            return;
          }
          self._lastPushedJson = payloadJson;
          self._lastSyncAt = Date.now();
          self._lastError = '';
          self.cfg.lastSyncAt = self._lastSyncAt;
          self.saveCfg();
          self._pushing = false;
          if (typeof updateStatusbar === 'function') updateStatusbar();
          if (cb) cb(null, { pushed: true });
        });
      }).catch(function (e) {
        self._pushing = false;
        if (cb) cb('网络请求失败：' + e.message);
      });
    };

    /* 推送前先读远端：内容相同 → 跳过（防重复提交）；
     * 远端实质更新 → 让位改为拉取（以远端为准）；否则覆盖写入 */
    this.fetchRemote(function (err, r) {
      if (err) { self._pushing = false; if (cb) cb(err); return; }
      if (r.ok && r.record) {
        if (r.record.hash && r.record.hash === payload.hash) {
          self._lastPushedJson = payloadJson;
          self._lastSyncAt = Date.now();
          self.cfg.lastSyncAt = self._lastSyncAt;
          self.saveCfg();
          self._pushing = false;
          if (cb) cb(null, { skipped: true });
          return;
        }
        if (r.record.updatedAt > payload.updatedAt + self.TOLERANCE_MS) {
          self._pushing = false;
          self.pull(function (err2, pr) { if (cb) cb(err2, pr || { remoteNewer: true }); });
          return;
        }
        doPut(r.sha);
      } else {
        doPut(null);   // 首次创建文件
      }
    });
  },

  /* 拉取并按时间戳决定是否采纳：cb(err, { adopted }) */
  pull: function (cb) {
    var self = this;
    if (this._pulling) { if (cb) cb(null, { busy: true }); return; }
    this._pulling = true;
    this.fetchRemote(function (err, r) {
      self._pulling = false;
      if (err) {
        self._lastError = err;
        self.cfg.lastError = err;
        self.saveCfg();
        if (cb) cb(err);
        return;
      }
      if (!r.ok || !r.record || !r.record.data) { if (cb) cb(null, { adopted: false }); return; }

      var localPayload = self.buildPayload();
      /* 内容相同 → 不动（防 ping-pong）；内容不同 → 时间戳决胜负 */
      if (r.record.hash && r.record.hash === localPayload.hash) {
        if (cb) cb(null, { adopted: false });
        return;
      }
      if (r.record.updatedAt <= localPayload.updatedAt + self.TOLERANCE_MS) {
        if (cb) cb(null, { adopted: false });
        return;
      }
      self.adoptRemote(r.record, function (err2) {
        if (cb) cb(err2, { adopted: !err2 });
      });
    });
  },

  /* 采纳远端数据：先本地备份，保留本地封面图/快照，再跑迁移校验 */
  adoptRemote: function (record, cb) {
    try {
      manualBackup();   // 防误覆盖：采纳前自动备份当前本地数据
      var merged = mergeData(clone(DEFAULT_INIT_DATA), record.data);
      merged.version = record.data.version || 4;
      runMigration(merged);
      merged.coverImage = state.data.coverImage;     // 封面图保留本机
      merged.snapshots = state.data.snapshots;       // 快照保留本机
      state.data = merged;
      var self = this;
      saveData();
      /* 把采纳的远端内容记为"已推送"，避免本地再推一遍形成 ping-pong */
      var p = { v: 5, clientId: this.loadCfg().clientId, updatedAt: record.updatedAt, data: clone(merged) };
      delete p.data.coverImage; delete p.data.snapshots;
      delete p.data.lastModified; delete p.data.migrationLog;
      this._lastPushedJson = JSON.stringify(p);
      this._lastSyncAt = Date.now();
      this._lastError = '';
      this.cfg.lastSyncAt = this._lastSyncAt;
      this.saveCfg();
      /* 刷新界面 */
      if (typeof refreshCurrentView === 'function') refreshCurrentView();
      if (typeof updateStatusbar === 'function') updateStatusbar();
      if (typeof mountCoverClockIntoView === 'function') mountCoverClockIntoView();
      if (cb) cb(null);
    } catch (e) {
      if (cb) cb('采纳远端数据失败：' + e.message);
    }
  },

  /* ---------------- 自动同步 ---------------- */

  /* 开始自动同步（页面初始化后调用一次）；initialCb 用于首次同步的反馈 */
  start: function (initialCb) {
    var self = this;
    if (!this.isEnabled()) return;
    /* 首次动作用 push：它会自动分派 ——
       云端为空 → 上传本地数据建立基线（修复"配好后等待首次同步"不动的问题）；
       云端更新 → 转为拉取采纳；内容相同 → 直接标记已同步 */
    this.push(initialCb || function () {});
    if (!this._pollTimer) {
      this._pollTimer = setInterval(function () { self.pull(function () {}); }, this.POLL_MS);
    }
    /* 本地数据变化 → 防抖推送 */
    if (!this._pushListener) {
      this._pushListener = function () {
        if (!self.isEnabled()) return;
        clearTimeout(self._pushTimer);
        self._pushTimer = setTimeout(function () { self.push(function () {}); }, self.PUSH_DEBOUNCE_MS);
      };
      document.addEventListener('planner-data-changed', this._pushListener);
    }
  },

  stop: function () {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    clearTimeout(this._pushTimer);
    this._pushTimer = null;
    if (this._pushListener) {
      document.removeEventListener('planner-data-changed', this._pushListener);
      this._pushListener = null;
    }
  },

  /* 状态栏文案 */
  statusText: function () {
    var c = this.loadCfg();
    if (!this.isEnabled()) return '';
    if (this._pushing || this._pulling) return '云同步中…';
    if (this._lastError) return '同步失败（点「设置→数据互通」查看）';
    if (c.lastSyncAt) {
      var d = new Date(c.lastSyncAt);
      return '已同步 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return '等待首次同步';
  }
};
