/* =====================================================================
   PALMA BLANCA NFC · Guarda la app en el cel para que funcione sin señal
   - La primera vez que se abre, guarda la app, las fotos y las fuentes.
   - Las páginas se piden primero a internet (para tener siempre lo más
     nuevo) y, si no hay señal en 3 s, se usa la copia guardada.
   - El muro, los premios y las estadísticas (/api/) siempre van a internet.
   La lista y la versión las escribe herramientas/actualizar-sw.mjs:
   córrelo antes de publicar si agregas o cambias archivos.
   ===================================================================== */
const VERSION = "202611271922"; // AUTO-VERSION
const ARCHIVOS = /* AUTO-LISTA */ ["CNAME","antro-data.js","antro.css","antro.js","blinddate-data.js","blinddate.css","blinddate.js","fonts/barlow-condensed-600.0a7db401.woff2","fonts/barlow-condensed-700.05ba48a1.woff2","fonts/barlow-condensed-800.db5ae356.woff2","fonts/montserrat-400.6e2658ad.woff2","fonts/montserrat-500.12a7d81d.woff2","fonts/montserrat-600.a4f64ab8.woff2","fonts/montserrat-700.ae5da15d.woff2","general.css","general.js","icons/apple-touch-icon.png","icons/icono-192.png","icons/icono-512.png","img/astertap.55d52eb5.png","img/botella.313afcd4.png","img/drink-cantarito.88ef8275.jpg","img/drink-cristalino-tonic.eb3912c8.jpg","img/drink-el-abuelo.172bc7c0.jpg","img/drink-el-zurdo.d1fbb010.jpg","img/drink-fresa-palma.b5dec67a.jpg","img/drink-la-abuela.51afafbc.jpg","img/drink-margarita.a1dedf34.jpg","img/drink-medianoche.01a59fa6.jpg","img/drink-mula-de-tequila.55dbacef.jpg","img/drink-palmita.8c19ebb6.jpg","img/drink-playa-blanca.ca502d82.jpg","img/drink-tequila-sunrise.59baaea3.jpg","img/drink-vampiro.b0d23bdf.jpg","img/hero.08e956b9.png","img/margarita.acd01f0a.jpg","img/palm.3b6a6a7b.png","img/paloma.ff056014.jpg","index.html","juegos-data.js","lapeda-data.js","manifest.webmanifest","privacidad-data.js"];
const CACHE = "pb-" + VERSION;

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* uno por uno: si un archivo falla, los demás sí se guardan */
    await Promise.all(["./", ...ARCHIVOS].map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("pb-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const conLimite = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("lento")), ms))]);

self.addEventListener("fetch", e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== "GET") return;
  const mismo = url.origin === self.location.origin;
  if (mismo && /\/api\//.test(url.pathname)) return; // muro, premios, estadísticas: siempre en vivo

  /* Página: internet primero; sin señal, la copia guardada */
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const raiz = new URL("./", self.registration.scope).href;
      try { const res = await conLimite(fetch(r), 3000); if (res.ok) c.put(raiz, res.clone()); return res; }
      catch (err) { return (await c.match(raiz)) || Response.error(); }
    })());
    return;
  }

  /* Fotos, fuentes e íconos (nombres con huella): de la copia guardada */
  if (mismo && /\/(img|fonts|icons)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res;
    })());
    return;
  }

  /* Scripts y estilos de la app: internet primero (para no mezclar versiones); sin señal, la copia */
  if (mismo) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try { const res = await conLimite(fetch(r), 3000); if (res.ok) c.put(r, res.clone()); return res; }
      catch (err) { return (await c.match(r, { ignoreSearch: true })) || Response.error(); }
    })());
    return;
  }

  /* Google Fonts: la copia al instante y se actualiza por detrás */
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), hit = await c.match(r);
      const red = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => null);
      return hit || (await red) || Response.error();
    })());
  }
});
