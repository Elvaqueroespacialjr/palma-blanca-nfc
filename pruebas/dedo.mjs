// Prueba enfocada de «El Dedo»: muchas rondas para saber si elige a todos con la misma probabilidad.
// Identifica al ganador por la POSICIÓN de su dedo (no por el orden de los puntos en pantalla).
// Uso: BASE_URL=http://localhost:8899 PW_CHANNEL=chrome RONDAS=150 node dedo.mjs
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:8888", RONDAS = Number(process.env.RONDAS || 150);
const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });
const { defaultBrowserType, ...cel } = devices["Pixel 7"];
const ctx = await browser.newContext({ ...cel, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto(BASE + "/#quien"); await page.evaluate(() => localStorage.setItem("pb.edad", "1"));
await page.reload(); await page.waitForTimeout(1500);
await page.locator("#jgMenuBtn").tap(); await page.locator("#jgMenu [data-gi]", { hasText: "El Dedo" }).tap();
await page.locator("#qtPad").waitFor();
const cdp = await ctx.newCDPSession(page);
const rondas = [];
for (let k = 0; k < RONDAS; k++) {
  const n = 2 + (k % 5);   // 2 a 6 dedos, parejo
  const pad = await page.locator("#qtPad").boundingBox();
  const pts = Array.from({ length: n }, (_, i) => ({ x: Math.round(pad.x + pad.width * (0.15 + 0.7 * (i % 3) / 2)), y: Math.round(pad.y + pad.height * (0.25 + 0.5 * Math.floor(i / 3))), id: i + 1 }));
  const activos = [];
  for (const p of pts) { activos.push(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: activos.map(a => ({ x: a.x, y: a.y, id: a.id })) }); await page.waitForTimeout(60); }
  await page.waitForFunction(() => document.querySelector("#qtPad .qt-dot.win"), null, { timeout: 8000 }).catch(() => {});
  const g = await page.evaluate(() => { const w = document.querySelector("#qtPad .qt-dot.win"); if (!w) return null; const r = w.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, puntos: document.querySelectorAll("#qtPad .qt-dot").length }; });
  let ganador = -1;
  if (g) { let best = 1e9; pts.forEach((p, i) => { const dd = (p.x - g.x) ** 2 + (p.y - g.y) ** 2; if (dd < best) { best = dd; ganador = i; } }); }
  rondas.push({ dedos: n, ganador, puntos_en_pantalla: g?.puntos ?? 0 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(500);
}
await browser.close();
mkdirSync(new URL("./salida/", import.meta.url), { recursive: true });
writeFileSync(new URL("./salida/dedo.json", import.meta.url), JSON.stringify(rondas));
const porN = {}; rondas.forEach(r => { (porN[r.dedos] ??= Array(r.dedos).fill(0)); if (r.ganador >= 0) porN[r.dedos][r.ganador]++; });
console.log("Ganadores por número de dedos (posición 1..n):", JSON.stringify(porN), "· sin elegir:", rondas.filter(r => r.ganador < 0).length);
