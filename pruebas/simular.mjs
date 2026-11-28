// =====================================================================
//  PALMA BLANCA NFC · Simulaciones automáticas de personas usando la app
// ---------------------------------------------------------------------
//  Cambia este número para correr más (por ejemplo 1000):
export const N_SIMULACIONES = Number(process.env.N_SIMULACIONES || 1000);
// ---------------------------------------------------------------------
//  Cómo correrlo (desde la carpeta palma-netlify):
//    1) ./dev-local.sh                      (servidor de prueba en :8888)
//    2) cd pruebas && npm install && npx playwright install chromium
//    3) npm run simular   → salida/resultados.json
//    4) npm run reporte   → salida/resultados.csv y salida/reporte.html
//  Variables opcionales: BASE_URL, CONCURRENCIA, SEMILLA, CODIGOS_CSV,
//  ESCALA_TIEMPO (1 = tiempos humanos reales; 0.3 = más rápido).
// =====================================================================
import { chromium, devices } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://localhost:8888";
const CONCURRENCIA = Number(process.env.CONCURRENCIA || 5);
const SEMILLA = Number(process.env.SEMILLA || 20261127);
const ESCALA = Number(process.env.ESCALA_TIEMPO || 1);
const TIMEOUT_ACCION = 10000;
const CSV_CODIGOS = process.env.CODIGOS_CSV || join(AQUI, "../../codigos-botellas-premiadas.csv");
const SALIDA = join(AQUI, "salida");

/* ---------- Azar con semilla (para poder repetir exactamente la corrida) ---------- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rngGlobal = mulberry32(SEMILLA);
const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const uno = (r, arr) => arr[Math.floor(r() * arr.length)];
const prob = (r, p) => r() < p;
const barajar = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dormir = ms => new Promise(ok => setTimeout(ok, Math.max(0, ms)));

/* ---------- Celulares ---------- */
const sinNavegador = d => { const { defaultBrowserType, ...resto } = d; return { ...resto, hasTouch: true, isMobile: true }; };
const CELULARES = {
  "iPhone 13": sinNavegador(devices["iPhone 13"]),
  "iPhone SE": sinNavegador(devices["iPhone SE"]),
  "Pixel 7": sinNavegador(devices["Pixel 7"]),
  "Galaxy S8": sinNavegador(devices["Galaxy S8"]),
  "Android chico 360": { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 11; SM-A105M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" }
};

/* ---------- Perfiles (porcentajes del total) ---------- */
const PERFILES = [["Drinks", 0.25], ["Peda en casa", 0.20], ["A ver qué te toca", 0.20], ["Antro", 0.15], ["Rápido", 0.10], ["Botella premiada", 0.10]];
const NOMBRES = ["Ana", "Beto", "Caro", "Dani", "Eli", "Fer", "Gaby", "Hugo", "Iván", "Jime", "Karla", "Luis", "Majo", "Nico", "Oli", "Pau", "Quique", "Rosa", "Sofi", "Toño"];

function plan(n) {
  const perfiles = [];
  PERFILES.forEach(([p, f], i) => { const k = i === PERFILES.length - 1 ? n - perfiles.length : Math.round(n * f); for (let j = 0; j < k; j++) perfiles.push(p); });
  const cels = Object.keys(CELULARES);
  return barajar(rngGlobal, perfiles).map((perfil, i) => ({ id: i + 1, perfil, celular: cels[i % cels.length], regresa: prob(rngGlobal, 0.2), semilla: Math.floor(rngGlobal() * 1e9) }));
}

/* ---------- Códigos de premio ---------- */
function codigos() {
  let validos = [];
  try { validos = readFileSync(CSV_CODIGOS, "utf8").match(/PB-(BL|CV|DS)-\d{4}-[A-Z0-9]{4}/g) || []; } catch (e) {}
  return validos;
}
function codigoInvalido(r, validos) {
  const tipo = uno(r, ["firma", "serie", "mal formado", "texto"]);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", rnd4 = () => Array.from({ length: 4 }, () => chars[Math.floor(r() * chars.length)]).join("");
  if (tipo === "firma" && validos.length) { const v = uno(r, validos); let f; do { f = rnd4(); } while (v.endsWith(f)); return { codigo: v.slice(0, -4) + f, tipo }; }
  if (tipo === "serie" || tipo === "firma") return { codigo: `PB-${uno(r, ["BL", "CV", "DS"])}-${String(entre(r, 900, 9999)).padStart(4, "0")}-${rnd4()}`, tipo: "serie" };
  if (tipo === "mal formado") return { codigo: `PB-${uno(r, ["XX", "BL"])}-${entre(r, 1, 99)}`, tipo };
  return { codigo: uno(r, ["hola", "PREMIO", "PB-BL-0001", "<script>x</script>"]), tipo };
}

/* =====================================================================
   UNA SESIÓN
   ===================================================================== */
async function sesion(browser, s, estadoPrevio, ctxDatos) {
  const r = mulberry32(s.semilla);
  const R = {
    id: s.id, perfil: s.perfil, celular: s.celular, regresa: !!estadoPrevio,
    carga_dcl_ms: null, carga_total_ms: null, duracion_ms: 0, acciones: 0,
    recorrido: [], abandono: "", errores: [], ruido_consola: 0, desbordes: [], tapados: [], atorados: [],
    slot: [], ruleta: [], juegos_ruleta: [], juegos: [], quiz: null, peda: null, cita: null, dedo: [], premio: null, rarezas: [], compartio: false,
    embudo: { quiz_inicio: false, quiz_fin: false, peda_inicio: false, peda_resumen: false, cita_inicio: false, cita_resultados: false, antro_inicio: false, antro_edad: false, antro_ruleta: false }
  };
  const ctx = await browser.newContext({ ...CELULARES[s.celular], locale: "es-MX", timezoneId: "America/Mexico_City", permissions: [], storageState: estadoPrevio || undefined });
  /* El menú de compartir del celular se simula: cuenta cuántas veces se abrió */
  await ctx.addInitScript(() => { window.__compartidos = 0; navigator.share = async () => { window.__compartidos++; }; navigator.canShare = () => true; });
  const page = await ctx.newPage();
  let accion = "cargar";
  page.on("pageerror", e => R.errores.push({ tipo: "pageerror", seccion: R.abandono || "inicio", accion, msg: String(e.message || e).slice(0, 300) }));
  page.on("console", m => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/navigator\.vibrate|Failed to load resource|ERR_CONNECTION_REFUSED|getUserMedia|NotAllowedError|NotFoundError|Requested device not found/i.test(t)) { R.ruido_consola++; return; }
    R.errores.push({ tipo: "console.error", seccion: R.abandono || "inicio", accion, msg: t.slice(0, 300) });
  });
  const t0 = Date.now();
  const espera = async (a = 300, b = 3000) => dormir((a + r() * (b - a)) * ESCALA);

  /* Revisa que nada se salga de la pantalla */
  async function revisar() {
    try {
      const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
      if (d.sw > d.w + 1) R.desbordes.push({ accion, ancho: d.sw, pantalla: d.w });
    } catch (e) {}
  }
  /* Ejecuta una acción con límite de 10 s */
  async function hacer(nombre, fn) {
    accion = nombre; R.acciones++;
    let to;
    try {
      await Promise.race([fn(), new Promise((_, no) => { to = setTimeout(() => no(new Error("timeout")), TIMEOUT_ACCION); })]);
      clearTimeout(to); await revisar(); return true;
    } catch (e) {
      clearTimeout(to);
      R.atorados.push({ seccion: R.abandono || "inicio", accion: nombre, motivo: String(e.message || e).split("\n")[0].slice(0, 160) });
      return false;
    }
  }
  /* Tocar con el dedo, revisando antes si algo lo tapa */
  async function tocar(sel, opc = {}) {
    const loc = typeof sel === "string" ? page.locator(sel).first() : sel;
    await loc.waitFor({ state: "visible", timeout: TIMEOUT_ACCION });
    await loc.evaluate(el => el.scrollIntoView({ block: "center", inline: "nearest" })); await dormir(120);
    const tapado = await loc.evaluate(el => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return null;
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "fuera de la pantalla";
      const h = document.elementFromPoint(x, y);
      if (!h || h === el || el.contains(h) || h.contains(el)) return null;
      return (h.id ? "#" + h.id : h.tagName.toLowerCase()) + (h.className && typeof h.className === "string" ? "." + h.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    }).catch(() => null);
    if (tapado) R.tapados.push({ accion, elemento: typeof sel === "string" ? sel : "elemento", lo_tapa: tapado });
    await loc.tap({ timeout: TIMEOUT_ACCION, force: !!tapado });
    if (opc.doble) { await dormir(60); await loc.tap({ timeout: 2000, force: true }).catch(() => {}); }
  }
  const visible = (sel, ms = TIMEOUT_ACCION) => page.locator(sel).first().waitFor({ state: "visible", timeout: ms });
  const seccion = n => { R.recorrido.push(n); R.abandono = n; };
  const aInicio = async () => { await tocar(".pb-nav-casa"); await page.waitForFunction(() => !location.hash, null, { timeout: 5000 }); seccion("inicio"); };
  const irA = async (n) => { await tocar(`#v-home .door[data-go="${n}"]`); await page.waitForFunction(h => location.hash === "#" + h, n, { timeout: 5000 }); seccion(n); };

  try {
    /* ---------- Abrir la app ---------- */
    const url = s.perfil === "Botella premiada" ? null : BASE + "/";
    if (url) {
      await hacer("cargar", async () => { await page.goto(url, { waitUntil: "load", timeout: TIMEOUT_ACCION }); });
      const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd } : null; }).catch(() => null);
      if (nav) { R.carga_dcl_ms = Math.round(nav.dcl); R.carga_total_ms = Math.round(nav.load); }
      seccion("inicio");
      /* Aviso de +18 (solo la primera vez) */
      if (await page.locator(".pb-edad-ov .pb-ok").isVisible().catch(() => false)) await hacer("aviso +18", async () => { await espera(); await tocar(".pb-edad-ov .pb-ok"); });
    }

    /* ======================= PERFILES ======================= */
    if (s.perfil === "Drinks") {
      await espera(); await hacer("entrar a Drinks", () => irA("drinks"));
      const giros = entre(r, 1, 3);
      for (let i = 0; i < giros; i++) {
        await espera();
        await hacer("girar drink del día", async () => {
          const antes = await page.getAttribute("#machine", "aria-label");
          const doble = prob(r, 0.1); if (doble) R.rarezas.push("doble toque en Girar");
          const t = Date.now(); await tocar((await page.locator("#spinBtn").isVisible()) ? "#spinBtn" : "#resAgain", { doble });
          await page.waitForFunction(() => !document.querySelector("#result").hidden, null, { timeout: TIMEOUT_ACCION });
          R.slot.push({ antes, resultado: await page.getAttribute("#machine", "aria-label"), ms: Date.now() - t });
        });
        if (i < giros - 1 && await page.locator("#resAgain").isVisible().catch(() => false)) { /* el siguiente giro usa «Volver a girar» */ }
      }
      const recetas = entre(r, 1, 4);
      for (let i = 0; i < recetas; i++) {
        await espera();
        const ok = await hacer("abrir receta", async () => {
          const n = await page.locator("[data-dn]").count(); const k = Math.floor(r() * n);
          await tocar(page.locator("[data-dn]").nth(k)); await page.waitForSelector(".sheet.on", { timeout: 5000 });
        });
        if (!ok) continue;
        if (prob(r, 0.7)) { await espera(); await hacer("cambiar porciones", async () => { const n = uno(r, [1, 2, 4, 6, 8, 12, 50]); await page.fill("#sNum", String(n)); await page.dispatchEvent("#sNum", "input"); }); }
        if (prob(r, 0.3)) { await espera(); await hacer("sin alcohol", async () => { await tocar(page.locator(".s-row .sw").first()); }); }
        if (prob(r, 0.4)) {
          await espera();
          await hacer("compartir historia", async () => { await tocar("#sShare"); await page.waitForFunction(() => window.__compartidos > 0 || document.querySelector("body > .story"), null, { timeout: 9000 }); R.compartio = true; });
          if (await page.locator("body > .story [data-x]").isVisible().catch(() => false)) await hacer("cerrar imagen", () => tocar("body > .story [data-x]"));
        }
        if (prob(r, 0.1)) { R.rarezas.push("regresó a Inicio a la mitad"); await hacer("regresar a inicio a la mitad", aInicio); break; }
        await hacer("cerrar receta", async () => { await tocar("#sClose"); await page.waitForSelector(".sheet.on", { state: "detached", timeout: 3000 }).catch(() => {}); await dormir(400); });
      }
      if (prob(r, 0.5) && R.abandono === "drinks") {
        R.embudo.quiz_inicio = true; await espera();
        await hacer("abrir quiz", async () => { await tocar("#quizOpen"); await visible(".qz .qz-op"); });
        const resp = [];
        for (let q = 0; q < 4; q++) {
          await espera(500, 2500);
          const ok = await hacer("responder quiz", async () => { const k = Math.floor(r() * 4); resp.push(k); await tocar(page.locator(".qz [data-qo]").nth(k)); });
          if (!ok) break;
          if (q === 1 && prob(r, 0.08)) { R.rarezas.push("cerró el quiz a la mitad"); await hacer("cerrar quiz a la mitad", () => tocar(".qz [data-qx]")); break; }
        }
        if (resp.length === 4) {
          await hacer("resultado del quiz", async () => { await visible(".qz-res h3"); R.quiz = { respuestas: resp, resultado: (await page.textContent(".qz-res h3")).trim() }; R.embudo.quiz_fin = true; });
          await hacer("cerrar quiz", () => tocar(".qz [data-qx]"));
        }
      }
    }

    else if (s.perfil === "Peda en casa" && !prob(r, 0.35)) {
      await espera(); await hacer("entrar a La Peda", () => irA("peda"));
      R.embudo.peda_inicio = true;
      await espera(); await hacer("empezar", () => tocar("#intro .btn"));
      const n = entre(r, 2, 8), nombres = barajar(r, NOMBRES).slice(0, n);
      /* Quien regresa puede traer jugadores guardados: se borran para empezar parejo */
      await page.evaluate(() => { try { players.length = 0; guardarJugadores(); renderChips && renderChips(); } catch (e) {} }).catch(() => {});
      for (const nm of nombres) {
        await espera(300, 1200);
        if (prob(r, 0.08)) { R.rarezas.push("agregó nombre vacío"); await hacer("agregar nombre vacío", async () => { await page.fill("#nameInput", "   "); await tocar("#players .addbar button"); }); }
        await hacer("agregar jugador", async () => { await page.fill("#nameInput", nm); await tocar("#players .addbar button"); });
      }
      const enLista = await page.evaluate(() => players.slice()).catch(() => []);
      await espera(); await hacer("elegir modo", () => tocar("#toModes"));
      const modo = uno(r, ["pre", "peda", "after", "mixta"]);
      await espera(); await hacer("modo " + modo, async () => { await tocar(`#modes .m-${modo}`); await page.waitForFunction(() => document.querySelector("#lp .screen.active")?.id === "game", null, { timeout: 5000 }); });
      const cartas = entre(r, 10, 40), porJugador = Object.fromEntries(enLista.map(p => [p, 0]));
      let jugadas = 0, abandono = false;
      const leer = async () => { const j = await page.evaluate(() => (historial[historial.length - 1] || {}).j?.name).catch(() => null); if (j != null) porJugador[j] = (porJugador[j] || 0) + 1; jugadas++; };
      await leer();
      for (let k = 1; k < cartas; k++) {
        await espera(400, 2500);
        if (k === Math.floor(cartas / 2) && prob(r, 0.06)) { R.rarezas.push("salió a Inicio a media partida"); await hacer("regresar a inicio a media partida", aInicio); abandono = true; break; }
        const ok = await hacer("siguiente carta", async () => { const antes = await page.evaluate(() => count); await tocar("#game .lp-sig", { doble: prob(r, 0.04) }); await page.waitForFunction(a => count > a, antes, { timeout: 3000 }); });
        if (!ok) break;
        await leer();
      }
      const total = await page.evaluate(() => count).catch(() => jugadas);
      if (!abandono) {
        await espera(); await hacer("terminar partida (✕)", async () => { await tocar("#game .x"); await page.waitForFunction(() => document.querySelector("#lp .screen.active")?.id === "resumen", null, { timeout: 5000 }); });
        R.embudo.peda_resumen = (await page.evaluate(() => document.querySelector("#lp .screen.active")?.id).catch(() => "")) === "resumen";
      }
      R.peda = { modo, jugadores: enLista.length, cartas: total, porJugador, sinCarta: Object.values(porJugador).filter(v => v === 0).length };
      /* La mitad también juega «¿A ver qué te toca?» */
      if (false && !abandono) {
        await espera(); await hacer("ir a inicio", aInicio);
        await espera(); await hacer("entrar a ¿A ver qué te toca?", () => irA("quien"));
        const giros = entre(r, 1, 3);
        for (let i = 0; i < giros; i++) {
          await espera();
          await hacer("girar ruleta de juegos", async () => {
            const t = Date.now();
            if (i > 0 || !(await page.locator("#jgRes").isVisible().catch(() => false))) { if (await page.locator("#jgOtro").isVisible().catch(() => false)) await tocar("#jgOtro"); else await tocar("#jgMachine"); }
            await page.waitForFunction(() => { const e = document.querySelector("#jgRes"); return e && !e.hidden; }, null, { timeout: TIMEOUT_ACCION });
            await dormir(300);
            const res = (await page.textContent("#jgH")).trim(); R.juegos_ruleta.push({ antes: R.juegos_ruleta.length ? R.juegos_ruleta[R.juegos_ruleta.length - 1].resultado : null, resultado: res, ms: Date.now() - t });
          });
        }
        /* El Dedo con varios dedos */
        await espera();
        const okDedo = await hacer("abrir El Dedo", async () => { await tocar("#jgMenuBtn"); await tocar(page.locator('#jgMenu [data-gi]', { hasText: "El Dedo" })); await visible("#qtPad"); });
        if (okDedo) {
          const rondas = entre(r, 1, 3), cdp = await ctx.newCDPSession(page);
          for (let q = 0; q < rondas; q++) {
            await espera();
            const dedos = entre(r, 2, 6), antes = prob(r, 0.12);
            await hacer("poner " + dedos + " dedos", async () => {
              const pad = await page.locator("#qtPad").boundingBox();
              const pts = Array.from({ length: dedos }, (_, i) => ({ x: pad.x + pad.width * (0.15 + 0.7 * ((i % 3) / 2)), y: pad.y + pad.height * (0.2 + 0.6 * (Math.floor(i / 3) / 1)), id: i + 1 }));
              const puestos = [];
              for (const p of pts) { puestos.push(p); await cdp.send("Input.dispatchTouchEvent", { type: puestos.length === 1 ? "touchStart" : "touchStart", touchPoints: puestos.map(x => ({ x: x.x, y: x.y, id: x.id })) }); await dormir(120); }
              if (antes) { await dormir(900); R.rarezas.push("quitó el dedo antes de tiempo"); }
              else await page.waitForFunction(() => document.querySelector("#qtPad .qt-dot.win"), null, { timeout: 6000 });
              const gana = await page.evaluate(() => { const d = [...document.querySelectorAll("#qtPad .qt-dot")]; return d.findIndex(x => x.classList.contains("win")); });
              R.dedo.push({ dedos, ganador: gana, quito_antes: antes, eligio: gana >= 0 });
              await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
              await dormir(400);
            });
          }
        }
      }
    }

    else if (s.perfil === "Antro") {
      await espera(); await hacer("entrar a Modo Antro", () => irA("antro"));
      R.embudo.antro_inicio = true;
      await dormir(800);
      if (await page.locator("#tm #si").isVisible().catch(() => false)) { await espera(); await hacer("tengo 18", () => tocar("#tm #si")); }
      R.embudo.antro_edad = true;
      await dormir(800);
      const sinFoto = page.locator("button", { hasText: "Entrar sin foto" });
      if (await sinFoto.first().isVisible().catch(() => false)) { await espera(); await hacer("entrar sin foto", () => tocar(sinFoto)); }
      const okRuleta = await hacer("llegar a la ruleta", () => visible("#tm #girar", 8000));
      R.embudo.antro_ruleta = okRuleta;
      const AD = await page.evaluate(() => window.ANTRO_DATA).catch(() => null);
      const titulos = {};
      if (AD) { for (const c of AD.casillas) { titulos[c.titulo] = c.id; if (c.sinAlcohol?.titulo) titulos[c.sinAlcohol.titulo] = c.id; } titulos[AD.ronda.titulo] = "regalo"; if (AD.ronda.sinAlcohol?.titulo) titulos[AD.ronda.sinAlcohol.titulo] = "regalo"; }
      const muchas = prob(r, 0.1); if (muchas) R.rarezas.push("giró muchas veces seguidas");
      const giros = okRuleta ? (muchas ? entre(r, 12, 25) : entre(r, 1, 6)) : 0;
      for (let i = 0; i < giros; i++) {
        await espera();
        const estado = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tomala_pb_v1") || "{}"); } catch (e) { return {}; } });
        const frio = !estado.sobrio && estado.ultimoShot && (Date.now() - estado.ultimoShot) < (AD?.minutosEntreShots ?? 15) * 60000;
        const ok = await hacer("girar ruleta", async () => {
          const t = Date.now(); await tocar("#tm #girar", { doble: prob(r, 0.08) });
          await page.waitForSelector("#tm .ov .big", { timeout: TIMEOUT_ACCION });
          const big = (await page.textContent("#tm .ov .big")).trim();
          R.ruleta.push({ id: titulos[big] || big, frio: !!frio, sobrio: !!estado.sobrio, ms: Date.now() - t });
        });
        if (!ok) break;
        await hacer("responder casilla", async () => {
          const acc = page.locator("#tm .ov #acc"); if (await acc.count()) await acc.waitFor({ state: "visible", timeout: 9000 });
          const esFoto = await page.locator('#tm .ov [data-r="ok"]', { hasText: "Tomar foto" }).count();
          const b = !esFoto && prob(r, 0.7) ? '[data-r="ok"]' : '[data-r="paso"]';
          if (await page.locator("#tm .ov " + b).count()) await tocar("#tm .ov " + b);
          else await tocar(page.locator("#tm .ov button").first());
          await dormir(500);
          if (!(await page.locator("#tm #girar").isVisible().catch(() => false))) await page.evaluate(() => { const b = document.querySelector('#tm-tabs [data-go="ruleta"]'); if (b) b.click(); });
        });
      }
      /* Retos */
      const cartas = entre(r, 3, 10);
      if (await hacer("abrir retos", async () => { await tocar('#tm-tabs [data-go="retos"]'); await visible("#tm #otro"); })) {
        seccion("antro/retos");
        for (let i = 0; i < cartas; i++) { await espera(); if (!await hacer("otro reto", () => tocar(prob(r, 0.3) ? "#tm #hecho" : "#tm #otro"))) break; await dormir(300); if (!(await page.locator("#tm #otro").isVisible().catch(() => false))) await page.evaluate(() => document.querySelector('#tm-tabs [data-go="retos"]')?.click()); }
      }
      /* Mesa vs mesa y botella (desde el Menú) */
      const mvm = entre(r, 1, 3);
      for (let i = 0; i < mvm; i++) {
        await espera();
        const ok = await hacer("mesa vs mesa", async () => {
          await tocar('#tm-tabs [data-go="inicio"]'); await tocar('#tm [data-go="mesas"]'); await visible("#tm #listo, #tm #otra");
          await tocar(prob(r, 0.5) ? "#tm #listo" : "#tm #otra");
        });
        if (ok) seccion("antro/mesas"); else break;
      }
      await espera();
      /* Cierra cualquier ventana que haya quedado abierta (avisos de mesa vs mesa, etc.) */
      await page.evaluate(() => { document.querySelectorAll("#tm .aviso [data-a], #tm-modal:not([hidden]) button").forEach((b, i) => { if (i === 0) b.click(); }); }).catch(() => {});
      if (await hacer("abrir la botella", async () => { await tocar('#tm-tabs [data-go="inicio"]'); await tocar('#tm [data-go="botella"]'); await visible("#tm #girab"); })
        && await hacer("gira la botella", async () => { await tocar("#tm #girab"); await visible("#tm #botres .carta", 9000); })) seccion("antro/botella");
    }

    else if (s.perfil === "Peda en casa") {   /* 35%: Cupido en la Mesa (todos) o Cita a Ciegas (parejas) */
      await espera(); await hacer("entrar a La Peda", () => irA("peda"));
      await espera(); await hacer("empezar", () => tocar("#intro .btn"));
      const parejas = prob(r, 0.5), nombres = barajar(r, NOMBRES).slice(0, entre(r, 2, 8));
      R.embudo.cita_inicio = true;
      await page.evaluate(() => { try { players.length = 0; guardarJugadores(); } catch (e) {} }).catch(() => {});
      for (const nm of nombres) { await espera(300, 1000); await hacer("agregar jugador", async () => { await page.fill("#nameInput", nm); await tocar("#players .addbar button"); }); }
      await espera(); await hacer("elegir modo", () => tocar("#toModes"));
      if (parejas) {
        await hacer("abrir Cita a Ciegas", async () => { await tocar("#modes .m-bd"); await visible("#bdElla"); });
        const np = Math.max(1, Math.floor(nombres.length / 2));
        for (let i = 0; i < np; i++) { await espera(300, 1200); await hacer("registrar pareja", async () => { await page.fill("#bdElla", nombres[2 * i] || "Ana"); await page.fill("#bdEl", nombres[2 * i + 1] || "Beto"); await tocar('[data-bd="agregar"]'); }); }
        await hacer("empezar cita", async () => { await tocar("#bdStart"); await visible("#bdgame.active, #bdgame", 5000); });
      } else await hacer("abrir Cupido en la Mesa", async () => { await tocar("#modes .m-bd2"); await page.waitForFunction(() => document.querySelector("#lp .screen.active")?.id === "bdgame", null, { timeout: 5000 }); });
      const cartas = entre(r, 10, 40); let jugadas = 0;
      for (let k = 0; k < cartas; k++) {
        await espera(400, 2500);
        const ok = await hacer("siguiente carta (cita)", async () => {
          await page.waitForFunction(() => [...document.querySelectorAll("#bdActs button")].some(b => b.offsetParent && !/Terminar/.test(b.textContent)), null, { timeout: 9000 }).catch(() => {});
          const b = page.locator('#bdActs button:visible').filter({ hasNotText: /Terminar/ });
          const prefer = page.locator('#bdActs [data-bd="sig"]:visible, #bdActs [data-bd="coinc"]:visible, #bdActs [data-bd="salud"]:visible, #bdActs [data-bd="tomaron"]:visible, #bdActs [data-bd="contar"]:visible');
          if (await prefer.count()) await tocar(prefer.first()); else if (await b.count()) await tocar(b.first()); else throw new Error("sin botones");
        });
        if (!ok) break; jugadas++;
      }
      await espera(); await hacer("terminar cita", () => tocar('[data-bd="terminar"]'));
      for (let k = 0; k < 25; k++) {   /* cartas finales y fotos: avanzar sin foto hasta los resultados */
        const act = await page.evaluate(() => document.querySelector("#lp .screen.active")?.id).catch(() => "");
        if (act === "bdres") break;
        await espera(300, 1200);
        await hacer("avanzar al final (cita)", async () => {
          if ((await page.evaluate(() => document.querySelector("#lp .screen.active")?.id).catch(() => "")) === "bdres") return;
          if (act === "bdfoto") { await tocar('#bdfoto [data-bd="foto-saltar"], #bdfoto [data-bd="foto-ok"]'); return; }
          await page.waitForFunction(() => [...document.querySelectorAll("#bdActs button")].some(b => b.offsetParent && !/Terminar/.test(b.textContent)), null, { timeout: 9000 }).catch(() => {});
          await tocar(page.locator('#bdActs button:visible').filter({ hasNotText: /Terminar/ }).first());
        });
      }
      R.embudo.cita_resultados = (await page.evaluate(() => document.querySelector("#lp .screen.active")?.id).catch(() => "")) === "bdres";
      R.cita = { modo: parejas ? "Cita a Ciegas" : "Cupido en la Mesa", jugadores: nombres.length, cartas: jugadas, resultados: R.embudo.cita_resultados };
    }

    else if (s.perfil === "A ver qué te toca") {
      await espera(); await hacer("entrar a ¿A ver qué te toca?", () => irA("quien"));
      const n = entre(r, 1, 3), elegidos = barajar(r, ["La Bomba", "El Rey", "¿Quién soy?", "El Impostor", "El Dedo"]).slice(0, n);
      for (let gi = 0; gi < elegidos.length; gi++) {
        const juego = elegidos[gi], J = { juego, empezo: false, termino: false, pasos: 0, ms: 0, explotó: 0 }, t0j = Date.now();
        await espera();
        if (gi === 0 && prob(r, 0.5)) await hacer("girar ruleta de juegos", async () => {
          const t = Date.now(); if (await page.locator("#jgOtro").isVisible().catch(() => false)) await tocar("#jgOtro"); else await tocar("#jgMachine");
          await page.waitForFunction(() => { const e = document.querySelector("#jgRes"); return e && !e.hidden; }, null, { timeout: TIMEOUT_ACCION });
          const res = (await page.textContent("#jgH")).trim(); R.juegos_ruleta.push({ antes: R.juegos_ruleta.at(-1)?.resultado ?? null, resultado: res, ms: Date.now() - t });
        });
        const ok = await hacer("abrir " + juego, async () => {
          if (!(await page.locator("#jgMenuBtn").isVisible().catch(() => false))) await aInicio().then(() => irA("quien"));
          await tocar("#jgMenuBtn"); await tocar(page.locator("#jgMenu [data-gi]", { hasText: juego }).first());
        });
        if (!ok) { R.juegos.push(J); continue; }
        J.empezo = true;
        if (juego === "El Dedo") {
          const cdp = await ctx.newCDPSession(page);
          for (let q = 0, rondas = entre(r, 1, 3); q < rondas; q++) {
            await espera();
            const dedos = entre(r, 2, 6), antes = prob(r, 0.12);
            await hacer("poner " + dedos + " dedos", async () => {
              const pad = await page.locator("#qtPad").boundingBox();
              const pts = Array.from({ length: dedos }, (_, i) => ({ x: pad.x + pad.width * (0.15 + 0.7 * ((i % 3) / 2)), y: pad.y + pad.height * (0.25 + 0.5 * Math.floor(i / 3)), id: i + 1 }));
              const puestos = []; for (const p of pts) { puestos.push(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: puestos.map(x => ({ x: x.x, y: x.y, id: x.id })) }); await dormir(100); }
              if (antes) { await dormir(900); R.rarezas.push("quitó el dedo antes de tiempo"); }
              else await page.waitForFunction(() => document.querySelector("#qtPad .qt-dot.win"), null, { timeout: 6000 });
              const g = await page.evaluate(() => { const w = document.querySelector("#qtPad .qt-dot.win"); if (!w) return null; const b = w.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
              let gana = -1; if (g) { let best = 1e9; pts.forEach((p, i) => { const dd = (p.x - g.x) ** 2 + (p.y - g.y) ** 2; if (dd < best) { best = dd; gana = i; } }); }
              R.dedo.push({ dedos, ganador: gana, quito_antes: antes, eligio: gana >= 0 });
              await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await dormir(1300);
            });
            J.pasos++;
          }
          J.termino = R.dedo.some(d => d.eligio);
          await hacer("salir de El Dedo", async () => { await page.evaluate(() => document.querySelector("#jgBack")?.click()); await dormir(500); });
        } else {
          /* Pantalla de jugadores (la misma lista de La Peda) */
          if (await page.locator("#jnNom").isVisible().catch(() => false)) {
            const quiere = juego === "El Impostor" ? entre(r, 3, 8) : entre(r, 2, 8);
            for (const nm of barajar(r, NOMBRES).slice(0, quiere)) {
              if (await page.locator('[data-j="ok"]:not([disabled])').count() && prob(r, 0.5)) break;
              await espera(200, 900);
              if (prob(r, 0.05)) { R.rarezas.push("agregó nombre vacío"); await hacer("nombre vacío", async () => { await page.fill("#jnNom", ""); await tocar('[data-j="add"]'); }); }
              await hacer("agregar jugador", async () => { await page.fill("#jnNom", nm); await tocar('[data-j="add"]'); });
            }
            await hacer("listo jugadores", () => tocar('[data-j="ok"]:not([disabled])'));
          }
          const PRIO = {
            "La Bomba": ['[data-k="go"]', '[data-k="again"]', '[data-k="pass"]'],
            "El Rey": ['[data-k="sacar"]', '.jn-pk', '[data-k="sig"]', '[data-k="res"]'],
            "¿Quién soy?": ['[data-q="cat"]', '[data-q="go"]', '[data-q="ok"]', '[data-q="paso"]', '[data-q="sig"]'],
            "El Impostor": ['[data-c]', '[data-i="soy"]', '#jnVer', '[data-i="listo"]:not([disabled])', '[data-i="votar"]', '.jn-pk', '[data-i="revelar"]:not([disabled])', '[data-i="si"]', '[data-i="no"]', '[data-i="pistas"]', '[data-i="otra"]', '[data-i="palabra"]']
          }[juego];
          const pasos = juego === "La Bomba" ? entre(r, 2, 6) : entre(r, 10, 35);
          for (let k = 0; k < pasos; k++) {
            await espera(juego === "¿Quién soy?" ? 300 : 400, juego === "¿Quién soy?" ? 1500 : 2500);
            if (juego === "La Bomba" && await page.locator('[data-k="stop"]').isVisible().catch(() => false)) { await page.waitForSelector('[data-k="again"]', { timeout: 45000 }).catch(() => {}); J.explotó++; continue; }
            const ok = await hacer("jugar " + juego, async () => {
              for (const sel of PRIO) {
                const loc = page.locator(`#jg ${sel}:visible, #jg ${sel}`).first();
                if (!(await loc.isVisible().catch(() => false)) || await loc.isDisabled().catch(() => false)) continue;
                if (sel === "#jnVer") { const b = await loc.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await dormir(700); await page.mouse.up(); return; }
                if (sel === ".jn-pk") { const n = await page.locator("#jg .jn-pk:visible").count(); await tocar(page.locator("#jg .jn-pk:visible").nth(Math.floor(r() * n))); return; }
                await tocar(loc); return;
              }
              /* ¿Quién soy? sin botones visibles: tocar la mitad derecha (correcto) o izquierda (paso) */
              const vp = page.viewportSize(); await page.touchscreen.tap(vp.width * (prob(r, 0.6) ? 0.8 : 0.2), vp.height * 0.5);
            });
            if (ok) J.pasos++; else break;
          }
          if (juego !== "La Bomba") {
            await espera();
            await hacer("terminar " + juego, async () => {
              if (await page.locator('#jg [data-x="fin"]').first().isVisible().catch(() => false)) await tocar('#jg [data-x="fin"]');
              else await page.evaluate(() => document.querySelector("#jgBack")?.click());   /* «‹ Volver» también muestra el resumen */
              await visible("#jg .jn-res", 5000);
            });
            J.termino = await page.locator("#jg .jn-res").isVisible().catch(() => false);
            if (J.termino && prob(r, 0.4)) await hacer("mandar al grupo", async () => { await tocar('#jg [data-r="share"]'); R.compartio = true; });
          } else J.termino = J.explotó > 0;
          await hacer("volver a los juegos", async () => { if (await page.locator('#jg [data-r="salir"]').isVisible().catch(() => false)) await tocar('#jg [data-r="salir"]'); else await page.evaluate(() => document.querySelector("#jgBack")?.click()); await dormir(500); });
        }
        J.ms = Date.now() - t0j; R.juegos.push(J); seccion("quien/" + juego);
      }
    }

    else if (s.perfil === "Rápido") {
      const limite = Date.now() + 25000, cosas = entre(r, 1, 2);
      for (let i = 0; i < cosas && Date.now() < limite; i++) {
        await espera(300, 1500);
        const dest = uno(r, ["drinks", "peda", "antro", "quien", "privacidad"]);
        if (dest === "privacidad") { await hacer("abrir aviso de privacidad", async () => { await tocar("#v-home [data-privacidad]"); await visible(".pb-priv-ov"); await tocar(".pb-priv-ov .pb-x"); }); continue; }
        if (R.abandono !== "inicio") await hacer("ir a inicio", aInicio);
        await hacer("entrar a " + dest, () => irA(dest));
        await espera(300, 1500);
        if (dest === "drinks") await hacer("girar drink del día", async () => {
          const antes = await page.getAttribute("#machine", "aria-label"); const t = Date.now(); await tocar("#spinBtn");
          await page.waitForFunction(() => !document.querySelector("#result").hidden, null, { timeout: TIMEOUT_ACCION });
          R.slot.push({ antes, resultado: await page.getAttribute("#machine", "aria-label"), ms: Date.now() - t });
        });
      }
    }

    else if (s.perfil === "Botella premiada") {
      const validos = ctxDatos.validos, usarValido = validos.length && prob(r, 0.5);
      const c = usarValido ? { codigo: uno(r, validos), tipo: "válido" } : codigoInvalido(r, validos);
      R.premio = { codigo: c.codigo, tipo: c.tipo, esperado: c.tipo === "válido" ? "válido" : "inválido", mostrado: "", aceptado: false, en_mis_premios: false };
      await hacer("abrir con ?premio=", async () => { await page.goto(BASE + "/?premio=" + encodeURIComponent(c.codigo), { waitUntil: "load", timeout: TIMEOUT_ACCION }); });
      const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd } : null; }).catch(() => null);
      if (nav) { R.carga_dcl_ms = Math.round(nav.dcl); R.carga_total_ms = Math.round(nav.load); }
      seccion("premio");
      await hacer("ver boleto", async () => {
        await visible("#prize .ticket", 8000);
        const txt = (await page.textContent("#prize .ticket")).replace(/\s+/g, " ");
        R.premio.mostrado = /Verificado · válido/.test(txt) ? "válido" : /no válido|no existe/i.test(txt) ? "inválido" : /Ya canjeado/.test(txt) ? "ya canjeado" : /No pudimos verificarlo/.test(txt) ? "sin verificar" : "otro";
        R.premio.aceptado = R.premio.mostrado === "válido" || R.premio.mostrado === "ya canjeado";
      });
      if (await page.locator(".pb-edad-ov .pb-ok").isVisible().catch(() => false)) await hacer("aviso +18", () => tocar(".pb-edad-ov .pb-ok"));
      await espera(); await hacer("cerrar boleto", async () => { await tocar("#prize [data-pz-x]"); });
      await espera();
      await hacer("revisar Mis premios", async () => {
        const filas = await page.locator("#myPrizes [data-pz]").evaluateAll(e => e.map(x => x.dataset.pz)).catch(() => []);
        R.premio.en_mis_premios = filas.includes(String(c.codigo).toUpperCase());
        if (filas.length) { await tocar(page.locator("#myPrizes [data-pz]").first()); await visible("#prize .ticket"); await tocar("#prize [data-pz-x]"); }
      });
    }
  } catch (e) {
    R.errores.push({ tipo: "simulador", accion, msg: String(e.message || e).slice(0, 300) });
  }
  R.duracion_ms = Date.now() - t0;
  const estado = await ctx.storageState().catch(() => null);
  await ctx.close().catch(() => {});
  return { R, estado };
}

/* =====================================================================
   CORRER TODAS
   ===================================================================== */
async function main() {
  try { const r = await fetch(BASE + "/"); if (!r.ok) throw 0; } catch (e) { console.error(`No responde ${BASE}. Primero corre ./dev-local.sh desde la carpeta palma-netlify.`); process.exit(1); }
  mkdirSync(SALIDA, { recursive: true });
  const ses = plan(N_SIMULACIONES), validos = codigos();
  console.log(`${ses.length} simulaciones · ${CONCURRENCIA} a la vez · semilla ${SEMILLA} · ${validos.length} códigos válidos disponibles`);
  const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) }); // PW_CHANNEL=chrome usa el Chrome instalado
  const resultados = [], estados = [];
  let sig = 0, hechas = 0;
  async function trabajador() {
    while (sig < ses.length) {
      const s = ses[sig++];
      const previo = s.regresa && estados.length ? estados[Math.floor(mulberry32(s.semilla)() * estados.length)] : null;
      const { R, estado } = await sesion(browser, s, previo, { validos });
      resultados.push(R); if (estado) estados.push(estado);
      hechas++;
      process.stdout.write(`\r${hechas}/${ses.length} · última: #${R.id} ${R.perfil} (${R.celular}) ${Math.round(R.duracion_ms / 1000)} s · errores ${R.errores.length}   `);
    }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  await browser.close();
  resultados.sort((a, b) => a.id - b.id);
  const meta = { fecha: new Date().toISOString(), n: N_SIMULACIONES, semilla: SEMILLA, base: BASE, escala_tiempo: ESCALA, duracion_s: Math.round((Date.now() - t0) / 1000), validos_disponibles: validos.length };
  writeFileSync(join(SALIDA, "resultados.json"), JSON.stringify({ meta, resultados }, null, 1));
  console.log(`\nListo en ${meta.duracion_s} s → salida/resultados.json`);
}
main();
