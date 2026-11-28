// =====================================================================
//  10,000 tiros de cada ruleta usando la MISMA lógica de la app (en el navegador)
// ---------------------------------------------------------------------
//  - Ruleta del Modo Antro: se llama a sus funciones elegir() y rebanadas().
//    Para alcanzarlas, al servir antro.js se agrega una línea que las expone
//    (window.__pbRuleta). El archivo de la app NO se modifica.
//  - Drink del día, ruleta de juegos, El Dedo y las botellas: se usan los
//    botones/toques reales con el reloj del navegador adelantado (no se
//    espera la animación; la elección es exactamente la de la app).
//  Uso: BASE_URL=http://localhost:8899 PW_CHANNEL=chrome TIROS=10000 node ruletas.mjs
// =====================================================================
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
export const TIROS = Number(process.env.TIROS || 10000);
const BASE = process.env.BASE_URL || "http://localhost:8888";
const SALIDA = new URL("./salida/", import.meta.url); mkdirSync(SALIDA, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });
const { defaultBrowserType, ...cel } = devices["Pixel 7"];
const R = { tiros: TIROS, fecha: new Date().toISOString() };
const SOLO = process.env.SOLO || "";   // p. ej. SOLO=botella para correr solo una prueba
const toca = k => !SOLO || SOLO === k;
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

async function nuevaPagina(reloj = true) {
  const ctx = await browser.newContext({ ...cel, hasTouch: true, isMobile: true, reducedMotion: "reduce", serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("pb.edad", "1"); } catch (e) {} navigator.vibrate = () => true; });
  /* Solo para la prueba: expone las funciones internas de la ruleta del Antro */
  await ctx.route("**/antro.js", async route => {
    const res = await route.fetch(); let js = await res.text();
    js = js.replace('const AD = window.ANTRO_DATA || { casillas: [] };',
      'const AD = window.ANTRO_DATA || { casillas: [] };\nwindow.__pbRuleta = { elegir: sl => elegir(sl), rebanadas: () => rebanadas(), S, AD };');
    await route.fulfill({ response: res, body: js, headers: { ...res.headers(), "content-type": "application/javascript" } });
  });
  const page = await ctx.newPage();
  if (reloj) await page.clock.install();
  return { ctx, page };
}

/* ---------- 1. Ruleta del Modo Antro ---------- */
if (toca("antro")) {
  const { ctx, page } = await nuevaPagina(false);
  await page.goto(BASE + "/#antro"); await page.waitForFunction(() => window.__pbRuleta, null, { timeout: 15000 });
  R.antro = await page.evaluate(n => {
    const { elegir, rebanadas, S, AD } = window.__pbRuleta;
    const corre = (nombre, prep, cadaTiro) => {
      prep(); const seq = [];
      for (let i = 0; i < n; i++) { cadaTiro && cadaTiro(i); const s = elegir(rebanadas()); seq.push({ id: s.c.especial ? "regalo" : s.c.id, titulo: s.c.titulo, alcohol: !!s.c.alcohol, especial: !!s.c.especial }); if (nombre === "uso real" && s.c.alcohol) S.__ultimoT = i; }
      return seq;
    };
    const casillas = AD.casillas.map(c => ({ id: c.id, titulo: c.titulo, peso: c.peso ?? 1, alcohol: !!c.alcohol, sinAlcohol: c.sinAlcohol?.titulo || "" }));
    const salida = { casillas, probRegalo: AD.ronda.probabilidad, minutosEntreShots: AD.minutosEntreShots, modos: {} };
    // Normal: cada tiro independiente (como si fuera una persona distinta o pasaran más de 15 min)
    salida.modos["normal"] = corre("normal", () => { S.sobrio = false; S.ultimoShot = 0; });
    // Después de un shot: durante 15 min solo casillas sin alcohol
    salida.modos["15 min después de un shot"] = corre("frio", () => { S.sobrio = false; S.ultimoShot = Date.now(); });
    // «Hoy no tomo»
    salida.modos["Hoy no tomo"] = corre("sobrio", () => { S.sobrio = true; S.ultimoShot = 0; });
    // Uso real: una misma persona girando 1 vez por minuto; si sale alcohol, se activa la regla de 15 min
    S.__ultimoT = -999;
    salida.modos["uso real (1 giro por minuto)"] = corre("uso real", () => { S.sobrio = false; }, i => { S.ultimoShot = (i - S.__ultimoT) < 15 ? Date.now() - (i - S.__ultimoT) * 60000 : 0; });
    S.sobrio = false; S.ultimoShot = 0; delete S.__ultimoT;
    return salida;
  }, TIROS);
  log("Ruleta del Antro lista");
  await ctx.close();
}

/* ---------- Ayudante: repetir una acción con el reloj adelantado ---------- */
async function repetir(page, n, accion, ms, leer) {
  const out = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(accion);
    await page.clock.runFor(ms);
    out.push(await page.evaluate(leer));
    if (i % 2000 === 1999) log(`  ${i + 1}/${n}`);
  }
  return out;
}

/* ---------- 2. Tragamonedas «drink del día» ---------- */
if (toca("slot")) {
  const { ctx, page } = await nuevaPagina();
  await page.goto(BASE + "/#drinks"); await page.clock.runFor(1500);
  const N = TIROS;
  R.slot = await repetir(page, N,
    () => { window.__antes = document.querySelector("#machine").getAttribute("aria-label"); const b = document.querySelector("#spinBtn"); (b.hidden ? document.querySelector("#resAgain") : b).click(); },
    700,
    () => ({ antes: window.__antes, resultado: document.querySelector("#machine").getAttribute("aria-label"), listo: !document.querySelector("#result").hidden }));
  log("Drink del día listo");
  await ctx.close();
}

/* ---------- 3. Ruleta de «¿A ver qué te toca?» ---------- */
if (toca("juegos")) {
  const { ctx, page } = await nuevaPagina();
  await page.goto(BASE + "/#quien"); await page.clock.runFor(2000);
  R.juegos = await repetir(page, TIROS,
    () => { window.__antes = document.querySelector("#jgRes").hidden ? null : document.querySelector("#jgH").textContent.trim(); const o = document.querySelector("#jgOtro"); if (o && !document.querySelector("#jgRes").hidden) o.click(); else document.querySelector("#jgMachine").click(); },
    700,
    () => ({ antes: window.__antes, resultado: document.querySelector("#jgH").textContent.trim(), listo: !document.querySelector("#jgRes").hidden }));
  log("Ruleta de juegos lista");
  await ctx.close();
}

/* ---------- 4. Elegir con los dedos (2, 4 y 8 jugadores) ---------- */
if (toca("dedos")) {
  const { ctx, page } = await nuevaPagina();
  await page.goto(BASE + "/#quien"); await page.clock.runFor(2000);
  await page.evaluate(() => { document.querySelector("#jgMenuBtn").click(); [...document.querySelectorAll("#jgMenu [data-gi]")].find(b => /El Dedo/.test(b.textContent)).click(); });
  await page.clock.runFor(500);
  R.dedos = {};
  for (const n of [2, 4, 8]) {
    const out = [];
    for (let i = 0; i < TIROS; i++) {
      await page.evaluate(k => {
        const pad = document.querySelector("#qtPad"), r = pad.getBoundingClientRect();
        for (let j = 0; j < k; j++) { const x = r.left + r.width * (0.15 + 0.7 * ((j % 4) / 3)), y = r.top + r.height * (0.25 + 0.5 * Math.floor(j / 4)); pad.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 100 + j, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: j === 0 })); }
      }, n);
      await page.clock.runFor(1200);
      out.push(await page.evaluate(k => {
        const dots = [...document.querySelectorAll("#qtPad .qt-dot")], g = dots.findIndex(d => d.classList.contains("win"));
        const pad = document.querySelector("#qtPad"); for (let j = 0; j < k; j++) pad.dispatchEvent(new PointerEvent("pointerup", { pointerId: 100 + j, bubbles: true, pointerType: "touch" }));
        return { ganador: g, puntos: dots.length };
      }, n));
      await page.clock.runFor(1500);   // la app espera ~0.9 s después de soltar para la siguiente ronda
      if (i % 2000 === 1999) log(`  dedos ${n}: ${i + 1}/${TIROS}`);
    }
    R.dedos[n] = out;
  }
  log("El Dedo listo");
  await ctx.close();
}

/* ---------- 5. Gira la Botella de «¿A ver qué te toca?» (ángulo donde apunta) ---------- */
if (toca("botella")) {
  const { ctx, page } = await nuevaPagina();
  await page.goto(BASE + "/#quien"); await page.clock.runFor(2000);
  await page.evaluate(() => { document.querySelector("#jgMenuBtn").click(); [...document.querySelectorAll("#jgMenu [data-gi]")].find(b => /Gira la Botella/.test(b.textContent)).click(); });
  await page.clock.runFor(500);
  const out = [];
  for (let i = 0; i < TIROS; i++) {
    await page.evaluate(() => document.querySelector("#bgo").click()); await page.clock.runFor(900);
    await page.evaluate(() => document.querySelector("#bgo").click()); await page.clock.runFor(900);
    await page.waitForFunction(() => document.querySelector('[data-b="ok"]'), null, { timeout: 3000 }).catch(() => {});
    out.push(await page.evaluate(() => { const a = el => { const l = parseFloat(el.style.left) - 50, t = 50 - parseFloat(el.style.top); return ((Math.atan2(l, t) * 180 / Math.PI) + 360) % 360; }; const r = { pone: a(document.querySelector("#mP")), recibe: a(document.querySelector("#mR")) }; document.querySelector('[data-b="ok"]')?.click(); return r; }));
    await page.clock.runFor(100);
    if (i % 2000 === 1999) log(`  botella: ${i + 1}/${TIROS}`);
  }
  R.botella = out;
  log("Botella lista");
  await ctx.close();
}

writeFileSync(new URL(SOLO ? `ruletas-${SOLO}.json` : "ruletas.json", SALIDA), JSON.stringify(R));
log("Listo: salida/ruletas.json");
await browser.close();
