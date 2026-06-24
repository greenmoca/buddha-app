/* 지금, 붓다라면 — 서비스 워커 (오프라인 캐시)
   · 페이지 이동(navigation): network-first → 새 버전을 빨리 반영, 오프라인이면 캐시
   · 정적 자산(폰트·아이콘 등): cache-first → 빠르고 데이터 절약
   · 업데이트: 자동 적용하지 않고, 페이지가 보낸 SKIP_WAITING(사용자 동의) 후 활성화
   ★ 파일 수정 후 재배포할 때마다 아래 캐시 숫자를 +1 하세요 (buddha-v12 → v13) */
const CACHE = 'buddha-v12';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  /* self.skipWaiting()는 여기서 호출하지 않음 — 사용자가 '새로고침'을 누를 때만 (message 리스너) */
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 페이지에서 '새로고침'을 누르면 대기 중인 새 워커를 즉시 활성화 */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('api.anthropic.com')) return;  /* API 호출은 캐시하지 않음 */

  /* 페이지 이동: 네트워크 우선, 실패 시 캐시(없으면 index.html) */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* 정적 자산: 캐시 우선, 없으면 네트워크(받으며 캐시) */
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
