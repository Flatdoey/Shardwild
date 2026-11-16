const C='shardwild-v29';
const FILES=['./','./index.html','./v25_art.js','./dungeon_tiles.js','./world_tiles.js','./serpent_segments_v27.js','./megaking.js','./shield_art.js','./events2.js','./clearbar.js','./arrow.js','./lairs.js','./portals.js','./inventory_ui.js','./game.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request)));
});
