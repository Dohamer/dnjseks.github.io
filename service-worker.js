const C='fabric-inventory-v12-1';
const A=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)));
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;

  // HTML/navigation and app assets prefer the network so a GitHub Pages update
  // appears immediately. Cached copies remain as the offline fallback.
  if(e.request.mode==='navigate'||/\.(?:html|js|css|webmanifest)$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(e.request,{cache:'no-store'});
        if(fresh&&fresh.ok){
          const cache=await caches.open(C);
          cache.put(e.request,fresh.clone());
        }
        return fresh;
      }catch{
        return (await caches.match(e.request,{ignoreSearch:true}))||
               (await caches.match('./index.html'))||
               Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
