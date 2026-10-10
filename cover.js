/* ============================================================
 * cover.js —— 全屏封面层：每次打开页面显示，点击"后缩"进入主页；
 *            多功能时钟（时间/日期/计时）：封面上放大展示，
 *            进入功能页后缩入顶栏左上角，形成封面与功能页联动；
 *            封面图片上传压缩（设置面板调用 processCoverImage）
 * ============================================================ */

let coverClockTimer = null;   // 时钟+计时共用 interval（时钟元素常驻，计时跨页面持续）
let swRunning = false;        // 计时器运行态
let swAccum = 0;              // 已累计毫秒（暂停时固化）
let swStartTs = 0;            // 本次运行起点时间戳

function fmtClock() {
  var d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(function (n) { return String(n).padStart(2, '0'); })
    .join(':');
}

/* 封面显示状态（导航条在封面页也常显：点击导航可直接进入对应页面） */
let coverActive = false;

/* 立即收起封面（复用封面的点击进入动画与回调）；
   点击顶部导航/打开设置时调用，避免用户被封面挡住 */
function dismissCover() {
  if (!coverActive) return;
  coverActive = false;
  var root = document.getElementById('cover-root');
  var cover = root && root.querySelector('.cover');
  if (cover) cover.click();
}

/* 从应用内返回封面（未来可作为多个网页的入口枢纽）：
   关闭打开的面板 → 显示封面 → 点击后回到原所在页面 */
function returnToCover() {
  if (typeof settingsModal !== 'undefined' && settingsModal) {
    settingsModal.close();
    settingsModal = null;
  }
  if (typeof subjectBlockModal !== 'undefined' && subjectBlockModal) {
    subjectBlockModal.close();
  }
  showCover(function () { switchTab(state.activeTab); });
}

/* 显示封面；点击后播放后缩动画并回调 onDone（进入主页） */
function showCover(onDone) {
  var root = document.getElementById('cover-root');
  if (!root) { onDone(); return; }

  coverActive = true;
  root.innerHTML = '';
  var cover = document.createElement('div');
  cover.className = 'cover';

  /* 用户自定义封面图（设置中上传，base64） */
  if (state.data.coverImage) {
    cover.classList.add('with-image');
    cover.style.backgroundImage = 'url("' + state.data.coverImage + '")';
  }

  var brand = document.createElement('div');
  brand.className = 'cover-brand';
  brand.textContent = '保研学习计划';

  var sub = document.createElement('div');
  sub.className = 'cover-sub';
  var p = state.data.userProfile;
  sub.textContent = (p.name || '') + ' · ' + (p.targetSchool || '') + '保研';

  var hint = document.createElement('div');
  hint.className = 'cover-hint';
  hint.textContent = '点 击 进 入';

  cover.appendChild(brand);
  cover.appendChild(sub);
  cover.appendChild(ensureCoverClock());   // 已存在于顶栏时移回封面
  cover.appendChild(hint);

  var done = false;
  cover.addEventListener('click', function () {
    if (done) return;
    done = true;
    coverActive = false;
    cover.classList.add('dismiss');
    setTimeout(function () {
      /* 时钟先移出封面（避免随封面销毁），进入功能页后由 mountCoverClockIntoView 挂到顶栏 */
      var clock = document.getElementById('cover-clock');
      if (clock && clock.parentNode === cover) document.body.appendChild(clock);
      root.innerHTML = '';
      onDone();
    }, 600);
  });

  root.appendChild(cover);
}

/* 多功能时钟：时间 / 日期 / 计时（秒表）。
   返回时钟元素；首次创建，再次进封面时从顶栏移回。 */
function ensureCoverClock() {
  var clock = document.getElementById('cover-clock');
  if (!clock) {
    clock = document.createElement('div');
    clock.id = 'cover-clock';
    clock.className = 'cover-clock';

    clock.appendChild(el('div', 'cover-clock-time', fmtClock()));
    clock.appendChild(el('div', 'cover-clock-date', fmtDateCN(todayStr())));

    var sw = el('div', 'cover-clock-sw');
    sw.appendChild(el('span', 'cc-sw-label', '计时'));
    sw.appendChild(el('span', 'cc-sw-val', '00:00'));
    var bStart = el('button', 'cc-sw-btn', '开始');
    bStart.addEventListener('click', function (ev) {
      ev.stopPropagation();   // 不触发封面点击进入
      if (swRunning) {
        swRunning = false;
        swAccum += Date.now() - swStartTs;
        bStart.textContent = '继续';
      } else {
        swRunning = true;
        swStartTs = Date.now();
        bStart.textContent = '暂停';
      }
    });
    var bReset = el('button', 'cc-sw-btn', '重置');
    bReset.addEventListener('click', function (ev) {
      ev.stopPropagation();
      swRunning = false;
      swAccum = 0;
      bStart.textContent = '开始';
    });
    sw.appendChild(bStart);
    sw.appendChild(bReset);
    clock.appendChild(sw);

    coverClockTimer = setInterval(updateCoverClock, 250);
  } else {
    clock.classList.remove('in-topbar');
  }
  updateCoverClock();
  return clock;
}

/* 刷新时钟各处显示（元素在封面或顶栏均可） */
function updateCoverClock() {
  var clock = document.getElementById('cover-clock');
  if (!clock) return;

  var timeEl = clock.querySelector('.cover-clock-time');
  if (timeEl) timeEl.textContent = fmtClock();

  var dateEl = clock.querySelector('.cover-clock-date');
  if (dateEl) dateEl.textContent = fmtDateCN(todayStr());

  var elapsed = swAccum + (swRunning ? Date.now() - swStartTs : 0);
  var s = Math.floor(elapsed / 1000);
  var mm = String(Math.floor(s / 60)).padStart(2, '0');
  var ss = String(s % 60).padStart(2, '0');
  var valEl = clock.querySelector('.cc-sw-val');
  if (valEl) valEl.textContent = mm + ':' + ss;
}

/* 把时钟挂到顶栏左上角（进入功能页后调用；顶栏在所有页面可见） */
function mountCoverClockIntoView() {
  var clock = document.getElementById('cover-clock');
  if (!clock) return;
  var slot = document.getElementById('topbar-clock-slot');
  if (!slot) return;
  if (clock.parentNode !== slot) {
    slot.appendChild(clock);
    clock.classList.add('in-topbar');
  }
  updateCoverClock();
}

/* 压缩封面图（canvas 缩至最长边 1600px，JPEG 质量 0.82；PNG 保持原格式）。
   压缩失败时返回原图，保证功能不中断。 */
function processCoverImage(dataUrl, cb) {
  var img = new Image();
  img.onload = function () {
    try {
      var maxSide = 1600;
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1) { cb(dataUrl); return; }
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      var isPng = /^data:image\/png/i.test(dataUrl);
      cb(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.82));
    } catch (e) {
      cb(dataUrl);
    }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
}
