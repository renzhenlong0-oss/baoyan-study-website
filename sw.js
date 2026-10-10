/* ============================================================
 * sw.js —— PWA 服务工作者（离线缓存 + 即时更新）
 * 策略：静态资源 cache-first（版本化缓存名），HTML 导航 network-first
 *      （保证每次打开拿最新版本，断网时回退缓存）。
 * ============================================================ */

const CACHE_NAME = 'baoyan-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data.js',
  './migration.js',
  './app.js',
  './schedule.js',
  './today.js',
  './cover.js',
  './aichat.js',
  './data/profile.js',
  './data/goals.js',
  './data/policies.js',
  './data/courses.js',
  './data/resources.js',
  './data/curriculum.js',
  './data/problems.js',
  './data/roadmap.js',
  './data/competitions.js',
  './data/vocabDefaults.js',
  './data/defaultData.js',
  './core/goalEngine.js',
  './core/policyEngine.js',
  './core/gpaRiskEngine.js',
  './core/timeBudgetEngine.js',
  './core/gymScheduler.js',
  './core/constraintEngine.js',
  './core/strategyEngine.js',
  './core/planGenerator.js',
  './core/competitivenessEngine.js',
  './core/researchEngine.js',
  './core/competitionEngine.js',
  './core/resourceEngine.js',
  './core/programmingEngine.js',
  './core/reviewEngine.js',
  './core/vocabEngine.js',
  './core/snapshot.js',
  './core/syncEngine.js',
  './ui/weeklyPlan.js',
  './ui/dashboard.js',
  './ui/courses.js',
  './ui/programming.js',
  './ui/research.js',
  './ui/vocabCenter.js',
  './ui/english.js',
  './ui/competition.js',
  './ui/resources.js',
  './ui/review.js',
  './ui/settings.js'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* HTML 导航：网络优先，失败回退缓存的 index.html（离线可开） */
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 静态资源：缓存优先（版本升级时 CACHE_NAME +1 即可全部刷新） */
  ev.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
