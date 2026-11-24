// Service worker do Lua de Cinzas: guarda o jogo no aparelho para funcionar sem internet.
// Ao publicar uma versão nova do jogo, troque o número da VERSAO.
const VERSAO = 'ldc-v4';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];
const EXTERNOS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ARQUIVOS);
    // externos: se falharem (sem internet na instalação), o jogo funciona mesmo assim
    await Promise.all(EXTERNOS.map(u => fetch(u, {mode: 'no-cors'}).then(r => cache.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSAO) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // o servidor de salas do PeerJS precisa de internet de verdade: não mexe
  if (url.hostname.endsWith('peerjs.com')) return;

  // a página do jogo: tenta a versão mais nova na internet; sem internet, usa a guardada
  if (req.mode === 'navigate'){
    e.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(req, {signal: ctrl.signal});
        clearTimeout(t);
        if (r.ok) cache.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // ícones, biblioteca e fontes: usa o guardado e atualiza em segundo plano
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(req, {ignoreSearch: url.origin === location.origin});
    const daRede = fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
      return r;
    }).catch(() => null);
    return guardado || (await daRede) || Response.error();
  })());
});
