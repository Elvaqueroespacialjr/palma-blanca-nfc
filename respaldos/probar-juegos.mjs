// Prueba de los juegos nuevos (El Rey, ¿Quién soy?, El Impostor), Blind Date y el resto de la app.
// Uso: node respaldos/probar-juegos.mjs   (con el servidor de prueba en http://localhost:8888)
import { chromium } from "../pruebas/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:8888";
const CAP = join(dirname(fileURLToPath(import.meta.url)), "capturas");
mkdirSync(CAP, { recursive: true });
const TAMANOS = [{ n: "390x844", w: 390, h: 844 }, { n: "360x740", w: 360, h: 740 }];
const fallas = [];
const ok = (cond, msg) => { if (!cond) fallas.push(msg); return cond; };

async function probar(t) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-MX", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", e => errores.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/vibrate|Failed to load resource|ERR_CONNECTION/i.test(m.text())) errores.push("console: " + m.text()); });
  await page.addInitScript(() => { try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); if (window.DeviceMotionEvent) DeviceMotionEvent.requestPermission = () => Promise.resolve("granted"); localStorage.setItem("pb.edad", "1"); localStorage.setItem("lp_jugadores", JSON.stringify(["Javi", "Ana", "Beto", "Caro"])); } catch (e) {} });
  const desborde = async (donde) => { const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, bw: document.querySelector("#jgBody")?.scrollWidth || 0, bcw: document.querySelector("#jgBody")?.clientWidth || 0 })); ok(d.sw <= d.w + 1 && d.bw <= d.bcw + 1, `${t.n} · ${donde}: se sale de la pantalla (${d.sw}/${d.w}, cuerpo ${d.bw}/${d.bcw})`); };
  const foto = (n) => page.screenshot({ path: join(CAP, `${t.n}-${n}.png`) });
  const tap = (sel) => page.locator(sel).first().tap({ timeout: 8000 });
  const abrirJuego = async (nombre) => {
    await page.goto(BASE + "/#quien"); await page.waitForSelector("#jgMenuBtn", { state: "attached", timeout: 8000 });
    await page.waitForFunction(() => !document.querySelector("#jgRes")?.hidden, null, { timeout: 8000 }).catch(() => {});
    await tap("#jgMenuBtn"); await page.locator("#jgMenu [data-gi]", { hasText: nombre }).first().tap();
    await page.waitForSelector("#jgStage .jn", { timeout: 5000 });
  };
  /* Revisa que los botones de los juegos nuevos midan al menos 56 px */
  const alturas = async (donde) => { const m = await page.evaluate(() => [...document.querySelectorAll("#jgStage .jn-btn, #jgStage .jn-pk")].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height))); ok(!m.length || Math.min(...m) >= 56, `${t.n} · ${donde}: hay botones de menos de 56 px (${Math.min(...m)})`); };

  /* ---------- 1. EL REY ---------- */
  await abrirJuego("El Rey");
  ok((await page.locator("#jgStage .jn-chip").count()) === 4, `${t.n} · El Rey: no reutilizó los 4 jugadores de La Peda`);
  await foto("rey-1-jugadores"); await alturas("El Rey jugadores"); await desborde("El Rey jugadores");
  await tap('#jgStage [data-j="ok"]');
  await foto("rey-2-mazo");
  let reyes = 0, cartas = 0, vioActivas = false;
  for (let i = 0; i < 60; i++) {
    if (await page.locator("#jgStage .jn-final").count()) break;
    await tap('#jgStage [data-k="sacar"]'); cartas++;
    const r = await page.locator("#jgStage .jn-carta .rango").textContent().catch(() => "");
    if (!r && await page.locator("#jgStage .jn-final").count()) break;
    if (cartas === 1) await foto("rey-3-carta");
    const turno = await page.locator("#jgStage .jn-turno b").textContent();
    ok(/^(Javi|Ana|Beto|Caro)$/.test(turno.trim()), `${t.n} · El Rey: no se ve de quién es el turno`);
    if (r === "2" || r === "8") await page.locator("#jgStage [data-un]").first().tap();
    if (r === "J") await page.fill("#jnRegla", "Prohibido decir tú");
    if (["4", "5", "6", "7", "9", "10"].includes(r)) await page.locator("#jgStage [data-va]").first().tap();
    if (await page.locator("#jgStage .jn-activas").count()) { vioActivas = true; }
    if (await page.locator("#jgStage .jn-activas").count() && !(await page.locator(`${"#jgStage"} .jn-activas`).isHidden())) { if (cartas > 8 && !global.__fotoActivas) { global.__fotoActivas = 1; await foto("rey-4-reglas-activas"); } }
    await alturas("El Rey carta"); await desborde("El Rey carta " + r);
    if (await page.locator("#jgStage .jn-final").count()) break;
    await tap('#jgStage [data-k="sig"]');
  }
  global.__fotoActivas = 0;
  ok(await page.locator("#jgStage .jn-final").count(), `${t.n} · El Rey: no llegó al ¡Shot del Rey! (${cartas} cartas)`);
  await foto("rey-5-shot-del-rey");
  await tap('#jgStage [data-k="res"]');
  await page.waitForSelector("#jgStage .jn-res", { timeout: 5000 });
  ok(/Javi|Ana|Beto|Caro/.test(await page.locator("#jgStage .jn-tabla").textContent()), `${t.n} · El Rey: el resumen no tiene jugadores`);
  ok(vioActivas, `${t.n} · El Rey: nunca se mostraron reglas activas`);
  await foto("rey-6-resumen"); await desborde("El Rey resumen");
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  await tap('#jgStage [data-r="share"]'); await page.waitForTimeout(300);
  const copiado = await page.evaluate(() => navigator.clipboard.readText().catch(() => "")); ok(/El Rey · Palma Blanca/.test(copiado), `${t.n} · El Rey: «Mandar al grupo» no copió el texto`);

  /* ---------- 2. ¿QUIÉN SOY? ---------- */
  await abrirJuego("¿Quién soy?");
  await tap('#jgStage [data-j="ok"]');
  await foto("quiensoy-1-categorias"); await alturas("Quién soy categorías");
  ok((await page.locator("#jgStage [data-c]").count()) === 8, `${t.n} · ¿Quién soy?: no hay 8 categorías (7 + Mezcla)`);
  await page.locator("#jgStage [data-c]", { hasText: "Comida mexicana" }).tap();
  await foto("quiensoy-2-instrucciones"); await desborde("Quién soy instrucciones");
  await page.clock?.install?.().catch?.(() => {});
  await tap('#jgStage [data-q="go"]');
  await page.waitForSelector(".jn-qs", { timeout: 5000 });
  await page.waitForTimeout(3400); // 3-2-1
  const w1 = (await page.textContent("#qsW")).trim(); ok(w1 && !/^\d$/.test(w1), `${t.n} · ¿Quién soy?: no apareció la palabra tras el 3-2-1`);
  const rot = await page.evaluate(() => document.querySelector(".jn-qs").classList.contains("rot")); ok(rot, `${t.n} · ¿Quién soy?: con el cel parado no se giró la pantalla`);
  await foto("quiensoy-3-palabra");
  const box = await page.locator(".jn-qs").boundingBox();
  /* Pantalla girada 90°: la mitad «derecha» del jugador queda abajo en la pantalla */
  await page.locator('.jn-qs [data-q="ok"]').tap(); await page.waitForTimeout(120); await foto("quiensoy-4-correcto"); await page.waitForTimeout(700);
  await page.locator('.jn-qs [data-q="paso"]').tap(); await page.waitForTimeout(120); await foto("quiensoy-5-paso"); await page.waitForTimeout(700);
  await page.locator('.jn-qs [data-q="ok"]').tap(); await page.waitForTimeout(800);
  /* Simula inclinar el cel hacia abajo (correcto) */
  await page.evaluate(() => { const ev = z => { const e = new Event("devicemotion"); e.accelerationIncludingGravity = { x: 0, y: 0, z }; dispatchEvent(e); }; ev(0); ev(-9); });
  await page.waitForTimeout(800);
  const n = (await page.textContent("#qsN")).trim();
  ok(/^(3|4) ✓$/.test(n), `${t.n} · ¿Quién soy?: el contador de aciertos no cuadra (${n})`);
  await page.locator('.jn-qs [data-q="x"]').tap();
  await page.waitForSelector("#jgStage .jn-listas", { timeout: 5000 });
  await foto("quiensoy-6-resultado"); await desborde("Quién soy resultado"); await alturas("Quién soy resultado");
  ok(/toma/.test(await page.textContent("#jgStage .jn-regla")), `${t.n} · ¿Quién soy?: no dice cuántos tragos`);
  await tap('#jgStage [data-q="sig"]');
  ok(/Ana/.test(await page.textContent("#jgStage .jn-turno b")), `${t.n} · ¿Quién soy?: no pasó el turno al siguiente`);
  await tap('#jgStage .jn-turno [data-x="fin"]');
  await page.waitForSelector("#jgStage .jn-res", { timeout: 5000 }); await foto("quiensoy-7-resumen");

  /* ---------- 3. EL IMPOSTOR ---------- */
  await abrirJuego("El Impostor");
  await tap('#jgStage [data-j="ok"]');
  await page.locator("#jgStage [data-c]", { hasText: "Fiesta y antro" }).tap();
  await foto("impostor-1-pasale");
  const papeles = [];
  for (let i = 0; i < 4; i++) {
    await tap('#jgStage [data-i="soy"]');
    ok(await page.locator('#jgStage [data-i="listo"]').isDisabled(), `${t.n} · Impostor: se puede pasar sin ver el papel`);
    const v = page.locator("#jnVer"), b = await v.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.waitForTimeout(150);
    papeles.push((await page.locator("#jnVer .papel").innerText()).replace(/\s+/g, " ").trim());
    if (i === 0) await foto("impostor-2-papel-visible");
    await page.mouse.up(); await page.waitForTimeout(100);
    ok(!(await page.locator("#jnVer").evaluate(e => e.classList.contains("on"))), `${t.n} · Impostor: el papel no se oculta al soltar`);
    if (i === 0) await foto("impostor-3-papel-oculto");
    await tap('#jgStage [data-i="listo"]');
  }
  const imps = papeles.filter(p => /IMPOSTOR/.test(p)).length;
  ok(imps === 1, `${t.n} · Impostor: debía haber 1 impostor y hubo ${imps}`);
  const palabras = new Set(papeles.filter(p => !/IMPOSTOR/.test(p))); ok(palabras.size === 1, `${t.n} · Impostor: no todos vieron la misma palabra`);
  await foto("impostor-4-pistas"); await desborde("Impostor pistas"); await alturas("Impostor pistas");
  await tap('#jgStage [data-i="pistas"]'); await tap('#jgStage [data-i="votar"]');
  await foto("impostor-5-votacion");
  const quienImp = ["Javi", "Ana", "Beto", "Caro"][papeles.findIndex(p => /IMPOSTOR/.test(p))];
  await page.locator(`#jgStage [data-v="${quienImp}"]`).tap();
  await tap('#jgStage [data-i="revelar"]');
  await page.waitForTimeout(400); await foto("impostor-6-suspenso");
  await page.waitForSelector('#jgStage [data-i="palabra"]', { timeout: 6000 });
  await foto("impostor-7-atrapado");
  await tap('#jgStage [data-i="palabra"]'); await tap('#jgStage [data-i="no"]');
  await foto("impostor-8-final");
  await tap('#jgStage [data-i="otra"]');
  ok(await page.locator('#jgStage [data-i="soy"]').count(), `${t.n} · Impostor: «Otra ronda» no empezó otro reparto`);
  await page.locator("#jgBack").evaluate(b => b.click());
  await page.waitForSelector("#jgStage .jn-res", { timeout: 5000 }).catch(() => ok(false, `${t.n} · Impostor: al salir no salió el resumen`));
  await foto("impostor-9-resumen");

  /* ---------- 4. BLIND DATE con cartas nuevas ---------- */
  await page.goto(BASE + "/#peda"); await page.waitForTimeout(600);
  const nuevas = await page.evaluate(() => { const d = window.BLINDDATE_DATA; return d.niveles.flatMap(n => n.cartas).filter(c => /Tómense de la mano|Cambia de pareja|Verdad o reto|Los chicos toman/.test(c)).length; });
  ok(nuevas === 4, `${t.n} · Blind Date: no están las cartas nuevas`);
  await page.evaluate(() => { go("modes"); }); await page.waitForTimeout(300);
  await page.locator("#lp .m-bd").tap(); await page.waitForTimeout(400);
  await page.fill("#bdElla", "Sofi"); await page.fill("#bdEl", "Leo"); await page.locator('[data-bd="agregar"]').tap(); await page.locator("#bdStart").tap();
  let vista = false;
  for (let i = 0; i < 200 && !vista; i++) {
    const txt = await page.locator("#bdCard .bd-txt").textContent().catch(() => "");
    if (/Tómense de la mano|amor|30 segundos/.test(txt)) { vista = true; await foto("blinddate-carta-nueva"); break; }
    const sig = page.locator('#bdActs [data-bd="sig"]').first();
    if (!(await sig.count())) { const o = page.locator("#bdActs button").first(); if (!(await o.count())) break; await o.tap().catch(() => {}); await page.waitForTimeout(3500); continue; }
    await sig.tap().catch(() => {}); await page.waitForTimeout(150);
  }
  ok(vista, `${t.n} · Blind Date: no salió ninguna carta nueva`);
  await desborde("Blind Date");

  /* ---------- 5. Lo demás sigue igual ---------- */
  await page.goto(BASE + "/#quien"); await page.waitForTimeout(800); await tap("#jgMenuBtn"); await page.locator("#jgMenu [data-gi]", { hasText: "La Bomba" }).tap();
  ok(await page.locator('#jgStage [data-k="go"]').count(), `${t.n} · La Bomba no abre`);
  await page.goto(BASE + "/#drinks"); await page.waitForTimeout(800); ok((await page.textContent("#catCount")).includes("13"), `${t.n} · Drinks no muestra las 13 recetas`);
  await page.goto(BASE + "/#antro"); await page.waitForTimeout(1500); ok(await page.locator("#tm").count(), `${t.n} · Modo Antro no abre`);
  await page.goto(BASE + "/#peda"); await page.waitForTimeout(600); await page.evaluate(() => { go("modes"); startMode("peda"); }); await page.waitForTimeout(500);
  ok((await page.textContent("#cardTxt")).length > 5, `${t.n} · La Peda no muestra cartas`);

  errores.forEach(e => fallas.push(`${t.n} · ${e}`));
  await browser.close();
}
for (const t of TAMANOS) { try { await probar(t); } catch (e) { fallas.push(`${t.n} · la prueba se detuvo: ${e.message.split("\n")[0]}`); } }
console.log(fallas.length ? "FALLAS:\n- " + fallas.join("\n- ") : "Todo bien en 390x844 y 360x740.");
